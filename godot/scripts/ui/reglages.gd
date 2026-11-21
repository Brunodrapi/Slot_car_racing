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
		["sLang", func(): return "FRANÇAIS" if Textes.langue() == "fr" else "ENGLISH", func(): R.langue = "en" if Textes.langue() == "fr" else "fr"; App.sauve(); App.aller("reglages")],
		["sSound", func(): return Textes.t("on" if R.son else "off"), func(): R.son = not R.son],
		["sVolume", func(): return "%d %%" % roundi(float(R.volume) * 100), func(): R.volume = fmod(snappedf(float(R.volume) + 0.1, 0.1), 1.05) if float(R.volume) < 0.99 else 0.1],
		["sCamera", func(): return Textes.t("camFixed" if R.vue == "avanceFixe" else "camTrack"), func(): R.vue = "avance" if R.vue == "avanceFixe" else "avanceFixe"],
		["sPull", func(): return "×%.2f" % float(R.recul), func(): R.recul = 1.0 if float(R.recul) >= 1.99 else float(R.recul) + 0.25],
		["sSide", func(): return Textes.t("left" if R.cote == "left" else "right"), func(): R.cote = "right" if R.cote == "left" else "left"],
		["sGuide", func(): return Textes.t("shown" if R.guide else "hidden"), func(): R.guide = not R.guide],
	]
	# Le compte se gère ici (js/ui.js, settings) : se connecter avec Google, ou se déconnecter.
	if Mondial.connexionPossible():
		lignes.append(["account", func(): return (Textes.t("signedIn") + " · " + Textes.t("signOut")) if Mondial.connecte() else (Textes.t("signInCancel") if Mondial.enCours else Textes.t("signIn")),
			func(): (Mondial.sortir() if Mondial.connecte() else (Mondial.annuler() if Mondial.enCours else Mondial.entrer()))])
	# La version de bureau : plein écran ou fenêtre, et la taille de la fenêtre (App.appliqueAffichage)
	if App.bureau():
		lignes.append(["sDisplay", func(): return Textes.t("windowed" if R.affichage == "fenetre" else "fullscreen"),
			func(): App.basculeAffichage(); _relibelle()])
		lignes.append(["sResolution", Reglages._resolution, _resolutionSuivante])
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
	var retour := Bouton.new(Textes.t("back"), Style.ROUGE, Style.CREME, 24)
	retour.centre = true
	retour.pressed.connect(func(): App.aller("accueil"))
	add_child(retour)
	boutons.append(retour)
	resized.connect(_place)
	# la connexion revient du navigateur pendant qu'on est là : la ligne du compte suit
	Mondial.change.connect(_relibelle)
	_place()
	boutons[0].grab_focus.call_deferred()


## La taille de la fenêtre : celle de l'écran (en plein écran, toujours), ou celle choisie.
static func _resolution() -> String:
	var R: Dictionary = App.reglages
	if R.affichage != "fenetre" or R.resolution == "" or not App.resolutions().has(R.resolution):
		var e := App.resolutionEcran()
		return Textes.t("resScreen", [e.x, e.y])
	return String(R.resolution).replace("x", " × ")


## La taille suivante ; choisir une taille, c'est vouloir une fenêtre.
func _resolutionSuivante() -> void:
	var R: Dictionary = App.reglages
	var liste := App.resolutions()
	R.resolution = liste[(liste.find(R.resolution) + 1) % liste.size()] if R.affichage == "fenetre" else R.resolution
	R.affichage = "fenetre"
	App.appliqueAffichage()
	_relibelle()


func _relibelle() -> void:
	for i in lignes.size(): boutons[i].libelle(lignes[i][1].call())


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
	Style.texte(self, Textes.t("settings"), r.position + Vector2(20, 48), 40, Style.CREME)
	var h := minf(52, (r.size.y - 150) / (lignes.size() + 2))
	Style.texte(self, Textes.t("sName"), r.position + Vector2(20, 84 + h * 0.62), 22, Style.ENCRE)
	for i in lignes.size():
		Style.texte(self, Textes.t(lignes[i][0]), r.position + Vector2(20, 84 + (i + 1) * h + h * 0.62), 22, Style.ENCRE)
	Style.texte(self, Textes.t("sHint"), Vector2(r.position.x + 236, r.end.y - 34), 15, Color(Style.ENCRE, 0.7))
	# le crédit de la musique des menus (licence Creative Commons BY 4.0)
	Style.texte(self, Textes.t("creditMusique"), Vector2(r.position.x + 236, r.end.y - 14), 12, Color(Style.ENCRE, 0.6), HORIZONTAL_ALIGNMENT_LEFT, r.size.x - 252)
