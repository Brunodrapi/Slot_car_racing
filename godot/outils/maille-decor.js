/* Les ordres de dessin capturés deviennent des triangles, rangés par carreaux.

     node godot/outils/maille-decor.js [circuit]

Lit /tmp/…/decor-<circuit>.json (capture-decor.js) et écrit dans godot/donnees/ :
  decor-<circuit>.bin    les carreaux : sommets (x, y en mètres, u, v, couleur), indices
  decor-<circuit>.json   l'index des carreaux
  decor-<circuit>.png    l'atlas (copié de la capture)

Chaque ordre garde la sémantique du canevas :
  - une forme pleine est d'abord « nettoyée » par Clipper selon sa règle (non nulle ou pair-impair),
    ce qui défait les recouvrements et les trous, puis découpée en triangles par earcut ;
  - un trait devient la surface qu'il couvre (ClipperOffset : jonctions rondes ou en onglet,
    bouts ronds, carrés ou nets), après découpe en tirets s'il en a ;
  - une image devient un quadrilatère texturé dans l'atlas.
Puis tout est découpé selon une grille de CARREAU mètres. Dans un carreau, les triangles restent
dans l'ordre où le jeu peint : c'est l'ordre du peintre, et le GPU le respecte à l'intérieur d'une
même maille. Deux carreaux ne se recouvrent jamais, donc leur ordre entre eux n'importe pas — et
Godot n'envoie à la carte graphique que ceux qui sont à l'écran. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const ClipperLib = require('clipper-lib'), earcut = require('earcut'), zlib = require('zlib');
const CIRCUIT = process.argv[2] || 'spa';
const TMP = process.env.DECOR_TMP || path.join(os.tmpdir(), 'grip-decor');
const OUT = path.join(__dirname, '..', 'donnees', 'circuits');
const K = 1000;          // Clipper travaille en entiers : le millimètre
const CARREAU = 64;      // mètres
const d = JSON.parse(fs.readFileSync(path.join(TMP, `decor-${CIRCUIT}.json`)));

const versClip = (pts) => { const p = []; for (let i = 0; i < pts.length; i += 2) p.push({ X: Math.round(pts[i] * K), Y: Math.round(pts[i + 1] * K) }); return p; };
const PFT = { nonzero: ClipperLib.PolyFillType.pftNonZero, evenodd: ClipperLib.PolyFillType.pftEvenOdd };

// La zone de découpe d'un ordre : sa découpe et celles de ses parents, intersectées.
const cacheClip = new Map();
function zoneClip(id) {
  if (id == null) return null;
  if (cacheClip.has(id)) return cacheClip.get(id);
  const c = d.clips[id], cl = new ClipperLib.Clipper(), out = new ClipperLib.Paths();
  cl.AddPaths(c.subs.map(versClip), ClipperLib.PolyType.ptSubject, true);
  const parent = zoneClip(c.parent);
  if (parent) { cl.AddPaths(parent, ClipperLib.PolyType.ptClip, true); cl.Execute(ClipperLib.ClipType.ctIntersection, out, PFT[c.regle], ClipperLib.PolyFillType.pftNonZero); }
  else cl.Execute(ClipperLib.ClipType.ctUnion, out, PFT[c.regle], PFT[c.regle]);
  cacheClip.set(id, out);
  return out;
}

// Une liste de contours nettoyée, découpée par la zone, rendue en Paths non chevauchants.
function nettoie(paths, regle, clip) {
  const cl = new ClipperLib.Clipper(), out = new ClipperLib.Paths();
  cl.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
  if (clip) { cl.AddPaths(clip, ClipperLib.PolyType.ptClip, true); cl.Execute(ClipperLib.ClipType.ctIntersection, out, PFT[regle], ClipperLib.PolyFillType.pftNonZero); }
  else cl.Execute(ClipperLib.ClipType.ctUnion, out, PFT[regle], PFT[regle]);
  return out;
}

// Les tirets d'une ligne brisée, comme le canevas : la phase court d'un sous-chemin au suivant.
function tirets(pts, ferme, motif, decal) {
  if (!motif.length || motif.every((v) => v === 0)) return [{ pts, ferme }];
  const m = motif.length % 2 ? motif.concat(motif) : motif, total = m.reduce((a, b) => a + b, 0);
  const P = pts.slice(); if (ferme) P.push(pts[0], pts[1]);
  const res = [];
  let phase = ((decal % total) + total) % total, k = 0;
  while (phase >= m[k]) { phase -= m[k]; k = (k + 1) % m.length; }
  let reste = m[k] - phase, trait = k % 2 === 0, cur = trait ? [P[0], P[1]] : null;
  for (let i = 2; i < P.length; i += 2) {
    let ax = P[i - 2], ay = P[i - 1];
    const bx = P[i], by = P[i + 1];
    let L = Math.hypot(bx - ax, by - ay);
    while (L >= reste) {
      const t = reste / (L || 1), x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      if (trait) { cur.push(x, y); res.push({ pts: cur, ferme: false }); cur = null; }
      else cur = [x, y];
      L -= reste; ax = x; ay = y; k = (k + 1) % m.length; reste = m[k]; trait = !trait;
      if (reste === 0 && trait) { res.push({ pts: [x, y], ferme: false }); k = (k + 1) % m.length; reste = m[k]; trait = !trait; }
    }
    reste -= L;
    if (trait) cur.push(bx, by);
  }
  if (trait && cur && cur.length >= 2) res.push({ pts: cur, ferme: false });
  return res;
}

const JOINT = { round: ClipperLib.JoinType.jtRound, miter: ClipperLib.JoinType.jtMiter, bevel: ClipperLib.JoinType.jtSquare };
const BOUT = { round: ClipperLib.EndType.etOpenRound, square: ClipperLib.EndType.etOpenSquare, butt: ClipperLib.EndType.etOpenButt };
function trait(p) {
  const co = new ClipperLib.ClipperOffset(Math.max(1, p.miter || 10), 0.01 * K);
  for (const s of p.subs) for (const t of tirets(s.pts, s.closed, p.dash || [], p.dashOff || 0)) {
    const chemin = versClip(t.pts);
    const unPoint = chemin.every((q) => q.X === chemin[0].X && q.Y === chemin[0].Y);
    if (unPoint) {
      // Un point seul : un disque si le bout est rond (les pneus sont des tirets nuls), sinon rien.
      if (p.cap === 'butt') continue;
      co.AddPath([chemin[0]], p.cap === 'round' ? ClipperLib.JoinType.jtRound : ClipperLib.JoinType.jtSquare, ClipperLib.EndType.etOpenSquare);
      continue;
    }
    co.AddPath(chemin, JOINT[p.join] ?? ClipperLib.JoinType.jtMiter, t.ferme ? ClipperLib.EndType.etClosedLine : BOUT[p.cap] ?? ClipperLib.EndType.etOpenButt);
  }
  const out = new ClipperLib.Paths();
  co.Execute(out, p.w / 2 * K);
  return out;
}

// ---------- les carreaux ----------
// Rien hors du cadre du circuit : une mer ou un fond peuvent s'étendre à des kilomètres.
const v0 = d.vis, ox = Math.floor(v0.minX / CARREAU) * CARREAU, oy = Math.floor(v0.minY / CARREAU) * CARREAU;
const nx = Math.ceil((v0.maxX - ox) / CARREAU), ny = Math.ceil((v0.maxY - oy) / CARREAU);
/* Les couches : 0 sous toutes les voitures (le sol et le décor), 1 le tablier des croisements
(par-dessus les voitures qui passent dessous), 2 par-dessus toutes (passerelles, têtes de
tunnel). Chaque couche a ses propres carreaux. */
const carreaux = new Map();
let couche = 0;
const carreau = (i, j) => {
  const k = couche + ':' + i + ',' + j;
  if (!carreaux.has(k)) carreaux.set(k, { couche, i, j, pos: [], uv: [], col: [], idx: [], n: 0 });
  return carreaux.get(k);
};
const COUCHE = (k) => (d.couches.ponts && k >= d.couches.ponts[0] && k < d.couches.ponts[1] ? 1
  : d.couches.dessus && k >= d.couches.dessus[0] && k < d.couches.dessus[1] ? 2 : 0);
const rect = (i, j) => { const x0 = (ox + i * CARREAU) * K, y0 = (oy + j * CARREAU) * K, x1 = x0 + CARREAU * K, y1 = y0 + CARREAU * K;
  return [{ X: x0, Y: y0 }, { X: x1, Y: y0 }, { X: x1, Y: y1 }, { X: x0, Y: y1 }]; };
const A = d.atlas, BLANC = [(A.blanc[0] + 0.5) / A.w, (A.blanc[1] + 0.5) / A.h];

/* Des Paths sans chevauchement → les triangles de chaque carreau touché. `uvDe(x, y)` donne la
coordonnée d'atlas d'un point (une constante pour une couleur unie). */
function pose(paths, couleur, uvDe) {
  if (!paths.length) return 0;
  // Chaque contour n'est confié qu'aux carreaux que sa boîte touche : un trait de pneus qui fait le
  // tour du circuit compte des milliers de disques, et chaque carreau n'en voit qu'une poignée.
  // Rien hors du cadre du circuit : une mer ou un fond peuvent s'étendre à des kilomètres.
  const parCarreau = new Map();
  for (const p of paths) {
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const q of p) { if (q.X < bx0) bx0 = q.X; if (q.X > bx1) bx1 = q.X; if (q.Y < by0) by0 = q.Y; if (q.Y > by1) by1 = q.Y; }
    const i0 = Math.floor((bx0 / K - ox) / CARREAU), i1 = Math.floor((bx1 / K - ox) / CARREAU);
    const j0 = Math.floor((by0 / K - oy) / CARREAU), j1 = Math.floor((by1 / K - oy) / CARREAU);
    for (let i = Math.max(i0, 0); i <= Math.min(i1, nx - 1); i++) for (let j = Math.max(j0, 0); j <= Math.min(j1, ny - 1); j++) {
      const k = i + ',' + j;
      if (!parCarreau.has(k)) parCarreau.set(k, { i, j, paths: [] });
      parCarreau.get(k).paths.push(p);
    }
  }
  let tri = 0;
  for (const { i, j, paths: sous } of parCarreau.values()) {
    const cl = new ClipperLib.Clipper(), arbre = new ClipperLib.PolyTree();
    cl.AddPaths(sous, ClipperLib.PolyType.ptSubject, true);
    cl.AddPath(rect(i, j), ClipperLib.PolyType.ptClip, true);
    cl.Execute(ClipperLib.ClipType.ctIntersection, arbre, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
    const c = carreau(i, j);
    const parcours = (noeud) => {
      for (const enfant of noeud.Childs()) {
        if (enfant.IsHole()) { parcours(enfant); continue; }
        const plat = [], trous = [];
        for (const q of enfant.Contour()) plat.push(q.X / K, q.Y / K);
        for (const h of enfant.Childs()) { trous.push(plat.length / 2); for (const q of h.Contour()) plat.push(q.X / K, q.Y / K); parcours(h); }
        const t = earcut(plat, trous.length ? trous : null);
        const base = c.n;
        for (let k = 0; k < plat.length; k += 2) {
          c.pos.push(plat[k], plat[k + 1]);
          const uv = uvDe(plat[k], plat[k + 1]); c.uv.push(uv[0], uv[1]);
          c.col.push(...couleur);
        }
        c.n += plat.length / 2;
        for (const v of t) c.idx.push(base + v);
        tri += t.length / 3;
      }
    };
    parcours(arbre);
  }
  return tri;
}

const t0 = Date.now();
let triangles = 0, sansDecoupe = 0;
const rgba = (c) => [c[0], c[1], c[2], Math.round(Math.min(1, c[3]) * 255)];
for (let k = 0; k < d.prims.length; k++) {
  const p = d.prims[k];
  couche = COUCHE(k);
  const clip = zoneClip(p.clip);
  if (p.t === 'f') {
    triangles += pose(nettoie(p.subs.map(versClip), p.regle, clip), rgba(p.c), () => BLANC);
  } else if (p.t === 's') {
    let paths = trait(p);
    if (clip) paths = nettoie(paths, 'nonzero', clip);
    triangles += pose(paths, rgba(p.c), () => BLANC);
  } else {
    // L'image : un parallélogramme. Un point (x, y) du monde s'y repère par (a, b) ∈ [0, 1]²,
    // qui donne sa place dans le rectangle source, puis dans l'atlas.
    if (p.clip != null) sansDecoupe++;
    const q = p.q, im = d.images[p.img];
    const ex = q[2] - q[0], ey = q[3] - q[1], fx = q[6] - q[0], fy = q[7] - q[1], det = ex * fy - ey * fx;
    if (Math.abs(det) < 1e-12) continue;
    const [sx, sy, sw, sh] = p.src;
    const uvDe = (x, y) => {
      const dx = x - q[0], dy = y - q[1], a = (dx * fy - dy * fx) / det, b = (ex * dy - ey * dx) / det;
      return [(im.ax + (sx + a * sw) * im.f) / A.w, (im.ay + (sy + b * sh) * im.f) / A.h];
    };
    const quad = [{ X: Math.round(q[0] * K), Y: Math.round(q[1] * K) }, { X: Math.round(q[2] * K), Y: Math.round(q[3] * K) },
      { X: Math.round(q[4] * K), Y: Math.round(q[5] * K) }, { X: Math.round(q[6] * K), Y: Math.round(q[7] * K) }];
    triangles += pose(nettoie([quad], 'nonzero', null), [255, 255, 255, Math.round(p.a * 255)], uvDe);
  }
}

// ---------- l'écriture ----------
/* Chaque tableau est écrit dans le format binaire des Variant de Godot (marshalls.cpp : le type,
le nombre d'éléments, puis les données), pour que `bytes_to_var` le rende tel quel, sans boucle en
GDScript. Le tout est compressé (deflate, comme FileAccess.COMPRESSION_DEFLATE). */
const VARIANT = { PackedInt32Array: 30, PackedVector2Array: 35, PackedColorArray: 37 };
const variant = (type, n, data) => { const h = Buffer.alloc(8); h.writeUInt32LE(VARIANT[type], 0); h.writeUInt32LE(n, 4); return Buffer.concat([h, Buffer.from(data.buffer, data.byteOffset, data.byteLength)]); };
const liste = [...carreaux.values()].filter((c) => c.idx.length).sort((a, b) => a.couche - b.couche || a.j - b.j || a.i - b.i);
const morceaux = [], index = [];
let octets = 0;
for (const c of liste) {
  const col = new Float32Array(c.n * 4);
  for (let k = 0; k < c.n * 4; k++) col[k] = c.col[k] / 255;
  const blocs = [variant('PackedVector2Array', c.n, Float32Array.from(c.pos)), variant('PackedVector2Array', c.n, Float32Array.from(c.uv)),
    variant('PackedColorArray', c.n, col), variant('PackedInt32Array', c.idx.length, Uint32Array.from(c.idx))];
  const ent = { couche: c.couche, x: ox + c.i * CARREAU, y: oy + c.j * CARREAU, sommets: c.n, triangles: c.idx.length / 3, blocs: [] };
  for (const b of blocs) { ent.blocs.push([octets, b.length]); morceaux.push(b); octets += b.length; }
  index.push(ent);
}
const brut = Buffer.concat(morceaux), zip = zlib.deflateSync(brut, { level: 9 });
fs.writeFileSync(path.join(OUT, `${CIRCUIT}-decor.bin`), zip);
fs.writeFileSync(path.join(OUT, `${CIRCUIT}-decor.json`), JSON.stringify({ circuit: d.circuit, nom: d.nom, carreau: CARREAU, taille: brut.length,
  atlas: { w: A.w, h: A.h, image: `res://donnees/circuits/${CIRCUIT}-decor.png` }, fond: d.fond, cadre: d.vis, carreaux: index }) + '\n');
fs.copyFileSync(path.join(TMP, `decor-${CIRCUIT}-atlas.png`), path.join(OUT, `${CIRCUIT}-decor.png`));
const sommets = liste.reduce((a, c) => a + c.n, 0);
console.log(`${d.nom} : ${d.prims.length} ordres → ${triangles} triangles, ${sommets} sommets, ${liste.length} carreaux de ${CARREAU} m ; ${(octets / 1e6).toFixed(1)} Mo, ${(zip.length / 1e6).toFixed(1)} Mo compressés, en ${((Date.now() - t0) / 1000).toFixed(1)} s` + (sansDecoupe ? ` ; ${sansDecoupe} images posées sans leur découpe` : ''));
