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
      racing: [[-28.076, -32.907], [-16.269, -40.14], [-2.714, -44.583], [10.661, -49.023], [23.974, -52.95], [37.525, -56.759], [57.229, -61.205], [68.021, -55.741], [79.722, -57.721], [87.569, -50.495], [95.551, -39.14], [99.555, -28.117], [92.613, -26.338], [81.447, -38.666], [64.617, -35.577], [50.91, -32.891], [37.514, -29.074], [30.243, -19.032], [33.713, -6.515], [45.239, 0.626], [58.472, 5.458], [69.039, 13.584], [68.163, 26.123], [76.493, 35.716], [86.727, 44.484], [81.884, 56.24], [69.976, 60.476], [57.239, 54.874], [47.489, 45.111], [39.784, 33.628], [32.119, 21.782], [22.627, 12.074], [10.183, 5.627], [-3.131, 4.63], [-16.546, 8.384], [-29.8, 12.74], [-46.543, 14.019], [-51.356, 8.65], [-65.819, 15.846], [-77.434, 23.903], [-89.266, 31.177], [-98.684, 33.304], [-93.103, 17.971], [-84.114, 6.961], [-73.744, -2.644], [-63.002, -11.736], [-52.752, -20.431], [-40.213, -25.834]],
      inside: [[-27.687, -32.292], [-15.662, -39.357], [-2.423, -43.547], [11.099, -47.461], [24.451, -51.247], [38.006, -55.048], [51.575, -58.796], [63.626, -58.117], [76.753, -56.804], [86.751, -49.93], [94.186, -38.198], [97.958, -27.137], [88.638, -31.638], [78.52, -38.237], [65.104, -33.879], [51.23, -31.146], [37.667, -28.364], [30.733, -18.991], [33.718, -6.52], [45.411, 0.206], [58.11, 6.34], [68.95, 13.623], [68.185, 26.122], [76.631, 35.504], [86.613, 44.534], [81.056, 55.633], [70.072, 60.175], [57.657, 54.231], [47.731, 44.881], [39.713, 33.665], [31.87, 21.926], [22.463, 12.352], [9.861, 6.354], [-2.978, 5.04], [-16.597, 8.248], [-29.9, 12.023], [-43.873, 13.268], [-53.188, 9.593], [-65.553, 16.315], [-77.862, 23.146], [-90.104, 29.692], [-98.081, 31.246], [-91.697, 18.8], [-83.196, 7.86], [-73.516, -2.373], [-63.037, -11.778], [-52.75, -20.427], [-40.347, -24.933]],
      outside: [[-28.329, -33.306], [-16.426, -40.961], [-2.904, -45.258], [10.619, -49.173], [23.972, -52.958], [37.525, -56.759], [51.095, -60.508], [58.324, -61.872], [70.737, -54.669], [71.652, -59.446], [87.16, -51.989], [101.566, -26.711], [87.507, -30.928], [78.266, -38.999], [64.615, -35.584], [50.909, -32.895], [37.326, -29.946], [28.962, -19.138], [32.39, -5.338], [44.927, 1.387], [58.549, 5.272], [70.359, 13.007], [68.277, 26.119], [76.293, 36.024], [87.68, 44.066], [82.489, 56.685], [69.533, 61.87], [56.687, 55.721], [46.441, 46.105], [38.719, 34.178], [32.3, 21.677], [23.369, 10.823], [10.581, 4.728], [-3.599, 3.374], [-16.529, 8.429], [-29.657, 13.771], [-45.933, 14.358], [-54.57, 9.993], [-65.514, 16.384], [-77.178, 24.357], [-89.231, 31.24], [-99.33, 36.486], [-93.228, 17.897], [-84.465, 6.616], [-73.342, -2.166], [-58.025, -16.49], [-54.054, -21.303], [-42.214, -25.433]],
    },
    panneaux: [
      [0.1194, 50, 'chicane', 1],
      [0.2044, 50, 'hairpin', 1],
      [0.3191, 50, 2, -1],
      [0.4138, 50, 'square', 1],
      [0.4803, 50, 'square', 1],
      [0.6576, 50, 4, -1],
      [0.7394, 50, 'square', 1],
      [0.83, 50, 'acute', 1],
      [0.9268, 50, 'chicane', 1],
      [0.1047, 100, 'chicane', 1],
      [0.1897, 100, 'hairpin', 1],
      [0.3044, 100, 2, -1],
      [0.3991, 100, 'square', 1],
      [0.6429, 100, 4, -1],
      [0.7247, 100, 'square', 1],
      [0.8153, 100, 'acute', 1],
      [0.9121, 100, 'chicane', 1],
      [0.0753, 200, 'chicane', 1],
      [0.275, 200, 2, -1],
      [0.6135, 200, 4, -1],
      [0.6953, 200, 'square', 1],
      [0.7859, 200, 'acute', 1],
      [0.4385, 50, 3, -1],
      [0.5062, 50, 'square', 1],
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
