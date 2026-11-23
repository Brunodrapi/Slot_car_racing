class_name Championnat
extends RefCounted

const POINTS_COURSE := [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
const POINTS_QUALIF := [3, 2, 1]


static func programme(options: Dictionary, circuit: String, tours: int, graine: int) -> Dictionary:
	var calendrier: Array = options.get("circuits", [])
	if calendrier.is_empty(): calendrier = [circuit]
	var manches := []
	for id in calendrier:
		for phase in ["essais", "qualifications", "course"]:
			var duree := clampi(int(options.get(phase, 0)), 0, 60)
			if phase == "course" or duree > 0:
				manches.append({ circuit = id, phase = phase, duree = duree * 60, tours = tours })
	return { manches = manches, index = 0, points = {}, pole = [], positions = options.get("positions", {}).duplicate(), graine = graine }


static func actif(options: Dictionary) -> bool:
	return not options.get("circuits", []).is_empty() or int(options.get("essais", 0)) > 0 \
		or int(options.get("qualifications", 0)) > 0 or not options.get("positions", {}).is_empty()


static func manche(championnat: Dictionary) -> Dictionary:
	return championnat.manches[int(championnat.index)] if not championnat.is_empty() else {}


static func suite(championnat: Dictionary) -> bool:
	return not championnat.is_empty() and int(championnat.index) + 1 < championnat.manches.size()


static func cle(course: Course, i: int) -> String:
	var car := course.cars[i]
	if course.humans == null and car.isPlayer: return "joueur"
	if car.human >= 0: return String(course.humans[car.human].get("pid", car.human))
	return "ia%d" % i


static func grille(course: Course, championnat: Dictionary) -> void:
	var rangs: Array[String] = []
	for i in course.cars.size(): rangs.append(cle(course, i))
	var ordre := rangs.duplicate()
	if course.phase == "course":
		var pole: Array = championnat.get("pole", [])
		ordre.sort_custom(func(a, b):
			var pa := pole.find(a)
			var pb := pole.find(b)
			return pa >= 0 and (pb < 0 or pa < pb))
	var positions: Dictionary = championnat.positions
	var places := []
	places.resize(ordre.size())
	var libres := []
	for k in ordre:
		var cible := int(positions.get(k, 0)) - 1
		if cible >= 0 and cible < places.size() and places[cible] == null: places[cible] = k
		else: libres.append(k)
	var j := 0
	for i in places.size():
		if places[i] != null: continue
		places[i] = libres[j]
		j += 1
	var piste := course.track
	var modele := course.cls
	if course.humans != null:
		var hote: Dictionary = course.humans[0]
		var id := String(hote.get("modelId", ""))
		if not Catalogue.voiture(id).is_empty(): modele = Catalogue.modele(id)
	for i in places.size():
		var car := course.cars[rangs.find(places[i])]
		var lat := (1.0 if i % 2 == 0 else -1.0) * minf(piste.halfWidth * 0.45, modele.width * 0.9)
		car.place(piste.length - 8 - i * modele.length * 2.2, lat, 0.0)
		car.gridLat = lat
		car.laneTarget = lat


static func attribue(championnat: Dictionary, course: Course) -> Dictionary:
	var resultat := championnat.duplicate(true)
	var barème := POINTS_COURSE if course.phase == "course" else POINTS_QUALIF
	if course.phase == "qualifications": resultat.pole = []
	for i in course.results.size():
		var ligne: Dictionary = course.results[i]
		var id := cle(course, course.cars.find(ligne.car))
		var classe: bool = not ligne.car.abandon if course.phase == "course" else ligne.meilleur > 0
		var points: int = barème[i] if classe and i < barème.size() and course.phase != "essais" else 0
		if classe and course.phase == "qualifications": resultat.pole.append(id)
		ligne.points = points
		var total := int(resultat.points.get(id, {}).get("total", 0)) + points
		resultat.points[id] = { nom = ligne.car.nom, total = total }
	return resultat
