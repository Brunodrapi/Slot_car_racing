## Les deux grandes cartes du paddock et de la table (maquette, .carte-circuit et .carte-garage) : l'image
## du circuit et son tracé, ou la voiture au paddock ; l'étiquette en haut à droite (« Changer »,
## « Garage », « Course 1/3 ») ; le bandeau du nom en bas. Elles se touchent en entier.
class_name CartesTel
extends ToucheTel

var genre := "circuit"           # circuit, voiture
var info := {}                   # le circuit (Paddock.infosCircuits)
var voiture := {}                # la voiture (Catalogue)
var livree := 0
var nuit := false
var etiquette := ""


func _init(g: String) -> void:
	super(Color(0, 0, 0, 0))
	genre = g
	bord = Tel.ENCRE
	epaisseur = 2
	custom_minimum_size.y = 120
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	clip_contents = true


func _draw() -> void:
	var r := Rect2(Vector2.ZERO, size)
	if genre == "circuit": _circuit(r)
	else: _voiture(r)
	super()


func _circuit(r: Rect2) -> void:
	var image: Texture2D = info.get("image")
	if image: Style.couvre(self, image, r, 0.5)
	else: draw_rect(r, Color("#6b8171"))
	if nuit: draw_rect(r, Color(0.04, 0.08, 0.19, 0.7))
	var trace := Rect2(r.size.x * 0.12, r.size.y * 0.06, r.size.x * 0.76, r.size.y * 0.68)
	if not info.is_empty(): Paddock._contour(self, info, trace.grow(-4), false, 3.6, true, nuit)
	var hb := _bandeau(r, String(info.get("nom", "")))
	# à droite du nom : le drapeau, la longueur, la difficulté en mots
	var x := r.size.x - 10
	x -= Tel.niveauDessine(self, int(info.get("difficulty", 1)), Vector2(x, hb.y + 25), true) + 6
	var lon := "%s m ·" % _milliers(roundi(float(info.get("longueur", 0))))
	var lw := Tel.largeurTexte(lon, 13)
	Tel.ecrit(self, lon, Vector2(x - lw, hb.y + 23), 13, Tel.ENCRE_DOUCE)
	x -= lw + 6
	var dr := Style.drapeau(String(info.get("pays", "")))
	if dr:
		draw_texture_rect(dr, Rect2(x - 26, hb.y + 10, 26, 17), false)
		draw_rect(Rect2(x - 26, hb.y + 10, 26, 17), Color(0, 0, 0, 0.2), false, 1)
	_etiquette(r)


func _voiture(r: Rect2) -> void:
	var fondPaddock := Style.tex("res://images/interface/paddock.webp")
	if fondPaddock: Style.couvre(self, fondPaddock, r, 0.5)
	else: draw_rect(r, Color("#c8baa0"))
	var tex := Tel.vignette(String(voiture.get("id", "")), livree)
	if tex:
		var maxW := r.size.x * 0.82
		var maxH := r.size.y * 0.74
		var e := minf(maxW / tex.get_width(), maxH / tex.get_height())
		var t := Vector2(tex.get_width(), tex.get_height()) * e
		draw_texture_rect(tex, Rect2((r.size.x - t.x) / 2, r.size.y - 30 - t.y, t.x, t.y), false)
	var hb := _bandeau(r, String(voiture.get("nom", "")))
	var cat := Tel.nomCat(String(voiture.get("cat", "")))
	var cw := Tel.largeurTexte(cat, 13)
	Tel.ecrit(self, cat, Vector2(r.size.x - 10 - cw, hb.y + 23), 13, Tel.ENCRE_DOUCE)
	_etiquette(r)


static func _milliers(n: int) -> String:
	var s := str(n)
	if n >= 1000: s = "%d %03d" % [n / 1000, n % 1000]
	return s


## Le bandeau du nom (.bandeau-nom) : le papier presque opaque, le trait d'encre au-dessus.
func _bandeau(r: Rect2, nom: String) -> Vector2:
	var y := r.size.y - 37
	draw_rect(Rect2(0, y, r.size.x, 37), Color("#fbf4e2f2"))
	draw_line(Vector2(0, y + 1), Vector2(r.size.x, y + 1), Tel.ENCRE, 2)
	var t := nom.to_upper()
	var place := r.size.x * 0.5
	var taille := 22
	while taille > 14 and Style.largeur(t, taille) > place: taille -= 1
	Style.texte(self, t, Vector2(10, y + 27), taille, Tel.ENCRE)
	return Vector2(0, y)


func _etiquette(r: Rect2) -> void:
	if etiquette == "": return
	var t := etiquette.to_upper()
	var w := Style.largeur(t, 14) + 20
	draw_rect(Rect2(r.size.x - 8 - w, 8, w, 28), Tel.ENCRE)
	Style.texte(self, t, Vector2(r.size.x - 8 - w + 10, 27), 14, Tel.PAPIER)
