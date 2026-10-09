// App: game loop, input (throttle + line slider), flow between menus and races, career progression,
// user content (custom tracks and car models).
'use strict';

class App {
  constructor() {
    this.save = loadSave();
    this.canvas = document.getElementById('game');
    this.renderer = new Renderer(this.canvas);
    this.renderer.showLines = this.save.showLines === true;
    this.renderer.setView(this.save.view || 'avanceFixe');
    this.renderer.setPullBack(this.save.pullBack || 1);
    PHYS.aimant = this.save.aimant || 0;
    PHYS.ff = this.save.ff == null ? 0.3 : this.save.ff;
    this.renderer.debug = this.save.debug === true;
    this.audio = new GameAudio();
    this.audio.enabled = this.save.sound;
    this.ui = new UI(this);
    this.tracks = new Map();
    this.custom = { tracks: [], cars: [], lines: new Map(), panneaux: new Map() };
    this.race = null;
    // Racing together. The table stays open across races; the game only ever asks the net layer
    // two things: who is on the grid, and what the others are doing.
    this.net = typeof Net === 'undefined' ? null : new Net();
    if (this.net) {
      this.net.onPeers = () => { if (this.state === 'lobby') this.ui.lobbyScreen(); };
      this.net.onStart = (cfg) => this.startOnline(cfg);
    }
    this.raceCtx = null;
    /* Revenir dans le jeu reprend le son.

    Un onglet qui passe en arrière-plan fait suspendre le contexte audio par le navigateur, et rien
    ne le reprenait au retour : le joueur revenait sur une course muette sans comprendre pourquoi.
    Reprendre au retour de visibilité est exactement ce que la règle du navigateur autorise — le
    geste d'origine a déjà eu lieu. */
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.audio) this.audio.resume();
      });
    }
    // L'état de la barrière de chargement : ce qu'on attend, et depuis quand on l'attend.
    this.chargement = null;
    this.chargeDes = null;
    this.state = 'splash';
    this.input = { throttle: false, sel: 0, pit: false };
    this.pointers = { throttle: null, slider: null };
    this.last = performance.now();
    this._bindInput();
    window.addEventListener('resize', () => { this.renderer.resize(); if (this.race) this.renderer._makeMinimap(); });
    // le tableau mondial : il se débrouille seul, et son absence n'empêche rien
    this.mondial = new Mondial();
    /* Au retour d'une connexion Google, on déclare son pseudo tout de suite.

    Le serveur prend le nom dans la base et jamais dans la requête ; sans cette ligne, le premier
    record proposé serait refusé pour « pseudo », et le joueur n'aurait aucun moyen de deviner
    pourquoi. On le fait à la connexion, au moment où rien ne presse. */
    /* Le nom est posé SANS condition, même hors connexion.

    Le poser seulement quand on est déjà connecté laissait sans nom celui qui se connecte en cours
    de partie : ses temps partaient avec une chaîne vide et le serveur les refusait pour « forme du
    pseudo », ce qui n'a aucun sens vu de l'écran. Poser une chaîne ne coûte rien. */
    this.mondial.poseNom(this.playerName());
    if (this.mondial.connecte() && this.save.name) {
      /* Plus d'ordre à respecter : le nom voyage AVEC chaque temps.

      Il fallait auparavant l'écrire en base avant de proposer quoi que ce soit, sous peine de voir
      tout le rattrapage refusé à la première connexion — exactement celle où il sert. La
      contrainte a disparu avec l'écriture : on pose le nom, et c'est tout. */
      this.mondial.rattrape(this.save.bestLapsNets).catch(() => {});
    }
    this.ui.splash();
    this.refreshCustom().then(() => {
      const params = new URLSearchParams(location.search);
      const tid = params.get('track');
      // A link that names a circuit is someone who already knows where they are going, so the
      // title card steps aside for them.
      if (tid && this.trackDefById(tid)) { this.state = 'menu'; this.ui.setup.trackId = tid; this.ui.setupScreen('race'); }
      else if (this.state === 'splash') this.ui.splash();
    });
    requestAnimationFrame((t) => this._frame(t));
  }

  /* ---------- content ----------

  Les trajectoires reprises à la main se posent ici, au seul endroit par lequel toute définition de
  circuit passe. Un circuit intégré qui en porte une garde tout le reste — son tracé, sa largeur,
  son décor — et voit seulement ses trois lignes remplacées ; le solveur ne tourne alors plus pour
  lui, puisqu'un circuit qui porte ses lignes ne le réveille pas.

  C'est volontairement une reprise locale, dans la base du navigateur, et non une modification du
  jeu : elle vaut pour ce poste, tout de suite, sans rien publier. Pour qu'une ligne vaille pour
  tout le monde, il faut son bloc dans `js/tracks.js`, et `lignes.html` le produit aussi. */
  allTracks() {
    const rep = this.custom.lines, pan = this.custom.panneaux;
    const base = (rep && rep.size) || (pan && pan.size)
      ? TRACKS.map((t) => {
        if (!rep.has(t.id) && !pan.has(t.id)) return t;
        const nu = { ...t };
        if (rep.has(t.id)) nu.lines = rep.get(t.id);
        if (pan.has(t.id)) nu.panneaux = pan.get(t.id);
        return nu;
      })
      : TRACKS;
    return base.concat(this.custom.tracks);
  }
  trackDefById(id) { return this.allTracks().find(t => t.id === id) || null; }
  trackCache(id) {
    if (!this.tracks.has(id)) this.tracks.set(id, new Track(this.trackDefById(id)));
    return this.tracks.get(id);
  }
  async refreshCustom() {
    try {
      this.custom.tracks = (await Store.list('tracks')).map(t => ({ ...t, custom: true }));
      const reprises = await Store.list('lines');
      this.custom.lines = new Map(reprises.filter(r => r && r.lines && r.lines.racing).map(r => [r.id, r.lines]));
      for (const r of reprises) this.tracks.delete(r.id);      // le circuit en cache est périmé
      // Les panneaux repris : une liste VIDE compte, c'est « ce circuit n'en a aucun ».
      const pans = await Store.list('panneaux');
      this.custom.panneaux = new Map(pans.filter(r => r && Array.isArray(r.panneaux)).map(r => [r.id, r.panneaux]));
      for (const r of pans) this.tracks.delete(r.id);
      const cars = await Store.list('cars');
      for (const c of cars) {
        const sprite = { base: null, color: null, extra: [] };
        try {
          sprite.base = await loadImage(c.layers.base);
          if (c.layers.color) sprite.color = await loadImage(c.layers.color);
          for (const ex of c.layers.extra || []) sprite.extra.push(await loadImage(ex));
        } catch (e) { /* broken image: draw as vector */ }
        registerModel({ id: c.id, catId: c.catId, name: c.name, shape: 'gtBoxy', colors: ['#c9ced6', '#e0262c'], length: c.length, width: c.width, mul: c.mul || {}, sprite: sprite.base ? sprite : null, custom: true });
      }
      this.custom.cars = cars;
      for (const t of this.custom.tracks) this.tracks.delete(t.id);
    } catch (e) { console.warn('custom content unavailable', e); }
  }

  playerName() { return this.save.name || this.ui.t('playerDefault'); }
  playerModelFor(catId) {
    const saved = this.save.models && this.save.models[catId];
    const m = saved && modelById(saved);
    return (m && m.catId === catId) ? m : modelsOf(catId)[0];
  }

  /* La livrée choisie pour un modèle donné, rangée par MODÈLE et non par catégorie.

  Choisir une CSL Castrol puis passer à la 935 puis revenir doit rendre la Castrol : une livrée
  appartient à la voiture, pas au joueur. L'indice est gardé tel quel, sans le ramener dans les
  bornes à l'enregistrement : c'est la lecture qui le fait tourner, si bien qu'ajouter une quatrième
  livrée plus tard ne décale aucune sauvegarde existante. */
  playerLivreeFor(modelId) {
    const n = this.save.livrees && this.save.livrees[modelId];
    return Number.isFinite(n) ? n : 0;
  }

  // ---------- input ----------
  _bindInput() {
    const on = () => { this.input.throttle = true; this.audio.start(); this.audio.resume(); };
    const off = () => { this.input.throttle = false; };
    /* Une seule porte pour la position du levier, clavier comme doigt.

    `pit` n'est pas une quatrième ligne, c'est une intention : la course la lit séparément de
    `sel`, qui reste la trajectoire. Les deux sont posés ensemble ici pour qu'ils ne puissent pas
    diverger — un levier qui dirait « stands » pendant que la voiture vise encore l'intérieur
    serait un bug impossible à voir autrement qu'en jouant. */
    const poseSel = (v) => {
      this.input.pit = v <= -1.5;
      this.input.sel = clamp(v, -1, 1);
    };
    // au clavier on descend d'un cran de plus quand les stands sont ouverts, sinon un joueur sur
    // ordinateur n'aurait aucun moyen de s'arrêter
    const stepSel = (d) => {
      const bas = this.renderer && this.renderer.pitOpen ? -2 : -1;
      const v = Math.round(this.input.pit ? -2 : this.input.sel) + d;
      poseSel(clamp(v, bas, 1));
    };
    const LINE_DOWN = ['ArrowDown', 'ArrowLeft', 'a', 'A', 'q', 'Q'], LINE_UP = ['ArrowUp', 'ArrowRight', 'd', 'D', 'e', 'E'];
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (this.leaveSplash()) return;
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { this.togglePause(); return; }
      if (this.state !== 'race') return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      e.preventDefault();
      if (e.key === 'g' || e.key === 'G') { this.renderer.debug = !this.renderer.debug; this.save.debug = this.renderer.debug; storeSave(this.save); return; }
      if (LINE_DOWN.includes(e.key)) { stepSel(-1); return; }
      if (LINE_UP.includes(e.key)) { stepSel(1); return; }
      on();
    });
    window.addEventListener('keyup', (e) => { if (LINE_DOWN.includes(e.key) || LINE_UP.includes(e.key) || e.key === 'Escape' || e.key === 'g' || e.key === 'G') return; off(); });
    window.addEventListener('blur', () => { off(); this.pointers.throttle = this.pointers.slider = null; });
    // On the title card the whole window listens, not just the canvas: the poster fills the page,
    // and "any button" has to mean anywhere on it.
    window.addEventListener('pointerdown', () => this.leaveSplash());
    window.addEventListener('wheel', (e) => { if (this.state === 'race') stepSel(e.deltaY < 0 ? 1 : -1); }, { passive: true });

    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (this.state !== 'race') return;
      e.preventDefault();
      const touch = e.pointerType === 'touch';
      if (touch) this.renderer.touch = true;
      /* La pause d'abord : sans ce test, l'appui repartirait dans la branche d'en dessous, qui prend
      tout ce qui n'est pas le curseur pour de l'accélérateur. On sort sans toucher à `pointers`,
      donc aucun doigt n'est retenu et le relâchement n'a rien à défaire. */
      if (this.renderer.pauseHitAt(e.clientX, e.clientY)) { this.togglePause(); return; }
      const v = this.renderer.sliderValueAt(e.clientX, e.clientY, touch);
      if (v != null && this.pointers.slider == null) { this.pointers.slider = e.pointerId; poseSel(v); return; }
      if (this.pointers.throttle == null) {
        this.pointers.throttle = e.pointerId;
        if (touch) this.renderer.anchorDial(e.clientX, e.clientY);   // the dial comes to the thumb
        on();
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (this.pointers.slider === e.pointerId) {
        const v = this.renderer.sliderValueAt(e.clientX, e.clientY, true);
        if (v != null) poseSel(v);
        return;
      }
      // the dial stays under the thumb: sliding without lifting carries it along
      if (this.pointers.throttle === e.pointerId && e.pointerType === 'touch') this.renderer.anchorDial(e.clientX, e.clientY);
    });
    const release = (e) => {
      if (this.pointers.slider === e.pointerId) this.pointers.slider = null;
      if (this.pointers.throttle === e.pointerId) { this.pointers.throttle = null; off(); }
      if (e.pointerType === 'mouse') off();
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('touchstart', (e) => { if (this.state === 'race') e.preventDefault(); }, { passive: false });
    c.addEventListener('touchmove', (e) => { if (this.state === 'race') e.preventDefault(); }, { passive: false });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'race') this.togglePause(); });
  }

  // ---------- flow ----------
  toMenu() {
    if (this.net) this.net.leave();
    this.state = 'menu';
    this.race = null;
    this.raceCtx = null;
    this.audio.idle();
    this.ui.menu();
  }

  startQuick(mode, classId, trackId) {
    const trackDef = this.trackDefById(trackId), cat = categoryById(classId);
    if (!trackDef) return;
    this._startRace({
      mode, trackDef, classId, modelId: this.playerModelFor(classId).id,
      playerLivree: this.playerLivreeFor(this.playerModelFor(classId).id),
      // The circuit's own suggestion unless the player has asked for a number; a championship
      // round keeps the suggestion, since its length is part of the championship, not a setting.
      // le joueur choisit sa longueur ; la proposition du circuit ne sert plus que de filet
      laps: this.save.laps || 5,
      difficulty: this.save.difficulty,
      wear: this.save.wear,
      playerLivery: this.save.livery,
      playerName: this.playerName(),
    }, { cup: null, mode, classId, trackId });
  }

  startCupRace(cupId) {
    const cup = CUPS.find(c => c.id === cupId);
    const cs = cupState(this.save, cupId);
    if (cs.done) { this.ui.cupScreen(cupId); return; }
    const idx = Math.min(cs.race, cup.tracks.length - 1);
    const trackDef = this.trackDefById(cup.tracks[idx]), cat = categoryById(cup.classId);
    const seed = CUPS.indexOf(cup) * 101 + 7;
    const roster = makeRoster(cat.drivers - 1, this.save.livery, seed, cat.id);
    this._startRace({
      mode: 'race', trackDef, classId: cup.classId, modelId: this.playerModelFor(cup.classId).id,
      playerLivree: this.playerLivreeFor(this.playerModelFor(cup.classId).id),
      laps: lapsFor(trackDef, cat),
      difficulty: this.save.difficulty,
      wear: this.save.wear,
      playerLivery: this.save.livery,
      playerName: this.playerName(),
      roster,
    }, { cup, raceIndex: idx });
  }

  /** Called by the net layer when the host drops the flag, on every screen at once. */
  startOnline(cfg) {
    const trackDef = this.trackDefById(cfg.trackId), cat = categoryById(this.ui.setup.classId);
    if (!trackDef) return;
    const mine = cfg.humans.find(h => h.local) || {};
    this._startRace({
      // A shared time trial is a race with the contact turned off: everyone on the same lap
      // counter, nobody able to knock anybody off.
      mode: cfg.mode === 'ghost' ? 'race' : 'race',
      noContact: cfg.mode === 'ghost',
      aiFill: cfg.mode === 'race',
      trackDef,
      classId: cat.id,
      modelId: mine.modelId || this.playerModelFor(cat.id).id,
      laps: cfg.laps || lapsFor(trackDef, cat),
      difficulty: cfg.difficulty || this.save.difficulty,
      playerLivery: mine.livery || 0,
      playerLivree: this.playerLivreeFor(mine.modelId || this.playerModelFor(cat.id).id),
      playerName: mine.name || this.playerName(),
      humans: cfg.humans,
    }, { cup: null, mode: 'race', classId: cat.id, trackId: cfg.trackId, online: cfg.mode });
  }

  _startRace(opts, ctx) {
    this.raceOpts = opts;
    this.raceCtx = ctx;
    this.race = new Race(opts);
    // Le démarreur, s'il y en a un pour cette voiture : le moteur s'allume quand la course s'ouvre,
    // avant le décompte. Une seule fois par course.
    /* La barrière repart à zéro à CHAQUE course, et pas quand le décompte s'arrête.

    Le délai se comptait depuis l'entrée en décompte, remise à zéro seulement en sortant. Relancer
    une course pendant que la précédente comptait encore — un abandon puis un départ immédiat —
    héritait donc de son chronomètre : si la première avait attendu dix secondes, la seconde partait
    avec deux secondes de barrière, voire aucune. */
    this.chargeDes = null;
    this.chargement = null;
    // Le son est remis d'aplomb ICI : contexte repris s'il avait été suspendu, prises rechargées si
    // leur téléchargement avait échoué. Voir `GameAudio.relance`.
    this.audio.relance();
    this.renderer.setTrack(this.race.track);
    this.renderer.cam.init = false;
    this.renderer.homeDial();
    this.state = 'race';
    this.input.throttle = false;
    this.input.sel = 0; this.input.pit = false;
    this.pointers.throttle = this.pointers.slider = null;
    this.ui.hide();
    this.ui.flash = null;
    this.last = performance.now();
  }

  retry() { if (this.raceOpts) this._startRace(this.raceOpts, this.raceCtx); }

  /** Leaves the race but keeps the table open, so the same people can line up again. */
  toLobby() {
    if (this.net) this.net.backToLobby();
    this.race = null;
    this.raceCtx = null;
    this.audio.idle();
    this.state = 'lobby';
    this.ui.lobbyScreen();
  }

  // Leave the title card. Returns true when it did, so a key press that got us past it is not
  // also read as a command by whatever comes next. It doubles as the gesture that lets the audio
  // start: a browser will not make a sound until someone has touched the page.
  leaveSplash() {
    if (this.state !== 'splash') return false;
    this.state = 'menu';
    this.audio.start();
    this.audio.resume();
    this.ui.menu();
    return true;
  }

  togglePause() {
    if (this.state === 'race') {
      this.state = 'paused';
      this.input.throttle = false;
      this.audio.idle();
      this.ui.pauseScreen(this.race);
    } else if (this.state === 'paused') this.resume();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'race';
    this.ui.hide();
    this.last = performance.now();
  }

  endTimeTrial() {
    if (!this.race) return;
    this.race.endTimeTrial();
    this._onRaceFinished();
  }

  /* Ce qu'il faut avoir sous la main pour courir sans à-coups.

  Les vignettes de voiture d'abord : elles se décodent image par image et une voiture sans la
  sienne apparaît en retard, au milieu de la ligne droite. Le moteur ensuite — plusieurs mégaoctets
  de prises — mais seulement si le son est allumé : attendre un téléchargement dont on ne fera rien
  bloquerait la table pour un réglage que le joueur a justement coupé.

  Et le DÉCOR, qu'on avait oublié. La liste s'arrêtait aux voitures et au son, alors que le fond de
  carte du circuit, la halle des stands et les trente sprites de décor descendent par le même
  réseau. Sur un téléphone, c'est le gros du téléchargement : le circuit se peuplait au feu vert,
  et c'est exactement ce que Bruno a vu sur l'écran du second joueur. Le renderer répond pour cette
  part-là, qui est la sienne.

  La géométrie du circuit n'y figure pas : elle est construite, pas téléchargée, et elle l'est avant
  le premier affichage — donc déjà là quand cette fonction est appelée. */
  _pretACourir(race) {
    if (!race) return false;
    for (const c of race.cars) if (typeof topReady === 'function' && !topReady(c.cls, c.livree)) return false;
    if (this.renderer && !this.renderer.pretAPeindre(race)) return false;
    if (this.audio && !this.audio.pretAJouer()) return false;
    return true;
  }

  _onRaceFinished() {
    const race = this.race, ctx = this.raceCtx || {};
    this.state = 'results';
    this.audio.idle();
    const save = this.save;
    /* Deux clés pour un même tour : le circuit, et le circuit avec la voiture.

    L'écran des records liste désormais un temps par voiture, ce que la clé à deux morceaux ne
    pouvait pas porter. Elle reste écrite quand même, et c'est elle qui décide du « Nouveau
    record ! » : un meilleur tour toutes voitures confondues. Sans cela, le premier tour bouclé
    avec chaque nouvelle voiture aurait déclenché la bannière, y compris à dix secondes du
    meilleur temps du joueur — une félicitation qui félicite tout le monde ne dit plus rien.

    Les anciennes sauvegardes gardent leurs clés à deux morceaux : rien n'est perdu, et rien
    n'est inventé non plus. On ne sait pas avec quelle voiture ces tours ont été signés, donc on
    ne les attribue à aucune ; la liste par voiture se remplit à partir des prochaines sorties. */
    const key = `${race.track.id}|${race.cat.id}`;
    const keyCar = `${key}|${race.cls.id}`;
    let newRecord = false;
    if (race.player.bestLap != null) {
      if (save.bestLaps[key] == null || race.player.bestLap < save.bestLaps[key]) {
        save.bestLaps[key] = race.player.bestLap;
        newRecord = true;
      }
      if (save.bestLaps[keyCar] == null || race.player.bestLap < save.bestLaps[keyCar])
        save.bestLaps[keyCar] = race.player.bestLap;
      /* LE TABLEAU MONDIAL NE REGARDE QUE LE REGISTRE DES TOURS NETS.

      Le record personnel ci-dessus se bat avec n'importe quel réglage — c'est le sien. Celui-ci ne
      s'écrit que dans la configuration de référence, et c'est lui seul que `rattrape` renverra à la
      prochaine ouverture. Sans ce second registre, bloquer l'envoi du moment ne servait à rien : le
      temps restait dans la sauvegarde et repartait au démarrage suivant — le trou que la règle de
      l'usure avait déjà. */
      const net = tourNet(save, race);
      if (net && (save.bestLapsNets[keyCar] == null || race.player.bestLap < save.bestLapsNets[keyCar])) {
        save.bestLapsNets[keyCar] = race.player.bestLap;
        /* On ne propose au tableau mondial QUE ses propres meilleurs tours.

        Envoyer chaque tour aurait fait passer des centaines de temps là où un seul compte, et
        c'est le serveur qui aurait trié — à nos frais. Un temps qui ne bat même pas le nôtre ne
        peut pas battre celui du monde. Rien n'est attendu : la course se termine, les résultats
        s'affichent, et la réponse arrive quand elle arrive. */
        if (this.mondial && this.mondial.connecte()) {
          // le nom courant, et pas celui du démarrage : il a pu changer dans les réglages depuis
          this.mondial.poseNom(this.playerName());
          this.mondial.propose(race.track.id, race.cls.id, race.player.bestLap)
            .catch(() => { /* un tableau de scores ne fait pas échouer une fin de course */ });
        }
      }
      /* UNE EXCLUSION SE DIT, sinon elle ressemble à une panne.

      Un joueur qui roule toujours avec une aide et ne voit jamais son nom apparaître croira que le
      tableau est cassé. On nomme donc le motif — l'usure, ou la configuration — même quand il n'y a
      rien eu à envoyer. */
      if (!net && this.mondial && this.mondial.connecte())
        this.mondial.dernierRefus = { raison: race.usure ? 'usure' : 'aides',
                                      circuit: race.track.id, voiture: race.cls.id };
    }
    save.racesDone++;
    if (ctx.cup) {
      const cs = cupState(save, ctx.cup.id);
      for (const r of race.results) cs.points[r.car.name] = (cs.points[r.car.name] || 0) + r.points;
      cs.race = ctx.raceIndex + 1;
      if (cs.race >= ctx.cup.tracks.length) {
        cs.done = true;
        const order = Object.entries(cs.points).sort((a, b) => b[1] - a[1]);
        cs.finalPos = order.findIndex(([n]) => n === this.playerName()) + 1;
      }
      save.cups[ctx.cup.id] = cs;
    }
    storeSave(save);
    this.ui.resultsScreen(race, { cup: ctx.cup, newRecord });
  }

  // ---------- loop ----------
  _frame(now) {
    requestAnimationFrame((t) => this._frame(t));
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.race) return;
    const race = this.race;
    if (this.state === 'race') {
      const net = this.net, online = net && net.state === 'playing';
      /* La barrière de chargement, tenue pendant le décompte.

      Chaque écran annonce quand il a fini : vignettes de voitures décodées, prises de moteur
      arrivées. L'hôte retient le décompte tant qu'il en manque un, et les invités suivent
      puisqu'ils rejouent son état. C'est ce qui manquait : la course partait pendant que les
      machines travaillaient encore, et l'invité lisait « liaison perdue » là où il fallait lire
      « chargement ». */
      if (race.state === 'countdown') {
        if (this.chargeDes == null) this.chargeDes = now;
        const pret = this._pretACourir(race);
        if (online) {
          net.setCharge(pret);
          if (net.isHost()) {
            const a = net.attendus();
            race.attente = a.reste > 0;
            this.chargement = a;
          } else {
            /* L'invité dit ce qui le concerne, LUI.

            Il ne tient pas le décompte : celui de l'hôte lui arrive tout fait, et quand l'hôte
            retient, l'invité voyait des feux arrêtés sans un mot — le même silence qu'avant, juste
            déplacé d'un écran. Il annonce donc son propre chargement, qui est aussi, dans le cas le
            plus fréquent, la raison même pour laquelle l'hôte attend. */
            this.chargement = null;
            race.attente = !pret;
          }
        } else {
          /* Le solo attend aussi, et pour la même raison.

          La barrière était née du multijoueur, donc posée derrière `online` : en solo la course
          partait pendant que les vignettes se décodaient et que les mégaoctets de moteur
          arrivaient. On démarrait au silence, la voiture du joueur apparaissait au milieu de la
          ligne droite, et le son s'allumait au deuxième virage.

          Avec la même échappatoire que la table : un téléchargement qui échoue ne retient pas le
          joueur indéfiniment. Passé le délai, on part avec ce qu'on a — sans son plutôt que sans
          course. */
          this.chargement = null;
          race.attente = !pret && (now - this.chargeDes) <= NET_CHARGE_MAX;
        }
      } else {
        this.chargeDes = null;
        if (this.chargement) this.chargement = null;
        race.attente = false;
      }
      if (!online || net.isHost()) {
        race.update(dt, this.input);
        if (online) net.hostTick(race);
      } else {
        // A guest runs no physics at all: it posts its two numbers, takes the host's picture of
        // the race, and carries the cars forward between two of them so the screen does not stutter.
        net.guestTick(race, this.input);
        race.extrapolate(dt);
        // Say so rather than pretending: after a couple of seconds with nothing from the host,
        // what is on screen is no longer the race, it is the last picture of it carried forward.
        const quiet = net.silence();
        if (quiet > 2) this.ui.flash = { text: this.ui.t('netLost'), until: performance.now() + 600, color: '#ffb4a2' };
      }
      this._handleEvents(race);
      this.renderer.updateCamera(race, dt);
      this.renderer.addEffects(race, dt);
      if (this.renderer.shake > 0) this.renderer.shake = Math.max(0, this.renderer.shake - dt * 2);
      this.audio.update(race.player, race.state !== 'countdown');
      if (race.state === 'finished') this._onRaceFinished();
    }
    if (this.state === 'race' || this.state === 'paused' || this.state === 'results') this.renderer.draw(race, this.ui);
  }

  _handleEvents(race) {
    const t = (k, ...a) => this.ui.t(k, ...a);
    for (const ev of race.events) {
      if (ev.type === 'go') this.audio.beep(880, 0.4, 0.3);
      if (ev.type === 'crash' && ev.car.isPlayer) { this.audio.thud(); this.renderer.shake = 1; }
      if (ev.type === 'lap' && ev.car.isPlayer) {
        const lt = ev.car.lapTimes[ev.car.lapTimes.length - 1];
        const isBest = ev.car.bestLap === lt && ev.car.lapTimes.length > 1;
        this.ui.flash = { text: t('lapDone', ev.car.lap, fmtTime(lt)), until: performance.now() + 2500, color: isBest ? '#b48cff' : '#fff' };
        this.audio.beep(isBest ? 1320 : 990, 0.12, 0.15);
      }
      if (ev.type === 'finish' && ev.car.isPlayer) this.audio.beep(660, 0.6, 0.3);
    }
    race.events.length = 0;
  }
}

window.addEventListener('DOMContentLoaded', () => { window.app = new App(); });
