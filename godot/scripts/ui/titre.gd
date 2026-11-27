## L'ÉCRAN TITRE (js/ui.js, splash) : l'affiche de GRIP remplit l'écran, comme dans le jeu web, et
## « APPUIE POUR COMMENCER » clignote juste au-dessus du toit de la voiture rouge. N'importe quelle touche,
## clic ou doigt fait entrer dans les menus.
##
## Deux affiches, celles du jeu web : 9:16 pour un téléphone debout, 16:9 pour un écran couché. Elles
## couvrent l'écran (object-fit: cover), calées comme dans le jeu web (65 % 60 % debout, 60 % 10 %
## couchée) ; un voile sombre monte du bas. Les affiches de SLOTLESS restent à côté, pour Steam et iOS.
class_name Titre
extends Control

var paysage: Texture2D
var portrait: Texture2D
var _parti := false
# le toit de la Ferrari rouge, en pixels de l'affiche (js/ui.js, placeInvitation)
const TOIT_PORTRAIT := 1030.0           # debout : 941 × 1672
const TOIT_PAYSAGE := 523.0             # couchée : 1672 × 941
const CALAGE_PORTRAIT := Vector2(0.65, 0.60)
const CALAGE_PAYSAGE := Vector2(0.60, 0.10)


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
	draw_rect(Rect2(Vector2.ZERO, size), Color("#120f0c"))
	var debout := size.x < size.y
	var tex := portrait if debout else paysage
	var calage := CALAGE_PORTRAIT if debout else CALAGE_PAYSAGE
	var e := maxf(size.x / tex.get_width(), size.y / tex.get_height())
	var t := Vector2(tex.get_width(), tex.get_height()) * e
	var o := (size - t) * calage
	draw_texture_rect(tex, Rect2(o, t), false)
	# le voile du bas (.voile : 32 % de la hauteur, transparent puis 0,55 à mi-chemin, 0,8 en bas)
	var hv := size.y * 0.32
	var y0 := size.y - hv
	var sombre := Color(12 / 255.0, 9 / 255.0, 6 / 255.0)
	var arrets := [[0.0, 0.0], [0.55, 0.55], [1.0, 0.8]]
	for i in 2:
		var a0: Array = arrets[i]
		var a1: Array = arrets[i + 1]
		var ya := y0 + hv * float(a0[0])
		var yb := y0 + hv * float(a1[0])
		draw_polygon(PackedVector2Array([Vector2(0, ya), Vector2(size.x, ya), Vector2(size.x, yb), Vector2(0, yb)]),
			PackedColorArray([Color(sombre, a0[1]), Color(sombre, a0[1]), Color(sombre, a1[1]), Color(sombre, a1[1])]))
	var y_toit := o.y + (TOIT_PORTRAIT if debout else TOIT_PAYSAGE) * e
	# « APPUIE POUR COMMENCER » : jaune, cerclé de noir, qui s'éteint à moitié et revient (press-blink)
	var ph := fmod(Time.get_ticks_msec() / 1000.0, 1.2) / 1.2
	var a := 1.0 if ph < 0.55 else (lerpf(1.0, 0.22, (ph - 0.55) / 0.15) if ph < 0.7 else (0.22 if ph < 0.88 else lerpf(0.22, 1.0, (ph - 0.88) / 0.12)))
	var taille := roundi(clampf(size.y * 0.036, 22, 36))
	var tactile := OS.has_feature("mobile") or (OS.has_feature("web") and DisplayServer.is_touchscreen_available())
	var txt := Textes.t("tapStart" if tactile else "pressStart")
	var font := Style.racing()
	var w := font.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, taille).x
	var p := Vector2((size.x - w) / 2, y_toit - 8 - taille * 0.22)
	# le halo doré, le trait sombre et son ombre portée, puis le jaune (css .press)
	draw_string_outline(font, p, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, taille, roundi(taille * 0.9), Color(1, 0.55, 0.12, 0.16 * a))
	draw_string_outline(font, p, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, taille, roundi(taille * 0.45), Color(1, 0.77, 0.27, 0.28 * a))
	draw_string_outline(font, p + Vector2(0, 3), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, taille, 4, Color(0.106, 0.075, 0.03, a))
	draw_string(font, p + Vector2(0, 3), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, taille, Color(0.106, 0.075, 0.03, a))
	draw_string_outline(font, p, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, taille, 3, Color(0.106, 0.075, 0.03, a))
	draw_string(font, p, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, taille, Color(1, 0.847, 0.29, a))
	# sur ordinateur, les commandes, en bas à gauche ; la version en bas à droite
	var petit := roundi(clampf(size.y * 0.016, 11, 16))
	if not tactile:
		var cmd := Textes.t("splashInputs")
		var cw := Style.largeur(cmd, petit) + 24
		draw_rect(Rect2(size.x * 0.03, size.y - petit * 3.2, cw, petit * 2), Color(0.078, 0.07, 0.055, 0.7))
		Style.texte(self, cmd, Vector2(size.x * 0.03 + 12, size.y - petit * 1.75), petit, Color("#f3e6c8"))
	var ver := Textes.t("proto", [Catalogue.circuits().size(), Catalogue.donnees.voitures.size()])
	Style.texte(self, ver, Vector2(size.x - Style.largeur(ver, petit) - 12, size.y - petit * 0.9), petit, Color(0.95, 0.9, 0.8, 0.6))
