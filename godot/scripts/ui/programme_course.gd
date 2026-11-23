class_name ProgrammeCourse
extends Control

var options: Dictionary
var enLigne := false
var liste: GridContainer
var cadre: PanelContainer
var fondPaddock: Texture2D

const VERT := Color("#8ae8ad")


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	enLigne = Reseau.net.state == "lobby"
	options = (Reseau.net.settings().get("programme", {}) if enLigne else App.reglages.get("programme", {})).duplicate(true)
	fondPaddock = Style.tex("res://images/interface/paddock.webp")
	cadre = PanelContainer.new()
	cadre.add_theme_stylebox_override("panel", _papier(Style.PAPIER, 14))
	add_child(cadre)
	var page := VBoxContainer.new()
	page.add_theme_constant_override("separation", 12)
	cadre.add_child(page)
	var titre := Bouton.new(Textes.t("programmeCourse"), Style.ROUGE, Style.CREME, 27)
	titre.custom_minimum_size.y = 52
	titre.focus_mode = Control.FOCUS_NONE
	titre.mouse_filter = Control.MOUSE_FILTER_IGNORE
	page.add_child(titre)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	page.add_child(scroll)
	liste = GridContainer.new()
	liste.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	liste.add_theme_constant_override("h_separation", 12)
	liste.add_theme_constant_override("v_separation", 10)
	scroll.add_child(liste)
	var retour := _bouton(Textes.t("backWord"), 116)
	retour.size_flags_horizontal = Control.SIZE_SHRINK_END
	retour.pressed.connect(_retour)
	page.add_child(retour)
	resized.connect(_place)
	liste.minimum_size_changed.connect(_place.call_deferred)
	_construit()
	_place()


func _place() -> void:
	var largeur := minf(960, maxf(0, size.x - 24))
	liste.columns = 2 if largeur >= 720 else 1
	var hauteur := minf(maxf(0, size.y - 24), liste.get_combined_minimum_size().y + 164)
	cadre.size = Vector2(largeur, hauteur)
	cadre.position = ((size - cadre.size) / 2).round()
	queue_redraw()


func _draw() -> void:
	Style.couvre(self, fondPaddock, Rect2(Vector2.ZERO, size), 0.5)
	draw_rect(Rect2(Vector2.ZERO, size), Color("#171b1980"))


func _retour() -> void:
	App.aller("salon" if enLigne else "paddock")


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"): _retour()


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


func _ligne(bloc: VBoxContainer, nom: String) -> HBoxContainer:
	var ligne := HBoxContainer.new()
	ligne.custom_minimum_size.y = 42
	ligne.add_theme_constant_override("separation", 8)
	bloc.add_child(ligne)
	var label := _texte(nom, 20)
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


func _sauve() -> void:
	if enLigne: Reseau.net.setTable({ programme = options.duplicate(true) })
	else:
		App.reglages.programme = options
		App.sauve()


func _construit() -> void:
	for enfant in liste.get_children():
		liste.remove_child(enfant)
		enfant.queue_free()
	var editable := not enLigne or Reseau.net.creator
	var table := Reseau.net.settings() if enLigne else {}
	var gauche := _bloc()
	var droite := _bloc()
	for phase in ["essais", "qualifications"]:
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
		champ.value_changed.connect(func(v): options[phase] = int(v); _sauve())
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
	droite.add_child(_texte(Textes.t("championnat"), 22))
	var ajoute := _selection(190)
	ajoute.add_item(Textes.t("ajouterCircuit"))
	var circuits := Catalogue.circuits().filter(func(c): return c.id not in calendrier)
	for c in circuits: ajoute.add_item(str(c.nom))
	ajoute.disabled = not editable or circuits.is_empty()
	ajoute.item_selected.connect(func(i):
		if i == 0: return
		calendrier.append(circuits[i - 1].id)
		options.circuits = calendrier
		_sauve()
		_construit()
	)
	if calendrier.is_empty():
		var id := String(table.get("trackId", App.reglages.circuit))
		_ligne(droite, str(Paddock.infosCircuits().get(id, {}).get("nom", id)))
	for i in calendrier.size():
		var id: String = calendrier[i]
		var circuit := _ligne(droite, "%d. %s" % [i + 1, Paddock.infosCircuits().get(id, {}).get("nom", id)])
		var haut := _bouton("↑", 42)
		haut.disabled = not editable or i == 0
		circuit.add_child(haut)
		haut.pressed.connect(func():
			calendrier[i] = calendrier[i - 1]; calendrier[i - 1] = id
			_sauve(); _construit()
		)
		var retire := _bouton("×", 42)
		retire.disabled = not editable
		circuit.add_child(retire)
		retire.pressed.connect(func(): calendrier.remove_at(i); _sauve(); _construit())
	droite.add_child(ajoute)
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
			_sauve()
			_construit()
		)
