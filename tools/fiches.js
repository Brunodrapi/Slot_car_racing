// Les caracteristiques du jeu, face a celles des vraies voitures.
//
//   node tools/fiches.js
//
// Bruno : « la Mazda 787B ne va qu'a 250 km/h alors que sa fiche dit 350. Les caracteristiques des
// voitures doivent etre verifiees. » Rien ne les comparait a quoi que ce soit : les multiplicateurs
// de `js/cars.js` ont ete regles pour l'equilibre entre voitures, et personne n'a jamais confronte
// le resultat a la voiture reelle.
//
// L'outil ne tranche pas le desaccord, il le MONTRE, sur trois plans qui ne disent pas la meme chose :
//
//   1. L'ECART ABSOLU. Combien de km/h separent le jeu de la realite, voiture par voiture.
//   2. L'ORDRE. Qui est la plus rapide, dans le jeu et dans la realite. C'est le plus parlant :
//      il ne demande aucune source precise pour etre faux, et une erreur d'ordre se voit en jouant.
//   3. L'ECHELLE. Si toutes les voitures etaient au meme facteur de la realite — disons 0,75 — les
//      ecarts relatifs seraient justes meme si les chiffres absolus ne le sont pas. On mesure donc
//      la dispersion de ce facteur : serree, l'echelle est assumee ; large, elle est accidentelle.
//
// UNE VALEUR SANS SOURCE N'EST PAS UNE VALEUR. `tools/fiches.json` porte un champ `source` par
// voiture, et ce qui n'est pas rempli s'affiche comme non verifie plutot que de se fondre dans le
// tableau. Une vitesse de pointe depend en plus de la configuration — un prototype du Mans a une
// boite courte et une longue — d'ou le champ `config`.
'use strict';
const fs = require('fs');
const path = require('path');

const { MODELS, playableCategories, modelsOf } = require(path.join(__dirname, '..', 'js', 'cars.js'));
const ref = JSON.parse(fs.readFileSync(path.join(__dirname, 'fiches.json'), 'utf8'));

const cat = playableCategories()[0];
const jeu = modelsOf(cat.id).map((m) => ({ id: m.id, nom: m.name, kmh: m.vmax * 3.6 }));

console.log('\n  vitesse de pointe · le jeu contre la realite\n');
console.log('    voiture          jeu        reelle     ecart     facteur   source');
const avecRef = [];
for (const v of jeu) {
  const r = (ref.voitures || {})[v.id] || {};
  if (r.vmax_kmh == null) {
    console.log(`    ${v.nom.padEnd(16)} ${v.kmh.toFixed(0).padStart(4)} km/h   ` +
      `      —        —         —      ${'\u001b[2mnon verifiee\u001b[0m'}`);
    continue;
  }
  const f = v.kmh / r.vmax_kmh;
  avecRef.push({ ...v, reelle: r.vmax_kmh, f });
  console.log(`    ${v.nom.padEnd(16)} ${v.kmh.toFixed(0).padStart(4)} km/h   ` +
    `${String(r.vmax_kmh).padStart(4)} km/h  ${(v.kmh - r.vmax_kmh).toFixed(0).padStart(5)}    ` +
    `  ${f.toFixed(2)}     ${(r.source || '').slice(0, 42)}`);
}

const manquantes = jeu.length - avecRef.length;
console.log(`\n    ${avecRef.length} voiture(s) verifiable(s) sur ${jeu.length}` +
  (manquantes ? ` · ${manquantes} sans source dans tools/fiches.json` : ''));

/* --- L'ORDRE, qui ne demande pas de chiffre exact pour etre faux --- */
console.log('\n  l\'ordre des vitesses de pointe dans le jeu, de la plus rapide a la plus lente\n');
const parJeu = jeu.slice().sort((a, b) => b.kmh - a.kmh);
console.log('    ' + parJeu.map((v, i) => `${i + 1}. ${v.nom}`).join('\n    '));
const ecart = (Math.max(...jeu.map((v) => v.kmh)) / Math.min(...jeu.map((v) => v.kmh)) - 1) * 100;
console.log(`\n    de la plus lente a la plus rapide : ${ecart.toFixed(1)} % d'ecart`);

/* --- L'ECHELLE, si assez de voitures sont renseignees --- */
if (avecRef.length >= 2) {
  const fs_ = avecRef.map((v) => v.f);
  const moy = fs_.reduce((a, b) => a + b, 0) / fs_.length;
  const disp = (Math.max(...fs_) / Math.min(...fs_) - 1) * 100;
  console.log(`\n  echelle moyenne ${moy.toFixed(2)} · dispersion ${disp.toFixed(1)} %`);
  console.log(disp < 10
    ? '    Serree : le jeu applique une echelle, les ecarts relatifs sont donc justes.'
    : '    Large : il n\'y a pas d\'echelle, les ecarts entre voitures sont arbitraires.');
} else {
  console.log('\n  echelle : il faut au moins deux voitures sourcees pour la mesurer.');
}
console.log();
