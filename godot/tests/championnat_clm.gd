## Le championnat de contre-la-montre (la table du téléphone) : ses manches sont des séances de
## qualifications de la durée choisie, sans course, et elles comptent au classement.
##   godot --headless --path godot --script res://tests/championnat_clm.gd
extends SceneTree


func _init() -> void:
	var ok := true
	var o := { circuits = ["spa", "monaco"], minutesParManche = [11, 0], essais = 3, clm = true }
	var p := Championnat.programme(o, "spa", 3, 42, "gt3")
	var phases := (p.manches as Array).map(func(m): return "%s/%s/%d" % [m.circuit, m.phase, m.duree])
	print(phases)
	ok = ok and phases == ["spa/essais/180", "spa/qualifications/660", "monaco/essais/180", "monaco/qualifications/600"]
	ok = ok and p.get("clm", false) and Championnat.compte(p, "qualifications") and not Championnat.compte(p, "essais")
	var c := Championnat.programme({ circuits = ["spa"], qualifications = 5 }, "spa", 3, 1, "gt")
	ok = ok and not c.has("clm") and not Championnat.compte(c, "qualifications") and Championnat.compte(c, "course")
	print("CLM OK" if ok else "ÉCHEC")
	quit(0 if ok else 1)
