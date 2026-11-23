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
	_repriseGrip()
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
	# au lancement, l'écran titre « Appuie pour commencer » (js/ui.js, splash), puis les menus
	aller.call_deferred("titre")


# L'annonce se termine pendant le classement, même après la libération de la scène de course.
var _commentaire: AudioStreamPlayer


func joueAbandon(grosChoc: bool) -> void:
	if _commentaire == null:
		_commentaire = AudioStreamPlayer.new()
		_commentaire.volume_db = linear_to_db(0.5)
		add_child(_commentaire)
	_commentaire.stream = preload("res://sons/big_shock.mp3") if grosChoc else preload("res://sons/too_much_hits.mp3")
	_commentaire.play()


func arreteCommentaire() -> void:
	if _commentaire != null: _commentaire.stop()


## LE CLIC DES MENUS. « Il faut, dans les deux versions, des clics dans les menus. » (Bruno) Chaque
## Bouton le joue quand on le prend (souris, doigt, clavier, manette) ; le même son que le jeu web
## (Son._synthClic). Il passe par le bus Master : le son coupé le coupe aussi.
var _clic: AudioStreamPlayer
var clics := 0                        # combien, depuis le lancement (les essais le comptent)


func clic() -> void:
	clics += 1
	if _clic == null:
		_clic = AudioStreamPlayer.new()
		_clic.stream = Son._synthClic()
		_clic.volume_db = linear_to_db(0.5)       # le volume général du jeu web (master.gain = 0,5)
		_clic.max_polyphony = 3
		add_child(_clic)
	_clic.play()


## LA MUSIQUE DES MENUS (js/audio.js, MUSIQUE). « Ajoute cette musique dans les menus avec un niveau
## sonore très faible. » « Too Cool », Kevin MacLeod (incompetech.com), licence Creative Commons BY 4.0 :
## le crédit est aux réglages. Elle boucle dans tous les écrans sauf la course, en fondu, très bas
## (0,06 : le 0,12 du jeu web sous son volume général de 0,5), par le bus Master : le son coupé la coupe.
const MUSIQUE_VOLUME := 0.06
var _musique: AudioStreamPlayer
var _fonduMusique: Tween


func musique(veut: bool) -> void:
	if DisplayServer.get_name() == "headless": return
	if _musique == null:
		if not veut: return
		var flux = load("res://sons/musique-too-cool.ogg")
		if flux == null: return
		flux.loop = true
		_musique = AudioStreamPlayer.new()
		_musique.stream = flux
		_musique.volume_db = -60.0
		add_child(_musique)
	if _fonduMusique: _fonduMusique.kill()
	_fonduMusique = create_tween()
	if veut:
		if not _musique.playing: _musique.play()
		_fonduMusique.tween_property(_musique, "volume_db", linear_to_db(MUSIQUE_VOLUME), 1.2).set_trans(Tween.TRANS_SINE)
	else:
		_fonduMusique.tween_property(_musique, "volume_db", -60.0, 0.4)
		_fonduMusique.tween_callback(_musique.stop)


## LE MOTEUR QUI DÉMARRE (js/audio.js, DEMARRAGE). « En piste : je veux un son de moteur qui démarre. »
## Le démarreur, le moteur qui prend, deux coups de gaz et le ralenti, cinq secondes et demie : il part
## sur « En piste », couvre le chargement de la course et s'éteint quand le moteur du jeu prend le relais.
var _demarrage: AudioStreamPlayer
var demarrages := 0
## « Je n'entends pas le moteur, juste le clic » (js/audio.js, partMoteur) : les boucles du moteur de la
## course partaient au ralenti et le couvraient. Le fichier est remonté, et le moteur de la course se tait
## 3,6 s puis prend le relais en 1,4 s.
const DEMARRAGE_TIENT := 3.6
const DEMARRAGE_RELAIS := 1.4
var demarrageT0 := -1.0


## La part du moteur de la course pendant le démarrage : rien, puis le relais en fondu.
func partMoteur() -> float:
	if demarrageT0 < 0: return 1.0
	return clampf((Time.get_ticks_msec() / 1000.0 - demarrageT0 - DEMARRAGE_TIENT) / DEMARRAGE_RELAIS, 0, 1)


func demarre() -> void:
	demarrages += 1
	demarrageT0 = Time.get_ticks_msec() / 1000.0
	if DisplayServer.get_name() == "headless": return
	prepareDemarrage()
	_demarrage.play()


## Le son du démarrage, prêt d'avance (le paddock l'appelle) : dans un navigateur, Godot le décode et le
## confie à la Web Audio la première fois qu'on le joue ; sur un téléphone, ce travail tombait sur le
## toucher de « En piste », au moment où la course se charge, et le son partait mal.
func prepareDemarrage() -> void:
	if _demarrage != null or DisplayServer.get_name() == "headless": return
	_demarrage = AudioStreamPlayer.new()
	_demarrage.stream = load("res://sons/demarrage.ogg")
	_demarrage.volume_db = linear_to_db(0.5 * 0.9)     # sous le volume général du jeu web (0,5)
	add_child(_demarrage)
	if OS.has_feature("web") and AudioServer.has_method("register_stream_as_sample"):
		AudioServer.register_stream_as_sample(_demarrage.stream)


## LE JEU S'APPELAIT GRIP — Racing the Line. Le dossier des sauvegardes porte le nom du projet : passé à
## SLOTLESS, il change. Au premier lancement sous ce nom, on reprend ce que l'ancien dossier gardait —
## réglages, records, palmarès, compte, décors téléchargés — pour ne rien perdre.
const ANCIEN_NOM := "GRIP — Racing the Line"


static func _repriseGrip() -> void:
	if OS.has_feature("web") or OS.has_feature("mobile"): return
	var neuf := OS.get_user_data_dir()
	var ancien := neuf.get_base_dir().path_join(ANCIEN_NOM)
	if ancien == neuf or not DirAccess.dir_exists_absolute(ancien) or FileAccess.file_exists(FICHIER): return
	_copieDossier(ancien, neuf)


static func _copieDossier(de: String, vers: String) -> void:
	DirAccess.make_dir_recursive_absolute(vers)
	var d := DirAccess.open(de)
	if d == null: return
	for f in d.get_files(): DirAccess.copy_absolute(de.path_join(f), vers.path_join(f))
	for sd in d.get_directories():
		if not sd.begins_with("."): _copieDossier(de.path_join(sd), vers.path_join(sd))


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
	if nom != "resultats": arreteCommentaire()
	if ecran:
		ecran.queue_free()
	# la musique des menus : partout sauf en course
	musique(nom != "course")
	match nom:
		"titre": ecran = Titre.new()
		"accueil": ecran = Accueil.new()
		"paddock": ecran = Paddock.new(opts.get("mode", reglages.mode))
		"course":
			ecran = load("res://scenes/course.tscn").instantiate()
			ecran.set("reglageDemande", bool(opts.get("reglage", false)))
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
