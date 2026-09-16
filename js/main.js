// App: game loop, input, flow between menus and races, career progression.
'use strict';

class App {
  constructor() {
    this.save = loadSave();
    this.canvas = document.getElementById('game');
    this.renderer = new Renderer(this.canvas);
    this.audio = new GameAudio();
    this.audio.enabled = this.save.sound;
    this.ui = new UI(this);
    this.tracks = new Map();
    this.race = null;
    this.raceCtx = null;
    this.state = 'menu';
    this.input = { throttle: false };
    this.last = performance.now();
    this._bindInput();
    window.addEventListener('resize', () => { this.renderer.resize(); if (this.race) this.renderer._makeMinimap(); });
    this.ui.menu();
    requestAnimationFrame((t) => this._frame(t));
  }

  trackCache(id) {
    if (!this.tracks.has(id)) this.tracks.set(id, new Track(TRACKS.find(t => t.id === id)));
    return this.tracks.get(id);
  }

  playerName() { return this.save.name || this.ui.t('playerDefault'); }

  // ---------- input ----------
  _bindInput() {
    const on = () => { this.input.throttle = true; this.audio.start(); this.audio.resume(); };
    const off = () => { this.input.throttle = false; };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { this.togglePause(); return; }
      if (this.state !== 'race') return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      e.preventDefault();
      on();
    });
    window.addEventListener('keyup', (e) => { if (e.key !== 'Escape') off(); });
    window.addEventListener('blur', off);
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => { if (this.state === 'race') { e.preventDefault(); on(); } });
    window.addEventListener('pointerup', off);
    window.addEventListener('pointercancel', off);
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
    const trackDef = TRACKS.find(t => t.id === trackId), cls = carClassById(classId);
    this._startRace({
      mode, trackDef, classId,
      laps: lapsFor(trackDef, cls),
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
    const trackDef = TRACKS.find(t => t.id === cup.tracks[idx]), cls = carClassById(cup.classId);
    const seed = CUPS.indexOf(cup) * 101 + 7;
    const roster = makeRoster(cls.drivers - 1, this.save.livery, seed);
    this._startRace({
      mode: 'race', trackDef, classId: cup.classId,
      laps: lapsFor(trackDef, cls),
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
    this.ui.hide();
    this.ui.flash = null;
    this.last = performance.now();
  }

  retry() {
    if (!this.raceOpts) return;
    this._startRace(this.raceOpts, this.raceCtx);
  }

  togglePause() {
    if (this.state === 'race') {
      this.state = 'paused';
      this.input.throttle = false;
      this.audio.idle();
      this.ui.pauseScreen(this.race);
    } else if (this.state === 'paused') {
      this.resume();
    }
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
    // best lap record
    const key = `${race.track.id}|${race.cls.id}`;
    let newRecord = false;
    if (race.player.bestLap != null && (save.bestLaps[key] == null || race.player.bestLap < save.bestLaps[key])) {
      save.bestLaps[key] = race.player.bestLap;
      newRecord = true;
    }
    save.racesDone++;
    // career points
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
      race.update(dt, this.input.throttle);
      this._handleEvents(race);
      this.renderer.updateCamera(race, dt);
      this.renderer.addEffects(race, dt);
      if (this.renderer.shake > 0) this.renderer.shake = Math.max(0, this.renderer.shake - dt * 2);
      this.audio.update(race.player, race.state !== 'countdown');
      if (race.state === 'finished') { this._onRaceFinished(); }
    }
    if (this.state === 'race' || this.state === 'paused' || this.state === 'results') {
      this.renderer.draw(race, this.ui);
    }
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
