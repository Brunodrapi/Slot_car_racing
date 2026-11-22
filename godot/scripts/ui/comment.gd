## Comment jouer (js/ui.js, howtoScreen) : les trois gestes du jeu, chacun avec son titre numéroté, son
## animation tirée du jeu web et son texte. Au téléphone, un geste par écran, qu'on fait glisser du
## doigt, avec ses points et « Suivant » ; sur ordinateur, les trois côte à côte et « Jouer ». La page du
## jeu web mesurée sur un iPhone (390 de large) et sur un écran de 1440 × 900.
class_name CommentJouer
extends Control

const PAS := [["gaz", "Gas"], ["frein", "Brake"], ["levier", "Line"]]
const PAPIER := Color("#fff0d2")
const ENCRE := Color("#20251f")
const TEXTE := Color("#3a3f37")

var tel := false            # au doigt : les animations et les mots du tactile
var portrait := false       # la mise en page du téléphone
var cadre: Control          # la page, à l'échelle du jeu web
var rail: Control           # au téléphone : les fiches, qui glissent de côté
var fiches: Control
var anims: Array = []
var page := 0.0             # la fiche affichée (entre deux pendant un glissé)
var cible := 0
var retour: Bouton
var suivant: Bouton
var fondPaddock: Texture2D
var L := {}                 # la mise en page, relue par le dessin
var defile := 0.0
var hauteur := 0.0
var _doigt := {}
var _tween: Tween


## Une animation du jeu web : ses images en WebP, à la suite ; seule celle qu'on montre est décodée.
class Anim:
	var meta: Dictionary
	var blob: PackedByteArray
	var debuts := PackedInt32Array()
	var tex: ImageTexture
	var image := -1
	var t := 0.0
	var total := 0.0

	func _init(nom: String) -> void:
		meta = JSON.parse_string(FileAccess.get_file_as_string("res://donnees/comment-jouer/%s.json" % nom))
		blob = FileAccess.get_file_as_bytes("res://donnees/comment-jouer/%s.bin" % nom)
		var a := 0
		for n in meta.tailles:
			debuts.append(a)
			a += int(n)
		for d in meta.durees: total += float(d) / 1000.0
		montre(0)

	func montre(i: int) -> void:
		if i == image: return
		image = i
		var im := Image.new()
		im.load_webp_from_buffer(blob.slice(debuts[i], debuts[i] + int(meta.tailles[i])))
		if tex == null: tex = ImageTexture.create_from_image(im)
		else: tex.update(im)

	func avance(dt: float) -> bool:
		t = fmod(t + dt, total)
		var s := 0.0
		for i in (meta.durees as Array).size():
			s += float(meta.durees[i]) / 1000.0
			if t < s:
				var change := i != image
				montre(i)
				return change
		return false


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	tel = Style.tactile()
	fondPaddock = load("res://images/interface/paddock.webp")
	var genre := "tactile" if tel else "clavier"
	var lang := "en" if Textes.langue() == "en" else "fr"
	for p in PAS: anims.append(Anim.new("%s-%s-%s" % [genre, p[0], lang]))
	cadre = Control.new()
	cadre.draw.connect(_dessine)
	add_child(cadre)
	rail = Control.new()
	rail.clip_contents = true
	rail.mouse_filter = Control.MOUSE_FILTER_PASS
	cadre.add_child(rail)
	fiches = Control.new()
	fiches.mouse_filter = Control.MOUSE_FILTER_PASS
	fiches.draw.connect(_dessineFiches)
	rail.add_child(fiches)
	retour = Bouton.new("", Color(0, 0, 0, 0), BarreTitre.TEXTE, 14)
	retour.coupe = 0
	retour.pressed.connect(func(): App.aller("accueil"))
	cadre.add_child(retour)
	suivant = Bouton.new("", Color("#d22620"), Color("#fff2da"), 26)
	suivant.centre = true
	suivant.pressed.connect(_suivant)
	cadre.add_child(suivant)
	resized.connect(_place)
	_place()
	if not tel: suivant.grab_focus.call_deferred()


func _unhandled_input(e: InputEvent) -> void:
	if e.is_action_pressed("ui_cancel"): App.aller("accueil")
	elif portrait and e.is_action_pressed("ui_right"): _va(cible + 1)
	elif portrait and e.is_action_pressed("ui_left"): _va(cible - 1)


func _process(dt: float) -> void:
	for i in anims.size():
		# au téléphone, seule la fiche à l'écran s'anime
		if portrait and absf(page - i) >= 1.0: continue
		if anims[i].avance(dt): fiches.queue_redraw()


## « Suivant » passe à la fiche d'après ; à la dernière, et sur ordinateur, on part courir (js/ui.js,
## howtoNext : la course rapide).
func _suivant() -> void:
	if portrait and cible < PAS.size() - 1: _va(cible + 1)
	else: App.aller("paddock", { mode = "race" })


func _va(i: int) -> void:
	cible = clampi(i, 0, PAS.size() - 1)
	if _tween: _tween.kill()
	_tween = create_tween()
	_tween.tween_method(_posePage, page, float(cible), 0.3).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_majSuivant()


func _posePage(p: float) -> void:
	page = clampf(p, -0.15, PAS.size() - 0.85)
	fiches.position.x = -page * float(L.get("fiche", 362.0))
	cadre.queue_redraw()


func _majSuivant() -> void:
	var dernier := not portrait or cible >= PAS.size() - 1
	var t := Textes.t("howPlay" if dernier else "howNext").to_upper()
	suivant.libelle(t)
	if portrait:
		var w := maxf(150.0, Style.largeur(t, 26) + 56)
		suivant.size = Vector2(w, 51)
		suivant.position.x = 376 - w


# ---------- la mise en page ----------
func _place() -> void:
	portrait = size.x < size.y
	if portrait: _placeTel()
	else: _placePC()
	_posePage(page)
	_majSuivant()
	queue_redraw()
	cadre.queue_redraw()
	fiches.queue_redraw()


## Les lignes d'un texte coupé à la largeur.
static func lignes(t: String, taille: int, largeur: float) -> PackedStringArray:
	return Paddock._lignes(t, taille, largeur)


func _placeTel() -> void:
	var k := size.x / 390.0
	var vh := size.y / k
	cadre.scale = Vector2(k, k)
	cadre.position = Vector2(0, -defile * k)
	retour.position = Vector2(14, 12)
	retour.size = Vector2(73, 64)
	retour.taille = 14
	retour.dessinPlus = BarreTitre.retourTel.bind(retour)
	var f := "Touch" if tel else "Keys"
	L.intro = lignes(Textes.t("howIntro" + f), 15, 334)
	L.yIntro = 86.0
	var hi := 14 + 18.0 * (L.intro as PackedStringArray).size()
	var yr := 86 + hi + 10
	# l'animation se règle sur la hauteur de l'écran (37 vh), comme le jeu web
	var a: Anim = anims[0]
	var ratio := float(a.meta.largeur) / float(a.meta.hauteur)
	var fw := minf(334.0, 0.37 * vh * ratio)
	var ih := (fw - 4) / ratio
	L.fiche = 362.0
	L.titres = []
	L.textes = []
	var hmax := 0.0
	for i in PAS.size():
		var tt := lignes(Textes.t("how%sTitle%s" % [PAS[i][1], f]).to_upper(), 22, 286)
		var tx := lignes(Textes.t("how%s%s" % [PAS[i][1], f]), 15, 334)
		L.titres.append(tt)
		L.textes.append(tx)
		hmax = maxf(hmax, 12 + maxf(38.0, 23.1 * tt.size()) + 10 + ih + 4 + 10 + 19.5 * tx.size() + 16)
	L.fig = Vector2(fw, ih + 4)
	L.hFiche = hmax
	rail.position = Vector2(14, yr)
	rail.size = Vector2(362, hmax)
	fiches.size = Vector2(362 * PAS.size(), hmax)
	var yn := yr + hmax + 10
	L.yNav = yn
	suivant.position = Vector2(226, yn)
	suivant.size = Vector2(150, 51)
	suivant.taille = 26
	suivant.coupe = 9
	hauteur = yn + 51 + 20
	cadre.size = Vector2(390, hauteur)
	defile = clampf(defile, 0, maxf(0, hauteur - vh))
	cadre.position.y = -defile * k


func _placePC() -> void:
	var k := minf(size.x / 1440.0, size.y / 900.0)
	cadre.scale = Vector2(k, k)
	cadre.size = Vector2(1440, 900)
	cadre.position = Vector2((size.x - 1440 * k) / 2, (size.y - 900 * k) / 2)
	defile = 0.0
	retour.position = Vector2(20, 12)
	retour.size = Vector2(119, 65)
	retour.taille = 22
	retour.dessinPlus = BarreTitre.retourPC.bind(retour)
	var f := "Touch" if tel else "Keys"
	L.intro = lignes(Textes.t("howIntro" + f), 26, 1364)
	L.yIntro = 93.0
	var hi := 20 + 31.0 * (L.intro as PackedStringArray).size()
	var ys := 93 + hi + 16
	var a: Anim = anims[0]
	var ih := 419.0 * float(a.meta.hauteur) / float(a.meta.largeur)
	L.fig = Vector2(423, ih + 4)
	L.fiche = 473.0
	L.titres = []
	L.textes = []
	var hmax := 0.0
	for i in PAS.size():
		var tt := lignes(Textes.t("how%sTitle%s" % [PAS[i][1], f]).to_upper(), 28, 375)
		var tx := lignes(Textes.t("how%s%s" % [PAS[i][1], f]), 17, 423)
		L.titres.append(tt)
		L.textes.append(tx)
		hmax = maxf(hmax, 14 + maxf(38.0, 29.4 * tt.size()) + 10 + ih + 4 + 10 + 22.95 * tx.size() + 18)
	L.hFiche = hmax
	rail.position = Vector2(20, ys)
	rail.size = Vector2(1400 + 10, hmax + 10)       # l'ombre des fiches déborde
	fiches.size = rail.size
	page = 0.0
	var yn := ys + hmax + 16
	L.yNav = yn
	var t := Textes.t("howPlay").to_upper()
	var w := maxf(200.0, Style.largeur(t, 34) + 76)
	suivant.position = Vector2(1420 - w, yn)
	suivant.size = Vector2(w, 67)
	suivant.taille = 34
	suivant.coupe = w * 0.06


# ---------- le dessin ----------
func _draw() -> void:
	# au téléphone, du papier ; sur ordinateur, le paddock derrière (css/style.css, .selection-screen)
	if size.x < size.y: draw_rect(Rect2(Vector2.ZERO, size), Paddock.T_FOND)
	else:
		draw_rect(Rect2(Vector2.ZERO, size), Color("#202822"))
		Style.couvre(self, fondPaddock, Rect2(Vector2.ZERO, size), 0.5)


func _dessine() -> void:
	var ci := cadre
	if portrait:
		BarreTitre.tel(ci, Rect2(14, 12, 362, 64), Textes.t("howTitle").to_upper())
		_intro(ci, Rect2(14, L.yIntro, 362, 14 + 18.0 * (L.intro as PackedStringArray).size()), 15, 18.0, Vector2(14, 7))
		# les points : la fiche affichée en rouge
		for i in PAS.size():
			var x := 14.0 + i * 20
			var y := float(L.yNav) + 19.5
			var pts := PackedVector2Array([Vector2(x + 2.5, y + 1), Vector2(x + 12.5, y + 1), Vector2(x + 9.5, y + 11), Vector2(x - 0.5, y + 11)])
			ci.draw_colored_polygon(pts, Color("#c82520") if i == cible else Color("#cbbd9f"))
			var bord := pts.duplicate()
			bord.append(pts[0])
			ci.draw_polyline(bord, ENCRE, 2.0, true)
	else:
		BarreTitre.pc(ci, Rect2(20, 12, 1400, 65), Textes.t("howTitle").to_upper())
		_intro(ci, Rect2(20, L.yIntro, 1400, 20 + 31.0 * (L.intro as PackedStringArray).size()), 26, 31.0, Vector2(18, 10))


## La phrase d'introduction, sur son papier bordé d'encre, le bord droit à peine penché.
func _intro(ci: CanvasItem, r: Rect2, taille: int, lh: float, pad: Vector2) -> void:
	var pts := PackedVector2Array([r.position, Vector2(r.end.x, r.position.y), Vector2(r.position.x + r.size.x * 0.99, r.end.y), Vector2(r.position.x, r.end.y)])
	ci.draw_colored_polygon(pts, PAPIER)
	var bord := pts.duplicate()
	bord.append(pts[0])
	ci.draw_polyline(bord, ENCRE, 2.0, true)
	var l: PackedStringArray = L.intro
	for i in l.size():
		Style.texte(ci, l[i], Vector2(r.position.x + pad.x, r.position.y + pad.y + lh * i + lh / 2 + taille * 0.375), taille, Color("#272b28"))


func _dessineFiches() -> void:
	var ci := fiches
	var w := 362.0 if portrait else 455.0
	for i in PAS.size():
		var x := i * float(L.fiche)
		var r := Rect2(x, 0, w, L.hFiche)
		if not portrait: ci.draw_rect(Rect2(r.position + Vector2(5, 6), r.size), Color(0.09, 0.106, 0.098, 0.33))
		ci.draw_rect(r, PAPIER)
		ci.draw_rect(r.grow(-1), ENCRE, false, 2)
		var px := x + (14.0 if portrait else 16.0)
		var y := 12.0 if portrait else 14.0
		var cw := w - (28.0 if portrait else 32.0)
		# le numéro, sur son biseau rouge, et le titre
		var tt: PackedStringArray = L.titres[i]
		var tl := 22 if portrait else 28
		var lh := 23.1 if portrait else 29.4
		var ht := maxf(38.0, lh * tt.size())
		var yn := y + (ht - 38) / 2
		ci.draw_colored_polygon(PackedVector2Array([Vector2(px + 6.84, yn), Vector2(px + 38, yn), Vector2(px + 31.16, yn + 38), Vector2(px, yn + 38)]), Color("#c82520"))
		Style.texte(ci, str(i + 1), Vector2(px, yn + 19 + 9), 24, BarreTitre.TEXTE, HORIZONTAL_ALIGNMENT_CENTER, 38)
		var yt := y + (ht - lh * tt.size()) / 2
		for j in tt.size():
			BarreTitre.texteFleches(ci, tt[j], Vector2(px + 48, yt + lh * j + lh / 2 + tl * 0.375), tl, ENCRE)
		y += ht + 10
		# l'animation, dans son cadre d'encre
		var fig: Vector2 = L.fig
		var fx := px + (cw - fig.x) / 2
		ci.draw_rect(Rect2(fx, y, fig.x, fig.y), Color("#171b19"))
		ci.draw_rect(Rect2(fx + 1, y + 1, fig.x - 2, fig.y - 2), ENCRE, false, 2)
		var a: Anim = anims[i]
		ci.draw_texture_rect(a.tex, Rect2(fx + 2, y + 2, fig.x - 4, fig.y - 4), false)
		y += fig.y + 10
		# le texte
		var tx: PackedStringArray = L.textes[i]
		var ts := 15 if portrait else 17
		var tlh := 19.5 if portrait else 22.95
		for j in tx.size():
			Style.texte(ci, tx[j], Vector2(px, y + tlh * j + tlh / 2 + ts * 0.375), ts, TEXTE)


# ---------- au doigt : les fiches glissent de côté et s'aimantent ----------
func _input(e: InputEvent) -> void:
	if not portrait: return
	var k := cadre.scale.x
	if e is InputEventScreenTouch and e.index == 0:
		if e.pressed:
			_doigt = { actif = true, depart = e.position, axe = "", sur = _surRail(e.position), v = 0.0, t = Time.get_ticks_usec() }
			if _tween: _tween.kill()
		elif _doigt.get("actif", false):
			_doigt.actif = false
			if _doigt.axe == "x":
				# un coup sec passe à la fiche voisine, sinon la plus proche
				var v: float = _doigt.v
				var p := roundi(page)
				if absf(v) > 400: p = int(floor(page)) + (1 if v > 0 else 0)
				_va(p)
	elif e is InputEventScreenDrag and e.index == 0 and _doigt.get("actif", false):
		var d: Vector2 = e.position - _doigt.depart
		if _doigt.axe == "":
			if d.length() < 8.0 * k: return
			_doigt.axe = "x" if absf(d.x) > absf(d.y) and _doigt.sur else "y"
		var maintenant := Time.get_ticks_usec()
		var dt := maxf(0.004, (maintenant - int(_doigt.t)) / 1e6)
		_doigt.t = maintenant
		if _doigt.axe == "x":
			var pas: float = -e.relative.x / k
			_doigt.v = lerpf(float(_doigt.v), pas / dt, 0.6)
			_posePage(page + pas / float(L.fiche))
			var c := clampi(roundi(page), 0, PAS.size() - 1)
			if c != cible:
				cible = c
				_majSuivant()
		else:
			var vh := size.y / k
			defile = clampf(defile - e.relative.y / k, 0, maxf(0, hauteur - vh))
			cadre.position.y = -defile * k


func _surRail(p: Vector2) -> bool:
	var t := rail.get_global_transform()
	return Rect2(t.origin, rail.size * t.get_scale()).has_point(p)
