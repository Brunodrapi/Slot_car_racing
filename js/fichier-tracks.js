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

// L'étendue de la définition du circuit `id` : de son accolade ouvrante à sa fermante.
function etendueDefinition(txt, id) {
  const tete = txt.indexOf(`id: '${id}'`);
  if (tete < 0) throw new Error(`circuit ${id} introuvable dans js/tracks.js`);
  const ouvre = txt.lastIndexOf('{', tete);
  const ferme = finObjet(txt, ouvre);
  if (ferme < 0) throw new Error(`définition de ${id} mal formée`);
  return { ouvre, ferme };
}

/** Pose les clés `blocs` ({cle: texte | null}) dans la définition du circuit `id`. */
function poserDansDefinition(txt, id, blocs) {
  const { ouvre, ferme } = etendueDefinition(txt, id);
  let corps = txt.slice(ouvre, ferme + 1);
  for (const [cle, texte] of Object.entries(blocs)) corps = poserCle(corps, cle, texte);
  return txt.slice(0, ouvre) + corps + txt.slice(ferme + 1);
}

/* Pose des VALEURS ({cle: valeur | null}) dans la définition du circuit `id`, en gardant de
l'ancien texte tout ce qui n'a pas changé.

Réécrire une liste entière depuis sa valeur perdait ses commentaires — « Reprise 0.40 : le
Rettifilo devient bitumé des deux côtés », « // Bocht 12 — contour » — et changeait l'écriture de
chaque nombre (`.1518` devenait `0.1518`) : le diff d'un bac déplacé montrait vingt lignes, et le
fichier oubliait pourquoi elles étaient là. Voir `litteralGarde`. */
function poserValeurs(txt, id, valeurs) {
  const { ouvre, ferme } = etendueDefinition(txt, id);
  let corps = txt.slice(ouvre, ferme + 1);
  for (const [cle, v] of Object.entries(valeurs)) {
    let texte = null;
    if (v != null) {
      const k = clesPremierNiveau(corps).find((e) => e.cle === cle);
      const ancien = k ? corps.slice(k.debut, k.fin + 1).replace(/^[A-Za-z_$][\w$]*\s*:\s*/, '') : null;
      if (ancien != null && memeValeur(evaluer(ancien), v)) continue;   // rien à écrire
      texte = cle + ': ' + litteralGarde(v, ancien);
    }
    corps = poserCle(corps, cle, texte);
  }
  return txt.slice(0, ouvre) + corps + txt.slice(ferme + 1);
}

// La valeur d'un littéral du fichier, ou `undefined` s'il ne se lit pas seul (`TRACES.monza`…).
function evaluer(texte) {
  try { return Function('"use strict"; return (' + texte + ');')(); } catch (_) { return undefined; }
}
// Deux valeurs égales au centième de millième près : c'est la précision que `litteral` écrit.
function memeValeur(a, b) {
  const norme = (x) => JSON.stringify(x, (k, y) => (typeof y === 'number' ? Math.round(y * 1e4) / 1e4 : y));
  return a !== undefined && norme(a) === norme(b);
}

/* Les éléments d'un tableau littéral, chacun avec ce qui l'entoure : `pre`, les blancs et les
commentaires qui le précèdent, `post`, le commentaire qui finit sa ligne. `fin` est ce qui suit le
dernier élément, jusqu'au crochet fermant. */
function elementsTableau(t) {
  const items = [], n = t.length - 1;
  let i = 1, pre = '';
  const finLigne = (j) => { const f = t.indexOf('\n', j); return f < 0 || f > n ? n : f; };
  while (i < n) {
    const c = t[i];
    if (/\s/.test(c)) { pre += c; i++; continue; }
    if (c === '/' && t[i + 1] === '/') { const e = finLigne(i); pre += t.slice(i, e); i = e; continue; }
    if (c === '/' && t[i + 1] === '*') { const e = t.indexOf('*/', i) + 2; pre += t.slice(i, e); i = e; continue; }
    const fin = finValeur(t, i);
    const texte = t.slice(i, fin + 1);
    i = fin + 1;
    while (i < n && /[ \t]/.test(t[i])) i++;
    if (t[i] === ',') i++;
    let post = '', j = i;
    while (j < n && /[ \t]/.test(t[j])) j++;
    if (t[j] === '/' && t[j + 1] === '/') { const e = finLigne(j); post = t.slice(i, e); i = e; }
    items.push({ pre, texte, post, valeur: evaluer(texte) });
    pre = '';
  }
  return { items, fin: pre };
}

// Le même élément, retouché : même nom, ou même genre, même côté et un début voisin.
function memeElement(a, b) {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (a.name != null || b.name != null) return a.name === b.name;
  if (a.kind !== b.kind || a.side !== b.side || a.from == null || b.from == null) return false;
  const d = Math.abs(a.from - b.from) % 1;
  return Math.min(d, 1 - d) < 0.03;
}

/* `litteral`, mais qui reprend l'ancien texte `ancien` partout où il le peut.

Pour une liste d'objets : un élément inchangé garde son texte, ses commentaires et son écriture ; un
élément retouché (le même nom, ou le même genre au même endroit) garde ses commentaires et prend son
nouveau texte ; un élément nouveau s'écrit au style du fichier ; un élément disparu emporte ses
commentaires avec lui. Pour le reste, c'est `litteral`. */
function litteralGarde(v, ancien, retrait = '    ') {
  const objetsSeuls = Array.isArray(v) && v.every((x) => x && typeof x === 'object' && !Array.isArray(x));
  if (ancien == null || !objetsSeuls || !/^\[/.test(ancien) || finObjet(ancien, 0) !== ancien.length - 1) return litteral(v, retrait);
  const { items, fin } = elementsTableau(ancien);
  const pris = new Set(), choix = new Array(v.length).fill(null);
  // d'abord les éléments inchangés, puis les retouchés
  v.forEach((x, k) => {
    const j = items.findIndex((it, j2) => !pris.has(j2) && memeValeur(it.valeur, x));
    if (j >= 0) { pris.add(j); choix[k] = { it: items[j], garde: true }; }
  });
  v.forEach((x, k) => {
    if (choix[k]) return;
    const j = items.findIndex((it, j2) => !pris.has(j2) && memeElement(it.valeur, x));
    if (j >= 0) { pris.add(j); choix[k] = { it: items[j], garde: false }; }
  });
  const tete = '\n' + retrait + '  ';
  let out = '[';
  v.forEach((x, k) => {
    const c = choix[k];
    if (!c) { out += tete + enLigne(x) + ','; return; }
    const pre = c.it.pre.includes('\n') ? c.it.pre : tete;
    out += pre + (c.garde ? c.it.texte : enLigne(x)) + ',' + c.it.post;
  });
  return out + (fin.includes('\n') ? fin : '\n' + retrait) + ']';
}

/* Une valeur en littéral JavaScript, au style du fichier : guillemets simples, clés sans
guillemets, un élément par ligne pour les listes d'objets — pour qu'un diff dise lequel a changé —
et les listes de nombres sur une seule ligne. */
function litteral(v, retrait = '    ') {
  if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === 'object')) {
    return '[\n' + v.map((x) => retrait + '  ' + enLigne(x) + ',').join('\n') + '\n' + retrait + ']';
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return '{\n' + Object.entries(v).filter(([, y]) => y !== undefined)
      .map(([k, y]) => retrait + '  ' + k + ': ' + litteral(y, retrait + '  ') + ',').join('\n') + '\n' + retrait + '}';
  }
  return enLigne(v);
}
// Une valeur sur une seule ligne.
function enLigne(x) {
  if (x === null || x === undefined) return 'null';
  if (typeof x === 'number') return String(Math.round(x * 1e4) / 1e4);
  if (typeof x === 'boolean') return String(x);
  if (typeof x === 'string') return "'" + x.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  if (Array.isArray(x)) return '[' + x.map(enLigne).join(',') + ']';
  return '{ ' + Object.entries(x).filter(([, y]) => y !== undefined)
    .map(([k, y]) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : enLigne(k)) + ': ' + enLigne(y)).join(', ') + ' }';
}

if (typeof module !== 'undefined') module.exports = { finObjet, clesPremierNiveau, poserCle, poserDansDefinition, poserValeurs, litteral, litteralGarde };
