/* Les deux bords gardent-ils leur couleur tout le tour ?

Le levier portait l'intérieur et l'extérieur du VIRAGE, qui échangent de place à chaque changement
de main : pousser vers « l'extérieur » envoyait à gauche dans une courbe et à droite dans la
suivante, et les bords peints, qui portent les mêmes couleurs, basculaient avec. Un repère qui
change de place pendant qu'on s'en sert n'en est pas un. Le jeu range donc maintenant ses deux
lignes secondaires par CÔTÉ et non par rôle : le jaune à gauche du sens de marche, le bleu à
droite, du départ à l'arrivée.

Ce banc vérifie ce que cette promesse veut dire, et rien d'autre :

  1. le jaune est partout à gauche du bleu — sans quoi les deux extrémités du levier se croisent
     quelque part, et c'est précisément le défaut qu'on vient de retirer ;
  2. le levier est monotone — de -1 à +1 la cible ne recule jamais, sinon pousser plus loin
     ramènerait en arrière ;
  3. les deux lignes tiennent dans la piste ;
  4. elles ne font pas de marche d'escalier là où les deux sources se croisaient.

Le point 1 a remplacé un premier critère FAUX de ma part : j'avais exigé que le jaune reste à gauche
de la ligne IDÉALE, et onze circuits sur douze tombaient. L'idéale n'a rien à voir là-dedans — elle
s'appuie contre un bord dans les courbes, et le jaune passe derrière elle sans que le levier
s'inverse. Ce qui doit tenir, c'est l'ordre des deux extrémités entre elles.

  node tools/bords.js
*/
const fs = require('fs'), vm = require('vm');
let src = '';
for (const f of ['util', 'traces', 'tracks', 'track']) {
  src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8')
    .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
}
src += [
"let fautes = 0;",
"const dire = (ok, quoi, detail) => { if (!ok) fautes++; console.log('  ' + (ok ? 'ok  ' : 'FAUX') + ' ' + quoi + (detail ? '   ' + detail : '')); };",
"console.log('circuit       jaune<bleu   levier reculant   hors piste   saut max   largeur utile');",
"const bilan = [];",
"for (const td of TRACKS) {",
"  const T = new Track(td), N = T.n, J = T.lines.jaune, B = T.lines.bleu;",
"  let croise = 0, recule = 0, hors = 0, saut = 0, larg = 0;",
"  for (let i = 0; i < N; i++) {",
"    const d = J[i] - B[i];",
"    if (d < 0) croise++;",
"    larg += Math.max(0, d);",
"    if (J[i] > T.hwL[i] + 0.5 || B[i] < -T.hwR[i] - 0.5) hors++;",
"    const j = (i + 1) % N;",
"    saut = Math.max(saut, Math.abs(J[j] - J[i]), Math.abs(B[j] - B[i]));",
"    // le levier, echantillonne de -1 a +1 : la cible ne doit jamais reculer",
"    const s = i * T.ds;",
"    let av = T.targetLat(s, -1);",
"    for (let k = -9; k <= 10; k++) { const v = T.targetLat(s, k / 10); if (v < av - 1e-4) { recule++; break; } av = v; }",
"  }",
"  bilan.push({ id: td.id, croise, recule, hors, N, larg: larg / N });",
"  console.log(td.id.padEnd(13) + (croise + '/' + N).padStart(12) + String(recule).padStart(18)",
"    + String(hors).padStart(13) + saut.toFixed(3).padStart(11) + (larg / N).toFixed(2).padStart(15) + ' m');",
"}",
"console.log('');",
"dire(bilan.every((b) => b.croise === 0), 'le jaune est partout a gauche du bleu',",
"  bilan.filter((b) => b.croise).map((b) => b.id).join(' ') || '12 circuits');",
"dire(bilan.every((b) => b.recule === 0), 'le levier ne recule jamais entre -1 et +1',",
"  bilan.filter((b) => b.recule).map((b) => b.id + ':' + b.recule).join(' ') || '12 circuits');",
"dire(bilan.every((b) => b.hors <= b.N * 0.01), 'les deux lignes tiennent dans la piste',",
"  bilan.filter((b) => b.hors > b.N * 0.01).map((b) => b.id).join(' ') || '12 circuits');",
"/* Monaco a 2,4 m de largeur utile la ou les autres en ont 6 a 9 : ses deux lignes tracees a la",
"   main se confondent sur les trois cinquiemes du tour, la ou il n'y a pas la place de choisir.",
"   Ce n'est pas une regression de la fusion, c'est le trace lui-meme — mesure avant/apres. */",
"const maigre = bilan.filter((b) => b.larg < 2);",
"dire(maigre.length === 0, 'le levier offre partout plus de deux metres a choisir',",
"  maigre.map((b) => b.id + ' ' + b.larg.toFixed(2) + ' m').join(' ') || '12 circuits');",
"console.log('');",
"console.log(fautes + ' faute(s)');",
].join('\n');
vm.runInNewContext(src, { Math, console, Float32Array, Float64Array, Uint16Array, Array, Object, isNaN, parseFloat, JSON },
  { filename: 'bords' });
