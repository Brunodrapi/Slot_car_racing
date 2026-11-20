## Le paddock (js/ui.js, l'écran de préparation) : la catégorie, la voiture et sa livrée, ses
## caractéristiques, le circuit, la difficulté et le nombre de tours. Dessiné sur un cadre de
## 1280 × 720 en paysage, ramené à l'écran ; en portrait, les deux colonnes s'empilent.
class_name Paddock
extends Control

const PAYS := { IT = "Italie", BE = "Belgique", MC = "Monaco", GB = "Royaume-Uni", JP = "Japon", BR = "Brésil",
	US = "États-Unis", DE = "Allemagne", FR = "France", AU = "Australie", AT = "Autriche", NL = "Pays-Bas" }
const DIFFICULTES := [["easy", "FACILE"], ["medium", "NORMAL"], ["hard", "DIFFICILE"], ["extreme", "EXTRÊME"], ["cauchemar", "CAUCHEMAR"]]
const VUES := [["avanceFixe", "DEVANT"], ["avance", "TOURNANTE"]]

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


func _init(m: String) -> void:
	mode = m


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	fondPaddock = load("res://images/interface/paddock.webp")
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
		infoCircuits[c.id] = { nom = c.nom, pays = meta.pays, longueur = blob[int(sc[0]) + 2], tours = int(meta.tours), contour = contour, bornes = meta.bornes,
			image = load("res://images/interface/circuits/%s.webp" % c.id) }
	if Catalogue.voiture(App.reglages.voiture).is_empty(): App.reglages.voiture = "porsche991gt3r"
	filtre = App.reglages.cat
	# Tout ce qui se dessine est chargé avant le premier dessin.
	Style.tex("res://images/interface/logo-grip.webp")
	for v in Catalogue.donnees.voitures:
		for i in (v.livrees as Array).size():
			var d := Catalogue.dessin(v.id, i)
			if d.get("vignette"): Style.tex("res://images/vignettes/" + d.vignette)
	for c in Catalogue.circuits(): Style.drapeau(infoCircuits[c.id].pays)
	cadre = Control.new()
	cadre.draw.connect(_dessine)
	add_child(cadre)
	resized.connect(_construit)
	_construit()


func _input(e: InputEvent) -> void:
	if not portrait: return
	if e is InputEventMouseButton and e.pressed and (e.button_index == MOUSE_BUTTON_WHEEL_DOWN or e.button_index == MOUSE_BUTTON_WHEEL_UP):
		_defile(60.0 if e.button_index == MOUSE_BUTTON_WHEEL_DOWN else -60.0)
	elif e is InputEventScreenDrag:
		_defile(-e.relative.y / cadre.scale.y)


func _defile(d: float) -> void:
	defile = clampf(defile + d, 0, maxf(0, hauteur - size.y / cadre.scale.y))
	cadre.position.y = -defile * cadre.scale.y


func _unhandled_input(e: InputEvent) -> void:
	if e.is_action_pressed("ui_cancel"):
		App.aller("accueil")


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
	portrait = size.x < size.y
	var W := 1280.0
	hauteur = 720.0
	if portrait:
		W = 780.0
		hauteur = 1320.0
	var k := minf(size.x / W, size.y / hauteur) if not portrait else size.x / W
	cadre.scale = Vector2(k, k)
	cadre.size = Vector2(W, hauteur)
	cadre.position = Vector2((size.x - W * k) / 2, 0 if portrait else (size.y - hauteur * k) / 2)
	defile = 0.0
	var dx := 0.0 if not portrait else 18.0 - 790.0     # le panneau du circuit, sous la colonne en portrait
	var dy := 0.0 if not portrait else 640.0
	# En-tête
	_bouton("← RETOUR", Rect2(18, 10, 120, 64), Style.NUIT_PLEINE, Style.CREME, 22, func(): App.aller("accueil")).set_meta("cle", "retour")
	# Onglets
	var onglets := [["tous", "TOUTES"]]
	for c in Catalogue.categories(): onglets.append([c.id, str(c.nom.fr).to_upper()])
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
		var b := _bouton(str(livrees[i].nom).to_upper(), Rect2(26 + i * (lw + 8), 358, lw, 82), Style.NUIT_PLEINE, Style.CREME, 15, func(): App.reglages.livree = i; App.sauve(); _construit())
		b.choisi = int(App.reglages.livree) % livrees.size() == i
		b.set_meta("cle", "livree-%d" % i)
		b.set_meta("vignette", d.get("vignette"))
		b.centre = true
		b.ligne = 72
		b.dessinPlus = _vignetteLivree.bind(b)
	# Voitures
	var liste: Array = Catalogue.donnees.voitures.filter(func(c): return filtre == "tous" or c.cat == filtre)
	var visibles := 5
	debutVoitures = clampi(debutVoitures, 0, maxi(0, liste.size() - visibles))
	_bouton("‹", Rect2(18, 552, 30, 46), Style.NUIT_PLEINE, Style.CREME, 30, func(): debutVoitures -= visibles; _construit()).set_meta("cle", "v-gauche")
	_bouton("›", Rect2(734, 552, 30, 46), Style.NUIT_PLEINE, Style.CREME, 30, func(): debutVoitures += visibles; _construit()).set_meta("cle", "v-droite")
	for i in mini(visibles, liste.size() - debutVoitures):
		var c: Dictionary = liste[debutVoitures + i]
		var b := _bouton(str(c.nom).to_upper(), Rect2(52 + i * 136, 516, 130, 118), Style.PAPIER, Style.ENCRE, 16, func(): _choisitVoiture(c.id))
		b.choisi = c.id == App.reglages.voiture
		b.set_meta("cle", "voiture-" + c.id)
		b.set_meta("voiture", c)
		b.centre = true
		b.ligne = 84
		b.dessinPlus = _carteVoiture.bind(b)
	# Circuits
	var circuits := Catalogue.circuits()
	debutCircuits = clampi(debutCircuits, 0, maxi(0, circuits.size() - 3))
	_bouton("‹", Rect2(800 + dx, 362 + dy, 26, 46), Style.NUIT_PLEINE, Style.CREME, 30, func(): debutCircuits -= 3; _construit()).set_meta("cle", "c-gauche")
	_bouton("›", Rect2(1222 + dx, 362 + dy, 26, 46), Style.NUIT_PLEINE, Style.CREME, 30, func(): debutCircuits += 3; _construit()).set_meta("cle", "c-droite")
	for i in mini(3, circuits.size() - debutCircuits):
		var c: Dictionary = circuits[debutCircuits + i]
		var b := _bouton(str(c.nom).to_upper(), Rect2(830 + i * 130 + dx, 300 + dy, 124, 170), Style.PAPIER, Style.ENCRE, 15, func(): App.reglages.circuit = c.id; App.reglages.tours = infoCircuits[c.id].tours; App.sauve(); _construit())
		b.choisi = c.id == App.reglages.circuit
		b.set_meta("cle", "circuit-" + c.id)
		b.set_meta("circuit", c.id)
		b.centre = true
		b.ligne = 112
		b.dessinPlus = _carteCircuit.bind(b)
	# La barre du bas
	var yb := 654.0 if not portrait else 1250.0
	var dif := _nom(DIFFICULTES, App.reglages.difficulte)
	x = 30.0
	var reglagesBas := []
	if mode == "race":
		reglagesBas.append(["DIFFICULTÉ : " + dif, func(): App.reglages.difficulte = _suivant(DIFFICULTES, App.reglages.difficulte); App.sauve(); _construit(), "difficulte"])
		reglagesBas.append(["TOURS : %d" % int(App.reglages.tours), func(): App.reglages.tours = int(App.reglages.tours) % 10 + 1; App.sauve(); _construit(), "tours"])
		reglagesBas.append(["ADVERSAIRES : %d" % (int(App.reglages.adversaires) - 1), func(): App.reglages.adversaires = (int(App.reglages.adversaires) - 1) % 11 + 2; App.sauve(); _construit(), "adversaires"])
	reglagesBas.append(["VUE : " + _nom(VUES, App.reglages.vue), func(): App.reglages.vue = _suivant(VUES, App.reglages.vue); App.sauve(); _construit(), "vue"])
	for r in reglagesBas:
		var w := Style.largeur(r[0], 20) + 36
		var b := _bouton(r[0], Rect2(x, yb, w, 48), Style.NUIT_PLEINE, Style.CREME, 20, r[1])
		b.centre = true
		b.set_meta("cle", r[2])
		x += w + 10
	var go := _bouton("EN PISTE !  →", Rect2((1050 if not portrait else 572), yb - 4, 200, 56), Style.ROUGE, Style.CREME, 30, _enPiste)
	go.centre = true
	go.set_meta("cle", "go")
	cadre.queue_redraw()
	# Le focus revient où il était (la manette et le clavier ne perdent pas leur place).
	var cible: Control = null
	for c in cadre.get_children():
		if c.get_meta("cle", "") == cle and not c.is_queued_for_deletion(): cible = c
	if cible == null:
		for c in cadre.get_children():
			if c.get_meta("cle", "") == "go": cible = c
	if cible: cible.grab_focus.call_deferred()


static func _nom(liste: Array, id: String) -> String:
	for e in liste:
		if e[0] == id: return e[1]
	return liste[0][1]


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
func _dessine() -> void:
	var ci := cadre
	var dx := 0.0 if not portrait else 18.0 - 790.0
	var dy := 0.0 if not portrait else 640.0
	Style.couvre(ci, fondPaddock, Rect2(-2000, -200, 5000, hauteur + 400), 0.4)
	ci.draw_rect(Rect2(-2000, -200, 5000, hauteur + 400), Color(0.95, 0.89, 0.74, 0.35))
	# En-tête
	var W := cadre.size.x
	Style.biseau(ci, Rect2(18, 10, W - 36, 64), Style.NUIT_PLEINE, 0)
	Style.damier(ci, Rect2(140, 10, 80, 64), 4, Style.CREME, Style.NUIT_PLEINE, 0)
	Style.biseau(ci, Rect2(214, 10, 320, 64), Style.ROUGE, 22)
	Style.texte(ci, { race = "COURSE RAPIDE", timetrial = "CONTRE-LA-MONTRE", training = "ENTRAÎNEMENT" }.get(mode, ""), Vector2(236, 58), 38, Style.CREME)
	var logo := Style.tex("res://images/interface/logo-grip.webp")
	if not portrait:
		ci.draw_texture_rect(logo, Rect2(W - 210, 16, 190, 190 * logo.get_height() / logo.get_width()), false)
	# Onglets
	Style.biseau(ci, Rect2(18, 84, 744, 54), Style.PAPIER, 12)
	# La voiture
	var v := Catalogue.voiture(App.reglages.voiture)
	var cat := ""
	for c in Catalogue.categories():
		if c.id == v.cat: cat = str(c.nom.fr).to_upper()
	var livrees: Array = v.livrees
	var li: int = int(App.reglages.livree) % maxi(1, livrees.size())
	Style.biseau(ci, Rect2(18, 148, 744, 70), Style.PAPIER, 14)
	Style.texte(ci, str(v.nom).to_upper(), Vector2(32, 194), 44, Style.ENCRE)
	Style.texte(ci, "%s · %s" % [cat, str(livrees[li].nom).to_upper()], Vector2(34, 213), 17, Color(Style.ENCRE, 0.8))
	var d := Catalogue.dessin(v.id, li)
	if d.get("vignette"):
		var tex := Style.tex("res://images/vignettes/" + d.vignette)
		var h := 128.0
		var w := h * tex.get_width() / tex.get_height()
		ci.draw_texture_rect(tex, Rect2(260, 222, w, h), false)
	# Les caractéristiques
	Style.biseau(ci, Rect2(18, 450, 744, 54), Style.PAPIER, 12)
	var p: Dictionary = v.perf
	var stats := [["%d km/h" % roundi(p.vmax), "VITESSE MAX."], ["%.1f s" % p.a100, "0-100 KM/H"], ["%.1f m" % p.b100, "FREINAGE 100-0"], ["%.2f g" % p.gripG, "ADHÉRENCE"]]
	for i in 4:
		var x := 36 + i * 186
		Style.texte(ci, stats[i][0], Vector2(x, 478), 26, Style.ENCRE)
		Style.texte(ci, stats[i][1], Vector2(x, 497), 13, Color(Style.ENCRE, 0.75))
	ci.draw_rect(Rect2(18, 506, 744, 3), Style.NUIT_PLEINE)
	# Le circuit
	var cid: String = App.reglages.circuit
	var info: Dictionary = infoCircuits.get(cid, infoCircuits.values()[0])
	var r := Rect2(790 + dx, 92 + dy, 468, 548 if not portrait else 520)
	ci.draw_rect(Rect2(r.position + Vector2(4, 4), r.size), Color(0, 0, 0, 0.35))
	ci.draw_rect(r, Style.PAPIER)
	ci.draw_rect(r, Style.NUIT_PLEINE, false, 3)
	Style.texte(ci, str(info.nom).to_upper(), r.position + Vector2(14, 52), 40, Style.ENCRE)
	var dr := Style.drapeau(info.pays)
	if dr: ci.draw_texture_rect(dr, Rect2(r.end.x - 82, r.position.y + 16, 62, 42), false)
	Style.texte(ci, "%s · %d M · %d TOURS" % [str(PAYS.get(info.pays, info.pays)).to_upper(), roundi(info.longueur), int(App.reglages.tours) if mode == "race" else 0],
		r.position + Vector2(14, 82), 18, Color(Style.ENCRE, 0.85))
	var ir := Rect2(r.position.x + 2, r.position.y + 94, r.size.x - 4, 96)
	Style.couvre(ci, info.image, ir, 0.5)
	_contour(ci, info, ir.grow(-8))
	# Le record de l'appareil
	var rec := _record(cid, v.id)
	Style.texte(ci, "TON MEILLEUR TOUR ICI", r.position + Vector2(14, 512), 18, Style.ENCRE)
	Style.texte(ci, Style.temps(rec), r.position + Vector2(r.size.x - 160, 512), 22, Style.ENCRE)
	Style.texte(ci, "avec cette voiture, sur cet appareil", r.position + Vector2(14, 532), 13, Color(Style.ENCRE, 0.7))
	# La barre du bas
	var yb := 654.0 if not portrait else 1250.0
	ci.draw_rect(Rect2(18, yb - 6, W - 36, 3), Style.NUIT_PLEINE)
	Style.damier(ci, Rect2((980 if not portrait else 500), yb - 4, 76, 56), 4, Style.NUIT_PLEINE, Color(0, 0, 0, 0), 0)


func _contour(ci: CanvasItem, info: Dictionary, r: Rect2) -> void:
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


func _carteVoiture(b: Bouton) -> void:
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


func _carteCircuit(b: Bouton) -> void:
	var info: Dictionary = infoCircuits[b.get_meta("circuit")]
	var ir := Rect2(6, 6, b.size.x - 12, 76)
	Style.couvre(b, info.image, ir, 0.5)
	_contour(b, info, ir.grow(-10))
	var dr := Style.drapeau(info.pays)
	if dr: b.draw_texture_rect(dr, Rect2(20, b.size.y - 30, 22, 15), false)
	Style.texte(b, "%d m" % roundi(info.longueur), Vector2(48, b.size.y - 17), 15, Style.ENCRE)
