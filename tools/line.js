// What a driving line is worth, before any driver touches it.
//
// A lap time from the simulator mixes the quality of the line with the ability of the autopilot to
// follow it. This measures the line alone: its length, how hard it bends at its worst, and the lap
// it would give a car that drove it exactly at the limit. That is the number a racing line exists
// to lower, and the only honest way to tell whether a change to the generator helped.
//
//   node tools/line.js [circuit|all] [catégorie] [-v]
//
// With -v it also names the tightest point of the line and shows the offsets around it, which is
// how a kink is told apart from a genuinely tight corner: a kink has neighbours that disagree.
const fs = require('fs'), vm = require('vm');

const ARGS = process.argv.slice(2);
let src = '';
for (const f of ['util', 'tracks', 'track', 'cars', 'car']) {
  src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8')
    .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
}
src += `
const which = ARGS[0] || 'all';
const cls = modelsOf(ARGS[1] || 'gt')[0];
const rows = [];
for (const td of TRACKS) {
  if (which !== 'all' && td.id !== which) continue;
  const T = new Track(td);
  const out = [];
  for (const name of LINE_NAMES) {
    const k = T.lineK[name];
    // Length of the line itself: it wanders across the road, so it is not the length of the track.
    let len = 0, peak = 0, sumAbs = 0;
    for (let i = 0; i < T.n; i++) {
      const a = T.lines[name][i], b = T.lines[name][(i + 1) % T.n];
      len += Math.hypot(T.ds, b - a);
      peak = Math.max(peak, Math.abs(k[i]));
      sumAbs += Math.abs(k[i]);
    }
    // The lap a car would set driving this line exactly at the limit, braking where it must.
    const v = speedProfile(T, cls, name, 1);
    let t = 0;
    for (let i = 0; i < T.n; i++) t += T.ds / Math.max(3, v[i]);
    let at = 0;
    for (let i = 0; i < T.n; i++) if (Math.abs(k[i]) === peak) { at = i; break; }
    out.push({ name, len, peak, mean: sumAbs / T.n, t, rmin: 1 / Math.max(1e-6, peak), at });
  }
  const r = out.find(o => o.name === 'racing');
  if (ARGS.includes('-v')) {
    // The geometric truth: how far the line moves sideways per metre travelled, and how sharply it
    // actually bends. lineK is a formula on the road's curvature plus the offset's second
    // difference, and near a seam the two can disagree.
    const a2 = T.lines.racing, w2 = (j) => ((j % T.n) + T.n) % T.n;
    let ms = 0, msAt = 0, gk = 0, gkAt = 0;
    for (let i = 0; i < T.n; i++) {
      const d = Math.abs(a2[w2(i + 1)] - a2[i]);
      if (d > ms) { ms = d; msAt = i; }
      const P = (j) => [T.xs[w2(j)] + T.nx[w2(j)] * a2[w2(j)], T.ys[w2(j)] + T.ny[w2(j)] * a2[w2(j)]];
      const A = P(i - 1), B = P(i), C = P(i + 1);
      let dd = Math.atan2(C[1] - B[1], C[0] - B[0]) - Math.atan2(B[1] - A[1], B[0] - A[0]);
      while (dd > Math.PI) dd -= 2 * Math.PI;
      while (dd < -Math.PI) dd += 2 * Math.PI;
      const kk = Math.abs(dd) / Math.max(0.5, Math.hypot(C[0] - B[0], C[1] - B[1]));
      if (kk > gk) { gk = kk; gkAt = i; }
    }
    // What the road itself does at that point: a line cannot be gentler than the tarmac it is on,
    // and on these shortened circuits a hairpin can be genuinely very tight.
    let ck = 0, ckAt = 0;
    for (let i = 0; i < T.n; i++) if (Math.abs(T.k[i]) > ck) { ck = Math.abs(T.k[i]); ckAt = i; }
    rows.push(td.id + ' : la route elle-même descend à ' + (1 / Math.max(1e-6, ck)).toFixed(1) + ' m de rayon à ' + ckAt + ' m');
    rows.push(td.id + ' : pente maximale ' + ms.toFixed(3) + ' m/m à ' + msAt + ' m ; rayon géométrique min ' + (1 / Math.max(1e-6, gk)).toFixed(1) + ' m à ' + gkAt + ' m');
    const a = T.lines.racing, i = r.at, w = (j) => ((j % T.n) + T.n) % T.n;
    rows.push(td.id + ' : point le plus serré à ' + r.at + ' m, rayon ' + r.rmin.toFixed(1) + ' m');
    rows.push('   largeur gauche/droite ' + T.hwL[i].toFixed(1) + '/' + T.hwR[i].toFixed(1) + ' m');
    rows.push('   décalages autour : ' + [-4, -3, -2, -1, 0, 1, 2, 3, 4].map(d => a[w(i + d)].toFixed(2)).join(' '));
    rows.push('   courbure de la route autour : ' + [-4, -2, 0, 2, 4].map(d => (T.k[w(i + d)] * 1000).toFixed(1)).join(' '));
  }
  rows.push([
    td.id.padEnd(13),
    'tour idéal ' + r.t.toFixed(2).padStart(6) + ' s',
    'longueur ' + Math.round(r.len).toString().padStart(5) + ' m',
    'rayon min ' + r.rmin.toFixed(1).padStart(6) + ' m',
    'courbure moyenne ' + (r.mean * 1000).toFixed(2),
    '| int ' + out.find(o => o.name === 'inside').t.toFixed(1) + ' ext ' + out.find(o => o.name === 'outside').t.toFixed(1),
  ].join('  '));
}
OUT = rows.join('\\n');
`;
const ctx = { console, Math, JSON, Object, Array, Float32Array, ARGS, OUT: '' };
vm.runInNewContext(src, ctx);
console.log(ctx.OUT);
