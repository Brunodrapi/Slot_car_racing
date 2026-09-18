// Measures the continuity of the car's on-screen path through an off-track excursion:
// the per-step displacement must stay close to v*dt, with no teleport.
const fs = require('fs'), vm = require('vm');
let src = '';
for (const f of ['util', 'tracks', 'track', 'cars', 'car', 'race']) src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8').replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
src += `
const td = TRACKS.find(t => t.id === ARGS[0]);
const race = new Race({ trackDef: td, classId: ARGS[1], difficulty: 'medium', playerAI: true, playerLivery: 0, nCars: 6 });
const p = race.player;
let prev = null, worst = 0, worstAt = '', excursions = 0, log = [];
let watch = 0;
while (race.state !== 'finished' && race.time < 200) {
  const wasOff = p.state === 'grass', rj = p.rejoined;
  const thr = aiThrottle(p, race.cars, race.dt, { marginBase: +ARGS[2], marginSpread: 0 });
  race.update(race.dt, thr);
  if (!wasOff && p.state === 'grass') { excursions++; watch = 240; }
  const q = p.pos;
  if (prev && p.rejoined === rj) {   // a marshal rejoin is a deliberate reposition, not a physics jump
    const step = Math.hypot(q.x - prev.x, q.y - prev.y);
    const expect = Math.hypot(p.v, p.vl) * race.dt + 0.02;
    if (step > expect * 2.5 && step > 0.25) { if (step > worst) { worst = step; worstAt = 'v=' + p.v.toFixed(1) + ' state=' + p.state + ' t=' + race.time.toFixed(2); } }
    if (watch > 0) { watch--; if (watch % 12 === 0) log.push((step / Math.max(0.01, Math.hypot(p.v, p.vl) * race.dt)).toFixed(2)); }
  }
  prev = q;
}
console.log(ARGS.join(' '), 'excursions=' + excursions, 'worst jump=' + worst.toFixed(3) + 'm', worstAt || '(none)');
if (log.length) console.log('  step/expected through excursions:', log.slice(0, 40).join(' '));
`;
vm.runInNewContext(src, { Math, console, ARGS: process.argv.slice(2), Date }, { filename: 'jump' });
