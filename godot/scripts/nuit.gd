## La nuit, d'après js/render.js (NightLighting) : une obscurité presque totale, percée par les
## faisceaux des phares (36 m), les feux arrière (plus longs et plus forts au freinage) et les
## projecteurs posés face aux bacs à gravier. Le jeu web peint un calque noir et y découpe les
## lumières ; Godot fait la même chose sur la carte graphique, avec une teinte d'obscurité
## (CanvasModulate) et des lumières 2D aux mêmes formes, calculées avec les mêmes formules.
class_name Nuit
extends Node2D

# Le calque du jeu web : rgba(3, 7, 18, .988) par-dessus tout. Hors des lumières il ne reste que
# 1,2 % de l'image et ce bleu presque noir ; en teinte multipliée, cela donne à peu près ceci.
const OBSCURITE := Color(0.024, 0.039, 0.082)
const ROUGE_FEU := Color("#ff1808")
const FLOOD := Color8(255, 212, 145)

static var tBeam: Texture2D        # beamMask : 36 m sur 12 m
static var tTail: Texture2D        # le même, en rouge (tailMask)
static var tFlood: Texture2D       # floodMask
var jeu
var modulateur: CanvasModulate
var parVoiture: Array = []        # { phares: [PointLight2D], feux: [PointLight2D], lueurs: [Sprite2D], verres: Node2D }
var champs: Array = []            # pour canSee : { x, y, cap, type, longueur, largeur, puissance }
var projecteurs: Array = []


static func lisse(t: float) -> float:
	t = clampf(t, 0, 1)
	return t * t * (3 - 2 * t)


static func beamStrength(x: float, y: float) -> float:
	if x <= 0 or x >= 36: return 0.0
	var edge := absf(y) / (.16 + x * .15)
	if edge >= 1: return 0.0
	return (1 - lisse((x / 36 - .06) / .94)) * (1 - lisse((edge - .12) / .88)) * lisse(x / .5)


static func floodStrength(x: float, y: float) -> float:
	if x <= 0 or x >= 1: return 0.0
	var edge := absf(y) / (.18 + .82 * x)
	if edge >= 1: return 0.0
	return lisse(x / .25) * (1 - lisse((x - .22) / .78)) * (1 - lisse((edge - .12) / .88))


static func _textures() -> void:
	if tBeam: return
	var b := Image.create(256, 160, false, Image.FORMAT_RGBA8)
	var t := Image.create(256, 160, false, Image.FORMAT_RGBA8)
	for y in 160:
		for x in 256:
			var a := beamStrength((x + .5) / 256 * 36, ((y + .5) / 160 - .5) * 12)
			b.set_pixel(x, y, Color(1, 1, 1, a))
			t.set_pixel(x, y, Color(ROUGE_FEU, a))
	tBeam = ImageTexture.create_from_image(b)
	tTail = ImageTexture.create_from_image(t)
	var f := Image.create(256, 192, false, Image.FORMAT_RGBA8)
	for y in 192:
		for x in 256:
			var a := floodStrength((x + .5) / 256, (y + .5) / 192 * 2 - 1)
			f.set_pixel(x, y, Color(1, 1, 1, a))
	tFlood = ImageTexture.create_from_image(f)


## Une lumière dont l'origine est au bord gauche de sa texture, et qui couvre `longueur` × 2·`demi`.
static func _lumiere(tex: Texture2D, longueur: float, demi: float, energie: float) -> PointLight2D:
	var l := PointLight2D.new()
	l.texture = tex
	l.offset = Vector2(tex.get_width() / 2.0, 0)
	l.scale = Vector2(longueur / tex.get_width(), demi * 2 / tex.get_height())
	l.energy = energie
	l.blend_mode = Light2D.BLEND_MODE_ADD
	l.shadow_enabled = false
	return l


static func _sansOmbre() -> CanvasItemMaterial:
	var m := CanvasItemMaterial.new()
	m.light_mode = CanvasItemMaterial.LIGHT_MODE_UNSHADED
	return m


func _init(j) -> void:
	jeu = j
	_textures()


func _ready() -> void:
	modulateur = CanvasModulate.new()
	modulateur.color = OBSCURITE
	add_child(modulateur)
	# Les projecteurs du circuit : une lumière, sa lueur chaude, et le mât.
	var meta: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://donnees/circuits/%s.json" % jeu.piste.id))
	for p in meta.get("projecteurs", []):
		var l := _lumiere(tFlood, p.longueur, p.largeur, p.puissance)
		l.position = Vector2(p.x, p.y)
		l.rotation = p.cap
		add_child(l)
		var lueur := Sprite2D.new()
		lueur.texture = tFlood
		lueur.centered = false
		lueur.offset = Vector2(0, -tFlood.get_height() / 2.0)
		lueur.scale = l.scale
		lueur.position = l.position
		lueur.rotation = l.rotation
		lueur.modulate = Color(FLOOD, 0.065)
		lueur.material = _sansOmbre()
		lueur.z_index = 5
		add_child(lueur)
		projecteurs.append(p)
		champs.append({ x = p.x, y = p.y, cap = p.cap, type = "flood", longueur = p.longueur, largeur = p.largeur, puissance = p.puissance })
	var mats := Node2D.new()
	mats.material = _sansOmbre()
	mats.z_index = 5
	mats.draw.connect(_mats.bind(mats))
	add_child(mats)


## Les mâts des projecteurs (NightLighting.fixtures), restés visibles dans le noir.
func _mats(ci: CanvasItem) -> void:
	for l in projecteurs:
		ci.draw_set_transform(Vector2(l.x, l.y), l.cap)
		ci.draw_line(Vector2(-1.8, .7), Vector2.ZERO, Color("#586779"), .16)
		ci.draw_rect(Rect2(-2, .5, .4, .4), Color("#303b4a"))
		ci.draw_rect(Rect2(-.4, -.7, .55, 1.4), Color("#333a42"))
		ci.draw_rect(Rect2(.08, -.55, .12, 1.1), Color("#fff0cf"))
	ci.draw_set_transform(Vector2.ZERO, 0)


## Les feux d'une voiture : deux faisceaux, ses feux arrière et leur lueur, ses verres de phares.
func ajouteVoiture(vue: VoitureVue, car: Voiture) -> void:
	var feux: Dictionary = vue.cotes.get("feux", { avant = [], arriere = [], freinSeul = false })
	var e := { phares = [], feux = [], lueurs = [], car = car, vue = vue, feuxDef = feux }
	if car.fantome:
		parVoiture.append(e)
		return
	for q in feux.avant:
		var l := _lumiere(tBeam, 36, 6, 0.82)
		add_child(l)
		e.phares.append(l)
	for q in feux.arriere:
		var l := _lumiere(tBeam, 4.2, 0.7, 0.035)
		add_child(l)
		e.feux.append(l)
		var s := Sprite2D.new()
		s.texture = tTail
		s.centered = false
		s.offset = Vector2(0, -tTail.get_height() / 2.0)
		s.material = _sansOmbre()
		s.z_index = 5
		add_child(s)
		e.lueurs.append(s)
	var verres := Node2D.new()
	verres.material = _sansOmbre()
	verres.z_index = 6
	verres.draw.connect(_verres.bind(verres, feux))
	vue.add_child(verres)
	e.verres = verres
	parVoiture.append(e)


func _verres(ci: CanvasItem, feux: Dictionary) -> void:
	for q in feux.avant:
		for p in q.verre:
			for sub in p.subs:
				var pts := PackedVector2Array()
				for i in range(0, sub.size(), 2): pts.append(Vector2(q.x + sub[i], q.y + sub[i + 1]))
				var c := Color8(int(p.c[0]), int(p.c[1]), int(p.c[2]), int(p.c[3] * 255))
				if p.t == "f" and pts.size() >= 3: ci.draw_colored_polygon(pts, c)
				elif pts.size() >= 2: ci.draw_polyline(pts, c, p.w)


## Chaque image : les lumières suivent les voitures (position interpolée, comme leur dessin).
func maj(poses: Array) -> void:
	champs = champs.filter(func(f): return f.type == "flood")
	for i in parVoiture.size():
		var e: Dictionary = parVoiture[i]
		var car: Voiture = e.car
		if car.fantome: continue
		var p: Vector2 = poses[i][0]
		var h: float = poses[i][1]
		var cs := cos(h)
		var sn := sin(h)
		var monde := func(q) -> Vector2: return p + Vector2(cs * q.x - sn * q.y, sn * q.x + cs * q.y)
		var avant: Array = e.feuxDef.avant
		for k in avant.size():
			var q: Dictionary = avant[k]
			var cote := signf(q.y)
			var l: PointLight2D = e.phares[k]
			l.position = monde.call(q)
			l.rotation = h + cote * .035
			champs.append({ x = l.position.x, y = l.position.y, cap = l.rotation, type = "beam", longueur = 36.0, largeur = 6.0, puissance = .82 })
		var freine := car.braking and not car.herbe
		var arriere: Array = e.feuxDef.arriere
		var allumes: bool = not e.feuxDef.freinSeul or freine
		for k in arriere.size():
			var q: Dictionary = arriere[k]
			var l: PointLight2D = e.feux[k]
			var s: Sprite2D = e.lueurs[k]
			l.visible = allumes; s.visible = allumes
			if not allumes: continue
			var longueur := 6.5 if freine else 4.2
			var largeur := 1.1 if freine else .7
			var pos: Vector2 = monde.call(q)
			var cap := h + PI - signf(q.y) * .06
			l.position = pos; l.rotation = cap
			l.scale = Vector2(longueur / tBeam.get_width(), largeur * 2 / tBeam.get_height())
			l.energy = .4 if freine else .035
			s.position = pos; s.rotation = cap; s.scale = l.scale
			s.modulate = Color(1, 1, 1, .78 if freine else .24)
			champs.append({ x = pos.x, y = pos.y, cap = cap, type = "tail", longueur = longueur, largeur = largeur, puissance = l.energy })


## NightLighting.canSee : à moins de 45 m du joueur, et dans une lumière.
func voit(p: Vector2, observateur: Vector2) -> bool:
	if p.distance_to(observateur) > 45: return false
	for f in champs:
		var x: float = p.x - f.x
		var y: float = p.y - f.y
		var c := cos(f.cap)
		var s := sin(f.cap)
		var u := x * c + y * s
		var v := -x * s + y * c
		var force := 0.0
		match f.type:
			"flood": force = floodStrength(u / f.longueur, v / f.largeur)
			"tail": force = beamStrength(u / f.longueur * 36, v / f.largeur * 6)
			_: force = beamStrength(u, v)
		if f.puissance * force > .18: return true
	return false
