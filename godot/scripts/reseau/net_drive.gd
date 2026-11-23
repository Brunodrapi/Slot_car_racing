## La course en ligne : la classe NetDrive de `js/net-drive.js`, ligne pour ligne.
##
## Chaque pilote simule SA voiture et publie son état, horodaté à l'horloge de l'hôte (NetLink).
## L'hôte simule l'IA, reçoit les états des invités, arbitre les contacts entre voitures de
## propriétaires différents et renvoie à chacun la vue qui le concerne : en détail les voitures
## proches, en résumé les autres. Il tient aussi le décompte, les drapeaux, l'arrivée et le
## classement (paquets `control`).
##
## Les paquets sont ceux du jeu web, champ pour champ et octet pour octet (driveEncode) : un hôte
## Godot conduit des invités du navigateur, et l'inverse.
class_name NetDrive
extends RefCounted

const DRIVE_PROTOCOL := 4
const DRIVE_FULL_BYTES := 40
const DRIVE_FAR_BYTES := 14
const NET_FINISH_GRACE := 30.0

var net: Net
var race: Course
var link: NetLink
var id := 0
var host := false
var local := -1
var states := {}          # indice -> état décodé
var sent := {}            # pid -> { indice -> { at, near } }
var contacts := {}        # pid -> [événements]
var contactSerial := {}
var ack := 0
var pairAt := {}
var sequence := 0
var controlSeq := 0
var controlReceived := -1
var lastSend := -INF
var lastControl := -INF
var lastMeta := -INF
var lastIntent := ""
var metaKey := ""
var epoch = null
var lastReceive := 0.0
var finishSend := 0.0
var lastFlagKey := ""
var lastState := ""
var reportAt := 0.0
var radii := {}
var watchFocus := {}
var near := {}
var bytes := 0


func _init(n: Net, r: Course) -> void:
	net = n; race = r; link = n.link
	id = int(n.settings().get("go", 0))
	host = n.isHost()
	local = -1 if r.spectator else r.cars.find(r.player)
	lastReceive = Net.now()
	var initialAt := link.now() if link.synchronized else -1.0
	r.netDrive = self
	for i in r.cars.size():
		var c := r.cars[i]
		c.netRemote = not owns(c)
		states[i] = NetDrive.driveState(c, i, initialAt)


# ---------------------------------------------------------------- le format (driveEncode)

static func driveFlags(c: Voiture) -> int:
	return (1 if c.herbe else 0) | (2 if c.engineStopped else 0) | (4 if c.braking else 0) \
		| (8 if c.inPit else 0) | (16 if c.throttle > 0 else 0) | (32 if c.started else 0)


static func driveState(c: Voiture, i: int, at: float, acceleration := 0.0) -> Dictionary:
	return { id = i, at = at, x = c.x, y = c.y, th = c.th, v = c.v, vl = c.vl, w = c.w, s = c.s, lat = c.lat,
		sel = c.sel, lap = c.lap, flags = NetDrive.driveFlags(c), slip = c.patineFx,
		acceleration = clampf(acceleration, -60, 30), damage = c.damage, tyre = c.tyre, steer = c.delta, far = false }


## Math.round de JavaScript : la moitié va vers le haut, -2,5 donne -2.
static func _rond(x: float) -> int:
	return int(floor(x + 0.5))


static func driveEncode(records: Array, far := false) -> PackedByteArray:
	var b := StreamPeerBuffer.new()
	b.big_endian = true
	b.put_u8(1 if far else 0)
	for s in records:
		b.put_u8(int(s.id) & 0xff); b.put_double(float(s.at))
		if far:
			b.put_u16(_rond(float(s.s) * 8) & 0xffff)
			b.put_u8(int(s.lap) & 0xff)
			b.put_16(_rond(clampf(float(s.v), -327, 327) * 100))
			continue
		for k in ["x", "y", "s"]: b.put_float(float(s[k]))
		for ks in [["th", 1000], ["v", 100], ["vl", 100], ["w", 1000], ["lat", 100], ["acceleration", 100]]:
			b.put_16(_rond(clampf(float(s[ks[0]]) * ks[1], -32767, 32767)))
		b.put_8(_rond(float(s.sel) * 100)); b.put_u8(int(s.lap) & 0xff)
		b.put_u8(int(s.flags) & 0xff); b.put_u8(_rond(float(s.slip) * 255) & 0xff)
		b.put_u8(_rond(float(s.damage) * 255) & 0xff); b.put_u8(_rond(float(s.tyre) * 255) & 0xff)
		b.put_8(_rond(clampf(float(s.steer), -.65, .65) * 180))
	return b.data_array


static func driveDecode(data) -> Array:
	if not (data is PackedByteArray): return []
	var o: PackedByteArray = data
	if o.is_empty(): return []
	var far := o[0] == 1
	var size := DRIVE_FAR_BYTES if far else DRIVE_FULL_BYTES
	if o[0] > 1 or (o.size() - 1) % size != 0 or o.size() > 1 + 12 * size: return []
	var b := StreamPeerBuffer.new()
	b.big_endian = true
	b.data_array = o
	b.seek(1)
	var out := []
	while b.get_position() < o.size():
		var s := { id = b.get_u8(), at = b.get_double(), far = far }
		if far:
			s.s = b.get_u16() / 8.0; s.lap = b.get_u8(); s.v = b.get_16() / 100.0
		else:
			for k in ["x", "y", "s"]: s[k] = b.get_float()
			for ks in [["th", 1000.0], ["v", 100.0], ["vl", 100.0], ["w", 1000.0], ["lat", 100.0], ["acceleration", 100.0]]:
				s[ks[0]] = b.get_16() / ks[1]
			s.sel = b.get_8() / 100.0; s.lap = b.get_u8(); s.flags = b.get_u8()
			s.slip = b.get_u8() / 255.0; s.damage = b.get_u8() / 255.0; s.tyre = b.get_u8() / 255.0
			s.steer = b.get_8() / 180.0
		for k in s:
			if s[k] is float and not is_finite(s[k]): return []
		out.append(s)
	return out


## driveMeta : ce qui ne bouge qu'au tour, à la sortie, à l'arrivée.
static func driveMeta(c: Voiture) -> Dictionary:
	var laps := []
	for i in c.lapTimes.size(): laps.append([c.lapTimes[i], c.lapOk[i] if i < c.lapOk.size() else true])
	return { lap = c.lap, started = c.started, lapStart = c.lapStart, bestLap = c.bestLap if c.bestLap >= 0 else null,
		laps = laps, fautes = c.fautes, repris = c.repris, finished = c.finished,
		finishTime = c.finishTime if c.finishTime >= 0 else null, lapSale = c.lapSale }


# ---------------------------------------------------------------- la course

func owns(c: Voiture) -> bool:
	return not race.spectator and (c.isPlayer or host and c.human < 0)


func send(p: Dictionary, pid: String) -> void:
	p.race = id
	link.send(p, pid)


func owner(i: int) -> String:
	var c := race.cars[i]
	return net.roster[0] if c.human < 0 else net.roster[c.human]


func publish(c: Voiture, i: int) -> Dictionary:
	var prev = states.get(i)
	var at := link.now()
	var elapsed: float = (at - (float(prev.at) if prev else at)) / 1000.0
	var a: float = (c.v - float(prev.v)) / elapsed if elapsed > .005 else (float(prev.acceleration) if prev else 0.0)
	var s := NetDrive.driveState(c, i, at, a)
	states[i] = s
	return s


func beforeFrame(dt: float) -> void:
	var r := race
	if not host and not link.synchronized:
		r.attente = true; return
	if host and r.state == "countdown" and not r.attente and epoch == null:
		epoch = link.now() + r.countdown * 1000
		lastControl = -INF
	if epoch != null and r.state != "finished":
		var t: float = (link.now() - float(epoch)) / 1000.0
		if t < 0:
			r.countdown = -t
		else:
			if r.state == "countdown":
				r.state = "racing"; r.countdown = 0
				for c in r.cars: c.gridLat = NAN
				r.ajouteEvenement({ type = "go" })
			r.time = maxf(0, t - minf(dt, .1))
	projectRemotes()
	if not host and link.ping(net.pid) == null: r.attente = true


func afterFrame(gaz: float, sel: float) -> void:
	# la table vient d'être quittée : la course tourne encore une image, sans personne à qui parler
	if net.roster == null or net.roster.is_empty(): return
	var r := race
	var t := link.now()
	if host:
		if r.state == "finished":
			if t - finishSend < 1000: return
			finishSend = t
		for i in r.cars.size():
			var c := r.cars[i]
			if owns(c):
				var prev = states.get(i)
				var s := publish(c, i)
				if prev and (((int(prev.flags) ^ int(s.flags)) & 22) or absf(float(prev.sel) - float(s.sel)) > .05): broadcast(i)
		broadcast()
		control()
		return
	if local < 0:
		if t - lastSend > 200:
			lastSend = t
			send({ kind = "watch", focus = net.focus.call() }, net.roster[0])
		return
	if not link.synchronized: return
	var c := r.player
	var intent := "%d:%d:%d:%s:%s" % [_rond(gaz * 10), 0, _rond(sel * 10), str(c.braking), str(c.engineStopped)]
	var urgent := intent != lastIntent
	if t - lastSend < 1000.0 / 30 and not urgent: return
	lastSend = t; lastIntent = intent
	var state := publish(c, local)
	var meta := NetDrive.driveMeta(c)
	var key := JSON.stringify(meta)
	var changed := key != metaKey
	var withMeta := changed or t - lastMeta > 500
	if withMeta:
		lastMeta = t; metaKey = key
	sequence += 1
	send({ kind = "owned", seq = sequence, state = NetDrive.driveEncode([state]), ack = ack,
		meta = meta if withMeta else null, urgent = urgent, radius = net.viewRadius.call() }, net.roster[0])


func receive(p: Dictionary, pid: String) -> void:
	if p.get("race") == null or int(p.race) != id: return
	var r := race
	var kind = p.get("kind")
	if host and kind == "owned":
		if r.state == "finished": return
		var list := NetDrive.driveDecode(p.get("state"))
		if list.size() != 1: return
		var s: Dictionary = list[0]
		var i := int(s.id)
		if i >= r.cars.size() or s.far or owner(i) != pid or pid == net.pid: return
		var c := r.cars[i]
		var prev: Dictionary = states[i]
		var seq = p.get("seq")
		if not (seq is int) or int(seq) <= c.netSeq or float(s.at) < float(prev.at) or float(s.at) > link.now() + 250 \
				or link.now() - float(s.at) > 2500: return
		if absf(s.v) > 200 or absf(s.vl) > 100 or s.s < 0 or s.s > r.track.length + 1: return
		c.netSeq = int(seq)
		var rad = p.get("radius")
		radii[pid] = clampf(float(rad) if rad is float or rad is int else 110.0, 110, 350)
		var ack_ := int(p.get("ack", 0)) if p.get("ack") != null else 0
		contacts[pid] = (contacts.get(pid, []) as Array).filter(func(e): return int(e.id) > ack_)
		states[i] = s
		applyState(c, s)
		if p.get("meta") is Dictionary: acceptMeta(c, p.meta, s)
		r._flagsUpdate()
		if p.get("urgent"): broadcast(i)
		return
	if host and kind == "watch":
		var m := net.members().filter(func(x): return x.pid == pid)
		if not m.is_empty() and m[0].q.get("spectator", false):
			var f = p.get("focus")
			if f is int and f >= 0 and f < r.cars.size(): watchFocus[pid] = f
			else: watchFocus.erase(pid)
		return
	if host or pid != net.roster[0]: return
	if kind == "view":
		var list := NetDrive.driveDecode(p.get("data"))
		if list.is_empty(): return
		for s in list:
			var i := int(s.id)
			if i >= r.cars.size(): continue
			var c := r.cars[i]
			var old = states.get(i)
			if owns(c) or (old and float(s.at) < float(old.at)) or (old and float(s.at) == float(old.at) and s.far and not old.far): continue
			states[i] = s
			# Les feux stop tout de suite ; la pose se calcule à l'heure de l'écran.
			if not s.far:
				c.braking = (int(s.flags) & 4) != 0; c.patineFx = s.slip
		lastReceive = Net.now(); net.snapAt = lastReceive; net.lastSeq += 1
	if kind == "control" and int(p.get("seq", -1)) > controlReceived:
		controlReceived = int(p.seq)
		epoch = p.get("epoch")
		var st = p.get("state")
		if st == "finishing" or st == "finished": r.state = st
		var endAt = p.get("endAt")
		r.finishDeadline = float(endAt) if endAt is float or endAt is int else NAN
		r.finishTimer = maxf(0, (0.0 if is_nan(r.finishDeadline) else r.finishDeadline) - r.time)
		if p.get("flags") is Dictionary: r.flagsReceive(p.flags)
		if p.get("meta") is Array:
			var metas: Array = p.meta
			for i in metas.size():
				if i < r.cars.size() and (i != local or st == "finished"): applyMeta(r.cars[i], metas[i])
		if p.get("report") is Dictionary:
			var own := NetDrive.driveMeta(r.player) if local >= 0 else {}
			if r.broadcast: r.broadcast.receive(p.report, r)
			if not own.is_empty() and st != "finished": applyMeta(r.player, own)
		if st == "finished":
			r.time = float(p.get("time", r.time))
			r._classeRecu()
		lastReceive = Net.now(); net.snapAt = lastReceive; net.lastSeq += 1
	if kind == "contacts" and local >= 0:
		var evs = p.get("events", [])
		for e in (evs if evs is Array else []):
			if not (e is Dictionary) or int(e.get("id", -1)) != ack + 1 or int(e.get("car", -1)) != local: continue
			ack = int(e.id)
			if link.now() - float(e.get("at", 0)) > 1500 or r.state == "finished" or r.player.blueFlag: continue
			var c := r.player
			var bx := c.x
			var by := c.y
			var bth := c.th
			var d = e.get("delta", {})
			for k in ["x", "y", "v", "vl", "w", "damage"]:
				if d is Dictionary and d.get(k) != null: c.set(k, float(c.get(k)) + float(d[k]))
			c.damage = clampf(c.damage, 0, 1)
			c._barrierContact(bx, by, bth, -1)
			r.ajouteEvenement({ type = "crash", car = c })


func applyMeta(c: Voiture, m) -> void:
	if not (m is Dictionary): return
	if m.has("lap"): c.lap = int(m.lap)
	if m.has("started"): c.started = bool(m.started)
	if m.has("lapStart"): c.lapStart = float(m.lapStart)
	if m.has("bestLap"): c.bestLap = float(m.bestLap) if m.bestLap != null else -1.0
	if m.has("fautes"): c.fautes = int(m.fautes)
	if m.has("repris"): c.repris = float(m.repris)
	if m.has("finished"): c.finished = bool(m.finished)
	if m.has("finishTime"): c.finishTime = float(m.finishTime) if m.finishTime != null else -1.0
	if m.has("lapSale"): c.lapSale = bool(m.lapSale)
	if m.get("laps") is Array:
		var t: Array[float] = []
		var ok: Array[bool] = []
		for l in m.laps:
			t.append(float(l[0])); ok.append(bool(l[1]))
		c.lapTimes = t; c.lapOk = ok


## Ce qu'un invité dit de ses tours : cumulatif, vérifié, jamais réécrit (voir net-drive.js).
func acceptMeta(c: Voiture, m: Dictionary, _s: Dictionary) -> void:
	var laps = m.get("laps")
	if not (laps is Array) or laps.size() > 999 or laps.size() < c.lapTimes.size() or int(m.get("lap", -1)) != laps.size(): return
	for l in laps:
		if not (l is Array) or l.size() < 1 or not (l[0] is float or l[0] is int) or float(l[0]) <= 0: return
	var ls = m.get("lapStart")
	if not (ls is float or ls is int) or float(ls) > race.time + .3 or float(ls) < 0: return
	if race.dureeSession > 0 and float(ls) > race.dureeSession: return
	if not (m.get("fautes") is int) or int(m.fautes) < 0 or not (m.get("repris") is float or m.get("repris") is int) or float(m.repris) < 0: return
	for i in c.lapTimes.size():
		if absf(c.lapTimes[i] - float(laps[i][0])) > .001: return
	if int(m.lap) < c.lap: return
	var wasFinished := c.finished
	var oldLap := c.lap
	applyMeta(c, m)
	c.finished = race.dureeSession <= 0 and int(m.lap) >= race.laps
	if c.finished:
		c.finishTime = float(m.lapStart)
		if not is_nan(race.finishDeadline) and c.finishTime > race.finishDeadline:
			c.finished = false; c.finishTime = -1.0
	if oldLap != c.lap: race.ajouteEvenement({ type = "lap", car = c })
	if c.finished and not wasFinished and race.state == "racing":
		race.state = "finishing"
		race.finishDeadline = c.finishTime + NET_FINISH_GRACE
		race.finishTimer = maxf(0, race.finishDeadline - race.time)
		lastControl = -INF


func applyState(c: Voiture, s: Dictionary) -> void:
	if s.far:
		c.s = s.s; c.v = s.v; c.lap = int(s.lap)
		var p := race.track.pos2(s.s, 0)
		c.x = p[0]; c.y = p[1]; c.th = race.track.headingAt(s.s)
		return
	for k in ["x", "y", "th", "v", "vl", "w", "s", "lat", "sel", "damage", "tyre"]: c.set(k, float(s[k]))
	if not host: c.lap = maxi(c.lap, int(s.lap))
	var f := int(s.flags)
	c.selS = s.sel; c.braking = (f & 4) != 0; c.throttle = 1.0 if (f & 16) else 0.0; c.engineStopped = (f & 2) != 0
	c.delta = s.steer
	c.inPit = (f & 8) != 0; c.started = (f & 32) != 0; c.herbe = (f & 1) != 0; c.patineFx = s.slip
	c.beta = atan2(s.vl, maxf(.1, absf(s.v)))


## Les voitures des autres, portées à l'heure de l'écran depuis leur dernier état.
func projectRemotes() -> void:
	var t := link.now()
	var r := race
	for i in states:
		var c := r.cars[i]
		if owns(c): continue
		var s: Dictionary = states[i]
		applyState(c, s)
		if r.state == "countdown" or r.state == "finished": continue
		var dt := clampf((t - float(s.at)) / 1000.0, 0, .22 if s.far else .15)
		if s.far:
			c.s = r.track.wrap_(s.s + maxf(0, s.v) * dt)
			var p := r.track.pos2(c.s, 0)
			c.x = p[0]; c.y = p[1]
			continue
		var dv := clampf(float(s.acceleration) * dt, -maxf(0, s.v), 4)
		var v: float = s.v + dv / 2
		var th: float = s.th + s.w * dt / 2
		c.x += (v * cos(th) - s.vl * sin(th)) * dt
		c.y += (v * sin(th) + s.vl * cos(th)) * dt
		c.th = Voiture.wrapAngle(s.th + s.w * dt)
		c.v = s.v + dv
		var pr := r.track.project(c.x, c.y, r.track.wrap_(s.s + v * dt), 30)
		c.s = pr[0]; c.lat = pr[2]


func isNear(i: int, pid: String) -> bool:
	var r := race
	var c := r.cars[i]
	var seat := (net.roster as Array).find(pid)
	var focus: Voiture = null
	if seat >= 0:
		for k in r.cars:
			if k.human == seat: focus = k
	elif watchFocus.has(pid):
		focus = r.cars[watchFocus[pid]]
	if focus == null: return seat < 0      # les spectateurs en vue d'ensemble ont tout en détail
	var d := absf(r.track.diff(focus.s, c.s))
	var monde := Piste.hypot(c.x - focus.x, c.y - focus.y)
	var portee := maxf(110, absf(focus.v - c.v) * 3 + 40)
	var cle := "%s:%d" % [pid, i]
	var etait: bool = near.get(cle, false)
	var proche := d < portee + (30 if etait else 0) or monde < float(radii.get(pid, 110)) + (30 if etait else 0)
	near[cle] = proche
	return proche


func broadcast(urgentId := -1) -> void:
	var t := link.now()
	for m in net.members():
		if m.isMe: continue
		var envoye: Dictionary = sent.get(m.pid, {})
		var full := []
		var far := []
		for i in states:
			if owner(i) == m.pid: continue
			var proche := isNear(i, m.pid)
			var last: Dictionary = envoye.get(i, { at = -INF, near = false })
			if urgentId >= 0 and i != urgentId: continue
			if urgentId >= 0 and not proche: continue
			if urgentId < 0 and t - last.at < (1000.0 / 30 if proche else 200.0) and not (proche and not last.near): continue
			(full if proche else far).append(states[i])
			envoye[i] = { at = t, near = proche }
		for pair in [[full, false], [far, true]]:
			if pair[0].size():
				var data := NetDrive.driveEncode(pair[0], pair[1])
				bytes += data.size()
				send({ kind = "view", data = data }, m.pid)
		sent[m.pid] = envoye


func control() -> void:
	var t := link.now()
	var r := race
	var flagKey := r.flagsKey()
	if flagKey != lastFlagKey:
		lastControl = -INF; lastFlagKey = flagKey
	if t - lastControl < (1000.0 if r.state == "finished" else 200.0) and r.state == lastState: return
	var reportDue := t - reportAt > 1000 or r.state == "finished"
	if reportDue: reportAt = t
	var metas = null
	if reportDue:
		metas = []
		for c in r.cars: metas.append(NetDrive.driveMeta(c))
	var p := { kind = "control", seq = controlSeq + 1, epoch = epoch, state = r.state, time = r.time,
		endAt = null if is_nan(r.finishDeadline) or r.finishDeadline == 0 else r.finishDeadline,
		flags = r.flagsPacket(), meta = metas,
		report = r.broadcast.packet(r) if reportDue and r.broadcast else null }
	controlSeq += 1
	lastControl = t; lastState = r.state
	for m in net.members():
		if m.isMe: continue
		send(p.duplicate(), m.pid)
		var evs: Array = contacts.get(m.pid, [])
		if evs.size(): send({ kind = "contacts", events = evs }, m.pid)


func canFinalize() -> bool:
	# On arrête de rouler à l'échéance, et on attend un instant les passages déjà en route.
	var r := race
	var w := .15
	for pid in (net.roster as Array).slice(1):
		var p = link.ping(pid)
		w = maxf(w, (float(p) if p != null else 0.0) / 2000.0 + .05)
	w = minf(.6, w)
	return r.time >= r.finishDeadline + w


## Les contacts entre voitures de propriétaires différents : l'hôte les calcule et envoie à chacun
## ce que le choc a changé à sa voiture (voir net-drive.js).
func resolveContacts(dt: float) -> void:
	if not host: return
	var r := race
	var t := link.now()
	for i in r.cars.size():
		for j in range(i + 1, r.cars.size()):
			var a := r.cars[i]
			var b := r.cars[j]
			var cle := "%d:%d" % [i, j]
			if a.blueFlag or b.blueFlag: continue
			if t - float(pairAt.get(cle, -INF)) < 80: continue
			var route := 0.0
			for k in [i, j]:
				if owner(k) != net.pid:
					var p = link.ping(owner(k))
					route += INF if p == null else float(p) / 2
			if route > 150: continue
			var vieux := false
			for k in [i, j]:
				if not owns(r.cars[k]) and (t - float(states[k].at) > 160 or (contacts.get(owner(k), []) as Array).size()): vieux = true
			if vieux: continue
			if absf(r.track.diff(a.s, b.s)) > (a.cls.length + b.cls.length) / 2 - .05 or absf(a.lat - b.lat) > (a.cls.width + b.cls.width) / 2 - .05: continue
			var cles := ["x", "y", "v", "vl", "w", "damage"]
			var avant := []
			for c in [a, b]:
				var d := {}
				for k in cles: d[k] = float(c.get(k))
				avant.append(d)
			Course.resolveCollisions([a, b], r.track)
			pairAt[cle] = t
			for n in 2:
				var c: Voiture = [a, b][n]
				var idc: int = [i, j][n]
				var delta := {}
				var bouge := false
				for k in cles:
					delta[k] = float(c.get(k)) - avant[n][k]
					if absf(delta[k]) > 1e-7: bouge = true
				if owns(c):
					c._barrierContact(avant[n].x, avant[n].y, c.th, -1)
					continue
				for k in cles: c.set(k, avant[n][k])
				if not bouge: continue
				var pid := owner(idc)
				var e := { id = int(contactSerial.get(pid, 0)) + 1, car = idc, at = t, delta = delta }
				contactSerial[pid] = e.id
				var evs: Array = contacts.get(pid, [])
				evs.append(e)
				contacts[pid] = evs
				send({ kind = "contacts", events = evs }, pid)


## Un résumé pour le banc d'essai.
func resume() -> Dictionary:
	var r := race
	return { state = r.state, time = r.time, host = host, local = local, synchronise = link.synchronized,
		voitures = r.cars.map(func(c): return { nom = c.nom, s = snappedf(c.s, 0.1), lap = c.lap, finished = c.finished, v = snappedf(c.v, 0.1),
			human = c.human, remote = c.netRemote }),
		results = r.results.map(func(x): return { pos = x.pos, nom = x.car.nom, temps = x.temps }) if r.results.size() else [] }
