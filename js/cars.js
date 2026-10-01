// Car categories and models. Units: m, m/s, m/s².
//  vmax top speed · accel · brake (deceleration when released) · grip (lateral m/s² at low speed)
//  df downforce (extra grip = df·v², capped) · slide (how brutally the car drifts when over the limit)
//  laneK yaw responsiveness · rearBias rear grip relative to front (<1 oversteer-prone, >1 understeer-prone)
//  cliff how much grip a tyre loses once pushed well past its peak slip angle (0..1)
//  slipPeak body slip angle (rad) at which the tyres give their maximum: bigger = lazier, more visible drift
//  roadScale (road width factor) · zoom (camera)
//  sheet: folder of a rotation sheet (v0..vN-1.png) used by the isometric view; sheetRear names the rear view
//  sheetW / sheetAnchor: for a sheet rendered in a fixed frame, its width in metres and the ground point
//
//  pick: illustration en trois quarts pour le menu de selection. La vue de dessus dit comment la
//    voiture se pose sur la piste, pas a quoi elle ressemble ; on choisit une voiture de face.
//  engine: what the car sounds like, and it is real engine data rather than a tone choice.
//    cyl      cylinders. A four-stroke fires cyl/2 times per crank revolution, so this alone sets
//             the note: at the same rpm a V12 sounds an octave above a straight-six. It is the
//             single thing that tells two cars apart by ear.
//    redline  rpm at the top of the rev range, reached in top gear at vmax
//    idle     rpm at rest
//    rough    how uneven the firing feels, 0 to 1. A cross-plane V8 (Corvette, GT40) fires
//             unevenly and rumbles; a flat-plane V8, a V12 or a straight-six is smooth.
//    bright   how much upper-order content, 0 to 1: a racing engine screams, a road V8 thumps
//    turbo    0 to 1, the whistle and the blow-off on lift
'use strict';

const CATEGORIES = [
  {
    // L'identifiant reste `gt` : les records de tour sont rangés sous `circuit|catégorie` dans la
    // sauvegarde, et le changer effacerait ceux des joueurs. Le nom, lui, ne peut plus être « GT »
    // avec une 935 et une 787B sur la grille.
    id: 'gt', name: { fr: 'Le plateau', en: 'The field' },
    desc: { fr: 'Les icônes : M1 Procar, F40, Countach, GT40, 935, 787B… Lourdes, puissantes, joueuses.', en: 'The icons: M1 Procar, F40, Countach, GT40, 935, 787B… Heavy, powerful, playful.' },
    engine: { cyl: 8, redline: 7000, idle: 1000, rough: 0.35, bright: 0.6, turbo: 0 },
    base: { vmax: 70, accel: 8, brake: 17, grip: 13.5, df: 0.0015, slide: 0.6, laneK: 6, rearBias: 1.06, cliff: 0.18, slipPeak: 0.12, length: 4.5, width: 2.0 },
    drivers: 10, roadScale: 0.9, zoom: 1.15,
    models: [
      { id: 'm1procar', diff: 0, name: 'M1 Procar', shape: 'gtBoxy', mul: { vmax: 0.98, grip: 1.04, brake: 1.03 }, pick: 'sprites/pick/m1procar.png', engine: {
        cyl: 6, redline: 9000, idle: 1100, rough: 0.15, bright: 0.78, turbo: 0,
// Découpé dans l'onboard par `tools/enginecut.py`. Six boucles pour couvrir la plage
        // utile : une seule, transposée du ralenti au rupteur, fait trois octaves et ne sonne
        // plus comme un moteur. Hors de la plage couverte, la synthèse reprend la main.
        sample: { ramp: 'sounds/engine/six-inline.json' },
      }, colors: ['#f4f4f4', '#2166d8'], top: 'sprites/top/m1procar.png', sheet: 'sprites/m1procar', sheetN: 16, sheetRear: 0, sheetW: 5.122, sheetAnchor: [0.494, 0.821] },
      { id: 'f40', diff: 1, name: 'F40', shape: 'f40', mul: { vmax: 1.05, accel: 1.06, grip: 0.98, df: 1.5 }, pick: 'sprites/pick/f40.png', engine: {
        cyl: 8, redline: 7750, idle: 1000, rough: 0.15, bright: 0.8, turbo: 0.9,
        sample: { ramp: 'sounds/engine/v8-f40.json' },
      }, colors: ['#e0262c', '#22242b'], top: 'sprites/top/f40.png', sheet: 'sprites/f40lm', sheetN: 8, sheetRear: 3,
        /* Trois livrées, nommées d'après ce qui est écrit sur la voiture plutôt que d'après sa
        couleur : « Pilot » et « Crawford » se lisent sur les flancs, et aucun des trois mots n'a à
        être traduit — ces noms s'affichent tels quels dans les deux langues du jeu.

        La PLANCHE DE ROTATION ne suit pas. Elle ne sert qu'à la caméra inclinée, qui n'est pas celle
        par défaut, et il en faudrait une par livrée — huit vues chacune. En vue inclinée les trois
        F40 gardent donc l'aspect de la planche d'origine. C'est dit ici parce que c'est le genre
        d'écart qu'on découvre six mois plus tard en changeant de caméra. */
        livrees: [
          { id: '', nom: 'Pilot' },
          { id: 'red', nom: 'Rosso' },
          { id: 'yellow', nom: 'Crawford' },
        ] },
      { id: 'countach', diff: 1, name: 'Countach LP500', shape: 'wedgeGT', mul: { vmax: 1.03, accel: 1.02, grip: 0.95, brake: 0.95 }, pick: 'sprites/pick/countach.png', engine: {
        cyl: 12, redline: 7500, idle: 900, rough: 0.05, bright: 0.88, turbo: 0,
        // La rampe la plus large du jeu : vingt-cinq demi-tons, 1821 tr/min au rupteur, d'un seul
        // rapport et sans coupure. C'est ce qu'il faut pour n'avoir presque rien à confier à la
        // synthèse — la plage enregistrée couvre à elle seule tout ce qu'on entend en course.
        sample: { ramp: 'sounds/engine/v12-countach.json' },
      }, colors: ['#ffd400', '#22242b'], top: 'sprites/top/countach.png' },
      // La prise vient d'une 911 RSR, la seule 911 du plateau étant celle-ci. Un RSR est atmosphérique
      // là où la Turbo ne l'est pas : le sifflement reste à la synthèse, la matière du plat-six est
      // celle de l'enregistrement.
      { id: '930', diff: 4, name: '911 Turbo', shape: 'roundGT', mul: { vmax: 0.99, accel: 1.04, grip: 0.97, slide: 1.2 }, pick: 'sprites/pick/930.png', engine: {
        cyl: 6, redline: 7000, idle: 950, rough: 0.3, bright: 0.6, turbo: 0.85,
        sample: { ramp: 'sounds/engine/flat6-930.json', bas: 'sounds/engine/flat6-930-bas.json' },
      }, colors: ['#c9ced6', '#e0262c'], top: 'sprites/top/930.png', sheet: 'sprites/930', sheetN: 16, sheetRear: 0, sheetW: 4.803, sheetAnchor: [0.499, 0.841] },
      { id: 'gt40', diff: 2, name: 'GT40 Mk II', shape: 'gt40', mul: { vmax: 1.06, accel: 1.02, grip: 0.99, df: 0.85, brake: 0.97, slide: 1.1 }, pick: 'sprites/pick/gt40.png', engine: {
        cyl: 8, redline: 6200, idle: 800, rough: 0.6, bright: 0.45, turbo: 0,
        // Trois prises, et le moteur choisit. La montée ne porte que 4611 tr/min au rupteur — un
        // tirage entre deux rapports, tout ce qu'un onboard de course contient souvent — mais elle
        // n'a plus à couvrir seule : le plein régime et le pied levé ont leur propre matière, qui
        // n'a pas besoin d'axe des régimes puisqu'on ne la parcourt pas.
        sample: {
          ramp: 'sounds/engine/v8-gt40.json',
          haut: 'sounds/engine/v8-gt40-haut.json',
          bas: 'sounds/engine/v8-gt40-bas.json',
        },
      }, colors: ['#5bc8e8', '#ff8c1a'], top: 'sprites/top/gt40.png' },
      /* La 935 prend la place de la 917 K, et elle prend AUSSI son identifiant — non.

      Elle en prend un neuf, `935`, et c'est délibéré. L'identifiant est la clé sous laquelle sont
      rangés les records, locaux comme mondiaux, et les planchers du serveur. Le garder aurait fait
      hériter la 935 des temps signés avec un prototype douze cylindres : des records qu'elle n'a
      pas faits, sur une voiture qui n'existe plus. Les anciennes lignes `917k` restent dans la
      sauvegarde sans plus s'afficher — rien n'est effacé, rien n'est attribué à tort.

      Ce qu'elle est : une silhouette du Groupe 5, bâtie sur la 930 d'à côté et poussée beaucoup
      plus loin. Flat-6 turbo, donc la même famille sonore que la 930 et pas celle d'un douze
      cylindres atmosphérique. Très vite en ligne droite, moins collée qu'un prototype, et une
      tendance à mettre la queue dehors qui est sa signature — d'où `slide` au-dessus de tout le
      reste du plateau. Le rang de difficulté n'est pas choisi ici : il est MESURÉ par
      `tools/difficulte.js`, qui le recalcule pour les neuf voitures à la fois. */
      { id: '935', diff: 5, name: '935', shape: 'longTail', mul: { vmax: 1.07, accel: 1.05, grip: 0.95, df: 1.15, brake: 0.93, slide: 1.4 }, pick: 'sprites/pick/935.png', engine: {
        cyl: 6, redline: 8000, idle: 1100, rough: 0.35, bright: 0.7, turbo: 0.9,
      }, colors: ['#f4f4f4', '#e0262c'], top: 'sprites/top/935.png' },
      { id: 'corvette', diff: 4, name: 'Corvette', shape: 'roundGT', mul: { vmax: 1.04, accel: 1.06, grip: 0.97, df: 0.9, brake: 0.95, slide: 1.3 }, pick: 'sprites/pick/corvette.png', engine: {
        cyl: 8, redline: 6000, idle: 750, rough: 0.7, bright: 0.4, turbo: 0,
        // Découpé dans son propre onboard. Les étiquettes portent une correction d'octave : sur
        // cette prise l'estimateur s'accrochait au demi-ordre plutôt qu'à l'allumage, ce que le
        // sonagramme montre — les rangs y sont espacés d'une cinquantaine de hertz, soit un demi-
        // ordre à 6000 tr/min et non un allumage à 3000. Sans elle, la voiture sonnerait une
        // octave trop bas.
        sample: { ramp: 'sounds/engine/v8-corvette.json' },
      }, colors: ['#d8dce2', '#e0262c'], top: 'sprites/top/corvette.png' },
      // Un moteur rotatif n'a pas de cylindres : `cyl` ne sert qu'à placer l'allumage, et un
      // quatre-rotors allume quatre fois par tour d'arbre excentrique, exactement comme un V8 à
      // quatre temps. D'où huit, avec la rugosité d'un moteur parfaitement équilibré et un
      // rupteur très haut : c'est le cri de la 787B.
      { id: '787b', diff: 0, name: '787B', shape: 'groupC', mul: { vmax: 1.02, accel: 1.05, grip: 1.03, df: 1.3, brake: 1.04, slide: 0.92 }, colors: ['#ff8c1a', '#1f6b3a'], top: 'sprites/top/787b.png', pick: 'sprites/pick/787b.png', engine: {
        cyl: 8, redline: 9000, idle: 1300, rough: 0.04, bright: 1.0, turbo: 0,
        // La montée tient de 6159 tr/min au rupteur, le pied levé a sa propre prise, et le
        // démarreur est joué une fois quand la course s'ouvre — d'un bout à l'autre, pas en grains :
        // un démarrage est un évènement, pas une matière.
        sample: {
          ramp: 'sounds/engine/r26b-787b.json',
          bas: 'sounds/engine/r26b-787b-bas.json',
          start: 'sounds/engine/r26b-787b-start.json',
        },
      } },
      { id: 'csl', diff: 0, name: '3.0 CSL', shape: 'gtBoxy', mul: { vmax: 0.95, accel: 0.98, grip: 1.05, df: 1.2, brake: 1.03, slide: 1.1 }, pick: 'sprites/pick/csl.png', engine: { cyl: 6, redline: 7000, idle: 950, rough: 0.1, bright: 0.68, turbo: 0 }, colors: ['#f7f7f7', '#2166d8'], top: 'sprites/top/csl.png',
        /* Trois livrées, et la première est celle qui existait déjà.

        Une livrée n'est pas une couleur ici : une illustration remplace le dessin vectoriel ET la
        couleur, donc la seule façon de changer de livrée est de changer de dessin. Les fichiers
        se déduisent de l'identifiant — `sprites/top/csl_castrol.png` et sa vignette dans
        `sprites/pick/` — et un identifiant vide garde les fichiers sans suffixe, pour que la
        livrée d'origine n'ait pas à être renommée. */
        livrees: [
          { id: '', nom: 'Motorsport' },
          { id: 'castrol', nom: 'Castrol' },
          { id: 'calder', nom: 'Calder' },
        ] },
    ],
  },
];

const LIVERIES = [
  { name: 'Rosso', body: '#e0262c', accent: '#ffffff' },
  { name: 'Azure', body: '#2166d8', accent: '#ffd400' },
  { name: 'Lime', body: '#7ed321', accent: '#1b1b1b' },
  { name: 'Sunset', body: '#ff8c1a', accent: '#1b1b1b' },
  { name: 'Silver', body: '#c9ced6', accent: '#e0262c' },
  { name: 'Night', body: '#22242b', accent: '#ffd400' },
  { name: 'Violet', body: '#8a3ffc', accent: '#ffffff' },
  { name: 'Teal', body: '#12b5a8', accent: '#ffffff' },
  { name: 'Gold', body: '#e6b422', accent: '#22242b' },
  { name: 'Pink', body: '#ff4fa3', accent: '#ffffff' },
  { name: 'Racing Green', body: '#1f6b3a', accent: '#ffd400' },
  { name: 'White', body: '#f4f4f4', accent: '#2166d8' },
];

const AI_NAMES = [
  'L. Moreau', 'K. Tanaka', 'M. Rossi', 'A. Silva', 'J. Becker', 'S. Novak', 'D. Okafor', 'E. Lindqvist',
  'R. Castillo', 'T. Nguyen', 'P. Dubois', 'H. Weber', 'N. Petrov', 'C. Ferreira', 'B. Andersen', 'Y. Sato',
  'F. Marchetti', 'G. Larsen', 'I. Kovács', 'O. Haddad',
];

/* Le chemin d'une variante, déduit de celui de la livrée d'origine.

   `sprites/top/csl.png` + `castrol` → `sprites/top/csl_castrol.png`. Déduire plutôt qu'écrire les
   six chemins à la main tient le fichier lisible et rend l'ajout d'une livrée à une ligne — mais
   surtout, ça empêche la vignette et la vue de dessus de désigner deux livrées différentes, ce qui
   ne se verrait qu'en comparant le menu et la piste.

   Le séparateur est le tiret bas parce que c'est celui des fichiers livrés. Un détail, jusqu'au
   moment où il ne l'est pas : le jeu demanderait `csl-castrol.png`, le serveur rendrait 404, et le
   repli afficherait sagement la livrée d'origine — un choix qui ne change rien, sans un mot
   d'erreur nulle part. */
function cheminLivree(src, suffixe) {
  if (!src || !suffixe) return src || null;
  const i = src.lastIndexOf('.');
  return i < 0 ? `${src}_${suffixe}` : `${src.slice(0, i)}_${suffixe}${src.slice(i)}`;
}

/** La livrée `i` d'un modèle, l'indice tournant sur la liste. Toujours une livrée, jamais `null`. */
function livreeDe(model, i) {
  const l = model && model.livrees && model.livrees.length ? model.livrees : null;
  if (!l) return { id: '', nom: (model && model.name) || '', top: (model && model.top) || null, pick: (model && model.pick) || null };
  const n = l.length;
  return l[((Math.round(i) || 0) % n + n) % n];
}

// La prise jouée par toute voiture qui n'en a pas à elle. Voir `resolveModel`.
const MOTEUR_DEFAUT = 'sounds/engine/six-inline.json';

// Resolved models: category stats × model multipliers.
const MODELS = [];
function resolveModel(cat, m) {
  const b = cat.base, mul = m.mul || {};
  const model = {
    id: m.id, catId: cat.id, name: m.name, shape: m.shape, diff: m.diff == null ? 2 : m.diff, colors: m.colors, custom: !!m.custom, sprite: m.sprite || null, top: m.top || null,
    // optional rotation sheet for the isometric view: folder of v0..v(N-1).png, sheetRear = the rear view
    sheet: m.sheet || null, sheetN: m.sheetN || 8, sheetRear: m.sheetRear || 0,
    // a sheet rendered in a fixed frame also states its width in metres and where the car's
    // ground point sits in the image, which beats guessing the scale from the silhouette
    sheetW: m.sheetW || 0, sheetAnchor: m.sheetAnchor || null,
    vmax: b.vmax * (mul.vmax || 1), accel: b.accel * (mul.accel || 1), brake: b.brake * (mul.brake || 1),
    grip: b.grip * (mul.grip || 1), df: b.df * (mul.df || 1), slide: b.slide * (mul.slide || 1), laneK: b.laneK,
    // handling balance: a model's `slide` multiplier above 1 makes it more tail-happy
    rearBias: (b.rearBias || 1.04) / Math.pow(mul.slide || 1, 0.5), cliff: b.cliff == null ? 0.25 : b.cliff, slipPeak: (b.slipPeak || 0.1) * Math.pow(mul.slide || 1, 0.5),
    length: m.length || b.length, width: m.width || b.width,
    drivers: cat.drivers, roadScale: cat.roadScale, zoom: cat.zoom,
    // le moteur : celui de la catégorie, que la voiture peut reprendre champ par champ
    pick: m.pick || null,
    engine: Object.assign({ cyl: 8, redline: 7000, idle: 1000, rough: 0.3, bright: 0.6, turbo: 0 }, cat.engine || {}, m.engine || {}),
  };
  /* Les livrées : au moins une, toujours, et la première est le dessin d'origine.

  Un modèle qui n'en déclare pas en reçoit une seule, bâtie sur ses propres fichiers. Tout le reste
  du jeu lit donc la même liste, qu'un modèle ait trois livrées ou une : il n'y a pas de cas
  particulier « ce modèle n'a pas de variantes » à écrire quelque part, et c'est précisément le
  genre de cas particulier qu'on oublie dans une des cinq fonctions qui dessinent une voiture. */
  model.livrees = (m.livrees && m.livrees.length ? m.livrees : [{ id: '', nom: m.name }]).map((lv) => ({
    id: lv.id || '',
    nom: lv.nom || m.name,
    top: lv.top || cheminLivree(m.top, lv.id),
    pick: lv.pick || cheminLivree(m.pick, lv.id),
  }));

  /* Une voiture sans prise à elle joue quand même un vrai moteur.

  La synthèse donne la bonne hauteur mais pas la bonne matière, et l'écart s'entend d'autant plus que
  les voisines de grille, elles, roulent sur des enregistrements. Faute de prise propre, la M1 fait
  donc le fond de plateau : un six en ligne mécanique et sec, qui monte à 9000 tr/min, et dont la
  rampe est la plus large qu'on ait — dix-sept demi-tons, de 3423 tr/min au rupteur.

  Ce n'est pas un pis-aller sans conséquence : le lecteur ramène l'échelle de la rampe au rupteur de
  la voiture qui la joue, si bien qu'une CSL qui coupe à 7000 entend bien son propre rupteur et non
  les trois quarts de celui de la M1. Ce qui reste emprunté est le timbre, pas le comportement — la
  boîte, la charge, le turbo et le ralenti restent ceux de la voiture.

  Cela vaut aussi pour les voitures de l'atelier, qui passent par ce même chemin. */
  if (!model.engine.sample) model.engine = Object.assign({}, model.engine, { sample: { ramp: MOTEUR_DEFAUT } });

  // Les chiffres du menu, calculés ici pour que les voitures de l'atelier en aient aussi :
  // `registerModel` passe par ce même chemin. (`perfOf` est déclarée plus bas, donc hissée.)
  model.perf = perfOf(model);
  return model;
}
for (const cat of CATEGORIES) for (const m of cat.models) MODELS.push(resolveModel(cat, m));

// Les quatre chiffres du menu de sélection. Aucun n'est une note inventée : chacun est obtenu en
// appliquant au modèle la loi que le jeu applique vraiment en course, si bien qu'une retouche des
// `mul` se lit aussitôt sur les jauges — il n'y a pas de second jeu de valeurs à tenir à jour.
function perfOf(c) {
  // 0 à 100 km/h. La poussée retombe avec la vitesse — a(v) = accel · (1 − (v/vmax)^2.5), la
  // formule de `car.js` — donc pas de forme close : on intègre, comme le jeu le fait au pas.
  let v = 0, t = 0;
  const dt = 0.002;
  while (v < 27.78 && t < 30) { v += c.accel * Math.max(0, 1 - Math.pow(v / c.vmax, 2.5)) * dt; t += dt; }
  return {
    a100: t,                                     // secondes
    vmax: c.vmax * 3.6,                          // km/h
    // Freinage à fond en ligne droite : `car.js` décélère de 1,5 + brake, constant, d'où v²/2a.
    b100: 27.78 * 27.78 / (2 * (1.5 + c.brake)), // mètres de 100 km/h à l'arrêt
    // L'adhérence latérale disponible à 50 m/s, appui aérodynamique compris : c'est la vitesse à
    // laquelle les virages se jouent, et une voiture à gros appui mérite d'y être jugée.
    gripG: (c.grip + c.df * 2500) / 9.81,        // g
  };
}

/* Ce qu'une voiture coûte à piloter, de zéro à cinq pneus.

Le rang est mesuré, pas décidé, par `node tools/difficulte.js` : le plus gros coup de lacet dont la
voiture se remet, l'écart entre son tour idéal et son tour réel, et la dérive qu'elle atteint pour
un coup de référence. Trois mesures qui ne disent pas la même chose — une voiture peut pardonner et
rester fatigante, une autre être docile puis partir d'un coup — chacune ramenée à sa place dans le
plateau, parce que ce qui intéresse le joueur est le rang relatif et non une note absolue.

Le plateau se révèle groupé du côté facile : quatre voitures à zéro pneu, deux à cinq. C'est ce que
la mesure dit, et l'échelle n'est pas étirée pour faire joli — ce serait affirmer des écarts qui
n'existent pas. La Corvette et la 911 sortent du lot par leur dérive, seize et vingt degrés là où le
reste du plateau tient sous huit.

Une voiture d'atelier, dont on ne sait rien, vaut deux pneus : le milieu, faute de mieux. */

// Les bornes des cadrans, absolues et non calées sur le plateau. Un arc plein dirait « le maximum
// possible », ce qu'aucune voiture n'a à afficher : il reste toujours mieux à faire, et une voiture
// à venir doit pouvoir se placer au-dessus sans qu'on retouche l'échelle. Le premier chiffre est
// l'arc vide, le second l'arc plein — pour un temps et une distance ils sont donc décroissants,
// puisque plus court vaut mieux, ce qui évite d'avoir à dire ailleurs dans quel sens lire.
//
// Aucune borne basse n'est zéro : une voiture de ce plateau ne roule pas à 40 km/h et ne tient pas
// 0,2 g, si bien que ce bas d'arc n'aurait servi qu'à écraser les écarts. Elles valent toutes ce
// que tient une bonne routière — 5 s, 150 km/h, 30 m, 1 g — ce qui donne en prime des cadrans
// remplis au même niveau : sans cela une même voiture paraît excellente sur un cadran et médiocre
// sur un autre, alors que c'est le choix des bornes qui parle et non la voiture.
const PERF_RANGE = {
  a100: [5, 2.5],     // secondes de 0 à 100 km/h : 5 s une routière rapide, 2,5 s hors d'atteinte
  vmax: [150, 350],   // km/h
  b100: [30, 12],     // mètres de 100 km/h à l'arrêt : 30 m une routière, 12 m hors d'atteinte
  gripG: [1, 2.6],    // g en virage : 1 g ce que tient une bonne routière, 2,6 g hors d'atteinte
};
const PERF_KEYS = ['a100', 'vmax', 'b100', 'gripG'];
function perfFill(v, key) {
  const [lo, hi] = PERF_RANGE[key];
  return Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
}

// Une seule catégorie, celle du plateau dessiné d'après nature. Les trois autres — F1 classiques,
// F1 modernes, prototypes — ont été retirées : leurs voitures n'avaient aucun dessin et n'étaient
// plus proposées depuis longtemps. Elles sont dans l'historique si le sujet revient.
// `sheetOnly` ne garde que les voitures munies d'une planche de rotations, pour la vue isométrique.
const SIMPLE = { catId: 'gt', sheetOnly: false };

function playableCategories() { return CATEGORIES.filter(c => c.id === SIMPLE.catId); }
function categoryById(id) { return CATEGORIES.find(c => c.id === id) || playableCategories()[0]; }
function modelsOf(catId) {
  const all = MODELS.filter(m => m.catId === catId);
  if (!SIMPLE.sheetOnly) return all;
  const withSheet = all.filter(m => m.sheet || m.sprite);
  return withSheet.length ? withSheet : all;
}
function allModelsOf(catId) { return MODELS.filter(m => m.catId === catId); }
function modelById(id) { return MODELS.find(m => m.id === id) || null; }
// accepts a model id or a category id (first model)
function carClassById(id) { return modelById(id) || modelsOf(categoryById(id).id)[0]; }
// custom (workshop) models are registered at runtime
function registerModel(def) {
  const cat = categoryById(def.catId);
  const idx = MODELS.findIndex(m => m.id === def.id);
  const model = resolveModel(cat, { ...def, custom: true });
  if (idx >= 0) MODELS[idx] = model; else MODELS.push(model);
  return model;
}
function unregisterModel(id) { const i = MODELS.findIndex(m => m.id === id); if (i >= 0) MODELS.splice(i, 1); }

if (typeof module !== 'undefined') module.exports = { CATEGORIES, MODELS, LIVERIES, livreeDe, AI_NAMES, SIMPLE, perfOf, perfFill, PERF_RANGE, PERF_KEYS, playableCategories, categoryById, modelsOf, allModelsOf, modelById, carClassById, registerModel };
