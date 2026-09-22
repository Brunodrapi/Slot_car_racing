/* Slot Racer — racing together.
 *
 * Everything rides on the presence board of `js/room-rtc.js`: each screen posts one object and
 * sees everyone else's. Nothing is stored anywhere — close the page and the table is gone.
 *
 * One player hosts. The host is whoever opened the table, and the host alone simulates: it reads
 * the others' throttle and line off the board, runs the race, and posts the state of every car.
 * The guests post their two numbers and replay what they receive. No guest predicts anything, so
 * no guest can disagree with the host; what a guest sees is the host's race, a fraction of a
 * second old.
 *
 * Three formats, one lobby:
 *   race   — everyone on the grid, filled up with AI cars, contact on
 *   duel   — the people and no one else
 *   ghost  — the same circuit, each on their own lap, cars passing through each other
 */
'use strict';

const NET_HZ = 30;                 // snapshots per second; the channel coalesces around this anyway
const NET_CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no I, O, 0, 1: they are read aloud
const NET_MODES = ['race', 'duel', 'ghost'];
const NET_SEATS = 6;               // people per table
const NET_STALE = 6000;            // a screen quiet this long has left

function netCode() {
  return Array.from({ length: 4 }, () => NET_CODE[Math.floor(Math.random() * NET_CODE.length)]).join('');
}

// An identity this screen makes up for itself. The transport labels peers its own way and may
// never tell us which one we are, so we do not ask it: we publish who we are and look for
// ourselves in the list.
function netPid() {
  return Math.random().toString(36).slice(2, 10);
}

class Net {
  constructor() {
    this.room = null;
    this.state = 'off';            // off | lobby | playing
    this.code = null;
    this.pid = netPid();
    this.creator = false;          // opened the table, therefore hosts
    this.error = null;
    this.busy = false;
    this.mine = { pid: this.pid, name: '', car: null, ready: false };
    this.table = { mode: 'race', trackId: 'monza', laps: 3, difficulty: 'medium', go: 0 };
    this.roster = null;            // frozen at kick-off: [pid, …], host first
    this.seat = -1;
    this.peers = [];
    this.seq = 0;
    this.lastSeq = -1;
    this.outN = 0;
    this.seenN = {};
    this.sentAtMs = 0;
    this.snapAt = 0;
    this.onPeers = () => {};
    this.onStart = () => {};
  }

  available() { return typeof RoomRTC !== 'undefined' && RoomRTC.available(); }
  isHost() { return this.roster ? this.seat === 0 : this.creator; }

  /* ---------------------------------------------------------------------------- the table */

  async open(name, asHost, code) {
    this.busy = true; this.error = null;
    try {
      this.room = new RoomRTC();
      this.code = asHost ? netCode() : String(code || '').toUpperCase().trim();
      if (!asHost && !/^[A-Z0-9]{4}$/.test(this.code)) throw new Error('code à quatre lettres');
      this.creator = !!asHost;
      this.mine = { pid: this.pid, name: name || 'Pilote', car: null, ready: false };
      this.room.onPeers(() => { this.peers = this.room.peers(); this.pump(); });
      await this.room.claim(this.code, asHost);
      this.state = 'lobby';
      await this.post();
    } catch (e) {
      this.error = (e && e.message) || 'liaison impossible';
      this.leave();
    }
    this.busy = false;
    this.onPeers();
    return !this.error;
  }

  leave() {
    if (this.room) this.room.close();
    this.room = null;
    this.state = 'off';
    this.code = null;
    this.roster = null;
    this.seat = -1;
    this.peers = [];
    this.creator = false;
    this.onPeers();
  }

  post(extra) {
    if (!this.room) return Promise.resolve();
    const p = Object.assign({}, this.mine, extra || {});
    if (this.creator) p.t = this.table;          // only the host's copy of the settings counts
    if (this.roster) { p.rs = this.roster; p.seat = this.seat; }
    return this.room.presence(p);
  }

  /** Everyone at the table, host first, stale screens dropped. */
  members() {
    const now = Date.now();
    const out = [];
    for (const p of this.peers) {
      const q = p.presence || {};
      if (!q.pid) continue;
      if (!p.isMe && p.updatedAt && now - p.updatedAt > NET_STALE) continue;
      out.push({ pid: q.pid, name: q.name || 'Pilote', car: q.car, ready: !!q.ready, isMe: !!p.isMe, q });
    }
    // The host's label starts with 0 in this transport, so sorting by label puts them first; that
    // ordering is what the roster freezes, and both screens sort the same way.
    const label = (m) => (this.peers.find(p => (p.presence || {}).pid === m.pid) || {}).peer || '';
    out.sort((a, b) => (label(a) < label(b) ? -1 : 1));
    return out.slice(0, NET_SEATS);
  }

  settings() {
    if (this.creator) return this.table;
    for (const p of this.peers) { const t = (p.presence || {}).t; if (t) return t; }
    return this.table;
  }

  setTable(patch) {
    if (!this.creator) return;
    Object.assign(this.table, patch);
    this.post();
    this.onPeers();
  }

  setMine(patch) {
    Object.assign(this.mine, patch);
    this.post();
    this.onPeers();
  }

  canStart() {
    const m = this.members();
    const need = this.settings().mode === 'duel' ? 2 : 2;
    return this.creator && m.length >= need && m.every(x => x.ready && x.car);
  }

  /** The host calls the start; everyone freezes the same list, in the same order, at that moment. */
  start() {
    if (!this.canStart()) return;
    this.setTable({ go: Date.now() });
  }

  /** Watches the host's settings for a kick-off, and hands the game what it needs to build a grid. */
  pump() {
    this.onPeers();
    if (this.state !== 'lobby') return;
    const t = this.settings();
    if (!t.go) return;
    const m = this.members();
    if (m.length < 2) return;
    this.roster = m.map(x => x.pid);
    this.seat = this.roster.indexOf(this.pid);
    if (this.seat < 0) { this.roster = null; return; }
    this.state = 'playing';
    this.seq = 0; this.lastSeq = -1; this.outN = 0; this.seenN = {}; this.sentAtMs = 0;
    this.snapAt = performance.now();
    this.post();
    this.onStart({
      mode: t.mode, trackId: t.trackId, laps: t.laps, difficulty: t.difficulty,
      // Nobody picks a colour any more, so the seat gives one: the order is the same on every
      // screen, so everyone agrees on who is which without a word about it passing over the wire.
      humans: m.map((x, i) => ({
        name: x.name,
        modelId: (x.car && x.car.modelId) || null,
        livery: i,
        local: x.pid === this.pid,
      })),
    });
  }

  /** Back to the lobby after the flag, keeping the table open. */
  backToLobby() {
    if (this.state !== 'playing') return;
    this.state = 'lobby';
    this.roster = null;
    this.seat = -1;
    if (this.creator) this.table.go = 0;
    this.mine.ready = false;
    this.post();
    this.onPeers();
  }

  /* ------------------------------------------------------------------- during the race */

  /** The host: read everyone's input, then publish the state of the race. Once per frame. */
  hostTick(race) {
    if (!this.room || !this.isHost()) return;
    for (const p of this.peers) {
      const q = p.presence || {};
      if (p.isMe || !q.pid || !Array.isArray(q.i)) continue;
      const seat = this.roster ? this.roster.indexOf(q.pid) : -1;
      if (seat < 1) continue;
      // The channel is neither reliable nor ordered: a frame of input can arrive after a newer
      // one. Replaying it would resurrect a throttle already released, so only what moves
      // forward is read. The window lets the counter wrap round.
      const n = typeof q.n === 'number' ? q.n : null;
      if (n !== null) {
        const seen = this.seenN[q.pid];
        if (seen !== undefined && n <= seen && n > seen - 120) continue;
        this.seenN[q.pid] = n;
      }
      race.netInput[seat] = { thr: !!q.i[0], sel: (q.i[1] || 0) / 100 };
    }
    const now = performance.now();
    if (now - this.sentAtMs < 1000 / NET_HZ) return;
    this.sentAtMs = now;
    this.post({ s: race.snapshot(++this.seq) });
  }

  /** A guest: publish my two numbers, apply the newest state received. Once per frame. */
  guestTick(race, input) {
    if (!this.room || this.isHost()) return;
    const host = this.members()[0];
    const snap = host && host.q && host.q.s;
    // An older snapshot than the one already applied would make the race walk backwards. It is
    // let through only when it comes from far behind, which means a fresh race has started.
    if (Array.isArray(snap) && (snap[0] > this.lastSeq || snap[0] < this.lastSeq - 120)) {
      if (race.applySnapshot(snap)) { this.lastSeq = snap[0]; this.snapAt = performance.now(); }
    }
    const now = performance.now();
    if (now - this.sentAtMs < 1000 / NET_HZ) return;
    this.sentAtMs = now;
    this.post({ i: [input.throttle ? 1 : 0, Math.round(clamp(input.sel || 0, -1, 1) * 100)], n: ++this.outN });
  }

  /** How long since the last state arrived — the game greys the screen when it gets long. */
  silence() {
    if (this.state !== 'playing' || this.isHost()) return 0;
    return (performance.now() - this.snapAt) / 1000;
  }
}

if (typeof module !== 'undefined') module.exports = { Net, netCode, NET_MODES, NET_SEATS };
