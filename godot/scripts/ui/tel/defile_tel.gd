## Une colonne qui défile au doigt (le corps d'une feuille, d'une page, de l'écran du championnat) : le
## glissé de la page du jeu web au téléphone (Doigt), qui file encore quand on lâche, et la molette.
## Dès que le doigt glisse, le bouton qu'il avait touché ne se prend plus.
class_name DefileTel
extends Control

var contenu: VBoxContainer
var marges: MarginContainer
var haut := 0.0
var doigt: Doigt


func _init(ecart := 10, g := 0, h := 0, d := 0, b := 0) -> void:
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_PASS
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	contenu = Tel.boite(true, ecart) as VBoxContainer
	contenu.mouse_filter = Control.MOUSE_FILTER_PASS
	marges = Tel.marge(contenu, g, h, d, b)
	marges.mouse_filter = Control.MOUSE_FILTER_PASS
	add_child(marges)
	marges.minimum_size_changed.connect(_place)
	resized.connect(_place)


func _ready() -> void:
	var e := ecran()
	doigt = Doigt.new(e.cadre if e else self, _defile)
	_place()


func ecran() -> EcranTel:
	var n := get_parent()
	while n and not (n is EcranTel): n = n.get_parent()
	return n as EcranTel


func hauteurContenu() -> float:
	return marges.get_combined_minimum_size().y


func _place() -> void:
	marges.size = Vector2(size.x, maxf(hauteurContenu(), size.y))
	_defile(0.0)


func _defile(d: float) -> void:
	haut = clampf(haut + d, 0.0, maxf(0.0, hauteurContenu() - size.y))
	marges.position = Vector2(0, -roundf(haut))


## Le défilement d'avant une reconstruction : on le rend une fois le contenu posé.
func reprend(y: float) -> void:
	haut = y
	_place.call_deferred()


func _dedans(p: Vector2) -> bool:
	return (get_global_transform() * Rect2(Vector2.ZERO, size)).has_point(p)


func _input(e: InputEvent) -> void:
	if doigt == null or not is_visible_in_tree(): return
	var ec := ecran()
	if ec and not ec.estDessus(self):
		return
	if e is InputEventScreenTouch:
		if e.pressed and not _dedans(e.position): return
		doigt.entree(e)
	elif e is InputEventScreenDrag:
		doigt.entree(e)
	elif e is InputEventMouseButton and e.pressed and _dedans(e.position):
		if e.button_index == MOUSE_BUTTON_WHEEL_UP: _defile(-48)
		elif e.button_index == MOUSE_BUTTON_WHEEL_DOWN: _defile(48)


func _process(dt: float) -> void:
	if doigt: doigt.avance(dt)
