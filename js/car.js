// Vehicle model. The car is a free body: it has a heading (where it points) and a velocity
// (where it goes), and the two only coincide while the tyres have grip to spare.
//
//   track line  →  desired steering (pure pursuit)  →  yaw acceleration  →  yaw rate  →  heading
//
// The line is an intention. The autopilot only produces a steering angle; position and rotation
// always come out of the physics. Past the limit the car understeers first (it turns less than
// asked and runs wide), the tyres let go progressively, and grip comes back progressively too.
// Nothing is ever snapped back onto the line, on or off the road.
'use strict';

// Fastest speed for curvature magnitude k on a given model (accounts for downforce).
function cornerSpeedFor(c, k) {
  if (k < 1e-5) return Infinity;
  const capped = Math.sqrt(2.8 * c.grip / k);
  if (k - c.df > 1e-6) return Math.min(Math.sqrt(c.grip / (k - c.df)), capped);
  return capped;
}

// Reference speed profile along a line: corner limit, then a backward pass limited by braking
// and a forward pass limited by acceleration (classic racing-line speed profile).
function speedProfile(track, model, lineName, margin) {
  const N = track.n, ds = track.ds, lineK = track.lineK[lineName];
  const v = new Float32Array(N);
  const m = margin == null ? 1 : margin;
  for (let i = 0; i < N; i++) v[i] = Math.min(model.vmax, cornerSpeedFor(model, Math.abs(lineK[i])) * m);
  const brake = model.brake * 0.9;
  for (let pass = 0; pass < 2; pass++) for (let i = N - 1; i >= 0; i--) {
    const j = (i + 1) % N;
    const lim = Math.sqrt(v[j] * v[j] + 2 * brake * ds);
    if (lim < v[i]) v[i] = lim;
  }
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) {
    const j = (i - 1 + N) % N;
    const a = model.accel * Math.max(0.15, 1 - Math.pow(v[j] / model.vmax, 2.5));
    const lim = Math.sqrt(v[j] * v[j] + 2 * a * ds);
    if (lim < v[i]) v[i] = lim;
  }
  return v;
}

// tuning knobs (multipliers), exposed so the diagnostic tools can sweep them
const PHYS = { ldK: 0.45, ldMin: 6, ff: 0, slip: 1, cliff: 1, steerRate: 6, yawK: 2, wLim: 0.95, selRate: 0.7, liftOff: 0.01, power: 0.01, relax: 0.2, circle: 0.25 };

const wrapAngle = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const smoothstep = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

class Car {
  constructor(track, model, opts) {
    this.track = track;
    this.cls = model;
    this.name = opts.name || 'Driver';
    this.livery = opts.livery;
    this.isPlayer = !!opts.isPlayer;
    this.skill = opts.skill == null ? 0.5 : opts.skill;
    this.number = opts.number || 1;

    // track bookkeeping (derived from the world position every step)
    this.s = opts.s || 0;
    this.lat = opts.lat || 0;
    // world state
    const P = track.pos(this.s, this.lat);
    this.x = P.x; this.y = P.y;
    this.th = track.headingAt(this.s);   // heading (forward)
    this.v = 0;                          // forward speed, body x
    this.vl = 0;                         // lateral speed, body y (+ = left)
    this.w = 0;                          // yaw rate
    this.delta = 0;                      // steering angle
    this.beta = 0;                       // slip angle between heading and velocity
    this.usage = 0;                      // lateral demand / available grip
    this.Ff = 0; this.Fr = 0;            // lateral force (per unit mass) of the front / rear axle
    this.alphaF = 0; this.alphaR = 0;
    this.slide = 0;                      // 0..1 for effects
    this.state = 'ok';                   // ok | grass
    this.grassT = 0;
    this.rejoined = 0;
    this.crashes = 0;

    this.sel = 0;                        // line selection -1..1 (driver's intention)
    this.selS = 0;                       // the same, eased: a driver moves across the road, he does not teleport
    this.laneTarget = 0;
    this.gridLat = null;
    this.passSide = 0;
    this.passTimer = 0;
    this.blocker = null;
    this.draft = false;

    this.started = false;
    this.checkpoint = false;
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

  // put the car on the track at (s, lat), pointing along the road, at a given speed (default: at rest)
  place(s, lat, v) {
    const T = this.track, P = T.pos(s, lat);
    this.s = T.wrap(s); this.lat = lat; this.x = P.x; this.y = P.y; this.th = T.headingAt(s);
    this.v = v || 0; this.vl = 0; this.w = 0; this.delta = 0; this.beta = 0; this.usage = 0; this.slide = 0; this.Ff = 0; this.Fr = 0; this.selS = this.sel;
  }

  gripAt(v) {
    const c = this.cls;
    return c.grip + Math.min(c.df * v * v, c.grip * 1.8);
  }
  cornerSpeed(k) { return cornerSpeedFor(this.cls, k); }

  get progress() { return (this.lap - (this.started ? 0 : 1)) * this.track.length + this.track.wrap(this.s); }
  get pos() { return { x: this.x, y: this.y }; }
  get heading() { return this.th; }
  get steerAngle() { return this.delta; }
  get drift() { return this.beta; }
  get loadRatio() { return this.usage; }
  get speed() { return Math.hypot(this.v, this.vl); }

  _advance(ds, raceTime) {
    const T = this.track;
    const before = T.wrap(this.s);
    const after = before + ds;
    // half-way checkpoint: a lap only counts after really going round, not by rocking over the line
    if (before < T.length / 2 && after >= T.length / 2) this.checkpoint = true;
    if (after >= T.length) {
      if (!this.checkpoint && this.started) { this.s = T.wrap(after); return; }
      this.checkpoint = false;
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

  // ---------- autopilot: pure pursuit on the selected line ----------
  _desiredCurvature() {
    const T = this.track;
    const sp = Math.max(0, this.v);
    const Ld = clamp(PHYS.ldK * sp + 4, PHYS.ldMin, 45);
    const sAhead = this.s + Ld;
    const latT = this.gridLat != null ? this.gridLat : T.targetLat(sAhead, this.selS);
    const P = T.pos(sAhead, latT);
    const dx = P.x - this.x, dy = P.y - this.y;
    const dist = Math.hypot(dx, dy) || 1e-6;
    const alpha = wrapAngle(Math.atan2(dy, dx) - this.th);
    // target behind us (after a spin): full lock towards it, pure pursuit alone would give zero
    if (Math.abs(alpha) > Math.PI / 2) return Math.sign(alpha) * 0.25;
    const kPursuit = 2 * Math.sin(alpha) / dist;
    // pure pursuit already contains the path curvature; ff only adds a lead on top of it
    const kFF = PHYS.ff ? T.lineCurv(this.s + Ld * 0.4, this.selS) : 0;
    return clamp(kPursuit + PHYS.ff * kFF, -0.25, 0.25);
  }

  update(dt, throttle, raceTime) {
    const T = this.track, c = this.cls;
    this.throttle = throttle;
    this.offT = throttle ? 0 : this.offT + dt;
    this.braking = !throttle && this.offT > 0.05 && this.v > 2;

    // --- surface ---
    const hwL = T.hwLeftAt(this.s), hwR = T.hwRightAt(this.s);
    const off = this.lat > hwL + c.width * 0.3 || this.lat < -(hwR + c.width * 0.3);
    if (off && this.state !== 'grass') { this.state = 'grass'; this.grassT = 0; this.crashes++; }
    if (!off) this.state = 'ok';
    if (this.state === 'grass') this.grassT += dt;
    // stuck in the gravel: the marshals push the car back onto the edge of the road, facing the
    // right way and barely moving. Only after a long excursion, never during a slide.
    if (this.grassT > 8) {
      const edge = clamp(this.lat, -(T.hwRightAt(this.s) - c.width), T.hwLeftAt(this.s) - c.width);
      this.place(this.s, edge, Math.min(8, Math.abs(this.v)));
      this.state = 'ok'; this.grassT = 0; this.rejoined = (this.rejoined || 0) + 1;
      return;
    }
    const surface = off ? 0.42 : 1;

    // --- geometry and tyre data shared by the driver and the axle model ---
    const L = c.length * 0.6;
    const a = L / 2, b = L / 2;                       // CG to front / rear axle
    const kk = Math.pow(0.28 * c.length, 2) * (5 / c.laneK);   // yaw inertia (radius of gyration²)
    const brakeFrac = throttle ? 0 : clamp(this.offT / 0.1, 0, 1);
    const vv = Math.max(3, Math.abs(this.v));
    const peak = c.slipPeak * PHYS.slip;
    const gTot = this.gripAt(Math.abs(this.v)) * surface;

    // --- driver: the line gives a desired curvature, the driver turns it into a front slip angle ---
    // A wheel angle means nothing once the car slides; what a driver really controls is where the
    // front tyres point relative to the car's actual motion. Feed-forward for the curvature, a
    // yaw-rate correction on top; when the tail comes round the yaw rate exceeds the demand and
    // the same law gives opposite lock, like a driver catching a slide. Asking for more than the
    // tyre's peak slip is useless, so the demand is capped: past the limit the car just turns less.
    const kDes = this._desiredCurvature();
    // a car cannot rotate faster than its path can bend: past that the tail only steps out
    const wLim = PHYS.wLim * gTot / vv;
    const wDes = clamp(this.v * kDes, -wLim, wLim);
    const gAxle = gTot * 0.5 / Math.min(1, c.rearBias);               // grip of one axle
    const ayFront = this.v * this.v * kDes * 0.5;                     // lateral acceleration asked of the front
    const aFff = peak * ayFront / Math.max(1e-3, gAxle);              // slip angle that produces it
    const aFdes = clamp(aFff + PHYS.yawK * peak * (wDes - this.w), -peak * 1.3, peak * 1.3);
    const ufront = (this.vl - a * this.w) / vv;                       // lateral / rolling speed at the front axle
    const steerTarget = Math.atan(Math.tan(aFdes) - ufront * Math.sign(this.v || 1));
    const dMax = 0.5, rate = PHYS.steerRate;
    this.delta += clamp(clamp(steerTarget, -dMax, dMax) - this.delta, -rate * dt, rate * dt);
    // grip usage as the driver feels it: lateral acceleration the line demands vs what the tyres can give
    this.usage = this.v * this.v * Math.abs(kDes) / Math.max(1e-3, gTot);

    // --- two-axle model: each axle produces a lateral force from its slip angle ---
    // slip angles: lateral velocity of each axle across its wheels, over the rolling speed
    // (left-positive velocities; the steering angle delta is right-positive). A tyre always
    // fights the lateral velocity of its own contact patch, forwards or backwards.
    const alphaF = Math.atan((this.vl - a * this.w + this.v * Math.tan(this.delta)) / vv);
    const alphaR = Math.atan((this.vl + b * this.w) / vv);
    // grip available per axle: the sum at balance equals gripAt(v), the limiting axle decides
    const base = gAxle;
    const cliffF = 1 - c.cliff * PHYS.cliff * smoothstep(Math.abs(alphaF), peak * 1.5, peak * 5);
    const cliffR = 1 - c.cliff * PHYS.cliff * smoothstep(Math.abs(alphaR), peak * 1.5, peak * 5);
    const driveFrac = throttle ? clamp(1 - Math.pow(Math.max(0, this.v) / c.vmax, 2.5), 0, 1) : 0;
    const gF = base * cliffF;
    const gR = base * c.rearBias * cliffR * (1 - PHYS.liftOff * brakeFrac) * (1 - PHYS.power * driveFrac);   // lift-off / power oversteer
    // tyre curve: linear up to the peak slip angle, then saturated (the cliff is applied above)
    const FfT = -gF * clamp(alphaF / peak, -1, 1);
    const FrT = -gR * clamp(alphaR / peak, -1, 1);
    // relaxation: a tyre needs some travel to build its force (keeps low speed stable too)
    const relax = Math.min(1, dt * vv / PHYS.relax);
    this.Ff += (FfT - this.Ff) * relax;
    this.Fr += (FrT - this.Fr) * relax;
    // how hard the tyres are working (friction circle for the longitudinal forces)
    const useF = Math.abs(this.Ff) / Math.max(1e-3, gF), useR = Math.abs(this.Fr) / Math.max(1e-3, gR);
    const u = Math.min(1, Math.max(useF, useR));

    // --- longitudinal ---
    let acc;
    const dir = Math.sign(this.v || 1);                 // everything that resists motion opposes it
    const vmax = c.vmax * (this.draft ? 1.05 : 1);
    if (throttle) acc = c.accel * Math.max(0, 1 - Math.pow(Math.max(0, this.v) / vmax, 2.5)) * (this.draft ? 1.08 : 1) * Math.max(0.3, 1 - PHYS.circle * u * u);
    else acc = -(1.5 + c.brake * brakeFrac) * (1 - PHYS.circle * u * u) * (this.v > 1 ? 1 : Math.max(0, this.v));
    // grass and gravel drag the whole car, not just its forward motion: it opposes the velocity
    // vector, so a car sliding in sideways is slowed down sideways too.
    let latDrag = 0;
    if (off) {
      const sp = Math.hypot(this.v, this.vl) || 1e-6;
      const dragA = 5 + 0.15 * sp;
      acc -= dragA * this.v / sp;
      latDrag = -dragA * this.vl / sp;
    }
    // sliding tyres scrub speed (lateral force component along the velocity)
    acc -= (Math.abs(this.Ff * Math.sin(alphaF)) + Math.abs(this.Fr * Math.sin(alphaR))) * 0.8 * dir;
    // --- yaw from the axle moments; the velocity vector is rotated into the new body frame ---
    const wDot = (-a * this.Ff + b * this.Fr) / kk;
    this.w = clamp(this.w + wDot * dt, -4, 4);
    this.th = wrapAngle(this.th + this.w * dt);
    const v0 = this.v, vl0 = this.vl;
    // a car pushed backwards by its own spin never reaches racing speed in reverse
    this.v = clamp(v0 + (acc - vl0 * this.w) * dt, -0.25 * c.vmax, c.vmax * 1.05);
    this.vl = vl0 + (v0 * this.w + this.Ff + this.Fr) * dt;
    if (latDrag) this.vl += clamp(latDrag * dt, -Math.abs(vl0), Math.abs(vl0));   // drag never reverses it
    this.beta = Math.atan2(this.vl, vv) * Math.sign(this.v || 1);
    this.alphaF = alphaF; this.alphaR = alphaR;
    this.slide = clamp((Math.max(Math.abs(alphaF), Math.abs(alphaR)) - peak * 0.8) / (peak * 2.5), 0, 1);

    // --- integrate position (body frame → world, y-down, left = (sinθ, −cosθ)) ---
    const cs = Math.cos(this.th), sn = Math.sin(this.th);
    this.x += (this.v * cs + this.vl * sn) * dt;
    this.y += (this.v * sn - this.vl * cs) * dt;

    // --- track bookkeeping ---
    const pr = T.project(this.x, this.y, this.s);
    const ds = T.diff(this.s, pr.s);
    if (Math.abs(ds) < 6) { if (ds > 0) this._advance(ds, raceTime); else this.s = pr.s; this.lat = pr.lat; }
    else this._advance(Math.max(0, this.v) * dt, raceTime);
  }

  // which line we want, plus AI overtaking decisions
  steer(cars, dt, ai) {
    const T = this.track, c = this.cls;
    if (this.gridLat != null) { this.laneTarget = this.gridLat; this.selS = this.sel; return; }
    let blocker = null, bd = Infinity;
    const range = c.length * 3 + Math.max(0, this.v) * 1.0;
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
          const cand = [-1, 1].map(sel => {
            const lat = T.targetLat(this.s + 15, sel);
            let room = Math.abs(lat - blocker.lat);
            for (const o of cars) { if (o === this || o === blocker) continue; const d = T.diff(this.s, o.s); if (d > -c.length * 2 && d < 40) room = Math.min(room, Math.abs(lat - o.lat)); }
            return { sel, room };
          });
          cand.sort((a, b) => b.room - a.room);
          this.passSide = cand[0].room > c.width * 0.9 ? cand[0].sel : 0;
          this.passTimer = 2 + Math.random() * 1.5;
        }
        this.sel = this.passSide;
      } else if (this.passSide !== 0 && this.passTimer <= 0) { this.passSide = 0; this.sel = 0; }
      else if (!blocker && this.passSide === 0) this.sel = 0;
    }
    // ease the chosen line in: changing lane is a manoeuvre, not a jump of the target
    this.selS += clamp(this.sel - this.selS, -PHYS.selRate * dt, PHYS.selRate * dt);
    this.laneTarget = T.targetLat(this.s, this.selS);
  }
}

// AI: brake for the tightest corner reachable along its line, with a skill-dependent margin.
function aiThrottle(car, cars, dt, opts) {
  const c = car.cls, T = car.track;
  // sideways or going backwards: both feet in until the car is pointing somewhere useful again
  if (Math.abs(car.beta) > 0.6 || car.v < -0.5) return false;
  car.aiTimer -= dt;
  if (car.aiTimer <= 0) {
    car.aiTimer = 0.12;
    car.aiNoise = (Math.random() - 0.5) * 0.03;
    // Never ask for more than the tyres can give. `margin` multiplies the corner speed the grip
    // allows, so anything above 1 is a corner the car cannot take, and the driver who is handed it
    // does not go faster — he goes off, loses ten seconds, and hands the place back. The skill
    // spread, the noise and the rubber-banding all add up, so the sum is what has to be capped,
    // not each part: that is how a "hard" setting ended up slower in race pace than it looked.
    const MAX = 0.98;
    const margin = Math.min(MAX, (opts.marginBase + car.skill * opts.marginSpread) + car.aiNoise + (opts.rubber || 0));
    const brake = c.brake * 0.88;
    const v = Math.max(0, car.v);
    let allow = c.vmax * Math.min(1, (opts.paceBase == null ? 1 : opts.paceBase + car.skill * opts.paceSpread) + (opts.rubber || 0));
    const maxD = v * v / (2 * brake) + 40;
    for (let d = 0; d < maxD; d += 3) {
      const k = Math.abs(d < 6 ? T.curvAtLat(car.s + d, car.lat) : T.lineCurv(car.s + d, car.selS));
      if (k < 1e-4) continue;
      const vc = car.cornerSpeed(k) * margin;
      if (vc >= c.vmax) continue;
      const a = Math.sqrt(vc * vc + 2 * brake * d);
      if (a < allow) allow = a;
    }
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

// car-to-car contact, resolved in world space along the track tangent / normal
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
      const h = track.headingAt(a.s), tx = Math.cos(h), ty = Math.sin(h), nx = Math.sin(h), ny = -Math.cos(h);
      if (longOverlap < latOverlap * 2.2) {
        const rear = d > 0 ? a : b, front = d > 0 ? b : a;
        if (rear.v > front.v) {
          const dv = rear.v - front.v;
          front.v += dv * 0.35;
          rear.v = front.v - dv * 0.1;
          const push = Math.min(longOverlap / 2, 0.1);
          rear.x -= tx * push; rear.y -= ty * push;
          front.x += tx * push; front.y += ty * push;
        }
      } else {
        const dir = dl >= 0 ? 1 : -1, sep = Math.min(latOverlap / 2, 0.1);
        a.x -= nx * dir * sep; a.y -= ny * dir * sep;
        b.x += nx * dir * sep; b.y += ny * dir * sep;
        // a nudge is a perturbation: a little lateral velocity and yaw, capped
        a.vl = clamp(a.vl - dir * 0.25, -3, 3); b.vl = clamp(b.vl + dir * 0.25, -3, 3);
        a.w = clamp(a.w - dir * 0.05, -3, 3); b.w = clamp(b.w + dir * 0.05, -3, 3);
        a.v *= 0.995; b.v *= 0.995;
      }
    }
  }
}

if (typeof module !== 'undefined') module.exports = { Car, aiThrottle, resolveCollisions, speedProfile, cornerSpeedFor, PHYS };
