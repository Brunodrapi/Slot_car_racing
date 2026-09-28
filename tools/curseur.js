// Le curseur de ligne envoie-t-il la voiture du bon côté ?
//
//   node tools/curseur.js [circuit|all]
//
// La question n'est pas de relire le code — il a déjà eu l'air juste alors qu'il ne l'était pas —
// mais de conduire. On pose le curseur à fond d'un côté, on fait rouler une voiture seule sur le
// tour entier, et on relève sa position réelle par rapport à la ligne de course, virage par virage.
//
// Le côté intérieur d'un virage se trouve sans rien supposer des conventions : la dérivée seconde
// de l'axe pointe vers le centre de courbure, donc vers l'intérieur. Si le curseur « intérieur »
// place la voiture de l'autre côté, c'est mesuré, pas ressenti.
//
// La chaîne éprouvée va donc du curseur jusqu'aux roues : `input.sel` → `race.update` → `car.sel` →
// `track.targetLat` → le pilote automatique → la position de la voiture. Un essai qui s'arrêterait
// aux données des lignes laisserait passer une inversion dans n'importe lequel de ces maillons.
const fs = require('fs'), vm = require('vm');

const ARGS = process.argv.slice(2);
let src = '';
for (const f of ['util', 'tracks', 'track', 'cars', 'car', 'race']) {
  src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8')
    .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
}
src += `
const seul = ARGS[0] && ARGS[0] !== 'all' ? ARGS[0] : null;
const W = 15;
const out = [];
for (const def of TRACKS) {
  if (seul && def.id !== seul) continue;
  const T0 = new Track(def);
  const N = T0.n;
  // où est l'intérieur, en chaque point
  const vers = new Int8Array(N);
  const enVirage = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const a = (i - W + N) % N, b = (i + W) % N;
    const cx = T0.xs[b] - 2 * T0.xs[i] + T0.xs[a];
    const cy = T0.ys[b] - 2 * T0.ys[i] + T0.ys[a];
    vers[i] = Math.sign(cx * T0.nx[i] + cy * T0.ny[i]);
    enVirage[i] = Math.hypot(cx, cy) / (T0.ds * T0.ds * W * W) > 0.004 ? 1 : 0;
  }
  const roule = (sel) => {
    /* La voiture est pilotée par le joueur, et c'est tout le point de l'essai.

    Avec le pilote automatique, elle choisit sa ligne elle-même : sans personne à dépasser elle
    remet sa sélection à zéro à chaque pas, et le curseur du joueur n'arrive jamais aux roues. Un
    premier essai monté ainsi donnait le même écart moyen au centimètre près pour les deux positions
    du curseur — il ne mesurait rien du tout, et il aurait pourtant annoncé un défaut. */
    const race = new Race({ trackDef: def, classId: 'gt', difficulty: 'medium',
                            playerAI: false, playerLivery: 0, nCars: 1, mode: 'timetrial' });
    const p = race.player, T = race.track;
    let bons = 0, total = 0, ecartMoy = 0, n = 0;
    let bonsC = 0, totalC = 0, retard = 0, nRetard = 0;
    const ampl = [];
    const lat = new Array(N).fill(null);        // où la voiture passe, échantillon par échantillon
    while (race.time < 300 && race.state !== 'finished' && p.lap < 2) {
      race.update(race.dt, { throttle: aiThrottle(p, race.cars, race.dt, { marginBase: 0.9, marginSpread: 0 }), sel });
      if (race.state !== 'racing' || p.lap < 1) continue;       // le tour de chauffe ne compte pas
      const i = T.idx(p.s);
      const r = T._lerp(T.lines.racing, p.s);
      const o = p.lat - r;
      ecartMoy += o; n++;
      // La ligne visée au même instant : on sépare ainsi « la ligne est du mauvais côté » de
      // « la voiture ne suit pas la ligne », qui demandent deux corrections différentes.
      lat[i] = p.lat;
      const cible = T.targetLat(p.s, sel) - r;
      if (enVirage[i]) ampl.push(Math.abs(cible));
      if (Math.abs(cible) > 0.3) { totalC++; if (Math.sign(cible) === (sel < 0 ? vers[i] : -vers[i])) bonsC++; }
      retard += Math.abs(p.lat - T.targetLat(p.s, p.selS)); nRetard++;
      if (!enVirage[i]) continue;
      if (Math.abs(o) < 0.3) continue;
      total++;
      // sel < 0 veut dire « intérieur » : la voiture doit être du côté du centre de courbure
      if (Math.sign(o) === (sel < 0 ? vers[i] : -vers[i])) bons++;
    }
    return { pc: total ? 100 * bons / total : 0, total, ecart: n ? ecartMoy / n : 0,
             pcCible: totalC ? 100 * bonsC / totalC : 0, retard: nRetard ? retard / nRetard : 0,
             ampl: ampl.length ? ampl.sort((x, y) => x - y)[ampl.length >> 1] : 0, lat };
  };
  const dedans = roule(-1), dehors = roule(1);
  /* La question du joueur, enfin posée telle qu'il la pose.

  Demander « la voiture est-elle du côté intérieur du virage » n'a pas de réponse au point de corde :
  la ligne de course y touche déjà le bord intérieur, la ligne défensive aussi, et les deux se
  confondent légitimement. Le signe de leur écart n'y veut rien dire, et c'est ce qui faisait
  plafonner la mesure précédente à 46 % — elle comptait du bruit.

  Ce que le joueur demande est relatif : en poussant le curseur vers l'intérieur plutôt que vers
  l'extérieur, est-ce que je me retrouve du côté intérieur ? On compare donc les deux courses l'une
  à l'autre, là où elles diffèrent d'au moins un mètre et demi — en deçà, ce n'est plus un choix de
  ligne mais la même ligne. */
  let paires = 0, justes = 0;
  for (let i = 0; i < N; i++) {
    if (!enVirage[i]) continue;
    const li = dedans.lat[i], le = dehors.lat[i];
    if (li == null || le == null || Math.abs(li - le) < 1.5) continue;
    paires++;
    if (Math.sign(li - le) === vers[i]) justes++;
  }
  out.push({ id: def.id, nom: def.name, dedans, dehors,
             relatif: paires ? 100 * justes / paires : 0, paires });
}
OUT.res = out;
`;

const sandbox = { ARGS, OUT: {}, console, performance: { now: () => Date.now() } };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const res = sandbox.OUT.res;

console.log('\n  Curseur à fond, voiture seule, un tour lancé. « juste » = la voiture est du côté annoncé.\n');
console.log('  circuit          INT vs   ——— curseur intérieur ———   ——— curseur extérieur ———');
console.log('                     EXT    ligne  voiture  retard  ampl.   ligne  voiture  retard  ampl.');
let faute = 0;
for (const r of res) {
  const mauvais = r.relatif < 80;
  if (mauvais) faute++;
  console.log('  ' + r.nom.padEnd(18) + (r.relatif.toFixed(0) + '%').padStart(6)
    + (r.dedans.pcCible.toFixed(0) + '%').padStart(6) + (r.dedans.pc.toFixed(0) + '%').padStart(8)
    + (r.dedans.retard.toFixed(2) + 'm').padStart(8) + (r.dedans.ampl.toFixed(1) + 'm').padStart(7)
    + (r.dehors.pcCible.toFixed(0) + '%').padStart(11) + (r.dehors.pc.toFixed(0) + '%').padStart(8)
    + (r.dehors.retard.toFixed(2) + 'm').padStart(8) + (r.dehors.ampl.toFixed(1) + 'm').padStart(7)
    + (mauvais ? '   ← ' : ''));
}
const moy = (f) => res.reduce((a, r) => a + f(r), 0) / res.length;
console.log(`\n  la LIGNE visée est du bon côté : intérieur ${moy((r) => r.dedans.pcCible).toFixed(0)} %,`
  + ` extérieur ${moy((r) => r.dehors.pcCible).toFixed(0)} %`);
console.log(`  la VOITURE y est vraiment       : intérieur ${moy((r) => r.dedans.pc).toFixed(0)} %,`
  + ` extérieur ${moy((r) => r.dehors.pc).toFixed(0)} %`);
console.log(`  amplitude médiane du décalage en virage : intérieur ${moy((r) => r.dedans.ampl).toFixed(2)} m,`
  + ` extérieur ${moy((r) => r.dehors.ampl).toFixed(2)} m`);
console.log(`  écart moyen entre la voiture et la ligne qu'elle vise :`
  + ` ${moy((r) => (r.dedans.retard + r.dehors.retard) / 2).toFixed(2)} m`);
console.log(`\n  POUSSER LE CURSEUR VERS L'INTÉRIEUR PLACE BIEN LA VOITURE À L'INTÉRIEUR :`
  + ` ${moy((r) => r.relatif).toFixed(0)} % des virages`);
if (faute) { console.log(`  ÉCHEC : ${faute} circuit(s) sous 80 %`); process.exitCode = 1; }
else console.log('  ok : le curseur envoie la voiture du bon côté, sur les douze circuits');
