## Sous le tunnel de Monaco, de jour : la nuit tombe en fondu, et se lève à la sortie.
##
##   xvfb-run -a -s "-screen 0 1280x720x24" godot --path godot res://tests/tunnel_nuit.tscn -- <dossier>
extends Node

var dossier := "user://"
var n := 0
var bilan := {}


func _ready() -> void:
	process_physics_priority = 1000
	var a := OS.get_cmdline_user_args()
	if a.size() > 0: dossier = a[0]
	App.reglages.circuit = "monaco"; App.reglages.voiture = "porsche991gt3r"; App.reglages.mode = "timetrial"
	App.reglages.nuit = false
	App.reglages.natif = false        # la course en GDScript : on peut y poser la voiture
	App.aller.call_deferred("course")


func _photo(nom: String) -> void:
	get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dossier, nom])


func _physics_process(_dt: float) -> void:
	var jeu = App.ecran
	if not (jeu is Node2D) or jeu.course == null or jeu.nuit == null: return
	n += 1
	var c: Course = jeu.course
	var T := c.track
	var tu: Array = T.tunnels[0]
	if n == 20:
		bilan.dehorsAuDepart = jeu.nuit.force
		c.state = "racing"; c.countdown = 0
		c.player.place((int(tu[0]) + 80) * T.ds, 0, 0)
	if n == 30: bilan.entree = jeu.nuit.force          # le fondu commence (quelques images plus tard)
	if n == 120:
		bilan.dedans = jeu.nuit.force; bilan.minicarte = jeu.nuit.voit(Vector2(c.player.x + 500, c.player.y), Vector2(c.player.x, c.player.y))
		_photo("tunnel-dedans")
		c.player.place((int(tu[0]) + int(tu[1]) + 150) * T.ds, 0, 0)
	if n == 125: bilan.sortie = jeu.nuit.force
	if n == 220:
		bilan.dehors = jeu.nuit.force
		_photo("tunnel-dehors")
		var ok: bool = bilan.dehorsAuDepart == 0 and bilan.entree > 0 and bilan.entree < 1 and bilan.dedans == 1 and bilan.minicarte \
			and bilan.sortie < 1 and bilan.sortie > 0 and bilan.dehors == 0
		print("TUNNEL ", "OK" if ok else "ÉCHEC", " ", bilan)
		get_tree().quit()
