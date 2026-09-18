// Single-car diagnostic: how well the autopilot tracks its line at a given throttle margin.
// Prints lateral error stats, grip usage, slip and excursions; -v dumps a per-50 m trace.
const fs = require('fs'), vm = require('vm');
let src = '';
for (const f of ['util', 'tracks', 'track', 'cars', 'car', 'race']) src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8').replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
src += `
const td = TRACKS.find(t => t.id === ARGS[0]); const m = +(ARGS[2] || 0.95); const verbose = ARGS[3] === '-v';
const race = new Race({ trackDef: td, classId: ARGS[1], difficulty: 'medium', playerAI: true, playerLivery: 0, nCars: 1, mode: 'timetrial' });
const T = race.track, p = race.player;
let n = 0, sumE2 = 0, maxE = 0, maxAt = 0, over = 0, maxBeta = 0, maxUse = 0, nextS = 0, rows = [], offAt = [], wasOff = false;
while (race.state !== 'finished' && race.time < 400 && p.lap < 2) {
  const thr = aiThrottle(p, race.cars, race.dt, { marginBase: m, marginSpread: 0 });
  race.update(race.dt, thr);
  if (race.state !== 'racing') continue;
  const e = p.lat - T.targetLat(p.s, p.sel);
  n++; sumE2 += e * e; if (Math.abs(e) > maxE) { maxE = Math.abs(e); maxAt = T.wrap(p.s) | 0; }
  if (p.state === 'grass' && !wasOff) offAt.push((T.wrap(p.s) | 0) + '@' + p.v.toFixed(0)); wasOff = p.state === 'grass';
  if (p.usage > 1.02) over++;
  maxBeta = Math.max(maxBeta, Math.abs(p.beta)); maxUse = Math.max(maxUse, p.usage);
  if (verbose && p.lap === 1 && T.wrap(p.s) >= nextS) { nextS += 50; rows.push([T.wrap(p.s).toFixed(0).padStart(5), 'v=' + p.v.toFixed(1).padStart(5), 'R=' + (1/Math.max(1e-4, Math.abs(T.curvAtLat(p.s, p.lat)))).toFixed(0).padStart(5), 'err=' + e.toFixed(2).padStart(6), 'use=' + p.usage.toFixed(2), 'beta=' + (p.beta*57.3).toFixed(1).padStart(5), 'st=' + p.delta.toFixed(3), 'w=' + p.w.toFixed(2), p.state].join(' ')); }
}
console.log(ARGS.slice(0,3).join(' ').padEnd(28), 'lap=' + (p.bestLap||0).toFixed(1) + 's', 'rmsErr=' + Math.sqrt(sumE2 / Math.max(1,n)).toFixed(2) + 'm', 'maxErr=' + maxE.toFixed(2) + 'm@' + maxAt, 'over%=' + (100*over/Math.max(1,n)).toFixed(1), 'maxBeta=' + (maxBeta*57.3).toFixed(0) + 'deg', 'maxUse=' + maxUse.toFixed(2), 'offs=' + p.crashes + (offAt.length ? ' [' + offAt.join(' ') + ']' : ''));
if (verbose) console.log(rows.join('\\n'));
`;
vm.runInNewContext(src, { Math, console, ARGS: process.argv.slice(2), Date }, { filename: 'step' });
