// Les vues de dessus des voitures ajoutées avec les trois catégories, dessinées en SVG.
//
//   node tools/dessins-voitures.js                 toutes, dans sprites/top/ et art-src/voitures/
//   node tools/dessins-voitures.js 962 xjr9        seulement celles-ci
//   node tools/dessins-voitures.js --planche=x.png une planche de contrôle en plus
//
// POURQUOI DU SVG. Les autres voitures du jeu sont des illustrations peintes, générées hors du
// dépôt. Celles-ci n'en ont pas encore : plutôt qu'une silhouette vectorielle de repli, chacune a un
// vrai dessin, dans les mêmes conventions — nez à droite, 420 px de long, fond transparent, contour
// sombre et volumes en dégradé — avec sa livrée d'époque. Le SVG source est gardé dans
// `art-src/voitures/`, pour qu'on puisse le retoucher, et une illustration peinte pourra remplacer le
// PNG un jour sans que rien d'autre ne change : le jeu ne lit que le fichier.
//
// LE GABARIT. Une monoplace fait 420 × 205 comme les quatre F1 déjà là ; une voiture fermée
// 420 × 200 environ. Le jeu met le dessin à l'échelle sur la LONGUEUR de la voiture, donc ce qui
// compte est que le nez et la queue touchent les bords gauche et droit.
'use strict';
const fs = require('node:fs'), path = require('node:path');

const RACINE = path.resolve(__dirname, '..');
const CONTOUR = '#15161a';

// ---------------------------------------------------------------------------------------------
// Outils de dessin.

/* Une forme symétrique par rapport à l'axe de la voiture, lissée.

`demi` donne la demi-largeur à chaque abscisse, du nez vers la queue. La courbe passe par chaque
point (Catmull-Rom converti en Bézier), puis repart dans l'autre sens de l'autre côté de l'axe :
une seule liste de points pour une carrosserie entière, et une symétrie exacte gratuite. */
function symetrique(demi, cy, tension = 0.5) {
  const haut = demi.map(([x, h]) => [x, cy - h]);
  const bas = demi.slice().reverse().map(([x, h]) => [x, cy + h]);
  return lisse(haut.concat(bas), true, tension);
}
function lisse(pts, ferme, tension = 0.5) {
  const n = pts.length, p = (i) => pts[ferme ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  const fin = ferme ? n : n - 1;
  for (let i = 0; i < fin; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) * tension / 3, p1[1] + (p2[1] - p0[1]) * tension / 3];
    const c2 = [p2[0] - (p3[0] - p1[0]) * tension / 3, p2[1] - (p3[1] - p1[1]) * tension / 3];
    d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + (ferme ? 'Z' : '');
}
function poly(pts) { return 'M' + pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' L') + 'Z'; }
function f(v) { return Math.round(v * 10) / 10; }
// Un même polygone des deux côtés de l'axe.
function miroir(pts, cy) { return [pts, pts.map(([x, y]) => [x, 2 * cy - y])]; }
function rr(x, y, w, h, r, attrs) { return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${r}" ${attrs || ''}/>`; }

let uid = 0;
/* Le volume d'une carrosserie : un dégradé à travers la largeur, sombre aux flancs et clair sur
l'arête centrale, posé sur la couleur de la livrée. C'est ce qui fait passer une forme plate pour
une coque bombée, et c'est le même pour toutes les voitures, ce qui les fait tenir ensemble. */
function volume(d, cy, demiMax) {
  const id = 'v' + (uid++);
  return {
    defs: `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${cy - demiMax}" x2="0" y2="${cy + demiMax}">
      <stop offset="0" stop-color="#000" stop-opacity=".42"/><stop offset=".16" stop-color="#000" stop-opacity=".12"/>
      <stop offset=".38" stop-color="#fff" stop-opacity=".16"/><stop offset=".5" stop-color="#fff" stop-opacity=".05"/>
      <stop offset=".62" stop-color="#000" stop-opacity=".04"/><stop offset=".84" stop-color="#000" stop-opacity=".16"/>
      <stop offset="1" stop-color="#000" stop-opacity=".48"/></linearGradient>`,
    svg: `<path d="${d}" fill="url(#${id})"/>`,
  };
}
function vitrage(d) {
  const id = 'g' + (uid++);
  return {
    defs: `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7f9ab8"/><stop offset=".45" stop-color="#2c3b50"/><stop offset="1" stop-color="#121a26"/></linearGradient>`,
    svg: `<path d="${d}" fill="url(#${id})" stroke="${CONTOUR}" stroke-width="2"/>`,
  };
}
function pneu(x, y, w, h, r = 6) {
  // vu de dessus : la bande de roulement, ses rainures et l'ombre du flanc
  let s = rr(x, y, w, h, r, `fill="#1c1d21" stroke="${CONTOUR}" stroke-width="2"`);
  s += rr(x + 3, y + 2, w - 6, h * 0.28, r * 0.6, 'fill="#3a3c43" opacity=".55"');
  for (let i = 1; i < 6; i++) s += `<line x1="${f(x + w * i / 6)}" y1="${f(y + 3)}" x2="${f(x + w * i / 6)}" y2="${f(y + h - 3)}" stroke="#2c2e34" stroke-width="1.5"/>`;
  return s;
}
function texte(x, y, t, taille, couleur, opts = {}) {
  const rot = opts.rot ? ` transform="rotate(${opts.rot} ${f(x)} ${f(y)})"` : '';
  const contour = opts.contour ? ` stroke="${opts.contour}" stroke-width="${opts.cw || 2.5}" paint-order="stroke"` : '';
  const larg = opts.largeur ? ` textLength="${opts.largeur}" lengthAdjust="spacingAndGlyphs"` : '';
  return `<text x="${f(x)}" y="${f(y)}" font-family="'Arial Black','Arial',sans-serif" font-weight="900" font-size="${taille}" fill="${couleur}" text-anchor="middle" dominant-baseline="central"${larg}${contour}${rot}${opts.italic ? ' font-style="italic"' : ''}>${t}</text>`;
}
function rond(x, y, r, num, fond = '#fff', encre = '#111', rot = 90) {
  return `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${fond}" stroke="${CONTOUR}" stroke-width="1.5"/>` + texte(x, y, num, r * 1.25, encre, { rot });
}
function casque(x, y, r, c1, c2) {
  return `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${c1}" stroke="${CONTOUR}" stroke-width="2"/>`
    + `<path d="M${f(x - r * 0.2)},${f(y - r * 0.92)} A${r},${r} 0 0 1 ${f(x - r * 0.2)},${f(y + r * 0.92)} L${f(x + r * 0.15)},${f(y + r * 0.6)} A${r * 0.7},${r * 0.7} 0 0 0 ${f(x + r * 0.15)},${f(y - r * 0.6)}Z" fill="${c2}"/>`
    + `<ellipse cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.35)}" rx="${r * 0.35}" ry="${r * 0.22}" fill="#fff" opacity=".45"/>`;
}

// ---------------------------------------------------------------------------------------------
// Les monoplaces : un même squelette, et ce qui fait chaque voiture.

function monoplace(o) {
  const W = 420, H = 205, cy = H / 2;
  const defs = [], couches = [];
  // les quatre roues, sous tout le reste
  const rx0 = o.roueAr || 52, fx0 = o.roueAv || 300;
  couches.push(pneu(rx0, 4, 74, 50, 9), pneu(rx0, H - 54, 74, 50, 9));
  couches.push(pneu(fx0, 16, 50, 36, 7), pneu(fx0, H - 52, 50, 36, 7));
  // les bras de suspension
  const bras = (x1, x2, y1, y2) => `<path d="M${x1},${y1} L${x2},${y2}" stroke="#2b2c31" stroke-width="3.5" stroke-linecap="round"/>`;
  couches.push(bras(fx0 + 12, fx0 - 20, 40, cy - 14), bras(fx0 + 38, fx0 + 10, 40, cy - 12), bras(fx0 + 12, fx0 - 20, H - 40, cy + 14), bras(fx0 + 38, fx0 + 10, H - 40, cy + 12));
  couches.push(bras(rx0 + 20, rx0 + 70, 34, cy - 30), bras(rx0 + 52, rx0 + 90, 34, cy - 26), bras(rx0 + 20, rx0 + 70, H - 34, cy + 30), bras(rx0 + 52, rx0 + 90, H - 34, cy + 26));
  // aileron avant
  if (o.aileronAv !== false) {
    const a = o.aileronAv || { x: 372, l: 28, w: 168 };
    couches.push(rr(a.x, cy - a.w / 2, a.l, a.w, 4, `fill="${o.couleurAileronAv || o.c1}" stroke="${CONTOUR}" stroke-width="2.5"`));
    couches.push(rr(a.x - 2, cy - a.w / 2 - 3, a.l + 4, 7, 2, `fill="${o.c2}" stroke="${CONTOUR}" stroke-width="1.5"`), rr(a.x - 2, cy + a.w / 2 - 4, a.l + 4, 7, 2, `fill="${o.c2}" stroke="${CONTOUR}" stroke-width="1.5"`));
  }
  // la coque
  const d = symetrique(o.coque, cy);
  couches.push(`<path d="${d}" fill="${o.c1}" stroke="${CONTOUR}" stroke-width="3"/>`);
  if (o.peinture) couches.push(`<g clip-path="url(#cq)">${o.peinture(cy)}</g>`);
  defs.push(`<clipPath id="cq"><path d="${d}"/></clipPath>`);
  const v = volume(d, cy, 80); defs.push(v.defs); couches.push(v.svg);
  // pontons et dessus
  if (o.dessus) couches.push(o.dessus(cy));
  // le baquet, le pilote, le capot moteur
  const ck = o.cockpit || 205;
  couches.push(`<path d="${lisse([[ck + 46, cy], [ck + 30, cy - 17], [ck - 8, cy - 19], [ck - 28, cy - 14], [ck - 28, cy + 14], [ck - 8, cy + 19], [ck + 30, cy + 17]], true)}" fill="#14161b" stroke="${CONTOUR}" stroke-width="2"/>`);
  couches.push(casque(ck, cy, 13, o.casque || '#f4f4f4', o.casque2 || o.c2));
  couches.push(`<path d="M${ck + 44},${cy - 15} Q${ck + 58},${cy} ${ck + 44},${cy + 15}" fill="none" stroke="#9fc3e6" stroke-width="4" opacity=".8"/>`);
  if (o.moteur !== false) {
    // le moteur à nu derrière le pilote : collecteurs et cache-culbuteurs
    const mx = ck - 40;
    couches.push(rr(mx - 70, cy - 22, 62, 44, 6, `fill="#4a4d55" stroke="${CONTOUR}" stroke-width="2"`));
    for (let i = 0; i < 4; i++) couches.push(`<circle cx="${mx - 60 + i * 15}" cy="${cy - 10}" r="4.5" fill="#9a9ea8" stroke="#222" stroke-width="1"/><circle cx="${mx - 60 + i * 15}" cy="${cy + 10}" r="4.5" fill="#9a9ea8" stroke="#222" stroke-width="1"/>`);
  }
  if (o.boite) couches.push(o.boite(cy));
  // aileron arrière, par-dessus
  const ar = o.aileronAr || { x: 4, l: 40, w: 150 };
  couches.push(rr(ar.x, cy - ar.w / 2, ar.l, ar.w, 4, `fill="${o.couleurAileron || o.c1}" stroke="${CONTOUR}" stroke-width="2.5"`));
  couches.push(rr(ar.x + 4, cy - ar.w / 2 + 6, ar.l - 8, ar.w - 12, 3, 'fill="#fff" opacity=".12"'));
  couches.push(rr(ar.x - 2, cy - ar.w / 2 - 4, ar.l + 4, 9, 2, `fill="${o.c2}" stroke="${CONTOUR}" stroke-width="1.5"`), rr(ar.x - 2, cy + ar.w / 2 - 5, ar.l + 4, 9, 2, `fill="${o.c2}" stroke="${CONTOUR}" stroke-width="1.5"`));
  if (o.decorAileron) couches.push(o.decorAileron(cy, ar));
  if (o.decor) couches.push(o.decor(cy));
  return { W, H, defs: defs.join(''), corps: couches.join('\n') };
}

// ---------------------------------------------------------------------------------------------
// Les voitures fermées : coque, roues qui dépassent à peine, vitrage, livrée.

function fermee(o) {
  const W = 420, H = o.H || 200, cy = H / 2;
  const defs = [], couches = [];
  const rf = o.rouesAv || { x: 300, w: 60 }, rr_ = o.rouesAr || { x: 70, w: 66 };
  const ep = o.pneuDepasse == null ? 6 : o.pneuDepasse;
  const demiMax = Math.max(...o.coque.map(p => p[1]));
  for (const [x, w] of [[rf.x, rf.w], [rr_.x, rr_.w]]) {
    couches.push(pneu(x, cy - demiMax - ep, w, 30, 6), pneu(x, cy + demiMax + ep - 30, w, 30, 6));
  }
  const d = symetrique(o.coque, cy, o.tension || 0.5);
  defs.push(`<clipPath id="cq"><path d="${d}"/></clipPath>`);
  couches.push(`<path d="${d}" fill="${o.c1}" stroke="${CONTOUR}" stroke-width="3"/>`);
  if (o.peinture) couches.push(`<g clip-path="url(#cq)">${o.peinture(cy)}</g>`);
  const v = volume(d, cy, demiMax); defs.push(v.defs); couches.push(v.svg);
  // passages de roues et ailes : un léger relief au-dessus de chaque roue
  for (const [x, w] of [[rf.x, rf.w], [rr_.x, rr_.w]]) {
    for (const s of [-1, 1]) {
      const y = cy + s * (demiMax - 13);
      couches.push(`<ellipse cx="${x + w / 2}" cy="${f(y)}" rx="${w * 0.56}" ry="12" fill="#fff" opacity=".10"/>`);
    }
  }
  if (o.dessous) couches.push(o.dessous(cy));
  // le vitrage : pare-brise, toit, lunette
  if (o.vitrage) for (const pts of o.vitrage(cy)) { const g = vitrage(typeof pts === 'string' ? pts : lisse(pts, true, 0.3)); defs.push(g.defs); couches.push(g.svg); }
  if (o.toit) couches.push(o.toit(cy));
  if (o.decor) couches.push(o.decor(cy));
  // phares et feux
  if (o.phares) couches.push(o.phares(cy));
  return { W, H, defs: defs.join(''), corps: couches.join('\n') };
}

// ---------------------------------------------------------------------------------------------
// Les douze voitures.

const NOIR = '#16171b', BLANC = '#f3f3ef', OR = '#d4b35e';

const VOITURES = {
  // --- F1 ---------------------------------------------------------------------------------
  /* Lotus 72 : le coin. Nez en lame, radiateurs déportés dans des pontons à l'arrière, grande
  prise d'air au-dessus du pilote. John Player Special, noir et filets or, Fittipaldi 1972. */
  lotus72: () => monoplace({
    c1: NOIR, c2: OR, couleurAileron: NOIR, couleurAileronAv: NOIR, casque: '#f4f4f4', casque2: '#1c4fa3',
    coque: [[418, 4], [405, 9], [360, 16], [300, 22], [262, 26], [225, 30], [190, 34], [176, 56], [150, 62], [118, 60], [104, 40], [80, 28], [58, 22], [40, 14]],
    aileronAv: { x: 362, l: 24, w: 150 }, aileronAr: { x: 6, l: 34, w: 156 }, cockpit: 214,
    dessus: (cy) => `<path d="M176,${cy - 40} L190,${cy - 40} L190,${cy + 40} L176,${cy + 40}Z" fill="${OR}" opacity=".85"/>`
      + rr(196, cy - 9, 70, 18, 6, `fill="${NOIR}" stroke="${OR}" stroke-width="2"`)
      + `<path d="M410,${cy} L230,${cy - 9}" stroke="${OR}" stroke-width="2"/><path d="M410,${cy} L230,${cy + 9}" stroke="${OR}" stroke-width="2"/>`,
    decor: (cy) => texte(312, cy, 'JPS', 20, OR, { rot: 90 }) + texte(140, cy - 46, 'John Player Special', 10, OR, { largeur: 66 }) + texte(140, cy + 46, 'John Player Special', 10, OR, { largeur: 66 })
      + texte(250, cy - 31, '8', 13, OR) + texte(250, cy + 31, '8', 13, OR)
      + texte(24, cy, 'JOHN PLAYER SPECIAL', 9, OR, { rot: 90, largeur: 120 }),
  }),
  /* Brabham BT46B, la « voiture aspirateur » : un gros ventilateur entre les roues arrière qui
  plaque la voiture au sol à toute vitesse, des panneaux de refroidissement sur le dessus.
  Parmalat, rouge et blanc, Lauda à Anderstorp 1978. */
  brabhambt46b: () => monoplace({
    c1: '#e8202a', c2: BLANC, couleurAileron: '#e8202a', couleurAileronAv: BLANC, casque: '#d8262e', casque2: '#f4f4f4',
    coque: [[418, 5], [400, 12], [350, 22], [300, 30], [262, 40], [230, 52], [190, 60], [150, 62], [118, 60], [96, 50], [70, 34], [44, 26], [30, 18]],
    aileronAv: { x: 368, l: 28, w: 172 }, aileronAr: false, cockpit: 214, moteur: false,
    peinture: (cy) => `<rect x="0" y="0" width="420" height="${cy - 26}" fill="${BLANC}"/><rect x="0" y="${cy + 26}" width="420" height="${cy}" fill="${BLANC}"/>`
      + `<path d="M420,${cy - 26} L0,${cy - 26}" stroke="${NOIR}" stroke-width="2"/><path d="M420,${cy + 26} L0,${cy + 26}" stroke="${NOIR}" stroke-width="2"/>`,
    dessus: (cy) => {
      // les panneaux de refroidissement, et le ventilateur
      let s = '';
      for (let i = 0; i < 6; i++) s += `<line x1="${120 + i * 14}" y1="${cy - 50}" x2="${120 + i * 14}" y2="${cy - 30}" stroke="#7a7d86" stroke-width="2.5"/><line x1="${120 + i * 14}" y1="${cy + 30}" x2="${120 + i * 14}" y2="${cy + 50}" stroke="#7a7d86" stroke-width="2.5"/>`;
      s += `<circle cx="40" cy="${cy}" r="36" fill="#2a2c32" stroke="${CONTOUR}" stroke-width="3"/>`;
      for (let a = 0; a < 6; a++) {
        const t = a * Math.PI / 3;
        s += `<path d="M40,${cy} L${f(40 + 33 * Math.cos(t))},${f(cy + 33 * Math.sin(t))} A33,33 0 0 1 ${f(40 + 33 * Math.cos(t + 0.55))},${f(cy + 33 * Math.sin(t + 0.55))}Z" fill="#8d919b" stroke="#222" stroke-width="1"/>`;
      }
      s += `<circle cx="40" cy="${cy}" r="9" fill="#d8262e" stroke="${CONTOUR}" stroke-width="2"/>`;
      return s;
    },
    decor: (cy) => texte(352, cy, 'Parmalat', 9, BLANC, { rot: 90, largeur: 34 }) + texte(262, cy - 42, 'Parmalat', 12, '#1a4aa0', { largeur: 58 }) + texte(262, cy + 42, 'Parmalat', 12, '#1a4aa0', { largeur: 58 })
      + rond(160, cy, 12, '3', '#fff', '#111'),
  }),
  /* Williams FW07 : l'effet de sol en pontons longs et droits, un nez fin, le blanc et vert de
  Saudia. Alan Jones 1979. */
  williamsfw07: () => monoplace({
    c1: BLANC, c2: '#1f6b3a', couleurAileron: BLANC, couleurAileronAv: BLANC, casque: '#f4f4f4', casque2: '#1f6b3a',
    coque: [[418, 4], [400, 9], [350, 14], [300, 19], [278, 52], [250, 62], [150, 64], [108, 62], [94, 46], [68, 28], [44, 22], [32, 16]],
    aileronAv: { x: 376, l: 24, w: 168 }, cockpit: 220,
    peinture: (cy) => `<rect x="0" y="${cy - 64}" width="420" height="14" fill="#1f6b3a"/><rect x="0" y="${cy + 50}" width="420" height="14" fill="#1f6b3a"/>`
      + `<rect x="270" y="${cy - 8}" width="150" height="16" fill="#1f6b3a"/>`,
    dessus: (cy) => `<path d="M278,${cy - 30} L120,${cy - 30}" stroke="#bfc2c8" stroke-width="2"/><path d="M278,${cy + 30} L120,${cy + 30}" stroke="#bfc2c8" stroke-width="2"/>`,
    decor: (cy) => texte(200, cy - 46, 'SAUDIA', 15, '#1f6b3a', { largeur: 74 }) + texte(200, cy + 46, 'SAUDIA', 15, '#1f6b3a', { largeur: 74 })
      + texte(340, cy, 'TAG', 11, NOIR, { rot: 90 }) + rond(124, cy, 12, '27', '#fff', '#111')
      + texte(24, cy, 'SAUDIA', 13, '#1f6b3a', { rot: 90, largeur: 90 }),
  }),
  /* Ligier JS11 : pontons d'effet de sol, grand aileron avant, le bleu clair de Gitanes. Laffite
  1979, la danseuse sur les flancs. */
  ligierjs11: () => monoplace({
    c1: '#2f7fd1', c2: BLANC, couleurAileron: '#2f7fd1', couleurAileronAv: '#2f7fd1', casque: '#2f7fd1', casque2: '#f4f4f4',
    coque: [[418, 5], [398, 11], [350, 16], [302, 22], [282, 54], [250, 64], [150, 64], [110, 62], [96, 46], [70, 28], [44, 22], [32, 16]],
    aileronAv: { x: 364, l: 30, w: 180 }, cockpit: 222,
    dessus: (cy) => `<path d="M282,${cy - 40} L120,${cy - 40}" stroke="#1d5ea3" stroke-width="2"/><path d="M282,${cy + 40} L120,${cy + 40}" stroke="#1d5ea3" stroke-width="2"/>`,
    decor: (cy) => texte(195, cy - 50, 'Gitanes', 15, BLANC, { italic: true, largeur: 76 }) + texte(195, cy + 50, 'Gitanes', 15, BLANC, { italic: true, largeur: 76 })
      + texte(340, cy, 'Gitanes', 11, BLANC, { rot: 90, italic: true }) + rond(128, cy, 12, '26', '#fff', '#111')
      + texte(24, cy, 'Gitanes', 15, BLANC, { rot: 90, italic: true, largeur: 100 }),
  }),
  /* Renault RS10 : le premier turbo vainqueur, jaune, blanc et noir, Elf sur le nez. Jabouille à
  Dijon 1979. */
  renaultrs10: () => monoplace({
    c1: '#f2c500', c2: NOIR, couleurAileron: '#f2c500', couleurAileronAv: '#f2c500', casque: '#f4f4f4', casque2: '#1a4aa0',
    coque: [[418, 5], [398, 12], [350, 18], [304, 24], [284, 54], [250, 64], [150, 64], [110, 62], [96, 46], [70, 30], [44, 22], [32, 16]],
    aileronAv: { x: 366, l: 30, w: 176 }, cockpit: 222,
    peinture: (cy) => `<rect x="0" y="${cy - 64}" width="420" height="20" fill="${BLANC}"/><rect x="0" y="${cy + 44}" width="420" height="20" fill="${BLANC}"/>`
      + `<rect x="0" y="${cy - 46}" width="420" height="5" fill="${NOIR}"/><rect x="0" y="${cy + 41}" width="420" height="5" fill="${NOIR}"/>`,
    boite: (cy) => `<circle cx="150" cy="${cy - 30}" r="9" fill="#9a9ea8" stroke="${CONTOUR}" stroke-width="2"/><circle cx="150" cy="${cy + 30}" r="9" fill="#9a9ea8" stroke="${CONTOUR}" stroke-width="2"/>`,
    decor: (cy) => texte(340, cy, 'elf', 15, '#d01f2a', { rot: 90 }) + texte(200, cy - 54, 'RENAULT', 12, NOIR, { largeur: 70 }) + texte(200, cy + 54, 'RENAULT', 12, NOIR, { largeur: 70 })
      + texte(200, cy - 30, 'elf', 13, '#d01f2a') + texte(200, cy + 30, 'elf', 13, '#d01f2a')
      + rond(126, cy, 12, '15', '#fff', '#111') + texte(24, cy, 'RENAULT', 13, NOIR, { rot: 90, largeur: 90 }),
  }),

  // --- GT ---------------------------------------------------------------------------------
  /* Ferrari 250 GTO : long capot, trois ouïes sur le nez, arrière tronqué à becquet. Rosso
  corsa, une bande blanche et un rond de course. */
  '250gto': () => fermee({
    c1: '#c8161d', H: 196,
    coque: [[418, 30], [414, 52], [400, 70], [370, 80], [320, 84], [260, 82], [215, 78], [170, 82], [120, 88], [70, 90], [30, 86], [8, 76], [3, 50], [2, 20]],
    rouesAv: { x: 312, w: 58 }, rouesAr: { x: 66, w: 62 },
    peinture: (cy) => `<rect x="0" y="${cy - 9}" width="420" height="18" fill="${BLANC}"/>`,
    vitrage: (cy) => [
      [[232, cy - 56], [212, cy - 60], [200, cy - 56], [200, cy + 56], [212, cy + 60], [232, cy + 56], [238, cy]],
      [[146, cy - 54], [100, cy - 52], [92, cy], [100, cy + 52], [146, cy + 54]],
    ],
    toit: (cy) => `<path d="M200,${cy - 56} L146,${cy - 54} L146,${cy + 54} L200,${cy + 56}Z" fill="#c8161d" stroke="${CONTOUR}" stroke-width="2"/><rect x="146" y="${cy - 9}" width="54" height="18" fill="${BLANC}"/>`,
    decor: (cy) => rond(176, cy, 20, '3', BLANC, '#111') + rond(300, cy - 54, 14, '3', BLANC, '#111') + rond(300, cy + 54, 14, '3', BLANC, '#111')
      + [0, 1, 2].map(i => `<path d="M${398 - i * 9},${cy - 22} L${398 - i * 9},${cy + 22}" stroke="#4a0a0d" stroke-width="3" opacity=".7"/>`).join('')
      + `<path d="M350,${cy - 30} Q340,${cy} 350,${cy + 30}" stroke="#7a0b10" stroke-width="2" fill="none"/>`
      + `<path d="M6,${cy - 70} L18,${cy - 70} L18,${cy + 70} L6,${cy + 70}" fill="none" stroke="${CONTOUR}" stroke-width="2"/>`,
    phares: (cy) => `<ellipse cx="404" cy="${cy - 52}" rx="9" ry="12" fill="#e9edf2" stroke="${CONTOUR}" stroke-width="2"/><ellipse cx="404" cy="${cy + 52}" rx="9" ry="12" fill="#e9edf2" stroke="${CONTOUR}" stroke-width="2"/>`
      + `<circle cx="10" cy="${cy - 60}" r="5" fill="#d81b25" stroke="${CONTOUR}"/><circle cx="10" cy="${cy + 60}" r="5" fill="#d81b25" stroke="${CONTOUR}"/>`,
  }),
  /* Jaguar Type E Lightweight : le capot le plus long du plateau, bombé au centre, la bulle de
  verre en arrière. British racing green et un rond blanc. */
  typee: () => fermee({
    c1: '#1d5c3a', H: 192,
    coque: [[418, 26], [412, 46], [398, 62], [370, 72], [320, 76], [270, 74], [220, 72], [175, 76], [125, 84], [75, 86], [35, 82], [12, 70], [4, 46], [2, 18]],
    rouesAv: { x: 316, w: 56 }, rouesAr: { x: 66, w: 60 },
    dessous: (cy) => `<path d="${lisse([[412, cy], [395, cy - 20], [300, cy - 26], [240, cy - 20], [232, cy], [240, cy + 20], [300, cy + 26], [395, cy + 20]], true)}" fill="#fff" opacity=".13"/>`
      + `<path d="M405,${cy} L245,${cy}" stroke="#123b25" stroke-width="2"/>`,
    vitrage: (cy) => [
      [[214, cy - 52], [196, cy - 56], [180, cy - 52], [180, cy + 52], [196, cy + 56], [214, cy + 52], [220, cy]],
      [[142, cy - 50], [100, cy - 40], [76, cy], [100, cy + 40], [142, cy + 50]],
    ],
    toit: (cy) => `<path d="M180,${cy - 52} L142,${cy - 50} L142,${cy + 50} L180,${cy + 52}Z" fill="#1d5c3a" stroke="${CONTOUR}" stroke-width="2"/>`,
    decor: (cy) => rond(282, cy, 21, '15', BLANC, '#111') + rond(160, cy - 58, 13, '15', BLANC, '#111') + rond(160, cy + 58, 13, '15', BLANC, '#111')
      + `<path d="M226,${cy - 60} L226,${cy - 40} M226,${cy + 40} L226,${cy + 60}" stroke="#123b25" stroke-width="2"/>`,
    phares: (cy) => `<ellipse cx="396" cy="${cy - 46}" rx="13" ry="11" fill="#cfe2ee" stroke="${CONTOUR}" stroke-width="2"/><ellipse cx="396" cy="${cy + 46}" rx="13" ry="11" fill="#cfe2ee" stroke="${CONTOUR}" stroke-width="2"/>`
      + `<ellipse cx="415" cy="${cy}" rx="4" ry="16" fill="#0d1a12"/>`
      + `<circle cx="9" cy="${cy - 52}" r="5" fill="#d81b25" stroke="${CONTOUR}"/><circle cx="9" cy="${cy + 52}" r="5" fill="#d81b25" stroke="${CONTOUR}"/>`,
  }),
  /* Datsun 240Z : capot long et plat, hayon, les bandes rouge et bleue de BRE et le 46. */
  '240z': () => fermee({
    c1: BLANC, H: 194,
    coque: [[418, 50], [412, 70], [396, 80], [340, 84], [270, 84], [210, 82], [150, 84], [90, 86], [40, 86], [12, 80], [3, 62], [2, 24]],
    rouesAv: { x: 318, w: 56 }, rouesAr: { x: 66, w: 60 },
    peinture: (cy) => `<path d="M420,${cy - 24} L0,${cy - 24} L0,${cy - 10} L420,${cy - 10}Z" fill="#d12a2a"/><path d="M420,${cy + 24} L0,${cy + 24} L0,${cy + 10} L420,${cy + 10}Z" fill="#1c3f99"/>`
      + `<path d="M420,${cy - 80} L0,${cy - 80} L0,${cy - 74} L420,${cy - 74}Z" fill="#d12a2a"/><path d="M420,${cy + 80} L0,${cy + 80} L0,${cy + 74} L420,${cy + 74}Z" fill="#1c3f99"/>`,
    vitrage: (cy) => [
      [[236, cy - 62], [214, cy - 66], [198, cy - 62], [198, cy + 62], [214, cy + 66], [236, cy + 62], [242, cy]],
      [[124, cy - 62], [60, cy - 58], [50, cy], [60, cy + 58], [124, cy + 62]],
    ],
    toit: (cy) => `<path d="M198,${cy - 62} L124,${cy - 62} L124,${cy + 62} L198,${cy + 62}Z" fill="${BLANC}" stroke="${CONTOUR}" stroke-width="2"/>`
      + `<path d="M198,${cy - 24} L124,${cy - 24} L124,${cy - 10} L198,${cy - 10}Z" fill="#d12a2a"/><path d="M198,${cy + 24} L124,${cy + 24} L124,${cy + 10} L198,${cy + 10}Z" fill="#1c3f99"/>`,
    decor: (cy) => rond(300, cy, 22, '46', BLANC, '#111') + texte(160, cy - 50, 'BRE', 13, '#1c3f99') + texte(160, cy + 50, 'BRE', 13, '#d12a2a')
      + texte(26, cy, 'DATSUN', 13, '#111', { rot: 90, largeur: 80 }),
    phares: (cy) => `<circle cx="402" cy="${cy - 60}" r="12" fill="#cfe2ee" stroke="${CONTOUR}" stroke-width="2"/><circle cx="402" cy="${cy + 60}" r="12" fill="#cfe2ee" stroke="${CONTOUR}" stroke-width="2"/>`
      + `<rect x="410" y="${cy - 30}" width="8" height="60" rx="3" fill="#202228"/>`
      + `<rect x="3" y="${cy - 72}" width="7" height="22" fill="#d81b25" stroke="${CONTOUR}"/><rect x="3" y="${cy + 50}" width="7" height="22" fill="#d81b25" stroke="${CONTOUR}"/>`,
  }),

  // --- Proto -------------------------------------------------------------------------------
  /* Porsche 962 : longue queue, grand aileron, le bleu et blanc de Rothmans avec ses filets or et
  rouge. La seconde livrée est celle de Shell et Dunlop. */
  962: (livree) => {
    const sh = livree === 'shell';
    const c1 = BLANC;
    return fermee({
      c1, H: 206,
      coque: [[418, 44], [410, 68], [392, 86], [350, 92], [280, 94], [200, 94], [120, 96], [60, 96], [20, 94], [6, 88], [2, 60], [2, 20]],
      rouesAv: { x: 318, w: 62 }, rouesAr: { x: 72, w: 66 }, pneuDepasse: 3,
      peinture: (cy) => sh
        ? `<rect x="0" y="${cy - 96}" width="420" height="58" fill="#f2c300"/><rect x="0" y="${cy + 38}" width="420" height="58" fill="#f2c300"/>`
          + `<rect x="0" y="${cy - 40}" width="420" height="10" fill="#d71920"/><rect x="0" y="${cy + 30}" width="420" height="10" fill="#d71920"/>`
        : `<path d="M420,${cy - 96} L240,${cy - 96} L180,${cy - 40} L420,${cy - 40}Z" fill="#1b3f8f"/><path d="M420,${cy + 96} L240,${cy + 96} L180,${cy + 40} L420,${cy + 40}Z" fill="#1b3f8f"/>`
          + `<path d="M180,${cy - 40} L240,${cy - 96} L248,${cy - 96} L188,${cy - 40}Z" fill="#c9a24a"/><path d="M180,${cy + 40} L240,${cy + 96} L248,${cy + 96} L188,${cy + 40}Z" fill="#c9a24a"/>`
          + `<path d="M190,${cy - 40} L250,${cy - 96} L256,${cy - 96} L196,${cy - 40}Z" fill="#d71920"/><path d="M190,${cy + 40} L250,${cy + 96} L256,${cy + 96} L196,${cy + 40}Z" fill="#d71920"/>`,
      vitrage: (cy) => [
        [[262, cy - 38], [240, cy - 42], [222, cy - 38], [222, cy + 38], [240, cy + 42], [262, cy + 38], [270, cy]],
      ],
      toit: (cy) => `<path d="M222,${cy - 38} L178,${cy - 34} L170,${cy} L178,${cy + 34} L222,${cy + 38}Z" fill="${c1}" stroke="${CONTOUR}" stroke-width="2"/>`
        + `<path d="M170,${cy - 26} L90,${cy - 22} L90,${cy + 22} L170,${cy + 26}Z" fill="#2a2c32" stroke="${CONTOUR}" stroke-width="2"/>`
        + [0, 1, 2, 3, 4].map(i => `<line x1="${100 + i * 15}" y1="${cy - 20}" x2="${100 + i * 15}" y2="${cy + 20}" stroke="#555" stroke-width="2"/>`).join(''),
      decor: (cy) => {
        // l'aileron arrière, large et haut, posé sur deux dérives
        let s = rr(4, cy - 92, 36, 184, 4, `fill="${sh ? '#f2c300' : c1}" stroke="${CONTOUR}" stroke-width="2.5"`)
          + rr(8, cy - 86, 28, 172, 3, 'fill="#fff" opacity=".15"');
        s += sh
          ? texte(22, cy, 'Shell', 18, '#d71920', { rot: 90, largeur: 90 }) + texte(370, cy, 'Shell', 16, '#d71920', { rot: 90, largeur: 56 })
            + texte(150, cy - 66, 'DUNLOP', 13, '#111', { largeur: 80 }) + texte(150, cy + 66, 'DUNLOP', 13, '#111', { largeur: 80 }) + rond(300, cy - 66, 16, '7') + rond(300, cy + 66, 16, '7')
          : texte(22, cy, 'Rothmans', 16, '#1b3f8f', { rot: 90, largeur: 120 }) + texte(374, cy, 'Rothmans', 11, '#1b3f8f', { rot: 90, largeur: 62 })
            + texte(130, cy - 66, 'Rothmans', 13, '#1b3f8f', { largeur: 76 }) + texte(130, cy + 66, 'Rothmans', 13, '#1b3f8f', { largeur: 76 }) + rond(300, cy - 66, 16, '17') + rond(300, cy + 66, 16, '17');
        return s;
      },
      phares: (cy) => `<path d="M412,${cy - 70} Q400,${cy - 60} 404,${cy - 46} L414,${cy - 50}Z" fill="#cfe2ee" stroke="${CONTOUR}" stroke-width="2"/><path d="M412,${cy + 70} Q400,${cy + 60} 404,${cy + 46} L414,${cy + 50}Z" fill="#cfe2ee" stroke="${CONTOUR}" stroke-width="2"/>`,
    });
  },
  /* Jaguar XJR-9 : la Silk Cut violette, roues arrière carénées, longue et basse. */
  xjr9: () => fermee({
    c1: '#5b2a86', H: 206,
    coque: [[418, 40], [410, 66], [394, 86], [350, 94], [270, 96], [190, 96], [110, 96], [50, 96], [14, 92], [4, 80], [2, 50], [2, 16]],
    rouesAv: { x: 318, w: 62 }, rouesAr: { x: 72, w: 66 }, pneuDepasse: -6,
    peinture: (cy) => `<path d="M420,${cy - 60} Q300,${cy - 50} 200,${cy - 74} L0,${cy - 74} L0,${cy - 62} L200,${cy - 62} Q300,${cy - 38} 420,${cy - 48}Z" fill="${BLANC}" opacity=".9"/>`
      + `<path d="M420,${cy + 60} Q300,${cy + 50} 200,${cy + 74} L0,${cy + 74} L0,${cy + 62} L200,${cy + 62} Q300,${cy + 38} 420,${cy + 48}Z" fill="${BLANC}" opacity=".9"/>`,
    vitrage: (cy) => [
      [[260, cy - 40], [238, cy - 44], [220, cy - 40], [220, cy + 40], [238, cy + 44], [260, cy + 40], [268, cy]],
    ],
    toit: (cy) => `<path d="M220,${cy - 40} L170,${cy - 36} L162,${cy} L170,${cy + 36} L220,${cy + 40}Z" fill="#5b2a86" stroke="${CONTOUR}" stroke-width="2"/>`
      + `<path d="M162,${cy - 24} L80,${cy - 22} L80,${cy + 22} L162,${cy + 24}Z" fill="#3c1b5a" stroke="${CONTOUR}" stroke-width="2"/>`,
    decor: (cy) => rr(4, cy - 90, 34, 180, 4, `fill="#5b2a86" stroke="${CONTOUR}" stroke-width="2.5"`)
      + texte(21, cy, 'Silk Cut', 16, BLANC, { rot: 90, largeur: 120 }) + texte(370, cy, 'Silk Cut', 12, BLANC, { rot: 90, largeur: 66 })
      + texte(140, cy - 80, 'Silk Cut', 12, BLANC, { largeur: 70 }) + texte(140, cy + 80, 'Silk Cut', 12, BLANC, { largeur: 70 })
      + rond(290, cy - 70, 15, '2') + rond(290, cy + 70, 15, '2') + texte(110, cy, 'JAGUAR', 11, BLANC, { rot: 90 }),
    phares: (cy) => `<rect x="396" y="${cy - 72}" width="14" height="24" rx="5" fill="#f1e38a" stroke="${CONTOUR}" stroke-width="2"/><rect x="396" y="${cy + 48}" width="14" height="24" rx="5" fill="#f1e38a" stroke="${CONTOUR}" stroke-width="2"/>`,
  }),
  /* Ferrari 330 P4 : les ailes qui enveloppent les roues, le pare-brise très enveloppant, le
  capot arrière plat. Rouge à Daytona 1967, ou jaune pour l'Equipe Nationale Belge. */
  '330p4': (livree) => {
    const jaune = livree === 'giallo';
    const c1 = jaune ? '#f2c500' : '#d0141b';
    return fermee({
      c1, H: 200,
      coque: [[418, 34], [412, 58], [400, 80], [370, 90], [330, 92], [290, 84], [250, 74], [220, 72], [180, 76], [140, 88], [100, 94], [56, 94], [22, 88], [6, 74], [2, 44], [2, 14]],
      rouesAv: { x: 318, w: 58 }, rouesAr: { x: 70, w: 64 }, pneuDepasse: 2,
      peinture: (cy) => jaune ? `<rect x="0" y="${cy - 10}" width="420" height="20" fill="#1a7f3c"/>` : `<rect x="0" y="${cy - 7}" width="420" height="14" fill="${BLANC}"/>`,
      vitrage: (cy) => [
        [[248, cy - 52], [226, cy - 58], [208, cy - 54], [208, cy + 54], [226, cy + 58], [248, cy + 52], [256, cy]],
      ],
      toit: (cy) => `<path d="M208,${cy - 54} L170,${cy - 48} L170,${cy + 48} L208,${cy + 54}Z" fill="${c1}" stroke="${CONTOUR}" stroke-width="2"/>`
        + `<path d="M168,${cy - 40} L60,${cy - 34} L60,${cy + 34} L168,${cy + 40}Z" fill="#2a2c32" opacity=".55" stroke="${CONTOUR}" stroke-width="1.5"/>`
        + [0, 1, 2, 3, 4, 5].map(i => `<line x1="${72 + i * 16}" y1="${cy - 30}" x2="${72 + i * 16}" y2="${cy + 30}" stroke="#111" stroke-width="2" opacity=".6"/>`).join(''),
      decor: (cy) => jaune
        ? rond(300, cy, 20, '24', BLANC) + rond(150, cy - 66, 13, '24', BLANC) + rond(150, cy + 66, 13, '24', BLANC)
        : rond(300, cy, 20, '23', BLANC) + rond(150, cy - 66, 13, '23', BLANC) + rond(150, cy + 66, 13, '23', BLANC),
      phares: (cy) => `<ellipse cx="398" cy="${cy - 62}" rx="12" ry="14" fill="#cfe2ee" stroke="${CONTOUR}" stroke-width="2"/><ellipse cx="398" cy="${cy + 62}" rx="12" ry="14" fill="#cfe2ee" stroke="${CONTOUR}" stroke-width="2"/>`
        + `<ellipse cx="414" cy="${cy}" rx="4" ry="20" fill="#2a0a0b"/>`,
    });
  },
  /* Ford P68 : la plus profilée du plateau, longue queue effilée, cockpit en goutte, rouge et
  filets or d'Alan Mann Racing, 1968. */
  p68: () => fermee({
    c1: '#c62026', H: 194,
    coque: [[418, 22], [410, 46], [392, 66], [350, 80], [290, 86], [220, 88], [150, 88], [90, 82], [44, 70], [14, 52], [3, 30], [2, 10]],
    rouesAv: { x: 318, w: 56 }, rouesAr: { x: 92, w: 62 }, pneuDepasse: 4,
    peinture: (cy) => `<rect x="0" y="${cy - 14}" width="420" height="5" fill="${OR}"/><rect x="0" y="${cy + 9}" width="420" height="5" fill="${OR}"/>`,
    vitrage: (cy) => [
      [[268, cy - 42], [246, cy - 48], [226, cy - 44], [200, cy - 30], [196, cy], [200, cy + 30], [226, cy + 44], [246, cy + 48], [268, cy + 42], [276, cy]],
    ],
    toit: (cy) => `<path d="M190,${cy - 28} L100,${cy - 20} L100,${cy + 20} L190,${cy + 28}Z" fill="#9d1a1f" stroke="${CONTOUR}" stroke-width="1.5"/>`
      + [0, 1, 2, 3].map(i => `<line x1="${112 + i * 20}" y1="${cy - 16}" x2="${112 + i * 20}" y2="${cy + 16}" stroke="#4a0a0d" stroke-width="2"/>`).join(''),
    decor: (cy) => rond(316, cy, 18, '1', BLANC) + rond(160, cy - 62, 13, '1', BLANC) + rond(160, cy + 62, 13, '1', BLANC)
      + texte(34, cy, 'FORD', 14, OR, { rot: 90, contour: '#4a0a0d', cw: 2 }),
    phares: (cy) => `<path d="M404,${cy - 40} L414,${cy - 20} L404,${cy - 16}Z" fill="#cfe2ee" stroke="${CONTOUR}" stroke-width="1.5"/><path d="M404,${cy + 40} L414,${cy + 20} L404,${cy + 16}Z" fill="#cfe2ee" stroke="${CONTOUR}" stroke-width="1.5"/>`,
  }),
};

// Les fichiers à produire : une ligne par livrée, le suffixe étant celui que `cheminLivree` attend.
const FICHIERS = [
  ['lotus72'], ['brabhambt46b'], ['williamsfw07'], ['ligierjs11'], ['renaultrs10'],
  ['250gto'], ['typee'], ['240z'],
  ['962'], ['962', 'shell'], ['xjr9'], ['330p4'], ['330p4', 'giallo'], ['p68'],
];

function svgDe(id, livree) {
  uid = 0;
  const d = VOITURES[id](livree);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${d.W}" height="${d.H}" viewBox="0 0 ${d.W} ${d.H}"><defs>${d.defs}</defs>${d.corps}</svg>`;
}

if (require.main === module) {
  (async () => {
    const { chromium } = require('playwright');
    const args = process.argv.slice(2);
    const planche = (args.find(a => a.startsWith('--planche=')) || '').slice(10);
    const voulues = args.filter(a => !a.startsWith('--'));
    const liste = FICHIERS.filter(([id]) => !voulues.length || voulues.includes(id));
    fs.mkdirSync(path.join(RACINE, 'art-src/voitures'), { recursive: true });
    const browser = await chromium.launch();
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const produits = [];
    for (const [id, livree] of liste) {
      const nom = livree ? `${id}_${livree}` : id;
      const svg = svgDe(id, livree);
      fs.writeFileSync(path.join(RACINE, 'art-src/voitures', nom + '.svg'), svg + '\n');
      await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
      const el = await page.$('svg');
      const out = path.join(RACINE, 'sprites/top', nom + '.png');
      await el.screenshot({ path: out, omitBackground: true });
      produits.push(nom);
      console.log(path.relative(RACINE, out));
    }
    if (planche) {
      const imgs = produits.map(n => `<div style="display:inline-block;margin:6px;text-align:center;font:12px sans-serif;color:#ddd"><img src="data:image/png;base64,${fs.readFileSync(path.join(RACINE, 'sprites/top', n + '.png')).toString('base64')}"><br>${n}</div>`).join('');
      await page.setContent(`<html><body style="margin:0;background:#5a6e5a;width:880px">${imgs}</body></html>`);
      await page.screenshot({ path: planche, fullPage: true });
    }
    await browser.close();
  })().catch((e) => { console.error(e); process.exitCode = 1; });
}

module.exports = { svgDe, FICHIERS };
