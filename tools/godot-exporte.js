// Le jeu, sorti du code web pour la version Godot : les circuits, les voitures, et des courses de
// référence pour prouver que la physique et la course portées sont les mêmes.
//
//   node tools/godot-exporte.js            # tout
//   node tools/godot-exporte.js spa        # un circuit (et le catalogue)
//
// Écrit dans godot/donnees/ :
//   catalogue.json            catégories, voitures (et leurs nombres), livrées, pilotes, difficultés
//   circuits/<id>.json/.bin   le tracé tel que js/track.js le calcule, en flottants 64 bits
//   ref/…                     les courses de référence (hors dépôt : refaites en une minute)
//
// Les nombres ne passent PAS par le JSON : l'analyseur de Godot n'arrondit pas toujours la
// dix-septième décimale comme JavaScript, et la moindre différence suffit à faire diverger deux
// simulations d'une glissade. Ils vont dans les .bin, en flottants 64 bits petit-boutistes.
//
// Le hasard des courses de référence est tiré d'un xorshift32 à graine fixe, à la place de
// Math.random : godot/scripts/hasard.gd tire le même, dans le même ordre.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'godot', 'donnees');
const SEUL = process.argv[2] || null;

let src = '';
for (const f of ['util', 'traces', 'tracks', 'track', 'cars', 'car', 'flags', 'race'])
  src += fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8').replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';

const M = Object.create(Math);
let etat = 1;
M.random = () => { etat ^= etat << 13; etat >>>= 0; etat ^= etat >>> 17; etat ^= etat << 5; etat >>>= 0; return etat / 4294967296; };
const GRAINE = (g) => { etat = (g * 2654435761) >>> 0 || 1; };

const ETAT = () => etat, POSE_ETAT = (v) => { etat = v; };
const ctx = { Math: M, GRAINE, ETAT, POSE_ETAT, console, Date, setTimeout: () => 0, SEUL, resultat: null };
src += `
const NUM = ['vmax','accel','brake','grip','df','slide','laneK','rearBias','cliff','slipPeak','length','width','zoom','drivers'];
const catalogue = {
  categories: CATEGORIES.map((c) => ({ id: c.id, nom: c.name, desc: c.desc || null, drivers: c.drivers, roadScale: c.roadScale, zoom: c.zoom })),
  voitures: MODELS.map((m) => ({ id: m.id, cat: m.catId, nom: m.name, shape: m.shape, colors: m.colors, drivers: m.drivers,
    driveCurve: m.driveCurve || null, perf: perfOf(m), weightKg: m.weightKg, engine: m.engine || null,
    livrees: (m.livrees && m.livrees.length ? m.livrees : [livreeDe(m, 0)]).map((l) => ({ id: l.id || '', nom: l.nom || m.name, en: l.en || null, top: l.top, pick: l.pick })) })),
  livreries: LIVERIES, pilotes: AI_NAMES, difficultes: DIFFICULTY, points: POINTS, penaliteFixe: PENALITE_FIXE, perfBornes: PERF_RANGE,
  vmaxEcran: VMAX_ECRAN, defaut: DEFAUT_CAT,
  circuits: TRACKS.map((t) => ({ id: t.id, nom: t.name, pays: t.country, difficulty: t.difficulty, drapeau: t.flag, theme: t.theme || 'park' })),
  champsNombres: [...NUM, 'dcFrom', 'dcTo', 'dcLow', 'dcHigh'],
};
// Les nombres de chaque voiture, à part (catalogue.bin) : ce sont eux que lit la physique.
const nombresVoitures = MODELS.flatMap((m) => { const q = m.driveCurve; return [...NUM.map((k) => m[k]), q ? q.from : 0, q ? q.to : 0, q ? q.low : 1, q ? q.high : 1]; });
/* Les projecteurs de la nuit (js/render.js, NightLighting.setTrack) : un tous les soixante-dix
mètres au plus, de chaque côté, là où un bac à gravier assez large borde la piste, tourné vers lui. */
function projecteurs(track) {
  const candidates = [];
  for (let s = 0; s < track.length; s += 6) for (const side of [-1, 1]) {
    const k = track.idx(s), w = track.largeurBac(k, side);
    if (w < 5 || track.tunnels.some((t) => (k - t.from + track.n) % track.n < t.n)) continue;
    const hw = side > 0 ? track.hwLeftAt(s) : track.hwRightAt(s);
    const targetLat = side * (hw + w * .55);
    if (track.runoffSurfaceAt(s, targetLat) !== 'gravel') continue;
    const target = track.pos(s, targetLat), source = track.pos(s, side * (hw + w + 2.5));
    const length = w + 5, width = Math.min(22, Math.max(12, w * .85));
    candidates.push({ x: source.x, y: source.y, heading: Math.atan2(target.y - source.y, target.x - source.x),
      s, side, length, width, radius: Math.hypot(length, width), power: .84 });
  }
  candidates.sort((a, b) => b.length - a.length || a.s - b.s);
  const lamps = [];
  for (const lamp of candidates) {
    if (lamps.some((l) => {
      const ds = Math.abs(l.s - lamp.s);
      return (l.side === lamp.side && Math.min(ds, track.length - ds) < 70) || Math.hypot(l.x - lamp.x, l.y - lamp.y) < 36;
    })) continue;
    lamps.push(lamp);
  }
  return lamps;
}
const circuits = TRACKS.filter((t) => !SEUL || t.id === SEUL).map((def) => {
  const T = new Track(def, CATEGORIES[0].roadScale);
  return { def, T, projecteurs: projecteurs(T) };
});

/* Les courses de référence, à Stand de frites.

   1. Seule : la voiture du joueur, commandée par un programme fixe — trois parcours, comme ceux
      du prototype (propre, pied au plancher, au hasard).
   2. Une course complète : douze voitures, l'IA en difficulté normale, deux tours, contacts et
      drapeaux compris. Le joueur est mené par le pilote automatique du banc (aiThrottle), et ses
      commandes sont notées pas à pas pour être rejouées telles quelles. */
const REF_CHAMPS = ['x','y','th','v','vl','w','delta','s','lat','selS','selV','Ff','Fr','glisseArr','patine','patineFx',
  'beta','engineCut','usage','alphaF','alphaR','offT','grassT','slide','ressenti','lapStart'];
const REF_DRAPEAUX = ['herbe','lap','crashes','barrierHits','engineStopped','checkpoint','started','rejoined'];
function seule(nom, duree, commande) {
  const race = new Race({ trackDef: TRACKS.find((t) => t.id === 'spa'), modelId: 'porsche991gt3r', difficulty: 'medium', playerLivery: 0, mode: 'timetrial' });
  race.state = 'racing'; for (const c of race.cars) c.gridLat = null;
  const p = race.player, n = Math.round(duree / race.dt), L = REF_CHAMPS.length + REF_DRAPEAUX.length, depart = [p.s, p.lat];
  const entrees = new Float64Array(n * 2), etats = new Float64Array(n * L);
  for (let i = 0; i < n; i++) {
    const c = commande(race, p, i * race.dt);
    p.sel = c.sel;
    race._step(race.dt, c.thr ? 1 : 0, null);
    entrees[i * 2] = c.thr ? 1 : 0; entrees[i * 2 + 1] = c.sel;
    REF_CHAMPS.forEach((k, j) => { etats[i * L + j] = p[k]; });
    REF_DRAPEAUX.forEach((k, j) => { etats[i * L + REF_CHAMPS.length + j] = k === 'herbe' ? (p.state === 'grass' ? 1 : 0) : Number(p[k]); });
  }
  return { nom, n, entrees, etats, largeur: L, depart };
}
const refs = [];
if (!SEUL || SEUL === 'spa') {
  GRAINE(7);
  const LEVIER = [0, 1, -1, 0.5, 0, -0.5, 1, 0, -1, 0];
  refs.push(seule('propre', 190, (race, p, t) => ({ thr: aiThrottle(p, race.cars, race.dt, { marginBase: 1.0, marginSpread: 0, maxMargin: 2 }), sel: LEVIER[Math.floor(t / 7) % LEVIER.length] })));
  refs.push(seule('brutal', 90, (race, p, t) => ({ thr: true, sel: Math.sin(t * 0.4) })));
  GRAINE(11);
  let thr = false, sel = 0;
  refs.push(seule('hasard', 90, () => {
    if (Math.random() < 0.02) thr = !thr;
    if (Math.random() < 0.004) sel = Math.round((Math.random() * 2 - 1) * 4) / 4;
    return { thr: thr || Math.random() < 0.3, sel };
  }));
}
let course = null;
if (!SEUL || SEUL === 'spa') {
  GRAINE(2026);
  const race = new Race({ trackDef: TRACKS.find((t) => t.id === 'spa'), modelId: 'porsche991gt3r', difficulty: 'medium', playerLivery: 0, mode: 'race', laps: 2 });
  const roster = race.cars.map((c) => ({ nom: c.name, modele: c.cls.id, livery: LIVERIES.indexOf(c.livery), livree: c.livree, skill: c.skill, numero: c.number, joueur: c.isPlayer, aiTimer: c.aiTimer }));
  const graineApres = ETAT();
  // Les commandes du joueur viennent d'un AUTRE tirage, pour ne pas toucher à celui de la course.
  let etatJoueur = 99;
  const LEVIER = [0, 0, 1, 0, -1, 0, 0.5, 0];
  const p = race.player, N = race.cars.length, K = 6;
  const entrees = [], suivi = [];
  let pas = 0;
  while (race.state !== 'finished' && pas < 120 * 400) {
    let thr = false;
    if (race.state === 'racing' || race.state === 'finishing') {
      const sv = ETAT(); POSE_ETAT(etatJoueur);
      thr = aiThrottle(p, race.cars, race.dt, { marginBase: 0.97, marginSpread: 0, maxMargin: 2 });
      etatJoueur = ETAT(); POSE_ETAT(sv);
    } else thr = race.countdown < 1.2;
    const sel = LEVIER[Math.floor(race.time / 9) % LEVIER.length];
    p.sel = sel;
    race._step(race.dt, thr ? 1 : 0, null);
    entrees.push(thr ? 1 : 0, sel);
    for (const c of race.cars) suivi.push(c.x, c.y, c.th, c.v, c.s, c.lap + (c.finished ? 1000 : 0));
    pas++;
  }
  course = { n: pas, voitures: N, champs: K, entrees: Float64Array.from(entrees), suivi: Float64Array.from(suivi), roster, graineApres,
    resultats: race.results.map((r) => ({ numero: r.car.number, nom: r.car.name, pos: r.pos, temps: r.time, brut: r.brut, penalite: r.penalite, fautes: r.fautes, meilleur: r.bestLap })),
    hasardFin: ETAT() };
}
/* LA COURSE AVEC LES DÉGÂTS (essai) : trois tours de Spa, dégâts et stands, l'IA en difficulté
difficile pour qu'il y ait des contacts ; le joueur demande les stands dès que sa voiture est abîmée
de plus de 2 % après le premier tour, comme la coche du levier le lui permettrait. On suit en plus
les dommages et les arrêts de chaque voiture. */
let courseDegats = null;
if (!SEUL || SEUL === 'spa') {
  GRAINE(4242);
  const race = new Race({ trackDef: TRACKS.find((t) => t.id === 'spa'), modelId: 'porsche991gt3r', difficulty: 'hard', playerLivery: 0, mode: 'race', laps: 3, degats: true });
  const roster = race.cars.map((c) => ({ nom: c.name, modele: c.cls.id, livery: LIVERIES.indexOf(c.livery), livree: c.livree, skill: c.skill, numero: c.number, joueur: c.isPlayer, aiTimer: c.aiTimer }));
  const graineApres = ETAT();
  let etatJoueur = 77;
  const LEVIER = [0, -1, 1, 0, -1, 1, 0.5, -0.5];
  const p = race.player, N = race.cars.length, K = 9;
  const entrees = [], suivi = [];
  let pas = 0, arrets = 0;
  while (race.state !== 'finished' && pas < 120 * 600) {
    let thr = false;
    if (race.state === 'racing' || race.state === 'finishing') {
      const sv = ETAT(); POSE_ETAT(etatJoueur);
      thr = aiThrottle(p, race.cars, race.dt, { marginBase: 0.99, marginSpread: 0, maxMargin: 2 });
      etatJoueur = ETAT(); POSE_ETAT(sv);
      // dans la voie, le joueur dose comme l'IA le ferait : freiner pour la zone, s'y arrêter, repartir
      const z = p.pitState === 'voie' ? race.track.pitAt(p.s) : null;
      if (z) thr = z.boite < 0 && !p.pitServi ? p.v < Math.min(22, Math.sqrt(2 * p.cls.brake * 0.8 * Math.max(0, -z.boite))) * 0.92 : p.v < 22 * 0.95;
    } else thr = race.countdown < 1.2;
    const sel = LEVIER[Math.floor(race.time / 7) % LEVIER.length];
    p.sel = sel;
    const pit = race.stands && p.lap >= 1 && !p.pitServi && !p.finished && p.damage > 0.02 && !p.pitAsk && !p.pitState;
    if (pit) p.pitAsk = true;
    race._step(race.dt, thr ? 1 : 0, null);
    entrees.push(thr ? 1 : 0, sel, pit ? 1 : 0);
    for (const c of race.cars) suivi.push(c.x, c.y, c.th, c.v, c.s, c.lap + (c.finished ? 1000 : 0), c.damage, c.pitsDone, c.abandon ? 1 : 0);
    pas++;
  }
  for (const c of race.cars) arrets += c.pitsDone;
  courseDegats = { n: pas, voitures: N, champs: K, entrees: Float64Array.from(entrees), suivi: Float64Array.from(suivi), roster, graineApres, arrets,
    resultats: race.results.map((r) => ({ numero: r.car.number, nom: r.car.name, pos: r.pos, temps: r.time, abandon: !!r.abandon, damage: r.car.damage, pits: r.car.pitsDone })),
    hasardFin: ETAT() };
}
resultat = { catalogue, nombresVoitures, circuits, refs, course, courseDegats, REF_CHAMPS: [...REF_CHAMPS, ...REF_DRAPEAUX] };
`;
GRAINE(1);
vm.runInNewContext(src, ctx, { filename: 'godot-exporte' });
const { catalogue, nombresVoitures, circuits, refs, course, courseDegats, REF_CHAMPS: CHAMPS } = ctx.resultat;

fs.mkdirSync(path.join(OUT, 'circuits'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'ref'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'catalogue.json'), JSON.stringify(catalogue, null, 1) + '\n');
fs.writeFileSync(path.join(OUT, 'catalogue.bin'), Buffer.from(Float64Array.from(nombresVoitures).buffer));

// ---------- les circuits ----------
const BF = ['ax', 'ay', 'bx', 'by', 'tx', 'ty', 'nx', 'ny', 'len', 'half', 's', 'side', 'level'];
for (const { def, T, projecteurs } of circuits) {
  const morceaux = [], index = {};
  let pos = 0;
  const pose = (nom, valeurs) => {
    const a = Float64Array.from(valeurs);
    index[nom] = [pos, a.length];
    morceaux.push(Buffer.from(a.buffer));
    pos += a.length;
  };
  for (const k of ['xs', 'ys', 'th', 'nx', 'ny', 'k', 'hwL', 'hwR', 'kerb']) pose(k, T[k]);
  for (const k of ['racing', 'jaune', 'bleu']) { pose('ligne_' + k, T.lines[k]); pose('lineK_' + k, T.lineK[k]); }
  // Les dégagements : bitume et gravier, par côté. Un circuit sans bitume (asphaltW absent) est
  // noté comme tel : là, toute sortie est une sortie dans l'herbe ou le gravier.
  for (const side of ['L', 'R']) {
    pose('asphaltW_' + side, T.asphaltW ? T.asphaltW[side] : new Float32Array(T.n));
    pose('bacW_' + side, T.bacW ? T.bacW[side] : new Float32Array(T.n));
  }
  // Les plaques posées à la main (track.pads) : un polygone, sa surface et sa boîte.
  pose('plaques', (T.pads || []).flatMap((q) => [q.surface === 'gravel' ? 1 : 0, q.poly.length, q.bbox.minX, q.bbox.maxX, q.bbox.minY, q.bbox.maxY, ...q.poly.flat()]));
  pose('barrieres', T.barriers.flatMap((b) => [...BF.map((f) => b[f] || 0), b.kind === 'tyres' ? 1 : 0]));
  pose('croisements', T.crossings.map((c) => c.over));
  pose('scalaires', [T.n, T.ds, T.length, T.halfWidth, T.barrierCell, T.width]);
  // la voie des stands (track._buildPits) : entrée, boîte, sortie, longueur, séparation, largeur, zone
  const P = T.pit;
  pose('stands', P ? [P.entree, P.boite, P.sortie, P.long, P.separation, P.largeur, P.zone] : []);
  fs.writeFileSync(path.join(OUT, 'circuits', T.id + '.bin'), Buffer.concat(morceaux));
  fs.writeFileSync(path.join(OUT, 'circuits', T.id + '.json'), JSON.stringify({
    id: T.id, nom: T.name, pays: def.country, drapeau: def.flag, theme: T.theme, tours: T.laps, asphalte: !!T.asphaltW,
    plaques: (T.pads || []).length,
    barriere: { champs: [...BF, 'pneus'] }, bornes: T.bounds, index,
    projecteurs: projecteurs.map((l) => ({ x: l.x, y: l.y, cap: l.heading, longueur: l.length, largeur: l.width, puissance: l.power })),
    // les tunnels (track.tunnels) : premier point et nombre de points couverts — la nuit y tombe
    tunnels: (T.tunnels || []).map((t) => [t.from, t.n]),
    lumiereTunnel: def.lumiereTunnel,
  }) + '\n');
  console.log(T.id.padEnd(12), T.name.padEnd(22), T.n, 'points,', T.barriers.length, 'protections,', T.crossings.length, 'croisement(s),', projecteurs.length, 'projecteurs,', T.laps, 'tours');
}

// ---------- les courses de référence ----------
for (const r of refs) {
  const tete = Buffer.from(Float64Array.from([r.n, r.largeur, r.depart[0], r.depart[1]]).buffer);
  fs.writeFileSync(path.join(OUT, 'ref', 'seule-' + r.nom + '.bin'), Buffer.concat([tete, Buffer.from(r.entrees.buffer), Buffer.from(r.etats.buffer)]));
}
if (refs.length) fs.writeFileSync(path.join(OUT, 'ref', 'champs.json'), JSON.stringify(CHAMPS) + '\n');
if (course) {
  const tete = Buffer.from(Float64Array.from([course.n, course.voitures, course.champs]).buffer);
  fs.writeFileSync(path.join(OUT, 'ref', 'course.bin'), Buffer.concat([tete, Buffer.from(course.entrees.buffer), Buffer.from(course.suivi.buffer)]));
  fs.writeFileSync(path.join(OUT, 'ref', 'course.json'), JSON.stringify({ roster: course.roster, resultats: course.resultats, graineApres: course.graineApres, hasardFin: course.hasardFin }, null, 1) + '\n');
  const g = course.resultats[0];
  console.log(`course de référence : ${course.voitures} voitures, ${course.n} pas ; vainqueur n° ${g.numero} ${g.nom} en ${g.temps.toFixed(3)} s`);
}
if (courseDegats) {
  const c = courseDegats, tete = Buffer.from(Float64Array.from([c.n, c.voitures, c.champs]).buffer);
  fs.writeFileSync(path.join(OUT, 'ref', 'course-degats.bin'), Buffer.concat([tete, Buffer.from(c.entrees.buffer), Buffer.from(c.suivi.buffer)]));
  fs.writeFileSync(path.join(OUT, 'ref', 'course-degats.json'), JSON.stringify({ roster: c.roster, resultats: c.resultats, graineApres: c.graineApres, hasardFin: c.hasardFin }, null, 1) + '\n');
  const g = c.resultats[0], d = c.resultats.map((r) => Math.round(r.damage * 100)).join(' ');
  console.log(`course avec dégâts : ${c.voitures} voitures, ${c.n} pas, ${c.arrets} arrêts au stand ; vainqueur n° ${g.numero} en ${g.temps.toFixed(3)} s ; dommages finaux (%) ${d}`);
}
console.log(`catalogue : ${catalogue.categories.length} catégories, ${catalogue.voitures.length} voitures, ${catalogue.voitures.reduce((a, v) => a + v.livrees.length, 0)} livrées`);
