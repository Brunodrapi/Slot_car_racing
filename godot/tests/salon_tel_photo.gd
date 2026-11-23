## Le salon au téléphone, photographié pour le comparer au jeu web : l'entrée, puis une table ouverte
## en hôte sur une salle factice (sans réseau), la page entière (la fenêtre prend sa hauteur).
##   GRIP_TACTILE=1 xvfb-run -a -s "-screen 0 1200x8000x24" godot --path godot --resolution 1170x1992 tests/salon_tel_photo.tscn -- <dossier>
extends Node


## Une salle sans réseau : on y est seul, et ce qu'on y dit nous revient.
class SalleFausse:
	var mine := {}
	var label := ""
	var h: Array[Callable] = []

	func claim(code: String, asHost: bool) -> String:
		label = ("0-" if asHost else "1-") + code
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
		return [{ peer = label, isMe = true, presence = mine, updatedAt = SalleRTC.maintenant() }]


func _ready() -> void:
	get_tree().create_timer(30.0).timeout.connect(func(): print("ÉCHEC : trop long"); get_tree().quit(1))
	var dossier: String = OS.get_cmdline_user_args()[0] if OS.get_cmdline_user_args().size() else "user://"
	var app := get_node("/root/App")
	app.reglages.nom = "Bruno"
	app.reglages.voiture = "m1procar"
	app.reglages.livree = 0
	app.reglages.circuit = "monza"
	await get_tree().create_timer(0.4).timeout
	app.aller("salon")
	await get_tree().create_timer(0.8).timeout
	get_viewport().gui_release_focus()
	await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(dossier + "/godot-entree-tel.png")
	Reseau.net.fabriqueSalle = func(): return SalleFausse.new()
	await app.ecran._ouvre(true)
	await get_tree().create_timer(0.6).timeout
	var w := get_window()
	w.size = Vector2i(w.size.x, int(ceil(float(app.ecran.hauteur) * w.size.x / 390.0)))
	await get_tree().create_timer(0.8).timeout
	get_viewport().gui_release_focus()
	await get_tree().process_frame
	await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(dossier + "/godot-table-tel.png")
	print("photos faites")
	get_tree().quit()
