/* L'ENREGISTREUR : ce que le jeu web peint, ordre par ordre.

Chargé dans la page AVANT les scripts du jeu (page.addInitScript). Il remplace Path2D par une
version qui garde la trace de ses commandes, et fournit un faux contexte 2D, `EnregistreurCtx`,
qui reçoit les mêmes appels qu'un vrai canevas mais les note au lieu de les peindre : formes
remplies, traits, images. Tout est ramené en mètres du monde, courbes aplaties à 1 cm près.

Ce qui ne se ramène pas à des formes — le texte — est rendu en petite image, et noté comme
une image. Les effets que le décor fixe n'est pas censé employer (ombres floues, modes de
composition) sont comptés dans `inconnus`, pour qu'un changement du jeu ne passe pas inaperçu. */
(() => {
  const VraiPath2D = window.Path2D;
  class PathNote extends VraiPath2D {
    constructor(a) {
      super(a);
      this._ops = a && a._ops ? a._ops.slice() : [];
      if (typeof a === 'string') this._ops.push(['SVG', a]);
    }
    moveTo(x, y) { this._ops.push(['M', x, y]); super.moveTo(x, y); }
    lineTo(x, y) { this._ops.push(['L', x, y]); super.lineTo(x, y); }
    closePath() { this._ops.push(['Z']); super.closePath(); }
    arc(x, y, r, a0, a1, ccw) { this._ops.push(['A', x, y, r, a0, a1, !!ccw]); super.arc(x, y, r, a0, a1, ccw); }
    ellipse(x, y, rx, ry, rot, a0, a1, ccw) { this._ops.push(['E', x, y, rx, ry, rot, a0, a1, !!ccw]); super.ellipse(x, y, rx, ry, rot, a0, a1, ccw); }
    rect(x, y, w, h) { this._ops.push(['R', x, y, w, h]); super.rect(x, y, w, h); }
    roundRect(x, y, w, h, r) { this._ops.push(['RR', x, y, w, h, r]); super.roundRect(x, y, w, h, r); }
    quadraticCurveTo(cx, cy, x, y) { this._ops.push(['Q', cx, cy, x, y]); super.quadraticCurveTo(cx, cy, x, y); }
    bezierCurveTo(a, b, c, d, x, y) { this._ops.push(['C', a, b, c, d, x, y]); super.bezierCurveTo(a, b, c, d, x, y); }
    arcTo(x1, y1, x2, y2, r) { this._ops.push(['AT', x1, y1, x2, y2, r]); super.arcTo(x1, y1, x2, y2, r); }
    addPath(p, m) { this._ops.push(['P', p._ops || [], m ? [m.a, m.b, m.c, m.d, m.e, m.f] : null]); super.addPath(p, m); }
  }
  window.Path2D = PathNote;

  const TOL = 0.01;  // un centimètre : l'écart permis entre une courbe et ses segments
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const echelle = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

  /* Aplatit des commandes de chemin en sous-chemins de points, transformés par `m`. Suit le modèle
  du canevas : un arc se raccorde au point courant, un rectangle est un sous-chemin fermé, et
  closePath laisse le point courant au début du sous-chemin. */
  class Aplatisseur {
    constructor() { this.subs = []; this.cur = null; this.lx = 0; this.ly = 0; this.debut = null; }
    _pt(m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
    moveTo(m, x, y) {
      const p = this._pt(m, x, y);
      this.cur = { pts: [p[0], p[1]], closed: false }; this.subs.push(this.cur);
      this.lx = x; this.ly = y; this.lm = m; this.debut = [x, y, m];
    }
    lineTo(m, x, y) {
      if (!this.cur) return this.moveTo(m, x, y);
      const p = this._pt(m, x, y); this.cur.pts.push(p[0], p[1]); this.lx = x; this.ly = y; this.lm = m;
    }
    closePath() {
      if (!this.cur) return;
      this.cur.closed = true;
      const d = this.debut; this.cur = null;
      if (d) { const p = this._pt(d[2], d[0], d[1]); this.cur = { pts: [p[0], p[1]], closed: false, fantome: true }; this.subs.push(this.cur); this.lx = d[0]; this.ly = d[1]; }
    }
    _n(m, r, sweep) {
      const rw = Math.max(1e-6, r * echelle(m));
      const pas = rw <= TOL ? Math.PI / 2 : 2 * Math.acos(Math.max(-1, 1 - TOL / rw));
      return Math.min(256, Math.max(2, Math.ceil(Math.abs(sweep) / pas)));
    }
    ellipse(m, x, y, rx, ry, rot, a0, a1, ccw) {
      let sweep;
      if (!ccw && a1 - a0 >= 2 * Math.PI) sweep = 2 * Math.PI;
      else if (ccw && a0 - a1 >= 2 * Math.PI) sweep = -2 * Math.PI;
      else {
        const t = 2 * Math.PI;
        sweep = ccw ? -(((a0 - a1) % t) + t) % t : (((a1 - a0) % t) + t) % t;
      }
      const n = this._n(m, Math.max(rx, ry), sweep), cr = Math.cos(rot), sr = Math.sin(rot);
      for (let i = 0; i <= n; i++) {
        const a = a0 + sweep * i / n, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
        const px = x + ex * cr - ey * sr, py = y + ex * sr + ey * cr;
        if (i === 0 && !this.cur) this.moveTo(m, px, py); else this.lineTo(m, px, py);
      }
    }
    arc(m, x, y, r, a0, a1, ccw) { this.ellipse(m, x, y, r, r, 0, a0, a1, ccw); }
    rect(m, x, y, w, h) {
      this.moveTo(m, x, y); this.lineTo(m, x + w, y); this.lineTo(m, x + w, y + h); this.lineTo(m, x, y + h); this.closePath();
      this.moveTo(m, x, y);
    }
    roundRect(m, x, y, w, h, r) {
      let rr = Array.isArray(r) ? r[0] : (r == null ? 0 : (typeof r === 'object' ? r.x : r));
      rr = Math.min(Math.abs(rr || 0), Math.abs(w) / 2, Math.abs(h) / 2);
      if (!rr) return this.rect(m, x, y, w, h);
      const sx = Math.sign(w) || 1, sy = Math.sign(h) || 1, X = x + w, Y = y + h;
      this.moveTo(m, x + rr * sx, y);
      this.lineTo(m, X - rr * sx, y); this._coin(m, X - rr * sx, y + rr * sy, rr, -Math.PI / 2, 0, sx, sy);
      this.lineTo(m, X, Y - rr * sy); this._coin(m, X - rr * sx, Y - rr * sy, rr, 0, Math.PI / 2, sx, sy);
      this.lineTo(m, x + rr * sx, Y); this._coin(m, x + rr * sx, Y - rr * sy, rr, Math.PI / 2, Math.PI, sx, sy);
      this.lineTo(m, x, y + rr * sy); this._coin(m, x + rr * sx, y + rr * sy, rr, Math.PI, 1.5 * Math.PI, sx, sy);
      this.closePath(); this.moveTo(m, x, y);
    }
    _coin(m, cx, cy, r, a0, a1, sx, sy) {
      const n = this._n(m, r, a1 - a0);
      for (let i = 1; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; this.lineTo(m, cx + Math.cos(a) * r * sx, cy + Math.sin(a) * r * sy); }
    }
    quadraticCurveTo(m, cx, cy, x, y) {
      const x0 = this.lx, y0 = this.ly;
      if (!this.cur) this.moveTo(m, cx, cy);
      const L = (Math.hypot(cx - x0, cy - y0) + Math.hypot(x - cx, y - cy)) * echelle(m);
      const n = Math.min(64, Math.max(4, Math.ceil(L / 0.25)));
      for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; this.lineTo(m, u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y); }
    }
    bezierCurveTo(m, ax, ay, bx, by, x, y) {
      const x0 = this.lx, y0 = this.ly;
      if (!this.cur) this.moveTo(m, ax, ay);
      const L = (Math.hypot(ax - x0, ay - y0) + Math.hypot(bx - ax, by - ay) + Math.hypot(x - bx, y - by)) * echelle(m);
      const n = Math.min(96, Math.max(6, Math.ceil(L / 0.25)));
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        this.lineTo(m, u * u * u * x0 + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * x, u * u * u * y0 + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * y);
      }
    }
    arcTo(m, x1, y1, x2, y2, r) {
      const x0 = this.lx, y0 = this.ly;
      if (!this.cur) return this.moveTo(m, x1, y1);
      const v1x = x0 - x1, v1y = y0 - y1, v2x = x2 - x1, v2y = y2 - y1, l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
      const cosA = (v1x * v2x + v1y * v2y) / (l1 * l2 || 1);
      if (!r || l1 < 1e-9 || l2 < 1e-9 || Math.abs(cosA) > 1 - 1e-9) return this.lineTo(m, x1, y1);
      const ang = Math.acos(cosA), d = r / Math.tan(ang / 2);
      const t1x = x1 + v1x / l1 * d, t1y = y1 + v1y / l1 * d, t2x = x1 + v2x / l2 * d, t2y = y1 + v2y / l2 * d;
      const bx = v1x / l1 + v2x / l2, by = v1y / l1 + v2y / l2, bl = Math.hypot(bx, by), h = r / Math.sin(ang / 2);
      const cx = x1 + bx / bl * h, cy = y1 + by / bl * h;
      const a0 = Math.atan2(t1y - cy, t1x - cx), a1 = Math.atan2(t2y - cy, t2x - cx);
      const cross = v1x * v2y - v1y * v2x;
      this.lineTo(m, t1x, t1y); this.arc(m, cx, cy, r, a0, a1, cross > 0);
    }
    joue(ops, m, inconnus) {
      for (const o of ops) {
        switch (o[0]) {
          case 'M': this.moveTo(m, o[1], o[2]); break;
          case 'L': this.lineTo(m, o[1], o[2]); break;
          case 'Z': this.closePath(); break;
          case 'A': this.arc(m, o[1], o[2], o[3], o[4], o[5], o[6]); break;
          case 'E': this.ellipse(m, o[1], o[2], o[3], o[4], o[5], o[6], o[7], o[8]); break;
          case 'R': this.rect(m, o[1], o[2], o[3], o[4]); break;
          case 'RR': this.roundRect(m, o[1], o[2], o[3], o[4], o[5]); break;
          case 'Q': this.quadraticCurveTo(m, o[1], o[2], o[3], o[4]); break;
          case 'C': this.bezierCurveTo(m, o[1], o[2], o[3], o[4], o[5], o[6]); break;
          case 'AT': this.arcTo(m, o[1], o[2], o[3], o[4], o[5]); break;
          case 'P': { const sub = new Aplatisseur(); sub.joue(o[1], o[2] ? mul(m, o[2]) : m, inconnus); this.subs.push(...sub.subs); this.cur = null; break; }
          default: inconnus[o[0]] = (inconnus[o[0]] || 0) + 1;
        }
      }
      return this;
    }
    resultat() { return this.subs.filter((s) => s.pts.length >= 4).map((s) => ({ pts: s.pts, closed: s.closed })); }
  }

  const ETAT0 = () => ({ m: [1, 0, 0, 1, 0, 0], fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, lineCap: 'butt',
    lineJoin: 'miter', miterLimit: 10, globalAlpha: 1, globalCompositeOperation: 'source-over', font: '10px sans-serif',
    textAlign: 'start', textBaseline: 'alphabetic', dash: [], lineDashOffset: 0, shadowBlur: 0, shadowColor: 'rgba(0, 0, 0, 0)',
    shadowOffsetX: 0, shadowOffsetY: 0, clip: null, imageSmoothingEnabled: true, direction: 'ltr', filter: 'none' });
  const brouillon = document.createElement('canvas').getContext('2d');
  const couleur = (v, alpha, inconnus) => {
    if (typeof v !== 'string') { inconnus.motif = (inconnus.motif || 0) + 1; return null; }
    brouillon.fillStyle = '#000'; brouillon.fillStyle = v; const s = brouillon.fillStyle;
    if (s[0] === '#') return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), alpha];
    const n = s.match(/[\d.]+/g).map(Number);
    return [n[0], n[1], n[2], (n.length > 3 ? n[3] : 1) * alpha];
  };

  /* `Z` est l'échelle de l'écran : le jeu peint en mètres sous une transformation de caméra, mais
  certaines passes reviennent aux pixels de l'écran (setTransform(1, 0, 0, 1, 0, 0)) pour poser
  une image nette. Le contexte part donc de la même échelle qu'un vrai écran, et tout ce qui est
  noté est ramené en mètres par l'inverse de cette échelle. */
  class EnregistreurCtx {
    constructor(w, h, Z = 1) {
      this.canvas = { width: w, height: h };
      this.prims = []; this.clips = []; this.images = new Map(); this.inconnus = {};
      this.etat = ETAT0(); this.pile = []; this.chemin = new Aplatisseur();
      this.inv = [1 / Z, 0, 0, 1 / Z, 0, 0];
      this.etat.m = [Z, 0, 0, Z, 0, 0];
      for (const k of Object.keys(this.etat)) if (!['m', 'dash', 'clip'].includes(k))
        Object.defineProperty(this, k, { get: () => this.etat[k], set: (v) => { this.etat[k] = v; }, enumerable: true });
    }
    save() { this.pile.push({ ...this.etat, m: this.etat.m.slice(), dash: this.etat.dash.slice() }); }
    restore() { if (this.pile.length) this.etat = this.pile.pop(); }
    translate(x, y) { this.etat.m = mul(this.etat.m, [1, 0, 0, 1, x, y]); }
    scale(x, y) { this.etat.m = mul(this.etat.m, [x, 0, 0, y, 0, 0]); }
    rotate(a) { const c = Math.cos(a), s = Math.sin(a); this.etat.m = mul(this.etat.m, [c, s, -s, c, 0, 0]); }
    transform(a, b, c, d, e, f) { this.etat.m = mul(this.etat.m, [a, b, c, d, e, f]); }
    setTransform(a, b, c, d, e, f) {
      if (typeof a === 'object' && a) this.etat.m = [a.a, a.b, a.c, a.d, a.e, a.f];
      else if (a === undefined) this.etat.m = [1, 0, 0, 1, 0, 0];
      else this.etat.m = [a, b, c, d, e, f];
    }
    resetTransform() { this.etat.m = [1, 0, 0, 1, 0, 0]; }
    getTransform() { const m = this.etat.m; return new DOMMatrix([m[0], m[1], m[2], m[3], m[4], m[5]]); }
    setLineDash(d) { this.etat.dash = (d || []).slice(); }
    getLineDash() { return this.etat.dash.slice(); }
    beginPath() { this.chemin = new Aplatisseur(); }
    get _mw() { return mul(this.inv, this.etat.m); }   // la transformation, en mètres du monde
    moveTo(x, y) { this.chemin.moveTo(this._mw, x, y); }
    lineTo(x, y) { this.chemin.lineTo(this._mw, x, y); }
    closePath() { this.chemin.closePath(); }
    arc(...a) { this.chemin.arc(this._mw, ...a); }
    ellipse(...a) { this.chemin.ellipse(this._mw, ...a); }
    rect(...a) { this.chemin.rect(this._mw, ...a); }
    roundRect(...a) { this.chemin.roundRect(this._mw, ...a); }
    quadraticCurveTo(...a) { this.chemin.quadraticCurveTo(this._mw, ...a); }
    bezierCurveTo(...a) { this.chemin.bezierCurveTo(this._mw, ...a); }
    arcTo(...a) { this.chemin.arcTo(this._mw, ...a); }
    _sous(p) { return p && p._ops ? new Aplatisseur().joue(p._ops, this._mw, this.inconnus).resultat() : this.chemin.resultat(); }
    _effets() {
      const e = this.etat;
      if (e.globalCompositeOperation !== 'source-over') this.inconnus['composition ' + e.globalCompositeOperation] = (this.inconnus['composition ' + e.globalCompositeOperation] || 0) + 1;
      if (e.shadowBlur > 0 && !/,\s*0\)$/.test(e.shadowColor)) this.inconnus.ombre = (this.inconnus.ombre || 0) + 1;
      if (e.filter && e.filter !== 'none') this.inconnus.filtre = (this.inconnus.filtre || 0) + 1;
    }
    fill(a, b) {
      const p = typeof a === 'object' ? a : null, regle = (typeof a === 'string' ? a : b) || 'nonzero';
      if (p && !p._ops) { this.inconnus.cheminEtranger = (this.inconnus.cheminEtranger || 0) + 1; return; }
      const c = couleur(this.etat.fillStyle, this.etat.globalAlpha, this.inconnus); if (!c || c[3] <= 0) return;
      this._effets();
      const subs = this._sous(p); if (!subs.length) return;
      this.prims.push({ t: 'f', c, regle, subs: subs.map((s) => s.pts), clip: this.etat.clip });
    }
    stroke(p) {
      if (p && !p._ops) { this.inconnus.cheminEtranger = (this.inconnus.cheminEtranger || 0) + 1; return; }
      const e = this.etat, c = couleur(e.strokeStyle, e.globalAlpha, this.inconnus); if (!c || c[3] <= 0 || !(e.lineWidth > 0)) return;
      this._effets();
      const k = echelle(this._mw), subs = this._sous(p); if (!subs.length) return;
      this.prims.push({ t: 's', c, w: e.lineWidth * k, cap: e.lineCap, join: e.lineJoin, miter: e.miterLimit,
        dash: e.dash.map((d) => d * k), dashOff: e.lineDashOffset * k, subs, clip: e.clip });
    }
    fillRect(x, y, w, h) { const a = new Aplatisseur(); a.rect(this._mw, x, y, w, h); const sv = this.chemin; this.chemin = a; this.fill(); this.chemin = sv; }
    strokeRect(x, y, w, h) { const a = new Aplatisseur(); a.rect(this._mw, x, y, w, h); const sv = this.chemin; this.chemin = a; this.stroke(); this.chemin = sv; }
    clearRect() { this.inconnus.clearRect = (this.inconnus.clearRect || 0) + 1; }
    clip(a, b) {
      const p = typeof a === 'object' ? a : null, regle = (typeof a === 'string' ? a : b) || 'nonzero';
      const subs = this._sous(p).map((s) => s.pts);
      this.clips.push({ subs, regle, parent: this.etat.clip });
      this.etat.clip = this.clips.length - 1;
    }
    _image(img) {
      if (!this.images.has(img)) this.images.set(img, this.images.size);
      return this.images.get(img);
    }
    drawImage(img, ...a) {
      const iw = img.naturalWidth || img.videoWidth || img.width, ih = img.naturalHeight || img.videoHeight || img.height;
      if (!iw || !ih) return;
      let sx = 0, sy = 0, sw = iw, sh = ih, dx, dy, dw, dh;
      if (a.length === 2) { [dx, dy] = a; dw = iw; dh = ih; }
      else if (a.length === 4) { [dx, dy, dw, dh] = a; }
      else { [sx, sy, sw, sh, dx, dy, dw, dh] = a; }
      this._effets();
      const m = this._mw, P = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
      this.prims.push({ t: 'i', img: this._image(img), src: [sx, sy, sw, sh], q: [...P(dx, dy), ...P(dx + dw, dy), ...P(dx + dw, dy + dh), ...P(dx, dy + dh)],
        a: this.etat.globalAlpha, clip: this.etat.clip });
    }
    // Le texte devient une image : on le rend à 32 points par unité, là où il est.
    // Un même texte dans un même style ne fait qu'une image : les panneaux répètent leurs chiffres.
    _texte(txt, x, y, plein) {
      const e = this.etat, R = 32;
      brouillon.font = e.font; brouillon.textAlign = e.textAlign; brouillon.textBaseline = e.textBaseline;
      const mt = brouillon.measureText(txt), marge = 0.2;
      const L = mt.actualBoundingBoxLeft + marge, D = mt.actualBoundingBoxRight + marge;
      const A = mt.actualBoundingBoxAscent + marge, B = mt.actualBoundingBoxDescent + marge;
      const cle = [txt, plein, e.font, e.textAlign, e.textBaseline, e.fillStyle, e.strokeStyle, e.lineWidth, e.lineJoin].join('|');
      this.textes = this.textes || new Map();
      let cv = this.textes.get(cle);
      if (!cv) {
        cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.ceil((L + D) * R)); cv.height = Math.max(1, Math.ceil((A + B) * R));
        const g = cv.getContext('2d');
        g.scale(R, R);
        g.font = e.font; g.textAlign = e.textAlign; g.textBaseline = e.textBaseline;
        g.fillStyle = e.fillStyle; g.strokeStyle = e.strokeStyle; g.lineWidth = e.lineWidth; g.lineJoin = e.lineJoin;
        if (plein) g.fillText(txt, L, A); else g.strokeText(txt, L, A);
        this.textes.set(cle, cv);
      }
      this.drawImage(cv, x - L, y - A, cv.width / R, cv.height / R);
    }
    fillText(t, x, y) { this._texte(String(t), x, y, true); }
    strokeText(t, x, y) { this._texte(String(t), x, y, false); }
    measureText(t) { brouillon.font = this.etat.font; return brouillon.measureText(t); }
    createPattern() { this.inconnus.motif = (this.inconnus.motif || 0) + 1; return {}; }
    createLinearGradient() { this.inconnus.degrade = (this.inconnus.degrade || 0) + 1; return { addColorStop() {} }; }
    createRadialGradient() { return this.createLinearGradient(); }
    isPointInPath() { return false; }
  }
  window.EnregistreurCtx = EnregistreurCtx;
})();
