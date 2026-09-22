// Procedural top-down car drawings, one style per model "shape".
// Local frame: x forward (metres), y to the right; the car is centred at the origin.
'use strict';

const SHAPES = {
  // --- classic F1: cigar bodies, exposed wheels ---
  cigar:     { body: [[0.5, 0.0], [0.46, 0.07], [0.25, 0.12], [-0.05, 0.16], [-0.38, 0.15], [-0.5, 0.09]], wheels: 'out', cockpit: -0.04, wings: [], tail: 'round', wf: 0.62, wr: 0.7 },
  cigarWing: { body: [[0.5, 0.0], [0.46, 0.07], [0.25, 0.12], [-0.05, 0.17], [-0.38, 0.16], [-0.5, 0.1]], wheels: 'out', cockpit: -0.04, wings: [{ x: 0.44, len: 0.05, w: 0.72 }, { x: -0.46, len: 0.07, w: 0.66 }], wf: 0.64, wr: 0.74 },
  wedge72:   { body: [[0.5, 0.02], [0.4, 0.12], [0.1, 0.19], [-0.2, 0.22], [-0.45, 0.2], [-0.5, 0.12]], wheels: 'out', cockpit: -0.06, wings: [{ x: 0.46, len: 0.05, w: 0.78 }, { x: -0.47, len: 0.08, w: 0.74 }], wf: 0.66, wr: 0.78, airbox: true },
  // --- modern F1 ---
  modern:    { body: [[0.5, 0.02], [0.44, 0.05], [0.3, 0.08], [0.12, 0.26], [-0.2, 0.3], [-0.4, 0.22], [-0.5, 0.12]], wheels: 'out', cockpit: 0.0, halo: true, wings: [{ x: 0.47, len: 0.06, w: 0.98 }, { x: -0.47, len: 0.07, w: 0.9 }], wf: 0.8, wr: 0.86, airbox: true },
  // --- GT ---
  gtBoxy:    { body: [[0.5, 0.4], [0.46, 0.48], [-0.44, 0.49], [-0.5, 0.43]], wheels: 'in', cabin: [0.08, -0.34, 0.8], wings: [{ x: -0.46, len: 0.05, w: 0.95 }], lights: true, stripe: 'roof' },
  wedgeGT:   { body: [[0.5, 0.26], [0.4, 0.4], [0.1, 0.48], [-0.32, 0.5], [-0.5, 0.44]], wheels: 'in', cabin: [0.0, -0.3, 0.62], wings: [], lights: true, stripe: 'roof', intakes: true },
  f40:       { body: [[0.5, 0.26], [0.4, 0.42], [0.05, 0.49], [-0.36, 0.5], [-0.5, 0.42]], wheels: 'in', cabin: [0.02, -0.28, 0.64], wings: [{ x: -0.44, len: 0.06, w: 0.98 }], lights: true, stripe: 'roof', intakes: true },
  roundGT:   { body: [[0.5, 0.3], [0.36, 0.44], [-0.1, 0.5], [-0.42, 0.46], [-0.5, 0.34]], wheels: 'in', cabin: [0.06, -0.3, 0.74], wings: [{ x: -0.44, len: 0.05, w: 0.8 }], lights: true, stripe: 'roof' },
  wideGT:    { body: [[0.5, 0.32], [0.38, 0.46], [-0.2, 0.5], [-0.46, 0.48], [-0.5, 0.4]], wheels: 'in', cabin: [0.06, -0.28, 0.72], wings: [], lights: true, stripe: 'side', strakes: true },
  // --- classic prototypes ---
  gt40:      { body: [[0.5, 0.2], [0.42, 0.4], [0.05, 0.49], [-0.4, 0.5], [-0.5, 0.44]], wheels: 'in', cabin: [0.1, -0.22, 0.6], wings: [], lights: true, stripe: 'center', duct: true },
  longTail:  { body: [[0.5, 0.18], [0.38, 0.4], [0.0, 0.48], [-0.42, 0.5], [-0.5, 0.36]], wheels: 'in', cabin: [0.12, -0.18, 0.56], wings: [], lights: true, stripe: 'center', fins: true },
  groupC:    { body: [[0.5, 0.16], [0.4, 0.4], [0.05, 0.5], [-0.4, 0.5], [-0.5, 0.44]], wheels: 'in', cabin: [0.12, -0.22, 0.5], wings: [{ x: -0.46, len: 0.06, w: 1.0 }], lights: true, stripe: 'center', fin: true },
};

function drawCarBody(g, shape, L, W, livery, opts) {
  const sh = SHAPES[shape] || SHAPES.gtBoxy;
  const body = livery.body, acc = livery.accent;
  const X = (x) => x * L, Y = (y) => y * W;
  const poly = (pts, mirror) => {
    g.beginPath();
    pts.forEach((p, i) => { const x = X(p[0]), y = Y(p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    if (mirror) for (let i = pts.length - 1; i >= 0; i--) g.lineTo(X(pts[i][0]), -Y(pts[i][1]));
    g.closePath();
  };
  const steer = opts && opts.steer ? opts.steer : 0;
  const wheel = (x, y, w, l, turn) => {
    g.fillStyle = '#141414';
    if (turn && steer) { g.save(); g.translate(X(x), Y(y)); g.rotate(steer); g.fillRect(-l / 2, -w / 2, l, w); g.restore(); }
    else g.fillRect(X(x) - l / 2, Y(y) - w / 2, l, w);
  };

  if (sh.wheels === 'out') {
    const tw = Math.max(0.36, W * 0.2), tl = Math.max(0.55, L * 0.13);
    wheel(0.3, sh.wf / 2, tw, tl, true); wheel(0.3, -sh.wf / 2, tw, tl, true);
    wheel(-0.32, sh.wr / 2, tw * 1.25, tl * 1.15); wheel(-0.32, -sh.wr / 2, tw * 1.25, tl * 1.15);
    // suspension arms
    g.strokeStyle = '#333'; g.lineWidth = 0.08;
    for (const s of [1, -1]) {
      g.beginPath(); g.moveTo(X(0.3), 0); g.lineTo(X(0.3), Y(s * sh.wf / 2)); g.moveTo(X(-0.32), 0); g.lineTo(X(-0.32), Y(s * sh.wr / 2)); g.stroke();
    }
  } else {
    const tw = Math.max(0.3, W * 0.14), tl = Math.max(0.55, L * 0.15);
    wheel(0.3, 0.5, tw, tl, true); wheel(0.3, -0.5, tw, tl, true); wheel(-0.3, 0.5, tw, tl); wheel(-0.3, -0.5, tw, tl);
  }
  // wings (under the body for the front, over for the rear)
  g.fillStyle = acc;
  for (const wg of sh.wings) g.fillRect(X(wg.x) - wg.len * L / 2, -Y(wg.w) / 2, wg.len * L, Y(wg.w));
  // body
  g.fillStyle = body; poly(sh.body, true); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.06; g.stroke();
  // stripes
  g.fillStyle = acc;
  if (sh.stripe === 'roof') g.fillRect(X(-0.3), -Y(0.11), L * 0.42, Y(0.22));
  if (sh.stripe === 'center') g.fillRect(X(-0.5), -Y(0.06), L, Y(0.12));
  if (sh.stripe === 'side') { g.fillRect(X(-0.45), Y(0.38), L * 0.9, Y(0.06)); g.fillRect(X(-0.45), -Y(0.44), L * 0.9, Y(0.06)); }
  if (sh.intakes) { g.fillStyle = '#1a1a1a'; g.fillRect(X(-0.1), Y(0.36), L * 0.16, Y(0.1)); g.fillRect(X(-0.1), -Y(0.46), L * 0.16, Y(0.1)); }
  if (sh.strakes) { g.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 0; i < 4; i++) { g.fillRect(X(-0.2), Y(0.3) + i * Y(0.05), L * 0.28, Y(0.018)); g.fillRect(X(-0.2), -Y(0.3) - i * Y(0.05), L * 0.28, Y(0.018)); } }
  if (sh.duct) { g.fillStyle = '#1a1a1a'; g.fillRect(X(0.36), -Y(0.14), L * 0.06, Y(0.28)); }
  if (sh.fins) { g.fillStyle = acc; g.fillRect(X(-0.5), Y(0.34), L * 0.22, Y(0.05)); g.fillRect(X(-0.5), -Y(0.39), L * 0.22, Y(0.05)); }
  if (sh.fin) { g.fillStyle = acc; g.fillRect(X(-0.42), -Y(0.03), L * 0.3, Y(0.06)); }
  // cabin / cockpit
  if (sh.cabin) {
    const [x0, x1, w] = sh.cabin;
    g.fillStyle = '#1d2733';
    g.beginPath();
    g.moveTo(X(x0), -Y(w) / 2 * 0.8); g.lineTo(X(x0) - L * 0.06, -Y(w) / 2); g.lineTo(X(x1), -Y(w) / 2);
    g.lineTo(X(x1), Y(w) / 2); g.lineTo(X(x0) - L * 0.06, Y(w) / 2); g.lineTo(X(x0), Y(w) / 2 * 0.8); g.closePath(); g.fill();
    // roof highlight
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(X(x1) + L * 0.05, -Y(w) / 2 + W * 0.06, L * (x0 - x1) * 0.55, Y(w) - W * 0.12);
  }
  if (sh.cockpit != null) {
    const cx = X(sh.cockpit);
    if (sh.airbox) { g.fillStyle = body; g.fillRect(cx - L * 0.32, -Y(0.09), L * 0.28, Y(0.18)); g.fillStyle = '#1a1a1a'; g.fillRect(cx - L * 0.08, -Y(0.05), L * 0.06, Y(0.1)); }
    g.fillStyle = '#1d2733'; g.fillRect(cx - L * 0.02, -Y(0.11), L * 0.16, Y(0.22));
    g.fillStyle = '#f2f2f2'; g.beginPath(); g.arc(cx, 0, Math.max(0.28, W * 0.14), 0, Math.PI * 2); g.fill();
    g.fillStyle = acc; g.beginPath(); g.arc(cx, 0, Math.max(0.28, W * 0.14), -0.9, 0.9); g.fill();
    if (sh.halo) { g.strokeStyle = '#222'; g.lineWidth = 0.1; g.beginPath(); g.arc(cx + L * 0.02, 0, Math.max(0.45, W * 0.22), 0, Math.PI * 2); g.stroke(); }
  }
  if (sh.lights) {
    g.fillStyle = '#fff6c0'; g.fillRect(X(0.44), -Y(0.42), L * 0.05, Y(0.14)); g.fillRect(X(0.44), Y(0.28), L * 0.05, Y(0.14));
    g.fillStyle = '#e02020'; g.fillRect(X(-0.5), -Y(0.42), L * 0.04, Y(0.12)); g.fillRect(X(-0.5), Y(0.3), L * 0.04, Y(0.12));
  }
  // number roundel on closed cars
  if (sh.wheels === 'in' && opts && opts.number != null) {
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(X(0.28), 0, W * 0.16, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111'; g.font = `bold ${W * 0.22}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(opts.number), X(0.28), W * 0.01);
  }
}

// Sprite-based custom model: layers { base: Image, color: Image|null, extra: [Image] }
const _tintCache = new Map();
function tintedLayer(img, color, key) {
  const k = key + '|' + color;
  if (_tintCache.has(k)) return _tintCache.get(k);
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'multiply'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in'; g.drawImage(img, 0, 0);
  _tintCache.set(k, c);
  return c;
}
function drawCarSprite(g, model, L, W, livery) {
  const sp = model.sprite;
  if (!sp || !sp.base || !sp.base.complete || !sp.base.naturalWidth) return false;
  const iw = sp.base.naturalWidth, ih = sp.base.naturalHeight;
  const scale = L / iw;
  const w = iw * scale, h = ih * scale;
  g.drawImage(sp.base, -w / 2, -h / 2, w, h);
  if (sp.color && sp.color.complete && sp.color.naturalWidth) g.drawImage(tintedLayer(sp.color, livery.body, model.id), -w / 2, -h / 2, w, h);
  for (const ex of sp.extra || []) if (ex.complete && ex.naturalWidth) g.drawImage(ex, -w / 2, -h / 2, w, h);
  return true;
}

/* A model may ship a drawing of the real car seen from straight above (`top` in js/cars.js). It
   replaces both the vector body and the chosen livery: these are particular cars in their own
   colours, not a shape to be painted. The silhouette is filled black once and kept, so the shadow
   can follow the car's outline instead of being a rectangle under it. */
const _topCache = new Map();
const _topWaiters = [];
/** True once this model's drawing is decoded and can be drawn. */
function topReady(model) { return !model.top || !!topArt(model); }
/** Called once every drawing has landed, so a screen built too early can be built again. */
function onTopReady(cb) { _topWaiters.push(cb); }
function topArt(model) {
  if (!model.top) return null;
  let e = _topCache.get(model.top);
  if (!e) {
    const img = new Image();
    img.onload = () => { for (const cb of _topWaiters.splice(0)) cb(); };
    img.src = model.top;
    e = { img, shadow: null };
    _topCache.set(model.top, e);
  }
  if (!e.img.complete || !e.img.naturalWidth) return null;
  if (!e.shadow) {
    const c = document.createElement('canvas');
    c.width = e.img.naturalWidth; c.height = e.img.naturalHeight;
    const g2 = c.getContext('2d');
    g2.drawImage(e.img, 0, 0);
    g2.globalCompositeOperation = 'source-in';
    g2.fillStyle = '#000';
    g2.fillRect(0, 0, c.width, c.height);
    e.shadow = c;
  }
  return e;
}

// Both are drawn to the car's length, keeping the drawing's own proportions: an illustration
// includes the mirrors and the wing, so it comes out a little wider than the collision box.
function topSize(model, art) {
  const L = model.length;
  return [L, L * art.img.naturalHeight / art.img.naturalWidth];
}

/** The car's own outline, filled dark, for the shadow. Returns false if this model has no drawing. */
function drawCarShadow(g, model) {
  const art = topArt(model);
  if (!art) return false;
  const [w, h] = topSize(model, art);
  g.drawImage(art.shadow, -w / 2, -h / 2, w, h);
  return true;
}

// Draws any model centred at the origin, facing +x.
function drawCarModel(g, model, livery, opts) {
  const L = model.length, W = model.width;
  const art = topArt(model);
  if (art) {
    const [w, h] = topSize(model, art);
    g.drawImage(art.img, -w / 2, -h / 2, w, h);
    return;
  }
  if (model.sprite && drawCarSprite(g, model, L, W, livery)) return;
  drawCarBody(g, model.shape, L, W, livery, opts);
}

if (typeof module !== 'undefined') module.exports = { drawCarShadow, topReady, onTopReady, SHAPES, drawCarModel };
