// LES NOTES D'UN CIRCUIT, écrites comme Bruno a écrit Zandvoort à la main.
//
//   node tools/notes.js            → ce que ça donnerait, sans rien écrire
//   node tools/notes.js --ecrire   → remplace les blocs `panneaux:` de js/tracks.js
//   node tools/notes.js spa        → un seul circuit
//
// LA PHILOSOPHIE EST LUE DE ZANDVOORT, pas inventée. Mesuré sur ses dix virages, elle tient en
// quatre règles :
//
//   1. UN TRIPLET PAR VIRAGE : 100 m, 50 m, puis une flèche SANS CHIFFRE posée sur l'entrée. Les
//      deux premières annoncent, la troisième marque. C'est la règle de loin la plus constante —
//      dix virages sur dix la suivent.
//   2. UN 200 m EN PLUS quand la ligne droite qui précède en laisse la place. Un seul à Zandvoort,
//      après la grande ligne droite : annoncer à deux cents mètres au bout d'une épingle n'a pas de
//      sens, le panneau tomberait dans le virage d'avant.
//   3. UN VIRAGE MOU N'A QUE SA FLÈCHE. Le quatrième virage de Zandvoort tourne de sept degrés :
//      il porte une flèche sans chiffre et rien d'autre. On ne freine pas pour ça, donc on
//      n'annonce pas de distance de freinage.
//   4. MÊME NOTE ET MÊME SENS SUR TOUT LE TRIPLET. Trois panneaux qui parlent du même virage n'en
//      disent pas trois choses différentes.
//
// Le sens vient de la géométrie et jamais de la liste d'avant : c'est lui qui était faux quarante et
// une fois sur les cinq listes reprises à la main, et le recalculer est le seul moyen d'en finir.
const fs = require('fs'), vm = require('vm'), path = require('path');

const R = path.join(__dirname, '..');
let src = '';
for (const f of ['util', 'traces', 'tracks', 'track'])
  src += fs.readFileSync(path.join(R, 'js', f + '.js'), 'utf8')
    .replace(/'use strict';/g, '').replace(/if \(typeof module[^\n]*\n/g, '') + '\n';

src += `
const SORTIE = {};
const seul = ARGS.find((a) => !a.startsWith('--'));
for (const td of TRACKS) {
  if (seul && td.id !== seul) continue;
  const T = new Track(td);
  const N = T.n, zones = T.zonesVirages(60);
  const out = [];
  const lignes = [];
  for (let zi = 0; zi < zones.length; zi++) {
    const z = zones[zi];
    const from = (((z.from % N) + N) % N);
    // combien la route tourne dans le premier virage de la zone, et avec quel rayon : les deux
    // ensemble donnent la note, comme pour les panneaux calculés
    let turn = 0;
    for (let i = z.from; i < z.firstTo; i++) {
      const a = ((i % N) + N) % N, b = (((i + 1) % N) + N) % N;
      let e = T.th[b] - T.th[a];
      while (e > Math.PI) e -= 2 * Math.PI;
      while (e < -Math.PI) e += 2 * Math.PI;
      turn += e;
    }
    const rayon = 1 / z.peak, A = Math.abs(turn) * 180 / Math.PI;
    // la même note que le jeu, par la même méthode : deux classements qui doivent s'accorder
    // finissent toujours par ne plus s'accorder
    const note = Track.noteVirage(rayon, A);
    const sign = z.sign || 1;

    /* COMBIEN DE PLACE AVANT CE VIRAGE : la sortie du virage précédent. On n'annonce pas à cent
    mètres si le virage d'avant finit à soixante : le panneau tomberait dedans, et c'est exactement
    la faute que la liste d'avant faisait neuf fois sur dix-neuf. */
    const prec = zones[(zi - 1 + zones.length) % zones.length];
    const finPrec = (((prec.to % N) + N) % N);
    let place = (((from - finPrec) % N) + N) % N;
    if (zones.length === 1) place = N;

    /* UN VIRAGE MOU N'A QUE SA FLÈCHE. Le seuil est lu de Zandvoort : son virage 4 tourne de 7° et
    n'a qu'une flèche, son virage 3 tourne de 11° et porte le triplet complet. Dix degrés tombe
    entre les deux, et c'est aussi là que le calcul d'origine cessait de poser un panneau. */
    const mou = A < 10;
    const met = (recul, d) => {
      const i = (((from - Math.round(recul / T.ds)) % N) + N) % N;
      out.push({ at: i / N, dist: d, note, sign, zi, recul });
    };
    met(0, 0);                                  // la flèche, sur l'entrée
    if (!mou) {
      if (place > 70) met(50, 50);
      if (place > 130) met(100, 100);
      if (place > 260) met(200, 200);
    }
    lignes.push('  virage ' + String(zi + 1).padStart(2) + ' : entrée ' + String(Math.round(from * T.ds)).padStart(5)
      + ' m · ' + A.toFixed(0).padStart(3) + '° · rayon ' + rayon.toFixed(0).padStart(3) + ' m · note '
      + String(note).padStart(7) + ' · ' + (sign > 0 ? 'droite' : 'gauche')
      + ' · place ' + String(Math.round(place * T.ds)).padStart(4) + ' m'
      + (mou ? ' · mou : flèche seule' : ''));
  }
  // l'ordre du fichier suit celui du tour : une liste qu'on relit à la main se lit dans l'ordre
  out.sort((a, b) => a.at - b.at);
  SORTIE[td.id] = {
    txt: out.map((b) => '      [' + (Math.round(b.at * 10000) / 10000) + ', ' + b.dist + ', '
      + (typeof b.note === 'number' ? b.note : "'" + b.note + "'") + ', ' + b.sign + '],').join('\\n'),
    n: out.length, zones: zones.length, lignes,
  };
}
RESULTAT.v = SORTIE;
`;
const RESULTAT = { v: null };
vm.runInNewContext(src, { Math, console, Date, Float32Array, Float64Array, ARGS: process.argv.slice(2),
  navigator: { language: 'fr' }, localStorage: { getItem: () => null, setItem: () => {} },
  document: { createElement: () => ({ getContext: () => null }) }, window: {}, RESULTAT },
  { filename: 'notes' });

const res = RESULTAT.v;
for (const id of Object.keys(res)) {
  console.log('\n' + id + ' : ' + res[id].n + ' panneaux pour ' + res[id].zones + ' virages');
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
