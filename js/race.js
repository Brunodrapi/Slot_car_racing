// Race session: grid, countdown, simulation step, standings and results.
'use strict';

/* margin: corner-speed factor (1 = the physical limit); pace: top-speed factor. Both scale with
   driver skill, and `aiThrottle` caps their sum at 0.98 — above 1 a driver does not go faster, he
   goes off.

   These three used to sit between 0.78 and 0.90 of the corner limit, which put barely seven per
   cent of race pace between the easiest setting and the hardest: a player could not feel the
   difference, which is the only thing a difficulty setting is for. They now span 0.70 to 0.93,
   and twelve per cent. Measured with `tools/diff.js`, on race pace rather than best lap, over the
   twelve circuits:

     facile     93,6 s au tour, 0,0 sortie par course
     moyen      87,0 s,         2,6
     difficile  82,0 s,         9,3

   Hard makes more mistakes than it used to, and that is the bargain: a field driving that close to
   the limit in traffic will put a wheel on the grass. It still laps five seconds quicker than the
   middle setting, so the mistakes are paid for several times over — and they are what gives the
   player a way past. */
const DIFFICULTY = {
  easy:   { marginBase: 0.70, marginSpread: 0.10, paceBase: 0.80, paceSpread: 0.08 },
  medium: { marginBase: 0.83, marginSpread: 0.09, paceBase: 0.90, paceSpread: 0.07 },
  hard:   { marginBase: 0.93, marginSpread: 0.06, paceBase: 0.99, paceSpread: 0.02 },
};

const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

// race state, as one number, for the snapshots sent over the wire
const STATE_CODE = { countdown: 0, racing: 1, finishing: 2, finished: 3 };
const STATE_NAME = ['countdown', 'racing', 'finishing', 'finished'];

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
    // reference speed profile of the player's car on each line, for the braking guide
    this.profiles = {};
    for (const name of LINE_NAMES) this.profiles[name] = speedProfile(this.track, this.cls, name, 0.98);
    this._buildGrid();
  }

  // `opts.humans` turns the grid into an online one: one seat per person, in the order the table
  // froze at kick-off, the last rows of the grid. Exactly one of them is `local` — the car this
  // screen drives. Without it nothing changes: one human at the back, the rest driven by the AI.
  _buildGrid() {
    const T = this.track, c = this.cls;
    const humans = this.opts.humans || null;
    const nh = humans ? humans.length : 1;
    const solo = this.mode === 'timetrial' && !humans;
    const n = solo ? 1
      : humans && !this.opts.aiFill ? nh
        : Math.max(nh + 1, Math.min(opts_n(this.opts, c), 12));
    const roster = this.opts.roster || makeRoster(n, this.opts.playerLivery || 0, null, this.cat.id);
    const catModels = modelsOf(this.cat.id);
    this.cars = [];
    const gap = c.length * 2.2;
    for (let i = 0; i < n; i++) {
      const hIdx = humans ? i - (n - nh) : (i === n - 1 ? 0 : -1);
      const h = hIdx >= 0 && humans ? humans[hIdx] : null;
      const isHuman = hIdx >= 0;
      const isPlayer = humans ? !!(h && h.local) : isHuman;
      const row = i;
      const s = T.length - 8 - row * gap;
      const lat = (i % 2 === 0 ? 1 : -1) * Math.min(T.halfWidth * 0.45, c.width * 0.9);
      const ai = roster[i % roster.length];
      const model = h ? (modelById(h.modelId) || c) : (isHuman ? c : (modelById(ai.model) || catModels[i % catModels.length]));
      const car = new Car(T, model, {
        name: h ? (h.name || 'Pilote') : isHuman ? (this.opts.playerName || 'Vous') : ai.name,
        livery: LIVERIES[(h ? h.livery : isHuman ? (this.opts.playerLivery || 0) : ai.livery) % LIVERIES.length],
        isPlayer,
        skill: isHuman ? 1 : ai.skill,
        number: isHuman ? 1 + (hIdx || 0) : 2 + i,
        s, lat,
      });
      car.human = isHuman && humans ? hIdx : null;   // seat number in the online grid
      car.laneTarget = lat;
      car.gridLat = lat;
      this.cars.push(car);
    }
    this.player = this.cars.find(c2 => c2.isPlayer) || this.cars[this.cars.length - 1];
    this.netInput = [];                              // seat -> { thr, sel } received over the wire
    if (solo) {
      this.player.place(T.length - 40, 0);
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
      for (const car of this.cars) {
        const net = car.human != null && !car.isPlayer ? this.netInput[car.human] : null;
        car.throttle = car.isPlayer ? throttleInput : net ? !!net.thr : this.countdown < 1.2;
      }
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
      // The third argument is "let the AI pick the line". A person's car never does, wherever
      // that person is sitting.
      car.steer(this.cars, dt, car.human == null && !car.isPlayer ? true : !!this.opts.playerAI);
      let throttle;
      if (car.isPlayer) throttle = car.finished ? car.v < 15 : throttleInput;
      else if (car.human != null) {
        // Another person's car: their throttle and their line come over the wire. Nothing is
        // predicted — this only ever runs on the host, which is the one simulating.
        const net = this.netInput[car.human] || { thr: false, sel: 0 };
        car.sel = clamp(net.sel || 0, -1, 1);
        throttle = car.finished ? car.v < 15 : !!net.thr;
      } else {
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
    if (this.mode === 'race' && !this.opts.noContact) resolveCollisions(this.cars, T);
  }

  /* ------------------------------------------------------------------ online: host and guest

  The host simulates and publishes; the guests replay what they receive and send back only their
  own two numbers. Nothing is predicted on a guest, so nothing can disagree: what you see is the
  host's race, a fraction of a second old.
  */

  // A flat array, because it is sent as JSON thirty times a second and the field names would cost
  // more than the numbers. Coordinates to the centimetre, angles to the milliradian.
  snapshot(seq) {
    const out = [seq, Math.round(this.time * 100), STATE_CODE[this.state] || 0, Math.round(this.countdown * 100)];
    for (const c of this.cars) {
      out.push(
        Math.round(c.x * 100), Math.round(c.y * 100), Math.round(c.th * 1000),
        Math.round(c.v * 100), Math.round(c.vl * 100), Math.round(c.w * 1000),
        Math.round(c.s * 100), Math.round(c.lat * 100), c.lap,
        Math.round(c.sel * 100), Math.round(c.selS * 100),
        (c.state === 'grass' ? 1 : 0) | (c.finished ? 2 : 0) | (c.throttle ? 4 : 0) | (c.braking ? 8 : 0),
        Math.round((c.bestLap || 0) * 1000), Math.round((c.lapStart || 0) * 100),
      );
    }
    return out;
  }

  // Applied whole. A car is placed, not nudged: the guest holds no opinion about where it should
  // be, so there is nothing to reconcile.
  applySnapshot(snap) {
    if (!Array.isArray(snap) || snap.length < 4) return false;
    const per = 14;
    if (snap.length < 4 + this.cars.length * per) return false;
    this.time = snap[1] / 100;
    this.state = STATE_NAME[snap[2]] || this.state;
    this.countdown = snap[3] / 100;
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i], o = 4 + i * per;
      c.x = snap[o] / 100; c.y = snap[o + 1] / 100; c.th = snap[o + 2] / 1000;
      c.v = snap[o + 3] / 100; c.vl = snap[o + 4] / 100; c.w = snap[o + 5] / 1000;
      c.s = snap[o + 6] / 100; c.lat = snap[o + 7] / 100; c.lap = snap[o + 8];
      c.sel = snap[o + 9] / 100; c.selS = snap[o + 10] / 100;
      const f = snap[o + 11];
      c.state = (f & 1) ? 'grass' : 'ok';
      c.finished = !!(f & 2);
      c.throttle = !!(f & 4);
      c.braking = !!(f & 8);
      c.started = c.lap > 0 || c.started;
      c.bestLap = snap[o + 12] ? snap[o + 12] / 1000 : c.bestLap;
      c.lapStart = snap[o + 13] / 100;
      c.gridLat = this.state === 'countdown' ? c.gridLat : null;
    }
    return true;
  }

  // Snapshots arrive thirty times a second and the screen draws sixty: between two of them the
  // cars are carried forward along their own velocity. It is not a prediction of what the host
  // will decide, only a refusal to let the picture stand still.
  extrapolate(dt) {
    if (this.state !== 'racing' && this.state !== 'finishing') return;
    const d = Math.min(dt, 0.12);
    for (const c of this.cars) {
      const cos = Math.cos(c.th), sin = Math.sin(c.th);
      c.x += (c.v * cos - c.vl * sin) * d;
      c.y += (c.v * sin + c.vl * cos) * d;
      c.th = wrapAngle(c.th + c.w * d);
    }
    this.time += d;
  }

  // reference speed at s on the line selected by `sel` (-1 inside .. +1 outside)
  profileAt(s, sel) {
    const i = this.track.idx(s), r = this.profiles.racing[i];
    if (sel < 0) return r + (this.profiles.inside[i] - r) * Math.min(1, -sel);
    return r + (this.profiles.outside[i] - r) * Math.min(1, sel);
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
