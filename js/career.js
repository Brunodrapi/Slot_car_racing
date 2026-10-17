// Career: a series of cups, each tied to a car class. Finish a cup in the top 3 to unlock the next.
'use strict';

const CUPS = [
  { id: 'gt', classId: 'gt', name: { fr: 'GT Legends Cup', en: 'GT Legends Cup' }, tracks: ['zandvoort', 'laguna', 'redbullring', 'silverstone', 'spa'] },
];

/* Le nombre de tours d'une course, qui n'est pas une propriété du circuit.

Chaque circuit intégré portait son `laps`, écrit à la main. Multiplié par sa longueur, les douze
donnaient entre 8,4 et 11,6 km, moyenne 10,1 : ce nombre ne disait rien du circuit, il disait
« une course fait une dizaine de kilomètres », et le dire douze fois laissait douze occasions de se
tromper — un circuit dont on change la longueur gardait son compte de tours et changeait de durée
sans prévenir.

On le calcule donc : la distance visée, divisée par la longueur du tour, mise à l'échelle de la
vitesse de la catégorie — une voiture plus rapide couvre plus de terrain dans la même durée, et
c'est la DURÉE qu'on veut constante. 11 500 m redonne onze des douze comptes d'origine ; seul Monza
passe de quatre tours à trois, et c'était lui l'exception — sa course faisait 11,6 km quand la
moyenne des douze en faisait 10,1.

Un circuit de l'éditeur garde le sien : là, c'est l'auteur qui décide, et il l'a écrit exprès. */
const DISTANCE_COURSE = 11500;

/* La `vmax` de base d'une catégorie est maintenant la vraie pointe de sa voiture la plus rapide,
qu'aucune n'approche en piste : elle ne dit plus rien du rythme. On garde donc l'ancienne référence,
celle du plateau unique, pour que la longueur proposée d'une course ne grimpe pas de moitié. */
const VMAX_TOURS = 70;
function lapsFor(trackDef, cat) {
  const tours = trackDef.laps || DISTANCE_COURSE / (trackDef.length || 3000);
  return clamp(Math.round(tours * VMAX_TOURS / 80), 3, 8);
}

const SAVE_KEY = 'slotracer.save.v2';

function defaultSave() {
  return { lang: (navigator.language || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr', sound: true, difficulty: 'medium', livery: 0, name: '', models: {}, livrees: {}, ctrl: 'auto', ctrlSide: 'left', camRotate: false, view: 'avanceFixe', pullBack: 1, aimant: 0, ff: 0.3, laps: 5, lapsPerso: false, showLines: false, debug: false, wear: false, guideMigrated: true, flatMigrated: false, cups: {}, bestLaps: {}, bestLapsNets: {}, tracesMigrated: true, catsMigrated: true, cat: null, filtreCat: 'all', tutorialSeen: false, racesDone: 0, reglages: { actif: null, configs: [] } };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const brut = JSON.parse(raw);
    const save = Object.assign(defaultSave(), brut);
    // the driving lines used to be drawn on the road; turn the guide off once for existing saves
    if (!save.guideMigrated) { save.showLines = false; save.guideMigrated = true; }
    /* La caméra était un interrupteur à deux positions ; c'est maintenant un choix de vue.

    Une sauvegarde sans `view` date de ce temps-là : on la traduit depuis l'interrupteur qu'elle
    portait, et surtout PAS vers le nouveau défaut. Changer le défaut change ce que voit quelqu'un
    qui n'a jamais rien réglé ; ça ne doit pas changer ce qu'a choisi quelqu'un qui avait réglé. */
    if (!save.view) save.view = save.camRotate === false ? 'fixed' : 'track';
    /* La vue isométrique n'existe plus, et la ramener UNE FOIS ne suffisait pas.

    Elle avait d'abord été retirée du défaut, par une migration jouée une seule fois — après quoi le
    réglage restait libre et le joueur pouvait la reprendre. Maintenant qu'elle est retirée pour de
    bon, une sauvegarde qui la porte encore désignerait une vue que le code ne sait plus dessiner.
    On la normalise donc à chaque lecture, et pas une seule fois : c'est une valeur qui n'existe
    plus, pas une préférence à migrer. */
    if (save.view === 'iso') { save.view = 'fixed'; save.flatMigrated = true; storeSave(save); }
    /* Le nombre de tours était « auto » par défaut, codé zéro, et suivait la proposition du
    circuit. Il vaut maintenant cinq, choisi et non déduit : une course de cinq tours dure ce qu'il
    faut pour qu'un arrêt au stand soit un vrai choix, et le joueur sait toujours combien il en
    reste. Les sauvegardes existantes portent encore le zéro ; on les amène à cinq une fois. */
    if (!save.lapsMigrated) { if (!save.laps) save.laps = 5; save.lapsMigrated = true; storeSave(save); }
    /* Les meilleurs tours sont remis à zéro une fois : les douze circuits ont changé de forme.

    Ils sont relevés dans OpenStreetMap au lieu d'être dessinés à la main, ils tournent dans leur
    vrai sens — les douze tournaient à l'envers — et la ligne de départ est passée de la plus longue
    ligne droite à la ligne droite des stands. Un temps posé avant ne décrit plus le même tour : il
    ne commence pas au même endroit, ne se parcourt pas dans le même sens, et le tour idéal lui-même
    a bougé de −4 % au Mans à +31 % à Zandvoort. Garder ces temps aurait laissé des records
    imbattables à côté de records faciles, sans que rien ne dise pourquoi.

    Une seule fois, et pas à chaque lecture : la différence compte ici plus qu'ailleurs, puisque la
    seconde version effacerait les temps que le joueur vient de poser. `tools/e2e-remise.js` vérifie
    les deux — que ça efface, et que ça n'efface qu'une fois.

    LE DRAPEAU SE LIT DANS `brut`, PAS DANS `save`. `loadSave` fusionne la sauvegarde lue PAR-DESSUS
    les valeurs par défaut, et il a fallu deux essais ratés pour en tirer la bonne conclusion.

    Posé à `true` dans `defaultSave` et lu dans `save`, le drapeau est déjà vrai pour une sauvegarde
    qui ne le porte pas — c'est-à-dire précisément celles qu'il faut migrer : la migration posait son
    drapeau sans rien effacer. Retiré de `defaultSave`, il manque aussi aux sauvegardes NEUVES, et la
    migration se rejouait alors au rechargement suivant en effaçant le premier temps du joueur.

    Les deux à la fois, donc : `true` dans le défaut pour qu'une sauvegarde neuve naisse migrée, et
    lu dans `brut` pour qu'une sauvegarde d'avant, qui ne porte pas la clé, le soit une seule fois.
    `lapsMigrated` s'en tire sans ça parce que son action est inoffensive — reposer cinq tours sur un
    champ déjà à cinq ne coûte rien. Effacer des temps, non. */
    if (!brut.tracesMigrated) { save.bestLaps = {}; save.tracesMigrated = true; storeSave(save); }
  /* LE REGISTRE DES TOURS NETS, et la reprise des anciens.

  `bestLaps` est le record PERSONNEL : il se bat avec n'importe quel réglage, parce que c'est le
  sien et qu'on veut le voir. `bestLapsNets` est celui qui a le droit d'aller au tableau mondial :
  seuls y entrent les tours courus dans la configuration de référence.

  Deux registres plutôt qu'un drapeau, parce qu'un drapeau aurait un défaut qu'on ne voit qu'au
  deuxième tour : si le meilleur temps personnel a été posé avec une aide, un tour propre PLUS LENT
  ne le battrait pas, donc ne serait jamais enregistré, donc ne partirait jamais au tableau. Le
  joueur serait puni d'avoir essayé une aide une fois.

  Les sauvegardes d'avant datent d'un temps sans aimant ni anticipation réglables : leurs tours sont
  nets par construction, et on les reprend tels quels. */
  if (!brut.bestLapsNets) { save.bestLapsNets = Object.assign({}, save.bestLaps); storeSave(save); }
    if (!brut.catsMigrated) { migreCategories(save); save.catsMigrated = true; storeSave(save); }
    return save;
  } catch (e) { return defaultSave(); }
}

/* Le plateau unique s'est séparé en trois catégories, F1, GT et Proto.

Tout était rangé sous `gt` : les records `circuit|gt|voiture`, et la voiture choisie sous
`models.gt`. Les GT y restent et n'ont rien à faire ; les F1 et les prototypes changent de
catégorie et emportent leurs temps avec eux, sans quoi l'écran des records les aurait perdus de vue
— ils seraient restés dans la sauvegarde, sous une clé que plus rien ne lit.

Le record de catégorie `circuit|catégorie`, lui, n'est pas déplacé mais recalculé : sous `gt` il
pouvait porter un tour de F1, que plus aucune GT ne battrait. Il devient le meilleur des tours de la
catégorie. Un circuit qui n'a que l'ancien record à deux morceaux, sans voiture connue, le garde :
on ne sait pas qui l'a signé, on ne l'attribue à personne et on ne l'efface pas.

La voiture choisie suit sa catégorie, et devient celle du joueur : il retrouve au menu la voiture
qu'il avait laissée, même si c'est maintenant une F1. */
function migreCategories(save) {
  if (typeof modelById !== 'function') return;
  for (const reg of [save.bestLaps, save.bestLapsNets]) {
    if (!reg) continue;
    for (const cle of Object.keys(reg)) {
      const p = cle.split('|');
      if (p.length !== 3) continue;
      const m = modelById(p[2]);
      if (!m || m.catId === p[1]) continue;
      const neuve = `${p[0]}|${m.catId}|${p[2]}`;
      if (reg[neuve] == null || reg[cle] < reg[neuve]) reg[neuve] = reg[cle];
      delete reg[cle];
    }
  }
  const b = save.bestLaps || {}, parCat = {};
  for (const cle of Object.keys(b)) {
    const p = cle.split('|');
    if (p.length !== 3) continue;
    const k = `${p[0]}|${p[1]}`;
    if (parCat[k] == null || b[cle] < parCat[k]) parCat[k] = b[cle];
  }
  const circuitsConnus = new Set(Object.keys(parCat).map(k => k.split('|')[0]));
  for (const cle of Object.keys(b)) if (cle.split('|').length === 2 && circuitsConnus.has(cle.split('|')[0])) delete b[cle];
  Object.assign(b, parCat);
  const choisie = save.models && save.models.gt && modelById(save.models.gt);
  if (choisie && choisie.catId !== 'gt') {
    save.models[choisie.catId] = choisie.id;
    delete save.models.gt;
    save.cat = choisie.catId;
  }
}

function storeSave(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}

function cupState(save, cupId) {
  return save.cups[cupId] || { race: 0, points: {}, done: false, finalPos: null };
}

function cupUnlocked(save, index) {
  if (index === 0) return true;
  const prev = cupState(save, CUPS[index - 1].id);
  return prev.done && prev.finalPos != null && prev.finalPos <= 3;
}

// With the career out of the way nothing is gated: every class and every track is available.
function unlockedClasses(save) {
  return new Set(CATEGORIES.map(c => c.id));
}

function unlockedTracks(save) {
  return new Set(TRACKS.map(t => t.id));
}

function allUnlocked(save) {
  return CUPS.every((c, i) => cupUnlocked(save, i)) && cupState(save, CUPS[CUPS.length - 1].id).done;
}

/* UN TOUR NE COMPTE POUR LE MONDE QUE DANS LA CONFIGURATION DE RÉFÉRENCE.

Le tableau mondial n'a qu'une colonne pour le temps : il ne peut pas dire dans quelles conditions il
a été posé. Un tour aidé n'y est donc pas « moins bon », il est INCOMPARABLE — et la seule façon de
garder la table lisible est de ne pas l'y mettre. C'est déjà la règle de l'usure ; elle s'étend aux
aides et aux réglages de conduite.

Ce qui exclut, et pourquoi :
  — l'USURE, parce qu'un tour sur des pneus morts ne se compare à rien (règle d'origine) ;
  — le GUIDE DE FREINAGE, qui montre où freiner : c'est précisément ce qu'on vient chercher ;
  — l'AIMANT, qui tient la voiture sur la ligne ;
  — l'ANTICIPATION hors de sa valeur par défaut. Celle-là n'est pas une aide — à zéro elle rend la
    voiture PLUS difficile — mais elle change le pilote intégré, donc la physique. Un temps posé
    avec un autre pilote ne se compare pas davantage, dans un sens comme dans l'autre.

La télémétrie n'exclut pas : elle affiche des angles de dérive, elle ne conduit pas. */
/* LES CONFIGURATIONS DE FREINAGE, par circuit ET par voiture.

En slot racing, la puissance de freinage se règle sur la commande, et le bon réglage n'est pas le
même partout : l'optimum mesuré vaut ×0,80 en moyenne mais il bouge d'un circuit à l'autre, et une
voiture qui glisse ne veut pas le même frein qu'une voiture posée. Une configuration est donc un
jeu de valeurs indexées par couple circuit+voiture, et porte un nom pour qu'on puisse en garder
plusieurs — un réglage de course et un réglage d'attaque, par exemple.

Le choix de la clé compte : `circuit|voiture` et non deux niveaux imbriqués. Un objet plat se lit,
s'écrit et se fusionne sans code, et il se sérialise tel quel vers le serveur le jour où les
configurations y monteront. Une valeur absente vaut 1, c'est-à-dire le frein d'origine : une
configuration neuve ne change donc rien tant qu'on n'a rien réglé.

CES RÉGLAGES NE SONT PAS UNE AIDE, et `tourNet` ne les regarde pas. C'est la décision de Bruno et
elle se défend par la mesure : aucun réglage de frein ne donne de gain gratuit, puisque trop de
frein coûte la vitesse de passage autant que trop peu coûte la sortie de piste. L'aimant, lui,
donne quelque chose pour rien — c'est pour ça qu'il exclut le tour et que celui-ci ne le fait pas. */
function cleReglage(trackId, modelId) { return trackId + '|' + modelId; }

function configActive(save) {
  const r = save && save.reglages;
  if (!r || !r.actif) return null;
  return (r.configs || []).find((c) => c.nom === r.actif) || null;
}

function freinDe(save, trackId, modelId) {
  const c = configActive(save);
  if (!c) return 1;
  const v = (c.freins || {})[cleReglage(trackId, modelId)];
  return typeof v === 'number' ? clamp(v, FREIN_MIN, FREIN_MAX) : 1;
}

function poseFrein(save, nom, trackId, modelId, valeur) {
  save.reglages = save.reglages || { actif: null, configs: [] };
  let c = save.reglages.configs.find((x) => x.nom === nom);
  if (!c) { c = { nom, freins: {} }; save.reglages.configs.push(c); }
  c.freins[cleReglage(trackId, modelId)] = clamp(valeur, FREIN_MIN, FREIN_MAX);
  save.reglages.actif = nom;
  return c;
}

const FF_DEFAUT = 0.3;
function tourNet(save, race) {
  if (race && race.usure) return false;
  if (save.showLines) return false;
  if ((save.aimant || 0) !== 0) return false;
  if ((save.ff == null ? FF_DEFAUT : save.ff) !== FF_DEFAUT) return false;
  return true;
}
