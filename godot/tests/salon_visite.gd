## Le salon photographié : l'entrée, puis une table ouverte dans un annuaire PeerJS local.
##
##   GRIP_ANNUAIRE=ws://127.0.0.1:9000/ xvfb-run -a -s "-screen 0 1280x720x24" godot --path godot res://tests/salon_visite.tscn -- <dossier> [fr|en]
extends Node

var dossier := "user://"
var n := 0
var etape := 0


func _ready() -> void:
	var a := OS.get_cmdline_user_args()
	if a.size() > 0: dossier = a[0]
	if a.size() > 1: App.reglages.langue = a[1]
	App.reglages.nom = "Bruno"


func _photo(nom: String) -> void:
	get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dossier, nom])
	print("photo ", nom)


func _process(_dt: float) -> void:
	n += 1
	match etape:
		0: if n == 30: _photo("1-accueil"); App.aller("salon"); etape = 1; n = 0
		1: if n == 20: _photo("2-salon"); App.ecran._ouvre(true); etape = 2; n = 0
		2: if Reseau.net.state == "lobby" and n > 30: _photo("3-table"); etape = 3; n = 0
		3: if n == 5: App.ecran._voiture(1); App.ecran._pret(true)
		_: pass
	if etape == 3 and n == 30: _photo("4-pret"); get_tree().quit()
	if n > 2000: print("délai"); get_tree().quit()
