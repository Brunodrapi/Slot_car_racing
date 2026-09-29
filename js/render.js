// Canvas renderer: world (background image or grass, road with variable width, the three
// driving lines, cars, effects) + HUD (position, times, speed/grip, line slider, minimap).
'use strict';

// Cartoon palette, flat and saturated, in the spirit of an isometric pixel-art city.
// Each circuit names a theme; a track without one gets the default. The palette is swapped whole
// rather than tinted, so a theme can change the mood of the ground and the colour of the kerbs at
// once — Silverstone in autumn wants pale stubble, ochre earth and blue kerbs, not a greener green.
/* Every circuit has its own look.

   What they share is the road: a dark **purple-grey** rather than a neutral charcoal, which is what
   holds the family together whatever the ground around it does. What they do not share is the
   ground — Monza's pale park green, the dunes' sand, the Ardennes' damp forest, Bathurst's red
   earth — nor the colour of their kerbs, nor what grows beside the track.

   A theme names a ground, a road, a pair of kerb colours and the palette the scenery is drawn in.
   `props` re-weights what gets sown: no pines in a dune, no palms in the Ardennes. `centre` is the
   marking down the middle of the road, and it is null almost everywhere, because a race track has
   no centre line — only Monaco, which is a road, keeps one.

   Fields left out of a theme are taken from `base`.
*/
const THEME_BASE = {
  grass: '#4e7a3a', grassLight: '#557f3f', grassDark: '#477036',
  earth: '#b9a271', earthDark: '#a68f5f',
  asphalt: '#4e3f57', asphaltLight: '#5b4a64',
  outline: '#241d2a',
  edgeLine: '#eceaf0', centre: null,
  // Les deux bords de piste, teintés du côté du virage : froid dedans, chaud dehors, et ce sont les
  // couleurs du curseur de ligne pour que le lien se fasse sans légende. Assez clairs pour rester
  // des lignes peintes sur de l'asphalte, assez marqués pour se distinguer d'un coup d'œil.
  edgeIn: '#7fd4ff', edgeOut: '#ffcf5c',
  // la voie des stands : un asphalte plus sombre que la piste, pour qu'on voie tout de suite que
  // ce n'est pas la même surface, et une zone d'arrêt jaune qu'on repère de loin
  pitLane: '#2f3038', pitBox: 'rgba(255,212,0,0.18)', pitBoxLine: '#ffd400',
  kerbA: '#c33b30', kerbB: '#eceaf0',
  gravel: '#c8ab72', gravelDark: '#b39660',
  canopy: ['#3f7a34', '#4b8d3c', '#336629'], pine: ['#2f5f4f', '#37705d'],
  trunk: '#4a3421', rock: '#9a9384', log: '#7a4f2c',
  props: null,
  patches: 0.6,            // how much bare earth shows through, 0 = none
  water: null,             // a bay along part of the lap; see placeWater in js/props.js
  sea: '#50b4be', seaDeep: '#2f8a94', seaShallow: '#72cbd4', surf: '#f4f7f3',
  wall: '#f2e8d5', wallDark: '#ddd0b9', roofA: '#2f9aa0', roofB: '#b5654a',
  sail: '#ffffff', sailDeck: '#d8d2c2', boatHull: '#c9503a',
  // standing water: the puddle itself, the sky caught in it, and the damp a tyre carries out of it
  puddle: '#2d3a57', puddleLight: '#82abc6', wet: '#2b2735',
};

const THEME_DEFS = {
  // The royal park: pale mint grass under plane trees, and the old banking's concrete.
  park: {
    patches: 0.45,
    grass: '#bcd5ae', grassLight: '#c9dfbb', grassDark: '#a8c79c',
    earth: '#d9c79c', earthDark: '#c8b489',
    gravel: '#d9c79c', gravelDark: '#c8b489',
    canopy: ['#4a8a52', '#59a05f', '#3c7243'], pine: ['#356b58', '#3f7c66'],
    rock: '#b9b4a6',
    props: { pine: 0.4, bales: 0.4, logs: 0.4 },
  },
  // The Ardennes: damp, dark, coniferous.
  forest: {
    patches: 0.55,
    grass: '#5f8f52', grassLight: '#6a9a5c', grassDark: '#537f48',
    earth: '#8d7a56', earthDark: '#7c6a49',
    asphalt: '#443a50', asphaltLight: '#50465c',
    canopy: ['#2f6b34', '#3a7f3e', '#25562b'], pine: ['#23503f', '#2b6250'],
    props: { pine: 3, tree: 1.4, bales: 0, palm: 0 },
  },
  // Stubble and ochre earth, blue kerbs.
  autumn: {
    patches: 0.7,
    grass: '#c6cf87', grassLight: '#d2da93', grassDark: '#b7c079',
    earth: '#e0c391', earthDark: '#d2b27e',
    asphalt: '#574a5e', asphaltLight: '#63566a',
    outline: '#332b39',
    kerbA: '#2f63b0', kerbB: '#eef1f4',
    gravel: '#e2c48f', gravelDark: '#d0ae76',
    canopy: ['#b4472e', '#c9662c', '#8e3a26'], pine: ['#2c5a52', '#356d5f'],
    trunk: '#6b4526', rock: '#b6ad98', log: '#8a552c',
    props: { pine: 0.6, palm: 0 },
  },
  /* The Riviera: dry stone, a Cyclades village, and the sea along the harbour front. */
  riviera: {
    // The bare ground here is not worn earth but the dark rock the coast is cut into.
    patches: 0.4,
    grass: '#dcd2c8', grassLight: '#e7ded2', grassDark: '#cfc4b6',
    earth: '#877482', earthDark: '#746373',
    asphalt: '#56465e', asphaltLight: '#62526a',
    edgeLine: '#f5f2e8', centre: '#f5f2e8', edgeIn: '#8fdcff', edgeOut: '#ffd97a',
    pitLane: '#3b3142', pitBox: 'rgba(255,212,0,0.18)', pitBoxLine: '#ffd400',
    kerbA: '#c33b30', kerbB: '#f4f1e8',
    gravel: '#cfc3ae', gravelDark: '#bdb09a',
    canopy: ['#4f9a55', '#5cae61', '#3f7f45'], pine: ['#3f7a5a', '#4a8c69'],
    rock: '#64505a', trunk: '#6b4a32', log: '#8a5a34',
    props: { house: 9, house2: 7, chapel: 2, palm: 3, tree: 0.6, tree2: 0.5,
             pine: 0.3, bush: 1, rock: 1.2, bales: 0, logs: 0 },
    water: { from: 0.05, to: 0.36, side: 1, gap: 13, out: 180 },
  },

  // The dunes: sand, marram grass, and orange everywhere.
  dunes: {
    patches: 0.4,
    grass: '#e8d5a0', grassLight: '#f0dfae', grassDark: '#d9c48c',
    earth: '#c9ae79', earthDark: '#b79c68',
    kerbA: '#e07a1f', kerbB: '#f4f1e8',
    gravel: '#d9c08a', gravelDark: '#c5aa74',
    canopy: ['#7f9a52', '#8fae5e', '#6c8544'], pine: ['#5e7a45', '#6b8a50'],
    rock: '#c0b49a',
    props: { pine: 0.3, tree: 0.4, bush: 2.5, rock: 2, palm: 0.5, logs: 0 },
  },
  // Dry California hills: gold grass, dark scrub oaks.
  california: {
    patches: 0.5,
    grass: '#cfc184', grassLight: '#dacd91', grassDark: '#beb073',
    earth: '#bfa268', earthDark: '#ab8f58',
    kerbA: '#2f63b0', kerbB: '#f1f0ea',
    gravel: '#c9ad74', gravelDark: '#b59862',
    canopy: ['#5d7a3c', '#6d8c46', '#4c6631'], pine: ['#4a6b46', '#567a52'],
    rock: '#bdb298',
    props: { pine: 0.5, bush: 2, rock: 2, palm: 0.6, bales: 0.5 },
  },
  // Warm and saturated, with palms.
  tropical: {
    patches: 0.5,
    grass: '#66a84e', grassLight: '#73b659', grassDark: '#5a9645',
    earth: '#b08a58', earthDark: '#9c774a',
    kerbA: '#e8bc32', kerbB: '#1f7a3c',
    canopy: ['#2f8a3f', '#3aa04c', '#256e32'], pine: ['#2a6b4a', '#337d58'],
    props: { palm: 3, pine: 0.2, tree: 1.2, logs: 0.4 },
  },
  // Cool green under the mountains, hard red kerbs.
  japan: {
    patches: 0.5,
    grass: '#7fb073', grassLight: '#8cbd7f', grassDark: '#6f9e64',
    earth: '#a89369', earthDark: '#95805a',
    asphalt: '#473c53', asphaltLight: '#53485f',
    canopy: ['#3a7a46', '#478f54', '#2e6237'], pine: ['#2a5b4e', '#336d5e'],
    props: { pine: 2, palm: 0, bales: 0.4 },
  },
  // The bush: khaki scrub over red earth.
  bush: {
    patches: 0.85,
    grass: '#a9ab68', grassLight: '#b5b774', grassDark: '#9a9c5d',
    earth: '#b3663c', earthDark: '#9d5733',
    gravel: '#c08a5a', gravelDark: '#aa774b',
    canopy: ['#6f8a4a', '#7f9c56', '#5d743c'], pine: ['#54704a', '#608055'],
    rock: '#b09479',
    props: { pine: 0.4, bush: 2, rock: 1.6, palm: 0.3, logs: 1.4 },
  },
  // Alpine meadow, very green, very clean.
  alpine: {
    patches: 0.45,
    grass: '#66ad55', grassLight: '#74bb61', grassDark: '#5a9c4b',
    earth: '#ab9263', earthDark: '#977f53',
    asphalt: '#4a3e55', asphaltLight: '#564a61',
    canopy: ['#347a3c', '#3f9047', '#2a6231'], pine: ['#24543f', '#2c664e'],
    props: { pine: 2.4, palm: 0, bales: 1.4 },
  },
  // Long French summer: dry verges, blue kerbs.
  lemans: {
    patches: 0.55,
    grass: '#8fae5e', grassLight: '#9cbb6a', grassDark: '#7f9e51',
    earth: '#bda572', earthDark: '#a98f60',
    kerbA: '#2f63b0', kerbB: '#f0efe9',
    canopy: ['#417f3c', '#4e9448', '#356832'], pine: ['#2f6350', '#38755f'],
    props: { pine: 1.4, palm: 0, bales: 1.2 },
  },
};

const THEMES = {};
for (const name in THEME_DEFS) THEMES[name] = Object.assign({}, THEME_BASE, THEME_DEFS[name]);
THEMES.classic = Object.assign({}, THEME_BASE);
let PAL = THEMES.park;

const LINE_COLORS = { inside: 'rgba(80,200,255,0.55)', racing: 'rgba(255,255,255,0.5)', outside: 'rgba(255,200,60,0.55)' };

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    /* La résolution s'adapte à ce que la machine tient.

    Mesuré : le coût d'une image est **exactement proportionnel au nombre de pixels** — 1,32 Mpx
    coûtent 57 ms là où 0,33 Mpx en coûtent 19. Le jeu est limité par le remplissage, pas par le
    calcul : la physique, la caméra et le son réunis ne pèsent pas deux millisecondes. Sur un
    téléphone, tenir la pleine résolution d'un écran moderne revient donc à choisir seize images
    par seconde plutôt que soixante, ce qui n'est pas un arbitrage qu'on veut imposer.

    On mesure donc la durée réelle des images et on descend d'un cran quand elle s'allonge, on
    remonte quand elle est confortable. La marge entre les deux seuils évite de faire l'accordéon,
    et le délai d'une seconde entre deux changements évite de payer le redimensionnement plus
    souvent qu'il ne rapporte. */
    this.dprMax = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = this.dprMax;
    this.autoRes = true;
    this.track = null;
    this.paths = null;
    this.rubber = new Map();   // rubber laid on the road, kept for the whole race
    this.pullBack = 1;         // how far the camera sits back, 1 = normal, above it wider
    this.particles = [];
    this.wets = [];            // damp tyre tracks, carried out of a puddle
    this.damp = new Map();     // metres of water each car still has on its tyres
    this.puddles = [];
    this.cam = { x: 0, y: 0, zoom: 6 };
    this.grass = this._makeGrass();
    this.shake = 0;
    this.touch = false;
    this.showLines = false;   // braking guide, off unless enabled in the settings
    this.debug = false;       // vehicle telemetry overlay (speed, slip angle, lateral velocity, grip usage)
    this.dialPress = 0;       // eased 0..1 press state of the throttle dial
    this.rotate = true;      // keep the track direction pointing up the screen
    this.tilt = 1;           // 1 = straight down; below that the ground plane is tilted (isometric)
    this._sheets = new Map();
    this._stacks = new Map();
    this.camAngle = 0;
    this.resize();
  }

  // 'track' top-down following the road, 'fixed' top-down north-up, 'iso' tilted ground with a
  // camera that only follows: it never turns, so a car is seen from every angle through a lap.
  setView(view) {
    this.view = view;
    this.rotate = view === 'track';
    this.tilt = view === 'iso' ? 0.55 : 1;
    this.cam.init = false;
  }

  /** Un cran de résolution en plus ou en moins, selon la durée des images récentes. */
  _adapt(now) {
    if (!this.autoRes) return;
    const ms = this._lastDraw ? now - this._lastDraw : 0;
    this._lastDraw = now;
    if (!ms || ms > 500) return;                    // onglet en arrière-plan : on ne conclut rien
    const f = this._fr || (this._fr = []);
    f.push(ms);
    if (f.length > 90) f.shift();
    if (f.length < 60 || now - (this._scaleAt || 0) < 1200) return;
    const tri = f.slice().sort((a, b) => a - b);
    const med = tri[tri.length >> 1];
    const CRANS = [1, 1.25, 1.5, 2].filter(x => x <= this.dprMax);
    let i = CRANS.indexOf(this.dpr);
    if (i < 0) i = CRANS.length - 1;
    let n = i;
    if (med > 20 && i > 0) n = i - 1;                // on n'y arrive pas : moins de pixels
    else if (med < 13 && i < CRANS.length - 1) n = i + 1;   // de la marge : on en reprend
    if (n === i) return;
    this.dpr = CRANS[n];
    this.resize();
    if (this.track) this._makeMinimap();
    this._scaleAt = now;
    this._fr = [];
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.w = w; this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this._layoutHud();
  }

  /* Ce que le téléphone nous prend sur les bords.

  Le canvas est en `position: fixed; inset: 0` avec `viewport-fit=cover` : il couvre l'écran ENTIER,
  encoche et barre d'accueil comprises. Les écrans en DOM, eux, respectent `env(safe-area-inset-*)`
  depuis toujours — mais le HUD est dessiné, et un dessin ne connaît pas le CSS. Il posait donc ses
  quatorze pixels depuis le bord physique, si bien qu'en portrait sur un iPhone le bouton pause,
  de 14 à 60, tombait aux trois quarts sous une barre d'état haute de 47.

  `env()` ne se lit pas depuis JavaScript : la valeur calculée d'une propriété personnalisée n'est
  pas résolue, on récupérerait le texte `env(...)`. On passe donc par une sonde — un élément qui
  porte ces quatre valeurs en marge intérieure, ce qui, lui, se résout en pixels. Elle est relue à
  chaque mise en page, parce que tourner le téléphone déplace les encoches. */
  _encoches() {
    if (!document.body) return { t: 0, r: 0, b: 0, l: 0 };
    let d = this._sonde;
    if (!d) {
      d = this._sonde = document.createElement('div');
      d.id = 'sonde-encoches';
      d.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;'
        + 'pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right)'
        + ' env(safe-area-inset-bottom) env(safe-area-inset-left);';
      document.body.appendChild(d);
    }
    const c = getComputedStyle(d);
    const n = (v) => Math.max(0, Math.round(parseFloat(v) || 0));
    return { t: n(c.paddingTop), r: n(c.paddingRight), b: n(c.paddingBottom), l: n(c.paddingLeft) };
  }

  _layoutHud() {
    const W = this.w, H = this.h, mobile = W < 700;
    const sa = this._encoches();
    // Un seul écart, mesuré depuis le bord SÛR et non depuis le bord physique.
    const P = this.pad = { t: 14 + sa.t, r: 14 + sa.r, b: 14 + sa.b, l: 14 + sa.l };
    this.encoches = sa;
    // Throttle dial: a half-dome that the thumb carries with it. At rest it waits at the bottom
    // centre; a thumb landing anywhere off the line slider moves it there, base on the finger, so
    // the whole dial reads above the hand instead of under it.
    const r = clamp(Math.min(W * 0.26, H * 0.17), 68, 130);
    this.dialHome = { cx: W / 2, cy: H - P.b - r * 0.46 };   // at rest the pad shows in full
    this.dial = { cx: this.dialHome.cx, cy: this.dialHome.cy, r };
    this.dialAnchored = false;
    /* Le levier de ligne, à gauche par défaut, à droite au choix.

    Un droitier tient son téléphone d'une main et pousse le levier du pouce de l'autre ; un
    gaucher fait l'inverse, et jusqu'ici il n'avait pas le choix. Tout ce qui vit dans cette
    colonne — les jauges d'usure, la carte en face — se retourne avec lui, sinon le retournement
    ne ferait que déplacer la gêne. */
    const droite = this.ctrlSide === 'right';
    const len = Math.min(H * 0.38, 320);
    this.slider = { x: droite ? W - P.r - 22 : P.l + 22, y: H - P.b - 30 - len, len, w: 30, droite };
    /* Les deux cadrans d'usure, en colonne au-dessus du levier.

    Ils étaient dans le panneau du haut à gauche, qui grandissait pour les loger. Ils vivent
    maintenant avec le levier, en bas : c'est là que se porte le regard quand on choisit sa ligne,
    donc là qu'on décide aussi de ménager la gomme. Au-dessus du levier et non à côté — à côté, ils
    entraient en collision avec le cadran d'accélérateur sur un téléphone. */
    /* Ils se posent AU-DESSUS du panneau du levier, pas au-dessus du rail.

    Calés sur le rail, le cadran du bas tombait sur le bord du panneau, qui commence vingt-six
    pixels plus haut : il le chevauchait à moitié. On part donc du haut du panneau et on remonte. */
    const rj = mobile ? 19 : 22;
    const hautPanneau = this.slider.y - 26;
    this.jauges = { r: rj, x: this.slider.x, y2: hautPanneau - rj - 10, y1: hautPanneau - rj * 3.2 - 14 };
    /* Les deux panneaux du haut, mesurés ici et non plus au moment de les dessiner : le bouton
    pause se pose dans l'espace qu'ils laissent, et deux jeux de constantes qui doivent rester
    d'accord finissent toujours par ne plus l'être. */
    this.hudBox = { w: mobile ? 150 : 190, h: mobile ? 64 : 78, tw: mobile ? 150 : 200 };
    /* Le bouton pause, entre les deux panneaux — le seul endroit du haut que rien n'occupe.

    Au clavier, Échap et P mettent en pause depuis toujours ; au doigt il n'y avait rien, et une
    course ne se quittait pas. Il tient dans l'espace restant : 62 px sur un iPhone 13, mais 47 sur
    un SE, donc sa taille suit la place au lieu d'être posée — sur un écran étroit un bouton de
    46 px passerait sous le chrono. */
    /* Le bouton pause n'est plus au centre : il se range à gauche, derrière la position.

    Au centre, il occupait le seul endroit du haut que rien n'obstrue — celui par lequel on voit
    arriver la piste. Et il séparait la position des temps, deux informations qu'on lit d'affilée,
    en les renvoyant aux deux bords opposés de l'écran : un aller-retour du regard pour rien.

    Tout le haut se lit donc maintenant de gauche à droite d'un seul balayage : la position, la
    pause, puis les temps. Le centre redevient de la piste. */
    const cote = clamp(mobile ? 44 : 42, 34, 48);
    this.pauseBtn = { x: P.l + (mobile ? 96 : 118), y: P.t, s: cote };
    this.mobile = mobile;
  }

  // Cartoon ground: a flat saturated base with a few chunky patches, everything snapped to an
  // 8 px grid so it reads as pixel art rather than noise.
  _makeGrass() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = PAL.grass;
    g.fillRect(0, 0, 128, 128);
    const cell = 8;
    for (let i = 0; i < 26; i++) {
      g.fillStyle = i % 3 === 0 ? PAL.grassLight : PAL.grassDark;
      const x = Math.floor(Math.random() * 16) * cell, y = Math.floor(Math.random() * 16) * cell;
      const w = (1 + Math.floor(Math.random() * 3)) * cell, h = (1 + Math.floor(Math.random() * 2)) * cell;
      g.fillRect(x, y, w, h);
    }
    return c;
  }

  setTrack(track) {
    this.track = track;
    this.rubber = new Map();
    this.particles = [];
    this.wets = [];
    this.damp = new Map();
    PAL = THEMES[track.theme] || THEMES.park;
    this.grass = this._makeGrass();
    this.grassPattern = this.ctx.createPattern(this.grass, 'repeat');
    const seed = track.id || track.name || 'track';
    // Two sets of scenery for two ways of looking at the world. The billboards only make sense in
    // the tilted view — seen from straight above, a standing prop is nonsense — so the flat view
    // gets its own objects, drawn as they look from a bird's eye.
    if (!this.propArt) this.propArt = buildPropArt();
    this.props = placeProps(track, seed);
    this.topArt = buildTopArt(PAL);
    this.topProps = placeTopProps(track, seed, null, PAL.props);
    this.patches = placePatches(track, seed, PAL.patches);
    this.puddles = placePuddles(track, seed, track.puddles);
    this.water = placeWater(track, PAL.water);
    this.boats = placeBoats(track, seed, this.water);
    this.boatArt = this.water ? buildBoatArt(PAL) : null;
    const N = track.n, xs = track.xs, ys = track.ys, nx = track.nx, ny = track.ny;
    const STEP = 3;
    const edgePt = (i, side) => {
      const k = ((i % N) + N) % N, hw = side > 0 ? track.hwL[k] : track.hwR[k];
      return [xs[k] + nx[k] * hw * side, ys[k] + ny[k] * hw * side];
    };
    const center = new Path2D();
    for (let i = 0; i < N; i += STEP) { if (i === 0) center.moveTo(xs[i], ys[i]); else center.lineTo(xs[i], ys[i]); }
    center.closePath();
    // road polygon: left edge forward, right edge back
    const road = new Path2D(), left = new Path2D(), right = new Path2D();
    for (let i = 0; i < N; i += STEP) { const p = edgePt(i, 1); if (i === 0) { road.moveTo(p[0], p[1]); left.moveTo(p[0], p[1]); } else { road.lineTo(p[0], p[1]); left.lineTo(p[0], p[1]); } }
    left.closePath();
    for (let i = N - 1; i >= 0; i -= STEP) { const p = edgePt(i, -1); road.lineTo(p[0], p[1]); if (i === N - 1) right.moveTo(p[0], p[1]); else right.lineTo(p[0], p[1]); }
    road.closePath(); right.closePath();
    // geometric middle of the road, for the painted centre line
    const mid = new Path2D();
    for (let i = 0; i < N; i += STEP) {
      const k = i % N, off = (track.hwL[k] - track.hwR[k]) / 2;
      const x = xs[k] + nx[k] * off, y = ys[k] + ny[k] * off;
      if (i === 0) mid.moveTo(x, y); else mid.lineTo(x, y);
    }
    mid.closePath();

    // A kerb is a band just outside the white line, cut into alternating blocks. Built as filled
    // quads rather than stroked with a dash: a dash takes the line cap of whatever is drawing, and
    // with the round caps this look needs everywhere else the blocks came out as pills. Filled
    // shapes have no caps at all, so the edges stay square whatever the zoom.
    // The band starts just outside the white edge line rather than under it: overlapping, the
    // white blocks disappeared into the paint and the kerb read as a row of blue dashes.
    const KERB_IN = 0.34, KERB_W = 1.7, KERB_BLOCK = 3;
    const bandPt = (i, side, w) => {
      const k = ((i % N) + N) % N, hw = (side > 0 ? track.hwL[k] : track.hwR[k]) + w;
      return [xs[k] + nx[k] * hw * side, ys[k] + ny[k] * hw * side];
    };
    const corners = track.corners.map(cn => {
      const l = new Path2D(), r = new Path2D(), gravel = new Path2D();
      const kerbA = new Path2D(), kerbB = new Path2D(), kerbEdge = new Path2D();
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = cn.from; i <= cn.to; i += 2) {
        const a = edgePt(i, 1), b = edgePt(i, -1);
        if (i === cn.from) { l.moveTo(a[0], a[1]); r.moveTo(b[0], b[1]); } else { l.lineTo(a[0], a[1]); r.lineTo(b[0], b[1]); }
        minX = Math.min(minX, a[0], b[0]); maxX = Math.max(maxX, a[0], b[0]); minY = Math.min(minY, a[1], b[1]); maxY = Math.max(maxY, a[1], b[1]);
      }
      for (const side of [1, -1]) {
        let block = 0;
        for (let i = cn.from; i < cn.to; i += KERB_BLOCK, block++) {
          const j = Math.min(i + KERB_BLOCK, cn.to);
          const p = block % 2 ? kerbB : kerbA;
          const a0 = bandPt(i, side, KERB_IN);
          p.moveTo(a0[0], a0[1]);
          for (let t = i + 1; t <= j; t++) { const q = bandPt(t, side, KERB_IN); p.lineTo(q[0], q[1]); }
          for (let t = j; t >= i; t--) { const q = bandPt(t, side, KERB_IN + KERB_W); p.lineTo(q[0], q[1]); }
          p.closePath();
        }
        // both sides of the band get the dark outline, so the strip is framed like the road is
        for (const w of [KERB_IN, KERB_IN + KERB_W]) {
          const e0 = bandPt(cn.from, side, w);
          kerbEdge.moveTo(e0[0], e0[1]);
          for (let t = cn.from + 1; t <= cn.to; t++) { const q = bandPt(t, side, w); kerbEdge.lineTo(q[0], q[1]); }
        }
      }
      // gravel: wider band around the corner
      for (let i = cn.from; i <= cn.to; i += 2) { const k = ((i % N) + N) % N, p = [xs[k] + nx[k] * (track.hwL[k] + 8), ys[k] + ny[k] * (track.hwL[k] + 8)]; if (i === cn.from) gravel.moveTo(p[0], p[1]); else gravel.lineTo(p[0], p[1]); }
      for (let i = cn.to; i >= cn.from; i -= 2) { const k = ((i % N) + N) % N; gravel.lineTo(xs[k] - nx[k] * (track.hwR[k] + 8), ys[k] - ny[k] * (track.hwR[k] + 8)); }
      gravel.closePath();
      return { left: l, right: r, gravel, kerbA, kerbB, kerbEdge, bbox: { minX: minX - 30, minY: minY - 30, maxX: maxX + 30, maxY: maxY + 30 } };
    });

    const bridges = track.crossings.map(cr => {
      const p = new Path2D();
      for (let i = cr.over - 16; i <= cr.over + 20; i += 2) { const k = (i + N) % N; if (i === cr.over - 16) p.moveTo(xs[k], ys[k]); else p.lineTo(xs[k], ys[k]); }
      return p;
    });

    const lines = {};
    for (const name of LINE_NAMES) {
      const p = new Path2D(), lat = track.lines[name];
      for (let i = 0; i < N; i += STEP) { const x = xs[i] + nx[i] * lat[i], y = ys[i] + ny[i] * lat[i]; if (i === 0) p.moveTo(x, y); else p.lineTo(x, y); }
      p.closePath();
      lines[name] = p;
    }

    /* Les mêmes tracés, mais en tronçons.

    Un circuit fait plusieurs kilomètres et la caméra en montre cinquante mètres. Dessiner la
    piste entière à chaque image fait traiter au rasteriseur des milliers de segments dont
    quatre-vingt-dix-neuf pour cent tombent hors de l'écran — mesuré, c'était le premier poste de
    dépense du rendu. Chaque tronçon porte sa boîte englobante et n'est dessiné que s'il est en
    vue.

    Les tronçons se chevauchent d'un pas : sans cela, une ligne claire apparaît entre deux, le
    rasteriseur n'ayant rien à quoi raccorder les bords. Et le liséré sombre de la piste est
    obtenu en traçant ses deux bords plutôt que le contour du ruban : découper le ruban ferait
    apparaître le liséré en travers de la route à chaque raccord. */
    const CHUNK = 48;                       // indices par tronçon, soit une soixantaine de mètres
    const chunks = [];
    for (let a = 0; a < N; a += CHUNK) {
      const fill = new Path2D(), lp = new Path2D(), rp = new Path2D(), mp = new Path2D();
      const b = Math.min(a + CHUNK + STEP, N + STEP - 1);   // un pas de chevauchement
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = a; i <= b; i += STEP) {
        const q = edgePt(i, 1);
        if (i === a) { fill.moveTo(q[0], q[1]); lp.moveTo(q[0], q[1]); } else { fill.lineTo(q[0], q[1]); lp.lineTo(q[0], q[1]); }
        minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]);
      }
      for (let i = b; i >= a; i -= STEP) {
        const q = edgePt(i, -1);
        fill.lineTo(q[0], q[1]);
        if (i === b) rp.moveTo(q[0], q[1]); else rp.lineTo(q[0], q[1]);
        minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]);
      }
      fill.closePath();
      for (let i = a; i <= b; i += STEP) {
        const k = ((i % N) + N) % N, off = (track.hwL[k] - track.hwR[k]) / 2;
        const x = xs[k] + nx[k] * off, y = ys[k] + ny[k] * off;
        if (i === a) mp.moveTo(x, y); else mp.lineTo(x, y);
      }
      /* Les bords teintés : dedans ou dehors.

      Les lignes blanches de part et d'autre de la piste ne disaient rien. Elles portent maintenant
      le côté du virage — froid vers l'intérieur, chaud vers l'extérieur — avec les couleurs mêmes
      du curseur de ligne, pour que le lien se fasse sans légende.

      Chaque bord est donc découpé en tronçons selon `track.sens`, et non teinté d'un bloc : un
      raccord de soixante mètres traverse parfois un changement de main, et le colorer d'une seule
      couleur mentirait sur la moitié de sa longueur. Le point de bascule est repris dans les deux
      tronçons, faute de quoi un trou blanc apparaîtrait entre eux. */
      const eIn = new Path2D(), eOut = new Path2D();
      for (const side of [1, -1]) {
        let dedansAvant = null;
        for (let i = a; i <= b; i += STEP) {
          const k = ((i % N) + N) % N;
          const dedans = side > 0 ? track.sens[k] > 0 : track.sens[k] < 0;
          const q = edgePt(i, side);
          const cible = dedans ? eIn : eOut;
          if (dedans !== dedansAvant) {
            if (dedansAvant !== null) {              // rattacher au point de bascule
              const autre = dedansAvant ? eIn : eOut;
              autre.lineTo(q[0], q[1]);
            }
            cible.moveTo(q[0], q[1]);
            dedansAvant = dedans;
          } else cible.lineTo(q[0], q[1]);
        }
      }
      chunks.push({ fill, left: lp, right: rp, mid: mp, edgeIn: eIn, edgeOut: eOut,
                    bbox: { minX: minX - 12, minY: minY - 12, maxX: maxX + 12, maxY: maxY + 12 } });
    }

    /* La voie des stands, dessinée à partir de la même géométrie que celle qu'on roule.

    Rien n'est redessiné à la main : `track.pitAt` donne l'axe de la voie et son engagement à
    chaque abscisse, et le contour s'en déduit. C'est ce qui garantit que ce qu'on voit est
    exactement ce qui se pilote — une voie peinte à part aurait dérivé de la voie réelle au premier
    changement de réglage, et le joueur aurait visé un couloir qui n'est pas là.

    La largeur suit l'engagement : les deux bretelles s'ouvrent depuis le bord de piste au lieu
    d'apparaître d'un coup à pleine largeur. */
    const pit = track.pit ? (() => {
      const p = track.pit, span = track.wrap(p.sortie - p.entree), PAS = 2;
      const pts = [];
      for (let d = 0; d <= span; d += PAS) {
        const s = track.wrap(p.entree + d);
        const z = track.pitAt(s);
        if (z) pts.push({ s, interne: z.interne, externe: z.externe, lat: z.lat, d });
      }
      if (pts.length < 4) return null;
      const surface = new Path2D(), ligne = new Path2D(), zone = new Path2D();
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const voir = (q) => { minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y); };
      pts.forEach((q, i) => {
        const a = track.pos(q.s, q.interne);
        if (i === 0) { surface.moveTo(a.x, a.y); ligne.moveTo(a.x, a.y); } else { surface.lineTo(a.x, a.y); ligne.lineTo(a.x, a.y); }
        voir(a);
      });
      for (let i = pts.length - 1; i >= 0; i--) {
        const q = pts[i], b = track.pos(q.s, q.externe);
        surface.lineTo(b.x, b.y); voir(b);
      }
      surface.closePath();
      // la zone d'arrêt, peinte au sol : c'est elle qui dit où s'immobiliser
      const dansZone = pts.filter((q) => { const z = track.pitAt(q.s); return z && z.dansZone; });
      if (dansZone.length > 1) {
        dansZone.forEach((q, i) => {
          const a = track.pos(q.s, q.interne);
          if (i === 0) zone.moveTo(a.x, a.y); else zone.lineTo(a.x, a.y);
        });
        for (let i = dansZone.length - 1; i >= 0; i--) {
          const q = dansZone[i], b = track.pos(q.s, q.externe);
          zone.lineTo(b.x, b.y);
        }
        zone.closePath();
      }
      /* Les garages, posés à l'extérieur de la voie.

      L'image de Bruno est une rangée vue de dessus : l'auvent en haut, la zone balisée en bas.
      Le bas doit donc faire face à la voie. La rotation qui y arrive est `cap + π`, et PAS une
      symétrie : une symétrie aurait retourné les enseignes des garages avec le reste du dessin.
      La rangée se lit alors à l'envers du sens de marche, ce qui ne se voit pas sur une rangée de
      boxes et vaut mieux que des logos en miroir. */
      /* Trois rangées mises bout à bout, et plus petites qu'au premier essai.

      À vingt-six mètres la rangée occupait un quart de l'écran et écrasait tout : le dessin de
      Bruno est fin et détaillé là où le reste du jeu est plat et large, donc à taille égale c'est
      lui qu'on regarde au lieu de la piste. Réduit à seize mètres pour quatre boxes — quatre
      mètres chacun — il redevient du décor. */
      const garages = [];
      const LARGE = 16, PROF = LARGE * 429 / 1310;
      for (const dec of [-LARGE, 0, LARGE]) {
        const s = track.wrap(p.boite + dec);
        const z = track.pitAt(s);
        if (!z) continue;
        const c = track.pos(s, z.externe - PROF / 2);
        garages.push({ x: c.x, y: c.y, a: track.headingAt(s) + Math.PI, w: LARGE, h: PROF });
        voir({ x: c.x - PROF, y: c.y - PROF }); voir({ x: c.x + PROF, y: c.y + PROF });
      }
      return { surface, ligne, zone, garages, bbox: { minX: minX - 16, minY: minY - 16, maxX: maxX + 16, maxY: maxY + 16 } };
    })() : null;

    this.paths = { center, mid, road, left, right, corners, bridges, lines, chunks, pit };
    this.pitImg = null;
    if (pit) { const im = new Image(); im.onload = () => { this.pitImg = im; }; im.src = 'art/Pitstop.png'; }
    this.bgImage = null;
    if (track.image && track.image.src) {
      const img = new Image();
      img.onload = () => { this.bgImage = img; };
      img.src = track.image.src;
    }
    this._makeMinimap();
    this.grassPattern = this.ctx.createPattern(this.grass, 'repeat');
  }

  _makeMinimap() {
    const T = this.track, b = T.bounds;
    const size = Math.min(180, Math.max(110, this.w * 0.18));
    const c = document.createElement('canvas');
    c.width = c.height = size * this.dpr;
    const g = c.getContext('2d');
    g.scale(this.dpr, this.dpr);
    const w = b.maxX - b.minX, h = b.maxY - b.minY;
    const sc = (size - 20) / Math.max(w, h);
    const ox = 10 + ((size - 20) - w * sc) / 2, oy = 10 + ((size - 20) - h * sc) / 2;
    this.mm = { canvas: c, size, sc, ox, oy };
    g.translate(ox, oy); g.scale(sc, sc); g.translate(-b.minX, -b.minY);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 9 / sc; g.stroke(this.paths.center);
    g.strokeStyle = '#e8e8ec'; g.lineWidth = 4 / sc; g.stroke(this.paths.center);
    const p0 = T.pos(0, 0);
    g.fillStyle = '#ffd400'; g.beginPath(); g.arc(p0.x, p0.y, 4 / sc, 0, 7); g.fill();
  }

  mmPoint(x, y) {
    const b = this.track.bounds, m = this.mm;
    return { x: m.ox + (x - b.minX) * m.sc, y: m.oy + (y - b.minY) * m.sc };
  }

  updateCamera(race, dt) {
    const p = race.player, T = race.track, pos = p.pos;
    const h = T.headingAt(p.s);
    const vf = Math.min(1, p.v / p.cls.vmax);
    // Frame a fixed distance rather than a fixed area, so a portrait phone and a desktop window
    // show the same thing. Track-aligned: metres visible ahead, down the screen height.
    // Fixed north-up: metres across the shorter screen axis.
    //
    // Twenty metres at a standstill, fifty at the car's own top speed. The camera therefore does
    // most of the work the player used to do by hand: close enough on the grid to see the car,
    // and far enough at speed to see what is coming. It reads the speed as a fraction of THIS
    // car's maximum, so a slow GT and a fast prototype both get the full range — which is also
    // why the per-category zoom factor is gone, it was solving the same problem twice.
    const near = this.rotate ? 30 : this.tilt === 1 ? 20 : 16;
    const far = this.rotate ? 75 : this.tilt === 1 ? 50 : 40;
    const metres = (near + (far - near) * vf) * this.pullBack;
    const zoomTarget = (this.rotate ? this.h : Math.min(this.w, this.h)) / metres;
    this.framing = metres;           // what the screen actually shows, in metres
    // How far ahead of the car the camera looks, tied to the frame rather than to a fixed number
    // of metres: what matters is where the car sits on screen, and that only means something
    // relative to what the screen shows. Nothing at a standstill — the car stays centred on the
    // grid — up to half the frame at top speed, which puts it a quarter of the way down.
    const lead = metres * 0.5 * vf;
    const tx = pos.x + Math.cos(h) * lead, ty = pos.y + Math.sin(h) * lead;
    // camera heading follows the slot direction (not the car body), so a drift never spins the view
    const want = T.headingAt(p.s + lead * 0.6);
    if (!this.cam.init) this.camAngle = want;
    else {
      let da = want - this.camAngle;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      this.camAngle += da * Math.min(1, dt * 3.5);
    }
    const k = Math.min(1, dt * 4);
    if (this.cam.init) {
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
      this.cam.zoom += (zoomTarget - this.cam.zoom) * Math.min(1, dt * 1.5);
    } else { this.cam.x = tx; this.cam.y = ty; this.cam.zoom = zoomTarget; this.cam.init = true; }
  }

  // How far back the camera sits, on top of the speed. 1 is the framing above; higher widens it.
  // There is no way to go closer: twenty metres on the grid is already as close as the game is
  // meant to be, and the only thing worth offering is room for someone who wants to see more.
  setPullBack(v) {
    this.pullBack = clamp(+v || 1, 1, 2);
    return this.pullBack;
  }

  // A puff of smoke: one soft ball that grows and thins as it drifts. Several at once make the
  // cloud, which is how a cartoon draws smoke — not one blob but a bunch of round ones.
  _puff(x, y, vx, vy, r, life, col) {
    if (this.particles.length > 240) return;      // a cloud, never a fog bank over the whole road
    this.particles.push({ x, y, vx, vy, r, grow: r * 1.1, life, life0: life, col });
  }

  addEffects(race, dt) {
    for (const car of race.cars) {
      const pos = car.pos, h = car.heading, c = car.cls;
      const cs = Math.cos(h), sn = Math.sin(h), lx = Math.cos(h + Math.PI / 2), ly = Math.sin(h + Math.PI / 2);
      // the two rear contact patches, where everything a tyre does happens
      const wheel = (w) => [pos.x - cs * c.length * 0.35 + lx * w * c.width * 0.4, pos.y - sn * c.length * 0.35 + ly * w * c.width * 0.4];
      // Which way the smoke is thrown: the tail is stepping out one way, so the rubber goes the
      // other. `beta` is the angle between where the car points and where it is really going.
      const side = Math.sign(car.beta) || 1;

      if (car.slide > 0.15 && car.state === 'ok' && car.v > 5) {
        for (const w of [-1, 1]) {
          const b = wheel(w);
          this._layRubber(b[0], b[1], h, car.v * dt * 1.2 + 0.3, car.slide);
        }
        // Tyre smoke: round puffs thrown out behind the car, one or two a frame. A cartoon draws
        // smoke as a handful of distinct balls, so they have to stay few enough to be told apart —
        // past that they merge into one grey sheet and the car disappears into it.
        const n = (Math.random() < 0.55 + car.slide * 0.6 ? 1 : 0) + (car.slide > 0.55 && Math.random() < 0.45 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const b = wheel(Math.random() < 0.5 ? -1 : 1);
          this._puff(
            b[0] - cs * 0.7 + (Math.random() - 0.5) * 1.1, b[1] - sn * 0.7 + (Math.random() - 0.5) * 1.1,
            -cs * (1 + car.v * 0.1) - side * lx * (1 + Math.random() * 2) + (Math.random() - 0.5) * 1.2,
            -sn * (1 + car.v * 0.1) - side * ly * (1 + Math.random() * 2) + (Math.random() - 0.5) * 1.2,
            // sizes spread wide on purpose: a row of equal balls reads as a caterpillar, not smoke
            0.38 + car.slide * 0.5 + Math.random() * 0.55, 0.6 + car.slide * 0.5, '222,222,226');
        }
      }
      // Wheelspin. Flat out at low speed the rear tyres are asked for more than they can hold, and
      // the smoke is the proof: thickest off the line, gone once the car is really moving.
      if (car.throttle && car.state === 'ok' && car.v < c.vmax * 0.3) {
        const spin = Math.max(0, 1 - car.v / (c.vmax * 0.3));
        if (Math.random() < spin * 0.85) {
          const b = wheel(Math.random() < 0.5 ? -1 : 1);
          this._puff(
            b[0] - cs * 0.8 + (Math.random() - 0.5) * 0.5, b[1] - sn * 0.8 + (Math.random() - 0.5) * 0.5,
            -cs * (1.2 + Math.random() * 2) + (Math.random() - 0.5) * 1.6,
            -sn * (1.2 + Math.random() * 2) + (Math.random() - 0.5) * 1.6,
            0.4 + spin * 0.55 + Math.random() * 0.2, 0.5 + spin * 0.45, '228,226,230');
        }
      }
      if (car.state === 'grass') {
        for (let i = 0; i < 2; i++) this._puff(pos.x + (Math.random() - 0.5) * 3, pos.y + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, 1.2, 0.9, '190,160,110');
      }
      this._water(car, pos, h, cs, sn, wheel, dt);
    }
    if (this.wets.length > 700) this.wets.splice(0, this.wets.length - 700);
    for (const w of this.wets) w.alpha -= dt * 0.1;
    if (this.wets.length && this.wets[0].alpha <= 0) this.wets = this.wets.filter(w => w.alpha > 0);
    for (const p of this.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx -= p.vx * dt * 1.4; p.vy -= p.vy * dt * 1.4;      // the air stops it quickly
      p.life -= dt;
      p.r += (p.grow == null ? 1.5 : p.grow) * dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  /* Rubber on the road, kept for the whole race.

  Skid marks used to be a flat list of segments, each stroked on its own and the oldest thrown away
  past nine hundred — about half a lap of a ten-car race, so the first corner was clean again by
  the time anyone came back round to it. Rubber does not disappear, so now nothing is thrown away.

  Keeping tens of thousands of little strokes affordable takes two things. They go into **one path
  per patch of ground**, so a patch costs one stroke however much rubber is on it; and the patches
  carry a bounding box, so only the handful under the camera is drawn at all. The screen shows
  about fifty metres, a lap is three thousand, so on any frame that is a few patches out of the
  fifty or so a race at Monza ends up with — sixty frames a second start to finish, measured.

  Three shades rather than a value per mark, because a path is stroked at one opacity: a light
  scuff, a proper slide, and a lock-up. Marks in the same patch and the same shade join one path,
  which also means driving the same line twice does not darken it — rubber builds up on a real
  track, but a mark that doubles every lap ends up a black hole.
  */
  _layRubber(x, y, a, l, slide) {
    const CELL = 40;
    const band = slide > 0.62 ? 2 : slide > 0.34 ? 1 : 0;
    const key = Math.floor(x / CELL) + ',' + Math.floor(y / CELL) + ',' + band;
    let p = this.rubber.get(key);
    if (!p) { p = { path: new Path2D(), band, minX: x, maxX: x, minY: y, maxY: y }; this.rubber.set(key, p); }
    const x2 = x - Math.cos(a) * l, y2 = y - Math.sin(a) * l;
    p.path.moveTo(x, y); p.path.lineTo(x2, y2);
    p.minX = Math.min(p.minX, x, x2); p.maxX = Math.max(p.maxX, x, x2);
    p.minY = Math.min(p.minY, y, y2); p.maxY = Math.max(p.maxY, y, y2);
  }

  _drawRubber(g, vis) {
    if (!this.rubber.size) return;
    g.strokeStyle = '#141414'; g.lineWidth = 0.35; g.lineCap = 'butt';
    for (const p of this.rubber.values()) {
      if (p.maxX < vis.minX || p.minX > vis.maxX || p.maxY < vis.minY || p.minY > vis.maxY) continue;
      g.globalAlpha = Renderer.RUBBER[p.band];
      g.stroke(p.path);
    }
    g.globalAlpha = 1; g.lineCap = 'round';
  }

  // a scuff, a slide, a lock-up
  static get RUBBER() { return [0.13, 0.26, 0.42]; }

  // Standing water. Clip a puddle and the car throws up spray and takes the water with it: wet
  // tyres print a dark track on dry tarmac for a few dozen metres, until there is none left.
  _water(car, pos, h, cs, sn, wheel, dt) {
    if (!this.puddles || !this.puddles.length) return;
    const d = this.damp.get(car) || { left: 0, acc: 0 };
    if (car.v > 2) {
      for (const q of this.puddles) {
        const dx = pos.x - q.x, dy = pos.y - q.y;
        const reach = q.r * q.long + car.cls.width * 0.5;
        if (dx * dx + dy * dy > reach * reach) continue;
        d.left = Math.max(d.left, 24 + car.v * 0.5);         // metres of road it will still mark
        const n = 1 + Math.floor(Math.min(4, car.v / 12));
        for (let i = 0; i < n; i++) {
          const w = Math.random() < 0.5 ? -1 : 1, b = wheel(w);
          this._puff(b[0], b[1],
            -cs * car.v * 0.25 + Math.cos(h + w * Math.PI / 2) * (2 + Math.random() * 4),
            -sn * car.v * 0.25 + Math.sin(h + w * Math.PI / 2) * (2 + Math.random() * 4),
            0.35 + Math.random() * 0.4, 0.45, '188,214,232');
        }
        break;
      }
    }
    if (d.left <= 0) { this.damp.delete(car); return; }
    // A track is laid by the metre, not by the frame: at two hundred an hour a frame is three
    // metres and at walking pace a few centimetres, and marking both the same way would either
    // leave the trail in dashes or fill the list with specks nobody can see.
    const run = Math.max(0, car.v) * dt;
    d.left -= run;
    d.acc += run;
    const STEP = 0.9;
    if (d.acc >= STEP) {
      const l = Math.min(4, d.acc);
      d.acc = 0;
      for (const w of [-1, 1]) {
        const b = wheel(w);
        this.wets.push({ x: b[0], y: b[1], a: h, l: l + 0.15, alpha: Math.min(0.5, d.left / 40) });
      }
    }
    if (d.left > 0) this.damp.set(car, d); else this.damp.delete(car);
  }

  // ---------- main draw ----------
  draw(race, ui) {
    this._adapt(performance.now());
    // la voie ne se dessine que quand elle sert : une voie peinte qui ne mène à rien est pire
    // qu'une voie absente, on la vise et il ne se passe rien
    this.showPit = !!race.usure;
    /* Le côté du levier est lu ici, et un changement refait la mise en page tout de suite.
    Le poser seulement au démarrage d'une course obligerait à en relancer une pour voir l'effet du
    réglage, ce qui est la façon la plus sûre de faire croire qu'un réglage ne marche pas. */
    const cote = (ui && ui.app && ui.app.save && ui.app.save.ctrlSide) === 'right' ? 'right' : 'left';
    if (cote !== this.ctrlSide) { this.ctrlSide = cote; this._layoutHud(); }
    const g = this.ctx, W = this.w, H = this.h, T = race.track, cam = this.cam;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    let sx = 0, sy = 0;
    if (this.shake > 0) { sx = (Math.random() - 0.5) * this.shake * 8; sy = (Math.random() - 0.5) * this.shake * 8; }

    g.save();
    g.translate(W / 2 + sx, H / 2 + sy);
    // An orthographic camera tilted about the screen's horizontal axis, looking at a flat track,
    // is exactly a vertical squash of the top-down view. tilt = cos(angle from vertical).
    if (this.tilt !== 1) g.scale(1, this.tilt);
    if (this.rotate) g.rotate(-this.camAngle - Math.PI / 2);
    g.scale(cam.zoom, cam.zoom);
    g.translate(-cam.x, -cam.y);
    // conservative square view box: valid whatever the camera rotation
    const reach = Math.hypot(W, H) / 2 / cam.zoom / this.tilt + 60;
    const vis = { minX: cam.x - reach, maxX: cam.x + reach, minY: cam.y - reach, maxY: cam.y + reach };
    const inView = (b) => !(b.maxX < vis.minX || b.minX > vis.maxX || b.maxY < vis.minY || b.minY > vis.maxY);

    // background
    if (this.bgImage) {
      g.fillStyle = '#3b4a2f'; g.fillRect(vis.minX, vis.minY, vis.maxX - vis.minX, vis.maxY - vis.minY);
      const sc = T.unitScale;
      g.imageSmoothingEnabled = true;
      g.drawImage(this.bgImage, 0, 0, this.bgImage.naturalWidth * sc, this.bgImage.naturalHeight * sc);
    } else {
      g.fillStyle = this.grassPattern;
      g.save(); g.scale(1 / 8, 1 / 8); g.fillRect(vis.minX * 8, vis.minY * 8, (vis.maxX - vis.minX) * 8, (vis.maxY - vis.minY) * 8); g.restore();
      this._drawPatches(g, vis);
      this._drawSea(g, vis);
    }

    g.lineCap = 'round'; g.lineJoin = 'round';
    if (T.drawRoad) {
      // gravel traps first, then the road itself with a heavy dark outline: the cartoon look
      // comes from flat colours and hard edges rather than shading
      for (const cn of this.paths.corners) { if (!inView(cn.bbox)) continue; g.fillStyle = PAL.gravel; g.fill(cn.gravel); }
      // Seuls les tronçons en vue : la caméra montre une cinquantaine de mètres d'un circuit qui
      // en fait des milliers, et tout le reste ne sert qu'à occuper le rasteriseur.
      const vus = this.paths.chunks.filter(c => inView(c.bbox));
      g.strokeStyle = PAL.outline; g.lineWidth = 3.6;
      for (const c of vus) { g.stroke(c.left); g.stroke(c.right); }
      g.fillStyle = PAL.asphalt;
      for (const c of vus) g.fill(c.fill);
      // kerbs, laid over the road's dark outline so the band reads as one crisp edge
      g.save();
      g.lineJoin = 'miter'; g.lineCap = 'butt'; g.miterLimit = 3;
      for (const cn of this.paths.corners) {
        if (!inView(cn.bbox)) continue;
        g.fillStyle = PAL.kerbA; g.fill(cn.kerbA);
        g.fillStyle = PAL.kerbB; g.fill(cn.kerbB);
        g.strokeStyle = PAL.outline; g.lineWidth = 0.34; g.stroke(cn.kerbEdge);
      }
      g.restore();
      // painted markings: the edges say which side of the corner they are, dashed yellow down the middle
      g.lineWidth = 0.55;
      g.strokeStyle = PAL.edgeIn || PAL.edgeLine;
      for (const c of vus) g.stroke(c.edgeIn);
      g.strokeStyle = PAL.edgeOut || PAL.edgeLine;
      for (const c of vus) g.stroke(c.edgeOut);
      if (PAL.centre) {
        g.setLineDash([2.6, 3.4]);
        g.strokeStyle = PAL.centre; g.lineWidth = 0.42;
        for (const c of vus) g.stroke(c.mid);
      }
      g.setLineDash([]);

      /* La voie des stands, par-dessus l'asphalte et sous les voitures.

      Elle n'est dessinée que quand l'option d'usure est active : une voie peinte qui ne mène à
      rien est pire qu'une voie absente — on la vise, on y perd dix secondes, et rien ne se passe.

      Le bord côté piste est une ligne CONTINUE, comme sur un vrai circuit : c'est la convention
      qui dit « on ne franchit pas ça », et elle se lit sans légende. */
      const vp = this.paths.pit;
      if (vp && this.showPit && inView(vp.bbox)) {
        g.strokeStyle = PAL.outline; g.lineWidth = 2.6; g.stroke(vp.surface);
        g.fillStyle = PAL.pitLane || '#3a3a44'; g.fill(vp.surface);
        // la zone d'arrêt : un pavé plus clair, bordé, qu'on repère en arrivant
        g.fillStyle = PAL.pitBox || 'rgba(255,212,0,0.16)'; g.fill(vp.zone);
        g.strokeStyle = PAL.pitBoxLine || '#ffd400'; g.lineWidth = 0.5; g.stroke(vp.zone);
        g.strokeStyle = PAL.edgeLine; g.lineWidth = 0.5; g.stroke(vp.ligne);
        if (this.pitImg) {
          for (const gr of vp.garages) {
            g.save();
            g.translate(gr.x, gr.y); g.rotate(gr.a);
            g.drawImage(this.pitImg, -gr.w / 2, -gr.h / 2, gr.w, gr.h);
            g.restore();
          }
        }
      }
    }
    if (this.showLines) this._drawGuide(g, race);
    this._drawStartLine(g, T);
    this._drawBoards(g, T, vis);
    // Rubber first, then the water on top of it: a puddle covers what is under it, and a car does
    // not lay rubber across standing water.
    this._drawRubber(g, vis);
    this._drawPuddles(g, vis);
    // the damp a car carries out of a puddle: two tracks, fading as the water runs out
    g.strokeStyle = PAL.wet; g.lineCap = 'butt';
    g.lineWidth = 0.5;
    for (const w of this.wets) {
      g.globalAlpha = Math.max(0, w.alpha);
      g.beginPath(); g.moveTo(w.x, w.y); g.lineTo(w.x - Math.cos(w.a) * w.l, w.y - Math.sin(w.a) * w.l); g.stroke();
    }
    g.globalAlpha = 1; g.lineCap = 'round';
    if (T.drawRoad) for (const b of this.paths.bridges) {
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = T.width + 5; g.stroke(b);
      g.strokeStyle = '#2f2f36'; g.lineWidth = T.width + 2.4; g.stroke(b);
      g.strokeStyle = '#4b4b52'; g.lineWidth = T.width; g.stroke(b);
    }
    // Smoke, under the cars. A puff fades over its own life rather than over a fixed second, so a
    // big slow one stays up as long as it is meant to; and it thins as it grows, the way a cloud
    // does. Drawn before the cars, because a car swallowed by its own smoke is a car the driver
    // has lost sight of.
    for (const p of this.particles) {
      const t = p.life0 ? Math.max(0, p.life) / p.life0 : Math.max(0, p.life);
      g.fillStyle = `rgba(${p.col},${(Math.min(1, t * 2.5) * 0.42).toFixed(3)})`;
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
    }
    if (this.tilt === 1) {
      this._drawTopProps(g, vis);
      const order = race.cars.slice().sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0));
      for (const car of order) this._drawCar(g, car);
    } else {
      // tilted: whatever sits lower on screen is nearer, cars and scenery alike
      const items = [];
      for (const car of race.cars) items.push({ y: car.pos.y, car });
      for (const p of this.props || []) {
        if (p.x < vis.minX - 30 || p.x > vis.maxX + 30 || p.y < vis.minY - 30 || p.y > vis.maxY + 30) continue;
        items.push({ y: p.y, prop: p });
      }
      items.sort((a, b) => a.y - b.y);
      for (const it of items) { if (it.car) this._drawCar(g, it.car); else this._drawProp(g, it.prop); }
    }
    g.restore();

    this._drawHUD(g, race, ui);
  }

  // Optional braking guide (off by default): the ribbon ahead is coloured by the reference speed
  // profile (green where the car can be flat out, red for a slow corner) and a transverse bar marks
  // where braking must start at the current speed. No driving lines are drawn on the road.
  _drawGuide(g, race) {
    const T = race.track, p = race.player;
    const ahead = 240, step = 4, vmax = p.cls.vmax;

    // selected line ahead, in three colour runs by reference speed
    const pt = (d) => { const i = T.idx(p.s + d), lat = T.targetLat(p.s + d, p.selS); return [T.xs[i] + T.nx[i] * lat, T.ys[i] + T.ny[i] * lat]; };
    const runs = { '#5be07a': [], '#ffd23f': [], '#ff6b4b': [] };
    let prev = pt(0);
    for (let d = step; d <= ahead; d += step) {
      const now = pt(d);
      const r = race.profileAt(p.s + d - step / 2, p.selS) / vmax;
      runs[r > 0.88 ? '#5be07a' : r > 0.62 ? '#ffd23f' : '#ff6b4b'].push([prev, now]);
      prev = now;
    }
    g.lineCap = 'round';
    for (const col of ['#5be07a', '#ffd23f', '#ff6b4b']) {
      const segs = runs[col];
      if (!segs.length) continue;
      const path = new Path2D();
      for (const [a, b] of segs) { path.moveTo(a[0], a[1]); path.lineTo(b[0], b[1]); }
      g.globalAlpha = 0.16; g.strokeStyle = col; g.lineWidth = 2.4; g.stroke(path);
      g.globalAlpha = 0.7; g.lineWidth = 0.5; g.stroke(path);
    }
    g.globalAlpha = 1;

    // braking point: the distance at which the most demanding corner ahead forces a lift
    const brake = p.cls.brake * 0.9, v2 = p.v * p.v;
    let slack = Infinity;
    for (let d = 0; d <= ahead; d += step) {
      const vp = race.profileAt(p.s + d, p.selS);
      if (vp * vp >= v2) continue;
      const need = (v2 - vp * vp) / (2 * brake);
      if (d - need < slack) slack = d - need;
    }
    if (slack === Infinity || slack > 180) return;
    const at = Math.max(4, slack);   // never sit on top of the car
    const i = T.idx(p.s + at), lat = T.targetLat(p.s + at, p.selS);
    const x = T.xs[i] + T.nx[i] * lat, y = T.ys[i] + T.ny[i] * lat;
    const late = slack <= 0;
    const col = late ? '#ff4b4b' : slack < 25 ? '#ffd23f' : '#f2f2f2';
    const w = 2.6, th = T.th[i];
    g.save(); g.translate(x, y); g.rotate(th);
    g.globalAlpha = late ? 0.6 + 0.4 * Math.sin(performance.now() / 90) : 0.9;
    g.fillStyle = col; g.fillRect(-0.3, -w, 0.6, w * 2);
    g.globalAlpha = 1; g.restore();
  }

  // Braking boards, painted flat on the ground beside the track like everything else in this
  // view. Each one gives the distance to the corner and, above it, an arrow bent to the corner's
  // severity and pointing the way it turns — the rally idea, where one glance tells you both how
  // far and how hard. The panel is turned with the track, so it reads upright as you arrive.
  _drawBoards(g, T, vis) {
    const boards = T.boards;
    if (!boards || !boards.length) return;
    const W = 5.2, H = 6.4, r = 0.6, specs = Renderer.ARROWS;
    for (const b of boards) {
      if (b.x < vis.minX - 12 || b.x > vis.maxX + 12 || b.y < vis.minY - 12 || b.y > vis.maxY + 12) continue;
      const spec = specs[b.kind && b.kind !== 'normal' ? b.kind : b.grade] || specs[3];
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.th + Math.PI / 2);      // the panel's top points the way the track goes
      g.beginPath();
      if (g.roundRect) g.roundRect(-W / 2, -H / 2, W, H, r);
      else g.rect(-W / 2, -H / 2, W, H);
      g.fillStyle = PAL.edgeLine; g.fill();
      g.lineWidth = 0.45; g.strokeStyle = PAL.outline; g.stroke();
      // In the panel's frame the driver's right is +x, and a positive curvature turns right, so
      // the arrow bends toward +x for a right-hander. (Checked against the road rather than
      // reasoned about: tools/arrow.js compares every drawn glyph with the bend it announces.)
      const dir = b.sign > 0 ? 1 : -1;
      Renderer.paceArrow(g, { x: 0, y: -H * 0.24, w: W * 0.78, h: H * 0.40 }, spec, dir);
      g.save();
      g.scale(1 / 16, 1 / 16);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = PAL.outline;
      g.font = 'bold 26px "Trebuchet MS", "DejaVu Sans", sans-serif';
      g.fillText(String(b.dist), 0, H * 0.30 * 16);
      if (spec.tag) {                    // the named corners say so, as on a pace-note chart
        g.fillStyle = spec.col;
        g.font = 'bold 16px "Trebuchet MS", "DejaVu Sans", sans-serif';
        g.fillText(spec.tag, 0, H * 0.06 * 16);
      }
      g.restore();
      g.restore();
    }
  }

  // The pace-note glyph: a straight stem that bends near its top, the way a rally co-driver's
  // chart draws it. How far it bends is the note — a 6 barely leans, a 1 folds well past square —
  // and the three named corners get their own shape: a square turns on a hard right angle, a
  // hairpin comes all the way round, an acute folds back on itself.
  static get ARROWS() {
    return {
      6: { stem: 2.0, bend: 20, r: 1.2, tail: 0.3, col: '#3aa65f' },
      5: { stem: 1.8, bend: 36, r: 1.1, tail: 0.3, col: '#63b845' },
      4: { stem: 1.6, bend: 56, r: 1.0, tail: 0.3, col: '#a2c637' },
      3: { stem: 1.4, bend: 80, r: 0.9, tail: 0.3, col: '#d0cd30' },
      2: { stem: 1.2, bend: 105, r: 0.8, tail: 0.3, col: '#e8bc32' },
      1: { stem: 1.0, bend: 135, r: 0.7, tail: 0.3, col: '#e08f2c' },
      square: { stem: 1.5, bend: 90, r: 0.16, tail: 1.0, col: '#dd7a28', tag: 'SQ' },
      hairpin: { stem: 0.9, bend: 180, r: 0.62, tail: 0.5, col: '#d85c26', tag: 'HP' },
      acute: { stem: 1.3, bend: 158, r: 0.14, tail: 1.1, col: '#c33b30', tag: 'AC' },
    };
  }

  // Builds the glyph, measures it, then fits it to the box it is given, so a hairpin and a kink
  // both fill the panel instead of one spilling over the edge and the other floating in the middle.
  static paceArrow(g, box, spec, dir) {
    const bend = spec.bend * Math.PI / 180;
    const a0 = dir > 0 ? Math.PI : 0, a1 = a0 + dir * bend;
    const cx = dir * spec.r, cy = -spec.stem;
    const path = [[0, 0], [0, -spec.stem]];
    const STEPS = 18;
    for (let i = 1; i <= STEPS; i++) {
      const a = a0 + (a1 - a0) * i / STEPS;
      path.push([cx + spec.r * Math.cos(a), cy + spec.r * Math.sin(a)]);
    }
    const te = a1 + dir * Math.PI / 2;                       // where the arrow ends up pointing
    const [px, py] = path[path.length - 1];
    const ex = px + Math.cos(te) * spec.tail, ey = py + Math.sin(te) * spec.tail;
    path.push([ex, ey]);
    // The head is a fixed size on the panel, not a fraction of the glyph: a kink and a hairpin are
    // drawn at very different scales, and a head that shrank with the glyph vanished on the open
    // notes, leaving a bar with no direction. Fitting therefore takes two passes — one to learn
    // the scale, one that knows how much room the head will take at that scale.
    const HLp = 0.95, HWp = 0.52;                            // head, in panel units
    const bbox = (pts) => {
      let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
      for (const [x, y] of pts) { a = Math.min(a, x); c = Math.max(c, x); b = Math.min(b, y); d = Math.max(d, y); }
      return [a, b, c, d];
    };
    const pad = 0.3;                                         // room for half the stroke either end
    const fit = (pts) => {
      const [a, b, c, d] = bbox(pts);
      return Math.min(box.w / (c - a + pad), box.h / (d - b + pad));
    };
    let sc = fit(path);
    const headAt = (k) => {
      const hl = HLp / k, hw = HWp / k;
      return [
        [ex + Math.cos(te) * hl, ey + Math.sin(te) * hl],
        [ex - Math.sin(te) * hw, ey + Math.cos(te) * hw],
        [ex + Math.sin(te) * hw, ey - Math.cos(te) * hw],
      ];
    };
    sc = fit(path.concat(headAt(sc)));
    const head = headAt(sc);
    const [minX, minY, maxX, maxY] = bbox(path.concat(head));

    g.save();
    g.translate(box.x - (minX + maxX) / 2 * sc, box.y - (minY + maxY) / 2 * sc);
    g.scale(sc, sc);
    g.strokeStyle = spec.col; g.fillStyle = spec.col;
    g.lineWidth = 0.42 / sc; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(path[0][0], path[0][1]);
    for (let i = 1; i < path.length; i++) g.lineTo(path[i][0], path[i][1]);
    g.stroke();
    g.beginPath();
    g.moveTo(head[0][0], head[0][1]);
    g.lineTo(head[1][0], head[1][1]);
    g.lineTo(head[2][0], head[2][1]);
    g.closePath(); g.fill();
    g.restore();
  }

  _drawStartLine(g, T) {
    const x = T.xs[0], y = T.ys[0], th = T.th[0];
    g.save(); g.translate(x, y); g.rotate(th);
    const hl = T.hwL[0], hr = T.hwR[0], n = 8, cell = (hl + hr) / n;
    for (let r = 0; r < 2; r++) for (let c = 0; c < n; c++) {
      g.fillStyle = (r + c) % 2 ? '#f5f5f5' : '#1a1a1a';
      g.fillRect(-cell + r * cell, -hl + c * cell, cell, cell);
    }
    g.restore();
  }

  // ---------- cars in the tilted view ----------
  // Two ways to give a car volume without a 3D engine. A model that ships a rotation sheet uses it:
  // the nearest view plus the leftover angle applied in the screen plane, scaled from the TRUE angle
  // so the car's width never jumps when the view changes. Anything else stacks its own top-down
  // drawing: under an orthographic tilt, the same flat shape at rising heights projects as that
  // shape shifted up the screen, which reads as a body and stays correct from every heading.

  _sheetFor(cls) {
    if (!cls.sheet) return null;
    let sh = this._sheets.get(cls.sheet);
    if (!sh) {
      sh = [];
      for (let i = 0; i < (cls.sheetN || 8); i++) { const im = new Image(); im.src = `${cls.sheet}/v${i}.png`; sh.push(im); }
      this._sheets.set(cls.sheet, sh);
    }
    return sh[0].complete && sh[0].naturalWidth ? sh : null;
  }

  // brightness levels baked once per model and livery: a canvas filter per draw costs a layer
  _stackTexFor(cls, livery, N) {
    const key = `${cls.id}|${livery.body}|${livery.trim}|${N}`;
    let tex = this._stacks.get(key);
    if (tex) return tex;
    const PPM = 26, w = Math.ceil(cls.length * PPM) + 8, h = Math.ceil(cls.width * PPM) + 8;
    tex = [];
    for (let i = 0; i < N; i++) {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const cg = cv.getContext('2d');
      cg.translate(w / 2, h / 2); cg.scale(PPM, PPM);
      cg.filter = `brightness(${(0.55 + 0.45 * (i / (N - 1))).toFixed(3)})`;
      drawCarModel(cg, cls, livery, { number: 0, steer: 0 });
      tex.push({ cv, w: w / PPM, h: h / PPM });
    }
    this._stacks.set(key, tex);
    return tex;
  }

  _carShadow(g, car) {
    const c = car.cls, pos = car.pos;
    g.save(); g.translate(pos.x, pos.y); g.rotate(car.heading);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(-c.length / 2, -c.width / 2, c.length, c.width);
    g.restore();
  }

  _playerRing(g, car) {
    const c = car.cls, pos = car.pos;
    g.save(); g.translate(pos.x, pos.y);
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 0.14;
    g.beginPath(); g.arc(0, 0, Math.max(c.length, c.width) * 0.8, 0, Math.PI * 2); g.stroke();
    g.restore();
  }

  _drawSheetCar(g, car, sheet) {
    const c = car.cls, pos = car.pos, N = sheet.length, step = Math.PI * 2 / N;
    // heading relative to where the camera looks from
    const camDir = this.rotate ? this.camAngle : -Math.PI / 2;
    let rel = car.heading - camDir;
    while (rel > Math.PI) rel -= 2 * Math.PI;
    while (rel < -Math.PI) rel += 2 * Math.PI;
    // Pick the view and stay on it. No leftover angle is applied on top: rotating an isometric
    // sprite in the screen plane makes the car visibly rock as its heading wanders, and the
    // rocking flips sign every time it crosses between two views. With views this close together
    // the quantisation is far less noticeable than the wobble was.
    // A little hysteresis on top, so a heading sitting on a boundary does not flicker.
    let k = Math.round(rel / step);
    if (car._sheetK != null) {
      let d = rel / step - car._sheetK;
      while (d > N / 2) d -= N;
      while (d < -N / 2) d += N;
      if (Math.abs(d) < 0.62) k = car._sheetK;      // close enough: keep the view we are on
    }
    car._sheetK = k;
    // sheetRear names the view where the car points straight away from the camera
    const img = sheet[(((c.sheetRear || 0) + k) % N + N) % N];
    if (!img.complete || !img.naturalWidth) { this._drawStackCar(g, car); return; }
    this._carShadow(g, car);
    if (car.isPlayer) this._playerRing(g, car);
    // A sheet rendered in a fixed frame states its own width in metres, so the scale is exact and
    // the same for every view. Otherwise fall back to the width a box of this car would cover,
    // which is all we can infer from a sheet cropped view by view.
    const fixed = c.sheetW > 0;
    const shown = k * step;            // the angle actually on screen, so the size never breathes
    const pw = fixed ? c.sheetW : (c.length * Math.abs(Math.sin(shown)) + c.width * Math.abs(Math.cos(shown))) * 1.06;
    const ax = fixed && c.sheetAnchor ? c.sheetAnchor[0] : 0.5;
    const ay = fixed && c.sheetAnchor ? c.sheetAnchor[1] : 0.82;
    const m = g.getTransform();
    const dx = m.a * pos.x + m.c * pos.y + m.e, dy = m.b * pos.x + m.d * pos.y + m.f;
    const wpx = pw * this.cam.zoom * this.dpr;
    const hpx = wpx * img.naturalHeight / img.naturalWidth;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.translate(dx, dy);
    g.imageSmoothingEnabled = false;   // the sheets are pixel art: keep the edges hard
    g.drawImage(img, -wpx * ax, -hpx * ay, wpx, hpx);
    g.imageSmoothingEnabled = true;
    g.restore();
  }

  _drawStackCar(g, car) {
    const c = car.cls, pos = car.pos, h = car.heading, tilt = this.tilt;
    const a = (this.rotate ? this.camAngle : -Math.PI / 2) + Math.PI / 2;
    const sinT = Math.sqrt(Math.max(0, 1 - tilt * tilt));
    const ux = Math.sin(a), uy = -Math.cos(a);      // screen-up, in world units, per metre of height
    const hCar = c.width * 0.62;
    // enough layers that they overlap on screen, or the sides come out striped; capped so a distant
    // car stays cheap, and rounded to a few values so the baked textures are reused
    const spread = hCar * sinT / tilt * this.cam.zoom;
    const N = clamp(Math.round(spread / 1.1 / 4) * 4, 8, 28);
    this._carShadow(g, car);
    if (car.isPlayer) this._playerRing(g, car);
    const tex = this._stackTexFor(c, car.livery, N);
    for (let i = 0; i < N; i++) {
      const tz = i / (N - 1);
      const lift = hCar * tz * sinT / tilt;
      const sc = 1 - 0.16 * tz * tz;                // slight taper: it reads as a body, not a brick
      const tx = tex[i];
      g.save();
      g.translate(pos.x + ux * lift, pos.y + uy * lift);
      g.rotate(h); g.scale(sc, sc);
      g.drawImage(tx.cv, -tx.w / 2, -tx.h / 2, tx.w, tx.h);
      g.restore();
    }
  }

  /* The bay, and what floats on it.

     Three bands rather than one flat blue: the open water, a paler shelf near the shore, and a
     thin line of surf where it meets the land. A single colour reads as a hole in the ground. */
  _drawSea(g, vis) {
    const w = this.water;
    if (!w) return;
    const b = w.bbox;
    if (b.maxX < vis.minX || b.minX > vis.maxX || b.maxY < vis.minY || b.minY > vis.maxY) return;
    const ring = (inner, outer) => {
      g.beginPath();
      g.moveTo(inner[0][0], inner[0][1]);
      for (let i = 1; i < inner.length; i++) g.lineTo(inner[i][0], inner[i][1]);
      for (let i = outer.length - 1; i >= 0; i--) g.lineTo(outer[i][0], outer[i][1]);
      g.closePath();
    };
    ring(w.inner, w.outer);
    g.fillStyle = PAL.sea; g.fill();
    // the shallow shelf: the shore line pushed a little way out to sea
    const shelf = w.inner.map(([x, y], i) => {
      const [ox, oy] = w.outer[i];
      const d = Math.hypot(ox - x, oy - y) || 1;
      return [x + (ox - x) / d * Math.min(16, d * 0.45), y + (oy - y) / d * Math.min(16, d * 0.45)];
    });
    ring(w.inner, shelf);
    g.fillStyle = PAL.seaShallow; g.fill();
    g.beginPath();
    g.moveTo(w.inner[0][0], w.inner[0][1]);
    for (let i = 1; i < w.inner.length; i++) g.lineTo(w.inner[i][0], w.inner[i][1]);
    g.strokeStyle = PAL.surf; g.lineWidth = 1.2; g.stroke();
    this._drawBoats(g, vis);
  }

  _drawBoats(g, vis) {
    const art = this.boatArt;
    if (!art) return;
    for (const bt of this.boats || []) {
      const a = art[bt.id];
      if (!a) continue;
      if (bt.x < vis.minX - 20 || bt.x > vis.maxX + 20 || bt.y < vis.minY - 20 || bt.y > vis.maxY + 20) continue;
      g.save();
      g.translate(bt.x, bt.y);
      g.rotate(bt.th);
      g.fillStyle = PAL.seaDeep;
      g.beginPath();
      g.ellipse(a.wm * 0.06, a.wm * 0.07, a.wm * 0.38, a.wm * 0.15, 0, 0, Math.PI * 2);
      g.fill();
      const m = g.getTransform();
      g.setTransform(1, 0, 0, 1, 0, 0);
      const sc = this.cam.zoom * this.dpr;
      g.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
      g.drawImage(a.canvas, -a.wm / 2, -a.wm / 2, a.wm, a.wm);
      g.restore();
    }
  }

  // Bare earth showing through the grass, as a circuit wears it away around its corners. Drawn
  // under the road, so the tarmac and its kerbs always sit on top of it.
  _drawPatches(g, vis) {
    for (const p of this.patches || []) {
      if (p.x < vis.minX - p.r || p.x > vis.maxX + p.r || p.y < vis.minY - p.r || p.y > vis.maxY + p.r) continue;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.a);
      g.fillStyle = p.dark ? PAL.earthDark : PAL.earth;
      g.beginPath();
      // a couple of overlapping ellipses read as one soft, irregular patch
      g.ellipse(0, 0, p.r, p.r * 0.62, 0, 0, Math.PI * 2);
      g.ellipse(p.r * 0.42, p.r * 0.16, p.r * 0.6, p.r * 0.44, 0.7, 0, Math.PI * 2);
      if (p.k > 1) g.ellipse(-p.r * 0.38, -p.r * 0.2, p.r * 0.52, p.r * 0.4, -0.5, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  // Standing water, drawn on top of the road and its markings — a puddle covers the white line, it
  // does not sit under it. Flat shapes and no gradient, like everything else here: the dark of the
  // water, a bright lip where the light catches the near edge, and a slick of sky caught inside.
  _drawPuddles(g, vis) {
    for (const q of this.puddles || []) {
      const reach = q.r * q.long + 1;
      if (q.x < vis.minX - reach || q.x > vis.maxX + reach || q.y < vis.minY - reach || q.y > vis.maxY + reach) continue;
      g.save();
      g.translate(q.x, q.y);
      g.rotate(q.th);
      g.scale(q.long, 1);
      // the lip first, as a slightly larger shape the water is then laid inside
      g.globalAlpha = q.onRoad ? 0.5 : 0.3;
      blob(g, 0, q.r * 0.06, q.r * 1.1, 9, PAL.puddleLight, 0.17, q.phase);
      g.globalAlpha = q.onRoad ? 0.92 : 0.72;
      blob(g, 0, 0, q.r, 9, PAL.puddle, 0.17, q.phase);
      g.globalAlpha = q.onRoad ? 0.55 : 0.4;
      blob(g, -q.r * 0.2, -q.r * 0.22, q.r * 0.42, 7, PAL.puddleLight, 0.22, q.phase + 1.7);
      g.restore();
    }
    g.globalAlpha = 1;
  }

  // Scenery for the flat view: objects drawn as a bird sees them, shadow baked in, no rotation —
  // a tree looks the same from every side, and turning it would only make it shimmer.
  _drawTopProps(g, vis) {
    const art = this.topArt;
    if (!art) return;
    for (const p of this.topProps || []) {
      const a = art[p.id];
      if (!a) continue;
      const half = a.wm / 2;
      if (p.x < vis.minX - half || p.x > vis.maxX + half || p.y < vis.minY - half || p.y > vis.maxY + half) continue;
      const m = g.getTransform();
      const dx = m.a * p.x + m.c * p.y + m.e, dy = m.b * p.x + m.d * p.y + m.f;
      const wpx = a.wm * this.cam.zoom * this.dpr;
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(a.canvas, dx - wpx / 2, dy - wpx / 2, wpx, wpx);
      g.restore();
    }
  }

  // A prop stands upright on the ground like a sheet car: its foot is at its world position and
  // its art rises from there up the screen. The sprites carry their own cast shadow, so nothing is
  // drawn under them.
  _drawProp(g, prop) {
    const art = this.propArt && this.propArt[prop.id];
    if (!art || !art.img.complete || !art.img.naturalWidth) return;
    const m = g.getTransform();
    const dx = m.a * prop.x + m.c * prop.y + m.e, dy = m.b * prop.x + m.d * prop.y + m.f;
    const wpx = art.wm * this.cam.zoom * this.dpr;
    const hpx = wpx * art.img.naturalHeight / art.img.naturalWidth;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.translate(dx, dy);
    g.imageSmoothingEnabled = false;
    g.drawImage(art.img, -wpx * art.anchor[0], -hpx * art.anchor[1], wpx, hpx);
    g.imageSmoothingEnabled = true;
    g.restore();
  }

  _drawCar(g, car) {
    const c = car.cls, pos = car.pos, h = car.heading;
    if (this.tilt !== 1) {
      const sheet = this._sheetFor(c);
      if (sheet) this._drawSheetCar(g, car, sheet);
      else this._drawStackCar(g, car);
      return;
    }
    g.save();
    g.translate(pos.x, pos.y);
    g.rotate(h);
    g.save();
    g.translate(0.25, 0.35);
    g.globalAlpha = 0.3;
    // a drawn car casts its own outline; a vector one only has a box to offer
    if (!drawCarShadow(g, c)) { g.globalAlpha = 1; g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-c.length / 2, -c.width / 2, c.length, c.width); }
    g.restore();
    drawCarModel(g, c, car.livery, { number: car.number, steer: car.steerAngle });
    if (car.braking && car.state === 'ok') { g.fillStyle = 'rgba(255,40,40,0.9)'; g.fillRect(-c.length / 2 - 0.15, -c.width / 2 + 0.1, 0.25, c.width - 0.2); }
    g.restore();
    if (car.isPlayer) {
      g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 0.14;
      g.beginPath(); g.arc(pos.x, pos.y, Math.max(c.length, c.width) * 0.8, 0, Math.PI * 2); g.stroke();
    }
  }

  _roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }

  // The accelerator, built like the SpotRacers control: a white pad that sits under the thumb, a
  // fan gauge running from a standstill to the car's top speed, and a white tab above it carrying
  // the speed in figures. Everything that has to be read sits above the hand.
  _drawDial(g, p, t) {
    const d = this.dial, cx = d.cx, cy = d.cy, r = d.r;
    const held = !!p.throttle;
    this.dialPress += ((held ? 1 : 0) - this.dialPress) * 0.25;   // eased press feedback
    const press = this.dialPress;
    const A0 = Math.PI, SPAN = Math.PI;
    const rPad = r * 0.46, rIn = r * 0.54, rOut = r * 0.97;
    const f = clamp(Math.max(0, p.speed) / p.cls.vmax, 0, 1);
    const kmh = Math.round(Math.max(0, p.speed) * 3.6);

    // --- white tab with the speed in figures, tucked behind the fan ---
    const cardW = r * 0.94, cardH = r * 0.72;
    const cardX = cx - cardW / 2, cardY = cy - rOut - cardH + r * 0.10;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 10; g.shadowOffsetY = 2;
    g.fillStyle = '#f2f4f7'; this._roundRect(g, cardX, cardY, cardW, cardH, r * 0.16); g.fill();
    g.restore();
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#4ec0e6'; g.font = `bold ${Math.round(r * 0.36)}px system-ui, sans-serif`;
    g.fillText(String(kmh), cx, cardY + cardH * 0.55);
    g.fillStyle = '#3ea8d2'; g.font = `600 ${Math.round(r * 0.15)}px system-ui, sans-serif`;
    g.fillText('km/h', cx, cardY + cardH * 0.84);

    // --- fan gauge: empty part, filled part up to the current speed, then the needle ---
    const sector = (a0, a1, fill) => {
      if (a1 <= a0) return;
      g.beginPath();
      g.arc(cx, cy, rOut, a0, a1);
      g.arc(cx, cy, rIn, a1, a0, true);
      g.closePath();
      g.fillStyle = fill; g.fill();
    };
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 10; g.shadowOffsetY = 2;
    sector(A0, A0 + SPAN, 'rgba(120,200,228,0.85)');
    g.restore();
    sector(A0, A0 + SPAN * f, held ? '#2f86c8' : '#54839c');
    // the needle also carries grip usage: pale while there is margin, then the telemetry colours
    const u = p.loadRatio;
    // it also thickens as the tyres load up, so the warning catches the eye without moving
    const nA = A0 + SPAN * f, nW = 0.075 * (1 + 0.6 * clamp((u - 0.7) / 0.8, 0, 1));
    sector(Math.max(A0, nA - nW), Math.min(A0 + SPAN, nA + nW), u < 0.7 ? 'rgba(236,247,252,0.98)' : Renderer.gripColor(u));
    // white rim around the whole fan, as one piece
    g.beginPath();
    g.arc(cx, cy, rOut, A0, A0 + SPAN);
    g.arc(cx, cy, rIn, A0 + SPAN, A0, true);
    g.closePath();
    g.strokeStyle = '#f2f4f7'; g.lineWidth = Math.max(3, r * 0.075); g.lineJoin = 'round'; g.stroke();

    // --- the white pad: the thumb rests here, its rim warns when the tyres are working ---
    const pr = rPad * (1 - 0.05 * press);
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 12; g.shadowOffsetY = 3;
    g.beginPath(); g.arc(cx, cy, pr, 0, Math.PI * 2);
    g.fillStyle = press > 0.5 ? '#ccd5df' : '#dfe5ec'; g.fill();
    g.restore();
    g.beginPath(); g.arc(cx, cy, pr, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(255,255,255,0.92)';
    g.lineWidth = Math.max(3, r * 0.07); g.stroke();
    g.lineJoin = 'miter'; g.textBaseline = 'top';
  }

  // Move the dial so its flat base sits just above the thumb, kept fully on screen.
  anchorDial(x, y) {
    const d = this.dial, m = 8;
    // never far enough left to cover the line slider: that column must stay reachable
    const lo = this.slider.x + 30 + d.r, hi = this.w - d.r - m;
    d.cx = hi > lo ? clamp(x, lo, hi) : hi;
    // the pad is centred on the thumb; the fan and the tab need room above it
    d.cy = clamp(y, d.r * 1.65 + m, this.h - m);
    this.dialAnchored = true;
  }

  // back to the bottom centre (new race, orientation change)
  homeDial() {
    if (!this.dialHome) return;
    this.dial.cx = this.dialHome.cx; this.dial.cy = this.dialHome.cy;
    this.dialAnchored = false;
  }

  static gripColor(u) { return u < 0.7 ? '#5be07a' : u < 1 ? '#ffd23f' : u < 1.2 ? '#ff9f2e' : u < 1.5 ? '#ff4b4b' : '#c74bff'; }

  // Telemetry: speed, slip angle (heading vs velocity), lateral velocity, grip usage (lateral
  // demand / available grip), plus the two axle slip angles and the steering angle.
  _drawDebug(g, p, x, y) {
    const rows = [
      ['speed', `${(p.speed * 3.6).toFixed(0)} km/h`, null],
      ['slipAngle', `${(p.drift * 180 / Math.PI).toFixed(1)}°`, Math.abs(p.drift) < 0.05 ? '#5be07a' : Math.abs(p.drift) < 0.15 ? '#ffd23f' : '#ff4b4b'],
      ['lateralVel', `${p.vl.toFixed(2)} m/s`, null],
      ['gripUsage', `${Math.min(9.99, p.usage).toFixed(2)}`, Renderer.gripColor(p.usage)],
      ['slip F / R', `${(p.alphaF * 180 / Math.PI).toFixed(1)}° / ${(p.alphaR * 180 / Math.PI).toFixed(1)}°`, null],
      ['steer', `${(p.delta * 180 / Math.PI).toFixed(1)}°`, null],
    ];
    const w = 210, rowH = 18, h = rows.length * rowH + 24;
    x = Math.min(x, this.w - w - 14);   // stays on screen on a phone
    g.fillStyle = 'rgba(10,12,20,0.7)'; this._roundRect(g, x, y, w, h, 10); g.fill();
    g.font = '13px ui-monospace, monospace';
    rows.forEach(([k, v, col], i) => {
      const yy = y + 6 + i * rowH;
      g.textAlign = 'left'; g.fillStyle = '#9aa0ad'; g.fillText(k, x + 10, yy);
      g.textAlign = 'right'; g.fillStyle = col || '#fff'; g.fillText(v, x + w - 10, yy);
    });
    // grip usage bar with the four thresholds
    const bx = x + 10, by = y + h - 10, bw = w - 20;
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(bx, by, bw, 3);
    g.fillStyle = Renderer.gripColor(p.usage); g.fillRect(bx, by, bw * Math.min(1, p.usage / 2), 3);
    for (const th of [0.7, 1, 1.2, 1.5]) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(bx + bw * th / 2 - 0.5, by - 2, 1, 7); }
  }

  // ---------- HUD ----------
  _drawHUD(g, race, ui) {
    const W = this.w, H = this.h, p = race.player, t = (k, ...a) => ui.t(k, ...a);
    const mobile = this.mobile, P = this.pad, pad0 = this.pad;
    g.textBaseline = 'top';
    const panel = (x, y, w, h) => { g.fillStyle = 'rgba(10,12,20,0.55)'; this._roundRect(g, x, y, w, h, 10); g.fill(); };

    /* Le haut de l'écran, SANS panneau.

    Les deux boîtes translucides prenaient une bande entière en haut de l'écran pour porter cinq
    nombres, et la boîte des temps était haute de trois lignes là où deux suffisent. Sur un
    téléphone tenu à bout de bras, cette bande est la part de piste qu'on ne voit pas.

    Tout est donc posé directement sur le monde, en gras, avec un contour sombre : c'est le contour
    qui rend lisible, pas le fond. Il tient sur l'herbe claire comme sur l'asphalte sombre, et il ne
    coûte rien en surface. Seules les lignes de temps gardent une pastille, parce qu'un chiffre à
    chasse fixe changeant à chaque image scintille sans un fond pour l'asseoir.

    La hiérarchie ne bouge pas : grand chiffre, libellé et total empilés contre lui. */
    const usure = !!p.usure;
    const boxH = this.hudBox.h;

    // le contour qui remplace le fond : tracé d'abord, rempli ensuite
    const cerne = (txt, x, y, ep) => {
      g.lineJoin = 'round'; g.lineWidth = ep;
      g.strokeStyle = 'rgba(8,10,16,0.72)'; g.strokeText(txt, x, y);
      g.fillText(txt, x, y);
    };

    const bloc = (x, y, grand, libelle, total) => {
      g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillStyle = '#fff';
      g.font = `900 ${mobile ? 34 : 42}px system-ui, sans-serif`;
      cerne(grand, x, y, mobile ? 6 : 7);
      const lg = g.measureText(grand).width;
      g.font = `bold ${mobile ? 12 : 14}px system-ui, sans-serif`;
      g.fillStyle = '#f0f2f6';
      cerne(libelle, x + lg + 5, y + (mobile ? 2 : 4), 4);
      let lgT = 0;
      if (total) {
        g.font = `bold ${mobile ? 14 : 16}px ui-monospace, monospace`;
        cerne(total, x + lg + 5, y + (mobile ? 16 : 22), 4);
        lgT = g.measureText(total).width;
      }
      // la largeur RÉELLE du bloc, libellé et total compris : c'est elle qui dit ce qui est occupé
      g.font = `bold ${mobile ? 12 : 14}px system-ui, sans-serif`;
      return lg + 5 + Math.max(g.measureText(libelle).width, lgT);
    };

    const pos = race.positionOf(p), n = race.cars.length;
    const tt = race.mode === 'timetrial';
    const lapShown = tt ? p.lap + 1 : Math.min(race.laps, p.lap + 1);
    const y0 = P.t + 2;
    /* Ce que le haut occupe vraiment, mesuré et publié.

    Le contrôle du bouton pause vérifiait qu'il ne passe pas sous les deux panneaux du haut. Ces
    panneaux n'existent plus, et il accusait donc le bouton d'un chevauchement avec des rectangles
    fantômes. Le rendu publie maintenant les zones qu'il occupe pour de bon, et l'essai mesure
    contre elles : une mesure qui décrit l'écran d'avant ne décrit plus rien. */
    const lgBloc = bloc(P.l + 4, y0, tt ? '—' : String(pos), t('pos'), tt ? '' : '/' + n);
    this.hudZones = { pos: { x: P.l + 4, w: lgBloc } };

    // --- les temps, en haut à droite : le tour courant en grand, deux pastilles en dessous ---
    const tw = this.hudBox.tw;
    const tx = W - P.r - 4;   // le tour garde le bord droit : c'est le repère le plus stable
    // le tour, aligné à droite, au-dessus des pastilles
    g.textAlign = 'right'; g.textBaseline = 'top';
    g.fillStyle = '#fff'; g.font = `900 ${mobile ? 34 : 42}px system-ui, sans-serif`;
    const lapTxt = String(lapShown);
    cerne(lapTxt, tx - (mobile ? 34 : 42), y0, mobile ? 6 : 7);
    g.textAlign = 'left';
    g.font = `bold ${mobile ? 12 : 14}px system-ui, sans-serif`; g.fillStyle = '#f0f2f6';
    cerne(t('lap'), tx - (mobile ? 30 : 38), y0 + (mobile ? 2 : 4), 4);
    if (!tt) {
      g.font = `bold ${mobile ? 14 : 16}px ui-monospace, monospace`;
      cerne('/' + race.laps, tx - (mobile ? 30 : 38), y0 + (mobile ? 16 : 22), 4);
    }

    /* Les pastilles de temps. Deux lignes, pas trois : le « dernier tour » a disparu au profit du
    tour COURANT, qui est le seul chiffre qu'on regarde en roulant. Le dernier tour ne servait qu'à
    la seconde d'après la ligne, où le message qui l'annonce le dit déjà, en grand, au milieu. */
    // les pastilles commencent juste après le bouton pause, et non au bord droit de l'écran
    const pb0 = this.pauseBtn;
    const ph = mobile ? 24 : 28, pw = mobile ? 136 : 168, px = pb0.x + pb0.s + 10;
    const pastille = (yy, lib, val, teinte) => {
      g.fillStyle = 'rgba(10,12,20,0.62)';
      this._roundRect(g, px, yy, pw, ph, ph / 2); g.fill();
      g.textAlign = 'left'; g.textBaseline = 'middle';
      g.font = `bold ${mobile ? 10 : 11}px system-ui, sans-serif`; g.fillStyle = '#aeb4c0';
      g.fillText(lib.toUpperCase(), px + 12, yy + ph / 2 + 0.5);
      g.textAlign = 'right';
      g.font = `bold ${mobile ? 13 : 15}px ui-monospace, monospace`; g.fillStyle = teinte || '#fff';
      g.fillText(val, px + pw - 12, yy + ph / 2 + 0.5);
      g.textBaseline = 'top';
    };
    const yP = y0 + 2;
    this.hudZones.temps = { x: px, w: pw };
    pastille(yP, t('best'), p.bestLap != null ? fmtTime(p.bestLap) : '--:--.---',
      p.bestLap != null ? '#b48cff' : '#7d838e');
    pastille(yP + ph + 5, t('lap'), fmtTime(race.state === 'countdown' ? 0 : race.time - p.lapStart));

    /* Les deux cadrans : la gomme et la tôle.

    Mêmes cadrans que ceux des fiches de voiture au menu — arc de 270° ouvert en bas, chiffre au
    centre, pictogramme sous l'ouverture — mais redessinés au pinceau : ceux du menu sont du SVG
    posé par CSS, et le HUD de course est entièrement peint sur le canvas. Reprendre le dessin
    plutôt que le code était le seul moyen d'avoir la même chose des deux côtés.

    Aucune information ne repose sur la couleur seule : chaque cadran porte son pictogramme et son
    chiffre. Le vert ne veut rien dire tout seul, c'est le passage à l'orange puis au rouge qui
    porte l'alerte — et le chiffre la porte aussi pour qui ne distingue pas les deux. */
    if (usure) {
      const J = this.jauges, r = J.r;
      /* Leur propre fond : posés à même le décor, deux anneaux fins se perdaient sur le sable.

      Il descend plus bas qu'il ne monte, parce que le chiffre est passé sous l'arc : un fond
      symétrique laissait le dernier chiffre à cheval sur le bord. */
      panel(J.x - r - 7, J.y1 - r - 8, (r + 7) * 2, (J.y2 - J.y1) + r * 2.2 + 16);
      const cadran = (cx, cy, frac, dessine) => {
        const f = Math.max(0, Math.min(1, frac));
        const A0 = Math.PI * 0.75, SPAN = Math.PI * 1.5;
        g.lineCap = 'round';
        g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = r * 0.30;
        g.beginPath(); g.arc(cx, cy, r * 0.78, A0, A0 + SPAN); g.stroke();
        g.strokeStyle = f > 0.5 ? '#5be07a' : f > 0.22 ? '#ffd400' : '#ff4d4d';
        if (f > 0.001) { g.beginPath(); g.arc(cx, cy, r * 0.78, A0, A0 + SPAN * f); g.stroke(); }
        /* Le pictogramme au CENTRE, le chiffre en bas sous l'ouverture de l'arc.

        L'inverse jusqu'ici. Le pictogramme dit de quoi on parle — gomme ou tôle — et c'est la
        première question ; le chiffre dit combien il en reste, et c'est la seconde. Le centre d'un
        cadran est la place qu'on regarde en premier, elle revient donc au pictogramme, et
        l'ouverture de l'arc en bas est faite pour poser une valeur. */
        g.save(); g.translate(cx, cy - r * 0.04); g.scale(r / 15, r / 15);
        dessine(); g.restore();
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `bold ${Math.round(r * 0.66)}px system-ui, sans-serif`;
        g.fillText(String(Math.round(f * 100)), cx, cy + r * 0.72);
      };
      /* Le pneu : un anneau entaillé. C'est le même motif que les pneus de difficulté du menu, et
      il reste lisible à douze pixels là où une bande de roulement dessinée se brouille. */
      const pneu = () => {
        g.strokeStyle = '#e8e8ec'; g.lineWidth = 2.6; g.setLineDash([2.4, 1.1]);
        g.beginPath(); g.arc(0, 0, 4.2, 0, Math.PI * 2); g.stroke();
        g.setLineDash([]);
      };
      // La carrosserie : une silhouette vue de dessus, capot vers le haut, avec son pare-brise.
      const tole = () => {
        g.fillStyle = '#e8e8ec';
        this._roundRect(g, -3.6, -5.2, 7.2, 10.4, 2.2); g.fill();
        g.fillStyle = 'rgba(20,24,34,0.85)';
        this._roundRect(g, -2.3, -2.6, 4.6, 3.2, 1); g.fill();
      };
      // en colonne : la gomme au-dessus, la tôle en dessous, dans l'ordre où on s'en soucie
      cadran(J.x, J.y1, p.tyre, pneu);
      cadran(J.x, J.y2, 1 - p.damage, tole);
      g.textAlign = 'left'; g.textBaseline = 'top';
    }

    // bouton pause, entre les deux panneaux du haut
    const pb = this.pauseBtn;
    panel(pb.x, pb.y, pb.s, pb.s);
    g.fillStyle = '#e8e8ec';
    const bw = Math.max(3, Math.round(pb.s * 0.11)), bh = Math.round(pb.s * 0.42), ecart = Math.round(pb.s * 0.13);
    g.fillRect(pb.x + pb.s / 2 - ecart - bw, pb.y + (pb.s - bh) / 2, bw, bh);
    g.fillRect(pb.x + pb.s / 2 + ecart, pb.y + (pb.s - bh) / 2, bw, bh);

    // line slider (left thumb)
    this._drawSlider(g, p, t);

    /* La carte, en bas, et toujours À L'OPPOSÉ du levier.

    Elle montait sous les chronos sur un téléphone, pour laisser le coin au pouce. Mais le pouce
    n'occupe qu'un seul coin du bas, celui du levier : l'autre est libre, et c'est là que la carte
    se lit le mieux — en bas, où l'œil descend déjà pour la ligne et l'accélérateur, plutôt qu'en
    haut où il faut aller la chercher. Elle se retourne donc avec le levier. */
    if (this.mm) {
      const m = this.mm;
      const mx = this.slider.droite ? P.l : W - P.r - m.size;
      const my = H - P.b - m.size;
      // pas de fond : le tracé est déjà cerné de noir dans sa propre image, il se lit sur le décor
      g.drawImage(m.canvas, mx, my, m.size, m.size);
      /* Les points de la carte, deux fois plus gros, et le joueur en bleu ciel.

      Ils faisaient 3 et 4,5 pixels : sur un téléphone, à bout de bras, on ne distinguait pas sa
      propre voiture du peloton, et c'est pourtant la seule information que cette carte doit donner
      en un dixième de seconde. Le jaune, lui, servait déjà au curseur de ligne et à la poignée du
      levier ; le bleu ciel n'est utilisé nulle part ailleurs pour une voiture. */
      for (const car of race.cars) {
        const wp = car.pos, q = this.mmPoint(wp.x, wp.y);
        g.fillStyle = car.isPlayer ? '#7fd4ff' : car.livery.body;
        g.beginPath(); g.arc(mx + q.x, my + q.y, car.isPlayer ? 9 : 6, 0, Math.PI * 2); g.fill();
        if (car.isPlayer) { g.strokeStyle = '#0b1220'; g.lineWidth = 2; g.stroke(); }
      }
    }

    // standings strip (desktop)
    if (!mobile && race.mode !== 'timetrial') {
      const st = race.standings().slice(0, 6);
      const rowH = 20, bw = 190, bx = P.l, by = P.t + boxH + 10;
      panel(bx, by, bw, st.length * rowH + 10);
      g.font = '13px system-ui, sans-serif'; g.textAlign = 'left';
      st.forEach((car, i) => {
        const y = by + 5 + i * rowH;
        g.fillStyle = car.livery.body; g.fillRect(bx + 10, y + 4, 10, 10);
        g.fillStyle = car.isPlayer ? '#ffd400' : '#e8e8ec';
        g.fillText(`${i + 1}. ${car.name}`, bx + 28, y + 2);
        if (car.state === 'grass') { g.fillStyle = '#ff6b6b'; g.textAlign = 'right'; g.fillText('!', bx + bw - 10, y + 2); g.textAlign = 'left'; }
      });
    }

    // the throttle dial goes on top of the map and the standings: it is the live control
    this._drawDial(g, p, t);

    // telemetry overlay (G key or settings): the four numbers that describe the car's state
    const dbgY = P.t + boxH + 10 + (mobile && this.mm ? this.mm.size + 10 : 0);
    if (this.debug) this._drawDebug(g, p, P.l + boxW + 14, dbgY);

    // countdown
    if (race.state === 'countdown') {
      const c = race.countdown;
      const lights = c > 3.2 ? 0 : c > 2.4 ? 1 : c > 1.6 ? 2 : c > 0.8 ? 3 : 4;
      const cx = W / 2, cy = H * 0.22;
      panel(cx - 120, cy - 30, 240, 60);
      for (let i = 0; i < 4; i++) { g.fillStyle = i < lights ? '#ff3b3b' : 'rgba(255,255,255,0.15)'; g.beginPath(); g.arc(cx - 75 + i * 50, cy, 16, 0, Math.PI * 2); g.fill(); }
      g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = 'bold 18px system-ui, sans-serif';
      g.fillText(this.touch ? t('holdToGoTouch') : t('holdToGo'), cx, cy + 40);
      g.font = '14px system-ui, sans-serif'; g.fillStyle = '#cfd3dc';
      g.fillText(this.touch ? t('lineHintTouch') : t('lineHintKeys'), cx, cy + 66);
    } else if (race.time < 1.2 && race.state === 'racing') {
      g.textAlign = 'center'; g.fillStyle = '#5be07a'; g.font = 'bold 64px system-ui, sans-serif';
      g.globalAlpha = 1 - race.time / 1.2; g.fillText('GO!', W / 2, H * 0.18); g.globalAlpha = 1;
    }
    if (p.state === 'grass') { g.textAlign = 'center'; g.fillStyle = '#ff6b6b'; g.font = 'bold 28px system-ui, sans-serif'; g.fillText(t('offTrack'), W / 2, H * 0.3); }
    if (p.finished && race.state !== 'finished') { g.textAlign = 'center'; g.fillStyle = '#ffd400'; g.font = 'bold 40px system-ui, sans-serif'; g.fillText(`${t('finished')} — P${race.positionOf(p)}`, W / 2, H * 0.3); }
    /* Le temps au tour se pose sous TOUT ce qui occupe le haut, et non à une hauteur fixe.

    Deux fois de suite il est tombé sur quelque chose : à 12 % de la hauteur il couvrait le bouton
    pause en paysage sur un téléphone ; passé sous le bouton, il couvrait les jauges d'usure, parce
    que le panneau de gauche grandit quand l'option est active. Il prend donc le plus bas des
    trois, et il suivra tout seul le prochain élément qu'on ajoutera en haut. */
    if (ui.flash && ui.flash.until > performance.now()) { g.textAlign = 'center'; g.fillStyle = ui.flash.color || '#fff'; g.font = 'bold 26px system-ui, sans-serif'; g.fillText(ui.flash.text, W / 2, Math.max(H * 0.12, pb.y + pb.s + 14, P.t + boxH + 14)); }
    g.textBaseline = 'alphabetic';
  }

  /* Le levier, et la coche des stands en dessous.

  Elle se pose SOUS les trois positions existantes au lieu de réétaler le levier sur quatre crans.
  Réétaler aurait déplacé « intérieur », « course » et « extérieur » dès que les stands
  s'ouvrent — donc changé la géométrie du seul contrôle de trajectoire en pleine course, au tour
  où l'on a le plus besoin qu'il soit là où la main l'attend. La coche vit donc dans la marge basse
  du panneau, que le fond réservait déjà.

  Elle n'existe que quand elle sert : option activée, premier tour bouclé, pas déjà servi. Une
  coche grise qui ne fait rien est pire qu'une coche absente — on la vise et il ne se passe rien. */
  _drawSlider(g, p, t) {
    const s = this.slider;
    const ouvert = !!(p.usure && p.lap >= 1 && !p.pitServi && !p.finished);
    this.pitOpen = ouvert;
    this.pitY = s.y + s.len + 22;
    g.fillStyle = 'rgba(10,12,20,0.55)'; this._roundRect(g, s.x - s.w / 2 - 8, s.y - 26, s.w + 16, s.len + 52 + (ouvert ? 22 : 0), 12); g.fill();
    // track
    g.fillStyle = 'rgba(255,255,255,0.18)'; this._roundRect(g, s.x - 4, s.y, 8, s.len, 4); g.fill();
    const stops = [{ v: 1, c: LINE_COLORS.outside, l: t('lineOut') }, { v: 0, c: LINE_COLORS.racing, l: t('lineRace') }, { v: -1, c: LINE_COLORS.inside, l: t('lineIn') }];
    /* Les libellés passent de l'autre côté de la colonne quand le levier est à droite : posés
    toujours à droite, ils sortiraient de l'écran, et c'est le genre de détail qui ne se voit que
    sur l'appareil de celui qui a changé le réglage. */
    const cote = s.droite ? -1 : 1;
    const lx = s.x + 14 * cote;
    g.font = `bold ${this.mobile ? 10 : 11}px system-ui, sans-serif`;
    g.textAlign = s.droite ? 'right' : 'left'; g.textBaseline = 'middle';
    for (const st of stops) {
      const y = s.y + s.len / 2 - st.v * s.len / 2;
      g.fillStyle = st.c; g.beginPath(); g.arc(s.x, y, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e8e8ec'; g.fillText(st.l, lx, y);
    }
    if (ouvert) {
      // le rail se prolonge jusqu'à la coche, sinon elle flotte sans appartenir au levier
      g.fillStyle = 'rgba(255,255,255,0.10)'; this._roundRect(g, s.x - 4, s.y + s.len, 8, 22, 4); g.fill();
      const actif = p.pitAsk || p.pitState;
      g.fillStyle = actif ? '#5be07a' : '#cfa14a';
      g.beginPath(); g.arc(s.x, this.pitY, 8, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1a1400'; g.font = `bold ${this.mobile ? 9 : 10}px system-ui, sans-serif`;
      g.textAlign = 'center'; g.fillText('P', s.x, this.pitY + 0.5);
      g.textAlign = s.droite ? 'right' : 'left'; g.fillStyle = actif ? '#5be07a' : '#e8e8ec';
      g.font = `bold ${this.mobile ? 10 : 11}px system-ui, sans-serif`;
      g.fillText(t('linePit'), lx, this.pitY);
    }
    // handle — posée sur la coche quand les stands sont demandés
    const hy = (p.pitAsk || p.pitState) && ouvert ? this.pitY : s.y + s.len / 2 - p.sel * s.len / 2;
    g.fillStyle = '#ffd400'; g.beginPath(); g.arc(s.x, hy, 13, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1a1400'; g.lineWidth = 2; g.stroke();
    g.textBaseline = 'top';
  }

  /* Le point tombe-t-il sur le bouton pause ?

  La cible est un peu plus large que le dessin, comme le hamburger du menu : sur un écran étroit le
  bouton descend à 37 px, et un pouce ne vise pas à cinq pixels près. Elle reste très loin du
  curseur de ligne, à gauche, et du cadran d'accélérateur, en bas. */
  pauseHitAt(x, y) {
    const b = this.pauseBtn;
    if (!b) return false;
    const m = 6;
    return x >= b.x - m && x <= b.x + b.s + m && y >= b.y - m && y <= b.y + b.s + m;
  }

  // maps a screen point in the slider zone to a selection value; null if outside the zone
  sliderValueAt(x, y, touchZone) {
    const s = this.slider, d = this.dial;
    // The visible dome always wins: a thumb landing on it accelerates, wherever it has moved to.
    // It can never cover the slider column, so the line stays reachable in any case.
    if (d) {
      const dx = x - d.cx, dy = y - d.cy;
      if (dy <= d.r * 0.6 && dx * dx + dy * dy < (d.r + 12) * (d.r + 12)) return null;
    }
    // la zone tactile large suit le côté du levier, sinon un gaucher pousserait dans le vide
    const inZoneX = touchZone ? (s.droite ? x > this.w * 0.58 : x < this.w * 0.42) : Math.abs(x - s.x) < 40;
    if (!inZoneX) return null;
    if (!touchZone && (y < s.y - 30 || y > s.y + s.len + 30)) return null;
    /* La coche des stands vit SOUS le rail, dans la marge du panneau : un doigt qui descend plus
    bas que la position « intérieur » demande les stands. Elle n'est lue que si elle est dessinée,
    faute de quoi on demanderait un arrêt impossible en visant le bord du panneau. */
    if (this.pitOpen && y > s.y + s.len + 8) return -2;
    let v = (s.y + s.len / 2 - y) / (s.len / 2);
    v = clamp(v, -1, 1);
    if (Math.abs(v) < 0.18) v = 0; else if (Math.abs(v) > 0.82) v = Math.sign(v);
    return v;
  }
}

function fmtTime(s) {
  if (s == null || !isFinite(s)) return '--:--.---';
  const m = Math.floor(s / 60), sec = s - m * 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(3)}`;
}
