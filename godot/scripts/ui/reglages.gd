## Les réglages (js/ui.js, settings) : le nom, le son, la caméra, le côté du levier, le guide.
class_name Reglages
extends Control

var fond: Texture2D
var lignes: Array = []           # [libellé, valeur (Callable -> String), action]
var boutons: Array[Bouton] = []
var nom: LineEdit


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	fond = load("res://images/interface/paddock.webp")
	var R: Dictionary = App.reglages
	lignes = [
		["SON", func(): return "ACTIVÉ" if R.son else "COUPÉ", func(): R.son = not R.son],
		["VOLUME", func(): return "%d %%" % roundi(float(R.volume) * 100), func(): R.volume = fmod(snappedf(float(R.volume) + 0.1, 0.1), 1.05) if float(R.volume) < 0.99 else 0.1],
		["CAMÉRA", func(): return "DEVANT, NORD EN HAUT" if R.vue == "avanceFixe" else "DEVANT, TOURNE AVEC LA PISTE", func(): R.vue = "avance" if R.vue == "avanceFixe" else "avanceFixe"],
		["RECUL DE LA CAMÉRA", func(): return "×%.2f" % float(R.recul), func(): R.recul = 1.0 if float(R.recul) >= 1.99 else float(R.recul) + 0.25],
		["LEVIER DE LIGNE", func(): return "À GAUCHE" if R.cote == "left" else "À DROITE", func(): R.cote = "right" if R.cote == "left" else "left"],
		["GUIDE DE FREINAGE EN COURSE", func(): return "AFFICHÉ" if R.guide else "MASQUÉ", func(): R.guide = not R.guide],
	]
	if not OS.has_feature("web") and not OS.has_feature("mobile"):
		lignes.append(["PLEIN ÉCRAN", func(): return "OUI" if DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN else "NON",
			func(): DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN else DisplayServer.WINDOW_MODE_FULLSCREEN)])
	for l in lignes:
		var b := Bouton.new(l[1].call(), Style.NUIT_PLEINE, Style.CREME, 22)
		b.centre = true
		b.pressed.connect(func(): l[2].call(); App.appliqueSon(); App.sauve(); b.libelle(l[1].call()))
		add_child(b)
		boutons.append(b)
	nom = LineEdit.new()
	nom.text = R.nom
	nom.max_length = 16
	nom.add_theme_font_size_override("font_size", 24)
	nom.text_changed.connect(func(t): if t.strip_edges() != "": R.nom = t.strip_edges(); App.sauve())
	add_child(nom)
	var retour := Bouton.new("← RETOUR", Style.ROUGE, Style.CREME, 24)
	retour.centre = true
	retour.pressed.connect(func(): App.aller("accueil"))
	add_child(retour)
	boutons.append(retour)
	resized.connect(_place)
	_place()
	boutons[0].grab_focus.call_deferred()


func _unhandled_input(e: InputEvent) -> void:
	if e.is_action_pressed("ui_cancel"): App.aller("accueil")


func _cadre() -> Rect2:
	var w := minf(760, size.x - 32)
	return Rect2((size.x - w) / 2, 24, w, size.y - 48)


func _place() -> void:
	var r := _cadre()
	var h := minf(52, (r.size.y - 150) / (lignes.size() + 2))
	nom.position = Vector2(r.position.x + r.size.x * 0.5, r.position.y + 84)
	nom.size = Vector2(r.size.x * 0.5 - 16, h - 6)
	for i in lignes.size():
		boutons[i].position = Vector2(r.position.x + r.size.x * 0.5, r.position.y + 84 + (i + 1) * h)
		boutons[i].size = Vector2(r.size.x * 0.5 - 16, h - 6)
	boutons[-1].size = Vector2(200, 52)
	boutons[-1].position = Vector2(r.position.x + 16, r.end.y - 68)
	queue_redraw()


func _draw() -> void:
	Style.couvre(self, fond, Rect2(Vector2.ZERO, size), 0.4)
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.08, 0.09, 0.1, 0.45))
	var r := _cadre()
	draw_rect(r, Style.PAPIER)
	draw_rect(r, Style.NUIT_PLEINE, false, 3)
	Style.biseau(self, Rect2(r.position.x, r.position.y, r.size.x, 64), Style.NUIT_PLEINE, 0)
	Style.texte(self, "RÉGLAGES", r.position + Vector2(20, 48), 40, Style.CREME)
	var h := minf(52, (r.size.y - 150) / (lignes.size() + 2))
	Style.texte(self, "NOM DU PILOTE", r.position + Vector2(20, 84 + h * 0.62), 22, Style.ENCRE)
	for i in lignes.size():
		Style.texte(self, lignes[i][0], r.position + Vector2(20, 84 + (i + 1) * h + h * 0.62), 22, Style.ENCRE)
	Style.texte(self, "Manette : A pour valider, B pour revenir · Clavier : flèches, Entrée, Échap", Vector2(r.position.x + 236, r.end.y - 34), 15, Color(Style.ENCRE, 0.7))
