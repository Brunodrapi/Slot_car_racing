## LE JEU HORS LIGNE (js/maj.js du jeu web), pour la version web : tout télécharger pour jouer sans
## réseau — le moteur (dans le cache du service worker, web/hors-ligne.js) et les décors des circuits
## (dans les sauvegardes, comme ceux qu'une course télécharge : Decor).
##
## Rien ne se télécharge sans accord : l'écran titre le propose avec sa taille, « Non merci » ne le
## repropose plus, et les réglages gardent la ligne « Jeu hors ligne », avec le bouton pour télécharger
## ou supprimer. Une fois accepté, il le reste : ce qui manque ensuite (une nouvelle version, un décor
## revu) se complète au lancement suivant, avec du réseau.
##
## Les états : dev (pas la version web publiée : rien à montrer), verification, absent, installation,
## pret, erreur, indisponible (un navigateur sans service worker : sur iPhone, une page ouverte depuis
## une autre application). GRIP_HORS_LIGNE=<état> en impose un, pour photographier les écrans.
class_name HorsLigne

static var etat := "dev"
static var poids := 0                  # le jeu entier, en octets
static var manque := 0                 # ce qui reste à télécharger
static var fait := 0                   # pendant le téléchargement
static var total := 0
static var enLigne := true
static var tic := 0                    # change à chaque nouvelle : les écrans se repeignent
static var _verifEnCours := false


static func _pose(e: String) -> void:
	etat = e
	tic += 1


static func manifeste() -> Dictionary:
	if not OS.has_feature("web"): return {}
	var brut = JavaScriptBridge.eval("JSON.stringify(window.GRIP_HORS_LIGNE || null)", true)
	var d = JSON.parse_string(String(brut)) if brut != null else null
	return d if d is Dictionary and bool(JavaScriptBridge.eval("!!window.gripHL", true)) else {}


static func accepte() -> bool:
	return bool(App.reglages.get("horsLigne", false))


static func refuse() -> bool:
	return bool(App.reglages.get("horsLigneRefus", false))


static func version() -> String:
	return String(ProjectSettings.get_setting("application/config/version", ""))


## Des octets lisibles : « 151,3 Mo », « 120 ko » (js/ui.js, octets).
static func octets(n: int) -> String:
	var en := Textes.langue() == "en"
	if n >= 1000000:
		var s := "%.1f" % (n / 1000000.0)
		return (s if en else s.replace(".", ",")) + (" MB" if en else " Mo")
	return str(maxi(1, roundi(n / 1000.0))) + (" kB" if en else " ko")


## Les décors qui manquent : [[circuit, octets], …]
static func _decorsManquants(m: Dictionary) -> Array:
	var l := []
	var d: Dictionary = m.get("decors", {})
	for id in d:
		if Decor.cheminDe(String(id)) == "": l.append([String(id), int(d[id])])
	return l


static func verifier() -> void:
	var essai := OS.get_environment("GRIP_HORS_LIGNE")
	if essai != "":
		poids = 151300000
		manque = 0 if essai == "pret" else poids
		total = poids
		fait = roundi(poids * 0.42)
		_pose(essai)
		return
	if _verifEnCours: return
	var m := manifeste()
	if m.is_empty():
		_pose("dev")
		return
	_verifEnCours = true
	_pose("verification")
	JavaScriptBridge.eval("gripHL.verifier()", true)
	while not bool(JavaScriptBridge.eval("gripHL.verifie", true)):
		await App.get_tree().process_frame
	_verifEnCours = false
	poids = 0
	for f in m.get("moteur", {}): poids += int(m.moteur[f])
	for id in m.get("decors", {}): poids += int(m.decors[id])
	enLigne = bool(JavaScriptBridge.eval("navigator.onLine !== false", true))
	if not bool(JavaScriptBridge.eval("gripHL.sw", true)):
		_pose("indisponible")
		return
	manque = int(JavaScriptBridge.eval("gripHL.octets", true))
	for d in _decorsManquants(m): manque += int(d[1])
	if manque == 0:
		_pose("pret")
		return
	_pose("absent")
	# déjà accepté (une nouvelle version, un décor revu) : on complète sans redemander, avec du réseau
	if accepte() and enLigne: telecharger()


static func telecharger() -> void:
	if etat == "installation" or _verifEnCours or OS.get_environment("GRIP_HORS_LIGNE") != "": return
	var m := manifeste()
	if m.is_empty(): return
	App.reglages.horsLigne = true
	App.reglages.horsLigneRefus = false
	App.sauve()
	var decors := _decorsManquants(m)
	total = int(JavaScriptBridge.eval("gripHL.octets", true))
	for d in decors: total += int(d[1])
	fait = 0
	_pose("installation")
	JavaScriptBridge.eval("gripHL.telecharger()", true)
	while not bool(JavaScriptBridge.eval("gripHL.fini", true)):
		fait = int(JavaScriptBridge.eval("gripHL.fait", true))
		tic += 1
		await App.get_tree().process_frame
	if String(JavaScriptBridge.eval("gripHL.erreur", true)) != "":
		_pose("erreur")
		return
	var base := int(JavaScriptBridge.eval("gripHL.fait", true))
	for d in decors:
		var taille := int(d[1])
		var ok: bool = await Decor.telecharge(String(d[0]), App, func(f: float):
			fait = base + roundi(f * taille)
			tic += 1)
		if not ok:
			_pose("erreur")
			return
		base += taille
		fait = base
	verifier()


## « Non merci » : l'écran titre ne le propose plus ; les réglages gardent le bouton.
static func nonMerci() -> void:
	App.reglages.horsLigneRefus = true
	App.sauve()
	tic += 1


## Supprimer ce qui est téléchargé : le jeu redevient une page en ligne, la progression ne bouge pas.
static func supprimer() -> void:
	if not OS.has_feature("web") or OS.get_environment("GRIP_HORS_LIGNE") != "": return
	if not bool(JavaScriptBridge.eval("window.confirm(%s)" % JSON.stringify(Textes.t("hlConfirm")), true)): return
	App.reglages.horsLigne = false
	App.reglages.horsLigneRefus = true
	App.sauve()
	JavaScriptBridge.eval("gripHL.supprimer()", true)
	while not bool(JavaScriptBridge.eval("gripHL.fini", true)):
		await App.get_tree().process_frame
	var d := DirAccess.open("user://decors")
	if d:
		for f in d.get_files(): d.remove(f)
	verifier()


## Ce que dit l'écran titre (majAffiche) : le texte, et les boutons [[action, libellé, principal]].
static func ligneTitre() -> Dictionary:
	var v := version()
	match etat:
		"absent":
			if refuse() or not enLigne: return { texte = Textes.t("hlEnLigne", [v, octets(poids)]), boutons = [] }
			return { texte = Textes.t("hlPropose", octets(manque)),
				boutons = [["telecharger", Textes.t("hlTelecharger"), true], ["nonMerci", Textes.t("hlNonMerci"), false]] }
		"installation": return { texte = _progres(), boutons = [] }
		"pret": return { texte = Textes.t("majAJour" if enLigne else "majHorsLigne", [v, octets(poids)]), boutons = [] }
		"erreur": return { texte = Textes.t("hlEchec"), boutons = [] }
		"indisponible": return { texte = Textes.t("hlIndispo", [v, octets(poids)]), boutons = [] }
	return { texte = "", boutons = [] }


## La ligne « Jeu hors ligne » des réglages (horsLigneLigne) : l'état, et le bouton qui va avec.
static func ligneReglages() -> Dictionary:
	var v := version()
	match etat:
		"verification": return { texte = Textes.t("majVerif"), bouton = "" }
		"installation": return { texte = _progres(), bouton = "" }
		"pret": return { texte = Textes.t("hlTelechargeV", [v, octets(poids)]), bouton = "supprimer" }
		"indisponible": return { texte = Textes.t("hlIndispoReg", [v, octets(poids)]) + "\n" + Textes.t("hlIndispoAide"), bouton = "" }
		"erreur": return { texte = Textes.t("hlEchec"), bouton = "telecharger" }
		"absent": return { texte = Textes.t("hlNonTelecharge", [v, octets(manque)]), bouton = "telecharger" }
	return { texte = "", bouton = "" }


static func _progres() -> String:
	var p := roundi(100.0 * fait / maxf(1.0, total))
	return Textes.t("hlEnCours", [p, octets(fait), octets(total)])
