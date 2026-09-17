// Race session: grid, countdown, simulation step, standings and results.
'use strict';

const DIFFICULTY = {
  // margin: corner-speed factor (1 = physical limit); pace: top-speed factor. Both scale with driver skill.
  easy:   { marginBase: 0.78, marginSpread: 0.10, paceBase: 0.86, paceSpread: 0.09 },
  medium: { marginBase: 0.85, marginSpread: 0.10, paceBase: 0.91, paceSpread: 0.07 },
  hard:   { marginBase: 0.90, marginSpread: 0.09, paceBase: 0.95, paceSpread: 0.05 },
};

const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

class Race {
  constructor(opts) {
    this.opts = opts;
    this.cat = categoryById(opts.classId);
    this.cls = modelById(opts.modelId) || modelsOf(this.cat.id)[0];   // player's model
    this.track = new Track(opts.trackDef, this.cat.roadScale || 1);
    this.mode = opts.mode || 'race';           // race | timetrial
    this.laps = opts.laps || this.track.laps;
    this.difficulty = DIFFICULTY[opts.difficulty] || DIFFICULTY.medium;
    this.time = 0;
    this.state = 'countdown';                  // countdown | racing | finishing | finished
    this.countdown = 3.6;
    this.finishTimer = 0;
    this.dt = 1 / 120;
    this.acc = 0;
    this.results = null;
    this.events = [];                          // transient events for sound/FX
    this._buildGrid();
  }

  _buildGrid() {
    const T = this.track, c = this.cls;
    const n = this.mode === 'timetrial' ? 1 : Math.max(2, Math.min(opts_n(this.opts, c), 12));
    const roster = this.opts.roster || makeRoster(n - 1, this.opts.playerLivery || 0, null, this.cat.id);
    const catModels = modelsOf(this.cat.id);
    this.cars = [];
    const gap = c.length * 2.2;
    for (let i = 0; i < n; i++) {
      const isPlayer = i === n - 1;
      const row = i; // player (last index) starts at the back
      const s = T.length - 8 - row * gap;
      const lat = (i % 2 === 0 ? 1 : -1) * Math.min(T.halfWidth * 0.45, c.width * 0.9);
      const ai = roster[i % roster.length];
      const model = isPlayer ? c : (modelById(ai.model) || catModels[i % catModels.length]);
      const car = new Car(T, model, {
        name: isPlayer ? (this.opts.playerName || 'Vous') : ai.name,
        livery: LIVERIES[isPlayer ? (this.opts.playerLivery || 0) : ai.livery],
        isPlayer,
        skill: isPlayer ? 1 : ai.skill,
        number: isPlayer ? 1 : 2 + i,
        s, lat,
      });
      car.laneTarget = lat;
      car.gridLat = lat;
      this.cars.push(car);
    }
    this.player = this.cars[this.cars.length - 1];
    if (this.mode === 'timetrial') {
      this.player.s = T.length - 40;
      this.player.lat = 0;
      this.player.laneTarget = 0;
      this.player.gridLat = 0;
    }
  }

  // input: { throttle: bool, sel: -1..1 } (a bare boolean is accepted for the throttle)
  update(frameDt, input) {
    if (typeof input !== 'object') input = { throttle: !!input, sel: this.player.sel };
    this.player.sel = clamp(input.sel == null ? 0 : input.sel, -1, 1);
    this.acc += Math.min(frameDt, 0.1);
    while (this.acc >= this.dt) {
      this._step(this.dt, !!input.throttle);
      this.acc -= this.dt;
    }
  }

  _step(dt, throttleInput) {
    if (this.state === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.state = 'racing';
        this.events.push({ type: 'go' });
        for (const car of this.cars) car.gridLat = null;
      }
      // allow revving but no motion
      for (const car of this.cars) car.throttle = car.isPlayer ? throttleInput : this.countdown < 1.2;
      return;
    }
    if (this.state === 'finished') return;
    this._simulate(dt, throttleInput);
    if (this.state === 'finishing') {
      this.finishTimer -= dt;
      if (this.finishTimer <= 0 || this.cars.every(c => c.finished)) this._finish();
    }
  }

  _simulate(dt, throttleInput) {
    const T = this.track;
    this.time += dt;
    // rubber-banding: slow leaders that are far ahead of the player, help stragglers a little
    const pp = this.player.progress;
    for (const car of this.cars) {
      car.steer(this.cars, dt, !car.isPlayer || !!this.opts.playerAI);
      let throttle;
      if (car.isPlayer) throttle = car.finished ? car.v < 15 : throttleInput;
      else {
        const gapM = car.progress - pp;
        const rubber = car.finished || this.player.finished ? 0 : clamp(-gapM / 4000, -0.05, 0.03);
        throttle = aiThrottle(car, this.cars, dt, { ...this.difficulty, rubber }) && !car.finished;
        if (car.finished) throttle = car.v < 15;
      }
      const wasOff = car.state === 'grass';
      const lapBefore = car.lap;
      car.update(dt, throttle, this.time);
      if (!wasOff && car.state === 'grass') this.events.push({ type: 'crash', car });
      if (car.lap !== lapBefore) {
        this.events.push({ type: 'lap', car });
        if (this.mode === 'race' && car.lap >= this.laps && !car.finished) {
          car.finished = true;
          car.finishTime = this.time;
          this.events.push({ type: 'finish', car });
          if (car.isPlayer && this.state === 'racing') { this.state = 'finishing'; this.finishTimer = 4; }
        }
      }
    }
    if (this.mode === 'race') resolveCollisions(this.cars, T);
  }

  standings() {
    return this.cars.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.progress - a.progress;
    });
  }

  positionOf(car) { return this.standings().indexOf(car) + 1; }

  _finish() {
    // fast-forward the rest of the field to the flag so everyone gets a real gap
    let extra = 0;
    while (!this.cars.every(c => c.finished) && extra < 180) { this._simulate(this.dt, false); extra += this.dt; }
    this.events.length = 0;
    this.state = 'finished';
    const order = this.standings();
    this.results = order.map((car, i) => ({
      car, pos: i + 1, points: POINTS[i] || 0,
      time: car.finished ? car.finishTime : null,
      bestLap: car.bestLap,
      gap: car.finished && order[0].finished ? car.finishTime - order[0].finishTime : null,
    }));
    return this.results;
  }

  endTimeTrial() {
    this.state = 'finished';
    this.results = [{ car: this.player, pos: 1, points: 0, time: null, bestLap: this.player.bestLap, gap: null }];
    return this.results;
  }
}

function opts_n(opts, cls) { return opts.nCars || cls.drivers; }

// AI drivers with a name, livery and skill. `seed` makes the roster reproducible (championships).
function makeRoster(count, playerLivery, seed, catId) {
  let rnd = Math.random;
  if (seed != null) { let x = seed * 9301 + 49297; rnd = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; }
  const names = AI_NAMES.slice(), liveries = LIVERIES.map((l, i) => i).filter(i => i !== playerLivery);
  for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
  for (let i = liveries.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [liveries[i], liveries[j]] = [liveries[j], liveries[i]]; }
  const out = [];
  const models = modelsOf(catId || CATEGORIES[0].id);
  for (let i = 0; i < count; i++) out.push({ name: names[i % names.length], livery: liveries[i % liveries.length], skill: (i / Math.max(1, count - 1)) * 0.8 + rnd() * 0.2, model: models.length ? models[Math.floor(rnd() * models.length)].id : null });
  return out;
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

if (typeof module !== 'undefined') module.exports = { Race, DIFFICULTY, POINTS, makeRoster };
