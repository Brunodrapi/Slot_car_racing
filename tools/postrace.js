const fs = require('fs'), vm = require('vm');
let src = '';
for (const f of ['tracks', 'track', 'cars', 'car', 'race']) src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8').replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
src += `
const td = TRACKS.find(t => t.id === ARGS[0]); const pm = +ARGS[3];
const race = new Race({ trackDef: td, classId: ARGS[1], difficulty: ARGS[2], playerLivery: 0, nCars: +(ARGS[4] || 8), laps: 4 });
let line = [], lastT = -10;
while (race.state !== 'finished' && race.time < 600) {
  const p = race.player;
  const thr = aiThrottle(p, race.cars, race.dt, { marginBase: pm, marginSpread: 0 });
  race.update(race.dt, thr);
  if (race.time - lastT >= 10) { lastT = race.time; line.push(race.time.toFixed(0) + 's:P' + race.positionOf(p) + (p.blocker ? 'b' : '')); }
}
const st = race.standings();
console.log(ARGS.join(' '), '| pos over time:', line.join(' '));
console.log('  finish order gaps:', st.map(c => (c.name === 'Vous' ? 'YOU' : c.name.slice(0,6)) + ':' + (c.finishTime ? (c.finishTime - st[0].finishTime).toFixed(1) : 'dnf') + '/' + (c.bestLap||0).toFixed(1) + '/sk' + c.skill.toFixed(2)).join('  '));
`;
vm.runInNewContext(src, { Math, console, ARGS: process.argv.slice(2), Date }, { filename: 'postrace' });
