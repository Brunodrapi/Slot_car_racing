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
	ci.draw_colored_polygon(PackedVector2Array([Vector2(x + cut, y), Vector2(x + w, y), Vector2(x + w - cut, y + h), Vector2(x, y + h)]), c)


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
			ci.draw_colored_polygon(PackedVector2Array([Vector2(x0 + d0, y0), Vector2(x1 + d0, y0), Vector2(x1 + d1, y0 + cote), Vector2(x0 + d1, y0 + cote)]), c)


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
