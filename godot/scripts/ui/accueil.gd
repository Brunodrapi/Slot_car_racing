## L'accueil : l'illustration, le logo, et les modes de jeu (js/ui.js, l'écran home).
class_name Accueil
extends Control

var fond: Texture2D
var fondPortrait: Texture2D
var logo: Texture2D
var boutons: Array[Bouton] = []
var nom: LineEdit


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	fond = load("res://images/interface/accueil-pc.webp")
	fondPortrait = load("res://images/interface/accueil-mobile.webp")
	logo = load("res://images/interface/logo-grip.webp")
	var modes := [["COURSE RAPIDE", Style.ROUGE, Style.CREME, "wheel.webp", "race"],
		["CONTRE-LA-MONTRE", Style.JAUNE, Style.ENCRE, "clock.webp", "timetrial"],
		["ENTRAÎNEMENT", Style.BLEU, Style.CREME, "plaque-l.svg", "training"]]
	for m in modes:
		var b := Bouton.new(m[0], m[1], m[2], 34)
		b.icone = load("res://images/interface/" + m[3])
		b.avecDamier = true
		b.pressed.connect(func(): App.reglages.mode = m[4]; App.sauve(); App.aller("paddock", { mode = m[4] }))
		add_child(b)
		boutons.append(b)
	var comment := Bouton.new("COMMENT JOUER", Style.PAPIER, Style.ENCRE, 22)
	comment.centre = true
	comment.pressed.connect(func(): App.aller("comment"))
	add_child(comment)
	boutons.append(comment)
	var reglages := Bouton.new("RÉGLAGES", Style.NUIT_PLEINE, Style.CREME, 22)
	reglages.icone = load("res://images/interface/gear.webp")
	reglages.pressed.connect(func(): App.aller("reglages"))
	add_child(reglages)
	boutons.append(reglages)
	var pilote := Bouton.new("PILOTE : " + str(App.reglages.nom).to_upper(), Style.NUIT_PLEINE, Style.CREME, 22)
	pilote.icone = load("res://images/interface/pilot.webp")
	pilote.pressed.connect(_changeNom)
	add_child(pilote)
	boutons.append(pilote)
	var quitter := Bouton.new("QUITTER", Style.NUIT_PLEINE, Style.CREME, 22)
	quitter.centre = true
	quitter.pressed.connect(func(): get_tree().quit())
	quitter.visible = not OS.has_feature("web") and not OS.has_feature("mobile")
	add_child(quitter)
	boutons.append(quitter)
	nom = LineEdit.new()
	nom.visible = false
	nom.max_length = 16
	nom.add_theme_font_size_override("font_size", 26)
	nom.text_submitted.connect(func(t): _valideNom(t))
	add_child(nom)
	resized.connect(_place)
	_place()
	boutons[0].grab_focus.call_deferred()


func _changeNom() -> void:
	nom.text = App.reglages.nom
	nom.visible = true
	nom.position = boutons[5].position + Vector2(140, 6)
	nom.size = Vector2(boutons[5].size.x - 150, boutons[5].size.y - 12)
	nom.grab_focus()
	nom.select_all()


func _valideNom(t: String) -> void:
	t = t.strip_edges()
	if t != "": App.reglages.nom = t
	App.sauve()
	nom.visible = false
	boutons[5].libelle("PILOTE : " + str(App.reglages.nom).to_upper())
	boutons[5].grab_focus()


func _place() -> void:
	var portrait := size.x < size.y
	var k := minf(size.x / 1280.0, size.y / 720.0) if not portrait else size.x / 640.0
	var x := 52 * k
	var w := minf(540 * k, size.x - 2 * x)
	var y := (180 * k) if not portrait else size.y * 0.36
	var h := 70 * k
	for i in 3:
		boutons[i].position = Vector2(x, y + i * (h + 12 * k))
		boutons[i].size = Vector2(w, h)
		boutons[i].taille = int(32 * k)
	y += 3 * (h + 12 * k) + 4 * k
	var hp := 52 * k
	boutons[3].position = Vector2(x, y); boutons[3].size = Vector2(w * 0.49, hp); boutons[3].taille = int(21 * k)
	boutons[4].position = Vector2(x + w * 0.51, y); boutons[4].size = Vector2(w * 0.49, hp); boutons[4].taille = int(21 * k)
	y += hp + 10 * k
	boutons[5].position = Vector2(x, y); boutons[5].size = Vector2(w * 0.68, hp); boutons[5].taille = int(21 * k)
	boutons[6].position = Vector2(x + w * 0.7, y); boutons[6].size = Vector2(w * 0.3, hp); boutons[6].taille = int(21 * k)
	queue_redraw()


func _draw() -> void:
	var portrait := size.x < size.y
	Style.couvre(self, fondPortrait if portrait else fond, Rect2(Vector2.ZERO, size), 0.5)
	var k := minf(size.x / 1280.0, size.y / 720.0) if not portrait else size.x / 640.0
	var lw := 560 * k
	draw_texture_rect(logo, Rect2(60 * k, 14 * k, lw, lw * logo.get_height() / logo.get_width()), false)
	Style.texte(self, "Prototype Godot · %d circuits · %d voitures" % [Catalogue.circuits().size(), Catalogue.donnees.voitures.size()],
		Vector2(52 * k, size.y - 18 * k), int(15 * k), Color(1, 1, 1, 0.8))
