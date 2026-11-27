## La table du multijoueur au téléphone (scripts/ui/tel/salon_tel.gd), sur une salle factice sans réseau
## où deux amis simulés sont assis : l'entrée, la table de l'hôte et ses feuilles (pilotes, format,
## réglages, catégorie), le duel, le championnat de la table en course puis en contre-la-montre, et la
## table d'un invité.
##
##   GRIP_TACTILE=1 xvfb-run -a -s "-screen 0 1170x1992x24" godot --path godot --resolution 1170x1992 res://tests/table_tel_photo.tscn -- <dossier>
extends Node


## Une salle sans réseau : on y est avec des amis factices ; ce qu'on y dit nous revient.
class SalleFausse:
	var mine := {}
	var label := ""
	var h: Array[Callable] = []
	var autres: Array = []

	func claim(code: String, asHost: bool) -> String:
		label = ("0-" if asHost else "5-") + code
		await Engine.get_main_loop().process_frame
		return ""

	func onPeers(cb: Callable) -> void: h.append(cb)
	func onMessage(_cb: Callable) -> void: pass
	func message(_p: Dictionary, _t: String = "") -> void: pass
	func poll(_dt: float) -> void: pass
	func close() -> void: pass
	func connected() -> bool: return true

	func presence(patch: Dictionary) -> void:
		for k in patch:
			if patch[k] == null: mine.erase(k)
			else: mine[k] = patch[k]
		for cb in h: cb.call(peers())

	func peers() -> Array:
		var l := [{ peer = label, isMe = true, presence = mine, updatedAt = SalleRTC.maintenant() }]
		for a in autres: l.append({ peer = a.label, isMe = false, presence = a.q, updatedAt = SalleRTC.maintenant() })
		return l


static func ami(label: String, pid: String, nom: String, voiture: String, pret: bool) -> Dictionary:
	return { label = label, q = { pid = pid, name = nom, car = { modelId = voiture, livree = 0 }, ready = pret, protocol = Net.DRIVE_PROTOCOL,
		grilleIA = true, programmeCourse = 2, championnatClm = 1 } }


var dossier := "user://"


func _photo(nom: String) -> void:
	await get_tree().create_timer(0.5).timeout
	get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dossier, nom])
	print("photo ", nom)


func _ready() -> void:
	get_tree().create_timer(120.0).timeout.connect(func(): print("ÉCHEC : trop long"); get_tree().quit(1))
	if OS.get_cmdline_user_args().size(): dossier = OS.get_cmdline_user_args()[0]
	DirAccess.make_dir_recursive_absolute(dossier)
	var r: Dictionary = App.reglages
	r.langue = "fr"; r.nom = "Bruno"; r.voiture = "porsche991gt3r"; r.livree = 0; r.circuit = "monaco"
	await get_tree().create_timer(0.4).timeout
	App.aller("salon")
	await get_tree().create_timer(0.6).timeout
	await _photo("30-multi")
	# l'hôte, avec Léa et Marco
	var salle := SalleFausse.new()
	salle.autres = [ami("1-a", "lea", "Léa", "audir8lms", true), ami("2-b", "marco", "Marco", "mclaren650sgt3", true)]
	Reseau.net.fabriqueSalle = func(): return salle
	var e: SalonTel = App.ecran
	await e._ouvre(true)
	await get_tree().create_timer(0.4).timeout
	await _photo("31-table-hote")
	e._ouvrePilotes(); await _photo("32-pilotes"); e.fermeDessus()
	await get_tree().create_timer(0.3).timeout
	e._ouvreFormat(); await _photo("33-format"); e.fermeDessus()
	await get_tree().create_timer(0.3).timeout
	Reseau.net.setTable({ aiCount = 0, mode = "duel" })
	e._ouvreReglages(); await _photo("34-reglages-duel"); e.fermeDessus()
	await get_tree().create_timer(0.3).timeout
	e._ouvreCategorie(); await _photo("35-categorie"); e.fermeDessus()
	Reseau.net.setTable({ cat = "gt3" })
	await _photo("36-table-duel")
	# le championnat de la table, en course sans IA
	SalonTel.optionsChamp = { circuits = ["spa", "monaco"], toursParManche = [3, 3], minutesParManche = [10, 10], essais = 0, qualifications = 0 }
	e._ouvreChampionnat(); await _photo("37-championnat-table")
	Reseau.net.setTable({ programme = { circuits = ["spa", "monaco"], toursParManche = [3, 3], clm = false }, championnat = {} })
	e.fermeTout()
	await _photo("38-table-championnat")
	e._ouvreClassement(); await _photo("39-classement-table"); e.fermeDessus()
	await get_tree().create_timer(0.3).timeout
	# le même en contre-la-montre
	Reseau.net.setTable({ mode = "ghost", programme = {}, championnat = {} })
	SalonTel.optionsChamp = { circuits = ["spa", "monaco"], toursParManche = [3, 3], minutesParManche = [11, 10], essais = 0, qualifications = 0 }
	e._ouvreChampionnat(); await _photo("40-championnat-clm")
	e.fermeTout()
	Reseau.net.setTable({ programme = { circuits = ["spa", "monaco"], minutesParManche = [11, 10], clm = true }, championnat = {} })
	await _photo("41-table-clm")
	e._ouvreQuitter(); await _photo("42-quitter")
	e.fermeTout()
	Reseau.net.leave()
	await get_tree().create_timer(0.3).timeout
	# un invité : Marco est l'hôte, Léa est prête
	var salle2 := SalleFausse.new()
	var hote := ami("0-h", "marco", "Marco", "mclaren650sgt3", true)
	hote.q.t = { timeOfDay = "day", mode = "race", trackId = "zandvoort", laps = 5, difficulty = "medium", cat = "gt3", go = 0, aiCount = -1, degats = true }
	salle2.autres = [hote, ami("1-a", "lea", "Léa", "audir8lms", true)]
	Reseau.net.fabriqueSalle = func(): return salle2
	e = App.ecran
	e.codeSaisi = "XK7P"
	await e._ouvre(false)
	await get_tree().create_timer(0.4).timeout
	await _photo("43-table-invite")
	e._ouvreReglages(); await _photo("44-reglages-invite"); e.fermeDessus()
	print("fini")
	get_tree().quit()
