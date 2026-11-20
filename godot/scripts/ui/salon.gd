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


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	fond = load("res://images/interface/paddock.webp")
	infos = Paddock.infosCircuits()
	Paddock.precharge()
	net = Reseau.net
	cadre = Control.new()
	cadre.draw.connect(_dessine)
	add_child(cadre)
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
	if String(t.get("trackId", "")) != _circuitVu:
		_circuitVu = String(t.get("trackId", "")); _suivre = true
	# Les boutons ne se refont que si ce qu'ils montrent a changé ; le reste se redessine.
	var pilotes := net.members().filter(func(m): return not m.q.get("spectator", false)).size()
	var s := JSON.stringify([net.state, net.busy, net.creator, t.get("mode"), t.get("timeOfDay"), cat, t.get("trackId"),
		net.mine.get("ready"), net.mine.get("spectator"), App.reglages.voiture, App.reglages.livree, net.canStart(),
		pilotes < 2, debutCircuits, debutVoitures, size, net.members().size(), _suivre])
	if s != _signature:
		_signature = s
		_construit()
	cadre.queue_redraw()


func _b(t: String, r: Rect2, f: Color, e: Color, taille: int, action: Callable, cle: String) -> Bouton:
	var b := Bouton.new(t, f, e, taille)
	b.position = r.position
	b.size = r.size
	b.centre = true
	b.pressed.connect(action)
	b.set_meta("cle", cle)
	cadre.add_child(b)
	return b


## Une rangée de boutons à choix (.seg) : le choisi en rouge, les autres sombres.
func _seg(choix: Array, actuel: String, y: float, actif: bool, action: Callable, prefixe: String) -> void:
	var x := M
	for c in choix:
		var w := Style.largeur(c[1], 22) + 50
		if x + w > W - M:
			x = M; y += 52
		var b := _b(c[1], Rect2(x, y, w, 44), ROUGE_SEL if c[0] == actuel else Style.NUIT_PLEINE, CARTE_SEL if c[0] == actuel else Style.CREME, 22,
			func(): action.call(c[0]), prefixe + str(c[0]))
		b.disabled = not actif
		x += w + 6
	z[prefixe] = y + 44


func _construit() -> void:
	var focus := get_viewport().gui_get_focus_owner()
	var cle: String = focus.get_meta("cle", "") if focus and cadre.is_ancestor_of(focus) else ""
	for c in cadre.get_children():
		if not c.has_meta("garde"): c.queue_free()
	portrait = size.x < size.y
	W = 780.0 if portrait else 1280.0
	z = {}
	var t := net.settings()
	var dansTable := net.state != "off"
	# Le bandeau
	_b(Textes.t("leaveTable") if dansTable else Textes.t("back"), Rect2(M, 10, 200, 64), Style.NUIT_PLEINE, Style.CREME, 20, _retour, "retour")
	var y := 92.0
	code.visible = not dansTable
	if not dansTable:
		z.intro = Vector2(M, y + 16)
		y += _hauteurTexte(Textes.t("multiIntro"), W - 2 * M, 17) + 14
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
		if net.room is SalleSteam:
			_b(Textes.t("inviteFriend"), Rect2(xb, y, 250, 46), Style.BLEU, Style.CREME, 18, func(): net.room.invite(), "inviter")
			xb += 262
		if xb > M: y += 58
		if not net.creator:
			_b(Textes.t("becomeDriver") if net.mine.get("spectator", false) else Textes.t("becomeSpectator"), Rect2(M, y, 300, 44), Style.NUIT_PLEINE, Style.CREME, 18,
				func(): net.setMine({ spectator = not net.mine.get("spectator", false), ready = false }); net.pump(), "role")
			y += 56
		# Le format
		z.formatTitre = Vector2(M, y + 14); y += 24
		_seg([["race", Textes.t("mRaceSeg")], ["duel", Textes.t("mDuelSeg")], ["ghost", Textes.t("mGhostSeg")]], String(t.get("mode", "race")), y, net.creator,
			func(id): net.setTable({ mode = id }), "mode")
		y = z.mode + 8
		z.formatDesc = Vector2(M, y + 14); y += 30
		# Le jour ou la nuit
		z.heureTitre = Vector2(M, y + 14); y += 24
		_seg([["day", Textes.t("daySeg")], ["night", Textes.t("nightSeg")]], "night" if t.get("timeOfDay") == "night" else "day", y, net.creator,
			func(id): net.setTable({ timeOfDay = id }), "heure")
		y = z.heure + 8
		if t.get("timeOfDay") == "night":
			z.nuitDesc = Vector2(M, y + 14); y += 30
		# La catégorie
		z.catTitre = Vector2(M, y + 14); y += 24
		var cats := [["all", Textes.t("all")]]
		for c in Catalogue.categories(): cats.append([c.id, Textes.nom(c.nom).to_upper()])
		cats.sort_custom(func(a, b): return CATS.find(a[0]) < CATS.find(b[0]))
		var cat := String(t.get("cat", "all")) if t.get("cat") else "all"
		_seg(cats, cat, y, net.creator, func(id): net.setTable({ cat = id }), "cat")
		y = z.cat + 8
		z.catDesc = Vector2(M, y + 14); y += 34
		# L'aperçu de la voiture et du circuit
		if portrait:
			z.apercuVoiture = Rect2(M, y, W - 2 * M, 250); y += 262
			z.apercuCircuit = Rect2(M, y, W - 2 * M, 250); y += 274
		else:
			var lv := (W - 2 * M) * 0.6
			z.apercuVoiture = Rect2(M, y, lv - 7, 300)
			z.apercuCircuit = Rect2(M + lv + 7, y, W - 2 * M - lv - 7, 300)
			y += 324
		# La rangée des circuits
		z.circuitTitre = Vector2(M, y + 14); y += 26
		var circuits := Catalogue.circuits()
		var nc := maxi(1, floori((W - 2 * M - 68) / 134.0))
		var liste := _modeles()
		var nv := maxi(1, floori((W - 2 * M - 68) / 158.0))
		# Comme le rail du jeu web qui se place sur la carte choisie.
		if _suivre:
			var ic := circuits.map(func(c): return c.id).find(String(t.get("trackId", "")))
			if ic >= 0 and (ic < debutCircuits or ic >= debutCircuits + nc): debutCircuits = ic - nc / 2
			var iv := liste.map(func(c): return c.id).find(App.reglages.voiture)
			if iv >= 0 and (iv < debutVoitures or iv >= debutVoitures + nv): debutVoitures = iv - nv / 2
			_suivre = false
		debutCircuits = clampi(debutCircuits, 0, maxi(0, circuits.size() - nc))
		# les flèches collées aux cartes, la rangée centrée
		var xc := _rangee(nc, 134.0, 10.0)
		_b("‹", Rect2(xc - 34, y + 62, 28, 46), Style.NUIT_PLEINE, Style.CREME, 30, func(): debutCircuits = maxi(0, debutCircuits - nc); _maj(), "c-gauche")
		_b("›", Rect2(xc + nc * 134 - 10 + 6, y + 62, 28, 46), Style.NUIT_PLEINE, Style.CREME, 30, func(): debutCircuits += nc; _maj(), "c-droite")
		var choisi := String(t.get("trackId", ""))
		for i in mini(nc, circuits.size() - debutCircuits):
			var c: Dictionary = circuits[debutCircuits + i]
			var b := _b(str(c.nom).to_upper(), Rect2(xc + i * 134, y, 124, 170), Style.PAPIER, Style.ENCRE, 15,
				func(): net.setTable({ trackId = c.id, laps = _tours(c.id) }), "circuit-" + c.id)
			b.choisi = c.id == choisi
			b.disabled = not net.creator
			b.set_meta("circuit", c.id)
			b.ligne = 112
			b.dessinPlus = _carteCircuit.bind(b)
		y += 196
		# La rangée des voitures
		z.voitureTitre = Vector2(M, y + 14); y += 26
		debutVoitures = clampi(debutVoitures, 0, maxi(0, liste.size() - nv))
		var xv := _rangee(nv, 158.0, 8.0)
		_b("‹", Rect2(xv - 34, y + 80, 28, 46), Style.NUIT_PLEINE, Style.CREME, 30, func(): debutVoitures = maxi(0, debutVoitures - nv); _maj(), "v-gauche")
		_b("›", Rect2(xv + nv * 158 - 8 + 6, y + 80, 28, 46), Style.NUIT_PLEINE, Style.CREME, 30, func(): debutVoitures += nv; _maj(), "v-droite")
		for i in mini(nv, liste.size() - debutVoitures):
			var c: Dictionary = liste[debutVoitures + i]
			var b := _b(str(c.nom).to_upper(), Rect2(xv + i * 158, y, 150, 206), Style.PAPIER, Style.ENCRE, 16, func(): _voiture(c.id), "voiture-" + c.id)
			b.choisi = c.id == App.reglages.voiture
			b.set_meta("voiture", c)
			b.ligne = 128
			b.dessinPlus = _carteVoiture.bind(b)
		y += 230
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
	# Le focus revient où il était (la manette et le clavier ne perdent pas leur place).
	var cible: Control = null
	for c in cadre.get_children():
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
	elif e is InputEventScreenDrag:
		_defile(-e.relative.y / cadre.scale.y)


func _defile(d: float) -> void:
	defile = clampf(defile + d, 0, maxf(0, hauteur - size.y / cadre.scale.y))
	cadre.position.y = -defile * cadre.scale.y


## La manette et le clavier font défiler jusqu'au bouton qu'ils prennent.
func _suitFocus(c: Control) -> void:
	if c == null or not cadre.is_ancestor_of(c): return
	var vue := size.y / cadre.scale.y
	if c.position.y < defile + 90: _defile(c.position.y - 90 - defile)
	elif c.position.y + c.size.y > defile + vue - 20: _defile(c.position.y + c.size.y - (defile + vue - 20))


# ---------------------------------------------------------------- le dessin

func _draw() -> void:
	Style.couvre(self, fond, Rect2(Vector2.ZERO, size), 0.5)


func _dessine() -> void:
	var ci := cadre
	var dansTable := net.state != "off"
	# Le bandeau du paddock : retour, damier, le titre dans la bande rouge, le logo.
	Style.biseau(ci, Rect2(M, 10, W - 2 * M, 64), Style.NUIT_PLEINE, 0)
	Style.damier(ci, Rect2(222, 10, 80, 64), 4, Style.CREME, Style.NUIT_PLEINE, 0)
	var titre := Textes.t("multi") if not dansTable else Textes.t("yourTable", " ".join(net.code.split("")))
	var lt := Style.largeur(titre, 38) + 60
	Style.biseau(ci, Rect2(296, 10, lt, 64), Style.ROUGE, 22)
	Style.texte(ci, titre, Vector2(320, 58), 38, Style.CREME)
	var logo := Style.tex("res://images/interface/logo-grip.webp")
	if not portrait:
		ci.draw_texture_rect(logo, Rect2(W - 210, 16, 190, 190 * logo.get_height() / logo.get_width()), false)
	if not dansTable:
		_paragraphe(Textes.t("multiIntro"), z.intro, W - 2 * M, 17, MUET)
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
	if m.any(func(e): return not e.q.get("spectator", false) and int(e.q.get("protocol", 0)) != Net.DRIVE_PROTOCOL):
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
	# Le format, l'heure, la catégorie
	_titre(Textes.t("mFormatTitle"), z.formatTitre)
	var mode := String(t.get("mode", "race"))
	Style.texte(ci, Textes.t({ race = "mRaceDesc", duel = "mDuelDesc", ghost = "mGhostDesc" }.get(mode, "mRaceDesc")), z.formatDesc, 15, MUET)
	_titre(Textes.t("dayNightTitle"), z.heureTitre)
	if z.has("nuitDesc"):
		var f1: bool = Catalogue.voiture(App.reglages.voiture).get("cat") == "f1"
		Style.texte(ci, Textes.t("nightF1Hint" if f1 else "nightHint"), z.nuitDesc, 15, MUET)
	_titre(Textes.t("mCatTitle"), z.catTitre)
	var cat := String(t.get("cat", "all")) if t.get("cat") else "all"
	Style.texte(ci, Textes.t("mCatOpen") if cat == "all" else Textes.t("mCatDesc"), z.catDesc, 15, MUET)
	_apercuVoiture(ci, z.apercuVoiture)
	var info: Dictionary = infos.get(String(t.get("trackId", "")), infos.values()[0])
	_apercuCircuit(ci, z.apercuCircuit, info)
	_titre(Textes.t("trackTitle"), z.circuitTitre)
	_titre(Textes.t("modelTitle"), z.voitureTitre)
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
