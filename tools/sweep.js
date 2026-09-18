// Parameter sweep for the autopilot / handling: scores tracking error, spins and excursions.
const fs = require('fs'), vm = require('vm');
let src = '';
for (const f of ['util', 'tracks', 'track', 'cars', 'car', 'race']) src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8').replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
src += `
const combos = [['zandvoort','gt'],['spa','f1classic'],['monza','f1modern'],['laguna','protoclassic']];
function run(m) {
  let rms = 0, offs = 0, spins = 0, laps = 0, n = 0;
  for (const [tid, cid] of combos) {
    const race = new Race({ trackDef: TRACKS.find(t => t.id === tid), classId: cid, difficulty: 'medium', playerAI: true, playerLivery: 0, nCars: 1, mode: 'timetrial' });
    const T = race.track, p = race.player; let e2 = 0, k = 0, spun = false;
    while (race.state !== 'finished' && race.time < 300 && p.lap < 2) {
      race.update(race.dt, aiThrottle(p, race.cars, race.dt, { marginBase: m, marginSpread: 0 }));
      if (race.state !== 'racing') continue;
      const e = p.lat - T.targetLat(p.s, p.sel); e2 += e * e; k++;
      if (Math.abs(p.beta) > 1.0) spun = true;
    }
    rms += Math.sqrt(e2 / Math.max(1, k)); offs += p.crashes; if (spun) spins++; if (p.lap >= 2) laps++; n++;
  }
  return { rms: rms / n, offs, spins, laps };
}
const PHYS0 = Object.assign({}, PHYS);
const variants = JSON.parse(ARGS[0]);
for (const v of variants) {
  Object.assign(PHYS, PHYS0, v);
  const a = run(0.9), b = run(1.0), c = run(1.15);
  const score = a.rms + b.rms + a.offs * 2 + a.spins * 3 + b.spins * 2 + (8 - a.laps - b.laps) * 3;
  console.log(JSON.stringify(v).padEnd(52), 'm0.9 rms=' + a.rms.toFixed(2) + ' offs=' + a.offs + ' spins=' + a.spins + ' laps=' + a.laps + '/4', '| m1.0 rms=' + b.rms.toFixed(2) + ' offs=' + b.offs + ' spins=' + b.spins, '| m1.15 offs=' + c.offs + ' spins=' + c.spins, '| score=' + score.toFixed(1));
}
`;
vm.runInNewContext(src, { Math, console, ARGS: process.argv.slice(2), Date }, { filename: 'sweep' });
