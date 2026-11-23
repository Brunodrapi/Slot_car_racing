## Le catalogue du jeu web (godot/donnees/catalogue.json et .bin) : catégories, voitures et leurs
## nombres, livrées, pilotes de l'IA, difficultés, circuits.
class_name Catalogue
extends RefCounted

static var donnees: Dictionary
static var _modeles := {}       # id -> Voiture.Modele
static var _dessins: Dictionary


static func charge() -> void:
	if not donnees.is_empty(): return
	donnees = JSON.parse_string(FileAccess.get_file_as_string("res://donnees/catalogue.json"))
	var nombres := FileAccess.get_file_as_bytes("res://donnees/catalogue.bin").to_float64_array()
	var champs: Array = donnees.champsNombres
	var voitures: Array = donnees.voitures
	for i in voitures.size():
		var v: Dictionary = voitures[i]
		var d := { id = v.id, nom = v.nom, cat = v.cat }
		for j in champs.size():
			d[champs[j]] = nombres[i * champs.size() + j]
		_modeles[v.id] = Voiture.Modele.depuis(d)
	_dessins = JSON.parse_string(FileAccess.get_file_as_string("res://donnees/dessins.json"))


static func modele(id: String) -> Voiture.Modele:
	charge()
	return _modeles.get(id)


static func voiture(id: String) -> Dictionary:
	charge()
	for v in donnees.voitures:
		if v.id == id: return v
	return {}


static func voituresDe(cat: String) -> Array:
	charge()
	return donnees.voitures.filter(func(v): return v.cat == cat)


static func categories() -> Array:
	charge()
	return donnees.categories


static func circuits() -> Array:
	charge()
	return donnees.circuits


static func difficulte(id: String) -> Dictionary:
	charge()
	return donnees.difficultes.get(id, donnees.difficultes.medium)


## Le dessin d'une livrée (livreeDe : l'indice tourne sur la liste).
static func dessin(id: String, livree: int) -> Dictionary:
	charge()
	var v := voiture(id)
	var n: int = maxi(1, (v.livrees as Array).size()) if not v.is_empty() else 1
	var li := ((livree % n) + n) % n
	var d: Dictionary = _dessins.dessins.get("%s/%d" % [id, li], {})
	d = d.duplicate()
	d.id = id; d.livree = li
	d.ombre_ = _dessins.ombre; d.ombreAlpha = _dessins.ombreAlpha; d.feuStop = _dessins.get("feuStop", {})
	return d


## makeRoster (js/race.js) : les pilotes de l'IA, tirés au sort.
static func roster(count: int, liveryJoueur: int, cat: String, h: Hasard) -> Array:
	charge()
	var noms: Array = donnees.pilotes.duplicate()
	var livs: Array = []
	for i in (donnees.livreries as Array).size():
		if i != liveryJoueur: livs.append(i)
	for i in range(noms.size() - 1, 0, -1):
		var j := int(floor(h.random() * (i + 1)))
		var t = noms[i]; noms[i] = noms[j]; noms[j] = t
	for i in range(livs.size() - 1, 0, -1):
		var j := int(floor(h.random() * (i + 1)))
		var t = livs[i]; livs[i] = livs[j]; livs[j] = t
	var modeles := voituresDe(cat)
	var out := []
	for i in count:
		var skill := (float(i) / maxi(1, count - 1)) * 0.8 + h.random() * 0.2
		var m: String = modeles[int(floor(h.random() * modeles.size()))].id if modeles.size() else ""
		var lv := int(floor(h.random() * 64))
		out.append({ nom = noms[i % noms.size()], livery = livs[i % livs.size()], skill = skill, modele = m, livree = lv })
	return out
