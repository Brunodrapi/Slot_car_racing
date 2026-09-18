// Car categories and models. Units: m, m/s, m/s².
//  vmax top speed · accel · brake (deceleration when released) · grip (lateral m/s² at low speed)
//  df downforce (extra grip = df·v², capped) · slide (how brutally the car drifts when over the limit)
//  laneK yaw responsiveness · rearBias rear grip relative to front (<1 oversteer-prone, >1 understeer-prone)
//  cliff how much grip a tyre loses once pushed well past its peak slip angle (0..1)
//  slipPeak body slip angle (rad) at which the tyres give their maximum: bigger = lazier, more visible drift
//  roadScale (road width factor) · zoom (camera)
'use strict';

const CATEGORIES = [
  {
    id: 'f1classic', name: { fr: 'F1 classiques', en: 'Classic F1' },
    desc: { fr: 'Années 60-70 : pneus fins, peu d’appui, châssis nerveux. La moindre erreur se paie.', en: '60s-70s: skinny tyres, little downforce, twitchy. Every mistake costs.' },
    base: { vmax: 76, accel: 8.5, brake: 13, grip: 11.5, df: 0.0006, slide: 0.85, laneK: 5, rearBias: 1.0, cliff: 0.25, slipPeak: 0.14, length: 4.1, width: 1.8 },
    drivers: 10, roadScale: 0.9, zoom: 1.1,
    models: [
      { id: 'type49', name: 'Type 49', shape: 'cigar', mul: { vmax: 1.0, grip: 1.0, accel: 1.03 }, colors: ['#1f6b3a', '#ffd400'] },
      { id: 'f312', name: '312 F1', shape: 'cigar', mul: { vmax: 1.03, grip: 0.97, brake: 0.98 }, colors: ['#e0262c', '#ffffff'] },
      { id: 'ms80', name: 'MS80', shape: 'cigarWing', mul: { vmax: 0.99, grip: 1.04 }, colors: ['#2166d8', '#ffffff'] },
      { id: 'bt24', name: 'BT24', shape: 'cigar', mul: { vmax: 0.98, grip: 1.02, accel: 1.02 }, colors: ['#1f6b3a', '#f4f4f4'] },
      { id: 'type72', name: 'Type 72', shape: 'wedge72', mul: { vmax: 1.02, grip: 1.08, df: 1.8, slide: 0.9 }, colors: ['#22242b', '#e6b422'] },
      { id: 'm23', name: 'M23', shape: 'wedge72', mul: { vmax: 1.03, grip: 1.06, df: 1.6, brake: 1.05 }, colors: ['#ff8c1a', '#ffffff'] },
    ],
  },
  {
    id: 'f1modern', name: { fr: 'F1 modernes', en: 'Modern F1' },
    desc: { fr: 'Appui énorme, freinages ultra tardifs, virages rapides à fond. Très stables.', en: 'Huge downforce, very late braking, fast corners flat out. Very stable.' },
    base: { vmax: 96, accel: 11, brake: 32, grip: 19, df: 0.0075, slide: 0.9, laneK: 7, rearBias: 1.1, cliff: 0.1, slipPeak: 0.07, length: 5.3, width: 2.0 },
    drivers: 12, roadScale: 1, zoom: 1,
    models: [
      { id: 'bull', name: 'Bull RB', shape: 'modern', mul: { vmax: 1.01, df: 1.04 }, colors: ['#1a2a6c', '#ffd400'] },
      { id: 'rosso', name: 'Rosso SF', shape: 'modern', mul: { vmax: 1.02, accel: 1.03, df: 0.98 }, colors: ['#e0262c', '#ffffff'] },
      { id: 'silver', name: 'Silver Arrow', shape: 'modern', mul: { brake: 1.03, grip: 1.02 }, colors: ['#c9ced6', '#12b5a8'] },
      { id: 'papaya', name: 'Papaya MCL', shape: 'modern', mul: { vmax: 1.0, grip: 1.01 }, colors: ['#ff8c1a', '#12b5a8'] },
      { id: 'green', name: 'Racing Green AMR', shape: 'modern', mul: { vmax: 0.99, grip: 1.0 }, colors: ['#1f6b3a', '#7ed321'] },
      { id: 'alpine', name: 'Bleu A5', shape: 'modern', mul: { vmax: 0.99, accel: 1.01 }, colors: ['#2166d8', '#ff4fa3'] },
    ],
  },
  {
    id: 'gt', name: { fr: 'GT', en: 'GT' },
    desc: { fr: 'Les icônes : M1 Procar, F40, Countach, 911 Turbo… Lourdes, puissantes, joueuses.', en: 'The icons: M1 Procar, F40, Countach, 911 Turbo… Heavy, powerful, playful.' },
    base: { vmax: 70, accel: 8, brake: 17, grip: 13.5, df: 0.0015, slide: 0.6, laneK: 6, rearBias: 1.06, cliff: 0.18, slipPeak: 0.12, length: 4.5, width: 2.0 },
    drivers: 10, roadScale: 0.9, zoom: 1.15,
    models: [
      { id: 'm1procar', name: 'M1 Procar', shape: 'gtBoxy', mul: { vmax: 0.98, grip: 1.04, brake: 1.03 }, colors: ['#f4f4f4', '#2166d8'] },
      { id: 'f40', name: 'F40', shape: 'f40', mul: { vmax: 1.05, accel: 1.06, grip: 0.98, df: 1.5 }, colors: ['#e0262c', '#22242b'] },
      { id: 'countach', name: 'Countach LP500', shape: 'wedgeGT', mul: { vmax: 1.03, accel: 1.02, grip: 0.95, brake: 0.95 }, colors: ['#ffd400', '#22242b'] },
      { id: '930', name: '911 Turbo', shape: 'roundGT', mul: { vmax: 0.99, accel: 1.04, grip: 0.97, slide: 1.2 }, colors: ['#c9ced6', '#e0262c'] },
      { id: 'testarossa', name: 'Testarossa', shape: 'wideGT', mul: { vmax: 1.0, grip: 1.0, brake: 0.98 }, colors: ['#e0262c', '#f4f4f4'] },
      { id: 'xj220', name: 'XJ220', shape: 'wideGT', mul: { vmax: 1.07, accel: 0.98, grip: 1.0, df: 1.3 }, colors: ['#12b5a8', '#f4f4f4'] },
    ],
  },
  {
    id: 'protoclassic', name: { fr: 'Prototypes classiques', en: 'Classic prototypes' },
    desc: { fr: 'Le Mans 66-91 : GT40, 917, 962, 787B… Très rapides en ligne droite, de l’appui, longues à arrêter.', en: 'Le Mans 66-91: GT40, 917, 962, 787B… Very fast in a straight line, real downforce, long to stop.' },
    base: { vmax: 84, accel: 9, brake: 20, grip: 14.5, df: 0.0035, slide: 0.7, laneK: 6, rearBias: 1.06, cliff: 0.15, slipPeak: 0.11, length: 4.8, width: 2.0 },
    drivers: 10, roadScale: 1, zoom: 1.05,
    models: [
      { id: 'gt40', name: 'GT40 Mk II', shape: 'gt40', mul: { vmax: 0.98, grip: 0.98, df: 0.7, brake: 0.95, slide: 1.1 }, colors: ['#2166d8', '#f4f4f4'] },
      { id: '917k', name: '917 K', shape: 'longTail', mul: { vmax: 1.03, accel: 1.02, grip: 0.98, df: 0.8, brake: 0.96 }, colors: ['#f4f4f4', '#ff8c1a'] },
      { id: '962c', name: '962 C', shape: 'groupC', mul: { vmax: 1.02, grip: 1.03, df: 1.2 }, colors: ['#f4f4f4', '#e0262c'] },
      { id: 'xjr9', name: 'XJR-9', shape: 'groupC', mul: { vmax: 1.04, grip: 1.02, df: 1.15, accel: 0.99 }, colors: ['#8a3ffc', '#f4f4f4'] },
      { id: '787b', name: '787B', shape: 'groupC', mul: { vmax: 1.0, accel: 1.05, grip: 1.04, df: 1.1, brake: 1.03 }, colors: ['#ff8c1a', '#1f6b3a'] },
      { id: 'c9', name: 'C9', shape: 'groupC', mul: { vmax: 1.06, grip: 1.0, df: 1.1, accel: 1.0 }, colors: ['#c9ced6', '#22242b'] },
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

// Resolved models: category stats × model multipliers.
const MODELS = [];
function resolveModel(cat, m) {
  const b = cat.base, mul = m.mul || {};
  const model = {
    id: m.id, catId: cat.id, name: m.name, shape: m.shape, colors: m.colors, custom: !!m.custom, sprite: m.sprite || null,
    vmax: b.vmax * (mul.vmax || 1), accel: b.accel * (mul.accel || 1), brake: b.brake * (mul.brake || 1),
    grip: b.grip * (mul.grip || 1), df: b.df * (mul.df || 1), slide: b.slide * (mul.slide || 1), laneK: b.laneK,
    // handling balance: a model's `slide` multiplier above 1 makes it more tail-happy
    rearBias: (b.rearBias || 1.04) / Math.pow(mul.slide || 1, 0.5), cliff: b.cliff == null ? 0.25 : b.cliff, slipPeak: (b.slipPeak || 0.1) * Math.pow(mul.slide || 1, 0.5),
    length: m.length || b.length, width: m.width || b.width,
    drivers: cat.drivers, roadScale: cat.roadScale, zoom: cat.zoom,
  };
  return model;
}
for (const cat of CATEGORIES) for (const m of cat.models) MODELS.push(resolveModel(cat, m));

function categoryById(id) { return CATEGORIES.find(c => c.id === id) || CATEGORIES[0]; }
function modelsOf(catId) { return MODELS.filter(m => m.catId === catId); }
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

if (typeof module !== 'undefined') module.exports = { CATEGORIES, MODELS, LIVERIES, AI_NAMES, categoryById, modelsOf, modelById, carClassById, registerModel };
