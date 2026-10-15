/* Se relancer depuis le bas-côté : la voiture est-elle tankée ?

Ce banc existe à cause d'une régression que j'ai livrée. Le plafond de motricité se calcule sur
l'adhérence du moment, et hors piste elle tombe à 42 % : la poussée était donc divisée par deux au
moment précis où il faut s'extraire, en plus de la traînée de l'herbe qui punit déjà. Dix secondes
pour revenir à 60 km/h contre quatre. Le constat est de Bruno — « en sortie de piste la voiture est
tankée » — et il a fallu le mesurer pour voir l'ampleur.

Il compare les neuf voitures avec et sans le modèle. Hors piste, les deux colonnes doivent se
ressembler : le bas-côté a ses propres punitions, le modèle de motricité n'a rien à y ajouter.

PREMIÈRE VERSION DU BANC FAUSSE, et elle annonçait « 0,01 s » et « NaN m ». Je montais les
constantes dans la machine virtuelle par concaténation de texte, et je passais la CHAÎNE
« 1.25, 0.15 » comme un seul argument : `PHYS.patine` valait `undefined`, tout devenait NaN, et la
boucle `while (v < 60)` sortait à la première image parce qu'une comparaison avec NaN est fausse.
J'ai failli rapporter un NaN du jeu qui n'existait pas.

  node tools/herbe.js
*/
const fs = require('fs'), vm = require('vm');
let src = '';
for (const f of ['util', 'traces', 'tracks', 'track', 'cars', 'car', 'race']) {
  src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8')
    .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
}
src += [
"/* Se relancer depuis l'herbe : combien de temps pour revenir a 60 km/h, plein gaz ? */",
"const CAS = [['modele actif', 1.25, 0.15], ['neutre', 99, 0]];",
"console.log('voiture        ' + CAS.map(c => (c[0]).padStart(22)).join(''));",
"console.log('               ' + CAS.map(() => '   0→60 km/h   metres').join(''));",
"for (const m of modelsOf('gt')) {",
"  const l = [];",
"  for (const cas of CAS) {",
"    PHYS.motricite = cas[1]; PHYS.drivePriority = cas[2];",
"    const td = TRACKS.find(x => x.id === 'monza');",
"    const race = new Race({ trackDef: td, classId: 'gt', modelId: m.id, difficulty: 'medium',",
"                            playerAI: false, playerLivery: 0, nCars: 1, mode: 'timetrial' });",
"    const p = race.player;",
"    // on le pose LARGEMENT hors piste, a l'arret",
"    const hw = race.track.hwLeftAt(0);",
"    p.place(0, hw + 6, 0);",
"    let t = 0, d0 = p.x, dy = p.y;",
"    while (p.v * 3.6 < 60 && t < 30) { p.update(1/120, true, t); t += 1/120; }",
"    l.push([t, Math.hypot(p.x - d0, p.y - dy)]);",
"  }",
"  console.log(m.name.padEnd(15) + l.map(x => (x[0] >= 30 ? 'jamais' : x[0].toFixed(2) + ' s').padStart(13)",
"    + (x[0] >= 30 ? '  —' : x[1].toFixed(0) + ' m').padStart(9)).join(''));",
"}",
].join('\n');
vm.runInNewContext(src, { Math, console, Date, ARGS: [] }, { filename: 'herbe' });
