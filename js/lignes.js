/* Éditeur de lignes et de panneaux — reprendre à la main ce que le jeu déduit d'un circuit.

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

LES PANNEAUX suivent la même règle, pour la même raison. Ils sont déduits de la géométrie : la
flèche montre le sens du PREMIER virage d'une zone de freinage, son pliage vient du plus serré. Ça
marche partout, sauf quand une amorce molle précède le vrai virage dans l'autre sens — l'annonce
part alors du mauvais côté, et aucun réglage ne rattrape ça. On reprend donc la liste à la main, et
dès qu'un circuit la porte le générateur ne tourne plus pour lui. Une liste vide est une liste vide.

AU DOIGT. La page se tenait à la souris : molette pour zoomer, clic droit pour annuler un point,
un panneau de trois cent vingt pixels collé au bord. Sur un téléphone, le zoom n'existait pas, le
clic droit non plus, et la moitié de l'écran était du texte. Le panneau est devenu un tiroir qu'on
remonte, le zoom se fait à deux doigts, l'appui long remplace le clic droit, et les cibles sont
dimensionnées pour un doigt plutôt que pour un curseur — un point de contrôle se vise à douze pixels
à la souris, il en faut vingt-deux au doigt.
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
  mode: 'lignes',       // 'lignes' ou 'panneaux'
  panneaux: [],         // { at, dist, note, sign } — la liste reprise, ou celle du calcul
  panModif: false,      // vrai dès qu'on y a touché : sinon on n'enregistre rien et le jeu calcule
  selP: null,           // le panneau choisi
  doigts: new Map(),    // les contacts en cours, pour le pincement
  pince: null,          // l'écartement et le centre au début du pincement
  appui: null,          // l'appui long en cours
  viseur: null,         // la station visée, pour poser un panneau à l'endroit exact
  mesure: [],           // zéro, une ou deux stations : la règle
};

const CHIFFRES = [1, 2, 3, 4, 5, 6];
const NOMMES = ['square', 'hairpin', 'acute', 'chicane'];
const NOM_NOTE = { square: 'SQ · à angle droit', hairpin: 'HP · épingle', acute: 'AC · refermé',
  chicane: 'CH · chicane' };
/* GAUCHE OU DROITE SE LIT DU PREMIER PLI, pour une chicane comme pour tout le reste : c'est le même
   réglage de sens, et il n'y a donc pas deux entrées « chicane gauche » et « chicane droite » dans
   la liste. Les libellés du sens le disent en toutes lettres quand une chicane est choisie —
   « gauche-droite » plutôt que « gauche » — sinon le mot « gauche » seul ne dirait pas de quoi il
   parle pour une courbe qui va des deux côtés. */
const SENS_NOM = { '-1': 'gauche', 1: 'droite' };
const SENS_CHICANE = { '-1': 'gauche-droite', 1: 'droite-gauche' };
/* LA QUATRIÈME VALEUR EST L'ABSENCE DE VALEUR. Deux virages qui s'enchaînent sont à moins de
   cinquante mètres : annoncer une distance y serait faux, l'arrondir à 50 mentirait. Zéro note
   « sans chiffre », et l'indication se réduit alors au sens et à la sévérité. */
const DISTANCES = [200, 100, 50, 0];
const NOM_DIST = { 0: '—' };
const TACTILE = matchMedia('(pointer: coarse)').matches;
const VISEE = TACTILE ? 22 : 12;   // le rayon de visée, en pixels : un doigt n'est pas un curseur

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

/* Une entrée de liste, du format du fichier vers celui de l'éditeur. `tracks.js` en porte des deux
   formes — le tableau court, et l'objet nommé — et `Track._panneauxPoses` accepte les deux : on
   relit donc comme lui, sinon l'éditeur ouvrirait un circuit sur une liste vide sans rien dire. */
const versEditeur = (p) => (Array.isArray(p)
  ? { at: +p[0], dist: +p[1], note: p[2], sign: +p[3] }
  : { at: +p.at, dist: +p.dist,
    note: p.note != null ? p.note : (p.kind && p.kind !== 'normal' ? p.kind : p.grade), sign: +p.sign });

function charger(id, garderPts) {
  S.def = TRACKS.find((t) => t.id === id) || TRACKS[0];
  // Le circuit est construit SANS ses lignes explicites, pour que « revenir au calcul » veuille
  // toujours dire la même chose : ce que le solveur propose, et non ce qu'on a déjà dessiné.
  const nu = Object.assign({}, S.def);
  delete nu.lines;
  delete nu.panneaux;      // idem pour les panneaux : `boards` doit être le calcul, pas la reprise
  S.track = new Track(nu);
  $('circuit').value = S.def.id;         // le sélecteur suit, même quand on charge par code
  const n = +$('nPts').value;
  if (!garderPts) for (const nom of ['racing', 'inside', 'outside']) S.pts[nom] = autoPoints(nom, n);
  if (!garderPts) {
    /* L'ÉDITEUR OUVRE SUR CE QUE LE JEU JOUE, pas sur ce que le jeu calculerait.

    Il partait toujours du calcul. Pour les cinq circuits dont `tracks.js` porte une liste reprise à
    la main, il montrait donc autre chose que la course : six panneaux de moins à Monaco, deux au
    Mans, trois de trop à Zandvoort. C'est exactement le symptôme — « des panneaux en plus
    apparaissent en jeu » — et ce n'était pas un défaut d'affichage : enregistrer depuis cet état
    aurait REMPLACÉ la liste reprise par le calcul, sans prévenir.

    L'ordre est celui du jeu : la reprise locale d'abord (posée un peu plus tard, parce qu'elle vient
    d'une base asynchrone), puis la liste du fichier, puis le calcul. `panModif` dit d'où ça vient —
    vrai pour une liste reprise, qu'il faut réenregistrer telle quelle, faux pour le calcul, que le
    jeu refera tout seul. */
    S.panneaux = Array.isArray(S.def.panneaux) ? S.def.panneaux.map(versEditeur) : panneauxDuCalcul();
    S.panModif = Array.isArray(S.def.panneaux);
    S.selP = null;
  }
  cadrer();
  majFicheP();
  dessiner();
}

/* ------------------------------------------------------------------------------ les panneaux */

/** La note d'un panneau calculé : le chiffre de rallye, ou le nom du virage nommé. */
const noteDe = (b) => (b.kind && b.kind !== 'normal' ? b.kind : b.grade);

/** Les panneaux tels que le jeu les déduit, dans la forme que l'éditeur manipule. */
function panneauxDuCalcul() {
  // Le circuit de travail est construit SANS `panneaux`, donc `boards` est bien le calcul.
  return S.track.boards.map((b) => ({ at: b.at, dist: b.dist, note: noteDe(b), sign: b.sign }));
}

/** Où chaque panneau se plante, par le code du jeu et non par une copie de ce code. */
function panneauxPoses() {
  return S.track._panneauxPoses(S.panneaux.map((p) => [p.at, p.dist, p.note, p.sign]));
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

  // les points de contrôle de la ligne modifiée — seulement quand c'est elle qu'on modifie
  if (S.mode === 'lignes') {
    /* Le rayon d'un point suit l'écartement à l'écran. Posé à huit pixels pour le doigt, il
       donnait un collier de perles dès qu'on dézoomait : quarante-huit points sur un circuit qui
       tient dans trois cents pixels sont à six pixels l'un de l'autre, et des pastilles de seize
       se chevauchent. On ne peut pas viser ce qu'on ne distingue pas. */
    const ptsL = S.pts[S.ligne];
    let esp = 0;
    for (let i = 0; i < ptsL.length; i++) {
      const a = versEcran(ptsL[i]), b = versEcran(ptsL[(i + 1) % ptsL.length]);
      esp += Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
    esp /= Math.max(1, ptsL.length);
    const r = Math.max(2.5, Math.min(TACTILE ? 8 : 5, esp * 0.42));
    for (const p of S.pts[S.ligne]) {
      const e = versEcran(p);
      ctx.beginPath(); ctx.arc(e[0], e[1], r, 0, 7);
      ctx.fillStyle = COULEURS[S.ligne]; ctx.fill();
      ctx.lineWidth = Math.min(1.5, r * 0.3); ctx.strokeStyle = '#11141c'; ctx.stroke();
    }
  } else {
    const poses = panneauxPoses();
    poses.forEach((b, i) => dessinerPanneau(b, i === S.selP));
  }

  dessinerMesure();
  dessinerViseur();

  // le sens de la marche, sans quoi on ne sait pas de quel côté est l'intérieur
  const a = versEcran([T.xs[0] / u, T.ys[0] / u]);
  const b = versEcran([T.xs[Math.round(N * 0.02)] / u, T.ys[Math.round(N * 0.02)] / u]);
  ctx.strokeStyle = '#7ed321'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
}

/* ------------------------------------------------------------------- le viseur et la règle

LE VISEUR EXISTE PARCE QU'UN PANNEAU SE POSAIT « AU MILIEU DE LA VUE ».

C'était la seule façon d'en placer un, et elle ne dit rien : le milieu de la vue dépend du zoom, du
déplacement, de la hauteur du tiroir. Pour annoncer un virage à cent mètres, il faut pouvoir désigner
une station, pas une région. Le viseur se pose donc sur la STATION LA PLUS PROCHE de l'endroit
touché — il colle à l'axe de la piste, puisque c'est le long de l'axe que tout se mesure — et il
affiche sa position en mètres depuis la ligne de départ.

Un appui qui ne glisse pas pose le viseur ; un appui qui glisse déplace la carte. Pas de mode
supplémentaire pour ça : la différence entre les deux gestes est déjà dans le geste. */

const stationDe = (x, y) => projeter(versPiste(x, y)).j;

/** La position d'une station en mètres depuis la ligne de départ. */
const metresDe = (j) => j * S.track.ds;

function dessinerViseur() {
  if (S.viseur == null || S.mode !== 'panneaux' || !S.track) return;
  const T = S.track, u = T.unitScale, j = S.viseur % T.n;
  const e = versEcran([T.xs[j] / u, T.ys[j] / u]);
  ctx.save();
  ctx.strokeStyle = '#7ed321'; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(e[0] - 11, e[1]); ctx.lineTo(e[0] - 4, e[1]);
  ctx.moveTo(e[0] + 4, e[1]); ctx.lineTo(e[0] + 11, e[1]);
  ctx.moveTo(e[0], e[1] - 11); ctx.lineTo(e[0], e[1] - 4);
  ctx.moveTo(e[0], e[1] + 4); ctx.lineTo(e[0], e[1] + 11);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(e[0], e[1], 3, 0, 7); ctx.fillStyle = '#7ed321'; ctx.fill();
  ctx.restore();
}

/* LA RÈGLE DONNE DEUX DISTANCES, et elle dit laquelle est laquelle.

Le long du tour, c'est ce qu'un panneau annonce et ce qu'une voiture parcourt. À vol d'oiseau, c'est
ce que l'œil croit lire sur la carte. Dans une épingle les deux vont du simple au double, et une
règle qui n'en donnerait qu'une serait une règle qui trompe une fois sur deux.

Elle reste dessinée dans les autres volets, en plus discret : on mesure POUR placer un panneau, et
une règle qui s'efface quand on change de volet oblige à retenir le nombre. */
function dessinerMesure() {
  if (!S.track || !S.mesure.length) return;
  const T = S.track, u = T.unitScale, actif = S.mode === 'mesure';
  const pt = (j) => versEcran([T.xs[j % T.n] / u, T.ys[j % T.n] / u]);
  ctx.save();
  ctx.globalAlpha = actif ? 1 : 0.45;
  if (S.mesure.length === 2) {
    const [a, b] = S.mesure;
    // le trajet le long de l'axe, dans le sens de la marche
    ctx.strokeStyle = '#ff9f1c'; ctx.lineWidth = actif ? 4 : 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    const n = ((b - a) % T.n + T.n) % T.n;
    for (let i = 0; i <= n; i++) {
      const e = pt(a + i);
      i ? ctx.lineTo(e[0], e[1]) : ctx.moveTo(e[0], e[1]);
    }
    ctx.stroke();
    // la corde, en pointillé : c'est l'autre réponse à la même question
    const ea = pt(a), eb = pt(b);
    ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.moveTo(ea[0], ea[1]); ctx.lineTo(eb[0], eb[1]); ctx.stroke();
    ctx.setLineDash([]);
  }
  S.mesure.forEach((j, i) => {
    const e = pt(j);
    ctx.beginPath(); ctx.arc(e[0], e[1], actif ? 6 : 4, 0, 7);
    ctx.fillStyle = '#ff9f1c'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#11141c'; ctx.stroke();
    if (actif) {
      ctx.fillStyle = '#11141c';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(i ? 'B' : 'A', e[0], e[1]);
    }
  });
  ctx.restore();
}

function majFicheM() {
  const n = S.mesure.length;
  $('aideM').hidden = n === 2;
  $('ficheM').hidden = n !== 2;
  if (n !== 2) return;
  const T = S.track, [a, b] = S.mesure;
  const av = (((b - a) % T.n + T.n) % T.n) * T.ds;
  const re = T.length - av;
  const dx = T.xs[b % T.n] - T.xs[a % T.n], dy = T.ys[b % T.n] - T.ys[a % T.n];
  $('mLong').textContent = av.toFixed(1) + ' m';
  $('mRetour').textContent = re.toFixed(1) + ' m';
  $('mDroit').textContent = Math.hypot(dx, dy).toFixed(1) + ' m';
}

/* L'ANNONCE CONTRE LA RÉALITÉ.

Un panneau dit « 100 m ». La seule question qui compte est s'il est vraiment à cent mètres de
l'entrée du virage qu'il annonce — et posé à la main, il ne l'est presque jamais. Les panneaux
calculés le sont par construction ; c'est exactement pour ça que l'écart ne se voyait pas, et que
les panneaux repris à la main pouvaient dériver sans que rien ne proteste.

L'entrée du virage se lit du même découpage que le jeu utilise pour ses propres panneaux
(`Track.zonesVirages`), sinon on vérifierait une annonce contre une définition qui n'est pas celle
qui l'a produite. */
function verifPanneau(b) {
  const T = S.track;
  if (!T.zonesVirages) return '';
  const zones = T.zonesVirages(60);
  if (!zones.length) return '';
  /* LA DISTANCE EST SIGNÉE, et c'est tout l'intérêt.

  Première version : la prochaine entrée de virage DEVANT. Pour un panneau posé un peu après une
  entrée — c'est-à-dire déjà dans le virage, la faute la plus courante — elle sautait à l'entrée
  suivante et annonçait deux cents mètres d'écart là où il n'y en avait que dix de trop. Elle
  accusait de loin ce qui était en fait tout près, du mauvais côté.

  On prend donc l'entrée la PLUS PROCHE, devant ou derrière, et on garde le signe. Un nombre négatif
  dit la seule chose qui compte alors : le panneau est posé dans le virage qu'il annonce. */
  const j = Math.round(b.at * T.n);
  let best = Infinity;
  for (const z of zones) {
    const e = (((z.from % T.n) + T.n) % T.n);
    let d = (((e - j) % T.n) + T.n) % T.n;
    if (d > T.n / 2) d -= T.n;
    if (Math.abs(d) < Math.abs(best)) best = d;
  }
  const reel = best * T.ds;
  // sans annonce il n'y a rien à comparer, mais la distance réelle reste ce qu'on veut savoir :
  // c'est elle qui dit si « sans chiffre » était le bon choix
  if (reel < 0) {
    const dedans = `posé ${(-reel).toFixed(0)} m DANS le virage`;
    return b.dist > 0 ? `annoncé ${b.dist} m · ${dedans}` : `sans chiffre · ${dedans}`;
  }
  if (!(b.dist > 0)) return `sans chiffre · virage à ${reel.toFixed(0)} m`;
  const ecart = reel - b.dist;
  const signe = ecart >= 0 ? '+' : '−';
  return `annoncé ${b.dist} m · réel ${reel.toFixed(0)} m (${signe}${Math.abs(ecart).toFixed(0)})`;
}

/* Un panneau, dessiné par le code du jeu.

La flèche vient de `Renderer.paceArrow`, celle-là même qui la trace en course — c'est pour ça que
cette page charge `js/render.js`. Redessiner un glyphe approchant ici aurait coûté moins cher et
aurait menti : on règle une annonce à ce qu'elle a l'air, et deux dessins différents divergent au
premier changement.

La taille est en pixels d'écran et non en unités de piste : un panneau fait cinq mètres de côté sur
la route, ce qui, dézoomé sur un circuit entier, tiendrait dans un pixel. Ici il doit rester visible
et touchable quel que soit le zoom. */
const PAN_TAILLE = 30;

function dessinerPanneau(b, choisi) {
  const u = S.track.unitScale;
  /* POSÉ SUR L'AXE, comme le marquage qu'il représente. Il était dessiné au bas-côté, du temps où
  le jeu y plantait un panneau. Maintenant que l'indication est peinte sur la piste, le laisser à
  côté voudrait dire que l'éditeur montre une position et le jeu une autre — et le viseur, qui colle
  à l'axe, ne tomberait jamais sur la carte qu'on vient de déplacer. */
  const e = versEcran([(b.cx != null ? b.cx : b.x) / u, (b.cy != null ? b.cy : b.y) / u]);
  const W = PAN_TAILLE, H = W * 1.23, spec = Renderer.ARROWS[noteDe(b)] || Renderer.ARROWS[3];
  ctx.save();
  ctx.translate(e[0], e[1]);
  ctx.rotate(b.th + Math.PI / 2);
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-W / 2, -H / 2, W, H, 3.5); else ctx.rect(-W / 2, -H / 2, W, H);
  ctx.fillStyle = '#f2f2ee'; ctx.fill();
  ctx.lineWidth = choisi ? 3 : 1.4;
  ctx.strokeStyle = choisi ? '#7ed321' : '#11141c';
  ctx.stroke();
  // sans chiffre, la flèche se recentre — comme le marquage qu'elle représente
  const chiffre = b.dist > 0;
  // la carte montre le marquage, donc blanche et épaisse comme lui ; la couleur des notes reste sur
  // les BOUTONS du volet, là où elle sert à choisir
  Renderer.paceArrow(ctx, { x: 0, y: H * (chiffre ? -0.24 : -0.06), w: W * 0.78, h: H * (chiffre ? 0.40 : 0.52) },
    spec, b.sign > 0 ? 1 : -1, { col: '#2a2d36', epais: 0.78 });
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (chiffre) {
    ctx.fillStyle = '#11141c';
    ctx.font = `bold ${Math.round(W * 0.31)}px "Trebuchet MS", sans-serif`;
    ctx.fillText(String(b.dist), 0, H * 0.30);
  }
  if (spec.tag) {
    ctx.fillStyle = '#2a2d36';
    ctx.font = `bold ${Math.round(W * 0.19)}px "Trebuchet MS", sans-serif`;
    ctx.fillText(spec.tag, 0, H * (chiffre ? 0.06 : 0.33));
  }
  ctx.restore();
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
// Une fraction de tour, elle, se compte sur la longueur entière : quatre décimales valent un
// mètre sur un circuit de dix kilomètres, ce qui est plus fin que la largeur d'un panneau.
const arrondi4 = (v) => Math.round(v * 10000) / 10000;

function exporter() {
  if (S.mode === 'panneaux') {
    $('sortie').value = blocPanneaux(panneauxPlats());
    etat(`bloc produit pour ${S.def.name} — ${S.panneaux.length} panneau(x)`);
    return;
  }
  $('sortie').value = blocPour(S.pts);
  etat(`bloc produit pour ${S.def.name} — ${S.pts.racing.length} points par ligne`);
}

function relire() {
  const txt = $('sortie').value.trim();
  const mp = txt.match(/panneaux\s*:\s*(\[[\s\S]*\])\s*,?\s*$/);
  if (mp) {
    try {
      const liste = JSON.parse(mp[1].replace(/'/g, '"').replace(/,(\s*[}\]])/g, '$1'));
      S.panneaux = liste.map(([at, dist, note, sign]) => ({ at: +at, dist: +dist, note, sign: +sign }));
      S.panModif = true; S.selP = null;
      majFicheP(); dessiner();
      etat(`${S.panneaux.length} panneau(x) relu(s)`);
    } catch (e) { etat('bloc de panneaux illisible : ' + e.message); }
    return;
  }
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

/** Le texte du bloc `lines` pour un jeu de points, indenté comme le fichier. */
function blocPour(pts) {
  const l = (nom) => '      ' + nom + ': [' +
    pts[nom].map((p) => `[${arrondi(p[0])}, ${arrondi(p[1])}]`).join(', ') + '],';
  return '    lines: {\n' + ['racing', 'inside', 'outside'].map(l).join('\n') + '\n    },';
}

/** Le bloc `panneaux` : une ligne par panneau, pour qu'un diff dise lequel a bougé. */
function blocPanneaux(liste) {
  const l = (p) => `      [${arrondi4(p[0])}, ${p[1]}, ${typeof p[2] === 'number' ? p[2] : `'${p[2]}'`}, ${p[3]}],`;
  if (!liste.length) return '    panneaux: [],';
  return '    panneaux: [\n' + liste.map(l).join('\n') + '\n    ],';
}

/** Remplace — ou pose — un bloc nommé dans le corps d'une définition de circuit. */
function poserBloc(corps, cle, bloc) {
  const dejaLa = corps.indexOf(cle + ':');
  if (dejaLa >= 0) {
    const debLigne = corps.lastIndexOf('\n', dejaLa) + 1;
    const a = corps.indexOf('{', dejaLa), b = corps.indexOf('[', dejaLa);
    const ouvre = a < 0 ? b : b < 0 ? a : Math.min(a, b);
    const finBloc = finObjet(corps, ouvre);
    const apres = corps.indexOf('\n', finBloc);
    return corps.slice(0, debLigne) + bloc + '\n' + corps.slice(apres + 1);
  }
  // poser juste avant l'accolade fermante de la définition
  const avantFin = corps.lastIndexOf('\n', corps.length - 2) + 1;
  return corps.slice(0, avantFin) + bloc + '\n' + corps.slice(avantFin);
}

/** Pose — ou remplace — les blocs repris d'un circuit dans le texte de `js/tracks.js`. */
function poserDansFichier(txt, id, repris) {
  const tete = txt.indexOf(`id: '${id}'`);
  if (tete < 0) throw new Error(`circuit ${id} introuvable dans js/tracks.js`);
  const ouvre = txt.lastIndexOf('{', tete);
  const ferme = finObjet(txt, ouvre);
  if (ferme < 0) throw new Error(`définition de ${id} mal formée`);
  let corps = txt.slice(ouvre, ferme + 1);
  if (repris.lines) corps = poserBloc(corps, 'lines', blocPour(repris.lines));
  if (repris.panneaux) corps = poserBloc(corps, 'panneaux', blocPanneaux(repris.panneaux));
  return txt.slice(0, ouvre) + corps + txt.slice(ferme + 1);
}

async function fabriquerFichier() {
  let lignes = [], pans = [];
  try { lignes = await Store.list('lines'); } catch (_) { /* base indisponible */ }
  try { pans = await Store.list('panneaux'); } catch (_) { /* base indisponible */ }
  const par = new Map();
  const pour = (id) => { if (!par.has(id)) par.set(id, {}); return par.get(id); };
  for (const r of lignes) pour(r.id).lines = r.lines;
  for (const r of pans) pour(r.id).panneaux = r.panneaux;
  // ce qu'on regarde compte, même si ce n'est pas encore posé
  pour(S.def.id).lines = S.pts;
  if (S.panModif) pour(S.def.id).panneaux = panneauxPlats();
  const r = await fetch('js/tracks.js');
  if (!r.ok) throw new Error('js/tracks.js illisible (' + r.status + ')');
  let txt = await r.text();
  for (const [id, repris] of par) txt = poserDansFichier(txt, id, repris);
  return { txt, n: par.size, ids: [...par.keys()] };
}

/* ------------------------------------------------- enregistrer pour jouer, ici et maintenant

Deux « enregistrer », et ils ne servent pas à la même chose. Celui-ci pose la ligne dans la base du
navigateur, à côté des circuits perso : le circuit est modifié dès la partie suivante, sur ce poste,
sans rien publier. L'autre est le bloc à coller dans `js/tracks.js`, qui seul fait que la ligne vaut
pour tout le monde et survit à un autre navigateur.

La distinction est dite plutôt que devinée, parce que les deux se ressemblent à l'usage et que
découvrir six mois plus tard qu'une trajectoire n'existait que dans un navigateur coûte cher. */
/** La liste des panneaux dans sa forme de fichier : `[fraction, distance, note, sens]`. */
const panneauxPlats = () => S.panneaux.map((p) => [arrondi4(p.at), p.dist, p.note, p.sign]);

async function poser() {
  try {
    await Store.put('lines', { id: S.def.id, at: Date.now(), lines: {
      racing: S.pts.racing.map((p) => [arrondi(p[0]), arrondi(p[1])]),
      inside: S.pts.inside.map((p) => [arrondi(p[0]), arrondi(p[1])]),
      outside: S.pts.outside.map((p) => [arrondi(p[0]), arrondi(p[1])]),
    } });
    // Les panneaux ne s'enregistrent que si on y a touché : sans ça, poser une ligne figerait
    // aussi des panneaux qu'on n'a pas regardés, et le jeu cesserait de les recalculer.
    if (S.panModif) await Store.put('panneaux', { id: S.def.id, at: Date.now(), panneaux: panneauxPlats() });
    majPose();
    etat(`${S.def.name} : enregistré pour ce navigateur`);
  } catch (e) { etat('enregistrement impossible : ' + e.message); }
}

async function oublier() {
  try {
    await Store.del('lines', S.def.id);
    await Store.del('panneaux', S.def.id);
    S.panneaux = panneauxDuCalcul(); S.panModif = false; S.selP = null;
    majFicheP(); majPose(); dessiner();
    etat(`${S.def.name} : le jeu revient à ce qu'il calcule`);
  } catch (e) { etat('suppression impossible : ' + e.message); }
}

/** Dit si le circuit affiché porte déjà une ligne enregistrée, et propose de la reprendre. */
async function majPose() {
  const vise = S.def.id;                 // le circuit demandé, pour ne pas écraser un autre
  let r = null, q = null;
  try { r = await Store.get('lines', S.def.id); } catch (_) { /* base indisponible */ }
  try { q = await Store.get('panneaux', S.def.id); } catch (_) { /* base indisponible */ }
  const el = $('pose');
  if (!r && !q) {
    el.textContent = S.def.panneaux
      ? 'Rien d’enregistré ici : les panneaux affichés sont la liste reprise du fichier.'
      : 'Rien d’enregistré pour ce circuit.';
    return;
  }
  /* LA REPRISE LOCALE S'APPLIQUE TOUTE SEULE, au lieu d'attendre qu'on clique « Reprendre ici ».

  C'est elle que le jeu joue : ouvrir l'éditeur sur autre chose, c'est montrer un circuit qu'on ne
  pilote pas. Et le lien était surtout un piège — qui ne le voyait pas repartait du calcul, et le
  premier enregistrement effaçait son travail précédent sans rien dire.

  On ne l'applique que si rien n'a été touché depuis le chargement, et que le circuit affiché est
  toujours celui qu'on a demandé : la base est asynchrone, et entre la demande et la réponse
  l'éditeur a pu changer de circuit ou être déjà en cours d'édition. */
  if (!S.panModif && q && Array.isArray(q.panneaux) && S.def.id === vise) {
    S.panneaux = q.panneaux.map(versEditeur);
    S.panModif = true; S.selP = null; majFicheP(); dessiner();
  }
  const bouts = [];
  if (r) bouts.push(`ligne du ${new Date(r.at || Date.now()).toLocaleString()}`);
  if (q) bouts.push(`${q.panneaux.length} panneau(x)`);
  el.innerHTML = `Enregistré : ${bouts.join(', ')}. <a href="#" id="reprendre">Reprendre ici</a>`;
  $('reprendre').addEventListener('click', (ev) => {
    ev.preventDefault();
    if (r) {
      for (const nom of ['racing', 'inside', 'outside']) {
        if (Array.isArray(r.lines[nom])) S.pts[nom] = r.lines[nom].map((p) => [+p[0], +p[1]]);
      }
      $('nPts').value = S.pts.racing.length;
    }
    if (q) {
      S.panneaux = q.panneaux.map(versEditeur);
      S.panModif = true; S.selP = null; majFicheP();
    }
    dessiner();
    etat('enregistrement repris');
  });
}

/* ------------------------------------------------------- la fiche du panneau choisi

Trois réglages et rien de plus, parce que ce sont les trois choses qu'un panneau dit : de quel côté
ça tourne, à quel point, et dans combien de mètres. Le quatrième bouton l'enlève. */

function majFicheP() {
  const b = S.selP != null ? S.panneaux[S.selP] : null;
  $('aucunP').hidden = !!b;
  $('ficheP').hidden = !b;
  if (!b) return;
  for (const el of $('sensP').children) el.classList.toggle('sel', +el.dataset.sens === (b.sign > 0 ? 1 : -1));
  for (const g of [$('noteP'), $('noteNom')]) {
    for (const el of g.children) el.classList.toggle('sel', el.dataset.note === String(b.note));
  }
  const noms = b.note === 'chicane' ? SENS_CHICANE : SENS_NOM;
  for (const el of $('sensP').children) el.querySelector('.lbl').textContent = noms[el.dataset.sens];
  for (const el of $('distP').children) el.classList.toggle('sel', +el.dataset.dist === b.dist);
  $('verifP').textContent = verifPanneau(b);
  $('viseurP').textContent = S.viseur == null
    ? 'Touche la piste sans glisser : le viseur se pose sur la station la plus proche.'
    : `viseur à ${metresDe(S.viseur).toFixed(0)} m — panneau à ${(b.at * S.track.length).toFixed(0)} m`;
}

/** Toute retouche passe par ici : la liste devient une reprise, et le calcul ne la reprendra plus. */
function changerP(champ, valeur) {
  if (S.selP == null) return;
  S.panneaux[S.selP][champ] = valeur;
  S.panModif = true;
  majFicheP();
  dessiner();
}

/** Un panneau neuf, au viseur — ou au milieu de la vue tant qu'aucun viseur n'est posé. */
function ajouterP() {
  let j = S.viseur;
  if (j == null) {
    const w = cv.width / devicePixelRatio, h = cv.height / devicePixelRatio;
    j = projeter(versPiste(w / 2, h / 2)).j;
  }
  S.panneaux.push({ at: j / S.track.n, dist: 100, note: 3, sign: 1 });
  S.selP = S.panneaux.length - 1;
  S.panModif = true;
  majFicheP();
  tiroir(false);
  dessiner();
  etat('panneau ajouté — donne-lui son sens et sa note');
}

/* DÉPLACER UN PANNEAU LE LONG DU TOUR, en mètres et non en pixels.

Un panneau se posait au milieu de la vue et ne bougeait plus. Le glisser à l'écran aurait été le
geste évident et le mauvais outil : à l'échelle d'un circuit entier, un pixel vaut plusieurs mètres,
et on ne vise pas au mètre ce qu'on ne distingue pas. Quatre pas fixes font ce qu'un glissement ne
peut pas — et ils font la même chose sur un téléphone et sur un écran de bureau. */
function bougerP(metres) {
  if (S.selP == null) return;
  const T = S.track, b = S.panneaux[S.selP];
  const j = ((Math.round(b.at * T.n + metres / T.ds) % T.n) + T.n) % T.n;
  b.at = j / T.n;
  S.panModif = true;
  majFicheP();
  dessiner();
  etat(`panneau à ${metresDe(j).toFixed(0)} m`);
}

/* ------------------------------------------------------------------------------ le tiroir

Ouvrir le tiroir mange la moitié basse de l'écran. Sans rien faire, le circuit — centré sur toute la
toile — disparaît derrière. On remonte donc la vue de la moitié de ce que le tiroir vient de prendre :
ce qu'on regardait reste en vue, et le zoom ne bouge pas. Recadrer aurait été plus simple et aurait
perdu l'endroit où on travaillait. */
function tiroir(replie) {
  const p = $('panel');
  if (p.classList.contains('replie') === replie) return;
  const avant = p.offsetHeight;
  p.classList.toggle('replie', replie);
  if (!replie) p.scrollTop = 0;      // déplié, on veut voir le haut : c'est là qu'est la fiche
  const apres = p.offsetHeight;
  S.vue.y -= (apres - avant) / 2;
  $('poign').setAttribute('aria-expanded', String(!replie));
  $('poign').textContent = replie ? 'Réglages' : 'Masquer';
  dessiner();
}

/** La part de la toile que le tiroir ne couvre pas. Sur grand écran, c'est toute la toile. */
function zoneLibre() {
  const c = cv.getBoundingClientRect();
  if (!matchMedia('(max-width: 860px)').matches) return { haut: 0, bas: c.height };
  const r = $('panel').getBoundingClientRect();
  return { haut: 0, bas: Math.max(80, r.top - c.top) };
}

/* AMENER CE QU'ON VIENT DE CHOISIR SOUS LES YEUX. Toucher un panneau ouvre le tiroir — sinon ses
   réglages restent cachés dessous, et c'est exactement ce qui est arrivé : le panneau se
   sélectionnait, on le voyait s'entourer de vert, et rien ne permettait de le modifier. Mais le
   tiroir qui s'ouvre peut recouvrir le panneau même qu'on vient de choisir. On fait donc glisser la
   vue juste assez pour qu'il retombe dans la part visible, et pas davantage : déplacer plus que
   nécessaire fait perdre le reste du circuit. */
function amenerEnVue(k) {
  const b = panneauxPoses()[k];
  if (!b) return;
  const e = versEcran([b.x / S.track.unitScale, b.y / S.track.unitScale]);
  const z = zoneLibre(), marge = 60;
  if (e[1] > z.bas - marge) S.vue.y -= e[1] - (z.bas - marge);
  else if (e[1] < z.haut + marge) S.vue.y += (z.haut + marge) - e[1];
  dessiner();
}

/* --------------------------------------------------------------------------- les évènements */

function redimensionner() {
  const r = cv.getBoundingClientRect();
  cv.width = Math.round(r.width * devicePixelRatio);
  cv.height = Math.round(r.height * devicePixelRatio);
  if (S.track) { cadrer(); dessiner(); }
}

function pointVise(x, y) {
  let best = VISEE * VISEE, k = -1;
  S.pts[S.ligne].forEach((p, i) => {
    const e = versEcran(p);
    const d = (e[0] - x) ** 2 + (e[1] - y) ** 2;
    if (d < best) { best = d; k = i; }
  });
  return k;
}

/** Le panneau sous le doigt : on vise le rectangle, pas son centre. */
function panneauVise(x, y) {
  const u = S.track.unitScale, poses = panneauxPoses();
  let best = (PAN_TAILLE * 0.75) ** 2, k = -1;
  poses.forEach((b, i) => {
    const e = versEcran([(b.cx != null ? b.cx : b.x) / u, (b.cy != null ? b.cy : b.y) / u]);
    const d = (e[0] - x) ** 2 + (e[1] - y) ** 2;
    if (d < best) { best = d; k = i; }
  });
  return k;
}

const ou = (ev) => { const r = cv.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
// La capture du pointeur est un confort — elle garde les évènements quand le doigt sort de la toile
// — et elle refuse parfois (pointeur déjà relâché, évènement synthétique). Un refus ne doit pas
// emporter le reste du traitement : sans ce garde, un `setPointerCapture` qui jette annulait la
// prise du point et l'appui long qui vient juste après.
const capter = (id) => { try { cv.setPointerCapture(id); } catch (_) { /* tant pis */ } };

/** Ramène un point de contrôle sur la ligne calculée — le clic droit, et l'appui long. */
function annuler(k) {
  const auto = autoPoints(S.ligne, S.pts[S.ligne].length);
  S.pts[S.ligne][k] = auto[k];
  dessiner();
}

/* LE ZOOM À DEUX DOIGTS. On suit tous les contacts ; dès qu'il y en a deux, l'écartement donne le
   facteur et le milieu donne le déplacement. Le point du circuit sous le milieu reste sous le
   milieu, exactement comme la molette garde celui sous le curseur — sans quoi on zoome vers un coin
   et on perd ce qu'on regardait. */
function majPince() {
  const pts = [...S.doigts.values()];
  if (pts.length < 2) { S.pince = null; return; }
  const [a, b] = pts;
  const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
  const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (!S.pince) { S.pince = { d, c, k: S.vue.k }; return; }
  const avant = versPiste(c[0], c[1]);
  S.vue.k = S.pince.k * (d / Math.max(1, S.pince.d));
  const apres = versPiste(c[0], c[1]);
  S.vue.x += (apres[0] - avant[0]) * S.vue.k + (c[0] - S.pince.c[0]);
  S.vue.y += (apres[1] - avant[1]) * S.vue.k + (c[1] - S.pince.c[1]);
  S.pince.c = c;
  dessiner();
}

cv.addEventListener('pointerdown', (ev) => {
  const [x, y] = ou(ev);
  S.doigts.set(ev.pointerId, [x, y]);
  if (S.doigts.size > 1) { S.prise = null; S.glisse = null; clearTimeout(S.appui); majPince(); return; }

  if (S.mode === 'panneaux' || S.mode === 'mesure') {
    if (S.mode === 'panneaux') {
      const k = panneauVise(x, y);
      if (k >= 0) { S.selP = k; majFicheP(); tiroir(false); amenerEnVue(k); return; }
    }
    /* UN APPUI QUI NE GLISSE PAS POSE LE POINT, un appui qui glisse déplace la carte. La différence
    est déjà dans le geste : inutile d'ajouter un mode pour la dire. On note donc d'où on est parti
    et on tranche au relâchement, selon ce qui a bougé entre-temps. */
    S.glisse = [x, y, S.vue.x, S.vue.y]; S.glisse.pose = true;
    capter(ev.pointerId);
    return;
  }
  const k = pointVise(x, y);
  if (ev.button === 2) { if (k >= 0) annuler(k); return; }
  if (k >= 0) {
    S.prise = k; capter(ev.pointerId);
    // L'appui long tient lieu de clic droit : un téléphone n'en a pas, et c'est la seule façon de
    // dire « reprends le calcul pour ce point » sans ajouter un mode.
    S.appui = setTimeout(() => { S.prise = null; annuler(k); etat('point revenu au calcul'); }, 550);
  } else { S.glisse = [x, y, S.vue.x, S.vue.y]; capter(ev.pointerId); }
});

cv.addEventListener('pointermove', (ev) => {
  const [x, y] = ou(ev);
  if (S.doigts.has(ev.pointerId)) S.doigts.set(ev.pointerId, [x, y]);
  if (S.doigts.size > 1) { majPince(); return; }
  if (S.prise != null) {
    clearTimeout(S.appui);
    S.pts[S.ligne][S.prise] = versPiste(x, y); dessiner();
  } else if (S.glisse) {
    if (Math.abs(x - S.glisse[0]) + Math.abs(y - S.glisse[1]) > 6) S.glisse.pose = false;
    S.vue.x = S.glisse[2] + (x - S.glisse[0]); S.vue.y = S.glisse[3] + (y - S.glisse[1]); dessiner();
  }
});

const relacher = (ev) => {
  if (ev) S.doigts.delete(ev.pointerId);
  if (S.doigts.size < 2) S.pince = null;
  clearTimeout(S.appui);
  if (S.glisse && S.glisse.pose && ev && S.track) {
    const [x, y] = ou(ev);
    const j = stationDe(x, y);
    if (S.mode === 'panneaux') {
      S.viseur = j;
      majFicheP();
      etat(`viseur à ${metresDe(j).toFixed(0)} m de la ligne`);
    } else {
      // le troisième appui recommence : deux points sont une règle, trois sont une ambiguïté
      if (S.mesure.length >= 2) S.mesure = [];
      S.mesure.push(j);
      majFicheM();
      etat(S.mesure.length === 1 ? 'départ posé — touche l’arrivée' : 'mesure faite');
    }
    dessiner();
  }
  S.prise = null; S.glisse = null;
};
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

/* ------------------------------------------------------- le mode, les panneaux, le tiroir */

function changerMode(m) {
  S.mode = m;
  $('volLignes').hidden = m !== 'lignes';
  $('volPanneaux').hidden = m !== 'panneaux';
  $('volMesure').hidden = m !== 'mesure';
  if (m === 'mesure') majFicheM();
  [...$('choixMode').children].forEach((b) => b.classList.toggle('sel', b.dataset.mode === m));
  dessiner();
}
for (const b of $('choixMode').children) b.addEventListener('click', () => changerMode(b.dataset.mode));

for (const [liste, ou] of [[CHIFFRES, 'noteP'], [NOMMES, 'noteNom']]) {
  for (const n of liste) {
    const b = document.createElement('button');
    b.dataset.note = String(n);
    b.textContent = typeof n === 'number' ? String(n) : Renderer.ARROWS[n].tag;
    b.title = typeof n === 'number' ? `note ${n}` : NOM_NOTE[n];
    b.style.color = Renderer.ARROWS[n].col;
    b.addEventListener('click', () => changerP('note', typeof n === 'number' ? n : String(n)));
    $(ou).appendChild(b);
  }
}
for (const d of DISTANCES) {
  const b = document.createElement('button');
  b.dataset.dist = String(d);
  b.textContent = NOM_DIST[d] || (d + ' m');
  if (!d) b.title = 'sans chiffre : seulement la flèche';
  b.addEventListener('click', () => changerP('dist', d));
  $('distP').appendChild(b);
}
for (const b of $('sensP').children) b.addEventListener('click', () => changerP('sign', +b.dataset.sens));
$('supprP').addEventListener('click', () => {
  if (S.selP == null) return;
  S.panneaux.splice(S.selP, 1);
  S.selP = null; S.panModif = true;
  majFicheP(); dessiner();
  etat('panneau supprimé — « Enregistrer » pour que le jeu le voie');
});
$('ajoutP').addEventListener('click', ajouterP);
for (const b of $('pasP').children) b.addEventListener('click', () => bougerP(+b.dataset.pas));
$('versViseurP').addEventListener('click', () => {
  if (S.selP == null || S.viseur == null) { etat('pose le viseur sur la piste d’abord'); return; }
  S.panneaux[S.selP].at = (S.viseur % S.track.n) / S.track.n;
  S.panModif = true;
  majFicheP(); dessiner();
  etat(`panneau amené à ${metresDe(S.viseur).toFixed(0)} m`);
});
$('effM').addEventListener('click', () => { S.mesure = []; majFicheM(); dessiner(); });
$('autoP').addEventListener('click', () => {
  S.panneaux = panneauxDuCalcul(); S.panModif = false; S.selP = null;
  majFicheP(); dessiner();
  etat('panneaux revenus au calcul');
});

/* LE TIROIR. Il n'existe qu'en dessous de 860 px — au-dessus, le panneau est une colonne et la
   poignée est cachée en CSS. Replié par défaut sur un écran étroit : on ouvre un éditeur de tracé
   pour voir le tracé. */
$('poign').addEventListener('click', () => tiroir(!$('panel').classList.contains('replie')));
if (matchMedia('(max-width: 860px)').matches) {
  $('panel').classList.add('replie');
  $('poign').setAttribute('aria-expanded', 'false');
  $('poign').textContent = 'Réglages';
}
changerMode('lignes');
