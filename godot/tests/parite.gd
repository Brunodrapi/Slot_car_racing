## La physique portée est-elle celle du jeu web ?
##
##   node tools/godot-exporte.js                                   # depuis la racine du dépôt
##   godot --headless --path godot --script res://tests/parite.gd
##
## Trois parcours enregistrés par le jeu web (godot/donnees/ref-*.bin) sont rejoués ici avec les
## mêmes commandes, pas à pas. Deux mesures :
##
## - « pas isolé » : avant chaque pas, la voiture Godot reprend l'état exact du jeu web, fait un pas,
##   et l'on compare. C'est l'erreur du portage lui-même, sans accumulation.
## - « course libre » : la voiture Godot roule seule du début à la fin, sur les seules commandes.
##   L'écart y grandit forcément un peu : Godot et le navigateur n'arrondissent pas le sinus de la
##   même façon à la dernière décimale (voir README).
extends SceneTree

const PARCOURS := ["propre", "brutal", "hasard"]
const POSITION := ["x", "y"]


func _init() -> void:
	var piste := Piste.charge("res://donnees/spa")
	var champs: Array = JSON.parse_string(FileAccess.get_file_as_string("res://donnees/ref-champs.json"))
	var modele := Voiture.Modele.depuis(piste.voiture)
	var echec := false
	print("Circuit ", piste.nom, " : ", piste.n, " points, ", piste.nBarrieres, " protections. Voiture ", modele.nom, ".")
	for nom in PARCOURS:
		var chemin := "res://donnees/ref-%s.bin" % nom
		if not FileAccess.file_exists(chemin):
			print("  ", nom, " : enregistrement absent — lancer d'abord node tools/godot-exporte.js")
			echec = true
			continue
		var a := FileAccess.get_file_as_bytes(chemin).to_float64_array()
		var n := int(a[0])
		var L := int(a[1])
		var entrees := a.slice(2, 2 + n * 2)
		var etats := a.slice(2 + n * 2)
		echec = _isole(piste, modele, champs, n, L, entrees, etats, nom) or echec
		echec = _libre(piste, modele, champs, n, L, entrees, etats, nom) or echec
	print("PARITÉ ", "ÉCHOUÉE" if echec else "OK")
	quit(1 if echec else 0)


func _neuve(piste: Piste, modele: Voiture.Modele) -> Voiture:
	var car := Voiture.new(piste, modele, piste.depart[0], piste.depart[1])
	car.freinRatio = piste.voiture.freinRatio
	car.gripBoost = piste.voiture.gripBoost
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
	var dt := piste.dt
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
		car.steer(dt)
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
	var dt := piste.dt
	var temps := 0.0
	var seuils := [1e-9, 1e-6, 1e-3, 0.1]
	var franchi := [-1, -1, -1, -1]
	var pirePos := 0.0
	var t0 := Time.get_ticks_usec()
	var premierDiscret := -1
	for i in n:
		temps += dt
		car.sel = entrees[i * 2 + 1]
		car.steer(dt)
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
