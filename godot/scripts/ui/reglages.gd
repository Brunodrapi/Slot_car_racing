## Les réglages, à l'identique du jeu web (js/ui.js, settings ; css/style.css, .settings-screen, .form) :
## le titre, la langue en deux boutons, puis le formulaire — un libellé à gauche, sa valeur à droite (le
## nom, le compte, le son, le recul de la caméra, le côté du levier, la vue, et ce que Godot ajoute :
## le volume, le guide de freinage, l'affichage de la version de bureau) —, le lien Discord, le crédit
## de la musique et « Retour ». Sur le fond sombre du jeu web, dans sa police du système.
##
## Mesuré sur un iPhone (390 de large, une colonne qui défile) et sur un écran de 1440 × 900 (deux
## colonnes, l'aide du clavier au-dessus). Toucher une valeur passe à la suivante.
class_name Reglages
extends Control

const DISCORD_BUGS := "https://discord.gg/hbwAzncc32"        # DISCORD_BUGS_URL du jeu web
const TEXTE := Color("#eef0f5")
const MUET := Color("#9aa1b4")
const CARTE := Color("#1a1e2a")
const ACCENT := Color("#ffd400")
const RECULS := [[1.0, "rgReculNormal"], [1.3, "rgReculPeu"], [1.6, "rgReculLoin"]]

var lignes: Array = []           # [libellé, valeur (Callable -> String), action]
var boutons: Array[Bouton] = []
var nom: LineEdit
var cadre: Control
var portrait := false
var defile := 0.0
var hauteur := 0.0
var doigt: Doigt
var L := {}
var _police: Font
var _gras: Font


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	# la police du système (system-ui), plus fine que celle de Godot par défaut, et sa graisse
	var f := FontVariation.new()
	f.base_font = ThemeDB.fallback_font
	f.variation_embolden = -0.3
	_police = f
	var g := FontVariation.new()
	g.base_font = ThemeDB.fallback_font
	g.variation_embolden = 0.6
	_gras = g
	cadre = Control.new()
	cadre.draw.connect(_dessine)
	add_child(cadre)
	doigt = Doigt.new(cadre, _defile)
	var R: Dictionary = App.reglages
	# un recul d'avant (de 1 à 2 par quarts) va au plus proche des trois du jeu web
	var rc := 0
	for i in RECULS.size():
		if absf(float(R.recul) - RECULS[i][0]) < absf(float(R.recul) - RECULS[rc][0]): rc = i
	R.recul = RECULS[rc][0]
	lignes = []
	lignes.append(["rgSon", func(): return Textes.t("rgOui" if R.son else "rgNon"), func(): R.son = not R.son])
	lignes.append(["rgVolume", func(): return "%d %%" % roundi(float(R.volume) * 100), func(): R.volume = fmod(snappedf(float(R.volume) + 0.1, 0.1), 1.05) if float(R.volume) < 0.99 else 0.1])
	lignes.append(["rgRecul", func() -> String: return Textes.t(RECULS[Reglages._recul()][1]),
		func(): R.recul = RECULS[(Reglages._recul() + 1) % RECULS.size()][0]])
	lignes.append(["rgCote", func(): return Textes.t("rgGauche" if R.cote == "left" else "rgDroite"), func(): R.cote = "right" if R.cote == "left" else "left"])
	lignes.append(["rgVue", func(): return Textes.t("rgVueFixe" if R.vue == "avanceFixe" else "rgVueTourne"), func(): R.vue = "avance" if R.vue == "avanceFixe" else "avanceFixe"])
	lignes.append(["rgGuide", func(): return Textes.t("rgAffiche" if R.guide else "rgMasque"), func(): R.guide = not R.guide])
	# La version de bureau : plein écran ou fenêtre, et la taille de la fenêtre (App.appliqueAffichage)
	if App.bureau():
		lignes.append(["rgAffichage", func(): return Textes.t("rgFenetre" if R.affichage == "fenetre" else "rgPlein"), func(): App.basculeAffichage()])
		lignes.append(["rgResolution", Reglages._resolution, _resolutionSuivante])
	for l in lignes:
		var b := Bouton.new("", Color(0, 0, 0, 0), TEXTE, 16)
		b.coupe = 0
		b.set_meta("sansCadre", true)
		b.set_meta("valeur", l[1])
		b.dessinPlus = _liste.bind(b)
		b.pressed.connect(func(): l[2].call(); App.appliqueSon(); App.sauve(); _relibelle())
		cadre.add_child(b)
		boutons.append(b)
	# la langue : deux boutons, chacun dans sa langue (le jeu se refait dans la langue choisie)
	for lg in ["fr", "en"]:
		var b := Bouton.new("", Color(0, 0, 0, 0), TEXTE, 16)
		b.coupe = 0
		b.set_meta("sansCadre", true)
		b.set_meta("langue", lg)
		b.dessinPlus = _seg.bind(b, Textes.t("rgFr" if lg == "fr" else "rgEn"), Textes.langue() == lg)
		b.pressed.connect(func(): if Textes.langue() != lg: R.langue = lg; App.sauve(); App.aller("reglages"))
		cadre.add_child(b)
		L["langue-" + lg] = b
	# le compte : se connecter avec Google, ou se déconnecter (le lien du jeu web)
	if Mondial.connexionPossible():
		var b := Bouton.new("", Color(0, 0, 0, 0), MUET, 13)
		b.coupe = 0
		b.dessinPlus = _lienCompte.bind(b)
		b.pressed.connect(func(): (Mondial.sortir() if Mondial.connecte() else (Mondial.annuler() if Mondial.enCours else Mondial.entrer())))
		cadre.add_child(b)
		L.compte = b
	var bd := Bouton.new("", Color("#5865f2"), Color.WHITE, 18)
	bd.dessinPlus = _discord.bind(bd)
	bd.pressed.connect(func(): OS.shell_open(DISCORD_BUGS))
	cadre.add_child(bd)
	L.discord = bd
	var retour := Bouton.new("", Color(0, 0, 0, 0), TEXTE, 16)
	retour.coupe = 0
	retour.set_meta("sansCadre", true)
	retour.dessinPlus = _seg.bind(retour, Textes.t("rgRetour"), false)
	retour.pressed.connect(func(): App.aller("accueil"))
	cadre.add_child(retour)
	L.retour = retour
	nom = LineEdit.new()
	nom.text = R.nom
	nom.max_length = 16
	var sb := StyleBoxFlat.new()
	sb.bg_color = CARTE
	sb.border_color = Color(1, 1, 1, 0.15)
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(8)
	sb.content_margin_left = 10
	sb.content_margin_right = 10
	nom.add_theme_stylebox_override("normal", sb)
	var sf := sb.duplicate()
	sf.border_color = ACCENT
	nom.add_theme_stylebox_override("focus", sf)
	nom.add_theme_font_override("font", _police)
	nom.add_theme_font_size_override("font_size", 16)
	nom.add_theme_color_override("font_color", TEXTE)
	nom.add_theme_color_override("caret_color", TEXTE)
	nom.text_changed.connect(func(t): if t.strip_edges() != "": R.nom = t.strip_edges(); App.sauve())
	cadre.add_child(nom)
	resized.connect(_place)
	# la connexion revient du navigateur pendant qu'on est là : la ligne du compte suit
	Mondial.change.connect(_relibelle)
	_place()
	if not Style.tactile(): (L["langue-" + Textes.langue()] as Control).grab_focus.call_deferred()


static func _recul() -> int:
	var r := float(App.reglages.recul)
	for i in RECULS.size():
		if absf(r - RECULS[i][0]) < 0.05: return i
	return 0


## La taille de la fenêtre : celle de l'écran (en plein écran, toujours), ou celle choisie.
static func _resolution() -> String:
	var R: Dictionary = App.reglages
	if R.affichage != "fenetre" or R.resolution == "" or not App.resolutions().has(R.resolution):
		var e := App.resolutionEcran()
		return Textes.t("rgEcran", [e.x, e.y])
	return String(R.resolution).replace("x", " × ")


## La taille suivante ; choisir une taille, c'est vouloir une fenêtre.
func _resolutionSuivante() -> void:
	var R: Dictionary = App.reglages
	var liste := App.resolutions()
	R.resolution = liste[(liste.find(R.resolution) + 1) % liste.size()] if R.affichage == "fenetre" else R.resolution
	R.affichage = "fenetre"
	App.appliqueAffichage()


func _relibelle() -> void:
	_place()


func _unhandled_input(e: InputEvent) -> void:
	if e.is_action_pressed("ui_cancel"): App.aller("accueil")


func _input(e: InputEvent) -> void:
	if e is InputEventMouseButton and e.pressed and (e.button_index == MOUSE_BUTTON_WHEEL_DOWN or e.button_index == MOUSE_BUTTON_WHEEL_UP):
		_defile(60.0 if e.button_index == MOUSE_BUTTON_WHEEL_DOWN else -60.0)
	elif portrait:
		doigt.entree(e)


func _process(dt: float) -> void:
	if portrait: doigt.avance(dt)


func _defile(d: float) -> void:
	var k := cadre.scale.y
	defile = clampf(defile + d, 0, maxf(0, hauteur - size.y / k))
	cadre.position.y = -defile * k


func _largeur(t: String, taille: int) -> float:
	return _police.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, taille).x


## La largeur d'une liste (select) : sa valeur, la place de la flèche, jamais moins de 180.
func _largeurListe(v: String) -> float:
	return maxf(180.0, _largeur(v, 16) + 20 + 30)


# ---------- la mise en page ----------
func _place() -> void:
	portrait = size.x < size.y
	var W := 390.0 if portrait else 1440.0
	var k := size.x / W if portrait else minf(size.x / 1440.0, size.y / 900.0)
	cadre.scale = Vector2(k, k)
	cadre.position.x = 0.0 if portrait else (size.x - 1440 * k) / 2
	var x0 := 20.0 if portrait else 120.0
	var larg := 350.0 if portrait else 1200.0
	L.x0 = x0
	L.larg = larg
	var y := 16.0
	L.titre = y + (24.0 if portrait else 31.0) / 2
	y += (24.0 if portrait else 31.0) + 14
	# la langue : au téléphone, les boutons passent sous le libellé
	L.langueY = y + (10.0 if portrait else 23.0)
	var xl := x0 if portrait else x0 + 160
	var yl := y + 32 if portrait else y
	for lg in ["fr", "en"]:
		var b: Bouton = L["langue-" + lg]
		b.position = Vector2(xl, yl)
		b.size = Vector2(120, 46)
		xl += 126
	y = yl + 46 + 28
	# l'aide du clavier, sur ordinateur
	L.aide = PackedStringArray()
	if not portrait and not Style.tactile():
		L.aide = _lignes(Textes.t("rgClavier"), 16, 624)
		L.aideR = Rect2(x0, y + 16, 660, 28 + 20 * (L.aide as PackedStringArray).size())
		y = (L.aideR as Rect2).end.y + 30
	# le formulaire : au téléphone, une colonne ; sur ordinateur, deux (580 chacune, 40 d'écart)
	var cellules := []            # [libellé, contrôle, largeur, hauteur]
	cellules.append(["rgNom", nom, 244.0 if portrait else 270.0, 38.0])
	if L.has("compte"): cellules.append(["rgCompte", L.compte, _largeur(_texteCompte(), 13) + 2, 28.0])
	for i in lignes.size():
		var v: String = (boutons[i].get_meta("valeur") as Callable).call()
		cellules.append([lignes[i][0], boutons[i], _largeurListe(v), 40.0])
	var cols := 1 if portrait else 2
	var wc := larg if portrait else 580.0
	L.libelles = []
	var i := 0
	while i < cellules.size():
		var h := 0.0
		for c in cols:
			if i + c < cellules.size(): h = maxf(h, cellules[i + c][3])
		for c in cols:
			if i + c >= cellules.size(): break
			var cel: Array = cellules[i + c]
			var cx := x0 + c * (wc + 40)
			var ctl: Control = cel[1]
			ctl.size = Vector2(cel[2], cel[3])
			# un libellé trop long pour la place que lui laisse sa valeur passe à la ligne (« Nom du pilote »)
			var lib := _lignes(Textes.t(cel[0]), 16, wc - cel[2] - 12)
			var hl := 19.0 * lib.size()
			h = maxf(h, hl)
			L.libelles.append([lib, cx, y, cel])
		for c in cols:
			if i + c >= cellules.size(): break
			var cel: Array = cellules[i + c]
			var ctl: Control = cel[1]
			var cx := x0 + c * (wc + 40)
			ctl.position = Vector2(cx + wc - cel[2], y + (h - cel[3]) / 2)
		for e in L.libelles:
			if e[2] == y: e.append(h)
		y += h + 14
		i += cols
	# le lien Discord : au téléphone, toute la largeur (le texte sur deux lignes)
	var td := Textes.t("discordBug").to_upper()
	var wd := 16 + 28 + 10 + Style.largeur(td, 18) + 22
	if portrait and wd > larg: wd = larg
	L.discordLignes = Paddock._lignes(td, 18, wd - 76)
	var hd := 20 + 20.7 * (L.discordLignes as PackedStringArray).size()
	(L.discord as Bouton).position = Vector2(x0, y)
	(L.discord as Bouton).size = Vector2(wd, maxf(48.0, hd))
	(L.discord as Bouton).coupe = wd * 0.04
	y += maxf(48.0, hd) + 30
	# le crédit de la musique
	L.credit = _lignes(Textes.t("creditMusique"), 16, larg)
	L.creditY = y
	y += 20 * (L.credit as PackedStringArray).size() + 30
	(L.retour as Bouton).position = Vector2(x0, y)
	(L.retour as Bouton).size = Vector2(_largeur(Textes.t("rgRetour"), 16) + 38, 46)
	y += 46 + 20
	hauteur = y
	cadre.size = Vector2(W, hauteur)
	_defile(0)
	for b in boutons: b.queue_redraw()
	if L.has("compte"): (L.compte as Control).queue_redraw()
	cadre.queue_redraw()
	queue_redraw()


func _lignes(t: String, taille: int, largeur: float) -> PackedStringArray:
	var out := PackedStringArray()
	var ligne := ""
	for mot in t.split(" ", false):
		var essai: String = mot if ligne == "" else ligne + " " + mot
		if ligne != "" and _largeur(essai, taille) > largeur:
			out.append(ligne)
			ligne = mot
		else:
			ligne = essai
	if ligne != "": out.append(ligne)
	return out


func _texteCompte() -> String:
	if Mondial.connecte(): return Textes.t("rgConnecte") + " · " + Textes.t("rgSortir")
	if Mondial.enCours: return Textes.t("rgAnnuler")
	return Textes.t("rgGoogle")


# ---------- le dessin ----------
## Le fond du jeu web (#ui) : un dégradé sombre, à peine bleu en haut, à peine brun en bas.
func _draw() -> void:
	var a := Color("#141826")
	var m := Color("#0f1117")
	var b := Color("#16120f")
	var y := size.y * 0.6
	draw_polygon(PackedVector2Array([Vector2.ZERO, Vector2(size.x, 0), Vector2(size.x, y), Vector2(0, y)]), PackedColorArray([a, a, m, m]))
	draw_polygon(PackedVector2Array([Vector2(0, y), Vector2(size.x, y), size, Vector2(0, size.y)]), PackedColorArray([m, m, b, b]))


func _dessine() -> void:
	var ci := cadre
	var x0: float = L.x0
	ci.draw_string(_gras, Vector2(x0, float(L.titre) + (7.5 if portrait else 9.75)), Textes.t("rgTitre"), HORIZONTAL_ALIGNMENT_LEFT, -1, 20 if portrait else 26, TEXTE)
	ci.draw_string(_gras, Vector2(x0, float(L.langueY) + 5.5), "Langue · Language", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, TEXTE)
	if (L.aide as PackedStringArray).size():
		var r: Rect2 = L.aideR
		var sb := StyleBoxFlat.new()
		sb.bg_color = CARTE
		sb.set_corner_radius_all(14)
		ci.draw_style_box(sb, r)
		var a: PackedStringArray = L.aide
		for i in a.size(): _texte(ci, a[i], Vector2(r.position.x + 18, r.position.y + 14 + 20 * i + 15), MUET)
	for l in L.libelles:
		var lib: PackedStringArray = l[0]
		var h: float = l[4]
		var y0: float = float(l[2]) + (h - 19.0 * lib.size()) / 2
		for j in lib.size(): ci.draw_string(_police, Vector2(l[1], y0 + 19 * j + 15), lib[j], HORIZONTAL_ALIGNMENT_LEFT, -1, 16, TEXTE)
	var c: PackedStringArray = L.credit
	for i in c.size(): ci.draw_string(_police, Vector2(x0, float(L.creditY) + 20 * i + 15), c[i], HORIZONTAL_ALIGNMENT_LEFT, -1, 16, MUET)


## Un texte qui peut porter ↑ et ↓ : la police du système les a.
func _texte(ci: CanvasItem, t: String, p: Vector2, c: Color) -> void:
	ci.draw_string(_police, p, t, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, c)


## Une liste du jeu web (select) : sa boîte arrondie, sa valeur, sa flèche.
func _liste(b: Bouton) -> void:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color("#232838") if b.is_hovered() else CARTE
	sb.border_color = ACCENT if b.has_focus() else Color(1, 1, 1, 0.15)
	sb.set_border_width_all(2 if b.has_focus() else 1)
	sb.set_corner_radius_all(8)
	b.draw_style_box(sb, Rect2(Vector2.ZERO, b.size))
	var v: String = (b.get_meta("valeur") as Callable).call()
	b.draw_string(_police, Vector2(11, b.size.y / 2 + 5.5), v, HORIZONTAL_ALIGNMENT_LEFT, b.size.x - 40, 16, TEXTE)
	var cx := b.size.x - 18
	var cy := b.size.y / 2
	b.draw_polyline(PackedVector2Array([Vector2(cx - 4.5, cy - 2), Vector2(cx, cy + 2.5), Vector2(cx + 4.5, cy - 2)]), TEXTE, 1.8, true)


## Un bouton du jeu web (button, .seg) : arrondi, sombre, jaune quand il est choisi.
func _seg(b: Bouton, t: String, choisi: bool) -> void:
	var sb := StyleBoxFlat.new()
	sb.bg_color = ACCENT if choisi else (Color("#232838") if b.is_hovered() else CARTE)
	sb.border_color = Color(1, 1, 1, 0.08) if not b.has_focus() else ACCENT
	sb.set_border_width_all(1 if not b.has_focus() else 2)
	sb.set_corner_radius_all(14)
	b.draw_style_box(sb, Rect2(Vector2.ZERO, b.size))
	b.draw_string(_police, Vector2(0, b.size.y / 2 + 5.5), t, HORIZONTAL_ALIGNMENT_CENTER, b.size.x, 16, Color("#1a1400") if choisi else TEXTE)


## Le lien du compte : petit, gris, souligné, collé à droite.
func _lienCompte(b: Bouton) -> void:
	var t := _texteCompte()
	var w := _largeur(t, 13)
	var x := b.size.x - w - 1
	b.draw_string(_police, Vector2(x, b.size.y / 2 + 4.5), t, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, MUET)
	b.draw_line(Vector2(x, b.size.y / 2 + 6.5), Vector2(x + w, b.size.y / 2 + 6.5), MUET, 1.0)


## Le lien Discord (.lien-discord) : la bulle, puis le texte en capitales, sur une ou deux lignes.
func _discord(b: Bouton) -> void:
	var cy := b.size.y / 2
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color.WHITE
	sb.set_corner_radius_all(4)
	b.draw_style_box(sb, Rect2(19, cy - 9, 22, 15))
	b.draw_colored_polygon(PackedVector2Array([Vector2(22, cy + 5), Vector2(29, cy + 5), Vector2(22, cy + 10)]), Color.WHITE)
	for x in [25.0, 30.0, 35.0]: b.draw_circle(Vector2(x, cy - 1.5), 1.9, Color("#5865f2"))
	var l: PackedStringArray = L.discordLignes
	var y0 := cy - 20.7 * l.size() / 2
	for i in l.size(): Style.texte(b, l[i], Vector2(54, y0 + 20.7 * i + 10.35 + 6.75), 18, Color.WHITE)
