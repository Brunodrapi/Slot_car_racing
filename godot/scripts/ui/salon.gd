## Le multijoueur, à l'identique de l'écran du jeu web (js/ui.js, lobbyScreen ; css/style.css,
## .lobby-entry, .lobby-screen, .selection-screen) : une colonne qui défile, sous le bandeau du
## paddock.
##
##   - l'entrée : le texte, le lien Discord, puis le cadre crème — « Ouvrir une table », le code,
##     « Rejoindre », « Regarder » ;
##   - à la table : le ping, les cartes des pilotes, le lien Discord tant qu'on est seul, le format,
##     le jour ou la nuit, la catégorie (des boutons à choix), l'aperçu de la voiture et du circuit,
##     la rangée des circuits, celle des voitures, et la barre du bas — Prêt, Départ !
##
## Les tables sont celles du jeu web : un joueur dans le navigateur et un joueur Godot s'y assoient
## ensemble. Dans la version Steam, « Inviter un ami » s'ajoute à côté du lien Discord.
class_name Salon
extends Control

const CATS := ["all", "f1", "gt", "gt3", "proto"]
const DISCORD := "https://discord.gg/XpMp2kZVbA"      # DISCORD_JOUEURS_URL
# Les couleurs de css/style.css (.selection-screen, .lobby-entry, .lien-discord)
const ROUGE_SEL := Color("#bb2b26")
const CARTE_SEL := Color("#fff5df")
const BORD_SEL := Color("#ba2924")
const PANNEAU := Color("#e5d6b8")
const PANNEAU_BORD := Color("#ab9d81")
const MUET := Color("#5e6055")
const TITRE := Color("#262b26")
const BLEU_DISCORD := Color("#5865f2")
const VERT := Color("#2d8a4e")
const M := 20.0                    # la marge

var net: Net
var cadre: Control
var fond: Texture2D
var infos: Dictionary
var code: LineEdit
var portrait := false
var W := 1280.0
var hauteur := 720.0
var defile := 0.0
var debutCircuits := 0
var debutVoitures := 0
var _signature := ""
var _suivre := true                # la prochaine construction montre le circuit et la voiture choisis
var _circuitVu := ""
var z := {}                        # les rectangles de la mise en page, pour le dessin
var doigt: Doigt                   # au téléphone : les glissés de la page et des rails


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	fond = load("res://images/interface/paddock.webp")
	infos = Paddock.infosCircuits()
	Paddock.precharge()
	net = Reseau.net
	cadre = Control.new()
	cadre.draw.connect(_dessine)
	add_child(cadre)
	doigt = Doigt.new(cadre, _defile)
	code = LineEdit.new()
	code.max_length = 4
	code.placeholder_text = "A B C D"
	code.set_meta("garde", true)
	code.alignment = HORIZONTAL_ALIGNMENT_CENTER
	var lu := StyleBoxFlat.new()
	lu.bg_color = Color("#fff6e2"); lu.border_color = Color("#7d806d"); lu.set_border_width_all(1)
	code.add_theme_stylebox_override("normal", lu)
	code.add_theme_stylebox_override("focus", lu)
	code.add_theme_color_override("font_color", TITRE)
	code.add_theme_color_override("font_placeholder_color", Color(TITRE, 0.45))
	code.add_theme_font_size_override("font_size", 24)
	code.text_changed.connect(func(t): var p := code.caret_column; code.text = t.to_upper(); code.caret_column = p)
	code.text_submitted.connect(func(_t): _ouvre(false))
	cadre.add_child(code)
	net.onPeers = func() -> void: if is_inside_tree(): _maj()
	get_viewport().gui_focus_changed.connect(_suitFocus)
	resized.connect(func(): _signature = ""; _maj())
	_maj()


func _exit_tree() -> void:
	if get_viewport().gui_focus_changed.is_connected(_suitFocus): get_viewport().gui_focus_changed.disconnect(_suitFocus)
	# la table continue sans cet écran (la course, les résultats) : il ne doit plus être appelé
	net.onPeers = func() -> void: pass


# ---------------------------------------------------------------- les actions

func _unhandled_input(e: InputEvent) -> void:
	if e.is_action_pressed("ui_cancel"): _retour()


func _retour() -> void:
	if net.state != "off": net.leave()
	net.onPeers = func() -> void: pass
	App.aller("accueil")


func _ouvre(hote: bool, spectateur := false) -> void:
	if net.busy: return
	_signature = ""; _maj()                    # « Connexion… » tout de suite
	var ok := await net.open(str(App.reglages.nom), hote, code.text, spectateur)
	if not is_inside_tree(): return
	if ok:
		if hote:
			var c := String(App.reglages.circuit)
			net.setTable({ trackId = c, laps = _tours(c) })
		_voitureNet()
		_pret(false)
	_signature = ""
	_maj()


## Rejoindre la table d'un ami (l'invitation de Steam donne son code).
func rejoins(c: String) -> void:
	code.text = c
	_ouvre(false)


func _tours(circuit: String) -> int:
	return int(infos.get(circuit, {}).get("tours", 3))


func _livreeDe(id: String) -> int:
	return int(App.reglages.livree) if id == App.reglages.voiture else 0


## Choisir une voiture, ou faire tourner la livrée de celle qui est déjà choisie (_choisitOuTourne).
func _voiture(id: String) -> void:
	if id == App.reglages.voiture:
		var n: int = maxi(1, (Catalogue.voiture(id).livrees as Array).size())
		App.reglages.livree = (int(App.reglages.livree) + 1) % n
	else:
		App.reglages.voiture = id
		App.reglages.cat = Catalogue.voiture(id).cat
		App.reglages.livree = 0
		_suivre = true
	App.sauve()
	_voitureNet()
	_maj()


## La voiture part avec sa livrée : les autres écrans la dessinent (ui.js, _netCar).
func _voitureNet() -> void:
	net.setMine({ car = { modelId = String(App.reglages.voiture), livree = int(App.reglages.livree) } })


func _pret(v: bool) -> void:
	if v: _voitureNet()
	net.setMine({ ready = v })


## Les voitures permises par la table : sa catégorie, ou toutes.
func _modeles() -> Array:
	var cat := String(net.settings().get("cat", "all"))
	return Catalogue.donnees.voitures if cat == "all" or cat == "" else Catalogue.voituresDe(cat)


# ---------------------------------------------------------------- la mise à jour

func _maj() -> void:
	var t := net.settings()
	# Une table réservée à une catégorie : la voiture change d'elle-même, et le pilote repasse
	# « pas prêt » pour voir ce qu'on a changé sous lui.
	var cat := String(t.get("cat", "all"))
	if net.state == "lobby" and cat != "all" and cat != "" and Catalogue.voiture(App.reglages.voiture).get("cat") != cat:
		var l := Catalogue.voituresDe(cat)
		if l.size():
			App.reglages.voiture = l[0].id; App.reglages.livree = 0
			_voitureNet()
			net.setMine({ ready = false })
	var circuit := String(Championnat.manche(t.get("championnat", {})).get("circuit", t.get("trackId", "")))
	if circuit != _circuitVu:
		_circuitVu = circuit; _suivre = true
	# Les boutons ne se refont que si ce qu'ils montrent a changé ; le reste se redessine.
	var pilotes := net.members().filter(func(m): return not m.q.get("spectator", false)).size()
	var s := JSON.stringify([net.state, net.busy, net.creator, t.get("mode"), t.get("timeOfDay"), t.get("degats"), cat, t.get("trackId"),
		net.mine.get("ready"), net.mine.get("spectator"), App.reglages.voiture, App.reglages.livree, net.canStart(),
		pilotes, t.get("laps"), t.get("aiCount"), t.get("championnat"), t.get("programme"), ReglageFrein.active(_circuitVu, App.reglages.voiture).get("nom"), debutCircuits, debutVoitures, size, net.members().size(), _suivre])
	if s != _signature:
		_signature = s
		_construit()
	cadre.queue_redraw()


func _b(t: String, r: Rect2, f: Color, e: Color, taille: int, action: Callable, cle: String, parent: Control = null) -> Bouton:
	var b := Bouton.new(t, f, e, taille)
	if cle == "heurenight" and Catalogue.voiture(App.reglages.voiture).get("cat") == "f1":
		b.fond = ROUGE_SEL
		b.encre = Color.WHITE
	b.position = r.position
	b.size = r.size
	b.centre = true
	b.pressed.connect(action)
	b.set_meta("cle", cle)
	(parent if parent else cadre).add_child(b)
	return b


func _choix(choix: Array, actuel: String, rect: Rect2, actif: bool, action: Callable, prefixe: String) -> float:
	var x := rect.position.x
	var y := rect.position.y
	for c in choix:
		var w := minf(rect.size.x, Style.largeur(c[1], 18) + 26)
		if x > rect.position.x and x + w > rect.end.x:
			x = rect.position.x
			y += 38
		var sel: bool = c[0] == actuel
		var b := _b(c[1], Rect2(x, y, w, 34), VERT if sel else Style.NUIT_PLEINE, Color.WHITE if sel else Style.CREME, 18,
			func(): action.call(c[0]), prefixe + str(c[0]))
		b.disabled = not actif
		if sel or b.get_meta("cle") == "heurenight": b.set_meta("fane", true)
		x += w + 5
	return y + 40


func _paddockTable(y: float) -> float:
	var cadrePiste := Control.new()
	var marge := 6 if portrait else int(M)
	cadrePiste.position = Vector2(marge, y)
	cadrePiste.size = Vector2(W - 2 * marge, 1240 if portrait else 535)
	cadre.add_child(cadrePiste)
	var paddock := Paddock.new("multi")
	paddock.defileExterne.connect(_defile)
	cadrePiste.add_child(paddock)
	return y + cadrePiste.size.y + 8


func _compteur(titre: String, valeur: String, rect: Rect2, cle: String, moins: Callable, plus: Callable, minAtteint: bool, maxAtteint: bool) -> void:
	var x := rect.position.x
	var y := rect.position.y
	var w := rect.size.x
	var editable: bool = net.creator and net.settings().get("championnat", {}).is_empty()
	var label := Label.new()
	label.text = titre
	label.position = Vector2(x, y)
	label.size = Vector2(w - 160, 36)
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", 17)
	cadre.add_child(label)
	var gauche := _b("−", Rect2(x + w - 152, y, 40, 36), Style.NUIT_PLEINE, Style.CREME, 22, moins, cle + "-")
	gauche.disabled = not editable or minAtteint
	var capsule := _b(valeur, Rect2(x + w - 107, y, 62, 36), VERT, Color.WHITE, 19, func(): pass, cle + "-valeur")
	capsule.disabled = true
	capsule.set_meta("fane", true)
	var droite := _b("+", Rect2(x + w - 40, y, 40, 36), Style.NUIT_PLEINE, Style.CREME, 22, plus, cle + "+")
	droite.disabled = not editable or maxAtteint


# Les paramètres de grille appartiennent à la table. Le frein appartient au pilote.
func _optionsPilote(t: Dictionary, pilotes: int, y: float, x: float, largeur: float) -> float:
	if t.get("mode", "race") == "race":
		var tours := int(t.get("laps", 3))
		var championnat: bool = not t.get("programme", {}).get("circuits", []).is_empty()
		if Style.tactile():
			var label := Label.new()
			label.text = Textes.t("lapsLabel")
			label.position = Vector2(x, y + 4)
			label.add_theme_color_override("font_color", TITRE)
			cadre.add_child(label)
			var menu := Style.menuNombre(1, 10, tours, "", championnat or not net.creator or not net.settings().get("championnat", {}).is_empty(), func(v): net.setTable({laps = v}))
			menu.position = Vector2(x + largeur - 90, y)
			menu.set_meta("cle", "tours")
			cadre.add_child(menu)
			y += 8
		else:
			_compteur(Textes.t("lapsLabel"), str(tours), Rect2(x, y, largeur, 36), "tours",
				func(): net.setTable({ laps = tours - 1 }), func(): net.setTable({ laps = tours + 1 }), championnat or tours <= 1, championnat or tours >= 10)
		y += 41
		var maxiIA := maxi(0, 12 - mini(pilotes, Net.NET_SEATS))
		var ia := clampi(int(t.get("aiCount", -1)), -1, maxiIA)
		var valeur := "Auto" if ia < 0 else str(ia)
		_compteur(Textes.t("opponentsLabel"), valeur, Rect2(x, y, largeur, 36), "adversaires",
			func(): net.setTable({ aiCount = ia - 1 }), func(): net.setTable({ aiCount = ia + 1 }), ia <= -1, ia >= maxiIA)
		y += 41
	if not net.mine.get("spectator", false):
		var circuit := String(Championnat.manche(t.get("championnat", {})).get("circuit", t.get("trackId", "monza")))
		var voiture := String(App.reglages.voiture)
		var cfg := ReglageFrein.active(circuit, voiture)
		var valeur := Paddock._coupe(str(cfg.get("nom", Textes.t("regDefaut"))), 17, largeur - 150) + Paddock.LISTE
		var b := _b("", Rect2(x, y, largeur, 36), Style.NUIT_PLEINE, Style.CREME, 19,
			func(): ReglageFrein.suivante(circuit, voiture); App.sauve(); _maj(), "freinage")
		b.dessinPlus = Paddock._pastille.bind(b, Textes.t("freinage"), valeur, 17)
		y += 41
	return y


func _parametres(t: Dictionary, pilotes: int, y: float, manche: Dictionary) -> float:
	var x := 14.0 if portrait else M
	var total := 362.0 if portrait else W - 2 * M
	var largeur := total - 24 if portrait else (total - 48) / 2
	var haut := y
	x += 12
	y += 12
	var libre := manche.is_empty()
	var editable := net.creator and libre
	var mode := String(t.get("mode", "race"))
	z.formatTitre = Vector2(x, y + 15)
	y = _choix([["race", Textes.t("mRaceSeg")], ["duel", Textes.t("mDuelSeg")], ["ghost", Textes.t("mGhostSeg")]], mode,
		Rect2(x, y + 20, largeur, 0), editable, func(id): net.setTable({ mode = id }), "mode")
	y = _optionsPilote(t, pilotes, y + 2, x, minf(largeur, 380))
	var bas := y
	if not portrait:
		x += largeur + 24
		y = haut + 12
	z.degatsTitre = Vector2(x, y + 15)
	y = _choix([["1", Textes.t("on")], ["0", Textes.t("off")]], "1" if t.get("degats", false) == true else "0",
		Rect2(x, y + 20, largeur, 0), editable, func(id): net.setTable({ degats = id == "1" }), "degats")
	if t.get("timeOfDay") == "night":
		var f1: bool = Catalogue.voiture(App.reglages.voiture).get("cat") == "f1"
		z.nuitDesc = [Vector2(x, y + 12), Paddock._lignes(Textes.t("nightF1Hint" if f1 else "nightHint"), 15, largeur), ROUGE_SEL if f1 else MUET]
		y += 8 + 17 * z.nuitDesc[1].size()
	if not libre:
		var phase := String(manche.phase)
		var nomCircuit: String = infos.get(manche.circuit, {}).get("nom", manche.circuit)
		var prochain := _b(Textes.t("courseSession" if phase == "course" else phase) + " · " + nomCircuit,
			Rect2(x, y + 3, minf(largeur, 380), 38), VERT, Color.WHITE, 19, func(): pass, "session")
		prochain.disabled = true
		prochain.set_meta("fane", true)
		y += 44
		if net.creator:
			_b(Textes.t("annulerChampionnat"), Rect2(x, y, minf(largeur, 380), 38), Style.NUIT_PLEINE, Style.CREME, 19,
				func(): net.setTable({ championnat = {} }), "annulerChampionnat")
			y += 44
	elif mode in ["race", "duel"]:
		var actif := Championnat.actif(t.get("programme", {}))
		_b(Textes.t("championnat"), Rect2(x, y + 3, minf(largeur, 260), 38), VERT if actif else Style.NUIT_PLEINE, Style.ENCRE if actif else Style.CREME, 19,
			func(): App.aller("programme"), "programme")
		y += 44
	y = maxf(y, bas) + 12
	z.options = Rect2(14 if portrait else M, haut, total, y - haut)
	return y + 12


func _dessineOptions(ci: CanvasItem) -> void:
	var panneau: Rect2 = z.options
	ci.draw_rect(panneau, Style.PAPIER)
	ci.draw_rect(panneau, PANNEAU_BORD, false, 1)
	for cle in [["formatTitre", "mFormatTitle"], ["degatsTitre", "chipDegats"]]:
		Style.texte(ci, Textes.t(cle[1]), z[cle[0]], 15, TITRE)
	if z.has("nuitDesc"):
		var note: Array = z.nuitDesc
		var p: Vector2 = note[0]
		for i in note[1].size(): Style.texte(ci, note[1][i], p + Vector2(0, 17 * i), 15, note[2])


func _construit() -> void:
	var focus := get_viewport().gui_get_focus_owner()
	var cle: String = focus.get_meta("cle", "") if focus and cadre.is_ancestor_of(focus) else ""
	for c in cadre.get_children():
		if not c.has_meta("garde"): c.queue_free()
	portrait = size.x < size.y
	z = {}
	if portrait:
		_construitTel(cle)
		return
	W = 1280.0
	code.alignment = HORIZONTAL_ALIGNMENT_CENTER
	code.add_theme_font_size_override("font_size", 24)
	var t := net.settings()
	var dansTable := net.state != "off"
	# Le bandeau
	_b(Textes.t("leaveTable") if dansTable else Textes.t("back"), Rect2(M, 10, 200, 64), Style.NUIT_PLEINE, Style.CREME, 20, _retour, "retour")
	var y := 92.0
	code.visible = not dansTable
	if not dansTable:
		z.intro = Vector2(M + 12, y + 18)
		y += _hauteurTexte(Textes.t("multiIntro"), W - 2 * M - 24, 17) + 20
		_b(Textes.t("discordPlayers"), Rect2(M, y, 360, 46), BLEU_DISCORD, Color.WHITE, 18, func(): OS.shell_open(DISCORD), "discord")
		y += 62
		var hp := 104.0 if not portrait else 176.0
		z.panneau = Rect2(M, y, W - 2 * M, hp)
		_b(Textes.t("createTable"), Rect2(M + 24, y + 24, 290, 58), ROUGE_SEL, CARTE_SEL, 28, func(): _ouvre(true), "ouvrir").disabled = net.busy
		var cx := M + 340.0 if not portrait else M + 24.0
		var cy := y + 22.0 if not portrait else y + 96.0
		z.etiquette = Vector2(cx, cy + 4)
		code.position = Vector2(cx, cy + 14); code.size = Vector2(150, 46)
		_b(Textes.t("joinBtn"), Rect2(cx + 164, cy + 14, 140, 46), Style.NUIT_PLEINE, Style.CREME, 20, func(): _ouvre(false), "rejoindre").disabled = net.busy
		_b(Textes.t("watchBtn"), Rect2(cx + 314, cy + 14, 140, 46), Style.NUIT_PLEINE, Style.CREME, 20, func(): _ouvre(false, true), "regarder").disabled = net.busy
		y += hp + 18
		z.message = Vector2(M, y + 18)
		y += 40
	else:
		var m := net.members()
		var pilotes := m.filter(func(e): return not e.q.get("spectator", false))
		z.ping = Vector2(M, y + 14)
		y += 32
		z.joueursTitre = Vector2(M, y + 14)
		y += 24
		var parLigne := maxi(1, floori((W - 2 * M + 8) / 158.0))
		z.cartes = Rect2(M, y, W - 2 * M, 0)
		y += ceili(maxf(1, m.size()) / float(parLigne)) * 84.0 + 6
		var xb := M
		if pilotes.size() < 2:
			_b(Textes.t("discordPlayers"), Rect2(xb, y, 360, 46), BLEU_DISCORD, Color.WHITE, 18, func(): OS.shell_open(DISCORD), "discord")
			xb += 372
		if net.room is SalleSteam or (net.room is SallePont and net.room.steam.open):
			_b(Textes.t("inviteFriend"), Rect2(xb, y, 250, 46), Style.BLEU, Style.CREME, 18, func(): net.room.invite(), "inviter")
			xb += 262
		if xb > M: y += 58
		if not net.creator:
			_b(Textes.t("becomeDriver") if net.mine.get("spectator", false) else Textes.t("becomeSpectator"), Rect2(M, y, 300, 44), Style.NUIT_PLEINE, Style.CREME, 18,
				func(): net.setMine({ spectator = not net.mine.get("spectator", false), ready = false }); net.pump(), "role")
			y += 56
		var cat := String(t.get("cat", "all")) if t.get("cat") else "all"
		var manche := Championnat.manche(t.get("championnat", {}))
		y = _paddockTable(y)
		y = _parametres(t, pilotes.size(), y, manche)
		# La barre du bas
		z.barre = Rect2(M, y, W - 2 * M, 92)
		var pret: bool = net.mine.get("ready", false)
		var xr := W - M - (290.0 if net.creator else 24.0)
		var bp := _b(Textes.t("notReady") if pret else Textes.t("ready"), Rect2(xr - 170, y + 18, 160, 56), Style.NUIT_PLEINE if pret else ROUGE_SEL, CARTE_SEL, 30,
			func(): _pret(not net.mine.get("ready", false)), "pret")
		bp.disabled = net.mine.get("spectator", false)
		if net.creator:
			var bd := _b(Textes.t("startRace"), Rect2(W - M - 280, y + 18, 256, 56), ROUGE_SEL, CARTE_SEL, 34, func(): net.start(), "depart")
			bd.disabled = not net.canStart()
		else:
			z.attendre = Vector2(xr - 190, y + 54)
		y += 118
	hauteur = maxf(720.0, y)
	var k := size.x / W if portrait else minf(size.x / W, size.y / 720.0)
	cadre.scale = Vector2(k, k)
	cadre.size = Vector2(W, hauteur)
	cadre.position.x = (size.x - W * k) / 2
	_defile(0)
	_rendFocus(cle)


## Le focus revient où il était (la manette et le clavier ne perdent pas leur place). Au doigt, pas de
## cadre jaune : le jeu web n'en montre qu'au clavier et à la manette.
func _rendFocus(cle: String) -> void:
	if portrait and Style.tactile(): return
	var cible: Control = null
	for c in cadre.find_children("*", "Control", true, false):
		if c.is_queued_for_deletion() or not (c is Control) or not c.visible: continue
		if c.get_meta("cle", "") == cle and cle != "": cible = c
	if cible == null:
		# en arrivant : le premier bouton sous le bandeau, pour que l'écran parte du haut
		for c in cadre.get_children():
			if c.is_queued_for_deletion() or not (c is BaseButton) or c.disabled or c.position.y < 90: continue
			if cible == null or c.position.y < cible.position.y or (c.position.y == cible.position.y and c.position.x < cible.position.x): cible = c
	if cible and not (cible is BaseButton and cible.disabled): cible.grab_focus.call_deferred()


## Où commence une rangée de `n` cartes (pas `pas`, écart `ecart`), centrée entre ses deux flèches.
func _rangee(n: int, pas: float, ecart: float) -> float:
	var large := 34.0 + n * pas - ecart + 34.0
	return M + (W - 2 * M - large) / 2 + 34.0


## La pastille ✓ de la carte choisie (.card.sel::after).
func _pastille(b: Bouton) -> void:
	if not b.choisi: return
	var c := Vector2(b.size.x - 16, 16)
	b.draw_circle(c, 10, Color("#c82e27"))
	b.draw_polyline(PackedVector2Array([c + Vector2(-5, 0), c + Vector2(-1, 4), c + Vector2(5, -4)]), Color("#fff8e7"), 2.5)


func _carteCircuit(b: Bouton) -> void:
	Paddock._carteCircuit(b)
	_pastille(b)


## La carte d'une voiture : celle du paddock, plus le repère de livrée du jeu web (« 1/3 Nom »).
func _carteVoiture(b: Bouton) -> void:
	Paddock._carteVoiture(b)
	_pastille(b)
	var c: Dictionary = b.get_meta("voiture")
	var l: Array = c.livrees
	if l.size() > 1:
		var i := _livreeDe(c.id) % l.size()
		Style.texte(b, "%d/%d  %s" % [i + 1, l.size(), Textes.livree(l[i])], Vector2(0, b.size.y - 34), 12, Color(Style.ENCRE, 0.8), HORIZONTAL_ALIGNMENT_CENTER, b.size.x)


# ---------------------------------------------------------------- le défilement

func _input(e: InputEvent) -> void:
	if e is InputEventMouseButton and e.pressed and (e.button_index == MOUSE_BUTTON_WHEEL_DOWN or e.button_index == MOUSE_BUTTON_WHEEL_UP):
		_defile(60.0 if e.button_index == MOUSE_BUTTON_WHEEL_DOWN else -60.0)
	elif portrait:
		doigt.entree(e)
	elif e is InputEventScreenDrag:
		_defile(-e.relative.y / cadre.scale.y)


func _process(dt: float) -> void:
	if portrait: doigt.avance(dt)


func _defile(d: float) -> void:
	defile = clampf(defile + d, 0, maxf(0, hauteur - size.y / cadre.scale.y))
	cadre.position.y = -defile * cadre.scale.y


## La manette et le clavier font défiler jusqu'au bouton qu'ils prennent.
func _suitFocus(c: Control) -> void:
	if c == null or not cadre.is_ancestor_of(c): return
	# seulement au clavier et à la manette : une carte touchée du doigt ne fait pas sauter la page
	if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) or doigt.actif(): return
	doigt.montre(c)
	var vue := size.y / cadre.scale.y
	var haut := (cadre.get_global_transform().affine_inverse() * c.get_global_transform().origin).y
	if haut < defile + 90: _defile(haut - 90 - defile)
	elif haut + c.size.y > defile + vue - 20: _defile(haut + c.size.y - (defile + vue - 20))


# ---------------------------------------------------------------- le dessin

func _draw() -> void:
	# au téléphone, du papier (css/style.css sous 850 px) ; sur ordinateur, le paddock
	if size.x < size.y: draw_rect(Rect2(Vector2.ZERO, size), Paddock.T_FOND)
	else: Style.couvre(self, fond, Rect2(Vector2.ZERO, size), 0.5)


func _dessine() -> void:
	if portrait:
		_dessineTel()
		return
	var ci := cadre
	var dansTable := net.state != "off"
	# Le bandeau du paddock : retour, damier, le titre dans la bande rouge, le logo.
	Style.biseau(ci, Rect2(M, 10, W - 2 * M, 64), Style.NUIT_PLEINE, 0)
	Style.damier(ci, Rect2(222, 10, 80, 64), 4, Style.CREME, Style.NUIT_PLEINE, 0)
	var titre := Textes.t("multi") if not dansTable else Textes.t("yourTable", " ".join(net.code.split("")))
	var lt := Style.largeur(titre, 38) + 60
	Style.biseau(ci, Rect2(296, 10, lt, 64), Style.ROUGE, 22)
	Style.texte(ci, titre, Vector2(320, 58), 38, Style.CREME)
	var logo := Style.tex("res://images/interface/logo-slotless.webp")
	if not portrait:
		var lh := 52.0
		var lw := lh * logo.get_width() / logo.get_height()
		ci.draw_texture_rect(logo, Rect2(W - 20 - lw, 16, lw, lh), false)
	if not dansTable:
		# le texte d'introduction sur son fond, comme le panneau : posé sur la photo du paddock, il ne
		# se lisait pas (surtout en portrait, où il passe sur les projecteurs)
		var hi := _hauteurTexte(Textes.t("multiIntro"), W - 2 * M - 24, 17)
		ci.draw_rect(Rect2(M, z.intro.y - 18, W - 2 * M, hi + 12), PANNEAU)
		ci.draw_rect(Rect2(M, z.intro.y - 18, W - 2 * M, hi + 12), PANNEAU_BORD, false, 1)
		_paragraphe(Textes.t("multiIntro"), z.intro, W - 2 * M - 24, 17, MUET)
		var p: Rect2 = z.panneau
		ci.draw_rect(p, PANNEAU)
		ci.draw_rect(p, PANNEAU_BORD, false, 1)
		Style.texte(ci, Textes.t("tableCodeLabel"), z.etiquette, 14, TITRE)
		var msg := ""
		var c := TITRE
		if net.busy: msg = Textes.t("netWait")
		elif net.error != "": msg = Textes.netErreur(net.error); c = Color("#b3261e")
		Style.texte(ci, msg, z.message, 20, c)
		return
	var t := net.settings()
	var m := net.members()
	var pilotes := m.filter(func(e): return not e.q.get("spectator", false))
	Style.texte(ci, "%s · %s" % [net.link.label() if net.link else "Ping : —", Textes.t("roundTrip")], z.ping, 15, MUET)
	if net.error != "": Style.texte(ci, Textes.netErreur(net.error), z.ping + Vector2(420, 0), 15, Color("#b3261e"))
	if not net.grilleCompatible(t) or m.any(func(e): return not e.q.get("spectator", false) and int(e.q.get("protocol", 0)) != Net.DRIVE_PROTOCOL):
		Style.texte(ci, Textes.t("reloadAll"), z.ping + Vector2(420, 0), 15, Color("#b3261e"))
	var ns := m.size() - pilotes.size()
	# un spectateur, deux spectateurs ; en anglais, zéro spectators
	var pluriel := ns > 1 if Textes.langue() == "fr" else ns != 1
	_titre(Textes.t("playersTitle", [pilotes.size(), Net.NET_SEATS, Textes.t("spectatorMany" if pluriel else "spectatorOne", ns)]), z.joueursTitre)
	# Les cartes des pilotes
	var parLigne := maxi(1, floori((W - 2 * M + 8) / 158.0))
	for i in m.size():
		var e: Dictionary = m[i]
		var r := Rect2(z.cartes.position.x + (i % parLigne) * 158, z.cartes.position.y + (i / parLigne) * 84, 150, 76)
		ci.draw_rect(r, CARTE_SEL if e.isMe else Style.PAPIER)
		ci.draw_rect(r, BORD_SEL if e.isMe else PANNEAU_BORD, false, 2 if e.isMe else 1)
		Style.texte(ci, str(e.name), r.position + Vector2(12, 24), 16, TITRE, HORIZONTAL_ALIGNMENT_LEFT, r.size.x - 20)
		var tags := []
		if i == 0: tags.append(Textes.t("hostTag"))
		if e.isMe: tags.append(Textes.t("youTag"))
		if i > 0 and net.link:
			var p = net.link.ping(e.pid)
			tags.append("%s ms" % ("—" if p == null else str(p)))
		Style.texte(ci, " · ".join(tags), r.position + Vector2(12, 44), 12, MUET)
		var etat := Textes.t("spectatorTag") if e.q.get("spectator", false) else ("✓ " + Textes.t("readyTag") if e.ready else Textes.t("waiting"))
		Style.texte(ci, etat, r.position + Vector2(12, 64), 12, VERT if e.ready else MUET)
	var info: Dictionary = infos.get(_circuitVu, infos.values()[0])
	_dessineOptions(ci)
	# La barre du bas
	var b: Rect2 = z.barre
	ci.draw_rect(b, PANNEAU)
	ci.draw_rect(b, PANNEAU_BORD, false, 1)
	var dr := Style.drapeau(info.pays)
	if dr: ci.draw_texture_rect(dr, Rect2(b.position.x + 18, b.position.y + 38, 22, 15), false)
	var v := Catalogue.voiture(App.reglages.voiture)
	Style.texte(ci, "%s · %s" % [Textes.nom(info.nom), Textes.nom(v.get("nom", ""))], b.position + Vector2(48, 51), 15, TITRE)
	if z.has("attendre"):
		var at := Textes.t("startWhenReady")
		Style.texte(ci, at, Vector2(z.attendre.x - Style.largeur(at, 15), z.attendre.y), 15, MUET)


func _titre(t: String, p: Vector2) -> void:
	Style.texte(cadre, t.to_upper(), p, 15, TITRE)


## L'aperçu de la voiture (selectionPreview) : son nom, sa catégorie et sa livrée, sur le paddock.
func _apercuVoiture(ci: CanvasItem, r: Rect2) -> void:
	var v := Catalogue.voiture(App.reglages.voiture)
	var l: Array = v.livrees
	var li := _livreeDe(v.id) % maxi(1, l.size())
	ci.draw_rect(Rect2(r.position + Vector2(3, 3), r.size), Color(0, 0, 0, 0.25))
	Style.couvre(ci, fond, Rect2(r.position + Vector2(0, 92), r.size - Vector2(0, 92)), 0.62)
	ci.draw_rect(Rect2(r.position, Vector2(r.size.x, 92)), CARTE_SEL)
	ci.draw_rect(r, Style.NUIT_PLEINE, false, 2)
	var cat := ""
	for c in Catalogue.categories():
		if c.id == v.cat: cat = Textes.nom(c.nom).to_upper()
	Style.texte(ci, str(v.nom).to_upper(), r.position + Vector2(20, 56), 46, TITRE, HORIZONTAL_ALIGNMENT_LEFT, r.size.x - 30)
	Style.texte(ci, "%s · %s" % [cat, Textes.livree(l[li]).to_upper()], r.position + Vector2(20, 80), 15, Color(TITRE, 0.85))
	var d := Catalogue.dessin(v.id, li)
	if d.get("vignette"):
		var tex := Style.tex("res://images/vignettes/" + d.vignette)
		var h := minf(r.size.y - 112, 190)
		var w := h * tex.get_width() / tex.get_height()
		ci.draw_texture_rect(tex, Rect2(r.position.x + (r.size.x - w) / 2, r.end.y - h - 10, w, h), false)


## L'aperçu du circuit : son nom, son pays et sa longueur, son drapeau, son image et son tracé.
func _apercuCircuit(ci: CanvasItem, r: Rect2, info: Dictionary) -> void:
	ci.draw_rect(Rect2(r.position + Vector2(3, 3), r.size), Color(0, 0, 0, 0.25))
	ci.draw_rect(r, CARTE_SEL)
	ci.draw_rect(r, Style.NUIT_PLEINE, false, 2)
	Style.texte(ci, str(info.nom).to_upper(), r.position + Vector2(14, 52), 40, TITRE, HORIZONTAL_ALIGNMENT_LEFT, r.size.x - 100)
	Style.texte(ci, "%s · %d M" % [Textes.pays(info.pays).to_upper(), roundi(info.longueur)], r.position + Vector2(14, 78), 15, Color(TITRE, 0.85))
	var dr := Style.drapeau(info.pays)
	if dr: ci.draw_texture_rect(dr, Rect2(r.end.x - 76, r.position.y + 14, 58, 40), false)
	var ir := Rect2(r.position.x + 2, r.position.y + 92, r.size.x - 4, r.size.y - 94)
	Style.couvre(ci, info.image, ir, 0.5)
	Paddock._contour(ci, info, ir.grow(-24))


func _hauteurTexte(t: String, largeur: float, taille: int) -> float:
	return _lignes(t, largeur, taille).size() * taille * 1.4


func _lignes(t: String, largeur: float, taille: int) -> Array:
	var police := Style.racing()
	var lignes := []
	var ligne := ""
	for mot in t.split(" "):
		var essai := (ligne + " " + mot).strip_edges()
		if police.get_string_size(essai, HORIZONTAL_ALIGNMENT_LEFT, -1, taille).x > largeur and ligne != "":
			lignes.append(ligne); ligne = mot
		else: ligne = essai
	if ligne != "": lignes.append(ligne)
	return lignes


func _paragraphe(t: String, p: Vector2, largeur: float, taille: int, c: Color) -> void:
	var y := p.y
	for l in _lignes(t, largeur, taille):
		Style.texte(cadre, l, Vector2(p.x, y), taille, c)
		y += taille * 1.4


# =====================================================================================================
# AU TÉLÉPHONE : la page du jeu web sur un iPhone (390 de large), mesurée bloc par bloc (js/ui.js,
# lobbyScreen ; css/style.css sous 850 px) : un point du cadre vaut un pixel CSS. La page défile au
# doigt ; les circuits et les voitures défilent de côté, dans leurs rails.
# =====================================================================================================
const T_PAPIER := Color("#fff0d2")
const T_CARTE := Color("#eee3cc")
const T_BORD := Color("#b6aa91")
const T_SOMBRE := Color("#222825")
const T_PETIT := Color("#555d50")


## Un titre de section (h3) : en capitales espacées.
static func _h3(ci: CanvasItem, t: String, p: Vector2, c := TITRE) -> float:
	return Paddock._espace(ci, t.to_upper(), p, 15, c, 1.5)


func _construitTel(cle: String) -> void:
	W = 390.0
	var k := size.x / W
	cadre.scale = Vector2(k, k)
	cadre.position.x = 0
	doigt.rails.clear()
	var t := net.settings()
	var dansTable := net.state != "off"
	code.visible = not dansTable
	if not dansTable:
		var br := _b("", Rect2(14, 12, 73, 64), Color(0, 0, 0, 0), BarreTitre.TEXTE, 14, _retour, "retour")
		br.coupe = 0
		br.dessinPlus = BarreTitre.retourTel.bind(br)
		z.intro = Paddock._lignes(Textes.t("multiIntro"), 16, 362)
		var y := 108.0 + 19.2 * (z.intro as PackedStringArray).size() + 32
		_discordTel(y)
		y += 48 + 16
		z.panneau = Rect2(14, y, 362, 286)
		var wo := Style.largeur(Textes.t("createTable"), 34) + 76
		var bo := _b(Textes.t("createTable"), Rect2(39, y + 25, wo, 67), Color("#d22620"), Color("#fff2da"), 34, func(): _ouvre(true), "ouvrir")
		bo.coupe = wo * 0.06
		bo.disabled = net.busy
		z.etiquette = Vector2(39, y + 116 + 15.6)
		code.position = Vector2(39, y + 143)
		code.size = Vector2(150, 44)
		code.add_theme_font_size_override("font_size", 20)
		code.alignment = HORIZONTAL_ALIGNMENT_LEFT
		for d in [[Textes.t("joinBtn"), Vector2(213, y + 137), func(): _ouvre(false), "rejoindre"], [Textes.t("watchBtn"), Vector2(39, y + 211), func(): _ouvre(false, true), "regarder"]]:
			var w := Style.largeur(d[0], 17) + 42
			var b := _b(d[0], Rect2(d[1], Vector2(w, 50)), T_SOMBRE, Color("#f9efd9"), 17, d[2], d[3])
			b.coupe = 0
			b.disabled = net.busy
			b.dessinPlus = Salon._bordTel.bind(b)
		y += 286 + 16
		z.message = Vector2(14, y + 15.6)
		hauteur = y + 40
	else:
		var m := net.members()
		var pilotes := m.filter(func(e): return not e.q.get("spectator", false))
		var br := _b("", Rect2(14, 12, 34, 64), Color(0, 0, 0, 0), BarreTitre.TEXTE, 14, _retour, "retour")
		br.coupe = 0
		br.dessinPlus = func(): BarreTitre.fleche(br, Vector2(22, 33), Vector2(13, 33), BarreTitre.TEXTE, 1.4, 3.5)
		var y := 92.0
		z.ping = y
		y += 24 + 24
		z.joueursTitre = y
		y += 18 + 20
		z.cartes = y
		y += ceili(maxf(1, m.size()) / 2.0) * 89.0 - 10
		var xb := 14.0
		if pilotes.size() < 2:
			_discordTel(y + 16)
			y += 16 + 48
		if net.room is SalleSteam or (net.room is SallePont and net.room.steam.open):
			var wi := Style.largeur(Textes.t("inviteFriend"), 18) + 44
			var bi := _b(Textes.t("inviteFriend"), Rect2(xb, y + 16, wi, 48), Style.BLEU, Style.CREME, 18, func(): net.room.invite(), "inviter")
			bi.coupe = wi * 0.04
			y += 16 + 48
		if not net.creator:
			var tr := Textes.t("becomeDriver") if net.mine.get("spectator", false) else Textes.t("becomeSpectator")
			var wr := Style.largeur(tr, 18) + 44
			var bs := _b(tr, Rect2(14, y + 16, wr, 44), T_SOMBRE, Color("#f9efd9"), 18,
				func(): net.setMine({ spectator = not net.mine.get("spectator", false), ready = false }); net.pump(), "role")
			bs.coupe = wr * 0.08
			y += 16 + 44
		# Le format
		y += 24
		var cat := String(t.get("cat", "all")) if t.get("cat") else "all"
		var manche := Championnat.manche(t.get("championnat", {}))
		y = _paddockTable(y)
		y = _parametres(t, pilotes.size(), y + 16, manche)
		# La barre du bas : Prêt, et pour l'hôte Départ !
		y += 26
		var pret: bool = net.mine.get("ready", false)
		var tp := Textes.t("notReady") if pret else Textes.t("ready")
		var wp := Style.largeur(tp, 38) + 80
		var bp := _b(tp, Rect2(359 - wp, y + 17, wp, 58), T_SOMBRE if pret else Color("#d22620"), Color("#fff2da"), 38,
			func(): _pret(not net.mine.get("ready", false)), "pret")
		bp.coupe = wp * 0.06
		bp.disabled = net.mine.get("spectator", false)
		var hb := 16 + 58 + 16 + 2.0
		if net.creator:
			var td := Textes.t("startRace")
			var wd := Style.largeur(td, 38) + 80
			var bd := _b(td, Rect2(359 - wd, y + 87, wd, 58), Color("#d22620"), Color("#fff2da"), 38, func(): net.start(), "depart")
			bd.coupe = wd * 0.06
			bd.disabled = not net.canStart()
			if bd.disabled:
				# un bouton éteint du jeu web : à demi transparent, sans s'assombrir
				bd.set_meta("fane", true)
				bd.modulate = Color(1, 1, 1, 0.45)
			hb += 70
		else:
			z.attendre = y + 87 + 15
			hb += 30
		z.barre = Rect2(14, y, 362, hb)
		hauteur = y + hb + 20
	cadre.size = Vector2(W, hauteur)
	_defile(0)
	_rendFocus(cle)


static func PC_ENCRE() -> Color:
	return Color("#262c26")


## Le lien Discord du jeu web (.lien-discord) : bleu Discord, penché, la bulle et le texte.
func _discordTel(y: float) -> void:
	var tx := Textes.t("discordPlayers")
	var w := 16 + 28 + 10 + Style.largeur(tx, 18) + 22
	var b := _b("", Rect2(14, y, w, 48), BLEU_DISCORD, Color.WHITE, 18, func(): OS.shell_open(DISCORD), "discord")
	b.coupe = w * 0.04
	b.dessinPlus = func():
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color.WHITE
		sb.set_corner_radius_all(4)
		b.draw_style_box(sb, Rect2(19, 15, 22, 15))
		b.draw_colored_polygon(PackedVector2Array([Vector2(22, 29), Vector2(29, 29), Vector2(22, 34)]), Color.WHITE)
		for cx in [25.0, 30.0, 35.0]: b.draw_circle(Vector2(cx, 22.5), 1.9, BLEU_DISCORD)
		Style.texte(b, tx, Vector2(54, 30.75), 18, Color.WHITE)


## Les boutons à choix du téléphone (.seg) : 44 de haut, penchés, qui passent à la ligne. Rend le bas.
## Le liseré d'un bouton du panneau (button.big : bord de 1, sans biseau).
static func _bordTel(b: Bouton) -> void:
	b.draw_rect(Rect2(Vector2(0.5, 0.5), b.size - Vector2(1, 1)), Color("#494a40"), false, 1)


static func _carteCircuitTel(b: Bouton) -> void:
	var info: Dictionary = Paddock.infosCircuits()[b.get_meta("circuit")]
	var sel: bool = b.get_meta("sel", false)
	if sel: b.draw_rect(Rect2(Vector2.ZERO, b.size), CARTE_SEL)
	var art := Rect2(10, 12, 88, 88)
	Style.couvre(b, info.image, art, 0.5)
	Paddock._contour(b, info, art.grow(-8), true, 3.8)
	var nom := Paddock._coupe(str(info.nom).to_upper(), 17, 88)
	Style.texte(b, nom, Vector2(0, 120.4), 17, PC_ENCRE(), HORIZONTAL_ALIGNMENT_CENTER, b.size.x)
	var dr := Style.drapeau(info.pays)
	var txt := "%d m" % roundi(info.longueur)
	var w := 20.0 + Style.largeur(txt, 13)
	var x := (b.size.x - w) / 2
	if dr: b.draw_texture_rect(dr, Rect2(x, 130.5, 17, 12), false)
	Style.texte(b, txt, Vector2(x + 20, 141.3), 13, T_PETIT)
	b.draw_rect(Rect2(Vector2(1, 1), b.size - Vector2(2, 2)), BORD_SEL if sel else T_BORD, false, 2)
	if sel:
		b.draw_rect(Rect2(2, b.size.y - 6, b.size.x - 4, 4), BORD_SEL)
		Paddock._coche(b, Vector2(b.size.x - 17, 17))


static func _carteVoitureTel(b: Bouton, avecCat: bool) -> void:
	var c: Dictionary = b.get_meta("voiture")
	var sel: bool = b.get_meta("sel", false)
	if sel: b.draw_rect(Rect2(Vector2.ZERO, b.size), CARTE_SEL)
	var li := int(b.get_meta("livree", 0))
	var d := Catalogue.dessin(c.id, li)
	if d.get("vignette"):
		var tex := Style.tex("res://images/vignettes/" + d.vignette)
		var e := minf(116.0 / tex.get_width(), 87.0 / tex.get_height())
		var t := Vector2(tex.get_width(), tex.get_height()) * e
		b.draw_texture_rect(tex, Rect2(Vector2(10 + (116 - t.x) / 2, 12 + (87 - t.y) / 2), t), false)
	var lignes := Paddock._lignes(str(c.nom).to_upper(), 17, 116)
	for i in lignes.size():
		Style.texte(b, lignes[i], Vector2(0, 103 + 20 * i + 16.4), 17, PC_ENCRE(), HORIZONTAL_ALIGNMENT_CENTER, b.size.x)
	var y := 103 + 20.0 * lignes.size() + 6
	if avecCat:
		var tag := str(c.cat).to_upper()
		var w := Style.largeur(tag, 13) + 14
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(Paddock.CATS.get(c.cat, "#9aa1ad"))
		sb.set_corner_radius_all(8)
		b.draw_style_box(sb, Rect2((b.size.x - w) / 2, y, w, 19))
		Style.texte(b, tag, Vector2(0, y + 14.4), 13, T_PETIT, HORIZONTAL_ALIGNMENT_CENTER, b.size.x)
		y += 19 + 6
	# la livrée : « 1/3 » en rouge, puis son nom (js/ui.js, le repère du salon)
	var l: Array = c.livrees
	if l.size() > 1:
		var n := "%d/%d" % [li % l.size() + 1, l.size()]
		var nom := Paddock._coupe(Textes.livree(l[li % l.size()]), 11, 116 - Style.largeur(n, 14) - 4)
		var wt := Style.largeur(n, 14) + 4 + Style.largeur(nom, 11)
		var x := (b.size.x - wt) / 2
		Style.texte(b, n, Vector2(x, y + 13.5), 14, Color("#b42b26"))
		Style.texte(b, nom, Vector2(x + Style.largeur(n, 14) + 4, y + 13), 11, Color("#5f6158"))
	b.draw_rect(Rect2(Vector2(1, 1), b.size - Vector2(2, 2)), BORD_SEL if sel else T_BORD, false, 2)
	if sel:
		b.draw_rect(Rect2(2, b.size.y - 6, b.size.x - 4, 4), BORD_SEL)
		Paddock._coche(b, Vector2(b.size.x - 17, 17))


func _dessineTel() -> void:
	var ci := cadre
	var dansTable := net.state != "off"
	if not dansTable:
		BarreTitre.tel(ci, Rect2(14, 12, 362, 64), Textes.t("multi"))
		var l: PackedStringArray = z.intro
		for i in l.size(): Style.texte(ci, l[i], Vector2(14, 108 + 19.2 * i + 15.6), 16, MUET)
		var p: Rect2 = z.panneau
		ci.draw_rect(p, PANNEAU)
		ci.draw_rect(p.grow(-0.5), PANNEAU_BORD, false, 1)
		Style.texte(ci, Textes.t("tableCodeLabel"), z.etiquette, 16, TITRE)
		var msg := ""
		var c := TITRE
		if net.busy: msg = Textes.t("netWait")
		elif net.error != "": msg = Textes.netErreur(net.error); c = Color("#b3261e")
		Style.texte(ci, msg, z.message, 16, c)
		return
	# la barre du titre, compacte : la flèche seule, « TA TABLE » et le code
	ci.draw_rect(Rect2(14, 12, 362, 64), BarreTitre.NOIR)
	Style.damier(ci, Rect2(40, 12, 34, 64), 13, BarreTitre.CREME, BarreTitre.NOIR, 16)
	var titre := Textes.t("yourTable", "").strip_edges()
	var cs := net.code
	var wc := Paddock._largeurEspace(cs, 19, 4.2)
	var wt := 16 + Style.largeur(titre, 19) + 10 + wc + 24
	ci.draw_colored_polygon(PackedVector2Array([Vector2(90, 12), Vector2(76 + wt, 12), Vector2(76 + wt - 28, 76), Vector2(76, 76)]), BarreTitre.ROUGE)
	Style.texte(ci, titre, Vector2(92, 51), 19, BarreTitre.TEXTE)
	Paddock._espace(ci, cs, Vector2(92 + Style.largeur(titre, 19) + 10, 51), 19, BarreTitre.TEXTE, 4.2)
	var logo := Style.tex("res://images/interface/logo-slotless.webp")
	var lh := 72.0 * logo.get_height() / logo.get_width()
	ci.draw_texture_rect(logo, Rect2(298, 44 - lh / 2, 72, lh), false)
	var t := net.settings()
	var m := net.members()
	var pilotes := m.filter(func(e): return not e.q.get("spectator", false))
	var yp: float = z.ping
	Style.texte(ci, "%s · %s" % [net.link.label() if net.link else "Ping : —", Textes.t("roundTrip")], Vector2(14, yp + 18), 16, MUET)
	var alerte := Textes.netErreur(net.error) if net.error != "" else ""
	if not net.grilleCompatible(t) or m.any(func(e): return not e.q.get("spectator", false) and int(e.q.get("protocol", 0)) != Net.DRIVE_PROTOCOL): alerte = Textes.t("reloadAll")
	if alerte != "": Style.texte(ci, alerte, Vector2(14, yp + 42), 14, Color("#b3261e"), HORIZONTAL_ALIGNMENT_LEFT, 362)
	# « PILOTES » et, en gris, le compte
	var ns := m.size() - pilotes.size()
	var pluriel := ns > 1 if Textes.langue() == "fr" else ns != 1
	var tj := Textes.t("playersTitle", [pilotes.size(), Net.NET_SEATS, Textes.t("spectatorMany" if pluriel else "spectatorOne", ns)]).to_upper()
	var mots := tj.split(" ", true, 1)
	var x0 := 14 + _h3(ci, mots[0], Vector2(14, float(z.joueursTitre) + 14.6)) + 6
	if mots.size() > 1: Paddock._espace(ci, mots[1], Vector2(x0, float(z.joueursTitre) + 14.6), 15, MUET, 1.5)
	# les cartes des pilotes, deux par ligne
	for i in m.size():
		var e: Dictionary = m[i]
		var r := Rect2(14 + (i % 2) * 186, float(z.cartes) + (i / 2) * 89, 176, 79)
		ci.draw_rect(r, Color("#ddd0b6") if e.isMe else T_CARTE)
		ci.draw_rect(r.grow(-1), Color("#b42b26") if e.isMe else T_BORD, false, 2)
		Style.texte(ci, str(e.name), r.position + Vector2(14, 25.75), 14, Color("#272b28"), HORIZONTAL_ALIGNMENT_LEFT, r.size.x - 24)
		var tags := []
		if i == 0: tags.append(Textes.t("hostTag"))
		if e.isMe: tags.append(Textes.t("youTag"))
		if i > 0 and net.link:
			var p = net.link.ping(e.pid)
			tags.append("%s ms" % ("—" if p == null else str(p)))
		Style.texte(ci, " · ".join(tags), r.position + Vector2(14, 44.3), 13, T_PETIT)
		var etat := Textes.t("spectatorTag") if e.q.get("spectator", false) else (Textes.t("readyTag") if e.ready else Textes.t("waiting"))
		Style.texte(ci, etat, r.position + Vector2(14, 63.3), 13, VERT if e.ready else T_PETIT)
	_dessineOptions(ci)
	var info: Dictionary = infos.get(_circuitVu, infos.values()[0])
	# la barre du bas
	var b: Rect2 = z.barre
	ci.draw_rect(b, PANNEAU)
	ci.draw_rect(b.grow(-0.5), PANNEAU_BORD, false, 1)
	var dr := Style.drapeau(info.pays)
	if dr: ci.draw_texture_rect(dr, Rect2(31, b.position.y + 40, 17, 12), false)
	var v := Catalogue.voiture(App.reglages.voiture)
	Style.texte(ci, Paddock._coupe("%s · %s" % [Textes.nom(info.nom), Textes.nom(v.get("nom", ""))], 14, 140), Vector2(51, b.position.y + 51), 14, MUET)
	if z.has("attendre"):
		var at := Textes.t("startWhenReady")
		Style.texte(ci, at, Vector2(359 - Style.largeur(at, 14), z.attendre), 14, MUET)


## L'aperçu de la voiture (selectionPreview) : comme au paddock du téléphone, 240 de haut.
func _apercuVoitureTel(ci: CanvasItem, r: Rect2) -> void:
	var v := Catalogue.voiture(App.reglages.voiture)
	var l: Array = v.livrees
	var li := _livreeDe(v.id) % maxi(1, l.size())
	ci.draw_rect(r, Color("#c8baa0"))
	Style.couvre(ci, fond, r.grow(-2), 0.5)
	var lignes: PackedStringArray = z.nomVoiture
	var hc := 8.0 + 40.0 * lignes.size() + 20 + 16
	var pc := Rect2(r.position.x + 2, r.position.y + 2, r.size.x - 4, hc)
	ci.draw_colored_polygon(PackedVector2Array([pc.position, Vector2(pc.end.x, pc.position.y), Vector2(pc.position.x + pc.size.x * 0.99, pc.position.y + hc * 0.91), Vector2(pc.position.x, pc.end.y)]), T_PAPIER)
	for i in lignes.size(): Style.texte(ci, lignes[i], Vector2(r.position.x + 20, pc.position.y + 8 + 40 * i + 35), 40, Color("#20271f"))
	var cat := ""
	for c in Catalogue.categories():
		if c.id == v.cat: cat = Textes.nom(c.nom).to_upper()
	Paddock._espace(ci, "%s · %s" % [cat, Textes.livree(l[li]).to_upper()], Vector2(r.position.x + 20, pc.position.y + 8 + 40 * lignes.size() + 16.4), 17, Color("#252a22"), 0.51)
	var d := Catalogue.dessin(v.id, li)
	if d.get("vignette"):
		var tex := Style.tex("res://images/vignettes/" + d.vignette)
		var zone := Rect2(r.position.x + 7, pc.end.y, r.size.x - 14, r.size.y - 4 - hc)
		var e := minf(zone.size.x / tex.get_width(), zone.size.y / tex.get_height())
		var tt := Vector2(tex.get_width(), tex.get_height()) * e
		ci.draw_texture_rect(tex, Rect2(zone.get_center() - tt / 2, tt), false)
	ci.draw_rect(r.grow(-1), Color("#20251f"), false, 2)


## L'aperçu du circuit : le titre sur son papier penché, puis le tracé sur l'image du circuit.
func _apercuCircuitTel(ci: CanvasItem, r: Rect2, info: Dictionary) -> void:
	ci.draw_rect(r, Color("#6b8171"))
	Style.couvre(ci, info.image, r.grow(-2), 0.5)
	var lc: PackedStringArray = z.nomCircuit
	var ht := 12 + 34.2 * lc.size() + 7 + 22 + 14
	var rp := Rect2(r.position.x + 2, r.position.y + 2, r.size.x - 4, ht)
	ci.draw_colored_polygon(PackedVector2Array([rp.position, Vector2(rp.end.x, rp.position.y), Vector2(rp.end.x, rp.position.y + ht * 0.93), Vector2(rp.position.x, rp.end.y)]), T_PAPIER)
	for i in lc.size(): Style.texte(ci, lc[i], Vector2(r.position.x + 14, rp.position.y + 12 + 34.2 * i + 30.6), 36, Color("#272b28"))
	var ys := rp.position.y + 12 + 34.2 * lc.size() + 7
	Paddock._espace(ci, Paddock.infoPiste(info, false), Vector2(r.position.x + 14, ys + 17.75), 18, Color("#272b28"), 0.36)
	var dr := Style.drapeau(info.pays)
	if dr:
		var rd := Rect2(r.end.x - 59, rp.position.y + 12, 45, 34)
		Style.couvre(ci, dr, rd, 0.5)
		ci.draw_rect(rd, Color(0.145, 0.165, 0.133, 0.2), false, 1)
	var im := Rect2(r.position.x + 20, rp.end.y + 4, r.size.x - 40, r.size.y - ht - 4 - 12)
	Paddock._contour(ci, info, im.grow(-18), false, 4.6, true)
	ci.draw_rect(r.grow(-1), Color("#33392f"), false, 2)
