## La course : js/race.js, avec le pilote de l'IA (aiThrottle), les contacts entre voitures
## (resolveCollisions) et les drapeaux (js/flags.js). Le jeu en ligne, l'usure et les stands n'y
## sont pas : ils n'existent pas dans le prototype.
class_name Course
extends RefCounted

const POINTS := [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
const PENALITE_FIXE := 1.0
const FLAG_YELLOW_DELAY := 3.0
const FLAG_PENALTY_DURATION := 5.0
const GUIDE := { marge = 0.95, frein = 0.9, portee = 261, pas = 3, reaction = 0.2, vert = 15, usage = 0.8 }
const GUIDE_GAZ := 0
const GUIDE_DOSE := 1
const GUIDE_LEVE := 2

var track: Piste
var cls: Voiture.Modele           # la voiture du joueur
var mode := "race"                # race | timetrial
var laps := 3
var difficulte: Dictionary
var time := 0.0
var state := "countdown"          # countdown | racing | finishing | finished
var countdown := 3.6
var finishTimer := 0.0
var dt := 1.0 / 120
var cars: Array[Voiture] = []
var player: Voiture
var results: Array = []
var profilRacing: PackedFloat32Array
var hasard: Hasard
var evenements: Array = []        # go, crash, lap, finish : pour le son et l'écran
# Les drapeaux (js/flags.js)
var offSince := {}
var obsFautes := PackedInt32Array()
var obsRepris := PackedFloat64Array()
var obsInvalid := PackedByteArray()
var penalties := {}
var blueUntil := {}
var zones: Array = []
var chequered := false
# L'entraînement : un fantôme (le pilote « difficile » dans la voiture du joueur) et le guide.
var entrainement := false
var fantome: Voiture = null
var sansFantome: Array = []
var sillage := {}
var _guide := {}
var _limGuide := {}
var difficultes := {}


## `opts` : modele (Modele), difficulte (Dictionary du catalogue), mode, laps, nCars, roster
## (pilotes de l'IA : nom, modele, livery, livree, skill), catalogue (Callable id -> Modele).
func _init(piste: Piste, opts: Dictionary, h: Hasard) -> void:
	track = piste
	hasard = h
	cls = opts.modele
	mode = opts.get("mode", "race")
	laps = int(opts.get("laps", 3))
	difficulte = opts.difficulte
	entrainement = opts.get("entrainement", false) and mode == "timetrial"
	difficultes = opts.get("difficultes", {})
	profilRacing = Course.speedProfile(track, cls, "racing", 0.98)
	_buildGrid(opts)


func _buildGrid(opts: Dictionary) -> void:
	var T := track
	var c := cls
	var solo := mode == "timetrial"
	var n := 1 if solo else maxi(2, mini(int(opts.get("nCars", c.drivers)), 12))
	var roster: Array = opts.roster
	var gap := c.length * 2.2
	for i in n:
		var humain := i == n - 1
		var s0 := T.length - 8 - i * gap
		var lat0 := (1.0 if i % 2 == 0 else -1.0) * minf(T.halfWidth * 0.45, c.width * 0.9)
		var ai: Dictionary = roster[i % roster.size()]
		var modele: Voiture.Modele = c if humain else opts.modeleDe.call(ai.modele, i)
		var car := Voiture.new(T, modele, s0, lat0, hasard)
		car.nom = opts.get("nomJoueur", "Vous") if humain else ai.nom
		car.livery = int(opts.get("livery", 0)) if humain else int(ai.livery)
		car.livree = int(opts.get("livree", 0)) if humain else int(ai.livree)
		car.isPlayer = humain
		car.skill = 1.0 if humain else float(ai.skill)
		car.gripBoost = 1.0 if humain else float(difficulte.get("grip", 1.0))
		car.numero = 1 if humain else 2 + i
		car.laneTarget = lat0
		car.gridLat = lat0
		cars.append(car)
	player = cars[cars.size() - 1]
	# Le réglage de frein du joueur (poseFrein à 1) : sa classe est une copie.
	player.cls = player.cls.copie()
	player.freinRatio = 1.0
	if solo:
		player.place(T.length - 40, 0, 0)
		player.laneTarget = 0
		player.gridLat = 0
	if solo and entrainement:
		_poseFantome()
	sansFantome = cars.filter(func(k): return k != fantome)


func _poseFantome() -> void:
	var T := track
	var p := player
	var niveau: Dictionary = difficultes.get("hard", difficulte)
	var car := Voiture.new(T, cls, T.length - 40, 0, hasard)
	car.nom = "Fantôme"
	car.livery = p.livery; car.livree = p.livree
	car.isPlayer = false; car.skill = 0.5
	car.gripBoost = float(niveau.get("grip", 1.0))
	car.numero = p.numero
	car.fantome = true
	car.place(T.length - 40, 0, 0)
	car.laneTarget = 0; car.gridLat = 0
	fantome = car
	cars.append(car)
	sillage = { pas = 0.1, n = 0, joueur = PackedFloat64Array(), fantome = PackedFloat64Array() }


## L'écart au fantôme, en temps (race.ecartFantome) : positif s'il est devant.
func ecartFantome() -> float:
	var f := fantome
	var p := player
	if f == null or sillage.n < 2: return 0.0
	var fDevant := f.progress() >= p.progress()
	var trace: PackedFloat64Array = sillage.fantome if fDevant else sillage.joueur
	var ici := p.progress() if fDevant else f.progress()
	var k: int = sillage.n - 1
	while k > 0 and trace[k] > ici: k -= 1
	var dernier: bool = k + 1 >= sillage.n
	var suite: float = (f.progress() if fDevant else p.progress()) if dernier else trace[k + 1]
	var tSuite: float = time if dernier else (k + 1) * sillage.pas
	var part := Piste.clamp_((ici - trace[k]) / (suite - trace[k]), 0, 1) if suite > trace[k] else 0.0
	var ecart := maxf(0, time - (k * sillage.pas + part * (tSuite - k * sillage.pas)))
	return ecart if fDevant else -ecart


## Un pas de 1/120 s (race._step). `gaz` est l'accélérateur du joueur, de 0 à 1.
func step(gaz: float) -> void:
	evenements.clear()
	if state == "countdown":
		countdown -= dt
		if countdown <= 0:
			state = "racing"
			evenements.append({ type = "go" })
			for car in cars: car.gridLat = NAN
		for car in cars:
			car.throttle = gaz if car.isPlayer else (1.0 if countdown < 1.2 else 0.0)
		return
	if state == "finished":
		return
	_simulate(gaz)
	if state == "finishing":
		finishTimer -= dt
		if finishTimer <= 0 or cars.all(func(k): return k.finished):
			_finish()


func _simulate(gaz: float) -> void:
	var T := track
	if fantome and time >= sillage.n * sillage.pas:
		sillage.joueur.append(player.progress()); sillage.fantome.append(fantome.progress()); sillage.n += 1
	time += dt
	_flagsUpdate()
	var pp := player.progress()
	for ic in cars.size():
		var car := cars[ic]
		car.aiDriven = not car.isPlayer
		car.steer([] if car.fantome else sansFantome, dt, car.aiDriven)
		var thr: float
		if car.isPlayer:
			thr = (1.0 if car.v < 15 else 0.0) if car.finished else gaz
		elif car.fantome:
			thr = 1.0 if Course.aiThrottle(car, [], dt, difficultes.get("hard", difficulte)) else 0.0
		else:
			var gapM := car.progress() - pp
			var rubber := 0.0 if car.finished or player.finished else Piste.clamp_(-gapM / 4000, -0.05, 0.03)
			thr = 1.0 if Course.aiThrottle(car, cars, dt, difficulte, rubber) and not car.finished else 0.0
			if car.finished: thr = 1.0 if car.v < 15 else 0.0
		var wasOff := car.herbe
		var hitsBefore := car.barrierHits
		var lapBefore := car.lap
		car.update(dt, thr, time)
		if car.barrierHits > hitsBefore or (not wasOff and car.herbe):
			evenements.append({ type = "crash", car = car })
		_comptePenalite(car)
		_flagsInspect(car, ic)
		if car.lap != lapBefore:
			evenements.append({ type = "lap", car = car })
			if mode == "race" and car.lap >= laps and not car.finished:
				car.finished = true
				car.finishTime = time
				evenements.append({ type = "finish", car = car })
				if car.isPlayer and state == "racing":
					state = "finishing"
					finishTimer = 4.0
	_flagsUpdate()
	if mode == "race":
		var avant: Array = []
		if T.nBarrieres:
			for k in cars: avant.append(PackedFloat64Array([k.x, k.y, k.th]))
		Course.resolveCollisions(cars, T)
		if T.nBarrieres:
			for i in cars.size():
				var car := cars[i]
				var hits := car.barrierHits
				car._barrierContact(avant[i][0], avant[i][1], avant[i][2], -1)
				if car.engineStopped:
					car.v = 0; car.vl = 0; car.w = 0
				if car.barrierHits > hits:
					evenements.append({ type = "crash", car = car })


# ---------- les pénalités (js/race.js) ----------
func _comptePenalite(car: Voiture) -> void:
	if car.finished: return
	if car.herbe:
		if is_nan(car.sortieS0):
			car.sortieS0 = car.progress(); car.sortieT = 0; car.sortieI = track.idx(car.s)
		car.sortieT += dt
		return
	if is_nan(car.sortieS0): return
	var gagnes := car.progress() - car.sortieS0
	var ref := _tempsSurPiste(car.sortieI, gagnes)
	car.repris += maxf(0, ref - car.sortieT)
	car.sortieS0 = NAN


func _tempsSurPiste(i0: int, d: float) -> float:
	if not (d > 0): return 0.0
	var N := track.n
	var t := 0.0
	for k in roundi(d / track.ds):
		t += track.ds / maxf(4, profilRacing[(i0 + k) % N])
	return t


static func penalite(car: Voiture) -> float:
	return car.repris + car.fautes * PENALITE_FIXE


func tempsClasse(car: Voiture) -> float:
	return -1.0 if not car.finished else car.finishTime + Course.penalite(car)


func standings() -> Array[Voiture]:
	var l: Array[Voiture] = cars.duplicate()
	l.sort_custom(func(a: Voiture, b: Voiture) -> bool:
		if a.finished and b.finished: return tempsClasse(a) < tempsClasse(b)
		if a.finished != b.finished: return a.finished
		return b.progress() < a.progress())
	return l


func positionOf(car: Voiture) -> int:
	return standings().find(car) + 1


func _finish() -> void:
	var extra := 0.0
	while not cars.all(func(k): return k.finished) and extra < 180:
		_simulate(0.0)
		extra += dt
	evenements.clear()
	state = "finished"
	var ordre := standings()
	results = []
	for i in ordre.size():
		var car := ordre[i]
		results.append({ car = car, pos = i + 1, points = POINTS[i] if i < POINTS.size() else 0,
			temps = tempsClasse(car), brut = car.finishTime if car.finished else -1.0,
			penalite = Course.penalite(car), fautes = car.fautes, meilleur = car.bestLap,
			ecart = tempsClasse(car) - tempsClasse(ordre[0]) if car.finished and ordre[0].finished else -1.0 })


## Le contre-la-montre se termine quand le joueur le décide.
func endTimeTrial() -> void:
	state = "finished"
	results = [{ car = player, pos = 1, points = 0, temps = -1.0, brut = -1.0, penalite = Course.penalite(player),
		fautes = player.fautes, meilleur = player.bestLap, ecart = -1.0 }]


# ---------- les drapeaux (js/flags.js) ----------
func _flagsInspect(c: Voiture, i: int = -1) -> void:
	if i < 0: i = cars.find(c)
	if obsFautes.size() != cars.size():
		obsFautes.resize(cars.size()); obsRepris.resize(cars.size()); obsInvalid.resize(cars.size())
	var pen := c.fautes > obsFautes[i] or c.repris > obsRepris[i] + .001
	var invalid := mode == "timetrial" and c.lapSale and obsInvalid[i] == 0
	if (pen or invalid) and state != "countdown" and not c.finished:
		penalties[i] = time + FLAG_PENALTY_DURATION
	obsFautes[i] = c.fautes; obsRepris[i] = c.repris; obsInvalid[i] = 1 if c.lapSale else 0


func _flagsUpdate() -> void:
	var now := time
	var actif := state == "racing" or state == "finishing"
	zones = []
	for i in cars.size():
		var c := cars[i]
		if c.fantome:
			c.blueFlag = false
			continue
		_flagsInspect(c, i)
		if actif and c.herbe and not c.finished:
			if not offSince.has(i): offSince[i] = now
			if now - offSince[i] >= FLAG_YELLOW_DELAY: zones.append({ id = i, s = c.s })
		else:
			offSince.erase(i)
		var bleu := false
		if actif and mode == "race" and not c.finished:
			for o in cars:
				if o == c or o.finished or not o.started: continue
				if o.progress() - c.progress() < track.length * .5: continue
				var gap := track.diff(o.s, c.s)
				var longueur := (c.cls.length + o.cls.length) / 2
				var closing := maxf(0, o.v - c.v)
				var portee := Piste.clamp_(closing * 2 + longueur * 2, 12, 100)
				if (gap >= 0 and gap < portee and (closing > .5 or gap < longueur * 2)) or absf(gap) < longueur * 1.5:
					bleu = true
					break
			if bleu: blueUntil[i] = now + 1.2
			bleu = blueUntil.get(i, 0.0) > now
			if not bleu and c.blueFlag:
				for o in cars:
					if o != c and absf(track.diff(c.s, o.s)) < (c.cls.length + o.cls.length) / 2 + .3 \
							and absf(c.lat - o.lat) < (c.cls.width + o.cls.width) / 2 + .2:
						blueUntil[i] = now + .25
						bleu = true
						break
		c.blueFlag = bleu
	if actif and mode == "race":
		for c in cars:
			if c.started and c.lap >= laps - 1:
				chequered = true
				break


## Le drapeau qui concerne une voiture : pénalité, bleu, ou rien.
func drapeauDe(c: Voiture) -> String:
	if penalties.get(cars.find(c), 0.0) > time: return "penalty"
	return "blue" if c.blueFlag else ""


# ---------- le pilote de l'IA (js/car.js, aiThrottle) ----------
static func aiThrottle(car: Voiture, cars_: Array, dt_: float, opts: Dictionary, rubber: float = 0.0) -> bool:
	var c := car.cls
	var T := car.track
	if absf(car.beta) > 0.6 or car.v < -0.5: return false
	car.aiTimer -= dt_
	if car.aiTimer <= 0:
		car.aiTimer = 0.12
		car.aiNoise = (car.hasard.random() - 0.5) * 0.03
		var MAX: float = opts.get("maxMargin", 0.98)
		var margin: float = minf(MAX, (opts.marginBase + car.skill * opts.marginSpread) + car.aiNoise + rubber)
		var brake := c.brake * 0.88
		var v := maxf(0, car.v)
		var paceBase = opts.get("paceBase", null)
		var allow: float = c.vmax * minf(1, (1.0 if paceBase == null else paceBase + car.skill * opts.paceSpread) + rubber)
		var maxD := v * v / (2 * brake) + 40
		var d := 0
		while d < maxD:
			var k := absf(T.curvAtLat(car.s + d, car.lat) if d < 6 else T.lineCurv(car.s + d, car.selS))
			if k >= 1e-4:
				var vc := car.cornerSpeed(k) * margin
				if vc < c.vmax:
					var a := sqrt(vc * vc + 2 * brake * d)
					if a < allow: allow = a
			d += 3
		for o: Voiture in cars_:
			if o == car: continue
			var dd := T.diff(car.s, o.s)
			var lenSum := (c.length + o.cls.length) / 2
			if dd >= lenSum and dd < c.length * 1.2 + v * 0.15 and absf(o.lat - car.lat) < (c.width + o.cls.width) * 0.5 + 0.3:
				if o.v + 0.5 < allow: allow = minf(allow, o.v + 0.5)
		car.aiAllow = allow
	if car.glisseArr > Voiture.AI_GLISSE[1]: car.aiLeve = true
	elif car.glisseArr < Voiture.AI_GLISSE[0]: car.aiLeve = false
	if car.aiLeve: return false
	if car.usage > Voiture.AI_USAGE: return false
	return car.v < car.aiAllow - 0.3


# ---------- les contacts (js/car.js, resolveCollisions) ----------
static func resolveCollisions(cs: Array, T: Piste) -> void:
	var n := cs.size()
	for i in n:
		var a: Voiture = cs[i]
		for j in range(i + 1, n):
			var b: Voiture = cs[j]
			if a.blueFlag or b.blueFlag: continue
			var d := T.diff(a.s, b.s)
			var lenSum := (a.cls.length + b.cls.length) / 2
			if absf(d) >= lenSum: continue
			var dl := b.lat - a.lat
			var wSum := (a.cls.width + b.cls.width) / 2
			if absf(dl) >= wSum: continue
			var longOverlap := lenSum - absf(d)
			var latOverlap := wSum - absf(dl)
			var h := T.headingAt(a.s)
			var tx := cos(h)
			var ty := sin(h)
			var nx := sin(h)
			var ny := -cos(h)
			if longOverlap < latOverlap * 2.2:
				var rear: Voiture = a if d > 0 else b
				var front: Voiture = b if d > 0 else a
				if rear.v > front.v:
					var dv := rear.v - front.v
					front.v += dv * 0.35
					rear.v = front.v - dv * 0.1
					var push := minf(longOverlap / 2, 0.1)
					rear.x -= tx * push; rear.y -= ty * push
					front.x += tx * push; front.y += ty * push
			else:
				var dir := 1.0 if dl >= 0 else -1.0
				var sep := minf(latOverlap / 2, 0.1)
				a.x -= nx * dir * sep; a.y -= ny * dir * sep
				b.x += nx * dir * sep; b.y += ny * dir * sep
				a.vl = Piste.clamp_(a.vl - dir * 0.25, -3, 3); b.vl = Piste.clamp_(b.vl + dir * 0.25, -3, 3)
				a.w = Piste.clamp_(a.w - dir * 0.05, -3, 3); b.w = Piste.clamp_(b.w + dir * 0.05, -3, 3)
				a.v *= 0.995; b.v *= 0.995


# ---------- le profil de vitesse (js/car.js, speedProfile) ----------
## En simple précision, comme le Float32Array du jeu web : chaque valeur est arrondie en la posant.
static func speedProfile(T: Piste, m: Voiture.Modele, nomLigne: String, margin: float) -> PackedFloat32Array:
	var N := T.n
	var ds := T.ds
	var lk: PackedFloat64Array = T.lineK[nomLigne]
	var v := PackedFloat32Array()
	v.resize(N)
	for i in N:
		v[i] = minf(m.vmax, Voiture.cornerSpeedFor(m, absf(lk[i])) * margin)
	var brake := m.brake * 0.9
	for passe in 2:
		for i in range(N - 1, -1, -1):
			var j := (i + 1) % N
			var lim := sqrt(v[j] * v[j] + 2 * brake * ds)
			if lim < v[i]: v[i] = lim
	for passe in 2:
		for i in N:
			var j := (i - 1 + N) % N
			var moteur := m.accel * m.driveFactor(v[j]) * maxf(0.15, 1 - pow(v[j] / m.vmax, 2.5))
			var lat := v[j] * v[j] * absf(lk[j]) / maxf(1e-3, m.grip)
			var a := maxf(0.05, moteur * sqrt(maxf(0, 1 - pow(minf(1, lat), 2))))
			var lim := sqrt(v[j] * v[j] + 2 * a * ds)
			if lim < v[i]: v[i] = lim
	return v


# ---------- le guide de l'entraînement (race.guide) ----------
func _limLigne(nom: String) -> PackedFloat32Array:
	if not _limGuide.has(nom):
		var lk: PackedFloat64Array = track.lineK[nom]
		var v := PackedFloat32Array()
		v.resize(track.n)
		for i in track.n: v[i] = minf(cls.vmax, Voiture.cornerSpeedFor(cls, absf(lk[i])) * GUIDE.marge)
		_limGuide[nom] = v
	return _limGuide[nom]


func _limiteGuide(s: float, sel: float) -> float:
	var i := track.idx(s)
	var r := _limLigne("racing")[i]
	if sel == 0: return r
	return r + (_limLigne("bleu" if sel < 0 else "jaune")[i] - r) * minf(1, absf(sel))


## Pas à pas sur 261 m devant la voiture : gaz, dose ou lâche, avec le temps de réaction.
func guide(car: Voiture = null) -> Dictionary:
	if car == null: car = player
	var c := car.cls
	var pas: int = GUIDE.pas
	var N := roundi(GUIDE.portee / float(pas))
	var b: float = c.brake * GUIDE.frein
	if _guide.is_empty():
		var z := PackedFloat32Array(); z.resize(N + 1)
		var e := PackedByteArray(); e.resize(N)
		_guide = { pas = pas, n = N, s0 = 0.0, maintenant = GUIDE_GAZ, zone = GUIDE_GAZ, cibles = z, passages = z.duplicate(), etats = e, brut = e.duplicate() }
	var G := _guide
	var s0 := floorf(car.s / pas) * pas
	var cible: PackedFloat32Array = G.cibles
	var vc: PackedFloat32Array = G.passages
	var brut: PackedByteArray = G.brut
	for i in N + 1:
		var vv := INF
		for d in pas: vv = minf(vv, _limiteGuide(s0 + i * pas + d, car.selS))
		cible[i] = vv; vc[i] = vv
	for i in range(N - 1, -1, -1):
		var lim := sqrt(cible[i + 1] * cible[i + 1] + 2 * b * pas)
		if lim < cible[i]: cible[i] = lim
	var v := maxf(0, car.v)
	var avant := GUIDE_GAZ
	var libre := c.vmax - 0.5
	for i in N:
		var aMax := c.accel * c.driveFactor(v) * maxf(0, 1 - pow(v / c.vmax, 2.5))
		var aReq := (cible[i + 1] * cible[i + 1] - v * v) / (2 * pas)
		var virage := vc[i] < libre
		var part := v / vc[i] if virage else 0.0
		var usage := minf(1, part * part * GUIDE.marge * GUIDE.marge)
		var aDispo := aMax * sqrt(1 - usage * usage)
		var e: int
		if v > cible[i] * 1.005 + 0.3 or aReq < -0.3 * b:
			e = GUIDE_LEVE
			v = maxf(sqrt(maxf(0, v * v - 2 * b * pas)), minf(v, cible[i + 1]))
		elif usage <= GUIDE.usage and aReq >= (0.55 if avant == GUIDE_GAZ else 0.8) * aMax:
			e = GUIDE_GAZ
			v = minf(sqrt(v * v + 2 * aDispo * pas), cible[i + 1])
		else:
			e = GUIDE_DOSE
			v = minf(cible[i + 1], sqrt(v * v + 2 * aDispo * pas))
		brut[i] = e; avant = e
	var i := 0
	while i < N:
		if brut[i] != GUIDE_GAZ or i == 0 or brut[i - 1] == GUIDE_GAZ:
			i += 1
			continue
		var j := i
		while j < N and brut[j] == GUIDE_GAZ: j += 1
		if j < N and j - i < 3:
			for k in range(i, j): brut[k] = GUIDE_DOSE
		i = j + 1
	var kk := roundi(maxf(0, car.v) * GUIDE.reaction / pas)
	var etats: PackedByteArray = G.etats
	for q in N: etats[q] = brut[mini(N - 1, q + kk)]
	G.s0 = s0
	G.maintenant = etats[mini(N - 1, maxi(0, int(floorf((car.s - s0) / pas))))]
	var nL := 0
	var nD := 0
	for q in 6:
		if etats[q] == GUIDE_LEVE: nL += 1
		elif etats[q] == GUIDE_DOSE: nD += 1
	G.zone = GUIDE_LEVE if nL >= 4 else (GUIDE_DOSE if nL + nD >= 2 else GUIDE_GAZ)
	return G
