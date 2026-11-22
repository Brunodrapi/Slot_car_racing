## L'ÉCRAN TITRE (js/ui.js, splash) : l'affiche de SLOTLESS remplit l'écran, et « APPUIE POUR COMMENCER »
## clignote sous la voiture blanche. N'importe quelle touche, clic ou doigt fait entrer dans les menus.
##
## Deux affiches, comme le jeu web : 9:16 pour un téléphone debout, 4:3 pour un écran couché. Couchée, on
## montre de la bande du titre jusqu'au bas de l'image, et les côtés que l'affiche ne couvre pas
## prolongent sa première et sa dernière colonne : le blanc reste blanc, les bandes bleue et rouge filent
## jusqu'au bord. Debout, elle couvre l'écran en perdant un peu des côtés, jamais une voiture.
class_name Titre
extends Control

var paysage: Texture2D
var portrait: Texture2D
var _parti := false
# Couchée (1448 × 1086) : on montre les lignes 30 à 1086 ; l'invitation sous la voiture blanche.
const HAUT_PAYSAGE := 30.0
const INVITE_PAYSAGE := 1046.0
# Debout (941 × 1672) : l'invitation sur les bandes, sous la voiture blanche. Quand l'écran est moins
# allongé que l'affiche (une tablette), on garde les lignes 360 à 1580 : le titre, les voitures, l'invitation.
const INVITE_PORTRAIT := 1450.0
const GARDE_PORTRAIT := Vector2(360, 1580)


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	paysage = load("res://images/interface/affiche-titre-paysage.webp")
	portrait = load("res://images/interface/affiche-titre-portrait.webp")
	mouse_filter = Control.MOUSE_FILTER_STOP
	resized.connect(queue_redraw)
	focus_mode = Control.FOCUS_ALL
	grab_focus.call_deferred()


func _process(_dt: float) -> void:
	queue_redraw()                   # l'invitation clignote


func _gui_input(e: InputEvent) -> void:
	if (e is InputEventMouseButton or e is InputEventScreenTouch) and e.pressed: _entre()


func _unhandled_input(e: InputEvent) -> void:
	if (e is InputEventKey or e is InputEventJoypadButton) and e.pressed and not e.is_echo(): _entre()


func _entre() -> void:
	if _parti: return
	_parti = true
	App.clic()
	App.aller("accueil")


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color("#fefefe"))
	var debout := size.x < size.y
	var y_invite := 0.0
	if debout:
		# couvrir l'écran, centré : un peu des côtés s'en va
		var tex := portrait
		var e := maxf(size.x / tex.get_width(), size.y / tex.get_height())
		var t := Vector2(tex.get_width(), tex.get_height()) * e
		var o := (size - t) / 2
		var vues := size.y / e                    # les lignes de l'affiche qui tiennent dans l'écran
		if vues < tex.get_height():
			var milieu := (GARDE_PORTRAIT.x + GARDE_PORTRAIT.y) / 2
			o.y = -clampf(milieu - vues / 2, 0, tex.get_height() - vues) * e
		draw_texture_rect(tex, Rect2(o, t), false)
		y_invite = o.y + INVITE_PORTRAIT * e
	else:
		var tex := paysage
		var src := Rect2(0, HAUT_PAYSAGE, tex.get_width(), tex.get_height() - HAUT_PAYSAGE)
		var e := minf(size.y / src.size.y, size.x / src.size.x)
		if size.x / size.y < src.size.x / src.size.y: e = size.x / src.size.x
		var t := src.size * e
		var o := Vector2((size.x - t.x) / 2, size.y - t.y)
		draw_texture_rect_region(tex, Rect2(o, t), src)
		# les côtés prolongent la première et la dernière colonne de l'affiche
		if o.x > 0:
			draw_texture_rect_region(tex, Rect2(0, o.y, o.x + 1, t.y), Rect2(0, src.position.y, 1, src.size.y))
			draw_texture_rect_region(tex, Rect2(o.x + t.x - 1, o.y, size.x - o.x - t.x + 1, t.y), Rect2(tex.get_width() - 1, src.position.y, 1, src.size.y))
		y_invite = o.y + (INVITE_PAYSAGE - HAUT_PAYSAGE) * e
	# « APPUIE POUR COMMENCER » : jaune, cerclé de noir, qui s'éteint à moitié et revient (press-blink)
	var ph := fmod(Time.get_ticks_msec() / 1000.0, 1.2) / 1.2
	var a := 1.0 if ph < 0.55 else (lerpf(1.0, 0.22, (ph - 0.55) / 0.15) if ph < 0.7 else (0.22 if ph < 0.88 else lerpf(0.22, 1.0, (ph - 0.88) / 0.12)))
	var taille := roundi(clampf(size.y * 0.036, 22, 40))
	var tactile := OS.has_feature("mobile") or (OS.has_feature("web") and DisplayServer.is_touchscreen_available())
	var txt := Textes.t("tapStart" if tactile else "pressStart")
	var font := Style.racing()
	var w := font.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, taille).x
	var p := Vector2((size.x - w) / 2, y_invite + taille * 0.36)
	# sur un bandeau sombre : les bandes de la piste sont jaunes, bleues et rouges sous l'invitation
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.09, 0.07, 0.04, 0.78)
	sb.set_corner_radius_all(roundi(taille * 0.3))
	draw_style_box(sb, Rect2(p.x - taille * 0.7, y_invite - taille * 0.62, w + taille * 1.4, taille * 1.35))
	draw_string_outline(font, p + Vector2(0, 3), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, taille, 6, Color(0.106, 0.075, 0.03, a))
	draw_string_outline(font, p, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, taille, 6, Color(0.106, 0.075, 0.03, a))
	draw_string(font, p, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, taille, Color(1, 0.847, 0.29, a))
	# sur ordinateur, les commandes, en bas à gauche ; la version en bas à droite
	var petit := roundi(clampf(size.y * 0.016, 11, 16))
	if not tactile:
		var cmd := Textes.t("splashInputs")
		var cw := Style.largeur(cmd, petit) + 24
		draw_rect(Rect2(size.x * 0.03, size.y - petit * 3.2, cw, petit * 2), Color(0.078, 0.07, 0.055, 0.7))
		Style.texte(self, cmd, Vector2(size.x * 0.03 + 12, size.y - petit * 1.75), petit, Color("#f3e6c8"))
	var ver := Textes.t("proto", [Catalogue.circuits().size(), Catalogue.donnees.voitures.size()])
	Style.texte(self, ver, Vector2(size.x - Style.largeur(ver, petit) - 12, size.y - petit * 0.9), petit, Color(0.1, 0.1, 0.1, 0.55))
