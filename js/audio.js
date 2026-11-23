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
    this.prisesAbandon = new Map();
    this.commentaireId = 0;
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

  /* Remettre le son en état, au départ de chaque course.

  Bruno : « je perds le son si je quitte une partie et que j'en relance une ». Six chemins de sortie
  et de relance ont été passés au banc (`tools/e2e-son-relance.js`) sans rien perdre, donc ce n'est
  pas la relance elle-même qui casse — c'est que RIEN NE RÉPARE. Deux pannes ordinaires, hors de
  portée d'un essai de bureau, ne se rattrapaient jamais une fois arrivées :

  — Le contexte audio suspendu. Un navigateur le suspend quand l'onglet passe en arrière-plan, quand
    un appel arrive, quand l'écran se verrouille. `resume()` n'était appelé qu'au premier appui et
    sur un bouton de l'interface ; revenir dans le jeu par un autre chemin laissait tout muet, pour
    de bon.
  — Un téléchargement de prises échoué. Le jeu de boucles restait marqué perdu pour la session
    entière : une coupure de réseau d'une seconde, et plus de moteur jusqu'au rechargement de la
    page. C'est le genre de panne qu'on ne relie pas à sa cause, donc qu'on décrit comme « j'ai
    perdu le son en relançant ».

  Une course qui démarre est le bon moment pour tout remettre d'aplomb : c'est là que le son compte,
  et c'est un geste du joueur, donc un contexte autorisé à reprendre. */
  relance(avecAbandon = false) {
    this.arreteCommentaire();
    this.start();
    if (avecAbandon && this.ctx && this.enabled) {
      this._priseAbandon('big_shock');
      this._priseAbandon('too_much_hits');
    }
    this.resume();
    if (this.rate) { this.rate = false; this.jeu = null; this.clsId = null; }
  }

  _priseAbandon(nom) {
    if (!this.prisesAbandon.has(nom)) {
      const prise = fetch('sounds/abandon/' + nom + '.mp3')
        .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(data => this.ctx.decodeAudioData(data))
        .catch(() => { this.prisesAbandon.delete(nom); return null; });
      this.prisesAbandon.set(nom, prise);
    }
    return this.prisesAbandon.get(nom);
  }

  async joueAbandon(grosChoc) {
    if (!this.started || !this.enabled) return;
    this.arreteCommentaire();
    const id = this.commentaireId;
    const prise = await this._priseAbandon(grosChoc ? 'big_shock' : 'too_much_hits');
    if (!prise || id !== this.commentaireId) return;
    const source = this.ctx.createBufferSource();
    source.buffer = prise;
    source.connect(this.master);
    source.onended = () => { if (this.commentaire === source) this.commentaire = null; };
    this.commentaire = source;
    source.start();
  }

  arreteCommentaire() {
    this.commentaireId++;
    if (this.commentaire) this.commentaire.stop();
    this.commentaire = null;
  }

  setEnabled(on) {
    if (!on) this.arreteCommentaire();
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
    const thr = throttleAmount(car.throttle);
    const spin = racing && (car.state === 'ok' || car.runoffAsphalt) && !car.inPit
      ? clamp(fin(car.patineFx, 0), 0, 1) : 0;

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
      this.vehicule.update(t * 1000, dt, racing ? v : 0, thr, spin);
      this.sampler.applique(this.vehicule.engine);
      this.rpm = this.vehicule.engine.rpm;
      this.gear = this.vehicule.drivetrain.gear;
      this.engGain.gain.setTargetAtTime(this.pret && !car.engineStopped ? 0.85 : 0, t, 0.04);
    }

    // pneus : la hauteur monte avec la vitesse, le volume avec le glissement
    // La dérive et le patinage peuvent coexister sans doubler le volume maximal.
    const lateral = clamp(fin(car.slide, 0) * 1.7, 0, 1);
    const sq = racing && (car.state === 'ok' || car.runoffAsphalt) && !car.inPit ? 1 - (1 - lateral) * (1 - spin * 0.85) : 0;
    this.sqGain.gain.setTargetAtTime(sq * sq * 0.3, t, 0.03);
    this.sq1.frequency.setTargetAtTime(1200 + v * 12 + sq * 500, t, 0.05);
    this.sq2.frequency.setTargetAtTime(600 + v * 5, t, 0.05);

    // gravier : d'autant plus fort qu'on y arrive vite
    const off = car.state === 'grass' && !car.runoffAsphalt ? Math.min(1, v / 25) : 0;
    this.grvGain.gain.setTargetAtTime(off * 0.34, t, 0.05);
    this.grvFilter.frequency.setTargetAtTime(400 + v * 14, t, 0.08);

    // vent : il ne sait rien du moteur, il ne connaît que la vitesse
    const w = Math.min(1, v / vmax);
    this.windGain.gain.setTargetAtTime(w * w * 0.11, t, 0.1);
    this.windFilter.frequency.setTargetAtTime(350 + v * 9, t, 0.1);
    this._stand(car, t);
  }

  /* LES BRUITS DU STAND (essai des dégâts) : « cling, clac, zout zout ».

  Tant que la voiture est arrêtée dans sa case, l'équipe travaille : des clés qui tintent (cling),
  des pièces qu'on claque (clac), et la visseuse à chocs, deux coups (zout zout). Elle ouvre toujours
  le bal, puis deux ou trois outils, puis de nouveau la visseuse, à quelques dixièmes de seconde
  d'écart, jusqu'à ce que la voiture reparte. Fabriqués ici, sans fichier, comme le clac du levier : quelques dixièmes de
  seconde ne valent pas un téléchargement. */
  _stand(car, t) {
    if (car.pitState !== 'arret') { this.standProchain = null; return; }
    if (this.standProchain == null) { this.standProchain = t + 0.15; this.standN = 0; this.standOutils = 99; }
    if (t < this.standProchain) return;
    this.standN++;
    /* Le rythme d'une équipe : la visseuse, puis deux ou trois outils, puis la visseuse… Tiré tout au
    hasard, il arrivait d'enchaîner cinq visseuses sans une clé. */
    if (this.standOutils >= 2 + (Math.random() < 0.5 ? 1 : 0)) {
      this.zout(t); this.standOutils = 0; this.standProchain = t + 0.8 + Math.random() * 0.3;
    } else {
      this.standOutils++;
      if (Math.random() < 0.55) { this.cling(t); this.standProchain = t + 0.18 + Math.random() * 0.32; }
      else { this.clacStand(t); this.standProchain = t + 0.22 + Math.random() * 0.32; }
    }
  }

  // Une clé qui tinte : trois partiels inharmoniques, comme une barre de métal frappée, l'aigu
  // s'éteignant le premier.
  cling(t) {
    if (!this.started || !this.enabled) return;
    const ctx = this.ctx, f = 1900 + Math.random() * 900;
    for (const [k, a, d] of [[1, 0.2, 0.32], [2.76, 0.11, 0.18], [5.4, 0.05, 0.1]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * k;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(a, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + d + 0.02);
    }
  }

  // Une pièce qu'on claque : un éclat de bruit, et le choc sourd de ce qui retombe en place.
  clacStand(t) {
    if (!this.started || !this.enabled) return;
    const ctx = this.ctx;
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300 + Math.random() * 500; bp.Q.value = 2.2;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.55, t + 0.002); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.connect(bp); bp.connect(ng); ng.connect(this.master); n.start(t, Math.random() * 0.5); n.stop(t + 0.07);
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.08);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.45, t + 0.003); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.12);
  }

  /* La visseuse à chocs : deux coups, zout zout. Une dent de scie grave qui monte un peu (le moteur
  de l'outil qui lance), hachée trente fois par seconde (les chocs du marteau), et un souffle d'air
  par-dessus. */
  zout(t) {
    if (!this.started || !this.enabled) return;
    const ctx = this.ctx;
    for (const d0 of [0, 0.3]) {
      const t0 = t + d0, dur = 0.22;
      const env = ctx.createGain(); env.gain.setValueAtTime(0.0001, t0);
      env.gain.exponentialRampToValueAtTime(0.42, t0 + 0.015); env.gain.setValueAtTime(0.42, t0 + dur - 0.04);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      env.connect(this.master);
      const hache = ctx.createGain(); hache.gain.value = 0.5; hache.connect(env);
      const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 32;
      const lfoG = ctx.createGain(); lfoG.gain.value = 0.5; lfo.connect(lfoG); lfoG.connect(hache.gain);
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(95, t0); o.frequency.linearRampToValueAtTime(150, t0 + dur);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.2;
      o.connect(bp); bp.connect(hache);
      const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
      const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 3000; nf.Q.value = 1;
      const ng = ctx.createGain(); ng.gain.value = 0.25;
      n.connect(nf); nf.connect(ng); ng.connect(hache);
      for (const src of [o, lfo, n]) { src.start(t0); src.stop(t0 + dur + 0.02); }
    }
  }

  idle({ laisserFinirCommentaire = false } = {}) {
    if (!laisserFinirCommentaire) this.arreteCommentaire();
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

  /* LE CLAC DU LEVIER, quand la poignée tombe dans un cran.

  Deux sons à la fois, comme un vrai levier de vitesse : le claquement du métal — un éclat de bruit,
  bref et aigu — et le corps de la poignée qui tombe dans l'encoche, une note grave qui chute. Un peu
  plus aigu en montant qu'en descendant, pour que l'oreille dise le sens sans regarder. Fabriqué ici
  plutôt qu'enregistré : quarante millisecondes ne valent pas un fichier à télécharger. */
  clac(sens) {
    if (!this.started || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = sens > 0 ? 3400 : 2800; bp.Q.value = 2.5;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.6, t + 0.002); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    n.connect(bp); bp.connect(ng); ng.connect(this.master); n.start(t, Math.random() * 0.5); n.stop(t + 0.05);
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(sens > 0 ? 230 : 190, t); o.frequency.exponentialRampToValueAtTime(85, t + 0.055);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.003); g.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.09);
  }

  // A held tone cuts through the engine better than the short decaying UI beep.
  // Triggered only by a completed player lap, including invalid laps and the last lap.
  lapBeep(best = false) {
    if (!this.started || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = best ? 1480 : 1200;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(.45, t + .006);
    g.gain.setValueAtTime(.45, t + .11);
    g.gain.exponentialRampToValueAtTime(.001, t + .21);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .23);
  }

  beep(freq, dur, vol) {
    if (!this.started || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol || 0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + (dur || 0.15));
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + (dur || 0.15) + 0.05);
  }
}
