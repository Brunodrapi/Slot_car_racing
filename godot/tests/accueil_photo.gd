## La photo de l'écran titre (l'affiche de GRIP, « Appuie pour commencer »), à la taille de la
## fenêtre ; GRIP_ECRAN=accueil : celle du menu.
##   xvfb-run -a godot --path godot --resolution 1280x720 tests/accueil_photo.tscn -- <photo.png>
extends Node


func _ready() -> void:
	await get_tree().create_timer(0.6).timeout
	if OS.get_environment("GRIP_ECRAN") != "": get_node("/root/App").aller(OS.get_environment("GRIP_ECRAN"))
	await get_tree().create_timer(1.0).timeout
	var args := OS.get_cmdline_user_args()
	get_viewport().get_texture().get_image().save_png(args[0] if args.size() else "user://accueil.png")
	get_tree().quit()
