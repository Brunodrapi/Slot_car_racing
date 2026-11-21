## La tôle qui suit les points de vie : la même voiture, intacte puis de plus en plus enfoncée, zone par
## zone, avec la vie qui reste écrite dessous (Bruno : « à 12 %, un côté complètement enfoncé »).
##   xvfb-run -a godot --path godot tests/tole_photo.tscn -- <photo.png> [voiture]
extends Node2D

const PX := 46.0           # pixels par mètre


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	var sortie: String = args[0] if args.size() else "user://tole.png"
	var ids: Array = [args[1]] if args.size() > 1 else ["porsche991gt3r", "renaultrs10"]
	RenderingServer.set_default_clear_color(Color("#55585c"))
	# chaque cas : la zone touchée, et la vie qui reste (100 % = intacte)
	var cas := [["", 100], [2, 70], [2, 40], [2, 12], [0, 12], [3, 12], [6, 12], [-1, 12]]
	var etiquettes := []
	var monde := Node2D.new()
	monde.scale = Vector2(PX, PX)
	add_child(monde)
	var vues := []
	for j in ids.size():
		for i in cas.size():
			var vue := VoitureVue.new(Catalogue.dessin(ids[j], 0))
			monde.add_child(vue)
			vues.append(vue)
	await get_tree().process_frame
	await get_tree().process_frame
	# l'écran d'accueil du jeu se retire : seule la tôle compte ici
	var A = get_node("/root/App")
	if A.ecran: A.ecran.queue_free()
	for j in ids.size():
		for i in cas.size():
			var vue: VoitureVue = vues[j * cas.size() + i]
			var pos := Vector2(80 + i * 150, 150 + j * 300)
			vue.place(pos / PX, -PI / 2, 0, 0)
			var enf := PackedFloat32Array([0, 0, 0, 0, 0, 0, 0, 0])
			var z = cas[i][0]
			var m: float = Voiture.ENFONCE_max * (1 - cas[i][1] / 100.0)
			if z is int and z >= 0:
				enf[z] = m
				enf[(z + 1) % 8] = minf(Voiture.ENFONCE_max, m * 0.35 * Voiture.ENFONCE_durete[(z + 1) % 8] / Voiture.ENFONCE_durete[z])
				enf[(z + 7) % 8] = minf(Voiture.ENFONCE_max, m * 0.35 * Voiture.ENFONCE_durete[(z + 7) % 8] / Voiture.ENFONCE_durete[z])
			elif z is int:
				# une course entière de coups : un flanc à fond, le nez et un coin à moitié
				enf = PackedFloat32Array([m * 0.5, m * 0.3, m, m * 0.4, 0.05, 0.08, 0.12, 0.1])
			vue.ecrase(enf, 0)
			if vue.tole:
				for k in 200: vue.tole.pas(0.02)
				vue.majTole()
			etiquettes.append([pos + Vector2(-40, 135), "%d %%" % cas[i][1]])
	var l := Label.new()
	add_child(l)
	await get_tree().process_frame
	queue_redraw()
	set_meta("e", etiquettes)
	await get_tree().create_timer(0.6).timeout
	get_viewport().get_texture().get_image().save_png(sortie)
	print("PHOTO OK")
	get_tree().quit()


func _draw() -> void:
	for e in get_meta("e", []):
		draw_string(ThemeDB.fallback_font, e[0], e[1], HORIZONTAL_ALIGNMENT_CENTER, 80, 22, Color.WHITE)
