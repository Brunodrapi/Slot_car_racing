## Des photos de vraies courses, pour le devlog (GRIP_MESURE=0 retire la mesure de fluidité) :
##
## - GRIP_SCENE=chicane : Parco Reale, douze voitures, dégâts ; le pilote automatique part en fond de
##   grille et passe la première chicane avec le peloton, un peu tard sur les freins ; photos de
##   l'approche à la sortie (chicane-1 à chicane-6), avec ce que chacun a pris ; GRIP_AUDACE règle le
##   retard au freinage (1,12 par défaut), GRIP_REPERES les photos, en mètres après la sortie (« -20,0,15 ») ;
## - GRIP_SCENE=mur : pied au plancher, sans jamais freiner, jusqu'au mur ; photos de l'écran DNF
##   (mur-1, mur-2). GRIP_CIRCUIT change de circuit (Parco Reale par défaut).
##
##   GRIP_MESURE=0 GRIP_SCENE=chicane xvfb-run -a godot --path godot --resolution 1280x720 tests/course_photo.tscn -- <dossier>
extends Node

var dossier := "user://"
var scene := "chicane"
var jeu
var depart := 0.0
var entree := 0.0          # la chicane, en mètres depuis la grille
var sortie := 0.0
var reperes: Array[float] = []
var photos := 0
var t := 0.0
var abandonVu := -1.0
var pret := false


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size(): dossier = args[0]
	DirAccess.make_dir_recursive_absolute(dossier)
	if OS.get_environment("GRIP_SCENE") != "": scene = OS.get_environment("GRIP_SCENE")
	var R: Dictionary = App.reglages
	R.mode = "race"
	R.circuit = OS.get_environment("GRIP_CIRCUIT") if OS.get_environment("GRIP_CIRCUIT") != "" else "monza"
	R.voiture = "porsche991gt3r"
	R.adversaires = 11
	R.degats = true
	R.tours = 3
	R.nuit = false
	R.difficulte = "normal"
	await get_tree().create_timer(0.5).timeout
	App.aller("course")
	await get_tree().create_timer(2.0).timeout
	jeu = App.ecran
	var c: Voiture = jeu.course.player
	depart = c.s
	_trouveChicane(c)
	reperes = [entree - 40, entree + 10, sortie - 10, sortie + 30, sortie + 80, sortie + 150]
	if OS.get_environment("GRIP_REPERES") != "":
		reperes = []
		for r in OS.get_environment("GRIP_REPERES").split(","): reperes.append(sortie + float(r))
	print("course lancée : %s, chicane de %.0f à %.0f m" % [R.circuit, entree, sortie])
	pret = true


## La première chicane : la première zone serrée (rayon sous 60 m) après la grille, et sa sortie.
func _trouveChicane(c: Voiture) -> void:
	var dans := false
	var dernier := 0.0
	for i in 1500:
		var d := i * 2.0
		var k := absf(c.track.lineCurv(c.s + d, c.selS))
		if k > 1.0 / 60.0:
			if not dans: entree = d
			dans = true
			dernier = d
		elif dans and d - dernier > 50:
			sortie = dernier
			return
	sortie = entree + 120


func _parcouru(c: Voiture) -> float:
	return fposmod(c.s - depart, c.track.length)


## Le pilote automatique des essais (tests/tel_photo.gd), un peu tard sur les freins dans la chicane.
func _pilote(c: Voiture, audace: float) -> void:
	var lim := 1e9
	var d := 0.0
	while d < c.v * c.v / (2 * c.cls.brake * 0.88) + 40:
		var k := absf(c.track.lineCurv(c.s + d, c.selS))
		if k > 1e-4:
			var vc := Voiture.cornerSpeedFor(c.cls, k) * 0.95 * audace
			lim = minf(lim, sqrt(vc * vc + 2 * c.cls.brake * 0.88 * d))
		d += 3
	if c.v < lim - 0.3: Input.action_press("gaz")
	else: Input.action_release("gaz")


func _photo(nom: String) -> void:
	get_viewport().get_texture().get_image().save_png(dossier.path_join(nom + ".png"))
	var abimees := []
	for v in jeu.course.cars:
		if v.damage > 0.02: abimees.append("%s %.0f %%" % [v.nom, v.damage * 100])
	print("photo %s : %.0f m, %d abîmées %s" % [nom, _parcouru(jeu.course.player), abimees.size(), str(abimees)])


func _process(dt: float) -> void:
	if not pret: return
	t += dt
	var c: Voiture = jeu.course.player
	if scene == "mur":
		Input.action_press("gaz")
		if c.abandon and abandonVu < 0:
			abandonVu = t
			print("abandon à %.1f s, %.0f m" % [t, _parcouru(c)])
		if abandonVu >= 0 and photos == 0 and t - abandonVu > 1.2:
			_photo("mur-1")
			photos = 1
		if abandonVu >= 0 and photos == 1 and t - abandonVu > 2.6:
			_photo("mur-2")
			print("PHOTOS OK")
			get_tree().quit()
		if t > 60:
			print("pas d'abandon en 60 s (%.0f m, dégâts %.0f %%)" % [_parcouru(c), c.damage * 100])
			_photo("mur-sans-abandon")
			get_tree().quit()
		return
	var p := _parcouru(c)
	var audace := float(OS.get_environment("GRIP_AUDACE")) if OS.get_environment("GRIP_AUDACE") != "" else 1.12
	_pilote(c, audace if p > entree - 120 and p < sortie + 20 else 1.0)
	if photos < reperes.size() and p >= reperes[photos] and p < c.track.length * 0.9:
		photos += 1
		_photo("chicane-%d" % photos)
		if photos == reperes.size():
			print("PHOTOS OK")
			get_tree().quit()
	if t > 90:
		print("trop long (%.0f m)" % p)
		get_tree().quit()
