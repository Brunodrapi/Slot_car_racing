## Les effets de la course, d'après js/render.js (addEffects, _layRubber, _puff) : les traces de
## gomme qui restent sur la piste, la fumée des pneus qui glissent, la poussière hors piste.
class_name Effets
extends Node2D

const RUBBER := [0.13, 0.26, 0.42]       # l'opacité des trois bandes de gomme
const MAX_FUMEE := 240
var gomme := {}                          # "x,y,bande" -> { noeud, segments }
var fumee: Array = []                    # { x, y, vx, vy, r, grow, life, life0, col }


func vide() -> void:
	for k in gomme: gomme[k].noeud.queue_free()
	gomme.clear()
	fumee.clear()


func ajoute(course: Course, dt: float) -> void:
	var roule := course.state == "racing" or course.state == "finishing"
	for car in course.cars:
		var h := car.th
		var c := car.cls
		var cs := cos(h)
		var sn := sin(h)
		var lx := cos(h + PI / 2)
		var ly := sin(h + PI / 2)
		var roue := func(w: float) -> Vector2: return Vector2(car.x - cs * c.length * 0.35 + lx * w * c.width * 0.4, car.y - sn * c.length * 0.35 + ly * w * c.width * 0.4)
		var cote: float = signf(car.beta) if car.beta != 0 else 1.0
		var surRoute: bool = roule and (not car.herbe or car.runoffAsphalt())
		var spin: float = clampf(car.patineFx, 0, 1) if surRoute else 0.0
		var slip: float = 1 - (1 - clampf(car.slide, 0, 1)) * (1 - spin * 0.85) if surRoute else 0.0
		var v := absf(car.v)
		if slip > 0.08 and v > 0.5:
			for w in [-1.0, 1.0]:
				var b: Vector2 = roue.call(w)
				_gomme(b, h, v * dt * 1.2 + 0.3, slip)
		var attendu: float = 24 * slip * slip * minf(dt, 0.1) if slip > 0.15 else 0.0
		var n := int(floor(attendu)) + (1 if randf() < fmod(attendu, 1.0) else 0)
		for i in n:
			var b: Vector2 = roue.call(-1.0 if randf() < 0.5 else 1.0)
			_bouffee(b.x - cs * 0.7 + (randf() - 0.5) * 0.7, b.y - sn * 0.7 + (randf() - 0.5) * 0.7,
				-cs * (1 + v * 0.1) - cote * lx * car.slide + (randf() - 0.5), -sn * (1 + v * 0.1) - cote * ly * car.slide + (randf() - 0.5),
				0.3 + slip * 0.4 + randf() * 0.3, 0.45 + slip * 0.4, Color8(222, 222, 226))
		if car.herbe and not car.runoffAsphalt():
			for i in 2:
				_bouffee(car.x + (randf() - 0.5) * 3, car.y + (randf() - 0.5) * 3, (randf() - 0.5) * 6, (randf() - 0.5) * 6, 1.2, 0.9, Color8(190, 160, 110))
	for p in fumee:
		p.x += p.vx * dt; p.y += p.vy * dt
		p.vx -= p.vx * dt * 1.4; p.vy -= p.vy * dt * 1.4
		p.life -= dt
		p.r += p.grow * dt
	fumee = fumee.filter(func(p): return p.life > 0)
	queue_redraw()


func _bouffee(x: float, y: float, vx: float, vy: float, r: float, vie: float, col: Color) -> void:
	if fumee.size() > MAX_FUMEE: return
	fumee.append({ x = x, y = y, vx = vx, vy = vy, r = r, grow = r * 1.1, life = vie, life0 = vie, col = col })


func _gomme(p: Vector2, a: float, l: float, glisse: float) -> void:
	var bande := 2 if glisse > 0.62 else (1 if glisse > 0.34 else 0)
	var cle := "%d,%d,%d" % [int(floor(p.x / 40)), int(floor(p.y / 40)), bande]
	if not gomme.has(cle):
		var noeud := Gomme.new()
		noeud.modulate = Color(1, 1, 1, RUBBER[bande])
		add_child(noeud)
		move_child(noeud, 0)
		gomme[cle] = { noeud = noeud }
	var g: Gomme = gomme[cle].noeud
	g.segments.append(p)
	g.segments.append(p - Vector2(cos(a), sin(a)) * l)
	if g.segments.size() > 4000: g.segments = g.segments.slice(g.segments.size() - 4000)
	g.queue_redraw()


func _draw() -> void:
	for p in fumee:
		var t: float = maxf(0, p.life) / p.life0
		var c: Color = p.col
		c.a = minf(1, t * 2.5) * 0.42
		draw_circle(Vector2(p.x, p.y), p.r, c)


class Gomme extends Node2D:
	var segments := PackedVector2Array()
	func _draw() -> void:
		if segments.size() >= 2:
			draw_multiline(segments, Color("#141414"), 0.35)
