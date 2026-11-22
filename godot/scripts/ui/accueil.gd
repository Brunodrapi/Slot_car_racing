## L'accueil : l'affiche de SLOTLESS et les modes de jeu.
##
## « Le jeu devient SLOTLESS sur la future version Steam et iOS. » (Bruno) Les deux affiches portent déjà
## le titre et ses trois voitures, sur fond blanc : l'accueil ne pose plus de logo par-dessus, et les
## boutons se rangent à côté de l'affiche (paysage) ou dessous (portrait), pour ne cacher aucune voiture.
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
	logo = load("res://images/interface/logo-slotless.webp")
	var modes := [[Textes.t("quickRace"), Style.ROUGE, Style.CREME, "wheel.webp", "race"],
		[Textes.t("timeTrial"), Style.JAUNE, Style.ENCRE, "clock.webp", "timetrial"],
		[Textes.t("training"), Style.BLEU, Style.CREME, "plaque-l.svg", "training"],
		[Textes.t("multi"), Color("#12b974"), Color("#101b17"), "helmets.webp", "multi"]]   # .mode-card.mode-multi
	for m in modes:
		var b := Bouton.new(m[0], m[1], m[2], 34)
		b.icone = load("res://images/interface/" + m[3])
		b.avecDamier = true
		if m[4] == "multi": b.pressed.connect(func(): App.aller("salon"))
		else: b.pressed.connect(func(): App.reglages.mode = m[4]; App.sauve(); App.aller("paddock", { mode = m[4] }))
		add_child(b)
		boutons.append(b)
	var comment := Bouton.new(Textes.t("howto"), Style.PAPIER, Style.ENCRE, 22)
	comment.centre = true
	comment.pressed.connect(func(): App.aller("comment"))
	add_child(comment)
	boutons.append(comment)
	var reglages := Bouton.new(Textes.t("settings"), Style.NUIT_PLEINE, Style.CREME, 22)
	reglages.icone = load("res://images/interface/gear.webp")
	reglages.pressed.connect(func(): App.aller("reglages"))
	add_child(reglages)
	boutons.append(reglages)
	var pilote := Bouton.new(Textes.t("pilot", str(App.reglages.nom).to_upper()), Style.NUIT_PLEINE, Style.CREME, 22)
	pilote.icone = load("res://images/interface/pilot.webp")
	pilote.pressed.connect(_changeNom)
	add_child(pilote)
	boutons.append(pilote)
	var quitter := Bouton.new(Textes.t("quit"), Style.NUIT_PLEINE, Style.CREME, 22)
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
	nom.position = boutons[6].position + Vector2(140, 6)
	nom.size = Vector2(boutons[6].size.x - 150, boutons[6].size.y - 12)
	nom.grab_focus()
	nom.select_all()


func _valideNom(t: String) -> void:
	t = t.strip_edges()
	if t != "": App.reglages.nom = t
	App.sauve()
	nom.visible = false
	boutons[6].libelle(Textes.t("pilot", str(App.reglages.nom).to_upper()))
	boutons[6].grab_focus()


# La partie de chaque affiche qu'on montre : le titre et les voitures, sans le blanc du haut ni le bas
# des bandes (en pixels de l'image).
const CADRE_PC := Rect2(0, 56, 1448, 990)
const CADRE_MOBILE := Rect2(0, 360, 941, 990)
const BLANC := Color("#fefefe")
var _affiche := Rect2()          # où l'affiche se dessine


## La mise en page : en paysage, une colonne de boutons à gauche et l'affiche à droite ; en portrait,
## l'affiche en haut et les boutons dessous. L'affiche rapetisse s'il le faut, les boutons jamais.
func _mise() -> Dictionary:
	var portrait := size.x < size.y
	if not portrait:
		var k := size.y / 720.0
		var col := 390.0 * k                          # la colonne des boutons
		var cadre := CADRE_PC
		var ph := minf(size.y, (size.x - col) * cadre.size.y / cadre.size.x)
		var pw := ph * cadre.size.x / cadre.size.y
		# calée en bas : les bandes de la piste rejoignent le bord de l'écran
		_affiche = Rect2(size.x - pw - (size.x - col - pw) / 2, size.y - ph, pw, ph)
		var bloc := 4 * 72 * k + 4 * k + 2 * 60 * k
		return { portrait = false, k = k, x = 26 * k, w = col - 52 * k, y = (size.y - bloc) / 2 }
	var k2 := minf(size.x / 640.0, size.y / 1100.0)
	var bloc2 := 4 * 72 * k2 + 4 * k2 + 2 * 60 * k2
	var cadre2 := CADRE_MOBILE
	var ph2 := minf(size.x * cadre2.size.y / cadre2.size.x, size.y - bloc2 - 70 * k2)
	var pw2 := ph2 * cadre2.size.x / cadre2.size.y
	var haut := (size.y - ph2 - bloc2 - 24 * k2) / 2
	_affiche = Rect2((size.x - pw2) / 2, haut, pw2, ph2)
	var w2 := minf(560 * k2, size.x - 2 * 30 * k2)
	return { portrait = true, k = k2, x = (size.x - w2) / 2, w = w2, y = haut + ph2 + 24 * k2 }


func _place() -> void:
	var m := _mise()
	var k: float = m.k
	var x: float = m.x
	var w: float = m.w
	var y: float = m.y
	var h := 62 * k
	for i in 4:
		boutons[i].position = Vector2(x, y + i * (h + 10 * k))
		boutons[i].size = Vector2(w, h)
		boutons[i].taille = int(30 * k)
	y += 4 * (h + 10 * k) + 4 * k
	var hp := 50 * k
	boutons[4].position = Vector2(x, y); boutons[4].size = Vector2(w * 0.49, hp); boutons[4].taille = int(21 * k)
	boutons[5].position = Vector2(x + w * 0.51, y); boutons[5].size = Vector2(w * 0.49, hp); boutons[5].taille = int(21 * k)
	y += hp + 10 * k
	boutons[6].position = Vector2(x, y); boutons[6].size = Vector2(w * 0.68, hp); boutons[6].taille = int(21 * k)
	boutons[7].position = Vector2(x + w * 0.7, y); boutons[7].size = Vector2(w * 0.3, hp); boutons[7].taille = int(21 * k)
	queue_redraw()


func _draw() -> void:
	var m := _mise()
	var k: float = m.k
	draw_rect(Rect2(Vector2.ZERO, size), BLANC)
	draw_texture_rect_region(fondPortrait if m.portrait else fond, _affiche, CADRE_MOBILE if m.portrait else CADRE_PC)
	# en portrait, les bandes se fondent dans le blanc au-dessus des boutons au lieu de s'arrêter net
	if m.portrait:
		var a := _affiche
		var h := a.size.y * 0.16
		var t := Color(BLANC, 0.0)
		draw_polygon(PackedVector2Array([Vector2(a.position.x, a.end.y - h), Vector2(a.end.x, a.end.y - h), a.end, Vector2(a.position.x, a.end.y)]),
			PackedColorArray([t, t, BLANC, BLANC]))
	Style.texte(self, Textes.t("proto", [Catalogue.circuits().size(), Catalogue.donnees.voitures.size()]),
		Vector2(m.x, size.y - 14 * k), int(15 * k), Color(Style.ENCRE, 0.6))
