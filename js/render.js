// Canvas renderer: world (track, cars, effects) + HUD.
'use strict';

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
    this.minimap = null;
    this.shake = 0;
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.w = w; this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  }

  _makeGrass() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#5c9a3c';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(70,125,45,0.5)' : 'rgba(120,175,80,0.35)';
      const x = Math.random() * 128, y = Math.random() * 128;
      g.fillRect(x, y, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
    return c;
  }

  setTrack(track) {
    this.track = track;
    this.skids = [];
    this.particles = [];
    const N = track.n, xs = track.xs, ys = track.ys;
    const STEP = 3;
    const center = new Path2D();
    for (let i = 0; i < N; i += STEP) { if (i === 0) center.moveTo(xs[i], ys[i]); else center.lineTo(xs[i], ys[i]); }
    center.closePath();

    const corners = track.corners.map(cn => {
      const p = new Path2D(), left = new Path2D(), right = new Path2D();
      const hw = track.halfWidth;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = cn.from; i <= cn.to; i += 2) {
        const k = i % N;
        const x = xs[k], y = ys[k], nx = track.nx[k], ny = track.ny[k];
        if (i === cn.from) { p.moveTo(x, y); left.moveTo(x + nx * hw, y + ny * hw); right.moveTo(x - nx * hw, y - ny * hw); }
        else { p.lineTo(x, y); left.lineTo(x + nx * hw, y + ny * hw); right.lineTo(x - nx * hw, y - ny * hw); }
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      return { p, left, right, sign: cn.sign, bbox: { minX: minX - 30, minY: minY - 30, maxX: maxX + 30, maxY: maxY + 30 } };
    });

    const bridges = track.crossings.map(cr => {
      const p = new Path2D();
      const from = cr.over - 16, to = cr.over + 20;
      for (let i = from; i <= to; i += 2) {
        const k = (i + N) % N;
        if (i === from) p.moveTo(xs[k], ys[k]); else p.lineTo(xs[k], ys[k]);
      }
      return p;
    });

    this.paths = { center, corners, bridges };
    this._makeMinimap();
    this.grassPattern = this.ctx.createPattern(this.grass, 'repeat');
  }

  _makeMinimap() {
    const T = this.track, b = T.bounds;
    const size = Math.min(180, Math.max(120, this.w * 0.2));
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

  // ---------- world helpers ----------
  worldToScreen(x, y) {
    return { x: (x - this.cam.x) * this.cam.zoom + this.w / 2, y: (y - this.cam.y) * this.cam.zoom + this.h / 2 };
  }

  updateCamera(race, dt) {
    const p = race.player;
    const T = race.track;
    const pos = p.pos;
    const h = T.headingAt(p.s);
    const lead = Math.min(45, p.v * 0.45) / (p.cls.zoom || 1);
    const tx = pos.x + Math.cos(h) * lead, ty = pos.y + Math.sin(h) * lead;
    const base = Math.min(this.w / 150, this.h / 110);
    const zoomTarget = clamp(base, 2.6, 9) * (p.cls.zoom || 1) * (1 - 0.25 * Math.min(1, p.v / p.cls.vmax));
    const k = Math.min(1, dt * 4);
    if (this.cam.init) {
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
      this.cam.zoom += (zoomTarget - this.cam.zoom) * Math.min(1, dt * 1.5);
    } else {
      this.cam.x = tx; this.cam.y = ty; this.cam.zoom = zoomTarget; this.cam.init = true;
    }
  }

  addEffects(race, dt) {
    for (const car of race.cars) {
      const pos = car.pos, h = car.heading;
      if (car.slide > 0.12 && car.state === 'ok' && car.v > 5) {
        const side = Math.sign(car.vl) || 1;
        for (const w of [-1, 1]) {
          const bx = pos.x - Math.cos(h) * car.cls.length * 0.35 + Math.cos(h + Math.PI / 2) * w * car.cls.width * 0.4;
          const by = pos.y - Math.sin(h) * car.cls.length * 0.35 + Math.sin(h + Math.PI / 2) * w * car.cls.width * 0.4;
          this.skids.push({ x: bx, y: by, a: h, l: car.v * dt * 1.2 + 0.3, alpha: Math.min(0.7, car.slide) });
        }
        if (Math.random() < car.slide * 0.8) {
          this.particles.push({ x: pos.x - Math.cos(h) * car.cls.length * 0.4, y: pos.y - Math.sin(h) * car.cls.length * 0.4, vx: -side * Math.cos(h + Math.PI / 2) * 2 + (Math.random() - 0.5) * 2, vy: -side * Math.sin(h + Math.PI / 2) * 2 + (Math.random() - 0.5) * 2, r: 0.6, life: 0.7, col: '200,200,200' });
        }
      }
      if (car.state === 'spin' && car.spinT < 0.6) {
        for (let i = 0; i < 2; i++) this.particles.push({ x: pos.x + (Math.random() - 0.5) * 3, y: pos.y + (Math.random() - 0.5) * 3, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, r: 1.2, life: 0.9, col: '190,160,110' });
      }
    }
    if (this.skids.length > 900) this.skids.splice(0, this.skids.length - 900);
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.r += dt * 1.5; }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  // ---------- main draw ----------
  draw(race, ui) {
    const g = this.ctx, W = this.w, H = this.h;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const T = race.track;
    const cam = this.cam;
    let sx = 0, sy = 0;
    if (this.shake > 0) { sx = (Math.random() - 0.5) * this.shake * 8; sy = (Math.random() - 0.5) * this.shake * 8; }

    g.save();
    g.translate(W / 2 + sx, H / 2 + sy);
    g.scale(cam.zoom, cam.zoom);
    g.translate(-cam.x, -cam.y);
    const vis = { minX: cam.x - W / 2 / cam.zoom - 40, maxX: cam.x + W / 2 / cam.zoom + 40, minY: cam.y - H / 2 / cam.zoom - 40, maxY: cam.y + H / 2 / cam.zoom + 40 };

    // grass
    g.fillStyle = this.grassPattern;
    g.save(); g.scale(1 / 8, 1 / 8); g.fillRect(vis.minX * 8, vis.minY * 8, (vis.maxX - vis.minX) * 8, (vis.maxY - vis.minY) * 8); g.restore();

    g.lineCap = 'round'; g.lineJoin = 'round';
    const inView = (b) => !(b.maxX < vis.minX || b.minX > vis.maxX || b.maxY < vis.minY || b.minY > vis.maxY);

    // gravel run-off at corners
    for (const cn of this.paths.corners) {
      if (!inView(cn.bbox)) continue;
      g.strokeStyle = '#c9b98a'; g.lineWidth = T.width + 16; g.stroke(cn.p);
    }
    // road
    g.strokeStyle = '#d8d8dc'; g.lineWidth = T.width + 1.2; g.stroke(this.paths.center);
    g.strokeStyle = '#4b4b52'; g.lineWidth = T.width; g.stroke(this.paths.center);
    // kerbs
    g.lineWidth = 1.3;
    for (const cn of this.paths.corners) {
      if (!inView(cn.bbox)) continue;
      for (const edge of [cn.left, cn.right]) {
        g.setLineDash([]); g.strokeStyle = '#d62828'; g.stroke(edge);
        g.setLineDash([3, 3]); g.strokeStyle = '#f2f2f2'; g.stroke(edge);
      }
    }
    g.setLineDash([]);
    // start / finish line
    this._drawStartLine(g, T);
    // skid marks
    g.strokeStyle = 'rgba(20,20,20,1)'; g.lineWidth = 0.35;
    for (const s of this.skids) {
      g.globalAlpha = s.alpha * 0.6;
      g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x - Math.cos(s.a) * s.l, s.y - Math.sin(s.a) * s.l); g.stroke();
    }
    g.globalAlpha = 1;
    // bridges (drawn over everything below, cars on the "over" part drawn later anyway)
    for (const b of this.paths.bridges) {
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = T.width + 5; g.stroke(b);
      g.strokeStyle = '#2f2f36'; g.lineWidth = T.width + 2.4; g.stroke(b);
      g.strokeStyle = '#4b4b52'; g.lineWidth = T.width; g.stroke(b);
    }
    // cars (player last)
    const order = race.cars.slice().sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0));
    for (const car of order) this._drawCar(g, car);
    // particles
    for (const p of this.particles) {
      g.fillStyle = `rgba(${p.col},${Math.max(0, p.life) * 0.6})`;
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
    }
    g.restore();

    this._drawHUD(g, race, ui);
  }

  _drawStartLine(g, T) {
    const i = 0, x = T.xs[i], y = T.ys[i], th = T.th[i];
    g.save(); g.translate(x, y); g.rotate(th);
    const hw = T.halfWidth, n = 8, cell = (hw * 2) / n;
    for (let r = 0; r < 2; r++) for (let c = 0; c < n; c++) {
      g.fillStyle = (r + c) % 2 ? '#f5f5f5' : '#1a1a1a';
      g.fillRect(-cell + r * cell, -hw + c * cell, cell, cell);
    }
    g.restore();
  }

  _drawCar(g, car) {
    const c = car.cls, L = c.length, Wd = c.width, pos = car.pos, h = car.heading;
    const body = car.livery.body, acc = car.livery.accent;
    g.save();
    g.translate(pos.x, pos.y);
    // shadow
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.save(); g.rotate(h); g.translate(0.25, 0.35); this._roundRect(g, -L / 2, -Wd / 2, L, Wd, 0.5); g.fill(); g.restore();
    g.rotate(h);
    const wheel = (x, y, w, l) => { g.fillStyle = '#151515'; g.fillRect(x - l / 2, y - w / 2, l, w); };
    switch (c.shape) {
      case 'formula':
      case 'classic': {
        const open = true;
        wheel(L * 0.32, -Wd / 2 + 0.2, 0.42, 0.7); wheel(L * 0.32, Wd / 2 - 0.2, 0.42, 0.7);
        wheel(-L * 0.32, -Wd / 2 + 0.25, 0.5, 0.8); wheel(-L * 0.32, Wd / 2 - 0.25, 0.5, 0.8);
        g.fillStyle = body;
        // narrow body
        g.beginPath();
        g.moveTo(L / 2, 0); g.lineTo(L * 0.2, -Wd * 0.22); g.lineTo(-L * 0.15, -Wd * 0.3); g.lineTo(-L / 2 + 0.3, -Wd * 0.28);
        g.lineTo(-L / 2 + 0.3, Wd * 0.28); g.lineTo(-L * 0.15, Wd * 0.3); g.lineTo(L * 0.2, Wd * 0.22); g.closePath(); g.fill();
        if (c.shape === 'formula') {
          g.fillStyle = acc; g.fillRect(L / 2 - 0.5, -Wd / 2, 0.35, Wd); g.fillRect(-L / 2, -Wd / 2 + 0.1, 0.4, Wd - 0.2);
          g.fillStyle = body; g.fillRect(-L * 0.42, -Wd * 0.12, L * 0.3, Wd * 0.24); // engine cover
        } else {
          g.fillStyle = acc; g.fillRect(-L * 0.05, -Wd * 0.28, L * 0.12, Wd * 0.56);
        }
        // helmet
        g.fillStyle = '#f5f5f5'; g.beginPath(); g.arc(-L * 0.05, 0, 0.32, 0, Math.PI * 2); g.fill();
        void open;
        break;
      }
      case 'kart': {
        wheel(L * 0.3, -Wd / 2 + 0.15, 0.32, 0.45); wheel(L * 0.3, Wd / 2 - 0.15, 0.32, 0.45);
        wheel(-L * 0.35, -Wd / 2 + 0.18, 0.4, 0.5); wheel(-L * 0.35, Wd / 2 - 0.18, 0.4, 0.5);
        g.fillStyle = body; this._roundRect(g, -L / 2 + 0.2, -Wd * 0.3, L * 0.9, Wd * 0.6, 0.3); g.fill();
        g.fillStyle = acc; g.fillRect(L * 0.25, -Wd * 0.35, 0.3, Wd * 0.7);
        g.fillStyle = '#f5f5f5'; g.beginPath(); g.arc(-L * 0.1, 0, 0.3, 0, Math.PI * 2); g.fill();
        break;
      }
      case 'proto': {
        g.fillStyle = body;
        g.beginPath(); g.moveTo(L / 2, -Wd * 0.3); g.lineTo(L / 2, Wd * 0.3); g.lineTo(-L / 2, Wd / 2); g.lineTo(-L / 2, -Wd / 2); g.closePath(); g.fill();
        g.fillStyle = '#1d2733'; this._roundRect(g, -L * 0.1, -Wd * 0.28, L * 0.35, Wd * 0.56, 0.3); g.fill();
        g.fillStyle = acc; g.fillRect(-L / 2 + 0.15, -Wd / 2, 0.35, Wd); g.fillRect(-L * 0.35, -0.12, L * 0.3, 0.24);
        break;
      }
      case 'muscle':
      case 'sedan':
      case 'hatch':
      case 'gt':
      default: {
        g.fillStyle = body; this._roundRect(g, -L / 2, -Wd / 2, L, Wd, 0.45); g.fill();
        // windows
        g.fillStyle = '#1d2733';
        const fw = c.shape === 'hatch' ? 0.28 : 0.22;
        this._roundRect(g, L * 0.05, -Wd * 0.4, L * fw, Wd * 0.8, 0.2); g.fill();
        this._roundRect(g, -L * 0.42, -Wd * 0.4, L * 0.16, Wd * 0.8, 0.2); g.fill();
        // roof stripe
        g.fillStyle = acc; g.fillRect(-L * 0.25, -Wd * 0.12, L * 0.3, Wd * 0.24);
        if (c.shape === 'gt') { g.fillRect(-L / 2, -Wd / 2, 0.3, Wd); }
        // headlights
        g.fillStyle = '#fff6c0'; g.fillRect(L / 2 - 0.3, -Wd / 2 + 0.15, 0.25, 0.4); g.fillRect(L / 2 - 0.3, Wd / 2 - 0.55, 0.25, 0.4);
        g.fillStyle = '#ff3333'; g.fillRect(-L / 2 + 0.05, -Wd / 2 + 0.15, 0.2, 0.4); g.fillRect(-L / 2 + 0.05, Wd / 2 - 0.55, 0.2, 0.4);
        break;
      }
    }
    // brake lights
    if (!car.throttle && car.v > 2 && car.state === 'ok') {
      g.fillStyle = 'rgba(255,40,40,0.9)'; g.fillRect(-L / 2 - 0.15, -Wd / 2 + 0.1, 0.25, Wd - 0.2);
    }
    g.restore();
    if (car.isPlayer) {
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.25;
      g.beginPath(); g.arc(pos.x, pos.y, Math.max(L, Wd) * 0.7, 0, Math.PI * 2); g.stroke();
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
    const mobile = W < 700;
    const pad = 14;
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
    const sw = mobile ? 170 : 240, sh = mobile ? 58 : 70;
    const sx = pad, sy = H - pad - sh;
    panel(sx, sy, sw, sh);
    const kmh = Math.round(p.v * 3.6);
    g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = `bold ${mobile ? 24 : 30}px ui-monospace, monospace`;
    g.fillText(`${kmh}`, sx + 12, sy + 6);
    g.font = `${mobile ? 11 : 13}px system-ui, sans-serif`; g.fillStyle = '#cfd3dc';
    g.fillText('km/h', sx + 12 + (mobile ? 50 : 66), sy + (mobile ? 16 : 20));
    // grip bar: shows how close to the limit
    const k = Math.abs(race.track.curvAt(p.s));
    const ratio = p.v * p.v * k / p.gripAt(p.v);
    const barX = sx + 12, barY = sy + sh - 18, barW = sw - 24, barH = 8;
    g.fillStyle = 'rgba(255,255,255,0.15)'; this._roundRect(g, barX, barY, barW, barH, 4); g.fill();
    const f = Math.min(1, ratio / 1.3);
    const col = ratio < 0.85 ? '#5be07a' : ratio < 1 ? '#ffd23f' : '#ff4b4b';
    g.fillStyle = col; this._roundRect(g, barX, barY, Math.max(4, barW * f), barH, 4); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(barX + barW / 1.3 - 1, barY - 3, 2, barH + 6);
    g.font = `${mobile ? 10 : 11}px system-ui, sans-serif`; g.fillStyle = '#cfd3dc'; g.textAlign = 'right';
    g.fillText(t('grip'), sx + sw - 12, sy + sh - 34);

    // throttle indicator
    if (p.throttle) {
      g.fillStyle = 'rgba(91,224,122,0.9)'; g.beginPath(); g.arc(sx + sw - 20, sy + 18, 7, 0, Math.PI * 2); g.fill();
    } else {
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; g.beginPath(); g.arc(sx + sw - 20, sy + 18, 7, 0, Math.PI * 2); g.stroke();
    }

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

    // standings strip (desktop) — top centre
    if (!mobile && race.mode !== 'timetrial') {
      const st = race.standings().slice(0, 6);
      const rowH = 20, bw = 190;
      const bx = pad, by = pad + boxH + 10;
      panel(bx, by, bw, st.length * rowH + 10);
      g.font = '13px system-ui, sans-serif'; g.textAlign = 'left';
      st.forEach((car, i) => {
        const y = by + 5 + i * rowH;
        g.fillStyle = car.livery.body; g.fillRect(bx + 10, y + 4, 10, 10);
        g.fillStyle = car.isPlayer ? '#ffd400' : '#e8e8ec';
        g.fillText(`${i + 1}. ${car.name}`, bx + 28, y + 2);
        if (car.state === 'spin') { g.fillStyle = '#ff6b6b'; g.textAlign = 'right'; g.fillText('!', bx + bw - 10, y + 2); g.textAlign = 'left'; }
      });
    }

    // countdown
    if (race.state === 'countdown') {
      const c = race.countdown;
      const lights = c > 3.2 ? 0 : c > 2.4 ? 1 : c > 1.6 ? 2 : c > 0.8 ? 3 : 4;
      const cx = W / 2, cy = H * 0.22;
      panel(cx - 120, cy - 30, 240, 60);
      for (let i = 0; i < 4; i++) {
        g.fillStyle = i < lights ? '#ff3b3b' : 'rgba(255,255,255,0.15)';
        g.beginPath(); g.arc(cx - 75 + i * 50, cy, 16, 0, Math.PI * 2); g.fill();
      }
      g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = 'bold 18px system-ui, sans-serif';
      g.fillText(t('holdToGo'), cx, cy + 40);
    } else if (race.time < 1.2 && race.state === 'racing') {
      g.textAlign = 'center'; g.fillStyle = '#5be07a'; g.font = 'bold 64px system-ui, sans-serif';
      g.globalAlpha = 1 - race.time / 1.2; g.fillText('GO!', W / 2, H * 0.18); g.globalAlpha = 1;
    }

    // spin warning
    if (p.state === 'spin') {
      g.textAlign = 'center'; g.fillStyle = '#ff6b6b'; g.font = 'bold 28px system-ui, sans-serif';
      g.fillText(t('offTrack'), W / 2, H * 0.3);
    }
    // finished banner
    if (p.finished && race.state !== 'finished') {
      g.textAlign = 'center'; g.fillStyle = '#ffd400'; g.font = 'bold 40px system-ui, sans-serif';
      g.fillText(`${t('finished')} — P${race.positionOf(p)}`, W / 2, H * 0.3);
    }
    // lap flash
    if (ui.flash && ui.flash.until > performance.now()) {
      g.textAlign = 'center'; g.fillStyle = ui.flash.color || '#fff'; g.font = 'bold 26px system-ui, sans-serif';
      g.fillText(ui.flash.text, W / 2, H * 0.12);
    }
    g.textBaseline = 'alphabetic';
  }
}

function fmtTime(s) {
  if (s == null || !isFinite(s)) return '--:--.---';
  const m = Math.floor(s / 60), sec = s - m * 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(3)}`;
}
