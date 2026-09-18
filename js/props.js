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
// track folds back on itself, or too near an object already placed.
function placeProps(track, id, density) {
  const rnd = propRng(seedFromId(id || 'track'));
  const total = PROP_KINDS.reduce((a, k) => a + k.weight, 0);
  const pick = () => {
    let r = rnd() * total;
    for (const k of PROP_KINDS) { r -= k.weight; if (r <= 0) return k; }
    return PROP_KINDS[0];
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
      if (rnd() > (density == null ? 0.75 : density)) continue;
      const k = pick();
      const i = track.idx(s + (rnd() - 0.5) * step);
      const hw = side > 0 ? track.hwL[i] : track.hwR[i];
      const off = hw + k.near + rnd() * (k.far - k.near) + k.wm * 0.3;
      const x = track.xs[i] + track.nx[i] * off * side;
      const y = track.ys[i] + track.ny[i] * off * side;
      // keep clear of the road itself wherever it runs, gravel trap included
      if (!clearOfTrack(x, y, track.halfWidth + 8.5 + k.wm * 0.3)) continue;
      if (!clearOfProps(x, y, (k.wm + 2) * 0.6)) continue;
      out.push({ x, y, id: k.id });
    }
  }
  return out;
}

if (typeof module !== 'undefined') module.exports = { PROP_KINDS, buildPropArt, placeProps };
