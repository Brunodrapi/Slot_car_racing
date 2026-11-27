## LES ÉCRANS DU TÉLÉPHONE, d'après la maquette (essais/maquette-paddock) : un paddock sur un seul écran,
## des feuilles qui montent du bas, le championnat comme un mode du menu, la table du multijoueur sur le
## modèle du paddock. Ce fichier tient ce que tous ces écrans partagent : les couleurs et les tailles de la
## maquette (en points d'un téléphone de 390 de large), les mots nouveaux, et de quoi bâtir une ligne,
## une pastille, une carte ou la barre du bas.
class_name Tel
extends RefCounted

# les couleurs de la maquette (maquette.css, :root)
const PAPIER := Color("#efe3c4")
const CARTE := Color("#fbf4e2")
const ENCRE := Color("#171b19")
const ENCRE_DOUCE := Color("#4d4f48")
const FILET := Color("#b9ab8a")
const ROUGE := Color("#d0342b")
const VERT := Color("#2aa85a")
const VERT_CLAIR := Color("#6fdc8c")
const VIOLET := Color("#c9a7ff")
const NUIT := Color("#20263a")
const GRIS := Color("#9aa39b")
const JAUNE := Color("#ffd23c")
const W := 390.0                       # la largeur d'un téléphone, en points : tout se dessine à cette échelle
const NIVEAUX_COULEURS := [Color("#2a9d4f"), Color("#2f6fd6"), Color("#d0342b"), Color("#171b19")]

## Les écrans du téléphone remplacent ceux d'avant sur un écran tactile tenu debout.
static func actif() -> bool:
	# GRIP_TEL=0 : les écrans d'avant (les essais qui les photographient)
	if OS.get_environment("GRIP_TEL") == "0" or not Style.tactile(): return false
	var boucle := Engine.get_main_loop() as SceneTree
	if boucle == null: return false
	var t := boucle.root.get_visible_rect().size
	return t.x < t.y


# ---------- les mots ----------
const FR := {
	retour = "RETOUR", fermer = "FERMER", changer = "CHANGER", garage = "GARAGE", reglages = "RÉGLAGES",
	enPiste = "EN PISTE !", championnat = "CHAMPIONNAT", course = "COURSE", manche = "MANCHE",
	tours = "TOURS", difficulte = "DIFFICULTÉ", moment = "MOMENT", jour = "JOUR", nuit = "NUIT", f1Jour = "Les F1 roulent de jour",
	recordBattre = "RECORD À BATTRE", tonRecord = "Ton record %s", pasDeTour = "Pas encore de tour à toi", personne = "Personne encore",
	avecToi = "AVEC TOI", fantomeGuide = "FANTÔME ET GUIDE", fantomeTexte = "Ta voiture au niveau Cauchemar, sur la ligne idéale",
	circuit = "CIRCUIT", degats = "DÉGÂTS", degatsTexte = "Les chocs abîment la carrosserie et te ralentissent.",
	adversaires = "ADVERSAIRES", adversairesTexte = "De 1 à 11.", freinage = "FREINAGE", freinageTexte = "Propre à ce circuit et à cette voiture.",
	freinageTable = "Propre à ce circuit et à cette voiture, à toi seul.", parDefaut = "PAR DÉFAUT", parDefautTexte = "Le freinage de la voiture, sans réglage.",
	reglageEnregistre = "Un réglage enregistré.", reglerFrein = "RÉGLER LE FREINAGE", reglerTexte = "Des tours d'essai pour trouver ton point de freinage.",
	regler = "RÉGLER", mondial = "TABLEAU MONDIAL", seConnecter = "SE CONNECTER",
	stats_vmax = "VITESSE MAX.", stats_grip = "ADHÉRENCE", stats_acc = "ACCÉLÉRATION", stats_poids = "POIDS", stats_frein = "FREINAGE",
	legendeEchelle = "Les barres comparent les %d voitures du jeu sur une même échelle.", legendeAvant = "Trait rouge : la %s, ta voiture en ouvrant le garage.",
	toutes = "TOUTES", catImposee = "Le championnat se court en %s : tu changes de voiture dans la catégorie.",
	catTable = "L'hôte a choisi la catégorie %s pour la table.",
	diff_easy = "Les adversaires freinent tôt et pardonnent les erreurs.", diff_medium = "Une course disputée, à la portée de tous.",
	diff_hard = "Il faut des trajectoires propres pour gagner.", diff_extreme = "Les adversaires ne laissent rien passer.",
	diff_cauchemar = "Laisse tomber, c'est impossible.",
	niv1 = "FACILE", niv2 = "MOYEN", niv3 = "DIFFICILE", niv4 = "EXTRÊME",
	longueur = "LONGUEUR", virages = "VIRAGES", recordCircuit = "RECORD DU CIRCUIT", mesTours = "MES TOURS", plusDetails = "Plus de détails",
	rayon = "Rayon minimal", droite = "Plus longue ligne droite", pointe = "Vitesse de pointe", toursTous = "Tours de tous les pilotes",
	chronosCircuit = "CHRONOS DU CIRCUIT", voiture = "VOITURE", colTonRecord = "TON RECORD", colMonde = "MONDE",
	paddock = "PADDOCK", table = "TABLE", chronosFiche = "Chronos et fiche du circuit",
	# le championnat
	classement = "CLASSEMENT", tuEs = "Tu es %s", premier = "1er", nieme = "%de", calendrier = "CALENDRIER", seances = "SÉANCES",
	essais = "ESSAIS", qualifs = "QUALIFICATIONS", grille = "GRILLE DE DÉPART", taPlace = "TA PLACE", auto = "AUTO",
	placeFixee = "Fixée pour toutes les courses.", placeAuto = "Auto : les qualifications, ou le tirage.",
	seanceMin = "%d min avant chaque course", pasDeSeance = "Pas de séance", ajouterCircuit = "+ AJOUTER UN CIRCUIT",
	ajouteAide = "Toucher un circuit l'ajoute à la fin du calendrier.", dejaAuCalendrier = " déjà au calendrier",
	auMoinsUn = "Ajoute au moins un circuit pour lancer le championnat.", lancer = "LANCER", bareme = "BARÈME %s",
	toutesCourses = "%s : toutes les courses dans cette catégorie.", avancer = "AVANCER", avancerTexte = "Courir ce circuit plus tôt.",
	reculer = "RECULER", reculerTexte = "Courir ce circuit plus tard.", retirer = "RETIRER DU CALENDRIER",
	figeSolo = "Le calendrier et la grille sont figés jusqu'à la fin. Pour arrêter : « Réglages », « Abandonner le championnat ».",
	figeTable = "Le calendrier est figé jusqu'à la fin. L'hôte peut arrêter le championnat dans « Réglages ».",
	abandonner = "ABANDONNER LE CHAMPIONNAT", abandonnerTexte = "Les points sont perdus.", abandonTitre = "ABANDONNER LE CHAMPIONNAT ?",
	abandonPhrase = "Le championnat s'arrête : ses points sont perdus. Le calendrier reste, pour en relancer un.",
	abandonOui = "ABANDONNER", continuer = "CONTINUER LE CHAMPIONNAT", enCours = "En cours · course %d/%d",
	apres = "Après %d %s sur %d. Les flèches : les places gagnées ou perdues à la dernière %s.", aucune = "Aucune %s courue : le classement commence à la première.",
	coursesMot = "course", coursesMots = "courses", manchesMot = "manche", manchesMots = "manches",
	toursMot = "%d tours", minMot = "%d min", seanceDe = "séance de %d min",
	arrivee = "ARRIVÉE", finSeance = "FIN DE LA SÉANCE", simulee = "%s · %s %d sur %d", final = "final", apresN = "après %d %s sur %d",
	suivante = "%s SUIVANTE", voirPodium = "VOIR LE PODIUM", champion = "CHAMPION !", podium = "PODIUM",
	nouveauChamp = "NOUVEAU CHAMPIONNAT", menu = "MENU", gagnes = "Tu gagnes le championnat avec %s points.",
	montes = "Tu montes sur le podium : %s, %s points.", finis = "Tu finis %s sur %d, avec %s points.", gagne = "%s gagne le championnat.",
	champSous = "Championnat %s · %d %s", toi = "Toi", pts = "%s pts", recommencer = "RECOMMENCER", sessionSuivante = "SÉANCE SUIVANTE",
	tropheeTours = "Il faut %d tours pour un trophée.",
	# le multijoueur
	multijoueur = "MULTIJOUEUR", multiIntro = "Une table, jusqu'à huit pilotes, et des voitures de l'IA pour compléter la grille. L'un la crée, les autres la rejoignent avec son code.",
	creerTable = "CRÉER UNE TABLE", rejoindreTable = "REJOINDRE UNE TABLE", codeLabel = "Le code que l'hôte t'a donné",
	rejoindre = "REJOINDRE", regarder = "REGARDER", regarderAide = "« Regarder » : tu suis la course sans piloter.",
	trouverJoueurs = "TROUVER DES JOUEURS", discordTexte = "Le Discord de GRIP, pour trouver une table.", connexion = "Connexion…",
	quitter = "QUITTER", tableCode = "TABLE %s", pilotes = "PILOTES", codeTable = "Code de la table", partager = "PARTAGER",
	codeCopie = "Code %s copié : envoie-le à tes amis.", hote = "hôte", enAttente = "En attente", pret = "PRÊT ?", estPret = "PRÊT",
	depart = "DÉPART !", nPrets = "%d/%d PRÊTS", attendre = "EN ATTENTE", donneCode = "Donne le code à tes amis",
	lHoteLance = "L'hôte lancera la course.", lance = "Lance",
	format = "FORMAT", formatCourse = "COURSE", formatClm = "CONTRE-LA-MONTRE", sansIA = "Sans IA : un duel", iaN = "IA : %s",
	formatCourseTexte = "Tous ensemble. Avec ou sans voitures de l'IA (Réglages) : sans elles, c'est un duel.",
	formatClmTexte = "Chacun roule seul, le meilleur tour gagne.", categorie = "CATÉGORIE",
	categorieAide = "Chacun choisit sa voiture dans la catégorie de la table. Une voiture d'une autre catégorie change d'elle-même.",
	toutesTexte = "Chacun prend la voiture qu'il veut.", nVoitures = "%d voitures.", choisiHote = "CHOISI PAR L'HÔTE",
	regleeHote = "Réglée par l'hôte.", voituresIA = "VOITURES DE L'IA", iaTexte = "Auto, ou de 0 à %d. Sans IA, la course est un duel.",
	iaFixe = "Celles du départ du championnat.", iaDuel = "0 : UN DUEL", activees = "ACTIVÉS", coupees = "COUPÉS",
	spectateur = "REGARDER SANS PILOTER", spectateurTexte = "Tu suis la course sans prendre de place sur la grille.",
	quitterTitre = "QUITTER LA TABLE ?", quitterHote = "Tu es l'hôte : la table se fermera pour tout le monde.",
	quitterInvite = "Tu pourras revenir avec le même code.", quitterOui = "QUITTER LA TABLE", rester = "RESTER",
	membres = "%d/8 pilotes%s. Le temps en ms est un aller-retour avec chacun : au-delà de 150, la course peut sauter.",
	spectateurs = " · %d spectateur(s)", tuRegardes = "Tu regardes : la course s'affichera quand l'hôte la lancera.",
	champTableCourse = "chaque manche est une course%s.", avecIA = ", avec l'IA", duelEntre = ", un duel entre vous, sans IA",
	champTableClm = "chaque manche est une séance de qualifications : le meilleur tour de chacun marque les points.",
	champTableReglage = "Le format et la catégorie se règlent à la table.", arreter = "ARRÊTER LE CHAMPIONNAT",
	arreterTexte = "Pour toute la table : les points sont perdus.", arreterTitre = "ARRÊTER LE CHAMPIONNAT ?",
	arreterPhrase = "Le championnat s'arrête pour toute la table : ses points sont perdus. Le calendrier reste, pour en relancer un.",
	arreterOui = "ARRÊTER", seance = "SÉANCE", baremeClm = "%s pts pour le meilleur tour de la séance, %s pour le deuxième ; pas de point de pole.",
	clmGodot = "Le championnat de contre-la-montre demande que chaque pilote ait la version Godot.",
	retourTable = "RETOUR À LA TABLE", quitterTableBtn = "QUITTER LA TABLE", toutesCat = "Toutes catégories", vingtCinq = "25 pts pour la victoire.",
}

const EN := {
	retour = "BACK", fermer = "CLOSE", changer = "CHANGE", garage = "GARAGE", reglages = "SETTINGS",
	enPiste = "ON TRACK!", championnat = "CHAMPIONSHIP", course = "RACE", manche = "ROUND",
	tours = "LAPS", difficulte = "DIFFICULTY", moment = "TIME", jour = "DAY", nuit = "NIGHT", f1Jour = "F1 races by day",
	recordBattre = "RECORD TO BEAT", tonRecord = "Your best %s", pasDeTour = "No lap of yours yet", personne = "Nobody yet",
	avecToi = "WITH YOU", fantomeGuide = "GHOST AND GUIDE", fantomeTexte = "Your car at Nightmare level, on the ideal line",
	circuit = "TRACK", degats = "DAMAGE", degatsTexte = "Hits damage the bodywork and slow you down.",
	adversaires = "OPPONENTS", adversairesTexte = "From 1 to 11.", freinage = "BRAKING", freinageTexte = "For this track and this car.",
	freinageTable = "For this track and this car, yours only.", parDefaut = "DEFAULT", parDefautTexte = "The car's own braking, untuned.",
	reglageEnregistre = "A saved setting.", reglerFrein = "TUNE THE BRAKING", reglerTexte = "Practice laps to find your braking point.",
	regler = "TUNE", mondial = "WORLD BOARD", seConnecter = "SIGN IN",
	stats_vmax = "TOP SPEED", stats_grip = "GRIP", stats_acc = "ACCELERATION", stats_poids = "WEIGHT", stats_frein = "BRAKING",
	legendeEchelle = "The bars compare the game's %d cars on one scale.", legendeAvant = "Red mark: the %s, your car when you opened the garage.",
	toutes = "ALL", catImposee = "The championship is run in %s: you change cars within the class.",
	catTable = "The host chose the %s class for the table.",
	diff_easy = "Opponents brake early and forgive mistakes.", diff_medium = "A real race, within everyone's reach.",
	diff_hard = "You need clean lines to win.", diff_extreme = "Opponents let nothing go.",
	diff_cauchemar = "Forget it, it's impossible.",
	niv1 = "EASY", niv2 = "MEDIUM", niv3 = "HARD", niv4 = "EXTREME",
	longueur = "LENGTH", virages = "CORNERS", recordCircuit = "TRACK RECORD", mesTours = "MY LAPS", plusDetails = "More details",
	rayon = "Tightest radius", droite = "Longest straight", pointe = "Top speed", toursTous = "Laps by all drivers",
	chronosCircuit = "TRACK TIMES", voiture = "CAR", colTonRecord = "YOUR BEST", colMonde = "WORLD",
	paddock = "PADDOCK", table = "TABLE", chronosFiche = "Track times and facts",
	classement = "STANDINGS", tuEs = "You're %s", premier = "1st", nieme = "%dth", calendrier = "CALENDAR", seances = "SESSIONS",
	essais = "PRACTICE", qualifs = "QUALIFYING", grille = "STARTING GRID", taPlace = "YOUR SLOT", auto = "AUTO",
	placeFixee = "The same for every race.", placeAuto = "Auto: qualifying, or the draw.",
	seanceMin = "%d min before each race", pasDeSeance = "No session", ajouterCircuit = "+ ADD A TRACK",
	ajouteAide = "Tapping a track adds it at the end of the calendar.", dejaAuCalendrier = " already on the calendar",
	auMoinsUn = "Add at least one track to start the championship.", lancer = "START", bareme = "%s SCORING",
	toutesCourses = "%s: every race in this class.", avancer = "EARLIER", avancerTexte = "Race this track sooner.",
	reculer = "LATER", reculerTexte = "Race this track later.", retirer = "REMOVE FROM THE CALENDAR",
	figeSolo = "The calendar and the grid are fixed until the end. To stop: “Settings”, “Abandon the championship”.",
	figeTable = "The calendar is fixed until the end. The host can stop the championship in “Settings”.",
	abandonner = "ABANDON THE CHAMPIONSHIP", abandonnerTexte = "The points are lost.", abandonTitre = "ABANDON THE CHAMPIONSHIP?",
	abandonPhrase = "The championship stops: its points are lost. The calendar stays, to start another one.",
	abandonOui = "ABANDON", continuer = "KEEP RACING", enCours = "Under way · race %d/%d",
	apres = "After %d %s of %d. Arrows: places won or lost in the last %s.", aucune = "No %s run yet: the standings start with the first one.",
	coursesMot = "race", coursesMots = "races", manchesMot = "round", manchesMots = "rounds",
	toursMot = "%d laps", minMot = "%d min", seanceDe = "%d min session",
	arrivee = "FINISH", finSeance = "END OF SESSION", simulee = "%s · %s %d of %d", final = "final", apresN = "after %d %s of %d",
	suivante = "NEXT %s", voirPodium = "SEE THE PODIUM", champion = "CHAMPION!", podium = "PODIUM",
	nouveauChamp = "NEW CHAMPIONSHIP", menu = "MENU", gagnes = "You win the championship with %s points.",
	montes = "You're on the podium: %s, %s points.", finis = "You finish %s of %d, with %s points.", gagne = "%s wins the championship.",
	champSous = "%s championship · %d %s", toi = "You", pts = "%s pts", recommencer = "RETRY", sessionSuivante = "NEXT SESSION",
	tropheeTours = "A trophy takes %d laps.",
	multijoueur = "MULTIPLAYER", multiIntro = "A table, up to eight drivers, and AI cars to fill the grid. One creates it, the others join with its code.",
	creerTable = "CREATE A TABLE", rejoindreTable = "JOIN A TABLE", codeLabel = "The code the host gave you",
	rejoindre = "JOIN", regarder = "WATCH", regarderAide = "“Watch”: follow the race without driving.",
	trouverJoueurs = "FIND PLAYERS", discordTexte = "GRIP's Discord, to find a table.", connexion = "Connecting…",
	quitter = "LEAVE", tableCode = "TABLE %s", pilotes = "DRIVERS", codeTable = "Table code", partager = "SHARE",
	codeCopie = "Code %s copied: send it to your friends.", hote = "host", enAttente = "Waiting", pret = "READY?", estPret = "READY",
	depart = "START!", nPrets = "%d/%d READY", attendre = "WAITING", donneCode = "Give the code to your friends",
	lHoteLance = "The host will start the race.", lance = "Starts",
	format = "FORMAT", formatCourse = "RACE", formatClm = "TIME TRIAL", sansIA = "No AI: a duel", iaN = "AI: %s",
	formatCourseTexte = "Everyone together. With or without AI cars (Settings): without them, it's a duel.",
	formatClmTexte = "Each drives alone, the best lap wins.", categorie = "CLASS",
	categorieAide = "Everyone picks a car in the table's class. A car from another class changes by itself.",
	toutesTexte = "Everyone takes the car they want.", nVoitures = "%d cars.", choisiHote = "CHOSEN BY THE HOST",
	regleeHote = "Set by the host.", voituresIA = "AI CARS", iaTexte = "Auto, or 0 to %d. Without AI, the race is a duel.",
	iaFixe = "The ones from the championship start.", iaDuel = "0: A DUEL", activees = "ON", coupees = "OFF",
	spectateur = "WATCH WITHOUT DRIVING", spectateurTexte = "You follow the race without a place on the grid.",
	quitterTitre = "LEAVE THE TABLE?", quitterHote = "You're the host: the table will close for everyone.",
	quitterInvite = "You can come back with the same code.", quitterOui = "LEAVE THE TABLE", rester = "STAY",
	membres = "%d/8 drivers%s. The ms time is a round trip with each one: above 150, the race may skip.",
	spectateurs = " · %d spectator(s)", tuRegardes = "You're watching: the race will show when the host starts it.",
	champTableCourse = "each round is a race%s.", avecIA = ", with AI", duelEntre = ", a duel between you, no AI",
	champTableClm = "each round is a qualifying session: everyone's best lap scores the points.",
	champTableReglage = "The format and the class are set at the table.", arreter = "STOP THE CHAMPIONSHIP",
	arreterTexte = "For the whole table: the points are lost.", arreterTitre = "STOP THE CHAMPIONSHIP?",
	arreterPhrase = "The championship stops for the whole table: its points are lost. The calendar stays, to start another one.",
	arreterOui = "STOP", seance = "SESSION", baremeClm = "%s pts for the session's best lap, %s for second; no pole point.",
	clmGodot = "A time-trial championship needs every driver on the Godot version.",
	retourTable = "BACK TO THE TABLE", quitterTableBtn = "LEAVE THE TABLE", toutesCat = "All classes", vingtCinq = "25 pts for the win.",
}


static func t(cle: String, args = null) -> String:
	var d: Dictionary = EN if Textes.langue() == "en" else FR
	var s: String
	if d.has(cle): s = d[cle]
	elif FR.has(cle): s = FR[cle]
	else: return Textes.t(cle, args)
	if args == null: return s
	return s % args


## « 1er », « 2e » ; « 1st », « 2nd », « 3rd », « 4th ».
static func rang(n: int) -> String:
	if Textes.langue() == "en":
		var fin := "th"
		if n % 100 < 11 or n % 100 > 13: fin = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
		return "%d%s" % [n, fin]
	return "1er" if n == 1 else "%de" % n


## « 1 tour », « 5 tours ».
static func nbTours(n: int) -> String:
	if Textes.langue() == "en": return "1 lap" if n == 1 else "%d laps" % n
	return "1 tour" if n == 1 else "%d tours" % n


static func points(p: float) -> String:
	return t("pts", Championnat.formatPoints(p))


# ---------- les polices ----------
## Les titres et les valeurs : la Barlow Condensed noire italique du jeu, en capitales.
static func titre(texte: String, taille: int, couleur := ENCRE) -> Label:
	var l := Label.new()
	l.text = texte.to_upper()
	l.add_theme_font_override("font", Style.racing())
	l.add_theme_font_size_override("font_size", taille)
	l.add_theme_color_override("font_color", couleur)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


## Les phrases : la police sans empattement du moteur, en petit.
static func texte(t: String, taille := 13, couleur := ENCRE_DOUCE, coupe := true) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_override("font", ThemeDB.fallback_font)
	l.add_theme_font_size_override("font_size", taille)
	l.add_theme_color_override("font_color", couleur)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if coupe:
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return l


static func boite(vertical: bool, ecart := 0) -> BoxContainer:
	var b: BoxContainer = VBoxContainer.new() if vertical else HBoxContainer.new()
	b.add_theme_constant_override("separation", ecart)
	b.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return b


static func marge(c: Control, g: int, h: int, d: int, b: int) -> MarginContainer:
	var m := MarginContainer.new()
	m.add_theme_constant_override("margin_left", g)
	m.add_theme_constant_override("margin_top", h)
	m.add_theme_constant_override("margin_right", d)
	m.add_theme_constant_override("margin_bottom", b)
	m.mouse_filter = Control.MOUSE_FILTER_IGNORE
	m.add_child(c)
	return m


static func espace(largeur := 0.0, hauteur := 0.0) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(largeur, hauteur)
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if largeur == 0 and hauteur == 0: c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return c


## Un fond plein (une carte, un encart), avec son bord.
static func fond(c: Control, couleur: Color, bord := Color(0, 0, 0, 0), epaisseur := 0) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = couleur
	if epaisseur > 0:
		sb.border_color = bord
		sb.set_border_width_all(epaisseur)
	p.add_theme_stylebox_override("panel", sb)
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	p.add_child(c)
	return p


static func image(tex: Texture2D, taille: Vector2) -> TextureRect:
	var r := TextureRect.new()
	r.texture = tex
	r.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	r.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	r.custom_minimum_size = taille
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r


# ---------- les morceaux de la maquette ----------
## Une ligne (.ligne) : le nom en capitales, la phrase dessous, et à droite ce qu'on veut (une valeur,
## un « − + », un interrupteur, un bouton). Rendue comme un bouton quand `action` est donnée.
static func ligne(nom: String, phrase: String, droite: Control = null, action := Callable(), couleurNom := ENCRE) -> Control:
	var h := boite(false, 10)
	var gauche := boite(true, 2)
	gauche.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	gauche.alignment = BoxContainer.ALIGNMENT_CENTER
	gauche.add_child(titre(nom, 20, couleurNom))
	if phrase != "": gauche.add_child(texte(phrase))
	h.add_child(gauche)
	if droite:
		droite.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		h.add_child(droite)
	if action.is_valid():
		var b := ToucheTel.new(CARTE)
		b.bord = FILET
		b.epaisseur = 1
		b.marges(10, 8, 10, 8)
		b.custom_minimum_size.y = 60
		b.ajoute(h)
		b.pressed.connect(action)
		return b
	var p := fond(marge(h, 10, 8, 10, 8), CARTE, FILET, 1)
	p.custom_minimum_size.y = 60
	return p


## Une valeur verte (.valeur), à droite d'une ligne.
static func valeur(t: String, couleur := VERT) -> Label:
	return titre(t, 18, couleur)


## « − valeur + » (.pas) : `change` reçoit -1 ou +1.
static func pas(valeurTexte: String, change: Callable, moinsPossible: bool, plusPossible: bool, petit := false) -> HBoxContainer:
	var h := boite(false, 4)
	var cote := 44.0
	var moins := ToucheTel.signeSeul("moins", ENCRE, PAPIER, Vector2(cote, cote))
	moins.eteint(not moinsPossible)
	moins.pressed.connect(change.bind(-1))
	var plus := ToucheTel.signeSeul("plus", ENCRE, PAPIER, Vector2(cote, cote))
	plus.eteint(not plusPossible)
	plus.pressed.connect(change.bind(1))
	var v := titre(valeurTexte, 15 if petit else 20)
	v.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.custom_minimum_size.x = 0 if petit else 52
	h.add_child(moins)
	h.add_child(v)
	h.add_child(plus)
	return h


## L'interrupteur (.interrupteur) : 52 × 32, vert quand il est mis.
static func interrupteur(mis: bool) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(52, 32)
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.draw.connect(func():
		var sb := StyleBoxFlat.new()
		sb.bg_color = VERT if mis else GRIS
		sb.set_corner_radius_all(16)
		c.draw_style_box(sb, Rect2(Vector2.ZERO, Vector2(52, 32)))
		c.draw_circle(Vector2(39 if mis else 13, 16), 13, Color.WHITE, true, -1, true))
	return c


## Un choix d'une liste (.choix button) : le nom, la phrase, la coche verte quand c'est lui.
static func choix(nom: String, phrase: String, sel: bool, action: Callable, danger := false) -> ToucheTel:
	var b := ToucheTel.new(CARTE)
	b.bord = VERT if sel else FILET
	b.epaisseur = 2
	b.marges(12, 6, 12, 6)
	b.custom_minimum_size.y = 56
	var h := boite(false, 10)
	var g := boite(true, 0)
	g.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	g.alignment = BoxContainer.ALIGNMENT_CENTER
	g.add_child(titre(nom, 21, ROUGE if danger else ENCRE))
	if phrase != "": g.add_child(texte(phrase))
	h.add_child(g)
	b.ajoute(h)
	if sel: b.coche = VERT
	b.pressed.connect(action)
	return b


## Un petit titre de section (.petit-titre), avec son complément en petit.
static func sousTitre(t: String, complement := "") -> Control:
	var h := boite(false, 6)
	h.add_child(titre(t, 22))
	if complement != "":
		var c := texte(complement, 14, ENCRE_DOUCE, false)
		c.size_flags_vertical = Control.SIZE_SHRINK_END
		h.add_child(c)
	return marge(h, 0, 4, 0, 0)


## Un encart d'aide (.aide).
static func aide(t: String) -> Label:
	return texte(t, 14, ENCRE_DOUCE)


## Le barème (.bareme) : le liseré rouge à gauche.
static func encartBareme(gras: String, suite: String) -> Control:
	var h := boite(false, 0)
	var bande := ColorRect.new()
	bande.color = ROUGE
	bande.custom_minimum_size.x = 4
	bande.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(bande)
	var l := boite(true, 2)
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	l.add_child(titre(gras, 15))
	l.add_child(texte(suite, 14, ENCRE))
	var ml := marge(l, 10, 8, 10, 8)
	ml.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(ml)
	return fond(h, CARTE)


## La difficulté d'un circuit en mots, aux couleurs des pistes de ski (.niveau-circuit).
static func niveau(n: int) -> Control:
	var i := clampi(n, 1, 4)
	var l := titre(t("niv%d" % i), 13, Color.WHITE)
	return fond(marge(l, 7, 2, 7, 1), NIVEAUX_COULEURS[i - 1])


static func niveauDessine(ci: CanvasItem, n: int, p: Vector2, droite := false) -> float:
	var i := clampi(n, 1, 4)
	var mot := t("niv%d" % i)
	var w := Style.largeur(mot, 13) + 14
	var x := p.x - w if droite else p.x
	ci.draw_rect(Rect2(x, p.y - 15, w, 18), NIVEAUX_COULEURS[i - 1])
	Style.texte(ci, mot, Vector2(x + 7, p.y - 1.5), 13, Color.WHITE)
	return w


## Le texte « petit » dessiné (sans empattement).
static func ecrit(ci: CanvasItem, t: String, p: Vector2, taille: int, c: Color, align := HORIZONTAL_ALIGNMENT_LEFT, largeur := -1.0) -> void:
	ci.draw_string(ThemeDB.fallback_font, p, t, align, largeur, taille, c)


static func largeurTexte(t: String, taille: int) -> float:
	return ThemeDB.fallback_font.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, taille).x


## La vignette d'une voiture (l'image du jeu, de trois quarts).
static func vignette(id: String, livree := 0) -> Texture2D:
	var d := Catalogue.dessin(id, livree)
	return Style.tex("res://images/vignettes/" + String(d.vignette)) if d.get("vignette") else null


## Le chrono (l'image du contre-la-montre), le rond du coin de la carte du circuit.
static func chrono() -> Texture2D:
	return Style.tex("res://images/interface/clock.webp")


## L'icône du soleil ou de la lune (la police n'a pas ☀ et ☾).
static func astre(ci: CanvasItem, c: Vector2, nuit: bool, couleur: Color) -> void:
	if nuit:
		ci.draw_circle(c, 6, couleur, true, -1, true)
		ci.draw_circle(c + Vector2(3, -2.5), 5.5, ENCRE, true, -1, true)
	else:
		ci.draw_circle(c, 3.6, couleur, true, -1, true)
		for i in 8:
			var d := Vector2.RIGHT.rotated(i * TAU / 8)
			ci.draw_line(c + d * 5.5, c + d * 7.8, couleur, 1.6, true)


## La coche (la police n'a pas ✓).
static func coche(ci: CanvasItem, c: Vector2, couleur: Color, taille := 9.0) -> void:
	ci.draw_polyline(PackedVector2Array([c + Vector2(-taille * 0.75, 0), c + Vector2(-taille * 0.2, taille * 0.55), c + Vector2(taille * 0.8, -taille * 0.6)]), couleur, taille * 0.32, true)


## Un signe dessiné, dans un petit contrôle qui se range comme un mot : « droite » (→), « gauche » (←),
## « haut » (▲), « bas » (▼), « etoile » (★), « coche » (✓). La police du jeu n'a aucun d'eux.
static func glyphe(nom: String, taille: float, couleur: Color) -> Control:
	var c := Control.new()
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.custom_minimum_size = Vector2(taille * (1.1 if nom in ["droite", "gauche"] else 0.8), taille)
	c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	c.draw.connect(func(): dessineGlyphe(c, nom, Rect2(Vector2.ZERO, c.size), couleur))
	return c


static func dessineGlyphe(ci: CanvasItem, nom: String, r: Rect2, couleur: Color) -> void:
	var m := r.get_center()
	var s := r.size.y
	match nom:
		"droite": BarreTitre.fleche(ci, m - Vector2(s * 0.42, 0), m + Vector2(s * 0.42, 0), couleur, maxf(1.6, s * 0.09), s * 0.24)
		"gauche": BarreTitre.fleche(ci, m + Vector2(s * 0.42, 0), m - Vector2(s * 0.42, 0), couleur, maxf(1.6, s * 0.09), s * 0.24)
		"haut": Style.plein(ci, PackedVector2Array([m + Vector2(0, -s * 0.3), m + Vector2(s * 0.32, s * 0.25), m + Vector2(-s * 0.32, s * 0.25)]), couleur)
		"bas": Style.plein(ci, PackedVector2Array([m + Vector2(-s * 0.32, -s * 0.25), m + Vector2(s * 0.32, -s * 0.25), m + Vector2(0, s * 0.3)]), couleur)
		"coche": coche(ci, m, couleur, s * 0.42)
		"etoile":
			var pts := PackedVector2Array()
			for i in 10:
				var rr := s * (0.42 if i % 2 == 0 else 0.18)
				pts.append(m + Vector2.UP.rotated(i * TAU / 10) * rr)
			ci.draw_colored_polygon(pts, couleur)


# ---------- la barre du bas ----------
## Un bouton noir de la barre du bas (.chip) : 48 de haut, en capitales de 16.
static func puce(t: String, action: Callable, dessous := "") -> ToucheTel:
	var b := ToucheTel.new(ENCRE)
	b.marges(12, 4, 12, 4)
	b.custom_minimum_size.y = 48
	if dessous == "":
		var l := titre(t, 16, PAPIER)
		l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		b.ajoute(l)
	else:
		# sur deux étages (.chip.etage) : le nom, puis en jaune ce qu'il dit
		var v := boite(true, 1)
		v.alignment = BoxContainer.ALIGNMENT_CENTER
		v.add_child(titre(t, 16, PAPIER))
		v.add_child(texte(dessous, 13, JAUNE, false))
		b.ajoute(v)
	b.pressed.connect(action)
	return b


## Le grand bouton rouge (.enpiste) : EN PISTE !, Départ, Lancer, Prêt ; la flèche dessinée après.
static func gros(t: String, action: Callable, fleche := true, couleur := ROUGE, taille := 28) -> ToucheTel:
	var b := ToucheTel.new(couleur)
	b.forme = ToucheTel.Forme.ENPISTE
	b.fondEteint = Color("#8b8b80")
	b.marges(22 if taille >= 28 else 14, 0, 22 if taille >= 28 else 14, 0)
	b.custom_minimum_size.y = 56
	var h := boite(false, 8)
	h.alignment = BoxContainer.ALIGNMENT_CENTER
	h.add_child(titre(t, taille, Color("#fbf4e2")))
	if fleche: h.add_child(glyphe("droite", taille * 0.62, Color("#fbf4e2")))
	b.ajoute(h)
	b.pressed.connect(action)
	return b


## La barre du bas (.barre-bas) : le papier, le trait d'encre au-dessus ; le grand bouton à droite.
static func barreBas(elements: Array, serree := false) -> Control:
	var h := boite(false, 6 if serree else 8)
	h.alignment = BoxContainer.ALIGNMENT_BEGIN
	for e in elements:
		if e is ToucheTel and (e as ToucheTel).forme == ToucheTel.Forme.ENPISTE:
			h.add_child(espace())
		h.add_child(e)
	var p := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = PAPIER
	sb.border_color = ENCRE
	sb.border_width_top = 2
	p.add_theme_stylebox_override("panel", sb)
	p.mouse_filter = Control.MOUSE_FILTER_PASS
	p.add_child(marge(h, 10, 8, 10, 10))
	return p


## Le nom d'une catégorie (F1, GT, GT3, Proto), « Toutes » pour « all » ou « tous ».
static func nomCat(id: String) -> String:
	if id == "all" or id == "tous" or id == "": return t("toutes")
	for c in Catalogue.categories():
		if c.id == id: return Textes.nom(c.nom)
	return id.to_upper()
