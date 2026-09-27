/* Éditeur de lignes — reprendre à la main les trois trajectoires d'un circuit existant.

Le jeu résout lui-même sa corde : il cherche le chemin qui plie le moins en restant sur la piste,
ce qui produit l'entrée large, le point de corde et la sortie large sans que rien de tout cela soit
écrit nulle part. C'est bon la plupart du temps, et quand ça ne l'est pas — un enchaînement où le
solveur sacrifie le second virage, une chicane qu'il prend trop droit — aucun réglage ne rattrape
une trajectoire : il faut la dessiner.

D'où cette page, qui n'est pas dans le jeu. Elle charge un circuit, lui demande ses trois lignes
telles que le jeu les calcule, les rend déplaçables point par point, et produit le bloc `lines` à
coller dans `js/tracks.js`. Dès qu'un circuit porte ce bloc, le solveur ne tourne plus pour lui et
c'est le dessin qui fait foi.

Deux choix qui tiennent tout le reste.

**Ce qui est affiché est ce que le jeu jouera, parce que c'est le code du jeu qui le calcule.** La
ligne dessinée n'est pas la spline qui passe par les points de contrôle : c'est la ligne d'un objet
`Track` construit avec eux, exactement comme le jeu le fera au chargement. La nuance n'est pas
théorique. Après projection, le jeu limite la vitesse à laquelle une trajectoire peut traverser la
piste — un pilote ne se déporte pas de trois mètres en cinq — si bien qu'un point tiré de deux mètres
n'en donne qu'un une fois rejoué. Un éditeur qui afficherait la spline brute montrerait une ligne que
le jeu n'accepte pas, et on réglerait à côté en croyant régler. Ici, la ligne résiste quand on lui
demande l'impossible, et c'est une information.

**Les coordonnées sont celles de `pts`**, pas des mètres. Un circuit intégré est décrit dans une
unité arbitraire puis redimensionné pour tomber sur sa longueur annoncée, et mélanger les deux
donnerait une ligne à côté de la piste.
*/
'use strict';

const COULEURS = { racing: '#ffffff', inside: '#50c8ff', outside: '#ffc83c' };
const NOMS = { racing: 'Corde', inside: 'Intérieure', outside: 'Extérieure' };

const S = {
  track: null,          // l'objet Track courant, pour la piste et les lignes calculées
  apercu: null,         // un Track construit avec les lignes dessinées : ce que le jeu jouera
  def: null,
  ligne: 'racing',
  pts: { racing: [], inside: [], outside: [] },   // points de contrôle, en unités de `pts`
  vue: { x: 0, y: 0, k: 1 },
  prise: null,          // le point en cours de déplacement
  glisse: null,         // le fond en cours de déplacement
};

const $ = (id) => document.getElementById(id);
const cv = $('cv');
const ctx = cv.getContext('2d');

/* ------------------------------------------------------------------ le circuit et ses lignes */

/** Les lignes que le jeu calcule, ramenées en points de contrôle dans les unités de `pts`. */
function autoPoints(nom, n) {
  const T = S.track, N = T.n, u = T.unitScale;
  const out = [];
  for (let i = 0; i < n; i++) {
    const j = Math.round(i * N / n) % N;
    const lat = T.lines[nom][j];
    out.push([(T.xs[j] + T.nx[j] * lat) / u, (T.ys[j] + T.ny[j] * lat) / u]);
  }
  return out;
}

function charger(id, garderPts) {
  S.def = TRACKS.find((t) => t.id === id) || TRACKS[0];
  // Le circuit est construit SANS ses lignes explicites, pour que « revenir au calcul » veuille
  // toujours dire la même chose : ce que le solveur propose, et non ce qu'on a déjà dessiné.
  const nu = Object.assign({}, S.def);
  delete nu.lines;
  S.track = new Track(nu);
  $('circuit').value = S.def.id;         // le sélecteur suit, même quand on charge par code
  const n = +$('nPts').value;
  if (!garderPts) for (const nom of ['racing', 'inside', 'outside']) S.pts[nom] = autoPoints(nom, n);
  cadrer();
  dessiner();
}

/* ---------------------------------------------------------------------------------- la vue */

function cadrer() {
  const b = S.track.bounds, u = S.track.unitScale;
  const w = cv.width / devicePixelRatio, h = cv.height / devicePixelRatio;
  const dx = (b.maxX - b.minX) / u, dy = (b.maxY - b.minY) / u;
  S.vue.k = Math.min(w / (dx * 1.12), h / (dy * 1.12));
  S.vue.x = w / 2 - ((b.minX + b.maxX) / 2 / u) * S.vue.k;
  S.vue.y = h / 2 - ((b.minY + b.maxY) / 2 / u) * S.vue.k;
}

const versEcran = (p) => [p[0] * S.vue.k + S.vue.x, p[1] * S.vue.k + S.vue.y];
const versPiste = (x, y) => [(x - S.vue.x) / S.vue.k, (y - S.vue.y) / S.vue.k];

/* ------------------------------------------------------------------------------- le dessin */

function dessiner() {
  majApercu();
  const w = cv.width / devicePixelRatio, h = cv.height / devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!S.track) return;
  const T = S.track, u = T.unitScale, N = T.n;

  // la piste : deux bords, remplis entre eux
  const bord = (signe) => {
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const j = i % N, hw = signe > 0 ? T.hwL[j] : -T.hwR[j];
      const p = versEcran([(T.xs[j] + T.nx[j] * hw) / u, (T.ys[j] + T.ny[j] * hw) / u]);
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
    }
  };
  ctx.fillStyle = '#39413a';
  bord(1); bord(-1); ctx.fill('evenodd');
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
  bord(1); ctx.stroke(); bord(-1); ctx.stroke();

  // l'axe, en pointillé : le repère par rapport auquel les lignes se lisent
  ctx.save();
  ctx.setLineDash([6, 8]); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const j = i % N, p = versEcran([T.xs[j] / u, T.ys[j] / u]);
    i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
  }
  ctx.stroke();
  ctx.restore();

  // les trois lignes, celle qu'on modifie par-dessus les autres
  for (const nom of ['inside', 'outside', 'racing']) {
    if (nom === S.ligne) continue;
    trace(nom, 2, 0.45);
  }
  trace(S.ligne, 3, 1);

  // les points de contrôle de la ligne modifiée
  for (const p of S.pts[S.ligne]) {
    const e = versEcran(p);
    ctx.beginPath(); ctx.arc(e[0], e[1], 5, 0, 7);
    ctx.fillStyle = COULEURS[S.ligne]; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#11141c'; ctx.stroke();
  }

  // le sens de la marche, sans quoi on ne sait pas de quel côté est l'intérieur
  const a = versEcran([T.xs[0] / u, T.ys[0] / u]);
  const b = versEcran([T.xs[Math.round(N * 0.02)] / u, T.ys[Math.round(N * 0.02)] / u]);
  ctx.strokeStyle = '#7ed321'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
}

/* L'aperçu : un circuit construit avec les lignes dessinées, donc la vérité.

Il est refait à chaque changement. Le solveur de trajectoire ne tourne pas — un circuit qui porte
ses lignes ne le réveille pas — donc il ne reste que la projection et le limitage, qui sont linéaires
et tiennent largement dans une image. */
function majApercu() {
  const def2 = Object.assign({}, S.def, { lines: {
    racing: S.pts.racing, inside: S.pts.inside, outside: S.pts.outside } });
  try { S.apercu = new Track(def2); } catch (e) { S.apercu = null; }
}

function trace(nom, epais, alpha) {
  const T = S.apercu;
  if (!T || !T.lines[nom]) return;
  const u = T.unitScale, N = T.n;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = COULEURS[nom]; ctx.lineWidth = epais;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const j = i % N, lat = T.lines[nom][j];
    const p = versEcran([(T.xs[j] + T.nx[j] * lat) / u, (T.ys[j] + T.ny[j] * lat) / u]);
    i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
  }
  ctx.closePath(); ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------------------------------ les actions */

/** L'échantillon de l'axe le plus proche d'un point, et l'écart latéral qui va avec. */
function projeter(p) {
  const T = S.track, u = T.unitScale;
  let best = Infinity, j = 0;
  for (let i = 0; i < T.n; i++) {
    const d = (T.xs[i] / u - p[0]) ** 2 + (T.ys[i] / u - p[1]) ** 2;
    if (d < best) { best = d; j = i; }
  }
  const lat = ((p[0] - T.xs[j] / u) * T.nx[j] + (p[1] - T.ys[j] / u) * T.ny[j]) * u;
  return { j, lat };
}

/** Ramène chaque point sur la piste, en gardant la marge que le jeu garde lui-même. */
function dansPiste() {
  const T = S.track, u = T.unitScale, marge = 1.7;
  S.pts[S.ligne] = S.pts[S.ligne].map((p) => {
    const { j, lat } = projeter(p);
    const hi = Math.max(0.2, T.hwL[j] - marge), lo = -Math.max(0.2, T.hwR[j] - marge);
    const l = Math.max(lo, Math.min(hi, lat));
    return [(T.xs[j] + T.nx[j] * l) / u, (T.ys[j] + T.ny[j] * l) / u];
  });
  dessiner();
}

/* Lisser agit sur l'écart à l'axe, pas sur les points eux-mêmes.

Moyenner les coordonnées rétrécirait la boucle — un cercle dont on moyenne les points voisins
devient un cercle plus petit — ce qui décollerait la ligne de la piste à chaque passage. L'écart
latéral, lui, se moyenne sans rien rétrécir : la ligne reste sur le tracé, elle y serpente moins. */
function lisser() {
  const T = S.track, u = T.unitScale;
  const proj = S.pts[S.ligne].map(projeter);
  const n = proj.length;
  const lat = proj.map((p, i) => {
    const a = proj[(i - 1 + n) % n].lat, b = proj[i].lat, c = proj[(i + 1) % n].lat;
    return a * 0.25 + b * 0.5 + c * 0.25;
  });
  S.pts[S.ligne] = proj.map((p, i) => {
    const j = p.j;
    return [(T.xs[j] + T.nx[j] * lat[i]) / u, (T.ys[j] + T.ny[j] * lat[i]) / u];
  });
  dessiner();
}

/** Rééchantillonne une ligne à n points sans perdre sa forme : on relit la spline courante. */
function reechantillonner(n) {
  for (const nom of ['racing', 'inside', 'outside']) {
    const pts = S.pts[nom];
    if (pts.length < 3) continue;
    const dense = Track.spline(pts, 12);
    const out = [];
    for (let i = 0; i < n; i++) out.push(dense[Math.round(i * dense.length / n) % dense.length]);
    S.pts[nom] = out;
  }
  dessiner();
}

// Trois décimales : une unité de `pts` vaut une quinzaine de mètres sur un circuit intégré, donc
// deux décimales laissaient un arrondi de quinze centimètres — assez pour qu'exporter puis relire ne
// redonne pas tout à fait la même ligne.
const arrondi = (v) => Math.round(v * 1000) / 1000;

function exporter() {
  const l = (nom) => '      ' + nom + ': [' +
    S.pts[nom].map((p) => `[${arrondi(p[0])}, ${arrondi(p[1])}]`).join(', ') + '],';
  const txt = '    lines: {\n' + ['racing', 'inside', 'outside'].map(l).join('\n') + '\n    },';
  $('sortie').value = txt;
  etat(`bloc produit pour ${S.def.name} — ${S.pts.racing.length} points par ligne`);
}

function relire() {
  const txt = $('sortie').value.trim();
  try {
    // On accepte le bloc tel qu'il sera collé dans `tracks.js`, accolade de `lines` comprise.
    const m = txt.match(/lines\s*:\s*(\{[\s\S]*\})\s*,?\s*$/);
    const obj = JSON.parse((m ? m[1] : txt).replace(/(\w+)\s*:/g, '"$1":').replace(/,(\s*[}\]])/g, '$1'));
    let n = 0;
    for (const nom of ['racing', 'inside', 'outside']) {
      if (Array.isArray(obj[nom]) && obj[nom].length >= 3) { S.pts[nom] = obj[nom].map((p) => [+p[0], +p[1]]); n++; }
    }
    if (!n) throw new Error('aucune ligne reconnue');
    etat(`${n} ligne(s) relue(s)`);
    dessiner();
  } catch (e) {
    etat('bloc illisible : ' + e.message);
  }
}

function etat(s) { $('etat').textContent = s; }

/* ------------------------------------------------- fabriquer le fichier, plutôt que le coller

Une page servie par GitHub Pages ne peut pas écrire dans `js/tracks.js` — il n'y a pas de serveur
au bout, seulement des fichiers. Mais elle peut fabriquer le fichier : le relire tel qu'il est
servi, y poser les lignes au bon endroit, et le rendre à télécharger. Il ne reste qu'à le remettre
dans le dépôt, sans copier-coller et sans risque de le coller au mauvais endroit.

Toutes les lignes enregistrées y passent d'un coup, et pas seulement celle qu'on regarde : sinon,
retoucher trois circuits demanderait trois téléchargements dont chacun repartirait du fichier servi
et effacerait les deux autres.

La découpe se fait au comptage d'accolades, en sautant ce qui est entre guillemets. Une définition
de circuit est un objet littéral et rien d'autre ; chercher la fin d'un objet à l'expression
régulière, en revanche, marche jusqu'au jour où ça ne marche plus. */
function finObjet(txt, debut) {
  let prof = 0, dans = null;
  for (let i = debut; i < txt.length; i++) {
    const c = txt[i];
    if (dans) {                                   // dans une chaîne : on n'y compte rien
      if (c === '\\') i++;
      else if (c === dans) dans = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { dans = c; continue; }
    if (c === '{' || c === '[') prof++;
    else if (c === '}' || c === ']') { prof--; if (prof === 0) return i; }
  }
  return -1;
}

/** Le texte du bloc `lines` pour un jeu de points, indenté comme le fichier. */
function blocPour(pts) {
  const l = (nom) => '      ' + nom + ': [' +
    pts[nom].map((p) => `[${arrondi(p[0])}, ${arrondi(p[1])}]`).join(', ') + '],';
  return '    lines: {\n' + ['racing', 'inside', 'outside'].map(l).join('\n') + '\n    },';
}

/** Pose — ou remplace — le bloc `lines` d'un circuit dans le texte de `js/tracks.js`. */
function poserDansFichier(txt, id, pts) {
  const tete = txt.indexOf(`id: '${id}'`);
  if (tete < 0) throw new Error(`circuit ${id} introuvable dans js/tracks.js`);
  const ouvre = txt.lastIndexOf('{', tete);
  const ferme = finObjet(txt, ouvre);
  if (ferme < 0) throw new Error(`définition de ${id} mal formée`);
  let corps = txt.slice(ouvre, ferme + 1);
  const bloc = blocPour(pts);
  const dejaLa = corps.indexOf('lines:');
  if (dejaLa >= 0) {
    // remplacer le bloc existant, bornes comprises
    const debLigne = corps.lastIndexOf('\n', dejaLa) + 1;
    const finBloc = finObjet(corps, corps.indexOf('{', dejaLa));
    const apres = corps.indexOf('\n', finBloc);
    corps = corps.slice(0, debLigne) + bloc + '\n' + corps.slice(apres + 1);
  } else {
    // poser juste avant l'accolade fermante de la définition
    const avantFin = corps.lastIndexOf('\n', corps.length - 2) + 1;
    corps = corps.slice(0, avantFin) + bloc + '\n' + corps.slice(avantFin);
  }
  return txt.slice(0, ouvre) + corps + txt.slice(ferme + 1);
}

async function fabriquerFichier() {
  let reprises;
  try { reprises = await Store.list('lines'); } catch (_) { reprises = []; }
  // celle qu'on regarde compte, même si elle n'est pas encore posée
  const enCours = { id: S.def.id, lines: S.pts };
  const toutes = [...reprises.filter((r) => r.id !== enCours.id), enCours];
  const r = await fetch('js/tracks.js');
  if (!r.ok) throw new Error('js/tracks.js illisible (' + r.status + ')');
  let txt = await r.text();
  for (const t of toutes) txt = poserDansFichier(txt, t.id, t.lines);
  return { txt, n: toutes.length, ids: toutes.map((t) => t.id) };
}

/* ------------------------------------------------- enregistrer pour jouer, ici et maintenant

Deux « enregistrer », et ils ne servent pas à la même chose. Celui-ci pose la ligne dans la base du
navigateur, à côté des circuits perso : le circuit est modifié dès la partie suivante, sur ce poste,
sans rien publier. L'autre est le bloc à coller dans `js/tracks.js`, qui seul fait que la ligne vaut
pour tout le monde et survit à un autre navigateur.

La distinction est dite plutôt que devinée, parce que les deux se ressemblent à l'usage et que
découvrir six mois plus tard qu'une trajectoire n'existait que dans un navigateur coûte cher. */
async function poser() {
  try {
    await Store.put('lines', { id: S.def.id, at: Date.now(), lines: {
      racing: S.pts.racing.map((p) => [arrondi(p[0]), arrondi(p[1])]),
      inside: S.pts.inside.map((p) => [arrondi(p[0]), arrondi(p[1])]),
      outside: S.pts.outside.map((p) => [arrondi(p[0]), arrondi(p[1])]),
    } });
    majPose();
    etat(`${S.def.name} : ligne enregistrée pour ce navigateur`);
  } catch (e) { etat('enregistrement impossible : ' + e.message); }
}

async function oublier() {
  try {
    await Store.del('lines', S.def.id);
    majPose();
    etat(`${S.def.name} : le jeu revient à sa ligne calculée`);
  } catch (e) { etat('suppression impossible : ' + e.message); }
}

/** Dit si le circuit affiché porte déjà une ligne enregistrée, et propose de la reprendre. */
async function majPose() {
  let r = null;
  try { r = await Store.get('lines', S.def.id); } catch (_) { /* base indisponible */ }
  const el = $('pose');
  if (!r) { el.textContent = 'Aucune ligne enregistrée pour ce circuit.'; return; }
  const quand = new Date(r.at || Date.now()).toLocaleString();
  el.innerHTML = `Ligne enregistrée le ${quand}. <a href="#" id="reprendre">La reprendre ici</a>`;
  $('reprendre').addEventListener('click', (ev) => {
    ev.preventDefault();
    for (const nom of ['racing', 'inside', 'outside']) {
      if (Array.isArray(r.lines[nom])) S.pts[nom] = r.lines[nom].map((p) => [+p[0], +p[1]]);
    }
    $('nPts').value = S.pts.racing.length;
    dessiner();
    etat('ligne enregistrée reprise');
  });
}

/* --------------------------------------------------------------------------- les évènements */

function redimensionner() {
  const r = cv.getBoundingClientRect();
  cv.width = Math.round(r.width * devicePixelRatio);
  cv.height = Math.round(r.height * devicePixelRatio);
  if (S.track) { cadrer(); dessiner(); }
}

function pointVise(x, y) {
  let best = 12 * 12, k = -1;
  S.pts[S.ligne].forEach((p, i) => {
    const e = versEcran(p);
    const d = (e[0] - x) ** 2 + (e[1] - y) ** 2;
    if (d < best) { best = d; k = i; }
  });
  return k;
}

cv.addEventListener('pointerdown', (ev) => {
  const r = cv.getBoundingClientRect();
  const x = ev.clientX - r.left, y = ev.clientY - r.top;
  const k = pointVise(x, y);
  if (ev.button === 2) {
    if (k >= 0) {
      // ramener ce point sur la ligne que le jeu calcule
      const auto = autoPoints(S.ligne, S.pts[S.ligne].length);
      S.pts[S.ligne][k] = auto[k];
      dessiner();
    }
    return;
  }
  if (k >= 0) { S.prise = k; cv.setPointerCapture(ev.pointerId); }
  else { S.glisse = [x, y, S.vue.x, S.vue.y]; cv.setPointerCapture(ev.pointerId); }
});

cv.addEventListener('pointermove', (ev) => {
  const r = cv.getBoundingClientRect();
  const x = ev.clientX - r.left, y = ev.clientY - r.top;
  if (S.prise != null) { S.pts[S.ligne][S.prise] = versPiste(x, y); dessiner(); }
  else if (S.glisse) { S.vue.x = S.glisse[2] + (x - S.glisse[0]); S.vue.y = S.glisse[3] + (y - S.glisse[1]); dessiner(); }
});

const relacher = () => { S.prise = null; S.glisse = null; };
cv.addEventListener('pointerup', relacher);
cv.addEventListener('pointercancel', relacher);
cv.addEventListener('contextmenu', (e) => e.preventDefault());

cv.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const r = cv.getBoundingClientRect();
  const x = ev.clientX - r.left, y = ev.clientY - r.top;
  const avant = versPiste(x, y);
  S.vue.k *= Math.exp(-ev.deltaY * 0.0015);
  const apres = versPiste(x, y);
  S.vue.x += (apres[0] - avant[0]) * S.vue.k;
  S.vue.y += (apres[1] - avant[1]) * S.vue.k;
  dessiner();
}, { passive: false });

window.addEventListener('resize', redimensionner);

/* ------------------------------------------------------------------------------- la mise en place */

for (const t of TRACKS) {
  const o = document.createElement('option');
  o.value = t.id; o.textContent = `${t.flag || '🏁'} ${t.name}`;
  $('circuit').appendChild(o);
}
$('circuit').addEventListener('change', () => { charger($('circuit').value, false); majPose(); });

for (const nom of ['racing', 'inside', 'outside']) {
  const b = document.createElement('button');
  b.innerHTML = `<span class="sw" style="background:${COULEURS[nom]}"></span>${NOMS[nom]}`;
  b.addEventListener('click', () => {
    S.ligne = nom;
    [...$('choixLigne').children].forEach((c, i) => c.classList.toggle('sel', ['racing', 'inside', 'outside'][i] === nom));
    dessiner();
  });
  $('choixLigne').appendChild(b);
}
$('choixLigne').firstChild.classList.add('sel');

$('nPts').addEventListener('change', () => reechantillonner(+$('nPts').value));
$('auto').addEventListener('click', () => { S.pts[S.ligne] = autoPoints(S.ligne, +$('nPts').value); dessiner(); etat(`${NOMS[S.ligne]} revenue au calcul`); });
$('toutAuto').addEventListener('click', () => { charger($('circuit').value, false); etat('les trois lignes revenues au calcul'); });
$('lisser').addEventListener('click', lisser);
$('dansPiste').addEventListener('click', dansPiste);
$('exporter').addEventListener('click', exporter);
$('charger').addEventListener('click', relire);
$('fichier').addEventListener('click', async () => {
  try {
    const { txt, n, ids } = await fabriquerFichier();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/javascript' }));
    a.download = 'tracks.js';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    etat(`tracks.js fabriqué avec ${n} circuit(s) : ${ids.join(', ')} — à remettre dans js/`);
  } catch (e) { etat('fabrication impossible : ' + e.message); }
});
$('poser').addEventListener('click', poser);
$('oublier').addEventListener('click', oublier);
// « Essayer » ouvre le jeu sur ce circuit. La ligne enregistrée est relue au démarrage, donc ce
// qu'on vient de poser est ce qu'on va conduire.
$('essayer').addEventListener('click', async () => { await poser(); window.open('index.html?track=' + S.def.id, '_blank'); });
$('copier').addEventListener('click', async () => {
  if (!$('sortie').value) exporter();
  try { await navigator.clipboard.writeText($('sortie').value); etat('copié'); }
  catch (_) { $('sortie').select(); etat('copie refusée par le navigateur — sélectionné, fais Ctrl+C'); }
});

redimensionner();
charger(TRACKS[0].id, false);
majPose();
