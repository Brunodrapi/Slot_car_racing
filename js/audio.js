// Tiny procedural audio: engine hum that follows speed, tyre squeal, crash thud.
'use strict';

class GameAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.started = false;
  }

  start() {
    if (this.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const ctx = this.ctx;
      this.master = ctx.createGain(); this.master.gain.value = 0.0; this.master.connect(ctx.destination);

      // engine: two detuned saws through a lowpass
      this.engGain = ctx.createGain(); this.engGain.gain.value = 0.0; this.engGain.connect(this.master);
      this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 600; this.engFilter.connect(this.engGain);
      this.osc1 = ctx.createOscillator(); this.osc1.type = 'sawtooth'; this.osc1.frequency.value = 60; this.osc1.connect(this.engFilter);
      this.osc2 = ctx.createOscillator(); this.osc2.type = 'square'; this.osc2.frequency.value = 90; this.osc2.detune.value = 8;
      const g2 = ctx.createGain(); g2.gain.value = 0.35; this.osc2.connect(g2); g2.connect(this.engFilter);
      this.osc1.start(); this.osc2.start();

      // squeal: noise through bandpass
      const buf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = ctx.createBufferSource(); this.noise.buffer = buf; this.noise.loop = true;
      this.sqFilter = ctx.createBiquadFilter(); this.sqFilter.type = 'bandpass'; this.sqFilter.frequency.value = 1800; this.sqFilter.Q.value = 6;
      this.sqGain = ctx.createGain(); this.sqGain.gain.value = 0;
      this.noise.connect(this.sqFilter); this.sqFilter.connect(this.sqGain); this.sqGain.connect(this.master);
      this.noise.start();
      this.started = true;
      this.setEnabled(this.enabled);
    } catch (e) { this.ctx = null; }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.05);
  }

  update(car, racing) {
    if (!this.started || !this.enabled) return;
    const t = this.ctx.currentTime;
    const fin = (v, d) => (Number.isFinite(v) ? v : d);
    const r = Math.min(1, fin(car.v, 0) / car.cls.vmax);
    const rev = racing ? r : (car.throttle ? 0.35 : 0.05);
    const f = 45 + rev * 260 + (car.throttle ? 12 : 0);
    this.osc1.frequency.setTargetAtTime(f, t, 0.05);
    this.osc2.frequency.setTargetAtTime(f * 1.5, t, 0.05);
    this.engFilter.frequency.setTargetAtTime(300 + rev * 1400 + (car.throttle ? 300 : 0), t, 0.05);
    this.engGain.gain.setTargetAtTime(0.18 + rev * 0.2 + (car.throttle ? 0.06 : 0), t, 0.05);
    const sq = car.state === 'ok' ? Math.min(1, fin(car.slide, 0) * 2) : 0.3;
    this.sqGain.gain.setTargetAtTime(sq * 0.25, t, 0.03);
    this.sqFilter.frequency.setTargetAtTime(1400 + sq * 900, t, 0.05);
  }

  idle() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    this.engGain.gain.setTargetAtTime(0, t, 0.1);
    this.sqGain.gain.setTargetAtTime(0, t, 0.1);
  }

  thud() {
    if (!this.started || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.35);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.45);
  }

  beep(freq, dur, vol) {
    if (!this.started || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol || 0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + (dur || 0.15));
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + (dur || 0.15) + 0.05);
  }
}
