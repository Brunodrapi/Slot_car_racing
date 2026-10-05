// LES INDICATIONS D'UN CIRCUIT : une par FREINAGE, pas une par virage.
//
//   node tools/notes.js                      → ce que ça donnerait, sans rien écrire
//   node tools/notes.js --ecrire             → remplace les blocs `panneaux:` de js/tracks.js
//   node tools/notes.js spa                  → un seul circuit
//   node tools/notes.js spa --amplitudes     → ne reprend que les notes d'une liste existante
//
// CE QU'UNE INDICATION SERT À SAVOIR, C'EST QUAND FREINER. Tout découle de là, et la première
// version l'avait manqué : elle posait un triplet par VIRAGE, ce qui donnait vingt-six jeux de
// flèches à Monaco — « des flèches partout mais rarement celles qui servent ». Un virage qu'on
// prend à plein gaz n'a rien à annoncer, et deux virages enchaînés qu'on freine une seule fois
// n'ont qu'une annonce à faire : celle du plus dur.
//
// ON NE CHERCHE DONC PLUS DES VIRAGES MAIS DES FREINAGES, dans le profil de vitesse de référence —
// celui-là même qui sert au guide de freinage, donc la vérité du jeu et pas une approximation de
// la géométrie. Chaque minimum local du profil est un ralentissement ; ce qui le rend digne d'une
// annonce est la DISTANCE DE FREINAGE qu'il exige, (v² − v'²) / 2a, qui est une longueur et se
// compare donc d'un circuit à l'autre. Un seuil en pourcentage de chute ne le permettait pas :
// Monza et Monaco n'ont pas la même plage de vitesse, et le même pourcentage y comptait cinq
// freinages à l'un et seize à l'autre.
//
// Vingt mètres de freinage : Monza en compte sept — exactement ses vraies zones, de la première
// chicane à la Parabolique — Monaco dix, Zandvoort douze. Bruno en avait posé treize à la main à
// Zandvoort, ce qui est la seule calibration dont on dispose.
//
// LE RESTE VIENT DE ZANDVOORT, lu dans ce qu'il a posé :
//
//   1. UN TRIPLET PAR FREINAGE : 100 m, 50 m, puis une flèche SANS CHIFFRE posée sur l'entrée. Les
//      deux premières annoncent, la troisième marque.
//   2. UN 200 m EN PLUS quand la ligne droite qui précède en laisse la place.
//   3. MÊME NOTE ET MÊME SENS SUR TOUT LE TRIPLET.
//   4. LE VIRAGE ANNONCÉ EST CELUI QUI FAIT FREINER, pas le premier rencontré. Une amorce molle
//      suivie d'un virage dur s'annonce par le dur : c'est lui qu'on veut connaître deux cents
//      mètres avant.
//
// Le sens vient de la géométrie et jamais de la liste d'avant.
const fs = require('fs'), vm = require('vm'), path = require('path');

const R = path.join(__dirname, '..');
let src = '';
for (const f of ['util', 'traces', 'tracks', 'track', 'cars', 'car'])
  src += fs.readFileSync(path.join(R, 'js', f + '.js'), 'utf8')
    .replace(/'use strict';/g, '').replace(/if \(typeof module[^\n]*\n/g, '') + '\n';

src += `
const SORTIE = {};
/* --amplitudes : ON NE TOUCHE QUE LA NOTE.

Bruno a posé Zandvoort à la main, virage par virage, y compris les triplets entrelacés d'un carré
droite suivi d'une épingle gauche : ses POSITIONS et ses SENS portent une intention que le calcul ne
sait pas retrouver. Seules les amplitudes sont faites à l'œil, et c'est tout ce qu'il a demandé de
reprendre. On relit donc sa liste et on remplace la note, rien d'autre.

LE VIRAGE VISÉ SE TROUVE PAR LE SENS AUTANT QUE PAR LA DISTANCE. Un panneau dont la cible tombe entre
deux virages opposés distants de trois mètres est ambigu pour qui ne regarde que la distance — mais
sa flèche dit déjà de quel côté il parle. On ne retient donc que les virages qui tournent du côté
qu'il annonce, puis le plus proche parmi eux. C'est l'auteur qui tranche, pas l'arrondi. */
if (ARGS.includes('--amplitudes')) {
  const id = ARGS.find((a) => !a.startsWith('--'));
  const td = TRACKS.find((t) => t.id === id);
  const T = new Track(td), N = T.n, zones = T.zonesVirages(30, true);
  const lignes = [], sortie = [];
  for (const p of td.panneaux) {
    const at = +p[0], dist = +p[1], note0 = p[2], sign = +p[3];
    const vise = Math.round(at * N) + Math.round(dist / T.ds);
    let best = Infinity, z = null;
    for (const q of zones) {
      if (q.sign !== sign) continue;
      const e = (((q.from % N) + N) % N);
      let d = (((e - vise) % N) + N) % N;
      if (d > N / 2) d -= N;
      if (Math.abs(d) < Math.abs(best)) { best = d; z = q; }
    }
    if (!z) { sortie.push([at, dist, note0, sign]); lignes.push('  ' + Math.round(at * T.length)
      + ' m : aucun virage de ce côté, note laissée telle quelle'); continue; }
    let turn = 0;
    for (let i = z.from; i < z.firstTo; i++) {
      const a = ((i % N) + N) % N, b = (((i + 1) % N) + N) % N;
      let e = T.th[b] - T.th[a];
      while (e > Math.PI) e -= 2 * Math.PI;
      while (e < -Math.PI) e += 2 * Math.PI;
      turn += e;
    }
    const A = Math.abs(turn) * 180 / Math.PI, rayon = 1 / z.peak;
    const prof = speedProfile(T, categoryById('gt').base, 'racing', 0.98);
    const to = (((z.to % N) + N) % N), from0 = (((z.from % N) + N) % N);
    let vmin = Infinity;
    for (let k = 0; k <= (((to - from0) % N) + N) % N; k++) vmin = Math.min(vmin, prof[(from0 + k) % N]);
    const note = Track.noteVirage(rayon, A, vmin / categoryById('gt').base.vmax);
    sortie.push([at, dist, note, sign]);
    if (String(note) !== String(note0)) lignes.push('  ' + String(Math.round(at * T.length)).padStart(5)
      + ' m · ' + String(note0).padStart(7) + ' → ' + String(note).padStart(7)
      + '   (virage de ' + A.toFixed(0) + '° au rayon ' + rayon.toFixed(0) + ' m)');
  }
  SORTIE[id] = {
    txt: sortie.map((b) => '      [' + b[0] + ', ' + b[1] + ', '
      + (typeof b[2] === 'number' ? b[2] : "'" + b[2] + "'") + ', ' + b[3] + '],').join('\\n'),
    n: sortie.length, zones: zones.length, lignes,
  };
  RESULTAT.v = SORTIE;
} else

{
const cls = categoryById('gt').base;
const BRAKE = cls.brake * 0.9;
const SEUIL = 20;                 // mètres de freinage à partir desquels ça vaut une annonce

/* LES FREINAGES D'UN CIRCUIT, lus dans le profil de vitesse de référence.

On filtre AVANT de grouper, et l'ordre compte : un complexe de virages produit un vrai freinage suivi
de plusieurs micro-creux de un à dix mètres. Groupés d'abord, le creux le plus lent l'emportait et
emportait avec lui sa distance de freinage minuscule — Monza tombait à un seul freinage au lieu de
sept. Filtrés d'abord, les micro-creux disparaissent et il ne reste que les vrais. */
function freinages(T) {
  const N = T.n, v = speedProfile(T, cls, 'racing', 0.98);
  const bruts = [];
  for (let i = 0; i < N; i++) {
    const a = v[(i - 1 + N) % N], b = v[(i + 1) % N];
    if (!(v[i] <= a && v[i] < b)) continue;
    let haut = v[i];
    for (let k = 1; k < N; k++) { const j = (i - k + N) % N; if (v[j] < haut) break; haut = v[j]; }
    const d = (haut * haut - v[i] * v[i]) / (2 * BRAKE);
    if (d >= SEUIL) bruts.push({ i, v: v[i], haut, d });
  }
  const nets = [];
  for (const m of bruts) {
    const p = nets[nets.length - 1];
    if (p && ((m.i - p.i + N) % N) * T.ds < 60) { if (m.d > p.d) nets[nets.length - 1] = m; }
    else nets.push(m);
  }
  return nets;
}

const seul = ARGS.find((a) => !a.startsWith('--'));
for (const td of TRACKS) {
  if (seul && td.id !== seul) continue;
  const T = new Track(td);
  const N = T.n, zones = T.zonesVirages(30, true);
  const freins = freinages(T);
  const prof = speedProfile(T, cls, 'racing', 0.98);
  const out = [], lignes = [];
  for (let fi = 0; fi < freins.length; fi++) {
    const f = freins[fi];
    /* LE VIRAGE ANNONCÉ EST CELUI QUI FAIT FREINER. On part du minimum de vitesse et on prend le
    virage qui le contient — pas le premier du groupe, pas le plus proche en distance. Une amorce
    molle suivie d'un virage dur s'annonce par le dur, puisque c'est lui qu'on freine. */
    /* LE PLUS SERRÉ À PORTÉE, pas celui qui contient le minimum.

    Première version : le virage qui contient le point le plus lent. À Monaco, un freinage de
    cinquante mètres s'est retrouvé annoncé « note 5 » — un décroché de neuf degrés — parce que le
    creux de vitesse tombait dans un kink entre deux virages, le profil étant encore en descente vers
    le vrai virage. On ne freine pas pour le point où on est lent, on freine pour ce qui rend lent.

    On prend donc, autour du freinage, le virage le plus FERMÉ : quatre-vingts mètres devant, vingt
    derrière, de quoi couvrir un virage dont l'entrée précède le creux sans attraper le suivant. */
    let z = null, pire = 0;
    for (const q of zones) {
      const a = (((q.from % N) + N) % N);
      let d = (((a - f.i) % N) + N) % N;
      if (d > N / 2) d -= N;
      const dist = d * T.ds;
      if (dist > 80 || dist < -20) continue;
      if (q.peak > pire) { pire = q.peak; z = q; }
    }
    if (!z) {                     // rien à portée : on retombe sur le plus proche, quel qu'il soit
      let best = Infinity;
      for (const q of zones) {
        const a = (((q.from % N) + N) % N);
        let d = (((a - f.i) % N) + N) % N;
        if (d > N / 2) d -= N;
        if (Math.abs(d) < Math.abs(best)) { best = d; z = q; }
      }
    }
    const from = (((z.from % N) + N) % N);
    let turn = 0;
    for (let i = z.from; i < z.firstTo; i++) {
      const a = ((i % N) + N) % N, b = (((i + 1) % N) + N) % N;
      let e = T.th[b] - T.th[a];
      while (e > Math.PI) e -= 2 * Math.PI;
      while (e < -Math.PI) e += 2 * Math.PI;
      turn += e;
    }
    const rayon = 1 / z.peak, A = Math.abs(turn) * 180 / Math.PI;
    // la vitesse la plus basse DANS le virage : c'est elle qui fait la note
    const to = (((z.to % N) + N) % N);
    let vmin = Infinity;
    for (let k = 0; k <= (((to - from) % N) + N) % N; k++) vmin = Math.min(vmin, prof[(from + k) % N]);
    const note = Track.noteVirage(rayon, A, vmin / cls.vmax);
    const sign = z.sign || 1;

    /* COMBIEN DE PLACE AVANT CE FREINAGE : la sortie du freinage précédent. On n'annonce pas à cent
    mètres si on freinait encore à soixante : le panneau tomberait dans le virage d'avant. */
    const prec = freins[(fi - 1 + freins.length) % freins.length];
    let place = freins.length < 2 ? N : (((from - prec.i) % N) + N) % N;

    const met = (recul, d) => {
      const i = (((from - Math.round(recul / T.ds)) % N) + N) % N;
      out.push({ at: i / N, dist: d, note, sign });
    };
    met(0, 0);
    if (place > 70) met(50, 50);
    if (place > 130) met(100, 100);
    if (place > 260) met(200, 200);
    lignes.push('  freinage ' + String(fi + 1).padStart(2) + ' : virage à ' + String(Math.round(from * T.ds)).padStart(5)
      + ' m · ' + A.toFixed(0).padStart(3) + '° · rayon ' + rayon.toFixed(0).padStart(3) + ' m · note '
      + String(note).padStart(7) + ' (passage à ' + vmin.toFixed(0) + ' m/s) · ' + (sign > 0 ? 'droite' : 'gauche')
      + ' · on freine ' + f.d.toFixed(0).padStart(3) + ' m (de ' + f.haut.toFixed(0) + ' à ' + f.v.toFixed(0)
      + ' m/s) · place ' + String(Math.round(place * T.ds)).padStart(4) + ' m');
  }
  out.sort((a, b) => a.at - b.at);
  SORTIE[td.id] = {
    txt: out.map((b) => '      [' + (Math.round(b.at * 10000) / 10000) + ', ' + b.dist + ', '
      + (typeof b.note === 'number' ? b.note : "'" + b.note + "'") + ', ' + b.sign + '],').join('\\n'),
    n: out.length, zones: freins.length, lignes,
  };
}
RESULTAT.v = SORTIE;
}
`;
const RESULTAT = { v: null };
vm.runInNewContext(src, { Math, console, Date, Float32Array, Float64Array, ARGS: process.argv.slice(2),
  navigator: { language: 'fr' }, localStorage: { getItem: () => null, setItem: () => {} },
  document: { createElement: () => ({ getContext: () => null }) }, window: {}, RESULTAT },
  { filename: 'notes' });

const res = RESULTAT.v;
for (const id of Object.keys(res)) {
  console.log('\n' + id + ' : ' + res[id].n + ' panneaux pour ' + res[id].zones + ' freinages');
  for (const l of res[id].lignes) console.log(l);
}

if (!process.argv.includes('--ecrire')) {
  console.log('\n(essai seulement — « --ecrire » remplace les blocs dans js/tracks.js)');
  process.exit(0);
}

/* L'ÉCRITURE RESTE DANS LE CIRCUIT VISÉ, et c'est tout l'enjeu.

Première version : chercher `panneaux: [` après `id: 'monza'`. Sept circuits sur douze n'en avaient
pas — et `indexOf` ne rend pas « rien », il rend le bloc du circuit SUIVANT, qui s'est donc fait
écraser. Le compteur disait « 1 bloc réécrit » à chaque fois, parce qu'il avait bien réécrit un
bloc : le mauvais. Un `indexOf` sans borne trouve toujours quelque chose, et c'est exactement ce qui
le rend dangereux.

On borne donc la recherche à l'entrée du circuit — d'un `id:` au suivant — et, quand il n'y a pas de
bloc, on en INSÈRE un plutôt que d'aller en chercher un ailleurs.

Les crochets se comptent au lieu de se chercher : une expression régulière sur `panneaux: [ ... ]`
s'arrête au premier `]`, qui est celui de la première entrée. C'est le même piège que le scanneur
d'accolades de l'éditeur, et il se répare pareil. */
const dest = path.join(R, 'js', 'tracks.js');
let txt = fs.readFileSync(dest, 'utf8');
let faits = 0, ajouts = 0;
for (const id of Object.keys(res)) {
  const ancre = txt.indexOf(`id: '${id}'`);
  if (ancre < 0) { console.log('circuit introuvable dans tracks.js : ' + id); continue; }
  const suivant = txt.indexOf("id: '", ancre + 5);
  const borne = suivant < 0 ? txt.length : suivant;
  const bloc = 'panneaux: [\n' + res[id].txt + '\n    ],';
  const deb = txt.indexOf('panneaux: [', ancre);
  if (deb >= 0 && deb < borne) {
    let i = txt.indexOf('[', deb), prof = 0, fin = -1;
    for (; i < txt.length; i++) {
      if (txt[i] === '[') prof++;
      else if (txt[i] === ']') { prof--; if (!prof) { fin = i; break; } }
    }
    if (fin < 0) { console.log('bloc non refermé : ' + id); continue; }
    // la virgule qui suit, s'il y en a une, fait déjà partie du bloc qu'on réécrit
    const apres = txt[fin + 1] === ',' ? fin + 2 : fin + 1;
    txt = txt.slice(0, deb) + bloc + txt.slice(apres);
    faits++;
  } else {
    // pas de bloc : on l'insère juste après `pts:`, qui existe pour tous les circuits intégrés
    const pts = txt.indexOf('pts: ', ancre);
    if (pts < 0 || pts > borne) { console.log('rien où insérer : ' + id); continue; }
    const eol = txt.indexOf('\n', pts) + 1;
    txt = txt.slice(0, eol) + '    ' + bloc + '\n' + txt.slice(eol);
    ajouts++;
  }
}
fs.writeFileSync(dest, txt);
console.log('\n' + faits + ' bloc(s) remplacé(s), ' + ajouts + ' ajouté(s) dans js/tracks.js');
