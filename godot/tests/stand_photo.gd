## Photos d'un arrêt au stand dans le vrai écran de course : la voiture du joueur, abîmée à
## l'avant, posée dans la zone d'arrêt ; l'équipe arrive, scotche, change les roues, se dégage.
##   xvfb-run -a godot --path godot tests/stand_photo.tscn -- <dossier>
extends Node


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	var dossier: String = args[0] if args.size() else "user://"
	var A = get_node("/root/App")
	A.reglages.mode = "race"; A.reglages.circuit = "spa"; A.reglages.voiture = "porsche991gt3r"
	A.reglages.adversaires = 4; A.reglages.degats = true; A.reglages.tours = 3
	await get_tree().create_timer(0.5).timeout
	A.aller("course")
	await get_tree().create_timer(2.0).timeout
	var jeu = A.ecran
	var course: Course = jeu.course
	course.countdown = 0.01
	await get_tree().create_timer(0.2).timeout
	var p := course.player
	var T := course.track
	var s: float = T.wrap_(float(T.pit.boite) - 4)
	p.place(s, float(T.pitAt(s).lat), 0)
	p.lap = 1; p.started = true
	p.damage = 0.55
	for z in 8: p.enfoncement[z] = [0.165, 0.12, 0.02, 0.0, 0.08, 0.0, 0.02, 0.06][z]
	p.pitAsk = true
	jeu.stand = true          # la coche du levier, que l'écran redonne à chaque pas
	if course is CourseNative: course.reverse()
	print("au stand : ", course.stands, " ", T.pitAt(s))
	for i in 4:
		await get_tree().create_timer([0.5, 1.2, 2.2, 2.6][i] if i == 0 else 1.1).timeout
		get_viewport().get_texture().get_image().save_png(dossier.path_join("stand-%d.png" % i))
		print("photo ", i, " état ", p.pitState, " reste ", p.pitT, " dommages ", p.damage)
	print("PHOTOS OK")
	get_tree().quit()
