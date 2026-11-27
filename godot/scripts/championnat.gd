class_name Championnat
extends RefCounted

const POINTS_F1 := [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
const POINTS_GT := [16.5, 12, 9.5, 7.5, 6, 4.5, 3, 2, 1, 0.5]
const POINTS_LE_MANS := [50, 36, 30, 24, 20, 16, 12, 8, 4, 2]


static func categorieTable(table: Dictionary, voitureHote: String) -> String:
	var cat := String(table.get("cat", "all"))
	if cat != "all" and not cat.is_empty(): return cat
	return String(Catalogue.voiture(voitureHote).get("cat", "gt"))


static func cleBareme(cat: String) -> String:
	if cat == "f1": return "f1"
	if cat == "proto": return "lemans"
	return "gt"


static func formatPoints(points: float) -> String:
	if points == floorf(points): return str(int(points))
	var affichage := "%.1f" % points
	return affichage.replace(".", ",") if Textes.langue() == "fr" else affichage


static func toursManche(options: Dictionary, index: int, defaut: int) -> int:
	var tours: Array = options.get("toursParManche", [])
	var valeur := int(tours[index]) if index < tours.size() else 0
	return clampi(valeur if valeur > 0 else defaut, 1, 99)


static func programme(options: Dictionary, circuit: String, tours: int, graine: int, cat: String) -> Dictionary:
	var calendrier: Array = options.get("circuits", [])
	if calendrier.is_empty(): calendrier = [circuit]
	var manches := []
	# Le championnat de contre-la-montre (la table du téléphone, « clm ») : chaque manche est une séance
	# de qualifications de quelques minutes, sans course ; le meilleur tour de chacun fait le classement.
	var clm := bool(options.get("clm", false))
	for index in calendrier.size():
		for phase in ["essais", "qualifications", "course"]:
			var duree := clampi(int(options.get(phase, 0)), 0, 60)
			if clm and phase == "qualifications": duree = minutesManche(options, index)
			if clm and phase == "course": continue
			if phase == "course" or duree > 0:
				manches.append({ circuit = calendrier[index], phase = phase, duree = duree * 60, tours = toursManche(options, index, tours) })
	var p := { manches = manches, index = 0, points = {}, pole = [], positions = options.get("positions", {}).duplicate(), graine = graine, bareme = cleBareme(cat) }
	if clm: p.clm = true
	return p


static func minutesManche(options: Dictionary, index: int) -> int:
	var m: Array = options.get("minutesParManche", [])
	var v := int(m[index]) if index < m.size() else 0
	return clampi(v if v > 0 else 10, 1, 60)


## La séance qui compte au classement : la course, ou en contre-la-montre la séance de qualifications.
static func compte(championnat: Dictionary, phase: String) -> bool:
	return phase == "course" or (bool(championnat.get("clm", false)) and phase == "qualifications")


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
	var bareme := String(championnat.get("bareme", "gt"))
	var pointsCourse: Array = {"f1": POINTS_F1, "gt": POINTS_GT, "lemans": POINTS_LE_MANS}.get(bareme, POINTS_GT)
	if course.phase == "qualifications": resultat.pole = []
	var clm := bool(championnat.get("clm", false))
	for i in course.results.size():
		var ligne: Dictionary = course.results[i]
		var id := cle(course, course.cars.find(ligne.car))
		var classe: bool = not ligne.car.abandon if course.phase == "course" else ligne.meilleur > 0
		var points := 0.0
		if classe and course.phase == "course" and i < pointsCourse.size(): points = float(pointsCourse[i])
		elif classe and clm and course.phase == "qualifications" and i < pointsCourse.size(): points = float(pointsCourse[i])
		elif classe and course.phase == "qualifications" and i == 0 and bareme != "f1": points = 1.0
		if classe and course.phase == "qualifications": resultat.pole.append(id)
		ligne.points = points
		var total := float(resultat.points.get(id, {}).get("total", 0)) + points
		resultat.points[id] = { nom = ligne.car.nom, total = total }
	return resultat
