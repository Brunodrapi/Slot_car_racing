## Le départ au clavier : la touche ESPACE au lieu des consignes (hud.gd, _toucheEspace), beige au
## repos, verte avec un V quand on tient Espace ; deux photos.
##   xvfb-run -a godot --path godot --resolution 1280x720 tests/espace.tscn -- <dossier>
extends Node

var echecs := []


func _verifie(ok: bool, quoi: String) -> void:
	print("  ", "ok " if ok else "NON", " ", quoi)
	if not ok: echecs.append(quoi)


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	var dossier: String = args[0] if args.size() else "user://"
	var A = get_node("/root/App")
	A.reglages.mode = "timetrial"; A.reglages.circuit = "monza"
	await get_tree().create_timer(0.5).timeout
	A.aller("course")
	await get_tree().create_timer(2.0).timeout
	var jeu = A.ecran
	jeu.course.countdown = 3.0
	jeu.set("enPause", false)
	var hud = jeu.hud
	await get_tree().create_timer(0.3).timeout
	jeu.course.countdown = 3.0
	await get_tree().process_frame
	_verifie(jeu.course.state == "countdown" and not hud.toucheEspaceVue, "au départ, la touche est beige")
	get_viewport().get_texture().get_image().get_region(Rect2i(440, 80, 400, 180)).save_png(dossier.path_join("espace-repos.png"))
	Input.action_press("gaz")
	jeu.course.countdown = 3.0
	await get_tree().create_timer(0.2).timeout
	jeu.course.countdown = 3.0
	await get_tree().process_frame
	await get_tree().process_frame
	_verifie(hud.toucheEspaceVue, "Espace tenu, elle devient verte, avec le V")
	get_viewport().get_texture().get_image().get_region(Rect2i(440, 80, 400, 180)).save_png(dossier.path_join("espace-appui.png"))
	Input.action_release("gaz")
	print("ESPACE ", "OK" if echecs.is_empty() else "ÉCHEC %s" % [echecs])
	get_tree().quit(0 if echecs.is_empty() else 1)
