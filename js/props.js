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
    /* UN CONIFÈRE VU DU DESSUS EST UN CÔNE, et c'est l'étagement qui le dit.

    La première version était une étoile à pointes sèches, sombre, avec le tronc en pastille au
    centre : on ne voit jamais le tronc d'un sapin d'en haut, et des pointes en épine faisaient un
    bois de chardons. Un cône se lit par ses étages : une collerette large et sombre en bas, des
    collerettes de plus en plus petites et claires vers la cime, chacune un peu décalée vers la
    lumière, et la pointe en touche claire. Les bords sont festonnés — des pointes arrondies — pour
    garder le caractère d'un résineux sans tomber dans l'épine. */
    id: 'pine', wm: 6.2, weight: 3, near: 7, far: 26,
    draw(g, w, pal) { conifere(g, w, pal, [[14, 1, .8], [11, .7, .78], [8, .42, .76]], 0.2); },
  },
  {
    // Son voisin, plus élancé : plus d'étages et des festons plus fins. Deux dessins suffisent à
    // casser la répétition d'une pinède, où l'on voit des centaines de couronnes à la fois.
    id: 'pine2', alias: 'pine', wm: 5.4, weight: 3, near: 7, far: 26,
    draw(g, w, pal) { conifere(g, w, pal, [[16, 1, .82], [13, .76, .8], [10, .52, .78], [7, .3, .74]], 1.3); },
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

// Une teinte éclaircie (t > 0) ou assombrie (t < 0), pour étager une même couleur de palette.
function nuance(hex, t) {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255];
  return '#' + c.map(v => Math.round(t > 0 ? v + (255 - v) * t : v * (1 + t)))
    .map(v => v.toString(16).padStart(2, '0')).join('');
}

/* Un étage de conifère : `k` pointes d'aiguilles vues du dessus, nombreuses et peu profondes, aux
flancs à peine bombés — la silhouette d'un sapin vu d'en haut. Trop peu de pointes et trop
profondes donnaient un chardon ; des flancs trop bombés, des pétales de rose. La longueur
des branches varie un peu d'une à l'autre, pour que le contour ne soit pas un cercle parfait. */
function collerette(g, cx, cy, r, k, creux, phase, couleur) {
  const pt = (ang, rad) => [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad];
  const pas = Math.PI * 2 / k;
  g.fillStyle = couleur;
  g.beginPath();
  for (let i = 0; i < k; i++) {
    const a = phase + i * pas, rt = r * (1 + 0.07 * Math.sin(i * 2.3 + phase * 5));
    const n0 = pt(a - pas / 2, r * creux), tip = pt(a, rt), n1 = pt(a + pas / 2, r * creux);
    const c0 = pt(a - pas * 0.2, rt * (0.9 + creux * 0.06)), c1 = pt(a + pas * 0.2, rt * (0.9 + creux * 0.06));
    if (i === 0) g.moveTo(n0[0], n0[1]);
    g.quadraticCurveTo(c0[0], c0[1], tip[0], tip[1]);
    g.quadraticCurveTo(c1[0], c1[1], n1[0], n1[1]);
  }
  g.closePath(); g.fill();
}

/* Le cône vu d'en haut : trois ou quatre étages de plus en plus petits vers la cime.

Chaque étage est peint deux fois — d'abord sa face à l'ombre, puis sa face éclairée, décalée vers
la lumière (en haut à gauche, comme l'ombre portée cuite avec le décor) — si bien qu'un croissant
sombre reste en bas à droite de chaque étage. C'est ce croissant qui donne le volume : sans lui, des
disques de teintes voisines se lisent comme une cible et non comme un arbre. */
function conifere(g, w, pal, etages, phase) {
  const c = w / 2, r = w * 0.47, n = etages.length;
  const base = pal.pine[0], haut = pal.pine[1] || pal.pine[0];
  for (let i = 0; i < n; i++) {
    const t = i / n, [k, taille, creux] = etages[i], rr = r * taille;
    const dec = r * 0.05 + r * 0.1 * t, cx = c - r * 0.12 * t, cy = c - r * 0.12 * t;
    const ombre = nuance(i === 0 ? base : haut, i === 0 ? -0.32 : -0.18 + i * 0.04);
    const clair = i === 0 ? base : nuance(haut, (i - 1) * 0.16);
    collerette(g, cx, cy, rr, k, creux, phase + i * 0.7, ombre);
    collerette(g, cx - dec, cy - dec, rr * 0.9, k, creux + 0.04, phase + i * 0.7, clair);
  }
  // la pointe : une petite étoile claire, pas un point rond (qui se lit comme un œil)
  collerette(g, c - r * 0.3, c - r * 0.3, r * 0.09, 5, 0.5, phase, nuance(haut, 0.35));
}

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
      .map(k => { const wt = weights[k.alias || k.id]; return wt == null ? k
        : Object.assign({}, k, { weight: k.weight ? k.weight * wt : wt }); })
      .filter(k => k.weight > 0);
    if (!kinds.length) kinds = TOP_KINDS;
  } else {
    kinds = TOP_KINDS.filter(k => k.weight > 0);
  }
  return placeFrom(kinds, track, seedFromId('top-' + id), density == null ? 0.85 : density, 6)
    .filter(p=>!sceneryCircleNearBarrier(track,p,(kinds.find(k=>k.id===p.id)?.wm||9)*.75));
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
  pinede: [['pine', 0.9], ['pine2', 0.8], ['bush', 0.3], ['tree2', 0.25]],
  taillis: [['bush', 1.5], ['tree2', 0.6]],
};

/* La masse boisée : un sol, puis des couronnes serrées.

Le pas de semis vaut une fraction du diamètre des couronnes, pour qu'elles se RECOUVRENT. C'est la
différence entre un bois et un verger : à pas égal au diamètre on voit le sol entre les arbres et
on compte les rangées. La grille est jitterée plutôt qu'un disque de Poisson — un front de Poisson
meurt dans une bande étroite, ce qui a déjà coûté assez cher ici, tandis qu'une grille secouée ne
peut pas mourir et donne le même désordre à l'œil. */
/* CE QUI EST INTERDIT À UN ARBRE, et pourquoi il fallait une carte pour le dire.

Un arbre est posé perpendiculairement au tracé À SON ABSCISSE, au-delà de la protection qui s'y
trouve. Cela garantit qu'il ne tombe pas sur la piste à cet endroit-là, et rien de plus. Partout où
le circuit se replie — une épingle, les deux branches d'une chicane, deux lignes droites parallèles
— l'autre branche passe derrière, et le bois semé le long de la première poussait au milieu de la
seconde : des arbres en pleine piste, et dans les bacs à gravier. « Un arbre isolé en milieu de
piste ou sur un bâtiment, non. Pas d'arbre dans les graviers non plus. »

C'est le même piège que pour les barrières en croix à l'épingle et pour les hangars à cheval sur
l'autre branche. Il se règle pareil : on regarde où le point tombe RÉELLEMENT, et pas d'où l'on
est parti. Mais le faire arbre par arbre coûte cher — dix mille arbres contre trois mille cinq
cents nœuds, c'est trente-cinq millions de distances à chaque chargement de circuit.

D'où la carte. On peint une fois ce qui est interdit dans une grille de trois mètres : la piste et
tout son dégagement, protections comprises, puis l'empreinte de chaque bâtiment. Semer n'est plus
alors qu'une lecture de case. Peindre coûte cent mille marques, lire en coûte une par arbre.

La marge est la demi-couronne du plus gros arbre : ce n'est pas le tronc qu'il faut tenir hors de
la piste, c'est le feuillage. En bordure il peut déborder — c'est même ce qu'on a cherché pour
l'immersion — mais son pied reste dehors. */
const MASQUE_CASE = 3;
const MASQUE_MARGE = 4.5;

function implMasque(track) {
  const m = new Set();
  const cle = (x, y) => Math.floor(x / MASQUE_CASE) + ',' + Math.floor(y / MASQUE_CASE);
  /* LE PAS LE LONG DU TOUR SUIT L'ÉCARTEMENT, et c'est ce que la première version ignorait.

  Un pas fixe de deux mètres sur l'axe est un pas de deux mètres au bord du ruban, mais pas à
  trente mètres de là : à l'extérieur d'un virage, deux points voisins de l'axe s'écartent dans le
  rapport (R + d) / R. Au sommet d'une épingle de dix mètres de rayon, trente mètres plus loin, ce
  sont neuf mètres — trois cases de large. Le masque y était donc percé de trous réguliers, et le
  banc a trouvé trente-deux arbres plantés dans les bacs à travers ces trous, jusqu'à quatorze
  mètres à l'intérieur de la ligne de protection.

  Le pas est donc divisé par ce rapport. On échantillonne beaucoup plus serré dans les épingles,
  qui sont justement les endroits où le circuit se replie sur lui-même. */
  const maxS = track.length;
  for (const side of [1, -1]) {
    let s = 0;
    while (s < maxS) {
      const L = track.limiteProtection(s, side) + MASQUE_MARGE;
      for (let off = 0; off <= L; off += MASQUE_CASE * 0.5) {
        const p = track.pos(s, side * off);
        m.add(cle(p.x, p.y));
      }
      const grossi = 1 + L * Math.abs(track.curvAt(s));
      s += Math.max(0.3, MASQUE_CASE * 0.5 / grossi);
    }
  }
  return { m, cle, libre: (x, y) => !m.has(cle(x, y)) };
}

// L'empreinte d'un bâtiment, ajoutée au masque : un arbre ne pousse pas sur un toit.
function implMasqueBati(masque, b) {
  if (b.type === 'voiture') {
    // Un véhicule est centré sur sa position ; pas d'arbre planté sur son toit.
    const cs = Math.cos(b.a), sn = Math.sin(b.a);
    for (let u = -b.l / 2 - 1; u <= b.l / 2 + 1; u += MASQUE_CASE * 0.7)
      for (let v = -b.w / 2 - 1; v <= b.w / 2 + 1; v += MASQUE_CASE * 0.7)
        masque.m.add(masque.cle(b.x + cs * u - sn * v, b.y + sn * u + cs * v));
    return;
  }
  const cs = Math.cos(b.a), sn = Math.sin(b.a);
  const marge = 2;
  for (let u = -b.l / 2 - marge; u <= b.l / 2 + marge; u += MASQUE_CASE * 0.7) {
    for (let v = -marge; v <= b.w + marge; v += MASQUE_CASE * 0.7) {
      const dv = -b.side * v;
      masque.m.add(masque.cle(b.x + cs * u - sn * dv, b.y + sn * u + cs * dv));
    }
  }
}

function implArbres(track, z, s0, s1, rnd, out, masque) {
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
      if (!masque.libre(p.x, p.y)) continue;     // piste, dégagement, protection ou bâtiment
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
  const pavilion = track.def.architecture === 'pavillons' && z.kind === 'hangars';
  const demande = pavilion ? 13 : (z.module == null ? 34 : z.module);
  let s = s0;
  while (s < s1) {
    const module = implModule(track, s + demande / 2, demande) * (0.7 + rnd() * 0.5);
    const c = s + module / 2;
    if (c >= s1) break;
    const k = Math.abs(track.curvAt(c));
    if (k > 1 / BATI_RAYON) { s += module * 0.6; continue; }
    const base = implBase(track, c, z.side, z);
    const prof = pavilion ? 8 + rnd() * 3 : z.prof * (0.6 + rnd() * 0.4);
    const p = track.pos(c, z.side * (base + prof / 2 + rnd() * z.prof * 0.15));
    out.push({
      type: z.kind === 'stands' ? 'stands' : 'hangar',
      x: p.x, y: p.y, a: track.headingAt(c),
      l: module, w: prof, side: z.side,
      portes: Math.max(2, Math.round(module / 9)), teinte: rnd(),
      architecture: z.kind === 'stands' ? 'graphique' : track.def.architecture,
      height: track.def.architecture === 'immeubles' && z.kind !== 'stands' ? 22 + rnd() * 26 : pavilion ? 4 + rnd() * 2 : 6,
    });
    s += module + 5 + rnd() * 8;
  }
}

/* LES VÉHICULES DU DÉCOR, vus du dessus.

Chaque gabarit se lit d'abord à sa silhouette, ensuite à ses vitres : une citadine courte et
ronde, un break dont la lunette arrière touche le pare-chocs, un pick-up et sa benne sombre, un
utilitaire ou un camping-car dont la cabine est plus étroite que la caisse, un semi-remorque en
deux pièces. Le trait est celui de la planche de référence : aplat franc, contour épais et sombre,
vitres presque noires. Les dimensions sont en mètres, l'avant vers +x.

Les teintes suivent la vraie répartition d'un parking : beaucoup de blanc, de gris et de noir, et
la couleur franche d'un modèle de temps en temps — la planche ne montre qu'une teinte par modèle,
un parking entier dans ces couleurs serait une boîte de bonbons. */
const VEH_TRAIT = '#22262b', VEH_VITRE = '#283038', VEH_NEUTRES = ['#f2f2ef', '#d7d9dc', '#9a9ea5', '#5f636b', '#2d3035'];
const VEHICULES = {
  citadine:     { l: 3.7,  w: 1.72, r: .5,  vitres: [[.08, .42], [-.66, -.44]], teintes: ['#e2322f', '#2f8fe6', ...VEH_NEUTRES] },
  compacte:     { l: 4.25, w: 1.8,  r: .45, vitres: [[.1, .42], [-.68, -.48]], teintes: ['#2f8fe6', '#1d3557', ...VEH_NEUTRES] },
  berline:      { l: 4.8,  w: 1.85, r: .45, vitres: [[.04, .34], [-.56, -.36]], teintes: ['#7d1e22', '#1d3557', ...VEH_NEUTRES] },
  break:        { l: 4.8,  w: 1.85, r: .4,  vitres: [[.06, .36], [-.88, -.68]], teintes: ['#5a9b48', '#2d4a3a', ...VEH_NEUTRES] },
  suv:          { l: 4.65, w: 1.95, r: .32, vitres: [[.1, .4], [-.86, -.64]], teintes: ['#dcc49a', '#3f5f7a', ...VEH_NEUTRES] },
  taxi:         { l: 4.7,  w: 1.8,  r: .45, vitres: [[.06, .36], [-.64, -.44]], teintes: ['#f7cf26'], enseigne: true },
  fourgonnette: { l: 4.5,  w: 1.85, r: .4,  vitres: [[.3, .6]], teintes: ['#f2f2ef', '#f2f2ef', '#d7d9dc', '#2f8fe6'] },
  pickup:       { l: 5.3,  w: 1.95, r: .35, vitres: [[.24, .5]], benne: [-.92, -.1], teintes: ['#f07d22', '#c8302c', '#f2f2ef', '#2d3035'] },
  minibus:      { l: 5.4,  w: 2.0,  r: .38, baies: [[.6, .84], [-.86, -.62]], teintes: ['#2f8fe6', '#f2f2ef', '#9a9ea5'] },
  utilitaire:   { l: 6.0,  w: 2.1,  r: .14, cabine: .5, vitres: [[.64, .88]], teintes: ['#f2f2ef', '#f2f2ef', '#d7d9dc'] },
  campingcar:   { l: 6.9,  w: 2.3,  r: .26, cabine: .62, vitres: [[.72, .92]], lanterneaux: [-.42, .1], teintes: ['#f4f4f1', '#ece4d4'] },
  bus:          { l: 12.0, w: 2.55, r: .38, baies: [[.82, .95], [-.95, -.86]], teintes: ['#e53530', '#2f8fe6', '#f2f2ef'] },
  semi:         { l: 16.5, w: 2.55, r: .14, tracteur: .7, vitres: [[.8, .95]], teintes: ['#2f8fe6', '#e53530', '#f2f2ef', '#2d3035'], remorques: ['#cfd2d5', '#f2f2ef'] },
  moto:         { l: 2.1,  w: .85,  moto: true, teintes: ['#e53530', '#2d3035', '#2f8fe6'] },
};
const VEH_PPM = 20;               // pixels par mètre des vignettes

// Une vitre : un bandeau bombé vers l'avant, plus large du côté du capot.
function vehVitre(g, x0, x1, w0, w1, bombe) {
  g.beginPath();
  g.moveTo(x0, -w0 / 2);
  g.quadraticCurveTo(x0 - bombe, 0, x0, w0 / 2);
  g.lineTo(x1, w1 / 2);
  g.quadraticCurveTo(x1 + bombe, 0, x1, -w1 / 2);
  g.closePath();
  g.fillStyle = VEH_VITRE; g.fill();
}

function vehCaisse(g, x0, x1, w, r, teinte) {
  round(g, x0, -w / 2, x1 - x0, w, Math.min(r, w / 2));
  g.fillStyle = teinte; g.fill();
  g.lineWidth = .13; g.strokeStyle = VEH_TRAIT; g.stroke();
}

function vehDessin(g, v, teinte, remorque) {
  const L = v.l, W = v.w, X = (f) => f * L / 2;
  g.lineJoin = 'round';
  if (v.moto) {
    g.lineCap = 'round'; g.strokeStyle = VEH_TRAIT;
    g.lineWidth = .2; g.beginPath(); g.moveTo(X(-.98), 0); g.lineTo(X(-.66), 0); g.moveTo(X(.7), 0); g.lineTo(X(.98), 0); g.stroke();
    vehCaisse(g, X(-.72), X(.74), .42, .21, teinte);
    round(g, X(-.56), -.15, X(.04) - X(-.56), .3, .14); g.fillStyle = VEH_TRAIT; g.fill();
    g.lineWidth = .08; g.beginPath(); g.moveTo(X(.5), -W / 2); g.lineTo(X(.5), W / 2); g.stroke();
    return;
  }
  if (v.tracteur != null) {                               // semi-remorque : tracteur et remorque
    vehCaisse(g, X(-1), X(v.tracteur - .04), W, v.r, remorque);
    vehCaisse(g, X(v.tracteur), X(1), W * .96, .3, teinte);
  } else if (v.cabine != null) {                          // cabine plus étroite que la caisse
    vehCaisse(g, X(v.cabine - .06), X(1), W * .86, .32, teinte);
    vehCaisse(g, X(-1), X(v.cabine + .02), W, v.r, teinte);
  } else vehCaisse(g, X(-1), X(1), W, v.r, teinte);
  for (const [a, b] of v.vitres || []) {
    const avant = a > 0, w0 = W * (avant ? .72 : .66), w1 = W * (avant ? .84 : .74);
    vehVitre(g, X(a), X(b), w0, w1, avant ? .14 : -.08);
  }
  for (const [a, b] of v.baies || []) {                   // baies carrées : minibus, bus
    round(g, X(a), -W * .38, X(b) - X(a), W * .76, .14); g.fillStyle = VEH_VITRE; g.fill();
  }
  if (v.benne) {
    round(g, X(v.benne[0]), -W * .4, X(v.benne[1]) - X(v.benne[0]), W * .8, .1); g.fillStyle = VEH_VITRE; g.fill();
  }
  if (v.lanterneaux) {                                    // lanterneaux de toit du camping-car
    for (const f of v.lanterneaux) {
      round(g, X(f) - .35, -.42, .7, .84, .1); g.fillStyle = '#e3e5e6'; g.fill();
      g.lineWidth = .06; g.strokeStyle = '#9a9ea5'; g.stroke();
    }
  }
  if (v.enseigne) {
    round(g, X(-.16), -.32, .42, .64, .08); g.fillStyle = '#fff6c9'; g.fill();
    g.lineWidth = .05; g.strokeStyle = VEH_TRAIT; g.stroke();
  }
}

/* Une vignette par gabarit et par teinte, cuite une fois, ombre comprise, comme le reste du décor.
Le parking en compte des centaines : un drawImage tourné par véhicule, rien de plus. */
function buildVehicleArt() {
  const art = {};
  for (const [id, v] of Object.entries(VEHICULES)) {
    const remorques = v.remorques || [null];
    v.teintes.forEach((teinte, ti) => remorques.forEach((rem, ri) => {
      const pad = .45, c = document.createElement('canvas');
      c.width = Math.ceil((v.l + pad * 2) * VEH_PPM); c.height = Math.ceil((v.w + pad * 2) * VEH_PPM);
      const g = c.getContext('2d');
      const sil = document.createElement('canvas'); sil.width = c.width; sil.height = c.height;
      const sg = sil.getContext('2d');
      sg.scale(VEH_PPM, VEH_PPM); sg.translate(pad + v.l / 2, pad + v.w / 2); vehDessin(sg, v, teinte, rem);
      sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-in';
      sg.fillStyle = 'rgba(30,26,20,0.24)'; sg.fillRect(0, 0, c.width, c.height);
      g.drawImage(sil, .18 * VEH_PPM, .26 * VEH_PPM);
      g.scale(VEH_PPM, VEH_PPM); g.translate(pad + v.l / 2, pad + v.w / 2); vehDessin(g, v, teinte, rem);
      art[id + ':' + ti + ':' + ri] = { canvas: c, l: v.l + pad * 2, w: v.w + pad * 2 };
    }));
  }
  return art;
}

// Un véhicule tiré dans une liste pondérée [[gabarit, poids], ...], avec sa teinte.
function vehTire(rnd, liste) {
  let total = 0; for (const [, p] of liste) total += p;
  let t = rnd() * total, id = liste[0][0];
  for (const [k, p] of liste) { if ((t -= p) < 0) { id = k; break; } }
  const v = VEHICULES[id];
  return { kind: id, l: v.l, w: v.w, col: Math.floor(rnd() * v.teintes.length),
    rem: v.remorques ? Math.floor(rnd() * v.remorques.length) : 0 };
}

const PARK_PLACES = [['citadine', 16], ['compacte', 20], ['berline', 15], ['break', 11], ['suv', 15],
  ['fourgonnette', 5], ['taxi', 1], ['moto', 3]];
const PARK_LONGS = [['campingcar', 4], ['utilitaire', 3], ['minibus', 3], ['pickup', 3], ['bus', 2], ['semi', 1]];
const CAMPING = [['campingcar', 15], ['fourgonnette', 3], ['utilitaire', 2]];

/* Un parking : un vrai parc de stationnement, pas des voitures posées dans l'herbe.

Vu d'en haut, ce qui fait reconnaître un parking, ce sont ses lignes : un enrobé net bordé d'une
bordure claire, des allées, et les places peintes en blanc, qu'elles soient occupées ou non. Le
parc est donc construit dans un repère fixe — le cap de la piste au milieu de la zone, pour que
les rangées restent parallèles entre elles même le long d'un virage — et découpé en bandes : une
allée, deux rangées dos à dos, une allée, et ainsi de suite. Les colonnes de places qui
déborderaient sur la piste ou ses protections sont retirées, enrobé compris.

Chaque voiture regarde son allée et les deux voitures dos à dos alignent leurs pare-chocs arrière.
Une moto prend une place à deux ou trois. Ce qui ne tient pas dans une place — camping-cars,
utilitaires, minibus, pick-up, cars et semi-remorques — se gare en long sur la dernière rangée des
parcs de deux bandes ou plus. Un panneau P bleu signale l'entrée, côté piste. */
const PARK_ALLEE = 5, PARK_RANGEE = 4.6, PARK_PLACE = 2.6, PARK_LONG = 3.4;
function implParking(track, z, s0, s1, rnd, out, lots) {
  const mid = (s0 + s1) / 2;
  const a = track.headingAt(mid);
  const o = track.pos(mid, z.side * (implBase(track, mid, z.side, z) + z.prof / 2));
  const ux = Math.cos(a), uy = Math.sin(a);           // le long de la piste
  const vx = -Math.sin(a) * z.side, vy = Math.cos(a) * z.side;   // vers l'extérieur
  const W = (u, v) => ({ x: o.x + ux * u + vx * v, y: o.y + uy * u + vy * v });
  const loin = (u, v, marge) => {
    // Trop près du ruban, où qu'il passe : on ne gare pas là, on n'y coule pas d'enrobé.
    const p = W(u, v), pr = implProjette(track, p.x, p.y);
    return Math.abs(pr.lat) >= track.limiteProtection(pr.s, pr.lat >= 0 ? 1 : -1) + marge;
  };
  const demiL = (s1 - s0) / 2, v0 = -z.prof / 2, pas = PARK_ALLEE + 2 * PARK_RANGEE;
  const n = Math.max(1, Math.floor((z.prof - PARK_ALLEE) / pas));
  const enLong = n >= 2;          // deux bandes ou plus : la dernière accueille les grands gabarits
  // Les bandes du parc, de la piste vers l'extérieur : [début, fin, nature].
  const bandes = [];
  for (let k = 0; k < n; k++) {
    const a0 = v0 + k * pas;
    bandes.push([a0, a0 + PARK_ALLEE, 'allee']);
    if (enLong && k === n - 1) { bandes.push([a0 + PARK_ALLEE, a0 + PARK_ALLEE + PARK_LONG, 'long']); break; }
    bandes.push([a0 + PARK_ALLEE, a0 + PARK_ALLEE + PARK_RANGEE, 'r1'], [a0 + PARK_ALLEE + PARK_RANGEE, a0 + pas, 'r2']);
    if (k === n - 1) bandes.push([a0 + pas, a0 + pas + PARK_ALLEE, 'allee']);
  }
  // Une colonne de places tous les 2,6 m ; une case n'existe que loin de toute piste.
  const ncol = Math.max(1, Math.floor(2 * demiL / PARK_PLACE)), u0 = -ncol * PARK_PLACE / 2;
  const cases = bandes.map(([b0, b1]) => Array.from({ length: ncol }, (_, i) =>
    loin(u0 + (i + .5) * PARK_PLACE, (b0 + b1) / 2, 3)));
  const lot = { o, ux, uy, vx, vy, side: z.side, runs: [], lignes: [], panneau: null };
  // L'enrobé : par colonne, les suites de cases retenues.
  for (let i = 0; i < ncol; i++) {
    let debut = null;
    for (let j = 0; j <= bandes.length; j++) {
      const ok = j < bandes.length && cases[j][i];
      if (ok && debut == null) debut = bandes[j][0];
      if (!ok && debut != null) { lot.runs.push([u0 + i * PARK_PLACE, debut, PARK_PLACE, bandes[j - 1][1] - debut]); debut = null; }
    }
  }
  if (!lot.runs.length) return;
  // Les lignes peintes : séparations de places, ligne médiane des rangées dos à dos, bord du couloir long.
  bandes.forEach(([b0, b1, nature], j) => {
    for (let i = 0; i < ncol; i++) {
      if (!cases[j][i]) continue;
      const g = u0 + i * PARK_PLACE, d = u0 + (i + 1) * PARK_PLACE;
      if (nature === 'r1') {
        lot.lignes.push([g, b0 + .3, g, b1], [g, b1, d, b1]);
        if (i === ncol - 1 || !cases[j][i + 1]) lot.lignes.push([d, b0 + .3, d, b1]);
      } else if (nature === 'r2') {
        lot.lignes.push([g, b0, g, b1 - .3]);
        if (i === ncol - 1 || !cases[j][i + 1]) lot.lignes.push([d, b0, d, b1 - .3]);
      } else if (nature === 'long') lot.lignes.push([g, b1 - .25, d, b1 - .25]);
    }
  });
  // Le panneau P, dans l'allée côté piste, à l'un des bouts du parc.
  for (const i of [1, ncol - 2, Math.floor(ncol / 2)]) {
    if (i >= 0 && i < ncol && cases[0][i]) { lot.panneau = { u: u0 + (i + .5) * PARK_PLACE, v: (bandes[0][0] + bandes[0][1]) / 2 }; break; }
  }
  const coins = lot.runs.flatMap(([u, v, w, h]) => [W(u, v), W(u + w, v + h)]);
  lot.bbox = { minX: Math.min(...coins.map(p => p.x)) - 3, maxX: Math.max(...coins.map(p => p.x)) + 3,
    minY: Math.min(...coins.map(p => p.y)) - 3, maxY: Math.max(...coins.map(p => p.y)) + 3 };
  lots.push(lot);

  // Les véhicules.
  const pose = (v, u, vv, cap) => { const p = W(u, vv); out.push({ type: 'voiture', ...v, x: p.x, y: p.y, a: cap, teinte: rnd() }); };
  bandes.forEach(([b0, b1, nature], j) => {
    if (nature === 'r1' || nature === 'r2') {
      const sens = nature === 'r1' ? -1 : 1, dos = nature === 'r1' ? b1 : b0;   // l'allée, et la ligne médiane
      for (let i = 0; i < ncol; i++) {
        if (!cases[j][i] || rnd() < 0.14) continue;      // une place vide de temps en temps
        const u = u0 + (i + .5) * PARK_PLACE;
        const v = vehTire(rnd, PARK_PLACES);
        const cap = a + Math.PI / 2 + (sens === z.side ? 0 : Math.PI) + (rnd() - .5) * .05;
        if (v.kind === 'moto') {
          const k = 2 + (rnd() < .5 ? 1 : 0);
          for (let m = 0; m < k; m++) pose(vehTire(rnd, [['moto', 1]]), u + (m - (k - 1) / 2) * .8,
            dos + sens * (1.3 + rnd() * .3), cap + (rnd() - .5) * .2);
          continue;
        }
        pose(v, u + (rnd() - .5) * .2, dos + sens * (.15 + v.l / 2), cap);
      }
    } else if (nature === 'long') {
      let u = u0 + 1;
      while (u < -u0) {
        const v = vehTire(rnd, PARK_LONGS);
        if (u + v.l > -u0) break;
        const c = u + v.l / 2, i0 = Math.floor((u - u0) / PARK_PLACE), i1 = Math.floor((u + v.l - u0) / PARK_PLACE);
        let ok = true;
        for (let i = Math.max(0, i0); i <= Math.min(ncol - 1, i1); i++) ok = ok && cases[j][i];
        if (ok && rnd() > .15) pose(v, c, (b0 + b1) / 2 - .15, a + (rnd() < .5 ? 0 : Math.PI));
        u += v.l + 1.4 + rnd() * 2;
      }
    }
  });
}

/* Quelques camping-cars au bord du circuit, derrière la barrière.

Pas une file : deux ou trois véhicules garés ensemble ici ou là, et c'est tout — une poignée sur
tout le tour, juste de quoi dire qu'on campe autour du circuit. Chaque circuit a un budget (`max`
de la zone, et `CAMPING_MAX` pour l'ensemble), les groupes sont espacés de plus de cent mètres. On
ne s'installe ni dans un virage serré ni trop près d'une autre portion de piste. */
const CAMPING_MAX = 5;
function implCamping(track, z, s0, s1, rnd, out, budget) {
  let s = s0 + rnd() * Math.min(60, (s1 - s0) / 3), pose = 0;
  const max = z.max == null ? 2 : z.max;
  while (s < s1 && pose < max && budget.reste > 0) {
    const nb = rnd() < .4 ? 1 : rnd() < .75 ? 2 : 3;
    let t = s, groupe = 0;
    for (let k = 0; k < nb && pose < max && budget.reste > 0; k++) {
      const v = vehTire(rnd, CAMPING), c = t + v.l / 2;
      if (c + v.l / 2 > s1) break;
      if (Math.abs(track.curvAt(c)) > 1 / 45) break;
      const lat = track.limiteProtection(c, z.side) + (z.recul == null ? 3 : z.recul) + v.w / 2 + rnd() * 1.5;
      const p = track.pos(c, z.side * lat), cap = track.headingAt(c) + (rnd() < .5 ? 0 : Math.PI) + (rnd() - .5) * .14;
      const cs = Math.cos(cap), sn = Math.sin(cap);
      const libre = [[-1, -1], [1, -1], [1, 1], [-1, 1]].every(([i, j]) => {
        const x = p.x + cs * i * v.l / 2 - sn * j * v.w / 2, y = p.y + sn * i * v.l / 2 + cs * j * v.w / 2;
        const pr = implProjette(track, x, y);
        return Math.abs(pr.lat) >= track.limiteProtection(pr.s, pr.lat >= 0 ? 1 : -1) + 1.5;
      });
      if (libre) { out.push({ type: 'voiture', ...v, x: p.x, y: p.y, a: cap, teinte: rnd(), camping: true }); pose++; budget.reste--; groupe++; }
      t += v.l + 2 + rnd() * 2.5;
    }
    s = t + 110 + rnd() * 150;
  }
}

/* Le relevé d'un circuit, zone par zone.

Rendu : les sols d'abord, sous la route, puis les couronnes et les bâtiments par-dessus tout le
reste. Les couronnes sont rangées en cases de quarante-huit mètres : la caméra en montre une
trentaine de mètres de côté, et parcourir les dix mille arbres d'un bois à chaque image pour en
dessiner quinze serait tout le budget de la frame. */
function placeImplantation(track, id, zones, water = placeWater(track, track.def.water)) {
  if (!zones || !zones.length) return null;
  const rnd = propRng(seedFromId('impl-' + id));
  const sols = [], arbres = [], batis = [], nus = [], lots = [], budget = { reste: CAMPING_MAX };
  /* ON BÂTIT D'ABORD, ON PLANTE ENSUITE, et l'ordre compte : le masque qui interdit un emplacement
  à un arbre doit déjà connaître les bâtiments, sinon un bois semé avant eux pousse sur leurs toits.
  Les sols se posent dans la même passe que les bâtiments, ils ne gênent personne. */
  const bois = [];
  for (const z of zones) {
    const [s0, s1] = implSpan(track, z);
    if (z.kind === 'nu') { nus.push({ s0, s1, side: z.side, prof: z.prof }); continue; }
    if (z.sol !== false && z.kind !== 'camping' && z.kind !== 'parking' && !(track.def.architecture === 'pavillons' && z.kind === 'hangars'))
      for (const pts of implContour(track, z, s0, s1, 4))
        sols.push({ pts, bbox: implBbox(pts), kind: z.kind, sol: z.sol });
    if (z.kind === 'bois') bois.push([z, s0, s1]);
    else if (z.kind === 'tribune') implTribunes(track, z, s0, s1, rnd, batis);
    else if (z.kind === 'stands' || z.kind === 'hangars') implBatiments(track, z, s0, s1, rnd, batis);
    else if (z.kind === 'parking') implParking(track, z, s0, s1, rnd, batis, lots);
    else if (z.kind === 'camping') implCamping(track, z, s0, s1, rnd, batis, budget);
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
    if (b.type === 'voiture') {
      if(waterOverlaps(water,sceneryFootprint(b))||sceneryBarrierOverlap(track,sceneryFootprint(b)))batis.splice(i,1);
      continue;
    }
    const cs = Math.cos(b.a), sn = Math.sin(b.a);
    let dedans = false;
    for (const du of [-b.l / 2, b.l / 2]) for (const dv of [0, -b.side * b.w]) {
      const x = b.x + cs * du - sn * dv, y = b.y + sn * du + cs * dv;
      const pr = implProjette(track, x, y);
      if (Math.abs(pr.lat) < track.limiteProtection(pr.s, pr.lat >= 0 ? 1 : -1)) dedans = true;
    }
    if (dedans || waterOverlaps(water, sceneryFootprint(b)) || sceneryBarrierOverlap(track,sceneryFootprint(b))) batis.splice(i, 1);
  }
  // Les modules voisins peuvent se rapprocher dans une courbe : contrôler
  // leur empreinte réelle avant de planter les arbres autour des constructions.
  const occupied=[];
  for(let i=0;i<batis.length;i++){
    const b=batis[i];if(b.type==='voiture')continue;
    const footprint=sceneryFootprint(b);
    if(occupied.some(p=>sceneryRectsOverlap(p,footprint))){batis.splice(i--,1);continue;}
    occupied.push(footprint);
  }
  // Un camping-car ne se gare ni sur un bâtiment ni sur un autre.
  for(let i=0;i<batis.length;i++){
    const b=batis[i];if(!b.camping)continue;
    const footprint=sceneryFootprint(b);
    if(occupied.some(p=>sceneryRectsOverlap(p,footprint))){batis.splice(i--,1);continue;}
    occupied.push(footprint);
  }
  const masque = implMasque(track);
  for (const b of batis) implMasqueBati(masque, b);
  // L'enrobé des parkings, allées comprises : pas d'arbre au milieu d'un parc de stationnement.
  for (const l of lots) for (const [u, v, w, h] of l.runs)
    for (let du = 0; du <= w; du += MASQUE_CASE * .5) for (let dv = 0; dv <= h; dv += MASQUE_CASE * .5)
      masque.m.add(masque.cle(l.o.x + l.ux * (u + du) + l.vx * (v + dv), l.o.y + l.uy * (u + du) + l.vy * (v + dv)));
  for (const [z, s0, s1] of bois) implArbres(track, z, s0, s1, rnd, arbres, masque);
  if(water)for(let i=arbres.length-1;i>=0;i--){
    const a=arbres[i];if(waterContains(water,a.x,a.y,5))arbres.splice(i,1);
  }
  for(let i=arbres.length-1;i>=0;i--){
    const a=arbres[i],kind=TOP_KINDS.find(k=>k.id===a.id);
    if(sceneryCircleNearBarrier(track,a,(kind?.wm||9)*(a.e||1)*.55))arbres.splice(i,1);
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
  return { sols, arbres, batis, nus, cases, cell: IMPL_CELL, marge, masque, lots };
}

/* LE SEMIS ORDINAIRE PASSE PAR LE MÊME MASQUE, et c'est ce qui manquait.

Deux jeux d'arbres cohabitent : les masses de l'implantation, et le semis qui saupoudre le reste du
tour. Chacun avait sa façon de répondre à la même question — où a-t-on le droit de planter ? Le
semis a la sienne depuis toujours, qui ne regarde qu'un nœud sur quatre et ignore complètement les
bâtiments, puisqu'il n'y en avait pas quand elle a été écrite. Résultat mesuré par le banc : dix à
vingt-huit arbres poussaient sur un toit, sur CHACUN des treize circuits, et trois dans le
dégagement de Monaco.

Deux réponses à une même question finissent toujours par se contredire. Il n'y en a plus qu'une :
la carte de ce qui est interdit, qui connaît la piste, les dégagements, les protections et les
bâtiments.

Les zones `nu` restent traitées ici aussi — Silverstone est un aérodrome, et entre Hangar Straight
et Stowe il n'y a rien à voir qu'un bosquet semé par défaut trahirait. */
function implEfface(track, impl, props) {
  if (!impl) return props;
  if (impl.masque) props = props.filter(p => impl.masque.libre(p.x, p.y));
  if (!impl.nus.length) return props;
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
    const a = spec.seaEdge ? Math.max(hw + spec.gap, track.limiteProtection(s, side) + 6)
      : hw + spec.gap + 4 * Math.sin(s * 0.021) + 2 * Math.sin(s * 0.061);
    const b = a + spec.out * taper;
    const px = track.xs[i], py = track.ys[i], nx = track.nx[i] * side, ny = track.ny[i] * side;
    inner.push([px + nx * a, py + ny * a]);
    outer.push([px + nx * b, py + ny * b]);
    for (const [x, y] of [inner[inner.length - 1], outer[outer.length - 1]]) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  if(spec.seaEdge){
    const b=track.bounds;
    const anchors=[inner[0],...spec.seaEdge.map(([x,y])=>[b.minX+x*(b.maxX-b.minX),b.minY+y*(b.maxY-b.minY)]),inner.at(-1)];
    for(let i=0;i<inner.length;i++){
      const t=i/(inner.length-1)*(anchors.length-1),j=Math.min(anchors.length-2,Math.floor(t)),u=t-j;
      outer[i]=[anchors[j][0]*(1-u)+anchors[j+1][0]*u,anchors[j][1]*(1-u)+anchors[j+1][1]*u];
    }
    minX=minY=Infinity;maxX=maxY=-Infinity;
    for(const [x,y] of inner.concat(outer)){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  }
  const polygon=inner.concat([...outer].reverse());
  return { inner, outer, polygon, spec, bbox: { minX, minY, maxX, maxY } };
}

// Rectangle complet contre le volume des protections, pas uniquement ses quatre coins.
function sceneryBarrierOverlap(track,points,pad=.8){
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const candidates=track.barrierCandidates(minX,minY,maxX,maxY,pad+2);
  for(const b of candidates){
    const width=b.half+pad+1.1,px=-b.ty*width,py=b.tx*width;
    const rect=[[b.ax+px,b.ay+py],[b.bx+px,b.by+py],[b.bx-px,b.by-py],[b.ax-px,b.ay-py]];
    if(sceneryRectsOverlap(points,rect))return true;
  }return false;
}
function sceneryCircleNearBarrier(track,p,r){
  return track.barrierCandidates(p.x,p.y,p.x,p.y,r+3).some(b=>track.barrierDistance(p.x,p.y,b)<r+1.5);
}

function sceneryFootprint(b) {
  const cs=Math.cos(b.a),sn=Math.sin(b.a),y0=b.type==='voiture'?-b.w/2:Math.min(0,-b.side*b.w);
  return [[-b.l/2,y0],[b.l/2,y0],[b.l/2,y0+b.w],[-b.l/2,y0+b.w]]
    .map(([x,y])=>[b.x+cs*x-sn*y,b.y+sn*x+cs*y]);
}

function sceneryRectsOverlap(a,b) {
  // Axes séparateurs des deux rectangles orientés, avec une petite allée.
  for(const poly of [a,b])for(let i=0;i<2;i++){
    const dx=poly[i+1][0]-poly[i][0],dy=poly[i+1][1]-poly[i][1],n=Math.hypot(dx,dy)||1;
    const project=p=>(-dy*p[0]+dx*p[1])/n,A=a.map(project),B=b.map(project);
    if(Math.max(...A)+.4<=Math.min(...B)||Math.max(...B)+.4<=Math.min(...A))return false;
  }
  return true;
}

function sceneryPointInPolygon(points,x,y) {
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const [ax,ay]=points[i],[bx,by]=points[j];
    if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  }
  return inside;
}

function waterContains(w,x,y,pad=0) {
  if(!w)return false;
  const b=w.bbox;if(x<b.minX-pad||x>b.maxX+pad||y<b.minY-pad||y>b.maxY+pad)return false;
  if(sceneryPointInPolygon(w.polygon,x,y))return true;
  if(!pad)return false;
  for(let i=0;i<w.polygon.length;i++){
    const a=w.polygon[i],b=w.polygon[(i+1)%w.polygon.length],dx=b[0]-a[0],dy=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));
    if(Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)<pad)return true;
  }
  return false;
}

function waterOverlaps(w,points) {
  if(!w)return false;
  if(points.some(([x,y])=>waterContains(w,x,y)))return true;
  if(w.polygon.some(([x,y])=>sceneryPointInPolygon(points,x,y)))return true;
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  for(let i=0;i<points.length;i++)for(let j=0;j<w.polygon.length;j++){
    const a=points[i],b=points[(i+1)%points.length],c=w.polygon[j],d=w.polygon[(j+1)%w.polygon.length];
    if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return true;
  }
  return false;
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
    if(spec.seaEdge){
      // Concentrer les mouillages dans le bassin visible, pas au large.
      const t=track.bounds,b={minX:water.bbox.minX,minY:water.bbox.minY,
        maxX:Math.min(water.bbox.maxX,t.maxX+50),maxY:Math.min(water.bbox.maxY,t.maxY+40)};
      const x=b.minX+rnd()*(b.maxX-b.minX),y=b.minY+rnd()*(b.maxY-b.minY);
      if(!waterContains(water,x,y)||[[-8,0],[8,0],[0,-8],[0,8]].some(([dx,dy])=>!waterContains(water,x+dx,y+dy)))continue;
      if(out.some(o=>(o.x-x)**2+(o.y-y)**2<15*15))continue;
      const pr=implProjette(track,x,y),hw=pr.lat>0?track.hwLeftAt(pr.s):track.hwRightAt(pr.s);
      if(Math.abs(pr.lat)<hw+8)continue;
      let draw=rnd()*total,kind=BOAT_KINDS[0];for(const k of BOAT_KINDS){draw-=k.weight;if(draw<=0){kind=k;break;}}
      out.push({x,y,th:track.headingAt(pr.s)+(rnd()-.5)*.6,id:kind.id});continue;
    }
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
if (typeof module !== 'undefined') module.exports.VEHICULES = VEHICULES;
if (typeof module !== 'undefined') module.exports.placeTopProps = placeTopProps;
if (typeof module !== 'undefined') module.exports.placePatches = placePatches;
if (typeof module !== 'undefined') module.exports.placeWater = placeWater;
if (typeof module !== 'undefined') module.exports.placePuddles = placePuddles;
