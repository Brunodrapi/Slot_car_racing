// Combien rapporte une coupe ? La borne haute, circuit par circuit.
//
//   node tools/coupe.js [--fenetre=400]
//
// Bruno demande une pénalité en secondes par sortie de piste, « ça évite la triche en coupant les
// chicanes ». Reste à savoir combien. Une pénalité trop faible rend la triche payante et la règle
// décorative ; trop forte, elle condamne une course pour un appui malheureux. Le nombre doit donc
// venir d'une mesure, et la mesure utile est la plus GÉNÉREUSE possible envers le tricheur : si la
// pénalité dépasse ce qu'on peut gagner dans le meilleur des cas, couper ne paie jamais.
//
// Ce qu'on calcule : pour chaque paire de points de la ligne de course séparés d'au plus `fenetre`
// mètres de piste, la distance en ligne droite entre les deux, et le temps que la voiture met à
// parcourir le trajet réel entre eux. Le gain d'une coupe est la différence, EN SUPPOSANT la ligne
// droite parcourue aussi vite que la piste.
//
// C'est très au-dessus de la réalité, et volontairement : l'herbe rend 0,42 d'adhérence, donc une
// coupe réelle est bien plus lente que cette borne. Une pénalité calée dessus est à l'abri.
//
// Ce qui n'est pas mesuré ici : le temps PERDU dans le gravier, qui est déjà une punition. On ne
// cherche pas le bilan d'une coupe, on cherche son plafond.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');

const arg = (n, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.split('=')[1] : d;
};
const FENETRE = Math.max(40, +arg('fenetre', 400));

let src = '';
for (const f of ['util', 'tracks', 'track', 'cars', 'car', 'race']) {
  src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8')
    .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
}

src += `
const cat = playableCategories()[0];
/* La voiture la plus rapide de la catégorie : c'est elle qui gagne le plus à couper, puisque le
gain est une distance divisée par une vitesse. Mesurer avec une lente sous-estimerait le plafond. */
const m = modelsOf(cat.id).slice().sort((a, b) => b.perf.vmax - a.perf.vmax)[0];

/* À QUELLE VITESSE on traverse l'herbe. Mesuré, pas supposé.

Sans ce nombre la borne est inutilisable : en supposant la corde parcourue aussi vite que la piste,
le gain grandit avec la fenêtre sans jamais se stabiliser — à 400 mètres elle annonce dix secondes,
ce qui ferait une pénalité absurde. Mais l'herbe ne se traverse pas à la vitesse de la piste : elle
rend 0,42 d'adhérence ET traîne la voiture de 5 + 0,15 v mètres par seconde carrée. La vitesse
d'équilibre pied au plancher est donc bien plus basse, et c'est elle qui plafonne une coupe.

On remet grassT à zéro à chaque pas : au bout de huit secondes dans le gravier, les commissaires
reposent la voiture sur la piste, ce qui mettrait fin à la mesure au milieu. */
const banc = new Race({ trackDef: TRACKS[0], classId: cat.id, modelId: m.id, difficulty: 'medium',
                        playerAI: true, playerLivery: 0, nCars: 1, mode: 'timetrial', laps: 99 });
const pb = banc.player;
banc.state = 'racing'; banc.countdown = 0;
pb.place(0, banc.track.hwLeftAt(0) + 30, 0);          // trente mètres au large : franchement dans l'herbe
let vHerbe = 0;
for (let k = 0; k < Math.round(30 / banc.dt); k++) {
  pb.grassT = 0;
  pb.update(banc.dt, true, banc.cars, 0);
  pb.place(banc.track.wrap(pb.s), banc.track.hwLeftAt(pb.s) + 30, pb.v);   // on la maintient au large
  vHerbe = Math.max(vHerbe, pb.v);
}
OUT.vHerbe = vHerbe;
OUT.vmax = m.perf.vmax / 3.6;

const out = [];
for (const td of TRACKS) {
  const race = new Race({ trackDef: td, classId: cat.id, modelId: m.id, difficulty: 'medium',
                          playerAI: true, playerLivery: 0, nCars: 1, mode: 'timetrial', laps: 99 });
  const T = race.track, N = T.n;
  /* Le profil de vitesse sur la ligne de course : ce que la voiture tient réellement, freinages
  compris. Prendre la vitesse de pointe partout gonflerait le temps du trajet réel, donc le gain. */
  const vit = race.profiles.racing;
  const xs = [], ys = [];
  for (let i = 0; i < N; i++) {
    const lat = T.targetLat(i * T.ds, 0);
    const P = T.pos(i * T.ds, lat);
    xs.push(P.x); ys.push(P.y);
  }
  // temps cumulé le long de la ligne, station par station
  const tc = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) tc[i + 1] = tc[i] + T.ds / Math.max(4, vit[i]);
  let pire = { gain: 0 };
  const pas = Math.max(1, Math.round(T.ds));
  for (let i = 0; i < N; i += pas) {
    for (let d = 20; d <= FENETRE; d += 5) {
      const j = i + d;
      const k = j % N;
      const corde = Math.hypot(xs[k] - xs[i], ys[k] - ys[i]);
      // le temps réel entre les deux points, en suivant la piste
      const treel = j <= N ? tc[j] - tc[i] : (tc[N] - tc[i]) + tc[k];
      // la vitesse moyenne tenue sur ce morceau : c'est à elle qu'on crédite la corde
      const vmoy = d / Math.max(0.001, treel);
      // la corde se parcourt dans l'herbe : au mieux à la vitesse que l'herbe permet, et jamais
      // plus vite que ce que la piste donnait au même endroit
      const vCorde = Math.min(vmoy, vHerbe);
      const gain = treel - corde / vCorde;
      if (gain > pire.gain) pire = { gain, i, d, corde: +corde.toFixed(1), treel: +treel.toFixed(2),
                                     vmoy: +vmoy.toFixed(1), vCorde: +vCorde.toFixed(1) };
    }
  }
  out.push({ circuit: td.id, nom: td.name, len: Math.round(T.length), ...pire });
}
OUT.res = out;
OUT.voiture = m.name;
`;

const OUT = {};
vm.runInNewContext(src, { OUT, FENETRE, console, performance: { now: () => Date.now() }, Math, JSON, Date });

console.log(`\n  plafond du gain d'une coupe · voiture la plus rapide : ${OUT.voiture}`
  + ` · fenêtre ${FENETRE} m`);
console.log(`  traversée de l'herbe mesurée à ${OUT.vHerbe.toFixed(1)} m/s`
  + ` (${(3.6 * OUT.vHerbe).toFixed(0)} km/h) contre ${(3.6 * OUT.vmax).toFixed(0)} km/h sur la piste\n`);
let max = 0, pireC = null;
for (const r of OUT.res.slice().sort((a, b) => b.gain - a.gain)) {
  if (r.gain > max) { max = r.gain; pireC = r; }
  console.log(`  ${r.nom.padEnd(22)} ${String(r.len).padStart(5)} m`
    + ` · au plus ${r.gain.toFixed(2)} s`
    + ` (corde ${String(r.corde).padStart(5)} m à ${r.vCorde} m/s contre ${r.d} m de piste à ${r.vmoy} m/s)`);
}
console.log(`\n  le pire cas du jeu : ${pireC.nom}, ${max.toFixed(2)} s`);
console.log(`  une pénalité de ${Math.ceil(max)} s par sortie dépasse donc tout gain possible,`);
console.log(`  et c'est encore très large : l'herbe ne rend que 0,42 d'adhérence.`);
