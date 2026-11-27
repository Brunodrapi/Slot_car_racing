## L'accueil des menus, à l'identique du jeu web (js/ui.js, home ; css/style.css .home-screen) : le logo,
## les quatre modes en grandes cartes (coin biseauté, liseré crème, ombre, damier à droite), « Comment
## jouer » et « Buy me a tea », la barre du bas Réglages | Pilote, la version. Mesuré dans le navigateur
## sur un iPhone (390 × 664) et sur un PC (1440 × 900), en pixels CSS, et ramené à l'écran.
class_name Accueil
extends Control

const DON_URL := "https://drapiiii.itch.io/grip-racing-the-line"
# Les pictogrammes du jeu web (js/ui.js, PICTOS.aide et PICTOS.the)
const SVG_AIDE := '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#f2c52c" stroke="#171b19" stroke-width="2.6"/><path d="M12.2 12.6a3.9 3.9 0 1 1 5.5 3.6c-1.1.5-1.7 1.3-1.7 2.4v.8" fill="none" stroke="#171b19" stroke-width="3" stroke-linecap="round"/><circle cx="16" cy="23.4" r="1.9" fill="#171b19"/></svg>'
const SVG_THE := '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M11 9.6c-1.4-1.6 1.4-3 0-4.6m5 4.6c-1.4-1.6 1.4-3 0-4.6m5 4.6c-1.4-1.6 1.4-3 0-4.6" fill="none" stroke="#171b19" stroke-width="1.6" stroke-linecap="round"/><path d="M23.6 15.4h2a3.2 3.2 0 0 1 0 6.4h-3.2" fill="none" stroke="#171b19" stroke-width="4.4" stroke-linecap="round"/><path d="M23.6 15.4h2a3.2 3.2 0 0 1 0 6.4h-3.2" fill="none" stroke="#cfd3d8" stroke-width="1.6" stroke-linecap="round"/><path d="M4.6 12.6h20.8v2.8c0 5.5-4.4 9.8-9.9 9.8h-1c-5.5 0-9.9-4.3-9.9-9.8z" fill="#f39a1e" stroke="#171b19" stroke-width="2" stroke-linejoin="round"/><path d="M5.7 13.6h18.6v2.3H5.7z" fill="#fff6e2"/><path d="M15 12.8v6" stroke="#171b19" stroke-width="1.1"/><path d="M13.3 19.5l1.7-1.4 1.7 1.4v3.3h-3.4z" fill="#8a4a24" stroke="#171b19" stroke-width="1.2" stroke-linejoin="round"/><path d="M3 26.4h26c0 1.8-1.8 3.1-4 3.1H7c-2.2 0-4-1.3-4-3.1z" fill="#e4e1da" stroke="#171b19" stroke-width="1.8" stroke-linejoin="round"/></svg>'

var fond: Texture2D
var fondPortrait: Texture2D
var logo: Texture2D
var modes: Array[Bouton] = []
var extras: Array[Bouton] = []
var reglages: Bouton
var pilote: Bouton
var quitter: Bouton
var boutons: Array[Bouton] = []          # dans l'ordre : les modes, les extras, réglages, pilote, quitter
var nom: LineEdit
var _m := {}                             # la mise en page en cours


## Une carte de l'accueil, dessinée comme son modèle du jeu web.
class Carte extends Bouton:
	var genre := "mode"                  # mode | extra | pied
	var k := 1.0                         # pixels d'écran par pixel CSS
	var colonne := false                 # une carte extra en colonne (téléphone) : l'icône au-dessus
	var petit := ""                      # le « PILOTE : » avant le nom
	var sous := ""                       # une ligne sous le nom (le championnat en cours)

	func _draw() -> void:
		var w := size.x
		var h := size.y
		var actif := (has_focus() or is_hovered()) and not Style.tactile()
		match genre:
			"mode":
				# l'ombre, la carte au coin droit biseauté (polygon 0 0, 96% 0, 100% 100%, 0 100%), le liseré
				var poly := PackedVector2Array([Vector2(0, 0), Vector2(w * 0.96, 0), Vector2(w, h), Vector2(0, h)])
				var ombre := PackedVector2Array()
				for p in poly: ombre.append(p + Vector2(5, 5) * k)
				draw_colored_polygon(ombre, Color(0.067, 0.067, 0.067, 0.73))
				var c := fond.lightened(0.08) if actif else fond
				draw_colored_polygon(poly, c)
				# le damier, sur le tiers droit (.mode-damier : 34 %, cases de 26), qui s'efface vers la gauche
				var cote := 26.0 * k
				var x0 := w * 0.66
				var ligne := 0
				var y := 0.0
				while y < h:
					var hy := minf(cote, h - y)
					var x := x0 + (cote if ligne % 2 else 0.0)
					while x < w:
						var bord := w * 0.96 + w * 0.04 * (y / h)          # le bord biseauté à cette hauteur
						var lx := minf(cote, bord - x)
						if lx > 0:
							var a := clampf((x - x0) / (w * 0.34 * 0.7), 0, 1) * 0.18
							draw_rect(Rect2(x, y, lx, hy), Color(0, 0, 0, a))
						x += cote * 2
					y += cote
					ligne += 1
				draw_polyline(PackedVector2Array([Vector2(w * 0.96, 1) , Vector2(1, 1), Vector2(1, h - 1), Vector2(w, h - 1)]), Color("#fff0d0"), 2.0 * k)
				if actif: draw_polyline(poly + PackedVector2Array([poly[0]]), Color("#fff4d7"), 3.0 * k)
				# l'icône (88 × 68 sur PC, 66 × 50 au téléphone) et le nom
				if icone:
					var ih := h * 0.72
					var iw := minf(ih * icone.get_width() / icone.get_height(), (88.0 if size.x > 400 * k else 66.0) * k)
					ih = iw * icone.get_height() / icone.get_width()
					var case := (88.0 if size.x > 400 * k else 66.0) * k
					draw_texture_rect(icone, Rect2(14 * k + (case - iw) / 2, (h - ih) / 2, iw, ih), false)
				var t: String = get_meta("texte", "")
				var tx := (114.0 if size.x > 400 * k else 90.0) * k
				var sz := taille
				while sz > 10 and Style.largeur(t, sz) > w * 0.9 - tx: sz -= 1
				if sous != "":
					Style.texte(self, t, Vector2(tx, h / 2 + sz * 0.36 - 8 * k), sz, encre)
					Tel.ecrit(self, sous, Vector2(tx, h / 2 + sz * 0.36 + 10 * k), roundi(14 * k), encre)
				else: Style.texte(self, t, Vector2(tx, h / 2 + sz * 0.36), sz, encre)
			"extra":
				var poly2 := PackedVector2Array([Vector2(w * 0.05, 0), Vector2(w, 0), Vector2(w * 0.95, h), Vector2(0, h)])
				draw_colored_polygon(poly2, Color("#fff8e8") if actif else Color("#fff0d2"))
				draw_polyline(poly2 + PackedVector2Array([poly2[0]]), Color("#c82520") if actif else Color("#171b19"), (3.0 if actif else 2.0) * k)
				var t2: String = get_meta("texte", "")
				if colonne:
					var isz := 26.0 * k
					if icone: draw_texture_rect(icone, Rect2((w - isz) / 2, 8 * k, isz, isz), false)
					Style.texte(self, t2, Vector2(0, h - 11 * k), taille, Color("#171b19"), HORIZONTAL_ALIGNMENT_CENTER, w)
				else:
					var isz2 := 30.0 * k
					var tw := Style.largeur(t2, taille)
					var x2 := (w - isz2 - 9 * k - tw) / 2
					if icone: draw_texture_rect(icone, Rect2(x2, (h - isz2) / 2, isz2, isz2), false)
					Style.texte(self, t2, Vector2(x2 + isz2 + 9 * k, h / 2 + taille * 0.36), taille, Color("#171b19"))
			"pied":
				# dans la barre du bas : l'icône, le libellé (et « PILOTE : » avant le nom)
				if actif: draw_rect(Rect2(Vector2.ZERO, size), Color(1, 1, 1, 0.08))
				var x3 := 14.0 * k
				var ih2 := minf(h * 0.62, 34 * k)
				if icone:
					var iw2 := ih2 * icone.get_width() / icone.get_height()
					draw_texture_rect(icone, Rect2(x3, (h - ih2) / 2, iw2, ih2), false)
					x3 += iw2 + 10 * k
				var t3: String = get_meta("texte", "")
				# le texte se resserre plutôt que de déborder sur la case voisine
				var sz3 := taille
				var plein := (petit + " " if petit != "" else "") + t3
				while sz3 > 10 and Style.largeur(plein, sz3) > w - x3 - 8 * k: sz3 -= 1
				if petit != "":
					Style.texte(self, petit, Vector2(x3, h / 2 + sz3 * 0.36), sz3, Color("#f7edda"))
					x3 += Style.largeur(petit, sz3) + 8 * k
				Style.texte(self, t3, Vector2(x3, h / 2 + sz3 * 0.36), sz3, Color("#f7edda"))


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	fond = load("res://images/interface/accueil-pc.webp")
	fondPortrait = load("res://images/interface/accueil-mobile.webp")
	logo = load(Style.LOGO)
	var defs := [[Textes.t("quickRace"), Color("#e33228"), Color("#fff5dd"), "wheel.webp", "race"],
		[Textes.t("timeTrial"), Color("#f2c52c"), Color("#171b19"), "clock.webp", "timetrial"],
		[Textes.t("training"), Color("#2f7fd6"), Color("#fff5dd"), "plaque-l.svg", "training"],
		[Textes.t("multi"), Color("#12b974"), Color("#101b17"), "helmets.webp", "multi"]]
	# au téléphone (la maquette) : le championnat devient un mode, et les symboles de Bruno — une manette
	# pour la course rapide, la coupe, deux manettes pour le multijoueur
	if Tel.actif():
		defs[0][3] = "manette.webp"
		defs[3][3] = "manettes.webp"
		defs.insert(1, [Tel.t("championnat"), Color("#e2762a"), Color("#fff5dd"), "coupe.webp", "champ"])
	for m in defs:
		var b := _carte("mode", m[0], m[1], m[2])
		b.icone = load("res://images/interface/" + m[3])
		if m[4] == "champ":
			b.pressed.connect(func(): App.aller("championnat"))
			if ChampTel.enCours(): (b as Carte).sous = Tel.t("enCours", [ChampTel.numero(), ChampTel.nombre()])
		elif m[4] == "multi": b.pressed.connect(func(): App.aller("salon"))
		else: b.pressed.connect(func(): App.reglages.mode = m[4]; App.sauve(); App.aller("paddock", { mode = m[4] }))
		modes.append(b)
	var comment := _carte("extra", Textes.t("howto"), Color("#fff0d2"), Color("#171b19"))
	comment.icone = Accueil._svg(SVG_AIDE)
	comment.pressed.connect(func(): App.aller("comment"))
	extras.append(comment)
	if OS.has_feature("web") and not JavaScriptBridge.eval("navigator.standalone === true || matchMedia('(display-mode: standalone)').matches || window.gripInstalle === true"):
		var installer := _carte("extra", Textes.t("installGame"), Color("#fff0d2"), Color("#171b19"))
		installer.icone = Accueil._svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M16 3v17m-7-7 7 7 7-7M5 22v6h22v-6" fill="none" stroke="#171b19" stroke-width="3"/></svg>')
		installer.pressed.connect(_installer)
		extras.append(installer)
	# « Buy me a tea » (js/ui.js, DON_URL) : pas dans une application de téléphone, dont les boutiques
	# encadrent les liens de paiement
	if not OS.has_feature("mobile"):
		var don := _carte("extra", Textes.t("menuDon"), Color("#fff0d2"), Color("#171b19"))
		don.icone = Accueil._svg(SVG_THE)
		don.pressed.connect(func(): OS.shell_open(DON_URL))
		extras.append(don)
	reglages = _carte("pied", Textes.t("settingsWord"), Color(0, 0, 0, 0), Color("#f7edda"))
	reglages.icone = load("res://images/interface/gear.webp")
	reglages.pressed.connect(func(): App.aller("reglages"))
	pilote = _carte("pied", str(App.reglages.nom).to_upper(), Color(0, 0, 0, 0), Color("#f7edda"))
	pilote.icone = load("res://images/interface/pilot.webp")
	(pilote as Carte).petit = Textes.t("pilotLabel")
	pilote.pressed.connect(_changeNom)
	quitter = _carte("pied", Textes.t("quitWord"), Color(0, 0, 0, 0), Color("#f7edda"))
	quitter.pressed.connect(func(): get_tree().quit())
	quitter.visible = not OS.has_feature("web") and not OS.has_feature("mobile")
	boutons.append_array(modes)
	boutons.append_array(extras)
	boutons.append_array([reglages, pilote, quitter])
	nom = LineEdit.new()
	nom.visible = false
	nom.max_length = 16
	nom.add_theme_font_size_override("font_size", 26)
	nom.text_submitted.connect(func(t): _valideNom(t))
	add_child(nom)
	resized.connect(_place)
	_place()
	if not Style.tactile(): modes[0].grab_focus.call_deferred()


func _installer() -> void:
	# au téléphone, l'écran du jeu web (InstallerTel) ; sur ordinateur, l'aide et l'invitation du navigateur
	if Tel.actif():
		App.aller("installer")
		return
	var ios: bool = JavaScriptBridge.eval("/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)")
	var aide := AcceptDialog.new()
	aide.title = Textes.t("installGame")
	aide.dialog_text = Textes.t("installIOS" if ios else "installBrowser")
	aide.dialog_autowrap = true
	var echelle := clampf(minf(size.x, size.y) / 390.0, 1.0, 2.0)
	aide.get_label().add_theme_color_override("font_color", Color("#fff0d2"))
	aide.get_label().add_theme_font_size_override("font_size", roundi(17 * echelle))
	aide.get_ok_button().add_theme_font_size_override("font_size", roundi(18 * echelle))
	add_child(aide)
	aide.confirmed.connect(aide.queue_free)
	aide.canceled.connect(aide.queue_free)
	aide.popup_centered(Vector2i(mini(roundi(380 * echelle), int(size.x * 0.88)), roundi(160 * echelle)))
	JavaScriptBridge.eval("if (window.gripInvite) { const invite = window.gripInvite; window.gripInvite = null; invite.prompt().catch(() => {}); }")


func _carte(genre: String, t: String, f: Color, e: Color) -> Carte:
	var b := Carte.new(t, f, e, 22)
	b.genre = genre
	add_child(b)
	return b


static var _svgs := {}


static func _svg(s: String) -> Texture2D:
	if _svgs.has(s): return _svgs[s]
	var im := Image.new()
	im.load_svg_from_string(s, 4.0)
	var t := ImageTexture.create_from_image(im)
	_svgs[s] = t
	return t


func _changeNom() -> void:
	nom.text = App.reglages.nom
	nom.visible = true
	nom.position = pilote.position + Vector2(pilote.size.x * 0.35, 6)
	nom.size = Vector2(pilote.size.x * 0.62, pilote.size.y - 12)
	nom.grab_focus()
	nom.select_all()


func _valideNom(t: String) -> void:
	t = t.strip_edges()
	if t != "": App.reglages.nom = t
	App.sauve()
	nom.visible = false
	pilote.libelle(str(App.reglages.nom).to_upper())
	pilote.grab_focus()


## La mise en page du jeu web, en pixels CSS : `k` les ramène à l'écran.
func _place() -> void:
	var portrait := size.x < size.y
	var m := {}
	if portrait:
		# @media (max-width:850px) : marges 16, logo de clamp(105, 23vh, 190) de haut, cartes de
		# clamp(68, 10vh, 92) espacées de 9, extras de 62, la barre du bas tout en bas
		var k := size.x / 390.0
		var H := size.y / k
		var W := 390.0
		var cw := minf(W - 32, 460.0)
		var x := (W - cw) / 2
		var y := maxf(10.0, H * 0.012)
		var lh := clampf(H * 0.23, 105, 190)
		m.logo = Rect2(16, y, W - 32, lh)
		y += lh + 10
		var hc := clampf(H * 0.10, 68, 92)
		var ecart := 9.0
		if modes.size() > 4:
			# cinq modes (le championnat) : des cartes un peu plus basses pour garder la barre du bas
			hc = clampf(H * 0.085, 56, 80)
			ecart = 8.0
		for i in modes.size():
			_pose(modes[i], Rect2(x, y, cw, hc), k, roundi(28 * k))      # mesuré : 28 px au téléphone
			y += hc + ecart
		y += 9 - 9 + 9
		var ne := extras.size()
		var ew := (cw - 7 * (ne - 1)) / ne
		for i in ne:
			_pose(extras[i], Rect2(x + i * (ew + 7), y, ew, 62), k, roundi(15 * k))
			(extras[i] as Carte).colonne = true
		m.version = Rect2(x, H - 10 - 11, cw, 11)
		var fy := H - 10 - 11 - 10 - 60
		m.pied = Rect2(x, fy, cw, 60)
		_pied(Rect2(x, fy, cw, 60), k, 18)
		m.k = k
	else:
		# PC (1440 × 900) : marges clamp(16, 3vh, 36) et 4vw, logo de min(54vw, 740), colonne de min(44vw, 540)
		var k2 := size.y / 900.0
		var H2 := 900.0
		var W2 := size.x / k2
		var pad := clampf(H2 * 0.03, 16, 36)
		var x2 := W2 * 0.04
		var lw := minf(W2 * 0.54, 740.0)
		var lh2 := minf(lw * logo.get_height() / logo.get_width(), H2 * 0.31)
		m.logo = Rect2(x2, pad, lw, lh2)
		var cw2 := minf(W2 * 0.44, 540.0)
		var y2 := pad + maxf(lh2, 181) + 12
		var hc2 := clampf(H2 * 0.105, 80, 116)
		for i in modes.size():
			_pose(modes[i], Rect2(x2, y2, cw2, hc2), k2, roundi(clampf(W2 * 0.027, 20, 39) * k2))
			y2 += hc2 + 12
		var ne2 := extras.size()
		var ew2 := (cw2 - 8 * (ne2 - 1)) / ne2
		for i in ne2:
			_pose(extras[i], Rect2(x2 + i * (ew2 + 8), y2, ew2, 54), k2, roundi(20 * k2))
			(extras[i] as Carte).colonne = false
		m.version = Rect2(x2, H2 - 12 - 13, cw2, 13)
		var fy2 := H2 - 12 - 13 - 12 - 68
		m.pied = Rect2(x2, fy2, cw2, 68)
		_pied(Rect2(x2, fy2, cw2, 68), k2, 21)
		m.k = k2
	m.portrait = portrait
	_m = m
	queue_redraw()


func _pose(b: Bouton, r: Rect2, k: float, taille: int) -> void:
	b.position = r.position * k
	b.size = r.size * k
	b.taille = taille
	(b as Carte).k = k
	b.queue_redraw()


## La barre du bas : Réglages | Pilote (et Quitter, sur ordinateur).
func _pied(r: Rect2, k: float, t: int) -> void:
	var rh := r.size.y - 8
	var icone := minf(rh * 0.62, 34.0)
	var ws := 14 + icone + 10 + Style.largeur(Textes.t("settingsWord"), roundi(t * k)) / k + 12
	var wq := (Style.largeur(Textes.t("quitWord"), roundi(t * k)) / k + 28) if quitter.visible else 0.0
	_pose(reglages, Rect2(r.position.x + 4, r.position.y + 4, ws, rh), k, roundi(t * k))
	_pose(pilote, Rect2(r.position.x + 4 + ws, r.position.y + 4, r.size.x - 8 - ws - wq - r.size.x * 0.03, rh), k, roundi(t * k))
	if quitter.visible: _pose(quitter, Rect2(r.end.x - wq - r.size.x * 0.03 - 4, r.position.y + 4, wq, rh), k, roundi(t * k))


func _draw() -> void:
	if _m.is_empty(): return
	var k: float = _m.k
	Style.couvre(self, fondPortrait if _m.portrait else fond, Rect2(Vector2.ZERO, size), 0.5)
	# le logo : centré au téléphone, à gauche sur ordinateur
	var lr: Rect2 = _m.logo
	var r := Rect2(lr.position * k, lr.size * k)
	var lw := minf(r.size.x, r.size.y * logo.get_width() / logo.get_height())
	var lh := lw * logo.get_height() / logo.get_width()
	var lx := r.position.x + ((r.size.x - lw) / 2 if _m.portrait else 0.0)
	draw_texture_rect(logo, Rect2(lx, r.position.y + (r.size.y - lh) / 2, lw, lh), false)
	# la barre du bas (polygon 1% 0, 97% 0, 100% 90%, 0 100%), sombre, liseré crème, le séparateur
	var p: Rect2 = _m.pied
	var pr := Rect2(p.position * k, p.size * k)
	var poly := PackedVector2Array([pr.position + Vector2(pr.size.x * 0.01, 0), pr.position + Vector2(pr.size.x * 0.97, 0),
		pr.position + Vector2(pr.size.x, pr.size.y * 0.9), pr.position + Vector2(0, pr.size.y)])
	draw_colored_polygon(poly, Color("#171c19f5"))
	draw_polyline(poly + PackedVector2Array([poly[0]]), Color("#f2e4c7"), 1.0 * k)
	var sx := reglages.position.x + reglages.size.x
	draw_line(Vector2(sx, pr.position.y + 8 * k), Vector2(sx, pr.end.y - 8 * k), Color("#f2e4c744"), 1.5 * k)
	if quitter.visible:
		var qx := quitter.position.x
		draw_line(Vector2(qx, pr.position.y + 8 * k), Vector2(qx, pr.end.y - 8 * k), Color("#f2e4c744"), 1.5 * k)
	# la version, en bas
	var v: Rect2 = _m.version
	Style.texte(self, Textes.t("proto", [Catalogue.circuits().size(), Catalogue.donnees.voitures.size()]),
		Vector2(v.position.x * k, v.end.y * k), roundi((9.0 if _m.portrait else 10.0) * k + 2), Color("#fff4da"))
