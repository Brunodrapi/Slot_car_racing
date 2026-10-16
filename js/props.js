/* Le décor autour de la piste, vu de dessus.

   Il y avait ici deux jeux d'objets, pour deux façons de regarder le monde. Des panneaux en trois
   quarts, découpés d'une planche de sprites, qui n'avaient de sens que sous une caméra inclinée —
   vu du dessus, un objet debout n'est rien — et un jeu dessiné à plat pour la vue de dessus. La
   caméra inclinée est retirée ; il ne reste que le second.

   Ce qui part avec eux n'est pas rien : vingt-cinq PNG qui descendaient par le réseau à CHAQUE
   course, y compris à plat, où personne ne les regardait. Ceux qui restent ne sont pas téléchargés
   du tout — ils sont peints sur une toile, dans la palette du circuit.

   Le placement reste tiré d'une graine, donc un circuit retrouve son décor d'une partie à l'autre.
*/
'use strict';

// `near`/`far` est la bande où un objet aime tomber, mesurée depuis le bord de la route : la caméra
// ne montre qu'une vingtaine de mètres de part et d'autre de la voiture, donc au-delà un objet
// existe sans être jamais vu.
function propRng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function seedFromId(id) {
  let h = 2166136261;
  for (let i = 0; i < String(id).length; i++) { h ^= String(id).charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Walk the track and drop objects on either side, beyond the gravel trap, never on the tarmac.
// A candidate is rejected if it lands too near any part of the circuit, which matters where the
// track folds back on itself, or too near an object already placed. Both sets of scenery — the
// billboards and the bird's-eye objects — are sown by this one routine.
function placeFrom(kinds, track, seed, density, clear) {
  const rnd = propRng(seed);
  const total = kinds.reduce((a, k) => a + k.weight, 0);
  const pick = () => {
    let r = rnd() * total;
    for (const k of kinds) { r -= k.weight; if (r <= 0) return k; }
    return kinds[0];
  };
  const N = track.n, step = 9, out = [];
  const clearOfTrack = (x, y, need) => {
    for (let i = 0; i < N; i += 4) {
      const dx = x - track.xs[i], dy = y - track.ys[i];
      const side = dx * track.nx[i] + dy * track.ny[i] >= 0 ? 1 : -1;
      const hw = side > 0 ? track.hwL[i] : track.hwR[i];
      const clearance = track.def.runoffs
        ? Math.max(need, hw + track.runoffWidthAt(i * track.ds, side) + need - track.halfWidth)
        : need;
      if (dx * dx + dy * dy < clearance * clearance) return false;
    }
    return true;
  };
  const clearOfProps = (x, y, need) => {
    for (let j = out.length - 1; j >= 0 && j > out.length - 40; j--) {
      const dx = x - out[j].x, dy = y - out[j].y;
      if (dx * dx + dy * dy < need * need) return false;
    }
    return true;
  };
  for (let s = 0; s < track.length; s += step) {
    for (const side of [1, -1]) {
      if (rnd() > density) continue;
      const k = pick();
      const i = track.idx(s + (rnd() - 0.5) * step);
      const hw = side > 0 ? track.hwL[i] : track.hwR[i];
      const off = hw + k.near + rnd() * (k.far - k.near) + k.wm * 0.3;
      const x = track.xs[i] + track.nx[i] * off * side;
      const y = track.ys[i] + track.ny[i] * off * side;
      // keep clear of the road itself wherever it runs, gravel trap included
      if (!clearOfTrack(x, y, track.halfWidth + (clear == null ? 8.5 : clear) + k.wm * 0.3)) continue;
      if (!clearOfProps(x, y, (k.wm + 2) * 0.6)) continue;
      out.push({ x, y, id: k.id });
    }
  }
  return out;
}

if (typeof module !== 'undefined') module.exports = { placeFrom };

/* ----------------------------------------------------------------- vu de dessus

Un arbre est une couronne et une ombre, pas un tronc. Chaque objet est dessiné dans la palette du
circuit plutôt que découpé d'une planche, ce qui lui permet de changer de teinte avec le thème.
*/

const TOP_PPM = 24;              // pixels per metre when baking a top-down object

// `draw` works in a square of side `w` pixels, centred, with the palette of the circuit.
const TOP_KINDS = [
  {
    id: 'tree', wm: 9.0, weight: 7, near: 7, far: 26,
    draw(g, w, pal) {
      const r = w * 0.44, c = w / 2;
      blob(g, c, c, r, 11, pal.canopy[0], 0.12, 0);
      blob(g, c - r * 0.17, c - r * 0.17, r * 0.62, 9, pal.canopy[1], 0.13, 1.1);
      blob(g, c + r * 0.3, c + r * 0.32, r * 0.3, 7, pal.canopy[2], 0.14, 2.3);
    },
  },
  {
    id: 'tree2', wm: 6.8, weight: 6, near: 7, far: 26,
    draw(g, w, pal) {
      const r = w * 0.44, c = w / 2;
      blob(g, c, c, r, 10, pal.canopy[2], 0.13, 0.6);
      blob(g, c - r * 0.15, c - r * 0.15, r * 0.6, 8, pal.canopy[0], 0.15, 1.9);
    },
  },
  {
    // A conifer from above is a rosette: dark fronds radiating from a small pale centre.
    id: 'pine', wm: 6.0, weight: 6, near: 7, far: 26,
    draw(g, w, pal) {
      const c = w / 2, r = w * 0.46;
      for (const [k, col, rr] of [[9, pal.pine[0], r], [7, pal.pine[1], r * 0.6]]) {
        g.fillStyle = col;
        g.beginPath();
        for (let i = 0; i < k; i++) {
          const a = i / k * Math.PI * 2, a2 = (i + 0.5) / k * Math.PI * 2;
          g.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr);
          g.lineTo(c + Math.cos(a2) * rr * 0.52, c + Math.sin(a2) * rr * 0.52);
        }
        g.closePath(); g.fill();
      }
      g.fillStyle = pal.trunk;
      g.beginPath(); g.arc(c, c, r * 0.12, 0, Math.PI * 2); g.fill();
    },
  },
  {
    id: 'bush', wm: 3.4, weight: 5, near: 6, far: 22,
    draw(g, w, pal) {
      const c = w / 2;
      blob(g, c, c, w * 0.42, 9, pal.canopy[1], 0.16, 0.3);
      blob(g, c - w * 0.06, c - w * 0.06, w * 0.24, 7, pal.canopy[0], 0.18, 1.4);
    },
  },
  {
    id: 'rock', wm: 3.0, weight: 3, near: 6, far: 20,
    draw(g, w, pal) {
      const c = w / 2;
      blob(g, c, c, w * 0.4, 7, pal.rock, 0.16, 0.9);
      blob(g, c - w * 0.07, c - w * 0.07, w * 0.22, 6, '#d8d2c4', 0.18, 2.1);
    },
  },
  {
    // The stack of felled trunks that lies at the edge of a forest road.
    id: 'logs', wm: 6.0, weight: 2, near: 7, far: 18,
    draw(g, w, pal) {
      const n = 4, lw = w * 0.84, lh = w * 0.15;
      for (let i = 0; i < n; i++) {
        const y = w * 0.24 + i * lh * 1.12;
        g.fillStyle = i % 2 ? pal.log : '#95602f';
        round(g, (w - lw) / 2, y, lw, lh, lh / 2); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.18)';
        round(g, (w - lw) / 2, y + lh * 0.62, lw, lh * 0.38, lh * 0.19); g.fill();
      }
    },
  },
  {
    /* A Cyclades house from above: flat cream roofs at two levels, a lip round each, a terrace
       under a painted awning, an outside stair, and the dark square of the hatch. Not a box with
       a lid — a pitched roof drawn from straight overhead reads as a triangle, which is why the
       first attempt looked like an envelope. */
    id: 'house', wm: 7.5, weight: 0, near: 8, far: 26,
    draw(g, w, pal) {
      const R = (x, y, ww, hh, c) => { g.fillStyle = c; g.fillRect(w * x, w * y, w * ww, w * hh); };
      R(0.06, 0.08, 0.56, 0.52, pal.wallDark);
      R(0.09, 0.11, 0.50, 0.46, pal.wall);
      R(0.58, 0.34, 0.36, 0.44, pal.wallDark);          // the lower wing, set back
      R(0.61, 0.37, 0.30, 0.38, pal.wall);
      R(0.12, 0.40, 0.19, 0.15, pal.roofA);             // an awning over the terrace
      R(0.66, 0.60, 0.16, 0.11, pal.roofA);
      R(0.44, 0.15, 0.09, 0.09, pal.wallDark);          // the stair hatch
      g.fillStyle = pal.wallDark;                       // the outside stair, step by step
      for (let i = 0; i < 5; i++) g.fillRect(w * 0.14, w * (0.62 + i * 0.035), w * 0.20, w * 0.018);
      R(0.30, 0.64, 0.07, 0.07, '#7fd0d4');             // a painted door
    },
  },
  {
    /* Its neighbour, with the terracotta tiles the mainland uses: from above a pitched roof shows
       its ridge as a line down the middle, one slope catching more light than the other, and the
       courses of tiles running down each. */
    id: 'house2', wm: 6.5, weight: 0, near: 8, far: 24,
    draw(g, w, pal) {
      const R = (x, y, ww, hh, c) => { g.fillStyle = c; g.fillRect(w * x, w * y, w * ww, w * hh); };
      R(0.08, 0.12, 0.76, 0.64, '#8f4f36');
      R(0.10, 0.14, 0.72, 0.29, pal.roofB);
      R(0.10, 0.45, 0.72, 0.29, '#9c5940');
      g.fillStyle = '#8f4f36';                          // the tile courses
      for (let i = 1; i < 8; i++) g.fillRect(w * (0.10 + i * 0.09), w * 0.14, w * 0.012, w * 0.60);
      R(0.10, 0.425, 0.72, 0.028, '#cd8a6b');
      R(0.62, 0.17, 0.10, 0.10, pal.wallDark);          // a chimney
      R(0.635, 0.185, 0.07, 0.07, '#6b5140');
    },
  },
  {
    // The white chapel with its blue dome, the one thing every postcard has.
    id: 'chapel', wm: 7.0, weight: 0, near: 9, far: 24,
    draw(g, w, pal) {
      const c = w / 2;
      g.fillStyle = pal.wallDark;
      g.fillRect(w * 0.16, w * 0.20, w * 0.64, w * 0.58);
      g.fillStyle = '#f9f6ee';
      g.fillRect(w * 0.19, w * 0.23, w * 0.58, w * 0.52);
      g.fillStyle = pal.roofA;
      g.beginPath(); g.arc(c, c, w * 0.20, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#7fd0d4';
      g.beginPath(); g.arc(c - w * 0.055, c - w * 0.055, w * 0.075, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f9f6ee';
      g.fillRect(w * 0.21, w * 0.14, w * 0.13, w * 0.12);
      g.fillStyle = pal.roofA;
      g.fillRect(w * 0.245, w * 0.165, w * 0.06, w * 0.06);
    },
  },
  {
    // A palm from above is a wheel of long fronds with a bright crown at the hub.
    id: 'palm', wm: 6.5, weight: 0, near: 7, far: 24,
    draw(g, w, pal) {
      const c = w / 2, r = w * 0.46;
      for (let i = 0; i < 11; i++) {
        const a = i / 11 * Math.PI * 2, rr = r * (i % 2 ? 0.78 : 1);
        g.fillStyle = i % 2 ? pal.canopy[2] : pal.canopy[0];
        g.beginPath();
        g.moveTo(c, c);
        g.lineTo(c + Math.cos(a - 0.14) * rr, c + Math.sin(a - 0.14) * rr);
        g.lineTo(c + Math.cos(a) * rr * 1.06, c + Math.sin(a) * rr * 1.06);
        g.lineTo(c + Math.cos(a + 0.14) * rr, c + Math.sin(a + 0.14) * rr);
        g.closePath(); g.fill();
      }
      g.fillStyle = pal.canopy[1];
      g.beginPath(); g.arc(c, c, r * 0.16, 0, Math.PI * 2); g.fill();
      g.fillStyle = pal.trunk;
      g.beginPath(); g.arc(c, c, r * 0.07, 0, Math.PI * 2); g.fill();
    },
  },
  {
    id: 'bales', wm: 4.4, weight: 2, near: 6, far: 16,
    draw(g, w, pal) {
      for (const [dx, dy] of [[0.3, 0.32], [0.68, 0.4], [0.44, 0.7]]) {
        const r = w * 0.17;
        g.fillStyle = '#d9bd7c';
        g.beginPath(); g.arc(w * dx, w * dy, r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#bd9f5f'; g.lineWidth = Math.max(1, w * 0.02);
        g.beginPath(); g.arc(w * dx, w * dy, r * 0.55, 0, Math.PI * 2); g.stroke();
      }
    },
  },
];

// An irregular round blob — the shape everything organic is made of here. The outline runs as a
// closed spline through the wobbled points rather than between them: joined by straight segments
// the same points read as a hexagon, which is what a canopy from above must not look like.
function blob(g, cx, cy, r, n, colour, wobble, phase) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    const rr = r * (1 + wobble * Math.sin(i * 2.7 + (phase || 0)));
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  g.fillStyle = colour;
  g.beginPath();
  let m = mid(pts[n - 1], pts[0]);
  g.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) {
    const nxt = mid(pts[i], pts[(i + 1) % n]);
    g.quadraticCurveTo(pts[i][0], pts[i][1], nxt[0], nxt[1]);
  }
  g.closePath(); g.fill();
}

function round(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
}

// Bake each object once per palette. The shadow is baked in with it: one offset ellipse under the
// whole thing, as if the sun sat high and behind the camera's right shoulder.
function buildTopArt(pal) {
  const art = {};
  for (const k of TOP_KINDS) {
    const w = Math.max(12, Math.round(k.wm * TOP_PPM));
    const pad = Math.round(w * 0.22);
    const c = document.createElement('canvas');
    c.width = c.height = w + pad * 2;
    const g = c.getContext('2d');
    // The shadow is the object's own outline, offset — an ellipse under everything was fine for a
    // round canopy and wrong for anything with corners: a house sat on a puddle.
    const sil = document.createElement('canvas');
    sil.width = sil.height = w;
    const sg = sil.getContext('2d');
    k.draw(sg, w, pal);
    sg.globalCompositeOperation = 'source-in';
    sg.fillStyle = 'rgba(30,26,20,0.22)';
    sg.fillRect(0, 0, w, w);
    g.drawImage(sil, pad - w * 0.09, pad + w * 0.11);
    g.save(); g.translate(pad, pad); k.draw(g, w, pal); g.restore();
    art[k.id] = { canvas: c, wm: k.wm * (c.width / w) };
  }
  return art;
}

/* Closer to the road than the billboards: seen from above there is no horizon to fill, and a tree
   that stands well back simply never enters the frame.

   `weights` re-weights the mix for the circuit's theme — no pines in a dune, no palms in the
   Ardennes — so the scenery belongs to the place rather than being the same wood everywhere. A
   kind whose weight falls to zero is simply not sown.

   A kind that belongs nowhere in particular carries a base weight of zero — the palms, the Cyclades
   houses, the chapel. For those the theme's number is not a multiplier but the weight itself,
   since multiplying zero would keep them out of the one place they were drawn for. */
function placeTopProps(track, id, density, weights) {
  let kinds = TOP_KINDS;
  if (weights) {
    kinds = TOP_KINDS
      .map(k => (weights[k.id] == null ? k
        : Object.assign({}, k, { weight: k.weight ? k.weight * weights[k.id] : weights[k.id] })))
      .filter(k => k.weight > 0);
    if (!kinds.length) kinds = TOP_KINDS;
  } else {
    kinds = TOP_KINDS.filter(k => k.weight > 0);
  }
  return placeFrom(kinds, track, seedFromId('top-' + id), density == null ? 0.85 : density, 6);
}

/* ------------------------------------------------------- l'implantation du circuit

Un semis ne fait pas un lieu. `placeTopProps` saupoudre : un arbre ici, un buisson là, la même
densité moyenne tout autour du tour, et les douze circuits finissent par se ressembler. Les vues
du dessus rangées dans `art/reprise circuit/` disent autre chose. Monza est un ruban percé dans un
bois, et ce bois est MASSIF : on ne voit pas à travers. Silverstone est un aérodrome nu, presque
sans arbre, mais cerné de tribunes et de hangars. Le Castellet est une pinède, avec sa piste
d'aviation le long de la ligne droite. Interlagos a ses deux lacs et ses gradins au-dessus des
stands. Ce qui distingue un circuit d'un autre, vu d'en haut, ce n'est pas combien il y a de
décor, c'est OÙ il y en a — et surtout où il n'y en a pas.

Une zone se déclare donc par secteur du tour : `from` et `to` en fraction, un côté, un recul
depuis la protection et une profondeur. Le reste se déduit du tracé, si bien qu'une zone suit les
virages sans qu'on ait à en relever le contour point par point.

TOUT EST DESSINÉ. Pas une image n'est chargée : une masse boisée est un sol sombre sur lequel on
pose des couronnes assez serrées pour se recouvrir, une tribune est une dalle et ses gradins, un
bâtiment est un toit et sa verrière. C'est la demande, et c'est aussi la seule façon de tenir : un
bois de Monza en vraies images, ce sont des milliers de fichiers à descendre avant le départ. */

const IMPL_CELL = 48;            // côté des cases servant à ne dessiner que ce qui est en vue

/* Projeter un point sur le tour entier, sans savoir où il tombe.

`Track.project` prend une FENÊTRE EN NOMBRE DE NŒUDS autour d'une abscisse connue, pas une distance
en mètres : elle existe pour qu'une voiture ne s'accroche pas à l'autre branche d'un croisement.
Lui passer un grand nombre pour dire « cherche partout » lui fait parcourir ce nombre de nœuds —
deux milliards de tours de boucle pour 1e9, ce qui ne finit jamais. La moitié des nœuds suffit à
couvrir l'anneau, et c'est le maximum qui ait un sens. */
function implProjette(track, x, y) {
  return track.project(x, y, 0, Math.ceil(track.n / 2) + 1);
}

// Le secteur d'une zone, en mètres, en acceptant qu'elle passe la ligne de départ (to < from).
function implSpan(track, z) {
  const L = track.length;
  const a = (z.from == null ? 0 : z.from) * L;
  let b = (z.to == null ? 1 : z.to) * L;
  if (b <= a + 1) b += L;
  return [a, b];
}

/* Les extrémités s'ouvrent et se ferment au lieu de commencer par un mur.

Un bois qui démarre à pleine profondeur fait une arête droite en travers du paysage, et l'œil ne
voit plus que cette arête. L'ouverture se fait sur trente mètres, ou sur le tiers de la zone quand
elle est courte — sinon une zone de quarante mètres n'aurait jamais sa profondeur. */
function implFondu(s, s0, s1) {
  const marge = Math.min(30, (s1 - s0) / 3);
  if (marge <= 0) return 1;
  const t = Math.min(s - s0, s1 - s) / marge;
  return t >= 1 ? 1 : t <= 0 ? 0 : t * t * (3 - 2 * t);
}

/* Où commence le paysage, à une abscisse donnée.

C'est `limiteProtection` plus le recul demandé. Un bois collé à la barrière enferme la piste dans
un couloir ; vingt mètres d'herbe derrière le rail, et on retrouve la respiration des vrais
circuits — celle-là même qu'on a cherchée en éloignant les barrières. */
function implBase(track, s, side, z) {
  return track.limiteProtection(s, side) + (z.recul == null ? 6 : z.recul);
}

/* Le contour d'une zone : bord intérieur à l'aller, bord extérieur au retour.

Le bord extérieur ONDULE. Une lisière de bois rectiligne sur quatre cents mètres se voit comme un
trait de règle en travers du paysage — c'est exactement ce qui trahissait la première version. Deux
sinusoïdes de périodes incommensurables suffisent à casser la ligne sans qu'un motif se répète, et
elles sont une fonction de l'abscisse, donc le contour et les couronnes ondulent ensemble. */
function implOndule(s, prof) {
  /* Trois périodes, dont une COURTE. Les deux premières donnent la forme générale de la lisière,
  mais elles s'étendent sur deux cents mètres et la caméra n'en montre qu'une trentaine : à
  l'échelle de jeu, leur ondulation est encore une ligne droite. La troisième, de dix-huit mètres
  de période, est celle qu'on voit effectivement en roulant. */
  return prof * (1 + 0.14 * Math.sin(s / 37) + 0.09 * Math.sin(s / 13.7 + 2.1)
    + 0.06 * Math.sin(s / 2.9 + 0.7));
}

/* Le contour d'une zone, DÉCOUPÉ EN TRONÇONS.

Le sol est tiré en dedans de deux mètres et demi par rapport aux couronnes. Sans ce retrait, le
polygone affleure le bord du semis et son arête apparaît là où les couronnes s'arrêtent : une bande
sombre et nue autour du bois, qui dessine exactement la ligne qu'on cherche à cacher. En retrait,
ce sont les couronnes qui débordent, et la lisière n'a plus de bord net du tout.

Le découpage, lui, est une affaire de budget. Une zone fait couramment quatre cents mètres de long
et son polygone deux cents points ; la caméra en montre trente. Peint d'un bloc, il était rempli en
entier à chaque image, et son rectangle englobant est si grand qu'il passait toujours le test de
visibilité — autrement dit, le test ne servait à rien. Des tronçons de soixante mètres portent
chacun le leur, et seuls ceux que la caméra touche sont peints. Ils partagent leurs bords exactement,
donc ils se recollent sans couture. */
function implContour(track, z, s0, s1, pas) {
  const retrait = z.kind === 'bois' ? 2.5 : 0;
  const bord = (u) => {
    const base = implBase(track, u, z.side, z);
    const prof = implOndule(u, z.prof) * implFondu(u, s0, s1);
    return [track.pos(u, z.side * (base + Math.min(retrait, prof / 3))),
      track.pos(u, z.side * (base + Math.max(0, prof - retrait)))];
  };
  const TRONCON = 60;
  const out = [];
  for (let a = s0; a < s1 - 1e-6; a += TRONCON) {
    const b = Math.min(a + TRONCON, s1);
    const dedans = [], dehors = [];
    for (let u = a; u <= b + 1e-6; u += pas) {
      const [d, h] = bord(Math.min(u, b));
      dedans.push(d); dehors.push(h);
    }
    const [d, h] = bord(b);
    dedans.push(d); dehors.push(h);
    out.push(dedans.concat(dehors.reverse()));
  }
  return out;
}

function implBbox(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/* Les essences par défaut d'une masse boisée.

Le thème dit déjà quel arbre pousse là — `PAL.props` pondère le semis — mais une masse n'est pas
un semis : elle veut deux ou trois essences qui se recouvrent, pas la liste entière. */
const IMPL_ESSENCES = {
  bois: [['tree', 1.2], ['tree2', 1], ['bush', 0.45]],
  pinede: [['pine', 1.6], ['bush', 0.3], ['tree2', 0.25]],
  taillis: [['bush', 1.5], ['tree2', 0.6]],
};

/* La masse boisée : un sol, puis des couronnes serrées.

Le pas de semis vaut une fraction du diamètre des couronnes, pour qu'elles se RECOUVRENT. C'est la
différence entre un bois et un verger : à pas égal au diamètre on voit le sol entre les arbres et
on compte les rangées. La grille est jitterée plutôt qu'un disque de Poisson — un front de Poisson
meurt dans une bande étroite, ce qui a déjà coûté assez cher ici, tandis qu'une grille secouée ne
peut pas mourir et donne le même désordre à l'œil. */
function implArbres(track, z, s0, s1, rnd, out) {
  const essences = IMPL_ESSENCES[z.essence || 'bois'] || IMPL_ESSENCES.bois;
  const total = essences.reduce((a, e) => a + e[1], 0);
  const pick = () => { let r = rnd() * total; for (const e of essences) { r -= e[1]; if (r <= 0) return e[0]; } return essences[0][0]; };
  const densite = z.densite == null ? 1 : z.densite;
  if (densite <= 0) return;
  const pas = 5.4 / Math.sqrt(densite);
  for (let s = s0; s < s1; s += pas) {
    const base = implBase(track, s, z.side, z);
    const prof = implOndule(s, z.prof) * implFondu(s, s0, s1);
    if (prof < 3) continue;
    for (let d = 0; d < prof; d += pas) {
      if (rnd() > Math.min(1, densite)) continue;
      const ss = s + (rnd() - 0.5) * pas * 0.9;
      const dd = base + d + (rnd() - 0.5) * pas * 0.9;
      if (dd < base) continue;
      const p = track.pos(ss, z.side * dd);
      // Une couronne de lisière est plus petite : un bois s'effiloche sur son bord.
      const lisiere = Math.min(1, Math.min(d, prof - d) / 9);
      out.push({ x: p.x, y: p.y, id: pick(), e: 0.62 + 0.38 * lisiere + rnd() * 0.28 });
    }
  }
}

/* Une tribune, vue du dessus : un toit, et sous son bord les gradins qui descendent vers la piste.

Les modules se suivent le long du secteur, chacun aligné sur le cap de la piste à son abscisse, ce
qui suffit à faire suivre la courbe sans déformer les rectangles. */
/* Le module se raccourcit dans les virages serrés.

Un bâtiment est un rectangle, et un rectangle de trente mètres posé le long d'un virage de treize
mètres de rayon chevauche le suivant : à Luffield et à l'épingle de Loews, les tribunes se
montaient les unes sur les autres en éventail. La longueur utilisable est donc bornée par le rayon
— c'est la même raison qui fait qu'une vraie tribune de virage est bâtie en tronçons courts. */
function implModule(track, s, demande) {
  const k = Math.abs(track.curvAt(s));
  const r = k > 1e-4 ? 1 / k : 1e4;
  return Math.max(8, Math.min(demande, r * 0.5));
}

function implTribunes(track, z, s0, s1, rnd, out) {
  const demande = z.module == null ? 26 : z.module;
  const prof = z.prof;
  let s = s0;
  while (s < s1) {
    const module = implModule(track, s + demande / 2, demande);
    const c = s + module / 2;
    if (c >= s1) break;
    const base = implBase(track, c, z.side, z);
    const p = track.pos(c, z.side * (base + prof / 2));
    out.push({
      type: 'tribune', x: p.x, y: p.y, a: track.headingAt(c),
      l: module, w: prof, side: z.side, toit: rnd() < 0.72,
      gradins: Math.max(3, Math.round(prof / 2.6)),
    });
    s += module + 2.5;
  }
}

/* Les bâtiments : stands, hangars du paddock, ateliers.

Le toit est plat et clair vu d'en haut, avec sa verrière ou ses lanterneaux en bande sombre. Les
proportions changent d'un bâtiment à l'autre, mais ils restent alignés sur la piste : un paddock
est construit le long d'une voie, pas semé au hasard. */
/* ON NE BÂTIT PAS DANS UN VIRAGE SERRÉ.

Raccourcir le module suffisait pour une tribune, qui est basse et peu profonde ; pas pour un
bâtiment, qui fait vingt-cinq mètres de fond. Autour de l'épingle de La Source, des modules de huit
mètres de long mais toujours aussi profonds se chevauchaient en éventail et débordaient sur la
piste — un paddock empilé dans un virage. Un vrai complexe de stands borde une ligne droite ; en
dessous du rayon seuil, on passe son chemin. */
const BATI_RAYON = 55;

function implBatiments(track, z, s0, s1, rnd, out) {
  const demande = z.module == null ? 34 : z.module;
  let s = s0;
  while (s < s1) {
    const module = implModule(track, s + demande / 2, demande) * (0.7 + rnd() * 0.5);
    const c = s + module / 2;
    if (c >= s1) break;
    const k = Math.abs(track.curvAt(c));
    if (k > 1 / BATI_RAYON) { s += module * 0.6; continue; }
    const base = implBase(track, c, z.side, z);
    const prof = z.prof * (0.6 + rnd() * 0.4);
    const p = track.pos(c, z.side * (base + prof / 2 + rnd() * z.prof * 0.15));
    out.push({
      type: z.kind === 'stands' ? 'stands' : 'hangar',
      x: p.x, y: p.y, a: track.headingAt(c),
      l: module, w: prof, side: z.side,
      portes: Math.max(2, Math.round(module / 9)), teinte: rnd(),
    });
    s += module + 5 + rnd() * 8;
  }
}

/* Un parking : des rangées de voitures, par rangs tête-bêche séparés d'une allée.

Il n'y a pas de modèle de voiture ici — à cette distance une voiture garée est un rectangle de
quatre mètres sur deux, et c'est leur ALIGNEMENT qui se lit, pas leur dessin. */
function implParking(track, z, s0, s1, rnd, out) {
  /* Les rangs sont PARALLÈLES ENTRE EUX, et non chacun aligné sur le cap de la piste à son
  abscisse. Un parking construit le long d'un virage avait des rangs en éventail : des voitures
  garées en étoile autour du centre de courbure, ce qu'aucun parking ne fait. Le cap est donc pris
  une fois pour toutes au milieu de la zone, et la grille est posée dans ce repère. */
  const mid = (s0 + s1) / 2;
  const a = track.headingAt(mid);
  const o = track.pos(mid, z.side * (implBase(track, mid, z.side, z) + z.prof / 2));
  const ux = Math.cos(a), uy = Math.sin(a);           // le long de la piste
  const vx = -Math.sin(a) * z.side, vy = Math.cos(a) * z.side;   // vers l'extérieur
  const demiL = (s1 - s0) / 2, rang = 11, place = 2.6;
  for (let u = -demiL; u < demiL; u += place) {
    for (let d = -z.prof / 2; d < z.prof / 2; d += rang) {
      for (const dd of [d, d + 4.6]) {
        if (dd > z.prof / 2) continue;
        if (rnd() < 0.12) continue;             // une place vide, sinon c'est une grille
        const x = o.x + ux * u + vx * dd, y = o.y + uy * u + vy * dd;
        // Trop près du ruban, où qu'il passe : on ne gare pas là.
        const pr = implProjette(track, x, y);
        if (Math.abs(pr.lat) < track.limiteProtection(pr.s, pr.lat >= 0 ? 1 : -1) + 4) continue;
        out.push({ type: 'voiture', x, y, a: a + Math.PI / 2, l: 4.3, w: 1.9, teinte: rnd() });
      }
    }
  }
}

/* Le relevé d'un circuit, zone par zone.

Rendu : les sols d'abord, sous la route, puis les couronnes et les bâtiments par-dessus tout le
reste. Les couronnes sont rangées en cases de quarante-huit mètres : la caméra en montre une
trentaine de mètres de côté, et parcourir les dix mille arbres d'un bois à chaque image pour en
dessiner quinze serait tout le budget de la frame. */
function placeImplantation(track, id, zones) {
  if (!zones || !zones.length) return null;
  const rnd = propRng(seedFromId('impl-' + id));
  const sols = [], arbres = [], batis = [], nus = [];
  for (const z of zones) {
    const [s0, s1] = implSpan(track, z);
    if (z.kind === 'nu') { nus.push({ s0, s1, side: z.side, prof: z.prof }); continue; }
    if (z.sol !== false)
      for (const pts of implContour(track, z, s0, s1, 4))
        sols.push({ pts, bbox: implBbox(pts), kind: z.kind, sol: z.sol });
    if (z.kind === 'bois') implArbres(track, z, s0, s1, rnd, arbres);
    else if (z.kind === 'tribune') implTribunes(track, z, s0, s1, rnd, batis);
    else if (z.kind === 'stands' || z.kind === 'hangars') implBatiments(track, z, s0, s1, rnd, batis);
    else if (z.kind === 'parking') implParking(track, z, s0, s1, rnd, batis);
  }
  /* UN BÂTIMENT EST ÉCARTÉ S'IL TOMBE SUR UNE AUTRE PORTION DE PISTE.

  Le recul est mesuré depuis la protection À SON ABSCISSE : il garantit qu'on ne déborde pas sur
  la piste à cet endroit-là, et rien de plus. Là où le circuit se replie — l'épingle de La Source,
  les deux branches d'une chicane — l'autre branche passe derrière, et un hangar posé à vingt
  mètres de l'une se retrouvait à cheval sur l'autre. C'est le même piège qui avait mis des
  barrières en croix à l'épingle, et il se règle de la même façon : on regarde où tombent
  réellement les quatre coins, et pas seulement d'où l'on est parti. */
  for (let i = batis.length - 1; i >= 0; i--) {
    const b = batis[i];
    if (b.type === 'voiture') continue;
    const cs = Math.cos(b.a), sn = Math.sin(b.a);
    let dedans = false;
    for (const du of [-b.l / 2, b.l / 2]) for (const dv of [0, -b.side * b.w]) {
      const x = b.x + cs * du - sn * dv, y = b.y + sn * du + cs * dv;
      const pr = implProjette(track, x, y);
      if (Math.abs(pr.lat) < track.limiteProtection(pr.s, pr.lat >= 0 ? 1 : -1)) dedans = true;
    }
    if (dedans) batis.splice(i, 1);
  }
  const cases = new Map();
  let marge = 8;                // la demi-taille du plus gros objet, pour la fenêtre de rendu
  const range = (o, r) => {
    if (r > marge) marge = r;
    o._r = r;
    const i0 = Math.floor((o.x - r) / IMPL_CELL), i1 = Math.floor((o.x + r) / IMPL_CELL);
    const j0 = Math.floor((o.y - r) / IMPL_CELL), j1 = Math.floor((o.y + r) / IMPL_CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = i + ',' + j;
      let c = cases.get(k); if (!c) cases.set(k, c = []);
      c.push(o);
    }
  };
  for (const a of arbres) range(a, 6);
  for (const b of batis) range(b, Math.max(b.l, b.w) * 0.7);
  return { sols, arbres, batis, nus, cases, cell: IMPL_CELL, marge };
}

/* Les zones `nu` effacent le semis ordinaire.

Silverstone est un aérodrome : entre Hangar Straight et Stowe il n'y a rien, et un bosquet semé là
par défaut trahit le lieu plus sûrement qu'une couleur fausse. */
function implEfface(track, impl, props) {
  if (!impl || !impl.nus.length) return props;
  return props.filter(p => {
    const pr = implProjette(track, p.x, p.y);
    const lat = pr.lat, side = lat >= 0 ? 1 : -1;
    for (const n of impl.nus) {
      if (n.side && n.side !== side) continue;
      let s = pr.s; if (s < n.s0) s += track.length;
      if (s < n.s0 || s > n.s1) continue;
      if (Math.abs(lat) < n.prof) return false;
    }
    return true;
  });
}

// Ground colour, not objects: the broad patches of bare earth that a circuit wears around its
// corners. Drawn under the road, so the tarmac always covers them.
function placePatches(track, id, density) {
  const d = density == null ? 0.6 : density;
  const rnd = propRng(seedFromId('patch-' + id));
  const N = track.n, out = [];
  if (d <= 0) return out;                       // a street circuit wears no earth
  for (let s = 0; s < track.length; s += 26) {
    for (const side of [1, -1]) {
      if (rnd() > d) continue;
      const i = track.idx(s + (rnd() - 0.5) * 20);
      const hw = side > 0 ? track.hwL[i] : track.hwR[i];
      const r = 7 + rnd() * 12;
      const off = hw + 1 + rnd() * 8;
      out.push({
        x: track.xs[i] + track.nx[i] * off * side,
        y: track.ys[i] + track.ny[i] * off * side,
        r, a: rnd() * Math.PI, k: 1 + Math.floor(rnd() * 3), dark: rnd() < 0.3,
      });
    }
  }
  return out;
}

/* ---------------------------------------------------------------------------- the puddles

Water lies where the road drains: along the edges, inside the white line, and in the hollows just
off the tarmac. So that is where the puddles go — never in the middle of the road, where they would
sit on the racing line and turn a circuit into a lottery. A car that clips one throws up spray and
carries water on its tyres for a few dozen metres, which is the trail.

They are elongated along the road, because a puddle at a kerb is shaped by the edge it collects
against, and a round pond in the middle of a straight looks like a hole.
*/
function placePuddles(track, id, density) {
  const d = density == null ? 0 : density;
  if (d <= 0) return [];
  const rnd = propRng(seedFromId('puddle-' + id));
  const out = [];
  for (let s = 0; s < track.length; s += 90) {
    for (const side of [1, -1]) {
      if (rnd() > d) continue;
      const i = track.idx(s + (rnd() - 0.5) * 26);
      const hw = side > 0 ? track.hwL[i] : track.hwR[i];
      const r = 1.0 + rnd() * 1.8;
      // Two thirds hug the inside of the white line, on the tarmac; the rest have run off it.
      const onRoad = rnd() < 0.68;
      const off = onRoad ? hw - r - rnd() * 1.6 : hw + 0.6 + rnd() * 3.2;
      if (off < 1) continue;
      out.push({
        x: track.xs[i] + track.nx[i] * off * side,
        y: track.ys[i] + track.ny[i] * off * side,
        s: i * track.ds, lat: off * side,
        th: track.th[i], r,
        long: 1.3 + rnd() * 0.9,          // stretched along the road
        phase: rnd() * 6.3, onRoad,
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------------------- the sea

A circuit by the water gets a bay rather than a pond: the sea follows a stretch of the lap on one
side, tapering to nothing at both ends so it reads as a coastline and not as a lake dropped beside
the road. The shore wobbles, because an offset curve at a constant distance looks like a canal.
*/

const BOAT_KINDS = [
  {
    // a sloop at anchor: white hull, one sail, a slick of shadow on the water
    id: 'sail', wm: 9, weight: 4,
    draw(g, w, pal) {
      const h = w * 0.34, cy = w / 2;
      g.fillStyle = '#f4f1e6';
      g.beginPath();
      g.moveTo(w * 0.06, cy); g.quadraticCurveTo(w * 0.5, cy - h / 2, w * 0.94, cy);
      g.quadraticCurveTo(w * 0.5, cy + h / 2, w * 0.06, cy);
      g.fill();
      g.fillStyle = pal.sailDeck || '#d8d2c2';
      g.fillRect(w * 0.3, cy - h * 0.16, w * 0.34, h * 0.32);
      g.fillStyle = pal.sail || '#ffffff';
      g.beginPath();
      g.moveTo(w * 0.46, cy); g.lineTo(w * 0.3, cy - h * 0.9); g.lineTo(w * 0.62, cy - h * 0.2);
      g.closePath(); g.fill();
    },
  },
  {
    id: 'yacht', wm: 12, weight: 2,
    draw(g, w, pal) {
      const h = w * 0.3, cy = w / 2;
      g.fillStyle = '#f7f5ee';
      g.beginPath();
      g.moveTo(w * 0.04, cy); g.quadraticCurveTo(w * 0.45, cy - h / 2, w * 0.96, cy - h * 0.16);
      g.lineTo(w * 0.96, cy + h * 0.16); g.quadraticCurveTo(w * 0.45, cy + h / 2, w * 0.04, cy);
      g.fill();
      g.fillStyle = pal.roofA || '#2f9aa0';
      g.fillRect(w * 0.42, cy - h * 0.22, w * 0.3, h * 0.44);
      g.fillStyle = '#dcd6c6';
      g.fillRect(w * 0.14, cy - h * 0.14, w * 0.22, h * 0.28);
    },
  },
  {
    id: 'fishing', wm: 7, weight: 3,
    draw(g, w, pal) {
      const h = w * 0.4, cy = w / 2;
      g.fillStyle = pal.boatHull || '#c9503a';
      g.beginPath();
      g.moveTo(w * 0.08, cy); g.quadraticCurveTo(w * 0.5, cy - h / 2, w * 0.92, cy);
      g.quadraticCurveTo(w * 0.5, cy + h / 2, w * 0.08, cy);
      g.fill();
      g.fillStyle = '#f4efe2';
      g.fillRect(w * 0.44, cy - h * 0.2, w * 0.24, h * 0.4);
      g.fillStyle = '#6b5a44';
      g.fillRect(w * 0.5, cy - h * 0.58, w * 0.05, h * 0.5);
    },
  },
];

// js/car.js already has a smoothstep with a different signature; this one only eases 0..1.
function ease01(t) { return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); }

/** The outline of the bay: the shore first, then the open water back the other way. */
function placeWater(track, spec) {
  if (!spec) return null;
  const L = track.length, side = spec.side || 1, step = 5;
  const s0 = spec.from * L, s1 = spec.to * L;
  const span = s1 - s0;
  if (span < 80) return null;
  const inner = [], outer = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let s = s0; s <= s1; s += step) {
    const i = track.idx(s), t = (s - s0) / span;
    // both ends close smoothly, so the water is a bay and not a slab that stops mid-air
    const taper = Math.min(ease01(t / 0.14), ease01((1 - t) / 0.14));
    const hw = side > 0 ? track.hwL[i] : track.hwR[i];
    const a = hw + spec.gap + 4 * Math.sin(s * 0.021) + 2 * Math.sin(s * 0.061);
    const b = a + spec.out * taper;
    const px = track.xs[i], py = track.ys[i], nx = track.nx[i] * side, ny = track.ny[i] * side;
    inner.push([px + nx * a, py + ny * a]);
    outer.push([px + nx * b, py + ny * b]);
    for (const [x, y] of [inner[inner.length - 1], outer[outer.length - 1]]) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  return { inner, outer, spec, bbox: { minX, minY, maxX, maxY } };
}

/** Boats at anchor, lying roughly along the shore, never on top of one another. */
function placeBoats(track, id, water) {
  if (!water) return [];
  const rnd = propRng(seedFromId('boat-' + id));
  const spec = water.spec, L = track.length, side = spec.side || 1;
  const s0 = spec.from * L, s1 = spec.to * L, span = s1 - s0;
  const total = BOAT_KINDS.reduce((a, k) => a + k.weight, 0);
  const out = [];
  for (let n = 0; n < 320; n++) {
    const s = s0 + rnd() * span, t = (s - s0) / span;
    const taper = Math.min(ease01(t / 0.14), ease01((1 - t) / 0.14));
    if (taper < 0.35) continue;                       // too close to where the bay closes
    const i = track.idx(s);
    const hw = side > 0 ? track.hwL[i] : track.hwR[i];
    const a = hw + spec.gap + 14, b = hw + spec.gap + spec.out * taper - 14;
    if (b <= a) continue;
    // moorings crowd the quay, so bias the draw toward the shore
    const off = a + (b - a) * Math.pow(rnd(), 1.7);
    const x = track.xs[i] + track.nx[i] * off * side;
    const y = track.ys[i] + track.ny[i] * off * side;
    let r = rnd() * total, k = BOAT_KINDS[0];
    for (const kk of BOAT_KINDS) { r -= kk.weight; if (r <= 0) { k = kk; break; } }
    if (out.some(o => (o.x - x) ** 2 + (o.y - y) ** 2 < 15 * 15)) continue;
    // moored boats lie roughly along the shore, with a little swing
    const th = track.th[i] + (rnd() - 0.5) * 0.9 + (rnd() < 0.5 ? 0 : Math.PI);
    out.push({ x, y, th, id: k.id });
  }
  return out;
}

function buildBoatArt(pal) {
  const art = {};
  for (const k of BOAT_KINDS) {
    const w = Math.max(16, Math.round(k.wm * TOP_PPM));
    const c = document.createElement('canvas');
    c.width = c.height = w;
    k.draw(c.getContext('2d'), w, pal);
    art[k.id] = { canvas: c, wm: k.wm };
  }
  return art;
}

if (typeof module !== 'undefined') module.exports.TOP_KINDS = TOP_KINDS;
if (typeof module !== 'undefined') module.exports.placeTopProps = placeTopProps;
if (typeof module !== 'undefined') module.exports.placePatches = placePatches;
if (typeof module !== 'undefined') module.exports.placeWater = placeWater;
if (typeof module !== 'undefined') module.exports.placePuddles = placePuddles;
