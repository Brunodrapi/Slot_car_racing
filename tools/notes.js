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

/* CE QUI MÉRITE UNE ANNONCE : deux raisons, pas une.

Première version : la distance de freinage exigée, au-dessus de vingt mètres. Elle a mangé trois des
treize virages que Bruno avait annoncés à Zandvoort, et chacun des trois dit pourquoi :

  869 m — dix-huit mètres de freinage, juste sous le seuil. Le seuil était trop haut, point.

 1729 m — l'épingle gauche à 159° qui suit le carré droit. Trois mètres de freinage seulement, parce
          qu'on y arrive DÉJÀ LENT : on a tout freiné pour le virage d'avant. La distance de freinage
          mesure ce qu'on perd, pas ce qu'il faut savoir. Un virage pris à 17 m/s est un événement,
          qu'on ait freiné pour lui ou pour son voisin.

 2021 m — le dernier virage. Onze mètres de freinage, et on sort si on ne lève pas.

Un virage s'annonce donc s'il exige un VRAI RALENTISSEMENT (dix mètres de freinage, soit un lever de
pied franc) OU s'il SE PREND LENTEMENT dans l'absolu (sous 30 % de la vitesse maximale), ce qui
rattrape ceux qu'on aborde déjà freinés. Les deux ensemble retrouvent les treize de Bruno.

ON GROUPE PAR VIRAGE, PAS PAR DISTANCE. Un complexe produit plusieurs creux dans le même virage : un
seul événement. Mais deux virages opposés à vingt mètres l'un de l'autre sont deux événements, et une
fusion sur la distance les écrasait — c'est exactement le carré-droite-puis-épingle-gauche de
Zandvoort, que Bruno avait annoncé deux fois à juste titre. */
const FREIN_MIN = 10;             // mètres de freinage : un lever de pied franc
const LENT_MAX = 0.30;            // « lent » : sous 30 % de la vitesse maximale
const GROS_ANGLE = 120;           // « gros » : au-delà de 120° de changement de cap

/* LA CLAUSE DE RATTRAPAGE EXIGE LES DEUX : lent ET gros.

Première version : lent suffisait. Monaco est passé de dix à VINGT-TROIS annonces — c'est-à-dire
exactement le plat de spaghetti qu'on venait d'enlever — parce que Monaco est lent partout, et que
chaque kink d'un complexe déclenchait la clause. Elle n'existe que pour un cas, et il faut le dire
précisément : un virage MAJEUR qu'on aborde DÉJÀ FREINÉ, donc sans freinage propre à mesurer.
L'épingle gauche à 159° de Zandvoort, qui suit le carré droit. Un kink de trente degrés au milieu
d'un complexe n'est pas ce cas-là, même s'il se prend à vingt à l'heure. */

/* LE VIRAGE D'UN CREUX DE VITESSE.

D'abord celui qui le CONTIENT : un creux dans un virage appartient à ce virage, et rien d'autre n'a
voix au chapitre. La version qui prenait « le plus fermé à quatre-vingts mètres devant » laissait une
épingle happer le creux du virage d'avant — à Zandvoort, le virage de 348 m s'est fait manger par
l'épingle de 416, et il a disparu des annonces.

Ce n'est que si le creux tombe ENTRE deux virages — le profil encore en descente vers le vrai virage,
ce qui arrive dans un kink de Monaco — qu'on cherche le plus fermé à portée. */
function virageDe(T, zones, i) {
  const N = T.n;
  for (const q of zones) {
    const a = (((q.from % N) + N) % N), b = (((q.to % N) + N) % N);
    if (a <= b ? (i >= a && i <= b) : (i >= a || i <= b)) return q;
  }
  let z = null, pire = 0;
  for (const q of zones) {
    const a = (((q.from % N) + N) % N);
    let d = (((a - i) % N) + N) % N;
    if (d > N / 2) d -= N;
    const dist = d * T.ds;
    if (dist > 80 || dist < -20) continue;
    if (q.peak > pire) { pire = q.peak; z = q; }
  }
  if (z) return z;
  let best = Infinity;
  for (const q of zones) {
    const a = (((q.from % N) + N) % N);
    let d = (((a - i) % N) + N) % N;
    if (d > N / 2) d -= N;
    if (Math.abs(d) < Math.abs(best)) { best = d; z = q; }
  }
  return z;
}

function freinages(T, zones) {
  const N = T.n, v = speedProfile(T, cls, 'racing', 0.98);
  const parVirage = new Map();
  for (let i = 0; i < N; i++) {
    const a = v[(i - 1 + N) % N], b = v[(i + 1) % N];
    if (!(v[i] <= a && v[i] < b)) continue;
    let haut = v[i];
    for (let k = 1; k < N; k++) { const j = (i - k + N) % N; if (v[j] < haut) break; haut = v[j]; }
    const d = (haut * haut - v[i] * v[i]) / (2 * BRAKE);
    const z = virageDe(T, zones, i);
    if (!z) continue;
    if (d < FREIN_MIN) {
      if (v[i] / cls.vmax >= LENT_MAX) continue;
      let t = 0;
      for (let k = z.from; k < z.firstTo; k++) {
        const a = ((k % N) + N) % N, b = (((k + 1) % N) + N) % N;
        let e = T.th[b] - T.th[a];
        while (e > Math.PI) e -= 2 * Math.PI;
        while (e < -Math.PI) e += 2 * Math.PI;
        t += e;
      }
      if (Math.abs(t) * 180 / Math.PI < GROS_ANGLE) continue;
    }
    const cle = (((z.from % N) + N) % N);
    const vieux = parVirage.get(cle);
    if (!vieux || d > vieux.d) parVirage.set(cle, { i, v: v[i], haut, d, z });
  }
  return [...parVirage.values()].sort((a, b) => a.i - b.i);
}

const seul = ARGS.find((a) => !a.startsWith('--'));
for (const td of TRACKS) {
  if (seul && td.id !== seul) continue;
  const T = new Track(td);
  const N = T.n, zones = T.zonesVirages(30, true);
  const freins = freinages(T, zones);
  const prof = speedProfile(T, cls, 'racing', 0.98);
  const out = [], lignes = [];
  for (let fi = 0; fi < freins.length; fi++) {
    const f = freins[fi];
    const z = f.z;
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
