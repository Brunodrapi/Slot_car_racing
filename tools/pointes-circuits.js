// Mesure sur un tour lancé en contre-la-montre avec la physique et le compteur du jeu.
// node tools/pointes-circuits.js > pointes.json
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sources = ['util', 'traces', 'tracks', 'track', 'cars', 'car', 'race'].map(nom =>
  fs.readFileSync(path.join(__dirname, '../js', nom + '.js'), 'utf8').replace(/^if \(typeof module[^\n]*/gm, ''));
const { Race, TRACKS, MODELS, aiThrottle } = vm.runInThisContext(
  '(function(){' + sources.join('\n') + '\nreturn {Race,TRACKS,MODELS,aiThrottle};})()');

function mesure(def, modele) {
  let graine = 42761;
  Math.random = () => {
    graine ^= graine << 13; graine ^= graine >>> 17; graine ^= graine << 5;
    return (graine >>> 0) / 4294967296;
  };
  const course = new Race({trackDef:def, modelId:modele.id, nCars:1, mode:'timetrial', playerAI:true});
  const piste = course.track, voiture = course.player;
  let depart = 0, longueur = 0;
  for (let i = 0; i < piste.corners.length; i++) {
    const fin = piste.corners[i].to * piste.ds;
    const ecart = piste.wrap(piste.corners[(i+1) % piste.corners.length].from * piste.ds - fin);
    if (ecart > longueur) { depart = fin; longueur = ecart; }
  }
  // Le premier tour complet sert à prendre de la vitesse avant la fenêtre de mesure.
  let maximum = 0;
  while (voiture.lap < 2 && course.time < 480) {
    course.update(course.dt, aiThrottle(voiture, course.cars, course.dt, {marginBase:.98, marginSpread:0}));
    if (voiture.lap === 1 && piste.wrap(voiture.s - depart) <= longueur && voiture.lat <= piste.hwLeftAt(voiture.s) && voiture.lat >= -piste.hwRightAt(voiture.s))
      maximum = Math.max(maximum, voiture.speed * 3.6);
  }
  if (voiture.lap < 2 || !maximum) throw Error(def.id + ' / ' + modele.id + ' : mesure incomplète');
  return maximum;
}

const bilan = {};
for (const def of TRACKS) {
  let meilleur = null;
  for (const modele of MODELS) {
    const kmh = mesure(def, modele);
    if (!meilleur || kmh > meilleur.kmh) meilleur = { kmh, voiture:modele.id };
  }
  bilan[def.id] = { kmh:Math.round(meilleur.kmh), voiture:meilleur.voiture };
  console.error(def.id, bilan[def.id]);
}
console.log(JSON.stringify(bilan, null, 2));
