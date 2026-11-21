## LES CONFIGURATIONS DE FREINAGE (js/career.js : reglagesPour, configActive, freinDe, poseFrein).
##
## Un réglage de frein est un facteur sur le freinage de la voiture du joueur, de 0,5 à 1,6, pour un
## couple circuit + voiture. On le règle en piste (le mode RÉGLER, levier en haut de l'écran) et on
## l'enregistre sous un nom ; le paddock propose ensuite, pour ce couple, « Par défaut » ou l'une des
## configurations enregistrées, et retient le choix. Ce n'est pas une aide : trop de frein coûte la
## vitesse de passage autant que trop peu coûte la sortie de piste, et le tour compte au tableau.
## Rangé comme la sauvegarde du jeu web : { actifs = { "circuit|voiture": nom }, configs = [{ nom, freins = { "circuit|voiture": f } }] }.
class_name ReglageFrein
extends RefCounted

const MIN := 0.5
const MAX := 1.6


static func _r() -> Dictionary:
	if not App.reglages.has("freinages") or not (App.reglages.freinages is Dictionary):
		App.reglages.freinages = { actifs = {}, configs = [] }
	var r: Dictionary = App.reglages.freinages
	if not r.has("actifs"): r.actifs = {}
	if not r.has("configs"): r.configs = []
	return r


static func cle(circuit: String, voiture: String) -> String:
	return circuit + "|" + voiture


## Les configurations qui ont une valeur pour ce couple.
static func pour(circuit: String, voiture: String) -> Array:
	var k := cle(circuit, voiture)
	return (_r().configs as Array).filter(func(c): return c is Dictionary and c.get("freins", {}).has(k))


## La configuration choisie pour ce couple, ou {} (« Par défaut »).
static func active(circuit: String, voiture: String) -> Dictionary:
	var nom := String(_r().actifs.get(cle(circuit, voiture), ""))
	for c in pour(circuit, voiture):
		if String(c.nom) == nom: return c
	return {}


## Le facteur de freinage de ce couple : 1 par défaut.
static func frein(circuit: String, voiture: String) -> float:
	var c := active(circuit, voiture)
	if c.is_empty(): return 1.0
	return clampf(float(c.freins[cle(circuit, voiture)]), MIN, MAX)


static func choisit(circuit: String, voiture: String, nom: String) -> void:
	var trouve := false
	for c in pour(circuit, voiture):
		if String(c.nom) == nom: trouve = true
	_r().actifs[cle(circuit, voiture)] = nom if trouve else ""


## Le choix suivant au paddock : « Par défaut », puis chaque configuration de ce couple.
static func suivante(circuit: String, voiture: String) -> void:
	var noms := [""]
	for c in pour(circuit, voiture): noms.append(String(c.nom))
	var i := noms.find(String(active(circuit, voiture).get("nom", "")))
	choisit(circuit, voiture, noms[(i + 1) % noms.size()])


## Enregistre (ou met à jour) la configuration `nom` pour ce couple, et la choisit.
static func pose(nom: String, circuit: String, voiture: String, valeur: float) -> void:
	var r := _r()
	var c: Dictionary = {}
	for x in r.configs:
		if x is Dictionary and String(x.nom) == nom: c = x
	if c.is_empty():
		c = { nom = nom, freins = {} }
		(r.configs as Array).append(c)
	c.freins[cle(circuit, voiture)] = clampf(valeur, MIN, MAX)
	choisit(circuit, voiture, nom)
