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

const { playableCategories, modelsOf } = require(path.join(__dirname, '..', 'js', 'cars.js'));
const ref = JSON.parse(fs.readFileSync(path.join(__dirname, 'fiches.json'), 'utf8'));

/* Catégorie par catégorie, depuis qu'il y en a trois : l'écart entre deux voitures ne se lit que
dans une même catégorie, et c'est là que la question « la plus rapide est-elle la bonne ? » a un
sens. La fiabilité de chaque source est affichée avec elle : une estimation n'est pas une mesure. */
const dim = (t) => `\u001b[2m${t}\u001b[0m`;
let total = 0, sourcees = 0;
for (const cat of playableCategories()) {
  const jeu = modelsOf(cat.id).map((m) => ({ id: m.id, nom: m.name, kmh: m.vmax * 3.6 }));
  console.log(`\n  ${cat.id.toUpperCase()} · vitesse de pointe, le jeu contre la realite\n`);
  console.log('    voiture          jeu        reelle     ecart     fiabilite      source');
  for (const v of jeu) {
    total++;
    const r = (ref.voitures || {})[v.id] || {};
    if (r.vmax_kmh == null) {
      console.log(`    ${v.nom.padEnd(16)} ${v.kmh.toFixed(0).padStart(4)} km/h        —        —      ${dim('non verifiee')}`);
      continue;
    }
    sourcees++;
    console.log(`    ${v.nom.padEnd(16)} ${v.kmh.toFixed(0).padStart(4)} km/h   ` +
      `${String(r.vmax_kmh).padStart(4)} km/h  ${(v.kmh - r.vmax_kmh).toFixed(0).padStart(5)}     ` +
      `${(r.fiabilite || '?').padEnd(13)}  ${(r.source || '').slice(0, 60)}`);
  }
  // L'ORDRE, qui ne demande pas de chiffre exact pour etre faux
  const avec = jeu.filter((v) => ((ref.voitures || {})[v.id] || {}).vmax_kmh != null);
  const ordreJeu = avec.slice().sort((a, b) => b.kmh - a.kmh).map((v) => v.id).join(',');
  const ordreReel = avec.slice().sort((a, b) => ref.voitures[b.id].vmax_kmh - ref.voitures[a.id].vmax_kmh).map((v) => v.id).join(',');
  console.log(`\n    ordre des pointes : ${ordreJeu === ordreReel ? 'le meme que dans la realite' : 'DIFFERENT de la realite'}`);
}
console.log(`\n  ${sourcees} voiture(s) sourcee(s) sur ${total}\n`);
