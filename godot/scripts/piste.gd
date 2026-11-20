## Le circuit, tel que le jeu web le calcule (js/track.js).
##
## Rien n'est recalculé ici : les tableaux sortent de `tools/godot-exporte.js`, qui construit le
## circuit avec le code du jeu, puis les écrit en flottants 64 bits. Ce fichier ne porte que les
## LECTURES dont la physique a besoin — interpolations, projection, protections — avec les mêmes
## noms que dans track.js, pour qu'on puisse relire les deux côte à côte.
class_name Piste
extends RefCounted

var id: String
var nom: String
var n: int
var ds: float
var length: float
var halfWidth: float
var barrierCell: float

var xs: PackedFloat64Array
var ys: PackedFloat64Array
var th: PackedFloat64Array
var nx: PackedFloat64Array
var ny: PackedFloat64Array
var k: PackedFloat64Array
var hwL: PackedFloat64Array
var hwR: PackedFloat64Array
var kerb: PackedFloat64Array
var lines := {}        # racing, jaune, bleu : la position latérale de chaque ligne
var lineK := {}        # leur courbure
var asphaltW := {}     # L, R : la largeur de dégagement en bitume
var bacW := {}         # L, R : la largeur de bac à gravier
var crossings: PackedFloat64Array

# Les protections, en tableaux parallèles (un indice par segment).
var b_ax: PackedFloat64Array
var b_ay: PackedFloat64Array
var b_bx: PackedFloat64Array
var b_by: PackedFloat64Array
var b_tx: PackedFloat64Array
var b_ty: PackedFloat64Array
var b_nx: PackedFloat64Array
var b_ny: PackedFloat64Array
var b_len: PackedFloat64Array
var b_half: PackedFloat64Array
var b_s: PackedFloat64Array
var b_side: PackedFloat64Array
var b_level: PackedFloat64Array
var b_pneus: PackedByteArray
var nBarrieres: int = 0
var barrierGrid := {}  # Vector2i -> PackedInt32Array, dans l'ordre de track.js

var width: float
var asphalte := true    # faux : le circuit n'a pas de dégagement bitumé (asphaltW absent)
var tours := 3
var pays := ""
var drapeau := ""
var theme := ""
# Les plaques posées à la main (track.pads) : surface (0 bitume, 1 gravier), boîte, polygone.
var plaques: Array = []


static func charge(chemin: String) -> Piste:
	var p := Piste.new()
	var meta: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(chemin + ".json"))
	var blob := FileAccess.get_file_as_bytes(chemin + ".bin").to_float64_array()
	var lit := func(cle: String) -> PackedFloat64Array:
		var r: Array = meta.index[cle]
		return blob.slice(int(r[0]), int(r[0]) + int(r[1]))
	p.id = meta.id
	p.nom = meta.nom
	p.tours = int(meta.tours)
	p.pays = meta.get("pays", "")
	p.drapeau = meta.get("drapeau", "")
	p.theme = meta.get("theme", "")
	p.asphalte = meta.get("asphalte", true)
	var sc: PackedFloat64Array = lit.call("scalaires")
	p.n = int(sc[0]); p.ds = sc[1]; p.length = sc[2]; p.halfWidth = sc[3]; p.barrierCell = sc[4]; p.width = sc[5]
	p.xs = lit.call("xs"); p.ys = lit.call("ys"); p.th = lit.call("th")
	p.nx = lit.call("nx"); p.ny = lit.call("ny"); p.k = lit.call("k")
	p.hwL = lit.call("hwL"); p.hwR = lit.call("hwR"); p.kerb = lit.call("kerb")
	for l in ["racing", "jaune", "bleu"]:
		p.lines[l] = lit.call("ligne_" + l)
		p.lineK[l] = lit.call("lineK_" + l)
	for c in ["L", "R"]:
		p.asphaltW[c] = lit.call("asphaltW_" + c)
		p.bacW[c] = lit.call("bacW_" + c)
	p.crossings = lit.call("croisements")
	var pl: PackedFloat64Array = lit.call("plaques")
	var o := 0
	while o < pl.size():
		var nb := int(pl[o + 1])
		p.plaques.append({ gravier = pl[o] == 1, bbox = [pl[o + 2], pl[o + 3], pl[o + 4], pl[o + 5]], poly = pl.slice(o + 6, o + 6 + nb * 2) })
		o += 6 + nb * 2
	p._chargeBarrieres(lit.call("barrieres"), (meta.barriere.champs as Array).size())
	return p


func _chargeBarrieres(a: PackedFloat64Array, largeur: int) -> void:
	nBarrieres = a.size() / largeur
	for arr in ["b_ax", "b_ay", "b_bx", "b_by", "b_tx", "b_ty", "b_nx", "b_ny", "b_len", "b_half", "b_s", "b_side", "b_level"]:
		var v := PackedFloat64Array()
		v.resize(nBarrieres)
		set(arr, v)
	b_pneus.resize(nBarrieres)
	for i in nBarrieres:
		var o := i * largeur
		b_ax[i] = a[o]; b_ay[i] = a[o + 1]; b_bx[i] = a[o + 2]; b_by[i] = a[o + 3]
		b_tx[i] = a[o + 4]; b_ty[i] = a[o + 5]; b_nx[i] = a[o + 6]; b_ny[i] = a[o + 7]
		b_len[i] = a[o + 8]; b_half[i] = a[o + 9]; b_s[i] = a[o + 10]; b_side[i] = a[o + 11]
		b_level[i] = a[o + 12]; b_pneus[i] = int(a[o + 13])
	# La grille se reconstruit exactement comme dans track.js : même parcours, même ordre.
	var C := barrierCell
	for id in nBarrieres:
		var h := b_half[id]
		for x in range(int(floorf((minf(b_ax[id], b_bx[id]) - h) / C)), int(floorf((maxf(b_ax[id], b_bx[id]) + h) / C)) + 1):
			for y in range(int(floorf((minf(b_ay[id], b_by[id]) - h) / C)), int(floorf((maxf(b_ay[id], b_by[id]) + h) / C)) + 1):
				var cle := Vector2i(x, y)
				if not barrierGrid.has(cle):
					barrierGrid[cle] = PackedInt32Array()
				var l: PackedInt32Array = barrierGrid[cle]
				l.append(id)
				barrierGrid[cle] = l


# ---------- les mêmes aides que js/util.js ----------
static func clamp_(v: float, a: float, b: float) -> float:
	return a if v < a else (b if v > b else v)


## Math.hypot de V8 : normalisé par le plus grand, sommé avec compensation de Kahan. Le
## sqrt(x*x + y*y) naïf diffère de lui dans un tiers des cas, à la dernière décimale.
static func hypot(a: float, b: float) -> float:
	var x := absf(a)
	var y := absf(b)
	var m := x if x > y else y
	if m == 0.0:
		return 0.0
	var n1 := x / m
	var somme := n1 * n1
	var comp := (somme - 0.0) - somme
	var n2 := y / m
	var terme := n2 * n2 - comp
	somme = somme + terme
	return sqrt(somme) * m


# ---------- les lectures de track.js ----------
func wrap_(s: float) -> float:
	s = fmod(s, length)
	return s + length if s < 0.0 else s


func idx(s: float) -> int:
	return int(floorf(wrap_(s) / ds)) % n


func _lerp(arr: PackedFloat64Array, s: float) -> float:
	var w := wrap_(s) / ds
	var fl := floorf(w)
	var i := int(fl) % n
	var j := (i + 1) % n
	return arr[i] + (arr[j] - arr[i]) * (w - fl)


func curvAt(s: float) -> float:
	return _lerp(k, s)


func headingAt(s: float) -> float:
	var w := wrap_(s) / ds
	var fl := floorf(w)
	var i := int(fl) % n
	var j := (i + 1) % n
	var d := th[j] - th[i]
	while d > PI: d -= 2 * PI
	while d < -PI: d += 2 * PI
	return th[i] + d * (w - fl)


func curvAtLat(s: float, lat: float) -> float:
	var kk := curvAt(s)
	return kk / maxf(0.25, 1 + kk * lat)


func kerbAt(s: float) -> float:
	return _lerp(kerb, s)


func hwLeftAt(s: float) -> float:
	return _lerp(hwL, s)


func hwRightAt(s: float) -> float:
	return _lerp(hwR, s)


## La voie des stands (sel < -1) n'est pas portée : le joueur ne quitte jamais [-1, 1], et à -1
## track.js rend la même valeur que la ligne intérieure.
func targetLat(s: float, sel: float) -> float:
	var r := _lerp(lines.racing, s)
	if sel >= 0:
		return r + (_lerp(lines.jaune, s) - r) * minf(1, sel)
	return r + (_lerp(lines.bleu, s) - r) * minf(1, -sel)


func lineCurv(s: float, sel: float) -> float:
	var r := _lerp(lineK.racing, s)
	if sel < 0:
		return r + (_lerp(lineK.bleu, s) - r) * minf(1, -sel)
	return r + (_lerp(lineK.jaune, s) - r) * minf(1, sel)


## Le point de la ligne centrale le plus proche, cherché dans une fenêtre autour de `nearS`.
## Rend [s, i, lat].
func project(x: float, y: float, nearS: float, window: int = 8) -> PackedFloat64Array:
	var N := n
	var W := window
	var i0 := idx(nearS)
	var best := i0
	var bd := INF
	for d in range(-W, W + 1):
		var i := ((i0 + d) % N + N) % N
		var dx := x - xs[i]
		var dy := y - ys[i]
		var dd := dx * dx + dy * dy
		if dd < bd:
			bd = dd; best = i
	var i := best
	var j := (i + 1) % N
	var h := (i - 1 + N) % N
	var bi := i
	var t := 0.0
	for paire in [[h, i], [i, j]]:
		var a: int = paire[0]
		var b: int = paire[1]
		var ax := xs[a]
		var ay := ys[a]
		var vx := xs[b] - ax
		var vy := ys[b] - ay
		var l2 := vx * vx + vy * vy
		if l2 == 0.0: l2 = 1e-9
		var u := clamp_(((x - ax) * vx + (y - ay) * vy) / l2, 0, 1)
		var px := ax + vx * u
		var py := ay + vy * u
		var dd := (x - px) * (x - px) + (y - py) * (y - py)
		if dd < bd:
			bd = dd; bi = a; t = u
	var sOut := (bi + t) * ds
	return PackedFloat64Array([sOut, bi, (x - xs[bi]) * nx[bi] + (y - ys[bi]) * ny[bi]])


func pos(s: float, lat: float) -> Vector2:
	# Vector2 est en simple précision : on ne s'en sert que pour dessiner. La physique lit pos2.
	var p := pos2(s, lat)
	return Vector2(p[0], p[1])


func pos2(s: float, lat: float) -> PackedFloat64Array:
	var w := wrap_(s) / ds
	var fl := floorf(w)
	var i := int(fl) % n
	var j := (i + 1) % n
	var f := w - fl
	var x := xs[i] + (xs[j] - xs[i]) * f
	var y := ys[i] + (ys[j] - ys[i]) * f
	var nnx := nx[i] + (nx[j] - nx[i]) * f
	var nny := ny[i] + (ny[j] - ny[i]) * f
	return PackedFloat64Array([x + nnx * lat, y + nny * lat])


func diff(a: float, b: float) -> float:
	var d := wrap_(b) - wrap_(a)
	var L := length
	if d > L / 2: d -= L
	if d <= -L / 2: d += L
	return d


## La surface hors de la chaussée (track.runoffSurfaceAt) : asphalt, gravel ou grass.
func surfaceAt(s: float, lat: float) -> String:
	var gauche := lat >= 0
	var d := absf(lat) - (hwLeftAt(s) if gauche else hwRightAt(s))
	if d <= 0: return "asphalt"
	if not plaques.is_empty():
		var q := pos2(s, lat)
		var sur := padAt(q[0], q[1])
		if sur != "": return sur
	var c := "L" if gauche else "R"
	if asphalte and d <= _lerp(asphaltW[c], s): return "asphalt"
	if d <= _lerp(bacW[c], s): return "gravel"
	return "grass"


## car.runoffAsphalt : un dégagement où l'on garde de l'adhérence.
func runoffAsphaltAt(s: float, lat: float) -> bool:
	if not asphalte: return false
	return surfaceAt(s, lat) == "asphalt"


func padAt(x: float, y: float) -> String:
	for k in range(plaques.size() - 1, -1, -1):
		var p: Dictionary = plaques[k]
		var b: Array = p.bbox
		if x < b[0] or x > b[1] or y < b[2] or y > b[3]: continue
		var poly: PackedFloat64Array = p.poly
		var m := poly.size() / 2
		var dedans := false
		var j := m - 1
		for i in m:
			var xi := poly[i * 2]
			var yi := poly[i * 2 + 1]
			var xj := poly[j * 2]
			var yj := poly[j * 2 + 1]
			if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
				dedans = not dedans
			j = i
		if dedans: return "gravel" if p.gravier else "asphalt"
	return ""


# ---------- les protections ----------
func barrierLevelAt(s: float) -> int:
	for over in crossings:
		if absf(diff(s, over * ds)) < 24:
			return 1
	return 0


func barrierCandidates(x0: float, y0: float, x1: float, y1: float, pad: float) -> PackedInt32Array:
	var ids := {}
	if nBarrieres == 0:
		return PackedInt32Array()
	var C := barrierCell
	for x in range(int(floorf((minf(x0, x1) - pad) / C)), int(floorf((maxf(x0, x1) + pad) / C)) + 1):
		for y in range(int(floorf((minf(y0, y1) - pad) / C)), int(floorf((maxf(y0, y1) + pad) / C)) + 1):
			var cle := Vector2i(x, y)
			if barrierGrid.has(cle):
				for id in barrierGrid[cle]:
					ids[id] = true
	return PackedInt32Array(ids.keys())


## Balayage continu d'un disque contre un segment épaissi : corps et extrémités.
## Rend [t, nx, ny, depth], ou un tableau vide.
func sweepBarrier(x: float, y: float, dx: float, dy: float, b: int, r: float) -> PackedFloat64Array:
	r += b_half[b]
	var tx := b_tx[b]
	var ty := b_ty[b]
	var ln := b_len[b]
	var u := (x - b_ax[b]) * tx + (y - b_ay[b]) * ty
	var v := (x - b_ax[b]) * -ty + (y - b_ay[b]) * tx
	var du := dx * tx + dy * ty
	var dv := dx * -ty + dy * tx
	var best := PackedFloat64Array()
	var q := clamp_(u, 0, ln)
	var ex := u - q
	var dist := hypot(ex, v)
	if dist < r:
		var nnx := (ex * tx - v * ty) / dist if dist > 1e-8 else b_nx[b]
		var nny := (ex * ty + v * tx) / dist if dist > 1e-8 else b_ny[b]
		best = _accepte(best, 0, nnx, nny, r - dist, dx, dy)
	if absf(dv) > 1e-10:
		for sgn in [-1.0, 1.0]:
			var t: float = (sgn * r - v) / dv
			var along := u + du * t
			if along >= 0 and along <= ln:
				best = _accepte(best, t, -ty * sgn, tx * sgn, 0, dx, dy)
	var aa := dx * dx + dy * dy
	if aa > 1e-12:
		for fin in [0.0, ln]:
			var e2: float = u - fin
			var bb := 2 * (e2 * du + v * dv)
			var cc := e2 * e2 + v * v - r * r
			var disc := bb * bb - 4 * aa * cc
			if disc < 0:
				continue
			var t := (-bb - sqrt(disc)) / (2 * aa)
			var px := e2 + du * t
			var py := v + dv * t
			best = _accepte(best, t, (px * tx - py * ty) / r, (px * ty + py * tx) / r, 0, dx, dy)
	return best


static func _accepte(best: PackedFloat64Array, t: float, nnx: float, nny: float, depth: float, dx: float, dy: float) -> PackedFloat64Array:
	if t < 0 or t > 1 or dx * nnx + dy * nny >= -1e-9:
		return best
	if best.is_empty() or t < best[0]:
		return PackedFloat64Array([t, nnx, nny, depth])
	return best


## Le premier contact des trois disques de la carrosserie (nez, habitacle, arrière) entre la
## position `from` et la position actuelle. Rend [t, nx, ny, depth, barriere], ou vide.
func barrierHit(car, fx: float, fy: float, fth: float) -> PackedFloat64Array:
	var pad: float = car.cls.length / 2 + car.cls.width / 2
	var cand := barrierCandidates(fx, fy, car.x, car.y, pad)
	if cand.is_empty():
		return PackedFloat64Array()
	var r: float = car.cls.width / 2
	var arm := maxf(0, car.cls.length / 2 - r)
	var best := PackedFloat64Array()
	var niveau := barrierLevelAt(car.s)
	for d in [-arm, 0.0, arm]:
		var x: float = fx + cos(fth) * d
		var y: float = fy + sin(fth) * d
		var dx: float = car.x + cos(car.th) * d - x
		var dy: float = car.y + sin(car.th) * d - y
		for b in cand:
			if int(b_level[b]) != niveau:
				continue
			var hit := sweepBarrier(x, y, dx, dy, b, r)
			if not hit.is_empty() and (best.is_empty() or hit[0] < best[0]):
				best = hit
				best.append(b)
	return best


func lineLat(nomLigne: String, s: float) -> float:
	return _lerp(lines[nomLigne], s)



## Tout ce que le moteur C++ (natif/) doit connaître du circuit.
func pourNatif() -> Dictionary:
	var b := PackedFloat64Array()
	b.resize(nBarrieres * 14)
	for i in nBarrieres:
		var o := i * 14
		b[o] = b_ax[i]; b[o + 1] = b_ay[i]; b[o + 2] = b_bx[i]; b[o + 3] = b_by[i]; b[o + 4] = b_tx[i]; b[o + 5] = b_ty[i]
		b[o + 6] = b_nx[i]; b[o + 7] = b_ny[i]; b[o + 8] = b_len[i]; b[o + 9] = b_half[i]; b[o + 10] = b_s[i]; b[o + 11] = b_side[i]
		b[o + 12] = b_level[i]; b[o + 13] = b_pneus[i]
	var pl := PackedFloat64Array()
	for p in plaques:
		pl.append(1.0 if p.gravier else 0.0); pl.append(p.poly.size() / 2)
		for q in p.bbox: pl.append(q)
		pl.append_array(p.poly)
	return { n = n, ds = ds, length = length, halfWidth = halfWidth, barrierCell = barrierCell, asphalte = asphalte,
		xs = xs, ys = ys, th = th, nx = nx, ny = ny, k = k, hwL = hwL, hwR = hwR, kerb = kerb,
		ligne_racing = lines.racing, ligne_jaune = lines.jaune, ligne_bleu = lines.bleu,
		lineK_racing = lineK.racing, lineK_jaune = lineK.jaune, lineK_bleu = lineK.bleu,
		asphaltW_L = asphaltW.L, asphaltW_R = asphaltW.R, bacW_L = bacW.L, bacW_R = bacW.R,
		croisements = crossings, barrieres = b, plaques = pl }
