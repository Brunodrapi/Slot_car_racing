// Track geometry: closed Catmull-Rom spline through the control points,
// rescaled to the target length and resampled every metre.
'use strict';

class Track {
  constructor(def, widthScale) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.width = def.width * (widthScale || 1);
    this.halfWidth = def.width / 2;
    this.laps = def.laps;
    this.ds = 1; // metres between samples
    this._build(def.pts, def.length);
  }

  _build(pts, targetLength) {
    // 1) dense spline
    const n = pts.length;
    const raw = [];
    const STEPS = 24;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      for (let j = 0; j < STEPS; j++) {
        const t = j / STEPS, t2 = t * t, t3 = t2 * t;
        const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        raw.push([x, y]);
      }
    }
    // 2) raw length and scale
    let rawLen = 0;
    for (let i = 0; i < raw.length; i++) {
      const a = raw[i], b = raw[(i + 1) % raw.length];
      rawLen += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    const scale = targetLength / rawLen;
    for (const p of raw) { p[0] *= scale; p[1] *= scale; }

    // 3) resample uniformly
    const N = Math.round(targetLength / this.ds);
    this.length = N * this.ds;
    this.n = N;
    const xs = new Float32Array(N), ys = new Float32Array(N);
    let seg = 0, segPos = 0;
    let a = raw[0], b = raw[1];
    let segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const step = rawLen * scale / N;
    for (let i = 0; i < N; i++) {
      while (segPos > segLen) {
        segPos -= segLen;
        seg++;
        a = raw[seg % raw.length]; b = raw[(seg + 1) % raw.length];
        segLen = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6;
      }
      const t = segPos / segLen;
      xs[i] = a[0] + (b[0] - a[0]) * t;
      ys[i] = a[1] + (b[1] - a[1]) * t;
      segPos += step;
    }
    this.xs = xs; this.ys = ys;

    // 4) heading + curvature
    const th = new Float32Array(N), nx = new Float32Array(N), ny = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const dx = xs[(i + 1) % N] - xs[(i - 1 + N) % N];
      const dy = ys[(i + 1) % N] - ys[(i - 1 + N) % N];
      th[i] = Math.atan2(dy, dx);
      const l = Math.hypot(dx, dy) || 1;
      nx[i] = dy / l; ny[i] = -dx / l; // left normal (y-down coords)
    }
    this.th = th; this.nx = nx; this.ny = ny;
    const kraw = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let d = th[(i + 1) % N] - th[(i - 1 + N) % N];
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      kraw[i] = d / (2 * this.ds);
    }
    // smooth curvature (moving average over ~9 m)
    const k = new Float32Array(N);
    const W = 4;
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let j = -W; j <= W; j++) s += kraw[(i + j + N) % N];
      k[i] = s / (2 * W + 1);
    }
    this.k = k;

    // 5) bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < N; i++) {
      if (xs[i] < minX) minX = xs[i]; if (xs[i] > maxX) maxX = xs[i];
      if (ys[i] < minY) minY = ys[i]; if (ys[i] > maxY) maxY = ys[i];
    }
    this.bounds = { minX, minY, maxX, maxY };

    this.crossings = this._findCrossings();

    // 6) corner segments (for kerbs / gravel): index ranges where |k| is high
    this.corners = [];
    const thr = 1 / 90;
    let inCorner = false, start = 0;
    for (let i = 0; i <= N; i++) {
      const hi = Math.abs(k[i % N]) > thr;
      if (hi && !inCorner) { inCorner = true; start = i; }
      if (!hi && inCorner) {
        inCorner = false;
        if (i - start > 6) this.corners.push({ from: start, to: i, sign: Math.sign(k[Math.floor((start + i) / 2) % N]) });
      }
    }
  }

  // self-intersections (e.g. Suzuka): each entry = { under: sampleIndex, over: sampleIndex }
  _findCrossings() {
    const N = this.n, xs = this.xs, ys = this.ys, step = 4;
    const res = [];
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

  wrap(s) {
    const L = this.length;
    s = s % L;
    return s < 0 ? s + L : s;
  }
  idx(s) { return Math.floor(this.wrap(s) / this.ds) % this.n; }
  curvAt(s) { return this.k[this.idx(s)]; }
  headingAt(s) { return this.th[this.idx(s)]; }
  // average curvature magnitude-preserving over a window ahead
  curvAhead(s, dist) {
    const i0 = this.idx(s), cnt = Math.max(1, Math.round(dist / this.ds));
    let best = 0;
    for (let j = 0; j < cnt; j++) {
      const v = this.k[(i0 + j) % this.n];
      if (Math.abs(v) > Math.abs(best)) best = v;
    }
    return best;
  }
  pos(s, lat) {
    const i = this.idx(s);
    return { x: this.xs[i] + this.nx[i] * lat, y: this.ys[i] + this.ny[i] * lat };
  }
  // signed distance difference b - a along the track in (-L/2, L/2]
  diff(a, b) {
    let d = this.wrap(b) - this.wrap(a);
    const L = this.length;
    if (d > L / 2) d -= L;
    if (d <= -L / 2) d += L;
    return d;
  }
}

if (typeof module !== 'undefined') module.exports = { Track };
