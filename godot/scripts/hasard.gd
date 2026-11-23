## Le hasard de la course : un xorshift32, le même que celui des bancs du jeu web
## (tools/godot-exporte.js). À graine égale, les deux tirent les mêmes nombres dans le même ordre,
## ce qui permet de rejouer une course entière, IA comprise, et de la comparer pas à pas.
class_name Hasard
extends RefCounted

var etat := 1


func _init(graine: int = -1) -> void:
	if graine < 0:
		graine = int(Time.get_ticks_usec()) ^ int(Time.get_unix_time_from_system())
	semer(graine)


func semer(g: int) -> void:
	etat = (g * 2654435761) & 0xFFFFFFFF
	if etat == 0: etat = 1


## Math.random : un nombre de [0, 1).
func random() -> float:
	etat = (etat ^ (etat << 13)) & 0xFFFFFFFF
	etat = etat ^ (etat >> 17)
	etat = (etat ^ (etat << 5)) & 0xFFFFFFFF
	return float(etat) / 4294967296.0
