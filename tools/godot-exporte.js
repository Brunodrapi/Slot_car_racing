// Le circuit et la voiture du prototype Godot, sortis du jeu web tels qu'il les calcule.
//
//   node tools/godot-exporte.js
//
// Écrit godot/donnees/spa.json (l'index et les champs non numériques) et godot/donnees/spa.bin
// (tous les nombres, en flottants 64 bits petit-boutistes). Les nombres ne passent PAS par le JSON :
// l'analyseur de Godot n'arrondit pas toujours la dix-septième décimale comme JavaScript, et la
// moindre différence suffit à faire diverger deux simulations d'une glissade.
//
// Écrit aussi trois trajectoires de référence (godot/donnees/ref-*.bin) : la voiture du joueur
// roule seule, commandée par un programme fixe d'accélérateur et de levier de ligne, et chaque pas
// de 1/120 s est noté. godot/tests/parite.gd rejoue les mêmes commandes et compare.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'godot', 'donnees');

let src = '';
for (const f of ['util', 'traces', 'tracks', 'track', 'cars', 'car', 'race'])
  src += fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8').replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';

const M = Object.create(Math);
let etat = 1;
M.random = () => { etat ^= etat << 13; etat >>>= 0; etat ^= etat >>> 17; etat ^= etat << 5; etat >>>= 0; return etat / 4294967296; };
const GRAINE = (g) => { etat = (g * 2654435761) >>> 0 || 1; };

const ctx = { Math: M, GRAINE, console, Date, setTimeout: () => 0, resultat: null };
src += `
function nouvelleCourse() {
  const race = new Race({ trackDef: TRACKS.find((t) => t.id === 'spa'), modelId: 'porsche991gt3r',
    difficulty: 'medium', playerLivery: 0, mode: 'timetrial' });
  race.state = 'racing';
  for (const c of race.cars) c.gridLat = null;
  return race;
}
// Tout l'état qui passe d'un pas au suivant : de quoi rejouer chaque pas isolément.
const ETAPES_CHAMPS = ['x','y','th','v','vl','w','delta','s','lat','selS','selV','Ff','Fr','glisseArr','patine','patineFx',
  'beta','engineCut','usage','alphaF','alphaR','offT','grassT','slide','ressenti','lapStart'];
const ETAPES_DRAPEAUX = ['herbe','lap','crashes','barrierHits','engineStopped','checkpoint','started','rejoined'];
function rouler(nom, duree, commande) {
  const race = nouvelleCourse(), p = race.player, n = Math.round(duree / race.dt);
  const L = ETAPES_CHAMPS.length + ETAPES_DRAPEAUX.length;
  const entrees = new Float64Array(n * 2), etats = new Float64Array(n * L);
  for (let i = 0; i < n; i++) {
    const c = commande(race, p, i * race.dt);
    p.sel = c.sel;
    race._step(race.dt, c.thr ? 1 : 0, null);
    entrees[i * 2] = c.thr ? 1 : 0; entrees[i * 2 + 1] = c.sel;
    ETAPES_CHAMPS.forEach((k, j) => { etats[i * L + j] = p[k]; });
    ETAPES_DRAPEAUX.forEach((k, j) => { etats[i * L + ETAPES_CHAMPS.length + j] = k === 'herbe' ? (p.state === 'grass' ? 1 : 0) : Number(p[k]); });
  }
  return { nom, n, entrees, etats, largeur: L, crashes: p.crashes, chocs: p.barrierHits, tours: p.lap, temps: p.lapTimes.slice() };
}
const depart = nouvelleCourse();
// 1. Un pilote propre : l'accélérateur du pilote automatique, et le levier de ligne qui change
//    toutes les sept secondes. Deux tours et demi.
GRAINE(7);
const LEVIER = [0, 1, -1, 0.5, 0, -0.5, 1, 0, -1, 0];
const propre = rouler('propre', 190, (race, p, t) => ({
  thr: aiThrottle(p, race.cars, race.dt, { marginBase: 1.0, marginSpread: 0, maxMargin: 2 }),
  sel: LEVIER[Math.floor(t / 7) % LEVIER.length] }));
// 2. Le pied au plancher : sorties, rails, moteur calé, retour en piste.
const brutal = rouler('brutal', 90, (race, p, t) => ({ thr: true, sel: Math.sin(t * 0.4) }));
// 3. Au hasard : des coups d'accélérateur et de levier, tirés d'une graine.
GRAINE(11);
let thr = false, sel = 0;
const hasard = rouler('hasard', 90, (race, p, t) => {
  if (Math.random() < 0.02) thr = !thr;
  if (Math.random() < 0.004) sel = Math.round((Math.random() * 2 - 1) * 4) / 4;
  return { thr: thr || Math.random() < 0.3, sel };
});
resultat = { race: depart, refs: [propre, brutal, hasard], ETAPES_CHAMPS: [...ETAPES_CHAMPS, ...ETAPES_DRAPEAUX] };
`;
vm.runInNewContext(src, ctx, { filename: 'godot-exporte' });
const { race, refs, ETAPES_CHAMPS: CHAMPS } = ctx.resultat;
const T = race.track, p = race.player;

// ---------- le blob de nombres ----------
const morceaux = [], index = {};
let pos = 0;
const pose = (nom, valeurs) => {
  const a = Float64Array.from(valeurs);
  index[nom] = [pos, a.length];
  morceaux.push(Buffer.from(a.buffer));
  pos += a.length;
};
for (const k of ['xs', 'ys', 'th', 'nx', 'ny', 'k', 'hwL', 'hwR', 'kerb']) pose(k, T[k]);
for (const k of ['racing', 'jaune', 'bleu']) { pose('ligne_' + k, T.lines[k]); pose('lineK_' + k, T.lineK[k]); }
for (const side of ['L', 'R']) { pose('asphaltW_' + side, T.asphaltW[side]); pose('bacW_' + side, T.bacW[side]); }
const BF = ['ax', 'ay', 'bx', 'by', 'tx', 'ty', 'nx', 'ny', 'len', 'half', 's', 'side', 'level'];
pose('barrieres', T.barriers.flatMap((b) => [...BF.map((f) => b[f] || 0), b.kind === 'tyres' ? 1 : 0]));
pose('croisements', T.crossings.map((c) => c.over));
const NUM = ['vmax', 'accel', 'brake', 'grip', 'df', 'slide', 'laneK', 'rearBias', 'cliff', 'slipPeak', 'length', 'width', 'zoom'];
pose('voiture', NUM.map((k) => p.cls[k]));
pose('depart', [p.s, p.lat, p.x, p.y, p.th]);
pose('scalaires', [T.n, T.ds, T.length, T.halfWidth, T.barrierCell, race.dt, p.freinRatio, p.gripBoost]);
fs.writeFileSync(path.join(OUT, 'spa.bin'), Buffer.concat(morceaux));
fs.writeFileSync(path.join(OUT, 'spa.json'), JSON.stringify({
  circuit: { id: T.id, nom: T.name, theme: T.theme },
  voiture: { id: p.cls.id, nom: p.cls.name, champs: NUM, sprite: 'res://images/porsche991gt3r.png' },
  barriere: { champs: [...BF, 'pneus'] },
  index,
}, null, 1) + '\n');

for (const r of refs) {
  const tete = Buffer.from(Float64Array.from([r.n, r.largeur]).buffer);
  fs.writeFileSync(path.join(OUT, 'ref-' + r.nom + '.bin'), Buffer.concat([tete, Buffer.from(r.entrees.buffer), Buffer.from(r.etats.buffer)]));
  console.log(r.nom.padEnd(7), r.n, 'pas  tours', r.tours, ' sorties', r.crashes, ' chocs', r.chocs, ' temps', r.temps.map((t) => t.toFixed(2)).join(' '));
}
fs.writeFileSync(path.join(OUT, 'ref-champs.json'), JSON.stringify(CHAMPS) + '\n');
console.log('circuit', T.n, 'points,', T.barriers.length, 'barrières ; blob', (pos * 8 / 1024).toFixed(0), 'Ko');
