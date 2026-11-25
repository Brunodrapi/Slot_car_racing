## Parcours dans les menus et lancement en conditions réelles. Les clics passent par le viewport.
## godot --path godot --resolution 1366x768 tests/paddock_championnat.tscn
extends Node

var echecs := 0


func _ready() -> void:
	get_tree().create_timer(45).timeout.connect(func(): get_tree().quit(2))
	await get_tree().create_timer(0.4).timeout
	App.reglages.merge({
		nom = "PiloteTest", langue = "fr", mode = "race", circuit = "spa", cat = "f1",
		voiture = "renaultrs10", livree = 0, tours = 2, adversaires = 10, nuit = false, son = false,
		programme = { circuits = ["redbullring"], positions = {} }
	}, true)
	Mondial.cache.spa = { t = Time.get_ticks_msec(), par = {
		ferrari488gt3 = { temps = 90.0 }, renaultrs10 = { temps = 93.0 }, porsche991gt3r = { temps = 89.0, pilote = "Bruno" }
	} }
	App.aller("accueil")
	await _cadre()
	await _clic(App.ecran.modes[0])
	if not App.ecran is Paddock:
		_verifie(false, "course rapide depuis l'accueil")
		get_tree().quit(1)
		return
	var rapide: Control = App.ecran.rapide
	_verifie(not App.programmeActif and not _controle(rapide, "tours").disabled, "le calendrier enregistré reste à appliquer")
	var libelles := rapide.find_children("*", "Label", true, false).map(func(l): return l.text)
	_verifie(libelles.has("≈ 690 kg"), "poids du modèle affiché")
	_verifie(libelles.count("Bruno") == 2, "titulaire du record dans la fiche et le classement")
	_verifie(App.ecran.infoCircuits.monza.difficulty == 1, "Monza au premier niveau")
	var paysage := not bool(rapide.etroit)
	_verifie(_controle(rapide, "nuit").disabled, "nuit grisée en F1")
	if paysage:
		for cle in ["degats", "regler", "livree-droite", "difficulte", "adversaires"]:
			_verifie(rapide.page.get_global_rect().grow(1).encloses(_controle(rapide, cle).get_global_rect()), cle + " visible sur PC sans défiler")
		var rail: ScrollContainer = rapide.rails.voitures
		var carte: Control = rail.get_child(0).get_child(0)
		_verifie(rail.size.x >= carte.size.x * 5 + 20, "cinq modèles tiennent dans le rail")
		var jauges := rapide.find_children("*", "ProgressBar", true, false)
		_verifie(jauges.size() == 5 and rapide.page.get_global_rect().encloses(jauges.back().get_global_rect()), "toute la fiche de performances est visible")
		await _photo("paddock")
	await _clic(_controle(rapide, "onglet-gt3"), rapide.page)
	_verifie(not _controle(rapide, "nuit").disabled, "nuit disponible en GT3")
	await _clic(_controle(rapide, "nuit"), rapide.page)
	_verifie(App.reglages.nuit, "bouton lune pris")
	await _clic(_controle(rapide, "livree-droite"), rapide.page)
	_verifie(int(App.reglages.livree) != 0, "changement de livrée")
	await _clic(_controle(rapide, "chrono-gt3"), rapide.page)
	_verifie(rapide.filtreChronos == "gt3", "filtre GT3")
	var chrono: Control = rapide.chronos.get_child(0)
	_verifie(chrono.get_child(1).get_child(3).text == "1:29.000", "chronos classés")
	await _clic(_controle(rapide, "adversaires"), rapide.page)
	var n := int(App.reglages.adversaires)
	_verifie(n == 11, "adversaires réglables")
	await _clic(_controle(rapide, "programme"))
	if not App.ecran is ProgrammeCourse:
		_verifie(false, "championnat accessible")
		get_tree().quit(1)
		return
	var championnat: ProgrammeCourse = App.ecran
	var ajout := _controle(championnat, "programme-ajouter")
	await _clic(ajout, championnat.scroll)
	_verifie(championnat.options.circuits == ["redbullring", "spa"], "le + ajoute au calendrier existant")
	var champ = _controle(championnat, "programme-tours-1")
	if Style.tactile():
		_verifie(champ is OptionButton and champ.item_count == 99, "liste des tours")
		_verifie(_controle(championnat, "programme-essais").item_count == 61 and _controle(championnat, "programme-qualifications").item_count == 61, "listes des minutes")
		champ.select(11)
		champ.item_selected.emit(11)
	else: await _saisie(champ.get_line_edit(), "12", championnat.scroll)
	_verifie(championnat.options.toursParManche == [2, 12], "le choix des tours est appliqué")
	await _clic(_controle(championnat, "programme-deplace-1--1"), championnat.scroll)
	_verifie(championnat.options.circuits == ["spa", "redbullring"] and championnat.options.toursParManche == [12, 2], "le déplacement emporte les tours")
	await _photo("championnat")
	await _clic(_controle(championnat, "programme-retire-1"), championnat.scroll)
	_verifie(championnat.options.circuits == ["spa"], "suppression d'une manche")
	await _clic(_controle(championnat, "programme-appliquer"))
	rapide = App.ecran.rapide
	_verifie(_controle(rapide, "tours").disabled, "tours globaux grisés après retour")
	await _clic(_controle(rapide, "go"))
	var limite := Time.get_ticks_msec() + 18000
	while (not is_instance_valid(App.ecran) or not ("course" in App.ecran) or App.ecran.course == null) and Time.get_ticks_msec() < limite:
		await get_tree().process_frame
	if is_instance_valid(App.ecran) and "course" in App.ecran and App.ecran.course:
		_verifie(App.ecran.circuitId == "spa" and App.ecran.course.laps == 12, "la course démarre sur le circuit et les tours choisis")
		_verifie(App.ecran.course.cars.size() == n and App.ecran.course.phase == "course", "la simulation reprend les adversaires et la phase")
	else: _verifie(false, "la course démarre")
	print("Paddock Godot ", get_window().size, " — ", "OK" if echecs == 0 else "%d erreurs" % echecs)
	get_tree().quit(0 if echecs == 0 else 1)


func _controle(racine: Control, cle: String) -> Control:
	for c in racine.find_children("*", "Control", true, false):
		if c.get_meta("cle", "") == cle: return c
	return null


func _clic(controle: Control, scroll: ScrollContainer = null) -> void:
	if not is_instance_valid(controle):
		_verifie(false, "contrôle introuvable")
		return
	if scroll: scroll.ensure_control_visible(controle)
	await _cadre()
	var position := controle.get_global_rect().get_center()
	for enfonce in [true, false]:
		var entree := InputEventMouseButton.new()
		entree.button_index = MOUSE_BUTTON_LEFT
		entree.position = position
		entree.global_position = position
		entree.pressed = enfonce
		get_viewport().push_input(entree, true)
		await get_tree().process_frame
	await _cadre()


func _saisie(champ: LineEdit, valeur: String, scroll: ScrollContainer) -> void:
	await _clic(champ, scroll)
	champ.select_all()
	for lettre in valeur:
		var entree := InputEventKey.new()
		entree.unicode = lettre.unicode_at(0)
		entree.keycode = lettre.unicode_at(0)
		entree.pressed = true
		get_viewport().push_input(entree, true)
	var valide := InputEventKey.new()
	valide.keycode = KEY_ENTER
	valide.pressed = true
	get_viewport().push_input(valide, true)
	await _cadre()


func _cadre() -> void:
	await get_tree().process_frame
	await get_tree().process_frame


func _photo(nom: String) -> void:
	if OS.get_cmdline_user_args().is_empty(): return
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0] + "-" + nom + ".png")


func _verifie(ok: bool, nom: String) -> void:
	print("OK " if ok else "ÉCHEC ", nom)
	if not ok: echecs += 1
