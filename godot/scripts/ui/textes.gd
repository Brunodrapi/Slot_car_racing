## Les textes du jeu, en français et en anglais. Les mots sont ceux du jeu web (js/ui.js, I18N),
## pour que les deux versions parlent la même langue.
class_name Textes
extends RefCounted

const FR := {
	quickRace = "COURSE RAPIDE", timeTrial = "CONTRE-LA-MONTRE", training = "ENTRAÎNEMENT",
	howto = "COMMENT JOUER", settings = "RÉGLAGES", pilot = "PILOTE : %s", quit = "QUITTER", back = "‹ RETOUR",
	proto = "Version Godot · %d circuits · %d voitures", all = "TOUTES",
	statVmax = "VITESSE MAX.", statA100 = "0-100 KM/H", statB100 = "FREINAGE 100-0", statGrip = "ADHÉRENCE",
	trackInfo = "%s · %d M · %d TOURS", trackInfoSeul = "%s · %d M", signInLien = "Se connecter avec Google", myBest = "TON MEILLEUR TOUR ICI", myBestHint = "avec cette voiture, sur cet appareil",
	worldBest = "RECORD DU MONDE", signIn = "SE CONNECTER AVEC GOOGLE", signOut = "SE DÉCONNECTER", signInCancel = "ANNULER",
	account = "COMPTE GOOGLE", signedIn = "CONNECTÉ", noWorld = "personne encore",
	worldNeedsAccount = "Connecte-toi pour inscrire tes temps au tableau mondial.",
	worldFromApp = "Le tableau mondial se lit ici ; on s'y inscrit depuis l'application.",
	signInTab = "Connexion en cours dans ton navigateur…",
	signedInAs = "Connecté à Google · tes meilleurs tours partent au tableau mondial.",
	recetteHorsTableau = "Connecté à Google · recette : tes temps restent ici, seuls ceux du jeu publié vont au tableau mondial.",
	authFail = "La connexion a échoué : %s", authPort = "Le jeu n'a pas pu attendre le retour du navigateur (port local).",
	authDelai = "Pas de retour du navigateur : connexion abandonnée.",
	authSteam = "Steam n'a pas pu confirmer ton compte : tes temps restent ici.", signedInSteam = "Connecté avec Steam · tes meilleurs tours partent au tableau mondial.",
	sending = "Envoi de tes temps au tableau mondial… %d sur %d.", sendingWait = "Envoi de tes temps… %d sur %d. Prochain dans %d s (le serveur les espace).",
	sent = "%d temps envoyé(s) au tableau mondial.",
	refus_inconnu = "Cette voiture n'est pas encore connue du tableau mondial. Ton temps est gardé ici.",
	refus_trop_rapide = "Ce tour a été jugé impossible par le serveur et n'a pas été retenu.",
	refus_cadence = "Temps envoyés trop rapprochés. Le suivant partira dans un instant.",
	refus_pseudo = "Ton nom n'a pas pu être enregistré côté serveur. Reconnecte-toi.",
	refus_pseudo_forme = "Ton nom doit faire de 2 à 14 lettres ou chiffres, sans espace. Change-le dans les réglages.",
	refus_pseudo_pris = "Ce nom est déjà pris par un autre pilote. Change-le dans les réglages.",
	refus_session = "Ta session a expiré. Reconnecte-toi pour inscrire tes temps.",
	refus_aides = "Ce tour n'entre pas au tableau mondial : il a été couru avec le guide de freinage.",
	refus_entrainement = "Ce tour n'entre pas au tableau mondial : il a été couru à l'entraînement, avec le guide de freinage. Bats-le en contre-la-montre pour l'inscrire.",
	refus_reseau = "Pas de réseau au moment de l'envoi. Ton temps est gardé ici.",
	refus_autre = "Temps non retenu par le serveur (%s).",
	dayNight = "JOUR / NUIT : %s", day = "JOUR", night = "NUIT", difficulty = "DIFFICULTÉ : %s", laps = "TOURS : %d",
	opponents = "ADVERSAIRES : %d", view = "VUE : %s", viewFixed = "DEVANT", viewTrack = "TOURNANTE", onTrack = "EN PISTE !  ›",
	easy = "FACILE", medium = "NORMAL", hard = "DIFFICILE", extreme = "EXTRÊME", cauchemar = "CAUCHEMAR",
	pause = "PAUSE", resume = "REPRENDRE", restart = "RECOMMENCER",
	finishPos = "ARRIVÉE — P%d / %d", colDriver = "PILOTE", colTime = "TEMPS", colGap = "ÉCART", colPenalty = "PÉNALITÉ", colBest = "MEILLEUR TOUR",
	retry = "REJOUER", paddock = "PADDOCK",
	lap = "TOUR", lapVoid = "ANNULÉ", best = "MEILLEUR", you = "TOI", lineJaune = "JAUNE", lineRace = "IDÉALE", lineBleu = "BLEU", linePit = "STAND",
	chipDegats = "DÉGÂTS", degatsHint = "Les chocs cabossent la voiture et lui coûtent de la vitesse ; les stands la réparent.",
	abandon = "ABANDON", abandonSous = "MOTEUR DÉTRUIT", abandonRes = "Abandon",
	yourBestTitle = "TON RECORD", colRecord = "TON RECORD", colMonde = "MONDE", palmaresTrophee = "TROPHÉE", palmaresNiveau = "NIVEAU",
	palmares = "TON PALMARÈS", trophee_chocolat = "Chocolat", trophee_bronze = "Bronze", trophee_argent = "Argent", trophee_or = "Or", trophee_crane = "Crâne",
	palmaresRegle = "Gagne une course d'au moins %d tours : le niveau de difficulté donne le trophée.", palmaresAucun = "pas encore de trophée",
	tropheeNouveau = "Nouveau trophée : %s !", tropheeAcquis = "Trophée déjà gagné : %s.", tropheeTours = "Victoire en moins de %d tours : pas de trophée.",
	nuage_local = "Sur cet appareil", nuage_synchro = "Enregistrement…", nuage_ok = "Enregistré sur ton compte", nuage_erreur = "Pas enregistré en ligne",
	holdToGo = "Maintiens Espace pour accélérer", holdToGoTouch = "Maintiens l’écran pour accélérer",
	lineHintPC = "Flèches haut et bas : trajectoire   ·   manette : RT et stick", lineHintTouch = "Pouce gauche : trajectoire",
	go = "GO !", offTrack = "SORTIE DE PISTE !", engineCut = "MOTEUR COUPÉ", finished = "ARRIVÉE — P%d", lastLap = "DERNIER TOUR",
	guideGaz = "GAZ", guideDose = "DOSE", guideLeve = "LÂCHE",
	loading = "CHARGEMENT DU CIRCUIT… %d %%", loadFailed = "LE CIRCUIT N'A PAS PU SE CHARGER.\nVÉRIFIE LA CONNEXION, PUIS ÉCHAP.",
	newRecord = "NOUVEAU RECORD !  %s", lapDone = "TOUR %d · %s", ghost = "Fantôme", driverDefault = "Pilote",
	sName = "NOM DU PILOTE", sSound = "SON", sVolume = "VOLUME", sCamera = "CAMÉRA", sPull = "RECUL DE LA CAMÉRA", sSide = "LEVIER DE LIGNE",
	sGuide = "GUIDE DE FREINAGE EN COURSE", sFull = "PLEIN ÉCRAN", sLang = "LANGUE",
	padSpace = "Espace",
	pressStart = "APPUIE POUR COMMENCER", tapStart = "APPUIE POUR COMMENCER", splashInputs = "Espace : accélérer · ↑ ↓ : trajectoire",
	backWord = "RETOUR", settingsWord = "RÉGLAGES", quitWord = "QUITTER", pilotLabel = "PILOTE :", menuDon = "BUY ME A TEA", dayNightLabel = "JOUR / NUIT", difficultyLabel = "DIFFICULTÉ", lapsLabel = "TOURS", opponentsLabel = "ADVERSAIRES",
	freinage = "FREINAGE", regDefaut = "PAR DÉFAUT", regRegler = "RÉGLER", regDefautNom = "Par défaut",
	regTitre = "RÉGLAGE DU FREINAGE", regEnreg = "ENREGISTRER LA CONFIGURATION", regFait = "Configuration « %s » enregistrée.",
	regAide = "Pousse le levier en roulant. Trop de frein et la voiture s'arrête dans le virage ; trop peu et c'est la sortie. Le repère blanc est le réglage d'origine.",
	regPortee = "Seuls les réglages enregistrés pour cette voiture sur ce circuit sont proposés. Le choix est mémorisé pour ce couple.", statAcc = "ACCÉLÉRATION", statFrein = "FREINAGE",
	creditMusique = "Musique des menus : « Too Cool », Kevin MacLeod (incompetech.com), licence Creative Commons BY 4.0.",
	sDisplay = "AFFICHAGE", sResolution = "RÉSOLUTION", fullscreen = "PLEIN ÉCRAN", windowed = "FENÊTRÉ", resScreen = "ÉCRAN · %d × %d",
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
	trackInfo = "%s · %d M · %d LAPS", trackInfoSeul = "%s · %d M", signInLien = "Sign in with Google", myBest = "YOUR BEST LAP HERE", myBestHint = "with this car, on this device",
	worldBest = "WORLD RECORD", signIn = "SIGN IN WITH GOOGLE", signOut = "SIGN OUT", signInCancel = "CANCEL",
	account = "GOOGLE ACCOUNT", signedIn = "SIGNED IN", noWorld = "nobody yet",
	worldNeedsAccount = "Sign in to put your times on the world board.",
	worldFromApp = "The world board can be read here; you sign up for it from the app.",
	signInTab = "Signing in in your browser…",
	signedInAs = "Signed in with Google · your best laps go to the world board.",
	recetteHorsTableau = "Signed in with Google · test build: your times stay here, only the released game posts to the world board.",
	authFail = "Sign-in failed: %s", authPort = "The game could not wait for the browser's answer (local port).",
	authDelai = "No answer from the browser: sign-in abandoned.",
	authSteam = "Steam could not confirm your account: your times stay here.", signedInSteam = "Signed in with Steam · your best laps go to the world board.",
	sending = "Sending your times to the world board… %d of %d.", sendingWait = "Sending your times… %d of %d. Next in %d s (the server spaces them out).",
	sent = "%d time(s) sent to the world board.",
	refus_inconnu = "This car is not known to the world board yet. Your time is kept here.",
	refus_trop_rapide = "The server judged this lap impossible and did not keep it.",
	refus_cadence = "Times sent too close together. The next one will go through shortly.",
	refus_pseudo = "Your name could not be registered on the server. Sign in again.",
	refus_pseudo_forme = "Your name must be 2 to 14 letters or digits, no spaces. Change it in the settings.",
	refus_pseudo_pris = "That name is already taken by another driver. Change it in the settings.",
	refus_session = "Your session has expired. Sign in again to post your times.",
	refus_aides = "This lap does not reach the world board: it was driven with the braking guide.",
	refus_entrainement = "This lap does not reach the world board: it was driven in practice, with the braking guide. Beat it in time trial to post it.",
	refus_reseau = "No network when sending. Your time is kept here.",
	refus_autre = "Time not kept by the server (%s).",
	dayNight = "DAY / NIGHT: %s", day = "DAY", night = "NIGHT", difficulty = "DIFFICULTY: %s", laps = "LAPS: %d",
	opponents = "OPPONENTS: %d", view = "VIEW: %s", viewFixed = "AHEAD", viewTrack = "ROTATING", onTrack = "ON TRACK!  ›",
	easy = "EASY", medium = "NORMAL", hard = "HARD", extreme = "EXTREME", cauchemar = "NIGHTMARE",
	pause = "PAUSE", resume = "RESUME", restart = "RESTART",
	finishPos = "FINISH — P%d / %d", colDriver = "DRIVER", colTime = "TIME", colGap = "GAP", colPenalty = "PENALTY", colBest = "BEST LAP",
	retry = "RETRY", paddock = "PADDOCK",
	lap = "LAP", lapVoid = "VOID", best = "BEST", you = "YOU", lineJaune = "YELLOW", lineRace = "RACING", lineBleu = "BLUE", linePit = "PIT",
	chipDegats = "DAMAGE", degatsHint = "Impacts dent the car and cost it speed; the pits repair it.",
	abandon = "DNF", abandonSous = "ENGINE DESTROYED", abandonRes = "DNF",
	yourBestTitle = "YOUR RECORD", colRecord = "YOUR RECORD", colMonde = "WORLD", palmaresTrophee = "TROPHY", palmaresNiveau = "LEVEL",
	palmares = "YOUR TROPHIES", trophee_chocolat = "Chocolate", trophee_bronze = "Bronze", trophee_argent = "Silver", trophee_or = "Gold", trophee_crane = "Skull",
	palmaresRegle = "Win a race of at least %d laps: the difficulty level gives the trophy.", palmaresAucun = "no trophy yet",
	tropheeNouveau = "New trophy: %s!", tropheeAcquis = "Trophy already won: %s.", tropheeTours = "Won in fewer than %d laps: no trophy.",
	nuage_local = "On this device", nuage_synchro = "Saving…", nuage_ok = "Saved to your account", nuage_erreur = "Not saved online",
	holdToGo = "Hold Space to accelerate", holdToGoTouch = "Hold anywhere to accelerate",
	lineHintPC = "Up and down arrows: racing line   ·   gamepad: RT and stick", lineHintTouch = "Left thumb: line",
	go = "GO!", offTrack = "OFF TRACK!", engineCut = "ENGINE CUT", finished = "FINISH — P%d", lastLap = "FINAL LAP",
	guideGaz = "GO", guideDose = "FEATHER", guideLeve = "LIFT",
	loading = "LOADING THE TRACK… %d %%", loadFailed = "THE TRACK COULD NOT BE LOADED.\nCHECK THE CONNECTION, THEN ESC.",
	newRecord = "NEW RECORD!  %s", lapDone = "LAP %d · %s", ghost = "Ghost", driverDefault = "Driver",
	sName = "DRIVER NAME", sSound = "SOUND", sVolume = "VOLUME", sCamera = "CAMERA", sPull = "CAMERA SET-BACK", sSide = "LINE LEVER",
	sGuide = "BRAKING GUIDE IN RACES", sFull = "FULL SCREEN", sLang = "LANGUAGE",
	padSpace = "Space",
	pressStart = "PRESS ANY BUTTON TO START", tapStart = "TAP TO START", splashInputs = "Space: accelerate · ↑ ↓: racing line",
	backWord = "BACK", settingsWord = "SETTINGS", quitWord = "QUIT", pilotLabel = "DRIVER:", menuDon = "BUY ME A TEA", dayNightLabel = "DAY / NIGHT", difficultyLabel = "DIFFICULTY", lapsLabel = "LAPS", opponentsLabel = "OPPONENTS",
	freinage = "BRAKING", regDefaut = "DEFAULT", regRegler = "TUNE", regDefautNom = "Default",
	regTitre = "BRAKING SETUP", regEnreg = "SAVE THIS SETUP", regFait = "Setup “%s” saved.",
	regAide = "Push the lever while driving. Too much brake and the car stops in the corner; too little and you go off. The white mark is the stock setting.",
	regPortee = "Only setups saved for this car on this circuit are offered. The selection is remembered for this pairing.", statAcc = "ACCELERATION", statFrein = "BRAKING",
	creditMusique = "Menu music: “Too Cool” by Kevin MacLeod (incompetech.com), licensed under Creative Commons BY 4.0.",
	sDisplay = "DISPLAY", sResolution = "RESOLUTION", fullscreen = "FULL SCREEN", windowed = "WINDOWED", resScreen = "SCREEN · %d × %d",
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
