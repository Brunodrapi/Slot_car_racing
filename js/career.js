// Career: a series of cups, each tied to a car class. Finish a cup in the top 3 to unlock the next.
'use strict';

const CUPS = [
  { id: 'gt', classId: 'gt', name: { fr: 'GT Legends Cup', en: 'GT Legends Cup' }, tracks: ['zandvoort', 'laguna', 'redbullring', 'silverstone', 'spa'] },
];

// number of laps for a category on a track: keeps races around 3-4 minutes
function lapsFor(trackDef, cat) {
  const vmax = cat.base ? cat.base.vmax : cat.vmax;
  return clamp(Math.round((trackDef.laps || 3) * vmax / 80), 3, 8);
}

const SAVE_KEY = 'slotracer.save.v2';

function defaultSave() {
  return { lang: (navigator.language || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr', sound: true, difficulty: 'medium', livery: 0, name: '', models: {}, livrees: {}, ctrl: 'auto', ctrlSide: 'left', camRotate: false, view: 'fixed', pullBack: 1, laps: 5, lapsPerso: false, showLines: false, debug: false, wear: false, guideMigrated: true, flatMigrated: false, cups: {}, bestLaps: {}, tracesMigrated: true, tutorialSeen: false, racesDone: 0 };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const brut = JSON.parse(raw);
    const save = Object.assign(defaultSave(), brut);
    // the driving lines used to be drawn on the road; turn the guide off once for existing saves
    if (!save.guideMigrated) { save.showLines = false; save.guideMigrated = true; }
    // the camera used to be a two-way toggle; it is now a three-way view setting
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
    return save;
  } catch (e) { return defaultSave(); }
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
