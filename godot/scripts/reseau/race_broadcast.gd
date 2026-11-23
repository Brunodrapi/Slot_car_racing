## Le relevé de course que l'hôte tient et envoie (RaceBroadcast, js/spectator.js) : l'ordre au
## départ, l'ordre toutes les cinq secondes, la vitesse maximale de chacun, et tous les tours.
## Les invités le reçoivent avec le classement ; le jeu web en tire son analyse de course.
class_name RaceBroadcast
extends RefCounted

var history: Array = []
var maxSpeed: Array = []
var lastSample := -5.0
var initial: Array = []
var finished := false


func _init(race: Course) -> void:
	for c in race.cars: maxSpeed.append(0)
	initial = race.standings().map(func(c): return race.cars.find(c))


func sample(race: Course) -> void:
	if race.state == "countdown": return
	for i in race.cars.size():
		var c := race.cars[i]
		if not c.finished: maxSpeed[i] = maxf(float(maxSpeed[i]), c.v * 3.6)
	if race.time - lastSample >= 5 or race.state == "finished" and not finished:
		lastSample = race.time
		var row := [roundi(race.time)]
		for c in race.standings(): row.append(race.cars.find(c))
		history.append(row)
		if history.size() > 360:
			var garde := []
			for i in history.size():
				if i % 2 == 0: garde.append(history[i])
			history = garde
	finished = race.state == "finished"


func packet(race: Course) -> Dictionary:
	var laps := []
	for c in race.cars:
		var l := []
		for i in c.lapTimes.size(): l.append([c.lapTimes[i], c.lapOk[i] if i < c.lapOk.size() else true])
		laps.append(l)
	return { initial = initial, history = history, maxSpeed = maxSpeed, laps = laps }


func receive(data: Dictionary, race: Course) -> void:
	var laps = data.get("laps")
	if not (laps is Array) or laps.size() != race.cars.size(): return
	history = (data.history as Array).slice(-360) if data.get("history") is Array else []
	if data.get("initial") is Array: initial = data.initial
	if data.get("maxSpeed") is Array: maxSpeed = data.maxSpeed
	for i in laps.size():
		if not (laps[i] is Array): continue
		var t: Array[float] = []
		var ok: Array[bool] = []
		for x in (laps[i] as Array).slice(0, 999):
			if x is Array and x.size() >= 1 and (x[0] is float or x[0] is int) and float(x[0]) > 0:
				t.append(float(x[0])); ok.append(x.size() < 2 or x[1] != false)
		race.cars[i].lapTimes = t
		race.cars[i].lapOk = ok
