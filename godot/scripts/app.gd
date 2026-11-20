## L'application : les réglages du joueur (gardés d'une partie à l'autre), et le passage d'un écran à
## l'autre — accueil, paddock, course, résultats.
extends Node

const FICHIER := "user://grip.json"
var reglages := {
	nom = "", mode = "race", cat = "gt3", voiture = "porsche991gt3r", livree = 0,
	circuit = "spa", difficulte = "medium", tours = 3, vue = "avanceFixe", adversaires = 10,
	son = true, volume = 0.8, recul = 1.0, cote = "left", guide = false, nuit = false,
	langue = "",
}
var ecran: Node = null
var derniereCourse: Course = null      # pour l'écran des résultats
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
	if Catalogue.voiture(reglages.voiture).is_empty(): reglages.voiture = "porsche991gt3r"
	RenderingServer.set_default_clear_color(Color("#17171c"))
	get_tree().root.theme = Style.theme()
	aller.call_deferred("accueil")


## Le volume général : le bus Master de Godot.
func appliqueSon() -> void:
	var m := AudioServer.get_bus_index("Master")
	AudioServer.set_bus_mute(m, not reglages.son)
	AudioServer.set_bus_volume_db(m, linear_to_db(maxf(0.001, float(reglages.volume))))


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
