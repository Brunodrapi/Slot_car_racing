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
var nuit := false
var stops: Array[Sprite2D] = []
# La tôle froissée (DegatsVue) : une voiture intacte n'a pas de maillage et se dessine comme avant.
var tole: DegatsVue.Carrosserie = null
var maille: Polygon2D = null        # la caisse tendue sur l'anneau, avec ses plis
var ombreMaille: Polygon2D = null
var peau: SubViewport = null        # la copie du dessin où se peignent les plis
var traits: Traits = null
var _version := -1
var _image: Image = null
var _stopsQ: Array = []             # la place de chaque feu stop, au repos
# Le scotch des arrêts au stand (Mecanos) : les patchs restent d'un arrêt à l'autre (vingt au plus) ;
# ceux de l'arrêt en cours se déroulent à mesure (`scotch`, de 0 à 1 devant et derrière).
var patchs: Array = []
var scotch := {}
var scotchNoeud: Node2D


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
	# Les feux stop du jour (js/render.js, _feuxStop) : la lueur rouge derrière, au freinage. La
	# nuit les remplace par ses propres feux arrière.
	var F: Dictionary = cotes.get("feuStop", { long = 3.2, demi = 0.95 })
	if not nuit:
		Nuit._textures()
		for q in cotes.get("feux", {}).get("arriere", []):
			var s := Sprite2D.new()
			s.texture = Nuit.tTail
			s.centered = false
			s.offset = Vector2(0, -Nuit.tTail.get_height() / 2.0)
			s.scale = Vector2(F.long / Nuit.tTail.get_width(), F.demi * 2 / Nuit.tTail.get_height())
			s.position = Vector2(q.x, q.y)
			s.rotation = PI - signf(q.y) * .06
			s.modulate = Color(1, 1, 1, .62)
			s.visible = false
			s.show_behind_parent = true
			add_child(s)
			stops.append(s)
			_stopsQ.append(Vector2(q.x, q.y))
	if cotes.dessus:
		avant = Node2D.new()
		avant.draw.connect(_roues.bind(avant, true))
		add_child(avant)
	scotchNoeud = Node2D.new()
	scotchNoeud.draw.connect(_scotch)
	add_child(scotchNoeud)


func freine(oui: bool) -> void:
	for i in stops.size():
		# un feu qui a reculé de plus de sept centimètres est cassé
		stops[i].visible = oui and (tole == null or decale(_stopsQ[i]).length() <= 0.07)


func place(p: Vector2, cap: float, delta: float, z: int) -> void:
	position = p
	rotation = cap
	z_index = z
	# L'ombre se pose un cran SOUS les voitures : au même cran, ajoutée après la voiture, elle se
	# dessinait par-dessus et couvrait le toit. Un cran plus bas, elle reste au-dessus du décor
	# (ou du tablier d'un croisement), qui se dessine avant elle.
	ombre.z_index = z - 1
	ombre.position = p + decalageOmbre
	ombre.rotation = cap
	if ombreMaille:
		ombreMaille.z_index = z - 1
		ombreMaille.position = ombre.position
		ombreMaille.rotation = cap
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
	# une roue près d'un coin enfoncé recule avec lui
	var o := decale(Vector2(r.x, r.y)) if tole else Vector2.ZERO
	ci.draw_set_transform(Vector2(r.x, r.y) + o, angle)
	var rect := Rect2(-L / 2, -W / 2, L, W)
	ci.draw_texture_rect(bande, rect, false)
	ci.draw_rect(rect, Color("#080a0b"), false, minf(L, W) * 0.12)
	ci.draw_set_transform(Vector2.ZERO, 0)



# ---------- la tôle froissée (js/degats.js) ----------

## L'épave qui s'efface : la voiture et son ombre ensemble.
func voile(a: float) -> void:
	visible = a > 0
	modulate.a = a
	ombre.visible = a > 0 and ombreMaille == null
	ombre.modulate.a = float(cotes.ombreAlpha) * a
	if ombreMaille:
		ombreMaille.visible = a > 0
		ombreMaille.modulate.a = float(cotes.ombreAlpha) * a


## Le déplacement d'un point du dessin sous la tôle froissée.
func decale(q: Vector2) -> Vector2:
	return tole.decale(q.x, q.y) if tole and tole.touche else Vector2.ZERO


## Un feu de la voiture, là où la tôle l'a poussé, ou vide s'il est cassé (recul de plus de 7 cm,
## ou épave qu'on enlève).
func feu(q: Dictionary, car: Voiture) -> Dictionary:
	if tole == null or not tole.touche: return q
	var o := decale(Vector2(q.x, q.y))
	if o.length() > 0.07 or (car.abandon and car.abandonT > 6): return {}
	var r := q.duplicate()
	r.x = q.x + o.x; r.y = q.y + o.y
	return r


## La couleur de la carrosserie juste à l'intérieur du point touché : celle des débris.
func teinte(px: float, py: float, nx: float, ny: float) -> Color:
	image()
	var defaut := Color("#8a8f96")
	if _image == null: return defaut
	var k := _image.get_width() / float(cotes.w)
	var u := clampi(roundi((px + nx * 0.35 + cotes.w / 2.0) * k), 1, _image.get_width() - 2)
	var v := clampi(roundi((py + ny * 0.35 + cotes.h / 2.0) * _image.get_height() / float(cotes.h)), 1, _image.get_height() - 2)
	var r := 0.0
	var g := 0.0
	var b := 0.0
	var n := 0
	for du in [-1, 0, 1]:
		for dv in [-1, 0, 1]:
			var c := _image.get_pixel(u + du, v + dv)
			if c.a > 0.5: r += c.r; g += c.g; b += c.b; n += 1
	return Color(r / n, g / n, b / n) if n else defaut


## Un choc qui cabosse : la tôle s'enfonce, et un creux, des plis et une éraflure se peignent sur
## la copie du dessin de la voiture.
func cabosse(px: float, py: float, nx: float, ny: float, force: float, epave: bool, pitsDone: int) -> void:
	if tole == null:
		tole = DegatsVue.Carrosserie.new(float(cotes.w), float(cotes.h))
		tole.pitsVu = pitsDone
	tole.choc(px, py, nx, ny, force, epave)
	_peau().marque(px, py, nx, ny, force, epave)
	peau.render_target_update_mode = SubViewport.UPDATE_ONCE


## L'image du dessin propre, lue une fois (teinte des débris, place du scotch).
func image() -> Image:
	if _image == null:
		_image = corps.texture.get_image()
		if _image and _image.is_compressed(): _image.decompress()
	return _image


## LES PATCHS DE SCOTCH d'un arrêt : les zones vraiment enfoncées (les points de vie) reçoivent un
## patch, deux si elles le sont à fond, trois au plus par arrêt ; chacun éprouvé sur le dessin
## (ni vitre ni roue). Ceux de l'avant posés par le mécanicien du nez, l'arrière par l'autre.
func patchsNeufs(car: Voiture) -> void:
	var zones := car.enfoncement
	var n := zones.size()
	var mx := 0.0
	for z in zones: mx = maxf(mx, z)
	var touchees := []
	for k in n:
		if zones[k] > 0.03 and zones[k] >= mx * 0.6: touchees.append(k)
	touchees.sort_custom(func(a, b): return zones[a] > zones[b])
	var neufs := []
	var place := 3
	var L: float = cotes.w / 2.0
	var W: float = cotes.h / 2.0
	for k in touchees:
		var nb := mini(place, 2 if zones[k] > 0.2 else 1)
		for i in nb:
			var q := Mecanos.tirePatch(L, W, k, n, _accepte)
			if not q.is_empty(): neufs.append(q); place -= 1
		if place <= 0: break
	for cote in [true, false]:
		var liste := neufs.filter(func(q): return q.avant == cote)
		for i in liste.size():
			liste[i].seuil = (i + 1) / float(liste.size()); liste[i].debut = i / float(liste.size())
	patchs.append_array(neufs)
	if patchs.size() > 20: patchs = patchs.slice(patchs.size() - 20)
	scotchNoeud.queue_redraw()


## Un patch convient si toutes ses bandes tombent sur la voiture, et pas sur une vitre ni une roue.
func _accepte(q: Dictionary) -> bool:
	var im := image()
	if im == null: return true
	for b in q.bandes:
		var c := cos(b.a)
		var s := sin(b.a)
		for t in [-0.5, -0.25, 0.0, 0.25, 0.5]:
			for o in [-0.45, 0.45]:
				var x: float = q.x + b.dx + c * t * b.l - s * o * b.w
				var y: float = q.y + b.dy + s * t * b.l + c * o * b.w
				if not _surCarrosserie(im, x, y): return false
	return true


func _surCarrosserie(im: Image, x: float, y: float) -> bool:
	var w: float = cotes.w
	var h: float = cotes.h
	var iw := im.get_width()
	var ih := im.get_height()
	var u := roundi((x / w + 0.5) * (iw - 1))
	var v := roundi((y / h + 0.5) * (ih - 1))
	if u < 0 or v < 0 or u >= iw or v >= ih: return false
	if im.get_pixel(u, v).a < 200 / 255.0: return false
	# une SURFACE sombre, pas un trait : neuf points autour, sombre si six le sont
	var sombres := 0
	for du in [-3, 0, 3]:
		for dv in [-3, 0, 3]:
			var c := im.get_pixel(clampi(u + du, 0, iw - 1), clampi(v + dv, 0, ih - 1))
			if c.a < 200 / 255.0 or 0.3 * c.r + 0.59 * c.g + 0.11 * c.b < 75 / 255.0: sombres += 1
	if sombres < 6: return true
	var fx := absf(x / (w / 2))
	var fy := absf(y / (h / 2))
	if fx < 0.62 and fy < 0.8: return false        # une vitre
	if fy > 0.45 and fx > 0.3 and fx < 0.88: return false   # un pneu
	return true


## Le scotch sur la carrosserie (render.js, _scotch) : ceux de l'arrêt en cours apparaissent un à un ;
## sur une tôle encore cabossée, le patch suit la bosse.
func _scotch() -> void:
	for q in patchs:
		var f := 1.0
		if q.cetArret:
			var p: float = scotch.get("avant" if q.avant else "arriere", 1.0)
			f = clampf((p - q.debut) / maxf(1e-6, q.seuil - q.debut), 0, 1)
		if f <= 0: continue
		var o := decale(Vector2(q.x, q.y))
		var n: int = q.bandes.size()
		for i in n:
			var b: Dictionary = q.bandes[i]
			var fb := clampf(f * n - i, 0, 1)
			if fb > 0: _bande(Vector2(q.x + o.x + b.dx, q.y + o.y + b.dy), b, fb)
	scotchNoeud.draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)


## Une bande de scotch : un ruban gris aux bouts déchirés, un contour sombre, un reflet clair en
## haut, une ombre en bas, un pli ; déroulée à `f` depuis son bout gauche.
func _bande(c: Vector2, b: Dictionary, f: float) -> void:
	var g := scotchNoeud
	var l: float = b.l
	var h: float = b.w
	var u := h / 9
	var r: Array = b.bouts
	var fin := -l / 2 + l * f
	g.draw_set_transform(c, b.a, Vector2.ONE)
	var bord := PackedVector2Array([Vector2(-l / 2 + r[0] * u, -h / 2 + u), Vector2(-l / 2 + 2 * u, -h / 2),
		Vector2(l / 2 - (0.5 + r[1]) * u, -h / 2), Vector2(l / 2 - (1 + 2 * r[2]) * u, -h / 2 + (1 + 2 * r[3]) * u),
		Vector2(l / 2, -h / 2 + (3 + 2 * r[4]) * u), Vector2(l / 2 - u, h / 2),
		Vector2(-l / 2 + u, h / 2), Vector2(-l / 2 + (1 + 2 * r[5]) * u, h / 2 - 2 * u)])
	if f < 1:
		for i in bord.size(): bord[i].x = minf(bord[i].x, fin)
	g.draw_colored_polygon(bord, b.teinte)
	var ferme := bord.duplicate()
	ferme.append(bord[0])
	g.draw_polyline(ferme, Color("#303436"), 1.5 * u)
	var x1 := minf(l / 2 - 2 * u, fin)
	if x1 > -l / 2 + 2 * u:
		g.draw_rect(Rect2(-l / 2 + 2 * u, -h / 2 + u, x1 - (-l / 2 + 2 * u), 2 * u), Color(1, 1, 1, 0.32))
		g.draw_rect(Rect2(-l / 2 + 2 * u, h / 2 - 2 * u, x1 - (-l / 2 + 2 * u), 1.5 * u), Color(0, 0, 0, 0.2))
	var p: float = -l / 2 + l * b.pli
	if p + l * 0.07 < fin: g.draw_line(Vector2(p, -h / 2 + u), Vector2(p + l * 0.07, h / 2 - u), Color(1, 1, 1, 0.3), u)


## Réparée : la tôle repart neuve, plis compris.
func toleNeuve() -> void:
	tole = null
	_version = -1
	for n in [maille, ombreMaille, peau]:
		if n: n.queue_free()
	maille = null; ombreMaille = null; peau = null; traits = null
	corps.visible = true
	ombre.visible = true
	queue_redraw()
	if avant: avant.queue_redraw()


## Le maillage suit la tôle : retendu seulement quand elle a bougé.
func majTole() -> void:
	if tole == null or not tole.touche or tole.version == _version: return
	_version = tole.version
	if maille == null:
		maille = Polygon2D.new()
		maille.texture = peau.get_texture()
		maille.uv = tole.uv(corps.texture.get_width(), corps.texture.get_height())
		maille.polygons = tole.polygones()
		maille.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
		add_child(maille)
		move_child(maille, corps.get_index())
		corps.visible = false
		ombreMaille = Polygon2D.new()
		ombreMaille.texture = ombre.texture
		ombreMaille.uv = tole.uv(ombre.texture.get_width(), ombre.texture.get_height())
		ombreMaille.polygons = tole.polygones()
		ombreMaille.modulate = ombre.modulate
		ombreMaille.position = ombre.position
		ombreMaille.rotation = ombre.rotation
		ombreMaille.z_index = ombre.z_index
		ombre.get_parent().add_child(ombreMaille)
		ombre.visible = false
	var p := tole.sommets()
	maille.polygon = p
	ombreMaille.polygon = p
	queue_redraw()
	scotchNoeud.queue_redraw()
	if avant: avant.queue_redraw()


func _peau() -> Traits:
	if peau: return traits
	var tex := corps.texture
	peau = SubViewport.new()
	peau.size = Vector2i(tex.get_width(), tex.get_height())
	peau.transparent_bg = true
	peau.disable_3d = true
	peau.render_target_update_mode = SubViewport.UPDATE_ONCE
	var fond := Sprite2D.new()
	fond.texture = tex
	fond.centered = false
	# `source-atop` du jeu web : les plis ne tombent que sur la voiture
	fond.clip_children = CanvasItem.CLIP_CHILDREN_AND_DRAW
	peau.add_child(fond)
	traits = Traits.new()
	traits.k = tex.get_width() / float(cotes.w)
	traits.kv = tex.get_height() / float(cotes.h)
	traits.w = cotes.w
	traits.h = cotes.h
	fond.add_child(traits)
	add_child(peau)
	return traits


## LA TÔLE FROISSÉE, peinte sur la copie du dessin (js/degats.js, marque) : un creux sombre, des
## plis en travers de la poussée, le bord éraflé ; à l'abandon, le compartiment moteur à la place
## du capot. Chaque marque est tirée une fois, puis redessinée telle quelle.
class Traits extends Node2D:
	var k := 1.0          # pixels par mètre, en long
	var kv := 1.0         # et en large
	var w := 1.0
	var h := 1.0
	var marques: Array = []
	static var _creux: GradientTexture2D

	static func creux() -> GradientTexture2D:
		if _creux == null:
			var g := Gradient.new()
			g.offsets = PackedFloat32Array([0.0, 0.55, 1.0])
			g.colors = PackedColorArray([Color8(38, 40, 38, 255), Color8(38, 40, 38, 140), Color8(38, 40, 38, 0)])
			_creux = GradientTexture2D.new()
			_creux.gradient = g
			_creux.fill = GradientTexture2D.FILL_RADIAL
			_creux.fill_from = Vector2(0.5, 0.5)
			_creux.fill_to = Vector2(1.0, 0.5)
			_creux.width = 64; _creux.height = 64
		return _creux

	func marque(px: float, py: float, nx: float, ny: float, force: float, epave: bool) -> void:
		var u := (px + w / 2) * k
		var v := (py + h / 2) * kv
		var R := (1.35 if epave else minf(0.85, 0.22 + force * 0.03)) * k
		var tu := -ny
		var tv := nx
		var m := { epave = epave, plis = [], R = R }
		if epave: m.compartiment = _compartiment(u, v, nx, ny, R)
		m.cu = u + nx * R * 0.25
		m.cv = v + ny * R * 0.25
		m.a = 0.6 if epave else minf(0.42, 0.1 + force * 0.018)
		var n := 6 if epave else 1 + mini(2, int(floorf(force / 6)))
		for i in n:
			var d := R * (0.08 + 0.7 * randf())
			var o := (randf() - 0.5) * R * 0.9
			var L := R * (0.35 + 0.45 * randf())
			var pts := PackedVector2Array()
			for st in 5:
				var j := (randf() - 0.5) * R * 0.18
				var t := o - L / 2 + L * st / 4.0
				pts.append(Vector2(u + nx * (d + j) + tu * t, v + ny * (d + j) + tv * t))
			m.plis.append(pts)
		m.n = Vector2(nx, ny)
		m.eraflure = PackedVector2Array([Vector2(u + nx * 0.12 * k - tu * R * 0.55, v + ny * 0.12 * k - tv * R * 0.55),
			Vector2(u + nx * 0.16 * k + tu * R * 0.55, v + ny * 0.16 * k + tv * R * 0.55)])
		m.aEraf = 0.8 if epave else minf(0.6, 0.25 + force * 0.025)
		marques.append(m)
		queue_redraw()

	## Le capot arraché : le même compartiment pour toutes les voitures.
	func _compartiment(u: float, v: float, nx: float, ny: float, R: float) -> Array:
		var tu := -ny
		var tv := nx
		var P := func(d: float, t: float) -> Vector2: return Vector2(u + nx * d + tu * t, v + ny * d + tv * t)
		var zone := func(d0: float, d1: float, t0: float, t1: float) -> PackedVector2Array:
			return PackedVector2Array([P.call(d0, t0), P.call(d0, t1), P.call(d1, t1), P.call(d1, t0)])
		var bord := PackedVector2Array()
		for i in 9:
			var t := -R * 0.62 + R * 1.24 * i / 8.0
			var d := R * (0.72 + (0.07 if i % 2 else -0.04) + (randf() - 0.5) * 0.06)
			bord.append(P.call(d, t))
		return [[zone.call(-0.2 * k, R * 0.72, -R * 0.62, R * 0.62), Color(46 / 255.0, 50 / 255.0, 48 / 255.0, 0.95)],
			[zone.call(R * 0.18, R * 0.5, -R * 0.26, R * 0.26), Color(96 / 255.0, 101 / 255.0, 104 / 255.0, 0.95)],
			[zone.call(R * 0.06, R * 0.16, -R * 0.42, -R * 0.12), Color(70 / 255.0, 74 / 255.0, 77 / 255.0, 0.95)],
			[zone.call(R * 0.52, R * 0.6, -R * 0.18, R * 0.22), Color(128 / 255.0, 132 / 255.0, 134 / 255.0, 0.9)],
			bord]

	func _draw() -> void:
		for m in marques:
			if m.epave:
				var c: Array = m.compartiment
				for i in 4: draw_colored_polygon(c[i][0], c[i][1])
				draw_polyline(c[4], Color(226 / 255.0, 229 / 255.0, 232 / 255.0, 0.85), 0.07 * k)
			var R: float = m.R
			draw_texture_rect(Traits.creux(), Rect2(m.cu - R, m.cv - R, 2 * R, 2 * R), false, Color(1, 1, 1, m.a))
			var n: Vector2 = m.n
			for pts in m.plis:
				draw_polyline(pts, Color(22 / 255.0, 22 / 255.0, 26 / 255.0, 0.6), 0.1 * k)
				var dec := PackedVector2Array()
				for p in pts: dec.append(p + n * 0.08 * k)
				draw_polyline(dec, Color(240 / 255.0, 240 / 255.0, 244 / 255.0, 0.45), 0.06 * k)
			draw_line(m.eraflure[0], m.eraflure[1], Color(214 / 255.0, 218 / 255.0, 222 / 255.0, m.aEraf), 0.08 * k)
