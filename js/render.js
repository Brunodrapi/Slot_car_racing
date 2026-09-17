// Canvas renderer: world (background image or grass, road with variable width, the three
// driving lines, cars, effects) + HUD (position, times, speed/grip, line slider, minimap).
'use strict';

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
    this.rotate = true;      // keep the track direction pointing up the screen
    this.camAngle = 0;
    this.resize();
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
    const sh = mobile ? 58 : 70, sw = mobile ? 170 : 240;
    // vertical line slider, left side, above the speed panel
    const len = Math.min(H * 0.36, 300);
    this.slider = { x: pad + 22, y: H - pad - sh - 22 - len, len, w: 30 };
    this.speedPanel = { x: pad, y: H - pad - sh, w: sw, h: sh };
    this.mobile = mobile;
  }

  _makeGrass() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#5c9a3c';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(70,125,45,0.5)' : 'rgba(120,175,80,0.35)';
      g.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 4, 2 + Math.random() * 4);
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

    this.paths = { center, road, left, right, corners, bridges, lines };
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
    const metres = (this.rotate ? 75 * (1 + 0.5 * vf) : 50 * (1 + 0.35 * vf)) / zf;
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
    if (this.rotate) g.rotate(-this.camAngle - Math.PI / 2);
    g.scale(cam.zoom, cam.zoom);
    g.translate(-cam.x, -cam.y);
    // conservative square view box: valid whatever the camera rotation
    const reach = Math.hypot(W, H) / 2 / cam.zoom + 40;
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
      for (const cn of this.paths.corners) { if (!inView(cn.bbox)) continue; g.fillStyle = '#c9b98a'; g.fill(cn.gravel); }
      g.fillStyle = '#4b4b52'; g.fill(this.paths.road);
      g.strokeStyle = '#d8d8dc'; g.lineWidth = 0.7; g.stroke(this.paths.left); g.stroke(this.paths.right);
      g.lineWidth = 1.3;
      for (const cn of this.paths.corners) {
        if (!inView(cn.bbox)) continue;
        for (const edge of [cn.left, cn.right]) {
          g.setLineDash([]); g.strokeStyle = '#d62828'; g.stroke(edge);
          g.setLineDash([3, 3]); g.strokeStyle = '#f2f2f2'; g.stroke(edge);
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
    const order = race.cars.slice().sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0));
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
    const pt = (d) => { const i = T.idx(p.s + d), lat = T.targetLat(p.s + d, p.sel); return [T.xs[i] + T.nx[i] * lat, T.ys[i] + T.ny[i] * lat]; };
    const runs = { '#5be07a': [], '#ffd23f': [], '#ff6b4b': [] };
    let prev = pt(0);
    for (let d = step; d <= ahead; d += step) {
      const now = pt(d);
      const r = race.profileAt(p.s + d - step / 2, p.sel) / vmax;
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
      const vp = race.profileAt(p.s + d, p.sel);
      if (vp * vp >= v2) continue;
      const need = (v2 - vp * vp) / (2 * brake);
      if (d - need < slack) slack = d - need;
    }
    if (slack === Infinity || slack > 180) return;
    const at = Math.max(4, slack);   // never sit on top of the car
    const i = T.idx(p.s + at), lat = T.targetLat(p.s + at, p.sel);
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

  _drawCar(g, car) {
    const c = car.cls, pos = car.pos, h = car.heading;
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

    // bottom-left: speed + grip meter
    const sp = this.speedPanel;
    panel(sp.x, sp.y, sp.w, sp.h);
    const kmh = Math.round(p.v * 3.6);
    g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = `bold ${mobile ? 24 : 30}px ui-monospace, monospace`;
    g.fillText(`${kmh}`, sp.x + 12, sp.y + 6);
    g.font = `${mobile ? 11 : 13}px system-ui, sans-serif`; g.fillStyle = '#cfd3dc';
    g.fillText('km/h', sp.x + 12 + (mobile ? 50 : 66), sp.y + (mobile ? 16 : 20));
    const ratio = p.loadRatio;
    const barX = sp.x + 12, barY = sp.y + sp.h - 18, barW = sp.w - 24, barH = 8;
    g.fillStyle = 'rgba(255,255,255,0.15)'; this._roundRect(g, barX, barY, barW, barH, 4); g.fill();
    const f = Math.min(1, ratio / 1.3);
    g.fillStyle = ratio < 0.85 ? '#5be07a' : ratio < 1 ? '#ffd23f' : '#ff4b4b'; this._roundRect(g, barX, barY, Math.max(4, barW * f), barH, 4); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(barX + barW / 1.3 - 1, barY - 3, 2, barH + 6);
    g.font = `${mobile ? 10 : 11}px system-ui, sans-serif`; g.fillStyle = '#cfd3dc'; g.textAlign = 'right';
    g.fillText(t('grip'), sp.x + sp.w - 12, sp.y + sp.h - 34);
    if (p.throttle) { g.fillStyle = 'rgba(91,224,122,0.9)'; g.beginPath(); g.arc(sp.x + sp.w - 20, sp.y + 18, 7, 0, Math.PI * 2); g.fill(); }
    else { g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; g.beginPath(); g.arc(sp.x + sp.w - 20, sp.y + 18, 7, 0, Math.PI * 2); g.stroke(); }

    // line slider (left thumb)
    this._drawSlider(g, p, t);

    // minimap bottom-right
    if (this.mm) {
      const m = this.mm, mx = W - pad - m.size, my = H - pad - m.size;
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
    const s = this.slider;
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
