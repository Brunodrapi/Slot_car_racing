// Compares curvature smoothness of Catmull-Rom (current) vs uniform cubic B-spline on the built-in tracks,
// and the resulting jitter of the grip ratio for a car at constant speed on the racing line.
const fs = require('fs'), vm = require('vm');
let src = '';
for (const f of ['util', 'tracks', 'track', 'cars', 'car', 'race']) src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8').replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
src += `
function bspline(pts, steps) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let j = 0; j < steps; j++) {
      const t = j / steps, t2 = t * t, t3 = t2 * t;
      const b0 = (1 - t) ** 3 / 6, b1 = (3 * t3 - 6 * t2 + 4) / 6, b2 = (-3 * t3 + 3 * t2 + 3 * t + 1) / 6, b3 = t3 / 6;
      out.push([b0 * p0[0] + b1 * p1[0] + b2 * p2[0] + b3 * p3[0], b0 * p0[1] + b1 * p1[1] + b2 * p2[1] + b3 * p3[1]]);
    }
  }
  return out;
}
function stats(name, T) {
  const N = T.n; let jumps = 0, maxJump = 0, rough = 0;
  for (let i = 0; i < N; i++) { const d = Math.abs(T.k[(i + 1) % N] - T.k[i]); if (d > maxJump) maxJump = d; if (d > 0.002) jumps++; }
  // grip ratio seen by a car on the racing line at a speed such that the tightest corner is at 90% of the limit
  const car = { gripAt: () => 15 };
  let kmax = 0; for (let i = 0; i < N; i++) kmax = Math.max(kmax, Math.abs(T.curvAtLat(i, T.lines.racing[i])));
  const v = Math.sqrt(0.9 * 15 / kmax);
  const r = []; for (let i = 0; i < N; i++) r.push(v * v * Math.abs(T.curvAtLat(i, T.lines.racing[i])) / 15);
  for (let i = 0; i < N; i++) rough += Math.abs(r[(i + 1) % N] - 2 * r[i] + r[(i - 1 + N) % N]);
  return { jumps, maxJump: maxJump.toFixed(4), rough: (rough / N * 1000).toFixed(2) };
}
const origSpline = Track.spline;
for (const def of TRACKS) {
  Track.spline = origSpline;
  const a = stats('CR', new Track(def));
  Track.spline = bspline;
  const b = stats('BS', new Track(def));
  console.log(def.id.padEnd(12), 'Catmull-Rom: jumps>0.002/m=' + a.jumps, 'max dk=' + a.maxJump, 'ratio roughness=' + a.rough, ' | B-spline: jumps=' + b.jumps, 'max dk=' + b.maxJump, 'roughness=' + b.rough);
}
`;
vm.runInNewContext(src, { Math, console, Date }, { filename: 'curv' });
