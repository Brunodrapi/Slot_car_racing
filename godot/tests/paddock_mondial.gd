## Photo du paddock avec le record du monde (avec outils/faux-supabase.js, ou le vrai tableau) :
##   GRIP_MONDIAL_URL=http://127.0.0.1:54321 xvfb-run -a godot --path godot tests/paddock_mondial.tscn -- <photo.png>
extends Node


func _ready() -> void:
	var A = get_node("/root/App")
	A.reglages.circuit = "spa"
	A.reglages.voiture = "porsche991gt3r"
	A.reglages.cat = "gt3"
	await get_tree().create_timer(1.0).timeout
	A.aller("paddock", { mode = "timetrial" })
	await get_tree().create_timer(4.0).timeout
	var args := OS.get_cmdline_user_args()
	get_viewport().get_texture().get_image().save_png(args[0] if args.size() else "user://paddock.png")
	get_tree().quit()
