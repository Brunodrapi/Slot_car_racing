// Race session: grid, countdown, simulation step, standings and results.
'use strict';

/* margin: corner-speed factor (1 = the physical limit); pace: top-speed factor. Both scale with
   driver skill, and `aiThrottle` caps their sum at 0.98 — above 1 a driver does not go faster, he
   goes off.

   These three used to sit between 0.78 and 0.90 of the corner limit, which put barely seven per
   cent of race pace between the easiest setting and the hardest: a player could not feel the
   difference, which is the only thing a difficulty setting is for. They now span 0.70 to 0.93,
   and twelve per cent. Measured with `tools/diff.js`, on race pace rather than best lap, over the
   twelve circuits:

     facile     93,6 s au tour, 0,0 sortie par course
     moyen      87,0 s,         2,6
     difficile  82,0 s,         9,3

   Hard makes more mistakes than it used to, and that is the bargain: a field driving that close to
   the limit in traffic will put a wheel on the grass. It still laps five seconds quicker than the
   middle setting, so the mistakes are paid for several times over — and they are what gives the
   player a way past. */
const DIFFICULTY = {
  easy:   { marginBase: 0.70, marginSpread: 0.10, paceBase: 0.80, paceSpread: 0.08 },
  medium: { marginBase: 0.83, marginSpread: 0.09, paceBase: 0.90, paceSpread: 0.07 },
  hard:   { marginBase: 0.93, marginSpread: 0.06, paceBase: 0.99, paceSpread: 0.02 },
  /* Extrême : l'IA triche, et il n'y avait pas d'autre moyen.

  Les trois premiers niveaux ne règlent qu'une chose — à quelle fraction de SA limite l'IA
  conduit. Difficile est déjà à 0,99, et `aiThrottle` plafonne à 0,98 : le levier est au bout de
  sa course. Monter la marge plus haut ne donne pas un tour plus rapide, cela donne une sortie de
  piste, parce qu'au-dessus de 1 on demande une courbe que la voiture ne peut pas prendre.

  Le seul levier qui reste est la limite elle-même. `grip` multiplie l'adhérence mécanique des
  voitures de l'IA, et d'elles seules ; la voiture du joueur n'est pas touchée.

  MAIS L'ADHÉRENCE SEULE NE SUFFIT PAS, ET LA MESURE A CORRIGÉ DEUX IDÉES FAUSSES.

  La première était qu'il suffirait d'en donner. Mesuré au balayage : plus d'adhérence rend le
  peloton plus rapide ET PLUS PROPRE — 6,5 sorties par course en difficile, 1,5 à ×1,24, 0,9 à
  ×1,32. Or un peloton qui ne se trompe jamais ne laisse aucune ouverture, et la seule façon de
  doubler disparaîtrait à mesure que le niveau monte. Plus dur ne doit pas vouloir dire
  imprenable.

  La seconde était que relever le plafond de `aiThrottle` rendrait les fautes. Mesuré : de 0,98 à
  1,16, les sorties passent de 1,7 à 1,6 et le rythme ne bouge pas. Le plafond était inerte,
  simplement parce que `0,93 + 0,06·talent + bruit` ne l'atteignait jamais.

  C'est donc `marginBase` qu'il fallait déplacer, à 1,00 : l'IA demande à ses pneus un peu plus
  qu'ils ne donnent, et le paie parfois. Le plafond relevé sert à laisser passer ce 1,00.

  LES DEUX RÉGLAGES N'ACHÈTENT PAS LA MÊME CHOSE, et là encore j'avais écrit le contraire avant de
  le vérifier. En remettant le plafond à 0,98 — donc en écrasant la marge à 0,98 — le rythme reste
  le MÊME : 75,34 s contre 75,29. Toute la vitesse vient de l'adhérence. Ce que le plafond change,
  ce sont les fautes : 3,4 sorties par course au lieu de 7,0. Il n'achète donc pas de la vitesse,
  il achète de quoi doubler.

  DEUX NIVEAUX PLUTÔT QU'UN, et l'ordre a demandé une correction. À adhérence ×1,14 et marge 1,00,
  extrême faisait ONZE sorties par course quand cauchemar, mieux collé à ×1,30, n'en faisait que
  8,8 : le niveau intermédiaire était le plus brouillon des deux, ce qui n'a aucun sens. Moins
  d'adhérence avec la même audace, c'est simplement en demander trop plus souvent. La marge
  d'extrême redescend donc à 0,98, et l'échelle redevient monotone dans les deux sens.

  Mesuré sur les douze circuits, rythme de course et sorties par course :

    facile      92,97 s   0,2
    moyen       86,84 s   1,9
    difficile   82,22 s   5,8
    extrême     77,25 s   7,5   adhérence ×1,14
    cauchemar   73,08 s   8,8   adhérence ×1,30

  Chaque palier vaut cinq à six pour cent, soit l'écart qui sépare déjà moyen de difficile. */
  extreme:   { marginBase: 0.98, marginSpread: 0.10, paceBase: 1.0, paceSpread: 0.02, grip: 1.14, maxMargin: 1.25 },
  /* Cauchemar : la même triche, plus franche. L'écart entre les deux est une affaire d'adhérence
  et d'audace, pas de nature — ce qui veut dire qu'aucun des deux ne fait rouler l'IA d'une façon
  que la physique ne sait pas produire. Elle reste capable de sortir, et elle sort. */
  cauchemar: { marginBase: 1.02, marginSpread: 0.12, paceBase: 1.0, paceSpread: 0.02, grip: 1.30, maxMargin: 1.30 },
};

const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

// race state, as one number, for the snapshots sent over the wire
const STATE_CODE = { countdown: 0, racing: 1, finishing: 2, finished: 3 };
const STATE_NAME = ['countdown', 'racing', 'finishing', 'finished'];

class Race {
  constructor(opts) {
    this.opts = opts;
    this.cat = categoryById(opts.classId);
    this.cls = modelById(opts.modelId) || modelsOf(this.cat.id)[0];   // player's model
    this.track = new Track(opts.trackDef, this.cat.roadScale || 1);
    this.mode = opts.mode || 'race';           // race | timetrial
    this.laps = opts.laps || this.track.laps;
    this.difficulty = DIFFICULTY[opts.difficulty] || DIFFICULTY.medium;
    /* L'usure et les dommages : en option, et en COURSE seulement.

    Le contre-la-montre en est exclu par nature — un record sur des pneus à moitié morts ne se
    compare à rien, et la table des records n'a pas de colonne pour dire dans quel état ils ont été
    signés. Mieux vaut que l'option n'existe pas là que d'avoir à l'expliquer. */
    // `opts.mode` et non `this.mode` : celui-ci n'est affecté que trente lignes plus bas, si bien
    // que le lire ici aurait rendu l'option inerte sans que rien ne le signale.
    this.usure = opts.wear && (opts.mode || 'race') === 'race' ? USURE : null;
    this.time = 0;
    this.state = 'countdown';                  // countdown | racing | finishing | finished
    this.countdown = 3.6;
    this.finishTimer = 0;
    this.dt = 1 / 120;
    this.acc = 0;
    this.results = null;
    this.events = [];                          // transient events for sound/FX
    // reference speed profile of the player's car on each line, for the braking guide
    this.profiles = {};
    for (const name of LINE_NAMES) this.profiles[name] = speedProfile(this.track, this.cls, name, 0.98);
    this._buildGrid();
  }

  // `opts.humans` turns the grid into an online one: one seat per person, in the order the table
  // froze at kick-off, the last rows of the grid. Exactly one of them is `local` — the car this
  // screen drives. Without it nothing changes: one human at the back, the rest driven by the AI.
  _buildGrid() {
    const T = this.track, c = this.cls;
    const humans = this.opts.humans || null;
    const nh = humans ? humans.length : 1;
    const solo = this.mode === 'timetrial' && !humans;
    const n = solo ? 1
      : humans && !this.opts.aiFill ? nh
        : Math.max(nh + 1, Math.min(opts_n(this.opts, c), 12));
    const roster = this.opts.roster || makeRoster(n, this.opts.playerLivery || 0, null, this.cat.id);
    const catModels = modelsOf(this.cat.id);
    this.cars = [];
    const gap = c.length * 2.2;
    for (let i = 0; i < n; i++) {
      const hIdx = humans ? i - (n - nh) : (i === n - 1 ? 0 : -1);
      const h = hIdx >= 0 && humans ? humans[hIdx] : null;
      const isHuman = hIdx >= 0;
      const isPlayer = humans ? !!(h && h.local) : isHuman;
      const row = i;
      const s = T.length - 8 - row * gap;
      const lat = (i % 2 === 0 ? 1 : -1) * Math.min(T.halfWidth * 0.45, c.width * 0.9);
      const ai = roster[i % roster.length];
      /* Le repli d'un pilote en ligne ne doit dépendre que de sa place, jamais de l'écran qui
      dessine. Se rabattre sur `c` — la voiture du joueur local — donnait à chaque écran une
      grille différente : celui qui regardait voyait tous les autres rouler dans SA voiture. Le
      cas arrive pour de bon dès qu'un modèle est inconnu du poste, par exemple une voiture
      d'atelier que les autres n'ont pas, ou une présence encore incomplète au coup d'envoi — donc
      d'autant plus souvent qu'on est nombreux. */
      const model = h ? (modelById(h.modelId) || catModels[(hIdx + 1) % catModels.length])
        : (isHuman ? c : (modelById(ai.model) || catModels[i % catModels.length]));
      const car = new Car(T, model, {
        name: h ? (h.name || 'Pilote') : isHuman ? (this.opts.playerName || 'Vous') : ai.name,
        livery: LIVERIES[(h ? h.livery : isHuman ? (this.opts.playerLivery || 0) : ai.livery) % LIVERIES.length],
        isPlayer,
        skill: isHuman ? 1 : ai.skill,
        /* La triche du niveau extrême ne touche que les voitures de l'IA, et jamais un humain —
        ni le joueur local, ni personne en ligne. Elle se pose ici, à la construction de la
        grille, plutôt que dans `aiThrottle` : l'adhérence appartient à la voiture, pas au
        pilotage, et une voiture qui tient plus doit aussi glisser moins quand elle est touchée. */
        gripBoost: isHuman || h ? 1 : (this.difficulty.grip || 1),
        usure: this.usure,
        number: isHuman ? 1 + (hIdx || 0) : 2 + i,
        s, lat,
      });
      car.human = isHuman && humans ? hIdx : null;   // seat number in the online grid
      car.laneTarget = lat;
      car.gridLat = lat;
      this.cars.push(car);
    }
    this.player = this.cars.find(c2 => c2.isPlayer) || this.cars[this.cars.length - 1];
    this.netInput = [];                              // seat -> { thr, sel } received over the wire
    if (solo) {
      this.player.place(T.length - 40, 0);
      this.player.laneTarget = 0;
      this.player.gridLat = 0;
    }
  }

  // input: { throttle: bool, sel: -1..1 } (a bare boolean is accepted for the throttle)
  update(frameDt, input) {
    if (typeof input !== 'object') input = { throttle: !!input, sel: this.player.sel };
    this.player.sel = clamp(input.sel == null ? 0 : input.sel, -1, 1);
    // la coche des stands : une intention, pas une quatrième position de ligne (voir Car.pitAsk)
    if (this.usure && input.pit != null) this.player.pitAsk = !!input.pit;
    this.acc += Math.min(frameDt, 0.1);
    while (this.acc >= this.dt) {
      this._step(this.dt, !!input.throttle);
      this.acc -= this.dt;
    }
  }

  _step(dt, throttleInput) {
    if (this.state === 'countdown') {
      /* Le décompte ATTEND que tout le monde ait fini de charger.

      Une course en ligne démarrait dès le coup d'envoi, alors que chaque écran a encore à
      construire son circuit, décoder ses vignettes de voiture et télécharger ses prises de moteur.
      Pendant ces quelques secondes l'hôte n'envoie rien — il calcule — et l'invité, qui compte le
      temps écoulé depuis le dernier instantané, affichait « liaison perdue avec l'hôte ». La
      liaison allait très bien : personne n'avait encore rien à dire.

      `attente` est posé par la couche réseau tant qu'un écran n'a pas annoncé qu'il est prêt. Hors
      ligne il reste faux, et le décompte se déroule comme avant. */
      if (this.attente) return;
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.state = 'racing';
        this.events.push({ type: 'go' });
        for (const car of this.cars) car.gridLat = null;
      }
      // allow revving but no motion
      for (const car of this.cars) {
        const net = car.human != null && !car.isPlayer ? this.netInput[car.human] : null;
        car.throttle = car.isPlayer ? throttleInput : net ? !!net.thr : this.countdown < 1.2;
      }
      return;
    }
    if (this.state === 'finished') return;
    this._simulate(dt, throttleInput);
    if (this.state === 'finishing') {
      this.finishTimer -= dt;
      if (this.finishTimer <= 0 || this.cars.every(c => c.finished)) this._finish();
    }
  }

  /* Quand une IA décide de s'arrêter.

  Je n'ai pas pu regarder comment Ultimate Racing 2D s'y prend — c'est un jeu fermé et je n'ai pas
  accès à son code. Ce qui suit est donc un raisonnement, pas une copie, et il vaut ce que vaut la
  mesure : dis-moi si le comportement ne ressemble pas à ce que tu attends.

  Le calcul est celui d'un ingénieur de course, et il tient en une ligne : un arrêt ne se rembourse
  que s'il reste assez de tours pour le rentabiliser. Un train neuf rend à peu près trois pour cent
  du tour face à un train mort ; l'arrêt en coûte une dizaine de secondes. Il faut donc trois ou
  quatre tours restants pour que ce soit payant, et rentrer au dernier tour est toujours une
  faute — même pneus morts.

  Le seuil est décalé par pilote. Sans cela les huit voitures rentreraient au même tour, feraient
  la queue dans la voie, et la course se figerait d'un coup au lieu de se déplier. Le décalage vient
  du talent, donc il est stable d'une course à l'autre : le même pilote a toujours la même
  stratégie, ce qui se remarque quand on joue plusieurs fois. */
  _decidePit(car) {
    if (car.pitAsk || car.pitState || car.tyre > 0.999) return;
    const reste = this.laps - car.lap;
    if (reste < 3) return;                       // trop tard pour rembourser
    const seuil = 0.24 + car.skill * 0.16;       // 0,24 à 0,40 selon le pilote
    if (car.tyre < seuil || car.damage > 0.75) car.pitAsk = true;
  }

  _simulate(dt, throttleInput) {
    const T = this.track;
    this.time += dt;
    // rubber-banding: slow leaders that are far ahead of the player, help stragglers a little
    const pp = this.player.progress;
    for (const car of this.cars) {
      // The third argument is "let the AI pick the line". A person's car never does, wherever
      // that person is sitting.
      /* Une seule source de vérité pour « cette voiture est-elle pilotée par la machine ».
      `car.aiDriven` sert aussi à la voie des stands, où l'IA freine pour la zone d'arrêt alors que
      le joueur freine lui-même ; la dupliquer aurait fini par la faire diverger. */
      car.aiDriven = car.human == null && !car.isPlayer ? true : !!this.opts.playerAI;
      car.steer(this.cars, dt, car.aiDriven);
      if (this.usure && car.aiDriven && !car.finished) this._decidePit(car);
      let throttle;
      if (car.isPlayer) throttle = car.finished ? car.v < 15 : throttleInput;
      else if (car.human != null) {
        // Another person's car: their throttle and their line come over the wire. Nothing is
        // predicted — this only ever runs on the host, which is the one simulating.
        const net = this.netInput[car.human] || { thr: false, sel: 0 };
        car.sel = clamp(net.sel || 0, -1, 1);
        if (this.usure) car.pitAsk = !!net.pit;
        throttle = car.finished ? car.v < 15 : !!net.thr;
      } else {
        const gapM = car.progress - pp;
        const rubber = car.finished || this.player.finished ? 0 : clamp(-gapM / 4000, -0.05, 0.03);
        throttle = aiThrottle(car, this.cars, dt, { ...this.difficulty, rubber }) && !car.finished;
        if (car.finished) throttle = car.v < 15;
      }
      const wasOff = car.state === 'grass';
      const lapBefore = car.lap;
      car.update(dt, throttle, this.time);
      if (!wasOff && car.state === 'grass') this.events.push({ type: 'crash', car });
      if (car.lap !== lapBefore) {
        this.events.push({ type: 'lap', car });
        if (this.mode === 'race' && car.lap >= this.laps && !car.finished) {
          car.finished = true;
          car.finishTime = this.time;
          this.events.push({ type: 'finish', car });
          if (car.isPlayer && this.state === 'racing') { this.state = 'finishing'; this.finishTimer = 4; }
        }
      }
    }
    if (this.mode === 'race' && !this.opts.noContact) resolveCollisions(this.cars, T);
  }

  /* ------------------------------------------------------------------ online: host and guest

  The host simulates and publishes; the guests replay what they receive and send back only their
  own two numbers. Nothing is predicted on a guest, so nothing can disagree: what you see is the
  host's race, a fraction of a second old.
  */

  // A flat array, because it is sent as JSON thirty times a second and the field names would cost
  // more than the numbers. Coordinates to the centimetre, angles to the milliradian.
  snapshot(seq) {
    const out = [seq, Math.round(this.time * 100), STATE_CODE[this.state] || 0, Math.round(this.countdown * 100)];
    for (const c of this.cars) {
      out.push(
        Math.round(c.x * 100), Math.round(c.y * 100), Math.round(c.th * 1000),
        Math.round(c.v * 100), Math.round(c.vl * 100), Math.round(c.w * 1000),
        Math.round(c.s * 100), Math.round(c.lat * 100), c.lap,
        Math.round(c.sel * 100), Math.round(c.selS * 100),
        (c.state === 'grass' ? 1 : 0) | (c.finished ? 2 : 0) | (c.throttle ? 4 : 0) | (c.braking ? 8 : 0),
        Math.round((c.bestLap || 0) * 1000), Math.round((c.lapStart || 0) * 100),
      );
    }
    return out;
  }

  // Applied whole. A car is placed, not nudged: the guest holds no opinion about where it should
  // be, so there is nothing to reconcile.
  applySnapshot(snap) {
    if (!Array.isArray(snap) || snap.length < 4) return false;
    const per = 14;
    if (snap.length < 4 + this.cars.length * per) return false;
    this.time = snap[1] / 100;
    this.state = STATE_NAME[snap[2]] || this.state;
    this.countdown = snap[3] / 100;
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i], o = 4 + i * per;
      /* L'écart est absorbé, pas imposé.

      Les instantanés arrivent trente fois par seconde, l'écran en dessine soixante, et entre deux
      l'invité avance les voitures à leur vitesse. Cette avance ne tombe jamais exactement juste :
      poser d'autorité la position reçue fait sauter la voiture trente fois par seconde. Mesuré,
      le saut d'une image à l'autre valait cinquante-huit fois celui de l'hôte.

      On garde donc l'écart comme un décalage d'affichage, qu'on résorbe en quelques images. La
      voiture est au bon endroit dès l'instantané suivant, mais elle y arrive en glissant. Un
      écart énorme — un accrochage, un retour aux stands — n'a rien à lisser : au-delà de quelques
      mètres on repose la voiture d'un coup, sinon elle traverserait le décor en patinant. */
      const ax = snap[o] / 100, ay = snap[o + 1] / 100, ath = snap[o + 2] / 1000;
      const ex = c.x - ax, ey = c.y - ay;
      if (ex * ex + ey * ey < 36) {
        // On ne bouge rien maintenant : la voiture reste où elle est, et l'écart avec la position
        // reçue devient une dette que `extrapolate` rembourse en quelques images. Sauter sur la
        // position reçue serait précisément le défaut qu'on corrige.
        c.ex = ex; c.ey = ey; c.eth = wrapAngle(c.th - ath);
        c.x = ax + c.ex; c.y = ay + c.ey; c.th = wrapAngle(ath + c.eth);
      } else {
        // Trop loin pour être lissé — un accrochage, un retour sur la piste : on repose la voiture
        // d'un coup, sinon elle traverserait le décor en patinant.
        c.ex = 0; c.ey = 0; c.eth = 0;
        c.x = ax; c.y = ay; c.th = ath;
      }
      c.v = snap[o + 3] / 100; c.vl = snap[o + 4] / 100; c.w = snap[o + 5] / 1000;
      c.s = snap[o + 6] / 100; c.lat = snap[o + 7] / 100; c.lap = snap[o + 8];
      c.sel = snap[o + 9] / 100; c.selS = snap[o + 10] / 100;
      const f = snap[o + 11];
      c.state = (f & 1) ? 'grass' : 'ok';
      c.finished = !!(f & 2);
      c.throttle = !!(f & 4);
      c.braking = !!(f & 8);
      c.started = c.lap > 0 || c.started;
      c.bestLap = snap[o + 12] ? snap[o + 12] / 1000 : c.bestLap;
      c.lapStart = snap[o + 13] / 100;
      c.gridLat = this.state === 'countdown' ? c.gridLat : null;
    }
    return true;
  }

  // Snapshots arrive thirty times a second and the screen draws sixty: between two of them the
  // cars are carried forward along their own velocity. It is not a prediction of what the host
  // will decide, only a refusal to let the picture stand still.
  extrapolate(dt) {
    if (this.state !== 'racing' && this.state !== 'finishing') return;
    const d = Math.min(dt, 0.12);
    /* L'écart laissé par le dernier instantané se résorbe en un peu plus d'un quart de seconde.

    Ce qui le crée n'est pas une erreur de trajectoire mais une erreur d'horloge : l'invité avance
    les voitures du temps réellement écoulé, alors que l'instantané suivant rend compte du temps
    écoulé chez l'hôte. Un instantané qui arrive dix millisecondes tard, à deux cent trente à
    l'heure, ce sont soixante centimètres d'avance à reprendre — sans que personne ait mal conduit.

    Reprise d'un coup, cette avance se voit ; étalée, non. La durée est mesurée, pas choisie : à
    0,09 s l'invité accusait 0,18 m de saut d'une image à l'autre, à 0,18 s il tombe à 0,07, à
    0,28 s à 0,05. Le prix est le décalage d'affichage, qui passe de 0,57 à 0,71 m au 95ᵉ centile —
    deux millisecondes de trajet de plus, et il n'a pas de moyenne : l'avance tombe tantôt trop
    loin, tantôt trop court. On s'arrête là parce que le gain suivant est mince et qu'une correction
    vraie — un accrochage, une poussée — mettrait d'autant plus longtemps à se résorber. */
    const k = Math.exp(-d / 0.28);
    for (const c of this.cars) {
      const cos = Math.cos(c.th), sin = Math.sin(c.th);
      c.x += (c.v * cos - c.vl * sin) * d;
      c.y += (c.v * sin + c.vl * cos) * d;
      c.th = wrapAngle(c.th + c.w * d);
      if (c.ex || c.ey || c.eth) {
        c.x -= c.ex * (1 - k); c.y -= c.ey * (1 - k);
        c.th = wrapAngle(c.th - (c.eth || 0) * (1 - k));
        c.ex *= k; c.ey *= k; c.eth = (c.eth || 0) * k;
      }
    }
    this.time += d;
  }

  // reference speed at s on the line selected by `sel` (-1 inside .. +1 outside)
  profileAt(s, sel) {
    const i = this.track.idx(s), r = this.profiles.racing[i];
    if (sel < 0) return r + (this.profiles.inside[i] - r) * Math.min(1, -sel);
    return r + (this.profiles.outside[i] - r) * Math.min(1, sel);
  }

  standings() {
    return this.cars.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.progress - a.progress;
    });
  }

  positionOf(car) { return this.standings().indexOf(car) + 1; }

  _finish() {
    // fast-forward the rest of the field to the flag so everyone gets a real gap
    let extra = 0;
    while (!this.cars.every(c => c.finished) && extra < 180) { this._simulate(this.dt, false); extra += this.dt; }
    this.events.length = 0;
    this.state = 'finished';
    const order = this.standings();
    this.results = order.map((car, i) => ({
      car, pos: i + 1, points: POINTS[i] || 0,
      time: car.finished ? car.finishTime : null,
      bestLap: car.bestLap,
      gap: car.finished && order[0].finished ? car.finishTime - order[0].finishTime : null,
    }));
    return this.results;
  }

  endTimeTrial() {
    this.state = 'finished';
    this.results = [{ car: this.player, pos: 1, points: 0, time: null, bestLap: this.player.bestLap, gap: null }];
    return this.results;
  }
}

function opts_n(opts, cls) { return opts.nCars || cls.drivers; }

// AI drivers with a name, livery and skill. `seed` makes the roster reproducible (championships).
function makeRoster(count, playerLivery, seed, catId) {
  let rnd = Math.random;
  if (seed != null) { let x = seed * 9301 + 49297; rnd = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; }
  const names = AI_NAMES.slice(), liveries = LIVERIES.map((l, i) => i).filter(i => i !== playerLivery);
  for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
  for (let i = liveries.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [liveries[i], liveries[j]] = [liveries[j], liveries[i]]; }
  const out = [];
  const models = modelsOf(catId || CATEGORIES[0].id);
  for (let i = 0; i < count; i++) out.push({ name: names[i % names.length], livery: liveries[i % liveries.length], skill: (i / Math.max(1, count - 1)) * 0.8 + rnd() * 0.2, model: models.length ? models[Math.floor(rnd() * models.length)].id : null });
  return out;
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

if (typeof module !== 'undefined') module.exports = { Race, DIFFICULTY, POINTS, makeRoster };
