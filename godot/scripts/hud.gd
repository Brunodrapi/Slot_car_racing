## Le tableau de bord minimal : le tour et les temps, la vitesse, le levier de ligne, et la mesure
## de fluidité (images par seconde, pire image de la dernière seconde, coût d'un pas de physique).
class_name Hud
extends Control

var jeu
var police: Font
const JAUNE := Color("#ffcf5c")
const BLEU := Color("#7fd4ff")
const CREME := Color("#f0ece4")
const NUIT := Color(0.09, 0.09, 0.11, 0.82)
# Les cinq couleurs de l'état ressenti (Renderer.VIF), du calme au tête-à-queue.
const RESSENTI := [Color8(94, 196, 255), Color8(82, 230, 168), Color8(255, 214, 74), Color8(190, 140, 255), Color8(255, 96, 96)]


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	police = ThemeDB.fallback_font


func _levier() -> Rect2:
	var H := size.y
	return Rect2(16, H * 0.5 - 20, 92, H * 0.5 - 4)


func dansLevier(p: Vector2) -> bool:
	return p.x < size.x * 0.3 and p.y > size.y * 0.35


func levierVers(p: Vector2) -> float:
	var r := _levier()
	var haut := r.position.y + 28
	var bas := r.end.y - 28
	return clampf(1 - 2 * (p.y - haut) / (bas - haut), -1, 1)


func _texte(t: String, p: Vector2, taille: int, c: Color, align := HORIZONTAL_ALIGNMENT_LEFT, largeur := -1.0) -> void:
	draw_string(police, p, t, align, largeur, taille, c)


static func chrono(t: float) -> String:
	if t < 0: return "--:--.---"
	var m := int(t / 60)
	return "%d:%06.3f" % [m, t - m * 60]


func _draw() -> void:
	if not jeu or not jeu.car: return
	var car: Voiture = jeu.car
	var W := size.x
	var H := size.y
	# --- les temps
	draw_rect(Rect2(16, 16, 330, 76), NUIT)
	var enTour: float = (jeu.temps - car.lapStart) if car.started else -1.0
	_texte("TOUR %d" % (car.lap + 1 if car.started else 0), Vector2(30, 46), 22, CREME)
	_texte(chrono(enTour), Vector2(150, 46), 26, JAUNE if car.lapSale else CREME)
	_texte("MEILLEUR  " + chrono(car.bestLap), Vector2(30, 80), 18, Color(CREME, 0.8))
	if car.lapSale and car.started:
		_texte("tour non valable", Vector2(200, 80), 14, JAUNE)
	# --- le départ
	if not jeu.enCourse:
		var n := int(ceil(jeu.feux))
		_texte(str(n), Vector2(W / 2 - 40, H * 0.3), 96, CREME, HORIZONTAL_ALIGNMENT_CENTER, 80)
	# --- la vitesse et l'état ressenti
	var kmh := car.speed() * 3.6
	draw_rect(Rect2(W - 236, H - 110, 220, 94), NUIT)
	_texte("%d" % roundi(kmh), Vector2(W - 226, H - 40), 54, CREME, HORIZONTAL_ALIGNMENT_RIGHT, 130)
	_texte("km/h", Vector2(W - 88, H - 40), 18, Color(CREME, 0.7))
	var x := clampf(car.ressenti, 0, 1) * 4
	var i := mini(3, int(x))
	var teinte: Color = RESSENTI[i].lerp(RESSENTI[i + 1], x - i)
	draw_circle(Vector2(W - 200, H - 30), 8, teinte)
	_texte("GRIP", Vector2(W - 186, H - 24), 16, teinte)
	if car.engineStopped:
		_texte("MOTEUR COUPÉ", Vector2(W / 2 - 150, H * 0.24), 34, Color("#ff6b5e"), HORIZONTAL_ALIGNMENT_CENTER, 300)
	elif car.herbe:
		_texte("HORS PISTE", Vector2(W / 2 - 150, H * 0.24), 34, Color("#ff6b5e"), HORIZONTAL_ALIGNMENT_CENTER, 300)
	# --- le levier de ligne : jaune en haut (extérieur), idéale au milieu, bleue en bas (intérieur)
	var r := _levier()
	draw_rect(r, NUIT)
	var haut := r.position.y + 28
	var bas := r.end.y - 28
	var xl := r.position.x + 20
	draw_line(Vector2(xl, haut), Vector2(xl, bas), Color(CREME, 0.35), 3)
	for k in [[1.0, "JAUNE", JAUNE], [0.0, "IDÉALE", CREME], [-1.0, "BLEUE", BLEU]]:
		var yk: float = haut + (1 - k[0]) / 2 * (bas - haut)
		draw_circle(Vector2(xl, yk), 7, Color(k[2], 0.5), false, 2)
		_texte(k[1], Vector2(xl + 16, yk + 6), 15, k[2])
	var ys := haut + (1 - car.selS) / 2 * (bas - haut)
	draw_circle(Vector2(xl, ys), 9, CREME)
	var yv := haut + (1 - car.sel) / 2 * (bas - haut)
	draw_circle(Vector2(xl, yv), 12, CREME, false, 2)
	# --- la mesure
	var fps := Engine.get_frames_per_second()
	var t := "Godot %s · %d i/s · pire image %.1f ms · pas de physique %.0f µs · %d carreaux, %d k triangles" % [
		Engine.get_version_info().string, fps, jeu.pireImage * 1000, jeu.coutPas, jeu.decor.nCarreaux, jeu.decor.nTriangles / 1000]
	_texte(t, Vector2(W - 760, 30), 14, Color(CREME, 0.75), HORIZONTAL_ALIGNMENT_RIGHT, 744)
	_texte("Espace : gaz · ↑ ↓ : ligne · C : vue · R : rejouer · F : plein écran", Vector2(W - 760, 50), 13, Color(CREME, 0.55), HORIZONTAL_ALIGNMENT_RIGHT, 744)
