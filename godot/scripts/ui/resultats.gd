## Les résultats : le classement, les temps, les écarts, les pénalités et les meilleurs tours.
class_name Resultats
extends Control

var course: Course
var fond: Texture2D
var boutons: Array[Bouton] = []


func _init(c: Course) -> void:
	course = c


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	fond = load("res://images/interface/paddock.webp")
	var choix := [[Textes.t("retry"), Style.ROUGE, func(): App.aller("course")], [Textes.t("paddock"), Style.NUIT_PLEINE, func(): App.aller("paddock", { mode = App.reglages.mode })]]
	if course.netDrive != null:
		# en ligne : la table reste ouverte, et c'est l'hôte qui relance
		choix = [[Textes.t("backToTable"), Style.ROUGE, func(): App.retourTable()], [Textes.t("leaveTable"), Style.NUIT_PLEINE, func(): Reseau.net.leave(); App.enLigne = null; App.aller("accueil")]]
	for d in choix:
		var b := Bouton.new(d[0], d[1], Style.CREME, 26)
		b.centre = true
		b.pressed.connect(d[2])
		add_child(b)
		boutons.append(b)
	resized.connect(_place)
	_place()
	boutons[0].grab_focus.call_deferred()


func _unhandled_input(e: InputEvent) -> void:
	if e.is_action_pressed("ui_cancel"):
		if course.netDrive != null: App.retourTable()
		else: App.aller("paddock", { mode = App.reglages.mode })


## L'hôte continue d'envoyer le classement aux invités pendant que les résultats s'affichent.
func _process(_dt: float) -> void:
	var d = course.netDrive
	if d != null and d.host and Reseau.net.state == "playing": d.afterFrame(0.0, 0.0)


func _cadre() -> Rect2:
	var w := minf(900, size.x - 40)
	return Rect2((size.x - w) / 2, 20, w, size.y - 110)


func _place() -> void:
	var r := _cadre()
	boutons[0].size = Vector2(220, 56); boutons[0].position = Vector2(r.end.x - 220, size.y - 76)
	boutons[1].size = Vector2(200, 56); boutons[1].position = Vector2(r.end.x - 440, size.y - 76)
	queue_redraw()


func _draw() -> void:
	Style.couvre(self, fond, Rect2(Vector2.ZERO, size), 0.4)
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.08, 0.09, 0.1, 0.55))
	var r := _cadre()
	Style.biseau(self, Rect2(r.position.x, r.position.y, r.size.x, 64), Style.NUIT_PLEINE, 0)
	Style.damier(self, Rect2(r.position.x + 4, r.position.y, 70, 64), 4, Style.CREME, Style.NUIT_PLEINE)
	var p := course.player
	var titre := Textes.t("training" if course.entrainement else "timeTrial") if course.mode == "timetrial" else Textes.t("finishPos", [course.positionOf(p), course.cars.size()])
	Style.texte(self, titre, r.position + Vector2(90, 46), 38, Style.CREME)
	Style.texte(self, str(course.track.nom).to_upper(), r.position + Vector2(90, 46), 22, Style.PAPIER, HORIZONTAL_ALIGNMENT_RIGHT, r.size.x - 104)
	var y := r.position.y + 80
	var cols := [0.0, 50.0, 400.0, 520.0, 630.0, 740.0]
	var tetes := ["", Textes.t("colDriver"), Textes.t("colTime"), Textes.t("colGap"), Textes.t("colPenalty"), Textes.t("colBest")]
	for i in tetes.size():
		Style.texte(self, tetes[i], Vector2(r.position.x + 14 + cols[i], y + 18), 16, Style.PAPIER)
	y += 28
	var h := minf(40, (r.end.y - y) / maxf(1, course.results.size()))
	for res in course.results:
		var c: Voiture = res.car
		var moi := c == p
		Style.biseau(self, Rect2(r.position.x, y, r.size.x, h - 4), Style.PAPIER if moi else Color("#171b19e6"))
		var ink := Style.ENCRE if moi else Style.PAPIER
		var b := y + h / 2 + 6
		var sz := int(minf(22, h * 0.55))
		Style.texte(self, str(res.pos), Vector2(r.position.x + 18, b), sz, ink)
		draw_rect(Rect2(r.position.x + 50, y + h / 2 - 8, 12, 12), Color(Catalogue.donnees.livreries[c.livery].body))
		Style.texte(self, str(c.nom).to_upper(), Vector2(r.position.x + 70, b), sz, ink)
		Style.texte(self, str(c.cls.nom).to_upper(), Vector2(r.position.x + 70 + 130, b), int(sz * 0.75), Color(ink, 0.75), HORIZONTAL_ALIGNMENT_LEFT, 190)
		Style.texte(self, Textes.t("abandonRes") if res.get("abandon", false) else Style.temps(res.temps), Vector2(r.position.x + 14 + cols[2], b), sz, Color("#e2533f") if res.get("abandon", false) else ink)
		Style.texte(self, "+%.3f" % res.ecart if res.ecart > 0 else "", Vector2(r.position.x + 14 + cols[3], b), sz, ink)
		Style.texte(self, "+%.1f s" % res.penalite if res.penalite > 0.05 else "", Vector2(r.position.x + 14 + cols[4], b), sz, Color("#e2533f") if res.penalite > 0.05 else ink)
		Style.texte(self, Style.temps(res.meilleur), Vector2(r.position.x + 14 + cols[5], b), sz, ink)
		y += h
	# le palmarès (js/ui.js, tropheeResultat) : le trophée gagné, ou ce qui manquait
	var tr: Dictionary = App.dernierTrophee if App.derniereCourse == course else {}
	if not tr.is_empty():
		var yb := size.y - 76
		if tr.raison == "tours":
			Style.texte(self, Textes.t("tropheeTours", Palmares.TOURS_MIN), Vector2(r.position.x, yb + 34), 18, Style.PAPIER)
		elif tr.nouveau:
			draw_texture_rect(Palmares.texture(tr.rang, 56), Rect2(r.position.x, yb, 56, 56), false)
			Style.texte(self, Textes.t("tropheeNouveau", Palmares.nom(tr.rang)), Vector2(r.position.x + 64, yb + 26), 20, Style.CREME, HORIZONTAL_ALIGNMENT_LEFT, r.size.x - 520)
			var e := Mondial.nuage()
			draw_texture_rect(Palmares.nuage(e, 26), Rect2(r.position.x + 64, yb + 34, 26, 19), false)
			Style.texte(self, Textes.t("nuage_" + e), Vector2(r.position.x + 96, yb + 50), 15, Style.PAPIER)
		else:
			draw_texture_rect(Palmares.texture(tr.ancien, 28), Rect2(r.position.x, yb + 14, 28, 28), false)
			Style.texte(self, Textes.t("tropheeAcquis", Palmares.nom(tr.ancien)), Vector2(r.position.x + 34, yb + 34), 18, Style.PAPIER, HORIZONTAL_ALIGNMENT_LEFT, r.size.x - 480)
