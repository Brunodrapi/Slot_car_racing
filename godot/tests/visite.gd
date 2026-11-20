## Une visite des écrans, pour les voir sans écran (Xvfb) :
##
##   xvfb-run -s "-screen 0 1280x720x24" godot --path godot res://tests/visite.tscn -- <dossier> [circuit] [voiture]
##
## Accueil, paddock, départ, course (le joueur est mené par la règle du pilote automatique), pause,
## puis une course d'un tour accélérée jusqu'aux résultats.
extends Node

var dossier := "user://"
var t := 0.0
var etape := 0
var n := 0


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0: dossier = args[0]
	if args.size() > 1: App.reglages.circuit = args[1]
	if args.size() > 2: App.reglages.voiture = args[2]; App.reglages.cat = Catalogue.voiture(args[2]).cat
	App.reglages.tours = 1
	App.reglages.adversaires = 8
	App.reglages.difficulte = "medium"


func _photo(nom: String) -> void:
	var img := get_viewport().get_texture().get_image()
	img.save_png("%s/%s.png" % [dossier, nom])
	print("photo ", nom)


func _pilote() -> void:
	var jeu = App.ecran
	if not (jeu is Node2D) or jeu.course == null: return
	var c: Voiture = jeu.course.player
	var lim := 1e9
	var d := 0.0
	while d < c.v * c.v / (2 * c.cls.brake * 0.88) + 40:
		var k := absf(c.track.lineCurv(c.s + d, c.selS))
		if k > 1e-4:
			var vc := Voiture.cornerSpeedFor(c.cls, k) * 0.95
			lim = minf(lim, sqrt(vc * vc + 2 * c.cls.brake * 0.88 * d))
		d += 3
	if c.v < lim - 0.3: Input.action_press("gaz")
	else: Input.action_release("gaz")


func _process(dt: float) -> void:
	t += dt
	n += 1
	_pilote()
	match etape:
		0: if n == 30: _photo("1-accueil"); App.aller("paddock", { mode = "race" }); etape = 1; n = 0
		1: if n == 30: _photo("2-paddock"); App.aller("course"); etape = 2; n = 0
		2: if n == 40: _photo("3-depart"); etape = 3; n = 0
		3: if n == 300: _photo("4-course"); etape = 4; n = 0
		4: if n == 1: App.ecran.basculePause()
		_: pass
	if etape == 4 and n == 10:
		_photo("5-pause"); App.ecran.basculePause(); etape = 5; n = 0
		Engine.max_physics_steps_per_frame = 40
		Engine.time_scale = 4.0
	if etape == 5 and App.ecran is Resultats and n > 5:
		Engine.time_scale = 1.0
		_photo("6-resultats"); etape = 6; n = 0
	if etape == 5 and n > 20000: print("pas d'arrivée"); get_tree().quit()
	if etape == 6 and n == 5: get_tree().quit()
