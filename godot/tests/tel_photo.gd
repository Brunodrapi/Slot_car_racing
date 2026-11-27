## Les écrans du téléphone (scripts/ui/tel, d'après la maquette) photographiés sur un iPhone émulé, comme
## la maquette (390 × 664 points, trois pixels par point) : l'accueil, le paddock et ses feuilles, la fiche
## du circuit, le contre-la-montre, l'entraînement, le championnat (son départ, son paddock, deux courses
## d'un tour menées par le pilote automatique, l'arrivée et son classement, le podium).
##
##   GRIP_TACTILE=1 xvfb-run -a -s "-screen 0 1170x1992x24" godot --path godot --resolution 1170x1992 res://tests/tel_photo.tscn -- <dossier>
extends Node

var dossier := "user://"
var etape := 0
var n := -60
var erreurs := 0


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0: dossier = args[0]
	DirAccess.make_dir_recursive_absolute(dossier)
	var r: Dictionary = App.reglages
	r.langue = OS.get_environment("GRIP_LANGUE") if OS.get_environment("GRIP_LANGUE") != "" else "fr"
	r.voiture = "porsche991gt3r"; r.cat = "gt3"; r.livree = 0
	r.circuit = "spa"; r.tours = 1; r.adversaires = 8; r.difficulte = "medium"; r.nuit = false
	r.programme = {}
	r.championnatTel = { actif = false }
	r.modeTel = ""
	get_tree().create_timer(600.0, true, false, true).timeout.connect(func(): print("trop long"); get_tree().quit(1))
	App.aller.call_deferred("accueil")


func _photo(nom: String) -> void:
	get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dossier, nom])
	print("photo ", nom, "  ", App.ecran.get_class() if App.ecran else "", " ", (App.ecran.get_script() as Script).resource_path.get_file() if App.ecran and App.ecran.get_script() else "")


func _ecran() -> EcranTel:
	return App.ecran as EcranTel


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


## L'étape suivante dans `attente` images.
func _suite(attente := 30) -> void:
	etape += 1
	n = -attente


func _process(_dt: float) -> void:
	n += 1
	_pilote()
	if etape in [41, 51] and App.ecran is ResultatsTel:
		Engine.time_scale = 1.0
		etape += 1000
		n = -30
		return
	if n != 0: return
	var e := _ecran()
	match etape:
		0: _photo("00-accueil"); App.aller("paddock", { mode = "race" }); _suite()
		1: _photo("01-paddock"); (e as PaddockTel)._ouvreCircuits(); _suite()
		2: _photo("02-circuits"); e.fermeDessus(); (e as PaddockTel)._ouvreGarage(); _suite()
		3: _photo("03-garage"); e.fermeDessus(); (e as PaddockTel)._ouvreReglages(); _suite()
		4: _photo("04-reglages"); e.fermeDessus(); (e as PaddockTel)._ouvreDifficulte(); _suite()
		5: _photo("05-difficulte"); e.fermeDessus(); FicheTel.ouvre(e, "spa"); _suite()
		6: _photo("06-fiche"); ((e.pile.back() as PageTel).corps as DefileTel)._defile(700); _suite(10)
		7: _photo("07-chronos"); e.fermeDessus(); App.reglages.nuit = true; e.rafraichit(); _suite()
		8: _photo("08-nuit"); App.reglages.nuit = false; App.aller("paddock", { mode = "timetrial" }); _suite()
		9: _photo("09-contre-la-montre"); App.aller("paddock", { mode = "training" }); _suite()
		10: _photo("10-entrainement"); App.aller("accueil"); _suite()
		11: App.aller("championnat"); _suite()
		12:
			_photo("11-championnat-vide")
			var o := ChampTel.options()
			o.circuits = ["zandvoort", "monza"]
			o.toursParManche = [1, 1]
			App.sauve()
			e.rafraichit()
			_suite()
		13: _photo("12-championnat"); ChampTel.lance(); App.aller("paddock", { mode = "champ" }); _suite()
		14: _photo("13-paddock-championnat"); (e as PaddockTel)._ouvreCalendrier(); _suite()
		15: _photo("14-calendrier"); e.fermeDessus(); (e as PaddockTel)._ouvreClassement(); _suite()
		16: _photo("15-classement-vide"); e.fermeDessus(); (e as PaddockTel)._ouvreReglages(); _suite()
		17: _photo("16-reglages-championnat"); e.fermeDessus(); _suite(20)
		18:
			(e as PaddockTel)._enPiste()
			Engine.max_physics_steps_per_frame = 40
			Engine.time_scale = 4.0
			etape = 41
			n = 1
		1041:
			_photo("17-arrivee-course-1")
			(App.ecran as ResultatsTel)._paddock()
			etape = 42
			n = -30
		42: _photo("18-paddock-course-2"); (e as PaddockTel)._ouvreClassement(); _suite()
		43:
			_photo("19-classement")
			e.fermeDessus()
			etape = 44
			n = -20
		44:
			(e as PaddockTel)._enPiste()
			Engine.time_scale = 4.0
			etape = 51
			n = 1
		1051:
			_photo("20-arrivee-finale")
			var rt := App.ecran as ResultatsTel
			rt.podium = true
			rt.reconstruit()
			etape = 52
			n = -30
		52: _photo("21-podium"); App.aller("accueil"); _suite()
		53: _photo("22-menu-apres"); print("fini"); get_tree().quit()
