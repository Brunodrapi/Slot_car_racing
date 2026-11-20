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


func charge(chemin: String) -> void:
	var meta: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(chemin + ".json"))
	var brut := FileAccess.get_file_as_bytes(chemin + ".bin").decompress(int(meta.taille), FileAccess.COMPRESSION_DEFLATE)
	var atlas: Texture2D = load(meta.atlas.image)
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
