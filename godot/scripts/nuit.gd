## La nuit, d'après js/render.js (NightLighting) : une obscurité de 90 %, percée par les
## faisceaux des phares (36 m), les feux arrière (plus longs et plus forts au freinage) et les
## projecteurs posés face aux bacs à gravier. Le jeu web multiplie l'image par une teinte sombre et
## y découpe les lumières ; Godot fait la même chose sur la carte graphique, avec la même teinte
## (CanvasModulate) et des lumières 2D aux mêmes formes, calculées avec les mêmes formules.
class_name Nuit
extends Node2D

# La teinte que le jeu web multiplie à l'image (NUIT_TEINTE, js/render.js), la même ici : une
# obscurité de 90 %, l'image garde un dixième de sa clarté, teintée de bleu. Bruno l'a voulue pour
# les deux versions (« 90 % pour tous ») ; elle était avant de 96 %, Color(0.024, 0.039, 0.082).
const OBSCURITE := Color8(16, 26, 54)
const ROUGE_FEU := Color("#ff1808")
const FLOOD := Color8(255, 212, 145)

static var tBeam: Texture2D        # beamMask : 36 m sur 12 m
static var tTail: Texture2D        # le même, en rouge (tailMask)
static var tFlood: Texture2D       # floodMask
var jeu
var nuit := true                  # la vraie nuit ; sinon, seulement sous les tunnels
var force := 1.0                  # 1 la nuit ; de 0 à 1 sous un tunnel, de jour
var _tunnel := 0.0
var _premier := true
var _baseEnergie := {}            # lumière -> son énergie pleine
var _lueursAlpha := {}            # lueur -> son alpha plein
var _matsNoeud: Node2D = null
const FONDU := 0.35               # NUIT_FONDU du jeu web : l'entrée et la sortie d'un tunnel
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


func _init(j, laNuit := true) -> void:
	jeu = j
	nuit = laNuit
	force = 1.0 if nuit else 0.0
	_textures()


func _ready() -> void:
	modulateur = CanvasModulate.new()
	modulateur.color = OBSCURITE if nuit else Color.WHITE
	visible = nuit
	add_child(modulateur)
	# Les projecteurs du circuit : une lumière, sa lueur chaude, et le mât.
	var meta: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://donnees/circuits/%s.json" % jeu.piste.id))
	for p in meta.get("projecteurs", []):
		var l := _lumiere(tFlood, p.longueur, p.largeur, p.puissance)
		_baseEnergie[l] = p.puissance
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
		_lueursAlpha[lueur] = 0.065
		lueur.material = _sansOmbre()
		lueur.z_index = 5
		add_child(lueur)
		projecteurs.append(p)
		champs.append({ x = p.x, y = p.y, cap = p.cap, type = "flood", longueur = p.longueur, largeur = p.largeur, puissance = p.puissance })
	champs.append_array(jeu.decor.champsGalerie)
	var mats := Node2D.new()
	mats.material = _sansOmbre()
	_matsNoeud = mats
	mats.z_index = 5
	mats.draw.connect(_mats.bind(mats))
	add_child(mats)


## Deux rampes sous la galerie. Leurs faisceaux rasent la chaussée depuis les bords.
## Le décor les porte pour qu'ils soient déjà allumés lorsqu'on approche du portail de jour.
static func eclaireGalerie(piste: Piste, decor: Decor) -> void:
	if piste.lumiereTunnel.is_empty(): return
	_textures()
	var boitiers := Node2D.new()
	var lampes: Array[Transform2D] = []
	boitiers.material = _sansOmbre()
	decor.add_child(boitiers)
	for tunnel in piste.tunnels:
		var debut := float(tunnel[0]) * piste.ds
		var longueur := float(tunnel[1]) * piste.ds
		var nombre := floori(longueur / 12.0)
		for i in nombre:
			var s := debut + (i + 0.5) * longueur / nombre
			var k := piste.idx(s)
			var normale := Vector2(piste.nx[k], piste.ny[k])
			for cote in [-1.0, 1.0]:
				var bord := piste.hwL[k] if cote > 0 else piste.hwR[k]
				var origine := piste.pos(s, cote * (bord - 0.6))
				var cap := (-normale * float(cote)).angle()
				var portee := minf(2 * bord, 12.0)
				var l := _lumiere(tFlood, portee, 8.0, 0.55)
				l.color = Color("#ffdfab")
				l.position = origine
				l.rotation = cap
				l.range_z_max = 1
				decor.add_child(l)
				decor.champsGalerie.append({ x = origine.x, y = origine.y, cap = cap, type = "flood", longueur = portee, largeur = 8.0, puissance = l.energy })
				lampes.append(Transform2D(cap, origine))
	boitiers.draw.connect(func():
		for lampe in lampes:
			boitiers.draw_set_transform_matrix(lampe)
			boitiers.draw_rect(Rect2(-0.17, -0.8, 0.34, 1.6), Color("#665244"))
			boitiers.draw_rect(Rect2(-0.10, -0.65, 0.20, 1.3), Color("#fff1c5"))
	)


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
		add_child(s)
		e.lueurs.append(s)
	var verres := Node2D.new()
	verres.material = _sansOmbre()
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


## Dans la galerie de Monaco, l'ouverture sur la mer (+lat) laisse entrer le jour.
## Les luminaires prennent le relais la nuit. Le passage aux portails suit la distance parcourue.
func _fondu() -> void:
	var c: Course = jeu.course
	var piste: Piste = jeu.piste
	var lumiere := piste.lumiereTunnel
	if not lumiere.is_empty():
		force = 1.0 if nuit else 0.0
		if not c.spectator:
			var car := c.player
			for tunnel in piste.tunnels:
				var d := piste.wrap_(car.s - float(tunnel[0]) * piste.ds)
				var profondeur := minf(d, float(tunnel[1]) * piste.ds - d)
				if profondeur <= 0: continue
				var k := piste.idx(car.s)
				var mer := lisse((car.lat + piste.hwR[k]) / (piste.hwL[k] + piste.hwR[k]))
				var interieur := float(lumiere.nuit) if nuit else lerpf(lumiere.mur, lumiere.mer, mer)
				force = lerpf(force, interieur, lisse(profondeur / float(lumiere.portail)))
				break
	elif nuit:
		return
	else:
		var dedans := not c.spectator and piste.sousTunnel(c.player.s)
		if _premier:
			_premier = false
			_tunnel = 1.0 if dedans else 0.0
		_tunnel = clampf(_tunnel + (1.0 if dedans else -1.0) * minf(0.1, get_process_delta_time()) / FONDU, 0, 1)
		force = _tunnel
	visible = force > 0
	modulateur.color = Color.WHITE.lerp(OBSCURITE, force)
	for l in _baseEnergie: l.energy = _baseEnergie[l] * force
	for s in _lueursAlpha: s.modulate.a = _lueursAlpha[s] * force
	if _matsNoeud: _matsNoeud.modulate.a = force


## Chaque image : les lumières suivent les voitures (position interpolée, comme leur dessin).
func maj(poses: Array) -> void:
	_fondu()
	for e in parVoiture:
		if e.has("verres"): e.verres.visible = force > 0; e.verres.modulate.a = force
	if force <= 0: return
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
		var vue: VoitureVue = e.vue
		for k in avant.size():
			# la tôle froissée : un feu suit son coin, et s'éteint s'il a reculé de plus de 7 cm
			var q: Dictionary = vue.feu(avant[k], car)
			var l: PointLight2D = e.phares[k]
			l.visible = not q.is_empty()
			if q.is_empty(): continue
			var cote := signf(q.y)
			l.position = monde.call(q)
			l.rotation = h + cote * .035
			l.energy = .82 * force
			champs.append({ x = l.position.x, y = l.position.y, cap = l.rotation, type = "beam", longueur = 36.0, largeur = 6.0, puissance = .82 })
		var freine := car.braking and not car.herbe
		var arriere: Array = e.feuxDef.arriere
		var allumes: bool = not e.feuxDef.freinSeul or freine
		for k in arriere.size():
			var q: Dictionary = vue.feu(arriere[k], car)
			var l: PointLight2D = e.feux[k]
			var s: Sprite2D = e.lueurs[k]
			l.visible = allumes and not q.is_empty(); s.visible = l.visible
			if not l.visible: continue
			var longueur := 6.5 if freine else 4.2
			var largeur := 1.1 if freine else .7
			var pos: Vector2 = monde.call(q)
			var cap := h + PI - signf(q.y) * .06
			# Le halo est posé sur le sol, même lorsque la voiture roule sur un pont.
			s.z_index = vue.z_index - 1
			l.range_item_cull_mask = Decor.LUMIERE_TABLIER if vue.z_index == 3 else Decor.LUMIERE_SOL
			l.position = pos; l.rotation = cap
			l.scale = Vector2(longueur / tBeam.get_width(), largeur * 2 / tBeam.get_height())
			l.energy = (.4 if freine else .035) * force
			s.position = pos; s.rotation = cap; s.scale = l.scale
			s.modulate = Color(1, 1, 1, (.78 if freine else .24) * force)
			champs.append({ x = pos.x, y = pos.y, cap = cap, type = "tail", longueur = longueur, largeur = largeur, puissance = l.energy })


## NightLighting.canSee : à moins de 45 m du joueur, et dans une lumière.
func voit(p: Vector2, observateur: Vector2) -> bool:
	if not nuit: return true                # sous un tunnel, la minicarte garde ses règles de jour
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
