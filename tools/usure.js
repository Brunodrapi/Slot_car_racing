// Combien de tours tient un train de pneus, et à quel point ça dépend de la façon de conduire.
//
//   node tools/usure.js [circuit|all] [catégorie]
//
// Le minutage est repris de Circuit Superstars : un train doit tenir une course courte quand on
// roule proprement, et mourir en deux ou trois tours quand on martyrise la gomme. C'est ce qui rend
// l'arrêt au stand INTÉRESSANT plutôt qu'obligatoire — s'il n'y avait qu'une seule stratégie, autant
// ne pas offrir le choix.
//
// Ce qui se mesure ici, et qu'aucune partie ne dirait aussi vite :
//
// 1. La durée de vie selon le pilotage. On compare les niveaux de difficulté, qui glissent de plus
//    en plus : c'est la variable qui nous intéresse, et elle est déjà là.
// 2. Que l'usure COÛTE quelque chose. Un pneu mort doit faire perdre du temps au tour, sinon la
//    jauge est une décoration et l'arrêt au stand n'a aucune raison d'exister.
// 3. Que les dommages restent rares quand on roule bien. Une voiture cassée par accident au premier
//    virage, sans faute du joueur, est une course gâchée.
const fs = require('fs'), vm = require('vm');
const ARGS = process.argv.slice(2);

let src = '';
for (const f of ['util', 'tracks', 'track', 'cars', 'car', 'race']) {
  src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8')
    .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
}

src += `
const which = ARGS[0] || 'all', catId = ARGS[1] || 'gt';
const L = [];

/* Deux façons de conduire, la MÊME voiture sur le MÊME circuit.

La première version comparait les niveaux de difficulté, et c'était une erreur : un niveau change
aussi la durée du tour. « Facile » usait plus par tour que « difficile » simplement parce que ses
tours durent treize pour cent de plus — la mesure mélangeait le rythme d'usure et le temps passé
en piste, et ne pouvait donc rien dire du pilotage.

Ce qui nous intéresse est le choix qu'un joueur a devant lui : ménager la gomme ou attaquer. On
pilote donc la même voiture à deux marges — 0,78, qui roule bien en dessous de la limite, et 0,98,
qui vit dessus — et on lit ce que chacune laisse de gomme et gagne de temps. */
const STYLES = [['ménagé', 0.78], ['attaqué', 0.98]];
const par = {};
for (const td of TRACKS) {
  if (which !== 'all' && td.id !== which) continue;
  for (const [nom, marge] of STYLES) {
    const race = new Race({
      trackDef: td, classId: catId, difficulty: 'medium', playerAI: true, playerLivery: 0,
      nCars: 3, roster: makeRoster(3, 0, 12345, catId), laps: 10, wear: true, mode: 'race',
    });
    const p = race.player;
    const tours = [];
    let dernier = 0, lap = p.lap, uSum = 0, n = 0;
    while (race.state !== 'finished' && race.time < 2400) {
      const thr = aiThrottle(p, race.cars, race.dt, { marginBase: marge, marginSpread: 0, paceBase: 1, paceSpread: 0 });
      race.update(race.dt, thr);
      if (p.state === 'ok' && p.v > 1) { uSum += p.usage; n++; }
      if (p.lap > lap) { lap = p.lap; tours.push({ t: race.time - dernier, pneu: p.tyre }); dernier = race.time; }
    }
    const e = par[nom] = par[nom] || { tours: [], usage: [], deg: [] };
    if (tours.length >= 5) { e.tours.push(tours); e.usage.push(uSum / Math.max(1, n)); e.deg.push(p.damage); }
  }
}
for (const [nom] of STYLES) {
  const e = par[nom];
  if (!e || !e.tours.length) continue;
  const moy = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  // le tour où la gomme passe sous la moitié, et ce qu'il reste au dixième
  const seuil = (s2) => {
    const q = e.tours.map(ts => { const i = ts.findIndex(x => x.pneu < s2); return i < 0 ? null : i + 1; }).filter(x => x);
    return q.length === e.tours.length ? moy(q).toFixed(1) : '>' + e.tours[0].length;
  };
  const t3 = moy(e.tours.map(ts => moy(ts.slice(1, 4).map(x => x.t))));
  const reste = moy(e.tours.map(ts => ts[Math.min(9, ts.length - 1)].pneu));
  L.push(nom.padEnd(9)
    + ' demande d\\'adhérence ' + moy(e.usage).toFixed(3)
    + ' | tour de référence ' + t3.toFixed(1) + ' s'
    + ' | demi-usure au tour ' + String(seuil(0.5)).padStart(4)
    + ' | gomme au 10e tour ' + (100 * reste).toFixed(0).padStart(3) + ' %'
    + ' | tôle ' + (100 * moy(e.deg)).toFixed(0) + ' %');
}
// ce que l'usure coûte : les trois derniers tours contre les trois premiers, sur le style ménagé
const m2 = par['ménagé'];
if (m2 && m2.tours.length) {
  const moy = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const perte = m2.tours.map(ts => (moy(ts.slice(-3).map(x => x.t)) / moy(ts.slice(1, 4).map(x => x.t)) - 1) * 100);
  L.push('');
  L.push('ce que coûte un train usé : ' + (moy(perte) >= 0 ? '+' : '') + moy(perte).toFixed(1)
    + ' % au tour sur les trois derniers tours (sinon la jauge est une décoration)');
}
OUT = L.join('\\n');
`;

const ctx = { console, Math, JSON, Object, Array, Float32Array, Date, ARGS, OUT: '' };
vm.runInNewContext(src, ctx, { filename: 'usure' });
console.log(ctx.OUT);
