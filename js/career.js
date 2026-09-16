// Career: a series of cups, each tied to a car class. Finish a cup in the top 3 to unlock the next.
'use strict';

const CUPS = [
  { id: 'kart', classId: 'kart', name: { fr: 'Coupe Karting', en: 'Kart Cup' }, tracks: ['zandvoort', 'redbullring', 'monaco'] },
  { id: 'touring', classId: 'touring', name: { fr: 'Trophée Tourisme', en: 'Touring Trophy' }, tracks: ['zandvoort', 'interlagos', 'nurburgring', 'silverstone'] },
  { id: 'rally', classId: 'rally', name: { fr: 'Rallye Circuit', en: 'Rally Sprint Series' }, tracks: ['laguna', 'bathurst', 'monaco'] },
  { id: 'gt', classId: 'gt', name: { fr: 'Championnat GT3', en: 'GT3 Championship' }, tracks: ['spa', 'laguna', 'redbullring', 'silverstone', 'suzuka'] },
  { id: 'classic', classId: 'classic', name: { fr: 'Grands Prix Classiques', en: 'Classic Grands Prix' }, tracks: ['monaco', 'monza', 'nurburgring', 'spa'] },
  { id: 'endurance', classId: 'proto', name: { fr: 'Série Endurance', en: 'Endurance Series' }, tracks: ['lemans', 'bathurst', 'spa', 'suzuka', 'interlagos'] },
  { id: 'muscle', classId: 'muscle', name: { fr: 'Muscle Cup', en: 'Muscle Cup' }, tracks: ['laguna', 'bathurst', 'interlagos', 'monza'] },
  { id: 'formula', classId: 'formula', name: { fr: 'Championnat du Monde de Formule', en: 'Formula World Championship' }, tracks: ['monza', 'silverstone', 'monaco', 'spa', 'suzuka', 'interlagos', 'redbullring', 'zandvoort', 'nurburgring'] },
];

// number of laps for a class on a track: keeps races around 3-4 minutes
function lapsFor(trackDef, cls) {
  return clamp(Math.round(trackDef.laps * cls.vmax / 80), 3, 8);
}

const SAVE_KEY = 'slotracer.save.v1';

function defaultSave() {
  return { lang: (navigator.language || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr', sound: true, difficulty: 'medium', livery: 0, name: '', cups: {}, bestLaps: {}, tutorialSeen: false, racesDone: 0 };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    return Object.assign(defaultSave(), JSON.parse(raw));
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
