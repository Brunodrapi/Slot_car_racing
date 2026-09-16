// A car on the slot: it follows the track centreline with a lateral offset.
// One input: throttle on/off. Everything else (line, overtaking) is automatic,
// but physics decides whether the car stays on the road.
'use strict';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

class Car {
  constructor(track, cls, opts) {
    this.track = track;
    this.cls = cls;
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
    this.grace = 0;       // seconds of invulnerability after a spin
    this.crashes = 0;

    this.laneTarget = 0;
    this.passSide = 0;
    this.passTimer = 0;

    this.started = false;
    this.lap = 0;
    this.lapTimes = [];
    this.bestLap = null;
    this.lapStart = 0;
    this.finished = false;
    this.finishTime = null;
    this.throttle = false;
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
    if (k - c.df > 1e-6) {
      const vc = Math.sqrt(c.grip / (k - c.df));
      return Math.min(vc, capped);
    }
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
    // slide along the edge then come back onto the road
    const edge = T.halfWidth + 1.5;
    const target = t < 0.5 ? this.spinSide * edge : this.spinSide * (T.halfWidth - this.cls.width / 2 - 0.5);
    this.lat += (target - this.lat) * Math.min(1, 6 * dt);
    this._advance(this.v * dt, raceTime);
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
      // crossed the line
      if (this.started) {
        const lt = raceTime - this.lapStart;
        this.lapTimes.push(lt);
        if (this.bestLap == null || lt < this.bestLap) this.bestLap = lt;
        this.lap++;
      } else {
        this.started = true;
      }
      this.lapStart = raceTime;
    }
    this.s = T.wrap(after);
  }

  update(dt, throttle, raceTime) {
    const T = this.track, c = this.cls;
    this.throttle = throttle;
    if (this.grace > 0) this.grace -= dt;
    if (this.state === 'spin') { this._updateSpin(dt, raceTime); return; }

    // longitudinal
    let a;
    if (throttle) a = c.accel * Math.max(0, 1 - Math.pow(this.v / c.vmax, 2.5));
    else a = -c.brake * (this.v > 1 ? 1 : this.v);
    this.v = Math.max(0, this.v + a * dt);

    // lateral: cornering demand vs grip
    const k = T.curvAt(this.s);
    const need = this.v * this.v * Math.abs(k);
    const grip = this.gripAt(this.v);
    const excess = need - grip;
    const halfW = T.halfWidth;
    const limit = halfW - c.width / 2 - 0.2;
    const target = clamp(this.laneTarget, -limit, limit);

    let auth = 1;
    if (excess > 0) {
      this.slide = Math.min(1, excess / grip);
      // the further over the limit, the more the slide feeds itself
      this.vl += Math.sign(k) * excess * c.slide * 3 * (1 + this.slide * 6) * dt;
      this.v = Math.max(0, this.v - excess * 0.8 * dt); // tyre scrub
      auth = Math.max(0, 1 - this.slide * 3);
    } else {
      this.slide = Math.max(0, this.slide - 3 * dt);
    }
    const spring = c.laneK, damp = 2 * Math.sqrt(spring) * 0.9;
    this.vl += ((target - this.lat) * spring - this.vl * damp) * auth * dt;
    this.vl = clamp(this.vl, -20, 20);
    this.lat += this.vl * dt;

    // visual yaw: drift angle
    const yawTarget = clamp(this.vl / Math.max(6, this.v) * 1.2, -0.6, 0.6) + Math.sign(k) * this.slide * 0.35;
    this.yaw += (yawTarget - this.yaw) * Math.min(1, 10 * dt);

    if (Math.abs(this.lat) > halfW) {
      if (this.grace > 0) {
        this.lat = clamp(this.lat, -limit, limit);
        this.vl = 0;
      } else {
        this.crash();
        return;
      }
    }

    this._advance(this.v * dt, raceTime);
  }

  // decide where on the road we want to be (racing line + overtaking)
  steer(cars, dt) {
    const T = this.track, c = this.cls;
    const look = Math.max(12, this.v * 0.8);
    const kA = T.curvAhead(this.s, look);
    const limit = T.halfWidth - c.width / 2 - 0.3;
    const line = -Math.sign(kA) * Math.min(1, Math.abs(kA) * 55) * limit * 0.75;

    let blocker = null, bd = Infinity;
    const range = c.length * 2.5 + this.v * 0.9;
    for (const o of cars) {
      if (o === this) continue;
      const d = T.diff(this.s, o.s);
      if (d <= 0 || d > range || d >= bd) continue;
      if (o.v > this.v + 2.5 && d > c.length * 1.5) continue; // faster car: no need to dodge
      if (Math.abs(o.lat - this.lat) < (c.width + o.cls.width) * 0.75 + 0.4) { blocker = o; bd = d; }
    }
    this.passTimer -= dt;
    if (blocker) {
      if (this.passSide === 0 || this.passTimer <= 0) {
        const roomL = limit - blocker.lat, roomR = blocker.lat + limit;
        // prefer the inside of the corner ahead when there is room
        const inside = -Math.sign(kA) || 1;
        let side = roomL > roomR ? 1 : -1;
        if (Math.abs(roomL - roomR) < 1.5) side = inside;
        this.passSide = side;
        this.passTimer = 1.5 + Math.random();
      }
      const gap = (c.width + blocker.cls.width) / 2 + 0.7;
      let want = blocker.lat + this.passSide * gap;
      if (Math.abs(want) > limit) {
        this.passSide = -this.passSide;
        want = blocker.lat + this.passSide * gap;
      }
      this.laneTarget = clamp(want, -limit, limit);
      this.blocker = blocker;
    } else {
      this.passSide = 0;
      this.laneTarget = line;
      this.blocker = null;
    }
  }
}

// AI: brake for the tightest corner reachable, with a skill-dependent margin.
function aiThrottle(car, cars, dt, opts) {
  const c = car.cls, T = car.track;
  car.aiTimer -= dt;
  if (car.aiTimer <= 0) {
    car.aiTimer = 0.12;
    car.aiNoise = (Math.random() - 0.5) * 0.03;
    const margin = (opts.marginBase + car.skill * opts.marginSpread) + car.aiNoise + (opts.rubber || 0);
    const brake = c.brake * 0.88;
    const v = car.v;
    let allow = c.vmax;
    const maxD = v * v / (2 * brake) + 40;
    for (let d = 0; d < maxD; d += 3) {
      const k = Math.abs(T.curvAt(car.s + d));
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
      if (d > 0 && d < c.length * 1.3 + v * 0.18 && Math.abs(o.lat - car.lat) < (c.width + o.cls.width) * 0.6) {
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
      const d = track.diff(a.s, b.s); // b relative to a
      const lenSum = (a.cls.length + b.cls.length) / 2;
      if (Math.abs(d) >= lenSum) continue;
      const dl = b.lat - a.lat;
      const wSum = (a.cls.width + b.cls.width) / 2;
      if (Math.abs(dl) >= wSum) continue;
      // decide whether it's a nose-to-tail or side contact
      const longOverlap = lenSum - Math.abs(d);
      const latOverlap = wSum - Math.abs(dl);
      if (longOverlap < latOverlap * 2.2) {
        // rear-ends: rear car slows, front gets a shove
        const rear = d > 0 ? a : b, front = d > 0 ? b : a;
        if (rear.v > front.v) {
          const dv = rear.v - front.v;
          front.v += dv * 0.35;
          rear.v = front.v - dv * 0.1;
          const push = d > 0 ? -1 : 1;
          const half = longOverlap / 2;
          a.s = track.wrap(a.s + push * half);
          b.s = track.wrap(b.s - push * half);
        }
      } else {
        const dir = dl >= 0 ? 1 : -1;
        const limit = track.halfWidth - 0.3;
        a.lat = clamp(a.lat - dir * latOverlap / 2, -limit, limit);
        b.lat = clamp(b.lat + dir * latOverlap / 2, -limit, limit);
        a.vl -= dir * 1.5;
        b.vl += dir * 1.5;
        // slight speed loss for both
        a.v *= 0.995; b.v *= 0.995;
      }
    }
  }
}

if (typeof module !== 'undefined') module.exports = { Car, aiThrottle, resolveCollisions, clamp };
