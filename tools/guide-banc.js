// Le guide de freinage tient-il ce qu'il dit ? Un pilote qui lui obéit, et rien d'autre.
//
//   node tools/guide-banc.js [voitures] [circuits] [tours] ['{"marge":0.95,"reaction":0.15}']
//   node tools/guide-banc.js lotus79,962,m1procar monza,spa,suzuka,silverstone,zandvoort,monaco 4
//
// Le guide (js/race.js, GUIDE et Race.guide) dit au doigt quoi faire : lever (zone rouge), doser (rouge
// en pointillé), plein gaz (rien). Ce banc fait rouler un pilote qui ne sait que lire la consigne À
// L'ENDROIT DE SA VOITURE — il appuie hors zone, lève dans le rouge, et dans le pointillé appuie quand
// il est sous la vitesse cible — avec un retard de réaction (0, 150 et 300 ms) et sans jamais tenir un
// geste moins de 80 ms. Il ne voit ni la courbure, ni l'adhérence, ni la glisse : si le guide ment, il
// sort.
//
// On relève, sur le deuxième tour et les suivants : les sorties de piste, le meilleur tour et le tour
// moyen (en somme sur les circuits), et l'écart au fantôme de l'entraînement, qui roule en même temps.
// Le dernier argument essaie d'autres réglages du guide sans toucher au code. Graine fixe.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = path.join(__dirname, '..');
const c = vm.createContext({ Math: Object.create(Math), console, Date, Float32Array, Float64Array, Uint8Array, Uint16Array, Uint32Array, Int32Array });
vm.runInContext(['util', 'traces', 'tracks', 'track', 'cars', 'car', 'race'].map(f => fs.readFileSync(path.join(R, 'js', f + '.js'), 'utf8')
  .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '')).join('\n') + '\nthis.__T = { TRACKS, Race, GUIDE, GUIDE_GAZ, GUIDE_DOSE, GUIDE_LEVE, categoryOfModel };', c);
const { TRACKS, Race, GUIDE, GUIDE_GAZ, GUIDE_DOSE, categoryOfModel } = c.__T;
const cars = (process.argv[2] || 'lotus79,962,m1procar').split(',');
const tracks = (process.argv[3] || 'monza,spa,suzuka,silverstone,zandvoort,monaco').split(',');
const TOURS = +process.argv[4] || 4;
if (process.argv[5]) Object.assign(GUIDE, JSON.parse(process.argv[5]));
console.log('guide : ' + JSON.stringify(GUIDE));
console.log('retard  voiture     sorties  tours  meilleur tour (somme)  tour moyen   fantôme (meilleur)   écart au fantôme   part du tour : gaz / dose / levé');
for (const retard of [0, 0.15, 0.3]) for (const car of cars) {
  let sorties = 0, boucles = 0, best = 0, moy = 0, fant = 0; const part = [0, 0, 0];
  for (const tid of tracks) {
    let seed = 4242; c.Math.random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
    const r = new Race({ trackDef: TRACKS.find(t => t.id === tid), classId: categoryOfModel(car).id, modelId: car, mode: 'timetrial', entrainement: true });
    const p = r.player, file = [];
    let geste = 0, tenu = 0;
    while (p.lap < TOURS && r.time < 900) {
      let voulu = 0;
      if (r.state === 'racing') {
        const G = r.guide();
        voulu = G.maintenant === GUIDE_GAZ ? 1 : G.maintenant === GUIDE_DOSE ? (p.v < G.cibles[0] - 0.3 ? 1 : 0) : 0;
        if (p.lap >= 1) part[G.maintenant]++;
      }
      // le retard de réaction, puis la main : aucun geste tenu moins de 80 ms
      file.push(voulu);
      const lu = file.length > Math.round(retard / r.dt) ? file.shift() : 0;
      tenu += r.dt;
      if (lu !== geste && tenu >= 0.08) { geste = lu; tenu = 0; }
      r.update(r.dt, { throttle: r.state === 'racing' ? geste : 0, sel: 0 });
    }
    const lt = p.lapTimes.slice(1, TOURS), lf = r.fantome.lapTimes.slice(1);
    sorties += p.crashes || 0; boucles += lt.length;
    if (lt.length) { best += Math.min(...lt); moy += lt.reduce((a, b) => a + b, 0) / lt.length; }
    if (lf.length) fant += Math.min(...lf);
  }
  const tot = part[0] + part[1] + part[2] || 1;
  console.log(String(retard * 1000 + ' ms').padEnd(7), car.padEnd(12), String(sorties).padStart(6), String(boucles).padStart(6), best.toFixed(1).padStart(14), moy.toFixed(1).padStart(20), fant.toFixed(1).padStart(14),
    ((best / fant - 1) * 100).toFixed(1).padStart(16) + ' %', '   ' + part.map(x => Math.round(100 * x / tot) + ' %').join(' / '));
}
