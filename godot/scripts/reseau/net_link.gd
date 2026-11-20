## L'horloge partagée et l'aller-retour : la classe NetLink de `js/net-drive.js`.
##
## L'hôte envoie un `ping` à chaque invité toutes les secondes ; l'invité répond par un `pong` qui
## porte son heure ; l'hôte en tire l'aller-retour et l'écart d'horloge, garde le meilleur des huit
## derniers, et le renvoie dans un `clock`. L'invité règle alors son horloge sur celle de l'hôte :
## toutes les heures du fil sont celles de l'hôte (performance.now() de son écran).
class_name NetLink
extends RefCounted

var net: Net
var offset := 0.0
var samples := {}
var pings := {}
var pending := {}
var serial := 0
var synchronized := false
var clockNow := NAN
var _tic := 0.0


func _init(n: Net) -> void:
	net = n
	synchronized = net.isHost()
	net.room.onMessage(func(p, from) -> void: receive(p, from))


func close() -> void:
	pending.clear()


func poll(delta: float) -> void:
	_tic += delta
	if _tic >= 1.0:
		_tic -= 1.0
		tick()


func now() -> float:
	var adjusted := Net.now() + offset
	clockNow = maxf(adjusted, adjusted if is_nan(clockNow) else clockNow)
	return clockNow


func send(packet: Dictionary, pid: String) -> void:
	for p in net.peers:
		if p.presence is Dictionary and p.presence.get("pid") == pid:
			if not p.isMe and net.room: net.room.message(packet, String(p.peer))
			return


func tick() -> void:
	if not net.room: return
	if net.isHost():
		for m in net.members():
			if m.isMe: continue
			serial += 1
			var t := Net.now()
			pending[serial] = { pid = m.pid, t = t }
			send({ kind = "ping", id = serial, t = t }, m.pid)
	for id in pending.keys():
		if Net.now() - pending[id].t > 5000: pending.erase(id)
	# La présence sert à l'appartenance et aux retardataires, pas au mouvement rapide.
	if net.state != "off": net.post()
	net.onPeers.call()


func receive(p, from: String) -> void:
	var n := net
	var pid := ""
	for x in n.peers:
		if x.peer == from and x.presence is Dictionary: pid = String(x.presence.get("pid", ""))
	if pid == "" or not (p is Dictionary): return
	var host := ""
	if n.roster != null: host = n.roster[0]
	else:
		var m := n.members()
		if m.size(): host = m[0].pid
	var kind = p.get("kind")
	if kind == "ping" and pid == host and not n.isHost():
		send({ kind = "pong", id = p.get("id"), at = Net.now() }, pid)
		return
	if kind == "pong" and n.isHost():
		var q = pending.get(int(p.get("id", -1)) if p.get("id") != null else -1)
		var at = p.get("at")
		if q == null or q.pid != pid or not (at is float or at is int): return
		pending.erase(int(p.id))
		var t := Net.now()
		var rtt: float = t - q.t
		var s: Array = samples.get(pid, [])
		s.append({ rtt = rtt, offset = (q.t + t) / 2.0 - float(at) })
		samples[pid] = s.slice(-8)
		var best = samples[pid][0]
		for x in samples[pid]:
			if x.rtt < best.rtt: best = x
		pings[pid] = { ms = roundi(rtt), at = t }
		var autres := {}
		for k in pings:
			if t - pings[k].at < 4000: autres[k] = pings[k].ms
		send({ kind = "clock", offset = best.offset, rtt = rtt, peers = autres }, pid)
		return
	if kind == "clock" and pid == host and not n.isHost() and _fini(p.get("offset")) and _fini(p.get("rtt")):
		if not synchronized: clockNow = NAN
		offset = float(p.offset)
		pings = {}
		synchronized = true
		var autres = p.get("peers", {})
		if autres is Dictionary:
			for k in autres:
				if _fini(autres[k]): pings[k] = { ms = autres[k], at = Net.now() }
		pings[n.pid] = { ms = roundi(float(p.rtt)), at = Net.now() }
		return
	if n.drive: n.drive.receive(p, pid)


static func _fini(v) -> bool:
	return (v is float or v is int) and is_finite(float(v))


func ping(pid: String):
	var p = pings.get(pid)
	return p.ms if p != null and Net.now() - p.at < 4000 else null


func label() -> String:
	if not net.isHost():
		var p = ping(net.pid)
		return "%s %s" % [Textes.t("pingHost"), "—" if p == null else "%d ms" % p]
	var l := []
	for id in pings:
		var v = ping(id)
		if v != null: l.append(v)
	if l.is_empty(): return "%s —" % Textes.t("pingGuests")
	return "%s %d–%d ms" % [Textes.t("pingGuests"), l.min(), l.max()]
