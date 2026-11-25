## Contre-la-montre, entraînement et commandes partagées par le salon.
extends "res://tests/paddock_championnat.gd"


func _ready() -> void:
	get_tree().create_timer(75).timeout.connect(func(): get_tree().quit(2))
	await get_tree().create_timer(0.4).timeout
	App.reglages.merge({nom = "PiloteTest", langue = "fr", cat = "gt3", voiture = "porsche991gt3r", son = false}, true)
	# Les réponses du classement sont indépendantes du test de navigation.
	Mondial.lectureTours = true
	for circuit in Catalogue.circuits():
		Mondial.cache[circuit.id] = {t = Time.get_ticks_msec(), par = {}}
	for i in [1, 2]:
		App.aller("accueil")
		await _cadre()
		await _clic(App.ecran.modes[i])
		var rapide: Control = App.ecran.rapide
		rapide.rails.circuits.ensure_control_visible(_controle(rapide, "circuit-lemans"))
		await _clic(_controle(rapide, "circuit-lemans"), rapide.page)
		var labels := rapide.find_children("*", "Label", true, false).map(func(l): return l.text)
		_verifie(labels.has("271 km/h") and labels.has("Kaminari Hayate"), "pointe mesurée au Mans")
		_verifie(_controle(rapide, "adversaires") == null and _controle(rapide, "programme") == null, "réglages du mode chronométré")
		await _clic(_controle(rapide, "go"))
		var fin := Time.get_ticks_msec() + 15000
		while (not ("course" in App.ecran) or App.ecran.course == null) and Time.get_ticks_msec() < fin:
			await get_tree().process_frame
		_verifie(App.ecran.circuitId == "lemans" and App.ecran.course.mode == "timetrial" and App.ecran.course.entrainement == (i == 2), "départ et fantôme du mode choisi")
	App.aller("salon")
	await _cadre()
	Reseau.net.fabriqueSalle = func(): return preload("res://tests/salon_tel_photo.gd").SalleFausse.new()
	await App.ecran._ouvre(true)
	await _cadre()
	var salon: Control = App.ecran
	# Tester la propagation des choix à la table même quand ses commandes sont hors de la vue.
	_controle(salon, "circuit-monza").pressed.emit()
	await _cadre()
	_verifie(Reseau.net.settings().trackId == "monza", "circuit de la table")
	_controle(salon, "onglet-gt3").pressed.emit()
	await _cadre()
	_controle(salon, "voiture-porsche991gt3r").pressed.emit()
	await _cadre()
	_controle(salon, "livree-droite").pressed.emit()
	await _cadre()
	_verifie(Reseau.net.mine.car.modelId == "porsche991gt3r" and Reseau.net.mine.car.livree == App.reglages.livree and App.reglages.livree > 0, "livrée annoncée aux autres pilotes")
	print("Paddock modes Godot ", get_window().size, " — ", "OK" if echecs == 0 else "ÉCHEC")
	get_tree().quit(0 if echecs == 0 else 1)
