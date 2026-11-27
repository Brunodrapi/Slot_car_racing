## LA FICHE ET LES CHRONOS D'UN CIRCUIT (maquette, rendPage), sous le chrono de la carte : l'image, quatre
## chiffres, « Plus de détails », puis les chronos de chaque voiture (ton record sur cet appareil, le
## record du monde du tableau mondial), par catégorie.
class_name FicheTel
extends RefCounted

static var filtre := "tous"
static var details := false


static func ouvre(e: EcranTel, cid: String) -> void:
	var infs := Paddock.infosCircuits()
	if not infs.has(cid): return
	Mondial.chargeToursTotaux()
	e.ouvrePage(String(infs[cid].nom), Tel.t("table") if App.enLigne != null or e.nom == "salon" else Tel.t("paddock"),
		func(c: VBoxContainer): construit(c, e, cid))


static func construit(c: VBoxContainer, e: EcranTel, cid: String) -> void:
	var inf: Dictionary = Paddock.infosCircuits()[cid]
	var r := App.reglages
	var nuit: bool = bool(r.get("nuit", false)) and Catalogue.voiture(r.voiture).get("cat", "") != "f1"
	# l'image du circuit, son pays et sa difficulté
	var art := Control.new()
	art.custom_minimum_size = Vector2(0, 195)
	art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	art.draw.connect(func():
		var zr := Rect2(Vector2.ZERO, art.size)
		if inf.get("image"): Style.couvre(art, inf.image, zr, 0.5)
		if nuit: art.draw_rect(zr, Color(0.04, 0.08, 0.19, 0.7))
		Paddock._contour(art, inf, Rect2(zr.size.x * 0.12, zr.size.y * 0.06, zr.size.x * 0.76, zr.size.y * 0.68), false, 3.6, true, nuit)
		var y := zr.size.y - 37
		art.draw_rect(Rect2(0, y, zr.size.x, 37), Color("#fbf4e2f2"))
		art.draw_line(Vector2(0, y + 1), Vector2(zr.size.x, y + 1), Tel.ENCRE, 2)
		var pays := Textes.pays(String(inf.pays)).to_upper()
		Style.texte(art, pays, Vector2(10, y + 27), 22, Tel.ENCRE)
		var dr := Style.drapeau(String(inf.pays))
		var x := 10 + Style.largeur(pays, 22) + 8
		if dr: art.draw_texture_rect(dr, Rect2(x, y + 10, 26, 17), false)
		Tel.niveauDessine(art, int(inf.difficulty), Vector2(zr.size.x - 10, y + 25), true)
		art.draw_rect(zr, Tel.ENCRE, false, 2))
	c.add_child(art)
	# les quatre chiffres
	var par = Mondial.meilleurs(cid)
	var monde: Dictionary = par if par is Dictionary else {}
	var record := INF
	var qui := ""
	for vid in monde:
		var tps := float(monde[vid].get("temps", -1))
		if tps > 0 and tps < record:
			record = tps
			var v := Catalogue.voiture(String(vid))
			qui = String(v.get("nom", vid))
			var pilote := String(monde[vid].get("pilote", ""))
			if pilote != "": qui += " · " + pilote
	var faits := GridContainer.new()
	faits.columns = 2
	faits.add_theme_constant_override("h_separation", 6)
	faits.add_theme_constant_override("v_separation", 6)
	faits.mouse_filter = Control.MOUSE_FILTER_IGNORE
	faits.add_child(_fait(Tel.t("longueur"), "%s m" % CartesTel._milliers(roundi(inf.longueur))))
	faits.add_child(_fait(Tel.t("virages"), str(inf.virages)))
	faits.add_child(_fait(Tel.t("recordCircuit"), Style.temps(record) if is_finite(record) else "—", qui, Color("#8a4fd8")))
	faits.add_child(_fait(Tel.t("mesTours"), str(int(r.get("toursCircuit", {}).get(cid, 0)))))
	c.add_child(faits)
	# plus de détails, repliés
	var plus := ToucheTel.new(Tel.CARTE)
	plus.bord = Tel.FILET
	plus.epaisseur = 1
	plus.marges(10, 0, 10, 0)
	plus.custom_minimum_size.y = 48
	var ph := Tel.boite(false, 6)
	ph.add_child(Tel.glyphe("bas" if details else "droite", 12, Tel.ENCRE))
	ph.add_child(Tel.texte(Tel.t("plusDetails"), 15, Tel.ENCRE, false))
	plus.ajoute(ph)
	plus.pressed.connect(func(): details = not details; e.rafraichit())
	c.add_child(plus)
	if details:
		var pointe: Dictionary = inf.get("pointe", {})
		var col := Tel.boite(true, 4)
		for d in [[Tel.t("rayon"), ("%.1f m" % inf.rayon).replace(".", "," if Textes.langue() == "fr" else ".") if inf.rayon > 0 else "—"],
				[Tel.t("droite"), "%s m" % CartesTel._milliers(roundi(inf.droite)) if inf.droite > 0 else "—"],
				[Tel.t("pointe"), "%d km/h · %s" % [int(pointe.kmh), Catalogue.voiture(String(pointe.voiture)).get("nom", "")] if not pointe.is_empty() else "—"],
				[Tel.t("toursTous"), str(Mondial.toursTotaux.get(cid, 0)) if Mondial.toursDisponibles else "—"]]:
			var h := Tel.boite(false, 8)
			var n := Tel.texte(d[0], 14, Tel.ENCRE_DOUCE, false)
			n.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			h.add_child(n)
			h.add_child(Tel.titre(d[1], 16))
			col.add_child(h)
		c.add_child(Tel.fond(Tel.marge(col, 10, 8, 10, 8), Tel.CARTE, Tel.FILET, 1))
	# les chronos du circuit
	c.add_child(Tel.sousTitre(Tel.t("chronosCircuit")))
	var seg := GridContainer.new()
	seg.columns = 5
	seg.add_theme_constant_override("h_separation", 4)
	seg.mouse_filter = Control.MOUSE_FILTER_PASS
	var onglets := [["tous", Tel.t("toutes")]]
	for k in Catalogue.categories(): onglets.append([String(k.id), Textes.nom(k.nom)])
	for o in onglets:
		var b := ToucheTel.texteSeul(String(o[1]), Tel.VERT if filtre == o[0] else Tel.ENCRE, Tel.PAPIER, 16, Vector2(0, 44))
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.pressed.connect(func(): filtre = o[0]; e.rafraichit())
		seg.add_child(b)
	c.add_child(seg)
	var tete := Tel.boite(false, 8)
	tete.add_child(Tel.espace(54, 0))
	var tv := Tel.titre(Tel.t("voiture"), 13, Tel.ENCRE_DOUCE)
	tv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tete.add_child(tv)
	for cle in ["colTonRecord", "colMonde"]:
		var l := Tel.titre(Tel.t(cle), 13, Tel.ENCRE_DOUCE)
		l.custom_minimum_size.x = 76
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		tete.add_child(l)
	c.add_child(Tel.marge(tete, 6, 0, 8, 0))
	var perso: Dictionary = r.get("records", {})
	var lignes := []
	for v in Catalogue.donnees.voitures:
		if filtre != "tous" and v.cat != filtre: continue
		var loc := float(perso.get(cid + "/" + v.id, -1))
		var mon := float(monde.get(v.id, {}).get("temps", -1))
		lignes.append({ v = v, loc = loc, mon = mon, tri = minf(loc if loc > 0 else INF, mon if mon > 0 else INF) })
	lignes.sort_custom(func(a, b): return a.tri < b.tri if a.tri != b.tri else String(a.v.nom) < String(b.v.nom))
	for l in lignes:
		var h := Tel.boite(false, 8)
		h.add_child(Tel.image(Tel.vignette(String(l.v.id), 0), Vector2(54, 30)))
		var n := Tel.boite(true, 0)
		n.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var nomV := Tel.titre(String(l.v.nom), 15)
		nomV.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		nomV.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		n.add_child(nomV)
		var pilote := String(monde.get(l.v.id, {}).get("pilote", ""))
		if pilote != "": n.add_child(Tel.texte(pilote, 12, Tel.ENCRE_DOUCE, false))
		h.add_child(n)
		for tps in [l.loc, l.mon]:
			var val := Tel.titre(Style.temps(tps) if tps > 0 else "—", 15, Color("#8a4fd8") if tps == l.mon and tps > 0 else Tel.ENCRE)
			val.custom_minimum_size.x = 76
			val.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
			h.add_child(val)
		var moi := String(l.v.id) == String(r.voiture)
		c.add_child(Tel.fond(Tel.marge(h, 6, 4, 8, 4), Tel.CARTE, Tel.ROUGE if moi else Tel.FILET, 2 if moi else 1))


static func _fait(nom: String, val: String, sous := "", couleur := Tel.ENCRE) -> Control:
	var v := Tel.boite(true, 1)
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var tn := Tel.titre(nom, 14, Tel.ENCRE_DOUCE)
	tn.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	v.add_child(tn)
	v.add_child(Tel.titre(val, 20, couleur))
	if sous != "":
		var s := Tel.texte(sous, 12, Tel.ENCRE_DOUCE)
		v.add_child(s)
	var p := Tel.fond(Tel.marge(v, 10, 8, 10, 8), Tel.CARTE, Tel.FILET, 1)
	p.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return p
