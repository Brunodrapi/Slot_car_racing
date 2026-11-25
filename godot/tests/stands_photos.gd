## Les stands de chaque circuit, photographiés dans le vrai écran de course pour les vérifier : une vue
## de toute la voie (de l'entrée à la sortie, la piste à l'horizontale, dans le sens de la course), puis
## une vue rapprochée de la zone d'arrêt et des garages. La course est figée sur sa grille, sans tableau
## de bord.
##   xvfb-run -a -s "-screen 0 1700x1000x24" godot --path godot --resolution 1600x900 tests/stands_photos.tscn -- <dossier> [circuit]
extends Node


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	var dossier: String = args[0] if args.size() else "user://"
	var seul: String = args[1] if args.size() > 1 else ""
	var A = get_node("/root/App")
	A.reglages.mode = "race"; A.reglages.voiture = "porsche991gt3r"; A.reglages.livree = 0
	A.reglages.adversaires = 2; A.reglages.degats = true; A.reglages.tours = 3; A.reglages.nuit = false
	var infos := {}
	await get_tree().create_timer(0.6).timeout          # l'écran titre du lancement passe d'abord
	for c in Catalogue.circuits():
		if seul != "" and c.id != seul: continue
		A.reglages.circuit = c.id
		A.aller("course")
		var jeu = A.ecran
		var t0 := Time.get_ticks_msec()
		while is_instance_valid(jeu) and (jeu.course == null or jeu.camera == null) and Time.get_ticks_msec() - t0 < 30000:
			await get_tree().process_frame
		await get_tree().create_timer(0.6).timeout
		var T: Piste = jeu.course.track
		if T.pit.is_empty():
			print(c.id, " : pas de voie des stands")
			infos[c.id] = { nom = c.nom, stands = false }
			continue
		# la course figée : la caméra reste où on la pose
		jeu.process_mode = Node.PROCESS_MODE_DISABLED
		jeu.hud.visible = false
		var p: Dictionary = T.pit
		var boite: float = p.boite
		var z := T.pitAt(boite)
		var cam: Camera2D = jeu.camera
		cam.offset = Vector2.ZERO
		var W := float(get_viewport().get_visible_rect().size.x)
		# 1. toute la voie : centrée sur son milieu, l'entrée à gauche, la sortie à droite
		var milieu: float = T.wrap_(float(p.entree) + float(p.long) / 2)
		var zm := T.pitAt(milieu)
		cam.position = T.pos(milieu, float(zm.lat) if not zm.is_empty() else 0.0)
		cam.rotation = T.headingAt(milieu)
		cam.zoom = Vector2.ONE * W / (float(p.long) * 1.18)
		await _attends()
		get_viewport().get_texture().get_image().save_png(dossier.path_join("%s-voie.png" % c.id))
		# 2. la zone d'arrêt et les garages, de près
		cam.position = T.pos(boite, (float(z.lat) + float(z.externe)) / 2 if not z.is_empty() else 0.0)
		cam.rotation = T.headingAt(boite)
		cam.zoom = Vector2.ONE * W / 95.0
		await _attends()
		get_viewport().get_texture().get_image().save_png(dossier.path_join("%s-garages.png" % c.id))
		# pour le plan : la ligne médiane tous les 8 m, la voie tous les 2 m, la zone d'arrêt
		var trace := []
		var s := 0.0
		while s < T.length:
			var q := T.pos(s, 0)
			trace.append([q.x, q.y])
			s += 8.0
		var voie := []
		s = 0.0
		while s <= float(p.long):
			var sv: float = T.wrap_(float(p.entree) + s)
			var zv := T.pitAt(sv)
			if not zv.is_empty():
				var q := T.pos(sv, float(zv.lat))
				voie.append([q.x, q.y])
			s += 2.0
		var q0 := T.pos(0, 0)
		var qb := T.pos(boite, float(z.lat))
		infos[c.id] = { nom = c.nom, stands = true, longueur = T.length, entree = p.entree, boite = boite, sortie = p.sortie,
			long = p.long, zone = p.zone, garages = T.pitGarages().size(), trace = trace, voie = voie,
			depart = [q0.x, q0.y], arret = [qb.x, qb.y], cap = T.headingAt(0) }
		print(c.id, " : voie de %d m, arrêt à %.0f m (%.3f du tour)" % [roundi(float(p.long)), boite, boite / T.length])
	var f := FileAccess.open(dossier.path_join("stands.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(infos, " "))
	f.close()
	print("PHOTOS OK")
	get_tree().quit()


func _attends() -> void:
	for i in 4: await get_tree().process_frame
