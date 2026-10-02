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
