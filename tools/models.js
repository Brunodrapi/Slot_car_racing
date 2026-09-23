// Chaque voiture d'une catégorie, seule en piste : ce qu'elle vaut, et ce qu'elle coûte à piloter.
//
//   node tools/models.js [catégorie] [marge]
//
// Deux colonnes à lire ensemble. Le **tour idéal** est ce que la voiture vaut sur le papier, une
// fois le profil de vitesse résolu sur la trajectoire ; le **tour moyen** est ce qu'un pilote en
// tire vraiment. L'écart entre les deux est le prix du caractère : une voiture qui glisse
// beaucoup peut être rapide en théorie et décevante en main.
//
// Ce qu'on cherche à éviter, c'est une voiture nettement hors du peloton. Une différence de
// caractère est un choix offert au joueur ; cinq secondes au tour n'en est pas un, c'est un piège.
// Repère : les six premières GT tenaient dans quatre pour cent, et la Corvette est sortie à sept
// au premier jet — réglée depuis.
const fs = require('fs'), vm = require('vm');

const ARGS = process.argv.slice(2);
let src = '';
for (const f of ['util', 'tracks', 'track', 'cars', 'car', 'race']) {
  src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8')
    .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
}

src += `
const cat = ARGS[0] || 'gt', marge = +(ARGS[1] || 0.95);
// Cinq circuits de caractères différents plutôt que les douze : de quoi moyenner sans que le
// résultat tienne d'un seul tracé.
const CIRCUITS = ['monza', 'spa', 'monaco', 'suzuka', 'zandvoort'];
const rows = [];
for (const m of modelsOf(cat)) {
  let lap = 0, offs = 0, ideal = 0, n = 0;
  for (const tid of CIRCUITS) {
    const td = TRACKS.find(t => t.id === tid);
    const race = new Race({ trackDef: td, classId: cat, modelId: m.id, difficulty: 'medium',
                            playerAI: true, playerLivery: 0, nCars: 1, mode: 'timetrial' });
    const p = race.player, T = race.track;
    const v = speedProfile(T, p.cls, 'racing', 1);
    let ti = 0;
    for (let i = 0; i < T.n; i++) ti += T.ds / Math.max(3, v[i]);
    ideal += ti;
    while (race.state !== 'finished' && race.time < 400 && p.lap < 3) {
      race.update(race.dt, aiThrottle(p, race.cars, race.dt, { marginBase: marge, marginSpread: 0 }));
    }
    lap += p.bestLap || 999;
    offs += p.crashes;
    n++;
  }
  rows.push({ nom: m.name, lap: lap / n, ideal: ideal / n, offs: offs / n });
}
const ref = Math.min(...rows.map(r => r.lap)), refI = Math.min(...rows.map(r => r.ideal));
OUT = rows.map(r => r.nom.padEnd(16)
  + 'tour ' + r.lap.toFixed(1).padStart(6) + ' s'
  + '  écart ' + ((r.lap / ref - 1) * 100).toFixed(1).padStart(5) + ' %'
  + '   | idéal ' + r.ideal.toFixed(1).padStart(6) + ' s'
  + '  écart ' + ((r.ideal / refI - 1) * 100).toFixed(1).padStart(5) + ' %'
  + '   | prix du pilotage ' + ((r.lap / r.ideal - 1) * 100).toFixed(1).padStart(4) + ' %'
  + '   sorties ' + r.offs.toFixed(1)).join('\\n');
OUT += '\\n\\ncatégorie ' + cat + ', marge ' + marge + ', moyenne sur ' + CIRCUITS.length + ' circuits';
OUT += '\\nétalement du peloton : ' + ((Math.max(...rows.map(r => r.lap)) / ref - 1) * 100).toFixed(1) + ' %';
`;

const ctx = { console, Math, JSON, Object, Array, Float32Array, Date, ARGS, OUT: '' };
vm.runInNewContext(src, ctx, { filename: 'models' });
console.log(ctx.OUT);
