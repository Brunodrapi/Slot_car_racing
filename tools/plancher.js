// Le plancher : le tour le plus rapide qu'un couple circuit/voiture peut physiquement produire.
//
//   node tools/plancher.js [--tours=4] [--marge=0.15] [--sortie=supabase/planchers.sql]
//
// C'est la pièce qui permet au serveur de refuser un tour en une milliseconde. Elle est MESURÉE et
// non devinée, pour une raison simple : un plancher inventé est soit trop haut — et il refuse les
// tours d'un très bon joueur, ce qui est pire que de laisser passer un tricheur — soit trop bas, et
// il ne refuse rien. Aucun des deux ne se voit avant que quelqu'un s'en plaigne.
//
// Deux bornes sont calculées, et on garde la plus haute :
//
//   1. LA BORNE PHYSIQUE : longueur / vitesse de pointe. Une voiture ne peut pas boucler plus vite
//      qu'en roulant à fond partout, freinages et virages compris. Elle est incontestable et ne
//      peut JAMAIS refuser un tour réel. Elle est aussi très large : sur un tracé sinueux elle vaut
//      la moitié d'un vrai tour.
//
//   2. LA BORNE MESURÉE : le meilleur tour de l'IA en « cauchemar », qui triche déjà de 30 %
//      d'adhérence et roule donc plus vite qu'un humain ne le peut, moins une marge.
//
// La marge est le seul réglage arbitraire de ce fichier, et il est explicite. Quinze pour cent est
// un écart qu'aucun pilote ne prend sur une IA qui a déjà 30 % d'adhérence en plus.
//
// LE PILOTAGE. `playerAI` ne fait choisir à la machine que la LIGNE, jamais les gaz : la voiture du
// joueur prend toujours son accélérateur de l'entrée. Une première version du banc s'en est remise
// à ce seul réglage et a regardé douze circuits sans qu'une voiture démarre — puis a écrit ses 108
// planchers comme si de rien n'était, tous tombés sur la borne physique. Le banc calcule donc
// `aiThrottle` lui-même et le passe en entrée, comme le font les autres bancs de ce dossier ; et il
// REFUSE d'écrire quoi que ce soit si la mesure n'a pas eu lieu.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');

const arg = (n, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.split('=')[1] : d;
};
const TOURS = Math.max(2, +arg('tours', 4));
const MARGE = +arg('marge', 0.15);
/* Combien de fois on rejoue chaque couple, et pourquoi plus d'une.

Le pilote automatique part avec un décalage tiré au hasard (`aiTimer`) et porte un bruit de
conduite : deux exécutions du MÊME code ne donnent donc pas le même tour. Mesuré sur les 108
couples, l'écart entre deux exécutions vaut 0,34 % en médiane mais monte à 7,4 % — sur une marge de
15 %, c'est la moitié de la marge mangée par le hasard. Un plancher tiré d'une exécution malheureuse
est trop haut, et un plancher trop haut REFUSE UN TOUR LÉGITIME, ce que ce fichier existe
précisément pour éviter.

On garde donc le meilleur tour de plusieurs essais : le plancher doit passer sous tout ce qui est
atteignable, pas sous ce qu'on a observé un jour donné. */
const ESSAIS = Math.max(1, +arg('essais', 3));
const SORTIE = arg('sortie', 'supabase/planchers.sql');

let src = '';
for (const f of ['util', 'traces', 'tracks', 'track', 'cars', 'car', 'race']) {
  src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8')
    .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
}

src += `
const cat = playableCategories()[0];
const voitures = modelsOf(cat.id);
const resultats = [];
for (const td of TRACKS) {
  for (const m of voitures) {
    let best = null, tours = 0, sorties = 0;
    for (let essai = 0; essai < ESSAIS; essai++) {
      const race = new Race({ trackDef: td, classId: cat.id, modelId: m.id, difficulty: 'cauchemar',
                              playerAI: true, playerLivery: 0, nCars: 1, mode: 'timetrial', laps: 99 });
      const p = race.player;
      // les gaz de l'IA, calculés ici : la voiture du joueur ne les reçoit que de l'entrée
      const thr = () => aiThrottle(p, race.cars, race.dt, race.difficulty);
      let pas = 0;
      const MAX = Math.round(60 * 60 * 12 / race.dt / 60);     // douze minutes de jeu, en pas
      while (p.lap < TOURS && pas++ < MAX && race.state !== 'finished') race.update(race.dt, thr());
      if (p.bestLapBrut != null && (best == null || p.bestLapBrut < best)) best = p.bestLapBrut;
      tours = Math.max(tours, p.lap); sorties += p.crashes;
    }
    const p = { bestLapBrut: best, lap: tours, crashes: sorties };
    resultats.push({ circuit: td.id, nomC: td.name, len: td.length,
                     voiture: m.id, nomV: m.name, vmax: m.perf.vmax,
                     /* « bestLapBrut » et non « bestLap » : le plancher doit être le temps le plus bas
                     que la physique autorise, coupes comprises. Depuis qu'une sortie de piste annule
                     le tour, l'IA en cauchemar — qui sort au moins une fois par tour — ne rendait
                     plus aucun tour propre, et les 108 planchers seraient tous retombés sur la borne
                     physique, deux fois trop basse pour refuser quoi que ce soit. */
                     best: p.bestLapBrut, tours: p.lap, sorties: p.crashes });
  }
}
OUT.resultats = resultats;
OUT.voitures = voitures.map(m => m.name);
`;

const OUT = {};
/* UN HASARD REPRODUCTIBLE. `Math.random` sert au décalage de départ du pilote et à son bruit de
conduite. Laissé au hasard du système, le fichier produit change à chaque exécution et deux mesures
ne se comparent plus — c'est ce qui a fait passer une régression pour un bruit, et un bruit pour une
régression. La graine est fixe et affichée : on peut la changer pour vérifier qu'un résultat ne tient
pas à elle. */
const GRAINE = +arg('graine', 20261002);
let _x = GRAINE >>> 0;
const alea = () => { _x = (Math.imul(_x, 1664525) + 1013904223) >>> 0; return _x / 4294967296; };
const MathFixe = Object.create(Math);
MathFixe.random = alea;
vm.runInNewContext(src, { OUT, TOURS, ESSAIS, console, performance: { now: () => Date.now() },
                          Math: MathFixe, JSON, Date });

const lignes = [];
let muets = 0;
console.log(`\n  ${OUT.voitures.length} voitures × ${OUT.resultats.length / OUT.voitures.length} circuits`
  + ` · ${TOURS} tours · ${ESSAIS} essai(s) · marge ${(MARGE * 100).toFixed(0)} %`
  + ` · graine ${GRAINE}\n`);
let circuit = null;
for (const r of OUT.resultats) {
  const physique = r.len / (r.vmax / 3.6);
  // il faut au moins DEUX tours : le premier part de l'arrêt et ne dit rien de la vitesse de croisière
  const mesure = r.best != null && r.tours >= 2 ? r.best * (1 - MARGE) : null;
  if (mesure == null) muets++;
  const plancher = Math.max(physique, mesure || 0);
  lignes.push({ ...r, physique, mesure, plancher });
  if (circuit !== r.circuit) {
    if (circuit) console.log('');
    process.stdout.write(`  ${r.nomC.padEnd(20)}`);
    circuit = r.circuit;
  }
  process.stdout.write(r.best == null ? '  ---  ' : ` ${r.best.toFixed(1)} `);
}
console.log('\n');

/* Rien de mesuré = rien d'écrit. C'est le seul garde-fou qui compte ici.
   Un fichier de planchers tous tombés sur la borne physique a l'air d'un fichier de planchers, il
   s'applique sans broncher, et il n'arrête aucun tricheur — on ne s'en aperçoit jamais. */
if (muets) {
  console.log(`  ÉCHEC : ${muets} couple(s) sur ${lignes.length} n'ont pas boucle ${TOURS} tours.`);
  console.log('  Aucun fichier ecrit : un plancher non mesure n\'arrete personne.');
  process.exit(1);
}

const pires = [...lignes].sort((a, b) => (a.plancher / a.best) - (b.plancher / b.best)).slice(0, 3);
console.log('  les trois planchers les plus serres, en part du meilleur tour de l\'IA :');
for (const l of pires) {
  console.log(`    ${l.nomC.padEnd(20)} ${l.nomV.padEnd(16)} tour ${l.best.toFixed(2)} s`
    + ` → plancher ${l.plancher.toFixed(2)} s (${(l.plancher / l.best * 100).toFixed(0)} %)`
    + (l.plancher === l.physique ? '  ← borne physique' : ''));
}

const sql = `-- Les planchers, MESURÉS par tools/plancher.js — ne pas écrire à la main.
--
-- Chacun est le plus haut de deux bornes : la borne physique (longueur / vitesse de pointe, qu'une
-- voiture ne peut pas franchir même à fond partout) et le meilleur tour de l'IA en « cauchemar »,
-- qui triche déjà de 30 % d'adhérence, moins ${(MARGE * 100).toFixed(0)} % de marge pour les très bons joueurs.
--
-- Regénérer après tout changement de physique, de voiture ou de tracé : un plancher qui décrit
-- l'ancienne version du jeu refuse des tours réels ou laisse passer des tours impossibles.
insert into public.planchers (circuit, voiture, minimum) values
${lignes.map((l) => `  ('${l.circuit}', '${l.voiture}', ${l.plancher.toFixed(3)})`).join(',\n')}
on conflict (circuit, voiture) do update set minimum = excluded.minimum;
`;
fs.writeFileSync(path.join(__dirname, '..', SORTIE), sql);
console.log(`\n  ${lignes.length} planchers ecrits dans ${SORTIE}`);
