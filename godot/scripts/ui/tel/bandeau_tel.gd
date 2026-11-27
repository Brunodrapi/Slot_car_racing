## Le bandeau des écrans du téléphone (maquette, .bandeau) : le retour sur le noir, le damier penché, le
## titre sur sa bande rouge coupée en biais, le logo. 52 points de haut.
class_name BandeauTel
extends Control

var titre := ""
var libelle := ""
var action: Callable
var retour: ToucheTel


func _init(t: String, lib: String, act: Callable) -> void:
	titre = t
	libelle = lib
	action = act
	custom_minimum_size.y = 52
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _ready() -> void:
	retour = ToucheTel.new(Color(0, 0, 0, 0))
	var h := Tel.boite(false, 4)
	h.alignment = BoxContainer.ALIGNMENT_CENTER
	h.add_child(Tel.glyphe("gauche", 14, Tel.PAPIER))
	h.add_child(Tel.titre(libelle, 17, Tel.PAPIER))
	retour.ajoute(h)
	retour.marges(12, 0, 12, 0)
	retour.custom_minimum_size = Vector2(64, 52)
	retour.pressed.connect(func(): action.call())
	add_child(retour)
	retour.size = Vector2(maxf(64, retour.get_combined_minimum_size().x), 52)
	resized.connect(queue_redraw)


func _draw() -> void:
	var w := size.x
	draw_rect(Rect2(0, 0, w, 52), Tel.ENCRE)
	var x0 := retour.size.x if retour else 64.0
	# le damier (repeating-conic-gradient de 13 points, penché de 12°)
	Style.damier(self, Rect2(x0, 0, 26, 52), 4, Tel.CARTE, Tel.ENCRE, 11)
	# le titre sur sa bande rouge (clip-path : 4 % 0, 100 % 0, 96 % 100 %, 0 100 %)
	var x1 := x0 + 26
	var x2 := w - 84
	var bw := x2 - x1
	var pts := PackedVector2Array([Vector2(x1 + bw * 0.04, 0), Vector2(x2, 0), Vector2(x2 - bw * 0.04, 52), Vector2(x1, 52)])
	Style.plein(self, pts, Tel.ROUGE)
	Style.bord(self, pts, Tel.ROUGE)
	var etroit := w < 375
	var t := titre.to_upper()
	var taille := (20 if etroit else 24) if t.length() <= 13 else (17 if etroit else 19)
	var place := bw - (24 if etroit else 32)
	while taille > 12 and Style.largeur(t, taille) > place: taille -= 1
	Style.texte(self, t, Vector2(x1 + (12 if etroit else 16), 26 + taille * 0.36), taille, Tel.PAPIER)
	# le logo
	var logo := Style.tex("res://images/interface/logo-slotless.webp")
	if logo:
		var lw := 84.0 - 16
		var lh := lw * logo.get_height() / logo.get_width()
		draw_texture_rect(logo, Rect2(x2 + 8, 26 - lh / 2, lw, lh), false)
