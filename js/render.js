// Canvas renderer: world (background image or grass, road with variable width, the three
// driving lines, cars, effects) + HUD (position, times, speed/grip, line slider, minimap).
'use strict';

// Cartoon palette, flat and saturated, in the spirit of an isometric pixel-art city.
// Each circuit names a theme; a track without one gets the default. The palette is swapped whole
// rather than tinted, so a theme can change the mood of the ground at once — Silverstone in autumn
// wants pale stubble and ochre earth, not a greener green.
/* Every circuit has its own look.

   What they share is the road: a dark **purple-grey** rather than a neutral charcoal, which is what
   holds the family together whatever the ground around it does. What they do not share is the
   ground — Monza's pale park green, the dunes' sand, the Ardennes' damp forest, Bathurst's red
   earth — nor what grows beside the track.

   A theme names a ground, a road, a list of kerb colours and the palette the scenery is drawn in.
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
  edgeBleu: '#7fd4ff', edgeJaune: '#ffcf5c',
  // la voie des stands : un asphalte plus sombre que la piste, pour qu'on voie tout de suite que
  // ce n'est pas la même surface, et une zone d'arrêt jaune qu'on repère de loin
  pitLane: '#2f3038', pitBox: 'rgba(255,212,0,0.18)', pitBoxLine: '#ffd400',
  // Les blocs du vibreur font le tour de cette liste : deux couleurs pour un vibreur classique,
  // trois pour le vert-blanc-rouge de Monza. `js/tracks.js` nomme celles de chaque circuit.
  kerb: ['#e2a19c', '#f6f5f8'],   // en pastel, comme celles des circuits
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
  /* L'implantation : le sol d'un sous-bois, et de quoi bâtir.

  Le sol d'une masse boisée n'est pas de l'herbe — c'est de l'ombre et de la litière, et il doit
  être assez sombre pour qu'un trou entre deux couronnes ne fasse pas une tache claire au milieu du
  bois. Le béton, lui, sert aux tribunes comme aux hangars : sur une vue du dessus, tout ce qui est
  bâti autour d'un circuit est gris clair et plat. */
  sousBois: '#2c4a26', beton: '#b7b3ab', betonOmbre: '#8d8a84', toit: '#c9c5bb',
  verriere: '#6f7a80', gradin: '#9aa0a4', bitumeNu: '#6e6b74',
};

const THEME_DEFS = {
  // The royal park: pale mint grass under plane trees, and the old banking's concrete.
  park: {
    patches: 0.45,
    grass: '#bcd5ae', grassLight: '#c9dfbb', grassDark: '#a8c79c',
    earth: '#d9c79c', earthDark: '#c8b489',
    gravel: '#d9c79c', gravelDark: '#c8b489',
    canopy: ['#4a8a52', '#59a05f', '#3c7243'], pine: ['#356b58', '#3f7c66'],
    sousBois: '#3c6b3e',
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
    sousBois: '#23431f',
    props: { pine: 3, tree: 1.4, bales: 0, palm: 0 },
  },
  // Stubble and ochre earth.
  autumn: {
    patches: 0.7,
    grass: '#c6cf87', grassLight: '#d2da93', grassDark: '#b7c079',
    earth: '#e0c391', earthDark: '#d2b27e',
    asphalt: '#574a5e', asphaltLight: '#63566a',
    outline: '#332b39',
    kerb: ['#9bb4d9', '#f7f8fa'],
    gravel: '#e2c48f', gravelDark: '#d0ae76',
    canopy: ['#b4472e', '#c9662c', '#8e3a26'], pine: ['#2c5a52', '#356d5f'],
    sousBois: '#5a3a22',
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
    edgeLine: '#f5f2e8', centre: '#f5f2e8', edgeBleu: '#8fdcff', edgeJaune: '#ffd97a',
    pitLane: '#3b3142', pitBox: 'rgba(255,212,0,0.18)', pitBoxLine: '#ffd400',
    kerb: ['#e2a19c', '#faf8f4'],
    gravel: '#cfc3ae', gravelDark: '#bdb09a',
    canopy: ['#4f9a55', '#5cae61', '#3f7f45'], pine: ['#3f7a5a', '#4a8c69'],
    sousBois: '#33543a',
    rock: '#64505a', trunk: '#6b4a32', log: '#8a5a34',
    props: { house: 9, house2: 7, chapel: 2, palm: 3, tree: 0.6, tree2: 0.5,
             pine: 0.3, bush: 1, rock: 1.2, bales: 0, logs: 0 },
    water: null, // le port est une donnée du circuit, pas du thème
  },

  // The dunes: sand, marram grass, and orange everywhere.
  dunes: {
    patches: 0.4,
    grass: '#e8d5a0', grassLight: '#f0dfae', grassDark: '#d9c48c',
    earth: '#c9ae79', earthDark: '#b79c68',
    kerb: ['#f0bf93', '#faf8f4'],
    gravel: '#d9c08a', gravelDark: '#c5aa74',
    canopy: ['#7f9a52', '#8fae5e', '#6c8544'], pine: ['#5e7a45', '#6b8a50'],
    sousBois: '#6b7342',
    rock: '#c0b49a',
    props: { pine: 0.3, tree: 0.4, bush: 2.5, rock: 2, palm: 0.5, logs: 0 },
  },
  // Dry California hills: gold grass, dark scrub oaks.
  california: {
    patches: 0.5,
    grass: '#cfc184', grassLight: '#dacd91', grassDark: '#beb073',
    earth: '#bfa268', earthDark: '#ab8f58',
    kerb: ['#9bb4d9', '#f8f8f5'],
    gravel: '#c9ad74', gravelDark: '#b59862',
    canopy: ['#5d7a3c', '#6d8c46', '#4c6631'], pine: ['#4a6b46', '#567a52'],
    sousBois: '#51603a',
    rock: '#bdb298',
    props: { pine: 0.5, bush: 2, rock: 2, palm: 0.6, bales: 0.5 },
  },
  // Warm and saturated, with palms.
  tropical: {
    patches: 0.5,
    grass: '#66a84e', grassLight: '#73b659', grassDark: '#5a9645',
    earth: '#b08a58', earthDark: '#9c774a',
    kerb: ['#f4df9d', '#93bfa1'],
    canopy: ['#2f8a3f', '#3aa04c', '#256e32'], pine: ['#2a6b4a', '#337d58'],
    sousBois: '#1f5c2c',
    props: { palm: 3, pine: 0.2, tree: 1.2, logs: 0.4 },
  },
  // Cool green under the mountains.
  japan: {
    patches: 0.5,
    grass: '#7fb073', grassLight: '#8cbd7f', grassDark: '#6f9e64',
    earth: '#a89369', earthDark: '#95805a',
    asphalt: '#473c53', asphaltLight: '#53485f',
    canopy: ['#3a7a46', '#478f54', '#2e6237'], pine: ['#2a5b4e', '#336d5e'],
    sousBois: '#28513a',
    props: { pine: 2, palm: 0, bales: 0.4 },
  },
  // The bush: khaki scrub over red earth.
  bush: {
    patches: 0.85,
    grass: '#a9ab68', grassLight: '#b5b774', grassDark: '#9a9c5d',
    earth: '#b3663c', earthDark: '#9d5733',
    gravel: '#c08a5a', gravelDark: '#aa774b',
    canopy: ['#6f8a4a', '#7f9c56', '#5d743c'], pine: ['#54704a', '#608055'],
    sousBois: '#5b6540',
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
    sousBois: '#255239',
    props: { pine: 2.4, palm: 0, bales: 1.4 },
  },
  // Long French summer, dry verges.
  lemans: {
    patches: 0.55,
    grass: '#8fae5e', grassLight: '#9cbb6a', grassDark: '#7f9e51',
    earth: '#bda572', earthDark: '#a98f60',
    kerb: ['#9bb4d9', '#f8f7f4'],
    canopy: ['#417f3c', '#4e9448', '#356832'], pine: ['#2f6350', '#38755f'],
    sousBois: '#2c5330',
    props: { pine: 1.4, palm: 0, bales: 1.2 },
  },
};

const THEMES = {};
for (const name in THEME_DEFS) THEMES[name] = Object.assign({}, THEME_BASE, THEME_DEFS[name]);
THEMES.classic = Object.assign({}, THEME_BASE);
let PAL = THEMES.park;

/* Les deux bords ont une couleur, et elle ne bouge plus.

Le bleu est le côté DROIT du ruban, le jaune le côté GAUCHE, du départ à l'arrivée. Les mêmes
couleurs servent aux lignes tracées, aux pastilles du levier et aux bords peints de la piste : c'est
ce qui permet de se passer de légende — on voit le bord jaune, on pousse le levier vers le jaune. */
/* Les carrosseries d'un parking, dans la proportion où on les voit sur une aire : la moitié en
   gris, blanc et noir, le reste en teintes sourdes, et une rouge pour deux cents places. */
/* Les raies du Castellet, de la piste vers le mur : deux bleus, puis deux rouges, chacun en deux
   tons pour que la bande se lise comme peinte et non comme un aplat. Le blanc qui les sépare sur
   le vrai circuit tient dans le ton clair de chaque paire. */
const RAIES = ['#4a7bb4', '#6d97c6', '#4a7bb4', '#6d97c6', '#a8443c', '#c06a60', '#a8443c', '#c06a60'];

const PARK_TEINTES = ['#d9d9dc', '#ececed', '#9b9ba1', '#6e6e76', '#3b3c42', '#2b2c31',
  '#c9ccd1', '#8a9099', '#5a6472', '#7e8a7a', '#8b7f72', '#b4453c'];

// Le décalage de l'ombre d'une voiture, en mètres du monde : en bas à droite, comme celle des
// barrières qu'elle longe (`_drawBarriers`) et des tas de bois — les valeurs d'avant, qui
// étaient seulement posées dans le mauvais repère.
const OMBRE_VOITURE = [0.25, 0.35];
// Le faisceau des feux stop, en mètres : sa longueur, sa demi-largeur au bout et au feu, l'écart
// des deux feux d'une GT (en fraction de la largeur du dessin), l'ouverture de leurs cônes vers
// l'extérieur, et la part cachée sous la carrosserie.
const FEU_STOP = { long: 3.2, demi: 0.95, source: 0.16, ecart: 0.3, ouvre: 0.45, dedans: 0.35 };
const LINE_COLORS = { bleu: 'rgba(80,200,255,0.55)', racing: 'rgba(255,255,255,0.5)', jaune: 'rgba(255,200,60,0.55)' };

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.carCanvas = document.createElement('canvas');
    this.carCtx = this.carCanvas.getContext('2d');
    this.hudCanvas = document.createElement('canvas');
    this.hudCtx = this.hudCanvas.getContext('2d');
    this.carRects = [];
    for (const layer of [this.carCanvas, this.hudCanvas]) {
      layer.setAttribute('aria-hidden', 'true');
      layer.style.cssText = 'position:fixed;inset:0;display:block;pointer-events:none;user-select:none;';
    }
    // Même ordre que le rendu initial : décor, voitures, HUD, puis menus DOM.
    if (canvas.parentNode) {
      canvas.after(this.carCanvas);
      this.carCanvas.after(this.hudCanvas);
    }
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
    this.detail = 1;     // 1 : protections complètes. 0 : allégées, quand la résolution est au bout.
    this._implTag = 0;   // numéro d'image, pour ne dessiner qu'une fois un arbre à cheval sur deux cases
    this.touch = mobileDevice();
    this.mobileDevice = this.touch;
    this.showLines = false;   // braking guide, off unless enabled in the settings
    this.debug = false;       // vehicle telemetry overlay (speed, slip angle, lateral velocity, grip usage)
    this.poucePress = 0;      // appui lissé de 0 à 1 sur la pastille du pouce
    this.reglageZone = null;  // le rail du levier de freinage, en mode réglage seulement
    this.rotate = true;      // keep the track direction pointing up the screen
    this.camAngle = 0;
    this.resize();
  }

  /* QUATRE VUES, et ce sont deux questions croisées plutôt qu'une liste.

  La première : l'écran tourne-t-il avec la piste, ou le nord reste-t-il en haut ? La seconde : la
  caméra se place-t-elle par rapport à la VOITURE, ou en avance sur la PISTE ?

    'track'      dessus, orientée piste        'fixed'      dessus, fixe
    'avance'     en avance, orientée piste     'avanceFixe' en avance, fixe

  Il y en avait une cinquième, isométrique — un sol incliné et une caméra qui ne tourne pas, si bien
  qu'une voiture se voit sous tous ses angles au fil d'un tour. Elle est retirée : voir le README,
  « Ce qui part avec l'isométrique ». */
  setView(view) {
    this.view = view;
    this.rotate = view === 'track' || view === 'avance';
    this.avance = view === 'avance' || view === 'avanceFixe';
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
    /* QUAND IL N'Y A PLUS DE PIXELS À RENDRE, ON REND DU DÉTAIL.

    L'échelle s'arrêtait à un pixel par point : arrivée là, elle n'avait plus rien à donner, et
    une machine encore trop lente le restait. Les protections offrent un cran de plus. Mesuré sur
    Spa à processeur bridé quatre fois : leur version complète coûte 45 ms par image, la version
    allégée 38 — c'est-à-dire autant que s'il n'y avait pas de protections du tout. L'ombre
    portée, le reflet du rail et le contour des pneus sont ce qui coûte ; ils se voient à l'arrêt
    sur une capture, pas à soixante kilomètres-heure sur un téléphone.

    Le cran se prend APRÈS la résolution et se rend AVANT elle : on préfère toujours une image
    nette et simple à une image floue et détaillée. */
    let n = i;
    if (med > 20 && i > 0) n = i - 1;                // on n'y arrive pas : moins de pixels
    else if (med < 13 && i < CRANS.length - 1) n = i + 1;   // de la marge : on en reprend
    if (n === i) {
      const avant = this.detail;
      if (med > 30 && i === 0) this.detail = 0;
      else if (med < 18) this.detail = 1;
      if (this.detail !== avant) { this._scaleAt = now; this._fr = []; }
      return;
    }
    if (this.detail === 0 && n > i) this.detail = 1;   // le détail revient avant les pixels
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
    this.nativeDpr = Math.max(1, window.devicePixelRatio || 1);
    for (const [layer, scale] of [[this.carCanvas, this.nativeDpr], [this.hudCanvas, this.dpr]]) {
      const width = Math.round(w * scale), height = Math.round(h * scale);
      if (layer.width !== width || layer.height !== height) {
        layer.width = width; layer.height = height;
        if (layer === this.carCanvas) this.carRects = [];
      }
      layer.style.width = w + 'px'; layer.style.height = h + 'px';
    }
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
    const W = this.w, H = this.h, mobile = this.mobileDevice || W < 700;
    this.shortLandscape = H < 560 && W > H;
    const sa = this._encoches();
    // Un seul écart, mesuré depuis le bord SÛR et non depuis le bord physique.
    const P = this.pad = { t: 14 + sa.t, r: 14 + sa.r, b: 14 + sa.b, l: 14 + sa.l };
    this.encoches = sa;
    /* LA PASTILLE DU POUCE, ET RIEN D'AUTRE EN BAS DE L'ÉCRAN.

    Il y avait là un cadran : une pastille, un éventail de vitesse, et une carte blanche portant les
    chiffres. Sur un iPhone 13 en portrait il occupait 197 × 208 px, soit 12,4 % de l'écran et 7,4 %
    en surface vraiment opaque, dans une bande allant de y=588 à y=796 — or les vues « en avance »
    posent la voiture vers y=675. Il couvrait donc la voiture du joueur.

    L'ancien commentaire d'ici le savait et concluait que « le joueur le déplace lui-même s'il le
    gêne ». C'est faux en course : déplacer la pastille demande de LÂCHER l'accélérateur, donc on ne
    le fait jamais. Le constat est de Bruno, au volant.

    ET IL NE PAYAIT PAS SON LOYER. `main.js` prend tout appui qui n'est ni la pause ni la zone du
    levier pour de l'accélérateur : la cible fait un demi-écran, et le dessin n'a aucune valeur de
    visée — il n'était qu'un instrument. Les deux chiffres qu'il portait sont donc remontés sous le
    bandeau du haut, et il ne reste ici qu'un disque translucide qui dit où est le pouce. */
    const r = clamp(Math.min(W * 0.12, H * 0.08), 32, 60);
    this.pouceHome = { cx: this.shortLandscape ? (this.ctrlSide === 'right' ? P.l + r + 22 : W - P.r - r - 22) : W / 2, cy: H - P.b - r };
    this.pouce = { cx: this.pouceHome.cx, cy: this.pouceHome.cy, r };
    this.pouceAncre = false;
    /* Le levier de ligne, à gauche par défaut, à droite au choix.

    Un droitier tient son téléphone d'une main et pousse le levier du pouce de l'autre ; un
    gaucher fait l'inverse, et jusqu'ici il n'avait pas le choix. Tout ce qui vit dans cette
    colonne — les jauges d'usure, la carte en face — se retourne avec lui, sinon le retournement
    ne ferait que déplacer la gêne. */
    const droite = this.ctrlSide === 'right';
    /* DEUX FOIS PLUS COURT QU'AVANT (38 % de la hauteur, jusqu'à 320 px) : le pouce mettait trop
    de temps à aller d'un bout à l'autre, et c'est en entrée de virage qu'on change de ligne. La
    ligne suit le doigt sans délai ; seule la course du pouce raccourcit. Au moins 64 px, pour que
    la poignée posée sur un cran ne mange pas le libellé du suivant en paysage. */
    const len = clamp(H * (this.shortLandscape ? 0.14 : 0.19), 64, 160);
    this.slider = { x: droite ? W - P.r - 22 : P.l + 22, y: H - P.b - 30 - len, len, w: 30, droite };
    /* Les deux cadrans d'usure, en colonne au-dessus du levier.

    Ils étaient dans le panneau du haut à gauche, qui grandissait pour les loger. Ils vivent
    maintenant avec le levier, en bas : c'est là que se porte le regard quand on choisit sa ligne,
    donc là qu'on décide aussi de ménager la gomme. Au-dessus du levier et non à côté — à côté, ils
    entraient en collision avec le cadran d'accélérateur sur un téléphone. */
    /* Ils se posent AU-DESSUS du panneau du levier, pas au-dessus du rail.

    Calés sur le rail, le cadran du bas tombait sur le bord du panneau, qui commence vingt-six
    pixels plus haut : il le chevauchait à moitié. On part donc du haut du panneau et on remonte. */
    const rj = this.shortLandscape ? 14 : mobile ? 19 : 22;
    const hautPanneau = this.slider.y - 26;
    this.jauges = { r: rj, x: this.slider.x, y2: hautPanneau - rj - 10, y1: hautPanneau - rj * 3.2 - 14 };
    if (this.shortLandscape) this.jauges = { r: rj, x: this.slider.x + (droite ? -85 : 85), y1: H - P.b - 85, y2: H - P.b - 42 };
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
  _makeGrass(style = this.grassStyle || 'aplats') {
    const c = document.createElement('canvas');c.width=c.height=256;
    const g=c.getContext('2d'),rnd=propRng(seedFromId('grass-'+style));
    g.fillStyle=PAL.grass;g.fillRect(0,0,256,256);
    if(this.track?.theme==='riviera'){
      // Le sol urbain reste minéral : de grands joints discrets, pas de pelouse.
      g.strokeStyle=this._melange(PAL.grass,PAL.grassDark,.3);g.lineWidth=1;
      for(let y=0;y<256;y+=64){g.beginPath();g.moveTo(0,y);g.lineTo(256,y);g.stroke();}
      return c;
    }
    if(style==='tonte'){
      g.fillStyle=this._melange(PAL.grass,PAL.grassLight,.48);
      g.fillRect(0,0,256,64);g.fillRect(0,128,256,64);
    }else if(style==='aplats'){
      const shapes=[[[0,0],[120,0],[155,75],[85,135],[0,100]],[[256,90],[165,120],[128,210],[200,256],[256,256]]];
      shapes.forEach((pts,i)=>{g.fillStyle=this._melange(PAL.grass,i?PAL.grassDark:PAL.grassLight,.4);g.beginPath();pts.forEach(([x,y],j)=>j?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();});
    }
    g.strokeStyle=this._melange(PAL.grass,PAL.grassDark,.6);g.lineWidth=1.4;g.lineCap='round';
    for(let i=0;i<(style==='prairie'?75:28);i++){
      const x=5+rnd()*246,y=6+rnd()*244;
      g.beginPath();g.moveTo(x-2,y);g.lineTo(x-3,y-3);g.moveTo(x,y);g.lineTo(x+1,y-4);g.stroke();
    }
    return c;
  }

  _buildBarrierArt(track) {
    const groups=new Map();let blockIndex=0;
    for(const b of track.barriers){
      // Des groupes de vingt-quatre mètres : assez courts pour que la fenêtre en rejette beaucoup,
      // assez longs pour que le nombre de groupes reste modeste.
      const key=(b.level||0)+':'+b.side+':'+Math.floor(b.s/24);
      if(!groups.has(key))groups.set(key,{cle:key,level:b.level||0,rail:new Path2D(),shine:new Path2D(),posts:new Path2D(),
        blocks:(PAL.barrierBlocks||PAL.kerb).map(()=>new Path2D()),tyres:new Path2D(),
        bbox:{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity}});
      const g=groups.get(key),box=g.bbox;
      box.minX=Math.min(box.minX,b.ax-3,b.bx-3);box.maxX=Math.max(box.maxX,b.ax+3,b.bx+3);
      box.minY=Math.min(box.minY,b.ay-3,b.by-3);box.maxY=Math.max(box.maxY,b.ay+3,b.by+3);
      const line=(p,off)=>{p.moveTo(b.ax+b.nx*off,b.ay+b.ny*off);p.lineTo(b.bx+b.nx*off,b.by+b.ny*off);};
      if(b.kind==='rail'){
        line(g.rail,0);line(g.shine,.13);
        g.posts.moveTo(b.ax-b.nx*.45,b.ay-b.ny*.45);g.posts.lineTo(b.ax+b.nx*.45,b.ay+b.ny*.45);
      }else{
        // Mur aux couleurs exactes des vibreurs ; deux rangées de pneus devant.
        const modules=Math.max(1,Math.ceil(b.len/3));
        for(let j=0;j<modules;j++){
          const p=g.blocks[blockIndex++%g.blocks.length],start=j/modules,end=(j+1)/modules;
          const ax=b.ax+(b.bx-b.ax)*start,ay=b.ay+(b.by-b.ay)*start;
          const bx=b.ax+(b.bx-b.ax)*end,by=b.ay+(b.by-b.ay)*end;
          p.moveTo(ax-b.nx*.38,ay-b.ny*.38);p.lineTo(bx-b.nx*.38,by-b.ny*.38);
          p.lineTo(bx-b.nx*1.05,by-b.ny*1.05);p.lineTo(ax-b.nx*1.05,ay-b.ny*1.05);p.closePath();
        }
        /* LES DEUX RANGÉES DE PNEUS SONT DEUX TRAITS, et non quatre cents cercles.

        Chaque pneu était un arc, et chaque arc était tracé quatre fois — ombre, corps, contour,
        trou. Sur Spa cela faisait quatre mille arcs par tour, dont plusieurs centaines à l'écran à
        tout moment : huit millisecondes par image sur un processeur bridé quatre fois, mesurées en
        retirant les pneus et en comparant. Les rails, eux, ne coûtaient qu'une demi-milliseconde.

        Un trait pointillé à bouts ronds fait exactement la même image. Avec un tiret de longueur
        nulle, chaque bout rond est un disque du diamètre de l'épaisseur ; avec la période du
        pointillé pour espacement, c'est une rangée de pneus. Le trou au centre est le même trait,
        plus fin et plus sombre. Deux tracés au lieu de quatre cents, et le dessin ne change pas. */
        line(g.tyres,.10);line(g.tyres,.83);
      }
    }
    this.barrierArt=[...groups.values()];
    this._barrFusion=null;this._barrFusionCle=null;
    this.barrierGravel=null;
    this.runoffAsphalt=null;
    this.runoffPaint=[];this.runoffBandes=null;
    if(track.barriers.length || track.def.runoffs){
      // Un seul contour fermé évite les cordes et les facettes aux raccords des bacs.
      const p=this.barrierGravel=new Path2D();
      for(const side of [1,-1])for(let j=0;j<track.n;j+=2){
        const i=side>0?j:track.n-1-j;
        const hw=(side>0?track.hwL[i]:track.hwR[i])+track.largeurBac(i,side);
        const x=track.xs[i]+track.nx[i]*hw*side,y=track.ys[i]+track.ny[i]*hw*side;
        if(side===1&&j===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
      p.closePath();
    }
    this.runoffPads=[];
    for(const pad of track.pads||[]){
      const path=new Path2D();
      pad.poly.forEach(([x,y],k)=>k?path.lineTo(x,y):path.moveTo(x,y));path.closePath();
      this.runoffPads.push({path,surface:pad.surface});
    }
    if(track.asphaltW){
      const p=this.runoffAsphalt=new Path2D();
      for(const side of [1,-1])for(let j=0;j<track.n;j++){
        const i=side>0?j:track.n-1-j;
        const hw=(side>0?track.hwL[i]:track.hwR[i])+track.asphaltW[side>0?'L':'R'][i];
        const x=track.xs[i]+track.nx[i]*hw*side,y=track.ys[i]+track.ny[i]*hw*side;
        if(side===1&&j===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
      p.closePath();
      /* LE DÉGAGEMENT RAYÉ DU CASTELLET.

      Paul Ricard ne ressemble à aucun autre circuit vu d'en haut, et c'est entièrement à cause de
      ses dégagements : des bandes peintes, bleues près de la piste et rouges près du mur, de plus
      en plus abrasives à mesure qu'on s'en éloigne. Sur la carte fournie, c'est la première chose
      qu'on voit — avant le tracé lui-même. Un dégagement gris uni aurait fait du Castellet un
      circuit quelconque.

      Les bandes sont découpées dans la LARGEUR du dégagement, pas dans sa longueur : chacune est
      un ruban qui suit la piste entre deux fractions de la largeur, et elles se peignent de
      l'extérieur vers l'intérieur pour que le rouge ne recouvre pas le bleu aux raccords. */
      if (track.def.runoffRaye) {
        const N = RAIES.length;
        this.runoffBandes = RAIES.map((col, b) => {
          const q = new Path2D();
          for (const side of [1, -1]) {
            const dedans = [], dehors = [];
            for (let j = 0; j < track.n; j++) {
              const i = side > 0 ? j : track.n - 1 - j;
              const hw = side > 0 ? track.hwL[i] : track.hwR[i];
              const w = track.asphaltW[side > 0 ? 'L' : 'R'][i];
              const nx = track.nx[i] * side, ny = track.ny[i] * side;
              const a = hw + w * b / N, c = hw + w * (b + (track.def.graphics ? .45 : 1)) / N;
              dedans.push([track.xs[i] + nx * a, track.ys[i] + ny * a]);
              dehors.push([track.xs[i] + nx * c, track.ys[i] + ny * c]);
            }
            dehors.reverse();
            const tour = dedans.concat(dehors);
            q.moveTo(tour[0][0], tour[0][1]);
            for (let k = 1; k < tour.length; k++) q.lineTo(tour[k][0], tour[k][1]);
            q.closePath();
          }
          return { path: q, col };
        }).reverse();
      }
      // Bande extérieure peinte dans les couleurs du circuit, inspirée de Raidillon.
      // L'intérieur gris distingue immédiatement le dégagement de la chaussée.
      this.runoffPaint=PAL.kerb.map(()=>new Path2D());
      // Les segments de protection ont déjà éliminé les boucles des normales
      // à l'intérieur des chicanes : la peinture suit cette même enveloppe.
      for(const b of (track.def.graphics?.paintedRunoff===false?[]:track.barriers)){
        const w=track.asphaltW[b.side>0?'L':'R'][track.idx(b.s)];
        const band=Math.min(2.4,Math.max(0,(w-4)*.45));
        if(!band)continue;
        const paint=this.runoffPaint[Math.floor(b.s/6)%this.runoffPaint.length];
        paint.moveTo(b.ax+b.nx*1.5,b.ay+b.ny*1.5);
        paint.lineTo(b.bx+b.nx*1.5,b.by+b.ny*1.5);
        paint.lineTo(b.bx+b.nx*(1.5+band),b.by+b.ny*(1.5+band));
        paint.lineTo(b.ax+b.nx*(1.5+band),b.ay+b.ny*(1.5+band));
        paint.closePath();
      }
    }
  }

  /* LES PROTECTIONS SE TAILLENT SUR LA FENÊTRE SERRÉE, elles aussi.

  Chaque groupe visible coûte une douzaine de passes de tracé — ombre, poteaux, trois épaisseurs de
  rail, reflet, blocs peints, deux rangées de pneus et leurs trous. Tant qu'elles n'étaient que sur
  Spa, en dessiner quelques-unes de trop ne se voyait pas. Sur les treize circuits, avec `vis` qui
  porte soixante mètres de marge, on en peignait une cinquantaine de groupes par image pour une
  dizaine réellement à l'écran : onze millisecondes sur un processeur bridé quatre fois, soit la
  moitié du budget d'un téléphone.

  Le rayon exact de l'écran plus cinq mètres suffit : un groupe ne dépasse jamais de trois. */
  _drawBarriers(g,vis,level=null) {
    const r=Math.hypot(this.w,this.h)/2/this.cam.zoom+5;
    const minX=this.cam.x-r,maxX=this.cam.x+r,minY=this.cam.y-r,maxY=this.cam.y+r;
    /* LES GROUPES VISIBLES SONT RÉUNIS AVANT D'ÊTRE PEINTS.

    Chaque groupe demandait ses douze passes à lui — ombre, poteaux, trois épaisseurs de rail,
    reflet, blocs peints et leur contour, pneus, contour des pneus, trous. Dix groupes à l'écran
    faisaient cent vingt passes de rastérisation, et c'est là que partaient les dix-huit
    millisecondes par image que la mesure attribuait aux protections : plus de la moitié du budget
    d'un téléphone, pour une poignée de mètres de rail.

    Or ces passes ne diffèrent pas d'un groupe à l'autre : même couleur, même épaisseur. Réunir les
    chemins puis peindre une fois ramène le compte à douze, quel que soit le nombre de groupes.
    `addPath` ne fait que recopier de la géométrie — c'est la rastérisation qui coûte.

    Le jeu réuni est gardé d'une image à l'autre tant que la liste des groupes visibles ne change
    pas, ce qui est le cas la plupart du temps : la caméra avance de quelques centimètres par
    image, et un groupe fait vingt-quatre mètres. */
    const vus=[];
    for(const a of this.barrierArt||[]){
      if(level!==null&&a.level!==level)continue;
      const b=a.bbox;if(b.maxX<minX||b.minX>maxX||b.maxY<minY||b.minY>maxY)continue;
      vus.push(a);
    }
    const cle=level+':'+vus.length+':'+(vus.length?vus[0].cle+'-'+vus[vus.length-1].cle:'');
    if(!this._barrFusion||this._barrFusionCle!==cle){
      const f={rail:new Path2D(),shine:new Path2D(),posts:new Path2D(),
        blocks:(PAL.barrierBlocks||PAL.kerb).map(()=>new Path2D()),tyres:new Path2D()};
      for(const a of vus){
        f.rail.addPath(a.rail);f.shine.addPath(a.shine);f.posts.addPath(a.posts);
        f.tyres.addPath(a.tyres);
        for(let i=0;i<f.blocks.length;i++)f.blocks[i].addPath(a.blocks[i]);
      }
      this._barrFusion=f;this._barrFusionCle=cle;
    }
    const a=this._barrFusion;
    g.save();g.lineJoin='round';g.lineCap='round';
    const PNEU=[0,.82];                    // tiret nul, période : un disque tous les 82 cm
    const fin=this.detail!==0;
    if(fin){
      g.save();g.translate(.25,.3);g.strokeStyle='rgba(20,18,26,.28)';g.lineWidth=.8;
      g.stroke(a.rail);g.fillStyle='rgba(20,18,26,.25)';for(const p of a.blocks)g.fill(p);
      g.setLineDash(PNEU);g.lineWidth=.72;g.stroke(a.tyres);g.setLineDash([]);g.restore();
    }
    g.strokeStyle=PAL.metalShadow || '#36333e';g.lineWidth=.22;g.stroke(a.posts);
    g.strokeStyle=PAL.metalShadow || '#302c38';g.lineWidth=.58;g.stroke(a.rail);
    g.strokeStyle=PAL.metal || '#9fa9b0';g.lineWidth=.38;g.stroke(a.rail);
    if(fin){g.strokeStyle='#e6e9e8';g.lineWidth=.10;g.stroke(a.shine);}
    g.strokeStyle='#302c38';g.lineWidth=.10;
    for(let i=0;i<a.blocks.length;i++){g.fillStyle=PAL.barrierBlocks?.[i] || PAL.kerb[i];g.fill(a.blocks[i]);g.stroke(a.blocks[i]);}
    g.setLineDash(PNEU);
    if(fin){g.strokeStyle='#25222b';g.lineWidth=.76;g.stroke(a.tyres);}
    g.strokeStyle=PAL.tyre || '#41404a';g.lineWidth=.72;g.stroke(a.tyres);
    if(this.circuitGraphics){
      g.strokeStyle=PAL.tyreLight;g.lineWidth=.52;g.stroke(a.tyres);
    }
    g.strokeStyle='#181720';g.lineWidth=.26;g.stroke(a.tyres);
    g.setLineDash([]);
    g.restore();
  }

  setTrack(track) {
    this.track = track;
    this.rubber = new Map();
    this.particles = [];
    this.wets = [];
    this.damp = new Map();
    PAL = THEMES[track.theme] || THEMES.park;
    /* Les vibreurs appartiennent au CIRCUIT, pas au décor. Un thème donne l'humeur d'un paysage —
    la lande des Ardennes, les dunes, la colline californienne — et plusieurs circuits le partagent :
    Spa et le Nürburgring sont tous deux en forêt, et n'ont rien à voir. Quand `js/tracks.js` nomme
    ses bandes, elles passent devant ; le thème reste la valeur par défaut, pour un circuit d'éditeur
    qui n'en nomme aucune.

    AUTANT DE COULEURS QU'ON VEUT, et non deux. Les blocs se succèdent en faisant le tour de la
    liste : deux pour un vibreur classique, trois pour le vert-blanc-rouge de Monza. */
    if (track.def && track.def.kerb) PAL = Object.assign({}, PAL, { kerb: track.def.kerb });
    const graphics=track.def.graphics;
    if(graphics){
      // Le matériau change, l'identité de la végétation de chaque thème demeure.
      const vegetation={};
      for(const key of ['canopy','pine','sousBois'])if(PAL[key])vegetation[key]=PAL[key];
      PAL=Object.assign({},PAL,CIRCUIT_MATERIALS,vegetation,graphics.materials||{},{kerb:graphics.kerb||PAL.kerb});
    }
    this.grass = this._makeGrass();
    this.grassPattern = this.ctx.createPattern(this.grass, 'repeat');
    const seed = track.id || track.name || 'track';
    /* Le décor vu de dessus, dessiné et non téléchargé.

    Il y en avait un second jeu : des panneaux en trois quarts, découpés d'une planche de sprites,
    qui n'avaient de sens que sous une caméra inclinée — vu du dessus, un objet debout n'est rien.
    La caméra inclinée est retirée, et ses vingt-cinq PNG avec elle : ils partaient au réseau à
    chaque course, y compris à plat où personne ne les regardait. */
    this.water = placeWater(track, track.def.water || PAL.water);
    this.topArt = buildTopArt(PAL);
    this.vehicleArt = buildVehicleArt();
    this.topProps = placeTopProps(track, seed, null, PAL.props);
    /* L'implantation relevée sur la vue du dessus du circuit, quand il en a une.

    Elle passe AVANT le filtrage des barrières, et elle efface d'abord le semis ordinaire là où la
    vue montre du vide : un bosquet par défaut au milieu de l'aérodrome de Silverstone trahit le
    lieu plus sûrement qu'une couleur fausse. */
    this.implantation = placeImplantation(track, seed, track.def && track.def.implantation, this.water);
    this.topProps = implEfface(track, this.implantation, this.topProps);
    this._buildBarrierArt(track);
    if(track.barriers.length)this.topProps=this.topProps.filter(p=>{
      const radius=(this.topArt[p.id]?.wm||4)*.6;
      return track.barrierCandidates(p.x,p.y,p.x,p.y,radius+2)
        .every(b=>track.barrierDistance(p.x,p.y,b)>radius+1);
    });
    if(this.water)this.topProps=this.topProps.filter(p=>!waterContains(this.water,p.x,p.y,(this.topArt[p.id]?.wm||4)*.6));
    // Les tas de bois : ceux de la lisière, et ceux du semis restés seuls ; aucun sur un arbre.
    {const r=tasIsoles(track,this.implantation,this.topProps,propRng(seedFromId('tas-'+seed)));
      this.topProps=r.props;this.tas=(this.implantation?.tas||[]).concat(r.tas);
      // Le semis ne pousse pas sur une pile de lisière : elle reste à moitié visible.
      if(this.implantation?.tas?.length)this.topProps=this.topProps.filter(p=>!this.implantation.tas.some(t=>Math.hypot(p.x-t.x,p.y-t.y)<3.6+(this.topArt[p.id]?.wm||4)*.25));}
    // Les retouches de l'éditeur de décor : objets retirés, déplacés ou ajoutés à la main.
    if(track.def.objets){const r=appliqueObjets(track.def.objets,{impl:this.implantation,props:this.topProps,tas:this.tas});
      this.implantation=r.impl;this.topProps=r.props;this.tas=r.tas;}
    this.patches = []; // les anciens ovales de terre ne font plus partie du décor
    this.puddles = placePuddles(track, seed, track.puddles);
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
    /* La bande est dessinée À LA LARGEUR QUE LA PHYSIQUE LUI DONNE, station par station.

    `track.kerb` porte cette largeur : pleine au milieu du virage, affinée en pente douce aux deux
    bouts. Elle était peinte à largeur constante et coupée net, tandis que la règle, elle, suivait
    déjà l'affinement — si bien qu'aux extrémités la peinture promettait du vibreur là où rouler
    valait une sortie de piste. Un seul tableau pour les deux, et la promesse redevient tenable. */
    const KERB_BLOCK = graphics?.kerbBlock || 3;
    const kerbW = (i) => track.kerb[((i % N) + N) % N];
    // `dehors` : le bord extérieur de la bande, qui suit l'affinement. Sinon son bord intérieur,
    // qui longe la ligne blanche d'un bout à l'autre.
    const bandPt = (i, side, dehors) => {
      const k = ((i % N) + N) % N;
      const hw = (side > 0 ? track.hwL[k] : track.hwR[k]) + KERB_IN + (dehors ? kerbW(i) : 0);
      return [xs[k] + nx[k] * hw * side, ys[k] + ny[k] * hw * side];
    };
    const corners = track.corners.map(cn => {
      const l = new Path2D(), r = new Path2D(), gravel = new Path2D();
      const kerbs = PAL.kerb.map(() => new Path2D()), kerbEdge = new Path2D();
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = cn.from; i <= cn.to; i += 2) {
        const a = edgePt(i, 1), b = edgePt(i, -1);
        if (i === cn.from) { l.moveTo(a[0], a[1]); r.moveTo(b[0], b[1]); } else { l.lineTo(a[0], a[1]); r.lineTo(b[0], b[1]); }
        minX = Math.min(minX, a[0], b[0]); maxX = Math.max(maxX, a[0], b[0]); minY = Math.min(minY, a[1], b[1]); maxY = Math.max(maxY, a[1], b[1]);
      }
      /* La PEINTURE suit les bornes élargies du vibreur, pas celles du virage.

      `cn.from`/`cn.to` sont les bornes de la courbure, et elles dimensionnent encore la route et
      le bac. La bande, elle, déborde maintenant du virage — six mètres à l'entrée, quinze à la
      sortie — et c'est `cn.kerbFrom`/`cn.kerbTo` qui le disent. Peindre sur les anciennes bornes
      laisserait la règle autoriser quinze mètres de vibreur invisible : exactement la
      contradiction que ce fichier cherche à éviter depuis qu'il lit `track.kerb`. */
      const k0 = cn.kerbFrom, k1 = cn.kerbTo;
      for (const side of [1, -1]) {
        let block = 0;
        for (let i = k0; i < k1; i += KERB_BLOCK, block++) {
          const j = Math.min(i + KERB_BLOCK, k1);
          const p = kerbs[block % kerbs.length];
          const a0 = bandPt(i, side, false);
          p.moveTo(a0[0], a0[1]);
          for (let t = i + 1; t <= j; t++) { const q = bandPt(t, side, false); p.lineTo(q[0], q[1]); }
          for (let t = j; t >= i; t--) { const q = bandPt(t, side, true); p.lineTo(q[0], q[1]); }
          p.closePath();
        }
        // both sides of the band get the dark outline, so the strip is framed like the road is
        for (const dehors of [false, true]) {
          const e0 = bandPt(k0, side, dehors);
          kerbEdge.moveTo(e0[0], e0[1]);
          for (let t = k0 + 1; t <= k1; t++) { const q = bandPt(t, side, dehors); kerbEdge.lineTo(q[0], q[1]); }
        }
      }
      // Le profil de Spa est partagé avec les barrières, y compris ses raccords.
      const gravelW = (k,side) => track.def.barriers ? track.largeurBac(k,side) : 8;
      // gravel: wider band around the corner
      for (let i = cn.from; i <= cn.to; i += 2) { const k = ((i % N) + N) % N, p = [xs[k] + nx[k] * (track.hwL[k] + gravelW(k,1)), ys[k] + ny[k] * (track.hwL[k] + gravelW(k,1))]; if (i === cn.from) gravel.moveTo(p[0], p[1]); else gravel.lineTo(p[0], p[1]); }
      for (let i = cn.to; i >= cn.from; i -= 2) { const k = ((i % N) + N) % N; gravel.lineTo(xs[k] - nx[k] * (track.hwR[k] + gravelW(k,-1)), ys[k] - ny[k] * (track.hwR[k] + gravelW(k,-1))); }
      gravel.closePath();
      // La boîte tient compte du débordement du vibreur, sinon la bande disparaîtrait à ses deux
      // bouts dès que le virage lui-même sort du cadre.
      return { left: l, right: r, gravel, kerbs, kerbEdge, bbox: { minX: minX - 50, minY: minY - 50, maxX: maxX + 50, maxY: maxY + 50 } };
    });

    /* LE TABLIER DU CROISEMENT, et pourquoi il n'est plus un trait épais.

    Il était dessiné comme la ligne médiane strokée trois fois, de plus en plus fin : l'ombre, la
    bordure, la surface. C'est commode et c'est faux aux deux bouts — un trait a des extrémités, et
    elles se refermaient en demi-cercle, si bien que le pont se terminait en pastille au milieu de
    la piste. Une bordure n'a de sens que sur les CÔTÉS d'un tablier : dans le sens de la marche on
    entre dessus, il n'y a rien à border.

    On fabrique donc le tablier comme une vraie surface — un polygone entre ses deux bords — et on
    ne trace que les deux bords, chacun ouvert. La moitié intérieure de chaque trait disparaît sous
    le remplissage, la moitié extérieure fait la bordure, et les bouts restent francs. */
    const bridges = track.crossings.map(cr => {
      const demi = track.width / 2;
      const bord = (sens) => {
        const p = new Path2D();
        for (let i = cr.over - 16; i <= cr.over + 20; i += 2) {
          const k = (i + N) % N;
          const x = xs[k] + nx[k] * demi * sens, y = ys[k] + ny[k] * demi * sens;
          if (i === cr.over - 16) p.moveTo(x, y); else p.lineTo(x, y);
        }
        return p;
      };
      const tablier = new Path2D();
      for (let i = cr.over - 16; i <= cr.over + 20; i += 2) {
        const k = (i + N) % N;
        const x = xs[k] + nx[k] * demi, y = ys[k] + ny[k] * demi;
        if (i === cr.over - 16) tablier.moveTo(x, y); else tablier.lineTo(x, y);
      }
      for (let i = cr.over + 20; i >= cr.over - 16; i -= 2) {
        const k = (i + N) % N;
        tablier.lineTo(xs[k] - nx[k] * demi, ys[k] - ny[k] * demi);
      }
      tablier.closePath();
      return { tablier, cotes: [bord(1), bord(-1)] };
    });

    /* LES PASSERELLES. Un tablier en travers de la piste, et son ombre portée sur l'asphalte.

    Elles ne sont pas des `crossings` : un croisement, c'est la piste au-dessus d'elle-même, et la
    voiture roule dessus — ces ponts-là se peignent avant les voitures. Sous une passerelle on
    passe, donc elle se peint APRÈS, et c'est le seul moyen de faire comprendre lequel des deux est
    au-dessus. L'ombre est posée avant les voitures pour qu'elle leur passe dessous, ce qui est
    aussi la seule chose qui donne au tablier une hauteur.

    Elle déborde de part et d'autre de la route : une passerelle s'appuie sur des piles plantées
    hors piste, et un tablier qui s'arrêterait pile au bord aurait l'air posé sur les vibreurs. */
    const PASS_LARGE = 3.2;          // la largeur du tablier, dans le sens de la marche
    const PASS_DEBORD = 7;           // ce qu'il dépasse de chaque côté de la route
    const passerelles = (track.passerelles || []).map((st) => {
      const k = ((st % N) + N) % N;
      const tx = -ny[k], ty = nx[k];                   // la tangente : le long de la piste
      const demi = PASS_LARGE / 2;
      /* Le tablier se pose à sa largeur exacte, le long de la tangente, et non en sautant d'une
         station à l'autre : arrondir 1,6 m à deux stations donnait quatre mètres au lieu de trois
         deux, et la largeur d'une passerelle se voit à côté d'une voiture de quatre mètres. */
      const coin = (sens, d, dec) => {
        const hw = (sens > 0 ? track.hwL[k] : track.hwR[k]) + PASS_DEBORD;
        return [xs[k] + nx[k] * hw * sens + tx * d + dec[0], ys[k] + ny[k] * hw * sens + ty * d + dec[1]];
      };
      const quad = (dec) => {
        const p = new Path2D();
        const c = [coin(1, -demi, dec), coin(1, demi, dec), coin(-1, demi, dec), coin(-1, -demi, dec)];
        p.moveTo(c[0][0], c[0][1]);
        for (let i = 1; i < 4; i++) p.lineTo(c[i][0], c[i][1]);
        p.closePath();
        return p;
      };
      // L'ombre part en bas à gauche, comme celle du décor dans `js/props.js` : une seule source de
      // lumière pour toute la scène, sinon l'œil voit deux soleils sans savoir le nommer.
      return { pont: quad([0, 0]), ombre: quad([-1.0, 1.2]),
               bbox: { minX: xs[k] - 40, minY: ys[k] - 40, maxX: xs[k] + 40, maxY: ys[k] + 40 } };
    });

    /* LES TUNNELS. Une entrée, une sortie, et l'asphalte plus sombre entre les deux.

    Vu du dessus, un tunnel ne peut pas se montrer en cachant la voiture : le joueur perdrait la
    sienne pendant trois cents mètres. On garde donc les voitures éclairées et c'est la ROUTE qui
    s'assombrit — l'œil lit l'ombre comme un plafond. Les deux têtes sont des ouvrages pleins, posés
    en travers et peints après les voitures, exactement comme un tablier de passerelle : c'est ce
    qui dit qu'on passe dessous.

    Et la rangée de lampes. Sans elle, la portion sombre se confond avec une ombre portée ; avec
    elle, personne n'hésite. Le tunnel de Monaco est éclairé en permanence — « lit=24/7 » dans le
    relevé — et c'est la seule chose du décor qui vienne d'une étiquette plutôt que du dessin. */
    const TUN_TETE = 5;              // la profondeur de l'ouvrage d'entrée, le long de la piste
    const TUN_DEBORD = 5;            // ce qu'il dépasse de chaque côté de la route
    const TUN_LAMPE = 16;            // une paire de lampes tous les tant de mètres
    const tunnels = (track.tunnels || []).map((tu) => {
      const bord = (i, sens) => {
        const k = ((i % N) + N) % N;
        const hw = sens > 0 ? track.hwL[k] : -track.hwR[k];
        return [xs[k] + nx[k] * hw, ys[k] + ny[k] * hw];
      };
      const sol = new Path2D();
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const voir = (q) => { minX = Math.min(minX, q[0]); minY = Math.min(minY, q[1]);
                            maxX = Math.max(maxX, q[0]); maxY = Math.max(maxY, q[1]); };
      for (let d = 0; d <= tu.n; d += 2) { const q = bord(tu.from + d, 1); voir(q); d ? sol.lineTo(q[0], q[1]) : sol.moveTo(q[0], q[1]); }
      for (let d = tu.n; d >= 0; d -= 2) { const q = bord(tu.from + d, -1); voir(q); sol.lineTo(q[0], q[1]); }
      sol.closePath();

      // Les têtes : un quadrilatère en travers, débordant comme le tablier d'une passerelle.
      const tete = (i, dedans) => {
        const k = ((i % N) + N) % N;
        const tx = -ny[k], ty = nx[k];
        const coin = (sens, d) => {
          const hw = (sens > 0 ? track.hwL[k] : track.hwR[k]) + TUN_DEBORD;
          return [xs[k] + nx[k] * hw * sens + tx * d, ys[k] + ny[k] * hw * sens + ty * d];
        };
        const quad = (d0, d1) => {
          const p = new Path2D();
          const c = [coin(1, d0 * dedans), coin(1, d1 * dedans), coin(-1, d1 * dedans), coin(-1, d0 * dedans)];
          p.moveTo(c[0][0], c[0][1]);
          for (let j = 1; j < 4; j++) p.lineTo(c[j][0], c[j][1]);
          p.closePath();
          return p;
        };
        // Le corps de l'ouvrage, puis la bouche : la fente sombre côté tunnel. Sans elle, la tête
        // ressemble à un tablier de passerelle, et rien ne dit de quel côté on entre.
        return { corps: quad(0, TUN_TETE), bouche: quad(TUN_TETE - 1.3, TUN_TETE) };
      };

      // Les lampes, le long de l'axe, assez espacées pour qu'on les compte sans les subir.
      const lampes = [];
      const pas = Math.max(6, Math.round(TUN_LAMPE));
      for (let d = pas; d < tu.n - pas / 2; d += pas) {
        const k = ((tu.from + d) % N + N) % N;
        lampes.push([xs[k] + nx[k] * (track.hwL[k] - 1.1), ys[k] + ny[k] * (track.hwL[k] - 1.1)]);
        lampes.push([xs[k] - nx[k] * (track.hwR[k] - 1.1), ys[k] - ny[k] * (track.hwR[k] - 1.1)]);
      }
      return { sol, entree: tete(tu.from, 1), sortie: tete(tu.from + tu.n, -1), lampes,
               bbox: { minX: minX - 40, minY: minY - 40, maxX: maxX + 40, maxY: maxY + 40 } };
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
      /* Les bords teintés : UN BORD, UNE COULEUR, TOUT LE TOUR.

      Ils portaient le côté du VIRAGE — froid vers l'intérieur, chaud vers l'extérieur — et
      changeaient donc de bord à chaque changement de main. Le bord gauche était jaune dans une
      courbe et bleu dans la suivante, en même temps que le levier qui porte les mêmes couleurs.
      Un repère qui change de place pendant qu'on s'en sert n'est pas un repère : c'est le constat
      de Bruno, et c'est ce qui motive tout ce changement.

      Chaque bord garde donc sa couleur du départ à l'arrivée. Le jaune est la gauche du sens de
      marche, le bleu la droite — le même partage que `lines.jaune` et `lines.bleu`, par le même
      signe, de sorte que pousser le levier vers le jaune mène bien au bord jaune.

      Le découpage en tronçons selon `track.sens` disparaît avec sa raison d'être : il existait pour
      qu'un raccord traversant un changement de main ne soit pas menti sur la moitié de sa longueur,
      et il n'y a plus de changement de main à traverser. */
      const eBleu = new Path2D(), eJaune = new Path2D();
      for (const side of [1, -1]) {
        const cible = side > 0 ? eJaune : eBleu;     // lat positif = normale gauche = jaune
        for (let i = a; i <= b; i += STEP) {
          const q = edgePt(i, side);
          if (i === a) cible.moveTo(q[0], q[1]); else cible.lineTo(q[0], q[1]);
        }
      }
      chunks.push({ fill, left: lp, right: rp, mid: mp, edgeBleu: eBleu, edgeJaune: eJaune,
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
      const garages = track.pitGarages();
      for (const gr of garages) {
        const r=Math.hypot(gr.w,gr.h)/2;
        voir({x:gr.x-r,y:gr.y-r});voir({x:gr.x+r,y:gr.y+r});
      }
      return { surface, ligne, zone, garages, bbox: { minX: minX - 16, minY: minY - 16, maxX: maxX + 16, maxY: maxY + 16 } };
    })() : null;

    this.paths = { center, mid, road, left, right, corners, bridges, passerelles, tunnels, lines, chunks, pit };
    /* Ce que ce circuit-là doit encore recevoir, gardé pour qu'on puisse le DEMANDER.

    Les deux images étaient posées et oubliées : on ne retenait que la variable remplie à l'arrivée,
    donc rien dans le jeu ne pouvait répondre « le fond n'est pas encore là ». C'est pourtant ce qui
    apparaissait au feu vert sur un téléphone — le décor et le fond de carte, plusieurs centaines de
    kilo-octets, qui finissaient de descendre pendant le décompte. Voir `pretAPeindre`. */
    this.circuitGraphics=graphics?new CircuitGraphics(track,PAL,graphics):null;
    this.enRoute = [];
    this.pitImg = null;
    if (pit && !graphics?.proceduralPit) {
      const im = new Image(); im.onload = () => { this.pitImg = im; }; im.src = 'art/Pitstop.png';
      this.enRoute.push(im);
    }
    this.bgImage = null;
    if (track.image && track.image.src) {
      const img = new Image();
      img.onload = () => { this.bgImage = img; };
      img.src = track.image.src;
      this.enRoute.push(img);
    }
    this._makeMinimap();
    this.grassPattern = this.ctx.createPattern(this.grass, 'repeat');
  }

  /* Tout ce que la PREMIÈRE IMAGE de la course doit avoir sous la main.

  La barrière de chargement ne connaissait que les vignettes de voiture et les prises de moteur.
  Tout le reste du dessin arrive aussi par le réseau — le fond de carte du circuit, la halle des
  stands, les trente sprites de décor — et personne ne l'attendait : sur un téléphone, le décor
  finissait de descendre pendant le décompte et le circuit se peuplait au feu vert.

  On lit `complete` et non `naturalWidth` : il passe à vrai même quand le téléchargement a ÉCHOUÉ,
  ce qui est exactement la réponse qu'il faut ici. Un fichier absent ne doit pas retenir une course
  — il ne viendra pas — et le dessin sait déjà se passer de chacune de ces images. Ne reste que le
  téléchargement qui traîne, et c'est le seul cas qu'une barrière doive attendre. */
  pretAPeindre(race) {
    for (const im of this.enRoute || []) if (!im.complete) return false;
    return true;
  }

  _makeMinimap() {
    const T = this.track, b = T.bounds;
    const size = this.shortLandscape ? 76 : Math.min(180, Math.max(110, this.w * 0.18));
    const c = document.createElement('canvas');
    c.width = c.height = size * this.dpr;
    const g = c.getContext('2d');
    g.scale(this.dpr, this.dpr);
    const w = b.maxX - b.minX, h = b.maxY - b.minY;
    const sc = (size - 20) / Math.max(w, h);
    const ox = 10 + ((size - 20) - w * sc) / 2, oy = 10 + ((size - 20) - h * sc) / 2;
    this.mm = { canvas: c, size, sc, ox, oy };
    g.translate(ox, oy); g.scale(sc, sc); g.translate(-b.minX, -b.minY);
    // Dark schematic on the HUD paper panel; geometry is the actual circuit.
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = '#f2e6ca'; g.lineWidth = 4 / sc; g.stroke(this.paths.center);
    /* La voie des stands sur la carte, et le seul endroit du jeu où elle n'est PAS à l'échelle.

    Reprendre la géométrie réelle ne donne rien : la voie court à sept ou huit mètres du bord, ce
    qui fait moins d'un pixel à l'échelle de la carte, et elle disparaîtrait entièrement sous le
    trait de la piste, lui-même large de cinq pixels pour une piste de quinze mètres. La carte est
    déjà un schéma, pas un plan : on écarte donc la voie d'une distance CONSTANTE à l'écran, six
    pixels, quelle que soit la taille du circuit. Ce qu'elle doit dire, c'est de quel côté elle
    part et où elle se raccorde — pas à combien de mètres elle passe.

    L'écartement suit l'engagement des deux bretelles, si bien qu'elle se détache du trait et le
    rejoint aux mêmes abscisses que la vraie. Le côté vient de `pitAt`, qui la place toujours du
    côté négatif : elle ne peut pas se retrouver du mauvais bord sur un circuit et pas sur l'autre. */
    const vp = this.paths && this.paths.pit;
    this.mmPit = !!(vp && this.showPit);
    if (this.mmPit) {
      const pp = T.pit, span = T.wrap(pp.sortie - pp.entree), PAS = 2;
      // l'écart suit la taille de la carte : six pixels sur un téléphone en valent dix sur un bureau,
      // sinon la voie se détache bien sur la petite carte et se recolle à la piste sur la grande
      const ec = Math.max(5, size / 18) / sc;
      const voie = new Path2D(), arret = new Path2D();
      let prem = true, premZ = true;
      for (let d = 0; d <= span; d += PAS) {
        const sp = T.wrap(pp.entree + d), z = T.pitAt(sp);
        if (!z) continue;
        const a = T.pos(sp, -ec * z.ecart);
        if (prem) { voie.moveTo(a.x, a.y); prem = false; } else { voie.lineTo(a.x, a.y); }
        if (z.dansZone) { if (premZ) { arret.moveTo(a.x, a.y); premZ = false; } else { arret.lineTo(a.x, a.y); } }
      }
      /* Même encre que la piste, mais un trait deux fois plus fin.

      Essayée d'abord en blanc plus transparent, pour la mettre en retrait : sur le sable clair d'un
      des thèmes elle ne se distinguait plus du fond, et une voie qu'on ne voit qu'à mi-chemin ne
      dit rien. C'est la FINESSE qui la range au second plan, pas la pâleur — et comme elle porte la
      même encre que la piste, elle se lit tout de suite comme une branche du circuit. */
      g.strokeStyle = 'rgba(255,255,255,0.50)'; g.lineWidth = 2.5 / sc; g.stroke(voie);
      /* La zone d'arrêt : le même trait, plus épais et plus franc. Pas un symbole de plus.

      Essayée d'abord en pastille blanche. Une pastille blanche sur une carte où chaque voiture est
      une pastille de couleur se lit comme une voiture — une treizième, immobile, que le joueur
      cherche à identifier. En élargissant la voie là où il faut s'arrêter, l'information tient dans
      le dessin qui la porte et ne peut plus être prise pour autre chose. */
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 5 / sc; g.stroke(arret);
    }
    const p0 = T.pos(0, 0);
    g.fillStyle = 'rgba(255,212,0,0.75)'; g.beginPath(); g.arc(p0.x, p0.y, 4 / sc, 0, 7); g.fill();
  }

  mmPoint(x, y) {
    const b = this.track.bounds, m = this.mm;
    return { x: m.ox + (x - b.minX) * m.sc, y: m.oy + (y - b.minY) * m.sc };
  }

  /** Un point de la ligne idéale, à l'abscisse `s` du tour. */
  _surLigne(T, s) {
    const u = T.wrap(s);
    return T.pos(u, T.lineLat('racing', u));
  }

  /* LE CAP DE LA LIGNE IDÉALE, pris sur une corde et non sur une tangente.

  La tangente de la ligne idéale en un point la suit de trop près : la ligne ondule au mètre près,
  et la caméra se mettrait à osciller — exactement le mouvement brusque qu'on veut éviter. On prend
  donc le cap de la CORDE entre deux points distants de `pas` de part et d'autre. C'est un lissage
  géométrique, qui ne coûte rien et ne traîne pas : il ne dépend pas du temps, donc il ne crée aucun
  retard, et il ignore tout ce qui est plus court que la corde. La corde fait un cinquième du cadre,
  donc elle s'allonge avec la vitesse : plus on va vite, plus le cap est calme. */
  _capLigne(T, s, pas) {
    const a = this._surLigne(T, s - pas), b = this._surLigne(T, s + pas);
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  /** Le zoom qui donne un cadre de `m` mètres : sur la hauteur si l'écran tourne, sinon sur le
      petit côté — c'est la règle de cadrage du jeu, posée une fois pour que rien ne la redise. */
  _zoomPour(m) { return (this.rotate ? this.h : Math.min(this.w, this.h)) / m; }

  /** Les points de la ligne idéale sur `D` mètres devant `s`, échantillonnés `N + 1` fois. */
  _fenetre(T, s, D, N) {
    const pts = [];
    for (let i = 0; i <= N; i++) pts.push(this._surLigne(T, s + D * i / N));
    return pts;
  }

  updateCamera(race, dt) {
    const p = race.player, T = race.track, pos = p.pos;
    const h = T.headingAt(p.s);
    // rapportée à la pointe que le jeu laisse atteindre (`vitesseEcran`), pas à celle de la fiche
    const vf = Math.min(1, p.v / vitesseEcran(p.cls));
    // Frame a fixed distance rather than a fixed area, so a portrait phone and a desktop window
    // show the same thing. Track-aligned: metres visible ahead, down the screen height.
    // Fixed north-up: metres across the shorter screen axis.
    //
    // Twenty metres at a standstill, fifty at the car's own top speed. The camera therefore does
    // most of the work the player used to do by hand: close enough on the grid to see the car,
    // and far enough at speed to see what is coming. It reads the speed as a fraction of THIS
    // car's maximum — capped at what the game lets anyone reach, see `vitesseEcran` — so a slow GT
    // and a fast prototype both get the full range, which is also why the per-category zoom factor
    // is gone.
    const near = this.rotate ? 30 : 20;
    const far = this.rotate ? 75 : 50;
    /* LES VUES EN AVANCE CADRENT PLUS LARGE, et c'est le levier principal — pas l'avance.

    Mesuré : avec le cadre d'origine, la piste visible devant la voiture en continu ne faisait que
    25 à 35 m, et 10 m au pire. À 200 km/h c'est une demi-seconde de préavis : on ne voit pas venir
    le virage, quelle que soit la place de la voiture à l'écran. La raison est que sur un téléphone
    en portrait le cadre ne fait qu'une trentaine de mètres EN LARGEUR, et qu'un virage sort de cette
    bande en quelques dizaines de mètres. Descendre la voiture ne gagne rien là-dessus : elle libère
    de la hauteur, et ce qui manquait était la largeur.

    Un tiers de cadre en plus fait passer la piste vue de 30 à 50 m à Zandvoort, de 25 à 40 m en vue
    fixe. Un demi-cadre en plus donnerait 65 m, mais la voiture devient petite et la vue cesse d'être
    une vue de course ; un tiers est le point où les deux tiennent encore ensemble. */
    const metres = (near + (far - near) * vf) * this.pullBack * (this.avance ? 1.35 : 1);
    let zoomTarget = (this.rotate ? this.h : Math.min(this.w, this.h)) / metres;
    this.framing = metres;           // what the screen actually shows, in metres
    // How far ahead of the car the camera looks, tied to the frame rather than to a fixed number
    // of metres: what matters is where the car sits on screen, and that only means something
    // relative to what the screen shows. Nothing at a standstill — the car stays centred on the
    // grid — up to half the frame at top speed, which puts it a quarter of the way down.
    const lead = metres * 0.5 * vf;
    let tx = pos.x + Math.cos(h) * lead, ty = pos.y + Math.sin(h) * lead;
    // camera heading follows the slot direction (not the car body), so a drift never spins the view
    let want = T.headingAt(p.s + lead * 0.6);

    /* LA CAMÉRA EN AVANCE SUIT LA LIGNE IDÉALE, pas la voiture et pas le cap.

    Les deux vues d'origine placent la caméra DEVANT la voiture, le long de son cap : un point à
    tant de mètres droit devant. En ligne droite les deux reviennent au même, et dans un virage
    non : droit devant, c'est l'extérieur du virage, c'est-à-dire le décor. Plus on va vite, plus on
    regarde loin, et plus on regarde à côté — exactement au moment où on aurait besoin de voir la
    suite. Ici la caméra se pose sur la LIGNE IDÉALE, `avance` mètres plus loin le long du tour.
    Elle prend donc le virage avant la voiture et montre la sortie pendant qu'on est encore à
    l'entrée.

    ADHÉRENCE PARFAITE, et gratuitement : ce point n'est pas simulé, il est calculé. Il se pose sur
    la ligne à l'abscisse voulue, donc il ne glisse jamais, ne sous-vire ni ne survire, et ne tremble
    pas quand la voiture tremble. La caméra ne reproduit pas les erreurs du joueur.

    MESURÉE LE LONG DU TOUR, pas à vol d'oiseau. Dans une épingle, cinquante mètres de piste ne font
    que vingt mètres en ligne droite : la caméra se rapproche d'elle-même là où le circuit se replie,
    ce qui est précisément là où on ne veut pas qu'elle parte loin.

    LE BARYCENTRE DE LA PISTE À VENIR, PAS UN POINT DESSUS. Viser un point `avance` mètres plus
    loin met ce point au milieu de l'écran — donc met le virage au BORD du cadre, moitié dedans
    moitié dehors. En visant le centre de gravité du morceau de ligne à venir, l'entrée et la sortie
    y tiennent ensemble : c'est ce que fait un cameraman qui cadre une action, pas un point mais
    l'étendue qu'elle occupe. Mesuré, ça vaut dix mètres de piste visible en plus, à cadre égal.

    Dans une ligne droite le barycentre tombe sur la ligne, à la moitié de la fenêtre : l'avance y
    vaut donc la moitié de la fenêtre, de 20 % du cadre à l'arrêt à 55 % à pleine vitesse. Dans un
    virage il tombe du côté de la corde, ce qui rapproche la caméra — exactement là où il ne faut pas
    qu'elle parte loin. La fenêtre, elle, s'allonge avec la vitesse ET avec le cadre, donc l'avance
    grandit deux fois. */
    if (this.avance) {
      /* La fenêtre est plus courte en vue fixe, et le plafond plus serré.

      Le nord y reste en haut, donc la voiture ne descend pas : elle part dans la DIRECTION où elle
      roule, c'est-à-dire n'importe où, y compris dans les quatre coins — où vivent le classement, le
      chrono et le levier. Mesuré à Zandvoort, elle finissait derrière le classement, invisible. En
      vue orientée piste la question ne se pose pas : « devant » est toujours le haut de l'écran, et
      le haut est vide. La vue fixe prend donc une avance plus courte et reste dans la bande
      centrale ; c'est le cadre élargi, pas la place de la voiture, qui lui fait voir le virage. */
      const D = metres * (this.rotate ? 0.32 + 0.58 * vf : 0.24 + 0.40 * vf);
      const N = 12;
      const pts = this._fenetre(T, p.s, D, N);
      let sx = 0, sy = 0;
      for (const q of pts) { sx += q.x; sy += q.y; }
      tx = sx / pts.length; ty = sy / pts.length;
      want = this._capLigne(T, p.s + D * 0.5, metres * 0.22);

    }
    if (!this.cam.init) this.camAngle = want;
    else {
      let da = want - this.camAngle;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      this.camAngle += da * Math.min(1, dt * (this.avance ? 2 : 3.5));
    }
    /* LE LISSAGE PORTE SUR L'ÉCART, pas sur la position — et c'est ce qui rend l'avance réelle.

    Un filtre du premier ordre qui poursuit une position absolue traîne derrière une cible qui
    avance : à vitesse constante v, le retard s'installe à v / k mètres. Avec k = 4, ça fait dix-sept
    mètres à 250 km/h. Or l'avance demandée en valait vingt-quatre : le lissage en mangeait les
    trois quarts, et la voiture restait au milieu de l'écran quoi qu'on demande. Plus on lissait,
    moins il restait d'avance — les deux réglages se battaient.

    En lissant l'ÉCART voiture-caméra, le déplacement de la voiture est suivi exactement et seul le
    CHANGEMENT d'écart est amorti. Le retard de vitesse disparaît, l'avance demandée est l'avance
    obtenue, et on peut alors lisser beaucoup plus fort sans rien perdre : c'est pour ça que les vues
    en avance tournent à k = 2 là où les anciennes sont à 4. Elles gardent leur lissage absolu : leur
    comportement est connu, et le retard y tient lieu d'amortisseur. */
    const k = Math.min(1, dt * (this.avance ? 2 : 4));
    if (!this.cam.init) {
      this.cam.x = tx; this.cam.y = ty; this.cam.zoom = zoomTarget; this.cam.init = true;
      this.cam.ox = tx - pos.x; this.cam.oy = ty - pos.y;
    } else if (this.avance) {
      this.cam.ox += (tx - pos.x - this.cam.ox) * k;
      this.cam.oy += (ty - pos.y - this.cam.oy) * k;
      this.cam.x = pos.x + this.cam.ox;
      this.cam.y = pos.y + this.cam.oy;
      this.cam.zoom += (zoomTarget - this.cam.zoom) * Math.min(1, dt * 1.5);
    } else {
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
      this.cam.zoom += (zoomTarget - this.cam.zoom) * Math.min(1, dt * 1.5);
    }

    /* LE PLAFOND, et c'est lui qui rend la vue utilisable.

    Suivre l'axe de la piste `avance` mètres plus loin met la caméra où il faut, mais rien ne dit
    que la voiture tient encore dans le cadre : dans un virage, le point visé part de côté, et sur un
    téléphone en portrait l'écran ne montre qu'une quarantaine de mètres en largeur. Mesuré sur un
    tour de Monza, la voiture sortait de l'écran par le côté — 150 % du demi-écran.

    On borne donc l'écart voiture-caméra DANS LE REPÈRE DE L'ÉCRAN, chaque axe contre sa propre
    moitié. C'est ce qui permet de garder toute l'avance vers le haut de l'écran, où il y a de la
    place, tout en coupant l'excursion latérale, où il n'y en a pas. Un plafond rond sur la distance
    aurait rogné les deux, donc l'avance en ligne droite aussi, c'est-à-dire ce qu'on cherchait.

    IL PORTE SUR LA CAMÉRA, PAS SUR SA CIBLE, et c'est tout le sujet. Posé sur la cible, il ne
    changeait rien : l'excursion ne vient pas de l'endroit visé mais du RETARD de la caméra, qui
    rejoint sa cible en un quart de seconde pendant qu'une voiture traverse la piste. Borner la cible
    laisse donc la voiture sortir par le côté exactement comme avant. Borné ici, après le lissage,
    l'écart ne peut plus dépasser le cadre quoi qu'il arrive — au pire la voiture pousse la caméra.

    IL S'APPLIQUE AUX QUATRE VUES, et pas seulement aux deux nouvelles. Le banc, écrit pour celles-ci,
    a trouvé le même défaut dans la plus ancienne : « dessus, orientée piste » sortait la voiture de
    l'écran sur SEPT circuits sur douze, jusqu'à 122 % du demi-écran, sur un téléphone en portrait.
    Personne ne l'avait vu parce que ça dure deux images au point de corde d'un virage rapide, et
    parce qu'on joue rarement en portrait. Le plafond ne change rien au reste de son comportement :
    mesurée, elle n'utilise que 18 % de la hauteur disponible, donc seule la borne latérale la
    touche, et seulement là où elle était fautive. */
    {
      const a = this.rotate ? -this.camAngle - Math.PI / 2 : 0;
      const c = Math.cos(a), si = Math.sin(a);
      let dx = this.cam.x - pos.x, dy = this.cam.y - pos.y;
      let ex = dx * c - dy * si, ey = dx * si + dy * c;
      const demiL = (this.w / this.cam.zoom) / 2 * (this.avance ? (this.rotate ? 0.72 : 0.56) : 0.62);
      const demi = (this.h / this.cam.zoom) / 2;
      // ey < 0 : la caméra est DEVANT, donc la voiture est BASSE sur l'écran. Les deux sens n'ont
      // pas le même prix : vers l'avant il y a tout l'écran à gagner, vers l'arrière il n'y a rien
      // à voir. Les vues en avance ouvrent donc largement devant — la voiture peut descendre jusqu'à
      // 86 % de la hauteur — et restent serrées derrière. Les deux anciennes gardent le plafond
      // symétrique qu'elles avaient, il ne les touche que sur le côté.
      // L'asymétrie n'a de sens que dans un repère ÉCRAN. Sans rotation, `ey` est l'axe nord-sud du
      // MONDE : une borne asymétrique y pencherait la caméra vers le nord, ce qui ne veut rien dire.
      // La vue « en avance, fixe » garde donc un plafond symétrique, et c'est la borne latérale,
      // elle aussi élargie, qui l'encadre.
      const asym = this.avance && this.rotate;
      const avant = demi * (asym ? 0.62 : 0.56);
      const arriere = demi * (asym ? 0.30 : 0.56);
      ex = clamp(ex, -demiL, demiL);
      ey = clamp(ey, -avant, arriere);
      dx = ex * c + ey * si; dy = -ex * si + ey * c;
      this.cam.x = pos.x + dx; this.cam.y = pos.y + dy;
      // L'écart borné est réinjecté dans le filtre, sinon il continue d'intégrer contre le plafond
      // et la caméra reste collée dessus bien après le virage.
      if (this.avance) { this.cam.ox = dx; this.cam.oy = dy; }
    }
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

      const rolling = race.state === 'racing' || race.state === 'finishing';
      const onRoad = rolling && (car.state === 'ok' || car.runoffAsphalt) && !car.inPit;
      const spin = onRoad ? clamp(car.patineFx || 0, 0, 1) : 0;
      const slip = onRoad ? 1 - (1 - clamp(car.slide, 0, 1)) * (1 - spin * 0.85) : 0;
      const speed = Math.abs(car.v);
      // Deux traces arrière : la teinte suit l'effort, même en patinage sans dérive.
      // Sans déplacement, on ne superpose pas une trace sur place à chaque image.
      if (slip > 0.08 && speed > 0.5) {
        for (const w of [-1, 1]) {
          const b = wheel(w);
          this._layRubber(b[0], b[1], h, speed * dt * 1.2 + 0.3, slip);
        }
      }
      // Le patinage réel remplace l'ancienne fumée automatique à basse vitesse.
      // Un débit par seconde garde la même densité lorsque le téléphone ralentit.
      const expected = slip > 0.15 ? 24 * slip * slip * Math.min(dt, 0.1) : 0;
      const count = Math.floor(expected) + (Math.random() < expected % 1 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const b = wheel(Math.random() < 0.5 ? -1 : 1);
        this._puff(
          b[0] - cs * 0.7 + (Math.random() - 0.5) * 0.7, b[1] - sn * 0.7 + (Math.random() - 0.5) * 0.7,
          -cs * (1 + speed * 0.1) - side * lx * car.slide + (Math.random() - 0.5),
          -sn * (1 + speed * 0.1) - side * ly * car.slide + (Math.random() - 0.5),
          0.3 + slip * 0.4 + Math.random() * 0.3, 0.45 + slip * 0.4, '222,222,226');
      }
      if (car.state === 'grass' && !car.runoffAsphalt) {
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
    // Effacer les anciennes voitures, pas trois millions de pixels transparents.
    this.carCtx.setTransform(1, 0, 0, 1, 0, 0);
    for (const r of this.carRects) this.carCtx.clearRect(r.x, r.y, r.w, r.h);
    this.carRects = [];
    // la voie ne se dessine que quand elle sert : une voie peinte qui ne mène à rien est pire
    // qu'une voie absente, on la vise et il ne se passe rien
    this.showPit = !!race.usure;
    /* La carte est une image en cache : si la voie des stands apparaît, il faut la repeindre.
    Sans ça, activer l'usure ajoutait la voie au monde mais pas à la carte, qui gardait le tracé
    peint au chargement du circuit — une carte qui décrit un autre réglage que celui qu'on joue. */
    if (this.mm && this.mmPit !== !!(this.paths && this.paths.pit && this.showPit)) this._makeMinimap();
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

    if (this.rotate) g.rotate(-this.camAngle - Math.PI / 2);
    g.scale(cam.zoom, cam.zoom);
    g.translate(-cam.x, -cam.y);
    // conservative square view box: valid whatever the camera rotation
    const reach = Math.hypot(W, H) / 2 / cam.zoom + 60;
    const vis = { minX: cam.x - reach, maxX: cam.x + reach, minY: cam.y - reach, maxY: cam.y + reach };
    const inView = (b) => !(b.maxX < vis.minX || b.minX > vis.maxX || b.maxY < vis.minY || b.minY > vis.maxY);

    // background
    if (this.bgImage) {
      g.fillStyle = '#3b4a2f'; g.fillRect(vis.minX, vis.minY, vis.maxX - vis.minX, vis.maxY - vis.minY);
      const sc = T.unitScale;
      g.imageSmoothingEnabled = true;
      g.drawImage(this.bgImage, 0, 0, this.bgImage.naturalWidth * sc, this.bgImage.naturalHeight * sc);
    } else {
      g.fillStyle = this.circuitGraphics ? PAL.grass : this.grassPattern;
      g.save(); g.scale(1 / 8, 1 / 8); g.fillRect(vis.minX * 8, vis.minY * 8, (vis.maxX - vis.minX) * 8, (vis.maxY - vis.minY) * 8); g.restore();
      if(this.circuitGraphics)this.circuitGraphics.drawTerrain(g,vis);else this._drawDryGrass(g, vis);
      this._drawImplantationSol(g, vis);
      this._drawSea(g, vis);
    }

    g.lineCap = 'round'; g.lineJoin = 'round';
    if (T.drawRoad) {
      // gravel traps first, then the road itself with a heavy dark outline: the cartoon look
      // comes from flat colours and hard edges rather than shading
      if(this.barrierGravel){g.fillStyle=PAL.gravel;g.fill(this.barrierGravel);}
      else for (const cn of this.paths.corners) { if (!inView(cn.bbox)) continue; g.fillStyle = PAL.gravel; g.fill(cn.gravel); }
      if(this.circuitGraphics)this.circuitGraphics.drawGravel(g,vis,this.cam.zoom);
      if(this.runoffAsphalt){
        g.fillStyle=PAL.runoff || '#777681';g.fill(this.runoffAsphalt);
        if(this.circuitGraphics)this.circuitGraphics.drawRunoff(g,vis,this.cam.zoom,this.runoffAsphalt);
        if(this.runoffBandes)for(const b of this.runoffBandes){g.fillStyle=b.col;g.fill(b.path);}
        for(let i=0;i<this.runoffPaint.length;i++){g.fillStyle=PAL.kerb[i];g.fill(this.runoffPaint[i]);}
      }
      // Separate fills prevent opposite polygon winding from cutting holes in overlaps.
      for(const pad of this.runoffPads||[]){g.fillStyle=pad.surface==='gravel'?PAL.gravel:(PAL.runoff||'#777681');g.fill(pad.path);}
      // Seuls les tronçons en vue : la caméra montre une cinquantaine de mètres d'un circuit qui
      // en fait des milliers, et tout le reste ne sert qu'à occuper le rasteriseur.
      const vus = this.paths.chunks.filter(c => inView(c.bbox));
      g.strokeStyle = PAL.outline; g.lineWidth = T.def.graphics?.roadOutlineWidth ?? 3.6;
      for (const c of vus) { g.stroke(c.left); g.stroke(c.right); }
      g.fillStyle = PAL.asphalt;
      for (const c of vus) g.fill(c.fill);
      if(this.circuitGraphics)this.circuitGraphics.drawRoad(g,vis,this.cam.zoom);
      // kerbs, laid over the road's dark outline so the band reads as one crisp edge
      g.save();
      g.lineJoin = 'miter'; g.lineCap = 'butt'; g.miterLimit = 3;
      for (const cn of this.paths.corners) {
        if (!inView(cn.bbox)) continue;
        for (let k = 0; k < cn.kerbs.length; k++) { g.fillStyle = PAL.kerb[k]; g.fill(cn.kerbs[k]); }
        g.strokeStyle = PAL.outline; g.lineWidth = T.def.graphics?.kerbOutlineWidth ?? 0.34; g.stroke(cn.kerbEdge);
      }
      g.restore();
    drawYellowFlagZones(g,race,p=>p,T.halfWidth*2,.55);
    // painted markings: the edges say which side of the corner they are, dashed yellow down the middle
      g.lineWidth = 0.55; // Repères de gameplay bleu/jaune : largeur conservée.
      g.strokeStyle = PAL.edgeBleu || PAL.edgeLine;
      for (const c of vus) g.stroke(c.edgeBleu);
      g.strokeStyle = PAL.edgeJaune || PAL.edgeLine;
      for (const c of vus) g.stroke(c.edgeJaune);
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
      if (vp && (this.showPit || this.circuitGraphics) && inView(vp.bbox)) {
        g.strokeStyle = PAL.outline; g.lineWidth = 2.6; g.stroke(vp.surface);
        g.fillStyle = PAL.pitLane || '#3a3a44'; g.fill(vp.surface);
        // la zone d'arrêt : un pavé plus clair, bordé, qu'on repère en arrivant
        g.fillStyle = PAL.pitBox || 'rgba(255,212,0,0.16)'; g.fill(vp.zone);
        g.strokeStyle = PAL.pitBoxLine || '#ffd400'; g.lineWidth = 0.5; g.stroke(vp.zone);
        g.strokeStyle = PAL.edgeLine; g.lineWidth = 0.5; g.stroke(vp.ligne);
        if(this.circuitGraphics)this.circuitGraphics.drawPitGarages(g,vp.garages);
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
    if(this.circuitGraphics)this.circuitGraphics.drawGrid(g);
    this._drawStartLine(g, T);
    this._drawBoards(g, T, vis); // chiffres et flèches de gameplay conservés, sans panneau ajouté
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
    /* L'asphalte du tunnel s'assombrit AVANT les voitures : on passe dessous, mais on reste visible.

    Et avant les ponts de croisement, ce qui n'est pas un détail. À Suzuka, la portion couverte EST
    le passage sous le croisement : les deux se superposent à l'écran, et dans l'autre ordre le
    tablier du pont — la piste par-dessus, où l'on roule — se retrouvait assombri par le tunnel qui
    passe dessous. Le pont se peint donc par-dessus, et chacun retrouve son étage. */
    for (const tu of this.paths.tunnels || []) {
      if (!inView(tu.bbox)) continue;
      g.fillStyle = 'rgba(8,8,14,0.55)'; g.fill(tu.sol);
      g.fillStyle = 'rgba(255,208,128,0.9)';
      for (const l of tu.lampes) { g.beginPath(); g.arc(l[0], l[1], 0.7, 0, Math.PI * 2); g.fill(); }
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
    this._drawTas(g, vis);              // sous les couronnes : un feuillage passe au-dessus d'une pile
    this._drawImplantation(g, vis);
    this._drawTopProps(g, vis);
    this._drawBarriers(g, vis);
    for (const p of this.paths.passerelles) {
      if (!inView(p.bbox)) continue;
      g.fillStyle = 'rgba(30,26,20,0.22)'; g.fill(p.ombre);
    }
    /* LES VOITURES, DE PART ET D'AUTRE DU TABLIER.

    Un croisement, c'est la piste au-dessus d'elle-même : au même endroit de l'écran il y a deux
    morceaux de circuit, l'un sur l'autre. Le tablier se peignait avant toutes les voitures, et
    celle qui passait DESSOUS se retrouvait dessinée par-dessus le pont — on la voyait rouler sur
    la piste du haut sans y être. C'est le seul endroit du jeu où l'ordre de dessin ment sur la
    position.

    On sépare donc en deux : celles qui sont SUR le tablier, et toutes les autres. Les autres, puis
    le tablier, puis celles du dessus. Une voiture du dessous disparaît alors sous le pont, comme
    elle doit, et ressort de l'autre côté.

    `cr.over` est le milieu du croisement et le tablier va de −16 à +20 stations ; une station vaut
    un mètre, et `T.idx` ramène l'abscisse curviligne à une station. */
    const dessus = [], dessous = [];
    const pont = this.paths.bridges.length ? T.crossings : [];
    for (const car of race.cars.slice().sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0))) {
      // le joueur passe en dernier dans chaque groupe : deux voitures qui se touchent, c'est la
      // sienne qu'on veut voir
      const k = T.idx(car.s);
      const sur = pont.some((cr) => ((k - (cr.over - 16)) % T.n + T.n) % T.n <= 36);
      (sur ? dessus : dessous).push(car);
    }
    for (const car of dessous) this._drawCar(g, car);
    if (T.drawRoad) for (const b of this.paths.bridges) {
      // bouts francs : c'est tout l'intérêt de ne border que les côtés
      g.lineCap = 'butt'; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 5;
      for (const c of b.cotes) g.stroke(c);
      g.strokeStyle = '#2f2f36'; g.lineWidth = 2.4;
      for (const c of b.cotes) g.stroke(c);
      g.fillStyle = '#4b4b52'; g.fill(b.tablier);
      this._hideCars(g, b.tablier);
      g.lineCap = 'round';
    }
    if(T.drawRoad&&pont.length)this._drawBarriers(g,vis,1);
    for (const car of dessus) this._drawCar(g, car);
    // et le tablier par-dessus les voitures : c'est ce qui dit qu'on passe dessous
    for (const p of this.paths.passerelles) {
      if (!inView(p.bbox)) continue;
      g.fillStyle = '#17171c'; g.fill(p.pont);
      this._hideCars(g, p.pont);
      g.strokeStyle = '#2e2e36'; g.lineWidth = 0.5; g.stroke(p.pont);
    }
    // et les têtes de tunnel, pour la même raison : une voiture qui passe dessous passe dedans
    for (const tu of this.paths.tunnels || []) {
      if (!inView(tu.bbox)) continue;
      for (const t of [tu.entree, tu.sortie]) {
        g.fillStyle = '#726d64'; g.fill(t.corps);          // du béton, pas un tablier : il faut
        this._hideCars(g, t.corps);
        g.strokeStyle = '#8d887c'; g.lineWidth = 0.6;        // qu'une tête de tunnel tranche sur
        g.stroke(t.corps);                                   // l'asphalte sombre qu'elle annonce
        g.fillStyle = '#0e0e13'; g.fill(t.bouche);
        this._hideCars(g, t.bouche);
      }
    }
    if(!race.opts.spectator||ui.app.spectator?.effectiveMode!=='full')drawMapRaceFlags(g,race,p=>p,7/cam.zoom,true);
    g.restore();

    const hud = this.hudCtx;
    hud.setTransform(1, 0, 0, 1, 0, 0);
    hud.clearRect(0, 0, this.hudCanvas.width, this.hudCanvas.height);
    hud.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!race.opts.spectator) this._drawHUD(hud, race, ui);
    else ui.app.spectator?.drawMap(hud, race);
    if (race.netDrive && ui.app.net?.link) {
      const label = ui.app.net.link.label(), x = this.w - 10, y = this.h - 10;
      hud.save(); hud.font = 'bold 11px system-ui'; hud.textAlign = 'right'; hud.textBaseline = 'bottom';
      hud.fillStyle = 'rgba(10,12,20,.75)'; hud.fillRect(x - hud.measureText(label).width - 12, y - 19, hud.measureText(label).width + 20, 24);
      hud.fillStyle = '#f3ead2'; hud.fillText(label, x, y); hud.restore();
    }
  }

  // Optional braking guide (off by default): the ribbon ahead is coloured by the reference speed
  // profile (green where the car can be flat out, red for a slow corner) and a transverse bar marks
  // where braking must start at the current speed. No driving lines are drawn on the road.
  _drawGuide(g, race) {
    const T = race.track, p = race.player;
    // le vert dit « plein gaz » : proche de la pointe qu'on atteint en jeu, pas de celle de la fiche
    const ahead = 240, step = 4, vmax = vitesseEcran(p.cls);

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

  /* LES INDICATIONS SE PEIGNENT SUR LA PISTE, pas sur un panneau au bord.

  Le panneau planté au bas-côté a un défaut que la caméra ne peut pas réparer : il est là OÙ ON NE
  REGARDE PAS. Le regard suit la route, et un panneau est, par construction, à côté d'elle — sur un
  téléphone en portrait, souvent hors du cadre au moment exact où il servirait. Peint au sol, il est
  dans l'axe du regard et il arrive sous la voiture : on ne peut pas le manquer.

  C'est aussi ce que fait la route réelle, et pour la même raison : les chevrons, les flèches de
  rabattement et les chiffres de distance des circuits sont au sol. On reprend donc leur grammaire —
  pas de cadre, pas de fond, de la peinture claire usée par le passage, et un marquage ÉTIRÉ dans le
  sens de la marche, parce qu'il se lit en l'abordant et non en le survolant.

  Le marquage est dimensionné sur la LARGEUR DE LA PISTE, pas en mètres fixes : une épingle étroite
  de Monaco et la ligne droite du Mans n'ont pas la même échelle, et un marquage de taille constante
  aurait débordé sur l'une et disparu sur l'autre. */
  _drawBoards(g, T, vis) {
    const boards = T.boards;
    if (!boards || !boards.length) return;
    const specs = Renderer.ARROWS;
    for (const b of boards) {
      const cx = b.cx != null ? b.cx : b.x, cy = b.cy != null ? b.cy : b.y;
      if (cx < vis.minX - 24 || cx > vis.maxX + 24 || cy < vis.minY - 24 || cy > vis.maxY + 24) continue;
      const spec = specs[b.kind && b.kind !== 'normal' ? b.kind : b.grade] || specs[3];
      const hw = b.hw || 6;
      const W = hw * 1.25;               // le marquage occupe un peu plus de la moitié de la largeur
      const L = W * 1.7;                 // étirée dans le sens de la marche, comme un vrai marquage
      g.save();
      g.translate(cx, cy);
      g.rotate(b.th + Math.PI / 2);      // le haut du marquage pointe là où la piste va
      /* LA PEINTURE EST SOUS LES VOITURES ET SOUS LES LIGNES, donc translucide et sans contour.
      Un marquage opaque au milieu de la piste se lirait comme un obstacle ; usé, il se lit comme ce
      qu'il est — de la peinture sur du bitume. L'alpha est posé ici une fois pour la flèche et le
      chiffre, pour qu'ils vieillissent ensemble. */
      g.globalAlpha = 0.82;
      /* SANS CHIFFRE, LA FLÈCHE SE RECENTRE.

      Deux virages qui s'enchaînent sont à moins de cinquante mètres l'un de l'autre : annoncer une
      distance y serait faux, et l'arrondir à 50 mentirait. L'indication se réduit alors à ce qu'elle
      a de vrai — le sens et la sévérité — et le marquage se resserre autour de la flèche au lieu de
      garder un vide là où le chiffre aurait dû être. Un blanc réservé à rien se lit comme un
      défaut. */
      const chiffre = b.dist > 0;
      Renderer.paceArrow(g, { x: 0, y: L * (chiffre ? -0.28 : -0.08), w: W, h: L * (chiffre ? 0.46 : 0.58) },
        spec, b.sign > 0 ? 1 : -1, { col: '#f0ece4', epais: 0.78 });
      g.save();
      g.scale(1 / 16, 1 / 16);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round';
      // un liseré sombre sous le texte : la peinture claire sur bitume sombre a besoin d'un bord,
      // sinon elle bave sur les bandes de rive au moment où on roule dessus
      const peindre = (txt, taille, y, col) => {
        g.font = `bold ${taille}px "Trebuchet MS", "DejaVu Sans", sans-serif`;
        g.strokeStyle = 'rgba(12,10,18,0.55)'; g.lineWidth = taille * 0.17;
        g.strokeText(txt, 0, y * 16);
        g.fillStyle = col;
        g.fillText(txt, 0, y * 16);
      };
      if (chiffre) peindre(String(b.dist), Math.round(W * 0.42 * 16), L * 0.14, '#f0ece4');
      // les virages nommés le disent, comme sur une note de rallye
      if (spec.tag) peindre(spec.tag, Math.round(W * 0.25 * 16), L * (chiffre ? 0.34 : 0.30), '#f0ece4');
      g.restore();
      g.globalAlpha = 1;
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
      // LA CHICANE n'est pas une sévérité mais une FORME : on tourne d'un côté puis on revient. Elle
      // a donc son glyphe en S — `bend2` replie la courbe dans l'autre sens — et sa couleur sort du
      // dégradé vert-rouge des notes, qui dit « plus ou moins serré » et ne s'applique pas ici.
      // Gauche ou droite se lit du premier pli, comme pour toutes les autres : c'est `sign`.
      chicane: { stem: 0.9, bend: 85, r: 0.3, bend2: 85, r2: 0.3, tail: 0.6, col: '#2f8fb5', tag: 'CH' },
    };
  }

  // Builds the glyph, measures it, then fits it to the box it is given, so a hairpin and a kink
  // both fill the panel instead of one spilling over the edge and the other floating in the middle.
  static paceArrow(g, box, spec, dir, opts) {
    /* LA COULEUR ET L'ÉPAISSEUR SE DEMANDENT, elles ne sont plus dans la note.

    Le dégradé vert-rouge des notes disait la sévérité une deuxième fois, après le pliage de la
    flèche qui la dit déjà. Sur la route, il la faisait surtout ressembler à un pictogramme posé là :
    une route n'a pas de peinture verte. En blanc, et plus épaisse, elle se lit comme ce qu'elle
    prétend être — du marquage au sol. Le choix de la note garde ses couleurs dans l'éditeur, sur les
    BOUTONS, là où elles servent à choisir plutôt qu'à décorer. */
    const col = (opts && opts.col) || spec.col;
    const epais = (opts && opts.epais) || 0.42;
    const bend = spec.bend * Math.PI / 180;
    const a0 = dir > 0 ? Math.PI : 0, a1 = a0 + dir * bend;
    const cx = dir * spec.r, cy = -spec.stem;
    const path = [[0, 0], [0, -spec.stem]];
    const STEPS = 18;
    for (let i = 1; i <= STEPS; i++) {
      const a = a0 + (a1 - a0) * i / STEPS;
      path.push([cx + spec.r * Math.cos(a), cy + spec.r * Math.sin(a)]);
    }
    let te = a1 + dir * Math.PI / 2;                         // where the arrow ends up pointing
    let [px, py] = path[path.length - 1];
    /* LE SECOND PLI, pour la chicane et elle seule. On repart du point courant, dans la direction
       courante, et on tourne de l'autre côté : le centre du nouvel arc est à `r2` sur la gauche ou
       la droite du cap selon le sens, et l'arc commence à l'opposé de ce rayon. Écrit comme ça,
       il n'y a rien à ajuster quand le premier pli change — le second part toujours d'où le
       premier arrive. */
    if (spec.bend2) {
      const d2 = -dir, b2 = spec.bend2 * Math.PI / 180, r2 = spec.r2 || spec.r;
      const cx2 = px + r2 * Math.cos(te + d2 * Math.PI / 2);
      const cy2 = py + r2 * Math.sin(te + d2 * Math.PI / 2);
      const s2 = te - d2 * Math.PI / 2;
      for (let i = 1; i <= STEPS; i++) {
        const a = s2 + d2 * b2 * i / STEPS;
        path.push([cx2 + r2 * Math.cos(a), cy2 + r2 * Math.sin(a)]);
      }
      te += d2 * b2;
      [px, py] = path[path.length - 1];
    }
    const ex = px + Math.cos(te) * spec.tail, ey = py + Math.sin(te) * spec.tail;
    path.push([ex, ey]);
    // The head is a fixed size on the panel, not a fraction of the glyph: a kink and a hairpin are
    // drawn at very different scales, and a head that shrank with the glyph vanished on the open
    // notes, leaving a bar with no direction. Fitting therefore takes two passes — one to learn
    // the scale, one that knows how much room the head will take at that scale.
    const HLp = 0.95 * (epais / 0.42), HWp = 0.52 * (epais / 0.42);   // head, in panel units
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
    g.strokeStyle = col; g.fillStyle = col;
    g.lineWidth = epais / sc; g.lineCap = 'round'; g.lineJoin = 'round';
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
    for(const f of w.spec.piers||[]){
      const s=f*this.track.length,side=w.spec.side,lat=Math.max((side>0?this.track.hwLeftAt(s):this.track.hwRightAt(s))+w.spec.gap,this.track.limiteProtection(s,side)+6);
      const a=this.track.pos(s,side*(lat+2)),b=this.track.pos(s,side*(lat+34));
      if(!waterContains(w,b.x,b.y))continue;
      g.strokeStyle='#e1dcd0';g.lineWidth=2.5;g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();
    }
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

  _drawDryGrass(g,vis) {
    if(this.track.theme==='riviera')return;
    const cell=120,seed=this.track.id||this.track.name;
    g.fillStyle=this._melange(PAL.grass,'#cbb66d',.46);
    for(let x=Math.floor(vis.minX/cell)-1;x<=Math.floor(vis.maxX/cell)+1;x++)for(let y=Math.floor(vis.minY/cell)-1;y<=Math.floor(vis.maxY/cell)+1;y++){
      const rnd=propRng(seedFromId('dry-'+seed+'-'+x+','+y));
      if(rnd()>.17)continue;
      const cx=(x+rnd())*cell,cy=(y+rnd())*cell,r=18+rnd()*25;
      g.beginPath();
      for(let j=0;j<7;j++){
        const a=j/7*Math.PI*2,d=r*(.75+rnd()*.4),px=cx+Math.cos(a)*d,py=cy+Math.sin(a)*d*.62;
        if(j)g.lineTo(px,py);else g.moveTo(px,py);
      }
      g.closePath();g.fill();
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

  /* Le sol de l'implantation, peint avec le terrain et donc sous la route.

  Un bois a son sous-bois, un parking et un paddock leur bitume, une tribune sa dalle. La couleur
  vient du thème : le sous-bois des Ardennes n'est pas celui du parc royal. Le contour est un
  polygone fermé, pas une bande tracée au pinceau, sinon les bouts dépassent en arrondi. */
  _drawImplantationSol(g, vis) {
    const im = this.implantation;
    if (!im) return;
    for (const z of im.sols) {
      const b = z.bbox;
      if (b.maxX < vis.minX || b.minX > vis.maxX || b.maxY < vis.minY || b.minY > vis.maxY) continue;
      g.fillStyle = z.sol || (z.kind === 'bois' ? PAL.sousBois
        : z.kind === 'parking' || z.kind === 'hangars' || z.kind === 'stands' ? PAL.bitumeNu
        : PAL.betonOmbre);
      g.beginPath();
      g.moveTo(z.pts[0].x, z.pts[0].y);
      for (let i = 1; i < z.pts.length; i++) g.lineTo(z.pts[i].x, z.pts[i].y);
      g.closePath();
      g.fill();
    }
    for (const l of im.lots || []) {
      const b = l.bbox;
      if (b.maxX < vis.minX || b.minX > vis.maxX || b.maxY < vis.minY || b.minY > vis.maxY) continue;
      this._drawParking(g, l);
    }
  }

  /* Un parc de stationnement : bordure claire, enrobé, places peintes, panneau P.

  Tout est construit dans le repère du parc (props.js, `implParking`) et mis en cache en Path2D :
  la bordure est l'enrobé élargi de quarante centimètres, peint dessous, si bien qu'elle n'apparaît
  qu'au contour du parc. Le repère peut être une symétrie selon le côté de la piste ; le panneau,
  lui, est redressé pour que le P ne soit jamais lu en miroir. */
  _drawParking(g, l) {
    if (!l._paths) {
      const bord = new Path2D(), sol = new Path2D(), traits = new Path2D();
      for (const [u, v, w, h] of l.runs) { bord.rect(u - .4, v - .4, w + .8, h + .8); sol.rect(u, v, w, h); }
      for (const [x0, y0, x1, y1] of l.lignes) { traits.moveTo(x0, y0); traits.lineTo(x1, y1); }
      l._paths = { bord, sol, traits };
    }
    const P = l._paths;
    g.save();
    g.transform(l.ux, l.uy, l.vx, l.vy, l.o.x, l.o.y);
    g.fillStyle = PAL.bordureParking || '#d3cec2'; g.fill(P.bord);
    g.fillStyle = PAL.bitumeNu; g.fill(P.sol);
    g.strokeStyle = 'rgba(246,243,233,.9)'; g.lineWidth = .14; g.lineCap = 'butt'; g.stroke(P.traits);
    g.restore();
    if (l.panneau) {
      const x = l.o.x + l.ux * l.panneau.u + l.vx * l.panneau.v, y = l.o.y + l.uy * l.panneau.u + l.vy * l.panneau.v;
      // Aligné sur le parc, mais jamais tête en bas : le sens de la piste n'a pas à retourner le P.
      let ang = Math.atan2(l.uy, l.ux);
      if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;
      g.save(); g.translate(x, y); g.rotate(ang);
      g.fillStyle = '#f3f0e6'; g.beginPath(); g.roundRect ? g.roundRect(-2.3, -2.3, 4.6, 4.6, .6) : g.rect(-2.3, -2.3, 4.6, 4.6); g.fill();
      g.fillStyle = '#2f6db5'; g.beginPath(); g.roundRect ? g.roundRect(-1.95, -1.95, 3.9, 3.9, .45) : g.rect(-1.95, -1.95, 3.9, 3.9); g.fill();
      // Le P, en tracés : une hampe et une boucle, sans dépendre d'une police.
      g.strokeStyle = '#f3f0e6'; g.lineWidth = .62; g.lineCap = 'butt'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-.75, 1.35); g.lineTo(-.75, -1.25); g.lineTo(.2, -1.25);
      g.arc(.2, -.42, .83, -Math.PI / 2, Math.PI / 2); g.lineTo(-.75, .41); g.stroke();
      g.restore();
    }
  }

  /* Les couronnes et les bâtiments, par-dessus tout le reste.

  Seules les cases que la caméra touche sont parcourues ; un bois de Monza compte des milliers
  d'arbres et la caméra en montre une quinzaine. Une couronne peut appartenir à plusieurs cases,
  d'où le marquage par numéro d'image plutôt qu'un Set qu'il faudrait vider. */
  /* La fenêtre de l'implantation est PLUS SERRÉE que celle du reste du décor.

  `vis` prend le rayon du rectangle de l'écran — correct quelle que soit la rotation de la caméra —
  et lui ajoute soixante mètres de marge. Soixante mètres existent pour des objets dont on ne
  connaît pas la taille ; une couronne fait six mètres et un bâtiment quarante. Avec cette marge on
  parcourait un carré de 224 m de côté pour un écran qui en montre quatre-vingt-dix, soit dix fois
  trop de surface — mesuré à quatre virgule cinq millisecondes par image sur un processeur bridé
  quatre fois, ce qui est un tiers du budget d'un téléphone.

  Le rayon exact suffit, plus la demi-taille du plus gros objet de l'implantation. Et chaque objet
  est quand même testé un à un : une case de quarante-huit mètres qui touche le bord de la fenêtre
  n'y a le plus souvent qu'un ou deux arbres. */
  _drawImplantation(g, vis) {
    const im = this.implantation;
    if (!im) return;
    const tag = ++this._implTag;
    const C = im.cell;
    const m = g.getTransform();
    const k = this.cam.zoom * this.dpr;
    const r = Math.hypot(this.w, this.h) / 2 / this.cam.zoom + im.marge;
    const minX = this.cam.x - r, maxX = this.cam.x + r;
    const minY = this.cam.y - r, maxY = this.cam.y + r;
    for (let i = Math.floor(minX / C); i <= Math.floor(maxX / C); i++) {
      for (let j = Math.floor(minY / C); j <= Math.floor(maxY / C); j++) {
        const cel = im.cases.get(i + ',' + j);
        if (!cel) continue;
        for (const o of cel) {
          if (o._vu === tag) continue;
          o._vu = tag;
          if (o.x < minX - o._r || o.x > maxX + o._r || o.y < minY - o._r || o.y > maxY + o._r) continue;
          const dx = m.a * o.x + m.c * o.y + m.e, dy = m.b * o.x + m.d * o.y + m.f;
          if (o.type) this._drawBati(g, o, dx, dy, k);
          else {
            const a = this.topArt[o.v != null ? o.id + '#' + o.v : o.id] || this.topArt[o.id];
            if (!a) continue;
            const wpx = a.wm * o.e * k;
            g.save();
            g.setTransform(1, 0, 0, 1, 0, 0);
            g.drawImage(a.canvas, dx - wpx / 2, dy - wpx / 2, wpx, wpx);
            g.restore();
          }
        }
      }
    }
  }

  /* Un bâti, dessiné dans le monde et non collé à l'écran : il tourne avec la caméra.

  Une tribune vue du dessus n'est pas une boîte. C'est un toit, et devant lui les gradins qui
  descendent vers la piste — des bandes de plus en plus claires, parce qu'une marche prend la
  lumière et la suivante est dans son ombre. Sans ces bandes une tribune est un rectangle gris, et
  rien ne dit de quel côté le public regarde. */
  _drawBati(g, o, dx, dy, k) {
    g.save();
    g.translate(o.x, o.y);
    g.rotate(o.a);
    const L = o.l, W = o.w, s = -o.side;   // s < 0 : la piste est du côté des y négatifs
    if (o.type === 'tribune') {
      g.fillStyle = PAL.betonOmbre;
      g.fillRect(-L / 2, Math.min(0, s * W), L, W);
      const n = o.gradins, pas = W / n;
      for (let i = 0; i < n; i++) {
        // le gradin le plus proche de la piste est le plus bas, donc le plus clair
        const t = i / (n - 1 || 1);
        g.fillStyle = this._melange(PAL.gradin, PAL.betonOmbre, t * 0.75);
        const y0 = s > 0 ? i * pas : -(i + 1) * pas;
        g.fillRect(-L / 2 + 0.4, y0, L - 0.8, pas * 0.86);
      }
      if (o.toit) {
        g.fillStyle = PAL.toit;
        const y0 = s > 0 ? W * 0.52 : -W;
        g.fillRect(-L / 2 - 0.6, y0, L + 1.2, W * 0.48);
        g.fillStyle = PAL.verriere;
        g.fillRect(-L / 2 + 1, y0 + W * 0.1, L - 2, W * 0.1);
      }
      g.strokeStyle = PAL.outline; g.lineWidth = 0.3;
      g.strokeRect(-L / 2, Math.min(0, s * W), L, W);
    } else if (o.type === 'voiture' && o.kind && this.vehicleArt[o.kind + ':' + o.col + ':' + (o.rem || 0)]) {
      // Vignette cuite d'avance (props.js, VEHICULES) : un seul dessin, tourné avec le véhicule.
      const v = this.vehicleArt[o.kind + ':' + o.col + ':' + (o.rem || 0)];
      g.drawImage(v.canvas, -v.l / 2, -v.w / 2, v.l, v.w);
    } else if (o.type === 'voiture') {
      /* Un parking de spectateurs est GRIS. Tiré au hasard sur la roue des teintes il virait à la
      boîte de bonbons : trente couleurs pures côte à côte sautaient à l'œil plus que la piste. Une
      vraie rangée est faite de blanc, de gris, de noir et d'un bleu sombre, avec une voiture
      colorée de temps en temps — c'est cette proportion qu'on tire ici, pas la teinte. */
      g.fillStyle = PAL.outline;
      g.fillRect(-L / 2, -W / 2, L, W);
      g.fillStyle = PARK_TEINTES[Math.min(PARK_TEINTES.length - 1, Math.floor(o.teinte * PARK_TEINTES.length))];
      g.fillRect(-L / 2 + 0.25, -W / 2 + 0.25, L - 0.5, W - 0.5);
      g.fillStyle = 'rgba(30,34,44,0.45)';
      g.fillRect(-L * 0.12, -W / 2 + 0.4, L * 0.34, W - 0.8);
    } else {
      const architecture=this.buildingStyle || o.architecture;
      if(architecture && architecture!=='classic'){
        this._drawRoofVariant(g,o,architecture);g.restore();return;
      }
      /* Stands et hangars : un toit clair, sa bordure sombre, et une bande de lanterneaux.

      Les stands ont en plus leurs portes de garage, côté piste : c'est à ça qu'on reconnaît un
      bâtiment de stands d'un hangar de paddock, vu d'en haut. */
      g.fillStyle = PAL.outline;
      g.fillRect(-L / 2, Math.min(0, s * W), L, W);
      g.fillStyle = this._melange(PAL.toit, PAL.betonOmbre, o.teinte * 0.45);
      g.fillRect(-L / 2 + 0.3, Math.min(0, s * W) + 0.3, L - 0.6, W - 0.6);
      g.fillStyle = PAL.verriere;
      const yv = s > 0 ? W * 0.42 : -W * 0.58;
      g.fillRect(-L / 2 + 1.2, yv, L - 2.4, W * 0.16);
      if (o.type === 'stands') {
        g.fillStyle = PAL.betonOmbre;
        const yp = s > 0 ? 0.3 : -W * 0.22;
        const pas = (L - 2) / o.portes;
        for (let i = 0; i < o.portes; i++)
          g.fillRect(-L / 2 + 1 + i * pas, yp, pas * 0.74, W * 0.2);
      }
    }
    g.restore();
  }

  // Quatre propositions procédurales. Le choix ne change pas l'empreinte au sol.
  _drawRoofVariant(g,o,style) {
    const L=o.l,W=o.w,y=Math.min(0,-o.side*W),inset=Math.min(1.2,W*.08);
    g.fillStyle=PAL.outline;g.fillRect(-L/2,y,L,W);
    const rect=(col,x,dy,w,h)=>{g.fillStyle=col;g.fillRect(x,y+dy,w,h);};
    if(style==='immeubles'){
      // Volume contenu dans son emprise : toit en retrait et façade haute rythmée
      // par plusieurs étages, lisibles dans la vue de dessus du jeu.
      rect('#b5b1aa',-L/2+.35,.35,L-.7,W-.7);
      rect('#ede8dc',-L/2+.45,.45,L-.9,W*.56);
      rect('#d4d0c5',-L/2+1.2,1.2,L-2.4,W*.45);
      rect('#f5f1e8',-L*.26,W*.12,L*.52,W*.22);
      rect('#6f8b92',-L*.18,W*.19,L*.36,W*.06);
      const floors=Math.max(3,Math.min(7,Math.round((o.height||28)/6))),h=W*.37/floors;
      for(let i=0;i<floors;i++){
        rect('#e1dbce',-L/2+.5,W*.6+i*h,L-1,h*.18);
        for(let x=-L/2+1.4;x<L/2-1;x+=3.2)rect('#647f8b',x,W*.6+i*h+.15,1.7,h*.58);
      }
    }else if(style==='pavillons'){
      const roof=this.track?.theme==='forest'?'#69747c':this.track?.theme==='bush'?'#a87157':'#b8886c';
      rect(roof,-L/2+.35,.35,L-.7,W-.7);
      rect(this._melange(roof,'#393b44',.24),-L/2+.35,W/2,L-.7,W/2-.35);
      rect('#dfcbb5',-L/2+.5,W/2-.1,L-1,.2);
      rect('#7a7067',L*.2,W*.15,Math.min(1.2,L*.09),Math.min(1.2,W*.12));
    }else if(style==='terrecuite'){
      rect('#c9896b',-L/2+.4,.4,L-.8,W-.8);
      rect('#ae705e',-L/2+.4,W/2,L-.8,W/2-.4);
      rect('#edc4a5',-L/2+.7,W/2-.12,L-1.4,.24);
      g.strokeStyle='rgba(79,49,44,.2)';g.lineWidth=.18;
      for(let x=-L/2+4;x<L/2-2;x+=5){g.beginPath();g.moveTo(x,y+.6);g.lineTo(x,y+W-.6);g.stroke();}
    }else if(style==='terrasses'){
      rect('#eee9dc',-L/2+.35,.35,L-.7,W-.7);
      rect('#c0b8ab',-L/2+inset,inset,L-2*inset,W*.62);
      rect('#faf5e8',-L/2+inset*1.5,inset*1.5,L-3*inset,W*.53);
      rect('#647c82',-L/2+L*.15,W*.72,L*.7,W*.07);
      rect('#537b56',-L/2+inset*1.5,W*.85,L*.16,W*.06);
      rect('#537b56',L*.2,W*.85,L*.16,W*.06);
    }else if(style==='graphique'){
      rect('#56616b',-L/2+.4,.4,L-.8,W-.8);
      rect('#414955',-L/2+.4,W*.78,L-.8,W*.22-.4);
      for(let i=0;i<3;i++){
        const x=-L*.35+i*L*.28;
        rect('#d4dcdb',x,W*.16,L*.15,W*.48);
        rect('#90b2bb',x+.3,W*.19,L*.15-.6,W*.4);
      }
    }else{
      rect('#e6e1d5',-L/2+.4,.4,L-.8,W-.8);
      rect('#c7c3b8',-L/2+inset,W-inset-1,L-2*inset,1);
      rect('#f7f3e9',-L*.27,W*.2,L*.52,W*.42);
      rect('#89999b',-L*.17,W*.3,L*.34,W*.13);
      rect('#a8ada7',L*.3,W*.2,L*.08,W*.12);
    }
    if(o.type==='stands'){
      const step=(L-2)/o.portes;
      for(let i=0;i<o.portes;i++)rect(PAL.betonOmbre,-L/2+1+i*step,o.side<0?.3:W*.84,step*.74,W*.14);
    }
  }

  // Deux couleurs hexadécimales mélangées, pour les marches d'un gradin et les toits d'un paddock.
  _melange(a, b, t) {
    const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
    const r = Math.round((A >> 16 & 255) * (1 - t) + (B >> 16 & 255) * t);
    const v = Math.round((A >> 8 & 255) * (1 - t) + (B >> 8 & 255) * t);
    const u = Math.round((A & 255) * (1 - t) + (B & 255) * t);
    return `rgb(${r},${v},${u})`;
  }

  /* Une pile de grumes vue du dessus, dans le monde : elle tourne avec la lisière qu'elle longe.

  Un rang de grumes côte à côte, un second rang plus court dans les creux du premier, et les bouts
  sciés en clair aux deux extrémités — c'est le bois coupé, pas l'écorce, qui fait reconnaître une
  pile. L'ombre est décalée dans le monde (en bas à droite), comme celle du reste du décor. */
  _drawTas(g, vis) {
    const ecorce = [PAL.log || '#7a4f2c', '#95602f'], trait = '#3b2414', scie = '#e2bb80', cerne = '#b98a52';
    for (const t of this.tas || []) {
      if (t.x < vis.minX - 4 || t.x > vis.maxX + 4 || t.y < vis.minY - 4 || t.y > vis.maxY + 4) continue;
      const d = 0.75, rangs = [[t.n, 6.4, 0], [t.n - 1, 5.8, 1]];
      g.save(); g.translate(t.x + 0.35, t.y + 0.45); g.rotate(t.a);
      g.fillStyle = 'rgba(30,26,20,0.24)';
      g.beginPath(); g.roundRect ? g.roundRect(-3.3, -t.n * d / 2 - .1, 6.6, t.n * d + .2, .4) : g.rect(-3.3, -t.n * d / 2, 6.6, t.n * d); g.fill();
      g.restore();
      g.save(); g.translate(t.x, t.y); g.rotate(t.a);
      g.lineWidth = 0.08; g.strokeStyle = trait;
      for (const [n, L, haut] of rangs) {
        for (let i = 0; i < n; i++) {
          const y = (i - (n - 1) / 2) * d;
          g.fillStyle = haut ? this._melange(ecorce[i % 2], '#ffffff', 0.12) : ecorce[i % 2];
          g.beginPath(); g.roundRect ? g.roundRect(-L / 2, y - d * 0.47, L, d * 0.94, d * 0.3) : g.rect(-L / 2, y - d * 0.47, L, d * 0.94);
          g.fill(); g.stroke();
          for (const x of [-L / 2 + 0.14, L / 2 - 0.14]) {
            g.fillStyle = scie;
            g.beginPath(); g.ellipse(x, y, 0.16, d * 0.4, 0, 0, Math.PI * 2); g.fill();
            g.strokeStyle = cerne; g.lineWidth = 0.05; g.stroke();
            g.strokeStyle = trait; g.lineWidth = 0.08;
          }
        }
      }
      g.restore();
    }
  }

  // Scenery for the flat view: objects drawn as a bird sees them, shadow baked in, no rotation —
  // a tree looks the same from every side, and turning it would only make it shimmer.
  _drawTopProps(g, vis) {
    const art = this.topArt;
    if (!art) return;
    for (const p of this.topProps || []) {
      const a = art[p.v != null ? p.id + '#' + p.v : p.id] || art[p.id];
      if (!a) continue;
      const e = p.e || 1, half = a.wm * e / 2;
      if (p.x < vis.minX - half || p.x > vis.maxX + half || p.y < vis.minY - half || p.y > vis.maxY + half) continue;
      const m = g.getTransform();
      const dx = m.a * p.x + m.c * p.y + m.e, dy = m.b * p.x + m.d * p.y + m.f;
      const wpx = a.wm * e * this.cam.zoom * this.dpr;
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(a.canvas, dx - wpx / 2, dy - wpx / 2, wpx, wpx);
      g.restore();
    }
  }

  // Conserver le masquage par les ponts et tunnels sur le calque Retina.
  _hideCars(g, path) {
    const m = g.getTransform(), scale = this.nativeDpr / this.dpr, ctx = this.carCtx;
    ctx.save();
    ctx.setTransform(m.a * scale, m.b * scale, m.c * scale, m.d * scale, m.e * scale, m.f * scale);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill(path);
    ctx.restore();
  }

  _drawCar(g, car) {
    const m = g.getTransform(), scale = this.nativeDpr / this.dpr;
    g = this.carCtx;
    g.setTransform(m.a * scale, m.b * scale, m.c * scale, m.d * scale, m.e * scale, m.f * scale);
    g.imageSmoothingEnabled = true;
    const c = car.cls, pos = car.pos, h = car.heading;
    g.save();
    if(car.blueFlag)g.globalAlpha*=.45;
    g.translate(pos.x, pos.y);
    g.rotate(h);
    // Inclure le contour du dessin, les rétroviseurs, l'ombre et les feux — et, au freinage, le
    // faisceau des feux stop, sans quoi il resterait peint sur la couche d'une image à l'autre.
    const art = topArt(c, car.livree);
    const freine = car.braking && car.state === 'ok';
    const dessinW = art ? topSize(c, art)[1] : c.width;
    const halfL = c.length / 2 + 0.7, halfW = dessinW / 2 + 0.7;
    const arriere = freine ? c.length / 2 + FEU_STOP.long : halfL;
    const largeur = freine ? Math.max(halfW, dessinW * FEU_STOP.ecart + FEU_STOP.ouvre + FEU_STOP.demi + 0.2) : halfW;
    const pose = g.getTransform();
    const corners = [[-arriere, -largeur], [-arriere, largeur], [halfL, -largeur], [halfL, largeur]];
    const xs = corners.map(([x, y]) => pose.a * x + pose.c * y + pose.e);
    const ys = corners.map(([x, y]) => pose.b * x + pose.d * y + pose.f);
    const x0 = Math.max(0, Math.floor(Math.min(...xs)) - 2);
    const y0 = Math.max(0, Math.floor(Math.min(...ys)) - 2);
    const x1 = Math.min(this.carCanvas.width, Math.ceil(Math.max(...xs)) + 2);
    const y1 = Math.min(this.carCanvas.height, Math.ceil(Math.max(...ys)) + 2);
    if (x1 > x0 && y1 > y0) this.carRects.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    /* L'OMBRE TOMBE DU MÊME CÔTÉ DANS LE MONDE, quel que soit le cap. Le décalage était posé après
    la rotation, dans le repère de la voiture : l'ombre tournait avec elle, et une voiture en
    travers la jetait vers le haut quand la barrière d'à côté jetait la sienne vers le bas. Il se
    pose maintenant avant, dans le monde (`OMBRE_VOITURE`) — la silhouette, elle, tourne toujours
    avec la voiture. Ça ne coûte rien : c'est la même image, seule la translation change de place. */
    g.save();
    g.rotate(-h);
    g.translate(OMBRE_VOITURE[0], OMBRE_VOITURE[1]);
    g.rotate(h);
    g.globalAlpha = 0.3;
    // a drawn car casts its own outline; a vector one only has a box to offer
    if (!drawCarShadow(g, c, car.livree, { steer: car.steerAngle })) { g.globalAlpha = 1; g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-c.length / 2, -c.width / 2, c.length, c.width); }
    g.restore();
    if (freine) this._feuxStop(g, c, art);
    drawCarModel(g, c, car.livery, { number: car.number, steer: car.steerAngle, livree: car.livree });
    g.restore();
    /* Pas de cercle autour de la voiture du joueur.

    Il y en avait un, pour la retrouver dans le peloton. Il est retiré sur le constat de Bruno : un
    anneau qui n'existe pas dans le monde, posé sur la seule voiture qu'on regarde, casse
    l'immersion. La voiture se retrouve autrement — c'est elle que la caméra suit, et la pastille
    de couleur du classement la désigne déjà. */
  }

  /* LES FEUX STOP : un faisceau rouge qui part de l'arrière et s'éteint en trois mètres.

  Il remplace une barre rouge peinte en travers du pare-chocs, qui se lisait comme un trait de
  dessin plus que comme une lumière. Deux cônes pour une GT, un feu par côté ; un seul au milieu
  pour un proto et une F1, comme le feu central d'une monoplace. Chaque cône s'écarte un peu de
  l'axe, comme un phare, et s'estompe vite : très rouge au feu, presque rien à mi-longueur. Il se
  peint SOUS la voiture, pour sortir de derrière la carrosserie au lieu de s'y poser dessus.

  Le dégradé est créé une fois, dans le repère du feu : la couleur ne dépend que de la distance
  au feu, et toutes les voitures le partagent. */
  _feuxStop(g, c, art) {
    const F = FEU_STOP, W = art ? topSize(c, art)[1] : c.width;
    if (!this._degradeFeu || this._degradeFeuCtx !== g) {
      const d = g.createLinearGradient(0, 0, -F.long, 0);
      d.addColorStop(0, 'rgba(255,36,28,0.62)');
      d.addColorStop(0.22, 'rgba(255,36,28,0.3)');
      d.addColorStop(0.55, 'rgba(255,36,28,0.08)');
      d.addColorStop(1, 'rgba(255,36,28,0)');
      this._degradeFeu = d; this._degradeFeuCtx = g;
    }
    const feux = c.catId === 'gt' ? [-W * F.ecart, W * F.ecart] : [0];
    g.save();
    g.translate(-c.length / 2 + F.dedans, 0);
    g.fillStyle = this._degradeFeu;
    for (const y of feux) {
      const ouvre = Math.sign(y) * F.ouvre;             // un cône de côté s'écarte de l'axe
      g.beginPath();
      g.moveTo(0, y - F.source); g.lineTo(-F.long, y + ouvre - F.demi);
      g.lineTo(-F.long, y + ouvre + F.demi); g.lineTo(0, y + F.source);
      g.closePath(); g.fill();
    }
    g.restore();
  }

  _roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }

  /* L'accélérateur : un disque translucide sous le pouce, sans contour et sans rien à lire.

  Tout ce qui se lisait est passé en haut. Ce qui reste n'a qu'un travail : dire où le doigt a pris
  la commande, et accuser l'appui. Sans contour et à faible opacité, parce que c'est un repère et
  pas un objet — ce qu'il recouvre doit rester visible à travers. */
  /* LES CINQ COULEURS DE L'ÉTAT RESSENTI, en pastel.

  Elles doivent se lire du coin de l'œil sans tirer le regard hors de la piste, et un rouge saturé
  sur un écran de course se confondrait avec les feux stop. `car.ressenti` est bâti sur ce que la
  voiture PRODUIT — pas sur ce que le pilote demande — et ses seuils sortent d'une mesure sur
  741 000 images (voir `js/car.js`). Répartition mesurée au niveau difficile : 66 % de bleu, 25 %
  de vert, 6,6 % de jaune, 1,5 % de violet, et le rouge aux seuls vrais tête-à-queue. */
  static get PASTEL() {
    return [[158, 203, 240], [166, 223, 166], [240, 224, 154], [200, 168, 234], [242, 163, 163]];
  }

  static teintePastel(r) {
    const P = Renderer.PASTEL;
    const x = clamp(r, 0, 1) * (P.length - 1), i = Math.min(P.length - 2, Math.floor(x)), f = x - i;
    const a = P[i], b = P[i + 1];
    return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f),
            Math.round(a[2] + (b[2] - a[2]) * f)];
  }

  _drawPouce(g, p) {
    const d = this.pouce, cx = d.cx, cy = d.cy;
    const held = !!p.throttle;
    this.poucePress += ((held ? 1 : 0) - this.poucePress) * 0.25;   // eased press feedback
    const pr = d.r * (1 - 0.06 * this.poucePress);
    // Match the cream/black HUD while retaining the grip colour and press feedback.
    const [r0, v0, b0] = Renderer.teintePastel(p.ressenti || 0);
    g.beginPath(); g.arc(cx, cy, pr, 0, Math.PI * 2);
    g.fillStyle = '#171b19d9'; g.fill();
    g.strokeStyle = '#f2e6ca'; g.lineWidth = 2; g.stroke();
    g.beginPath(); g.arc(cx, cy, pr * 0.77, 0, Math.PI * 2);
    g.fillStyle = `rgba(${r0},${v0},${b0},${0.62 + 0.14 * this.poucePress})`; g.fill();

    /* LA VITESSE JUSTE AU-DESSUS, donc au-dessus de la main. La pastille suit le doigt et le
    chiffre avec elle : il garde toujours la même place par rapport à la main, ce qu'aucune
    position fixe à l'écran ne peut offrir. En blanc plein sans fond, comme tout le bandeau depuis
    que le cerné noir a été retiré. */
    const kmh = String(Math.round(Math.max(0, p.speed) * 3.6));
    const hT = this.mobile ? 28 : 34;
    const yT = cy - pr - (this.mobile ? 10 : 13);
    g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.font = `italic 900 ${hT + 4}px Racing, Impact, sans-serif`;
    const wNum = g.measureText(kmh).width;
    g.font = `italic 900 ${this.mobile ? 15 : 17}px Racing, Impact, sans-serif`;
    const wU = g.measureText('km/h').width;
    const x0 = cx - (wNum + 4 + wU) / 2;
    this._hudLabel(g, x0 - 8, yT - hT - 4, wNum + 4 + wU + 16, hT + 10, '#171b19c9');
    g.textAlign = 'left';
    g.fillStyle = '#fff0d4'; g.font = `italic 900 ${hT + 4}px Racing, Impact, sans-serif`;
    g.fillText(kmh, x0, yT);
    g.fillStyle = '#f2e6ca'; g.font = `italic 900 ${this.mobile ? 15 : 17}px Racing, Impact, sans-serif`;
    g.fillText('km/h', x0 + wNum + 4, yT);
    this.hudZones = this.hudZones || {};
    this.hudZones.vitesse = { x: x0, w: wNum + 4 + wU, y: yT - hT, h: hT };
    g.textAlign = 'left'; g.textBaseline = 'top';
  }

  // La pastille vient sous le pouce, et reste entière à l'écran.
  anchorPouce(x, y) {
    const d = this.pouce, m = 8;
    // never far enough left to cover the line slider: that column must stay reachable
    const lo = this.slider.droite ? d.r + m : this.slider.x + 30 + d.r;
    const hi = this.slider.droite ? this.slider.x - 30 - d.r : this.w - d.r - m;
    d.cx = hi > lo ? clamp(x, lo, hi) : hi;
    // le chiffre de la vitesse se pose au-dessus d'elle : il lui faut sa place, sinon il sort par
    // le haut dès qu'on remonte le pouce
    d.cy = clamp(y, d.r + (this.mobile ? 42 : 50) + m, this.h - d.r - m);
    this.pouceAncre = true;
  }

  // back to the bottom centre (new race, orientation change)
  homePouce() {
    if (!this.pouceHome) return;
    this.pouce.cx = this.pouceHome.cx; this.pouce.cy = this.pouceHome.cy;
    this.pouceAncre = false;
  }

  static gripColor(u) { return u < 0.7 ? '#5be07a' : u < 1 ? '#ffd23f' : u < 1.2 ? '#ff9f2e' : u < 1.5 ? '#ff4b4b' : '#c74bff'; }

  _drawDesktopThrottle(g, p, ui) {
    const app = ui.app, t = k => ui.t(k), mode = app.controls.mode;
    const separate = mode === 'gamepad' && app.save.gamepadBrake !== 'auto';
    const w = Math.min(310, this.w - 32), h = separate ? 174 : 142;
    const x = this.ctrlSide === 'right' ? this.pad.l : this.w - this.pad.r - w, y = this.h - this.pad.b - h;
    const gas = throttleAmount(app.input.throttle);
    this._hudLabel(g, x, y, w, h, '#171b19c9');
    g.textAlign = 'left'; g.textBaseline = 'top';
    const R = (taille) => `italic 900 ${taille}px Racing, Impact, sans-serif`;
    // la vitesse en grand, chiffres à chasse fixe, calée à droite d'une case de trois chiffres
    g.fillStyle = '#fff'; g.font = R(54); g.textBaseline = 'alphabetic';
    const case3 = g.measureText('888').width;
    this._texteChiffres(g, String(Math.round(Math.max(0, p.speed) * 3.6)), x + 16 + case3, y + 54);
    g.font = R(19); g.fillStyle = '#c8ced9'; g.textAlign = 'left'; g.fillText('km/h', x + 22 + case3, y + 54);
    g.textBaseline = 'top';
    g.font = R(16);
    g.fillText(t({ keyboard: 'controlKeyboard', wheel: 'controlWheel', gamepad: 'controlGamepad' }[mode]).toUpperCase(), x + 150, y + 14, w - 162);
    g.font = R(22); g.fillStyle = gas ? '#5be07a' : '#ffd400';
    g.fillText(`${t('gas').toUpperCase()} ${Math.round(gas * 100)} %`, x + 150, y + 38);
    g.fillStyle = '#3a3f4b'; this._roundRect(g, x + 16, y + 77, w - 32, 9, 4); g.fill();
    if (gas > 0) { g.fillStyle = '#5be07a'; this._roundRect(g, x + 16, y + 77, (w - 32) * gas, 9, Math.min(4, (w - 32) * gas / 2)); g.fill(); }
    if (separate) {
      const brake = throttleAmount(app.input.brake);
      g.font = R(16); g.fillStyle = '#ff9b88';
      g.fillText(`LT · ${t('brake').toUpperCase()} ${Math.round(brake * 100)} %`, x + 16, y + 94);
      g.fillStyle = '#3a3f4b'; g.fillRect(x + 16, y + 115, w - 32, 7);
      g.fillStyle = '#ff7760'; g.fillRect(x + 16, y + 115, (w - 32) * brake, 7);
      g.translate(0,32);
    }
    g.font = R(15); g.fillStyle = '#d7dbe3';
    g.fillText(t(mode === 'gamepad' ? 'lineHintPad' : 'lineHintPC'), x + 16, y + 97, w - 32);
    const status = { ready: 'padReady', release: 'padRelease', disconnected: 'padDisconnected', unsupported: 'padUnsupported' };
    const hint = mode === 'gamepad' ? t(status[app.controls.status])
      : mode === 'wheel' ? (ui.lang === 'fr' ? 'Espace : gaz à zéro · Échap : pause' : 'Space: zero throttle · Esc: pause')
      : (ui.lang === 'fr' ? 'Maintenir : gaz · Relâcher : frein' : 'Hold: throttle · Release: brake');
    g.fillStyle = mode === 'gamepad' && app.controls.status !== 'ready' ? '#ffd400' : '#aeb4c0';
    g.font = R(15); g.fillText(hint, x + 16, y + 118, w - 32);
    if (separate) g.translate(0,-32);
    this.hudZones.accelerateur = { x, y, w, h };
  }

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
    /* L'AIMANT NE S'AFFICHE QUE S'IL EST ALLUMÉ, et il affiche d'abord s'il TIENT.

    C'est un essai : ce qu'on cherche à voir en roulant, ce n'est pas la valeur de la tension mais
    l'INSTANT du décrochage — le défaut qu'il est censé réparer est justement qu'on ne sait pas quand
    la voiture a lâché. Le mot passe donc au rouge au moment où ça lâche, et la tension suit entre
    parenthèses pour ceux qui veulent le chiffre. */
    if (PHYS.aimant > 0)
      rows.push(['aimant', `${p.accroche ? 'tient' : 'LÂCHÉ'} (${p.aimantF.toFixed(1)})`,
        p.accroche ? '#5be07a' : '#ff4b4b']);
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

  // Shared slanted racing labels: paper for the player/history, ink for controls/live data.
  _hudLabel(g, x, y, w, h, fill = '#f2e6ca') {
    const cut = Math.min(9, h * .23);
    g.beginPath(); g.moveTo(x + cut, y); g.lineTo(x + w, y);
    g.lineTo(x + w - cut, y + h); g.lineTo(x, y + h); g.closePath();
    g.fillStyle = fill; g.fill();
  }
  _hudPaper(g, x, y, w, h) { this._hudLabel(g, x, y, w, h); }

  /* Un texte aligné à droite dont les chiffres ont tous la même chasse.

  La Barlow Condensed a des chiffres proportionnels : un « 1 » est plus étroit qu'un « 8 », et un
  chrono qui défile se mettait à trembler à chaque centième. Chaque chiffre prend donc la case du
  plus large d'entre eux ; le reste — deux-points, point, tiret — garde sa largeur. Rend la largeur
  occupée. */
  _texteChiffres(g, txt, xDroite, y) {
    let w0 = 0;
    for (const c of '0123456789') w0 = Math.max(w0, g.measureText(c).width);
    const align = g.textAlign;
    g.textAlign = 'center';
    let x = xDroite;
    for (let i = txt.length - 1; i >= 0; i--) {
      const c = txt[i], w = /[0-9]/.test(c) ? w0 : g.measureText(c).width;
      g.fillText(c, x - w / 2, y);
      x -= w;
    }
    g.textAlign = align;
    return xDroite - x;
  }

  // ---------- HUD ----------
  _drawHUD(g, race, ui) {
    const W = this.w, H = this.h, p = race.player, t = (k, ...a) => ui.t(k, ...a);
    const mobile = this.mobile, P = this.pad, pad0 = this.pad;
    g.textBaseline = 'top';
    const panel = (x, y, w, h) => this._hudLabel(g, x, y, w, h, '#171b19ed');

    // Printed information labels keep the existing HUD geometry and touch targets.
    const usure = !!p.usure;
    const boxH = this.hudBox.h;
    /* L'origine de la carte, calculée ICI et non au moment de la peindre.

    Trois choses se rangent sous elle — la carte, le tableau des positions sur grand écran, la
    télémétrie — et tant qu'elle vivait dans le bloc qui la dessine, les deux autres partaient d'une
    hauteur posée en dur. La carte est remontée sous la position : le tableau, resté à son ancienne
    ligne, se peignait par-dessus. Une seule origine, trois lecteurs. */
    const mmX = P.l + 2, mmY = P.t + (mobile ? 46 : 56);
    const mmBas = this.mm ? mmY + this.mm.size : P.t + boxH;

    const pos = race.positionOf(p), n = race.cars.length, tt = race.mode === 'timetrial';
    const lapShown = tt ? p.lap + 1 : Math.min(race.laps, p.lap + 1);
    const y0 = P.t + 2, xs = P.l + 2, xe = W - P.r - 2;
    const wPos = mobile ? 90 : 120, headH = mobile ? 36 : 44;
    const pb = this.pauseBtn;
    pb.x = xe - pb.s; pb.y = y0;
    const pw = Math.min(mobile ? 172 : 230, Math.max(110, xe - xs - wPos - pb.s - 20));
    const px = clamp((W - pw) / 2, xs + wPos + 8, pb.x - pw - 8);
    const ph = mobile ? 27 : 32;
    this._hudPaper(g, xs, y0, wPos, headH);
    g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#20251f';
    g.font = `italic 900 ${mobile ? 24 : 32}px Racing, sans-serif`;
    g.fillText(tt ? 'TT' : `P ${pos}/${n}`, xs + 10, y0 + headH / 2, wPos - 18);
    /* LE TOUR, en grand et dans la police de la position — c'est le second chiffre qu'on cherche.

    Il était écrit en petit, en police système, dans une étiquette de 90 px : le seul texte du haut
    de l'écran qui ne parlait pas comme le reste. Comme sur la maquette : « TOUR » en petit, le
    numéro du tour en gros, le total à côté. */
    const lapW = mobile ? 108 : 150, lapH = mobile ? 34 : 46;
    // sous la pause, et sous les temps quand ils lui passent au-dessus (téléphone étroit)
    const lapY = px + pw > xe - lapW - 4 ? Math.max(y0 + pb.s + 6, y0 + ph * 2 + 12) : y0 + pb.s + 6;
    this._hudPaper(g, xe - lapW, lapY, lapW, lapH);
    {
      const lbl = t('lap').toUpperCase(), num = String(lapShown), tot = tt ? '' : '/' + race.laps;
      const fGrand = mobile ? 30 : 40, fMoyen = mobile ? 19 : 25, fPetit = mobile ? 15 : 19;
      const police = (taille) => `italic 900 ${taille}px Racing, Impact, sans-serif`;
      g.font = police(fPetit); const wl = g.measureText(lbl).width;
      g.font = police(fGrand); const wn = g.measureText(num).width;
      g.font = police(fMoyen); const wt = tot ? g.measureText(tot).width : 0;
      let x = xe - lapW + Math.max(8, (lapW - (wl + 6 + wn + 2 + wt)) / 2);
      const base = lapY + lapH * 0.82;
      g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#20251f';
      g.font = police(fPetit); g.fillText(lbl, x, base); x += wl + 6;
      g.font = police(fGrand); g.fillText(num, x, base + (mobile ? 1 : 2)); x += wn + 2;
      if (tot) { g.font = police(fMoyen); g.fillText(tot, x, base); }
      g.textBaseline = 'middle';
    }
    this.hudZones = { pos:{x:xs,y:y0,w:wPos,h:headH}, lap:{x:xe-lapW,y:lapY,w:lapW,h:lapH}, temps:{x:px,y:y0,w:pw,h:ph*2+4} };
    const flags = race.flags?.active(p) || [], nul = !!p.lapSale;
    const timing = (y, label, value, dark, activeFlags = []) => {
      this._hudLabel(g, px, y, pw, ph, dark ? '#171b19ed' : '#f2e6ca');
      g.textBaseline = 'middle'; g.textAlign = 'left';
      const size = activeFlags.length > 1 ? 10 : 12;
      activeFlags.forEach((flag,i)=>drawRaceFlag(g,flag,px+8+i*(size+3),y+(ph-size)/2,size));
      g.fillStyle = dark ? '#f6eacf' : '#34392f';
      const val = String(value), flagWidth = activeFlags.length * (size + 3);
      const fLabel = `italic 900 ${mobile ? 13 : 16}px Racing, Impact, sans-serif`;
      const fValeur = `italic 900 ${mobile ? 19 : 24}px Racing, Impact, sans-serif`;
      g.font = fValeur;
      const valueWidth = g.measureText(val).width + 4;
      if (pw - 24 - valueWidth - flagWidth > 36) {
        g.font = fLabel;
        g.fillText(label.toUpperCase(), px + 11 + flagWidth, y + ph/2);
      }
      g.font = fValeur;
      g.fillStyle = dark && nul ? '#ffb59c' : dark ? '#fff0d4' : '#33372e';
      this._texteChiffres(g, val, px + pw - 12, y + ph/2 + 1);
    };
    timing(y0, nul ? t('lapVoid') : t('lap'), fmtTime(race.state === 'countdown' ? 0 : race.time - p.lapStart), true, flags);
    timing(y0 + ph + 4, t('best'), p.bestLap != null ? fmtTime(p.bestLap) : '--:--.---', false);
    // le carré du premier drapeau, tel qu'il est peint : les essais lisent son centre
    { const tf = flags.length > 1 ? 10 : 12; this.hudZones.flags = {types:flags,x:px+8,y:y0+(ph-tf)/2,s:tf}; }
    g.textAlign = 'left'; g.textBaseline = 'top';

    /* LA VITESSE, SOUS LE BANDEAU ET AU MILIEU — c'est-à-dire là où le cadran du bas n'était pas.

    Elle vivait en bas de l'écran, sur une carte blanche de 95 × 73 px plantée devant la voiture.
    Elle est ici parce que c'est le seul endroit que rien n'occupe : la position et la carte tiennent
    la colonne de gauche, les temps et le tour celle de droite, et le milieu du bandeau ne porte que
    le bouton pause. Le regard y passe déjà entre les deux colonnes.

    LE CHIFFRE EST CENTRÉ, PAS LE GROUPE. La jauge s'ajoute à sa droite, donc centrer l'ensemble
    aurait décalé le chiffre vers la gauche — et c'est le chiffre qu'on lit, pas la composition. Il
    garde l'axe de l'écran, ce qui est aussi ce qui le rend retrouvable sans le chercher.

    La jauge ne porte plus l'usage d'adhérence : c'est un choix de Bruno, l'information était une
    couleur de plus sur un écran qui en a déjà assez. Elle ne dit que la vitesse rapportée au maximum
    de la voiture — l'éventail disait la même chose, déroulé. Elle s'éclaircit à l'appui, parce que
    la pastille du pouce n'a plus de liseré pour le dire. */
    /* LA VITESSE ET L'ADHÉRENCE ONT QUITTÉ LE BANDEAU, et sont retournées sous le pouce.

    Elles étaient en haut : le chiffre au centre, une jauge à sa droite dont la couleur portait
    l'état ressenti. Bruno : « on perd de l'info ». C'est juste — deux choses à lire, loin l'une de
    l'autre et loin de la voiture, pendant qu'on regarde la piste.

    Les deux reviennent donc là où le regard passe de toute façon : la pastille du pouce PREND la
    couleur de l'état, et le chiffre se pose juste au-dessus d'elle. Rien à chercher, rien à
    balayer, et comme la pastille suit le doigt, le chiffre le suit aussi — il reste toujours au
    même endroit par rapport à la main, ce qu'aucune position fixe ne peut offrir.

    La jauge disparaît : la vitesse rapportée au maximum ne disait rien que le chiffre ne dise
    mieux, et c'était la troisième chose à lire. */

    /* LE LEVIER DE FREINAGE, et seulement en mode réglage.

    Il n'a rien à faire dans une course ordinaire : un curseur qu'on peut bouger en roulant invite à
    le bouger en roulant, et un réglage qui change pendant qu'on mesure ne se compare à rien. Il
    n'apparaît donc que quand la course a été ouverte pour régler.

    HORIZONTAL ET EN HAUT, comme demandé, et sur toute la largeur utile : la précision se joue au
    centième et un rail court la rendrait impossible au pouce. Le repère du défaut est marqué, parce
    que c'est la seule valeur dont on sait qu'elle a été équilibrée — tout le reste est un pari que
    le joueur prend. */
    if (race.reglage) {
      const f = clamp(race.frein == null ? 1 : race.frein, FREIN_MIN, FREIN_MAX);
      const u = (f - FREIN_MIN) / (FREIN_MAX - FREIN_MIN);
      const wR = Math.min(W - P.l - P.r - 8, mobile ? 300 : 420), hR = mobile ? 16 : 18;
      /* Il passe SOUS la carte, et pas seulement sous la jauge. Posé juste en dessous de celle-ci,
      il traversait la minicarte en haut à gauche : large et centré, il la croise forcément. On
      part donc du plus bas des deux. */
      const xR = Math.round((W - wR) / 2);
      const yR = mmBas + (mobile ? 16 : 20);
      this.reglageZone = { x: xR, w: wR, y: yR - 14, h: hR + 28 };
      g.fillStyle = 'rgba(10,12,20,0.70)';
      this._roundRect(g, xR - 10, yR - 14, wR + 20, hR + 30, 10); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.16)';
      this._roundRect(g, xR, yR, wR, hR, hR / 2); g.fill();
      // le repère du défaut, là où la voiture a été équilibrée
      const xD = xR + wR * (1 - FREIN_MIN) / (FREIN_MAX - FREIN_MIN);
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(Math.round(xD) - 1, yR - 4, 2, hR + 8);
      g.fillStyle = f < 1 ? '#f0e09a' : '#9ecbf0';
      this._roundRect(g, xR, yR, Math.max(hR, wR * u), hR, hR / 2); g.fill();
      g.beginPath(); g.arc(xR + wR * u, yR + hR / 2, hR * 0.78, 0, Math.PI * 2);
      g.fillStyle = '#f5f6fa'; g.fill();
      g.strokeStyle = 'rgba(12,14,22,0.85)'; g.lineWidth = 2; g.stroke();
      g.textAlign = 'center'; g.textBaseline = 'top';
      g.font = `bold ${mobile ? 11 : 12}px system-ui, sans-serif`; g.fillStyle = '#e8e8ec';
      g.fillText(t('freinage') + '  ×' + f.toFixed(2), xR + wR / 2, yR + hR + 5);
    } else this.reglageZone = null;
    g.textAlign = 'left';

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
      this._hudPaper(g, J.x - r - 7, J.y1 - r - 8, (r + 7) * 2, (J.y2 - J.y1) + r * 2.2 + 16);
      const cadran = (cx, cy, frac, dessine) => {
        const f = Math.max(0, Math.min(1, frac));
        const A0 = Math.PI * 0.75, SPAN = Math.PI * 1.5;
        g.lineCap = 'round';
        g.strokeStyle = '#cec4ad'; g.lineWidth = r * 0.30;
        g.beginPath(); g.arc(cx, cy, r * 0.78, A0, A0 + SPAN); g.stroke();
        g.strokeStyle = f > 0.5 ? '#39864c' : f > 0.22 ? '#a36b08' : '#bd2d22';
        if (f > 0.001) { g.beginPath(); g.arc(cx, cy, r * 0.78, A0, A0 + SPAN * f); g.stroke(); }
        /* Le pictogramme au CENTRE, le chiffre en bas sous l'ouverture de l'arc.

        L'inverse jusqu'ici. Le pictogramme dit de quoi on parle — gomme ou tôle — et c'est la
        première question ; le chiffre dit combien il en reste, et c'est la seconde. Le centre d'un
        cadran est la place qu'on regarde en premier, elle revient donc au pictogramme, et
        l'ouverture de l'arc en bas est faite pour poser une valeur. */
        g.save(); g.translate(cx, cy - r * 0.04); g.scale(r / 15, r / 15);
        dessine(); g.restore();
        g.fillStyle = '#242b25'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `bold ${Math.round(r * 0.66)}px system-ui, sans-serif`;
        g.fillText(String(Math.round(f * 100)), cx, cy + r * 0.72);
      };
      /* Le pneu : un anneau entaillé. C'est le même motif que les pneus de difficulté du menu, et
      il reste lisible à douze pixels là où une bande de roulement dessinée se brouille. */
      const pneu = () => {
        g.strokeStyle = '#364333'; g.lineWidth = 2.6; g.setLineDash([2.4, 1.1]);
        g.beginPath(); g.arc(0, 0, 4.2, 0, Math.PI * 2); g.stroke();
        g.setLineDash([]);
      };
      // La carrosserie : une silhouette vue de dessus, capot vers le haut, avec son pare-brise.
      const tole = () => {
        g.fillStyle = '#364333';
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
    panel(pb.x, pb.y, pb.s, pb.s);
    g.fillStyle = '#e8e8ec';
    const bw = Math.max(3, Math.round(pb.s * 0.11)), bh = Math.round(pb.s * 0.42), ecart = Math.round(pb.s * 0.13);
    g.fillRect(pb.x + pb.s / 2 - ecart - bw, pb.y + (pb.s - bh) / 2, bw, bh);
    g.fillRect(pb.x + pb.s / 2 + ecart, pb.y + (pb.s - bh) / 2, bw, bh);

    // line slider (left thumb)
    this._drawSlider(g, p, t);

    /* La carte, sous la position.

    En bas à droite, elle partageait le coin avec le cadran d'accélérateur, qui est centré et
    déborde jusque-là sur un téléphone : le cadran passait devant et n'en laissait voir qu'une
    moitié. Sous la position, elle est dans l'angle que le pouce n'atteint jamais, et dans la même
    colonne que le chiffre qu'on regarde le plus — on lit sa place, puis où elle se trouve. */
    if (this.mm) {
      const m = this.mm;
      const mx = mmX, my = mmY;
      g.drawImage(m.canvas, mx, my, m.size, m.size);
      drawYellowFlagZones(g,race,p=>{const q=this.mmPoint(p.x,p.y);return {x:mx+q.x,y:my+q.y};},4,.95);
      /* Les points de la carte, deux fois plus gros, et le joueur en bleu ciel.

      Ils faisaient 3 et 4,5 pixels : sur un téléphone, à bout de bras, on ne distinguait pas sa
      propre voiture du peloton, et c'est pourtant la seule information que cette carte doit donner
      en un dixième de seconde. Le jaune, lui, servait déjà au curseur de ligne et à la poignée du
      levier ; le bleu ciel n'est utilisé nulle part ailleurs pour une voiture. */
      for (const car of race.cars) {
        const wp = car.pos, q = this.mmPoint(wp.x, wp.y);
        // pas de cerne ici non plus : le bleu ciel du joueur se distingue tout seul des livrées
        g.fillStyle = car.isPlayer ? '#7fd4ff' : car.livery.body;
        g.beginPath(); g.arc(mx + q.x, my + q.y, car.isPlayer ? 9 : 6, 0, Math.PI * 2); g.fill();
      }
      drawMapRaceFlags(g,race,p=>{const q=this.mmPoint(p.x,p.y);return{x:mx+q.x,y:my+q.y};},7);
    }

    // Relative standings: always show the player and adjacent competitors.
    if (race.mode !== 'timetrial') {
      const order = race.standings(), index = order.indexOf(p);
      const start = Math.max(0, Math.min(index - 1, order.length - 3));
      const st = mobile ? order.slice(Math.max(0,index-1), Math.max(0,index-1)+2) : order.slice(start, start + 3);
      const rowH = mobile ? 26 : 32, bw = mobile ? 180 : 250, bx = ui.app.desktop ? W - P.r - bw : P.l;
      // sous le compteur de tours, qui a grandi : posé à une hauteur fixe, le tableau le chevauchait
      const by = ui.app.desktop ? Math.max(P.t + 100, this.hudZones.lap.y + this.hudZones.lap.h + 8) : mmBas + 4;
      g.font = `italic 900 ${mobile ? 15 : 18}px Racing, Impact, sans-serif`; g.textBaseline = 'top';
      st.forEach((car, i) => {
        const y = by + i * rowH;
        this._hudLabel(g,bx,y,bw,rowH-2,car.isPlayer&&!mobile?'#f2e6ca':'#171b19df');
        g.textAlign = 'left'; g.fillStyle = car.livery.body; g.fillRect(bx + 10, y + (rowH - 12) / 2, 10, 10);
        g.strokeStyle = '#394137'; g.strokeRect(bx + 10, y + (rowH - 12) / 2, 10, 10);
        g.fillStyle = car.isPlayer && !mobile ? '#242b25' : '#f2e6ca';
        g.fillText(`${order.indexOf(car) + 1}  ${String(car.name).toUpperCase()}`, bx + 26, y + 4, mobile ? 92 : 140);
        let gap = t('you').toUpperCase();
        if (car !== p) {
          const distance = Math.abs(car.progress - p.progress), pace = p.bestLap || car.bestLap;
          const sign = car.progress >= p.progress ? '+' : '−';
          gap = pace ? `≈${sign}${(distance / race.track.length * pace).toFixed(1)} s` : `${sign}${Math.round(distance)} m`;
        }
        g.textAlign = 'right'; g.fillText(gap, bx + bw - 14, y + 4, mobile ? 60 : 80);
      });
      g.textAlign = 'left';
    }

    // la pastille du pouce passe au-dessus de la carte et du classement : c'est la commande vive
    if (ui.app.desktop) this._drawDesktopThrottle(g, p, ui);
    else this._drawPouce(g, p);

    // telemetry overlay (G key or settings): the four numbers that describe the car's state
    // la carte n'est plus réservée au téléphone en haut : la télémétrie passe sous elle partout
    const dbgY = mmBas + 10;
    /* `boxW` n'existait plus — et la télémétrie jetait une exception à chaque image.

    Elle se décalait de la largeur du panneau du haut pour ne pas passer dessous. Ce panneau a
    disparu, la variable avec lui, et personne ne l'a vu : la télémétrie ne s'allume qu'à la touche
    G. Elle se range maintenant dans la colonne de gauche, sous la carte, comme le tableau. */
    if (this.debug) this._drawDebug(g, p, P.l + 2, dbgY);

    // countdown
    if (race.state === 'countdown') {
      const c = race.countdown;
      const lights = c > 3.2 ? 0 : c > 2.4 ? 1 : c > 1.6 ? 2 : c > 0.8 ? 3 : 4;
      const cx = W / 2, cy = H * 0.22;
      /* « Chargement » à la place des feux, tant que tout le monde n'est pas là.

      Des feux arrêtés sans un mot sont indiscernables d'un jeu bloqué : c'est exactement ce que le
      joueur voyait, avant que le message « liaison perdue » ne vienne lui donner une mauvaise
      explication par-dessus. On dit donc ce qui se passe, et combien d'écrans manquent. */
      const ch = ui && ui.app && ui.app.chargement;
      const attend = (ch && ch.reste > 0) || (race.attente);
      if (attend) {
        panel(cx - 130, cy - 30, 260, 60);
        g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = 'italic 900 26px Racing, Impact, sans-serif';
        g.fillText(ch && ch.total ? t('loadingN', ch.prets, ch.total) : t('loading'), cx, cy + 7);
        g.font = '13px system-ui, sans-serif'; g.fillStyle = '#cfd3dc';
        g.fillText(t('loadingWhy'), cx, cy + 50);
        g.textAlign = 'left'; g.textBaseline = 'top';
        return;
      }
      panel(cx - 120, cy - 30, 240, 60);
      for (let i = 0; i < 4; i++) { g.fillStyle = i < lights ? '#ff3b3b' : 'rgba(255,255,255,0.15)'; g.beginPath(); g.arc(cx - 75 + i * 50, cy, 16, 0, Math.PI * 2); g.fill(); }
      g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = 'italic 900 24px Racing, Impact, sans-serif';
      const mode = ui.app.desktop ? ui.app.controls.mode : 'touch';
      g.fillText(t(mode === 'wheel' ? 'wheelGo' : mode === 'gamepad' ? 'padGo' : mode === 'touch' ? 'holdToGoTouch' : 'holdToGo'), cx, cy + 40);
      g.font = '14px system-ui, sans-serif'; g.fillStyle = '#cfd3dc';
      g.fillText(t(mode === 'gamepad' ? 'lineHintPad' : mode === 'touch' ? 'lineHintTouch' : 'lineHintPC'), cx, cy + 66);
    } else if (race.time < 1.2 && race.state === 'racing') {
      g.textAlign = 'center'; g.fillStyle = '#5be07a'; g.font = 'italic 900 80px Racing, Impact, sans-serif';
      g.globalAlpha = 1 - race.time / 1.2; g.fillText('GO!', W / 2, H * 0.18); g.globalAlpha = 1;
    }
    if (p.state === 'grass') { g.textAlign = 'center'; g.fillStyle = '#ff6b6b'; g.font = 'italic 900 36px Racing, Impact, sans-serif'; g.fillText(t('offTrack'), W / 2, H * 0.3);
      if(p.engineStopped){g.fillStyle='#ffcf5c';g.font='italic 900 24px Racing, Impact, sans-serif';g.fillText(t('engineCut'),W/2,H*.3+30);} }
    if (p.finished && race.state !== 'finished') { g.textAlign = 'center'; g.fillStyle = '#ffd400'; g.font = 'italic 900 52px Racing, Impact, sans-serif'; g.fillText(`${t('finished')} — P${race.positionOf(p)}`, W / 2, H * 0.3); }
    /* Le temps au tour se pose sous TOUT ce qui occupe le haut, et non à une hauteur fixe.

    Deux fois de suite il est tombé sur quelque chose : à 12 % de la hauteur il couvrait le bouton
    pause en paysage sur un téléphone ; passé sous le bouton, il couvrait les jauges d'usure, parce
    que le panneau de gauche grandit quand l'option est active. Il prend donc le plus bas des
    trois, et il suivra tout seul le prochain élément qu'on ajoutera en haut. */
    if (race.opts.humans && race.state === 'finishing' && race.finishDeadline) {
      const remaining = Math.max(0, Math.ceil(race.finishDeadline - race.time));
      g.save();g.textAlign='center';g.textBaseline='top';g.font='bold 16px system-ui';
      const label = ui.lang === 'en' ? `Race ends in ${remaining}s` : `Fin de course dans ${remaining} s`;
      const width=g.measureText(label).width+24, y=Math.max(H*.12,pb.y+pb.s+14,P.t+boxH+14);
      g.fillStyle='rgba(10,12,20,.85)';g.fillRect((W-width)/2,y-4,width,28);
      g.fillStyle='#f0d885';g.fillText(label,W/2,y);g.restore();
    }
    if (ui.flash && ui.flash.until > performance.now()) { g.textAlign = 'center'; g.fillStyle = ui.flash.color || '#fff'; g.font = 'italic 900 32px Racing, Impact, sans-serif'; g.fillText(ui.flash.text, W / 2, Math.max(H * 0.12, pb.y + pb.s + 14, P.t + boxH + 14)); }
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
    const stops = [{ v: 1, c: LINE_COLORS.jaune, l: t('lineJaune') }, { v: 0, c: LINE_COLORS.racing, l: t('lineRace') }, { v: -1, c: LINE_COLORS.bleu, l: t('lineBleu') }];
    /* Les libellés passent de l'autre côté de la colonne quand le levier est à droite : posés
    toujours à droite, ils sortiraient de l'écran, et c'est le genre de détail qui ne se voit que
    sur l'appareil de celui qui a changé le réglage. */
    const cote = s.droite ? -1 : 1;
    const lx = s.x + 14 * cote;
    g.font = `italic 900 ${this.mobile ? 13 : 15}px Racing, Impact, sans-serif`;
    /* LE FOND SE CALE SUR CE QU'IL PORTE : la même marge du côté de la poignée et du côté du plus
    long libellé, prise à mi-hauteur — là où la poignée repose, sur l'idéale. Il était posé à 18 px
    devant l'axe pour 65 derrière, si bien que la poignée touchait son bord quand les libellés
    flottaient dans le vide de l'autre côté ; et sa largeur fixe ne suivait ni la langue ni la
    taille du texte. Le biseau du fond décale ses bords d'un demi-biseau à mi-hauteur. */
    const larg = Math.max(...stops.map((st) => g.measureText(st.l).width), g.measureText(t('linePit')).width);
    const marge = 7, hFond = s.len + 52 + (ouvert ? 22 : 0), biseau = Math.min(9, hFond * .23);
    const cotePoignee = 13 + marge, coteTexte = 14 + larg + marge;
    const gauche = s.droite ? s.x - coteTexte : s.x - cotePoignee;
    this._hudLabel(g, gauche - biseau / 2, s.y - 26, cotePoignee + coteTexte + biseau, hFond, '#171b19da');
    // track
    g.fillStyle = 'rgba(255,255,255,0.18)'; this._roundRect(g, s.x - 4, s.y, 8, s.len, 4); g.fill();
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
      g.font = `italic 900 ${this.mobile ? 13 : 15}px Racing, Impact, sans-serif`;
      g.fillText(t('linePit'), lx, this.pitY);
    }
    /* La poignée prend la couleur de ce qu'elle demande.

    Elle était jaune en toute position, ce qui ne se voyait pas tant que les deux bouts du levier
    s'appelaient « intérieur » et « extérieur ». Maintenant qu'ils ont une couleur et que les bords
    de la piste la portent aussi, une poignée jaune posée sur la butée bleue dit le contraire de ce
    qu'elle fait. Elle se dégrade donc du bleu au jaune en passant par le blanc de l'idéale, ce qui
    la rend lisible sans lire le libellé — et au coin de l'œil, qui est la façon dont on la lit en
    roulant. Sur la coche des stands elle reste verte, comme la coche. */
    const hy = (p.pitAsk || p.pitState) && ouvert ? this.pitY : s.y + s.len / 2 - p.sel * s.len / 2;
    const melange = (a, b, f) => a.map((v, i) => Math.round(v + (b[i] - v) * f));
    const BLEU = [80, 200, 255], BLANC = [245, 246, 250], JAUNE = [255, 212, 0];
    const u = clamp(p.sel, -1, 1);
    const rgb = (p.pitAsk || p.pitState) && ouvert ? [91, 224, 122]
      : u >= 0 ? melange(BLANC, JAUNE, u) : melange(BLANC, BLEU, -u);
    g.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    g.beginPath(); g.arc(s.x, hy, 13, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(12,14,22,0.85)'; g.lineWidth = 2; g.stroke();
    g.textBaseline = 'top';
  }

  // le freinage demandé par un appui sur le levier de réglage, ou null hors de lui
  reglageValeurAt(x, y) {
    const r = this.reglageZone;
    if (!r) return null;
    if (x < r.x - 14 || x > r.x + r.w + 14 || y < r.y || y > r.y + r.h) return null;
    const u = clamp((x - r.x) / Math.max(1, r.w), 0, 1);
    const v = FREIN_MIN + u * (FREIN_MAX - FREIN_MIN);
    return Math.round(v * 100) / 100;
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
    // le levier de réglage prend le dessus : il est en haut, loin du pouce, mais un appui dessus ne
    // doit surtout pas compter pour de l'accélérateur
    const r = this.reglageZone;
    if (r && x >= r.x - 14 && x <= r.x + r.w + 14 && y >= r.y && y <= r.y + r.h) return null;
    const s = this.slider, d = this.pouce;
    // La pastille visible gagne toujours : un pouce qui s'y pose accélère, où qu'elle ait été
    // déplacée. Elle ne peut jamais couvrir la colonne du levier, donc la ligne reste accessible.
    if (d) {
      const dx = x - d.cx, dy = y - d.cy;
      if (dx * dx + dy * dy < (d.r + 12) * (d.r + 12)) return null;
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
