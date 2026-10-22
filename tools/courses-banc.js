// Des courses à dix voitures, l'IA partout : combien de sorties, de tête-à-queue, de dépassements ?
//
//   node tools/courses-banc.js                    # le code du dépôt
//   node tools/courses-banc.js --racine=<dossier>  # un autre état du dépôt, pour comparer
//
// Six circuits, trois catégories, deux graines : 36 courses de trois tours, niveau moyen. Le hasard
// des pilotes est tiré d'une graine fixe, pour que deux états du code courent les mêmes courses.
// Un dépassement, c'est une place gagnée au classement (relevé toutes les demi-secondes, départ
// exclu) : le compte inclut les places reprises, il mesure l'animation du peloton plus que le
// nombre de manœuvres réussies. Écrit pour les changements de ligne (voir `_versLigne` dans
// js/car.js) : une IA qui sort moins ne doit pas, pour autant, cesser de doubler.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const arg = process.argv.find((a) => a.startsWith('--racine='));
const ROOT = arg ? path.resolve(arg.slice(9)) : path.join(__dirname, '..');
let src = '';
for (const f of ['util', 'traces', 'tracks', 'track', 'cars', 'car', 'race'])
  src += fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8').replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
src += `
let tot = { sorties: 0, tq: 0, dep: 0, courses: 0, temps: 0 };
for (const graine of [2, 3]) for (const id of ['zandvoort', 'spa', 'monza', 'laguna', 'monaco', 'suzuka']) for (const cat of ['gt', 'proto', 'f1']) {
  GRAINE(graine);
  const race = new Race({ trackDef: TRACKS.find((t) => t.id === id), classId: cat, difficulty: 'medium', playerAI: true, playerLivery: 0, nCars: 10, mode: 'race', laps: 3 });
  const travers = new Map(); let rang = null, tNext = 0;
  while (race.state !== 'finished' && race.time < 600) {
    race.update(race.dt, aiThrottle(race.player, race.cars, race.dt, { marginBase: 0.95, marginSpread: 0, maxMargin: 2 }));
    if (race.state !== 'racing') continue;
    for (const c of race.cars) {
      if (Math.abs(c.beta) > 1) { if (!travers.get(c)) tot.tq++; travers.set(c, true); } else if (Math.abs(c.beta) < 0.3) travers.set(c, false);
    }
    if (race.time > tNext) {
      tNext = race.time + 0.5;
      const ordre = race.cars.slice().sort((a, b) => b.progress - a.progress);
      const r = new Map(ordre.map((c, i) => [c, i]));
      if (rang && race.time > 8) for (const c of race.cars) if (r.get(c) < rang.get(c)) tot.dep += rang.get(c) - r.get(c);
      rang = r;
    }
  }
  for (const c of race.cars) tot.sorties += c.crashes;
  tot.courses++; tot.temps += race.time;
}
console.log('courses ' + tot.courses + '  sorties ' + tot.sorties + '  tête-à-queue ' + tot.tq + '  dépassements ' + tot.dep + '  durée totale ' + tot.temps.toFixed(0) + ' s');
`;
const M = Object.create(Math);
let etat = 1;
M.random = () => { etat ^= etat << 13; etat >>>= 0; etat ^= etat >>> 17; etat ^= etat << 5; etat >>>= 0; return etat / 4294967296; };
const GRAINE = (g) => { etat = (g * 2654435761) >>> 0 || 1; };
vm.runInNewContext(src, { Math: M, GRAINE, console, Date }, { filename: 'courses' });
