## Les mécaniciens de près, les sept poses côte à côte devant leur garage (Spa) : pour comparer la
## planche (Mecanos.preparePlanche) au dessin trait par trait (GRIP_PLANCHE=0). GRIP_NUIT=1 : de nuit.
##   xvfb-run -a godot --path godot --resolution 844x390 tests/mecanos_photo.tscn -- <dossier> <zoom>
extends Node


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	var dossier: String = args[0] if args.size() else "user://"
	var zoom := float(args[1]) if args.size() > 1 else 26.67
	var A = get_node("/root/App")
	await get_tree().create_timer(0.6).timeout
	A.reglages.mode = "race"; A.reglages.circuit = "spa"; A.reglages.voiture = "porsche991gt3r"; A.reglages.livree = 0
	A.reglages.adversaires = 2; A.reglages.degats = true; A.reglages.tours = 3; A.reglages.nuit = OS.get_environment("GRIP_NUIT") == "1"
	A.aller("course")
	var jeu = A.ecran
	while is_instance_valid(jeu) and (jeu.course == null or jeu.camera == null): await get_tree().process_frame
	await get_tree().create_timer(0.8).timeout
	jeu.process_mode = Node.PROCESS_MODE_DISABLED
	jeu.hud.visible = false
	var m: Mecanos = jeu.mecanos
	var b: Dictionary = m.boxes[0]
	for i in b.equipe.size():
		var e: Dictionary = b.equipe[i]
		e.pose = i % Mecanos.POSES
	# la septième pose sur le premier du box suivant
	m.boxes[1].equipe[0].pose = Mecanos.SCOTCH
	jeu.mecanosDessous.queue_redraw(); jeu.mecanosDessus.queue_redraw()
	var T: Piste = jeu.course.track
	var cam: Camera2D = jeu.camera
	cam.offset = Vector2.ZERO
	var e0: Dictionary = b.equipe[1]
	cam.position = Vector2(e0.x, e0.y)
	cam.rotation = T.headingAt(float(b.s))
	cam.zoom = Vector2.ONE * zoom
	for k in 4: await RenderingServer.frame_post_draw
	var nom := "mecanos-%s-%d%s.png" % ["planche" if Mecanos.planche else "traits", int(zoom), "-nuit" if A.reglages.nuit else ""]
	get_viewport().get_texture().get_image().save_png(dossier.path_join(nom))
	print("PHOTO ", nom, " ; ", Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME), " dessins")
	get_tree().quit()
