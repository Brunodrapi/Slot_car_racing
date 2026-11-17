/* LES DÉGÂTS QUI SE VOIENT — essai de la branche claude/degats-visuels.

D'OÙ VIENT L'IDÉE. Destructor2D (Krzysztof Kucza, sur Steam) montre des voitures vues de dessus qui se
froissent. Sa vue de mise au point trace, autour de chaque voiture, un anneau de points — la
carrosserie en « corps mou » — et le dessin de la voiture est tendu sur cet anneau : quand l'anneau
s'enfonce, le dessin suit. Dans le jeu, la voiture blanche qui a tapé montre un nez raccourci, un bord
de tôle froissé et clair, et, à la place du capot, le compartiment moteur, sombre.

GTA 2 faisait autrement : des vignettes de bosses peintes à la main pour chaque coin de chaque voiture
(ses « deltas »). Avec trente-cinq voitures et leurs livrées, peindre des bosses n'est pas une option ;
tendre le dessin existant sur un anneau, si — c'est le même travail pour toutes.

CE QUI EST GARDÉ, CE QUI NE L'EST PAS. La conduite et les collisions restent celles d'aujourd'hui : un
rectangle rigide. Un vrai corps mou (des masses et des ressorts qui se poussent, à la JellyCar)
changerait la façon dont les voitures se touchent et se conduisent ; ici l'anneau n'est qu'une peau.
Chaque choc (`car.chocs`, posé par js/car.js) l'enfonce autour du point touché :

  - une BOSSE QUI RESTE : chaque point proche du choc recule, d'autant plus qu'il est près et que le
    choc est fort, avec un peu de hasard pour que le bord se froisse au lieu de rentrer d'un bloc ;
  - une VIBRATION : chaque point rejoint sa bosse par un ressort peu amorti — la tôle tremble une
    demi-seconde avant de se figer, c'est ce qui donne l'air « mou » ;
  - la TÔLE FROISSÉE, peinte sur une copie du dessin propre à la voiture : un creux sombre (le
    compartiment qu'on devine), des plis en travers de la poussée — une tôle comprimée se plie en
    travers — et le bord éraflé, plus clair ;
  - des ÉTINCELLES contre un rail, un mur ou une autre voiture (pas contre des pneus) ;
  - des DÉBRIS — couleur de la carrosserie, carbone, verre — qui restent sur la piste ;
  - de la FUMÉE quand la voiture est très abîmée (en course, là où les dégâts coûtent).

LE MAILLAGE. Trois rectangles emboîtés de `points` sommets chacun : le bord du dessin, puis deux
anneaux à l'intérieur. Le dernier ne bouge jamais, et ce qu'il entoure — l'habitacle, le numéro — reste
net. Entre deux anneaux, des quadrilatères coupés en deux triangles. Un triangle déformé se dessine en
découpant (`clip`) puis en appliquant la transformation affine qui envoie le triangle du dessin sur le
triangle déformé. Tout ce qui n'a pas bougé part en UNE fois, sous une seule découpe : une voiture
touchée à l'avant ne redessine en triangles que son avant, et une voiture intacte n'a pas de maillage
du tout — elle se dessine exactement comme avant. */
'use strict';

const DEGATS_VISU = {
  points: 32,                 // sommets par anneau
  retraits: [0, 0.42, 0.9],   // m : chaque anneau, mesuré depuis le bord du dessin ; le dernier est fixe
  creuxMax: [0.75, 0.42, 0],  // m : ce que chaque anneau peut rentrer au plus
  seuil: 3.5,                 // m/s : en dessous, un contact ne cabosse rien (le seuil de la tôle)
  creux: 0.045,               // m de tôle enfoncée par m/s au-delà du seuil
  rayon: 0.75,                // m : portée d'un petit choc ; jusqu'au double pour un gros
  ressort: 260, amorti: 7,    // la tôle qui tremble, puis se fige
  etincelles: 2,              // m/s : au-dessus, un contact contre du métal crache des étincelles
  frotte: 9,                  // m/s de glisse le long d'un rail : ça crache aussi
  debris: 3,                  // m/s au-delà du seuil : des morceaux tombent
  fumee: 0.3,                 // dommages (0..1) à partir desquels la voiture fume
  debrisVie: 45,              // s sur la piste avant de s'effacer
  debrisMax: 400,
  etincellesMax: 300,
};

class Carrosserie {
  /* w, h : le dessin, en mètres (longueur, largeur), +x vers l'avant, centré. */
  constructor(w, h) {
    const V = DEGATS_VISU, N = V.points, R = V.retraits.length;
    this.w = w; this.h = h; this.N = N; this.R = R;
    const n = N * R;
    this.rx = new Float32Array(n); this.ry = new Float32Array(n);   // au repos
    this.tx = new Float32Array(n); this.ty = new Float32Array(n);   // la bosse qui restera
    this.dx = new Float32Array(n); this.dy = new Float32Array(n);   // la bosse de l'instant
    this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    // Les sommets du bord, répartis côté par côté pour que les quatre coins en soient : l'avant et
    // l'arrière en reçoivent selon leur largeur, les flancs selon leur longueur.
    const hw = w / 2, hh = h / 2;
    const cote = Math.max(2, Math.round(N / 2 * h / (w + h))), flanc = N / 2 - cote;
    const coins = [[hw, -hh], [hw, hh], [-hw, hh], [-hw, -hh]], parts = [cote, flanc, cote, flanc];
    const bord = [];
    for (let c = 0; c < 4; c++) {
      const [x0, y0] = coins[c], [x1, y1] = coins[(c + 1) % 4];
      for (let i = 0; i < parts[c]; i++) bord.push([x0 + (x1 - x0) * i / parts[c], y0 + (y1 - y0) * i / parts[c]]);
    }
    // Les anneaux intérieurs : le même rectangle, rétréci du même nombre de mètres sur chaque bord.
    // Chaque sommet garde la même fraction de chaque axe, si bien que les coins restent des coins.
    for (let r = 0; r < R; r++) {
      const d = V.retraits[r], sx = Math.max(0.1, hw - d) / hw, sy = Math.max(0.12, hh - d) / hh;
      for (let i = 0; i < N; i++) { this.rx[r * N + i] = bord[i][0] * sx; this.ry[r * N + i] = bord[i][1] * sy; }
    }
    this.touche = false;   // une bosse, au moins : la voiture passe au maillage
    this.calme = true;     // plus rien ne tremble
    this.peau = null;      // la copie du dessin, avec ses plis
    this.version = 0;      // change à chaque bosse, chaque pli, chaque image où la tôle tremble
    this.caches = {};      // la caisse et l'ombre déjà tendues sur l'anneau
    this.fx = 0; this.fy = 0; this.fw = 0;   // le foyer des chocs : d'où sort la fumée
  }

  /* Un choc en (px, py), sur le bord ; (nx, ny) : vers où la tôle rentre ; `force` : m/s au-delà du seuil. */
  choc(px, py, nx, ny, force) {
    const V = DEGATS_VISU, N = this.N, r = V.rayon * (1 + Math.min(1, force / 10));
    const prof = V.creux * force;
    for (let k = 0; k < N * this.R; k++) {
      const anneau = (k / N) | 0, lim = V.creuxMax[anneau];
      if (!lim) continue;
      const dist = Math.hypot(this.rx[k] - px, this.ry[k] - py);
      if (dist >= r) continue;
      let f = 1 - (dist * dist) / (r * r); f *= f;
      const p = prof * f * (0.65 + 0.7 * Math.random());     // le hasard qui froisse le bord
      this.tx[k] += nx * p; this.ty[k] += ny * p;
      const m = Math.hypot(this.tx[k], this.ty[k]);
      if (m > lim) { this.tx[k] *= lim / m; this.ty[k] *= lim / m; }
      this.vx[k] += nx * p * 4; this.vy[k] += ny * p * 4;     // le coup qui fait trembler
    }
    this._ordonne(this.tx, this.ty);
    this.touche = true; this.calme = false; this.version++;
    this.fx = (this.fx * this.fw + px * force) / (this.fw + force);
    this.fy = (this.fy * this.fw + py * force) / (this.fw + force);
    this.fw += force;
  }

  /* Un anneau ne passe jamais à travers le suivant : sinon les triangles entre les deux se retournent
  et le dessin se replie sur lui-même. On part de l'anneau fixe et on remonte vers le bord : chaque
  sommet garde au moins le quart de l'écart qui le séparait, au repos, de son voisin du dedans. */
  _ordonne(ox, oy) {
    const N = this.N;
    for (let r = this.R - 2; r >= 0; r--) {
      for (let i = 0; i < N; i++) {
        const a = r * N + i, b = a + N;
        const ex = this.rx[a] - this.rx[b], ey = this.ry[a] - this.ry[b], el = Math.hypot(ex, ey) || 1;
        const ux = ex / el, uy = ey / el;
        const gap = (this.rx[a] + ox[a] - this.rx[b] - ox[b]) * ux + (this.ry[a] + oy[a] - this.ry[b] - oy[b]) * uy;
        const manque = 0.25 * el - gap;
        if (manque > 0) { ox[a] += ux * manque; oy[a] += uy * manque; }
      }
    }
  }

  pas(dt) {
    if (this.calme) return;
    const V = DEGATS_VISU, K = V.ressort, C = V.amorti, n = this.N * this.R;
    dt = Math.min(dt, 0.1);
    const sous = Math.max(1, Math.ceil(dt / 0.01)), h = dt / sous;
    let reste = 0;
    for (let s = 0; s < sous; s++) {
      for (let k = 0; k < n; k++) {
        this.vx[k] += (-K * (this.dx[k] - this.tx[k]) - C * this.vx[k]) * h;
        this.vy[k] += (-K * (this.dy[k] - this.ty[k]) - C * this.vy[k]) * h;
        this.dx[k] += this.vx[k] * h; this.dy[k] += this.vy[k] * h;
      }
    }
    this._ordonne(this.dx, this.dy);
    this.version++;
    for (let k = 0; k < n; k++) reste = Math.max(reste, Math.abs(this.dx[k] - this.tx[k]) + Math.abs(this.dy[k] - this.ty[k]) + 0.05 * (Math.abs(this.vx[k]) + Math.abs(this.vy[k])));
    if (reste < 0.002) {
      this.dx.set(this.tx); this.dy.set(this.ty); this.vx.fill(0); this.vy.fill(0);
      this.calme = true;
    }
  }

  /* Le déplacement d'un point quelconque du dessin (les roues) : la moyenne des sommets voisins,
  pesée par la distance, et retenue par un poids nul au centre pour qu'une roue loin du choc ne
  bouge pas. */
  decale(x, y, part = 0.7) {
    let sx = 0, sy = 0, sw = 0.15;
    for (let k = 0; k < this.N * this.R; k++) {
      const d2 = (this.rx[k] - x) ** 2 + (this.ry[k] - y) ** 2;
      if (d2 > 1.2) continue;
      const wk = Math.exp(-d2 / 0.18);
      sx += this.dx[k] * wk; sy += this.dy[k] * wk; sw += wk;
    }
    return [part * sx / sw, part * sy / sw];
  }

  /* La couleur de la carrosserie, juste à l'intérieur du point touché : celle des débris. */
  teinte(img, px, py, nx, ny) {
    try {
      const c = this._peau(img), k = c.width / this.w;
      const u = Math.round((px + nx * 0.35 + this.w / 2) * k), v = Math.round((py + ny * 0.35 + this.h / 2) * k);
      const d = c.getContext('2d').getImageData(Math.max(0, Math.min(c.width - 3, u - 1)), Math.max(0, Math.min(c.height - 3, v - 1)), 3, 3).data;
      let r = 0, g = 0, b = 0, a = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { r += d[i]; g += d[i + 1]; b += d[i + 2]; a++; }
      return a ? `rgb(${(r / a) | 0},${(g / a) | 0},${(b / a) | 0})` : null;
    } catch (_) { return null; }
  }

  _peau(img) {
    if (this.peau) return this.peau;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return (this.peau = c);
  }

  /* LA TÔLE FROISSÉE, peinte une fois pour toutes sur la copie du dessin, là où le choc a porté.
  `source-atop` : rien ne déborde du dessin, la peinture ne tombe que sur la voiture. Tailles en
  mètres : une voiture fait cinquante à cent pixels à l'écran, un trait plus fin qu'un décimètre ne
  se verrait pas. */
  marque(img, px, py, nx, ny, force) {
    const c = this._peau(img), g = c.getContext('2d'), k = c.width / this.w;
    const u = (px + this.w / 2) * k, v = (py + this.h / 2) * k;
    const R = Math.min(1.25, 0.32 + force * 0.06) * k;   // la zone touchée, en pixels du dessin
    const tu = -ny, tv = nx;                               // le long du bord
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.lineCap = 'round'; g.lineJoin = 'round';
    // le creux : sombre au bord, comme le compartiment qu'on devine sous le capot enfoncé
    const cu = u + nx * R * 0.25, cv = v + ny * R * 0.25;
    const fond = g.createRadialGradient(cu, cv, 0, cu, cv, R);
    const a = Math.min(0.75, 0.25 + force * 0.035);
    fond.addColorStop(0, `rgba(38,40,38,${a})`);
    fond.addColorStop(0.55, `rgba(38,40,38,${a * 0.55})`);
    fond.addColorStop(1, 'rgba(38,40,38,0)');
    g.fillStyle = fond; g.fillRect(cu - R, cv - R, 2 * R, 2 * R);
    // les plis, en travers de la poussée : un trait sombre et son arête claire
    const plis = 2 + Math.min(4, Math.floor(force / 3));
    for (let i = 0; i < plis; i++) {
      const d = R * (0.08 + 0.7 * Math.random()), o = (Math.random() - 0.5) * R * 0.9;
      const L = R * (0.35 + 0.45 * Math.random());
      const pts = [];
      for (let s = 0; s <= 4; s++) {
        const j = (Math.random() - 0.5) * R * 0.18, t = o - L / 2 + L * s / 4;
        pts.push([u + nx * (d + j) + tu * t, v + ny * (d + j) + tv * t]);
      }
      const trace = (ex, ey) => { g.beginPath(); pts.forEach(([x, y], s) => (s ? g.lineTo(x + ex, y + ey) : g.moveTo(x + ex, y + ey))); g.stroke(); };
      g.strokeStyle = 'rgba(22,22,26,0.6)'; g.lineWidth = 0.1 * k; trace(0, 0);
      g.strokeStyle = 'rgba(240,240,244,0.45)'; g.lineWidth = 0.06 * k; trace(nx * 0.08 * k, ny * 0.08 * k);
    }
    // le bord éraflé : la peinture partie, le métal nu
    g.strokeStyle = 'rgba(214,218,222,0.7)'; g.lineWidth = 0.09 * k;
    g.beginPath();
    g.moveTo(u + nx * 0.12 * k - tu * R * 0.55, v + ny * 0.12 * k - tv * R * 0.55);
    g.lineTo(u + nx * 0.16 * k + tu * R * 0.55, v + ny * 0.16 * k + tv * R * 0.55);
    g.stroke();
    g.restore();
    this.version++;
  }

  /* LE DESSIN TENDU SUR L'ANNEAU, GARDÉ EN CACHE.

  Une bosse ne bouge plus une fois figée. On tend donc le dessin sur l'anneau une fois, dans une
  image à la résolution du dessin (avec une marge pour la tôle qui tremble), et chaque image du jeu
  n'en fait qu'un `drawImage`, comme pour une voiture intacte. On ne retend que pendant la seconde
  où la tôle tremble, ou quand un pli vient d'être peint. Mesuré sans cache : dix voitures cabossées
  de partout faisaient passer une image de 2 à 34 ms. `img` : la peau (la caisse) ou l'ombre. */
  dessine(g, img, w, h) {
    const cle = img === this.peau ? 'caisse' : 'ombre';
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const ku = iw / w, kv = ih / h, mx = Math.ceil(iw * 0.04), my = Math.ceil(ih * 0.06);
    let c = this.caches[cle];
    if (!c || c.img !== img) {
      const cv = document.createElement('canvas');
      cv.width = iw + 2 * mx; cv.height = ih + 2 * my;
      c = this.caches[cle] = { cv, img, version: -1 };
    }
    if (c.version !== this.version) {
      const gc = c.cv.getContext('2d');
      gc.setTransform(1, 0, 0, 1, 0, 0);
      gc.clearRect(0, 0, c.cv.width, c.cv.height);
      gc.imageSmoothingEnabled = true;
      gc.setTransform(ku, 0, 0, kv, mx + iw / 2, my + ih / 2);   // des mètres de la voiture aux pixels du dessin
      this._tend(gc, img, w, h);
      c.version = this.version;
    }
    g.drawImage(c.cv, -w / 2 - mx / ku, -h / 2 - my / kv, w + 2 * mx / ku, h + 2 * my / kv);
  }

  /* Tend `img` sur l'anneau, dans `g` (en mètres de la voiture). */
  _tend(g, img, w, h) {
    const N = this.N, R = this.R, rx = this.rx, ry = this.ry, dx = this.dx, dy = this.dy;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const m = g.getTransform(), echelle = Math.hypot(m.a, m.b) || 1;
    const eps = 1.2 / echelle;   // un pixel de recouvrement : pas de couture entre triangles
    const X = (k) => rx[k] + dx[k], Y = (k) => ry[k] + dy[k];
    const bouge = (k) => Math.abs(dx[k]) + Math.abs(dy[k]) > 0.004;
    const repos = new Path2D(), tri = [];
    // le cœur, entouré par l'anneau fixe
    const c0 = (R - 1) * N;
    repos.moveTo(X(c0), Y(c0));
    for (let i = 1; i < N; i++) repos.lineTo(X(c0 + i), Y(c0 + i));
    repos.closePath();
    for (let r = 0; r < R - 1; r++) {
      for (let i = 0; i < N; i++) {
        const a = r * N + i, b = r * N + (i + 1) % N, c = b + N, d = a + N;
        if (bouge(a) || bouge(b) || bouge(c) || bouge(d)) { tri.push(a, b, c, a, c, d); continue; }
        repos.moveTo(X(a), Y(a)); repos.lineTo(X(b), Y(b)); repos.lineTo(X(c), Y(c)); repos.lineTo(X(d), Y(d)); repos.closePath();
      }
    }
    g.save(); g.clip(repos); g.drawImage(img, -w / 2, -h / 2, w, h); g.restore();
    const ku = iw / w, kv = ih / h;
    for (let t = 0; t < tri.length; t += 3) {
      const p = [tri[t], tri[t + 1], tri[t + 2]];
      const x = p.map(X), y = p.map(Y);
      const u = p.map((k) => (rx[k] + w / 2) * ku), v = p.map((k) => (ry[k] + h / 2) * kv);
      // la transformation affine qui envoie le triangle du dessin (u, v) sur le triangle déformé (x, y)
      const du1 = u[1] - u[0], dv1 = v[1] - v[0], du2 = u[2] - u[0], dv2 = v[2] - v[0];
      const det = du1 * dv2 - du2 * dv1;
      if (Math.abs(det) < 1e-6) continue;
      const dx1 = x[1] - x[0], dx2 = x[2] - x[0], dy1 = y[1] - y[0], dy2 = y[2] - y[0];
      const A = (dx1 * dv2 - dx2 * dv1) / det, C = (dx2 * du1 - dx1 * du2) / det;
      const B = (dy1 * dv2 - dy2 * dv1) / det, D = (dy2 * du1 - dy1 * du2) / det;
      const E = x[0] - A * u[0] - C * v[0], F = y[0] - B * u[0] - D * v[0];
      // la découpe, élargie d'un pixel autour de son centre
      const mx = (x[0] + x[1] + x[2]) / 3, my = (y[0] + y[1] + y[2]) / 3;
      g.save();
      g.beginPath();
      for (let j = 0; j < 3; j++) {
        const ex = x[j] - mx, ey = y[j] - my, el = Math.hypot(ex, ey) || 1;
        const px = x[j] + ex / el * eps, py = y[j] + ey / el * eps;
        if (j) g.lineTo(px, py); else g.moveTo(px, py);
      }
      g.closePath(); g.clip();
      g.transform(A, B, C, D, E, F);
      const marge = 3;
      const u0 = Math.max(0, Math.min(...u) - marge), v0 = Math.max(0, Math.min(...v) - marge);
      const u1 = Math.min(iw, Math.max(...u) + marge), v1 = Math.min(ih, Math.max(...v) + marge);
      if (u1 > u0 && v1 > v0) g.drawImage(img, u0, v0, u1 - u0, v1 - v0, u0, v0, u1 - u0, v1 - v0);
      g.restore();
    }
  }
}

/* Les étincelles et les débris, dans le monde. Les débris restent sur la piste : c'est ce qui raconte,
un tour plus tard, qu'il s'est passé quelque chose là. */
class Eclats {
  constructor() { this.etincelles = []; this.debris = []; }
  vide() { this.etincelles.length = 0; this.debris.length = 0; }

  /* (x, y) : le point touché ; (vx, vy) : la vitesse de la voiture ; (ox, oy) : vers l'extérieur. */
  gerbe(x, y, vx, vy, ox, oy, n) {
    const V = DEGATS_VISU, cap = Math.atan2(oy, ox);
    for (let i = 0; i < n; i++) {
      if (this.etincelles.length >= V.etincellesMax) this.etincelles.shift();
      const a = cap + (Math.random() - 0.5) * 2.4, s = 4 + Math.random() * 14, vie = 0.12 + Math.random() * 0.28;
      this.etincelles.push({ x, y, vx: vx * 0.75 + Math.cos(a) * s, vy: vy * 0.75 + Math.sin(a) * s, vie, vie0: vie });
    }
  }

  eclate(x, y, vx, vy, ox, oy, n, couleur) {
    const V = DEGATS_VISU, cap = Math.atan2(oy, ox);
    for (let i = 0; i < n; i++) {
      if (this.debris.length >= V.debrisMax) this.debris.shift();
      const q = Math.random(), a = cap + (Math.random() - 0.5) * 2.8, s = 2 + Math.random() * 8;
      this.debris.push({
        x: x + (Math.random() - 0.5) * 0.4, y: y + (Math.random() - 0.5) * 0.4,
        vx: vx * 0.55 + Math.cos(a) * s, vy: vy * 0.55 + Math.sin(a) * s,
        ang: Math.random() * Math.PI * 2, va: (Math.random() - 0.5) * 24,
        l: 0.1 + Math.random() * 0.3, e: 0.06 + Math.random() * 0.12,
        col: q < 0.55 ? couleur : q < 0.82 ? '#1d1f22' : '#cfdbe2', age: 0,
      });
    }
  }

  pas(dt) {
    const V = DEGATS_VISU;
    const air = Math.exp(-4 * dt), sol = Math.exp(-3.2 * dt);
    for (const e of this.etincelles) { e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= air; e.vy *= air; e.vie -= dt; }
    if (this.etincelles.length) this.etincelles = this.etincelles.filter((e) => e.vie > 0);
    for (const d of this.debris) {
      d.age += dt;
      if (!d.vx && !d.vy) continue;
      d.x += d.vx * dt; d.y += d.vy * dt; d.ang += d.va * dt;
      d.vx *= sol; d.vy *= sol; d.va *= sol;
      if (Math.abs(d.vx) + Math.abs(d.vy) < 0.15) { d.vx = d.vy = d.va = 0; }
    }
    if (this.debris.length && this.debris[0].age > V.debrisVie) this.debris = this.debris.filter((d) => d.age <= V.debrisVie);
  }

  /* Les débris, au sol : sous les voitures. */
  dessineSol(g) {
    const V = DEGATS_VISU, a0 = g.globalAlpha;
    for (const d of this.debris) {
      const fin = V.debrisVie - d.age;
      g.globalAlpha = a0 * Math.min(1, fin / 4);
      const c = Math.cos(d.ang), s = Math.sin(d.ang), l = d.l / 2, e = d.e / 2;
      g.fillStyle = d.col;
      g.beginPath();
      g.moveTo(d.x + c * l - s * e, d.y + s * l + c * e);
      g.lineTo(d.x - c * l - s * e, d.y - s * l + c * e);
      g.lineTo(d.x - c * l + s * e, d.y - s * l - c * e);
      g.lineTo(d.x + c * l + s * e, d.y + s * l - c * e);
      g.closePath(); g.fill();
    }
    g.globalAlpha = a0;
  }

  /* Les étincelles : un trait le long de leur vitesse, en lumière ajoutée. */
  dessineEtincelles(g) {
    if (!this.etincelles.length) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round'; g.lineWidth = 0.14;
    for (const e of this.etincelles) {
      const t = e.vie / e.vie0;
      // jaune vif en sortant, orange en mourant ; en lumière ajoutée, un jaune plus pâle virerait au blanc
      g.strokeStyle = `rgba(255,${(140 + 90 * t) | 0},${(30 + 70 * t) | 0},${Math.min(1, t * 1.6).toFixed(3)})`;
      g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(e.x - e.vx * 0.03, e.y - e.vy * 0.03); g.stroke();
    }
    g.restore();
  }
}

if (typeof module !== 'undefined') module.exports = { DEGATS_VISU, Carrosserie, Eclats };
