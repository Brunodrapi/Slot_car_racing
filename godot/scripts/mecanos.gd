## LES MÉCANICIENS DES STANDS (js/mecanos.js, essai des dégâts du jeu web).
##
## Six boxes de huit mètres le long des garages, chacun avec sa couleur et son équipe de six, qui
## attend devant son garage en deux rangs de trois, tournée vers la piste. Quand une voiture
## s'arrête dans la zone, l'équipe du box le plus proche (ou du plus proche qui soit libre) court
## à elle : le scotch au nez et à l'arrière, une roue chacun pour les quatre autres, accroupis, les
## mains sous la carrosserie. Personne ne passe devant la voiture ; on gagne l'autre flanc par
## l'arrière. Un peu avant la fin de la réparation, tous se redressent et se dégagent, puis
## rentrent au garage.
##
## Le scotch se pose patch par patch sur les zones vraiment enfoncées (celles des points de vie),
## éprouvé sur le dessin de la voiture (ni vitre ni roue), et reste au fil des arrêts (VoitureVue).
class_name Mecanos
extends RefCounted

const PAR_BOX := 6
const PAR_GARAGE := 2
const LARGEUR_BOX := 8.0
const TAILLE := 1.1          # m : le sprite, un peu plus grand que nature pour se lire
const MARCHE := 5.0          # m/s : une équipe de stand court
const CADENCE := 7.0         # pas par seconde à la marche
const GESTE := 4.0           # gestes par seconde au travail
const DEGAGE := 0.7          # s avant la fin de la réparation : on se redresse et on laisse la voie
const MARGE := 0.6           # m : la distance à la carrosserie quand on contourne la voiture
const COULEURS := ["#d8342c", "#2f6fd6", "#2aa85a", "#f2b705", "#f07b1d", "#8b4fd1",
	"#1fb3b3", "#e25aa0", "#8aa02a", "#c9cdd1", "#4a4f56", "#a0522d"]
enum { ATTENTE, MARCHE_A, MARCHE_B, REPARE_A, REPARE_B, DEGAGE_P, SCOTCH }
const POSES := 7
const RANGS := 3 * PAR_GARAGE   # une couleur par box : trois garages de deux boxes au plus (Piste.pitGarages)
const CASE := 128               # px : une case de la planche
const BORD := 0.68              # m : la demi-case ; les mains et le scotch dépassent du mètre de la pose

## Les poses dessinées une fois pour toutes dans une planche, sept poses sur six couleurs : chaque
## mécanicien n'est plus qu'une image de la planche, et tous partent en un seul appel de dessin.
## Dessinés trait par trait, ellipses, contours et gants, ils en coûtaient une vingtaine chacun :
## 800 par image devant les stands, de quoi faire ramer un téléphone.
static var planche: Texture2D = null
static var _enCours := false

var track: Piste
var boxes: Array = []        # { s, couleur, voiture, cote, equipe }
var parVoiture := {}         # Voiture -> le box qu'elle occupe


func _init(T: Piste) -> void:
	track = T
	for gr in T.pitGarages():
		for k in PAR_GARAGE:
			var s := T.wrap_(float(gr.s) + (k - (PAR_GARAGE - 1) / 2.0) * LARGEUR_BOX)
			if not T.pitAt(s).is_empty(): boxes.append({ s = s, couleur = Color.WHITE, voiture = null, cote = 1.0, equipe = [] })
	boxes.sort_custom(func(a, b): return T.diff(b.s, a.s) > 0)
	for i in boxes.size():
		var b: Dictionary = boxes[i]
		b.couleur = Color(COULEURS[i % COULEURS.size()])
		var z := T.pitAt(b.s)
		var h := T.headingAt(b.s)
		var piste := T.pos2(b.s, 0)
		var centre := T.pos2(b.s, float(z.externe) + 1)
		var face := atan2(piste[1] - centre[1], piste[0] - centre[0])
		for j in PAR_BOX:
			var d := (j % 3 - 1) * 0.85
			var lat := float(z.externe) + (0.6 if j < 3 else 1.35)
			var q := T.pos2(b.s, lat)
			var x := q[0] + cos(h) * d
			var y := q[1] + sin(h) * d
			b.equipe.append({ home = { x = x, y = y, a = face }, x = x, y = y, a = face, pose = ATTENTE, etat = "attente",
				t = randf() * 3, route = [], place = j, dessus = false })


## Les places autour de la voiture, dans son repère : le scotch au nez et à l'arrière, une roue
## chacun pour les quatre autres.
static func places(car: Voiture) -> Array:
	var L := car.cls.length / 2
	var W := car.cls.width / 2
	var e := 0.42
	var xr := L * 0.62
	var yr := W + 0.32
	return [{ x = L + e, y = 0.0, scotch = true }, { x = -(L + e), y = 0.0, scotch = true },
		{ x = xr, y = yr, scotch = false }, { x = xr, y = -yr, scotch = false },
		{ x = -xr, y = yr, scotch = false }, { x = -xr, y = -yr, scotch = false }]


static func local(car: Voiture, x: float, y: float) -> Vector2:
	var cs := cos(car.th)
	var sn := sin(car.th)
	var dx := x - car.x
	var dy := y - car.y
	return Vector2(dx * cs + dy * sn, -dx * sn + dy * cs)


static func monde(car: Voiture, lx: float, ly: float) -> Vector2:
	var cs := cos(car.th)
	var sn := sin(car.th)
	return Vector2(car.x + lx * cs - ly * sn, car.y + lx * sn + ly * cs)


## LE CHEMIN : jamais devant la voiture, jamais à travers ; l'autre flanc par l'arrière.
static func chemin(car: Voiture, depuis: Dictionary, vers: Vector2, a: float, cote: float) -> Array:
	var L := car.cls.length / 2
	var W := car.cls.width / 2
	var Lm := L + MARGE
	var Wm := W + MARGE
	var S := local(car, depuis.x, depuis.y)
	var P := local(car, vers.x, vers.y)
	var flanc := func(q: Vector2) -> float: return signf(q.y) if absf(q.y) > W else 0.0
	var fS: float = flanc.call(S)
	var fP: float = flanc.call(P)
	var pts := []
	var coin := func(x: float, y: float) -> void:
		var m := monde(car, x, y)
		pts.append({ x = m.x, y = m.y, a = 0.0 })
	if fS != 0:
		if fP == fS: pass
		elif fP == 0: coin.call(Lm if P.x > 0 else -Lm, fS * Wm)
		else: coin.call(-Lm, fS * Wm); coin.call(-Lm, fP * Wm)
	else:
		var c: float = fP if fP != 0 else (cote if cote != 0 else 1.0)
		if S.x < 0:
			if fP != 0 or P.x > 0: coin.call(-Lm, c * Wm)
			if fP == 0 and P.x > 0: coin.call(Lm, c * Wm)
		else:
			coin.call(Lm, c * Wm)
			if fP == 0 and P.x < 0: coin.call(-Lm, c * Wm)
	pts.append({ x = vers.x, y = vers.y, a = a })
	return pts


## Un pas : les voitures qui viennent de s'arrêter prennent un box ; les équipes courent, travaillent,
## se dégagent et rentrent.
func pas(course: Course, vues: Array, dt: float) -> bool:
	var T := track
	var bouge := false
	for i in course.cars.size():
		var car: Voiture = course.cars[i]
		var vue: VoitureVue = vues[i]
		if car.pitState == "arret" and not parVoiture.has(car):
			var libres := boxes.filter(func(b): return b.voiture == null)
			var choix: Dictionary = {}
			for b in (libres if libres.size() else boxes):
				if choix.is_empty() or absf(T.diff(car.s, b.s)) < absf(T.diff(car.s, choix.s)): choix = b
			if choix.is_empty(): continue
			choix.voiture = car
			parVoiture[car] = choix
			vue.scotch = { avant = 0.0, arriere = 0.0 }
			vue.patchsNeufs(car)
			var h0: Dictionary = choix.equipe[0].home
			var cote := signf(local(car, h0.x, h0.y).y)
			choix.cote = cote if cote != 0 else 1.0
		if parVoiture.has(car) and car.pitState != "arret":
			var b: Dictionary = parVoiture[car]
			b.voiture = null
			parVoiture.erase(car)
			for q in vue.patchs: q.cetArret = false
			vue.scotchNoeud.queue_redraw()
			for m in b.equipe:
				if m.etat != "attente":
					m.etat = "retour"
					m.route = chemin(car, m, Vector2(m.home.x, m.home.y), m.home.a, b.cote)
	for b in boxes:
		var car: Voiture = b.voiture
		var pl := places(car) if car else []
		for m in b.equipe:
			m.t += dt
			if car:
				bouge = true
				var vue: VoitureVue = vues[course.cars.find(car)]
				var p: Dictionary = pl[m.place]
				var w := monde(car, p.x, p.y)
				var face := atan2(car.y - w.y, car.x - w.x)
				if car.pitT <= DEGAGE:
					if m.etat != "degage":
						var enRoute: bool = m.etat == "aller"
						m.etat = "degage"
						var L := car.cls.length / 2
						var W := car.cls.width / 2
						var q: Vector2
						if p.scotch and p.x > 0: q = monde(car, L + 0.3, b.cote * (W + 1.0))
						elif p.scotch: q = monde(car, p.x - 0.9, 0)
						else: q = monde(car, p.x, p.y + signf(p.y) * 0.9)
						m.route = chemin(car, m, q, face, b.cote) if enRoute else [{ x = q.x, y = q.y, a = face }]
					_marche(m, dt)
					m.pose = DEGAGE_P
				else:
					if m.etat == "attente" or m.etat == "retour":
						m.etat = "aller"
						m.route = chemin(car, m, w, face, b.cote)
					if m.etat == "aller" and _marche(m, dt):
						m.etat = "travail"; m.t = 0.0
					if m.etat == "travail":
						m.x = w.x; m.y = w.y; m.a = face
						m.pose = SCOTCH if p.scotch else (REPARE_B if int(floorf(m.t * GESTE + m.place)) % 2 else REPARE_A)
						# le scotch se déroule au rythme qui le finit pile au dégagement
						if p.scotch and not vue.scotch.is_empty():
							var k := "avant" if p.x > 0 else "arriere"
							var reste := maxf(dt, car.pitT - DEGAGE)
							vue.scotch[k] = minf(1, vue.scotch[k] + (1 - vue.scotch[k]) * minf(1, dt / reste))
							vue.scotchNoeud.queue_redraw()
				m.dessus = p.scotch and m.etat == "travail"
			else:
				m.dessus = false
				if m.etat == "retour":
					bouge = true
					if _marche(m, dt): m.etat = "attente"; m.a = m.home.a; m.pose = ATTENTE
				elif m.etat != "attente":
					m.etat = "retour"; m.route = [m.home.duplicate()]
				else:
					m.pose = ATTENTE; m.a = m.home.a
	return bouge


## Un pas le long du chemin ; vrai une fois au bout.
func _marche(m: Dictionary, dt: float) -> bool:
	var reste := MARCHE * dt
	while m.route.size():
		var c: Dictionary = m.route[0]
		var dx: float = c.x - m.x
		var dy: float = c.y - m.y
		var d := Vector2(dx, dy).length()
		if d <= reste:
			m.x = c.x; m.y = c.y; reste -= d
			m.route.pop_front()
			if m.route.is_empty():
				m.a = c.a
				return true
			continue
		m.x += dx / d * reste; m.y += dy / d * reste; m.a = atan2(dy, dx)
		m.pose = MARCHE_B if int(floorf(m.t * CADENCE)) % 2 else MARCHE_A
		return false
	return true


## Le dessin d'une couche : « dessous » (sous les voitures — les mains de ceux des roues passent
## sous la caisse) ou « dessus » (ceux du scotch, le rouleau posé sur la carrosserie).
func dessine(ci: CanvasItem, dessus: bool) -> void:
	var tex := Mecanos.planche
	for i in boxes.size():
		var b: Dictionary = boxes[i]
		for m in b.equipe:
			if m.dessus != dessus: continue
			ci.draw_set_transform(Vector2(m.x, m.y), m.a + PI / 2, Vector2(TAILLE, TAILLE))
			if tex != null and i < RANGS:
				ci.draw_texture_rect_region(tex, Rect2(-BORD, -BORD, 2 * BORD, 2 * BORD), Rect2(int(m.pose) * CASE, i * CASE, CASE, CASE))
			else:
				Mecanos.pose(ci, m.pose, b.couleur)
	ci.draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)


## La planche des poses (voir `planche`), dessinée par la carte graphique dans une vue cachée puis
## relue une fois. Ses couleurs sortent prémultipliées par leur opacité : on la pose avec
## `materiau()`. Rend vrai quand elle est prête.
static func preparePlanche(parent: Node) -> bool:
	if planche != null: return true
	if _enCours: return false
	_enCours = true
	var vp := SubViewport.new()
	vp.size = Vector2i(CASE * POSES, CASE * RANGS)
	vp.transparent_bg = true
	vp.disable_3d = true
	vp.render_target_update_mode = SubViewport.UPDATE_ONCE
	var toile := Node2D.new()
	toile.draw.connect(func():
		for r in RANGS:
			for p in POSES:
				toile.draw_set_transform(Vector2((p + 0.5) * CASE, (r + 0.5) * CASE), 0, Vector2.ONE * CASE / (2 * BORD))
				Mecanos.pose(toile, p, Color(COULEURS[r]))
		toile.draw_set_transform(Vector2.ZERO, 0, Vector2.ONE))
	vp.add_child(toile)
	parent.add_child(vp)
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	if not is_instance_valid(vp):
		_enCours = false
		return false
	var img := vp.get_texture().get_image()
	vp.queue_free()
	_enCours = false
	if img == null or img.is_empty(): return false
	img.generate_mipmaps()
	planche = ImageTexture.create_from_image(img)
	return true


static var _materiau: CanvasItemMaterial = null
static func materiau() -> CanvasItemMaterial:
	if _materiau == null:
		_materiau = CanvasItemMaterial.new()
		_materiau.blend_mode = CanvasItemMaterial.BLEND_MODE_PREMULT_ALPHA
	return _materiau


## Une pose, dans un carré d'un mètre centré, l'avant vers le haut (−y) : le casque blanc à bande
## noire, la combinaison à la couleur du box, gants et chaussures sombres, le gros contour noir.
static func pose(g: CanvasItem, p: int, couleur: Color) -> void:
	var epais := 0.045
	var noir := Color("#141414")
	var gant := Color("#3b3b3b")
	var accroupi := p == REPARE_A or p == REPARE_B or p == SCOTCH
	var pieds: Array = {
		ATTENTE: [[-0.1, 0.33], [0.1, 0.33]], MARCHE_A: [[-0.1, 0.22], [0.1, 0.38]], MARCHE_B: [[-0.1, 0.38], [0.1, 0.22]],
		REPARE_A: [[-0.19, 0.3], [0.19, 0.3]], REPARE_B: [[-0.19, 0.3], [0.19, 0.3]], DEGAGE_P: [[-0.1, 0.36], [0.1, 0.28]],
		SCOTCH: [[-0.16, 0.32], [0.16, 0.32]] }[p]
	var mains: Array = {
		ATTENTE: [[-0.31, 0.16, 0], [0.31, 0.16, 0]], MARCHE_A: [[-0.3, 0.26, 0], [0.27, -0.3, 0]], MARCHE_B: [[-0.27, -0.3, 0], [0.3, 0.26, 0]],
		REPARE_A: [[-0.22, -0.43, 1], [0.22, -0.43, 1]], REPARE_B: [[-0.25, -0.43, 1], [0.24, -0.2, 0]],
		DEGAGE_P: [[-0.34, -0.06, 0], [0.34, -0.06, 0]], SCOTCH: [[-0.2, -0.4, 0], [0.2, -0.4, 0]] }[p]
	_ellipse(g, Vector2(0.04, 0.06), 0.36, 0.34, Color(0, 0, 0, 0.18), Color(0, 0, 0, 0), 0)
	for f in pieds: _ellipse(g, Vector2(f[0], f[1]), 0.075, 0.06, gant, noir, epais)
	for hm in mains:
		var s := Vector2(signf(hm[0]) * 0.24, -0.02)
		var e := Vector2(hm[0], hm[1]) * 0.92
		g.draw_line(s, e, noir, 0.17)
		g.draw_line(s, e, couleur, 0.17 - epais * 2)
		g.draw_circle(s, 0.085 - epais, couleur)
		g.draw_circle(e, 0.085 - epais, couleur)
	if accroupi: _ellipse(g, Vector2(0, 0.09), 0.27, 0.22, couleur, noir, epais)
	else:
		var corps := PackedVector2Array([Vector2(-0.25, -0.04), Vector2(-0.17, -0.12), Vector2(0.17, -0.12), Vector2(0.25, -0.04),
			Vector2(0.25, 0.22), Vector2(0.17, 0.3), Vector2(-0.17, 0.3), Vector2(-0.25, 0.22)])
		g.draw_colored_polygon(corps, couleur)
		corps.append(corps[0])
		g.draw_polyline(corps, noir, epais)
	g.draw_line(Vector2(0, 0.1), Vector2(0, 0.3), Color(0, 0, 0, 0.35), 0.02)
	for hm in mains:
		if hm[2]:
			_ellipse(g, Vector2(hm[0], hm[1]), 0.085, 0.075, gant, noir, epais)
			for d in [-0.05, -0.017, 0.017, 0.05]: _ellipse(g, Vector2(hm[0] + d, hm[1] - 0.075), 0.022, 0.022, gant, noir, epais)
		else: _ellipse(g, Vector2(hm[0], hm[1]), 0.072, 0.072, gant, noir, epais)
	if p == SCOTCH:
		g.draw_line(Vector2(-0.2, -0.47), Vector2(0.22, -0.47), noir, 0.075)
		g.draw_line(Vector2(-0.2, -0.47), Vector2(0.22, -0.47), Color("#8d9093"), 0.075 - epais)
		_ellipse(g, Vector2(-0.24, -0.47), 0.085, 0.085, Color("#8d9093"), noir, epais)
		_ellipse(g, Vector2(-0.24, -0.47), 0.035, 0.035, Color("#6b4f2a"), noir, epais)
	_ellipse(g, Vector2(0, -0.07), 0.205, 0.205, Color("#f4f4f2"), Color(0, 0, 0, 0), 0)
	g.draw_rect(Rect2(-0.035, -0.27, 0.07, 0.4), noir)
	_ellipse(g, Vector2(0.05, 0.02), 0.13, 0.13, Color(0, 0, 0, 0.14), Color(0, 0, 0, 0), 0)
	_ellipse(g, Vector2(0, -0.07), 0.205, 0.205, Color(0, 0, 0, 0), noir, epais)


static func _ellipse(g: CanvasItem, c: Vector2, rx: float, ry: float, fond: Color, bord: Color, w: float) -> void:
	var pts := PackedVector2Array()
	for i in 16: pts.append(c + Vector2(cos(i * TAU / 16) * rx, sin(i * TAU / 16) * ry))
	if fond.a > 0: g.draw_colored_polygon(pts, fond)
	if w > 0 and bord.a > 0:
		pts.append(pts[0])
		g.draw_polyline(pts, bord, w)


## UN PATCH DE SCOTCH au hasard dans la zone `k`, éprouvé sur le dessin ; vide si rien ne convient.
## Une bande, deux en croix, deux qui se chevauchent ou trois en éventail ; 30 à 50 cm sur 12 à 16.
static func tirePatch(L: float, W: float, k: int, n: int, accepte: Callable) -> Dictionary:
	var gris := func() -> Color:
		var v := 140 + randi() % 40
		return Color8(v, v + 2, v + 1)
	for essai in 30:
		var ouvre := 0.5 if essai < 20 else 0.9
		var a := k * TAU / n + (randf() - 0.5) * 2 * ouvre
		var cx := cos(a)
		var cy := sin(a)
		var s := 1 / maxf(absf(cx), absf(cy))
		var r := 0.55 + randf() * 0.38
		var x := cx * s * L * r
		var y := cy * s * W * r
		var forme := randf()
		var base := randf() * PI
		var teinte: Color = gris.call()
		var bande := func(dx: float, dy: float, ang: float, f := 1.0) -> Dictionary:
			var bouts := []
			for i in 6: bouts.append(randf())
			return { dx = dx, dy = dy, a = ang, l = (0.3 + randf() * 0.2) * f, w = 0.12 + randf() * 0.04,
				teinte = teinte if randf() < 0.7 else gris.call(), bouts = bouts, pli = 0.15 + randf() * 0.35 }
		var bandes := []
		if forme < 0.35: bandes = [bande.call(0.0, 0.0, base)]
		elif forme < 0.7: bandes = [bande.call(0.0, 0.0, base), bande.call((randf() - 0.5) * 0.06, (randf() - 0.5) * 0.06, base + 0.7 + randf() * 0.7, 0.9)]
		elif forme < 0.88:
			var o := 0.06 + randf() * 0.05
			bandes = [bande.call(-sin(base) * o, cos(base) * o, base), bande.call(sin(base) * o, -cos(base) * o, base + (randf() - 0.5) * 0.25, 0.9)]
		else:
			for j in [-1, 0, 1]: bandes.append(bande.call(j * 0.03, j * 0.03, base + j * (0.35 + randf() * 0.2), 0.8))
		var q := { x = x, y = y, bandes = bandes, avant = x >= 0, cetArret = true, seuil = 0.0, debut = 0.0 }
		if accepte.call(q): return q
	return {}
