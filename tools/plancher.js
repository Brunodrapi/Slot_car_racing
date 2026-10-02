// Le plancher : le tour le plus rapide qu'un couple circuit/voiture peut physiquement produire.
//
//   node tools/plancher.js [--tours=4] [--essais=3] [--plancher=30]
//
// IL NE PRODUIT PLUS DE FICHIER. Le serveur refuse tout temps sous trente secondes, pour tous les
// circuits et toutes les voitures — un seul nombre, écrit dans `supabase/functions/record/index.ts`.
// Il y avait avant une table de cent huit minimums mesurés, un par couple : plus juste, et à refaire
// pendant vingt-cinq minutes après tout changement de tracé, de physique ou de voiture.
//
// Ce banc sert donc à VÉRIFIER cette constante, ce qui est le seul travail qui reste : il mesure les
// cent huit couples et dit de combien le plus rapide passe au-dessus. Tant que la marge est large,
// trente secondes ne refuseront jamais un tour réel — le seul défaut qu'un plancher ne doit pas
// avoir. Si elle se resserre, c'est que le jeu a changé au point qu'il faut rouvrir la question.
//
// Deux bornes sont calculées pour chaque couple, et on garde la plus haute :
//
//   1. LA BORNE PHYSIQUE : longueur / vitesse de pointe. Une voiture ne peut pas boucler plus vite
//      qu'en roulant à fond partout, freinages et virages compris. Elle est incontestable.
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
// `aiThrottle` lui-même et le passe en entrée, comme le font les autres bancs de ce dossier.
'use strict';
const fs = require('fs'), vm = require('vm');

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
      /* Chaque couple repart de sa propre graine. Un seul flux de hasard pour les 108 mesures les
      rendait solidaires : changer le tracé de Monza décalait le tirage de tous les circuits suivants,
      et leurs planchers bougeaient sans que leur géométrie ait bougé d'un millimètre. On ne pouvait
      alors plus lire ce fichier — 106 lignes sur 108 changées ne disaient RIEN sur ce qui avait
      changé. Regrainé par couple, un plancher ne dépend que de son circuit et de sa voiture. */
      REGRAINE(td.id + '|' + m.id + '|' + essai);
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
const regraine = (cle) => {               // FNV-1a sur la clé du couple, mêlée à la graine du banc
  let h = 2166136261 >>> 0;
  for (let i = 0; i < cle.length; i++) { h ^= cle.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  _x = (h ^ (GRAINE >>> 0)) >>> 0;
  for (let i = 0; i < 8; i++) alea();      // on jette les premiers tirages, trop proches de la graine
};
const MathFixe = Object.create(Math);
MathFixe.random = alea;
vm.runInNewContext(src, { OUT, TOURS, ESSAIS, REGRAINE: regraine, console, performance: { now: () => Date.now() },
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

/* Rien de mesuré = rien de vérifié. C'est le seul garde-fou qui compte ici.
   Un banc dont aucune voiture n'a bouclé rend des bornes physiques, qui ont l'air de résultats et
   ne disent rien : on l'a déjà vu passer inaperçu une fois. */
if (muets) {
  console.log(`  ECHEC : ${muets} couple(s) sur ${lignes.length} n'ont pas boucle ${TOURS} tours.`);
  console.log('  Rien n\'est verifie : un couple qui ne roule pas ne dit rien sur ce qui est atteignable.');
  process.exit(1);
}

const pires = [...lignes].sort((a, b) => (a.plancher / a.best) - (b.plancher / b.best)).slice(0, 3);
console.log('  les trois planchers les plus serres, en part du meilleur tour de l\'IA :');
for (const l of pires) {
  console.log(`    ${l.nomC.padEnd(20)} ${l.nomV.padEnd(16)} tour ${l.best.toFixed(2)} s`
    + ` → plancher ${l.plancher.toFixed(2)} s (${(l.plancher / l.best * 100).toFixed(0)} %)`
    + (l.plancher === l.physique ? '  ← borne physique' : ''));
}

const PLANCHER = +arg('plancher', 30);
const bas = [...lignes].sort((a, b) => a.plancher - b.plancher);
const mini = bas[0];
console.log(`\n  le couple le plus rapide : ${mini.nomC} en ${mini.nomV}, plancher ${mini.plancher.toFixed(1)} s`);
console.log(`  le serveur refuse sous ${PLANCHER} s — marge ${((mini.plancher / PLANCHER - 1) * 100).toFixed(0)} %`);
if (mini.plancher < PLANCHER) {
  console.log(`\n  ECHEC : un tour de ${mini.plancher.toFixed(1)} s est atteignable, et le serveur le refuserait.`);
  console.log('  Un plancher trop haut refuse un tour legitime, ce qui est pire que de laisser passer un triche.');
  process.exit(1);
}
console.log('\n  les cinq couples les plus rapides :');
for (const l of bas.slice(0, 5)) {
  console.log(`    ${l.nomC.padEnd(20)} ${l.nomV.padEnd(16)} ${l.plancher.toFixed(1)} s`
    + (l.plancher === l.physique ? '  ← borne physique' : ''));
}
