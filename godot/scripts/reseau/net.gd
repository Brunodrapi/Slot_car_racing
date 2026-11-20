## Courir ensemble : `js/net.js`, ligne pour ligne.
##
## Tout repose sur le tableau des présences de la salle (SalleRTC, ou la salle Steam) : chaque
## écran publie un objet et voit ceux des autres. Rien n'est gardé nulle part : quitter ferme la
## table.
##
## Les pilotes simulent leur propre voiture ; NetDrive relaie des états horodatés et l'hôte arbitre
## les contacts et les résultats. NetLink mesure l'aller-retour et aligne les horloges.
##
## Trois formules, un salon :
##   race   — tout le monde sur la grille, complétée par l'IA, contacts
##   duel   — les humains et personne d'autre
##   ghost  — le même circuit, chacun son tour, les voitures se traversent
##
## Les noms des champs sont ceux du jeu web, à la lettre : ce sont eux qui passent sur le fil, et un
## joueur Godot s'assoit à la même table qu'un joueur dans le navigateur.
class_name Net
extends RefCounted

const NET_HZ := 30
const NET_CODE := "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"   # ni I, ni O, ni 0, ni 1 : ils se lisent à voix haute
const NET_MODES := ["race", "duel", "ghost"]
const NET_SEATS := 8
const NET_STALE := 6000.0
const NET_CHARGE_MAX := 12000.0
const DRIVE_PROTOCOL := 4

var room = null                   # SalleRTC (ou SalleSteam) : presence, peers, message, onPeers, onMessage
var state := "off"                # off | lobby | playing
var code := ""
var pid := Net.netPid()
var creator := false
var error := ""
var busy := false
var mine := { pid = "", name = "", car = null, ready = false }
var table := { timeOfDay = "day", mode = "race", trackId = "monza", laps = 3, difficulty = "medium", cat = "all", go = 0 }
var grid = null                   # gelée au coup d'envoi par l'hôte : [{p, n, m, l}, …], l'hôte d'abord
var roster = null                 # la même liste, les pid seuls
var seat := -1
var peers: Array = []
var completedGo := 0
var link: NetLink = null
var drive = null                  # NetDrive
var playingAt := 0.0
var presenceFullAt := 0.0
var snapAt := 0.0
var lastSeq := -1
var onPeers: Callable = func() -> void: pass
var onStart: Callable = func(_cfg: Dictionary) -> void: pass
var focus: Callable = func(): return null
var viewRadius: Callable = func(): return 110
## Fabrique la salle : SalleRTC pour les tables du jeu web, la salle Steam dans la version Steam.
var fabriqueSalle: Callable = func(): return SalleRTC.new()


static func netCode() -> String:
	var s := ""
	for i in 4: s += NET_CODE[randi() % NET_CODE.length()]
	return s


## Une identité que l'écran se donne lui-même (comme Math.random().toString(36).slice(2, 10)).
static func netPid() -> String:
	return SalleRTC._hasard(8)


## performance.now()
static func now() -> float:
	return Time.get_ticks_usec() / 1000.0


func available() -> bool:
	return SalleRTC.available()


func isHost() -> bool:
	return seat == 0 if roster != null else creator


# ---------------------------------------------------------------- la table

func open(nom: String, asHost: bool, code_: String = "", spectator := false) -> bool:
	busy = true; error = ""
	room = fabriqueSalle.call()
	code = Net.netCode() if asHost else code_.to_upper().strip_edges()
	var valide := RegEx.create_from_string("^[A-Z0-9]{4}$").search(code) != null
	if not asHost and not valide:
		error = "code à quatre lettres"
		leave()
	else:
		creator = asHost
		completedGo = 0
		mine = { pid = pid, protocol = DRIVE_PROTOCOL, name = nom if nom != "" else "Pilote", car = null, ready = false,
			spectator = not asHost and spectator }
		room.onPeers(func(_p) -> void: peers = room.peers(); pump())
		var err: String = await room.claim(code, asHost)
		if err != "":
			error = err
			leave()
		else:
			state = "lobby"
			link = NetLink.new(self)
			post()
	busy = false
	onPeers.call()
	return error == ""


func leave() -> void:
	if link: link.close()
	link = null; drive = null
	if room: room.close()
	room = null
	state = "off"
	code = ""
	grid = null
	roster = null
	seat = -1
	peers = []
	creator = false
	onPeers.call()


## À chaque image : la salle, et le battement d'une seconde de NetLink.
func poll(delta: float) -> void:
	if room: room.poll(delta)
	if link: link.poll(delta)


## La présence, envoyée entière — mais pas tout, trente fois par seconde (voir net.js, post).
func post(extra: Dictionary = {}) -> void:
	if not room: return
	var t := Net.now()
	var course := state == "playing" and t - playingAt > 2000
	var complet := not course or t - presenceFullAt >= 900
	if complet: presenceFullAt = t
	var p := mine.duplicate()
	for k in extra: p[k] = extra[k]
	if complet:
		if creator: p.t = table                   # seule la copie de l'hôte compte
		if creator and grid != null: p.gr = grid
	else:
		# On RETIRE les champs figés : `presence()` fusionne, `null` supprime pour de bon.
		p.t = null; p.gr = null; p.report = null; p.name = null; p.car = null; p.ready = null
		p.ch = mine.get("ch")
	if extra.has("report") and extra.report != null: p.report = extra.report
	room.presence(p)


## Tout le monde à la table, l'hôte d'abord, sans les écrans muets.
func members() -> Array:
	var t := SalleRTC.maintenant()
	var out := []
	for p in peers:
		var q: Dictionary = p.presence if p.presence is Dictionary else {}
		if not q.get("pid"): continue
		if not p.isMe and p.updatedAt and t - float(p.updatedAt) > NET_STALE: continue
		out.append({ pid = String(q.pid), name = String(q.get("name", "")) if q.get("name") != null else "",
			car = q.get("car"), ready = bool(q.get("ready", false)) if q.get("ready") != null else false,
			isMe = bool(p.isMe), q = q, _label = String(p.peer) })
	# L'étiquette de l'hôte commence par 0 : le tri le met en tête, sur tous les écrans pareil.
	out.sort_custom(func(a, b): return a._label < b._label)
	for i in out.size():
		if out[i].name == "": out[i].name = Textes.t("driverN") % (i + 1)
	return out


func settings() -> Dictionary:
	if creator: return table
	for p in peers:
		var q = p.presence
		if q is Dictionary and q.get("t") is Dictionary:
			table = q.t
			return table
	return table


func setTable(patch: Dictionary) -> void:
	if not creator: return
	for k in patch: table[k] = patch[k]
	post()
	onPeers.call()


func setMine(patch: Dictionary) -> void:
	for k in patch: mine[k] = patch[k]
	post()
	onPeers.call()


func canStart() -> bool:
	var m := members().filter(func(x): return not x.q.get("spectator", false)).slice(0, NET_SEATS)
	var t := settings()
	var cat := String(t.get("cat", "all"))
	var conforme := func(x) -> bool:
		if cat == "" or cat == "all": return true
		var mod: Dictionary = Catalogue.voiture(String(x.car.get("modelId", ""))) if x.car is Dictionary else {}
		return mod.is_empty() or mod.cat == cat
	return creator and m.size() >= 2 and m.all(func(x): return x.ready and x.car is Dictionary \
		and int(x.q.get("protocol", 0)) == DRIVE_PROTOCOL and conforme.call(x))


## L'hôte donne le départ ; tout le monde gèle la même liste, dans le même ordre, à cet instant.
func start() -> void:
	if not canStart(): return
	setTable({ go = int(SalleRTC.maintenant()) })


func hostGrid():
	for p in peers:
		var q = p.presence
		if q is Dictionary and q.get("t") != null and q.get("gr") is Array and (q.gr as Array).size() >= 2:
			return q.gr
	return null


## Le coup d'envoi, et la grille qui va avec : l'hôte seul la compose (voir net.js, pump).
func pump() -> void:
	onPeers.call()
	if state != "lobby": return
	var t := settings()
	var go := int(t.get("go", 0)) if t.get("go") != null else 0
	if go == 0 or go == completedGo: return
	var g = null
	if creator:
		var m := members().filter(func(x): return not x.q.get("spectator", false)).slice(0, NET_SEATS)
		if m.size() < 2: return
		g = m.map(func(x): return { p = x.pid, n = x.name,
			m = String(x.car.get("modelId", "")) if x.car is Dictionary and x.car.get("modelId") != null else null,
			l = int(x.car.get("livree", 0)) if x.car is Dictionary and x.car.get("livree") != null else 0 })
	else:
		g = hostGrid()
		if g == null: return                     # l'invité attend la grille de l'hôte
	var r: Array = (g as Array).map(func(x): return String(x.p))
	var s := r.find(pid)
	if not creator:
		var hote = members().filter(func(m): return m.pid == r[0])
		if hote.is_empty() or int(hote[0].q.get("protocol", 0)) != DRIVE_PROTOCOL:
			error = "Version multijoueur différente : tous les pilotes doivent recharger le jeu."
			return
	if s < 0 and not mine.get("spectator", false): return
	grid = g
	roster = r
	seat = s
	state = "playing"
	# Le relais s'éteint ici, et ne se rallume qu'au drapeau (voir net.js).
	if room: room.relayer = false
	lastSeq = -1
	playingAt = Net.now()
	mine.ch = false                            # chacun repart « pas encore prêt » à chaque course
	snapAt = Net.now()
	post()
	var humans := []
	for i in (g as Array).size():
		var x: Dictionary = g[i]
		humans.append({ name = String(x.n) if x.get("n") else Textes.t("driverN") % (i + 1),
			modelId = x.m if x.get("m") != null else null, livree = int(x.get("l", 0)) if x.get("l") != null else 0,
			livery = i, local = x.p == pid })
	onStart.call({ mode = t.get("mode", "race"), trackId = t.get("trackId", "monza"), laps = t.get("laps", 3),
		difficulty = t.get("difficulty", "medium"), timeOfDay = "night" if t.get("timeOfDay") == "night" else "day",
		cat = t.get("cat", "all") if t.get("cat") else "all", go = go, spectator = bool(mine.get("spectator", false)),
		humans = humans })


## Retour au salon après le drapeau, la table reste ouverte.
func backToLobby() -> void:
	if state != "playing": return
	completedGo = int(settings().get("go", 0))
	state = "lobby"
	drive = null
	if room: room.relayer = true
	grid = null
	roster = null
	seat = -1
	if creator: table.go = 0
	mine.ready = false
	post({ s = null, report = null })
	onPeers.call()


## Depuis quand rien n'est arrivé de l'hôte (l'écran grise au-delà de deux secondes).
func silence() -> float:
	if state != "playing" or isHost(): return 0.0
	if lastSeq < 0: return 0.0
	return (Net.now() - snapAt) / 1000.0


func setCharge(ok: bool) -> void:
	if bool(mine.get("ch", false)) == ok: return
	mine.ch = ok
	post()


## Qui n'a pas encore annoncé qu'il était prêt (l'hôte seul s'en sert).
func attendus() -> Dictionary:
	if roster == null: return { reste = 0, total = 0 }
	var vus := {}
	for p in peers:
		var q = p.presence
		if q is Dictionary and q.get("pid") and (mine.get("ch", false) if p.isMe else q.get("ch", false)):
			vus[String(q.pid)] = true
	var total: int = (roster as Array).size()
	var prets := (roster as Array).filter(func(x): return vus.has(x)).size()
	var trop := Net.now() - playingAt > NET_CHARGE_MAX
	return { reste = 0 if trop else total - prets, total = total, prets = prets, trop = trop }
