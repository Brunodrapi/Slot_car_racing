## La course d'une table en ligne (main.js, startOnline) : la grille que l'hôte a gelée, l'IA tirée à
## la graine du coup d'envoi, la conduite réseau. Toujours en GDScript : chaque écran ne simule que
## ses voitures, le C++ n'y gagnerait presque rien.
class_name CourseEnLigne
extends RefCounted


## `L` : ce que Net.onStart a donné. `voitureId` : la voiture de cet écran. Rend la course, avec son
## NetDrive et son relevé (RaceBroadcast) déjà branchés.
static func cree(piste: Piste, L: Dictionary, voitureId: String, net: Net, h: Hasard = null) -> Course:
	var modele := Catalogue.modele(voitureId)
	var cat: String = Catalogue.voiture(voitureId).cat
	var hote: Dictionary = L.humans[0]
	var catHote := ""
	if hote.get("modelId") is String and not Catalogue.voiture(hote.modelId).is_empty(): catHote = Catalogue.voiture(hote.modelId).cat
	# L'IA court dans la catégorie de la table, ou dans celle de l'hôte quand la table est ouverte.
	var catIA: String = String(L.cat) if L.get("cat", "all") != "all" else (catHote if catHote != "" else cat)
	var pilotes := 10
	for k in Catalogue.categories():
		if k.id == catIA: pilotes = int(k.get("drivers", 10))
	var places := maxi((L.humans as Array).size() + 1, mini(pilotes, 12))
	var graine := int(L.go) % 100000 if int(L.go) else 1
	var roster: Array = Catalogue.roster(places, 0, catIA, HasardGraine.new(graine)) if L.mode == "race" else []
	var moi = L.humans.filter(func(x): return x.local)
	var m: Dictionary = moi[0] if moi.size() else {}
	var modeles := Catalogue.voituresDe(cat)
	var c := Course.new(piste, {
		modele = modele, difficulte = Catalogue.difficulte(String(L.get("difficulty", "medium"))), mode = "race",
		laps = int(L.get("laps", 3)), difficultes = Catalogue.donnees.difficultes, humans = L.humans,
		aiFill = L.mode == "race", noContact = L.mode == "ghost", spectator = bool(L.get("spectator", false)),
		roster = roster, nLivreries = (Catalogue.donnees.livreries as Array).size(), nomJoueur = m.get("name", "Pilote"),
		livree = int(m.get("livree", 0)),
		# les dégâts : le choix de l'hôte ; une table du jeu web publié ne le porte pas, et n'en a pas
		degats = L.get("degats", false) == true,
		modeleDe = func(id, i): return Catalogue.modele(id) if id is String and id != "" and Catalogue.modele(id) else Catalogue.modele(modeles[i % modeles.size()].id),
	}, h if h != null else Hasard.new())
	c.broadcast = RaceBroadcast.new(c)
	net.drive = NetDrive.new(net, c)
	return c


## La voiture de cet écran dans une table : celle qu'il a annoncée, sinon celle de ses réglages.
static func voitureDe(L: Dictionary, defaut: String) -> String:
	var moi = L.humans.filter(func(h): return h.local)
	var h = moi[0] if moi.size() else L.humans[0]
	if h.get("modelId") is String and not Catalogue.voiture(h.modelId).is_empty(): return h.modelId
	return defaut
