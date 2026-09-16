// Car categories. Units: m, m/s, m/s².
//  vmax   top speed
//  accel  acceleration at low speed
//  brake  deceleration when the button is released
//  grip   base lateral grip (m/s²) — max cornering acceleration at low speed
//  df     downforce: extra grip = df * v² (capped)
//  slide  how fast the car drifts outward when over the limit (higher = more sudden)
//  laneK  how quickly the car settles back on its line
//  roadScale  road width multiplier (small cars race on narrower roads)
//  zoom   camera zoom multiplier
'use strict';

const CAR_CLASSES = [
  {
    id: 'kart', name: { fr: 'Karting', en: 'Kart' }, shape: 'kart',
    desc: { fr: 'Petit, agile, pardonne beaucoup. Idéal pour apprendre.', en: 'Small, agile and forgiving. Great to learn.' },
    vmax: 32, accel: 9, brake: 14, grip: 9.5, df: 0, slide: 0.55, laneK: 8,
    length: 2.2, width: 1.4, drivers: 8, roadScale: 0.62, zoom: 1.6,
  },
  {
    id: 'touring', name: { fr: 'Tourisme', en: 'Touring' }, shape: 'sedan',
    desc: { fr: 'Berlines de course. Équilibrées et solides.', en: 'Racing sedans. Balanced and sturdy.' },
    vmax: 56, accel: 7.5, brake: 17, grip: 13.5, df: 0.0012, slide: 0.6, laneK: 6,
    length: 4.4, width: 2.0, drivers: 10, roadScale: 0.85, zoom: 1.15,
  },
  {
    id: 'rally', name: { fr: 'Rallye', en: 'Rally' }, shape: 'hatch',
    desc: { fr: 'Glisse volontiers mais se rattrape bien.', en: 'Slides easily but recovers well.' },
    vmax: 52, accel: 9.5, brake: 15, grip: 12.5, df: 0.0006, slide: 0.35, laneK: 7,
    length: 4.2, width: 1.9, drivers: 10, roadScale: 0.8, zoom: 1.15,
  },
  {
    id: 'gt', name: { fr: 'GT3', en: 'GT3' }, shape: 'gt',
    desc: { fr: 'Vite, gros freins, beaucoup d’appui.', en: 'Fast, big brakes, plenty of downforce.' },
    vmax: 72, accel: 8.5, brake: 21, grip: 15.5, df: 0.0028, slide: 0.7, laneK: 6,
    length: 4.6, width: 2.0, drivers: 10,
  },
  {
    id: 'classic', name: { fr: 'F1 Classique', en: 'Classic F1' }, shape: 'classic',
    desc: { fr: 'Années 60 : rapide, pneus fins, pas d’aileron. Traître.', en: '1960s: fast, skinny tyres, no wings. Treacherous.' },
    vmax: 74, accel: 8, brake: 13, grip: 11.5, df: 0.0004, slide: 0.8, laneK: 5,
    length: 4.0, width: 1.7, drivers: 10, roadScale: 0.85, zoom: 1.05,
  },
  {
    id: 'proto', name: { fr: 'Prototype', en: 'Prototype' }, shape: 'proto',
    desc: { fr: 'Hypercar d’endurance. Très rapide, très stable.', en: 'Endurance hypercar. Very fast, very stable.' },
    vmax: 86, accel: 9.5, brake: 25, grip: 17, df: 0.0045, slide: 0.75, laneK: 6,
    length: 4.9, width: 2.0, drivers: 10,
  },
  {
    id: 'formula', name: { fr: 'Formule', en: 'Formula' }, shape: 'formula',
    desc: { fr: 'La monoplace ultime. Freinages tardifs, virages à fond.', en: 'The ultimate single seater. Late braking, flat-out corners.' },
    vmax: 96, accel: 11, brake: 32, grip: 19, df: 0.0075, slide: 0.9, laneK: 7,
    length: 5.2, width: 2.0, drivers: 12,
  },
  {
    id: 'muscle', name: { fr: 'Muscle', en: 'Muscle' }, shape: 'muscle',
    desc: { fr: 'Énorme moteur, freins d’époque. Pour les courageux.', en: 'Huge engine, vintage brakes. For the brave.' },
    vmax: 78, accel: 10.5, brake: 12, grip: 10.5, df: 0.0003, slide: 0.65, laneK: 5,
    length: 5.0, width: 2.1, drivers: 8, roadScale: 0.9, zoom: 1.05,
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

function carClassById(id) { return CAR_CLASSES.find(c => c.id === id) || CAR_CLASSES[0]; }

if (typeof module !== 'undefined') module.exports = { CAR_CLASSES, LIVERIES, AI_NAMES, carClassById };
