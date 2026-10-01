// L'aller-retour du paquet : ce qu'on perd en le réduisant, et de combien il réduit.
//
//   node tools/paquet-banc.js [--circuits=tous]
//
// Un codec qui se trompe ne plante pas : il pose une voiture ailleurs. C'est le pire des défauts à
// trouver après coup, parce qu'il ressemble à un problème de réseau, de physique ou de rendu selon
// l'humeur de celui qui regarde. On l'éprouve donc là où il est encore isolable : un instantané
// entre, des octets sortent, on les relit, et on compare champ par champ.
//
// Ce qui est vérifié, et pourquoi chaque chose :
//
//   LA TAILLE. C'est la raison d'être du paquet. Mesurée sur de vraies courses, pas sur un
//   instantané fabriqué pour l'occasion.
//
//   L'ÉCART PAR CHAMP, en unités du jeu. Une quantification se juge en mètres et en radians, pas en
//   pourcentage : « 0,06 px » se compare au seuil de six mètres au-delà duquel l'invité repose la
//   voiture d'un coup, « 0,001 rad » à ce qu'un œil voit sur un cap.
//
//   LES CAS DE BORD. Une voiture loin hors du cadre du circuit, un tour très long, un meilleur
//   tour nul. Les bornes du codec doivent tenir sans déborder en silence — un entier qui boucle
//   rend une voiture à l'autre bout de la carte.
//
//   LE BLOC LENT. Le meilleur tour ne part qu'une image sur quinze. Les quatorze autres doivent
//   rendre la valeur retenue, et non zéro : sinon le chrono clignote.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');

let src = '';
for (const f of ['util', 'tracks', 'track', 'cars', 'car', 'race', 'paquet']) {
  src += fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')
    .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
}

src += `
const cat = playableCategories()[0];
const CHAMPS = ['x', 'y', 'cap', 'v', 'vl', 'w', 's', 'lat', 'tour', 'sel', 'selS', 'drapeaux', 'best', 'debut'];
const DIV = [100, 100, 1000, 100, 100, 1000, 100, 100, 1, 100, 100, 1, 1000, 100];
const UNITE = ['px', 'px', 'rad', 'm/s', 'm/s', 'rad/s', 'm', 'm', 'tour', '', '', '', 's', 's'];
const pire = CHAMPS.map(() => 0);
let nOctets = 0, nJson = 0, nSnap = 0, nCars = 0;
let garde = null;
for (const td of TRACKS) {
  const race = new Race({ trackDef: td, classId: cat.id, difficulty: 'cauchemar', playerAI: true,
                          playerLivery: 0, nCars: 10, mode: 'race', laps: 3 });
  const p = race.player;
  const thr = () => aiThrottle(p, race.cars, race.dt, race.difficulty);
  for (let i = 0; i < 60 * 60 * 3 && race.state !== 'finished'; i++) {
    race.update(race.dt, thr());
    if (i % 11) continue;
    const snap = race.snapshot(i);
    const oct = pqEncode(snap, race.track);
    const rel = pqDecode(oct, race.track, garde);
    if (!rel) { OUT.casse = 'decodage impossible a l image ' + i; break; }
    if (rel.lent) garde = rel.lent;
    nOctets += oct.length; nJson += JSON.stringify(snap).length; nSnap++;
    nCars = race.cars.length;
    // l'entete d'abord : une sequence ou un temps faux decalerait toute la course
    if ((rel.snap[0] & 0xffff) !== (snap[0] & 0xffff)) OUT.casse = 'sequence';
    if (rel.snap[1] !== snap[1]) OUT.casse = 'temps';
    if (rel.snap[2] !== snap[2]) OUT.casse = 'etat';
    /* Le meilleur tour et l'heure de début ne se comparent QUE sur les images qui les portent.

    Ils ne partent qu'une image sur quinze ; sur les quatorze autres, le décodeur rend délibérément
    la dernière valeur reçue. Les compter comme un écart de quantification faisait apparaître
    quatre-vingt-trois secondes d'erreur sur un codec qui n'en commet aucune : la mesure accusait
    le codec de ce que le protocole fait exprès. Le comportement du bloc lent a son propre essai. */
    const kMax = rel.lent ? 14 : 12;
    for (let c = 0; c < nCars; c++) {
      const o = 4 + c * 14;
      for (let k = 0; k < kMax; k++) {
        const d = Math.abs(rel.snap[o + k] - snap[o + k]) / DIV[k];
        if (d > pire[k]) pire[k] = d;
      }
    }
  }
  if (OUT.casse) break;
}
OUT.CHAMPS = CHAMPS; OUT.UNITE = UNITE; OUT.pire = pire;
OUT.nOctets = nOctets; OUT.nJson = nJson; OUT.nSnap = nSnap; OUT.nCars = nCars;

/* --- les cas de bord, fabriques a la main --- */
OUT.bords = [];
{
  const race = new Race({ trackDef: TRACKS[0], classId: cat.id, difficulty: 'medium', playerAI: true,
                          playerLivery: 0, nCars: 4, mode: 'race', laps: 3 });
  race.update(race.dt, true);
  const essai = (nom, modif) => {
    const snap = race.snapshot(7);
    modif(snap);
    const rel = pqDecode(pqEncode(snap, race.track, true), race.track, null);
    if (!rel) { OUT.bords.push({ nom, ok: false, quoi: 'decodage impossible' }); return; }
    const ecart = [];
    for (let c = 0; c < race.cars.length; c++) {
      const o = 4 + c * 14;
      for (let k = 0; k < 14; k++) ecart.push(Math.abs(rel.snap[o + k] - snap[o + k]) / DIV[k]);
    }
    OUT.bords.push({ nom, ok: true, pire: Math.max(...ecart) });
  };
  /* Les sorties éprouvées sont celles que le jeu peut PRODUIRE, plus une large marge.

  La plus grande sortie mesurée sur douze courses complètes vaut 21,2 px. On éprouve donc à 200 et
  à 1000 px — dix et cinquante fois pire. À 5000 px le codec borne, et c'est assumé : rien dans le
  jeu ne met une voiture là, et une borne vaut mieux qu'un entier qui boucle. */
  essai('voiture a 200 px hors du cadre', (s) => { s[4] -= 20000; s[5] -= 20000; });
  essai('voiture a 1000 px hors du cadre', (s) => { s[4] -= 100000; s[5] -= 100000; });
  essai('meilleur tour nul', (s) => { s[4 + 12] = 0; });
  essai('tres long tour (600 s)', (s) => { s[4 + 12] = 600000; s[4 + 13] = 60000; });
  essai('temps de course a 1 heure', (s) => { s[1] = 360000; });
}

/* --- le bloc lent : quatorze images sur quinze doivent rendre la valeur retenue --- */
{
  const race = new Race({ trackDef: TRACKS[0], classId: cat.id, difficulty: 'medium', playerAI: true,
                          playerLivery: 0, nCars: 3, mode: 'race', laps: 3 });
  for (let i = 0; i < 200; i++) race.update(race.dt, true);
  race.cars[0].bestLap = 71.234;
  let g = null, vus = [], portes = 0;
  for (let seq = 0; seq < 31; seq++) {
    const snap = race.snapshot(seq);
    const oct = pqEncode(snap, race.track);
    const rel = pqDecode(oct, race.track, g);
    if (rel.lent) { g = rel.lent; portes++; }
    vus.push(rel.snap[4 + 12]);
  }
  OUT.lent = { attendu: Math.round(71.234 * 1000), vus, portes,
               tousBons: vus.every((x) => x === Math.round(71.234 * 1000)) };
}
`;

const OUT = {};
vm.runInNewContext(src, { OUT, console, performance: { now: () => Date.now() }, Math, JSON, Date, Array });

let fautes = 0;
const dit = (ok, txt) => { if (!ok) fautes++; console.log(`  ${ok ? 'ok  ' : 'FAUX'}  ${txt}`); };

console.log(`\n  ${OUT.nSnap} instantanés de vraie course, ${OUT.nCars} voitures, douze circuits\n`);
if (OUT.casse) { console.log(`  ÉCHEC : ${OUT.casse}`); process.exit(1); }

const moyOct = OUT.nOctets / OUT.nSnap, moyJson = OUT.nJson / OUT.nSnap;
console.log(`  JSON    ${moyJson.toFixed(0).padStart(5)} octets par instantané`);
console.log(`  paquet  ${moyOct.toFixed(0).padStart(5)} octets   →  ${(moyJson / moyOct).toFixed(2)} fois plus petit\n`);

console.log('  ce que la quantification coûte, en unités du jeu :');
OUT.CHAMPS.forEach((c, k) => {
  if (OUT.pire[k] === 0) return;
  console.log(`    ${c.padEnd(9)} pire écart ${OUT.pire[k].toFixed(4)} ${OUT.UNITE[k]}`);
});
// le seuil au-delà duquel l'invité repose la voiture d'un coup vaut six mètres : on doit rester
// très loin en dessous, sinon la quantification déclencherait elle-même des recalages
dit(OUT.pire[0] < 0.1 && OUT.pire[1] < 0.1, `x et y à moins d'un dixième de pixel (${OUT.pire[0].toFixed(4)} / ${OUT.pire[1].toFixed(4)})`);
dit(OUT.pire[6] < 0.1, `l'abscisse curviligne à moins de 10 cm (${OUT.pire[6].toFixed(4)} m)`);
dit(OUT.pire[2] === 0 && OUT.pire[3] === 0, 'cap et vitesse sont rendus exactement');
dit(OUT.pire[8] === 0 && OUT.pire[11] === 0, 'tour et drapeaux sont rendus exactement');

console.log('\n  les cas de bord :');
for (const b of OUT.bords) {
  const ok = b.ok && b.pire < 1;
  dit(ok, `${b.nom.padEnd(32)} ${b.ok ? 'pire écart ' + b.pire.toFixed(3) : b.quoi}`);
}

console.log('\n  le bloc lent :');
dit(OUT.lent.portes >= 2, `${OUT.lent.portes} blocs lents sur 31 images`);
dit(OUT.lent.tousBons, `le meilleur tour tient entre deux (${OUT.lent.vus.filter((x) => x !== OUT.lent.attendu).length} images à zéro)`);

console.log(`\nfautes ${fautes}`);
process.exit(fautes ? 1 : 0);
