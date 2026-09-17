// App: game loop, input (throttle + line slider), flow between menus and races, career progression,
// user content (custom tracks and car models).
'use strict';

class App {
  constructor() {
    this.save = loadSave();
    this.canvas = document.getElementById('game');
    this.renderer = new Renderer(this.canvas);
    this.renderer.showLines = this.save.showLines !== false;
    this.audio = new GameAudio();
    this.audio.enabled = this.save.sound;
    this.ui = new UI(this);
    this.tracks = new Map();
    this.custom = { tracks: [], cars: [] };
    this.race = null;
    this.raceCtx = null;
    this.state = 'menu';
    this.input = { throttle: false, sel: 0 };
    this.pointers = { throttle: null, slider: null };
    this.last = performance.now();
    this._bindInput();
    window.addEventListener('resize', () => { this.renderer.resize(); if (this.race) this.renderer._makeMinimap(); });
    this.ui.menu();
    this.refreshCustom().then(() => {
      const params = new URLSearchParams(location.search);
      const tid = params.get('track');
      if (tid && this.trackDefById(tid)) { this.ui.setup.trackId = tid; this.ui.setupScreen('race'); }
      else this.ui.menu();
    });
    requestAnimationFrame((t) => this._frame(t));
  }

  // ---------- content ----------
  allTracks() { return TRACKS.concat(this.custom.tracks); }
  trackDefById(id) { return this.allTracks().find(t => t.id === id) || null; }
  trackCache(id) {
    if (!this.tracks.has(id)) this.tracks.set(id, new Track(this.trackDefById(id)));
    return this.tracks.get(id);
  }
  async refreshCustom() {
    try {
      this.custom.tracks = (await Store.list('tracks')).map(t => ({ ...t, custom: true }));
      const cars = await Store.list('cars');
      for (const c of cars) {
        const sprite = { base: null, color: null, extra: [] };
        try {
          sprite.base = await loadImage(c.layers.base);
          if (c.layers.color) sprite.color = await loadImage(c.layers.color);
          for (const ex of c.layers.extra || []) sprite.extra.push(await loadImage(ex));
        } catch (e) { /* broken image: draw as vector */ }
        registerModel({ id: c.id, catId: c.catId, name: c.name, shape: 'gtBoxy', colors: ['#c9ced6', '#e0262c'], length: c.length, width: c.width, mul: c.mul || {}, sprite: sprite.base ? sprite : null, custom: true });
      }
      this.custom.cars = cars;
      for (const t of this.custom.tracks) this.tracks.delete(t.id);
    } catch (e) { console.warn('custom content unavailable', e); }
  }

  playerName() { return this.save.name || this.ui.t('playerDefault'); }
  playerModelFor(catId) {
    const saved = this.save.models && this.save.models[catId];
    const m = saved && modelById(saved);
    return (m && m.catId === catId) ? m : modelsOf(catId)[0];
  }

  // ---------- input ----------
  _bindInput() {
    const on = () => { this.input.throttle = true; this.audio.start(); this.audio.resume(); };
    const off = () => { this.input.throttle = false; };
    const stepSel = (d) => { const v = Math.round(this.input.sel) + d; this.input.sel = clamp(v, -1, 1); };
    const LINE_DOWN = ['ArrowDown', 'ArrowLeft', 'a', 'A', 'q', 'Q'], LINE_UP = ['ArrowUp', 'ArrowRight', 'd', 'D', 'e', 'E'];
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { this.togglePause(); return; }
      if (this.state !== 'race') return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      e.preventDefault();
      if (LINE_DOWN.includes(e.key)) { stepSel(-1); return; }
      if (LINE_UP.includes(e.key)) { stepSel(1); return; }
      on();
    });
    window.addEventListener('keyup', (e) => { if (LINE_DOWN.includes(e.key) || LINE_UP.includes(e.key) || e.key === 'Escape') return; off(); });
    window.addEventListener('blur', () => { off(); this.pointers.throttle = this.pointers.slider = null; });
    window.addEventListener('wheel', (e) => { if (this.state === 'race') stepSel(e.deltaY < 0 ? 1 : -1); }, { passive: true });

    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (this.state !== 'race') return;
      e.preventDefault();
      const touch = e.pointerType === 'touch';
      if (touch) this.renderer.touch = true;
      const v = this.renderer.sliderValueAt(e.clientX, e.clientY, touch);
      if (v != null && this.pointers.slider == null) { this.pointers.slider = e.pointerId; this.input.sel = v; return; }
      if (this.pointers.throttle == null) { this.pointers.throttle = e.pointerId; on(); }
    });
    c.addEventListener('pointermove', (e) => {
      if (this.pointers.slider === e.pointerId) {
        const v = this.renderer.sliderValueAt(e.clientX, e.clientY, true);
        if (v != null) this.input.sel = v;
      }
    });
    const release = (e) => {
      if (this.pointers.slider === e.pointerId) this.pointers.slider = null;
      if (this.pointers.throttle === e.pointerId) { this.pointers.throttle = null; off(); }
      if (e.pointerType === 'mouse') off();
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('touchstart', (e) => { if (this.state === 'race') e.preventDefault(); }, { passive: false });
    c.addEventListener('touchmove', (e) => { if (this.state === 'race') e.preventDefault(); }, { passive: false });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'race') this.togglePause(); });
  }

  // ---------- flow ----------
  toMenu() {
    this.state = 'menu';
    this.race = null;
    this.raceCtx = null;
    this.audio.idle();
    this.ui.menu();
  }

  startQuick(mode, classId, trackId) {
    const trackDef = this.trackDefById(trackId), cat = categoryById(classId);
    if (!trackDef) return;
    this._startRace({
      mode, trackDef, classId, modelId: this.playerModelFor(classId).id,
      laps: lapsFor(trackDef, cat),
      difficulty: this.save.difficulty,
      playerLivery: this.save.livery,
      playerName: this.playerName(),
    }, { cup: null, mode, classId, trackId });
  }

  startCupRace(cupId) {
    const cup = CUPS.find(c => c.id === cupId);
    const cs = cupState(this.save, cupId);
    if (cs.done) { this.ui.cupScreen(cupId); return; }
    const idx = Math.min(cs.race, cup.tracks.length - 1);
    const trackDef = this.trackDefById(cup.tracks[idx]), cat = categoryById(cup.classId);
    const seed = CUPS.indexOf(cup) * 101 + 7;
    const roster = makeRoster(cat.drivers - 1, this.save.livery, seed, cat.id);
    this._startRace({
      mode: 'race', trackDef, classId: cup.classId, modelId: this.playerModelFor(cup.classId).id,
      laps: lapsFor(trackDef, cat),
      difficulty: this.save.difficulty,
      playerLivery: this.save.livery,
      playerName: this.playerName(),
      roster,
    }, { cup, raceIndex: idx });
  }

  _startRace(opts, ctx) {
    this.raceOpts = opts;
    this.raceCtx = ctx;
    this.race = new Race(opts);
    this.renderer.setTrack(this.race.track);
    this.renderer.cam.init = false;
    this.state = 'race';
    this.input.throttle = false;
    this.input.sel = 0;
    this.pointers.throttle = this.pointers.slider = null;
    this.ui.hide();
    this.ui.flash = null;
    this.last = performance.now();
  }

  retry() { if (this.raceOpts) this._startRace(this.raceOpts, this.raceCtx); }

  togglePause() {
    if (this.state === 'race') {
      this.state = 'paused';
      this.input.throttle = false;
      this.audio.idle();
      this.ui.pauseScreen(this.race);
    } else if (this.state === 'paused') this.resume();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'race';
    this.ui.hide();
    this.last = performance.now();
  }

  endTimeTrial() {
    if (!this.race) return;
    this.race.endTimeTrial();
    this._onRaceFinished();
  }

  _onRaceFinished() {
    const race = this.race, ctx = this.raceCtx || {};
    this.state = 'results';
    this.audio.idle();
    const save = this.save;
    const key = `${race.track.id}|${race.cat.id}`;
    let newRecord = false;
    if (race.player.bestLap != null && (save.bestLaps[key] == null || race.player.bestLap < save.bestLaps[key])) {
      save.bestLaps[key] = race.player.bestLap;
      newRecord = true;
    }
    save.racesDone++;
    if (ctx.cup) {
      const cs = cupState(save, ctx.cup.id);
      for (const r of race.results) cs.points[r.car.name] = (cs.points[r.car.name] || 0) + r.points;
      cs.race = ctx.raceIndex + 1;
      if (cs.race >= ctx.cup.tracks.length) {
        cs.done = true;
        const order = Object.entries(cs.points).sort((a, b) => b[1] - a[1]);
        cs.finalPos = order.findIndex(([n]) => n === this.playerName()) + 1;
      }
      save.cups[ctx.cup.id] = cs;
    }
    storeSave(save);
    this.ui.resultsScreen(race, { cup: ctx.cup, newRecord });
  }

  // ---------- loop ----------
  _frame(now) {
    requestAnimationFrame((t) => this._frame(t));
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.race) return;
    const race = this.race;
    if (this.state === 'race') {
      race.update(dt, this.input);
      this._handleEvents(race);
      this.renderer.updateCamera(race, dt);
      this.renderer.addEffects(race, dt);
      if (this.renderer.shake > 0) this.renderer.shake = Math.max(0, this.renderer.shake - dt * 2);
      this.audio.update(race.player, race.state !== 'countdown');
      if (race.state === 'finished') this._onRaceFinished();
    }
    if (this.state === 'race' || this.state === 'paused' || this.state === 'results') this.renderer.draw(race, this.ui);
  }

  _handleEvents(race) {
    const t = (k, ...a) => this.ui.t(k, ...a);
    for (const ev of race.events) {
      if (ev.type === 'go') this.audio.beep(880, 0.4, 0.3);
      if (ev.type === 'crash' && ev.car.isPlayer) { this.audio.thud(); this.renderer.shake = 1; }
      if (ev.type === 'lap' && ev.car.isPlayer) {
        const lt = ev.car.lapTimes[ev.car.lapTimes.length - 1];
        const isBest = ev.car.bestLap === lt && ev.car.lapTimes.length > 1;
        this.ui.flash = { text: t('lapDone', ev.car.lap, fmtTime(lt)), until: performance.now() + 2500, color: isBest ? '#b48cff' : '#fff' };
        this.audio.beep(isBest ? 1320 : 990, 0.12, 0.15);
      }
      if (ev.type === 'finish' && ev.car.isPlayer) this.audio.beep(660, 0.6, 0.3);
    }
    race.events.length = 0;
  }
}

window.addEventListener('DOMContentLoaded', () => { window.app = new App(); });
