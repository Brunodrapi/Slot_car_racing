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
    id: 'monza', name: 'Monza', country: 'IT', flag: '🇮🇹', theme: 'park',
    kerb: DRAPEAUX.it,
    length: 2900, width: 15, laps: 4,
    /* La géométrie vient de `js/traces.js`, qui porte sa propre licence : elle est relevée dans
       OpenStreetMap, et le fichier à part rend la frontière lisible. Voir `LICENCES.md`. La
       longueur, la largeur et le nombre de tours restent des choix du jeu — c'est la FORME du
       circuit qui est juste, pas sa taille. Monza y fait la moitié de ses 5793 m réels : ses
       chicanes s'en trouvent deux fois plus serrées qu'en vrai, et `js/track.js` les rouvre juste
       assez pour que la route ne se replie pas sur elle-même (voir PLI_MAX). */
    pts: TRACES.monza,
    /* Les passerelles piétonnes, en fraction de tour. Relevées dans OpenStreetMap elles aussi, par
       `tools/releve.py --passerelles`, qui ne retient que les chemins « bridge=yes » dont le tracé
       CROISE la ligne médiane — deux segments se croisent ou ne se croisent pas, il n'y a pas de
       seuil à régler. Une fraction plutôt qu'une distance : elle survit au rééchantillonnage de
       `js/track.js`, qui ne garde pas le même nombre de stations selon la longueur déclarée. */
    passerelles: [0.6340, 0.7791, 0.8297],
  },
  {
    id: 'spa', name: 'Spa-Francorchamps', country: 'BE', flag: '🇧🇪', theme: 'forest',
    kerb: DRAPEAUX.be,
    /* Plus de `pitAt` : il valait 0,10 et corrigeait une zone d'arrêt qui tombait dans un virage —
       conséquence d'une ligne de départ posée à Eau Rouge. La ligne est maintenant sur la vraie
       ligne droite des stands, donc le défaut (juste avant la ligne) retombe sur la vraie voie des
       stands. Mesuré par `tools/stands.js` : l'arrêt ne se faisait plus du tout avec l'ancien
       décalage, il se fait de nouveau sans lui. */
    length: 3400, width: 14, laps: 3, puddles: 0.5,
    pts: TRACES.spa,
  },
  {
    id: 'monaco', name: 'Monaco', country: 'MC', flag: '🇲🇨', theme: 'riviera',
    kerb: DRAPEAUX.mc,
    length: 2300, width: 11, laps: 5,
    pts: TRACES.monaco,
    // Le pont qui enjambe le boulevard Albert 1er juste avant la ligne (voie 167625745).
    passerelles: [0.9204],
    /* Le tunnel du boulevard Louis II, 356 m relevés sous l'hôtel (voie 4230891, « tunnel=yes »).
       C'est le seul vrai tunnel des douze circuits. Monza et Suzuka ont des portions « covered »,
       mais couvert n'est pas souterrain : à Monza ce sont les vingt-cinq mètres sous la passerelle
       du Serraglio, qu'on dessine déjà comme une passerelle. */
    tunnels: [[0.4550, 0.5617]],
    /* Les lignes et les panneaux repris à la main dans `lignes.html`, et gardés tels quels.

       Les FRACTIONS des panneaux ont été décalées de −0,0267 de tour : elles se comptent depuis la
       ligne de départ, et celle-ci a bougé de 89 m quand on est passé de la voie des stands devinée
       au nœud « raceway=start-finish » d'OpenStreetMap. Les mêmes panneaux, au même endroit de la
       piste. Les LIGNES, elles, sont des coordonnées et ne bougent pas avec le départ. */
    lines: {
      racing: [[-28.076, -32.907], [-16.269, -40.14], [-2.714, -44.583], [10.661, -49.023], [23.974, -52.95], [37.525, -56.759], [57.229, -61.205], [68.021, -55.741], [79.722, -57.721], [87.569, -50.495], [95.551, -39.14], [99.555, -28.117], [92.613, -26.338], [81.447, -38.666], [64.617, -35.577], [50.91, -32.891], [37.514, -29.074], [30.243, -19.032], [33.713, -6.515], [45.239, 0.626], [58.472, 5.458], [69.039, 13.584], [68.163, 26.123], [76.493, 35.716], [86.727, 44.484], [81.884, 56.24], [69.976, 60.476], [57.239, 54.874], [47.489, 45.111], [39.784, 33.628], [32.119, 21.782], [22.627, 12.074], [10.183, 5.627], [-3.131, 4.63], [-16.546, 8.384], [-29.8, 12.74], [-46.543, 14.019], [-51.356, 8.65], [-65.819, 15.846], [-77.434, 23.903], [-89.266, 31.177], [-98.684, 33.304], [-93.103, 17.971], [-84.114, 6.961], [-73.744, -2.644], [-63.002, -11.736], [-52.752, -20.431], [-40.213, -25.834]],
      inside: [[-27.687, -32.292], [-15.662, -39.357], [-2.423, -43.547], [11.099, -47.461], [24.451, -51.247], [38.006, -55.048], [51.575, -58.796], [63.626, -58.117], [76.753, -56.804], [86.751, -49.93], [94.186, -38.198], [97.958, -27.137], [88.638, -31.638], [78.52, -38.237], [65.104, -33.879], [51.23, -31.146], [37.667, -28.364], [30.733, -18.991], [33.718, -6.52], [45.411, 0.206], [58.11, 6.34], [68.95, 13.623], [68.185, 26.122], [76.631, 35.504], [86.613, 44.534], [81.056, 55.633], [70.072, 60.175], [57.657, 54.231], [47.731, 44.881], [39.713, 33.665], [31.87, 21.926], [22.463, 12.352], [9.861, 6.354], [-2.978, 5.04], [-16.597, 8.248], [-29.9, 12.023], [-43.873, 13.268], [-53.188, 9.593], [-65.553, 16.315], [-77.862, 23.146], [-90.104, 29.692], [-98.081, 31.246], [-91.697, 18.8], [-83.196, 7.86], [-73.516, -2.373], [-63.037, -11.778], [-52.75, -20.427], [-40.347, -24.933]],
      outside: [[-28.329, -33.306], [-16.426, -40.961], [-2.904, -45.258], [10.619, -49.173], [23.972, -52.958], [37.525, -56.759], [51.095, -60.508], [58.324, -61.872], [70.737, -54.669], [71.652, -59.446], [87.16, -51.989], [101.566, -26.711], [87.507, -30.928], [78.266, -38.999], [64.615, -35.584], [50.909, -32.895], [37.326, -29.946], [28.962, -19.138], [32.39, -5.338], [44.927, 1.387], [58.549, 5.272], [70.359, 13.007], [68.277, 26.119], [76.293, 36.024], [87.68, 44.066], [82.489, 56.685], [69.533, 61.87], [56.687, 55.721], [46.441, 46.105], [38.719, 34.178], [32.3, 21.677], [23.369, 10.823], [10.581, 4.728], [-3.599, 3.374], [-16.529, 8.429], [-29.657, 13.771], [-45.933, 14.358], [-54.57, 9.993], [-65.514, 16.384], [-77.178, 24.357], [-89.231, 31.24], [-99.33, 36.486], [-93.228, 17.897], [-84.465, 6.616], [-73.342, -2.166], [-58.025, -16.49], [-54.054, -21.303], [-42.214, -25.433]],
    },
    panneaux: [
      [0.0486, 200, 'chicane', 1],
      [0.078, 100, 'chicane', 1],
      [0.0927, 50, 'chicane', 1],
      [0.163, 100, 'hairpin', 1],
      [0.1777, 50, 'hairpin', 1],
      [0.2483, 200, 2, -1],
      [0.2777, 100, 2, -1],
      [0.2924, 50, 2, -1],
      [0.3724, 100, 'square', 1],
      [0.3871, 50, 'square', 1],
      [0.4118, 50, 3, -1],
      [0.4536, 50, 'square', 1],
      [0.4795, 50, 'square', 1],
      [0.5868, 200, 4, -1],
      [0.6162, 100, 4, -1],
      [0.6309, 50, 4, -1],
      [0.6686, 200, 'square', 1],
      [0.698, 100, 'square', 1],
      [0.7127, 50, 'square', 1],
      [0.7592, 200, 'acute', 1],
      [0.7886, 100, 'acute', 1],
      [0.8033, 50, 'acute', 1],
      [0.8854, 100, 'chicane', 1],
      [0.9001, 50, 'chicane', 1],
    ],
  },
  {
    id: 'silverstone', name: 'Silverstone', country: 'GB', flag: '🇬🇧', theme: 'autumn',
    kerb: DRAPEAUX.gb,
    length: 3300, width: 16, laps: 3, puddles: 0.4,
    pts: TRACES.silverstone,
    /* Les deux passerelles de la Wellington Straight — deux ouvrages distincts, à dix mètres l'un
       de l'autre — et la passerelle couverte du complexe des stands. */
    passerelles: [0.2163, 0.2179, 0.9639],
  },
  {
    id: 'suzuka', name: 'Suzuka', country: 'JP', flag: '🇯🇵', theme: 'japan',
    kerb: DRAPEAUX.jp,
    length: 3300, width: 14, laps: 3,
    pts: TRACES.suzuka,
    /* Le passage sous le croisement, 243 m relevés (voie 183391655). Étiqueté « covered », pas
       « tunnel » : on n'est pas sous terre, on est sous le pont que la piste se fait à elle-même.
       Ça se dessine pareil, et ça se lit mieux — sans l'assombrissement, rien ne disait qu'on
       passait dessous plutôt que dessus. Monza a 25 m de « covered » au même titre, et on ne les
       dessine pas : ce sont les mètres sous la passerelle du Serraglio, déjà dessinée. */
    tunnels: [[0.3317, 0.3750]],
    lines: {
      racing: [[-74.294, 71.274], [-88.322, 72.58], [-99.803, 64.597], [-97.785, 57.129], [-76.388, 53.412], [-69.971, 49.421], [-63.68, 44.454], [-47.075, 44.528], [-37.102, 34.185], [-28.956, 33.889], [-15.383, 42.684], [-4.179, 38.122], [2.292, 27.102], [2.035, 14.29], [-3.098, -4.161], [-2.117, -11.181], [4.109, -19.201], [19.766, -16.184], [34.95, -10.176], [46.664, 1.12], [49.174, -2.657], [42.133, -15.489], [40.618, -27.47], [46.071, -39.216], [56.403, -48.504], [67.626, -53.203], [80.709, -53.226], [93.446, -54.591], [99.143, -65.188], [91.056, -71.868], [77.988, -68.867], [66.235, -62.651], [55.135, -54.978], [44.715, -46.458], [34.651, -37.611], [24.762, -28.857], [15.102, -19.554], [9.001, -8.31], [8.879, 4.667], [11.868, 17.465], [13.131, 30.777], [7.942, 40.977], [2.45, 51.875], [-8.762, 58.222], [-21.758, 61.654], [-34.93, 64.112], [-48.107, 66.544], [-61.102, 68.921]],
      inside: [[-74.051, 70.047], [-87.764, 71.957], [-98.172, 64.811], [-97.785, 57.365], [-81.415, 54.001], [-69.974, 49.419], [-63.809, 44.417], [-47.685, 44.177], [-38.099, 37.343], [-26.207, 35.928], [-15.383, 42.684], [-4.474, 37.768], [2.203, 27.081], [1.98, 14.305], [-1.458, 1.389], [-2.374, -6.652], [4.607, -19.282], [17.15, -12.416], [27.673, -10.42], [37.77, -7.795], [44.938, -4.901], [42.876, -15.35], [44.4, -28.022], [49.301, -38.543], [54.518, -41.874], [65.468, -51.345], [80.748, -53.613], [93.86, -54.226], [98.947, -65.207], [91.101, -71.48], [78.686, -67.334], [67.072, -61.219], [56.047, -53.773], [45.847, -45.179], [35.804, -36.307], [25.917, -27.554], [15.952, -18.595], [9.133, -8.284], [8.903, 4.662], [11.105, 17.65], [11.973, 32.215], [8.339, 41.073], [2.38, 51.797], [-8.972, 57.267], [-22.072, 59.956], [-35.247, 62.401], [-48.423, 64.842], [-61.411, 67.212]],
      outside: [[-74.289, 71.301], [-87.684, 72.891], [-99.186, 66.08], [-99.309, 56.206], [-74.928, 54.299], [-74.06, 52.581], [-65.767, 43.937], [-47.851, 45.618], [-36.806, 33.224], [-30.397, 32.799], [-16.397, 44.343], [-3.359, 39.106], [3.898, 27.477], [1.144, 8.971], [-4.75, 0.252], [-2.706, -8.245], [0.674, -19.567], [17.445, -17.184], [32.226, -12.085], [46.385, 2.471], [48.323, -3.041], [43.008, -15.455], [39.021, -27.972], [44.983, -40.044], [54.819, -49.449], [67.31, -54.863], [80.813, -54.26], [93.561, -54.334], [100.68, -65.038], [90.901, -73.209], [77.964, -68.919], [66.193, -62.722], [54.996, -55.161], [44.693, -46.483], [34.65, -37.611], [24.762, -28.857], [14.797, -19.898], [7.424, -8.615], [7.189, 4.969], [11.276, 17.609], [13.858, 30.856], [7.961, 40.975], [3.358, 52.887], [-8.598, 58.968], [-21.755, 61.668], [-34.929, 64.113], [-48.105, 66.554], [-61.101, 68.925]],
    },
    panneaux: [
      [0.0033, 50, 2, 1],
      [0.0764, 50, 5, -1],
      [0.3097, 100, 'square', 1],
      [0.5415, 50, 2, -1],
      [0.7433, 50, 5, -1],
      [0.8167, 50, 'chicane', 1],
      [0.9882, 100, 2, 1],
      [0.5264, 100, 2, -1],
      [0.8015, 100, 'chicane', 1],
      [0.9579, 200, 2, 1],
      [0.32, 50, 'square', 1],
      [0.1088, 50, 5, 1],
      [0.133, 50, 5, -1],
      [0.1597, 50, 3, 1],
      [0.1948, 50, 3, -1],
      [0.287, 50, 4, 1],
      [0.3942, 50, 'acute', -1],
      [0.3836, 100, 'acute', -1],
      [0.3718, 200, 'acute', -1],
      [0.4394, 50, 5, 1],
      [0.5803, 50, 1, -1],
    ],
  },
  {
    id: 'interlagos', name: 'Interlagos', country: 'BR', flag: '🇧🇷', theme: 'tropical',
    kerb: DRAPEAUX.br,
    length: 2700, width: 14, laps: 4,
    pts: TRACES.interlagos,
    // La passerelle du S do Senna (voie 189535484).
    passerelles: [0.8625],
  },
  {
    id: 'laguna', name: 'Laguna Seca', country: 'US', flag: '🇺🇸', theme: 'california',
    kerb: DRAPEAUX.us,
    length: 2400, width: 13, laps: 4,
    pts: TRACES.laguna,
    // Trois passerelles : l'entrée des stands, le Rainey Curve et le Corkscrew.
    passerelles: [0.0399, 0.6555, 0.7886],
  },
  {
    id: 'nurburgring', name: 'Nürburgring GP', country: 'DE', flag: '🇩🇪', theme: 'forest',
    kerb: DRAPEAUX.de,
    length: 3000, width: 15, laps: 3,
    pts: TRACES.nurburgring,
  },
  {
    id: 'lemans', name: 'Le Mans', country: 'FR', flag: '🇫🇷', theme: 'lemans',
    kerb: DRAPEAUX.fr,
    length: 4200, width: 15, laps: 2,
    pts: TRACES.lemans,
    // La Passerelle Goodyear et la Passerelle Porsche, nommées comme telles dans le relevé.
    passerelles: [0.0989, 0.9768],
  },
  {
    id: 'bathurst', name: 'Mount Panorama', country: 'AU', flag: '🇦🇺', theme: 'bush',
    kerb: DRAPEAUX.au,
    length: 3600, width: 13, laps: 3,
    pts: TRACES.bathurst,
    // Une passerelle sur Conrod Straight, une sur Pit Straight.
    passerelles: [0.1524, 0.2183],
  },
  {
    id: 'redbullring', name: 'Red Bull Ring', country: 'AT', flag: '🇦🇹', theme: 'alpine',
    kerb: DRAPEAUX.at,
    length: 2400, width: 15, laps: 4,
    pts: TRACES.redbullring,
  },
  {
    id: 'zandvoort', name: 'Zandvoort', country: 'NL', flag: '🇳🇱', theme: 'dunes',
    kerb: DRAPEAUX.nl,
    length: 2400, width: 13, laps: 4,
    pts: TRACES.zandvoort,
  },
];

if (typeof module !== 'undefined') module.exports = { TRACKS };
