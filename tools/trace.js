const fs = require('fs'), vm = require('vm');
let src = '';
for (const f of ['tracks', 'track', 'cars', 'car', 'race']) src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8').replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
src += `
const td = TRACKS.find(t => t.id === ARGS[0]); const pm = +ARGS[2];
const race = new Race({ trackDef: td, classId: ARGS[1], difficulty: 'hard', playerLivery: 0, nCars: 1 });
let maxSlide = 0, maxLat = 0, maxNeedRatio = 0, samples = [];
while (race.state !== 'finished' && race.time < 120) {
  const p = race.player;
  const thr = aiThrottle(p, race.cars, race.dt, { marginBase: pm, marginSpread: 0 });
  race.update(race.dt, thr);
  if (race.state === 'racing') {
    const k = Math.abs(race.track.curvAt(p.s)); const ratio = p.v*p.v*k / p.gripAt(p.v);
    maxSlide = Math.max(maxSlide, p.slide); maxLat = Math.max(maxLat, Math.abs(p.lat)); maxNeedRatio = Math.max(maxNeedRatio, ratio);
    if (Math.abs(race.time*2 - Math.round(race.time*2)) < 0.005 && race.time < 60) samples.push([race.time.toFixed(1), p.s.toFixed(0), p.v.toFixed(1), (1/Math.max(k,1e-6)).toFixed(0), ratio.toFixed(2), p.slide.toFixed(2), p.lat.toFixed(1), thr?1:0, p.aiAllow.toFixed(1), p.state].join(' '));
  }
}
console.log('t s v R ratio slide lat thr allow state'); console.log([...new Set(samples)].join('\\n'));
console.log('maxSlide', maxSlide.toFixed(2), 'maxLat', maxLat.toFixed(2), 'maxNeedRatio', maxNeedRatio.toFixed(2), 'crashes', race.player.crashes, 'halfW', race.track.halfWidth);
`;
vm.runInNewContext(src, { Math, console, ARGS: process.argv.slice(2), Date }, { filename: 'trace' });
