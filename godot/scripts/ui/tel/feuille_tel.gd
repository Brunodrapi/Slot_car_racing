## Une feuille qui monte du bas (maquette, .feuille) : le voile derrière, la prise, le titre et
## « Fermer », le corps qui défile. Elle se ferme par « Fermer », d'un geste vers le bas sur sa prise ou
## son titre, en touchant le voile, ou par le retour de l'appareil. « haute » prend tout l'écran (moins
## 14 points), sinon elle prend la hauteur de ce qu'elle porte.
class_name FeuilleTel
extends Control

var ecran: EcranTel
var titre := ""
var construire: Callable          # construire.call(corps : VBoxContainer)
var haute := true
var voile: ColorRect
var panneau: Control
var corps: DefileTel
var _cible := 0.0
var _glisse := false
var _dy := 0.0
var _ferme := false


func _init(e: EcranTel, t: String, c: Callable, h: bool) -> void:
	ecran = e
	titre = t
	construire = c
	haute = h
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _ready() -> void:
	voile = ColorRect.new()
	voile.color = Color(0, 0, 0, 0.6)
	voile.modulate.a = 0.0
	voile.mouse_filter = Control.MOUSE_FILTER_STOP
	voile.gui_input.connect(func(ev):
		if ev is InputEventMouseButton and ev.button_index == MOUSE_BUTTON_LEFT and not ev.pressed: ferme())
	add_child(voile)
	panneau = Control.new()
	panneau.mouse_filter = Control.MOUSE_FILTER_STOP
	panneau.draw.connect(_dessinePanneau)
	add_child(panneau)
	var col := Tel.boite(true, 0)
	col.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	col.mouse_filter = Control.MOUSE_FILTER_PASS
	panneau.add_child(col)
	# la prise et le titre : on les tire vers le bas pour fermer
	var prise := Control.new()
	prise.custom_minimum_size.y = 15
	prise.mouse_filter = Control.MOUSE_FILTER_STOP
	prise.draw.connect(func():
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color("#9b917a")
		sb.set_corner_radius_all(3)
		prise.draw_style_box(sb, Rect2(prise.size.x / 2 - 22, 8, 44, 5)))
	prise.gui_input.connect(_tire)
	col.add_child(prise)
	var tete := Tel.boite(false, 8)
	var nom := Tel.titre(titre, 26)
	nom.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	nom.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	tete.add_child(nom)
	var fermer := ToucheTel.texteSeul(Tel.t("fermer"), Tel.ENCRE, Tel.PAPIER, 16, Vector2(0, 44))
	fermer.marges(14, 0, 14, 0)
	fermer.pressed.connect(ferme)
	tete.add_child(fermer)
	var zoneTete := Tel.marge(tete, 12, 2, 12, 8)
	zoneTete.mouse_filter = Control.MOUSE_FILTER_STOP
	zoneTete.gui_input.connect(_tire)
	col.add_child(zoneTete)
	corps = DefileTel.new(10, 12, 0, 12, 16)
	col.add_child(corps)
	_remplit()
	_place()
	panneau.position.y = ecran.H
	_ouvre.call_deferred()


func _dessinePanneau() -> void:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Tel.PAPIER
	sb.corner_radius_top_left = 18
	sb.corner_radius_top_right = 18
	sb.shadow_color = Color(0, 0, 0, 0.35)
	sb.shadow_size = 16
	panneau.draw_style_box(sb, Rect2(Vector2.ZERO, panneau.size))


func _remplit() -> void:
	var y := corps.haut
	for c in corps.contenu.get_children():
		corps.contenu.remove_child(c)
		c.queue_free()
	construire.call(corps.contenu)
	corps.reprend(y)


## Refaite à sa place (une valeur a changé), le défilement gardé.
func rafraichit() -> void:
	if _ferme: return
	_remplit()
	_place.call_deferred()


func hauteur() -> float:
	var maxi := ecran.H - 14
	if haute: return maxi
	return minf(maxi, 15 + 54 + corps.hauteurContenu() + 2)


func _place() -> void:
	size = ecran.cadre.size
	voile.size = size
	var h := hauteur()
	panneau.size = Vector2(minf(size.x, 480), h)
	panneau.position.x = (size.x - panneau.size.x) / 2
	_cible = size.y - h
	if not _glisse and not _ferme and voile.modulate.a >= 1.0: panneau.position.y = _cible
	panneau.queue_redraw()


func _ouvre() -> void:
	_place()
	var tw := create_tween().set_parallel(true)
	tw.tween_property(panneau, "position:y", _cible, 0.26).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_property(voile, "modulate:a", 1.0, 0.2)


func ferme() -> void:
	if _ferme: return
	_ferme = true
	ecran.oublie(self)
	var tw := create_tween().set_parallel(true)
	tw.tween_property(panneau, "position:y", size.y, 0.22).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	tw.tween_property(voile, "modulate:a", 0.0, 0.2)
	tw.chain().tween_callback(queue_free)


## Le geste vers le bas, sur la prise ou le titre.
func _tire(ev: InputEvent) -> void:
	if _ferme: return
	if ev is InputEventMouseButton and ev.button_index == MOUSE_BUTTON_LEFT:
		if ev.pressed:
			_glisse = true
			_dy = 0.0
		elif _glisse:
			_glisse = false
			if _dy > 90: ferme()
			else: create_tween().tween_property(panneau, "position:y", _cible, 0.18)
	elif ev is InputEventMouseMotion and _glisse:
		_dy = maxf(0.0, _dy + ev.relative.y)
		panneau.position.y = _cible + _dy
