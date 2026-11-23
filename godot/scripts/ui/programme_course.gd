class_name ProgrammeCourse
extends Control

var options: Dictionary
var enLigne := false
var liste: VBoxContainer


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	enLigne = Reseau.net.state == "lobby"
	options = (Reseau.net.settings().get("programme", {}) if enLigne else App.reglages.get("programme", {})).duplicate(true)
	var cadre := PanelContainer.new()
	cadre.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, 16)
	var fond := StyleBoxFlat.new()
	fond.bg_color = Style.NUIT_PLEINE
	fond.content_margin_left = 16; fond.content_margin_right = 16
	fond.content_margin_top = 16; fond.content_margin_bottom = 16
	cadre.add_theme_stylebox_override("panel", fond)
	add_child(cadre)
	var page := VBoxContainer.new()
	page.add_theme_constant_override("separation", 12)
	cadre.add_child(page)
	var titre := Label.new()
	titre.text = Textes.t("programmeCourse")
	titre.add_theme_font_size_override("font_size", 28)
	page.add_child(titre)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	page.add_child(scroll)
	liste = VBoxContainer.new()
	liste.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	liste.add_theme_constant_override("separation", 9)
	scroll.add_child(liste)
	var retour := Button.new()
	retour.text = Textes.t("backWord")
	retour.pressed.connect(func(): App.aller("salon" if enLigne else "paddock"))
	page.add_child(retour)
	_construit()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"): App.aller("salon" if enLigne else "paddock")


func _ligne(nom: String) -> HBoxContainer:
	var ligne := HBoxContainer.new()
	liste.add_child(ligne)
	var label := Label.new()
	label.text = nom
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ligne.add_child(label)
	return ligne


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
	for phase in ["essais", "qualifications"]:
		var champ := SpinBox.new()
		champ.min_value = 0; champ.max_value = 60
		champ.suffix = " min"
		champ.value = int(options.get(phase, 0))
		champ.editable = editable
		champ.value_changed.connect(func(v): options[phase] = int(v); _sauve())
		_ligne(Textes.t(phase)).add_child(champ)
	var note := Label.new()
	note.text = Textes.t("programmeHint")
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	liste.add_child(note)
	var calendrier: Array = options.get("circuits", [])
	var ligne := _ligne(Textes.t("championnat"))
	var ajoute := OptionButton.new()
	ajoute.add_item(Textes.t("ajouterCircuit"))
	var circuits := Catalogue.circuits().filter(func(c): return c.id not in calendrier)
	for c in circuits: ajoute.add_item(str(c.nom))
	ajoute.disabled = not editable or circuits.is_empty()
	ligne.add_child(ajoute)
	ajoute.item_selected.connect(func(i):
		if i == 0: return
		calendrier.append(circuits[i - 1].id)
		options.circuits = calendrier
		_sauve()
		_construit()
	)
	if calendrier.is_empty():
		var id := String(table.get("trackId", App.reglages.circuit))
		_ligne(str(Paddock.infosCircuits().get(id, {}).get("nom", id)))
	for i in calendrier.size():
		var id: String = calendrier[i]
		var circuit := _ligne("%d. %s" % [i + 1, Paddock.infosCircuits().get(id, {}).get("nom", id)])
		var haut := Button.new()
		haut.text = "↑"
		haut.disabled = not editable or i == 0
		circuit.add_child(haut)
		haut.pressed.connect(func():
			calendrier[i] = calendrier[i - 1]; calendrier[i - 1] = id
			_sauve(); _construit()
		)
		var retire := Button.new()
		retire.text = "×"
		retire.disabled = not editable
		circuit.add_child(retire)
		retire.pressed.connect(func(): calendrier.remove_at(i); _sauve(); _construit())
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
	_ligne(Textes.t("grilleDepart"))
	for pilote in pilotes:
		var id: String = pilote.pid
		var champ := OptionButton.new()
		champ.add_item("Auto")
		for rang in range(1, maximum + 1): champ.add_item(str(rang))
		champ.select(clampi(int(places.get(id, 0)), 0, maximum))
		champ.disabled = not editable
		_ligne(pilote.name).add_child(champ)
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
