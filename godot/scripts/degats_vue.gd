## Les dégâts qui se voient (js/degats.js et render.js, _degats — essai du jeu web).
##
## Chaque choc noté par la physique (`car.chocs`) devient une bosse sur la tôle, des plis peints,
## une gerbe d'étincelles et des débris ; une voiture très abîmée fume. La conduite et les collisions
## restent un rectangle rigide : l'anneau de la tôle n'est qu'une peau, tendue sur le dessin de la
## voiture (VoitureVue, maillage). Dégâts coupés : ni bosse ni débris, les étincelles restent.
##
## Ici : la tôle de chaque voiture (Carrosserie), les étincelles et les débris (au sol, sous les
## voitures), la fumée (par Effets), et les limites des boxes peintes en blanc quand les stands
## servent.
class_name DegatsVue
extends Node2D

const POINTS := 32                       # sommets par anneau
const RETRAITS := [0.0, 0.42, 0.9]       # m : chaque anneau depuis le bord du dessin ; le dernier est fixe
const CREUX_MAX := [0.3, 0.15, 0.0]      # m : ce que chaque anneau peut rentrer au plus
const SEUIL := 3.5                       # m/s : en dessous, un contact ne cabosse rien
const CREUX := 0.0075                    # m de tôle par m/s au-delà du seuil (Voiture.ENFONCE_creux)
const RAYON := 0.6
const EPAVE_MAX := [0.95, 0.55, 0.0]
## LA TÔLE SUIT LES POINTS DE VIE. « Quand on est à 12 %, on doit avoir un côté complètement enfoncé :
## visuellement ça doit se voir beaucoup plus. » (Bruno) Les bosses des chocs ne marquent que l'endroit
## touché ; en plus, chaque zone de la caisse (Voiture.zoneEnfonce : le nez, les coins, les flancs,
## l'arrière) rentre à proportion de ce qu'elle a pris (car.enfoncement), jusqu'à ces fractions de la
## demi-longueur (le nez, l'arrière) ou de la demi-largeur (les flancs) quand elle est à fond.
const ECRASE := [0.36, 0.5, 0.7, 0.5, 0.32, 0.5, 0.7, 0.5]
const ECRASE_ANNEAU := 0.5               # l'anneau du milieu suit à moitié : le pli reste lisse
const ECRASE_COURBE := 0.8               # < 1 : un enfoncement moyen se voit déjà bien
const BOSSES := 0.6                      # la part des bosses locales, par-dessus les zones
const FROISSE := 0.45                    # l'irrégularité du bord enfoncé : de la tôle froissée, pas une voiture plus petite
const EPAVE_CREUX := 1.1
const EPAVE_RAYON := 1.5
const RESSORT := 260.0
const AMORTI := 7.0
const ETINCELLES := 2.0                  # m/s : au-dessus, un contact contre du métal crache
const FROTTE := 9.0
const DEBRIS := 5.0                      # m/s au-delà du seuil : des morceaux tombent
const FUMEE := 0.3                       # dommages à partir desquels la voiture fume
const DEBRIS_VIE := 45.0
const DEBRIS_MAX := 400
const ETINCELLES_MAX := 300
# Les boxes (js/mecanos.js, MECANOS) : deux garages du dessin par box, huit mètres
const PAR_GARAGE := 2
const LARGEUR_BOX := 8.0

var jeu                                  # CourseVue
var debris: Array = []                   # { x, y, vx, vy, ang, va, l, e, col, age }
var etincelles: Array = []               # { x, y, vx, vy, vie, vie0 }
var boxes: Array = []                    # les bandes blanches, des quadrilatères
var feu: Node2D                          # les étincelles, en lumière ajoutée


func _ready() -> void:
	feu = Node2D.new()
	var m := CanvasItemMaterial.new()
	m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	feu.material = m
	feu.draw.connect(_dessineEtincelles)
	add_child(feu)


## Une nouvelle course : le sol est propre, et les boxes se marquent si les stands servent.
func nouvelleCourse(course: Course) -> void:
	debris.clear(); etincelles.clear(); boxes.clear()
	if course.stands: _boxes(course.track)
	queue_redraw()


## LES BOXES, MARQUÉS AU SOL : une bande blanche de 30 cm en travers de la voie à chaque limite de
## box, tous les deux garages du dessin (render.js, `boxes`).
func _boxes(T: Piste) -> void:
	var limites := {}
	for gr in T.pitGarages():
		for k in PAR_GARAGE + 1:
			limites[roundf((float(gr.s) + (k - PAR_GARAGE / 2.0) * LARGEUR_BOX) * 10) / 10] = true
	for s0 in limites:
		var s := T.wrap_(s0)
		var z := T.pitAt(s)
		if z.is_empty(): continue
		var h := T.headingAt(s)
		var e := Vector2(cos(h), sin(h)) * 0.15
		var a := T.pos2(s, float(z.interne) - 0.15)
		var b := T.pos2(s, float(z.externe) + 0.1)
		var A := Vector2(a[0], a[1])
		var B := Vector2(b[0], b[1])
		boxes.append(PackedVector2Array([A - e, B - e, B + e, A + e]))


## Chaque image : les chocs notés deviennent bosses, plis, débris et étincelles ; la tôle tremble
## puis se fige ; les voitures très abîmées fument.
func maj(course: Course, vues: Array, dt: float) -> void:
	var roule := course.state in ["racing", "finishing", "finished"]
	for i in course.cars.size():
		var car: Voiture = course.cars[i]
		var vue: VoitureVue = vues[i]
		# réparée au stand : la tôle repart neuve
		if vue.tole and car.pitsDone != vue.tole.pitsVu: vue.toleNeuve()
		if car.chocs.size() and not car.fantome:
			var w: float = vue.cotes.w
			var h: float = vue.cotes.h
			var cs := cos(car.th)
			var sn := sin(car.th)
			var vx := car.v * cs + car.vl * sn
			var vy := car.v * sn - car.vl * cs
			var gerbes := 0
			for e in car.chocs:
				var px: float = -clampf(e.nx * 1.8, -1, 1) * w / 2
				var py: float = -clampf(e.ny * 1.8, -1, 1) * h / 2
				var X := car.x + px * cs - py * sn
				var Y := car.y + px * sn + py * cs
				var ox: float = -(e.nx * cs - e.ny * sn)
				var oy: float = -(e.nx * sn + e.ny * cs)
				var force: float = e.v - SEUIL
				if force > 0 and course.degatsVisu:
					var couleur := vue.teinte(px, py, e.nx, e.ny)
					vue.cabosse(px, py, e.nx, e.ny, force, e.epave, car.pitsDone)
					if e.epave: _eclate(X, Y, vx, vy, ox, oy, 18, couleur, true)
					elif force > DEBRIS: _eclate(X, Y, vx, vy, ox, oy, mini(8, 1 + roundi(force * 0.4)), couleur)
				# contre des pneus, pas d'étincelles : du caoutchouc ne crache rien
				if e.sorte != "tyres" and gerbes < 24 and (e.v > ETINCELLES or e.frotte > FROTTE):
					var n: int = mini(12, roundi(1 + maxf(0, e.v - ETINCELLES) * 0.9 + maxf(0, e.frotte - FROTTE) * 0.08))
					_gerbe(X, Y, vx, vy, ox, oy, n)
					gerbes += n
		car.chocs.clear()
		# la tôle suit les points de vie, zone par zone (figée à l'abandon : l'épave a son propre choc)
		if course.degatsVisu and not car.fantome and not car.abandon and not car.degats.is_empty():
			vue.ecrase(car.enfoncement, car.pitsDone)
		if vue.tole == null: continue
		vue.tole.pas(dt)
		vue.majTole()
		# la fumée d'une voiture très abîmée sort de là où elle a pris les coups
		if roule and not car.fantome and car.damage > FUMEE and not (car.abandon and car.abandonT > 7):
			var q := clampf((car.damage - FUMEE) / (1 - FUMEE), 0, 1)
			var attendu := (4 + 16 * q) * minf(dt, 0.1)
			var n := int(floorf(attendu)) + (1 if randf() < fmod(attendu, 1.0) else 0)
			var cs := cos(car.th)
			var sn := sin(car.th)
			for k in n:
				var fx: float = vue.tole.fx * 0.8
				var fy: float = vue.tole.fy * 0.8
				jeu.effets._bouffee(car.x + fx * cs - fy * sn + (randf() - 0.5) * 0.5, car.y + fx * sn + fy * cs + (randf() - 0.5) * 0.5,
					(randf() - 0.5) * 1.5, (randf() - 0.5) * 1.5, 0.35 + q * 0.4 + randf() * 0.25, 0.8 + q * 0.8,
					Color8(78, 78, 84) if q > 0.5 else Color8(150, 150, 156))
	_pas(dt)
	queue_redraw()
	feu.queue_redraw()


func _gerbe(x: float, y: float, vx: float, vy: float, ox: float, oy: float, n: int) -> void:
	var cap := atan2(oy, ox)
	for i in n:
		if etincelles.size() >= ETINCELLES_MAX: etincelles.pop_front()
		var a := cap + (randf() - 0.5) * 2.4
		var s := 4 + randf() * 14
		var vie := 0.12 + randf() * 0.28
		etincelles.append({ x = x, y = y, vx = vx * 0.75 + cos(a) * s, vy = vy * 0.75 + sin(a) * s, vie = vie, vie0 = vie })


func _eclate(x: float, y: float, vx: float, vy: float, ox: float, oy: float, n: int, couleur: Color, capot := false) -> void:
	var cap := atan2(oy, ox)
	if capot:
		if debris.size() >= DEBRIS_MAX: debris.pop_front()
		var a := cap + (randf() - 0.5) * 1.2
		var s := 3 + randf() * 3
		debris.append({ x = x, y = y, vx = vx * 0.4 + cos(a) * s, vy = vy * 0.4 + sin(a) * s, ang = randf() * TAU,
			va = (randf() - 0.5) * 8, l = 1.0 + randf() * 0.2, e = 0.7 + randf() * 0.15, col = couleur, age = 0.0 })
	for i in n:
		if debris.size() >= DEBRIS_MAX: debris.pop_front()
		var q := randf()
		var a := cap + (randf() - 0.5) * 2.8
		var s := 2 + randf() * 8
		debris.append({ x = x + (randf() - 0.5) * 0.4, y = y + (randf() - 0.5) * 0.4,
			vx = vx * 0.55 + cos(a) * s, vy = vy * 0.55 + sin(a) * s, ang = randf() * TAU, va = (randf() - 0.5) * 24,
			l = 0.1 + randf() * 0.3, e = 0.06 + randf() * 0.12,
			col = couleur if q < 0.55 else (Color("#1d1f22") if q < 0.82 else Color("#cfdbe2")), age = 0.0 })


func _pas(dt: float) -> void:
	var air := exp(-4 * dt)
	var sol := exp(-3.2 * dt)
	for e in etincelles:
		e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= air; e.vy *= air; e.vie -= dt
	if etincelles.size(): etincelles = etincelles.filter(func(e): return e.vie > 0)
	for d in debris:
		d.age += dt
		if d.vx == 0 and d.vy == 0: continue
		d.x += d.vx * dt; d.y += d.vy * dt; d.ang += d.va * dt
		d.vx *= sol; d.vy *= sol; d.va *= sol
		if absf(d.vx) + absf(d.vy) < 0.15: d.vx = 0.0; d.vy = 0.0; d.va = 0.0
	if debris.size() and debris[0].age > DEBRIS_VIE: debris = debris.filter(func(d): return d.age <= DEBRIS_VIE)


## Au sol, sous les voitures : les limites des boxes, puis les débris.
func _draw() -> void:
	for q in boxes: draw_colored_polygon(q, Color(244 / 255.0, 244 / 255.0, 240 / 255.0, 0.92))
	for d in debris:
		var fin: float = DEBRIS_VIE - d.age
		var col: Color = d.col
		col.a = minf(1, fin / 4)
		var c := cos(d.ang)
		var s := sin(d.ang)
		var l: float = d.l / 2
		var e: float = d.e / 2
		var x: float = d.x
		var y: float = d.y
		var pts := PackedVector2Array([Vector2(x + c * l - s * e, y + s * l + c * e), Vector2(x - c * l - s * e, y - s * l + c * e),
			Vector2(x - c * l + s * e, y - s * l - c * e), Vector2(x + c * l + s * e, y + s * l - c * e)])
		draw_colored_polygon(pts, col)
		if d.l > 0.6:   # le capot, détouré
			pts.append(pts[0])
			draw_polyline(pts, Color(20 / 255.0, 20 / 255.0, 24 / 255.0, 0.6 * col.a), 0.06)


## Les étincelles : un trait le long de leur vitesse, jaune vif en sortant, orange en mourant.
func _dessineEtincelles() -> void:
	for e in etincelles:
		var t: float = e.vie / e.vie0
		var c: Color = Color(1, (140 + 90 * t) / 255.0, (30 + 70 * t) / 255.0, minf(1, t * 1.6))
		feu.draw_line(Vector2(e.x, e.y), Vector2(e.x - e.vx * 0.03, e.y - e.vy * 0.03), c, 0.14)


## LA TÔLE : trois rectangles emboîtés de POINTS sommets (le bord du dessin, puis deux anneaux à
## l'intérieur, le dernier fixe). Un choc enfonce les sommets proches, avec un peu de hasard pour
## que le bord se froisse ; la tôle tremble par un ressort peu amorti, puis se fige.
class Carrosserie:
	var w: float
	var h: float
	var N := POINTS
	var R := RETRAITS.size()
	var rx := PackedFloat32Array()      # au repos
	var ry := PackedFloat32Array()
	var tx := PackedFloat32Array()      # la bosse qui restera
	var ty := PackedFloat32Array()
	var bx := PackedFloat32Array()      # les bosses des chocs, à l'endroit touché
	var by := PackedFloat32Array()
	var zx := PackedFloat32Array()      # les zones enfoncées (les points de vie)
	var zy := PackedFloat32Array()
	var _vu := PackedFloat32Array()     # les points de vie déjà dessinés
	var froisse := PackedFloat32Array() # par sommet du bord, tiré une fois : chaque voiture se froisse à sa façon
	var dx := PackedFloat32Array()      # la bosse de l'instant
	var dy := PackedFloat32Array()
	var vx := PackedFloat32Array()
	var vy := PackedFloat32Array()
	var touche := false
	var calme := true
	var version := 0
	var pitsVu := 0
	var fx := 0.0                       # le foyer des chocs : d'où sort la fumée
	var fy := 0.0
	var fw := 0.0

	func _init(w_: float, h_: float) -> void:
		w = w_; h = h_
		var n := N * R
		# (les tableaux Packed se copient : chacun se dimensionne lui-même)
		rx.resize(n); ry.resize(n); tx.resize(n); ty.resize(n); dx.resize(n); dy.resize(n); vx.resize(n); vy.resize(n)
		bx.resize(n); by.resize(n); zx.resize(n); zy.resize(n)
		froisse.resize(N)
		for i in N: froisse[i] = 1 - FROISSE / 2 + FROISSE * randf()
		var hw := w / 2
		var hh := h / 2
		var cote := maxi(2, roundi(N / 2.0 * h / (w + h)))
		var flanc := N / 2 - cote
		var coins := [Vector2(hw, -hh), Vector2(hw, hh), Vector2(-hw, hh), Vector2(-hw, -hh)]
		var parts := [cote, flanc, cote, flanc]
		var bord: Array[Vector2] = []
		for c in 4:
			var p0: Vector2 = coins[c]
			var p1: Vector2 = coins[(c + 1) % 4]
			for i in parts[c]: bord.append(p0 + (p1 - p0) * i / float(parts[c]))
		for r in R:
			var d: float = RETRAITS[r]
			var sx := maxf(0.1, hw - d) / hw
			var sy := maxf(0.12, hh - d) / hh
			for i in N:
				rx[r * N + i] = bord[i].x * sx
				ry[r * N + i] = bord[i].y * sy

	## Un choc en (px, py), sur le bord ; (nx, ny) vers où la tôle rentre ; `force` en m/s au-delà
	## du seuil ; `epave` : l'abandon, le nez part. La dureté de la zone touchée est celle des
	## points de vie (Voiture.ENFONCE_durete) : un pare-chocs se cabosse moins qu'un flanc.
	func choc(px: float, py: float, nx: float, ny: float, force: float, epave := false) -> void:
		var r := EPAVE_RAYON if epave else RAYON * (1 + minf(0.6, force / 15))
		var durete: float = Voiture.ENFONCE_durete[Voiture.zoneEnfonce(nx, ny)]
		var prof: float = EPAVE_CREUX if epave else CREUX * force * durete
		var mx: Array = EPAVE_MAX if epave else CREUX_MAX
		for k in N * R:
			var lim: float = mx[k / N]
			if lim == 0: continue
			var dist := Vector2(rx[k] - px, ry[k] - py).length()
			if dist >= r: continue
			var f := 1 - (dist * dist) / (r * r)
			f *= f
			var p := prof * f * (0.65 + 0.7 * randf())
			bx[k] += nx * p; by[k] += ny * p
			var m := Vector2(bx[k], by[k]).length()
			if m > lim: bx[k] *= lim / m; by[k] *= lim / m
			vx[k] += nx * p * 2; vy[k] += ny * p * 2
		_cible()
		fx = (fx * fw + px * force) / (fw + force)
		fy = (fy * fw + py * force) / (fw + force)
		fw += force

	## Les zones de la caisse rentrent selon leurs points de vie (car.enfoncement, en m, 0,3 = à fond).
	## Chaque sommet du bord prend la zone où il se trouve, fondue avec la voisine pour que le pli
	## reste lisse, et rentre droit vers l'intérieur de son côté ; dans les coins, en biais.
	func ecrase(enf: PackedFloat32Array) -> void:
		if enf == _vu: return
		_vu = enf.duplicate()
		var hw := w / 2
		var hh := h / 2
		var niveaux := []
		for z in 8:
			niveaux.append(float(ECRASE[z]) * pow(clampf(enf[z] / Voiture.ENFONCE_max, 0, 1), ECRASE_COURBE))
		for i in N:
			var qx := rx[i] / hw
			var qy := ry[i] / hh
			# la zone du sommet (le même découpage que la physique : ±22,5° autour de son centre), fondue
			# avec la voisine sur ses bords seulement, pour que tout le flanc rentre, pas son milieu
			var zf := fposmod(atan2(qy, qx) / (PI / 4), 8.0)
			var zc := roundi(zf) % 8
			var d := zf - roundf(zf)
			var voisine := (zc + (1 if d > 0 else 7)) % 8
			var part := 0.5 * smoothstep(0.2, 0.5, absf(d))
			var fr: float = lerpf(niveaux[zc], niveaux[voisine], part) * froisse[i]
			# vers l'intérieur de son côté : droit sur un flanc ou le nez, en biais dans un coin
			var ex := signf(qx) * pow(absf(qx), 6)
			var ey := signf(qy) * pow(absf(qy), 6)
			var el := Vector2(ex, ey).length()
			if el == 0: el = 1
			var ux := -ex / el * hw * fr
			var uy := -ey / el * hh * fr
			zx[i] = ux; zy[i] = uy
			zx[N + i] = ux * ECRASE_ANNEAU; zy[N + i] = uy * ECRASE_ANNEAU
		_cible()

	## Ce que la tôle doit rejoindre : les zones, plus les bosses des chocs ; jamais plus loin que
	## l'épave, et jamais un anneau à travers l'autre.
	func _cible() -> void:
		for k in N * R:
			var lim: float = EPAVE_MAX[k / N]
			var cx := zx[k] + bx[k] * BOSSES
			var cy := zy[k] + by[k] * BOSSES
			var m := Vector2(cx, cy).length()
			if m > lim and m > 0: cx *= lim / m; cy *= lim / m
			tx[k] = cx; ty[k] = cy
		_ordonne(tx, ty)
		touche = true; calme = false; version += 1

	## Un anneau ne passe jamais à travers le suivant, sinon les triangles se retournent.
	func _ordonne(ox: PackedFloat32Array, oy: PackedFloat32Array) -> void:
		for r in range(R - 2, -1, -1):
			for i in N:
				var a := r * N + i
				var b := a + N
				var ex := rx[a] - rx[b]
				var ey := ry[a] - ry[b]
				var el := Vector2(ex, ey).length()
				if el == 0: el = 1
				var ux := ex / el
				var uy := ey / el
				var gap := (rx[a] + ox[a] - rx[b] - ox[b]) * ux + (ry[a] + oy[a] - ry[b] - oy[b]) * uy
				var manque := 0.25 * el - gap
				if manque > 0: ox[a] += ux * manque; oy[a] += uy * manque

	func pas(dt: float) -> void:
		if calme: return
		var n := N * R
		dt = minf(dt, 0.1)
		var sous := maxi(1, ceili(dt / 0.01))
		var hh := dt / sous
		for s in sous:
			for k in n:
				vx[k] += (-RESSORT * (dx[k] - tx[k]) - AMORTI * vx[k]) * hh
				vy[k] += (-RESSORT * (dy[k] - ty[k]) - AMORTI * vy[k]) * hh
				dx[k] += vx[k] * hh; dy[k] += vy[k] * hh
		_ordonne(dx, dy)
		version += 1
		var reste := 0.0
		for k in n: reste = maxf(reste, absf(dx[k] - tx[k]) + absf(dy[k] - ty[k]) + 0.05 * (absf(vx[k]) + absf(vy[k])))
		if reste < 0.002:
			dx = tx.duplicate(); dy = ty.duplicate(); vx.fill(0); vy.fill(0)
			calme = true

	## Le déplacement d'un point du dessin (une roue, un feu) : celui que le dessin subit à cet
	## endroit, interpolé dans le triangle du maillage qui le contient. Dans le cœur, rien ne bouge.
	func decale(x: float, y: float) -> Vector2:
		for r in R - 1:
			for i in N:
				var a := r * N + i
				var b := r * N + (i + 1) % N
				var c := b + N
				var d := a + N
				for t in [[a, b, c], [a, c, d]]:
					var p0: int = t[0]
					var p1: int = t[1]
					var p2: int = t[2]
					var x0 := rx[p0]
					var y0 := ry[p0]
					var x1 := rx[p1] - x0
					var y1 := ry[p1] - y0
					var x2 := rx[p2] - x0
					var y2 := ry[p2] - y0
					var det := x1 * y2 - x2 * y1
					if absf(det) < 1e-9: continue
					var u := ((x - x0) * y2 - x2 * (y - y0)) / det
					var v := (x1 * (y - y0) - (x - x0) * y1) / det
					if u < -1e-6 or v < -1e-6 or u + v > 1 + 1e-6: continue
					var w0 := 1 - u - v
					return Vector2(w0 * dx[p0] + u * dx[p1] + v * dx[p2], w0 * dy[p0] + u * dy[p1] + v * dy[p2])
		return Vector2.ZERO

	## Le maillage : sommets déformés, et leurs coordonnées dans l'image (en pixels).
	func sommets() -> PackedVector2Array:
		var p := PackedVector2Array()
		p.resize(N * R)
		for k in N * R: p[k] = Vector2(rx[k] + dx[k], ry[k] + dy[k])
		return p

	func uv(iw: float, ih: float) -> PackedVector2Array:
		var p := PackedVector2Array()
		p.resize(N * R)
		for k in N * R: p[k] = Vector2((rx[k] + w / 2) * iw / w, (ry[k] + h / 2) * ih / h)
		return p

	## Les triangles entre deux anneaux, et le cœur entouré par l'anneau fixe.
	func polygones() -> Array:
		var out := []
		var coeur := PackedInt32Array()
		for i in N: coeur.append((R - 1) * N + i)
		out.append(coeur)
		for r in R - 1:
			for i in N:
				var a := r * N + i
				var b := r * N + (i + 1) % N
				out.append(PackedInt32Array([a, b, b + N]))
				out.append(PackedInt32Array([a, b + N, a + N]))
		return out
