/* OÙ LE DÉCOR A LE DROIT DE SE TROUVER.

   Un arbre est posé perpendiculairement au tracé à SON abscisse, au-delà de la protection qui s'y
   trouve. Cela garantit qu'il ne tombe pas sur la piste à cet endroit-là, et rien de plus : partout
   où le circuit se replie, l'autre branche passe derrière, et le bois semé le long de la première
   poussait au milieu de la seconde. Bruno l'a vu en roulant avant que rien ne le mesure — « il peut
   y avoir des arbres sur la piste […] un arbre isolé en milieu de piste ou sur un bâtiment, non.
   Pas d'arbre dans les graviers non plus. »

   Le compte d'objets écartés ne prouve rien : il dit qu'on a retiré quelque chose, pas qu'il ne
   reste rien. Ce banc regarde donc où chaque objet tombe RÉELLEMENT, en le projetant sur le tour
   entier, et compte ceux qui sont là où ils n'ont rien à faire :

     sur la piste        à l'intérieur du ruban, le cas le plus grossier
     dans le dégagement  gravier ou bitume hors piste : on n'y plante pas d'arbre
     sur un bâtiment     une couronne au milieu d'un toit

   La bordure reste permise, et c'est voulu : une cime qui déborde sur le circuit renforce
   l'immersion, c'est ce qu'on a cherché. C'est le PIED qui doit rester dehors.

     node tools/decor-banc.js [circuit]
*/
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');

const ROOT = __dirname + '/..';
let src = '';
for (const f of ['util', 'traces', 'tracks', 'track', 'props'])
  src += fs.readFileSync(`${ROOT}/js/${f}.js`, 'utf8')
    .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';

const log = (...a) => fs.writeSync(1, a.join(' ') + '\n');
const sandbox = {
  console: { log }, Math, Date, Float32Array, Uint8Array, Uint32Array, Int32Array,
  Map, Set, Object, Array, JSON, String, Number, isFinite, isNaN, parseInt, parseFloat, assert,
  CIRCUIT: process.argv[2] || null,
};
sandbox.document = { createElement: () => ({ getContext: () => ({}), width: 0, height: 0 }) };

vm.runInNewContext(src + `
const choisis = CIRCUIT ? TRACKS.filter(t => t.id === CIRCUIT) : TRACKS;
assert.ok(choisis.length, 'circuit inconnu : ' + CIRCUIT);
let fautes = 0;
console.log('circuit        arbres  sur piste  dans le dégagement  sur un bâti   pied le plus proche');
for (const def of choisis) {
  const T = new Track(def);
  const im = placeImplantation(T, def.id, def.implantation);
  if (!im) { console.log(def.id.padEnd(14) + '  — pas d implantation'); continue; }
  // Les empreintes des bâtiments, pour y chercher des couronnes.
  const batis = im.batis.filter(b => b.type !== 'voiture');
  /* LE SEMIS ORDINAIRE EST JUGÉ AVEC LE RESTE.

  Le semis ordinaire pose ses propres arbres, et il a son propre test de dégagement — qui ne
  regarde qu'un nœud sur quatre et calcule sa marge autrement. Deux façons de répondre à la même
  question finissent toujours par se contredire ; on les mesure donc ensemble, sur le seul critère
  qui compte : où l'objet tombe. */
  const semis = implEfface(T, im, placeTopProps(T, def.id, null, null));
  let piste = 0, degagement = 0, surBati = 0, pire = Infinity;
  for (const a of im.arbres.concat(semis)) {
    const pr = T.project(a.x, a.y, 0, Math.ceil(T.n / 2) + 1);
    const side = pr.lat >= 0 ? 1 : -1;
    const d = Math.abs(pr.lat);
    const hw = side > 0 ? T.hwLeftAt(pr.s) : T.hwRightAt(pr.s);
    if (d < hw) piste++;
    else if (d < hw + T.runoffWidthAt(pr.s, side)) degagement++;
    pire = Math.min(pire, d - T.limiteProtection(pr.s, side));
    for (const b of batis) {
      const cs = Math.cos(b.a), sn = Math.sin(b.a);
      const dx = a.x - b.x, dy = a.y - b.y;
      const u = dx * cs + dy * sn, v = (-dx * sn + dy * cs) * -b.side;
      if (Math.abs(u) < b.l / 2 && v > 0 && v < b.w) { surBati++; break; }
    }
  }
  const ok = piste === 0 && degagement === 0 && surBati === 0;
  if (!ok) fautes++;
  console.log(def.id.padEnd(14) + String(im.arbres.length + semis.length).padStart(6)
    + String(piste).padStart(11) + String(degagement).padStart(20)
    + String(surBati).padStart(13) + (pire === Infinity ? '' : pire.toFixed(1).padStart(21) + ' m')
    + (ok ? '' : '   FAUTE'));
}
console.log('');
assert.equal(fautes, 0, fautes + ' circuit(s) avec du décor là où il ne doit pas être');
console.log('Décor : aucun arbre sur la piste, dans un dégagement ni sur un bâtiment.');
`, sandbox);
