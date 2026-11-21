## Le paddock (js/ui.js, l'écran de préparation) : la catégorie, la voiture et sa livrée, ses
## caractéristiques, le circuit, la difficulté et le nombre de tours. Dessiné sur un cadre de
## 1280 × 720 en paysage, ramené à l'écran ; en portrait, les deux colonnes s'empilent.
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
var ybas := 0.0
var barre: Control                          # la barre du bas, fixe : « En piste » reste à portée du doigt
var _haut := 0.0
const LIGNE := 44.0                         # la hauteur d'une ligne de la liste


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
	barre = Control.new()
	barre.draw.connect(_dessineBarre)
	add_child(barre)
	resized.connect(_construit)
	# le tableau mondial arrive après l'écran, et la connexion revient du navigateur : on repeint
	Mondial.change.connect(_construit)
	get_viewport().gui_focus_changed.connect(_montre)
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
	Style.tex("res://images/interface/logo-grip.webp")
	for v in Catalogue.donnees.voitures:
		for i in (v.livrees as Array).size():
			var d := Catalogue.dessin(v.id, i)
			if d.get("vignette"): Style.tex("res://images/vignettes/" + d.vignette)
	var infos := Paddock.infosCircuits()
	for c in Catalogue.circuits(): Style.drapeau(infos[c.id].pays)


func _input(e: InputEvent) -> void:
	if e is InputEventMouseButton and e.pressed and (e.button_index == MOUSE_BUTTON_WHEEL_DOWN or e.button_index == MOUSE_BUTTON_WHEEL_UP):
		_defile(60.0 if e.button_index == MOUSE_BUTTON_WHEEL_DOWN else -60.0)
	elif e is InputEventScreenDrag:
		_defile(-e.relative.y / cadre.scale.y)


## La manette (stick droit) et le clavier (page précédente, page suivante) font aussi défiler ;
## un bouton qui prend le focus hors de l'écran est ramené dans la vue.
func _process(dt: float) -> void:
	var a := Input.get_joy_axis(0, JOY_AXIS_RIGHT_Y)
	if absf(a) > 0.25: _defile(a * 900.0 * dt)


func _montre(c: Control) -> void:
	if c == null or c.get_parent() != cadre: return
	var k := cadre.scale.y
	var vue := (size.y - barre.size.y * k) / k          # ce qu'on voit du cadre, au-dessus de la barre
	if c.position.y < defile + 10: _defile(c.position.y - 10 - defile)
	elif c.position.y + c.size.y > defile + vue - 10: _defile(c.position.y + c.size.y - (defile + vue - 10))


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
func _bouton(t: String, r: Rect2, f: Color, e: Color, taille: int, action: Callable) -> Bouton:
	var b := Bouton.new(t, f, e, taille)
	b.position = r.position
	b.size = r.size
	b.pressed.connect(action)
	cadre.add_child(b)
	return b


func _construit() -> void:
	var focus := get_viewport().gui_get_focus_owner() if is_inside_tree() else null
	var cle: String = focus.get_meta("cle", "") if focus else ""
	for c in cadre.get_children(): c.queue_free()
	for c in barre.get_children(): c.queue_free()
	portrait = size.x < size.y
	var W := 1280.0 if not portrait else 780.0
	# le cadre de référence fait 720 de haut en paysage ; ce qui dépasse (la liste) défile, comme la
	# page du jeu web, sous la barre du bas qui, elle, reste en place
	var k := minf(size.x / W, size.y / 720.0) if not portrait else size.x / W
	var hBarre := 74.0 if not portrait else 84.0
	var x0 := (size.x - W * k) / 2
	_haut = 0.0
	cadre.scale = Vector2(k, k)
	barre.scale = Vector2(k, k)
	barre.size = Vector2(W, hBarre)
	barre.position = Vector2(x0, size.y - hBarre * k)
	# le panneau du circuit : à droite en paysage ; en portrait, sous la voiture, sur toute la largeur ;
	# dessous, la liste de toute la catégorie (js/ui.js, records et palmaresListe)
	carte = Rect2(790, 92, 468, 392) if not portrait else Rect2(18, 650, 744, 392)
	var nListe := Catalogue.voituresDe(String(Catalogue.voiture(App.reglages.voiture).get("cat", ""))).size()
	liste = Rect2(carte.position.x, carte.end.y + 12, carte.size.x, Paddock.teteListe(mode) + nListe * LIGNE + 10)
	var nc := 3 if not portrait else 5          # les circuits visibles dans la rangée
	# En-tête
	_bouton(Textes.t("back"), Rect2(18, 10, 120, 64), Style.NUIT_PLEINE, Style.CREME, 22, func(): App.aller("accueil")).set_meta("cle", "retour")
	# Onglets
	var onglets := [["tous", Textes.t("all")]]
	for c in Catalogue.categories(): onglets.append([c.id, Textes.nom(c.nom).to_upper()])
	var x := 30.0
	for o in onglets:
		var w := Style.largeur(o[1], 24) + 34
		var b := _bouton(o[1], Rect2(x, 90, w, 44), Style.ROUGE if filtre == o[0] else Style.NUIT_PLEINE, Style.CREME, 24, func(): filtre = o[0]; debutVoitures = 0; _construit())
		b.centre = true
		b.set_meta("cle", "onglet-" + o[0])
		x += w + 6
	# Livrées
	var v := Catalogue.voiture(App.reglages.voiture)
	var livrees: Array = v.livrees
	var lw := (744.0 - 8 * (livrees.size() - 1)) / livrees.size() if livrees.size() > 1 else 240.0
	for i in livrees.size():
		var d := Catalogue.dessin(v.id, i)
		var b := _bouton(Textes.livree(livrees[i]).to_upper(), Rect2(26 + i * (lw + 8), 358, lw, 82), Style.NUIT_PLEINE, Style.CREME, 15, func(): App.reglages.livree = i; App.sauve(); _construit())
		b.choisi = int(App.reglages.livree) % livrees.size() == i
		b.set_meta("cle", "livree-%d" % i)
		b.set_meta("vignette", d.get("vignette"))
		b.centre = true
		b.ligne = 72
		b.dessinPlus = _vignetteLivree.bind(b)
	# Voitures
	var rail: Array = Catalogue.donnees.voitures.filter(func(c): return filtre == "tous" or c.cat == filtre)
	var visibles := 5
	debutVoitures = clampi(debutVoitures, 0, maxi(0, rail.size() - visibles))
	_bouton("‹", Rect2(18, 552, 30, 46), Style.NUIT_PLEINE, Style.CREME, 30, func(): debutVoitures -= visibles; _construit()).set_meta("cle", "v-gauche")
	_bouton("›", Rect2(734, 552, 30, 46), Style.NUIT_PLEINE, Style.CREME, 30, func(): debutVoitures += visibles; _construit()).set_meta("cle", "v-droite")
	for i in mini(visibles, rail.size() - debutVoitures):
		var c: Dictionary = rail[debutVoitures + i]
		var b := _bouton(str(c.nom).to_upper(), Rect2(52 + i * 136, 516, 130, 118), Style.PAPIER, Style.ENCRE, 16, func(): _choisitVoiture(c.id))
		b.choisi = c.id == App.reglages.voiture
		b.set_meta("cle", "voiture-" + c.id)
		b.set_meta("voiture", c)
		b.centre = true
		b.ligne = 84
		b.dessinPlus = Paddock._carteVoiture.bind(b)
	# Circuits
	var circuits := Catalogue.circuits()
	debutCircuits = clampi(debutCircuits, 0, maxi(0, circuits.size() - nc))
	var cx := carte.position.x
	var cy := carte.position.y
	_bouton("‹", Rect2(cx + 10, cy + 270, 26, 46), Style.NUIT_PLEINE, Style.CREME, 30, func(): debutCircuits -= nc; _construit()).set_meta("cle", "c-gauche")
	_bouton("›", Rect2(carte.end.x - 36, cy + 270, 26, 46), Style.NUIT_PLEINE, Style.CREME, 30, func(): debutCircuits += nc; _construit()).set_meta("cle", "c-droite")
	for i in mini(nc, circuits.size() - debutCircuits):
		var c: Dictionary = circuits[debutCircuits + i]
		var b := _bouton(str(c.nom).to_upper(), Rect2(cx + 40 + i * 130, cy + 208, 124, 170), Style.PAPIER, Style.ENCRE, 15, func(): App.reglages.circuit = c.id; App.reglages.tours = infoCircuits[c.id].tours; App.sauve(); _construit())
		b.choisi = c.id == App.reglages.circuit
		b.set_meta("cle", "circuit-" + c.id)
		b.set_meta("circuit", c.id)
		b.centre = true
		b.ligne = 112
		b.dessinPlus = Paddock._carteCircuit.bind(b)
	# Le tableau mondial : se connecter avec Google, ou renoncer à la connexion en cours
	if Mondial.connexionPossible() and (Mondial.enCours or not Mondial.connecte()):
		var txt := Textes.t("signInCancel") if Mondial.enCours else Textes.t("signIn")
		var lb := Style.largeur(txt, 15) + 28
		var bg := _bouton(txt, Rect2(liste.end.x - lb - 14, liste.position.y + 12, lb, 30), Style.NUIT_PLEINE, Style.CREME, 15,
			func(): (Mondial.annuler() if Mondial.enCours else Mondial.entrer()))
		bg.centre = true
		bg.set_meta("cle", "google")
	# La barre du bas
	# la barre : les réglages et « En piste » en paysage, fixes en bas ; en portrait, les réglages
	# suivent la liste et seul « En piste » reste en bas
	ybas = 13.0 if not portrait else liste.end.y + 22
	var yb := ybas
	var dif := _nom(DIFFICULTES, App.reglages.difficulte)
	x = 30.0
	var reglagesBas := []
	reglagesBas.append([Textes.t("dayNight", Textes.t("night" if App.reglages.nuit else "day")), func(): App.reglages.nuit = not App.reglages.nuit; App.sauve(); _construit(), "nuit"])
	if mode == "race":
		# les dégâts, une option (oui par défaut), comme le paddock du jeu web
		var dg := bool(App.reglages.get("degats", true))
		reglagesBas.append([Textes.t("chipDegats") + " : " + Textes.t("on" if dg else "off"), func(): App.reglages.degats = not dg; App.sauve(); _construit(), "degats"])
		reglagesBas.append([Textes.t("difficulty", dif), func(): App.reglages.difficulte = _suivant(DIFFICULTES, App.reglages.difficulte); App.sauve(); _construit(), "difficulte"])
		reglagesBas.append([Textes.t("laps", int(App.reglages.tours)), func(): App.reglages.tours = int(App.reglages.tours) % 10 + 1; App.sauve(); _construit(), "tours"])
		reglagesBas.append([Textes.t("opponents", int(App.reglages.adversaires) - 1), func(): App.reglages.adversaires = (int(App.reglages.adversaires) - 1) % 11 + 2; App.sauve(); _construit(), "adversaires"])
	for r in reglagesBas:
		var w := Style.largeur(r[0], 20) + 36
		# en portrait, les réglages passent à la ligne au lieu de sortir de l'écran
		if portrait and x > 30 and x + w > W - 18:
			x = 30.0; yb += 58
		var b := _bouton(r[0], Rect2(x, yb, w, 48), Style.NUIT_PLEINE, Style.CREME, 20, r[1])
		if not portrait:
			b.reparent(barre, false)
		b.centre = true
		b.set_meta("cle", r[2])
		x += w + 10
	# « En piste » : à droite de la barre en paysage ; en portrait, sur toute la largeur
	var rGo := Rect2(1050, 9, 200, 56) if not portrait else Rect2(18, 12, W - 36, 60)
	hauteur = maxf(720.0 if not portrait else 0.0, (yb + 48 + 24 if portrait else liste.end.y + 20) + hBarre)
	cadre.size = Vector2(W, hauteur)
	cadre.position.x = x0
	_defile(0)          # la page garde sa place quand on la refait (le tableau mondial qui arrive, un choix)
	var go := _bouton(Textes.t("onTrack"), rGo, Style.ROUGE, Style.CREME, 30, _enPiste)
	go.reparent(barre, false)
	go.centre = true
	go.set_meta("cle", "go")
	cadre.queue_redraw()
	barre.queue_redraw()
	# Le focus revient où il était (la manette et le clavier ne perdent pas leur place).
	var cible: Control = null
	var tous := cadre.get_children() + barre.get_children()
	for c in tous:
		if c.get_meta("cle", "") == cle and not c.is_queued_for_deletion(): cible = c
	if cible == null:
		for c in tous:
			if c.get_meta("cle", "") == "go" and not c.is_queued_for_deletion(): cible = c
	if cible: cible.grab_focus.call_deferred()


static func _nom(liste: Array, id: String) -> String:
	for e in liste:
		if e[0] == id: return Textes.t(e[1])
	return Textes.t(liste[0][1])


static func _suivant(liste: Array, id: String) -> String:
	for i in liste.size():
		if liste[i][0] == id: return liste[(i + 1) % liste.size()][0]
	return liste[0][0]


func _choisitVoiture(id: String) -> void:
	App.reglages.voiture = id
	App.reglages.cat = Catalogue.voiture(id).cat
	App.reglages.livree = 0
	App.sauve()
	_construit()


func _enPiste() -> void:
	App.reglages.mode = mode
	App.sauve()
	App.aller("course")


# ---------- le dessin ----------
## Le fond du menu : l'image du paddock sur tout l'écran, comme le jeu web (#ui, center / cover).
func _draw() -> void:
	Style.couvre(self, fondPaddock, Rect2(Vector2.ZERO, size), 0.5)


func _dessine() -> void:
	var ci := cadre
	# En-tête
	var W := cadre.size.x
	Style.biseau(ci, Rect2(18, 10, W - 36, 64), Style.NUIT_PLEINE, 0)
	Style.damier(ci, Rect2(140, 10, 80, 64), 4, Style.CREME, Style.NUIT_PLEINE, 0)
	Style.biseau(ci, Rect2(214, 10, 320, 64), Style.ROUGE, 22)
	Style.texte(ci, Textes.t({ race = "quickRace", timetrial = "timeTrial", training = "training" }.get(mode, "quickRace")), Vector2(236, 58), 38, Style.CREME)
	var logo := Style.tex("res://images/interface/logo-grip.webp")
	if not portrait:
		ci.draw_texture_rect(logo, Rect2(W - 210, 16, 190, 190 * logo.get_height() / logo.get_width()), false)
	# Onglets
	Style.biseau(ci, Rect2(18, 84, 744, 54), Style.PAPIER, 12)
	# La voiture
	var v := Catalogue.voiture(App.reglages.voiture)
	var cat := ""
	for c in Catalogue.categories():
		if c.id == v.cat: cat = Textes.nom(c.nom).to_upper()
	var livrees: Array = v.livrees
	var li: int = int(App.reglages.livree) % maxi(1, livrees.size())
	Style.biseau(ci, Rect2(18, 148, 744, 70), Style.PAPIER, 14)
	Style.texte(ci, str(v.nom).to_upper(), Vector2(32, 194), 44, Style.ENCRE)
	Style.texte(ci, "%s · %s" % [cat, Textes.livree(livrees[li]).to_upper()], Vector2(34, 213), 17, Color(Style.ENCRE, 0.8))
	# La voiture dans le garage (.paddock-car) : un cadre dont le fond est l'image du paddock,
	# la voiture posée sur le sol, devant les servantes et les pneus.
	var scene := Rect2(18, 222, 744, 130)
	Style.couvre(ci, fondPaddock, scene, 0.5)
	ci.draw_rect(scene, Style.NUIT_PLEINE, false, 2)
	var d := Catalogue.dessin(v.id, li)
	if d.get("vignette"):
		var tex := Style.tex("res://images/vignettes/" + d.vignette)
		var h := 124.0
		var w := h * tex.get_width() / tex.get_height()
		ci.draw_texture_rect(tex, Rect2(scene.position.x + (scene.size.x - w) / 2, scene.end.y - h - 2, w, h), false)
	# Les caractéristiques
	Style.biseau(ci, Rect2(18, 450, 744, 54), Style.PAPIER, 12)
	var p: Dictionary = v.perf
	var stats := [["%d km/h" % roundi(p.vmax), Textes.t("statVmax")], ["%.1f s" % p.a100, Textes.t("statA100")], ["%.1f m" % p.b100, Textes.t("statB100")], ["%.2f g" % p.gripG, Textes.t("statGrip")]]
	for i in 4:
		var x := 36 + i * 186
		Style.texte(ci, stats[i][0], Vector2(x, 478), 26, Style.ENCRE)
		Style.texte(ci, stats[i][1], Vector2(x, 497), 13, Color(Style.ENCRE, 0.75))
	ci.draw_rect(Rect2(18, 506, 744, 3), Style.NUIT_PLEINE)
	# Le circuit
	var cid: String = App.reglages.circuit
	var info: Dictionary = infoCircuits.get(cid, infoCircuits.values()[0])
	var r := carte
	ci.draw_rect(Rect2(r.position + Vector2(4, 4), r.size), Color(0, 0, 0, 0.35))
	ci.draw_rect(r, Style.PAPIER)
	ci.draw_rect(r, Style.NUIT_PLEINE, false, 3)
	Style.texte(ci, str(info.nom).to_upper(), r.position + Vector2(14, 52), 40, Style.ENCRE)
	var dr := Style.drapeau(info.pays)
	if dr: ci.draw_texture_rect(dr, Rect2(r.end.x - 82, r.position.y + 16, 62, 42), false)
	Style.texte(ci, Textes.t("trackInfo", [Textes.pays(info.pays).to_upper(), roundi(info.longueur), int(App.reglages.tours) if mode == "race" else 0]),
		r.position + Vector2(14, 82), 18, Color(Style.ENCRE, 0.85))
	var ir := Rect2(r.position.x + 2, r.position.y + 94, r.size.x - 4, 96)
	Style.couvre(ci, info.image, ir, 0.5)
	Paddock._contour(ci, info, ir.grow(-8))
	# Sous le circuit, toute la catégorie : les temps (contre-la-montre, entraînement) ou le palmarès
	_liste(ci, cid, v)
	if portrait: ci.draw_rect(Rect2(18, ybas - 10, W - 36, 3), Style.NUIT_PLEINE)


## La barre du bas, fixe : un fond papier bordé d'encre, comme la barre collante du jeu web sur
## téléphone ; en paysage, le damier entre les réglages et « En piste ».
func _dessineBarre() -> void:
	var W := barre.size.x
	var fond := Rect2(Vector2.ZERO, barre.size + Vector2(0, 40))
	barre.draw_rect(fond, Color(Style.PAPIER, 0.96))
	barre.draw_rect(Rect2(0, 0, W, 3), Style.NUIT_PLEINE)
	if not portrait: Style.damier(barre, Rect2(980, 9, 76, 56), 4, Style.NUIT_PLEINE, Color(0, 0, 0, 0), 0)


## La hauteur de l'en-tête de la liste : le titre et l'état du tableau ; en course, le nuage et la règle.
static func teteListe(m: String) -> float:
	return 118.0 if m == "race" else 100.0


## LA LISTE DE LA CATÉGORIE (js/ui.js, records et palmaresListe) : une ligne par voiture.
## Au contre-la-montre et à l'entraînement, ton meilleur tour et le record du monde, les voitures où
## tu as un temps d'abord ; en course rapide, le trophée gagné et son niveau, du meilleur au moins bon.
func _liste(ci: CanvasItem, cid: String, v: Dictionary) -> void:
	var r := liste
	ci.draw_rect(Rect2(r.position + Vector2(4, 4), r.size), Color(0, 0, 0, 0.35))
	ci.draw_rect(r, Style.PAPIER)
	ci.draw_rect(r, Style.NUIT_PLEINE, false, 3)
	var x := r.position.x
	var y := r.position.y
	var lw := r.size.x
	var course := mode == "race"
	var titre := Textes.t("palmares") if course else Textes.t("yourBestTitle")
	Style.texte(ci, titre, Vector2(x + 14, y + 34), 22, Style.ENCRE)
	var muet := Color(Style.ENCRE, 0.75)
	if course:
		var e := Mondial.nuage()
		ci.draw_texture_rect(Palmares.nuage(e, 24), Rect2(x + 14, y + 46, 24, 17), false)
		Style.texte(ci, Textes.t("nuage_" + e), Vector2(x + 44, y + 60), 14, muet)
		ci.draw_multiline_string(Style.racing(), Vector2(x + 14, y + 82), Textes.t("palmaresRegle", Palmares.TOURS_MIN), HORIZONTAL_ALIGNMENT_LEFT, lw - 28, 13, 2, muet)
	else:
		var et := Mondial.etat()
		ci.draw_multiline_string(Style.racing(), Vector2(x + 14, y + 60), et.texte, HORIZONTAL_ALIGNMENT_LEFT, lw - 28, 14, 2,
			Color("#a3271c") if et.alerte else muet)
	# les têtes de colonnes
	var c1 := lw - 210.0          # ton record, ou le trophée
	var c2 := lw - 100.0          # le monde, ou le niveau
	var tete := Paddock.teteListe(mode)
	Style.texte(ci, Textes.t("palmaresTrophee" if course else "colRecord"), Vector2(x + c1, y + tete - 8), 13, muet, HORIZONTAL_ALIGNMENT_LEFT, 110)
	Style.texte(ci, Textes.t("palmaresNiveau" if course else "colMonde"), Vector2(x + c2, y + tete - 8), 13, muet, HORIZONTAL_ALIGNMENT_LEFT, 90)
	# les voitures de la catégorie
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
	var yl := y + tete
	for l in lignes:
		var m: Dictionary = l.m
		var choisie: bool = m.id == v.id
		var rl := Rect2(x + 10, yl, lw - 20, LIGNE - 6)
		ci.draw_rect(rl, Color("#e3d6b8") if choisie else Color("#efe4c9"))
		if choisie: ci.draw_rect(rl, Style.ROUGE, false, 2.5)
		var d := Catalogue.dessin(m.id, int(App.reglages.livree) if choisie else 0)
		if d.get("vignette"):
			var tex := Style.tex("res://images/vignettes/" + d.vignette)
			var h := 30.0
			var w := minf(56.0, h * tex.get_width() / tex.get_height())
			ci.draw_texture_rect(tex, Rect2(x + 18, yl + (LIGNE - 6 - h) / 2, w, h), false)
		var bas := yl + (LIGNE - 6) / 2 + 6
		Style.texte(ci, str(m.nom), Vector2(x + 82, bas), 16, Style.ENCRE, HORIZONTAL_ALIGNMENT_LEFT, c1 - 92)
		if course:
			var n: int = l.n
			if n >= 0:
				ci.draw_texture_rect(Palmares.texture(n, 28), Rect2(x + c1, yl + 4, 28, 28), false)
				Style.texte(ci, Textes.t("trophee_" + Palmares.TROPHEES[n]), Vector2(x + c1 + 32, bas), 14, Style.ENCRE, HORIZONTAL_ALIGNMENT_LEFT, c2 - c1 - 36)
				Style.texte(ci, Textes.t(Palmares.NIVEAUX[n]).capitalize(), Vector2(x + c2, bas), 14, Style.ENCRE, HORIZONTAL_ALIGNMENT_LEFT, 90)
			else:
				Style.texte(ci, "—", Vector2(x + c1, bas), 16, muet)
				Style.texte(ci, "—", Vector2(x + c2, bas), 16, muet)
		else:
			var b: float = l.b
			Style.texte(ci, Style.temps(b) if b >= 0 else "--:--.---", Vector2(x + c1, bas), 16, Style.ENCRE if b >= 0 else muet, HORIZONTAL_ALIGNMENT_LEFT, 100)
			var wd: Dictionary = par.get(m.id, {}) if par is Dictionary else {}
			if par == null:
				Style.texte(ci, "…", Vector2(x + c2, bas), 16, muet)
			elif wd.is_empty():
				Style.texte(ci, "--:--.---", Vector2(x + c2, bas), 16, muet, HORIZONTAL_ALIGNMENT_LEFT, 90)
			else:
				Style.texte(ci, Style.temps(float(wd.temps)), Vector2(x + c2, bas - 6), 16, Style.ENCRE, HORIZONTAL_ALIGNMENT_LEFT, 90)
				Style.texte(ci, String(wd.get("pilote", "")), Vector2(x + c2, bas + 8), 11, muet, HORIZONTAL_ALIGNMENT_LEFT, 90)
		yl += LIGNE


static func _contour(ci: CanvasItem, info: Dictionary, r: Rect2) -> void:
	var b: Dictionary = info.bornes
	var w: float = b.maxX - b.minX
	var h: float = b.maxY - b.minY
	var k := minf(r.size.x / w, r.size.y / h)
	var o := r.position + (r.size - Vector2(w, h) * k) / 2
	var pts := PackedVector2Array()
	for p in info.contour: pts.append(o + (p - Vector2(b.minX, b.minY)) * k)
	ci.draw_polyline(pts, Color(0, 0, 0, 0.75), 7, true)
	ci.draw_polyline(pts, Color.WHITE, 3, true)


func _record(circuit: String, voiture: String) -> float:
	var recs: Dictionary = App.reglages.get("records", {})
	return float(recs.get(circuit + "/" + voiture, -1.0))


func _vignetteLivree(b: Bouton) -> void:
	var v = b.get_meta("vignette")
	if v:
		var tex := Style.tex("res://images/vignettes/" + v)
		var h := b.size.y * 0.55
		var w := h * tex.get_width() / tex.get_height()
		b.draw_texture_rect(tex, Rect2((b.size.x - w) / 2, 4, w, h), false)


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
	Paddock._contour(b, info, ir.grow(-10))
	var dr := Style.drapeau(info.pays)
	if dr: b.draw_texture_rect(dr, Rect2(20, b.size.y - 30, 22, 15), false)
	Style.texte(b, "%d m" % roundi(info.longueur), Vector2(48, b.size.y - 17), 15, Style.ENCRE)
