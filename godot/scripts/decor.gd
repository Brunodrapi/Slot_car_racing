## Le monde fixe du circuit : sol, route, vibreurs, bacs, protections, arbres, bâtiments.
##
## Ce n'est pas un dessin refait à la main : ce sont les ordres de dessin du jeu web, captés dans
## le navigateur (godot/outils/capture-decor.js) puis changés en triangles (maille-decor.js). Le
## rendu est donc celui du jeu web, mais peint par la carte graphique : une maille par carreau de
## 64 m, une seule texture pour tout (l'atlas), et Godot n'envoie que les carreaux visibles.
class_name Decor
extends Node2D

var fond := Color("#4e7a3a")
var nCarreaux := 0
var nTriangles := 0


## `chemin` sans extension : res://donnees/circuits/<id>-decor, ou user://decors/<id>-decor pour un
## décor téléchargé (la version web ne les embarque pas : voir telechargeDecor).
func charge(chemin: String) -> void:
	var meta: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(chemin + ".json"))
	var brut := FileAccess.get_file_as_bytes(chemin + ".bin").decompress(int(meta.taille), FileAccess.COMPRESSION_DEFLATE)
	var atlas: Texture2D
	if chemin.begins_with("res://"):
		atlas = load(meta.atlas.image)
	else:
		atlas = ImageTexture.create_from_image(Image.load_from_file(chemin + ".png"))
	fond = Color(meta.fond)
	for c in meta.carreaux:
		var b: Array = c.blocs
		var tableaux := []
		tableaux.resize(Mesh.ARRAY_MAX)
		tableaux[Mesh.ARRAY_VERTEX] = _lit(brut, b[0])
		tableaux[Mesh.ARRAY_TEX_UV] = _lit(brut, b[1])
		tableaux[Mesh.ARRAY_COLOR] = _lit(brut, b[2])
		tableaux[Mesh.ARRAY_INDEX] = _lit(brut, b[3])
		var maille := ArrayMesh.new()
		maille.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux, [], {}, Mesh.ARRAY_FLAG_USE_2D_VERTICES)
		var mi := MeshInstance2D.new()
		mi.mesh = maille
		mi.texture = atlas
		# 0 sous toutes les voitures, 1 le tablier d'un croisement, 2 par-dessus toutes.
		mi.z_index = [0, 2, 4][int(c.get("couche", 0))]
		add_child(mi)
		nCarreaux += 1
		nTriangles += int(c.triangles)


static func _lit(brut: PackedByteArray, bloc: Array) -> Variant:
	return bytes_to_var(brut.slice(int(bloc[0]), int(bloc[0]) + int(bloc[1])))



## Le décor d'un circuit est-il là ? Sinon (version web), on le télécharge à côté de la page.
static func cheminDe(id: String) -> String:
	var local := "res://donnees/circuits/%s-decor" % id
	if FileAccess.file_exists(local + ".json"): return local
	var cache := "user://decors/%s-decor" % id
	if FileAccess.file_exists(cache + ".ok"): return cache
	return ""


## Télécharge les trois fichiers du décor dans user://decors/. `progres` reçoit une fraction.
static func telecharge(id: String, parent: Node, progres: Callable) -> bool:
	DirAccess.make_dir_recursive_absolute("user://decors")
	# La page web les sert à côté d'elle ; une version d'essai pour ordinateur va les chercher sur
	# la même page de la recette (réglage grip/decors_url du projet).
	var base := str(ProjectSettings.get_setting("grip/decors_url", "https://brunodrapi.github.io/Slot_car_racing/essais/godot/"))
	if OS.has_feature("web"):
		base = str(JavaScriptBridge.eval("window.location.href.replace(/[^/]*$/, '')"))
	var fichiers := ["%s-decor.json" % id, "%s-decor.png" % id, "%s-decor.bin" % id]
	for i in fichiers.size():
		var req := HTTPRequest.new()
		parent.add_child(req)
		var fini := [false, 0, 0, PackedByteArray()]
		# Le corps est écrit à la main : `download_file` n'écrit rien dans la version web.
		req.request_completed.connect(func(r, code, _h, b): fini[0] = true; fini[1] = r; fini[2] = code; fini[3] = b)
		if req.request(base + "decors/" + fichiers[i]) != OK:
			req.queue_free()
			return false
		while not fini[0]:
			await parent.get_tree().process_frame
			var total := req.get_body_size()
			if total > 0: progres.call((i + float(req.get_downloaded_bytes()) / total) / fichiers.size())
		req.queue_free()
		if fini[1] != HTTPRequest.RESULT_SUCCESS or fini[2] != 200: return false
		var f := FileAccess.open("user://decors/" + fichiers[i], FileAccess.WRITE)
		if f == null: return false
		f.store_buffer(fini[3])
		f.close()
	# Le témoin n'est posé qu'une fois les trois fichiers arrivés en entier.
	var ok := FileAccess.open("user://decors/%s-decor.ok" % id, FileAccess.WRITE)
	if ok: ok.store_string("1")
	return true
