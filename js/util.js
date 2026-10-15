// Shared helpers (loaded first).
'use strict';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;

// Conserver les fronts d'appui entre deux images : un bouton pressé puis relâché
// pendant une image lente doit encore traverser les sous-pas de la physique.
class ThrottlePulses {
  constructor() { this.reset(); }
  reset(value = false) { this.value = !!value; this.events = []; }
  push(at, value) {
    const last = this.events.length ? this.events[this.events.length - 1].value : this.value;
    if (!!value !== last) this.events.push({ at, value: !!value });
  }
  take(from, to, fallback) {
    // Les bancs et l'autopilote peuvent encore poser directement input.throttle.
    if (!this.events.length) this.value = !!fallback;
    const out = [];
    let start = from;
    while (this.events.length && this.events[0].at <= to) {
      const e = this.events.shift();
      if (e.at > start) { out.push({ dt: (e.at - start) / 1000, throttle: this.value }); start = e.at; }
      this.value = e.value;
    }
    if (to > start) out.push({ dt: (to - start) / 1000, throttle: this.value });
    return out;
  }
}
if (typeof module !== 'undefined') module.exports = { clamp, lerp, ThrottlePulses };
