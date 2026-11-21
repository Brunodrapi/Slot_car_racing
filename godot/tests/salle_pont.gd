## Le pont de la version Steam (SallePont) : trois écrans Godot à la même table.
##   - l'hôte, version Steam : un salon Steam (faux) ET une table de l'annuaire PeerJS, même code ;
##   - un ami Steam, qui trouve le salon Steam par le code ;
##   - un joueur hors Steam (la même table que le jeu web), par WebRTC.
## Chacun doit voir les deux autres, puis une course avec l'IA finit avec le même classement partout.
##
##   npx peerjs --port 9000 --host 127.0.0.1 --key peerjs --path /     (un annuaire local)
##   GRIP_ANNUAIRE=ws://127.0.0.1:9000/ godot --headless --path godot --script res://tests/salle_pont.gd
extends SceneTree

const SS = preload("res://tests/salle_steam.gd")

var monde = SS.Monde.new()
var ecrans := []
var fini := false
var bilan := true
var t0 := 0


func _init() -> void:
	var fauxHote = SS.FauxSteam.new(monde, 76561190000000100)
	var fauxAmi = SS.FauxSteam.new(monde, 76561190000000101)
	for i in 3:
		var net := Net.new()
		match i:
			0: net.fabriqueSalle = func(): return SallePont.new(SalleSteam.new(fauxHote), SalleRTC.new())
			1: net.fabriqueSalle = func(): return SalleSteam.new(fauxAmi)
			2: net.fabriqueSalle = func(): return SalleRTC.new()
		var e := { net = net, course = null, nom = ["Hôte Steam", "Ami Steam", "Hors Steam"][i] }
		net.onStart = func(cfg: Dictionary) -> void: _depart(e, cfg)
		ecrans.append(e)
	_essai()


func _essai() -> void:
	var H: Net = ecrans[0].net
	var A: Net = ecrans[1].net
	var W: Net = ecrans[2].net
	var ok := await H.open("Hôte", true)
	print("table ouverte : ", ok, " code ", H.code, " « ", H.error, " » ; salon Steam ", (H.room as SallePont).steam.open)
	H.setTable({ trackId = "redbullring", laps = 1, mode = "race", difficulty = "medium", timeOfDay = "day" })
	var okA := await A.open("Ami", false, H.code)
	print("l'ami Steam la trouve : ", okA, " « ", A.error, " »")
	var okW := await W.open("Web", false, H.code)
	print("le joueur hors Steam la trouve : ", okW, " « ", W.error, " »")
	var debut := Time.get_ticks_msec()
	while (H.members().size() < 3 or A.members().size() < 3 or W.members().size() < 3) and Time.get_ticks_msec() - debut < 15000: await process_frame
	for e in ecrans: print("  ", e.nom, " voit : ", e.net.members().map(func(m): return m.name))
	bilan = bilan and ok and okA and okW and H.members().size() == 3 and A.members().size() == 3 and W.members().size() == 3
	H.setMine({ car = { modelId = "porsche991gt3r", livree = 0 }, ready = true })
	A.setMine({ car = { modelId = "bmwm6gt3", livree = 0 }, ready = true })
	W.setMine({ car = { modelId = "f40", livree = 0 }, ready = true })
	debut = Time.get_ticks_msec()
	while not H.canStart() and Time.get_ticks_msec() - debut < 15000: await process_frame
	for n in [A, W]:
		while n.link.ping(n.pid) == null and Time.get_ticks_msec() - debut < 15000: await process_frame
	print("  horloges : ", H.link.label(), " · ", A.link.label(), " · ", W.link.label())
	t0 = Time.get_ticks_msec()
	H.start()
	while ecrans.any(func(e): return e.course == null or e.course.results.is_empty()) and Time.get_ticks_msec() - t0 < 240000: await process_frame
	var cl := []
	for e in ecrans:
		var c: Course = e.course
		var r: Array = c.results.map(func(x): return "%d. %s %s" % [x.pos, x.car.nom, "%.3f" % x.temps if x.temps >= 0 else "NC"]) if c else []
		cl.append(r)
		print("  classement de ", e.nom, " : ", " · ".join(r))
	var meme: bool = cl[0].size() > 0 and cl[0] == cl[1] and cl[0] == cl[2]
	print("  même classement sur les trois écrans : ", meme, " ; %d s réelles" % ((Time.get_ticks_msec() - t0) / 1000))
	bilan = bilan and meme
	for e in ecrans: e.net.leave()
	print("PONT ", "OK" if bilan else "ÉCHEC")
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
