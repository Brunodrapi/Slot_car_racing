/* Le son des voitures, synthétisé.

Deux méthodes se partagent le métier (voir README) : le fondu enchaîné d'enregistrements par
régime, et la synthèse. La première est celle des simulateurs, mais elle demande une douzaine de
boucles par voiture et par perspective ; à neuf voitures cela ferait des mégaoctets à télécharger
sur un téléphone, et surtout des enregistrements génériques feraient sonner un flat-12 comme un
six en ligne — exactement ce qu'on cherche à éviter.

La synthèse est ici la bonne réponse parce que la différence entre ces voitures est *arithmétique*.
Un quatre-temps allume cyl/2 fois par tour de vilebrequin, donc la fréquence d'allumage vaut

    f = tr/min ÷ 60 × cyl ÷ 2

À 6000 tr/min : 300 Hz pour un six en ligne, 400 pour un V8, 600 pour un V12. Une octave sépare le
six du douze, sans rien avoir à enregistrer. Les ordres moteur sont les harmoniques de la rotation
du vilebrequin, donc au lieu d'empiler douze oscillateurs on en prend **un seul**, muni d'une
`PeriodicWave` dont les coefficients *sont* les ordres, et on lui donne pour fréquence tr/min ÷ 60.
L'allumage tombe alors sur l'harmonique cyl/2 et tout le spectre suit.

Le reste est du réalisme de comportement, et c'est lui qui fait le plus d'effet :
  — le **régime suit les rapports**, pas la vitesse. Sans boîte, un moteur monte du ralenti au
    rupteur en une seule fois sur toute la course : rien ne sonne plus faux.
  — la **charge** change le timbre. Pied levé, l'admission disparaît et l'échappement s'assombrit.
  — la **rugosité** : un V8 à vilebrequin croisé allume de travers et gronde, un V12 est lisse.
    C'est ce qui distingue la Corvette de la Countach à cylindrée et régime comparables.
*/
'use strict';

// Rapports de boîte, en fraction de la vitesse maximale : la fin de chaque rapport. Cinq rapports
// serrés en bas, longs en haut, comme sur une vraie boîte — le premier ne sert qu'à démarrer.
const GEARS = [0.16, 0.32, 0.5, 0.72, 1.0];

class GameAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.started = false;
    this.waves = {};        // une forme d'onde par moteur, construite une fois
    this.spec = null;       // le moteur en cours
    this.rpm = 0;
    this.gear = 0;
    this.shiftT = -10;
  }

  /* La forme d'onde d'un moteur : ses ordres, posés comme harmoniques du vilebrequin.

     L'ordre dominant est cyl/2, celui de l'allumage. Au-dessus viennent ses multiples, qui
     donnent le mordant. En dessous, les demi-ordres : ils ne devraient pas exister sur un moteur
     parfaitement équilibré, et c'est précisément leur présence qui fait le grondement d'un V8 à
     vilebrequin croisé. `rough` les dose. */
  _wave(e) {
    const key = [e.cyl, e.rough, e.bright].join('|');
    if (this.waves[key]) return this.waves[key];
    const N = 48;
    const real = new Float32Array(N), imag = new Float32Array(N);
    const fire = e.cyl / 2;
    for (let n = 1; n < N; n++) {
      let a = 0;
      if (n % fire === 0) {
        // l'allumage et ses multiples : l'amplitude décroît d'autant moins vite que le moteur crie
        const k = n / fire;
        a = Math.pow(k, -(2.6 - 1.5 * e.bright));
      } else if (n < fire) {
        // les ordres inférieurs : le déséquilibre, donc le grondement
        a = e.rough * 0.5 * Math.pow(n / fire, 0.6);
      } else {
        // entre deux allumages, un peu de matière pour que le spectre ne soit pas un peigne
        a = e.rough * 0.12 / Math.pow(n / fire, 1.4);
      }
      imag[n] = a;
    }
    const w = this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    this.waves[key] = w;
    return w;
  }

  /** `ctx` n'est passé que par les mesures, qui rendent le son hors ligne pour l'analyser. */
  start(ctx0) {
    if (this.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!ctx0 && !AC) return;
      this.ctx = ctx0 || new AC();
      const ctx = this.ctx;

      // Un compresseur sur la sortie : plusieurs sources se cumulent et le moteur monte fort au
      // rupteur. Sans lui, ça sature dès qu'on passe le troisième rapport.
      this.master = ctx.createGain(); this.master.gain.value = 0;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14; this.comp.knee.value = 12; this.comp.ratio.value = 4;
      this.comp.attack.value = 0.004; this.comp.release.value = 0.12;
      this.master.connect(this.comp); this.comp.connect(ctx.destination);

      // Une seconde de bruit blanc, bouclée : elle sert aux pneus, au gravier et au vent.
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      const noise = () => { const n = ctx.createBufferSource(); n.buffer = buf; n.loop = true; n.start(); return n; };

      // --- moteur : deux voix du même oscillateur, l'échappement et l'admission ---
      this.eng = ctx.createOscillator(); this.eng.frequency.value = 20;
      this.exFilter = ctx.createBiquadFilter(); this.exFilter.type = 'lowpass';
      this.exFilter.frequency.value = 500; this.exFilter.Q.value = 0.9;
      this.exGain = ctx.createGain(); this.exGain.gain.value = 0;
      this.eng.connect(this.exFilter); this.exFilter.connect(this.exGain); this.exGain.connect(this.master);

      this.inFilter = ctx.createBiquadFilter(); this.inFilter.type = 'bandpass';
      this.inFilter.frequency.value = 1200; this.inFilter.Q.value = 1.2;
      this.inGain = ctx.createGain(); this.inGain.gain.value = 0;
      this.eng.connect(this.inFilter); this.inFilter.connect(this.inGain); this.inGain.connect(this.master);
      this.eng.start();

      // souffle d'admission : du bruit filtré au régime, présent seulement pied dedans
      this.airSrc = noise();
      this.airFilter = ctx.createBiquadFilter(); this.airFilter.type = 'bandpass';
      this.airFilter.frequency.value = 900; this.airFilter.Q.value = 0.8;
      this.airGain = ctx.createGain(); this.airGain.gain.value = 0;
      this.airSrc.connect(this.airFilter); this.airFilter.connect(this.airGain); this.airGain.connect(this.master);

      // turbo : un sifflement qui monte avec le régime et la charge
      this.turbo = ctx.createOscillator(); this.turbo.type = 'sine'; this.turbo.frequency.value = 3000;
      this.turboGain = ctx.createGain(); this.turboGain.gain.value = 0;
      this.turbo.connect(this.turboGain); this.turboGain.connect(this.master);
      this.turbo.start();

      // --- pneus : deux bandes, l'une aiguë qui chante, l'autre plus basse qui racle ---
      this.tyreSrc = noise();
      this.sq1 = ctx.createBiquadFilter(); this.sq1.type = 'bandpass'; this.sq1.frequency.value = 1700; this.sq1.Q.value = 9;
      this.sq2 = ctx.createBiquadFilter(); this.sq2.type = 'bandpass'; this.sq2.frequency.value = 780; this.sq2.Q.value = 3;
      this.sqGain = ctx.createGain(); this.sqGain.gain.value = 0;
      this.tyreSrc.connect(this.sq1); this.tyreSrc.connect(this.sq2);
      this.sq1.connect(this.sqGain); this.sq2.connect(this.sqGain); this.sqGain.connect(this.master);

      // --- gravier : un grondement large, sans hauteur définie ---
      this.grvSrc = noise();
      this.grvFilter = ctx.createBiquadFilter(); this.grvFilter.type = 'lowpass'; this.grvFilter.frequency.value = 700;
      this.grvGain = ctx.createGain(); this.grvGain.gain.value = 0;
      this.grvSrc.connect(this.grvFilter); this.grvFilter.connect(this.grvGain); this.grvGain.connect(this.master);

      // --- vent : il ne dépend que de la vitesse, et il tient la scène quand on lève le pied ---
      this.windSrc = noise();
      this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 500; this.windFilter.Q.value = 0.5;
      this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
      this.windSrc.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(this.master);

      this.started = true;
      this.setEnabled(this.enabled);
    } catch (e) { this.ctx = null; }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.05);
  }

  /** Le rapport engagé et le régime qui en découle, à cette vitesse. */
  _gearbox(v, vmax, e) {
    const f = Math.min(1, Math.max(0, v / vmax));
    let g = 0;
    while (g < GEARS.length - 1 && f > GEARS[g]) g++;
    const lo = g === 0 ? 0 : GEARS[g - 1], hi = GEARS[g];
    // Dans un rapport, le régime va d'un creux au rupteur. Le creux monte avec les rapports :
    // en première on repart de très bas, en cinquième la chute est faible.
    const bottom = 0.42 + g * 0.07;
    const k = (f - lo) / Math.max(1e-4, hi - lo);
    const rpm = e.idle + (e.redline - e.idle) * (bottom + (1 - bottom) * k);
    return { gear: g, rpm };
  }

  update(car, racing) {
    if (!this.started || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const fin = (x, d) => (Number.isFinite(x) ? x : d);
    const e = (car.cls && car.cls.engine) || { cyl: 8, redline: 7000, idle: 1000, rough: 0.3, bright: 0.6, turbo: 0 };
    if (this.spec !== e) { this.spec = e; this.eng.setPeriodicWave(this._wave(e)); }

    const v = Math.max(0, fin(car.v, 0));
    const vmax = car.cls.vmax;
    const thr = !!car.throttle;

    let rpm, gear;
    if (!racing) {
      // avant le départ : ralenti, et un coup de gaz si le pilote maintient
      rpm = e.idle * (thr ? 2.4 : 1);
      gear = 0;
    } else {
      const gb = this._gearbox(v, vmax, e);
      rpm = gb.rpm; gear = gb.gear;
      // pied levé, le moteur retombe vers le frein moteur plutôt que de rester au rupteur
      if (!thr) rpm = e.idle + (rpm - e.idle) * 0.88;
    }
    // le passage de rapport : on note l'instant pour couper brièvement le son
    if (gear !== this.gear) { if (gear > this.gear && racing) this.shiftT = t; this.gear = gear; }
    this.rpm += (rpm - this.rpm) * 0.35;
    const r = this.rpm;
    const load = thr ? 1 : 0;
    const frac = Math.min(1, Math.max(0, (r - e.idle) / (e.redline - e.idle)));

    // Un quatre-temps allume cyl/2 fois par tour : l'oscillateur tourne à la vitesse du
    // vilebrequin et la forme d'onde place l'allumage sur l'harmonique qu'il faut.
    const crank = Math.max(8, r / 60);
    this.eng.frequency.setTargetAtTime(crank, t, 0.02);

    // la coupure à l'embrayage : 90 ms de silence, ce qui suffit à entendre le rapport passer
    const shifting = t - this.shiftT < 0.09 ? 0.15 : 1;

    // Échappement : toujours là, plus sombre pied levé. Admission : seulement pied dedans, c'est
    // elle qui fait la différence entre pousser et rouler sur l'erre.
    this.exFilter.frequency.setTargetAtTime(240 + frac * (700 + 1500 * e.bright) + load * 300, t, 0.05);
    this.exGain.gain.setTargetAtTime((0.16 + frac * 0.2 + load * 0.05) * shifting, t, 0.04);
    this.inFilter.frequency.setTargetAtTime(700 + frac * 2600 * e.bright, t, 0.05);
    this.inGain.gain.setTargetAtTime(load * (0.03 + frac * 0.13) * e.bright * shifting, t, 0.05);
    this.airFilter.frequency.setTargetAtTime(500 + frac * 1800, t, 0.05);
    this.airGain.gain.setTargetAtTime(load * (0.015 + frac * 0.05) * shifting, t, 0.06);

    // turbo : la pression monte avec le régime, et retombe d'un coup au lever de pied
    this.turbo.frequency.setTargetAtTime(2200 + frac * 4200, t, 0.08);
    this.turboGain.gain.setTargetAtTime(e.turbo * load * frac * frac * 0.045, t, load ? 0.25 : 0.05);

    // pneus : la hauteur monte avec la vitesse, le volume avec le glissement
    const sq = car.state === 'ok' ? Math.min(1, fin(car.slide, 0) * 1.7) : 0;
    this.sqGain.gain.setTargetAtTime(sq * sq * 0.3, t, 0.03);
    this.sq1.frequency.setTargetAtTime(1200 + v * 12 + sq * 500, t, 0.05);
    this.sq2.frequency.setTargetAtTime(600 + v * 5, t, 0.05);

    // gravier : d'autant plus fort qu'on y arrive vite
    const off = car.state === 'grass' ? Math.min(1, v / 25) : 0;
    this.grvGain.gain.setTargetAtTime(off * 0.34, t, 0.05);
    this.grvFilter.frequency.setTargetAtTime(400 + v * 14, t, 0.08);

    // vent : il ne sait rien du moteur, il ne connaît que la vitesse
    const w = Math.min(1, v / vmax);
    this.windGain.gain.setTargetAtTime(w * w * 0.11, t, 0.1);
    this.windFilter.frequency.setTargetAtTime(350 + v * 9, t, 0.1);
  }

  idle() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    for (const g of [this.exGain, this.inGain, this.airGain, this.turboGain, this.sqGain, this.grvGain, this.windGain]) {
      if (g) g.gain.setTargetAtTime(0, t, 0.1);
    }
    this.rpm = 0; this.gear = 0;
  }

  thud() {
    if (!this.started || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.35);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.45);
    // le choc emporte aussi une gerbe de bruit : un choc sans matière sonne creux
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
    const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 1400;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.5, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    n.connect(nf); nf.connect(ng); ng.connect(this.master); n.start(t); n.stop(t + 0.32);
  }

  beep(freq, dur, vol) {
    if (!this.started || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol || 0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + (dur || 0.15));
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + (dur || 0.15) + 0.05);
  }
}
