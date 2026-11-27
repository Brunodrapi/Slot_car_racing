## L'écran titre au téléphone, photographié à deux instants du clignotement (allumé, puis éteint à moitié).
##   GRIP_TACTILE=1 xvfb-run -a godot --path godot --resolution 1170x1992 res://tests/titre_clignote.tscn -- <dossier>
extends Node


func _ready() -> void:
	var d: String = OS.get_cmdline_user_args()[0] if OS.get_cmdline_user_args().size() else "user://"
	await get_tree().create_timer(1.5).timeout
	# attendre le début d'une période allumée du clignotement (1,2 s)
	while fmod(Time.get_ticks_msec() / 1000.0, 1.2) > 0.1: await get_tree().process_frame
	await get_tree().create_timer(0.2).timeout
	get_viewport().get_texture().get_image().save_png(d + "/titre-allume.png")
	get_tree().quit()
