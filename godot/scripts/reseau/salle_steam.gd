## La salle en ligne de la version Steam : les salons Steam et le réseau de Valve.
##
## La même surface que SalleRTC — un tableau de présences, des messages adressés — si bien que
## Net, NetLink et NetDrive tournent sans rien changer. Ce qui diffère est dessous :
##
##   - la table est un salon Steam (createLobby), marqué de son code à quatre lettres et du canal
##     (recette ou prod) ; rejoindre, c'est chercher le salon qui porte ce code (requestLobbyList),
##     ou cliquer sur l'invitation d'un ami (join_requested) ;
##   - les messages passent par Steam Networking Messages : Valve relaie, donc deux joueurs derrière
##     des réseaux fermés se trouvent quand même, sans annuaire public ni serveur à nous ;
##   - le contenu des messages reste le BinaryPack du jeu web, l'hôte au centre.
##
## Les joueurs Steam courent entre eux : un joueur du navigateur ne peut pas entrer dans un salon
## Steam. C'est le choix de Bruno — Steam pour la version Steam, les tables du jeu web pour le reste.
##
## Demande l'extension GodotSteam (addons/godotsteam) et un identifiant d'application Steam
## (réglage grip/steam_app_id ; 480, l'application d'essai de Valve, en attendant).
class_name SalleSteam
extends RefCounted

const CANAL := 0
const RECU_MAX := 64
const MEMBRES := 9                 # huit pilotes et l'hôte qui regarde, comme NET_SEATS + 1
const K_ERESULT_OK := 1
const ENTREE_OK := 1               # k_EChatRoomEnterResponseSuccess

var steam = null                   # le singleton GodotSteam (ou un faux, dans les essais)
var label := ""
var host := false
var relayer := true
var open := false
var error := ""
var mine := {}
var others := {}                   # étiquette -> { presence, updatedAt }
var conns: Array[Dictionary] = []  # { id (SteamID), slotLabel, open }
var lobby := 0
var _hote := 0
var _peerHandlers: Array[Callable] = []
var _messageHandlers: Array[Callable] = []

signal _fini(err: String)


func _init(s = null) -> void:
	steam = s if s != null else SalleSteam.singleton()


static func singleton():
	return Engine.get_singleton("Steam") if Engine.has_singleton("Steam") else null


## La version Steam se reconnaît à son étiquette d'export « steam » et à l'extension chargée.
static func active() -> bool:
	return OS.has_feature("steam") and SalleSteam.singleton() != null


## À appeler une fois, au démarrage de la version Steam. Les rappels de Steam tournent tout seuls
## (embed_callbacks) : rien à appeler à chaque image.
static func initialise() -> bool:
	var s = SalleSteam.singleton()
	if s == null: return false
	var id := int(ProjectSettings.get_setting("grip/steam_app_id", 480))
	var r: Dictionary = s.steamInitEx(id, true)
	return int(r.get("status", -1)) == 0


static func _constante(nom: String, defaut: int) -> int:
	return ClassDB.class_get_integer_constant("Steam", nom) if ClassDB.class_has_integer_constant("Steam", nom) else defaut


func claim(code: String, asHost: bool) -> String:
	close()
	host = asHost
	label = SalleRTC.labelFor(code, asHost)
	error = ""
	if steam == null: return "liaison impossible"
	steam.network_messages_session_request.connect(_demande)
	steam.lobby_chat_update.connect(_mouvement)
	# un code déjà tenu par un autre salon ouvert
	var trouves: Array = await _cherche(code)
	if asHost:
		if trouves.size(): return _rate("code déjà pris")
		steam.lobby_created.connect(_cree, CONNECT_ONE_SHOT)
		steam.createLobby(_constante("LOBBY_TYPE_PUBLIC", 2), MEMBRES)
		var err: String = await _fini
		if err != "": return _rate(err)
		_hote = steam.getSteamID()
	else:
		if trouves.is_empty(): return _rate("table introuvable")
		steam.lobby_joined.connect(_entre, CONNECT_ONE_SHOT)
		steam.joinLobby(trouves[0])
		var err: String = await _fini
		if err != "": return _rate(err)
		_hote = steam.getLobbyOwner(lobby)
		conns.append({ id = _hote, slotLabel = "", open = true })
		_envoie(conns[0], mine)
	open = true
	_fire()
	return ""


func _rate(err: String) -> String:
	close()
	return err


func _cherche(code: String) -> Array:
	steam.addRequestLobbyListStringFilter("grip", SalleRTC.prefixe(), _constante("LOBBY_COMPARISON_EQUAL", 0))
	steam.addRequestLobbyListStringFilter("code", code, _constante("LOBBY_COMPARISON_EQUAL", 0))
	steam.addRequestLobbyListDistanceFilter(_constante("LOBBY_DISTANCE_FILTER_WORLDWIDE", 3))
	steam.requestLobbyList()
	var l: Array = await steam.lobby_match_list
	return l


func _cree(resultat: int, id: int) -> void:
	if resultat != K_ERESULT_OK:
		_fini.emit("annuaire injoignable"); return
	lobby = id
	steam.setLobbyData(lobby, "grip", SalleRTC.prefixe())
	steam.setLobbyData(lobby, "code", label.get_slice("-", 1))
	steam.setLobbyJoinable(lobby, true)
	_fini.emit("")


func _entre(id: int, _permissions: int, _verrou: bool, reponse: int) -> void:
	if reponse != ENTREE_OK:
		_fini.emit("table introuvable"); return
	lobby = id
	_fini.emit("")


## Un membre du salon demande à nous parler : l'hôte accepte ses invités, l'invité son hôte.
func _demande(id: int) -> void:
	if not open and not host: return
	if host or id == _hote:
		steam.acceptSessionWithUser(id)


## Quelqu'un entre dans le salon ou le quitte (lobby_chat_update).
func _mouvement(id: int, change: int, _par: int, etat: int) -> void:
	if id != lobby: return
	if etat & (2 | 4 | 8 | 16):         # parti, déconnecté, expulsé, banni
		for c in conns.duplicate():
			if c.id == change: _parti(c)
		if not host and change == _hote: error = "table introuvable"; open = false; _fire()


func close() -> void:
	if steam != null:
		for c in conns: steam.closeSessionWithUser(c.id)
		if lobby != 0: steam.leaveLobby(lobby)
		for sig in [["network_messages_session_request", _demande], ["lobby_chat_update", _mouvement]]:
			if steam.is_connected(sig[0], sig[1]): steam.disconnect(sig[0], sig[1])
	conns.clear()
	others.clear()
	lobby = 0
	open = false


func poll(_delta: float) -> void:
	if steam == null or lobby == 0: return
	var recus: Array = steam.receiveMessagesOnChannel(CANAL, RECU_MAX)
	for m in recus:
		var de := int(m.get("identity", 0))
		var c := _connDe(de)
		if c.is_empty():
			if not host: continue          # un invité n'écoute que son hôte
			c = { id = de, slotLabel = "", open = true }
			conns.append(c)
		var d = BinaryPack.unpack(m.get("payload", PackedByteArray()))
		if d is Dictionary: _jeu(c, d)


func _connDe(id: int) -> Dictionary:
	for c in conns:
		if c.id == id: return c
	return {}


## Le même tri que room-rtc.js (wire) : une présence remplace celle du pair, un message va au jeu.
func _jeu(c: Dictionary, d: Dictionary) -> void:
	if not (d.get("from") is String): return
	var de: String = d.from
	if host and c.slotLabel != "" and c.slotLabel != de: return
	if host or de.begins_with("0-"): c.slotLabel = de
	if d.get("message") != null:
		if not host and de != c.slotLabel: return
		for h in _messageHandlers.duplicate(): h.call(d.message, de)
		return
	var p = d.get("p", {})
	others[de] = { presence = p if p is Dictionary else {}, updatedAt = SalleRTC.maintenant() }
	if relayer:
		for o in conns:
			if o != c and o.open: _envoieBrut(o, d, true)
	_fire()


func _parti(c: Dictionary) -> void:
	if not conns.has(c): return
	conns.erase(c)
	if c.slotLabel != "": others.erase(c.slotLabel)
	steam.closeSessionWithUser(c.id)
	_fire()


func _envoie(c: Dictionary, presence: Dictionary) -> void:
	_envoieBrut(c, { "from": label, "p": presence }, true)


## Les états de course (view, owned) partent sans garantie : le suivant remplace celui qui se perd.
## Tout le reste — présences, horloge, décompte, contacts, classement — part garanti.
func _envoieBrut(c: Dictionary, d: Dictionary, fiable: bool) -> void:
	var drapeaux := _constante("NETWORKING_SEND_RELIABLE", 8) if fiable else _constante("NETWORKING_SEND_UNRELIABLE_NO_DELAY", 5)
	steam.sendMessageToUser(c.id, BinaryPack.pack(d), drapeaux, CANAL)


func onMessage(h: Callable) -> void:
	_messageHandlers.append(h)


func onPeers(h: Callable) -> void:
	_peerHandlers.append(h)


func message(packet: Dictionary, target: String = "") -> void:
	var k = packet.get("kind")
	for c in conns:
		if not c.open or (target != "" and c.slotLabel != target): continue
		_envoieBrut(c, { "from": label, "message": packet }, not (k == "view" or k == "owned"))


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
	for h in _peerHandlers.duplicate(): h.call(p)


## Ouvrir l'invitation de Steam pour ce salon (le bouton « inviter un ami » du salon).
func invite() -> void:
	if steam != null and lobby != 0: steam.activateGameOverlayInviteDialog(lobby)


## Le code d'un salon où un ami nous invite (join_requested) : on le rejoint comme une table.
func codeDe(id: int) -> String:
	return String(steam.getLobbyData(id, "code")) if steam != null else ""
