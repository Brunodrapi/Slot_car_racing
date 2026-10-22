// Changer de ligne (bleue, idéale, jaune) : à quel moment, et de combien, cela fait-il sortir la voiture ?
//
//   node tools/changement-ligne-banc.js                    # le code du dépôt
//   node tools/changement-ligne-banc.js --racine=<dossier>  # un autre état du dépôt, pour comparer
//   GRAINES=2,3,4 node tools/changement-ligne-banc.js       # plusieurs tirages (2 par défaut)
//   node tools/changement-ligne-banc.js '--reglage=LIGNE.part = 0.3'   # du code joué avant la mesure
//
// D'abord la géométrie : de combien de mètres les lignes s'écartent l'une de l'autre, circuit par
// circuit — de combien la voiture traverse la piste quand on change de ligne.
//
// Ensuite la conduite. Le pilote automatique tient la ligne demandée, les gaz sont ceux de l'IA à la
// limite de l'adhérence (marge 0,97). Toutes les 120 à 300 m, tirées d'une graine fixe, on change de
// ligne comme le ferait un joueur au levier — d'un cran ou de deux. Trois pilotes :
//
//   IA        les gaz de l'IA, tels quels : ils lèvent dès que l'arrière glisse ou que la courbe
//             visée occupe déjà les pneus ;
//   humain    freine aux bons endroits pour la ligne qu'il suit, mais garde le pied au plancher
//             partout ailleurs, glisse ou pas — le joueur à un bouton ;
//   engagé    le même, qui avait réglé sa vitesse pour la ligne qu'il quitte et la garde 1,5 s.
//
// Chaque changement est classé par l'endroit où il commence — ligne droite, virage vers l'intérieur
// (la trajectoire se resserre), virage vers l'extérieur — et l'on compte, dans les trois secondes
// qui suivent, les sorties de piste, les tête-à-queue (dérive au-delà d'un radian) et la plus forte
// demande d'adhérence (usage : 1 = tout ce que les pneus donnent). Deux témoins : la même conduite
// sans toucher au levier, mesurée aux mêmes moments, et le pilote humain qui reste tout le tour sur la
// bleue, puis sur la jaune — c'est lui qui a montré que les sorties venaient des lignes de côté plus
// que de la manœuvre (voir `_versLigne` dans js/car.js et `_clampLines` dans js/track.js).
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const arg = process.argv.find((a) => a.startsWith('--racine='));
const ROOT = arg ? path.resolve(arg.slice(9)) : path.join(__dirname, '..');

const reglage = process.argv.find((a) => a.startsWith('--reglage='));
let src = '';
for (const f of ['util', 'traces', 'tracks', 'track', 'cars', 'car', 'race'])
  src += fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8').replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
if (reglage) src += reglage.slice(10) + ';\n';
src += `
const CIRCUITS = ['zandvoort', 'spa', 'monza', 'laguna', 'monaco', 'suzuka'];
const CATS_BANC = ['gt', 'proto', 'f1'];
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };

// 1. La géométrie : l'écart entre les lignes.
console.log('Écart entre les lignes (m) — médiane / 90 % / max');
const geo = [];
for (const id of CIRCUITS) {
  const T = new Track(TRACKS.find((t) => t.id === id));
  const dj = [], db = [], dbj = [];
  let accord = 0, virages = 0;
  for (let s = 0; s < T.length; s += 2) {
    const r = T.targetLat(s, 0), j = T.targetLat(s, 1), b = T.targetLat(s, -1);
    dj.push(Math.abs(j - r)); db.push(Math.abs(b - r)); dbj.push(Math.abs(j - b));
    const k = T.lineCurv(s, 0);
    // lat > 0 à gauche, k > 0 en virage à droite : l'intérieur est du côté de -k
    if (Math.abs(k) > 0.01) { virages++; if (Math.sign(b - j) === -Math.sign(k)) accord++; }
  }
  geo.push(...dbj);
  console.log('  ' + id.padEnd(10) + ' idéale↔jaune ' + [q(dj, .5), q(dj, .9), Math.max(...dj)].map((x) => x.toFixed(1)).join(' / ')
    + '   idéale↔bleue ' + [q(db, .5), q(db, .9), Math.max(...db)].map((x) => x.toFixed(1)).join(' / ')
    + '   bleue↔jaune ' + [q(dbj, .5), q(dbj, .9), Math.max(...dbj)].map((x) => x.toFixed(1)).join(' / ')
    + '   (bleue à l\\'intérieur dans ' + Math.round(100 * accord / Math.max(1, virages)) + ' % des virages)');
}

// 2. La conduite.
function rouler(changer, joueur, fixe) {
  const ev = [];   // un changement : { type, cran, usage, beta, sortie, tq }
  const r = { sorties: 0, tq: 0, km: 0, tours: 0, temps: 0 };
  for (const id of CIRCUITS) for (const cat of CATS_BANC) {
    const race = new Race({ trackDef: TRACKS.find((t) => t.id === id), classId: cat, difficulty: 'medium',
      playerAI: false, playerLivery: 0, nCars: 1, mode: 'timetrial' });
    const T = race.track, p = race.player;
    if (fixe != null) { p.sel = fixe; p.selS = fixe; }
    let prochain = 150 + Math.random() * 150, parcouru = 0, ouvert = null, travers = false, t0 = null;
    let planSel = 0, planJusque = -1;
    while (race.state !== 'finished' && race.time < 400 && p.lap < 3) {
      // les gaz : ceux de l'IA, sur la ligne qu'elle croit suivre
      const vrai = p.selS;
      if (joueur === 'engage' && race.time < planJusque) p.selS = planSel;
      let gaz = aiThrottle(p, race.cars, race.dt, { marginBase: 0.97, marginSpread: 0, maxMargin: 2 });
      if (joueur !== 'ia') gaz = p.v < p.aiAllow - 0.3;
      p.selS = vrai;
      const s0 = p.s, crash0 = p.crashes;
      race.update(race.dt, gaz);
      if (race.state !== 'racing') continue;
      if (p.lap >= 1 && t0 == null) t0 = race.time;
      parcouru += Math.max(0, T.diff(s0, p.s));
      if (Math.abs(p.beta) > 1) { if (!travers) { r.tq++; if (ouvert) ouvert.tq = 1; } travers = true; } else if (Math.abs(p.beta) < 0.3) travers = false;
      if (p.crashes > crash0 && ouvert) ouvert.sortie = 1;
      if (ouvert) {
        ouvert.usage = Math.max(ouvert.usage, p.usage); ouvert.beta = Math.max(ouvert.beta, Math.abs(p.beta)); ouvert.glisse = Math.max(ouvert.glisse, p.glisseArr || 0);
        if (race.time > ouvert.fin) { ev.push(ouvert); ouvert = null; }
      }
      // le témoin tire les mêmes moments sans toucher au levier : la même mesure, sans la manœuvre
      if (parcouru > prochain && p.state === 'ok' && !ouvert) {
        prochain = parcouru + 120 + Math.random() * 180;
        const choix = [-1, 0, 1].filter((x) => x !== p.sel);
        const neuf = choix[Math.floor(Math.random() * choix.length)];
        // l'endroit : la courbure de la ligne qu'on suit, et de quel côté on part
        const k = T.lineCurv(p.s + 5, p.selS);
        const dLat = T.targetLat(p.s + 20, neuf) - T.targetLat(p.s + 20, p.sel);
        const type = Math.abs(k) < 0.004 ? 'droite' : Math.sign(dLat) === -Math.sign(k) ? 'interieur' : 'exterieur';
        ouvert = { type, cran: Math.abs(neuf - p.sel), ecart: Math.abs(dLat), v: p.v, usage: p.usage, beta: Math.abs(p.beta), glisse: p.glisseArr || 0, sortie: 0, tq: 0, fin: race.time + 3 };
        planSel = p.sel; planJusque = race.time + 1.5;
        if (changer) p.sel = neuf;
      }
    }
    if (ouvert) ev.push(ouvert);
    r.sorties += p.crashes; r.km += parcouru / 1000;
    if (p.lap >= 3) { r.tours++; r.temps += race.time - t0; }
  }
  return { r, ev };
}
function bilan(nom, res) {
  const { r, ev } = res;
  console.log('  ' + nom.padEnd(30) + 'sorties ' + String(r.sorties).padStart(3) + '  tête-à-queue ' + String(r.tq).padStart(3)
    + '  sur ' + r.km.toFixed(0) + ' km  | courses finies ' + r.tours + '/18  temps ' + r.temps.toFixed(1) + ' s');
  for (const type of ['droite', 'interieur', 'exterieur']) {
    const e = ev.filter((x) => x.type === type);
    if (!e.length) continue;
    const u = e.map((x) => x.usage);
    console.log('      ' + type.padEnd(10) + String(e.length).padStart(4) + ' changements   sorties ' + String(e.filter((x) => x.sortie).length).padStart(3)
      + '  tête-à-queue ' + String(e.filter((x) => x.tq).length).padStart(3)
      + '   usage max : médiane ' + q(u, .5).toFixed(2) + '  90 % ' + q(u, .9).toFixed(2)
      + '   dérive 90 % ' + (q(e.map((x) => x.beta), .9) * 57.3).toFixed(1) + '°   glisse arrière 90 % ' + q(e.map((x) => x.glisse), .9).toFixed(2)
      + (nom.startsWith('témoin') || nom.includes('toujours') ? '' : '   écart médian ' + q(e.map((x) => x.ecart), .5).toFixed(1) + ' m à ' + (q(e.map((x) => x.v), .5) * 3.6).toFixed(0) + ' km/h'));
  }
}
console.log('');
for (const graine of GRAINES) {
  console.log('graine ' + graine);
  for (const [nom, joueur] of [['IA', 'ia'], ['humain', 'humain'], ['humain engagé', 'engage']]) {
    if (joueur !== 'engage') { GRAINE(graine); bilan('témoin ' + nom + ', sans changement', rouler(false, joueur)); }
    GRAINE(graine); bilan(nom, rouler(true, joueur));
  }
  for (const ligne of [-1, 1]) { GRAINE(graine); bilan('humain, toujours sur la ' + (ligne < 0 ? 'bleue' : 'jaune'), rouler(false, 'humain', ligne)); }
}
`;
// Le hasard (le bruit du pilote et les changements de ligne), tiré d'une graine : xorshift32.
const M = Object.create(Math);
let etat = 1;
M.random = () => { etat ^= etat << 13; etat >>>= 0; etat ^= etat >>> 17; etat ^= etat << 5; etat >>>= 0; return etat / 4294967296; };
const GRAINE = (g) => { etat = (g * 2654435761) >>> 0 || 1; };
vm.runInNewContext(src, { Math: M, GRAINE, GRAINES: (process.env.GRAINES || '2').split(',').map(Number), console, Date }, { filename: 'changement-ligne-banc' });
