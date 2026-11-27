## L'ARRIVÉE AU TÉLÉPHONE (maquette, simuleArrivee et podium) : la course (les premiers et ta place), puis,
## en championnat, le classement mis à jour avec les places gagnées ou perdues ; après la dernière
## course, le podium. Les séances d'essais et de qualifications enchaînent sur la suivante.
class_name ResultatsTel
extends EcranTel

var course: Course
var champ := false            # le championnat seul, au téléphone
var estCourse := true
var podium := false


func _init(c: Course) -> void:
	course = c
	nom = "resultats"


func _ready() -> void:
	champ = String(App.reglages.get("modeTel", "")) == "champ" and course.netDrive == null and not App.championnatResultats.is_empty()
	if champ: estCourse = ChampTel.apresSeance(course)
	else: estCourse = course.phase == "course"
	super()


func retour() -> void:
	_paddock()


func _paddock() -> void:
	App.aller("paddock", { mode = "champ" if champ else App.reglages.mode })


func construit(v: Control) -> void:
	var fond := Control.new()
	fond.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	fond.mouse_filter = Control.MOUSE_FILTER_IGNORE
	fond.draw.connect(func():
		var fp := Style.tex("res://images/interface/paddock.webp")
		if fp: Style.couvre(fond, fp, Rect2(Vector2.ZERO, fond.size), 0.4)
		fond.draw_rect(Rect2(Vector2.ZERO, fond.size), Color("#0f1211ee")))
	v.add_child(fond)
	var defile := DefileTel.new(0, 12, 14, 12, 14)
	defile.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	v.add_child(defile)
	var boite := Tel.boite(true, 6)
	var cadre := Tel.fond(Tel.marge(boite, 16, 14, 16, 16), Tel.PAPIER, Tel.ENCRE, 3)
	cadre.mouse_filter = Control.MOUSE_FILTER_PASS
	boite.mouse_filter = Control.MOUSE_FILTER_PASS
	var centre := CenterContainer.new()
	centre.custom_minimum_size.y = H - 28
	centre.mouse_filter = Control.MOUSE_FILTER_PASS
	cadre.custom_minimum_size.x = Tel.W - 24
	centre.add_child(cadre)
	defile.contenu.add_child(centre)
	if podium: _podium(boite)
	else: _arrivee(boite)


func _arrivee(b: VBoxContainer) -> void:
	var p := course.player
	var circuit := String(course.track.nom)
	var n := ChampTel.nombre()
	var numero := ChampTel.courues()
	var seance := course.phase != "course"
	var clm := course.mode == "timetrial"
	var titre := Tel.t("finSeance") if seance or clm else Tel.t("arrivee")
	var h2 := Tel.titre(titre, 34, Tel.ROUGE)
	b.add_child(h2)
	var sous := circuit
	if champ and estCourse: sous = Tel.t("simulee", [circuit, Tel.t("coursesMot"), numero, n]).replace(" · simulée", "")
	elif champ: sous = "%s · %s" % [circuit, Textes.t(course.phase)]
	elif clm: sous = "%s · %s" % [circuit, Textes.t("training" if course.entrainement else "timeTrial")]
	elif not seance: sous = "%s · %s" % [circuit, Textes.t("finishPos", [course.positionOf(p), course.cars.size()])]
	b.add_child(Tel.texte(sous, 15, Tel.ENCRE_DOUCE))
	# la course : les premiers, et ta ligne si tu es plus loin
	var liste := Tel.boite(true, 3)
	var lignes := []
	for res in course.results:
		var c: Voiture = res.car
		lignes.append({ cle = "", nom = String(c.nom), pts = float(res.get("points", 0)), moi = c == p,
			temps = float(res.meilleur) if (seance or clm) else 0.0, ecart = float(res.get("ecart", 0)), abandon = res.get("abandon", false) })
	var avecPoints := champ and lignes.any(func(l): return l.pts > 0)
	var montres := 3 if champ and estCourse else 6
	_tete(liste, lignes, montres, func(l, i):
		if avecPoints: return ChampionnatTel.ligneClassement(l, i, true, {}, true, l.temps)
		return _ligneSimple(l, i, seance or clm))
	b.add_child(liste)
	# le championnat : le classement mis à jour, avec les flèches
	if champ and estCourse:
		var fini := not ChampTel.enCours()
		var courues := ChampTel.courues()
		var compl := Tel.t("final") if fini else Tel.t("apresN", [courues, Tel.t("coursesMots" if courues > 1 else "coursesMot"), n])
		b.add_child(Tel.sousTitre(Tel.t("championnat"), compl))
		var cl := ChampTel.classement()
		var avant: Dictionary = ChampTel.etat().get("avant", {})
		var gen := Tel.boite(true, 3)
		_tete(gen, cl, 5, func(l, i): return ChampionnatTel.ligneClassement(l, i, false, avant if courues > 1 else {}, true))
		b.add_child(gen)
		if fini: b.add_child(Tel.gros(Tel.t("voirPodium"), func(): podium = true; reconstruit()))
		else: b.add_child(Tel.gros(Tel.t("suivante", Tel.t("course")), _paddock))
	elif champ:
		b.add_child(Tel.gros(Tel.t("sessionSuivante"), ChampTel.seanceSuivante))
		b.add_child(_puce(Tel.t("paddock"), _paddock))
	else:
		_trophee(b)
		b.add_child(Tel.gros(Tel.t("recommencer"), func(): App.demarre(); App.aller("course")))
		b.add_child(_puce(Tel.t("paddock"), _paddock))


func _puce(t: String, action: Callable) -> ToucheTel:
	var c := Tel.puce(t, action)
	var l := c.get_child(0) as Label
	if l: l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return c


## Les `n` premiers, puis « … » et ta ligne si tu es plus loin.
static func _tete(dans: VBoxContainer, lignes: Array, n: int, rendu: Callable) -> void:
	var moi := -1
	for i in lignes.size():
		if lignes[i].moi: moi = i
	for i in mini(n, lignes.size()): dans.add_child(rendu.call(lignes[i], i))
	if moi >= n:
		var saut := Tel.texte("…", 14, Tel.ENCRE_DOUCE, false)
		saut.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		dans.add_child(saut)
		dans.add_child(rendu.call(lignes[moi], moi))


func _ligneSimple(l: Dictionary, i: int, tour: bool) -> Control:
	var h := Tel.boite(false, 8)
	var pos := Tel.titre(str(i + 1), 18, Tel.PAPIER)
	pos.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	pos.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	var pf := Tel.fond(pos, Tel.ENCRE)
	pf.custom_minimum_size = Vector2(34, 34)
	h.add_child(pf)
	var nm := Tel.titre(Tel.t("toi") if l.moi else String(l.nom), 17)
	nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	nm.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	nm.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	h.add_child(nm)
	var droite := ""
	if l.abandon: droite = Textes.t("abandonRes")
	elif tour: droite = Style.temps(float(l.temps)) if float(l.temps) > 0 else "—"
	elif i > 0: droite = "+%.3f" % float(l.ecart)
	var d := Tel.titre(droite, 16, Tel.ROUGE if l.abandon else Tel.ENCRE)
	d.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	h.add_child(d)
	return Tel.fond(Tel.marge(h, 0, 0, 10, 0), Tel.CARTE, Tel.ROUGE if l.moi else Tel.FILET, 2 if l.moi else 1)


## Le palmarès (Resultats) : le trophée gagné, ou ce qui manquait.
func _trophee(b: VBoxContainer) -> void:
	var tr: Dictionary = App.dernierTrophee if App.derniereCourse == course else {}
	if tr.is_empty(): return
	if tr.raison == "tours":
		b.add_child(Tel.texte(Textes.t("tropheeTours", Palmares.TOURS_MIN), 14, Tel.ENCRE_DOUCE))
	elif tr.nouveau:
		var h := Tel.boite(false, 8)
		h.add_child(Tel.image(Palmares.texture(tr.rang, 44), Vector2(44, 44)))
		h.add_child(Tel.texte(Textes.t("tropheeNouveau", Palmares.nom(tr.rang)), 15, Tel.ENCRE))
		b.add_child(h)
	else:
		var h2 := Tel.boite(false, 8)
		h2.add_child(Tel.image(Palmares.texture(tr.ancien, 28), Vector2(28, 28)))
		h2.add_child(Tel.texte(Textes.t("tropheeAcquis", Palmares.nom(tr.ancien)), 14, Tel.ENCRE_DOUCE))
		b.add_child(h2)


## Le podium (maquette, podium) : le premier au milieu, le plus haut ; or, argent, bronze ; puis ta place.
func _podium(b: VBoxContainer) -> void:
	var cl := ChampTel.classement()
	var moi := ChampTel.maPlace()
	b.add_child(Tel.titre(Tel.t("champion") if moi == 1 else Tel.t("podium"), 34, Tel.ROUGE))
	var n := ChampTel.nombre()
	b.add_child(Tel.texte(Tel.t("champSous", [Tel.nomCat(String(ChampTel.etat().get("cat", ""))), n, Tel.t("coursesMots" if n > 1 else "coursesMot")]), 15, Tel.ENCRE_DOUCE))
	var marches := Tel.boite(false, 6)
	marches.alignment = BoxContainer.ALIGNMENT_CENTER
	var ordre := [1, 0, 2]
	var hauteurs := [110.0, 80.0, 58.0]
	var couleurs := [Color("#e3b91d"), Color("#c9c9c0"), Color("#c98a4b")]
	for j in ordre:
		if j >= cl.size(): continue
		var p: Dictionary = cl[j]
		var col := Tel.boite(true, 2)
		col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		col.alignment = BoxContainer.ALIGNMENT_END
		var nm := Tel.titre(Tel.t("toi") if p.moi else String(p.nom), 18, Tel.ROUGE if p.moi else Tel.ENCRE)
		nm.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		nm.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		col.add_child(nm)
		var pt := Tel.texte(Tel.points(float(p.pts)), 13, Tel.ENCRE_DOUCE, false)
		pt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		col.add_child(pt)
		var socle := Tel.titre(str(j + 1), 40)
		socle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		socle.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		var sf := Tel.fond(socle, couleurs[j], Tel.ROUGE if p.moi else Tel.ENCRE, 3 if p.moi else 2)
		sf.custom_minimum_size.y = hauteurs[j]
		col.add_child(sf)
		marches.add_child(col)
	var zone := Tel.marge(marches, 0, 8, 0, 4)
	zone.custom_minimum_size.y = 190
	b.add_child(zone)
	var mes: Dictionary = cl[moi - 1] if moi > 0 else {}
	var phrase := Tel.t("gagne", String(cl[0].nom)) if moi == 0 else (Tel.t("gagnes", Championnat.formatPoints(float(mes.pts))) if moi == 1 \
		else (Tel.t("montes", [Tel.rang(moi), Championnat.formatPoints(float(mes.pts))]) if moi <= 3 else Tel.t("finis", [Tel.rang(moi), cl.size(), Championnat.formatPoints(float(mes.pts))])))
	var info := Tel.texte(phrase, 15, Color.WHITE)
	b.add_child(Tel.fond(Tel.marge(info, 12, 10, 12, 10), Tel.VERT if moi > 0 and moi <= 3 else Tel.ENCRE))
	b.add_child(Tel.gros(Tel.t("nouveauChamp"), func(): App.aller("championnat"), false, Tel.ROUGE, 24))
	b.add_child(_puce(Tel.t("menu"), func(): App.aller("accueil")))
