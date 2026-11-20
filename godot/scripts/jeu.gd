## Le prototype : un tour de Stand de frites en Breithüft Apex R.
##
## La physique tourne à 120 pas par seconde dans _physics_process, comme le jeu web (race.dt), et
## l'image se dessine entre deux pas par interpolation : à 60, 120 ou 144 Hz, la voiture avance
## d'un mouvement régulier au lieu de sauter d'un pas à l'autre. La caméra est celle du jeu web
## (js/render.js, updateCamera), en vue « devant, nord en haut » par défaut ; C bascule sur la vue
## qui tourne avec la piste.
extends Node2D

var piste: Piste
var modele: Voiture.Modele
var car: Voiture
var decor: Decor
var vue: VoitureVue
var camera: Camera2D
var hud: Hud

var temps := 0.0           # le temps de course, au pas près (race.time)
var feux := 3.0            # le décompte avant le départ
var enCourse := false
var prec := PackedFloat64Array([0, 0, 0])   # x, y, cap au pas précédent, pour l'interpolation

# La caméra (js/render.js)
var tourne := false        # vue « avance » : la piste vers le haut de l'écran
var cam := Vector2.ZERO
var camOff := Vector2.ZERO
var camZoom := 10.0
var camAngle := 0.0
var camInit := false
const VMAX_ECRAN := 290 / 3.6

# Les commandes
var gaz := 0.0
var ligne := 0.0
var doigtsGaz := {}        # index de toucher -> vrai
var doigtLevier := -1

# La mesure
var dureesImage: Array[float] = []
var pireImage := 0.0
var coutPas := 0.0


func _ready() -> void:
	piste = Piste.charge("res://donnees/spa")
	modele = Voiture.Modele.depuis(piste.voiture)
	decor = Decor.new()
	decor.charge("res://donnees/decor-spa")
	add_child(decor)
	RenderingServer.set_default_clear_color(decor.fond)
	var voitures := Node2D.new()
	add_child(voitures)
	vue = VoitureVue.new("res://donnees/voiture-porsche991gt3r.json")
	voitures.add_child(vue)
	camera = Camera2D.new()
	camera.ignore_rotation = false
	add_child(camera)
	camera.make_current()
	var couche := CanvasLayer.new()
	add_child(couche)
	hud = Hud.new()
	hud.jeu = self
	couche.add_child(hud)
	_actions()
	_depart()


func _depart() -> void:
	car = Voiture.new(piste, modele, piste.depart[0], piste.depart[1])
	car.freinRatio = piste.voiture.freinRatio
	car.gripBoost = piste.voiture.gripBoost
	temps = 0.0
	feux = 3.0
	enCourse = false
	camInit = false
	prec = PackedFloat64Array([car.x, car.y, car.th])


func _actions() -> void:
	var ajoute := func(nom: String, evts: Array) -> void:
		if not InputMap.has_action(nom):
			InputMap.add_action(nom, 0.1)
		for e in evts:
			InputMap.action_add_event(nom, e)
	var touche := func(k: Key) -> InputEventKey:
		var e := InputEventKey.new(); e.physical_keycode = k; return e
	var bouton := func(b: JoyButton) -> InputEventJoypadButton:
		var e := InputEventJoypadButton.new(); e.button_index = b; return e
	ajoute.call("gaz", [touche.call(KEY_SPACE), bouton.call(JOY_BUTTON_A)])
	ajoute.call("ligne_haut", [touche.call(KEY_UP), bouton.call(JOY_BUTTON_DPAD_UP)])
	ajoute.call("ligne_bas", [touche.call(KEY_DOWN), bouton.call(JOY_BUTTON_DPAD_DOWN)])
	ajoute.call("vue", [touche.call(KEY_C), bouton.call(JOY_BUTTON_Y)])
	ajoute.call("rejouer", [touche.call(KEY_R), bouton.call(JOY_BUTTON_BACK)])
	ajoute.call("plein_ecran", [touche.call(KEY_F)])


func _unhandled_input(e: InputEvent) -> void:
	if e.is_action_pressed("ligne_haut"): ligne = clampf(roundf(ligne) + 1, -1, 1)
	elif e.is_action_pressed("ligne_bas"): ligne = clampf(roundf(ligne) - 1, -1, 1)
	elif e.is_action_pressed("vue"): tourne = not tourne; camInit = false
	elif e.is_action_pressed("rejouer"): _depart()
	elif e.is_action_pressed("plein_ecran"):
		var plein := DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if plein else DisplayServer.WINDOW_MODE_FULLSCREEN)
	# Le doigt : à gauche le levier de ligne, partout ailleurs l'accélérateur.
	elif e is InputEventScreenTouch:
		if e.pressed and hud.dansLevier(e.position):
			doigtLevier = e.index; ligne = hud.levierVers(e.position)
		elif e.pressed:
			doigtsGaz[e.index] = true
		else:
			doigtsGaz.erase(e.index)
			if e.index == doigtLevier: doigtLevier = -1
	elif e is InputEventScreenDrag and e.index == doigtLevier:
		ligne = hud.levierVers(e.position)


func _commandes() -> void:
	var g := 1.0 if Input.is_action_pressed("gaz") or not doigtsGaz.is_empty() else 0.0
	var gachette := Input.get_joy_axis(0, JOY_AXIS_TRIGGER_RIGHT)
	if gachette > 0.05: g = maxf(g, gachette)
	gaz = g
	var stick := -Input.get_joy_axis(0, JOY_AXIS_LEFT_Y)
	if absf(stick) > 0.3: ligne = clampf(stick, -1, 1)


func _physics_process(_delta: float) -> void:
	_commandes()
	var dt := piste.dt
	prec = PackedFloat64Array([car.x, car.y, car.th])
	if not enCourse:
		feux -= dt
		if feux <= 0: enCourse = true
		return
	var t0 := Time.get_ticks_usec()
	temps += dt
	car.sel = ligne
	car.steer(dt)
	car.update(dt, gaz, temps)
	coutPas = coutPas * 0.98 + float(Time.get_ticks_usec() - t0) * 0.02


func _process(dt: float) -> void:
	# L'image se pose entre le pas précédent et le pas courant.
	var a := Engine.get_physics_interpolation_fraction()
	var x := prec[0] + (car.x - prec[0]) * a
	var y := prec[1] + (car.y - prec[1]) * a
	var th := prec[2] + Voiture.wrapAngle(car.th - prec[2]) * a
	vue.place(Vector2(x, y), th, car.delta)
	_camera(dt, x, y)
	dureesImage.append(dt)
	if dureesImage.size() > 120: dureesImage.pop_front()
	pireImage = 0.0
	for d in dureesImage: pireImage = maxf(pireImage, d)
	hud.queue_redraw()


func _surLigne(s: float) -> Vector2:
	var u := piste.wrap_(s)
	return piste.pos(u, piste.lineLat("racing", u))


## La caméra en avance de js/render.js : elle vise le barycentre de la ligne idéale à venir, lisse
## l'ÉCART voiture-caméra plutôt que la position, et ne laisse jamais la voiture sortir du cadre.
func _camera(dt: float, px: float, py: float) -> void:
	var ecran := get_viewport().get_visible_rect().size
	var W := ecran.x
	var H := ecran.y
	var vf := minf(1.0, car.v / minf(modele.vmax, VMAX_ECRAN))
	var near := 30.0 if tourne else 20.0
	var far := 75.0 if tourne else 50.0
	var metres := (near + (far - near) * vf) * 1.35
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
	# Le plafond, dans le repère de l'écran.
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
