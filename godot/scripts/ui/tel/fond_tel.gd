## Un fond en forme, sous ce qu'il porte : la pastille des tours (le bord droit penché), qui n'est pas un
## bouton mais en tient trois (− la valeur +).
class_name FondTel
extends MarginContainer

var couleur := Tel.ENCRE
var penche := 0.04


func _init(c := Tel.ENCRE) -> void:
	couleur = c
	mouse_filter = Control.MOUSE_FILTER_PASS


func _draw() -> void:
	var w := size.x
	var h := size.y
	var pts := PackedVector2Array([Vector2(0, 0), Vector2(w, 0), Vector2(w * (1 - penche), h), Vector2(0, h)])
	Style.plein(self, pts, couleur)
	Style.bord(self, pts, couleur)
