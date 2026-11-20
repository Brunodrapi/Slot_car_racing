## La table et l'annuaire, sans WebRTC : Godot ouvre une table dans un annuaire PeerJS local, puis
## un second écran essaie d'ouvrir le même code et doit se le voir refuser.
##
##   (dans un autre terminal) peerjs --port 9000 --host 127.0.0.1
##   GRIP_ANNUAIRE=ws://127.0.0.1:9000/ godot --headless --path godot --script res://tests/salle_annuaire.gd
extends SceneTree

var a := Net.new()
var b := SalleRTC.new()
var fini := false


func _init() -> void:
	_essai()


func _essai() -> void:
	print("annuaire : ", SalleRTC.configuration())
	var ok := await a.open("Hôte Godot", true)
	print("table ouverte : ", ok, " code ", a.code, " erreur «", a.error, "» état ", a.state, " étiquette ", a.room.label if a.room else "")
	var err: String = await b.claim(a.code, true)
	print("même code une seconde fois : «", err, "»")
	var m := a.members()
	print("membres : ", m.map(func(x): return [x.name, x.isMe, x.q.get("protocol")]))
	a.leave()
	print(("OK" if ok and err == "code déjà pris" and m.size() == 1 else "ÉCHEC"))
	fini = true


func _process(delta: float) -> bool:
	a.poll(delta)
	b.poll(delta)
	return fini
