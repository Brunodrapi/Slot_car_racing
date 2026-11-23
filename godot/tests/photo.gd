## Des photos du prototype, pour vérifier le rendu sans écran (Xvfb) :
##
##   xvfb-run -s "-screen 0 1280x720x24" godot --path godot --script res://tests/photo.gd -- <dossier>
##
## Le jeu se lance, le pilote automatique du jeu web n'existe pas ici : on tient l'accélérateur
## par à-coups pour passer La Source sans sortir, et on photographie à quelques instants.
extends SceneTree

var jeu
var n := 0
var dossier := "user://"
const PHOTOS := [200, 520, 760, 1100]


func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0: dossier = args[0]
	jeu = load("res://scenes/jeu.tscn").instantiate()
	root.add_child(jeu)


func _process(_dt: float) -> bool:
	n += 1
	if jeu.car:
		# Un pilote très simple : les gaz tant que la voiture va moins vite que ce que le virage
		# à venir permet (la même règle que aiThrottle, sans le bruit).
		var c: Voiture = jeu.car
		var lim := 1e9
		var d := 0.0
		while d < c.v * c.v / (2 * c.cls.brake * 0.88) + 40:
			var k := absf(c.track.lineCurv(c.s + d, c.selS))
			if k > 1e-4:
				var g := c.cls.grip
				var vc := sqrt(2.8 * g / k)
				if k - c.cls.df > 1e-6: vc = minf(sqrt(g / (k - c.cls.df)), vc)
				lim = minf(lim, sqrt(vc * vc + 2 * c.cls.brake * 0.88 * d))
			d += 3
		if c.v < lim - 0.3: Input.action_press("gaz")
		else: Input.action_release("gaz")
	if n in PHOTOS:
		var img := root.get_viewport().get_texture().get_image()
		img.save_png("%s/godot-%d.png" % [dossier, n])
		print("photo ", n, " v=", roundi(jeu.car.v * 3.6), " km/h s=", roundi(jeu.car.s), " · appels ",
			Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME), " · triangles ",
			Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME), " · objets ",
			Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME))
	if n > PHOTOS[-1]:
		quit()
	return false
