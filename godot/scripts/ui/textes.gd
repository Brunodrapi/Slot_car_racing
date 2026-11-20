## Les textes du jeu, en français et en anglais. Les mots sont ceux du jeu web (js/ui.js, I18N),
## pour que les deux versions parlent la même langue.
class_name Textes
extends RefCounted

const FR := {
	quickRace = "COURSE RAPIDE", timeTrial = "CONTRE-LA-MONTRE", training = "ENTRAÎNEMENT",
	howto = "COMMENT JOUER", settings = "RÉGLAGES", pilot = "PILOTE : %s", quit = "QUITTER", back = "‹ RETOUR",
	proto = "Version Godot · %d circuits · %d voitures", all = "TOUTES",
	statVmax = "VITESSE MAX.", statA100 = "0-100 KM/H", statB100 = "FREINAGE 100-0", statGrip = "ADHÉRENCE",
	trackInfo = "%s · %d M · %d TOURS", myBest = "TON MEILLEUR TOUR ICI", myBestHint = "avec cette voiture, sur cet appareil",
	dayNight = "JOUR / NUIT : %s", day = "JOUR", night = "NUIT", difficulty = "DIFFICULTÉ : %s", laps = "TOURS : %d",
	opponents = "ADVERSAIRES : %d", view = "VUE : %s", viewFixed = "DEVANT", viewTrack = "TOURNANTE", onTrack = "EN PISTE !  ›",
	easy = "FACILE", medium = "NORMAL", hard = "DIFFICILE", extreme = "EXTRÊME", cauchemar = "CAUCHEMAR",
	pause = "PAUSE", resume = "REPRENDRE", restart = "RECOMMENCER",
	finishPos = "ARRIVÉE — P%d / %d", colDriver = "PILOTE", colTime = "TEMPS", colGap = "ÉCART", colPenalty = "PÉNALITÉ", colBest = "MEILLEUR TOUR",
	retry = "REJOUER", paddock = "PADDOCK",
	lap = "TOUR", lapVoid = "ANNULÉ", best = "MEILLEUR", you = "TOI", lineJaune = "JAUNE", lineRace = "IDÉALE", lineBleu = "BLEU",
	holdToGo = "Maintiens Espace pour accélérer", holdToGoTouch = "Maintiens l’écran pour accélérer",
	lineHintPC = "Flèches haut et bas : trajectoire   ·   manette : RT et stick", lineHintTouch = "Pouce gauche : trajectoire",
	go = "GO !", offTrack = "SORTIE DE PISTE !", engineCut = "MOTEUR COUPÉ", finished = "ARRIVÉE — P%d", lastLap = "DERNIER TOUR",
	guideGaz = "GAZ", guideDose = "DOSE", guideLeve = "LÂCHE",
	loading = "CHARGEMENT DU CIRCUIT… %d %%", loadFailed = "LE CIRCUIT N'A PAS PU SE CHARGER.\nVÉRIFIE LA CONNEXION, PUIS ÉCHAP.",
	newRecord = "NOUVEAU RECORD !  %s", lapDone = "TOUR %d · %s", ghost = "Fantôme", driverDefault = "Pilote",
	sName = "NOM DU PILOTE", sSound = "SON", sVolume = "VOLUME", sCamera = "CAMÉRA", sPull = "RECUL DE LA CAMÉRA", sSide = "LEVIER DE LIGNE",
	sGuide = "GUIDE DE FREINAGE EN COURSE", sFull = "PLEIN ÉCRAN", sLang = "LANGUE",
	on = "ACTIVÉ", off = "COUPÉ", camFixed = "DEVANT, NORD EN HAUT", camTrack = "DEVANT, TOURNE AVEC LA PISTE",
	left = "À GAUCHE", right = "À DROITE", shown = "AFFICHÉ", hidden = "MASQUÉ", yes = "OUI", no = "NON",
	sHint = "Manette : A pour valider, B pour revenir · Clavier : flèches, Entrée, Échap",
	h1 = "1  LES GAZ", h1a = "Tiens Espace enfoncée (ou RT à la manette).", h1t = "Tiens le doigt posé, ailleurs que sur le levier.",
	h1b = "Lâche avant le virage : la voiture freine seule. Trop vite, elle glisse et sort.",
	h2 = "2  LA LIGNE", h2a = "Flèches haut et bas (ou le stick).", h2t = "Glisse le levier à gauche de l'écran.",
	h2b = "Idéale au milieu, jaune à l'extérieur, bleue à l'intérieur : pour doubler ou se protéger.",
	h3 = "3  LE GRIP", h3a = "La pastille GRIP dit ce que font les pneus.",
	h3b = "Bleu, tout va bien ; vert, ça travaille ; jaune, ça glisse ; violet puis rouge, tu perds la voiture.",
	# le multijoueur : les mots de js/ui.js
	multi = "MULTIJOUEUR", multiIntro = "Ouvre une table et donne son code à quatre lettres, ou saisis celui qu’on t’a donné. Tout passe directement d’un appareil à l’autre : rien n’est conservé, fermer le jeu ferme la table. Les joueurs du jeu web s’assoient aux mêmes tables.",
	createTable = "OUVRIR UNE TABLE", joinTable = "REJOINDRE", tableCode = "CODE DE LA TABLE", watch = "REGARDER",
	netWait = "Connexion…", yourTable = "TA TABLE %s", leaveTable = "QUITTER LA TABLE", roundTrip = "aller-retour",
	reloadAll = "Tous les pilotes doivent recharger la dernière version du jeu.", players = "PILOTES %d/%d · %s",
	spectatorsN = "%d spectateur(s)", hostTag = "hôte", youTag = "toi", ready = "PRÊT", notReady = "PAS PRÊT", waiting = "En attente…",
	spectatorTag = "Spectateur", becomeSpectator = "DEVENIR SPECTATEUR", becomeDriver = "DEVENIR PILOTE",
	mFormat = "FORMAT : %s", mRace = "COURSE", mDuel = "DUEL", mGhost = "CONTRE-LA-MONTRE",
	mRaceDesc = "Tout le monde sur la grille, complétée par des IA, avec les contacts.", mDuelDesc = "Les humains et personne d’autre.",
	mGhostDesc = "Même circuit, chacun son tour, les voitures se traversent.",
	mCat = "CATÉGORIE : %s", mCatOpen = "Chacun prend la voiture qu'il veut ; l'IA court dans la catégorie de l'hôte.",
	mCatDesc = "L'hôte peut réserver la table à une catégorie : chacun choisit alors sa voiture dans celle-ci.",
	startRace = "DÉPART !", startWhenReady = "Tout le monde doit être prêt", pingHost = "Ping hôte :", pingGuests = "Ping invités :",
	driverN = "Pilote %d", netLost = "Liaison perdue avec l’hôte…", netOff = "Le multijoueur a besoin de WebRTC, que cette version n’a pas.",
	netErrCode = "Le code d’une table a quatre lettres.", netErrTaken = "Ce code est déjà pris.", netErrDirectory = "L’annuaire des tables ne répond pas.",
	netErrNotFound = "Table introuvable.", netErrLink = "Liaison impossible.", netErrVersion = "Version multijoueur différente : tous les pilotes doivent recharger le jeu.",
	netErrOther = "Erreur de liaison", backToTable = "RETOUR À LA TABLE", waitLoad = "On attend %d pilote(s)…", spectating = "EN SPECTATEUR",
	codeHint = "Tape les quatre lettres au clavier", inviteFriend = "INVITER UN AMI",
	# le salon, avec les mots et la casse de l'écran web
	discordPlayers = "TROUVER DES JOUEURS SUR DISCORD", tableCodeLabel = "Code de la table", joinBtn = "Rejoindre", watchBtn = "Regarder",
	mRaceSeg = "COURSE", mDuelSeg = "DUEL", mGhostSeg = "CONTRE-LA-MONTRE", daySeg = "JOUR", nightSeg = "NUIT",
	playersTitle = "PILOTES %d/%d · %s", spectatorOne = "%d spectateur", spectatorMany = "%d spectateurs", readyTag = "Prêt",
	mFormatTitle = "FORMAT", dayNightTitle = "JOUR / NUIT", mCatTitle = "CATÉGORIE", trackTitle = "CIRCUIT", modelTitle = "MODÈLE",
	nightHint = "Visibilité réduite : phares et éclairage du circuit.", nightF1Hint = "F1 sans phares : éclairage du circuit uniquement.",
}
const EN := {
	quickRace = "QUICK RACE", timeTrial = "TIME TRIAL", training = "PRACTICE",
	howto = "HOW TO PLAY", settings = "SETTINGS", pilot = "DRIVER: %s", quit = "QUIT", back = "‹ BACK",
	proto = "Godot version · %d tracks · %d cars", all = "ALL",
	statVmax = "TOP SPEED", statA100 = "0-100 KM/H", statB100 = "BRAKING 100-0", statGrip = "GRIP",
	trackInfo = "%s · %d M · %d LAPS", myBest = "YOUR BEST LAP HERE", myBestHint = "with this car, on this device",
	dayNight = "DAY / NIGHT: %s", day = "DAY", night = "NIGHT", difficulty = "DIFFICULTY: %s", laps = "LAPS: %d",
	opponents = "OPPONENTS: %d", view = "VIEW: %s", viewFixed = "AHEAD", viewTrack = "ROTATING", onTrack = "ON TRACK!  ›",
	easy = "EASY", medium = "NORMAL", hard = "HARD", extreme = "EXTREME", cauchemar = "NIGHTMARE",
	pause = "PAUSE", resume = "RESUME", restart = "RESTART",
	finishPos = "FINISH — P%d / %d", colDriver = "DRIVER", colTime = "TIME", colGap = "GAP", colPenalty = "PENALTY", colBest = "BEST LAP",
	retry = "RETRY", paddock = "PADDOCK",
	lap = "LAP", lapVoid = "VOID", best = "BEST", you = "YOU", lineJaune = "YELLOW", lineRace = "RACING", lineBleu = "BLUE",
	holdToGo = "Hold Space to accelerate", holdToGoTouch = "Hold anywhere to accelerate",
	lineHintPC = "Up and down arrows: racing line   ·   gamepad: RT and stick", lineHintTouch = "Left thumb: line",
	go = "GO!", offTrack = "OFF TRACK!", engineCut = "ENGINE CUT", finished = "FINISH — P%d", lastLap = "FINAL LAP",
	guideGaz = "GO", guideDose = "FEATHER", guideLeve = "LIFT",
	loading = "LOADING THE TRACK… %d %%", loadFailed = "THE TRACK COULD NOT BE LOADED.\nCHECK THE CONNECTION, THEN ESC.",
	newRecord = "NEW RECORD!  %s", lapDone = "LAP %d · %s", ghost = "Ghost", driverDefault = "Driver",
	sName = "DRIVER NAME", sSound = "SOUND", sVolume = "VOLUME", sCamera = "CAMERA", sPull = "CAMERA SET-BACK", sSide = "LINE LEVER",
	sGuide = "BRAKING GUIDE IN RACES", sFull = "FULL SCREEN", sLang = "LANGUAGE",
	on = "ON", off = "OFF", camFixed = "LOOK-AHEAD, FIXED", camTrack = "LOOK-AHEAD, TRACK-ALIGNED",
	left = "LEFT", right = "RIGHT", shown = "SHOWN", hidden = "HIDDEN", yes = "YES", no = "NO",
	sHint = "Gamepad: A to confirm, B to go back · Keyboard: arrows, Enter, Esc",
	h1 = "1  THROTTLE", h1a = "Hold Space down (or RT on a gamepad).", h1t = "Keep a finger down, anywhere but on the lever.",
	h1b = "Lift before the corner: the car brakes by itself. Too fast, and it slides off.",
	h2 = "2  THE LINE", h2a = "Up and down arrows (or the stick).", h2t = "Slide the lever on the left of the screen.",
	h2b = "Racing in the middle, yellow on the outside, blue on the inside: to overtake or to defend.",
	h3 = "3  GRIP", h3a = "The GRIP dot tells you what the tyres are doing.",
	h3b = "Blue, all good; green, working; yellow, sliding; purple then red, you are losing the car.",
	multi = "MULTIPLAYER", multiIntro = "Open a table and pass on its four-letter code, or type the one you were given. Everything goes straight from one device to the other: nothing is stored, closing the game closes the table. Players of the web game sit at the same tables.",
	createTable = "OPEN A TABLE", joinTable = "JOIN", tableCode = "TABLE CODE", watch = "WATCH",
	netWait = "Connecting…", yourTable = "YOUR TABLE %s", leaveTable = "LEAVE THE TABLE", roundTrip = "round trip",
	reloadAll = "Every driver has to reload the latest version of the game.", players = "DRIVERS %d/%d · %s",
	spectatorsN = "%d spectator(s)", hostTag = "host", youTag = "you", ready = "READY", notReady = "NOT READY", waiting = "Waiting…",
	spectatorTag = "Spectator", becomeSpectator = "WATCH INSTEAD", becomeDriver = "DRIVE INSTEAD",
	mFormat = "FORMAT: %s", mRace = "RACE", mDuel = "DUEL", mGhost = "TIME TRIAL",
	mRaceDesc = "Everyone on the grid, filled up with AI cars, contact on.", mDuelDesc = "The people and nobody else.",
	mGhostDesc = "Same circuit, each on their own lap, cars pass through each other.",
	mCat = "CLASS: %s", mCatOpen = "Everyone takes any car; the AI races in the host's class.",
	mCatDesc = "The host can keep the table to one class: everyone then picks a car from it.",
	startRace = "START!", startWhenReady = "Everyone has to be ready", pingHost = "Host ping:", pingGuests = "Guest ping:",
	driverN = "Driver %d", netLost = "Lost the host…", netOff = "Multiplayer needs WebRTC, which this build does not have.",
	netErrCode = "A table code has four letters.", netErrTaken = "That code is already taken.", netErrDirectory = "The table directory is not answering.",
	netErrNotFound = "Table not found.", netErrLink = "Could not connect.", netErrVersion = "Different multiplayer version: every driver has to reload the game.",
	netErrOther = "Connection error", backToTable = "BACK TO THE TABLE", waitLoad = "Waiting for %d driver(s)…", spectating = "WATCHING",
	codeHint = "Type the four letters on the keyboard", inviteFriend = "INVITE A FRIEND",
	discordPlayers = "FIND PLAYERS ON DISCORD", tableCodeLabel = "Table code", joinBtn = "Join", watchBtn = "Watch",
	mRaceSeg = "RACE", mDuelSeg = "DUEL", mGhostSeg = "TIME TRIAL", daySeg = "DAY", nightSeg = "NIGHT",
	playersTitle = "DRIVERS %d/%d · %s", spectatorOne = "%d spectator", spectatorMany = "%d spectators", readyTag = "Ready",
	mFormatTitle = "FORMAT", dayNightTitle = "DAY / NIGHT", mCatTitle = "CLASS", trackTitle = "TRACK", modelTitle = "MODEL",
	nightHint = "Limited visibility: headlights and circuit lighting.", nightF1Hint = "F1 has no headlights: circuit lighting only.",
}
const PAYS := {
	fr = { IT = "Italie", BE = "Belgique", MC = "Monaco", GB = "Royaume-Uni", JP = "Japon", BR = "Brésil", US = "États-Unis", DE = "Allemagne", FR = "France", AU = "Australie", AT = "Autriche", NL = "Pays-Bas" },
	en = { IT = "Italy", BE = "Belgium", MC = "Monaco", GB = "United Kingdom", JP = "Japan", BR = "Brazil", US = "United States", DE = "Germany", FR = "France", AU = "Australia", AT = "Austria", NL = "Netherlands" },
}


## La langue des réglages. Lue par le nœud /root/App plutôt que par son nom, pour que les
## scripts de calcul (Course, ses tests) se chargent aussi sans l'application.
static func langue() -> String:
	var boucle := Engine.get_main_loop() as SceneTree
	var app: Node = boucle.root.get_node_or_null("App") if boucle else null
	if app == null: return "fr"
	return "en" if app.reglages.get("langue", "fr") == "en" else "fr"


static func t(cle: String, args = null) -> String:
	var d: Dictionary = EN if langue() == "en" else FR
	var s: String = d.get(cle, FR.get(cle, cle))
	if args == null: return s
	return s % args


## Les erreurs du réseau naissent en français (net.gd, salle_rtc.gd), comme dans le jeu web.
static func netErreur(m: String) -> String:
	var cle = { "code à quatre lettres": "netErrCode", "code déjà pris": "netErrTaken", "annuaire injoignable": "netErrDirectory",
		"table introuvable": "netErrNotFound", "liaison impossible": "netErrLink",
		"Version multijoueur différente : tous les pilotes doivent recharger le jeu.": "netErrVersion" }.get(m)
	if cle: return t(cle)
	return "%s (%s)" % [t("netErrOther"), m] if langue() == "en" and m != "" else m


static func pays(code: String) -> String:
	return PAYS[langue()].get(code, code)


## Un nom du catalogue en deux langues ({ fr, en }), ou un nom propre.
static func nom(n) -> String:
	if n is Dictionary: return str(n.get(langue(), n.get("fr", "")))
	return str(n)


## Le nom d'une livrée (nomLivree) : sa traduction quand elle se décrit, son nom propre sinon.
static func livree(lv: Dictionary) -> String:
	if langue() == "en" and lv.get("en"): return str(lv.en)
	return str(lv.get("nom", ""))
