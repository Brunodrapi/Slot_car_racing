// Canvas renderer: world (background image or grass, road with variable width, the three
// driving lines, cars, effects) + HUD (position, times, speed/grip, line slider, minimap).
'use strict';

// Cartoon palette, flat and saturated, in the spirit of an isometric pixel-art city.
const PAL = {
  grass: '#4e7a3a', grassLight: '#557f3f', grassDark: '#477036',
  asphalt: '#33333c', asphaltLight: '#3b3b45',
  outline: '#1a1a20',
  edgeLine: '#d7d9dd', centreLine: '#e8bc32',
  kerbRed: '#c33b30', kerbWhite: '#e9e9ee',
  gravel: '#b9a271', gravelDark: '#a68f5f',
};

const LINE_COLORS = { inside: 'rgba(80,200,255,0.55)', racing: 'rgba(255,255,255,0.5)', outside: 'rgba(255,200,60,0.55)' };

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.track = null;
    this.paths = null;
    this.skids = [];
    this.particles = [];
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

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.w = w; this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this._layoutHud();
  }

  _layoutHud() {
    const W = this.w, H = this.h, mobile = W < 700;
    const pad = 14;
    // Throttle dial: a half-dome that the thumb carries with it. At rest it waits at the bottom
    // centre; a thumb landing anywhere off the line slider moves it there, base on the finger, so
    // the whole dial reads above the hand instead of under it.
    const r = clamp(Math.min(W * 0.26, H * 0.17), 68, 130);
    this.dialHome = { cx: W / 2, cy: H - pad - r * 0.46 };   // at rest the pad shows in full
    this.dial = { cx: this.dialHome.cx, cy: this.dialHome.cy, r };
    this.dialAnchored = false;
    // vertical line slider, left side, clear of the dial
    const len = Math.min(H * 0.38, 320);
    this.slider = { x: pad + 22, y: H - pad - 30 - len, len, w: 30 };
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
    this.skids = [];
    this.particles = [];
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

    const corners = track.corners.map(cn => {
      const l = new Path2D(), r = new Path2D(), gravel = new Path2D();
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = cn.from; i <= cn.to; i += 2) {
        const a = edgePt(i, 1), b = edgePt(i, -1);
        if (i === cn.from) { l.moveTo(a[0], a[1]); r.moveTo(b[0], b[1]); } else { l.lineTo(a[0], a[1]); r.lineTo(b[0], b[1]); }
        minX = Math.min(minX, a[0], b[0]); maxX = Math.max(maxX, a[0], b[0]); minY = Math.min(minY, a[1], b[1]); maxY = Math.max(maxY, a[1], b[1]);
      }
      // gravel: wider band around the corner
      for (let i = cn.from; i <= cn.to; i += 2) { const k = ((i % N) + N) % N, p = [xs[k] + nx[k] * (track.hwL[k] + 8), ys[k] + ny[k] * (track.hwL[k] + 8)]; if (i === cn.from) gravel.moveTo(p[0], p[1]); else gravel.lineTo(p[0], p[1]); }
      for (let i = cn.to; i >= cn.from; i -= 2) { const k = ((i % N) + N) % N; gravel.lineTo(xs[k] - nx[k] * (track.hwR[k] + 8), ys[k] - ny[k] * (track.hwR[k] + 8)); }
      gravel.closePath();
      return { left: l, right: r, gravel, bbox: { minX: minX - 30, minY: minY - 30, maxX: maxX + 30, maxY: maxY + 30 } };
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

    this.paths = { center, mid, road, left, right, corners, bridges, lines };
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
    const zf = p.cls.zoom || 1;
    const vf = Math.min(1, p.v / p.cls.vmax);
    // Frame a fixed distance rather than a fixed area, so a portrait phone and a desktop window
    // show the same thing. Track-aligned: metres visible ahead, down the screen height.
    // Fixed north-up: metres across the shorter screen axis.
    const metres = (this.rotate ? 75 * (1 + 0.5 * vf) : (this.tilt === 1 ? 50 : 40) * (1 + 0.35 * vf)) / zf;
    const zoomTarget = (this.rotate ? this.h : Math.min(this.w, this.h)) / metres;
    const lead = Math.min(36, p.v * 0.42) / zf;
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

  addEffects(race, dt) {
    for (const car of race.cars) {
      const pos = car.pos, h = car.heading;
      if (car.slide > 0.15 && car.state === 'ok' && car.v > 5) {
        const side = Math.sign(car.drift) || 1;
        for (const w of [-1, 1]) {
          const bx = pos.x - Math.cos(h) * car.cls.length * 0.35 + Math.cos(h + Math.PI / 2) * w * car.cls.width * 0.4;
          const by = pos.y - Math.sin(h) * car.cls.length * 0.35 + Math.sin(h + Math.PI / 2) * w * car.cls.width * 0.4;
          this.skids.push({ x: bx, y: by, a: h, l: car.v * dt * 1.2 + 0.3, alpha: Math.min(0.7, car.slide) });
        }
        if (Math.random() < car.slide * 0.8) this.particles.push({ x: pos.x - Math.cos(h) * car.cls.length * 0.4, y: pos.y - Math.sin(h) * car.cls.length * 0.4, vx: -side * Math.cos(h + Math.PI / 2) * 2 + (Math.random() - 0.5) * 2, vy: -side * Math.sin(h + Math.PI / 2) * 2 + (Math.random() - 0.5) * 2, r: 0.6, life: 0.7, col: '200,200,200' });
      }
      if (car.state === 'grass') {
        for (let i = 0; i < 2; i++) this.particles.push({ x: pos.x + (Math.random() - 0.5) * 3, y: pos.y + (Math.random() - 0.5) * 3, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, r: 1.2, life: 0.9, col: '190,160,110' });
      }
    }
    if (this.skids.length > 900) this.skids.splice(0, this.skids.length - 900);
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.r += dt * 1.5; }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  // ---------- main draw ----------
  draw(race, ui) {
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
    }

    g.lineCap = 'round'; g.lineJoin = 'round';
    if (T.drawRoad) {
      // gravel traps first, then the road itself with a heavy dark outline: the cartoon look
      // comes from flat colours and hard edges rather than shading
      for (const cn of this.paths.corners) { if (!inView(cn.bbox)) continue; g.fillStyle = PAL.gravel; g.fill(cn.gravel); }
      g.strokeStyle = PAL.outline; g.lineWidth = 3.6; g.stroke(this.paths.road);
      g.fillStyle = PAL.asphalt; g.fill(this.paths.road);
      // painted markings: solid white at the edges, dashed yellow down the middle
      g.strokeStyle = PAL.edgeLine; g.lineWidth = 0.55;
      g.stroke(this.paths.left); g.stroke(this.paths.right);
      g.setLineDash([2.6, 3.4]);
      g.strokeStyle = PAL.centreLine; g.lineWidth = 0.42;
      g.stroke(this.paths.mid);
      g.setLineDash([]);
      // kerbs on the corners, chunkier than before
      g.lineWidth = 1.6;
      for (const cn of this.paths.corners) {
        if (!inView(cn.bbox)) continue;
        for (const edge of [cn.left, cn.right]) {
          g.setLineDash([]); g.strokeStyle = PAL.kerbRed; g.stroke(edge);
          g.setLineDash([2.6, 2.6]); g.strokeStyle = PAL.kerbWhite; g.stroke(edge);
        }
      }
      g.setLineDash([]);
    }
    if (this.showLines) this._drawGuide(g, race);
    this._drawStartLine(g, T);
    // skid marks
    g.strokeStyle = 'rgba(20,20,20,1)'; g.lineWidth = 0.35;
    for (const s of this.skids) {
      g.globalAlpha = s.alpha * 0.6;
      g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x - Math.cos(s.a) * s.l, s.y - Math.sin(s.a) * s.l); g.stroke();
    }
    g.globalAlpha = 1;
    if (T.drawRoad) for (const b of this.paths.bridges) {
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = T.width + 5; g.stroke(b);
      g.strokeStyle = '#2f2f36'; g.lineWidth = T.width + 2.4; g.stroke(b);
      g.strokeStyle = '#4b4b52'; g.lineWidth = T.width; g.stroke(b);
    }
    const order = race.cars.slice().sort(this.tilt === 1
      ? (a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0)
      : (a, b) => a.pos.y - b.pos.y);
    for (const car of order) this._drawCar(g, car);
    for (const p of this.particles) {
      g.fillStyle = `rgba(${p.col},${Math.max(0, p.life) * 0.6})`;
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
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
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.save(); g.translate(0.25, 0.35); g.fillRect(-c.length / 2, -c.width / 2, c.length, c.width); g.restore();
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
    const mobile = this.mobile, pad = 14;
    g.textBaseline = 'top';
    const panel = (x, y, w, h) => { g.fillStyle = 'rgba(10,12,20,0.55)'; this._roundRect(g, x, y, w, h, 10); g.fill(); };

    // top-left: position & lap
    const pos = race.positionOf(p), n = race.cars.length;
    const boxW = mobile ? 150 : 190, boxH = mobile ? 64 : 78;
    panel(pad, pad, boxW, boxH);
    g.fillStyle = '#fff'; g.font = `bold ${mobile ? 30 : 40}px system-ui, sans-serif`; g.textAlign = 'left';
    const posTxt = race.mode === 'timetrial' ? '—' : `${pos}`;
    g.fillText(posTxt, pad + 12, pad + 8);
    const posW = g.measureText(posTxt).width;
    g.font = `${mobile ? 13 : 15}px system-ui, sans-serif`; g.fillStyle = '#cfd3dc';
    if (race.mode !== 'timetrial') g.fillText(`/ ${n}`, pad + 16 + posW, pad + (mobile ? 22 : 30));
    const lapShown = Math.min(race.laps, p.lap + 1);
    g.textAlign = 'right';
    g.fillText(race.mode === 'timetrial' ? `${t('lap')} ${p.lap + 1}` : `${t('lap')} ${lapShown} / ${race.laps}`, pad + boxW - 12, pad + 10);
    g.fillText(p.name, pad + boxW - 12, pad + boxH - 24);

    // top-right: times
    const tw = mobile ? 150 : 200;
    panel(W - pad - tw, pad, tw, boxH);
    g.textAlign = 'right'; g.fillStyle = '#fff'; g.font = `bold ${mobile ? 18 : 22}px ui-monospace, monospace`;
    g.fillText(fmtTime(race.state === 'countdown' ? 0 : race.time - p.lapStart), W - pad - 12, pad + 8);
    g.font = `${mobile ? 12 : 13}px system-ui, sans-serif`; g.fillStyle = '#cfd3dc';
    const last = p.lapTimes.length ? p.lapTimes[p.lapTimes.length - 1] : null;
    g.fillText(`${t('last')} ${last != null ? fmtTime(last) : '--:--.---'}`, W - pad - 12, pad + (mobile ? 32 : 40));
    g.fillText(`${t('best')} ${p.bestLap != null ? fmtTime(p.bestLap) : '--:--.---'}`, W - pad - 12, pad + (mobile ? 46 : 56));

    // line slider (left thumb)
    this._drawSlider(g, p, t);

    // minimap bottom-right
    if (this.mm) {
      // On a phone the bottom-right corner belongs to the thumb, so the map moves up under the
      // times. On a desktop there is no thumb and it stays in the corner.
      const m = this.mm, mx = W - pad - m.size;
      const my = mobile ? pad + boxH + 10 : H - pad - m.size;
      panel(mx, my, m.size, m.size);
      g.drawImage(m.canvas, mx, my, m.size, m.size);
      for (const car of race.cars) {
        const wp = car.pos, q = this.mmPoint(wp.x, wp.y);
        g.fillStyle = car.isPlayer ? '#ffd400' : car.livery.body;
        g.beginPath(); g.arc(mx + q.x, my + q.y, car.isPlayer ? 4.5 : 3, 0, Math.PI * 2); g.fill();
        if (car.isPlayer) { g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke(); }
      }
    }

    // standings strip (desktop)
    if (!mobile && race.mode !== 'timetrial') {
      const st = race.standings().slice(0, 6);
      const rowH = 20, bw = 190, bx = pad, by = pad + boxH + 10;
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
    const dbgY = pad + boxH + 10 + (mobile && this.mm ? this.mm.size + 10 : 0);
    if (this.debug) this._drawDebug(g, p, mobile ? 150 + pad * 2 : 200 + pad * 2, dbgY);

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
    if (ui.flash && ui.flash.until > performance.now()) { g.textAlign = 'center'; g.fillStyle = ui.flash.color || '#fff'; g.font = 'bold 26px system-ui, sans-serif'; g.fillText(ui.flash.text, W / 2, H * 0.12); }
    g.textBaseline = 'alphabetic';
  }

  _drawSlider(g, p, t) {
    const s = this.slider;
    g.fillStyle = 'rgba(10,12,20,0.55)'; this._roundRect(g, s.x - s.w / 2 - 8, s.y - 26, s.w + 16, s.len + 52, 12); g.fill();
    // track
    g.fillStyle = 'rgba(255,255,255,0.18)'; this._roundRect(g, s.x - 4, s.y, 8, s.len, 4); g.fill();
    const stops = [{ v: 1, c: LINE_COLORS.outside, l: t('lineOut') }, { v: 0, c: LINE_COLORS.racing, l: t('lineRace') }, { v: -1, c: LINE_COLORS.inside, l: t('lineIn') }];
    g.font = `bold ${this.mobile ? 10 : 11}px system-ui, sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle';
    for (const st of stops) {
      const y = s.y + s.len / 2 - st.v * s.len / 2;
      g.fillStyle = st.c; g.beginPath(); g.arc(s.x, y, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e8e8ec'; g.fillText(st.l, s.x + 14, y);
    }
    // handle
    const hy = s.y + s.len / 2 - p.sel * s.len / 2;
    g.fillStyle = '#ffd400'; g.beginPath(); g.arc(s.x, hy, 13, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1a1400'; g.lineWidth = 2; g.stroke();
    g.textBaseline = 'top';
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
    const inZoneX = touchZone ? x < this.w * 0.42 : Math.abs(x - s.x) < 40;
    if (!inZoneX) return null;
    if (!touchZone && (y < s.y - 30 || y > s.y + s.len + 30)) return null;
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
