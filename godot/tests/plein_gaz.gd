## Plein gaz, toujours : à quelle vitesse la voiture rentre-t-elle dans les protections ? Pour régler
## l'abandon (Voiture.ABANDON_VITESSE) sur les vrais chocs, circuit par circuit.
##   godot --headless --path godot --script res://tests/plein_gaz.gd
extends SceneTree


func _init() -> void:
	Catalogue.charge()
	for cid in ["spa", "monza", "monaco", "suzuka", "silverstone", "bathurst", "interlagos"]:
		if not FileAccess.file_exists("res://donnees/circuits/%s.json" % cid) and not FileAccess.file_exists("res://donnees/circuits/%s.bin" % cid): continue
		var piste := Piste.charge("res://donnees/circuits/" + cid)
		for mid in ["porsche991gt3r", "renaultrs10"]:
			var h := Hasard.new(1)
			var cat: String = Catalogue.voiture(mid).cat
			var course := Course.new(piste, { modele = Catalogue.modele(mid), difficulte = Catalogue.difficulte("medium"), mode = "race", laps = 3, degats = true,
				difficultes = Catalogue.donnees.difficultes, nCars = 1, roster = Catalogue.roster(2, 0, cat, h),
				modeleDe = func(id, i): return Catalogue.modele(id) if id != "" else Catalogue.modele(Catalogue.voituresDe(cat)[i % Catalogue.voituresDe(cat).size()].id) }, h)
			var p := course.player
			var coups := []
			var n0 := p.barrierHits
			for k in 120 * 150:
				var vav := Piste.hypot(p.v, p.vl)
				course.step(1.0)
				if p.barrierHits != n0:
					n0 = p.barrierHits
					coups.append("%d/%d km/h" % [roundi(p.lastImpact * 3.6), roundi(vav * 3.6)])
					if coups.size() >= 6 or p.abandon: break
			print("%-12s %-15s choc normal / vitesse : %s%s  vie %d %%" % [cid, mid, ", ".join(coups), "  ABANDON" if p.abandon else "", roundi(100 * (1 - p.damage))])
	# la vie à zéro, c'est l'abandon : un flanc presque à fond, puis un petit coup de plus
	var piste := Piste.charge("res://donnees/circuits/spa")
	var h := Hasard.new(1)
	var cat: String = Catalogue.voiture("porsche991gt3r").cat
	for natif in [false, true]:
		if natif and not CourseNative.disponible(): continue
		h = Hasard.new(1)
		var classe = CourseNative if natif else Course
		var course: Course = classe.new(piste, { modele = Catalogue.modele("porsche991gt3r"), difficulte = Catalogue.difficulte("medium"), mode = "race", laps = 3, degats = true,
			difficultes = Catalogue.donnees.difficultes, nCars = 1, roster = Catalogue.roster(2, 0, cat, h),
			modeleDe = func(id, i): return Catalogue.modele(id) if id != "" else Catalogue.modele(Catalogue.voituresDe(cat)[i % Catalogue.voituresDe(cat).size()].id) }, h)
		if natif: course.reverse()
		var p := course.player
		var coups := []
		for k in 120 * 150:
			var vav := Piste.hypot(p.v, p.vl)
			var n0 := p.barrierHits
			course.step(1.0)
			if p.barrierHits != n0: coups.append("%d/%d" % [roundi(p.lastImpact * 3.6), roundi(vav * 3.6)])
			if p.abandon: break
		print("%s : plein gaz à Spa, chocs %s, abandon %s au pas %d" % ["C++" if natif else "GDScript", ", ".join(coups), p.abandon, course.time * 120 if "time" in course else -1])
	var c := Voiture.new(piste, Catalogue.modele("porsche991gt3r"), 100, 0)
	c.degats = { chocSeuil = 3.5, vmax = 0.35, abandon = true }
	c.enfoncement[2] = 0.29
	c._enfonce(sin(c.th), -cos(c.th), 3.0)
	print("vie à zéro par un coup de flanc : vie %d %%, abandon %s" % [roundi(100 * (1 - c.damage)), c.abandon])
	quit()
