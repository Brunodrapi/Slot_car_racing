## La pause : reprendre, recommencer, quitter (js/ui.js).
class_name Pause
extends Control

var jeu
var boutons: Array[Bouton] = []


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for d in [["REPRENDRE", Color("#ffd400"), Style.ENCRE, func(): jeu.basculePause()],
			["RECOMMENCER", Style.NUIT_PLEINE, Style.CREME, func(): jeu.recommence()],
			["QUITTER", Style.NUIT_PLEINE, Style.CREME, func(): jeu.quitte()]]:
		var b := Bouton.new(d[0], d[1], d[2], 24)
		b.centre = true
		b.pressed.connect(d[3])
		add_child(b)
		boutons.append(b)
	resized.connect(_place)
	_place()


func ouvre() -> void:
	boutons[0].grab_focus()


func _place() -> void:
	for i in boutons.size():
		boutons[i].size = Vector2(260, 48)
		boutons[i].position = Vector2((size.x - 260) / 2, size.y * 0.38 + i * 58)


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.05, 0.06, 0.09, 0.62))
	Style.texte(self, "PAUSE", Vector2(0, size.y * 0.38 - 26), 44, Color.WHITE, HORIZONTAL_ALIGNMENT_CENTER, size.x)
