## La salle en ligne, par WebRTC : `js/room-rtc.js`, avec PeerJS réécrit dedans.
##
## Le jeu web trouve ses joueurs par l'annuaire public de PeerJS (0.peerjs.com) : l'hôte s'y
## inscrit sous le nom de sa table, `slot-racer-v1-` + le code, et chaque invité l'appelle. Les
## courses passent ensuite directement d'un appareil à l'autre, par un canal de données WebRTC.
## Pour s'asseoir aux MÊMES tables, Godot parle exactement comme la bibliothèque PeerJS 1.5.4 :
##
##   - l'annuaire : un WebSocket, des messages JSON OPEN, OFFER, ANSWER, CANDIDATE, LEAVE,
##     EXPIRE, ID-TAKEN, ERROR, et un HEARTBEAT toutes les cinq secondes (lib/socket.ts) ;
##   - l'appel : l'invité ouvre le canal (étiquette `dc_…`, non ordonné : `reliable: false`), fait
##     l'offre et l'envoie avec `serialization: 'binary'` (lib/negotiator.ts) ;
##   - les messages : emballés en BinaryPack, découpés en morceaux de 16 300 octets au-delà
##     (lib/dataconnection/BufferedConnection/BinaryPack.ts).
##
## Au-dessus, la même chose que room-rtc.js : un tableau de présences. Chacun publie la sienne,
## entière à chaque fois, et voit celles des autres ; l'hôte relaie les présences des invités aux
## autres invités (hors course, voir `relayer`). Les messages de course sont adressés.
##
## WebRTC vient du navigateur dans la version web, et de l'extension officielle de Godot
## (addons/webrtc_native) sur ordinateur et téléphone.
class_name SalleRTC
extends RefCounted

const VERSION_PEERJS := "1.5.4"
const OUVERTURE_MAX := 12.0       # l'annuaire ne répond pas
const APPEL_MAX := 15.0           # la table n'existe pas, ou l'hôte est injoignable
const MORCEAU := 16300            # chunkedMTU de PeerJS
const BATTEMENT := 5.0            # le HEARTBEAT de l'annuaire

## Les serveurs ICE par défaut de PeerJS (lib/util.ts) : un STUN de Google et les relais TURN de
## PeerJS, pour les appareils derrière des réseaux fermés.
const ICE_DEFAUT := [
	{ "urls": ["stun:stun.l.google.com:19302"] },
	{ "urls": ["turn:eu-0.turn.peerjs.com:3478", "turn:us-0.turn.peerjs.com:3478"],
		"username": "peerjs", "credential": "peerjsp" },
]

var ws: WebSocketPeer
var id := ""                      # notre nom dans l'annuaire
var label := ""                   # notre étiquette de présence : 0-… pour l'hôte, 1-… pour un invité
var host := false
var relayer := true
var open := false
var error := ""
var mine := {}
var others := {}                  # étiquette -> { presence, updatedAt }
var conns: Array[Dictionary] = []

var _jeton := ""
var _hote := ""                   # le nom de l'hôte dans l'annuaire, quand on est invité
var _attente := ""                # "" | "annuaire" | "appel"
var _depuis := 0.0
var _battement := 0.0
var _ouvert := false
var _wsOuvert := false
var _enAttente: Dictionary = {}   # connectionId -> [messages arrivés avant la connexion]
var _morceauxN := 1
var _peerHandlers: Array[Callable] = []
var _messageHandlers: Array[Callable] = []
var _config := {}

signal _fini(err: String)


static func available() -> bool:
	return ClassDB.class_exists("WebRTCPeerConnection") and (OS.has_feature("web") or _extensionPresente())


static func _extensionPresente() -> bool:
	# Sans extension, Godot fabrique une connexion vide qui échoue : on l'essaie une fois.
	var pc := WebRTCPeerConnection.new()
	return pc.initialize({ "iceServers": [] }) == OK


## Le préfixe des tables : la recette a les siennes, comme le jeu web (APP_CANAL).
static func prefixe() -> String:
	var canal := String(ProjectSettings.get_setting("grip/canal", "recette"))
	return "slot-racer-v1-" + ("recette-" if canal == "recette" else "")


static func labelFor(code: String, asHost: bool) -> String:
	return ("0-" if asHost else "1-") + code + "-" + _hasard(6)


static func _hasard(n: int) -> String:
	const C := "abcdefghijklmnopqrstuvwxyz0123456789"
	var s := ""
	for i in n: s += C[randi() % C.length()]
	return s


## Où trouver l'annuaire : le public de PeerJS, ou celui que fixe `window.SLOT_RACER_RTC` (la même
## clé que le jeu web, dans la version web) ou la variable GRIP_ANNUAIRE (ws://hôte:port/chemin/).
static func configuration() -> Dictionary:
	var c := { host = "0.peerjs.com", port = 443, path = "/", secure = true, key = "peerjs", iceServers = ICE_DEFAUT }
	var autre := {}
	if OS.has_feature("web"):
		var j = JavaScriptBridge.eval("JSON.stringify((window.SLOT_RACER_RTC||{}).peer||null)", true)
		if j is String and j != "null":
			var d = JSON.parse_string(j)
			if d is Dictionary: autre = d
	var env := OS.get_environment("GRIP_ANNUAIRE")
	if env != "":
		var u := env.strip_edges()
		var sur := u.begins_with("wss://")
		u = u.trim_prefix("wss://").trim_prefix("ws://")
		var chemin := "/"
		if "/" in u:
			chemin = u.substr(u.find("/"))
			u = u.substr(0, u.find("/"))
		var port := 443 if sur else 80
		if ":" in u:
			port = u.get_slice(":", 1).to_int()
			u = u.get_slice(":", 0)
		autre = { host = u, port = port, path = chemin, secure = sur }
	for k in autre: c[k] = autre[k]
	if autre.has("host") and not autre.has("iceServers") and autre.host != "0.peerjs.com":
		# un annuaire local (les essais) : les deux écrans sont sur la même machine
		c.iceServers = []
	var p := String(c.path)
	if not p.begins_with("/"): p = "/" + p
	if not p.ends_with("/"): p += "/"
	c.path = p
	return c


# ---------------------------------------------------------------- la table

## Ouvre la table `code` : l'hôte prend le nom, l'invité l'appelle. Rend "" ou le message d'erreur,
## avec les mots de room-rtc.js (l'écran les traduit).
func claim(code: String, asHost: bool) -> String:
	close()
	host = asHost
	label = SalleRTC.labelFor(code, asHost)
	error = ""
	_config = SalleRTC.configuration()
	_hote = SalleRTC.prefixe() + code
	id = _hote if asHost else "grip" + _hasard(14)
	_jeton = _hasard(11)
	var url := "%s://%s:%d%speerjs?key=%s&id=%s&token=%s&version=%s" % [
		"wss" if _config.secure else "ws", _config.host, int(_config.port), _config.path, _config.key,
		id, _jeton, VERSION_PEERJS]
	ws = WebSocketPeer.new()
	ws.inbound_buffer_size = 1 << 20
	if ws.connect_to_url(url) != OK:
		ws = null
		return "annuaire injoignable"
	_attente = "annuaire"; _depuis = 0.0; _ouvert = false; _wsOuvert = false
	var err: String = await _fini
	if err != "":
		close(); return err
	if not asHost:
		_appelle()
		_attente = "appel"; _depuis = 0.0
		err = await _fini
		if err != "":
			close(); return err
	open = true
	_fire()
	return ""


func close() -> void:
	for c in conns:
		if c.pc: c.pc.close()
	conns.clear()
	others.clear()
	if ws:
		ws.close()
		ws = null
	open = false
	_attente = ""
	_enAttente.clear()


func _termine(err: String) -> void:
	if _attente == "": return
	_attente = ""
	_fini.emit(err)


## À appeler à chaque image (l'autoload Reseau s'en charge).
func poll(delta: float) -> void:
	if ws:
		ws.poll()
		# Les messages d'abord : l'annuaire envoie ID-TAKEN puis ferme aussitôt.
		while ws and ws.get_available_packet_count() > 0:
			var m = JSON.parse_string(ws.get_packet().get_string_from_utf8())
			if m is Dictionary: _annuaire(m)
		if ws and ws.get_ready_state() == WebSocketPeer.STATE_OPEN:
			_wsOuvert = true
			_battement += delta
			if _battement >= BATTEMENT:
				_battement = 0.0
				_envoieAnnuaire({ "type": "HEARTBEAT" })
		elif ws and ws.get_ready_state() == WebSocketPeer.STATE_CLOSED:
			# L'annuaire refuse un nom pris en envoyant ID-TAKEN et en fermant dans la foulée ; Godot
			# perd ce dernier message avec la fermeture. Une liaison fermée PAR L'ANNUAIRE (un code de
			# fermeture, même nul) avant OPEN, c'est donc le nom de la table qui est pris ; une liaison
			# qui n'a jamais abouti (-1), un annuaire injoignable.
			var refus := _wsOuvert or ws.get_close_code() >= 0
			ws = null
			if _attente == "annuaire": _termine("code déjà pris" if refus else "annuaire injoignable")
	if _attente != "":
		_depuis += delta
		if _attente == "annuaire" and _depuis > OUVERTURE_MAX: _termine("annuaire injoignable")
		elif _attente == "appel" and _depuis > APPEL_MAX: _termine("table introuvable")
	for c in conns.duplicate():
		_pollConn(c)


func _envoieAnnuaire(m: Dictionary) -> void:
	if ws and ws.get_ready_state() == WebSocketPeer.STATE_OPEN:
		ws.send_text(JSON.stringify(m))


func _annuaire(m: Dictionary) -> void:
	var type := String(m.get("type", ""))
	var src := String(m.get("src", ""))
	var payload = m.get("payload", {})
	if not (payload is Dictionary): payload = {}
	match type:
		"OPEN":
			_ouvert = true
			if _attente == "annuaire": _termine("")
		"ID-TAKEN":
			if _attente == "annuaire": _termine("code déjà pris")
		"ERROR", "INVALID-KEY":
			if _attente == "annuaire": _termine("annuaire injoignable")
			else: _echec("annuaire injoignable")
		"EXPIRE":
			if _attente == "appel": _termine("table introuvable")
		"LEAVE":
			for c in conns.duplicate():
				if c.peer == src: _parti(c)
		"OFFER":
			if host: _repond(src, payload)
		"ANSWER", "CANDIDATE":
			var cid := String(payload.get("connectionId", ""))
			var c := _conn(src, cid)
			if c.is_empty():
				if cid != "": (_enAttente.get_or_add(cid, []) as Array).append(m)
				return
			_signal(c, type, payload)


func _signal(c: Dictionary, type: String, payload: Dictionary) -> void:
	if type == "ANSWER":
		var sdp = payload.get("sdp", {})
		if sdp is Dictionary: c.pc.set_remote_description("answer", String(sdp.get("sdp", "")))
	elif type == "CANDIDATE":
		var k = payload.get("candidate", {})
		if k is Dictionary and String(k.get("candidate", "")) != "":
			c.pc.add_ice_candidate(String(k.get("sdpMid", "0")), int(k.get("sdpMLineIndex", 0)), String(k.candidate))


func _conn(peer: String, cid: String) -> Dictionary:
	for c in conns:
		if c.peer == peer and c.cid == cid: return c
	return {}


func _nouvelleConn(peer: String, cid: String) -> Dictionary:
	var pc := WebRTCPeerConnection.new()
	pc.initialize({ "iceServers": _config.iceServers })
	var c := { pc = pc, ch = null, peer = peer, cid = cid, open = false, slotLabel = "", morceaux = {} }
	pc.ice_candidate_created.connect(func(media: String, index: int, name: String) -> void:
		_envoieAnnuaire({ "type": "CANDIDATE", "dst": peer, "payload": {
			"candidate": { "candidate": name, "sdpMid": media, "sdpMLineIndex": index },
			"type": "data", "connectionId": cid } }))
	conns.append(c)
	return c


## L'invité appelle l'hôte (Peer.connect, puis Negotiator._makeOffer).
func _appelle() -> void:
	var cid := "dc_" + _hasard(11)
	var c := _nouvelleConn(_hote, cid)
	var pc: WebRTCPeerConnection = c.pc
	pc.session_description_created.connect(func(type: String, sdp: String) -> void:
		pc.set_local_description(type, sdp)
		if type == "offer":
			_envoieAnnuaire({ "type": "OFFER", "dst": _hote, "payload": {
				"sdp": { "type": "offer", "sdp": sdp }, "type": "data", "connectionId": cid,
				"label": cid, "reliable": false, "serialization": "binary" } }))
	c.ch = pc.create_data_channel(cid, { "ordered": false })
	c.ch.write_mode = WebRTCDataChannel.WRITE_MODE_BINARY
	pc.create_offer()


## L'hôte répond à une offre (Peer._handleMessage OFFER, puis Negotiator._makeAnswer).
func _repond(src: String, payload: Dictionary) -> void:
	var cid := String(payload.get("connectionId", ""))
	var ancienne := _conn(src, cid)
	if not ancienne.is_empty(): _parti(ancienne)
	var c := _nouvelleConn(src, cid)
	var pc: WebRTCPeerConnection = c.pc
	pc.session_description_created.connect(func(type: String, sdp: String) -> void:
		pc.set_local_description(type, sdp)
		if type == "answer":
			_envoieAnnuaire({ "type": "ANSWER", "dst": src, "payload": {
				"sdp": { "type": "answer", "sdp": sdp }, "type": "data", "connectionId": cid } }))
	pc.data_channel_received.connect(func(ch: WebRTCDataChannel) -> void:
		ch.write_mode = WebRTCDataChannel.WRITE_MODE_BINARY
		c.ch = ch)
	var sdp = payload.get("sdp", {})
	pc.set_remote_description("offer", String(sdp.get("sdp", "")) if sdp is Dictionary else "")
	for m in _enAttente.get(cid, []):
		_signal(c, String(m.type), m.payload)
	_enAttente.erase(cid)


func _pollConn(c: Dictionary) -> void:
	var pc: WebRTCPeerConnection = c.pc
	pc.poll()
	var etat := pc.get_connection_state()
	if etat == WebRTCPeerConnection.STATE_FAILED or etat == WebRTCPeerConnection.STATE_CLOSED:
		_parti(c); return
	var ch: WebRTCDataChannel = c.ch
	if ch == null: return
	ch.poll()
	var pret := ch.get_ready_state()
	if pret == WebRTCDataChannel.STATE_OPEN and not c.open:
		c.open = true
		_envoie(c, mine)
		if _attente == "appel": _termine("")
		_fire()
	elif pret == WebRTCDataChannel.STATE_CLOSED and c.open:
		_parti(c); return
	while ch.get_available_packet_count() > 0:
		var octets := ch.get_packet()
		var d = BinaryPack.unpack(octets)
		if d is Dictionary: _recu(c, d)
		if not conns.has(c): return


## Un message arrivé sur un canal : un morceau, une fermeture, ou un message du jeu.
func _recu(c: Dictionary, d: Dictionary) -> void:
	if d.has("__peerData"):
		var pd = d.__peerData
		if pd is Dictionary:
			if pd.get("type") == "close": _parti(c)
			return
		var cle := int(pd)
		var m: Dictionary = c.morceaux.get_or_add(cle, { total = int(d.get("total", 0)), parts = {} })
		if d.get("data") is PackedByteArray: m.parts[int(d.get("n", 0))] = d.data
		if m.parts.size() >= m.total:
			c.morceaux.erase(cle)
			var tout := PackedByteArray()
			for i in m.total: tout.append_array(m.parts.get(i, PackedByteArray()))
			var e = BinaryPack.unpack(tout)
			if e is Dictionary: _recu(c, e)
		return
	_jeu(c, d)


## room-rtc.js, wire() : la présence remplace celle de ce pair ; un message va au jeu.
func _jeu(c: Dictionary, d: Dictionary) -> void:
	if not (d.get("from") is String): return
	var de: String = d.from
	if host and c.slotLabel != "" and c.slotLabel != de: return
	if host or de.begins_with("0-"): c.slotLabel = de
	if d.has("message") and d.message != null and not host and de != c.slotLabel: return
	if d.has("message") and d.message != null:
		for h in _peerHandlersCopie(_messageHandlers): h.call(d.message, de)
		return
	var p = d.get("p", {})
	others[de] = { presence = p if p is Dictionary else {}, updatedAt = SalleRTC.maintenant() }
	if relayer:
		for o in conns:
			if o != c and o.open: _envoieBrut(o, d)
	_fire()


func _peerHandlersCopie(a: Array[Callable]) -> Array[Callable]:
	return a.duplicate()


func _parti(c: Dictionary) -> void:
	if not conns.has(c): return
	conns.erase(c)
	if c.slotLabel != "": others.erase(c.slotLabel)
	if conns.is_empty(): others.clear()
	if c.pc: c.pc.close()
	if not host and open: _echec("table introuvable")
	_fire()


func _echec(msg: String) -> void:
	error = msg
	open = false
	_fire()


# ---------------------------------------------------------------- l'envoi

func _envoie(c: Dictionary, presence: Dictionary) -> void:
	if not c.open: return
	if presence.get("s") != null and c.ch.get_buffered_amount() > 32768: return
	_envoieBrut(c, { "from": label, "p": presence })


func _envoieBrut(c: Dictionary, d: Dictionary) -> void:
	var ch: WebRTCDataChannel = c.ch
	if ch == null or ch.get_ready_state() != WebRTCDataChannel.STATE_OPEN: return
	var o := BinaryPack.pack(d)
	if o.size() <= MORCEAU:
		ch.put_packet(o); return
	# BinaryPackChunker : { __peerData: n°, n, total, data }, chacun dans son paquet
	var total := ceili(o.size() / float(MORCEAU))
	for i in total:
		var part := o.slice(i * MORCEAU, mini(o.size(), (i + 1) * MORCEAU))
		ch.put_packet(BinaryPack.pack({ "__peerData": _morceauxN, "n": i, "data": part, "total": total }))
	_morceauxN += 1


func onMessage(h: Callable) -> void:
	_messageHandlers.append(h)


func onPeers(h: Callable) -> void:
	_peerHandlers.append(h)


func message(packet: Dictionary, target: String = "") -> void:
	for c in conns:
		if not c.open or (target != "" and c.slotLabel != target): continue
		var en: int = c.ch.get_buffered_amount()
		if en > 65536: continue
		var k = packet.get("kind")
		if (k == "view" or k == "owned") and en > 16384: continue
		_envoieBrut(c, { "from": label, "message": packet })


# ---------------------------------------------------------------- le tableau des présences

func presence(patch: Dictionary) -> void:
	for k in patch:
		if patch[k] == null: mine.erase(k)
		else: mine[k] = patch[k]
	for c in conns: _envoie(c, mine)
	_fire()


func peers() -> Array:
	var list := [{ peer = label, isMe = true, presence = mine, updatedAt = SalleRTC.maintenant() }]
	for k in others:
		list.append({ peer = k, isMe = false, presence = others[k].presence, updatedAt = others[k].updatedAt })
	return list


func connected() -> bool:
	return open and conns.any(func(c): return c.open)


func _fire() -> void:
	var p := peers()
	for h in _peerHandlersCopie(_peerHandlers): h.call(p)


## Date.now() : l'heure en millisecondes.
static func maintenant() -> float:
	return Time.get_unix_time_from_system() * 1000.0
