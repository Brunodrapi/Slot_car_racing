/* L'ÉDITEUR DE CIRCUITS — retoucher à la main tout ce que le jeu dessine et fait rouler.

Un circuit du jeu est presque entièrement déduit de son tracé : les trajectoires du solveur, les
panneaux de la courbure, les dégagements de la courbure ou des zones déclarées, les protections de
ces dégagements, les bois, tribunes, parkings et camping-cars des zones d'implantation, et le semis
d'arbres, de rochers et de bottes de paille d'une graine. L'éditeur reprend chacune de ces couches,
en quatre onglets, sur la même piste :

  Trajectoires      la corde, l'intérieure et l'extérieure, point par point ;
  Largeur de piste  élargir un virage, ou le redessiner en tirant ses bords ;
  Panneaux          les panneaux de freinage — sens, intensité, distance annoncée, position — et
                    la règle, qui mesure le long du tour et à vol d'oiseau ;
  Objets            Objets (arbres, rochers, véhicules, bâtiments : choisir, déplacer, tourner,
                    ajouter, gommer), Hors-piste (zones de bitume, de gravier ou d'herbe, surfaces
                    bitumées), Barrières (tracer, reprendre, couper), Zones (d'implantation) et
                    Stands (entrée, zone d'arrêt, sortie).

Le mode « Tracé », qui dessinait un circuit perso à partir de rien, a été retiré à la demande de
Bruno (0.52.31) : tout se fait ici. Un circuit perso déjà enregistré s'ouvre toujours.

CE QUI EST AFFICHÉ EST CE QUE LE JEU DESSINE, parce que c'est son moteur de rendu qui le dessine : un
`Track` construit avec la reprise, et un `Renderer` qui le peint. Les poignées d'édition passent par
le calque du HUD, au-dessus.

La reprise du décor touche les seules clés de `CLES_DECOR` (`js/tracks.js`) ; les trajectoires et
les panneaux ont leurs propres bases (`lines`, `panneaux`), celles que le jeu relit. Tout s'enregistre
dans le navigateur — le jeu le joue tout de suite, sur ce poste — et se reporte dans `js/tracks.js`
avec « Fabriquer tracks.js », qui seul le rend valable pour tout le monde. Pour un circuit perso,
tout s'enregistre dans le circuit lui-même. */
'use strict';

const ECHELLE_ROUTE = 0.9;                     // la largeur de route de toutes les catégories (cars.js)
const COUL_SURF = { asphalt: '#d9dde3', gravel: '#e8c46a', grass: '#7fd36b' };
const COUL_ZONE = { bois: '#5fd16d', tribune: '#6aa8ff', stands: '#ff6a5a', hangars: '#c9c9c9',
  parking: '#9aa0ff', camping: '#ffb347', nu: '#ffffff' };
const NOMS_ZONE = { bois: 'Bois', tribune: 'Tribunes', stands: 'Stands', hangars: 'Hangars', parking: 'Parking',
  camping: 'Camping-cars', nu: 'Vide (pas de semis)' };
const DEFAUTS_ZONE = { bois: { recul: 10, prof: 50 }, tribune: { recul: 10, prof: 16, module: 28 },
  stands: { recul: 11, prof: 22, module: 40 }, hangars: { recul: 16, prof: 26, module: 28 },
  parking: { recul: 18, prof: 40 }, camping: { recul: 2.5 }, nu: { prof: 120 } };
const NOMS_PROP = { tree: 'Feuillu', tree2: 'Feuillu 2', pine: 'Sapin (rosette)', pine2: 'Sapin (rond)',
  bush: 'Buisson', palm: 'Palmier', rock: 'Rocher', bales: 'Bottes de paille', house: 'Maison blanche',
  house2: 'Maison à tuiles', chapel: 'Chapelle' };
const NOMS_VEH = { citadine: 'Citadine', compacte: 'Compacte', berline: 'Berline', break: 'Break', suv: 'SUV',
  taxi: 'Taxi', fourgonnette: 'Fourgonnette', pickup: 'Pick-up', minibus: 'Minibus', utilitaire: 'Utilitaire',
  campingcar: 'Camping-car', bus: 'Bus', semi: 'Semi-remorque', moto: 'Moto' };

const DEC = {
  actif: false, rendu: null, cv: null,
  id: null, perso: false,          // le circuit, et s'il vient de la base (circuit perso)
  def0: null,                      // la définition d'origine : le fichier, ou le circuit perso
  decor: {},                       // la reprise en cours, clés de CLES_DECOR
  local: false,                    // une reprise est enregistrée sur ce poste
  track: null,
  outil: 'lignes', mode: 'choisir',
  sel: null, drag: null, trace: null, survol: null,
  ajout: 'mix-feuillus', gomme: 6,
  annule: [], modif: false,
  lignes: null,                    // les trois trajectoires en cours : points de contrôle, unités de `pts`
  onglet: 'lignes',                // Trajectoires, Largeur de piste, Panneaux ou Objets
  panneaux: null, panModif: false, // la liste reprise, et si c'en est une (sinon le jeu calcule)
  selP: null, viseur: null,        // le panneau choisi, la station visée
  mesure: [],                      // zéro, une ou deux stations : la règle
  ligne: 'racing',                 // celle qu'on modifie
  peintPrevu: false, refaitPrevu: null,
  pointeurs: new Map(), pince: null,
};

/* ------------------------------------------------- repères */

const $d = (id) => document.getElementById(id);
const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 10000) / 10000;
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
const egal = (a, b) => JSON.stringify(a == null ? null : a) === JSON.stringify(b == null ? null : b);

function versMonde(px, py) { const r = DEC.rendu, c = r.cam; return { x: c.x + (px - r.w / 2) / c.zoom, y: c.y + (py - r.h / 2) / c.zoom }; }
function versEcran(x, y) { const r = DEC.rendu, c = r.cam; return { x: r.w / 2 + (x - c.x) * c.zoom, y: r.h / 2 + (y - c.y) * c.zoom }; }
function rayonDoigt() { return DEC.rendu && DEC.rendu.touch ? 16 : 9; }

// Une projection sur la piste : globale, ou près d'une abscisse connue.
function projette(x, y, pres) {
  const T = DEC.track;
  return pres == null ? T.project(x, y, 0, Math.ceil(T.n / 2) + 1) : T.project(x, y, pres, 220);
}
const bord = (s, side) => (side > 0 ? DEC.track.hwLeftAt(s) : DEC.track.hwRightAt(s));
// Une fraction ramenée près d'une référence, pour les zones qui passent la ligne de départ.
function deplie(f, ref) { while (f < ref - 0.5) f += 1; while (f > ref + 0.5) f -= 1; return f; }

/* ------------------------------------------------- rendu */

const COURSE_FAUSSE = { cars: [], opts: { spectator: true }, usure: true, flags: null, state: 'idle', mode: 'timetrial' };
const UI_FAUSSE = { app: { save: {}, spectator: { effectiveMode: 'full', drawMap: (hud) => dessinerCalque(hud) } }, t: (k) => k };

function peindre() {
  if (DEC.peintPrevu) return;
  DEC.peintPrevu = true;
  requestAnimationFrame(() => {
    DEC.peintPrevu = false;
    if (!DEC.actif || !DEC.track) return;
    COURSE_FAUSSE.track = DEC.track;
    DEC.rendu.draw(COURSE_FAUSSE, UI_FAUSSE);
  });
}

function definition() {
  const d = { ...avecDecor(DEC.def0, DEC.decor) };
  if (DEC.lignes) d.lines = DEC.lignes;
  if (DEC.panModif && DEC.panneaux) d.panneaux = panneauxPlats(); else delete d.panneaux;
  return d;
}

// Reconstruire la piste et son décor : à la fin d'un geste, pas pendant.
function refaire(tout) {
  clearTimeout(DEC.refaitPrevu);
  DEC.refaitPrevu = setTimeout(() => {
    DEC.calculLignes = null;                  // le calcul suit la piste retouchée
    try {
      DEC.track = new Track(definition(), ECHELLE_ROUTE);
      DEC.rendu.setTrack(DEC.track);
    } catch (e) { etatDecor('Le circuit ne se construit pas avec cette retouche : ' + e.message); console.warn(e); return; }
    if (tout) cadrer();
    majFiche(); peindre();
  }, 20);
}

function cadrer() {
  const r = DEC.rendu, b = DEC.track.bounds, large = window.innerWidth > 800;
  const panneau = $d('panel').getBoundingClientRect();
  const x0 = large ? panneau.right : 0, y0 = large ? 0 : panneau.bottom;
  const w = r.w - x0, h = r.h - y0;
  r.cam.zoom = Math.min(w / (b.maxX - b.minX + 80), h / (b.maxY - b.minY + 80));
  r.cam.x = (b.minX + b.maxX) / 2 - (x0 + w / 2 - r.w / 2) / r.cam.zoom;
  r.cam.y = (b.minY + b.maxY) / 2 - (y0 + h / 2 - r.h / 2) / r.cam.zoom;
  DEC.zoomMin = r.cam.zoom * 0.5;
  peindre();
}

/* ------------------------------------------------- reprise et annulation */

// Toute retouche passe ici : une étape d'annulation, puis la piste reconstruite.
function changer(fn) {
  DEC.annule.push(instantane());
  if (DEC.annule.length > 80) DEC.annule.shift();
  fn();
  nettoyer();
  DEC.modif = true;
  refaire();
}
// ce qu'« Annuler » rétablit : le décor et les trajectoires, qui se retouchent dans le même éditeur
function instantane() { return JSON.stringify({ decor: DEC.decor, lignes: DEC.lignes, panneaux: DEC.panneaux, panModif: DEC.panModif }); }
function annuler() {
  if (!DEC.annule.length) return;
  const e = JSON.parse(DEC.annule.pop());
  DEC.decor = e.decor; DEC.lignes = e.lignes; DEC.panneaux = e.panneaux; DEC.panModif = e.panModif; DEC.selP = null;
  DEC.sel = null; DEC.trace = null; DEC.modif = true;
  refaire();
}
const VIDES = ['roadWidenings', 'barrierPaths', 'barrierCuts', 'asphaltPads'];
// Une liste vide ne s'écrit pas : `objets` sans retouche, c'est pas de clé du tout.
function nettoyer() {
  const o = DEC.decor.objets;
  if (o && o.retires) o.retires = o.retires.filter((p, k) => o.retires.findIndex((q) => dejaRetire([q], p)) === k);
  if (o && !(o.retires || []).length && !(o.ajouts || []).length) delete DEC.decor.objets;
  for (const k of VIDES)
    if (Array.isArray(DEC.decor[k]) && !DEC.decor[k].length) delete DEC.decor[k];
}
function objets() {
  if (!DEC.decor.objets) DEC.decor.objets = { retires: [], ajouts: [] };
  const o = DEC.decor.objets;
  o.retires = o.retires || []; o.ajouts = o.ajouts || [];
  return o;
}

/* ------------------------------------------------- les objets du décor */

// Tous les objets dessinés, avec leur couche : semis, arbres de bois, bâtis et voitures, tas.
function tousObjets() {
  const r = DEC.rendu, out = [];
  for (const o of r.topProps || []) out.push({ src: 'prop', o });
  const im = r.implantation;
  if (im) {
    for (const o of im.arbres) out.push({ src: 'arbre', o });
    for (const o of im.batis) out.push({ src: o.type === 'voiture' ? 'vehicule' : 'bati', o });
  }
  for (const o of r.tas || []) out.push({ src: 'tas', o });
  return out;
}
function rayonProp(o) {
  const k = TOP_KINDS.find((t) => t.id === o.id);
  return (k ? k.wm : 5) * (o.e || 1) * 0.42;
}
function empreinte(e) {
  if (e.src === 'vehicule' || e.src === 'bati') return sceneryFootprint(e.o);
  if (e.src === 'tas') return tasEmpreinte(e.o);
  return null;
}
function dansPoly(pts, x, y) {
  let dedans = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}
// L'objet sous le pointeur : le plus petit de ceux qui le contiennent.
function objetSous(x, y) {
  let best = null, aire = Infinity;
  const marge = rayonDoigt() / DEC.rendu.cam.zoom * 0.6;
  for (const e of tousObjets()) {
    const p = empreinte(e);
    let a;
    if (p) {
      if (!dansPoly(p, x, y)) continue;
      a = e.o.l && e.o.w ? e.o.l * e.o.w : 20;
    } else {
      const rr = rayonProp(e.o) + marge;
      if (Math.hypot(e.o.x - x, e.o.y - y) > rr) continue;
      a = rr * rr * 3;
    }
    if (a < aire) { aire = a; best = e; }
  }
  return best;
}
// L'enregistrement complet d'un objet, tel qu'on le pose dans `objets.ajouts`.
function enregistrement(e) {
  const o = e.o, rec = { k: e.src };
  for (const [k, v] of Object.entries(o)) {
    if (k.startsWith('_') || k === 'ajout' || k === 'i' || v === undefined) continue;
    if (e.src === 'vehicule' && k === 'type') continue;
    rec[k] = typeof v === 'number' ? (k === 'x' || k === 'y' ? r2(v) : Math.round(v * 1000) / 1000) : v;
  }
  return rec;
}
function prochainI() { return (objets().ajouts.reduce((m, a) => Math.max(m, a.i || 0), 0)) + 1; }
function recDe(e) { return e.o.ajout ? objets().ajouts.find((a) => a.i === e.o.i) : null; }

// Un objet déjà retiré ne se retire pas deux fois : la gomme repasse sur ce qu'elle a effacé.
const dejaRetire = (liste, p) => liste.some((q) => Math.abs(q[0] - p[0]) < 0.05 && Math.abs(q[1] - p[1]) < 0.05);
function supprimerObjet(e) {
  const ob = objets(), p = [r2(e.o.x), r2(e.o.y)];
  if (e.o.ajout) ob.ajouts = ob.ajouts.filter((a) => a.i !== e.o.i);
  else if (!dejaRetire(ob.retires, p)) ob.retires.push(p);
}
// Modifier un objet : le sien s'il a été ajouté, sinon on le retire et on en pose une copie.
function modifierObjet(e, patch) {
  const rec = recDe(e);
  if (rec) { Object.assign(rec, patch); return rec.i; }
  const ob = objets(), i = prochainI();
  const p = [r2(e.o.x), r2(e.o.y)];
  if (!dejaRetire(ob.retires, p)) ob.retires.push(p);
  ob.ajouts.push({ ...enregistrement(e), ...patch, i });
  return i;
}
function retrouveSel() {
  const s = DEC.sel;
  if (!s || s.outil !== 'objets') return null;
  return tousObjets().find((e) => (s.i != null ? e.o.ajout && e.o.i === s.i
    : Math.abs(e.o.x - s.x) < 0.05 && Math.abs(e.o.y - s.y) < 0.05)) || null;
}
function choisirObjet(e) {
  DEC.sel = e ? { outil: 'objets', src: e.src, i: e.o.ajout ? e.o.i : null, x: e.o.x, y: e.o.y } : null;
  majFiche(); peindre();
}

// Un nouvel objet de la palette, posé en (x, y).
function nouvelObjet(choix, x, y) {
  const i = prochainI(), alea = Math.random;
  if (choix === 'mix-feuillus' || choix === 'mix-sapins' || NOMS_PROP[choix]) {
    let id = choix;
    if (choix === 'mix-feuillus') id = alea() < 0.5 ? 'tree' : 'tree2';
    if (choix === 'mix-sapins') id = alea() < 0.5 ? 'pine' : 'pine2';
    const rec = { k: 'prop', id, x: r2(x), y: r2(y), e: r2(0.8 + alea() * 0.4), i };
    if (id === 'pine' || id === 'pine2') rec.v = Math.floor(alea() * 4);
    return rec;
  }
  if (choix === 'tas') return { k: 'tas', x: r2(x), y: r2(y), a: 0, n: 4, i };
  if (VEHICULES[choix]) {
    const v = VEHICULES[choix];
    return { k: 'vehicule', kind: choix, l: v.l, w: v.w, col: 0, rem: 0, x: r2(x), y: r2(y), a: 0, teinte: 0.5, i };
  }
  if (choix === 'hangar') return { k: 'bati', type: 'hangar', x: r2(x), y: r2(y), a: 0, l: 30, w: 20, side: 1, portes: 3,
    teinte: 0.4, architecture: DEC.track.def.architecture, height: 6, i };
  if (choix === 'tribune') return { k: 'bati', type: 'tribune', x: r2(x), y: r2(y), a: 0, l: 28, w: 16, side: 1, toit: true, gradins: 6, i };
  return null;
}

function gommer(x, y) {
  const R = DEC.gomme;
  let n = 0;
  for (const e of tousObjets()) {
    // La marque est sur l'objet : `tousObjets` refait ses enveloppes à chaque appel, et marquer
    // l'enveloppe laissait la gomme retirer le même arbre à chaque mouvement du pointeur.
    if (e.src === 'bati' || e.o._gomme) continue;
    if (Math.hypot(e.o.x - x, e.o.y - y) > R) continue;
    supprimerObjet(e); e.o._gomme = true; n++;
  }
  return n;
}

/* ------------------------------------------------- hors-piste */

function zonesHP() { return DEC.decor.runoffs || (DEC.decor.runoffs = []); }
function pointsZone(z) { return z.points || runoffProfil(z); }
// Une zone déclarée par secteur devient une liste de points dès qu'on la retouche.
function enPoints(z) {
  if (!z.points) { z.points = runoffProfil(z).map(([f, w]) => [r4(f), r2(w)]); delete z.from; delete z.to; delete z.w; }
  return z.points;
}
function posZone(z, f, w) {
  const T = DEC.track, s = T.wrap(f * T.length);
  return T.pos(s, z.side * (bord(s, z.side) + w));
}
function fwDepuis(z, x, y, ref, pres) {
  const T = DEC.track, pr = projette(x, y, pres);
  const f = r4(deplie(pr.s / T.length, ref));
  return [f, r2(Math.max(0, z.side * pr.lat - bord(pr.s, z.side)))];
}
function padsListe() { return DEC.decor.asphaltPads || (DEC.decor.asphaltPads = []); }

/* ------------------------------------------------- barrières */

function traits() { return DEC.decor.barrierPaths || (DEC.decor.barrierPaths = []); }
function coupes() { return DEC.decor.barrierCuts || (DEC.decor.barrierCuts = []); }
// Le côté et le secteur d'un trait, relus de sa position ; dessiné à rebours, il est retourné.
function recaleTrait(p) {
  const T = DEC.track;
  let pr = projette(p.pts[0][0], p.pts[0][1]);
  const lats = [], fs = [];
  let s = pr.s;
  for (const [x, y] of p.pts) { pr = projette(x, y, s); s = pr.s; lats.push(pr.lat); fs.push(pr.s / T.length); }
  if (T.wrap((fs.at(-1) - fs[0]) * T.length) > T.length / 2) { p.pts.reverse(); fs.reverse(); lats.reverse(); }
  const tri = lats.slice().sort((a, b) => a - b);
  p.side = tri[tri.length >> 1] >= 0 ? 1 : -1;
  p.from = r4(fs[0]); p.to = r4(fs.at(-1));
}

/* Élargissements de chaussée, indépendants des trajectoires et dégagements. */
function largeursPiste() { return DEC.decor.roadWidenings || (DEC.decor.roadWidenings = []); }
function normaliseLargeur(z) {
  const shift = Math.floor(z.points[0][0]);
  for (const p of z.points) p[0] -= shift;
}
/* LES POINTS DES BORDS SE POSENT SUR L'AXE D'ORIGINE, pas sur celui que leurs contours refont.

Un contour suivi redessine la chaussée, et `Track` fait passer l'axe entre les deux bords. Converti
sur ce nouvel axe, un point déplacé déplacerait l'axe, qui le déplacerait à son tour : la poignée
fuirait sous la souris. `axeBase` est l'axe d'avant les contours ; un circuit d'éditeur, qui n'en a
pas, garde le sien. Un point de contour peut passer de l'autre côté de cet axe, jusqu'à 60 m. */
const axeDe = (t) => t.axeBase || t;
const ECART_CONTOUR = [-60 / ECHELLE_ROUTE, 60 / ECHELLE_ROUTE];
function projetteAxe(t, x, y, pres) {
  const a = axeDe(t);
  return pres == null ? a.project(x, y, 0, Math.ceil(a.n / 2) + 1) : a.project(x, y, pres, 220);
}
function pointLargeur(z, i) {
  const [f,w]=z.points[i], drag=DEC.drag;
  if(drag?.pointLargeur && largeursPiste()[drag.pointLargeur.zone]===z){
    const base=axeDe(drag.baseLargeur),at=base.wrap(f*base.length),hw=z.side>0?base.hwLeftAt(at):base.hwRightAt(at);
    return base.pos(at,z.side*(base===drag.baseLargeur?Math.max(2.5,hw+w*ECHELLE_ROUTE):hw+w*ECHELLE_ROUTE));
  }
  const t=axeDe(DEC.track),at=t.wrap(f*t.length);
  return DEC.track.roadEdgeControls?.get(z)?.[i] || t.pos(at,z.side*(z.side>0?t.hwLeftAt(at):t.hwRightAt(at)));
}
function ajouterLargeur(pr, deuxCotes = false) {
  const L = axeDe(DEC.track).length, f = pr.s / L, d = 40 / L;
  const z = {side: pr.lat >= 0 ? 1 : -1, points: [[f-d,0],[f-d/2,3/ECHELLE_ROUTE],[f+d/2,3/ECHELLE_ROUTE],[f+d,0]]};
  normaliseLargeur(z);
  changer(() => { largeursPiste().push(z); if(deuxCotes)largeursPiste().push({...clone(z),side:-z.side}); });
  DEC.sel = {outil:'piste', zone:largeursPiste().length-1}; DEC.mode='choisir';
  majFiche(); peindre();
}

/* ------------------------------------------------- zones d'implantation */

/* ------------------------------------------------- trajectoires

LES TRAJECTOIRES SE REPRENNENT ICI, SUR LA PISTE RETOUCHÉE. Elles avaient leur outil à part
(`lignes.html`), qui construisait le circuit du fichier sans la reprise du décor : un virage redessiné
ici y gardait son ancien tracé, et l'on ne pouvait pas reprendre la route et ses lignes d'un coup.
Ce sont les mêmes données — trois listes de points de contrôle, en unités de `pts`, que `Track`
projette sur l'axe — enregistrées au même endroit (la base `lines`, que le jeu et `lignes.html`
relisent) et reportées dans `js/tracks.js` avec le décor. Un point tous les vingt mètres, comme
dans `lignes.html` : à moins, la courbe coupe les épingles. */
const NOMS_LIGNE = { racing: 'Corde', inside: 'Intérieure', outside: 'Extérieure' };
const COUL_LIGNE = { racing: '#ffffff', inside: '#ff7ad9', outside: '#8ef58e' };
const arrondiLigne = (l) => l && Object.fromEntries(['racing', 'inside', 'outside'].map((nom) => [nom, (l[nom] || []).map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000])]));
// les trajectoires que le jeu calculerait sur la piste retouchée, en points de contrôle
function lignesDuCalcul(nom) {
  const d = { ...avecDecor(DEC.def0, DEC.decor) };
  delete d.lines;
  const T = new Track(d, ECHELLE_ROUTE), u = T.unitScale, n = Math.max(48, Math.round(T.n * T.ds / 20 / 4) * 4);
  const pts = (k) => Array.from({ length: n }, (_, i) => {
    const j = Math.round(i * T.n / n) % T.n, lat = T.tracees[k][j];
    return [(T.xs[j] + T.nx[j] * lat) / u, (T.ys[j] + T.ny[j] * lat) / u];
  });
  return nom ? pts(nom) : { racing: pts('racing'), inside: pts('inside'), outside: pts('outside') };
}
// les points affichés : ceux qu'on a, sinon ceux du calcul (posés au premier geste)
function pointsLigne(nom) {
  if (DEC.lignes) return DEC.lignes[nom];
  if (!DEC.calculLignes) DEC.calculLignes = lignesDuCalcul();
  return DEC.calculLignes[nom];
}
function poserLignes() { if (!DEC.lignes) DEC.lignes = clone(DEC.calculLignes || lignesDuCalcul()); }
const enMonde = ([x, y]) => ({ x: x * DEC.track.unitScale, y: y * DEC.track.unitScale });

/* ------------------------------------------------- panneaux et mesure

Repris de `lignes.html`, sur la piste retouchée : un virage redessiné y gardait son ancien tracé, et
un panneau posé là-bas tombait à côté de celui que le jeu peint. Les données ne changent pas — une
liste `[fraction de tour, distance annoncée, note, sens]`, rangée dans la base `panneaux` que le jeu
relit, reportée dans `js/tracks.js` sous `panneaux`. Tant qu'on n'y a pas touché, le jeu les
calcule ; la première retouche fige la liste, et le calcul ne la reprend plus. */
const CHIFFRES_P = [1, 2, 3, 4, 5, 6];
const NOMMES_P = ['square', 'hairpin', 'acute', 'chicane'];
const DISTANCES_P = [200, 100, 50, 0];
const PAN_TAILLE = 28;
const noteDe = (b) => (b.kind && b.kind !== 'normal' ? b.kind : b.grade);
// une entrée de liste, du fichier (tableau court ou objet nommé) vers l'éditeur
const versPanneau = (p) => (Array.isArray(p)
  ? { at: +p[0], dist: +p[1], note: p[2], sign: +p[3] }
  : { at: +p.at, dist: +p.dist, note: p.note != null ? p.note : (p.kind && p.kind !== 'normal' ? p.kind : p.grade), sign: +p.sign });
const panneauxPlats = () => (DEC.panneaux || []).map((p) => [r4(p.at), p.dist, p.note, p.sign]);
// la liste affichée : la reprise, sinon ce que le jeu calcule sur la piste retouchée
function listePanneaux() {
  if (DEC.panModif && DEC.panneaux) return DEC.panneaux;
  return DEC.track.boards.map((b) => ({ at: b.at, dist: b.dist, note: noteDe(b), sign: b.sign }));
}
function poserPanneaux() { if (!DEC.panModif) { DEC.panneaux = clone(listePanneaux()); DEC.panModif = true; } }
function panneauxDuCalcul() {
  const d = definition(); delete d.panneaux;
  return new Track(d, ECHELLE_ROUTE).boards.map((b) => ({ at: b.at, dist: b.dist, note: noteDe(b), sign: b.sign }));
}
// où chaque panneau se peint, par le code du jeu — dans l'ordre de la liste
const panneauxPoses = () => DEC.track._panneauxPoses(listePanneaux().map((p) => [p.at, p.dist, p.note, p.sign]));
const stationDe = (x, y) => DEC.track.idx(projette(x, y).s);

/* L'annonce contre la réalité : la distance signée entre le panneau et l'entrée de virage la plus
   proche, devant ou derrière (voir `verifPanneau` dans `js/lignes.js`). Négative, le panneau est
   posé dans le virage qu'il annonce. */
function verifPanneau(b) {
  const T = DEC.track;
  if (!T.zonesVirages) return '';
  const zones = T.zonesVirages(30, true);
  if (!zones.length) return '';
  const j = Math.round(b.at * T.n);
  let best = Infinity;
  for (const z of zones) {
    let d = ((((z.from % T.n) + T.n) % T.n - j) % T.n + T.n) % T.n;
    if (d > T.n / 2) d -= T.n;
    if (Math.abs(d) < Math.abs(best)) best = d;
  }
  const reel = best * T.ds;
  if (reel < 0) { const dedans = `posé ${(-reel).toFixed(0)} m DANS le virage`; return b.dist > 0 ? `annoncé ${b.dist} m · ${dedans}` : `sans chiffre · ${dedans}`; }
  if (!(b.dist > 0)) return `sans chiffre · virage à ${reel.toFixed(0)} m`;
  const ecart = reel - b.dist;
  return `annoncé ${b.dist} m · réel ${reel.toFixed(0)} m (${ecart >= 0 ? '+' : '−'}${Math.abs(ecart).toFixed(0)})`;
}

// Un panneau dessiné par le code du jeu (`Renderer.paceArrow`), en pixels d'écran pour rester visible.
function dessinerPanneau(g, b, choisi) {
  const e = versEcran(b.cx, b.cy), W = PAN_TAILLE, H = W * 1.23, spec = Renderer.ARROWS[noteDe(b)] || Renderer.ARROWS[3];
  g.save();
  g.translate(e.x, e.y); g.rotate(b.th + Math.PI / 2);
  g.beginPath();
  if (g.roundRect) g.roundRect(-W / 2, -H / 2, W, H, 3.5); else g.rect(-W / 2, -H / 2, W, H);
  g.fillStyle = '#f2f2ee'; g.fill();
  g.lineWidth = choisi ? 3 : 1.4; g.strokeStyle = choisi ? '#7ed321' : '#11141c'; g.stroke();
  const chiffre = b.dist > 0;
  Renderer.paceArrow(g, { x: 0, y: H * (chiffre ? -0.24 : -0.06), w: W * 0.78, h: H * (chiffre ? 0.40 : 0.52) },
    spec, b.sign > 0 ? 1 : -1, { col: '#2a2d36', epais: 0.78 });
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (chiffre) { g.fillStyle = '#11141c'; g.font = `bold ${Math.round(W * 0.31)}px "Trebuchet MS", sans-serif`; g.fillText(String(b.dist), 0, H * 0.30); }
  if (spec.tag) { g.fillStyle = '#2a2d36'; g.font = `bold ${Math.round(W * 0.19)}px "Trebuchet MS", sans-serif`; g.fillText(spec.tag, 0, H * (chiffre ? 0.06 : 0.33)); }
  g.restore();
}

/* La règle : le long du tour (ce qu'un panneau annonce et ce qu'une voiture parcourt) et à vol
   d'oiseau (ce que l'œil croit lire). Elle reste dessinée, en plus discret, dans les autres onglets :
   on mesure POUR placer un panneau. */
function dessinerMesure(g) {
  const T = DEC.track, m = DEC.mesure;
  if (!m.length) return;
  const actif = DEC.outil === 'mesure', pt = (j) => versEcran(T.xs[((j % T.n) + T.n) % T.n], T.ys[((j % T.n) + T.n) % T.n]);
  g.save(); g.globalAlpha = actif ? 1 : 0.45;
  if (m.length === 2) {
    const [a, b] = m, n = ((b - a) % T.n + T.n) % T.n;
    g.strokeStyle = '#ff9f1c'; g.lineWidth = actif ? 4 : 2.5; g.lineCap = 'round';
    g.beginPath(); for (let i = 0; i <= n; i++) { const e = pt(a + i); i ? g.lineTo(e.x, e.y) : g.moveTo(e.x, e.y); } g.stroke();
    const ea = pt(a), eb = pt(b);
    g.setLineDash([5, 5]); g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.beginPath(); g.moveTo(ea.x, ea.y); g.lineTo(eb.x, eb.y); g.stroke(); g.setLineDash([]);
  }
  m.forEach((j, i) => {
    const e = pt(j);
    g.beginPath(); g.arc(e.x, e.y, actif ? 7 : 4, 0, 7); g.fillStyle = '#ff9f1c'; g.fill();
    g.lineWidth = 1.5; g.strokeStyle = '#11141c'; g.stroke();
    if (actif) { g.fillStyle = '#11141c'; g.font = 'bold 10px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(i ? 'B' : 'A', e.x, e.y + 0.5); }
  });
  g.restore();
}
function mesures() {
  const T = DEC.track, [a, b] = DEC.mesure, av = (((b - a) % T.n + T.n) % T.n) * T.ds;
  return { long: av, retour: T.length - av, droit: Math.hypot(T.xs[b] - T.xs[a], T.ys[b] - T.ys[a]) };
}
// le viseur : une croix sur l'axe, à la station visée
function dessinerViseur(g) {
  if (DEC.viseur == null) return;
  const T = DEC.track, j = ((DEC.viseur % T.n) + T.n) % T.n, e = versEcran(T.xs[j], T.ys[j]);
  g.save(); g.strokeStyle = '#7ed321'; g.lineWidth = 2;
  g.beginPath();
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { g.moveTo(e.x + dx * 5, e.y + dy * 5); g.lineTo(e.x + dx * 13, e.y + dy * 13); }
  g.stroke(); g.beginPath(); g.arc(e.x, e.y, 3, 0, 7); g.fillStyle = '#7ed321'; g.fill(); g.restore();
}

function zonesIm() { return DEC.decor.implantation || (DEC.decor.implantation = []); }
/* Le contour d'une zone, pour la voir et la viser : son bord côté piste à l'aller, son bord extérieur
au retour. Sans l'ondulation ni les tronçons de `implContour`, qui servent au dessin du sol et ne
feraient ici que des coutures. Une zone vide se compte depuis l'axe (c'est ainsi qu'elle efface le
semis), une zone de camping-cars n'a pas de profondeur : on lui en prête huit mètres. */
function contours(z) {
  const T = DEC.track, [s0, s1] = implSpan(T, z), dedans = [], dehors = [];
  const n = Math.max(2, Math.ceil((s1 - s0) / 6));
  for (let k = 0; k <= n; k++) {
    const s = T.wrap(s0 + (s1 - s0) * k / n);
    const a = z.kind === 'nu' ? bord(s, z.side) : implBase(T, s, z.side, z);
    const b = z.kind === 'nu' ? Math.max(a + 2, z.prof || 0) : a + (z.prof == null ? 8 : z.prof);
    dedans.push(T.pos(s, z.side * a)); dehors.push(T.pos(s, z.side * b));
  }
  return [dedans.concat(dehors.reverse())];
}
function poignéesZone(z) {
  const T = DEC.track, [s0, s1] = implSpan(T, z), m = (s0 + s1) / 2, prof = z.prof == null ? 8 : z.prof;
  const base = (s) => implBase(T, T.wrap(s), z.side, z);
  return [
    { role: 'debut', p: T.pos(T.wrap(s0), z.side * (base(s0) + prof / 2)) },
    { role: 'fin', p: T.pos(T.wrap(s1), z.side * (base(s1) + prof / 2)) },
    { role: 'prof', p: T.pos(T.wrap(m), z.side * (base(m) + prof)) },
    { role: 'recul', p: T.pos(T.wrap(m), z.side * base(m)) },
  ];
}

/* ------------------------------------------------- stands */

function poignéesStands() {
  const T = DEC.track, p = T.pit;
  if (!p) return [];
  return [['entree', 'E', p.entree], ['boite', 'A', p.boite], ['sortie', 'S', p.sortie]]
    .map(([role, lettre, s]) => ({ role, lettre, s, p: T.pos(s, -(T.hwRightAt(s) + 10)) }));
}

/* ------------------------------------------------- calque : poignées et contours */

function dessinerCalque(g) {
  if (!DEC.track) return;
  const T = DEC.track, E = (x, y) => versEcran(x, y);
  g.save();
  g.lineJoin = 'round'; g.lineCap = 'round';
  const poignee = (p, coul, choisie, lettre) => {
    const q = E(p.x, p.y), r = choisie ? 7 : 5;
    g.beginPath(); g.arc(q.x, q.y, r, 0, Math.PI * 2);
    g.fillStyle = coul; g.fill(); g.lineWidth = 2; g.strokeStyle = '#11151f'; g.stroke();
    if (lettre) { g.fillStyle = '#11151f'; g.font = 'bold 10px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(lettre, q.x, q.y + 0.5); }
  };
  const ligne = (pts, coul, l = 2, tirets) => {
    if (pts.length < 2) return;
    g.beginPath(); pts.forEach((p, i) => { const q = E(p.x, p.y); i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); });
    g.strokeStyle = '#11151f'; g.lineWidth = l + 2.5; g.setLineDash(tirets || []); g.stroke();
    g.strokeStyle = coul; g.lineWidth = l; g.stroke(); g.setLineDash([]);
  };
  const s = DEC.sel;
  if (DEC.outil === 'panneaux') { panneauxPoses().forEach((b, i) => dessinerPanneau(g, b, i === DEC.selP)); dessinerViseur(g); }
  dessinerMesure(g);
  if (DEC.outil === 'lignes' && T.tracees) {
    // les trois trajectoires telles que le jeu les jouera, celle qu'on modifie par-dessus
    const trace = (nom) => {
      const lat = T.tracees[nom], pts = [];
      for (let i = 0; i <= T.n; i += 2) { const j = i % T.n; pts.push({ x: T.xs[j] + T.nx[j] * lat[j], y: T.ys[j] + T.ny[j] * lat[j] }); }
      return pts;
    };
    for (const nom of ['inside', 'outside', 'racing']) if (nom !== DEC.ligne) ligne(trace(nom), COUL_LIGNE[nom], 1.5);
    ligne(trace(DEC.ligne), COUL_LIGNE[DEC.ligne], 3);
    const pts = pointsLigne(DEC.ligne).map(enMonde);
    if (DEC.drag && DEC.drag.pointLigne) ligne([...pts, pts[0]], COUL_LIGNE[DEC.ligne], 1, [4, 4]);
    pts.forEach((p, i) => poignee(p, COUL_LIGNE[DEC.ligne], s && s.point === i));
  }
  if (DEC.outil === 'piste') largeursPiste().forEach((z,i) => {
    const pts=z.points.map((_,j)=>pointLargeur(z,j));
    const curve=z.followContour?Track.roadCurve(pts,z.points.map(p=>p[0]),z.smoothContour!==false):pts;
    ligne(curve,DEC.track.roadEdgeInvalid?.has(z)?'#ff7777':s?.zone===i?'#ffdf60':'#55caff',3);
    pts.forEach((p,j)=>poignee(p,'#ffdf60',s?.zone===i,j===0?'D':j===pts.length-1?'F':''));
  });
  if (DEC.outil === 'objets') {
    const e = retrouveSel();
    if (e) {
      const p = empreinte(e);
      g.strokeStyle = '#ffd400'; g.lineWidth = 2.5;
      if (p) { g.beginPath(); p.forEach(([x, y], i) => { const q = E(x, y); i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); }); g.closePath(); g.stroke(); }
      else { const q = E(e.o.x, e.o.y); g.beginPath(); g.arc(q.x, q.y, rayonProp(e.o) * DEC.rendu.cam.zoom + 3, 0, Math.PI * 2); g.stroke(); }
    }
    if ((DEC.mode === 'gomme' || DEC.mode === 'ajouter') && DEC.survol) {
      const q = E(DEC.survol.x, DEC.survol.y);
      g.beginPath(); g.arc(q.x, q.y, DEC.mode === 'gomme' ? DEC.gomme * DEC.rendu.cam.zoom : 6, 0, Math.PI * 2);
      g.strokeStyle = DEC.mode === 'gomme' ? '#ff5a4f' : '#7fd36b'; g.lineWidth = 2; g.stroke();
    }
  }
  if (DEC.outil === 'horspiste') {
    zonesHP().forEach((z, zi) => {
      const pts = pointsZone(z).map(([f, w]) => posZone(z, f, w)), choisie = s && s.zone === zi;
      ligne(pts, COUL_SURF[z.surface] || '#fff', choisie ? 3 : 1.5, choisie ? [] : [6, 5]);
      if (choisie) pts.forEach((p, i) => poignee(p, COUL_SURF[z.surface] || '#fff', s.point === i));
    });
    padsListe().forEach((pad, pi) => {
      const pts = pad.pts.map(([x, y]) => ({ x, y })), choisie = s && s.pad === pi;
      ligne(pts.concat([pts[0]]), COUL_SURF[pad.surface || 'asphalt'], choisie ? 3 : 1.5, choisie ? [] : [3, 4]);
      if (choisie) pts.forEach((p, i) => poignee(p, '#ffffff', s.point === i));
    });
  }
  if (DEC.outil === 'barrieres') {
    traits().forEach((p, ti) => {
      const pts = p.pts.map(([x, y]) => ({ x, y })), choisi = s && s.trait === ti;
      ligne(pts, '#ff9df0', choisi ? 3 : 2, choisi ? [] : [5, 4]);
      if (choisi) pts.forEach((q, i) => poignee(q, '#ff9df0', s.point === i));
    });
    for (const [x, y, r] of coupes()) {
      const q = E(x, y), rr = Math.max(6, r * DEC.rendu.cam.zoom);
      g.beginPath(); g.arc(q.x, q.y, rr, 0, Math.PI * 2); g.strokeStyle = '#ff5a4f'; g.lineWidth = 2; g.stroke();
      g.beginPath(); g.moveTo(q.x - rr * 0.6, q.y - rr * 0.6); g.lineTo(q.x + rr * 0.6, q.y + rr * 0.6);
      g.moveTo(q.x + rr * 0.6, q.y - rr * 0.6); g.lineTo(q.x - rr * 0.6, q.y + rr * 0.6); g.stroke();
    }
  }
  if (DEC.outil === 'zones') {
    zonesIm().forEach((z, zi) => {
      const choisie = s && s.zone === zi, coul = COUL_ZONE[z.kind] || '#fff';
      g.globalAlpha = choisie ? 1 : 0.55;
      for (const poly of contours(z)) ligne(poly.concat([poly[0]]), coul, choisie ? 2.5 : 1.2, choisie ? [] : [4, 4]);
      g.globalAlpha = 1;
      if (choisie) for (const h of poignéesZone(z)) poignee(h.p, coul, false, { debut: 'D', fin: 'F', prof: 'P', recul: 'R' }[h.role]);
    });
  }
  if (DEC.outil === 'stands') for (const h of poignéesStands()) poignee(h.p, '#ffd400', s && s.role === h.role, h.lettre);
  // le tracé en cours
  if (DEC.trace) {
    const t = DEC.trace, pts = t.pts.map(([x, y]) => ({ x, y }));
    if (DEC.survol && t.type !== 'zone') pts.push(DEC.survol);
    ligne(pts, '#ffd400', 2.5, [7, 5]);
    for (const p of t.pts) poignee({ x: p[0], y: p[1] }, '#ffd400', false);
  }
  g.restore();
}

/* ------------------------------------------------- pointeur */

function poignéeSous(px, py) {
  const T = DEC.track, R = rayonDoigt(), s = DEC.sel;
  const pres = (p) => { const q = versEcran(p.x, p.y); return Math.hypot(q.x - px, q.y - py) <= R; };
  if (DEC.outil === 'panneaux') {
    let best = (PAN_TAILLE * 0.75) ** 2, k = -1;
    panneauxPoses().forEach((b, i) => { const q = versEcran(b.cx, b.cy), d = (q.x - px) ** 2 + (q.y - py) ** 2; if (d < best) { best = d; k = i; } });
    if (k >= 0) return { panneau: k };
  }
  if (DEC.outil === 'lignes') {
    const i = pointsLigne(DEC.ligne).findIndex((q) => pres(enMonde(q)));
    if (i >= 0) return { ligne: DEC.ligne, point: i };
  }
  if(DEC.outil==='piste'){
    const order=largeursPiste().map((z,i)=>i).sort((a,b)=>(b===s?.zone)-(a===s?.zone));
    for(const zi of order){const z=largeursPiste()[zi],i=z.points.findIndex((_,j)=>pres(pointLargeur(z,j)));if(i>=0)return {largeur:zi,point:i};}
  }
  if (DEC.outil === 'horspiste') {
    if (s && s.zone != null) { const z = zonesHP()[s.zone]; if (z) { const i = pointsZone(z).findIndex(([f, w]) => pres(posZone(z, f, w))); if (i >= 0) return { zone: s.zone, point: i }; } }
    if (s && s.pad != null) { const pad = padsListe()[s.pad]; if (pad) { const i = pad.pts.findIndex(([x, y]) => pres({ x, y })); if (i >= 0) return { pad: s.pad, point: i }; } }
  }
  if (DEC.outil === 'barrieres' && s && s.trait != null) {
    const p = traits()[s.trait]; if (p) { const i = p.pts.findIndex(([x, y]) => pres({ x, y })); if (i >= 0) return { trait: s.trait, point: i }; }
  }
  if (DEC.outil === 'zones' && s && s.zone != null) {
    const z = zonesIm()[s.zone]; if (z) { const h = poignéesZone(z).find((h) => pres(h.p)); if (h) return { zone: s.zone, role: h.role }; }
  }
  if (DEC.outil === 'stands') { const h = poignéesStands().find((h) => pres(h.p)); if (h) return { role: h.role }; }
  void T;
  return null;
}
// Distance écran d'un point à une polyligne du monde.
function distPoly(px, py, pts, ferme) {
  let best = Infinity;
  const n = pts.length;
  for (let i = 0; i < n - (ferme ? 0 : 1); i++) {
    const a = versEcran(pts[i].x, pts[i].y), b = versEcran(pts[(i + 1) % n].x, pts[(i + 1) % n].y);
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l2));
    best = Math.min(best, Math.hypot(px - a.x - dx * t, py - a.y - dy * t));
  }
  return best;
}

function surBas(e) {
  DEC.cv.setPointerCapture(e.pointerId);
  DEC.pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (DEC.pointeurs.size === 2) {                     // deux doigts : zoom et déplacement
    const [a, b] = [...DEC.pointeurs.values()];
    DEC.pince = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: DEC.rendu.cam.zoom, c: versMonde((a.x + b.x) / 2, (a.y + b.y) / 2) };
    DEC.drag = null; return;
  }
  const w = versMonde(e.clientX, e.clientY);
  if (e.button === 1 || e.button === 2 && !poignéeSous(e.clientX, e.clientY) || DEC.espace) { DEC.drag = { pan: [e.clientX, e.clientY, DEC.rendu.cam.x, DEC.rendu.cam.y] }; return; }
  const T = DEC.track, h = poignéeSous(e.clientX, e.clientY);
  const supprPoint = e.altKey || e.button === 2;

  // un tracé en cours prend tous les clics
  if (DEC.trace) {
    const t = DEC.trace;
    if (t.type === 'zone') {
      t.pts.push([r2(w.x), r2(w.y)]);
      if (t.pts.length === 2) finirTrace();
    } else {
      if (e.detail >= 2 && t.pts.length >= (t.type === 'pad' ? 3 : 2)) { finirTrace(); return; }
      t.pts.push([r2(w.x), r2(w.y)]);
    }
    peindre(); majFiche(); return;
  }

  if (DEC.outil === 'panneaux' || DEC.outil === 'mesure') {
    if (DEC.outil === 'panneaux' && h && h.panneau != null) {
      // choisir un panneau ; le glisser le fait courir le long de la piste
      DEC.selP = h.panneau;
      DEC.annule.push(instantane());
      DEC.drag = { panneau: h.panneau, bouge: false };
      majFiche(); peindre(); return;
    }
    // un appui qui ne glisse pas vise ou mesure ; un appui qui glisse déplace la vue
    DEC.drag = { pan: [e.clientX, e.clientY, DEC.rendu.cam.x, DEC.rendu.cam.y], clic: [e.clientX, e.clientY] };
    return;
  }
  if (DEC.outil === 'lignes') {
    const u = T.unitScale;
    if (h && h.point != null) {
      DEC.sel = { outil: 'lignes', point: h.point };
      if (supprPoint) {
        if (pointsLigne(DEC.ligne).length > 12) changer(() => { poserLignes(); DEC.lignes[DEC.ligne].splice(h.point, 1); DEC.sel = null; });
        majFiche(); return;
      }
      DEC.annule.push(instantane());
      poserLignes();
      DEC.drag = { pointLigne: { nom: DEC.ligne, i: h.point } };
      majFiche(); peindre(); return;
    }
    if (e.shiftKey || DEC.mode === 'point') {
      // un point de plus, sur le segment le plus proche de la ligne modifiée
      const pts = pointsLigne(DEC.ligne).map(enMonde);
      let best = 0, bd = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], dx = b.x - a.x, dy = b.y - a.y;
        const t = clamp(((w.x - a.x) * dx + (w.y - a.y) * dy) / ((dx * dx + dy * dy) || 1e-9), 0, 1);
        const d = Math.hypot(w.x - a.x - t * dx, w.y - a.y - t * dy);
        if (d < bd) { bd = d; best = i; }
      }
      changer(() => { poserLignes(); DEC.lignes[DEC.ligne].splice(best + 1, 0, [w.x / u, w.y / u]); DEC.sel = { outil: 'lignes', point: best + 1 }; });
      DEC.mode = 'choisir'; majFiche(); return;
    }
    DEC.sel = null;
    DEC.drag = { pan: [e.clientX, e.clientY, DEC.rendu.cam.x, DEC.rendu.cam.y] };
    majFiche(); peindre(); return;
  }
  if (DEC.outil === 'piste') {
    if(h?.largeur!=null){
      const z=largeursPiste()[h.largeur];DEC.sel={outil:'piste',zone:h.largeur};
      if(supprPoint){if(h.point>0&&h.point<z.points.length-1&&z.points.length>3)changer(()=>z.points.splice(h.point,1));majFiche();return;}
      DEC.annule.push(instantane());
      z.followContour=true;
      const def=definition();
      DEC.drag={pointLargeur:{zone:h.largeur,point:h.point},baseLargeur:new Track({...def,roadWidenings:largeursPiste().filter((_,i)=>i!==h.largeur)},ECHELLE_ROUTE)};
      majFiche();peindre();return;
    }
    if((e.shiftKey||DEC.mode==='point')&&DEC.sel?.outil==='piste'){
      const z=largeursPiste()[DEC.sel.zone],ref=(z.points[0][0]+z.points.at(-1)[0])/2;
      const def=definition(),base=axeDe(new Track({...def,roadWidenings:largeursPiste().filter(other=>other!==z)},ECHELLE_ROUTE));
      const pr=base.project(w.x,w.y,base.wrap(ref*base.length),220),f=deplie(pr.s/base.length,ref);
      const i=z.points.findIndex(p=>p[0]>f);
      if(i>0&&f-z.points[i-1][0]>1e-6&&z.points[i][0]-f>1e-6){
        const at=base.wrap(f*base.length),hw=z.side>0?base.hwLeftAt(at):base.hwRightAt(at);
        const value=clamp((z.side*pr.lat-hw)/ECHELLE_ROUTE,...ECART_CONTOUR);
        changer(()=>{z.followContour=true;z.points.splice(i,0,[f,value]);});
      }
      return;
    }
    const pr=projetteAxe(T,w.x,w.y),LA=axeDe(T).length;
    if (DEC.mode==='ajouter'||DEC.mode==='ajouter-deux') { ajouterLargeur(pr,DEC.mode==='ajouter-deux'); return; }
    const i=largeursPiste().findIndex(z=>{let f=pr.s/LA;if(f<z.points[0][0])f+=1;return f<=z.points.at(-1)[0]&&f>=z.points[0][0]&&(pr.lat>=0?1:-1)===z.side;});
    DEC.sel=i>=0?{outil:'piste',zone:i}:null;
    if(i<0)DEC.drag={pan:[e.clientX,e.clientY,DEC.rendu.cam.x,DEC.rendu.cam.y]};
    majFiche();peindre();return;
  }
  if (DEC.outil === 'objets') {
    if (DEC.mode === 'gomme') { DEC.annule.push(instantane()); DEC.drag = { gomme: true, n: gommer(w.x, w.y) }; return; }
    if (DEC.mode === 'ajouter') {
      const rec = nouvelObjet(DEC.ajout, w.x, w.y);
      if (!rec) return;
      DEC.annule.push(instantane());
      objets().ajouts.push(rec);
      DEC.drag = { seme: true, dernier: w };
      DEC.modif = true; refaire(); return;
    }
    const o = objetSous(w.x, w.y);
    if (!o) { choisirObjet(null); DEC.drag = { pan: [e.clientX, e.clientY, DEC.rendu.cam.x, DEC.rendu.cam.y] }; return; }
    choisirObjet(o);
    DEC.drag = { objet: o, de: w, x0: o.o.x, y0: o.o.y, bouge: false };
    return;
  }
  if (DEC.outil === 'horspiste') {
    if (h && h.zone != null) {
      const z = zonesHP()[h.zone];
      if (supprPoint) { if (pointsZone(z).length > 2) changer(() => enPoints(z).splice(h.point, 1)); return; }
      DEC.annule.push(instantane()); enPoints(z);
      DEC.sel = { outil: 'horspiste', zone: h.zone, point: h.point }; DEC.drag = { pointZone: h }; return;
    }
    if (h && h.pad != null) {
      const pad = padsListe()[h.pad];
      if (supprPoint) { if (pad.pts.length > 3) changer(() => pad.pts.splice(h.point, 1)); return; }
      DEC.annule.push(instantane());
      DEC.sel = { outil: 'horspiste', pad: h.pad, point: h.point }; DEC.drag = { pointPad: h }; return;
    }
    // une zone sous le pointeur ; Maj+clic sur la zone choisie y insère un point
    const R = rayonDoigt();
    const zi = zonesHP().findIndex((z) => distPoly(e.clientX, e.clientY, pointsZone(z).map(([f, ww]) => posZone(z, f, ww))) <= R);
    if (zi >= 0 && e.shiftKey && DEC.sel && DEC.sel.zone === zi) {
      const z = zonesHP()[zi], pts = enPoints(z);
      const fw = fwDepuis(z, w.x, w.y, pts[0][0], T.wrap(pts[0][0] * T.length));
      changer(() => { let k = pts.findIndex((p) => p[0] > fw[0]); if (k < 0) k = pts.length; pts.splice(k, 0, fw); }, true);
      return;
    }
    if (zi >= 0) { DEC.sel = { outil: 'horspiste', zone: zi }; majFiche(); peindre(); return; }
    const pi = padsListe().findIndex((pad) => dansPoly(pad.pts, w.x, w.y));
    if (pi >= 0) { DEC.sel = { outil: 'horspiste', pad: pi }; majFiche(); peindre(); return; }
    DEC.sel = null; majFiche(); DEC.drag = { pan: [e.clientX, e.clientY, DEC.rendu.cam.x, DEC.rendu.cam.y] }; peindre(); return;
  }
  if (DEC.outil === 'barrieres') {
    if (DEC.mode === 'couper') {
      const R = Math.max(3, rayonDoigt() / DEC.rendu.cam.zoom);
      const k = coupes().findIndex(([x, y, r]) => Math.hypot(x - w.x, y - w.y) <= Math.max(r, R));
      changer(() => { if (k >= 0) coupes().splice(k, 1); else coupes().push([r2(w.x), r2(w.y), 3]); });
      return;
    }
    if (h && h.trait != null) {
      const p = traits()[h.trait];
      if (supprPoint) { if (p.pts.length > 2) changer(() => { p.pts.splice(h.point, 1); recaleTrait(p); }); return; }
      DEC.annule.push(instantane());
      DEC.sel = { outil: 'barrieres', trait: h.trait, point: h.point }; DEC.drag = { pointTrait: h }; return;
    }
    const ti = traits().findIndex((p) => distPoly(e.clientX, e.clientY, p.pts.map(([x, y]) => ({ x, y }))) <= rayonDoigt());
    if (ti >= 0 && e.shiftKey && DEC.sel && DEC.sel.trait === ti) {
      const p = traits()[ti];
      let best = 0, bd = Infinity;
      for (let i = 0; i + 1 < p.pts.length; i++) {
        const d = distPoly(e.clientX, e.clientY, [{ x: p.pts[i][0], y: p.pts[i][1] }, { x: p.pts[i + 1][0], y: p.pts[i + 1][1] }]);
        if (d < bd) { bd = d; best = i + 1; }
      }
      changer(() => p.pts.splice(best, 0, [r2(w.x), r2(w.y)]), true);
      return;
    }
    DEC.sel = ti >= 0 ? { outil: 'barrieres', trait: ti } : null;
    majFiche(); peindre();
    if (ti < 0) DEC.drag = { pan: [e.clientX, e.clientY, DEC.rendu.cam.x, DEC.rendu.cam.y] };
    return;
  }
  if (DEC.outil === 'zones') {
    if (h && h.zone != null) { DEC.annule.push(instantane()); DEC.drag = { poigneeZone: h }; return; }
    let zi = -1;
    zonesIm().forEach((z, i) => { if (contours(z).some((poly) => dansPoly(poly.map((p) => [p.x, p.y]), w.x, w.y))) zi = i; });
    DEC.sel = zi >= 0 ? { outil: 'zones', zone: zi } : null;
    majFiche(); peindre();
    if (zi < 0) DEC.drag = { pan: [e.clientX, e.clientY, DEC.rendu.cam.x, DEC.rendu.cam.y] };
    return;
  }
  if (DEC.outil === 'stands') {
    if (h) { DEC.annule.push(instantane()); DEC.sel = { outil: 'stands', role: h.role }; DEC.drag = { stand: h }; return; }
    DEC.drag = { pan: [e.clientX, e.clientY, DEC.rendu.cam.x, DEC.rendu.cam.y] };
  }
}

function surMouvement(e) {
  if (!DEC.actif) return;
  if (DEC.pointeurs.has(e.pointerId)) DEC.pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const w = versMonde(e.clientX, e.clientY);
  DEC.survol = w;
  if (DEC.pince && DEC.pointeurs.size === 2) {
    const [a, b] = [...DEC.pointeurs.values()], r = DEC.rendu, d = Math.hypot(a.x - b.x, a.y - b.y);
    r.cam.zoom = Math.max(DEC.zoomMin || 0.05, Math.min(40, DEC.pince.zoom * d / DEC.pince.d));
    const m = versMonde((a.x + b.x) / 2, (a.y + b.y) / 2);
    r.cam.x += DEC.pince.c.x - m.x; r.cam.y += DEC.pince.c.y - m.y;
    peindre(); return;
  }
  const g = DEC.drag, T = DEC.track;
  if (!g) { if (DEC.trace || DEC.mode === 'gomme' || DEC.mode === 'ajouter') peindre(); return; }
  if (g.pan) {
    const r = DEC.rendu;
    r.cam.x = g.pan[2] - (e.clientX - g.pan[0]) / r.cam.zoom;
    r.cam.y = g.pan[3] - (e.clientY - g.pan[1]) / r.cam.zoom;
    peindre(); return;
  }
  if (g.gomme) { g.n += gommer(w.x, w.y); peindre(); return; }
  if (g.seme) {
    const pas = DEC.ajout.startsWith('mix') || NOMS_PROP[DEC.ajout] ? 4.5 : 1e9;
    if (Math.hypot(w.x - g.dernier.x, w.y - g.dernier.y) >= pas) { objets().ajouts.push(nouvelObjet(DEC.ajout, w.x, w.y)); g.dernier = w; g.n = (g.n || 0) + 1; peindre(); }
    return;
  }
  if (g.objet) { g.bouge = true; g.objet.o.x = g.x0 + w.x - g.de.x; g.objet.o.y = g.y0 + w.y - g.de.y; DEC.rendu.implantation && implIndexe(DEC.rendu.implantation); peindre(); return; }
  if (g.panneau != null) {
    if (!g.bouge) { poserPanneaux(); g.bouge = true; }
    const b = DEC.panneaux[g.panneau], j = T.idx(projette(w.x, w.y, b.at * T.length).s);
    b.at = j / T.n; majFiche(); peindre(); return;
  }
  if (g.pointLigne) {
    const u = T.unitScale;
    DEC.lignes[g.pointLigne.nom][g.pointLigne.i] = [w.x / u, w.y / u];
    peindre(); return;
  }
  if(g.pointLargeur){
    const z=largeursPiste()[g.pointLargeur.zone],i=g.pointLargeur.point,pts=z.points,base=axeDe(g.baseLargeur);
    const pr=base.project(w.x,w.y,base.wrap(pts[i][0]*base.length),220);
    const f=deplie(pr.s/base.length,pts[i][0]);
    const lo=i?pts[i-1][0]+1e-6:pts.at(-1)[0]-.49,hi=i<pts.length-1?pts[i+1][0]-1e-6:pts[0][0]+.49;
    const pos=Math.max(lo,Math.min(hi,f)),at=base.wrap(pos*base.length);
    const hw=z.side>0?base.hwLeftAt(at):base.hwRightAt(at);
    pts[i]=[pos,i===0||i===pts.length-1?0:clamp((z.side*pr.lat-hw)/ECHELLE_ROUTE,...ECART_CONTOUR)];
    peindre();return;
  }
  if (g.pointZone) {
    const z = zonesHP()[g.pointZone.zone], pts = z.points, i = g.pointZone.point;
    const ref = pts[0][0], fw = fwDepuis(z, w.x, w.y, i ? ref : pts[Math.min(1, pts.length - 1)][0], T.wrap(pts[i][0] * T.length));
    const lo = i > 0 ? pts[i - 1][0] + 1e-4 : -Infinity, hi = i < pts.length - 1 ? pts[i + 1][0] - 1e-4 : Infinity;
    pts[i] = [r4(Math.max(lo, Math.min(hi, fw[0]))), fw[1]];
    peindre(); return;
  }
  if (g.pointPad) { padsListe()[g.pointPad.pad].pts[g.pointPad.point] = [r2(w.x), r2(w.y)]; peindre(); return; }
  if (g.pointTrait) { traits()[g.pointTrait.trait].pts[g.pointTrait.point] = [r2(w.x), r2(w.y)]; peindre(); return; }
  if (g.poigneeZone) {
    const z = zonesIm()[g.poigneeZone.zone], role = g.poigneeZone.role, [s0, s1] = implSpan(T, z), m = T.wrap((s0 + s1) / 2);
    if (role === 'debut' || role === 'fin') {
      const pr = projette(w.x, w.y, T.wrap(role === 'debut' ? s0 : s1));
      z[role === 'debut' ? 'from' : 'to'] = r4(T.wrap(pr.s) / T.length);
    } else {
      const pr = projette(w.x, w.y, m), lat = z.side * pr.lat;
      if (role === 'prof') z.prof = Math.round(Math.max(3, lat - implBase(T, m, z.side, z)));
      else z.recul = Math.round(Math.max(0, lat - T.limiteProtection(m, z.side)) * 2) / 2;
    }
    peindre(); return;
  }
  if (g.stand) {
    const d = DEC.decor, p = T.pit, pr = projette(w.x, w.y, g.stand.s), f = r4(T.wrap(pr.s) / T.length);
    if (d.pitFrom == null) d.pitFrom = r4(p.entree / T.length);
    if (d.pitTo == null) d.pitTo = r4(p.sortie / T.length);
    if (d.pitAt == null) d.pitAt = r4(p.boite / T.length);
    d[{ entree: 'pitFrom', boite: 'pitAt', sortie: 'pitTo' }[g.stand.role]] = f;
    g.f = f; peindre(); return;
  }
}

function surHaut(e) {
  DEC.pointeurs.delete(e.pointerId);
  if (DEC.pointeurs.size < 2) DEC.pince = null;
  const g = DEC.drag;
  DEC.drag = null;
  if (g && g.pan && g.clic && Math.abs(e.clientX - g.clic[0]) + Math.abs(e.clientY - g.clic[1]) <= 6) { cliqueSurPiste(versMonde(e.clientX, e.clientY)); return; }
  if (!g || g.pan) return;
  if (g.panneau != null) { if (!g.bouge) DEC.annule.pop(); else { DEC.modif = true; refaire(); } return; }
  if (g.gomme) { if (g.n) { nettoyer(); DEC.modif = true; refaire(); } else DEC.annule.pop(); return; }
  if (g.seme) { DEC.modif = true; refaire(); return; }
  if (g.objet) {
    if (!g.bouge) return;
    const nx = g.objet.o.x, ny = g.objet.o.y;
    g.objet.o.x = g.x0; g.objet.o.y = g.y0;
    changer(() => { const i = modifierObjet(g.objet, { x: r2(nx), y: r2(ny) }); DEC.sel = { outil: 'objets', src: g.objet.src, i }; }, true);
    return;
  }
  if (g.pointLargeur) normaliseLargeur(largeursPiste()[g.pointLargeur.zone]);
  if (g.pointTrait) { recaleTrait(traits()[g.pointTrait.trait]); }
  nettoyer(); DEC.modif = true; refaire();
}

// Un appui sans glisser, dans l'onglet Panneaux : il pose le viseur, ou un bout de la règle.
function cliqueSurPiste(w) {
  const j = stationDe(w.x, w.y);
  if (DEC.outil === 'panneaux') DEC.viseur = j;
  else { if (DEC.mesure.length >= 2) DEC.mesure = []; DEC.mesure.push(j); }
  majFiche(); peindre();
}

function surMolette(e) {
  if (!DEC.actif) return;
  e.preventDefault();
  const r = DEC.rendu, avant = versMonde(e.clientX, e.clientY);
  r.cam.zoom = Math.max(DEC.zoomMin || 0.05, Math.min(40, r.cam.zoom * (e.deltaY < 0 ? 1.18 : 1 / 1.18)));
  const apres = versMonde(e.clientX, e.clientY);
  r.cam.x += avant.x - apres.x; r.cam.y += avant.y - apres.y;
  peindre();
}

/* ------------------------------------------------- tracés */

function commencerTrace(type, extra) {
  DEC.trace = { type, pts: [], ...extra };
  DEC.sel = null;
  majFiche(); peindre();
}
function finirTrace() {
  const t = DEC.trace, T = DEC.track;
  DEC.trace = null;
  if (!t) return;
  if (t.type === 'runoff' && t.pts.length >= 2) {
    const pr0 = projette(t.pts[0][0], t.pts[0][1]), side = pr0.lat >= 0 ? 1 : -1;
    const z = { name: 'Zone ' + (zonesHP().length + 1), surface: t.surface, side, points: [] };
    let s = pr0.s;
    const ref = pr0.s / T.length;
    for (const [x, y] of t.pts) { const fw = fwDepuis(z, x, y, ref, s); s = T.wrap(fw[0] * T.length); z.points.push(fw); }
    if (z.points.at(-1)[0] < z.points[0][0]) z.points.reverse();
    z.points.sort((a, b) => a[0] - b[0]);
    if (z.points[0][1] > 0) z.points.unshift([r4(z.points[0][0] - 0.002), 0]);
    if (z.points.at(-1)[1] > 0) z.points.push([r4(z.points.at(-1)[0] + 0.002), 0]);
    changer(() => zonesHP().push(z));
    DEC.sel = { outil: 'horspiste', zone: zonesHP().length - 1 };
  } else if (t.type === 'pad' && t.pts.length >= 3) {
    const side = projette(t.pts[0][0], t.pts[0][1]).lat >= 0 ? 1 : -1;
    changer(() => padsListe().push({ side, pts: t.pts, ...(t.free ? {free:true, surface:t.surface} : {}) }));
    DEC.sel = { outil: 'horspiste', pad: padsListe().length - 1 };
  } else if (t.type === 'trait' && t.pts.length >= 2) {
    const p = { side: 1, from: 0, to: 0, pts: t.pts };
    recaleTrait(p);
    changer(() => traits().push(p));
    DEC.sel = { outil: 'barrieres', trait: traits().length - 1 };
  } else if (t.type === 'zone' && t.pts.length === 2) {
    const a = projette(t.pts[0][0], t.pts[0][1]);
    const b = projette(t.pts[1][0], t.pts[1][1], a.s);
    let f0 = T.wrap(a.s) / T.length, f1 = T.wrap(b.s) / T.length;
    if (T.wrap((f1 - f0) * T.length) > T.length / 2) [f0, f1] = [f1, f0];
    const z = { kind: t.kind, side: a.lat >= 0 ? 1 : -1, from: r4(f0), to: r4(f1), ...DEFAUTS_ZONE[t.kind] };
    if (t.essence) z.essence = t.essence;
    changer(() => zonesIm().push(z));
    DEC.sel = { outil: 'zones', zone: zonesIm().length - 1 };
  }
  majFiche(); peindre();
}

/* ------------------------------------------------- panneau */

function etatDecor(s) { $d('d-etat').textContent = s; }
const opt = (v, t, sel) => `<option value="${v}" ${sel ? 'selected' : ''}>${t}</option>`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const champ = (label, html) => `<label>${label} ${html}</label>`;
const nombre = (id, v, min, max, pas) => `<input type="number" id="${id}" value="${v == null ? '' : v}" min="${min}" max="${max}" step="${pas}">`;

function majFiche() {
  if (!DEC.actif) return;
  for (const b of document.querySelectorAll('#d-onglets button')) b.classList.toggle('sel', b.dataset.onglet === DEC.onglet);
  $d('d-outils').hidden = DEC.onglet !== 'objets';
  for (const b of document.querySelectorAll('#d-outils button')) b.classList.toggle('sel', b.dataset.outil === DEC.outil);
  const el = $d('d-fiche'), s = DEC.sel;
  let h = '';
  if (DEC.trace) {
    const quoi = { runoff: 'le long du bord de la piste, du début à la fin de la zone', pad: DEC.trace.free ? 'tout le contour du trou à combler (au moins trois points)' : 'le contour de la surface, d’un bord de piste à l’autre',
      trait: 'la barrière, point par point', zone: 'le début puis la fin de la zone, à côté de la piste' }[DEC.trace.type];
    h += `<p class="help">Clique ${quoi}. ${DEC.trace.type === 'zone' ? '' : 'Double-clic ou Entrée pour terminer, '}Échap pour annuler.</p>
      <div class="row2">${DEC.trace.type === 'zone' ? '' : '<button id="d-finir" class="primary">Terminer</button>'}<button id="d-abandon">Annuler le tracé</button></div>`;
  } else if (DEC.outil === 'objets') {
    h += `<div class="tools">${[['choisir', 'Choisir'], ['ajouter', 'Ajouter'], ['gomme', 'Gomme']].map(([m, t]) => `<button data-mode="${m}" class="${DEC.mode === m ? 'sel' : ''}">${t}</button>`).join('')}</div>`;
    if (DEC.mode === 'ajouter') {
      h += champ('Objet', `<select id="d-ajout">
        <optgroup label="Arbres">${opt('mix-feuillus', 'Feuillus (mélange)', DEC.ajout === 'mix-feuillus')}${opt('mix-sapins', 'Sapins (mélange)', DEC.ajout === 'mix-sapins')}${['tree', 'tree2', 'pine', 'pine2', 'bush', 'palm'].map((k) => opt(k, NOMS_PROP[k], DEC.ajout === k)).join('')}</optgroup>
        <optgroup label="Décor">${['rock', 'bales', 'house', 'house2', 'chapel'].map((k) => opt(k, NOMS_PROP[k], DEC.ajout === k)).join('')}${opt('tas', 'Tas de bois', DEC.ajout === 'tas')}</optgroup>
        <optgroup label="Véhicules">${Object.keys(VEHICULES).map((k) => opt(k, NOMS_VEH[k] || k, DEC.ajout === k)).join('')}</optgroup>
        <optgroup label="Bâtiments">${opt('hangar', 'Hangar', DEC.ajout === 'hangar')}${opt('tribune', 'Tribune', DEC.ajout === 'tribune')}</optgroup></select>`);
      h += '<p class="help">Clic : poser. Pour les arbres, glisser sème une rangée.</p>';
    } else if (DEC.mode === 'gomme') {
      h += champ(`Rayon ${DEC.gomme} m`, `<input type="range" id="d-gomme" min="2" max="30" value="${DEC.gomme}">`);
      h += '<p class="help">Glisser efface arbres, rochers, tas de bois et véhicules (pas les bâtiments).</p>';
    } else {
      const e = retrouveSel();
      if (e) h += ficheObjet(e);
      else h += '<p class="help">Clique un objet pour le choisir, glisse-le pour le déplacer, Suppr pour l’effacer. Glisser à côté déplace la vue.</p>';
    }
    const ob = DEC.decor.objets;
    h += `<p class="help">Retouches : ${ob ? ob.retires.length : 0} retiré(s), ${ob ? ob.ajouts.length : 0} ajouté(s).</p>`;
    if (ob) h += '<div class="row2"><button id="d-raz-objets">Effacer les retouches d’objets</button></div>';
  } else if (DEC.outil === 'piste') {
    h += '<div class="tools"><button id="d-largeur-ajout">+ Élargir un côté</button><button id="d-largeur-deux">+ Élargir des deux côtés</button></div><p class="help">Clique le côté de la piste à élargir après avoir choisi une action. Les deux côtés créent deux zones indépendantes : sélectionne gauche ou droite dans la liste pour régler chacune. La chaussée et ses bordures sont recalculées.</p>';
    if(DEC.mode==='ajouter'||DEC.mode==='ajouter-deux')h+='<p class="help">Clique maintenant dans le virage, du côté à élargir.</p>';
    h += `<select id="d-largeur-liste" size="5" style="width:100%">${!s?'<option value="" disabled selected>Choisir une zone</option>':''}${largeursPiste().map((z,i)=>opt(i,`Zone ${i+1} · ${z.side>0?'gauche':'droite'}`,s?.zone===i)).join('')}</select>`;
    const z=s&&largeursPiste()[s.zone];
    if(z){
      const peak=z.points.reduce((a,p)=>Math.abs(p[1])>Math.abs(a)?p[1]:a,0);
      h+=champ('Suivre le contour dessiné',`<input id="d-largeur-contour" type="checkbox" ${z.followContour?'checked':''}>`);
      h+=champ('Courbe lissée',`<input id="d-largeur-lisse" type="checkbox" ${z.smoothContour!==false?'checked':''}>`);
      h+='<button id="d-largeur-point">+ Ajouter un point sur ce bord</button>';
      if(DEC.mode==='point')h+='<p class="help">Clique entre deux points de ce bord, puis glisse le nouveau point.</p>';
      if(DEC.track.roadEdgeInvalid?.has(z))h+=`<p class="help">${esc(DEC.track.roadEdgeInvalid.get(z))}</p>`;
      h+=champ('Côté de cette zone',`<select id="d-largeur-cote">${opt(1,'Gauche',z.side>0)}${opt(-1,'Droite',z.side<0)}</select>`);
      h+=champ('Largeur ajoutée (m)',nombre('d-largeur-m',r2(peak*ECHELLE_ROUTE),-10,30,.5));
      h+=champ('Longueur de zone (m)',nombre('d-largeur-long',r2((z.points.at(-1)[0]-z.points[0][0])*axeDe(DEC.track).length),10,500,5));
      h+='<p class="help">Glisser les points pour redessiner le bord — y compris au-delà du milieu de la piste : le tracé du virage se recentre entre ses deux bords. D/F déplacent le début et la fin. Maj+clic dans la zone sélectionnée ajoute un point ; Alt+clic sur un point intérieur le retire. Les extrémités rejoignent progressivement la piste. Valeur négative : rétrécir. Les mètres correspondent à la chaussée affichée en jeu.</p><button id="d-largeur-oppose">Ajouter aussi le côté opposé</button><button id="d-suppr">Supprimer cet élargissement</button>';
    }
  } else if (DEC.outil === 'panneaux' || DEC.outil === 'mesure') {
    h += `<div class="tools"><button data-souspan="panneaux" class="${DEC.outil === 'panneaux' ? 'sel' : ''}">Panneaux</button><button data-souspan="mesure" class="${DEC.outil === 'mesure' ? 'sel' : ''}">Mesure</button></div>`;
    const T = DEC.track;
    if (DEC.outil === 'mesure') {
      if (DEC.mesure.length === 2) {
        const m = mesures();
        h += `<p class="help"><b>${m.long.toFixed(1)} m</b> le long du tour<br>${m.retour.toFixed(1)} m dans l’autre sens<br>${m.droit.toFixed(1)} m à vol d’oiseau</p><div class="row2"><button id="d-mesure-eff">Effacer</button></div>`;
      } else h += `<p class="help">${DEC.mesure.length ? 'Départ posé : touche l’arrivée.' : 'Touche deux points de la piste : le départ, puis l’arrivée. Un troisième recommence.'}</p>`;
      h += '<p class="help">Le long du tour, c’est ce qu’un panneau annonce et ce qu’une voiture parcourt ; à vol d’oiseau, ce que l’œil croit lire. La règle reste affichée dans les autres onglets.</p>';
    } else {
      const liste = listePanneaux(), b = DEC.selP != null ? liste[DEC.selP] : null;
      h += `<p class="help">${liste.length} panneaux — ${DEC.panModif ? DEC.panOrigine || 'liste reprise.' : 'calculés par le jeu : la première retouche fige la liste.'}</p>`;
      if (b) {
        const noms = b.note === 'chicane' ? { '-1': 'gauche-droite', 1: 'droite-gauche' } : { '-1': 'gauche', 1: 'droite' };
        h += `<h3>Sens du virage</h3><div class="tools">${[-1, 1].map((v) => `<button data-sensp="${v}" class="${(b.sign > 0 ? 1 : -1) === v ? 'sel' : ''}">${v < 0 ? '↰' : '↱'} ${noms[v]}</button>`).join('')}</div>`;
        h += `<h3>Intensité</h3><div class="grille">${CHIFFRES_P.map((n) => `<button data-notep="${n}" class="${String(b.note) === String(n) ? 'sel' : ''}">${n}</button>`).join('')}</div>`;
        h += `<div class="grille" style="grid-template-columns:repeat(4,1fr)">${NOMMES_P.map((n) => `<button data-notep="${n}" class="${b.note === n ? 'sel' : ''}">${Renderer.ARROWS[n].tag}</button>`).join('')}</div>`;
        h += `<h3>Valeur annoncée</h3><div class="grille" style="grid-template-columns:repeat(4,1fr)">${DISTANCES_P.map((d) => `<button data-distp="${d}" class="${b.dist === d ? 'sel' : ''}">${d || '—'}</button>`).join('')}</div>`;
        h += `<p class="help">${esc(verifPanneau(b))}</p>`;
        h += `<h3>Position — ${(b.at * T.length).toFixed(0)} m</h3><div class="grille" style="grid-template-columns:repeat(4,1fr)">${[-10, -1, 1, 10].map((m) => `<button data-pasp="${m}">${m > 0 ? '+' : '−'}${Math.abs(m)} m</button>`).join('')}</div>`;
        h += `<div class="row2">${DEC.viseur != null ? '<button id="d-pan-viseur">Amener au viseur</button>' : ''}<button id="d-pan-suppr" class="danger">Supprimer ce panneau</button></div>`;
      } else h += '<p class="help">Touche un panneau pour le reprendre ; glisse-le pour le faire courir le long de la piste.</p>';
      h += `<h3>Viseur</h3><p class="help">${DEC.viseur == null ? 'Touche la piste sans glisser : le viseur se pose sur la station la plus proche.' : `viseur à ${(DEC.viseur * T.ds).toFixed(0)} m de la ligne`}</p>`;
      h += `<div class="row2"><button id="d-pan-ajout"${DEC.viseur == null ? ' disabled' : ''}>Ajouter au viseur</button><button id="d-pan-calcul">Revenir au calcul</button></div>`;
    }
  } else if (DEC.outil === 'lignes') {
    h += `<div class="tools">${['racing', 'inside', 'outside'].map((nom) => `<button data-ligne="${nom}" class="${DEC.ligne === nom ? 'sel' : ''}"><span style="color:${COUL_LIGNE[nom]}">●</span> ${NOMS_LIGNE[nom]}</button>`).join('')}</div>`;
    h += `<p class="help">${DEC.lignes ? `${pointsLigne(DEC.ligne).length} points. ${DEC.lignesOrigine}` : 'Trajectoires calculées par le jeu : le premier point déplacé les fixe.'}</p>`;
    h += '<div class="tools"><button id="d-ligne-point">+ Ajouter un point</button><button id="d-ligne-calcul">Revenir au calcul</button><button id="d-lignes-calcul">Les trois au calcul</button></div>';
    if (DEC.mode === 'point') h += '<p class="help">Clique près de la ligne : le point se pose sur le segment le plus proche.</p>';
    h += '<p class="help">Glisser un point pour déplacer la trajectoire. Maj+clic : ajouter un point ; Alt+clic ou clic droit sur un point : le retirer. Les trajectoires suivent la piste telle qu’elle est retouchée ici — un virage redessiné dans « Largeur de piste » se reprend aussitôt. « Enregistrer » et « Fabriquer tracks.js » emportent décor et trajectoires ensemble.</p>';
  } else if (DEC.outil === 'horspiste') {
    h += champ('Gravier automatique dans les virages', `<input type="checkbox" id="d-auto" ${DEC.decor.annotatedRunoffsOnly ? '' : 'checked'}>`);
    h += `<div class="tools"><button data-nouv="asphalt">+ Bitume</button><button data-nouv="gravel">+ Gravier</button><button data-nouv="grass">+ Herbe</button><button data-nouv="pad">+ Surface liée au bord</button><button data-fill="asphalt">Combler : bitume</button><button data-fill="gravel">Combler : gravier</button></div>`;
    h += `<select id="d-liste" size="7" style="width:100%">${zonesHP().map((z, i) => opt('z' + i, `${{ asphalt: 'Bitume', gravel: 'Gravier', grass: 'Herbe' }[z.surface] || z.surface} · ${esc(z.name || 'zone')}`, s && s.zone === i)).join('')}
      ${padsListe().map((p, i) => opt('p' + i, `${p.free ? 'Comblement' : 'Surface'} ${p.surface === 'gravel' ? 'gravier' : 'bitume'} ${i + 1}`, s && s.pad === i)).join('')}</select>`;
    if (s && s.zone != null && zonesHP()[s.zone]) {
      const z = zonesHP()[s.zone];
      h += champ('Nom', `<input type="text" id="d-nom" value="${esc(z.name || '')}">`);
      h += champ('Matière', `<select id="d-surface">${opt('asphalt', 'Bitume', z.surface === 'asphalt')}${opt('gravel', 'Gravier', z.surface === 'gravel')}${opt('grass', 'Herbe (efface le gravier)', z.surface === 'grass')}</select>`);
      h += `<p class="help">Côté ${z.side > 0 ? 'gauche' : 'droit'} · ${pointsZone(z).length} points. Glisser un point ; Maj+clic sur la zone : insérer ; Alt+clic ou clic droit : retirer.</p>`;
      h += '<div class="row2"><button id="d-suppr" class="danger">Supprimer la zone</button></div>';
    } else if (s && s.pad != null && padsListe()[s.pad]) {
      h += champ('Matière', `<select id="d-pad-surface">${opt('asphalt', 'Bitume', padsListe()[s.pad].surface !== 'gravel')}${opt('gravel', 'Gravier', padsListe()[s.pad].surface === 'gravel')}</select>`);
      h += '<p class="help">Contour fermé : glisser un point ; Alt+clic : retirer.</p><div class="row2"><button id="d-suppr" class="danger">Supprimer la surface</button></div>';
    } else h += '<p class="help">Les zones dessinées priment sur le gravier automatique. Une zone d’herbe efface le gravier sur son secteur.</p>';
  } else if (DEC.outil === 'barrieres') {
    h += `<div class="tools">${[['choisir', 'Choisir'], ['tracer', 'Tracer'], ['couper', 'Couper']].map(([m, t]) => `<button data-mode="${m}" class="${DEC.mode === m ? 'sel' : ''}">${t}</button>`).join('')}</div>`;
    if (DEC.mode === 'couper') h += '<p class="help">Clic sur une barrière : en couper trois mètres. Clic sur une coupe : la retirer.</p>';
    else h += '<p class="help">Un trait tracé devient la barrière elle-même, raccordé aux barrières calculées à ses deux bouts.</p>';
    h += `<select id="d-liste" size="5" style="width:100%">${traits().map((p, i) => opt('t' + i, `Trait ${i + 1} · côté ${p.side > 0 ? 'gauche' : 'droit'} · ${p.pts.length} pts`, s && s.trait === i)).join('')}</select>`;
    if (s && s.trait != null && traits()[s.trait]) h += '<p class="help">Glisser un point ; Maj+clic : insérer ; Alt+clic : retirer.</p><div class="row2"><button id="d-suppr" class="danger">Supprimer le trait</button></div>';
    h += `<p class="help">${coupes().length} coupe(s).</p>${coupes().length ? '<div class="row2"><button id="d-raz-coupes">Retirer les coupes</button></div>' : ''}`;
  } else if (DEC.outil === 'zones') {
    h += `<div class="tools">${Object.keys(NOMS_ZONE).map((k) => `<button data-zone="${k}">+ ${NOMS_ZONE[k].split(' ')[0]}</button>`).join('')}<button data-zone="bois" data-essence="pinede">+ Pinède</button></div>`;
    h += `<select id="d-liste" size="7" style="width:100%">${zonesIm().map((z, i) => opt('i' + i, `${NOMS_ZONE[z.kind] || z.kind}${z.essence ? ' (' + z.essence + ')' : ''} · ${z.side > 0 ? 'G' : 'D'} · ${z.from}→${z.to}`, s && s.zone === i)).join('')}</select>`;
    if (s && s.zone != null && zonesIm()[s.zone]) {
      const z = zonesIm()[s.zone];
      h += champ('Type', `<select id="z-kind">${Object.keys(NOMS_ZONE).map((k) => opt(k, NOMS_ZONE[k], z.kind === k)).join('')}</select>`);
      h += champ('Côté', `<select id="z-side">${opt('1', 'Gauche', z.side > 0)}${opt('-1', 'Droit', z.side < 0)}</select>`);
      h += champ('Début (fraction)', nombre('z-from', z.from, 0, 1, 0.001)) + champ('Fin (fraction)', nombre('z-to', z.to, 0, 1, 0.001));
      if (z.kind !== 'nu') h += champ('Recul (m)', nombre('z-recul', z.recul, 0, 100, 0.5));
      if (z.kind !== 'camping') h += champ('Profondeur (m)', nombre('z-prof', z.prof, 3, 400, 1));
      if (['tribune', 'stands', 'hangars'].includes(z.kind)) h += champ('Module (m)', nombre('z-module', z.module, 8, 80, 1));
      if (z.kind === 'bois') {
        h += champ('Essence', `<select id="z-essence">${['bois', 'pinede', 'taillis'].map((k) => opt(k, k, (z.essence || 'bois') === k)).join('')}</select>`);
        h += champ('Densité', nombre('z-densite', z.densite == null ? 1 : z.densite, 0.1, 2, 0.1));
      }
      if (z.kind === 'camping') h += champ('Véhicules au plus', nombre('z-max', z.max == null ? 2 : z.max, 0, 10, 1));
      h += '<p class="help">Poignées D/F : début et fin ; P : profondeur ; R : recul depuis la barrière.</p><div class="row2"><button id="d-suppr" class="danger">Supprimer la zone</button></div>';
    } else h += '<p class="help">Clique dans une zone pour la choisir. Pour en créer une : un bouton +, puis son début et sa fin à côté de la piste.</p>';
  } else if (DEC.outil === 'stands') {
    const p = DEC.track && DEC.track.pit, L = DEC.track ? DEC.track.length : 1;
    h += '<p class="help">Glisser E (entrée), A (zone d’arrêt) et S (sortie) le long du bord droit de la piste.</p>';
    if (p) h += `<p class="help">Entrée ${r4(p.entree / L)} · arrêt ${r4(p.boite / L)} · sortie ${r4(p.sortie / L)} · ${Math.round(p.long)} m</p>`;
    h += '<div class="row2"><button id="d-pit-auto">Placement automatique</button></div>';
  }
  el.innerHTML = h;
  brancherFiche();
  $d('d-oublier').disabled = !DEC.local && !DEC.modif;
  const perimees = DEC.perimees && DEC.perimees.length ? ` (retouches de ce poste plus anciennes que le fichier, ignorées : ${DEC.perimees.join(', ')} — « Revenir au fichier » les efface)` : '';
  const fraiche = DEC.local && !(DEC.perimees && DEC.perimees.length && DEC.perimees.length === 3);
  etatDecor(`${DEC.def0 ? DEC.def0.name : ''} — ${DEC.modif ? 'modifié, non enregistré' : fraiche && !perimees ? 'retouche enregistrée sur ce poste' : 'tel que le fichier'}${perimees}`);
}

function ficheObjet(e) {
  const o = e.o;
  let h = `<p class="help"><b>${{ prop: 'Semis', arbre: 'Arbre de bois', tas: 'Tas de bois', vehicule: 'Véhicule', bati: 'Bâtiment' }[e.src]}</b>${o.ajout ? ' · ajouté' : ''} · x ${o.x.toFixed(1)}, y ${o.y.toFixed(1)}</p>`;
  if (e.src === 'prop' || e.src === 'arbre') {
    h += champ('Type', `<select id="o-id">${Object.keys(NOMS_PROP).map((k) => opt(k, NOMS_PROP[k], o.id === k)).join('')}</select>`);
    h += champ(`Taille ×${(o.e || 1).toFixed(2)}`, `<input type="range" id="o-e" min="0.3" max="2.2" step="0.05" value="${o.e || 1}">`);
    if (o.id === 'pine' || o.id === 'pine2') h += champ('Teinte', `<select id="o-v">${[0, 1, 2, 3].map((v) => opt(v, 'Teinte ' + (v + 1), (o.v || 0) === v)).join('')}</select>`);
  }
  if (e.src === 'vehicule') {
    h += champ('Gabarit', `<select id="o-kind">${Object.keys(VEHICULES).map((k) => opt(k, NOMS_VEH[k] || k, o.kind === k)).join('')}</select>`);
    const v = VEHICULES[o.kind];
    if (v) h += champ('Couleur', `<select id="o-col">${v.teintes.map((c, i) => `<option value="${i}" ${o.col === i ? 'selected' : ''} style="background:${c}">${c}</option>`).join('')}</select>`);
  }
  if (e.src === 'vehicule' || e.src === 'bati' || e.src === 'tas')
    h += champ(`Angle ${Math.round(((o.a || 0) * 180 / Math.PI % 360 + 360) % 360)}°`, `<input type="range" id="o-a" min="0" max="360" step="5" value="${Math.round(((o.a || 0) * 180 / Math.PI % 360 + 360) % 360)}">`);
  if (e.src === 'bati') h += champ('Longueur (m)', nombre('o-l', Math.round(o.l), 4, 120, 1)) + champ('Profondeur (m)', nombre('o-w', Math.round(o.w), 3, 80, 1));
  if (e.src === 'tas') h += champ('Rangs', `<select id="o-n">${opt(4, '4', o.n === 4)}${opt(5, '5', o.n === 5)}</select>`);
  h += '<div class="row2"><button id="o-suppr" class="danger">Supprimer</button></div>';
  return h;
}

function brancherFiche() {
  const on = (id, ev, fn) => { const el = $d(id); if (el) el.addEventListener(ev, fn); };
  for (const b of document.querySelectorAll('#d-fiche [data-mode]')) b.onclick = () => { DEC.mode = b.dataset.mode; DEC.trace = null; if (DEC.mode === 'tracer') commencerTrace('trait'); majFiche(); peindre(); };
  for (const b of document.querySelectorAll('#d-fiche [data-nouv]')) b.onclick = () => commencerTrace(b.dataset.nouv === 'pad' ? 'pad' : 'runoff', { surface: b.dataset.nouv });
  for (const b of document.querySelectorAll('#d-fiche [data-zone]')) b.onclick = () => commencerTrace('zone', { kind: b.dataset.zone, essence: b.dataset.essence });
  for (const b of document.querySelectorAll('#d-fiche [data-fill]')) b.onclick = () => commencerTrace('pad', {free:true, surface:b.dataset.fill});
  on('d-pad-surface', 'change', ev => changer(() => { padsListe()[DEC.sel.pad].surface=ev.target.value; }, true));
  for (const b of document.querySelectorAll('#d-fiche [data-souspan]')) b.onclick = () => { DEC.outil = b.dataset.souspan; DEC.sel = null; majFiche(); peindre(); };
  const changerP = (fn) => { if (DEC.selP == null) return; changer(() => { poserPanneaux(); fn(DEC.panneaux[DEC.selP]); }); };
  for (const b of document.querySelectorAll('#d-fiche [data-sensp]')) b.onclick = () => changerP((p) => { p.sign = +b.dataset.sensp; });
  for (const b of document.querySelectorAll('#d-fiche [data-notep]')) b.onclick = () => changerP((p) => { p.note = /^\d+$/.test(b.dataset.notep) ? +b.dataset.notep : b.dataset.notep; });
  for (const b of document.querySelectorAll('#d-fiche [data-distp]')) b.onclick = () => changerP((p) => { p.dist = +b.dataset.distp; });
  for (const b of document.querySelectorAll('#d-fiche [data-pasp]')) b.onclick = () => changerP((p) => { const T = DEC.track, j = ((Math.round(p.at * T.n + +b.dataset.pasp / T.ds) % T.n) + T.n) % T.n; p.at = j / T.n; });
  on('d-pan-viseur', 'click', () => changerP((p) => { p.at = DEC.viseur / DEC.track.n; }));
  on('d-pan-suppr', 'click', () => { if (DEC.selP == null) return; changer(() => { poserPanneaux(); DEC.panneaux.splice(DEC.selP, 1); DEC.selP = null; }); });
  on('d-pan-ajout', 'click', () => { if (DEC.viseur == null) return; changer(() => { poserPanneaux(); DEC.panneaux.push({ at: DEC.viseur / DEC.track.n, dist: 100, note: 3, sign: 1 }); DEC.selP = DEC.panneaux.length - 1; }); });
  on('d-pan-calcul', 'click', () => changer(() => { DEC.panneaux = panneauxDuCalcul(); DEC.panModif = true; DEC.selP = null; }));
  on('d-mesure-eff', 'click', () => { DEC.mesure = []; majFiche(); peindre(); });
  for (const b of document.querySelectorAll('#d-fiche [data-ligne]')) b.onclick = () => { DEC.ligne = b.dataset.ligne; DEC.sel = null; DEC.mode = 'choisir'; majFiche(); peindre(); };
  on('d-ligne-point', 'click', () => { DEC.mode = 'point'; majFiche(); });
  on('d-ligne-calcul', 'click', () => changer(() => { poserLignes(); DEC.lignes[DEC.ligne] = lignesDuCalcul(DEC.ligne); DEC.sel = null; }));
  on('d-lignes-calcul', 'click', () => changer(() => { DEC.lignes = lignesDuCalcul(); DEC.sel = null; }));
  on('d-largeur-ajout','click',()=>{DEC.mode='ajouter';majFiche();});
  on('d-largeur-lisse','change',e=>changer(()=>{const z=largeursPiste()[DEC.sel.zone];z.smoothContour=e.target.checked;z.followContour=true;}));
  on('d-largeur-contour','change',e=>changer(()=>{largeursPiste()[DEC.sel.zone].followContour=e.target.checked;}));
  on('d-largeur-point','click',()=>{DEC.mode='point';majFiche();});
  on('d-largeur-deux','click',()=>{DEC.mode='ajouter-deux';majFiche();});
  on('d-largeur-oppose','click',()=>{
    const z=largeursPiste()[DEC.sel.zone];
    const opposite=largeursPiste().findIndex(other=>other.side===-z.side&&Math.abs(other.points[0][0]-z.points[0][0])<.00001&&Math.abs(other.points.at(-1)[0]-z.points.at(-1)[0])<.00001);
    if(opposite>=0)DEC.sel={outil:'piste',zone:opposite};
    else {changer(()=>largeursPiste().push({...clone(z),side:-z.side}));DEC.sel={outil:'piste',zone:largeursPiste().length-1};}
    majFiche();peindre();
  });
  on('d-largeur-liste','change',e=>{DEC.sel={outil:'piste',zone:+e.target.value};DEC.mode='choisir';majFiche();peindre();});
  on('d-largeur-cote','change',e=>changer(()=>{largeursPiste()[DEC.sel.zone].side=+e.target.value;}));
  on('d-largeur-m','change',e=>{
    if(!e.target.checkValidity()||e.target.value==='')return;
    const value=+e.target.value/ECHELLE_ROUTE;
    changer(()=>{const z=largeursPiste()[DEC.sel.zone],peak=z.points.reduce((a,p)=>Math.abs(p[1])>Math.abs(a)?p[1]:a,0);
      z.points.forEach((p,i)=>{p[1]=peak?p[1]*value/peak:(i>0&&i<z.points.length-1?value:0);});});
  });
  on('d-largeur-long','change',e=>{
    if(!e.target.checkValidity()||e.target.value==='')return;
    const len=+e.target.value/axeDe(DEC.track).length;
    changer(()=>{const z=largeursPiste()[DEC.sel.zone],a=z.points[0][0],b=z.points.at(-1)[0],mid=(a+b)/2;
      z.points.forEach(p=>p[0]=mid+(p[0]-mid)*len/(b-a));normaliseLargeur(z);});
  });
  on('d-finir', 'click', finirTrace);
  on('d-abandon', 'click', () => { DEC.trace = null; if (DEC.mode === 'tracer') DEC.mode = 'choisir'; majFiche(); peindre(); });
  on('d-ajout', 'change', (ev) => { DEC.ajout = ev.target.value; });
  on('d-gomme', 'input', (ev) => { DEC.gomme = +ev.target.value; ev.target.previousSibling.textContent = `Rayon ${DEC.gomme} m `; peindre(); });
  on('d-raz-objets', 'click', () => changer(() => { delete DEC.decor.objets; }));
  on('d-raz-coupes', 'click', () => changer(() => { delete DEC.decor.barrierCuts; }));
  on('d-auto', 'change', (ev) => changer(() => { DEC.decor.annotatedRunoffsOnly = ev.target.checked ? undefined : true; if (!DEC.decor.annotatedRunoffsOnly) delete DEC.decor.annotatedRunoffsOnly; }, true));
  on('d-liste', 'change', (ev) => {
    const v = ev.target.value, n = +v.slice(1);
    DEC.sel = v[0] === 'z' ? { outil: 'horspiste', zone: n } : v[0] === 'p' ? { outil: 'horspiste', pad: n }
      : v[0] === 't' ? { outil: 'barrieres', trait: n } : { outil: 'zones', zone: n };
    majFiche(); peindre();
  });
  on('d-nom', 'change', (ev) => changer(() => { zonesHP()[DEC.sel.zone].name = ev.target.value; }, true));
  on('d-surface', 'change', (ev) => changer(() => { zonesHP()[DEC.sel.zone].surface = ev.target.value; }, true));
  on('d-suppr', 'click', supprimerSel);
  on('d-pit-auto', 'click', () => changer(() => { DEC.decor.pitFrom = null; DEC.decor.pitTo = null; DEC.decor.pitAt = null; }));
  // zones d'implantation
  const zch = (id, fn) => on(id, 'change', (ev) => changer(() => fn(zonesIm()[DEC.sel.zone], ev.target.value), true));
  zch('z-kind', (z, v) => { z.kind = v; for (const [k, d] of Object.entries(DEFAUTS_ZONE[v])) if (z[k] == null) z[k] = d; });
  zch('z-side', (z, v) => { z.side = +v; });
  zch('z-from', (z, v) => { z.from = r4(+v); });
  zch('z-to', (z, v) => { z.to = r4(+v); });
  zch('z-recul', (z, v) => { z.recul = +v; });
  zch('z-prof', (z, v) => { z.prof = +v; });
  zch('z-module', (z, v) => { z.module = +v; });
  zch('z-essence', (z, v) => { if (v === 'bois') delete z.essence; else z.essence = v; });
  zch('z-densite', (z, v) => { z.densite = +v; });
  zch('z-max', (z, v) => { z.max = +v; });
  // objet choisi
  const e = retrouveSel();
  if (!e) return;
  const och = (id, fn, ev = 'change') => on(id, ev, (x) => changer(() => {
    const i = modifierObjet(e, fn(x.target.value));
    DEC.sel = { outil: 'objets', src: e.src, i };
  }, true));
  och('o-id', (v) => { const p = { id: v }; if ((v === 'pine' || v === 'pine2') && e.o.v == null) p.v = 0; return p; });
  och('o-e', (v) => ({ e: +v }));
  och('o-v', (v) => ({ v: +v }));
  och('o-kind', (v) => ({ kind: v, l: VEHICULES[v].l, w: VEHICULES[v].w, col: 0, rem: 0 }));
  och('o-col', (v) => ({ col: +v }));
  och('o-a', (v) => ({ a: Math.round(+v * Math.PI / 180 * 1000) / 1000 }));
  och('o-l', (v) => ({ l: +v }));
  och('o-w', (v) => ({ w: +v }));
  och('o-n', (v) => ({ n: +v }));
  on('o-suppr', 'click', supprimerSel);
}

function supprimerSel() {
  const s = DEC.sel;
  if (!s) return;
  if (s.outil === 'objets') { const e = retrouveSel(); if (e) changer(() => supprimerObjet(e)); }
  else if (s.outil === 'piste') changer(() => largeursPiste().splice(s.zone, 1));
  else if (s.outil === 'horspiste' && s.zone != null) changer(() => zonesHP().splice(s.zone, 1));
  else if (s.outil === 'horspiste' && s.pad != null) changer(() => padsListe().splice(s.pad, 1));
  else if (s.outil === 'barrieres' && s.trait != null) changer(() => traits().splice(s.trait, 1));
  else if (s.outil === 'zones' && s.zone != null) changer(() => zonesIm().splice(s.zone, 1));
  DEC.sel = null;
  majFiche();
}

/* ------------------------------------------------- circuits, enregistrement, fichier */

async function listeCircuits(choisi) {
  let perso = [];
  try { perso = await Store.list('tracks'); } catch (_) { /* base indisponible */ }
  $d('d-circuit').innerHTML = `<optgroup label="Circuits du jeu">${TRACKS.map((t) => opt(t.id, `${t.flag || ''} ${esc(t.name)}`, t.id === choisi)).join('')}</optgroup>`
    + (perso.length ? `<optgroup label="Circuits perso">${perso.map((t) => opt(t.id, esc(t.name), t.id === choisi)).join('')}</optgroup>` : '');
}

async function chargerCircuit(id) {
  if (DEC.modif && DEC.id && DEC.id !== id && !confirm('Abandonner les retouches non enregistrées ?')) { $d('d-circuit').value = DEC.id; return; }
  let def0 = TRACKS.find((t) => t.id === id), perso = false, local = null;
  if (!def0) { try { def0 = await Store.get('tracks', id); perso = true; } catch (_) { /* base indisponible */ } }
  if (!def0) return;
  let lignesLocales = null, pansLocaux = null;
  if (!perso) {
    try { local = await Store.get('decor', id); } catch (_) { /* base indisponible */ }
    try { lignesLocales = await Store.get('lines', id); } catch (_) { /* base indisponible */ }
    try { pansLocaux = await Store.get('panneaux', id); } catch (_) { /* base indisponible */ }
  }
  DEC.id = id; DEC.perso = perso; DEC.def0 = def0;
  // une retouche plus ancienne que le fichier ne compte plus : on l'écarte, en le disant
  DEC.perimees = [];
  if (local && !retoucheAJour(def0, local)) { DEC.perimees.push('décor'); local = null; }
  if (lignesLocales && !retoucheAJour(def0, lignesLocales)) { DEC.perimees.push('trajectoires'); lignesLocales = null; }
  if (pansLocaux && !retoucheAJour(def0, pansLocaux)) { DEC.perimees.push('panneaux'); pansLocaux = null; }
  // une retouche du poste : décor, trajectoires ou panneaux — « Revenir au fichier » oublie les trois
  DEC.local = !!(local && local.decor) || !!(lignesLocales && lignesLocales.lines) || !!(pansLocaux && Array.isArray(pansLocaux.panneaux)) || DEC.perimees.length > 0;
  // les trajectoires que le jeu joue : celles du poste, sinon celles du fichier, sinon le calcul
  const lignes = lignesLocales && lignesLocales.lines && lignesLocales.lines.racing ? lignesLocales.lines : def0.lines;
  DEC.lignes = lignes && lignes.racing ? clone(lignes) : null;
  DEC.lignesOrigine = lignesLocales && lignesLocales.lines ? 'Enregistrées sur ce poste.' : def0.lines ? 'Celles du fichier.' : '';
  DEC.calculLignes = null;
  // les panneaux : ceux du poste, sinon ceux du fichier ; sans liste, le jeu les calcule
  const pans = pansLocaux && Array.isArray(pansLocaux.panneaux) ? pansLocaux.panneaux : Array.isArray(def0.panneaux) ? def0.panneaux : null;
  DEC.panneaux = pans ? pans.map(versPanneau) : null; DEC.panModif = !!pans;
  DEC.panOrigine = pansLocaux && Array.isArray(pansLocaux.panneaux) ? 'enregistrés sur ce poste.' : pans ? 'ceux du fichier.' : '';
  DEC.selP = null; DEC.viseur = null; DEC.mesure = [];
  DEC.decor = {};
  for (const k of CLES_DECOR) {
    const v = local && local.decor && k in local.decor ? local.decor[k] : def0[k];
    if (v != null) DEC.decor[k] = clone(v);
  }
  DEC.annule = []; DEC.modif = false; DEC.sel = null; DEC.trace = null;
  refaire(true);
}

// Les clés qui diffèrent du fichier : `null` dit « retirer cette clé ».
function ecartAuFichier(def0, decor) {
  const out = {};
  for (const k of CLES_DECOR) {
    // une liste vide vaut une clé absente (l'affichage crée les listes de traits à la demande)
    const vide = (x) => VIDES.includes(k) && Array.isArray(x) && !x.length;
    const a = vide(def0[k]) ? undefined : def0[k], b = vide(decor[k]) ? undefined : decor[k];
    if (egal(a, b)) continue;
    out[k] = b == null ? null : clone(b);
  }
  return out;
}

async function enregistrer() {
  try {
    if (DEC.perso) {
      const def = { ...DEC.def0 };
      for (const k of CLES_DECOR) { if (DEC.decor[k] == null) delete def[k]; else def[k] = clone(DEC.decor[k]); }
      if (DEC.lignes) def.lines = arrondiLigne(DEC.lignes);
      if (DEC.panModif) def.panneaux = panneauxPlats();
      await Store.put('tracks', def);
      DEC.def0 = def; DEC.local = false;
    } else {
      const ecart = ecartAuFichier(DEC.def0, DEC.decor);
      let local = false;
      if (Object.keys(ecart).length) { await Store.put('decor', { id: DEC.id, at: Date.now(), decor: ecart }); local = true; }
      else await Store.del('decor', DEC.id);
      // les trajectoires, là où `lignes.html` les range et où le jeu les relit
      const lignes = arrondiLigne(DEC.lignes);
      if (lignes && !egal(lignes, arrondiLigne(DEC.def0.lines))) { await Store.put('lines', { id: DEC.id, at: Date.now(), lines: lignes }); DEC.lignesOrigine = 'Enregistrées sur ce poste.'; local = true; }
      else { await Store.del('lines', DEC.id); DEC.lignesOrigine = DEC.def0.lines ? 'Celles du fichier.' : ''; }
      // les panneaux : une liste reprise, là où `lignes.html` les rangeait et où le jeu les relit
      const plats = panneauxPlats(), fichier = Array.isArray(DEC.def0.panneaux) ? DEC.def0.panneaux.map(versPanneau).map((p) => [r4(p.at), p.dist, p.note, p.sign]) : null;
      if (DEC.panModif && !egal(plats, fichier)) { await Store.put('panneaux', { id: DEC.id, at: Date.now(), panneaux: plats }); DEC.panOrigine = 'enregistrés sur ce poste.'; local = true; }
      else { await Store.del('panneaux', DEC.id); DEC.panOrigine = fichier ? 'ceux du fichier.' : ''; }
      DEC.local = local;
    }
    DEC.modif = false; majFiche();
    etatDecor(`${DEC.def0.name} : enregistré${DEC.perso ? ' dans le circuit perso' : ' pour ce navigateur — « Fabriquer tracks.js » pour tout le monde'}`);
  } catch (e) { etatDecor('Enregistrement impossible : ' + e.message); }
}

async function oublier() {
  if (!confirm('Revenir au fichier et oublier la retouche de ce circuit — décor, trajectoires et panneaux ?')) return;
  if (!DEC.perso) {
    try { await Store.del('decor', DEC.id); } catch (_) { /* base indisponible */ }
    try { await Store.del('lines', DEC.id); } catch (_) { /* base indisponible */ }
    try { await Store.del('panneaux', DEC.id); } catch (_) { /* base indisponible */ }
  }
  DEC.modif = false;
  await chargerCircuit(DEC.id);
}

async function fabriquerFichier() {
  try {
    let recs = [];
    try { recs = await Store.list('decor'); } catch (_) { /* base indisponible */ }
    const aJour = (r) => r && retoucheAJour(TRACKS.find((t) => t.id === r.id), r);
    const par = new Map(recs.filter((r) => r && r.decor && TRACKS.some((t) => t.id === r.id) && aJour(r)).map((r) => [r.id, { ...r.decor }]));
    if (!DEC.perso && DEC.id) par.set(DEC.id, ecartAuFichier(DEC.def0, DEC.decor));
    // les trajectoires du poste partent avec : celles de ce circuit telles qu'on les voit, les autres de la base
    let lignes = [];
    try { lignes = await Store.list('lines'); } catch (_) { /* base indisponible */ }
    const pose = (id, l) => { const def = TRACKS.find((t) => t.id === id), a = arrondiLigne(l); if (!def || !a || egal(a, arrondiLigne(def.lines))) return; if (!par.has(id)) par.set(id, {}); par.get(id).lines = a; };
    for (const r of lignes) if (r && r.lines && r.lines.racing && r.id !== DEC.id && aJour(r)) pose(r.id, r.lines);
    if (!DEC.perso && DEC.id && DEC.lignes) pose(DEC.id, DEC.lignes);
    // et les panneaux repris : ceux de ce circuit tels qu'on les voit, les autres de la base
    let pans = [];
    try { pans = await Store.list('panneaux'); } catch (_) { /* base indisponible */ }
    const poseP = (id, liste) => {
      const def = TRACKS.find((t) => t.id === id);
      if (!def || !Array.isArray(liste)) return;
      const plats = liste.map(versPanneau).map((p) => [r4(p.at), p.dist, p.note, p.sign]);
      const fichier = Array.isArray(def.panneaux) ? def.panneaux.map(versPanneau).map((p) => [r4(p.at), p.dist, p.note, p.sign]) : null;
      if (egal(plats, fichier)) return;
      if (!par.has(id)) par.set(id, {}); par.get(id).panneaux = plats;
    };
    for (const r of pans) if (r && r.id !== DEC.id && aJour(r)) poseP(r.id, r.panneaux);
    if (!DEC.perso && DEC.id && DEC.panModif) poseP(DEC.id, DEC.panneaux);
    const r = await fetch('js/tracks.js');
    if (!r.ok) throw new Error('js/tracks.js illisible (' + r.status + ')');
    let txt = await r.text();
    const ids = [];
    for (const [id, ecart] of par) {
      if (!Object.keys(ecart).length) continue;
      txt = poserValeurs(txt, id, ecart);
      ids.push(id);
    }
    if (!ids.length) { etatDecor('Aucune retouche à reporter dans le fichier.'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/javascript' }));
    a.download = 'tracks.js';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    etatDecor(`tracks.js fabriqué avec les retouches de ${ids.join(', ')} — à remettre dans js/`);
  } catch (e) { etatDecor('Fabrication impossible : ' + e.message); }
}

/* ------------------------------------------------- entrer et sortir du mode Décor */

function initDecor() {
  DEC.cv = $d('decor');
  DEC.rendu = new Renderer(DEC.cv);
  DEC.rendu.autoRes = false;
  DEC.rendu.rotate = false; DEC.rendu.camAngle = 0;
  for (const c of [DEC.cv, DEC.rendu.carCanvas, DEC.rendu.hudCanvas]) c.style.display = 'none';
  DEC.cv.addEventListener('pointerdown', (e) => { if (DEC.actif) surBas(e); });
  window.addEventListener('pointermove', surMouvement);
  window.addEventListener('pointerup', (e) => { if (DEC.actif) surHaut(e); });
  window.addEventListener('pointercancel', (e) => { if (DEC.actif) surHaut(e); });
  DEC.cv.addEventListener('wheel', surMolette, { passive: false });
  DEC.cv.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('resize', () => { if (DEC.actif) { DEC.rendu.resize(); peindre(); } });
  window.addEventListener('keydown', (e) => {
    if (!DEC.actif || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === 'Space') { DEC.espace = true; e.preventDefault(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); annuler(); }
    if (e.key === 'Escape') { DEC.trace = null; DEC.sel = null; if (DEC.mode === 'tracer') DEC.mode = 'choisir'; majFiche(); peindre(); }
    if (e.key === 'Enter' && DEC.trace) finirTrace();
    if ((e.key === 'Delete' || e.key === 'Backspace') && DEC.sel) { e.preventDefault(); supprimerSel(); }
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') DEC.espace = false; });
  // quatre onglets ; celui des objets garde ses cinq outils, et se souvient du dernier
  for (const b of document.querySelectorAll('#d-onglets button')) b.onclick = () => {
    DEC.onglet = b.dataset.onglet;
    DEC.outil = DEC.onglet === 'objets' ? (DEC.outilObjets || 'objets') : DEC.onglet;
    DEC.mode = 'choisir'; DEC.sel = null; DEC.trace = null; majFiche(); peindre();
  };
  for (const b of document.querySelectorAll('#d-outils button')) b.onclick = () => {
    DEC.onglet = 'objets'; DEC.outil = DEC.outilObjets = b.dataset.outil; DEC.mode = 'choisir'; DEC.sel = null; DEC.trace = null; majFiche(); peindre();
  };
  $d('d-circuit').onchange = (e) => chargerCircuit(e.target.value);
  $d('d-poser').onclick = enregistrer;
  $d('d-tester').onclick = async () => { await enregistrer(); window.open('index.html?track=' + encodeURIComponent(DEC.id), '_blank'); };
  $d('d-annuler').onclick = annuler;
  $d('d-oublier').onclick = oublier;
  $d('d-fichier').onclick = fabriquerFichier;
  $d('d-cadrer').onclick = cadrer;
  window.addEventListener('beforeunload', (e) => { if (DEC.modif) { e.preventDefault(); e.returnValue = ''; } });
}

/* ------------------------------------------------- ouvrir l'éditeur

Il n'y a plus qu'un mode : la page s'ouvre sur l'éditeur, sur le circuit de l'adresse
(`?decor=monaco`), sinon le dernier regardé, sinon le premier du jeu. */
async function ouvrirEditeur() {
  initDecor();
  DEC.actif = true;
  for (const c of [DEC.cv, DEC.rendu.carCanvas, DEC.rendu.hudCanvas]) c.style.display = 'block';
  DEC.rendu.resize();
  const id = new URLSearchParams(location.search).get('decor') || TRACKS[0].id;
  await listeCircuits(id);
  await chargerCircuit(id);
}
ouvrirEditeur();
