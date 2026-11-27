## L'ÉCRAN TITRE (js/ui.js, splash) : l'affiche de GRIP remplit l'écran, comme dans le jeu web, et
## « APPUIE POUR COMMENCER » clignote juste au-dessus du toit de la voiture rouge. N'importe quelle touche,
## clic ou doigt fait entrer dans les menus.
##
## Deux affiches, celles du jeu web : 9:16 pour un téléphone debout, 16:9 pour un écran couché. Elles
## couvrent l'écran (object-fit: cover), calées comme dans le jeu web (65 % 60 % debout, 60 % 10 %
## couchée) ; un voile sombre monte du bas. Les affiches de SLOTLESS restent à côté, pour Steam et iOS.
##
## En bas, comme dans le jeu web : le dernier devlog sur son ticket crème (.splash-devlog), qui ouvre
## itch.io sans entrer dans le jeu ; au-dessus, sur ordinateur, les commandes ; dans le coin, la
## version sur sa pastille sombre, avec RECETTE en recette (.version, canalBadge).
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
## Le dernier devlog : celui du jeu web (js/ui.js, DERNIER_DEVLOG), à recopier ici à chaque nouveau.
const DEVLOG := { numero = 4, titre = "GT3, Night Racing & World Records on itch.io",
	url = "https://drapiiii.itch.io/grip-racing-the-line/devlog/1786520/grip-devlog-4-gt3-night-racing-world-records-on-itchio" }

var _u := 1.0                         # unités de l'écran par pixel du jeu web (un point de l'iPhone)
var _ticket := Rect2()
var _dernierLien := -10000
var _pastille: StyleBoxFlat
var _systeme: Font
var _systemeGras: Font


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	paysage = load("res://images/interface/affiche-titre-paysage.webp")
	portrait = load("res://images/interface/affiche-titre-portrait.webp")
	mouse_filter = Control.MOUSE_FILTER_STOP
	resized.connect(_mesure)
	_mesure()
	_pastille = StyleBoxFlat.new()
	_pastille.set_corner_radius_all(999)
	# la police du système (system-ui), comme la pastille du jeu web
	var f := FontVariation.new()
	f.base_font = ThemeDB.fallback_font
	_systeme = f
	var g := FontVariation.new()
	g.base_font = ThemeDB.fallback_font
	g.variation_embolden = 0.8
	_systemeGras = g
	focus_mode = Control.FOCUS_ALL
	grab_focus.call_deferred()


func _process(_dt: float) -> void:
	queue_redraw()                   # l'invitation clignote


## Les tailles du jeu web sont en pixels de la page : un pixel y vaut un point de l'iPhone (390 de
## large). Au doigt, on mesure la page ; sur ordinateur, l'image vaut la fenêtre (Style.echelleTactile).
func _mesure() -> void:
	_u = Style.echelleTactile(size)
	if not OS.has_feature("web") and size.x < size.y: _u = maxf(_u, size.x / 390.0)
	queue_redraw()


func _gui_input(e: InputEvent) -> void:
	if not ((e is InputEventMouseButton or e is InputEventScreenTouch) and e.pressed): return
	# le ticket du devlog ouvre itch.io, et l'affiche reste (le doigt arrive en toucher et en clic : un seul lien)
	if _ticket.has_point(e.position):
		accept_event()
		if Time.get_ticks_msec() - _dernierLien > 800:
			_dernierLien = Time.get_ticks_msec()
			App.clic()
			OS.shell_open(DEVLOG.url)
		return
	_entre()


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
	var tactile := Style.tactile() or OS.has_feature("mobile") or (OS.has_feature("web") and DisplayServer.is_touchscreen_available())
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
	# en bas (.stage) : le devlog, et au-dessus, sur ordinateur, les commandes ; centrés debout, à gauche
	# couché (padding-left: 5vw) ; plus petits sur un téléphone (max-width / max-height: 500px)
	var u := _u
	var court := size.y / u <= 500.0
	var petitEcran := size.x / u <= 500.0 or court
	var bas := size.y - ((8.0 + 30.0) if court else (10.0 + 44.0)) * u
	var ecart := (6.0 if court else 10.0) * u
	var gauche := size.x * 0.05 if not debout else -1.0
	_ticket = _dessineDevlog(bas, gauche, petitEcran)
	if not tactile:
		var cmd := Textes.t("splashInputs")
		var tc := roundi(13 * u)
		var cw := _systeme.get_string_size(cmd, HORIZONTAL_ALIGNMENT_LEFT, -1, tc).x + 24 * u
		var ch := tc * 1.2 + 12 * u
		var cx := gauche if gauche >= 0 else (size.x - cw) / 2
		var cy := _ticket.position.y - ecart - ch
		draw_rect(Rect2(cx, cy, cw, ch), Color(20 / 255.0, 18 / 255.0, 14 / 255.0, 0.7))
		draw_string(_systeme, Vector2(cx + 12 * u, cy + 6 * u + tc * 0.95), cmd, HORIZONTAL_ALIGNMENT_LEFT, -1, tc, Color("#f3e6c8"))
	_dessineVersion(u)


## Le ticket du dernier devlog (.splash-devlog) : crème, cerné de noir, son ombre portée, l'étiquette
## rouge « DEVLOG #4 » coupée en biais, le titre (coupé s'il ne tient pas), la flèche rouge.
func _dessineDevlog(bas: float, gauche: float, petit: bool) -> Rect2:
	var u := _u
	var font := Style.racing()
	var t := roundi((14.0 if petit else 19.0) * u)
	var te := roundi((11.5 if petit else 15.0) * u)
	var pad := (Vector4(4, 9, 4, 4) if petit else Vector4(6, 12, 6, 6)) * u      # haut, droite, bas, gauche
	var padE := (Vector2(6, 1) if petit else Vector2(9, 2)) * u
	var gap := (7.0 if petit else 10.0) * u
	var bord := (1.0 if petit else 2.0) * u
	var ombre := (2.0 if petit else 3.0) * u
	var etiquette := ("Devlog #%d" % DEVLOG.numero).to_upper()
	var we := font.get_string_size(etiquette, HORIZONTAL_ALIGNMENT_LEFT, -1, te).x + padE.x * 2
	var he := te * 1.05 + padE.y * 2
	var wf := t * 0.75
	var h := bord * 2 + pad.x + pad.z + maxf(he, t * 1.05)
	var maxi := minf(size.x - 32 * u, 460 * u)
	var titre := String(DEVLOG.titre)
	var fixe := bord * 2 + pad.w + we + gap + gap + wf + pad.y
	var wt := font.get_string_size(titre, HORIZONTAL_ALIGNMENT_LEFT, -1, t).x
	if fixe + wt > maxi:
		while titre.length() > 1 and fixe + font.get_string_size(titre + "...", HORIZONTAL_ALIGNMENT_LEFT, -1, t).x > maxi:
			titre = titre.substr(0, titre.length() - 1)
		titre = titre.strip_edges() + "..."
		wt = font.get_string_size(titre, HORIZONTAL_ALIGNMENT_LEFT, -1, t).x
	var w := fixe + wt
	var x := gauche if gauche >= 0 else (size.x - w) / 2
	var r := Rect2(x, bas - h, w, h)
	draw_rect(Rect2(r.position + Vector2(ombre, ombre), r.size), Color(0x11 / 255.0, 0x11 / 255.0, 0x11 / 255.0, 0xbb / 255.0))
	draw_rect(r, Color("#171b19"))
	draw_rect(r.grow(-bord), Color("#fff0d2"))
	var cy := r.position.y + h / 2
	var ex := r.position.x + bord + pad.w
	var pts := PackedVector2Array([Vector2(ex + we * 0.06, cy - he / 2), Vector2(ex + we, cy - he / 2), Vector2(ex + we * 0.94, cy + he / 2), Vector2(ex, cy + he / 2)])
	Style.plein(self, pts, Color("#d22620"))
	draw_string(font, Vector2(ex + padE.x, cy + te * 0.36), etiquette, HORIZONTAL_ALIGNMENT_LEFT, -1, te, Color("#fff0d2"))
	var tx := ex + we + gap
	draw_string(font, Vector2(tx, cy + t * 0.36), titre, HORIZONTAL_ALIGNMENT_LEFT, -1, t, Color("#171b19"))
	var fx := tx + wt + gap
	BarreTitre.fleche(self, Vector2(fx, cy), Vector2(fx + wf, cy), Color("#d22620"), maxf(2.0, t * 0.14), t * 0.3)
	return r


## La version dans le coin (.version) : sur sa pastille sombre, en police du système, et la pastille
## orange RECETTE en recette (canalBadge).
func _dessineVersion(u: float) -> void:
	var v := String(ProjectSettings.get_setting("application/config/version", ""))
	if v == "": return
	var d := String(ProjectSettings.get_setting("grip/date", ""))
	var txt := "v" + v + ((" · " + d) if d != "" else "")
	var recette := String(ProjectSettings.get_setting("grip/canal", "recette")) == "recette"
	var tv := roundi(12 * u)
	var tb := roundi(12 * 0.85 * u)
	var wv := _systeme.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, tv).x
	var wb := _systemeGras.get_string_size("RECETTE", HORIZONTAL_ALIGNMENT_LEFT, -1, tb).x + 12 * u if recette else 0.0
	var w := 18 * u + wv + ((6 * u + wb) if recette else 0.0)
	var h := tv * 1.25 + 6 * u
	var r := Rect2(size.x - 10 * u - w, size.y - 8 * u - h, w, h)
	_pastille.bg_color = Color(10 / 255.0, 12 / 255.0, 20 / 255.0, 0.62)
	draw_style_box(_pastille, r)
	var base := r.position.y + h / 2 + tv * 0.36
	draw_string(_systeme, Vector2(r.position.x + 9 * u, base), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, tv, Color("#dfe3ea"))
	if recette:
		var hb := tb * 1.4 + 2 * u
		var rb := Rect2(r.position.x + 9 * u + wv + 6 * u, r.position.y + (h - hb) / 2, wb, hb)
		_pastille.bg_color = Color("#ff7a1a")
		draw_style_box(_pastille, rb)
		draw_string(_systemeGras, Vector2(rb.position.x + 6 * u, rb.position.y + hb / 2 + tb * 0.36), "RECETTE", HORIZONTAL_ALIGNMENT_LEFT, -1, tb, Color("#1a0d00"))
