extends VBoxContainer

var paddock: Paddock
var page: ScrollContainer
var chronos: ScrollContainer
var rails := {}
var filtreChronos := "tous"
var etroit := false
var compact := false
var doigt: Doigt


func _init(parent: Paddock) -> void:
	paddock = parent


func _ready() -> void:
	paddock.resized.connect(_place)
	_place()
	add_theme_constant_override("separation", 7)
	resized.connect(_redimension)
	doigt = Doigt.new(self, _defile)
	Mondial.change.connect(reconstruit)
	reconstruit()


func _place() -> void:
	var surface := paddock.size - Vector2(20, 16)
	var facteur := minf(1.0, surface.x / 1640.0) if surface.x >= 900 and surface.x >= surface.y else 1.0
	scale = Vector2.ONE * facteur
	size = surface / facteur
	position = Vector2(10, 8)


func _redimension() -> void:
	var empile := size.x < 900 or size.x < size.y
	if etroit != empile or compact != (not empile and size.y < 900): reconstruit.call_deferred()


func _input(event: InputEvent) -> void:
	if not etroit or not is_instance_valid(page): return
	if event is InputEventScreenTouch and event.pressed and not page.get_global_rect().has_point(event.position): return
	doigt.entree(event)
	if event is InputEventScreenDrag and doigt.actif() and doigt.etat.axe != "": get_viewport().set_input_as_handled()


func _process(delta: float) -> void:
	if etroit: doigt.avance(delta)


func _defile(delta: float) -> void:
	if is_instance_valid(chronos) and chronos.get_global_rect().has_point(doigt.etat.depart):
		var avant := chronos.scroll_vertical
		chronos.scroll_vertical += roundi(delta)
		delta -= chronos.scroll_vertical - avant
	var avantPage := page.scroll_vertical
	page.scroll_vertical += roundi(delta)
	if _multi(): paddock.defileExterne.emit((delta - (page.scroll_vertical - avantPage)) * scale.y)


func _boite(vertical: bool) -> BoxContainer:
	var boite: BoxContainer = VBoxContainer.new() if vertical else HBoxContainer.new()
	boite.add_theme_constant_override("separation", 5)
	return boite


func _papier(parent: Control, couleur := Paddock.PC_CREME) -> VBoxContainer:
	var plaque := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = couleur
	for cote in [SIDE_LEFT, SIDE_TOP, SIDE_RIGHT, SIDE_BOTTOM]: style.set_content_margin(cote, 6)
	plaque.add_theme_stylebox_override("panel", style)
	plaque.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	parent.add_child(plaque)
	var bloc := _boite(true)
	plaque.add_child(bloc)
	return bloc


func _libelle(parent: Control, texte: String, taille: int, couleur := Paddock.PC_ENCRE) -> Label:
	var label := Label.new()
	label.text = texte
	label.add_theme_color_override("font_color", couleur)
	label.add_theme_font_size_override("font_size", roundi(taille * (1.2 if etroit else 1.0)))
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	parent.add_child(label)
	return label


func _bouton(parent: Control, texte: String, cle: String, action: Callable, largeur := 44.0, fond := Style.NUIT_PLEINE, encre := Paddock.PC_CREME, taille := 17) -> Bouton:
	var b := Bouton.new(texte, fond, encre, roundi(taille * (1.2 if etroit else 1.0)))
	b.centre = true
	b.coupe = 0
	b.custom_minimum_size = Vector2(maxf(58.0, largeur) if etroit and largeur > 0 else largeur, 58 if etroit else 42)
	b.tooltip_text = texte
	b.set_meta("cle", cle)
	b.pressed.connect(action)
	parent.add_child(b)
	return b


func _pastille(parent: Control, cle: String, nom: String, valeur: String, action: Callable, verrou := false) -> Bouton:
	var taille := 20 if etroit else 16
	var b := _bouton(parent, "", cle, action, Paddock.largeurPastille(nom, valeur, taille), Color("#62665d") if verrou else Style.NUIT_PLEINE)
	b.disabled = verrou
	b.tooltip_text = "%s : %s" % [nom, valeur]
	if verrou: b.libelle("%s : %s" % [nom, valeur])
	else: b.dessinPlus = Paddock._pastille.bind(b, nom, valeur, taille)
	return b


func _image(parent: Control, tex: Texture2D, hauteur: float, largeur := 0.0) -> TextureRect:
	var image := TextureRect.new()
	image.texture = tex
	image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	image.custom_minimum_size = Vector2(largeur, hauteur)
	image.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(image)
	return image


func _vignette(id: String, livree := 0) -> Texture2D:
	var fichier := String(Catalogue.dessin(id, livree).get("vignette", ""))
	return Style.tex("res://images/vignettes/" + fichier) if not fichier.is_empty() else null


func _rail(parent: Control, cle: String, position: int) -> HBoxContainer:
	var ligne := _boite(false)
	parent.add_child(ligne)
	var vue := ScrollContainer.new()
	vue.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	vue.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vue.follow_focus = true
	_bouton(ligne, "‹", cle + "-gauche", func(): vue.scroll_horizontal -= int(vue.size.x * 0.8))
	ligne.add_child(vue)
	_bouton(ligne, "›", cle + "-droite", func(): vue.scroll_horizontal += int(vue.size.x * 0.8))
	var cartes := _boite(false)
	vue.add_child(cartes)
	rails[cle] = vue
	doigt.railNatif(cle, vue)
	vue.set_deferred("scroll_horizontal", position)
	return cartes


func _onglets(parent: Control, cle: String, selection: String, action: Callable) -> void:
	var ligne := _boite(false)
	parent.add_child(ligne)
	var choix := [["tous", Textes.t("all")]]
	for c in Catalogue.categories(): choix.append([c.id, Textes.nom(c.nom).to_upper()])
	for c in choix:
		var active: bool = selection == c[0]
		var b := _bouton(ligne, c[1], cle + c[0], action.bind(c[0]), 60, Paddock.PC_VERT if active else Style.NUIT_PLEINE, Paddock.PC_ENCRE if active else Paddock.PC_CREME)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		if cle == "onglet-": b.disabled = not _hote()
		if compact: b.custom_minimum_size.y = 36


func _multi() -> bool:
	return paddock.mode == "multi"


func _libre() -> bool:
	return not _multi() or Reseau.net.settings().get("championnat", {}).is_empty()


func _hote() -> bool:
	return not _multi() or (Reseau.net.creator and _libre())


func _choisitCircuit(id: String) -> void:
	var tours := int(paddock.infoCircuits[id].tours)
	if _multi(): Reseau.net.setTable({trackId = id, laps = tours})
	else:
		App.reglages.circuit = id
		App.reglages.tours = tours
		_sauve()


func _choisitModele(id: String) -> void:
	paddock._choisitVoiture(id)
	if _multi(): _publieVoiture()


func _publieVoiture() -> void:
	Reseau.net.setMine({car = {modelId = App.reglages.voiture, livree = App.reglages.livree}, ready = false})


func reconstruit() -> void:
	var y := page.scroll_vertical if is_instance_valid(page) else 0
	var yc := chronos.scroll_vertical if is_instance_valid(chronos) else 0
	var focus := get_viewport().gui_get_focus_owner()
	var cle := String(focus.get_meta("cle", "")) if focus and is_ancestor_of(focus) else ""
	var positions := {}
	for id in rails: positions[id] = rails[id].scroll_horizontal
	rails.clear()
	doigt.rails.clear()
	for enfant in get_children():
		remove_child(enfant)
		enfant.queue_free()
	etroit = size.x < 900 or size.x < size.y
	compact = not etroit and size.y < 900
	paddock.portrait = etroit
	var r := App.reglages
	var voiture := Catalogue.voiture(r.voiture)
	var table := Reseau.net.settings() if _multi() else {}
	var manche := Championnat.manche(table.get("championnat", {}))
	var cid := String(manche.get("circuit", table.get("trackId", r.circuit)))
	if _multi():
		paddock.filtre = String(table.get("cat", "all"))
		if paddock.filtre == "all": paddock.filtre = "tous"
	var info: Dictionary = paddock.infoCircuits.get(cid, paddock.infoCircuits.values()[0])
	var nuit: bool = (table.get("timeOfDay", "day") == "night" if _multi() else bool(r.nuit)) and voiture.cat != "f1"
	if not _multi():
		var titreMode := Textes.t({race="quickRace",timetrial="timeTrial",training="training"}.get(paddock.mode,"quickRace"))
		var bandeau := Control.new()
		bandeau.custom_minimum_size.y = 65
		add_child(bandeau)
		bandeau.draw.connect(func():
			var zone := Rect2(Vector2.ZERO, bandeau.size)
			if etroit: BarreTitre.tel(bandeau, zone, titreMode)
			else: BarreTitre.pc(bandeau, zone, titreMode))
		var retour := _bouton(bandeau, "", "retour", func(): App.aller("accueil"), 113, Color.TRANSPARENT)
		retour.size = Vector2(73 if etroit else 113, 65)
		retour.dessinPlus = BarreTitre.retourTel.bind(retour) if etroit else BarreTitre.retourPC.bind(retour)
		retour.tooltip_text = Textes.t("backWord")
		var titrePage := _bouton(self, Textes.t("raceSetup"), "", func(): pass, 385, Paddock.PC_CREME, Paddock.PC_ENCRE, 30)
		titrePage.coupe = 12
		if compact: titrePage.custom_minimum_size.y = 36
		titrePage.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		titrePage.focus_mode = Control.FOCUS_NONE
		titrePage.mouse_filter = Control.MOUSE_FILTER_IGNORE
	page = ScrollContainer.new()
	page.size_flags_vertical = Control.SIZE_EXPAND_FILL
	page.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	page.follow_focus = true
	add_child(page)
	var grille := GridContainer.new()
	grille.columns = 1 if etroit else 2
	grille.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if not etroit: grille.size_flags_vertical = Control.SIZE_EXPAND_FILL
	grille.add_theme_constant_override("h_separation", 8)
	grille.add_theme_constant_override("v_separation", 8)
	page.add_child(grille)
	var apercu := _papier(grille)
	var art := Control.new()
	art.custom_minimum_size = Vector2(0, 205 if compact else 260)
	art.size_flags_vertical = Control.SIZE_EXPAND_FILL
	art.draw.connect(func(): Paddock.dessineCircuit(art, info, nuit))
	apercu.add_child(art)
	var lumiere := _bouton(art, "", "nuit", func():
		if _multi(): Reseau.net.setTable({timeOfDay = "day" if nuit else "night"})
		else: r.nuit = not r.nuit; _sauve(), 44, Color("#62665d") if voiture.cat == "f1" else Style.NUIT_PLEINE)
	lumiere.disabled = voiture.cat == "f1" or not _hote()
	lumiere.tooltip_text = Textes.t("nightF1Hint" if lumiere.disabled else "dayNightLabel")
	lumiere.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	var touche := 65 if etroit else 44
	lumiere.position.x -= touche + 7
	lumiere.position.y = 7
	lumiere.size = Vector2(touche, touche)
	lumiere.dessinPlus = _lumiere.bind(lumiere, nuit)
	_informations(grille, cid, info, yc)
	_reglages(grille, voiture, cid, int(positions.get("circuits", 0)))
	_garage(grille, voiture, int(positions.get("voitures", -1)))
	if not etroit:
		var ajuste := func():
			var largeur := maxf(0, page.size.x - 24)
			grille.get_child(0).custom_minimum_size.x = floorf(largeur * 0.44)
			grille.get_child(1).custom_minimum_size.x = floorf(largeur * 0.56)
		page.resized.connect(ajuste)
		ajuste.call_deferred()
	if not _multi(): _bas()
	page.set_deferred("scroll_vertical", y)
	if not cle.is_empty():
		for c in find_children("*", "Button", true, false):
			if c.get_meta("cle", "") == cle and not c.disabled: c.grab_focus.call_deferred(); break


func _lumiere(b: Bouton, nuit: bool) -> void:
	var centre := b.size / 2
	b.draw_circle(centre, 7 if not nuit else 10, Paddock.PC_CREME, true, -1, true)
	if nuit: b.draw_circle(centre + Vector2(4, -3), 9, b.fond, true, -1, true)
	else:
		for i in 8:
			var rayon := Vector2.RIGHT.rotated(i * TAU / 8)
			b.draw_line(centre + rayon * 10, centre + rayon * 14, Paddock.PC_CREME, 2, true)


func _informations(parent: Control, cid: String, info: Dictionary, y: int) -> void:
	var bloc := _papier(parent)
	var entete := _boite(false)
	bloc.add_child(entete)
	_libelle(entete, String(info.nom).to_upper(), 28)
	_image(entete, Style.drapeau(info.pays), 24, 36)
	var difficulte := _libelle(entete, "%s  %d/4" % [Textes.t("difficultyLabel"), int(info.difficulty)], 15, Paddock.PC_MUET)
	difficulte.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	var resultatMondial: Variant = Mondial.meilleurs(cid)
	var par: Dictionary = resultatMondial if resultatMondial is Dictionary else {}
	var record := INF
	var detenteur := ""
	for resultat in par.values():
		if resultat.temps > 0 and resultat.temps < record:
			record = resultat.temps
			detenteur = str(resultat.get("pilote", ""))
	var stats := GridContainer.new()
	stats.columns = 4
	bloc.add_child(stats)
	var pointe: Dictionary = info.pointe
	Mondial.chargeToursRecents()
	var donnees := [
		["circuitLength", "%d m" % roundi(info.longueur)], ["circuitTurns", str(info.virages)],
		["circuitRadius", "%.1f m" % info.rayon if info.rayon > 0 else "—"],
		["circuitStraight", "%d m" % roundi(info.droite) if info.droite > 0 else "—"],
		["circuitPeak", "%d km/h" % int(pointe.kmh) if not pointe.is_empty() else "—"],
		["communityLaps", str(Mondial.toursRecents.get(cid, 0)) if Mondial.toursDisponibles else "—"],
		["myTrackLaps", str(App.reglages.get("toursCircuit", {}).get(cid, 0))],
		["circuitRecord", Style.temps(record) if is_finite(record) else "—"]]
	for item in donnees:
		var cellule := _papier(stats, Paddock.PC_FEUILLE)
		var lib := _libelle(cellule, Textes.t(item[0]), 13, Paddock.PC_MUET)
		lib.custom_minimum_size.y = 22 if etroit else 17
		_libelle(cellule, item[1], 19, Color("#9462cf") if item[0] == "circuitRecord" else Paddock.PC_ENCRE)
		if item[0] == "circuitPeak" and not pointe.is_empty(): _libelle(cellule, Catalogue.voiture(pointe.voiture).nom, 13, Paddock.PC_MUET)
		if item[0] == "circuitRecord" and not detenteur.is_empty(): _libelle(cellule, detenteur, 13, Paddock.PC_MUET)
	_libelle(bloc, Textes.t("circuitTimes"), 20)
	_onglets(bloc, "chrono-", filtreChronos, func(id): filtreChronos = id; chronos.scroll_vertical = 0; reconstruit())
	chronos = ScrollContainer.new()
	chronos.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	chronos.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_ALWAYS
	chronos.custom_minimum_size.y = 84 if compact else 112
	chronos.size_flags_vertical = Control.SIZE_EXPAND_FILL
	bloc.add_child(chronos)
	var table := _boite(true)
	table.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	chronos.add_child(table)
	var lignes := []
	var personnels: Dictionary = App.reglages.get("records", {})
	for v in Catalogue.donnees.voitures:
		if filtreChronos != "tous" and v.cat != filtreChronos: continue
		var local := float(personnels.get(cid + "/" + v.id, -1))
		var monde := float(par.get(v.id, {}).get("temps", -1))
		if local > 0 or monde > 0:
			lignes.append({ voiture = v, local = local, monde = monde, temps = minf(local if local > 0 else INF, monde if monde > 0 else INF) })
	lignes.sort_custom(func(a, b): return a.temps < b.temps)
	var colonnes := _boite(false)
	table.add_child(colonnes)
	_libelle(colonnes, Textes.t("model"), 14)
	for key in ["colRecord", "colMonde"]:
		var l := _libelle(colonnes, Textes.t(key), 13, Paddock.PC_MUET)
		l.custom_minimum_size.x = 83
		l.size_flags_horizontal = Control.SIZE_SHRINK_END
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	if lignes.is_empty(): _libelle(table, "—", 17, Paddock.PC_MUET)
	for l in lignes:
		var ligne := _boite(false)
		table.add_child(ligne)
		_image(ligne, _vignette(l.voiture.id), 30, 54)
		var modele := _boite(true)
		modele.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		ligne.add_child(modele)
		_libelle(modele, str(l.voiture.nom), 15)
		var pilote := String(par.get(l.voiture.id, {}).get("pilote", ""))
		if not pilote.is_empty(): _libelle(modele, pilote, 12, Paddock.PC_MUET)
		for temps in [l.local, l.monde]:
			var valeur := _libelle(ligne, Style.temps(temps) if temps > 0 else "—", 16)
			valeur.custom_minimum_size.x = 83
			valeur.size_flags_horizontal = Control.SIZE_SHRINK_END
			valeur.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	chronos.set_deferred("scroll_vertical", y)


func _reglages(parent: Control, voiture: Dictionary, cid: String, x: int) -> void:
	var r := App.reglages
	var bloc := _papier(parent)
	_libelle(bloc, Textes.t("track"), 20)
	var cartes := _rail(bloc, "circuits", x)
	for circuit in Catalogue.circuits():
		var id := String(circuit.id)
		var b := _bouton(cartes, String(circuit.nom).to_upper(), "circuit-" + id, _choisitCircuit.bind(id), 112, Paddock.PC_CREME, Paddock.PC_ENCRE, 14)
		b.custom_minimum_size.y = 100 if compact else 122
		b.ligne = 74 if compact else 91
		b.set_meta("compact", compact)
		b.disabled = not _hote()
		b.set_meta("circuit", id)
		b.set_meta("sel", id == cid)
		b.dessinPlus = Paddock._carteCircuitPC.bind(b)
	if _multi(): return
	if paddock.mode == "race":
		var ligne := _boite(false)
		bloc.add_child(ligne)
		_pastille(ligne, "difficulte", Textes.t("difficultyLabel"), Paddock._nom(Paddock.DIFFICULTES, r.difficulte), func(): r.difficulte = Paddock._suivant(Paddock.DIFFICULTES, r.difficulte); _sauve())
		_pastille(ligne, "adversaires", Textes.t("opponentsLabel"), str(int(r.adversaires) - 1), func(): r.adversaires = (int(r.adversaires) - 1) % 11 + 2; _sauve())
	var autres := HFlowContainer.new()
	autres.add_theme_constant_override("h_separation", 5)
	bloc.add_child(autres)
	if paddock.mode == "race": _pastille(autres, "degats", Textes.t("chipDegats"), Textes.t("on" if r.get("degats", true) else "off"), func(): r.degats = not r.get("degats", true); _sauve())
	var freins := _boite(false)
	freins.add_theme_constant_override("separation", 0)
	autres.add_child(freins)
	var cfg := ReglageFrein.active(cid, voiture.id)
	var nom := Paddock._coupe(String(cfg.get("nom", Textes.t("regDefaut"))), 16, 140)
	_pastille(freins, "freinage", Textes.t("freinage"), nom + Paddock.LISTE, func(): ReglageFrein.suivante(cid, voiture.id); _sauve())
	_bouton(freins, Textes.t("regRegler"), "regler", paddock._regler, 82)

	if paddock.mode == "timetrial":
		var etat := Mondial.etat()
		var texte := _libelle(bloc, etat.texte, 15, Paddock.PC_MUET)
		texte.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		if Mondial.connexionPossible() and (Mondial.enCours or not Mondial.connecte()):
			_bouton(bloc, Textes.t("signInCancel" if Mondial.enCours else "signIn"), "mondial", func(): (Mondial.annuler() if Mondial.enCours else Mondial.entrer()))


func _garage(parent: Control, voiture: Dictionary, x: int) -> void:
	var bloc := _papier(parent)
	var disposition := _boite(etroit)
	bloc.add_child(disposition)
	var apercu := _boite(true)
	disposition.add_child(apercu)
	apercu.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	apercu.size_flags_stretch_ratio = 0.48
	_libelle(apercu, String(voiture.nom).to_upper(), 23)
	var livrees: Array = voiture.livrees
	var index := posmod(int(App.reglages.livree), livrees.size())
	var illustration := Control.new()
	illustration.custom_minimum_size.y = 114 if compact else 155
	apercu.add_child(illustration)
	var vignette := _vignette(voiture.id, index)
	illustration.draw.connect(func():
		var zone := Rect2(Vector2.ZERO, illustration.size)
		Style.couvre(illustration, paddock.fondPaddock, zone, 0.5)
		if vignette:
			var dimensions := vignette.get_size()
			dimensions *= minf(zone.size.x / dimensions.x, zone.size.y / dimensions.y)
			illustration.draw_texture_rect(vignette, Rect2((zone.size - dimensions) / 2, dimensions), false))
	var lv := _boite(false)
	apercu.add_child(lv)
	var precedent := _bouton(lv, "‹", "livree-gauche", _livree.bind(-1, livrees.size()))
	_libelle(lv, Textes.livree(livrees[index]), 15).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var suivant := _bouton(lv, "›", "livree-droite", _livree.bind(1, livrees.size()))
	precedent.disabled = livrees.size() < 2 or not _libre()
	suivant.disabled = precedent.disabled
	var choix := _boite(true)
	choix.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	disposition.add_child(choix)
	_onglets(choix, "onglet-", paddock.filtre, func(id):
		rails.erase("voitures")
		if _multi(): Reseau.net.setTable({cat = "all" if id == "tous" else id})
		else: paddock._choisitCategorie(id))
	var modeles: Array = Catalogue.donnees.voitures.filter(func(c): return paddock.filtre == "tous" or c.cat == paddock.filtre)
	if x < 0:
		for i in modeles.size():
			if modeles[i].id == voiture.id: x = maxi(0, (i - 2) * 91); break
	var cartes := _rail(choix, "voitures", x)
	for c in modeles:
		var id := String(c.id)
		var b := _bouton(cartes, Paddock._coupe(String(c.nom).to_upper(), 13, 80), "voiture-" + id, _choisitModele.bind(id), 86, Paddock.PC_CREME, Paddock.PC_ENCRE, 13)
		b.custom_minimum_size.y = 96 if compact else 112
		b.ligne = 84
		b.disabled = not _libre()
		b.set_meta("voiture", c)
		b.set_meta("sel", id == voiture.id)
		b.dessinPlus = Paddock._carteVoiturePC.bind(b, false)
	var perf: Dictionary = voiture.perf
	var poids := int(voiture.get("weightKg", 0))
	var mesures := [
		["statVmax", "%d km/h" % roundi(perf.vmax), perf.vmax / 400.0],
		["statGrip", "%.2f g" % perf.gripG, perf.gripG / 4.0],
		["statAcc", "%.1f s" % perf.a100, 2.0 / perf.a100],
		["carWeight", "≈ %d kg" % poids if poids > 0 else "—", poids / 1500.0],
		["statB100", "%.1f m" % perf.b100, 15.0 / perf.b100]]
	for mesure in mesures:
		var rangee := _boite(false)
		choix.add_child(rangee)
		_libelle(rangee, Textes.t(mesure[0]), 15)
		var jauge := ProgressBar.new()
		jauge.show_percentage = false
		jauge.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		jauge.custom_minimum_size = Vector2(70, 8)
		var encre := StyleBoxFlat.new()
		encre.bg_color = Paddock.PC_VERT
		jauge.add_theme_stylebox_override("fill", encre)
		jauge.value = clampf(mesure[2] * 100.0, 0, 100)
		rangee.add_child(jauge)
		var valeur := _libelle(rangee, mesure[1], 15)
		valeur.size_flags_horizontal = Control.SIZE_SHRINK_END
		valeur.custom_minimum_size.x = 72
		valeur.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT


func _livree(sens: int, nombre: int) -> void:
	App.reglages.livree = posmod(int(App.reglages.livree) + sens, nombre)
	_sauve()
	if _multi(): _publieVoiture()


func _bas() -> void:
	var bas := _papier(self)
	var ligne := _boite(false)
	bas.add_child(ligne)
	var r := App.reglages
	var programme: Dictionary = r.get("programme", {})
	var actif := App.programmeActif and Championnat.actif(programme)
	if paddock.mode == "race":
		_bouton(ligne, Textes.t("championnat"), "programme", func(): App.aller("programme"), 145, Paddock.PC_VERT if actif else Style.NUIT_PLEINE, Paddock.PC_ENCRE if actif else Paddock.PC_CREME)
		if Style.tactile():
			_libelle(ligne, Textes.t("lapsLabel"), 17)
			var menu := Style.menuNombre(1, 99, int(r.tours), "", actif and not programme.get("circuits", []).is_empty(), func(v): r.tours = v; _sauve())
			menu.set_meta("cle", "tours")
			ligne.add_child(menu)
		else:
			_pastille(ligne, "tours", Textes.t("lapsLabel"), str(int(r.tours)), func(): r.tours = int(r.tours) % 10 + 1; _sauve(), actif and not programme.get("circuits", []).is_empty())
	var espace := Control.new()
	espace.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ligne.add_child(espace)
	if not etroit:
		_bouton(ligne, Textes.t("backWord"), "retour-bas", func(): App.aller("accueil"), 116)
		var marge := Control.new()
		marge.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		ligne.add_child(marge)
	_bouton(ligne, Textes.t("onTrack"), "go", paddock._enPiste, 150, Paddock.PC_ROUGE, Paddock.PC_CREME, 23)


func _sauve() -> void:
	App.sauve()
	reconstruit()
