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
  return { lang: (navigator.language || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr', sound: true, difficulty: 'medium', livery: 0, name: '', models: {}, ctrl: 'auto', camRotate: false, view: 'fixed', pullBack: 1, laps: 0, showLines: false, debug: false, guideMigrated: true, flatMigrated: false, cups: {}, bestLaps: {}, tutorialSeen: false, racesDone: 0 };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const save = Object.assign(defaultSave(), JSON.parse(raw));
    // the driving lines used to be drawn on the road; turn the guide off once for existing saves
    if (!save.guideMigrated) { save.showLines = false; save.guideMigrated = true; }
    // the camera used to be a two-way toggle; it is now a three-way view setting
    if (!save.view) save.view = save.camRotate === false ? 'fixed' : 'track';
    // The isometric view was tried as the default and dropped: drawing a car from every angle
    // needs a rotation sheet per model, which is more artwork than the game can carry. Bring
    // existing saves back to the top-down view, once, leaving the setting free afterwards.
    if (!save.flatMigrated) { if (save.view === 'iso') save.view = 'fixed'; save.flatMigrated = true; storeSave(save); }
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
