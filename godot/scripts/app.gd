## L'application : les réglages du joueur (gardés d'une partie à l'autre), et le passage d'un écran à
## l'autre — accueil, paddock, course, résultats.
extends Node

const FICHIER := "user://grip.json"
var reglages := {
	nom = "Pilote", mode = "race", cat = "gt3", voiture = "porsche991gt3r", livree = 0,
	circuit = "spa", difficulte = "medium", tours = 3, vue = "avanceFixe", adversaires = 10,
}
var ecran: Node = null
var derniereCourse: Course = null      # pour l'écran des résultats


func _ready() -> void:
	Catalogue.charge()
	if FileAccess.file_exists(FICHIER):
		var lu = JSON.parse_string(FileAccess.get_file_as_string(FICHIER))
		if lu is Dictionary:
			for k in lu: reglages[k] = lu[k]
	# Le JSON rend des nombres décimaux : les réglages entiers redeviennent entiers.
	for k in ["livree", "tours", "adversaires"]: reglages[k] = int(reglages[k])
	if Catalogue.voiture(reglages.voiture).is_empty(): reglages.voiture = "porsche991gt3r"
	RenderingServer.set_default_clear_color(Color("#17171c"))
	get_tree().root.theme = Style.theme()
	aller.call_deferred("accueil")


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
	get_tree().root.add_child.call_deferred(ecran)
