// LE RAIL DE CAMÉRA : on résout le cadrage HORS LIGNE, une fois, parce que le circuit ne bouge pas.
//
//   node tools/rail.js [circuit]        (défaut : monza)   → écrit js/rails.js
//
// Une caméra d'exécution choisit sa pose à l'aveugle, image par image, avec ce qu'elle sait à
// l'instant : c'est un choix glouton. Nos circuits sont figés, et la ligne idéale aussi. On peut
// donc chercher, pour chaque station du tour, la pose qui montre le plus de piste devant — par
// recherche exhaustive, pas par heuristique — puis imposer la continuité sur le tour entier.
//
// La douceur n'est alors plus l'affaire d'un filtre qui court après sa cible : elle est GARANTIE
// PAR CONSTRUCTION, puisque le rail est lissé avant d'être joué. C'est le plan de caméra d'un
// réalisateur qui a repéré le circuit, pas celui d'un cadreur qui découvre le virage.
//
// Le rail est calculé À LA VITESSE DE RÉFÉRENCE du circuit, celle du profil qui sert déjà au guide
// de freinage : à chaque station, la vitesse qu'on y passe est connue, donc le cadre aussi.
const fs = require('fs'), vm = require('vm'), path = require('path');

const R = path.join(__dirname, '..');
let src = '';
for (const f of ['util', 'traces', 'tracks', 'track', 'cars', 'car', 'race', 'props'])
  src += fs.readFileSync(path.join(R, 'js', f + '.js'), 'utf8')
    .replace(/'use strict';/g, '').replace(/if \(typeof module[^\n]*\n/g, '') + '\n';

src += `
const W = 900, H = 1600;          // le cadre le plus serré : un téléphone en portrait
const PAS = 10;                   // une station tous les dix mètres
const ID = ARGS[0] || 'monza';

const td = TRACKS.find((t) => t.id === ID);
if (!td) { console.log('circuit inconnu : ' + ID); SORTIE.code = 1; }
const race = new Race({ trackDef: td, classId: 'gt', difficulty: 'medium',
  playerAI: true, playerLivery: 0, nCars: 1 });
const T = race.track, VMAX = race.player.cls.vmax;

const surLigne = (s) => { const u = T.wrap(s); return T.pos(u, T.lineLat('racing', u)); };
const capLigne = (s, pas) => {
  const a = surLigne(s - pas), b = surLigne(s + pas);
  return Math.atan2(b.y - a.y, b.x - a.x);
};

/* CE QU'UNE POSE MONTRE : on avance le long du tour depuis la voiture, par pas de cinq mètres,
jusqu'à sortir du cadre. C'est la mesure du banc, à l'identique — sinon on optimiserait une chose
et on en mesurerait une autre. */
function vue(s0, cx, cy, ang, m) {
  const zoom = H / m, a = -ang - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
  for (let d = 5; d <= 400; d += 5) {
    const q = T.pos(T.wrap(s0 + d), 0);
    const u = (q.x - cx) * zoom, v = (q.y - cy) * zoom;
    const qx = u * ca - v * sa, qy = u * sa + v * ca;
    if (Math.abs(qx) >= W / 2 || Math.abs(qy) >= H / 2) return d - 5;
  }
  return 400;
}

/* LA RECHERCHE, à trois paramètres par station.

  dAng  l'orientation, autour du cap de la ligne — bornée à ±45°, comme la vue ACP et pour la même
        raison : au-delà, la route traverse l'écran au lieu d'y monter.
  m     le cadre, de celui que donnerait la vitesse jusqu'à 1,8 fois.
  dLat  un décalage latéral, pour décentrer la voiture du côté opposé au virage.

L'avance longitudinale n'est pas cherchée : elle est DÉDUITE du cadre, de façon à poser la voiture
à 88 % de la hauteur. C'est le réglage que l'essai a déjà tranché, et le laisser libre aurait surtout
servi à le faire dériver d'une station à l'autre. */
const ANGS = [], MS = [], LATS = [], AVS = [];
for (let i = -15; i <= 15; i++) ANGS.push(i * Math.PI / 60);        // ±45° par 3°
for (let i = 0; i <= 6; i++) MS.push(1 + i * 0.1);                  // ×1 à ×1,6
for (let i = -5; i <= 5; i++) LATS.push(i * 0.10);                  // ±50 % de la demi-largeur
for (let i = 0; i <= 5; i++) AVS.push(0.20 + i * 0.044);            // voiture de 70 % à 92 %

const n = Math.round(T.length / PAS);
const rail = [];
const refs = [];
for (let k = 0; k < n; k++) {
  const s = k * PAS;
  const i = T.idx(s);
  const vref = race.profiles.racing[i];
  const vfr = Math.min(1, vref / VMAX);
  const base = (30 + 45 * vfr) * 1.35;
  const P = surLigne(s), cap = capLigne(s, base * 0.22);
  let cible = 0;                 // posée juste après, une fois la référence mesurée
  let best = null;
  const juge = (da, fm, fl, av, cx, cy) => {
    const ang = cap + da, m = base * fm;
    const v = vue(s, cx, cy, ang, m);
    /* L'OBJECTIF EST « VOIR ASSEZ, LE PLUS SERRÉ POSSIBLE », pas « voir le plus loin ».

    Première version : maximiser la piste vue. Le rail est sorti dézoomé à fond partout — à 5 m de
    vue près, le solveur préférait toujours ouvrir le cadre, puisque rien ne lui coûtait. C'était
    devenu une caméra large, c'est-à-dire précisément la piste au rendement décroissant qu'on
    cherchait à éviter, obtenue par un détour de deux cents lignes.

    On vise donc un PRÉAVIS EN TEMPS, qui est la vraie monnaie : une seconde et demie de piste à la
    vitesse de référence de cette station. Dès qu'une pose l'atteint, on prend la plus serrée, la
    moins tournée, la moins décalée. Le cadre ne s'ouvre que là où le cadrage seul n'y arrive pas,
    et c'est exactement ce qu'on voulait savoir : où. */
    const score = v >= cible
      ? 1e6 - fm * 1e4 - Math.abs(da) * 3e3 - Math.abs(fl) * 2e3
      : v * 100 - fm * 10;
    if (!best || score > best.score) best = { score, da, fm, fl, av, v };
  };

  /* LA POSE D'AUJOURD'HUI EST DANS L'ENSEMBLE DE DÉPART, et ce n'est pas un détail.

  Sans elle, la recherche peut rendre MOINS que la caméra qu'elle remplace : c'est arrivé, de dix à
  vingt mètres aux stations dures, parce que le barycentre d'un virage tombe à un endroit que mon
  paramétrage (avance le long de l'axe + décalage latéral) n'atteignait pas. Un optimiseur ne vaut
  que par son espace de recherche, et le plus sûr moyen de ne jamais régresser est d'y mettre ce
  qu'on a déjà. Le rail ne peut donc être pire qu'à égalité, avant lissage. */
  {
    const D = base * 0.90, N = 12;
    let bx = 0, by = 0;
    for (let j = 0; j <= N; j++) { const q = surLigne(s + D * j / N); bx += q.x; by += q.y; }
    bx /= N + 1; by /= N + 1;
    const angR = capLigne(s + D / 2, base * 0.22);
    const a = -angR - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
    let ex = (bx - P.x) * ca - (by - P.y) * sa, ey = (bx - P.x) * sa + (by - P.y) * ca;
    const demi = base / 2, demiL = base * W / H / 2;
    ex = Math.max(-demiL * 0.72, Math.min(demiL * 0.72, ex));
    ey = Math.max(-demi * 0.62, Math.min(demi * 0.30, ey));
    refs.push({ ang: angR, m: base, x: P.x + ex * ca + ey * sa, y: P.y - ex * sa + ey * ca });
    let dr = angR - cap;
    while (dr > Math.PI) dr -= 2 * Math.PI;
    while (dr < -Math.PI) dr += 2 * Math.PI;
    /* LA CIBLE EST « AU MOINS CE QUE LA CAMÉRA ACTUELLE DONNE ».

    Avec un simple préavis en temps, le solveur faisait pire que ce qu'on a : la cible atteinte, il
    ne regardait plus la vue du tout et troquait quinze mètres de piste contre un cadre un cran plus
    serré, qui ne rapporte rien à personne. Une cible n'est un plancher que si elle est posée au
    niveau du plancher réel. On mesure donc d'abord la pose d'aujourd'hui, et on exige au moins ça,
    en plus du préavis d'une seconde et demie. */
    cible = Math.max(vue(s, refs[k].x, refs[k].y, angR, base), Math.min(100, 1.5 * vref));
    juge(dr, 1, ex / demiL / 2, -ey / base, refs[k].x, refs[k].y);
  }

  for (const da of ANGS) {
    const ang = cap + da, ca = Math.cos(ang), sa = Math.sin(ang);
    for (const fm of MS) {
      const m = base * fm, demiL = m * W / H / 2;
      for (const av of AVS) {
        const d = m * av;
        for (const fl of LATS) {
          const lat = fl * demiL * 2;
          juge(da, fm, fl, av, P.x + ca * d - sa * lat, P.y + sa * d + ca * lat);
        }
      }
    }
  }
  rail.push(best);
}

/* LE LISSAGE DU RAIL, sur le tour entier et en boucle fermée.

Station par station, l'optimum saute : deux poses très différentes montrent souvent la même chose à
cinq mètres près, et le meilleur score bascule de l'une à l'autre. Joué tel quel, le rail tremble.
On passe donc une moyenne glissante, plusieurs fois, en traitant le tour comme un anneau — un rail
qui ne se referme pas se verrait à chaque passage de la ligne. */
const lisse = (champ, passes, demi) => {
  for (let p = 0; p < passes; p++) {
    const avant = rail.map((r) => r[champ]);
    for (let k = 0; k < n; k++) {
      let somme = 0, c = 0;
      for (let j = -demi; j <= demi; j++) { somme += avant[(k + j + n * 2) % n]; c++; }
      rail[k][champ] = somme / c;
    }
  }
};
/* Deux passes sur vingt mètres, pas quatre sur quarante. Première version : ±3 à ±4 stations,
soit une moyenne sur trente à quarante mètres — à l'échelle d'une chicane, ça efface l'optimum au
lieu de l'adoucir, et le rail lissé rendait moins que la caméra d'aujourd'hui dans les cas durs,
qui sont justement ceux qu'il devait traiter. */
/* Une passe sur dix mètres, pas quatre sur quarante. Mesuré : à ±3 ou ±4 stations, la moyenne
efface l'optimum au lieu de l'adoucir — le rail lissé rendait moins que la caméra d'aujourd'hui aux
stations dures, qui sont justement celles qu'il devait traiter. La douceur se vérifie plus bas, en
degrés par mètre, au lieu de se supposer. */
lisse('da', 1, 1);
lisse('fm', 1, 2);
lisse('fl', 1, 1);
lisse('av', 1, 1);

// ce que le rail lissé montre vraiment : on remesure, sinon on publierait le score de l'optimum
// brut, qui n'est plus celui qu'on joue
const vuesA = [], vuesB = [];
let pireA = 400;
for (let k = 0; k < n; k++) {
  const s = k * PAS, r = rail[k];
  const i = T.idx(s), vfr = Math.min(1, race.profiles.racing[i] / VMAX);
  const base = (30 + 45 * vfr) * 1.35, m = base * r.fm;
  const P = surLigne(s), cap = capLigne(s, base * 0.22), ang = cap + r.da;
  const ca = Math.cos(ang), sa = Math.sin(ang), d = m * r.av, lat = r.fl * m * W / H;
  r.vue = vue(s, P.x + ca * d - sa * lat, P.y + sa * d + ca * lat, ang, m);
  vuesA.push(vue(s, refs[k].x, refs[k].y, refs[k].ang, refs[k].m));
  vuesB.push(r.vue);
  pireA = Math.min(pireA, r.vue);
}
const quant = (a, f) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length * f)]; };
console.log(ID + ' : ' + n + ' stations, pas de ' + PAS + ' m');
console.log('  vue devant, médiane   : ' + quant(vuesA, 0.5) + ' m  ->  ' + quant(vuesB, 0.5) + ' m');
console.log('  vue devant, 10e cent. : ' + quant(vuesA, 0.1) + ' m  ->  ' + quant(vuesB, 0.1) + ' m');
console.log('  vue devant, au pire   : ' + Math.min(...vuesA) + ' m  ->  ' + pireA + ' m');
{
  const pires = rail.map((r, k) => ({ k, brut: r.v, lisse: r.vue, ref: vuesA[k] }))
    .sort((a, b) => a.lisse - b.lisse).slice(0, 6);
  console.log('  stations les plus courtes (station : brut -> lissé, référence) :');
  for (const q of pires) console.log('    ' + String(q.k * PAS).padStart(5) + ' m : ' + String(q.brut).padStart(3) + ' -> ' + String(q.lisse).padStart(3) + '   (réf ' + q.ref + ')');
}
console.log('  cadre   : ×' + Math.min(...rail.map((r) => r.fm)).toFixed(2) + ' à ×' + Math.max(...rail.map((r) => r.fm)).toFixed(2));
{
  let dmax = 0, mmax = 0;
  for (let k = 0; k < n; k++) {
    const a = rail[k], b = rail[(k + 1) % n];
    dmax = Math.max(dmax, Math.abs(b.da - a.da) / PAS);
    mmax = Math.max(mmax, Math.abs(b.fm - a.fm) / PAS);
  }
  // la douceur se mesure : à 60 m/s, x °/m fait 60x °/s de rotation ajoutée
  console.log('  douceur : ' + (dmax * 180 / Math.PI).toFixed(2) + ' °/m au pire ('
    + (dmax * 180 / Math.PI * 60).toFixed(0) + ' °/s à 60 m/s), cadre ' + (mmax * 100).toFixed(2) + ' %/m');
}
console.log('  rotation: ' + (Math.max(...rail.map((r) => Math.abs(r.da))) * 180 / Math.PI).toFixed(0) + '° au plus loin de la corde');

// quatre nombres par station : écart de cap (millièmes de radian), cadre (centièmes), décalage
// latéral (millièmes), et la vue obtenue (mètres, pour la documentation seulement)
const plat = [];
for (const r of rail) plat.push(Math.round(r.da * 1000), Math.round(r.fm * 100), Math.round(r.fl * 1000), Math.round(r.av * 1000), r.vue);
SORTIE.js = 'RAILS.' + ID + " = { pas: " + PAS + ", v: [" + plat.join(',') + "] };\\n";
`;
const SORTIE = { js: '', code: 0 };
vm.runInNewContext(src, { Math, console, Date, Float32Array, Float64Array, ARGS: process.argv.slice(2),
  navigator: { language: 'fr' }, localStorage: { getItem: () => null, setItem: () => {} },
  document: { createElement: () => ({ getContext: () => null }) }, window: {}, SORTIE },
  { filename: 'rail' });
if (SORTIE.code) process.exit(SORTIE.code);

const ENTETE = `'use strict';
/* RAILS DE CAMÉRA — données calculées, ne pas écrire à la main.

   node tools/rail.js <circuit>

Pour chaque station du tour, la pose de caméra qui montre le plus de piste devant, cherchée hors
ligne et lissée sur le tour entier. Cinq nombres par station : écart de cap à la corde de la ligne
idéale (en millièmes de radian), cadre en multiples de celui que donnerait la vitesse (en
centièmes), décalage latéral (en millièmes de la largeur de l'écran), avance de la caméra (en
millièmes du cadre) et la piste vue obtenue (en mètres, pour la documentation). Voir le README, « Le rail de caméra ». */
const RAILS = {};
`;
const dest = path.join(R, 'js', 'rails.js');
let txt = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : ENTETE;
if (!txt.startsWith("'use strict'")) txt = ENTETE;
const id = (process.argv[2] || 'monza');
const re = new RegExp('^RAILS\\.' + id + ' = .*$\\n?', 'm');
txt = re.test(txt) ? txt.replace(re, SORTIE.js) : txt + SORTIE.js;
if (!/if \(typeof module/.test(txt)) txt += "\nif (typeof module !== 'undefined') module.exports = { RAILS };\n";
else txt = txt.replace(/\nif \(typeof module[\s\S]*$/, "\nif (typeof module !== 'undefined') module.exports = { RAILS };\n");
fs.writeFileSync(dest, txt);
console.log('  écrit : js/rails.js (' + (txt.length / 1024).toFixed(1) + ' Ko)');
