// Les listes blanches du serveur des records sont-elles celles du jeu ?
//
//   node tools/serveur-listes.js
//
// La fonction `record` refuse tout circuit et toute voiture qu'elle ne connaît pas, et elle vit à
// part : on ne peut pas y importer `js/cars.js`, ses listes sont donc recopiées à la main. Et elles
// ont dérivé sans un bruit — les quatre premières F1 puis Paul Ricard y ont manqué, et leurs tours
// étaient refusés comme « inconnus » pendant que l'écran des records affichait des tirets.
//
// L'essai lit les deux côtés et exige l'égalité dans les deux sens : un oubli refuse des tours
// légitimes, un reste laisserait le tableau se remplir de lignes qu'aucun écran n'affiche.
// Il ne parle à personne, et ne dit donc rien de la fonction DÉPLOYÉE : après une correction, il
// faut encore `tools/deploie.sh`.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..');

const ts = fs.readFileSync(path.join(R, 'supabase/functions/record/index.ts'), 'utf8');
const liste = (nom) => {
  const m = new RegExp(`const ${nom} = new Set\\(\\[([\\s\\S]*?)\\]\\)`).exec(ts);
  if (!m) throw new Error(`${nom} introuvable dans la fonction`);
  return new Set([...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
};

let src = '';
for (const f of ['util', 'traces', 'tracks', 'track', 'cars']) {
  src += fs.readFileSync(path.join(R, 'js', f + '.js'), 'utf8').replace(/if \(typeof module[^\n]*\n/g, '') + '\n';
}
src += 'this.__ = { circuits: TRACKS.map((t) => t.id), voitures: MODELS.filter((m) => !m.custom).map((m) => m.id) };';
const ctx = { Math, JSON, Object, Array, Float32Array, Date, console };
vm.runInNewContext(src, ctx);
const jeu = ctx.__;

let fautes = 0;
for (const [nom, cote] of [['CIRCUITS', jeu.circuits], ['VOITURES', jeu.voitures]]) {
  const serveur = liste(nom);
  const manquent = cote.filter((id) => !serveur.has(id));
  const restent = [...serveur].filter((id) => !cote.includes(id));
  const ok = !manquent.length && !restent.length;
  if (!ok) fautes++;
  console.log(`  ${ok ? 'ok  ' : 'FAUX'}  ${nom} : ${cote.length} dans le jeu, ${serveur.size} sur le serveur`
    + (manquent.length ? ` — refusés à tort : ${manquent.join(', ')}` : '')
    + (restent.length ? ` — inconnus du jeu : ${restent.join(', ')}` : ''));
}
process.exitCode = fautes ? 1 : 0;
