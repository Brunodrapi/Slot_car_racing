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
/* `serre` DIT DE QUEL DROIT DEUX OBJETS SE TOUCHENT.

   Le semeur refusait tout candidat trop près d'un voisin déjà posé, et le résultat était un verger :
   des arbres régulièrement espacés dans un grand pré. Une forêt, c'est l'inverse — des couronnes qui
   se CHEVAUCHENT, et c'est le chevauchement qui fait la masse. Le facteur réduit la distance exigée :
   à 1 c'est le verger d'avant, à 0,45 les couronnes mordent les unes sur les autres. L'ordre de la
   liste reste l'ordre du dessin, donc le dernier posé passe devant — ce qui donne les couches. */
function placeFrom(kinds, track, seed, density, clear, serre, lisiere, profond) {
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
      if (dx * dx + dy * dy < need * need) return false;
    }
    return true;
  };
  const clearOfProps = (x, y, need) => {
    for (let j = out.length - 1; j >= 0 && j > out.length - 120; j--) {
      const dx = x - out[j].x, dy = y - out[j].y;
      if (dx * dx + dy * dy < need * need) return false;
    }
    return true;
  };
  /* AU-DELÀ DE UN, LA DENSITÉ EST UN NOMBRE DE TIRAGES et non plus une probabilité.

     Le semeur posait AU PLUS un objet par pas de neuf mètres et par côté : à densité 1 il était
     déjà saturé, et un circuit de trois kilomètres recevait sept cents arbres au total. C'est un
     bois clairsemé, et aucune probabilité ne pouvait en faire une forêt — on ne tire pas plus
     qu'une fois. Au-delà de 1 on tire donc plusieurs fois au même pas, chacun avec sa chance, ce
     qui empile les couronnes sur la largeur de la bande au lieu de les aligner le long de la
     piste. C'est ce qui manquait pour que le bas-côté devienne une masse. */
  const tirs = Math.max(1, Math.ceil(density));
  const chance = density / tirs;
  for (let s = 0; s < track.length; s += step) {
    for (const side of [1, -1]) {
     for (let t = 0; t < tirs; t++) {
      if (rnd() > chance) continue;
      const k = pick();
      const i = track.idx(s + (rnd() - 0.5) * step);
      const hw = side > 0 ? track.hwL[i] : track.hwR[i];
      /* `lisiere` RAPPROCHE LA FORÊT DU BITUME. Chaque objet garde une distance au bord — sept
         mètres pour un arbre — et c'est ce qui donnait une piste traversant une clairière : il
         fallait neuf mètres avant le premier tronc, quand l'image cible montre des couronnes qui
         SURPLOMBENT la route. Le facteur raccourcit cette garde, et le contrôle de dégagement avec
         elle : les deux doivent bouger ensemble, sinon on rapproche les arbres pour les faire
         refuser juste après. */
      const li = lisiere == null ? 1 : lisiere;
      /* `profond` DIT JUSQU'OÙ LA BANDE S'ENFONCE. Chaque objet a sa fourchette — un arbre entre
         sept et vingt-six mètres du bord — parce que la caméra ne montrait qu'une vingtaine de
         mètres de part et d'autre et qu'au-delà un objet existe sans être jamais vu. C'était vrai
         d'un bois clairsemé ; ça ne l'est plus d'une forêt, dont on doit voir le fond. Le facteur
         creuse la fourchette sans toucher au NOMBRE d'objets : il les étale, il n'en ajoute pas. */
      const pf = profond == null ? 1 : profond;
      const off = hw + k.near * li + rnd() * (k.far - k.near) * (0.3 + 0.7 * li) * pf + k.wm * 0.3;
      const x = track.xs[i] + track.nx[i] * off * side;
      const y = track.ys[i] + track.ny[i] * off * side;
      // keep clear of the road itself wherever it runs, gravel trap included
      if (!clearOfTrack(x, y, track.halfWidth + (clear == null ? 8.5 : clear) * li + k.wm * 0.3 * li)) continue;
      if (!clearOfProps(x, y, (k.wm + 2) * 0.6 * (serre == null ? 1 : serre))) continue;
      /* TROIS VARIATIONS PAR EXEMPLAIRE, et c'est ce qui fait une forêt avec seize fichiers.

         Posés tous identiques, les mêmes trois arbres répétés deux mille fois se lisent comme un
         motif : l'œil n'attrape pas un arbre, il attrape la RÉPÉTITION. Il suffit de peu pour la
         casser — la taille d'abord, qui donne aussi les couches (un grand devant un petit, c'est
         de la profondeur sans toucher à la caméra), la rotation ensuite, pour les objets qui n'ont
         pas de haut (une couronne vue de dessus n'en a pas ; une barrière, une fleur sur sa tige,
         si), et le ton enfin, de quelques pourcents, qui suffit à séparer deux couronnes qui se
         chevauchent.

         Les trois sortent du MÊME tirage que la position, donc un circuit retrouve sa forêt à
         l'identique d'une partie à l'autre. */
      const ech = 0.76 + rnd() * 0.58;
      out.push({ x, y, id: k.id, ech,
        rot: k.fixe ? 0 : rnd() * Math.PI * 2,
        ton: Math.min(TONS - 1, Math.floor(rnd() * TONS)) });
     }
    }
  }
  return out;
}

if (typeof module !== 'undefined') module.exports = { placeFrom };

/* ----------------------------------------------------------------- vu de dessus

Un arbre est une couronne et une ombre, pas un tronc. Chaque objet est dessiné dans la palette du
circuit plutôt que découpé d'une planche, ce qui lui permet de changer de teinte avec le thème.
*/


/* ------------------------------------------------- LE DÉCOR DESSINÉ À LA MAIN

Les objets du bas-côté ne sont plus peints par le code : ce sont des sprites découpés d'une planche
dessinée, et c'est un échange assumé.

CE QU'ON PERD : la recoloration par circuit. Un arbre peint prenait la palette du thème — vert
tendre à Monza, sombre dans les Ardennes, doré à Laguna Seca. Un sprite a sa couleur une fois pour
toutes, donc la même forêt partout. Et seize fichiers repartent sur le réseau, 192 Ko au total.

CE QU'ON GAGNE : le dessin. Aucune grammaire de lobes et d'aplats ne remplace une main.

Chaque sprite porte DÉJÀ SON OMBRE, cuite dans la planche. On ne lui en ajoute donc pas une
seconde — c'était le réflexe, et ça donnait deux ombres décalées sous chaque arbre.

Le manifeste est en dur plutôt que lu dans `art/decor/vegetation.json` : une requête de moins, et
surtout aucune course entre l'arrivée du manifeste et celle des images. Le fichier reste à côté des
sprites, écrit par `tools/decoupe-sprites.py`, pour qu'on sache d'où ils viennent. */
const KINDS_DESSINES = [
  { famille: 'tree', id: 'arbre', f: 'art/decor/arbre.png', wm: 9.0, weight: 7, near: 1, far: 26 },
  { famille: 'tree', id: 'bosquet', f: 'art/decor/bosquet.png', wm: 10.5, weight: 5, near: 2, far: 26 },
  { famille: 'bush', id: 'buisson', f: 'art/decor/buisson.png', wm: 4.2, weight: 4, near: 1, far: 22 },
  { famille: 'bush', id: 'buisson-fleuri', f: 'art/decor/buisson-fleuri.png', wm: 5.5, weight: 3, near: 1, far: 20 },
  { famille: 'bush', id: 'buisson-mini', f: 'art/decor/buisson-mini.png', wm: 2.2, weight: 0, near: 0.3, far: 12 },
  { famille: 'bush', id: 'buisson-petit', f: 'art/decor/buisson-petit.png', wm: 2.6, weight: 2, near: 0.5, far: 18 },
  { famille: 'bush', id: 'buisson2', f: 'art/decor/buisson2.png', wm: 3.6, weight: 3, near: 1, far: 22 },
  { famille: 'rock', id: 'caillou', f: 'art/decor/caillou.png', wm: 1.8, weight: 0, near: 0.3, far: 12 },
  { fixe: 1, id: 'fleurs-blanches', f: 'art/decor/fleurs-blanches.png', wm: 3.0, weight: 0, near: 0.2, far: 9 },
  { fixe: 1, id: 'fleurs-jaunes', f: 'art/decor/fleurs-jaunes.png', wm: 3.0, weight: 0, near: 0.2, far: 9 },
  { fixe: 1, id: 'fleurs-rouges', f: 'art/decor/fleurs-rouges.png', wm: 3.0, weight: 0, near: 0.2, far: 9 },
  { famille: 'bush', fixe: 1, id: 'fougere', f: 'art/decor/fougere.png', wm: 3.2, weight: 2, near: 0.5, far: 16 },
  { famille: 'rock', id: 'rocher', f: 'art/decor/rocher.png', wm: 4.2, weight: 2, near: 1, far: 18 },
  { famille: 'rock', id: 'rocher-petit', f: 'art/decor/rocher-petit.png', wm: 2.2, weight: 1.2, near: 0.5, far: 16 },
  { fixe: 1, id: 'touffe', f: 'art/decor/touffe.png', wm: 2.6, weight: 0, near: 0.2, far: 9 },
  { fixe: 1, id: 'touffe-mini', f: 'art/decor/touffe-mini.png', wm: 1.6, weight: 0, near: 0.2, far: 8 },
];

/* Les images, chargées une fois. Tant qu'elles ne sont pas là, `buildTopArt` retombe sur les
   objets peints : une course qui démarre pendant le chargement montre un décor peint plutôt
   qu'un décor vide, et `aPeint` dira plus tard de refaire la cuisson. */
const ART_DESSINE = {};
let decorCharge = 0, decorAttendu = 0;
function chargeDecor(fini) {
  if (typeof Image === 'undefined') return;
  decorAttendu = KINDS_DESSINES.length;
  for (const k of KINDS_DESSINES) {
    const img = new Image();
    img.onload = () => { ART_DESSINE[k.id] = img; if (++decorCharge === decorAttendu && fini) fini(); };
    img.onerror = () => { if (++decorCharge === decorAttendu && fini) fini(); };
    img.src = k.f;
  }
}
const decorPret = () => decorAttendu > 0 && decorCharge >= decorAttendu;

/* Les nuances de ton cuites pour chaque sprite. Quatre suffisent : au-delà on ne distingue plus,
   et chaque nuance coûte une toile de la taille du sprite. */
const TONS = 4;
const ECARTS_TON = [0.86, 0.95, 1.04, 1.12];

const TOP_PPM = 24;              // pixels per metre when baking a top-down object

/* ------------------------------------------------- LA GRAMMAIRE DU FEUILLAGE, VUE DE DESSUS

Un feuillage d'animation japonaise vue de dessus n'est pas un disque : c'est une GRAPPE DE LOBES à
contour irrégulier, peinte en aplats, et son volume vient d'un décalage et non d'un dégradé. On
pose la silhouette entière dans le vert le plus sombre, puis on repose la même grappe plus petite
et décalée VERS LA LUMIÈRE, trois ou quatre fois. L'œil lit l'empilement comme une masse ronde
éclairée d'en haut à gauche, alors qu'il n'y a que des aplats.

C'est la seule façon d'avoir ce rendu sans planche de sprites : les objets sont peints dans la
palette du circuit, donc les mêmes arbres sont vert tendre à Monza, sombres dans les Ardennes et
dorés à Laguna Seca. Une planche dessinée à la main donnerait la même forêt partout, et vingt-cinq
PNG à télécharger à chaque course — ce que ce fichier avait justement retiré. */

/** Éclaircit — ou assombrit, k < 1 — une couleur `#rrggbb`, pour compléter une palette à trois verts. */
function teinte(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((v) => f(k > 1 ? v + (255 - v) * (k - 1) : v * k).toString(16).padStart(2, '0')).join('');
}

/* Les quatre verts d'une couronne, du plus sombre au plus clair. Un thème n'en nomme que trois —
   `canopy` — et le quatrième est la touche de lumière, dérivée du plus clair des trois : un thème
   n'a pas à porter une couleur qui se déduit, et aucun n'est à réécrire pour autant. */
function versFeuillage(canopy) {
  const c = canopy && canopy.length >= 3 ? canopy : ['#3f7a34', '#4b8d3c', '#336629'];
  /* LA RAMPE TOURNE EN TEINTE, elle ne fait pas que s'éclaircir.

     Relevé sur l'image cible, le feuillage va de #086051 — un vert-bleu profond — à #b7d04e, un
     vert-jaune vif, en passant par #2a7643, #4b9c4a et #89c03c. Ce n'est pas une couleur
     éclaircie quatre fois : la teinte VOYAGE de 170° à 72° pendant que la luminance monte. C'est
     le vieux truc du feuillage peint, et c'est ce qui manquait — cinq valeurs d'un même vert
     donnaient un relief gris, parce qu'une ombre de feuille n'est pas du vert sombre, c'est du
     bleu-vert, et une feuille au soleil n'est pas du vert clair, c'est du jaune-vert.

     On garde la couleur du thème comme PIVOT : c'est elle qui décide si la forêt est celle des
     Ardennes ou le parc de Monza. Les deux bouts s'en écartent du même pas partout. */
  const moyen = c[0];
  const n = parseInt(moyen.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, v = ((n >> 8) & 255) / 255, bl = (n & 255) / 255;
  const mx = Math.max(r, v, bl), mn = Math.min(r, v, bl), lp = (mx + mn) / 2;
  let hp = 0, sp = 0;
  if (mx !== mn) {
    const d = mx - mn;
    sp = lp > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    hp = mx === r ? (v - bl) / d + (v < bl ? 6 : 0) : mx === v ? (bl - r) / d + 2 : (r - v) / d + 4;
    hp /= 6;
  }
  const hsl = (h, sa, l) => {
    const q = l < 0.5 ? l * (1 + sa) : l + sa - l * sa, pp = 2 * l - q;
    const can = (t) => {
      t = (t + 1) % 1;
      if (t < 1 / 6) return pp + (q - pp) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return pp + (q - pp) * (2 / 3 - t) * 6;
      return pp;
    };
    return '#' + [can(h + 1 / 3), can(h), can(h - 1 / 3)]
      .map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('');
  };
  /* LA LUMIÈRE VA VERS LE JAUNE, L'OMBRE S'EN ÉLOIGNE — et c'est vrai de n'importe quelle teinte,
     pas seulement du vert. Une première version tournait « vers le bleu-vert » en dur : elle allait
     aux Ardennes et transformait les frondaisons rousses de Silverstone en magenta. Le soleil est
     jaune, donc une surface éclairée tire vers 60° et une surface à l'ombre tire à l'opposé, par
     le plus court chemin. Pour un vert (120°) ça donne du jaune-vert et du bleu-vert ; pour un
     roux (25°), du jaune-orangé et du rouge profond. Les deux sont justes, et c'est la même règle. */
  const JAUNE = 60 / 360;
  let vers = JAUNE - hp;                       // le plus court chemin vers le jaune, signé
  if (vers > 0.5) vers -= 1; else if (vers < -0.5) vers += 1;
  const sens = vers === 0 ? 1 : Math.sign(vers);
  const dispo = Math.abs(vers) * 360;          // on ne dépasse pas le jaune : au-delà, la couleur change de nom
  const pas = [[-52, -0.40, 0.12], [-24, -0.21, 0.05], [0, 0, 0], [20, 0.15, 0.03], [38, 0.30, 0.06]];
  return pas.map(([dh, dl, ds]) => hsl(
    (hp + sens * (dh > 0 ? Math.min(dh, dispo) : dh) / 360 + 1) % 1,
    Math.max(0.22, Math.min(0.70, sp + ds + 0.10)),
    Math.max(0.10, Math.min(0.72, lp + dl))));
}

/* LA GRAPPE EST TIRÉE UNE FOIS et resservie par chaque passe. Retirer les lobes à chaque passe
   donnait une couronne qui se délite : les aplats ne se superposaient plus, et le contour du
   dessus n'avait plus rien à voir avec celui du dessous. */
function couronne(g, cx, cy, r, verts, graine, opts) {
  const o = opts || {};
  const rnd = propRng(graine);
  const n = o.lobes || (5 + Math.floor(rnd() * 3));
  const lobes = [{ x: cx, y: cy, r: r * 0.66, ph: rnd() * 6 }];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + (rnd() - 0.5) * 0.7;
    const d = r * (0.28 + rnd() * 0.3);
    lobes.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, r: r * (0.40 + rnd() * 0.22), ph: rnd() * 6 });
  }
  /* LES PASSES CONVERGENT VERS UN POINT DE LUMIÈRE, elles ne sont pas décalées en bloc.

     Décalées en bloc, chaque lobe gardait sa propre tache claire et la couronne se lisait comme un
     bouquet de brocolis. En ramenant chaque lobe vers le même point haut-gauche, un peu plus à
     chaque passe, les taches se rejoignent : il n'y a plus qu'UNE masse éclairée qui traverse la
     couronne, et le sombre ne reste qu'en liseré du côté opposé. C'est ce que fait la planche. */
  const px = cx - r * 0.32, py = cy - r * 0.32;
  const passe = (col, k, t) => {
    for (const L of lobes) {
      blob(g, L.x + (px - L.x) * t, L.y + (py - L.y) * t, L.r * k, 9, col, 0.17, L.ph);
    }
  };
  passe(verts[0], 1.00, 0);
  passe(verts[1], 0.94, 0.18);
  passe(verts[2], 0.85, 0.38);
  passe(verts[3], 0.70, 0.58);
  passe(verts[4], 0.30, 0.84);      // une touche, pas une calotte : sinon l'arbre devient un œuf
}

/* UN CONIFÈRE GARDE SA POINTE. Vu de quatre-vingt-dix degrés il n'est qu'une rosette, et la
   planche de référence ne le dessine pas comme ça : elle en fait une goutte dentelée, pointe en
   haut. Elle a raison et c'est volontaire — la pointe est ce qui dit « conifère » d'un coup d'œil,
   et les objets sont peints dans le repère de l'ÉCRAN, jamais tournés, donc tous les conifères
   pointent du même côté comme sur la planche. */
function conifere(g, cx, cy, r, tons, graine) {
  const rnd = propRng(graine);
  /* UN ÉTAGE EST UN TRIANGLE À BORDS EN DENTS DE SCIE, construit point par point et fermé en
     lignes droites. Les courbes avaient donné une tente lisse : ce qui dit « conifère » vu de
     dessus, c'est l'arête dentelée, et une dent est un angle, pas un bombement. On descend de la
     pointe vers la base d'un côté, on remonte de l'autre, et entre deux points on ressort d'un
     tiers — la dent. Trois étages emboîtés, du sombre au clair, chacun plus court et remonté. */
  const etage = (col, haut, demi, bas, dents) => {
    const cote = (sens) => {
      const out = [];
      for (let i = 1; i <= dents; i++) {
        const t0 = (i - 1) / dents, t1 = i / dents, tm = (t0 + t1) / 2;
        const saillie = 1.34 + rnd() * 0.22;
        out.push([cx + sens * demi * tm * saillie, haut + (bas - haut) * tm]);   // la pointe
        out.push([cx + sens * demi * t1, haut + (bas - haut) * t1]);             // le creux
      }
      return out;
    };
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(cx, haut);
    for (const [x, y] of cote(1)) g.lineTo(x, y);
    g.lineTo(cx, bas - (bas - haut) * 0.16);          // le creux sous l'arbre, entre les deux côtés
    for (const [x, y] of cote(-1).reverse()) g.lineTo(x, y);
    g.closePath(); g.fill();
  };
  etage(tons[0], cy - r * 1.15, r * 0.74, cy + r * 0.55, 5);
  etage(tons[1], cy - r * 1.00, r * 0.52, cy + r * 0.30, 4);
  etage(tons[2], cy - r * 0.80, r * 0.28, cy + r * 0.02, 3);
}

/** Quelques fleurs posées sur un buisson ou dans l'herbe — trois pétales et un cœur, pas plus. */
function fleurs(g, cx, cy, r, n, col, graine) {
  const rnd = propRng(graine);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * r;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, s = r * (0.09 + rnd() * 0.05);
    g.fillStyle = col;
    for (let k = 0; k < 4; k++) {
      const b = k / 4 * Math.PI * 2 + rnd();
      g.beginPath(); g.arc(x + Math.cos(b) * s * 0.7, y + Math.sin(b) * s * 0.7, s * 0.62, 0, 7); g.fill();
    }
    g.fillStyle = 'rgba(250,228,120,0.95)';
    g.beginPath(); g.arc(x, y, s * 0.4, 0, 7); g.fill();
  }
}

// `draw` works in a square of side `w` pixels, centred, with the palette of the circuit.
const TOP_KINDS = [
  {
    id: 'tree', wm: 9.0, weight: 7, near: 7, far: 26,
    draw(g, w, pal) {
      couronne(g, w / 2, w / 2, w * 0.44, versFeuillage(pal.canopy), 0x51ee);
    },
  },
  {
    // Le voisin : plus petit, moins de lobes, une autre graine. Deux arbres identiques alignés le
    // long d'une route se voient tout de suite — c'est à ça que sert le second.
    id: 'tree2', wm: 6.8, weight: 6, near: 7, far: 26,
    draw(g, w, pal) {
      couronne(g, w / 2, w / 2, w * 0.45, versFeuillage(pal.canopy), 0x9a37, { lobes: 5 });
    },
  },
  {
    fixe: 1, id: 'pine', wm: 6.0, weight: 6, near: 7, far: 26,
    draw(g, w, pal) {
      const p = pal.pine;
      conifere(g, w / 2, w * 0.52, w * 0.42, [p[0], p[1], teinte(p[1], 1.3)], 0x2b7c);
    },
  },
  {
    // Un buisson, c'est une petite couronne — et de temps en temps des fleurs, qui sont la seule
    // tache claire du bas-côté et donnent l'échelle du reste.
    id: 'bush', wm: 3.4, weight: 5, near: 6, far: 22,
    draw(g, w, pal) {
      couronne(g, w / 2, w / 2, w * 0.42, versFeuillage(pal.canopy), 0x3c11, { lobes: 4 });
      fleurs(g, w / 2, w / 2, w * 0.26, 3, 'rgba(252,250,244,0.95)', 0x77a1);
    },
  },
  {
    /* L'HERBE N'EST PAS UNE TEXTURE DE FOND, c'est un objet comme un autre. Semée dru et très
       petite, elle casse l'aplat vert sans qu'on la remarque — et comme elle passe par le même
       semeur, elle évite la route et les autres objets toute seule. */
    id: 'touffe', wm: 2.8, weight: 0, near: 0.2, far: 9,
    draw(g, w, pal) {
      const rnd = propRng(0x5e21), c = w / 2;
      const verts = versFeuillage(pal.canopy);
      for (let i = 0; i < 7; i++) {
        const x = c + (rnd() - 0.5) * w * 0.7, y = c + (rnd() - 0.5) * w * 0.55;
        const h = w * (0.22 + rnd() * 0.22), pen = (rnd() - 0.5) * w * 0.18;
        g.strokeStyle = i % 3 === 0 ? verts[2] : verts[1];
        g.lineWidth = w * 0.07; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x, y + h / 2);
        g.quadraticCurveTo(x + pen * 0.5, y, x + pen, y - h / 2);
        g.stroke();
      }
    },
  },
  {
    // Et des fleurs des champs, plus rares : blanc, jaune, rouge, comme sur la planche.
    id: 'fleurs', wm: 3.0, weight: 0, near: 0.2, far: 8,
    draw(g, w, pal) {
      const verts = versFeuillage(pal.canopy);
      g.strokeStyle = verts[1]; g.lineWidth = w * 0.06; g.lineCap = 'round';
      const rnd = propRng(0x1d4f);
      for (let i = 0; i < 4; i++) {
        const x = w / 2 + (rnd() - 0.5) * w * 0.6;
        g.beginPath(); g.moveTo(x, w * 0.78); g.lineTo(x + (rnd() - 0.5) * w * 0.1, w * 0.42); g.stroke();
      }
      fleurs(g, w / 2, w * 0.42, w * 0.3, 4, pal.fleur || 'rgba(252,250,244,0.95)', 0x6b02);
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
    fixe: 1, id: 'logs', wm: 6.0, weight: 2, near: 7, far: 18,
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
    fixe: 1, id: 'house', wm: 7.5, weight: 0, near: 8, far: 26,
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
    fixe: 1, id: 'house2', wm: 6.5, weight: 0, near: 8, far: 24,
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
    fixe: 1, id: 'chapel', wm: 7.0, weight: 0, near: 9, far: 24,
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

/* Bake each object once per palette. L'ombre est cuite avec lui.

   ELLE EST BLEU-VIOLET, PAS NOIRE. Une ombre grise ou brune salit la couleur qu'elle recouvre ;
   l'animation la peint en bleu froid, qui est à la fois la couleur du ciel diffus et le
   complément du vert. C'est ce qui fait tenir ensemble le feuillage et le sol. */
function buildTopArt(pal) {
  const art = {};
  /* LE SPRITE PASSE DEVANT L'OBJET PEINT, et il garde l'ombre de sa planche. Lui en cuire une
     seconde par-dessus — le réflexe, puisque c'est ce qu'on fait pour les objets peints — plantait
     deux ombres décalées sous chaque arbre. `wm` tient compte du rapport du fichier : un sprite
     n'est pas carré, et l'étirer dans un carré écrasait les fougères. */
  for (const k of KINDS_DESSINES) {
    const img = ART_DESSINE[k.id];
    if (!img) continue;
    /* LE TON SE CUIT, il ne se calcule pas à l'image. `ctx.filter = 'brightness(…)'` aurait suffi
       et aurait coûté un filtre par objet et par image — sept mille fois par trame — là où quatre
       toiles cuites une fois servent toute la course. Et `filter` n'est pas sûr sur les Safari
       anciens, qui sont précisément les téléphones qu'on vise. */
    const tons = [];
    for (const f of ECARTS_TON) {
      if (f === 1) { tons.push(img); continue; }
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g2 = c.getContext('2d');
      g2.drawImage(img, 0, 0);
      // on éclaircit ou on assombrit SANS toucher à l'alpha : `source-atop` ne peint que ce qui
      // est déjà là, donc le contour découpé reste net
      g2.globalCompositeOperation = 'source-atop';
      g2.globalAlpha = Math.abs(1 - f) * 1.6;
      g2.fillStyle = f > 1 ? '#ffffff' : '#000022';
      g2.fillRect(0, 0, c.width, c.height);
      tons.push(c);
    }
    art[k.id] = { canvas: img, tons, wm: k.wm, hm: k.wm * (img.naturalHeight / img.naturalWidth) };
  }
  for (const k of TOP_KINDS) {
    if (art[k.id]) continue;
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
    sg.fillStyle = pal.ombre || 'rgba(74,96,152,0.30)';
    sg.fillRect(0, 0, w, w);
    g.drawImage(sil, pad - w * 0.12, pad + w * 0.14);
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
/* Ce qui n'a PAS de sprite dessiné reste peint, et se mélange aux autres. Le conifère, le palmier,
   les bottes de paille, le tas de rondins et les maisons n'étaient pas sur la planche découpée ;
   les retirer d'office aurait vidé la forêt des Ardennes de ses sapins. Tant qu'ils cohabitent, le
   décor est mixte et ça se voit — c'est le prix de l'étape, pas un état d'arrivée. */
const SANS_DESSIN = ['pine', 'palm', 'logs', 'bales', 'house', 'house2', 'chapel'];
function kindsActifs() {
  if (!decorPret()) return TOP_KINDS;
  return KINDS_DESSINES.concat(TOP_KINDS.filter((k) => SANS_DESSIN.indexOf(k.id) >= 0));
}

function placeTopProps(track, id, density, weights, serre, lisiere, profond) {
  /* LE POIDS D'UN THÈME PORTE SUR LA FAMILLE, pas sur le fichier. `js/render.js` dit « pas de
     palmiers dans les Ardennes » en nommant `palm`, `tree`, `bush` — un vocabulaire qui existait
     avant les sprites et qui doit survivre, sinon chaque nouveau dessin obligerait à reprendre les
     douze thèmes. Chaque sprite déclare donc sa famille, et c'est elle qu'on pèse. */
  let kinds = kindsActifs();
  if (weights) {
    kinds = kinds
      .map((k) => { const w = weights[k.id] != null ? weights[k.id] : weights[k.famille];
        return w == null ? k : Object.assign({}, k, { weight: k.weight ? k.weight * w : w }); })
      .filter((k) => k.weight > 0);
    if (!kinds.length) kinds = kindsActifs();
  } else {
    kinds = kinds.filter((k) => k.weight > 0);
  }
  return placeFrom(kinds, track, seedFromId('top-' + id), density == null ? 0.85 : density, 6, serre, lisiere, profond);
}

/* L'HERBE SE SÈME À PART, et c'est le seul moyen d'en avoir sans perdre des arbres.

   Mise dans le même tirage que les arbres, une touffe à poids fort leur prend leur place : le
   semeur pose UN objet par pas et par côté, donc tout ce qu'on ajoute au mélange retire autre
   chose. Les deux passes se marchent un peu dessus — le second semeur ne connaît pas les objets du
   premier — et c'est voulu : une touffe d'herbe au pied d'un arbre est exactement ce que fait la
   planche de référence. Elle reste dessous, parce qu'elle est dessinée avant. */
const AU_SOL = { touffe: 3, 'touffe-mini': 2, 'fleurs-jaunes': 1, 'fleurs-blanches': 1,
  'fleurs-rouges': 1, caillou: 0.6, 'buisson-mini': 0.8, fleurs: 1 };
function placeGroundProps(track, id, density) {
  const source = decorPret() ? KINDS_DESSINES : TOP_KINDS;
  const petits = source.filter((k) => AU_SOL[k.id] != null)
    .map((k) => Object.assign({}, k, { weight: AU_SOL[k.id] }));
  if (!petits.length) return [];
  /* `clear` tombe à zéro : le semeur refusait tout ce qui approchait la route de moins de huit
     mètres et demi, ce qui mettait l'herbe PLUS LOIN que la bande qu'elle doit garnir. Une touffe
     n'est pas un obstacle ; elle a le droit d'être au bord. */
  return placeFrom(petits, track, seedFromId('herbe-' + id), density == null ? 1 : density, 0);
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
