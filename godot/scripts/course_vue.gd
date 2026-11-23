## L'écran de course : le décor, les voitures, la caméra du jeu web, les commandes, la pause.
##
## La course (Course) tourne à 120 pas par seconde dans _physics_process, comme le jeu web
## (race.dt) ; l'image se pose entre deux pas par interpolation, si bien que le mouvement reste
## régulier à 60, 120 ou 144 Hz.
extends Node2D

var piste: Piste
var course: Course
var decor: Decor
var vues: Array[VoitureVue] = []
var camera: Camera2D
var effets: Effets
var degatsVue: DegatsVue
var mecanos: Mecanos = null            # les équipes des stands, quand les stands servent
var mecanosDessous: Node2D
var mecanosDessus: Node2D
var guide: GuideVue
var nuit: Nuit
var son: Son
var secousse := 0.0
var hud: Hud
var pause: Pause
var prec: Array[PackedFloat64Array] = []

# La caméra (js/render.js, updateCamera)
var tourne := false
var cam := Vector2.ZERO
var camOff := Vector2.ZERO
var camZoom := 10.0
var camAngle := 0.0
var camInit := false
const VMAX_ECRAN := 290 / 3.6

# Les commandes
var gaz := 0.0
var ligne := 0.0
var stand := false          # la coche des stands (main.js, input.pit) : une intention, pas une ligne
var doigtsGaz := {}
var doigtLevier := -1
var enPause := false
var finieDepuis := -1.0

# La mesure
var dureesImage: Array[float] = []
var pireImage := 0.0
var coutPas := 0.0


var chargement: Label
# En ligne : la course de la table (App.enLigne, donnée par Net.onStart), ou rien.
var enLigne = null
var circuitId := ""
var voitureId := ""
var _attenteAnnoncee := 0.0


## Le circuit, la voiture et l'heure : ceux de la table en ligne, sinon ceux des réglages.
# « Régler » au paddock : la course s'ouvre en mode réglage (App.aller, opts.reglage)
var reglageDemande := false
var doigtFrein := -1                 # le doigt (ou -2 : la souris) qui tient le levier du frein

func _choix() -> void:
	var R: Dictionary = App.reglages
	enLigne = App.enLigne
	circuitId = R.circuit
	voitureId = R.voiture
	if enLigne != null:
		circuitId = String(enLigne.trackId)
		voitureId = CourseEnLigne.voitureDe(enLigne, voitureId)


func _nuit() -> bool:
	return enLigne.timeOfDay == "night" if enLigne != null else bool(App.reglages.get("nuit", false))


func _ready() -> void:
	var R: Dictionary = App.reglages
	_actions()
	_choix()
	piste = Piste.charge("res://donnees/circuits/" + circuitId)
	var chemin := Decor.cheminDe(circuitId)
	if chemin == "":
		# La version web ne porte pas les décors : celui du circuit se télécharge une fois.
		var couche0 := CanvasLayer.new()
		add_child(couche0)
		chargement = Label.new()
		chargement.add_theme_font_size_override("font_size", 34)
		chargement.add_theme_color_override("font_color", Style.CREME)
		chargement.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
		chargement.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		chargement.text = Textes.t("loading", 0)
		couche0.add_child(chargement)
		var ok: bool = await Decor.telecharge(circuitId, self, func(f): chargement.text = Textes.t("loading", roundi(f * 100)))
		if not ok:
			chargement.text = Textes.t("loadFailed")
			return
		couche0.queue_free()
		chemin = Decor.cheminDe(circuitId)
	decor = Decor.new()
	decor.charge(chemin)
	add_child(decor)
	Nuit.eclaireGalerie(piste, decor)
	effets = Effets.new()
	add_child(effets)
	degatsVue = DegatsVue.new()
	degatsVue.jeu = self
	add_child(degatsVue)
	# les mécaniciens : au sol sous les voitures (les mains sous la caisse), ceux du scotch par-dessus
	mecanosDessous = Node2D.new()
	mecanosDessous.draw.connect(func(): if mecanos: mecanos.dessine(mecanosDessous, false))
	add_child(mecanosDessous)
	mecanosDessus = Node2D.new()
	mecanosDessus.z_index = 2
	mecanosDessus.draw.connect(func(): if mecanos: mecanos.dessine(mecanosDessus, true))
	add_child(mecanosDessus)
	guide = GuideVue.new()
	guide.jeu = self
	guide.visible = false
	add_child(guide)
	son = Son.new()
	add_child(son)
	son.voiture(voitureId)
	RenderingServer.set_default_clear_color(decor.fond)
	tourne = R.vue == "avance"
	camera = Camera2D.new()
	camera.ignore_rotation = false
	add_child(camera)
	camera.make_current()
	var couche := CanvasLayer.new()
	add_child(couche)
	hud = Hud.new()
	hud.jeu = self
	couche.add_child(hud)
	pause = Pause.new()
	pause.jeu = self
	pause.visible = false
	couche.add_child(pause)
	_depart()


func _exit_tree() -> void:
	RenderingServer.set_default_clear_color(Color("#17171c"))


func _depart() -> void:
	var R: Dictionary = App.reglages
	for v in vues:
		v.ombre.queue_free()
		v.queue_free()
	vues.clear()
	var h := Hasard.new()
	var modele := Catalogue.modele(voitureId)
	var cat: String = Catalogue.voiture(voitureId).cat
	var n := int(R.adversaires) if R.mode == "race" else 1
	# Le moteur C++ quand il est là (ordinateur, téléphone) ; sinon Course, en GDScript (web).
	var classe = CourseNative if CourseNative.disponible() and App.reglages.get("natif", true) else Course
	if enLigne != null:
		course = _courseEnLigne(modele, cat, h)
	else: course = classe.new(piste, {
		modele = modele, difficulte = Catalogue.difficulte(R.difficulte), mode = "timetrial" if R.mode == "training" else R.mode, laps = int(R.tours),
		entrainement = R.mode == "training", difficultes = Catalogue.donnees.difficultes,
		degats = bool(R.get("degats", true)),
		# le frein du couple circuit + voiture (la pastille FREINAGE), et le mode RÉGLER
		frein = ReglageFrein.frein(String(R.circuit), voitureId), reglage = reglageDemande,
		nCars = n, roster = Catalogue.roster(maxi(n, 2), 0, cat, h), livree = int(R.livree), nomJoueur = R.nom,
		modeleDe = func(id, i): return Catalogue.modele(id) if id != "" else Catalogue.modele(Catalogue.voituresDe(cat)[i % Catalogue.voituresDe(cat).size()].id),
	}, h)
	prec.clear()
	if nuit:
		nuit.queue_free()
		nuit = null
	# La nuit, ou un circuit à tunnel : la nuit y tombe de jour, sous le tunnel.
	if _nuit() or piste.tunnels.size():
		nuit = Nuit.new(self, _nuit())
		add_child(nuit)
	for car in course.cars:
		var vue := VoitureVue.new(Catalogue.dessin(car.cls.id, car.livree))
		vue.nuit = _nuit()
		if car.fantome:
			# Le fantôme se voit à travers (FANTOME_ALPHA), son ombre aussi.
			vue.modulate = Color(1, 1, 1, 0.42)
			vue.ombre.modulate.a *= 0.42
		add_child(vue)
		vues.append(vue)
		if nuit: nuit.ajouteVoiture(vue, car)
		prec.append(PackedFloat64Array([car.x, car.y, car.th]))
	camInit = false
	finieDepuis = -1.0
	enPause = false
	stand = false
	effets.vide()
	degatsVue.nouvelleCourse(course)
	mecanos = Mecanos.new(piste) if course.stands else null
	mecanosDessous.queue_redraw(); mecanosDessus.queue_redraw()
	son.silence()
	pause.visible = false
	hud.nouvelleCourse(course)


func _courseEnLigne(_modele: Voiture.Modele, _cat: String, h: Hasard) -> Course:
	var net: Net = Reseau.net
	var c := CourseEnLigne.cree(piste, enLigne, voitureId, net, h)
	net.focus = func(): return null
	net.viewRadius = func(): return roundi(get_viewport().get_visible_rect().size.length() / maxf(.5, camZoom) / 2)
	return c


## La barrière de chargement, tenue pendant le décompte (main.js) : chacun annonce qu'il est prêt,
## l'hôte retient le départ tant qu'il en manque un.
func _barriere() -> void:
	var net: Net = Reseau.net
	if course.state == "countdown":
		net.setCharge(net.isHost() or net.link.ping(net.pid) != null)
		if net.isHost():
			var a := net.attendus()
			course.attente = a.reste > 0
			if course.attente and Time.get_ticks_msec() - _attenteAnnoncee > 1000:
				_attenteAnnoncee = Time.get_ticks_msec()
				hud.annonce(Textes.t("waitLoad", a.reste), Style.CREME)
		else:
			course.attente = false
	else:
		course.attente = false


func _actions() -> void:
	var ajoute := func(nom: String, evts: Array) -> void:
		if not InputMap.has_action(nom):
			InputMap.add_action(nom, 0.1)
			for e in evts: InputMap.action_add_event(nom, e)
	var touche := func(k: Key) -> InputEventKey:
		var e := InputEventKey.new(); e.physical_keycode = k; return e
	var bouton := func(b: JoyButton) -> InputEventJoypadButton:
		var e := InputEventJoypadButton.new(); e.button_index = b; return e
	ajoute.call("gaz", [touche.call(KEY_SPACE), bouton.call(JOY_BUTTON_A)])
	ajoute.call("ligne_haut", [touche.call(KEY_UP), bouton.call(JOY_BUTTON_DPAD_UP)])
	ajoute.call("ligne_bas", [touche.call(KEY_DOWN), bouton.call(JOY_BUTTON_DPAD_DOWN)])
	ajoute.call("vue", [touche.call(KEY_C), bouton.call(JOY_BUTTON_Y)])
	ajoute.call("pause", [touche.call(KEY_ESCAPE), touche.call(KEY_P), bouton.call(JOY_BUTTON_START)])
	ajoute.call("plein_ecran", [touche.call(KEY_F)])


func basculePause() -> void:
	if course.state == "finished": return
	enPause = not enPause
	pause.visible = enPause
	if enPause:
		pause.ouvre()
		if enLigne == null: son.silence()


func recommence() -> void:
	if enLigne != null: return
	_depart()


func quitte() -> void:
	if enLigne != null:
		App.retourTable()
		return
	App.aller("paddock", { mode = App.reglages.mode })


func _unhandled_input(e: InputEvent) -> void:
	if course == null:
		if e.is_action_pressed("pause") or e.is_action_pressed("ui_cancel"): App.aller("paddock", { mode = App.reglages.mode })
		return
	if e.is_action_pressed("pause"):
		basculePause()
		get_viewport().set_input_as_handled()
		return
	if enPause: return
	# au clavier on descend d'un cran de plus quand les stands sont ouverts (main.js, stepLine)
	if e.is_action_pressed("ligne_haut"): _ligne(clampf((-2.0 if stand else roundf(ligne)) + 1, -2.0 if course.standOuvert() else -1.0, 1))
	elif e.is_action_pressed("ligne_bas"): _ligne(clampf((-2.0 if stand else roundf(ligne)) - 1, -2.0 if course.standOuvert() else -1.0, 1))
	elif e.is_action_pressed("vue"):
		tourne = not tourne; camInit = false
		App.reglages.vue = "avance" if tourne else "avanceFixe"; App.sauve()
	elif e.is_action_pressed("plein_ecran"):
		App.basculeAffichage()
	elif _leverFrein(e):
		pass
	elif e is InputEventScreenTouch:
		var p: Vector2 = hud.get_global_transform_with_canvas().affine_inverse() * e.position
		if e.pressed and hud.toucheePause(p):
			basculePause()
		elif e.pressed and hud.dansLevier(p):
			doigtLevier = e.index; _ligne(hud.levierVers(p))
		elif e.pressed:
			doigtsGaz[e.index] = true
			hud.anchorPouce(p)                 # la pastille vient au pouce
		else:
			doigtsGaz.erase(e.index)
			if e.index == doigtLevier: doigtLevier = -1
	elif e is InputEventScreenDrag and e.index == doigtLevier:
		var p: Vector2 = hud.get_global_transform_with_canvas().affine_inverse() * e.position
		_ligne(hud.levierVers(p))
	elif e is InputEventScreenDrag and doigtsGaz.has(e.index):
		hud.anchorPouce(hud.get_global_transform_with_canvas().affine_inverse() * e.position)
	elif e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT and hud.toucheePause(e.position):
		basculePause()


## LE LEVIER DU FREIN, en mode réglage (main.js, pointers.reglage) : il passe avant tout le reste et
## retient son doigt — on ne règle pas son frein en accélérant. La souris le prend aussi.
func _leverFrein(e: InputEvent) -> bool:
	if not course.reglage: return false
	var doigt := -1
	var appui := false
	var lache := false
	var pos := Vector2.ZERO
	if e is InputEventScreenTouch:
		doigt = e.index; appui = e.pressed; lache = not e.pressed; pos = e.position
	elif e is InputEventScreenDrag:
		doigt = e.index; pos = e.position
	elif e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT:
		doigt = -2; appui = e.pressed; lache = not e.pressed; pos = e.position
	elif e is InputEventMouseMotion:
		doigt = -2; pos = e.position
	else:
		return false
	var p: Vector2 = hud.get_global_transform_with_canvas().affine_inverse() * pos
	if lache:
		if doigt == doigtFrein:
			doigtFrein = -1
			return true
		return false
	var v = hud.freinVers(p)
	if appui and v != null and doigtFrein == -1:
		doigtFrein = doigt
		course.poseFrein(v)
		return true
	if doigt == doigtFrein and not appui and not lache:
		var w = hud.freinVers(p, true)
		if w != null: course.poseFrein(w)
		return true
	return false


## Le levier change de cran : un clac (main.js, poseCran), vers le haut ou vers le bas. -2 : la
## coche des stands, sous le rail.
func _ligne(v: float) -> void:
	var avant := -2 if stand else roundi(ligne)
	stand = v <= -1.5
	ligne = clampf(v, -1, 1)
	var apres := -2 if stand else roundi(ligne)
	if apres != avant and course.state != "countdown": son.joue("clac+" if apres > avant else "clac-")


func _commandes() -> void:
	if Reseau.autopilote:
		gaz = 1.0 if PiloteAuto.gaz(course.player) else 0.0
		return
	var g := 1.0 if Input.is_action_pressed("gaz") or not doigtsGaz.is_empty() else 0.0
	var gachette := Input.get_joy_axis(0, JOY_AXIS_TRIGGER_RIGHT)
	if gachette > 0.05: g = maxf(g, gachette)
	gaz = g
	var stick := -Input.get_joy_axis(0, JOY_AXIS_LEFT_Y)
	if absf(stick) > 0.3: _ligne(clampf(stick, -1, 1))


func _physics_process(_delta: float) -> void:
	if course == null: return
	# En ligne, la course ne s'arrête pas pendant la pause : les autres roulent.
	var drive = course.netDrive
	if enPause and drive == null: return
	if enPause: gaz = 0.0
	else: _commandes()
	for i in course.cars.size():
		var c := course.cars[i]
		prec[i][0] = c.x; prec[i][1] = c.y; prec[i][2] = c.th
	var t0 := Time.get_ticks_usec()
	if drive != null:
		_barriere()
		drive.beforeFrame(course.dt)
	if not course.spectator:
		course.player.sel = ligne
		course.demandeStand(stand)
	var dejaAbandonne := course.player.abandon
	var tourAvant := course.player.lap
	if course.spectator:
		if drive.link.synchronized and drive.epoch != null:
			course.time = maxf(0, (drive.link.now() - float(drive.epoch)) / 1000.0)
	else:
		course.step(gaz)
	if drive != null:
		if Reseau.net.isHost(): course.broadcast.sample(course)
		drive.afterFrame(gaz, ligne)
		if Reseau.net.silence() > 2 and Time.get_ticks_msec() - _attenteAnnoncee > 600:
			_attenteAnnoncee = Time.get_ticks_msec()
			hud.annonce(Textes.t("netLost"), Color("#ffb4a2"))
	coutPas = coutPas * 0.98 + float(Time.get_ticks_usec() - t0) * 0.02
	hud.evenements(course.evenements)
	_sons(course.evenements)
	if not dejaAbandonne and course.player.abandon:
		App.joueAbandon(course.player.grosChocFatal)
	if course.player.lap != tourAvant and enLigne == null: _record()
	if course.state == "finished" and finieDepuis < 0:
		finieDepuis = 0.0
		# le palmarès : une victoire en course rapide rapporte le trophée de son niveau
		App.dernierTrophee = Palmares.attribue(course, String(App.reglages.difficulte)) if enLigne == null else {}
		if App.dernierTrophee.get("nouveau", false): Mondial.synchroPalmares()


## Les événements de la course, en sons et en secousse (main.js, _handleEvents).
func _sons(evts: Array) -> void:
	for e in evts:
		if e.type == "go": son.joue("go")
		elif e.type == "crash" and e.car == course.player: son.joue("thud"); secousse = 1.0
		elif e.type == "lap" and e.car == course.player:
			var p := course.player
			var lt: float = p.lapTimes[-1]
			var meilleur := p.bestLap == lt and p.lapTimes.size() > 1
			son.joue("record" if meilleur else "tour")
			hud.annonce(Textes.t("lapDone", [p.lap, Style.temps(lt)]), Color("#b48cff") if meilleur else Color.WHITE)
		elif e.type == "finish" and e.car == course.player: son.joue("arrivee")


## Le meilleur tour propre de l'appareil, par circuit et par voiture.
func _record() -> void:
	var p := course.player
	if p.lapTimes.is_empty() or not p.lapOk[-1]: return
	var t: float = p.lapTimes[-1]
	var R: Dictionary = App.reglages
	if not R.has("records"): R.records = {}
	var cle: String = R.circuit + "/" + R.voiture
	# le tableau mondial ne regarde que les tours nets : sans guide, hors entraînement (Mondial.tourNet)
	Mondial.tourNet(R.circuit, R.voiture, t, course.entrainement)
	if not R.records.has(cle) or t < float(R.records[cle]):
		R.records[cle] = t
		App.sauve()
		hud.annonce(Textes.t("newRecord", Style.temps(t)), Style.LIGNE_JAUNE)


func _process(dt: float) -> void:
	if course == null: return
	var a := 0.0 if enPause else Engine.get_physics_interpolation_fraction()
	var pont := piste.crossings
	var px := 0.0
	var py := 0.0
	var poses := []
	var suivie := _suivie()
	for i in course.cars.size():
		var c := course.cars[i]
		var q := prec[i]
		var x := q[0] + (c.x - q[0]) * a
		var y := q[1] + (c.y - q[1]) * a
		var th := q[2] + Voiture.wrapAngle(c.th - q[2]) * a
		# Une voiture sur le tablier d'un croisement passe par-dessus (js/render.js, dessus/dessous).
		var z := 1
		if pont.size():
			var k := piste.idx(c.s)
			for over in pont:
				if ((k - (int(over) - 16)) % piste.n + piste.n) % piste.n <= 36: z = 3
		vues[i].place(Vector2(x, y), th, c.delta, z)
		# une épave reste six secondes, fumante, puis s'efface en deux : les commissaires l'ont enlevée
		if c.abandon: vues[i].voile(clampf(1 - (c.abandonT - 6) / 2, 0, 1))
		vues[i].freine(c.braking and not c.herbe and (nuit == null or nuit.force <= 0))
		poses.append([Vector2(x, y), th])
		if c == suivie: px = x; py = y
	if nuit: nuit.maj(poses)
	_camera(dt, px, py)
	guide.visible = course.entrainement or App.reglages.guide
	if guide.visible: guide.queue_redraw()
	else: hud.consigne = -1
	if not enPause:
		effets.ajoute(course, dt)
		degatsVue.maj(course, vues, dt)
		if mecanos and mecanos.pas(course, vues, dt):
			mecanosDessous.queue_redraw(); mecanosDessus.queue_redraw()
		son.maj(course.player, course.state != "countdown", dt)
	if secousse > 0:
		secousse = maxf(0, secousse - dt * 2)
		camera.offset = Vector2((randf() - 0.5) * secousse * 8, (randf() - 0.5) * secousse * 8) / camZoom
	else:
		camera.offset = Vector2.ZERO
	dureesImage.append(dt)
	if dureesImage.size() > 120: dureesImage.pop_front()
	pireImage = 0.0
	for d in dureesImage: pireImage = maxf(pireImage, d)
	hud.queue_redraw()
	if finieDepuis >= 0:
		finieDepuis += dt
		if finieDepuis > 2.5:
			App.derniereCourse = course
			App.aller("resultats")
			finieDepuis = -100.0


## La voiture que la caméra suit : la sienne, ou celle de tête pour un spectateur.
func _suivie() -> Voiture:
	if course.spectator:
		return course.standings()[0]
	return course.player


func _surLigne(s: float) -> Vector2:
	var u := piste.wrap_(s)
	return piste.pos(u, piste.lineLat("racing", u))


## La caméra en avance de js/render.js : elle vise le barycentre de la ligne idéale à venir, lisse
## l'ÉCART voiture-caméra plutôt que la position, et ne laisse jamais la voiture sortir du cadre.
func _camera(dt: float, px: float, py: float) -> void:
	var car := _suivie()
	# l'abandon du joueur : la caméra va se poser sur l'épave, et ondule autour (render.js)
	if not course.spectator and car.abandon and camInit:
		_cameraEpave(dt, Vector2(px, py), car)
		return
	var ecran := get_viewport().get_visible_rect().size
	var W := ecran.x
	var H := ecran.y
	var vf := minf(1.0, car.v / minf(car.cls.vmax, VMAX_ECRAN))
	var near := 30.0 if tourne else 20.0
	var far := 75.0 if tourne else 50.0
	var metres := (near + (far - near) * vf) * float(App.reglages.recul) * 1.35
	var zoomCible := (H if tourne else minf(W, H)) / metres
	var D := metres * ((0.32 + 0.58 * vf) if tourne else (0.24 + 0.40 * vf))
	var somme := Vector2.ZERO
	for i in 13:
		somme += _surLigne(car.s + D * i / 12.0)
	var cible := somme / 13.0
	var a := _surLigne(car.s + D * 0.5 - metres * 0.22)
	var b := _surLigne(car.s + D * 0.5 + metres * 0.22)
	var voulu := atan2(b.y - a.y, b.x - a.x)
	var pos := Vector2(px, py)
	if not camInit:
		camAngle = voulu
		cam = cible; camZoom = zoomCible; camOff = cible - pos; camInit = true
	else:
		camAngle += Voiture.wrapAngle(voulu - camAngle) * minf(1, dt * 2)
		var k := minf(1, dt * 2)
		camOff += (cible - pos - camOff) * k
		cam = pos + camOff
		camZoom += (zoomCible - camZoom) * minf(1, dt * 1.5)
	var r := (-camAngle - PI / 2) if tourne else 0.0
	var c := cos(r)
	var si := sin(r)
	var d := cam - pos
	var ex := d.x * c - d.y * si
	var ey := d.x * si + d.y * c
	var demiL := (W / camZoom) / 2 * (0.72 if tourne else 0.56)
	var demi := (H / camZoom) / 2
	var avant := demi * (0.62 if tourne else 0.56)
	var arriere := demi * (0.30 if tourne else 0.56)
	ex = clampf(ex, -demiL, demiL)
	ey = clampf(ey, -avant, arriere)
	d = Vector2(ex * c + ey * si, -ex * si + ey * c)
	cam = pos + d
	camOff = d
	camera.position = cam
	camera.zoom = Vector2(camZoom, camZoom)
	camera.rotation = (camAngle + PI / 2) if tourne else 0.0



## LA CAMÉRA DE L'ABANDON : elle quitte l'avance, se recentre sur l'épave et s'en approche jusqu'à
## n'en montrer que seize mètres ; un roulis lent, un souffle de zoom, un léger flottement montent
## en une seconde, comme le WASTED de GTA (render.js, _cameraEpave et draw).
func _cameraEpave(dt: float, pos: Vector2, car: Voiture) -> void:
	var ecran := get_viewport().get_visible_rect().size
	var k := minf(1, dt * 3)
	var zoom := (ecran.y if tourne else minf(ecran.x, ecran.y)) / 16
	cam += (pos - cam) * k
	camZoom += (zoom - camZoom) * minf(1, dt * 1.6)
	camOff = cam - pos
	var ta := car.abandonT
	var fo := minf(1, ta / 1.2)
	var roulis := fo * (0.055 * sin(ta * 0.9) + 0.018 * sin(ta * 2.3 + 0.7))
	var ondZ := 1 + fo * 0.05 * sin(ta * 0.7)
	camera.position = cam + Vector2(fo * 0.8 * sin(ta * 0.6), fo * 0.6 * sin(ta * 0.85 + 1))
	camera.zoom = Vector2.ONE * camZoom * ondZ
	camera.rotation = ((camAngle + PI / 2) if tourne else 0.0) - roulis


## Le guide de freinage, sur la piste devant la voiture (js/render.js, _drawGuide) : rouge plein là
## où il faut lâcher, rouge en tirets là où il faut doser, des chevrons verts à la reprise des gaz.
class GuideVue extends Node2D:
	var jeu
	var etat := 0
	var vu := 0
	var depuis := 0.0

	func _draw() -> void:
		var course: Course = jeu.course
		var T := course.track
		var p := course.player
		var G := course.guide(p)
		var pas: int = G.pas
		var N: int = G.n
		var E: PackedByteArray = G.etats
		var pt := func(i: int) -> Vector3:
			var s: float = G.s0 + i * pas
			var k := T.idx(s)
			var lat := T.targetLat(s, p.selS)
			return Vector3(T.xs[k] + T.nx[k] * lat, T.ys[k] + T.ny[k] * lat, k)
		var plein := PackedVector2Array()
		var tirets := PackedVector2Array()
		var sorties := []
		var prev: Vector3 = pt.call(1)
		for i in range(1, N):
			var now: Vector3 = pt.call(i + 1)
			var e := E[i]
			if e == Course.GUIDE_LEVE:
				plein.append(Vector2(prev.x, prev.y)); plein.append(Vector2(now.x, now.y))
			elif e == Course.GUIDE_DOSE:
				if roundi((G.s0 + i * pas) / pas) % 2 == 0:
					tirets.append(Vector2(prev.x, prev.y)); tirets.append(Vector2(now.x, now.y))
			elif E[i - 1] != Course.GUIDE_GAZ:
				sorties.append(i)
			prev = now
		var faute: bool = G.maintenant == Course.GUIDE_LEVE and p.throttle > 0
		var bat := 0.75 + 0.25 * sin(Time.get_ticks_msec() / 70.0) if faute else 0.62
		if plein.size():
			draw_multiline(plein, Color(Color("#ff3b30"), bat * 0.55), 2.6)
			draw_multiline(plein, Color(Color("#ff5a4a"), minf(1, bat + 0.25)), 0.6)
		if tirets.size():
			draw_multiline(tirets, Color(Color("#ff3b30"), 0.5), 1.5)
		var nChev := 3
		var ecart := maxi(1, roundi(Course.GUIDE.vert / float(pas) / nChev))
		for i0 in sorties:
			for c in nChev:
				var i: int = i0 + c * ecart
				if i >= N or E[i] != Course.GUIDE_GAZ: break
				var q: Vector3 = pt.call(i + 1)
				var th := T.th[int(q.z)]
				var o := Vector2(q.x, q.y)
				var r := func(v: Vector2) -> Vector2: return o + v.rotated(th)
				draw_polyline(PackedVector2Array([r.call(Vector2(-1.3, -1.25)), o, r.call(Vector2(-1.3, 1.25))]), Color(Color("#37d67a"), 0.95), 0.55)
		# La consigne qui s'affiche au tableau de bord, avec un quart de seconde de patience.
		var t := Time.get_ticks_msec()
		if G.zone != vu: vu = G.zone; depuis = t
		if G.zone > etat or t - depuis > 250: etat = G.zone
		jeu.hud.consigne = etat
