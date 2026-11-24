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
	var rapide: Control = p.rapide
	var page: ScrollContainer = rapide.page
	var rail: ScrollContainer = rapide.rails.voitures
	var ecran := get_viewport().get_stretch_transform()
	page.scroll_vertical = int(page.get_v_scroll_bar().max_value)
	rail.scroll_horizontal = 0
	await get_tree().process_frame
	var centre := ecran * page.get_global_rect().intersection(rail.get_global_rect()).get_center()
	var x0 := rail.scroll_horizontal
	var y0 := page.scroll_vertical
	# 1. un glissé de côté sur le rail
	await _glisse(centre, centre + Vector2(-240, 6))
	await get_tree().create_timer(0.6).timeout
	_verifie(rail.scroll_horizontal > x0 + 60, "le rail a défilé (%d → %d)" % [x0, rail.scroll_horizontal])
	_verifie(app.reglages.voiture == "m1procar", "le glissé n'a pas choisi de voiture (%s)" % app.reglages.voiture)
	# 2. un glissé vertical fait défiler la page
	_verifie(page.scroll_vertical == y0, "le glissé du rail ne fait pas sauter la page")
	page.scroll_vertical = 0
	await get_tree().process_frame
	var origine := ecran * (page.get_global_rect().position + Vector2(50, 235))
	await _glisse(origine, origine + Vector2(5, -180))
	await get_tree().create_timer(0.3).timeout
	_verifie(page.scroll_vertical > 0, "la page a défilé (0 → %d)" % page.scroll_vertical)
	_verifie(app.reglages.voiture == "m1procar", "le glissé de la page n'a rien choisi")
	# 3. un appui bref sur une carte du rail la choisit
	page.scroll_vertical = int(page.get_v_scroll_bar().max_value)
	await get_tree().process_frame
	var carte: Control = null
	var visible := page.get_global_rect().intersection(rail.get_global_rect())
	for b in rail.get_child(0).get_children():
		if b.get_meta("voiture").id != "m1procar" and visible.encloses(b.get_global_rect()): carte = b
	_verifie(carte != null, "une autre carte est à l'écran")
	if carte:
		var id: String = carte.get_meta("voiture").id
		var c := ecran * carte.get_global_rect().get_center()
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
