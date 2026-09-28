// De quel côté sont vraiment les lignes « intérieure » et « extérieure » ?
//
//   node tools/cotes.js [circuit|all]
//
// La question se tranche par la géométrie et non en relisant les commentaires, qui se contredisent
// dans ce fichier même : l'un annonce qu'une courbure positive tourne à droite, l'autre à gauche.
//
// Le côté intérieur d'un virage est celui vers lequel la route se creuse, c'est-à-dire celui où se
// trouve le centre de courbure. On le trouve sans rien savoir des conventions de signe : la dérivée
// seconde de la ligne centrale, P(i-1) − 2·P(i) + P(i+1), pointe vers ce centre. Il suffit de la
// projeter sur la normale pour savoir de quel côté il est, puis de regarder où se place chaque
// ligne. Aucune convention n'est supposée : on mesure.
//
// On relève aussi l'écartement des trois lignes tout au long du tour, parce qu'une ligne de
// dépassement qui se confond avec la ligne de course dans les lignes droites ne sert à rien.
const fs = require('fs'), vm = require('vm');

const ARGS = process.argv.slice(2);
let src = '';
for (const f of ['util', 'tracks', 'track']) {
  src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8')
    .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
}
src += `
const seul = ARGS[0] && ARGS[0] !== 'all' ? ARGS[0] : null;
const out = [];
for (const def of TRACKS) {
  if (seul && def.id !== seul) continue;
  const T = new Track(def);
  const N = T.n;
  let virages = 0, justeInt = 0, justeExt = 0, decidesInt = 0, decidesExt = 0;
  let paires = 0, opposees = 0, intRabattue = 0;
  let sepMin = Infinity, sepMoy = 0, nDroite = 0, sepDroite = 0, collees = 0;
  const ecarts = [];
  for (let i = 0; i < N; i++) {
    /* La dérivée seconde de l'axe pointe vers le centre de courbure — mais prise sur un pas d'un
    mètre elle ne fait que quelques millimètres pour un virage de 250 m de rayon, et les
    coordonnées sont en flottant simple. On l'ouvre donc sur quinze mètres de part et d'autre : le
    vecteur devient deux cents fois plus grand, et sa direction cesse d'être du bruit. */
    const W = 15;
    const a = (i - W + N) % N, b = (i + W) % N;
    const cx = T.xs[b] - 2 * T.xs[i] + T.xs[a];
    const cy = T.ys[b] - 2 * T.ys[i] + T.ys[a];
    const vers = cx * T.nx[i] + cy * T.ny[i];       // > 0 : le centre est à gauche
    const r = T.lines.racing[i];
    const oInt = T.lines.inside[i] - r, oExt = T.lines.outside[i] - r;
    const sep = Math.max(Math.abs(oInt), Math.abs(oExt), Math.abs(oInt - oExt));
    ecarts.push(sep);
    sepMin = Math.min(sepMin, sep);
    sepMoy += sep;
    if (sep < 1.0) collees++;
    /* Un virage : courbure franche, mesurée sur la même dérivée seconde.

    On ne compte que les échantillons où la ligne a bougé d'au moins trente centimètres, parce
    qu'au point de corde la ligne de course est déjà contre le bord intérieur : l'intérieure n'a
    alors nulle part où aller, et compter ce non-déplacement comme une erreur accuserait la
    géométrie du virage plutôt que le code. La question posée est donc : quand une ligne se déporte,
    va-t-elle du bon côté ? */
    const courbe = Math.hypot(cx, cy) / (T.ds * T.ds * W * W);
    if (courbe > 0.004) {                            // rayon sous 250 m
      virages++;
      if (Math.abs(oInt) > 0.3) { decidesInt++; if (Math.sign(oInt) === Math.sign(vers)) justeInt++; }
      if (Math.abs(oExt) > 0.3) { decidesExt++; if (Math.sign(oExt) === -Math.sign(vers)) justeExt++; }
      // Les deux lignes portent le même signal en sens opposés : si elles ne se déportent pas de
      // part et d'autre de la ligne de course, c'est que quelque chose les a rabattues après coup.
      if (Math.abs(oInt) > 0.3 && Math.abs(oExt) > 0.3) {
        paires++;
        if (Math.sign(oInt) !== Math.sign(oExt)) opposees++;
        else if (Math.sign(oExt) === -Math.sign(vers)) intRabattue++;
      }
    } else {
      nDroite++; sepDroite += sep;
    }
  }
  /* Le contrôle qui ne dépend d'aucune convention : la longueur.

  Une ligne qui prend l'intérieur des virages est plus courte que la ligne de course, une qui prend
  l'extérieur plus longue. C'est vrai quel que soit le sens des normales, et ça ne se laisse pas
  tromper par le point de corde — là où la ligne de course touche déjà le bord, l'intérieure n'a
  nulle part où aller, et une mesure point par point la déclare fautive alors qu'elle n'a rien fait
  de mal. La longueur, elle, intègre tout le tour. */
  const longueur = (nom) => {
    let L = 0;
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const ax = T.xs[i] + T.nx[i] * T.lines[nom][i], ay = T.ys[i] + T.ny[i] * T.lines[nom][i];
      const bx = T.xs[j] + T.nx[j] * T.lines[nom][j], by = T.ys[j] + T.ny[j] * T.lines[nom][j];
      L += Math.hypot(bx - ax, by - ay);
    }
    return L;
  };
  const lInt = longueur('inside'), lRac = longueur('racing'), lExt = longueur('outside');
  ecarts.sort((x, y) => x - y);
  out.push({ id: def.id, nom: def.name, N, virages,
             pcInt: decidesInt ? 100 * justeInt / decidesInt : 0,
             pcExt: decidesExt ? 100 * justeExt / decidesExt : 0,
             decInt: decidesInt, decExt: decidesExt,
             sepMed: ecarts[ecarts.length >> 1], sepMoy: sepMoy / N,
             sepDroite: nDroite ? sepDroite / nDroite : 0,
             pcCollees: 100 * collees / N,
             dInt: lInt - lRac, dExt: lExt - lRac,
             pcOpp: paires ? 100 * opposees / paires : 0,
             pcRab: paires ? 100 * intRabattue / paires : 0 });
}
OUT.res = out;
`;

const sandbox = { ARGS, OUT: {}, console };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const res = sandbox.OUT.res;

console.log('\n  « intérieure » vraiment à l’intérieur du virage ? et « extérieure » à l’extérieur ?\n');
console.log('  circuit          déportées   intérieure juste   extérieure juste   écart médian   en ligne droite   collées   longueur int./ext.');
for (const r of res) {
  console.log('  ' + r.nom.padEnd(20)
    + (r.decInt + '/' + r.decExt).padStart(10)
    + (r.pcInt.toFixed(0) + ' %').padStart(18)
    + (r.pcExt.toFixed(0) + ' %').padStart(19)
    + (r.sepMed.toFixed(1) + ' m').padStart(15)
    + (r.sepDroite.toFixed(1) + ' m').padStart(18)
    + (r.pcCollees.toFixed(0) + ' %').padStart(10)
    + ((r.dInt >= 0 ? '+' : '') + r.dInt.toFixed(0) + ' / ' + (r.dExt >= 0 ? '+' : '') + r.dExt.toFixed(0) + ' m').padStart(20));
}
const moy = (k) => res.reduce((a, r) => a + r[k], 0) / res.length;
console.log(`\n  moyenne : intérieure juste ${moy('pcInt').toFixed(0)} %, extérieure juste ${moy('pcExt').toFixed(0)} %,`
  + ` écart en ligne droite ${moy('sepDroite').toFixed(1)} m, lignes collées sur ${moy('pcCollees').toFixed(0)} % du tour`);
console.log(`  les deux lignes se déportent de part et d'autre : ${moy('pcOpp').toFixed(0)} % du temps`
  + ` — quand ce n'est pas le cas, l'intérieure est rabattue du côté de l'extérieure dans ${moy('pcRab').toFixed(0)} % des cas`);
const bonnesLongueurs = res.filter((r) => r.dInt < 0 && r.dExt > 0).length;
console.log(`  longueurs : l'intérieure est plus courte et l'extérieure plus longue que la ligne de course`
  + ` sur ${bonnesLongueurs} circuits sur ${res.length}`);
if (bonnesLongueurs < res.length) {
  console.log('  ÉCHEC : ' + res.filter((r) => !(r.dInt < 0 && r.dExt > 0)).map((r) => r.nom).join(', '));
  process.exitCode = 1;
}
