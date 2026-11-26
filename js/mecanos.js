/* LES MÉCANICIENS DES STANDS (essai de la branche claude/degats-visuels).

« Pour les stands j'aimerais avoir des mécaniciens qui viennent autour de la voiture quand on la répare,
qui s'affairent puis qui la laissent partir, en plusieurs couleurs, chacune correspondant à un box de
stand. » Puis : « ils doivent toujours passer par l'arrière ou les côtés pour s'écarter ; ils doivent
poser du scotch devant et derrière, et sur les côtés s'occuper des roues — et donc avoir les mains sous la
carrosserie. » (Bruno)

LES BOXES. La voie a trois rangées de garages de seize mètres (`Track.pitGarages`), deux boxes de huit
mètres chacune : six boxes, qui couvrent la zone d'arrêt. Chaque box a sa couleur et son équipe de six,
qui attend devant son garage en deux rangs de trois, au bord de la voie, tournée vers la piste.

UN ARRÊT. Quand une voiture s'immobilise dans la zone (`pitState === 'arret'`), l'équipe du box le plus
proche — ou du plus proche qui soit libre — vient à elle :

  attente (1) → marche (2 ↔ 3) jusqu'à sa place → le travail → dégagement (6), un peu avant la fin de la
  réparation, pour la laisser partir → marche (2 ↔ 3) jusqu'au garage → attente (1).

Les places : le scotch (7) au nez et à l'arrière ; une roue chacun pour les quatre autres, accroupis
(4 ↔ 5), les mains sous la carrosserie — ceux-là se dessinent SOUS la voiture, ceux du scotch par-dessus.

LES CHEMINS. Personne ne passe devant la voiture. Pour gagner l'autre flanc, on fait le tour par
l'arrière ; le nez se rejoint en longeant le flanc côté garage. Pour se dégager, celui du nez s'écarte sur
le côté (reculer, c'était rester devant la voiture qui repart), celui de l'arrière recule, ceux des roues
s'éloignent de la voiture ; et l'on rentre au garage par l'arrière.

LES SPRITES. Bruno a dessiné les sept poses, vues de dessus, la tête vers l'avant (le haut de l'image).
Tant que sa planche n'est pas dans le dépôt, ils sont dessinés ici dans le même style (`_dessinePose`) :
le casque blanc à bande noire, la combinaison à la couleur du box, les gants et les chaussures sombres,
le gros contour noir. Chaque pose est peinte une fois par couleur, dans une petite image, et dessinée
ensuite d'un seul `drawImage`. */
'use strict';

const MECANOS = {
  parBox: 6,
  /* Six équipes, une pour deux boxes : « tu peux mettre moins d'équipages au stand, diviser par deux le
  nombre d'équipages » (Bruno). Il y en avait une par box, douze, soit soixante-douze mécaniciens alignés
  le long de la voie. */
  parGarage: 2,        // équipes par rangée de garages (seize mètres, trois rangées)
  largeurBox: 8,       // m : la part de rangée qui revient à chaque équipe
  taille: 1.1,         // m : le sprite, un peu plus grand que nature pour se lire à l'écran
  marche: 5,           // m/s : une équipe de stand court
  cadence: 7,          // pas par seconde à la marche (2 ↔ 3)
  geste: 4,            // gestes par seconde au travail (4 ↔ 5)
  degage: 0.7,         // s avant la fin de la réparation : on se redresse et on laisse la voie
  marge: 0.6,          // m : la distance à la carrosserie quand on contourne la voiture
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
    g.fillStyle = ombre; g.beginPath(); g.ellipse(0.04, 0.06, 0.36, 0.34, 0, 0, Math.PI * 2); g.fill();
    for (const [x, y] of pieds) contour(() => g.ellipse(x, y, 0.075, 0.06, 0, 0, Math.PI * 2), gant);
    g.lineCap = 'round';
    for (const [hx, hy] of mains) {
      const sx = Math.sign(hx) * 0.24, sy = -0.02;
      g.strokeStyle = noir; g.lineWidth = 0.17; g.beginPath(); g.moveTo(sx, sy); g.lineTo(hx * 0.92, hy * 0.92); g.stroke();
      g.strokeStyle = couleur; g.lineWidth = 0.17 - trait * 2; g.beginPath(); g.moveTo(sx, sy); g.lineTo(hx * 0.92, hy * 0.92); g.stroke();
    }
    contour(() => { if (accroupi) g.ellipse(0, 0.09, 0.27, 0.22, 0, 0, Math.PI * 2); else g.roundRect(-0.25, -0.12, 0.5, 0.42, 0.16); }, couleur);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.02;
    g.beginPath(); g.moveTo(0, 0.1); g.lineTo(0, 0.3); g.stroke();
    for (const [hx, hy, ouverte] of mains) {
      if (ouverte) {
        contour(() => g.ellipse(hx, hy, 0.085, 0.075, 0, 0, Math.PI * 2), gant);
        for (const d of [-0.05, -0.017, 0.017, 0.05]) contour(rond(hx + d, hy - 0.075, 0.022), gant);
      } else contour(rond(hx, hy, 0.072), gant);
    }
    if (pose === P.SCOTCH) {
      g.strokeStyle = noir; g.lineWidth = 0.075; g.beginPath(); g.moveTo(-0.2, -0.47); g.lineTo(0.22, -0.47); g.stroke();
      g.strokeStyle = '#8d9093'; g.lineWidth = 0.075 - trait; g.beginPath(); g.moveTo(-0.2, -0.47); g.lineTo(0.22, -0.47); g.stroke();
      contour(rond(-0.24, -0.47, 0.085), '#8d9093');
      contour(rond(-0.24, -0.47, 0.035), '#6b4f2a');
    }
    contour(rond(0, -0.07, 0.205), '#f4f4f2');
    g.fillStyle = noir; g.fillRect(-0.035, -0.27, 0.07, 0.4);
    g.save(); g.beginPath(); g.arc(0, -0.07, 0.205, 0, Math.PI * 2); g.clip();
    g.fillStyle = 'rgba(0,0,0,0.14)'; g.beginPath(); g.arc(0.05, 0.02, 0.2, 0, Math.PI * 2); g.fill(); g.restore();
    g.lineWidth = trait; g.strokeStyle = noir; g.beginPath(); g.arc(0, -0.07, 0.205, 0, Math.PI * 2); g.stroke();
  },
};

/* OÙ L'ON PEUT COLLER DU SCOTCH, lu sur le dessin propre de la voiture (`topArt`).

Un point convient s'il tombe sur la voiture (pixel opaque) et ni sur une vitre ni sur une roue. Sur les
dessins vus de dessus, les vitres et les pneus sont SOMBRES : un pixel sombre est refusé au milieu de
l'habitacle (le pare-brise, le toit vitré, la lunette) et sur les côtés au niveau des essieux (les pneus).
Ailleurs un pixel sombre est permis — l'aileron, tout à l'arrière, et le bas du nez. Les phares, clairs,
passent d'eux-mêmes. Une voiture à la livrée noire y perd des endroits, pas tous : le nez, l'arrière,
l'aileron et le milieu des portières restent. L'image est lue une fois par dessin. */
const ScotchMasque = {
  _cache: new Map(),
  de(car) {
    if (typeof topArt !== 'function') return null;
    const art = topArt(car.cls, car.livree);
    if (!art || !art.img || !art.img.naturalWidth) return null;
    const cle = art.img.src;
    let e = this._cache.get(cle);
    if (!e) {
      try {
        const c = document.createElement('canvas');
        c.width = art.img.naturalWidth; c.height = art.img.naturalHeight;
        const g = c.getContext('2d'); g.drawImage(art.img, 0, 0);
        e = { d: g.getImageData(0, 0, c.width, c.height).data, iw: c.width, ih: c.height };
      } catch (_) { return null; }
      this._cache.set(cle, e);
    }
    const [w, h] = topSize(car.cls, art);
    return { ...e, w, h, accepte: (q) => this._accepte(e, w, h, q) };
  },
  /* Un point (x, y) de la voiture, en mètres, +x vers l'avant. */
  point(e, w, h, x, y) {
    const u = Math.round((x / w + 0.5) * (e.iw - 1)), v = Math.round((y / h + 0.5) * (e.ih - 1));
    if (u < 0 || v < 0 || u >= e.iw || v >= e.ih) return false;
    const i = (v * e.iw + u) * 4, d = e.d;
    if (d[i + 3] < 200) return false;                                  // pas sur la voiture
    /* Une SURFACE sombre, pas un trait : les contours et les pointillés du dessin sont sombres eux aussi,
    et les prendre pour une vitre ou un pneu chassait les patchs des ailes et des flancs. On regarde neuf
    points autour, à trois pixels d'écart : sombre si au moins six le sont. */
    let sombres = 0;
    for (const du of [-3, 0, 3]) for (const dv of [-3, 0, 3]) {
      const uu = Math.min(e.iw - 1, Math.max(0, u + du)), vv = Math.min(e.ih - 1, Math.max(0, v + dv)), j = (vv * e.iw + uu) * 4;
      if (d[j + 3] < 200 || 0.3 * d[j] + 0.59 * d[j + 1] + 0.11 * d[j + 2] < 75) sombres++;
    }
    if (sombres < 6) return true;                                       // la carrosserie, un phare
    const fx = Math.abs(x / (w / 2)), fy = Math.abs(y / (h / 2));
    if (fx < 0.62 && fy < 0.8) return false;                            // une vitre
    if (fy > 0.45 && fx > 0.3 && fx < 0.88) return false;              // un pneu
    return true;                                                        // l'aileron, le bas du nez
  },
  // toutes les bandes du patch, chacune sur sa longueur et à ses deux bords
  _accepte(e, w, h, q) {
    for (const b of q.bandes) {
      const c = Math.cos(b.a), s = Math.sin(b.a);
      for (const t of [-0.5, -0.25, 0, 0.25, 0.5]) for (const o of [-0.45, 0.45]) {
        const x = q.x + b.dx + c * t * b.l - s * o * b.w, y = q.y + b.dy + s * t * b.l + c * o * b.w;
        if (!this.point(e, w, h, x, y)) return false;
      }
    }
    return true;
  },
};

class Equipes {
  /* Les six boxes de la voie, et leurs équipes. */
  constructor(track) {
    this.track = track;
    this.boxes = [];
    const T = track, M = MECANOS;
    for (const gr of T.pitGarages()) {
      for (let k = 0; k < M.parGarage; k++) {
        const s = T.wrap(gr.s + (k - (M.parGarage - 1) / 2) * M.largeurBox);
        if (T.pitAt(s)) this.boxes.push({ s, couleur: null, voiture: null, cote: 1, equipe: [] });
      }
    }
    this.boxes.sort((a, b) => T.diff(b.s, a.s) > 0 ? 1 : -1);   // dans l'ordre de la voie
    this.boxes.forEach((b, i) => {
      b.couleur = M.couleurs[i % M.couleurs.length];
      const z = T.pitAt(b.s), h = T.headingAt(b.s);
      const piste = T.pos(b.s, 0), centre = T.pos(b.s, z.externe + 1);
      const face = Math.atan2(piste.y - centre.y, piste.x - centre.x);
      // l'attente : deux rangs de trois devant le box, au bord de la voie, tournés vers la piste
      for (let j = 0; j < M.parBox; j++) {
        const d = (j % 3 - 1) * 0.85, lat = z.externe + (j < 3 ? 0.6 : 1.35);
        const q = T.pos(b.s, lat), x = q.x + Math.cos(h) * d, y = q.y + Math.sin(h) * d;
        b.equipe.push({ home: { x, y, a: face }, x, y, a: face, pose: POSE.ATTENTE, etat: 'attente', t: Math.random() * 3, route: [], place: j });
      }
    });
  }

  /* Les places autour de la voiture, dans son repère (+x vers l'avant, y sur le côté) : le scotch au nez
  et à l'arrière, une roue chacun pour les quatre autres, assez près pour avoir les mains sous la caisse. */
  static places(car) {
    const L = car.cls.length / 2, W = car.cls.width / 2, e = 0.42, xr = L * 0.62, yr = W + 0.32;
    return [
      { x: L + e, y: 0, scotch: true },
      { x: -(L + e), y: 0, scotch: true },
      { x: xr, y: yr, roue: true }, { x: xr, y: -yr, roue: true },
      { x: -xr, y: yr, roue: true }, { x: -xr, y: -yr, roue: true },
    ];
  }

  /* Le repère de la voiture. */
  static local(car, x, y) {
    const cs = Math.cos(car.th), sn = Math.sin(car.th), dx = x - car.x, dy = y - car.y;
    return { x: dx * cs + dy * sn, y: -dx * sn + dy * cs };
  }
  static monde(car, lx, ly) {
    const cs = Math.cos(car.th), sn = Math.sin(car.th);
    return { x: car.x + lx * cs - ly * sn, y: car.y + lx * sn + ly * cs };
  }

  /* LE CHEMIN : jamais devant la voiture, jamais à travers. Le long d'un flanc on va droit ; pour gagner
  l'autre flanc ou l'arrière on passe par les coins arrière ; le nez se rejoint par le coin avant du flanc
  où l'on est. `cote` : le côté du garage, pour celui qui part de devant ou de derrière. */
  static chemin(car, depuis, vers, a, cote) {
    const M = MECANOS, L = car.cls.length / 2, W = car.cls.width / 2, Lm = L + M.marge, Wm = W + M.marge;
    const S = Equipes.local(car, depuis.x, depuis.y), P = Equipes.local(car, vers.x, vers.y);
    const flanc = (q) => (Math.abs(q.y) > W ? Math.sign(q.y) : 0);
    const fS = flanc(S), fP = flanc(P), pts = [];
    const coin = (x, y) => pts.push(Equipes.monde(car, x, y));
    if (fS) {
      if (fP === fS) { /* même flanc : tout droit */ }
      else if (!fP) coin(P.x > 0 ? Lm : -Lm, fS * Wm);                  // le nez ou l'arrière, par ce flanc
      else { coin(-Lm, fS * Wm); coin(-Lm, fP * Wm); }                  // l'autre flanc : par l'arrière
    } else {
      // devant ou derrière la voiture : on rejoint d'abord le coin du côté où l'on va
      const c = fP || cote || 1;
      if (S.x < 0) { if (fP || P.x > 0) coin(-Lm, c * Wm); if (!fP && P.x > 0) coin(Lm, c * Wm); }
      else { coin(Lm, c * Wm); if (!fP && P.x < 0) coin(-Lm, c * Wm); }
    }
    pts.push({ ...vers, a });
    return pts;
  }

  /* LES PATCHS DE SCOTCH. « Des patchs de scotch plus petits en différentes zones, aléatoirement sur la
  zone réparée, et qui s'accumulent au fil des passages » ; « de l'aléa dans le placement des patchs et dans
  leur apparence, sans qu'ils soient trop gros ; sur la carrosserie, l'aileron ou les phares, pas sur les
  fenêtres ni les roues. » (Bruno)

  Les zones sont celles des points de vie (`ENFONCE`, js/car.js : le nez, les coins, les flancs,
  l'arrière). Seules les zones vraiment touchées sont scotchées — un choc enfonce aussi un peu ses deux
  voisines, et les scotcher toutes couvrait la voiture dès le premier arrêt : un patch par zone, deux si
  elle est enfoncée à fond, trois au plus par arrêt.

  TOUT EST TIRÉ AU HASARD : l'endroit dans la zone, la forme (une bande, deux en croix, deux qui se
  chevauchent, trois en éventail), l'angle, la longueur (30 à 50 cm), la largeur (12 à 16 cm), la teinte
  du gris, les bouts déchirés et le pli. Chaque patch tiré est ensuite ÉPROUVÉ sur le dessin de la voiture
  (`ScotchMasque`) : tous les points de ses bandes doivent tomber sur la voiture, et pas sur une vitre ni
  une roue. Sinon on en tire un autre, jusqu'à trente fois.

  Ceux de l'avant sont posés par le mécanicien du nez, ceux de l'arrière par celui de l'arrière, l'un
  après l'autre. Les patchs des arrêts précédents restent ; les plus vieux partent au-delà de vingt. Dans
  le repère de la voiture, en mètres. */
  static patchs(car) {
    const zones = car.enfoncement || [], n = zones.length;
    const tous = car._patchs || (car._patchs = []), neufs = [];
    const masque = ScotchMasque.de(car);
    const max = Math.max(0, ...zones), touchees = [];
    for (let k = 0; k < n; k++) if (zones[k] > 0.03 && zones[k] >= max * 0.6) touchees.push(k);
    touchees.sort((a, b) => zones[b] - zones[a]);
    let place = 3;
    for (const k of touchees) {
      const nb = Math.min(place, zones[k] > 0.2 ? 2 : 1);
      for (let i = 0; i < nb; i++) {
        const q = Equipes._tirePatch(car, k, n, masque);
        if (q) { neufs.push(q); place--; }
      }
      if (place <= 0) break;
    }
    for (const cote of [true, false]) {
      const liste = neufs.filter((q) => q.avant === cote);
      liste.forEach((q, i) => { q.seuil = (i + 1) / liste.length; q.debut = i / liste.length; });
    }
    tous.push(...neufs);
    if (tous.length > 20) tous.splice(0, tous.length - 20);
  }

  /* Un patch au hasard dans la zone `k`, éprouvé sur le dessin ; `null` si rien ne convient. */
  static _tirePatch(car, k, n, masque) {
    const L = masque ? masque.w / 2 : car.cls.length / 2, W = masque ? masque.h / 2 : car.cls.width / 2;
    const R = Math.random, gris = () => { const v = 140 + Math.floor(R() * 40); return `rgb(${v},${v + 2},${v + 1})`; };
    for (let essai = 0; essai < 30; essai++) {
      const ouvre = essai < 20 ? 0.5 : 0.9;   // on élargit la zone si elle ne veut rien
      const a = k * 2 * Math.PI / n + (R() - 0.5) * 2 * ouvre;
      const cx = Math.cos(a), cy = Math.sin(a), s = 1 / Math.max(Math.abs(cx), Math.abs(cy)), r = 0.55 + R() * 0.38;
      const x = cx * s * L * r, y = cy * s * W * r;
      const forme = R(), base = R() * Math.PI, teinte = gris();
      const bande = (dx, dy, ang, f = 1) => ({
        dx, dy, a: ang, l: (0.3 + R() * 0.2) * f, w: 0.12 + R() * 0.04, teinte: R() < 0.7 ? teinte : gris(),
        bouts: Array.from({ length: 6 }, () => R()), pli: 0.15 + R() * 0.35,
      });
      let bandes;
      if (forme < 0.35) bandes = [bande(0, 0, base)];
      else if (forme < 0.7) bandes = [bande(0, 0, base), bande((R() - 0.5) * 0.06, (R() - 0.5) * 0.06, base + 0.7 + R() * 0.7, 0.9)];
      else if (forme < 0.88) {
        const o = 0.06 + R() * 0.05;
        bandes = [bande(-Math.sin(base) * o, Math.cos(base) * o, base), bande(Math.sin(base) * o, -Math.cos(base) * o, base + (R() - 0.5) * 0.25, 0.9)];
      } else bandes = [-1, 0, 1].map((j) => bande(j * 0.03, j * 0.03, base + j * (0.35 + R() * 0.2), 0.8));
      const q = { x, y, bandes, avant: x >= 0, cetArret: true, seuil: 0, debut: 0 };
      if (!masque || masque.accepte(q)) return q;
    }
    return null;
  }

  pas(race, dt) {
    const M = MECANOS, T = this.track;
    // les voitures qui viennent de s'arrêter prennent un box
    for (const car of race.cars) {
      if (car.pitState === 'arret' && !car._box) {
        const libres = this.boxes.filter((b) => !b.voiture);
        const choix = (libres.length ? libres : this.boxes).reduce((m, b) => Math.abs(T.diff(car.s, b.s)) < Math.abs(T.diff(car.s, m.s)) ? b : m);
        choix.voiture = car; car._box = choix;
        // le scotch de cet arrêt : des patchs sur les zones à réparer, qui restent quand la voiture repart
        car._scotch = { avant: 0, arriere: 0 };
        Equipes.patchs(car);
        choix.cote = Math.sign(Equipes.local(car, choix.equipe[0].home.x, choix.equipe[0].home.y).y) || 1;
      }
      if (car._box && car.pitState !== 'arret') {
        // repartie : l'équipe rentre au garage, par l'arrière pour ceux de l'autre flanc ; le scotch
        // de cet arrêt est posé pour de bon
        const b = car._box; b.voiture = null; car._box = null;
        for (const q of car._patchs || []) q.cetArret = false;
        for (const m of b.equipe) if (m.etat !== 'attente') { m.etat = 'retour'; m.route = Equipes.chemin(car, m, m.home, m.home.a, b.cote); }
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
              /* Se dégager : on se redresse, mains aux épaules, et on laisse la voie — sur le côté pour
              celui du nez, en reculant pour celui de l'arrière, en s'éloignant de la voiture pour ceux
              des roues. Jamais vers l'avant. Celui qui n'était pas encore arrivé y va par le chemin. */
              const enRoute = m.etat === 'aller';
              m.etat = 'degage';
              const L = car.cls.length / 2, W = car.cls.width / 2;
              let q;
              if (p.scotch && p.x > 0) q = Equipes.monde(car, L + 0.3, b.cote * (W + 1.0));
              else if (p.scotch) q = Equipes.monde(car, p.x - 0.9, 0);
              else q = Equipes.monde(car, p.x, p.y + Math.sign(p.y) * 0.9);
              m.route = enRoute ? Equipes.chemin(car, m, q, face, b.cote) : [{ ...q, a: face }];
            }
            this._marche(m, dt);
            m.pose = POSE.DEGAGE;
          } else {
            if (m.etat === 'attente' || m.etat === 'retour') { m.etat = 'aller'; m.route = Equipes.chemin(car, m, w, face, b.cote); }
            if (m.etat === 'aller' && this._marche(m, dt)) { m.etat = 'travail'; m.t = 0; }
            if (m.etat === 'travail') {
              m.x = w.x; m.y = w.y; m.a = face;
              // au nez et à l'arrière, le scotch ; aux roues, les deux mains sous la caisse
              m.pose = p.scotch ? POSE.SCOTCH : (Math.floor(m.t * M.geste + m.place) % 2 ? POSE.REPARE_B : POSE.REPARE_A);
              /* Le scotch se pose sur la carrosserie (Renderer._scotch) : les patchs de l'avant par
              celui du nez, ceux de l'arrière par celui de l'arrière, finis pile au dégagement. */
              if (p.scotch && car._scotch) {
                // ce qui reste à dérouler, au rythme qui le finit pile au dégagement
                const k = p.x > 0 ? 'avant' : 'arriere', reste = Math.max(dt, car.pitT - M.degage);
                car._scotch[k] = Math.min(1, car._scotch[k] + (1 - car._scotch[k]) * Math.min(1, dt / reste));
              }
            }
          }
          m.dessus = !!p.scotch && m.etat === 'travail';
        } else {
          m.dessus = false;
          if (m.etat === 'retour') {
            if (this._marche(m, dt)) { m.etat = 'attente'; m.a = m.home.a; m.pose = POSE.ATTENTE; }
          } else if (m.etat !== 'attente') { m.etat = 'retour'; m.route = [{ ...m.home }]; }
          else { m.pose = POSE.ATTENTE; m.a = m.home.a; }
        }
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

  /* Dessin, dans le repère du monde. `couche` : 'dessous' (sous les voitures — tout le monde, sauf ceux
  du scotch au travail : les mains de ceux des roues passent ainsi sous la caisse) ou 'dessus' (ceux du
  scotch, le rouleau posé sur la carrosserie). */
  /* Seuls ceux qui sont à l'écran se dessinent. Les dix équipes l'étaient à chaque image, où que soit la
  caméra : une soixantaine de dessins par image, pour des stands qu'on ne voit que le temps de passer
  devant (mesuré : 1 ms par image de `drawImage` sur le banc mobile). Le cadre de l'écran est ramené dans
  le monde par l'inverse de la transformation, avec la taille d'un mécanicien de marge. */
  dessine(g, couche) {
    const t = MECANOS.taille, dessus = couche === 'dessus';
    let vue = null;
    if (g.canvas && g.getTransform) {
      const inv = g.getTransform().inverse(), W = g.canvas.width, H = g.canvas.height;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [px, py] of [[0, 0], [W, 0], [0, H], [W, H]]) {
        const x = inv.a * px + inv.c * py + inv.e, y = inv.b * px + inv.d * py + inv.f;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      vue = { x0: x0 - t, y0: y0 - t, x1: x1 + t, y1: y1 + t };
    }
    for (const b of this.boxes) for (const m of b.equipe) {
      if (!!m.dessus !== dessus) continue;
      if (vue && (m.x < vue.x0 || m.x > vue.x1 || m.y < vue.y0 || m.y > vue.y1)) continue;
      g.save(); g.translate(m.x, m.y); g.rotate(m.a + Math.PI / 2);
      g.drawImage(MecanoSprites.frame(m.pose, b.couleur), -t / 2, -t / 2, t, t);
      g.restore();
    }
  }

  // le rectangle du monde qu'occupent ceux d'une couche (la couche des voitures s'efface par morceaux)
  emprise(couche) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, n = 0;
    const dessus = couche === 'dessus';
    for (const b of this.boxes) for (const m of b.equipe) {
      if (!!m.dessus !== dessus) continue;
      n++; minX = Math.min(minX, m.x); maxX = Math.max(maxX, m.x); minY = Math.min(minY, m.y); maxY = Math.max(maxY, m.y);
    }
    if (!n) return null;
    const r = MECANOS.taille;
    return { minX: minX - r, minY: minY - r, maxX: maxX + r, maxY: maxY + r };
  }
}

if (typeof module !== 'undefined') module.exports = { MECANOS, POSE, MecanoSprites, Equipes };
