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
var guide: GuideVue
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
var doigtsGaz := {}
var doigtLevier := -1
var enPause := false
var finieDepuis := -1.0

# La mesure
var dureesImage: Array[float] = []
var pireImage := 0.0
var coutPas := 0.0


func _ready() -> void:
	var R: Dictionary = App.reglages
	piste = Piste.charge("res://donnees/circuits/" + R.circuit)
	decor = Decor.new()
	decor.charge("res://donnees/circuits/%s-decor" % R.circuit)
	add_child(decor)
	effets = Effets.new()
	add_child(effets)
	guide = GuideVue.new()
	guide.jeu = self
	add_child(guide)
	son = Son.new()
	add_child(son)
	son.voiture(R.voiture)
	RenderingServer.set_default_clear_color(decor.fond)
	tourne = R.vue == "avance"
	_actions()
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
	var modele := Catalogue.modele(R.voiture)
	var cat: String = Catalogue.voiture(R.voiture).cat
	var n := int(R.adversaires) if R.mode == "race" else 1
	course = Course.new(piste, {
		modele = modele, difficulte = Catalogue.difficulte(R.difficulte), mode = "timetrial" if R.mode == "training" else R.mode, laps = int(R.tours),
		entrainement = R.mode == "training", difficultes = Catalogue.donnees.difficultes,
		nCars = n, roster = Catalogue.roster(maxi(n, 2), 0, cat, h), livree = int(R.livree), nomJoueur = R.nom,
		modeleDe = func(id, i): return Catalogue.modele(id) if id != "" else Catalogue.modele(Catalogue.voituresDe(cat)[i % Catalogue.voituresDe(cat).size()].id),
	}, h)
	prec.clear()
	for car in course.cars:
		var vue := VoitureVue.new(Catalogue.dessin(car.cls.id, car.livree))
		if car.fantome:
			# Le fantôme se voit à travers (FANTOME_ALPHA), son ombre aussi.
			vue.modulate = Color(1, 1, 1, 0.42)
			vue.ombre.modulate.a *= 0.42
		add_child(vue)
		vues.append(vue)
		prec.append(PackedFloat64Array([car.x, car.y, car.th]))
	camInit = false
	finieDepuis = -1.0
	enPause = false
	effets.vide()
	son.silence()
	pause.visible = false
	hud.nouvelleCourse(course)


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
		son.silence()


func recommence() -> void:
	_depart()


func quitte() -> void:
	App.aller("paddock", { mode = App.reglages.mode })


func _unhandled_input(e: InputEvent) -> void:
	if e.is_action_pressed("pause"):
		basculePause()
		get_viewport().set_input_as_handled()
		return
	if enPause: return
	if e.is_action_pressed("ligne_haut"): _ligne(clampf(roundf(ligne) + 1, -1, 1))
	elif e.is_action_pressed("ligne_bas"): _ligne(clampf(roundf(ligne) - 1, -1, 1))
	elif e.is_action_pressed("vue"):
		tourne = not tourne; camInit = false
		App.reglages.vue = "avance" if tourne else "avanceFixe"; App.sauve()
	elif e.is_action_pressed("plein_ecran"):
		var plein := DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if plein else DisplayServer.WINDOW_MODE_FULLSCREEN)
	elif e is InputEventScreenTouch:
		var p: Vector2 = hud.get_global_transform_with_canvas().affine_inverse() * e.position
		if e.pressed and hud.toucheePause(p):
			basculePause()
		elif e.pressed and hud.dansLevier(p):
			doigtLevier = e.index; _ligne(hud.levierVers(p))
		elif e.pressed:
			doigtsGaz[e.index] = true
		else:
			doigtsGaz.erase(e.index)
			if e.index == doigtLevier: doigtLevier = -1
	elif e is InputEventScreenDrag and e.index == doigtLevier:
		var p: Vector2 = hud.get_global_transform_with_canvas().affine_inverse() * e.position
		_ligne(hud.levierVers(p))
	elif e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT and hud.toucheePause(e.position):
		basculePause()


## Le levier change de cran : un clac (main.js), vers le haut ou vers le bas.
func _ligne(v: float) -> void:
	var avant := roundi(ligne)
	ligne = v
	if roundi(v) != avant and course.state != "countdown": son.joue("clac+" if roundi(v) > avant else "clac-")


func _commandes() -> void:
	var g := 1.0 if Input.is_action_pressed("gaz") or not doigtsGaz.is_empty() else 0.0
	var gachette := Input.get_joy_axis(0, JOY_AXIS_TRIGGER_RIGHT)
	if gachette > 0.05: g = maxf(g, gachette)
	gaz = g
	var stick := -Input.get_joy_axis(0, JOY_AXIS_LEFT_Y)
	if absf(stick) > 0.3: _ligne(clampf(stick, -1, 1))


func _physics_process(_delta: float) -> void:
	if enPause: return
	_commandes()
	for i in course.cars.size():
		var c := course.cars[i]
		prec[i][0] = c.x; prec[i][1] = c.y; prec[i][2] = c.th
	var t0 := Time.get_ticks_usec()
	course.player.sel = ligne
	var tourAvant := course.player.lap
	course.step(gaz)
	coutPas = coutPas * 0.98 + float(Time.get_ticks_usec() - t0) * 0.02
	hud.evenements(course.evenements)
	_sons(course.evenements)
	if course.player.lap != tourAvant: _record()
	if course.state == "finished" and finieDepuis < 0:
		finieDepuis = 0.0


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
			hud.annonce("TOUR %d · %s" % [p.lap, Style.temps(lt)], Color("#b48cff") if meilleur else Color.WHITE)
		elif e.type == "finish" and e.car == course.player: son.joue("arrivee")


## Le meilleur tour propre de l'appareil, par circuit et par voiture.
func _record() -> void:
	var p := course.player
	if p.lapTimes.is_empty() or not p.lapOk[-1]: return
	var t: float = p.lapTimes[-1]
	var R: Dictionary = App.reglages
	if not R.has("records"): R.records = {}
	var cle: String = R.circuit + "/" + R.voiture
	if not R.records.has(cle) or t < float(R.records[cle]):
		R.records[cle] = t
		App.sauve()
		hud.annonce("RECORD PERSONNEL  " + Style.temps(t), Style.LIGNE_JAUNE)


func _process(dt: float) -> void:
	var a := 0.0 if enPause else Engine.get_physics_interpolation_fraction()
	var pont := piste.crossings
	var px := 0.0
	var py := 0.0
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
		if c.isPlayer: z += 0
		vues[i].place(Vector2(x, y), th, c.delta, z)
		if c == course.player: px = x; py = y
	_camera(dt, px, py)
	guide.visible = course.entrainement or App.reglages.guide
	if guide.visible: guide.queue_redraw()
	if not enPause:
		effets.ajoute(course, dt)
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


func _surLigne(s: float) -> Vector2:
	var u := piste.wrap_(s)
	return piste.pos(u, piste.lineLat("racing", u))


## La caméra en avance de js/render.js : elle vise le barycentre de la ligne idéale à venir, lisse
## l'ÉCART voiture-caméra plutôt que la position, et ne laisse jamais la voiture sortir du cadre.
func _camera(dt: float, px: float, py: float) -> void:
	var car := course.player
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
