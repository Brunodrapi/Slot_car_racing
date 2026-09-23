// Corner by corner: the speed the car actually carries, against the speed the corner allows.
//
// `tools/line.js` says what a line is worth in theory and `tools/step.js` says how cleanly the
// autopilot follows it, but neither answers the question a driver asks: am I going through that
// corner at the speed it is worth? This does, one corner at a time.
//
//   node tools/corner.js [circuit|all] [catégorie] [marge] [-v]
//
// For each corner it prints
//   R        radius of the racing line at the apex (the line's own curvature, not the road's)
//   théo     cornerSpeedFor at that radius: all the grip, nothing left over
//   profil   speedProfile: the same, once braking and acceleration are taken into account
//   réel     the slowest the car actually goes through the corner, on a flying lap
//   ay       lateral acceleration the tyres really produce there, against the grip they have
//
// `ay` is the honest test of the grip model. théo is arithmetic on `c.grip`; ay is what comes out
// of the two-axle model once the tyres, the slip angles and the yaw have had their say. If the
// two disagree the corner speeds in the game are a fiction — the car brakes for a limit it does
// not have, or holds a speed the numbers say it cannot.
const fs = require('fs'), vm = require('vm');

let src = '';
for (const f of ['util', 'tracks', 'track', 'cars', 'car', 'race']) {
  src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8')
    .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
}

src += `
const which = ARGS[0] || 'all';
const catId = ARGS[1] || 'gt';
const MARGIN = +(ARGS[2] || 1);
const verbose = ARGS.includes('-v');
const rows = [];
const all = [];

for (const td of TRACKS) {
  if (which !== 'all' && td.id !== which) continue;
  const race = new Race({ trackDef: td, classId: catId, difficulty: 'medium', playerAI: true, playerLivery: 0, nCars: 1, mode: 'timetrial' });
  const T = race.track, p = race.player, c = race.cls, N = T.n;

  // The car's own record of its flying lap, one entry per metre of track.
  const vAt = new Float32Array(N).fill(-1), useAt = new Float32Array(N), ayAt = new Float32Array(N), capAt = new Float32Array(N);
  let offs = 0, wasOff = false, laps = 0;
  while (race.state !== 'finished' && race.time < 400 && p.lap < 3) {
    const thr = aiThrottle(p, race.cars, race.dt, { marginBase: MARGIN, marginSpread: 0 });
    race.update(race.dt, thr);
    if (race.state !== 'racing') continue;
    if (p.state === 'grass' && !wasOff) offs++;
    wasOff = p.state === 'grass';
    if (p.lap !== 1) continue;                       // the flying lap only: the first is from a standstill
    const i = T.idx(p.s);
    if (vAt[i] >= 0) continue;                       // first pass over this metre wins
    vAt[i] = p.v;
    useAt[i] = p.usage;
    // What the tyres are really doing. The only lateral force on the car is the one the two axles
    // produce, so their sum IS the lateral acceleration — no need to guess the path's curvature,
    // which on a line that crosses the road is not the road's curvature at that offset.
    ayAt[i] = Math.abs(p.Ff + p.Fr);
    capAt[i] = p.gripAt(Math.abs(p.v)) * (p.state === 'grass' ? 0.42 : 1);
  }

  const prof = speedProfile(T, c, 'racing', 1);
  const kR = T.lineK.racing;
  const w = (j) => ((j % N) + N) % N;
  // Corners are grouped the way the braking boards group them: a chicane is one thing to slow down
  // for, and judging each of its three bends separately would blame the fast one for the speed the
  // tight one costs.
  const GAP = 60;
  const zones = [];
  for (const co of T.corners) {
    const z = zones[zones.length - 1];
    if (z && (co.from - z.to) * T.ds < GAP) z.to = co.to;
    else zones.push({ from: co.from, to: co.to });
  }
  if (zones.length > 1) {
    const a = zones[zones.length - 1], b = zones[0];
    if ((b.from + N - a.to) * T.ds < GAP) { b.from = a.from - N; zones.pop(); }
  }

  const corners = [];
  for (const z of zones) {
    // The apex of the racing line, which is not the apex of the road: the line straightens what
    // it can, so its tightest point is what the car has to slow down for.
    let peak = 0, at = z.from;
    for (let i = z.from; i <= z.to; i++) { const k = Math.abs(kR[w(i)]); if (k > peak) { peak = k; at = w(i); } }
    if (peak < 1 / 200) continue;
    // The speed a corner is taken at is the slowest point through it, not the speed at the apex:
    // a car that brakes too late is still slowing down when it gets there. The theoretical speed
    // is read the same way, at the slowest point the profile allows across the same stretch.
    let vMin = Infinity, vMinAt = at, useMax = 0, ayMax = 0, capThere = 0, pMin = Infinity;
    for (let i = z.from - 6; i <= z.to + 6; i++) {
      const j = w(i);
      pMin = Math.min(pMin, prof[j]);
      if (vAt[j] < 0) continue;
      if (vAt[j] < vMin) { vMin = vAt[j]; vMinAt = j; }
      if (useAt[j] > useMax) useMax = useAt[j];
      if (ayAt[j] > ayMax) { ayMax = ayAt[j]; capThere = capAt[j]; }
    }
    if (!isFinite(vMin)) continue;
    // The radius the car really went round, read back from its own speed and lateral force. If it
    // is much wider than the line's, the line asked for something the car did not do.
    const Rreal = ayMax > 0.5 ? vAt[vMinAt] * vAt[vMinAt] / ayMax : Infinity;
    corners.push({ at, R: 1 / peak, vTh: cornerSpeedFor(c, peak), vProf: pMin, vMin, vMinAt, useMax, ayMax, capThere, Rreal });
  }

  let sum = 0, worst = null;
  for (const q of corners) {
    q.ratio = q.vMin / Math.min(q.vTh, q.vProf);
    sum += q.ratio;
    if (!worst || q.ratio < worst.ratio) worst = q;
    all.push(q);
  }
  const mean = sum / Math.max(1, corners.length);
  rows.push(td.id.padEnd(13) + ' ' + String(corners.length).padStart(2) + ' virages   '
    + 'réel/théorique moyen ' + (mean * 100).toFixed(0).padStart(3) + ' %   '
    + 'pire ' + (worst ? (worst.ratio * 100).toFixed(0) + ' % au ' + worst.at + ' m (R ' + worst.R.toFixed(0) + ' m)' : '-').padEnd(28)
    + '  tour ' + (p.bestLap || 0).toFixed(1) + ' s, ' + offs + ' sorties');
  if (verbose) {
    for (const q of corners) {
      rows.push('   ' + String(q.at).padStart(5) + ' m  R ' + q.R.toFixed(0).padStart(4) + ' m'
        + '   théo ' + q.vTh.toFixed(1).padStart(5)
        + '  profil ' + q.vProf.toFixed(1).padStart(5)
        + '  réel ' + q.vMin.toFixed(1).padStart(5) + ' m/s (' + (q.ratio * 100).toFixed(0).padStart(3) + ' %)'
        + '   usage ' + q.useMax.toFixed(2)
        + '   ay ' + q.ayMax.toFixed(1).padStart(5) + '/' + q.capThere.toFixed(1) + ' (' + (q.ayMax / Math.max(1e-3, q.capThere) * 100).toFixed(0) + ' %)'
        + '   R suivi ' + q.Rreal.toFixed(0).padStart(4) + ' m');
    }
  }
}

// The grip model, read across every corner of every circuit at once.
const ratios = all.map(q => q.ratio).sort((a, b) => a - b);
const grips = all.map(q => q.ayMax / Math.max(1e-3, q.capThere)).sort((a, b) => a - b);
const radii = all.filter(q => isFinite(q.Rreal)).map(q => q.Rreal / q.R).sort((a, b) => a - b);
const q = (arr, f) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(f * arr.length))] : 0;
rows.push('');
rows.push('catégorie ' + catId + ', marge ' + MARGIN + ', ' + all.length + ' virages');
rows.push('  réel / théorique      médiane ' + (q(ratios, 0.5) * 100).toFixed(0) + ' %   1er décile ' + (q(ratios, 0.1) * 100).toFixed(0) + ' %   9e ' + (q(ratios, 0.9) * 100).toFixed(0) + ' %');
rows.push('  adhérence employée    médiane ' + (q(grips, 0.5) * 100).toFixed(0) + ' %   1er décile ' + (q(grips, 0.1) * 100).toFixed(0) + ' %   9e ' + (q(grips, 0.9) * 100).toFixed(0) + ' %');
rows.push('  rayon suivi / tracé   médiane ' + (q(radii, 0.5) * 100).toFixed(0) + ' %   1er décile ' + (q(radii, 0.1) * 100).toFixed(0) + ' %   9e ' + (q(radii, 0.9) * 100).toFixed(0) + ' %');

// The same grip, in the unit a reader can weigh against a real car.
rows.push('');
rows.push('adhérence par catégorie, en g (1 g = 9.81 m/s²)');
for (const cat of CATEGORIES) {
  const m = modelsOf(cat.id)[0];
  const lowG = m.grip / 9.81;
  const topG = (m.grip + Math.min(m.df * m.vmax * m.vmax, m.grip * 1.8)) / 9.81;
  rows.push('  ' + cat.id.padEnd(13)
    + ' latéral ' + lowG.toFixed(2) + ' g à l arrêt → ' + topG.toFixed(2) + ' g à ' + Math.round(m.vmax * 3.6) + ' km/h'
    + '   freinage ' + (m.brake / 9.81).toFixed(2) + ' g'
    + '   reprise ' + (m.accel / 9.81).toFixed(2) + ' g');
}
OUT = rows.join('\\n');
`;

const ctx = { console, Math, JSON, Object, Array, Float32Array, Date, ARGS: process.argv.slice(2), OUT: '' };
vm.runInNewContext(src, ctx, { filename: 'corner' });
console.log(ctx.OUT);
