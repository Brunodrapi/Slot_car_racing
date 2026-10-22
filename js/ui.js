// Menus, race setup, career, workshop, results. Plain DOM, FR/EN.
'use strict';

/* Les niveaux de difficulté, dans l'ordre. Une seule liste : ils étaient écrits en dur à deux
endroits — la liste déroulante des réglages et les boutons de l'écran de départ — et en ajouter un
n'en aurait servi qu'un des deux. L'ordre est celui des boutons, donc du plus facile au plus dur.
Les coefficients, eux, sont dans `DIFFICULTY` (js/race.js). */
const NIVEAUX = ['easy', 'medium', 'hard', 'extreme', 'cauchemar'];

const I18N = {
  fr: {
    padGuide: 'Stick / croix : naviguer · A : valider · B : retour · LB / RB : rubriques',
    padTextGuide: 'Stick / croix : choisir · A : saisir · X : effacer · B : annuler · LB / RB : rubriques',
    padCancel: 'Annuler', padDone: 'Valider', padClear: 'Tout effacer', padDelete: 'Effacer', padSpace: 'Espace', padConfirm: 'Confirmer',
    padBrake: 'Frein manette', padBrakeSeparate: 'LT + frein moteur', padBrakeAuto: 'Automatique au relâchement', engineBrake: 'Frein moteur', brake: 'Frein',
    controlGamepadManualHint: 'RT : gaz · LT : frein progressif, prioritaire sur RT. Sans appui : frein moteur réglable. Stick / croix : trajectoire. Menu : pause.',
    pcControls: 'Accélérateur PC', controlKeyboard: 'Espace', controlWheel: 'Molette', controlGamepad: 'Manette Xbox · RT',
    controlKeyboardHint: 'Maintiens Espace pour accélérer, relâche pour freiner. ↑ / ↓ : trajectoire. Échap : pause.',
    splashInputs: 'Espace : accélérer · ↑ ↓ : trajectoire', splashInputsPad: 'Clavier · Molette · Manette Xbox',
    controlWheelHint: 'Molette vers le haut : plus de gaz ; vers le bas : moins. Espace : gaz à zéro et freinage. Flèches : trajectoire.',
    controlGamepadHint: 'Gâchette RT : doser les gaz, relâcher pour freiner. Stick gauche ou croix : trajectoire. Menu : pause.',
    padReady: 'Manette connectée', padRelease: 'Relâche RT pour activer', padDisconnected: 'Connecte la manette et appuie sur un bouton', padUnsupported: 'Manette indisponible dans ce navigateur',
    gas: 'Gaz', wheelGo: 'Molette ↑ / ↓ : doser les gaz', padGo: 'Gâchette RT : doser les gaz', lineHintPC: '↑ / ↓ : trajectoire', lineHintPad: 'Stick / croix : trajectoire',
    title: 'GRIP — RACING THE LINE',
    career: 'Carrière', quickRace: 'Course rapide', timeTrial: 'Contre-la-montre', settings: 'Réglages', statistics: 'Statistiques publiques', back: 'Retour',
    editor: 'Éditeur de circuits', workshop: 'Atelier voitures',
    howto: 'Poser le pouce n’importe où (ou maintenir Espace) : accélérer, relâcher pour freiner. La pastille vient se placer sous le pouce, et la vitesse se lit en haut au milieu. Pouce gauche (ou ↑ / ↓) : choisir sa place sur la piste — bord bleu, ligne idéale ou bord jaune. Les deux bords gardent leur couleur tout le tour. Trop vite dans un virage, c’est le bac à gravier.',
    carClass: 'Catégorie', model: 'Modèle', track: 'Circuit', livery: 'Livrée', tyres: 'Gomme', damage: 'Tôle', linePit: 'STAND', wear: 'Usure et dommages', wearHint: 'Les pneus s\'usent en glissant, les chocs et les sorties abîment la voiture.', difficulty: 'Difficulté', easy: 'Facile', medium: 'Normal', hard: 'Difficile', extreme: 'Extrême', cauchemar: 'Cauchemar',
    diffTitle: 'Ce que la voiture coûte à piloter', diffLevel: (n) => `Difficulté ${n} sur 5`,
    laps: 'tours', lapCustom: 'Perso', start: 'Départ !', locked: 'Verrouillé', unlockHint: 'Termine la coupe précédente dans le top 3 pour débloquer.',
    cup: 'Coupe', races: 'courses', raceOf: (a, b) => `Course ${a} / ${b}`, standings: 'Classement', nextRace: 'Prochaine course', startRace: 'Lancer la course',
    done: 'Terminée', inProgress: 'En cours', notStarted: 'Pas commencée', resetCup: 'Recommencer cette coupe', finalPos: (p) => `Classement final : P${p}`,
    results: 'Résultats', pos: 'Pos', driver: 'Pilote', time: 'Temps', gap: 'Écart', bestLap: 'Meilleur tour', points: 'Pts', dnf: 'Non classé',
    penalty: 'Pénalité', voidLap: 'annulé', voidLapTitle: 'Tour annulé : sortie de piste',
    penaltyWhy: (n, s) => `${n} sortie${n > 1 ? 's' : ''} de piste · +${s} s au classement. Le temps gagné hors piste est repris ; les vibreurs ne comptent pas.`,
    next: 'Suivant', retry: 'Rejouer', menu: 'Menu', resume: 'Reprendre', restart: 'Recommencer', quit: 'Quitter', paused: 'Pause', endSession: 'Terminer',
    lap: 'Tour', last: 'Dernier', best: 'Meilleur', grip: 'adhérence', holdToGo: 'Maintiens Espace pour accélérer', holdToGoTouch: 'Maintiens l’écran pour accélérer', lineHintKeys: '↑ / ↓ : trajectoire', lineHintTouch: 'Pouce gauche : trajectoire',
    lineBleu: 'BLEU', lineRace: 'IDÉALE', lineJaune: 'JAUNE', freinage: 'Freinage', reglages: 'Réglages', regDefaut: 'Par défaut', regRegler: 'Régler', regTitre: 'Réglage du freinage', regAide: 'Pousse le levier en roulant. Trop de frein et la voiture s’arrête dans le virage ; trop peu et c’est la sortie. Le repère blanc est le réglage d’origine.', regEnreg: 'Enregistrer la configuration', regNom: 'Nom de la configuration', regIci: (v) => `freinage ×${v.toFixed(2)} ici`, regIciDefaut: 'freinage d’origine ici', regPortee: 'Seuls les réglages enregistrés pour cette voiture sur ce circuit sont proposés. Le choix est mémorisé pour ce couple.', regFait: (n) => `Configuration « ${n} » enregistrée.`, engineCut: 'MOTEUR COUPÉ', offTrack: 'SORTIE DE PISTE !', finished: 'ARRIVÉE',
    lapVoid: 'annulé',
    cupComplete: 'Coupe terminée !', cupWon: 'Champion !', cupPodium: 'Podium ! Coupe suivante débloquée.', cupFailed: 'Hors du podium… retente ta chance.',
    newRecord: 'Nouveau record !', yourBest: 'Ton record', name: 'Nom du pilote', sound: 'Son', language: 'Langue', showLines: 'Guide de freinage', telemetry: 'Télémétrie (touche G)', ctrlSide: 'Côté du levier', sideLeft: 'Gauche', sideRight: 'Droite', camera: 'Vue', camFollow: 'Dessus, orientée piste', camFixed: 'Dessus, fixe', camAvance: 'En avance, orientée piste', camAvanceFixe: 'En avance, fixe', pullBack: 'Recul de la caméra', pullNone: 'Normal', pullSome: 'Un peu en retrait', pullMore: 'Très en retrait', aimant: 'Aimant sur la ligne', aimantOff: 'Désactivé', aimantDoux: 'Doux', aimantNormal: 'Normal', aimantFort: 'Fort', aimantTresFort: 'Très fort', aimantDouble: '×2 fort', anticip: 'Anticipation du pilote', anticipOff: 'Aucune', anticipPeu: 'Légère', anticipMoy: 'Moyenne', anticipFort: 'Forte', lapCount: 'Tours', pressStart: 'Appuie pour commencer', tapStart: 'Appuie pour commencer', majVerif: 'Recherche de mise à jour…', majHorsLigne: (v) => `Hors ligne · version ${v} installée`, majAJour: (v) => `Jeu à jour · version ${v}`, majDispo: (n, t) => `Mise à jour disponible : version ${n} (${t})`, majLancer: 'Mettre à jour', majGarder: 'Continuer avec cette version', majInstall: (p) => `Mise à jour… ${p} %`, majPremiere: (p) => `Installation pour jouer hors ligne… ${p} %`, majEchec: (v) => `La mise à jour n’a pas abouti · version ${v} conservée`, resetAll: 'Effacer la progression', resetConfirm: 'Effacer toute la progression ?',
    on: 'Activé', off: 'Coupé', playerDefault: 'Vous', allUnlocked: 'Tout est débloqué. Bravo !', careerIntro: 'Tu pars dernier à chaque course. Remonte le peloton, marque des points, débloque des catégories plus rapides.',
    lapDone: (n, t) => `Tour ${n} : ${t}`, tipTitle: 'Comment jouer', yourResult: (p) => `Tu termines P${p}`,
    nameTaken: (n) => `« ${n} » est déjà pris par un autre pilote. Change de nom dans les réglages, sinon tes temps n’entreront pas au tableau mondial.`,
    authPkce: 'La connexion est revenue sans jeton. Vérifie que l’adresse du jeu est bien dans les « Redirect URLs » de Supabase.',
    nothingToSend: 'Aucun temps à envoyer : tes records d’avant ne disent pas avec quelle voiture ils ont été posés. Boucle un tour et il partira.',
    authTrouble: 'La connexion au tableau mondial n’a pas abouti.',
    authFail: (e) => `La connexion a échoué : ${e}`,
    authEmpty: (p) => `Tu es revenu de Google sans jeton (l’adresse portait : ${p}). C’est le signe que l’adresse du jeu manque dans les « Redirect URLs » de Supabase.`,
    sending: (a, b) => `Envoi de tes temps au tableau mondial… ${a} sur ${b}.`,
    sendingWait: (a, b, s) => `Envoi de tes temps… ${a} sur ${b}. Prochain dans ${s} s (le serveur les espace).`,
    sent: (n) => `${n} temps envoyé${n > 1 ? 's' : ''} au tableau mondial.`,
    signedInAs: (n) => `Connecté comme ${n}. Tes meilleurs tours partent au tableau mondial.`,
    reconnect: 'Se reconnecter',
    account: 'Compte',
    signedIn: 'Connecté',
    refus_inconnu: 'Cette voiture n’est pas encore connue du tableau mondial. Ton temps est gardé ici.',
    refus_trop_rapide: 'Ce tour a été jugé impossible par le serveur et n’a pas été retenu.',
    refus_cadence: 'Temps envoyés trop rapprochés. Le suivant partira dans un instant.',
    refus_pseudo: 'Ton nom n’a pas pu être enregistré côté serveur. Reconnecte-toi.',
    refus_pseudo_pris: 'Ce nom est déjà pris par un autre pilote. Change-le dans les réglages.',
    refus_session: 'Ta session a expiré. Reconnecte-toi pour inscrire tes temps.',
    refus_usure: 'Les tours courus avec l’usure n’entrent pas au tableau mondial : ils ne se comparent à rien.',
    refus_aides: 'Ce tour n’entre pas au tableau mondial : il a été couru avec une aide ou un réglage de conduite. Remets-les à zéro pour inscrire tes temps.',
    refus_decor: 'Ce tour n’entre pas au tableau mondial : le décor de ce circuit a été retouché dans l’éditeur, sur ce poste. Oublie la retouche pour inscrire tes temps.',
    horsClassement: 'Hors tableau mondial : ', horsGuide: 'guide de freinage', horsAimant: 'aimant', horsFf: 'anticipation', horsUsure: 'usure',
    refus_reseau: 'Pas de réseau au moment de l’envoi. Ton temps est gardé ici.',
    refus_autre: (r) => `Temps non retenu par le serveur (${r}).`,
    worldBest: 'Monde', worldNeedsAccount: 'Connecte-toi pour inscrire tes temps au tableau mondial.', signIn: 'Se connecter avec Google', signOut: 'Se déconnecter',
    nameTitle: 'Ton nom de pilote', nameGo: 'C’est parti',
    nameWhy: 'Il signera tes temps, ici et au tableau des records.',
    nameRule: (a, b) => `Lettres et chiffres uniquement, de ${a} à ${b} caractères.`,
    ttIntro: 'Seul en piste. Bats ton meilleur tour.', deleteTrack: 'Supprimer', confirmDelete: 'Supprimer définitivement ?',
    multi: 'Multijoueur', multiIntro: 'Ouvre une table et donne son code à quatre lettres, ou saisis celui qu’on t’a donné. Tout passe directement d’un appareil à l’autre : rien n’est conservé, fermer la page ferme la table.',
    createTable: 'Ouvrir une table', joinTable: 'Rejoindre', tableCode: 'Code de la table', yourTable: 'Ta table', waiting: 'En attente…',
    mFormat: 'Format', mRace: 'Course', mDuel: 'Duel', mGhost: 'Contre-la-montre',
    enPiste: 'En piste !', statVmax: 'Vitesse max.', statA100: 'Accélération', statB100: 'Freinage', statGrip: 'Adhérence', pilotage: 'Pilotage', chipWear: 'Usure', chipControl: 'Commande', pilotLabel: 'Pilote',
    catAll: 'Toutes', mCat: 'Catégorie', mCatDesc: 'L\'hôte peut réserver la table à une catégorie : chacun choisit alors sa voiture dans celle-ci.', mCatOpen: 'Chacun prend la voiture qu\'il veut ; l\'IA court dans la catégorie de l\'hôte.',
    mRaceDesc: 'Tout le monde sur la grille, complétée par des IA, avec les contacts.',
    mDuelDesc: 'Les humains et personne d’autre.', mGhostDesc: 'Même circuit, chacun son tour, les voitures se traversent.',
    ready: 'Prêt', notReady: 'Pas prêt', host: 'hôte', you: 'toi', players: 'Pilotes',
    startWhenReady: 'Tout le monde doit être prêt', leaveTable: 'Quitter la table', backToTable: 'Retour à la table',
    netOff: 'Le multijoueur a besoin de WebRTC, que ce navigateur n’a pas.',
    netLost: 'Liaison perdue avec l’hôte…', netWait: 'Connexion…',
    loading: 'Chargement…', loadingN: (a, b) => `Chargement… ${a} / ${b} prêts`,
    loadingWhy: 'On attend que tout le monde ait chargé la piste et les voitures.',
    wsIntro: 'Ajoute tes propres voitures 2D : une image PNG vue de dessus (avant vers la droite), ou un dossier de sprites Ultimate Racing 2D 2 (car_base.png, car_color.png, car_1.png…). Le calque « color » prend la couleur de ta livrée.',
    wsName: 'Nom', wsCat: 'Catégorie', wsLength: 'Longueur (m)', wsWidth: 'Largeur (m)', wsSingle: 'Image PNG unique', wsFolder: 'Dossier UR2D 2 (plusieurs PNG)', wsAdd: 'Ajouter la voiture', wsList: 'Mes voitures', wsNone: 'Aucune voiture perso pour l’instant.', wsNeedBase: 'Il faut au moins une image (car_base.png ou une image seule).', wsAdded: 'Voiture ajoutée !',
    // le spectateur, le bilan de course, le salon et ses erreurs de réseau
    specTitle: 'Spectateur', specView: 'Vue spectateur', specAuto: 'Réalisateur', specFollow: 'Suivi pilote', specFull: 'Circuit complet',
    specFixed: 'Caméras fixes', specDuel: 'Duel', previous: 'Précédent', specTiming: 'Chronos', specLeave: 'Quitter',
    specMap: 'Circuit et positions des pilotes', specEndsIn: (s) => `Fin dans ${s} s`, specLinkLost: '⚠ Liaison interrompue',
    specRace: 'Course', specAhead: 'Précédent', specCurrent: 'En cours', specVoid: '× Tour annulé',
    specPad: 'Manette : A vue · LB/RB pilote · X chronos', lapsDown: (n) => `+${n} tour${n > 1 ? 's' : ''}`,
    repTitle: 'Bilan de course', repGained: 'Places gagnées', repMean: 'Tour moyen valide', repSigma: 'Régularité σ',
    repValid: 'Tours valides', repVmax: 'Vitesse maxi', repOffs: 'Sorties',
    repNote: 'Régularité : écart-type des tours valides (plus petit = plus régulier), à partir de deux tours. Les places gagnées incluent les pénalités du classement final.',
    repPositions: 'Évolution des positions', repChart: 'Positions au fil de la course, première place en haut',
    repChartNote: 'Départ à gauche, arrivée à droite · première place en haut · positions échantillonnées toutes les 5 secondes, espacées davantage pour les longues courses.',
    repAllLaps: 'Tous les temps au tour', repVoid: 'annulé', repNoLap: 'Aucun tour terminé',
    roundTrip: 'aller-retour', reloadAll: 'Tous les pilotes doivent recharger la dernière version du jeu.',
    spectators: (n) => `${n} spectateur${n > 1 ? 's' : ''}`, pingHost: 'Ping hôte :', pingGuests: 'Ping invités :',
    driverN: (n) => `Pilote ${n}`, watch: 'Regarder',
    netErrCode: 'Le code d’une table a quatre lettres.', netErrTaken: 'Ce code est déjà pris.', netErrDirectory: 'L’annuaire des tables ne répond pas.',
    netErrNotFound: 'Table introuvable.', netErrLib: 'Le multijoueur ne peut pas se charger (pas de réseau ?).', netErrLink: 'Liaison impossible.',
    netErrVersion: 'Version multijoueur différente : tous les pilotes doivent recharger le jeu.', netErrOther: 'Erreur de liaison',
    aimantTient: 'tient', aimantLache: 'LÂCHÉ', langFr: 'Français', langEn: 'English', noParam: 'aucun paramètre',
    custom: 'perso',
  },
  en: {
    padGuide: 'Stick / D-pad: navigate · A: confirm · B: back · LB / RB: sections',
    padTextGuide: 'Stick / D-pad: choose · A: type · X: delete · B: cancel · LB / RB: sections',
    padCancel: 'Cancel', padDone: 'Done', padClear: 'Clear all', padDelete: 'Delete', padSpace: 'Space', padConfirm: 'Confirm',
    padBrake: 'Controller brake', padBrakeSeparate: 'LT + engine braking', padBrakeAuto: 'Automatic on release', engineBrake: 'Engine braking', brake: 'Brake',
    controlGamepadManualHint: 'RT: throttle · LT: progressive brake, with priority over RT. No input: adjustable engine braking. Stick / D-pad: racing line. Menu: pause.',
    pcControls: 'PC throttle', controlKeyboard: 'Space', controlWheel: 'Mouse wheel', controlGamepad: 'Xbox controller · RT',
    controlKeyboardHint: 'Hold Space to accelerate; release to brake. ↑ / ↓: racing line. Esc: pause.',
    splashInputs: 'Space: accelerate · ↑ ↓: racing line', splashInputsPad: 'Keyboard · Mouse wheel · Xbox controller',
    controlWheelHint: 'Wheel up: more throttle; down: less. Space: zero throttle and brake. Arrows: racing line.',
    controlGamepadHint: 'RT trigger: analog throttle; release to brake. Left stick or D-pad: racing line. Menu: pause.',
    padReady: 'Controller connected', padRelease: 'Release RT to enable', padDisconnected: 'Connect a controller and press a button', padUnsupported: 'Controller unavailable in this browser',
    gas: 'Throttle', wheelGo: 'Wheel ↑ / ↓: adjust throttle', padGo: 'RT trigger: adjust throttle', lineHintPC: '↑ / ↓: racing line', lineHintPad: 'Stick / D-pad: racing line',
    title: 'GRIP — RACING THE LINE',
    career: 'Career', quickRace: 'Quick race', timeTrial: 'Time trial', settings: 'Settings', statistics: 'Public statistics', back: 'Back',
    editor: 'Track editor', workshop: 'Car workshop',
    howto: 'Thumb anywhere (or hold Space): accelerate, release to brake. The pad follows your thumb, and the speed reads at the top centre. Left thumb (or ↑ / ↓): pick your place on the road — blue edge, racing line or yellow edge. Each edge keeps its colour all the way round. Too fast into a corner and it’s the gravel.',
    carClass: 'Class', model: 'Model', track: 'Track', livery: 'Livery', tyres: 'Tyres', damage: 'Body', linePit: 'PIT', wear: 'Wear and damage', wearHint: 'Tyres wear as you slide; contact and excursions damage the car.', difficulty: 'Difficulty', easy: 'Easy', medium: 'Normal', hard: 'Hard', extreme: 'Extreme', cauchemar: 'Nightmare',
    diffTitle: 'How much the car costs to drive', diffLevel: (n) => `Difficulty ${n} of 5`,
    laps: 'laps', lapCustom: 'Custom', start: 'Start!', locked: 'Locked', unlockHint: 'Finish the previous cup in the top 3 to unlock.',
    cup: 'Cup', races: 'races', raceOf: (a, b) => `Race ${a} / ${b}`, standings: 'Standings', nextRace: 'Next race', startRace: 'Start race',
    done: 'Complete', inProgress: 'In progress', notStarted: 'Not started', resetCup: 'Restart this cup', finalPos: (p) => `Final standing: P${p}`,
    results: 'Results', pos: 'Pos', driver: 'Driver', time: 'Time', gap: 'Gap', bestLap: 'Best lap', points: 'Pts', dnf: 'DNF',
    penalty: 'Penalty', voidLap: 'void', voidLapTitle: 'Lap deleted: off track',
    penaltyWhy: (n, s) => `${n} excursion${n > 1 ? 's' : ''} · +${s} s on the classification. Time gained off track is taken back; kerbs do not count.`,
    next: 'Next', retry: 'Retry', menu: 'Menu', resume: 'Resume', restart: 'Restart', quit: 'Quit', paused: 'Paused', endSession: 'Finish',
    lap: 'Lap', last: 'Last', best: 'Best', grip: 'grip', holdToGo: 'Hold Space to accelerate', holdToGoTouch: 'Hold anywhere to accelerate', lineHintKeys: '↑ / ↓: racing line', lineHintTouch: 'Left thumb: line',
    lineBleu: 'BLUE', lineRace: 'RACING', lineJaune: 'YELLOW', freinage: 'Braking', reglages: 'Setup', regDefaut: 'Default', regRegler: 'Tune', regTitre: 'Braking setup', regAide: 'Push the lever while driving. Too much brake and the car stops in the corner; too little and you go off. The white mark is the stock setting.', regEnreg: 'Save this setup', regNom: 'Setup name', regIci: (v) => `braking ×${v.toFixed(2)} here`, regIciDefaut: 'stock braking here', regPortee: 'Only setups saved for this car on this circuit are offered. The selection is remembered for this pairing.', regFait: (n) => `Setup “${n}” saved.`, engineCut: 'ENGINE CUT', offTrack: 'OFF TRACK!', finished: 'FINISH',
    lapVoid: 'void',
    cupComplete: 'Cup complete!', cupWon: 'Champion!', cupPodium: 'Podium! Next cup unlocked.', cupFailed: 'Missed the podium… try again.',
    newRecord: 'New record!', yourBest: 'Your best', name: 'Driver name', sound: 'Sound', language: 'Language', showLines: 'Braking guide', telemetry: 'Telemetry (G key)', ctrlSide: 'Lever side', sideLeft: 'Left', sideRight: 'Right', camera: 'View', camFollow: 'Top-down, track-aligned', camFixed: 'Top-down, fixed', camAvance: 'Look-ahead, track-aligned', camAvanceFixe: 'Look-ahead, fixed', pullBack: 'Camera set-back', pullNone: 'Normal', pullSome: 'A little further back', pullMore: 'Much further back', aimant: 'Line magnet', aimantOff: 'Off', aimantDoux: 'Light', aimantNormal: 'Normal', aimantFort: 'Strong', aimantTresFort: 'Very strong', aimantDouble: '×2 strong', anticip: 'Driver anticipation', anticipOff: 'None', anticipPeu: 'Light', anticipMoy: 'Medium', anticipFort: 'Strong', lapCount: 'Laps', pressStart: 'Press any button to start', tapStart: 'Tap to start', majVerif: 'Checking for updates…', majHorsLigne: (v) => `Offline · version ${v} installed`, majAJour: (v) => `Up to date · version ${v}`, majDispo: (n, t) => `Update available: version ${n} (${t})`, majLancer: 'Update', majGarder: 'Keep this version', majInstall: (p) => `Updating… ${p}%`, majPremiere: (p) => `Installing for offline play… ${p}%`, majEchec: (v) => `Update failed · keeping version ${v}`, resetAll: 'Erase progress', resetConfirm: 'Erase all progress?',
    on: 'On', off: 'Off', playerDefault: 'You', allUnlocked: 'Everything unlocked. Well done!', careerIntro: 'You start every race from the back. Carve through the field, score points, unlock faster classes.',
    lapDone: (n, t) => `Lap ${n}: ${t}`, tipTitle: 'How to play', yourResult: (p) => `You finish P${p}`,
    nameTaken: (n) => `“${n}” is already taken by another driver. Change it in the settings, or your times will not reach the world board.`,
    authPkce: 'Sign-in came back without a token. Check that the game URL is in Supabase’s Redirect URLs.',
    nothingToSend: 'Nothing to send: your older records do not say which car set them. Run a lap and it will go up.',
    authTrouble: 'Sign-in to the world board did not complete.',
    authFail: (e) => `Sign-in failed: ${e}`,
    authEmpty: (p) => `You came back from Google without a token (the URL carried: ${p}). That usually means the game URL is missing from Supabase’s Redirect URLs.`,
    sending: (a, b) => `Sending your times to the world board… ${a} of ${b}.`,
    sendingWait: (a, b, s) => `Sending your times… ${a} of ${b}. Next in ${s} s (the server spaces them out).`,
    sent: (n) => `${n} time${n > 1 ? 's' : ''} sent to the world board.`,
    signedInAs: (n) => `Signed in as ${n}. Your best laps go to the world board.`,
    reconnect: 'Sign in again',
    account: 'Account',
    signedIn: 'Signed in',
    refus_inconnu: 'This car is not known to the world board yet. Your time is kept here.',
    refus_trop_rapide: 'The server judged this lap impossible and did not keep it.',
    refus_cadence: 'Times sent too close together. The next one will go through shortly.',
    refus_pseudo: 'Your name could not be registered on the server. Sign in again.',
    refus_pseudo_pris: 'That name is already taken by another driver. Change it in the settings.',
    refus_session: 'Your session has expired. Sign in again to post your times.',
    refus_usure: 'Laps run with wear do not reach the world board: they compare to nothing.',
    refus_aides: 'This lap does not reach the world board: it was driven with an aid or a driving setting. Turn them off to post your times.',
    refus_decor: 'This lap does not reach the world board: this circuit’s scenery was edited in the editor on this device. Forget the edit to post your times.',
    horsClassement: 'Outside the world board: ', horsGuide: 'braking guide', horsAimant: 'magnet', horsFf: 'anticipation', horsUsure: 'tyre wear',
    refus_reseau: 'No network when sending. Your time is kept here.',
    refus_autre: (r) => `Time not kept by the server (${r}).`,
    worldBest: 'World', worldNeedsAccount: 'Sign in to put your times on the world board.', signIn: 'Sign in with Google', signOut: 'Sign out',
    nameTitle: 'Your driver name', nameGo: 'Let’s go',
    nameWhy: 'It will sign your times, here and on the record board.',
    nameRule: (a, b) => `Letters and digits only, ${a} to ${b} characters.`,
    ttIntro: 'Alone on track. Beat your best lap.', deleteTrack: 'Delete', confirmDelete: 'Delete permanently?',
    multi: 'Multiplayer', multiIntro: 'Open a table and pass on its four-letter code, or type the one you were given. Everything goes straight from one device to the other: nothing is stored, closing the page closes the table.',
    createTable: 'Open a table', joinTable: 'Join', tableCode: 'Table code', yourTable: 'Your table', waiting: 'Waiting…',
    mFormat: 'Format', mRace: 'Race', mDuel: 'Duel', mGhost: 'Time trial',
    enPiste: 'On track!', statVmax: 'Top speed', statA100: 'Acceleration', statB100: 'Braking', statGrip: 'Grip', pilotage: 'Handling', chipWear: 'Wear', chipControl: 'Control', pilotLabel: 'Driver',
    catAll: 'All', mCat: 'Class', mCatDesc: 'The host can keep the table to one class: everyone then picks a car from it.', mCatOpen: 'Everyone takes any car; the AI races in the host\'s class.',
    mRaceDesc: 'Everyone on the grid, filled up with AI cars, contact on.',
    mDuelDesc: 'The people and nobody else.', mGhostDesc: 'Same circuit, each on their own lap, cars pass through each other.',
    ready: 'Ready', notReady: 'Not ready', host: 'host', you: 'you', players: 'Drivers',
    startWhenReady: 'Everyone has to be ready', leaveTable: 'Leave the table', backToTable: 'Back to the table',
    netOff: 'Playing together needs WebRTC, which this browser does not have.',
    netLost: 'Lost the host…', netWait: 'Connecting…',
    loading: 'Loading…', loadingN: (a, b) => `Loading… ${a} / ${b} ready`,
    loadingWhy: 'Waiting for everyone to load the track and the cars.',
    wsIntro: 'Add your own 2D cars: a single top-down PNG (front to the right), or an Ultimate Racing 2D 2 sprite folder (car_base.png, car_color.png, car_1.png…). The "color" layer takes your livery colour.',
    wsName: 'Name', wsCat: 'Category', wsLength: 'Length (m)', wsWidth: 'Width (m)', wsSingle: 'Single PNG image', wsFolder: 'UR2D 2 folder (several PNGs)', wsAdd: 'Add car', wsList: 'My cars', wsNone: 'No custom car yet.', wsNeedBase: 'At least one image is required (car_base.png or a single image).', wsAdded: 'Car added!',
    specTitle: 'Spectator', specView: 'Spectator view', specAuto: 'Director', specFollow: 'Follow a driver', specFull: 'Full circuit',
    specFixed: 'Fixed cameras', specDuel: 'Duel', previous: 'Previous', specTiming: 'Timing', specLeave: 'Leave',
    specMap: 'Circuit and driver positions', specEndsIn: (s) => `Ends in ${s} s`, specLinkLost: '⚠ Connection lost',
    specRace: 'Race', specAhead: 'Interval', specCurrent: 'Current', specVoid: '× Lap voided',
    specPad: 'Controller: A view · LB/RB driver · X timing', lapsDown: (n) => `+${n} lap${n > 1 ? 's' : ''}`,
    repTitle: 'Race report', repGained: 'Places gained', repMean: 'Average valid lap', repSigma: 'Consistency σ',
    repValid: 'Valid laps', repVmax: 'Top speed', repOffs: 'Offs',
    repNote: 'Consistency: standard deviation of the valid laps (smaller = steadier), from two laps on. Places gained include the penalties of the final classification.',
    repPositions: 'Positions through the race', repChart: 'Positions through the race, first place at the top',
    repChartNote: 'Start on the left, finish on the right · first place at the top · positions sampled every 5 seconds, further apart in long races.',
    repAllLaps: 'All lap times', repVoid: 'void', repNoLap: 'No lap completed',
    roundTrip: 'round trip', reloadAll: 'Every driver has to reload the latest version of the game.',
    spectators: (n) => `${n} spectator${n === 1 ? '' : 's'}`, pingHost: 'Host ping:', pingGuests: 'Guest ping:',
    driverN: (n) => `Driver ${n}`, watch: 'Watch',
    netErrCode: 'A table code has four letters.', netErrTaken: 'That code is already taken.', netErrDirectory: 'The table directory is not answering.',
    netErrNotFound: 'Table not found.', netErrLib: 'Multiplayer could not load (no network?).', netErrLink: 'Could not connect.',
    netErrVersion: 'Different multiplayer version: every driver has to reload the game.', netErrOther: 'Connection error',
    aimantTient: 'holds', aimantLache: 'LET GO', langFr: 'Français', langEn: 'English', noParam: 'no parameter',
    custom: 'custom',
  },
};

/* Une traduction hors de l'interface : le spectateur, le bilan de course, le réseau. Même dictionnaire et
même langue que `UI.t` ; la clé elle-même tant que le jeu n'est pas monté (les bancs, sous Node). */
function traduit(cle, ...a) { return typeof app !== 'undefined' && app && app.ui ? app.ui.t(cle, ...a) : cle; }

// Les pictogrammes des quatre cadrans. Des tracés et non des émojis : un émoji change de dessin
// d'un téléphone à l'autre, et se retrouve parfois en couleur par-dessus la couleur du cadran.
const GAUGE_ICONS = {
  acc: '<svg viewBox="0 0 24 24"><path d="M5 5 L11 12 L5 19 M13 5 L19 12 L13 19"/></svg>',           // les chevrons de l'accélération
  // Le cadran d'un compteur a le bas plat ; sans son moyeu, ce plat se lit comme un dessin coupé.
  top: '<svg viewBox="0 0 24 24"><path d="M3.5 17.5a8.5 8.5 0 1 1 17 0"/><path d="M12 17.5 L16.5 10"/><circle cx="12" cy="17.5" r="1.5"/></svg>',
  brk: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/></svg>', // le disque de frein
  grp: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v5 M4.5 16 L9.4 13.5 M19.5 16 L14.6 13.5"/></svg>', // le volant
};

/* Le nom du pilote : lettres et chiffres, rien d'autre.

Deux fonctions et non une, parce qu'il y a deux moments distincts. `nomPropre` nettoie la frappe au
fur et à mesure : ce qui n'est ni lettre ni chiffre n'entre jamais dans le champ, si bien qu'il ne
peut pas contenir de valeur refusable et qu'il n'y a aucun message d'erreur à écrire. `nomValide`
juge le résultat, ce qui reste nécessaire : un champ vide est propre, et pourtant il ne fait pas
un nom.

Pourquoi ce jeu de caractères et pas un autre : ce nom part vers un tableau des records partagé.
Les accents, les espaces de tête, les caractères invisibles et les émojis y créent des noms qui se
ressemblent à l'œil sans être égaux, et des lignes qu'on ne sait plus attribuer. La contrainte est
la même des deux côtés, ici et sur le serveur qui accepte les temps — écrite deux fois, parce
qu'une règle que seul le client applique n'est pas une règle. */
/* Les refus dont le remède est de se reconnecter — et qui portent donc le bouton.

Un message qui dit « reconnecte-toi » sans rien à toucher est une impasse : il nomme l'action et
ne la rend pas possible. Le bouton d'accueil ne s'affichait que pour qui n'est PAS connecté, si
bien qu'un pseudo manquant côté serveur — où la session est bien vivante — laissait le joueur
devant une consigne sans porte. */
const RECONNEXION = new Set(['session', 'pseudo', 'anonyme']);
// un nom déjà pris ne se répare pas en se reconnectant : il se change
const REGLAGES = new Set(['pseudo_pris']);
const NOM_MAX = 14, NOM_MIN = 2;
function nomPropre(v) { return String(v == null ? '' : v).replace(/[^A-Za-z0-9]/g, '').slice(0, NOM_MAX); }
function nomValide(v) { return new RegExp(`^[A-Za-z0-9]{${NOM_MIN},${NOM_MAX}}$`).test(String(v == null ? '' : v)); }

class UI {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('ui');
    this.gamepad = new GamepadUI(this);
    this.thumbs = new Map();
    this.icons = new Map();
    this.setup = { mode: 'race', classId: 'gt', trackId: 'zandvoort' };
    this.root.addEventListener('click', (e) => this._onClick(e));
    this.root.addEventListener('change', (e) => this._onChange(e));
    // « change » n'arrive qu'à la sortie du champ : pour nettoyer la frappe il faut « input »
    this.root.addEventListener('input', (e) => this._onInput(e));
    this.flash = null;
  }

  get lang() { return this.app.save.lang; }
  t(key, ...args) {
    const v = (I18N[this.lang] || I18N.en)[key];
    return typeof v === 'function' ? v(...args) : (v == null ? key : v);
  }
  L(obj) { return obj[this.lang] || obj.en; }
  /* Les erreurs du réseau naissent en français, dans net.js et room-rtc.js, où elles servent aussi de
  repère dans les journaux ; on les dit ici dans la langue du joueur. Une erreur inconnue — un type
  rendu tel quel par PeerJS — garde son texte, précédé d'« Erreur de liaison » en anglais. */
  netErreur(m) {
    const cle = { 'code à quatre lettres': 'netErrCode', 'code déjà pris': 'netErrTaken', 'annuaire injoignable': 'netErrDirectory',
      'table introuvable': 'netErrNotFound', 'peerjs introuvable': 'netErrLib', 'peerjs absent': 'netErrLib', 'liaison impossible': 'netErrLink',
      'Version multijoueur différente : tous les pilotes doivent recharger le jeu.': 'netErrVersion' }[m];
    if (cle) return this.t(cle);
    return this.lang === 'en' && m ? `${this.t('netErrOther')} (${m})` : m;
  }

  /* Le message d'un refus, avec un vrai repli.

  `t()` rend la CLÉ quand elle manque, ce qui est commode pour repérer un oubli mais piégeur ici :
  un `t('refus_xyz') || t('refus_autre')` ne tombe jamais sur le second, puisque le premier renvoie
  la chaîne « refus_xyz », qui est vraie. Le joueur aurait lu le nom d'une variable. On regarde
  donc si la clé existe au lieu de se fier à ce que `t()` en fait. */
  /* Ce que fait le tableau mondial, en une ligne, tout le temps.

  Les trois derniers défauts signalés par Bruno avaient la même forme : quelque chose échouait sans
  bruit, et l'écran montrait la même chose qu'en cas de succès — rien. Un état qui ne se dit pas
  est indiscernable d'une panne, et le joueur finit par soupçonner le jeu entier. Cette ligne couvre
  donc tous les cas, y compris ceux où tout va bien et où il n'y a simplement rien à faire.

  Le cas vide est le plus fréquent et le moins devinable : les records posés avant la version
  0.21.48 sont rangés sous une clé à deux morceaux, sans voiture. On ne sait pas avec quoi ils ont
  été signés, donc on ne les attribue à personne — et il n'y a rien à rattraper. Il faut boucler un
  tour pour que le tableau se remplisse, et c'est ça qu'il faut écrire. */
  etatMondial() {
    const t = (k, ...a) => this.t(k, ...a), m = this.app.mondial;
    const ligne = (cls, txt, bouton) => `<p class="${cls} mondial-note">${txt}${bouton || ''}</p>`;
    const entrer = `<button class="link" data-action="google">${t('signIn')}</button>`;
    if (!m) return '';
    if (m.erreurConnexion) {
      const msg = m.erreurConnexion === 'pkce' ? t('authPkce')
        : m.erreurConnexion === 'vide' ? t('authEmpty', escapeHtml(String(m.retourVide || t('noParam'))))
        : t('authFail', escapeHtml(String(m.erreurConnexion)));
      return ligne('warn', msg, `<button class="link" data-action="google">${t('reconnect')}</button>`);
    }
    if (!m.connecte()) return ligne('muted', t('worldNeedsAccount'), entrer);
    const e = m.envoi;
    if (e && !e.rien && e.faits < e.total) {
      return ligne('muted', e.attente
        ? t('sendingWait', e.faits, e.total, e.attente)
        : t('sending', e.faits, e.total));
    }
    if (e && e.faits > 0) return ligne('muted', t('sent', e.faits));
    if (e && e.rien) return ligne('muted', t('nothingToSend'));
    return ligne('muted', t('signedInAs', escapeHtml(this.app.save.name)));
  }

  messageRefus(raison) {
    const cle = 'refus_' + raison;
    const table = I18N[this.lang] || I18N.en;
    return table[cle] != null ? this.t(cle) : this.t('refus_autre', raison);
  }

  /* Redessiner un écran ne doit pas le renvoyer en haut.

  Chaque réglage — le nombre de tours, le circuit, la voiture — reconstruit l'écran entier, et
  remplacer le contenu remet le défilement à zéro : on choisissait ses tours en bas de page et on se
  retrouvait en haut, à devoir redescendre pour le réglage suivant.

  Le défilement est donc conservé quand l'écran redessiné est **le même**, reconnu par une clé que
  chaque écran se donne. Conserver sur la seule foi de la classe CSS ne suffirait pas : deux écrans
  différents la partagent, et on arriverait sur le second à la hauteur où l'on avait laissé le
  premier. Sans clé, on repart du haut — c'est ce qu'on veut en changeant d'écran. */
  show(html, cls, cle) {
    document.documentElement.lang = this.lang;          // la langue de la page suit celle du jeu
    const padFocus = this.gamepad.remember();
    const avant = this.root.firstElementChild;
    const garder = cle != null && cle === this._cleEcran && avant;
    // Presence and ping refresh repeatedly while waiting in the lobby. Replacing
    // every button for an unchanged table can detach the target between pointer
    // down/up (and interrupts gamepad focus). Refresh just the ping in that case.
    const pingPattern = /<p class="muted net-ping">([\s\S]*?)<\/p>/;
    const lobbyHtml = cle === 'salon' ? html.replace(pingPattern, '') : null;
    if (garder && cle === 'salon' && lobbyHtml === this._lobbyHtml) {
      const ping = avant.querySelector('.net-ping'), match = html.match(pingPattern);
      if (ping && match) ping.innerHTML = match[1];
      return;
    }
    this._lobbyHtml = lobbyHtml;
    const y = garder ? avant.scrollTop : 0;
    /* Les rails aussi gardent leur place, et pour la même raison que la page.

    Choisir une voiture repeint tout l'écran. Sans cela, taper la neuvième carte ramenait le rail
    à la première : on se serait retrouvé devant la M1 après avoir choisi la CSL, avec la marque
    de sélection hors champ. Le réglage aurait marché et l'écran aurait dit le contraire. */
    const rails = {};
    if (garder) for (const r of avant.querySelectorAll('[data-rail]')) rails[r.dataset.rail] = r.scrollLeft;
    this.root.innerHTML = `<div class="screen ${cls || ''}">${html}</div>`;
    this._cleEcran = cle == null ? null : cle;
    if (y) this.root.firstElementChild.scrollTop = y;
    for (const r of this.root.querySelectorAll('[data-rail]')) {
      // à la première ouverture, on se place sur ce qui est déjà choisi plutôt qu'au début
      if (rails[r.dataset.rail] != null) r.scrollLeft = rails[r.dataset.rail];
      else this._centrerRail(r);
    }
    this.root.classList.remove('hidden');
    for (const button of this.root.querySelectorAll('button.card, .seg button')) button.setAttribute('aria-pressed', String(button.classList.contains('sel')));
    this.paintIcons();
    this.updateControllerStatus();
    this.gamepad.restore(garder ? padFocus : null);
  }

  _centrerRail(rail) {
    const sel = rail.querySelector('.card.sel');
    if (!sel) return;
    rail.scrollLeft = Math.max(0, sel.offsetLeft - (rail.clientWidth - sel.offsetWidth) / 2);
  }
  hide() { this.root.classList.add('hidden'); this.root.innerHTML = ''; }

  // ---------- thumbnails ----------
  thumb(trackDef, size) {
    const key = trackDef.id + ':' + size;
    if (this.thumbs.has(key)) return this.thumbs.get(key);
    let url = '';
    try {
      const T = this.app.trackCache(trackDef.id);
      const c = document.createElement('canvas');
      c.width = c.height = size * 2;
      const g = c.getContext('2d');
      g.scale(2, 2);
      const b = T.bounds, w = b.maxX - b.minX, h = b.maxY - b.minY;
      const sc = (size - 16) / Math.max(w, h);
      g.translate(8 + ((size - 16) - w * sc) / 2, 8 + ((size - 16) - h * sc) / 2);
      g.scale(sc, sc); g.translate(-b.minX, -b.minY);
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath();
      for (let i = 0; i < T.n; i += 4) { if (i === 0) g.moveTo(T.xs[i], T.ys[i]); else g.lineTo(T.xs[i], T.ys[i]); }
      g.closePath();
      g.strokeStyle = '#fff0cd'; g.lineWidth = (size >= 200 ? 16 : 10) / sc; g.stroke();
      g.strokeStyle = '#171c19'; g.lineWidth = (size >= 200 ? 9 : 5) / sc; g.stroke();
      g.fillStyle = '#c72d24'; g.beginPath(); g.arc(T.xs[0], T.ys[0], 3 / sc, 0, 7); g.fill();
      url = c.toDataURL();
    } catch (e) { url = ''; }
    this.thumbs.set(key, url);
    return url;
  }

  /* A card's picture is a canvas left in the page, not an encoded image.
     It used to be a data URL, which is tidier to put in markup — but drawing one of the cars'
     illustrations onto a canvas taints it when the game is opened as a local file, and a tainted
     canvas cannot be encoded at all: the whole model list threw. A canvas left in the page has
     nothing to encode, so it works from a file, from a server, anywhere. It also settles the
     timing — a drawing that has not decoded yet is simply painted again when it lands, where a
     cached data URL would have kept the fallback body for good. */
  /* La vignette d'une voiture dans les menus.

  Quand elle a une illustration en trois quarts, c'est elle qu'on montre : la vue de dessus dit
  comment la voiture se pose sur la piste, ce qui est le sujet une fois en course, mais on ne
  choisit pas une voiture par son toit. Les autres gardent la vue de dessus, peinte sur une toile
  par `paintIcons` — deux voies qui cohabitent le temps que la série soit complète. */
  carIcon(model, livery, livree) {
    const lv = livreeDe(model, livree);
    /* Le repli est posé en ATTRIBUT, pas branché après coup.

    Une vignette de livrée peut manquer — le dessin n'est pas encore là, le fichier a été renommé —
    et une image cassée dans un menu est le pire des deux mondes : elle ne montre pas la voiture et
    elle ne dit pas ce qui ne va pas. On retombe donc sur la vignette d'origine. En attribut parce
    qu'un gestionnaire ajouté par script arrive après le chargement : si l'image a déjà échoué,
    l'événement est passé et personne ne l'attrape. */
    if (lv.pick) {
      const base = model.pick ? carArtUrl(model.pick) : '';
      const repli = base && model.pick !== lv.pick
        ? ` data-base="${escapeHtml(base)}" onerror="this.onerror=null;this.src=this.dataset.base"` : '';
      return `<img class="carpick" src="${escapeHtml(carArtUrl(lv.pick))}" alt=""${repli}>`;
    }
    return `<canvas class="caricon" width="160" height="72" data-car="${model.id}"
      data-livery="${LIVERIES.indexOf(livery)}" data-livree="${(livree || 0)}"></canvas>`;
  }

  /* Le repère de livrée, posé sur la carte — et seulement s'il y a de quoi tourner.

  Un modèle n'a le plus souvent qu'un dessin, et une pastille « 1/1 » sur huit cartes sur neuf
  promettrait un choix qui n'existe pas. Elle n'apparaît donc que là où un second appui change
  quelque chose, ce qui fait d'elle le mode d'emploi en même temps que l'état : on ne peut pas
  deviner qu'une carte déjà choisie se re-clique, mais on peut lire « 2/3 ». */
  repereLivree(model, livree) {
    const n = model.livrees ? model.livrees.length : 1;
    if (n < 2) return '';
    const i = ((Math.round(livree) || 0) % n + n) % n;
    return `<span class="livree"><b>${i + 1}/${n}</b> ${escapeHtml(nomLivree(model.livrees[i], this.lang))}</span>`;
  }

  /* Les quatre jauges d'une voiture.

  Un cadran par caractéristique, chiffre au centre, arc autour. Le chiffre est en blanc et non de
  la couleur de l'arc : sur une carte sombre une couleur saturée en petit corps gras passe sous le
  seuil de contraste, alors que l'arc, lui, est une surface et le tient largement.

  Quatre teintes dont un rouge et un vert ne se distinguent pas toujours en vision des couleurs
  déficiente — l'écart mesuré tombe à 7 sur 100 en deutéranopie. Aucune information ne repose donc
  sur la couleur seule : chaque cadran porte son pictogramme et son unité écrite, et surtout les
  quatre ne se comparent jamais entre eux — ce sont quatre mesures séparées, pas une série. */
  /* Ce que la voiture coûte à piloter, en pneus : zéro très facile, cinq très difficile.

  Cinq pneus toujours dessinés, les inutilisés en creux, pour que le rang se lise d'un coup d'œil
  sans avoir à compter — c'est une jauge, pas un nombre. Le niveau est mesuré par
  `tools/difficulte.js` et rangé dans `cars.js` ; il est aussi écrit en clair pour les lecteurs
  d'écran, un pictogramme répété n'ayant pas de sens lu à voix haute.

  Le pneu est un anneau : deux cercles concentriques et quatre entailles, ce qui reste lisible à
  douze pixels là où un dessin de bande de roulement se brouille. */
  tyres(m) {
    const n = Math.max(0, Math.min(5, m.diff == null ? 2 : m.diff));
    const t = this.t.bind(this);
    const un = (plein) => `<svg viewBox="0 0 16 16" class="tyre ${plein ? 'on' : 'off'}" aria-hidden="true">
        <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" stroke-width="3.2"
                stroke-dasharray="3.6 1.4"/>
      </svg>`;
    return `<span class="tyres" title="${t('diffTitle')}">
      <span class="sr">${t('diffLevel', n)}</span>
      ${Array.from({ length: 5 }, (_, i) => un(i < n)).join('')}
    </span>`;
  }

  gauges(m) {
    const ARC = 84.8;   // les 270° d'ouverture, sur les 113,1 de circonférence d'un rayon 18
    // L'arc suit le chiffre affiché et non la valeur brute. Sans cela, deux voitures qui montrent
    // le même nombre montrent des arcs différents — la 787B s'arrête en 20,12 m et la CSL en
    // 20,30 m, toutes deux affichées « 20 », et le joueur voit un écart que le texte dément.
    const one = (key, kind, colour, digits, unit) => {
      const shown = +m.perf[key].toFixed(digits);
      const fill = perfFill(shown, key);
      const value = shown.toFixed(digits).replace('.', this.lang === 'fr' ? ',' : '.');
      return `<span class="gauge" style="--c:${colour};--d:${(ARC * fill).toFixed(1)}">
        <svg class="ring" viewBox="0 0 44 44" aria-hidden="true">
          <circle class="trk" cx="22" cy="22" r="18"></circle>
          <circle class="val" cx="22" cy="22" r="18"></circle>
        </svg>
        <span class="ico">${GAUGE_ICONS[kind]}</span>
        <span class="num">${value}<small>${unit}</small></span>
      </span>`;
    };
    // Le freinage garde une décimale : au mètre près, neuf voitures ne prennent que trois valeurs
    // distinctes et l'essentiel des écarts disparaît de l'écran.
    return `<span class="gauges">
      ${one('a100', 'acc', '#4aa8ff', 2, 'S 0-100')}
      ${one('vmax', 'top', '#ff5a5f', 0, 'KM/H')}
      ${one('b100', 'brk', '#ffa62b', 1, 'M 100-0')}
      ${one('gripG', 'grp', '#4ed17e', 2, 'G')}
    </span>`;
  }

  /** Paints every card picture the screen just laid out. */
  paintIcons() {
    let pending = false;
    for (const c of this.root.querySelectorAll('canvas.caricon')) {
      const model = modelById(c.dataset.car);
      if (!model) continue;
      const livree = +c.dataset.livree || 0;
      if (!topReady(model, livree)) pending = true;
      const g = c.getContext('2d');
      g.clearRect(0, 0, c.width, c.height);
      const sc = Math.min(150 / model.length, 60 / model.width);
      g.save();
      g.translate(c.width / 2, c.height / 2);
      g.scale(sc, sc);
      drawCarModel(g, model, LIVERIES[+c.dataset.livery] || LIVERIES[0], { livree });
      g.restore();
    }
    if (pending) onTopReady(() => this.paintIcons());
  }

  // ---------- screens ----------

  /* The title card: the poster fills the screen, and the invitation sits on its lower edge.

  The poster (Montmartre, GRIP painted on the wall) comes in two shapes: 9:16 for a phone held
  upright, 16:9 for a monitor or a phone on its side, and the browser picks by orientation. What is
  left to crop is little, and where it is cropped is chosen (`object-position` in css/style.css) so
  that the painted name and the two cars stay in frame.
  The invitation lies on a dark fade at the bottom, in the game's own lettering, so it reads
  whatever part of the cobbles it lands on. Any key, any tap, anywhere gets past it, as before. */
  splash() {
    const t = (k, ...a) => this.t(k, ...a);
    const invite = this.app.desktop ? t('pressStart') : t('tapStart');
    this.show(`
      <picture>
        <source media="(orientation: landscape)" srcset="art/affiche-titre-paysage.webp">
        <img class="poster" src="art/affiche-titre-portrait.webp" alt="${escapeHtml(t('title'))}">
      </picture>
      <div class="voile" aria-hidden="true"></div>
      <div class="stage">
        <div class="press">${escapeHtml(invite)}</div>
        ${this.app.desktop ? `<div class="title-inputs">${this.t(MANETTE ? 'splashInputsPad' : 'splashInputs')}</div>` : ''}
      </div>
      <div class="version">v${APP_VERSION} · ${APP_DATE}${canalBadge()}</div>
      <div class="maj" aria-live="polite" hidden></div>
    `, 'center splash');
    this.majAffiche();
  }

  /* L'état du jeu hors ligne, sur l'écran-titre (voir js/maj.js) : hors ligne, à jour, ou une mise à
  jour disponible — qu'on accepte ou non. Rien ne s'affiche dans le dépôt, où il n'y a pas de version
  publiée. */
  majAffiche() {
    if (typeof MAJ === 'undefined') return;
    if (!this._majLie) { this._majLie = true; MAJ.surChangement(() => this.majAffiche()); }
    const el = this.root.querySelector('.splash .maj');
    if (!el) return;
    const t = (k, ...a) => this.t(k, ...a), m = MAJ;
    const taille = (o) => (o >= 1e6 ? (o / 1e6).toFixed(1).replace('.', this.lang === 'en' ? '.' : ',') + (this.lang === 'en' ? ' MB' : ' Mo')
      : Math.max(1, Math.round(o / 1e3)) + (this.lang === 'en' ? ' kB' : ' ko'));
    let h = '';
    if (m.etat === 'verification') h = `<span>${t('majVerif')}</span>`;
    else if (m.etat === 'hors-ligne') h = `<span>${t('majHorsLigne', m.version)}</span>`;
    else if (m.etat === 'a-jour') h = `<span>${t('majAJour', m.version)}</span>`;
    else if (m.etat === 'disponible') h = `<span>${t('majDispo', m.nouvelle, taille(m.taille))}</span>
      <span class="maj-choix"><button class="primary" data-action="majLancer">${t('majLancer')}</button><button data-action="majGarder">${t('majGarder')}</button></span>`;
    else if (m.etat === 'installation') h = `<span>${t(m.premiere ? 'majPremiere' : 'majInstall', Math.round(m.progres * 100))}</span>`;
    else if (m.etat === 'erreur') h = `<span>${t('majEchec', m.version || APP_VERSION)}</span>`;
    el.innerHTML = h;
    el.hidden = !h;
    el.className = 'maj maj-' + m.etat;
  }

  /* L'écran du nom, qu'on ne traverse qu'une fois.

  Le bouton reste éteint tant que le nom ne vaut rien : c'est lui qui porte la règle, pas un message
  d'erreur après coup. Et comme le champ se nettoie à la frappe, l'utilisateur ne voit jamais
  apparaître un caractère qu'on lui refusera ensuite — il voit seulement qu'il ne s'inscrit pas. */
  nomScreen() {
    const t = (k, ...a) => this.t(k, ...a);
    const n = nomPropre(this.app.save.name);
    this.show(`
      <h2>${t('nameTitle')}</h2>
      <p class="sub">${t('nameWhy')}</p>
      <div class="form nomform">
        <label>${t('name')}<input id="inp-nom" maxlength="${NOM_MAX}" autocomplete="off"
          autocapitalize="off" spellcheck="false" value="${escapeHtml(n)}" placeholder="Bruno42"></label>
        <small class="muted">${t('nameRule', NOM_MIN, NOM_MAX)}</small>
        <button class="big primary" id="btn-nom" data-action="nomOk" ${nomValide(n) ? '' : 'disabled'}>${t('nameGo')}</button>
      </div>
    `, 'center', 'nom');
    const champ = document.getElementById('inp-nom');
    if (champ) { champ.focus(); champ.setSelectionRange(champ.value.length, champ.value.length); }
  }

  menu() {
    const app = this.app;
    /* Pas de menu sans nom, et le contrôle est ICI plutôt qu'au premier lancement.

    Posé sur le seul passage de l'écran-titre, il aurait laissé entrer par toutes les autres portes :
    un lien `?track=`, un retour de course, un rechargement en pleine partie. Le menu est l'endroit
    par lequel tout le monde repasse, donc le seul où la question se pose une fois et une seule. */
    if (!nomValide(this.app.save.name)) return this.nomScreen();
    const t = (k, ...a) => this.t(k, ...a);
    const en = this.lang === 'en';
    const entries = [
      ['race', 'setup', 'quickRace', 'wheel'],
      ['timetrial', 'setup', 'timeTrial', 'clock'],
      ['', 'multi', 'multi', 'helmets'],
    ];
    this.show(`<header class="home-heading"><h1><img class="game-logo" src="art/interface/logo-grip.webp" alt="GRIP — Racing the Line"></h1></header>
      <div class="home-body"><nav class="mode-menu" data-pad-group aria-label="${en ? 'Game modes' : 'Modes de jeu'}">
      ${entries.map(([mode, action, label, icon]) => `<button class="mode-card mode-${mode || 'multi'}" data-action="${action}" ${mode ? `data-mode="${mode}"` : ''}>
          <span class="mode-art" aria-hidden="true"><img src="art/interface/${icon}.webp" alt=""></span>
          <span class="mode-copy"><b>${t(label)}</b></span><span class="mode-damier" aria-hidden="true"></span></button>`).join('')}
      </nav></div>
      <footer class="home-footer"><button class="home-settings" data-action="settings"><img src="art/interface/gear.webp" alt="">${t('settings')}</button>
        <button class="pilot-button" data-action="settings"><img src="art/interface/pilot.webp" alt=""><span>${t('pilotLabel')} :</span><b>${escapeHtml(app.save.name)}</b></button>
        ${app.mondial?.erreurConnexion ? `<button class="link" data-action="google">${t('reconnect')}</button>` : ''}</footer>
      <div class="home-version">v${APP_VERSION}${canalBadge()}</div>`, 'home-screen scroll');
  }

  circuitArt(trackDef) {
    // Custom tracks get a neutral background, never an unrelated real circuit.
    return !trackDef.custom && TRACKS.some(tr => tr.id === trackDef.id)
      ? `art/interface/circuits/${trackDef.id}.webp?r=cartoon-1` : '';
  }

  carPreview(model) {
    const app = this.app;
    const lv = livreeDe(model, app.playerLivreeFor(model.id));
    return `<div class="paddock-car"><div class="preview-copy"><span class="eyebrow">${escapeHtml(this.L(categoryById(model.catId).name))}${lv && lv.nom && lv.nom !== model.name ? ' · ' + escapeHtml(nomLivree(lv, this.lang)) : ''}</span><b>${escapeHtml(model.name)}</b></div>
      <div class="preview-car" aria-hidden="true">${this.carIcon(model, LIVERIES[app.save.livery], app.playerLivreeFor(model.id))}</div></div>`;
  }

  circuitFlag(trackDef) {
    const country = String(trackDef.country || '').toLowerCase();
    return ['it','be','mc','gb','jp','br','us','de','fr','au','at','nl'].includes(country)
      ? `<img class="circuit-flag" src="art/interface/flags/${country}.svg" alt="${escapeHtml(trackDef.country)}">`
      : '<span class="circuit-flag" aria-hidden="true">🏁</span>';
  }

  trackPreview(trackDef, tours) {
    const bg = this.circuitArt(trackDef);
    const country = trackDef.country ? new Intl.DisplayNames([this.lang], {type:'region'}).of(trackDef.country) : '';
    // La maquette porte le nombre de tours sous le nom : c'est la course qu'on va courir, pas
    // seulement le circuit. Hors course, la longueur seule.
    const detail = [country, this.longueur(trackDef), tours ? `${tours} ${this.t('laps')}` : ''].filter(Boolean).join(' · ');
    return `<div class="paddock-track" ${bg ? `style="background-image:url('${bg}')"` : ''}>
      <div class="track-heading"><div><b>${escapeHtml(trackDef.name)}</b><span>${escapeHtml(detail)}</span></div>${this.circuitFlag(trackDef)}</div>
      <img class="preview-track" src="${this.thumb(trackDef, 360)}" alt="${escapeHtml(this.t('track') + ' : ' + trackDef.name)}"></div>`;
  }

  liveryChoices(model) {
    const app = this.app, list = model.livrees || [];
    if (list.length < 2) return '';
    return `<div class="livery-choices" data-pad-group aria-label="${this.t('livery')}">${list.map((lv,i)=>`<button class="livery-choice ${app.playerLivreeFor(model.id)===i?'sel':''}" data-action="pickLivery" data-id="${i}" aria-pressed="${app.playerLivreeFor(model.id)===i}" aria-label="${escapeHtml(nomLivree(lv, this.lang))}">${this.carIcon(model,LIVERIES[app.save.livery],i)}<span>${escapeHtml(nomLivree(lv, this.lang))}</span></button>`).join('')}</div>`;
  }

  selectionPreview(model, trackDef) {
    return `<div class="selection-preview">${this.carPreview(model)}${this.trackPreview(trackDef)}</div>`;
  }

  settings() {
    const t = (k, ...a) => this.t(k, ...a), s = this.app.save, app = this.app;
    /* LA LANGUE EN PREMIER, et en deux boutons. Elle était un menu déroulant au milieu de la liste,
    après le nom et le compte : on ne la trouvait pas. Deux boutons nommés chacun dans sa propre langue
    se lisent même quand on ne comprend pas la langue de l'écran — c'est justement le cas où on la cherche. */
    this.show(`
      <h2>${t('settings')}</h2>
      <div class="langue"><span><span lang="fr">Langue</span> · <span lang="en">Language</span></span><div class="seg" role="group" aria-label="${t('language')}">${
        [['fr', 'langFr'], ['en', 'langEn']].map(([l, k]) => `<button class="${s.lang === l ? 'sel' : ''}" data-action="lang" data-id="${l}" aria-pressed="${s.lang === l}" lang="${l}">${t(k)}</button>`).join('')}</div></div>
      ${this.pcControls()}
      <div class="form">
        <label>${t('name')}<input id="inp-name" maxlength="${NOM_MAX}" autocomplete="off" autocapitalize="off"
          spellcheck="false" value="${escapeHtml(s.name)}" placeholder="${t('playerDefault')}"></label>
        <!-- Le compte se gère ICI, et pas seulement depuis un message d'erreur. Sans cette ligne,
             se déconnecter était impossible et changer de compte demandait de vider le navigateur. -->
        <label>${t('account')}<span class="compte">${
          app.mondial && app.mondial.connecte()
            ? `<b class="ok">${t('signedIn')}</b><button class="link" data-action="signOut">${t('signOut')}</button>`
            : `<button class="link" data-action="google">${t('signIn')}</button>`}</span></label>
        <label>${t('sound')}<select id="sel-sound"><option value="1" ${s.sound ? 'selected' : ''}>${t('on')}</option><option value="0" ${!s.sound ? 'selected' : ''}>${t('off')}</option></select></label>
        <label>${t('showLines')}<select id="sel-lines"><option value="0" ${s.showLines !== true ? 'selected' : ''}>${t('off')}</option><option value="1" ${s.showLines === true ? 'selected' : ''}>${t('on')}</option></select></label>
        <label>${t('telemetry')}<select id="sel-debug"><option value="0" ${s.debug !== true ? 'selected' : ''}>${t('off')}</option><option value="1" ${s.debug === true ? 'selected' : ''}>${t('on')}</option></select></label>
        <label>${t('pullBack')}<select id="sel-pull">${[[1, 'pullNone'], [1.3, 'pullSome'], [1.6, 'pullMore']].map(([v, k]) => `<option value="${v}" ${Math.abs((s.pullBack || 1) - v) < 0.05 ? 'selected' : ''}>${t(k)}</option>`).join('')}</select></label>
        <label>${t('ctrlSide')}<select id="sel-side"><option value="left" ${(s.ctrlSide || 'left') === 'left' ? 'selected' : ''}>${t('sideLeft')}</option><option value="right" ${s.ctrlSide === 'right' ? 'selected' : ''}>${t('sideRight')}</option></select></label>
        <label>${t('camera')}<select id="sel-cam">${[['track', 'camFollow'], ['fixed', 'camFixed'], ['avance', 'camAvance'], ['avanceFixe', 'camAvanceFixe']].map(([v, k]) => `<option value="${v}" ${(s.view || 'avanceFixe') === v ? 'selected' : ''}>${t(k)}</option>`).join('')}</select></label>
        <!-- L'aimant est un essai : il est donc éteint par défaut et se choisit ici, pour pouvoir
             le comparer manche par manche sans toucher au reste. -->
        <label>${t('aimant')}<select id="sel-aimant">${[[0, 'aimantOff'], [0.6, 'aimantDoux'], [1, 'aimantNormal'], [1.6, 'aimantFort'], [2.4, 'aimantTresFort'], [3.2, 'aimantDouble']].map(([v, k]) => `<option value="${v}" ${Math.abs((s.aimant || 0) - v) < 0.05 ? 'selected' : ''}>${t(k)}</option>`).join('')}</select></label>
        <!-- L'anticipation : combien le pilote lit la courbure de la ligne devant lui. À zéro il est en
             pure pursuit seul, donc il coupe la corde ; au-delà de 0,5 il oscille. Réglable pour que
             Bruno tranche au pouce ce que le banc ne départage qu'à moitié. -->
        <label>${t('anticip')}<select id="sel-ff">${[[0, 'anticipOff'], [0.3, 'anticipPeu'], [0.5, 'anticipMoy'], [1, 'anticipFort']].map(([v, k]) => `<option value="${v}" ${Math.abs((s.ff == null ? 0.3 : s.ff) - v) < 0.05 ? 'selected' : ''}>${t(k)}</option>`).join('')}</select></label>
        <!-- CE QUI EXCLUT DU TABLEAU MONDIAL SE DIT ICI, pas seulement après la course. Découvrir
             au résultat que son tour ne compte pas, c'est l'avoir couru pour rien ; la ligne
             n'apparaît que lorsqu'au moins un réglage exclut, donc elle ne pèse pas le reste du
             temps. -->
        ${(() => {
          const h = [];
          if (s.showLines) h.push(t('horsGuide'));
          if (s.aimant) h.push(t('horsAimant'));
          if ((s.ff == null ? 0.3 : s.ff) !== 0.3) h.push(t('horsFf'));
          if (s.wear && USURE_ACTIVE) h.push(t('horsUsure'));
          return h.length ? `<p class="avert">${t('horsClassement')}${h.join(', ')}.</p>` : '';
        })()}
        <label>${t('difficulty')}<select id="sel-diff">${NIVEAUX.map(d => `<option value="${d}" ${s.difficulty === d ? 'selected' : ''}>${t(d)}</option>`).join('')}</select></label>
      </div>
      <div class="row wrap"><button data-action="menu">${t('back')}</button><a href="analytics.html" class="stats-link">${t('statistics')} →</a><button class="danger" data-action="resetAll">${t('resetAll')}</button></div>
    `, 'scroll settings-screen', 'reglages');
  }

  controlHelp() {
    if (this.app.controls.mode === 'gamepad' && this.app.save.gamepadBrake !== 'auto') return this.t('controlGamepadManualHint');
    return this.t({ keyboard: 'controlKeyboardHint', wheel: 'controlWheelHint', gamepad: 'controlGamepadHint' }[this.app.controls.mode]);
  }
  pcControls() {
    if (!this.app.desktop) return '';
    // la manette mise de côté, il n'y a plus de commande à choisir : seulement l'aide du clavier
    if (!MANETTE) return `<p class="muted pc-controls" data-control-help>${this.controlHelp()}</p>`;
    return `<div class="pc-controls"><label for="sel-desktop-control">${this.t('pcControls')}</label>
      <select id="sel-desktop-control">${[['keyboard', 'controlKeyboard'], ['wheel', 'controlWheel'], ['gamepad', 'controlGamepad']].map(([mode, key]) =>
        `<option value="${mode}" ${this.app.controls.mode === mode ? 'selected' : ''}>${this.t(key)}</option>`).join('')}</select>
      <p data-control-help aria-live="polite">${this.controlHelp()}</p>
      <div class="pad-brake-options" ${this.app.controls.mode === 'gamepad' ? '' : 'hidden'}>
        <label>${this.t('padBrake')}<select id="sel-pad-brake">
          <option value="separate" ${this.app.save.gamepadBrake !== 'auto' ? 'selected' : ''}>${this.t('padBrakeSeparate')}</option>
          <option value="auto" ${this.app.save.gamepadBrake === 'auto' ? 'selected' : ''}>${this.t('padBrakeAuto')}</option>
        </select></label>
        <label>${this.t('engineBrake')}<select id="sel-engine-brake" ${this.app.save.gamepadBrake === 'auto' ? 'disabled' : ''}>
          ${[0,.05,.1,.15,.2,.3,.5,.75,1].map(v=>`<option value="${v}" ${v === this.app.save.engineBrake ? 'selected' : ''}>${Math.round(v*100)} %</option>`).join('')}
        </select></label>
      </div>
      ${this.app.state === 'paused' ? '<p data-controller-status aria-live="polite" hidden></p>' : ''}</div>`;
  }
  updateControllerStatus() {
    const options = this.root.querySelector('.pad-brake-options');
    if (options) options.hidden = this.app.controls.mode !== 'gamepad';
    const engine = this.root.querySelector('#sel-engine-brake');
    if (engine) engine.disabled = this.app.save.gamepadBrake === 'auto';
    const el = this.root.querySelector('[data-controller-status]');
    if (!el) return;
    el.hidden = this.app.controls.mode !== 'gamepad';
    const key = { ready: 'padReady', release: 'padRelease', disconnected: 'padDisconnected', unsupported: 'padUnsupported' }[this.app.controls.status];
    const value = this.t(key);
    if (el.textContent !== value) el.textContent = value;
  }

  /* La longueur d'un circuit, qu'il soit intégré ou dessiné.

  Un circuit intégré la porte en clair ; un circuit de l'éditeur la range sous `editor.lengthM`,
  puisque c'est le chiffre que l'auteur a tapé et dont toute son échelle découle. Lire seulement
  `length` aurait donc laissé la carte d'un circuit dessiné sans rien sous son nom. */
  longueur(tr) {
    const m = tr.length != null ? tr.length : tr.editor && tr.editor.lengthM;
    return m == null ? '' : `${Math.round(m)} m`;
  }

  /* Un rail qui défile de gauche à droite, à la place d'une grille qui s'empile.

  Neuf voitures et douze circuits en grille, c'est un écran de haut chacun sur un téléphone : on
  choisissait en faisant défiler la page, donc en perdant de vue tout ce qu'on ne choisissait pas.
  Un rail garde la série sur une seule ligne, et comparer redevient possible — c'est là tout le
  sujet d'un écran de sélection.

  Les deux flèches ne s'affichent qu'à la souris. Au doigt on pousse le rail, et deux boutons posés
  par-dessus les cartes prendraient la place des cartes elles-mêmes sur un écran étroit. */
  rail(nom, cls, cartes) {
    return `<div class="railbox">
      <button class="railarrow gauche" data-action="railTo" data-id="${nom}" data-dir="-1" aria-label="←">‹</button>
      <div class="rail ${cls}" data-rail="${nom}">${cartes}</div>
      <button class="railarrow droite" data-action="railTo" data-id="${nom}" data-dir="1" aria-label="→">›</button>
    </div>`;
  }

  /* Les records, une ligne par voiture plutôt qu'un seul chiffre.

  L'écran n'affichait que le meilleur tour du circuit, toutes voitures confondues. C'est le chiffre
  le moins utile des deux : il dit qu'on a déjà tourné vite ici, sans dire avec quoi, donc sans
  rien donner à battre. Une ligne par voiture transforme l'écran en tableau de chasse — on voit
  d'un coup celles qu'on a menées et celles qui attendent encore un tour.

  Rangées par temps, les vierges à la fin : un classement, pas un catalogue. Et la vignette à
  gauche parce qu'une liste de noms se lit, là où une liste de voitures se reconnaît. */
  records(trackId, cat, choisie, livery) {
    const t = (k, ...a) => this.t(k, ...a), s = this.app.save, app = this.app;
    /* Les temps du monde arrivent APRÈS l'écran, jamais avant lui.

    Attendre le réseau pour peindre aurait rendu un menu hors-ligne inutilisable, et un menu lent
    partout ailleurs. On peint donc avec ce qu'on a — les temps locaux, qui sont là — et la colonne
    du monde se remplit toute seule quand la réponse arrive. Si elle n'arrive jamais, il reste des
    tirets : un tableau vide est une information, une page qui ne s'ouvre pas n'en est pas une. */
    const mondiaux = this._mondiaux && this._mondiaux.circuit === trackId ? this._mondiaux.par : null;
    if (!mondiaux) this._chargeMondiaux(trackId);
    const lignes = modelsOf(cat.id)
      .map(m => ({ m, b: s.bestLaps[`${trackId}|${cat.id}|${m.id}`], w: mondiaux ? mondiaux[m.id] : undefined }))
      .sort((x, y) => (x.b == null ? 1 : 0) - (y.b == null ? 1 : 0) || (x.b || 0) - (y.b || 0));
    const cell = (v) => v == null ? `<span class="muted">--:--.---</span>` : fmtTime(v);
    return `<h3>${t('yourBest')}</h3>
      ${this.etatMondial()}
      ${app.mondial && app.mondial.dernierRefus
        ? `<p class="warn mondial-note">${this.messageRefus(app.mondial.dernierRefus.raison)}${
            app.mondial.detailRefus ? ` <small class="detail">${escapeHtml(String(app.mondial.detailRefus))}</small>` : ''}
            ${RECONNEXION.has(app.mondial.dernierRefus.raison)
              ? `<button class="link" data-action="google">${t('reconnect')}</button>` : ''}
            ${REGLAGES.has(app.mondial.dernierRefus.raison)
              ? `<button class="link" data-action="settings">${t('settings')}</button>` : ''}</p>` : ''}
      <div class="records">
        <div class="rhead">
          <span></span><b></b>
          <span class="rline-t">${t('yourBest')}</span>
          <span class="rline-t">${t('worldBest')}</span>
        </div>
        ${lignes.map(({ m, b, w }) => `<div class="rline ${m.id === choisie.id ? 'sel' : ''}">
          <span class="rline-img">${this.carIcon(m, livery, this.app.playerLivreeFor(m.id))}</span>
          <b>${escapeHtml(m.name)}</b>
          <span class="rline-t ${b == null ? 'muted' : ''}">${b == null ? '--:--.---' : fmtTime(b)}</span>
          <span class="rline-t monde" title="${w ? escapeHtml(w.pilote || '') : ''}">${
            mondiaux || !app.mondial ? cell(w && w.temps) : `<span class="muted">…</span>`}${
            w && w.pilote ? `<small>${escapeHtml(w.pilote)}</small>` : ''}</span>
        </div>`).join('')}
      </div>`;
  }

  /* Aller chercher les temps du monde, puis repeindre — et une seule fois.

  Le drapeau `_enCours` n'est pas une optimisation : `records()` est appelé à chaque rendu de
  l'écran, et repeindre à l'arrivée des temps rappelle `records()`. Sans lui, la réponse
  déclencherait la requête suivante, indéfiniment. */
  async _chargeMondiaux(trackId) {
    const app = this.app;
    if (!app.mondial || this._enCours === trackId) return;
    this._enCours = trackId;
    const lignes = await app.mondial.records(trackId);
    this._enCours = null;
    const par = {};
    for (const l of lignes) if (!par[l.voiture] || l.temps < par[l.voiture].temps) par[l.voiture] = l;
    this._mondiaux = { circuit: trackId, par };
    // on ne repeint que si le joueur est toujours devant le même écran et le même circuit
    if (this._cleEcran === 'depart:timetrial' && this.setup.trackId === trackId) this.setupScreen('timetrial');
  }

  /* Le filtre de catégorie posé au-dessus d'un rail de voitures.

  « Toutes » montre le plateau entier, rangé par catégorie ; une catégorie ne montre que les siennes.
  `verrou` sert au salon : seul l'hôte choisit la catégorie de la table, les autres la lisent. */
  filtreCat(action, courant, verrou) {
    const ids = ['all'].concat(playableCategories().map(c => c.id));
    return `<div class="seg filtre-cat">${ids.map(id => `<button class="${courant === id ? 'sel' : ''}" data-action="${action}" data-id="${id}" ${verrou ? 'disabled' : ''}>${id === 'all' ? this.t('catAll') : escapeHtml(this.L(categoryById(id).name))}</button>`).join('')}</div>`;
  }
  filtreCourant() {
    const f = this.app.save.filtreCat;
    return f && playableCategories().some(c => c.id === f) ? f : 'all';
  }
  /** Les voitures d'un filtre, catégorie après catégorie quand il les montre toutes. */
  modelesVisibles(filtre) {
    return filtre && filtre !== 'all' ? modelsOf(filtre) : playableCategories().flatMap(c => modelsOf(c.id));
  }
  // Quand le rail mélange les catégories, chaque carte dit la sienne : c'est elle qui décide contre qui on court.
  etiquetteCat(m) { return `<small class="cattag cat-${escapeHtml(m.catId)}">${escapeHtml(this.L(categoryById(m.catId).name))}</small>`; }

  setupScreen(mode) {
    const t = (k, ...a) => this.t(k, ...a), s = this.app.save, st = this.setup, app = this.app;
    st.mode = mode;
    /* La catégorie suit la voiture choisie, et le filtre ne fait que restreindre le rail.

    Filtrer sur une catégorie qui ne contient pas la voiture choisie y prend la dernière voiture
    choisie dans cette catégorie : sans cela la marque de sélection serait hors du rail, et l'écran
    annoncerait au départ une voiture qu'on ne voit nulle part. */
    const filtre = this.filtreCourant();
    if (filtre !== 'all') st.classId = filtre;
    else if (s.cat) st.classId = s.cat;
    if (!playableCategories().find(c => c.id === st.classId)) st.classId = DEFAUT_CAT;
    /* Les circuits perso ne se choisissent plus d'ici — sauf celui qu'un lien a nommé.

    La liste « Circuits perso » est retirée, mais le bouton « Essayer » de l'éditeur ouvre le jeu
    sur `index.html?track=…` et pose directement l'identifiant ici. Écarter tous les circuits perso
    aurait donc cassé l'aller-retour éditeur → jeu, qui est le seul moyen de voir un tracé qu'on
    vient de dessiner : on serait parti sur Monza sans qu'un mot le dise.

    Celui-là garde donc sa carte, ajoutée en fin de rail. Ce n'est pas la liste qui revient : il n'y
    a ni titre ni catalogue, seulement le circuit qu'on a demandé. Et il la garde justement pour que
    l'écran ne mente pas — sans carte, aucune marque de sélection nulle part, et une course qui part
    sur un tracé absent de l'écran. Tout autre circuit perso, lui, retombe sur le premier ouvert. */
    const ut = unlockedTracks(s);
    const perso = app.custom.tracks.find(tr => tr.id === st.trackId);
    if (!perso && !TRACKS.find(tr => tr.id === st.trackId && ut.has(tr.id))) st.trackId = TRACKS.find(tr => ut.has(tr.id)).id;
    const cat = categoryById(st.classId);
    const model = app.playerModelFor(cat.id);
    const trackDef = app.trackDefById(st.trackId);
    const laps = s.laps || lapsFor(trackDef, cat);
    const livery = LIVERIES[s.livery];
    const race = mode === 'race';
    this.show(`
      ${this.paddockTopbar(race ? t('quickRace') : t('timeTrial'))}
      <div class="setup-columns"><section class="setup-block car-sheet">
      ${this.filtreCat('pickCat', filtre)}
      ${this.carPreview(model)}
      ${this.liveryChoices(model)}
      ${this.heroStats(model)}
      ${this.rail('models', 'models', this.modelesVisibles(filtre).map(m => `<button class="card ${m.id === model.id ? 'sel' : ''}" data-action="pickModel" data-id="${m.id}">
            ${this.carIcon(m, livery, app.playerLivreeFor(m.id))}<b>${escapeHtml(m.name)}${m.custom ? ` <small>(${t('custom')})</small>` : ''}</b>
            ${filtre === 'all' ? this.etiquetteCat(m) : ''}
            ${this.repereLivree(m, app.playerLivreeFor(m.id))}
            ${this.tyres(m)}
            ${this.gauges(m)}</button>`).join(''))}
      </section><section class="setup-block circuit-sheet">${this.trackPreview(trackDef, race ? laps : null)}
      ${this.rail('tracks', 'tracks', TRACKS.map(tr => {
        const locked = !ut.has(tr.id);
        return `<button class="card ${tr.id === st.trackId ? 'sel' : ''} ${locked ? 'locked' : ''}" data-action="pickTrack" data-id="${tr.id}" ${locked ? 'disabled' : ''}>
            <span class="track-card-art" ${this.circuitArt(tr) ? `style="background-image:url('${this.circuitArt(tr)}')"` : ''}><img alt="" src="${this.thumb(tr, 90)}"></span><b>${tr.name}</b><small>${locked ? t('locked') : `${tr.flag} ${this.longueur(tr)}`}</small></button>`;
      }).join('') + (perso ? `<button class="card sel" data-action="pickTrack" data-id="${perso.id}">
            <img alt="" src="${this.thumb(perso, 90)}"><b>${escapeHtml(perso.name)}</b><small>${perso.flag || '🏁'} ${this.longueur(perso)}</small></button>` : ''))}
      <!-- La zone des circuits perso est retirée, comme le lien vers l'atelier l'avait été avant
           elle. Elle n'était plus alimentée par rien : l'atelier n'est plus accessible depuis le
           menu, si bien que la liste était soit vide, soit le musée des essais d'un ancien
           réglage. Les tracés enregistrés ne sont pas effacés pour autant — ils restent dans le
           navigateur et l'éditeur y mène encore par son adresse. -->
      ${race ? '' : `<div class="setup-records">${this.records(st.trackId, cat, model, livery)}</div>`}
      </section></div>
      ${this.setupBar(race, model, trackDef, laps)}
    `, 'scroll setup-screen', 'depart:' + mode);
  }

  /* La barre de titre des écrans de préparation : retour, damier, titre sur sa bande rouge, logo.

  Le damier est un élément à part entière et non un dégradé de fond : posé entre le retour et la
  bande rouge, il doit garder sa place quelle que soit la longueur du titre — « Course rapide »,
  « Contre-la-montre » ou le code d'une table. */
  paddockTopbar(titre, retour = 'menu', libelleRetour) {
    return `<div class="topbar"><button data-action="${retour}">← ${escapeHtml(libelleRetour || this.t('back'))}</button><span class="damier titre-damier" aria-hidden="true"></span><h2>${titre}</h2><img class="paddock-logo" src="art/interface/logo-grip.webp" alt="GRIP — Racing the Line"></div>`;
  }

  /* Les chiffres de la voiture, comme sur la maquette : pictogramme, valeur, libellé en clair.

  Les mêmes valeurs que les cadrans du rail (`perfOf`), écrites en ligne : sur le paddock la place
  manque pour quatre anneaux, et un chiffre suivi de son unité se lit plus vite qu'un arc. */
  heroStats(m) {
    const t = (k) => this.t(k), fr = this.lang === 'fr';
    const n = (v, d) => (+v).toFixed(d).replace('.', fr ? ',' : '.');
    const item = (ico, valeur, unite, libelle) => `<div class="stat"><span class="stat-ico">${ico}</span><div><b>${valeur}<small>${unite}</small></b><span>${libelle}</span></div></div>`;
    return `<div class="hero-performance">
      ${item(GAUGE_ICONS.top, Math.round(m.perf.vmax), 'km/h', t('statVmax'))}
      ${item(GAUGE_ICONS.acc, '0-100 : ' + n(m.perf.a100, 1), 's', t('statA100'))}
      ${item(GAUGE_ICONS.brk, n(m.perf.b100, 1), 'm', t('statB100'))}
      ${item(GAUGE_ICONS.grp, n(m.perf.gripG, 2), 'g', t('statGrip'))}
      <div class="stat stat-pilotage"><img class="stat-ico" src="art/interface/wheel.webp" alt=""><div><b>${this.tyres(m)}</b><span>${t('pilotage')}</span></div></div>
    </div>`;
  }

  /* La barre du bas : les réglages en pastilles, puis le damier et « En piste ! ».

  Les réglages tenaient dans un bloc à eux, sous les deux colonnes : sur un écran de PC il fallait
  descendre pour les voir, et c'est ce que la maquette ne fait pas. Une pastille porte le nom du
  réglage et sa valeur ; l'appui passe à la suivante. Ce sont les mêmes actions qu'avant
  (`pickDiff`, `pickLaps`, `pickWear`) avec pour identifiant la valeur SUIVANTE : le clavier, la
  souris, le tactile et la manette les déclenchent comme n'importe quel bouton.

  Le freinage et la commande restent des listes, parce que ce sont des listes — des
  configurations nommées, trois façons d'accélérer —, habillées en pastilles. Les options de la
  manette suivent la commande quand elle est choisie.

  CHAQUE LISTE EST SON PROPRE GROUPE pour la manette. Sur une liste, la croix gauche/droite change
  la valeur au lieu de passer à la voisine : deux listes rangées côte à côte dans un même groupe,
  la seconde n'aurait plus été atteignable qu'à la souris. RB/LB passe donc d'une liste à l'autre. */
  setupBar(race, model, trackDef, laps) {
    const t = (k, ...a) => this.t(k, ...a), s = this.app.save, st = this.setup, app = this.app;
    const suivant = (liste, cur) => liste[(liste.indexOf(cur) + 1) % liste.length];
    const pastille = (libelle, valeur, attrs) => `<button class="chip" ${attrs}><span>${libelle} :</span> <b>${valeur}</b></button>`;
    const toursCourants = s.lapsPerso ? 'perso' : (s.laps || 5);
    const frein = freinDe(s, st.trackId, model.id);
    const desktop = app.desktop;
    const gamepad = desktop && app.controls.mode === 'gamepad';
    return `<div class="setup-bar"><div class="setup-reglages">
      ${race ? `<div class="setup-chips" data-pad-group>
        ${pastille(t('difficulty'), t(s.difficulty), `data-action="pickDiff" data-id="${suivant(NIVEAUX, s.difficulty)}"`)}
        ${pastille(t('lapCount'), s.lapsPerso ? `${t('lapCustom')}` : (s.laps || 5), `data-action="pickLaps" data-id="${suivant([2, 5, 10, 20, 'perso'], toursCourants)}"`)}
        ${s.lapsPerso ? `<label class="chip chip-input"><span>${t('lapCount')} :</span><input id="inp-laps" type="number" min="1" max="99" value="${Math.max(1, Math.min(99, s.laps || 5))}"></label>` : ''}
        ${USURE_ACTIVE ? pastille(t('chipWear'), t(s.wear ? 'on' : 'off'), `data-action="pickWear" data-id="${s.wear ? 0 : 1}" title="${escapeHtml(t('wearHint'))}"`) : ''}
      </div>` : ''}
      <!-- La liste et le choix actif sont propres au couple circuit+voiture.
           Un même nom peut conserver des valeurs pour plusieurs couples ; chacun retrouve
           son propre choix quand le joueur revient, y compris « Par défaut ». -->
      <div class="setup-chips setup-tuning" data-pad-group>
        <label class="chip chip-select" data-pad-group title="${escapeHtml(t('regPortee'))}"><span>${t('freinage')} :</span><select id="sel-reglage">
          <option value="">${t('regDefaut')}</option>
          ${reglagesPour(s, st.trackId, model.id).map(c => `<option value="${escapeHtml(c.nom)}" ${configActive(s, st.trackId, model.id)?.nom === c.nom ? 'selected' : ''}>${escapeHtml(c.nom)}</option>`).join('')}
        </select><small class="reg-ici">${frein === 1 ? t('regIciDefaut') : t('regIci', frein)}</small></label>
        <button class="chip" data-action="startTune" data-pad-group>${t('regRegler')}</button>
      </div>
      ${desktop && MANETTE ? `<div class="setup-chips pc-controls" data-pad-group>
        <label class="chip chip-select" data-pad-group><span>${t('chipControl')} :</span><select id="sel-desktop-control">${[['keyboard', 'controlKeyboard'], ['wheel', 'controlWheel'], ['gamepad', 'controlGamepad']].map(([m, key]) =>
          `<option value="${m}" ${app.controls.mode === m ? 'selected' : ''}>${t(key)}</option>`).join('')}</select></label>
        <span class="pad-brake-options" ${gamepad ? '' : 'hidden'}>
          <label class="chip chip-select" data-pad-group><span>${t('padBrake')} :</span><select id="sel-pad-brake">
            <option value="separate" ${s.gamepadBrake !== 'auto' ? 'selected' : ''}>${t('padBrakeSeparate')}</option>
            <option value="auto" ${s.gamepadBrake === 'auto' ? 'selected' : ''}>${t('padBrakeAuto')}</option>
          </select></label>
          <label class="chip chip-select" data-pad-group><span>${t('engineBrake')} :</span><select id="sel-engine-brake" ${s.gamepadBrake === 'auto' ? 'disabled' : ''}>
            ${[0, .05, .1, .15, .2, .3, .5, .75, 1].map(v => `<option value="${v}" ${v === s.engineBrake ? 'selected' : ''}>${Math.round(v * 100)} %</option>`).join('')}
          </select></label>
        </span>
        <span class="sr" data-control-help aria-live="polite">${this.controlHelp()}</span>
      </div>` : ''}
      </div>
      <div class="row end setup-launch">
        <span class="muted launch-resume">${trackDef.flag || '🏁'} ${escapeHtml(trackDef.name)} · ${escapeHtml(model.name)} · ${race ? `${laps} ${t('laps')}` : t('ttIntro')}</span>
        <span class="damier launch-damier" aria-hidden="true"></span><button class="big primary" data-action="startQuick">${t('enPiste')} <span aria-hidden="true">→</span></button>
      </div>
    </div>`;
  }

  // ---------- racing together ----------

  /** The table: who is here, what we are racing, and the one button that drops the flag. */
  lobbyScreen(msg) {
    const t = (k, ...a) => this.t(k, ...a), app = this.app, net = app.net;
    if (!net || !net.available()) { this.show(`<div class="topbar"><button data-action="menu">← ${t('back')}</button><h2>${t('multi')}</h2></div><p class="muted">${t('netOff')}</p>`, 'center'); return; }
    const s = app.save, livery = LIVERIES[s.livery];
    const cat = categoryById(this.setup.classId);
    let model = app.playerModelFor(cat.id);

    if (net.state === 'off') {
      this.show(`
        ${this.paddockTopbar(t('multi'))}
        <p class="muted">${t('multiIntro')}</p>
        ${net.error ? `<p class="warn">${escapeHtml(this.netErreur(net.error))}</p>` : ''}
        ${msg ? `<p class="warn">${escapeHtml(this.netErreur(msg))}</p>` : ''}
        <div class="row wrap">
          <button class="big primary" data-action="netCreate" ${net.busy ? 'disabled' : ''}>${t('createTable')}</button>
          <label>${t('tableCode')}<input id="inp-code" maxlength="4" size="5" autocapitalize="characters" placeholder="ABCD"></label>
          <button class="big" data-action="netJoin" ${net.busy ? 'disabled' : ''}>${t('joinTable')}</button><button class="big" data-action="netWatch" ${net.busy ? 'disabled' : ''}>${t('watch')}</button>
        </div>
        ${net.busy ? `<p class="muted">${t('netWait')}</p>` : ''}
      `, 'scroll selection-screen lobby-entry');
      return;
    }

    const cfg = net.settings();
    /* La catégorie de la table, que seul l'hôte choisit.

    Quand elle exclut la voiture de ce poste, la voiture change ICI, d'elle-même, pour la dernière
    choisie dans la catégorie imposée — et le joueur repasse « pas prêt », pour qu'il voie ce qu'on a
    changé sous lui avant le départ plutôt que de le découvrir sur la grille. On publie sans repeindre :
    c'est précisément ce qu'on est en train de faire. */
    const tcat = cfg.cat && playableCategories().some(c => c.id === cfg.cat) ? cfg.cat : 'all';
    if (tcat !== 'all' && model.catId !== tcat) {
      this.setup.classId = tcat;
      model = app.playerModelFor(tcat);
      net.mine.car = { modelId: model.id, livree: app.playerLivreeFor(model.id) };
      net.mine.ready = false;
      net.post();
    }
    const list = net.members();
    const ut = unlockedTracks(s);
    const tracks = app.allTracks().filter(tr => tr.custom || ut.has(tr.id));
    const trackDef = app.trackDefById(cfg.trackId) || tracks[0];
    const modeDesc = { race: 'mRaceDesc', duel: 'mDuelDesc', ghost: 'mGhostDesc' }[cfg.mode] || 'mRaceDesc';
    this.show(`
      ${this.paddockTopbar(`${t('yourTable')} <b class="code">${escapeHtml(net.code)}</b>`, 'netLeave', t('leaveTable'))}
      ${net.error ? `<p class="warn">${escapeHtml(this.netErreur(net.error))}</p>` : ''}
      <p class="muted net-ping">${escapeHtml(net.link?.label((k) => this.t(k)) || 'Ping : —')} · ${t('roundTrip')}</p>
      ${list.some(m => !m.q.spectator && m.q.protocol !== DRIVE_PROTOCOL) ? `<p class="warn">${t('reloadAll')}</p>` : ''}
      <h3>${t('players')} <span class="muted">${list.filter(m => !m.q.spectator).length}/${NET_SEATS} · ${t('spectators', list.filter(m => m.q.spectator).length)}</span></h3>
      <div class="grid players">
        ${list.map((m, i) => `<div class="card ${m.isMe ? 'sel' : ''}">
          <b>${escapeHtml(m.name)}</b>
          <small>${i === 0 ? t('host') : ''}${i === 0 && m.isMe ? ' · ' : ''}${m.isMe ? t('you') : ''}${i > 0 ? ' · ' + (net.link?.ping(m.pid) ?? '—') + ' ms' : ''}</small>
          <small class="${m.ready ? 'ok' : 'muted'}">${m.q.spectator ? 'Spectateur' : m.ready ? '✓ ' + t('ready') : t('waiting')}</small>
        </div>`).join('')}
      </div>
      ${!net.creator ? `<button data-action="netRole">${net.mine.spectator ? 'Devenir pilote' : 'Devenir spectateur'}</button>` : ''}
      <h3>${t('mFormat')}</h3>
      <div class="seg">${NET_MODES.map(m => `<button class="${cfg.mode === m ? 'sel' : ''}" data-action="netMode" data-id="${m}" ${net.creator ? '' : 'disabled'}>${t({ race: 'mRace', duel: 'mDuel', ghost: 'mGhost' }[m])}</button>`).join('')}</div>
      <p class="muted">${t(modeDesc)}</p>
      <h3>${t('mCat')}</h3>
      ${this.filtreCat('netCat', tcat, !net.creator)}
      <p class="muted">${t(tcat === 'all' ? 'mCatOpen' : 'mCatDesc')}</p>
      ${this.selectionPreview(model, trackDef)}
      <h3>${t('track')}</h3>
      ${this.rail('netTracks', 'tracks', tracks.map(tr => `<button class="card ${tr.id === cfg.trackId ? 'sel' : ''}" data-action="netTrack" data-id="${tr.id}" ${net.creator ? '' : 'disabled'}>
          <span class="track-card-art" ${this.circuitArt(tr) ? `style="background-image:url('${this.circuitArt(tr)}')"` : ''}><img alt="" src="${this.thumb(tr, 90)}"></span><b>${escapeHtml(tr.name)}</b><small>${tr.flag || '🏁'} ${this.longueur(tr)}</small></button>`).join(''))}
      <h3>${t('model')}</h3>
      ${this.rail('netModels', 'models', this.modelesVisibles(tcat).map(m => `<button class="card ${m.id === model.id ? 'sel' : ''}" data-action="pickModelNet" data-id="${m.id}">
          ${this.carIcon(m, livery, app.playerLivreeFor(m.id))}<b>${escapeHtml(m.name)}</b>${tcat === 'all' ? this.etiquetteCat(m) : ''}
          ${this.repereLivree(m, app.playerLivreeFor(m.id))}${this.tyres(m)}</button>`).join(''))}
      <div class="row end">
        <span class="muted">${trackDef ? `${trackDef.flag || '🏁'} ${escapeHtml(trackDef.name)} · ` : ''}${escapeHtml(model.name)}</span>
        <button class="${net.mine.ready ? '' : 'primary'}" data-action="netReady" ${net.mine.spectator ? 'disabled' : ''}>${net.mine.ready ? t('notReady') : t('ready')}</button>
        ${net.creator ? `<button class="big primary" data-action="netStart" ${net.canStart() ? '' : 'disabled'}>${t('start')}</button>` : `<span class="muted">${t('startWhenReady')}</span>`}
      </div>
    `, 'scroll selection-screen lobby-screen', 'salon');
  }

  careerScreen() {
    const t = (k, ...a) => this.t(k, ...a), s = this.app.save, livery = LIVERIES[s.livery];
    this.show(`
      <div class="topbar"><button data-action="menu">← ${t('back')}</button><h2>${t('career')}</h2></div>
      <p class="muted">${t('careerIntro')}</p>
      <div class="cups">
        ${CUPS.map((c, i) => {
          const unlocked = cupUnlocked(s, i), cs = cupState(s, c.id), cat = categoryById(c.classId);
          const status = !unlocked ? t('locked') : cs.done ? `${t('done')} · ${t('finalPos', cs.finalPos)}` : cs.race > 0 ? `${t('inProgress')} · ${t('raceOf', cs.race + 1, c.tracks.length)}` : t('notStarted');
          return `<button class="cup ${unlocked ? '' : 'locked'} ${cs.done && cs.finalPos <= 3 ? 'won' : ''}" data-action="cup" data-id="${c.id}" ${unlocked ? '' : 'disabled'}>
            ${this.carIcon(this.app.playerModelFor(cat.id), livery, this.app.playerLivreeFor(this.app.playerModelFor(cat.id).id))}
            <div><b>${this.L(c.name)}</b><small>${this.L(cat.name)} · ${c.tracks.length} ${t('races')}</small><small class="status">${status}</small></div>
            <div class="medal">${cs.done && cs.finalPos <= 3 ? ['🥇', '🥈', '🥉'][cs.finalPos - 1] : unlocked ? '' : '🔒'}</div>
          </button>`;
        }).join('')}
      </div>
      ${allUnlocked(s) ? `<p class="muted">${t('allUnlocked')}</p>` : ''}
    `, 'scroll selection-screen', 'carriere');
  }

  cupScreen(cupId) {
    const t = (k, ...a) => this.t(k, ...a), s = this.app.save, app = this.app;
    const cup = CUPS.find(c => c.id === cupId), cs = cupState(s, cupId), cat = categoryById(cup.classId);
    const table = this.standingsTable(cup, cs);
    const idx = Math.min(cs.race, cup.tracks.length - 1);
    const trackDef = app.trackDefById(cup.tracks[idx]);
    const model = app.playerModelFor(cat.id), livery = LIVERIES[s.livery];
    this.show(`
      <div class="topbar"><button data-action="career">← ${t('back')}</button><h2>${this.L(cup.name)}</h2></div>
      <div class="cols">
        <div>
          <h3>${t('standings')}</h3>${table}
          <button class="link" data-action="resetCup" data-id="${cupId}">${t('resetCup')}</button>
          <h3>${t('model')}</h3>
          <div class="grid models small">${modelsOf(cat.id).map(m => `<button class="card ${m.id === model.id ? 'sel' : ''}" data-action="pickModelCup" data-id="${m.id}" data-cup="${cupId}">${this.carIcon(m, livery, app.playerLivreeFor(m.id))}<b>${escapeHtml(m.name)}</b>${this.repereLivree(m, app.playerLivreeFor(m.id))}</button>`).join('')}</div>
        </div>
        <div>
          <h3>${cs.done ? t('done') : t('nextRace')} · ${t('raceOf', idx + 1, cup.tracks.length)}</h3>
          <div class="tracklist">${cup.tracks.map((id, i) => { const tr = app.trackDefById(id); return `<div class="tr ${i < cs.race || cs.done ? 'past' : i === idx ? 'now' : ''}"><img alt="" src="${this.thumb(tr, 60)}"><span>${tr.flag} ${tr.name}</span><small>${lapsFor(tr, cat)} ${t('laps')}</small></div>`; }).join('')}</div>
          ${cs.done ? '' : `<div class="row end"><button class="big primary" data-action="startCup" data-id="${cupId}">${t('startRace')} — ${trackDef.name}</button></div>`}
        </div>
      </div>
    `, 'scroll selection-screen', 'coupe:' + cupId);
  }

  standingsTable(cup, cs) {
    const t = (k, ...a) => this.t(k, ...a);
    const rows = Object.entries(cs.points).sort((a, b) => b[1] - a[1]);
    if (!rows.length) return `<p class="muted">—</p>`;
    const me = this.app.playerName();
    return `<table class="tbl"><thead><tr><th>${t('pos')}</th><th>${t('driver')}</th><th>${t('points')}</th></tr></thead><tbody>
      ${rows.map(([n, p], i) => `<tr class="${n === me ? 'me' : ''}"><td>${i + 1}</td><td>${escapeHtml(n)}</td><td>${p}</td></tr>`).join('')}</tbody></table>`;
  }

  resultsScreen(race, ctx) {
    const t = (k, ...a) => this.t(k, ...a);
    const res = race.results, p = race.player;
    const isTT = race.mode === 'timetrial';
    let head = '';
    if (isTT) head = `<h2>${t('timeTrial')} · ${escapeHtml(race.track.name)}</h2><div class="bigstat">${t('bestLap')}: ${fmtTime(p.bestLap)} ${ctx.newRecord ? `<span class="rec">${t('newRecord')}</span>` : ''}</div>`;
    else head = `<h2>${t('results')} · ${escapeHtml(race.track.name)}</h2><div class="bigstat">${t('yourResult', race.positionOf(p))} ${ctx.newRecord ? `<span class="rec">${t('newRecord')}</span>` : ''}</div>`;
    /* Un tour annulé reste AFFICHÉ, barré, avec son chrono.

    Le retirer de la liste aurait été plus simple et beaucoup moins clair : le joueur aurait vu ses
    tours sauter sans savoir lesquels, ni pourquoi son meilleur tour n'est pas le plus rapide qu'il a
    vu passer au tableau de bord. Un chiffre barré répond aux deux questions d'un coup. */
    const tour = (lt, i) => {
      const nul = p.lapOk && p.lapOk[i] === false;
      return `<tr class="${!nul && lt === p.bestLap ? 'me' : ''}${nul ? ' nul' : ''}"><td>${i + 1}</td>`
        + `<td>${fmtTime(lt)}${nul ? ` <span class="mark" title="${escapeHtml(t('voidLapTitle'))}">${t('voidLap')}</span>` : ''}</td></tr>`;
    };
    // la pénalité ne prend une colonne QUE si quelqu'un en a une : une colonne de tirets sur dix
    // lignes occupe la moitié du tableau pour ne rien dire
    const avecPen = !isTT && res.some(r => r.penalite > 0);
    const penCell = (r) => !avecPen ? ''
      : `<td class="${r.penalite > 0 ? 'warn' : 'muted'}">${r.penalite > 0 ? `+${r.penalite.toFixed(1)}<small> (${r.fautes})</small>` : '—'}</td>`;
    const table = isTT ? `<table class="tbl"><thead><tr><th>${t('lap')}</th><th>${t('time')}</th></tr></thead><tbody>${p.lapTimes.map(tour).join('') || `<tr><td colspan="2">—</td></tr>`}</tbody></table>`
      : `<table class="tbl"><thead><tr><th>${t('pos')}</th><th>${t('driver')}</th><th>${t('model')}</th><th>${t('gap')}</th>${avecPen ? `<th>${t('penalty')}</th>` : ''}<th>${t('bestLap')}</th>${ctx.cup ? `<th>${t('points')}</th>` : ''}</tr></thead><tbody>
        ${res.map(r => `<tr class="${r.car.isPlayer ? 'me' : ''}"><td>${r.pos}</td><td><i class="dot" style="background:${r.car.livery.body}"></i>${escapeHtml(r.car.name)}</td><td class="muted">${escapeHtml(r.car.cls.name)}</td><td>${r.pos === 1 ? (r.time != null ? fmtTime(r.time) : '') : r.gap != null ? '+' + r.gap.toFixed(3) : t('dnf')}</td>${penCell(r)}<td>${r.bestLap != null ? fmtTime(r.bestLap) : '—'}</td>${ctx.cup ? `<td>${r.points}</td>` : ''}</tr>`).join('')}</tbody></table>`;
    let cupPart = '';
    if (ctx.cup) {
      const cs = cupState(this.app.save, ctx.cup.id);
      let banner = '';
      if (cs.done) banner = `<div class="banner ${cs.finalPos <= 3 ? 'good' : 'bad'}">${t('cupComplete')} ${cs.finalPos === 1 ? t('cupWon') : cs.finalPos <= 3 ? t('cupPodium') : t('cupFailed')} ${t('finalPos', cs.finalPos)}</div>`;
      cupPart = `<div><h3>${t('standings')} — ${this.L(ctx.cup.name)}</h3>${this.standingsTable(ctx.cup, cs)}${banner}</div>`;
    }
    /* La pénalité du joueur, EXPLIQUÉE sous le tableau.

    Un classement qui ne correspond pas à l'ordre d'arrivée, sans un mot, se lit comme un bogue. Une
    ligne dit combien de sorties, combien de secondes, et la règle en une phrase — y compris que les
    vibreurs ne comptent pas, qui est la question qu'on se pose en premier. */
    const mienne = res.find((r) => r.car.isPlayer);
    const motPen = mienne && mienne.penalite > 0
      ? `<p class="warn">${t('penaltyWhy', mienne.fautes, mienne.penalite.toFixed(1))}</p>` : '';
    this.show(`
      ${ctx.spectator ? `<h2>${t('results')} · ${escapeHtml(race.track.name)}</h2>` : head}
      <div class="cols"><div>${table}${motPen}</div>${cupPart}</div>
      ${ctx.online && race.broadcast ? race.broadcast.html(race) : ''}
      <div class="row end">
        <button data-action="menu">${t('menu')}</button>
        ${ctx.online ? `<button class="big primary" data-action="toLobby">${t('backToTable')}</button>` : ctx.cup ? (cupState(this.app.save, ctx.cup.id).done ? `<button class="big primary" data-action="cup" data-id="${ctx.cup.id}">${t('standings')}</button>` : `<button data-action="retryRace">${t('retry')}</button><button class="big primary" data-action="startCup" data-id="${ctx.cup.id}">${t('nextRace')}</button>`) : `<button data-action="setup" data-mode="${race.mode}">${t('back')}</button><button class="big primary" data-action="retryRace">${t('retry')}</button>`}
      </div>
    `, 'scroll');
  }

  pauseScreen(race) {
    const t = (k, ...a) => this.t(k, ...a);
    this.show(`
      <h2>${t('paused')}</h2>
      ${race.netDrive ? '<p class="muted">La course continue en ligne pendant que ce menu est ouvert.</p>' : ''}
      <div class="menu">
        <button class="big primary" data-action="resume">${t('resume')}</button>
        ${race.mode === 'timetrial' ? `<button class="big" data-action="endTT">${t('endSession')}</button>` : ''}
        ${race.reglage ? `<div class="form reglage-pause">
          <h3>${t('regTitre')} — ×${(race.frein || 1).toFixed(2)}</h3>
          <label>${t('regNom')}<input id="reg-nom" maxlength="24" placeholder="${escapeHtml(t('regDefaut'))}"
            value="${escapeHtml(configActive(this.app.save, race.track.id, race.opts.modelId)?.nom || '')}"></label>
          <button class="big primary" data-action="regEnreg">${t('regEnreg')}</button>
          <p class="muted">${t('regAide')}</p>
          <p class="muted petite">${t('regPortee')}</p>
        </div>` : ''}
        ${this.app.raceCtx && this.app.raceCtx.online ? '' : `<button data-action="retryRace">${t('restart')}</button>`}
        <button data-action="${this.app.raceCtx && this.app.raceCtx.online ? 'toLobby' : 'quitRace'}">${this.app.raceCtx && this.app.raceCtx.online ? t('backToTable') : t('quit')}</button>
      </div>
      ${this.app.desktop ? this.pcControls() : `<p class="muted">${t('howto')}</p>`}
    `, 'center overlay');
  }

  /* Enregistrer le réglage en cours sous un nom, depuis la pause.

  Le nom est le seul champ : le circuit et la voiture, on les connaît — ce sont ceux de la course
  qui tourne. Sans nom, on reprend celui de la configuration active ; sans configuration active,
  « Par défaut ». Réenregistrer sous un nom existant complète la configuration au lieu de la
  remplacer : on règle un circuit à la fois, et perdre les autres à chaque sauvegarde rendrait la
  chose inutilisable. */
  enregistreReglage() {
    const app = this.app, race = app.race, ctx = app.raceCtx;
    if (!race || !race.reglage || !ctx) return;
    const champ = document.getElementById('reg-nom');
    const nom = ((champ && champ.value) || '').trim()
      || configActive(app.save, ctx.trackId, race.opts.modelId)?.nom || this.t('regDefaut');
    poseFrein(app.save, nom, ctx.trackId, race.opts.modelId, race.frein || 1);
    storeSave(app.save);
    this.pauseScreen(race);
    const p = document.querySelector('.reglage-pause .muted');
    if (p) { p.textContent = this.t('regFait', nom); p.classList.add('ok'); }
  }

  workshopScreen(msg) {
    const t = (k, ...a) => this.t(k, ...a), app = this.app, livery = LIVERIES[app.save.livery];
    const cars = app.custom.cars;
    this.show(`
      <div class="topbar"><button data-action="menu">← ${t('back')}</button><h2>${t('workshop')}</h2></div>
      <p class="muted">${t('wsIntro')}</p>
      <div class="cols">
        <div class="form">
          <label>${t('wsName')}<input id="ws-name" maxlength="24" placeholder="${escapeHtml((modelById('f40') || {}).name || '')}"></label>
          <label>${t('wsCat')}<select id="ws-cat">${playableCategories().map(c => `<option value="${c.id}">${this.L(c.name)}</option>`).join('')}</select></label>
          <label>${t('wsLength')}<input id="ws-len" type="number" step="0.1" min="2" max="8" value="4.5"></label>
          <label>${t('wsWidth')}<input id="ws-wid" type="number" step="0.1" min="1" max="4" value="2"></label>
          <label>${t('wsSingle')}<input id="ws-single" type="file" accept="image/png,image/webp,image/jpeg"></label>
          <label>${t('wsFolder')}<input id="ws-folder" type="file" accept="image/png" multiple></label>
          <div class="row end"><span id="ws-msg" class="muted">${msg ? escapeHtml(msg) : ''}</span><button class="big primary" data-action="wsAdd">${t('wsAdd')}</button></div>
        </div>
        <div>
          <h3>${t('wsList')}</h3>
          ${cars.length ? `<div class="grid models">${cars.map(c => { const m = modelById(c.id); return `<div class="card">${m ? this.carIcon(m, livery) : ''}<b>${escapeHtml(c.name)}</b><small>${this.L(categoryById(c.catId).name)}</small><button class="link danger" data-action="wsDelete" data-id="${c.id}">${t('deleteTrack')}</button></div>`; }).join('')}</div>` : `<p class="muted">${t('wsNone')}</p>`}
        </div>
      </div>
    `, 'scroll', 'atelier');
  }

  async _workshopAdd() {
    const t = (k, ...a) => this.t(k, ...a), app = this.app;
    const name = (document.getElementById('ws-name').value || 'Custom').trim();
    const catId = document.getElementById('ws-cat').value;
    const length = +document.getElementById('ws-len').value || 4.5;
    const width = +document.getElementById('ws-wid').value || 2;
    const single = document.getElementById('ws-single').files[0];
    const folder = Array.from(document.getElementById('ws-folder').files || []);
    const layers = { base: null, color: null, extra: [] };
    if (folder.length) {
      const extras = [];
      for (const f of folder) {
        const n = f.name.toLowerCase();
        if (!n.endsWith('.png')) continue;
        if (n === 'car_base.png' || n === 'base.png') layers.base = await readFileAsDataURL(f);
        else if (n === 'car_color.png' || n === 'main_color.png' || n === 'color.png') layers.color = await readFileAsDataURL(f);
        else if (/^car_\d+\.png$/.test(n)) extras.push({ n: +n.match(/\d+/)[0], f });
      }
      extras.sort((a, b) => a.n - b.n);
      for (const ex of extras) layers.extra.push(await readFileAsDataURL(ex.f));
      if (!layers.base && folder.length === 1) layers.base = await readFileAsDataURL(folder[0]);
    } else if (single) {
      layers.base = await readFileAsDataURL(single);
    }
    if (!layers.base) { this.workshopScreen(t('wsNeedBase')); return; }
    const def = { id: uid('car'), name, catId, length, width, layers, mul: {} };
    await Store.put('cars', def);
    await app.refreshCustom();
    this.icons.clear();
    this.workshopScreen(t('wsAdded'));
  }

  // ---------- events ----------
  _onClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    e.stopPropagation();
    this._act(btn);
  }

  _act(btn, confirmed = false) {
    const a = btn.dataset.action, id = btn.dataset.id, app = this.app;
    app.audio.start(); app.audio.resume();
    switch (a) {
      case 'menu': app.toMenu(); break;
      /* On SORT avant d'entrer. Une session périmée encore en mémoire ferait revenir le joueur
         sur la même session morte, et le bouton n'aurait servi à rien d'autre qu'à l'y renvoyer. */
      case 'google': if (app.mondial) { app.mondial.sortir(); app.mondial.entrer(); } break;
      case 'signOut': if (app.mondial) { app.mondial.sortir(); this.settings(); } break;
      case 'nomOk': {
        const champ = document.getElementById('inp-nom');
        const n = nomPropre(champ ? champ.value : '');
        if (!nomValide(n)) return;              // le bouton est éteint, mais une touche Entrée passe
        app.save.name = n; storeSave(app.save);
        this.menu();
        break;
      }
      case 'settings': this.settings(); break;
      case 'enterGame': app.leaveSplash(); break;
      case 'majLancer': MAJ.lancer(); break;
      case 'majGarder': MAJ.plusTard(); break;
      case 'setup': this.setupScreen(btn.dataset.mode); break;
      case 'career': this.careerScreen(); break;
      case 'cup': this.cupScreen(id); break;
      case 'editor': location.href = 'editor.html'; break;
      case 'lang': if (id === 'fr' || id === 'en') { app.save.lang = id; storeSave(app.save); this.settings(); } break;
      case 'workshop': this.workshopScreen(); break;
      case 'wsAdd': this._workshopAdd().catch(err => this.workshopScreen(String(err))); break;
      case 'wsDelete': if (confirmed || confirm(this.t('confirmDelete'))) { Store.del('cars', id).then(() => { unregisterModel(id); return app.refreshCustom(); }).then(() => this.workshopScreen()); } break;
      /* Un appui CHOISIT, le suivant fait tourner la livrée.

      C'est la demande de Bruno : « en cliquant plusieurs fois sur une voiture on change à chaque
      fois de livrée ». Le premier appui sur une carte qui n'est pas la sienne la choisit — sinon
      changer de voiture changerait aussi sa peinture au passage, ce que personne ne demande. Une
      fois choisie, la carte devient le sélecteur de livrée. */
      case 'pickLivery': {
        const model=app.playerModelFor(this.setup.classId), index=Number(id);
        if(!Number.isInteger(index)||index<0||index>=(model.livrees||[]).length)break;
        app.save.livrees=app.save.livrees||{};app.save.livrees[model.id]=index;storeSave(app.save);
        this.setupScreen(this.setup.mode);break;
      }
      case 'pickModel': { this._choisitOuTourne(id, app.playerModelFor(this.setup.classId).id, true); this.setupScreen(this.setup.mode); break; }
      case 'pickCat': {
        app.save.filtreCat = id;
        if (id !== 'all') { app.save.cat = id; this.setup.classId = id; }
        storeSave(app.save); this.setupScreen(this.setup.mode); break;
      }
      case 'pickModelCup': {
        const cup = CUPS.find(c => c.id === btn.dataset.cup);
        this._choisitOuTourne(id, cup ? app.playerModelFor(cup.classId).id : null, false); this.cupScreen(btn.dataset.cup); break;
      }
      case 'pickTrack': this.setup.trackId = id; this.setupScreen(this.setup.mode); break;
      case 'pickDiff': app.save.difficulty = id; storeSave(app.save); this.setupScreen(this.setup.mode); break;
      case 'pickLaps': {
        // « Perso » garde le nombre courant et ouvre la saisie : on part de ce qu'on avait, on ne
        // repart pas de zéro, et taper 5 dans la case ne doit pas refermer la case.
        if (id === 'perso') app.save.lapsPerso = true;
        else { app.save.lapsPerso = false; app.save.laps = +id; }
        storeSave(app.save); this.setupScreen(this.setup.mode); break;
      }
      case 'pickLapsPerso': break;
      /* Une flèche défile et s'arrête là. Pas de `setupScreen` : repeindre l'écran pour un
         défilement referait les vignettes et rejouerait le placement, pour déplacer une barre. */
      case 'railTo': {
        const rail = this.root.querySelector(`[data-rail="${id}"]`);
        if (rail) rail.scrollBy({ left: (+btn.dataset.dir) * Math.max(180, rail.clientWidth * 0.8), behavior: 'smooth' });
        break;
      }
      case 'pickWear': app.save.wear = id === '1'; storeSave(app.save); this.setupScreen(this.setup.mode); break;
      case 'startQuick': app.startQuick(this.setup.mode, this.setup.classId, this.setup.trackId); break;
      case 'startTune': app.startQuick(this.setup.mode, this.setup.classId, this.setup.trackId, true); break;
      case 'regEnreg': this.enregistreReglage(); break;
      case 'multi': app.state = 'lobby'; this.lobbyScreen(); break;
      case 'netCreate': this._netOpen(true); break;
      case 'netJoin': this._netOpen(false); break;
      case 'netWatch': this._netOpen(false, true); break;
      case 'netRole': app.net.setMine({ spectator: !app.net.mine.spectator, ready: false }); app.net.pump(); break;
      case 'netLeave': app.toMenu(); break;
      case 'netMode': app.net.setTable({ mode: id }); break;
      case 'netTrack': app.net.setTable({ trackId: id, laps: lapsFor(app.trackDefById(id), categoryById(this.setup.classId)) }); break;
      case 'netReady': this._netReady(!app.net.mine.ready); break;
      case 'netStart': app.net.start(); break;
      case 'pickModelNet': { this._choisitOuTourne(id, app.playerModelFor(this.setup.classId).id, true); this._netCar(); this.lobbyScreen(); break; }
      case 'netCat': app.net.setTable({ cat: id }); break;
      case 'toLobby': app.toLobby(); break;
      case 'startCup': app.startCupRace(id); break;
      case 'resetCup': delete app.save.cups[id]; storeSave(app.save); this.cupScreen(id); break;
      case 'resetAll': if (confirmed || confirm(this.t('resetConfirm'))) { app.save = defaultSave(); app.setDesktopControl('keyboard'); this.settings(); } break;
      case 'resume': app.resume(); break;
      case 'retryRace': app.retry(); break;
      case 'quitRace': app.toMenu(); break;
      case 'endTT': app.endTimeTrial(); break;
    }
  }

  /* Choisir un modèle, ou faire tourner sa livrée s'il est déjà choisi.

  Une seule fonction pour les trois écrans qui montrent des cartes de voiture. Les trois faisaient
  déjà la même chose en trois copies, et la livrée aurait fait une quatrième ligne à recopier — donc
  un écran sur trois où le second appui n'aurait rien fait, et personne pour s'en apercevoir avant
  d'y passer. */
  _choisitOuTourne(id, actuel, suitCat) {
    const app = this.app, m = modelById(id);
    if (!m) return;
    /* « Déjà choisie », c'est la voiture AFFICHÉE comme choisie, pas celle qu'on a retenue dans sa
    catégorie. Avec le rail de toutes les catégories, une F1 retenue la dernière fois qu'on courait
    en F1 n'est pas la voiture choisie quand on court en GT : un appui doit la choisir, pas tourner
    sa livrée. */
    if (actuel !== id) {
      app.save.models[m.catId] = id;
      if (suitCat) { app.save.cat = m.catId; this.setup.classId = m.catId; }
      storeSave(app.save); return;
    }
    const n = m.livrees ? m.livrees.length : 1;
    if (n < 2) return;                       // rien à faire tourner : un seul dessin
    if (!app.save.livrees) app.save.livrees = {};
    app.save.livrees[id] = (app.playerLivreeFor(id) + 1) % n;
    storeSave(app.save);
  }

  _netCar() {
    const app = this.app, cat = categoryById(this.setup.classId);
    const id = app.playerModelFor(cat.id).id;
    // la livrée part avec le modèle : les autres écrans dessinent la voiture, ils doivent savoir
    // laquelle des trois peintures montrer
    app.net.setMine({ car: { modelId: id, livree: app.playerLivreeFor(id) } });
  }

  _netReady(v) {
    if (v) this._netCar();
    this.app.net.setMine({ ready: !!v });
  }

  async _netOpen(asHost, spectator = false) {
    const app = this.app;
    const code = asHost ? null : (document.getElementById('inp-code') || {}).value;
    this.lobbyScreen();                                  // redraw at once, to show it is working
    const ok = await app.net.open(app.playerName(), asHost, code, spectator);
    if (ok) { this._netCar(); this._netReady(false); }
    if (app.state === 'lobby') this.lobbyScreen();
  }

  /* Le nettoyage à la frappe, sur les deux champs de nom.

  On replace le curseur à la main : réécrire `value` le renvoie en fin de chaîne, si bien qu'une
  correction au milieu d'un nom déjà tapé expédiait le curseur à la fin à chaque lettre. On ne
  décompte que ce qui a été retiré AVANT le curseur : un caractère refusé plus loin dans le champ
  ne doit pas décaler ce qu'on est en train d'écrire. */
  _onInput(e) {
    const el = e.target;
    if (el.id !== 'inp-nom' && el.id !== 'inp-name') return;
    const avant = el.value, pos = el.selectionStart == null ? avant.length : el.selectionStart;
    const propre = nomPropre(avant);
    if (propre !== avant) {
      const retires = pos - nomPropre(avant.slice(0, pos)).length;
      el.value = propre;
      const p = Math.max(0, pos - retires);
      try { el.setSelectionRange(p, p); } catch (_) { /* un champ non textuel n'a pas de curseur */ }
    }
    /* La frappe NETTOIE, elle n'enregistre pas.

    Le champ des réglages écrivait dans la sauvegarde à chaque lettre, et le garde-fou vivait sur
    `change` — qui remet le champ à la valeur sauvegardée quand la saisie ne vaut rien. Sauf que
    cette valeur venait d'être écrasée : effacer son nom lettre par lettre enregistrait le dernier
    morceau encore valide, « Br » pour « Bruno42 », et effacer jusqu'au bout enregistrait le vide,
    que le retour au menu prenait pour un premier lancement.

    Le nom s'écrit donc quand on QUITTE le champ, et seulement s'il en est un (`_onChange`). On ne
    perd rien : partir d'un champ, c'est le quitter. */
    if (el.id === 'inp-nom') {
      const b = document.getElementById('btn-nom');
      if (b) b.disabled = !nomValide(el.value);
    }
  }

  _onChange(e) {
    const el = e.target, s = this.app.save;
    if (el.id === 'sel-pad-brake' || el.id === 'sel-engine-brake') {
      if (el.id === 'sel-pad-brake') s.gamepadBrake = el.value === 'auto' ? 'auto' : 'separate';
      else s.engineBrake = throttleAmount(+el.value);
      storeSave(s); this.app.resetInput(); this.updateControllerStatus();
      this.root.querySelector('[data-control-help]').textContent = this.controlHelp();
    }
    if (el.id === 'sel-desktop-control') {
      this.app.setDesktopControl(el.value);
      this.root.querySelector('[data-control-help]').textContent = this.controlHelp();
      this.updateControllerStatus();
    }
    /* On n'enregistre que ce qui fait un nom. Vider le champ dans les réglages aurait renvoyé
    l'écran du nom à la figure du joueur au retour au menu, comme s'il venait d'arriver. */
    if (el.id === 'inp-name') { if (nomValide(el.value)) { s.name = el.value; storeSave(s); } else el.value = s.name; }
    if (el.id === 'inp-laps') {
      s.laps = Math.max(1, Math.min(99, Math.round(+el.value) || 5));
      storeSave(s); this.setupScreen(this.setup.mode);
    }
    if (el.id === 'sel-sound') { s.sound = el.value === '1'; storeSave(s); this.app.audio.setEnabled(s.sound); }
    if (el.id === 'sel-lines') { s.showLines = el.value === '1'; storeSave(s); this.app.renderer.showLines = s.showLines; }
    // le côté du levier : le rendu le relit à chaque image, il n'y a rien d'autre à faire ici
    if (el.id === 'sel-side') { s.ctrlSide = el.value === 'right' ? 'right' : 'left'; storeSave(s); }
    if (el.id === 'sel-reglage') {
      const st = this.setup;
      choisitReglage(s, st.trackId, this.app.playerModelFor(st.classId).id, el.value);
      storeSave(s); this.setupScreen(st.mode);
    }
    if (el.id === 'sel-cam') { s.view = el.value; s.camRotate = el.value === 'track' || el.value === 'avance'; storeSave(s); this.app.renderer.setView(s.view); }
    if (el.id === 'sel-pull') { s.pullBack = this.app.renderer.setPullBack(el.value); storeSave(s); }
    if (el.id === 'sel-aimant') { s.aimant = PHYS.aimant = +el.value; storeSave(s); }
    if (el.id === 'sel-ff') { s.ff = PHYS.ff = +el.value; storeSave(s); }
    if (el.id === 'sel-debug') { s.debug = el.value === '1'; storeSave(s); this.app.renderer.debug = s.debug; }
    if (el.id === 'sel-diff') { s.difficulty = el.value; storeSave(s); }
  }
}

// La pastille du canal à côté du numéro de version : seulement en recette, pour ne jamais confondre.
function canalBadge() { return typeof APP_CANAL !== 'undefined' && APP_CANAL === 'recette' ? ' <b class="canal">RECETTE</b>' : ''; }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
