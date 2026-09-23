// What the three difficulty levels actually give, in lap times.
//
//   node tools/diff.js [circuit|all] [catégorie] [-sans-elastique]
//
// A difficulty setting is a promise about the field: on hard the cars ahead should be genuinely
// harder to catch. `DIFFICULTY` only states its intent in coefficients — margin (how close to the
// corner limit the AI drives) and pace (what fraction of top speed it allows itself). This turns
// those coefficients into the only thing a player can feel: how fast the field goes round.
//
// It reports the AI field alone — the player's car is excluded, since on a real quick race that
// one is driven by a person and its time says nothing about the setting.
//
// `-sans-elastique` removes the rubber-banding term from `_simulate` before running, which is how
// you tell a difficulty that is badly chosen apart from one that is being undone on the way out.
const fs = require('fs'), vm = require('vm');

const ARGS = process.argv.slice(2);
const NO_RUBBER = ARGS.includes('-sans-elastique');
// A candidate table to try in place of the one in js/race.js, so a setting can be measured before
// it is committed rather than after:
//   node tools/diff.js all gt "-table={\"hard\":{\"marginBase\":0.95,...}}"
const TABLE = (ARGS.find(a => a.startsWith('-table=')) || '').slice(7);

let src = '';
for (const f of ['util', 'tracks', 'track', 'cars', 'car', 'race']) {
  let t = fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8')
    .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '');
  if (NO_RUBBER && f === 'race') {
    const before = t;
    t = t.replace(/const rubber = [^;]+;/, 'const rubber = 0;');
    if (t === before) { console.error('le terme d élastique est introuvable — la sonde est périmée'); process.exit(2); }
  }
  src += t + '\n';
}
if (TABLE) src += `Object.assign(DIFFICULTY, ${TABLE});\n`;

src += `
const which = ARGS[0] || 'all', catId = ARGS[1] || 'gt';
const rows = [];
const perDiff = {};
for (const td of TRACKS) {
  if (which !== 'all' && td.id !== which) continue;
  const out = {};
  for (const diff of ['easy', 'medium', 'hard']) {
    // Same grid every time: the roster is seeded, so the skills are identical across the three
    // runs and the only thing that changes is the setting under test.
    const race = new Race({
      trackDef: td, classId: catId, difficulty: diff, playerAI: true, playerLivery: 0,
      nCars: 8, roster: makeRoster(8, 0, 12345, catId), laps: 4,
    });
    while (race.state !== 'finished' && race.time < 900) {
      const thr = aiThrottle(race.player, race.cars, race.dt, { marginBase: 0.9, marginSpread: 0 });
      race.update(race.dt, thr);
    }
    const ai = race.cars.filter(c => !c.isPlayer && c.bestLap);
    const laps = ai.map(c => c.bestLap).sort((a, b) => a - b);
    if (!laps.length) continue;
    // Race pace: the whole race divided by the laps done. It carries the mistakes, the traffic and
    // the trips through the gravel, which the best lap deliberately hides — and it is what a player
    // is actually racing against. A field that laps quickly and throws it away twice a race is not
    // a hard field.
    const pace = ai.map(c => (c.finishTime != null ? c.finishTime : race.time) / Math.max(1, c.lap)).sort((a, b) => a - b);
    out[diff] = {
      best: laps[0], med: laps[Math.floor(laps.length / 2)], worst: laps[laps.length - 1],
      pace: pace[0], paceMed: pace[Math.floor(pace.length / 2)],
      crash: ai.reduce((a, c) => a + c.crashes, 0),
    };
    (perDiff[diff] = perDiff[diff] || []).push(out[diff]);
  }
  if (!out.easy || !out.hard) continue;
  const gain = (a, b) => ((a - b) / a * 100);
  rows.push(td.id.padEnd(13)
    + ' facile ' + out.easy.best.toFixed(1).padStart(6)
    + ' | moyen ' + out.medium.best.toFixed(1).padStart(6)
    + ' | difficile ' + out.hard.best.toFixed(1).padStart(6)
    + '   écart facile→difficile ' + gain(out.easy.best, out.hard.best).toFixed(1).padStart(5) + ' %'
    + '   sorties ' + out.easy.crash + '/' + out.medium.crash + '/' + out.hard.crash);
}
rows.push('');
rows.push('table : ' + ['easy', 'medium', 'hard'].map(d => d + ' m' + DIFFICULTY[d].marginBase + '+' + DIFFICULTY[d].marginSpread + ' p' + DIFFICULTY[d].paceBase + '+' + DIFFICULTY[d].paceSpread).join('  |  '));
for (const d of ['easy', 'medium', 'hard']) {
  const a = perDiff[d] || [];
  if (!a.length) continue;
  const m = (f) => a.reduce((s, x) => s + f(x), 0) / a.length;
  rows.push(d.padEnd(7) + ' meilleur tour ' + m(x => x.best).toFixed(2) + ' s'
    + ' | RYTHME DE COURSE ' + m(x => x.pace).toFixed(2) + ' s (médian ' + m(x => x.paceMed).toFixed(2) + ')'
    + ' | étalement ' + m(x => x.worst - x.best).toFixed(2) + ' s'
    + ' | sorties ' + m(x => x.crash).toFixed(1));
}
const e = perDiff.easy || [], h = perDiff.hard || [];
if (e.length && h.length) {
  const mb = (a, f) => a.reduce((s, x) => s + f(x), 0) / a.length;
  rows.push('');
  rows.push('écart facile → difficile   meilleur tour ' + ((mb(e, x => x.best) - mb(h, x => x.best)) / mb(e, x => x.best) * 100).toFixed(1) + ' %'
    + '   RYTHME DE COURSE ' + ((mb(e, x => x.pace) - mb(h, x => x.pace)) / mb(e, x => x.pace) * 100).toFixed(1) + ' %'
    + (${JSON.stringify(NO_RUBBER)} ? '   (élastique retiré)' : '   (élastique en place)'));
}
OUT = rows.join('\\n');
`;

const ctx = { console, Math, JSON, Object, Array, Float32Array, Date, ARGS, OUT: '' };
vm.runInNewContext(src, ctx, { filename: 'diff' });
console.log(ctx.OUT);
