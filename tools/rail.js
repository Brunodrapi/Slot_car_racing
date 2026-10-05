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
/* LE RAIL EST CALCULÉ EN CIRCUIT FIXE : le nord reste en haut, donc l'écran ne tourne pas et
l'orientation n'est plus un paramètre. Il ne reste que le CENTRE et le CADRE — c'est tout ce qu'une
vue fixe offre, et c'est aussi ce qui la rend plus difficile : on ne peut pas présenter le virage, il
faut le loger tel qu'il se présente. Le cadre se mesure sur le petit côté de l'écran, comme la vue
fixe du jeu. */
function vue(s0, cx, cy, m) {
  const zoom = Math.min(W, H) / m;
  for (let d = 5; d <= 400; d += 5) {
    const q = T.pos(T.wrap(s0 + d), 0);
    const qx = (q.x - cx) * zoom, qy = (q.y - cy) * zoom;
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
const MS = [], EX = [], EY = [];
for (let i = 0; i <= 6; i++) MS.push(1 + i * 0.1);                  // ×1 à ×1,6
for (let i = -6; i <= 6; i++) EX.push(i * 0.08);                    // ±48 % de la demi-largeur
for (let i = -6; i <= 6; i++) EY.push(i * 0.08);                    // ±48 % de la demi-hauteur

const n = Math.round(T.length / PAS);
const rail = [];
const refs = [];
for (let k = 0; k < n; k++) {
  const s = k * PAS;
  const i = T.idx(s);
  const vref = race.profiles.racing[i];
  const vfr = Math.min(1, vref / VMAX);
  const base = (20 + 30 * vfr) * 1.35;          // le cadre de la vue FIXE, pas celui de la tournée
  const P = surLigne(s);
  let cible = 0;
  let best = null;
  const juge = (fm, ex, ey, cx, cy) => {
    const m = base * fm;
    const v = vue(s, cx, cy, m);
    /* L'OBJECTIF EST « VOIR ASSEZ, LE PLUS SERRÉ POSSIBLE », pas « voir le plus loin ».

    Première version : maximiser la piste vue. Le rail est sorti dézoomé à fond partout — à 5 m de
    vue près, le solveur préférait toujours ouvrir le cadre, puisque rien ne lui coûtait. C'était
    devenu une caméra large, c'est-à-dire précisément la piste au rendement décroissant qu'on
    cherchait à éviter, obtenue par un détour de deux cents lignes.

    Deuxième version : un préavis en temps comme cible. L'inverse — la cible atteinte, le solveur ne
    regardait plus la vue du tout et troquait quinze mètres de piste contre un cadre un cran plus
    serré. La cible est donc AU MOINS CE QUE LA CAMÉRA ACTUELLE DONNE, mesuré station par station,
    en plus du préavis d'une seconde et demie. */
    const score = v >= cible
      ? 1e6 - fm * 1e4 - Math.abs(ex) * 2e3 - Math.abs(ey) * 2e3
      : v * 100 - fm * 10;
    if (!best || score > best.score) best = { score, fm, ex, ey, v };
  };

  /* LA POSE D'AUJOURD'HUI EST DANS L'ENSEMBLE DE DÉPART, et ce n'est pas un détail.

  Sans elle, la recherche peut rendre MOINS que la caméra qu'elle remplace : c'est arrivé, de dix à
  vingt mètres aux stations dures. Un optimiseur ne vaut que par son espace de recherche, et le plus
  sûr moyen de ne jamais régresser est d'y mettre ce qu'on a déjà. */
  {
    const D = base * (0.24 + 0.40 * vfr), N = 12;     // la fenêtre de la vue « en avance, fixe »
    let bx = 0, by = 0;
    for (let j = 0; j <= N; j++) { const q = surLigne(s + D * j / N); bx += q.x; by += q.y; }
    bx /= N + 1; by /= N + 1;
    const demiL = base * W / Math.min(W, H) / 2, demiH = base * H / Math.min(W, H) / 2;
    let ex = Math.max(-demiL * 0.56, Math.min(demiL * 0.56, bx - P.x));
    let ey = Math.max(-demiH * 0.56, Math.min(demiH * 0.56, by - P.y));
    refs.push({ m: base, x: P.x + ex, y: P.y + ey });
    cible = Math.max(vue(s, refs[k].x, refs[k].y, base), Math.min(100, 1.5 * vref));
    juge(1, ex / demiL, ey / demiH, refs[k].x, refs[k].y);
  }

  for (const fm of MS) {
    const m = base * fm;
    const demiL = m * W / Math.min(W, H) / 2, demiH = m * H / Math.min(W, H) / 2;
    for (const ex of EX) for (const ey of EY) juge(fm, ex, ey, P.x + ex * demiL, P.y + ey * demiH);
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
/* COMBIEN LISSER : la question a été posée au banc, pas tranchée au jugé.

De une passe sur dix mètres à trois passes sur trente, la piste vue ne bouge PAS d'un mètre — ni en
médiane, ni au dixième centile, ni au pire — pendant que l'agitation tombe de 101 à 41 % d'écran par
seconde. Le lissage est donc gratuit ici, et on en prend autant qu'il en donne. (En vue tournée,
où le rail portait aussi un cap, il ne l'était pas : quatre passes sur quarante mètres y effaçaient
l'optimum au lieu de l'adoucir, à l'échelle d'une chicane.) */
lisse('fm', 3, 4);
lisse('ex', 3, 3);
lisse('ey', 3, 3);

// ce que le rail lissé montre vraiment : on remesure, sinon on publierait le score de l'optimum
// brut, qui n'est plus celui qu'on joue
const vuesA = [], vuesB = [];
let pireA = 400;
for (let k = 0; k < n; k++) {
  const s = k * PAS, r = rail[k];
  const i = T.idx(s), vfr = Math.min(1, race.profiles.racing[i] / VMAX);
  const base = (20 + 30 * vfr) * 1.35, m = base * r.fm;
  const P = surLigne(s);
  const demiL = m * W / Math.min(W, H) / 2, demiH = m * H / Math.min(W, H) / 2;
  r.vue = vue(s, P.x + r.ex * demiL, P.y + r.ey * demiH, m);
  vuesA.push(vue(s, refs[k].x, refs[k].y, refs[k].m));
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
  let emax = 0, mmax = 0;
  for (let k = 0; k < n; k++) {
    const a = rail[k], b = rail[(k + 1) % n];
    emax = Math.max(emax, Math.hypot(b.ex - a.ex, b.ey - a.ey) / PAS);
    mmax = Math.max(mmax, Math.abs(b.fm - a.fm) / PAS);
  }
  // la douceur se mesure : en fraction d'écran par mètre parcouru, puis par seconde à 60 m/s
  console.log('  douceur : ' + (emax * 100).toFixed(2) + ' % d écran par m ('
    + (emax * 100 * 60).toFixed(0) + ' %/s à 60 m/s), cadre ' + (mmax * 100).toFixed(2) + ' %/m');
}
console.log('  décalage: ' + (Math.max(...rail.map((r) => Math.hypot(r.ex, r.ey))) * 100).toFixed(0) + ' % de demi-écran au plus loin');

// quatre nombres par station : écart de cap (millièmes de radian), cadre (centièmes), décalage
// latéral (millièmes), et la vue obtenue (mètres, pour la documentation seulement)
const plat = [];
for (const r of rail) plat.push(Math.round(r.ex * 1000), Math.round(r.ey * 1000), Math.round(r.fm * 100), r.vue);
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
ligne et lissée sur le tour entier. Calculé EN CIRCUIT FIXE, donc sans orientation : il ne
reste que le centre et le cadre. Quatre nombres par station : décalage de la caméra en x et en y
(en millièmes de demi-écran, axes du monde), cadre en multiples de celui que donnerait la vitesse
(en centièmes), et la piste vue obtenue (en mètres, pour la documentation). Voir le README, « Le rail de caméra ». */
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
