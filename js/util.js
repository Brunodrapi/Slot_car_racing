// Shared helpers (loaded first).
'use strict';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
if (typeof module !== 'undefined') module.exports = { clamp, lerp };
