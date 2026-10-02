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

Le Royaume-Uni et la France ont le même drapeau à trois couleurs ; l'ordre les distingue à l'œil.
L'Australie prend le vert et l'or de ses couleurs sportives, son drapeau étant lui aussi bleu, blanc
et rouge. */
const DRAPEAUX = {
  it: ['#1f8a4c', '#f2f0ea', '#c8372d'],            // Italie
  be: ['#1d1b22', '#f0c419', '#c8372d'],            // Belgique
  mc: ['#c8372d', '#f2f0ea'],                       // Monaco
  gb: ['#c8372d', '#f2f0ea', '#2f4b9a'],            // Royaume-Uni
  jp: ['#f2f0ea', '#c8372d'],                       // Japon
  br: ['#1f8a4c', '#e8bc32', '#2f63b0'],            // Brésil
  us: ['#c8372d', '#f2f0ea', '#2f4b9a'],            // États-Unis
  de: ['#1d1b22', '#c8372d', '#e8bc32'],            // Allemagne
  fr: ['#2f4b9a', '#f2f0ea', '#c8372d'],            // France
  au: ['#1f8a4c', '#e8bc32'],                       // Australie, couleurs sportives
  at: ['#c8372d', '#f2f0ea'],                       // Autriche
  nl: ['#e07a1f', '#f2f0ea', '#2f4b9a'],            // Pays-Bas, orange en tête
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
  },
  {
    id: 'silverstone', name: 'Silverstone', country: 'GB', flag: '🇬🇧', theme: 'autumn',
    kerb: DRAPEAUX.gb,
    length: 3300, width: 16, laps: 3, puddles: 0.4,
    pts: TRACES.silverstone,
  },
  {
    id: 'suzuka', name: 'Suzuka', country: 'JP', flag: '🇯🇵', theme: 'japan',
    kerb: DRAPEAUX.jp,
    length: 3300, width: 14, laps: 3,
    pts: TRACES.suzuka,
  },
  {
    id: 'interlagos', name: 'Interlagos', country: 'BR', flag: '🇧🇷', theme: 'tropical',
    kerb: DRAPEAUX.br,
    length: 2700, width: 14, laps: 4,
    pts: TRACES.interlagos,
  },
  {
    id: 'laguna', name: 'Laguna Seca', country: 'US', flag: '🇺🇸', theme: 'california',
    kerb: DRAPEAUX.us,
    length: 2400, width: 13, laps: 4,
    pts: TRACES.laguna,
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
  },
  {
    id: 'bathurst', name: 'Mount Panorama', country: 'AU', flag: '🇦🇺', theme: 'bush',
    kerb: DRAPEAUX.au,
    length: 3600, width: 13, laps: 3,
    pts: TRACES.bathurst,
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
