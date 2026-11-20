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
