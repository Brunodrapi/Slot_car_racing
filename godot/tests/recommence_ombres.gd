## Une course qui recommence ne laisse aucune ombre sans voiture sur la piste : les voitures
## cabossées ont une ombre déformée (VoitureVue.ombreMaille), posée à côté d'elles dans la scène.
##   xvfb-run -a godot --path godot --resolution 844x390 tests/recommence_ombres.tscn
extends Node


func _ready() -> void:
	get_tree().create_timer(60.0).timeout.connect(func(): print("ÉCHEC : trop long"); get_tree().quit(1))
	var A = get_node("/root/App")
	await get_tree().create_timer(0.6).timeout
	A.reglages.mode = "race"; A.reglages.circuit = "spa"; A.reglages.voiture = "porsche991gt3r"; A.reglages.livree = 0
	A.reglages.adversaires = 10; A.reglages.tours = 3; A.reglages.nuit = false; A.reglages.degats = true; A.reglages.son = false
	A.aller("course")
	var jeu = A.ecran
	while is_instance_valid(jeu) and jeu.course == null: await get_tree().process_frame
	await get_tree().create_timer(0.5).timeout
	# un choc sur chaque voiture : sa tôle se cabosse, son ombre devient un maillage
	for c in jeu.course.cars:
		c.chocs.append({ nx = 1.0, ny = 0.0, v = 13.0, frotte = 0.0, sorte = "rail", epave = false })
	await get_tree().create_timer(0.8).timeout
	var avant := _ombres(jeu)
	jeu.recommence()
	await get_tree().create_timer(0.8).timeout
	var apres := _ombres(jeu)
	var attendues := 0
	for v in jeu.vues: attendues += 1 + (1 if v.ombreMaille else 0)
	print("ombres avant : %d (dont %d de tôle) ; après le nouveau départ : %d pour %d attendues" % [avant[0], avant[1], apres[0], attendues])
	var ok: bool = avant[1] > 0 and apres[0] == attendues
	print("OMBRES OK" if ok else "OMBRES ÉCHEC")
	get_tree().quit(0 if ok else 1)


## [toutes les ombres, celles des tôles] parmi les enfants de l'écran de course
func _ombres(jeu) -> Array:
	var n := 0
	var tole := 0
	for e in jeu.get_children():
		if e is Polygon2D and e.texture and e.texture.resource_path.ends_with("-ombre.png"):
			n += 1; tole += 1
		elif e is Sprite2D and e.texture and e.texture.resource_path.ends_with("-ombre.png"):
			n += 1
	return [n, tole]
