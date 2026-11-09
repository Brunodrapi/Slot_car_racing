// L'appui et la glisse en virage, voiture par voiture, au pilote automatique (le 2e tour, lancé).
//
//   node tools/appui-banc.js [voitures] [circuits] ['{"@f1":{"slipPeak":0.08}}']
//   node tools/appui-banc.js lotus79,ferrari312t,962,m1procar monza,spa,suzuka,silverstone,zandvoort,monaco
//
// En virage, c'est-à-dire quand la piste demande plus de 0,4 g : la vitesse moyenne, la part du temps
// sous 150 km/h, la part de l'adhérence que fournit l'appui, la dérive de la caisse (moyenne et 95e
// centile), la part du temps où l'arrière est au-delà de 85 % de son pic, les sorties de piste et la
// somme des meilleurs tours. Le troisième argument essaie un réglage sans toucher à js/cars.js, comme
// `--patch` de tools/plateau-banc.js. Écrit pour l'appui à l'échelle des circuits (docs/appui/README.md).
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = path.join(__dirname, '..');
const c = vm.createContext({ Math: Object.create(Math), console, Date, Float32Array, Float64Array, Uint8Array, Uint16Array, Uint32Array, Int32Array });
vm.runInContext(['util', 'traces', 'tracks', 'track', 'cars', 'car', 'race'].map(f => fs.readFileSync(path.join(R, 'js', f + '.js'), 'utf8')
  .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '')).join('\n') + '\nthis.__T = { TRACKS, Race, aiThrottle, categoryOfModel };', c);
const PATCH = process.argv[4] ? JSON.parse(process.argv[4]) : null;
if (PATCH) { c.PATCH = PATCH; vm.runInContext(`for (const cat of CATEGORIES) {
      if (PATCH['@' + cat.id]) Object.assign(cat.base, PATCH['@' + cat.id]);
      for (const m of cat.models) if (PATCH[m.id]) m.mul = Object.assign({}, m.mul, PATCH[m.id]);
    }
    MODELS.length = 0;
    for (const cat of CATEGORIES) for (const m of cat.models) MODELS.push(resolveModel(cat, m));`, c); }
const { TRACKS, Race, aiThrottle, categoryOfModel } = c.__T;
const cars = (process.argv[2] || 'lotus79,ferrari312t,962,m1procar,f40').split(',');
const tracks = (process.argv[3] || 'monza,spa,suzuka,silverstone,zandvoort,monaco').split(',');
const out = {};
for (const car of cars) for (const tid of tracks) {
  let seed = 4242; c.Math.random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  const cat = categoryOfModel(car).id;
  const r = new Race({ trackDef: TRACKS.find(t => t.id === tid), classId: cat, modelId: car, difficulty: 'medium', playerAI: true, nCars: 1, mode: 'timetrial' });
  const p = r.player, T = r.track;
  const a = (out[car] = out[car] || { cat, sorties: 0, tq: 0, temps: 0, n: 0, vSum: 0, lent: 0, aero: 0, betaSum: 0, betas: [], glisse: 0, aLat: 0, lapT: [], tracks: 0 });
  a.tracks++;
  while (p.lap < 2 && r.time < 500) {
    const gas = aiThrottle(p, r.cars, r.dt, { marginBase: 1.0, marginSpread: 0 });
    r.update(r.dt, gas);
    if (r.state !== 'racing' || p.state !== 'ok' || p.lap < 1) continue;   // le 2e tour, lancé
    const k = Math.abs(T.k[T.idx(p.s)]), v = p.v, ay = v * v * k;
    if (ay < 4 || v < 5) continue;                                          // en virage : > 0,4 g demandés
    const g = p.gripAt(v), m = p.cls.grip;
    a.n++; a.vSum += v * 3.6; if (v * 3.6 < 150) a.lent++;
    a.aero += Math.min(p.cls.df * v * v, m * 1.8) / g;
    a.aLat += ay / 9.81;
    const b = Math.abs(p.beta) * 180 / Math.PI; a.betaSum += b; a.betas.push(b); if (b > 57) a.tq++;
    if (Math.abs(p.alphaR) > 0.85 * p.cls.slipPeak) a.glisse++;
  }
  a.sorties += p.crashes || 0; a.temps += p.bestLapBrut || p.bestLap || 0;
}
console.log('voiture        cat    v moy virage  <150 km/h  part appui  g moy   dérive moy  dérive p95  arr. limite  sorties  temps tours');
for (const [car, a] of Object.entries(out)) {
  a.betas.sort((x, y) => x - y);
  const p95 = a.betas[Math.floor(a.betas.length * 0.95)] || 0;
  console.log(car.padEnd(14), a.cat.padEnd(5), (a.vSum / a.n).toFixed(0).padStart(7) + ' km/h', (100 * a.lent / a.n).toFixed(0).padStart(7) + ' %',
    (100 * a.aero / a.n).toFixed(0).padStart(9) + ' %', (a.aLat / a.n).toFixed(2).padStart(7), (a.betaSum / a.n).toFixed(1).padStart(9) + '°', p95.toFixed(1).padStart(9) + '°', (100 * a.glisse / a.n).toFixed(0).padStart(10) + ' %', String(a.sorties).padStart(7), a.temps.toFixed(1).padStart(10));
}
