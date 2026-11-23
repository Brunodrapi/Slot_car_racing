## Sous le tunnel de Monaco, de jour : le jour entre côté mer et aux deux portails.
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
	var entree := float(tu[0]) * T.ds
	var sortie := entree + float(tu[1]) * T.ds
	var milieu := (entree + sortie) / 2
	if n == 20:
		bilan.dehorsAuDepart = jeu.nuit.force
		c.state = "racing"; c.countdown = 0
		c.player.place(entree + 10, 0, 0)
	if n == 40:
		bilan.entree = jeu.nuit.force
		c.player.place(milieu, 0, 0)
	if n == 120:
		bilan.dedans = jeu.nuit.force
		bilan.minicarte = jeu.nuit.voit(Vector2(c.player.x + 500, c.player.y), Vector2(c.player.x, c.player.y))
		_photo("tunnel-dedans")
		c.player.place(milieu, T.hwL[T.idx(milieu)] * 0.8, 0)
	if n == 140:
		bilan.mer = jeu.nuit.force
		c.player.place(milieu, -T.hwR[T.idx(milieu)] * 0.8, 0)
	if n == 160:
		bilan.mur = jeu.nuit.force
		c.player.place(sortie - 10, 0, 0)
	if n == 180:
		bilan.sortie = jeu.nuit.force
		c.player.place(sortie + 50, 0, 0)
	if n == 240:
		bilan.dehors = jeu.nuit.force
		_photo("tunnel-dehors")
		jeu.nuit.nuit = true
	if n == 260:
		bilan.nuitDehors = jeu.nuit.force
		c.player.place(milieu, 0, 0)
	if n == 295:
		bilan.nuitDedans = jeu.nuit.force
		_photo("tunnel-nuit")
		var ok: bool = bilan.dehorsAuDepart == 0 and bilan.dehors == 0 and bilan.minicarte \
			and bilan.entree > 0 and bilan.entree < bilan.dedans and bilan.sortie > 0 and bilan.sortie < bilan.dedans \
			and bilan.mer < bilan.dedans and bilan.dedans < bilan.mur and bilan.mur < 0.4 \
			and bilan.nuitDehors == 1 and bilan.nuitDedans > bilan.mur and bilan.nuitDedans < 1
		print("TUNNEL ", "OK" if ok else "ÉCHEC", " ", bilan)
		get_tree().quit(0 if ok else 1)
