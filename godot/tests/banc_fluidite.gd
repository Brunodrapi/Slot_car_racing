## Le banc de fluidité de la course, comme tools/bench-mobile.cjs : Spa, de jour, GT3 Porsche, neuf
## adversaires, pilote automatique. Douze secondes de course après six de mise en route : le temps de
## calcul de chaque image (le traitement, la physique, le rendu côté processeur), le nombre de dessins
## envoyés à la carte graphique — sur téléphone, en WebGL, c'est ce nombre d'appels qui pèse.
##   GRIP_NATIF=0 GRIP_DEGATS=1 GRIP_CABOSSE=1 xvfb-run -a godot --path godot --resolution 844x390 tests/banc_fluidite.tscn
## GRIP_NATIF=0 : la physique en GDScript, comme dans le navigateur (sans le moteur C++).
## GRIP_CABOSSE=1 : les dix voitures enfoncées de partout. GRIP_MECANOS=0 : sans les équipes des stands.
## GRIP_TACTILE=1 : le tableau de bord du téléphone. GRIP_SANS=hud,decor,voitures,effets,degats,mecanos :
## les calques cachés, pour compter leurs dessins. GRIP_ATTENTE, GRIP_DUREE : quand et combien de
## secondes on mesure. GRIP_STANDS=1 : la course figée, la caméra sur les stands et leurs équipes
## (GRIP_PLANCHE=0 : les mécaniciens dessinés trait par trait). GRIP_PHOTO=<png> : une photo à la fin.
extends Node


func _ready() -> void:
	get_tree().create_timer(90.0).timeout.connect(func(): print("ÉCHEC : trop long"); get_tree().quit(1))
	var A = get_node("/root/App")
	await get_tree().create_timer(0.6).timeout
	A.reglages.mode = "race"; A.reglages.circuit = "spa"; A.reglages.voiture = "porsche991gt3r"; A.reglages.livree = 0
	A.reglages.adversaires = 10; A.reglages.tours = 3; A.reglages.nuit = false; A.reglages.difficulte = "medium"
	A.reglages.degats = OS.get_environment("GRIP_DEGATS") != "0"
	A.reglages.natif = OS.get_environment("GRIP_NATIF") != "0"
	A.reglages.son = false
	Reseau.autopilote = true
	A.aller("course")
	var jeu = A.ecran
	while is_instance_valid(jeu) and jeu.course == null: await get_tree().process_frame
	await get_tree().create_timer(1.0).timeout
	if OS.get_environment("GRIP_MECANOS") == "0": jeu.mecanos = null
	if OS.get_environment("GRIP_CABOSSE") == "1":
		for c in jeu.course.cars:
			if c.enfoncement:
				for z in c.enfoncement.size(): c.enfoncement[z] = [0.16, 0.1, 0.03, 0.02, 0.08, 0.02, 0.05, 0.06][z % 8]
	# GRIP_SANS=hud,decor,voitures,effets,degats : ce qu'on cache, pour compter ses dessins
	for quoi in OS.get_environment("GRIP_SANS").split(",", false):
		match quoi:
			"hud": jeu.hud.visible = false
			"decor": jeu.decor.visible = false
			"effets": jeu.effets.visible = false
			"degats": jeu.degatsVue.visible = false
			"mecanos":
				jeu.mecanosDessous.visible = false; jeu.mecanosDessus.visible = false
			"voitures":
				for v in jeu.vues:
					v.visible = false
					if v.ombre: v.ombre.visible = false
					if v.ombreMaille: v.ombreMaille.visible = false
	# GRIP_ATTENTE=0 GRIP_DUREE=6 : le départ, sur la grille le long des stands et de leurs équipes
	var attente := float(OS.get_environment("GRIP_ATTENTE")) if OS.get_environment("GRIP_ATTENTE") != "" else 6.0
	var duree := float(OS.get_environment("GRIP_DUREE")) if OS.get_environment("GRIP_DUREE") != "" else 12.0
	if attente > 0: await get_tree().create_timer(attente).timeout
	# GRIP_STANDS=1 : la course figée, la caméra (au zoom de la course) posée sur la boîte des stands
	if OS.get_environment("GRIP_STANDS") == "1":
		var T: Piste = jeu.course.track
		var cam: Camera2D = jeu.camera
		var zoom := cam.zoom
		jeu.process_mode = Node.PROCESS_MODE_DISABLED
		var z := T.pitAt(float(T.pit.boite))
		cam.offset = Vector2.ZERO
		cam.position = T.pos(float(T.pit.boite), (float(z.lat) + float(z.externe)) / 2)
		cam.rotation = T.headingAt(float(T.pit.boite))
		cam.zoom = zoom
		print("  caméra sur les stands, zoom ", zoom)
	A.chronos = { actif = true }
	var vrid := get_viewport().get_viewport_rid()
	RenderingServer.viewport_set_measure_render_time(vrid, true)
	var rendu := 0.0
	var images := []
	var traitement := 0.0
	var physique := 0.0
	var dessins := 0.0
	var t0 := Time.get_ticks_usec()
	var avant := t0
	while Time.get_ticks_usec() - t0 < duree * 1_000_000:
		await get_tree().process_frame
		var t := Time.get_ticks_usec()
		images.append((t - avant) / 1000.0)
		avant = t
		traitement += Performance.get_monitor(Performance.TIME_PROCESS) * 1000
		physique += Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS) * 1000
		dessins += Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)
		rendu += RenderingServer.viewport_get_measured_render_time_cpu(vrid) + RenderingServer.get_frame_setup_time_cpu()
	var n := images.size()
	var tri := images.duplicate()
	tri.sort()
	var classe: String = jeu.course.get_script().get_global_name()
	if OS.get_environment("GRIP_SANS") != "": print("  sans : ", OS.get_environment("GRIP_SANS"))
	print("BANC natif=%s dégâts=%s cabosse=%s mécanos=%s (%s) : %.1f images/s, P95 %.0f ms ; traitement %.2f ms, physique %.2f ms (un pas), %.0f dessins par image" % [
		A.reglages.natif, A.reglages.degats, OS.get_environment("GRIP_CABOSSE") == "1", jeu.mecanos != null, classe,
		n / duree, tri[int(n * 0.95)], traitement / n, physique / n, dessins / n])
	print("  rendu (processeur) %.2f ms par image" % (rendu / n))
	var ch: Dictionary = A.chronos
	print("  par image : physique %.2f ms (%.1f pas), dégâts %.2f ms, mécaniciens %.2f ms, effets %.2f ms, son %.2f ms" % [
		ch.get("physique", 0) / 1000.0 / n, float(ch.get("pas", 0)) / n, ch.get("degats", 0) / 1000.0 / n, ch.get("mecanos", 0) / 1000.0 / n,
		ch.get("effets", 0) / 1000.0 / n, ch.get("son", 0) / 1000.0 / n])
	A.chronos = {}
	# GRIP_PHOTO=<fichier.png> : la course figée, une photo de ce qu'on voit
	if OS.get_environment("GRIP_PHOTO") != "":
		jeu.process_mode = Node.PROCESS_MODE_DISABLED
		jeu.hud.queue_redraw()
		for k in 3: await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png(OS.get_environment("GRIP_PHOTO"))
	get_tree().quit()
