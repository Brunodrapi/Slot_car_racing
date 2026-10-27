// Track definitions. Shapes are hand-traced approximations of real circuits.
// Coordinates are in arbitrary units (y grows downwards, as on a canvas);
// each track is rescaled so that its total length matches `length` (game metres).
// Race direction follows the point order. pts[0] must lie on the start/finish straight.
'use strict';

/* La couleur des vibreurs, par circuit.

Elle appartient au circuit, pas au décor : un thème donne l'humeur d'un paysage, et plusieurs
circuits le partagent — Spa et le Nürburgring sont tous deux en forêt et n'ont rien à voir.

Ce ne sont pas les couleurs du vrai vibreur, qui est rouge et blanc à peu près partout : c'est un jeu
d'arcade sur de vrais circuits, pas une simulation, et un vibreur aux couleurs du pays se lit d'un
coup d'œil et dit où l'on court. `js/render.js` fait le tour de la liste, bloc après bloc : deux
couleurs pour un vibreur classique, trois pour le vert-blanc-rouge de Monza.

EN PASTEL, et obtenu en éclaircissant chaque couleur du drapeau vers le blanc d'un même taux — 52 %,
et 45 % pour le noir, qui doit rester la plus foncée des trois. Une première version posait toutes les
teintes à la même clarté et à la même saturation, ce qui est la façon habituelle de faire un pastel :
le blanc du drapeau en ressortait beige, et le jaune belge ne se distinguait plus de lui. Éclaircir à
taux constant garde les écarts entre couleurs ; le plus serré des douze drapeaux, le brésilien, laisse
encore 0,21 de distance RVB entre ses deux teintes les plus proches.

Le Royaume-Uni et la France ont le même drapeau à trois couleurs ; l'ordre les distingue à l'œil.
L'Australie prend le vert et l'or de ses couleurs sportives, son drapeau étant lui aussi bleu, blanc
et rouge. */
const DRAPEAUX = {
  it: ['#93c7a9', '#f9f8f5', '#e59f9a'],            // Italie
  be: ['#838285', '#f8e391', '#e59f9a'],            // Belgique
  mc: ['#e59f9a', '#f9f8f5'],                       // Monaco
  gb: ['#e59f9a', '#f9f8f5', '#9ba9cf'],            // Royaume-Uni
  jp: ['#f9f8f5', '#e59f9a'],                       // Japon
  br: ['#93c7a9', '#f4df9d', '#9bb4d9'],            // Brésil
  us: ['#e59f9a', '#f9f8f5', '#9ba9cf'],            // États-Unis
  de: ['#838285', '#e59f9a', '#f4df9d'],            // Allemagne
  fr: ['#9ba9cf', '#f9f8f5', '#e59f9a'],            // France
  au: ['#93c7a9', '#f4df9d'],                       // Australie, couleurs sportives
  at: ['#e59f9a', '#f9f8f5'],                       // Autriche
  nl: ['#f0bf93', '#f9f8f5', '#9ba9cf'],            // Pays-Bas, orange en tête
};

const TRACKS = [
  {
    id: 'monza', name: 'Parco Reale', country: 'IT', flag: '🇮🇹', theme: 'park',
    architecture: 'pavillons',
    // Trait noir de la reprise : la voie des stands quitte la piste à la sortie de la Parabolica,
    // et non plus au milieu du virage. Zone d'arrêt et sortie inchangées.
    pitFrom: 0.95, pitTo: 0.0352, pitAt: 0.9766,
    // Profil visuel issu de docs/skill_circuit : aucune donnée de conduite modifiée.
    graphics: { profile: 'circuit', roadOutlineWidth: 0.35, kerbBlock: 1,
      kerb: ['#448C58', '#F1F0E8', '#C9282E'], kerbOutlineWidth: 0.12,
      proceduralPit: true, paintedRunoff: false,
      runoffColors: ['#448C58','#F1F0E8'],
      grid: { rows: 6, offset: 12, pitch: 8 },
      wearZones: [0.1769,0.3797,0.4424,0.5055,0.6921,0.8966].map(at=>({at,approach:85,exit:28})),
    },
    barriers: true,   // protections dessinées et collisions : voir docs/spa-barrieres/README.md
    kerb: DRAPEAUX.it,
    length: 2900, width: 15,
    /* La géométrie vient de `js/traces.js`, qui porte sa propre licence : elle est relevée dans
       OpenStreetMap, et le fichier à part rend la frontière lisible. Voir `LICENCES.md`. La
       longueur, la largeur et le nombre de tours restent des choix du jeu — c'est la FORME du
       circuit qui est juste, pas sa taille. Monza y fait la moitié de ses 5793 m réels : ses
       chicanes s'en trouvent deux fois plus serrées qu'en vrai, et `js/track.js` les rouvre juste
       assez pour que la route ne se replie pas sur elle-même (voir PLI_MAX). */
    pts: TRACES.monza,
    panneaux: [
      [0.1079, 200, 'chicane', -1],
      [0.1424, 100, 'chicane', -1],
      [0.1597, 50, 'chicane', -1],
      [0.1769, 0, 'chicane', -1],
      [0.3107, 200, 'chicane', -1],
      [0.3452, 100, 'chicane', -1],
      [0.3624, 50, 'chicane', -1],
      [0.3797, 0, 'chicane', -1],
      [0.4079, 100, 4, 1],
      [0.4252, 50, 4, 1],
      [0.4424, 0, 4, 1],
      [0.471, 100, 2, 1],
      [0.4883, 50, 2, 1],
      [0.5055, 0, 2, 1],
      [0.6231, 200, 'chicane', -1],
      [0.6576, 100, 'chicane', -1],
      [0.6748, 50, 'chicane', -1],
      [0.6921, 0, 'chicane', -1],
      [0.7248, 0, 4, -1],
      [0.8276, 200, 3, 1],
      [0.8621, 100, 3, 1],
      [0.8793, 50, 3, 1],
      [0.8966, 0, 3, 1],
    ],
    /* Monza relevé sur `art/reprise circuit/monza_2.jpg` : le ruban est percé dans le bois du parc
       royal, et c'est le bois qui fait le circuit. Il tient partout sauf sur la ligne des stands,
       où le paddock et les tribunes ouvrent la seule clairière du tour. Le sable des bacs est celui
       de la carte peinte : Rettifilo, Roggia, les deux Lesmo, Ascari. La Parabolica est bitumée
       depuis 2014, avec le gravier au-delà. */
    /* Les deux cartes fournies sont stylisées, sans légende de matériaux : une zone
       claire ne prouve pas qu'il s'agit de sable. On conserve les bacs extérieurs,
       et on décrit séparément les tabliers bitumés des chicanes et de Parabolica.
       Largeurs simplifiées pour le jeu ; voir docs/surfaces-circuits/README.md. */
    runoffs: [
      // Reprise 0.40 (monza-tour_reprise.png) : contours verts, le Rettifilo devient bitumé des deux côtés.
      { name: 'Variante del Rettifilo — bitume', surface: 'asphalt', side: -1,
        points: [[.1518,0],[.1563,8.1],[.1593,8.1],[.1623,10.6],[.1653,16.8],[.1773,17],[.1803,17],[.1833,16.6],[.1863,15.8],[.1893,15.1],[.1923,14.2],[.1953,13.1],[.1983,12],[.2013,10.3],[.2051,0]] },
      { name: 'Curva Grande', surface: 'gravel', side: 1, from: 0.225, to: 0.325, w: 20 },
      { name: 'Variante della Roggia', surface: 'gravel', side: -1, from: 0.372, to: 0.412, w: 15 },
      { name: 'Roggia, corde', surface: 'gravel', side: 1, from: 0.376, to: 0.400, w: 9 },
      { name: 'Lesmo 1', surface: 'gravel', side: 1, from: 0.434, to: 0.474, w: 17 },
      { name: 'Lesmo 2', surface: 'gravel', side: 1, from: 0.496, to: 0.526, w: 16 },
      // Croix de la reprise : plus de gravier le long de Serraglio, de part et d'autre.
      { name: 'Serraglio — sans bac', surface: 'grass', side: 1, points: [[.54,0],[.66,0]] },
      { name: 'Serraglio — sans bac, intérieur', surface: 'grass', side: -1, points: [[.54,0],[.66,0]] },
      { name: 'Variante Ascari', surface: 'gravel', side: -1, from: 0.675, to: 0.745, w: 16 },
      { name: 'Parabolica', surface: 'gravel', side: 1, from: 0.885, to: 0.975, w: 22 },
      { name: 'Roggia — tablier intérieur au bac', surface: 'asphalt', side:-1, from:.372, to:.412, w:5, keepOuterGravel:true },
      { name: 'Ascari — tablier intérieur au bac', surface: 'asphalt', side:-1, from:.675, to:.745, w:6, keepOuterGravel:true },
      { name: 'Parabolica — bitume avant gravier', surface: 'asphalt', side:1, from:.885, to:.975, w:8, keepOuterGravel:true },
      { name: 'Zone 15', surface: 'asphalt', side: 1, points: [[0.1647,10.26],[0.1693,15.47],[0.2038,14.21],[0.2091,8.94]] },
    ],
    /* LE BOIS EST DANS LA BOUCLE OUEST, et pas ailleurs. La carte le dit sans ambiguïté : la
       masse sombre remplit l'intérieur de Curva Grande jusqu'à Lesmo et borde Serraglio des deux
       côtés, tandis que toute la partie est — ligne des stands, ligne droite d'Ascari,
       Parabolica — est une plaine rase couverte de tribunes bleues. La première version semait du
       bois partout, ce qui effaçait justement ce qui fait Monza : un ruban percé dans un parc,
       avec une clairière à un bout. */
    implantation: [
      { kind: 'stands', side: -1, from: 0.975, to: 0.06, recul: 11, prof: 22, module: 42 },
      { kind: 'tribune', side: 1, from: 0.98, to: 0.06, recul: 10, prof: 17, module: 32 },
      { kind: 'tribune', side: -1, from: 0.075, to: 0.15, recul: 13, prof: 15, module: 30 },
      { kind: 'nu', side: 1, from: 0.74, to: 0.2, prof: 130 },
      { kind: 'nu', side: -1, from: 0.76, to: 0.17, prof: 130 },
      { kind: 'bois', side: -1, from: 0.215, to: 0.37, recul: 12, prof: 80 },
      { kind: 'bois', side: 1, from: 0.33, to: 0.53, recul: 12, prof: 60 },
      { kind: 'bois', side: -1, from: 0.4, to: 0.53, recul: 12, prof: 70 },
      { kind: 'bois', side: 1, from: 0.55, to: 0.665, recul: 11, prof: 55 },
      { kind: 'bois', side: -1, from: 0.529, to: 0.665, recul: 11, prof: 75 },
      { kind: 'bois', side: 1, from: 0.68, to: 0.735, recul: 13, prof: 40, densite: 0.5 },
      { kind: 'tribune', side: -1, from: 0.78, to: 0.86, recul: 13, prof: 16, module: 30 },
      { kind: 'tribune', side: 1, from: 0.9, to: 0.965, recul: 13, prof: 15, module: 30 },
    ],
    /* Les passerelles piétonnes, en fraction de tour. Relevées dans OpenStreetMap elles aussi, par
       `tools/releve.py --passerelles`, qui ne retient que les chemins « bridge=yes » dont le tracé
       CROISE la ligne médiane — deux segments se croisent ou ne se croisent pas, il n'y a pas de
       seuil à régler. Une fraction plutôt qu'une distance : elle survit au rééchantillonnage de
       `js/track.js`, qui ne garde pas le même nombre de stations selon la longueur déclarée. */
    passerelles: [0.6340, 0.7791, 0.8297],
    barrierPaths: [
      { side: -1, from: 0.8934, to: 0.9681, pts: [[522.79,132.23],[532.07,132.23],[540.29,135.08],[543.67,137.4],[546.3,138.98],[548.2,140.45],[549.15,142.04],[550.84,145.2],[552.1,147.94],[552.84,149.94],[553.69,151.63],[553.9,153.85],[554.32,156.69],[554.53,159.33],[553.9,162.39],[553.48,165.66],[553.05,168.19],[552.42,170.82],[551.79,173.14],[550.52,176.2],[549.78,177.99],[549.26,179.15],[547.46,182.21],[545.78,184.32],[544.2,186.53],[543.14,188.22],[542.09,189.49],[540.29,191.28],[538.61,193.28],[536.92,195.18],[535.34,196.66],[529.12,202.25],[525.22,206.04],[521.42,208.15],[513.62,210.58],[505.6,213.21],[499.38,215.11],[492.32,216.59],[488.52,217.75],[481.88,219.01],[477.55,219.96],[471.86,220.91],[467.43,221.65]] },
    ],
    objets: {
      retires: [
        [535.73,255.05],
        [536.25,257.7],
        [536.85,260.16],
        [540.31,253.81],
      ],
      ajouts: [],
    },
  },
  {
    id: 'spa', name: 'Stand de frites', country: 'BE', flag: '🇧🇪', theme: 'forest',
    architecture: 'pavillons',
    // Même langage de matériaux que Monza, adapté à la forêt ardennaise.
    // Les zones de dégagement annotées et tous les repères de gameplay sont conservés.
    graphics: { profile: 'circuit', roadOutlineWidth: 0.35, kerbBlock: 1,
      kerb: ['#C9282E','#F1F0E8'], kerbOutlineWidth: 0.12, proceduralPit: true, paintedRunoff: false,
      runoffColors: ['#E9BE37','#C9282E','#E9BE37','#C9282E'],
      greenAprons: [{from:.1671,to:.2064,side:1},{from:.3486,to:.3835,side:1},
        {from:.9671,to:.992,side:1}],
      entryAprons: [{from:.163,to:.1691,side:-1},{from:.1671,to:.1691,side:1},
        {from:.348,to:.3509,side:-1},{from:.3486,to:.3509,side:1},
        {from:.8871,to:.8891,side:-1},{from:.963,to:.9709,side:-1},
        {from:.9671,to:.9709,side:1}],
      materials: { barrierBlocks: ['#C92F32','#E6E6DF','#28639C'], grass: '#547B46', grassLight: '#638952', grassDark: '#41683B',
        grassDry: '#98965F', canopy: ['#315638', '#416B43', '#294D34'],
        pine: ['#294D3B', '#365E46'], sousBois: '#304F35' },
      grid: { rows: 6, offset: 12, pitch: 8 },
      wearZones: [0.0615,0.1691,0.3509,0.3847,0.4359,0.4762,0.5506,0.6453,0.7118,0.7406,0.9709]
        .map(at=>({at,approach:65,exit:25})),
    },
    barriers: true, // essai : géométrie partagée entre dessin et collisions
    // Contours de spa-tour_reprise.png : fraction du tour, largeur hors route (m).
    // Les secteurs non annotés gardent leur profil existant. Voir docs/spa-barrieres/zones.md.
    // Reprise 0.40 : Eau Rouge, Les Combes (Malmedy compris) et Bus Stop suivent les contours verts.
    /* Voie des stands : les croix rouges et noires suppriment l'ancienne voie du Bus Stop à
       La Source ; le trait noir la pose le long de la descente vers l'Eau Rouge, devant le paddock.
       Le dessin la fait passer derrière La Source, mais l'épingle a un rayon d'environ 8 m : une voie
       parallèle s'y replierait. Elle part donc de la sortie de l'épingle. */
    pitFrom: 0.074, pitTo: 0.113, pitAt: 0.093,
    runoffs: [
      { name: "Les Combes — gauche", surface: 'asphalt', side: 1,
        points: [[.3461,0],[.3506,8.9],[.3536,11.8],[.3566,16.8],[.3596,25],[.3626,25.2],[.3746,25],[.3776,19],[.3806,12.1],[.3836,8.9],[.3866,8.9],[.3896,10.8],[.3926,10.8],[.3956,10.1],[.3986,9.2],[.4016,8.4],[.4054,0]] },
      { name: "Les Combes — droite", surface: 'asphalt', side: -1,
        points: [[.3414,0],[.3459,8.7],[.3489,11.1],[.3519,15.5],[.3609,15.5],[.3639,14],[.3669,13.9],[.3699,12.7],[.3729,9.7],[.3759,7.7],[.3789,7.7],[.3819,7.8],[.3849,10.8],[.3879,12],[.3909,12],[.3939,12],[.3969,10.7],[.3999,8.8],[.4021,0]] },
      { name: "Eau Rouge / Raidillon — gauche", surface: 'asphalt', side: 1,
        points: [[.1552,0],[.1597,10.7],[.1627,10.7],[.1657,10.4],[.1687,10.4],[.1717,10.6],[.1747,13],[.1777,13.6],[.1807,14],[.1837,15.3],[.1867,17],[.1897,18],[.1927,18],[.1957,17.6],[.1987,15.4],[.2017,12.4],[.2047,8.9],[.2077,0]] },
      { name: "Eau Rouge / Raidillon — droite", surface: 'asphalt', side: -1,
        points: [[.1582,0],[.1627,9.6],[.1657,11.8],[.1687,16.4],[.1717,18.2],[.1747,19.8],[.1777,20.7],[.1807,20.7],[.1837,20.6],[.1867,19.5],[.1897,17.4],[.1927,14.3],[.1957,11.3],[.1987,9.4],[.2017,6.9],[.2045,0]] },
      { name: "Blanchimont", surface: 'asphalt', side: -1,
        points: [[0.8871,0],[0.8906,6.3],[0.8929,10.9],[0.895,13.7],[0.9093,17.9],[0.9234,18.5],[0.9329,17.5],[0.9376,15.7],[0.9446,10.4],[0.9515,2.6],[0.955,0]] },
      { name: "Bus Stop — droite", surface: 'asphalt', side: -1,
        points: [[.9585,0],[.963,10.1],[.966,15],[.981,15],[.984,11.6],[.987,11.2],[.99,11.2],[.993,10.8],[.996,10],[.9998,0]] },
      { name: "Bus Stop — gauche", surface: 'asphalt', side: 1,
        points: [[.9658,0],[.9703,10.9],[.9733,12.7],[.9763,12.7],[.9913,12.3],[.9943,8.4],[.9973,8.4],[1.004,4],[1.012,0]] },
      { name: "Pouhon / Double Gauche", surface: 'gravel', side: -1,
        points: [[0.5489,0],[0.5524,5.5],[0.5538,9.0],[0.5562,12.7],[0.5585,13.4],[0.5656,9.9],[0.5776,11.3],[0.5868,14.8],[0.5894,14.7],[0.5941,11.2],[0.5985,5.9],[0.6032,2.4],[0.6067,0]] },
      { name: "La Source", surface: 'gravel', side: 1,
        points: [[0.0591,0],[0.0626,3.8],[0.0647,11.1],[0.0668,11.7],[0.0688,7.6],[0.0759,3.5],[0.0794,0]] },
      { name: "Campus / Paul Frère", surface: 'gravel', side: 1,
        points: [[0.7089,0],[0.7124,3.6],[0.7162,12.0],[0.7185,14.0],[0.7232,11.6],[0.7303,13.3],[0.7421,11.2],[0.7494,12.6],[0.7515,12.1],[0.7541,9.9],[0.7582,3.7],[0.7617,0]] },
      { name: "Suppression avant Eau Rouge", surface: 'grass', side: -1,
        points: [[0.153,0],[0.163,0]] },
    ],
    /* Spa relevé d'en haut : un ruban percé dans la forêt ardennaise.

    Le bois serre la piste partout sauf sur la ligne des stands, qui est la seule clairière du
    tour — paddock, hangars, tribunes. Entre Les Combes et Stavelot la hêtraie descend jusqu'au
    dégagement des deux côtés ; à Blanchimont elle ne tient plus qu'à l'extérieur, l'intérieur de
    la boucle étant occupé par les parkings. */
    implantation: [
      // La ligne des stands s'arrête AVANT La Source : l'épingle est à 0,066, et le paddock n'y
      // entre pas. Les hangars reprennent après, le long de la montée vers Eau Rouge.
      { kind: 'stands', side: -1, from: 0.975, to: 0.035, recul: 10, prof: 22, module: 40 },
      { kind: 'tribune', side: 1, from: 0.985, to: 0.035, recul: 9, prof: 16, module: 30 },
      { kind: 'tribune', side: 1, from: 0.082, to: 0.11, recul: 11, prof: 14, module: 24 },
      { kind: 'hangars', side: -1, from: 0.085, to: 0.14, recul: 16, prof: 26, module: 30 },
      { kind: 'bois', side: -1, from: 0.12, to: 0.175, recul: 8, prof: 55 },
      { kind: 'bois', side: 1, from: 0.09, to: 0.33, recul: 10, prof: 70 },
      { kind: 'bois', side: -1, from: 0.2, to: 0.345, recul: 9, prof: 60 },
      { kind: 'parking', side: -1, from: 0.35, to: 0.385, recul: 12, prof: 26 },
      { kind: 'bois', side: 1, from: 0.345, to: 0.55, recul: 10, prof: 65 },
      { kind: 'bois', side: -1, from: 0.39, to: 0.545, recul: 10, prof: 60 },
      { kind: 'bois', side: -1, from: 0.56, to: 0.705, recul: 11, prof: 70 },
      { kind: 'bois', side: 1, from: 0.6, to: 0.70, recul: 10, prof: 55 },
      { kind: 'bois', side: 1, from: 0.715, to: 0.88, recul: 10, prof: 60 },
      { kind: 'bois', side: -1, from: 0.72, to: 0.885, recul: 11, prof: 70 },
      { kind: 'bois', side: -1, from: 0.89, to: 0.955, recul: 14, prof: 50 },
      { kind: 'parking', side: 1, from: 0.9, to: 0.95, recul: 14, prof: 30 },
      // Camping-cars garés en long derrière la protection, hors des parkings.
      { kind: 'camping', side: 1, from: 0.215, to: 0.33, recul: 2.5 },
      { kind: 'camping', side: -1, from: 0.22, to: 0.33, recul: 2.5 },
    ],
    kerb: DRAPEAUX.be,
    /* Plus de `pitAt` : il valait 0,10 et corrigeait une zone d'arrêt qui tombait dans un virage —
       conséquence d'une ligne de départ posée à Eau Rouge. La ligne est maintenant sur la vraie
       ligne droite des stands, donc le défaut (juste avant la ligne) retombe sur la vraie voie des
       stands. Mesuré par `tools/stands.js` : l'arrêt ne se faisait plus du tout avec l'ancien
       décalage, il se fait de nouveau sans lui. */
    length: 3400, width: 14, puddles: 0.5,
    pts: TRACES.spa,
    panneaux: [
      [0.0026, 200, 'acute', 1],
      [0.0321, 100, 'acute', 1],
      [0.0468, 50, 'acute', 1],
      [0.0615, 0, 'acute', 1],
      [0.1103, 200, 5, 1],
      [0.1397, 100, 5, 1],
      [0.1544, 50, 5, 1],
      [0.1691, 0, 5, 1],
      [0.1903, 0, 4, -1],
      [0.2921, 200, 2, 1],
      [0.3215, 100, 2, 1],
      [0.3362, 50, 2, 1],
      [0.3509, 0, 2, 1],
      [0.37, 50, 2, 1],
      [0.3847, 0, 2, 1],
      [0.4065, 100, 'hairpin', 1],
      [0.4212, 50, 'hairpin', 1],
      [0.4359, 0, 'hairpin', 1],
      [0.4615, 50, 2, -1],
      [0.4762, 0, 2, -1],
      [0.5212, 100, 4, -1],
      [0.5359, 50, 4, -1],
      [0.5506, 0, 4, -1],
      [0.5865, 200, 3, 1],
      [0.6159, 100, 3, 1],
      [0.6306, 50, 3, 1],
      [0.6453, 0, 3, 1],
      [0.6682, 0, 4, -1],
      [0.6971, 50, 2, 1],
      [0.7118, 0, 2, 1],
      [0.7259, 50, 4, 1],
      [0.7406, 0, 4, 1],
      [0.8303, 200, 6, -1],
      [0.8597, 100, 6, -1],
      [0.8744, 50, 6, -1],
      [0.8891, 0, 6, -1],
      [0.9121, 200, 'square', 1],
      [0.9415, 100, 'square', 1],
      [0.9562, 50, 'square', 1],
      [0.9709, 0, 'square', 1],
      [0.9788, 0, 'acute', -1],
    ],
  },
  {
    id: 'monaco', name: 'Le Rocher', country: 'MC', flag: '🇲🇨', theme: 'riviera',
    revision: '2026-10-26T18:09:36Z',   // repris de tracks_11 : les retouches locales d'avant ne comptent plus
    runoffJoinGap: 60,
    defaultRunoff: 'asphalt', // Références monaco.jpg / monaco_2.jpg : aucun bac à gravier.
    architecture: 'immeubles',
    // Port Hercule, relevé sur une vue satellite calée sur le tracé : le bassin, ses jetées, la digue
    // et la mer en un seul contour (mètres du circuit), écarté de la piste et de ses protections.
    // Les bateaux s'amarrent en épi le long des pontons et des quais (props.js, placeAmarrages).
    water: {
      polygone: [
        [4619.8,-4399.8],[396.8,-4399.8],[390.2,-392.8],[387.8,-391.2],[387.2,-388.8],[384.8,-386.8],[382.2,-383.2],[379.2,-382.2],[374.8,-377.8],[373.8,-375.2],
        [366.2,-368.8],[366.2,-367.2],[364.8,-365.8],[364.8,-363.2],[363.2,-361.2],[363.2,-359.2],[360.2,-356.2],[359.2,-354.2],[353.2,-350.8],[350.2,-347.8],
        [349.8,-344.8],[345.2,-341.2],[342.2,-337.2],[342.2,-336.2],[340.2,-334.8],[338.2,-330.8],[334.2,-327.2],[333.2,-324.8],[329.8,-321.8],[329.8,-320.8],
        [328.2,-319.2],[328.2,-317.8],[326.2,-315.8],[326.2,-314.2],[322.2,-311.2],[321.2,-309.8],[320.2,-301.8],[317.8,-298.8],[317.8,-296.8],[316.2,-294.2],
        [313.8,-291.8],[313.8,-290.8],[318.8,-289.8],[325.8,-287.2],[331.8,-280.8],[335.2,-270.8],[333.8,-261.2],[326.8,-248.8],[327.8,-239.8],[324.8,-233.8],
        [320.2,-229.2],[317.8,-228.2],[314.2,-224.2],[312.2,-223.8],[310.8,-222.2],[306.8,-207.8],[302.2,-195.8],[302.2,-193.8],[298.2,-184.8],[298.2,-182.8],
        [291.8,-169.8],[291.8,-168.2],[276.8,-141.2],[275.2,-140.2],[273.2,-136.2],[260.2,-119.2],[259.8,-116.8],[262.2,-114.8],[264.2,-114.2],[268.2,-110.8],
        [267.2,-109.8],[263.2,-112.2],[260.2,-111.2],[257.8,-112.8],[254.8,-111.8],[253.8,-110.2],[251.2,-109.2],[247.8,-104.8],[237.8,-94.8],[229.2,-87.8],
        [229.2,-85.8],[230.2,-84.2],[233.2,-83.8],[235.2,-81.8],[235.8,-79.2],[233.8,-74.2],[227.2,-67.2],[225.8,-63.8],[222.2,-60.8],[215.2,-52.2],
        [209.2,-48.2],[204.8,-46.8],[201.2,-43.2],[198.2,-42.8],[197.8,-41.2],[195.8,-39.8],[194.8,-33.8],[192.8,-32.2],[189.8,-32.8],[188.2,-31.8],
        [187.8,-28.2],[190.2,-25.8],[188.8,-23.2],[188.8,-20.2],[190.2,-17.2],[190.2,-9.8],[191.2,-8.2],[191.8,-2.8],[193.2,-1.2],[193.2,3.2],
        [194.8,5.8],[194.8,11.8],[196.2,15.2],[196.2,20.2],[197.8,24.2],[197.2,27.2],[199.8,30.8],[199.2,33.2],[200.8,36.8],[200.2,40.2],
        [201.2,42.2],[201.2,47.8],[204.2,55.8],[204.2,61.8],[203.2,65.2],[200.2,67.8],[195.8,66.8],[187.8,67.2],[184.8,65.2],[184.8,59.8],
        [183.8,55.8],[184.2,54.2],[183.2,50.8],[183.8,48.2],[182.8,45.2],[183.2,42.8],[182.2,38.8],[182.8,36.8],[181.8,33.8],[182.2,31.2],
        [180.8,19.2],[181.2,16.8],[180.2,13.8],[180.2,7.8],[179.2,2.2],[179.8,-0.2],[178.2,-9.8],[178.8,-11.8],[177.8,-14.8],[177.8,-23.2],
        [176.2,-25.2],[159.8,-24.8],[157.8,-12.8],[156.2,-10.8],[154.8,-12.2],[153.8,-15.2],[153.8,-20.2],[150.2,-21.8],[147.2,-24.8],[143.2,-24.2],
        [143.2,-20.2],[145.2,-16.8],[145.8,-13.8],[144.2,-5.8],[141.2,-4.2],[129.2,-6.2],[128.2,-7.2],[129.8,-9.2],[133.2,-10.2],[132.2,-22.8],
        [131.2,-23.2],[129.8,-22.2],[127.8,-15.8],[126.8,-14.8],[123.8,-17.8],[123.2,-20.8],[122.2,-21.2],[120.8,-20.2],[119.2,-9.8],[118.2,-8.8],
        [112.8,-9.8],[108.8,-9.2],[102.2,-10.8],[101.2,-11.8],[100.8,-17.8],[97.8,-20.8],[95.2,-20.8],[92.8,-19.2],[92.2,-15.2],[90.2,-12.8],
        [83.8,-14.2],[79.8,-13.8],[72.2,-15.2],[70.8,-17.8],[67.2,-18.8],[65.2,-18.2],[63.8,-16.8],[57.8,-18.2],[49.2,-17.2],[49.2,-8.2],
        [48.2,-4.8],[48.2,1.8],[47.2,4.8],[47.8,8.8],[46.8,11.8],[47.2,15.2],[45.8,25.8],[46.2,29.2],[44.2,42.2],[44.2,52.8],
        [43.2,55.8],[43.2,63.2],[48.2,68.2],[49.2,71.2],[47.2,81.8],[45.2,83.8],[38.2,86.8],[25.8,84.8],[19.8,76.2],[19.8,74.2],
        [21.2,72.2],[21.8,67.8],[22.8,66.8],[23.2,64.2],[27.2,59.8],[27.2,49.8],[28.2,46.2],[27.8,42.8],[28.8,39.2],[28.2,35.8],
        [29.2,28.2],[28.8,24.8],[29.8,21.2],[29.2,17.8],[30.2,14.8],[29.8,10.8],[30.8,7.8],[30.2,-0.2],[31.2,-3.2],[30.8,-7.2],
        [31.8,-10.2],[31.8,-17.2],[30.8,-17.8],[24.2,-16.8],[6.8,-11.8],[-6.2,-11.8],[-12.8,-9.2],[-21.2,-8.8],[-27.8,-5.2],[-34.8,-3.2],
        [-52.8,-2.8],[-64.2,-6.8],[-72.8,-13.2],[-85.8,-15.2],[-95.8,-19.8],[-99.8,-20.8],[-159.2,-27.2],[-172.8,-27.8],[-202.2,-31.8],[-205.8,-31.8],
        [-207.8,-30.8],[-214.2,-23.2],[-220.8,-18.2],[-231.8,-0.2],[-236.8,11.8],[-240.2,24.8],[-240.2,35.8],[-239.8,39.2],[-237.8,43.8],[-238.2,48.2],
        [-233.8,50.8],[-228.8,55.8],[-226.2,61.8],[-226.8,71.8],[-227.8,74.2],[-231.2,78.8],[-233.2,102.2],[-231.8,103.2],[-210.8,106.8],[-208.8,108.2],
        [-211.8,126.8],[-213.2,128.8],[-232.2,125.2],[-234.8,125.8],[-234.8,134.2],[-232.2,140.2],[-230.2,149.2],[-230.8,158.2],[-234.8,167.2],[-243.2,176.2],
        [-248.2,179.8],[-248.8,184.8],[-252.8,192.8],[-252.8,194.8],[-249.8,197.2],[-248.8,199.2],[-246.2,212.2],[-241.2,225.8],[-236.8,230.2],[-233.2,236.2],
        [-228.2,241.8],[-225.2,243.8],[-220.8,250.8],[-220.2,254.2],[-211.8,258.8],[-207.2,263.8],[-204.2,270.2],[-203.2,270.8],[-197.8,269.8],[-196.2,270.2],
        [-193.2,269.2],[-190.8,269.8],[-185.2,268.2],[-182.8,268.8],[-179.8,267.8],[-173.2,267.8],[-162.2,265.8],[-150.8,265.8],[-146.8,264.8],[-140.8,265.2],
        [-136.8,264.2],[-125.2,264.2],[-120.8,263.2],[-115.2,263.8],[-111.8,262.8],[-106.2,263.2],[-96.2,261.8],[-91.2,262.2],[-87.2,261.2],[-79.2,261.2],
        [-75.8,260.2],[-73.2,260.8],[-69.2,259.8],[-64.2,260.2],[-60.2,259.2],[-57.8,259.8],[-54.8,258.8],[-46.2,258.8],[-43.2,257.8],[-37.8,258.2],
        [-31.8,256.8],[-26.2,257.2],[-23.2,256.2],[-21.2,256.8],[-11.8,255.2],[-9.2,255.8],[1.2,253.8],[3.8,254.2],[6.8,253.2],[10.8,253.2],
        [13.2,252.2],[17.8,247.8],[21.8,248.8],[22.8,248.2],[23.2,246.2],[21.2,242.8],[26.8,236.2],[26.8,227.8],[25.8,224.2],[26.2,214.2],
        [25.2,210.2],[25.8,200.8],[24.8,196.8],[25.2,186.8],[24.2,179.2],[24.2,162.2],[23.2,154.8],[23.2,144.8],[25.2,143.2],[48.2,143.2],
        [49.2,144.2],[49.8,147.2],[48.8,150.8],[49.2,154.2],[48.2,161.8],[48.8,165.2],[47.8,172.8],[48.2,176.2],[47.2,189.2],[60.2,197.8],
        [61.8,199.2],[62.8,202.8],[65.2,204.8],[67.2,205.2],[70.2,204.2],[80.8,211.2],[82.2,212.8],[79.2,216.8],[79.2,217.8],[81.8,218.8],
        [92.2,218.8],[111.8,231.2],[117.2,227.2],[119.2,224.8],[132.2,214.2],[141.2,205.8],[143.2,204.8],[167.2,183.2],[169.2,182.2],[178.8,173.2],
        [180.2,172.8],[182.2,170.2],[184.2,169.2],[189.8,163.8],[206.2,150.2],[237.8,122.2],[244.8,117.2],[246.8,114.8],[263.8,100.8],[265.2,98.8],
        [267.2,97.8],[268.8,95.8],[270.8,94.8],[280.2,85.8],[283.2,84.8],[284.8,83.2],[286.2,83.2],[287.8,81.2],[292.8,78.2],[298.8,72.2],
        [302.8,72.2],[308.8,77.8],[310.8,81.2],[313.8,82.8],[316.2,85.2],[313.8,91.2],[309.2,95.2],[307.8,97.8],[305.8,98.2],[304.2,100.2],
        [298.8,103.2],[295.2,107.8],[288.8,111.8],[286.2,115.2],[284.2,115.8],[280.8,120.2],[275.8,122.8],[273.8,125.2],[270.8,126.8],[264.8,132.8],
        [262.8,133.2],[254.2,141.2],[251.2,143.2],[249.8,143.2],[246.8,147.2],[245.2,147.8],[239.8,153.2],[236.8,154.8],[232.8,159.2],[227.2,162.8],
        [225.8,164.8],[217.8,169.2],[211.2,177.2],[209.2,177.8],[207.8,179.8],[204.8,180.8],[201.2,184.2],[198.8,185.2],[190.2,193.8],[185.2,196.2],
        [181.2,201.2],[177.8,202.8],[171.2,209.2],[167.8,211.8],[165.8,212.2],[161.2,217.2],[155.8,221.2],[149.2,231.8],[144.8,234.8],[141.8,233.8],
        [135.2,237.2],[133.2,240.8],[128.2,242.8],[128.8,248.8],[130.8,251.2],[130.8,253.8],[127.8,258.2],[121.8,262.8],[120.2,264.8],[118.2,265.2],
        [117.2,266.8],[111.8,270.2],[102.8,278.8],[94.2,284.2],[82.8,295.8],[75.2,301.2],[69.2,307.8],[64.8,309.8],[58.2,317.2],[54.8,319.2],
        [54.2,321.8],[55.2,323.8],[54.2,324.8],[52.2,325.2],[50.8,327.2],[49.8,326.8],[46.2,328.2],[45.2,327.2],[45.8,323.2],[44.8,322.2],
        [41.2,321.8],[39.8,320.8],[36.8,321.8],[34.8,320.2],[28.8,319.2],[27.2,317.8],[27.2,311.2],[25.8,309.8],[24.2,310.2],[21.2,314.2],
        [20.8,319.8],[21.8,320.8],[20.8,322.8],[23.2,323.2],[25.2,322.2],[29.8,325.8],[30.2,327.8],[28.2,330.8],[28.2,335.8],[24.2,339.8],
        [24.8,348.8],[27.2,351.2],[27.8,356.8],[30.8,359.2],[38.2,351.8],[40.8,348.2],[40.8,347.2],[38.8,345.8],[38.8,344.2],[40.8,342.8],
        [40.8,341.2],[43.2,338.8],[43.2,336.8],[44.2,335.8],[48.8,338.8],[47.8,345.8],[42.2,352.8],[41.8,357.8],[39.2,361.8],[39.2,364.2],
        [40.2,365.2],[41.8,370.2],[41.2,372.8],[42.8,375.2],[42.2,379.2],[40.2,382.2],[37.8,381.8],[35.2,382.8],[35.2,383.8],[33.8,385.2],
        [30.8,385.2],[29.2,386.2],[29.2,387.2],[26.2,390.8],[23.2,391.8],[21.2,393.8],[21.2,395.8],[19.8,397.2],[20.2,400.2],[18.2,402.8],
        [15.2,401.8],[12.8,402.8],[12.8,404.8],[11.2,407.8],[5.8,413.8],[4.8,417.8],[3.2,419.2],[1.2,419.8],[0.2,421.2],[0.2,427.8],
        [-0.8,433.2],[-2.2,435.2],[-2.8,438.2],[-4.8,439.8],[-6.2,439.8],[-10.2,441.8],[-10.2,443.2],[-5.2,444.2],[-4.2,445.2],[-6.8,448.2],
        [-9.2,449.2],[-12.8,447.2],[-12.2,445.2],[-14.2,445.2],[-13.8,447.2],[-15.2,449.2],[-15.8,451.8],[-16.8,452.8],[-20.2,453.2],[-20.2,455.8],
        [-22.2,457.2],[-22.2,458.2],[-24.2,460.2],[-25.2,463.2],[-26.8,464.8],[-29.2,463.8],[-31.8,465.8],[-33.2,465.2],[-35.2,466.2],[-35.2,467.8],
        [-36.2,468.8],[-37.8,467.8],[-39.2,468.2],[-43.2,473.8],[-46.8,475.8],[-49.8,476.2],[-53.8,482.8],[-55.8,482.8],[-57.2,481.8],[-63.8,482.2],
        [-65.8,483.8],[-70.8,483.8],[-84.8,4559.8],[4619.8,4559.8],
      ],
      amarrages: [
        { a: [-253.7,-14.9], b: [-263.1,36.4], cote: -1, l: [9,15] },
        { a: [-243.5,-25.2], b: [-220.3,-40.7], cote: 1, l: [11,22] },
        { a: [-189.5,-43.4], b: [-154.6,-39.3], cote: 1, l: [18,32] },
        { a: [-226.2,4.5], b: [-234.4,107.6], l: [8,12], p: 1 },
        { a: [-197.3,12], b: [-205.2,105.3], l: [9,15], p: 1 },
        { a: [-201.3,63.6], b: [-195.3,167.7], cote: -1, l: [22,50], p: 1 },
        { a: [-201.3,63.6], b: [-195.3,167.7], cote: 1, l: [8,12] },
        { a: [-195.3,167.7], b: [-197.6,205.2], l: [9,15], p: 1 },
        { a: [-236.3,122.4], b: [-230.7,212.1], l: [8,12], p: 1 },
        { a: [-207.4,221.6], b: [-203,272.4], l: [8,12], p: 1 },
        { a: [-185.5,218], b: [-181.3,274.1], l: [8,12], p: 1 },
        { a: [-159.8,209.8], b: [-153.9,269.2], l: [9,15], p: 1 },
        { a: [-116.6,168.4], b: [-112.4,261.6], l: [10,19], p: 1 },
        { a: [-79.1,204], b: [-74.9,255.6], l: [9,16], p: 1 },
        { a: [-44.3,221], b: [-43.7,259], l: [9,15], p: 1 },
        { a: [23.8,146.3], b: [25.6,232.2], cote: 1, l: [20,42] },
        { a: [-28.9,-30.1], b: [-36.1,21.7], l: [12,22], p: 1 },
        { a: [31.3,-15.3], b: [23.8,59.1], cote: 1, l: [15,32] },
        { a: [49.2,-9.8], b: [46,57.8], cote: -1, l: [18,42] },
        { a: [22.4,62.6], b: [19,81], cote: 1, l: [35,52] },
        { a: [50.4,58.6], b: [45.4,85.8], cote: -1, l: [30,48] },
        { a: [66.8,-14.9], b: [151.7,-2.5], cote: 1, l: [9,15] },
        { a: [175.3,-15.6], b: [184.6,66.4], cote: 1, l: [18,40] },
      ],
      navires: [
        { x: 85.6, y: 169.2, a: 2.362, l: 70.1 },
        { x: 96.2, y: 194.3, a: 2.452, l: 62.4 },
        { x: 196.4, y: 147.4, a: 2.435, l: 51.9, c: '#2c3a4f' },
      ],
    },
    barriers: true,   // protections dessinées et collisions : voir docs/spa-barrieres/README.md
    kerb: DRAPEAUX.mc,
    length: 2300, width: 11,
    pts: TRACES.monaco,
    /* Reprise 0.40 (monaco-tour_reprise.png) : les contours verts sont des dégagements bitumés,
       et leur trait est aussi la ligne du mur. À l'intérieur de l'épingle avant le tunnel, seul le
       mur est repris : le sol y est déjà la chaussée de la ville. */
    runoffs: [
      { name: 'Casino — extérieur', surface: 'asphalt', side: -1, points: [[0.1856,18.81],[0.1993,16.75],[0.2104,10.54],[0.2138,11.71],[0.2168,13.7],[0.2198,14],[0.2228,14],[0.2258,13.9],[0.2288,13.4],[0.2318,12.1],[0.2348,10.9],[0.2378,9.5],[0.2408,8.1],[0.2438,6.9],[0.2468,6],[0.2498,6],[0.2528,7.4],[0.2558,9.2],[0.2588,10.6],[0.2617,0]] },
      { name: 'Sainte-Dévote et Beau Rivage — extérieur', surface: 'asphalt', side: -1,
        points: [[.0309,0],[.0354,14.6],[.0384,13.8],[.0414,12.7],[.0444,11.1],[.0474,9.6],[.0504,7.6],[.0534,7.1],[.0564,7.1],[.0594,10.3],[.0714,10.3],[.0744,6.7],[.0774,4.6],[.0804,3.4],[.0834,2.6],[.0864,2.3],[.0894,1.9],[.0924,1.9],[.0954,1.9],[.0984,2.1],[.1014,3.1],[.1044,4.1],[.1074,4.8],[.1104,6],[.1134,7.1],[.1178,0]] },
      { name: 'Massenet — extérieur', surface: 'asphalt', side: -1,
        points: [[.1331,0],[.1376,10.8],[.1406,10.8],[.1436,10.6],[.1466,10.1],[.1496,10.1],[.1526,10.1],[.1556,10.9],[.1586,11.8],[.1616,12.9],[.1646,14.3],[.1676,15.6],[.1706,16.9],[.1736,18.2],[.1766,19],[.1808,0]] },
      { name: 'Chicane du port — extérieur', surface: 'asphalt', side: 1, points: [[0.5737,7.63],[0.5789,7.36],[0.5819,8.7],[0.5849,8.7],[0.5879,9.6],[0.5909,10.3],[0.5952,0]] },
      { name: 'Zone 6', surface: 'asphalt', side: 1, points: [[0.0534,1.39],[0.0602,8.85],[0.0636,9.9],[0.0657,9.38],[0.0667,9.65],[0.0676,9.98],[0.0689,11.16],[0.0733,11.17],[0.0782,9.08],[0.0798,8.96],[0.0862,8.04]] },
      { name: 'Zone 7', surface: 'asphalt', side: 1, points: [[0.8028,0.39],[0.8098,8.6],[0.8126,7.77],[0.8138,9.16],[0.8148,10.63],[0.8157,11.35],[0.8174,10.26],[0.8298,11.17],[0.8338,9.69],[0.8391,0.56]] },
    ],
    barrierPaths: [
      { side: -1, from: 0.3975, to: 0.455, pts: [[263.55,-245.99],[266.74,-251.94],[269,-253.2],[272.2,-254.2],[275.6,-254],[278.9,-252.8],[281.8,-251.1],[284.1,-248.7],[285.8,-245.7],[286.8,-242.4],[287.3,-238.8],[287.3,-235],[286.9,-231.5],[286.7,-229.7],[285.9,-225.1]] }, // Épingle — intérieur
      { side: -1, from: 0.2064, to: 0.2589, pts: [[73.95,-56.67],[77.6,-57],[81.3,-57.3],[85.1,-57.8],[88.9,-58.6],[92.8,-59.5],[96.4,-60.5],[99.9,-61.7],[103.5,-63],[107,-64.5],[110.6,-66.3],[114.3,-68.4],[117.9,-70.7],[121.2,-73.2],[124.3,-75.9],[127.1,-78.9],[129.6,-82],[131.9,-85.3],[133.9,-88.9],[135.5,-92.5],[136.8,-96.1],[137.6,-99.9],[138.1,-103.7],[138.3,-107.5],[138.3,-111.2],[138.1,-115],[137.9,-118.8],[137.4,-122.6],[136.8,-126.4],[136.1,-130.2],[135.3,-134],[134.4,-137.8],[133.5,-141.6],[132.6,-145.4],[131.5,-149.2],[130.5,-152.9],[129.4,-156.7],[128.3,-160.4],[127.7,-162.2],[126,-167.2]] }, // Casino — extérieur
      {side:-1,from:.0339,to:.1149,pts:[[-264.4,-2.8],[-263.1,-7.9],[-262.7,-9.7],[-261.9,-13.1],[-261.1,-16.4],[-260.2,-19.7],[-259.2,-23.3],[-258.2,-26.8],[-257.2,-30.4],[-256.1,-33.9],[-255.1,-37.4],[-253.8,-40.9],[-252.3,-44.5],[-250.4,-47.9],[-248.2,-51.2],[-245.8,-54.3],[-243.0,-57.0],[-239.9,-59.0],[-236.6,-60.7],[-233.0,-62.0],[-229.2,-62.9],[-225.5,-63.4],[-221.7,-63.8],[-217.9,-64.0],[-214.1,-64.1],[-210.3,-64.1],[-206.5,-64.0],[-202.8,-63.8],[-199.0,-63.6],[-195.2,-63.4],[-191.4,-63.1],[-187.6,-62.9],[-183.8,-62.6],[-180.0,-62.3],[-176.2,-62.1],[-172.4,-61.7],[-168.7,-61.3],[-164.9,-61.0],[-161.1,-60.6],[-157.3,-60.2],[-153.5,-59.8],[-149.8,-59.5],[-146.0,-59.1],[-142.3,-58.8],[-140.4,-58.6],[-134.8,-58.0]]}, // Sainte-Dévote et Beau Rivage — extérieur
      {side:-1,from:.1364,to:.1780,pts:[[-87.9,-54.4],[-82.6,-53.9],[-80.9,-53.7],[-77.3,-53.4],[-73.8,-53.0],[-70.2,-52.6],[-66.4,-52.3],[-62.6,-52.1],[-58.8,-52.0],[-55.0,-52.0],[-51.2,-52.1],[-47.4,-52.3],[-43.7,-52.5],[-39.9,-52.8],[-36.1,-53.0],[-32.3,-53.3],[-28.5,-53.5],[-24.7,-53.7],[-20.9,-54.0],[-17.1,-54.1],[-13.3,-54.1],[-9.5,-54.1],[-5.8,-54.1],[-2.0,-53.9],[1.8,-53.7],[3.7,-53.6],[9.4,-53.2]]}, // Massenet — extérieur
      {side:1,from:.5777,to:.5923,pts:[[92.8,-30.2],[87.1,-29.0],[85.2,-28.7],[81.4,-27.9],[77.6,-27.2],[73.9,-26.5],[70.0,-25.8],[66.0,-25.0],[64.1,-24.7],[57.8,-23.7]]}, // Chicane du port — extérieur
      {side:-1,from:.8557,to:.8952,pts:[[-265.6,247.3],[-263.7,252.9],[-262.8,254.8],[-261.1,258.4],[-259.2,261.8],[-256.8,264.9],[-254.1,267.6],[-252.4,270.0],[-251.8,271.9],[-252.5,273.4],[-254.5,274.3],[-256.0,274.9],[-260.4,275.1]]}, // Rascasse — extérieur
      { side: -1, from: 0.2588, to: 0.2888, pts: [[125.28,-166.48],[122.58,-170.71],[120.63,-175.53],[119.62,-178.48],[119.62,-181.53],[120.8,-186.01],[123.25,-188.97],[130.78,-196.07],[138.05,-203.85]] },
      { side: -1, from: 0.3273, to: 0.3543, pts: [[205.97,-260.5],[210.14,-264.81],[215.14,-268.14],[219.45,-269.39],[220.56,-268.14],[220.84,-265.36]] },
      { side: 1, from: 0.6033, to: 0.6624, pts: [[31.36,-23.52],[5.82,-17.14],[-14.63,-14.54],[-40.67,-8.26],[-66.31,-14.24],[-84.86,-20.43],[-98.53,-25.81]] }, // Tabac — extérieur
      { side: 1, from: 0.9319, to: 0.9518, pts: [[-312.17,225.22],[-312.77,220.1],[-312.77,218.65],[-313.11,215.23],[-313.53,212.5],[-314.22,208.57],[-315.58,203.28],[-317.12,198.76],[-317.89,194.15],[-318.48,189.97],[-317.55,186.22],[-316.78,181.86],[-317.29,177.43]] }, // Antony Noghès — extérieur
    ],
    // Le pont qui enjambe le boulevard Albert 1er juste avant la ligne (voie 167625745).
    passerelles: [0.9204],
    /* Le tunnel du boulevard Louis II, 356 m relevés sous l'hôtel (voie 4230891, « tunnel=yes »).
       C'est le seul vrai tunnel des douze circuits. Monza et Suzuka ont des portions « covered »,
       mais couvert n'est pas souterrain : à Monza ce sont les vingt-cinq mètres sous la passerelle
       du Serraglio, qu'on dessine déjà comme une passerelle. */
    tunnels: [[0.4550, 0.5617]],
    /* Les panneaux repris à la main dans `lignes.html`, et gardés tels quels.

       Les FRACTIONS des panneaux ont été décalées de −0,0267 de tour : elles se comptent depuis la
       ligne de départ, et celle-ci a bougé de 89 m quand on est passé de la voie des stands devinée
       au nœud « raceway=start-finish » d'OpenStreetMap. Les mêmes panneaux, au même endroit de la
       piste.

       PLUS DE LIGNES REPRISES ICI (0.52.22). Les trois qu'il y avait étaient celles de SPA, posées
       là par l'ancien export de l'éditeur : il lisait les apostrophes des commentaires comme des
       chaînes, la découpe de la définition de Spa débordait sur celle-ci, et le bloc s'est posé à
       la fin de Monaco (corrigé depuis dans `finObjet`). Projetées sur Monaco puis bornées à la
       chaussée, elles collaient au bord sur tout le tour — l'idéale et la bleue sur 100 % des
       stations. Le jeu joue donc le calcul, en attendant des lignes dessinées pour Monaco ; et
       `Track` ignore désormais des lignes qui ne suivent pas leur circuit. */
    panneaux: [
      [0.057,0,1,1],
      [0.1744,50,3,-1],
      [0.1974,0,3,-1],
      [0.332,0,1,1],
      [0.6161,0,'chicane',-1],
      [0.7157,0,'square',-1],
      [0.8092,0,'chicane',1],
      [0.8493,50,'square',1],
      [0.0367,50,1,1],
      [0.3126,50,1,1],
      [0.5928,50,'chicane',-1],
      [0.9685,200,1,1],
      [0.6848,50,'square',-1],
      [0.2647,0,3,1],
      [0.3744,0,'acute',-1],
      [0.4292,0,'square',1],
      [0.7547,0,'chicane',-1],
      [0.0125,100,1,1],
      [0.9016,0,3,1],
      [0.8705,0,'square',1],
      [0.8264,100,'square',1],
      [0.788,50,'chicane',1],
      [0.7288,50,'chicane',-1],
      [0.6554,100,'square',-1],
      [0.5691,100,'chicane',-1],
      [0.5328,200,'chicane',-1],
      [0.3985,0,'square',1],
      [0.3545,50,'acute',-1],
      [0.2863,100,1,1],
      [0.25,50,3,1],
      [0.1503,100,3,-1],
    ],
    /* Monaco n'a pas de dégagement : un mur, et derrière le mur la ville. Rien dans `runoffs`,
       donc — c'est précisément ce qui fait ce circuit. La ville elle-même (`ville`, plus bas) est
       relevée sur une vue satellite ; l'implantation ne garde que ce qui tient au circuit : la
       tribune de la Piscine et le parking de la chicane. Pas de voie des stands (`pitLane: false`) :
       Bruno y veut les platanes du boulevard (`ville.alignements`), derrière une protection
       rapprochée de la ligne droite (`barrierCloseZones`). */
    implantation: [
      { kind: 'parking', side: -1, from: 0.6, to: 0.66, recul: 10, prof: 22 },
      { kind: 'tribune', side: 1, from: 0.8, to: 0.88, recul: 8, prof: 14, module: 24 },
    ],
    pitLane: false,
    barrierCloseZones: [{ side: -1, from: 0.915, to: 1.045 }],
    // La ville, relevée sur la même vue satellite : [x, y, cap, longueur, largeur, hauteur, toit]
    // (toit 0 immeuble, 1 terrasses, 2 tuiles), les jardins, et les repères posés à la main à leur
    // place relevée : la piscine, le Casino, l'Hôtel de Paris, le jardin de la place, l'auditorium.
    ville: {
      // Les platanes du boulevard, de la Rascasse à Sainte-Dévote : deux rangées côté stands, là
      // où passait la voie des stands, et une côté Condamine.
      alignements: [
        { from: 0.915, to: 0.045, side: -1, recul: 3.4, pas: 6.5, id: 'tree', e: 0.58 },
        { from: 0.915, to: 0.045, side: -1, recul: 9, pas: 7, id: 'tree', e: 0.62 },
        { from: 0.915, to: 0.05, side: 1, recul: 3.6, pas: 7, id: 'tree', e: 0.62 },
      ],
      reperes: [
        { type: 'piscine', x: -274.2, y: 106, a: 1.6141, l: 68, w: 16.8 },
        { type: 'casino', x: 178, y: -186, a: -0.8, l: 44, w: 30 },
        { type: 'palace', x: 158.5, y: -147.5, a: -0.8, l: 36, w: 22 },
        { type: 'rond', x: 70, y: -186, a: 0, l: 20, w: 20 },
        { type: 'auditorium', x: 188.7, y: -105.3, a: -0.8, l: 30, w: 22 },
      ],
      batis: [
        [-326.4,351.4,0.42,30.6,27.9,25,0],[135,-71.9,-0.85,28.8,15.5,21,0],[-224.2,115.7,0.18,24.1,18.3,18,1],[-409.5,103,-1.57,21.2,20.2,19,0],[-409.5,81.5,-1.57,21.2,20.2,23,1],[-409.5,60,-1.57,21.2,20.2,39,0],
        [-412.4,31.1,-1.57,27,14.3,42,0],[184,-392.3,0,25.2,14.6,20,1],[-36,-163.3,0.62,27.5,11.9,25,1],[144.1,-271.9,-0.87,22.6,14.2,34,0],[208.2,-320.6,0.6,22,14.4,22,0],[150.2,-41.5,-0.36,24.4,12.9,22,0],
        [-238.2,-234.9,1.52,22.3,14.1,29,1],[-349,445,-1.32,26.1,12,12,2],[193.6,-61,-0.51,25.4,12.3,35,0],[207.5,-392.3,0,21.3,14.6,46,0],[220.6,-354.1,0.29,21.5,14.4,15,1],[-266.2,-217.3,1.36,21.2,14.5,12,2],
        [-124.5,278.1,1.49,23.4,13.1,20,1],[167.5,-299.7,-0.87,21.4,14.2,26,0],[-168,-107,0,21.2,14.2,25,1],[-218,-187.2,-0.11,20.9,14.3,26,0],[201.8,-340.4,-0.87,20.3,14.4,44,0],[55.3,-126.4,-0.69,20,14.6,30,0],
        [-417,-106.1,-0.61,17.1,17,14,1],[-402.7,-116.1,-0.61,17.1,17,21,1],[-388.4,-126,-0.61,17.1,17,25,1],[181,-138.7,0.87,19.8,14.6,26,0],[-128.9,430.2,-0.65,24.9,11.6,14,2],[-311.2,-242.9,-0.19,25.1,11.5,19,2],
        [70.1,-100.6,-0.02,20.7,13.9,45,0],[149.2,-109.2,-1.57,19.7,14.6,40,0],[-82.2,-158.4,-0.91,21.3,13.5,44,0],[41.7,-125.9,-0.75,19.5,14.6,22,1],[-365.5,232.9,-1.56,20.6,13.8,17,2],[-182.1,-179.1,1.45,22,12.9,35,0],
        [-145.2,401.2,-0.25,21.5,13.2,12,2],[-347.5,239.8,0.14,20.5,13.8,17,2],[-305.9,359.4,-1.29,18.6,15.2,29,0],[-161.7,-216.2,0.8,21.1,13.3,25,0],[-259.5,426.1,0.14,21.3,13.1,18,2],[-330.1,-120.1,-0.73,19.6,14.2,17,1],
        [114,-316.6,-0.74,20.8,13.3,18,1],[-359.2,-171,1.14,20.3,13.6,16,1],[126.4,-351.8,0.9,20.6,13.3,20,0],[181.3,-356.8,0.93,27.1,10.1,22,0],[-98.6,308.3,-0.09,18.8,14.5,45,0],[-113.3,-238.8,-0.04,18.7,14.5,19,0],
        [-13.7,-259.1,-0.89,22,12.3,40,0],[131.7,-31.7,-0.63,20.8,12.9,25,1],[-20.6,-215.1,0.73,19.7,13.6,20,0],[-360.3,-189.3,1.15,19.7,13.6,48,0],[-176.5,-202.5,0.8,20.7,12.9,43,0],[26.9,-344.3,0.74,24,11.1,24,1],
        [-56.7,-153.3,0.64,19,14,38,0],[-268.9,-117.3,-0.14,19,14,16,2],[212.3,-163.9,1,22.3,11.9,43,0],[125.5,-385.3,0.9,21.2,12.5,22,1],[-369.6,135.8,0.18,21.4,12.3,23,1],[-287.9,-114.6,-0.14,18.8,14,18,2],
        [42.6,-305.9,-0.84,19.2,13.7,34,0],[-290.3,404.2,-1.35,20,13.1,14,2],[-290.2,-178.5,-0.13,17.9,14.6,45,0],[-412.7,313.6,-1.57,18.9,13.8,23,0],[-134.5,289.6,1.48,19.9,13.1,28,1],[70,-138.7,-0.69,17.8,14.6,39,0],
        [-153.8,423.7,-0.25,22.4,11.6,28,0],[-383.7,-173.6,1.16,18.8,13.8,35,0],[296.8,-312.7,-1.29,17.4,14.9,28,1],[-68.8,-141.6,-0.92,18.5,14,15,2],[-282.1,-80.8,-0.45,18.5,14,17,2],[150,-354.4,0.9,20.7,12.5,28,1],
        [-391.3,318.7,-1.12,20.2,12.8,45,0],[-402.2,-23.8,-0.44,18.6,13.9,33,0],[-48.9,-234.3,-0.82,22.8,11.3,25,0],[-100,269.8,-0.07,22.4,11.5,28,1],[-368.2,-207.2,1.15,18.9,13.6,41,0],[-176,-230.9,0.8,19.3,13.3,24,1],
        [-118.7,-225.8,1.2,17.7,14.5,29,1],[27.3,-184.5,0.77,23.3,11,25,1],[109.2,-367.7,-0.71,20.6,12.4,16,1],[-323.4,413.1,0.31,21.4,11.9,30,1],[-318.6,440.4,-1.35,21.2,12,15,1],[81.3,-375.8,0.89,20.5,12.4,28,1],
        [-272.4,-180.8,-0.13,17.4,14.6,24,0],[64.1,-309.3,0.73,18.5,13.7,33,0],[-377.4,-18.3,-0.7,18.2,13.9,32,0],[-344.2,-107.4,-0.73,17.8,14.2,40,0],[198.3,-156.9,-0.73,21.2,11.9,39,0],[-372.1,188.4,-1.57,19.4,13,15,2],
        [-38.8,-258.3,0.72,20.5,12.3,24,1],[203.1,-54.9,-0.53,20.5,12.3,27,1],[-56,-130.7,-0.82,18,14,14,2],[-396.4,262.3,0.07,21,12,20,1],[-205.7,354.9,-0.12,18.1,13.9,43,0],[-411.1,285.5,0.08,18.2,13.8,15,1],
        [-162,403.2,1.42,19,13.2,17,2],[94.3,-359.7,0.89,20.2,12.4,29,0],[-15.9,-128.9,-1.05,21.2,11.8,16,1],[129.9,-245.8,-0.7,22.3,11.2,26,0],[-345.7,263.1,0.16,20.8,12,19,0],[14.6,-327.3,-0.83,22.4,11.1,28,0],
        [272.7,-389.3,-1.39,23,10.8,22,1],[-101.8,360.1,-0.26,21,11.8,41,0],[162.7,-338.4,0.9,19.7,12.5,30,0],[-301,-221.1,1.43,27.9,8.8,18,1],[-162.4,-188,0.8,19,12.9,18,0],[-65.1,267.4,-0.07,21.2,11.5,22,1],
        [-70.6,319.5,-0.17,16.8,14.5,26,0],[-29.5,-204.7,0.61,17.9,13.6,29,0],[138.7,-311.6,-0.73,19,12.8,16,1],[-336.4,-92,0.95,17.1,14.2,23,1],[321.1,-322.3,-0.92,21.1,11.5,25,1],[-236.6,447.7,1.56,21.1,11.5,13,2],
        [-256.7,411.6,1.56,18.5,13.1,13,2],[-216.2,-153.8,0,20.7,11.7,24,0],[-405,175.1,-1.4,19.5,12.4,27,1],[-175.8,-122.4,-0.02,24.3,9.9,18,0],[-397.5,285.2,-1.12,17.4,13.8,21,1],[-256,-171,1.51,16.4,14.6,25,1],
        [-385.7,340.4,0.27,18.7,12.8,46,0],[161.2,-273.2,-0.67,16.8,14.2,25,1],[-26.3,-110.7,-1.05,20.2,11.8,43,0],[-293,440.6,0.14,22.9,10.4,13,2],[-358.8,-29.7,0.86,23.8,10,14,2],[-49.4,-273,-0.94,19.3,12.3,47,0],
        [-49.9,-107.3,-0.84,20.1,11.8,37,0],[-55.5,-177.3,0.62,19.9,11.9,37,0],[-194.8,424.8,-0.14,20,11.7,12,2],[-383.2,256.9,0.16,19.4,12,48,0],[-337.1,-159,-0.55,21.1,11,24,0],[-279.1,423.3,0.14,17.7,13.1,15,2],
        [-202.3,-139.1,-0.02,23.6,9.8,17,2],[-171,275.4,-0.1,19.6,11.8,39,0],[-92.5,-238.2,-0.47,15.9,14.5,17,1],[-356.2,218.2,0.17,16.7,13.8,21,1],[-373.4,290.3,0.24,18,12.8,35,0],[-410.8,-0.3,0.89,16.1,14.3,17,1],
        [149.6,-165.2,-0.77,18.5,12.4,24,0],[252,-159.9,-0.99,22.9,10,29,1],[-313.9,-211.5,1.43,19.9,11.5,11,2],[0.3,-158.8,0.76,17.7,12.9,25,1],[-302,325.4,0.2,22.6,10.1,35,0],[-44.1,-143.5,-0.82,16.3,14,14,2],
        [-93.6,-117.8,0.79,21.1,10.8,35,0],[-16,-291.4,0.67,20.1,11.3,18,2],[-81.6,353.1,0.39,19.2,11.8,20,0],[-320.2,-97.2,-0.46,15.9,14.2,22,0],[-133.7,382.4,1.32,17.1,13.2,18,2],[22.9,-163.8,0.76,20.5,11,26,0],
        [37.1,-329.1,-0.83,20.3,11.1,19,1],[-307,-176.4,-0.13,15.4,14.6,21,0],[72.9,-356.6,0.88,21.6,10.4,17,1],[-216.8,-121,-0.02,20,11.2,28,1],[137.8,-369.7,0.9,17.9,12.5,15,1],[59,-373.4,0.88,21.5,10.4,28,0],
        [-404.4,-140.4,-0.55,16.2,13.8,21,0],[94.5,-328.7,-0.71,16.8,13.3,48,0],[-369.3,-103.8,0.96,19.6,11.4,32,0],[-321.9,13.7,0.87,22.8,9.8,21,1],[169.5,-129.9,-0.79,15.3,14.6,26,0],[-286.3,-214.7,1.37,19.4,11.5,11,2],
        [188.5,-298.4,-0.81,15.7,14.2,22,0],[-215.4,-98.5,0.34,19.9,11.2,28,1],[-193.2,338.2,1.42,16,13.9,20,1],[23.2,-314,-0.83,20,11.1,33,0],[266.8,-335.8,-1.3,22.2,10,23,1],[-202.5,373.8,-0.12,21.1,10.5,17,2],
        [-335.8,454.4,0.2,18.4,12,13,2],[-142.2,-228.3,1.2,16.6,13.3,17,1],[7.7,-339.5,-0.63,19.8,11.1,28,0],[-383.4,361,0.26,19.4,11.3,16,1],[-399.6,335.8,-1.12,17.1,12.8,36,0],[-361.4,-75.8,-0.45,19.2,11.4,21,1],
        [-235.2,-210.6,-0.2,15.3,14.3,41,0],[-122.8,298.4,1.49,16.7,13.1,23,0],[-230,-166.4,-0.11,22.3,9.8,18,2],[-378.3,-156.5,-0.55,15.8,13.8,28,1],[310.1,-327.8,0.3,18.9,11.5,20,1],[179.4,-370.6,0.9,21.5,10.1,25,1],
        [242.6,-150.8,0.99,21.7,10,15,1],[-372.6,149.2,1.55,17.6,12.3,34,0],[-166.7,372.8,1.42,16.4,13.2,12,2],[125.1,-299.4,-0.73,16.9,12.8,43,0],[-41.7,-213.4,-0.82,15.9,13.6,36,0],[-330,-46.1,-0.73,21.6,10,11,2],
        [-222.6,357,-0.12,15.5,13.9,27,0],[-404.8,300.3,-1.12,15.6,13.8,45,0],[77,-224,0.86,19.2,11.2,30,0],[-256,374,-1.57,19.2,11.2,18,2],[253.5,-380.8,0.29,17.6,12.2,27,1],[237.6,-349.4,-1.19,14.9,14.4,41,0],
        [-223.8,394.4,1.42,17,12.6,15,2],[17.1,-134.7,0.71,16.6,12.9,26,1],[47.1,-241,-0.83,21.8,9.8,16,1],[-299.7,-141.2,0.09,21.8,9.8,25,1],[-162.2,-140.5,-0.02,19,11.2,24,0],[-335.5,-233.7,1.43,19.5,10.9,26,0],
        [-285.6,388.4,0.27,16.2,13.1,15,2],[-271.3,443.6,0.14,20.4,10.4,15,2],[209.7,-214.4,0.87,16.7,12.7,31,0],[-392.1,175.4,-1.57,17.1,12.4,18,1],[-224.4,-234.4,-0.19,15,14.1,46,0],[-363,301,-1.13,16.5,12.8,18,1],
        [92.4,-145.3,0.77,21.5,9.8,20,0],[-388.6,393.9,0.34,20.4,10.3,29,1],[339.1,-393.3,-0.01,17.5,12,21,1],[-330.3,276.9,0.24,17.5,12,46,0],[-392.1,158.1,-1.57,16.9,12.4,19,2],[-81.7,-92.4,0.14,19.4,10.8,24,1],
        [-18.8,-170.1,-0.84,17.6,11.9,19,0],[-121.5,-147.3,0.8,18.7,11.2,16,1],[-232.8,429.9,-0.13,18.2,11.5,18,2],[-416.2,136.5,-1.57,31.2,6.7,20,1],[-183.4,389.4,1.41,19.9,10.5,18,2],[-383.8,82.8,0.04,21.1,9.9,34,0],
        [-409.4,-155.1,-1.06,15.1,13.8,43,0],[-222.8,460.9,-0.19,18.1,11.5,15,2],[-339.7,-55.6,-0.45,20.8,10,16,2],[-364.9,365.9,0.26,18.4,11.3,21,1],[54,-186.1,-1.55,21.2,9.8,25,0],[-364.8,260,0.16,17.3,12,46,0],
        [-332.2,430.6,0.31,17.3,12,18,2],[-394.5,-13.8,0.89,14.9,13.9,16,1],[-349.2,335.1,-1.15,20.1,10.3,31,0],[-340.9,316.5,-1.15,20.1,10.3,17,1],[-104.2,285.1,1.49,18,11.5,31,0],[-73.2,-208.1,-0.82,18.3,11.3,43,0],
        [-109.5,346.7,-0.17,17.5,11.8,33,0],[-338.8,20.4,0.87,19.8,10.4,13,2],[-335.4,389.6,-1.33,17.3,11.9,13,2],[-89,287.1,-0.09,17.9,11.5,19,1],[-330.5,-22.8,-0.72,21,9.8,46,0],[-354.4,-148.5,-0.55,18.7,11,21,0],
        [-153.9,291.4,1.49,17.4,11.8,22,0],[12.8,-147,0.76,15.9,12.9,40,0],[-189.4,-215.8,0.8,15.8,12.9,21,1],[204.3,-142.2,0.87,17.1,11.9,44,0],[-82,306.8,-0.09,14,14.5,22,0],[-223.2,409.5,-0.14,16.1,12.6,12,2],
        [45.7,-351.6,0.72,19.5,10.4,16,1],[-254.9,451.2,1.55,19.5,10.4,14,2],[320.6,-377.5,-1.35,16.9,12,31,0],[-143.4,-141,-0.02,18.1,11.2,24,0],[273.4,-293.3,-1.29,17.6,11.5,21,0],[-0.8,-279.4,0.67,17.9,11.3,29,0],
        [167,-375.9,0.93,20,10.1,19,0],[162.3,-210.2,-0.7,15.9,12.7,21,1],[-207.6,-216.8,1.45,14.1,14.3,17,1],[-66.7,-119,0.81,14.4,14,17,2],[-269.9,-234.8,1.36,13.9,14.5,13,2],[-93,-214.4,-0.49,17.8,11.3,21,1],
        [-66.9,-187.4,-0.82,16.9,11.9,15,1],[-180.6,290.8,1.42,17,11.8,17,1],[-260.1,-241.2,1.51,13.8,14.5,20,0],[-67.8,305.5,-0.09,13.8,14.5,22,1],[-86,322.2,-0.17,13.8,14.5,16,1],[-39.9,-187.3,0.61,16.8,11.9,16,1],
        [-392.6,189,0.19,16.1,12.4,13,2],[-22,-271.7,0.67,16.2,12.3,24,1],[-236.9,410.6,1.56,15.8,12.6,12,2],[-339.5,-190.8,1.17,18.2,10.9,16,1],[-188.1,-243.3,0.8,14.9,13.3,18,0],[-403.4,-56.9,-0.43,15.7,12.6,22,0],
        [-237.1,394.6,1.56,15.7,12.6,12,2],[298.3,-296.6,0.06,17.2,11.5,36,0],[223,-147.3,1,16.6,11.9,17,1],[-167.9,-177.8,-0.2,15.3,12.9,44,0],[76.6,-298.2,0.73,14.4,13.7,25,1],[-160.8,304.5,0.08,16.7,11.8,18,1],
        [-342.4,67,0.05,17.1,11.5,47,0],[-350.8,373.1,-1.35,17.4,11.3,17,1],[60.4,-338.7,0.72,18.9,10.4,16,1],[-414,226.8,-1.57,17.7,11.1,41,0],[-53.8,-196.9,0.61,16.5,11.9,14,1],[156,-286,-0.87,13.8,14.2,17,1],
        [13.5,-177.8,-0.85,17.8,11,17,1],[223.3,-74.9,-0.9,15.9,12.3,19,0],[-71.2,285.6,-0.09,17,11.5,17,1],[-363,83.8,0.04,19.7,9.9,27,1],[-385.9,434,0.64,18.9,10.3,43,0],[-365.7,50.9,-0.13,16.9,11.5,39,0],
        [-273.6,-248.8,-0.19,13.4,14.5,13,2],[246.3,-318.4,-1.18,19.4,10,21,0],[10.7,-100.4,-0.03,17,11.4,17,1],[251.8,-365.3,0.3,17.9,10.8,27,1],[-391.3,-148.5,-0.55,14,13.8,28,0],[-206,-202.7,1.45,13.5,14.3,46,0],
        [-357.2,195,0.16,14.8,13,15,2],[278.1,-310.1,-1.29,16.7,11.5,33,0],[-5.1,-187.6,0.61,14.1,13.6,17,1],[-220.8,-213.4,-0.2,13.4,14.3,29,1],[93.8,-310.7,0.74,14.4,13.3,41,0],[232.3,-335.9,-1.19,13.3,14.4,24,0],
        [48.4,-159.8,-0.76,17.4,11,44,0],[-134.4,-95.4,-1.38,19.3,9.9,24,1],[-359.6,66.1,0.05,16.6,11.5,34,0],[-332.9,-215,1.43,17.5,10.9,20,1],[56.2,-98.9,-0.71,13.7,13.9,47,0],[13.4,-112,0.72,16.7,11.4,33,0],
        [-137.4,-212.9,-0.48,14.3,13.3,31,0],[-235.9,-195.3,1.52,13.3,14.3,18,1],[-203.2,403.9,1.42,18.1,10.5,15,2],[276.3,-244.8,0.63,17.1,11.1,35,0],[28.5,-292.8,-0.84,18.6,10.2,40,0],[-154.4,-160.7,-0.2,16.9,11.2,28,0],
        [-55.3,301.3,-1.37,13,14.5,30,0],[80.3,-341.3,-0.71,18.1,10.4,33,0],[-384.8,-30.4,0.87,13.5,13.9,24,0],[344.3,-381.9,-0.49,15.6,12,28,1],[-210.2,-237.1,-0.19,13.2,14.1,38,0],[-294.1,421.1,-1.35,14.2,13.1,15,1],
        [153.5,-315.4,-0.86,14.5,12.8,24,1],[13,-210.4,0.73,18.9,9.8,41,0],[-315.3,-36.1,-0.72,18.9,9.8,19,0],[-54.4,284.1,-0.09,16.1,11.5,27,1],[-342.8,30,-0.12,17.8,10.4,13,2],[-7.9,-203.9,0.73,13.6,13.6,24,0],
        [-134,-160.2,0.8,16.5,11.2,28,0],[-241.2,-252.2,0.14,13.1,14.1,26,0],[-355.7,386.1,0.33,16.3,11.3,42,0],[-103.8,379.7,-0.27,17.5,10.5,39,0],[137,-337.5,-0.74,13.8,13.3,20,0],[-402,-166.4,-0.92,13.3,13.8,27,1],
        [-225,339.9,0,13.2,13.9,26,1],[-123.7,-123.5,-0.03,18.5,9.9,23,1],[-346.4,-207.2,1.17,16.8,10.9,42,0],[-385.6,375.9,0.33,16.2,11.3,20,1],[301.9,-379.2,-1.34,17.6,10.4,31,0],[-176.3,437.1,1.41,15.6,11.7,11,2],
        [-25.3,-246.5,0.72,14.8,12.3,23,1],[0,-312.7,0.71,16.4,11.1,16,1],[-173.8,326.5,0.07,16.4,11.1,46,0],[-383.7,302.9,-1.12,14.2,12.8,46,0],[-15,-96.4,-1.04,21.3,8.5,27,1],[-392.1,142,-1.57,14.6,12.4,16,2],
        [-339.4,405.7,-1.33,15.2,11.9,15,2],[-4.6,-291.9,0.69,16,11.3,11,2],[-375.6,328.1,-1.13,14.1,12.8,40,0],[-8.9,-236.3,-0.89,18.4,9.8,26,1],[-202.3,-120.1,-1.41,16.1,11.2,15,1],[-319.6,378.5,0.26,15.1,11.9,24,0],
        [203.2,-371.8,0.9,12.3,14.6,34,0],[-34.3,-281.3,0.67,14.6,12.3,46,0],[-137.6,367.2,1.32,13.6,13.2,18,2],[-217.5,429.9,1.43,15.6,11.5,14,2],[133.9,-292.5,-0.86,14,12.8,22,0],[-359.1,-3.6,0.87,17.2,10.4,17,2],
        [-322.3,317.6,-1.15,17.7,10.1,18,1],[-385.2,222.5,-1.56,16.1,11.1,16,1],[-1,-223.1,0.73,18.2,9.8,21,1],[-16.5,-195.6,0.61,13.1,13.6,26,0],[-346.6,172,1.54,13.7,13,16,2],[-369.5,315.1,-1.13,13.9,12.8,44,0],
        [313.9,-348.2,-1.35,14.8,12,40,0],[-329.1,257.4,1.47,14.8,12,31,0],[-292.4,-244.4,1.37,15.4,11.5,13,2],[27.2,-100.9,-0.03,15.5,11.4,35,0],[86.5,-124.6,0.77,12.7,13.9,47,0],[-190.1,353,-0.12,12.7,13.9,18,1],
        [-315.2,-6.1,-1.21,18,9.8,25,0],[-94.7,401.1,-0.95,16.8,10.5,28,0],[-226.1,378.7,1.42,14,12.6,16,2],[-346.2,272.9,0.24,14.7,12,35,0],[-115.5,-107.7,-1.3,17.8,9.9,24,1],[229.7,-131.9,-0.82,14.8,11.9,33,0],
        [231.6,-167.4,0.99,17.6,10,43,0],[-412.4,11.1,-1.57,12.3,14.3,19,1],[126.8,-328.2,-0.74,13.2,13.3,23,1],[-197.1,438.8,1.43,15,11.7,18,2],[-278.5,-165.4,0.25,12,14.6,39,0],[-253,-121,1.52,12.5,14,24,1],
        [-307.9,391.4,-1.36,14.7,11.9,19,2],[-194.9,453.9,1.43,14.9,11.7,12,2],[75.7,-115.5,-0.71,12.5,13.9,24,1],[-351.8,139,0.18,14.1,12.3,34,0],[-157.5,327.6,0.07,15.6,11.1,27,1],[-322.2,-63.9,-0.45,17.3,10,46,0],
        [-315.2,-59.2,-0.73,17.3,10,18,2],[125,-282.2,0.73,13.5,12.8,25,1],[-320.9,-132.7,1.42,16.3,10.6,33,0],[293.6,-332.8,0.3,15,11.5,16,1],[-334.2,217.1,-0.24,16.7,10.3,44,0],[261.5,-176.8,-1.16,17.2,10,21,0],
        [-284.6,-199.6,-0.13,14.9,11.5,17,2],[-215.3,445.3,1.43,14.9,11.5,29,0],[140.2,-155.1,1.33,13.8,12.4,35,0],[-38.1,-120.4,-0.84,14.5,11.8,27,0],[-155.2,275.1,1.49,14.5,11.8,16,1],[-4.4,-111.6,-1.04,15,11.4,27,0],
        [-266.7,-162.4,0.25,11.7,14.6,26,1],[-269.3,-96,-0.85,16.4,10.4,16,2],[233.8,-381.5,-0.88,15.7,10.8,26,1],[-85,387.5,-0.95,16.1,10.5,27,1],[178.7,-288.2,-0.81,11.9,14.2,33,0],[83.1,-318.8,-0.71,12.7,13.3,16,1],
        [-386.5,235.4,0.16,15.2,11.1,30,0],[45.3,-214,-0.83,17.2,9.8,29,1],[-199.2,-166,1.45,17.2,9.8,15,2],[36,-151.2,0.76,15.3,11,29,1],[-369.2,-139.5,-0.55,15.3,11,42,0],[-271.3,392.4,0.27,12.8,13.1,12,2],
        [-159.8,336.4,-0.17,15.1,11.1,21,0],[-278.5,454.4,0.14,29.9,5.6,12,2],[104,-381.1,0.9,13.5,12.4,25,0],[-372.1,171.8,-0.01,12.8,13,15,2],[-78.5,-242.1,0.13,23.4,7.1,22,1],[-370.7,381,0.33,14.7,11.3,16,1],
        [-151.3,-179.4,-0.2,17.3,9.6,24,0],[211.1,-71.9,-0.65,13.5,12.3,48,0],[139.1,-382.4,0.94,13.2,12.5,28,0],[41.2,-170.9,0.77,15,11,45,0],[-61.8,-220.3,-0.82,14.6,11.3,20,1],[-400.1,356.5,0.26,14.6,11.3,24,0],
        [-371.1,400,0.34,16,10.3,24,1],[-401.5,20.8,-1.4,11.5,14.3,24,0],[-260.8,-254,1.51,11.3,14.5,18,2],[-164.5,387.3,1.42,12.4,13.2,19,2],[44.1,-192.4,0.77,16.7,9.8,26,0],[-256.9,-185.1,1.51,11.2,14.6,40,0],
        [-329.1,54,-1.41,14.2,11.5,14,1],[68.6,-168.5,0.77,16.6,9.8,29,1],[-359.5,151.7,-0.01,13.2,12.3,22,0],[317.1,-362.4,-1.35,13.5,12,42,0],[-344.3,-33.4,-0.73,16.2,10,19,2],[-189.5,405.8,-0.14,15.4,10.5,13,2],
        [-78.5,-222,-0.49,14.3,11.3,21,0],[88.3,-211.1,0.86,14.4,11.2,28,0],[-178.4,-142.2,1.46,14.4,11.2,27,1],[-400.6,-71.3,1.01,12.8,12.6,27,1],[-80.7,-104.8,0.79,14.9,10.8,37,0],[-273.6,407.8,0.14,14.1,11.4,16,2],
        [-28.5,-131,-0.84,13.6,11.8,40,0],[-204.8,-104.8,-1.41,14.3,11.2,36,0],[-379.1,35.4,-0.14,17.4,9.2,43,0],[-384.3,-82.2,1.02,14,11.4,25,1],[-359.4,-89.8,0.96,14,11.4,28,1],[-400.1,370.9,0.33,14.1,11.3,33,0],
        [-414.3,352.7,0.26,14.1,11.3,24,0],[145,-126.1,0.74,14.6,10.9,20,1],[124.5,-257,0.73,14.2,11.2,31,0],[-232.4,-107.8,1.51,14.2,11.2,20,1],[-334.6,-1.5,0.87,16.2,9.8,46,0],[-316.3,-228.5,1.43,13.8,11.5,18,2],
        [-361.6,419.2,-1.33,15.4,10.3,36,0],[-340.4,121.3,0.17,16,9.9,43,0],[114.8,-346.2,-0.71,11.9,13.3,21,1],[105.6,-338.2,-0.71,11.9,13.3,37,0],[-291,-49.9,-0.36,13.3,11.9,15,1],[-87.6,-203.9,0.91,14,11.3,37,0],
        [289.4,-380.6,-1.4,15.2,10.4,22,0],[60.8,-353.8,0.79,25.9,6.1,28,0],[-205.7,387.2,1.42,15,10.5,18,2],[1.7,-122.2,0.72,13.8,11.4,27,1],[-27.3,-178.5,0.61,13.2,11.9,21,1],[-371.5,2.1,-0.69,15.1,10.4,18,2],
        [-267.7,466.8,-0.02,15.1,10.4,15,1],[-356.4,-47.6,-0.45,15.7,10,19,2],[-352.2,322,-1.13,15.2,10.3,24,0],[-299,-197.6,-0.13,13.6,11.5,18,2],[4.4,-252.9,-0.38,15.9,9.8,27,1],[-333.7,300.2,-1.15,15.1,10.3,20,1],
        [-376.9,-70.2,1.02,13.6,11.4,26,0],[-186.4,-108.5,-1.4,15.6,9.9,29,1],[67.3,-201.6,0.02,15.7,9.8,30,0],[-359.5,171.6,-0.01,11.8,13,18,2],[-133.1,305.7,1.48,11.7,13.1,27,0],[-157.4,438.2,1.41,13.2,11.6,18,2],
        [-338.5,47.5,-0.13,13.3,11.5,36,0],[31.7,-262.1,0.72,15.6,9.8,36,0],[-407.4,-82,1.01,12.1,12.6,20,1],[-169.6,-157.7,-0.2,13.6,11.2,26,1],[351.7,-357.5,-0.72,17.1,8.9,35,0],[52.9,-319.2,0.73,11.1,13.7,22,0],
        [-136.3,419.2,-0.25,13.1,11.6,39,0],[-235.2,-183.1,1.52,10.6,14.3,33,0],[-138.4,-191.5,-0.48,15.6,9.7,15,1],[236.3,-370.1,0.3,14,10.8,24,0],[214.9,-197.1,-0.72,11.9,12.7,17,1],[-173.2,337.5,1.41,13.6,11.1,24,1],
        [-380.9,52.8,-0.13,13.1,11.5,19,1],[-414.3,-130.1,-1.55,14.6,10.3,40,0],[62.2,-147.8,0.79,10.3,14.6,16,1],[-346.6,151.5,-0.01,12.2,12.3,27,0],[214.1,-130.6,0.87,12.6,11.9,17,1],[-345.4,84.6,0.04,15.1,9.9,47,0],
        [-358.6,335.8,-1.13,14.5,10.3,19,0],[-129,397.1,-0.25,11.3,13.2,13,2],[-222,-138.7,-0.02,15.2,9.8,12,2],[-362.2,28.7,0.89,14.3,10.4,12,2],[-123.6,-92.5,-0.04,15,9.9,29,1],[-414,363.5,-1.57,13.1,11.3,25,1],
        [298.2,-363.5,-1.34,14.2,10.4,25,0],[-400.9,233,0.16,13.3,11.1,44,0],[-402.3,159.3,-1.4,11.9,12.4,19,2],[-131.8,-183,0.8,15.2,9.7,29,0],[-77.8,-129.8,-0.92,10.5,14,12,2],[191.8,-328.5,-0.87,10.2,14.4,35,0],
        [-32.2,-225.4,0.73,10.8,13.6,35,0],[-398.1,210.2,0.15,13.2,11.1,29,0],[-310.8,404.9,-1.36,12.3,11.9,16,2],[-82.2,268.6,-0.07,12.7,11.5,30,0],[-202.3,-188.9,-0.11,10.2,14.3,19,0],[262.3,-394.2,0,13.5,10.8,19,1],
        [-99.4,-150.9,-0.8,10.8,13.5,26,0],[294.4,-394.4,0,14,10.4,25,1],[-178.6,423,1.41,12.4,11.7,11,2],[110.9,-273,0.73,26.8,5.4,28,1],[11.4,-302.9,0.71,13,11.1,33,0],[34.5,-227.3,-0.83,14.7,9.8,26,0],
        [196.8,-125.6,0.87,20,7.2,44,0],[96,-391.1,0.9,11.6,12.4,18,1],[248.6,-394.2,0,13.3,10.8,20,1],[-381.9,-100.1,-0.6,12.6,11.4,27,1],[-413.3,-48.1,-1.57,11.4,12.6,35,0],[35.6,-361.6,-0.68,13.8,10.4,38,0],
        [114.4,-289.7,-0.73,11.2,12.8,23,1],[-107.8,407,1.32,13.6,10.5,14,1],[78.6,-393.4,0,11.5,12.4,29,0],[267,-360.6,0.3,13.2,10.8,27,1],[-111.1,-123.5,-1.3,14.4,9.9,25,1],[-117.6,-172.5,-0.34,14.6,9.7,37,0],
        [-137.4,273.2,-0.04,10.8,13.1,15,1],[-289.6,-230.5,1.37,12.3,11.5,40,0],[-374.3,65.3,0.05,12.3,11.5,29,1],[258.1,-305,-1.3,14.1,10,32,0],[-330.8,-199.6,1.43,12.9,10.9,47,0],[-189,-93.5,-1.4,14.2,9.9,30,0],
        [-371.1,17.6,0.89,13.5,10.4,17,2],[226.2,-320.6,0,9.7,14.4,21,0],[-236.4,464.5,1.56,12,11.5,15,2],[-256.9,396.8,1.56,10.5,13.1,16,2],[24.7,-216.4,-0.83,14,9.8,24,1],[-235.8,-153.3,1.52,14,9.8,15,2],
        [-263,-202,1.36,9.4,14.5,16,2],[305.5,-394.5,-1.34,13.1,10.4,20,1],[158.9,-92.3,-1.41,9.3,14.6,25,0],[-60.8,335.9,-1.38,11.5,11.8,47,0],[-211.8,-168.4,-0.11,13.8,9.8,18,2],[269.4,-371.5,-1.39,12.5,10.8,29,1],
        [-101.7,-92.9,-1.3,12.5,10.8,19,0],[282.1,-324,-1.29,11.7,11.5,32,0],[-351.3,49.1,-0.13,11.7,11.5,31,0],[-258.3,334.6,-0.15,13.3,10.1,25,0],[167,-80.9,1.52,9.2,14.6,24,0],[79.6,-157.7,0.77,13.7,9.8,46,0],
        [46.2,-370.2,-0.68,12.9,10.4,20,0],[-186.1,373,1.41,12.7,10.5,15,2],[224.3,-395,-0.86,18.5,7.2,39,0],[261.9,-318.4,-1.3,13.3,10,26,0],[-111.2,394.1,1.32,12.6,10.5,31,0],[-233.1,-120.6,-0.02,11.8,11.2,44,0],
        [-3.5,-329.9,-0.85,11.9,11.1,18,0],[-239.8,335.2,0.39,12.7,10.4,19,0],[-355.1,118.7,0.17,13.3,9.9,29,1],[113.4,-24.7,0.09,10.2,12.9,26,1],[-197.3,-150.5,1.45,13.4,9.8,17,2],[-273.4,335.8,0.1,13,10.1,19,1],
        [-96.1,-182.2,-0.81,13.5,9.7,37,0],[-165.2,-92,0.01,13.2,9.9,18,0],[-368.5,116.4,0.17,13.2,9.9,26,1],[252.5,-333.6,-1.18,13,10,40,0],[-332.4,375.1,0.26,10.9,11.9,12,2],[-381.7,114.1,0.17,13.1,9.9,28,1],
        [-90.3,-143.1,0.8,9.6,13.5,28,0],[-256.3,-137.2,-0.14,18,7.2,17,1],[171.6,-281.5,-0.67,9.1,14.2,22,1],[-349.4,7.9,0.87,12.4,10.4,14,2],[-293.1,463.6,0.18,12.4,10.4,13,2],[-280.6,465.9,0.18,12.4,10.4,18,2],
        [-311.7,-195.8,1.43,11.2,11.5,18,2],[-410.7,208.3,0.15,11.6,11.1,28,1],[-44.7,-95,0.82,10.9,11.8,46,0],[221.8,-121.4,0.87,10.8,11.9,41,0],[-338.4,181.7,-0.12,20.4,6.3,13,2],[-415.3,251.7,0.16,10.7,12,36,0],
        [157.1,-389.3,0.93,12.7,10.1,26,0],[-156.9,-122.8,-0.02,12.9,9.9,23,1],[-392.2,94.7,-1.39,12.9,9.9,33,0],[324.8,-393.2,-0.01,10.6,12,34,0],[175.7,-90.1,-0.5,8.7,14.6,27,1],[-195.1,325.5,1.42,9.1,13.9,26,1],
        [-105.4,-172.3,-0.81,13,9.7,18,1],[-237.8,379.5,-0.13,10,12.6,16,2],[-178.5,-92.2,0.01,12.7,9.9,17,1],[-110.6,-140.4,-0.02,15.1,8.3,22,1],[3.9,-196.3,-0.85,9.2,13.6,38,0],[-207.9,326.1,0.04,9,13.9,17,1],
        [-150.1,-104.1,-1.38,12.6,9.9,16,1],[-291.5,-133.5,-0.14,12.7,9.8,25,0],[-385.9,66,-1.37,10.8,11.5,41,0],[-369.3,-41.4,-0.45,12.4,10,16,2],[-345.6,426.2,0.31,10.3,12,16,2],[-57.9,317.2,-0.17,8.5,14.5,38,0],
        [169.3,-46.9,0.11,12.8,9.6,38,0],[287,-367,-1.4,11.8,10.4,24,1],[-302.1,451.2,-1.36,11.8,10.4,31,0],[-364.4,348,-1.13,11.9,10.3,23,0],[42.5,-252.7,0.72,12.4,9.8,35,0],[-159.9,-238.6,-0.02,9.1,13.3,19,1],
        [-131.4,-111.1,-1.38,12.2,9.9,18,0],[-235,-139.8,1.52,12.3,9.8,16,2],[-309.8,-20.5,-1.21,12.3,9.8,23,1],[-369,216,0.17,8.7,13.8,20,1],[-321.6,457.2,0.2,10,12,16,2],[-358.3,405.8,-1.33,11.6,10.3,39,0],
        [35.2,-202.9,-0.83,12.1,9.8,20,1],[60.8,-216.1,0.85,12.1,9.8,26,1],[-147.7,-116.4,-1.38,11.9,9.9,18,1],[192.9,-172.5,-0.81,19,6.2,22,1],[225.1,-371,-0.88,10.9,10.8,23,0],[-128.4,-240,-0.04,10.9,10.8,21,1],
        [21.1,-271.4,0.72,12,9.8,32,0],[-391.5,-93.4,-0.6,10.3,11.4,29,1],[-151.1,-205.3,0.8,8.8,13.3,29,1],[-221.4,-248.2,0.8,8.3,14.1,28,0],[-322.6,395.5,-1.33,14.4,8.1,14,2],[-391.8,-62.2,-0.43,9.2,12.6,20,1],
        [285,-355.4,-1.4,11.1,10.4,21,1],[-171,361.8,-1.57,8.7,13.2,17,2],[177.7,-315.4,0.59,8,14.2,43,0],[-11,-321.4,-0.85,10.2,11.1,17,1],[-413.6,261.9,-1.57,9.4,12,19,1],[-331.7,87.6,-1.49,15.1,7.4,25,0],
        [229.6,-183.7,0.66,11.1,10,21,0],[-325.4,-150.5,-0.74,10,11,45,0],[-268.6,-105.3,1.05,7.8,14,20,0],[14.4,-228.3,-0.66,11.1,9.8,14,1],[-281.9,-59.8,-0.81,14.7,7.4,25,1],[-24.7,-308.6,0.69,9.6,11.3,13,2],
        [258.1,-344.8,0.28,10.8,10,19,1],[152.8,-202.1,-0.7,8.5,12.7,31,0],[-351.8,-221.8,-0.64,9.9,10.9,48,0],[295.7,-351.4,0.28,10.3,10.4,17,1],[-254.7,466.5,-0.02,10.3,10.4,19,2],[-375.4,413.1,0.32,11.9,9,41,0],
        [-303.1,-132.5,1.43,10.9,9.8,18,1],[-342.7,-12.1,-0.72,10.9,9.8,16,1],[-301.3,-112.7,-0.14,7.6,14,14,1],[-258.3,-106.8,-0.32,7.6,14,19,2],[-373.9,442.8,0.64,10.3,10.3,47,0],[-317.2,280.2,0.24,8.8,12,27,1],
        [102.3,-303,0.74,7.9,13.3,31,0],[-294.1,-75,-0.45,7.5,14,16,2],[-59.1,-251.1,-0.47,14.7,7.1,24,0],[107.2,-229.9,-0.49,9.3,11.2,25,0],[43,-112.8,0.74,7.1,14.6,37,0],[-402.3,35.4,-0.11,7.2,14.3,18,0],
        [93.6,-108.3,-0.47,7.4,13.9,24,1],[149.7,-261.2,0.72,7.2,14.2,43,0],[-394.3,106.4,-1.39,10.3,9.9,30,0],[-155.6,449.3,1.41,8.7,11.6,12,2],[-304.5,462,-1.36,9.7,10.4,12,2],[-248,-108.1,0.07,7.2,14,14,2],
        [-416.2,330.7,-1.57,14.8,6.8,45,0],[31.9,-116.7,-0.75,6.8,14.6,23,1],[166.5,-110,-0.79,6.8,14.6,20,1],[-153.3,-91.9,0.01,10,9.9,47,0],[-138.5,330.5,0.79,8.9,11.1,39,0],[85.6,-288.4,0.93,7.2,13.7,20,0],
        [-146.7,-239.7,1.2,7.3,13.3,27,1],[173.3,-222.9,1.25,7.6,12.7,19,1],[-180.8,-155.5,-0.2,8.6,11.2,16,1],[187.9,-44.7,1.43,7.8,12.3,21,1],[-387.5,-5,0.89,6.9,13.9,45,0],[-21.3,-142,0.75,8.1,11.8,14,1],
        [-8.3,-152.7,-0.84,7.4,12.9,36,0],[-185,276.8,-0.1,8,11.8,43,0],[175.4,-215.1,-0.8,7.4,12.7,32,0],[-67.5,-90.4,0.14,8.7,10.8,27,1],[113.6,-396.5,0,15.4,6.1,33,0],[-387.1,-190.3,1.16,14,6.7,22,1],
        [-149.7,363.5,0.83,7.1,13.2,13,2],[-357.8,289.9,-1.13,7.3,12.8,24,0],[49.9,-298.9,0.69,6.8,13.7,24,1],[-392.1,130.7,-1.57,7.5,12.4,19,2],[160.9,-195.3,0.89,7.3,12.7,22,1],[138.1,-16,1.5,14.7,6.3,23,0],
        [96.2,-214.7,-0.06,8.2,11.2,47,0],[-275,-133.3,-0.14,19.5,4.7,23,0],[-29.6,-300.1,-0.93,8.1,11.3,17,2],[-113,-163.7,0.8,9.4,9.7,22,1],[-355.8,350,0.26,8.8,10.3,26,0],[136.1,-175.4,-1.4,7.3,12.4,20,0],
        [137.3,-192.8,0.87,7.3,12.4,37,0],[-407.4,188.6,-1.4,7.3,12.4,37,0],[53.6,-224.4,0.85,9.2,9.8,16,1],[-305.5,380.3,-1.36,7.5,11.9,13,2],[-335.1,-142.1,0.44,8,11,30,0],[161.8,-122.2,-0.79,6,14.6,31,0],
        [239.8,-177.9,0.34,8.7,10,24,1],[-329.8,67.6,0.05,7.5,11.5,21,0],[95.9,-227.3,0.06,7.7,11.2,21,1],[-196.8,290.5,-1.57,11.2,7.7,34,0],[-350.9,-174.2,-0.59,6.3,13.6,20,1],[-178.8,451.1,0.2,7.3,11.7,16,2],
        [173,-338.5,-0.89,6.8,12.5,23,0],[-295.7,312.5,-0.54,8.4,10.1,38,0],[-408.5,390.4,-0.87,8.2,10.3,15,1],[47.2,-269.4,0.7,12.4,6.7,40,0],[-306.4,307,0.7,8.2,10.1,30,0],[-81,-195.3,0.91,7.2,11.3,28,1],
        [207.3,-186.3,-0.72,13.1,6.2,30,1],[-73.6,-169.5,-0.91,6,13.5,30,0],[-394.6,417.3,-0.52,7.8,10.3,48,0],[110.5,-243.9,0.83,7.1,11.2,24,0],[-298.5,-101.9,1.44,7.6,10.4,18,2],[-124.7,413.6,1.33,6.8,11.6,18,2],
        [190.2,-357.3,-0.9,7.8,10.1,34,0],[282.9,-336.1,0.3,6.8,11.5,15,1],[-292.9,370.7,0.38,15.6,5,24,0],[-334.5,-178.8,1.17,7.1,10.9,27,1],[-340.9,297.7,0.19,7.5,10.3,30,0],[-385,210.8,-1.56,6.9,11.1,26,1],
        [-349.4,-81.5,-0.45,6.7,11.4,26,1],[-306.3,-157.2,0.09,10.6,7.2,33,0],[-373.1,433.7,-1.41,7.4,10.3,16,1],[88,-160.4,1.51,7.7,9.8,42,0],[-271.2,65.8,-1.57,9.7,7.7,25,1],[7.6,-284.6,-0.9,6.6,11.3,20,1],
        [-149,305.5,0.08,6.3,11.8,48,0],[148,-325.3,0.9,5.8,12.8,18,0],[-42.7,-287.9,0.67,6,12.3,28,0],[-310,417.4,0.31,6.2,11.9,17,2],[-328.6,-185.7,-0.55,6.7,10.9,27,0],[-286.5,336.5,-1.57,7.2,10.1,27,0],
        [-115.8,383,-0.27,6.9,10.5,47,0],[-126.6,-191,-0.55,7.3,9.7,26,1],[-380.2,9.2,-0.69,6.7,10.4,18,2],[-105.9,-182.6,0.49,7.1,9.7,37,0],[366.3,-375.7,-0.79,11.7,5.8,41,0],[-145.9,-125.8,-1.38,6.7,9.9,20,0],
        [65.1,-234.6,-0.83,5.9,11.2,28,1],[-210.8,458.5,-0.19,5.7,11.5,14,2],[-382.6,27.5,0.9,10.9,6,18,1],[-178.6,404.3,-0.14,6,10.5,16,2],[69.9,-330.3,0.72,6,10.4,18,1],[-358.1,-117.8,-0.64,9.3,6.6,29,1],
        [-106.3,417.9,1.32,7.6,7.8,27,1],[-327.5,30.8,-0.12,11.7,5,17,2],[251.5,-307.2,0.66,5.8,10,25,1],[68.1,-243.6,1.53,10.7,5.4,25,0],[-306.5,-29.2,-1.21,5.7,9.8,18,1],[342.7,-348.4,-0.94,6,8.9,35,0],
        [-265,375.8,-1.57,9.7,5.2,16,2],[-315.8,336.8,-1.57,6.7,7.5,19,1],[-380.3,420.8,-0.97,9.7,5.1,40,0],[147.5,-397.1,0,9.3,4.9,42,0],[-203.2,-89.7,0.69,6.8,5.5,18,0],[168.4,-326.1,0.9,5.8,6.1,15,1],
        [-332.4,112.6,-1.54,6.5,4.8,46,0],
      ],
      jardins: [
        [[-413.2,381.2],[-419.8,384.2],[-419.8,414.2],[-409.2,422.8],[-404.8,418.2],[-402.2,412.8],[-399.8,410.8],[-396.2,410.8],[-395.8,409.2],[-398.2,406.8],[-398.2,396.2],[-403.8,395.8],[-410.2,397.8],[-418.2,394.8],[-416.8,387.8],[-411.8,383.8]],
        [[-60.8,358.8],[-62.2,357.8],[-66.2,359.8],[-69.2,357.8],[-69.8,355.2],[-74.2,355.8],[-75.8,359.2],[-69.8,361.2],[-71.2,366.8],[-78.8,371.2],[-84.2,370.2],[-87.2,373.8],[-90.8,374.8],[-92.8,378.2],[-87.8,378.8],[-82.8,374.8],[-78.8,376.8],[-74.2,370.8],[-67.2,373.8],[-60.2,363.2]],
        [[-121.2,341.8],[-126.8,339.8],[-129.8,335.2],[-135.2,337.8],[-143.8,336.8],[-149.8,339.2],[-150.8,341.8],[-147.8,346.2],[-150.8,348.8],[-152.2,347.8],[-157.2,349.2],[-161.8,354.2],[-163.2,357.8],[-163.2,365.2],[-160.8,366.2],[-156.8,364.2],[-156.2,354.8],[-154.2,353.2],[-146.8,354.2],[-142.8,359.8],[-139.2,357.2],[-129.8,356.8],[-123.2,351.2],[-124.2,348.2],[-121.8,345.8]],
        [[-88.8,336.8],[-87.8,342.2],[-85.2,343.2],[-82.8,341.8],[-79.8,344.8],[-70.8,348.8],[-68.8,347.8],[-70.2,339.8],[-74.8,339.2],[-81.2,334.8]],
        [[-316.2,330.2],[-314.2,334.8],[-305.8,335.2],[-301.8,337.8],[-302.8,346.8],[-301.2,353.2],[-298.2,357.2],[-299.2,363.8],[-287.8,368.2],[-285.8,364.8],[-289.2,363.8],[-290.8,360.8],[-286.2,359.2],[-284.8,362.8],[-282.2,362.2],[-280.2,363.8],[-280.2,367.2],[-282.2,368.8],[-285.2,368.2],[-286.8,370.2],[-283.8,374.2],[-275.8,376.2],[-247.8,360.2],[-243.2,352.2],[-242.8,347.2],[-239.2,346.2],[-234.8,348.8],[-229.2,344.2],[-232.2,340.8],[-242.8,342.2],[-246.2,339.2],[-261.8,340.2],[-268.8,345.2],[-269.8,348.8],[-267.2,352.8],[-271.8,354.2],[-277.2,350.8],[-278.8,344.8],[-285.8,341.8],[-292.2,343.2],[-293.8,341.2],[-293.2,333.2],[-312.8,328.8]],
        [[-335.8,325.2],[-334.2,330.8],[-329.2,336.2],[-329.2,342.8],[-325.2,347.2],[-314.8,351.2],[-306.8,347.8],[-311.8,343.8],[-323.2,340.2],[-322.8,335.8],[-325.2,327.8],[-333.2,324.2]],
        [[-132.8,319.2],[-133.2,326.8],[-131.8,327.8],[-126.2,325.8],[-120.2,327.8],[-107.2,327.8],[-102.2,325.8],[-92.8,327.8],[-87.8,326.8],[-96.8,319.2],[-102.8,322.8],[-109.8,320.8],[-125.2,321.2],[-130.2,318.2]],
        [[-295.8,318.2],[-286.2,327.8],[-278.2,327.2],[-267.2,329.2],[-264.8,328.2],[-265.8,326.2],[-275.2,321.8],[-278.2,323.2],[-283.2,322.2],[-283.8,318.8],[-288.8,315.2]],
        [[-269.2,314.2],[-268.2,319.8],[-263.8,320.8],[-263.8,317.8],[-261.2,316.2],[-258.2,318.2],[-260.2,320.8],[-258.8,322.8],[-253.2,323.8],[-247.2,327.2],[-241.8,324.8],[-237.8,328.8],[-231.8,330.8],[-218.8,330.8],[-215.2,322.2],[-216.2,317.2],[-220.2,315.8],[-226.8,316.8],[-257.2,313.8]],
        [[-280.8,-67.8],[-283.8,-70.8],[-285.8,-70.8],[-288.2,-67.8],[-292.2,-66.2],[-294.8,-61.2],[-298.2,-61.2],[-303.2,-57.8],[-303.8,-54.8],[-301.8,-53.2],[-298.2,-53.8],[-296.2,-56.2],[-291.2,-57.8],[-288.2,-62.2],[-284.8,-62.8]],
        [[139.8,-93.2],[138.8,-89.2],[143.2,-86.2],[142.8,-81.2],[156.2,-78.2],[158.2,-79.2],[157.2,-85.2],[152.2,-86.2],[148.8,-84.8],[144.2,-86.8],[148.8,-91.2],[150.2,-98.2],[146.2,-97.8]],
        [[186.2,-128.8],[184.2,-127.8],[184.2,-123.8],[178.2,-117.8],[175.2,-109.2],[177.2,-104.8],[183.2,-106.2],[189.8,-114.2],[190.2,-117.8],[186.2,-121.2],[188.2,-125.2]],
        [[-299.8,-159.8],[-299.2,-155.2],[-285.2,-153.2],[-275.8,-145.2],[-278.8,-139.8],[-277.8,-134.8],[-271.8,-136.8],[-264.8,-136.8],[-265.2,-138.2],[-272.2,-140.8],[-274.2,-143.8],[-271.8,-145.2],[-263.8,-143.8],[-262.8,-151.8],[-264.2,-153.2],[-287.8,-158.8],[-292.8,-157.8],[-297.8,-160.8]],
        [[-298.2,-165.2],[-307.2,-172.8],[-312.8,-168.8],[-323.2,-171.8],[-324.8,-170.8],[-323.2,-166.2],[-320.2,-163.2],[-320.2,-159.8],[-316.8,-157.2],[-311.8,-158.8],[-306.8,-163.2],[-300.8,-161.2]],
        [[-112.8,-214.8],[-117.2,-215.8],[-123.2,-213.8],[-124.8,-207.2],[-121.2,-200.2],[-122.2,-194.2],[-117.2,-189.8],[-122.2,-186.2],[-125.8,-185.8],[-127.8,-179.2],[-125.8,-176.2],[-121.8,-179.8],[-113.8,-181.2],[-111.8,-183.2],[-111.8,-188.8],[-109.8,-190.2],[-105.2,-190.8],[-101.2,-187.2],[-95.2,-189.8],[-95.2,-192.8],[-102.8,-197.8],[-104.8,-203.8],[-110.8,-205.8],[-109.2,-211.2]],
        [[193.2,-213.8],[191.2,-209.8],[198.2,-201.8],[203.8,-201.8],[208.2,-204.8],[198.8,-215.8]],
        [[215.2,-255.8],[209.2,-257.8],[177.8,-231.2],[181.2,-227.8],[181.8,-222.2],[183.2,-220.8],[187.2,-220.2],[196.2,-228.2],[196.2,-229.8],[191.8,-232.8],[193.2,-238.8],[195.8,-240.8],[200.8,-238.8],[197.2,-233.8],[197.8,-232.2],[205.8,-232.2],[210.8,-230.2],[212.8,-231.2],[215.8,-229.2],[217.2,-225.8],[219.8,-226.2],[215.8,-240.8]],
        [[10.8,-273.2],[4.8,-267.2],[10.8,-265.8],[10.2,-258.8],[16.2,-253.8],[16.2,-252.2],[9.2,-246.8],[5.2,-248.2],[-0.2,-245.2],[4.2,-238.2],[3.8,-234.2],[7.2,-230.2],[20.8,-244.2],[20.8,-247.8],[22.2,-249.2],[28.8,-246.8],[31.8,-248.2],[30.2,-251.2],[25.2,-254.2],[25.2,-262.2],[13.2,-268.2]],
        [[31.2,-292.2],[29.2,-284.2],[34.8,-279.8],[40.2,-281.8],[50.2,-275.2],[54.2,-277.2],[56.2,-275.8],[55.2,-273.2],[51.8,-271.8],[50.2,-264.8],[55.8,-260.2],[68.8,-253.8],[72.2,-249.8],[72.2,-239.2],[86.2,-229.8],[91.8,-235.8],[99.2,-234.8],[106.8,-238.2],[102.2,-242.2],[98.2,-240.8],[95.2,-243.2],[97.2,-252.2],[105.2,-252.2],[109.2,-248.2],[112.8,-255.8],[117.2,-254.8],[121.2,-256.2],[118.8,-261.2],[113.8,-257.8],[108.8,-260.8],[107.2,-265.2],[111.2,-269.2],[103.2,-276.8],[101.8,-274.2],[105.8,-268.8],[104.8,-266.2],[92.2,-267.8],[86.8,-260.2],[83.8,-260.2],[79.8,-265.8],[90.2,-269.2],[89.8,-276.2],[80.8,-280.8],[76.2,-278.2],[75.2,-280.8],[78.8,-284.2],[77.2,-286.2],[70.8,-284.2],[67.2,-284.8],[66.2,-287.8],[69.8,-296.2],[61.8,-300.8],[54.8,-298.2],[51.8,-295.2],[51.2,-289.8],[48.8,-287.2],[44.8,-290.2],[42.2,-294.8],[39.8,-291.2],[39.8,-288.2],[36.8,-285.8],[34.2,-287.8],[34.2,-292.2]],
        [[375.8,-399.8],[361.2,-399.8],[362.2,-395.2],[360.8,-387.2],[356.8,-383.2],[356.2,-380.8],[352.2,-378.8],[349.2,-374.8],[346.2,-375.2],[341.2,-372.8],[341.2,-369.2],[338.8,-366.8],[336.2,-358.8],[331.8,-356.2],[329.2,-349.8],[322.8,-343.2],[324.2,-339.8],[327.8,-338.2],[338.8,-346.8],[336.8,-349.8],[337.2,-356.8],[341.8,-359.8],[345.8,-359.2],[358.8,-372.2],[359.2,-376.2],[372.2,-386.2],[372.8,-389.2],[377.2,-393.2]],
      ],
    },
    roadWidenings: [
      { side: 1, points: [[0.4214,0],[0.4267,2.2752],[0.4328,9.451],[0.4343,10.1076],[0.4393,5.5556],[0.4482,0]], followContour: true },
      { side: 1, points: [[0.3689,0],[0.3765,0],[0.3917,0],[0.3994,0]] },
      { side: -1, points: [[0.3302,0],[0.3378,4.4444],[0.353,4.4444],[0.3606,0]], followContour: true },
      { side: 1, points: [[0.618,0],[0.6257,4.7489],[0.6348,14.6511],[0.6401,5.0358],[0.6489,3.1845],[0.654,0]], followContour: true },
      { side: -1, points: [[0.3939,0],[0.3999,5],[0.4118,5],[0.4178,0]] },
      { side: 1, points: [[0.3939,0],[0.3999,-2.2222],[0.4118,-2.2222],[0.4178,0]] },
      { side: -1, points: [[0.3654,0],[0.3765,6.6667],[0.3917,6.6667],[0.3994,0]], followContour: false },
      { side: 1, points: [[0.3239,0],[0.3405,7.2222],[0.3503,7.2222],[0.3552,0]], followContour: true },
      { side: -1, points: [[0.8604,0],[0.8707,4.5808],[0.8869,3.8517],[0.8951,0]], followContour: true },
      { side: 1, points: [[0.8819,0],[0.8957,4.241],[0.9047,10.1171],[0.9363,0]], followContour: true },
      { side: 1, points: [[0.0468,0],[0.0555,3.3333],[0.0662,6.9801],[0.0816,0]], followContour: true },
      { side: -1, points: [[0.0467,0],[0.0556,-1.0734],[0.0638,-0.5746],[0.0815,0]], followContour: true },
      { side: -1, points: [[0.621,0],[0.6297,3.3333],[0.6342,-8.9238],[0.6412,-3.0725],[0.6461,-0.5621],[0.6558,0]], followContour: true },
      { side: -1, points: [[0.6989,0],[0.7157,5.132],[0.725,3.3333],[0.7337,0]], followContour: true },
    ],
    asphaltPads: [
      { side: -1, pts: [[72.88,-44.65],[111.06,-59.27],[12.33,-51.53],[-1.74,-53.23],[-16.5,-53.52],[-28.77,-51.53],[-45.93,-50.93],[-66.08,-52.03],[-91.72,-54.02],[-224.2,-63.1],[-243.16,-48.74]] },
      { side: 1, pts: [[-97.43,-33.5],[-81.37,-20.13],[-62.22,-12.95],[-39.47,-9.45],[-14.13,-12.85],[7.52,-16.54],[58.99,-25.62],[57.4,-32.5]], free: true, surface: 'asphalt' },
      { side: 1, pts: [[-300.5,271.53],[-302.47,278.99],[-309.51,267.16],[-310.64,251.94],[-312.05,231.94],[-313.03,214.33],[-318.25,192.22],[-319.23,124.04],[-310.64,117.42]], free: true, surface: 'asphalt' },
      { side: 1, pts: [[-266.16,301.51],[-319.58,124.36],[-311.02,47.29],[-300.6,-0.39],[-286.95,-32.33],[-278.15,-55.71],[-270.98,-61.03],[-230.02,-69.74]], free: true, surface: 'asphalt' },
    ],
    objets: {
      retires: [
        [-343.44,104.52],
        [-338.02,168.23],
        [-337.82,198.81],
        [-331.76,239.46],
      ],
      ajouts: [
        { k: 'bati', type: 'hangar', x: -335.8, y: 100.7, a: -1.487, l: 22.208, w: 27.923, side: 1, portes: 2, teinte: 0.433, architecture: 'immeubles', height: 22.217, i: 1 },
        { k: 'bati', type: 'hangar', x: -320.07, y: 166.9, a: -1.611, l: 20.485, w: 18.839, side: 1, portes: 2, teinte: 0.423, architecture: 'immeubles', height: 45.547, i: 2 },
        { k: 'bati', type: 'hangar', x: -320.87, y: 196.31, a: -1.617, l: 21.158, w: 26.217, side: 1, portes: 2, teinte: 0.59, architecture: 'immeubles', height: 30.847, i: 3 },
        { k: 'bati', type: 'hangar', x: -315.14, y: 232.15, a: -1.777, l: 25.081, w: 22.993, side: 1, portes: 3, teinte: 0.439, architecture: 'immeubles', height: 25.179, i: 4 },
      ],
    },
    lines: {
      racing: [
        [-99.192,21.407],
        [-98.132,14.926],
        [-96.726,8.499],
        [-94.936,2.108],
        [-92.749,-4.112],
        [-90.106,-10.193],
        [-87.348,-16.032],
        [-83.997,-21.722],
        [-79.354,-24.872],
        [-72.728,-24.794],
        [-66.269,-24.108],
        [-59.785,-23.504],
        [-53.314,-23.094],
        [-46.763,-22.808],
        [-40.198,-22.602],
        [-33.979,-22.472],
        [-27.5,-22.366],
        [-20.882,-22.318],
        [-14.595,-22.609],
        [-8.024,-23.191],
        [-1.479,-23.781],
        [4.891,-24.297],
        [11.467,-24.897],
        [17.754,-24.823],
        [24.108,-25.022],
        [30.179,-26.374],
        [35.68,-29.436],
        [39.316,-34.097],
        [40.562,-40.211],
        [40.176,-46.648],
        [37.443,-52.413],
        [35.056,-58.163],
        [36.018,-63.694],
        [39.855,-69.039],
        [44.578,-73.616],
        [49.565,-77.851],
        [54.707,-81.956],
        [60.019,-85.796],
        [65.563,-89.377],
        [71.196,-93.568],
        [74.911,-93.544],
        [76.873,-86.182],
        [76.816,-79.639],
        [78.196,-71.068],
        [83.196,-67.282],
        [83.363,-73.235],
        [80.649,-78.973],
        [83.077,-85.544],
        [86.435,-86.758],
        [92.403,-87.426],
        [99.268,-87.211],
        [100.141,-82.884],
        [98.292,-76.449],
        [96.196,-70.449],
        [94.411,-64.021],
        [91.626,-58.098],
        [88.35,-52.407],
        [84.632,-47.018],
        [80.499,-41.98],
        [75.982,-37.319],
        [71.11,-33.04],
        [65.926,-29.165],
        [60.441,-25.714],
        [54.726,-22.739],
        [48.797,-20.197],
        [42.67,-18.078],
        [36.384,-16.332],
        [29.98,-14.924],
        [23.65,-13.846],
        [17.131,-13.256],
        [10.653,-12.852],
        [4.118,-12.622],
        [-1.772,-12.283],
        [-6.958,-10.346],
        [-8.976,-9.438],
        [-9.944,-7.421],
        [-11.054,-7.925],
        [-13.455,-8.228],
        [-25.239,-11.718],
        [-30.005,-12.5],
        [-36.455,-13.787],
        [-42.915,-14.99],
        [-49.404,-15.975],
        [-55.915,-16.661],
        [-62.461,-17.016],
        [-69.065,-16.637],
        [-74.336,-14.285],
        [-78.601,-9.245],
        [-81.787,-3.499],
        [-83.973,2.724],
        [-85.124,9.176],
        [-84.484,15.228],
        [-81.727,21.064],
        [-80.706,27.267],
        [-81.363,33.845],
        [-82.093,40.442],
        [-82.272,45.127],
        [-83.253,48.996],
        [-84.082,51.582],
        [-87.367,54.889],
        [-88.426,62.88],
        [-86.842,69.232],
        [-84.416,75.18],
        [-81.507,80.848],
        [-78.16,86.596],
        [-74.84,90.458],
        [-81.095,93.687],
        [-87.653,93.949],
        [-92.971,92.105],
        [-95.592,86.554],
        [-97.603,80.469],
        [-98.93,73.993],
        [-99.738,67.442],
        [-100.33,60.781],
        [-100.696,54.261],
        [-100.849,47.698],
        [-100.781,41.114],
        [-100.498,34.503],
        [-99.976,27.963],
      ],
      inside: [
        [-97.49,21.666],
        [-96.383,15.22],
        [-95.203,8.795],
        [-93.584,2.552],
        [-91.451,-3.581],
        [-88.721,-9.43],
        [-85.689,-15.324],
        [-82.91,-21.278],
        [-79.542,-23.437],
        [-72.972,-23.331],
        [-66.298,-23.84],
        [-59.783,-23.535],
        [-53.31,-22.834],
        [-46.726,-21.963],
        [-40.177,-21.99],
        [-33.975,-22.139],
        [-27.468,-22.605],
        [-20.822,-22.698],
        [-14.66,-22.922],
        [-8.061,-23.37],
        [-1.465,-23.705],
        [4.892,-24.131],
        [11.466,-24.916],
        [17.814,-25.106],
        [24.105,-25.058],
        [30.134,-26.48],
        [35.59,-29.551],
        [39.29,-34.106],
        [40.265,-40.213],
        [39.803,-46.586],
        [37.529,-52.471],
        [35.066,-58.165],
        [36.302,-63.477],
        [40.738,-67.986],
        [45.715,-72.242],
        [50.719,-76.482],
        [55.811,-80.575],
        [60.938,-84.667],
        [66.18,-88.688],
        [71.551,-91.836],
        [74.027,-90.779],
        [75.248,-86.313],
        [77.579,-79.89],
        [80.316,-73.855],
        [82.061,-69.339],
        [83.469,-72.394],
        [82.435,-78.925],
        [82.387,-83.616],
        [86.196,-85.401],
        [92.551,-86.561],
        [98.283,-85.981],
        [98.932,-83.343],
        [96.993,-77.141],
        [95.194,-70.715],
        [93.131,-64.546],
        [90.606,-58.577],
        [87.592,-52.843],
        [84.087,-47.384],
        [80.139,-42.278],
        [75.775,-37.53],
        [71.01,-33.159],
        [65.889,-29.218],
        [60.429,-25.734],
        [54.726,-22.741],
        [48.779,-20.247],
        [42.621,-18.26],
        [36.296,-16.721],
        [29.902,-15.259],
        [23.645,-13.908],
        [17.12,-13.393],
        [10.653,-12.807],
        [4.074,-12.048],
        [-2.292,-11.849],
        [-8.198,-10.987],
        [-11.661,-8.302],
        [-17.469,-9.546],
        [-23.596,-11.456],
        [-30.062,-11.987],
        [-36.566,-12.792],
        [-43.07,-13.583],
        [-49.575,-14.343],
        [-56.108,-14.861],
        [-62.628,-15.571],
        [-69.092,-15.938],
        [-73.421,-13.613],
        [-77.325,-8.504],
        [-80.656,-2.907],
        [-83.114,3.012],
        [-84.541,9.301],
        [-84.398,15.184],
        [-81.517,20.958],
        [-82.09,27.187],
        [-82.413,33.727],
        [-82.845,40.265],
        [-83.046,46.852],
        [-85.168,52.261],
        [-87.918,56.334],
        [-87.471,62.782],
        [-86.297,69.107],
        [-84.352,75.151],
        [-81.853,81.101],
        [-78.365,86.799],
        [-77.26,90.544],
        [-81.228,92.323],
        [-87.246,92.848],
        [-92.167,91.289],
        [-92.95,86.362],
        [-95.038,79.795],
        [-96.932,73.551],
        [-98.268,67.155],
        [-98.628,60.758],
        [-98.926,54.194],
        [-99.133,47.654],
        [-99.223,41.129],
        [-98.867,34.65],
        [-98.306,28.128],
      ],
      outside: [
        [-99.271,21.395],
        [-98.16,14.921],
        [-96.972,8.451],
        [-95.295,1.99],
        [-93.119,-4.263],
        [-90.326,-10.314],
        [-87.641,-16.157],
        [-85.386,-22.291],
        [-79.135,-26.553],
        [-72.669,-25.148],
        [-66.378,-23.075],
        [-59.976,-23.125],
        [-53.304,-22.457],
        [-46.794,-23.51],
        [-40.239,-23.79],
        [-33.996,-23.817],
        [-27.475,-22.551],
        [-21.089,-21.013],
        [-14.306,-21.212],
        [-8.007,-23.106],
        [-1.748,-25.279],
        [4.886,-25.917],
        [11.423,-25.609],
        [17.534,-23.786],
        [24.265,-23.264],
        [30.842,-24.823],
        [36.699,-28.132],
        [40.986,-33.499],
        [42.066,-40.198],
        [41.134,-46.808],
        [36.955,-52.081],
        [33.322,-57.781],
        [34.869,-64.568],
        [39.58,-69.367],
        [44.566,-73.63],
        [49.558,-77.859],
        [54.686,-81.983],
        [59.795,-86.07],
        [64.712,-90.325],
        [69.782,-95.009],
        [77.881,-93.486],
        [78.199,-86.075],
        [77.047,-79.706],
        [77.763,-73.121],
        [81.358,-66.032],
        [87.387,-70.044],
        [81.734,-78.839],
        [79.906,-84.905],
        [85.901,-87.531],
        [92.203,-88.601],
        [99.413,-89.017],
        [102.176,-82.112],
        [99.029,-76.228],
        [96.863,-70.213],
        [94.793,-63.93],
        [92.236,-57.811],
        [89.154,-51.944],
        [85.583,-46.38],
        [81.527,-41.13],
        [77.04,-36.248],
        [72.165,-31.776],
        [66.923,-27.742],
        [61.357,-24.19],
        [55.49,-21.109],
        [49.382,-18.55],
        [43.092,-16.521],
        [36.695,-14.964],
        [30.312,-13.505],
        [23.8,-12.113],
        [17.262,-11.608],
        [10.655,-12.01],
        [4.019,-11.823],
        [-3.335,-11.08],
        [-5.995,-10.063],
        [-11.939,-5.758],
        [-18.559,-8.213],
        [-23.466,-12.06],
        [-29.865,-13.763],
        [-36.367,-14.583],
        [-42.873,-15.374],
        [-49.387,-16.135],
        [-55.916,-16.648],
        [-62.425,-17.325],
        [-69.006,-18.168],
        [-75.754,-15.326],
        [-79.267,-9.632],
        [-82.273,-3.754],
        [-84.822,2.439],
        [-86.303,8.923],
        [-85.723,15.866],
        [-81.086,20.739],
        [-80.321,27.289],
        [-80.615,33.841],
        [-81.049,40.38],
        [-81.863,46.863],
        [-85.423,51.4],
        [-89.712,56.352],
        [-89.263,62.966],
        [-88.052,69.511],
        [-85.911,75.844],
        [-81.896,81.133],
        [-76.699,85.148],
        [-73.927,91.876],
        [-80.661,95.411],
        [-87.556,95.925],
        [-94.87,94.034],
        [-97.147,86.667],
        [-98.108,80.601],
        [-98.972,74.002],
        [-100.064,67.506],
        [-100.429,60.782],
        [-100.726,54.262],
        [-100.934,47.7],
        [-101.025,41.112],
        [-100.662,34.488],
        [-100.099,27.951],
      ],
    },
  },
  {
    id: 'silverstone', name: 'Royal Air Base', country: 'GB', flag: '🇬🇧', theme: 'autumn',
    architecture: 'graphique',
    barriers: true,   // protections dessinées et collisions : voir docs/spa-barrieres/README.md
    kerb: DRAPEAUX.gb,
    length: 3300, width: 16, puddles: 0.4,
    pts: TRACES.silverstone,
    barrierPaths: [
      {side:-1,from:.6261,to:.6477,pts:[[-22.6,-269.2],[-17.8,-266.3],[-16.3,-265.4],[-13.3,-263.6],[-10.4,-261.9],[-7.5,-260.3],[-4.3,-258.9],[-0.9,-257.5],[2.8,-256.1],[6.8,-254.9],[11.1,-253.8],[15.4,-252.9],[19.7,-252.6],[23.9,-252.5],[28.0,-252.8],[32.1,-253.5],[36.1,-254.6],[39.8,-255.7],[43.3,-257.1],[46.8,-258.5],[49.9,-259.9],[53.0,-261.4],[54.5,-262.1],[59.4,-264.4]]}, // Becketts — extérieur
      {side:1,from:.9226,to:.9611,pts:[[256.7,281.4],[260.6,287.2],[261.5,288.8],[263.4,292.2],[264.7,295.6],[265.3,298.8],[265.3,302.0],[264.7,305.2],[263.4,308.4],[261.4,311.2],[259.0,313.9],[256.5,316.2],[253.6,318.4],[250.7,320.4],[247.9,322.2],[245.0,323.9],[242.1,325.6],[239.2,327.0],[236.4,328.4],[233.5,329.8],[230.4,331.2],[227.2,332.6],[223.8,334.0],[220.1,335.4],[216.1,336.9],[212.1,338.3],[207.9,339.7],[203.5,341.1],[199.3,342.3],[195.3,343.4],[191.4,344.4],[187.7,345.3],[184.0,346.0],[180.5,346.7],[176.8,347.3],[173.0,347.8],[169.0,348.1],[165.0,348.2],[161.0,348.0],[157.3,347.5],[153.8,346.7],[150.6,345.6],[147.6,344.0],[144.7,342.0],[141.9,339.7],[139.2,337.0],[136.7,334.2],[135.4,332.7],[132.5,328.7]]}, // Club — extérieur
    ],
    /* Les deux passerelles de la Wellington Straight — deux ouvrages distincts, à dix mètres l'un
       de l'autre — et la passerelle couverte du complexe des stands. */
    passerelles: [0.2163, 0.2179, 0.9639],
    lines: {
      racing: [[-3.871, 24.769], [-4.444, 15.779], [0.331, -0.876], [-2.16, -12.232], [-8.131, -27.5], [-8.16, -34.81], [6.807, -39.013], [-7.44, -49.518], [-19.959, -47.383], [-32.812, -39.634], [-45.271, -31.335], [-57.544, -23.151], [-69.908, -14.687], [-82.259, -1.267], [-77.999, 6.705], [-67.753, 13.757], [-74.258, 21.787], [-90.969, 9.354], [-97.612, -3.672], [-99.45, -17.854], [-98.429, -32.841], [-96.08, -47.644], [-91.694, -62.064], [-85.081, -69.557], [-66.75, -72.703], [-51.727, -71.071], [-37.01, -68.147], [-25.618, -66.234], [-13.386, -66.896], [3.221, -60.046], [20.577, -60.651], [28.348, -46.49], [35.165, -38.168], [45.852, -27.673], [57.345, -18.068], [68.791, -8.736], [80.084, 1.114], [90.643, 11.881], [99.189, 26.29], [94.724, 36.507], [80.826, 41.976], [67.233, 47.239], [52.159, 55.619], [52.418, 65.866], [38.2, 71.507], [26.374, 64.368], [16.796, 52.86], [7.578, 41.342]],
      inside: [[-4.196, 24.995], [-4.148, 15.852], [-1.169, 1.196], [-2.416, -12.113], [-8.87, -32.39], [-4.371, -35.524], [6.247, -39.256], [-8.38, -49.085], [-19.299, -46.312], [-31.535, -37.708], [-44.003, -29.423], [-56.269, -21.225], [-68.672, -12.861], [-79.905, -3.882], [-82.058, 5.784], [-71.092, 15.858], [-82.374, 15.225], [-90.123, 8.405], [-97.516, -3.706], [-98.404, -17.711], [-96.179, -32.502], [-93.832, -47.272], [-90.983, -62.78], [-83.845, -69.343], [-66.768, -71.776], [-40.959, -67.127], [-36.922, -68.559], [-20.639, -65.975], [-15.17, -66.983], [4.587, -59.855], [18.491, -60.27], [26.988, -50.068], [35.657, -38.7], [45.614, -27.404], [56.358, -16.966], [67.417, -7.202], [78.53, 2.812], [89.012, 13.373], [97.751, 24.989], [94.626, 36.365], [81.453, 42.607], [67.825, 48.29], [53.022, 55.878], [53.253, 68.773], [42.143, 70.269], [29.364, 65.664], [18.6, 51.416], [9.383, 39.897]],
      outside: [[-1.678, 29.568], [-6.392, 15.297], [-1.341, 1.136], [-1.353, -12.604], [-10.491, -30.215], [-6.759, -36.356], [8.294, -37.721], [-5.517, -50.084], [-20.313, -47.957], [-32.813, -39.635], [-45.281, -31.35], [-57.545, -23.153], [-80.705, -5.959], [-80.532, -1.152], [-72.214, 6.734], [-64.443, 16.002], [-80.23, 19.816], [-91.661, 10.131], [-99.699, -2.944], [-100.695, -18.024], [-98.465, -32.846], [-96.113, -47.65], [-92.867, -62.313], [-85.273, -71.092], [-66.745, -72.961], [-51.983, -71.156], [-39.175, -68.796], [-16.149, -68.969], [-12.781, -68.076], [3.193, -59.701], [18.821, -63.299], [25.959, -55.067], [34.445, -37.387], [45.869, -27.692], [57.9, -18.689], [68.96, -8.924], [80.092, 1.106], [90.718, 11.812], [99.533, 24.139], [95.948, 38.262], [81.562, 42.934], [64.334, 48.568], [50.979, 55.993], [51.785, 65.75], [38.742, 72.107], [26.081, 64.602], [16.795, 52.86], [7.578, 41.342]],
    },
    panneaux: [
      [0.0118, 100, 3, 1],
      [0.027, 50, 3, 1],
      [0.0421, 0, 3, 1],
      [0.06, 50, 4, -1],
      [0.0752, 0, 4, -1],
      [0.093, 100, 1, 1],
      [0.1082, 50, 1, 1],
      [0.1233, 0, 1, 1],
      [0.1485, 0, 'acute', -1],
      [0.1697, 50, 4, -1],
      [0.1848, 0, 4, -1],
      [0.2388, 200, 2, -1],
      [0.2691, 100, 2, -1],
      [0.2842, 50, 2, -1],
      [0.2994, 0, 2, -1],
      [0.3124, 50, 'hairpin', 1],
      [0.3324, 0, 'hairpin', 1],
      [0.3603, 100, 5, 1],
      [0.3755, 50, 5, 1],
      [0.3906, 0, 5, 1],
      [0.4318, 200, 4, 1],
      [0.4621, 100, 4, 1],
      [0.4773, 50, 4, 1],
      [0.4924, 0, 4, 1],
      [0.5264, 200, 5, -1],
      [0.5567, 100, 'chicane', -1],
      [0.5718, 50, 'chicane', -1],
      [0.587, 0, 'chicane', -1],
      [0.6118, 50, 4, -1],
      [0.627, 0, 4, -1],
      [0.65, 0, 2, 1],
      [0.6706, 50, 5, -1],
      [0.6858, 0, 5, -1],
      [0.7609, 200, 3, 1],
      [0.7912, 100, 3, 1],
      [0.8064, 50, 3, 1],
      [0.8215, 0, 3, 1],
      [0.85, 200, 'square', -1],
      [0.8803, 100, 'square', -1],
      [0.8955, 50, 'square', -1],
      [0.9106, 0, 'square', -1],
      [0.9218, 0, 'square', 1],
      [0.9382, 50, 4, 1],
      [0.9533, 0, 4, 1],
      [0.9815, 200, 3, 1],
      [0.1309, 50, 'acute', 1],
    ],
    /* Silverstone est un aérodrome, et cela se voit d'en haut avant tout le reste : de l'herbe rase
       à perte de vue, presque pas d'arbre, et des tribunes posées dessus. Les zones `nu` effacent
       le semis par défaut — un bosquet au milieu du terrain trahirait le lieu plus sûrement qu'une
       couleur fausse. Relevé sur `Silverstone.jpg` : le gris clair des dégagements bitumés couvre
       la quasi-totalité du tour, le beige du gravier ne reste qu'à Abbey, Copse, Stowe et Club. */
    runoffs: [
      { name: 'Abbey', surface: 'gravel', side: 1, from: 0.036, to: 0.064, w: 15 },
      { name: 'Farm', surface: 'asphalt', side: -1, from: 0.07, to: 0.098, w: 12 },
      { name: 'Village / The Loop', surface: 'asphalt', side: 1, from: 0.118, to: 0.148, w: 14 },
      { name: 'Aintree', surface: 'asphalt', side: -1, from: 0.146, to: 0.2, w: 13 },
      { name: 'Brooklands', surface: 'gravel', side: -1, from: 0.294, to: 0.33, w: 15 },
      { name: 'Luffield', surface: 'asphalt', side: 1, from: 0.328, to: 0.372, w: 13 },
      { name: 'Woodcote', surface: 'asphalt', side: 1, from: 0.39, to: 0.43, w: 12 },
      { name: 'Copse', surface: 'gravel', side: 1, from: 0.486, to: 0.518, w: 17 },
      { name: 'Maggotts / Becketts', surface: 'asphalt', side: 1, from: 0.58, to: 0.62, w: 14 },
      { name: 'Chapel', surface: 'asphalt', side: -1, from: 0.675, to: 0.7, w: 13 },
      { name: 'Stowe', surface: 'gravel', side: 1, from: 0.812, to: 0.866, w: 18 },
      { name: 'Vale', surface: 'asphalt', side: -1, from: 0.858, to: 0.888, w: 12 },
      // Reprise 0.40 (silverstone-tour_reprise.png) : contours rouges en gravier ; les croix de
      // Club retirent le bac intérieur.
      { name: 'Club — intérieur supprimé', surface: 'grass', side: -1, points: [[.904,0],[.968,0]] },
      { name: 'Club — extérieur', surface: 'gravel', side: 1,
        points: [[.9197,0],[.9242,13],[.9272,13],[.9302,10.6],[.9332,8.4],[.9362,7.7],[.9392,7.6],[.9422,7.6],[.9452,8.6],[.9482,10],[.9512,11.4],[.9542,12.6],[.9572,12.6],[.9602,10.8],[.9642,0]] },
      { name: 'Becketts — extérieur', surface: 'gravel', side: -1,
        points: [[.6231,0],[.6276,8.9],[.6306,9.7],[.6336,10.4],[.6366,11.1],[.6396,11.1],[.6426,10.5],[.6456,10],[.6486,9.5],[.6509,0]] },
    ],
    implantation: [
      { kind: 'nu', side: 1, from: 0.19, to: 0.29, prof: 140 },
      { kind: 'nu', side: -1, from: 0.43, to: 0.49, prof: 140 },
      { kind: 'nu', side: 1, from: 0.7, to: 0.81, prof: 140 },
      { kind: 'stands', side: -1, from: 0.955, to: 0.04, recul: 12, prof: 24, module: 44 },
      { kind: 'tribune', side: 1, from: 0.96, to: 0.045, recul: 11, prof: 18, module: 34 },
      { kind: 'tribune', side: -1, from: 0.12, to: 0.2, recul: 14, prof: 15, module: 28 },
      { kind: 'parking', side: -1, from: 0.205, to: 0.28, recul: 22, prof: 46 },
      { kind: 'tribune', side: 1, from: 0.3, to: 0.37, recul: 13, prof: 16, module: 30 },
      { kind: 'hangars', side: -1, from: 0.33, to: 0.42, recul: 20, prof: 26, module: 28 },
      { kind: 'bois', side: -1, from: 0.055, to: 0.105, recul: 16, prof: 34, densite: 0.55 },
      { kind: 'bois', side: 1, from: 0.6, to: 0.69, recul: 18, prof: 30, densite: 0.5 },
      { kind: 'tribune', side: 1, from: 0.815, to: 0.87, recul: 14, prof: 16, module: 28 },
      { kind: 'tribune', side: -1, from: 0.905, to: 0.955, recul: 13, prof: 16, module: 28 },
      { kind: 'parking', side: 1, from: 0.88, to: 0.945, recul: 20, prof: 40 },
      // Camping-cars garés en long derrière la protection, hors des parkings.
      { kind: 'camping', side: -1, from: 0.67, to: 0.83, recul: 2.5 },
      { kind: 'camping', side: 1, from: 0.375, to: 0.495, recul: 2.5 },
    ],
  },
  {
    id: 'suzuka', name: 'Fuji Yama', country: 'JP', flag: '🇯🇵', theme: 'japan',
    parallelClearance: true,
    architecture: 'graphique',
    barriers: true,   // protections dessinées et collisions : voir docs/spa-barrieres/README.md
    kerb: DRAPEAUX.jp,
    length: 3300, width: 14,
    pts: TRACES.suzuka,
    barrierPaths: [
      {side:-1,from:.3053,to:.3386,pts:[[-4.1,-28.7],[-0.7,-31.6],[0.8,-32.9],[3.3,-35.5],[6.1,-38.4],[8.7,-41.8],[10.9,-45.2],[12.9,-48.7],[14.7,-52.2],[16.4,-56.0],[18.0,-59.6],[19.5,-63.2],[21.0,-66.7],[22.6,-70.1],[24.4,-73.4],[26.4,-76.6],[28.9,-79.7],[31.7,-82.4],[34.8,-84.6],[38.0,-86.1],[41.2,-87.0],[42.7,-87.3],[47.5,-87.4]]}, // Degner — intérieur
      {side:-1,from:.8112,to:.8983,pts:[[41.2,90.8],[41.7,96.0],[42.0,97.8],[42.4,101.3],[42.7,104.7],[43.0,108.2],[43.3,111.7],[43.5,115.1],[43.7,118.6],[43.7,122.1],[43.7,125.6],[43.5,128.7],[43.0,131.9],[42.3,135.5],[41.3,139.3],[40.0,143.2],[38.5,147.0],[36.8,150.8],[35.2,154.1],[33.5,157.3],[31.7,160.5],[29.8,163.7],[27.9,167.0],[26.1,170.5],[24.5,174.3],[23.3,178.0],[22.3,181.7],[21.5,185.4],[21.1,188.7],[20.6,191.9],[20.2,195.1],[19.6,198.3],[19.0,201.8],[18.1,205.3],[17.2,208.8],[15.9,212.6],[14.7,216.4],[13.2,220.2],[11.7,224.0],[10.1,227.8],[8.5,231.3],[6.9,234.7],[5.2,237.9],[3.3,241.0],[1.3,244.2],[-0.9,247.3],[-3.3,250.6],[-5.8,253.8],[-8.4,256.9],[-11.3,260.0],[-14.2,262.9],[-17.1,265.7],[-20.2,268.3],[-23.3,270.6],[-26.5,272.8],[-29.7,274.9],[-32.9,276.8],[-36.1,278.6],[-39.7,280.4],[-43.1,282.0],[-46.9,283.6],[-50.4,285.0],[-52.3,285.7],[-56.5,287.2]]}, // Casio — extérieur droit
      {side:-1,from:.2934,to:.3048,pts:[[3.5,-2.9],[2.3,-6.1],[1.3,-7.7],[-0.2,-10.5],[-1.9,-13.6],[-3.2,-16.8],[-4.3,-20.1],[-4.7,-21.7],[-4.9,-27.4]]}, // Avant Degner — protection reprise
    ],
    // Uniquement le passage sous le pont du croisement : pas de tunnel ni de portails.
    // L’emprise couverte est déduite de la largeur du tablier dans Track.
    tunnels: [],
    annotatedRunoffsOnly: true, // contours rouge/vert de art/reprise circuit/suzuka_reprise.png
    lines: {
      racing: [[-74.294, 71.274], [-88.322, 72.58], [-99.803, 64.597], [-97.785, 57.129], [-76.388, 53.412], [-69.971, 49.421], [-63.68, 44.454], [-47.075, 44.528], [-37.102, 34.185], [-28.956, 33.889], [-15.383, 42.684], [-4.179, 38.122], [2.292, 27.102], [2.035, 14.29], [-3.098, -4.161], [-2.117, -11.181], [4.109, -19.201], [19.766, -16.184], [34.95, -10.176], [46.664, 1.12], [49.174, -2.657], [42.133, -15.489], [40.618, -27.47], [46.071, -39.216], [56.403, -48.504], [67.626, -53.203], [80.709, -53.226], [93.446, -54.591], [99.143, -65.188], [91.056, -71.868], [77.988, -68.867], [66.235, -62.651], [55.135, -54.978], [44.715, -46.458], [34.651, -37.611], [24.762, -28.857], [15.102, -19.554], [9.001, -8.31], [8.879, 4.667], [11.868, 17.465], [13.131, 30.777], [7.942, 40.977], [2.45, 51.875], [-8.762, 58.222], [-21.758, 61.654], [-34.93, 64.112], [-48.107, 66.544], [-61.102, 68.921]],
      inside: [[-74.051, 70.047], [-87.764, 71.957], [-98.172, 64.811], [-97.785, 57.365], [-81.415, 54.001], [-69.974, 49.419], [-63.809, 44.417], [-47.685, 44.177], [-38.099, 37.343], [-26.207, 35.928], [-15.383, 42.684], [-4.474, 37.768], [2.203, 27.081], [1.98, 14.305], [-1.458, 1.389], [-2.374, -6.652], [4.607, -19.282], [17.15, -12.416], [27.673, -10.42], [37.77, -7.795], [44.938, -4.901], [42.876, -15.35], [44.4, -28.022], [49.301, -38.543], [54.518, -41.874], [65.468, -51.345], [80.748, -53.613], [93.86, -54.226], [98.947, -65.207], [91.101, -71.48], [78.686, -67.334], [67.072, -61.219], [56.047, -53.773], [45.847, -45.179], [35.804, -36.307], [25.917, -27.554], [15.952, -18.595], [9.133, -8.284], [8.903, 4.662], [11.105, 17.65], [11.973, 32.215], [8.339, 41.073], [2.38, 51.797], [-8.972, 57.267], [-22.072, 59.956], [-35.247, 62.401], [-48.423, 64.842], [-61.411, 67.212]],
      outside: [[-74.289, 71.301], [-87.684, 72.891], [-99.186, 66.08], [-99.309, 56.206], [-74.928, 54.299], [-74.06, 52.581], [-65.767, 43.937], [-47.851, 45.618], [-36.806, 33.224], [-30.397, 32.799], [-16.397, 44.343], [-3.359, 39.106], [3.898, 27.477], [1.144, 8.971], [-4.75, 0.252], [-2.706, -8.245], [0.674, -19.567], [17.445, -17.184], [32.226, -12.085], [46.385, 2.471], [48.323, -3.041], [43.008, -15.455], [39.021, -27.972], [44.983, -40.044], [54.819, -49.449], [67.31, -54.863], [80.813, -54.26], [93.561, -54.334], [100.68, -65.038], [90.901, -73.209], [77.964, -68.919], [66.193, -62.722], [54.996, -55.161], [44.693, -46.483], [34.65, -37.611], [24.762, -28.857], [14.797, -19.898], [7.424, -8.615], [7.189, 4.969], [11.276, 17.609], [13.858, 30.856], [7.961, 40.975], [3.358, 52.887], [-8.598, 58.968], [-21.755, 61.668], [-34.929, 64.113], [-48.105, 66.554], [-61.101, 68.925]],
    },
    panneaux: [
      [0.0033, 50, 2, 1],
      [0.0185, 0, 2, 1],
      [0.0612, 100, 4, -1],
      [0.0764, 50, 4, -1],
      [0.0915, 0, 4, -1],
      [0.1082, 0, 4, 1],
      [0.1206, 50, 4, -1],
      [0.1358, 0, 4, -1],
      [0.1615, 0, 3, 1],
      [0.1833, 50, 4, -1],
      [0.1985, 0, 4, -1],
      [0.2152, 50, 5, -1],
      [0.2303, 0, 5, -1],
      [0.2464, 0, 4, -1],
      [0.2691, 100, 3, 1],
      [0.2842, 50, 3, 1],
      [0.2994, 0, 3, 1],
      [0.3097, 50, 'square', 1],
      [0.3248, 0, 'square', 1],
      [0.3503, 100, 4, 1],
      [0.3655, 50, 4, 1],
      [0.3806, 0, 4, 1],
      [0.4027, 0, 'hairpin', -1],
      [0.4179, 100, 3, 1],
      [0.433, 50, 3, 1],
      [0.4482, 0, 3, 1],
      [0.4961, 200, 3, -1],
      [0.5264, 100, 3, -1],
      [0.5415, 50, 3, -1],
      [0.5567, 0, 3, -1],
      [0.5658, 50, 2, -1],
      [0.5809, 0, 2, -1],
      [0.6979, 200, 3, -1],
      [0.7282, 100, 3, -1],
      [0.7433, 50, 3, -1],
      [0.7585, 0, 3, -1],
      [0.78, 200, 'square', -1],
      [0.8103, 100, 'square', -1],
      [0.8255, 50, 'square', -1],
      [0.8406, 0, 'square', -1],
      [0.9579, 200, 2, 1],
      [0.9882, 100, 2, 1],
      [0.3876, 50, 'acute', -1],
    ],
    /* Reprise annotée par l’utilisateur : rouge = gravier, vert = bitume.
       Profils simplifiés à partir de suzuka_reprise.png ; Cuillère et Casio reçoivent
       les tabliers bitumés indiqués. Pas de gravier automatique hors des contours déclarés. */
    runoffs: [
      // Reprise 0.40 (suzuka-tour_reprise.png) : Degner intérieur et Casio côté droit en bitume
      // jusqu'au trait vert, qui porte aussi la protection ; croix vertes : plus de bac à l'approche
      // de l'épingle.
      { name: 'Degner — dégagement intérieur bitumé', surface: 'asphalt', side: -1,
        points: [[.3018,0],[.3063,11.1],[.3093,14.4],[.3123,15.3],[.3153,15.3],[.3183,15.5],[.3213,15.5],[.3243,15.5],[.3333,15.3],[.3363,8.5],[.3393,4],[.3418,0]] },
      { name: 'Casio — dégagement extérieur droit bitumé', surface: 'asphalt', side: -1,
        points: [[.8082,0],[.8127,10.1],[.8157,11.3],[.8187,12.9],[.8217,15.8],[.8247,19.1],[.8277,22.1],[.8427,22.1],[.8457,17.8],[.8487,17.8],[.8517,21.2],[.8547,23.7],[.8577,24.9],[.8607,25.2],[.8637,25.2],[.8667,24.8],[.8697,23.9],[.8727,23],[.8757,21.8],[.8787,20.5],[.8817,18.1],[.8847,16.1],[.8877,14.1],[.8907,12.2],[.8937,10.7],[.8967,9.5],[.8997,7.8],[.9015,0]] },
      { name: 'Virage 1-2', surface: 'asphalt', side: 1, from: 0.012, to: 0.07, w: 14 },
      // Largeurs interprétées du dessin annoté, en mètres du jeu (pas un relevé réel).
      { name: 'Esses — extérieur droit', surface: 'gravel', side: -1,
        points: [[.078,0],[.09,9],[.105,20],[.12,8],[.135,7],[.145,13],[.155,10],[.168,0]] },
      { name: 'Esses — extérieur gauche', surface: 'gravel', side: 1,
        points: [[.098,0],[.115,12],[.125,9.5],[.14,0],[.15,0],[.165,13],[.175,11.5],[.19,7],[.198,0]] },
      { name: 'Dunlop', surface: 'gravel', side: -1,
        points: [[.195,0],[.205,15],[.22,6],[.235,5],[.25,14],[.265,10],[.278,5],[.285,0]] },
      { name: 'Degner 1', surface: 'gravel', side: 1,
        points: [[.283,0],[.294,14],[.306,19],[.315,20],[.326,19],[.335,17],[.348,0]] },
      { name: 'Epingle — extérieur', surface: 'gravel', side: -1,
        points: [[.386,0],[.4,16],[.415,10],[.43,0]] },
      { name: '200R — approche de la Cuillère', surface: 'gravel', side: 1,
        points: [[.438,0],[.451,10],[.463,14],[.477,6],[.487,0]] },
      { name: 'Cuillère — entrée', surface: 'gravel', side: 1,
        points: [[.51,0],[.523,13],[.535,10],[.545,0]] },
      { name: 'Cuillère — tablier bitumé annoté', surface: 'asphalt', side: -1,
        points: [[.542,0],[.555,7],[.568,7.5],[.582,8],[.595,8],[.606,4],[.614,0]] },
      { name: 'Retour vers 130R — bande extérieure', surface: 'gravel', side: 1,
        points: [[.635,0],[.645,12],[.658,3],[.675,4],[.69,0]] },
      { name: '130R', surface: 'gravel', side: -1,
        points: [[.752,0],[.766,12],[.775,18],[.785,12],[.797,0]] },
      { name: 'Casio — extérieur gauche', surface: 'gravel', side: 1,
        points: [[.823,0],[.835,24],[.852,26],[.862,9],[.877,8],[.892,0]] },
    ],
    implantation: [
      { kind: 'stands', side: -1, from: 0.96, to: 0.03, recul: 11, prof: 22, module: 40 },
      { kind: 'tribune', side: 1, from: 0.955, to: 0.04, recul: 10, prof: 18, module: 32 },
      { kind: 'parking', side: -1, from: 0.05, to: 0.11, recul: 18, prof: 36 },
      { kind: 'bois', side: 1, from: 0.07, to: 0.21, recul: 12, prof: 45, densite: 0.8 },
      { kind: 'bois', side: -1, from: 0.14, to: 0.22, recul: 13, prof: 40, densite: 0.75 },
      { kind: 'bois', side: 1, from: 0.24, to: 0.4, recul: 12, prof: 55 },
      { kind: 'bois', side: -1, from: 0.3, to: 0.45, recul: 13, prof: 50 },
      { kind: 'bois', side: 1, from: 0.55, to: 0.74, recul: 13, prof: 60 },
      { kind: 'bois', side: -1, from: 0.62, to: 0.75, recul: 14, prof: 48 },
      { kind: 'hangars', side: 1, from: 0.76, to: 0.82, recul: 16, prof: 26, module: 24 },
      { kind: 'tribune', side: -1, from: 0.81, to: 0.9, recul: 13, prof: 16, module: 28 },
      { kind: 'parking', side: 1, from: 0.86, to: 0.94, recul: 18, prof: 38 },
    ],
  },
  {
    id: 'interlagos', name: 'Festival de Carnaval', country: 'BR', flag: '🇧🇷', theme: 'tropical',
    parallelClearance: true,
    architecture: 'plats',
    barriers: true,   // protections dessinées et collisions : voir docs/spa-barrieres/README.md
    kerb: DRAPEAUX.br,
    length: 2700, width: 14,
    pts: TRACES.interlagos,
    barrierPaths: [
      {side:1,from:.3497,to:.4596,pts:[[7.0,-138.2],[7.7,-133.6],[8.0,-132.0],[8.7,-128.8],[9.7,-125.6],[11.4,-122.6],[13.7,-120.3],[16.7,-119.0],[19.9,-119.2],[22.9,-120.7],[25.4,-123.4],[27.2,-126.8],[28.2,-130.6],[28.9,-134.3],[29.3,-137.9],[29.4,-139.7],[29.9,-145.0],[28.7,-164.1],[28.6,-169.4],[28.7,-171.2],[29.0,-174.9],[29.3,-178.5],[29.9,-181.9],[30.7,-185.4],[31.6,-188.8],[32.6,-192.2],[33.8,-195.7],[35.1,-199.4],[36.5,-203.1],[38.0,-206.8],[39.5,-210.4],[41.2,-214.1],[43.1,-217.8],[44.9,-221.4],[46.9,-224.8],[49.0,-228.1],[51.1,-231.1],[53.2,-233.9],[55.5,-236.6],[57.9,-239.1],[60.3,-241.6],[62.9,-243.9],[65.6,-246.0],[68.7,-248.1],[71.9,-249.9],[75.4,-251.5],[79.0,-252.8],[82.7,-254.0],[86.4,-255.0],[90.0,-255.5],[93.7,-255.5],[97.3,-255.1],[100.9,-254.4],[104.4,-253.1],[107.9,-251.7],[111.2,-250.1],[114.2,-248.3],[117.1,-246.1],[119.6,-243.5],[121.6,-240.5],[122.8,-237.3],[123.5,-233.7],[123.5,-230.4],[123.2,-226.9],[122.6,-223.5],[121.8,-220.0],[120.8,-216.7],[120.0,-213.4],[119.1,-210.0],[118.2,-206.5],[117.5,-203.1],[117.0,-199.5],[116.5,-195.8],[116.1,-192.1],[115.9,-188.5],[115.9,-186.7],[115.9,-181.5]]}, // Ferradura et Laranja — contour
      {side:-1,from:.3266,to:.3513,pts:[[-44.6,-132.3],[-42.1,-137.5],[-41.1,-139.1],[-38.9,-142.1],[-36.5,-143.9],[-34.2,-144.4],[-32.3,-143.4],[-31.0,-141.1],[-30.2,-137.7],[-30.0,-136.0],[-30.3,-129.9]]}, // Épingle — protection intérieure arrondie
      {side:1,from:.1126,to:.1368,pts:[[236.7,77.4],[239.4,75.4],[240.6,74.1],[242.7,71.6],[244.7,68.3],[246.2,64.8],[246.9,61.1],[246.7,57.2],[245.8,53.6],[245.3,51.8],[242.9,46.7]]}, // S de Senna — protection intérieure
      {side:1,from:.8585,to:.8969,pts:[[-267.0,123.9],[-268.9,129.4],[-269.5,131.2],[-270.5,134.8],[-271.4,138.5],[-272.0,142.1],[-271.9,145.8],[-270.7,149.2],[-268.8,152.1],[-266.0,154.5],[-262.6,156.2],[-258.9,157.3],[-255.2,158.0],[-251.5,158.6],[-247.8,159.3],[-244.2,159.8],[-242.4,160.1],[-237.1,160.9]]}, // Junção — protection intérieure
      {side:-1,from:.8932,to:.9074,pts:[[-248.8,186.1],[-243.3,187.4],[-241.7,188.6],[-238.7,190.6],[-237.1,191.6],[-233.9,195.8]]}, // Junção — protection extérieure
    ],
    panneaux: [
      [0.0404, 200, 2, -1],
      [0.0774, 100, 2, -1],
      [0.0959, 50, 2, -1],
      [0.1144, 0, 2, -1],
      [0.1352, 50, 4, -1],
      [0.1537, 0, 4, -1],
      [0.2211, 100, 2, 1],
      [0.2396, 50, 2, 1],
      [0.2581, 0, 2, 1],
      [0.2937, 100, 'acute', 1],
      [0.3122, 50, 'acute', 1],
      [0.3307, 0, 'acute', 1],
      [0.3533, 0, 2, -1],
      [0.3856, 50, 5, 1],
      [0.4078, 50, 'acute', 1],
      [0.4267, 0, 'acute', 1],
      [0.447, 50, 4, -1],
      [0.4656, 0, 4, -1],
      [0.5093, 100, 'square', -1],
      [0.5278, 50, 'square', -1],
      [0.5463, 0, 'square', -1],
      [0.5615, 50, 5, -1],
      [0.58, 0, 5, -1],
      [0.6078, 100, 5, -1],
      [0.6263, 50, 5, -1],
      [0.6448, 0, 5, -1],
      [0.7885, 200, 2, -1],
      [0.8256, 100, 2, -1],
      [0.8441, 50, 2, -1],
      [0.8626, 0, 2, -1],
      [0.8767, 50, 'square', 1],
      [0.8952, 0, 'square', 1],
      [0.917, 0, 3, -1],
    ],
    /* Interlagos : deux lacs, des gradins empilés au-dessus des stands, et le gravier vert d'eau
       de `interlagos_2.jpg` autour du S de Senna, de la Descida do Lago, de Laranjinha, du Mergulho
       et de la Junção. Le reste du site est de l'herbe et du bitume de paddock : peu d'arbres, et
       groupés, comme le montre la carte. */
    runoffs: [
      { name: 'S de Senna', surface: 'gravel', side: -1, from: 0.108, to: 0.142, w: 16 },
      { name: 'Curva do Sol', surface: 'asphalt', side: -1, from: 0.146, to: 0.192, w: 13 },
      { name: 'Descida do Lago', surface: 'gravel', side: 1, from: 0.25, to: 0.315, w: 16 },
      // Reprise 0.40 (interlagos-tour_reprise.png) : Ferradura et Laranja suivent le contour rouge.
      { name: 'Ferradura et Laranja', surface: 'gravel', side: 1,
        points: [[.3466,0],[.3511,15.8],[.3541,16],[.3571,16],[.3601,15.9],[.3631,15.5],[.3661,14.6],[.3691,13.8],[.3721,12.6],[.3751,11.7],[.3781,11.2],[.3811,10.3],[.3841,9.9],[.3871,8.7],[.3901,7.8],[.3931,7.6],[.4008,10.2],[.4038,10.2],[.4068,10],[.4098,9.9],[.4128,9.9],[.4158,10.8],[.4188,11.5],[.4218,11.7],[.4248,11.7],[.4278,11.1],[.4308,10],[.4338,10],[.4368,10.8],[.4398,15.7],[.4428,15.7],[.4458,12.9],[.4488,10.7],[.4518,8.9],[.4548,8.6],[.4578,8.6],[.4626,0]] },
      { name: 'Pinheirinho', surface: 'gravel', side: -1, from: 0.458, to: 0.515, w: 14 },
      { name: 'Bico de Pato', surface: 'gravel', side: -1, from: 0.54, to: 0.595, w: 14 },
      { name: 'Mergulho', surface: 'gravel', side: -1, from: 0.622, to: 0.668, w: 16 },
      { name: 'Juncao', surface: 'gravel', side: -1, from: 0.852, to: 0.895, w: 15 },
      { name: 'Arquibancadas', surface: 'asphalt', side: 1, from: 0.9, to: 0.98, w: 13 },
    ],
    implantation: [
      { kind: 'stands', side: -1, from: 0.955, to: 0.055, recul: 10, prof: 20, module: 38 },
      { kind: 'tribune', side: 1, from: 0.96, to: 0.07, recul: 9, prof: 19, module: 30 },
      { kind: 'tribune', side: -1, from: 0.09, to: 0.15, recul: 13, prof: 15, module: 26 },
      { kind: 'bois', side: 1, from: 0.17, to: 0.25, recul: 14, prof: 40, densite: 0.8 },
      { kind: 'bois', side: -1, from: 0.2, to: 0.31, recul: 15, prof: 45, densite: 0.75 },
      { kind: 'bois', side: 1, from: 0.33, to: 0.43, recul: 14, prof: 38, densite: 0.8 },
      { kind: 'bois', side: -1, from: 0.46, to: 0.58, recul: 14, prof: 42, densite: 0.7 },
      { kind: 'bois', side: 1, from: 0.6, to: 0.72, recul: 14, prof: 46 },
      { kind: 'nu', side: -1, from: 0.68, to: 0.84, prof: 120 },
      { kind: 'parking', side: 1, from: 0.75, to: 0.83, recul: 18, prof: 34 },
      { kind: 'hangars', side: -1, from: 0.9, to: 0.95, recul: 16, prof: 24, module: 24 },
    ],
    // La passerelle du S do Senna (voie 189535484).
    passerelles: [0.8625],
  },
  {
    id: 'laguna', name: 'Corkscrew Ranch', country: 'US', flag: '🇺🇸', theme: 'california',
    architecture: 'pavillons',
    barriers: true,   // protections dessinées et collisions : voir docs/spa-barrieres/README.md
    kerb: DRAPEAUX.us,
    length: 2400, width: 13,
    pts: TRACES.laguna,
    /* Reprise 0.40 (laguna-tour_reprise.png) : les croix noires retirent la voie des stands du
       dernier virage ; le trait noir la fait partir à sa sortie. Zone d'arrêt et sortie inchangées. */
    pitFrom: 0.932, pitTo: 0.0425, pitAt: 0.9717,
    barrierPaths: [
      {side:-1,from:.4894,to:.5229,pts:[[150.7,-258.8],[156.0,-258.3],[157.8,-258.0],[161.4,-257.5],[165.1,-256.8],[168.7,-256.0],[172.2,-254.9],[175.5,-253.5],[178.5,-251.7],[181.2,-249.5],[183.7,-247.1],[186.2,-244.4],[188.6,-241.4],[190.9,-238.2],[193.1,-234.7],[195.2,-231.0],[196.3,-229.2],[199.4,-223.8]]}, // Virage 6 — protection reprise
      {side:-1,from:.1214,to:.1475,pts:[[-270.1,192.2],[-273.4,190.0],[-273.9,188.4],[-274.8,185.7],[-275.7,184.1],[-274.6,178.6]]}, // Andretti — protection intérieure
    ],
    panneaux: [
      [0.0129, 50, 5, 1],
      [0.0338, 0, 5, 1],
      [0.0867, 100, 'acute', 1],
      [0.1075, 50, 'acute', 1],
      [0.1283, 0, 'acute', 1],
      [0.1642, 100, 2, -1],
      [0.185, 50, 2, -1],
      [0.2058, 0, 2, -1],
      [0.2333, 100, 2, 1],
      [0.2542, 50, 2, 1],
      [0.275, 0, 2, 1],
      [0.3154, 100, 'chicane', -1],
      [0.3363, 50, 'chicane', -1],
      [0.3571, 0, 'square', 1],
      [0.4188, 200, 2, 1],
      [0.4604, 100, 2, 1],
      [0.4813, 50, 2, 1],
      [0.5021, 0, 2, 1],
      [0.5558, 100, 3, 1],
      [0.5767, 50, 3, 1],
      [0.5975, 0, 3, 1],
      [0.6604, 200, 2, -1],
      [0.7021, 100, 2, -1],
      [0.7229, 50, 2, -1],
      [0.7438, 0, 2, -1],
      [0.7754, 100, 3, -1],
      [0.7963, 50, 3, -1],
      [0.8171, 0, 3, -1],
      [0.8508, 100, 'hairpin', 1],
      [0.8717, 50, 'hairpin', 1],
      [0.8925, 0, 'hairpin', 1],
      [0.9388, 100, 5, 1],
      [0.9596, 50, 5, 1],
      [0.9804, 0, 5, 1],
    ],
    /* Laguna Seca n'a pas reçu de vue du dessus : son implantation vient de ce que le circuit est,
       une piste tracée dans des collines pelées du comté de Monterey. Chênes isolés en touffes sur
       les crêtes, herbe sèche partout ailleurs, et de grands bacs de sable aux virages rapides.
       À reprendre si une vue arrive. */
    runoffs: [
      { name: 'Andretti Hairpin', surface: 'gravel', side: 1, from: 0.118, to: 0.152, w: 15 },
      { name: 'Virage 3', surface: 'gravel', side: -1, from: 0.196, to: 0.235, w: 14 },
      { name: 'Virage 5', surface: 'gravel', side: 1, from: 0.265, to: 0.382, w: 16 },
      { name: 'Virage 6', surface: 'asphalt', side: -1, from: 0.374, to: 0.4, w: 13 },
      { name: 'Tire-bouchon', surface: 'gravel', side: 1, from: 0.46, to: 0.52, w: 16 },
      { name: 'Rainey Curve', surface: 'gravel', side: 1, from: 0.588, to: 0.64, w: 17 },
      { name: 'Virage 10', surface: 'gravel', side: -1, from: 0.735, to: 0.775, w: 15 },
      { name: 'Virage 11', surface: 'asphalt', side: -1, from: 0.808, to: 0.892, w: 14 },
    ],
    implantation: [
      { kind: 'stands', side: -1, from: 0.97, to: 0.06, recul: 11, prof: 20, module: 36 },
      { kind: 'tribune', side: 1, from: 0.975, to: 0.05, recul: 10, prof: 16, module: 28 },
      { kind: 'nu', side: 1, from: 0.17, to: 0.3, prof: 120 },
      { kind: 'bois', side: -1, from: 0.1, to: 0.2, recul: 14, prof: 36, densite: 0.4 },
      { kind: 'bois', side: 1, from: 0.33, to: 0.44, recul: 13, prof: 40, densite: 0.45 },
      { kind: 'bois', side: -1, from: 0.42, to: 0.56, recul: 13, prof: 44, densite: 0.5 },
      { kind: 'nu', side: 1, from: 0.6, to: 0.72, prof: 110 },
      { kind: 'bois', side: -1, from: 0.62, to: 0.74, recul: 14, prof: 38, densite: 0.4 },
      { kind: 'parking', side: 1, from: 0.78, to: 0.86, recul: 18, prof: 36 },
      { kind: 'hangars', side: -1, from: 0.88, to: 0.94, recul: 16, prof: 24, module: 24 },
      // Camping-cars garés en long derrière la protection, hors des parkings.
      { kind: 'camping', side: 1, from: 0.515, to: 0.6, recul: 2.5 },
    ],
    // Trois passerelles : l'entrée des stands, le Rainey Curve et le Corkscrew.
    passerelles: [0.0399, 0.6555, 0.7886],
  },
  {
    id: 'nurburgring', name: 'Bratwurst Ring', country: 'DE', flag: '🇩🇪', theme: 'forest',
    architecture: 'pavillons',
    barriers: true,   // protections dessinées et collisions : voir docs/spa-barrieres/README.md
    kerb: DRAPEAUX.de,
    length: 3000, width: 15,
    pts: TRACES.nurburgring,
    barrierPaths: [
      {side:-1,from:.1113,to:.1756,pts:[[5.4,-153.9],[3.8,-159.4],[3.2,-161.2],[2.0,-164.9],[0.5,-168.7],[-1.0,-172.4],[-2.6,-176.1],[-4.8,-180.0],[-7.3,-183.8],[-10.3,-187.6],[-13.7,-191.3],[-17.5,-194.7],[-21.4,-197.5],[-25.2,-199.6],[-29.0,-201.3],[-32.8,-202.4],[-36.5,-203.1],[-40.2,-203.5],[-43.9,-203.8],[-47.7,-203.8],[-51.4,-203.8],[-55.1,-203.5],[-58.9,-203.1],[-62.6,-202.7],[-66.4,-202.1],[-70.2,-201.4],[-73.8,-200.8],[-77.5,-200.1],[-81.2,-199.3],[-84.9,-198.5],[-88.6,-197.4],[-92.5,-196.3],[-96.2,-195.2],[-100.1,-193.8],[-103.8,-192.6],[-107.5,-191.4],[-111.2,-190.0],[-115.0,-188.4],[-118.7,-186.9],[-122.5,-185.1],[-126.2,-183.3],[-130.0,-181.4],[-133.8,-179.2],[-137.6,-176.7],[-141.5,-173.9],[-145.4,-170.7],[-149.2,-167.0],[-152.5,-163.2],[-155.3,-159.4],[-157.5,-155.5],[-158.9,-151.7],[-159.9,-148.0],[-160.4,-144.2],[-160.5,-140.5],[-160.4,-136.8],[-159.7,-133.0],[-158.0,-129.1],[-155.7,-125.4],[-152.6,-122.0],[-149.0,-118.9],[-145.2,-116.2],[-141.4,-114.1],[-137.7,-112.5],[-133.9,-111.0],[-130.1,-109.8],[-126.4,-108.9],[-124.6,-108.6],[-119.2,-108.0]]}, // Mercedes-Arena — contour
      {side:1,from:.5225,to:.5486,pts:[[-220.0,239.2],[-220.9,235.5],[-221.3,233.7],[-222.0,230.5],[-222.8,226.7],[-223.5,223.0],[-224.2,219.2],[-224.6,215.5],[-225.0,211.7],[-225.5,208.0],[-225.7,204.2],[-225.8,200.5],[-225.9,196.8],[-225.8,193.0],[-225.7,189.3],[-225.3,185.5],[-224.8,181.8],[-224.3,178.2],[-223.5,174.5],[-222.4,170.7],[-221.5,167.0],[-220.3,163.3],[-219.0,159.6],[-218.3,157.7],[-216.3,152.4]]}, // Veedol — contour
      {side:1,from:.7350,to:.7564,pts:[[-119.1,-298.1],[-116.1,-302.2],[-114.4,-304.0],[-111.4,-307.3],[-107.8,-311.2],[-104.0,-314.9],[-100.2,-318.5],[-96.4,-321.8],[-92.5,-324.7],[-88.8,-327.2],[-85.0,-329.4],[-81.2,-331.2],[-77.5,-332.7],[-73.7,-334.1],[-69.9,-335.3],[-66.2,-336.3],[-64.5,-336.8],[-58.9,-338.5]]}, // Avant le Bit-Kurve — contour
      {side:-1,from:.8289,to:.8659,pts:[[160.3,-359.4],[166.1,-360.2],[168.0,-360.5],[171.7,-361.0],[175.4,-361.6],[179.1,-362.0],[182.8,-362.6],[186.6,-363.3],[190.3,-364.0],[194.1,-364.7],[197.8,-365.6],[201.6,-366.5],[205.3,-367.7],[209.1,-369.1],[212.9,-371.1],[216.2,-373.7],[218.8,-376.8],[220.6,-380.2],[221.4,-384.0],[221.5,-387.8],[221.3,-391.4],[221.6,-395.2],[222.7,-399.0],[224.8,-402.8],[227.7,-406.5],[231.3,-410.0],[235.2,-412.9],[239.0,-415.4],[240.9,-416.7],[246.2,-419.5]]}, // Schumacher-S bas — contour
      {side:-1,from:.0607,to:.0987,pts:[[-3.0,-95.8],[-8.2,-93.0],[-10.1,-91.9],[-13.7,-91.1],[-16.7,-91.3],[-18.5,-92.8],[-19.6,-95.4],[-19.4,-99.1],[-18.3,-102.9],[-17.7,-104.7],[-15.5,-110.5]]}, // Castrol-S — protection arrondie
      {side:-1,from:.1754,to:.2005,pts:[[-120.1,-108.6],[-115.0,-108.0],[-113.1,-107.4],[-109.8,-106.3],[-106.7,-104.5],[-104.4,-102.0],[-102.7,-99.0],[-102.0,-95.6],[-101.6,-91.8],[-101.7,-88.4],[-101.8,-86.6],[-102.3,-82.3]]}, // Sortie de l’épingle — protection reprise
    ],
    // Croix vertes sur le rail qui traversait le bac de l'entrée de la Veedol.
    barrierCuts: [[-198.7,294.1,6]],
    panneaux: [
      [0.0067, 200, 'acute', 1],
      [0.04, 100, 'acute', 1],
      [0.0567, 50, 'acute', 1],
      [0.0733, 0, 'acute', 1],
      [0.0877, 50, 2, -1],
      [0.1043, 0, 2, -1],
      [0.1197, 100, 'hairpin', -1],
      [0.1363, 50, 'hairpin', -1],
      [0.153, 0, 'hairpin', -1],
      [0.1637, 50, 'square', 1],
      [0.1803, 0, 'square', 1],
      [0.24, 100, 4, -1],
      [0.2567, 50, 4, -1],
      [0.2733, 0, 4, -1],
      [0.29, 50, 1, 1],
      [0.3067, 0, 1, 1],
      [0.3543, 200, 'hairpin', 1],
      [0.3877, 100, 'hairpin', 1],
      [0.4043, 50, 'hairpin', 1],
      [0.421, 0, 'hairpin', 1],
      [0.469, 100, 3, -1],
      [0.4857, 50, 3, -1],
      [0.5023, 0, 3, -1],
      [0.5143, 50, 4, 1],
      [0.531, 0, 4, 1],
      [0.581, 100, 2, -1],
      [0.5977, 50, 2, -1],
      [0.6143, 0, 2, -1],
      [0.6337, 50, 2, 1],
      [0.6503, 0, 2, 1],
      [0.677, 200, 4, 1],
      [0.7103, 100, 4, 1],
      [0.727, 50, 4, 1],
      [0.7437, 0, 4, 1],
      [0.77, 200, 2, -1],
      [0.8033, 100, 2, -1],
      [0.82, 50, 2, -1],
      [0.8367, 0, 2, -1],
      [0.853, 100, 2, 1],
      [0.8697, 50, 2, 1],
      [0.8863, 0, 2, 1],
    ],
    /* Le Nürburgring GP : un complexe de stands et de tribunes qui tient tout le bas du tour, et
       l'Eifel qui ferme le reste. Relevé sur `nurburging_jp.jpg` : la forêt serre le circuit au
       nord et à l'est, les grands bacs clairs sont à la chicane et à la Coca-Cola Kurve, et le
       paddock occupe toute la ligne droite avec ses parkings derrière. */
    runoffs: [
      { name: 'Castrol-S', surface: 'asphalt', side: 1, from: 0.065, to: 0.1, w: 15 },
      // Reprise 0.40 (nurburgring-tour_reprise.png) : la Mercedes-Arena est bitumée jusqu'au contour
      // vert, qui porte aussi la protection ; croix vertes : plus de bac dans l'épingle.
      { name: 'Mercedes-Arena — bitume', surface: 'asphalt', side: -1,
        points: [[.1083,0],[.1128,13.8],[.1158,13.8],[.1188,15.1],[.1218,15.8],[.1248,15.8],[.1278,15.1],[.1308,14.6],[.1338,14.4],[.1368,14],[.1398,13.2],[.1428,12.3],[.1458,11.6],[.1488,10.7],[.1518,9.7],[.1548,9.7],[.1578,9.9],[.1608,11.4],[.1638,12.8],[.1668,12.8],[.1698,12.7],[.1728,10.7],[.1758,10.7],[.1787,0]] },
      { name: 'Epingle Mercedes — sans bac', surface: 'grass', side: 1, points: [[.138,0],[.2,0]] },
      { name: 'Ford-Kurve', surface: 'asphalt', side: -1, from: 0.266, to: 0.3, w: 13 },
      { name: 'Dunlop-Kehre', surface: 'gravel', side: 1, from: 0.3, to: 0.335, w: 16 },
      { name: 'Michael-Schumacher-S', surface: 'gravel', side: 1, from: 0.412, to: 0.456, w: 15 },
      { name: 'Veedol-Schikane', surface: 'gravel', side: -1, from: 0.495, to: 0.548, w: 18 },
      { name: 'Bit-Kurve', surface: 'gravel', side: -1, from: 0.606, to: 0.634, w: 15 },
      { name: 'Advan-Bogen', surface: 'asphalt', side: 1, from: 0.644, to: 0.682, w: 13 },
      { name: 'Schumacher-S bas', surface: 'gravel', side: -1,
        points: [[.8257,0],[.8302,11.3],[.8332,12.2],[.8362,13.3],[.8392,20.8],[.8422,25.1],[.8452,25.1],[.8482,20.5],[.8542,18.6],[.8572,14.6],[.8602,12.2],[.8632,9.5],[.8662,6.7],[.8690,0]] },
      { name: 'Schumacher-S bas — sans bac côté gauche', surface: 'grass', side: 1, points: [[.84,0],[.862,0]] },
      { name: 'Veedol — gravier gauche', surface: 'gravel', side: 1,
        points: [[.5193,0],[.5238,12.1],[.5268,11.3],[.5298,10.3],[.5328,10.1],[.5358,10.1],[.5388,10.8],[.5418,11.1],[.5448,11.1],[.5478,11],[.5517,0]] },
      { name: 'Avant le Bit-Kurve — gravier gauche', surface: 'gravel', side: 1,
        points: [[.7317,0],[.7362,10],[.7392,10.2],[.7422,10.3],[.7452,10.4],[.7482,10.5],[.7512,10.5],[.7542,9.8],[.7572,9.1],[.7593,0]] },
      { name: 'Coca-Cola-Kurve', surface: 'asphalt', side: 1, from: 0.878, to: 0.92, w: 17 },
    ],
    implantation: [
      { kind: 'stands', side: -1, from: 0.945, to: 0.055, recul: 12, prof: 26, module: 46 },
      { kind: 'tribune', side: 1, from: 0.95, to: 0.06, recul: 11, prof: 20, module: 36 },
      { kind: 'parking', side: -1, from: 0.07, to: 0.13, recul: 22, prof: 44 },
      { kind: 'tribune', side: 1, from: 0.095, to: 0.2, recul: 13, prof: 16, module: 28 },
      { kind: 'bois', side: 1, from: 0.21, to: 0.3, recul: 13, prof: 55 },
      { kind: 'bois', side: -1, from: 0.185, to: 0.26, recul: 14, prof: 60 },
      { kind: 'bois', side: 1, from: 0.34, to: 0.41, recul: 13, prof: 50 },
      { kind: 'bois', side: -1, from: 0.33, to: 0.49, recul: 14, prof: 65 },
      { kind: 'bois', side: 1, from: 0.46, to: 0.6, recul: 13, prof: 70 },
      { kind: 'bois', side: -1, from: 0.56, to: 0.72, recul: 14, prof: 65 },
      { kind: 'bois', side: 1, from: 0.69, to: 0.82, recul: 13, prof: 60 },
      { kind: 'hangars', side: -1, from: 0.74, to: 0.8, recul: 18, prof: 26, module: 26 },
      { kind: 'tribune', side: -1, from: 0.87, to: 0.935, recul: 13, prof: 18, module: 30 },
      // Camping-cars garés en long derrière la protection, hors des parkings.
      { kind: 'camping', side: -1, from: 0.34, to: 0.48, recul: 2.5 },
    ],
  },
  {
    id: 'lemans', name: 'Autoroute 11', country: 'FR', flag: '🇫🇷', theme: 'lemans',
    architecture: 'pavillons',
    barriers: true,   // protections dessinées et collisions : voir docs/spa-barrieres/README.md
    kerb: DRAPEAUX.fr,
    length: 4200, width: 15,
    pts: TRACES.lemans,
    barrierPaths: [
      {side:-1,from:.8568,to:.8835,pts:[[238.1,347.4],[233.7,342.9],[232.4,341.6],[229.3,338.6],[225.8,335.6],[222.6,333.0],[219.1,330.4],[215.2,328.1],[211.4,326.2],[207.5,324.8],[203.5,323.4],[199.6,322.6],[195.7,321.8],[191.7,321.8],[187.7,321.9],[183.5,322.3],[179.1,323.1],[174.6,323.9],[170.2,324.9],[165.8,326.2],[161.5,327.5],[157.1,328.9],[152.7,330.6],[148.3,332.4],[143.9,334.3],[139.4,336.7],[135.3,339.2],[131.6,341.6],[128.3,344.0],[125.5,346.4],[123.2,348.6],[121.1,351.3],[119.5,354.4],[118.6,355.9],[117.3,361.7]]}, // Maison Blanche
      {side:-1,from:.0566,to:.1267,pts:[[-513.2,494.4],[-516.3,487.8],[-517.4,485.6],[-519.6,481.2],[-521.8,477.2],[-524.0,473.6],[-526.2,470.4],[-528.4,467.7],[-530.6,465.4],[-532.8,463.2],[-535.5,460.7],[-538.8,457.8],[-542.5,455.0],[-546.7,452.1],[-551.2,449.2],[-555.3,446.7],[-559.3,444.8],[-563.2,443.0],[-567.2,441.2],[-570.8,439.5],[-574.6,438.1],[-578.7,436.4],[-582.6,434.8],[-586.6,433.4],[-590.8,431.9],[-594.9,430.3],[-598.9,428.9],[-602.6,427.6],[-606.2,426.3],[-609.4,425.1],[-612.4,423.6],[-615.4,421.3],[-618.2,418.8],[-620.6,415.6],[-623.0,412.0],[-625.5,408.0],[-627.7,404.3],[-629.9,400.4],[-632.1,396.4],[-634.3,392.5],[-636.4,388.5],[-638.6,384.1],[-640.6,379.8],[-642.4,375.4],[-644.2,371.0],[-646.0,367.0],[-647.8,363.1],[-649.9,359.4],[-652.6,355.9],[-655.3,352.9],[-658.6,350.0],[-661.9,347.5],[-665.5,345.4],[-669.1,343.8],[-673.0,342.1],[-677.0,340.7],[-680.8,339.4],[-684.8,338.1],[-688.8,336.8],[-692.8,335.7],[-696.8,334.5],[-701.2,333.5],[-705.6,332.2],[-709.9,331.2],[-714.4,330.0],[-716.6,329.5],[-723.3,327.5]]}, // Esses et Tertre Rouge — extérieur
      {side:1,from:.0970,to:.1276,pts:[[-672.0,416.8],[-673.7,412.3],[-674.7,410.3],[-676.4,406.8],[-678.5,403.1],[-680.6,399.9],[-682.9,397.2],[-685.6,394.7],[-688.9,392.2],[-692.6,389.8],[-696.4,387.4],[-700.5,385.0],[-704.1,382.8],[-707.6,380.6],[-711.2,377.9],[-714.7,375.2],[-717.8,372.6],[-720.8,369.9],[-723.6,367.3],[-725.8,365.1],[-728.0,362.9],[-730.2,360.7],[-732.4,358.4],[-734.6,356.2],[-736.7,353.9],[-738.9,351.7],[-741.4,349.1],[-742.5,347.9],[-747.0,343.3]]}, // Sortie du Tertre Rouge
      {side:-1,from:.9103,to:.9450,pts:[[48.1,376.4],[42.4,374.4],[40.6,373.8],[37.1,372.5],[33.5,371.2],[30.0,370.3],[26.2,369.4],[22.2,368.6],[17.9,368.2],[13.5,367.8],[9.1,367.5],[4.7,367.8],[0.3,368.2],[-4.1,368.6],[-8.5,369.0],[-12.9,369.8],[-17.2,370.3],[-21.5,370.8],[-25.5,371.6],[-29.4,372.5],[-33.4,373.3],[-37.4,374.2],[-41.5,375.4],[-45.9,376.4],[-50.3,377.6],[-54.6,378.7],[-58.7,379.9],[-62.6,380.9],[-66.6,382.2],[-70.6,383.5],[-74.6,385.2],[-79.0,386.9],[-83.4,389.0],[-87.7,391.3],[-91.7,393.5],[-95.6,396.3],[-99.0,399.0],[-100.7,400.3],[-104.8,404.7]]}, // Chicane Ford
      {side:1,from:.8886,to:.9336,pts:[[132.2,397.2],[127.8,401.1],[126.2,402.7],[123.3,405.5],[120.2,408.6],[117.1,411.7],[113.6,414.9],[110.4,417.5],[106.9,420.2],[103.3,422.5],[99.4,424.7],[95.3,426.3],[90.9,427.7],[86.3,428.1],[81.8,428.0],[77.4,427.2],[72.9,425.8],[68.5,424.0],[64.1,421.8],[59.6,419.2],[55.2,416.7],[50.7,414.2],[46.2,411.7],[41.9,409.8],[37.8,408.0],[33.9,406.6],[30.0,405.6],[26.2,405.0],[22.3,404.5],[18.0,404.4],[13.6,404.4],[9.2,404.5],[4.7,405.0],[0.4,405.5],[-4.1,406.3],[-8.4,407.3],[-12.8,408.5],[-17.2,409.5],[-21.6,410.8],[-25.9,412.2],[-30.4,413.8],[-34.8,415.3],[-39.3,417.0],[-43.6,418.7],[-45.8,419.5],[-51.9,422.0]]}, // Maison Blanche — sortie
      {side:1,from:.9715,to:.9905,pts:[[-191.0,481.7],[-194.2,486.5],[-195.4,488.2],[-197.6,491.3],[-199.8,494.3],[-202.0,497.0],[-204.3,499.7],[-207.0,502.4],[-210.0,505.1],[-213.1,507.8],[-216.3,510.4],[-219.9,513.0],[-223.0,515.2],[-226.2,517.4],[-229.7,519.6],[-233.7,521.7],[-237.8,523.8],[-242.2,525.5],[-246.6,527.2],[-248.8,528.0],[-255.2,530.0]]}, // Chicane Ford — sortie
      {side:1,from:.0396,to:.0701,pts:[[-463.6,547.7],[-469.7,548.0],[-471.8,548.1],[-476.1,548.3],[-480.5,548.3],[-484.9,548.2],[-489.3,547.8],[-493.8,547.2],[-497.9,546.3],[-501.9,545.4],[-505.8,544.1],[-509.8,542.7],[-513.8,541.0],[-518.1,539.2],[-522.2,537.1],[-526.3,535.0],[-530.2,532.8],[-534.2,530.6],[-537.8,528.4],[-541.3,526.2],[-544.8,523.9],[-548.3,521.6],[-551.4,519.4],[-554.9,516.8],[-558.5,514.2],[-561.7,511.6],[-564.5,509.1],[-567.2,506.5],[-569.5,504.2],[-571.6,501.9],[-574.1,499.3],[-575.2,498.0],[-579.4,493.3]]}, // Dunlop
      {side:1,from:.5569,to:.5800,pts:[[710.6,-552.3],[717.3,-553.1],[719.5,-553.4],[723.9,-553.9],[728.3,-554.5],[732.8,-555.2],[737.2,-555.7],[741.6,-556.1],[746.0,-556.4],[750.4,-556.7],[754.7,-556.7],[759.1,-556.4],[763.5,-555.9],[767.9,-555.1],[772.4,-553.6],[776.4,-551.6],[780.1,-549.5],[783.2,-547.1],[786.0,-544.1],[788.2,-540.9],[789.9,-537.3],[791.3,-533.2],[792.2,-528.8],[792.2,-524.2],[791.8,-519.7],[791.0,-515.6],[790.0,-511.6],[788.6,-507.7],[787.2,-503.8],[785.4,-499.9],[783.5,-495.7],[782.5,-493.5],[779.3,-487.2]]}, // Arnage
      {side:1,from:.4323,to:.4672,pts:[[226.1,-379.5],[229.3,-384.2],[230.4,-386.1],[232.6,-389.3],[234.8,-392.8],[237.0,-396.3],[239.2,-399.7],[241.4,-402.9],[243.6,-406.3],[245.8,-409.5],[247.9,-412.6],[250.0,-415.4],[252.1,-418.1],[254.1,-420.5],[256.2,-422.9],[258.3,-425.2],[260.5,-427.4],[263.2,-429.9],[266.4,-432.4],[270.0,-434.5],[274.0,-436.5],[278.4,-438.2],[282.8,-439.3],[287.1,-440.2],[291.5,-441.0],[295.9,-441.6],[300.3,-442.2],[304.8,-442.8],[309.2,-443.3],[313.6,-443.7],[318.0,-444.1],[322.4,-444.5],[326.8,-444.7],[331.2,-444.9],[335.6,-445.3],[337.8,-445.4],[344.1,-446.4]]}, // Indianapolis
      {side:-1,from:.4373,to:.4664,pts:[[259.2,-362.9],[265.4,-366.1],[267.5,-367.2],[271.8,-369.4],[276.2,-371.6],[280.6,-373.9],[285.0,-376.1],[289.4,-378.3],[293.9,-380.5],[298.3,-382.7],[302.7,-384.9],[307.1,-387.1],[311.2,-389.3],[315.2,-391.4],[319.2,-393.6],[323.2,-395.7],[327.2,-397.9],[331.1,-400.2],[335.0,-402.4],[338.6,-404.6],[342.1,-406.9],[345.6,-409.1],[349.4,-411.5],[351.2,-412.7],[357.2,-416.4]]}, // Indianapolis — côté opposé
      {side:1,from:.2931,to:.3189,pts:[[-276.8,-100.1],[-272.8,-102.0],[-271.1,-103.0],[-267.6,-104.8],[-264.0,-106.9],[-260.4,-109.0],[-256.5,-111.2],[-252.6,-113.4],[-248.6,-115.6],[-244.6,-117.9],[-240.6,-120.1],[-236.7,-122.3],[-232.7,-124.5],[-229.1,-126.6],[-225.2,-128.8],[-221.2,-131.1],[-217.2,-133.3],[-213.3,-135.5],[-208.9,-137.8],[-204.6,-140.1],[-200.6,-142.3],[-196.8,-144.3],[-194.8,-145.3],[-190.1,-147.5]]}, // Mulsanne — côté opposé
      {side:-1,from:.2887,to:.3213,pts:[[-277.2,-62.9],[-270.9,-63.0],[-268.7,-63.2],[-264.3,-63.5],[-259.9,-63.9],[-255.4,-64.3],[-251.0,-64.7],[-246.6,-65.1],[-242.6,-65.6],[-238.6,-66.1],[-234.6,-66.6],[-230.9,-67.4],[-227.4,-68.1],[-223.5,-69.1],[-219.6,-70.4],[-215.9,-72.1],[-212.5,-73.9],[-209.3,-76.1],[-206.5,-78.7],[-204.2,-81.4],[-202.0,-84.5],[-199.8,-87.6],[-197.5,-91.1],[-195.4,-94.3],[-192.8,-97.8],[-190.1,-101.2],[-187.4,-104.6],[-184.8,-107.7],[-182.1,-110.8],[-179.8,-113.4],[-177.7,-115.6],[-175.5,-117.9],[-173.0,-120.5],[-171.8,-121.8],[-166.9,-126.5]]}, // Mulsanne
    ],
    // La Passerelle Goodyear et la Passerelle Porsche, nommées comme telles dans le relevé.
    passerelles: [0.0989, 0.9768],
    panneaux: [
      [0.0207, 100, 5, 1],
      [0.0326, 50, 5, 1],
      [0.0467, 50, 'square', -1],
      [0.0602, 0, 'square', -1],
      [0.0807, 100, 'square', -1],
      [0.0926, 50, 'square', -1],
      [0.1045, 0, 'square', -1],
      [0.1148, 0, 2, 1],
      [0.1269, 50, 2, 1],
      [0.1388, 0, 2, 1],
      [0.2531, 200, 'chicane', -1],
      [0.2769, 100, 'chicane', -1],
      [0.2888, 50, 'chicane', -1],
      [0.3007, 0, 'chicane', -1],
      [0.3983, 200, 'chicane', 1],
      [0.4221, 100, 'chicane', 1],
      [0.434, 50, 'chicane', 1],
      [0.446, 0, 'chicane', 1],
      [0.5093, 200, 'square', 1],
      [0.5331, 100, 'square', 1],
      [0.545, 50, 'square', 1],
      [0.5652, 0, 'square', 1],
      [0.6595, 200, 'square', -1],
      [0.6833, 100, 'square', -1],
      [0.6952, 50, 'square', -1],
      [0.7071, 0, 'square', -1],
      [0.7205, 0, 'square', -1],
      [0.7319, 50, 'square', 1],
      [0.7438, 0, 'square', 1],
      [0.7943, 200, 3, 1],
      [0.8181, 100, 3, 1],
      [0.83, 50, 3, 1],
      [0.8419, 0, 3, 1],
      [0.8495, 50, 4, -1],
      [0.8614, 0, 4, -1],
      [0.8771, 0, 3, -1],
      [0.8876, 0, 4, 1],
      [0.9093, 0, 3, -1],
      [0.9257, 50, 5, -1],
      [0.9376, 0, 5, -1],
      [0.9483, 100, 'chicane', -1],
      [0.9602, 50, 'chicane', -1],
      [0.9721, 0, 'chicane', -1],
      [0.9969, 200, 5, 1],
    ],
    /* Le Mans : la pinède des Hunaudières et des Porsche, et au milieu du tour le village —
       fan zones, grande roue, stands de restauration — qu'on voit sur `lemans.jpg`. Peu de
       gravier : le circuit est en grande partie bordé de bitume et de rails, sauf à Mulsanne, à
       Indianapolis, à Arnage et aux virages Porsche. Les stands tiennent toute la ligne droite. */
    runoffs: [
      // Reprise 0.40 (lemans-tour_reprise.png) : contours verts = bitume, rouges = gravier ; chaque
      // contour porte aussi la protection (barrierPaths).
      { name: 'Dunlop — bitume', surface: 'asphalt', side: 1,
        points: [[.0365,0],[.0410,9.1],[.0440,11.6],[.0470,14.2],[.0500,19],[.0530,23],[.0560,26],[.0650,26],[.0680,20.9],[.0710,9.2],[.0732,0]] },
      { name: 'Esses et Tertre Rouge — bitume extérieur', surface: 'asphalt', side: -1,
        points: [[.0532,0],[.0577,10.6],[.0607,18.8],[.0637,29.5],[.0727,29.5],[.0757,27.8],[.0787,22.9],[.0817,17.2],[.0847,15.1],[.0877,15.1],[.0907,16.8],[.0937,18],[.0967,18],[.0997,17.3],[.1027,13.7],[.1057,12],[.1087,12],[.1117,16.7],[.1147,20.5],[.1207,20.5],[.1237,17.4],[.1267,11.7],[.1299,0]] },
      { name: 'Tertre Rouge', surface: 'gravel', side: 1, from: 0.075, to: 0.105, w: 16 },
      { name: 'Sortie du Tertre Rouge — bitume', surface: 'asphalt', side: 1,
        points: [[.0939,0],[.0984,17.3],[.1014,24.2],[.1044,24.4],[.1134,24.2],[.1164,23.3],[.1194,12.8],[.1224,8.6],[.1254,7.8],[.1284,7.2],[.1306,0]] },
      { name: 'Chicane Hunaudieres 2', surface: 'gravel', side: 1, from: 0.134, to: 0.152, w: 14 },
      { name: 'Mulsanne', surface: 'gravel', side: -1,
        points: [[.2856,0],[.2901,15.5],[.2931,21.1],[.2961,21.5],[.3021,21.5],[.3051,17.6],[.3081,17.6],[.3111,17.7],[.3141,17.7],[.3171,15.2],[.3201,11.2],[.3244,0]] },
      { name: 'Mulsanne — côté opposé', surface: 'gravel', side: 1,
        points: [[.2896,0],[.2941,10.4],[.2971,16.7],[.3001,20.9],[.3091,20.9],[.3121,16.6],[.3151,10.5],[.3181,10.4],[.3220,0]] },
      { name: 'Indianapolis', surface: 'gravel', side: 1,
        points: [[.4294,0],[.4339,15.8],[.4369,22.2],[.4399,24.3],[.4459,24.3],[.4489,23.6],[.4519,23.6],[.4549,24.5],[.4579,24.5],[.4609,24.1],[.4639,19.7],[.4669,13.1],[.4701,0]] },
      { name: 'Indianapolis — côté opposé', surface: 'gravel', side: -1,
        points: [[.4341,0],[.4386,9.4],[.4416,16],[.4446,21.7],[.4536,21.7],[.4566,19.2],[.4596,12.6],[.4626,11.4],[.4656,10.4],[.4697,0]] },
      { name: 'Arnage', surface: 'gravel', side: 1,
        points: [[.5537,0],[.5582,10.6],[.5612,12.7],[.5642,14.3],[.5672,16.3],[.5702,19.7],[.5732,19.7],[.5762,17.5],[.5792,12.6],[.5830,0]] },
      { name: 'Porsche 1', surface: 'gravel', side: 1, from: 0.7, to: 0.718, w: 15 },
      { name: 'Porsche 2', surface: 'gravel', side: -1, from: 0.715, to: 0.734, w: 15 },
      { name: 'Porsche 3', surface: 'gravel', side: 1, from: 0.738, to: 0.756, w: 15 },
      { name: 'Maison Blanche', surface: 'asphalt', side: -1,
        points: [[.8537,0],[.8582,10.1],[.8612,12.6],[.8642,14.9],[.8672,15.2],[.8702,15.8],[.8732,15.8],[.8762,15.1],[.8792,14],[.8822,13.7],[.8866,0]] },
      { name: 'Maison Blanche — sortie', surface: 'asphalt', side: 1,
        points: [[.8856,0],[.8901,9],[.8931,11.8],[.8961,15],[.8991,15],[.9021,12.6],[.9051,12.6],[.9081,13.3],[.9111,14.5],[.9141,14.5],[.9171,14.2],[.9201,11.6],[.9231,8.6],[.9261,7.2],[.9291,7.2],[.9321,9],[.9351,9.7],[.9366,0]] },
      { name: 'Chicane Ford', surface: 'asphalt', side: -1,
        points: [[.9072,0],[.9117,7.8],[.9147,11],[.9177,14.6],[.9207,17.5],[.9237,19.8],[.9267,21.6],[.9297,22.3],[.9327,22.3],[.9357,20.6],[.9387,17.5],[.9417,13.4],[.9447,10.4],[.9482,0]] },
      { name: 'Chicane Ford — sortie', surface: 'asphalt', side: 1,
        points: [[.9680,0],[.9725,11.8],[.9755,11.9],[.9785,14.6],[.9815,16.6],[.9875,16.6],[.9905,12],[.9937,0]] },
    ],
    implantation: [
      { kind: 'stands', side: -1, from: 0.955, to: 0.035, recul: 12, prof: 26, module: 46 },
      { kind: 'tribune', side: 1, from: 0.96, to: 0.045, recul: 11, prof: 20, module: 34 },
      { kind: 'bois', side: 1, from: 0.06, to: 0.29, recul: 13, prof: 70, essence: 'pinede' },
      { kind: 'bois', side: -1, from: 0.14, to: 0.29, recul: 14, prof: 80, essence: 'pinede' },
      { kind: 'bois', side: 1, from: 0.33, to: 0.43, recul: 13, prof: 65, essence: 'pinede' },
      { kind: 'bois', side: -1, from: 0.33, to: 0.55, recul: 14, prof: 75, essence: 'pinede' },
      { kind: 'bois', side: 1, from: 0.47, to: 0.69, recul: 13, prof: 70, essence: 'pinede' },
      { kind: 'bois', side: -1, from: 0.6, to: 0.7, recul: 14, prof: 60, essence: 'pinede' },
      { kind: 'bois', side: 1, from: 0.76, to: 0.85, recul: 14, prof: 55, essence: 'pinede' },
      { kind: 'hangars', side: -1, from: 0.76, to: 0.85, recul: 18, prof: 30, module: 26 },
      { kind: 'parking', side: -1, from: 0.86, to: 0.93, recul: 20, prof: 44 },
      { kind: 'tribune', side: 1, from: 0.88, to: 0.95, recul: 13, prof: 17, module: 30 },
      // Camping-cars garés en long derrière la protection, hors des parkings.
      { kind: 'camping', side: -1, from: 0.15, to: 0.28, recul: 2.5 },
      { kind: 'camping', side: 1, from: 0.12, to: 0.27, recul: 2.5 },
    ],
    lines: {
      racing: [[-30.646, 64.631], [-34.192, 66.924], [-43.868, 68.498], [-61.058, 69.201], [-71.338, 63.674], [-82.061, 56.906], [-87.38, 47.91], [-93.609, 46.011], [-99.897, 36.052], [-94.005, 25.086], [-85.689, 17.354], [-76.08, 10.955], [-66.162, 5.464], [-55.977, 0.186], [-45.87, -4.963], [-35.615, -10.189], [-25.465, -14.515], [-25.878, -16.043], [-7.06, -26.462], [2.869, -32.198], [12.696, -37.85], [22.658, -43.527], [33.736, -50.067], [37.181, -53.431], [43.148, -55.011], [62.437, -62.535], [73.349, -65.61], [84.455, -68.476], [95.729, -70.285], [99.862, -67.102], [99.368, -50.665], [97.788, -39.288], [95.223, -28.238], [91.661, -17.321], [87.176, -6.898], [80.024, 4.651], [75.175, 8.365], [80.044, 18.868], [69.436, 25.352], [59.251, 30.321], [50.151, 37.02], [37.663, 46.998], [30.503, 46.936], [21.404, 44.769], [12.408, 52.754], [2.272, 50.669], [-8.727, 53.076], [-19.119, 57.703]],
      inside: [[-28.252, 63.735], [-38.607, 67.173], [-49.814, 68.869], [-61.018, 68.956], [-70.296, 63.653], [-79.335, 58.411], [-87.074, 50.5], [-94.446, 44.316], [-99.578, 36.176], [-93.266, 25.87], [-85.033, 18.118], [-75.477, 12.033], [-65.566, 6.535], [-55.528, 0.993], [-45.596, -4.477], [-33.735, -11.182], [-29.103, -12.986], [-24.502, -17.037], [-7.477, -27.205], [2.528, -32.813], [12.426, -38.335], [22.432, -43.933], [32.921, -49.567], [39.407, -53.224], [51.718, -58.398], [62.717, -61.467], [73.673, -64.375], [84.773, -67.238], [98.033, -69.536], [99.117, -62.045], [98.189, -50.746], [97.182, -39.401], [94.247, -28.514], [90.988, -17.6], [86.246, -7.336], [81.695, 2.939], [75.773, 9.5], [79.673, 19.363], [77.298, 20.725], [59.269, 30.347], [50.321, 37.246], [40.015, 45.43], [32.154, 47.658], [22.106, 45.244], [12.475, 52.109], [2.311, 50.832], [-8.706, 53.362], [-18.893, 58.157]],
      outside: [[-26.848, 61.754], [-33.459, 66.144], [-49.606, 70.13], [-61.222, 70.217], [-71.914, 63.798], [-78.992, 58.996], [-83.811, 54.854], [-84.798, 50.263], [-100.149, 34.956], [-94.143, 24.94], [-85.866, 17.148], [-76.101, 10.917], [-66.187, 5.418], [-56.149, -0.124], [-46.223, -5.591], [-32.466, -11.091], [-28.553, -9.364], [-26.856, -15.31], [-6.852, -26.09], [3.147, -31.695], [13.047, -37.218], [23.054, -42.817], [35.947, -52.843], [37.696, -54.316], [42.591, -53.027], [62.392, -62.704], [73.349, -65.612], [84.455, -68.476], [98.849, -70.351], [100.316, -61.962], [99.465, -50.658], [98.438, -39.167], [95.477, -28.166], [92.169, -17.11], [83.511, -0.858], [76.557, 6.116], [75.299, 8.716], [81.406, 19.363], [69.25, 24.945], [58.548, 29.291], [43.234, 43.325], [39.396, 47.988], [35.496, 47.782], [25.015, 44.192], [11.665, 53.353], [2.216, 50.437], [-8.724, 53.114], [-19.464, 57.013]],
    },
  },
  {
    id: 'bathurst', name: 'Kangaroo Mountain', country: 'AU', flag: '🇦🇺', theme: 'bush',
    runoffJoinGap: 60,
    architecture: 'pavillons',
    barriers: true,   // protections dessinées et collisions : voir docs/spa-barrieres/README.md
    kerb: DRAPEAUX.au,
    length: 3600, width: 13,
    pts: TRACES.bathurst,
    barrierPaths: [
      {side:1,from:.3454,to:.3856,pts:[[211.7,300.6],[213.2,294.3],[213.9,292.5],[215.5,288.7],[217.5,285.2],[219.8,282.0],[222.5,278.8],[225.5,275.8],[228.6,272.9],[231.8,270.3],[235.0,267.9],[238.1,265.8],[241.2,263.9],[244.3,262.1],[247.4,260.4],[250.5,258.8],[253.5,257.2],[256.6,255.7],[259.7,254.1],[263.1,252.6],[266.5,251.0],[269.9,249.5],[273.6,247.9],[277.6,246.3],[281.4,244.8],[285.4,243.2],[289.8,241.7],[294.1,240.2],[298.2,238.7],[302.2,237.5],[305.9,236.3],[309.3,235.4],[312.4,234.7],[315.5,234.1],[318.6,233.5],[321.7,233.1],[324.8,232.8],[327.9,232.6],[331.0,232.6],[334.1,232.9],[337.2,233.2],[340.5,233.9],[343.9,235.1],[347.3,236.6],[350.7,238.5],[354.0,240.7],[355.6,241.9],[359.9,245.2]]}, // Sortie de la Cutting — contour
      {side:1,from:.5348,to:.5842,pts:[[525.0,-16.3],[523.7,-19.4],[523.0,-20.8],[521.8,-23.5],[520.3,-26.7],[518.8,-29.8],[517.2,-33.2],[515.6,-36.6],[514.1,-40.0],[512.5,-43.4],[511.0,-46.8],[509.4,-50.2],[507.9,-53.6],[506.3,-57.0],[504.8,-60.7],[503.2,-64.4],[501.6,-68.2],[500.1,-71.9],[498.5,-75.9],[497.0,-80.0],[495.5,-84.3],[494.0,-88.4],[492.7,-92.7],[491.6,-96.7],[490.7,-100.4],[490.0,-103.8],[489.3,-107.2],[488.8,-110.3],[488.5,-113.7],[488.2,-117.1],[487.9,-120.5],[487.9,-123.9],[487.8,-127.4],[487.9,-130.7],[487.9,-134.2],[488.0,-137.8],[488.2,-141.5],[488.5,-145.2],[488.8,-148.7],[489.1,-152.1],[489.6,-155.3],[489.9,-158.4],[490.2,-161.5],[490.6,-164.8],[491.1,-168.2],[491.5,-171.6],[491.9,-175.3],[492.5,-179.0],[493.0,-182.5],[493.3,-184.3],[494.0,-189.4]]}, // Skyline et Esses — contour gauche
      {side:-1,from:.5456,to:.5768,pts:[[545.4,-61.0],[545.6,-64.3],[545.8,-65.7],[545.9,-68.4],[546.1,-71.5],[546.2,-74.7],[546.2,-77.8],[546.2,-80.9],[546.2,-84.0],[546.1,-87.1],[545.9,-90.2],[545.8,-93.3],[545.6,-96.4],[545.4,-99.5],[545.3,-102.6],[545.3,-105.7],[545.1,-108.8],[544.8,-111.9],[544.5,-115.0],[544.2,-118.1],[543.9,-121.1],[543.4,-124.6],[543.0,-128.0],[542.3,-131.4],[541.7,-134.8],[540.8,-138.6],[539.8,-142.3],[538.6,-146.0],[537.3,-149.7],[535.7,-153.5],[533.9,-157.0],[532.2,-160.1],[530.4,-163.2],[529.4,-164.8],[526.7,-169.3]]}, // Skyline et Esses — contour droit
      {side:1,from:.8808,to:.9021,pts:[[-297.2,-82.5],[-302.8,-82.1],[-304.4,-81.9],[-307.7,-81.5],[-310.8,-81.2],[-313.9,-80.9],[-317.0,-80.4],[-320.1,-80.0],[-323.3,-79.2],[-326.3,-77.7],[-329.0,-75.6],[-331.4,-73.0],[-333.5,-69.9],[-335.2,-66.7],[-336.7,-63.4],[-337.5,-61.8],[-339.8,-56.3]]}, // Murray’s — protection reprise
      {side:-1,from:.3335,to:.3592,pts:[[226.1,351.7],[227.8,347.0],[228.4,345.2],[229.6,341.6],[230.9,337.7],[232.3,333.6],[233.8,329.4],[235.4,325.4],[236.9,321.6],[238.5,318.1],[240.0,314.8],[241.8,311.6],[243.8,308.4],[246.2,305.2],[248.8,302.0],[251.8,298.9],[255.0,295.9],[258.1,293.2],[261.3,290.7],[262.9,289.4],[267.4,286.5]]}, // Cutting — protection droite reprise
      {side:1,from:.3047,to:.3441,pts:[[162.0,303.9],[164.4,309.5],[165.2,311.1],[166.8,314.4],[168.4,317.4],[170.3,320.5],[172.4,323.6],[174.8,326.8],[177.4,330.0],[180.3,333.3],[183.4,336.4],[186.5,339.0],[189.8,340.6],[193.2,340.8],[196.1,339.9],[198.7,337.7],[200.9,334.8],[202.7,331.6],[203.9,328.3],[205.1,324.8],[206.3,321.1],[207.2,317.4],[208.2,313.7],[209.1,310.6],[209.6,308.8],[210.6,305.7]]}, // Cutting — protection gauche reprise
    ],
    panneaux: [
      [0.0056, 200, 'square', -1],
      [0.0333, 100, 'square', -1],
      [0.0472, 50, 'square', -1],
      [0.0611, 0, 'square', -1],
      [0.1853, 200, 2, 1],
      [0.2131, 100, 2, 1],
      [0.2269, 50, 2, 1],
      [0.2408, 0, 2, 1],
      [0.2789, 100, 'hairpin', -1],
      [0.2928, 50, 'hairpin', -1],
      [0.3067, 0, 'hairpin', -1],
      [0.3469, 100, 5, 1],
      [0.3608, 50, 5, 1],
      [0.3747, 0, 5, 1],
      [0.3894, 100, 6, -1],
      [0.4033, 50, 6, -1],
      [0.4172, 0, 6, -1],
      [0.435, 0, 6, -1],
      [0.4542, 100, 5, -1],
      [0.4681, 50, 5, -1],
      [0.4819, 0, 5, -1],
      [0.5075, 100, 6, 1],
      [0.5214, 50, 6, 1],
      [0.5353, 0, 6, 1],
      [0.5567, 0, 2, 1],
      [0.5697, 0, 2, -1],
      [0.5803, 100, 5, 1],
      [0.5942, 50, 5, 1],
      [0.6081, 0, 5, 1],
      [0.6253, 0, 2, -1],
      [0.7917, 200, 6, 1],
      [0.8194, 100, 6, 1],
      [0.8333, 50, 6, 1],
      [0.8472, 0, 6, 1],
      [0.8614, 100, 2, -1],
      [0.8753, 50, 2, -1],
      [0.8892, 0, 2, -1],
      [0.9261, 200, 'square', -1],
      [0.9539, 100, 'square', -1],
      [0.9678, 50, 'square', -1],
      [0.9817, 0, 'square', -1],
      [0.3208, 0, 'hairpin', 1],
      [0.5417, 50, 2, 1],
      [0.6114, 50, 2, -1],
    ],
    /* Mount Panorama n'est pas un circuit mais une route de montagne fermée : un mur de béton de
       chaque côté sur toute la traversée du sommet, et donc presque pas de dégagement. Les seuls
       bacs sont en bas, à Hell Corner et à Murray's. Relevé sur `Mount-Panorama_2.jpg` : l'eucalyptus
       clairsemé tient le flanc, le sommet est nu et pelé, et les tribunes sont groupées sur la
       ligne droite de Pit Straight. */
    runoffs: [
      { name: 'Hell Corner', surface: 'gravel', side: -1, from: 0.052, to: 0.082, w: 12 },
      { name: 'Griffins Bend', surface: 'gravel', side: 1, from: 0.232, to: 0.272, w: 11 },
      { name: 'Forrest Elbow', surface: 'gravel', side: -1, from: 0.618, to: 0.648, w: 10 },
      // Reprise 0.40 (bathurst-tour_reprise.png) : croix sur le bac de The Chase et sur celui
      // d'après Forrest Elbow ; contours rouges en gravier, qui portent aussi la protection.
      { name: 'The Chase — sans bac', surface: 'grass', side: 1, points: [[.836,0],[.864,0]] },
      { name: 'Après Forrest Elbow — sans bac', surface: 'grass', side: -1, points: [[.655,0],[.682,0]] },
      { name: 'Sortie de la Cutting — gravier extérieur', surface: 'gravel', side: 1,
        points: [[.3423,0],[.3468,12.2],[.3498,12.3],[.3528,12.3],[.3558,12.3],[.3588,12.4],[.3618,12.7],[.3648,12.9],[.3678,13],[.3708,13],[.3738,13],[.3768,13],[.3798,13.7],[.3828,13.7],[.3858,11.9],[.3888,0]] },
      { name: 'Skyline et Esses — gravier gauche', surface: 'gravel', side: 1,
        points: [[.5317,0],[.5362,9],[.5392,12.5],[.5422,17.8],[.5452,21.5],[.5482,22.3],[.5512,22.3],[.5542,21.9],[.5572,19.3],[.5602,15.8],[.5632,15.8],[.5662,22.5],[.5782,22.5],[.5812,15.1],[.5842,10.3],[.5874,0]] },
      { name: 'Skyline et Esses — gravier droit', surface: 'gravel', side: -1,
        points: [[.5426,0],[.5471,11],[.5501,17.7],[.5531,29.2],[.5561,29.8],[.5711,29.8],[.5741,11.3],[.5771,9.5],[.5799,0]] },
      { name: 'Murrays Corner', surface: 'gravel', side: -1, from: 0.882, to: 0.922, w: 14 },
    ],
    implantation: [
      { kind: 'stands', side: -1, from: 0.955, to: 0.045, recul: 10, prof: 20, module: 36 },
      { kind: 'tribune', side: 1, from: 0.96, to: 0.05, recul: 9, prof: 17, module: 28 },
      { kind: 'parking', side: -1, from: 0.06, to: 0.12, recul: 16, prof: 32 },
      { kind: 'bois', side: 1, from: 0.1, to: 0.24, recul: 10, prof: 44, densite: 0.4 },
      { kind: 'bois', side: -1, from: 0.14, to: 0.3, recul: 11, prof: 50, densite: 0.35 },
      { kind: 'bois', side: 1, from: 0.27, to: 0.35, recul: 9, prof: 36, densite: 0.45 },
      { kind: 'nu', side: 1, from: 0.36, to: 0.52, prof: 110 },
      { kind: 'nu', side: -1, from: 0.36, to: 0.52, prof: 110 },
      { kind: 'bois', side: -1, from: 0.53, to: 0.68, recul: 9, prof: 46, densite: 0.5 },
      { kind: 'bois', side: 1, from: 0.56, to: 0.7, recul: 10, prof: 40, densite: 0.45 },
      { kind: 'bois', side: -1, from: 0.7, to: 0.83, recul: 12, prof: 44, densite: 0.4 },
      { kind: 'bois', side: 1, from: 0.72, to: 0.83, recul: 12, prof: 40, densite: 0.35 },
      // Camping-cars garés en long derrière la protection, hors des parkings.
      { kind: 'camping', side: 1, from: 0.835, to: 0.89, recul: 2.5 },
      { kind: 'camping', side: -1, from: 0.835, to: 0.89, recul: 2.5 },
    ],
    // Une passerelle sur Pit Straight, une sur Conrod Straight.
    passerelles: [0.0050, 0.9391],
  },
  {
    id: 'redbullring', name: 'Apfelstrudel Ring', country: 'AT', flag: '🇦🇹', theme: 'alpine',
    architecture: 'terrasses',
    barriers: true,   // protections dessinées et collisions : voir docs/spa-barrieres/README.md
    kerb: DRAPEAUX.at,
    length: 2400, width: 15,
    pts: TRACES.redbullring,
    /* Croix rouges de la reprise : plus de voie des stands ni de garages le long de la ligne droite
       d'avant le dernier virage. La voie part de la sortie du virage et longe la ligne de départ. */
    pitFrom: 0.978, pitTo: 0.075, pitAt: 0.025,
    barrierPaths: [
      {side:1,from:.5969,to:.6347,pts:[[-51.2,16.9],[-48.7,13.1],[-47.4,11.5],[-45.1,8.5],[-42.3,5.3],[-39.3,2.1],[-36.2,-1.0],[-33.1,-3.9],[-29.9,-6.5],[-26.7,-8.9],[-23.6,-11.1],[-20.4,-13.1],[-17.3,-14.9],[-14.2,-16.5],[-11.1,-18.1],[-8.0,-19.6],[-4.9,-20.9],[-1.8,-22.2],[1.3,-23.4],[4.3,-24.5],[7.4,-25.6],[10.7,-26.6],[14.2,-27.7],[17.8,-28.7],[21.3,-29.7],[24.8,-30.7],[28.1,-31.5],[31.4,-32.3],[33.0,-32.7],[38.3,-33.8]]}, // Virage 6-7 — contour gauche
      {side:-1,from:.1746,to:.2133,pts:[[-306.6,-186.1],[-310.9,-190.7],[-311.9,-192.2],[-313.4,-195.3],[-313.7,-198.1],[-312.7,-200.5],[-310.7,-202.5],[-307.9,-204.0],[-306.3,-204.6],[-301.7,-205.7]]}, // Virage 1 — protection arrondie
      {side:-1,from:.3677,to:.4515,pts:[[63.2,-162.9],[67.9,-162.1],[69.5,-161.3],[72.0,-159.7],[73.7,-157.4],[74.5,-154.8],[74.4,-151.7],[73.1,-148.5],[72.4,-146.9],[69.6,-141.7],[64.4,-136.9],[60.1,-133.9],[58.7,-132.8],[55.8,-130.8],[52.8,-128.7],[49.9,-126.7],[46.8,-124.7],[43.7,-122.8],[40.6,-121.0],[37.5,-119.3],[34.4,-117.9],[31.3,-116.6],[28.1,-115.4],[24.8,-114.4],[21.5,-113.6],[18.2,-112.8],[14.9,-112.2],[11.6,-111.7],[8.5,-111.4],[5.4,-111.1],[2.3,-110.9],[-0.8,-110.8],[-3.9,-110.7],[-7.1,-110.7],[-10.2,-110.8],[-13.3,-110.9],[-16.4,-111.0],[-19.5,-111.1],[-21.0,-111.1],[-25.7,-111.2]]}, // Virage 3 — protection intérieure reprise
    ],
    panneaux: [
      [0.105, 200, 'acute', 1],
      [0.1467, 100, 'acute', 1],
      [0.1675, 50, 'acute', 1],
      [0.1883, 0, 'acute', 1],
      [0.2917, 200, 'square', 1],
      [0.3333, 100, 'square', 1],
      [0.3542, 50, 'square', 1],
      [0.375, 0, 'square', 1],
      [0.405, 50, 4, 1],
      [0.4258, 0, 4, 1],
      [0.4425, 100, 2, -1],
      [0.4633, 50, 2, -1],
      [0.4842, 0, 2, -1],
      [0.5175, 100, 2, -1],
      [0.5383, 50, 2, -1],
      [0.5592, 0, 2, -1],
      [0.5833, 50, 4, 1],
      [0.6042, 0, 4, 1],
      [0.6554, 200, 3, 1],
      [0.6971, 100, 3, 1],
      [0.7179, 50, 3, 1],
      [0.7388, 0, 3, 1],
      [0.7717, 50, 2, 1],
      [0.7925, 0, 2, 1],
      [0.8892, 200, 'square', 1],
      [0.9308, 100, 'square', 1],
      [0.9517, 50, 'square', 1],
      [0.9725, 0, 'square', 1],
    ],
    /* Le Red Bull Ring a été relevé sur `red_bull_ring.jpg`, qui porte sa propre légende : piste,
       dégagement bitumé, bac à gravier, gazon synthétique, zones spectateurs, stands, forêt. La
       forêt remplit l'intérieur de la boucle et borde les deux grandes montées ; les bacs sont au
       sommet de chaque virage ; le paddock tient le bas du tour, sous la colline. */
    runoffs: [
      { name: 'Virage 1', surface: 'gravel', side: 1, from: 0.178, to: 0.212, w: 17 },
      { name: 'Virage 2', surface: 'asphalt', side: -1, from: 0.108, to: 0.15, w: 13 },
      { name: 'Virage 3', surface: 'gravel', side: 1, from: 0.364, to: 0.456, w: 18 },
      { name: 'Virage 4', surface: 'gravel', side: -1, from: 0.474, to: 0.536, w: 16 },
      { name: 'Virage 6-7', surface: 'gravel', side: -1, from: 0.548, to: 0.648, w: 17 },
      { name: 'Virage 8', surface: 'asphalt', side: 1, from: 0.728, to: 0.772, w: 14 },
      { name: 'Virage 9', surface: 'gravel', side: 1, from: 0.782, to: 0.826, w: 16 },
      { name: 'Virage 10', surface: 'gravel', side: 1, from: 0.962, to: 0.998, w: 15 },
      // Reprise 0.40 (redbullring-tour_reprise.png) : contour rouge en gravier, qui porte la protection.
      { name: 'Virage 6-7 — gravier extérieur gauche', surface: 'gravel', side: 1,
        points: [[.5937,0],[.5982,11.6],[.6012,11.9],[.6042,11.9],[.6072,11.7],[.6102,11.6],[.6132,11.3],[.6162,11],[.6192,10.7],[.6222,10.5],[.6252,10.3],[.6282,10.3],[.6312,10.3],[.6342,11.3],[.6380,0]] },
    ],
    implantation: [
      { kind: 'stands', side: -1, from: 0.0, to: 0.085, recul: 11, prof: 22, module: 40 },
      { kind: 'tribune', side: 1, from: 0.005, to: 0.09, recul: 10, prof: 18, module: 30 },
      { kind: 'bois', side: -1, from: 0.215, to: 0.35, recul: 13, prof: 70, essence: 'pinede' },
      { kind: 'bois', side: 1, from: 0.095, to: 0.17, recul: 14, prof: 60, essence: 'pinede' },
      { kind: 'bois', side: 1, from: 0.47, to: 0.54, recul: 14, prof: 50, essence: 'pinede' },
      { kind: 'bois', side: -1, from: 0.66, to: 0.72, recul: 14, prof: 55, essence: 'pinede' },
      { kind: 'bois', side: 1, from: 0.58, to: 0.72, recul: 13, prof: 60, essence: 'pinede' },
      { kind: 'tribune', side: -1, from: 0.38, to: 0.44, recul: 14, prof: 15, module: 26 },
      { kind: 'tribune', side: 1, from: 0.83, to: 0.89, recul: 13, prof: 16, module: 28 },
      { kind: 'parking', side: -1, from: 0.86, to: 0.95, recul: 18, prof: 40 },
      { kind: 'hangars', side: -1, from: 0.79, to: 0.85, recul: 16, prof: 24, module: 24 },
      // Camping-cars garés en long derrière la protection, hors des parkings.
      { kind: 'camping', side: 1, from: 0.2, to: 0.38, recul: 2.5 },
    ],
  },
  {
    /* PAUL RICARD — LE CASTELLET, relevé sur `art/reprise circuit/Map Castellet.JPG`.

    Le seul circuit du roster où le décor n'est pas ce qui le distingue : ce sont ses DÉGAGEMENTS.
    Des bandes peintes, bleues près de la piste et rouges près du mur, de plus en plus abrasives à
    mesure qu'on s'en éloigne — sur la vue du dessus, c'est la première chose qu'on voit, avant le
    tracé. D'où `runoffRaye`, qui n'existe que pour lui.

    Le reste est une pinède du Var posée sur un plateau, avec la piste d'aviation le long de la
    ligne droite du Mistral et le paddock entre les deux. Presque pas de gravier : le Castellet a
    remplacé ses bacs par le bitume peint, et c'est précisément pour cela qu'il a cette tête-là. */
    id: 'castellet', name: 'Pastaga 83', country: 'FR', flag: '🇫🇷', theme: 'lemans',
    architecture: 'plats',
    barriers: true,   // protections dessinées et collisions : voir docs/spa-barrieres/README.md
    kerb: DRAPEAUX.fr,
    length: 3000, width: 14,
    pts: TRACES.castellet,
    /* Trait noir : la voie des stands ne contourne plus l'épingle du Pont, elle part à sa sortie.
       Traits bleus à la Sainte-Baume et au Pont : les cordes pointues sont arrondies (rayon intérieur
       d'environ 3 m), la chaussée y est resserrée d'un mètre et demi. */
    pitFrom: 0.952, pitTo: 0.034, pitAt: 0.9773,
    // L'intérieur de l'épingle du Pont, bitumé jusqu'au trait vert, qui porte aussi la protection.
    asphaltPads: [{side:-1,pts:[[-222.0,119.0],[-222.0,115.5],[-222.0,114.0],[-222.1,111.1],[-222.1,107.8],[-222.2,104.5],[-222.4,101.3],[-222.6,97.7],[-222.8,94.1],[-223.1,90.5],[-223.0,86.9],[-222.9,83.3],[-222.4,80.0],[-221.5,76.7],[-220.3,73.5],[-218.9,70.3],[-216.9,67.1],[-214.6,63.8],[-212.0,60.6],[-210.7,58.9],[-206.0,53.9]]}],
    roadWidenings: [{side:-1,points:[[.254,0],[.258,-.9],[.2623,-1.5],[.266,-.9],[.270,0]]},
      {side:-1,points:[[.936,0],[.940,-.9],[.944,-1.5],[.948,-.9],[.952,0]]}],
    barrierPaths: [
      {side:1,from:.2252,to:.2609,pts:[[410.9,-367.7],[415.4,-366.8],[417.0,-366.4],[420.2,-365.6],[423.5,-364.8],[426.7,-364.0],[430.0,-363.4],[433.3,-362.8],[436.6,-362.3],[439.8,-362.0],[443.4,-362.0],[447.1,-362.3],[450.7,-363.2],[454.3,-364.5],[457.9,-366.3],[461.2,-368.7],[464.5,-371.3],[467.5,-374.3],[470.5,-377.5],[473.4,-380.8],[474.8,-382.4],[478.9,-387.5]]}, // Sainte-Baume — contour extérieur
      {side:1,from:.9203,to:.9563,pts:[[-255.2,127.4],[-258.9,124.9],[-260.5,123.8],[-263.4,121.9],[-266.8,119.7],[-270.1,117.4],[-273.3,115.0],[-276.6,112.4],[-280.0,109.5],[-283.2,106.5],[-286.4,103.2],[-289.3,99.8],[-291.8,96.4],[-293.9,93.1],[-295.6,89.8],[-296.9,86.5],[-298.0,83.3],[-298.7,80.0],[-299.0,76.8],[-299.1,73.5],[-298.7,70.3],[-297.8,67.0],[-296.1,63.7],[-293.8,60.4],[-290.9,57.5],[-287.4,54.9],[-283.7,52.7],[-279.8,50.8],[-275.6,49.1],[-271.3,47.5],[-267.4,46.3],[-263.5,45.0],[-259.9,44.0],[-258.3,43.6],[-253.6,42.5]]}, // Virage du Pont — contour extérieur
      {side:-1,free:true,from:.9213,to:.9692,pts:[[-222.0,119.0],[-222.0,115.5],[-222.0,114.0],[-222.1,111.1],[-222.1,107.8],[-222.2,104.5],[-222.4,101.3],[-222.6,97.7],[-222.8,94.1],[-223.1,90.5],[-223.0,86.9],[-222.9,83.3],[-222.4,80.0],[-221.5,76.7],[-220.3,73.5],[-218.9,70.3],[-216.9,67.1],[-214.6,63.8],[-212.0,60.6],[-210.7,58.9],[-206.0,53.9]]}, // Virage du Pont — contour intérieur
    ],
    runoffRaye: true,
    /* Les secteurs sont posés sur les virages du tracé relevé, et non devinés : la courbure donne
       le S de la Verrerie vers 0,11-0,16, l'hôtel et le camp vers 0,18-0,25, la Sainte-Baume vers
       0,26-0,33, puis TRENTE POUR CENT DE TOUR SANS LE MOINDRE VIRAGE — la ligne droite du
       Mistral — Signes à 0,67, le Beausset à 0,77, la longue gauche Bendor-Garlaban-Lac de 0,81
       à 0,93, et l'épingle du Pont à 0,94. */
    runoffs: [
      { name: 'S de la Verrerie', surface: 'asphalt', side: -1, from: 0.098, to: 0.122, w: 20 },
      { name: 'S de la Verrerie, sortie', surface: 'asphalt', side: 1, from: 0.118, to: 0.168, w: 19 },
      { name: "Virage de l'hotel", surface: 'asphalt', side: -1, from: 0.176, to: 0.198, w: 16 },
      /* Les deux secteurs du même côté se TOUCHENT sans se recouvrir. À cheval, le second
         réécrivait le premier avec sa propre valeur d'ouverture — c'est-à-dire zéro — et la
         largeur tombait d'un coup au milieu du virage du camp. Bord à bord, chacun s'y referme
         sur zéro et le raccord est continu. */
      { name: 'Virage du camp', surface: 'asphalt', side: 1, from: 0.196, to: 0.252, w: 20 },
      { name: 'Sainte-Baume', surface: 'asphalt', side: 1, from: 0.252, to: 0.32, w: 24 },
      { name: 'Sainte-Baume, sortie', surface: 'asphalt', side: -1, from: 0.316, to: 0.34, w: 18 },
      { name: 'Courbe de Signes', surface: 'asphalt', side: 1, from: 0.648, to: 0.695, w: 26 },
      { name: 'Double droite du Beausset', surface: 'asphalt', side: 1, from: 0.718, to: 0.798, w: 22 },
      { name: 'Bendor / Garlaban / Lac', surface: 'asphalt', side: -1, from: 0.802, to: 0.934, w: 21 },
      /* Reprise 0.40 (castellet-tour_reprise.png). Contours verts en bitume : l'extérieur de la
         Sainte-Baume resserré, le bac de sa corde et l'intérieur de l'épingle bitumés jusqu'au trait,
         l'épingle du Pont bitumée des deux côtés. Les zones « grass » retirent d'abord le gravier
         automatique, pour que le bitume aille seul jusqu'au trait. */
      { name: 'Sainte-Baume — extérieur resserré', surface: 'asphalt', side: 1,
        points: [[.2253,20],[.2268,16.7],[.2298,17.2],[.2538,20.4],[.2568,15.7],[.2598,12.3],[.2613,12]] },
      { name: 'Sainte-Baume — corde, sans bac', surface: 'grass', side: -1, points: [[.232,0],[.294,0]] },
      { name: 'Sainte-Baume — corde bitumée', surface: 'asphalt', side: -1,
        points: [[.233,0],[.2375,6],[.2405,7],[.2435,11],[.2465,7],[.2495,5.4],[.2525,5.3],[.2555,4],[.2585,1.5],[.2665,1.5],[.2705,4],[.2735,8.8],[.2765,8.7],[.2795,9.5],[.2825,10.4],[.2855,10.1],[.2885,10.3],[.293,0]] },
      { name: 'Virage du Pont — sans bac', surface: 'grass', side: 1, points: [[.916,0],[.964,0]] },
      { name: 'Virage du Pont — extérieur bitumé', surface: 'asphalt', side: 1,
        points: [[.917,0],[.9215,21.4],[.9305,22.1],[.9335,21.8],[.9365,21],[.9395,19.5],[.9425,16.9],[.9455,17.2],[.9485,15.2],[.9515,14.3],[.9545,12.8],[.9575,11.3],[.961,0]] },
    ],
    implantation: [
      { kind: 'stands', side: -1, from: 0.955, to: 0.025, recul: 12, prof: 24, module: 44 },
      { kind: 'tribune', side: 1, from: 0.96, to: 0.03, recul: 11, prof: 18, module: 32 },
      { kind: 'hangars', side: -1, from: 0.03, to: 0.1, recul: 18, prof: 30, module: 30 },
      { kind: 'bois', side: 1, from: 0.06, to: 0.26, recul: 13, prof: 60, essence: 'pinede' },
      { kind: 'bois', side: -1, from: 0.13, to: 0.27, recul: 14, prof: 55, essence: 'pinede' },
      { kind: 'bois', side: 1, from: 0.29, to: 0.45, recul: 13, prof: 70, essence: 'pinede' },
      // La piste d'aviation longe la ligne droite du Mistral : du bitume nu, et rien d'autre.
      { kind: 'nu', side: -1, from: 0.345, to: 0.64, prof: 130 },
      { kind: 'parking', side: -1, from: 0.4, to: 0.47, recul: 24, prof: 40 },
      { kind: 'bois', side: 1, from: 0.48, to: 0.64, recul: 14, prof: 65, essence: 'pinede' },
      { kind: 'bois', side: 1, from: 0.7, to: 0.8, recul: 15, prof: 60, essence: 'pinede' },
      { kind: 'bois', side: -1, from: 0.66, to: 0.79, recul: 16, prof: 55, essence: 'pinede' },
      { kind: 'bois', side: 1, from: 0.86, to: 0.93, recul: 15, prof: 45, essence: 'pinede' },
      { kind: 'parking', side: 1, from: 0.0, to: 0.05, recul: 34, prof: 34 },
      // Camping-cars garés en long derrière la protection, hors des parkings.
      { kind: 'camping', side: -1, from: 0.84, to: 0.905, recul: 2.5 },
    ],
  },
  {
    id: 'zandvoort', name: 'Windmolen', country: 'NL', flag: '🇳🇱', theme: 'dunes',
    parallelClearance: true, // Limiter les dégagements aux couloirs réellement disponibles.
    // Garder l’arrêt et les trois garages sur la ligne droite, hors de Hunserug.
    pitAt: 0.0039, pitLength: 220,
    annotatedRunoffsOnly: true,
    roadWidenings: [{side:-1,points:[[.164,0],[.177,0],[.186,5],[.195,9],[.202,5],[.212,0]]}],
    // Les croix de l’annotation suppriment le dégagement, quelle que soit leur couleur.
    barrierCloseZones: [
      {side:-1,from:.102,to:.145},
      {side:-1,from:.26,to:.309}, {side:1,from:.30,to:.346},
      {side:-1,from:.615,to:.68}, {side:1,from:.837,to:.916},
    ],
    architecture: 'plats',
    barriers: true,   // protections dessinées et collisions : voir docs/spa-barrieres/README.md
    kerb: DRAPEAUX.nl,
    length: 2400, width: 13,
    pts: TRACES.zandvoort,
    barrierPaths: [
      { side: 1, from: 0.6968, to: 0.7572, pts: [[10,56.6],[14.8,58.1],[16.4,58.7],[19.7,59.8],[22.9,60.8],[26.1,62.1],[29.4,63.3],[32.6,64.6],[35.8,65.9],[39,67.4],[42.3,68.9],[45.5,70.8],[48.7,72.8],[51.6,75.1],[54.2,77.4],[56.4,79.9],[57.9,82.6],[58.9,85.5],[59.4,88.6],[59.2,91.9],[58.5,95.1],[68.51,103.61]] }, // Bocht 12 — contour
      {side:-1,from:.4514,to:.4800,pts:[[-47.0,-205.9],[-41.5,-204.8],[-39.9,-204.4],[-36.5,-203.5],[-33.2,-202.4],[-30.2,-201.0],[-27.3,-199.2],[-24.9,-196.9],[-22.7,-194.1],[-20.9,-191.1],[-19.2,-187.8],[-17.6,-184.7],[-16.8,-183.0],[-14.7,-178.4]]}, // Bocht 9 — protection reprise
      {side:-1,from:.2548,to:.3488,pts:[[-60.9,50.6],[-61.6,47.5],[-61.9,46.0],[-62.6,43.2],[-63.5,39.9],[-64.3,36.7],[-65.3,33.5],[-66.3,30.2],[-67.4,27.0],[-68.4,23.8],[-69.5,20.5],[-70.7,17.3],[-71.8,14.1],[-73.1,10.8],[-74.5,7.6],[-76.0,4.3],[-77.5,1.1],[-79.2,-2.2],[-80.9,-5.2],[-82.8,-8.3],[-84.8,-11.3],[-86.9,-14.2],[-89.1,-16.8],[-91.2,-19.3],[-93.4,-21.7],[-95.6,-23.9],[-97.7,-26.1],[-100.2,-28.4],[-102.8,-30.7],[-105.7,-33.0],[-108.8,-35.3],[-111.9,-37.6],[-114.9,-39.7],[-117.9,-41.9],[-120.7,-44.0],[-123.4,-46.1],[-125.9,-48.3],[-128.4,-50.5],[-130.6,-52.6],[-133.0,-54.9],[-135.3,-57.3],[-137.7,-59.7],[-140.0,-62.2],[-142.3,-64.6],[-144.4,-66.9],[-146.5,-69.3],[-148.8,-71.9],[-151.1,-74.8],[-153.5,-77.8],[-155.9,-81.0],[-158.2,-84.3],[-160.4,-87.5],[-162.5,-90.7],[-164.5,-93.9],[-166.4,-97.2],[-168.2,-100.4],[-169.9,-103.6],[-171.4,-106.8],[-172.9,-110.1],[-174.3,-113.3],[-175.7,-116.6],[-177.0,-119.9],[-178.3,-123.1],[-179.5,-126.3],[-180.2,-127.9],[-181.8,-132.3]]}, // Scheivlak — séparation reprise
      {side:-1,from:.5035,to:.5380,pts:[[-12.3,-129.5],[-13.4,-124.6],[-14.1,-122.9],[-15.4,-119.8],[-17.3,-117.4],[-19.7,-116.0],[-22.4,-115.7],[-25.3,-116.7],[-28.2,-118.4],[-30.8,-120.6],[-33.1,-122.8],[-35.3,-125.0],[-36.3,-126.1],[-38.9,-129.1]]}, // CM.com — protection reprise
      {side:-1,from:.6010,to:.6271,pts:[[-142.0,-115.1],[-140.5,-109.7],[-140.0,-108.1],[-138.9,-104.7],[-137.8,-101.4],[-136.5,-98.2],[-135.1,-95.0],[-133.6,-91.8],[-131.8,-88.5],[-129.9,-85.3],[-127.9,-82.1],[-125.7,-79.1],[-123.6,-76.1],[-121.5,-73.3],[-119.3,-70.5],[-117.2,-67.6],[-115.0,-64.7],[-113.9,-63.2],[-110.5,-58.6]]}, // Hans Ernst — protection reprise
      {side:1,from:.2574,to:.3168,pts:[[-91.5,50.8],[-92.3,46.7],[-92.6,45.2],[-93.1,42.1],[-93.7,38.9],[-94.4,35.5],[-95.0,32.0],[-95.9,28.6],[-96.8,25.1],[-97.8,21.6],[-98.8,18.4],[-100.1,15.1],[-101.5,11.9],[-103.0,8.6],[-104.7,5.4],[-106.7,2.1],[-108.6,-0.9],[-110.7,-3.8],[-112.9,-6.6],[-115.3,-9.4],[-117.6,-12.0],[-120.0,-14.6],[-122.4,-17.1],[-124.8,-19.5],[-127.0,-21.7],[-129.2,-23.8],[-131.4,-25.9],[-133.6,-27.9],[-135.9,-30.0],[-138.3,-32.1],[-140.7,-34.2],[-143.3,-36.4],[-145.9,-38.5],[-148.6,-40.7],[-151.2,-42.9],[-154.0,-45.1],[-156.7,-47.2],[-159.4,-49.4],[-160.7,-50.5],[-165.0,-53.8]]}, // Scheivlak — protection extérieure reprise
      {side:-1,from:.6738,to:.6883,pts:[[-43.8,33.5],[-41.3,38.3],[-40.5,39.8],[-38.8,42.9],[-36.9,46.0],[-35.0,49.0],[-33.0,52.0],[-30.9,54.8],[-28.7,57.5],[-26.7,59.9],[-25.7,61.1],[-23.2,63.5]]}, // Avant Bocht 12 — protection reprise
      {side:-1,from:.6984,to:.7259,pts:[[-4.8,80.0],[0.1,83.5],[1.5,84.6],[4.3,87.0],[6.7,89.5],[8.5,92.4],[9.4,95.2],[9.5,98.3],[9.1,101.6],[8.3,104.8],[7.4,108.0],[6.7,111.2],[6.4,112.8],[5.9,117.4]]}, // Bocht 12 — protection intérieure reprise
      {side:-1,from:.1721,to:.2086,pts:[[-43.0,199.0],[-38.1,201.3],[-36.5,201.9],[-33.3,203.3],[-30.1,204.4],[-26.8,205.5],[-23.6,206.4],[-20.3,207.1],[-17.0,207.5],[-13.8,207.6],[-10.5,207.4],[-7.2,206.8],[-4.0,205.8],[-0.7,204.4],[2.4,202.8],[5.2,200.9],[7.8,198.9],[10.2,196.5],[12.4,193.9],[14.3,191.1],[16.0,188.0],[17.3,184.7],[18.2,181.5],[18.4,178.2],[18.2,174.9],[17.5,171.7],[16.5,168.4],[15.0,165.2],[13.2,161.9],[11.2,158.9],[9.1,155.9],[6.9,153.0],[4.8,150.4],[2.6,148.0],[0.5,145.6],[-1.6,143.4],[-3.6,141.1],[-4.7,140.0],[-7.5,136.3]]}, // Hunserug — protection reprise
      {side:-1,from:.1348,to:.1666,pts:[[-107.3,179.1],[-102.7,177.7],[-101.1,177.2],[-97.9,176.2],[-94.4,175.4],[-90.9,174.7],[-87.5,174.3],[-84.1,174.2],[-80.7,174.5],[-77.4,175.2],[-74.2,176.3],[-71.0,177.8],[-67.8,179.6],[-64.6,181.8],[-61.6,184.2],[-58.9,186.7],[-57.5,188.0],[-54.1,191.5]]}, // Hugenholtz — protection reprise
      {side:-1,from:.0516,to:.1091,pts:[[-192.9,215.1],[-197.0,215.2],[-198.5,215.2],[-201.6,215.2],[-204.9,215.0],[-208.1,214.7],[-211.4,214.0],[-214.6,212.7],[-216.8,210.9],[-217.6,208.7],[-217.1,206.4],[-215.4,204.2],[-212.4,202.5],[-209.1,201.1],[-205.9,200.0],[-202.6,198.9],[-199.4,198.0],[-196.1,197.1],[-192.9,196.3],[-189.7,195.4],[-186.5,194.7],[-183.2,193.9],[-180.0,193.0],[-176.7,192.2],[-175.1,191.8],[-170.3,190.4]]}, // Tarzan — protection reprise
      {side:1,from:.9033,to:.9202,pts:[[164.0,222.6],[158.6,223.1],[157.0,223.3],[153.6,223.6],[150.4,224.0],[147.1,224.6],[143.9,225.2],[140.6,226.0],[137.4,226.9],[133.9,227.9],[130.5,228.8],[128.8,229.3],[123.7,230.4]]}, // Arie Luyendyk — protection reprise
      { side: 1, from: 0.7576, to: 0.7614, pts: [[69.42,103.2],[78.57,100.62]] },
      { side: 1, from: 0.1735, to: 0.2084, pts: [[-23.13,183.35],[-22.05,184.43],[-19.8,184.93],[-18.14,184.35],[-16.56,183.35],[-14.89,182.02],[-14.06,180.36],[-13.81,178.7],[-14.23,176.7],[-14.73,174.96],[-15.48,173.38],[-17.56,170.63],[-29.86,158.08]] },
      { side: 1, from: 0.3425, to: 0.3516, pts: [[-196.59,-110.27],[-199.33,-113.59],[-202.57,-118.75],[-205.15,-123.24],[-207.73,-127.4],[-209.56,-128.73]] },
    ],
    panneaux: [
      [0.0342, 50, 'hairpin', 1],
      [0.3479, 50, 5, 1],
      [0.6854, 50, 'square', 1],
      [0.0133, 100, 'hairpin', 1],
      [0.5483, 50, 3, -1],
      [0.6696, 100, 'square', 1],
      [0.3367, 100, 5, 1],
      [0.5283, 100, 3, -1],
      [0.9513, 200, 'hairpin', 1],
      [0.155, 50, 'hairpin', -1],
      [0.2621, 50, 5, -1],
      [0.2317, 100, 5, -1],
      [0.4379, 50, 2, 1],
      [0.0629, 0, 'hairpin', 1],
      [0.1283, 50, 2, 1],
      [0.1121, 100, 2, 1],
      [0.1454, 0, 2, 1],
      [0.1733, 0, 'hairpin', -1],
      [0.2813, 0, 5, -1],
      [0.3117, 0, 5, 1],
      [0.3688, 0, 5, 1],
      [0.4046, 100, 2, 1],
      [0.4592, 0, 2, 1],
      [0.495, 50, 'acute', 1],
      [0.5121, 0, 'acute', 1],
      [0.4742, 100, 'acute', 1],
      [0.5663, 0, 3, -1],
      [0.6767, 100, 'hairpin', -1],
      [0.6921, 50, 'hairpin', -1],
      [0.7117, 0, 'square', 1],
      [0.7225, 0, 'hairpin', -1],
      [0.7579, 100, 3, 1],
      [0.7817, 50, 3, 1],
      [0.8096, 0, 3, 1],
      [0.8271, 50, 5, 1],
      [0.8513, 0, 5, 1],
    ],
    /* Reprise utilisateur : contours rouges en gravier, vert en bitume, trait bleu
       en chaussée et croix sans dégagement. Les zones sont contraintes par les branches
       voisines et les garages, avec la même géométrie pour le rendu et la physique. */
    runoffs: [
      // Profils interprétés de zandvoort_reprise.png ; les croix ne sont pas des surfaces.
      { name: 'Tarzanbocht', surface: 'gravel', side: 1,
        points:[[.048,0],[.065,25],[.075,19],[.085,15],[.098,0]] },
      { name: 'Hugenholtzbocht — extérieur', surface: 'gravel', side: 1,
        points:[[.137,0],[.151,14],[.163,12],[.179,0]] },
      { name: 'Bocht 9', surface: 'gravel', side: 1, points: [[0.348,0],[0.363,18],[0.375,19],[0.391,19],[0.405,11],[0.4213,9.2],[0.4483,10.96]] },
      { name: 'CM.com-bocht — enveloppe regroupée', surface: 'gravel', side: 1, points: [[0.4477,11.31],[0.4613,18.48],[0.4735,12.26],[0.4877,6.97],[0.5046,10.97],[0.517,20],[0.53,11],[0.544,4.8]] },
      { name: 'Hans Ernst-bocht', surface: 'gravel', side: -1, points: [[0.5541,8.83],[0.57,15],[0.585,13],[0.6027,8.4]] },
      // Reprise 0.40 (zandvoort-tour_reprise.png) : le tablier de Bocht 12 suit le contour vert.
      { name: 'Bocht 12 — tablier bitumé', surface: 'asphalt', side: 1,
        points: [[.6937,0],[.6982,9.6],[.7012,11.7],[.7042,13.6],[.7072,15.2],[.7102,16.9],[.7132,20.2],[.7162,20.2],[.7492,16.7],[.7522,16.6],[.7552,10.3],[.7582,9.4],[.7609,0]] },
      { name: 'Bocht 13', surface: 'gravel', side: 1, points: [[0.7865,8.83],[0.804,19],[0.816,21],[0.83,14],[0.842,0]] },
    ],
    implantation: [
      { kind: 'stands', side: -1, from: 0.93, to: 0.045, recul: 11, prof: 22, module: 40 },
      { kind: 'tribune', side: 1, from: 0.94, to: 0.04, recul: 0, prof: 24, module: 32 },
      { kind: 'nu', side: 1, from: 0.1, to: 0.62, prof: 150 },
      { kind: 'nu', side: -1, from: 0.1746, to: 0.6, prof: 150 },
      { kind: 'bois', side: 1, from: 0.2, to: 0.29, recul: 0, prof: 26, essence: 'taillis', densite: 0.4 },
      { kind: 'bois', side: -1, from: 0.3521, to: 0.5067, recul: 1, prof: 39, essence: 'taillis', densite: 0.35 },
      { kind: 'bois', side: 1, from: 0.5946, to: 0.68, recul: 0, prof: 26, essence: 'taillis', densite: 0.4 },
      { kind: 'hangars', side: -1, from: 0.6712, to: 0.6971, recul: 16, prof: 30, module: 28 },
      { kind: 'parking', side: -1, from: 0.7579, to: 0.7939, recul: 9.5, prof: 50 },
      { kind: 'tribune', side: -1, from: 0.8347, to: 0.9284, recul: 13, prof: 23, module: 28 },
      { kind: 'parking', side: 1, from: 0.9398, to: 0.04, recul: 19, prof: 69 },
      // Camping-cars garés en long derrière la protection, hors des parkings.
      { kind: 'camping', side: 1, from: 0.825, to: 0.94, recul: 2.5 },
      { kind: 'tribune', side: 1, from: 0.3007, to: 0.3388, recul: 2, prof: 16, module: 28 },
      { kind: 'tribune', side: 1, from: 0.6923, to: 0.7957, recul: 10, prof: 16, module: 28 },
    ],
    lines: {
      racing: [[-28.751, 96.752], [-49.819, 97.736], [-70.893, 98.638], [-94.858, 95.368], [-95.703, 82.487], [-76.914, 76.224], [-56.28, 73.846], [-31.985, 67.787], [-6.602, 83.135], [-0.305, 77.822], [-7.388, 61.898], [-20.07, 45.394], [-29.057, 27.011], [-36.483, 7.244], [-47.385, -9.543], [-62.714, -23.984], [-75.853, -39.38], [-84.769, -58.485], [-85.927, -78.584], [-74.3, -93.305], [-54.552, -96.706], [-33.672, -95.084], [-10.574, -92.286], [-0.266, -77.81], [1.582, -56.964], [-8.098, -42.777], [-24.005, -53.84], [-43.903, -73.831], [-54.236, -66.636], [-54.705, -47.03], [-46.417, -27.392], [-34.17, -10.008], [-19.961, 5.568], [-4.876, 20.025], [11.493, 36.191], [11.068, 56.059], [27.346, 54.277], [44.636, 42.196], [61.503, 29.503], [80.233, 24.415], [94.014, 37.899], [98.5, 57.976], [92.066, 76.407], [76.034, 87.838], [55.501, 92.385], [34.457, 93.796], [13.387, 94.782], [-7.681, 95.767]],
      inside: [[-28.91, 93.331], [-49.98, 94.315], [-71.049, 95.282], [-91.707, 95.276], [-95.675, 82.515], [-76.843, 77.436], [-56.279, 73.85], [-33.599, 68.652], [-16.558, 76.563], [2.607, 77.074], [-7.074, 63.772], [-20.063, 45.39], [-28.684, 26.906], [-37.057, 7.417], [-47.663, -9.235], [-62.514, -24.256], [-75.012, -39.767], [-82.943, -59.209], [-85.877, -78.572], [-74.288, -93.282], [-54.818, -95.173], [-33.672, -95.073], [-10.388, -90.866], [-1.86, -77.323], [-0.128, -57.177], [-8.095, -42.801], [-23.415, -54.217], [-39.071, -68.253], [-54.192, -66.61], [-52.906, -47.654], [-43.544, -28.895], [-32.523, -11.148], [-19.535, 5.194], [-4.858, 20.004], [7.562, 32.818], [23.364, 48.766], [33.947, 49.174], [44.178, 41.533], [62.244, 30.576], [80.19, 24.585], [92.467, 38.66], [98.061, 57.98], [92.059, 76.402], [75.883, 87.317], [55.385, 89.754], [34.296, 90.374], [13.228, 91.362], [-7.842, 92.348]],
      outside: [[-28.751, 96.753], [-49.819, 97.737], [-70.89, 98.704], [-94.717, 97.775], [-97.235, 81.994], [-77.479, 76.327], [-55.834, 73.808], [-31.474, 66.724], [-9.199, 82.545], [2.017, 81.994], [-1.171, 67.314], [-20.498, 45.678], [-31.572, 27.714], [-37.213, 7.464], [-46.482, -10.543], [-62.367, -24.457], [-77.235, -38.745], [-86.127, -57.947], [-89.212, -79.352], [-75.88, -96.315], [-54.249, -98.456], [-33.687, -94.831], [-9.463, -93.397], [1.416, -78.324], [3.271, -56.754], [-8.573, -39.409], [-23.658, -54.266], [-44.026, -74.942], [-56.042, -67.711], [-55.353, -46.806], [-46.579, -27.307], [-35.339, -9.199], [-22.109, 7.453], [-16.821, 9.789], [14.574, 40.813], [-7.684, 39.804], [20.737, 63.39], [44.801, 40.494], [60.895, 28.624], [81.002, 21.404], [95.541, 37.148], [101.486, 57.947], [94.745, 78.526], [76.839, 90.606], [55.528, 93.008], [34.457, 93.796], [13.387, 94.784], [-7.681, 95.769]],
    },
    pitFrom: 0.9542,
    pitTo: 0.0458,
    objets: {
      retires: [],
      ajouts: [
        { k: 'prop', id: 'bush', x: 34.54, y: 157.74, e: 0.9, i: 1 },
        { k: 'prop', id: 'bush', x: -26.24, y: 172.12, e: 0.94, i: 2 },
        { k: 'prop', id: 'bush', x: -22.75, y: 170.63, e: 0.9, i: 3 },
        { k: 'prop', id: 'bush', x: -21.09, y: 173.2, e: 0.91, i: 4 },
        { k: 'prop', id: 'rock', x: -211.48, y: 206.81, e: 0.87, i: 5 },
        { k: 'prop', id: 'rock', x: -208.59, y: 209.93, e: 0.8, i: 6 },
        { k: 'vehicule', kind: 'suv', l: 4.65, w: 1.95, col: 0, rem: 0, x: -116.37, y: 151.7, a: 1.484, teinte: 0.5, i: 7 },
        { k: 'vehicule', kind: 'minibus', l: 5.4, w: 2, col: 2, rem: 0, x: -124.03, y: 152.15, a: 0.785, teinte: 0.5, i: 8 },
        { k: 'vehicule', kind: 'campingcar', l: 6.9, w: 2.3, col: 0, rem: 0, x: -119.45, y: 150.67, a: 1.571, teinte: 0.5, i: 9 },
        { k: 'prop', id: 'rock', x: -121.12, y: 156.58, e: 1, i: 10 },
        { k: 'prop', id: 'rock', x: -118.72, y: 157.64, e: 0.93, i: 11 },
        { k: 'prop', id: 'rock', x: -116.76, y: 155.86, e: 0.98, i: 12 },
        { k: 'prop', id: 'bush', x: -120.32, y: 158.14, e: 0.97, i: 13 },
        { k: 'prop', id: 'bush', x: -117.12, y: 157.16, e: 1.06, i: 14 },
        { k: 'bati', type: 'tribune', x: 196.22, y: 161.32, a: 5.585, l: 28, w: 16, side: 1, toit: true, gradins: 6, i: 15 },
      ],
    },
  },
];

// Les tabliers bitumés peuvent précéder un bac : ne pas traiter tout le dégagement
// comme une seule matière. Largeurs simplifiées, bornes des secteurs conservées.
for(const id of ['interlagos','redbullring']){
  const d=TRACKS.find(t=>t.id===id);
  const names=id==='interlagos'?['S de Senna','Descida do Lago','Juncao']
    :['Virage 1','Virage 3','Virage 4','Virage 6-7','Virage 9','Virage 10'];
  // Sans doublon : une liste réécrite par l'éditeur de décor porte déjà ses tabliers.
  const aprons=d.runoffs.filter(z=>names.includes(z.name)
    &&!d.runoffs.some(y=>y.name===z.name+' — tablier bitumé avant bac')).map(z=>({
    ...z,name:z.name+' — tablier bitumé avant bac',surface:'asphalt',w:4,keepOuterGravel:true}));
  d.runoffs.push(...aprons);
}

// Profils artistiques configurés : les couleurs ne changent aucune surface physique.
// Une palette est une proposition visuelle, pas une certification des peintures réelles.
const CIRCUIT_STYLES = {
  monaco: { colors:['#C9282E','#F1F0E8'], grass:['#DCD4C7','#E3DCCF','#CDC6BA','#D9CBAF'] },
  silverstone: { colors:['#448C58','#F1F0E8'], grass:['#79945C','#88A16C','#657F4D','#ACA36E'] },
  suzuka: { colors:['#448C58','#F1F0E8'], grass:['#6D9652','#80A565','#557944','#A2A06A'] },
  interlagos: { colors:['#448C58','#E9BE37'], grass:['#669A4C','#78AB5C','#51823E','#A4A267'] },
  laguna: { colors:['#2769A3','#F1F0E8'], grass:['#B9AD71','#C8BD83','#A29963','#D0BD7A'] },
  nurburgring: { colors:['#448C58','#F1F0E8'], grass:['#547B46','#638952','#41683B','#98965F'] },
  lemans: { colors:['#2769A3','#E9BE37'], grass:['#77935A','#8BA66D','#637D4A','#ACA16C'] },
  bathurst: { colors:['#448C58','#E9BE37'], grass:['#93965C','#A6A36C','#7D834C','#B6A46B'] },
  redbullring: { colors:['#448C58','#F1F0E8'], grass:['#709452','#81A464','#587B42','#AAA16A'] },
  castellet: { colors:[], grass:['#A6A16E','#B8B280','#908D5B','#C1AF77'] },
  zandvoort: { colors:['#ED782C','#F1F0E8'], grass:['#BCB67D','#CCC58D','#A5A06B','#D5BF82'] },
};
for(const d of TRACKS){
  if(d.graphics)continue;
  const style=CIRCUIT_STYLES[d.id];
  d.graphics={ profile:'circuit',roadOutlineWidth:.35,kerbBlock:1,
    kerb:['#C9282E','#F1F0E8'],kerbOutlineWidth:.12,proceduralPit:true,
    paintedRunoff:false,runoffColors:style.colors,
    materials:{grass:style.grass[0],grassLight:style.grass[1],grassDark:style.grass[2],grassDry:style.grass[3],
      barrierBlocks:['#C92F32','#E6E6DF','#28639C']},
    grid:{rows:6,offset:12,pitch:8},
    wearZones:(d.panneaux||[]).filter(p=>p[1]===0).map(p=>({at:p[0],approach:60,exit:22})),
    // L'entrée se déduit des repères de virage existants ; le peintre la limite au bitume disponible.
    entryAprons:(d.panneaux||[]).filter(p=>p[1]===0).flatMap(p=>[-1,1].map(side=>({
      from:Math.max(0,p[0]-30/d.length),to:p[0],side}))),
  };
}

if (typeof module !== 'undefined') module.exports = { TRACKS };

/* LES CLÉS DU DÉCOR, celles que l'éditeur de décor (`editor.html`, mode Décor) sait reprendre. Une
retouche locale ou un bloc fabriqué pour ce fichier ne touche qu'à celles-là : le tracé central,
les lignes et les panneaux restent ce qu'ils sont. */
const CLES_DECOR = ['roadWidenings', 'runoffs', 'annotatedRunoffsOnly', 'implantation', 'barrierPaths', 'barrierCuts',
  'asphaltPads', 'pitFrom', 'pitTo', 'pitAt', 'objets'];
/* UNE RETOUCHE DU POSTE PLUS ANCIENNE QUE LE FICHIER NE COMPTE PLUS.

Une retouche enregistrée dans le navigateur (décor, trajectoires, panneaux) passe devant le fichier :
c'est ce qui permet d'essayer avant de publier. Mais une fois le fichier de Bruno repris dans
`js/tracks.js`, ses retouches d'avant restent dans chaque navigateur où il les a enregistrées, et
continuent d'écraser le fichier — à Monaco, son téléphone jouait d'anciennes trajectoires, collées
aux vibreurs, à la place de celles qu'il venait de retracer et d'envoyer. `revision` est la date à
laquelle le circuit a été repris d'un fichier : une retouche enregistrée avant ne s'applique plus.
L'éditeur le signale, et « Revenir au fichier » l'efface. */
function retoucheAJour(def, rec) {
  if (!rec) return false;
  if (!def || !def.revision) return true;
  return (rec.at || 0) >= Date.parse(def.revision);
}
// Une définition avec une reprise de décor posée dessus ; `null` retire la clé (plus de voie
// déplacée, plus de traits relevés…). La définition d'origine n'est pas touchée.
function avecDecor(def, decor) {
  if (!decor) return def;
  const nu = { ...def };
  for (const k of CLES_DECOR) {
    if (!(k in decor)) continue;
    if (decor[k] == null) delete nu[k]; else nu[k] = decor[k];
  }
  return nu;
}
