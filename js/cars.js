// Car categories and models. Units: m, m/s, m/s².
//  vmax top speed · accel · brake (deceleration when released) · grip (lateral m/s² at low speed)
//  df downforce (extra grip = df·v², capped) · slide (how brutally the car drifts when over the limit)
//  laneK yaw responsiveness · rearBias rear grip relative to front (<1 oversteer-prone, >1 understeer-prone)
//  cliff how much grip a tyre loses once pushed well past its peak slip angle (0..1)
//  slipPeak body slip angle (rad) at which the tyres give their maximum: bigger = lazier, more visible drift
//  roadScale (road width factor) · zoom (camera)
//
//  pick: illustration en trois quarts pour le menu de selection. La vue de dessus dit comment la
//    voiture se pose sur la piste, pas a quoi elle ressemble ; on choisit une voiture de face.
//  engine: what the car sounds like, and it is real engine data rather than a tone choice.
//    cyl      cylinders. A four-stroke fires cyl/2 times per crank revolution, so this alone sets
//             the note: at the same rpm a V12 sounds an octave above a straight-six. It is the
//             single thing that tells two cars apart by ear.
//    redline  rpm at the top of the rev range, reached in top gear at vmax
//    idle     rpm at rest
//    rough    how uneven the firing feels, 0 to 1. A cross-plane V8 (Corvette, GT40) fires
//             unevenly and rumbles; a flat-plane V8, a V12 or a straight-six is smooth.
//    bright   how much upper-order content, 0 to 1: a racing engine screams, a road V8 thumps
//    turbo    0 to 1, the whistle and the blow-off on lift
'use strict';

/* TROIS CATÉGORIES, ET DEUX ÉQUILIBRES QUI NE SONT PAS LE MÊME.

Dans une catégorie, les voitures se valent au tour et diffèrent par le caractère : une différence de
caractère est un choix offert au joueur, cinq secondes au tour n'en est pas un. ENTRE catégories,
l'écart est voulu : une F1 ou un prototype va plus vite qu'une GT, et c'est ce qu'on attend d'eux.
La base de chaque catégorie porte ce rang ; les `mul` de chaque voiture ne portent que son caractère,
autour de 1. `node tools/plateau-banc.js` mesure les deux équilibres à la fois.

POINTES HISTORIQUES INDICATIVES, SELON CONFIGURATION. La `vmax` de base de chaque catégorie est celle de sa voiture
la plus rapide — 315 km/h pour la Renault RS10, 368 pour la F40 LM, 386 pour la XJR-9 aux Hunaudières
—, et chaque `mul.vmax` est le rapport de la pointe retenue à celle-là. Les sources et leur fiabilité
figurent dans `tools/fiches.json` ; les neuf F1 restent des estimations. Les pointes influencent
aussi les reprises à haute vitesse, ce qui permet de garder un plateau équilibré avec des pointes
aussi étalées que 251 et 368 km/h chez les GT.

La largeur de route (`roadScale`) et le cadrage (`zoom`) sont LES MÊMES pour les trois. La largeur
de route décide où passent les trois trajectoires, et les panneaux de freinage, les lignes reprises
à la main et les bancs des circuits sont tous calés dessus : une catégorie qui la changerait
roulerait sur un autre circuit que celui qu'on a dessiné. */
const CATEGORIES = [
  {
    id: 'f1', name: { fr: 'F1', en: 'F1' },
    desc: { fr: 'Les monoplaces des années soixante-dix : légères, collées, et qui freinent tard.', en: 'Seventies single-seaters: light, glued down, braking late.' },
    engine: { cyl: 8, redline: 10800, idle: 1600, rough: 0.1, bright: 0.92, turbo: 0 },
    base: { vmax: 315 / 3.6, accel: 9.1, brake: 18.6, grip: 14.6, df: 0.0042, slide: 0.56, laneK: 6, rearBias: 1.06, cliff: 0.2, slipPeak: 0.11, length: 4.2, width: 2.0 },
    drivers: 10, roadScale: 0.9, zoom: 1.15,
    models: [
      { id: 'tyrrellp34', diff: 1, name: 'Sixpence Hexa', shape: 'wedge72',
        mul: { vmax: 0.921, accel: 1, brake: 1.07, grip: 0.993, df: 0.8, slide: 0.9 },
        colors: ['#174d9b', '#f4da38'], top: 'sprites/top/tyrrellp34.png', pick: 'sprites/pick/tyrrellp34.png',
        livrees: [{ id: '', nom: 'Bleu · Scheckter · 1976', en: 'Blue · Scheckter · 1976' }],
        engine: { cyl: 8, redline: 10500, idle: 1600, rough: 0.1, bright: 0.92, turbo: 0 } },
      { id: 'ferrari312t', diff: 3, name: 'Purosangue Dodici T', shape: 'wedge72',
        mul: { vmax: 0.984, accel: 1.06, brake: 1, grip: 1.038, df: 0.85, slide: 1.1 },
        colors: ['#dc282d', '#f5f3e9'], top: 'sprites/top/ferrari312t.png', pick: 'sprites/pick/ferrari312t.png',
        livrees: [{ id: '', nom: 'Lauda · 1975 · 12' }],
        engine: { cyl: 12, redline: 12500, idle: 1700, rough: 0.06, bright: 0.98, turbo: 0 } },
      { id: 'mclarenm23', diff: 1, name: 'McHaggis Arrow 23', shape: 'wedge72',
        mul: { vmax: 0.952, accel: 1.03, brake: 1, grip: 0.988, df: 0.95, slide: 1 },
        colors: ['#e3352d', '#f5f3e9'], top: 'sprites/top/mclarenm23.png', pick: 'sprites/pick/mclarenm23.png',
        livrees: [{ id: '', nom: 'Hunt · 1976 · 11' }],
        engine: { cyl: 8, redline: 10800, idle: 1600, rough: 0.1, bright: 0.92, turbo: 0 } },
      { id: 'lotus79', diff: 0, name: 'Bumblebee Ground 79', shape: 'wedge72',
        mul: { vmax: 0.936, accel: 0.97, brake: 1, grip: 0.903, df: 1.45, slide: 0.95 },
        colors: ['#161719', '#d4b35e'], top: 'sprites/top/lotus79.png', pick: 'sprites/pick/lotus79.png',
        livrees: [{ id: '', nom: 'Noir et or · Andretti · 1978', en: 'Black and gold · Andretti · 1978' }],
        engine: { cyl: 8, redline: 11000, idle: 1600, rough: 0.1, bright: 0.92, turbo: 0 } },
      { id: 'lotus72', diff: 3, name: 'Bumblebee Wedge 72', shape: 'wedge72',
        mul: { vmax: 0.936, accel: 1.08, brake: 1.03, grip: 1.055, df: 0.6, slide: 1.05 },
        colors: ['#161719', '#d4b35e'], top: 'sprites/top/lotus72.png', pick: 'sprites/pick/lotus72.png',
        livrees: [{ id: '', nom: 'Noir et or · Fittipaldi · 1972', en: 'Black and gold · Fittipaldi · 1972' }],
        engine: { cyl: 8, redline: 10000, idle: 1500, rough: 0.1, bright: 0.9, turbo: 0 } },
      { id: 'brabhambt46b', diff: 0, name: 'Boomerang Fan 46', shape: 'wedge72',
        // Ventilateur : davantage d'accroche lente, moins de dépendance à l'appui de vitesse.
        mul: { vmax: 0.927, accel: 0.97, brake: 1, grip: 1.065, df: 0.58, slide: 0.88 },
        colors: ['#e8202a', '#f4f4f4'], top: 'sprites/top/brabhambt46b.png', pick: 'sprites/pick/brabhambt46b.png',
        livrees: [{ id: '', nom: 'Rouge · Lauda · 1978', en: 'Red · Lauda · 1978' }],
        engine: { cyl: 12, redline: 12000, idle: 1700, rough: 0.05, bright: 0.96, turbo: 0 } },
      { id: 'williamsfw07', diff: 1, name: 'Windsor 07', shape: 'wedge72',
        mul: { vmax: 0.952, accel: 1.02, brake: 1.02, grip: 0.912, df: 1.35, slide: 0.97 },
        colors: ['#f4f4f4', '#1f6b3a'], top: 'sprites/top/williamsfw07.png', pick: 'sprites/pick/williamsfw07.png',
        livrees: [{ id: '', nom: 'Blanc et vert · Jones · 1979', en: 'White and green · Jones · 1979' }],
        engine: { cyl: 8, redline: 11000, idle: 1600, rough: 0.1, bright: 0.92, turbo: 0 } },
      { id: 'ligierjs11', diff: 0, name: 'Le Coq Bleu 11', shape: 'wedge72',
        mul: { vmax: 0.946, accel: 0.99, brake: 1.08, grip: 0.913, df: 1.25, slide: 0.92 },
        colors: ['#2f7fd1', '#f4f4f4'], top: 'sprites/top/ligierjs11.png', pick: 'sprites/pick/ligierjs11.png',
        livrees: [{ id: '', nom: 'Bleu et blanc · Laffite · 1979', en: 'Blue and white · Laffite · 1979' }],
        engine: { cyl: 8, redline: 11000, idle: 1600, rough: 0.1, bright: 0.92, turbo: 0 } },
      { id: 'renaultrs10', diff: 2, name: 'Somua Turbo 10', shape: 'wedge72',
        mul: { vmax: 1, accel: 0.93, brake: 0.98, grip: 1.023, df: 1, slide: 1.04 },
        // Relance douce, puis poussée soutenue : courbe de jeu selon la vitesse, sans délai de turbo.
        driveCurve: { low: 0.94, high: 1.20, from: 80 / 3.6, to: 200 / 3.6 },
        colors: ['#f2c500', '#141414'], top: 'sprites/top/renaultrs10.png', pick: 'sprites/pick/renaultrs10.png',
        livrees: [{ id: '', nom: 'Jaune · Jabouille · 1979', en: 'Yellow · Jabouille · 1979' }],
        engine: { cyl: 6, redline: 11000, idle: 1800, rough: 0.2, bright: 0.8, turbo: 1 } },
    ],
  },
  {
    // L'identifiant reste `gt` : les records de tour sont rangés sous `circuit|catégorie|voiture`
    // dans la sauvegarde, et les GT y gardent donc les leurs sans migration.
    id: 'gt', name: { fr: 'GT', en: 'GT' },
    desc: { fr: 'Les grand tourisme, des années soixante aux années quatre-vingt : lourdes, puissantes, joueuses.', en: 'Grand tourers from the sixties to the eighties: heavy, powerful, playful.' },
    engine: { cyl: 8, redline: 7000, idle: 1000, rough: 0.35, bright: 0.6, turbo: 0 },
    base: { vmax: 368 / 3.6, accel: 8, brake: 17, grip: 13.5, df: 0.0015, slide: 0.6, laneK: 6, rearBias: 1.06, cliff: 0.18, slipPeak: 0.12, length: 4.5, width: 2.0 },
    drivers: 10, roadScale: 0.9, zoom: 1.15,
    models: [
      { id: 'm1procar', diff: 3, name: 'Howitzer K1', shape: 'gtBoxy', mul: { vmax: 0.842, accel: 1.06, brake: 1.03, grip: 0.966, df: 1, slide: 1 }, pick: 'sprites/pick/m1procar.png', engine: {
        cyl: 6, redline: 9000, idle: 1100, rough: 0.15, bright: 0.78, turbo: 0,
// Découpé dans l'onboard par `tools/enginecut.py`. Six boucles pour couvrir la plage
        // utile : une seule, transposée du ralenti au rupteur, fait trois octaves et ne sonne
        // plus comme un moteur. Hors de la plage couverte, la synthèse reprend la main.
        sample: { ramp: 'sounds/engine/six-inline.json' },
      }, colors: ['#f4f4f4', '#2166d8'], top: 'sprites/top/m1procar.png',
        /* Trois livrées, nommées d'après ce qui est peint sur la voiture, comme pour la F40 et la
        CSL. Les deux chemins se déduisent du suffixe, comme partout ailleurs. */
        livrees: [
          { id: '', nom: 'Bandes tricolores · 280', en: 'Tricolour stripes · 280' },
          { id: 'BASF', nom: 'Cibles rouges · 79', en: 'Red targets · 79' },
          { id: 'DENIM', nom: 'Bleu rayé · 81', en: 'Blue stripes · 81' },
        ] },
      { id: 'f40', diff: 3, name: 'Purosangue Furia 40', shape: 'f40', mul: { vmax: 1, accel: 1.12, brake: 1, grip: 0.937, df: 1.5, slide: 1 }, pick: 'sprites/pick/f40.png', engine: {
        cyl: 8, redline: 7750, idle: 1000, rough: 0.15, bright: 0.8, turbo: 0.9,
        sample: { ramp: 'sounds/engine/v8-f40.json' },
      }, colors: ['#e0262c', '#22242b'], top: 'sprites/top/f40.png',
        /* Trois livrées, nommées d'après ce qui est écrit sur la voiture plutôt que d'après sa
        couleur : « Pilot » et « Crawford » se lisent sur les flancs, et aucun des trois mots n'a à
        être traduit — ces noms s'affichent tels quels dans les deux langues du jeu.

        La PLANCHE DE ROTATION ne suit pas. Elle ne sert qu'à la caméra inclinée, qui n'est pas celle
        par défaut, et il en faudrait une par livrée — huit vues chacune. En vue inclinée les trois
        F40 gardent donc l'aspect de la planche d'origine. C'est dit ici parce que c'est le genre
        d'écart qu'on découvre six mois plus tard en changeant de caméra. */
        livrees: [
          { id: '', nom: 'Bleu · 56', en: 'Blue · 56' },
          { id: 'red', nom: 'Rosso' },
          { id: 'yellow', nom: 'Crawford' },
        ] },
      { id: 'countach', diff: 3, name: 'Stallone Furioso', shape: 'wedgeGT', mul: { vmax: 0.815, accel: 1.1, brake: 0.95, grip: 0.968, df: 1, slide: 1 }, pick: 'sprites/pick/countach.png', engine: {
        cyl: 12, redline: 7500, idle: 900, rough: 0.05, bright: 0.88, turbo: 0,
        // La rampe la plus large du jeu : vingt-cinq demi-tons, 1821 tr/min au rupteur, d'un seul
        // rapport et sans coupure. C'est ce qu'il faut pour n'avoir presque rien à confier à la
        // synthèse — la plage enregistrée couvre à elle seule tout ce qu'on entend en course.
        sample: { ramp: 'sounds/engine/v12-countach.json' },
      }, colors: ['#ffd400', '#22242b'], top: 'sprites/top/countach.png' },
      // La prise vient d'une 911 RSR, la seule 911 du plateau étant celle-ci. Un RSR est atmosphérique
      // là où la Turbo ne l'est pas : le sifflement reste à la synthèse, la matière du plat-six est
      // celle de l'enregistrement.
      { id: '930', diff: 5, name: 'Breithüft Turbo 9', shape: 'roundGT', mul: { vmax: 0.802, accel: 1.09, brake: 1, grip: 1.026, df: 1, slide: 1.2 }, pick: 'sprites/pick/930.png', engine: {
        cyl: 6, redline: 7000, idle: 950, rough: 0.3, bright: 0.6, turbo: 0.85,
        sample: { ramp: 'sounds/engine/flat6-930.json', bas: 'sounds/engine/flat6-930-bas.json' },
      }, colors: ['#c9ced6', '#e0262c'], top: 'sprites/top/930.png',
        /* Trois livrées, nommées d'après ce qui est peint sur la voiture, comme la F40, la CSL et
        la M1. Les deux chemins se déduisent du suffixe.

        LES DEUX ILLUSTRATIONS DE MENU SONT EN MIROIR, et ça se voit : « Vaillant » et « MOTUL » s'y
        lisent à l'envers. Les neuf voitures du plateau sont dessinées nez à gauche, les deux rendus
        d'origine regardaient à droite, et les retourner pour qu'elles aillent dans le même sens
        retourne le lettrage avec. Les redresser ferait l'inverse : du texte lisible et une voiture
        qui regarde seule dans l'autre sens, au milieu du carrousel. Les vues de DESSUS, elles —
        celles qu'on voit en course — sont dans le bon sens et leur lettrage est juste. */
        livrees: [
          { id: '', nom: 'Blanc rayé · 46', en: 'White stripes · 46' },
          { id: 'swiss', nom: 'Croix suisse · 30', en: 'Swiss cross · 30' },
          { id: 'valliant', nom: 'Turquoise arc-en-ciel · 5', en: 'Rainbow turquoise · 5' },
        ] },
      { id: 'corvette', diff: 5, name: 'Moonshine Sting', shape: 'roundGT', mul: { vmax: 0.94, accel: 1.06, brake: 0.95, grip: 1.026, df: 0.9, slide: 1.3 }, pick: 'sprites/pick/corvette.png', engine: {
        cyl: 8, redline: 6000, idle: 750, rough: 0.7, bright: 0.4, turbo: 0,
        // Découpé dans son propre onboard. Les étiquettes portent une correction d'octave : sur
        // cette prise l'estimateur s'accrochait au demi-ordre plutôt qu'à l'allumage, ce que le
        // sonagramme montre — les rangs y sont espacés d'une cinquantaine de hertz, soit un demi-
        // ordre à 6000 tr/min et non un allumage à 3000. Sans elle, la voiture sonnerait une
        // octave trop bas.
        sample: { ramp: 'sounds/engine/v8-corvette.json' },
      }, colors: ['#d8dce2', '#e0262c'], top: 'sprites/top/corvette.png' },
      { id: 'csl', diff: 4, name: 'Howitzer 3.0 Leicht', shape: 'gtBoxy', mul: { vmax: 0.734, accel: 1.02, brake: 1.03, grip: 1.016, df: 1.2, slide: 1.1 }, pick: 'sprites/pick/csl.png', engine: { cyl: 6, redline: 7000, idle: 950, rough: 0.1, bright: 0.68, turbo: 0 }, colors: ['#f7f7f7', '#2166d8'], top: 'sprites/top/csl.png',
        /* Trois livrées, et la première est celle qui existait déjà.

        Une livrée n'est pas une couleur ici : une illustration remplace le dessin vectoriel ET la
        couleur, donc la seule façon de changer de livrée est de changer de dessin. Les fichiers
        se déduisent de l'identifiant — `sprites/top/csl_castrol.png` et sa vignette dans
        `sprites/pick/` — et un identifiant vide garde les fichiers sans suffixe, pour que la
        livrée d'origine n'ait pas à être renommée. */
        livrees: [
          { id: '', nom: 'Bandes tricolores · 25', en: 'Tricolour stripes · 25' },
          { id: 'castrol', nom: 'Noir, vert et rouge · 2', en: 'Black, green and red · 2' },
          { id: 'calder', nom: 'Calder' },
        ] },
      // Les trois GT des années soixante et soixante-dix. Moteur avant, pneus étroits, peu d'appui :
      // elles se battent avec leur pointe et leur légèreté là où les autres ont de la gomme.
      { id: '250gto', diff: 2, name: 'Purosangue Gran Corsa', shape: 'roundGT', mul: { vmax: 0.766, accel: 0.97, brake: 0.95, grip: 1.02, df: 0.5, slide: 0.95 },
        colors: ['#c8161d', '#f4f4f4'], top: 'sprites/top/250gto.png', pick: 'sprites/pick/250gto.png',
        livrees: [{ id: '', nom: 'Rosso Corsa · 19' }, { id: 'francorchamps', nom: 'Francorchamps · jaune', en: 'Francorchamps · yellow' }, { id: 'walker', nom: 'Rob Walker · inspiration bleue', en: 'Rob Walker · blue tribute' }],
        engine: { cyl: 12, redline: 7500, idle: 900, rough: 0.05, bright: 0.85, turbo: 0 } },
      { id: 'typee', diff: 2, name: 'Moggy Longnose', shape: 'roundGT', mul: { vmax: 0.734, accel: 0.95, brake: 0.93, grip: 1.051, df: 0.45, slide: 1 },
        colors: ['#1d5c3a', '#f4f4f4'], top: 'sprites/top/typee.png', pick: 'sprites/pick/typee.png',
        livrees: [{ id: '', nom: 'Lightweight · British Racing Green' }, { id: 'cunningham', nom: 'Cunningham · blanc et bleu', en: 'Cunningham · white and blue' }, { id: 'ecosse', nom: 'Écurie Écosse · inspiration bleue', en: 'Écurie Écosse · blue tribute' }],
        engine: { cyl: 6, redline: 6500, idle: 850, rough: 0.12, bright: 0.6, turbo: 0 } },
      { id: '240z', diff: 3, name: 'Kitsune Zeta 240', shape: 'roundGT', mul: { vmax: 0.682, accel: 1.02, brake: 1.05, grip: 1.036, df: 0.7, slide: 1.05 },
        colors: ['#f4f4f4', '#d12a2a'], top: 'sprites/top/240z.png', pick: 'sprites/pick/240z.png',
        livrees: [{ id: '', nom: 'BRE · 46' }, { id: 'sharp', nom: 'Bob Sharp · inspiration bleue', en: 'Bob Sharp · blue tribute' }, { id: 'dunlop', nom: 'Hommage jaune · 24', en: 'Yellow tribute · 24' }],
        engine: { cyl: 6, redline: 7500, idle: 950, rough: 0.12, bright: 0.66, turbo: 0 } },
    ],
  },
  {
    id: 'proto', name: { fr: 'Proto', en: 'Prototypes' },
    desc: { fr: 'Les voitures du Mans : les plus rapides en ligne droite, et l\'appui pour le payer en virage.', en: 'Le Mans cars: the fastest in a straight line, with the downforce to pay for it in the corners.' },
    engine: { cyl: 8, redline: 7500, idle: 1000, rough: 0.3, bright: 0.65, turbo: 0 },
    base: { vmax: 386 / 3.6, accel: 8.6, brake: 17.8, grip: 13.6, df: 0.0034, slide: 0.6, laneK: 6, rearBias: 1.06, cliff: 0.18, slipPeak: 0.12, length: 4.5, width: 2.0 },
    drivers: 10, roadScale: 0.9, zoom: 1.15,
    models: [
      { id: 'gt40', diff: 3, name: 'Redneck Endurance 40', shape: 'gt40', mul: { vmax: 0.876, accel: 1.07, brake: 0.97, grip: 1.101, df: 0.7, slide: 1.1 }, pick: 'sprites/pick/gt40.png', engine: {
        cyl: 8, redline: 6200, idle: 800, rough: 0.6, bright: 0.45, turbo: 0,
        // Trois prises, et le moteur choisit. La montée ne porte que 4611 tr/min au rupteur — un
        // tirage entre deux rapports, tout ce qu'un onboard de course contient souvent — mais elle
        // n'a plus à couvrir seule : le plein régime et le pied levé ont leur propre matière, qui
        // n'a pas besoin d'axe des régimes puisqu'on ne la parcourt pas.
        sample: {
          ramp: 'sounds/engine/v8-gt40.json',
          haut: 'sounds/engine/v8-gt40-haut.json',
          bas: 'sounds/engine/v8-gt40-bas.json',
        },
      }, colors: ['#c9a348', '#202321'], top: 'sprites/top/gt40.png' },
      /* La 935 prend la place de la 917 K, et elle prend AUSSI son identifiant — non.

      Elle en prend un neuf, `935`, et c'est délibéré. L'identifiant est la clé sous laquelle sont
      rangés les records, locaux comme mondiaux, et les planchers du serveur. Le garder aurait fait
      hériter la 935 des temps signés avec un prototype douze cylindres : des records qu'elle n'a
      pas faits, sur une voiture qui n'existe plus. Les anciennes lignes `917k` restent dans la
      sauvegarde sans plus s'afficher — rien n'est effacé, rien n'est attribué à tort.

      Ce qu'elle est : une silhouette du Groupe 5, bâtie sur la 930 d'à côté et poussée beaucoup
      plus loin. Flat-6 turbo, donc la même famille sonore que la 930 et pas celle d'un douze
      cylindres atmosphérique. Très vite en ligne droite, moins collée qu'un prototype, et une
      tendance à mettre la queue dehors qui est sa signature — d'où `slide` au-dessus de tout le
      reste du plateau. Le rang de difficulté n'est pas choisi ici : il est MESURÉ par
      `tools/plateau-banc.js --sim`, qui le recalcule pour tout le plateau à la fois. */
      { id: '935', diff: 4, name: 'Breithüft Langheck', shape: 'longTail', mul: { vmax: 0.948, accel: 1, brake: 0.95, grip: 1.083, df: 0.9, slide: 1.35 }, pick: 'sprites/pick/935.png', engine: {
        cyl: 6, redline: 8000, idle: 1100, rough: 0.35, bright: 0.7, turbo: 0.9,
      }, colors: ['#f4f4f4', '#e0262c'], top: 'sprites/top/935.png' },
      // Un moteur rotatif n'a pas de cylindres : `cyl` ne sert qu'à placer l'allumage, et un
      // quatre-rotors allume quatre fois par tour d'arbre excentrique, exactement comme un V8 à
      // quatre temps. D'où huit, avec la rugosité d'un moteur parfaitement équilibré et un
      // rupteur très haut : c'est le cri de la 787B.
      { id: '787b', diff: 1, name: 'Kaminari Hayate', shape: 'groupC', mul: { vmax: 0.907, accel: 1.04, brake: 1.05, grip: 0.939, df: 1.25, slide: 0.92 }, colors: ['#ff8c1a', '#1f6b3a'], top: 'sprites/top/787b.png', pick: 'sprites/pick/787b.png', engine: {
        cyl: 8, redline: 9000, idle: 1300, rough: 0.04, bright: 1.0, turbo: 0,
        // La montée tient de 6159 tr/min au rupteur, le pied levé a sa propre prise, et le
        // démarreur est joué une fois quand la course s'ouvre — d'un bout à l'autre, pas en grains :
        // un démarrage est un évènement, pas une matière.
        sample: {
          ramp: 'sounds/engine/r26b-787b.json',
          bas: 'sounds/engine/r26b-787b-bas.json',
          start: 'sounds/engine/r26b-787b-start.json',
        },
      } },
      { id: '962', diff: 1, name: 'Breithüft Aero 62', shape: 'groupC', mul: { vmax: 0.907, accel: 1, brake: 1.02, grip: 0.981, df: 1.15, slide: 0.95 },
        colors: ['#f4f4f4', '#1b3f8f'], top: 'sprites/top/962.png', pick: 'sprites/pick/962.png',
        livrees: [{ id: '', nom: 'Bleu, blanc et rouge · 17', en: 'Blue, white and red · 17' }, { id: 'shell', nom: 'Jaune et rouge · 7', en: 'Yellow and red · 7' }, { id: 'jager', nom: 'Orange · 17' }],
        engine: { cyl: 6, redline: 8200, idle: 1100, rough: 0.3, bright: 0.7, turbo: 0.95,
          sample: { ramp: 'sounds/engine/flat6-930.json', bas: 'sounds/engine/flat6-930-bas.json' } } },
      { id: 'xjr9', diff: 1, name: 'Moggy Nightfall', shape: 'groupC', mul: { vmax: 1, accel: 0.96, brake: 0.96, grip: 1, df: 1.1, slide: 0.95 },
        colors: ['#5b2a86', '#f4f4f4'], top: 'sprites/top/xjr9.png', pick: 'sprites/pick/xjr9.png',
        livrees: [{ id: '', nom: 'Violet et blanc · 2', en: 'Purple and white · 2' }, { id: 'castrol', nom: 'Vert et blanc · 60', en: 'Green and white · 60' }, { id: 'jps', nom: 'Hommage noir et or · 9', en: 'Black and gold tribute · 9' }],
        engine: { cyl: 12, redline: 7200, idle: 900, rough: 0.05, bright: 0.75, turbo: 0, sample: { ramp: 'sounds/engine/v12-countach.json' } } },
      { id: '330p4', diff: 3, name: 'Purosangue Freccia', shape: 'gt40', mul: { vmax: 0.829, accel: 1.05, brake: 1.04, grip: 1.094, df: 0.6, slide: 1.05 },
        colors: ['#d0141b', '#f4f4f4'], top: 'sprites/top/330p4.png', pick: 'sprites/pick/330p4.png',
        livrees: [{ id: '', nom: 'Daytona 1967 · 23' }, { id: 'giallo', nom: 'Équipe Nationale Belge · jaune', en: 'Équipe Nationale Belge · yellow' }, { id: 'piper', nom: 'David Piper · vert', en: 'David Piper · green' }],
        engine: { cyl: 12, redline: 8500, idle: 1000, rough: 0.05, bright: 0.9, turbo: 0, sample: { ramp: 'sounds/engine/v12-countach.json' } } },
      { id: 'p68', diff: 3, name: 'Redneck Arrow 68', shape: 'longTail', mul: { vmax: 0.904, accel: 0.99, brake: 0.97, grip: 1.142, df: 0.55, slide: 1.2 },
        colors: ['#c62026', '#d9b45a'], top: 'sprites/top/p68.png', pick: 'sprites/pick/p68.png',
        livrees: [{ id: '', nom: 'Alan Mann Racing · 1968' }, { id: 'gulf', nom: 'Bleu ciel et orange · 7', en: 'Sky blue and orange · 7' }, { id: 'dunlop', nom: 'Hommage jaune · 68', en: 'Yellow tribute · 68' }],
        engine: { cyl: 8, redline: 9500, idle: 1300, rough: 0.12, bright: 0.88, turbo: 0 } },
    ],
  },
];

const LIVERIES = [
  { name: 'Rosso', body: '#e0262c', accent: '#ffffff' },
  { name: 'Azure', body: '#2166d8', accent: '#ffd400' },
  { name: 'Lime', body: '#7ed321', accent: '#1b1b1b' },
  { name: 'Sunset', body: '#ff8c1a', accent: '#1b1b1b' },
  { name: 'Silver', body: '#c9ced6', accent: '#e0262c' },
  { name: 'Night', body: '#22242b', accent: '#ffd400' },
  { name: 'Violet', body: '#8a3ffc', accent: '#ffffff' },
  { name: 'Teal', body: '#12b5a8', accent: '#ffffff' },
  { name: 'Gold', body: '#e6b422', accent: '#22242b' },
  { name: 'Pink', body: '#ff4fa3', accent: '#ffffff' },
  { name: 'Racing Green', body: '#1f6b3a', accent: '#ffd400' },
  { name: 'White', body: '#f4f4f4', accent: '#2166d8' },
];

// Livrées historiques illustrées ; voir docs/livrees-historiques/README.md.
const HISTORIC_LIVERIES = {
  countach: [{ id: 'rainx', nom: 'Jaune · 88', en: 'Yellow · 88' }, { id: 'monaco83', nom: 'ludes, babe', en: 'ludes, babe' }],
  gt40: [{ id: 'lemans1', nom: 'Le Mans 1966 · 1' }, { id: 'lemans2', nom: 'Le Mans 1966 · 2' }],
  '935': [{ id: 'jager', nom: 'Orange · 16' }, { id: 'vaillant', nom: 'Kremer · turquoise · 51' }],
  corvette: [{ id: 'spirit76', nom: 'Spirit of Le Mans · 76' }, { id: 'bfg49', nom: 'Étoiles et bandes · 49', en: 'Stars and stripes · 49' }],
  '787b': [{ id: 'efini18', nom: 'Blanc et vert · 18', en: 'White and green · 18' }, { id: 'lemans18', nom: 'Le Mans 1991 · 18' }],
};
for (const category of CATEGORIES) {
  for (const model of category.models) {
    if (HISTORIC_LIVERIES[model.id]) {
      model.livrees = [{ id: '', nom: model.id === 'gt40' ? 'Holman Moody · 1966 · 5' : model.name }, ...HISTORIC_LIVERIES[model.id]];
    }
  }
}

const AI_NAMES = [
  'L. Moreau', 'K. Tanaka', 'M. Rossi', 'A. Silva', 'J. Becker', 'S. Novak', 'D. Okafor', 'E. Lindqvist',
  'R. Castillo', 'T. Nguyen', 'P. Dubois', 'H. Weber', 'N. Petrov', 'C. Ferreira', 'B. Andersen', 'Y. Sato',
  'F. Marchetti', 'G. Larsen', 'I. Kovács', 'O. Haddad',
];

/* Le chemin d'une variante, déduit de celui de la livrée d'origine.

   `sprites/top/csl.png` + `castrol` → `sprites/top/csl_castrol.png`. Déduire plutôt qu'écrire les
   six chemins à la main tient le fichier lisible et rend l'ajout d'une livrée à une ligne — mais
   surtout, ça empêche la vignette et la vue de dessus de désigner deux livrées différentes, ce qui
   ne se verrait qu'en comparant le menu et la piste.

   Le séparateur est le tiret bas parce que c'est celui des fichiers livrés. Un détail, jusqu'au
   moment où il ne l'est pas : le jeu demanderait `csl-castrol.png`, le serveur rendrait 404, et le
   repli afficherait sagement la livrée d'origine — un choix qui ne change rien, sans un mot
   d'erreur nulle part. */
function cheminLivree(src, suffixe) {
  if (!src || !suffixe) return src || null;
  const i = src.lastIndexOf('.');
  return i < 0 ? `${src}_${suffixe}` : `${src.slice(0, i)}_${suffixe}${src.slice(i)}`;
}

// Les PNG remplacés gardent leur nom ; la version évite d'afficher l'ancienne largeur en cache.
function carArtUrl(src) {
  if(!src || !src.startsWith('sprites/') || typeof APP_VERSION === 'undefined')return src;
  return src+(src.includes('?')?'&':'?')+'v='+encodeURIComponent(APP_VERSION);
}

/* Le nom d'une livrée dans la langue du joueur.

`nom` est le nom français ; `en` sa traduction, quand la livrée se décrit (« Noir et or · Andretti ·
1978 » → « Black and gold · Andretti · 1978 »). Un nom propre — un pilote, une équipe, une course,
le nom de la voiture — se dit de la même façon dans les deux langues et n'a pas d'`en`. */
function nomLivree(lv, lang) { return (lang === 'en' && lv && lv.en) || (lv && lv.nom) || ''; }

/** La livrée `i` d'un modèle, l'indice tournant sur la liste. Toujours une livrée, jamais `null`. */
function livreeDe(model, i) {
  const l = model && model.livrees && model.livrees.length ? model.livrees : null;
  if (!l) return { id: '', nom: (model && model.name) || '', top: (model && model.top) || null, pick: (model && model.pick) || null };
  const n = l.length;
  return l[((Math.round(i) || 0) % n + n) % n];
}

// La prise jouée par toute voiture qui n'en a pas à elle. Voir `resolveModel`.
const MOTEUR_DEFAUT = 'sounds/engine/six-inline.json';

// Resolved models: category stats × model multipliers.
const MODELS = [];
// Cartoon racing bodies have no fixed front tires. Their steering tires are drawn
// beneath the body in carart.js; the P34 has two front axles, both steering.
// This affects illustration only, never dimensions, handling or collision boxes.
const CARTOON_MODELS = new Set([
  'tyrrellp34', 'ferrari312t', 'mclarenm23', 'lotus79', 'lotus72',
  'brabhambt46b', 'williamsfw07', 'ligierjs11', 'renaultrs10',
  'm1procar', 'f40', 'countach', '930', 'corvette', 'csl', '250gto', 'typee', '240z',
  'gt40', '935', '787b', '962', 'xjr9', '330p4', 'p68'
]);
function frontWheelLayout(m, cat) {
  if (!CARTOON_MODELS.has(m.id)) return null;
  if (m.id === 'tyrrellp34') return {axles:[0.20,0.30], y:0.30, length:0.085, width:0.18, aboveBody:true};
  if (cat.id === 'f1') return {axles:[0.30], y:0.32, length:0.15, width:0.23, aboveBody:true};
  // GT40 tires sit inside the closed front fenders, including at full steering lock.
  if (m.id === 'gt40') return {axles:[0.27], y:0.30, length:0.12, width:0.12};
  // Narrow M1 front fenders cover the tires; only the outer edge emerges.
  if (m.id === 'm1procar') return {axles:[0.28], y:0.41, length:0.15, width:0.16};
  // Closed fenders: a small tread edge, not the generic wide exposed wheels.
  const covered = { f40:0.375, countach:0.40, '250gto':0.375, xjr9:0.37, '935':0.36 };
  if (covered[m.id] != null) return {axles:[0.25], y:covered[m.id], length:0.13, width:0.14};
  return {axles:[0.25], y:0.42, length:0.15, width:0.18};
}
function resolveModel(cat, m) {
  const b = cat.base, mul = m.mul || {};
  const model = {
    id: m.id, catId: cat.id, name: m.name, shape: m.shape, diff: m.diff == null ? 2 : m.diff, colors: m.colors, custom: !!m.custom, sprite: m.sprite || null, top: m.top || null,
    vmax: b.vmax * (mul.vmax || 1), accel: b.accel * (mul.accel || 1), brake: b.brake * (mul.brake || 1),
    grip: b.grip * (mul.grip || 1), df: b.df * (mul.df || 1), slide: b.slide * (mul.slide || 1), laneK: b.laneK,
    // handling balance: a model's `slide` multiplier above 1 makes it more tail-happy
    rearBias: (b.rearBias || 1.04) / Math.pow(mul.slide || 1, 0.5), cliff: b.cliff == null ? 0.25 : b.cliff, slipPeak: (b.slipPeak || 0.1) * Math.pow(mul.slide || 1, 0.5),
    length: m.length || b.length, width: m.width || b.width,
    // Courbe de poussée optionnelle : caractère moteur propre au modèle, sans état de turbo caché.
    driveCurve: m.driveCurve || null,
    drivers: cat.drivers, roadScale: cat.roadScale, zoom: cat.zoom,
    // le moteur : celui de la catégorie, que la voiture peut reprendre champ par champ
    pick: m.pick || null,
    frontWheels: frontWheelLayout(m, cat),
    rearWheels: ['typee','962'].includes(m.id) ? {axles:[-0.28], y:0.455, length:0.14, width:0.12} : null,
    engine: Object.assign({ cyl: 8, redline: 7000, idle: 1000, rough: 0.3, bright: 0.6, turbo: 0 }, cat.engine || {}, m.engine || {}),
  };
  /* Les livrées : au moins une, toujours, et la première est le dessin d'origine.

  Un modèle qui n'en déclare pas en reçoit une seule, bâtie sur ses propres fichiers. Tout le reste
  du jeu lit donc la même liste, qu'un modèle ait trois livrées ou une : il n'y a pas de cas
  particulier « ce modèle n'a pas de variantes » à écrire quelque part, et c'est précisément le
  genre de cas particulier qu'on oublie dans une des cinq fonctions qui dessinent une voiture. */
  model.livrees = (m.livrees && m.livrees.length ? m.livrees : [{ id: '', nom: m.name }]).map((lv) => ({
    id: lv.id || '',
    nom: lv.nom || m.name,
    en: lv.en || null,
    top: lv.top || cheminLivree(m.top, lv.id),
    pick: lv.pick || cheminLivree(m.pick, lv.id),
  }));

  /* Une voiture sans prise à elle joue quand même un vrai moteur.

  La synthèse donne la bonne hauteur mais pas la bonne matière, et l'écart s'entend d'autant plus que
  les voisines de grille, elles, roulent sur des enregistrements. Faute de prise propre, la M1 fait
  donc le fond de plateau : un six en ligne mécanique et sec, qui monte à 9000 tr/min, et dont la
  rampe est la plus large qu'on ait — dix-sept demi-tons, de 3423 tr/min au rupteur.

  Ce n'est pas un pis-aller sans conséquence : le lecteur ramène l'échelle de la rampe au rupteur de
  la voiture qui la joue, si bien qu'une CSL qui coupe à 7000 entend bien son propre rupteur et non
  les trois quarts de celui de la M1. Ce qui reste emprunté est le timbre, pas le comportement — la
  boîte, la charge, le turbo et le ralenti restent ceux de la voiture.

  Cela vaut aussi pour les voitures de l'atelier, qui passent par ce même chemin. */
  if (!model.engine.sample) model.engine = Object.assign({}, model.engine, { sample: { ramp: MOTEUR_DEFAUT } });

  // Les chiffres du menu, calculés ici pour que les voitures de l'atelier en aient aussi :
  // `registerModel` passe par ce même chemin. (`perfOf` est déclarée plus bas, donc hissée.)
  model.perf = perfOf(model);
  return model;
}
for (const cat of CATEGORIES) for (const m of cat.models) MODELS.push(resolveModel(cat, m));

// Transition de poussée continue, partagée par la physique et les profils de référence.
function driveFactor(c, speed) {
  const q=c.driveCurve;
  if(!q)return 1;
  const t=Math.max(0,Math.min(1,(speed-q.from)/(q.to-q.from)));
  return q.low+(q.high-q.low)*t*t*(3-2*t);
}
// Les quatre chiffres du menu de sélection. Aucun n'est une note inventée : chacun est obtenu en
// appliquant au modèle la loi que le jeu applique vraiment en course, si bien qu'une retouche des
// `mul` se lit aussitôt sur les jauges — il n'y a pas de second jeu de valeurs à tenir à jour.
function perfOf(c) {
  // 0 à 100 km/h. La poussée retombe avec la vitesse — a(v) = accel · (1 − (v/vmax)^2.5), la
  // formule de `car.js` — donc pas de forme close : on intègre, comme le jeu le fait au pas.
  let v = 0, t = 0;
  const dt = 0.002;
  while (v < 27.78 && t < 30) { v += c.accel * driveFactor(c,v) * Math.max(0, 1 - Math.pow(v / c.vmax, 2.5)) * dt; t += dt; }
  return {
    a100: t,                                     // secondes
    vmax: c.vmax * 3.6,                          // km/h
    // Freinage à fond en ligne droite : `car.js` décélère de 1,5 + brake, constant, d'où v²/2a.
    b100: 27.78 * 27.78 / (2 * (1.5 + c.brake)), // mètres de 100 km/h à l'arrêt
    // L'adhérence latérale disponible à 50 m/s, appui aérodynamique compris : c'est la vitesse à
    // laquelle les virages se jouent, et une voiture à gros appui mérite d'y être jugée.
    gripG: (c.grip + c.df * 2500) / 9.81,        // g
  };
}

/* Ce qu'une voiture coûte à piloter, de zéro à cinq pneus.

Le rang est mesuré, pas décidé, par `node tools/plateau-banc.js --sim` : la dérive que la voiture
atteint en roulant proprement, et l'écart entre son tour idéal et ce que l'autopilote en tire. Deux
mesures qui ne disent pas la même chose, chacune ramenée à sa place dans le plateau, parce que ce
qui intéresse le joueur est le rang relatif et non une note absolue.

L'échelle couvre les TROIS catégories à la fois : une F1 à trois pneus est aussi exigeante qu'une
GT à trois, y compris dans le rail « Toutes » qui les mélange. Les F1 à effet de sol sont les plus
dociles, collées par leur appui ; la Corvette et la 911 restent les plus exigeantes, par leur
dérive, sept degrés au 95e centile là où les F1 à effet de sol tiennent sous quatre.

Une voiture d'atelier, dont on ne sait rien, vaut deux pneus : le milieu, faute de mieux. */

/* Repère de présentation pour la caméra et le guide de freinage, pas limite physique.
Le premier banc sur sept circuits atteignait 291 km/h à Monza ; le contrôle indépendant atteint
328,6 km/h au Castellet avec la XJR-9. On conserve ici le repère choisi de 290 km/h : la caméra
atteint ainsi son recul maximal avant la pointe théorique et les GT plus lentes gardent leur
propre référence. Voir docs/avis-parametres-astra/README.md. */
const VMAX_ECRAN = 290 / 3.6;
function vitesseEcran(cls) { return Math.min(cls.vmax, VMAX_ECRAN); }

// Les bornes des cadrans, absolues et non calées sur le plateau. Un arc plein dirait « le maximum
// possible », ce qu'aucune voiture n'a à afficher : il reste toujours mieux à faire, et une voiture
// à venir doit pouvoir se placer au-dessus sans qu'on retouche l'échelle. Le premier chiffre est
// l'arc vide, le second l'arc plein — pour un temps et une distance ils sont donc décroissants,
// puisque plus court vaut mieux, ce qui évite d'avoir à dire ailleurs dans quel sens lire.
//
// Aucune borne basse n'est zéro : une voiture de ce plateau ne roule pas à 40 km/h et ne tient pas
// 0,2 g, si bien que ce bas d'arc n'aurait servi qu'à écraser les écarts. Elles valent toutes ce
// que tient une bonne routière — 5 s, 150 km/h, 30 m, 1 g — ce qui donne en prime des cadrans
// remplis au même niveau : sans cela une même voiture paraît excellente sur un cadran et médiocre
// sur un autre, alors que c'est le choix des bornes qui parle et non la voiture.
const PERF_RANGE = {
  a100: [5, 2.5],     // secondes de 0 à 100 km/h : 5 s une routière rapide, 2,5 s hors d'atteinte
  vmax: [150, 400],   // km/h — les vraies pointes vont jusqu'à 386 (XJR-9 aux Hunaudières)
  b100: [30, 12],     // mètres de 100 km/h à l'arrêt : 30 m une routière, 12 m hors d'atteinte
  gripG: [1, 2.6],    // g en virage : 1 g ce que tient une bonne routière, 2,6 g hors d'atteinte
};
const PERF_KEYS = ['a100', 'vmax', 'b100', 'gripG'];
function perfFill(v, key) {
  const [lo, hi] = PERF_RANGE[key];
  return Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
}

/* Les trois catégories sont jouables. `DEFAUT_CAT` est celle d'un joueur qui n'a encore rien
choisi, et le repli de tout identifiant inconnu — une sauvegarde d'une version future, un lien
tapé à la main. */
const DEFAUT_CAT = 'gt';

function playableCategories() { return CATEGORIES; }
function categoryById(id) { return CATEGORIES.find(c => c.id === id) || CATEGORIES.find(c => c.id === DEFAUT_CAT); }
/* La catégorie d'une voiture, ou la catégorie par défaut pour une voiture inconnue. C'est la voiture
qui décide de la catégorie, jamais l'inverse : on court contre les voitures de sa propre catégorie. */
function categoryOfModel(id) { const m = modelById(id); return categoryById(m ? m.catId : DEFAUT_CAT); }
function modelsOf(catId) { return MODELS.filter(m => m.catId === catId); }
function allModelsOf(catId) { return MODELS.filter(m => m.catId === catId); }
function modelById(id) { return MODELS.find(m => m.id === id) || null; }
// accepts a model id or a category id (first model)
function carClassById(id) { return modelById(id) || modelsOf(categoryById(id).id)[0]; }
// custom (workshop) models are registered at runtime
function registerModel(def) {
  const cat = categoryById(def.catId);
  const idx = MODELS.findIndex(m => m.id === def.id);
  const model = resolveModel(cat, { ...def, custom: true });
  if (idx >= 0) MODELS[idx] = model; else MODELS.push(model);
  return model;
}
function unregisterModel(id) { const i = MODELS.findIndex(m => m.id === id); if (i >= 0) MODELS.splice(i, 1); }

if (typeof module !== 'undefined') module.exports = { CATEGORIES, MODELS, LIVERIES, livreeDe, AI_NAMES, DEFAUT_CAT, categoryOfModel, VMAX_ECRAN, vitesseEcran, driveFactor, perfOf, perfFill, PERF_RANGE, PERF_KEYS, playableCategories, categoryById, modelsOf, allModelsOf, modelById, carClassById, registerModel };
