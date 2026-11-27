## La base des écrans du téléphone : tout se dessine à l'échelle d'un téléphone de 390 points de large
## (le cadre), l'écran se refait d'un bloc quand une valeur change, et les feuilles et les pages
## s'empilent au-dessus. Le retour de l'appareil (ou Échap) ferme ce qui est dessus, puis revient en
## arrière. Tenu couché, l'écran rend la main à celui d'avant (`nom`).
class_name EcranTel
extends Control

var cadre: Control
var vue: Control
var pile: Array[Control] = []
var H := 844.0
var k := 1.0
var nom := "accueil"                 # l'écran classique qui le remplace quand le téléphone est couché
var optionsNom := {}
var _toast: Control
var _minuteToast: SceneTreeTimer
var _aRefaire := false


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	cadre = Control.new()
	cadre.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(cadre)
	vue = Control.new()
	vue.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cadre.add_child(vue)
	resized.connect(_place)
	_place()
	reconstruit()


func _place() -> void:
	if size.x <= 0: return
	k = size.x / Tel.W
	cadre.scale = Vector2(k, k)
	H = size.y / k
	cadre.size = Vector2(Tel.W, H)
	vue.size = cadre.size
	for c in pile:
		if is_instance_valid(c): c.call("_place")
	if size.x > size.y and is_inside_tree() and not Tel.actif():
		App.aller.call_deferred(nom, optionsNom)


## L'écran, refait d'un bloc (à écrire dans chaque écran).
func construit(_v: Control) -> void:
	pass


func reconstruit() -> void:
	for c in vue.get_children():
		vue.remove_child(c)
		c.queue_free()
	construit(vue)


## Une valeur a changé : l'écran et ce qui est ouvert dessus se refont, une fois, après le geste.
func rafraichit() -> void:
	if _aRefaire: return
	_aRefaire = true
	_rafraichit.call_deferred()


func _rafraichit() -> void:
	_aRefaire = false
	if not is_inside_tree(): return
	reconstruit()
	for c in pile:
		if is_instance_valid(c): c.call("rafraichit")


## La colonne d'un écran : le bandeau, le corps, la barre du bas. Rend le corps.
func colonne(v: Control, titre: String, libelle: String, retour: Callable) -> VBoxContainer:
	var col := Tel.boite(true, 0) as VBoxContainer
	col.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	col.mouse_filter = Control.MOUSE_FILTER_PASS
	var fond := ColorRect.new()
	fond.color = Tel.PAPIER
	fond.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	fond.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(fond)
	v.add_child(col)
	col.add_child(BandeauTel.new(titre, libelle, retour))
	return col


func ouvreFeuille(titre: String, construire: Callable, haute := true) -> FeuilleTel:
	var f := FeuilleTel.new(self, titre, construire, haute)
	pile.append(f)
	cadre.add_child(f)
	return f


func ouvrePage(titre: String, libelle: String, construire: Callable, bas := Callable()) -> PageTel:
	var p := PageTel.new(self, titre, libelle, construire, bas)
	pile.append(p)
	cadre.add_child(p)
	return p


func oublie(c: Control) -> void:
	pile.erase(c)


func fermeDessus() -> void:
	if pile.is_empty(): return
	var c: Control = pile.back()
	c.call("ferme")


func fermeTout() -> void:
	for c in pile.duplicate(): c.call("ferme")


## La couche du dessus (la dernière feuille ou page ouverte, sinon l'écran) contient-elle `c` ?
func estDessus(c: Control) -> bool:
	var dessus: Control = pile.back() if not pile.is_empty() else vue
	return dessus == c or dessus.is_ancestor_of(c)


## Le retour, quand rien n'est ouvert (à écrire dans chaque écran).
func retour() -> void:
	App.aller("accueil")


func _unhandled_input(e: InputEvent) -> void:
	if e.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		_arriere()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST: _arriere()


func _arriere() -> void:
	if not pile.is_empty(): fermeDessus()
	else: retour()


## Un message en bas de l'écran, qui s'en va seul (maquette, #toast).
func toast(t: String) -> void:
	if is_instance_valid(_toast): _toast.queue_free()
	var l := Tel.texte(t, 14, Tel.PAPIER)
	_toast = Tel.fond(Tel.marge(l, 14, 12, 14, 12), Tel.ENCRE)
	_toast.size = Vector2(Tel.W * 0.92, 0)
	cadre.add_child(_toast)
	_toast.reset_size()
	_toast.position = Vector2(Tel.W * 0.04, H - 96 - _toast.get_combined_minimum_size().y)
	var moi := _toast
	get_tree().create_timer(3.2).timeout.connect(func(): if is_instance_valid(moi): moi.queue_free())
