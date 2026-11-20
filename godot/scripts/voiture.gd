## La voiture : la physique de js/car.js, ligne pour ligne.
##
## Les noms sont ceux du jeu web, à dessein : chaque calcul se relit à côté de son original. Ce qui
## n'est pas porté ici n'existe pas dans le prototype — l'usure, les dégâts, les stands, l'aimant
## de l'IA et le pilote automatique.
##
## Tout se calcule en flottants 64 bits, comme JavaScript. Aucune grandeur physique ne passe par
## Vector2, qui est en simple précision dans Godot.
class_name Voiture
extends RefCounted

class Modele:
	var id: String
	var nom: String
	var vmax: float
	var accel: float
	var brake: float
	var grip: float
	var df: float
	var slide: float
	var laneK: float
	var rearBias: float
	var cliff: float
	var slipPeak: float
	var length: float
	var width: float
	var zoom: float

	static func depuis(d: Dictionary) -> Modele:
		var m := Modele.new()
		for cle in ["vmax", "accel", "brake", "grip", "df", "slide", "laneK", "rearBias", "cliff", "slipPeak", "length", "width", "zoom"]:
			m.set(cle, d[cle])
		m.id = d.id
		m.nom = d.nom
		return m

# ---------- les constantes de js/car.js ----------
const KERB_ADHERENCE := 0.88
const BARRIERE := { rebond = 1.05, douceur = 9.0, pneus = 0.62, glisseRail = 0.78, glissePneus = 0.52, lacet = 0.35, seuil = 5.0 }
const ARRET_LIBRE := 0.55
const PHYS := { aimant = 0.0, ldK = 0.45, ldMin = 6.0, ff = 0.3, slip = 1.0, cliff = 1.0, steerRate = 6.0, yawK = 2.0, wLim = 0.95, selRate = 0.7, liftOff = 0.16, motricite = 1.25, drivePriority = 0.15, relax = 0.2, circle = 0.25 }
const LIGNE := { part = 0.5, aMin = 0.8, aMax = 6.0, vMax = 5.0 }
const FREIN_MIN := 0.5
const FREIN_MAX := 1.6
const MOTRICITE := { tauMontee = 0.22, tauRetour = 0.10, seuil = 0.12, perte = 0.38 }
const GLISSADE := { rattrapage = true, seuilTravers = 0.15, freinTravers = 0.3 }
const TRANSFERT_AV := 0.62
const RESSENTI := [[0.00, 0.62], [0.80, 1.30], [1.30, 2.50], [0.44, 0.87]]

var track: Piste
var cls: Modele
var gripBoost := 1.0
var freinRatio := 1.0

var s := 0.0
var lat := 0.0
var x := 0.0
var y := 0.0
var th := 0.0
var v := 0.0
var vl := 0.0
var w := 0.0
var delta := 0.0
var beta := 0.0
var usage := 0.0
var Ff := 0.0
var Fr := 0.0
var alphaF := 0.0
var alphaR := 0.0
var slide := 0.0
var patine := 0.0
var glisseArr := 0.0
var patineFx := 0.0
var ressenti := 0.0
var surKerb := false
var herbe := false          # state === 'grass'
var grassT := 0.0
var rejoined := 0
var crashes := 0
var engineCut := 0.0
var engineStopped := false
var barrierHits := 0
var lastImpact := 0.0       # la vitesse du dernier choc, pour le son et la secousse
var sel := 0.0
var selS := 0.0
var selV := 0.0
var laneTarget := 0.0
var started := false
var checkpoint := false
var lap := 0
var lapTimes: Array[float] = []
var lapSale := false
var bestLap := -1.0
var lapStart := 0.0
var throttle := 0.0
var offT := 0.0
var braking := false


func _init(piste: Piste, modele: Modele, s0: float, lat0: float) -> void:
	track = piste
	cls = modele
	place(s0, lat0, 0)


func place(s0: float, lat0: float, v0: float) -> void:
	var T := track
	var P := T.pos2(s0, lat0)
	s = T.wrap_(s0); lat = lat0; x = P[0]; y = P[1]; th = T.headingAt(s0)
	v = v0; vl = 0; w = 0; delta = 0; beta = 0; usage = 0; slide = 0; ressenti = 0; Ff = 0; Fr = 0
	selS = sel; selV = 0
	patine = 0; patineFx = 0; glisseArr = 0
	engineCut = 0; engineStopped = false


static func wrapAngle(a: float) -> float:
	while a > PI: a -= 2 * PI
	while a < -PI: a += 2 * PI
	return a


static func smoothstep_(xx: float, a: float, b: float) -> float:
	var t := Piste.clamp_((xx - a) / (b - a), 0, 1)
	return t * t * (3 - 2 * t)


static func sgn(xx: float) -> float:
	return 1.0 if xx > 0 else (-1.0 if xx < 0 else 0.0)


## `Math.sign(this.v || 1)` : la vitesse nulle compte comme une marche avant.
func _dir() -> float:
	return 1.0 if v == 0.0 else sgn(v)


func gripAt(vv: float) -> float:
	var g := cls.grip * gripBoost
	return g + minf(cls.df * vv * vv, g * 1.8)


func speed() -> float:
	return Piste.hypot(v, vl)


func _advance(dss: float, raceTime: float) -> void:
	var T := track
	var before := T.wrap_(s)
	var after := before + dss
	if before < T.length / 2 and after >= T.length / 2:
		checkpoint = true
	if after >= T.length:
		if not checkpoint and started:
			s = T.wrap_(after)
			return
		checkpoint = false
		if started:
			var lt := raceTime - lapStart
			lapTimes.append(lt)
			if not lapSale and (bestLap < 0 or lt < bestLap):
				bestLap = lt
			lap += 1
			lapSale = false
		else:
			started = true
			lapSale = false
		lapStart = raceTime
	s = T.wrap_(after)


func _desiredCurvature() -> float:
	var T := track
	var sp := maxf(0, v)
	var Ld := Piste.clamp_(PHYS.ldK * sp + 4, PHYS.ldMin, 45)
	var sAhead := s + Ld
	var latT := T.targetLat(sAhead, selS)
	var P := T.pos2(sAhead, latT)
	var dx := P[0] - x
	var dy := P[1] - y
	var dist := Piste.hypot(dx, dy)
	if dist == 0.0: dist = 1e-6
	var alpha := wrapAngle(atan2(dy, dx) - th)
	if absf(alpha) > PI / 2:
		return sgn(alpha) * 0.25
	var kPursuit := 2 * sin(alpha) / dist
	var ff: float = PHYS.ff
	var kFF := T.lineCurv(s + Ld * 0.4, selS) if ff else 0.0
	return Piste.clamp_(kPursuit + ff * kFF, -0.25, 0.25)


func _leaveTrack() -> void:
	if herbe:
		return
	herbe = true; grassT = 0; crashes += 1
	lapSale = true


func _barrierContact(fx: float, fy: float, fth: float, raceTime: float) -> bool:
	var T := track
	var hit := T.barrierHit(self, fx, fy, fth)
	if hit.is_empty():
		return false
	var hnx := hit[1]
	var hny := hit[2]
	var b := int(hit[4])
	var vx := v * cos(th) + vl * sin(th)
	var vy := v * sin(th) - vl * cos(th)
	var impact := maxf(0, -vx * hnx - vy * hny)
	var pneus := T.b_pneus[b] == 1
	x = fx + (x - fx) * hit[0] + hnx * (hit[3] + .035)
	y = fy + (y - fy) * hit[0] + hny * (hit[3] + .035)
	th = wrapAngle(fth + wrapAngle(th - fth) * hit[0])
	var tx := -hny
	var ty := hnx
	var vt := vx * tx + vy * ty
	var rendu: float = impact * BARRIERE.rebond * exp(-impact / BARRIERE.douceur) * (BARRIERE.pneus if pneus else 1.0)
	var glisse: float = vt * (BARRIERE.glissePneus if pneus else BARRIERE.glisseRail)
	var wx := hnx * rendu + tx * glisse
	var wy := hny * rendu + ty * glisse
	var cs := cos(th)
	var sn := sin(th)
	v = wx * cs + wy * sn; vl = wx * sn - wy * cs
	w *= BARRIERE.lacet; Ff = 0; Fr = 0
	slide = 0; patine = 0; patineFx = 0; throttle = 0; braking = false
	if not engineStopped:
		var effective := impact * (.55 if pneus else 1.0)
		barrierHits += 1
		lastImpact = impact
		if impact > BARRIERE.seuil:
			engineCut = Piste.clamp_(.25 + 2 * pow(effective / 20, 2), .25, 5)
			engineStopped = true
		_leaveTrack()
	var pr := T.project(x, y, s, 30)
	var dss := T.diff(s, pr[0])
	if raceTime >= 0 and dss > 0 and dss < 6:
		_advance(dss, raceTime)
	else:
		s = pr[0]
	lat = pr[2]
	return true


## Un pas de physique. `raceTime` négatif : hors course (pas de comptage des tours).
func update(dt: float, throttleIn: float, raceTime: float) -> void:
	var T := track
	var c := cls
	var wasStopped := engineStopped
	engineCut = maxf(0, engineCut - dt)
	engineStopped = engineCut > 1e-6
	if wasStopped and not engineStopped:
		th = T.headingAt(s); delta = 0; Ff = 0; Fr = 0
	var thr := throttleIn
	if engineStopped: thr = 0
	thr = Piste.clamp_(thr, 0, 1)
	throttle = thr
	offT = 0.0 if thr != 0.0 else offT + dt
	braking = thr == 0.0 and offT > 0.05 and v > 2
	var hwLs := T.hwLeftAt(s)
	var hwRs := T.hwRightAt(s)
	var kb := T.kerbAt(s)
	var marge := c.width * 0.3
	var horsRoute := lat > hwLs + marge or lat < -(hwRs + marge)
	var off := lat > hwLs + kb + marge or lat < -(hwRs + kb + marge)
	var loose := off and not T.runoffAsphaltAt(s, lat)
	surKerb = horsRoute and not off
	if off: _leaveTrack()
	if not off and not engineStopped: herbe = false
	if herbe: grassT += dt
	if grassT > 8 and not engineStopped:
		var edge := Piste.clamp_(lat, -(T.hwRightAt(s) - c.width), T.hwLeftAt(s) - c.width)
		place(s, edge, minf(8, absf(v)))
		herbe = false; grassT = 0; rejoined += 1
		return
	if engineStopped:
		var frein := exp(-dt / ARRET_LIBRE)
		v *= frein; vl *= frein; w *= frein
		if absf(v) < 0.05: v = 0
		if absf(vl) < 0.05: vl = 0
		if absf(w) < 0.02: w = 0
		th = wrapAngle(th + w * dt)
		var cs0 := cos(th)
		var sn0 := sin(th)
		var ax0 := x
		var ay0 := y
		var ath0 := th
		x += (v * cs0 + vl * sn0) * dt
		y += (v * sn0 - vl * cs0) * dt
		if T.nBarrieres and _barrierContact(ax0, ay0, ath0, raceTime):
			return
		var prc := T.project(x, y, s, 30)
		if absf(T.diff(s, prc[0])) < 6:
			s = prc[0]; lat = prc[2]
		return
	var surface := 0.42 if loose else (KERB_ADHERENCE if surKerb else 1.0)
	var L := c.length * 0.6
	var a := L / 2
	var b := L / 2
	var kk := pow(0.28 * c.length, 2) * (5 / c.laneK)
	var enTravers: bool = GLISSADE.rattrapage and absf(beta) > GLISSADE.seuilTravers
	var brakeFrac: float = 0.0 if thr != 0.0 else Piste.clamp_(offT / 0.1, 0, 1) * (GLISSADE.freinTravers if enTravers else 1.0)
	var vv := maxf(3, absf(v))
	var peak: float = c.slipPeak * PHYS.slip
	var gTot := gripAt(absf(v)) * surface
	var kDes := _desiredCurvature()
	if GLISSADE.rattrapage and (absf(alphaR) > peak or absf(alphaF) > peak):
		var kLigne := T.lineCurv(s + 3, selS)
		if sgn(kDes) == sgn(kLigne) and absf(kDes) > absf(kLigne):
			kDes = kLigne
	var wLim: float = PHYS.wLim * gTot / vv
	var wDes := Piste.clamp_(v * kDes, -wLim, wLim)
	var gAxle := gTot * 0.5 / minf(1, c.rearBias)
	var ayFront := v * v * kDes * 0.5
	var aFff := peak * ayFront / maxf(1e-3, gAxle)
	var aFdes := Piste.clamp_(aFff + PHYS.yawK * peak * (wDes - w), -peak * 1.3, peak * 1.3)
	var ufront := (vl - a * w) / vv
	var steerTarget := atan(tan(aFdes) - ufront * _dir())
	var dMax := 0.5
	var rate: float = PHYS.steerRate
	delta += Piste.clamp_(Piste.clamp_(steerTarget, -dMax, dMax) - delta, -rate * dt, rate * dt)
	usage = v * v * absf(kDes) / maxf(1e-3, gTot)
	var aF := atan((vl - a * w + v * tan(delta)) / vv)
	var aR := atan((vl + b * w) / vv)
	var base := gAxle
	var cliffF: float = 1 - c.cliff * PHYS.cliff * smoothstep_(absf(aF), peak * 1.5, peak * 5)
	var cliffR: float = 1 - c.cliff * PHYS.cliff * smoothstep_(absf(aR), peak * 1.5, peak * 5)
	var vmax := c.vmax
	var accDem := thr * c.accel * maxf(0, 1 - pow(maxf(0, v) / vmax, 2.5)) if thr != 0.0 else 0.0
	var transfert: float = PHYS.liftOff * brakeFrac * Piste.clamp_(freinRatio if freinRatio != 0.0 else 1.0, FREIN_MIN, FREIN_MAX)
	var gF := base * cliffF * (1 + transfert * TRANSFERT_AV)
	var gArrBrut := base * c.rearBias * (1 - transfert)
	var latPris := minf(1, absf(aR) / peak)
	var longDispo: float = gArrBrut * PHYS.motricite * sqrt(maxf(0, 1 - latPris * latPris))
	var qy := Piste.clamp_(aR / peak, -1, 1)
	var qx: float = accDem / maxf(1e-3, gArrBrut * cliffR * PHYS.motricite)
	var share := 1.0 if loose else 1 / maxf(1, Piste.hypot(qx, qy))
	var sature: float = 0.0 if loose or accDem <= 0 else Piste.clamp_((1 - share) / MOTRICITE.seuil, 0, 1)
	var tau: float = MOTRICITE.tauMontee if sature > glisseArr else MOTRICITE.tauRetour
	glisseArr += (sature - glisseArr) * (1 - exp(-dt / tau))
	var priority: float = PHYS.drivePriority
	var safeDrive := minf(accDem, longDispo * cliffR)
	var accReel := accDem if loose else safeDrive * (1 - priority) + accDem * share * priority
	patine = 0.0 if loose or accDem <= 0 else Piste.clamp_(1 - accReel / accDem, 0, 1)
	var spinFx := Piste.clamp_(1 - accReel / accDem, 0, 1) if not loose and accDem > 0 else 0.0
	var spinTau := 0.035 if spinFx > patineFx else 0.08
	patineFx += (spinFx - patineFx) * (1 - exp(-dt / spinTau))
	var gR: float = gArrBrut * cliffR * (1.0 if loose else 1 - priority + priority * share) \
		* (1.0 if loose else 1 - MOTRICITE.perte * glisseArr)
	var FfT := -gF * Piste.clamp_(aF / peak, -1, 1)
	var FrT := -gR * Piste.clamp_(aR / peak, -1, 1)
	var relax := minf(1, dt * vv / PHYS.relax)
	Ff += (FfT - Ff) * relax
	Fr += (FrT - Fr) * relax
	# L'aimant ne sert qu'à l'IA (PHYS.aimant = 0 pour le joueur) : Fm reste nul.
	var useF := absf(Ff) / maxf(1e-3, gF)
	var useR := absf(Fr) / maxf(1e-3, gR)
	var u := minf(1, maxf(useF, useR))
	var acc: float
	var dir := _dir()
	if thr != 0.0:
		acc = accReel * (maxf(0.3, 1 - PHYS.circle * u * u) if loose else 1.0)
	else:
		acc = -(1.5 + c.brake * brakeFrac) * (1 - PHYS.circle * u * u) * (1.0 if v > 1 else maxf(0, v))
	var latDrag := 0.0
	if loose:
		var sp := Piste.hypot(v, vl)
		if sp == 0.0: sp = 1e-6
		var dragA := 5 + 0.15 * sp
		acc -= dragA * v / sp
		latDrag = -dragA * vl / sp
	acc -= (absf(Ff * sin(aF)) + absf(Fr * sin(aR))) * 0.8 * dir
	var bx0 := x
	var by0 := y
	var bth0 := th
	var wDot := (-a * (Ff + 0.0) + b * (Fr + 0.0)) / kk
	w = Piste.clamp_(w + wDot * dt, -4, 4)
	th = wrapAngle(th + w * dt)
	var v0 := v
	var vl0 := vl
	v = Piste.clamp_(v0 + (acc - vl0 * w) * dt, -0.25 * c.vmax, c.vmax * 1.05)
	vl = vl0 + (v0 * w + Ff + 0.0 + Fr) * dt
	if latDrag != 0.0:
		vl += Piste.clamp_(latDrag * dt, -absf(vl0), absf(vl0))
	beta = atan2(vl, vv) * _dir()
	alphaF = aF; alphaR = aR
	slide = Piste.clamp_((maxf(absf(aF), absf(aR)) - peak * 0.8) / (peak * 2.5), 0, 1)
	var gDispo := maxf(1e-3, gTot)
	var charge := absf(Ff + Fr) / gDispo
	var glisse := maxf(absf(aF), absf(aR)) / maxf(1e-4, peak)
	var travers := th - T.headingAt(s)
	while travers > PI: travers -= PI * 2
	while travers < -PI: travers += PI * 2
	ressenti = minf(1, 0.25 * (_pente(charge, 0) + _pente(glisse, 1) + _pente(glisse, 2) + _pente(absf(travers), 3)))
	var cs := cos(th)
	var sn := sin(th)
	x += (v * cs + vl * sn) * dt
	y += (v * sn - vl * cs) * dt
	if T.nBarrieres and _barrierContact(bx0, by0, bth0, raceTime):
		return
	var pr := T.project(x, y, s)
	var dss := T.diff(s, pr[0])
	if absf(dss) < 6:
		if dss > 0: _advance(dss, raceTime)
		else: s = pr[0]
		lat = pr[2]
	else:
		_advance(maxf(0, v) * dt, raceTime)


static func _pente(val: float, i: int) -> float:
	var r: Array = RESSENTI[i]
	return Piste.clamp_((val - r[0]) / (r[1] - r[0]), 0, 1)


## Le levier de ligne du joueur : la voiture glisse vers la ligne demandée au rythme que son
## adhérence permet (js/car.js, `steer` puis `_versLigne`, sans trafic).
func steer(dt: float) -> void:
	_versLigne(sel, dt)
	laneTarget = track.targetLat(s, selS)


func _versLigne(cible: float, dt: float) -> void:
	var T := track
	var reste := cible - selS
	if absf(reste) < 1e-3 and absf(selV) < 0.05:
		selS = cible; selV = 0
		return
	var latIci := T.targetLat(s, selS)
	var latVise := T.targetLat(s, cible)
	var D := maxf(0.5, absf(latVise - latIci) / absf(reste) if absf(reste) > 1e-3 else 1.0)
	var vp := maxf(0, v)
	var g := Piste.clamp_(glisseArr, 0, 1)
	var aTot := gripAt(vp) * sqrt(1 - g * g)
	var kIci := absf(T.lineCurv(s, selS))
	var budget := Piste.clamp_(LIGNE.part * (aTot - vp * vp * kIci), LIGNE.aMin, LIGNE.aMax)
	var resteM := reste * D
	var vVoulue: float = sgn(resteM) * minf(LIGNE.vMax, sqrt(2 * budget * absf(resteM)))
	var kApres := absf(T.lineCurv(s, selS + sgn(reste) * 0.05))
	if kApres > kIci and vp * vp * kApres > aTot:
		vVoulue = 0
	selV += Piste.clamp_(vVoulue - selV, -budget * dt, budget * dt)
	selS += selV / D * dt
	if (cible - selS) * reste <= 0:
		selS = cible; selV = 0
