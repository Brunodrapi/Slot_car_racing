## La photo de l'accueil (l'affiche de SLOTLESS et les boutons), à la taille de la fenêtre.
##   xvfb-run -a godot --path godot --resolution 1280x720 tests/accueil_photo.tscn -- <photo.png>
extends Node


func _ready() -> void:
	await get_tree().create_timer(1.5).timeout
	var args := OS.get_cmdline_user_args()
	get_viewport().get_texture().get_image().save_png(args[0] if args.size() else "user://accueil.png")
	get_tree().quit()
