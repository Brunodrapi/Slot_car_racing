## La physique portée est-elle celle du jeu web ?
##
##   node tools/godot-exporte.js spa                               # depuis la racine du dépôt
##   godot --headless --path godot --script res://tests/parite.gd
##
## Trois parcours enregistrés par le jeu web (godot/donnees/ref/seule-*.bin) sont rejoués ici avec
## les mêmes commandes, pas à pas. Deux mesures :
##
## - « pas isolé » : avant chaque pas, la voiture Godot reprend l'état exact du jeu web, fait un pas,
##   et l'on compare. C'est l'erreur du portage lui-même, sans accumulation.
## - « course libre » : la voiture Godot roule seule du début à la fin, sur les seules commandes.
##   L'écart y grandit forcément un peu : Godot et le navigateur n'arrondissent pas le sinus de la
##   même façon à la dernière décimale (voir README).
##
## Puis une course entière (ref/course.bin) : dix voitures, l'IA en difficulté normale, deux tours,
## contacts et drapeaux, avec le même hasard que le jeu web. On compare chaque voiture à chaque pas,
## et le classement final.
extends SceneTree

const PARCOURS := ["propre", "brutal", "hasard"]
const POSITION := ["x", "y"]


func _init() -> void:
	var piste := Piste.charge("res://donnees/circuits/spa")
	var champs: Array = JSON.parse_string(FileAccess.get_file_as_string("res://donnees/ref/champs.json"))
	var modele := Catalogue.modele("porsche991gt3r")
	var echec := false
	print("Circuit ", piste.nom, " : ", piste.n, " points, ", piste.nBarrieres, " protections. Voiture ", modele.nom, ".")
	for nom in PARCOURS:
		var chemin := "res://donnees/ref/seule-%s.bin" % nom
		if not FileAccess.file_exists(chemin):
			print("  ", nom, " : enregistrement absent — lancer d'abord node tools/godot-exporte.js")
			echec = true
			continue
		var a := FileAccess.get_file_as_bytes(chemin).to_float64_array()
		var n := int(a[0])
		var L := int(a[1])
		depart = PackedFloat64Array([a[2], a[3]])
		var entrees := a.slice(4, 4 + n * 2)
		var etats := a.slice(4 + n * 2)
		echec = _isole(piste, modele, champs, n, L, entrees, etats, nom) or echec
		echec = _libre(piste, modele, champs, n, L, entrees, etats, nom) or echec
		if CourseNative.disponible():
			echec = _natifSeul(piste, modele, champs, n, L, entrees, etats, nom) or echec
	echec = _course(piste, false) or echec
	if CourseNative.disponible():
		echec = _course(piste, true) or echec
	else:
		print("  (moteur C++ absent : seule la version GDScript est vérifiée)")
	print("PARITÉ ", "ÉCHOUÉE" if echec else "OK")
	quit(1 if echec else 0)


var depart: PackedFloat64Array


func _neuve(piste: Piste, modele: Voiture.Modele) -> Voiture:
	var car := Voiture.new(piste, modele, depart[0], depart[1])
	car.isPlayer = true
	return car


func _pose(car: Voiture, champs: Array, etats: PackedFloat64Array, o: int) -> void:
	for j in champs.size():
		var cle: String = champs[j]
		var val := etats[o + j]
		match cle:
			"herbe": car.herbe = val != 0
			"engineStopped", "checkpoint", "started": car.set(cle, val != 0)
			"lap", "crashes", "barrierHits", "rejoined": car.set(cle, int(val))
			_: car.set(cle, val)


func _ecart(car: Voiture, champs: Array, etats: PackedFloat64Array, o: int) -> Dictionary:
	var pire := 0.0
	var pireCle := ""
	var discret := ""
	for j in champs.size():
		var cle: String = champs[j]
		var ref := etats[o + j]
		var val: float
		match cle:
			"herbe": val = 1.0 if car.herbe else 0.0
			"engineStopped", "checkpoint", "started": val = 1.0 if car.get(cle) else 0.0
			_: val = float(car.get(cle))
		if cle in ["herbe", "lap", "crashes", "barrierHits", "engineStopped", "checkpoint", "started", "rejoined"]:
			if val != ref and discret == "": discret = cle
			continue
		var e := absf(val - ref)
		if cle == "th": e = absf(Voiture.wrapAngle(val - ref))
		if cle == "s": e = absf(car.track.diff(ref, val))
		if e > pire:
			pire = e; pireCle = cle
	return { pire = pire, cle = pireCle, discret = discret }


## Chaque pas, repris de l'état exact du jeu web.
func _isole(piste: Piste, modele: Voiture.Modele, champs: Array, n: int, L: int, entrees: PackedFloat64Array, etats: PackedFloat64Array, nom: String) -> bool:
	var car := _neuve(piste, modele)
	var dt := 1.0 / 120
	var temps := 0.0
	var pire := 0.0
	var pireCle := ""
	var pireI := 0
	var sauts := 0
	var ulp := 0
	for i in n:
		if i > 0:
			_pose(car, champs, etats, (i - 1) * L)
		temps += dt
		car.sel = entrees[i * 2 + 1]
		car.steer([car], dt, false)
		car.update(dt, entrees[i * 2], temps)
		var e := _ecart(car, champs, etats, i * L)
		if e.discret != "": sauts += 1
		if e.pire > 1e-12: ulp += 1
		if e.pire > pire:
			pire = e.pire; pireCle = e.cle; pireI = i
	var ok := pire < 1e-6 and sauts == 0
	print("  %-7s pas isolé    %6d pas : pire écart %s (%s, pas %d), %d pas au-delà de 1e-12, %d décisions différentes  %s" % [nom, n, _sci(pire), pireCle, pireI, ulp, sauts, "ok" if ok else "ÉCHEC"])
	return not ok


## La course entière, sur les seules commandes.
func _libre(piste: Piste, modele: Voiture.Modele, champs: Array, n: int, L: int, entrees: PackedFloat64Array, etats: PackedFloat64Array, nom: String) -> bool:
	var car := _neuve(piste, modele)
	var dt := 1.0 / 120
	var temps := 0.0
	var seuils := [1e-9, 1e-6, 1e-3, 0.1]
	var franchi := [-1, -1, -1, -1]
	var pirePos := 0.0
	var t0 := Time.get_ticks_usec()
	var premierDiscret := -1
	for i in n:
		temps += dt
		car.sel = entrees[i * 2 + 1]
		car.steer([car], dt, false)
		car.update(dt, entrees[i * 2], temps)
		var o := i * L
		var dp := Piste.hypot(car.x - etats[o], car.y - etats[o + 1])
		pirePos = maxf(pirePos, dp)
		for q in seuils.size():
			if franchi[q] < 0 and dp > seuils[q]: franchi[q] = i
		if premierDiscret < 0 and _ecart(car, champs, etats, o).discret != "": premierDiscret = i
	var us := Time.get_ticks_usec() - t0
	var f := (n - 1) * L
	var fin := Piste.hypot(car.x - etats[f], car.y - etats[f + 1])
	var txt := []
	for q in seuils.size():
		txt.append("%s m %s" % [_sci(seuils[q]), ("jamais" if franchi[q] < 0 else "à %.2f s" % (franchi[q] * dt))])
	print("  %-7s course libre %6d pas : écart final %s m, pire %s m ; dépasse %s ; première décision différente %s ; tours %d/%d, sorties %d/%d, chocs %d/%d ; %.1f µs par pas" % [
		nom, n, _sci(fin), _sci(pirePos), ", ".join(txt), ("aucune" if premierDiscret < 0 else "à %.2f s" % (premierDiscret * dt)),
		car.lap, int(etats[f + champs.find("lap")]), car.crashes, int(etats[f + champs.find("crashes")]),
		car.barrierHits, int(etats[f + champs.find("barrierHits")]), float(us) / n])
	return false


## Godot ne connaît ni %e ni %g.
static func _sci(x: float) -> String:
	if x == 0.0:
		return "0"
	var e := int(floorf(log(absf(x)) / log(10.0)))
	if e >= -2 and e <= 3:
		return "%.3f" % x
	return "%.2fe%d" % [x / pow(10.0, e), e]



## Une course entière, IA comprise, avec le hasard du jeu web.
func _course(piste: Piste, natif: bool) -> bool:
	if not FileAccess.file_exists("res://donnees/ref/course.bin"):
		print("  course : enregistrement absent")
		return true
	var meta: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://donnees/ref/course.json"))
	var a := FileAccess.get_file_as_bytes("res://donnees/ref/course.bin").to_float64_array()
	var n := int(a[0])
	var N := int(a[1])
	var K := int(a[2])
	var entrees := a.slice(3, 3 + n * 2)
	var suivi := a.slice(3 + n * 2)
	var ref: Array = meta.roster
	var h := Hasard.new(1)
	var classe = CourseNative if natif else Course
	var course: Course = classe.new(piste, {
		modele = Catalogue.modele("porsche991gt3r"), difficulte = Catalogue.difficulte("medium"), mode = "race", laps = 2,
		nCars = N, roster = ref.map(func(r): return { nom = r.nom, modele = r.modele, livery = r.livery, livree = r.livree, skill = r.skill }),
		modeleDe = func(id, _i): return Catalogue.modele(id) }, h)
	for i in N:
		course.cars[i].aiTimer = ref[i].aiTimer
	h.etat = int(meta.graineApres)
	if natif: course.reverse()
	var t0 := Time.get_ticks_usec()
	var pire := 0.0
	var pireVoiture := -1
	var premier := -1
	var premierTour := -1
	for k in n:
		course.player.sel = entrees[k * 2 + 1]
		course.step(entrees[k * 2])
		for i in N:
			var c: Voiture = course.cars[i]
			var o := (k * N + i) * K
			var e := Piste.hypot(c.x - suivi[o], c.y - suivi[o + 1])
			if e > pire: pire = e; pireVoiture = i
			if premier < 0 and e > 1e-6: premier = k
			if premierTour < 0 and c.lap + (1000 if c.finished else 0) != int(suivi[o + 5]): premierTour = k
	var us := Time.get_ticks_usec() - t0
	var ok := course.state == "finished" and premierTour < 0 and pire < 1e-2
	var res: Array = meta.resultats
	var memeOrdre := course.results.size() == res.size()
	var pireTemps := 0.0
	for i in mini(course.results.size(), res.size()):
		var r: Dictionary = course.results[i]
		if r.car.numero != int(res[i].numero): memeOrdre = false
		if res[i].temps != null: pireTemps = maxf(pireTemps, absf(r.temps - float(res[i].temps)))
	ok = ok and memeOrdre and pireTemps < 1e-6 and h.etat == int(meta.hasardFin)
	print("  course %s %d voitures, %d pas : pire écart de position %s m (voiture %d), dépasse 1e-6 m %s ; tours et arrivées identiques %s ; classement identique %s, pire écart de temps %s s ; hasard au même point %s ; %.0f µs par pas  %s" % [
		"C++ " if natif else "GDS ", N, n, _sci(pire), pireVoiture, ("jamais" if premier < 0 else "à %.2f s" % (premier / 120.0)), ("oui" if premierTour < 0 else "non (pas %d)" % premierTour),
		("oui" if memeOrdre else "NON"), _sci(pireTemps), ("oui" if h.etat == int(meta.hasardFin) else "non"), float(us) / n, "ok" if ok else "ÉCHEC"])
	if course.results.size():
		var g: Dictionary = course.results[0]
		print("          vainqueur n° %d %s en %.3f s (web : n° %d en %.3f s)" % [g.car.numero, g.car.nom, g.temps, int(res[0].numero), float(res[0].temps)])
	return not ok



## Le moteur C++ seul en piste : le pas isolé, puis la course libre, sur les mêmes commandes.
func _natifSeul(piste: Piste, modele: Voiture.Modele, champs: Array, n: int, L: int, entrees: PackedFloat64Array, etats: PackedFloat64Array, nom: String) -> bool:
	var m: Object = ClassDB.instantiate("MoteurNatif")
	var noms: PackedStringArray = m.champs()
	var K := noms.size()
	m.piste(piste.pourNatif())
	var car := _neuve(piste, modele)
	m.ajoute(CourseNative.modeleNatif(modele), CourseNative.etatNatif(car, noms))
	m.regle({ modeCourse = false, laps = 3, entrainement = false, player = 0, fantome = -1, difficulte = {}, difficile = {},
		profil = PackedFloat64Array(), hasard = 1, countdown = 0.0, time = 0.0, state = 1 })
	m.prepare()
	var iRef := {}
	for j in champs.size(): iRef[champs[j]] = j
	var iNat := {}
	for j in noms.size(): iNat[noms[j]] = j
	var dt := 1.0 / 120
	# 1. Pas isolé : chaque pas repris de l'état exact du jeu web.
	var pire := 0.0
	var temps := 0.0
	for i in n:
		if i > 0:
			var e := {}
			for cle in champs: e[cle] = etats[(i - 1) * L + iRef[cle]]
			m.pose(0, e)
		temps += dt
		m.pas_seul(entrees[i * 2], entrees[i * 2 + 1], temps)
		var a: PackedFloat64Array = m.etats()
		for cle in ["x", "y", "v", "vl", "w", "delta", "Ff", "Fr", "selS"]:
			pire = maxf(pire, absf(a[iNat[cle]] - etats[i * L + iRef[cle]]))
	# 2. Course libre.
	var m2: Object = ClassDB.instantiate("MoteurNatif")
	m2.piste(piste.pourNatif())
	m2.ajoute(CourseNative.modeleNatif(modele), CourseNative.etatNatif(_neuve(piste, modele), noms))
	m2.regle({ modeCourse = false, laps = 3, entrainement = false, player = 0, fantome = -1, difficulte = {}, difficile = {},
		profil = PackedFloat64Array(), hasard = 1, countdown = 0.0, time = 0.0, state = 1 })
	m2.prepare()
	temps = 0.0
	var pirePos := 0.0
	var t0 := Time.get_ticks_usec()
	for i in n:
		temps += dt
		m2.pas_seul(entrees[i * 2], entrees[i * 2 + 1], temps)
	var us := Time.get_ticks_usec() - t0
	var a2: PackedFloat64Array = m2.etats()
	var f := (n - 1) * L
	pirePos = Piste.hypot(a2[iNat.x] - etats[f + iRef.x], a2[iNat.y] - etats[f + iRef.y])
	var memes: bool = int(a2[iNat.crashes]) == int(etats[f + iRef.crashes]) and int(a2[iNat.barrierHits]) == int(etats[f + iRef.barrierHits]) and int(a2[iNat.lap]) == int(etats[f + iRef.lap])
	var ok := pire < 1e-6 and memes and pirePos < 1e-3
	print("  %-7s C++         %6d pas : pire écart sur un pas %s, écart final de position %s m, sorties et chocs identiques %s ; %.1f µs par pas  %s" % [
		nom, n, _sci(pire), _sci(pirePos), "oui" if memes else "NON", float(us) / n, "ok" if ok else "ÉCHEC"])
	return not ok
