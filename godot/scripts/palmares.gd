## Le palmarès (js/palmares.js) : pour chaque circuit et chaque voiture, le plus haut niveau où l'on
## a gagné une course rapide d'au moins trois tours.
##     facile → chocolat · normal → bronze · difficile → argent · extrême → or · cauchemar → crâne
## Il vit sur l'appareil (`App.reglages.palmares`) et, connecté, se fusionne avec celui du compte
## (Mondial.synchroPalmares, la même fonction de la base que le jeu web) : gagné ici ou ailleurs,
## un trophée se retrouve partout.
class_name Palmares
extends RefCounted

const TROPHEES := ["chocolat", "bronze", "argent", "or", "crane"]
const NIVEAUX := ["easy", "medium", "hard", "extreme", "cauchemar"]
const TOURS_MIN := 3
const COULEURS := {
	"chocolat": { bord = "#6b4423", face = "#4e2f17", reflet = "#8a5a2f" },
	"bronze": { bord = "#8f5428", face = "#c47f45", reflet = "#e9b27c" },
	"argent": { bord = "#7f868c", face = "#c3c9ce", reflet = "#f2f4f5" },
	"or": { bord = "#a9790a", face = "#f0bf2c", reflet = "#ffe68c" },
	"crane": { bord = "#111311", face = "#262a27", reflet = "#3a3f3b" },
}
static var _textures := {}


## Le trophée d'un couple circuit/voiture, ou -1.
static func de(circuit: String, voiture: String) -> int:
	var p: Dictionary = App.reglages.get("palmares", {})
	var n = p.get(circuit + "|" + voiture)
	return int(n) if n != null and int(n) >= 0 and int(n) < TROPHEES.size() else -1


## Ce que la course qui vient de finir rapporte, et l'inscrire (attribueTrophee) : vide si elle ne
## compte pas (autre mode, en ligne, pas premier), sinon { rang, ancien, nouveau, raison }.
static func attribue(course: Course, difficulte: String) -> Dictionary:
	if course == null or course.mode != "race" or course.humans != null: return {}
	var moi = null
	for r in course.results:
		if r.car == course.player: moi = r
	if moi == null or moi.pos != 1 or not course.player.finished: return {}
	var rang := NIVEAUX.find(difficulte)
	if rang < 0: return {}
	var circuit := course.track.id
	var voiture := course.player.cls.id
	var ancien := de(circuit, voiture)
	if course.laps < TOURS_MIN: return { rang = rang, ancien = ancien, nouveau = false, raison = "tours" }
	if not App.reglages.has("palmares"): App.reglages.palmares = {}
	var nouveau := rang > ancien
	if nouveau:
		App.reglages.palmares[circuit + "|" + voiture] = rang
		App.sauve()
	return { rang = rang, ancien = ancien, nouveau = nouveau, raison = "" }


## Le nom d'un trophée et son niveau : « Argent (Difficile) ».
static func nom(rang: int) -> String:
	return "%s (%s)" % [Textes.t("trophee_" + TROPHEES[rang]), Textes.t(NIVEAUX[rang]).capitalize()]


## Les cinq trophées, dessinés comme dans le jeu web (tropheeSVG) : une médaille pendue à son
## ruban, une bouchée en moins pour le chocolat ; le crâne sur un disque noir.
static func texture(rang: int, taille := 64) -> Texture2D:
	var cle := "%d/%d" % [rang, taille]
	if _textures.has(cle): return _textures[cle]
	var nomT: String = TROPHEES[rang]
	var c: Dictionary = COULEURS[nomT]
	var contour := "#171c19"
	var ruban := '<path d="M8.5 1.5h6l3.2 11.5h-6z" fill="#c92c23" stroke="%s" stroke-width="1.2" stroke-linejoin="round"/><path d="M23.5 1.5h-6l-3.2 11.5h6z" fill="#264f8f" stroke="%s" stroke-width="1.2" stroke-linejoin="round"/>' % [contour, contour]
	var etoile := "M16 14.6l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z"
	var face := ""
	if nomT == "crane":
		face = ('<circle cx="16" cy="20.5" r="10" fill="{f}" stroke="{t}" stroke-width="1.4"/><circle cx="16" cy="20.5" r="8.3" fill="none" stroke="{r}" stroke-width="1"/>'
			+ '<path d="M16 13.2c-3.7 0-6.2 2.6-6.2 6 0 2 .9 3.4 2.1 4.2v2.4h8.2v-2.4c1.2-.8 2.1-2.2 2.1-4.2 0-3.4-2.5-6-6.2-6z" fill="#f3eee2" stroke="{t}" stroke-width=".9"/>'
			+ '<ellipse cx="13.5" cy="19.6" rx="1.7" ry="1.9" fill="{t}"/><ellipse cx="18.5" cy="19.6" rx="1.7" ry="1.9" fill="{t}"/><path d="M16 21.6l-1 1.6h2z" fill="{t}"/>'
			+ '<path d="M13.9 23.9v2M15.3 23.9v2M16.7 23.9v2M18.1 23.9v2" stroke="{t}" stroke-width=".7"/>').format({ f = c.face, t = contour, r = c.reflet })
	else:
		var disque := "M25.44 17.19A10 10 0 1 1 21.82 12.37A3.6 3.6 0 0 0 25.44 17.19Z" if nomT == "chocolat" else "M26 20.5A10 10 0 1 1 6 20.5A10 10 0 1 1 26 20.5Z"
		face = ('<path d="{d}" fill="{b}" stroke="{t}" stroke-width="1.4" stroke-linejoin="round"/><circle cx="16" cy="20.5" r="7.6" fill="{f}"/>'
			+ '<path d="M10.6 16.4a7.6 7.6 0 0 1 8.6-3.2" fill="none" stroke="{r}" stroke-width="1.4" stroke-linecap="round"/>'
			+ '<path d="{e}" fill="{r}" stroke="{b}" stroke-width=".6" stroke-linejoin="round"/>').format({ d = disque, b = c.bord, t = contour, f = c.face, r = c.reflet, e = etoile })
	var svg := '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">%s%s</svg>' % [ruban, face]
	var im := Image.new()
	im.load_svg_from_string(svg, taille / 32.0)
	var tex := ImageTexture.create_from_image(im)
	_textures[cle] = tex
	return tex


## Le nuage (nuageSVG) : où vit le palmarès — gris sur l'appareil, blanc sur le compte, avec un
## « ! » rouge si l'envoi a échoué.
static func nuage(etat: String, taille := 30) -> Texture2D:
	var cle := "nuage/%s/%d" % [etat, taille]
	if _textures.has(cle): return _textures[cle]
	var gris := etat == "local"
	var contour := "#8b877d" if gris else "#171c19"
	var corps := '<path d="M10.5 21H27a5.5 5.5 0 0 0 .9-10.93A8 8 0 0 0 12.6 8.4 6.3 6.3 0 0 0 10.5 21z" fill="%s" stroke="%s" stroke-width="1.6" stroke-linejoin="round"/>' % ["#d3cfc5" if gris else "#fff", contour]
	var plus := ""
	if etat == "erreur": plus = '<circle cx="28" cy="18" r="5" fill="#c92c23" stroke="#171c19" stroke-width="1.2"/><path d="M28 15.1v3.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="28" cy="20.6" r="1" fill="#fff"/>'
	if etat == "synchro": plus = '<path d="M15.3 14.6a3.6 3.6 0 0 1 6.2-2.3" fill="none" stroke="#2f6db5" stroke-width="1.7" stroke-linecap="round"/><path d="M22.7 15.4a3.6 3.6 0 0 1-6.2 2.3" fill="none" stroke="#2f6db5" stroke-width="1.7" stroke-linecap="round"/>'
	var svg := '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 26" width="36" height="26">%s%s</svg>' % [corps, plus]
	var im := Image.new()
	im.load_svg_from_string(svg, taille / 36.0)
	var tex := ImageTexture.create_from_image(im)
	_textures[cle] = tex
	return tex
