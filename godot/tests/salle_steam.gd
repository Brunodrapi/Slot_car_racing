## La version Steam sans Steam : deux écrans Godot, un faux Steam qui tient les salons et porte les
## messages, et une course entière entre les deux — l'hôte ouvre un salon, l'invité le trouve par
## son code, puis duel et course avec l'IA, pilotes automatiques. Les deux doivent finir avec le
## même classement.
##
## Ce qui est vérifié : SalleSteam (salons, sessions, messages), Net, NetLink, NetDrive et la course
## en ligne de Godot contre Godot. Ce qui ne l'est pas : le vrai Steam, qui demande le client Steam,
## un compte, et l'extension GodotSteam.
##
##   godot --headless --path godot --script res://tests/salle_steam.gd
extends SceneTree


## Le monde du faux Steam : les salons et les boîtes aux lettres.
class Monde:
	var lobbies := {}
	var boites := {}
	var faux := {}
	var suivant := 109775240000000000


class FauxSteam:
	extends RefCounted
	signal lobby_created(connect: int, lobby_id: int)
	signal lobby_joined(lobby: int, permissions: int, locked: bool, response: int)
	signal lobby_match_list(lobbies: Array)
	signal lobby_chat_update(lobby_id: int, changed_id: int, making_change_id: int, chat_state: int)
	signal network_messages_session_request(remote_steam_id: int)
	var monde: Monde
	var id := 0
	var filtres := {}
	var sessions := {}
	var envoyes := 0

	func _init(m: Monde, i: int) -> void:
		monde = m; id = i; m.faux[i] = self; m.boites[i] = []

	func getSteamID() -> int: return id
	func createLobby(_type: int, _max: int) -> void:
		monde.suivant += 1
		monde.lobbies[monde.suivant] = { owner = id, data = {}, membres = [id] }
		lobby_created.emit.call_deferred(1, monde.suivant)
	func setLobbyData(l: int, k: String, v: String) -> bool: monde.lobbies[l].data[k] = v; return true
	func getLobbyData(l: int, k: String) -> String: return monde.lobbies[l].data.get(k, "")
	func setLobbyJoinable(_l: int, _j: bool) -> bool: return true
	func addRequestLobbyListStringFilter(k: String, v: String, _c: int) -> void: filtres[k] = v
	func addRequestLobbyListDistanceFilter(_d: int) -> void: pass
	func requestLobbyList() -> void:
		var l := []
		for i in monde.lobbies:
			var ok := true
			for k in filtres: if monde.lobbies[i].data.get(k) != filtres[k]: ok = false
			if ok: l.append(i)
		filtres = {}
		lobby_match_list.emit.call_deferred(l)
	func joinLobby(l: int) -> void:
		monde.lobbies[l].membres.append(id)
		for m in monde.lobbies[l].membres: monde.faux[m].lobby_chat_update.emit.call_deferred(l, id, id, 1)
		lobby_joined.emit.call_deferred(l, 0, false, 1)
	func leaveLobby(l: int) -> void:
		if not monde.lobbies.has(l): return
		monde.lobbies[l].membres.erase(id)
		for m in monde.lobbies[l].membres: monde.faux[m].lobby_chat_update.emit.call_deferred(l, id, id, 2)
		if monde.lobbies[l].owner == id: monde.lobbies.erase(l)
	func getLobbyOwner(l: int) -> int: return monde.lobbies[l].owner
	func acceptSessionWithUser(u: int) -> bool: sessions[u] = true; return true
	func closeSessionWithUser(u: int) -> bool: sessions.erase(u); return true
	func activateGameOverlayInviteDialog(_l: int) -> void: pass
	func sendMessageToUser(u: int, data: PackedByteArray, _flags: int, _canal: int) -> int:
		var autre: FauxSteam = monde.faux[u]
		if not autre.sessions.has(id): autre.network_messages_session_request.emit(id)
		monde.boites[u].append({ payload = data, identity = id })
		envoyes += data.size()
		return 1
	func receiveMessagesOnChannel(_canal: int, n: int) -> Array:
		var b: Array = monde.boites[id]
		var l := b.slice(0, n)
		monde.boites[id] = b.slice(n)
		return l


var monde := Monde.new()
var ecrans := []
var etape := "salon"
var fini := false
var formats := ["duel", "race"]
var t0 := 0
var bilan := true


func _init() -> void:
	for i in 2:
		var faux := FauxSteam.new(monde, 76561190000000000 + i)
		var net := Net.new()
		net.fabriqueSalle = func(): return SalleSteam.new(faux)
		var e := { net = net, faux = faux, course = null, nom = ["Hôte", "Invité"][i] }
		net.onStart = func(cfg: Dictionary) -> void: _depart(e, cfg)
		ecrans.append(e)
	_essai()


func _essai() -> void:
	var A: Net = ecrans[0].net
	var B: Net = ecrans[1].net
	for format in formats:
		var ok := await A.open("Hôte", true)
		print("salon Steam ouvert : ", ok, " code ", A.code, " « ", A.error, " »")
		A.setTable({ trackId = "redbullring", laps = 1, mode = format, difficulty = "medium", timeOfDay = "day" })
		var ok2 := await B.open("Invité", false, A.code)
		print("l'invité le trouve par son code : ", ok2, " « ", B.error, " »")
		while A.members().size() < 2 or B.members().size() < 2: await process_frame
		print("  membres vus par l'hôte : ", A.members().map(func(m): return m.name), " ; par l'invité : ", B.members().map(func(m): return m.name))
		A.setMine({ car = { modelId = "porsche991gt3r", livree = 0 }, ready = true })
		B.setMine({ car = { modelId = "bmwm6gt3", livree = 0 }, ready = true })
		while not A.canStart(): await process_frame
		var debut := Time.get_ticks_msec()
		while B.link.ping(B.pid) == null and Time.get_ticks_msec() - debut < 5000: await process_frame
		print("  horloge : ", A.link.label(), " · ", B.link.label())
		t0 = Time.get_ticks_msec()
		A.start()
		while ecrans.any(func(e): return e.course == null or e.course.results.is_empty()): await process_frame
		var ra: Array = ecrans[0].course.results.map(func(r): return "%d. %s %s" % [r.pos, r.car.nom, "%.3f" % r.temps if r.temps >= 0 else "NC"])
		var rb: Array = ecrans[1].course.results.map(func(r): return "%d. %s %s" % [r.pos, r.car.nom, "%.3f" % r.temps if r.temps >= 0 else "NC"])
		print("  %s, %d s réelles" % [format, (Time.get_ticks_msec() - t0) / 1000])
		print("  classement de l'hôte  : ", " · ".join(ra))
		print("  classement de l'invité : ", " · ".join(rb))
		var meme: bool = ra == rb
		print("  même classement : ", meme, " ; octets envoyés par l'hôte ", ecrans[0].faux.envoyes, ", par l'invité ", ecrans[1].faux.envoyes)
		bilan = bilan and meme and ok and ok2
		for e in ecrans:
			e.course = null
			e.net.leave()
		await process_frame
	var refus := await B.open("Seul", false, "QQQQ")
	print("code inconnu : ", refus, " « ", B.error, " »")
	bilan = bilan and not refus and B.error == "table introuvable"
	print("STEAM (FAUX) ", "OK" if bilan else "ÉCHEC")
	fini = true


func _depart(e: Dictionary, cfg: Dictionary) -> void:
	var piste := Piste.charge("res://donnees/circuits/" + String(cfg.trackId))
	e.course = CourseEnLigne.cree(piste, cfg, CourseEnLigne.voitureDe(cfg, "porsche991gt3r"), e.net)


func _process(delta: float) -> bool:
	for e in ecrans: e.net.poll(delta)
	return fini


func _physics_process(_delta: float) -> bool:
	for e in ecrans:
		var c: Course = e.course
		if c == null or c.netDrive == null: continue
		var net: Net = e.net
		if c.state == "countdown":
			net.setCharge(net.isHost() or net.link.ping(net.pid) != null)
			c.attente = net.attendus().reste > 0 if net.isHost() else false
		else: c.attente = false
		c.netDrive.beforeFrame(c.dt)
		var gaz := 1.0 if PiloteAuto.gaz(c.player) else 0.0
		c.player.sel = 0
		c.step(gaz)
		if net.isHost(): c.broadcast.sample(c)
		c.netDrive.afterFrame(gaz, 0)
	return fini
