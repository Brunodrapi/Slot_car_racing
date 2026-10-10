/* Combien de temps deux voitures restent-elles collées l'une à l'autre, et à quelle vitesse ?

Ce banc existe parce que la moyenne ne voit pas le problème. Un peloton se frotte des centaines de
fois par minute, presque toujours pendant une seule image, et la moyenne de tout ça est anodine. Ce
que le joueur sent, c'est la queue de la distribution : cinq fois par course, deux voitures se
coincent et restent coincées plusieurs secondes. Il faut donc compter les ÉPISODES et regarder leur
durée, pas leur nombre.

Il refait la même géométrie que `resolveCollisions`, sur l'état d'après l'image, et distingue comme
elle le chevauchement nez-à-queue du chevauchement de flanc. Un épisode est une suite d'images où
une voiture touche quelqu'un par le flanc ; on retient sa durée, la vitesse à l'entrée, la vitesse
minimale atteinte dedans, et la dérive maximale — c'est cette dernière qui dit si le blocage se
nourrit lui-même, parce qu'une voiture en travers n'a plus l'adhérence qu'il lui faudrait pour
s'extraire.

  node tools/frottement.js [circuits séparés par des virgules] [difficulté] [classe]
*/
const fs = require('fs'), vm = require('vm');
let src = '';
for (const f of ['util', 'traces', 'tracks', 'track', 'cars', 'car', 'race']) {
  src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8')
    .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
}
src += `
const PISTES = (ARGS[0] || 'zandvoort,suzuka,silverstone,monza').split(',');
const DIFF = ARGS[1] || 'medium', CLASSE = ARGS[2] || 'gt';
const SEAUX = [0.25, 1, 2, 4, 8, 1e9], ETIQ = ['1 image', '< 1s', '< 2s', '< 4s', '< 8s', '>= 8s'];
const longs = [];
let nC = 0, nL = 0, vC = 0, vL = 0, bC = 0, bL = 0, nez = 0, images = 0, voitures = 0;
const hist = SEAUX.map(() => 0);
const tours = [];
for (const id of PISTES) {
  const td = TRACKS.find(t => t.id === id);
  if (!td) { console.log('circuit inconnu : ' + id); continue; }
  const race = new Race({ trackDef: td, classId: CLASSE, difficulty: DIFF, playerAI: true, playerLivery: 0, nCars: 8 });
  const T = race.track, ep = new Map();
  for (const c of race.cars) ep.set(c, null);
  while (race.state !== 'finished' && race.time < 400) {
    race.update(race.dt, aiThrottle(race.player, race.cars, race.dt, { marginBase: 0.9, marginSpread: 0 }));
    if (race.state !== 'racing') continue;
    images++; voitures = race.cars.length;
    const en = new Set();
    for (let i = 0; i < race.cars.length; i++) for (let j = i + 1; j < race.cars.length; j++) {
      const a = race.cars[i], b = race.cars[j];
      if (a.inPit || b.inPit) continue;
      const d = T.diff(a.s, b.s), lenSum = (a.cls.length + b.cls.length) / 2;
      if (Math.abs(d) >= lenSum) continue;
      const dl = b.lat - a.lat, wSum = (a.cls.width + b.cls.width) / 2;
      if (Math.abs(dl) >= wSum) continue;
      if (lenSum - Math.abs(d) < (wSum - Math.abs(dl)) * 2.2) { nez += 2; continue; }
      en.add(a); en.add(b);
    }
    for (const c of race.cars) {
      const beta = Math.abs(c.beta) * 180 / Math.PI;
      if (en.has(c)) { nC++; vC += c.v; bC += beta; } else { nL++; vL += c.v; bL += beta; }
      let e = ep.get(c);
      if (en.has(c)) {
        if (!e) { e = { piste: id, v0: c.v, vmin: c.v, n: 0, bmax: 0 }; ep.set(c, e); }
        e.n++; if (c.v < e.vmin) e.vmin = c.v; if (beta > e.bmax) e.bmax = beta;
      } else if (e) {
        e.v1 = c.v;
        hist[SEAUX.findIndex(s => e.n / 60 < s)]++;
        if (e.n >= 60) longs.push(e);
        ep.set(c, null);
      }
    }
  }
  for (const c of race.cars) if (c.bestLap) tours.push(c.bestLap);
}
longs.sort((a, b) => b.n - a.n);
console.log('BLOCAGES DE PLUS D\\'UNE SECONDE  (ils sortent par paires de même durée : c\\'est mutuel)');
if (!longs.length) console.log('  aucun');
else {
  console.log('  piste         durée   v entrée   v mini   v sortie   dérive max');
  for (const e of longs.slice(0, 16))
    console.log('  ' + e.piste.padEnd(13) + (e.n / 60).toFixed(2).padStart(5) + 's'
      + (e.v0 * 3.6).toFixed(0).padStart(8) + ' km/h' + (e.vmin * 3.6).toFixed(0).padStart(8)
      + (e.v1 * 3.6).toFixed(0).padStart(10) + '      ' + e.bmax.toFixed(1).padStart(5) + '°');
  if (longs.length > 16) console.log('  … et ' + (longs.length - 16) + ' autres');
}
console.log('\\nDURÉE DES ÉPISODES DE FLANC');
for (let i = 0; i < hist.length; i++) console.log('  ' + ETIQ[i].padEnd(9) + String(hist[i]).padStart(7));
console.log('\\nBILAN');
console.log('  temps passé flanc contre flanc   ' + (100 * nC / (images * voitures)).toFixed(1) + ' %');
console.log('  blocages >= 1s                   ' + longs.length + '  (plus long ' + (longs.length ? (longs[0].n / 60).toFixed(1) : 0) + 's)');
console.log('  vitesse   au contact / libre     ' + (vC / Math.max(1, nC) * 3.6).toFixed(1) + ' / ' + (vL / nL * 3.6).toFixed(1) + ' km/h');
console.log('  dérive    au contact / libre     ' + (bC / Math.max(1, nC)).toFixed(2) + ' / ' + (bL / nL).toFixed(2) + ' °');
console.log('  images nez-à-queue               ' + nez);
console.log('  meilleur tour moyen              ' + (tours.reduce((a, b) => a + b, 0) / tours.length).toFixed(2) + ' s');
`;
vm.runInNewContext(src, { Math, console, ARGS: process.argv.slice(2), Date }, { filename: 'frottement' });
