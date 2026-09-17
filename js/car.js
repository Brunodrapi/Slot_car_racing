// A car on the slot: it follows one of the track's three lines (inside / racing / outside),
// selected with `sel` in [-1, 1]. One button drives the throttle; physics decides whether
// the car stays on the road.
'use strict';

class Car {
  constructor(track, model, opts) {
    this.track = track;
    this.cls = model;               // car model (stats + drawing info)
    this.name = opts.name || 'Driver';
    this.livery = opts.livery;
    this.isPlayer = !!opts.isPlayer;
    this.skill = opts.skill == null ? 0.5 : opts.skill;
    this.number = opts.number || 1;

    this.s = opts.s || 0;
    this.lat = opts.lat || 0;
    this.v = 0;
    this.vl = 0;          // drift angle rate (rad/s)
    this.drift = 0;       // drift angle (rad) between body and slot direction (+ = tail out to the left)
    this.slide = 0;       // 0..1 how far the tail is out
    this.laneAng = 0;     // heading offset from lane changes
    this.rx = 0; this.ry = 0;   // rear point (world), derived
    this._initRear();
    this.state = 'ok';    // ok | grass
    this.grassT = 0;
    this.offSide = 1;
    this.wobble = 0;
    this.grace = 0;
    this.crashes = 0;     // number of excursions

    this.sel = 0;         // line selection: -1 inside, 0 racing, +1 outside
    this.laneTarget = 0;
    this.gridLat = null;  // fixed lateral position until the start
    this.passSide = 0;
    this.passTimer = 0;
    this.blocker = null;
    this.draft = false;

    this.started = false;
    this.lap = 0;
    this.lapTimes = [];
    this.bestLap = null;
    this.lapStart = 0;
    this.finished = false;
    this.finishTime = null;
    this.throttle = false;
    this.offT = 0;
    this.braking = false;
    this.aiTimer = Math.random() * 0.15;
    this.aiNoise = 0;
    this.aiAllow = Infinity;
  }

  gripAt(v) {
    const c = this.cls;
    return c.grip + Math.min(c.df * v * v, c.grip * 1.8);
  }

  // corner speed for curvature magnitude k (accounts for downforce)
  cornerSpeed(k) {
    const c = this.cls;
    if (k < 1e-5) return Infinity;
    const capped = Math.sqrt(2.8 * c.grip / k);
    if (k - c.df > 1e-6) return Math.min(Math.sqrt(c.grip / (k - c.df)), capped);
    return capped;
  }

  get progress() {
    return (this.lap - (this.started ? 0 : 1)) * this.track.length + this.track.wrap(this.s);
  }
  _initRear() { this.vl = 0; this.drift = 0; this.laneAng = 0; this._placeRear(); }
  // rear point from the pin, the slot direction and the drift angle
  _placeRear() {
    const P = this.pin, h = this.track.headingAt(this.s) + this.laneAng + this.drift, L = this.cls.length * 0.75;
    this.rx = P.x - Math.cos(h) * L; this.ry = P.y - Math.sin(h) * L;
  }
  get pin() { return this.track.pos(this.s, this.lat); }
  // body centre: halfway between the front pin and the rear point
  get pos() { const P = this.pin; return { x: (P.x + this.rx) / 2, y: (P.y + this.ry) / 2 }; }
  get heading() { return this.track.headingAt(this.s) + this.laneAng + this.drift + this.wobble; }
  // front wheels point along the slot: counter-steer relative to the body (visual)
  get steerAngle() { return clamp(-this.drift, -0.6, 0.6); }
  // demand / grip ratio on the current line (1 = limit)
  get loadRatio() {
    const k = Math.abs(this.track.curvAtLat(this.s, this.lat));
    return this.v * this.v * k / this.gripAt(this.v);
  }

  // Pico Rally style excursion: the car runs on the grass, scrubs speed, then rejoins the road.
  crash() {
    if (this.state === 'grass') return;
    this.state = 'grass';
    this.grassT = 0;
    this.offSide = Math.sign(this.lat) || 1;
    this.v *= 0.85;
    this.vl = 0;
    this.crashes++;
    this.slide = 0;
    // the pin leaves the slot on the side the tail was swinging to
    if (Math.abs(this.drift) > 0.3) this.offSide = Math.sign(this.drift);
  }

  _updateGrass(dt, raceTime) {
    const T = this.track, c = this.cls;
    this.grassT += dt;
    this.v = Math.max(0, this.v - (9 + this.v * 0.18) * dt);
    const hw = this.offSide > 0 ? T.hwLeftAt(this.s) : T.hwRightAt(this.s);
    const target = this.offSide * (hw + c.width * 0.6);
    this.lat += (target - this.lat) * Math.min(1, 5 * dt);
    this.wobble = Math.sin(this.grassT * 25) * 0.12 * Math.min(1, this.v / 20);
    this._advance(this.v * dt * T.advanceFactor(this.s, this.lat), raceTime);
    this.drift *= Math.max(0, 1 - 2 * dt);
    this._placeRear();
    if (this.grassT > 1.1 || this.v < 8) {
      this.state = 'ok';
      this.wobble = 0;
      this.grace = 0.8;
      this.lat = this.offSide * (hw - c.width / 2 - 0.4);
      this._initRear();
    }
  }

  _advance(ds, raceTime) {
    const T = this.track;
    const before = T.wrap(this.s);
    const after = before + ds;
    if (after >= T.length) {
      if (this.started) {
        const lt = raceTime - this.lapStart;
        this.lapTimes.push(lt);
        if (this.bestLap == null || lt < this.bestLap) this.bestLap = lt;
        this.lap++;
      } else this.started = true;
      this.lapStart = raceTime;
    }
    this.s = T.wrap(after);
  }

  update(dt, throttle, raceTime) {
    const T = this.track, c = this.cls;
    this.throttle = throttle;
    this.offT = throttle ? 0 : this.offT + dt;
    this.braking = !throttle && this.offT > 0.15 && this.v > 2;
    if (this.grace > 0) this.grace -= dt;
    if (this.state === 'grass') { this._updateGrass(dt, raceTime); return; }

    // longitudinal
    const vmax = c.vmax * (this.draft ? 1.05 : 1);
    let a;
    if (throttle) a = c.accel * Math.max(0, 1 - Math.pow(this.v / vmax, 2.5)) * (this.draft ? 1.08 : 1);
    else a = -c.brake * (this.v > 1 ? 1 : this.v);
    this.v = Math.max(0, this.v + a * dt);

    // --- front pin: follows the selected line (lane changes are gentle, speed-limited) ---
    const hwL = T.hwLeftAt(this.s), hwR = T.hwRightAt(this.s);
    const target = clamp(this.laneTarget, -(hwR - c.width / 2 - 0.2), hwL - c.width / 2 - 0.2);
    const maxLat = 1.2 + this.v * 0.1;
    const move = clamp((target - this.lat) * 3, -maxLat, maxLat);
    this.lat += move * dt;
    if (this.lat > hwL + c.width * 0.35 || this.lat < -(hwR + c.width * 0.35)) {
      if (this.grace > 0) this.lat = clamp(this.lat, -(hwR - 1), hwL - 1);
      else { this.crash(); return; }
    }
    this._advance(this.v * dt * T.advanceFactor(this.s, this.lat), raceTime);

    // heading offset from the lane change itself (the pin moves sideways while advancing)
    this.laneAng += (Math.atan2(move, Math.max(3, this.v)) - this.laneAng) * Math.min(1, 8 * dt);

    // --- tail: swings out when the lateral force beats the rear grip, PID-like return otherwise ---
    const k = T.curvAtLat(this.s, this.lat);
    const demand = this.v * this.v * Math.abs(k);
    const grip = this.gripAt(this.v);
    const over = demand / grip - 1.03;                    // >0: past the limit (3% dead band)
    let acc;
    if (over > 0) {
      // tail swings to the outside of the corner (left for a right-hander): the more over, the faster
      acc = Math.sign(k) * over * 2.4 * c.slide - this.vl * 1.5;
    } else {
      // grip to spare: bring the tail back, critically damped, harder with more spare grip
      const spare = Math.min(1, -over * 2 + 0.15);
      const kp = 14 * spare, kd = 2 * Math.sqrt(14) * Math.max(0.5, spare);
      acc = -kp * this.drift - kd * this.vl;
    }
    this.vl += acc * dt;
    this.drift += this.vl * dt;
    // sideways sliding scrubs speed
    if (Math.abs(this.drift) > 0.05) this.v = Math.max(0, this.v - grip * Math.sin(Math.min(1.2, Math.abs(this.drift))) * 0.35 * dt);
    this.slide = clamp(Math.abs(this.drift) / 0.5, 0, 1);
    this._placeRear();

    // de-slot: tail too far out, or the rear off the road
    const i = T.idx(this.s);
    const latR = (this.rx - T.xs[i]) * T.nx[i] + (this.ry - T.ys[i]) * T.ny[i];
    if (Math.abs(this.drift) > 0.95 || latR > hwL + 0.9 || latR < -(hwR + 0.9)) {
      if (this.grace <= 0) { this.crash(); return; }
    }
  }

  // where we want to be laterally: our selected line, plus AI overtaking decisions
  steer(cars, dt, ai) {
    const T = this.track, c = this.cls;
    if (this.gridLat != null) { this.laneTarget = this.gridLat; return; }

    // nearest car ahead that we are catching
    let blocker = null, bd = Infinity;
    const range = c.length * 3 + this.v * 1.0;
    for (const o of cars) {
      if (o === this) continue;
      const d = T.diff(this.s, o.s);
      if (d <= 0 || d > range || d >= bd) continue;
      if (o.v > this.v + 2.5 && d > c.length * 1.5) continue;
      if (Math.abs(o.lat - this.lat) < (c.width + o.cls.width) * 0.75 + 0.4) { blocker = o; bd = d; }
    }
    this.blocker = blocker;
    this.draft = !!blocker && bd < c.length * 3.5 && Math.abs(blocker.lat - this.lat) < c.width * 0.9;

    if (ai) {
      this.passTimer -= dt;
      if (blocker) {
        if (this.passSide === 0 || this.passTimer <= 0) {
          // pick the line (inside or outside) with the most room from the blocker and other cars
          const cand = [-1, 1].map(sel => {
            const lat = T.targetLat(this.s + 15, sel);
            let room = Math.abs(lat - blocker.lat);
            for (const o of cars) { if (o === this || o === blocker) continue; const d = T.diff(this.s, o.s); if (d > -c.length * 2 && d < 40) room = Math.min(room, Math.abs(lat - o.lat)); }
            return { sel, room };
          });
          cand.sort((a, b) => b.room - a.room);
          const best = cand[0];
          if (best.room > c.width * 0.9) this.passSide = best.sel;
          else this.passSide = 0;                       // no room: stay behind for now
          this.passTimer = 2 + Math.random() * 1.5;
        }
        this.sel = this.passSide;
      } else if (this.passSide !== 0 && this.passTimer <= 0) {
        this.passSide = 0; this.sel = 0;
      } else if (!blocker && this.passSide === 0) this.sel = 0;
    }
    this.laneTarget = T.targetLat(this.s, this.sel);
  }
}

// AI: brake for the tightest corner reachable along its line, with a skill-dependent margin.
function aiThrottle(car, cars, dt, opts) {
  const c = car.cls, T = car.track;
  car.aiTimer -= dt;
  if (car.aiTimer <= 0) {
    car.aiTimer = 0.12;
    car.aiNoise = (Math.random() - 0.5) * 0.03;
    const margin = (opts.marginBase + car.skill * opts.marginSpread) + car.aiNoise + (opts.rubber || 0);
    const brake = c.brake * 0.88;
    const v = car.v;
    let allow = c.vmax * Math.min(1, (opts.paceBase == null ? 1 : opts.paceBase + car.skill * opts.paceSpread) + (opts.rubber || 0));
    const maxD = v * v / (2 * brake) + 40;
    for (let d = 0; d < maxD; d += 3) {
      const lat = d < 6 ? car.lat : T.targetLat(car.s + d, car.sel);
      const k = Math.abs(T.curvAtLat(car.s + d, lat));
      if (k < 1e-4) continue;
      const vc = car.cornerSpeed(k) * margin;
      if (vc >= c.vmax) continue;
      const a = Math.sqrt(vc * vc + 2 * brake * d);
      if (a < allow) allow = a;
    }
    // don't ram the car ahead
    for (const o of cars) {
      if (o === car) continue;
      const d = T.diff(car.s, o.s);
      if (d > 0 && d < c.length * 1.2 + v * 0.15 && Math.abs(o.lat - car.lat) < (c.width + o.cls.width) * 0.5 + 0.3) {
        if (o.v + 0.5 < allow) allow = Math.min(allow, o.v + 0.5);
      }
    }
    car.aiAllow = allow;
  }
  return car.v < car.aiAllow - 0.3;
}

// car-to-car contact
function resolveCollisions(cars, track) {
  const n = cars.length;
  for (let i = 0; i < n; i++) {
    const a = cars[i];
    for (let j = i + 1; j < n; j++) {
      const b = cars[j];
      const d = track.diff(a.s, b.s);
      const lenSum = (a.cls.length + b.cls.length) / 2;
      if (Math.abs(d) >= lenSum) continue;
      const dl = b.lat - a.lat;
      const wSum = (a.cls.width + b.cls.width) / 2;
      if (Math.abs(dl) >= wSum) continue;
      const longOverlap = lenSum - Math.abs(d);
      const latOverlap = wSum - Math.abs(dl);
      if (longOverlap < latOverlap * 2.2) {
        const rear = d > 0 ? a : b, front = d > 0 ? b : a;
        if (rear.v > front.v) {
          const dv = rear.v - front.v;
          front.v += dv * 0.35;
          rear.v = front.v - dv * 0.1;
          const push = d > 0 ? -1 : 1, half = longOverlap / 2;
          a.s = track.wrap(a.s + push * half);
          b.s = track.wrap(b.s - push * half);
        }
      } else {
        const dir = dl >= 0 ? 1 : -1;
        const hwLa = track.hwLeftAt(a.s) - 0.3, hwRa = track.hwRightAt(a.s) - 0.3;
        const hwLb = track.hwLeftAt(b.s) - 0.3, hwRb = track.hwRightAt(b.s) - 0.3;
        a.lat = clamp(a.lat - dir * latOverlap / 2, -hwRa, hwLa);
        b.lat = clamp(b.lat + dir * latOverlap / 2, -hwRb, hwLb);
        // a small tail kick, capped so a rubbing pack never builds up a slide
        a.vl = clamp(a.vl - dir * 0.08, -0.8, 0.8);
        b.vl = clamp(b.vl + dir * 0.08, -0.8, 0.8);
        a.v *= 0.995; b.v *= 0.995;
      }
    }
  }
}

if (typeof module !== 'undefined') module.exports = { Car, aiThrottle, resolveCollisions };
