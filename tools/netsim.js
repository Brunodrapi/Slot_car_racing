// Two screens racing together, without a browser and without a network.
//
// The WebRTC transport is replaced by a loopback that carries presences between two Net instances
// in this process. Everything above it is the real thing: the real lobby, the real host loop, the
// real snapshots, the real race. What this checks is the only part that can genuinely be wrong —
// that a guest's throttle reaches its car on the host, and that what the guest then sees is the
// host's race rather than a drift of its own.
//
//   node tools/netsim.js [circuit] [secondes] [perte %] [race|duel|ghost]
//
// The loss figure drops that share of messages in both directions, because the channel really is
// unreliable and unordered: the guard against replaying stale input is the thing worth testing.
const fs = require('fs'), vm = require('vm');

const ARGS = process.argv.slice(2);
const TRACK = ARGS[0] || 'monza';
const SECONDS = +(ARGS[1] || 20);
const LOSS = +(ARGS[2] || 0) / 100;
const MODE = ARGS[3] || 'race';

let src = '';
for (const f of ['util', 'tracks', 'track', 'cars', 'car', 'race', 'net']) {
  src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8')
    .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
}

/* A presence board shared by everyone at the table, with the same shape the real transport gives:
   each screen posts one object, and reads the others' back. */
class Loop {
  constructor(bus, label) { this.bus = bus; this.label = label; bus.set(label, {}); }
  presence(p) {
    if (Math.random() < LOSS) return Promise.resolve();   // a dropped frame repairs itself next time
    this.bus.set(this.label, JSON.parse(JSON.stringify(p)));
    return Promise.resolve();
  }
  peers() {
    return [...this.bus.entries()].map(([k, v]) => ({ peer: k, isMe: k === this.label, presence: v, updatedAt: Date.now() }));
  }
  onPeers(h) { this.handlers = this.handlers || []; this.handlers.push(h); }
  close() { this.bus.delete(this.label); }
}

src += `
const bus = new Map();
const host = new Net(), guest = new Net();
host.room = new Loop(bus, '0-AAAA-host');   host.creator = true;  host.state = 'lobby'; host.code = 'AAAA';
guest.room = new Loop(bus, '1-AAAA-guest'); guest.creator = false; guest.state = 'lobby'; guest.code = 'AAAA';
host.mine = { pid: host.pid, name: 'Hôte', car: { modelId: null, livery: 0 }, ready: true };
guest.mine = { pid: guest.pid, name: 'Invité', car: { modelId: null, livery: 3 }, ready: true };
host.table.trackId = ${JSON.stringify(TRACK)};
host.table.mode = ${JSON.stringify(MODE)};

let hostRace = null, guestRace = null;
host.onStart = (cfg) => { hostRace = build(cfg); };
guest.onStart = (cfg) => { guestRace = build(cfg); };
function build(cfg) {
  return new Race({
    mode: 'race', aiFill: cfg.mode === 'race', noContact: cfg.mode === 'ghost',
    trackDef: TRACKS.find(t => t.id === cfg.trackId), classId: 'gt',
    laps: 3, difficulty: cfg.difficulty, humans: cfg.humans,
  });
}

// The lobby is a loop, not a handshake: everyone re-posts their presence every frame, so a
// dropped one repairs itself on the next. Run a few frames of it before dropping the flag.
for (let k = 0; k < 40; k++) {
  CLOCK.t += 16;
  host.post(); guest.post();
  host.peers = host.room.peers(); guest.peers = guest.room.peers();
  if (k === 20) host.start();                  // the host drops the flag
  host.pump(); guest.pump();
}

if (!hostRace || !guestRace) { OUT = 'ÉCHEC : la course n\\'a pas démarré des deux côtés'; }
else {
  const dt = 1 / 60, steps = Math.round(${SECONDS} / dt);
  let worst = 0, worstAt = 0, worstWhy = '', sumErr = 0, n = 0, guestMoved = 0, off = 0, run = 0, worstRun = 0;
  // the guest holds the throttle down and weaves between the lines
  for (let k = 0; k < steps; k++) {
    CLOCK.t += dt * 1000;            // the 30 Hz gate reads this clock, so it has to move with the race
    const input = { throttle: (k % 240) < 200, sel: Math.sin(k / 90) };
    host.peers = host.room.peers();
    guest.peers = guest.room.peers();

    hostRace.update(dt, { throttle: true, sel: 0 });
    host.hostTick(hostRace);

    guest.guestTick(guestRace, input);
    guestRace.extrapolate(dt);

    if (hostRace.state === 'racing' && k > 300) {
      // the guest's own car on the host, against the same car as the guest draws it
      const seatGuest = guest.seat;
      const a = hostRace.cars.find(c => c.human === seatGuest);
      const b = guestRace.cars.find(c => c.human === seatGuest);
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > worst) { worst = d; worstAt = k; worstWhy = hostRace.state + ' t=' + hostRace.time.toFixed(1) + 's tour=' + a.lap + ' v=' + a.v.toFixed(0) + ' etat=' + a.state; }
      sumErr += d; n++;
      // A peak lasting one frame is not the same thing as a gap that persists: a teleport (the
      // marshals putting a car back on track) shows up as a huge instantaneous error that the very
      // next snapshot closes. What matters is how long the picture stays wrong.
      if (d > 2) { off++; run++; if (run > worstRun) worstRun = run; } else run = 0;
      if (a.v > 5) guestMoved++;
    }
  }
  const rows = [];
  rows.push('circuit ' + ${JSON.stringify(TRACK)} + ', format ' + ${JSON.stringify(MODE)} + ', ' + ${SECONDS} + ' s, perte ' + Math.round(${LOSS} * 100) + ' %');
  rows.push('grille : ' + hostRace.cars.length + ' voitures, dont ' + hostRace.cars.filter(c => c.human != null).length + ' humains');
  rows.push('siège de l invité : ' + guest.seat + ' (hôte ' + host.seat + ')');
  rows.push('écart hôte/invité : moyen ' + (sumErr / Math.max(1, n)).toFixed(2) + ' m, pire ' + worst.toFixed(2) + ' m (' + worstWhy + ')');
  rows.push('au-delà de 2 m : ' + (off / Math.max(1, n) * 100).toFixed(1) + ' % des images, le plus longtemps ' + (worstRun / 60).toFixed(2) + ' s d affilée');
  rows.push('la voiture de l invité a roulé ' + Math.round(guestMoved / Math.max(1, n) * 100) + ' % du temps');
  rows.push('tours hôte ' + hostRace.cars.map(c => c.lap).join(',') + ' / invité ' + guestRace.cars.map(c => c.lap).join(','));
  const ok = worstRun / 60 < 0.6 && off / Math.max(1, n) < 0.03 && guestMoved / Math.max(1, n) > 0.5 && guest.seat === 1;
  rows.push(ok ? 'OK' : 'ÉCHEC');
  OUT = rows.join('\\n');
}
`;

// A clock that advances with the simulated race rather than with the wall: the send rate, the
// staleness of a snapshot and the guard on out-of-order input all read it, and on a wall clock
// twelve hundred steps go by in a few milliseconds, so nothing would ever be sent.
const CLOCK = { t: 0 };
const ctx = {
  console, Math, JSON, Object, Array, Float32Array, Map, Set, Date,
  performance: { now: () => CLOCK.t },
  CLOCK, Loop, OUT: '',
};
vm.runInNewContext(src, ctx);
console.log(ctx.OUT);
process.exit(/ÉCHEC/.test(ctx.OUT) ? 1 : 0);
