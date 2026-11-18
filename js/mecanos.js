/* LES MÉCANICIENS DES STANDS (essai de la branche claude/degats-visuels).

« Pour les stands j'aimerais avoir des mécaniciens qui viennent autour de la voiture quand on la répare,
qui s'affairent puis qui la laissent partir, en plusieurs couleurs, chacune correspondant à un box de
stand. » (Bruno)

LES BOXES. La voie a trois rangées de garages de seize mètres (`Track.pitGarages`), quatre boxes de quatre
mètres chacune : douze boxes, qui couvrent la zone d'arrêt. Chaque box a sa couleur et son équipe de
quatre, qui attend devant son garage, au bord de la voie, tournée vers la piste.

UN ARRÊT. Quand une voiture s'immobilise dans la zone (`pitState === 'arret'`), l'équipe du box le plus
proche — ou du plus proche qui soit libre — vient à elle :

  attente (1) → marche (2 ↔ 3) jusqu'à sa place autour de la voiture → réparation (4 ↔ 5), le scotch (7)
  pour celui qui est au nez → dégagement (6) juste avant la fin de la réparation, pour la laisser partir
  → marche (2 ↔ 3) jusqu'au garage → attente (1).

Les places : un au nez (le scotch), un à chaque flanc, un à l'arrière. Tous regardent la voiture.

LES SPRITES. Bruno a dessiné les sept poses, vues de dessus, la tête vers l'avant (le haut de l'image).
Tant que sa planche n'est pas dans le dépôt, ils sont dessinés ici dans le même style (`_dessinePose`) :
le casque blanc à bande noire, la combinaison à la couleur du box, les gants et les chaussures sombres,
le gros contour noir. Chaque pose est peinte une fois par couleur, dans une petite image, et dessinée
ensuite d'un seul `drawImage`. */
'use strict';

const MECANOS = {
  parBox: 4,
  largeurBox: 4,       // m, un quart de rangée de garages
  taille: 1.1,         // m : le sprite, un peu plus grand que nature pour se lire à l'écran
  marche: 5,           // m/s : une équipe de stand court
  cadence: 7,          // pas par seconde à la marche (2 ↔ 3)
  geste: 4,            // gestes par seconde au travail (4 ↔ 5)
  degage: 0.5,         // s avant la fin de la réparation : on se redresse et on recule
  // une couleur par box, dans l'ordre de la voie
  couleurs: ['#d8342c', '#2f6fd6', '#2aa85a', '#f2b705', '#f07b1d', '#8b4fd1',
    '#1fb3b3', '#e25aa0', '#8aa02a', '#c9cdd1', '#4a4f56', '#a0522d'],
};

/* Les poses, comme sur la planche de Bruno. */
const POSE = { ATTENTE: 0, MARCHE_A: 1, MARCHE_B: 2, REPARE_A: 3, REPARE_B: 4, DEGAGE: 5, SCOTCH: 6 };

const MecanoSprites = {
  _cache: new Map(),
  px: 72,   // pixels du sprite pour un mètre

  frame(pose, couleur) {
    const cle = pose + couleur;
    let c = this._cache.get(cle);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = this.px;
      const g = c.getContext('2d');
      g.translate(this.px / 2, this.px / 2); g.scale(this.px, this.px);
      this._dessinePose(g, pose, couleur);
      this._cache.set(cle, c);
    }
    return c;
  },

  /* Une pose, dans un carré d'un mètre centré, l'avant vers le haut (−y). */
  _dessinePose(g, pose, couleur) {
    const trait = 0.045, noir = '#141414', gant = '#3b3b3b', ombre = 'rgba(0,0,0,0.18)';
    const P = POSE;
    // les pieds, les mains (x, y, ouverte ?) ; le corps plus ramassé quand il est accroupi
    const accroupi = pose === P.REPARE_A || pose === P.REPARE_B || pose === P.SCOTCH;
    const pieds = {
      [P.ATTENTE]: [[-0.1, 0.33], [0.1, 0.33]],
      [P.MARCHE_A]: [[-0.1, 0.22], [0.1, 0.38]],
      [P.MARCHE_B]: [[-0.1, 0.38], [0.1, 0.22]],
      [P.REPARE_A]: [[-0.19, 0.3], [0.19, 0.3]],
      [P.REPARE_B]: [[-0.19, 0.3], [0.19, 0.3]],
      [P.DEGAGE]: [[-0.1, 0.36], [0.1, 0.28]],
      [P.SCOTCH]: [[-0.16, 0.32], [0.16, 0.32]],
    }[pose];
    const mains = {
      [P.ATTENTE]: [[-0.31, 0.16, 0], [0.31, 0.16, 0]],
      [P.MARCHE_A]: [[-0.3, 0.26, 0], [0.27, -0.3, 0]],
      [P.MARCHE_B]: [[-0.27, -0.3, 0], [0.3, 0.26, 0]],
      [P.REPARE_A]: [[-0.22, -0.43, 1], [0.22, -0.43, 1]],
      [P.REPARE_B]: [[-0.25, -0.43, 1], [0.24, -0.2, 0]],
      [P.DEGAGE]: [[-0.34, -0.06, 0], [0.34, -0.06, 0]],
      [P.SCOTCH]: [[-0.2, -0.4, 0], [0.2, -0.4, 0]],
    }[pose];
    const contour = (dessine, fond) => { g.beginPath(); dessine(); g.fillStyle = fond; g.fill(); g.lineWidth = trait; g.strokeStyle = noir; g.stroke(); };
    const rond = (x, y, r) => () => g.arc(x, y, r, 0, Math.PI * 2);
    // l'ombre au sol
    g.fillStyle = ombre; g.beginPath(); g.ellipse(0.04, 0.06, 0.36, 0.34, 0, 0, Math.PI * 2); g.fill();
    // les chaussures
    for (const [x, y] of pieds) contour(() => g.ellipse(x, y, 0.075, 0.06, 0, 0, Math.PI * 2), gant);
    // les bras, sous le corps : une bande de la couleur du box, de l'épaule à la main
    g.lineCap = 'round';
    for (const [hx, hy] of mains) {
      const sx = Math.sign(hx) * 0.24, sy = -0.02;
      g.strokeStyle = noir; g.lineWidth = 0.17; g.beginPath(); g.moveTo(sx, sy); g.lineTo(hx * 0.92, hy * 0.92); g.stroke();
      g.strokeStyle = couleur; g.lineWidth = 0.17 - trait * 2; g.beginPath(); g.moveTo(sx, sy); g.lineTo(hx * 0.92, hy * 0.92); g.stroke();
    }
    // le corps : les épaules et le dos, avec la couture au milieu
    contour(() => { if (accroupi) g.ellipse(0, 0.09, 0.27, 0.22, 0, 0, Math.PI * 2); else g.roundRect(-0.25, -0.12, 0.5, 0.42, 0.16); }, couleur);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.02;
    g.beginPath(); g.moveTo(0, 0.1); g.lineTo(0, accroupi ? 0.3 : 0.3); g.stroke();
    // les mains : un poing, ou une main ouverte
    for (const [hx, hy, ouverte] of mains) {
      if (ouverte) {
        contour(() => g.ellipse(hx, hy, 0.085, 0.075, 0, 0, Math.PI * 2), gant);
        for (const d of [-0.05, -0.017, 0.017, 0.05]) contour(rond(hx + d, hy - 0.075, 0.022), gant);
      } else contour(rond(hx, hy, 0.072), gant);
    }
    // le rouleau de scotch, et la bande tendue entre les deux mains
    if (pose === P.SCOTCH) {
      g.strokeStyle = noir; g.lineWidth = 0.075; g.beginPath(); g.moveTo(-0.2, -0.47); g.lineTo(0.22, -0.47); g.stroke();
      g.strokeStyle = '#8d9093'; g.lineWidth = 0.075 - trait; g.beginPath(); g.moveTo(-0.2, -0.47); g.lineTo(0.22, -0.47); g.stroke();
      contour(rond(-0.24, -0.47, 0.085), '#8d9093');
      contour(rond(-0.24, -0.47, 0.035), '#6b4f2a');
    }
    // le casque : blanc, la bande noire d'avant en arrière, un reflet
    contour(rond(0, -0.07, 0.205), '#f4f4f2');
    g.fillStyle = noir; g.fillRect(-0.035, -0.27, 0.07, 0.4);
    g.save(); g.beginPath(); g.arc(0, -0.07, 0.205, 0, Math.PI * 2); g.clip();
    g.fillStyle = 'rgba(0,0,0,0.14)'; g.beginPath(); g.arc(0.05, 0.02, 0.2, 0, Math.PI * 2); g.fill(); g.restore();
    g.lineWidth = trait; g.strokeStyle = noir; g.beginPath(); g.arc(0, -0.07, 0.205, 0, Math.PI * 2); g.stroke();
  },
};

class Equipes {
  /* Les douze boxes de la voie, et leurs équipes. */
  constructor(track) {
    this.track = track;
    this.boxes = [];
    const T = track, M = MECANOS;
    for (const gr of T.pitGarages()) {
      for (let k = 0; k < 4; k++) {
        const s = T.wrap(gr.s + (k - 1.5) * M.largeurBox), z = T.pitAt(s);
        if (!z) continue;
        this.boxes.push({ s, couleur: null, voiture: null, equipe: [] });
      }
    }
    // dans l'ordre de la voie, les couleurs aussi
    this.boxes.sort((a, b) => T.diff(b.s, a.s) > 0 ? 1 : -1);
    this.boxes.forEach((b, i) => {
      b.couleur = M.couleurs[i % M.couleurs.length];
      const z = T.pitAt(b.s), h = T.headingAt(b.s);
      const piste = T.pos(b.s, 0), centre = T.pos(b.s, z.externe + 1);
      const face = Math.atan2(piste.y - centre.y, piste.x - centre.x);
      // l'attente : deux rangs de deux devant le box, au bord de la voie, tournés vers la piste
      for (let j = 0; j < M.parBox; j++) {
        const d = (j % 2 ? 0.55 : -0.55), lat = z.externe + (j < 2 ? 0.6 : 1.35);
        const q = T.pos(b.s, lat), x = q.x + Math.cos(h) * d, y = q.y + Math.sin(h) * d;
        b.equipe.push({ home: { x, y, a: face }, x, y, a: face, pose: POSE.ATTENTE, etat: 'attente', t: Math.random() * 3, route: [], place: j });
      }
    });
  }

  /* Les places autour de la voiture, dans son repère (+x vers l'avant) : le nez, les deux flancs,
  l'arrière. Chacun regarde la voiture. */
  static places(car) {
    const L = car.cls.length / 2, W = car.cls.width / 2, e = 0.42;
    return [
      { x: L + e, y: 0, scotch: true },
      { x: 0.35, y: W + e },
      { x: 0.35, y: -(W + e) },
      { x: -(L + e), y: 0 },
    ];
  }

  /* Le repère de la voiture : +x vers l'avant, y sur le côté. */
  static local(car, x, y) {
    const cs = Math.cos(car.th), sn = Math.sin(car.th), dx = x - car.x, dy = y - car.y;
    return { x: dx * cs + dy * sn, y: -dx * sn + dy * cs };
  }
  static monde(car, lx, ly) {
    const cs = Math.cos(car.th), sn = Math.sin(car.th);
    return { x: car.x + lx * cs - ly * sn, y: car.y + lx * sn + ly * cs };
  }

  /* LE CHEMIN, PAS LA LIGNE DROITE : on ne traverse pas la voiture. Pour gagner l'autre flanc, le nez
  ou l'arrière, on contourne par le bout le plus proche, à soixante centimètres de la carrosserie. */
  static chemin(car, depuis, vers, a) {
    const L = car.cls.length / 2 + 0.6, W = car.cls.width / 2 + 0.6;
    const S = Equipes.local(car, depuis.x, depuis.y), P = Equipes.local(car, vers.x, vers.y);
    const cS = Math.sign(S.y) || 1, cP = Math.sign(P.y);
    const pts = [];
    const bout = Math.abs(P.x) > car.cls.length / 2 ? Math.sign(P.x) : (S.x >= 0 ? 1 : -1);
    const dehors = Math.abs(S.y) > car.cls.width / 2 || Math.abs(S.x) > car.cls.length / 2;
    if (dehors && (cP !== cS || Math.abs(P.x) > car.cls.length / 2)) {
      if (Math.abs(S.x) <= car.cls.length / 2 || Math.sign(S.x) !== bout) pts.push(Equipes.monde(car, bout * L, cS * W));
      if (cP && cP !== cS) pts.push(Equipes.monde(car, bout * L, cP * W));
    }
    pts.push({ ...vers, a });
    return pts;
  }

  pas(race, dt) {
    const M = MECANOS, T = this.track;
    // les voitures qui viennent de s'arrêter prennent un box
    for (const car of race.cars) {
      if (car.pitState === 'arret' && !car._box) {
        const libres = this.boxes.filter((b) => !b.voiture);
        const choix = (libres.length ? libres : this.boxes).reduce((m, b) => Math.abs(T.diff(car.s, b.s)) < Math.abs(T.diff(car.s, m.s)) ? b : m);
        choix.voiture = car; car._box = choix;
      }
      if (car._box && car.pitState !== 'arret') {
        // repartie : l'équipe rentre, ceux de l'autre flanc en passant derrière la voiture
        const b = car._box; b.voiture = null; car._box = null;
        for (const m of b.equipe) if (m.etat !== 'attente') { m.etat = 'retour'; m.route = Equipes.chemin(car, m, m.home, m.home.a); }
      }
    }
    for (const b of this.boxes) {
      const car = b.voiture, places = car ? Equipes.places(car) : null;
      for (const m of b.equipe) {
        m.t += dt;
        if (car) {
          const p = places[m.place], w = Equipes.monde(car, p.x, p.y);
          const face = Math.atan2(car.y - w.y, car.x - w.x);
          if (car.pitT <= M.degage) {
            if (m.etat !== 'degage') {
              /* Se dégager : on se redresse, mains aux épaules, et on laisse la voie. Celui du nez
              s'écarte vers le garage — reculer, c'était rester devant la voiture qui repart ; les
              autres reculent d'un pas. */
              m.etat = 'degage';
              const g = Math.sign(Equipes.local(car, m.home.x, m.home.y).y) || 1;
              const q = p.scotch ? Equipes.monde(car, p.x, g * (car.cls.width / 2 + 0.9))
                : { x: m.x - Math.cos(face) * 0.9, y: m.y - Math.sin(face) * 0.9 };
              m.route = [{ ...q, a: face }];
            }
            this._marche(m, dt * 0.6);
            m.pose = POSE.DEGAGE;
          } else {
            if (m.etat === 'attente' || m.etat === 'retour') { m.etat = 'aller'; m.route = Equipes.chemin(car, m, w, face); }
            if (m.etat === 'aller' && this._marche(m, dt)) { m.etat = 'travail'; m.t = 0; }
            if (m.etat === 'travail') {
              m.x = w.x; m.y = w.y; m.a = face;
              m.pose = p.scotch && (m.t % 2.2) > 1.1 ? POSE.SCOTCH : (Math.floor(m.t * M.geste + m.place) % 2 ? POSE.REPARE_B : POSE.REPARE_A);
            }
          }
        } else if (m.etat === 'retour') {
          if (this._marche(m, dt)) { m.etat = 'attente'; m.a = m.home.a; m.pose = POSE.ATTENTE; }
        } else if (m.etat === 'degage' || m.etat === 'aller' || m.etat === 'travail') {
          m.etat = 'retour'; m.route = [{ ...m.home }];
        } else { m.pose = POSE.ATTENTE; m.a = m.home.a; }
      }
    }
  }

  /* Un pas le long du chemin ; vrai une fois au bout. */
  _marche(m, dt) {
    const M = MECANOS;
    let reste = M.marche * dt;
    while (m.route.length) {
      const c = m.route[0], dx = c.x - m.x, dy = c.y - m.y, d = Math.hypot(dx, dy);
      if (d <= reste) { m.x = c.x; m.y = c.y; reste -= d; m.route.shift(); if (!m.route.length) { m.a = c.a; return true; } continue; }
      m.x += dx / d * reste; m.y += dy / d * reste; m.a = Math.atan2(dy, dx);
      m.pose = Math.floor(m.t * M.cadence) % 2 ? POSE.MARCHE_B : POSE.MARCHE_A;
      return false;
    }
    return true;
  }

  /* Dessin, dans le repère du monde. `vu(x, y)` : est-ce à l'écran ? */
  dessine(g, vu) {
    const t = MECANOS.taille;
    for (const b of this.boxes) for (const m of b.equipe) {
      if (vu && !vu(m.x, m.y)) continue;
      g.save(); g.translate(m.x, m.y); g.rotate(m.a + Math.PI / 2);
      g.drawImage(MecanoSprites.frame(m.pose, b.couleur), -t / 2, -t / 2, t, t);
      g.restore();
    }
  }

  // le rectangle du monde qu'ils occupent (pour la couche des voitures, qui s'efface par morceaux)
  emprise() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of this.boxes) for (const m of b.equipe) {
      minX = Math.min(minX, m.x); maxX = Math.max(maxX, m.x); minY = Math.min(minY, m.y); maxY = Math.max(maxY, m.y);
    }
    const r = MECANOS.taille;
    return { minX: minX - r, minY: minY - r, maxX: maxX + r, maxY: maxY + r };
  }
}

if (typeof module !== 'undefined') module.exports = { MECANOS, POSE, MecanoSprites, Equipes };
