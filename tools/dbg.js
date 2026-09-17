const fs = require('fs'), vm = require('vm');
let src = '';
for (const f of ['util', 'tracks', 'track', 'cars', 'car', 'race']) src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8').replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
src += `
const td = TRACKS.find(t => t.id === ARGS[0]);
const race = new Race({ trackDef: td, classId: ARGS[1], difficulty: 'medium', playerAI: true, playerLivery: 0, nCars: 8 });
const T = race.track;
const orig = Car.prototype.crash;
let n = 0;
Car.prototype.crash = function () {
  if (this.state !== 'grass' && n++ < 12) {
    const i = T.idx(this.s), latR = (this.rx - T.xs[i]) * T.nx[i] + (this.ry - T.ys[i]) * T.ny[i];
    const k = T.curvAtLat(this.s, this.lat);
    console.log('t=' + race.time.toFixed(1), this.name, 'v=' + this.v.toFixed(1), 's=' + this.s.toFixed(0), 'lat=' + this.lat.toFixed(2), 'latR=' + latR.toFixed(2), 'hwL=' + T.hwLeftAt(this.s).toFixed(1), 'drift=' + this.drift.toFixed(2), 'vl=' + this.vl.toFixed(2), 'R=' + (1/Math.max(1e-6,Math.abs(k))).toFixed(0), 'ratio=' + (this.v*this.v*Math.abs(k)/this.gripAt(this.v)).toFixed(2), 'blk=' + (this.blocker?1:0), 'grace=' + this.grace.toFixed(2), 'sel=' + this.sel);
  }
  return orig.call(this);
};
while (race.state !== 'finished' && race.time < 120) { const thr = aiThrottle(race.player, race.cars, race.dt, { marginBase: 1.0, marginSpread: 0 }); race.update(race.dt, thr); }
`;
vm.runInNewContext(src, { Math, console, ARGS: process.argv.slice(2), Date }, { filename: 'dbg' });
