## LE PONT DE LA VERSION STEAM : les salons Steam ET les tables à code, dans la même course.
##
## Un hôte Steam ouvre sa table sur les deux réseaux à la fois, sous le même code et la même
## étiquette : un salon Steam (amis, invitations, relais de Valve) et une table de l'annuaire PeerJS
## (WebRTC), celle que rejoignent le jeu web et les autres versions de Godot. Chaque invité ne parle
## qu'à l'hôte, sur son réseau ; l'hôte relaie les présences d'un réseau à l'autre (relaisExterne),
## et ses propres messages partent sur les deux. Pour le jeu, c'est une seule table.
##
## Un invité Steam qui tape un code cherche d'abord un salon Steam, puis une table de l'annuaire :
## il rejoint ainsi aussi bien un ami Steam qu'un joueur du jeu web.
class_name SallePont
extends RefCounted

var rtc: SalleRTC
var steam: SalleSteam
var actif = null                  # l'invité : la salle qu'il a rejointe
var host := false
var label := ""
var error := ""
var open := false
var relayer := true:
	set(v):
		relayer = v
		if rtc: rtc.relayer = v
		if steam: steam.relayer = v


func _init(s: SalleSteam = null, r: SalleRTC = null) -> void:
	steam = s if s else SalleSteam.new()
	rtc = r if r else SalleRTC.new()


func claim(code: String, asHost: bool) -> String:
	host = asHost
	error = ""
	if not asHost:
		# un salon Steam d'abord, puis une table de l'annuaire
		var e: String = await steam.claim(code, false)
		if e == "":
			actif = steam
		else:
			e = await rtc.claim(code, false)
			if e != "":
				error = e
				return e
			actif = rtc
		label = actif.label
		open = true
		return ""
	# l'hôte : la table de l'annuaire d'abord (c'est elle qui réserve le code pour le jeu web),
	# puis le salon Steam ; sans Steam, la table reste ouverte aux autres
	var err: String = await rtc.claim(code, true)
	if err != "":
		error = err
		return err
	label = rtc.label
	var es: String = await steam.claim(code, true)
	if es == "":
		steam.label = label
		steam.relaisExterne = rtc.relaie
		rtc.relaisExterne = steam.relaie
	open = true
	return ""


func _salles() -> Array:
	if not host: return [actif] if actif else []
	return [rtc, steam] if steam.open else [rtc]


func close() -> void:
	for s in [rtc, steam]: s.close()
	actif = null
	open = false


func poll(delta: float) -> void:
	for s in _salles(): s.poll(delta)


func onMessage(h: Callable) -> void:
	for s in [rtc, steam]: s.onMessage(h)


func onPeers(h: Callable) -> void:
	for s in [rtc, steam]: s.onPeers(func(_p) -> void: h.call(peers()))


func message(packet: Dictionary, target: String = "") -> void:
	for s in _salles(): s.message(packet, target)


## Sa présence vaut pour les deux réseaux, même celui qui n'est pas encore ouvert.
func presence(patch: Dictionary) -> void:
	for s in [rtc, steam]: s.presence(patch)


## Toute la table : soi, puis les pairs des deux réseaux.
func peers() -> Array:
	var ss := _salles()
	if ss.is_empty(): return []
	var list: Array = ss[0].peers()
	for k in range(1, ss.size()):
		for p in ss[k].peers():
			if not p.isMe: list.append(p)
	return list


func connected() -> bool:
	return _salles().any(func(s): return s.connected())


## L'invitation Steam : celle du salon Steam de la table.
func invite() -> void:
	if steam.open: steam.invite()
