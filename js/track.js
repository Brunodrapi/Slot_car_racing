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

class Track {
  constructor(def, widthScale) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
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

    // lines
    this.lines = {};
    if (def.lines && def.lines.racing) this._projectLines(def.lines, scale);
    else this._autoLines();
    if (def.lines && !def.width) this._widthFromLines();
    this._clampLines();
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
  }

  // Lines generated from curvature: racing = out-in-out, inside/outside hug the road edges
  // on the side of the next corner.
  _autoLines() {
    const N = this.n, k = this.k;
    const g = new Float32Array(N);
    for (let i = 0; i < N; i++) g[i] = clamp(k[i] * 70, -1, 1);          // sign = turn direction
    const gN = Track.smooth(g, 20), gW = Track.smooth(g, 90);
    // side of the next corner (sign of the next significant curvature), whatever the distance
    const side = new Float32Array(N);
    let nextSign = 0;
    for (let i = 2 * N - 1; i >= 0; i--) {
      const gi = g[i % N];
      if (Math.abs(gi) > 0.3) nextSign = Math.sign(gi);
      if (i < N) side[i] = nextSign || 1;
    }
    // hold the current corner's side through the corner itself
    for (let i = 0; i < N; i++) if (Math.abs(g[i]) > 0.3) side[i] = Math.sign(g[i]);
    const sideS = Track.smooth(side, 25);
    const racing = new Float32Array(N), inside = new Float32Array(N), outside = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const marginL = this.hwL[i] - 1.6, marginR = this.hwR[i] - 1.6;
      const r = clamp(-(2 * gN[i] - gW[i]), -1, 1);
      racing[i] = r > 0 ? r * marginL : r * marginR;
      const sg = clamp(sideS[i] * 2.2, -1, 1);       // ±1 nearly everywhere, soft crossovers
      inside[i] = -sg > 0 ? -sg * marginL * 0.92 : -sg * marginR * 0.92;
      outside[i] = sg > 0 ? sg * marginL * 0.92 : sg * marginR * 0.92;
    }
    this.lines.racing = Track.smooth(racing, 6);
    this.lines.inside = Track.smooth(inside, 6);
    this.lines.outside = Track.smooth(outside, 6);
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
  hwLeftAt(s) { return this._lerp(this.hwL, s); }
  hwRightAt(s) { return this._lerp(this.hwR, s); }
  lineLat(name, s) { return this._lerp(this.lines[name], s); }
  // blend of the three lines: sel in [-1, 1] (-1 inside, 0 racing, +1 outside)
  targetLat(s, sel) {
    const r = this._lerp(this.lines.racing, s);
    if (sel < 0) return r + (this._lerp(this.lines.inside, s) - r) * Math.min(1, -sel);
    return r + (this._lerp(this.lines.outside, s) - r) * Math.min(1, sel);
  }
  // strongest curvature ahead along a line
  curvAhead(s, dist, sel) {
    const i0 = this.idx(s), cnt = Math.max(1, Math.round(dist / this.ds));
    let best = 0;
    for (let j = 0; j < cnt; j++) {
      const i = (i0 + j) % this.n;
      const lat = sel == null ? 0 : this.targetLat(i * this.ds, sel);
      const v = this.k[i] / Math.max(0.25, 1 + this.k[i] * lat);
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

if (typeof module !== 'undefined') module.exports = { Track, LINE_NAMES };
