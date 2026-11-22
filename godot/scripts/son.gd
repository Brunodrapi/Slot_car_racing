## Le son de la course, d'après js/audio.js et js/engine-audio.js : un moteur simulé avec sa boîte
## (EAEngine, EADrivetrain, EAVehicle), qui accorde quatre boucles enregistrées (gaz ou pied levé,
## bas ou haut régime) et le rupteur ; les crissements, le gravier et le vent, faits de bruit
## filtré ; et les bruits brefs — choc, clac du levier, bips du départ et du tour.
class_name Son
extends Node

const RPM_PAR_OMEGA := 60.0 / TAU
const PITCH := 0.2               # centièmes de demi-ton par tour/minute (EASampler.pitchFactor)

var conf := {}
var voix := {}                   # cle -> { lecteur, rpm, volume }
var niveau := 1.0
var bruits := {}                 # crisse1, crisse2, gravier, vent -> AudioStreamPlayer
var gains := {}                  # les gains lissés (setTargetAtTime)
var brefs := {}                  # thud, clac+, clac-, tour, record, go, arrivee
var temps := 0.0
var rpm := 0.0
var rapport := 0

# EAEngine
var e := {}
# EADrivetrain
var d := {}
var roue := 0.32
var subSteps := 20
var embrayage := 1.0


func _ready() -> void:
	_bus("Moteur", [])
	var bp1 := AudioEffectBandPassFilter.new(); bp1.cutoff_hz = 1700; bp1.resonance = 0.9
	_bus("Crisse1", [bp1])
	var bp2 := AudioEffectBandPassFilter.new(); bp2.cutoff_hz = 780; bp2.resonance = 0.6
	_bus("Crisse2", [bp2])
	var lp := AudioEffectLowPassFilter.new(); lp.cutoff_hz = 700
	_bus("Gravier", [lp])
	var bv := AudioEffectBandPassFilter.new(); bv.cutoff_hz = 500; bv.resonance = 0.2
	_bus("Vent", [bv])
	var master := AudioServer.get_bus_index("Master")
	if AudioServer.get_bus_effect_count(master) == 0:
		var comp := AudioEffectCompressor.new()
		comp.threshold = -14; comp.ratio = 4; comp.attack_us = 4000; comp.release_ms = 120
		AudioServer.add_bus_effect(master, comp)
	var bruit := _bruit()
	for b in [["crisse1", "Crisse1"], ["crisse2", "Crisse2"], ["gravier", "Gravier"], ["vent", "Vent"]]:
		var l := AudioStreamPlayer.new()
		l.stream = bruit
		l.bus = b[1]
		l.volume_db = -80
		add_child(l)
		l.play(randf())
		bruits[b[0]] = l
		gains[b[0]] = 0.0
	gains.moteur = 0.0
	brefs.thud = _bref(_synthThud())
	brefs["clac+"] = _bref(_synthClac(1))
	brefs["clac-"] = _bref(_synthClac(-1))
	brefs.tour = _bref(_synthBip(1200, 0.21, 0.45, true))
	brefs.record = _bref(_synthBip(1480, 0.21, 0.45, true))
	brefs.go = _bref(_synthBip(880, 0.4, 0.3, false))
	brefs.arrivee = _bref(_synthBip(660, 0.6, 0.3, false))
	# les bruits du stand (audio.js, _stand) : quelques variantes de chaque, tirées au hasard
	for i in 4: brefs["cling%d" % i] = _bref(_synthCling(1900 + randf() * 900))
	for i in 3: brefs["clacStand%d" % i] = _bref(_synthClacStand(1300 + randf() * 500))
	brefs.zout = _bref(_synthZout())
	for k in brefs: brefs[k].max_polyphony = 3


func _bus(nom: String, effets: Array) -> void:
	if AudioServer.get_bus_index(nom) >= 0: return
	AudioServer.add_bus()
	var i := AudioServer.bus_count - 1
	AudioServer.set_bus_name(i, nom)
	AudioServer.set_bus_send(i, "Master")
	for fx in effets: AudioServer.add_bus_effect(i, fx)


func _bref(s: AudioStreamWAV) -> AudioStreamPlayer:
	var l := AudioStreamPlayer.new()
	l.stream = s
	l.volume_db = linear_to_db(0.5)       # le volume général du jeu web (master.gain = 0,5)
	add_child(l)
	return l


func joue(nom: String) -> void:
	if brefs.has(nom): brefs[nom].play()


## La voiture du joueur : son jeu de prises et les réglages de son moteur (audio.js, _voiture).
func voiture(id: String) -> void:
	var cat: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://donnees/sons.json"))
	var v: Dictionary = Catalogue.voiture(id)
	var eng: Dictionary = v.get("engine", {}) if v.get("engine") else {}
	var c: Dictionary = cat.voitures.get(id, { jeu = "procar", wheel_radius = 0.32,
		engine = { limiter = eng.get("redline", 7000), idle = eng.get("idle", 1000) }, drivetrain = {} })
	var j: Dictionary = cat.jeux[c.jeu]
	e = { idle = 1000.0, limiter = 7000.0, soft_limiter = 0.0, inertia = 1.0, torque = 400.0, engine_braking = 200.0, limiter_ms = 0.0, limiter_delay = 100.0 }
	for k in j.engine: e[k] = float(j.engine[k])
	for k in c.get("engine", {}): e[k] = float(c.engine[k])
	var engCfg: Dictionary = j.engine.duplicate(); engCfg.merge(c.get("engine", {}), true)
	if not engCfg.has("soft_limiter"): e.soft_limiter = e.limiter * 0.99
	if c.get("engine", {}).has("limiter") and not c.engine.has("soft_limiter"): e.soft_limiter = float(c.engine.limiter) * 0.99
	d = { gears = [3.4, 2.36, 1.85, 1.47, 1.24, 1.07], final_drive = 3.44, inertia = 0.15, damping = 12.0, compliance = 0.01, shiftTime = 50.0, clutch_stiffness = 180.0 }
	for k in j.drivetrain: d[k] = j.drivetrain[k]
	for k in c.get("drivetrain", {}): d[k] = c.drivetrain[k]
	roue = float(c.get("wheel_radius", 0.32))
	_initMoteur()
	_initBoite()
	var dernier: float = d.gears[-1]
	var omegaRoue := Catalogue.modele(id).vmax / roue
	if omegaRoue > 0 and dernier > 0: d.final_drive = e.limiter / (omegaRoue * dernier * RPM_PAR_OMEGA)
	for k in voix: voix[k].lecteur.queue_free()
	voix.clear()
	niveau = float(j.niveau)
	for cle in j.sons:
		var s: Dictionary = j.sons[cle]
		var flux: AudioStreamOggVorbis = load(s.fichier).duplicate()
		flux.loop = true
		var l := AudioStreamPlayer.new()
		l.stream = flux
		l.bus = "Moteur"
		l.volume_db = -80
		add_child(l)
		l.play()
		voix[cle] = { lecteur = l, rpm = float(s.rpm), volume = float(s.volume) }


func _initMoteur() -> void:
	e.throttle = 0.0; e.throttleEff = 0.0; e.theta = 0.0; e.omega = e.idle / RPM_PAR_OMEGA; e.prevTheta = 0.0; e.prevOmega = 0.0
	e.rpm = e.idle; e.dernierRupteur = -1e9; e.auRupteur = false


func _initBoite() -> void:
	d.gear = 0; d.theta = 0.0; d.omega = 0.0; d.prevTheta = 0.0; d.prevOmega = 0.0
	d.passageA = -1.0; d.rapportVise = 0; d.facteur = 1.0; d.downShift = false


static func _ratio(v: float, a: float, b: float) -> float:
	return clampf((v - a) / (b - a), 0, 1)


# ---------- EAEngine ----------
func _integreMoteur(t: float, h: float) -> void:
	var thr: float = e.throttle
	if e.rpm >= e.soft_limiter: thr *= 1 - _ratio(e.rpm, e.soft_limiter, e.limiter)
	if e.rpm >= e.limiter: e.dernierRupteur = t
	var depuis: float = t - e.dernierRupteur
	if depuis >= e.limiter_ms: thr *= _ratio(depuis - e.limiter_ms, 0, e.limiter_delay)
	else: thr = 0
	e.auRupteur = depuis < e.limiter_ms + e.limiter_delay
	e.throttleEff = thr
	var ralenti := 0.0
	if thr < 0.1 and e.rpm < e.idle * 1.5:
		ralenti = (1 - _ratio(e.rpm, e.idle * 0.9, e.idle)) * e.engine_braking * 10
	var couple: float = pow(thr, 1.2) * e.torque - pow(1 - thr, 1.2) * e.engine_braking + ralenti
	var I: float = 0 + e.inertia
	e.prevTheta = e.theta
	e.omega += (couple / I) * h
	e.theta += e.omega * h
	e.rpm = maxf(0, e.omega * RPM_PAR_OMEGA)


func _ratioDe(g: int) -> float:
	var gg := clampi(g, 0, d.gears.size())
	return float(d.gears[gg - 1]) if gg > 0 else 0.0


func _rpmPour(v: float, g: int) -> float:
	var r := _ratioDe(g) * float(d.final_drive)
	return (v / roue) * r * RPM_PAR_OMEGA if r > 0 else 0.0


func _rapportPour(v: float) -> int:
	var n: int = d.gears.size()
	var g: int = d.gear if d.gear else 1
	while g < n and _rpmPour(v, g) > e.limiter * 0.95: g += 1
	while g > 1 and _rpmPour(v, g - 1) < e.limiter * 0.55: g -= 1
	return g


func _passe(g: int, t: float) -> void:
	var avant := _ratioDe(d.gear)
	var apres := _ratioDe(g)
	var f := apres / avant if avant > 0 else 0.0
	if f == 1: return
	d.gear = 0
	d.downShift = f > 1
	d.passageA = t + d.shiftTime
	d.rapportVise = clampi(g, 0, d.gears.size())
	d.facteur = f


func _avance(t: float) -> void:
	if d.passageA < 0 or t < d.passageA: return
	d.omega *= d.facteur
	d.gear = d.rapportVise
	d.downShift = false
	d.passageA = -1.0
	d.theta = e.theta; d.prevTheta = e.theta


## EAVehicle.update : le régime du moteur, à `v` m/s et `gaz` d'accélérateur.
func _vehicule(t: float, dt: float, v: float, gaz: float, patine: float) -> float:
	e.throttle = clampf(gaz, 0, 1)
	var vise := _rapportPour(v)
	if d.passageA < 0 and d.gear != vise and vise > 0: _passe(vise, t)
	_avance(t)
	var spin: float = clampf(patine, 0, 1) * e.throttle * _ratio(v, 3, 8)
	var rpmV := _rpmPour(v, d.gear)
	var reserve: float = maxf(0, v * (e.limiter * 0.98 / rpmV - 1)) if rpmV > 0 else 0.0
	var vRoue: float = v + minf(minf(v * 0.12, 4), reserve) * spin
	var emb: float = 0.0 if d.passageA >= 0 else _ratio(_rpmPour(v, maxi(1, d.gear)), e.idle * 0.55, e.idle * 1.15)
	embrayage = emb
	var h := dt / subSteps
	for i in subSteps:
		var ti := t + dt * 1000 * (float(i) / subSteps)
		_integreMoteur(ti, h)
		d.prevTheta = d.theta; d.theta += d.omega * h
		if emb > 0.01:
			if d.gear != 0:
				var compliance := maxf(0.0006 - 0.00015 * d.gear, 0.00007)
				var c1: float = d.theta - e.theta
				e.theta += _correction(c1, h, compliance, e.inertia) * signf(c1)
			var c2: float = e.theta - d.theta
			d.theta += c2 * (c2 / (c2 * c2 / d.inertia + d.compliance / h / h)) * signf(c2)
		e.prevOmega = e.omega; e.omega = (e.theta - e.prevTheta) / h
		d.prevOmega = d.omega; d.omega = (d.theta - d.prevTheta) / h
		var dampE: float = (d.clutch_stiffness * 0.8 if d.gear > 3 else d.clutch_stiffness) * emb
		e.omega += (d.omega - e.omega) * minf(0.5, dampE * h)
		var dampD: float = (d.damping * 0.75 if d.gear > 3 else d.damping) * emb
		d.omega += (e.omega - d.omega) * minf(0.5, dampD * h)
		if d.gear > 0:
			var cible: float = (vRoue / roue) * _ratioDe(d.gear) * float(d.final_drive)
			d.omega += (cible - d.omega) * minf(0.6, 120 * h)
	if e.omega < 0: e.omega = 0.0; e.rpm = 0.0
	e.rpm = maxf(0, e.omega * RPM_PAR_OMEGA)
	return e.rpm


func _correction(corr: float, h: float, compliance: float, inertie: float) -> float:
	var w := corr * corr / inertie
	var dl := -corr / (w + compliance / h / h)
	return corr * -dl


static func _fondu(v: float, a: float, b: float) -> Vector2:
	var x := clampf((v - a) / (b - a), 0, 1)
	return Vector2(cos((1 - x) * 0.5 * PI), cos(x * 0.5 * PI))   # (haut, bas)


func _vise(cle: String, cible: float, tau: float, dt: float) -> float:
	gains[cle] += (cible - gains[cle]) * (1 - exp(-dt / tau))
	return gains[cle]


## Une image de son : la voiture du joueur, et si la course roule.
func maj(car: Voiture, enCourse: bool, dt: float) -> void:
	_stand(car, dt)
	if e.is_empty(): return
	temps += dt
	var dtm := clampf(dt, 1.0 / 240, 0.05)
	var v := maxf(0, car.v)
	var thr := clampf(car.throttle, 0, 1)
	var spin: float = clampf(car.patineFx, 0, 1) if enCourse and (not car.herbe or car.runoffAsphalt()) else 0.0
	rpm = _vehicule(temps * 1000, dtm, v if enCourse else 0.0, thr, spin)
	rapport = d.gear
	# EASampler.applique
	var r := _fondu(rpm, 3000, 6500)
	var g := _fondu(float(e.throttle), 0, 1)
	# le moteur de la course laisse passer le démarrage d'« En piste » (App.partMoteur), puis prend le relais
	var moteur := _vise("moteur", 0.0 if car.engineStopped else 0.85 * App.partMoteur(), 0.04, dt) * 0.5
	var pose := func(cle: String, gain: float, accorde: bool) -> void:
		if not voix.has(cle): return
		var s: Dictionary = voix[cle]
		if accorde: s.lecteur.pitch_scale = clampf(pow(2.0, (rpm - s.rpm) * PITCH / 1200.0), 0.05, 8.0)
		s.lecteur.volume_db = linear_to_db(maxf(1e-5, gain * s.volume * niveau * moteur))
	pose.call("on_low", g.x * r.y, true)
	pose.call("off_low", g.y * r.y, true)
	pose.call("on_high", g.x * r.x, true)
	pose.call("off_high", g.y * r.x, true)
	pose.call("limiter", _ratio(rpm, e.soft_limiter * 0.93, e.limiter), false)
	# Les pneus, le gravier, le vent (audio.js, update)
	var lateral := clampf(car.slide * 1.7, 0, 1)
	var surPiste: bool = enCourse and (not car.herbe or car.runoffAsphalt())
	var sq: float = 1 - (1 - lateral) * (1 - spin * 0.85) if surPiste else 0.0
	var gq := _vise("crisse1", sq * sq * 0.3, 0.03, dt) * 0.5
	bruits.crisse1.volume_db = linear_to_db(maxf(1e-5, gq))
	bruits.crisse2.volume_db = linear_to_db(maxf(1e-5, gq))
	_filtre("Crisse1", 1200 + v * 12 + sq * 500)
	_filtre("Crisse2", 600 + v * 5)
	var off := minf(1, v / 25) if car.herbe and not car.runoffAsphalt() else 0.0
	bruits.gravier.volume_db = linear_to_db(maxf(1e-5, _vise("gravier", off * 0.34, 0.05, dt) * 0.5))
	_filtre("Gravier", 400 + v * 14)
	var w := minf(1, v / car.cls.vmax)
	bruits.vent.volume_db = linear_to_db(maxf(1e-5, _vise("vent", w * w * 0.11, 0.1, dt) * 0.5))
	_filtre("Vent", 350 + v * 9)


func _filtre(bus: String, hz: float) -> void:
	var fx := AudioServer.get_bus_effect(AudioServer.get_bus_index(bus), 0) as AudioEffectFilter
	if fx: fx.cutoff_hz = clampf(hz, 20, 18000)


func silence() -> void:
	for k in voix: voix[k].lecteur.volume_db = -80
	for k in bruits: bruits[k].volume_db = -80
	for k in gains: gains[k] = 0.0
	if not e.is_empty(): _initMoteur()


# ---------- les bruits du stand ----------
var _tStand := 0.0
var _standProchain := -1.0
var _standOutils := 99


## Tant que la voiture est arrêtée dans sa case, l'équipe travaille : la visseuse ouvre le bal, puis
## deux ou trois outils (une clé qui tinte, une pièce qu'on claque), puis la visseuse… (audio.js)
func _stand(car: Voiture, dt: float) -> void:
	_tStand += dt
	if car.pitState != "arret":
		_standProchain = -1.0
		return
	if _standProchain < 0:
		_standProchain = _tStand + 0.15
		_standOutils = 99
	if _tStand < _standProchain: return
	if _standOutils >= 2 + (1 if randf() < 0.5 else 0):
		joue("zout"); _standOutils = 0; _standProchain = _tStand + 0.8 + randf() * 0.3
	else:
		_standOutils += 1
		if randf() < 0.55: joue("cling%d" % (randi() % 4)); _standProchain = _tStand + 0.18 + randf() * 0.32
		else: joue("clacStand%d" % (randi() % 3)); _standProchain = _tStand + 0.22 + randf() * 0.32


## Une rampe exponentielle de WebAudio : de v0 à v1 en T secondes.
static func _rampe(v0: float, v1: float, t: float, T: float) -> float:
	return v0 * pow(v1 / v0, clampf(t / T, 0, 1))


## Un filtre passe-bande (BiquadFilter de WebAudio), échantillon par échantillon.
class PasseBande:
	var b0: float
	var b2: float
	var a1: float
	var a2: float
	var x1 := 0.0
	var x2 := 0.0
	var y1 := 0.0
	var y2 := 0.0
	func _init(f: float, q: float) -> void:
		var w0 := TAU * f / TAUX
		var al := sin(w0) / (2 * q)
		var a0 := 1 + al
		b0 = al / a0; b2 = -al / a0; a1 = -2 * cos(w0) / a0; a2 = (1 - al) / a0
	func pas(x: float) -> float:
		var y := b0 * x + b2 * x2 - a1 * y1 - a2 * y2
		x2 = x1; x1 = x; y2 = y1; y1 = y
		return y


## Une clé qui tinte : trois partiels inharmoniques, l'aigu s'éteignant le premier.
static func _synthCling(f: float) -> AudioStreamWAV:
	var n := int(TAUX * 0.36)
	var a := PackedFloat32Array(); a.resize(n)
	for i in n:
		var t := float(i) / TAUX
		var v := 0.0
		for p in [[1.0, 0.2, 0.32], [2.76, 0.11, 0.18], [5.4, 0.05, 0.1]]:
			if t > p[2]: continue
			var g := _rampe(0.0001, p[1], t, 0.002) if t < 0.002 else _rampe(p[1], 0.0001, t - 0.002, p[2] - 0.002)
			v += sin(TAU * f * p[0] * t) * g
		a[i] = v
	return _wav(a)


## Une pièce qu'on claque : un éclat de bruit, et le choc sourd de ce qui retombe en place.
static func _synthClacStand(fc: float) -> AudioStreamWAV:
	var n := int(TAUX * 0.12)
	var a := PackedFloat32Array(); a.resize(n)
	var bp := PasseBande.new(fc, 2.2)
	var phase := 0.0
	for i in n:
		var t := float(i) / TAUX
		var gn := 0.0
		if t < 0.07: gn = _rampe(0.0001, 0.55, t, 0.002) if t < 0.002 else _rampe(0.55, 0.001, t - 0.002, 0.048)
		var f := _rampe(170, 70, t, 0.08)
		phase += f / TAUX
		var tri := 4 * absf(phase - floor(phase + 0.5)) - 1
		var go := _rampe(0.0001, 0.45, t, 0.003) if t < 0.003 else _rampe(0.45, 0.001, t - 0.003, 0.097)
		a[i] = bp.pas(randf() * 2 - 1) * gn + tri * go
	return _wav(a)


## La visseuse à chocs : deux coups, zout zout — une dent de scie grave qui monte un peu, hachée
## trente-deux fois par seconde, et un souffle d'air par-dessus.
static func _synthZout() -> AudioStreamWAV:
	var n := int(TAUX * 0.56)
	var a := PackedFloat32Array(); a.resize(n)
	var dur := 0.22
	for d0 in [0.0, 0.3]:
		var bp := PasseBande.new(900, 1.2)
		var bn := PasseBande.new(3000, 1.0)
		var phase := 0.0
		for i in range(int(d0 * TAUX), mini(n, int((d0 + dur + 0.02) * TAUX))):
			var t: float = float(i) / TAUX - d0
			var env: float
			if t < 0.015: env = _rampe(0.0001, 0.42, t, 0.015)
			elif t < dur - 0.04: env = 0.42
			else: env = _rampe(0.42, 0.0001, t - (dur - 0.04), 0.04)
			var f := 95 + (150 - 95) * clampf(t / dur, 0, 1)
			phase += f / TAUX
			var scie: float = 2 * (phase - floor(phase + 0.5))
			var hache := 0.5 + 0.5 * (1.0 if fmod(t * 32, 1.0) < 0.5 else -1.0)
			a[i] += (bp.pas(scie) + bn.pas(randf() * 2 - 1) * 0.25) * hache * env
	return _wav(a)


# ---------- les sons synthétisés ----------
const TAUX := 44100


static func _wav(echantillons: PackedFloat32Array, boucle := false) -> AudioStreamWAV:
	var data := PackedByteArray()
	data.resize(echantillons.size() * 2)
	for i in echantillons.size():
		data.encode_s16(i * 2, int(clampf(echantillons[i], -1, 1) * 32767))
	var s := AudioStreamWAV.new()
	s.format = AudioStreamWAV.FORMAT_16_BITS
	s.mix_rate = TAUX
	s.stereo = false
	s.data = data
	if boucle:
		s.loop_mode = AudioStreamWAV.LOOP_FORWARD
		s.loop_begin = 0
		s.loop_end = echantillons.size()
	return s


static func _bruit() -> AudioStreamWAV:
	var a := PackedFloat32Array()
	a.resize(TAUX)
	for i in TAUX: a[i] = randf() * 2 - 1
	return _wav(a, true)


static func _synthThud() -> AudioStreamWAV:
	var n := int(TAUX * 0.45)
	var a := PackedFloat32Array(); a.resize(n)
	var phase := 0.0
	var lp := 0.0
	for i in n:
		var t := float(i) / TAUX
		var f := 120 * pow(30.0 / 120, minf(1, t / 0.35))
		phase += f / TAUX
		var tri := 4 * absf(phase - floor(phase + 0.5)) - 1
		var g1 := 0.6 * pow(0.001 / 0.6, minf(1, t / 0.4))
		lp += (randf() * 2 - 1 - lp) * 0.18
		var g2 := 0.5 * pow(0.001 / 0.5, minf(1, t / 0.3)) if t < 0.32 else 0.0
		a[i] = tri * g1 + lp * g2 * 2
	return _wav(a)


static func _synthClac(sens: int) -> AudioStreamWAV:
	var n := int(TAUX * 0.09)
	var a := PackedFloat32Array(); a.resize(n)
	var phase := 0.0
	var bp := 0.0
	var bp2 := 0.0
	var f0 := 3400.0 if sens > 0 else 2800.0
	var k := 2 * sin(PI * f0 / TAUX)
	for i in n:
		var t := float(i) / TAUX
		var x := randf() * 2 - 1
		bp += k * (x - bp - bp2 * 0.4); bp2 += k * bp
		var gn := 0.6 * (t / 0.002 if t < 0.002 else pow(0.001 / 0.6, minf(1, (t - 0.002) / 0.033))) if t < 0.05 else 0.0
		var f := (230.0 if sens > 0 else 190.0) * pow(85.0 / (230.0 if sens > 0 else 190.0), minf(1, t / 0.055))
		phase += f / TAUX
		var tri := 4 * absf(phase - floor(phase + 0.5)) - 1
		var go := 0.4 * (t / 0.003 if t < 0.003 else pow(0.001 / 0.4, minf(1, (t - 0.003) / 0.072)))
		a[i] = bp * gn + tri * go
	return _wav(a)


## LE CLIC DES MENUS (js/audio.js, clic) : de la famille du clac du levier, deux fois plus court et
## plus discret — un éclat de bruit aigu (4,2 kHz) et une note brève qui tombe de 1300 à 520 Hz.
static func _synthClic() -> AudioStreamWAV:
	var n := int(TAUX * 0.05)
	var a := PackedFloat32Array(); a.resize(n)
	var phase := 0.0
	var bp := 0.0
	var bp2 := 0.0
	var k := 2 * sin(PI * 4200.0 / TAUX)
	for i in n:
		var t := float(i) / TAUX
		var x := randf() * 2 - 1
		bp += k * (x - bp - bp2 * 0.33); bp2 += k * bp
		var gn := 0.35 * (t / 0.0015 if t < 0.0015 else pow(0.001 / 0.35, minf(1, (t - 0.0015) / 0.0165))) if t < 0.03 else 0.0
		var f := 1300.0 * pow(520.0 / 1300.0, minf(1, t / 0.03))
		phase += f / TAUX
		var tri := 4 * absf(phase - floor(phase + 0.5)) - 1
		var go := 0.16 * (t / 0.002 if t < 0.002 else pow(0.001 / 0.16, minf(1, (t - 0.002) / 0.038)))
		a[i] = bp * gn + tri * go
	return _wav(a)


static func _synthBip(f: float, duree: float, vol: float, tenu: bool) -> AudioStreamWAV:
	var n := int(TAUX * (duree + 0.05))
	var a := PackedFloat32Array(); a.resize(n)
	for i in n:
		var t := float(i) / TAUX
		var g: float
		if tenu:
			g = vol * (t / 0.006 if t < 0.006 else (1.0 if t < 0.11 else pow(0.001 / vol, minf(1, (t - 0.11) / 0.1))))
		else:
			g = vol * pow(0.001 / vol, minf(1, t / duree))
		a[i] = sin(TAU * f * t) * g
	return _wav(a)
