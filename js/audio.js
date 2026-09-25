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

      // Voie d'enregistrement, à côté de la synthèse. Une prise porte déjà son timbre : elle ne
      // repasse donc pas par les filtres d'échappement et d'admission, qui sont là pour fabriquer
      // un timbre qu'elle a déjà. Elle a sa propre sortie, et un filtre léger, seulement pour
      // assombrir le pied levé.
      this.smpGain = ctx.createGain(); this.smpGain.gain.value = 0;
      this.smpFilter = ctx.createBiquadFilter(); this.smpFilter.type = 'lowpass';
      this.smpFilter.frequency.value = 6000; this.smpFilter.Q.value = 0.7;
      this.smpFilter.connect(this.smpGain); this.smpGain.connect(this.master);
      // Une voix par boucle, toutes en marche en permanence, seuls les gains bougent. Réaffecter
      // deux voix au fil du régime obligerait à recréer une source — le tampon d'une source ne se
      // change pas — et chaque création claque. Six sources qui tournent ne coûtent rien.
      // Lecture granulaire : pas de boucle, pas de transposition. On se déplace dans une montée
      // en régime enregistrée et on y prend des grains là où le moteur tournait vraiment à ce
      // régime-là. La littérature du son de moteur de jeu est nette sur le point qui condamnait
      // l'approche précédente : une boucle commence à sonner étirée dès qu'on la transpose de plus
      // de 500 tr/min, soit sept dixièmes de demi-ton à 6000. Couvrir trois octaves en
      // transposant est donc perdu d'avance ; les moteurs granulaires ne transposent pas.
      this.ramp = null; this.rampFetching = null;
      this.gTime = 0;      // l'instant du prochain grain, en temps de contexte
      this.gRead = 0;      // où l'on en est dans la rampe, en secondes

      // souffle d'admission : du bruit filtré au régime, présent seulement pied dedans
      this.airSrc = noise();
      this.airFilter = ctx.createBiquadFilter(); this.airFilter.type = 'bandpass';
      this.airFilter.frequency.value = 900; this.airFilter.Q.value = 0.8;
      this.airGain = ctx.createGain(); this.airGain.gain.value = 0;
      this.airSrc.connect(this.airFilter); this.airFilter.connect(this.airGain); this.airGain.connect(this.master);

      /* Le clapot du ralenti.

      Un moteur au ralenti ne fait pas entendre sa ligne d'échappement mais sa combustion : elle
      est irrégulière, un cylindre ne donne pas tout à fait comme le suivant, et la distribution
      claque. Sans cela un moteur « lisse » — une M1, une F40, `rough` à 0,15 — ne rend au ralenti
      qu'un bourdon mince et propre, là où une Corvette à 0,70 sonne juste par chance.

      D'où du bruit filtré, multiplié par le signal du moteur lui-même : le produit se module à la
      fréquence d'allumage, ce qui donne le « pouf-pouf » d'un ralenti au lieu d'un souffle. Le
      gain du multiplieur reste à zéro et c'est l'oscillateur, branché sur ce gain, qui le fait
      varier — une modulation en anneau, à la fréquence audio. */
      this.lopeSrc = noise();
      this.lopeBand = ctx.createBiquadFilter(); this.lopeBand.type = 'bandpass';
      this.lopeBand.frequency.value = 620; this.lopeBand.Q.value = 0.6;
      this.lopeMod = ctx.createGain(); this.lopeMod.gain.value = 0;
      this.eng.connect(this.lopeMod.gain);
      this.lopeGain = ctx.createGain(); this.lopeGain.gain.value = 0;
      this.lopeSrc.connect(this.lopeBand); this.lopeBand.connect(this.lopeMod);
      this.lopeMod.connect(this.lopeGain); this.lopeGain.connect(this.master);

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
  /* Charge la boucle d'une voiture, une seule fois, et la met à tourner.

  Tant qu'elle n'est pas là — et si elle n'arrive jamais — la synthèse continue de jouer : une
  voiture sans prise, un réseau lent ou un fichier manquant donnent le son d'avant, jamais du
  silence. */
  _key(e) { return e.sample ? e.sample.ramp : null; }

  /* Charge la rampe d'une voiture : le son et la table qui dit à quel instant le moteur passait
  par quel régime. Tant qu'elle n'est pas là — et si elle n'arrive jamais — la synthèse continue
  de jouer : une voiture sans prise, un réseau lent, un fichier manquant ou une page ouverte en
  `file://`, où `fetch` ne peut rien charger, donnent le son d'avant, jamais du silence. */
  _sample(e) {
    const key = this._key(e);
    if (!key || this.rampFetching === key) return;
    this.rampFetching = key;
    const ctx = this.ctx;
    fetch(key)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then(meta => fetch(meta.src)
        .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
        .then(b => ctx.decodeAudioData(b))
        .then(buf => { this.ramp = { key, buf, meta }; }))
      .catch(() => { this.ramp = null; });          // la synthèse reprend la main
  }

  /* Où se trouve, dans la rampe, le moteur à ce régime.

  La table est régulière en logarithme du régime, parce que c'est ainsi que l'oreille entend et
  que la hauteur a été suivie. Hors des bornes, on reste au bout : on ne transpose jamais. */
  _rampPos(rpm) {
    const m = this.ramp.meta, T = m.table;
    const u = Math.log(Math.max(1, rpm) / m.rpmBas) / Math.log(m.rpmHaut / m.rpmBas);
    const x = Math.max(0, Math.min(1, u)) * (T.length - 1);
    const i = Math.min(T.length - 2, Math.floor(x));
    return T[i] + (T[i + 1] - T[i]) * (x - i);
  }

  /* Sème les grains qui manquent pour tenir jusqu'au prochain appel.

  Enveloppe triangulaire et recouvrement de moitié : la somme de deux enveloppes voisines vaut
  exactement un, donc le niveau ne bouge pas d'un grain à l'autre et il n'y a pas de raccord à
  entendre. La tête de lecture avance d'elle-même au rythme du son — ce qui redonne au moteur ses
  irrégularités de cycle, qu'une boucle écrase — et se recale sur la position du régime dès
  qu'elle s'en éloigne. */
  _grains(t, rpm, gain) {
    const ctx = this.ctx, r = this.ramp;
    const G = 0.09, HOP = G / 2, AVANCE = 0.12;
    const pos = this._rampPos(rpm);
    if (this.gTime < t) { this.gTime = t; this.gRead = pos; }
    while (this.gTime < t + AVANCE) {
      // on laisse la lecture dériver un peu autour de la position visée, pas plus : au-delà, le
      // son ne correspondrait plus au régime demandé
      this.gRead += HOP;
      if (Math.abs(this.gRead - pos) > 0.20) this.gRead = pos;
      const off = Math.max(0, Math.min(r.meta.secondes - G, this.gRead));
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, this.gTime);
      g.gain.linearRampToValueAtTime(gain, this.gTime + HOP);
      g.gain.linearRampToValueAtTime(0, this.gTime + G);
      g.connect(this.smpFilter);
      const n = ctx.createBufferSource();
      n.buffer = r.buf;
      n.connect(g);
      n.start(this.gTime, off, G);
      n.stop(this.gTime + G);
      n.onended = () => { try { g.disconnect(); } catch (_) { /* déjà parti */ } };
      this.gTime += HOP;
    }
  }

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
    if (this.spec !== e) {
      this.spec = e;
      this.eng.setPeriodicWave(this._wave(e));
      this._sample(e);
      // La voiture n'a pas de prise, ou en a une autre : on oublie celle qui jouait.
      if (this.ramp && this.ramp.key !== this._key(e)) this.ramp = null;
      if (!e.sample) this.rampFetching = null;
      this.gTime = 0;
      if (!this.ramp) {
        // Plus aucun grain n'alimente ce gain : il n'est plus audible, mais il reste figé sur sa
        // dernière valeur, que le navigateur cesse d'évaluer. On le remet à zéro à la main.
        this.smpGain.gain.cancelScheduledValues(ctx.currentTime);
        this.smpGain.gain.value = 0;
      }
    }
    // Une prise est jouée si elle est arrivée ; sinon la synthèse, qui n'a jamais cessé de tourner.
    const surPrise = !!(this.ramp && e.sample && this.ramp.key === this._key(e));

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

    // La prise a été faite à un régime connu : la rejouer `r / ce régime` fois plus vite la
    // transpose exactement là où le moteur tourne. C'est la même opération qu'un oscillateur dont
    // on change la fréquence, à ceci près que la matière transposée est celle d'un vrai moteur.
    // Une prise ne couvre que la plage de régimes où elle a été enregistrée. En deçà et au-delà,
    // il n'y a rien à jouer — et surtout pas la transposer, ce qui est justement ce qu'on veut
    // éviter. La synthèse reprend la main, en fondu.
    let couv = 0;
    if (surPrise) {
      const m = this.ramp.meta;
      const marge = 0.25;                                  // un quart d'octave de fondu
      const d = r < m.rpmBas ? Math.log2(m.rpmBas / r) : r > m.rpmHaut ? Math.log2(r / m.rpmHaut) : 0;
      couv = Math.max(0, Math.min(1, 1 - d / marge));
    }

    if (surPrise && couv > 0) {
      this._grains(t, r, 0.62);
      this.smpFilter.frequency.setTargetAtTime(1800 + frac * 5000 + load * 2200, t, 0.05);
    }

    // la coupure à l'embrayage : 90 ms de silence, ce qui suffit à entendre le rapport passer
    const shifting = t - this.shiftT < 0.09 ? 0.15 : 1;

    // Échappement : toujours là, plus sombre pied levé. Admission : seulement pied dedans, c'est
    // elle qui fait la différence entre pousser et rouler sur l'erre.
    this.exFilter.frequency.setTargetAtTime(240 + frac * (700 + 1500 * e.bright) + load * 300, t, 0.05);
    this.exGain.gain.setTargetAtTime((0.16 + frac * 0.2 + load * 0.05) * shifting * (1 - couv), t, 0.04);
    this.smpGain.gain.setTargetAtTime((0.30 + frac * 0.24 + load * 0.08) * shifting * couv, t, 0.04);
    this.inFilter.frequency.setTargetAtTime(700 + frac * 2600 * e.bright, t, 0.05);
    this.inGain.gain.setTargetAtTime(load * (0.03 + frac * 0.13) * e.bright * shifting * (1 - couv), t, 0.05);
    this.airFilter.frequency.setTargetAtTime(500 + frac * 1800, t, 0.05);
    this.airGain.gain.setTargetAtTime(load * (0.015 + frac * 0.05) * shifting, t, 0.06);

    // turbo : la pression monte avec le régime, et retombe d'un coup au lever de pied
    // Le clapot ne vit qu'en bas et pied levé : dès que le moteur monte ou pousse, c'est la ligne
    // d'échappement qu'on entend, et lui laisser la place brouillerait le reste. Il ne joue que
    // sur la voie de synthèse — une prise porte déjà son propre ralenti quand elle en a un.
    const clapot = (1 - frac) * (1 - frac) * (1 - load * 0.75) * (1 - couv);
    this.lopeBand.frequency.setTargetAtTime(200 + 320 * e.bright, t, 0.1);
    this.lopeGain.gain.setTargetAtTime(clapot * (0.5 + 0.9 * (1 - e.rough)) * 0.30 * shifting, t, 0.06);

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
