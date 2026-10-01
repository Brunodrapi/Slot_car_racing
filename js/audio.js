/* Le son des voitures.

Le moteur vient de `js/engine-audio.js`, porté de markeasting/engine-audio (MIT). Ce fichier ne
fabrique plus aucun timbre de moteur : il tient le reste de la scène — pneus, gravier, vent, choc —
et il sert d'aiguillage entre la voiture qui roule et le volant d'inertie qui sonne.

CE QU'IL Y AVAIT AVANT, ET POURQUOI C'EST PARTI. Un oscillateur unique muni d'une `PeriodicWave`
dont les coefficients étaient les ordres moteur, filtré en échappement et en admission, plus un
souffle, un clapot de ralenti modulé en anneau et un sifflement de turbo ; puis, par-dessus, un
lecteur granulaire qui se déplaçait dans une montée enregistrée sans jamais la transposer.

Le raisonnement tenait : la différence entre un six en ligne et un V12 est arithmétique, un
quatre-temps allume cyl/2 fois par tour, donc une octave sépare les deux sans rien enregistrer. Il
était même vérifiable, et vérifié — les pics mesurés tombaient à un demi pour cent de l'allumage
attendu sur les neuf voitures.

Ce qui lui manquait n'était pas la justesse, c'était le RÉPERTOIRE. Un régime déduit de la vitesse
par une règle de trois ne sait faire qu'une chose : monter et descendre. Pas de trou au passage de
rapport, pas de rebond contre le rupteur, pas de frein moteur qui retient, pas d'embrayage qui
patine au départ. Le nouveau moteur intègre un volant d'inertie vingt fois par image ; tout cela en
sort au lieu d'être imité.

Le reste de ce fichier — pneus, gravier, vent — n'a pas bougé : il ne dépendait que de la vitesse
et du glissement, et il avait raison. */
'use strict';

// Le catalogue : quelle voiture joue quel jeu de prises. Voir `_catalogue`.
const CATALOGUE_URL = 'sounds/engine/voitures.json';

class GameAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.started = false;
    this.rpm = 0;           // lu par le HUD et par les mesures
    this.gear = 0;
  }
  /* Le catalogue : quelle voiture joue quel jeu de prises, et avec quel réglage.

  Il est demandé une fois, au démarrage du son, et jamais rechargé. S'il n'arrive pas — réseau
  coupé, fichier absent — `this.catalogue` reste faux et le moteur se tait, ce qui est franc : il
  n'y a plus de synthèse derrière pour faire semblant. Les pneus, le gravier et le vent, eux,
  continuent de jouer. */
  _catalogue() {
    if (this.catFetch) return;
    this.catFetch = fetch(CATALOGUE_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((c) => { this.catalogue = c; })
      .catch(() => { this.catalogue = false; });
  }

  /* La voiture change : sa configuration, et son jeu de prises s'il n'est pas déjà là.

  Une voiture absente du catalogue — celles de l'atelier — joue le jeu de la M1 avec son propre
  rupteur et son propre ralenti. C'est la règle posée quand la M1 est devenue le moteur par défaut,
  et elle vaut toujours : aucune voiture du jeu ne doit rester muette. */
  _voiture(cls) {
    const cat = this.catalogue;
    if (!cat || !cls) return;
    const e = cls.engine || {};
    const c = cat.voitures[cls.id] || {
      jeu: 'procar', wheel_radius: 0.32,
      engine: { limiter: e.redline || 7000, idle: e.idle || 1000 }, drivetrain: {},
    };
    const j = cat.jeux[c.jeu];
    if (!j) return;
    const conf = {
      engine: Object.assign({}, j.engine, c.engine),
      drivetrain: Object.assign({}, j.drivetrain, c.drivetrain),
      wheel_radius: c.wheel_radius || 0.32,
      // c'est elle qui accorde le pont : le dernier rapport doit atteindre le rupteur à cette vitesse
      vmax: cls.vmax,
    };
    // le rupteur de la voiture entraîne sa zone molle, sinon on garderait celle du jeu de prises
    if (c.engine && c.engine.limiter && c.engine.soft_limiter == null) {
      conf.engine.soft_limiter = c.engine.limiter * 0.99;
    }
    this.conf = conf;
    this.vehicule = new EAVehicle(conf);
    if (this.jeu !== c.jeu) {
      this.jeu = c.jeu;
      this.pret = false;
      this.rate = false;
      this.sampler.charge(j.sounds, '', j.niveau)
        .then(() => { this.pret = true; })
        // Un échec est DÉFINITIF et doit se dire comme tel : `pret` resterait faux, et une barrière
        // de chargement qui lit « pas prêt » attendrait son délai entier à chaque course pour un
        // fichier qui n'arrivera jamais.
        .catch(() => { this.pret = false; this.rate = true; });
    }
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

      /* --- moteur : le volant d'inertie de engine-audio, et ses quatre boucles ---

      Ce qui était ici a été retiré en entier : deux oscillateurs filtrés en échappement et en
      admission, un souffle d'admission, un clapot de ralenti modulé en anneau, un sifflement de
      turbo, et par-dessus un lecteur granulaire qui se déplaçait dans une montée enregistrée.
      Tout cela FABRIQUAIT un timbre ; des prises en portent un. Et la montée enregistrée, si juste
      fût-elle, ne savait rien faire d'autre que monter — ni pied levé, ni trou au passage, ni
      rebond au rupteur, ni ralenti.

      À la place, le modèle de markeasting/engine-audio : un volant d'inertie intégré vingt fois
      par image, et quatre boucles stationnaires mélangées par deux fondus. Voir
      `js/engine-audio.js`, qui porte la licence MIT et le détail. */
      this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
      this.engGain.connect(this.master);
      this.sampler = new EASampler(ctx, this.engGain);
      this.vehicule = null;        // construit dès qu'on sait quelle voiture joue
      this.jeu = null;             // le jeu de prises en cours de lecture
      this.pret = false;           // les boucles sont-elles arrivées ?
      this.rate = false;           // ou ne viendront-elles jamais ?
      this.catalogue = null;
      this._catalogue();
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

  /* Y a-t-il encore un son à attendre avant de lâcher une course ?

  La question n'est pas « est-ce prêt » mais « est-ce que ça va venir ». Les trois cas où il n'y a
  rien à attendre se ressemblent beaucoup et ne doivent surtout pas se confondre avec « en cours » :
  le son est coupé, le moteur n'a jamais démarré faute de geste, ou le téléchargement a échoué pour
  de bon. Les confondre, c'est faire patienter le joueur le délai entier devant un fichier absent. */
  pretAJouer() {
    if (!this.enabled || !this.started) return true;
    if (this.catalogue === false || this.rate) return true;
    if (!this.catalogue) return false;
    return this.pret !== false;
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.05);
  }

  update(car, racing) {
    if (!this.started || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const fin = (x, d) => (Number.isFinite(x) ? x : d);
    const cls = car.cls || {};
    const v = Math.max(0, fin(car.v, 0));
    const vmax = cls.vmax || 80;
    const thr = !!car.throttle;

    if (this.catalogue && this.clsId !== cls.id) { this.clsId = cls.id; this._voiture(cls); }

    if (this.vehicule) {
      /* Le pas de temps vient de l'horloge du SON, pas de celle du jeu.

      C'est elle qui fait avancer les boucles, et elle seule ; prendre celle du jeu ferait dériver
      le régime de ce qu'on entend dès que le rendu décroche. Il est borné parce qu'un onglet
      revenu au premier plan livre parfois une seconde d'un coup, et qu'une seconde d'un coup dans
      un intégrateur, c'est un moteur qui explose. */
      const dt = Math.min(0.05, Math.max(1 / 240, t - (this.tPrec == null ? t : this.tPrec)));
      this.tPrec = t;
      /* Avant le départ, la voiture est à l'arrêt et c'est tout ce qu'on a à dire : l'embrayage
      patine, donc le moteur idle et monte seul si le pilote maintient. Le modèle s'en charge, il
      n'y a aucun cas particulier à écrire — l'ancien moteur, lui, devait fabriquer ce coup de gaz
      à la main. */
      this.vehicule.update(t * 1000, dt, racing ? v : 0, thr ? 1 : 0);
      this.sampler.applique(this.vehicule.engine);
      this.rpm = this.vehicule.engine.rpm;
      this.gear = this.vehicule.drivetrain.gear;
      this.engGain.gain.setTargetAtTime(this.pret ? 0.85 : 0, t, 0.08);
    }

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
    for (const g of [this.engGain, this.sqGain, this.grvGain, this.windGain]) {
      if (g) g.gain.setTargetAtTime(0, t, 0.1);
    }
    // le volant garde sa vitesse sinon : on le rend au ralenti, sans quoi reprendre une course
    // repartirait au régime où la précédente s'est arrêtée
    if (this.vehicule) this.vehicule.engine.init(this.conf && this.conf.engine);
    this.tPrec = null;
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
