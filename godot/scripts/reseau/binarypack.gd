## BinaryPack, le format des messages de PeerJS (peerjs-js-binarypack 2.1), en GDScript.
##
## Le jeu web ouvre ses canaux en `serialization: 'binary'` : chaque message est un objet
## JavaScript emballé par ce format, une variante de MessagePack. Pour qu'un joueur Godot et un
## joueur dans le navigateur s'assoient à la même table, Godot doit écrire et lire exactement les
## mêmes octets. Ce fichier reprend donc les deux moitiés de `lib/binarypack.ts`, cas par cas :
##
##   - les entiers prennent la plus petite place que JavaScript leur donnerait (un nombre sans
##     partie décimale est un entier, en JavaScript comme ici) ;
##   - les autres nombres partent en double, gros-boutiste ;
##   - les chaînes en UTF-8, préfixées 0xb0 à 0xbf, 0xd8 ou 0xd9 ;
##   - les octets bruts (PackedByteArray, un Uint8Array côté web) en 0xa0 à 0xaf, 0xda ou 0xdb ;
##   - tableaux et dictionnaires comme en MessagePack.
##
## Un nombre non fini (NaN, l'infini) part en `null` : la bibliothèque JavaScript lèverait une
## erreur sur l'infini, et le jeu web rejette déjà tout nombre non fini qu'il reçoit.
class_name BinaryPack
extends RefCounted


static func pack(valeur: Variant) -> PackedByteArray:
	var b := StreamPeerBuffer.new()
	b.big_endian = true
	_pack(b, valeur)
	return b.data_array


static func unpack(octets: PackedByteArray) -> Variant:
	var b := StreamPeerBuffer.new()
	b.big_endian = true
	b.data_array = octets
	return _unpack(b)


# ---------- l'emballage (Packer) ----------

static func _pack(b: StreamPeerBuffer, v: Variant) -> void:
	match typeof(v):
		TYPE_NIL:
			b.put_u8(0xc0)
		TYPE_BOOL:
			b.put_u8(0xc3 if v else 0xc2)
		TYPE_INT:
			_entier(b, v)
		TYPE_FLOAT:
			var f: float = v
			if is_nan(f) or is_inf(f):
				b.put_u8(0xc0)
			elif floorf(f) == f and absf(f) < 9.2e18:
				_entier(b, int(f))
			else:
				b.put_u8(0xcb)
				b.put_double(f)
		TYPE_STRING, TYPE_STRING_NAME:
			_chaine(b, String(v))
		TYPE_PACKED_BYTE_ARRAY:
			_brut(b, v)
		TYPE_DICTIONARY:
			var d: Dictionary = v
			_taille(b, d.size(), 0x80, 0xde, 0xdf)
			for k in d:
				_chaine(b, str(k))
				_pack(b, d[k])
		TYPE_ARRAY, TYPE_PACKED_INT32_ARRAY, TYPE_PACKED_INT64_ARRAY, TYPE_PACKED_FLOAT32_ARRAY, \
		TYPE_PACKED_FLOAT64_ARRAY, TYPE_PACKED_STRING_ARRAY:
			_taille(b, v.size(), 0x90, 0xdc, 0xdd)
			for x in v:
				_pack(b, x)
		_:
			# Vector2 et autres : rien de ce que le jeu envoie, et rien que JavaScript lirait.
			b.put_u8(0xc0)


static func _taille(b: StreamPeerBuffer, n: int, petit: int, moyen: int, grand: int) -> void:
	if n <= 0x0f:
		b.put_u8(petit + n)
	elif n <= 0xffff:
		b.put_u8(moyen); b.put_u16(n)
	else:
		b.put_u8(grand); b.put_u32(n)


static func _chaine(b: StreamPeerBuffer, s: String) -> void:
	var o := s.to_utf8_buffer()
	_taille(b, o.size(), 0xb0, 0xd8, 0xd9)
	b.put_data(o)


static func _brut(b: StreamPeerBuffer, o: PackedByteArray) -> void:
	_taille(b, o.size(), 0xa0, 0xda, 0xdb)
	b.put_data(o)


## pack_integer : le même ordre d'essais que la bibliothèque, donc le même octet de tête.
static func _entier(b: StreamPeerBuffer, n: int) -> void:
	if n >= -0x20 and n <= 0x7f:
		b.put_u8(n & 0xff)
	elif n >= 0 and n <= 0xff:
		b.put_u8(0xcc); b.put_u8(n)
	elif n >= -0x80 and n <= 0x7f:
		b.put_u8(0xd0); b.put_8(n)
	elif n >= 0 and n <= 0xffff:
		b.put_u8(0xcd); b.put_u16(n)
	elif n >= -0x8000 and n <= 0x7fff:
		b.put_u8(0xd1); b.put_16(n)
	elif n >= 0 and n <= 0xffffffff:
		b.put_u8(0xce); b.put_u32(n)
	elif n >= -0x80000000 and n <= 0x7fffffff:
		b.put_u8(0xd2); b.put_32(n)
	else:
		b.put_u8(0xd3); b.put_64(n)


# ---------- le déballage (Unpacker) ----------

static func _unpack(b: StreamPeerBuffer) -> Variant:
	if b.get_position() >= b.get_size():
		return null
	var t := b.get_u8()
	if t < 0x80:
		return t
	if (t ^ 0xe0) < 0x20:
		return (t ^ 0xe0) - 0x20
	if (t ^ 0xa0) <= 0x0f:
		return _lireBrut(b, t ^ 0xa0)
	if (t ^ 0xb0) <= 0x0f:
		return _lireChaine(b, t ^ 0xb0)
	if (t ^ 0x90) <= 0x0f:
		return _lireTableau(b, t ^ 0x90)
	if (t ^ 0x80) <= 0x0f:
		return _lireDico(b, t ^ 0x80)
	match t:
		0xc0, 0xc1, 0xd4, 0xd5, 0xd6, 0xd7: return null
		0xc2: return false
		0xc3: return true
		0xca: return b.get_float()
		0xcb: return b.get_double()
		0xcc: return b.get_u8()
		0xcd: return b.get_u16()
		0xce: return b.get_u32()
		0xcf: return b.get_u64()
		0xd0: return b.get_8()
		0xd1: return b.get_16()
		0xd2: return b.get_32()
		0xd3: return b.get_64()
		0xd8: return _lireChaine(b, b.get_u16())
		0xd9: return _lireChaine(b, b.get_u32())
		0xda: return _lireBrut(b, b.get_u16())
		0xdb: return _lireBrut(b, b.get_u32())
		0xdc: return _lireTableau(b, b.get_u16())
		0xdd: return _lireTableau(b, b.get_u32())
		0xde: return _lireDico(b, b.get_u16())
		0xdf: return _lireDico(b, b.get_u32())
	return null


static func _lireBrut(b: StreamPeerBuffer, n: int) -> PackedByteArray:
	if b.get_position() + n > b.get_size():
		b.seek(b.get_size())
		return PackedByteArray()
	return b.get_data(n)[1]


static func _lireChaine(b: StreamPeerBuffer, n: int) -> String:
	return _lireBrut(b, n).get_string_from_utf8()


static func _lireTableau(b: StreamPeerBuffer, n: int) -> Array:
	var a := []
	for i in n:
		if b.get_position() >= b.get_size(): break
		a.append(_unpack(b))
	return a


static func _lireDico(b: StreamPeerBuffer, n: int) -> Dictionary:
	var d := {}
	for i in n:
		if b.get_position() >= b.get_size(): break
		var k = _unpack(b)
		d[str(k)] = _unpack(b)
	return d
