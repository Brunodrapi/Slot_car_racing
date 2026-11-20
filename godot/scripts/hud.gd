## Le tableau de bord de la course, d'après js/render.js (_drawHUD, _drawSlider,
## _drawDesktopThrottle) : la position, les chronos, le tour, le classement autour du joueur, la
## minicarte, le levier de ligne, la vitesse et ses dix segments, le GRIP, les feux de départ.
class_name Hud
extends Control

var jeu
var course: Course
var mm := {}                      # la minicarte : points, échelle, origine, taille
var go := -1.0                    # le « GO ! » qui s'efface
var flash := ""
var flashCouleur := Color.WHITE
var flashJusqua := 0.0
var pommeau := NAN
var tactile := false
var consigne := -1                # le mot du guide : gaz, dose, lâche (-1 : pas de guide)
const P := 14.0                   # la marge (this.pad)
const VIF := [Color8(94, 196, 255), Color8(82, 230, 168), Color8(255, 214, 74), Color8(190, 140, 255), Color8(255, 96, 96)]
const C_JAUNE := Color8(255, 212, 0)
const C_BLEU := Color8(80, 200, 255)
const C_IDEALE := Color8(245, 246, 250)


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	tactile = OS.has_feature("mobile") or OS.has_feature("web_android") or OS.has_feature("web_ios")


func nouvelleCourse(c: Course) -> void:
	course = c
	go = -1.0
	flash = ""
	var T := c.track
	var minX := INF
	var minY := INF
	var maxX := -INF
	var maxY := -INF
	for i in T.n:
		minX = minf(minX, T.xs[i]); maxX = maxf(maxX, T.xs[i]); minY = minf(minY, T.ys[i]); maxY = maxf(maxY, T.ys[i])
	mm = { minX = minX, minY = minY, w = maxX - minX, h = maxY - minY }


func evenements(evts: Array) -> void:
	for e in evts:
		if e.type == "go": go = 1.2
		elif e.type == "lap" and e.car == course.player and course.mode == "race" and course.player.lap == course.laps - 1:
			annonce("DERNIER TOUR", Style.LIGNE_JAUNE)


func annonce(t: String, c: Color) -> void:
	flash = t
	flashCouleur = c
	flashJusqua = Time.get_ticks_msec() / 1000.0 + 2.5


# ---------- la géométrie (js/render.js, _layoutHud) ----------
func _droite() -> bool:
	return App.reglages.cote == "right"


func _levier() -> Dictionary:
	var H := size.y
	var len := clampf(H * 0.19, 64, 160)
	return { x = size.x - P - 22 if _droite() else P + 22, y = H - P - 30 - len, len = len }


func _pause() -> Rect2:
	return Rect2(size.x - P - 2 - 44, P + 2, 44, 44)


func toucheePause(p: Vector2) -> bool:
	return _pause().grow(6).has_point(p)


func dansLevier(p: Vector2) -> bool:
	return (p.x > size.x * 0.58 if _droite() else p.x < size.x * 0.42) and p.y > size.y * 0.35


func levierVers(p: Vector2) -> float:
	var s := _levier()
	return clampf((s.y + s.len / 2 - p.y) / (s.len / 2), -1, 1)


func _mmPoint(x: float, y: float, taille: float) -> Vector2:
	var sc: float = (taille - 20) / maxf(mm.w, mm.h)
	var ox: float = 10 + ((taille - 20) - mm.w * sc) / 2
	var oy: float = 10 + ((taille - 20) - mm.h * sc) / 2
	return Vector2(ox + (x - mm.minX) * sc, oy + (y - mm.minY) * sc)


# ---------- le dessin ----------
func _draw() -> void:
	if course == null: return
	var p := course.player
	var W := size.x
	var H := size.y
	var tt := course.mode == "timetrial"
	var pos := course.positionOf(p)
	var n := course.cars.size()
	var y0 := P + 2
	var xs := P + 2
	var xe := W - P - 2
	var wPos := 120.0
	var headH := 44.0
	var pb := _pause()
	# La position
	Style.biseau(self, Rect2(xs, y0, wPos, headH), Style.PAPIER)
	Style.texte(self, "TT" if tt and not course.entrainement else "P %d/%d" % [pos, n], Vector2(xs + 10, y0 + headH / 2 + 11), 32, Style.ENCRE)
	# Les chronos
	var pw := minf(230, maxf(110, xe - xs - wPos - pb.size.x - 20))
	var px := clampf((W - pw) / 2, xs + wPos + 8, pb.position.x - pw - 8)
	var ph := 32.0
	var nul := p.lapSale
	var drapeaux := []
	if course.state != "countdown":
		var d := course.drapeauDe(p)
		if d != "": drapeaux.append(d)
		elif course.zones.size(): drapeaux.append("yellow")
		if course.chequered: drapeaux.append("chequered")
	var enTour := 0.0 if course.state == "countdown" else course.time - p.lapStart
	_chrono(px, y0, pw, ph, "TOUR NUL" if nul else "TOUR", Style.temps(enTour), true, drapeaux, nul)
	_chrono(px, y0 + ph + 4, pw, ph, "MEILLEUR", Style.temps(p.bestLap), false, [], false)
	# Le bouton de pause
	draw_rect(pb, Style.NUIT)
	var bh := roundf(pb.size.y * 0.46)
	var bw := maxf(4, roundf(pb.size.y * 0.13))
	var ec := roundf(pb.size.y * 0.1)
	var cx := pb.get_center().x
	draw_rect(Rect2(cx - ec - bw, pb.position.y + (pb.size.y - bh) / 2, bw, bh), Color("#fff0d4"))
	draw_rect(Rect2(cx + ec, pb.position.y + (pb.size.y - bh) / 2, bw, bh), Color("#fff0d4"))
	# Le tour
	var lapW := 150.0
	var lapH := 46.0
	var lapY := maxf(y0 + headH + 6, y0 + ph * 2 + 12) if px + pw > xe - lapW - 4 else y0 + headH + 6
	Style.biseau(self, Rect2(xe - lapW, lapY, lapW, lapH), Style.PAPIER)
	var num := str(p.lap + 1 if tt else mini(course.laps, p.lap + 1))
	var tot := "" if tt else "/%d" % course.laps
	var wl := Style.largeur("TOUR", 19)
	var wn := Style.largeur(num, 40)
	var wt := Style.largeur(tot, 25)
	var x := xe - lapW + maxf(8, (lapW - (wl + 6 + wn + 2 + wt)) / 2)
	var base := lapY + lapH * 0.82
	Style.texte(self, "TOUR", Vector2(x, base), 19, Style.ENCRE); x += wl + 6
	Style.texte(self, num, Vector2(x, base + 2), 40, Style.ENCRE); x += wn + 2
	if tot != "": Style.texte(self, tot, Vector2(x, base), 25, Style.ENCRE)
	# Le classement autour du joueur
	if not tt or (course.entrainement and course.state != "countdown"):
		var ordre := course.standings()
		var i0 := ordre.find(p)
		var debut := maxi(0, mini(i0 - 1, ordre.size() - 3))
		var rowH := 32.0
		var bwid := 250.0
		var bx := W - P - bwid
		var by := maxf(P + 100, lapY + lapH + 8)
		for k in range(debut, mini(debut + 3, ordre.size())):
			var c: Voiture = ordre[k]
			var yy := by + (k - debut) * rowH
			var moi := c == p
			Style.biseau(self, Rect2(bx, yy, bwid, rowH - 2), Style.PAPIER if moi else Color("#171b19df"))
			var couleur := Color("#fff8e6aa") if c.fantome else Color(Catalogue.donnees.livreries[c.livery].body)
			draw_rect(Rect2(bx + 10, yy + (rowH - 12) / 2, 10, 10), couleur)
			draw_rect(Rect2(bx + 10, yy + (rowH - 12) / 2, 10, 10), Color("#394137"), false, 1)
			var ink := Style.ENCRE if moi else Style.PAPIER
			Style.texte(self, "%d  %s" % [k + 1, str(c.nom).to_upper()], Vector2(bx + 26, yy + 22), 18, ink)
			var ecart := "TOI"
			if c.fantome:
				var e := course.ecartFantome()
				ecart = "%s%s s" % ["+" if e >= 0 else "−", _fmtEcart(absf(e))]
			elif not moi:
				var dist := absf(c.progress() - p.progress())
				var allure := p.bestLap if p.bestLap > 0 else c.bestLap
				var signe := "+" if c.progress() >= p.progress() else "−"
				ecart = "%s%.1f s" % [signe, dist / course.track.length * allure] if allure > 0 else "%s%d m" % [signe, roundi(dist)]
			Style.texte(self, ecart, Vector2(bx + bwid - 94, yy + 22), 18, ink, HORIZONTAL_ALIGNMENT_RIGHT, 80)
	# La minicarte
	var taille := minf(180, maxf(110, W * 0.18))
	var mo := Vector2(P + 2, P + 56)
	var pts := PackedVector2Array()
	var T := course.track
	for i in range(0, T.n, 6): pts.append(mo + _mmPoint(T.xs[i], T.ys[i], taille))
	pts.append(pts[0])
	draw_polyline(pts, Color(0, 0, 0, 0.55), 7, true)
	draw_polyline(pts, Color("#fff8e6"), 3.5, true)
	for c in course.cars:
		var q := mo + _mmPoint(c.x, c.y, taille)
		if c == p: continue
		# La nuit, la carte ne montre que les voitures qu'on voit (NightLighting.canSee).
		if jeu.nuit and not jeu.nuit.voit(Vector2(c.x, c.y), Vector2(p.x, p.y)): continue
		draw_circle(q, 6, Color("#fff8e6bf") if c.fantome else Color(Catalogue.donnees.livreries[c.livery].body))
	draw_circle(mo + _mmPoint(p.x, p.y, taille), 9, Color("#7fd4ff"))
	# Le levier, la vitesse
	_levierDessin(p)
	_vitesse(p)
	if consigne >= 0 and course.state != "countdown": _consigne()
	if tactile: _pouce(p)
	# Le départ
	if course.state == "countdown":
		var cnt := course.countdown
		var feux := 0 if cnt > 3.2 else (1 if cnt > 2.4 else (2 if cnt > 1.6 else (3 if cnt > 0.8 else 4)))
		var ccx := W / 2
		var ccy := H * 0.22
		Style.biseau(self, Rect2(ccx - 120, ccy - 30, 240, 60), Style.NUIT)
		for k in 4:
			draw_circle(Vector2(ccx - 75 + k * 50, ccy), 16, Color("#ff3b3b") if k < feux else Color(1, 1, 1, 0.15))
		Style.texte(self, "Doigt hors du levier pour accélérer" if tactile else "Maintiens Espace pour accélérer", Vector2(0, ccy + 58), 24, Color.WHITE, HORIZONTAL_ALIGNMENT_CENTER, W)
		Style.texte(self, "Levier à gauche : trajectoire" if tactile else "Flèches haut et bas : trajectoire   ·   manette : RT et stick", Vector2(0, ccy + 84), 16, Color("#cfd3dc"), HORIZONTAL_ALIGNMENT_CENTER, W)
	elif go > 0:
		Style.texte(self, "GO !", Vector2(0, H * 0.18 + 60), 80, Color(Color("#5be07a"), go / 1.2), HORIZONTAL_ALIGNMENT_CENTER, W)
		go -= get_process_delta_time()
	if p.herbe:
		Style.texte(self, "HORS PISTE !", Vector2(0, H * 0.3 + 30), 36, Color("#ff6b6b"), HORIZONTAL_ALIGNMENT_CENTER, W)
		if p.engineStopped: Style.texte(self, "MOTEUR COUPÉ", Vector2(0, H * 0.3 + 60), 24, Color("#ffcf5c"), HORIZONTAL_ALIGNMENT_CENTER, W)
	if p.finished and course.state != "finished":
		Style.texte(self, "ARRIVÉE — P%d" % pos, Vector2(0, H * 0.3 + 40), 52, Color("#ffd400"), HORIZONTAL_ALIGNMENT_CENTER, W)
	if flash != "" and Time.get_ticks_msec() / 1000.0 < flashJusqua:
		Style.texte(self, flash, Vector2(0, maxf(H * 0.12, 120) + 30), 32, flashCouleur, HORIZONTAL_ALIGNMENT_CENTER, W)
	# La mesure de fluidité, discrète, sous la minicarte
	var appels := Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)
	Style.texte(self, "%d i/s · pire image %.1f ms · course %.2f ms/pas · %d appels" % [Engine.get_frames_per_second(), jeu.pireImage * 1000, jeu.coutPas / 1000.0, appels],
		Vector2(P + 2, P + 56 + taille + 18), 13, Color(1, 1, 1, 0.55))


static func _fmtEcart(s: float) -> String:
	var d := roundf(s * 10) / 10
	return "%.1f" % d if d < 10 else str(roundi(s))


## Le mot du guide, au-dessus de la vitesse (js/render.js, _drawConsigne).
func _consigne() -> void:
	var L := minf(420, size.x - 32)
	var h0 := 86.0 + 6 + 38
	var x := (P if _droite() else size.x - P - L) + 80
	var y := size.y - P - h0 - 8
	var mot: String = ["GAZ", "DOSE", "LÂCHE"][consigne]
	var fond: Color = [Color("#12a35c"), Color("#171b19e6"), Color("#e0261c")][consigne]
	var taille := 20
	var h := taille + 10.0
	var w := maxf(92, Style.largeur(mot, taille) + 26)
	Style.biseau(self, Rect2(x - w / 2, y - h, w, h), fond)
	if consigne == Course.GUIDE_DOSE:
		var xx := x - w / 2 + 8
		while xx < x + w / 2 - 8:
			draw_line(Vector2(xx, y - 3), Vector2(minf(xx + 6, x + w / 2 - 8), y - 3), Color("#ff5a4a"), 2)
			xx += 11
	Style.texte(self, mot, Vector2(x - w / 2, y - h / 2 + 7), taille, Color("#ffb4a8") if consigne == Course.GUIDE_DOSE else Color("#fff8ea"), HORIZONTAL_ALIGNMENT_CENTER, w)


func _chrono(x: float, y: float, w: float, h: float, label: String, valeur: String, sombre: bool, drapeaux: Array, nul: bool) -> void:
	Style.biseau(self, Rect2(x, y, w, h), Style.NUIT if sombre else Style.PAPIER)
	var t := 10.0 if drapeaux.size() > 1 else 12.0
	for i in drapeaux.size():
		_drapeau(drapeaux[i], Vector2(x + 8 + i * (t + 3), y + (h - t) / 2), t)
	var ink := (Color("#ffb59c") if nul else Color("#fff0d4")) if sombre else Color("#33372e")
	var lw := drapeaux.size() * (t + 3)
	if w - 24 - Style.largeur(valeur, 24) - lw > 36:
		Style.texte(self, label, Vector2(x + 11 + lw, y + h / 2 + 6), 16, Color("#f6eacf") if sombre else Color("#34392f"))
	Style.texte(self, valeur, Vector2(x, y + h / 2 + 8), 24, ink, HORIZONTAL_ALIGNMENT_RIGHT, w - 12)


func _drapeau(type: String, p: Vector2, s: float) -> void:
	var c := Color("#3b82f6") if type == "blue" else (Color("#e9be37") if type == "yellow" else Color("#f5f3e8"))
	draw_rect(Rect2(p, Vector2(s, s)), c)
	if type == "penalty":
		draw_colored_polygon(PackedVector2Array([p, p + Vector2(s, 0), p + Vector2(0, s)]), Color("#171a1d"))
	elif type == "chequered":
		var k := s / 4
		for r in 4:
			for q in 4:
				if (r + q) % 2 == 0: draw_rect(Rect2(p + Vector2(q * k, r * k), Vector2(k, k)), Color("#171a1d"))
	draw_rect(Rect2(p, Vector2(s, s)), Color(1, 1, 1, .85), false, 1)


func _levierDessin(p: Voiture) -> void:
	var s := _levier()
	var crans := [[1.0, C_JAUNE, "JAUNE"], [0.0, C_IDEALE, "IDÉALE"], [-1.0, C_BLEU, "BLEUE"]]
	var cote := -1.0 if _droite() else 1.0
	var lx: float = s.x + 19 * cote
	var larg := Style.largeur("IDÉALE", 15)
	var hFond: float = s.len + 52
	var biseau := minf(9, hFond * .23)
	var gauche: float = s.x - (19 + larg + 7) if _droite() else s.x - 22
	Style.biseau(self, Rect2(gauche - biseau / 2, s.y - 26, 22 + 19 + larg + 7 + biseau, hFond), Color("#171b19da"))
	var yCran := func(v: float) -> float: return s.y + s.len / 2 - v * s.len / 2
	draw_rect(Rect2(s.x - 3.5, yCran.call(1.0), 7, yCran.call(-1.0) - yCran.call(1.0)), Color("#05070a"))
	var choisi := roundi(clampf(p.sel, -1, 1))
	for c in crans:
		var y: float = yCran.call(c[0])
		draw_circle(Vector2(s.x, y), 10, Color("#05070a"))
		draw_arc(Vector2(s.x, y), 6.5, 0, TAU, 24, c[1], 3.0 if choisi == int(c[0]) else 2.0, true)
		if _droite(): Style.texte(self, c[2], Vector2(lx - 80, y + 5), 15, Color.WHITE if choisi == int(c[0]) else Style.GRIS, HORIZONTAL_ALIGNMENT_RIGHT, 80)
		else: Style.texte(self, c[2], Vector2(lx, y + 5), 15, Color.WHITE if choisi == int(c[0]) else Style.GRIS)
	var cible: float = yCran.call(float(choisi))
	if is_nan(pommeau): pommeau = cible
	pommeau += (cible - pommeau) * (1 - exp(-get_process_delta_time() * 1000 / 30))
	var rgb := C_JAUNE if choisi > 0 else (C_BLEU if choisi < 0 else C_IDEALE)
	draw_circle(Vector2(s.x, pommeau), 13, rgb)
	draw_arc(Vector2(s.x, pommeau), 13, 0, TAU, 32, Color(0.05, 0.05, 0.09, 0.85), 2, true)
	# La position réelle de la voiture entre les lignes : un petit trait.
	var ys: float = yCran.call(clampf(p.selS, -1, 1))
	draw_line(Vector2(s.x - 16, ys), Vector2(s.x - 10, ys), Color(1, 1, 1, 0.6), 2)


func _vitesse(p: Voiture) -> void:
	var L := minf(420, size.x - 32)
	var bloc := 150.0
	var hBloc := 86.0
	var hautB := 18.0
	var basB := 66.0
	var hGrip := 38.0
	var h := hBloc + 6 + hGrip
	var x := P if _droite() else size.x - P - L
	var y := size.y - P - h
	var fond := Color("#1b1f23e8")
	var forme := PackedVector2Array([Vector2(x + 16, y), Vector2(x + bloc - 6, y), Vector2(x + bloc + 14, y + hautB), Vector2(x + L, y + hautB),
		Vector2(x + L - 10, y + basB), Vector2(x + bloc + 58, y + basB), Vector2(x + bloc + 42, y + hBloc), Vector2(x, y + hBloc)])
	draw_colored_polygon(forme, fond)
	var ferme := forme.duplicate(); ferme.append(forme[0])
	draw_polyline(ferme, Color(1, 1, 1, 0.12), 1.5, true)
	var kmh := roundi(maxf(0, p.speed()) * 3.6)
	var case3 := Style.largeur("888", 64)
	Style.texte(self, str(kmh), Vector2(x + 22, y + 66), 64, Color.WHITE, HORIZONTAL_ALIGNMENT_RIGHT, case3)
	Style.texte(self, "km/h", Vector2(x + 26 + case3, y + hBloc - 8), 18, Color("#c8ced9"))
	var N := 10
	var x0 := x + bloc + 22
	var x1 := x + L - 22
	var sy := y + hautB + 9
	var sh := basB - hautB - 18
	var pas := (x1 - x0) / N
	var sw := pas - 5
	var penche := 6.0
	var part := clampf(maxf(0, p.speed()) / maxf(1, p.cls.vmax), 0, 1) * N
	var gazOn := p.throttle > 0
	for i in N:
		var sx := x0 + i * pas
		var seg := PackedVector2Array([Vector2(sx + penche, sy), Vector2(sx + sw + penche, sy), Vector2(sx + sw, sy + sh), Vector2(sx, sy + sh)])
		draw_colored_polygon(seg, Color("#383e44"))
		var allume := clampf(part - i, 0, 1)
		if allume <= 0: continue
		var c := (Color("#62f0e6") if i == 0 else Color("#52e6a8")) if gazOn else Color("#ff6e5a")
		c.a = 0.25 + 0.75 * allume
		draw_colored_polygon(seg, c)
	var x5 := clampf(p.ressenti, 0, 1) * 4
	var k := mini(3, int(x5))
	var cGrip: Color = VIF[k].lerp(VIF[k + 1], x5 - k)
	var yG := y + hBloc + 6
	var lG := 128.0
	draw_colored_polygon(PackedVector2Array([Vector2(x + 12, yG), Vector2(x + lG, yG), Vector2(x + lG - 12, yG + hGrip), Vector2(x, yG + hGrip)]), fond)
	draw_circle(Vector2(x + 30, yG + hGrip / 2), 13, Color(cGrip, 0.25))
	draw_circle(Vector2(x + 30, yG + hGrip / 2), 9, cGrip)
	Style.texte(self, "GRIP", Vector2(x + 50, yG + hGrip / 2 + 9), 25, cGrip)


## L'accélérateur au doigt : un disque translucide, sans rien à lire (js/render.js, _drawPouce).
func _pouce(p: Voiture) -> void:
	var r := clampf(minf(size.x * 0.12, size.y * 0.08), 32, 60)
	var c := Vector2(size.x / 2, size.y - P - r)
	var x5 := clampf(p.ressenti, 0, 1) * 4
	var k := mini(3, int(x5))
	var col: Color = VIF[k].lerp(VIF[k + 1], x5 - k)
	col.a = 0.32 if p.throttle > 0 else 0.18
	draw_circle(c, r * (0.94 if p.throttle > 0 else 1.0), col)
