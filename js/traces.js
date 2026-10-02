/* Eyes On Line — la GÉOMÉTRIE des circuits, et elle seule.
 *
 * CE FICHIER N'EST PAS SOUS LA MÊME LICENCE QUE LE RESTE DU JEU.
 *
 * Les suites de points qu'il contient sont relevées sur des fonds de carte vectoriels publiés par
 * leurs auteurs sous licence Creative Commons. Le partage à l'identique de ces licences porte sur
 * l'adaptation de l'œuvre — c'est-à-dire sur ces coordonnées — et non sur ce qui les entoure : le
 * moteur, la physique, l'interface et le reste du jeu ne sont pas une adaptation d'une carte.
 *
 * C'est pour que cette frontière soit LISIBLE que la géométrie vit dans un fichier à elle. Mêlée
 * aux largeurs, aux thèmes et aux réglages de `js/tracks.js`, personne n'aurait pu dire où elle
 * s'arrête — et une obligation qu'on ne sait pas délimiter finit par être soit ignorée, soit
 * étendue à tort.
 *
 * Qui a dessiné quoi, et sous quelle licence : voir `LICENCES.md` à la racine.
 *
 * Fabriqué par `tools/tracer.py`, qui lit la ligne médiane dans le chemin SVG de la carte,
 * rééchantillonne à pas constant, oriente la boucle dans le sens attendu par `js/track.js` et pose
 * le premier point sur la plus longue ligne droite — c'est de lui qu'on compte les tours.
 *
 * Les coordonnées sont sans unité : `js/track.js` met la boucle à l'échelle de la longueur déclarée
 * dans `js/tracks.js`. Un circuit du jeu reste plus court que le vrai ; c'est sa FORME qui est juste,
 * pas sa taille.
 */
'use strict';

const TRACES = {
  /* Autodromo Nazionale Monza.
     D'après « Monza track map » de Will Pittenger, CC BY-SA 3.0, via Wikimedia Commons.
     180 points · boucle de 509 unités · départ sur la ligne droite des stands. */
  monza: [
    [15.2, 47.9], [12.3, 48.0], [9.5, 48.0], [6.7, 48.1], [3.8, 48.1], [1.0, 48.2],
    [-1.9, 48.2], [-4.7, 48.2], [-7.5, 48.3], [-10.4, 48.3], [-13.2, 48.3], [-16.0, 48.4],
    [-18.9, 48.4], [-21.7, 48.4], [-23.6, 46.8], [-24.6, 44.6], [-27.3, 45.5], [-29.9, 46.5],
    [-32.6, 47.4], [-35.4, 48.2], [-38.1, 48.7], [-41.0, 49.0], [-43.8, 49.1], [-46.6, 49.1],
    [-49.5, 49.0], [-52.3, 48.9], [-55.1, 48.7], [-57.9, 48.4], [-60.7, 47.5], [-63.2, 46.3],
    [-65.6, 44.8], [-68.0, 43.2], [-70.1, 41.4], [-72.1, 39.3], [-73.7, 37.0], [-75.1, 34.5],
    [-76.3, 32.0], [-77.3, 29.3], [-78.1, 26.6], [-78.8, 23.8], [-79.5, 21.1], [-80.1, 18.3],
    [-80.6, 15.5], [-81.1, 12.7], [-81.6, 9.9], [-82.1, 7.1], [-82.6, 4.3], [-83.1, 1.5],
    [-83.5, -1.2], [-84.0, -4.0], [-84.5, -6.8], [-85.0, -9.6], [-87.3, -11.0], [-89.3, -12.8],
    [-90.3, -15.4], [-91.4, -18.0], [-92.5, -20.6], [-93.7, -23.2], [-94.9, -25.8], [-96.2, -28.3],
    [-97.5, -30.8], [-98.7, -33.4], [-99.6, -36.1], [-100.0, -38.9], [-99.4, -41.6], [-97.5, -43.7],
    [-95.0, -45.1], [-92.3, -45.6], [-89.5, -46.2], [-86.7, -46.8], [-83.9, -47.3], [-81.1, -47.8],
    [-78.3, -48.4], [-75.5, -48.9], [-72.8, -49.1], [-70.6, -47.3], [-68.9, -45.0], [-67.3, -42.6],
    [-65.7, -40.3], [-64.1, -38.0], [-62.5, -35.7], [-60.8, -33.3], [-59.2, -31.0], [-57.5, -28.7],
    [-55.9, -26.4], [-54.1, -24.2], [-52.4, -21.9], [-50.5, -19.8], [-48.6, -17.7], [-46.6, -15.7],
    [-44.6, -13.7], [-42.6, -11.7], [-40.5, -9.8], [-38.4, -7.9], [-36.3, -6.0], [-34.2, -4.1],
    [-32.1, -2.2], [-30.0, -0.3], [-27.9, 1.7], [-25.8, 3.6], [-23.7, 5.5], [-21.6, 7.4],
    [-19.6, 9.4], [-17.5, 11.3], [-15.4, 13.2], [-13.2, 15.1], [-11.1, 17.0], [-9.0, 18.8],
    [-6.2, 19.2], [-3.5, 18.7], [-0.6, 18.5], [2.1, 19.2], [4.4, 20.8], [6.5, 22.7],
    [9.3, 23.3], [12.1, 23.5], [14.9, 23.5], [17.8, 23.5], [20.6, 23.5], [23.4, 23.5],
    [26.3, 23.5], [29.1, 23.4], [32.0, 23.4], [34.8, 23.4], [37.6, 23.4], [40.5, 23.4],
    [43.3, 23.4], [46.1, 23.4], [49.0, 23.4], [51.8, 23.4], [54.7, 23.4], [57.5, 23.4],
    [60.3, 23.4], [63.2, 23.4], [66.0, 23.4], [68.8, 23.4], [71.7, 23.5], [74.5, 23.5],
    [77.3, 23.5], [80.2, 23.5], [83.0, 23.5], [85.9, 23.5], [88.7, 23.5], [91.5, 23.6],
    [94.4, 23.8], [97.0, 24.8], [98.9, 26.8], [99.9, 29.5], [100.0, 32.3], [99.4, 35.1],
    [97.9, 37.4], [95.9, 39.5], [93.7, 41.3], [91.3, 42.8], [88.7, 43.8], [85.9, 44.6],
    [83.1, 45.1], [80.3, 45.5], [77.5, 45.8], [74.7, 46.1], [71.9, 46.4], [69.0, 46.6],
    [66.2, 46.8], [63.4, 47.0], [60.5, 47.1], [57.7, 47.2], [54.9, 47.2], [52.0, 47.3],
    [49.2, 47.3], [46.4, 47.3], [43.5, 47.4], [40.7, 47.4], [37.9, 47.4], [35.0, 47.5],
    [32.2, 47.5], [29.3, 47.6], [26.5, 47.7], [23.7, 47.8], [20.8, 47.8], [18.0, 47.9],
  ],
};

if (typeof module !== 'undefined') module.exports = { TRACES };
