## Le hasard à graine de makeRoster (js/race.js) : x = graine × 9301 + 49297, puis
## x = (x × 9301 + 49297) mod 233280. C'est lui qui tire la grille de l'IA d'une course en ligne,
## avec la graine du coup d'envoi : tous les écrans, Godot comme navigateur, tirent la même.
class_name HasardGraine
extends Hasard

var x := 0


func _init(graine: int) -> void:
	x = graine * 9301 + 49297


func random() -> float:
	x = (x * 9301 + 49297) % 233280
	return x / 233280.0
