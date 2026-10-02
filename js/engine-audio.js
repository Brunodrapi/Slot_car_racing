/* Le moteur de son, porté de markeasting/engine-audio.

   MIT License — Copyright (c) 2025 Mark Oosting (markeasting)
   https://github.com/markeasting/engine-audio

   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
   associated documentation files (the "Software"), to deal in the Software without restriction,
   including without limitation the rights to use, copy, modify, merge, publish, distribute,
   sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in all copies or
   substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
   NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
   NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
   DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

   ---------------------------------------------------------------------------------------------

   L'idée, et en quoi elle diffère de ce qu'on avait. Le régime n'est plus déduit de la vitesse par
   une règle de trois : c'est un VOLANT D'INERTIE qu'on intègre. Un couple le pousse, un frein
   moteur le retient, un embrayage le relie à la transmission, et le tout est résolu vingt fois par
   image. Le son en sort au lieu d'être plaqué dessus — la montée en régime a une masse, le
   rupteur rebondit, le rapport suivant tire le moteur vers le bas au lieu de le téléporter.

   Trois écarts assumés avec l'original, chacun pour une raison :

   1. `rpm` était faux d'un facteur π². `(60 * omega) / 2 * Math.PI` se lit
      `((60·ω)/2)·π`, soit 94,2·ω, là où des tours par minute valent 60·ω/(2π) = 9,55·ω. Chez
      l'auteur c'est sans conséquence : tout son réglage — couple, inertie, rupteur — vit dans
      cette unité gonflée et reste cohérent avec lui-même. Chez nous non : nos voitures ont des
      rupteurs réels (6200 pour la GT40, 9000 pour la 787B) et le compte-tours du HUD les affiche.
      La formule est donc corrigée, et le couple et l'inertie réglés en conséquence.

   2. Le changement de rapport ne passe plus par `setTimeout`. Une minuterie du navigateur ignore
      que le jeu est en pause, et rendrait le passage dépendant de la charge de la machine. Il est
      daté sur l'horloge du jeu et appliqué dans la boucle.

   3. L'accélérateur n'est plus écrasé à chaque sous-pas. L'original multiplie `this.throttle` par
      `(1-r)^0.05` vingt fois par image, ce qui revient à `(1-r)^1` par image — mais seulement
      parce qu'il y a vingt sous-pas. On garde l'entrée intacte et on applique `(1-r)` une fois :
      même effet, et indépendant du nombre de sous-pas. */
'use strict';

function eaClamp(v, a, b) { return Math.min(Math.max(v, a), b); }
function eaRatio(v, a, b) { return eaClamp((v - a) / (b - a), 0, 1); }

const RPM_PAR_OMEGA = 60 / (2 * Math.PI);

class EAEngine {
  constructor(cfg) {
    this.idle = 1000;
    this.limiter = 7000;
    this.soft_limiter = 0;
    this.inertia = 0.2 + 0.8;      // volant + embrayage [kg·m²]
    this.torque = 400;             // N·m à pleine charge
    this.engine_braking = 200;     // N·m pied levé
    this.limiter_ms = 0;           // durée de la coupure franche
    this.limiter_delay = 100;      // durée de remise des gaz après coupure
    this.init(cfg);
  }

  init(cfg) {
    if (cfg) Object.assign(this, cfg);
    // il suit le rupteur, sinon reconfigurer la voiture garderait la zone molle de la précédente
    if (!cfg || cfg.soft_limiter == null) this.soft_limiter = this.limiter * 0.99;
    this.throttle = 0;             // l'entrée, 0..1 — jamais écrasée par le moteur
    this.throttleEff = 0;          // ce qui arrive vraiment au couple, rupteur compris
    this.theta = 0; this.omega = this.idle / RPM_PAR_OMEGA; this.prevTheta = 0; this.prevOmega = 0;
    this.rpm = this.idle;
    this._dernierRupteur = -1e9;
    this.auRupteur = false;
  }

  integrate(loadInertia, time, dt) {
    let thr = this.throttle;

    /* Le rupteur, en deux temps. D'abord la zone molle, où les gaz se retirent progressivement ;
    puis la coupure franche, qui tient `limiter_ms` et rend les gaz sur `limiter_delay`. C'est ce
    second temps qui donne le rebond caractéristique contre le rupteur. */
    if (this.rpm >= this.soft_limiter) thr *= 1 - eaRatio(this.rpm, this.soft_limiter, this.limiter);
    if (this.rpm >= this.limiter) this._dernierRupteur = time;
    const depuis = time - this._dernierRupteur;
    if (depuis >= this.limiter_ms) thr *= eaRatio(depuis - this.limiter_ms, 0, this.limiter_delay);
    else thr = 0;
    this.auRupteur = depuis < this.limiter_ms + this.limiter_delay;
    this.throttleEff = thr;

    // le ralenti se tient tout seul : un couple qui n'existe que sous le régime de ralenti
    let coupleRalenti = 0;
    if (thr < 0.1 && this.rpm < this.idle * 1.5) {
      coupleRalenti = (1 - eaRatio(this.rpm, this.idle * 0.9, this.idle)) * this.engine_braking * 10;
    }

    const couple = Math.pow(thr, 1.2) * this.torque
      - Math.pow(1 - thr, 1.2) * this.engine_braking + coupleRalenti;

    const I = loadInertia + this.inertia;
    this.prevTheta = this.theta;
    this.omega += (couple / I) * dt;
    this.theta += this.omega * dt;
    this.rpm = Math.max(0, this.omega * RPM_PAR_OMEGA);
  }

  update(h) { this.prevOmega = this.omega; this.omega = (this.theta - this.prevTheta) / h; }

  solvePos(dt, h) {
    if (dt.gear === 0) return;
    const compliance = Math.max(0.0006 - 0.00015 * dt.gear, 0.00007);
    const c = dt.theta - this.theta;
    this.theta += this.correction(c, h, compliance) * Math.sign(c);
  }

  /* L'embrayage, et pourquoi il est beaucoup plus raide que chez l'auteur.

  Son amortissement de 12 donne un embrayage qui PATINE en permanence : sous un couple constant, le
  moteur se stabilise à `couple / (amortissement · inertie)` au-dessus des roues, soit 400/(12·0,55)
  = 60 rad/s, presque 600 tr/min d'écart. Chez lui c'est invisible, parce que son banc ne relie rien
  aux roues — l'inertie de charge y est même multipliée par zéro, le moteur tourne toujours à vide.
  Chez nous le régime doit correspondre au rapport engagé, sans quoi le compte-tours ment et le son
  monte quand la voiture n'accélère plus. Embrayage tenu, la raideur passe donc à 180 : l'écart
  tombe à une trentaine de tours. Le patinage reste là où il existe vraiment — au démarrage et
  pendant le passage. */
  solveVel(dt, h, clutch = 1, raideur = 180) {
    const damping = (dt.gear > 3 ? raideur * 0.8 : raideur) * clutch;
    this.omega += (dt.omega - this.omega) * Math.min(0.5, damping * h);
  }

  correction(corr, h, compliance = 0) {
    const w = corr * corr / this.inertia;
    const dlambda = -corr / (w + compliance / h / h);
    return corr * -dlambda;
  }
}

class EADrivetrain {
  constructor(cfg) {
    this.gears = [3.4, 2.36, 1.85, 1.47, 1.24, 1.07];
    this.final_drive = 3.44;
    this.inertia = 0.1 + 0.05;
    this.damping = 12;
    this.compliance = 0.01;
    this.shiftTime = 50;           // ms au point mort pendant le passage
    this.clutch_stiffness = 180;   // raideur de l'embrayage tenu (voir EAEngine.solveVel)
    this.init(cfg);
  }

  init(cfg) {
    if (cfg) Object.assign(this, cfg);
    this.gear = 0; this.theta = 0; this.omega = 0; this.prevTheta = 0; this.prevOmega = 0;
    this._passageA = null; this._rapportVise = 0; this._facteur = 1;
    this.downShift = false;
  }

  integrate(dt) { this.prevTheta = this.theta; this.theta += this.omega * dt; }
  update(h) { this.prevOmega = this.omega; this.omega = (this.theta - this.prevTheta) / h; }

  solvePos(eng, h) {
    const c = eng.theta - this.theta;
    this.theta += this.correction(c, h, this.compliance) * Math.sign(c);
  }

  solveVel(eng, h, clutch = 1) {
    const damping = (this.gear > 3 ? this.damping * 0.75 : this.damping) * clutch;
    this.omega += (eng.omega - this.omega) * Math.min(0.5, damping * h);
  }

  correction(corr, h, compliance = 0) {
    const w = corr * corr / this.inertia;
    return corr * (corr / (w + compliance / h / h));
  }

  ratioOf(gear) {
    const g = eaClamp(gear == null ? this.gear : gear, 0, this.gears.length);
    return g > 0 ? this.gears[g - 1] : 0;
  }

  totalRatio() { return this.ratioOf() * this.final_drive; }

  /* Le passage, daté sur l'horloge du jeu. On tombe au point mort tout de suite, et le rapport
  s'engage `shiftTime` plus tard — c'est ce trou qui s'entend, et c'est lui qui fait qu'une montée
  en régime n'est pas une ligne droite. */
  changeGear(gear, time) {
    const avant = this.ratioOf(this.gear), apres = this.ratioOf(gear);
    const f = avant > 0 ? apres / avant : 0;
    if (f === 1) return;
    this.gear = 0;
    this.downShift = f > 1;
    this._passageA = time + this.shiftTime;
    this._rapportVise = eaClamp(gear, 0, this.gears.length);
    this._facteur = f;
  }

  /* À l'engagement, les deux volants repartent du même angle.

  La contrainte de position de l'original travaille sur `drivetrain.theta - engine.theta`, deux
  angles ABSOLUS qui s'accumulent depuis le début. Chez l'auteur ils partent de zéro ensemble et le
  restent. Chez nous la transmission est menée par les roues et passe par le point mort à chaque
  rapport : à l'engagement l'écart vaut ce qu'il vaut, souvent des dizaines de radians. La
  correction sature alors à l'inertie (0,55 rad par sous-pas), `update` relit ce bond comme une
  vitesse de 1320 rad/s, et le régime n'a plus aucun rapport avec la boîte — 51 % d'écart mesuré.
  Les resynchroniser à l'engagement rend son sens à la contrainte : elle ne décrit plus qu'un
  enroulement de transmission, ce qu'elle a toujours voulu décrire. */
  avance(time, engine) {
    if (this._passageA == null || time < this._passageA) return;
    this.omega *= this._facteur;
    this.gear = this._rapportVise;
    this.downShift = false;
    this._passageA = null;
    if (engine) { this.theta = engine.theta; this.prevTheta = engine.theta; }
  }
}

/* Le véhicule : le pont entre la voiture du jeu et le volant d'inertie.

Chez l'auteur, c'est un banc d'essai — on passe les rapports au clavier et rien ne tire les roues.
Chez nous la vitesse de la voiture est SOUVERAINE : elle sort de la physique du jeu, et le son doit
la suivre, pas l'inverse. On impose donc la vitesse de rotation de la transmission depuis les roues,
et on laisse le moteur la chasser par `solveVel`. Tout ce que le modèle apporte — le temps de
montée, le trou au passage, le rebond au rupteur, la reprise du régime au rétrogradage — reste,
mais la voiture ne dépend jamais du son. */
class EAVehicle {
  constructor(cfg) {
    this.engine = new EAEngine();
    this.drivetrain = new EADrivetrain();
    this.wheel_radius = 0.3;
    this.subSteps = 20;
    if (cfg) this.init(cfg);
  }

  init(cfg) {
    this.engine.init(cfg.engine);
    this.drivetrain.init(cfg.drivetrain);
    if (cfg.wheel_radius) this.wheel_radius = cfg.wheel_radius;
    if (cfg.vmax) this.accordeBoite(cfg.vmax);
  }

  /* Le pont accordé sur la vitesse maximale de la voiture, au lieu d'un nombre posé à la main.

  Le rupteur ne peut rien contre une mauvaise démultiplication. Il coupe les gaz, mais ce sont les
  ROUES qui imposent le régime en prise : si le dernier rapport donne 8210 tr/min à la vitesse
  maximale d'une voiture qui coupe à 7000, elle y monte quand même et y reste. C'est ce qui est
  arrivé à la 911 Turbo, à la GT40 et à la Corvette avec les rapports que j'avais écrits — trois
  voitures sur neuf, et rien ne l'aurait dit à l'oreille sinon qu'elles sonnent « trop haut ».

  Une vraie voiture est démultipliée pour que le dernier rapport atteigne le rupteur exactement à
  sa vitesse maximale. On calcule donc le pont au lieu de le deviner, et c'est juste par
  construction pour toutes les voitures, y compris celles de l'atelier. */
  accordeBoite(vmax) {
    const d = this.drivetrain, dernier = d.gears[d.gears.length - 1];
    const omegaRoue = vmax / this.wheel_radius;
    if (omegaRoue <= 0 || dernier <= 0) return;
    d.final_drive = this.engine.limiter / (omegaRoue * dernier * RPM_PAR_OMEGA);
  }

  // le régime que la boîte impose à cette vitesse, sur ce rapport
  rpmFor(v, gear) {
    const r = this.drivetrain.ratioOf(gear) * this.drivetrain.final_drive;
    return r > 0 ? (v / this.wheel_radius) * r * RPM_PAR_OMEGA : 0;
  }

  /* Le rapport qui garde le régime dans sa plage utile, avec une hystérésis.

  Sans elle, une voiture qui oscille autour de la vitesse de passage passe et repasse le rapport
  plusieurs fois par seconde : la boîte claque et le son part en vibrato. On ne monte donc qu'à
  95 % du rupteur et on ne redescend qu'en dessous de 55 % du régime que donnerait le rapport
  inférieur — deux seuils qui ne se touchent pas. */
  gearFor(v) {
    const e = this.engine, n = this.drivetrain.gears.length, g0 = this.drivetrain.gear || 1;
    let g = g0;
    while (g < n && this.rpmFor(v, g) > e.limiter * 0.95) g++;
    while (g > 1 && this.rpmFor(v, g - 1) < e.limiter * 0.55) g--;
    return g;
  }

  /* L'embrayage, que le banc d'essai de l'auteur n'a pas.

  Chez lui on passe les rapports à la main sur un moteur qui ne tire rien. Chez nous les roues
  mènent, et à l'arrêt elles tiendraient le moteur à zéro : au départ d'une course, la voiture
  calerait au lieu de monter dans les tours. L'embrayage patine donc tant que le premier rapport ne
  tourne pas assez vite pour tenir le ralenti, et prend progressivement. */
  clutchAt(v) {
    return eaRatio(this.rpmFor(v, Math.max(1, this.drivetrain.gear)), this.engine.idle * 0.55, this.engine.idle * 1.15);
  }

  update(time, dt, v, throttle) {
    const e = this.engine, d = this.drivetrain;
    e.throttle = eaClamp(throttle, 0, 1);

    const vise = this.gearFor(v);
    if (d._passageA == null && d.gear !== vise && vise > 0) d.changeGear(vise, time);
    d.avance(time, e);
    /* Pendant le passage, l'embrayage est DÉBRAYÉ. C'est ce qui fait qu'une montée en régime n'est
    pas une droite : le moteur est lâché pour la durée du passage, retombe sur son frein moteur, et
    le rapport suivant le rattrape plus bas. Ce trou est la moitié de ce qu'on entend d'une boîte. */
    const clutch = d._passageA != null ? 0 : this.clutchAt(v);
    this.clutch = clutch;

    const h = dt / this.subSteps;
    for (let i = 0; i < this.subSteps; i++) {
      const t = time + dt * 1000 * (i / this.subSteps);
      e.integrate(0, t, h);
      d.integrate(h);
      // en prise, les roues mènent : la transmission est posée, pas intégrée librement
      if (clutch > 0.01) { e.solvePos(d, h); d.solvePos(e, h); }
      e.update(h); d.update(h);
      // embrayage débrayé : les deux volants s'ignorent, dans les deux sens
      e.solveVel(d, h, clutch, d.clutch_stiffness);
      d.solveVel(e, h, clutch);
      /* Les roues imposent la vitesse de la transmission, et elles le font EN DERNIER.

      Deux erreurs successives ici, toutes deux invisibles sans mesure. D'abord `d.theta` était
      avancé une seconde fois, et `update` relisait ce déplacement comme une vitesse : omega
      doublait à chaque sous-pas, 6,6 × 10³⁰¹ rad/s en un demi-tour de seconde, puis NaN. Ensuite,
      corrigé avant `update`, le rattrapage était simplement JETÉ — `update` recalcule omega depuis
      l'angle etefface tout ce qu'on avait posé. Le régime tombait alors à 665 tr/min là où la
      boîte en imposait 7268, et rien ne le disait à part la mesure.

      Sa place est ici, avec les autres vitesses, et après elles : une voiture porte mille fois
      l'inertie de son embrayage, donc c'est la roue qui a le dernier mot, pas le volant. */
      if (d.gear > 0) {
        const cible = (v / this.wheel_radius) * d.totalRatio();
        d.omega += (cible - d.omega) * Math.min(0.6, 120 * h);
      }
    }
    if (e.omega < 0) { e.omega = 0; e.rpm = 0; }
    e.rpm = Math.max(0, e.omega * RPM_PAR_OMEGA);
    return e.rpm;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EAEngine, EADrivetrain, EAVehicle, eaClamp, eaRatio, RPM_PAR_OMEGA };
}

/* Le mélangeur : quatre boucles, deux fondus croisés, et une transposition assumée.

Le principe de l'auteur. Quatre prises STATIONNAIRES — pied dedans en bas, pied dedans en haut,
pied levé en bas, pied levé en haut — mélangées par deux fondus à puissance constante : l'un sur le
régime, l'autre sur l'accélérateur. Chaque prise est ensuite désaccordée de `(régime - son régime à
elle) × facteur` en cents.

IL Y A DONC DE LA TRANSPOSITION, et c'est un renversement par rapport à ce qu'on faisait. Le lecteur
granulaire n'en faisait aucune : il se déplaçait dans une montée enregistrée. Il avait raison sur ce
point et ce n'est pas ce qui lui manquait ; ce qui lui manquait, c'est qu'une montée enregistrée ne
sait rien faire d'autre que monter. Pas de pied levé, pas de trou au passage, pas de rebond au
rupteur, pas de ralenti.

Ce qui rend la transposition tenable ici, et ne l'était pas avant : elle est PARTIELLE. Le facteur
vaut 0,2 cent par tour, soit un cinquième de ce qu'il faudrait pour suivre exactement le régime. Le
reste du chemin est fait par le fondu vers la prise voisine, enregistrée plus haut. Une seule boucle
étirée sur toute la plage demandait dix-neuf demi-tons ; ici chaque prise ne s'écarte que de trois
ou quatre de son propre régime, et c'est la distance sur laquelle un timbre tient. */
class EASampler {
  constructor(ctx, sortie) {
    this.ctx = ctx;
    this.out = sortie || ctx.destination;
    this.voix = {};
    this.pitchFactor = 0.2;          // cents par tour/minute — voir plus haut
  }

  /* Une voix = une boucle qui tourne en permanence, dont on ne bouge que le gain et l'accord.
  Elles ne démarrent ni ne s'arrêtent jamais : un `start()` par note coûterait un clic à chaque
  changement de régime, et c'est exactement ce qu'on cherche à éviter. */
  /* Changer de jeu de prises, c'est d'abord se débarrasser du précédent.

  Une voix ne s'arrête jamais d'elle-même : c'est tout l'intérêt, aucun `start()` par note, donc
  aucun clic. Mais charger un second jeu par-dessus laisserait le premier tourner à son dernier
  gain, et deux moteurs joueraient ensemble. */
  vide() {
    for (const k of Object.keys(this.voix)) {
      try { this.voix[k].src.stop(); } catch (e) { /* déjà arrêtée */ }
      this.voix[k].src.disconnect();
      this.voix[k].gain.disconnect();
    }
    this.voix = {};
  }

  async charge(defs, base = '', niveau = 1) {
    this.vide();
    /* Le niveau du JEU, distinct des volumes de chaque prise.

    Les volumes viennent de la configuration de l'auteur et décrivent l'équilibre entre ses quatre
    boucles : 2,5 sur la voie haute du 458, 1,6 sur sa voie levée. Chez lui une sortie maîtresse
    ramenait le tout ; chez nous ils arrivaient tels quels sur le compresseur et saturaient. On ne
    touche donc pas à son équilibre, on ne descend que la sortie du jeu entier. */
    this.niveau = niveau;
    /* LES CINQ PRISES DESCENDENT ENSEMBLE, et non l'une après l'autre.

    La boucle attendait chaque fichier avant de demander le suivant : cinq transferts en série, cinq
    allers-retours en série, et sur un lien lent les derniers n'arrivaient jamais avant que la course
    ne parte sans eux. Ce sont trois à quatre mégaoctets qui bloquent le départ — c'est le plus gros
    poste de tout ce que le jeu télécharge, et il était le seul à ne pas profiter du parallélisme que
    le navigateur offre gratuitement.

    Les voix ne sont branchées qu'UNE FOIS TOUT ARRIVÉ. Les brancher au fil de l'eau ferait entrer le
    moteur voix par voix — une tenue basse seule pendant deux secondes, puis la haute par-dessus —
    ce qui s'entend bien plus qu'un démarrage un peu plus tard. */
    const cles = Object.keys(defs);
    const arrives = await Promise.all(cles.map(async (cle) => {
      const d = defs[cle];
      const buf = await this.ctx.decodeAudioData(await (await fetch(encodeURI(base + d.source))).arrayBuffer());
      return { cle, d, buf };
    }));
    for (const { cle, d, buf } of arrives) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      if (d.loopStart != null) src.loopStart = d.loopStart;
      if (d.loopEnd != null) src.loopEnd = d.loopEnd;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      src.connect(g).connect(this.out);
      src.start(0, d.loopStart || 0);
      this.voix[cle] = { src, gain: g, rpm: d.rpm || 1000, volume: d.volume == null ? 1 : d.volume };
    }
  }

  // fondu à puissance constante : la somme des carrés reste 1, donc le niveau ne creuse pas au milieu
  static fondu(v, a, b) {
    const x = eaClamp((v - a) / (b - a), 0, 1);
    return { haut: Math.cos((1 - x) * 0.5 * Math.PI), bas: Math.cos(x * 0.5 * Math.PI) };
  }

  /* Le fondu de l'auteur, tel quel : 3000 à 6500 tours, en dur.

  J'avais d'abord ramené la bande et le régime de chaque prise au rupteur de la voiture qui les
  joue, comme pour l'ancien lecteur granulaire. Ce n'est pas sa méthode, et Bruno a demandé la
  sienne : chez lui, chaque voiture a son jeu de prises et sa configuration, et le fondu ne bouge
  pas. Ce qui distingue une voiture d'une autre est le régime auquel chaque prise a été
  enregistrée, plus son rupteur et son inertie — pas une correction d'échelle. */
  applique(engine, bande) {
    const v = this.voix;
    if (!v.on_low && !v.on_high) return;
    const bas = bande && bande[0] != null ? bande[0] : 3000;
    const haut = bande && bande[1] != null ? bande[1] : 6500;
    const r = EASampler.fondu(engine.rpm, bas, haut);
    const g = EASampler.fondu(engine.throttle, 0, 1);

    const pose = (cle, gain, accorde = true) => {
      const s = v[cle];
      if (!s) return;
      if (accorde) s.src.detune.value = (engine.rpm - s.rpm) * this.pitchFactor;
      s.gain.gain.value = gain * s.volume * (this.niveau == null ? 1 : this.niveau);
    };
    pose('on_low', g.haut * r.bas);
    pose('off_low', g.bas * r.bas);
    pose('on_high', g.haut * r.haut);
    pose('off_high', g.bas * r.haut);
    pose('limiter', eaRatio(engine.rpm, engine.soft_limiter * 0.93, engine.limiter), false);
  }

  // ce que le mélangeur envoie, pour qu'un essai puisse le lire au lieu de l'écouter
  etat() {
    const o = {};
    for (const k of Object.keys(this.voix)) {
      o[k] = { gain: +this.voix[k].gain.gain.value.toFixed(3), detune: Math.round(this.voix[k].src.detune.value) };
    }
    return o;
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports.EASampler = EASampler;
