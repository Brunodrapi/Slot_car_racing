## Une page plein écran qui arrive de la droite (maquette, .page-circuit) : la fiche et les chronos d'un
## circuit, le calendrier du championnat, le championnat de la table. Son bandeau la ferme.
class_name PageTel
extends Control

var ecran: EcranTel
var titre := ""
var libelle := ""
var construire: Callable         # construire.call(corps : VBoxContainer)
var bas: Callable                # bas.call() -> Control, la barre du bas (facultative)
var corps: DefileTel
var zoneBas: Control
var _ferme := false


func _init(e: EcranTel, t: String, lib: String, c: Callable, b := Callable()) -> void:
	ecran = e
	titre = t
	libelle = lib
	construire = c
	bas = b
	mouse_filter = Control.MOUSE_FILTER_STOP


func _ready() -> void:
	var fond := ColorRect.new()
	fond.color = Tel.PAPIER
	fond.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	fond.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(fond)
	var col := Tel.boite(true, 0)
	col.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	col.mouse_filter = Control.MOUSE_FILTER_PASS
	add_child(col)
	col.add_child(BandeauTel.new(titre, libelle, ferme))
	corps = DefileTel.new(10, 10, 10, 10, 20)
	col.add_child(corps)
	zoneBas = Tel.boite(true, 0)
	col.add_child(zoneBas)
	_remplit()
	size = ecran.cadre.size
	position.x = size.x
	create_tween().tween_property(self, "position:x", 0.0, 0.24).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)


func _remplit() -> void:
	var y := corps.haut
	for c in corps.contenu.get_children():
		corps.contenu.remove_child(c)
		c.queue_free()
	construire.call(corps.contenu)
	corps.reprend(y)
	for c in zoneBas.get_children():
		zoneBas.remove_child(c)
		c.queue_free()
	if bas.is_valid():
		var b: Control = bas.call()
		if b: zoneBas.add_child(b)


func rafraichit() -> void:
	if not _ferme: _remplit()


func _place() -> void:
	size = ecran.cadre.size


func ferme() -> void:
	if _ferme: return
	_ferme = true
	ecran.oublie(self)
	var tw := create_tween()
	tw.tween_property(self, "position:x", size.x, 0.22).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	tw.tween_callback(queue_free)
