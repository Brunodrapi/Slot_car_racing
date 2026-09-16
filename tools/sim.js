// Headless simulation harness: concatenates the game scripts and runs AI-only races.
const fs = require('fs'), vm = require('vm');
let src = '';
for (const f of ['tracks', 'track', 'cars', 'car', 'race']) {
  src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8').replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
}
src += `
const argClass = ARGS[0] || 'all', argTrack = ARGS[1] || 'all', diff = ARGS[2] || 'hard', pm = +(ARGS[3] || 0.97);
let totalCrash = 0;
for (const td of TRACKS) {
  if (argTrack !== 'all' && td.id !== argTrack) continue;
  for (const cls of CAR_CLASSES) {
    if (argClass !== 'all' && cls.id !== argClass) continue;
    const race = new Race({ trackDef: td, classId: cls.id, difficulty: diff, playerLivery: 0, nCars: 8 });
    const t0 = Date.now();
    let thrOn = 0, thrN = 0;
    while (race.state !== 'finished' && race.time < 600) {
      const p = race.player;
      const thr = aiThrottle(p, race.cars, race.dt, { marginBase: pm, marginSpread: 0 });
      race.update(race.dt, thr);
      if (race.state === 'racing') { thrN++; if (thr) thrOn++; }
    }
    const crashes = race.cars.reduce((a, c) => a + c.crashes, 0);
    totalCrash += crashes;
    const best = Math.min(...race.cars.map(c => c.bestLap || 1e9));
    const p = race.player;
    console.log(td.id.padEnd(12) + ' ' + cls.id.padEnd(8) + ' state=' + race.state + ' t=' + race.time.toFixed(0).padStart(4) + 's bestLap=' + best.toFixed(1) + 's playerPos=' + race.positionOf(p) + ' playerBest=' + (p.bestLap||0).toFixed(1) + ' thr%=' + (100*thrOn/thrN).toFixed(0) + ' playerCrash=' + p.crashes + ' crashes=' + crashes + ' vmaxSeen=' + Math.max(...race.cars.map(c=>c.v)).toFixed(0) + ' ' + (Date.now()-t0) + 'ms');
    if (race.cars.some(c => Number.isNaN(c.s) || Number.isNaN(c.lat) || Number.isNaN(c.v))) console.log('  !!! NaN detected');
  }
}
console.log('total crashes', totalCrash);
`;
vm.runInNewContext(src, { Math, console, ARGS: process.argv.slice(2), Date }, { filename: 'sim' });
