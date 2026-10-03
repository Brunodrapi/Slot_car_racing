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
    // La voie des stands déplacée juste après la ligne : à sa place par défaut, la zone d'arrêt
    // tombait dans le dernier virage et aucune voiture ne parvenait à s'y arrêter. Voir _buildPits.
    length: 3400, width: 14, laps: 3, puddles: 0.5, pitAt: 0.10,
    pts: TRACES.spa,
  },
  {
    id: 'monaco', name: 'Monaco', country: 'MC', flag: '🇲🇨', theme: 'riviera',
    kerb: DRAPEAUX.mc,
    length: 2300, width: 11, laps: 5,
    pts: TRACES.monaco,
    // Le pont qui enjambe le boulevard Albert 1er juste avant la ligne (voie 167625745).
    passerelles: [0.9471],
    /* Le tunnel du boulevard Louis II, 356 m relevés sous l'hôtel (voie 4230891, « tunnel=yes »).
       C'est le seul vrai tunnel des douze circuits. Monza et Suzuka ont des portions « covered »,
       mais couvert n'est pas souterrain : à Monza ce sont les vingt-cinq mètres sous la passerelle
       du Serraglio, qu'on dessine déjà comme une passerelle. */
    tunnels: [[0.4817, 0.5883]],
    lines: {
      racing: [[-101.111, 41.728], [-99.973, 25.907], [-97.397, 10.319], [-92.751, -4.85], [-86.351, -17.194], [-77.598, -24.063], [-56.827, -23.47], [-41.473, -22.84], [-25.792, -22.461], [-10.278, -22.948], [5.252, -24.181], [20.697, -24.952], [34.85, -29.021], [40.452, -41.803], [35.713, -56.272], [40.097, -69.279], [51.769, -79.876], [65.35, -90.577], [75.76, -91.47], [79.492, -70.448], [84.323, -70.513], [80.497, -85.266], [99.044, -86.563], [97.65, -72.145], [91.679, -57.467], [82.92, -44.374], [71.749, -33.467], [58.809, -24.97], [44.583, -18.903], [29.427, -14.99], [14.066, -13.132], [-4.065, -11.94], [-13.649, -9.802], [-25.371, -12.036], [-45.945, -15.521], [-61.556, -17.279], [-75.525, -12.408], [-83.27, 1.189], [-84.17, 16.025], [-80.593, 30.827], [-82.111, 46.469], [-88.627, 58.574], [-85.031, 73.669], [-73.173, 90.938], [-83.783, 94.293], [-93.086, 89.888], [-97.817, 73.04], [-100.517, 57.496]],
      inside: [[-99.12, 41.724], [-97.945, 26.167], [-95.472, 10.705], [-91.086, -4.2], [-83.717, -18.066], [-72.564, -23.328], [-56.855, -22.503], [-41.432, -21.832], [-25.766, -22.658], [-10.356, -23.326], [5.253, -23.966], [20.716, -25.219], [34.76, -29.147], [40.048, -41.769], [35.852, -56.344], [40.753, -68.499], [53.067, -78.249], [65.322, -88.116], [75.511, -90.206], [79.751, -75.228], [85.137, -72.409], [87.482, -84.214], [98.896, -84.967], [95.856, -72.685], [90.284, -58.146], [82.152, -44.949], [71.499, -33.758], [58.789, -25.008], [44.55, -19.012], [29.351, -15.314], [14.066, -13.387], [-4.77, -13.288], [-15.493, -10.667], [-30.429, -12.776], [-46.105, -14.069], [-61.782, -15.383], [-74.616, -11.653], [-82.371, 1.523], [-83.983, 15.893], [-81.448, 30.773], [-83.524, 46.455], [-88.468, 58.565], [-84.796, 73.583], [-77.405, 86.785], [-81.586, 93.273], [-92.677, 87.988], [-96.789, 72.697], [-98.611, 57.391]],
      outside: [[-101.225, 41.728], [-100.033, 25.899], [-97.537, 10.291], [-93.047, -4.965], [-85.863, -19.409], [-82.014, -24.854], [-56.83, -23.379], [-41.517, -23.936], [-25.717, -23.024], [-10.117, -22.163], [5.25, -24.945], [20.703, -25.041], [35.716, -27.816], [41.904, -41.769], [34.62, -56.84], [40.341, -70.013], [51.754, -79.895], [65.321, -91.155], [73.36, -95.182], [77.06, -68.567], [84.607, -68.697], [78.908, -87.86], [95.9, -87.918], [97.781, -72.106], [92.177, -57.224], [83.838, -43.687], [72.874, -32.162], [59.785, -23.152], [45.159, -16.996], [29.83, -13.263], [14.066, -11.377], [-1.344, -12.366], [-15.74, -8.611], [-30.409, -12.961], [-47.663, -15.904], [-68.686, -18.579], [-73.471, -15.771], [-84.345, 0.79], [-85.315, 16.834], [-80.435, 30.837], [-81.688, 46.474], [-89.329, 58.614], [-86.767, 74.306], [-72.638, 88.504], [-79.051, 95.47], [-91.822, 92.468], [-98.466, 73.256], [-100.714, 57.507]],
    },
    panneaux: [
      [0.057, 50, 1, 1],
      [0.1522, 50, 3, -1],
      [0.1974, 50, 3, -1],
      [0.3413, 50, 'hairpin', 1],
      [0.6252, 50, 'chicane', -1],
      [0.7157, 50, 'square', -1],
      [0.8135, 50, 'chicane', 1],
      [0.8596, 100, 'acute', 1],
      [0.0352, 100, 1, 1],
      [0.3196, 50, 'hairpin', 1],
      [0.6035, 100, 'chicane', -1],
      [0.9917, 200, 1, 1],
      [0.6848, 200, 'square', -1],
      [0.2787, 50, 2, 1],
      [0.3887, 50, 'acute', -1],
      [0.4465, 50, 'square', 1],
      [0.7674, 50, 'chicane', -1],
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
