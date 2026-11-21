## L'application : les réglages du joueur (gardés d'une partie à l'autre), et le passage d'un écran à
## l'autre — accueil, paddock, course, résultats.
extends Node

const FICHIER := "user://grip.json"
var reglages := {
	nom = "", mode = "race", cat = "gt3", voiture = "porsche991gt3r", livree = 0,
	circuit = "spa", difficulte = "medium", tours = 3, vue = "avanceFixe", adversaires = 10,
	son = true, volume = 0.8, recul = 1.0, cote = "left", guide = false, nuit = false,
	langue = "",
	# l'affichage de la version de bureau : "plein" (plein écran) ou "fenetre", et la taille de la
	# fenêtre, "" pour celle de l'écran
	affichage = "plein", resolution = "",
}
var ecran: Node = null
var derniereCourse: Course = null      # pour l'écran des résultats
var dernierTrophee := {}               # ce que la dernière course a rapporté au palmarès (Palmares.attribue)
var enLigne = null                     # la course de la table en ligne (Net.onStart), ou null


func _ready() -> void:
	Catalogue.charge()
	if FileAccess.file_exists(FICHIER):
		var lu = JSON.parse_string(FileAccess.get_file_as_string(FICHIER))
		if lu is Dictionary:
			for k in lu: reglages[k] = lu[k]
	# La langue : celle de l'appareil au premier lancement, le français ou l'anglais.
	if reglages.langue == "": reglages.langue = "fr" if OS.get_locale_language() == "fr" else "en"
	if reglages.nom == "": reglages.nom = "Pilote" if reglages.langue == "fr" else "Driver"
	# Le JSON rend des nombres décimaux : les réglages entiers redeviennent entiers.
	for k in ["livree", "tours", "adversaires"]: reglages[k] = int(reglages[k])
	appliqueSon()
	appliqueAffichage()
	if Catalogue.voiture(reglages.voiture).is_empty(): reglages.voiture = "porsche991gt3r"
	RenderingServer.set_default_clear_color(Color("#17171c"))
	get_tree().root.theme = Style.theme()
	aller.call_deferred("accueil")


## Le volume général : le bus Master de Godot.
func appliqueSon() -> void:
	var m := AudioServer.get_bus_index("Master")
	AudioServer.set_bus_mute(m, not reglages.son)
	AudioServer.set_bus_volume_db(m, linear_to_db(maxf(0.001, float(reglages.volume))))


## L'AFFICHAGE DE LA VERSION DE BUREAU. Par défaut, le plein écran, à la résolution de l'écran où
## s'ouvre le jeu ; en fenêtre, la taille choisie (« écran » : la plus grande qui y tient, la fenêtre
## agrandie). Le plein écran garde toujours la résolution de l'écran : c'est la plus nette, et Godot
## ne change pas le mode de l'écran.
static func bureau() -> bool:
	return not OS.has_feature("web") and not OS.has_feature("mobile")


## La résolution de l'écran où est la fenêtre.
static func resolutionEcran() -> Vector2i:
	return DisplayServer.screen_get_size(DisplayServer.window_get_current_screen())


## Les tailles de fenêtre proposées : l'écran entier (""), puis les tailles courantes plus petites.
static func resolutions() -> Array:
	var e := resolutionEcran()
	var liste := [""]
	for r in [Vector2i(3840, 2160), Vector2i(2560, 1440), Vector2i(1920, 1200), Vector2i(1920, 1080), Vector2i(1680, 1050),
			Vector2i(1600, 900), Vector2i(1440, 900), Vector2i(1366, 768), Vector2i(1280, 720)]:
		if r.x < e.x and r.y < e.y: liste.append("%dx%d" % [r.x, r.y])
	return liste


func appliqueAffichage() -> void:
	if not bureau() or DisplayServer.get_name() == "headless": return
	# une taille imposée au lancement (les essais : --resolution, --windowed) passe avant
	var args := OS.get_cmdline_args()
	if args.has("--resolution") or args.has("--windowed") or args.has("-w"): return
	if reglages.affichage != "fenetre":
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
		return
	var ecran := DisplayServer.window_get_current_screen()
	var utile := DisplayServer.screen_get_usable_rect(ecran)
	var t := String(reglages.resolution).split("x")
	if t.size() != 2 or not resolutions().has(reglages.resolution):
		# l'écran : la fenêtre agrandie, à la taille de ce qu'il reste à côté de la barre des tâches
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_MAXIMIZED)
		return
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
	var taille := Vector2i(int(t[0]), int(t[1]))
	taille = Vector2i(mini(taille.x, utile.size.x), mini(taille.y, utile.size.y))
	DisplayServer.window_set_size(taille)
	DisplayServer.window_set_position(utile.position + (utile.size - taille) / 2)


## F11 en course, ou la ligne des réglages : l'un ou l'autre, et le jeu s'en souvient.
func basculeAffichage() -> void:
	reglages.affichage = "fenetre" if reglages.affichage != "fenetre" else "plein"
	sauve()
	appliqueAffichage()


func sauve() -> void:
	var f := FileAccess.open(FICHIER, FileAccess.WRITE)
	if f: f.store_string(JSON.stringify(reglages))


## Change d'écran. `nom` : accueil, paddock, course, resultats.
func aller(nom: String, opts: Dictionary = {}) -> void:
	if ecran:
		ecran.queue_free()
	match nom:
		"accueil": ecran = Accueil.new()
		"paddock": ecran = Paddock.new(opts.get("mode", reglages.mode))
		"course": ecran = load("res://scenes/course.tscn").instantiate()
		"resultats": ecran = Resultats.new(derniereCourse)
		"reglages": ecran = Reglages.new()
		"comment": ecran = CommentJouer.new()
		"salon": ecran = Salon.new()
	get_tree().root.add_child.call_deferred(ecran)


## L'hôte a donné le départ : tous les écrans de la table partent en course en même temps.
func demarreEnLigne(cfg: Dictionary) -> void:
	if Catalogue.circuits().filter(func(c): return c.id == cfg.trackId).is_empty():
		# un circuit que cette version n'a pas (un circuit perso du jeu web) : on reste au salon
		Reseau.net.error = "table introuvable"
		Reseau.net.backToLobby()
		return
	enLigne = cfg
	aller("course")


## Après le drapeau, ou en quittant une course en ligne : la table reste ouverte.
func retourTable() -> void:
	enLigne = null
	Reseau.net.backToLobby()
	aller("salon")
