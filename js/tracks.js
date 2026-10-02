// Track definitions. Shapes are hand-traced approximations of real circuits.
// Coordinates are in arbitrary units (y grows downwards, as on a canvas);
// each track is rescaled so that its total length matches `length` (game metres).
// Race direction follows the point order. pts[0] must lie on the start/finish straight.
'use strict';

/* La couleur des vibreurs, et d'où elle vient.

Elle appartient au circuit, pas au décor. Elle était tirée du thème, qui donne l'humeur d'un
paysage : d'où du bleu au Mans et à Laguna Seca, de l'orange à Zandvoort — alors que les trois ont
des bandes rouges et blanches sur place.

Le rouge et blanc est la norme : c'est ce que la FIA impose sur les circuits homologués, et c'est ce
qu'on voit partout sauf exception nationale. Interlagos fait exception, en vert et jaune.

À VÉRIFIER SUR PHOTO si le cœur vous en dit : les fonds de carte de Wikipédia ne portent pas cette
information — ils colorient les secteurs et les zones de DRS, jamais les vibreurs — donc ces
couleurs ne sont pas relevées mais rapportées. Corriger un circuit tient sur une ligne. */
const VIBREUR_FIA = ['#c33b30', '#eceaf0'];      // rouge et blanc
const VIBREUR_BR = ['#1f7a3c', '#e8bc32'];       // vert et jaune — Interlagos, aux couleurs du pays

const TRACKS = [
  {
    id: 'monza', name: 'Monza', country: 'IT', flag: '🇮🇹', theme: 'park',
    kerb: VIBREUR_FIA,
    length: 2900, width: 15, laps: 4,
    /* La géométrie vient de `js/traces.js`, qui porte sa propre licence : elle est relevée dans
       OpenStreetMap, et le fichier à part rend la frontière lisible. Voir `LICENCES.md`. La
       longueur, la largeur et le nombre de tours restent des choix du jeu — c'est la FORME du
       circuit qui est juste, pas sa taille. Monza y fait la moitié de ses 5793 m réels : ses
       chicanes s'en trouvent deux fois plus serrées qu'en vrai, et `js/track.js` les rouvre juste
       assez pour que la route ne se replie pas sur elle-même (voir PLI_MAX). */
    pts: TRACES.monza,
  },
  {
    id: 'spa', name: 'Spa-Francorchamps', country: 'BE', flag: '🇧🇪', theme: 'forest',
    kerb: VIBREUR_FIA,
    // La voie des stands déplacée juste après la ligne : à sa place par défaut, la zone d'arrêt
    // tombait dans le dernier virage et aucune voiture ne parvenait à s'y arrêter. Voir _buildPits.
    length: 3400, width: 14, laps: 3, puddles: 0.5, pitAt: 0.10,
    pts: TRACES.spa,
  },
  {
    id: 'monaco', name: 'Monaco', country: 'MC', flag: '🇲🇨', theme: 'riviera',
    kerb: VIBREUR_FIA,
    length: 2300, width: 11, laps: 5,
    pts: TRACES.monaco,
  },
  {
    id: 'silverstone', name: 'Silverstone', country: 'GB', flag: '🇬🇧', theme: 'autumn',
    kerb: VIBREUR_FIA,
    length: 3300, width: 16, laps: 3, puddles: 0.4,
    pts: TRACES.silverstone,
  },
  {
    id: 'suzuka', name: 'Suzuka', country: 'JP', flag: '🇯🇵', theme: 'japan',
    kerb: VIBREUR_FIA,
    length: 3300, width: 14, laps: 3,
    pts: TRACES.suzuka,
  },
  {
    id: 'interlagos', name: 'Interlagos', country: 'BR', flag: '🇧🇷', theme: 'tropical',
    kerb: VIBREUR_BR,
    length: 2700, width: 14, laps: 4,
    pts: TRACES.interlagos,
  },
  {
    id: 'laguna', name: 'Laguna Seca', country: 'US', flag: '🇺🇸', theme: 'california',
    kerb: VIBREUR_FIA,
    length: 2400, width: 13, laps: 4,
    pts: TRACES.laguna,
  },
  {
    id: 'nurburgring', name: 'Nürburgring GP', country: 'DE', flag: '🇩🇪', theme: 'forest',
    kerb: VIBREUR_FIA,
    length: 3000, width: 15, laps: 3,
    pts: TRACES.nurburgring,
  },
  {
    id: 'lemans', name: 'Le Mans', country: 'FR', flag: '🇫🇷', theme: 'lemans',
    kerb: VIBREUR_FIA,
    length: 4200, width: 15, laps: 2,
    pts: [
      [0, 0], [40, 0],
      [48, -2], [54, -6], [60, -6], [64, 0],
      [70, 8], [72, 20],
      [66, 30], [66, 40], [74, 48],
      [82, 56],
      [110, 72], [130, 84], [138, 80], [146, 88], [156, 96],
      [180, 112], [206, 128], [214, 124], [222, 132], [232, 140],
      [258, 158], [272, 168], [278, 180], [270, 192], [256, 192],
      [230, 190], [200, 188],
      [190, 184], [188, 176], [180, 172], [170, 174],
      [162, 170], [160, 162],
      [150, 150], [132, 132], [112, 114],
      [100, 106], [90, 110], [80, 102], [72, 90], [60, 84], [50, 88],
      [40, 80], [30, 72], [24, 58],
      [18, 44], [12, 36], [6, 20], [2, 8],
    ],
  },
  {
    id: 'bathurst', name: 'Mount Panorama', country: 'AU', flag: '🇦🇺', theme: 'bush',
    kerb: VIBREUR_FIA,
    length: 3600, width: 13, laps: 3,
    pts: TRACES.bathurst,
  },
  {
    id: 'redbullring', name: 'Red Bull Ring', country: 'AT', flag: '🇦🇹', theme: 'alpine',
    kerb: VIBREUR_FIA,
    length: 2400, width: 15, laps: 4,
    pts: TRACES.redbullring,
  },
  {
    id: 'zandvoort', name: 'Zandvoort', country: 'NL', flag: '🇳🇱', theme: 'dunes',
    kerb: VIBREUR_FIA,
    length: 2400, width: 13, laps: 4,
    pts: TRACES.zandvoort,
  },
];

if (typeof module !== 'undefined') module.exports = { TRACKS };
