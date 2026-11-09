// Des courses à dix voitures, l'IA à un niveau donné : sorties et tête-à-queue par voiture et par
// course, temps moyen du vainqueur. Pour vérifier qu'un changement de physique garde l'échelle des
// niveaux (et donc des trophées) : comparer deux états du dépôt, niveau par niveau.
//
//   node tools/niveaux-banc.js <racine du dépôt> <easy|medium|hard|extreme|cauchemar> [circuits]
//
// Quatre circuits, trois catégories, deux graines : 24 courses de trois tours.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..')), NIVEAU = process.argv[3] || 'medium';
const CIRCUITS = (process.argv[4] || 'zandvoort,spa,monza,monaco').split(',');
let src = '';
for (const f of ['util', 'traces', 'tracks', 'track', 'cars', 'car', 'race'])
  src += fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8').replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
src += `
let tot = { sorties: 0, tq: 0, voitures: 0, courses: 0, vainqueur: 0, finis: 0 };
for (const graine of [2, 3]) for (const id of CIRCUITS) for (const cat of ['gt', 'proto', 'f1']) {
  GRAINE(graine);
  const race = new Race({ trackDef: TRACKS.find((t) => t.id === id), classId: cat, difficulty: NIVEAU, playerAI: true, playerLivery: 0, nCars: 10, mode: 'race', laps: 3 });
  const travers = new Map();
  while (race.state !== 'finished' && race.time < 700) {
    race.update(race.dt, aiThrottle(race.player, race.cars, race.dt, { marginBase: 0.9, marginSpread: 0, maxMargin: 2 }));
    if (race.state !== 'racing') continue;
    for (const c of race.cars) { if (c === race.player) continue;
      if (Math.abs(c.beta) > 1) { if (!travers.get(c)) tot.tq++; travers.set(c, true); } else if (Math.abs(c.beta) < 0.3) travers.set(c, false); }
  }
  for (const c of race.cars) if (c !== race.player) { tot.sorties += c.crashes; tot.voitures++; }
  const t = race.cars.filter((c) => c !== race.player && c.finishTime != null).map((c) => c.finishTime);
  if (t.length) { tot.vainqueur += Math.min(...t); tot.finis++; }
  tot.courses++;
}
console.log(JSON.stringify({ niveau: NIVEAU, sortiesParCourse: +(tot.sorties / tot.voitures * 1).toFixed(2), tqParCourse: +(tot.tq / tot.voitures).toFixed(2), vainqueurMoyen: +(tot.vainqueur / tot.finis).toFixed(1), courses: tot.courses }));
`;
const M = Object.create(Math);
let etat = 1;
M.random = () => { etat ^= etat << 13; etat >>>= 0; etat ^= etat >>> 17; etat ^= etat << 5; etat >>>= 0; return etat / 4294967296; };
const GRAINE = (g) => { etat = (g * 2654435761) >>> 0 || 1; };
vm.runInNewContext(src, { Math: M, GRAINE, console, Date, NIVEAU, CIRCUITS }, { filename: 'niveaux' });
