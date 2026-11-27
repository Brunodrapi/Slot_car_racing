## Un bouton du jeu web : un biseau de couleur, un texte en Racing, une icône, un damier en option.
## Il se prend à la souris, au doigt, au clavier et à la manette (le focus de Godot).
class_name Bouton
extends Button

var fond := Style.NUIT_PLEINE
var encre := Style.CREME
var taille := 22
var icone: Texture2D
var avecDamier := false
var choisi := false
var coupe := -1.0
var centre := false
var ligne := -1.0              # la ligne de base du texte ; au milieu par défaut
var dessinPlus: Callable       # ce que la carte dessine par-dessus (vignette, contour)


func _init(t := "", f := Style.NUIT_PLEINE, e := Style.CREME, sz := 22) -> void:
	text = ""
	set_meta("texte", t)
	fond = f; encre = e; taille = sz
	focus_mode = Control.FOCUS_ALL
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	mouse_entered.connect(queue_redraw)
	mouse_exited.connect(queue_redraw)
	focus_entered.connect(queue_redraw)
	focus_exited.connect(queue_redraw)
	button_down.connect(queue_redraw)
	button_up.connect(queue_redraw)
	# chaque bouton clique (App.clic), avant de faire ce qu'il fait
	pressed.connect(func(): App.clic())


func libelle(t: String) -> void:
	set_meta("texte", t)
	queue_redraw()


func _draw() -> void:
	var r := Rect2(Vector2.ZERO, size)
	var c := fond
	# au doigt, le survol et le focus restent sur ce qu'on a touché : pas d'éclaircissement ni de cadre
	var doigt := Style.tactile()
	if (is_hovered() or has_focus()) and not doigt: c = c.lightened(0.12)
	if button_pressed or (is_pressed() and toggle_mode): c = c.darkened(0.1)
	# éteint, il s'assombrit, sauf s'il pâlit (meta « fane » : le jeu web le rend à demi transparent)
	if disabled and not get_meta("fane", false): c = c.darkened(0.3)
	Style.biseau(self, r, c, coupe)
	if avecDamier:
		var dr := Rect2(size.x * 0.62, 0, size.x * 0.34, size.y)
		Style.damier(self, dr, 4, Color(0, 0, 0, 0.12), Color(1, 1, 1, 0.06))
	var x := 14.0
	if icone:
		var h := size.y * 0.66
		var w := h * icone.get_width() / icone.get_height()
		draw_texture_rect(icone, Rect2(x + 8, (size.y - h) / 2, w, h), false)
		x += w + 28
	if dessinPlus.is_valid(): dessinPlus.call()
	var t: String = get_meta("texte", "")
	# Un nom trop long se resserre au lieu de déborder de sa carte.
	var sz := taille
	var place := size.x - (8.0 if centre else x + 10)
	while sz > 10 and Style.largeur(t, sz) > place: sz -= 1
	var ty := size.y / 2 + sz * 0.36 if ligne < 0 else ligne
	if centre:
		Style.texte(self, t, Vector2(0, ty), sz, encre, HORIZONTAL_ALIGNMENT_CENTER, size.x)
	else:
		Style.texte(self, t, Vector2(x, ty), sz, encre)
	# un bouton qui dessine lui-même son cadre de focus (meta « sansCadre ») n'a pas celui-ci
	if (choisi or (has_focus() and not doigt)) and not get_meta("sansCadre", false):
		var o := Color(Style.LIGNE_JAUNE if has_focus() else Style.ROUGE)
		var cut := minf(9, size.y * .23) if coupe < 0 else coupe
		draw_polyline(PackedVector2Array([Vector2(cut, 1), Vector2(size.x - 1, 1), Vector2(size.x - cut, size.y - 1), Vector2(1, size.y - 1), Vector2(cut, 1)]), o, 3, true)
