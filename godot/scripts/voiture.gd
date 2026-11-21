## La voiture : la physique de js/car.js, ligne pour ligne.
##
## Les noms sont ceux du jeu web, à dessein : chaque calcul se relit à côté de son original. Les
## dégâts et les stands viennent de l'essai du jeu web (branche claude/degats-visuels) ; l'usure des
## pneus, éteinte dans le jeu web (USURE_ACTIVE), n'est pas portée.
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
	var drivers: int = 10
	var cat: String
	var aCourbe := false     # driveCurve : la poussée qui change avec la vitesse (certaines voitures)
	var dcFrom := 0.0
	var dcTo := 0.0
	var dcLow := 1.0
	var dcHigh := 1.0

	static func depuis(d: Dictionary) -> Modele:
		var m := Modele.new()
		for cle in ["vmax", "accel", "brake", "grip", "df", "slide", "laneK", "rearBias", "cliff", "slipPeak", "length", "width", "zoom"]:
			m.set(cle, d[cle])
		m.id = d.id
		m.nom = d.nom
		if d.has("drivers"): m.drivers = int(d.drivers)
		if d.has("cat"): m.cat = d.cat
		if d.has("dcFrom") and (d.dcFrom != 0 or d.dcTo != 0):
			m.aCourbe = true
			m.dcFrom = d.dcFrom; m.dcTo = d.dcTo; m.dcLow = d.dcLow; m.dcHigh = d.dcHigh
		return m

	func copie() -> Modele:
		var m := Modele.new()
		for p in get_property_list():
			if p.usage & PROPERTY_USAGE_SCRIPT_VARIABLE:
				m.set(p.name, get(p.name))
		return m

	## js/cars.js, driveFactor.
	func driveFactor(speed: float) -> float:
		if not aCourbe:
			return 1.0
		var t := maxf(0, minf(1, (speed - dcFrom) / (dcTo - dcFrom)))
		return dcLow + (dcHigh - dcLow) * t * t * (3 - 2 * t)

# ---------- les constantes de js/car.js ----------
const KERB_ADHERENCE := 0.88
const BARRIERE := { rebond = 1.05, douceur = 9.0, pneus = 0.62, glisseRail = 0.78, glissePneus = 0.52, lacet = 0.35, seuil = 5.0 }
const BARRIERE_rebond := 1.05
const BARRIERE_douceur := 9.0
const BARRIERE_pneus := 0.62
const BARRIERE_glisseRail := 0.78
const BARRIERE_glissePneus := 0.52
const BARRIERE_lacet := 0.35
const BARRIERE_seuil := 5.0
const ARRET_LIBRE := 0.55

# ---------- les dégâts et les stands (js/car.js, essai des dégâts) ----------
## La tôle seule : un choc franc cabosse la voiture et lui coûte de la pointe et de la reprise,
## jusqu'à 35 % au maximum des dommages ; jamais d'adhérence. `abandon` : en solo seulement.
const DEGATS := { chocSeuil = 3.5, chocParVitesse = 0.018, vmax = 0.35 }
const FLANC_SEUIL := 6.0                 # m/s de rapprochement latéral avant qu'un coup de flanc ne casse
const ABANDON_VITESSE := 100.0 / 3.6     # m/s qui RENTRENT dans une protection : le moteur est détruit
const ABANDON_PNEUS := 0.8               # ce qu'un mur de pneus laisse passer, pour l'abandon (js/car.js)
const CHOC_SEUIL_USURE := 3.5            # USURE.chocSeuil, pour le dessin d'un choc sans dégâts
## La caisse en huit zones (le nez, les quatre coins, les deux flancs, l'arrière) : chaque choc
## enfonce la sienne et un peu ses voisines ; les dommages sont la zone la plus enfoncée.
const ENFONCE_zones := 8
const ENFONCE_creux := 0.011           # entre les deux essais : 0,015 partait trop vite, 0,0075 trop lentement (Bruno)
const ENFONCE_max := 0.3
const ENFONCE_voisines := 0.35
const ENFONCE_durete := [0.3, 0.6, 1.4, 0.6, 0.3, 0.6, 1.4, 0.6]
## L'arrêt au stand : la vitesse de la voie, la réparation (selon ce qu'il y a à réparer).
const STAND_vitesse := 22.0
const STAND_service := 3.2
const STAND_reparationBase := 1.5
const STAND_reparation := 6.5
const STAND_seuilArret := 3.0
const STAND_demiBoite := 9.0


## La zone de la caisse que touche un choc, (lx, ly) dans le repère de la voiture (zoneEnfonce).
static func zoneEnfonce(lx: float, ly: float) -> int:
	var n := ENFONCE_zones
	var px := -Piste.clamp_(lx * 1.8, -1, 1)
	var py := -Piste.clamp_(ly * 1.8, -1, 1)
	return ((int(roundf_js(atan2(py, px) / (2 * PI / n))) % n) + n) % n


## Math.round de JavaScript : le demi va vers +∞.
static func roundf_js(xx: float) -> float:
	return floorf(xx + 0.5)
const PHYS := { aimant = 0.0, ldK = 0.45, ldMin = 6.0, ff = 0.3, slip = 1.0, cliff = 1.0, steerRate = 6.0, yawK = 2.0, wLim = 0.95, selRate = 0.7, liftOff = 0.16, motricite = 1.25, drivePriority = 0.15, relax = 0.2, circle = 0.25 }
const PHYS_aimant := 0.0
const PHYS_ldK := 0.45
const PHYS_ldMin := 6.0
const PHYS_ff := 0.3
const PHYS_slip := 1.0
const PHYS_cliff := 1.0
const PHYS_steerRate := 6.0
const PHYS_yawK := 2.0
const PHYS_wLim := 0.95
const PHYS_selRate := 0.7
const PHYS_liftOff := 0.16
const PHYS_motricite := 1.25
const PHYS_drivePriority := 0.15
const PHYS_relax := 0.2
const PHYS_circle := 0.25
const LIGNE := { part = 0.5, aMin = 0.8, aMax = 6.0, vMax = 5.0 }
const LIGNE_part := 0.5
const LIGNE_aMin := 0.8
const LIGNE_aMax := 6.0
const LIGNE_vMax := 5.0
const FREIN_MIN := 0.5
const FREIN_MAX := 1.6
const MOTRICITE := { tauMontee = 0.22, tauRetour = 0.10, seuil = 0.12, perte = 0.38 }
const MOTRICITE_tauMontee := 0.22
const MOTRICITE_tauRetour := 0.10
const MOTRICITE_seuil := 0.12
const MOTRICITE_perte := 0.38
const GLISSADE := { rattrapage = true, seuilTravers = 0.15, freinTravers = 0.3 }
const GLISSADE_rattrapage := true
const GLISSADE_seuilTravers := 0.15
const GLISSADE_freinTravers := 0.3
const TRANSFERT_AV := 0.62
const RESSENTI := [[0.00, 0.62], [0.80, 1.30], [1.30, 2.50], [0.44, 0.87]]
const AIMANT := { k = 1.4, c = 1.0, devant = 0.0, max = 0.3, lache = 1.0, reprend = 0.5, derive = 1.3 }
const AIMANT_k := 1.4
const AIMANT_c := 1.0
const AIMANT_devant := 0.0
const AIMANT_max := 0.3
const AIMANT_lache := 1.0
const AIMANT_reprend := 0.5
const AIMANT_derive := 1.3
const AIDES_IA := { aimant = 1.0, ff = 0.3 }
const AIDES_IA_aimant := 1.0
const AIDES_IA_ff := 0.3
const AI_GLISSE := [0.28, 0.55]
const AI_USAGE := 0.8

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

# La course (js/car.js, constructeur) : qui conduit, sa place, ses temps.
var nom := ""
var numero := 1
var livery := 0
var livree := 0
var isPlayer := false
var skill := 0.5
var finished := false
var finishTime := -1.0
var fautes := 0
var repris := 0.0
var sortieS0 := NAN        # null en JavaScript
var sortieT := 0.0
var sortieI := 0
var lapOk: Array[bool] = []
var bestLapBrut := -1.0
var blueFlag := false
var draft := false
var gridLat := NAN         # null en JavaScript : la place sur la grille, tenue jusqu'au départ
var passSide := 0
var passTimer := 0.0
var blocker: Voiture = null
var voisin: Voiture = null
var aiTimer := 0.0
var aiNoise := 0.0
var aiAllow := INF
var aiLeve := false
var aiDriven := false
var fantome := false
var accroche := true
var ecartAv := NAN
var aimantF := 0.0
var hasard: Hasard = null
# En ligne (js/net-drive.js) : la place dans la grille des humains (-1 pour l'IA), une voiture tenue
# par un autre écran, le dernier numéro d'état reçu. Les stands, l'usure et les dégâts n'existent
# pas encore ici : jamais aux stands, pneus neufs, carrosserie intacte — sur le fil comme ailleurs.
var human := -1
var netRemote := false
var netSeq := 0
var inPit := false
var damage := 0.0           # 0 = intacte, 1 = épave : l'enfoncement de la zone la plus touchée
var tyre := 1.0
# Les dégâts (essai) : `degats` est le réglage de la tôle (DEGATS, et `abandon`), ou vide si la
# course n'en a pas. `chocs` : les chocs de l'image, pour le dessin seulement — le rendu les vide.
var degats := {}
var enfoncement := PackedFloat32Array([0, 0, 0, 0, 0, 0, 0, 0])   # Float32Array dans le jeu web : même arrondi
var chocs: Array = []
var reculChoc := 0
var abandon := false
var abandonT := 0.0
var pitsDone := 0
var pitAsk := false         # l'intention ; la ligne reste `sel`
var pitState := ""          # "" | "voie" | "arret"
var pitServi := false
var pitT := 0.0
var pitT0 := 0.0


func _init(piste: Piste, modele: Modele, s0: float, lat0: float, h: Hasard = null) -> void:
	track = piste
	cls = modele
	hasard = h
	# Le constructeur de car.js pose la voiture sans tout remettre à zéro (place le fait ensuite).
	var P := piste.pos2(s0, lat0)
	s = s0; lat = lat0; x = P[0]; y = P[1]; th = piste.headingAt(s0)
	aiTimer = (h.random() if h else 0.0) * 0.15
	if h == null:
		place(s0, lat0, 0)


## Les aides de pilotage : le joueur n'a pas d'aimant, l'IA si.
func _aimant() -> float:
	return 0.0 if isPlayer else AIDES_IA_aimant


## Une voiture cabossée traîne : de la pointe et de la reprise, jamais de l'adhérence.
func damageFactor() -> float:
	return 1.0 - float(degats.vmax) * damage if not degats.is_empty() else 1.0


## Un choc qui enfonce la caisse : (nx, ny) la direction dans laquelle la tôle rentre, dans le
## monde ; `force` les m/s au-delà du seuil.
func _enfonce(nx: float, ny: float, force: float) -> void:
	if not (force > 0): return
	var cs := cos(th)
	var sn := sin(th)
	var lx := nx * cs + ny * sn
	var ly := -nx * sn + ny * cs
	var k := Voiture.zoneEnfonce(lx, ly)
	var creux := ENFONCE_creux * force
	for zp in [[k, 1.0], [(k + 1) % ENFONCE_zones, ENFONCE_voisines], [(k + ENFONCE_zones - 1) % ENFONCE_zones, ENFONCE_voisines]]:
		var z: int = zp[0]
		enfoncement[z] = minf(ENFONCE_max, enfoncement[z] + creux * zp[1] * ENFONCE_durete[z])
	var m := 0.0
	for e in enfoncement: m = maxf(m, e)
	damage = Piste.clamp_(m / ENFONCE_max, 0, 1)
	# plus de vie : c'est l'abandon, contre un mur comme contre une voiture
	if damage >= 1 and degats.get("abandon", false) and not abandon: _abandonne()


## L'abandon : le moteur ne repartira plus (l'écran ABANDON, l'épave).
func _abandonne() -> void:
	abandon = true; damage = 1.0; enfoncement.fill(ENFONCE_max)
	engineCut = INF; engineStopped = true


## Un choc, pour ce qui se voit (le dessin le lit puis vide la liste) : dans le repère de la voiture.
func _marque(nx: float, ny: float, vitesse: float, frotte: float, sorte: String, epave := false) -> void:
	if chocs.size() >= 12 or fantome: return
	var cs := cos(th)
	var sn := sin(th)
	chocs.append({ nx = nx * cs + ny * sn, ny = -nx * sn + ny * cs, v = vitesse, frotte = frotte, sorte = sorte, epave = epave })


func cornerSpeed(kk: float) -> float:
	return Voiture.cornerSpeedFor(cls, kk, gripBoost)


static func cornerSpeedFor(c: Modele, kk: float, boost: float = 1.0) -> float:
	if kk < 1e-5:
		return INF
	var g := c.grip * boost
	var capped := sqrt(2.8 * g / kk)
	if kk - c.df > 1e-6:
		return minf(sqrt(g / (kk - c.df)), capped)
	return capped


func progress() -> float:
	return (lap - (0 if started else 1)) * track.length + track.wrap_(s)


## Hors de la chaussée mais sur un dégagement asphalté (car.runoffAsphalt) : la voiture y garde
## son adhérence, et le son comme la fumée sont ceux de la route. Les effets et le son la
## demandaient ; elle manquait, et chaque sortie de piste les arrêtait sur une erreur.
func runoffAsphalt() -> bool:
	return track.runoffAsphaltAt(s, lat)


func place(s0: float, lat0: float, v0: float) -> void:
	var T := track
	var P := T.pos2(s0, lat0)
	s = T.wrap_(s0); lat = lat0; x = P[0]; y = P[1]; th = T.headingAt(s0)
	v = v0; vl = 0; w = 0; delta = 0; beta = 0; usage = 0; slide = 0; ressenti = 0; Ff = 0; Fr = 0
	selS = sel; selV = 0; accroche = true; aimantF = 0; ecartAv = NAN
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
	if finished:
		s = T.wrap_(after)
		return
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
			lapOk.append(not lapSale)
			if not lapSale and (bestLap < 0 or lt < bestLap):
				bestLap = lt
			if bestLapBrut < 0 or lt < bestLapBrut:
				bestLapBrut = lt
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
	var Ld := Piste.clamp_(PHYS_ldK * sp + 4, PHYS_ldMin, 45)
	var sAhead := s + Ld
	var latT := gridLat if not is_nan(gridLat) else T.targetLat(sAhead, selS)
	var P := T.pos2(sAhead, latT)
	var dx := P[0] - x
	var dy := P[1] - y
	var dist := Piste.hypot(dx, dy)
	if dist == 0.0: dist = 1e-6
	var alpha := wrapAngle(atan2(dy, dx) - th)
	if absf(alpha) > PI / 2:
		return sgn(alpha) * 0.25
	var kPursuit := 2 * sin(alpha) / dist
	var ff: float = PHYS_ff
	var kFF := T.lineCurv(s + Ld * 0.4, selS) if ff else 0.0
	return Piste.clamp_(kPursuit + ff * kFF, -0.25, 0.25)


func _leaveTrack() -> void:
	if herbe:
		return
	herbe = true; grassT = 0; crashes += 1
	if not finished: fautes += 1
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
	var rendu: float = impact * BARRIERE_rebond * exp(-impact / BARRIERE_douceur) * (BARRIERE_pneus if pneus else 1.0)
	var glisse: float = vt * (BARRIERE_glissePneus if pneus else BARRIERE_glisseRail)
	var wx := hnx * rendu + tx * glisse
	var wy := hny * rendu + ty * glisse
	var cs := cos(th)
	var sn := sin(th)
	v = wx * cs + wy * sn; vl = wx * sn - wy * cs
	w *= BARRIERE_lacet; Ff = 0; Fr = 0
	slide = 0; patine = 0; patineFx = 0; throttle = 0; braking = false
	var fatal := false
	if not engineStopped:
		var effective := impact * (.55 if pneus else 1.0)
		barrierHits += 1
		lastImpact = impact
		if impact > BARRIERE_seuil:
			engineCut = Piste.clamp_(.25 + 2 * pow(effective / 20, 2), .25, 5)
			engineStopped = true
		_leaveTrack()
		if not degats.is_empty():
			var etait := abandon
			_enfonce(hnx, hny, effective - float(degats.chocSeuil))
			# l'abandon : 100 km/h qui rentrent dans un mur (les pneus n'en retiennent qu'un cinquième),
			# ou la vie à zéro (_enfonce) ; le moteur ne repartira plus
			if degats.get("abandon", false) and not abandon and impact * (ABANDON_PNEUS if pneus else 1.0) >= ABANDON_VITESSE:
				_abandonne()
			fatal = abandon and not etait
	_marque(hnx, hny, impact * (.55 if pneus else 1.0), absf(vt), "tyres" if pneus else "rail", fatal)
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
	if abandon: abandonT += dt
	var wasStopped := engineStopped
	engineCut = maxf(0, engineCut - dt)
	engineStopped = engineCut > 1e-6
	if wasStopped and not engineStopped:
		th = T.headingAt(s); delta = 0; Ff = 0; Fr = 0
	var thr := throttleIn
	# --- la voie des stands (js/car.js) : AVANT l'accélérateur, qui commande aussi le freinage ---
	# On y est quand on l'a demandée ET qu'on est dans sa portion de circuit ; il suffit de
	# s'arrêter dans la zone. Les stands n'existent qu'avec les dégâts.
	var zone := T.pitAt(s) if not degats.is_empty() else {}
	inPit = not zone.is_empty() and (pitAsk or pitState != "")
	if inPit:
		if pitState == "": pitState = "voie"
		if pitState == "voie" and not pitServi and zone.dansZone and absf(v) < STAND_seuilArret:
			pitState = "arret"
			pitT = STAND_reparationBase + STAND_reparation * damage
			pitT0 = pitT
	elif pitState == "voie" and zone.is_empty():
		# sorti de la voie : la demande s'éteint avec la sortie
		pitState = ""
		pitAsk = false
	if zone.is_empty(): pitServi = false
	# dans la voie, l'IA freine pour la zone comme pour un virage ; le joueur se conduit lui-même
	if inPit and aiDriven:
		if pitState == "voie" and float(zone.boite) < 0 and not pitServi:
			var reste := maxf(0, -float(zone.boite))
			var vCible := minf(STAND_vitesse, sqrt(2 * c.brake * 0.8 * reste))
			thr = 1.0 if v < vCible * 0.92 else 0.0
		elif pitState == "voie":
			thr = 1.0 if v < STAND_vitesse * 0.95 else 0.0
		else:
			thr = 0.0
	if inPit and pitState != "arret" and v > STAND_vitesse: thr = 0.0
	if pitState == "arret":
		pitT -= dt
		v = 0; vl = 0; w = 0
		if pitT <= 0:
			tyre = 1; damage = 0; enfoncement.fill(0); pitsDone += 1
			pitState = "voie"
			pitAsk = false
			pitServi = true
	if engineStopped: thr = 0
	thr = Piste.clamp_(thr, 0, 1)
	throttle = thr
	offT = 0.0 if thr != 0.0 else offT + dt
	braking = thr == 0.0 and offT > 0.05 and v > 2
	var hwLs := T.hwLeftAt(s)
	var hwRs := T.hwRightAt(s)
	var kb := T.kerbAt(s)
	var marge := c.width * 0.3
	# dans la voie des stands on est hors de la piste sans être hors piste : ni gravier, ni faute
	var horsRoute := not inPit and (lat > hwLs + marge or lat < -(hwRs + marge))
	var off := not inPit and (lat > hwLs + kb + marge or lat < -(hwRs + kb + marge))
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
	var enTravers: bool = GLISSADE_rattrapage and absf(beta) > GLISSADE_seuilTravers
	var brakeFrac: float = 0.0 if thr != 0.0 else Piste.clamp_(offT / 0.1, 0, 1) * (GLISSADE_freinTravers if enTravers else 1.0)
	var vv := maxf(3, absf(v))
	var peak: float = c.slipPeak * PHYS_slip
	var gTot := gripAt(absf(v)) * surface
	var kDes := _desiredCurvature()
	if GLISSADE_rattrapage and (absf(alphaR) > peak or absf(alphaF) > peak):
		var kLigne := T.lineCurv(s + 3, selS)
		if sgn(kDes) == sgn(kLigne) and absf(kDes) > absf(kLigne):
			kDes = kLigne
	var wLim: float = PHYS_wLim * gTot / vv
	var wDes := Piste.clamp_(v * kDes, -wLim, wLim)
	var gAxle := gTot * 0.5 / minf(1, c.rearBias)
	var ayFront := v * v * kDes * 0.5
	var aFff := peak * ayFront / maxf(1e-3, gAxle)
	var aFdes := Piste.clamp_(aFff + PHYS_yawK * peak * (wDes - w), -peak * 1.3, peak * 1.3)
	var ufront := (vl - a * w) / vv
	var steerTarget := atan(tan(aFdes) - ufront * _dir())
	var dMax := 0.5
	var rate: float = PHYS_steerRate
	delta += Piste.clamp_(Piste.clamp_(steerTarget, -dMax, dMax) - delta, -rate * dt, rate * dt)
	usage = v * v * absf(kDes) / maxf(1e-3, gTot)
	var aF := atan((vl - a * w + v * tan(delta)) / vv)
	var aR := atan((vl + b * w) / vv)
	var base := gAxle
	var cliffF: float = 1 - c.cliff * PHYS_cliff * smoothstep_(absf(aF), peak * 1.5, peak * 5)
	var cliffR: float = 1 - c.cliff * PHYS_cliff * smoothstep_(absf(aR), peak * 1.5, peak * 5)
	var dmg := damageFactor()
	var vmax := c.vmax * dmg * (1.05 if draft else 1.0)
	var accDem := thr * c.accel * c.driveFactor(maxf(0, v)) * dmg * maxf(0, 1 - pow(maxf(0, v) / vmax, 2.5)) * (1.08 if draft else 1.0) if thr != 0.0 else 0.0
	var transfert: float = PHYS_liftOff * brakeFrac * Piste.clamp_(freinRatio if freinRatio != 0.0 else 1.0, FREIN_MIN, FREIN_MAX)
	var gF := base * cliffF * (1 + transfert * TRANSFERT_AV)
	var gArrBrut := base * c.rearBias * (1 - transfert)
	var latPris := minf(1, absf(aR) / peak)
	var longDispo: float = gArrBrut * PHYS_motricite * sqrt(maxf(0, 1 - latPris * latPris))
	var qy := Piste.clamp_(aR / peak, -1, 1)
	var qx: float = accDem / maxf(1e-3, gArrBrut * cliffR * PHYS_motricite)
	var share := 1.0 if loose else 1 / maxf(1, Piste.hypot(qx, qy))
	var sature: float = 0.0 if loose or accDem <= 0 else Piste.clamp_((1 - share) / MOTRICITE_seuil, 0, 1)
	var tau: float = MOTRICITE_tauMontee if sature > glisseArr else MOTRICITE_tauRetour
	glisseArr += (sature - glisseArr) * (1 - exp(-dt / tau))
	var priority: float = PHYS_drivePriority
	var safeDrive := minf(accDem, longDispo * cliffR)
	var accReel := accDem if loose else safeDrive * (1 - priority) + accDem * share * priority
	patine = 0.0 if loose or accDem <= 0 else Piste.clamp_(1 - accReel / accDem, 0, 1)
	var spinFx := Piste.clamp_(1 - accReel / accDem, 0, 1) if not loose and not inPit and accDem > 0 else 0.0
	var spinTau := 0.035 if spinFx > patineFx else 0.08
	patineFx += (spinFx - patineFx) * (1 - exp(-dt / spinTau))
	var gR: float = gArrBrut * cliffR * (1.0 if loose else 1 - priority + priority * share) \
		* (1.0 if loose else 1 - MOTRICITE_perte * glisseArr)
	var FfT := -gF * Piste.clamp_(aF / peak, -1, 1)
	var FrT := -gR * Piste.clamp_(aR / peak, -1, 1)
	var relax := minf(1, dt * vv / PHYS_relax)
	Ff += (FfT - Ff) * relax
	Fr += (FrT - Fr) * relax
	# L'aimant : l'IA seulement (PHYS_aimant = 0 pour le joueur).
	var Fm := 0.0
	var aimant := _aimant()
	if aimant > 0 and not off and absf(v) > 3 and not inPit:
		var latCible := gridLat if not is_nan(gridLat) else T.targetLat(s, selS)
		var ecart := latCible - lat
		var dEcart := 0.0 if is_nan(ecartAv) else (ecart - ecartAv) / maxf(1e-4, dt)
		var plafond: float = AIMANT_max * gTot * aimant
		var tension: float = AIMANT_k * ecart
		var demande: float = tension + AIMANT_c * dEcart
		if accroche:
			if absf(tension) > plafond * AIMANT_lache: accroche = false
			else: Fm = Piste.clamp_(demande, -plafond, plafond)
		elif absf(tension) < plafond * AIMANT_reprend and absf(aR) < peak * AIMANT_derive:
			accroche = true
			Fm = Piste.clamp_(demande, -plafond, plafond)
		ecartAv = ecart
	else:
		accroche = true; ecartAv = NAN
	aimantF = Fm
	var aAim := L / 2
	var FmAv: float = Fm * (1 + AIMANT_devant / aAim) / 2
	var FmAr: float = Fm * (1 - AIMANT_devant / aAim) / 2
	var useF := absf(Ff) / maxf(1e-3, gF)
	var useR := absf(Fr) / maxf(1e-3, gR)
	var u := minf(1, maxf(useF, useR))
	var acc: float
	var dir := _dir()
	if thr != 0.0:
		acc = accReel * (maxf(0.3, 1 - PHYS_circle * u * u) if loose else 1.0)
	else:
		acc = -(1.5 + c.brake * brakeFrac) * (1 - PHYS_circle * u * u) * (1.0 if v > 1 else maxf(0, v))
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
	var wDot := (-a * (Ff + FmAv) + b * (Fr + FmAr)) / kk
	w = Piste.clamp_(w + wDot * dt, -4, 4)
	th = wrapAngle(th + w * dt)
	var v0 := v
	var vl0 := vl
	v = Piste.clamp_(v0 + (acc - vl0 * w) * dt, -0.25 * c.vmax, c.vmax * dmg * 1.05)
	# la limitation de la voie : sans elle, la voie serait un raccourci
	if inPit and v > STAND_vitesse: v = STAND_vitesse
	if pitState == "arret": v = 0
	vl = vl0 + (v0 * w + Ff + Fm + Fr) * dt
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


## La ligne : la voiture glisse vers celle qu'on lui demande au rythme que son adhérence permet.
## Avant, le trafic : la voiture de devant (aspiration, dépassement de l'IA) et celle d'à côté
## (js/car.js, steer).
func steer(cars: Array, dt: float, ai: bool) -> void:
	var T := track
	var c := cls
	if not is_nan(gridLat):
		laneTarget = gridLat; selS = sel
		return
	# une voiture qui rentre aux stands ne double plus personne : elle vise la voie (sel = -2)
	if pitAsk or pitState != "":
		selS += Piste.clamp_(-2 - selS, -PHYS_selRate * dt, PHYS_selRate * dt); selV = 0
		laneTarget = T.targetLat(s, selS)
		return
	var bl: Voiture = null
	var bd := INF
	var vo: Voiture = null
	var vdl := INF
	var portee := c.length * 3 + maxf(0, v) * 1.0
	for o: Voiture in cars:
		if o == self or blueFlag or o.blueFlag: continue
		var d := T.diff(s, o.s)
		if d > portee: continue
		var lenSum := (c.length + o.cls.length) / 2
		var dl := o.lat - lat
		var demiLarg := (c.width + o.cls.width) / 2
		if absf(d) < lenSum:
			if absf(dl) < demiLarg + 0.6 and absf(dl) < absf(vdl):
				vo = o; vdl = dl
			continue
		if d < lenSum or d >= bd: continue
		if o.v > v + 2.5 and d > c.length * 1.5: continue
		if absf(dl) < demiLarg * 1.5 + 0.4:
			bl = o; bd = d
	blocker = bl
	voisin = vo
	draft = bl != null and bd < c.length * 3.5 and absf(bl.lat - lat) < c.width * 0.9
	if ai:
		passTimer -= dt
		if bl:
			if passSide == 0 or passTimer <= 0:
				var sAv := s + 15
				var meilleur := 0
				var place_ := -INF
				for cote in [-1, 1]:
					var latC := T.targetLat(sAv, cote)
					var room := absf(latC - T.targetLat(sAv, bl.selS))
					for o: Voiture in cars:
						if o == self or o == bl: continue
						var d := T.diff(s, o.s)
						if d > -c.length * 2 and d < 40:
							room = minf(room, absf(latC - T.targetLat(sAv, o.selS)))
					# cand.sort((a, b) => b.room - a.room) : à égalité, -1 reste devant.
					if room > place_:
						place_ = room; meilleur = cote
				passSide = meilleur if place_ > c.width * 0.9 else 0
				passTimer = 2 + hasard.random() * 1.5
			sel = passSide
		elif passSide != 0 and passTimer <= 0:
			passSide = 0; sel = 0
		elif bl == null and passSide == 0:
			sel = 0
		if vo:
			var versVoisin := sgn(vdl)
			var latVise := T.targetLat(s, sel)
			if sgn(latVise - lat) == versVoisin and absf(latVise - lat) > absf(vdl) - (c.width + vo.cls.width) / 2:
				sel = selS
	_versLigne(sel, dt)
	laneTarget = T.targetLat(s, selS)


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
	var budget := Piste.clamp_(LIGNE_part * (aTot - vp * vp * kIci), LIGNE_aMin, LIGNE_aMax)
	var resteM := reste * D
	var vVoulue: float = sgn(resteM) * minf(LIGNE_vMax, sqrt(2 * budget * absf(resteM)))
	var kApres := absf(T.lineCurv(s, selS + sgn(reste) * 0.05))
	if kApres > kIci and vp * vp * kApres > aTot:
		vVoulue = 0
	selV += Piste.clamp_(vVoulue - selV, -budget * dt, budget * dt)
	selS += selV / D * dt
	if (cible - selS) * reste <= 0:
		selS = cible; selV = 0
