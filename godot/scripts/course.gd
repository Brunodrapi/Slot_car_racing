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
# En ligne (js/race.js, opts.humans) : la grille des humains, l'IA pour compléter, les contacts
# coupés au contre-la-montre partagé, la conduite réseau (NetDrive), l'attente des retardataires.
var humans = null
var aiFill := false
var noContact := false
var spectator := false
var netDrive = null
var broadcast = null
var attente := false
var finishDeadline := NAN
# Les dégâts (js/race.js, essai) : `degatsVisu`, les bosses se voient (course et contre-la-montre) ;
# `degats`, elles coûtent (en course seulement) ; `stands`, la voie sert à réparer.
var degatsVisu := false
var degats := {}
var stands := false
var _evenementsEnAttente: Array = []
const NET_FINISH_GRACE := 30.0


## `opts` : modele (Modele), difficulte (Dictionary du catalogue), mode, laps, nCars, roster
## (pilotes de l'IA : nom, modele, livery, livree, skill), catalogue (Callable id -> Modele).
# Le réglage de frein du joueur (js/race.js, poseFrein) et le mode RÉGLER (`reglage` : un levier de
# freinage en haut de l'écran, et la pause propose d'enregistrer la configuration).
var phase := "course"
var dureeSession := 0.0
var reglage := false
var frein := 1.0
var freinBase := 0.0


## Changer le frein du joueur, en course et sans tout reconstruire : toujours depuis `freinBase`, jamais
## depuis la valeur courante, sinon le réglage dériverait à chaque pixel du levier.
func poseFrein(f: float) -> void:
	frein = clampf(f, Voiture.FREIN_MIN, Voiture.FREIN_MAX)
	if player == null: return
	player.cls.brake = freinBase * frein
	player.freinRatio = frein


func _init(piste: Piste, opts: Dictionary, h: Hasard) -> void:
	track = piste
	hasard = h
	cls = opts.modele
	mode = opts.get("mode", "race")
	laps = int(opts.get("laps", 3))
	difficulte = opts.difficulte
	entrainement = opts.get("entrainement", false) and mode == "timetrial"
	difficultes = opts.get("difficultes", {})
	humans = opts.get("humans")
	aiFill = opts.get("aiFill", false)
	phase = String(opts.get("phase", "course"))
	dureeSession = float(opts.get("dureeSession", 0))
	if dureeSession > 0: finishDeadline = dureeSession
	noContact = opts.get("noContact", false) or dureeSession > 0
	spectator = opts.get("spectator", false)
	degatsVisu = bool(opts.get("degats", false))
	reglage = bool(opts.get("reglage", false))
	if degatsVisu and mode == "race" and dureeSession <= 0:
		degats = Voiture.DEGATS.duplicate()
		degats.abandon = humans == null      # l'abandon en solo seulement : en ligne il devrait passer par le réseau
	# les stands, et pas sur un circuit sans voie : la coche n'y mènerait nulle part
	stands = not degats.is_empty() and not track.pit.is_empty()
	profilRacing = Course.speedProfile(track, cls, "racing", 0.98)
	_buildGrid(opts)


func _buildGrid(opts: Dictionary) -> void:
	var T := track
	var c := cls
	# `humans` fait une grille en ligne : une place par personne, dans l'ordre que la table a gelé
	# au départ, aux dernières places. Une seule est `local` : la voiture que cet écran conduit.
	var nh: int = (humans as Array).size() if humans != null else 1
	var solo := mode == "timetrial" and humans == null
	var n: int
	if solo: n = 1
	elif humans != null and not aiFill: n = nh
	elif humans != null and int(opts.get("aiCount", -1)) >= 0: n = nh + clampi(int(opts.aiCount), 0, 12 - nh)
	else: n = maxi(nh + 1, mini(int(opts.get("nCars", c.drivers)), 12))
	var roster: Array = opts.roster if opts.get("roster") is Array and (opts.roster as Array).size() else [{ nom = "IA", modele = "", livery = 0, livree = 0, skill = 0.5 }]
	var gap := c.length * 2.2
	for i in n:
		var hIdx: int = i - (n - nh) if humans != null else (0 if i == n - 1 else -1)
		var h = humans[hIdx] if hIdx >= 0 and humans != null else null
		var humain := hIdx >= 0
		var joueur: bool = (h != null and bool(h.get("local", false))) if humans != null else humain
		var s0 := T.length - 8 - i * gap
		var lat0 := (1.0 if i % 2 == 0 else -1.0) * minf(T.halfWidth * 0.45, c.width * 0.9)
		var ai: Dictionary = roster[i % roster.size()]
		var modele: Voiture.Modele
		if h != null:
			# Le repli d'un pilote en ligne ne dépend que de sa place, jamais de l'écran qui dessine.
			var mid = h.get("modelId")
			if mid is String and not Catalogue.voiture(mid).is_empty(): modele = Catalogue.modele(mid)
			else: modele = opts.modeleDe.call("", hIdx + 1)
		elif humain: modele = c
		else: modele = opts.modeleDe.call(ai.modele, i)
		var car := Voiture.new(T, modele, s0, lat0, hasard)
		if h != null: car.nom = String(h.get("name", "")) if h.get("name") else Textes.t("driverDefault")
		else: car.nom = opts.get("nomJoueur", "Vous") if humain else ai.nom
		var nLiv: int = maxi(1, int(opts.get("nLivreries", 1)))
		if h != null: car.livery = int(h.get("livery", 0)) % nLiv
		else: car.livery = int(opts.get("livery", 0)) if humain else int(ai.livery)
		if h != null: car.livree = int(h.get("livree", 0)) if h.get("livree") != null else 0
		else: car.livree = int(opts.get("livree", 0)) if humain else int(ai.livree)
		car.isPlayer = joueur
		car.skill = 1.0 if humain else float(ai.skill)
		car.gripBoost = 1.0 if humain or h != null else float(difficulte.get("grip", 1.0))
		car.numero = 1 + hIdx if humain else 2 + i
		car.human = hIdx if humain and humans != null else -1
		car.laneTarget = lat0
		car.gridLat = lat0
		car.degats = degats
		cars.append(car)
	player = cars[cars.size() - 1]
	for k in cars:
		if k.isPlayer:
			player = k
			break
	# Le réglage de frein du joueur (poseFrein) : sa classe est une copie.
	player.cls = player.cls.copie()
	freinBase = player.cls.brake
	poseFrein(float(opts.get("frein", 1.0)))
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
	car.nom = Textes.t("ghost")
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
	evenements.append_array(_evenementsEnAttente)
	_evenementsEnAttente.clear()
	if state == "countdown":
		if netDrive != null:
			# L'époque partagée de l'horloge de l'hôte change la phase, dans beforeFrame : faire
			# rugir le moteur n'avance ni le décompte ni la voiture.
			for car in cars:
				if netDrive.owns(car): car.throttle = gaz if car.isPlayer else (1.0 if countdown < 1.2 else 0.0)
			return
		# Le décompte attend que tout le monde ait fini de charger (voir race.js, `attente`).
		if attente: return
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
	if dureeSession > 0 and time >= dureeSession:
		finishDeadline = dureeSession
		if netDrive == null or (netDrive.host and netDrive.canFinalize()):
			state = "finished"
			_classe()
		return
	# le joueur a abandonné : on laisse voir l'épave sept secondes (l'écran ABANDON), puis la course
	# se termine sans lui
	if state == "racing" and player.abandon and netDrive == null:
		state = "finishing"; finishTimer = 7.0; finishDeadline = time + finishTimer
	if state == "finishing" and (netDrive == null or netDrive.host):
		if netDrive != null: finishTimer = maxf(0, finishDeadline - time)
		else: finishTimer -= dt
		var concurrents := cars.filter(func(k): return k.human >= 0) if humans != null else cars
		var echu: bool = finishTimer <= 0 and (netDrive == null or netDrive.canFinalize())
		if echu or concurrents.all(func(k): return k.finished or k.abandon):
			_finish()


## La coche des stands du joueur : une intention, pas une quatrième position de ligne.
func demandeStand(oui: bool) -> void:
	if stands: player.pitAsk = oui


## La coche s'ouvre sur une voiture abîmée (plus de 2 %), après le premier tour, et pas deux fois
## dans le même passage (render.js, _drawSlider).
func standOuvert() -> bool:
	var p := player
	return stands and p.lap >= 1 and not p.pitServi and not p.finished and not p.abandon and (p.damage > 0.02 or p.pitAsk or p.pitState != "")


## Une IA s'arrête d'elle-même au-delà de 45 % de dommages, s'il reste au moins trois tours.
func _decidePit(car: Voiture) -> void:
	if car.pitAsk or car.pitState != "" or (car.tyre > 0.999 and car.damage < 0.001): return
	var reste := laps - car.lap
	if reste < 3: return
	var seuil := 0.24 + car.skill * 0.16
	if car.tyre < seuil or car.damage > 0.45: car.pitAsk = true


## Un événement venu du réseau (un tour, un choc, le départ) : il sort au prochain pas.
func ajouteEvenement(e: Dictionary) -> void:
	_evenementsEnAttente.append(e)


func _simulate(gaz: float) -> void:
	var T := track
	if fantome and time >= sillage.n * sillage.pas:
		sillage.joueur.append(player.progress()); sillage.fantome.append(fantome.progress()); sillage.n += 1
	time += dt
	if (netDrive != null or dureeSession > 0) and not is_nan(finishDeadline) and time > finishDeadline: return
	_flagsUpdate()
	var pp := player.progress()
	# le trafic que l'IA regarde : ni le fantôme, ni une épave (elle attendrait derrière pour toujours)
	var trafic := sansFantome
	for k in sansFantome:
		if k.abandon:
			trafic = sansFantome.filter(func(q): return not q.abandon)
			break
	for ic in cars.size():
		var car := cars[ic]
		if netDrive != null and not netDrive.owns(car): continue
		car.aiDriven = car.human < 0 and not car.isPlayer
		car.steer([] if car.fantome else trafic, dt, car.aiDriven)
		if stands and car.aiDriven and not car.finished and not car.abandon: _decidePit(car)
		var thr: float
		if car.isPlayer:
			thr = (1.0 if car.v < 15 else 0.0) if car.finished else gaz
		elif car.human >= 0:
			# la voiture d'une autre personne n'est simulée que chez elle (NetDrive)
			thr = 0.0
		elif car.fantome:
			thr = 1.0 if Course.aiThrottle(car, [], dt, difficultes.get("hard", difficulte)) else 0.0
		else:
			var gapM := car.progress() - pp
			var rubber := 0.0 if car.finished or player.finished else Piste.clamp_(-gapM / 4000, -0.05, 0.03)
			thr = 1.0 if Course.aiThrottle(car, trafic, dt, difficulte, rubber) and not car.finished else 0.0
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
			if mode == "race" and dureeSession <= 0 and car.lap >= laps and not car.finished:
				car.finished = true
				car.finishTime = time
				evenements.append({ type = "finish", car = car })
				if (netDrive == null or netDrive.host) and (humans != null or car.isPlayer) and state == "racing":
					state = "finishing"
					finishTimer = NET_FINISH_GRACE if humans != null else 4.0
					finishDeadline = time + finishTimer
	_flagsUpdate()
	if mode == "race" and not noContact and netDrive != null:
		netDrive.resolveContacts(dt)
	elif mode == "race" and not noContact:
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
		# une épave derrière tous ceux qui roulent encore
		if a.abandon != b.abandon: return not a.abandon
		if a.finished and b.finished: return tempsClasse(a) < tempsClasse(b)
		if a.finished != b.finished: return a.finished
		return b.progress() < a.progress())
	return l


func positionOf(car: Voiture) -> int:
	return standings().find(car) + 1


func _finish() -> void:
	# En solo, l'IA finit ses tours hors de l'écran ; en ligne on garde les tours vraiment bouclés.
	var extra := 0.0
	# le joueur a abandonné : l'arrivée des autres se projette au rythme qu'ils ont tenu, au lieu de
	# simuler parfois des minutes de course d'un bloc
	var parti := player.abandon and humans == null
	while not parti and humans == null and not cars.all(func(k): return k.finished or k.abandon) and extra < 180:
		_simulate(0.0)
		extra += dt
	if parti: _projetteArrivees()
	evenements.clear()
	state = "finished"
	_classe()


## Le classement final (race._finish, après la fin de la course).
func _classe() -> void:
	var ordre := standings()
	if dureeSession > 0:
		ordre.sort_custom(func(a, b): return a.bestLap > 0 and (b.bestLap <= 0 or a.bestLap < b.bestLap))
	results = []
	for i in ordre.size():
		var car := ordre[i]
		results.append({ car = car, pos = i + 1, points = 0 if car.abandon else (POINTS[i] if i < POINTS.size() else 0), abandon = car.abandon,
			temps = tempsClasse(car), brut = car.finishTime if car.finished else -1.0,
			penalite = Course.penalite(car), fautes = car.fautes, meilleur = car.bestLap,
			ecart = tempsClasse(car) - tempsClasse(ordre[0]) if car.finished and ordre[0].finished else -1.0 })


## Le joueur a abandonné : chaque voiture encore en course finit au rythme moyen qu'elle a tenu.
func _projetteArrivees() -> void:
	var total := laps * track.length
	for c in cars:
		if c.finished or c.abandon: continue
		var moyenne := maxf(5, c.progress() / maxf(1, time))
		c.finishTime = time + maxf(0, total - c.progress()) / moyenne
		c.finished = true


## Le classement d'un invité, bâti sur ce qu'il a reçu et non sur une simulation.
func _classeRecu() -> void:
	_classe()


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
	if netDrive != null and not netDrive.host:
		if not spectator: _flagsInspect(player)
		return
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
			if now - offSince[i] >= FLAG_YELLOW_DELAY: zones.append({ id = i, s = c.s, before = 35, after = 15 })
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


## Les drapeaux sur le fil (js/flags.js : packet, key, receive), aux noms du jeu web.
func flagsPacket() -> Dictionary:
	var bleus := []
	for i in cars.size():
		if cars[i].blueFlag: bleus.append(i)
	var pens := []
	for i in penalties:
		if penalties[i] > time: pens.append([i, penalties[i]])
	return { blue = bleus, penalties = pens, zones = zones, chequered = chequered }


func flagsKey() -> String:
	var p := flagsPacket()
	return JSON.stringify([p.blue, p.penalties, p.zones.map(func(z): return z.id), p.chequered])


func flagsReceive(p: Dictionary) -> void:
	if not (p.get("blue") is Array and p.get("zones") is Array and p.get("penalties") is Array): return
	for i in cars.size(): cars[i].blueFlag = (p.blue as Array).has(i) or (p.blue as Array).has(float(i))
	for e in p.penalties:
		if e is Array and e.size() >= 2 and int(e[0]) < cars.size() and (e[1] is float or e[1] is int):
			penalties[int(e[0])] = maxf(float(e[1]), penalties.get(int(e[0]), 0.0))
	zones = []
	for z in p.zones:
		if z is Dictionary and int(z.get("id", -1)) < cars.size() and (z.get("s") is float or z.get("s") is int):
			zones.append({ id = int(z.id), s = float(z.s), before = 35, after = 15 })
	chequered = bool(p.get("chequered", false))


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
	for c in cs:
		if c.reculChoc > 0: c.reculChoc -= 1
	for i in n:
		var a: Voiture = cs[i]
		for j in range(i + 1, n):
			var b: Voiture = cs[j]
			if a.blueFlag or b.blueFlag: continue
			# une épave ne se touche plus ; et pas de contact dans la voie des stands
			if a.abandon or b.abandon: continue
			if a.inPit or b.inPit: continue
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
					# le choc abîme les deux, à proportion de ce qui dépasse le seuil du frottement ;
					# pare-chocs contre pare-chocs quand elles se recouvrent sur plus d'une demi-largeur
					var ur := rear.degats
					var uf := front.degats
					var fort := maxf(0, dv - (float(ur.chocSeuil) if not ur.is_empty() else 0.0))
					var enFace := latOverlap > 0.5 * minf(a.cls.width, b.cls.width)
					var ux := front.x - rear.x
					var uy := front.y - rear.y
					var ul := Piste.hypot(ux, uy)
					if ul == 0.0: ul = 1
					var rx := -cos(rear.th) if enFace else -ux / ul
					var ry := -sin(rear.th) if enFace else -uy / ul
					var fx := cos(front.th) if enFace else ux / ul
					var fy := sin(front.th) if enFace else uy / ul
					var ra := rear.abandon
					var fa := front.abandon
					if not ur.is_empty(): rear._enfonce(rx, ry, fort)
					if not uf.is_empty(): front._enfonce(fx, fy, fort * 0.6)
					# la vie à zéro sur ce choc : l'épave
					rear._marque(rx, ry, dv, 0, "voiture", rear.abandon and not ra)
					front._marque(fx, fy, dv, 0, "voiture", front.abandon and not fa)
					front.v += dv * 0.35
					rear.v = front.v - dv * 0.1
					var push := minf(longOverlap / 2, 0.1)
					rear.x -= tx * push; rear.y -= ty * push
					front.x += tx * push; front.y += ty * push
			else:
				var dir := 1.0 if dl >= 0 else -1.0
				var sep := minf(latOverlap / 2, 0.1)
				# le coup de flanc : il ne casse qu'au-delà de FLANC_SEUIL, et ne compte qu'une fois
				# par contact (reculChoc)
				if a.reculChoc <= 0 and b.reculChoc <= 0:
					var vxa := a.v * cos(a.th) + a.vl * sin(a.th)
					var vya := a.v * sin(a.th) - a.vl * cos(a.th)
					var vxb := b.v * cos(b.th) + b.vl * sin(b.th)
					var vyb := b.v * sin(b.th) - b.vl * cos(b.th)
					var rapproche := ((vxa - vxb) * nx + (vya - vyb) * ny) * dir
					var glisse := absf((vxa - vxb) * tx + (vya - vyb) * ty)
					if rapproche > 1.5 or glisse > 6:
						for cs_ in [[a, -1.0], [b, 1.0]]:
							var c: Voiture = cs_[0]
							var sg: float = cs_[1]
							var u := c.degats
							var fort := maxf(0, rapproche - Voiture.FLANC_SEUIL)
							var ca := c.abandon
							if not u.is_empty(): c._enfonce(nx * dir * sg, ny * dir * sg, fort)
							var vu := maxf(0, rapproche - (Voiture.FLANC_SEUIL - (float(u.chocSeuil) if not u.is_empty() else Voiture.CHOC_SEUIL_USURE)))
							c._marque(nx * dir * sg, ny * dir * sg, vu, glisse, "voiture", c.abandon and not ca)
							c.reculChoc = 30
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
