// Ce que coûte un arrêt au stand, et s'il vaut la peine.
//
//   node tools/stands.js [circuit|all] [catégorie]
//
// Un arrêt n'est un CHOIX que si le compte est serré. Trop court, il n'y a aucune raison de ne pas
// s'arrêter à chaque tour ; trop long, aucune de s'arrêter. Ce qui se mesure ici est donc le seul
// chiffre qui décide : combien de secondes il prend, comparé à ce que des pneus neufs rendent.
//
// Trois choses, dont deux sont des pièges :
//
// 1. Le coût réel. Le tour où l'on s'arrête, comparé au même tour sans s'arrêter, même voiture,
//    même circuit, même état de départ.
// 2. Que la voie ne soit pas un RACCOURCI. Elle coupe par l'extérieur ; sans limitation de vitesse
//    elle irait plus vite que la piste, et tout le monde y passerait à chaque tour sans s'arrêter.
//    On mesure donc aussi le tour d'une voiture qui traverse la voie sans s'y arrêter.
// 3. Qu'on ressorte. Une voiture qui se fait servir et reste bloquée dans la case, ou qui ressort
//    en marche arrière, ne se verrait qu'en jouant.
const fs = require('fs'), vm = require('vm');
const ARGS = process.argv.slice(2);

let src = '';
for (const f of ['util', 'traces', 'tracks', 'track', 'cars', 'car', 'race']) {
  src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8')
    .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
}

src += `
const which = ARGS[0] || 'all', catId = ARGS[1] || 'gt';
const L = [];
const tot = { cout: [], detour: [], rendu: [] };

for (const td of TRACKS) {
  if (which !== 'all' && td.id !== which) continue;

  /* Trois passages sur le même circuit, la même voiture, le même état de gomme au départ :
     « droit » ne touche pas aux stands, « traverse » passe par la voie sans s'arrêter, « arrêt »
     s'y arrête. Seul ce qui diffère entre les trois est attribuable à la voie. */
  const essai = (quoi) => {
    const r = new Race({
      trackDef: td, classId: catId, difficulty: 'medium', playerAI: true, playerLivery: 0,
      nCars: 1, roster: makeRoster(1, 0, 12345, catId), laps: 4, wear: true, mode: 'race',
    });
    const p = r.player;
    p.tyre = 0.25;
    const tours = [];
    let lap = p.lap, dernier = 0, demande = false, vFin = null;
    while (r.state !== 'finished' && r.time < 900) {
      if (quoi !== 'droit' && p.lap === 2 && !demande) { p.pitAsk = true; demande = true; }
      if (quoi === 'traverse' && p.pitState === 'voie') { p.pitAsk = true; p.pitServi = true; }
      const thr = aiThrottle(p, r.cars, r.dt, { marginBase: 0.96, marginSpread: 0 });
      r.update(r.dt, thr);
      if (p.lap > lap) { lap = p.lap; tours.push({ n: lap, t: r.time - dernier, pit: p.pitsDone }); dernier = r.time; }
      if (p.pitsDone > 0 && vFin === null && !p.pitState) vFin = p.v;
    }
    return { tours, arrets: p.pitsDone, vFin, pneu: p.tyre };
  };

  const droit = essai('droit'), trav = essai('traverse'), stop = essai('arret');
  const tour = (e, n) => { const x = e.tours.find(y => y.n === n); return x ? x.t : null; };
  /* On somme les tours 3 ET 4, on ne lit pas le tour 3 seul.

  La ligne d'arrivée tombe AU MILIEU de la voie des stands — la zone d'arrêt est avant, la sortie
  après — donc le coût d'un passage se répartit sur deux tours, et pas de la même façon selon qu'on
  s'arrête ou non. Lu sur le seul tour 3, l'arrêt paraissait coûter +4,0 s quand la simple
  traversée en coûtait +18,8 : moins cher en s'arrêtant qu'en passant, ce qui est impossible. Ce
  n'était pas le jeu qui mentait, c'était la fenêtre de mesure. */
  const paire = (e) => { const a = tour(e, 3), b = tour(e, 4); return a != null && b != null ? a + b : null; };
  const pd = paire(droit), pt = paire(trav), ps = paire(stop);
  if (pd == null || pt == null || ps == null) continue;
  const cout = ps - pd, detour = pt - pd;
  // ce que les pneus neufs rendent, une fois le passage payé : le tour 4 seul, où les deux roulent
  const t4d = tour(droit, 4), t4s = tour(stop, 4);
  const rendu = t4d != null && t4s != null ? t4d - t4s : 0;
  tot.cout.push(cout); tot.detour.push(detour); tot.rendu.push(rendu);
  L.push(td.id.padEnd(13)
    // au moins un arrêt : l'IA peut en décider un second d'elle-même si la gomme retombe, et
    // exiger exactement un accusait à tort le Nürburgring et Le Mans, qui s'arrêtaient deux fois
    + ' arrêt ' + (stop.arrets >= 1 ? 'ok ' : 'RATÉ') + ' ×' + stop.arrets
    + ' | coût ' + (cout >= 0 ? '+' : '') + cout.toFixed(1) + ' s'
    + ' | détour sans arrêt ' + (detour >= 0 ? '+' : '') + detour.toFixed(1) + ' s'
    + ' | tour suivant ' + (rendu >= 0 ? '−' : '+') + Math.abs(rendu).toFixed(1) + ' s'
    + ' | ressort à ' + (stop.vFin == null ? '—' : stop.vFin.toFixed(0) + ' m/s'));
}
const moy = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
L.push('');
L.push('moyennes : coût ' + moy(tot.cout).toFixed(1) + ' s'
  + ' | détour ' + moy(tot.detour).toFixed(1) + ' s (doit être > 0, sinon la voie est un raccourci)'
  + ' | gain au tour suivant ' + moy(tot.rendu).toFixed(1) + ' s');
L.push('remboursement en ' + (moy(tot.rendu) > 0.05 ? (moy(tot.cout) / moy(tot.rendu)).toFixed(1) + ' tours' : 'JAMAIS — les pneus neufs ne rendent rien'));
OUT = L.join(String.fromCharCode(10));
`;

const ctx = { console, Math, JSON, Object, Array, Float32Array, Date, ARGS, OUT: '' };
vm.runInNewContext(src, ctx, { filename: 'stands' });
console.log(ctx.OUT);
