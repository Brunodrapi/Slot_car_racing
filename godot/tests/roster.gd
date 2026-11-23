## La grille de l'IA d'une course en ligne : Godot doit tirer la même que le jeu web, pour la même
## graine (makeRoster, js/race.js). La référence, tests/roster-ref.json, vient du jeu web.
##
##   godot --headless --path godot --script res://tests/roster.gd
extends SceneTree


func _init() -> void:
	var ref: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://tests/roster-ref.json"))
	var ko := 0
	for cle in ref:
		var p := String(cle).split("/")
		var r := Catalogue.roster(int(p[0]), 0, p[2], HasardGraine.new(int(p[1])))
		for i in r.size():
			var w: Array = ref[cle][i]
			var g: Dictionary = r[i]
			if g.nom != w[0] or int(g.livery) != int(w[1]) or g.modele != w[2] or int(g.livree) != int(w[3]) or absf(float(g.skill) - float(w[4])) > 1e-12:
				ko += 1
				print("ÉCART ", cle, " ", i, " godot ", [g.nom, g.livery, g.modele, g.livree, g.skill], " web ", w)
		print(cle, " : ", r.size(), " pilotes, ", r.map(func(x): return x.nom).slice(0, 4), "…")
	print("GRILLE ", "OK" if ko == 0 else "ÉCHEC (%d écarts)" % ko)
	quit(0 if ko == 0 else 1)
