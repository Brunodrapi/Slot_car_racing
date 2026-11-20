## Le compteur à plus de 200 km/h, et les voitures de près : une course démarre, la voiture du joueur
## est tenue à 73 m/s (263 km/h) le temps d'une photo, puis une photo de la grille au départ.
##
##   xvfb-run -a -s "-screen 0 1280x720x24" godot --path godot res://tests/hud_vitesse.tscn -- <dossier>
extends Node

var dossier := "user://"
var n := 0


func _ready() -> void:
	# après le pas de la course : la vitesse posée ici est celle que le tableau de bord dessine
	process_physics_priority = 1000
	var a := OS.get_cmdline_user_args()
	if a.size() > 0: dossier = a[0]
	App.reglages.circuit = "spa"; App.reglages.voiture = "porsche991gt3r"; App.reglages.mode = "race"
	App.reglages.nuit = false; App.reglages.adversaires = 8
	App.reglages.natif = false        # la course en GDScript : on peut y tenir la vitesse de la voiture
	App.aller.call_deferred("course")


func _photo(nom: String) -> void:
	get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dossier, nom])
	print("photo ", nom)


func _physics_process(_dt: float) -> void:
	var jeu = App.ecran
	if not (jeu is Node2D) or jeu.course == null: return
	n += 1
	if n == 30: _photo("1-grille")
	if n > 40 and jeu.course.state != "countdown":
		jeu.course.player.v = 73.0
	if n == 600: print("état ", jeu.course.state, " v ", jeu.course.player.v, " vitesse ", jeu.course.player.speed()); _photo("2-compteur"); get_tree().quit()
