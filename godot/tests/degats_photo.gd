## Photos des dégâts dans le vrai écran de course : des chocs posés à la main sur les voitures
## (bosses, plis, débris, étincelles, fumée), puis l'abandon du joueur (écran ABANDON).
##   xvfb-run -a godot --path godot tests/degats_photo.tscn -- <dossier>
extends Node

var dossier := "user://"


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size(): dossier = args[0]
	var A = get_node("/root/App")
	A.reglages.mode = "race"; A.reglages.circuit = "spa"; A.reglages.voiture = "porsche991gt3r"
	A.reglages.adversaires = 6; A.reglages.degats = true; A.reglages.tours = 3
	# GRIP_NATIF=0 : la course en GDScript, comme la version web (les zones s'enfoncent ici, à la main)
	if OS.get_environment("GRIP_NATIF") == "0": A.reglages.natif = false
	await get_tree().create_timer(0.5).timeout
	A.aller("course")
	await get_tree().create_timer(2.0).timeout
	print("course lancée")
	var jeu = A.ecran
	var course: Course = jeu.course
	# le départ donné tout de suite, les voitures arrêtées sur la grille
	course.countdown = 0.01
	await get_tree().create_timer(0.3).timeout
	for c in course.cars:
		c.v = 0
	# des chocs de toutes sortes : nez, coins, flancs, arrière
	var dirs := [Vector2(-1, 0), Vector2(-0.7, 0.7), Vector2(0, 1), Vector2(0.7, -0.7), Vector2(1, 0), Vector2(0, -1)]
	for i in course.cars.size():
		var c: Voiture = course.cars[i]
		for k in 3:
			var d: Vector2 = dirs[(i + k) % dirs.size()]
			c.chocs.append({ nx = d.x, ny = d.y, v = 9.0 + 4 * k, frotte = 10.0, sorte = "rail", epave = false })
			# la physique enfonce la zone touchée comme elle le ferait (la tôle suit les points de vie)
			var cs := cos(c.th)
			var sn := sin(c.th)
			c._enfonce(d.x * cs - d.y * sn, d.x * sn + d.y * cs, 9.0 + 4 * k - float(c.degats.get("chocSeuil", 3.5)) + 6 * i)
	print("chocs posés")
	await get_tree().create_timer(0.15).timeout
	get_viewport().get_texture().get_image().save_png(dossier.path_join("degats-1.png"))
	await get_tree().create_timer(1.2).timeout
	get_viewport().get_texture().get_image().save_png(dossier.path_join("degats-2.png"))
	# l'abandon du joueur : l'épave, la caméra, l'écran ABANDON
	var p := course.player
	p.chocs.append({ nx = -1.0, ny = 0.0, v = 30.0, frotte = 0.0, sorte = "rail", epave = true })
	p.abandon = true; p.engineCut = INF; p.engineStopped = true; p.damage = 1
	if course is CourseNative: course.reverse()
	await get_tree().create_timer(2.5).timeout
	get_viewport().get_texture().get_image().save_png(dossier.path_join("abandon.png"))
	print("PHOTOS OK")
	get_tree().quit()
