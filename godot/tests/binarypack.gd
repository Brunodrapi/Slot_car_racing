## BinaryPack en GDScript contre la bibliothèque de PeerJS : mêmes octets à l'écriture, mêmes
## valeurs à la lecture. Les octets de référence viennent de `outils/binarypack-vecteurs.js`.
##
##   godot --headless --path godot --script res://tests/binarypack.gd
extends SceneTree


func _init() -> void:
	var f := FileAccess.open("res://tests/binarypack-vecteurs.json", FileAccess.READ)
	var vecteurs: Array = JSON.parse_string(f.get_as_text())
	var ok := 0
	var ko := 0
	for v in vecteurs:
		var valeur = _depuisJson(v.valeur)
		var attendu: String = v.octets
		var ecrit := BinaryPack.pack(valeur).hex_encode()
		var relu = BinaryPack.unpack(attendu.hex_decode())
		var reluJs = _depuisJson(v.relu)
		var memeEcrit := ecrit == attendu
		# Godot doit relire la valeur d'origine. (La bibliothèque web, elle, relit mal les entiers
		# négatifs au-delà de 2³¹ : elle les recompose en double. Le jeu n'en envoie pas.)
		var memeLu := _egal(relu, valeur) or _egal(relu, reluJs)
		var allerRetour := _egal(BinaryPack.unpack(BinaryPack.pack(valeur)), valeur) or _egal(BinaryPack.unpack(BinaryPack.pack(valeur)), reluJs)
		if memeEcrit and memeLu and allerRetour:
			ok += 1
		else:
			ko += 1
			print("ÉCART : ", JSON.stringify(v.valeur).left(120))
			if not memeEcrit: print("   écrit  ", ecrit.left(80), "\n   attendu ", attendu.left(80))
			if not memeLu: print("   relu ", str(relu).left(120), "\n   web  ", str(reluJs).left(120))
			if not allerRetour: print("   aller-retour différent")
	# Les clés écrites à la Lua ({ kind = ... }) doivent se lire comme des chaînes.
	var d := { kind = "ping", id = 3 }
	var r: Dictionary = BinaryPack.unpack(BinaryPack.pack(d))
	var cles: bool = r.get("kind") == "ping" and r.kind == "ping" and d.get("kind") == "ping"
	print("clés : ", cles)
	print("BinaryPack : %d identiques, %d écarts" % [ok, ko])
	quit(0 if ko == 0 and cles else 1)


func _depuisJson(v: Variant) -> Variant:
	if v is Dictionary:
		if v.has("$octets"): return String(v["$octets"]).hex_decode()
		if v.has("$entier"): return String(v["$entier"]).to_int()
		var d := {}
		for k in v: d[k] = _depuisJson(v[k])
		return d
	if v is Array:
		return v.map(_depuisJson)
	# JSON lit tous les nombres en float : un entier redevient un int, comme en JavaScript
	if v is float and floorf(v) == v and absf(v) <= 9007199254740991.0:
		return int(v)
	return v


func _egal(a: Variant, b: Variant) -> bool:
	if a is int and b is int:
		return a == b
	if (a is int or a is float) and (b is int or b is float):
		return float(a) == float(b)
	if typeof(a) != typeof(b): return false
	if a is Dictionary:
		if a.size() != b.size(): return false
		for k in a:
			if not b.has(k) or not _egal(a[k], b[k]): return false
		return true
	if a is Array:
		if a.size() != b.size(): return false
		for i in a.size():
			if not _egal(a[i], b[i]): return false
		return true
	return a == b
