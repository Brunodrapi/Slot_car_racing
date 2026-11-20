## Le dessin de la voiture, comme js/carart.js : l'ombre, les pneus (ceux de devant braquent),
## puis la carrosserie. Les cotes viennent du jeu web (donnees/voiture-*.json).
class_name VoitureVue
extends Node2D

var corps: Sprite2D
var ombre: Sprite2D
var cotes: Dictionary
var braquage := 0.0
var bande: Texture2D        # la bande de roulement : sombre aux bords, plus claire au milieu
var decalageOmbre := Vector2(0.25, 0.35)


func _init(chemin: String) -> void:
	cotes = JSON.parse_string(FileAccess.get_file_as_string(chemin))
	var w: float = cotes.w
	var h: float = cotes.h
	decalageOmbre = Vector2(cotes.ombre[0], cotes.ombre[1])
	ombre = Sprite2D.new()
	ombre.texture = load("res://images/%s-ombre.png" % cotes.id)
	ombre.scale = Vector2(w / ombre.texture.get_width(), h / ombre.texture.get_height())
	ombre.modulate = Color(1, 1, 1, cotes.ombreAlpha)
	corps = Sprite2D.new()
	corps.texture = load("res://images/%s.png" % cotes.id)
	corps.scale = Vector2(w / corps.texture.get_width(), h / corps.texture.get_height())
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.25, 0.75, 1.0])
	g.colors = PackedColorArray([Color("#101415"), Color("#303536"), Color("#303536"), Color("#101415")])
	var gt := GradientTexture1D.new()
	gt.gradient = g
	gt.width = 16
	bande = gt


func _ready() -> void:
	# L'ombre tombe du même côté dans le monde quel que soit le cap : elle est posée par le jeu,
	# hors de la voiture (voir place()), et dessinée avant elle.
	get_parent().add_child.call_deferred(ombre)
	get_parent().move_child.call_deferred(ombre, get_index())
	add_child(corps)
	corps.z_index = 1


func place(p: Vector2, cap: float, delta: float) -> void:
	position = p
	rotation = cap
	ombre.position = p + decalageOmbre
	ombre.rotation = cap
	var b := clampf(delta, -0.65, 0.65)
	if b != braquage:
		braquage = b
		queue_redraw()


func _draw() -> void:
	for r in cotes.arriere:
		_pneu(r, 0.0)
	if not cotes.dessus:
		for r in cotes.avant:
			_pneu(r, braquage)


func _pneu(r: Dictionary, angle: float) -> void:
	var L: float = r.longueur
	var W: float = r.largeur
	draw_set_transform(Vector2(r.x, r.y), angle)
	var rect := Rect2(-L / 2, -W / 2, L, W)
	draw_texture_rect(bande, rect, false)
	draw_rect(rect, Color("#080a0b"), false, minf(L, W) * 0.12)
	draw_set_transform(Vector2.ZERO, 0)
