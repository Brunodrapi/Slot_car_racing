// La voiture qui glisse : se rattrape-t-elle, ou court-elle après sa ligne jusqu'au tête-à-queue ?
//
//   node tools/glissade-banc.js                    # le code du dépôt
//   node tools/glissade-banc.js --racine=<dossier>  # un autre état du dépôt, pour comparer
//
// Le pilote automatique conduit la voiture du joueur, aimant coupé (le réglage par défaut), sur
// six circuits et dans les trois catégories, deux tours chacun. Deux allures : à la limite que
// l'adhérence permet (marge 1,00), et trop vite (marge 1,15) — celle qui met la voiture en
// glissade et montre comment elle en sort. Le hasard du pilote est tiré d'une graine fixe, pour que
// deux états du code se comparent sur les mêmes courses.
//
// Ce qui se compte : les sorties de piste, les tête-à-queue (dérive au-delà d'un radian), le temps
// total des tours bouclés et l'écart moyen à la ligne. Voir « GRIP — Garder le contrôle d'une
// voiture en dérapage » et le commentaire « EN GLISSADE, ON NE COURT PAS APRÈS LA LIGNE » de
// js/car.js.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const arg = process.argv.find((a) => a.startsWith('--racine='));
const ROOT = arg ? path.resolve(arg.slice(9)) : path.join(__dirname, '..');

let src = '';
for (const f of ['util', 'traces', 'tracks', 'track', 'cars', 'car', 'race'])
  src += fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8').replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
src += `
const CIRCUITS = ['zandvoort', 'spa', 'monza', 'laguna', 'monaco', 'suzuka'];
const CATS_BANC = ['gt', 'proto', 'f1'];
function rouler(marge) {
  const r = { sorties: 0, tq: 0, tours: 0, temps: 0, e2: 0, n: 0 };
  for (const id of CIRCUITS) for (const cat of CATS_BANC) {
    const race = new Race({ trackDef: TRACKS.find((t) => t.id === id), classId: cat, difficulty: 'medium',
      playerAI: true, playerLivery: 0, nCars: 1, mode: 'timetrial' });
    const T = race.track, p = race.player;
    let travers = false, t0 = null;
    while (race.state !== 'finished' && race.time < 400 && p.lap < 3) {
      race.update(race.dt, aiThrottle(p, race.cars, race.dt, { marginBase: marge, marginSpread: 0, maxMargin: 2 }));
      if (race.state !== 'racing') continue;
      if (p.lap >= 1 && t0 == null) t0 = race.time;
      const e = p.lat - T.targetLat(p.s, p.selS); r.e2 += e * e; r.n++;
      if (Math.abs(p.beta) > 1) { if (!travers) r.tq++; travers = true; } else if (Math.abs(p.beta) < 0.3) travers = false;
    }
    r.sorties += p.crashes;
    if (p.lap >= 3) { r.tours++; r.temps += race.time - t0; }
  }
  return r;
}
for (const graine of [2, 3]) for (const marge of [1.0, 1.15]) {
  GRAINE(graine);
  const r = rouler(marge);
  console.log('graine ' + graine + '  marge ' + marge.toFixed(2) + '  | sorties ' + String(r.sorties).padStart(3)
    + '  tête-à-queue ' + String(r.tq).padStart(3) + '  | courses finies ' + r.tours + '/18  temps ' + r.temps.toFixed(1)
    + ' s  | écart rms à la ligne ' + Math.sqrt(r.e2 / Math.max(1, r.n)).toFixed(2) + ' m');
}
`;
// Le hasard du pilote (son bruit d'appréciation), tiré d'une graine : xorshift32.
const M = Object.create(Math);
let etat = 1;
M.random = () => { etat ^= etat << 13; etat >>>= 0; etat ^= etat >>> 17; etat ^= etat << 5; etat >>>= 0; return etat / 4294967296; };
const GRAINE = (g) => { etat = (g * 2654435761) >>> 0 || 1; };
vm.runInNewContext(src, { Math: M, GRAINE, console, Date }, { filename: 'glissade-banc' });
