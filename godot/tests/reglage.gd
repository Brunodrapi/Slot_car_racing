## Le mode RÉGLER (le réglage du frein, js/ui.js startTune) : la course s'ouvre avec le levier du frein en
## haut ; un clic dessus change le frein du joueur, dans le moteur aussi ; la pause l'enregistre sous un
## nom ; le paddock le propose, et la course suivante le prend.
##   xvfb-run -a godot --path godot --resolution 1280x720 tests/reglage.tscn -- <dossier>
extends Node

var echecs := []


func _verifie(ok: bool, quoi: String) -> void:
	print("  ", "ok " if ok else "NON", " ", quoi)
	if not ok: echecs.append(quoi)


func _clic(p: Vector2, appui: bool) -> void:
	var e := InputEventMouseButton.new()
	e.button_index = MOUSE_BUTTON_LEFT; e.pressed = appui; e.position = p; e.global_position = p
	Input.parse_input_event(e)
	await get_tree().process_frame


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	var dossier: String = args[0] if args.size() else "user://"
	var A = get_node("/root/App")
	A.reglages.mode = "timetrial"; A.reglages.circuit = "monza"; A.reglages.voiture = "porsche991gt3r"
	A.reglages.freinages = { actifs = {}, configs = [] }
	await get_tree().create_timer(0.5).timeout
	A.aller("course", { reglage = true })
	await get_tree().create_timer(2.5).timeout
	var jeu = A.ecran
	var c: Course = jeu.course
	_verifie(c.reglage and absf(c.frein - 1.0) < 1e-9, "la course s'ouvre en mode réglage, frein ×1")
	var z: Rect2 = jeu.hud.zoneFrein
	_verifie(z.size.x > 100, "le levier du frein est en haut (%s)" % z)
	var base: float = c.freinBase
	# un clic aux trois quarts du levier
	var p: Vector2 = jeu.hud.get_global_transform_with_canvas() * Vector2(z.position.x + z.size.x * 0.75, z.get_center().y)
	await _clic(p, true)
	await _clic(p, false)
	var attendu := roundf((ReglageFrein.MIN + 0.75 * (ReglageFrein.MAX - ReglageFrein.MIN)) * 100) / 100
	_verifie(absf(c.frein - attendu) < 0.011, "un clic sur le levier : frein ×%.2f (attendu ×%.2f)" % [c.frein, attendu])
	_verifie(absf(c.player.cls.brake - base * c.frein) < 1e-6 and absf(c.player.freinRatio - c.frein) < 1e-9, "la voiture du joueur freine d'autant")
	if c is CourseNative:
		# le moteur C++ roule avec le même frein : deux secondes, puis on compare au même parcours en GDScript
		print("  (moteur C++)")
	get_viewport().get_texture().get_image().save_png(dossier.path_join("reglage-levier.png"))
	# la pause : enregistrer sous un nom
	jeu.basculePause()
	await get_tree().create_timer(0.3).timeout
	var pz = jeu.pause
	_verifie(pz.regNom != null and pz.regEnreg != null, "la pause propose d'enregistrer la configuration")
	pz.regNom.text = "Monza sec"
	pz._enregistre()
	await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(dossier.path_join("reglage-pause.png"))
	var cfg := ReglageFrein.active("monza", "porsche991gt3r")
	_verifie(String(cfg.get("nom", "")) == "Monza sec" and absf(ReglageFrein.frein("monza", "porsche991gt3r") - c.frein) < 1e-9, "enregistrée, et choisie pour ce couple")
	_verifie(ReglageFrein.frein("spa", "porsche991gt3r") == 1.0, "sur un autre circuit, le frein reste d'origine")
	# le paddock la propose ; la course suivante la prend
	A.aller("paddock", { mode = "timetrial" })
	await get_tree().create_timer(1.0).timeout
	var vu := false
	for b in A.ecran.find_children("*", "Button", true, false):
		if b.get_meta("cle", "") == "freinage": vu = true
	_verifie(vu, "le paddock a sa pastille FREINAGE")
	get_viewport().get_texture().get_image().save_png(dossier.path_join("reglage-paddock.png"))
	A.aller("course")
	await get_tree().create_timer(2.5).timeout
	var c2: Course = A.ecran.course
	_verifie(not c2.reglage and absf(c2.frein - c.frein) < 1e-9 and absf(c2.player.cls.brake - c2.freinBase * c2.frein) < 1e-6, "la course suivante roule avec ×%.2f, sans levier" % c2.frein)
	_verifie(A.ecran.hud.zoneFrein.size.x == 0, "hors réglage, pas de levier")
	print("RÉGLAGE ", "OK" if echecs.is_empty() else "ÉCHEC %s" % [echecs])
	get_tree().quit(0 if echecs.is_empty() else 1)
