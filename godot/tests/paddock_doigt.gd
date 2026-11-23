## Le paddock au doigt, au téléphone : un glissé de côté sur le rail des voitures le fait défiler sans
## choisir de voiture ; un glissé vertical fait défiler la page ; un appui bref choisit la voiture.
##   xvfb-run -a godot --path godot --resolution 780x1688 tests/paddock_doigt.tscn
extends Node

## Le numéro du doigt : Safari sur iPhone ne commence pas à 0 (la version web de Godot donne son numéro).
const DOIGT := 37

var app: Node
var echecs := 0


func _ready() -> void:
	get_tree().create_timer(30.0).timeout.connect(func(): print("ÉCHEC : trop long"); get_tree().quit(1))
	app = get_node("/root/App")
	await get_tree().create_timer(0.4).timeout
	app.reglages.voiture = "m1procar"
	app.reglages.circuit = "zandvoort"
	app.reglages.cat = "tous"
	app.aller("paddock", { mode = "race" })
	await get_tree().create_timer(0.6).timeout
	var p: Control = app.ecran
	_verifie(p.portrait, "la page est en portrait")
	var rail: Control = p.rails.voitures.vue
	var t := rail.get_global_transform()
	var centre := t.origin + rail.size * t.get_scale() / 2
	var x0: float = p.railX.voitures
	# 1. un glissé de côté sur le rail
	await _glisse(centre, centre + Vector2(-240, 6))
	await get_tree().create_timer(0.6).timeout
	_verifie(float(p.railX.voitures) > x0 + 60, "le rail a défilé (%.0f → %.0f)" % [x0, p.railX.voitures])
	_verifie(app.reglages.voiture == "m1procar", "le glissé n'a pas choisi de voiture (%s)" % app.reglages.voiture)
	# 2. un glissé vertical fait défiler la page
	_verifie(float(p.defile) == 0.0, "toucher une carte ne fait pas sauter la page (%.0f)" % p.defile)
	var y0: float = p.defile
	await _glisse(Vector2(200, 900), Vector2(205, 500))
	await get_tree().create_timer(0.3).timeout
	_verifie(float(p.defile) > y0 + 150, "la page a défilé (%.0f → %.0f)" % [y0, p.defile])
	_verifie(app.reglages.voiture == "m1procar", "le glissé de la page n'a rien choisi")
	# 3. un appui bref sur une carte du rail la choisit
	p = app.ecran
	var carte: Control = null
	for b in (p.rails.voitures.contenu as Control).get_children():
		var r := Rect2(b.get_global_transform().origin, b.size * b.get_global_transform().get_scale())
		if b.get_meta("voiture").id != "m1procar" and get_viewport().get_visible_rect().encloses(r): carte = b
	_verifie(carte != null, "une autre carte est à l'écran")
	if carte:
		var id: String = carte.get_meta("voiture").id
		var c := carte.get_global_transform().origin + carte.size * carte.get_global_transform().get_scale() / 2
		await _appui(c)
		await get_tree().create_timer(0.3).timeout
		_verifie(app.reglages.voiture == id, "l'appui a choisi %s (%s)" % [id, app.reglages.voiture])
	print("ÉCHECS : %d" % echecs if echecs else "TOUT EST BON")
	get_tree().quit(1 if echecs else 0)


func _verifie(ok: bool, quoi: String) -> void:
	print(("ok      " if ok else "ÉCHEC   ") + quoi)
	if not ok: echecs += 1


func _touche(pos: Vector2, appuye: bool) -> void:
	var e := InputEventScreenTouch.new()
	e.index = DOIGT
	e.position = pos
	e.pressed = appuye
	Input.parse_input_event(e)


func _glisse(a: Vector2, b: Vector2) -> void:
	_touche(a, true)
	await get_tree().process_frame
	var n := 12
	var avant := a
	for i in range(1, n + 1):
		var p := a.lerp(b, float(i) / n)
		var e := InputEventScreenDrag.new()
		e.index = DOIGT
		e.position = p
		e.relative = p - avant
		avant = p
		Input.parse_input_event(e)
		await get_tree().process_frame
	_touche(b, false)
	await get_tree().process_frame


func _appui(c: Vector2) -> void:
	_touche(c, true)
	await get_tree().process_frame
	await get_tree().process_frame
	_touche(c, false)
	await get_tree().process_frame
