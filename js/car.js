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
    this.vl = 0;          // lateral speed (m/s)
    this.yaw = 0;         // visual drift angle
    this.slide = 0;       // 0..1 how far over the limit
    this.state = 'ok';    // ok | spin
    this.spinT = 0;
    this.spinAngle = 0;
    this.spinSide = 1;
    this.grace = 0;
    this.crashes = 0;

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
  get pos() { return this.track.pos(this.s, this.lat); }
  get heading() {
    let h = this.track.headingAt(this.s) + this.yaw;
    if (this.state === 'spin') h += this.spinAngle;
    return h;
  }
  // demand / grip ratio on the current line (1 = limit)
  get loadRatio() {
    const k = Math.abs(this.track.curvAtLat(this.s, this.lat));
    return this.v * this.v * k / this.gripAt(this.v);
  }

  crash() {
    if (this.state === 'spin') return;
    this.state = 'spin';
    this.spinT = 0;
    this.spinAngle = 0;
    this.spinSide = Math.sign(this.lat) || 1;
    this.spinDir = (Math.random() < 0.5 ? -1 : 1);
    this.v = Math.min(this.v * 0.55, 16);
    this.vl = 0;
    this.crashes++;
    this.slide = 0;
  }

  _updateSpin(dt, raceTime) {
    const T = this.track;
    const dur = 1.3;
    this.spinT += dt;
    const t = Math.min(1, this.spinT / dur);
    this.spinAngle = this.spinDir * t * Math.PI * 2 * 1.5;
    this.v = Math.max(3, this.v - 22 * dt);
    const hw = this.spinSide > 0 ? T.hwLeftAt(this.s) : T.hwRightAt(this.s);
    const target = t < 0.5 ? this.spinSide * (hw + 1.5) : this.spinSide * (hw - this.cls.width / 2 - 0.5);
    this.lat += (target - this.lat) * Math.min(1, 6 * dt);
    this._advance(this.v * dt * T.advanceFactor(this.s, this.lat), raceTime);
    if (this.spinT >= dur) {
      this.state = 'ok';
      this.spinAngle = 0;
      this.grace = 1.0;
      this.yaw = 0;
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
    if (this.state === 'spin') { this._updateSpin(dt, raceTime); return; }

    // longitudinal
    const vmax = c.vmax * (this.draft ? 1.05 : 1);
    let a;
    if (throttle) a = c.accel * Math.max(0, 1 - Math.pow(this.v / vmax, 2.5)) * (this.draft ? 1.08 : 1);
    else a = -c.brake * (this.v > 1 ? 1 : this.v);
    this.v = Math.max(0, this.v + a * dt);

    // lateral: cornering demand on our actual line vs grip
    const k = T.curvAtLat(this.s, this.lat);
    const need = this.v * this.v * Math.abs(k);
    const grip = this.gripAt(this.v);
    const excess = need - grip;
    const hwL = T.hwLeftAt(this.s), hwR = T.hwRightAt(this.s);
    const target = clamp(this.laneTarget, -(hwR - c.width / 2 - 0.2), hwL - c.width / 2 - 0.2);

    let auth = 1;
    if (excess > 0) {
      this.slide = Math.min(1, excess / grip);
      this.vl += Math.sign(k) * excess * c.slide * 3 * (1 + this.slide * 6) * dt;   // pushed outwards
      this.v = Math.max(0, this.v - excess * 0.8 * dt);                              // tyre scrub
      auth = Math.max(0, 1 - this.slide * 3);
    } else {
      this.slide = Math.max(0, this.slide - 3 * dt);
    }
    const spring = c.laneK, damp = 2 * Math.sqrt(spring) * 0.9;
    this.vl += ((target - this.lat) * spring - this.vl * damp) * auth * dt;
    this.vl = clamp(this.vl, -20, 20);
    this.lat += this.vl * dt;

    const yawTarget = clamp(this.vl / Math.max(6, this.v) * 1.2, -0.6, 0.6) + Math.sign(k) * this.slide * 0.35;
    this.yaw += (yawTarget - this.yaw) * Math.min(1, 10 * dt);

    if (this.lat > hwL || this.lat < -hwR) {
      if (this.grace > 0) { this.lat = clamp(this.lat, -(hwR - 1), hwL - 1); this.vl = 0; }
      else { this.crash(); return; }
    }

    this._advance(this.v * dt * T.advanceFactor(this.s, this.lat), raceTime);
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
        a.vl -= dir * 1.5;
        b.vl += dir * 1.5;
        a.v *= 0.995; b.v *= 0.995;
      }
    }
  }
}

if (typeof module !== 'undefined') module.exports = { Car, aiThrottle, resolveCollisions };
