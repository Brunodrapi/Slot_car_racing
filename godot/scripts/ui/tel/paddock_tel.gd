## LE PADDOCK DU TÉLÉPHONE (maquette, rendPaddock) : sur un seul écran, la carte du circuit (le chrono pour
## sa fiche et ses chronos), la carte de la voiture et ses livrées, trois pastilles, et en bas « Réglages »
## et EN PISTE. Le circuit, le garage, les réglages, la difficulté et le freinage s'ouvrent en feuilles.
## Quatre modes : la course rapide (une seule course), le championnat (la course du calendrier), le
## contre-la-montre et l'entraînement.
class_name PaddockTel
extends EcranTel

const DIFFICULTES := ["easy", "medium", "hard", "extreme", "cauchemar"]
var mode := "race"
var infos := {}
var voitureAvant := ""          # la voiture en ouvrant le garage : son trait rouge sur les barres
var filtreGarage := "tous"


func _init(m: String) -> void:
	mode = m
	nom = "paddock"
	optionsNom = { mode = "race" if m == "champ" else m }


func _ready() -> void:
	infos = Paddock.infosCircuits()
	Paddock.precharge()
	App.reglages.modeTel = "champ" if mode == "champ" else ""
	if Catalogue.voiture(App.reglages.voiture).is_empty(): App.reglages.voiture = "porsche991gt3r"
	Mondial.change.connect(rafraichit)
	App.prepareDemarrage()
	super()


func retour() -> void:
	App.aller("accueil")


func champ() -> bool:
	return mode == "champ" and ChampTel.enCours()


func circuitId() -> String:
	if champ(): return String(ChampTel.manche().get("circuit", App.reglages.circuit))
	return String(App.reglages.circuit)


func info() -> Dictionary:
	return infos.get(circuitId(), infos.values()[0])


func voiture() -> Dictionary:
	return Catalogue.voiture(App.reglages.voiture)


func nuitPossible() -> bool:
	return voiture().get("cat", "") != "f1"


func nuit() -> bool:
	return bool(App.reglages.get("nuit", false)) and nuitPossible()


func _titre() -> String:
	match mode:
		"champ": return Tel.t("championnat")
		"timetrial": return Textes.t("timeTrial")
		"training": return Textes.t("training")
	return Textes.t("quickRace")


# ---------- l'écran ----------
func construit(v: Control) -> void:
	var col := colonne(v, _titre(), Tel.t("retour"), retour)
	var main := Tel.boite(true, 8)
	main.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var m := Tel.marge(main, 10, 10, 10, 8)
	m.size_flags_vertical = Control.SIZE_EXPAND_FILL
	m.mouse_filter = Control.MOUSE_FILTER_PASS
	main.mouse_filter = Control.MOUSE_FILTER_PASS
	col.add_child(m)
	if champ():
		main.add_child(zoneCircuit(self, info(), nuit(), "%s %d/%d" % [Tel.t("course"), ChampTel.numero(), ChampTel.nombre()], _ouvreCalendrier))
	else:
		main.add_child(zoneCircuit(self, info(), nuit(), Tel.t("changer"), _ouvreCircuits))
	main.add_child(zoneVoiture(self, voiture(), int(App.reglages.livree), _ouvreGarage, _livree))
	main.add_child(_pastilles())
	var bas: Array = [Tel.puce(Tel.t("reglages"), _ouvreReglages)]
	if champ():
		var place := ChampTel.maPlace() if ChampTel.courues() > 0 else 0
		bas.append(Tel.puce(Tel.t("classement"), _ouvreClassement, Tel.t("tuEs", Tel.rang(place)) if place > 0 else ""))
	# en contre-la-montre, les temps vont au tableau mondial : la connexion est là, à portée de doigt,
	# comme dans le jeu web (statutChrono), tant qu'on n'est pas connecté
	var mondial := mode == "timetrial" and Mondial.connexionPossible() and not Mondial.connecte()
	if mondial:
		if Mondial.enCours: bas.append(Tel.puce(Textes.t("rgAnnuler"), Mondial.annuler, Tel.t("puceEnCours")))
		else: bas.append(Tel.puce(Tel.t("puceConnexion"), Mondial.entrer, Tel.t("puceEchec") if Mondial.erreurConnexion != "" else Tel.t("puceMondial")))
	bas.append(Tel.gros(Tel.t("enPiste"), _enPiste, true, Tel.ROUGE, 24 if champ() or mondial else 28))
	col.add_child(Tel.barreBas(bas, champ() or mondial))


## La carte du circuit et son chrono (la fiche et les chronos), partagée avec la table.
static func zoneCircuit(e: EcranTel, inf: Dictionary, laNuit: bool, etiquette: String, action: Callable, fiche := Callable()) -> Control:
	var zone := Control.new()
	zone.size_flags_vertical = Control.SIZE_EXPAND_FILL
	zone.custom_minimum_size.y = 120
	zone.mouse_filter = Control.MOUSE_FILTER_PASS
	var c := CartesTel.new("circuit")
	c.info = inf
	c.nuit = laNuit
	c.etiquette = etiquette
	c.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	c.pressed.connect(action)
	zone.add_child(c)
	var chrono := ToucheTel.new(Tel.CARTE)
	chrono.forme = ToucheTel.Forme.ROND
	chrono.bord = Tel.ENCRE
	chrono.epaisseur = 2
	chrono.custom_minimum_size = Vector2(44, 44)
	chrono.size = Vector2(44, 44)
	chrono.position = Vector2(8, 8)
	var img := Tel.image(Tel.chrono(), Vector2(30, 30))
	chrono.ajoute(img)
	chrono.marges(7, 7, 7, 7)
	chrono.pressed.connect(fiche if fiche.is_valid() else func(): FicheTel.ouvre(e, String(inf.get("id", App.reglages.circuit))))
	zone.add_child(chrono)
	return zone


## La carte de la voiture et la barre de ses livrées.
static func zoneVoiture(_e: EcranTel, v: Dictionary, livree: int, garage: Callable, change: Callable, libre := true) -> Control:
	var col := Tel.boite(true, 0)
	col.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.mouse_filter = Control.MOUSE_FILTER_PASS
	var c := CartesTel.new("voiture")
	c.voiture = v
	c.livree = livree
	c.etiquette = Tel.t("garage")
	c.pressed.connect(garage)
	col.add_child(c)
	var livrees: Array = v.get("livrees", [])
	var n := maxi(1, livrees.size())
	var barre := Tel.boite(false, 0)
	var g := ToucheTel.signeSeul("gauche", Tel.ENCRE, Tel.PAPIER, Vector2(52, 44))
	g.eteint(n < 2 or not libre)
	g.pressed.connect(change.bind(-1))
	var d := ToucheTel.signeSeul("droite", Tel.ENCRE, Tel.PAPIER, Vector2(52, 44))
	d.eteint(n < 2 or not libre)
	d.pressed.connect(change.bind(1))
	var nomL := Tel.texte(Textes.livree(livrees[posmod(livree, n)]) if livrees.size() else "", 14, Tel.PAPIER, false)
	nomL.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	nomL.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	nomL.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	barre.add_child(g)
	barre.add_child(nomL)
	barre.add_child(d)
	var fond := Tel.fond(barre, Tel.ENCRE)
	fond.custom_minimum_size.y = 44
	col.add_child(fond)
	return col


## Une pastille (.pastille) : le nom en petit, la valeur en vert ; une note dessous si besoin.
static func pastille(lib: String, val: String, action: Callable, note := "", liste := false, eteinte := false, couleurVal := Tel.VERT_CLAIR, astre := -1) -> ToucheTel:
	var b := ToucheTel.new(Tel.ENCRE)
	b.forme = ToucheTel.Forme.PASTILLE
	b.fondEteint = Tel.ENCRE
	b.marges(8, 4, 10, 4)
	b.custom_minimum_size.y = 52
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var v := Tel.boite(true, 0)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	var tete := Tel.boite(false, 4)
	var l := Tel.titre(lib, 13, Color(Tel.PAPIER, 0.85))
	tete.add_child(l)
	if liste: tete.add_child(Tel.glyphe("bas", 10, Color(Tel.PAPIER, 0.85)))
	v.add_child(tete)
	var ligneV := Tel.boite(false, 5)
	if astre >= 0:
		var a := Control.new()
		a.custom_minimum_size = Vector2(16, 18)
		a.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var coul := Tel.GRIS if eteinte else couleurVal
		a.draw.connect(func(): Tel.astre(a, Vector2(8, 10), astre == 1, coul))
		ligneV.add_child(a)
	ligneV.add_child(Tel.titre(val, 19, Tel.GRIS if eteinte else couleurVal))
	v.add_child(ligneV)
	if note != "":
		var n := Tel.texte(note, 13, Color(Tel.PAPIER, 0.8))
		v.add_child(n)
	b.ajoute(v)
	if action.is_valid(): b.pressed.connect(action)
	if eteinte: b.disabled = true
	return b


## La pastille des tours (.compteur) : − la valeur +.
static func compteur(valeur: int, change: Callable, moins: bool, plus: bool) -> Control:
	var f := FondTel.new()
	f.custom_minimum_size.y = 52
	f.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var h := Tel.boite(false, 0)
	h.mouse_filter = Control.MOUSE_FILTER_PASS
	var m := ToucheTel.signeSeul("moins", Color(0, 0, 0, 0), Tel.PAPIER, Vector2(44, 52))
	m.eteint(not moins)
	m.pressed.connect(change.bind(-1))
	var p := ToucheTel.signeSeul("plus", Color(0, 0, 0, 0), Tel.PAPIER, Vector2(44, 52))
	p.eteint(not plus)
	p.pressed.connect(change.bind(1))
	var mil := Tel.boite(true, 0)
	mil.alignment = BoxContainer.ALIGNMENT_CENTER
	mil.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var l := Tel.titre(Tel.t("tours"), 13, Color(Tel.PAPIER, 0.85))
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var val := Tel.titre(str(valeur), 22, Tel.VERT_CLAIR)
	val.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mil.add_child(l)
	mil.add_child(val)
	h.add_child(m)
	h.add_child(mil)
	h.add_child(p)
	f.add_child(h)
	return f


func _pastilles() -> Control:
	var r := App.reglages
	var h := Tel.boite(false, 6)
	h.mouse_filter = Control.MOUSE_FILTER_PASS
	var jourNuit := pastille(Tel.t("moment"), Tel.t("nuit") if nuit() else Tel.t("jour"), func(): r.nuit = not bool(r.get("nuit", false)); App.sauve(); rafraichit(),
		"" if nuitPossible() else Tel.t("f1Jour"), false, not nuitPossible(), Tel.VERT_CLAIR, 1 if nuit() else 0)
	if mode == "race" or mode == "champ":
		var tours := int(ChampTel.manche().get("tours", r.tours)) if champ() else int(r.tours)
		var c := compteur(tours, func(d): r.tours = clampi(int(r.tours) + d, 1, 99); App.sauve(); rafraichit(), not champ() and tours > 1, not champ() and tours < 99)
		c.size_flags_stretch_ratio = 1.25
		h.add_child(c)
		var diff := pastille(Tel.t("difficulte"), Textes.t(String(r.difficulte)), _ouvreDifficulte, "", true)
		diff.size_flags_stretch_ratio = 1.2
		h.add_child(diff)
		h.add_child(jourNuit)
	elif mode == "timetrial":
		var cid := circuitId()
		var vid := String(r.voiture)
		var monde := _recordMonde(cid, vid)
		var perso := float(r.get("records", {}).get(cid + "/" + vid, -1))
		var note := Tel.t("tonRecord", Style.temps(perso)) if perso > 0 else Tel.t("pasDeTour")
		var rec := pastille(Tel.t("recordBattre"), Style.temps(monde) if monde > 0 else Tel.t("personne"), func(): FicheTel.ouvre(self, cid), note, false, false, Tel.VIOLET)
		rec.size_flags_stretch_ratio = 1.6
		h.add_child(rec)
		h.add_child(jourNuit)
	else:
		var avec := pastille(Tel.t("avecToi"), Tel.t("fantomeGuide"), Callable(), Tel.t("fantomeTexte"))
		avec.mouse_filter = Control.MOUSE_FILTER_IGNORE
		avec.size_flags_stretch_ratio = 1.6
		h.add_child(avec)
		h.add_child(jourNuit)
	return h


static func _recordMonde(cid: String, vid: String) -> float:
	var par = Mondial.meilleurs(cid)
	if par is Dictionary and (par as Dictionary).has(vid): return float(par[vid].get("temps", -1))
	return -1.0


func _livree(sens: int) -> void:
	var n := maxi(1, (voiture().get("livrees", []) as Array).size())
	App.reglages.livree = posmod(int(App.reglages.livree) + sens, n)
	App.sauve()
	rafraichit()


# ---------- en piste ----------
func _enPiste() -> void:
	var r := App.reglages
	if champ():
		App.reglages.modeTel = "champ"
		r.adversaires = int(ChampTel.etat().get("adversaires", r.adversaires))
		r.mode = "race"
		App.sauve()
		App.demarre()
		# la course lit le championnat en cours (aller() le garde pour « course »)
		App.championnatSolo = ChampTel.programme().duplicate(true)
		App.aller("course")
		return
	r.mode = mode
	App.programmeActif = false          # la course rapide est une seule course
	App.sauve()
	App.demarre()
	if mode == "race": App.lanceCourseRapide()
	else: App.aller("course")


func _regler() -> void:
	var r := App.reglages
	if champ(): r.circuit = circuitId()
	r.mode = "race" if mode == "champ" else mode
	App.sauve()
	App.demarre()
	App.aller("course", { reglage = true })


# ---------- les feuilles ----------
func _ouvreCircuits() -> void:
	ouvreFeuille(Tel.t("circuit"), func(c: VBoxContainer): grilleCircuits(c, circuitId(), func(id):
		App.reglages.circuit = id
		App.reglages.tours = int(infos[id].tours)
		App.sauve()
		fermeDessus()
		rafraichit()))


## Les quatorze circuits en grille (.grille-circuits) : un toucher choisit (ou ajoute au calendrier).
static func grilleCircuits(c: VBoxContainer, selection: String, choisit: Callable, dejaLa: Array = [], aide := "") -> void:
	if aide != "": c.add_child(Tel.aide(aide))
	var g := GridContainer.new()
	g.columns = 2
	g.add_theme_constant_override("h_separation", 8)
	g.add_theme_constant_override("v_separation", 8)
	g.mouse_filter = Control.MOUSE_FILTER_PASS
	var infs := Paddock.infosCircuits()
	for circ in Catalogue.circuits():
		var id := String(circ.id)
		var inf: Dictionary = infs[id]
		var b := ToucheTel.new(Tel.CARTE)
		b.bord = Tel.FILET
		b.epaisseur = 2
		b.choisi = id == selection
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var v := Tel.boite(true, 0)
		var art := Control.new()
		art.custom_minimum_size = Vector2(0, 112)
		art.draw.connect(func():
			var r := Rect2(Vector2.ZERO, art.size)
			if inf.get("image"): Style.couvre(art, inf.image, r, 0.5)
			Paddock._contour(art, inf, Rect2(r.size.x * 0.1, r.size.y * 0.08, r.size.x * 0.8, r.size.y * 0.84), true, 2.6)
			if b.choisi:
				art.draw_circle(Vector2(r.size.x - 20, 20), 14, Tel.ROUGE, true, -1, true)
				Tel.coche(art, Vector2(r.size.x - 20, 20), Color.WHITE, 7))
		v.add_child(art)
		v.add_child(Tel.marge(Tel.titre(String(inf.nom), 18), 7, 6, 7, 2))
		var pays := Tel.boite(false, 5)
		pays.add_child(Tel.image(Style.drapeau(String(inf.pays)), Vector2(20, 13)))
		pays.add_child(Tel.texte("%s · %s m" % [Textes.pays(String(inf.pays)), CartesTel._milliers(roundi(inf.longueur))], 13, Tel.ENCRE_DOUCE))
		v.add_child(Tel.marge(pays, 7, 0, 7, 2))
		var niv := Tel.boite(false, 5)
		niv.add_child(Tel.niveau(int(inf.difficulty)))
		if dejaLa.has(id): niv.add_child(Tel.texte(Tel.t("dejaAuCalendrier").strip_edges(), 13, Tel.ENCRE_DOUCE, false))
		v.add_child(Tel.marge(niv, 7, 2, 7, 7))
		b.ajoute(v)
		b.pressed.connect(choisit.bind(id))
		g.add_child(b)
	c.add_child(g)


func _ouvreGarage() -> void:
	voitureAvant = String(App.reglages.voiture)
	filtreGarage = String(voiture().get("cat", "tous"))
	if champ():
		var cat := String(ChampTel.etat().get("cat", ""))
		ouvreFeuille(Tel.t("garage"), func(c: VBoxContainer): garage(c, self, cat, Tel.t("catImposee", Tel.nomCat(cat))))
	else:
		ouvreFeuille(Tel.t("garage"), func(c: VBoxContainer): garage(c, self))


## Le garage (maquette, contenuGarage) : la voiture en grand, ses livrées, cinq barres sur une échelle
## commune, les catégories, la grille. `e` porte voitureAvant et filtreGarage ; une catégorie imposée
## (le championnat, la table) remplace les onglets.
static func garage(c: VBoxContainer, e: EcranTel, imposee := "", messageImpose := "", choisitVoiture := Callable(), choisitLivree := Callable()) -> void:
	var r := App.reglages
	var v := Catalogue.voiture(r.voiture)
	var livrees: Array = v.get("livrees", [])
	var li := posmod(int(r.livree), maxi(1, livrees.size()))
	var choixV := choisitVoiture if choisitVoiture.is_valid() else func(id):
		PaddockTel.prendVoiture(id)
		e.rafraichit()
	var choixL := choisitLivree if choisitLivree.is_valid() else func(i):
		App.reglages.livree = i
		App.sauve()
		e.rafraichit()
	# la voiture en grand, au paddock
	var tete := Control.new()
	tete.custom_minimum_size = Vector2(0, 206)
	tete.draw.connect(func():
		var zr := Rect2(Vector2.ZERO, tete.size)
		var fp := Style.tex("res://images/interface/paddock.webp")
		if fp: Style.couvre(tete, fp, zr, 0.5)
		var tex := Tel.vignette(String(v.id), li)
		if tex:
			var s := minf(zr.size.x * 0.78 / tex.get_width(), zr.size.y * 0.78 / tex.get_height())
			var t := Vector2(tex.get_width(), tex.get_height()) * s
			tete.draw_texture_rect(tex, Rect2((zr.size.x - t.x) / 2, zr.size.y * 0.92 - t.y, t.x, t.y), false)
		tete.draw_rect(zr, Tel.ENCRE, false, 2))
	c.add_child(tete)
	var nomL := Tel.boite(false, 8)
	var nm := Tel.titre(String(v.nom), 24)
	nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	nomL.add_child(nm)
	var sous := Tel.texte("%s · %s" % [Tel.nomCat(String(v.cat)), Textes.livree(livrees[li]) if livrees.size() else ""], 13, Tel.ENCRE_DOUCE, false)
	sous.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	nomL.add_child(sous)
	c.add_child(nomL)
	if livrees.size() > 1:
		var lv := HFlowContainer.new()
		lv.add_theme_constant_override("h_separation", 8)
		lv.add_theme_constant_override("v_separation", 8)
		lv.mouse_filter = Control.MOUSE_FILTER_PASS
		for i in livrees.size():
			var b := ToucheTel.new(Color("#e7dcc0"))
			b.bord = Tel.FILET
			b.epaisseur = 2
			b.choisi = i == li
			b.custom_minimum_size = Vector2(76, 52)
			b.marges(4, 4, 4, 4)
			b.ajoute(Tel.image(Tel.vignette(String(v.id), i), Vector2(66, 42)))
			b.pressed.connect(choixL.bind(i))
			lv.add_child(b)
		c.add_child(lv)
	c.add_child(stats(v, Catalogue.voiture(String(e.get("voitureAvant"))) if String(e.get("voitureAvant")) != String(v.id) else {}))
	var filtre := imposee if imposee != "" else String(e.get("filtreGarage"))
	if imposee != "":
		c.add_child(Tel.aide(messageImpose))
	else:
		var seg := GridContainer.new()
		seg.columns = 5
		seg.add_theme_constant_override("h_separation", 4)
		seg.mouse_filter = Control.MOUSE_FILTER_PASS
		var onglets := [["tous", Tel.t("toutes")]]
		for k in Catalogue.categories(): onglets.append([String(k.id), Textes.nom(k.nom)])
		for o in onglets:
			var b := ToucheTel.texteSeul(String(o[1]), Tel.VERT if filtre == o[0] else Tel.ENCRE, Tel.PAPIER, 16, Vector2(0, 44))
			b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			b.pressed.connect(func(): e.set("filtreGarage", o[0]); e.rafraichit())
			seg.add_child(b)
		c.add_child(seg)
	var grille := GridContainer.new()
	grille.columns = 3
	grille.add_theme_constant_override("h_separation", 6)
	grille.add_theme_constant_override("v_separation", 6)
	grille.mouse_filter = Control.MOUSE_FILTER_PASS
	for x in Catalogue.donnees.voitures:
		if filtre != "tous" and filtre != "all" and x.cat != filtre: continue
		var b := ToucheTel.new(Tel.CARTE)
		b.bord = Tel.FILET
		b.epaisseur = 2
		b.choisi = x.id == v.id
		b.custom_minimum_size.y = 104
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.marges(3, 4, 3, 6)
		var col := Tel.boite(true, 4)
		col.add_child(Tel.image(Tel.vignette(String(x.id), 0), Vector2(0, 58)))
		var n := Tel.titre(String(x.nom), 14)
		n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		n.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		n.custom_minimum_size.x = 100
		col.add_child(n)
		b.ajoute(col)
		b.pressed.connect(choixV.bind(String(x.id)))
		grille.add_child(b)
	c.add_child(grille)


## Prendre une voiture (le paddock : _choisitVoiture) : sa catégorie, la livrée 0, et la voiture retenue
## pour cette catégorie.
static func prendVoiture(id: String) -> void:
	var r := App.reglages
	r.voiture = id
	r.cat = Catalogue.voiture(id).cat
	r.livree = 0
	if not r.has("voituresCat"): r.voituresCat = {}
	r.voituresCat[r.cat] = id
	App.sauve()


# les cinq mesures du garage, sur une échelle commune aux voitures du jeu (plus grand, ou plus petit,
# vaut mieux)
static var _bornes := {}
const MESURES := [["stats_vmax", "vmax", 1], ["stats_grip", "gripG", 1], ["stats_acc", "a100", -1], ["stats_poids", "poids", 1], ["stats_frein", "b100", -1]]


static func _mesure(v: Dictionary, cle: String) -> float:
	if cle == "poids": return float(v.get("weightKg", 0))
	return float(v.perf.get(cle, 0))


static func _part(v: Dictionary, m: Array) -> float:
	if _bornes.is_empty():
		for x in MESURES:
			var vals := []
			for w in Catalogue.donnees.voitures:
				var val := _mesure(w, x[1])
				if val > 0: vals.append(val)
			_bornes[x[1]] = Vector2(vals.min(), vals.max())
	var b: Vector2 = _bornes[m[1]]
	var val := _mesure(v, m[1])
	if val <= 0 or b.y == b.x: return 0.0
	var p := (val - b.x) / (b.y - b.x) if m[2] > 0 else (b.y - val) / (b.y - b.x)
	return 0.1 + 0.9 * p


static func _texteMesure(v: Dictionary, cle: String) -> String:
	var val := _mesure(v, cle)
	var fr := Textes.langue() == "fr"
	match cle:
		"vmax": return "%d km/h" % roundi(val)
		"gripG": return ("%.2f g" % val).replace(".", "," if fr else ".")
		"a100": return ("%.1f s" % val).replace(".", "," if fr else ".")
		"poids": return "≈ %s kg" % CartesTel._milliers(roundi(val)) if val > 0 else "—"
		"b100": return ("%.1f m" % val).replace(".", "," if fr else ".")
	return ""


static func stats(v: Dictionary, avant: Dictionary) -> Control:
	var col := Tel.boite(true, 5)
	for m in MESURES:
		var h := Tel.boite(false, 8)
		var n := Tel.titre(Tel.t(m[0]), 15)
		n.custom_minimum_size.x = 104
		h.add_child(n)
		var j := Control.new()
		j.custom_minimum_size = Vector2(0, 18)
		j.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		j.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var part := _part(v, m)
		var partAvant := _part(avant, m) if not avant.is_empty() else -1.0
		j.draw.connect(func():
			var sb := StyleBoxFlat.new()
			sb.bg_color = Color("#3a3f3a")
			sb.set_corner_radius_all(5)
			var y := (j.size.y - 10) / 2
			j.draw_style_box(sb, Rect2(0, y, j.size.x, 10))
			var sf := StyleBoxFlat.new()
			sf.bg_color = Color("#6fae7a")
			sf.set_corner_radius_all(5)
			if part > 0: j.draw_style_box(sf, Rect2(0, y, maxf(10, j.size.x * part), 10))
			if partAvant >= 0: j.draw_rect(Rect2(j.size.x * partAvant - 1.5, y - 4, 3, 18), Tel.ROUGE))
		h.add_child(j)
		var val := Tel.titre(_texteMesure(v, m[1]), 16)
		val.custom_minimum_size.x = 82
		val.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		h.add_child(val)
		col.add_child(h)
	return col


func _ouvreReglages() -> void:
	ouvreFeuille(Tel.t("reglages"), _reglages, false)


func _reglages(c: VBoxContainer) -> void:
	var r := App.reglages
	if mode == "race" or mode == "champ":
		var deg := bool(r.get("degats", true))
		c.add_child(Tel.ligne(Tel.t("degats"), Tel.t("degatsTexte"), Tel.interrupteur(deg), func(): r.degats = not deg; App.sauve(); rafraichit()))
	if mode == "race":
		var adv := int(r.adversaires) - 1
		c.add_child(Tel.ligne(Tel.t("adversaires"), Tel.t("adversairesTexte"), Tel.pas(str(adv), func(d): r.adversaires = clampi(int(r.adversaires) + d, 2, 12); App.sauve(); rafraichit(), adv > 1, adv < 11)))
	c.add_child(ligneFreinage(self, circuitId(), String(r.voiture), false))
	var regler := ToucheTel.texteSeul(Tel.t("regler"), Tel.ENCRE, Tel.PAPIER, 17, Vector2(0, 44))
	regler.marges(14, 0, 14, 0)
	regler.pressed.connect(_regler)
	c.add_child(Tel.ligne(Tel.t("reglerFrein"), Tel.t("reglerTexte"), regler))
	_ligneMondial(c)
	if champ():
		var fleche := Tel.glyphe("droite", 16, Tel.VERT)
		c.add_child(Tel.ligne(Tel.t("abandonner"), Tel.t("abandonnerTexte"), fleche, _ouvreAbandon, Tel.ROUGE))


## Le freinage (la ligne, puis sa feuille) : « Par défaut » ou un réglage enregistré pour ce circuit et
## cette voiture.
static func ligneFreinage(e: EcranTel, cid: String, vid: String, table: bool) -> Control:
	var actif := ReglageFrein.active(cid, vid)
	var nomActif := String(actif.get("nom", Tel.t("parDefaut")))
	var droite := Tel.boite(false, 4)
	droite.add_child(Tel.valeur(nomActif))
	droite.add_child(Tel.glyphe("droite", 14, Tel.VERT))
	return Tel.ligne(Tel.t("freinage"), Tel.t("freinageTable" if table else "freinageTexte"), droite, func():
		e.ouvreFeuille(Tel.t("freinage"), func(c: VBoxContainer):
			var choix := Tel.boite(true, 6)
			var a := String(ReglageFrein.active(cid, vid).get("nom", ""))
			choix.add_child(Tel.choix(Tel.t("parDefaut"), Tel.t("parDefautTexte"), a == "", func(): ReglageFrein.choisit(cid, vid, ""); App.sauve(); e.fermeDessus(); e.rafraichit()))
			for cfg in ReglageFrein.pour(cid, vid):
				var n := String(cfg.nom)
				choix.add_child(Tel.choix(n, Tel.t("reglageEnregistre"), a == n, func(): ReglageFrein.choisit(cid, vid, n); App.sauve(); e.fermeDessus(); e.rafraichit()))
			c.add_child(choix), false))


func _ligneMondial(c: VBoxContainer) -> void:
	var et := Mondial.etat()
	var bouton: Control = null
	if Mondial.connexionPossible() and (Mondial.enCours or not Mondial.connecte()):
		var b := ToucheTel.texteSeul(Textes.t("signInCancel") if Mondial.enCours else Tel.t("seConnecter"), Tel.ENCRE, Tel.PAPIER, 17, Vector2(0, 44))
		b.marges(14, 0, 14, 0)
		b.pressed.connect(func(): (Mondial.annuler() if Mondial.enCours else Mondial.entrer()))
		bouton = b
	c.add_child(Tel.ligne(Tel.t("mondial"), String(et.texte), bouton))


func _ouvreDifficulte() -> void:
	ouvreFeuille(Tel.t("difficulte"), func(c: VBoxContainer):
		var choix := Tel.boite(true, 6)
		for d in DIFFICULTES:
			choix.add_child(Tel.choix(Textes.t(d), Tel.t("diff_" + d), d == App.reglages.difficulte, func():
				App.reglages.difficulte = d
				App.sauve()
				fermeDessus()
				rafraichit()))
		c.add_child(choix), false)


# ---------- le championnat ----------
func _ouvreCalendrier() -> void:
	ouvrePage(Tel.t("calendrier"), Tel.t("paddock"), func(c: VBoxContainer): ChampionnatTel.calendrierFige(c))


func _ouvreClassement() -> void:
	ouvreFeuille(Tel.t("classement"), func(c: VBoxContainer): ChampionnatTel.classementComplet(c))


func _ouvreAbandon() -> void:
	ouvreFeuille(Tel.t("abandonTitre"), func(c: VBoxContainer):
		c.add_child(Tel.texte(Tel.t("abandonPhrase"), 15, Tel.ENCRE))
		var choix := Tel.boite(true, 6)
		choix.add_child(Tel.choix(Tel.t("abandonOui"), "", false, func():
			ChampTel.abandonne()
			App.reglages.modeTel = ""
			App.sauve()
			fermeTout()
			App.aller.call_deferred("accueil"), true))
		choix.add_child(Tel.choix(Tel.t("continuer"), "", false, fermeDessus))
		c.add_child(choix), false)
