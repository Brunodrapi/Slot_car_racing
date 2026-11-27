## La pause : reprendre, recommencer, quitter (js/ui.js).
class_name Pause
extends Control

var jeu
var boutons: Array[Bouton] = []
# Le mode RÉGLER (js/ui.js, pauseScreen et enregistreReglage) : le nom de la configuration, et l'enregistrer
var regNom: LineEdit
var regEnreg: Bouton
var regMessage := ""


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var choix := [[Textes.t("resume"), Color("#ffd400"), Style.ENCRE, func(): jeu.basculePause()],
			[Textes.t("restart"), Style.NUIT_PLEINE, Style.CREME, func(): jeu.recommence()],
			[Textes.t("quit"), Style.NUIT_PLEINE, Style.CREME, func(): jeu.quitte()]]
	if jeu.enLigne != null:
		# en ligne, on ne recommence pas seul : on reprend, ou on retourne à la table
		choix = [choix[0], [Textes.t("backToTable"), Style.NUIT_PLEINE, Style.CREME, func(): jeu.quitte()]]
	for d in choix:
		var b := Bouton.new(d[0], d[1], d[2], 24)
		b.centre = true
		b.pressed.connect(d[3])
		add_child(b)
		boutons.append(b)
	resized.connect(_place)
	_place()


func ouvre() -> void:
	regMessage = ""
	if jeu.course and jeu.course.reglage and regNom == null:
		regNom = LineEdit.new()
		regNom.max_length = 24
		regNom.placeholder_text = Textes.t("regDefaut")
		regNom.add_theme_font_size_override("font_size", 20)
		add_child(regNom)
		regEnreg = Bouton.new(Textes.t("regEnreg"), Style.ROUGE, Style.CREME, 20)
		regEnreg.centre = true
		regEnreg.pressed.connect(_enregistre)
		add_child(regEnreg)
	if regNom:
		var c := ReglageFrein.active(App.reglages.circuit, jeu.voitureId)
		regNom.text = String(c.get("nom", ""))
	_place()
	queue_redraw()
	boutons[0].grab_focus()


## Enregistrer le réglage en cours sous un nom : sans nom, celui de la configuration active, sinon
## « Par défaut ». Le même nom complète la configuration (un circuit à la fois) au lieu de la remplacer.
func _enregistre() -> void:
	var c := ReglageFrein.active(App.reglages.circuit, jeu.voitureId)
	var nom := regNom.text.strip_edges()
	if nom == "": nom = String(c.get("nom", "")) if not c.is_empty() else Textes.t("regDefautNom")
	ReglageFrein.pose(nom, App.reglages.circuit, jeu.voitureId, jeu.course.frein)
	App.sauve()
	regNom.text = nom
	regMessage = Textes.t("regFait", nom)
	queue_redraw()


func _place() -> void:
	var y0 := size.y * (0.24 if regNom else 0.38)
	for i in boutons.size():
		boutons[i].size = Vector2(260, 48)
		boutons[i].position = Vector2((size.x - 260) / 2, y0 + i * 58)
	if regNom:
		var y := y0 + boutons.size() * 58 + 62
		regNom.size = Vector2(360, 40)
		regNom.position = Vector2((size.x - 360) / 2, y)
		regEnreg.size = Vector2(360, 46)
		regEnreg.position = Vector2((size.x - 360) / 2, y + 50)


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.05, 0.06, 0.09, 0.62))
	var y0 := size.y * (0.24 if regNom else 0.38)
	# le logo du jeu (Style.LOGO), au-dessus du titre
	var logo := Style.tex(Style.LOGO)
	var lw := minf(300.0, size.x * 0.6)
	var lh := lw * logo.get_height() / logo.get_width()
	if y0 - 74 - lh > 8: draw_texture_rect(logo, Rect2((size.x - lw) / 2, y0 - 74 - lh, lw, lh), false)
	Style.texte(self, Textes.t("pause"), Vector2(0, y0 - 26), 44, Color.WHITE, HORIZONTAL_ALIGNMENT_CENTER, size.x)
	if regNom and jeu.course:
		var y := y0 + boutons.size() * 58 + 50
		var f := ("%.2f" % jeu.course.frein).replace(".", "," if Textes.langue() == "fr" else ".")
		Style.texte(self, Textes.t("regTitre") + " — ×" + f, Vector2(0, y), 24, Color("#ffd400"), HORIZONTAL_ALIGNMENT_CENTER, size.x)
		var w := minf(560, size.x - 40)
		var x := (size.x - w) / 2
		Style.texte(self, regMessage if regMessage != "" else Textes.t("regAide"), Vector2(x, y + 132), 15, Color("#5be07a") if regMessage != "" else Color("#cfd3dc"), HORIZONTAL_ALIGNMENT_CENTER, w)
		Style.texte(self, Textes.t("regPortee"), Vector2(x, y + 156), 13, Color(1, 1, 1, 0.55), HORIZONTAL_ALIGNMENT_CENTER, w)
