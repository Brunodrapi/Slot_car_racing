## Le paddock (js/ui.js, l'écran de préparation) : la catégorie, la voiture et sa livrée, ses
## caractéristiques, le circuit, la difficulté et le nombre de tours. Sur ordinateur (paysage), la page
## du jeu web sur un écran de PC, mesurée bloc par bloc (cadre de 1564 × 990, ramené à l'écran) ; au
## téléphone (portrait), la page du jeu web sur un iPhone, à la même taille, qui défile.
class_name Paddock
extends Control

const DIFFICULTES := [["easy", "easy"], ["medium", "medium"], ["hard", "hard"], ["extreme", "extreme"], ["cauchemar", "cauchemar"]]

var mode := "race"
var cadre: Control
var portrait := false
var filtre := "tous"
var debutVoitures := 0
var debutCircuits := 0
var fondPaddock: Texture2D
var infoCircuits := {}     # id -> { nom, pays, longueur, tours, contour }
var defile := 0.0
var hauteur := 720.0
# La mise en page, calculée par _construit et relue par le dessin : le panneau du circuit (à droite en
# paysage, sous la voiture et sur toute la largeur en portrait) et la première ligne de la barre du bas.
var carte := Rect2(790, 92, 468, 392)
var liste := Rect2(790, 494, 468, 300)      # sous le circuit : les temps (ou le palmarès) de toute la catégorie
var barre: Control                          # la barre du bas, fixe : « En piste » reste à portée du doigt
var _haut := 0.0
# --- sur ordinateur : la page du jeu web à 2000 × 1000, mesurée (setupScreen et style.css)
const PC_W := 1564.0
const PC_H := 990.0
const PC_CREME := Color("#fff0d2")
const PC_FEUILLE := Color("#f8ebce")
const PC_VERT := Color("#21b56f")
const PC_ROUGE := Color("#c82520")
const PC_ONGLET := Color("#bb2b26")
const PC_TRAIT := Color("#252b24")
const PC_BORD := Color("#b4a68b")
const PC_ENCRE := Color("#262c26")
const PC_MUET := Color("#5f6158")
const CATS := { f1 = "#ff6b5b", gt = "#5bb8ff", gt3 = "#ffba59", proto = "#5be07a" }
const LISTE := "\u0001"                      # une valeur qui est une liste : la petite flèche est dessinée (la police web ne l'a pas)
const PC_LIGNE := 79.0                      # une ligne de la liste (80 de haut, 6 d'écart)
var listeVue: Control                       # la liste de la catégorie, qui défile seule, avec sa barre
var listeDefile := 0.0
var listeContenu := 0.0
var _tientBarre := false
var _railLibre := false                     # le joueur a fait défiler les voitures lui-même
var _railCLibre := false


func _init(m: String) -> void:
	mode = m


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	fondPaddock = load("res://images/interface/paddock.webp")
	infoCircuits = Paddock.infosCircuits()
	if Catalogue.voiture(App.reglages.voiture).is_empty(): App.reglages.voiture = "porsche991gt3r"
	filtre = App.reglages.cat
	Paddock.precharge()
	cadre = Control.new()
	cadre.draw.connect(_dessine)
	add_child(cadre)
	doigt = Doigt.new(cadre, _defile)
	rails = doigt.rails
	railX = doigt.railX
	barre = Control.new()
	barre.draw.connect(_dessineBarre)
	add_child(barre)
	resized.connect(_construit)
	# le tableau mondial arrive après l'écran, et la connexion revient du navigateur : on repeint
	Mondial.change.connect(_construit)
	get_viewport().gui_focus_changed.connect(_montre)
	App.prepareDemarrage()
	_construit()


static var _infos := {}


## Le nom, le pays, la longueur, les tours, le contour et l'image de chaque circuit, lus une fois
## (le paddock et le salon du multijoueur s'en servent).
static func infosCircuits() -> Dictionary:
	if not _infos.is_empty(): return _infos
	for c in Catalogue.circuits():
		var meta: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://donnees/circuits/%s.json" % c.id))
		var sc: Array = meta.index.scalaires
		var blob := FileAccess.get_file_as_bytes("res://donnees/circuits/%s.bin" % c.id).to_float64_array()
		var n := int(blob[int(sc[0])])
		var xs := blob.slice(int(meta.index.xs[0]), int(meta.index.xs[0]) + n)
		var ys := blob.slice(int(meta.index.ys[0]), int(meta.index.ys[0]) + n)
		var contour := PackedVector2Array()
		for i in range(0, n, 8): contour.append(Vector2(xs[i], ys[i]))
		contour.append(contour[0])
		_infos[c.id] = { nom = c.nom, pays = meta.pays, longueur = blob[int(sc[0]) + 2], tours = int(meta.tours), contour = contour, bornes = meta.bornes,
			image = load("res://images/interface/circuits/%s.webp" % c.id) }
	return _infos


## Tout ce qui se dessine est chargé avant le premier dessin.
static func precharge() -> void:
	Style.tex("res://images/interface/logo-slotless.webp")
	for v in Catalogue.donnees.voitures:
		for i in (v.livrees as Array).size():
			var d := Catalogue.dessin(v.id, i)
			if d.get("vignette"): Style.tex("res://images/vignettes/" + d.vignette)
	var infos := Paddock.infosCircuits()
	for c in Catalogue.circuits(): Style.drapeau(infos[c.id].pays)


func _input(e: InputEvent) -> void:
	if e is InputEventMouseButton and e.pressed and (e.button_index == MOUSE_BUTTON_WHEEL_DOWN or e.button_index == MOUSE_BUTTON_WHEEL_UP):
		_defile(60.0 if e.button_index == MOUSE_BUTTON_WHEEL_DOWN else -60.0)
	elif portrait:
		doigt.entree(e)


## La manette (stick droit) et le clavier (page précédente, page suivante) font aussi défiler ;
## un bouton qui prend le focus hors de l'écran est ramené dans la vue. Au téléphone, la page ou le
## rail lâché file encore un peu, comme une page de Safari.
func _process(dt: float) -> void:
	var a := Input.get_joy_axis(0, JOY_AXIS_RIGHT_Y)
	if absf(a) > 0.25:
		# sur ordinateur, la page ne défile pas : c'est la liste de la catégorie
		if not portrait and listeVue: _defileListe(a * 900.0 * dt)
		else: _defile(a * 900.0 * dt)
	if portrait: doigt.avance(dt)


func _montre(c: Control) -> void:
	if c == null or not cadre.is_ancestor_of(c): return
	# seulement au clavier et à la manette : une carte touchée du doigt ou cliquée ne fait pas sauter la page
	if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) or doigt.actif(): return
	# une carte d'un rail : le rail se pousse pour la montrer
	doigt.montre(c)
	var k := cadre.scale.y
	var vue := (size.y - barre.size.y * k * float(barre.visible)) / k          # ce qu'on voit du cadre, au-dessus de la barre
	var haut := (cadre.get_global_transform().affine_inverse() * c.get_global_transform().origin).y
	if haut < defile + 10: _defile(haut - 10 - defile)
	elif haut + c.size.y > defile + vue - 10: _defile(haut + c.size.y - (defile + vue - 10))


func _defile(d: float) -> void:
	var k := cadre.scale.y
	defile = clampf(defile + d, 0, maxf(0, hauteur - (size.y - _haut) / k))
	cadre.position.y = _haut - defile * k


func _unhandled_input(e: InputEvent) -> void:
	if e.is_action_pressed("ui_cancel"):
		App.aller("accueil")
	elif e is InputEventKey and e.pressed and (e.keycode == KEY_PAGEDOWN or e.keycode == KEY_PAGEUP):
		_defile(400.0 if e.keycode == KEY_PAGEDOWN else -400.0)


# ---------- la construction des boutons ----------
func _bouton(t: String, r: Rect2, f: Color, e: Color, taille: int, action: Callable, parent: Control = null) -> Bouton:
	var b := Bouton.new(t, f, e, taille)
	b.position = r.position
	b.size = r.size
	b.pressed.connect(action)
	(parent if parent else cadre).add_child(b)
	return b


func _construit() -> void:
	var focus := get_viewport().gui_get_focus_owner() if is_inside_tree() else null
	var cle: String = focus.get_meta("cle", "") if focus else ""
	# la liste de la catégorie (sur ordinateur) reste : elle garde sa place dans le défilement
	for c in cadre.get_children():
		if c != listeVue: c.queue_free()
	for c in barre.get_children(): c.queue_free()
	portrait = size.x < size.y
	if portrait: _construitTel(cle)
	else: _construitPC(cle)


static func _nom(liste: Array, id: String) -> String:
	for e in liste:
		if e[0] == id: return Textes.t(e[1])
	return Textes.t(liste[0][1])


static func _suivant(liste: Array, id: String) -> String:
	for i in liste.size():
		if liste[i][0] == id: return liste[(i + 1) % liste.size()][0]
	return liste[0][0]


func _choisitVoiture(id: String) -> void:
	if id != App.reglages.voiture: railX.erase("livrees")
	App.reglages.voiture = id
	App.reglages.cat = Catalogue.voiture(id).cat
	App.reglages.livree = 0
	# la voiture de chaque catégorie est retenue (js/ui.js, playerModelFor)
	if not App.reglages.has("voituresCat"): App.reglages.voituresCat = {}
	App.reglages.voituresCat[App.reglages.cat] = id
	App.sauve()
	_construit()


## Un onglet de catégorie (js/ui.js, pickCat) : F1, GT, GT3 ou PROTO change aussi de voiture — celle
## qu'on avait prise dans cette catégorie, sinon la première ; « Toutes » garde la voiture.
func _choisitCategorie(id: String) -> void:
	filtre = id
	debutVoitures = 0
	_railLibre = false
	railX.erase("voitures")          # au téléphone, le rail se recentre sur la voiture de la catégorie
	railX.erase("livrees")
	if id != "tous":
		var liste := Catalogue.voituresDe(id)
		var retenue := String(App.reglages.get("voituresCat", {}).get(id, ""))
		var vid: String = String(liste[0].id) if liste.size() else String(App.reglages.voiture)
		for v in liste:
			if v.id == retenue: vid = retenue
		if vid != App.reglages.voiture:
			App.reglages.voiture = vid
			App.reglages.livree = 0
		App.reglages.cat = id
	App.sauve()
	_construit()


## « Régler » (js/ui.js, startTune) : en piste en mode réglage, le levier du frein en haut de l'écran.
func _regler() -> void:
	App.reglages.mode = mode
	App.sauve()
	App.demarre()
	App.aller("course", { reglage = true })


func _enPiste() -> void:
	App.reglages.mode = mode
	App.sauve()
	App.demarre()          # le moteur démarre
	if mode == "race": App.lanceCourseRapide()
	else: App.aller("course")


# ---------- le dessin ----------
## Le fond du menu : l'image du paddock sur tout l'écran, comme le jeu web (#ui, center / cover).
func _draw() -> void:
	# au téléphone, du papier ; le paddock n'est que derrière la voiture (css/style.css, 0.39)
	if size.x < size.y: draw_rect(Rect2(Vector2.ZERO, size), T_FOND)
	else: Style.couvre(self, fondPaddock, Rect2(Vector2.ZERO, size), 0.5)


func _dessine() -> void:
	if portrait: _dessineTel()
	else: _dessinePC()


## Le pays et la longueur du circuit ; en course, le nombre de tours (le contre-la-montre et
## l'entraînement n'en ont pas, comme le jeu web).
static func infoPiste(info: Dictionary, race: bool) -> String:
	if race: return Textes.t("trackInfo", [Textes.pays(info.pays).to_upper(), roundi(info.longueur), int(App.reglages.tours)])
	return Textes.t("trackInfoSeul", [Textes.pays(info.pays).to_upper(), roundi(info.longueur)])


## Le tracé d'un circuit (js/ui.js, thumb) : noir sur un liseré crème, et le point rouge du départ.
static func _contour(ci: CanvasItem, info: Dictionary, r: Rect2, petit := false, ep := -1.0, ombre := false) -> void:
	var b: Dictionary = info.bornes
	var w: float = b.maxX - b.minX
	var h: float = b.maxY - b.minY
	var k := minf(r.size.x / w, r.size.y / h)
	var o := r.position + (r.size - Vector2(w, h) * k) / 2
	var pts := PackedVector2Array()
	for p in info.contour: pts.append(o + (p - Vector2(b.minX, b.minY)) * k)
	var noir := ep if ep > 0 else (2.5 if petit else 6.0)
	var creme := noir + (1.8 if petit else 3.0) if ep > 0 else (5.0 if petit else 12.0)
	# l'ombre portée du tracé (drop-shadow 2px 4px du jeu web)
	if ombre:
		var dec := PackedVector2Array()
		for p in pts: dec.append(p + Vector2(2, 4))
		ci.draw_polyline(dec, Color(0.09, 0.11, 0.1, 0.33), creme, true)
	ci.draw_polyline(pts, Color("#fff0cd"), creme, true)
	ci.draw_polyline(pts, Color("#171c19"), noir, true)
	if pts.size(): ci.draw_circle(pts[0], noir * 0.3 if ep > 0 else (2.5 if petit else 5.0), Color("#c72d24"))


func _record(circuit: String, voiture: String) -> float:
	var recs: Dictionary = App.reglages.get("records", {})
	return float(recs.get(circuit + "/" + voiture, -1.0))


static func _carteVoiture(b: Bouton) -> void:
	var c: Dictionary = b.get_meta("voiture")
	var d := Catalogue.dessin(c.id, 0)
	if d.get("vignette"):
		var tex := Style.tex("res://images/vignettes/" + d.vignette)
		var w := b.size.x - 30
		var h := w * tex.get_height() / tex.get_width()
		b.draw_texture_rect(tex, Rect2(15, 6, w, h), false)
	var chip := str(c.cat).to_upper()
	var cw := Style.largeur(chip, 13) + 14
	var couleur: Color = { f1 = Color("#e86a5a"), gt = Color("#5aa8e8"), gt3 = Color("#5ac58a"), proto = Color("#c08ae8") }.get(c.cat, Style.GRIS)
	b.draw_rect(Rect2((b.size.x - cw) / 2, b.size.y - 24, cw, 18), couleur)
	Style.texte(b, chip, Vector2(0, b.size.y - 10), 13, Style.ENCRE, HORIZONTAL_ALIGNMENT_CENTER, b.size.x)


static func _carteCircuit(b: Bouton) -> void:
	var info: Dictionary = Paddock.infosCircuits()[b.get_meta("circuit")]
	var ir := Rect2(6, 6, b.size.x - 12, 76)
	Style.couvre(b, info.image, ir, 0.5)
	Paddock._contour(b, info, ir.grow(-10), true)
	var dr := Style.drapeau(info.pays)
	if dr: b.draw_texture_rect(dr, Rect2(20, b.size.y - 30, 22, 15), false)
	Style.texte(b, "%d m" % roundi(info.longueur), Vector2(48, b.size.y - 17), 15, Style.ENCRE)


# =====================================================================================================
# SUR ORDINATEUR : la page du jeu web, à l'identique (js/ui.js setupScreen, css/style.css), mesurée sur
# un écran de 2000 × 1000 : la colonne de la voiture (939 de large) et la feuille du circuit (603), la
# barre des réglages en bas. La page ne défile pas ; la liste de la catégorie défile seule, avec sa barre.
# =====================================================================================================
func _construitPC(cle: String) -> void:
	var k := minf(size.x / PC_W, size.y / PC_H)
	cadre.scale = Vector2(k, k)
	cadre.size = Vector2(PC_W, PC_H)
	cadre.position = Vector2((size.x - PC_W * k) / 2, (size.y - PC_H * k) / 2)
	barre.visible = false
	hauteur = PC_H
	defile = 0.0
	_haut = 0.0
	carte = Rect2(960, 89, 603, 819)
	liste = Rect2(970, 576, 586, 328)
	var race := mode == "race"
	# La barre du haut : le retour
	var br := _bouton("‹ " + Textes.t("backWord"), Rect2(0, 10, 112, 65), Style.NUIT_PLEINE, PC_CREME, 22, func(): App.aller("accueil"))
	br.coupe = 0
	br.centre = true
	br.set_meta("cle", "retour")
	# Les onglets de catégorie
	var onglets := [["tous", Textes.t("all")]]
	for c in Catalogue.categories(): onglets.append([c.id, Textes.nom(c.nom).to_upper()])
	var x := 12.0
	for o in onglets:
		var w := Style.largeur(o[1], 22) + 30
		var b := _bouton(o[1], Rect2(x, 92, w, 44), PC_ONGLET if filtre == o[0] else Style.NUIT_PLEINE, PC_CREME, 22, func(): _choisitCategorie(o[0]))
		b.centre = true
		b.set_meta("cle", "onglet-" + o[0])
		x += w + 6
	# Les livrées
	var v := Catalogue.voiture(App.reglages.voiture)
	var livrees: Array = v.livrees
	var n := maxi(1, livrees.size())
	var lw := (939.0 - 16 - 8 * (n - 1)) / n
	for i in livrees.size():
		var d := Catalogue.dessin(v.id, i)
		var b := _bouton(Textes.livree(livrees[i]).to_upper(), Rect2(8 + i * (lw + 8), 579, lw, 98), Style.NUIT_PLEINE, PC_CREME, 16,
			func(): App.reglages.livree = i; App.sauve(); _construit())
		b.coupe = 0
		b.centre = true
		b.ligne = 88
		b.set_meta("cle", "livree-%d" % i)
		b.set_meta("vignette", d.get("vignette"))
		b.set_meta("sel", int(App.reglages.livree) % n == i)
		b.dessinPlus = Paddock._livreePC.bind(b)
	# Le rail des voitures : cinq cartes, la voiture choisie en vue tant qu'on n'a pas fait défiler
	var rail: Array = Catalogue.donnees.voitures.filter(func(c): return filtre == "tous" or c.cat == filtre)
	var visibles := 5
	if not _railLibre:
		for i in rail.size():
			if rail[i].id == v.id: debutVoitures = i - 2
	debutVoitures = clampi(debutVoitures, 0, maxi(0, rail.size() - visibles))
	var fg := _bouton("‹", Rect2(4, 814, 32, 52), Style.NUIT_PLEINE, PC_CREME, 30, func(): debutVoitures -= visibles; _railLibre = true; _construit())
	fg.set_meta("cle", "v-gauche")
	var fd := _bouton("›", Rect2(903, 814, 32, 52), Style.NUIT_PLEINE, PC_CREME, 30, func(): debutVoitures += visibles; _railLibre = true; _construit())
	fd.set_meta("cle", "v-droite")
	for i in mini(visibles, rail.size() - debutVoitures):
		var c: Dictionary = rail[debutVoitures + i]
		var b := _bouton(str(c.nom).to_upper(), Rect2(66 + i * 162, 770, 152, 131), PC_CREME, PC_ENCRE, 17, func(): _choisitVoiture(c.id))
		b.coupe = 0
		b.centre = true
		b.ligne = 84
		b.set_meta("cle", "voiture-" + c.id)
		b.set_meta("voiture", c)
		b.set_meta("sel", c.id == v.id)
		b.dessinPlus = Paddock._carteVoiturePC.bind(b, filtre == "tous")
	# Le rail des circuits : quatre cartes encadrées
	var circuits := Catalogue.circuits()
	var nc := 4
	if not _railCLibre:
		for i in circuits.size():
			if circuits[i].id == App.reglages.circuit: debutCircuits = i - 1
	debutCircuits = clampi(debutCircuits, 0, maxi(0, circuits.size() - nc))
	var cg := _bouton("‹", Rect2(972, 468, 28, 50), Style.NUIT_PLEINE, PC_CREME, 28, func(): debutCircuits -= nc; _railCLibre = true; _construit())
	cg.set_meta("cle", "c-gauche")
	var cd := _bouton("›", Rect2(1524, 468, 28, 50), Style.NUIT_PLEINE, PC_CREME, 28, func(): debutCircuits += nc; _railCLibre = true; _construit())
	cd.set_meta("cle", "c-droite")
	for i in mini(nc, circuits.size() - debutCircuits):
		var c: Dictionary = circuits[debutCircuits + i]
		var b := _bouton(str(c.nom).to_upper(), Rect2(1006 + i * 128, 432, 120, 121), PC_CREME, PC_ENCRE, 16,
			func(): App.reglages.circuit = c.id; App.reglages.tours = infoCircuits[c.id].tours; App.sauve(); _construit())
		b.coupe = 0
		b.centre = true
		b.ligne = 94
		b.set_meta("cle", "circuit-" + c.id)
		b.set_meta("circuit", c.id)
		b.set_meta("sel", c.id == App.reglages.circuit)
		b.dessinPlus = Paddock._carteCircuitPC.bind(b)
	# Se connecter avec Google : à droite de l'en-tête de la liste
	if Mondial.connexionPossible() and (Mondial.enCours or not Mondial.connecte()):
		var txt := Textes.t("signInCancel") if Mondial.enCours else Textes.t("signIn")
		var lb := Style.largeur(txt, 13) + 22
		var bg := _bouton(txt, Rect2(liste.end.x - lb - 10, liste.position.y - 2, lb, 26), Style.NUIT_PLEINE, PC_CREME, 13,
			func(): (Mondial.annuler() if Mondial.enCours else Mondial.entrer()))
		bg.coupe = 0
		bg.centre = true
		bg.set_meta("cle", "google")
	# La liste de la catégorie : sa propre vue, qui défile
	if listeVue == null:
		listeVue = Control.new()
		listeVue.clip_contents = true
		listeVue.mouse_filter = Control.MOUSE_FILTER_STOP
		listeVue.draw.connect(_dessineListePC)
		listeVue.gui_input.connect(_entreeListe)
	if listeVue.get_parent() != cadre:
		if listeVue.get_parent(): listeVue.get_parent().remove_child(listeVue)
		cadre.add_child(listeVue)
	listeVue.position = Vector2(liste.position.x, 640)
	listeVue.size = Vector2(liste.size.x, 904 - 640)
	listeContenu = Catalogue.voituresDe(String(v.get("cat", ""))).size() * PC_LIGNE
	listeDefile = clampf(listeDefile, 0, maxf(0, listeContenu - listeVue.size.y))
	# La barre des réglages : des pastilles, la valeur en vert (js/ui.js, setupBar)
	var pastilles := []
	pastilles.append([Textes.t("dayNightLabel"), Textes.t("night" if App.reglages.nuit else "day"), func(): App.reglages.nuit = not App.reglages.nuit; App.sauve(); _construit(), "nuit"])
	if race:
		var dg := bool(App.reglages.get("degats", true))
		pastilles.append([Textes.t("chipDegats"), Textes.t("on" if dg else "off"), func(): App.reglages.degats = not dg; App.sauve(); _construit(), "degats"])
		pastilles.append([Textes.t("difficultyLabel"), _nom(DIFFICULTES, App.reglages.difficulte), func(): App.reglages.difficulte = _suivant(DIFFICULTES, App.reglages.difficulte); App.sauve(); _construit(), "difficulte"])
		pastilles.append([Textes.t("lapsLabel"), str(int(App.reglages.tours)), func(): App.reglages.tours = int(App.reglages.tours) % 10 + 1; App.sauve(); _construit(), "tours"])
		pastilles.append([Textes.t("opponentsLabel"), str(int(App.reglages.adversaires) - 1), func(): App.reglages.adversaires = (int(App.reglages.adversaires) - 1) % 11 + 2; App.sauve(); _construit(), "adversaires"])
	var cfg := ReglageFrein.active(App.reglages.circuit, v.id)
	pastilles.append([Textes.t("freinage"), (String(cfg.nom) if not cfg.is_empty() else Textes.t("regDefaut")) + LISTE,
		func(): ReglageFrein.suivante(App.reglages.circuit, v.id); App.sauve(); _construit(), "freinage"])
	x = 12.0
	for p in pastilles:
		var w := Paddock.largeurPastille(p[0], p[1], 17)
		var b := _bouton("", Rect2(x, 942, w, 38), Style.NUIT_PLEINE, PC_CREME, 17, p[2])
		b.coupe = 0
		b.set_meta("cle", p[3])
		b.dessinPlus = Paddock._pastille.bind(b, p[0], p[1], 17, p[3] == "nuit" and App.reglages.nuit and v.cat == "f1")
		x += w + 8
	var rg := _bouton(Textes.t("regRegler"), Rect2(x, 942, Style.largeur(Textes.t("regRegler"), 17) + 28, 38), Style.NUIT_PLEINE, PC_CREME, 17, _regler)
	rg.coupe = 0
	rg.centre = true
	rg.set_meta("cle", "regler")
	if race:
		var programme := _bouton(Textes.t("programmeCourse"), Rect2(1291, 875, 273, 42), Style.VERT if Championnat.actif(App.reglages.get("programme", {})) else Style.NUIT_PLEINE, PC_CREME, 20, func(): App.aller("programme"))
		programme.centre = true
		programme.set_meta("cle", "programme")
	var go := _bouton(Textes.t("onTrack"), Rect2(1291, 932, 273, 58), Color("#d22620"), Color("#fff2da"), 38, _enPiste)
	go.centre = true
	go.set_meta("cle", "go")
	cadre.queue_redraw()
	listeVue.queue_redraw()
	_rendFocus(cle)


## Le focus revient où il était (la manette et le clavier ne perdent pas leur place).
func _rendFocus(cle: String) -> void:
	# au doigt, pas de cadre jaune : le jeu web n'en montre qu'au clavier et à la manette
	if portrait and Style.tactile(): return
	var cible: Control = null
	var tous := cadre.find_children("*", "Button", true, false) + barre.get_children()
	for c in tous:
		if c is Bouton and c.get_meta("cle", "") == cle and not c.is_queued_for_deletion(): cible = c
	if cible == null:
		for c in tous:
			if c is Bouton and c.get_meta("cle", "") == "go" and not c.is_queued_for_deletion(): cible = c
	if cible: cible.grab_focus.call_deferred()


func _dessinePC() -> void:
	var ci := cadre
	var race := mode == "race"
	# La barre du haut : le retour, le damier, le titre sur sa bande rouge, le logo
	ci.draw_rect(Rect2(0, 10, PC_W, 65), Style.NUIT_PLEINE)
	Style.damier(ci, Rect2(116, 10, 90, 65), 4, PC_CREME, Style.NUIT_PLEINE, 0)
	Style.biseau(ci, Rect2(206, 10, 351, 65), PC_ROUGE, 22)
	Style.texte(ci, Textes.t({ race = "quickRace", timetrial = "timeTrial", training = "training" }.get(mode, "quickRace")), Vector2(228, 60), 46, Color("#fff1d5"))
	var logo := Style.tex("res://images/interface/logo-slotless.webp")
	var lh := 61.0
	var lwl := lh * logo.get_width() / logo.get_height()
	ci.draw_texture_rect(logo, Rect2(PC_W - 10 - lwl, 12, lwl, lh), false)
	# La colonne de la voiture
	Style.biseau(ci, Rect2(0, 85, 939, 51), PC_CREME, 12)
	var v := Catalogue.voiture(App.reglages.voiture)
	var cat := ""
	for c in Catalogue.categories():
		if c.id == v.cat: cat = Textes.nom(c.nom).to_upper()
	var livrees: Array = v.livrees
	var li: int = int(App.reglages.livree) % maxi(1, livrees.size())
	Style.biseau(ci, Rect2(0, 148, 939, 111), PC_CREME, 14)
	var nom := str(v.nom).to_upper()
	var tn := 67
	while tn > 30 and Style.largeur(nom, tn) > 900: tn -= 2
	Style.texte(ci, nom, Vector2(18, 222), tn, Color("#20271f"))
	Style.texte(ci, "%s · %s" % [cat, Textes.livree(livrees[li]).to_upper()], Vector2(20, 249), 17, Color("#252a22"))
	# la voiture, en grand, posée sur le sol du paddock
	var d := Catalogue.dessin(v.id, li)
	if d.get("vignette"):
		var tex := Style.tex("res://images/vignettes/" + d.vignette)
		var zone := Rect2(109, 259, 720, 300)
		var e := minf(zone.size.x / tex.get_width(), zone.size.y / tex.get_height())
		var t := Vector2(tex.get_width(), tex.get_height()) * e
		ci.draw_texture_rect(tex, Rect2(zone.position.x + (zone.size.x - t.x) / 2, zone.end.y - t.y, t.x, t.y), false)
	ci.draw_rect(Rect2(0, 571, 939, 114), PC_CREME)
	# les caractéristiques : pictogramme, valeur, unité, libellé
	ci.draw_rect(Rect2(0, 697, 939, 59), PC_CREME)
	ci.draw_rect(Rect2(0, 754, 939, 2), PC_TRAIT)
	_statsPC(ci, v, Rect2(0, 697, 939, 57))
	# La feuille du circuit
	var cid: String = App.reglages.circuit
	var info: Dictionary = infoCircuits.get(cid, infoCircuits.values()[0])
	var r := carte
	ci.draw_rect(Rect2(r.position + Vector2(5, 7), r.size), Color(0.09, 0.106, 0.098, 0.4))
	ci.draw_rect(r, PC_FEUILLE)
	var tnom := str(info.nom).to_upper()
	var tc := 46
	while tc > 26 and Style.largeur(tnom, tc) > 480: tc -= 2
	Style.texte(ci, tnom, r.position + Vector2(20, 58), tc, Color("#272b28"))
	var dr := Style.drapeau(info.pays)
	if dr: ci.draw_texture_rect(dr, Rect2(r.end.x - 87, r.position.y + 18, 61, 46), false)
	Style.texte(ci, Paddock.infoPiste(info, race),
		r.position + Vector2(20, 92), 18, Color("#272b28"))
	var ir := Rect2(r.position.x + 5, 200, r.size.x - 10, 214)
	Style.couvre(ci, info.image, ir, 0.5)
	Paddock._contour(ci, info, Rect2(ir.position.x + 30, ir.position.y + 6, ir.size.x - 60, ir.size.y - 12), false)
	# L'en-tête de la liste : le titre, l'état du tableau ou le nuage du palmarès, les colonnes
	var x0 := liste.position.x + 9
	var y0 := liste.position.y
	Style.texte(ci, Textes.t("palmares") if race else Textes.t("yourBestTitle"), Vector2(x0, y0 + 18), 15, PC_ENCRE)
	if race:
		var e := Mondial.nuage()
		var tx := Textes.t("nuage_" + e)
		var dx := liste.end.x - 12 - Style.largeur(tx, 13) - (Style.largeur(Textes.t("signIn"), 13) + 32 if Mondial.connexionPossible() and not Mondial.connecte() else 0.0)
		ci.draw_texture_rect(Palmares.nuage(e, 22), Rect2(dx - 28, y0 + 3, 22, 16), false)
		Style.texte(ci, tx, Vector2(dx, y0 + 17), 13, PC_MUET)
		Style.texte(ci, Textes.t("palmaresRegle", Palmares.TOURS_MIN), Vector2(x0, y0 + 40), 13, PC_MUET, HORIZONTAL_ALIGNMENT_LEFT, liste.size.x - 20)
	else:
		var et := Mondial.etat()
		Style.texte(ci, et.texte, Vector2(x0, y0 + 40), 13, Color("#a3271c") if et.alerte else PC_MUET, HORIZONTAL_ALIGNMENT_LEFT, liste.size.x - 20)
	Style.texte(ci, Textes.t("palmaresTrophee" if race else "colRecord"), Vector2(x0 + 316, y0 + 58), 10, PC_MUET)
	Style.texte(ci, Textes.t("palmaresNiveau" if race else "colMonde"), Vector2(x0 + 458, y0 + 58), 10, PC_MUET)
	# La barre des réglages, et le départ
	ci.draw_rect(Rect2(0, 921, PC_W, 69), PC_CREME)
	ci.draw_rect(Rect2(0, 921, PC_W, 3), PC_TRAIT)
	Style.damier(ci, Rect2(1201, 932, 110, 58), 4, Style.NUIT_PLEINE, Color(0, 0, 0, 0), 0)


## Les quatre caractéristiques (js/ui.js, heroStats) : réparties comme `space-around`.
func _statsPC(ci: CanvasItem, v: Dictionary, r: Rect2) -> void:
	var p: Dictionary = v.perf
	var fr := Textes.langue() == "fr"
	var nb := func(x: float, d: int) -> String: return (("%." + str(d) + "f") % x).replace(".", "," if fr else ".")
	var items := [["top", str(roundi(p.vmax)), "km/h", Textes.t("statVmax")], ["acc", "0-100 : " + nb.call(p.a100, 1), "s", Textes.t("statAcc")],
		["brk", nb.call(p.b100, 1), "m", Textes.t("statFrein")], ["grp", nb.call(p.gripG, 2), "g", Textes.t("statGrip")]]
	var larg := []
	var total := 0.0
	for it in items:
		var w := 30 + 10 + maxf(Style.largeur(it[1], 28) + Style.largeur(it[2], 17) + 3, Style.largeur(it[3], 13))
		larg.append(w)
		total += w
	var esp := (r.size.x - total) / items.size()
	var x := r.position.x + esp / 2
	for i in items.size():
		var it: Array = items[i]
		Paddock._icone(ci, it[0], Vector2(x + 15, r.get_center().y), 30)
		var tx := x + 40
		Style.texte(ci, it[1], Vector2(tx, r.position.y + 33), 28, Color("#20261e"))
		Style.texte(ci, it[2], Vector2(tx + Style.largeur(it[1], 28) + 3, r.position.y + 33), 17, Color("#20261e"))
		Style.texte(ci, it[3], Vector2(tx, r.position.y + 49), 13, Color("#4b4e44"))
		x += larg[i] + esp


## Les pictogrammes des caractéristiques (js/ui.js, GAUGE_ICONS), tracés comme leurs SVG de 24.
static func _icone(ci: CanvasItem, nom: String, c: Vector2, taille: float) -> void:
	var s := taille / 24.0
	var o := c - Vector2(12, 12) * s
	var col := Color("#20261e")
	var ep := 2.0 * s
	var P := func(x: float, y: float) -> Vector2: return o + Vector2(x, y) * s
	match nom:
		"top":
			ci.draw_arc(P.call(12, 17.5), 8.5 * s, PI, TAU, 24, col, ep, true)
			ci.draw_line(P.call(12, 17.5), P.call(16.5, 10), col, ep, true)
			ci.draw_circle(P.call(12, 17.5), 1.5 * s, col)
		"acc":
			ci.draw_polyline(PackedVector2Array([P.call(5, 5), P.call(11, 12), P.call(5, 19)]), col, ep, true)
			ci.draw_polyline(PackedVector2Array([P.call(13, 5), P.call(19, 12), P.call(13, 19)]), col, ep, true)
		"brk":
			ci.draw_arc(P.call(12, 12), 8 * s, 0, TAU, 32, col, ep, true)
			ci.draw_arc(P.call(12, 12), 2.5 * s, 0, TAU, 16, col, ep, true)
		"grp":
			ci.draw_arc(P.call(12, 12), 8 * s, 0, TAU, 32, col, ep, true)
			ci.draw_arc(P.call(12, 12), 3 * s, 0, TAU, 16, col, ep, true)
			ci.draw_line(P.call(12, 4), P.call(12, 9), col, ep, true)
			ci.draw_line(P.call(4.5, 16), P.call(9.4, 13.5), col, ep, true)
			ci.draw_line(P.call(19.5, 16), P.call(14.6, 13.5), col, ep, true)


## La coche d'une carte choisie : un rond rouge, un V crème.
static func _coche(ci: CanvasItem, c: Vector2, r := 10.0) -> void:
	var e := r / 10.0
	ci.draw_circle(c, r, Color("#c82e27"))
	ci.draw_polyline(PackedVector2Array([c + Vector2(-4.5, 0.5) * e, c + Vector2(-1.2, 3.8) * e, c + Vector2(4.8, -3.6) * e]), Color("#fff8e7"), 2.4 * e, true)


static func _livreePC(b: Bouton) -> void:
	var v = b.get_meta("vignette")
	if v:
		var tex := Style.tex("res://images/vignettes/" + v)
		var h := 62.0
		var w := minf(b.size.x - 14, h * tex.get_width() / tex.get_height())
		h = w * tex.get_height() / tex.get_width()
		b.draw_texture_rect(tex, Rect2((b.size.x - w) / 2, 7 + (62 - h) / 2, w, h), false)
	var sel: bool = b.get_meta("sel", false)
	b.draw_rect(Rect2(Vector2(1.5, 1.5), b.size - Vector2(3, 3)), Color("#ca2b22") if sel else Color("#f5e7c6"), false, 3.0 if sel else 2.0)
	if sel: Paddock._coche(b, Vector2(b.size.x - 13, 13))


static func _carteVoiturePC(b: Bouton, avecCat: bool) -> void:
	var c: Dictionary = b.get_meta("voiture")
	var d := Catalogue.dessin(c.id, int(App.reglages.livree) if c.id == App.reglages.voiture else 0)
	b.draw_rect(Rect2(Vector2(1, 1), b.size - Vector2(2, 2)), PC_BORD, false, 2)
	if d.get("vignette"):
		var tex := Style.tex("res://images/vignettes/" + d.vignette)
		var e := minf(132.0 / tex.get_width(), 52.0 / tex.get_height())
		var t := Vector2(tex.get_width(), tex.get_height()) * e
		b.draw_texture_rect(tex, Rect2((b.size.x - t.x) / 2, 6 + (52 - t.y) / 2, t.x, t.y), false)
	if avecCat:
		var tag := str(c.cat).to_upper()
		var w := Style.largeur(tag, 13) + 14
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(CATS.get(c.cat, "#9aa1ad"))
		sb.set_corner_radius_all(8)
		b.draw_style_box(sb, Rect2((b.size.x - w) / 2, 97, w, 19))
		Style.texte(b, tag, Vector2(0, 112), 13, Color("#555d50"), HORIZONTAL_ALIGNMENT_CENTER, b.size.x)
	if b.get_meta("sel", false):
		b.draw_rect(Rect2(2, b.size.y - 6, b.size.x - 4, 4), Color("#ba2924"))
		Paddock._coche(b, Vector2(b.size.x - 14, 14))


static func _carteCircuitPC(b: Bouton) -> void:
	var info: Dictionary = Paddock.infosCircuits()[b.get_meta("circuit")]
	var sel: bool = b.get_meta("sel", false)
	var art := Rect2(5, 5, b.size.x - 10, 67)
	Style.couvre(b, info.image, art, 0.5)
	Paddock._contour(b, info, art.grow(-6), true)
	var dr := Style.drapeau(info.pays)
	var txt := "%d m" % roundi(info.longueur)
	var w := 22.0 + Style.largeur(txt, 13)
	var x := (b.size.x - w) / 2
	if dr: b.draw_texture_rect(dr, Rect2(x, b.size.y - 22, 18, 12), false)
	Style.texte(b, txt, Vector2(x + 22, b.size.y - 11), 13, Color("#555d50"))
	b.draw_rect(Rect2(Vector2(1.5, 1.5), b.size - Vector2(3, 3)), Color("#c92c23") if sel else Color("#a29679"), false, 3.0 if sel else 2.0)
	if sel:
		b.draw_rect(Rect2(2, b.size.y - 6, b.size.x - 4, 4), Color("#ba2924"))
		Paddock._coche(b, Vector2(b.size.x - 13, 13))


## Une pastille de réglage (js/ui.js, setupBar) : le nom en crème, la valeur sur fond vert.
static func largeurPastille(nom: String, valeur: String, t: int) -> float:
	var liste := valeur.ends_with(LISTE)
	return 14 + Style.largeur(nom + " :", t) + 8 + Style.largeur(valeur.trim_suffix(LISTE), t) + 16 + 10 + (t * 0.8 if liste else 0.0)


static func _pastille(b: Bouton, nom: String, valeur: String, t: int, alerte := false) -> void:
	var y := b.size.y / 2 + t * 0.36
	Style.texte(b, nom + " :", Vector2(14, y), t, Color("#fff0d2"))
	var liste := valeur.ends_with(LISTE)
	var v := valeur.trim_suffix(LISTE)
	var xv := 14 + Style.largeur(nom + " :", t) + 8
	var wv := Style.largeur(v, t) + 16 + (t * 0.8 if liste else 0.0)
	var hv := b.size.y - 14
	b.draw_rect(Rect2(xv, 7, wv, hv), Style.ROUGE if alerte else PC_VERT)
	Style.texte(b, v, Vector2(xv + 8, y), t, Color.WHITE if alerte else Color("#171c19"))
	if liste:
		# la flèche d'une liste, comme celle d'un <select>
		var c := Vector2(xv + wv - 8 - t * 0.3, b.size.y / 2 + 1)
		var a := t * 0.26
		b.draw_colored_polygon(PackedVector2Array([c + Vector2(-a, -a * 0.6), c + Vector2(a, -a * 0.6), c + Vector2(0, a * 0.6)]), Color("#171c19"))


## LA LISTE DE LA CATÉGORIE, SUR ORDINATEUR : une carte par voiture (80 de haut), dans sa propre vue,
## qui défile à la molette, au doigt et par sa barre, comme `.setup-records` du jeu web.
func _dessineListePC() -> void:
	var ci := listeVue
	var w := listeVue.size.x
	var h := listeVue.size.y
	var v := Catalogue.voiture(App.reglages.voiture)
	var cid: String = App.reglages.circuit
	var course := mode == "race"
	var voitures := Catalogue.voituresDe(String(v.get("cat", "")))
	var lignes := []
	for i in voitures.size():
		var m: Dictionary = voitures[i]
		lignes.append({ m = m, i = i, b = _record(cid, m.id), n = Palmares.de(cid, m.id) })
	if course:
		lignes.sort_custom(func(a, b): return a.n > b.n if a.n != b.n else a.i < b.i)
	else:
		lignes.sort_custom(func(a, b):
			if (a.b < 0) != (b.b < 0): return a.b >= 0
			if a.b != b.b: return a.b < b.b
			return a.i < b.i)
	var par = null if course else Mondial.meilleurs(cid)
	var muet := PC_MUET
	var y := -listeDefile
	for l in lignes:
		if y > h: break
		if y + PC_LIGNE < 0:
			y += PC_LIGNE
			continue
		var m: Dictionary = l.m
		var choisie: bool = m.id == v.id
		var sb := StyleBoxFlat.new()
		sb.set_corner_radius_all(12)
		sb.bg_color = Color("#ddd0b6") if choisie else Color("#ebe0c7")
		if choisie:
			sb.border_color = Color("#b42b26")
			sb.set_border_width_all(2)
		ci.draw_style_box(sb, Rect2(9, y, w - 30, PC_LIGNE - 6))
		var d := Catalogue.dessin(m.id, int(App.reglages.livree) if choisie else 0)
		if d.get("vignette"):
			var tex := Style.tex("res://images/vignettes/" + d.vignette)
			var e := minf(77.0 / tex.get_width(), 58.0 / tex.get_height())
			var t := Vector2(tex.get_width(), tex.get_height()) * e
			ci.draw_texture_rect(tex, Rect2(19 + (77 - t.x) / 2, y + 8 + (58 - t.y) / 2, t.x, t.y), false)
		var bas := y + (PC_LIGNE - 6) / 2 + 5
		Style.texte(ci, str(m.nom), Vector2(108, bas), 14, Color("#272b28"), HORIZONTAL_ALIGNMENT_LEFT, 200)
		if course:
			var n: int = l.n
			if n >= 0:
				ci.draw_texture_rect(Palmares.texture(n, 26), Rect2(316, bas - 19, 26, 26), false)
				Style.texte(ci, Textes.t("trophee_" + Palmares.TROPHEES[n]), Vector2(346, bas), 13, PC_ENCRE, HORIZONTAL_ALIGNMENT_LEFT, 100)
				Style.texte(ci, Textes.t(Palmares.NIVEAUX[n]).capitalize(), Vector2(458, bas), 13, PC_ENCRE, HORIZONTAL_ALIGNMENT_LEFT, 96)
			else:
				Style.texte(ci, "—", Vector2(330, bas), 14, muet)
				Style.texte(ci, "—", Vector2(w - 50, bas), 14, muet)
		else:
			var b: float = l.b
			Style.texte(ci, Style.temps(b) if b >= 0 else "--:--.---", Vector2(316, bas), 16, PC_ENCRE if b >= 0 else muet, HORIZONTAL_ALIGNMENT_LEFT, 120)
			var wd: Dictionary = par.get(m.id, {}) if par is Dictionary else {}
			if par == null:
				Style.texte(ci, "…", Vector2(458, bas), 16, muet)
			elif wd.is_empty():
				Style.texte(ci, "--:--.---", Vector2(458, bas), 16, muet, HORIZONTAL_ALIGNMENT_LEFT, 96)
			else:
				Style.texte(ci, Style.temps(float(wd.temps)), Vector2(458, bas - 6), 16, Color("#8a5cd6"), HORIZONTAL_ALIGNMENT_LEFT, 96)
				Style.texte(ci, String(wd.get("pilote", "")), Vector2(458, bas + 9), 10, muet, HORIZONTAL_ALIGNMENT_LEFT, 96)
		y += PC_LIGNE
	# la barre de défilement, à droite, quand la liste dépasse
	if listeContenu > h:
		ci.draw_rect(Rect2(w - 12, 2, 7, h - 4), Color(0, 0, 0, 0.12))
		var r := _poigneeListe()
		ci.draw_rect(r, Color("#3a3f38"))


func _poigneeListe() -> Rect2:
	var h := listeVue.size.y
	var ph := maxf(30, (h - 4) * h / listeContenu)
	var py := 2 + (h - 4 - ph) * (listeDefile / maxf(1, listeContenu - h))
	return Rect2(listeVue.size.x - 12, py, 7, ph)


func _defileListe(d: float) -> void:
	listeDefile = clampf(listeDefile + d, 0, maxf(0, listeContenu - listeVue.size.y))
	listeVue.queue_redraw()


func _entreeListe(e: InputEvent) -> void:
	if e is InputEventMouseButton and e.pressed and (e.button_index == MOUSE_BUTTON_WHEEL_DOWN or e.button_index == MOUSE_BUTTON_WHEEL_UP):
		_defileListe(60.0 if e.button_index == MOUSE_BUTTON_WHEEL_DOWN else -60.0)
		listeVue.accept_event()
	elif e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT:
		_tientBarre = e.pressed and e.position.x > listeVue.size.x - 18
		if _tientBarre: _barreVers(e.position.y)
	elif e is InputEventMouseMotion and _tientBarre:
		_barreVers(e.position.y)
	elif e is InputEventScreenDrag:
		_defileListe(-e.relative.y)


func _barreVers(y: float) -> void:
	var h := listeVue.size.y
	var ph := _poigneeListe().size.y
	var f := clampf((y - 2 - ph / 2) / maxf(1, h - 4 - ph), 0, 1)
	listeDefile = f * maxf(0, listeContenu - h)
	listeVue.queue_redraw()


# =====================================================================================================
# AU TÉLÉPHONE : la page du jeu web sur un iPhone (390 de large), mesurée bloc par bloc (js/ui.js
# setupScreen, css/style.css sous 850 px). Un point du cadre vaut un pixel CSS : chaque chose a la taille
# qu'elle a dans le jeu web. La page défile au doigt ; les livrées, les voitures et les circuits défilent
# de côté, chacun dans son rail ; « En piste ! » et son damier restent collés en bas.
# =====================================================================================================
const T_W := 390.0
const T_BARRE := 69.0
const T_FOND := Color("#efe2c4")
const T_NOIR := Color("#151917")
const T_CARTE := Color("#171c19")
const T_MUET := Color("#5e6055")
var T := {}                                  # la mise en page du téléphone, relue par le dessin
var doigt: Doigt                             # les glissés : la page, et les rails livrees, voitures, circuits
var rails := {}                              # ceux de doigt (le même dictionnaire)
var railX := {}


func _construitTel(cle: String) -> void:
	var k := size.x / T_W
	cadre.scale = Vector2(k, k)
	cadre.position.x = 0
	barre.visible = true
	barre.scale = Vector2(k, k)
	barre.size = Vector2(T_W, T_BARRE)
	barre.position = Vector2(0, size.y - T_BARRE * k)
	if listeVue:
		listeVue.queue_free()
		listeVue = null
	_haut = 0.0
	rails.clear()
	T.clear()
	var race := mode == "race"
	var v := Catalogue.voiture(App.reglages.voiture)
	# La barre du titre : le retour (le damier, le titre et le logo sont dessinés)
	var br := _bouton("", Rect2(10, 8, 73, 64), Color(0, 0, 0, 0), PC_CREME, 14, func(): App.aller("accueil"))
	br.coupe = 0
	br.set_meta("cle", "retour")
	br.dessinPlus = BarreTitre.retourTel.bind(br)
	# Les onglets de catégorie, qui passent à la ligne
	var onglets := [["tous", Textes.t("all")]]
	for c in Catalogue.categories(): onglets.append([c.id, Textes.nom(c.nom).to_upper()])
	var x := 22.0
	var y := 95.0
	for o in onglets:
		var w := maxf(70.0, Style.largeur(o[1], 22) + 34)
		if x > 22 and x + w > 368:
			x = 22.0
			y += 47.0
		var choisi: bool = filtre == o[0]
		var b := _bouton(o[1], Rect2(x, y, w, 44), PC_ONGLET if choisi else Color("#222825"), Color("#fff5df") if choisi else Color("#f9efd9"), 22,
			func(): _choisitCategorie(o[0]))
		b.coupe = w * 0.08
		b.centre = true
		b.set_meta("cle", "onglet-" + o[0])
		x += w + 3
	T.onglets = Rect2(10, 88, 370, y + 44 - 88)
	y += 44 + 12
	# La voiture : son nom (sur deux lignes s'il le faut), puis la voiture dans le paddock
	T.nom = Paddock._lignes(str(v.nom).to_upper(), 40, 330)
	T.copie = 8.0 + 40.0 * (T.nom as PackedStringArray).size() + 20 + 16
	T.voiture = Rect2(10, y, 370, 270)
	y += 270 + 12
	# Les livrées : une carte chacune, la rangée défile si elles ne tiennent pas
	var livrees: Array = v.livrees
	var n := livrees.size()
	if n >= 2:
		var lw := maxf(100.0, (354.0 - 8 * (n - 1)) / n)
		var hc := 0.0
		var li := int(App.reglages.livree) % n
		for i in n:
			var bord := 3.0 if i == li else 2.0
			var lignes := Paddock._lignes(Textes.livree(livrees[i]).to_upper(), 16, lw - 2 * bord - 8)
			hc = maxf(hc, 65 + 3 + 19 * lignes.size() + 8 + 2 * bord)
		T.livrees = Rect2(10, y, 370, hc + 16)
		var cont := doigt.rail("livrees", T.livrees, 16 + n * lw + (n - 1) * 8, 8 + li * (lw + 8) + lw / 2)
		for i in n:
			var d := Catalogue.dessin(v.id, i)
			var b := _bouton("", Rect2(8 + i * (lw + 8), 8, lw, hc), T_CARTE, PC_CREME, 16,
				func(): App.reglages.livree = i; App.sauve(); _construit(), cont)
			b.coupe = 0
			b.set_meta("cle", "livree-%d" % i)
			b.set_meta("vignette", d.get("vignette"))
			b.set_meta("sel", i == li)
			b.set_meta("nom", Textes.livree(livrees[i]).to_upper())
			b.dessinPlus = Paddock._livreeTel.bind(b)
		y += hc + 16 + 12
	# Les caractéristiques, trois par ligne
	T.stats = Rect2(10, y, 370, 88)
	y += 88
	# Le rail des voitures : la voiture choisie au milieu, à la première ouverture
	var rail: Array = Catalogue.donnees.voitures.filter(func(c): return filtre == "tous" or c.cat == filtre)
	var avecCat := filtre == "tous"
	var nl := 1
	var iSel := 0
	for i in rail.size():
		nl = maxi(nl, Paddock._lignes(str(rail[i].nom).to_upper(), 17, 122).size())
		if rail[i].id == v.id: iSel = i
	var hv := 2 + 5 + 66 + 4 + 20.0 * nl + (6 + 19 if avecCat else 0) + 5 + 2
	T.rail = Rect2(10, y, 370, hv + 12)
	var contV := doigt.rail("voitures", T.rail, 4 + rail.size() * 146 - 10, 2 + iSel * 146 + 68)
	for i in rail.size():
		var c: Dictionary = rail[i]
		var b := _bouton("", Rect2(2 + i * 146, 2, 136, hv), PC_CREME, PC_ENCRE, 17, func(): _choisitVoiture(c.id), contV)
		b.coupe = 0
		b.set_meta("cle", "voiture-" + c.id)
		b.set_meta("voiture", c)
		b.set_meta("sel", c.id == v.id)
		b.dessinPlus = Paddock._carteVoitureTel.bind(b, avecCat)
	y += hv + 12 + 36
	# La feuille du circuit : le titre et le tracé, le rail des circuits, la liste de la catégorie
	var cid: String = App.reglages.circuit
	var info: Dictionary = infoCircuits.get(cid, infoCircuits.values()[0])
	var ys := y
	T.nomC = Paddock._lignes(str(info.nom).to_upper(), 36, 279)
	T.tete = 12 + 34.2 * (T.nomC as PackedStringArray).size() + 7 + 22 + 14
	T.piste = Rect2(15, ys + 5, 360, 300)
	var circuits := Catalogue.circuits()
	var iC := 0
	for i in circuits.size():
		if circuits[i].id == cid: iC = i
	var rc := Rect2(15, ys + 5 + 300 + 12 + 8, 360, 149)
	var contC := doigt.rail("circuits", rc, 4 + circuits.size() * 118 - 10, 2 + iC * 118 + 54)
	for i in circuits.size():
		var c: Dictionary = circuits[i]
		var b := _bouton("", Rect2(2 + i * 118, 2, 108, 137), PC_CREME, PC_ENCRE, 17,
			func(): App.reglages.circuit = c.id; App.reglages.tours = infoCircuits[c.id].tours; App.sauve(); _construit(), contC)
		b.coupe = 0
		b.set_meta("cle", "circuit-" + c.id)
		b.set_meta("circuit", c.id)
		b.set_meta("sel", c.id == cid)
		b.dessinPlus = Paddock._carteCircuitTel.bind(b)
	# l'en-tête de la liste : le palmarès (course) ou ton record (contre-la-montre, entraînement)
	var yl := rc.end.y + 12
	T.liste = yl
	var lien := Mondial.connexionPossible() and (Mondial.enCours or not Mondial.connecte())
	var txtLien := Textes.t("signInCancel").capitalize() if Mondial.enCours else Textes.t("signInLien")
	var lb := Style.largeur(txtLien, 13) + 4
	var rLien := Rect2()
	var yn := yl + 26.0
	if race:
		T.note = Paddock._lignes(Textes.t("palmaresRegle", Palmares.TOURS_MIN), 13, 360)
		if lien:
			# dans le nuage (js/ui.js, nuagePalmares) : à droite de « Sur cet appareil » s'il y a la place
			var etat := Textes.t("nuage_" + Mondial.nuage())
			var place := 360 - _largeurEspace(Textes.t("palmares").to_upper(), 15, 1.5) - 8 - 36 - Style.largeur(etat, 13) - 6
			if lb <= place:
				rLien = Rect2(375 - lb, yl + 5, lb, 20)
				T.decaleNuage = lb + 6
			else:
				rLien = Rect2(375 - lb, yl + 26, lb, 20)
				yn += 22
	else:
		yn = yl + 34.0
		var et := Mondial.etat()
		T.note = Paddock._lignes(String(et.texte), 13, 360) if String(et.texte) != "" else PackedStringArray()
		T.alerte = bool(et.alerte)
	T.yNote = yn
	var yh := yn + 16.0 * (T.note as PackedStringArray).size()
	if lien and not race:
		# après la phrase du tableau mondial, à la ligne
		rLien = Rect2(13, yh, lb, 20)
		yh += 22
	if (T.note as PackedStringArray).size() or (lien and not race): yh += 4
	T.yTete = yh
	var nv := Catalogue.voituresDe(String(v.get("cat", ""))).size()
	T.yLignes = yh + 18
	var finListe: float = T.yLignes + nv * 58 - 6 + 12
	if lien:
		# « Se connecter avec Google » : le lien du jeu web
		var bg := _bouton("", rLien, Color(0, 0, 0, 0), T_MUET, 13, func(): (Mondial.annuler() if Mondial.enCours else Mondial.entrer()))
		bg.coupe = 0
		bg.set_meta("cle", "google")
		bg.dessinPlus = Paddock._lienTel.bind(bg, txtLien)
	T.feuille = Rect2(10, ys, 370, finListe + 5 - ys)
	y = T.feuille.end.y + 16
	# Les réglages, en pastilles, par groupes qui passent à la ligne (js/ui.js, setupBar)
	var groupes := []
	var g1 := [[Textes.t("dayNightLabel"), Textes.t("night" if App.reglages.nuit else "day"), func(): App.reglages.nuit = not App.reglages.nuit; App.sauve(); _construit(), "nuit"]]
	if race:
		var dg := bool(App.reglages.get("degats", true))
		g1.append([Textes.t("chipDegats"), Textes.t("on" if dg else "off"), func(): App.reglages.degats = not dg; App.sauve(); _construit(), "degats"])
	groupes.append(g1)
	if race:
		groupes.append([[Textes.t("difficultyLabel"), _nom(DIFFICULTES, App.reglages.difficulte), func(): App.reglages.difficulte = _suivant(DIFFICULTES, App.reglages.difficulte); App.sauve(); _construit(), "difficulte"],
			[Textes.t("lapsLabel"), str(int(App.reglages.tours)), func(): App.reglages.tours = int(App.reglages.tours) % 10 + 1; App.sauve(); _construit(), "tours"],
			[Textes.t("opponentsLabel"), str(int(App.reglages.adversaires) - 1), func(): App.reglages.adversaires = (int(App.reglages.adversaires) - 1) % 11 + 2; App.sauve(); _construit(), "adversaires"]])
	var cfg := ReglageFrein.active(cid, v.id)
	groupes.append([[Textes.t("freinage"), (String(cfg.nom) if not cfg.is_empty() else Textes.t("regDefaut")) + LISTE,
		func(): ReglageFrein.suivante(App.reglages.circuit, v.id); App.sauve(); _construit(), "freinage"],
		[Textes.t("regRegler"), "", _regler, "regler"]])
	if race: groupes.append([[Textes.t("programmeCourse"), "", func(): App.aller("programme"), "programme"]])
	var yr := y
	x = 18.0
	y = yr + 13
	var basLigne := y + 40
	for g in groupes:
		var lg := -8.0
		for p in g: lg += Paddock.largeurPastilleTel(p[0], p[1]) + 8
		# un groupe qui ne tient pas au bout de la ligne passe à la suivante
		if x > 18 and x + lg > 372:
			x = 18.0
			y = basLigne + 6
		for p in g:
			var w := Paddock.largeurPastilleTel(p[0], p[1])
			if x > 18 and x + w > 372:
				x = 18.0
				y = basLigne + 6
			var b := _bouton("" if p[1] != "" else p[0], Rect2(x, y, w, 40), T_CARTE, PC_CREME, 15, p[2])
			b.coupe = 9
			b.centre = true
			b.set_meta("cle", p[3])
			if p[3] == "programme" and Championnat.actif(App.reglages.get("programme", {})): b.fond = Style.VERT
			if p[1] != "": b.dessinPlus = Paddock._pastilleTel.bind(b, p[0], p[1], p[3] == "nuit" and App.reglages.nuit and v.cat == "f1")
			basLigne = y + 40
			x += w + 8
		x += 2          # entre deux groupes, 10 au lieu de 8
		if g == g1 and App.reglages.nuit:
			# la nuit : la phrase sur la visibilité, sous le jour / nuit
			T.nuitTexte = Paddock._lignes(Textes.t("nightF1Hint" if v.cat == "f1" else "nightHint"), 13, 354)
			T.nuitY = basLigne + 6
			basLigne += 6 + 16 * (T.nuitTexte as PackedStringArray).size()
			x = 400.0
	T.reglages = Rect2(10, yr, 370, basLigne + 10 - yr)
	hauteur = T.reglages.end.y + 16 + T_BARRE
	cadre.size = Vector2(T_W, hauteur)
	_defile(0)          # la page garde sa place quand on la refait (le tableau mondial qui arrive, un choix)
	# « En piste ! », collé en bas avec son damier
	var go := _bouton("", Rect2(54, 11, 326, 48), Color("#d22620"), Color("#fff2da"), 30, _enPiste, barre)
	go.coupe = 326 * 0.06
	go.set_meta("cle", "go")
	go.dessinPlus = Paddock._enPisteTel.bind(go)
	cadre.queue_redraw()
	barre.queue_redraw()
	_rendFocus(cle)


## Les lignes d'un texte coupé à la largeur, mot par mot, comme le retour à la ligne du navigateur.
static func _lignes(t: String, taille: int, largeur: float) -> PackedStringArray:
	var out := PackedStringArray()
	var ligne := ""
	for mot in t.split(" ", false):
		var essai: String = mot if ligne == "" else ligne + " " + mot
		if ligne != "" and Style.largeur(essai, taille) > largeur:
			out.append(ligne)
			ligne = mot
		else:
			ligne = essai
	if ligne != "": out.append(ligne)
	return out


## Un texte espacé (letter-spacing) ; rend sa largeur.
## Chaque lettre est posée là où la mettrait le texte entier (l'approche des paires est gardée), plus
## l'espacement.
static func _espace(ci: CanvasItem, t: String, p: Vector2, taille: int, c: Color, ls: float) -> float:
	for i in t.length():
		Style.texte(ci, t[i], Vector2(p.x + Style.largeur(t.substr(0, i), taille) + i * ls, p.y), taille, c)
	return _largeurEspace(t, taille, ls)


static func _largeurEspace(t: String, taille: int, ls: float) -> float:
	return Style.largeur(t, taille) + maxf(0, t.length() - 1) * ls


## Un texte trop long finit par « … » (text-overflow: ellipsis).
static func _coupe(t: String, taille: int, largeur: float) -> String:
	if Style.largeur(t, taille) <= largeur: return t
	while t.length() > 1 and Style.largeur(t + "…", taille) > largeur: t = t.substr(0, t.length() - 1)
	return t.strip_edges() + "…"


static func _lienTel(b: Bouton, txt: String) -> void:
	Style.texte(b, txt, Vector2(2, 14.5), 13, T_MUET)
	b.draw_line(Vector2(2, 16.5), Vector2(b.size.x - 2, 16.5), T_MUET, 1.0)


static func _enPisteTel(b: Bouton) -> void:
	var t := Textes.t("onTrack").replace("›", "").strip_edges()
	var wt := Style.largeur(t, 30)
	var x := (b.size.x - (wt + 14 + 30)) / 2
	Style.texte(b, t, Vector2(x, 35.3), 30, Color("#fff2da"))
	var ya := 30.0
	BarreTitre.fleche(b, Vector2(x + wt + 20, ya), Vector2(x + wt + 38, ya), Color("#fff2da"), 1.6, 5.5)


static func _livreeTel(b: Bouton) -> void:
	var sel: bool = b.get_meta("sel", false)
	var bord := 3.0 if sel else 2.0
	var lignes := Paddock._lignes(String(b.get_meta("nom", "")), 16, b.size.x - 2 * bord - 8)
	var hc := 65.0 + 3 + 19 * lignes.size()
	var y := (b.size.y - hc) / 2
	var v = b.get_meta("vignette")
	if v:
		var tex := Style.tex("res://images/vignettes/" + v)
		var zone := Rect2(bord + 4, y, b.size.x - 2 * bord - 8, 65)
		var e := minf(zone.size.x / tex.get_width(), zone.size.y / tex.get_height())
		var t := Vector2(tex.get_width(), tex.get_height()) * e
		b.draw_texture_rect(tex, Rect2(zone.get_center() - t / 2, t), false)
	for i in lignes.size():
		Style.texte(b, lignes[i], Vector2(0, y + 68 + 19 * i + 15.5), 16, PC_CREME, HORIZONTAL_ALIGNMENT_CENTER, b.size.x)
	# le bord déborde d'un demi-point : il couvre le liseré sombre du fond du bouton
	b.draw_rect(Rect2(Vector2(bord, bord) / 2 - Vector2(0.5, 0.5), b.size - Vector2(bord, bord) + Vector2(1, 1)), Color("#ca2b22") if sel else Color("#f5e7c6"), false, bord + 1)
	if sel: Paddock._coche(b, Vector2(b.size.x - bord - 11.7, bord + 11.7), 11.7)


static func _carteVoitureTel(b: Bouton, avecCat: bool) -> void:
	var c: Dictionary = b.get_meta("voiture")
	var sel: bool = b.get_meta("sel", false)
	var d := Catalogue.dessin(c.id, int(App.reglages.livree) if sel else 0)
	if d.get("vignette"):
		var tex := Style.tex("res://images/vignettes/" + d.vignette)
		var e := minf(122.0 / tex.get_width(), 66.0 / tex.get_height())
		var t := Vector2(tex.get_width(), tex.get_height()) * e
		b.draw_texture_rect(tex, Rect2(Vector2(7 + (122 - t.x) / 2, 7 + (66 - t.y) / 2), t), false)
	var lignes := Paddock._lignes(str(c.nom).to_upper(), 17, 122)
	for i in lignes.size():
		Style.texte(b, lignes[i], Vector2(0, 77 + 20 * i + 16.4), 17, PC_ENCRE, HORIZONTAL_ALIGNMENT_CENTER, b.size.x)
	if avecCat:
		var tag := str(c.cat).to_upper()
		var w := Style.largeur(tag, 13) + 14
		var yt := 77 + 20.0 * lignes.size() + 6
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(CATS.get(c.cat, "#9aa1ad"))
		sb.set_corner_radius_all(8)
		b.draw_style_box(sb, Rect2((b.size.x - w) / 2, yt, w, 19))
		Style.texte(b, tag, Vector2(0, yt + 14.4), 13, Color("#555d50"), HORIZONTAL_ALIGNMENT_CENTER, b.size.x)
	b.draw_rect(Rect2(Vector2(1, 1), b.size - Vector2(2, 2)), PC_BORD, false, 2)
	if sel:
		b.draw_rect(Rect2(2, b.size.y - 6, b.size.x - 4, 4), Color("#ba2924"))
		Paddock._coche(b, Vector2(b.size.x - 17, 17))


static func _carteCircuitTel(b: Bouton) -> void:
	var info: Dictionary = Paddock.infosCircuits()[b.get_meta("circuit")]
	var sel: bool = b.get_meta("sel", false)
	var bord := 3.0 if sel else 2.0
	var art := Rect2(bord + 3, bord + 3, b.size.x - 2 * bord - 6, 82)
	Style.couvre(b, info.image, art, 0.5)
	Paddock._contour(b, info, Rect2(art.get_center() - Vector2(33, 33), Vector2(66, 66)), true, 3.8)
	var nom := Paddock._coupe(str(info.nom).to_upper(), 17, b.size.x - 2 * bord - 6)
	Style.texte(b, nom, Vector2(0, bord + 104.4), 17, PC_ENCRE, HORIZONTAL_ALIGNMENT_CENTER, b.size.x)
	var dr := Style.drapeau(info.pays)
	var txt := "%d m" % roundi(info.longueur)
	var w := 20.0 + Style.largeur(txt, 13)
	var x := (b.size.x - w) / 2
	if dr: b.draw_texture_rect(dr, Rect2(x, bord + 113.5, 17, 12), false)
	Style.texte(b, txt, Vector2(x + 20, bord + 124.4), 13, Color("#555d50"))
	b.draw_rect(Rect2(Vector2(bord, bord) / 2, b.size - Vector2(bord, bord)), Color("#c92c23") if sel else Color("#a29679"), false, bord)
	if sel:
		b.draw_rect(Rect2(bord, b.size.y - bord - 4, b.size.x - 2 * bord, 4), Color("#ba2924"))
		Paddock._coche(b, Vector2(b.size.x - 19, 17))


## Une pastille du téléphone (css/style.css sous 850 px) : 40 de haut, le nom en crème, la valeur
## sur son biseau vert ; une liste a sa petite flèche.
static func largeurPastilleTel(nom: String, valeur: String) -> float:
	if valeur == "": return Style.largeur(nom, 15) + 40
	var liste := valeur.ends_with(LISTE)
	return Style.largeur(nom + " :", 15) + Style.largeur(valeur.trim_suffix(LISTE), 15) + 48 + (16.0 if liste else 0.0)


static func _pastilleTel(b: Bouton, nom: String, valeur: String, alerte := false) -> void:
	Style.texte(b, nom + " :", Vector2(12, 25.6), 15, PC_CREME)
	var liste := valeur.ends_with(LISTE)
	var v := valeur.trim_suffix(LISTE)
	var xv := 12 + Style.largeur(nom + " :", 15) + 8
	var wv := Style.largeur(v, 15) + 20 + (16.0 if liste else 0.0)
	var r := Rect2(xv, 9, wv, 22)
	var pts := PackedVector2Array([Vector2(r.position.x + 6, r.position.y), Vector2(r.end.x, r.position.y), Vector2(r.end.x - 6, r.end.y), Vector2(r.position.x, r.end.y)])
	b.draw_colored_polygon(pts, Style.ROUGE if alerte else PC_VERT)
	Style.texte(b, v, Vector2(xv + 10, 25.6), 15, Color.WHITE if alerte else Color("#171c19"))
	if liste:
		var c := Vector2(r.end.x - 16, 20)
		b.draw_colored_polygon(PackedVector2Array([c + Vector2(-5, -3), c + Vector2(5, -3), c + Vector2(0, 3)]), Color("#171c19"))


func _dessineTel() -> void:
	var ci := cadre
	var race := mode == "race"
	var v := Catalogue.voiture(App.reglages.voiture)
	# La barre du titre : le noir, le damier penché, le titre sur sa bande rouge, le logo
	BarreTitre.tel(ci, Rect2(10, 8, 370, 64), Textes.t({ race = "quickRace", timetrial = "timeTrial", training = "training" }.get(mode, "quickRace")))
	# Les onglets
	ci.draw_rect(T.onglets, PC_CREME)
	# La voiture : le paddock derrière, le nom sur son papier penché
	var rv: Rect2 = T.voiture
	ci.draw_rect(rv, Color("#c8baa0"))
	Style.couvre(ci, fondPaddock, rv.grow(-2), 0.5)
	var hc: float = T.copie
	var pc := Rect2(rv.position.x + 2, rv.position.y + 2, 366, hc)
	ci.draw_colored_polygon(PackedVector2Array([pc.position, Vector2(pc.end.x, pc.position.y), Vector2(pc.position.x + pc.size.x * 0.99, pc.position.y + hc * 0.91), Vector2(pc.position.x, pc.end.y)]), PC_CREME)
	var lignes: PackedStringArray = T.nom
	for i in lignes.size():
		Style.texte(ci, lignes[i], Vector2(30, pc.position.y + 8 + 40 * i + 35), 40, Color("#20271f"))
	var cat := ""
	for c in Catalogue.categories():
		if c.id == v.cat: cat = Textes.nom(c.nom).to_upper()
	var livrees: Array = v.livrees
	var li: int = int(App.reglages.livree) % maxi(1, livrees.size())
	Paddock._espace(ci, "%s · %s" % [cat, Textes.livree(livrees[li]).to_upper()], Vector2(30, pc.position.y + 8 + 40 * lignes.size() + 16.4), 17, Color("#252a22"), 0.51)
	var d := Catalogue.dessin(v.id, li)
	if d.get("vignette"):
		var tex := Style.tex("res://images/vignettes/" + d.vignette)
		var zone := Rect2(rv.position.x + 7, pc.end.y, 356, rv.size.y - 4 - hc)
		var e := minf(zone.size.x / tex.get_width(), zone.size.y / tex.get_height())
		var t := Vector2(tex.get_width(), tex.get_height()) * e
		ci.draw_texture_rect(tex, Rect2(zone.get_center() - t / 2, t), false)
	ci.draw_rect(rv.grow(-1), Color("#20251f"), false, 2)
	# Les livrées
	if T.has("livrees"): ci.draw_rect(T.livrees, PC_CREME)
	# Les caractéristiques : trois par ligne, sans pictogramme au téléphone
	var rs: Rect2 = T.stats
	ci.draw_rect(rs, PC_CREME)
	ci.draw_rect(Rect2(rs.position.x, rs.end.y - 2, rs.size.x, 2), PC_TRAIT)
	var p: Dictionary = v.perf
	var fr := Textes.langue() == "fr"
	var nb := func(x: float, n: int) -> String: return (("%." + str(n) + "f") % x).replace(".", "," if fr else ".")
	var items := [[str(roundi(p.vmax)), "km/h", Textes.t("statVmax")], ["0-100 : " + nb.call(p.a100, 1), "s", Textes.t("statAcc")],
		[nb.call(p.b100, 1), "m", Textes.t("statFrein")], [nb.call(p.gripG, 2), "g", Textes.t("statGrip")]]
	for i in items.size():
		var x := 18.0 + (i % 3) * 120
		var y := rs.position.y + 8 + (i / 3) * 39
		Style.texte(ci, items[i][0], Vector2(x, y + 18.3), 20, Color("#20261e"))
		Style.texte(ci, items[i][1], Vector2(x + Style.largeur(items[i][0], 20) + 3, y + 18.3), 13, Color("#20261e"))
		Paddock._espace(ci, String(items[i][2]).to_upper(), Vector2(x, y + 30.3), 11, Color("#4b4e44"), 0.66)
	# Le rail des voitures
	ci.draw_rect(T.rail, PC_CREME)
	# La feuille du circuit : son liseré d'encre, son ombre, son papier
	var f: Rect2 = T.feuille
	ci.draw_rect(Rect2(f.position + Vector2(5, 7), f.size), Color(0.09, 0.106, 0.098, 0.4))
	ci.draw_rect(f.grow(2), Color("#20251f"))
	ci.draw_rect(f, PC_FEUILLE)
	var cid: String = App.reglages.circuit
	var info: Dictionary = infoCircuits.get(cid, infoCircuits.values()[0])
	var rp: Rect2 = T.piste
	var ht: float = T.tete
	ci.draw_rect(rp, Color("#6b8171"))
	Style.couvre(ci, info.image, rp, 0.5)
	ci.draw_colored_polygon(PackedVector2Array([rp.position, Vector2(rp.end.x, rp.position.y), Vector2(rp.end.x, rp.position.y + ht * 0.93), Vector2(rp.position.x, rp.position.y + ht)]), PC_CREME)
	var lc: PackedStringArray = T.nomC
	for i in lc.size():
		Style.texte(ci, lc[i], Vector2(27, rp.position.y + 12 + 34.2 * i + 30.6), 36, Color("#272b28"))
	var ysous := rp.position.y + 12 + 34.2 * lc.size() + 7
	Paddock._espace(ci, Paddock.infoPiste(info, race),
		Vector2(27, ysous + 17.75), 18, Color("#272b28"), 0.36)
	var dr := Style.drapeau(info.pays)
	if dr:
		var rd := Rect2(318, rp.position.y + 12, 45, 34)
		Style.couvre(ci, dr, rd, 0.5)
		ci.draw_rect(rd, Color(0.145, 0.165, 0.133, 0.2), false, 1)
	var im := Rect2(rp.position.x + 18, rp.position.y + ht + 4, 324, rp.size.y - ht - 12)
	Paddock._contour(ci, info, im.grow(-10), false, 5.0, true)
	# La liste de la catégorie
	_listeTel(ci, cid, v)
	# Les réglages
	var rr: Rect2 = T.reglages
	ci.draw_rect(rr, PC_CREME)
	ci.draw_rect(Rect2(rr.position.x, rr.position.y, rr.size.x, 3), PC_TRAIT)
	if T.has("nuitTexte"):
		var nt: PackedStringArray = T.nuitTexte
		for i in nt.size(): Style.texte(ci, nt[i], Vector2(18, float(T.nuitY) + 16 * i + 12.9), 13, T_MUET)


## LA LISTE DE LA CATÉGORIE, AU TÉLÉPHONE (js/ui.js, records et palmaresListe) : l'en-tête, puis une
## ligne arrondie par voiture (52 de haut, 6 d'écart), dans la page qui défile.
func _listeTel(ci: CanvasItem, cid: String, v: Dictionary) -> void:
	var course := mode == "race"
	var yl: float = T.liste
	var encre := Color("#262b26")
	if course:
		_espace(ci, Textes.t("palmares").to_upper(), Vector2(15, yl + 20.6), 15, encre, 1.5)
		var e := Mondial.nuage()
		var tx := Textes.t("nuage_" + e)
		var xt := 375 - float(T.get("decaleNuage", 0.0)) - Style.largeur(tx, 13)
		ci.draw_texture_rect(Palmares.nuage(e, 90), Rect2(xt - 36, yl + 4, 30, 22), false)
		Style.texte(ci, tx, Vector2(xt, yl + 19.9), 13, Color("#7b776e"))
	else:
		_espace(ci, Textes.t("yourBestTitle").to_upper(), Vector2(15, yl + 26.6), 15, encre, 1.5)
	var note: PackedStringArray = T.note
	var cn := Color("#a3271c") if T.get("alerte", false) else T_MUET
	for i in note.size(): Style.texte(ci, note[i], Vector2(15, float(T.yNote) + 16 * i + 12.9), 13, cn)
	# les têtes de colonnes
	var yh: float = T.yTete
	var muet := PC_MUET
	if course:
		_espace(ci, Textes.t("palmaresTrophee").to_upper(), Vector2(175, yh + 9.75), 10, muet, 0.8)
		var tn := Textes.t("palmaresNiveau").to_upper()
		_espace(ci, tn, Vector2(361 - _largeurEspace(tn, 10, 0.8), yh + 9.75), 10, muet, 0.8)
	else:
		# la police du système (system-ui 700), comme le jeu web
		var sys := ThemeDB.fallback_font
		for c in [[Textes.t("colRecord").to_upper(), 269.0], [Textes.t("colMonde").to_upper(), 361.0]]:
			var lib: String = c[0]
			var w := sys.get_string_size(lib, HORIZONTAL_ALIGNMENT_LEFT, -1, 10).x + (lib.length() - 1) * 0.8
			var xc: float = c[1] - w
			for i in lib.length():
				ci.draw_string(sys, Vector2(xc + sys.get_string_size(lib.substr(0, i), HORIZONTAL_ALIGNMENT_LEFT, -1, 10).x + i * 0.8, yh + 10), lib[i], HORIZONTAL_ALIGNMENT_LEFT, -1, 10, muet)
	# les voitures de la catégorie : en course, du meilleur trophée au moins bon ; sinon tes temps d'abord
	var voitures := Catalogue.voituresDe(String(v.get("cat", "")))
	var lignes := []
	for i in voitures.size():
		var m: Dictionary = voitures[i]
		lignes.append({ m = m, i = i, b = _record(cid, m.id), n = Palmares.de(cid, m.id) })
	if course:
		lignes.sort_custom(func(a, b): return a.n > b.n if a.n != b.n else a.i < b.i)
	else:
		lignes.sort_custom(func(a, b):
			if (a.b < 0) != (b.b < 0): return a.b >= 0
			if a.b != b.b: return a.b < b.b
			return a.i < b.i)
	var par = null if course else Mondial.meilleurs(cid)
	var y: float = T.yLignes
	for l in lignes:
		var m: Dictionary = l.m
		var choisie: bool = m.id == v.id
		var sb := StyleBoxFlat.new()
		sb.set_corner_radius_all(12)
		sb.bg_color = Color("#ddd0b6") if choisie else Color("#eee3ca")
		if choisie:
			sb.border_color = Color("#b42b26")
			sb.set_border_width_all(2)
		ci.draw_style_box(sb, Rect2(15, y, 360, 52))
		var d := Catalogue.dessin(m.id, int(App.reglages.livree) if choisie else 0)
		if d.get("vignette"):
			var tex := Style.tex("res://images/vignettes/" + d.vignette)
			var e := minf(48.0 / tex.get_width(), 36.0 / tex.get_height())
			var t := Vector2(tex.get_width(), tex.get_height()) * e
			# une voiture sans trophée est à demi effacée (.rline.vierge)
			var voile := Color(1, 1, 1, 0.55) if course and int(l.n) < 0 else Color.WHITE
			ci.draw_texture_rect(tex, Rect2(Vector2(25 + (48 - t.x) / 2, y + 8 + (36 - t.y) / 2), t), false, voile)
		var nl := Paddock._lignes(str(m.nom), 12, 84 if course else 94)
		var yn := y + 26 - nl.size() * 7.0
		for i in nl.size(): Style.texte(ci, nl[i], Vector2(81, yn + 14 * i + 11.5), 12, Color("#272b28"))
		var bas := y + 30.0
		if course:
			var n: int = l.n
			if n >= 0:
				ci.draw_texture_rect(Palmares.texture(n, 78), Rect2(173, y + 13, 26, 26), false)
				Style.texte(ci, _coupe(Textes.t("trophee_" + Palmares.TROPHEES[n]), 13, 74), Vector2(203, bas), 13, Color("#272b28"))
				var nv := Textes.t(Palmares.NIVEAUX[n]).capitalize()
				Style.texte(ci, nv, Vector2(359 - Style.largeur(nv, 13), bas), 13, Color("#272b28"))
			else:
				Style.texte(ci, "—", Vector2(173, bas), 13, T_MUET)
				Style.texte(ci, "—", Vector2(359 - Style.largeur("—", 13), bas), 13, T_MUET)
		else:
			var b: float = l.b
			var tb := Style.temps(b) if b >= 0 else "--:--.---"
			Style.texte(ci, tb, Vector2(267 - Style.largeur(tb, 13), bas), 13, Color("#272b28") if b >= 0 else T_MUET)
			var wd: Dictionary = par.get(m.id, {}) if par is Dictionary else {}
			if par == null:
				Style.texte(ci, "…", Vector2(359 - Style.largeur("…", 13), bas), 13, T_MUET)
			elif wd.is_empty():
				Style.texte(ci, "--:--.---", Vector2(359 - Style.largeur("--:--.---", 13), bas), 13, T_MUET)
			else:
				var tw := Style.temps(float(wd.temps))
				Style.texte(ci, tw, Vector2(359 - Style.largeur(tw, 13), bas - 5), 13, Color("#b48cff"))
				var pil := _coupe(String(wd.get("pilote", "")), 10, 84)
				Style.texte(ci, pil, Vector2(359 - Style.largeur(pil, 10), bas + 7), 10, T_MUET)
		y += 58


## La barre collée en bas, au téléphone : le papier bordé d'encre, son ombre, le damier penché.
func _dessineBarre() -> void:
	if not portrait: return
	var W := barre.size.x
	for i in 20:
		var a := 0.2 * pow(1.0 - i / 20.0, 2) * 0.35
		barre.draw_rect(Rect2(0, -i - 1, W, 1), Color(0, 0, 0, a))
	barre.draw_rect(Rect2(0, 0, W, T_BARRE + 60), PC_CREME)
	barre.draw_rect(Rect2(0, 0, W, 3), PC_TRAIT)
	Style.damier(barre, Rect2(4, 11, 58, 48), 8, PC_CREME, T_NOIR, 12)
