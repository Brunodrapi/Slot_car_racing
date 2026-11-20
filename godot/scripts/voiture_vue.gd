## Le dessin d'une voiture, comme js/carart.js : l'ombre, les pneus (ceux de devant braquent), les
## bras de suspension des monoplaces, puis la carrosserie. Les cotes viennent du jeu web
## (donnees/dessins.json, godot/outils/capture-voitures.js).
class_name VoitureVue
extends Node2D

var corps: Sprite2D
var ombre: Sprite2D
var cotes: Dictionary
var braquage := 0.0
var bande: Texture2D
var decalageOmbre := Vector2(0.25, 0.35)
var avant: Node2D          # les roues de devant quand elles passent par-dessus la carrosserie


func _init(d: Dictionary) -> void:
	cotes = d
	var w: float = d.w
	var h: float = d.h
	decalageOmbre = Vector2(d.ombre_[0], d.ombre_[1])
	ombre = Sprite2D.new()
	ombre.texture = load("res://images/voitures/%s-%d-ombre.png" % [d.id, d.livree])
	ombre.scale = Vector2(w / ombre.texture.get_width(), h / ombre.texture.get_height())
	ombre.modulate = Color(1, 1, 1, d.ombreAlpha)
	corps = Sprite2D.new()
	corps.texture = load("res://images/voitures/%s-%d.png" % [d.id, d.livree])
	corps.scale = Vector2(w / corps.texture.get_width(), h / corps.texture.get_height())
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.25, 0.75, 1.0])
	g.colors = PackedColorArray([Color("#101415"), Color("#303536"), Color("#303536"), Color("#101415")])
	var gt := GradientTexture1D.new()
	gt.gradient = g
	gt.width = 16
	bande = gt


func _ready() -> void:
	get_parent().add_child.call_deferred(ombre)
	add_child(corps)
	if cotes.dessus:
		avant = Node2D.new()
		avant.draw.connect(_roues.bind(avant, true))
		add_child(avant)


func place(p: Vector2, cap: float, delta: float, z: int) -> void:
	position = p
	rotation = cap
	z_index = z
	ombre.z_index = z
	ombre.position = p + decalageOmbre
	ombre.rotation = cap
	var b := clampf(delta, -0.65, 0.65)
	if absf(b - braquage) > 0.004:
		braquage = b
		queue_redraw()
		if avant: avant.queue_redraw()


func _draw() -> void:
	_roues(self, false)


func _roues(ci: CanvasItem, seulementAvant: bool) -> void:
	if not seulementAvant:
		for r in cotes.arriere: _pneu(ci, r, 0.0)
	if seulementAvant or not cotes.dessus:
		for r in cotes.avant: _pneu(ci, r, braquage)
	if not seulementAvant:
		for q in cotes.get("suspension", []):
			ci.draw_colored_polygon(PackedVector2Array([Vector2(q[0], q[1]), Vector2(q[2], q[3]), Vector2(q[4], q[5]), Vector2(q[6], q[7])]), Color("#43494b"))


func _pneu(ci: CanvasItem, r: Dictionary, angle: float) -> void:
	var L: float = r.longueur
	var W: float = r.largeur
	ci.draw_set_transform(Vector2(r.x, r.y), angle)
	var rect := Rect2(-L / 2, -W / 2, L, W)
	ci.draw_texture_rect(bande, rect, false)
	ci.draw_rect(rect, Color("#080a0b"), false, minf(L, W) * 0.12)
	ci.draw_set_transform(Vector2.ZERO, 0)
