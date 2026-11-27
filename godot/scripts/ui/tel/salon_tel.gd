## LE MULTIJOUEUR AU TÉLÉPHONE (maquette, rendMulti et rendTable). L'entrée : créer une table, ou la
## rejoindre avec un code de quatre caractères (« Regarder » pour suivre sans piloter). La table est le
## paddock, avec au-dessus la barre des pilotes ; l'hôte règle le circuit, les tours, le format (course,
## ou contre-la-montre ; une course sans IA est un duel), la catégorie et le moment ; « Réglages » porte
## l'IA, les dégâts et le freinage de chacun. En bas : Réglages, le championnat de la table, et le geste
## de chacun — l'hôte (★) a Départ, qui vaut « prêt » ; les autres ont Prêt.
##
## Ce sont les tables du jeu web (Net, la même présence) : le format « duel » de la table est la course
## sans IA de cet écran, et le championnat de contre-la-montre n'est proposé qu'entre versions Godot.
class_name SalonTel
extends EcranTel

var net: Net
var voitureAvant := ""
var filtreGarage := "tous"
var codeSaisi := ""
var _signature := ""
var _boutonsCode: Array = []
static var optionsChamp := {}         # le calendrier du championnat de la table, que l'hôte prépare


func _init() -> void:
	nom = "salon"


func _ready() -> void:
	net = Reseau.net
	Paddock.precharge()
	net.onPeers = func() -> void: if is_inside_tree(): _maj()
	super()
	_maj()


func _exit_tree() -> void:
	net.onPeers = func() -> void: pass


func dansTable() -> bool:
	return net.state != "off"


func retour() -> void:
	if dansTable(): _ouvreQuitter()
	else:
		if net.state != "off": net.leave()
		App.aller("accueil")


## Ce que montre l'écran a-t-il changé ? On ne le refait qu'alors (la présence arrive trente fois par
## seconde). L'hôte est toujours prêt ; une catégorie imposée change la voiture d'elle-même.
func _maj() -> void:
	var t := net.settings()
	if net.state == "lobby":
		var cat := String(t.get("cat", "all"))
		if cat != "all" and cat != "" and Catalogue.voiture(App.reglages.voiture).get("cat") != cat and not net.mine.get("spectator", false):
			var l := Catalogue.voituresDe(cat)
			if l.size():
				App.reglages.voiture = l[0].id
				App.reglages.livree = 0
				net.setMine({ car = _voitureNet(), ready = net.creator })
				return
		if net.creator and not bool(net.mine.get("ready", false)):
			net.setMine({ ready = true, car = _voitureNet() })
			return
	var m := net.members()
	var s := JSON.stringify([net.state, net.busy, net.error, net.creator, t, net.mine.get("ready"), net.mine.get("spectator"),
		App.reglages.voiture, App.reglages.livree, m.map(func(x): return [x.pid, x.name, x.ready, x.car, x.q.get("spectator", false)]),
		net.canStart(), _pings()])
	if s != _signature:
		_signature = s
		rafraichit()


func _pings() -> Dictionary:
	if net.link == null: return {}
	var d := {}
	for pid in net.link.pings: d[pid] = int(net.link.pings[pid].get("ms", 0)) / 10 * 10
	return d


func _voitureNet() -> Dictionary:
	return { modelId = String(App.reglages.voiture), livree = int(App.reglages.livree) }


func _ouvre(hote: bool, spectateur := false) -> void:
	if net.busy: return
	rafraichit()
	var ok := await net.open(str(App.reglages.nom), hote, codeSaisi, spectateur)
	if not is_inside_tree(): return
	if ok:
		if hote:
			var c := String(App.reglages.circuit)
			net.setTable({ trackId = c, laps = int(Paddock.infosCircuits().get(c, {}).get("tours", 3)) })
		net.setMine({ car = _voitureNet(), ready = hote })
	_signature = ""
	_maj()


## Rejoindre la table d'un ami (l'invitation de Steam donne son code).
func rejoins(c: String) -> void:
	codeSaisi = c
	_ouvre(false)


# ---------- l'écran ----------
func construit(v: Control) -> void:
	if dansTable(): _table(v)
	else: _entree(v)


func _entree(v: Control) -> void:
	var col := colonne(v, Tel.t("multijoueur"), Tel.t("retour"), retour)
	var d := DefileTel.new(12, 12, 12, 12, 16)
	col.add_child(d)
	var c := d.contenu
	c.add_child(Tel.texte(Tel.t("multiIntro"), 16, Tel.ENCRE))
	var creer := ToucheTel.texteSeul(Tel.t("creerTable"), Tel.ROUGE, Color("#fbf4e2"), 24, Vector2(0, 60))
	creer.forme = ToucheTel.Forme.ENPISTE
	creer.eteint(net.busy)
	creer.pressed.connect(func(): _ouvre(true))
	c.add_child(creer)
	# rejoindre : le code, puis Rejoindre et Regarder
	var bloc := Tel.boite(true, 8)
	bloc.mouse_filter = Control.MOUSE_FILTER_PASS
	bloc.add_child(Tel.titre(Tel.t("rejoindreTable"), 24))
	bloc.add_child(Tel.texte(Tel.t("codeLabel"), 14, Tel.ENCRE))
	var champ := LineEdit.new()
	champ.max_length = 4
	champ.text = codeSaisi
	champ.placeholder_text = "ABCD"
	champ.alignment = HORIZONTAL_ALIGNMENT_CENTER
	champ.custom_minimum_size.y = 64
	champ.add_theme_font_override("font", Style.racing())
	champ.add_theme_font_size_override("font_size", 40)
	champ.add_theme_color_override("font_color", Tel.ENCRE)
	champ.add_theme_color_override("font_placeholder_color", Color(Tel.ENCRE, 0.35))
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color.WHITE
	sb.border_color = Tel.ENCRE
	sb.set_border_width_all(2)
	champ.add_theme_stylebox_override("normal", sb)
	champ.add_theme_stylebox_override("focus", sb)
	champ.virtual_keyboard_type = LineEdit.KEYBOARD_TYPE_DEFAULT
	bloc.add_child(champ)
	var deux := GridContainer.new()
	deux.columns = 2
	deux.add_theme_constant_override("h_separation", 8)
	deux.mouse_filter = Control.MOUSE_FILTER_PASS
	var rej := ToucheTel.texteSeul(Tel.t("rejoindre"), Tel.ENCRE, Tel.PAPIER, 24, Vector2(0, 60))
	rej.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	rej.pressed.connect(func(): _ouvre(false))
	var reg := ToucheTel.texteSeul(Tel.t("regarder"), Tel.CARTE, Tel.ENCRE, 24, Vector2(0, 60))
	reg.bord = Tel.ENCRE
	reg.epaisseur = 2
	reg.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	reg.pressed.connect(func(): _ouvre(false, true))
	deux.add_child(rej)
	deux.add_child(reg)
	_boutonsCode = [rej, reg]
	var allume := func():
		for b in _boutonsCode: (b as ToucheTel).eteint(codeSaisi.length() != 4 or net.busy)
	allume.call()
	champ.text_changed.connect(func(tx: String):
		var p := champ.caret_column
		var propre := ""
		for ch in tx.to_upper():
			if Net.NET_CODE.contains(ch) or "IO01".contains(ch): propre += ch
		codeSaisi = propre.substr(0, 4)
		champ.text = codeSaisi
		champ.caret_column = mini(p, codeSaisi.length())
		allume.call())
	champ.text_submitted.connect(func(_t): if codeSaisi.length() == 4: _ouvre(false))
	bloc.add_child(deux)
	bloc.add_child(Tel.aide(Tel.t("regarderAide")))
	c.add_child(Tel.fond(Tel.marge(bloc, 12, 12, 12, 12), Tel.CARTE, Tel.ENCRE, 2))
	if net.busy: c.add_child(Tel.aide(Tel.t("connexion")))
	elif net.error != "": c.add_child(Tel.texte(Textes.netErreur(net.error), 15, Tel.ROUGE))
	c.add_child(_ligneDiscord())


func _ligneDiscord() -> Control:
	return Tel.ligne(Tel.t("trouverJoueurs"), Tel.t("discordTexte"), Tel.glyphe("droite", 16, Tel.VERT), func(): OS.shell_open(Salon.DISCORD))


# ---------- la table ----------
func _pilotes() -> Array:
	return net.members().filter(func(x): return not x.q.get("spectator", false))


func _champ() -> Dictionary:
	return net.settings().get("championnat", {})


## Le championnat de la table : lancé (en cours), ou préparé par l'hôte et prêt à partir au Départ.
func _champActif() -> bool:
	var t := net.settings()
	var o: Dictionary = t.get("programme", {})
	return not _champ().is_empty() or (String(t.get("mode", "race")) in ["race", "duel"] and Championnat.actif(o)) \
		or (t.get("mode") == "ghost" and bool(o.get("clm", false)) and not (o.get("circuits", []) as Array).is_empty())


func _clm() -> bool:
	return String(net.settings().get("mode", "race")) == "ghost"


## La séance qui vient : celle du championnat lancé, ou la première du calendrier préparé.
func _manche() -> Dictionary:
	var ch := _champ()
	if not ch.is_empty(): return Championnat.manche(ch)
	var o: Dictionary = net.settings().get("programme", {})
	var cs: Array = o.get("circuits", [])
	if _champActif() and cs.size():
		return { circuit = cs[0], tours = Championnat.toursManche(o, 0, int(net.settings().get("laps", 3))), duree = Championnat.minutesManche(o, 0) * 60 }
	return {}


func _numero() -> Vector2i:
	var ch := _champ()
	if not ch.is_empty(): return Vector2i(ChampTel.numeroDe(ch), ChampTel.nombreDe(ch))
	return Vector2i(1, (net.settings().get("programme", {}).get("circuits", []) as Array).size())


func _table(v: Control) -> void:
	var t := net.settings()
	var hote := net.creator
	var spect := bool(net.mine.get("spectator", false))
	var champ := _champActif()
	var regle := hote and not champ
	var clm := _clm()
	var mode := String(t.get("mode", "race"))
	var col := colonne(v, Tel.t("tableCode", net.code), Tel.t("quitter"), retour)
	var main := Tel.boite(true, 8)
	main.mouse_filter = Control.MOUSE_FILTER_PASS
	var mm := Tel.marge(main, 10, 10, 10, 8)
	mm.size_flags_vertical = Control.SIZE_EXPAND_FILL
	mm.mouse_filter = Control.MOUSE_FILTER_PASS
	col.add_child(mm)
	main.add_child(_barrePilotes())
	# le circuit : l'hôte le change ; en championnat, la carte ouvre le calendrier
	var manche := _manche()
	var cid := String(manche.get("circuit", t.get("trackId", "monza")))
	var infs := Paddock.infosCircuits()
	var inf: Dictionary = infs.get(cid, infs.values()[0])
	var laNuit: bool = t.get("timeOfDay") == "night" and Catalogue.voiture(App.reglages.voiture).get("cat") != "f1"
	var mot := Tel.t("manche") if clm else Tel.t("course")
	if champ:
		var nu := _numero()
		main.add_child(PaddockTel.zoneCircuit(self, inf, laNuit, "%s %d/%d" % [mot, nu.x, nu.y], _ouvreCalendrier))
	elif hote:
		main.add_child(PaddockTel.zoneCircuit(self, inf, laNuit, Tel.t("changer"), _ouvreCircuits))
	else:
		main.add_child(PaddockTel.zoneCircuit(self, inf, laNuit, Tel.t("choisiHote"), func(): FicheTel.ouvre(self, cid)))
	if spect:
		var encart := Tel.aide(Tel.t("tuRegardes"))
		encart.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		encart.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		var e := Tel.fond(Tel.marge(encart, 12, 12, 12, 12), Tel.CARTE, Tel.FILET, 2)
		e.size_flags_vertical = Control.SIZE_EXPAND_FILL
		main.add_child(e)
	else:
		main.add_child(PaddockTel.zoneVoiture(self, Catalogue.voiture(App.reglages.voiture), int(App.reglages.livree), _ouvreGarage, _livree))
	# les mêmes pastilles que le paddock, deux par rang ; l'hôte seul les change
	var g := GridContainer.new()
	g.columns = 2
	g.add_theme_constant_override("h_separation", 6)
	g.add_theme_constant_override("v_separation", 6)
	g.mouse_filter = Control.MOUSE_FILTER_PASS
	var tours := int(manche.get("tours", t.get("laps", 3))) if champ else int(t.get("laps", 3))
	if not clm:
		var c := PaddockTel.compteur(tours, func(dd): net.setTable({ laps = clampi(int(t.get("laps", 3)) + dd, 1, 10) }), regle and tours > 1, regle and tours < 10)
		c.custom_minimum_size.y = 48
		g.add_child(c)
	elif champ:
		var s := PaddockTel.pastille(Tel.t("seance"), Tel.t("minMot", int(manche.get("duree", 600)) / 60), Callable())
		s.mouse_filter = Control.MOUSE_FILTER_IGNORE
		s.custom_minimum_size.y = 48
		g.add_child(s)
	var ia := int(t.get("aiCount", -1))
	var note := "" if clm else (Tel.t("sansIA") if mode == "duel" or ia == 0 else Tel.t("iaN", Tel.t("auto").to_lower() if ia < 0 else str(ia)))
	var fmt := PaddockTel.pastille(Tel.t("format"), Tel.t("formatClm") if clm else Tel.t("formatCourse"), _ouvreFormat, note, regle, not regle)
	g.add_child(fmt)
	var cat := String(t.get("cat", "all"))
	g.add_child(PaddockTel.pastille(Tel.t("categorie"), Tel.nomCat(cat), _ouvreCategorie, "", regle, not regle))
	var f1: bool = Catalogue.voiture(App.reglages.voiture).get("cat") == "f1"
	g.add_child(PaddockTel.pastille(Tel.t("moment"), Tel.t("nuit") if laNuit else Tel.t("jour"), func(): net.setTable({ timeOfDay = "day" if t.get("timeOfDay") == "night" else "night" }),
		Tel.t("f1Jour") if f1 else "", false, not hote or f1, Tel.VERT_CLAIR, 1 if laNuit else 0))
	for p in g.get_children():
		(p as Control).size_flags_horizontal = Control.SIZE_EXPAND_FILL
		if p is ToucheTel: (p as ToucheTel).custom_minimum_size.y = 48
	main.add_child(g)
	# en bas : Réglages, le championnat, et le geste de chacun
	var bas: Array = [Tel.puce(Tel.t("reglages"), _ouvreReglages)]
	if champ:
		var place := _maPlace()
		bas.append(Tel.puce(Tel.t("classement"), _ouvreClassement, Tel.t("tuEs", Tel.rang(place)) if place > 0 else ""))
	elif hote:
		bas.append(Tel.puce(Tel.t("championnat"), _ouvreChampionnat))
	var serree := bas.size() > 1
	if spect:
		var att := Tel.texte(Tel.t("lHoteLance"), 14, Tel.ENCRE_DOUCE)
		bas.append(att)
	elif hote:
		var autres := _pilotes().filter(func(x): return not x.isMe)
		var prets := autres.filter(func(x): return x.ready).size()
		var ok := net.canStart()
		var txt := Tel.t("depart") if ok else (Tel.t("nPrets", [prets, autres.size()]) if autres.size() else Tel.t("attendre"))
		var dep := Tel.gros(txt, _depart, ok, Tel.ROUGE, 24 if serree else 28)
		dep.eteint(not ok)
		bas.append(dep)
	else:
		var pret := bool(net.mine.get("ready", false))
		var bp := Tel.gros(Tel.t("estPret") if pret else Tel.t("pret"), func(): net.setMine({ ready = not bool(net.mine.get("ready", false)), car = _voitureNet() }), false,
			Tel.VERT if pret else Tel.ROUGE, 24 if serree else 28)
		if pret: (bp.get_child(0) as BoxContainer).add_child(Tel.glyphe("coche", 20, Color("#fbf4e2")))
		bas.append(bp)
	col.add_child(Tel.barreBas(bas, serree))


func _maPlace() -> int:
	var ch := _champ()
	if ch.is_empty() or (ch.get("points", {}) as Dictionary).is_empty() or net.mine.get("spectator", false): return 0
	var cl := ChampTel.classement(ch, net.pid)
	for i in cl.size():
		if cl[i].moi: return i + 1
	return 0


## La barre des pilotes (.pilotes-barre) : « 3/8 », chacun avec son état, l'hôte marqué d'une ★.
func _barrePilotes() -> Control:
	var liste := _pilotes()
	var b := ToucheTel.new(Tel.ENCRE)
	b.custom_minimum_size.y = 48
	b.marges(10, 0, 6, 0)
	var h := Tel.boite(false, 8)
	h.add_child(Tel.titre("%d/8" % liste.size(), 20, Tel.PAPIER))
	var pils := Tel.boite(false, 5)
	pils.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	pils.clip_contents = true
	for i in liste.size():
		var m: Dictionary = liste[i]
		var hote := i == 0
		var p := Tel.boite(false, 3)
		p.add_child(Tel.glyphe("etoile" if hote else ("coche" if m.ready else "droite"), 13, Tel.PAPIER) if hote or m.ready else Tel.texte("…", 14, Tel.PAPIER, false))
		p.add_child(Tel.texte(Tel.t("toi") if m.isMe else String(m.name), 14, Tel.PAPIER, false))
		var f := Tel.fond(Tel.marge(p, 8, 3, 8, 3), Color("#7a5c12") if hote else (Tel.VERT if m.ready else Color("#3a3f3a")), Tel.PAPIER, 2 if m.isMe else 0)
		f.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		pils.add_child(f)
	if liste.size() < 2: pils.add_child(Tel.texte(Tel.t("donneCode"), 14, Color(Tel.PAPIER, 0.8), false))
	h.add_child(pils)
	h.add_child(Tel.glyphe("droite", 16, Tel.PAPIER))
	b.ajoute(h)
	b.pressed.connect(_ouvrePilotes)
	return b


# ---------- les gestes ----------
func _depart() -> void:
	net.setMine({ ready = true, car = _voitureNet() })
	if net.canStart(): net.start()


func _livree(sens: int) -> void:
	var n := maxi(1, (Catalogue.voiture(App.reglages.voiture).get("livrees", []) as Array).size())
	App.reglages.livree = posmod(int(App.reglages.livree) + sens, n)
	App.sauve()
	net.setMine({ car = _voitureNet() })


func _ouvreCircuits() -> void:
	var t := net.settings()
	ouvreFeuille(Tel.t("circuit"), func(c: VBoxContainer): PaddockTel.grilleCircuits(c, String(t.get("trackId", "")), func(id):
		net.setTable({ trackId = id, laps = int(Paddock.infosCircuits()[id].tours) })
		fermeDessus()))


func _ouvreGarage() -> void:
	voitureAvant = String(App.reglages.voiture)
	var cat := String(net.settings().get("cat", "all"))
	filtreGarage = String(Catalogue.voiture(App.reglages.voiture).get("cat", "tous"))
	var choix := func(id):
		PaddockTel.prendVoiture(id)
		net.setMine({ car = _voitureNet(), ready = net.creator })
		rafraichit()
	var livree := func(i):
		App.reglages.livree = i
		App.sauve()
		net.setMine({ car = _voitureNet() })
		rafraichit()
	if cat != "all" and cat != "":
		ouvreFeuille(Tel.t("garage"), func(c: VBoxContainer): PaddockTel.garage(c, self, cat, Tel.t("catTable", Tel.nomCat(cat)), choix, livree))
	else:
		ouvreFeuille(Tel.t("garage"), func(c: VBoxContainer): PaddockTel.garage(c, self, "", "", choix, livree))


func _ouvreFormat() -> void:
	ouvreFeuille(Tel.t("format"), func(c: VBoxContainer):
		var t := net.settings()
		var clm := String(t.get("mode", "race")) == "ghost"
		var col := Tel.boite(true, 6)
		col.add_child(Tel.choix(Tel.t("formatCourse"), Tel.t("formatCourseTexte"), not clm, func():
			net.setTable({ mode = "duel" if int(net.settings().get("aiCount", -1)) == 0 else "race" })
			fermeDessus()))
		col.add_child(Tel.choix(Tel.t("formatClm"), Tel.t("formatClmTexte"), clm, func():
			net.setTable({ mode = "ghost" })
			fermeDessus()))
		c.add_child(col), false)


func _ouvreCategorie() -> void:
	ouvreFeuille(Tel.t("categorie"), func(c: VBoxContainer):
		var cat := String(net.settings().get("cat", "all"))
		c.add_child(Tel.aide(Tel.t("categorieAide")))
		var col := Tel.boite(true, 6)
		col.add_child(Tel.choix(Tel.t("toutes"), Tel.t("toutesTexte"), cat == "all", func(): net.setTable({ cat = "all" }); fermeDessus()))
		for k in Catalogue.categories():
			var id := String(k.id)
			col.add_child(Tel.choix(Textes.nom(k.nom), Tel.t("nVoitures", Catalogue.voituresDe(id).size()), cat == id, func(): net.setTable({ cat = id }); fermeDessus()))
		c.add_child(col))


func _ouvrePilotes() -> void:
	ouvreFeuille(Tel.t("pilotes"), func(c: VBoxContainer):
		# le code à partager
		var h := Tel.boite(false, 10)
		var lib := Tel.texte(Tel.t("codeTable"), 13, Color(Tel.PAPIER, 0.8), false)
		lib.custom_minimum_size.x = 70
		lib.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		h.add_child(lib)
		var code := Tel.titre(" ".join(net.code.split("")), 36, Tel.JAUNE)
		code.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		h.add_child(code)
		var part := ToucheTel.texteSeul(Tel.t("partager"), Tel.PAPIER, Tel.ENCRE, 17, Vector2(0, 44))
		part.marges(14, 0, 14, 0)
		part.pressed.connect(func():
			DisplayServer.clipboard_set(net.code)
			toast(Tel.t("codeCopie", net.code)))
		h.add_child(part)
		c.add_child(Tel.fond(Tel.marge(h, 12, 8, 8, 8), Tel.ENCRE))
		# chacun : sa voiture, son état, sa connexion
		var liste := _pilotes()
		var pings := _pings()
		for i in liste.size():
			var m: Dictionary = liste[i]
			var lh := Tel.boite(false, 8)
			var mid := String(m.car.get("modelId", "")) if m.car is Dictionary else ""
			lh.add_child(Tel.image(Tel.vignette(mid, int(m.car.get("livree", 0)) if m.car is Dictionary else 0) if mid != "" else null, Vector2(64, 40)))
			var nv := Tel.boite(true, 0)
			nv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			nv.add_child(Tel.titre(Tel.t("toi") if m.isMe else String(m.name), 18))
			var morceaux := []
			if i == 0: morceaux.append(Tel.t("hote"))
			if mid != "": morceaux.append(String(Catalogue.voiture(mid).get("nom", "")))
			if not m.isMe and pings.has(m.pid): morceaux.append("%d ms" % pings[m.pid])
			nv.add_child(Tel.texte(" · ".join(morceaux), 13, Tel.ENCRE_DOUCE, false))
			lh.add_child(nv)
			var etat := Tel.titre(Tel.t("lance") if i == 0 else (Tel.t("estPret") if m.ready else Tel.t("enAttente")), 14, Tel.VERT if i == 0 or m.ready else Tel.ENCRE_DOUCE)
			etat.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			lh.add_child(etat)
			c.add_child(Tel.fond(Tel.marge(lh, 3, 3, 10, 3), Tel.CARTE, Tel.ROUGE if m.isMe else Tel.FILET, 2 if m.isMe else 1))
		var specs := net.members().size() - liste.size()
		c.add_child(Tel.aide(Tel.t("membres", [liste.size(), Tel.t("spectateurs", specs) if specs > 0 else ""])))
		if net.room is SalleSteam or (net.room is SallePont and net.room.steam.open):
			c.add_child(Tel.ligne(Textes.t("inviteFriend"), "", Tel.glyphe("droite", 16, Tel.VERT), func(): net.room.invite()))
		if liste.size() < 2: c.add_child(_ligneDiscord()))


func _ouvreReglages() -> void:
	ouvreFeuille(Tel.t("reglages") if net.creator else Tel.t("reglages"), _reglages, false)


func _reglages(c: VBoxContainer) -> void:
	var t := net.settings()
	var hote := net.creator
	var mode := String(t.get("mode", "race"))
	var champ := _champActif()
	var spect := bool(net.mine.get("spectator", false))
	var ia := int(t.get("aiCount", -1))
	var maxIA := maxi(0, 12 - mini(_pilotes().size(), Net.NET_SEATS))
	var iaTxt := Tel.t("auto") if ia < 0 else (Tel.t("iaDuel") if ia == 0 or mode == "duel" else str(ia))
	var deg: bool = t.get("degats", false) == true
	if not hote: c.add_child(Tel.aide(Tel.t("regleeHote")))
	if mode != "ghost":
		if hote and not champ:
			c.add_child(Tel.ligne(Tel.t("voituresIA"), Tel.t("iaTexte", maxIA), Tel.pas(Tel.t("auto") if ia < 0 else str(ia), func(dd):
				var n := clampi(ia + dd, -1, maxIA)
				net.setTable({ aiCount = n, mode = "duel" if n == 0 else "race" }), ia > -1, ia < maxIA)))
		else:
			c.add_child(Tel.ligne(Tel.t("voituresIA"), Tel.t("iaFixe") if champ else "", Tel.valeur(iaTxt)))
	if hote and not champ: c.add_child(Tel.ligne(Tel.t("degats"), Tel.t("degatsTexte"), Tel.interrupteur(deg), func(): net.setTable({ degats = not deg })))
	else: c.add_child(Tel.ligne(Tel.t("degats"), "", Tel.valeur(Tel.t("activees") if deg else Tel.t("coupees"))))
	if not spect:
		var cid := String(_manche().get("circuit", t.get("trackId", "monza")))
		c.add_child(PaddockTel.ligneFreinage(self, cid, String(App.reglages.voiture), true))
	if not hote:
		c.add_child(Tel.ligne(Tel.t("spectateur"), Tel.t("spectateurTexte"), Tel.interrupteur(spect), func():
			net.setMine({ spectator = not bool(net.mine.get("spectator", false)), ready = false })
			net.pump()))
	if hote and champ:
		c.add_child(Tel.ligne(Tel.t("arreter"), Tel.t("arreterTexte"), Tel.glyphe("droite", 16, Tel.VERT), _ouvreArreter, Tel.ROUGE))


func _ouvreArreter() -> void:
	ouvreFeuille(Tel.t("arreterTitre"), func(c: VBoxContainer):
		c.add_child(Tel.texte(Tel.t("arreterPhrase"), 15, Tel.ENCRE))
		var col := Tel.boite(true, 6)
		col.add_child(Tel.choix(Tel.t("arreterOui"), "", false, func():
			net.setTable({ championnat = {}, programme = {} })
			fermeTout(), true))
		col.add_child(Tel.choix(Tel.t("continuer"), "", false, fermeDessus))
		c.add_child(col), false)


func _ouvreQuitter() -> void:
	ouvreFeuille(Tel.t("quitterTitre"), func(c: VBoxContainer):
		c.add_child(Tel.texte(Tel.t("quitterHote") if net.creator else Tel.t("quitterInvite"), 15, Tel.ENCRE))
		var col := Tel.boite(true, 6)
		col.add_child(Tel.choix(Tel.t("quitterOui"), "", false, func():
			net.leave()
			fermeTout()
			rafraichit(), true))
		col.add_child(Tel.choix(Tel.t("rester"), "", false, fermeDessus))
		c.add_child(col), false)


func _ouvreClassement() -> void:
	ouvreFeuille(Tel.t("classement"), func(c: VBoxContainer):
		var ch := _champ()
		var nu := _numero()
		var courues := nu.x - 1
		var mot := Tel.t("manchesMot") if _clm() else Tel.t("coursesMot")
		var mots := Tel.t("manchesMots") if _clm() else Tel.t("coursesMots")
		if courues > 0 and not (ch.get("points", {}) as Dictionary).is_empty():
			c.add_child(Tel.aide(Tel.t("apres", [courues, mots if courues > 1 else mot, nu.y, mot])))
			var liste := Tel.boite(true, 4)
			var cl := ChampTel.classement(ch, net.pid)
			var avant: Dictionary = ch.get("avant", {})
			for i in cl.size(): liste.add_child(ChampionnatTel.ligneClassement(cl[i], i, false, avant if courues > 1 else {}))
			c.add_child(liste)
		else:
			c.add_child(Tel.aide(Tel.t("aucune", mot)))
		c.add_child(_bareme()))


func _bareme() -> Control:
	var t := net.settings()
	var cat := Championnat.categorieTable(t, String(App.reglages.voiture))
	var pts: Array = { "f1": Championnat.POINTS_F1, "gt": Championnat.POINTS_GT, "lemans": Championnat.POINTS_LE_MANS }.get(Championnat.cleBareme(cat), Championnat.POINTS_GT)
	var texte := Tel.t("baremeClm", [Championnat.formatPoints(float(pts[0])), Championnat.formatPoints(float(pts[1]))]) if _clm() else Textes.t("bareme_" + Championnat.cleBareme(cat))
	return Tel.encartBareme(Tel.t("bareme", Tel.nomCat(cat)), texte)


## Le calendrier du championnat de la table : l'hôte le prépare, puis « Lancer » le confie à la table ; il
## part au Départ. Une fois lancé, il se lit seulement.
func _ouvreChampionnat() -> void:
	var t := net.settings()
	if optionsChamp.is_empty(): optionsChamp = (t.get("programme", {}) as Dictionary).duplicate(true)
	for cle in ["circuits", "toursParManche", "minutesParManche"]:
		if not (optionsChamp.get(cle) is Array): optionsChamp[cle] = []
	ouvrePage(Tel.t("championnat"), Tel.t("table"), func(c: VBoxContainer): _sectionsTable(c, false), func():
		var lancer := Tel.gros(Tel.t("lancer"), func():
			var o := optionsChamp.duplicate(true)
			o.clm = _clm()
			if _clm(): o.erase("qualifications")
			net.setTable({ programme = o, championnat = {} })
			fermeDessus()
			rafraichit())
		lancer.eteint((optionsChamp.circuits as Array).is_empty())
		return Tel.barreBas([lancer]))


## Une course du calendrier de la table : avancer, reculer, retirer.
func _ouvreManche(i: int) -> void:
	var n := (optionsChamp.circuits as Array).size()
	var nomC := String(Paddock.infosCircuits().get(String(optionsChamp.circuits[i]), {}).get("nom", ""))
	ouvreFeuille("%s %d · %s" % [Tel.t("manche") if _clm() else Tel.t("course"), i + 1, nomC], func(c: VBoxContainer):
		var col := Tel.boite(true, 6)
		var bouge := func(j: int):
			for k in ["circuits", "toursParManche", "minutesParManche"]:
				var arr: Array = optionsChamp[k]
				while arr.size() < n: arr.append(0)
				var x = arr[i]; arr[i] = arr[j]; arr[j] = x
			fermeDessus()
			rafraichit()
		var haut := Tel.choix(Tel.t("avancer"), Tel.t("avancerTexte"), false, bouge.bind(i - 1))
		haut.eteint(i == 0)
		col.add_child(haut)
		var basB := Tel.choix(Tel.t("reculer"), Tel.t("reculerTexte"), false, bouge.bind(i + 1))
		basB.eteint(i >= n - 1)
		col.add_child(basB)
		col.add_child(Tel.choix(Tel.t("retirer"), "", false, func():
			for k in ["circuits", "toursParManche", "minutesParManche"]:
				var arr2: Array = optionsChamp[k]
				if i < arr2.size(): arr2.remove_at(i)
			fermeDessus()
			rafraichit(), true))
		c.add_child(col), false)


func _ouvreCalendrier() -> void:
	ouvrePage(Tel.t("calendrier"), Tel.t("table"), func(c: VBoxContainer): _sectionsTable(c, true))


func _sectionsTable(c: VBoxContainer, fige: bool) -> void:
	var t := net.settings()
	var clm := _clm()
	var mode := String(t.get("mode", "race"))
	var ia := int(t.get("aiCount", -1))
	var o: Dictionary = t.get("programme", {}) if fige else optionsChamp
	var quoi := Tel.t("champTableClm") if clm else Tel.t("champTableCourse", Tel.t("duelEntre") if mode == "duel" or ia == 0 else Tel.t("avecIA"))
	c.add_child(Tel.encartBareme(Tel.t("formatClm") if clm else Tel.t("formatCourse"), quoi + " " + Tel.t("champTableReglage")))
	c.add_child(_bareme())
	var circuits: Array = o.get("circuits", [])
	var n := circuits.size()
	var nu := _numero()
	var infs := Paddock.infosCircuits()
	c.add_child(Tel.sousTitre(Tel.t("calendrier"), "%s %d / %d" % [Tel.t("manchesMot") if clm else Tel.t("coursesMot"), nu.x, nu.y] if fige else "%d / 10" % n))
	for i in n:
		var cid := String(circuits[i])
		var inf: Dictionary = infs.get(cid, {})
		var passee := fige and i + 1 < nu.x and not _champ().is_empty()
		var prochaine := fige and i + 1 == nu.x
		var h := Tel.boite(false, 8)
		h.mouse_filter = Control.MOUSE_FILTER_PASS
		var num := Tel.titre(str(i + 1), 20, Tel.PAPIER)
		num.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		num.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		var nf := Tel.fond(num, Tel.ENCRE)
		nf.custom_minimum_size = Vector2(30, 54)
		h.add_child(nf)
		var mini := Control.new()
		mini.custom_minimum_size = Vector2(62, 54)
		mini.mouse_filter = Control.MOUSE_FILTER_IGNORE
		mini.draw.connect(func(): if inf.get("image"): Style.couvre(mini, inf.image, Rect2(Vector2.ZERO, mini.size), 0.5))
		h.add_child(mini)
		var info := Tel.boite(true, 2)
		info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		info.alignment = BoxContainer.ALIGNMENT_CENTER
		info.mouse_filter = Control.MOUSE_FILTER_PASS
		info.add_child(Tel.titre(String(inf.get("nom", cid)), 17))
		var cle := "minutesParManche" if clm else "toursParManche"
		var val := Championnat.minutesManche(o, i) if clm else Championnat.toursManche(o, i, int(t.get("laps", 3)))
		var txt := Tel.t("seanceDe", val) if clm else Tel.nbTours(val)
		if fige: info.add_child(Tel.texte(txt, 14, Tel.ENCRE_DOUCE, false))
		else:
			info.add_child(Tel.pas(Tel.t("minMot", val) if clm else Tel.nbTours(val), func(dd):
				var arr: Array = optionsChamp[cle]
				while arr.size() < (optionsChamp.circuits as Array).size(): arr.append(0)
				arr[i] = clampi(val + dd, 1, 60 if clm else 99)
				rafraichit(), val > 1, val < (60 if clm else 99), true))
		h.add_child(info)
		if fige:
			var st := Control.new()
			st.custom_minimum_size = Vector2(44, 44)
			st.mouse_filter = Control.MOUSE_FILTER_IGNORE
			st.draw.connect(func():
				var m := st.size / 2
				if passee: Tel.coche(st, m, Tel.ROUGE, 9)
				elif prochaine: Style.plein(st, PackedVector2Array([m + Vector2(-7, -9), m + Vector2(9, 0), m + Vector2(-7, 9)]), Tel.ROUGE))
			h.add_child(st)
		else:
			var retirer := ToucheTel.signeSeul("points", Tel.ENCRE, Tel.PAPIER, Vector2(44, 54))
			retirer.pressed.connect(_ouvreManche.bind(i))
			h.add_child(retirer)
		var p := Tel.fond(Tel.marge(h, 4, 4, 4, 4), Tel.CARTE, Tel.ROUGE if prochaine else Tel.FILET, 2 if prochaine else 1)
		p.mouse_filter = Control.MOUSE_FILTER_PASS
		if passee: p.modulate.a = 0.6
		c.add_child(p)
	if not fige:
		var ajout := ToucheTel.texteSeul(Tel.t("ajouterCircuit"), Color(0, 0, 0, 0), Tel.ENCRE, 20, Vector2(0, 52))
		ajout.bord = Tel.ENCRE
		ajout.epaisseur = 2
		ajout.eteint(n >= 10)
		ajout.pressed.connect(func():
			ouvreFeuille(Tel.t("ajouterCircuit").trim_prefix("+ "), func(cc: VBoxContainer):
				PaddockTel.grilleCircuits(cc, "", func(id):
					if (optionsChamp.circuits as Array).size() < 10:
						(optionsChamp.circuits as Array).append(id)
						var tp: Array = optionsChamp.toursParManche
						while tp.size() < (optionsChamp.circuits as Array).size(): tp.append(int(net.settings().get("laps", 3)))
						var mp: Array = optionsChamp.minutesParManche
						while mp.size() < (optionsChamp.circuits as Array).size(): mp.append(10)
					fermeDessus()
					rafraichit(), optionsChamp.circuits, Tel.t("ajouteAide"))))
		c.add_child(ajout)
		if n == 0: c.add_child(Tel.aide(Tel.t("auMoinsUn")))
		if clm and not net.members().all(func(m): return int(m.q.get("championnatClm", 0)) >= 1): c.add_child(Tel.texte(Tel.t("clmGodot"), 14, Tel.ROUGE))
	# les séances : les essais, et les qualifications en course
	c.add_child(Tel.sousTitre(Tel.t("seances")))
	var seances := [["essais", "essais"]] if clm else [["essais", "essais"], ["qualifications", "qualifs"]]
	for s in seances:
		var mn := int(o.get(s[0], 0))
		var phrase := Tel.t("seanceMin", mn) if mn > 0 else Tel.t("pasDeSeance")
		var droite: Control
		if fige: droite = Tel.valeur(Tel.t("minMot", mn) if mn > 0 else "—")
		else:
			droite = Tel.pas(Tel.t("minMot", mn) if mn > 0 else "—", func(dd):
				optionsChamp[s[0]] = clampi(int(optionsChamp.get(s[0], 0)) + dd, 0, 60)
				rafraichit(), mn > 0, mn < 60)
		c.add_child(Tel.ligne(Tel.t(s[1]), phrase, droite))
	if fige: c.add_child(Tel.aide(Tel.t("figeTable")))
