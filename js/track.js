// Track geometry.
//  - centreline: closed Catmull-Rom spline through control points, resampled every metre
//  - road: left/right half-width per sample (constant for built-in tracks, derived from the
//    drawn lines for editor tracks)
//  - three driving lines (racing / inside / outside) stored as lateral offsets from the centreline.
//    Built-in tracks generate them from curvature; editor tracks project the drawn polylines.
//  - a car at lateral offset `lat` follows an offset curve: curvature k/(1+k*lat) and path length
//    scaled by (1+k*lat), so the inside is shorter but tighter, the outside longer but faster.
'use strict';

const LINE_NAMES = ['inside', 'racing', 'outside'];

/* Le vibreur : son écart à la ligne blanche, et sa largeur, en mètres.
   `js/render.js` le peint avec ces nombres, `js/car.js` décide avec eux ce qui est encore la piste.
   Un seul jeu de constantes pour les deux, sinon la peinture et la règle divergent en silence. */
const KERB_IN = 0.34;        // le vide entre la ligne blanche et le début de la bande
const KERB_LARGE = 1.7;      // la largeur de la bande elle-même

class Track {
  // How fast the racing line may cross the road, in metres of lateral per metre travelled.
  static get RACING_SLOPE() { return 0.3; }

  constructor(def, widthScale) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.theme = def.theme || 'classic';    // palette, see THEMES in js/render.js
    this.puddles = def.puddles || 0;        // standing water: how often, 0 for a dry circuit
    this.laps = def.laps || 3;
    this.ds = 1;
    this.widthScale = widthScale || 1;
    this.image = def.image || null;     // { src, w, h } drawn at world origin with def.scale
    this.drawRoad = def.drawRoad !== false;
    this._build();
  }

  // ---------- helpers ----------
  static spline(pts, steps) {
    const n = pts.length, out = [];
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      for (let j = 0; j < steps; j++) {
        const t = j / steps, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    return out;
  }
  static polyLength(p) {
    let l = 0;
    for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; l += Math.hypot(b[0] - a[0], b[1] - a[1]); }
    return l;
  }
  // resample a closed polyline to N points evenly spaced along it
  static resample(raw, N) {
    const total = Track.polyLength(raw), step = total / N;
    const xs = new Float32Array(N), ys = new Float32Array(N);
    let seg = 0, segPos = 0, a = raw[0], b = raw[1 % raw.length];
    let segLen = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6;
    for (let i = 0; i < N; i++) {
      while (segPos > segLen) {
        segPos -= segLen; seg++;
        a = raw[seg % raw.length]; b = raw[(seg + 1) % raw.length];
        segLen = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6;
      }
      const t = segPos / segLen;
      xs[i] = a[0] + (b[0] - a[0]) * t; ys[i] = a[1] + (b[1] - a[1]) * t;
      segPos += step;
    }
    return { xs, ys };
  }
  static smooth(arr, w) {
    const N = arr.length, out = new Float32Array(N);
    if (w <= 0) { out.set(arr); return out; }
    // running sum over a circular window
    let sum = 0;
    for (let j = -w; j <= w; j++) sum += arr[(j + N) % N];
    for (let i = 0; i < N; i++) {
      out[i] = sum / (2 * w + 1);
      sum += arr[(i + w + 1) % N] - arr[(i - w + N) % N];
    }
    return out;
  }

  // ---------- build ----------
  _build() {
    const def = this.def;
    const scale = def.scale || 1;                       // metres per unit (editor tracks)
    const centerPts = (def.center || def.pts).map(p => [p[0] * scale, p[1] * scale]);
    let raw = Track.spline(centerPts, 24);
    if (def.length && !def.scale) {                     // built-in tracks: rescale to target length
      const f = def.length / Track.polyLength(raw);
      raw = raw.map(p => [p[0] * f, p[1] * f]);
      this.unitScale = f;
    } else this.unitScale = scale;
    const N = Math.max(50, Math.round(Track.polyLength(raw) / this.ds));
    this.n = N; this.length = N * this.ds;
    const { xs, ys } = Track.resample(raw, N);
    this.xs = xs; this.ys = ys;

    // heading, normals, curvature
    const th = new Float32Array(N), nx = new Float32Array(N), ny = new Float32Array(N), kraw = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const dx = xs[(i + 1) % N] - xs[(i - 1 + N) % N], dy = ys[(i + 1) % N] - ys[(i - 1 + N) % N];
      th[i] = Math.atan2(dy, dx);
      const l = Math.hypot(dx, dy) || 1;
      nx[i] = dy / l; ny[i] = -dx / l;                  // left normal (y-down)
    }
    for (let i = 0; i < N; i++) {
      let d = th[(i + 1) % N] - th[(i - 1 + N) % N];
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      kraw[i] = d / (2 * this.ds);
    }
    this.th = th; this.nx = nx; this.ny = ny;
    this.k = Track.smooth(kraw, 4);

    // road half-widths
    this.hwL = new Float32Array(N); this.hwR = new Float32Array(N);
    const baseHw = (def.width || 12) * this.widthScale / 2;
    this.hwL.fill(baseHw); this.hwR.fill(baseHw);

    /* De quel côté est l'intérieur du virage, en tout point — calculé ici et non dans le générateur
    de lignes, parce que le rendu s'en sert aussi : les deux bords de piste sont teintés d'après lui,
    pour qu'on lise d'un coup d'œil de quel côté se trouve la corde. Un circuit qui porte ses lignes
    à la main ne passe pas par le générateur, et doit pourtant avoir ses bords teintés : le sens ne
    dépend que du tracé, pas des lignes. */
    this.sens = this._sensVirages();

    // lines
    this.lines = {};
    // Les lignes sont dans les mêmes unités que `pts`, donc remises à l'échelle comme lui. Passer
    // `scale` ici était juste pour un circuit d'éditeur, où les deux valent la même chose, et faux
    // pour un circuit intégré : sa ligne centrale est redimensionnée après coup pour tomber sur la
    // longueur voulue, si bien que des lignes explicites auraient été projetées à côté de la piste.
    if (def.lines && def.lines.racing) this._projectLines(def.lines, this.unitScale);
    else this._autoLines();
    /* Dix centimètres par mètre pour les lignes secondaires, mesuré et non choisi.

    Le chiffre arbitre deux choses qui tirent en sens contraire. Trop bas, la ligne intérieure
    n'a pas le temps de traverser la piste avant le virage et l'aborde encore du mauvais côté.
    Trop haut, elle traverse plus vite que les voitures ne savent suivre, et l'IA sort de piste.
    Balayé sur les douze circuits, avec d'un côté la part de l'approche où l'intérieure est bien
    à l'intérieur et de l'autre le nombre de sorties de piste en course :

        0,07 → 82 % et 98 sorties      0,12 → 85 % et 109
        0,10 → 84 % et 97              0,18 → 86 % et 147

    Le coude est à 0,10 : au-delà on gagne un point d'approche et on paie douze sorties. */
    this._limitLines(0.10, Track.RACING_SLOPE);
    if (def.lines && !def.width) this._widthFromLines();
    this._clampLines();
    this._lineCurvatures();
    this._buildPits(def);
    this.halfWidth = baseHw;          // nominal, used for grids and camera
    this.width = baseHw * 2;

    // bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < N; i++) {
      const hw = Math.max(this.hwL[i], this.hwR[i]);
      minX = Math.min(minX, xs[i] - hw); maxX = Math.max(maxX, xs[i] + hw);
      minY = Math.min(minY, ys[i] - hw); maxY = Math.max(maxY, ys[i] + hw);
    }
    if (this.image) {
      minX = Math.min(minX, 0); minY = Math.min(minY, 0);
      maxX = Math.max(maxX, this.image.w * scale); maxY = Math.max(maxY, this.image.h * scale);
    }
    this.bounds = { minX, minY, maxX, maxY };

    this.crossings = this._findCrossings();

    // corner segments (kerbs / gravel)
    this.corners = [];
    const thr = 1 / 90;
    let inCorner = false, start = 0;
    for (let i = 0; i <= N; i++) {
      const hi = Math.abs(this.k[i % N]) > thr;
      if (hi && !inCorner) { inCorner = true; start = i; }
      if (!hi && inCorner) {
        inCorner = false;
        if (i - start > 6) this.corners.push({ from: start, to: i, sign: Math.sign(this.k[Math.floor((start + i) / 2) % N]) });
      }
    }

    /* LE VIBREUR, comme donnée du circuit et non comme décor.

    Il était dessiné dans `js/render.js` avec ses propres constantes, et la physique ne savait pas
    qu'il existait : la piste s'arrêtait à la ligne blanche, donc poser deux roues sur le vibreur
    comptait comme une sortie de piste — gravier, dégâts, et bientôt un tour annulé. C'est faux au
    sens le plus simple : un vibreur est fait pour qu'on roule dessus.

    Les mêmes nombres servent maintenant au dessin et à la règle, parce que deux jeux de constantes
    pour une même bande finissent toujours par se contredire, et que l'écart serait invisible — un
    joueur verrait ses roues sur la peinture et un tour annulé sans savoir pourquoi.

    La bande S'AFFINE sur quatre mètres à chaque extrémité du virage. Le dessin, lui, s'arrête net ;
    sans ce biseau la piste s'élargissait de deux mètres d'un coup, et une voiture qui sortait du
    virage en appui sur le vibreur se retrouvait dans le gravier d'une station à l'autre, avec une
    faute, pour n'avoir rien fait. La règle est donc un peu plus stricte que la peinture aux deux
    bouts, jamais plus large. */
    this.kerb = new Float32Array(N);
    const RAMPE = 4;
    for (const c of this.corners) {
      const n = c.to - c.from;
      for (let i = c.from; i <= c.to; i++) {
        const d = Math.min(i - c.from, c.to - i, Math.floor(n / 2));
        const f = RAMPE > 0 ? Math.min(1, d / RAMPE) : 1;
        const k = ((i % N) + N) % N;
        this.kerb[k] = Math.max(this.kerb[k], KERB_LARGE * f);
      }
    }

    this.boards = this._brakingBoards();
  }

  // Braking boards: the 200 / 100 / 50 metre panels on the approach to a corner, each carrying a
  // rally-style arrow bent to the corner's severity and pointing the way it turns. They are placed
  // from the geometry alone, so every circuit gets them without being annotated by hand.
  //
  // Corners are first grouped into braking zones: a chicane or a set of esses is one thing to
  // brake for, not three, and boarding each of its corners would only clutter the approach.
  _brakingBoards() {
    const N = this.n, out = [];
    if (!this.corners.length) return out;
    const GAP = 60;                    // straight below this and the corners are the same zone
    const zones = [];
    for (const c of this.corners) {
      let peak = 0;
      for (let i = c.from; i <= c.to; i++) peak = Math.max(peak, Math.abs(this.k[((i % N) + N) % N]));
      const z = zones[zones.length - 1];
      // The arrow shows the way the FIRST corner of the zone goes, not the tightest: through a
      // chicane it is the first direction you turn that matters. The severity still comes from
      // the tightest, since that is what sets the braking.
      if (z && (c.from - z.to) * this.ds < GAP) { z.to = c.to; z.peak = Math.max(z.peak, peak); }
      else zones.push({ from: c.from, to: c.to, peak, sign: c.sign, firstTo: c.to });
    }
    // the track is a loop: the last zone may run into the first
    if (zones.length > 1) {
      const a = zones[zones.length - 1], b = zones[0];
      if ((b.from + N - a.to) * this.ds < GAP) { b.from = a.from - N; b.peak = Math.max(b.peak, a.peak); zones.pop(); }
    }
    const inAZone = (i) => zones.some(z => {
      const a = ((z.from % N) + N) % N, b = ((z.to % N) + N) % N;
      return a <= b ? (i >= a && i <= b) : (i >= a || i <= b);
    });
    for (const z of zones) {
      // A gentle bend asks for no braking, so it gets no board: a panel there is only clutter.
      if (z.peak < 1 / 200) continue;
      const radius = 1 / z.peak;
      // Pace-note grading, tightest first: 1 is extremely aggressive, 6 barely a kink.
      const grade = radius < 20 ? 1 : radius < 35 ? 2 : radius < 55 ? 3 : radius < 90 ? 4 : radius < 150 ? 5 : 6;
      // A few corners deserve their own note rather than a number, as in rally: how far round the
      // road goes matters as much as how tight it is. A ninety that has to be taken slowly is a
      // square; a corner that turns you back where you came from is a hairpin.
      let turn = 0;
      for (let i = z.from; i < z.firstTo; i++) {
        const a = ((i % N) + N) % N, b = (((i + 1) % N) + N) % N;
        let e = this.th[b] - this.th[a];
        while (e > Math.PI) e -= 2 * Math.PI;
        while (e < -Math.PI) e += 2 * Math.PI;
        turn += e;
      }
      const A = Math.abs(turn) * 180 / Math.PI;
      const kind = (A >= 150 && radius < 40) ? 'hairpin'
        : (A >= 115 && radius < 26) ? 'acute'
          : (A >= 75 && A <= 105 && radius < 35) ? 'square' : 'normal';
      const entry = z.from * this.ds;
      for (const dist of [200, 100, 50]) {
        const s = this.wrap(entry - dist);
        const i = this.idx(s);
        if (inAZone(i)) continue;                 // the straight is too short for this one
        // Outside of the corner, where there is room and where the panel stays clear of the apex.
        // nx,ny is the left normal, and a positive curvature turns right on screen, so the outside
        // of a right-hander is the left side: side and sign match.
        const side = z.sign || 1;
        const hw = side > 0 ? this.hwL[i] : this.hwR[i];
        const off = hw + 4.2;
        out.push({
          x: this.xs[i] + this.nx[i] * off * side,
          y: this.ys[i] + this.ny[i] * off * side,
          th: this.th[i], dist, grade, kind, sign: z.sign, side,
          from: z.from, to: z.firstTo,        // the corner the arrow describes, for checking
        });
      }
    }
    // Two boards on top of each other read as neither: where the end of one approach meets the
    // start of the next, keep the one closest to its own corner.
    out.sort((a, b) => a.dist - b.dist);
    const kept = [];
    for (const b of out) {
      if (kept.some(k => (k.x - b.x) ** 2 + (k.y - b.y) ** 2 < 22 * 22)) continue;
      kept.push(b);
    }
    return kept;
  }

  // Lines generated from curvature: racing = out-in-out, inside/outside hug the road edges
  // on the side of the next corner.
  /* The racing line, found rather than guessed.

  The old rule was a formula on smoothed curvature: hug the inside in proportion to how tight the
  corner is. It produced something that mostly followed the middle of the road, because a formula
  on the road's own curvature cannot know that the fast way through a corner starts on the far side
  of the road two hundred metres earlier.

  So the line is solved for instead. Write it as a lateral offset a(i) at every metre of the track,
  giving the point P(i) = C(i) + n(i)·a(i), and look for the offsets that make the path bend as
  little as possible:

      minimise  Σ |P(i-1) − 2·P(i) + P(i+1)|²      subject to the line staying on the road

  That is the classic minimum-curvature line, and it is what produces out-in-out on its own: the
  solver discovers that starting wide lets the corner be taken with a bigger radius, and that the
  corner after decides which side to exit on. Nothing about corners is coded anywhere — only the
  road's shape and its width.

  It is solved by relaxation. The energy above is quadratic in the offsets, so a step of Gauss-
  Seidel on one offset, holding its neighbours, is a division: the second derivative of the energy
  with respect to a(i) is 6·|n|² = 6, and the first is n(i)·(D(i-1) − 2·D(i) + D(i+1)) where D is
  the second difference of P. Clamp to the road after every step and repeat.
  */
  _autoLines() {
    const N = this.n, margin = 1.7;
    const lo = new Float32Array(N), hi = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      hi[i] = Math.max(0.2, this.hwL[i] - margin);
      lo[i] = -Math.max(0.2, this.hwR[i] - margin);
    }
    const racing = this._minCurvature(lo, hi, 120);

    /* Les deux autres lignes : celle qui ferme la porte, et celle qui passe autour.

    Elles ne sont pas des trajectoires en soi mais des écarts à la rapide, et tout tient à une seule
    question : de quel côté est l'intérieur du virage. Elle se tranche par la géométrie et non par
    une convention de signe — le fichier en portait deux, contradictoires, et la ligne « intérieure »
    se trouvait de fait à l'extérieur du virage 99 % du temps. `tools/cotes.js` le mesure, et
    `tools/curseur.js` le vérifie en conduisant, ce qui n'est pas la même chose.

    Chaque ligne se déporte d'une fraction de la place qui reste de son côté. Cela donne deux voies
    nettement asymétriques, et c'est une propriété de la géométrie plutôt qu'un réglage : la ligne de
    course est la trajectoire de courbure minimale, donc elle vient déjà toucher le bord intérieur à
    chaque apex. Il n'y a rien « de plus à l'intérieur » dans un virage, et rien de plus à
    l'extérieur dans une ligne droite, où elle se place déjà du côté extérieur du virage qui vient.
    Mesuré en médiane, l'écart à la rapide vaut :

                        en virage   à l'approche   en ligne droite
        intérieure          0,7 m        3,8 m           7,2 m
        extérieure          6,5 m        3,5 m           1,2 m

    Les deux se séparent donc dans des zones opposées, ce qui est juste : on ferme la porte AVANT le
    virage, et on passe autour PENDANT. Le curseur n'en reste pas moins asymétrique au ressenti.

    Deux autres constructions ont été essayées et mesurées, et toutes deux coûtent trop cher à l'IA
    pour ce qu'elles apportent. Viser franchement les deux bords plutôt qu'une fraction de la place
    restante : 217 sorties de piste sur les douze circuits contre 94, sans gagner un point sur le
    curseur. Faire de l'intérieure le chemin le plus court du couloir — le fil tendu, qui est la
    vraie ligne défensive et serre tous les apex : 228 sorties, parce que la plus courte est aussi
    celle de plus petit rayon, et que les voitures ne la tiennent pas. */
    const g = this.sens;
    const inside = new Float32Array(N), outside = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const r = racing[i];
      const toL = hi[i] - r, toR = r - lo[i];
      const vers = (q, sg) => (sg > 0 ? q * toL : -q * toR);   // se déporter de q, du côté sg
      inside[i] = r + vers(Math.abs(g[i]) * 0.85, g[i]);       // vers l'intérieur du virage
      outside[i] = r + vers(Math.abs(g[i]) * 0.85, -g[i]);     // et l'autre, vers l'extérieur
    }
    this.lines.racing = racing;
    this.lines.inside = Track.smooth(inside, 16);
    this.lines.outside = Track.smooth(outside, 16);
  }

  /* De quel côté est l'intérieur du virage, en tout point du tour.

  Deux exigences qui tirent en sens contraire. Chaque virage doit imposer son vrai sens, sinon la
  ligne « intérieure » se retrouve à l'extérieur — elle y était 99 % du temps, avant. Et les lignes
  doivent rester écartées dans les lignes droites, sinon il n'y a pas de place pour doubler ; elles
  s'y confondaient sur 13 % du tour. Un simple lissage ne peut pas les satisfaire toutes les deux :
  large, il écrase les virages courts ; étroit, il laisse les lignes se rejoindre dès que la route
  est droite.

  La sortie est de ne pas moyenner du tout. Chaque virage décide de son sens, franchement ; entre
  deux virages, le sens est **tenu** plutôt qu'interpolé. Deux virages de même main laissent donc les
  lignes écartées d'un bout à l'autre de la droite qui les sépare, et deux virages de mains opposées
  se partagent la droite en deux, le croisement tombant au milieu. C'est le principe des voies qui se
  croisent à des endroits choisis, et non d'un fondu qui les colle l'une à l'autre sur des centaines
  de mètres.

  Le sens local se lit sur la dérivée seconde de l'axe, ouverte sur quinze mètres : elle pointe vers
  le centre de courbure, et projetée sur la normale gauche elle dit de quel côté il se trouve. Prise
  sur un seul pas elle ne pèserait que quelques millimètres pour un virage de 250 m de rayon, et sa
  direction ne serait que du bruit. */
  _sensVirages() {
    const N = this.n, W = 15;
    const dir = new Float32Array(N), poids = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = (i - W + N) % N, b = (i + W) % N;
      const cx = this.xs[b] - 2 * this.xs[i] + this.xs[a];
      const cy = this.ys[b] - 2 * this.ys[i] + this.ys[a];
      const m = Math.hypot(cx, cy);
      poids[i] = m;
      dir[i] = m > 1e-9 ? (cx * this.nx[i] + cy * this.ny[i]) / m : 0;
    }
    // Le sens de chaque virage, sur un lissage court : assez pour ôter le bruit, pas assez pour
    // qu'un virage emprunte le sens de son voisin.
    const num = new Float32Array(N);
    for (let i = 0; i < N; i++) num[i] = dir[i] * poids[i];
    const numS = Track.smooth(num, 30), poidsS = Track.smooth(poids, 30);

    /* Où il y a assez de virage pour décider — et le seuil est d'abord absolu.

    Un seuil seulement relatif au virage le plus serré du circuit se trompe sur les tracés
    contrastés. À Monza les chicanes font 22 m de rayon ; une grande courbe de 234 m tombait donc
    très en dessous de 18 % du maximum, se voyait classée « ligne droite », et héritait du sens de
    ses voisines — les deux lignes s'y retrouvaient franchement inversées, sur cinq mètres d'écart.
    C'est exactement le genre de virage rapide où le choix de ligne décide d'un dépassement.

    Le seuil absolu dit la chose physique : en deçà de 400 m de rayon, il y a un côté à choisir.
    Pour un arc de rayon R, la dérivée seconde ouverte sur W échantillons vaut (W·ds)²/R, d'où le
    calcul. Le seuil relatif reste, mais comme plafond : sur un tracé sans aucun virage serré il
    laisse quand même les grandes courbes décider. */
    let max = 0;
    for (let i = 0; i < N; i++) max = Math.max(max, poidsS[i]);
    const seuil = Math.min(max * 0.18, (W * this.ds) * (W * this.ds) / 400);
    const signe = new Int8Array(N);
    for (let i = 0; i < N; i++) {
      signe[i] = poidsS[i] > seuil ? (numS[i] >= 0 ? 1 : -1) : 0;
    }

    // Aucun virage franc — un anneau parfait : on garde le sens brut plutôt que de rendre zéro,
    // qui collerait les trois lignes.
    let décidés = 0;
    for (let i = 0; i < N; i++) if (signe[i]) décidés++;
    if (!décidés) {
      const out = new Float32Array(N);
      for (let i = 0; i < N; i++) out[i] = Math.tanh((numS[i] / (poidsS[i] + 1e-9)) * 3.5);
      return out;
    }

    /* Tenir le sens entre deux virages — et basculer tôt, vers le virage qui vient.

    Une ligne intérieure n'est pas d'abord une ligne de virage : c'est celle qui **arrive** du côté
    intérieur du virage qui vient, cent mètres avant le point de corde. C'est là qu'elle ferme la
    porte, et c'est là que le joueur la voit.

    La première version partageait chaque ligne droite en deux, moitié au sens du virage précédent,
    moitié à celui du suivant. Mesurée sur l'approche — les quatre-vingts mètres qui précèdent
    l'entrée d'un virage — elle n'était du bon côté que 71 % du temps, et 55 % au Nürburgring : sur
    la première moitié de chaque droite, l'intérieure longeait encore le côté du virage d'avant,
    c'est-à-dire l'extérieur de celui qu'elle abordait.

    Le sens du virage précédent n'est donc tenu que le temps de se déplier — une trentaine de mètres
    — puis toute la suite de la droite appartient au virage qui vient. Le limiteur de pente étire de
    toute façon la traversée sur une centaine de mètres ; basculer tôt, c'est lui laisser le temps
    d'arriver. */
    let début = 0;
    while (!signe[début]) début++;
    const plein = new Int8Array(N);
    for (let n = 0; n < N; n++) {
      const i = (début + n) % N;
      plein[i] = signe[i];
    }
    for (let n = 0; n < N; n++) {
      const i = (début + n) % N;
      if (plein[i]) continue;
      let len = 0;
      while (len < N && !plein[(i + len) % N]) len++;
      const avant = plein[(i - 1 + N) % N];
      const après = plein[(i + len) % N] || avant;
      const tenu = Math.min(len * 0.25, Math.round(30 / this.ds));
      for (let k = 0; k < len; k++) plein[(i + k) % N] = k < tenu ? avant : après;
      n += len - 1;
    }

    /* Le créneau est adouci juste ce qu'il faut pour que le croisement ne soit pas une marche.
    Vingt mètres suffisent : le limiteur de pente, appliqué ensuite, étire de toute façon un
    changement de côté sur la distance qu'une voiture met à traverser la piste. Ce qui est décidé
    ici, c'est **où** le croisement tombe, pas à quelle vitesse il se fait. */
    const doux = Track.smooth(Float32Array.from(plein), 20);
    const out = new Float32Array(N);
    for (let i = 0; i < N; i++) out[i] = Math.tanh(doux[i] * 3);
    return out;
  }

  /* Relaxes a line to the least-bending path that stays between `lo` and `hi`.

  Done at one metre only, this never finishes: a pass of relaxation carries a change by one sample,
  so after six hundred passes the far end of a straight still knows nothing about the corner it
  leads into — and a racing line is precisely the corner reaching back up the straight. The first
  attempt did exactly that and came out worse than the formula it replaced: a kinked line with a
  minimum radius of eight metres where the old one managed thirteen.

  So the same relaxation runs over a ladder of spans. Measuring the bend between samples sixty-four
  metres apart makes a pass carry sixty-four metres of news, and finds the broad shape — which side
  to be on, where to start moving. Each finer span then sharpens it without undoing it, down to the
  metre. Same energy, same step, only the distance over which the bend is measured changes.
  */
  _minCurvature(lo, hi, passes) {
    const RELAX = 0.5;              // the stencil is wide; a full Newton step overshoots
    // Bending alone, with no term for the path's own length. Adding one is the textbook blend —
    // the widest arc against the shortest way round — and it was tried: a tenth of length weight
    // costs six seconds over eight circuits, half a weight costs fourteen. On a road this wide
    // relative to its corners, the shortest way round is simply slower.
    const N = this.n, xs = this.xs, ys = this.ys, nx = this.nx, ny = this.ny;
    const a = new Float32Array(N);
    const px = new Float32Array(N), py = new Float32Array(N);
    const dx = new Float32Array(N), dy = new Float32Array(N);
    const at = (i) => ((i % N) + N) % N;
    const place = (i) => { px[i] = xs[i] + nx[i] * a[i]; py[i] = ys[i] + ny[i] * a[i]; };
    // Start in the middle of the corridor: where the road is not symmetric, that is the line's home.
    for (let i = 0; i < N; i++) { a[i] = (lo[i] + hi[i]) / 2; place(i); }

    // One clean Jacobi step per pass: the whole gradient is read from the positions as they were
    // at the start of the pass, every offset moves, and only then are the positions rebuilt.
    // Moving a point in the middle of reading the gradient mixes old and new, and on this stencil
    // that is unstable — the line diverges and pins itself to the edges of the road, which showed
    // up as an eleven-metre jump across the start line.
    const grad = new Float32Array(N);
    const spans = [64, 32, 16, 8, 4, 2, 1].filter(h => h * 4 < N);
    for (const h of spans) {
      for (let it = 0; it < passes; it++) {
        for (let i = 0; i < N; i++) {
          const p = at(i - h), q = at(i + h);
          dx[i] = px[p] - 2 * px[i] + px[q];
          dy[i] = py[p] - 2 * py[i] + py[q];
        }
        for (let i = 0; i < N; i++) {
          const p = at(i - h), q = at(i + h);
          // d²E/da² = 6 for this stencil, so the Newton step is the gradient over six
          grad[i] = (nx[i] * (dx[p] - 2 * dx[i] + dx[q]) + ny[i] * (dy[p] - 2 * dy[i] + dy[q])) / 6;
        }
        for (let i = 0; i < N; i++) a[i] = clamp(a[i] - RELAX * grad[i], lo[i], hi[i]);
        for (let i = 0; i < N; i++) place(i);
      }
    }
    return a;
  }

  // A line must be something a car can actually follow: limit how fast it moves across the road
  // (metres of lateral per metre travelled), forward and backward so both ends of a move are gentle.
  /* Limite la vitesse à laquelle une ligne traverse la piste — mais pas la même chose pour chacune.

  La ligne de course est bridée sur sa position, et généreusement : elle est résolue, pas devinée, et
  sa courbure est déjà la plus faible que la route autorise. Un plafond sévère ne pourrait que la
  rabattre vers le milieu, ce qu'il faisait — à sept centimètres par mètre, traverser sept mètres de
  piste demande cent mètres, et elle n'atteignait jamais l'extérieur avant un virage.

  Les deux autres sont bridées sur leur **écart à la ligne de course**, et non sur leur position.
  C'est la correction d'un défaut qui rendait la ligne « intérieure » inutilisable : bridée en
  absolu à 0,07 m/m quand la ligne de course se déporte jusqu'à 0,30, elle ne pouvait pas suivre
  celle-ci dans une entrée de virage et se faisait littéralement rabattre — les deux lignes ne se
  trouvaient de part et d'autre que 60 % du temps, et l'intérieure passait du mauvais côté. Brider
  l'écart plutôt que la position est d'ailleurs ce qui a un sens : une voiture sur la ligne
  intérieure roule sensiblement parallèle à la ligne de course, et ne s'en écarte que
  progressivement. */
  _limitLines(maxSlope, racingSlope) {
    const N = this.n;
    const lisse = (a, limit) => {
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 1; i <= N; i++) { const j = i % N, k = (i - 1) % N; a[j] = clamp(a[j], a[k] - limit, a[k] + limit); }
        for (let i = N - 1; i >= -1; i--) { const j = (i + N) % N, k = (i + 1) % N; a[j] = clamp(a[j], a[k] - limit, a[k] + limit); }
      }
      return Track.smooth(a, 4);
    };
    this.lines.racing = lisse(this.lines.racing, racingSlope == null ? maxSlope : racingSlope);
    const r = this.lines.racing;
    for (const name of LINE_NAMES) {
      if (name === 'racing') continue;
      const a = this.lines[name];
      const ec = new Float32Array(N);
      for (let i = 0; i < N; i++) ec[i] = a[i] - r[i];
      const lim = lisse(ec, maxSlope);
      const out = new Float32Array(N);
      for (let i = 0; i < N; i++) out[i] = r[i] + lim[i];
      this.lines[name] = out;
    }
  }

  // Editor tracks: each drawn line becomes a lateral profile by walking it along the centreline.
  _projectLines(lines, scale) {
    const N = this.n, xs = this.xs, ys = this.ys, nx = this.nx, ny = this.ny;
    for (const name of LINE_NAMES) {
      const pts = lines[name];
      const lat = new Float32Array(N);
      if (!pts || pts.length < 3) { lat.fill(0); this.lines[name] = lat; continue; }
      const dense = Track.spline(pts.map(p => [p[0] * scale, p[1] * scale]), 16);
      const acc = new Float32Array(N), cnt = new Uint16Array(N);
      // start: nearest centre sample to the first point
      let j = 0, best = Infinity;
      for (let i = 0; i < N; i++) { const d = (xs[i] - dense[0][0]) ** 2 + (ys[i] - dense[0][1]) ** 2; if (d < best) { best = d; j = i; } }
      for (const p of dense) {
        // search a forward window so crossovers don't jump branches
        let bj = j, bd = Infinity;
        for (let w = -6; w <= 40; w++) {
          const i = (j + w + N) % N;
          const d = (xs[i] - p[0]) ** 2 + (ys[i] - p[1]) ** 2;
          if (d < bd) { bd = d; bj = i; }
        }
        j = bj;
        acc[j] += (p[0] - xs[j]) * nx[j] + (p[1] - ys[j]) * ny[j];
        cnt[j]++;
      }
      // fill gaps by interpolation around the loop
      let firstFilled = -1;
      for (let i = 0; i < N; i++) if (cnt[i]) { firstFilled = i; break; }
      if (firstFilled < 0) { lat.fill(0); this.lines[name] = lat; continue; }
      let i = firstFilled, guard = 0;
      while (guard++ < N + 2) {
        const v0 = acc[i] / cnt[i];
        let nxt = (i + 1) % N, gap = 1;
        while (!cnt[nxt] && gap < N) { nxt = (nxt + 1) % N; gap++; }
        const v1 = acc[nxt] / cnt[nxt];
        for (let g = 0; g < gap; g++) lat[(i + g) % N] = v0 + (v1 - v0) * (g / gap);
        i = nxt;
        if (i === firstFilled) break;
      }
      this.lines[name] = Track.smooth(lat, 4);
    }
  }

  // road edges for editor tracks: cover the drawn lines plus a margin
  _widthFromLines() {
    const N = this.n, m = 2.2, minHw = 4.5;
    const L = new Float32Array(N), R = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let maxL = 0, maxR = 0;
      for (const name of LINE_NAMES) { const v = this.lines[name][i]; if (v > maxL) maxL = v; if (-v > maxR) maxR = -v; }
      L[i] = Math.max(minHw, maxL + m); R[i] = Math.max(minHw, maxR + m);
    }
    this.hwL = Track.smooth(L, 8); this.hwR = Track.smooth(R, 8);
  }

  _clampLines() {
    const N = this.n;
    for (const name of LINE_NAMES) {
      const a = this.lines[name];
      for (let i = 0; i < N; i++) a[i] = clamp(a[i], -(this.hwR[i] - 1.3), this.hwL[i] - 1.3);
    }
  }

  // Real curvature of each line: the road curvature at that offset plus the bending of the line
  // itself as it moves across the road (a line drifting from outside to inside bends more than
  // the road at corner entry). This is what the cars actually have to turn, so the braking AI
  // and the speed profile use it.
  /* How hard each line actually bends — the number the speed profile brakes for.

  Measured on the line's own points rather than from a formula on the road's curvature plus the
  offset's second difference. The formula is right in the limit, but it was evaluated over a
  six-metre stencil and then smoothed again, so a line that tightened over a couple of metres came
  out gentler than it is. The car was sent into those places carrying speed it could not hold: the
  grip demand peaked at three times what the tyres had, and it slid rather than turned.
  */
  _lineCurvatures() {
    const N = this.n;
    this.lineK = {};
    const at = (i) => ((i % N) + N) % N;
    for (const name of LINE_NAMES) {
      const lat = this.lines[name], out = new Float32Array(N);
      const px = new Float32Array(N), py = new Float32Array(N);
      for (let i = 0; i < N; i++) { px[i] = this.xs[i] + this.nx[i] * lat[i]; py[i] = this.ys[i] + this.ny[i] * lat[i]; }
      for (let i = 0; i < N; i++) {
        const p = at(i - 1), q = at(i + 1);
        // signed turn per metre travelled: the circle through the three points
        const ax = px[i] - px[p], ay = py[i] - py[p];
        const bx = px[q] - px[i], by = py[q] - py[i];
        const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
        if (la < 1e-4 || lb < 1e-4) { out[i] = 0; continue; }
        let d = Math.atan2(by, bx) - Math.atan2(ay, ax);
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        out[i] = 2 * d / (la + lb);
      }
      this.lineK[name] = Track.smooth(out, 2);
    }
  }

  _findCrossings() {
    const N = this.n, xs = this.xs, ys = this.ys, step = 4, res = [];
    const seg = (i) => [xs[i % N], ys[i % N], xs[(i + step) % N], ys[(i + step) % N]];
    for (let i = 0; i < N; i += step) {
      const a = seg(i);
      for (let j = i + 40; j < N && j < i + N - 40; j += step) {
        const b = seg(j);
        const d = (a[2] - a[0]) * (b[3] - b[1]) - (a[3] - a[1]) * (b[2] - b[0]);
        if (Math.abs(d) < 1e-9) continue;
        const t = ((b[0] - a[0]) * (b[3] - b[1]) - (b[1] - a[1]) * (b[2] - b[0])) / d;
        const u = ((b[0] - a[0]) * (a[3] - a[1]) - (b[1] - a[1]) * (a[2] - a[0])) / d;
        if (t >= 0 && t < 1 && u >= 0 && u < 1) res.push({ under: i, over: j });
      }
    }
    return res;
  }

  // ---------- queries ----------
  wrap(s) { const L = this.length; s = s % L; return s < 0 ? s + L : s; }
  idx(s) { return Math.floor(this.wrap(s) / this.ds) % this.n; }
  // Samples sit one metre apart; everything positional is interpolated between them, otherwise
  // the car advances in one-metre hops instead of moving continuously.
  _at(s) {
    const w = this.wrap(s) / this.ds, fl = Math.floor(w);
    const i = fl % this.n;
    return { i, j: (i + 1) % this.n, f: w - fl };
  }
  _lerp(arr, s) { const a = this._at(s); return arr[a.i] + (arr[a.j] - arr[a.i]) * a.f; }
  curvAt(s) { return this._lerp(this.k, s); }
  headingAt(s) {
    const a = this._at(s);
    let d = this.th[a.j] - this.th[a.i];
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return this.th[a.i] + d * a.f;
  }
  // curvature of the offset curve at lateral offset lat (positive = left)
  curvAtLat(s, lat) {
    const k = this.curvAt(s);
    return k / Math.max(0.25, 1 + k * lat);
  }
  // metres of centreline per metre travelled at offset lat
  advanceFactor(s, lat) { return 1 / Math.max(0.25, 1 + this.curvAt(s) * lat); }
  /** La largeur de vibreur qui compte comme piste à cette station — zéro dans les lignes droites. */
  kerbAt(s) { return this.kerb ? this._lerp(this.kerb, s) : 0; }
  hwLeftAt(s) { return this._lerp(this.hwL, s); }
  hwRightAt(s) { return this._lerp(this.hwR, s); }
  lineLat(name, s) { return this._lerp(this.lines[name], s); }

  /* La voie des stands, calculée et non dessinée.

  Aucun circuit n'en a. Les douze intégrés sont une ligne centrale et des largeurs, ceux de
  l'éditeur aussi, et en dessiner douze à la main aurait laissé les circuits perso sans stands —
  donc la moitié du chantier inutilisable pour qui fabrique ses propres tracés.

  Elle est donc déduite du tracé : un couloir décalé latéralement du côté DROIT, qui s'écarte de la
  piste avant la ligne d'arrivée, longe la case d'arrêt, et revient se fondre après. Le côté droit
  plutôt que l'intérieur du virage : « intérieur » change de sens à chaque courbe, alors qu'un côté
  fixe donne une voie qui ne traverse jamais la piste.

  Les trois repères sont proportionnels à la longueur du circuit et bornés : sur un tracé court la
  voie occuperait sinon un quart du tour, sur un tracé long elle serait ridicule. */
  /* La voie est placée par défaut sur la ligne d'arrivée, et se déplace par circuit.

  Le défaut vaut pour onze tracés sur douze. Spa fait exception : sa zone d'arrêt tombait dans le
  dernier virage, la voiture y passait en portant la vitesse de la courbe et sa vitesse minimale
  dans la zone ne descendait jamais en dessous de 12,7 m/s. Aucun arrêt de toute la course, sur ce
  seul circuit. Le tracé n'a aucun croisement, contrairement à ce que j'avais d'abord supposé.

  `def.pitAt` — la fraction du tour où se trouve la ZONE D'ARRÊT — le corrige, et sert aussi aux
  circuits de l'éditeur.

  J'AI ESSAYÉ DE LE CHOISIR AUTOMATIQUEMENT, en cherchant le tronçon le plus droit quand la ligne
  est trop tordue, et la mesure a refusé : la courbure ne prédit pas l'échec. Le défaut de Spa a
  une courbure maximale de 49,6 pour mille dans sa zone — mais celui du Nürburgring vaut 65,3 et
  fonctionne, Red Bull Ring 43,5 fonctionne, Le Mans 34,3 fonctionne. Aucun seuil ne sépare le cas
  qui casse des cas qui marchent. Un placement automatique aurait donc déplacé six circuits sains
  sur un critère faux, pour en sauver un. */
  _buildPits(def) {
    const L = this.length;
    const long = Math.max(160, Math.min(L * 0.22, 340));
    const ancre = def && def.pitAt != null ? this.wrap(def.pitAt * L) : this.wrap(-long * 0.20);
    this.pit = {
      entree: this.wrap(ancre - long * 0.50),
      boite: ancre,
      sortie: this.wrap(ancre + long * 0.50),
      long,
      separation: 1.2,   // bande neutre entre le bord de piste et le bord intérieur de la voie
      largeur: 6.0,      // largeur de la voie elle-même
      zone: 26,          // demi-longueur de la zone d'arrêt — il suffit de s'y arrêter
    };
  }

  /* Où se trouve la voie des stands à cette abscisse, et à quel point on y est engagé.

  UNE VOIE PARALLÈLE, comme sur un vrai circuit : deux courtes bretelles aux extrémités, et entre
  les deux un couloir à écart CONSTANT du bord de piste. La première version biseautait sur toute
  la longueur, ce qui donnait un losange — on s'écartait puis on revenait sans jamais longer quoi
  que ce soit, et il n'y avait pas de « voie » à proprement parler.

  L'écart se mesure depuis le bord droit de la piste et non depuis l'axe : `hwRightAt` varie avec
  l'abscisse, donc suivre le bord garde la voie parallèle à la PISTE plutôt qu'à sa ligne médiane.
  C'est ce que fait un vrai circuit, et c'est ce qui évite que la voie morde dans l'asphalte là où
  la piste s'élargit.

  Rend `null` hors de la voie. `u` va de 0 à 1 de l'entrée à la sortie. */
  pitAt(s) {
    const p = this.pit;
    if (!p) return null;
    const span = this.wrap(p.sortie - p.entree);
    const d = this.wrap(s - p.entree);
    if (d > span) return null;
    const u = d / span;
    // bretelles courtes : 12 % à l'entrée, 14 % à la sortie. Entre les deux, écart plein.
    const ecart = Math.min(1, Math.min(u / 0.12, (1 - u) / 0.14));
    const dBoite = this.wrap(s - p.boite);
    /* Les deux bords, mesurés depuis le bord de piste vers l'EXTÉRIEUR.

    La première version posait l'axe de la voie à un écart fixe et en déduisait les bords par
    demi-largeur. Aux extrémités, où l'écart tombe à zéro, le bord intérieur passait donc DANS la
    piste, et le polygone tracé couvrait tout depuis l'asphalte jusqu'aux garages : une dalle large
    de quinze mètres au lieu d'une voie de six. On construit donc depuis le bord, vers le dehors,
    et la voie ne peut plus mordre sur la piste. */
    const bord = this.hwRightAt(s);
    const interne = -(bord + p.separation * ecart);
    const externe = interne - p.largeur * (0.4 + 0.6 * ecart);
    return {
      u, ecart, interne, externe,
      lat: (interne + externe) / 2,
      // distance signée à la zone d'arrêt : négative avant, positive après
      boite: dBoite > this.length / 2 ? dBoite - this.length : dBoite,
      // dans la zone d'arrêt ? il suffit d'y être arrêté, la précision n'est pas le jeu
      dansZone: Math.abs(dBoite > this.length / 2 ? dBoite - this.length : dBoite) < p.zone,
    };
  }
  // blend of the three lines: sel in [-1, 1] (-1 inside, 0 racing, +1 outside)
  /* Où viser, à cette abscisse, pour la position de levier demandée.

  `sel` va de -1 (corde) à +1 (extérieur), et AU-DELÀ DE -1 vient la voie des stands : c'est la
  coche de plus sur le levier. En dessous de -1 on mélange donc la ligne intérieure et le couloir
  des stands, ce qui donne un rabattement progressif plutôt qu'un saut — et, hors de la voie, la
  position -2 ne vaut rien de plus que la corde, si bien qu'un pilote qui la demande trop tôt reste
  simplement à l'intérieur jusqu'à l'entrée. */
  targetLat(s, sel) {
    const r = this._lerp(this.lines.racing, s);
    if (sel >= 0) return r + (this._lerp(this.lines.outside, s) - r) * Math.min(1, sel);
    const dedans = r + (this._lerp(this.lines.inside, s) - r) * Math.min(1, -sel);
    if (sel > -1) return dedans;
    const p = this.pitAt(s);
    if (!p) return dedans;
    return dedans + (p.lat - dedans) * Math.min(1, -sel - 1);
  }
  // curvature of the blended line (what a car following it really turns)
  lineCurv(s, sel) {
    const r = this._lerp(this.lineK.racing, s);
    if (sel < 0) return r + (this._lerp(this.lineK.inside, s) - r) * Math.min(1, -sel);
    return r + (this._lerp(this.lineK.outside, s) - r) * Math.min(1, sel);
  }
  // strongest curvature ahead along a line
  curvAhead(s, dist, sel) {
    const i0 = this.idx(s), cnt = Math.max(1, Math.round(dist / this.ds));
    let best = 0;
    for (let j = 0; j < cnt; j++) {
      const i = (i0 + j) % this.n;
      const v = sel == null ? this.k[i] : this.lineCurv(i * this.ds, sel);
      if (Math.abs(v) > Math.abs(best)) best = v;
    }
    return best;
  }
  // nearest centreline sample to a world point, searched in a window around `nearS`
  project(x, y, nearS, window) {
    const N = this.n, W = window || 8;   // small window: a crossing must never latch the other branch
    const i0 = this.idx(nearS || 0);
    let best = i0, bd = Infinity;
    for (let d = -W; d <= W; d++) {
      const i = ((i0 + d) % N + N) % N;
      const dx = x - this.xs[i], dy = y - this.ys[i], dd = dx * dx + dy * dy;
      if (dd < bd) { bd = dd; best = i; }
    }
    const i = best, j = (i + 1) % N, h = (i - 1 + N) % N;
    // refine onto the neighbouring segment so `s` is continuous, not snapped to the sample
    let bi = i, t = 0;
    for (const [a, b] of [[h, i], [i, j]]) {
      const ax = this.xs[a], ay = this.ys[a], vx = this.xs[b] - ax, vy = this.ys[b] - ay;
      const l2 = vx * vx + vy * vy || 1e-9;
      const u = clamp(((x - ax) * vx + (y - ay) * vy) / l2, 0, 1);
      const px = ax + vx * u, py = ay + vy * u;
      const dd = (x - px) * (x - px) + (y - py) * (y - py);
      if (dd < bd) { bd = dd; bi = a; t = u; }
    }
    const sOut = (bi + t) * this.ds;
    const nx = this.nx[bi], ny = this.ny[bi];
    return { s: sOut, i: bi, lat: (x - this.xs[bi]) * nx + (y - this.ys[bi]) * ny };
  }

  pos(s, lat) {
    const a = this._at(s), i = a.i, j = a.j, f = a.f;
    const x = this.xs[i] + (this.xs[j] - this.xs[i]) * f, y = this.ys[i] + (this.ys[j] - this.ys[i]) * f;
    const nx = this.nx[i] + (this.nx[j] - this.nx[i]) * f, ny = this.ny[i] + (this.ny[j] - this.ny[i]) * f;
    return { x: x + nx * lat, y: y + ny * lat };
  }
  diff(a, b) {
    let d = this.wrap(b) - this.wrap(a);
    const L = this.length;
    if (d > L / 2) d -= L;
    if (d <= -L / 2) d += L;
    return d;
  }
}

if (typeof module !== 'undefined') module.exports = { Track, LINE_NAMES, KERB_IN, KERB_LARGE };
