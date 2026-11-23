## Le pilote automatique des essais : il lâche les gaz quand la vitesse dépasse ce que les virages à
## venir permettent (à 95 % de la vitesse de passage, avec 88 % du freinage). Il sert aux visites
## photographiées et aux courses en ligne des bancs d'essai, jamais au jeu.
class_name PiloteAuto
extends RefCounted


static func gaz(c: Voiture) -> bool:
	var lim := 1e9
	var d := 0.0
	while d < c.v * c.v / (2 * c.cls.brake * 0.88) + 40:
		var k := absf(c.track.lineCurv(c.s + d, c.selS))
		if k > 1e-4:
			var vc := Voiture.cornerSpeedFor(c.cls, k) * 0.95
			lim = minf(lim, sqrt(vc * vc + 2 * c.cls.brake * 0.88 * d))
		d += 3
	return c.v < lim - 0.3
