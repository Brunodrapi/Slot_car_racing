## La course, avec chaque pas calculé par le moteur C++ (godot/natif). La grille, le classement,
## les résultats et le guide restent ceux de Course ; seuls les pas changent de langage. Après
## chaque pas, l'état des voitures est relu dans les objets Voiture que lisent les écrans.
##
## La version web n'a pas le moteur C++ : elle garde Course, en GDScript, qui donne la même course.
class_name CourseNative
extends Course

var moteur: Object
var champs: PackedStringArray
var iTours := 0
var iChamps := {}


static func disponible() -> bool:
	return ClassDB.class_exists("MoteurNatif")


static func modeleNatif(m: Voiture.Modele) -> Dictionary:
	return { vmax = m.vmax, accel = m.accel, brake = m.brake, grip = m.grip, df = m.df, laneK = m.laneK, rearBias = m.rearBias,
		cliff = m.cliff, slipPeak = m.slipPeak, length = m.length, width = m.width, aCourbe = m.aCourbe, dcFrom = m.dcFrom,
		dcTo = m.dcTo, dcLow = m.dcLow, dcHigh = m.dcHigh }


static func etatNatif(car: Voiture, noms: PackedStringArray) -> Dictionary:
	var e := {}
	for n in noms:
		if n == "nTours": continue
		if n == "pitState":
			e[n] = float(["", "voie", "arret"].find(car.pitState))
			continue
		if n.begins_with("enf"):
			e[n] = float(car.enfoncement[int(n.substr(3))])
			continue
		var v = car.get(n)
		e[n] = float(v) if v is bool or v is int else v
	e.isPlayer = car.isPlayer; e.fantome = car.fantome; e.skill = car.skill
	e.gripBoost = car.gripBoost; e.freinRatio = car.freinRatio
	e.lapTimes = PackedFloat64Array(car.lapTimes)
	var ok := PackedFloat64Array()
	for b in car.lapOk: ok.append(1.0 if b else 0.0)
	e.lapOk = ok
	return e


func _init(piste: Piste, opts: Dictionary, h: Hasard) -> void:
	super._init(piste, opts, h)
	moteur = ClassDB.instantiate("MoteurNatif")
	champs = moteur.champs()
	for i in champs.size(): iChamps[champs[i]] = i
	iTours = iChamps.nTours
	moteur.piste(piste.pourNatif())
	for car in cars:
		moteur.ajoute(modeleNatif(car.cls), etatNatif(car, champs))
	var hard: Dictionary = difficultes.get("hard", difficulte)
	moteur.regle({ modeCourse = mode == "race", laps = laps, entrainement = entrainement, player = cars.find(player),
		fantome = cars.find(fantome) if fantome else -1, difficulte = difficulte, difficile = hard,
		profil = profilRacing, hasard = h.etat, countdown = countdown, time = time, state = 0, degats = degats, stands = stands })
	moteur.prepare()


## Recopie dans le moteur l'état des voitures GDScript (après une retouche, pour les tests).
func reverse() -> void:
	for i in cars.size(): moteur.pose(i, etatNatif(cars[i], champs))
	moteur.pose_hasard(hasard.etat)


func step(gaz: float) -> void:
	var ev: PackedInt32Array = moteur.pas(gaz, player.sel)
	_relit()
	# les chocs du pas, pour le dessin (Voiture.chocs, que le rendu vide)
	var ch: PackedFloat64Array = moteur.chocs()
	for k in range(0, ch.size(), 7):
		var c: Voiture = cars[int(ch[k])]
		if c.chocs.size() < 12:
			c.chocs.append({ nx = ch[k + 1], ny = ch[k + 2], v = ch[k + 3], frotte = ch[k + 4], sorte = ["rail", "tyres", "voiture"][int(ch[k + 5])], epave = ch[k + 6] != 0 })
	evenements.clear()
	for k in range(0, ev.size(), 2):
		var type: String = ["go", "crash", "lap", "finish"][ev[k]]
		if ev[k + 1] >= 0: evenements.append({ type = type, car = cars[ev[k + 1]] })
		else: evenements.append({ type = type })
	if state == "finished" and results.is_empty():
		_classe()


func _relit() -> void:
	var e: PackedFloat64Array = moteur.etats()
	var K := champs.size()
	for i in cars.size():
		var c := cars[i]
		var o := i * K
		c.x = e[o]; c.y = e[o + 1]; c.th = e[o + 2]; c.v = e[o + 3]; c.vl = e[o + 4]; c.w = e[o + 5]; c.delta = e[o + 6]
		c.s = e[o + 7]; c.lat = e[o + 8]; c.sel = e[o + 9]; c.selS = e[o + 10]; c.selV = e[o + 11]; c.beta = e[o + 12]
		c.slide = e[o + 13]; c.patine = e[o + 14]; c.patineFx = e[o + 15]; c.glisseArr = e[o + 16]; c.usage = e[o + 17]
		c.ressenti = e[o + 18]; c.Ff = e[o + 19]; c.Fr = e[o + 20]; c.alphaF = e[o + 21]; c.alphaR = e[o + 22]; c.offT = e[o + 23]
		c.grassT = e[o + 24]; c.engineCut = e[o + 25]; c.throttle = e[o + 26]; c.lapStart = e[o + 27]; c.bestLap = e[o + 28]
		c.bestLapBrut = e[o + 29]; c.finishTime = e[o + 30]; c.repris = e[o + 31]; c.sortieT = e[o + 32]; c.sortieS0 = e[o + 33]
		c.laneTarget = e[o + 34]; c.gridLat = e[o + 35]; c.aiTimer = e[o + 36]; c.aiNoise = e[o + 37]; c.aiAllow = e[o + 38]
		c.passTimer = e[o + 39]; c.ecartAv = e[o + 40]; c.aimantF = e[o + 41]; c.lastImpact = e[o + 42]
		c.herbe = e[o + 43] != 0; c.engineStopped = e[o + 44] != 0; c.braking = e[o + 45] != 0; c.started = e[o + 46] != 0
		c.checkpoint = e[o + 47] != 0; c.lapSale = e[o + 48] != 0; c.finished = e[o + 49] != 0; c.blueFlag = e[o + 50] != 0
		c.surKerb = e[o + 51] != 0; c.draft = e[o + 52] != 0; c.accroche = e[o + 53] != 0; c.aiLeve = e[o + 54] != 0
		c.lap = int(e[o + 55]); c.crashes = int(e[o + 56]); c.barrierHits = int(e[o + 57]); c.fautes = int(e[o + 58])
		c.rejoined = int(e[o + 59]); c.passSide = int(e[o + 60]); c.sortieI = int(e[o + 61])
		c.damage = e[o + 62]; c.tyre = e[o + 63]; c.abandonT = e[o + 64]; c.pitT = e[o + 65]; c.pitT0 = e[o + 66]
		c.abandon = e[o + 67] != 0; c.pitAsk = e[o + 68] != 0; c.pitServi = e[o + 69] != 0; c.inPit = e[o + 70] != 0
		c.pitState = ["", "voie", "arret"][int(e[o + 71])]; c.pitsDone = int(e[o + 72]); c.reculChoc = int(e[o + 73])
		for z in 8: c.enfoncement[z] = e[o + 74 + z]
		if int(e[o + iTours]) != c.lapTimes.size():
			var t: PackedFloat64Array = moteur.tours(i)
			c.lapTimes.clear(); c.lapOk.clear()
			for k in range(0, t.size(), 2):
				c.lapTimes.append(t[k]); c.lapOk.append(t[k + 1] != 0)
	var d: Dictionary = moteur.course()
	state = d.state; time = d.time; countdown = d.countdown; finishTimer = d.finishTimer; chequered = d.chequered
	zones.resize(int(d.zones))
	hasard.etat = int(d.hasard)
	var pen: PackedFloat64Array = d.penalites
	penalties.clear()
	for i in pen.size():
		if pen[i] >= 0: penalties[i] = pen[i]


func demandeStand(oui: bool) -> void:
	super.demandeStand(oui)
	moteur.demande_stand(oui)


func ecartFantome() -> float:
	return moteur.ecart_fantome()
