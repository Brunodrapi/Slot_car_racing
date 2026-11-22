## Comment jouer, au doigt : un glissé de côté passe à la fiche suivante, « Suivant » aussi, et à la
## dernière fiche le bouton dit « Jouer » et mène au paddock de la course rapide.
##   GRIP_TACTILE=1 xvfb-run -a godot --path godot --resolution 780x1688 tests/comment_doigt.tscn
extends Node

var app: Node
var echecs := 0


func _ready() -> void:
	get_tree().create_timer(30.0).timeout.connect(func(): print("ÉCHEC : trop long"); get_tree().quit(1))
	app = get_node("/root/App")
	await get_tree().create_timer(0.4).timeout
	app.aller("comment")
	await get_tree().create_timer(0.5).timeout
	var c: Control = app.ecran
	_verifie(c.portrait and c.page == 0.0, "la première fiche, au téléphone")
	var r: Control = c.rail
	var t := r.get_global_transform()
	var m := t.origin + r.size * t.get_scale() / 2
	await _glisse(m + Vector2(200, 0), m + Vector2(-200, 10))
	await get_tree().create_timer(0.6).timeout
	_verifie(c.cible == 1 and absf(c.page - 1.0) < 0.01, "le glissé mène à la deuxième fiche (%.2f)" % c.page)
	_verifie(c.anims[1].image >= 0, "son animation est là")
	c.suivant.pressed.emit()
	await get_tree().create_timer(0.6).timeout
	_verifie(c.cible == 2, "« Suivant » mène à la troisième")
	_verifie(c.suivant.get_meta("texte") == Textes.t("howPlay").to_upper(), "le bouton dit « %s »" % c.suivant.get_meta("texte"))
	var i0: int = c.anims[2].image
	await get_tree().create_timer(0.5).timeout
	_verifie(c.anims[2].image != i0, "l'animation avance (%d → %d)" % [i0, c.anims[2].image])
	c.suivant.pressed.emit()
	await get_tree().create_timer(0.3).timeout
	_verifie(app.ecran is Paddock and app.ecran.mode == "race", "« Jouer » ouvre le paddock de la course rapide")
	print("ÉCHECS : %d" % echecs if echecs else "TOUT EST BON")
	get_tree().quit(1 if echecs else 0)


func _verifie(ok: bool, quoi: String) -> void:
	print(("ok      " if ok else "ÉCHEC   ") + quoi)
	if not ok: echecs += 1


func _glisse(a: Vector2, b: Vector2) -> void:
	var e := InputEventScreenTouch.new()
	e.position = a
	e.pressed = true
	Input.parse_input_event(e)
	await get_tree().process_frame
	var avant := a
	for i in range(1, 11):
		var p := a.lerp(b, i / 10.0)
		var d := InputEventScreenDrag.new()
		d.position = p
		d.relative = p - avant
		avant = p
		Input.parse_input_event(d)
		await get_tree().process_frame
	var f := InputEventScreenTouch.new()
	f.position = b
	f.pressed = false
	Input.parse_input_event(f)
	await get_tree().process_frame
