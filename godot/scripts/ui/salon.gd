## Le multijoueur (js/ui.js, lobbyScreen) : ouvrir une table, rejoindre celle d'un autre par son
## code à quatre lettres, ou la regarder ; puis, à la table, qui est là, ce que l'on court, sa
## voiture, « prêt », et le départ que l'hôte donne. Les tables sont celles du jeu web : un joueur
## dans le navigateur et un joueur Godot s'y assoient ensemble.
class_name Salon
extends Control

const CATS := ["all", "gt3", "gt", "proto", "f1"]
const DIFFS := ["easy", "medium", "hard", "extreme", "cauchemar"]

var fond: Texture2D
var net: Net
var code: LineEdit
var boutons := {}
var k := 1.0
var etatVu := ""


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	fond = load("res://images/interface/paddock.webp")
	net = Reseau.net
	net.onPeers = func() -> void: if is_inside_tree(): _maj()
	code = LineEdit.new()
	code.max_length = 4
	code.placeholder_text = "ABCD"
	code.alignment = HORIZONTAL_ALIGNMENT_CENTER
	code.add_theme_font_size_override("font_size", 30)
	code.text_changed.connect(func(t): var p := code.caret_column; code.text = t.to_upper(); code.caret_column = p)
	code.text_submitted.connect(func(_t): _ouvre(false))
	add_child(code)
	_b("retour", Textes.t("back"), Style.NUIT_PLEINE, Style.CREME, func(): _retour())
	_b("ouvrir", Textes.t("createTable"), Style.ROUGE, Style.CREME, func(): _ouvre(true))
	_b("rejoindre", Textes.t("joinTable"), Style.JAUNE, Style.ENCRE, func(): _ouvre(false))
	_b("regarder", Textes.t("watch"), Style.NUIT_PLEINE, Style.CREME, func(): _ouvre(false, true))
	_b("format", "", Style.NUIT_PLEINE, Style.CREME, func(): _tourne("mode", Net.NET_MODES))
	_b("heure", "", Style.NUIT_PLEINE, Style.CREME, func(): net.setTable({ timeOfDay = "day" if net.settings().get("timeOfDay") == "night" else "night" }))
	_b("cat", "", Style.NUIT_PLEINE, Style.CREME, func(): _tourne("cat", CATS))
	_b("circuitM", "‹", Style.NUIT_PLEINE, Style.CREME, func(): _circuit(-1))
	_b("circuitP", "›", Style.NUIT_PLEINE, Style.CREME, func(): _circuit(1))
	_b("tours", "", Style.NUIT_PLEINE, Style.CREME, func(): net.setTable({ laps = int(net.settings().get("laps", 3)) % 10 + 1 }))
	_b("diff", "", Style.NUIT_PLEINE, Style.CREME, func(): _tourne("difficulty", DIFFS))
	_b("voitureM", "‹", Style.NUIT_PLEINE, Style.CREME, func(): _voiture(-1))
	_b("voitureP", "›", Style.NUIT_PLEINE, Style.CREME, func(): _voiture(1))
	_b("role", "", Style.NUIT_PLEINE, Style.CREME, func(): net.setMine({ spectator = not net.mine.get("spectator", false), ready = false }); net.pump())
	_b("pret", "", Style.JAUNE, Style.ENCRE, func(): _pret(not net.mine.get("ready", false)))
	_b("depart", Textes.t("startRace"), Style.ROUGE, Style.CREME, func(): net.start())
	# la version Steam : inviter un ami par Steam plutôt que de lui dicter le code
	_b("inviter", Textes.t("inviteFriend"), Style.BLEU, Style.CREME, func(): if net.room is SalleSteam: net.room.invite())
	resized.connect(_place)
	_maj()


func _b(nom: String, t: String, f: Color, e: Color, action: Callable) -> void:
	var b := Bouton.new(t, f, e, 22)
	b.centre = true
	b.pressed.connect(action)
	add_child(b)
	boutons[nom] = b


func _unhandled_input(e: InputEvent) -> void:
	if e.is_action_pressed("ui_cancel"): _retour()


func _retour() -> void:
	if net.state != "off": net.leave()
	net.onPeers = func() -> void: pass
	App.aller("accueil")


func _ouvre(hote: bool, spectateur := false) -> void:
	if net.busy: return
	var ok := await net.open(str(App.reglages.nom), hote, code.text, spectateur)
	if not is_inside_tree(): return
	if ok:
		if hote:
			# la table part avec les réglages du joueur
			var c := String(App.reglages.circuit)
			net.setTable({ trackId = c, laps = _tours(c), difficulty = String(App.reglages.difficulte),
				timeOfDay = "night" if App.reglages.get("nuit", false) else "day" })
		_voitureNet()
		_pret(false)
	_maj()


## Rejoindre la table d'un ami (l'invitation de Steam donne son code).
func rejoins(c: String) -> void:
	code.text = c
	_ouvre(false)


func _tours(circuit: String) -> int:
	var meta = JSON.parse_string(FileAccess.get_file_as_string("res://donnees/circuits/%s.json" % circuit))
	return int(meta.get("tours", 3)) if meta is Dictionary else 3


func _tourne(cle: String, liste: Array) -> void:
	var i := liste.find(net.settings().get(cle, liste[0]))
	net.setTable({ cle: liste[(i + 1) % liste.size()] })


func _circuit(sens: int) -> void:
	var ids: Array = Catalogue.circuits().map(func(c): return c.id)
	var i := ids.find(net.settings().get("trackId", ids[0]))
	var id: String = ids[(i + sens + ids.size()) % ids.size()]
	net.setTable({ trackId = id, laps = _tours(id) })


## Les voitures permises par la table : sa catégorie, ou toutes.
func _modeles() -> Array:
	var cat := String(net.settings().get("cat", "all"))
	return Catalogue.donnees.voitures if cat == "all" or cat == "" else Catalogue.voituresDe(cat)


func _voiture(sens: int) -> void:
	var l := _modeles()
	var i := l.map(func(v): return v.id).find(App.reglages.voiture)
	var v: Dictionary = l[(i + sens + l.size()) % l.size()]
	App.reglages.voiture = v.id
	App.reglages.cat = v.cat
	App.sauve()
	_voitureNet()
	_maj()


## La voiture part avec sa livrée : les autres écrans la dessinent (ui.js, _netCar).
func _voitureNet() -> void:
	net.setMine({ car = { modelId = String(App.reglages.voiture), livree = int(App.reglages.livree) } })


func _pret(v: bool) -> void:
	if v: _voitureNet()
	net.setMine({ ready = v })


func _maj() -> void:
	var t := net.settings()
	# Une table réservée à une catégorie : la voiture change d'elle-même, et le pilote repasse
	# « pas prêt » pour voir ce qu'on a changé sous lui.
	var cat := String(t.get("cat", "all"))
	if net.state == "lobby" and cat != "all" and cat != "" and Catalogue.voiture(App.reglages.voiture).get("cat") != cat:
		var l := Catalogue.voituresDe(cat)
		if l.size():
			App.reglages.voiture = l[0].id
			_voitureNet()
			net.setMine({ ready = false })
	var dansTable := net.state != "off"
	for n in ["ouvrir", "rejoindre", "regarder"]: boutons[n].visible = not dansTable
	code.visible = not dansTable
	for n in ["format", "heure", "cat", "circuitM", "circuitP", "tours", "diff", "voitureM", "voitureP", "pret", "depart", "role", "inviter"]:
		boutons[n].visible = dansTable
	boutons.retour.libelle(Textes.t("leaveTable") if dansTable else Textes.t("back"))
	if dansTable:
		var hote := net.creator
		for n in ["format", "heure", "cat", "circuitM", "circuitP", "tours", "diff"]: boutons[n].disabled = not hote
		boutons.format.libelle(Textes.t("mFormat", Textes.t({ race = "mRace", duel = "mDuel", ghost = "mGhost" }.get(t.get("mode", "race"), "mRace"))))
		boutons.heure.libelle(Textes.t("dayNight", Textes.t("night" if t.get("timeOfDay") == "night" else "day")))
		boutons.cat.libelle(Textes.t("mCat", Textes.t("all") if cat == "all" or cat == "" else Textes.nom(_nomCat(cat)).to_upper()))
		boutons.tours.libelle(Textes.t("laps", int(t.get("laps", 3))))
		boutons.diff.libelle(Textes.t("difficulty", Textes.t(String(t.get("difficulty", "medium")))))
		boutons.pret.libelle(Textes.t("notReady") if net.mine.get("ready", false) else Textes.t("ready"))
		boutons.pret.disabled = net.mine.get("spectator", false)
		boutons.depart.visible = hote
		boutons.depart.disabled = not net.canStart()
		boutons.role.visible = not hote
		boutons.inviter.visible = net.room is SalleSteam
		boutons.role.libelle(Textes.t("becomeDriver") if net.mine.get("spectator", false) else Textes.t("becomeSpectator"))
	if etatVu != net.state:
		etatVu = net.state
		(boutons.ouvrir if not dansTable else boutons.pret).grab_focus.call_deferred()
	_place()


func _nomCat(id: String):
	for c in Catalogue.categories():
		if c.id == id: return c.nom
	return id


func _place() -> void:
	var portrait := size.x < size.y
	k = minf(size.x / 1280.0, size.y / 720.0) if not portrait else size.x / 700.0
	var x := 40 * k
	var w := size.x - 2 * x
	boutons.retour.position = Vector2(x, 20 * k); boutons.retour.size = Vector2(260 * k, 46 * k); boutons.retour.taille = int(20 * k)
	if net.state == "off":
		var y := 300 * k
		var bw := minf(520 * k, w)
		boutons.ouvrir.position = Vector2(x, y); boutons.ouvrir.size = Vector2(bw, 64 * k); boutons.ouvrir.taille = int(28 * k)
		y += 90 * k
		code.position = Vector2(x, y); code.size = Vector2(150 * k, 60 * k)
		code.add_theme_font_size_override("font_size", int(30 * k))
		boutons.rejoindre.position = Vector2(x + 164 * k, y); boutons.rejoindre.size = Vector2(170 * k, 60 * k); boutons.rejoindre.taille = int(24 * k)
		boutons.regarder.position = Vector2(x + 348 * k, y); boutons.regarder.size = Vector2(170 * k, 60 * k); boutons.regarder.taille = int(22 * k)
	else:
		var colG := Rect2(x, 140 * k, (w * 0.46) if not portrait else w, 0)
		var xr := x + w * 0.5 if not portrait else x
		var wr := w * 0.5 if not portrait else w
		var y := 140 * k if not portrait else 140 * k + 330 * k
		var h := 46 * k
		var g := 8 * k
		for n in ["format", "heure", "cat"]:
			boutons[n].position = Vector2(xr, y); boutons[n].size = Vector2(wr, h); boutons[n].taille = int(19 * k); y += h + g
		boutons.circuitM.position = Vector2(xr, y); boutons.circuitM.size = Vector2(56 * k, h)
		boutons.circuitP.position = Vector2(xr + wr - 56 * k, y); boutons.circuitP.size = Vector2(56 * k, h)
		y += h + g
		boutons.tours.position = Vector2(xr, y); boutons.tours.size = Vector2(wr * 0.49, h); boutons.tours.taille = int(19 * k)
		boutons.diff.position = Vector2(xr + wr * 0.51, y); boutons.diff.size = Vector2(wr * 0.49, h); boutons.diff.taille = int(19 * k)
		y += h + g * 3
		boutons.voitureM.position = Vector2(xr, y); boutons.voitureM.size = Vector2(56 * k, h)
		boutons.voitureP.position = Vector2(xr + wr - 56 * k, y); boutons.voitureP.size = Vector2(56 * k, h)
		y += h + g * 3
		boutons.pret.position = Vector2(xr, y); boutons.pret.size = Vector2(wr * 0.4, 56 * k); boutons.pret.taille = int(22 * k)
		boutons.depart.position = Vector2(xr + wr * 0.44, y); boutons.depart.size = Vector2(wr * 0.56, 56 * k); boutons.depart.taille = int(24 * k)
		boutons.role.position = Vector2(colG.position.x, 140 * k + 8 * 44 * k + 20 * k)
		boutons.role.size = Vector2(minf(colG.size.x, 320 * k), 44 * k); boutons.role.taille = int(17 * k)
		boutons.inviter.position = boutons.role.position + Vector2(0, 52 * k)
		boutons.inviter.size = boutons.role.size; boutons.inviter.taille = int(17 * k)
	queue_redraw()


func _draw() -> void:
	Style.couvre(self, fond, Rect2(Vector2.ZERO, size), 0.4)
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.06, 0.07, 0.08, 0.66))
	var portrait := size.x < size.y
	var x := 40 * k
	var w := size.x - 2 * x
	var titre := Textes.t("multi") if net.state == "off" else Textes.t("yourTable", net.code)
	Style.texte(self, titre, Vector2(x + 280 * k, 58 * k), int(40 * k), Style.CREME)
	if net.state == "off":
		_paragraphe(Textes.t("multiIntro"), Vector2(x, 120 * k), minf(900 * k, w), int(20 * k))
		Style.texte(self, Textes.t("tableCode") + " · " + Textes.t("codeHint"), Vector2(x, 380 * k), int(15 * k), Style.PAPIER)
		var msg := ""
		if net.busy: msg = Textes.t("netWait")
		elif net.error != "": msg = Textes.netErreur(net.error)
		Style.texte(self, msg, Vector2(x, 500 * k), int(22 * k), Color("#ffb4a2") if net.error != "" and not net.busy else Style.CREME)
		return
	var t := net.settings()
	var m := net.members()
	var pilotes := m.filter(func(e): return not e.q.get("spectator", false))
	var lien := net.link.label() if net.link else ""
	Style.texte(self, "%s · %s" % [lien, Textes.t("roundTrip")], Vector2(x + 280 * k, 92 * k), int(16 * k), Style.PAPIER)
	if net.error != "": Style.texte(self, Textes.netErreur(net.error), Vector2(x, 120 * k), int(18 * k), Color("#ffb4a2"))
	if m.any(func(e): return not e.q.get("spectator", false) and int(e.q.get("protocol", 0)) != Net.DRIVE_PROTOCOL):
		Style.texte(self, Textes.t("reloadAll"), Vector2(x, 120 * k), int(16 * k), Color("#ffb4a2"))
	# les pilotes
	var lw := (w * 0.46) if not portrait else w
	var y := 140 * k
	Style.texte(self, Textes.t("players", [pilotes.size(), Net.NET_SEATS, Textes.t("spectatorsN", m.size() - pilotes.size())]), Vector2(x, y - 8 * k), int(18 * k), Style.PAPIER)
	for i in m.size():
		var e: Dictionary = m[i]
		var r := Rect2(x, y + 6 * k, lw, 40 * k)
		Style.biseau(self, r, Style.PAPIER if e.isMe else Color("#171b19e6"))
		var ink := Style.ENCRE if e.isMe else Style.CREME
		var tags := []
		if i == 0: tags.append(Textes.t("hostTag"))
		if e.isMe: tags.append(Textes.t("youTag"))
		if i > 0 and net.link:
			var p = net.link.ping(e.pid)
			tags.append("%s ms" % ("—" if p == null else str(p)))
		Style.texte(self, str(e.name).to_upper(), r.position + Vector2(14 * k, 27 * k), int(20 * k), ink, HORIZONTAL_ALIGNMENT_LEFT, lw * 0.45)
		Style.texte(self, " · ".join(tags), r.position + Vector2(lw * 0.47, 27 * k), int(14 * k), Color(ink, 0.8))
		var etat := Textes.t("spectatorTag") if e.q.get("spectator", false) else ("✓ " + Textes.t("ready") if e.ready else Textes.t("waiting"))
		var car = e.car
		if car is Dictionary and not e.q.get("spectator", false):
			var v := Catalogue.voiture(String(car.get("modelId", "")))
			if not v.is_empty(): etat = Textes.nom(v.nom) + " · " + etat
		Style.texte(self, etat, r.position + Vector2(0, 27 * k), int(14 * k), Color("#37d67a") if e.ready else Color(ink, 0.75), HORIZONTAL_ALIGNMENT_RIGHT, lw - 14 * k)
		y += 44 * k
	# ce que l'on court
	var xr := x + w * 0.5 if not portrait else x
	var wr := w * 0.5 if not portrait else w
	var bc: Bouton = boutons.circuitM
	var circuit := String(t.get("trackId", ""))
	var nomC := circuit
	for c in Catalogue.circuits():
		if c.id == circuit: nomC = Textes.nom(c.nom)
	Style.biseau(self, Rect2(xr + 60 * k, bc.position.y, wr - 120 * k, bc.size.y), Color("#171b19e6"))
	Style.texte(self, nomC.to_upper(), Vector2(xr, bc.position.y + 31 * k), int(21 * k), Style.CREME, HORIZONTAL_ALIGNMENT_CENTER, wr)
	var mode := String(t.get("mode", "race"))
	Style.texte(self, Textes.t({ race = "mRaceDesc", duel = "mDuelDesc", ghost = "mGhostDesc" }.get(mode, "mRaceDesc")), Vector2(x, size.y - 24 * k), int(16 * k), Style.PAPIER)
	var bv: Bouton = boutons.voitureM
	var v := Catalogue.voiture(App.reglages.voiture)
	Style.biseau(self, Rect2(xr + 60 * k, bv.position.y, wr - 120 * k, bv.size.y), Color("#171b19e6"))
	Style.texte(self, Textes.nom(v.get("nom", "")).to_upper(), Vector2(xr, bv.position.y + 31 * k), int(21 * k), Style.CREME, HORIZONTAL_ALIGNMENT_CENTER, wr)
	Style.texte(self, Textes.t("mCatOpen") if t.get("cat", "all") == "all" else Textes.t("mCatDesc"), Vector2(xr, bv.position.y - 10 * k), int(13 * k), Style.PAPIER, HORIZONTAL_ALIGNMENT_LEFT, wr)
	if not net.creator:
		Style.texte(self, Textes.t("startWhenReady"), Vector2(xr + wr * 0.44, boutons.pret.position.y + 34 * k), int(17 * k), Style.PAPIER)


func _paragraphe(t: String, p: Vector2, largeur: float, taille: int) -> void:
	var police := Style.racing()
	var mots := t.split(" ")
	var ligne := ""
	var y := p.y
	for m in mots:
		var essai := (ligne + " " + m).strip_edges()
		if police.get_string_size(essai, HORIZONTAL_ALIGNMENT_LEFT, -1, taille).x > largeur and ligne != "":
			Style.texte(self, ligne, Vector2(p.x, y), taille, Style.CREME)
			y += taille * 1.35
			ligne = m
		else:
			ligne = essai
	if ligne != "": Style.texte(self, ligne, Vector2(p.x, y), taille, Style.CREME)
