## LE CHAMPIONNAT AU TÉLÉPHONE (maquette, rendChampDepart) : son écran de départ, ouvert du menu. La voiture
## (sa catégorie fait le barème), le calendrier (jusqu'à dix courses : les tours de chacune, « ⋯ » pour
## avancer, reculer ou retirer), les séances d'essais et de qualifications à la minute, la grille, puis
## « Lancer ». Pas de classement ici : il n'y en a pas encore. Lancé, le paddock du championnat prend
## la suite (PaddockTel, mode « champ ») ; ce fichier lui prête le calendrier à lire et le classement.
class_name ChampionnatTel
extends EcranTel

var voitureAvant := ""
var filtreGarage := "tous"
static var mancheChoisie := 0


func _init() -> void:
	nom = "accueil"


func _ready() -> void:
	Paddock.precharge()
	super()


func retour() -> void:
	App.aller("accueil")


func construit(v: Control) -> void:
	var col := colonne(v, Tel.t("championnat"), Tel.t("retour"), retour)
	var defile := DefileTel.new(12, 10, 10, 10, 16)
	col.add_child(defile)
	var c := defile.contenu
	var r := App.reglages
	var voit := Catalogue.voiture(r.voiture)
	var cat := String(voit.get("cat", "gt"))
	# la voiture : sa catégorie fait le barème
	c.add_child(Tel.sousTitre(Tel.t("voiture")))
	var b := ToucheTel.new(Tel.CARTE)
	b.bord = Tel.FILET
	b.epaisseur = 1
	b.marges(8, 8, 10, 8)
	b.custom_minimum_size.y = 60
	var h := Tel.boite(false, 10)
	h.add_child(Tel.image(Tel.vignette(String(voit.id), int(r.livree)), Vector2(78, 44)))
	var g := Tel.boite(true, 2)
	g.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	g.add_child(Tel.titre(String(voit.nom), 20))
	g.add_child(Tel.texte(Tel.t("toutesCourses", Tel.nomCat(cat)), 13))
	h.add_child(g)
	var gar := Tel.boite(false, 4)
	gar.add_child(Tel.valeur(Tel.t("garage")))
	gar.add_child(Tel.glyphe("droite", 14, Tel.VERT))
	h.add_child(gar)
	b.ajoute(h)
	b.pressed.connect(func():
		voitureAvant = String(App.reglages.voiture)
		filtreGarage = String(Catalogue.voiture(App.reglages.voiture).get("cat", "tous"))
		ouvreFeuille(Tel.t("garage"), func(cc: VBoxContainer): PaddockTel.garage(cc, self)))
	c.add_child(b)
	c.add_child(Tel.encartBareme(Tel.t("bareme", Tel.nomCat(cat)), Textes.t("bareme_" + Championnat.cleBareme(cat))))
	sections(c, self, false)
	var o := ChampTel.options()
	var lancer := Tel.gros(Tel.t("lancer"), func():
		ChampTel.lance()
		App.aller("paddock", { mode = "champ" }))
	lancer.eteint((o.circuits as Array).is_empty())
	col.add_child(Tel.barreBas([lancer]))
	defile.reprend(_defileAvant)
	_garde = defile


var _garde: DefileTel
var _defileAvant := 0.0


func reconstruit() -> void:
	if is_instance_valid(_garde): _defileAvant = _garde.haut
	super()


## Le calendrier, les séances et la grille : à régler (l'écran de départ), ou à lire (lancé).
static func sections(c: VBoxContainer, e: EcranTel, fige: bool) -> void:
	var o := ChampTel.options()
	var r := App.reglages
	var circuits: Array = o.circuits
	var tours: Array = o.toursParManche
	var n := circuits.size()
	var numero := ChampTel.numero() if fige else 0
	var infs := Paddock.infosCircuits()
	c.add_child(Tel.sousTitre(Tel.t("calendrier"), "%s %d / %d" % [Tel.t("coursesMot"), numero, n] if fige else "%d / 10" % n))
	var liste := Tel.boite(true, 6)
	liste.mouse_filter = Control.MOUSE_FILTER_PASS
	for i in n:
		var cid := String(circuits[i])
		var inf: Dictionary = infs.get(cid, {})
		var passee := fige and i + 1 < numero
		var prochaine := fige and i + 1 == numero
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
		var infos := Tel.boite(true, 2)
		infos.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		infos.alignment = BoxContainer.ALIGNMENT_CENTER
		infos.mouse_filter = Control.MOUSE_FILTER_PASS
		infos.add_child(Tel.titre(String(inf.get("nom", cid)), 17))
		var t := int(tours[i]) if i < tours.size() else int(r.tours)
		if fige: infos.add_child(Tel.texte(Tel.nbTours(t), 14, Tel.ENCRE_DOUCE, false))
		else:
			infos.add_child(Tel.pas(Tel.nbTours(t), func(d):
				var o2 := ChampTel.options()
				o2.toursParManche[i] = clampi(int(o2.toursParManche[i]) + d, 1, 99)
				App.sauve()
				e.rafraichit(), t > 1, t < 99, true))
		h.add_child(infos)
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
			var plus := ToucheTel.signeSeul("points", Tel.ENCRE, Tel.PAPIER, Vector2(44, 54))
			plus.pressed.connect(func(): mancheChoisie = i; _ouvreManche(e))
			h.add_child(plus)
		var bordure := Tel.ROUGE if prochaine else Tel.FILET
		var p := Tel.fond(Tel.marge(h, 4, 4, 4, 4), Tel.CARTE, bordure, 2 if prochaine else 1)
		p.mouse_filter = Control.MOUSE_FILTER_PASS
		if passee: p.modulate.a = 0.6
		liste.add_child(p)
	c.add_child(liste)
	if not fige:
		var ajout := ToucheTel.texteSeul(Tel.t("ajouterCircuit"), Color(0, 0, 0, 0), Tel.ENCRE, 20, Vector2(0, 52))
		ajout.bord = Tel.ENCRE
		ajout.epaisseur = 2
		ajout.eteint(n >= 10)
		ajout.pressed.connect(func():
			e.ouvreFeuille(Tel.t("ajouterCircuit").trim_prefix("+ "), func(cc: VBoxContainer):
				PaddockTel.grilleCircuits(cc, "", func(id):
					var o3 := ChampTel.options()
					if (o3.circuits as Array).size() < 10:
						(o3.circuits as Array).append(id)
						(o3.toursParManche as Array).resize((o3.circuits as Array).size())
						o3.toursParManche[(o3.circuits as Array).size() - 1] = int(App.reglages.tours)
					ChampTel.etat().fini = 0
					App.sauve()
					e.fermeDessus()
					e.rafraichit(), ChampTel.options().circuits, Tel.t("ajouteAide"))))
		c.add_child(ajout)
		if n == 0: c.add_child(Tel.aide(Tel.t("auMoinsUn")))
	# les séances
	c.add_child(Tel.sousTitre(Tel.t("seances")))
	for s in [["essais", "essais"], ["qualifications", "qualifs"]]:
		var mn := int(o.get(s[0], 0))
		var phrase := Tel.t("seanceMin", mn) if mn > 0 else Tel.t("pasDeSeance")
		var droite: Control
		if fige: droite = Tel.valeur(Tel.t("minMot", mn) if mn > 0 else "—")
		else:
			droite = Tel.pas(Tel.t("minMot", mn) if mn > 0 else "—", func(d):
				ChampTel.options()[s[0]] = clampi(int(ChampTel.options().get(s[0], 0)) + d, 0, 60)
				App.sauve()
				e.rafraichit(), mn > 0, mn < 60)
		c.add_child(Tel.ligne(Tel.t(s[1]), phrase, droite))
	# la grille de départ (le championnat seul)
	c.add_child(Tel.sousTitre(Tel.t("grille")))
	var adv := (int(ChampTel.etat().get("adversaires", r.adversaires)) if fige else int(r.adversaires)) - 1
	if fige: c.add_child(Tel.ligne(Tel.t("adversaires"), "", Tel.valeur(str(adv))))
	else:
		c.add_child(Tel.ligne(Tel.t("adversaires"), Tel.t("adversairesTexte"), Tel.pas(str(adv), func(d):
			App.reglages.adversaires = clampi(int(App.reglages.adversaires) + d, 2, 12)
			App.sauve()
			e.rafraichit(), adv > 1, adv < 11)))
	var place := int((o.positions as Dictionary).get("joueur", 0))
	var phrasePlace := Tel.t("placeFixee") if place > 0 else Tel.t("placeAuto")
	if fige: c.add_child(Tel.ligne(Tel.t("taPlace"), phrasePlace, Tel.valeur(str(place) if place > 0 else Tel.t("auto"))))
	else:
		c.add_child(Tel.ligne(Tel.t("taPlace"), phrasePlace, Tel.pas(str(place) if place > 0 else Tel.t("auto"), func(d):
			var p2 := clampi(place + d, 0, adv + 1)
			if p2 > 0: ChampTel.options().positions.joueur = p2
			else: ChampTel.options().positions.erase("joueur")
			App.sauve()
			e.rafraichit(), place > 0, place < adv + 1)))


static func _ouvreManche(e: EcranTel) -> void:
	var o := ChampTel.options()
	var i := mancheChoisie
	var n := (o.circuits as Array).size()
	var nomC := String(Paddock.infosCircuits().get(String(o.circuits[i]), {}).get("nom", ""))
	e.ouvreFeuille("%s %d · %s" % [Tel.t("course"), i + 1, nomC], func(c: VBoxContainer):
		var choix := Tel.boite(true, 6)
		var bouge := func(j: int):
			var o2 := ChampTel.options()
			var cs: Array = o2.circuits
			var ts: Array = o2.toursParManche
			var a = cs[i]; cs[i] = cs[j]; cs[j] = a
			var b = ts[i]; ts[i] = ts[j]; ts[j] = b
			App.sauve()
			e.fermeDessus()
			e.rafraichit()
		var haut := Tel.choix(Tel.t("avancer"), Tel.t("avancerTexte"), false, bouge.bind(i - 1))
		haut.eteint(i == 0)
		choix.add_child(haut)
		var basB := Tel.choix(Tel.t("reculer"), Tel.t("reculerTexte"), false, bouge.bind(i + 1))
		basB.eteint(i >= n - 1)
		choix.add_child(basB)
		choix.add_child(Tel.choix(Tel.t("retirer"), "", false, func():
			var o3 := ChampTel.options()
			(o3.circuits as Array).remove_at(i)
			(o3.toursParManche as Array).remove_at(i)
			App.sauve()
			e.fermeDessus()
			e.rafraichit(), true))
		c.add_child(choix), false)


## Le calendrier en cours, depuis la carte du circuit du paddock du championnat : à lire seulement.
static func calendrierFige(c: VBoxContainer) -> void:
	var cat := String(ChampTel.etat().get("cat", "gt"))
	c.add_child(Tel.encartBareme(Tel.t("bareme", Tel.nomCat(cat)), Textes.t("bareme_" + Championnat.cleBareme(cat))))
	sections(c, null, true)
	c.add_child(Tel.aide(Tel.t("figeSolo")))


## Le classement complet, depuis la pastille du paddock du championnat.
static func classementComplet(c: VBoxContainer) -> void:
	var courues := ChampTel.courues()
	var n := ChampTel.nombre()
	var mot := Tel.t("coursesMot")
	if courues > 0:
		c.add_child(Tel.aide(Tel.t("apres", [courues, Tel.t("coursesMots" if courues > 1 else "coursesMot"), n, mot])))
		var liste := Tel.boite(true, 4)
		var cl := ChampTel.classement()
		var avant: Dictionary = ChampTel.etat().get("avant", {})
		for i in cl.size(): liste.add_child(ligneClassement(cl[i], i, false, avant if courues > 1 else {}))
		c.add_child(liste)
	else:
		c.add_child(Tel.aide(Tel.t("aucune", mot)))
	var cat := String(ChampTel.etat().get("cat", "gt"))
	c.add_child(Tel.encartBareme(Tel.t("bareme", Tel.nomCat(cat)), Textes.t("bareme_" + Championnat.cleBareme(cat))))


## Une ligne du classement (.classement li) : la place, le nom (et le meilleur tour en contre-la-montre),
## la flèche des places gagnées (▲, vert) ou perdues (▼, rouge) à la dernière course, les points.
static func ligneClassement(p: Dictionary, i: int, gain: bool, avant: Dictionary, serre := false, tempsTour := 0.0) -> Control:
	var h := Tel.boite(false, 8)
	var pos := Tel.titre(str(i + 1), 18, Tel.PAPIER)
	pos.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	pos.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	var pf := Tel.fond(pos, Tel.ENCRE)
	pf.custom_minimum_size = Vector2(34, 30 if serre else 40)
	h.add_child(pf)
	var nomL := Tel.boite(false, 6)
	nomL.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	nomL.alignment = BoxContainer.ALIGNMENT_BEGIN
	var nm := Tel.titre(Tel.t("toi") if p.get("moi", false) else String(p.nom), 17)
	nm.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	nm.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	nomL.add_child(nm)
	if tempsTour > 0:
		var tt := Tel.texte(Style.temps(tempsTour), 13, Tel.ENCRE_DOUCE, false)
		tt.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		nomL.add_child(tt)
	h.add_child(nomL)
	if not avant.is_empty() and avant.has(p.cle):
		var d := int(avant[p.cle]) - (i + 1)
		var mv := Tel.boite(false, 1)
		mv.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		if d > 0:
			mv.add_child(Tel.glyphe("haut", 12, Tel.VERT))
			mv.add_child(Tel.titre(str(d), 15, Tel.VERT))
		elif d < 0:
			mv.add_child(Tel.glyphe("bas", 12, Tel.ROUGE))
			mv.add_child(Tel.titre(str(-d), 15, Tel.ROUGE))
		else:
			mv.add_child(Tel.titre("=", 15, Tel.ENCRE_DOUCE))
		h.add_child(mv)
	var pts := Tel.titre(("+" if gain else "") + Tel.points(float(p.pts)), 17)
	pts.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	h.add_child(pts)
	var moi: bool = p.get("moi", false)
	var f := Tel.fond(Tel.marge(h, 0, 0, 10, 0), Tel.CARTE, Tel.ROUGE if moi else Tel.FILET, 2 if moi else 1)
	return f
