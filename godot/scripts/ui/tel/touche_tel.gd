## Un bouton des écrans du téléphone : une forme pleine (rectangle, pastille au bord droit penché, EN
## PISTE en parallélogramme, rond), ce qu'on pose dedans, et le clic des menus. Éteint, il pâlit comme
## dans la maquette ; choisi, il prend un bord rouge ; il peut porter une coche.
##
## C'est un conteneur, pas un Button de Godot : il prend la taille de ce qu'il porte (le Button calcule
## la sienne d'après son propre texte et ignore celle de ses enfants). Il se prend au relâcher, dans sa
## forme ; un doigt qui a glissé (Doigt._annuleAppui le relâche hors de lui) ne le prend pas.
class_name ToucheTel
extends MarginContainer

signal pressed

enum Forme { RECT, PASTILLE, ENPISTE, MODE, ROND }

var forme := Forme.RECT
var fond := Tel.ENCRE
var fondEteint := Color(0, 0, 0, 0)    # éteint : cette couleur si elle est donnée, sinon il pâlit
var bord := Color(0, 0, 0, 0)
var epaisseur := 0
var choisi := false                    # le bord rouge et son halo (.sel)
var coche := Color(0, 0, 0, 0)         # une coche à droite, de cette couleur
var signe := ""                        # moins, plus, gauche, droite, points : le signe dessiné au milieu
var couleurSigne := Tel.PAPIER
var disabled := false
var _appui := false


func _init(f := Tel.ENCRE) -> void:
	fond = f
	mouse_filter = Control.MOUSE_FILTER_STOP
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	focus_mode = Control.FOCUS_NONE
	marges(0, 0, 0, 0)


## Un bouton qui ne porte qu'un texte en capitales.
static func texteSeul(t: String, f: Color, encre: Color, taille: int, mini := Vector2.ZERO) -> ToucheTel:
	var b := ToucheTel.new(f)
	var l := Tel.titre(t, taille, encre)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	b.ajoute(l)
	b.custom_minimum_size = mini
	return b


## Un bouton qui ne porte qu'un signe dessiné (− + ‹ › ⋯).
static func signeSeul(s: String, f: Color, encre: Color, mini: Vector2) -> ToucheTel:
	var b := ToucheTel.new(f)
	b.signe = s
	b.couleurSigne = encre
	b.custom_minimum_size = mini
	return b


func marges(g: int, h: int, d: int, b: int) -> ToucheTel:
	add_theme_constant_override("margin_left", g)
	add_theme_constant_override("margin_top", h)
	add_theme_constant_override("margin_right", d)
	add_theme_constant_override("margin_bottom", b)
	return self


func ajoute(c: Control) -> ToucheTel:
	_ignore(c)
	add_child(c)
	return self


static func _ignore(c: Control) -> void:
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for e in c.get_children():
		if e is Control: _ignore(e)


## Éteint ou allumé : il ne se prend plus, et pâlit (à 30 %, comme les « − + » de la maquette).
func eteint(v: bool) -> ToucheTel:
	disabled = v
	if fondEteint.a == 0: modulate.a = 0.3 if v else 1.0
	mouse_default_cursor_shape = Control.CURSOR_ARROW if v else Control.CURSOR_POINTING_HAND
	queue_redraw()
	return self


func is_pressed() -> bool:
	return _appui


func _gui_input(e: InputEvent) -> void:
	if disabled: return
	if e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT:
		if e.pressed:
			_appui = true
			queue_redraw()
			accept_event()
		elif _appui:
			_appui = false
			queue_redraw()
			accept_event()
			if Rect2(Vector2.ZERO, size).has_point(e.position):
				App.clic()
				pressed.emit()


func _notification(what: int) -> void:
	if what == NOTIFICATION_MOUSE_EXIT_SELF and _appui and not Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		_appui = false
		queue_redraw()


func _forme() -> PackedVector2Array:
	var w := size.x
	var h := size.y
	match forme:
		Forme.PASTILLE: return PackedVector2Array([Vector2(0, 0), Vector2(w, 0), Vector2(w * 0.96, h), Vector2(0, h)])
		Forme.ENPISTE: return PackedVector2Array([Vector2(w * 0.05, 0), Vector2(w, 0), Vector2(w * 0.95, h), Vector2(0, h)])
		Forme.MODE: return PackedVector2Array([Vector2(0, 0), Vector2(w * 0.97, 0), Vector2(w, h), Vector2(0, h)])
	return PackedVector2Array([Vector2(0, 0), Vector2(w, 0), Vector2(w, h), Vector2(0, h)])


func _draw() -> void:
	var c := fond
	if disabled and fondEteint.a > 0: c = fondEteint
	elif _appui and c.a > 0: c = c.darkened(0.12) if c.v > 0.2 else c.lightened(0.12)
	elif _appui: c = Color(0, 0, 0, 0.08)
	if forme == Forme.ROND:
		var r := minf(size.x, size.y) / 2
		draw_circle(size / 2, r, c, true, -1, true)
		if epaisseur > 0: draw_arc(size / 2, r - epaisseur / 2.0, 0, TAU, 48, bord, epaisseur, true)
	else:
		var pts := _forme()
		if c.a > 0:
			Style.plein(self, pts, c)
			if forme != Forme.RECT: Style.bord(self, pts, c)
		var b := Tel.ROUGE if choisi else bord
		var e := 4 if choisi else epaisseur
		if e > 0 and b.a > 0: draw_rect(Rect2(Vector2(e, e) / 2.0, size - Vector2(e, e)), b, false, e)
	if signe != "": _signe()
	if coche.a > 0: Tel.coche(self, Vector2(size.x - 22, size.y / 2), coche)


func _signe() -> void:
	var m := size / 2
	var e := 2.6
	match signe:
		"moins": draw_line(m + Vector2(-8, 0), m + Vector2(8, 0), couleurSigne, e, true)
		"plus":
			draw_line(m + Vector2(-8, 0), m + Vector2(8, 0), couleurSigne, e, true)
			draw_line(m + Vector2(0, -8), m + Vector2(0, 8), couleurSigne, e, true)
		"gauche": draw_polyline(PackedVector2Array([m + Vector2(4, -9), m + Vector2(-4, 0), m + Vector2(4, 9)]), couleurSigne, e, true)
		"droite": draw_polyline(PackedVector2Array([m + Vector2(-4, -9), m + Vector2(4, 0), m + Vector2(-4, 9)]), couleurSigne, e, true)
		"points":
			for i in 3: draw_circle(m + Vector2((i - 1) * 7, 0), 2.6, couleurSigne, true, -1, true)
