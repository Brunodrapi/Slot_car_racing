// POSER UNE LISTE D'ANNONCES VENUE DE L'ÉDITEUR dans js/tracks.js.
//
//   node tools/pose.js monaco liste.txt          → remplace le bloc `panneaux:` de monaco
//   node tools/pose.js monaco liste.txt --essai  → dit ce qu'il ferait, sans écrire
//
// `liste.txt` est le bloc collé depuis `lignes.html`, avec ou sans le `panneaux: [` autour, et avec
// ou sans la virgule finale. On ne relit pas les chiffres : ce sont ceux de l'auteur. On vérifie
// seulement que ça se lit comme du JavaScript et que chaque entrée a bien ses quatre champs — une
// liste à moitié collée écrirait sinon un fichier qui ne se charge plus, et personne ne le verrait
// avant d'ouvrir le jeu.
const fs = require('fs'), path = require('path');
const { ecrireBlocs, compterBlocs } = require('./panneaux-ecrire.js');

const args = process.argv.slice(2);
const essai = args.includes('--essai');
const [id, fichier] = args.filter((a) => !a.startsWith('--'));
if (!id || !fichier) { console.log('usage : node tools/pose.js <circuit> <fichier> [--essai]'); process.exit(1); }

let brut = fs.readFileSync(fichier, 'utf8');
const deb = brut.indexOf('panneaux: [');
if (deb >= 0) {
  let i = brut.indexOf('[', deb), prof = 0, fin = -1;
  for (; i < brut.length; i++) {
    if (brut[i] === '[') prof++;
    else if (brut[i] === ']') { prof--; if (!prof) { fin = i; break; } }
  }
  brut = brut.slice(brut.indexOf('\n', deb) + 1, fin);
}
const liste = eval('[' + brut.replace(/,\s*$/, '') + ']');
for (const p of liste)
  if (!Array.isArray(p) || p.length !== 4 || typeof +p[0] !== 'number' || Number.isNaN(+p[0]))
    { console.log('entrée mal formée : ' + JSON.stringify(p)); process.exit(1); }

const txt = liste.map((p) => '      [' + p[0] + ', ' + p[1] + ', '
  + (typeof p[2] === 'number' ? p[2] : "'" + p[2] + "'") + ', ' + p[3] + '],').join('\n');

const dest = path.join(__dirname, '..', 'js', 'tracks.js');
const avant = fs.readFileSync(dest, 'utf8');
const n0 = compterBlocs(avant);
const r = ecrireBlocs(avant, { [id]: txt }, (m) => console.log(m));
const n1 = compterBlocs(r.txt);
console.log(id + ' : ' + liste.length + ' annonces, ' + r.faits + ' bloc remplacé, ' + r.ajouts + ' ajouté'
  + '  (blocs dans le fichier : ' + n0 + ' → ' + n1 + ')');
if (essai) { console.log('(essai seulement)'); process.exit(0); }
if (n1 < n0) { console.log('ABANDON : un bloc a disparu'); process.exit(1); }
fs.writeFileSync(dest, r.txt);
