class_name ProgrammeCourse
extends Control

var options: Dictionary
var enLigne := false
var liste: GridContainer
var cadre: PanelContainer
var fondPaddock: Texture2D
var cartes: GridContainer
var apercu: Control
var choixCircuit := ""
var scroll: ScrollContainer
var doigt: Doigt

const VERT := Color("#8ae8ad")


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	enLigne = Reseau.net.state == "lobby"
	options = (Reseau.net.settings().get("programme", {}) if enLigne else App.reglages.get("programme", {})).duplicate(true)
	fondPaddock = Style.tex("res://images/interface/paddock.webp")
	cadre = PanelContainer.new()
	cadre.add_theme_stylebox_override("panel", _papier(Color.TRANSPARENT, 4))
	add_child(cadre)
	var page := VBoxContainer.new()
	page.add_theme_constant_override("separation", 12)
	cadre.add_child(page)
	var barre := Control.new()
	barre.custom_minimum_size.y = 58
	page.add_child(barre)
	barre.draw.connect(func():
		var zone := Rect2(Vector2.ZERO, barre.size)
		if size.x < size.y: BarreTitre.tel(barre, zone, Textes.t("quickRace"))
		else: BarreTitre.pc(barre, zone, Textes.t("quickRace")))
	var accueil := _bouton("", 96)
	accueil.fond = Color.TRANSPARENT
	accueil.size = Vector2(96,58)
	accueil.dessinPlus = BarreTitre.retourPC.bind(accueil)
	barre.add_child(accueil)
	accueil.pressed.connect(_retour)
	var titre := Bouton.new(Textes.t("championnat"), Style.ROUGE, Style.CREME, 27)
	titre.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	titre.custom_minimum_size.x = 280
	titre.custom_minimum_size.y = 52
	titre.focus_mode = Control.FOCUS_NONE
	titre.mouse_filter = Control.MOUSE_FILTER_IGNORE
	page.add_child(titre)
	scroll = ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	page.add_child(scroll)
	doigt = Doigt.new(self, func(delta): scroll.scroll_vertical += roundi(delta))
	liste = GridContainer.new()
	liste.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	liste.add_theme_constant_override("h_separation", 12)
	liste.add_theme_constant_override("v_separation", 10)
	scroll.add_child(liste)
	var retour := _bouton(Textes.t("backWord"), 116)
	retour.set_meta("cle", "programme-retour")
	retour.size_flags_horizontal = Control.SIZE_SHRINK_END
	retour.pressed.connect(_retour)
	var actions := HBoxContainer.new()
	page.add_child(actions)
	actions.add_child(retour)
	var espace := Control.new()
	espace.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	actions.add_child(espace)
	if not enLigne or (Reseau.net.creator and Reseau.net.settings().get("championnat", {}).is_empty()):
		var applique := _bouton(Textes.t("applySeries"), 145)
		applique.fond = Style.ROUGE
		applique.set_meta("cle", "programme-appliquer")
		actions.add_child(applique)
		applique.pressed.connect(_applique)
	resized.connect(_place)
	liste.minimum_size_changed.connect(_place.call_deferred)
	_construit()
	_place()


func _place() -> void:
	var largeur := maxf(0, size.x - 24)
	liste.columns = 2 if largeur >= 720 else 1
	if is_instance_valid(cartes): cartes.columns = clampi(int((largeur * 0.64 - 45) / 152), 2, 5) if liste.columns == 2 else clampi(int((largeur - 60) / 152), 1, 5)
	if is_instance_valid(apercu): apercu.custom_minimum_size.y = 116 if liste.columns == 2 and size.y < 800 else 154
	var hauteur := maxf(0, size.y - 16)
	if liste.get_child_count() == 2:
		liste.get_child(1).custom_minimum_size.x = largeur * 0.64 - 30 if liste.columns == 2 else 0
	cadre.size = Vector2(largeur, hauteur)
	cadre.position = ((size - cadre.size) / 2).round()
	queue_redraw()


func _draw() -> void:
	Style.couvre(self, fondPaddock, Rect2(Vector2.ZERO, size), 0.5)



func _retour() -> void:
	App.aller("salon" if enLigne else "paddock")


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"): _retour()


func _input(event: InputEvent) -> void:
	if not is_instance_valid(scroll) or size.x >= size.y: return
	if event is InputEventScreenTouch and event.pressed and not scroll.get_global_rect().has_point(event.position): return
	doigt.entree(event)
	if event is InputEventScreenDrag and doigt.actif() and doigt.etat.axe != "": get_viewport().set_input_as_handled()


func _process(delta: float) -> void:
	if size.x < size.y: doigt.avance(delta)


func _papier(couleur: Color, marge: float) -> StyleBoxFlat:
	var fond := StyleBoxFlat.new()
	fond.bg_color = couleur
	fond.content_margin_left = marge; fond.content_margin_right = marge
	fond.content_margin_top = marge; fond.content_margin_bottom = marge
	return fond


func _bloc() -> VBoxContainer:
	var carte := PanelContainer.new()
	carte.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	carte.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	carte.add_theme_stylebox_override("panel", _papier(Color("#fff6df"), 12))
	liste.add_child(carte)
	var bloc := VBoxContainer.new()
	bloc.add_theme_constant_override("separation", 8)
	carte.add_child(bloc)
	return bloc


func _texte(nom: String, taille: int, couleur := Style.ENCRE) -> Label:
	var label := Label.new()
	label.text = nom
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_font_size_override("font_size", taille)
	label.add_theme_color_override("font_color", couleur)
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return label


func _ligne(bloc: VBoxContainer, nom: String, taille := 20) -> HBoxContainer:
	var ligne := HBoxContainer.new()
	ligne.custom_minimum_size.y = 42
	ligne.add_theme_constant_override("separation", 8)
	bloc.add_child(ligne)
	var label := _texte(nom, taille)
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	ligne.add_child(label)
	return ligne


func _bouton(nom: String, largeur: float) -> Bouton:
	var b := Bouton.new(nom, Style.NUIT_PLEINE, Style.CREME, 18)
	b.centre = true
	b.custom_minimum_size = Vector2(largeur, 42)
	return b


func _selection(largeur: float) -> OptionButton:
	var menu := OptionButton.new()
	menu.custom_minimum_size = Vector2(largeur, 42)
	menu.fit_to_longest_item = false
	menu.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	menu.add_theme_font_size_override("font_size", 19)
	for etat in ["normal", "hover", "pressed", "disabled"]:
		menu.add_theme_stylebox_override(etat, _papier(Style.NUIT_PLEINE, 8))
		menu.add_theme_color_override("font_" + etat + "_color", VERT)
	menu.add_theme_color_override("font_color", VERT)
	menu.item_selected.connect(func(_i): App.clic())
	return menu


func _applique() -> void:
	if enLigne: Reseau.net.setTable({ programme = options.duplicate(true) })
	else:
		App.reglages.programme = options
		App.programmeActif = Championnat.actif(options)
		App.sauve()
	_retour()


func _champTour(tours: int, editable: bool) -> SpinBox:
	var champ := SpinBox.new()
	champ.min_value = 1; champ.max_value = 99
	champ.value = tours
	champ.editable = editable
	champ.custom_minimum_size = Vector2(72, 40)
	var saisie := champ.get_line_edit()
	saisie.add_theme_stylebox_override("normal", _papier(Paddock.PC_VERT, 5))
	saisie.add_theme_color_override("font_color", Style.ENCRE)
	return champ


func _dessineApercu(nuit: bool) -> void:
	Paddock.dessineCircuit(apercu, Paddock.infosCircuits()[choixCircuit], nuit)


func _construit() -> void:
	var y := scroll.scroll_vertical
	var focus := get_viewport().gui_get_focus_owner()
	var cle := String(focus.get_meta("cle", "")) if focus and liste.is_ancestor_of(focus) else ""
	for enfant in liste.get_children():
		liste.remove_child(enfant)
		enfant.queue_free()
	var table := Reseau.net.settings() if enLigne else {}
	var editable: bool = not enLigne or (Reseau.net.creator and table.get("championnat", {}).is_empty())
	var gauche := _bloc()
	var droite := _bloc()
	for phase in ["essais", "qualifications"]:
		if Style.tactile():
			var menu := Style.menuNombre(0, 60, int(options.get(phase, 0)), " min", not editable, func(v): options[phase] = v)
			menu.set_meta("cle", "programme-" + phase)
			_ligne(gauche, Textes.t(phase)).add_child(menu)
			continue
		var champ := SpinBox.new()
		champ.min_value = 0; champ.max_value = 60
		champ.suffix = " min"
		champ.value = int(options.get(phase, 0))
		champ.editable = editable
		champ.custom_minimum_size = Vector2(112, 42)
		champ.add_theme_color_override("up_icon_modulate", Style.ENCRE)
		champ.add_theme_color_override("down_icon_modulate", Style.ENCRE)
		var saisie := champ.get_line_edit()
		saisie.add_theme_stylebox_override("normal", _papier(Style.NUIT_PLEINE, 8))
		saisie.add_theme_stylebox_override("read_only", _papier(Style.NUIT_PLEINE, 8))
		saisie.add_theme_color_override("font_color", VERT)
		saisie.add_theme_color_override("font_uneditable_color", VERT)
		saisie.add_theme_font_size_override("font_size", 19)
		champ.value_changed.connect(func(v): options[phase] = int(v))
		_ligne(gauche, Textes.t(phase)).add_child(champ)
	gauche.add_child(_texte(Textes.t("programmeHint"), 17, Color("#565b4f")))
	var voiture := String(App.reglages.voiture)
	if enLigne:
		var membres := Reseau.net.members()
		if not membres.is_empty() and membres[0].car is Dictionary:
			voiture = String(membres[0].car.get("modelId", voiture))
	var categorie := Championnat.categorieTable(table, voiture)
	gauche.add_child(_texte(Textes.t("bareme_" + Championnat.cleBareme(categorie)), 17, Color("#565b4f")))
	var calendrier: Array = options.get("circuits", [])
	var defaut := int(table.get("laps", App.reglages.tours))
	var toursParManche: Array = []
	for i in calendrier.size(): toursParManche.append(Championnat.toursManche(options, i, defaut))
	var infos := Paddock.infosCircuits()
	var circuits := Catalogue.circuits()
	if not infos.has(choixCircuit): choixCircuit = String(table.get("trackId", App.reglages.circuit))
	if not infos.has(choixCircuit): choixCircuit = String(circuits[0].id)
	var nuit: bool = categorie != "f1" and (table.get("timeOfDay") == "night" if enLigne else bool(App.reglages.nuit))
	var titreCircuit := _texte(String(infos[choixCircuit].nom), 22)
	gauche.add_child(titreCircuit)
	gauche.move_child(titreCircuit, 0)
	apercu = Control.new()
	apercu.custom_minimum_size.y = 154
	apercu.draw.connect(_dessineApercu.bind(nuit))
	gauche.add_child(apercu)
	gauche.move_child(apercu, 1)
	var rail := ScrollContainer.new()
	rail.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	rail.follow_focus = true
	rail.custom_minimum_size.y = 129
	gauche.add_child(rail)
	doigt.railNatif("circuits", rail)
	gauche.move_child(rail, 2)
	var choix := HBoxContainer.new()
	rail.add_child(choix)
	var boutons: Array[Bouton] = []
	for c in circuits:
		var id := String(c.id)
		var b := _bouton(Paddock._coupe(String(c.nom).to_upper(), 13, 105), 110)
		b.custom_minimum_size.y = 115
		b.taille = 13
		b.ligne = 87
		b.fond = Paddock.PC_CREME; b.encre = Paddock.PC_ENCRE
		b.coupe = 0
		b.set_meta("circuit", id)
		b.set_meta("sel", id == choixCircuit)
		b.dessinPlus = Paddock._carteCircuitPC.bind(b)
		choix.add_child(b)
		if id == choixCircuit: rail.set_deferred("scroll_horizontal", maxi(0, boutons.size() - 1) * 114)
		boutons.append(b)
		b.pressed.connect(func():
			choixCircuit = id
			titreCircuit.text = String(infos[id].nom)
			apercu.queue_redraw()
			for autre in boutons:
				autre.set_meta("sel", autre == b)
				autre.queue_redraw())
	var ajoute := _bouton("+", 54)
	ajoute.set_meta("cle", "programme-ajouter")
	ajoute.taille = 40
	ajoute.tooltip_text = Textes.t("ajouterCircuit")
	ajoute.disabled = not editable or calendrier.size() >= 10
	apercu.add_child(ajoute)
	ajoute.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	ajoute.position -= Vector2(27, 27)
	ajoute.size = Vector2(54, 54)
	ajoute.pressed.connect(func():
		calendrier.append(choixCircuit)
		toursParManche.append(defaut)
		options.circuits = calendrier
		options.toursParManche = toursParManche
		_construit())
	droite.add_child(_texte("%s  ·  %d / 10" % [Textes.t("calendar"), calendrier.size()], 22))
	cartes = GridContainer.new()
	cartes.add_theme_constant_override("h_separation", 5)
	cartes.add_theme_constant_override("v_separation", 8)
	droite.add_child(cartes)
	for i in calendrier.size():
		var id: String = calendrier[i]
		var carte := VBoxContainer.new()
		carte.custom_minimum_size.x = 147
		cartes.add_child(carte)
		var titre := _bouton(Textes.t("roundLabel", i + 1), 0)
		titre.focus_mode = Control.FOCUS_NONE
		titre.mouse_filter = Control.MOUSE_FILTER_IGNORE
		carte.add_child(titre)
		var info: Dictionary = infos.get(id, {})
		_circuitCarte(carte, info, id, nuit)
		var changeTours := func(v): toursParManche[i] = int(v); options.toursParManche = toursParManche
		var champ: Control
		if Style.tactile(): champ = Style.menuNombre(1, 99, toursParManche[i], "", not editable, changeTours)
		else:
			var saisie := _champTour(toursParManche[i], editable)
			saisie.value_changed.connect(changeTours)
			champ = saisie
		champ.set_meta("cle", "programme-tours-%d" % i)
		_ligne(carte, Textes.t("lapsLabel"), 16).add_child(champ)
		var actions := HBoxContainer.new()
		carte.add_child(actions)
		for sens in [-1, 1]:
			var j: int = i + sens
			var deplace := _bouton("‹" if sens < 0 else "›", 31)
			deplace.set_meta("cle", "programme-deplace-%d-%d" % [i, sens])
			deplace.disabled = not editable or j < 0 or j >= calendrier.size()
			actions.add_child(deplace)
			deplace.pressed.connect(func():
				var tours := int(toursParManche[i])
				calendrier[i] = calendrier[j]; calendrier[j] = id
				toursParManche[i] = toursParManche[j]; toursParManche[j] = tours
				options.toursParManche = toursParManche
				_construit())
		var retire := _bouton("×", 31)
		retire.set_meta("cle", "programme-retire-%d" % i)
		retire.disabled = not editable
		actions.add_child(retire)
		retire.pressed.connect(func():
			calendrier.remove_at(i); toursParManche.remove_at(i)
			options.toursParManche = toursParManche
			_construit())
	var places: Dictionary = options.get("positions", {})
	var pilotes := Reseau.net.members().filter(func(m): return not m.q.get("spectator", false)).slice(0, Net.NET_SEATS) if enLigne else [{pid = "joueur", name = App.reglages.nom}]
	var maximum := int(App.reglages.adversaires)
	if enLigne:
		if table.get("mode") == "duel": maximum = pilotes.size()
		elif int(table.get("aiCount", -1)) >= 0: maximum = mini(12, pilotes.size() + int(table.aiCount))
		else:
			var cat := String(table.get("cat", "all"))
			if cat == "all" and not pilotes.is_empty() and pilotes[0].car is Dictionary:
				cat = String(Catalogue.voiture(pilotes[0].car.get("modelId", "")).get("cat", ""))
			maximum = 10
			for c in Catalogue.categories():
				if c.id == cat: maximum = int(c.get("drivers", 10))
			maximum = maxi(pilotes.size() + 1, mini(12, maximum))
	gauche.add_child(_texte(Textes.t("grilleDepart"), 22))
	for pilote in pilotes:
		var id: String = pilote.pid
		var champ := _selection(92)
		champ.add_item("Auto")
		for rang in range(1, maximum + 1): champ.add_item(str(rang))
		champ.select(clampi(int(places.get(id, 0)), 0, maximum))
		champ.disabled = not editable
		_ligne(gauche, pilote.name).add_child(champ)
		champ.item_selected.connect(func(i):
			if i == 0: places.erase(id)
			else:
				for autre in places.keys():
					if autre != id and int(places[autre]) == i: places.erase(autre)
				places[id] = i
			options.positions = places
			_construit()
		)
	_place()
	scroll.set_deferred("scroll_vertical", y)
	if not cle.is_empty() and not Style.tactile():
		for controle in liste.find_children("*", "Button", true, false):
			if controle.get_meta("cle", "") == cle and not controle.disabled:
				controle.grab_focus.call_deferred()
				return


func _circuitCarte(carte: VBoxContainer, info: Dictionary, id: String, nuit: bool) -> void:
	carte.add_child(_texte(String(info.get("nom", id)), 16))
	if info.is_empty(): return
	var art := Control.new()
	art.custom_minimum_size.y = 95
	carte.add_child(art)
	art.draw.connect(func(): Paddock.dessineCircuit(art, info, nuit))
