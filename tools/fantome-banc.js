// Le fantôme de l'entraînement : que vaut-il, et à quel talent le régler ?
//
//   node tools/fantome-banc.js [voitures] [circuits] [tours] [niveau]
//   node tools/fantome-banc.js lotus79,962,m1procar monza,spa,suzuka,silverstone,zandvoort,monaco 4 hard
//
// Le fantôme est une voiture de l'IA (js/race.js, FANTOME) ; le niveau est celui du jeu sauf si le
// quatrième argument en essaie un autre (easy, medium, hard, extreme, cauchemar). Son talent (`skill`,
// de 0 à 1) décale sa marge : plus haut, il demande plus à ses pneus — et sort plus souvent. On le fait
// rouler seul, le joueur restant sur la grille, et on relève pour chaque talent : le meilleur tour, le
// tour moyen (sorties comprises : c'est ce que le joueur a devant lui), les sorties de piste, et
// l'écart au tour idéal de la voiture sans la triche d'adhérence. Graine fixe.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = path.join(__dirname, '..');
const c = vm.createContext({ Math: Object.create(Math), console, Date, Float32Array, Float64Array, Uint8Array, Uint16Array, Uint32Array, Int32Array });
vm.runInContext(['util', 'traces', 'tracks', 'track', 'cars', 'car', 'race'].map(f => fs.readFileSync(path.join(R, 'js', f + '.js'), 'utf8')
  .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '')).join('\n') + '\nthis.__T = { TRACKS, Race, FANTOME, categoryOfModel, speedProfile };', c);
const { TRACKS, Race, FANTOME, categoryOfModel, speedProfile } = c.__T;
const cars = (process.argv[2] || 'lotus79,962,m1procar').split(',');
const tracks = (process.argv[3] || 'monza,spa,suzuka,silverstone,zandvoort,monaco').split(',');
const TOURS = +process.argv[4] || 4;
if (process.argv[5]) FANTOME.niveau = process.argv[5];
console.log('niveau : ' + FANTOME.niveau);
console.log(`talent  voiture     meilleur tour (somme)  tour moyen (somme)  sorties  tours bouclés   écart au tour idéal`);
for (const skill of [0, 0.25, 0.5, 0.75, 1]) for (const car of cars) {
  FANTOME.skill = skill;
  let best = 0, moy = 0, sorties = 0, boucles = 0, ideal = 0;
  for (const tid of tracks) {
    let seed = 4242; c.Math.random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
    const r = new Race({ trackDef: TRACKS.find(t => t.id === tid), classId: categoryOfModel(car).id, modelId: car, mode: 'timetrial', entrainement: true });
    const f = r.fantome;
    while (f.lap < TOURS && r.time < 900) r.update(r.dt, false);
    const lt = f.lapTimes.slice(0, TOURS);
    best += Math.min(...lt); moy += lt.reduce((a, b) => a + b, 0) / Math.max(1, lt.length);
    sorties += f.crashes || 0; boucles += lt.length;
    const v = speedProfile(r.track, r.cls, 'racing', 1); let t = 0;
    for (let i = 0; i < r.track.n; i++) t += r.track.ds / Math.max(3, v[i]);
    ideal += t;
  }
  console.log(String(skill).padEnd(7), car.padEnd(12), best.toFixed(1).padStart(12), moy.toFixed(1).padStart(22), String(sorties).padStart(12), String(boucles).padStart(10), ((best / ideal - 1) * 100).toFixed(1).padStart(18) + ' %');
}
