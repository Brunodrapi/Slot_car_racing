// Career: a series of cups, each tied to a car class. Finish a cup in the top 3 to unlock the next.
'use strict';

const CUPS = [
  { id: 'gt', classId: 'gt', name: { fr: 'GT Legends Cup', en: 'GT Legends Cup' }, tracks: ['zandvoort', 'laguna', 'redbullring', 'silverstone', 'spa'] },
  { id: 'proto', classId: 'protoclassic', name: { fr: 'Classiques d’Endurance', en: 'Endurance Classics' }, tracks: ['lemans', 'bathurst', 'interlagos', 'suzuka', 'spa'] },
  { id: 'f1classic', classId: 'f1classic', name: { fr: 'Grands Prix Classiques', en: 'Classic Grands Prix' }, tracks: ['monaco', 'zandvoort', 'nurburgring', 'monza', 'silverstone', 'spa'] },
  { id: 'f1modern', classId: 'f1modern', name: { fr: 'Championnat du Monde de Formule', en: 'Formula World Championship' }, tracks: ['monza', 'silverstone', 'monaco', 'spa', 'suzuka', 'interlagos', 'redbullring', 'zandvoort', 'nurburgring'] },
];

// number of laps for a category on a track: keeps races around 3-4 minutes
function lapsFor(trackDef, cat) {
  const vmax = cat.base ? cat.base.vmax : cat.vmax;
  return clamp(Math.round((trackDef.laps || 3) * vmax / 80), 3, 8);
}

const SAVE_KEY = 'slotracer.save.v2';

function defaultSave() {
  return { lang: (navigator.language || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr', sound: true, difficulty: 'medium', livery: 0, name: '', models: {}, ctrl: 'auto', camRotate: true, showLines: false, debug: false, guideMigrated: true, cups: {}, bestLaps: {}, tutorialSeen: false, racesDone: 0 };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const save = Object.assign(defaultSave(), JSON.parse(raw));
    // the driving lines used to be drawn on the road; turn the guide off once for existing saves
    if (!save.guideMigrated) { save.showLines = false; save.guideMigrated = true; }
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

function unlockedClasses(save) {
  const set = new Set();
  CUPS.forEach((c, i) => { if (cupUnlocked(save, i)) set.add(c.classId); });
  return set;
}

function unlockedTracks(save) {
  const set = new Set();
  CUPS.forEach((c, i) => { if (cupUnlocked(save, i)) c.tracks.forEach(t => set.add(t)); });
  return set;
}

function allUnlocked(save) {
  return CUPS.every((c, i) => cupUnlocked(save, i)) && cupState(save, CUPS[CUPS.length - 1].id).done;
}
