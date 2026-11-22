## La barre du titre des écrans du jeu web (js/ui.js, paddockTopbar ; css/style.css, .topbar) : le
## retour sur le noir, le damier penché, le titre sur sa bande rouge oblique, le logo. Au téléphone
## (64 de haut, mesurée sur un iPhone) et sur ordinateur (65 de haut, mesurée sur un écran de 1440).
class_name BarreTitre

const NOIR := Color("#151917")
const ROUGE := Color("#c82520")
const CREME := Color("#fff0d2")
const TEXTE := Color("#fff1d5")


## Au téléphone : `r` est la barre entière (64 de haut) ; le retour occupe ses 73 premiers points.
static func tel(ci: CanvasItem, r: Rect2, titre: String) -> void:
	var x := r.position.x
	var y := r.position.y
	ci.draw_rect(r, NOIR)
	Style.damier(ci, Rect2(x + 65, y, 34, 64), 13, CREME, NOIR, 16)
	var w := Style.largeur(titre, 24) + 46
	var x2 := x + 101
	ci.draw_colored_polygon(PackedVector2Array([Vector2(x2 + 14, y), Vector2(x2 + w, y), Vector2(x2 + w - 28, y + 64), Vector2(x2, y + 64)]), ROUGE)
	Style.texte(ci, titre, Vector2(x2 + 16, y + 41), 24, TEXTE)
	var logo := Style.tex("res://images/interface/logo-slotless.webp")
	var lh := 72.0 * logo.get_height() / logo.get_width()
	ci.draw_texture_rect(logo, Rect2(r.end.x - 78, y + 32 - lh / 2, 72, lh), false)


## Le retour du téléphone, dessiné dans son bouton (73 × 64) : la flèche, puis RETOUR.
static func retourTel(b: Control) -> void:
	fleche(b, Vector2(21.5, 33), Vector2(12.5, 33), TEXTE, 1.4, 3.5)
	Style.texte(b, Textes.t("backWord").to_upper(), Vector2(24, 37.3), 14, TEXTE)


## Sur ordinateur : `r` est la barre entière (65 de haut) ; le retour occupe ses 119 premiers points.
static func pc(ci: CanvasItem, r: Rect2, titre: String) -> void:
	var x := r.position.x
	var y := r.position.y
	ci.draw_rect(r, NOIR)
	Style.damier(ci, Rect2(x + 115, y, 74, 65), 8, CREME, NOIR, 16.2)
	var w := Style.largeur(titre, 46) + 90
	var x2 := x + 189
	ci.draw_colored_polygon(PackedVector2Array([Vector2(x2 + 14, y), Vector2(x2 + w, y), Vector2(x2 + w - 28, y + 65), Vector2(x2, y + 65)]), ROUGE)
	Style.texte(ci, titre, Vector2(x2 + 26, y + 50), 46, TEXTE)
	var logo := Style.tex("res://images/interface/logo-slotless.webp")
	var lh := 190.0 * logo.get_height() / logo.get_width()
	ci.draw_texture_rect(logo, Rect2(r.end.x - 200, y + 32.5 - lh / 2, 190, lh), false)


## Le retour sur ordinateur, dans son bouton (119 × 65).
static func retourPC(b: Control) -> void:
	fleche(b, Vector2(36, 34), Vector2(20, 34), TEXTE, 2.0, 5.0)
	Style.texte(b, Textes.t("backWord").to_upper(), Vector2(40, 42), 22, TEXTE)


## Une flèche (← ou →), dessinée : la police du jeu ne l'a pas.
static func fleche(ci: CanvasItem, a: Vector2, b: Vector2, c: Color, ep: float, tete: float) -> void:
	ci.draw_line(a, b, c, ep, true)
	var u := (b - a).normalized()
	var n := Vector2(-u.y, u.x)
	ci.draw_polyline(PackedVector2Array([b - u * tete + n * tete * 0.75, b, b - u * tete - n * tete * 0.75]), c, ep, true)


## Un texte qui peut porter ↑ et ↓ (la police ne les a pas) : les flèches sont tracées à leur place.
static func texteFleches(ci: CanvasItem, t: String, p: Vector2, taille: int, c: Color) -> void:
	var x := p.x
	var bout := ""
	for ch in t:
		if ch == "↑" or ch == "↓":
			if bout != "":
				Style.texte(ci, bout, Vector2(x, p.y), taille, c)
				x += Style.largeur(bout, taille)
				bout = ""
			var w := taille * 0.55
			var haut := p.y - taille * 0.68
			var bas := p.y - taille * 0.02
			var cx := x + w / 2
			if ch == "↑": fleche(ci, Vector2(cx, bas), Vector2(cx, haut), c, taille * 0.075, taille * 0.2)
			else: fleche(ci, Vector2(cx, haut), Vector2(cx, bas), c, taille * 0.075, taille * 0.2)
			x += w
		else:
			bout += ch
	if bout != "": Style.texte(ci, bout, Vector2(x, p.y), taille, c)


static func largeurFleches(t: String, taille: int) -> float:
	var w := 0.0
	var bout := ""
	for ch in t:
		if ch == "↑" or ch == "↓":
			w += Style.largeur(bout, taille) + taille * 0.55
			bout = ""
		else: bout += ch
	return w + Style.largeur(bout, taille)
