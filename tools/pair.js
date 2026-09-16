const fs = require('fs'), vm = require('vm');
let src = '';
for (const f of ['tracks', 'track', 'cars', 'car', 'race']) src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8').replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
src += `
const td = TRACKS.find(t => t.id === 'monza');
const race = new Race({ trackDef: td, classId: 'proto', difficulty: 'medium', playerLivery: 0, nCars: 2, laps: 4 });
const p = race.player, o = race.cars[0];
let last = -1;
while (race.state !== 'finished' && race.time < 80) {
  const thr = aiThrottle(p, race.cars, race.dt, { marginBase: 0.97, marginSpread: 0 });
  race.update(race.dt, thr);
  if (race.time > 20 && race.time - last >= 0.5) { last = race.time; console.log(race.time.toFixed(1), 'd=' + race.track.diff(p.s, o.s).toFixed(1), 'pv=' + p.v.toFixed(1), 'ov=' + o.v.toFixed(1), 'plat=' + p.lat.toFixed(1), 'olat=' + o.lat.toFixed(1), 'ptarget=' + p.laneTarget.toFixed(1), 'blk=' + (p.blocker ? 1 : 0), 'side=' + p.passSide, 'thr=' + (thr ? 1 : 0), 'allow=' + p.aiAllow.toFixed(1), 'k=' + (1/Math.max(1e-6, Math.abs(race.track.curvAt(p.s)))).toFixed(0)); }
}
`;
vm.runInNewContext(src, { Math, console, ARGS: process.argv.slice(2), Date }, { filename: 'pair' });
