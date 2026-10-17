// Shared helpers (loaded first).
'use strict';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
// Les boutons historiques valent toujours 0/1 ; les commandes analogiques restent dosables.
const throttleAmount = value => typeof value === 'boolean' ? Number(value) : Number.isFinite(value) ? clamp(value, 0, 1) : 0;
function mobileDevice(nav = navigator, media = window.matchMedia.bind(window)) {
  return !!(nav.userAgentData?.mobile || /Android|iPhone|iPad|iPod/i.test(nav.userAgent || '')
    || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
    || (media('(pointer: coarse)').matches && !media('(hover: hover)').matches));
}

// Conserver les fronts d'appui entre deux images : un bouton pressé puis relâché
// pendant une image lente doit encore traverser les sous-pas de la physique.
class ThrottlePulses {
  constructor() { this.reset(); }
  reset(value = false) { this.value = typeof value === 'boolean' ? value : throttleAmount(value); this.events = []; }
  push(at, value) {
    const last = this.events.length ? this.events[this.events.length - 1].value : this.value;
    value = typeof value === 'boolean' ? value : throttleAmount(value);
    if (throttleAmount(value) !== throttleAmount(last)) this.events.push({ at, value });
  }
  take(from, to, fallback) {
    // Les bancs et l'autopilote peuvent encore poser directement input.throttle.
    if (!this.events.length) this.value = typeof fallback === 'boolean' ? fallback : throttleAmount(fallback);
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
if (typeof module !== 'undefined') module.exports = { clamp, lerp, throttleAmount, mobileDevice, ThrottlePulses };
