## LE CHAMPIONNAT SEUL, au téléphone : un mode du menu (maquette, essais/maquette-paddock). Son calendrier
## et ses séances sont les options du championnat du jeu (App.reglages.programme : circuits, tours de
## chaque course, minutes d'essais et de qualifications, places imposées) ; lancé, il garde son état
## (Championnat.programme : les séances, l'indice, les points) dans App.reglages.championnatTel, avec la
## catégorie et le nombre d'adversaires du départ, les places de chacun à chaque course (le
## départage) et le classement d'avant la dernière course (les flèches). Il survit à la fermeture du jeu.
class_name ChampTel
extends RefCounted


static func options() -> Dictionary:
	var r := App.reglages
	if not (r.get("programme") is Dictionary): r.programme = {}
	var o: Dictionary = r.programme
	if not (o.get("circuits") is Array): o.circuits = []
	if not (o.get("toursParManche") is Array): o.toursParManche = []
	if not (o.get("positions") is Dictionary): o.positions = {}
	for cle in ["essais", "qualifications"]: o[cle] = int(o.get(cle, 0))
	# les tours de chaque course suivent son circuit dans le calendrier
	while (o.toursParManche as Array).size() < (o.circuits as Array).size(): (o.toursParManche as Array).append(int(r.tours))
	return o


static func etat() -> Dictionary:
	var c = App.reglages.get("championnatTel")
	if not (c is Dictionary):
		c = { actif = false }
		App.reglages.championnatTel = c
	return c


static func enCours() -> bool:
	var c := etat()
	return bool(c.get("actif", false)) and (c.get("etat", {}) as Dictionary).has("manches")


## Lancé : le calendrier devient les séances du jeu ; la catégorie et les adversaires sont ceux de
## maintenant, jusqu'au bout.
static func lance() -> void:
	var r := App.reglages
	var o := options()
	var cat := String(Catalogue.voiture(r.voiture).get("cat", "gt"))
	var c := etat()
	c.actif = true
	c.cat = cat
	c.adversaires = int(r.adversaires)
	c.etat = Championnat.programme(o, String((o.circuits as Array)[0]), int(r.tours), randi() % 100000, cat)
	c.places = {}
	c.avant = {}
	c.fini = 0
	App.sauve()


static func abandonne() -> void:
	var c := etat()
	c.actif = false
	c.etat = {}
	c.fini = 0
	App.sauve()


## Le championnat en cours, tel qu'il part en piste.
static func programme() -> Dictionary:
	return etat().get("etat", {})


static func manche() -> Dictionary:
	return Championnat.manche(programme()) if enCours() else {}


## Le nombre de courses, et celle qui vient (1 pour la première).
static func nombre() -> int:
	return (programme().get("manches", []) as Array).filter(func(m): return m.phase == "course").size()


static func numero() -> int:
	var p := programme()
	var n := 1
	var ms: Array = p.get("manches", [])
	for j in mini(int(p.get("index", 0)), ms.size()):
		if ms[j].phase == "course": n += 1
	return mini(n, maxi(1, nombre()))


## Les courses déjà courues.
static func courues() -> int:
	return numero() - 1 if enCours() else nombre()


## Le classement : les points, puis à égalité le plus de victoires, de deuxièmes places, etc.
static func classement(prog := {}, moiCle := "joueur") -> Array:
	var p: Dictionary = prog if not prog.is_empty() else programme()
	var places: Dictionary = etat().get("places", {}) if moiCle == "joueur" else {}
	var liste := []
	var points: Dictionary = p.get("points", {})
	for cle in points:
		liste.append({ cle = cle, nom = String(points[cle].nom), pts = float(points[cle].total), moi = cle == moiCle })
	liste.sort_custom(func(a, b):
		if a.pts != b.pts: return a.pts > b.pts
		var pa: Array = (places.get(a.cle, []) as Array).duplicate()
		var pb: Array = (places.get(b.cle, []) as Array).duplicate()
		pa.sort(); pb.sort()
		for i in maxi(pa.size(), pb.size()):
			var x := int(pa[i]) if i < pa.size() else 99
			var y := int(pb[i]) if i < pb.size() else 99
			if x != y: return x < y
		return a.moi)
	return liste


static func maPlace() -> int:
	var cl := classement()
	for i in cl.size():
		if cl[i].moi: return i + 1
	return 0


## Après une séance du championnat seul (l'écran des résultats l'appelle une fois) : les points de la
## course sont comptés, l'état passe à la séance suivante et se garde ; à la dernière, le classement final.
## Rend vrai quand c'était une course (le classement est à montrer).
static func apresSeance(course: Course) -> bool:
	if not enCours(): return false
	var c := etat()
	var avantSeance: Dictionary = c.etat
	var res: Dictionary = App.championnatResultats
	if res.is_empty(): return false
	var estCourse := String(Championnat.manche(avantSeance).get("phase", "course")) == "course"
	if estCourse:
		# les places d'avant (les flèches), et la place de chacun à cette course (le départage)
		var avant := {}
		var cl := classement(avantSeance)
		if not (avantSeance.get("points", {}) as Dictionary).is_empty():
			for i in cl.size(): avant[cl[i].cle] = i + 1
		c.avant = avant
		var places: Dictionary = c.get("places", {})
		for i in course.results.size():
			var cle := Championnat.cle(course, course.cars.find(course.results[i].car))
			if not places.has(cle): places[cle] = []
			(places[cle] as Array).append(i + 1)
		c.places = places
	if Championnat.suite(res):
		var suite := res.duplicate(true)
		suite.index = int(suite.index) + 1
		if Championnat.manche(suite).phase == "essais": suite.pole = []
		c.etat = suite
	else:
		c.etat = res
		c.actif = false
		c.fini = 0
		var cl2 := classement(res)
		for i in cl2.size():
			if cl2[i].moi: c.fini = i + 1
	App.sauve()
	return estCourse


## Le championnat vient-il de finir (le podium est à montrer) ?
static func fini() -> bool:
	return not enCours() and int(etat().get("fini", 0)) > 0 and (programme().get("points", {}) as Dictionary).size() > 0


## La séance suivante du même week-end (essais, puis qualifications, puis la course) part tout de suite.
static func seanceSuivante() -> void:
	App.championnatSolo = programme().duplicate(true)
	App.reglages.mode = "race"
	App.reglages.adversaires = int(etat().get("adversaires", App.reglages.adversaires))
	App.demarre()
	App.aller("course")


## Les mêmes comptes pour un championnat quelconque (celui d'une table) : les séances qui comptent au
## classement (la course, ou en contre-la-montre les qualifications), et celle qui vient.
static func nombreDe(p: Dictionary) -> int:
	return (p.get("manches", []) as Array).filter(func(m): return Championnat.compte(p, String(m.phase))).size()


static func numeroDe(p: Dictionary) -> int:
	var n := 1
	var ms: Array = p.get("manches", [])
	for j in mini(int(p.get("index", 0)), ms.size()):
		if Championnat.compte(p, String(ms[j].phase)): n += 1
	return mini(n, maxi(1, nombreDe(p)))
