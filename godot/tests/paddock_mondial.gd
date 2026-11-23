## Photo du paddock avec le record du monde (avec outils/faux-supabase.js, ou le vrai tableau) :
##   GRIP_MONDIAL_URL=http://127.0.0.1:54321 xvfb-run -a godot --path godot tests/paddock_mondial.tscn -- <photo.png>
extends Node


func _ready() -> void:
	var A = get_node("/root/App")
	A.reglages.circuit = "spa"
	A.reglages.voiture = "porsche991gt3r"
	A.reglages.cat = "gt3"
	await get_tree().create_timer(1.0).timeout
	var mode := "race" if OS.get_environment("GRIP_PADDOCK") == "race" else "timetrial"
	if mode == "race": A.reglages.palmares = { "spa|porsche991gt3r": 2, "spa|amggt3": 4, "spa|audir8lms": 0 }
	else: A.reglages.records = { "spa/porsche991gt3r": 143.512, "spa/bmwm6gt3": 146.07 }
	A.aller("paddock", { mode = mode })
	await get_tree().create_timer(4.0).timeout
	# GRIP_DEFILE : faire défiler la page (la liste de la catégorie, sous le circuit)
	var d := OS.get_environment("GRIP_DEFILE")
	if d != "":
		for n in get_tree().root.find_children("*", "", true, false):
			if n is Paddock: n._defile(float(d))
		await get_tree().create_timer(0.5).timeout
	var args := OS.get_cmdline_user_args()
	get_viewport().get_texture().get_image().save_png(args[0] if args.size() else "user://paddock.png")
	get_tree().quit()
