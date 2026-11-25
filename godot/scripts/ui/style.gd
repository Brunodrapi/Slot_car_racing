## Le style du jeu web : la police Barlow Condensed noire italique (« Racing »), les panneaux en
## biseau, le damier, les couleurs du papier et de l'encre.
class_name Style
extends RefCounted

const PAPIER := Color("#f2e6ca")
const ENCRE := Color("#20251f")
const NUIT := Color("#171b19ed")
const NUIT_PLEINE := Color("#171b19")
const CREME := Color("#f6eacf")
const ROUGE := Color("#d62c25")
const JAUNE := Color("#f2c230")
const BLEU := Color("#2f7fd8")
const VERT := Color("#22a35a")
const GRIS := Color("#9aa1ad")
const LIGNE_JAUNE := Color("#ffd400")
const LIGNE_BLEUE := Color("#50c8ff")

static var _racing: FontFile
static var _theme: Theme
static var _textures := {}


## Une texture, chargée une fois. À appeler AVANT le dessin : une texture chargée pendant le
## dessin d'un CanvasItem sort blanche (le moteur n'a pas encore ses pixels quand il note l'ordre).
static func tex(chemin: String) -> Texture2D:
	if not _textures.has(chemin):
		_textures[chemin] = load(chemin) if ResourceLoader.exists(chemin) else null
	return _textures[chemin]


static func racing() -> Font:
	if _racing == null:
		_racing = load("res://polices/BarlowCondensed-BlackItalic.ttf")
	return _racing


static func theme() -> Theme:
	if _theme: return _theme
	var t := Theme.new()
	t.default_font = racing()
	t.default_font_size = 22
	var vide := StyleBoxEmpty.new()
	for etat in ["normal", "hover", "pressed", "disabled", "focus"]:
		t.set_stylebox(etat, "Button", vide)
	t.set_color("font_color", "Label", ENCRE)
	_theme = t
	return t


## Le panneau du jeu web (_hudLabel) : un parallélogramme, coin haut gauche et bas droit coupés.
static func biseau(ci: CanvasItem, r: Rect2, c: Color, coupe := -1.0) -> void:
	var cut := minf(9, r.size.y * .23) if coupe < 0 else coupe
	var x := r.position.x
	var y := r.position.y
	var w := r.size.x
	var h := r.size.y
	var pts := PackedVector2Array([Vector2(x + cut, y), Vector2(x + w, y), Vector2(x + w - cut, y + h), Vector2(x, y + h)])
	ci.draw_colored_polygon(pts, c)
	Style.bord(ci, pts, c)


## Un damier de `n` lignes dans un parallélogramme (le drapeau des en-têtes et des cartes).
static func damier(ci: CanvasItem, r: Rect2, n: int, c1: Color, c2: Color, penche := 0.0) -> void:
	var cote := r.size.y / n
	var colonnes := int(ceil(r.size.x / cote))
	for i in colonnes:
		for j in n:
			var c := c1 if (i + j) % 2 == 0 else c2
			if c.a <= 0: continue
			var x0 := r.position.x + i * cote
			var y0 := r.position.y + j * cote
			var d0 := penche * (1 - float(j) / n)
			var d1 := penche * (1 - float(j + 1) / n)
			var x1 := minf(x0 + cote, r.end.x)
			var pts := PackedVector2Array([Vector2(x0 + d0, y0), Vector2(x1 + d0, y0), Vector2(x1 + d1, y0 + cote), Vector2(x0 + d1, y0 + cote)])
			ci.draw_colored_polygon(pts, c)
			if penche != 0: Style.bord(ci, pts, c)


## Un bord lissé autour d'une forme pleine. Un polygone de Godot a des bords en escalier dès que
## l'antialiasing de la carte graphique manque (la version web n'en a pas en 2D) : un trait
## antialiasé de la même couleur, posé sur le contour, adoucit la marche.
static func bord(ci: CanvasItem, pts: PackedVector2Array, c: Color) -> void:
	var ferme := pts.duplicate()
	ferme.append(pts[0])
	ci.draw_polyline(ferme, c, 1.0, true)


static var _tactile = null


## Un écran tactile : la règle du jeu web (mobileDevice, js/util.js), lue dans le navigateur
## pour la version web — un téléphone, une tablette, un iPad qui se dit Mac, ou un écran qu'on
## pointe du doigt sans souris. Godot ne reconnaît pas toujours un téléphone de lui-même.
static func tactile() -> bool:
	if _tactile != null: return _tactile
	var t := OS.has_feature("mobile") or OS.has_feature("web_android") or OS.has_feature("web_ios")
	# les essais sans écran se disent tactiles pour photographier ce que voit un téléphone
	if OS.get_environment("GRIP_TACTILE") == "1": t = true
	if not t and OS.has_feature("web"):
		t = bool(JavaScriptBridge.eval("""(function(){var n=navigator,m=window.matchMedia.bind(window);
			return !!((n.userAgentData&&n.userAgentData.mobile)||/Android|iPhone|iPad|iPod/i.test(n.userAgent||'')
			||(n.platform==='MacIntel'&&n.maxTouchPoints>1)||(m('(pointer: coarse)').matches&&!m('(hover: hover)').matches));})()""", true))
	_tactile = t
	return t


## Valeurs entières choisies au doigt, sans ouvrir le clavier.
static func menuNombre(minimum: int, maximum: int, valeur: int, suffixe: String, interdit: bool, change: Callable) -> OptionButton:
	var menu := OptionButton.new()
	menu.fit_to_longest_item = false
	menu.custom_minimum_size = Vector2(78, 44)
	menu.disabled = interdit
	menu.add_theme_font_size_override("font_size", 18)
	menu.add_theme_color_override("font_color", Color("#8ae8ad"))
	for n in range(minimum, maximum + 1): menu.add_item(str(n) + suffixe, n)
	menu.select(clampi(valeur, minimum, maximum) - minimum)
	menu.item_selected.connect(func(i): App.clic(); change.call(menu.get_item_id(i)))
	return menu


## Au doigt, le tableau de bord se dessine à la taille du jeu web : un point du tableau vaut un
## pixel d'écran du navigateur (390 de large sur un iPhone), au lieu d'un 720e de l'image. Sans cela,
## tout y était deux fois plus petit que dans le jeu web. Jamais en dessous de 1 (tablette, PC).
static func echelleTactile(vp: Vector2) -> float:
	var court := minf(vp.x, vp.y)
	var css := 0.0
	if OS.has_feature("web"):
		css = float(JavaScriptBridge.eval("Math.min(window.innerWidth, window.innerHeight)", true))
	else:
		var ecran := DisplayServer.screen_get_size()
		css = minf(ecran.x, ecran.y) / maxf(1.0, DisplayServer.screen_get_dpi() / 160.0)
	if css <= 0: return 1.0
	return clampf(court / css, 1.0, 3.0)


static func texte(ci: CanvasItem, t: String, p: Vector2, taille: int, c: Color, align := HORIZONTAL_ALIGNMENT_LEFT, largeur := -1.0) -> void:
	ci.draw_string(racing(), p, t, align, largeur, taille, c)


static func largeur(t: String, taille: int) -> float:
	return racing().get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, taille).x


## Une image qui couvre un rectangle en gardant ses proportions (background-size: cover).
static func couvre(ci: CanvasItem, tex: Texture2D, r: Rect2, haut := 0.5) -> void:
	var ts := tex.get_size()
	var k := maxf(r.size.x / ts.x, r.size.y / ts.y)
	var vu := r.size / k
	var src := Rect2((ts.x - vu.x) / 2, (ts.y - vu.y) * haut, vu.x, vu.y)
	ci.draw_texture_rect_region(tex, r, src)


static func temps(t: float) -> String:
	if t < 0: return "--:--.---"
	var m := int(t / 60)
	return "%d:%06.3f" % [m, t - m * 60]


static func drapeau(pays: String) -> Texture2D:
	return tex("res://images/interface/drapeaux/%s.svg" % pays.to_lower())
