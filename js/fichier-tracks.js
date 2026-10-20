/* FABRIQUER `js/tracks.js` DEPUIS UNE PAGE — le partage entre l'éditeur de lignes et celui du décor.

Une page servie par GitHub Pages ne peut pas écrire dans le dépôt : il n'y a que des fichiers au
bout. Mais elle peut relire `js/tracks.js` tel qu'il est servi, y remplacer des blocs dans la
définition d'un circuit, et rendre le fichier à télécharger. Il ne reste qu'à le remettre dans `js/`.

La découpe se fait au comptage d'accolades, en sautant chaînes et commentaires : une définition de
circuit est un objet littéral, et chercher sa fin à l'expression régulière marche jusqu'au jour où
ça ne marche plus. */
'use strict';

/** L'indice de l'accolade ou du crochet qui ferme celui ouvert en `debut`, ou -1. */
function finObjet(txt, debut) {
  let prof = 0, dans = null, com = null;
  for (let i = debut; i < txt.length; i++) {
    const c = txt[i];
    /* LES COMMENTAIRES SE SAUTENT, et ce n'est pas un raffinement. Le fichier est commenté en
       français : « ce qu'on », « l'assombrissement », « n'est pas ». Chaque apostrophe était lue
       comme une ouverture de chaîne, et une seule de trop décalait tout ce qui suit — le compteur
       d'accolades ne trouvait plus la fin de la définition, et le bloc se posait au mauvais endroit.
       Un commentaire ajouté ailleurs dans le fichier cassait donc cette page, sans rapport visible. */
    if (com) {
      if (com === '//' ? c === '\n' : (c === '*' && txt[i + 1] === '/')) { if (com === '/*') i++; com = null; }
      continue;
    }
    if (dans) {                                   // dans une chaîne : on n'y compte rien
      if (c === '\\') i++;
      else if (c === dans) dans = null;
      continue;
    }
    if (c === '/' && (txt[i + 1] === '/' || txt[i + 1] === '*')) { com = c + txt[i + 1]; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { dans = c; continue; }
    if (c === '{' || c === '[') prof++;
    else if (c === '}' || c === ']') { prof--; if (prof === 0) return i; }
  }
  return -1;
}

/* Les clés de PREMIER NIVEAU d'une définition, avec l'étendue de leur valeur.

`corps` va de l'accolade ouvrante à l'accolade fermante. Une valeur court jusqu'à la virgule ou
l'accolade de même profondeur, quelle qu'elle soit : un tableau, un objet, un nombre, mais aussi
`TRACES.monza` ou `[…].map(…)`. Ce qui est dans un commentaire ou une chaîne ne compte pas — un
« pitAt » cité dans un commentaire n'est pas une clé. */
function clesPremierNiveau(corps) {
  const out = [];
  let prof = 0, dans = null, com = null;
  for (let i = 0; i < corps.length; i++) {
    const c = corps[i];
    if (com) { if (com === '//' ? c === '\n' : (c === '*' && corps[i + 1] === '/')) { if (com === '/*') i++; com = null; } continue; }
    if (dans) { if (c === '\\') i++; else if (c === dans) dans = null; continue; }
    if (c === '/' && (corps[i + 1] === '/' || corps[i + 1] === '*')) { com = c + corps[i + 1]; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { dans = c; continue; }
    if ('{[('.includes(c)) { prof++; continue; }
    if ('}])'.includes(c)) { prof--; continue; }
    if (prof !== 1 || !/[A-Za-z_$]/.test(c) || /[\w$]/.test(corps[i - 1])) continue;
    const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(corps.slice(i, i + 80));
    if (!m) continue;
    let j = i + m[0].length;
    while (/\s/.test(corps[j])) j++;
    const fin = finValeur(corps, j);
    out.push({ cle: m[1], debut: i, fin });
    i = fin;
  }
  return out;
}

// La fin d'une valeur commencée en `j` : le dernier caractère avant la virgule ou la fermeture de
// même profondeur.
function finValeur(txt, j) {
  let prof = 0, dans = null, com = null, dernier = j;
  for (let i = j; i < txt.length; i++) {
    const c = txt[i];
    if (com) { if (com === '//' ? c === '\n' : (c === '*' && txt[i + 1] === '/')) { if (com === '/*') i++; com = null; } continue; }
    if (dans) { if (c === '\\') i++; else if (c === dans) { dans = null; dernier = i; } continue; }
    if (c === '/' && (txt[i + 1] === '/' || txt[i + 1] === '*')) { com = c + txt[i + 1]; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { dans = c; continue; }
    if ('{[('.includes(c)) prof++;
    else if ('}])'.includes(c)) { if (prof === 0) return dernier; prof--; }
    else if (c === ',' && prof === 0) return dernier;
    if (!/\s/.test(c)) dernier = i;
  }
  return dernier;
}

/* Pose, remplace ou retire UNE clé de premier niveau dans le corps d'une définition.

`texte` est la clé et sa valeur, sans virgule finale (`pitAt: 0.97` ou un bloc sur plusieurs lignes
déjà indenté de quatre espaces) ; `null` retire la clé, et la ligne si elle reste vide. Une clé
absente se pose juste avant l'accolade fermante de la définition. */
function poserCle(corps, cle, texte) {
  const k = clesPremierNiveau(corps).find((e) => e.cle === cle);
  if (k) {
    let fin = k.fin + 1;
    while (fin < corps.length && /[ \t]/.test(corps[fin])) fin++;
    if (corps[fin] === ',') fin++;
    if (texte != null) return corps.slice(0, k.debut) + texte.replace(/^ +/, '') + ',' + corps.slice(fin);
    // retirer : et la ligne entière si la clé y était seule
    const debLigne = corps.lastIndexOf('\n', k.debut - 1) + 1;
    let finLigne = corps.indexOf('\n', fin);
    if (finLigne < 0) finLigne = corps.length;
    const avant = corps.slice(debLigne, k.debut), apres = corps.slice(fin, finLigne);
    if (!avant.trim() && !apres.trim()) return corps.slice(0, debLigne) + corps.slice(finLigne + 1);
    return corps.slice(0, k.debut) + corps.slice(fin).replace(/^[ \t]+/, '');
  }
  if (texte == null) return corps;
  const avantFin = corps.lastIndexOf('\n', corps.length - 2) + 1;
  return corps.slice(0, avantFin) + '    ' + texte.replace(/^ +/, '') + ',\n' + corps.slice(avantFin);
}

/** Pose les clés `blocs` ({cle: texte | null}) dans la définition du circuit `id`. */
function poserDansDefinition(txt, id, blocs) {
  const tete = txt.indexOf(`id: '${id}'`);
  if (tete < 0) throw new Error(`circuit ${id} introuvable dans js/tracks.js`);
  const ouvre = txt.lastIndexOf('{', tete);
  const ferme = finObjet(txt, ouvre);
  if (ferme < 0) throw new Error(`définition de ${id} mal formée`);
  let corps = txt.slice(ouvre, ferme + 1);
  for (const [cle, texte] of Object.entries(blocs)) corps = poserCle(corps, cle, texte);
  return txt.slice(0, ouvre) + corps + txt.slice(ferme + 1);
}

/* Une valeur en littéral JavaScript, au style du fichier : guillemets simples, clés sans
guillemets, un élément par ligne pour les listes d'objets — pour qu'un diff dise lequel a changé —
et les listes de nombres sur une seule ligne. */
function litteral(v, retrait = '    ') {
  const simple = (x) => {
    if (x === null || x === undefined) return 'null';
    if (typeof x === 'number') return String(Math.round(x * 1e4) / 1e4);
    if (typeof x === 'boolean') return String(x);
    if (typeof x === 'string') return "'" + x.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    if (Array.isArray(x)) return '[' + x.map(simple).join(',') + ']';
    return '{ ' + Object.entries(x).filter(([, y]) => y !== undefined)
      .map(([k, y]) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : simple(k)) + ': ' + simple(y)).join(', ') + ' }';
  };
  if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === 'object')) {
    return '[\n' + v.map((x) => retrait + '  ' + simple(x) + ',').join('\n') + '\n' + retrait + ']';
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return '{\n' + Object.entries(v).filter(([, y]) => y !== undefined)
      .map(([k, y]) => retrait + '  ' + k + ': ' + litteral(y, retrait + '  ') + ',').join('\n') + '\n' + retrait + '}';
  }
  return simple(v);
}

if (typeof module !== 'undefined') module.exports = { finObjet, clesPremierNiveau, poserCle, poserDansDefinition, litteral };
