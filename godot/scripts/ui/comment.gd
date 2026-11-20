## Comment jouer : les trois gestes du jeu (js/ui.js, howtoScreen), sur ce qu'on tient en main.
class_name CommentJouer
extends Control

var fond: Texture2D
var boutons: Array[Bouton] = []
var tactile := false


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	fond = load("res://images/interface/accueil-pc.webp")
	tactile = OS.has_feature("mobile") or OS.has_feature("web_android") or OS.has_feature("web_ios")
	for d in [["← RETOUR", Style.NUIT_PLEINE, func(): App.aller("accueil")], ["EN PISTE !  →", Style.ROUGE, func(): App.aller("paddock", { mode = "training" })]]:
		var b := Bouton.new(d[0], d[1], Style.CREME, 26)
		b.centre = true
		b.pressed.connect(d[2])
		add_child(b)
		boutons.append(b)
	resized.connect(_place)
	_place()
	boutons[1].grab_focus.call_deferred()


func _unhandled_input(e: InputEvent) -> void:
	if e.is_action_pressed("ui_cancel"): App.aller("accueil")


func _place() -> void:
	boutons[0].size = Vector2(180, 56); boutons[0].position = Vector2(24, size.y - 80)
	boutons[1].size = Vector2(240, 56); boutons[1].position = Vector2(size.x - 264, size.y - 80)
	queue_redraw()


func _draw() -> void:
	Style.couvre(self, fond, Rect2(Vector2.ZERO, size), 0.5)
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.06, 0.07, 0.08, 0.6))
	Style.texte(self, "COMMENT JOUER", Vector2(0, 74), 52, Style.CREME, HORIZONTAL_ALIGNMENT_CENTER, size.x)
	var gestes := [
		["1  LES GAZ", "Tiens le doigt posé, ailleurs que sur le levier." if tactile else "Tiens Espace enfoncée (ou RT à la manette).",
			"Lâche avant le virage : la voiture freine seule. Trop vite, elle glisse et sort."],
		["2  LA LIGNE", "Glisse le levier à gauche de l'écran." if tactile else "Flèches haut et bas (ou le stick).",
			"Idéale au milieu, jaune à l'extérieur, bleue à l'intérieur : pour doubler ou se protéger."],
		["3  LE GRIP", "La pastille GRIP dit ce que font les pneus.",
			"Bleu, tout va bien ; vert, ça travaille ; jaune, ça glisse ; violet puis rouge, tu perds la voiture."],
	]
	var portrait := size.x < size.y
	var n := gestes.size()
	for i in n:
		var r: Rect2
		if portrait: r = Rect2(24, 110 + i * (size.y - 230) / n, size.x - 48, (size.y - 230) / n - 14)
		else: r = Rect2(24 + i * (size.x - 48) / n, 120, (size.x - 48) / n - 16, size.y - 230)
		draw_rect(r, Style.PAPIER)
		Style.biseau(self, Rect2(r.position.x, r.position.y, r.size.x, 54), [Style.ROUGE, Style.JAUNE, Style.BLEU][i], 0)
		Style.texte(self, gestes[i][0], r.position + Vector2(16, 40), 32, Style.CREME if i != 1 else Style.ENCRE)
		_paragraphe(gestes[i][1], r.position + Vector2(16, 96), r.size.x - 32, 24, Style.ENCRE)
		_paragraphe(gestes[i][2], r.position + Vector2(16, 200), r.size.x - 32, 20, Color(Style.ENCRE, 0.8))


func _paragraphe(t: String, p: Vector2, largeur: float, taille: int, c: Color) -> void:
	draw_multiline_string(Style.racing(), p, t, HORIZONTAL_ALIGNMENT_LEFT, largeur, taille, -1, c)
