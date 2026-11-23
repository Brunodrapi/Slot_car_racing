## L'affichage de la version de bureau (App.appliqueAffichage) : plein écran par défaut, à la taille de
## l'écran ; en fenêtre, la taille choisie ; F11 bascule et le jeu s'en souvient. Puis la photo des réglages.
##   xvfb-run -a -s "-screen 0 1920x1080x24" godot --path godot tests/affichage.tscn -- <dossier>
extends Node

var echecs := []


func _verifie(ok: bool, quoi: String) -> void:
	print("  ", "ok " if ok else "NON", " ", quoi)
	if not ok: echecs.append(quoi)


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	var dossier: String = args[0] if args.size() else "user://"
	var A = get_node("/root/App")
	var e: Vector2i = App.resolutionEcran()
	print("écran ", e)
	await get_tree().create_timer(0.5).timeout
	A.reglages.affichage = "plein"; A.reglages.resolution = ""
	A.appliqueAffichage()
	await get_tree().create_timer(1.5).timeout
	_verifie(DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN, "par défaut, le plein écran")
	_verifie(DisplayServer.window_get_size() == e, "à la résolution de l'écran (%s)" % DisplayServer.window_get_size())
	_verifie(App.resolutions().has("1600x900") and not App.resolutions().has("%dx%d" % [e.x, e.y]), "les tailles proposées sont plus petites que l'écran : %s" % [App.resolutions()])
	A.reglages.affichage = "fenetre"; A.reglages.resolution = "1280x720"
	A.appliqueAffichage()
	await get_tree().create_timer(0.8).timeout
	_verifie(DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_WINDOWED, "en fenêtre")
	_verifie(DisplayServer.window_get_size() == Vector2i(1280, 720), "de 1280 × 720 (%s)" % DisplayServer.window_get_size())
	A.basculeAffichage()
	await get_tree().create_timer(0.5).timeout
	_verifie(A.reglages.affichage == "plein" and DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN, "F11 : le plein écran revient, et le jeu s'en souvient")
	A.aller("reglages")
	await get_tree().create_timer(1.0).timeout
	get_viewport().get_texture().get_image().save_png(dossier.path_join("reglages.png"))
	print("AFFICHAGE ", "OK" if echecs.is_empty() else "ÉCHEC %s" % [echecs])
	get_tree().quit(0 if echecs.is_empty() else 1)
