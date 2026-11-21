## Les menus cliquent (App.clic) : de vrais clics de souris sur les boutons de l'accueil, des réglages et
## du paddock ; un clic par bouton pris, et un son qui n'est pas muet.
##   xvfb-run -a godot --path godot --resolution 1280x720 tests/clics.tscn
extends Node

var echecs := []


func _verifie(ok: bool, quoi: String) -> void:
	print("  ", "ok " if ok else "NON", " ", quoi)
	if not ok: echecs.append(quoi)


func _boutons() -> Array:
	var A = get_node("/root/App")
	return A.ecran.find_children("*", "Button", true, false).filter(func(b): return b is Bouton and b.is_visible_in_tree() and not b.disabled)


func _clique(b: Bouton) -> void:
	var p := b.get_global_rect().get_center()
	# le cadre du paddock est mis à l'échelle : la position à l'écran passe par la transformation du canevas
	p = b.get_global_transform_with_canvas() * (b.size / 2)
	for appui in [true, false]:
		var e := InputEventMouseButton.new()
		e.button_index = MOUSE_BUTTON_LEFT; e.pressed = appui; e.position = p; e.global_position = p
		Input.parse_input_event(e)
		await get_tree().process_frame
	await get_tree().create_timer(0.3).timeout


func _ready() -> void:
	var A = get_node("/root/App")
	await get_tree().create_timer(1.0).timeout
	var son := Son._synthClic()
	var crete := 0
	for i in range(0, son.data.size() - 1, 2): crete = maxi(crete, absi(son.data.decode_s16(i)))
	_verifie(crete > 3000 and son.data.size() < 44100 * 2 * 0.06, "le clic : un son bref (%d ms) et audible (crête %d)" % [son.data.size() / 88.2, crete])
	for ecran in ["accueil", "reglages", "paddock"]:
		A.aller(ecran)
		await get_tree().create_timer(0.8).timeout
		var bs := _boutons()
		# un bouton qui ne change pas d'écran : le dernier de l'accueil change d'écran, on prend celui du son ou une voiture
		var b: Bouton = bs[1] if bs.size() > 1 else bs[0]
		var avant: int = A.clics
		var nom: String = b.get_meta("texte", "")
		await _clique(b)
		_verifie(A.clics == avant + 1, "%s : un clic de souris sur « %s », un clic (%d)" % [ecran, nom, A.clics - avant])
	print("CLICS ", "OK" if echecs.is_empty() else "ÉCHEC %s" % [echecs])
	get_tree().quit(0 if echecs.is_empty() else 1)
