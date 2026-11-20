## L'autoload Reseau : la table en ligne, gardée d'un écran à l'autre (app.net dans le jeu web).
##
## Il fait tourner la salle à chaque image, en menu comme en course : les messages WebRTC ne
## s'écoulent que si on les lit.
##
## Dans la version web, un banc d'essai peut piloter la table depuis la page : il pose des ordres
## dans `window.GRIP_ESSAI` (une liste), et lit l'état dans `window.gripEtat`. Rien ne se passe si
## la page ne définit pas `GRIP_ESSAI` — c'est le cas de toute page qui n'est pas un essai.
extends Node

var net := Net.new()
var autopilote := false        # le pilote automatique des bancs d'essai (PiloteAuto)
var _essai := false
var _depuis := 0.0


func _ready() -> void:
	net.onStart = func(cfg: Dictionary) -> void: App.demarreEnLigne(cfg)
	# La version Steam : Steam s'ouvre au démarrage, et l'invitation d'un ami mène à sa table.
	if SalleSteam.active() and SalleSteam.initialise():
		SalleSteam.singleton().join_requested.connect(func(lobby: int, _ami: int) -> void: _invite(lobby))
	if OS.has_feature("web"):
		# un booléen JavaScript revient en entier (0 ou 1)
		_essai = bool(JavaScriptBridge.eval("Array.isArray(window.GRIP_ESSAI)", true))


## Un ami nous invite dans son salon Steam : on quitte ce qu'on faisait et on s'assoit à sa table.
func _invite(lobby: int) -> void:
	var code := SalleSteam.new().codeDe(lobby)
	if code == "": return
	if net.state != "off": net.leave()
	App.enLigne = null
	App.aller("salon")
	await get_tree().process_frame
	if App.ecran is Salon: App.ecran.rejoins(code)


func _process(delta: float) -> void:
	net.poll(delta)
	if _essai:
		_depuis += delta
		if _depuis >= 0.2:
			_depuis = 0.0
			_banc()


func _banc() -> void:
	var j = JavaScriptBridge.eval("JSON.stringify(window.GRIP_ESSAI.splice(0))", true)
	var ordres = JSON.parse_string(j) if j is String else []
	for o in (ordres if ordres is Array else []):
		match String(o.get("op", "")):
			"open": net.open(String(o.get("name", "Godot")), bool(o.get("host", false)), String(o.get("code", "")), bool(o.get("spectator", false)))
			"mine": net.setMine(o.get("patch", {}))
			"table": net.setTable(o.get("patch", {}))
			"start": net.start()
			"leave": net.leave()
			"ecran": App.aller(String(o.get("nom", "accueil")), o.get("opts", {}))
			"auto": autopilote = bool(o.get("on", true))
			"nom": App.reglages.nom = String(o.get("nom", "Godot")); App.reglages.langue = String(o.get("langue", App.reglages.langue))
			"voiture": App.reglages.voiture = String(o.get("id", "porsche991gt3r")); App.reglages.livree = int(o.get("livree", 0))
	var etat := { ecran = App.ecran.get_class() if App.ecran else "", script = App.ecran.get_script().resource_path.get_file() if App.ecran and App.ecran.get_script() else "",
		state = net.state, code = net.code, error = net.error, busy = net.busy, creator = net.creator,
		seat = net.seat, settings = net.settings(), link = net.link.label() if net.link else "",
		members = net.members().map(func(m): return { pid = m.pid, name = m.name, ready = m.ready, car = m.car, isMe = m.isMe,
			protocol = m.q.get("protocol"), spectator = m.q.get("spectator", false) }) }
	if net.drive: etat.course = net.drive.resume()
	JavaScriptBridge.eval("window.gripEtat = %s" % JSON.stringify(etat), true)
