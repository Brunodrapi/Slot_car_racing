// Scenery around the track: the objects from the isometric sprite sheet, placed once per circuit
// and drawn upright, depth sorted with the cars. Placement is seeded, so a track always gets the
// same scenery from one session to the next.
//
// The sprites come out of `sprites/environnement/image.png` through `tools/env.py`, which cuts the
// sheet into one PNG per object and turns each cast shadow into translucent black, so it darkens
// the grass instead of laying a slab of the sheet's own ground colour on it. See
// `sprites/env/README.md`.
'use strict';

// wm is the width of the whole image on the ground, in metres, shadow included; anchor says where
// the object's foot sits in the image (0,0 = top left, 1,1 = bottom right), which is the point put
// at the object's world position. near/far is the band it likes, measured from the edge of the
// road: the camera only shows about twenty-five metres either side of the car, so anything beyond
// that exists but is never seen.
const PROP_KINDS = [
  { id: 'oak', src: 'sprites/env/p01.png', wm: 12.5, anchor: [0.47, 0.93], weight: 3, near: 10, far: 28 },
  { id: 'oak2', src: 'sprites/env/p02.png', wm: 12.5, anchor: [0.5, 0.93], weight: 2, near: 10, far: 28 },
  { id: 'tree', src: 'sprites/env/p05.png', wm: 9.2, anchor: [0.58, 0.956], weight: 4, near: 9, far: 26 },
  { id: 'tree2', src: 'sprites/env/p20.png', wm: 6.2, anchor: [0.62, 0.94], weight: 6, near: 9, far: 26 },
  { id: 'tree3', src: 'sprites/env/p22.png', wm: 5.8, anchor: [0.537, 0.949], weight: 5, near: 9, far: 26 },
  { id: 'tree4', src: 'sprites/env/p24.png', wm: 8.1, anchor: [0.6, 0.95], weight: 4, near: 9, far: 26 },
  { id: 'tree5', src: 'sprites/env/p27.png', wm: 9.5, anchor: [0.624, 0.94], weight: 4, near: 9, far: 26 },
  { id: 'bush', src: 'sprites/env/p15.png', wm: 5.1, anchor: [0.66, 0.887], weight: 3, near: 9, far: 20 },
  { id: 'bush2', src: 'sprites/env/p16.png', wm: 4.3, anchor: [0.74, 0.95], weight: 3, near: 9, far: 20 },
  { id: 'house', src: 'sprites/env/p03.png', wm: 11.8, anchor: [0.535, 0.994], weight: 1, near: 14, far: 26 },
  { id: 'house2', src: 'sprites/env/p04.png', wm: 11.9, anchor: [0.62, 0.946], weight: 1, near: 14, far: 26 },
  { id: 'house3', src: 'sprites/env/p10.png', wm: 9.9, anchor: [0.526, 0.905], weight: 1, near: 14, far: 26 },
  { id: 'house4', src: 'sprites/env/p12.png', wm: 14.1, anchor: [0.468, 0.978], weight: 1, near: 15, far: 26 },
  { id: 'house5', src: 'sprites/env/p25.png', wm: 12.5, anchor: [0.62, 0.96], weight: 1, near: 15, far: 26 },
  { id: 'house6', src: 'sprites/env/p37.png', wm: 10.9, anchor: [0.557, 0.898], weight: 1, near: 14, far: 26 },
  { id: 'barn', src: 'sprites/env/p08.png', wm: 14.6, anchor: [0.44, 0.929], weight: 1, near: 16, far: 27 },
  { id: 'ruin', src: 'sprites/env/p14.png', wm: 8.7, anchor: [0.564, 0.965], weight: 1, near: 12, far: 24 },
  { id: 'fence', src: 'sprites/env/p30.png', wm: 10.9, anchor: [0.72, 0.947], weight: 3, near: 9, far: 13 },
  { id: 'fence2', src: 'sprites/env/p40.png', wm: 9.9, anchor: [0.78, 0.939], weight: 3, near: 9, far: 13 },
  { id: 'well', src: 'sprites/env/p33.png', wm: 8.2, anchor: [0.598, 0.947], weight: 1, near: 11, far: 20 },
  { id: 'planter', src: 'sprites/env/p35.png', wm: 8.3, anchor: [0.683, 0.892], weight: 2, near: 9, far: 16 },
  { id: 'barrel', src: 'sprites/env/p36.png', wm: 6.9, anchor: [0.7, 0.923], weight: 2, near: 9, far: 16 },
  { id: 'crate', src: 'sprites/env/p29.png', wm: 5.6, anchor: [0.664, 0.875], weight: 2, near: 9, far: 16 },
  { id: 'pillar', src: 'sprites/env/p38.png', wm: 4.5, anchor: [0.5, 0.97], weight: 1, near: 10, far: 20 },
  { id: 'rock', src: 'sprites/env/p31.png', wm: 5.0, anchor: [0.696, 0.889], weight: 2, near: 9, far: 20 },
];


// Load every sprite once. An image that has not arrived yet simply draws nothing.
function buildPropArt() {
  const art = {};
  for (const k of PROP_KINDS) {
    const im = new Image();
    im.src = k.src;
    art[k.id] = { img: im, wm: k.wm, anchor: k.anchor || [0.5, 0.95] };
  }
  return art;
}

// a small deterministic generator, so a circuit always gets the same scenery
function propRng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function seedFromId(id) {
  let h = 2166136261;
  for (let i = 0; i < String(id).length; i++) { h ^= String(id).charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Walk the track and drop objects on either side, beyond the gravel trap, never on the tarmac.
// A candidate is rejected if it lands too near any part of the circuit, which matters where the
// track folds back on itself, or too near an object already placed. Both sets of scenery — the
// billboards and the bird's-eye objects — are sown by this one routine.
function placeFrom(kinds, track, seed, density, clear) {
  const rnd = propRng(seed);
  const total = kinds.reduce((a, k) => a + k.weight, 0);
  const pick = () => {
    let r = rnd() * total;
    for (const k of kinds) { r -= k.weight; if (r <= 0) return k; }
    return kinds[0];
  };
  const N = track.n, step = 9, out = [];
  const clearOfTrack = (x, y, need) => {
    for (let i = 0; i < N; i += 4) {
      const dx = x - track.xs[i], dy = y - track.ys[i];
      if (dx * dx + dy * dy < need * need) return false;
    }
    return true;
  };
  const clearOfProps = (x, y, need) => {
    for (let j = out.length - 1; j >= 0 && j > out.length - 40; j--) {
      const dx = x - out[j].x, dy = y - out[j].y;
      if (dx * dx + dy * dy < need * need) return false;
    }
    return true;
  };
  for (let s = 0; s < track.length; s += step) {
    for (const side of [1, -1]) {
      if (rnd() > density) continue;
      const k = pick();
      const i = track.idx(s + (rnd() - 0.5) * step);
      const hw = side > 0 ? track.hwL[i] : track.hwR[i];
      const off = hw + k.near + rnd() * (k.far - k.near) + k.wm * 0.3;
      const x = track.xs[i] + track.nx[i] * off * side;
      const y = track.ys[i] + track.ny[i] * off * side;
      // keep clear of the road itself wherever it runs, gravel trap included
      if (!clearOfTrack(x, y, track.halfWidth + (clear == null ? 8.5 : clear) + k.wm * 0.3)) continue;
      if (!clearOfProps(x, y, (k.wm + 2) * 0.6)) continue;
      out.push({ x, y, id: k.id });
    }
  }
  return out;
}

function placeProps(track, id, density) {
  return placeFrom(PROP_KINDS, track, seedFromId(id || 'track'), density == null ? 0.75 : density);
}

if (typeof module !== 'undefined') module.exports = { PROP_KINDS, buildPropArt, placeProps, placeFrom };

/* ----------------------------------------------------------------- seen from straight above

The billboards above are three-quarter views: they only make sense under a tilted camera. The flat
view needs objects drawn as a bird sees them — a tree is a canopy and a shadow, not a trunk — so it
has its own set, drawn in the circuit's own palette rather than from a sprite sheet.
*/

const TOP_PPM = 24;              // pixels per metre when baking a top-down object

// `draw` works in a square of side `w` pixels, centred, with the palette of the circuit.
const TOP_KINDS = [
  {
    id: 'tree', wm: 9.0, weight: 7, near: 7, far: 26,
    draw(g, w, pal) {
      const r = w * 0.44, c = w / 2;
      blob(g, c, c, r, 11, pal.canopy[0], 0.12, 0);
      blob(g, c - r * 0.17, c - r * 0.17, r * 0.62, 9, pal.canopy[1], 0.13, 1.1);
      blob(g, c + r * 0.3, c + r * 0.32, r * 0.3, 7, pal.canopy[2], 0.14, 2.3);
    },
  },
  {
    id: 'tree2', wm: 6.8, weight: 6, near: 7, far: 26,
    draw(g, w, pal) {
      const r = w * 0.44, c = w / 2;
      blob(g, c, c, r, 10, pal.canopy[2], 0.13, 0.6);
      blob(g, c - r * 0.15, c - r * 0.15, r * 0.6, 8, pal.canopy[0], 0.15, 1.9);
    },
  },
  {
    // A conifer from above is a rosette: dark fronds radiating from a small pale centre.
    id: 'pine', wm: 6.0, weight: 6, near: 7, far: 26,
    draw(g, w, pal) {
      const c = w / 2, r = w * 0.46;
      for (const [k, col, rr] of [[9, pal.pine[0], r], [7, pal.pine[1], r * 0.6]]) {
        g.fillStyle = col;
        g.beginPath();
        for (let i = 0; i < k; i++) {
          const a = i / k * Math.PI * 2, a2 = (i + 0.5) / k * Math.PI * 2;
          g.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr);
          g.lineTo(c + Math.cos(a2) * rr * 0.52, c + Math.sin(a2) * rr * 0.52);
        }
        g.closePath(); g.fill();
      }
      g.fillStyle = pal.trunk;
      g.beginPath(); g.arc(c, c, r * 0.12, 0, Math.PI * 2); g.fill();
    },
  },
  {
    id: 'bush', wm: 3.4, weight: 5, near: 6, far: 22,
    draw(g, w, pal) {
      const c = w / 2;
      blob(g, c, c, w * 0.42, 9, pal.canopy[1], 0.16, 0.3);
      blob(g, c - w * 0.06, c - w * 0.06, w * 0.24, 7, pal.canopy[0], 0.18, 1.4);
    },
  },
  {
    id: 'rock', wm: 3.0, weight: 3, near: 6, far: 20,
    draw(g, w, pal) {
      const c = w / 2;
      blob(g, c, c, w * 0.4, 7, pal.rock, 0.16, 0.9);
      blob(g, c - w * 0.07, c - w * 0.07, w * 0.22, 6, '#d8d2c4', 0.18, 2.1);
    },
  },
  {
    // The stack of felled trunks that lies at the edge of a forest road.
    id: 'logs', wm: 6.0, weight: 2, near: 7, far: 18,
    draw(g, w, pal) {
      const n = 4, lw = w * 0.84, lh = w * 0.15;
      for (let i = 0; i < n; i++) {
        const y = w * 0.24 + i * lh * 1.12;
        g.fillStyle = i % 2 ? pal.log : '#95602f';
        round(g, (w - lw) / 2, y, lw, lh, lh / 2); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.18)';
        round(g, (w - lw) / 2, y + lh * 0.62, lw, lh * 0.38, lh * 0.19); g.fill();
      }
    },
  },
  {
    id: 'bales', wm: 4.4, weight: 2, near: 6, far: 16,
    draw(g, w, pal) {
      for (const [dx, dy] of [[0.3, 0.32], [0.68, 0.4], [0.44, 0.7]]) {
        const r = w * 0.17;
        g.fillStyle = '#d9bd7c';
        g.beginPath(); g.arc(w * dx, w * dy, r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#bd9f5f'; g.lineWidth = Math.max(1, w * 0.02);
        g.beginPath(); g.arc(w * dx, w * dy, r * 0.55, 0, Math.PI * 2); g.stroke();
      }
    },
  },
];

// An irregular round blob — the shape everything organic is made of here. The outline runs as a
// closed spline through the wobbled points rather than between them: joined by straight segments
// the same points read as a hexagon, which is what a canopy from above must not look like.
function blob(g, cx, cy, r, n, colour, wobble, phase) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    const rr = r * (1 + wobble * Math.sin(i * 2.7 + (phase || 0)));
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  g.fillStyle = colour;
  g.beginPath();
  let m = mid(pts[n - 1], pts[0]);
  g.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) {
    const nxt = mid(pts[i], pts[(i + 1) % n]);
    g.quadraticCurveTo(pts[i][0], pts[i][1], nxt[0], nxt[1]);
  }
  g.closePath(); g.fill();
}

function round(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
}

// Bake each object once per palette. The shadow is baked in with it: one offset ellipse under the
// whole thing, as if the sun sat high and behind the camera's right shoulder.
function buildTopArt(pal) {
  const art = {};
  for (const k of TOP_KINDS) {
    const w = Math.max(12, Math.round(k.wm * TOP_PPM));
    const pad = Math.round(w * 0.22);
    const c = document.createElement('canvas');
    c.width = c.height = w + pad * 2;
    const g = c.getContext('2d');
    g.save();
    g.translate(pad - w * 0.1, pad + w * 0.12);
    g.fillStyle = 'rgba(30,26,20,0.17)';
    g.beginPath(); g.ellipse(w / 2, w / 2, w * 0.46, w * 0.42, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    g.save(); g.translate(pad, pad); k.draw(g, w, pal); g.restore();
    art[k.id] = { canvas: c, wm: k.wm * (c.width / w) };
  }
  return art;
}

function placeTopProps(track, id, density) {
  // Closer to the road than the billboards: seen from above there is no horizon to fill, and a
  // tree that stands well back simply never enters the frame.
  return placeFrom(TOP_KINDS, track, seedFromId('top-' + id), density == null ? 0.85 : density, 6);
}

// Ground colour, not objects: the broad patches of bare earth that a circuit wears around its
// corners. Drawn under the road, so the tarmac always covers them.
function placePatches(track, id) {
  const rnd = propRng(seedFromId('patch-' + id));
  const N = track.n, out = [];
  for (let s = 0; s < track.length; s += 26) {
    for (const side of [1, -1]) {
      if (rnd() > 0.5) continue;
      const i = track.idx(s + (rnd() - 0.5) * 20);
      const hw = side > 0 ? track.hwL[i] : track.hwR[i];
      const r = 9 + rnd() * 16;
      const off = hw + 1 + rnd() * 8;
      out.push({
        x: track.xs[i] + track.nx[i] * off * side,
        y: track.ys[i] + track.ny[i] * off * side,
        r, a: rnd() * Math.PI, k: 1 + Math.floor(rnd() * 3), dark: rnd() < 0.3,
      });
    }
  }
  return out;
}

if (typeof module !== 'undefined') module.exports.TOP_KINDS = TOP_KINDS;
if (typeof module !== 'undefined') module.exports.placeTopProps = placeTopProps;
if (typeof module !== 'undefined') module.exports.placePatches = placePatches;
