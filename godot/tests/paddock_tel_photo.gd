## La page entière du paddock au téléphone, pour la comparer à celle du jeu web : la fenêtre prend la
## hauteur de la page, « En piste ! » reste en bas. Howitzer K1 sur Windmolen, comme le jeu web.
##   xvfb-run -a -s "-screen 0 1200x8000x24" godot --path godot --resolution 1170x2532 tests/paddock_tel_photo.tscn -- <photo.png> [mode]
extends Node


func _ready() -> void:
	get_tree().create_timer(20.0).timeout.connect(func(): get_tree().quit(1))
	var args := OS.get_cmdline_user_args()
	var app := get_node("/root/App")
	await get_tree().create_timer(0.4).timeout
	app.reglages.voiture = OS.get_environment("GRIP_VOITURE") if OS.get_environment("GRIP_VOITURE") != "" else "m1procar"
	app.reglages.circuit = OS.get_environment("GRIP_CIRCUIT") if OS.get_environment("GRIP_CIRCUIT") != "" else "zandvoort"
	app.reglages.livree = 0
	app.reglages.cat = "tous"
	app.reglages.tours = 5
	app.reglages.nuit = OS.get_environment("GRIP_NUIT") == "1"
	app.reglages.difficulte = "medium"
	app.aller("paddock", { mode = args[1] if args.size() > 1 else "race" })
	await get_tree().create_timer(0.8).timeout
	var ecran: Control = app.ecran
	var w := get_window()
	var k := float(w.size.x) / 390.0
	w.size = Vector2i(w.size.x, int(ceil(float(ecran.get("hauteur")) * k)))
	await get_tree().create_timer(0.8).timeout
	get_viewport().gui_release_focus()
	await get_tree().process_frame
	await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(args[0] if args.size() else "user://paddock-tel.png")
	get_tree().quit()
