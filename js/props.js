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
      /* PAS DE ROTATION. Un feuillage dessiné porte sa lumière — clair en haut à gauche, ombre en
         bas à droite. Le tourner retourne l'éclairage, et une forêt dont chaque arbre est éclairé
         d'un côté différent est précisément ce qui se lisait comme du chaos. Les arbres n'ont
         qu'une orientation. Le champ reste, à zéro, pour que le dessin n'ait pas deux chemins. */
      out.push({ x, y, id: k.id, ech, rot: 0,
        ton: Math.min(TONS - 1, Math.floor(rnd() * TONS)),
        om: Math.floor(rnd() * OMBRES_DESSIN.length) });
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
/* LES OMBRES SONT UNE COUCHE À PART, et ce n'est pas qu'une question de dessin.

   Cuite dans le sprite, une ombre est AU-DESSUS des voisins : un arbre projette la sienne sur
   l'arbre d'à côté au lieu de la poser au sol, et dans une forêt dense c'est la moitié des ombres
   qui sont au mauvais endroit. Elle est aussi figée en taille, en position et en opacité.

   Séparées, elles se dessinent toutes AVANT la végétation : elles passent donc sous tout, ce qui
   est la seule place juste pour une ombre vue de dessus. Elles sont translucides, donc deux
   couronnes voisines assombrissent un peu leur recouvrement, comme sur un vrai sous-bois.

   Les rochers, les souches et les fleurs gardent la leur, cuite : ils sont gris-bleu, c'est-à-dire
   exactement la couleur qu'on retire, et les découper proprement aurait mangé la pierre. `cuite`
   dit au moteur de ne pas leur en ajouter une seconde. */
const OMBRES_DESSIN = [
  'art/decor/ombre-1.webp',
  'art/decor/ombre-2.webp',
  'art/decor/ombre-3.webp',
  'art/decor/ombre-4.webp',
  'art/decor/ombre-5.webp',
  'art/decor/ombre-6.webp',
  'art/decor/ombre-7.webp',
];

/* ------------------------------------------------------------------- LE MOBILIER DE BORD DE PISTE

   Une glissière, un muret, une barrière de bois ne se SÈMENT pas : ils SUIVENT. Le semeur par
   strates répartit des objets dans une bande ; une barrière est une ligne continue, elle a une
   longueur, une direction, et le trou entre deux tronçons se voit immédiatement.

   Chaque tuile couvre quelques mètres de piste et se pose tournée dans le sens de la marche. C'est
   la seule famille d'objets qu'on tourne : un arbre n'a pas de direction, une glissière n'est que
   ça. Le pas de pose est un peu plus court que la tuile, pour que la corde d'un virage ne laisse
   pas apparaître le joint. */
const MOBILIER = [
  { id: 'glissiere', f: 'art/decor/glissiere.webp', wm: 14.0, px: [256, 47] },
  { id: 'glissiere2', f: 'art/decor/glissiere2.webp', wm: 14.0, px: [256, 42] },
  { id: 'barriere-bois', f: 'art/decor/barriere-bois.webp', wm: 14.0, px: [256, 47] },
  { id: 'muret', f: 'art/decor/muret.webp', wm: 15.0, px: [256, 43] },
];

const KINDS_DESSINES = [
  { famille: 'tree', id: 'arbre-1', f: 'art/decor/arbre-1.webp', wm: 11, anc: 0.56, weight: 6, near: 1, far: 24 },
  { famille: 'tree', id: 'arbre-2', f: 'art/decor/arbre-2.webp', wm: 10, anc: 0.56, weight: 6, near: 1, far: 24 },
  { famille: 'tree', id: 'arbre-3', f: 'art/decor/arbre-3.webp', wm: 10.5, anc: 0.56, weight: 6, near: 1, far: 24 },
  { famille: 'tree', id: 'arbre-4', f: 'art/decor/arbre-4.webp', wm: 10.5, anc: 0.56, weight: 6, near: 1, far: 24 },
  { famille: 'tree', id: 'arbre-5', f: 'art/decor/arbre-5.webp', wm: 9.5, anc: 0.56, weight: 6, near: 1, far: 24 },
  { famille: 'tree', id: 'arbre-6', f: 'art/decor/arbre-6.webp', wm: 10, anc: 0.56, weight: 6, near: 1, far: 24 },
  { famille: 'tree', id: 'arbre-7', f: 'art/decor/arbre-7.webp', wm: 10.5, anc: 0.56, weight: 6, near: 1, far: 24 },
  { famille: 'tree', id: 'arbre-8', f: 'art/decor/arbre-8.webp', wm: 10, anc: 0.56, weight: 6, near: 1, far: 24 },
  { famille: 'tree', id: 'arbre-9', f: 'art/decor/arbre-9.webp', wm: 10, anc: 0.56, weight: 6, near: 1, far: 24 },
  { famille: 'pine', id: 'sapin-1', f: 'art/decor/sapin-1.webp', wm: 5.4, anc: 0.88, weight: 4, near: 1, far: 24 },
  { famille: 'pine', id: 'sapin-2', f: 'art/decor/sapin-2.webp', wm: 5.6, anc: 0.88, weight: 4, near: 1, far: 24 },
  { famille: 'pine', id: 'sapin-3', f: 'art/decor/sapin-3.webp', wm: 6.2, anc: 0.88, weight: 4, near: 1, far: 24 },
  { famille: 'pine', id: 'sapin-4', f: 'art/decor/sapin-4.webp', wm: 4.4, anc: 0.88, weight: 4, near: 1, far: 24 },
  { famille: 'pine', id: 'sapin-5', f: 'art/decor/sapin-5.webp', wm: 3.4, anc: 0.88, weight: 4, near: 1, far: 24 },
  { famille: 'pine', id: 'sapin-6', f: 'art/decor/sapin-6.webp', wm: 5.0, anc: 0.88, weight: 4, near: 1, far: 24 },
  { famille: 'pine', id: 'sapin-7', f: 'art/decor/sapin-7.webp', wm: 5.8, anc: 0.88, weight: 4, near: 1, far: 24 },
  { famille: 'pine', id: 'sapin-8', f: 'art/decor/sapin-8.webp', wm: 5.6, anc: 0.88, weight: 4, near: 1, far: 24 },
  { famille: 'pine', id: 'sapin-9', f: 'art/decor/sapin-9.webp', wm: 3.2, anc: 0.88, weight: 4, near: 1, far: 24 },
  { famille: 'bush', id: 'buisson-1', f: 'art/decor/buisson-1.webp', wm: 4.6, anc: 0.58, weight: 3, near: 1, far: 24 },
  { famille: 'bush', id: 'buisson-2', f: 'art/decor/buisson-2.webp', wm: 4.2, anc: 0.58, weight: 3, near: 1, far: 24 },
  { famille: 'bush', id: 'buisson-3', f: 'art/decor/buisson-3.webp', wm: 4.8, anc: 0.58, weight: 3, near: 1, far: 24 },
  { famille: 'bush', id: 'buisson-4', f: 'art/decor/buisson-4.webp', wm: 4.0, anc: 0.58, weight: 3, near: 1, far: 24 },
  { famille: 'bush', id: 'buisson-5', f: 'art/decor/buisson-5.webp', wm: 5.0, anc: 0.58, weight: 3, near: 1, far: 24 },
  { famille: 'bush', id: 'buisson-6', f: 'art/decor/buisson-6.webp', wm: 3.6, anc: 0.58, weight: 3, near: 1, far: 24 },
  { famille: 'bush', id: 'buisson-7', f: 'art/decor/buisson-7.webp', wm: 3.8, anc: 0.58, weight: 3, near: 1, far: 24 },
  { famille: 'bush', id: 'buisson-8', f: 'art/decor/buisson-8.webp', wm: 3.4, anc: 0.58, weight: 3, near: 1, far: 24 },
  { famille: 'bush', id: 'buisson-9', f: 'art/decor/buisson-9.webp', wm: 3.0, anc: 0.58, weight: 3, near: 1, far: 24 },
  { famille: 'bush', id: 'buisson-10', f: 'art/decor/buisson-10.webp', wm: 3.0, anc: 0.58, weight: 3, near: 1, far: 24 },
  { famille: 'bush', id: 'buisson-fleuri-jaune', f: 'art/decor/buisson-fleuri-jaune.webp', wm: 3.0, anc: 0.58, weight: 3, near: 1, far: 24 },
  { famille: 'bush', id: 'buisson-fleuri-rouge', f: 'art/decor/buisson-fleuri-rouge.webp', wm: 2.8, anc: 0.58, weight: 3, near: 1, far: 24 },
  { famille: 'bush', id: 'buisson-fleuri-vert', f: 'art/decor/buisson-fleuri-vert.webp', wm: 2.4, anc: 0.58, weight: 3, near: 1, far: 24 },
  { famille: 'bush', id: 'buisson-mini-1', f: 'art/decor/buisson-mini-1.webp', wm: 2.2, anc: 0.58, weight: 0, near: 1, far: 24 },
  { famille: 'bush', id: 'buisson-mini-2', f: 'art/decor/buisson-mini-2.webp', wm: 2.0, anc: 0.58, weight: 0, near: 1, far: 24 },
  { famille: 'bush', id: 'buisson-mini-3', f: 'art/decor/buisson-mini-3.webp', wm: 1.9, anc: 0.58, weight: 0, near: 1, far: 24 },
  { famille: 'bush', id: 'buisson-mini-4', f: 'art/decor/buisson-mini-4.webp', wm: 1.7, anc: 0.58, weight: 0, near: 1, far: 24 },
  { famille: 'rock', id: 'rocher-1', f: 'art/decor/rocher-1.webp', wm: 3.6, anc: 0.62, cuite: 1, weight: 1.5, near: 1, far: 24 },
  { famille: 'rock', id: 'rocher-2', f: 'art/decor/rocher-2.webp', wm: 2.6, anc: 0.62, cuite: 1, weight: 1.5, near: 1, far: 24 },
  { famille: 'rock', id: 'rocher-3', f: 'art/decor/rocher-3.webp', wm: 4.4, anc: 0.62, cuite: 1, weight: 1.5, near: 1, far: 24 },
  { famille: 'rock', id: 'caillou', f: 'art/decor/caillou.webp', wm: 1.6, anc: 0.62, cuite: 1, weight: 0, near: 1, far: 24 },
  { famille: 'logs', id: 'souche', f: 'art/decor/souche.webp', wm: 2.2, anc: 0.64, cuite: 1, weight: 0, near: 1, far: 24 },
  { famille: 'logs', id: 'rondin', f: 'art/decor/rondin.webp', wm: 3.0, anc: 0.62, cuite: 1, weight: 0, near: 1, far: 24 },
  { famille: 'logs', id: 'branche', f: 'art/decor/branche.webp', wm: 3.0, anc: 0.62, cuite: 1, weight: 0, near: 1, far: 24 },
  { famille: 'bush', id: 'herbe-1', f: 'art/decor/herbe-1.webp', wm: 1.6, anc: 0.72, cuite: 1, weight: 0, near: 1, far: 24 },
  { famille: 'bush', id: 'herbe-2', f: 'art/decor/herbe-2.webp', wm: 1.5, anc: 0.72, cuite: 1, weight: 0, near: 1, far: 24 },
  { famille: 'bush', id: 'herbe-3', f: 'art/decor/herbe-3.webp', wm: 1.5, anc: 0.72, cuite: 1, weight: 0, near: 1, far: 24 },
  { famille: 'bush', id: 'fleurs-blanches', f: 'art/decor/fleurs-blanches.webp', wm: 2.6, anc: 0.68, cuite: 1, weight: 0, near: 1, far: 24 },
  { famille: 'bush', id: 'fleurs-jaunes', f: 'art/decor/fleurs-jaunes.webp', wm: 2.4, anc: 0.68, cuite: 1, weight: 0, near: 1, far: 24 },
  { famille: 'bush', id: 'fleurs-rouges', f: 'art/decor/fleurs-rouges.webp', wm: 2.4, anc: 0.68, cuite: 1, weight: 0, near: 1, far: 24 },
  { famille: 'bush', id: 'fleurs-blanches2', f: 'art/decor/fleurs-blanches2.webp', wm: 2.4, anc: 0.68, cuite: 1, weight: 0, near: 1, far: 24 },


  /* ------------------------------------------------------------------- LA PLANCHE D'AUTOMNE

     Mêmes règles, autre saison. Le préfixe `a-` évite la collision de noms avec la planche d'été
     — `arbre-1` existe dans les deux — et rend lisible, dans une strate, de quelle planche on
     parle.

     Ici l'ombre reste CUITE. Celle d'été a été détachée parce qu'un arbre ombrait son voisin au
     lieu du sol ; sur cette planche-ci elle est déjà posée en bas à gauche, du bon côté par
     rapport au soleil qu'on s'est donné, et la détacher demanderait de redessiner ce qui est
     juste. Le prix est le même défaut, et il ne se distingue pas à cette densité.

     La LITIÈRE est la famille nouvelle : des tas de feuilles au sol, qui sont à l'automne ce que
     l'herbe est à l'été. C'est elle qu'il faudra faire tourbillonner au passage d'une voiture ;
     pour l'instant elle se contente de joncher.

     Les fichiers et les tailles sortent de `tools/automne.py`, qui écrit aussi son manifeste. */
  { famille: 'tree', id: 'a-arbre-1', f: 'art/decor/automne/arbre-1.webp', wm: 12.0, anc: 0.56, cuite: 1, weight: 6, near: 1, far: 24 },
  { famille: 'tree', id: 'a-arbre-3', f: 'art/decor/automne/arbre-3.webp', wm: 11.5, anc: 0.56, cuite: 1, weight: 6, near: 1, far: 24 },
  { famille: 'tree', id: 'a-arbre-4', f: 'art/decor/automne/arbre-4.webp', wm: 11.5, anc: 0.56, cuite: 1, weight: 6, near: 1, far: 24 },
  { famille: 'tree', id: 'a-arbre-6', f: 'art/decor/automne/arbre-6.webp', wm: 9.5, anc: 0.56, cuite: 1, weight: 6, near: 1, far: 24 },
  { famille: 'tree', id: 'a-arbre-nu-1', f: 'art/decor/automne/arbre-nu-1.webp', wm: 9.5, anc: 0.58, cuite: 1, weight: 6, near: 1, far: 24 },
  { famille: 'pine', id: 'a-conifere-1', f: 'art/decor/automne/conifere-1.webp', wm: 4.0, anc: 0.8, cuite: 1, weight: 4, near: 1, far: 24 },
  { famille: 'pine', id: 'a-conifere-2', f: 'art/decor/automne/conifere-2.webp', wm: 4.0, anc: 0.8, cuite: 1, weight: 4, near: 1, far: 24 },
  { famille: 'pine', id: 'a-conifere-4', f: 'art/decor/automne/conifere-4.webp', wm: 3.4, anc: 0.8, cuite: 1, weight: 4, near: 1, far: 24 },
  { famille: 'pine', id: 'a-conifere-5', f: 'art/decor/automne/conifere-5.webp', wm: 4.2, anc: 0.8, cuite: 1, weight: 4, near: 1, far: 24 },
  { famille: 'pine', id: 'a-conifere-6', f: 'art/decor/automne/conifere-6.webp', wm: 3.4, anc: 0.8, cuite: 1, weight: 4, near: 1, far: 24 },
  { famille: 'bush', id: 'a-arbuste-1', f: 'art/decor/automne/arbuste-1.webp', wm: 3.4, anc: 0.66, cuite: 1, weight: 2, near: 1, far: 24 },
  { famille: 'bush', id: 'a-arbuste-2', f: 'art/decor/automne/arbuste-2.webp', wm: 3.2, anc: 0.66, cuite: 1, weight: 2, near: 1, far: 24 },
  { famille: 'bush', id: 'a-arbuste-3', f: 'art/decor/automne/arbuste-3.webp', wm: 3.0, anc: 0.66, cuite: 1, weight: 2, near: 1, far: 24 },
  { famille: 'bush', id: 'a-arbuste-4', f: 'art/decor/automne/arbuste-4.webp', wm: 2.8, anc: 0.66, cuite: 1, weight: 2, near: 1, far: 24 },
  { famille: 'bush', id: 'a-arbuste-5', f: 'art/decor/automne/arbuste-5.webp', wm: 2.2, anc: 0.66, cuite: 1, weight: 2, near: 1, far: 24 },
  { famille: 'bush', id: 'a-arbuste-6', f: 'art/decor/automne/arbuste-6.webp', wm: 2.8, anc: 0.66, cuite: 1, weight: 2, near: 1, far: 24 },
  { famille: 'bush', id: 'a-arbuste-7', f: 'art/decor/automne/arbuste-7.webp', wm: 2.4, anc: 0.66, cuite: 1, weight: 2, near: 1, far: 24 },
  { famille: 'bush', id: 'a-arbuste-8', f: 'art/decor/automne/arbuste-8.webp', wm: 2.4, anc: 0.66, cuite: 1, weight: 2, near: 1, far: 24 },
  { famille: 'bush', id: 'a-touffe-1', f: 'art/decor/automne/touffe-1.webp', wm: 4.2, anc: 0.7, cuite: 1, weight: 2, near: 1, far: 24 },
  { famille: 'bush', id: 'a-touffe-2', f: 'art/decor/automne/touffe-2.webp', wm: 4.4, anc: 0.7, cuite: 1, weight: 2, near: 1, far: 24 },
  { famille: 'bush', id: 'a-touffe-3', f: 'art/decor/automne/touffe-3.webp', wm: 4.0, anc: 0.7, cuite: 1, weight: 2, near: 1, far: 24 },
  { famille: 'bush', id: 'a-touffe-4', f: 'art/decor/automne/touffe-4.webp', wm: 4.0, anc: 0.7, cuite: 1, weight: 2, near: 1, far: 24 },
  { famille: 'bush', id: 'a-touffe-5', f: 'art/decor/automne/touffe-5.webp', wm: 3.8, anc: 0.7, cuite: 1, weight: 2, near: 1, far: 24 },
  { famille: 'bush', id: 'a-touffe-6', f: 'art/decor/automne/touffe-6.webp', wm: 2.0, anc: 0.7, cuite: 1, weight: 2, near: 1, far: 24 },
  { famille: 'bush', id: 'a-touffe-7', f: 'art/decor/automne/touffe-7.webp', wm: 2.0, anc: 0.7, cuite: 1, weight: 2, near: 1, far: 24 },
  { famille: 'bush', id: 'a-touffe-8', f: 'art/decor/automne/touffe-8.webp', wm: 2.2, anc: 0.7, cuite: 1, weight: 2, near: 1, far: 24 },
  { famille: 'grass', id: 'a-herbe-1', f: 'art/decor/automne/herbe-1.webp', wm: 2.0, anc: 0.74, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'grass', id: 'a-herbe-2', f: 'art/decor/automne/herbe-2.webp', wm: 1.8, anc: 0.74, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'grass', id: 'a-herbe-3', f: 'art/decor/automne/herbe-3.webp', wm: 1.8, anc: 0.74, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'grass', id: 'a-herbe-4', f: 'art/decor/automne/herbe-4.webp', wm: 1.6, anc: 0.74, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'grass', id: 'a-plant-1', f: 'art/decor/automne/plant-1.webp', wm: 2.0, anc: 0.74, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'grass', id: 'a-plant-2', f: 'art/decor/automne/plant-2.webp', wm: 1.8, anc: 0.74, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'grass', id: 'a-plant-3', f: 'art/decor/automne/plant-3.webp', wm: 2.2, anc: 0.74, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'grass', id: 'a-plant-4', f: 'art/decor/automne/plant-4.webp', wm: 1.8, anc: 0.74, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'grass', id: 'a-plant-5', f: 'art/decor/automne/plant-5.webp', wm: 1.6, anc: 0.74, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'grass', id: 'a-plant-6', f: 'art/decor/automne/plant-6.webp', wm: 1.8, anc: 0.74, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'litter', id: 'a-feuilles-1', f: 'art/decor/automne/feuilles-1.webp', wm: 3.6, anc: 0.5, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'litter', id: 'a-feuilles-2', f: 'art/decor/automne/feuilles-2.webp', wm: 3.8, anc: 0.5, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'litter', id: 'a-feuilles-3', f: 'art/decor/automne/feuilles-3.webp', wm: 3.0, anc: 0.5, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'litter', id: 'a-feuilles-4', f: 'art/decor/automne/feuilles-4.webp', wm: 2.6, anc: 0.5, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'litter', id: 'a-feuilles-5', f: 'art/decor/automne/feuilles-5.webp', wm: 2.2, anc: 0.5, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'litter', id: 'a-feuilles-6', f: 'art/decor/automne/feuilles-6.webp', wm: 2.4, anc: 0.5, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'litter', id: 'a-feuilles-7', f: 'art/decor/automne/feuilles-7.webp', wm: 2.0, anc: 0.5, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'litter', id: 'a-feuilles-8', f: 'art/decor/automne/feuilles-8.webp', wm: 1.8, anc: 0.5, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'litter', id: 'a-feuille-1', f: 'art/decor/automne/feuille-1.webp', wm: 0.7, anc: 0.5, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'litter', id: 'a-feuille-2', f: 'art/decor/automne/feuille-2.webp', wm: 0.7, anc: 0.5, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'litter', id: 'a-feuille-3', f: 'art/decor/automne/feuille-3.webp', wm: 0.7, anc: 0.5, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'litter', id: 'a-feuille-4', f: 'art/decor/automne/feuille-4.webp', wm: 0.9, anc: 0.5, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'rock', id: 'a-rocher-1', f: 'art/decor/automne/rocher-1.webp', wm: 3.2, anc: 0.62, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'rock', id: 'a-rocher-2', f: 'art/decor/automne/rocher-2.webp', wm: 3.0, anc: 0.62, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'rock', id: 'a-rocher-3', f: 'art/decor/automne/rocher-3.webp', wm: 2.6, anc: 0.62, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'rock', id: 'a-rocher-4', f: 'art/decor/automne/rocher-4.webp', wm: 1.6, anc: 0.62, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'rock', id: 'a-rocher-5', f: 'art/decor/automne/rocher-5.webp', wm: 2.4, anc: 0.62, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'rock', id: 'a-souche-1', f: 'art/decor/automne/souche-1.webp', wm: 2.2, anc: 0.68, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'rock', id: 'a-souche-2', f: 'art/decor/automne/souche-2.webp', wm: 1.8, anc: 0.68, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'rock', id: 'a-rondin-1', f: 'art/decor/automne/rondin-1.webp', wm: 3.4, anc: 0.62, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'rock', id: 'a-rondin-2', f: 'art/decor/automne/rondin-2.webp', wm: 2.8, anc: 0.62, cuite: 1, weight: 1, near: 1, far: 24 },
  { famille: 'rock', id: 'a-rondin-3', f: 'art/decor/automne/rondin-3.webp', wm: 2.6, anc: 0.62, cuite: 1, weight: 1, near: 1, far: 24 },
];

/* Les images, chargées une fois. Tant qu'elles ne sont pas là, `buildTopArt` retombe sur les
   objets peints : une course qui démarre pendant le chargement montre un décor peint plutôt
   qu'un décor vide, et `aPeint` dira plus tard de refaire la cuisson. */
/* LE MUR DE PNEUS, et pourquoi il se pose un pneu à la fois.

   Vu de dessus, UN PNEU EST ROND : il n'a pas d'orientation, donc aucune lumière à faire pivoter et
   aucune planche d'angles à prévoir. C'est le seul objet du mobilier qu'on peut semer librement, et
   c'est ce qui lui permet d'épouser n'importe quelle courbure là où les murs tout faits de la
   planche sont des tuiles droites ou des arcs de rayon fixe.

   Il borde le GRAVIER et non la piste — c'est là qu'il sert — donc sa position se déduit de la
   largeur du bac : l'agrandir l'emmène avec lui. */
/* CEUX-LÀ SONT DESSINÉS, PAS DÉCOUPÉS — et c'est la seule pièce du décor dont je me permets de
   le dire. La planche en contenait, mais vus de trois quarts et collés les uns aux autres : chaque
   découpe emportait un morceau noir de sa voisine, et le mur se lisait comme une file de grumeaux.
   Un anneau n'a ni style ni orientation à retrouver, donc rien ne se perd à le redessiner — voir
   `tools/pneus.py`, qui relève sa structure sur l'image de référence. */
const PNEUS = ['art/decor/pneu-1.webp', 'art/decor/pneu-2.webp',
  'art/decor/pneu-3.webp', 'art/decor/pneu-4.webp'];
/* UN PNEU FAIT LA TAILLE D'UN BLOC DE VIBREUR, et pas plus. Je les avais grossis à deux mètres
   parce qu'à leur taille réelle ils se lisaient comme des points — mais c'était le symptôme d'autre
   chose : ils étaient trop ESPACÉS. Sur l'image de référence, les pneus se touchent et forment une
   chaîne continue, et c'est la chaîne qu'on voit, pas le pneu. */
const PNEU_M = 1.5;

/* LA GLISSIÈRE : UN SEUL DESSIN, TOURNÉ — et c'est une planche qui a tranché, pas un goût.

   La planche fournit trente-deux orientations, et l'idée était juste : un dessin posé sans rotation
   garde la lumière qu'on lui a peinte, là qu'une tuile qu'on fait pivoter fait pivoter son reflet
   avec elle. Sauf que ces trente-deux-là ne conviennent pas à CE jeu, et la mesure le dit sans
   appel : en cherchant de quelle rotation il faut tourner le dessin à zéro degré pour retrouver
   chacun des autres, on trouve que le libellé va de 0 à 90° pendant que l'image ne tourne, elle,
   que de 0 à 30°. La planche est dessinée en TROIS QUARTS : la verticale y est écrasée par la
   projection. Un jeu vu de dessus a besoin qu'une glissière longeant une route en biais soit en
   biais ; aucun de ces dessins ne l'est assez.

   Trois mesures ont échoué avant celle-là — l'axe des pixels, tiré par les poteaux ; la droite
   joignant les deux poteaux, qui suppose de les reconnaître ; l'anneau d'essai, trop petit pour
   qu'on y lise un écart de vingt degrés. La bonne question ne portait sur aucune de ces choses :
   « de quelle rotation passe-t-on d'un dessin à l'autre » n'a pas besoin de savoir ce qu'est une
   glissière, et c'est pour ça qu'elle a répondu.

   On reprend donc UNE section — la plate, celle dont l'écrasement est nul — et on la tourne au cap
   exact. L'orientation est alors juste par construction, et la jonction aussi, puisque toutes les
   sections sont identiques et parfaitement alignées. Le reflet tourne avec le rail : sur une barre
   métallique presque symétrique, ça ne se voit pas, là où sur une couronne d'arbre ça sautait aux
   yeux. C'est l'échange, et il est du bon côté. */
const RAIL_F = 'art/decor/rail/r00.webp';
const RAIL_PPM = 21.4;       // cent cinquante pixels pour sept mètres
const RAIL_LONG = 7.0;       // la longueur réelle d'une section, qui décide du pas de pose
const RAIL_ANC = [0.5496, 0.3745];   // le milieu du rail dans sa boîte, mesuré sur le dessin

const ART_DESSINE = {};
let decorCharge = 0, decorAttendu = 0;
const ART_OMBRE = [];
/* LA TEXTURE DU BAC À GRAVIER. Ce n'est pas un objet qu'on sème mais un MOTIF qu'on répète dans
   une forme : le bac suit la piste, sa largeur varie, et aucune tuile d'angle dessinée à rayon
   fixe ne pourrait l'épouser. On garde donc la géométrie et on lui donne la matière. */
let ART_GRAVIER = null;
function chargeDecor(fini) {
  if (typeof Image === 'undefined') return;
  decorAttendu = KINDS_DESSINES.length + OMBRES_DESSIN.length + MOBILIER.length
    + PNEUS.length + 2;
  const un = () => { if (++decorCharge === decorAttendu && fini) fini(); };
  for (const k of KINDS_DESSINES) {
    const img = new Image();
    img.onload = () => { ART_DESSINE[k.id] = img; un(); };
    img.onerror = un;
    img.src = k.f;
  }
  for (const k of MOBILIER) {
    const img = new Image();
    img.onload = () => { ART_DESSINE[k.id] = img; un(); };
    img.onerror = un;
    img.src = k.f;
  }
  PNEUS.forEach((f, i) => {
    const img = new Image();
    img.onload = () => { ART_DESSINE['pneu-' + i] = img; un(); };
    img.onerror = un;
    img.src = f;
  });
  {
    const img = new Image();
    img.onload = () => { ART_DESSINE.rail = img; un(); };
    img.onerror = un;
    img.src = RAIL_F;
  }
  {
    const img = new Image();
    img.onload = () => { ART_GRAVIER = img; un(); };
    img.onerror = un;
    img.src = 'art/decor/gravier.webp';
  }
  OMBRES_DESSIN.forEach((f, i) => {
    const img = new Image();
    img.onload = () => { ART_OMBRE[i] = img; un(); };
    img.onerror = un;
    img.src = f;
  });
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
    /* UN SPRITE QUI PORTE SON OMBRE NE S'ÉCLAIRCIT PAS, il ne fait que s'assombrir.

       `source-atop` ne peint que ce qui est déjà là, mais il peint aussi bien un pixel à deux
       dixièmes d'opacité qu'un pixel plein. Or l'ombre cuite de la planche d'automne est
       justement un voile sombre à deux dixièmes, étalé sur presque toute la boîte du dessin :
       l'éclaircir le retourne en voile CLAIR, et comme il remplit la boîte, on voit apparaître
       un rectangle pâle autour de chaque arbre, aux arêtes bien droites. C'était visible comme
       des coutures verticales en travers de la forêt.

       Assombrir, en revanche, ne fait qu'assombrir une ombre : elle reste une ombre. On garde
       donc les écarts vers le bas et on renonce aux écarts vers le haut pour ces sprites-là. La
       variation de lumière y est de toute façon moindre que celle qu'apportent sept couronnes
       différentes et une échelle qui va de un à un et demi. */
    const ecarts = k.cuite ? ECARTS_TON.map((f) => Math.min(f, 1)) : ECARTS_TON;
    const tons = [];
    for (const f of ecarts) {
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
    art[k.id] = { canvas: img, tons, wm: k.wm, cuite: !!k.cuite, anc: k.anc == null ? 0.5 : k.anc,
      hm: k.wm * (img.naturalHeight / img.naturalWidth) };
  }
  for (const k of MOBILIER) {
    const img = ART_DESSINE[k.id];
    if (!img) continue;
    art[k.id] = { canvas: img, wm: k.wm, cuite: true, anc: 0.5,
      hm: k.wm * (img.naturalHeight / img.naturalWidth) };
  }
  for (let i = 0; i < PNEUS.length; i++) {
    const img = ART_DESSINE['pneu-' + i];
    if (!img) continue;
    art['pneu-' + i] = { canvas: img, wm: PNEU_M, cuite: true, anc: 0.5,
      hm: PNEU_M * (img.naturalHeight / img.naturalWidth) };
  }
  {
    const img = ART_DESSINE.rail;
    if (img) art.rail = { canvas: img, wm: img.naturalWidth / RAIL_PPM, cuite: true,
      ancX: RAIL_ANC[0], anc: RAIL_ANC[1], hm: img.naturalHeight / RAIL_PPM };
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
/* Le couvre-sol de l'ANCIEN semeur, celui des onze circuits qu'on n'a pas encore repris. Les noms
   suivent ceux des sprites, et c'est un piège : les avoir renommés sans toucher à cette liste
   avait silencieusement vidé ces circuits de leur herbe, qui s'étaient retrouvés couverts de
   fleurs et de cailloux — les seuls noms encore valides. Rien ne protestait. */
const AU_SOL = { 'herbe-1': 3, 'herbe-2': 3, 'herbe-3': 2,
  'fleurs-jaunes': 1, 'fleurs-blanches': 1, 'fleurs-rouges': 1, 'fleurs-blanches2': 1,
  caillou: 0.6, 'buisson-mini-1': 0.8, 'buisson-mini-2': 0.8, 'buisson-mini-3': 0.6,
  'buisson-mini-4': 0.6 };

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

/* ------------------------------------------------------ LE SEMIS PAR STRATES, À BRUIT BLEU

Le semeur précédent tirait une position au hasard et rejetait celles qui tombaient trop près d'un
voisin déjà posé. C'est la façon la plus directe d'obtenir du BRUIT BLANC : des paquets ici, des
trous là, et à l'œil, du chaos. Deux idées de la littérature le remplacent.

1. LES STRATES (Deussen et al., « Realistic Modeling and Rendering of Plant Ecosystems »,
   SIGGRAPH 1998). On ne sème pas « des plantes » : on sème une CANOPÉE, puis un SOUS-BOIS dans ce
   qu'elle laisse, puis un COUVRE-SOL. Les grandes dominent les petites — une pousse à l'ombre
   d'un grand arbre n'existe pas, et de toute façon vue de dessus on ne la verrait pas. Chaque
   strate a sa taille d'objet, sa distance à la route et son espacement propres.

2. LE DISQUE DE POISSON (Cook 1986 ; algorithme de Bridson, « Fast Poisson Disk Sampling in
   Arbitrary Dimensions », 2007). Les points sont séparés d'au moins `r`, mais sans grille : c'est
   le BRUIT BLEU, la répartition qu'on lit comme « naturelle » parce qu'elle n'a ni amas ni
   alignement. Bridson tire autour d'un point actif jusqu'à trente candidats entre r et 2r, garde
   le premier qui respecte la distance, et avance ; une grille de fond rend le test local.

   On échantillonne dans le repère de la PISTE — abscisse curviligne `s`, distance au bord `d` —
   et non dans le plan. Le ruban se replie sur lui-même à Spa ; dans le plan, deux points très
   éloignés le long du tour peuvent être voisins, et l'algorithme les refuserait alors qu'ils
   appartiennent à deux bords différents. Dans (s, d) le domaine est un rectangle, `s` est
   circulaire, et la distance y vaut la distance au sol tant que le rayon de courbure reste grand
   devant la largeur de la bande — ce qui est le cas partout sauf au fond de l'épingle.

3. LE GRADIENT DE LISIÈRE (écologie du paysage). Un bord de forêt n'est pas un mur : c'est une
   transition — herbes et fleurs au bord, arbustes derrière, grands arbres au fond. Chaque strate
   a donc sa bande, et elles se recouvrent partiellement. C'est ce que montre l'image de référence,
   et c'est aussi ce qui laisse voir le bord de piste.

AUCUNE ROTATION. Un feuillage dessiné porte sa lumière — le clair en haut à gauche, l'ombre en bas
à droite. Le tourner retourne l'éclairage, et une forêt dont chaque arbre est éclairé d'un côté
différent est exactement ce qui se lisait comme du chaos. Les arbres n'ont qu'une orientation. */

function rngStrate(graine) { return propRng(graine); }

/** Bridson, dans le rectangle (s circulaire sur `L`) × (d de `d0` à `d1`). */
function poissonRuban(L, d0, d1, r, rnd, K) {
  if (d1 <= d0 || r <= 0) return [];
  const k = K || 30;
  const cell = r / Math.SQRT2;
  const nS = Math.max(1, Math.ceil(L / cell));
  const nD = Math.max(1, Math.ceil((d1 - d0) / cell));
  const grille = new Int32Array(nS * nD).fill(-1);
  const pts = [];
  const actifs = [];
  const cs = (s) => Math.min(nS - 1, Math.floor((((s % L) + L) % L) / cell));
  const cd = (d) => Math.min(nD - 1, Math.max(0, Math.floor((d - d0) / cell)));
  const libre = (s, d) => {
    const is = cs(s), id = cd(d);
    for (let a = -2; a <= 2; a++) {
      for (let b = -2; b <= 2; b++) {
        const js = ((is + a) % nS + nS) % nS, jd = id + b;   // `s` est circulaire, `d` ne l'est pas
        if (jd < 0 || jd >= nD) continue;
        const q = grille[js * nD + jd];
        if (q < 0) continue;
        let ds = pts[q].s - s;
        if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L;
        const dd = pts[q].d - d;
        if (ds * ds + dd * dd < r * r) return false;
      }
    }
    return true;
  };
  const pose = (s, d) => {
    const i = pts.length;
    pts.push({ s: ((s % L) + L) % L, d });
    grille[cs(s) * nD + cd(d)] = i;
    actifs.push(i);
  };
  pose(rnd() * L, d0 + rnd() * (d1 - d0));
  while (actifs.length) {
    const ai = Math.floor(rnd() * actifs.length);
    const p = pts[actifs[ai]];
    let pose2 = false;
    for (let t = 0; t < k; t++) {
      const ang = rnd() * Math.PI * 2, ray = r * (1 + rnd());
      const s = p.s + Math.cos(ang) * ray, d = p.d + Math.sin(ang) * ray;
      if (d < d0 || d > d1) continue;
      if (!libre(s, d)) continue;
      pose(s, d); pose2 = true; break;
    }
    if (!pose2) { actifs[ai] = actifs[actifs.length - 1]; actifs.pop(); }
  }
  return pts;
}

/* Une strate : les objets qu'elle emploie, la bande qu'elle occupe depuis le bord de piste,
   l'espacement minimal, et la plage de tailles. `couvre` est le rayon sous lequel une strate
   EMPÊCHE les suivantes de pousser : c'est la concurrence de Deussen, et vue de dessus c'est aussi
   ce qui évite de dessiner un buisson que la canopée cachera entièrement. L'ordre de la liste est
   donc l'ordre de DOMINATION — la canopée d'abord — et non l'ordre du dessin, qui se trie ensuite
   par taille pour que les grandes couronnes couvrent le sous-bois. */
/* LA FORÊT DES ARDENNES, en trois strates et un gradient de lisière.

   Les bandes se recouvrent exprès : un bord de forêt n'est pas un mur, c'est une transition. Les
   herbes et les fleurs commencent au bitume, les arbustes deux mètres plus loin, les grands arbres
   à sept — assez pour qu'on voie le bord de piste et le bas-côté fauché, qui sont l'information
   utile au pilote.

   Les espacements sont donnés en mètres au sol : dix mètres entre deux grandes couronnes de neuf
   mètres, elles se touchent sans se confondre. */
const ARBRES = ['arbre-1', 'arbre-2', 'arbre-3', 'arbre-4', 'arbre-5',
  'arbre-6', 'arbre-7', 'arbre-8', 'arbre-9'];
const SAPINS = ['sapin-1', 'sapin-2', 'sapin-3', 'sapin-6', 'sapin-7', 'sapin-8'];
const BUISSONS = ['buisson-1', 'buisson-2', 'buisson-3', 'buisson-4', 'buisson-5',
  'buisson-6', 'buisson-7', 'buisson-8', 'buisson-9', 'buisson-10'];
/* LA BANDE ENTRE LA PISTE ET LES BARRIÈRES N'A NI ARBRE NI PIERRE.

   C'est la zone de dégagement : on y envoie une voiture, les commissaires y marchent, et elle se
   fauche. Un tronc ou un rocher à cet endroit dit qu'on ne peut pas y aller — ce qui est faux — et
   cache en plus la glissière, qui est l'information vraie. De l'herbe, des fleurs, des arbustes
   bas, rien d'autre.

   La limite est le recul des barrières : sept mètres cinquante en ligne droite, treize et demi
   derrière un bac, lissé entre les deux. On prend QUINZE mètres partout plutôt que de recalculer
   ce profil ici — une seconde définition du même nombre finit toujours par diverger de la
   première, et quinze mètres couvre le cas le plus large. */
const HORS_BARRIERES = 19;

/* RIEN NE POUSSE SUR LES BANDES PEINTES. Le bord de piste porte trois marques dans l'ordre : le
   liseré sombre qui encadre le bitume, large de trois mètres et demi dont la moitié déborde sur
   l'herbe, puis la ligne bleue ou jaune qui dit de quel côté on est. Ce sont des REPÈRES — on
   pousse le levier vers le jaune, on vise le bleu — et une touffe posée dessus les hache. Le semis
   commence donc après elles. La bande d'herbe fauchée, elle, va jusqu'au bitume : c'est ce qui
   rattache la route au pré sans rien cacher. */
const HORS_MARQUAGE = 2.6;

const STRATES_ARDENNES = [
  { nom: 'canopee', kinds: ARBRES.concat(ARBRES, SAPINS), de: HORS_BARRIERES, a: 95, r: 9.5,
    ech: [0.95, 1.35], couvre: 6.0 },
  // le sous-bois, avec ses pierres, commence lui aussi derrière les barrières
  /* LA LISIÈRE SUD : les arbres qui débordent sur la route.

     Elle plante de grandes couronnes JUSTE DERRIÈRE LA GLISSIÈRE — huit mètres au plus près, le
     recul en ligne droite étant de sept et demi — et seulement là où le bord regarde le sud. La
     cime s'étale alors sur le bitume et, le dessin allant du nord au sud, elle passe devant : on
     roule dessous. La bande est ÉTROITE — sept à treize mètres — parce que c'est la distance qui
     décide : l'ancre d'une couronne est comptée depuis le haut du dessin, donc elle monte de
     `anc × hm` vers le nord, soit neuf mètres et demi pour un grand arbre au plus fort de son
     échelle. Plantée à vingt mètres elle ne déborde rien.

     ATTENTION À L'ÉCART DE BRUIT BLEU DANS UNE BANDE ÉTROITE. Premier essai : bande de quatre
     mètres, écart de 4,2 — et soixante-douze arbres pour trois kilomètres et demi. Ce n'étaient
     pas mes filtres : Bridson sème autour d'un point actif entre r et 2r, et dans une bande plus
     étroite que r presque tous les candidats tombent dehors, donc le front meurt au bout de
     quelques pas. Bande de huit mètres et écart de cinq : mille huit cents candidats au lieu de
     soixante-douze, pour le même rayon à peu près. La règle à retenir est que la bande doit être
     plus large que l'écart, sans quoi on ne règle pas une densité, on étouffe un algorithme.

     Le premier réglage qui donnait vraiment des cimes sur la route en posait huit cents, un tous
     les trois mètres et demi : un mur de feuillage qui mangeait la glissière, c'est-à-dire la
     seule information vraie de ce bord-là. Quatre cent cinquante, dont une centaine qui dépassent
     sur le bitume, laissent voir le rail entre les troncs. C'est la seule chose qui donne une épaisseur à la forêt depuis la voiture ;
     vue de dessus, une forêt qui s'arrête net à dix-neuf mètres est un papier peint.

     La règle « pas d'arbre entre la piste et la barrière » tient toujours : le tronc est DERRIÈRE
     la glissière, c'est la cime qui dépasse. Et le bac à gravier reste interdit — dans un virage
     il fait plus de neuf mètres, donc la strate n'y pose rien, ce qui est juste : on ne plante
     pas un chêne au bord d'un dégagement. */
  { nom: 'lisiere-sud', kinds: ARBRES, de: 8.0, a: 22.0, r: 8.0,
    ech: [1.2, 1.6], couvre: 4.0, sud: 0.25, pres: 3.5 },
  { nom: 'sous-bois', kinds: BUISSONS.concat(['sapin-4', 'sapin-5', 'sapin-9', 'rocher-1', 'rocher-3']),
    de: HORS_BARRIERES, a: 72, r: 4.8, ech: [0.85, 1.25], couvre: 2.4 },
  // devant les barrières : des arbustes et rien qui pèse
  { nom: 'abords', kinds: ['buisson-6', 'buisson-7', 'buisson-8', 'buisson-9', 'buisson-10',
    'buisson-fleuri-jaune', 'buisson-fleuri-rouge', 'buisson-fleuri-vert'],
    de: HORS_MARQUAGE + 0.8, a: HORS_BARRIERES - 2, r: 4.4, ech: [0.7, 1.0], couvre: 2.0 },
  // l'herbe et les fleurs vont partout ; la souche, le rondin et les cailloux restent au bois
  { nom: 'couvre-sol', kinds: ['herbe-1', 'herbe-2', 'herbe-3', 'herbe-1', 'herbe-2',
    'fleurs-blanches', 'fleurs-jaunes', 'fleurs-rouges', 'fleurs-blanches2',
    'buisson-mini-1', 'buisson-mini-2', 'buisson-mini-3', 'buisson-mini-4'],
    de: HORS_MARQUAGE, a: 22, r: 2.2, ech: [0.85, 1.25] },
  { nom: 'bois-mort', kinds: ['caillou', 'rocher-2', 'souche', 'rondin', 'branche'],
    de: HORS_BARRIERES, a: 60, r: 7.0, ech: [0.85, 1.2] },
];

/* -------------------------------------------------------------------- LES STRATES D'AUTOMNE

   La structure est celle des Ardennes — canopée, sous-bois, abords, couvre-sol, bois mort — et
   ce n'est pas de la paresse : les règles qui l'ont fixée ne dépendent pas de la saison. La
   bande devant les barrières se fauche en octobre comme en juin, le semis évite les bandes
   peintes de la même manière, et une couronne de onze mètres a besoin du même écart pour ne pas
   se confondre avec sa voisine.

   Ce qui change est la LITIÈRE : elle s'ajoute au couvre-sol, partout, y compris devant les
   barrières. Des feuilles tombées sur une zone de dégagement, c'est précisément ce qu'on voit
   en octobre, et ça ne cache rien de ce que le pilote doit lire. */
const A_ARBRES = [
  'a-arbre-1', 'a-arbre-3', 'a-arbre-4', 'a-arbre-6', 'a-arbre-nu-1'];
const A_CONIFERES = [
  'a-conifere-1', 'a-conifere-2', 'a-conifere-4', 'a-conifere-5', 'a-conifere-6'];
const A_ARBUSTES = [
  'a-arbuste-1', 'a-arbuste-2', 'a-arbuste-3', 'a-arbuste-4', 'a-arbuste-5', 'a-arbuste-6',
  'a-arbuste-7', 'a-arbuste-8', 'a-touffe-1', 'a-touffe-2', 'a-touffe-3', 'a-touffe-4',
  'a-touffe-5', 'a-touffe-6', 'a-touffe-7', 'a-touffe-8'];
const A_HERBES = [
  'a-herbe-1', 'a-herbe-2', 'a-herbe-3', 'a-herbe-4', 'a-plant-1', 'a-plant-2',
  'a-plant-3', 'a-plant-4', 'a-plant-5', 'a-plant-6'];
const A_LITIERE = [
  'a-feuilles-1', 'a-feuilles-2', 'a-feuilles-3', 'a-feuilles-4', 'a-feuilles-5',
  'a-feuilles-6', 'a-feuilles-7', 'a-feuilles-8', 'a-feuille-1', 'a-feuille-2',
  'a-feuille-3', 'a-feuille-4'];
const A_PIERRES = [
  'a-rocher-1', 'a-rocher-2', 'a-rocher-3', 'a-rocher-4', 'a-rocher-5', 'a-souche-1',
  'a-souche-2', 'a-rondin-1', 'a-rondin-2', 'a-rondin-3'];

const STRATES_AUTOMNE = [
  { nom: 'canopee', kinds: A_ARBRES.concat(A_ARBRES, A_CONIFERES), de: HORS_BARRIERES, a: 95,
    r: 9.5, ech: [0.95, 1.35], couvre: 6.0 },
  // la lisière sud : voir la note dans les strates des Ardennes
  { nom: 'lisiere-sud', kinds: A_ARBRES, de: 8.0, a: 22.0, r: 8.0,
    ech: [1.2, 1.6], couvre: 4.0, sud: 0.25, pres: 3.5 },
  { nom: 'sous-bois', kinds: A_ARBUSTES.concat(A_CONIFERES, A_PIERRES.slice(0, 4)),
    de: HORS_BARRIERES, a: 72, r: 4.8, ech: [0.85, 1.25], couvre: 2.4 },
  // devant les barrières : des arbustes bas et rien qui pèse
  { nom: 'abords', kinds: A_ARBUSTES.slice(0, 10),
    de: HORS_MARQUAGE + 0.8, a: HORS_BARRIERES - 2, r: 4.4, ech: [0.7, 1.0], couvre: 2.0 },
  { nom: 'couvre-sol', kinds: A_HERBES.concat(A_LITIERE, A_LITIERE),
    de: HORS_MARQUAGE, a: 22, r: 2.2, ech: [0.85, 1.25] },
  { nom: 'bois-mort', kinds: A_PIERRES, de: HORS_BARRIERES, a: 60, r: 7.0, ech: [0.85, 1.2] },
];

/* Le décor d'un circuit nomme sa planche, et c'est ici qu'on fait la correspondance — une seule
   table, pour que `render.js` n'ait pas à connaître le nom des strates. */
const STRATES = { ardennes: STRATES_ARDENNES, automne: STRATES_AUTOMNE };


/* UNE STRATE QUI NOMME UN SPRITE INEXISTANT NE SE VOIT PAS : le dessin saute l'objet et la forêt
   s'éclaircit sans que rien ne proteste. C'est arrivé en renommant les sprites, et c'est le genre
   de panne qu'aucune image ne révèle — on croit que le semis est moins dense. On le dit donc à
   voix haute, une fois, au premier semis. */
function verifieStrates(strates) {
  const connus = {};
  for (const k of KINDS_DESSINES) connus[k.id] = 1;
  const absents = [];
  for (const st of strates) for (const k of st.kinds) if (!connus[k] && absents.indexOf(k) < 0) absents.push(k);
  if (absents.length && typeof console !== 'undefined') {
    console.warn('décor : sprites nommés par une strate mais absents — ' + absents.join(', '));
  }
  return absents;
}

let strates_verifiees = false;
function semeStrates(track, id, strates) {
  if (!strates_verifiees) { strates_verifiees = true; verifieStrates(strates); }
  const L = track.length, N = track.n, out = [];
  /* LE RUBAN SE REPLIE SUR LUI-MÊME, et (s, d) ne le sait pas.

  Échantillonner dans le repère de la piste règle l'espacement, mais il ignore que deux tronçons du
  même tour peuvent se croiser : à l'épingle de Spa, une bande de quatre-vingt-quinze mètres posée
  depuis un tronçon retombe en plein sur un autre, et la forêt recouvrait la piste au point qu'on
  ne la voyait plus. Après le passage en coordonnées du monde, on vérifie donc la distance à TOUTE
  la ligne médiane, pas seulement à la station d'origine. Les trous que ça creuse dans le bruit
  bleu sont justes : il y a une route à cet endroit. */
  /* RIEN NE POUSSE DANS UN BAC À GRAVIER. C'est un dégagement : on y envoie une voiture, et une
     touffe d'herbe au milieu dit le contraire de ce que la surface promet. Le bac est la bande de
     huit mètres au-delà du bord, sur toute la longueur d'un virage — c'est `js/render.js` qui le
     peint ainsi, et on se cale sur sa définition plutôt que d'en inventer une seconde. */
  const enVirage = new Uint8Array(N);
  for (const cn of track.corners) {
    for (let i = cn.from; i <= cn.to; i++) enVirage[((i % N) + N) % N] = 1;
  }
  // garde radiale : elle ne sait pas de quel bord elle parle, donc elle prend le plus large des
  // deux — mieux vaut un pied d'herbe en moins qu'une touffe au milieu du sable
  const bac = (i) => track.halfWidth + track.largeurBac(i) + 1.2;
  const loinDeLaPiste = (x, y, besoin) => {
    for (let i = 0; i < N; i += 4) {
      const dx = x - track.xs[i], dy = y - track.ys[i];
      // en virage la garde s'élargit au bac : sans ça un objet semé depuis un autre tronçon du
      // tour pouvait tomber en plein dégagement
      const b = Math.max(besoin, enVirage[i] ? bac(i) : 0);
      if (dx * dx + dy * dy < b * b) return false;
    }
    return true;
  };
  /* SOUS UNE PLAQUE, ON NE SÈME RIEN. Une plaque d'essai porte déjà sa forêt, ses bas-côtés et
     son dégagement : y semer les nôtres par-dessus empêche justement de voir ce qu'elle vaut.
     C'est la condition pour que la comparaison ait un sens. */
  const plaques = (track.plaques || []).map((pl) => {
    const a = (pl.rot || 0) * Math.PI / 180;
    return { x: pl.x, y: pl.y, c: Math.cos(a), si: Math.sin(a),
      dx: pl.m / 2, dy: pl.m * (pl.hw || 1) / 2 };
  });
  const sousPlaque = (x, y) => {
    for (const q of plaques) {
      const ux = x - q.x, uy = y - q.y;
      // on repasse dans le repère de la plaque : rotation inverse
      const a = ux * q.c + uy * q.si, b = -ux * q.si + uy * q.c;
      if (Math.abs(a) < q.dx && Math.abs(b) < q.dy) return true;
    }
    return false;
  };
  const poses = [];                       // {s, d, cote, r} de tout ce qui est déjà debout
  strates.forEach((st, is) => {
    const rnd = rngStrate(seedFromId('strate-' + is + '-' + id));
    for (const cote of [1, -1]) {
      const pts = poissonRuban(L, st.de, st.a, st.r, rnd);
      for (const p of pts) {
        {
          let couvert = false;
          for (const q of poses) {
            if (q.cote !== cote) continue;
            let ds = q.s - p.s;
            if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L;
            const dd = q.d - p.d;
            if (ds * ds + dd * dd < q.r * q.r) { couvert = true; break; }
          }
          if (couvert) continue;
        }
        const k = st.kinds[Math.floor(rnd() * st.kinds.length)];
        const ech = st.ech[0] + rnd() * (st.ech[1] - st.ech[0]);
        const i = track.idx(p.s);
        /* UNE STRATE PEUT NE VALOIR QUE POUR LE BORD SUD, et c'est ce qui permet de faire
           déborder des cimes sur la piste sans poser un arbre devant la glissière du bord nord.

           Tous les sprites regardent du même côté : un arbre montre un peu son flanc et sa cime
           s'étale VERS LE HAUT de l'image, c'est-à-dire vers le nord. Planté au sud de la route,
           il déborde donc sur le bitume ; planté au nord, il déborde sur la forêt, où ça ne se
           voit pas. Et comme le dessin va du nord au sud, cette cime-là passe DEVANT la route :
           on roule dessous, ce qui est exactement l'effet recherché.

           Le sud, pour un bord, c'est la direction de sa normale sortante — `ny` positif, l'écran
           ayant son y vers le bas. Un quart suffit comme seuil : au-delà le bord regarde déjà
           franchement vers le bas de l'écran. */
        if (st.sud && track.ny[i] * cote < st.sud) continue;
        /* ON SÈME LARGE, PUIS ON TASSE VERS LA BARRIÈRE. La lisière voudrait une bande de quatre
           mètres, et Bridson n'en veut pas : dans une bande plus étroite que son écart, presque
           tous ses candidats tombent dehors et le front meurt — soixante-douze arbres pour trois
           kilomètres et demi, mesuré. On lui laisse donc la bande large dont il a besoin, et on
           redistribue ensuite les distances par une puissance, ce qui les concentre près du bord.

           Le prix est que l'écart minimal n'est plus garanti après la transformation : deux
           arbres voisins se retrouvent plus près l'un de l'autre qu'en (s, d). Pour une lisière
           dont les couronnes DOIVENT se recouvrir, c'est le sens de la manœuvre. */
        if (st.pres) {
          const u = (p.d - st.de) / Math.max(1e-6, st.a - st.de);
          p.d = st.de + (st.a - st.de) * Math.pow(u, st.pres);
        }
        const hw = cote > 0 ? track.hwL[i] : track.hwR[i];
        const lat = (hw + p.d) * cote;
        if (p.d < track.largeurBac(i, cote) + 1.2) continue;   // le bac du bord qu'on longe
        const x = track.xs[i] + track.nx[i] * lat, y = track.ys[i] + track.ny[i] * lat;
        if (plaques.length && sousPlaque(x, y)) continue;
        // la garde est celle de la strate elle-même : ce qu'elle s'interdit près de SON bord, elle
        // se l'interdit près de n'importe quel autre tronçon du tour
        /* La garde radiale se cale sur le `de` de la strate, moins une marge : à quatre-vingt-
           cinq pour cent elle allait bien tant que `de` valait dix-neuf mètres, mais une lisière
           posée à sept se rejetait elle-même sur sa propre station. */
        if (!loinDeLaPiste(x, y, track.halfWidth + Math.min(st.de - 1.2, st.de * 0.85))) continue;
        out.push({ x, y, id: k, ech, rot: 0, ton: Math.min(TONS - 1, Math.floor(rnd() * TONS)),
          om: Math.floor(rnd() * OMBRES_DESSIN.length) });
        if (st.couvre) poses.push({ s: p.s, d: p.d, cote, r: st.couvre * ech });
      }
    }
    void N;
  });
  return out;
}

/* LES BARRIÈRES SUIVENT LE TRACÉ, des deux côtés, sans trou.

   Trois décisions font tout le résultat.

   OÙ. Le recul n'est pas constant : derrière un bac à gravier en virage, tout près du bitume sur
   une ligne droite. Pris station par station, ce recul saute de dix mètres à cinq à l'entrée du
   virage, et la barrière fait un coude que rien ne justifie. On LISSE donc le profil sur une
   soixantaine de mètres — c'est ce que fait un vrai circuit, où la glissière s'écarte
   progressivement avant le dégagement et revient après.

   QUOI. Une glissière là où ça va vite et où une sortie est violente, une barrière de bois ou un
   muret sur le reste. La vitesse de référence vient du rayon du virage le plus proche, pas d'un
   réglage : le circuit décide tout seul de son mobilier.

   COMMENT. Une tuile tous les `wm` mètres moins un chevauchement : sur la corde d'un virage, deux
   tuiles droites posées bout à bout laissent un coin de vide à l'extérieur, et un joint le long
   d'une glissière se voit plus qu'un chevauchement.

   C'est la seule famille d'objets qu'on tourne. Un arbre n'a pas de direction ; une glissière
   n'est que ça. */
/* LE RECUL DE LA BARRIÈRE, EN UN SEUL ENDROIT — pour la même raison que la largeur du bac.
   La glissière et le mur de pneus se posent au même écart de la piste, à l'épaisseur d'un pneu
   près : ils sont la même clôture, l'un contre l'autre. Chacun le recalculant de son côté, il a
   suffi de retoucher l'un pour que le mur se retrouve à quatre mètres dans l'herbe, seul au
   milieu de rien.

   Le recul n'est pas constant : derrière un bac à gravier en virage, tout près du bitume sur une
   ligne droite. Pris station par station il saute de dix mètres à cinq à l'entrée du virage, et
   la barrière fait un coude que rien ne justifie. On LISSE donc sur une soixantaine de mètres,
   comme un vrai circuit où la glissière s'écarte progressivement avant le dégagement. */
function reculBarriere(track) {
  if (track._recul) return track._recul;
  const N = track.n;
  const enVirage = new Uint8Array(N);
  for (const cn of track.corners) for (let i = cn.from; i <= cn.to; i++) enVirage[((i % N) + N) % N] = 1;
  const brut = new Float32Array(N);
  /* Chaque bord a son propre recul : le bac n'est qu'à l'extérieur du virage, donc la barrière
     intérieure n'a aucune raison de s'écarter pour un sable qui est de l'autre côté. */
  const brutD = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    brut[i] = enVirage[i] ? Math.max(7.5, track.largeurBac(i, 1) + 2.6) : 7.5;
    brutD[i] = enVirage[i] ? Math.max(7.5, track.largeurBac(i, -1) + 2.6) : 7.5;
  }
  const F = Math.max(1, Math.round(30 / track.ds));         // demi-fenêtre : trente mètres
  const lisse = (src) => {
    const out = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let somme = 0;
      for (let k = -F; k <= F; k++) somme += src[((i + k) % N + N) % N];
      out[i] = somme / (2 * F + 1);
    }
    return out;
  };
  track._recul = { L: lisse(brut), R: lisse(brutD) };
  return track._recul;
}

function poseBarrieres(track, id) {
  if (!decorPret() || !MOBILIER.length) return [];
  const N = track.n, L = track.length, out = [];
  const rnd = propRng(seedFromId('mob-' + id));
  const art = {};
  for (const k of MOBILIER) art[k.id] = k;

  const recul = reculBarriere(track);
  // en virage on resserre le pas : deux cordes droites le long d'un arc laissent un coin de vide
  const enVirage = new Uint8Array(N);
  for (const cn of track.corners) for (let i = cn.from; i <= cn.to; i++) enVirage[((i % N) + N) % N] = 1;

  /* La sévérité du virage le plus proche décide du mobilier. `corners` porte le rayon de courbure
     de chaque virage ; un grand rayon est une courbe rapide, et c'est là qu'on met de l'acier. */
  const severite = new Float32Array(N);
  for (const cn of track.corners) {
    const r = cn.peak ? 1 / Math.abs(cn.peak) : 400;
    for (let k = -60; k <= 60; k++) {
      const i = ((cn.from + k) % N + N) % N;
      severite[i] = Math.max(severite[i], Math.min(1, 200 / Math.max(40, r)));
    }
  }

  for (const cote of [1, -1]) {
    let s = rnd() * 30;
    while (s < L) {
      const i = track.idx(s);
      /* L'ORIENTATION SE CHOISIT, ELLE NE S'APPLIQUE PLUS. On prend le dessin dont l'angle est
         le plus proche du cap, et on le pose tel quel : c'est ce qui garde une lumière unique sur
         tout le circuit. Un demi-tour sépare les deux côtés — le rail regarde la piste, donc il
         regarde à l'opposé selon qu'on est à gauche ou à droite du ruban. */
      /* LE CAP EXACT, ET LE MÊME DES DEUX CÔTÉS. C'est tout l'intérêt de revenir à un seul
         dessin : la glissière est parallèle à la route au degré près, sur toute sa longueur, et
         deux sections voisines sont rigoureusement alignées.

         On ne retourne PLUS la section du côté opposé. Le demi-tour voulait que le rail regarde la
         piste des deux bords, ce qui est vrai d'une vraie glissière ; mais il retourne aussi la
         lumière, et une barrière éclairée par en dessous se remarque plus qu'une barrière dont le
         rail est du mauvais côté. Les deux bords ont donc la même orientation, comme sur l'image
         de référence. */
      /* L'HERBE RESTE EN BAS. Le dessin n'est pas tout à fait zénithal : il montre un peu le
         flanc de la glissière, avec la rambarde en haut de la boîte et l'herbe du pied en bas.
         Le tourner au cap exact le retourne donc une fois sur deux — dès que la piste va vers
         l'ouest, le cap dépasse le quart de tour et la barrière se retrouve sur le dos, pied en
         l'air.

         Une section de glissière est un SEGMENT : la tourner de θ ou de θ+π donne exactement la
         même droite, au même endroit, et seul le flanc visible change. On ramène donc le cap
         dans le demi-tour qui garde le pied vers le bas, et l'alignement entre sections voisines
         reste parfait puisque la droite, elle, ne bouge pas. */
      let cap = track.th[i];
      while (cap > Math.PI / 2) cap -= Math.PI;
      while (cap <= -Math.PI / 2) cap += Math.PI;
      /* LE PAS EST BIEN PLUS COURT QUE LA SECTION, et c'est la géométrie du dessin qui l'impose.
         À zéro degré la glissière occupe toute la largeur de sa boîte ; à quarante-cinq elle la
         traverse en diagonale, donc ce qu'elle couvre LE LONG DE LA PISTE est bien moindre que la
         boîte. Poser au pas de la boîte laissait un jour sur deux tronçons obliques sur trois. On
         recouvre donc franchement : deux glissières superposées font une glissière, un trou entre
         deux n'en fait pas. */
      /* LE PAS VAUT PRESQUE LA SECTION. Avec des dessins à la même échelle, la glissière mesure
         sept mètres quel que soit son angle : il suffit de poser la suivante juste avant la fin de
         la précédente. Le recouvrement franc d'avant servait à masquer des sections de tailles
         inégales — un symptôme, pas une solution. */
      /* LE PAS SE RÈGLE SUR LE RAIL, PAS SUR LA BOÎTE. La boîte du dessin comprend la bande
         d'herbe, qui dépasse aux deux bouts : le métal n'occupe que les quatre cinquièmes. Un pas
         calé sur la boîte laissait donc un jour à chaque jonction, assez petit pour qu'on ne voie
         pas d'où il venait et assez régulier pour qu'on le voie partout. */
      /* LE PAS SE RÈGLE SUR LE MÉTAL, PAS SUR LA BOÎTE. La boîte comprend la bande d'herbe, qui
         dépasse aux deux bouts : le rail n'occupe que les quatre cinquièmes. Et en virage, deux
         sections droites posées bout à bout le long d'un arc laissent un coin de vide à
         l'extérieur — la corde est plus courte que l'arc. */
      const pas = RAIL_LONG * (enVirage[i] ? 0.62 : 0.76);
      const hw = cote > 0 ? track.hwL[i] : track.hwR[i];
      const rec = cote > 0 ? recul.L : recul.R;
      const lat = (hw + rec[i]) * cote;
      const x = track.xs[i] + track.nx[i] * lat, y = track.ys[i] + track.ny[i] * lat;
      /* LA SECTION NE DOIT PAS TOMBER SUR UN AUTRE TRONÇON. À l'intérieur d'une épingle, le recul
         fait traverser la piste. Écarter par la seule distance le long du tour confondrait l'arc
         qu'on longe avec l'autre branche : au bout de vingt mètres d'arc serré la ligne médiane
         est déjà revenue sous la barrière. On n'écarte que ce qui va AILLEURS — plus de soixante-
         dix degrés d'écart de cap. */
      let dehors = true;
      for (let j = 0; j < N && dehors; j += 2) {
        let e = Math.abs(j - i); if (e > N / 2) e = N - e;
        if (e * track.ds < RAIL_LONG) continue;
        let dth = track.th[j] - track.th[i];
        while (dth > Math.PI) dth -= 2 * Math.PI;
        while (dth < -Math.PI) dth += 2 * Math.PI;
        if (Math.abs(dth) < 1.22) continue;
        /* ON S'ARRÊTE AU BORD DE L'AUTRE ENCLOS, pas au bord de l'autre bitume. Le garde-fou ne
           rejetait que ce qui tombait SUR la piste d'en face ; entre les deux branches d'une
           épingle il reste pourtant une bande d'herbe, assez large pour qu'une section y passe et
           beaucoup trop étroite pour deux clôtures. Les deux barrières s'y croisaient en X.

           Une branche de circuit n'est pas son bitume : c'est son bitume PLUS son recul, jusqu'à
           sa propre glissière. On rejette donc ce qui entre dans cet enclos-là, et les deux
           clôtures se rejoignent exactement là où elles se touchent, en V. */
        const dx = x - track.xs[j], dy = y - track.ys[j];
        const clos = Math.max(track.hwL[j] + recul.L[j], track.hwR[j] + recul.R[j]);
        if (dx * dx + dy * dy < clos * clos) dehors = false;
      }
      if (dehors) out.push({ x, y, id: 'rail', ech: 1, ton: 0, om: 0, rot: cap });
      s += pas;
    }
  }
  return out;
}

/* LES PNEUS BORDENT LE BAC, un par un, sur toute la partie où il est assez large pour servir.

   Pas de tuiles : un pneu est rond, donc il se pose où on veut sans orientation. Le pas est serré —
   les pneus d'un mur se touchent — et il suit la cloche du bac, donc le mur apparaît quand le bac
   s'ouvre et disparaît quand il se referme, sans qu'on ait à dire où.

   Les quatre dessins tournent dans l'ordre plutôt qu'au hasard : un mur de pneus est fait de pneus
   usés empilés par les commissaires, pas d'un tirage. L'alternance régulière est ce qu'on voit sur
   un circuit, et elle évite les paquets de deux identiques qu'un tirage produit toujours. */
function posePneus(track, id) {
  if (!decorPret() || !PNEUS.length) return [];
  const L = track.length, N2 = track.n, out = [];
  const MINI = 4.5;                      // en deçà, le bac est trop étroit pour mériter un mur
  /* LE PAS SE MESURE ENTRE DEUX PNEUS, PAS LE LONG DE L'AXE. Le mur est posé une vingtaine de
     mètres au large ; sur l'extérieur d'une épingle de vingt-cinq mètres de rayon, l'arc qu'il
     décrit est presque deux fois plus long que celui de la ligne médiane. Un pas constant compté
     sur l'axe écartait donc les pneus d'autant, et le mur se clairsemait exactement là où il sert
     le plus. On avance par petits incréments et on pose quand on s'est VRAIMENT éloigné du
     précédent. */
  /* Relevé sur l'image : le pas vaut 1,25 m pour un pneu de 1,50 — ils se recouvrent d'un bon
     sixième, et les carcasses se fondent en une bande continue dont seuls les anneaux clairs
     ressortent. C'est la CHAÎNE qu'on voit, pas le pneu. */
  const ECART = PNEU_M * 0.83;      // 1,25 m pour un pneu de 1,50 : un sixième de recouvrement
  const recul = reculBarriere(track);
  let k = 0;
  for (const cote of [1, -1]) {
    let px = null, py = null;
    /* ON INTERPOLE ENTRE LES NŒUDS, et c'est là qu'était le trou. La ligne médiane est
       échantillonnée au mètre : en se contentant de `track.idx(s)`, tout pas plus fin retombait
       sur le même nœud, et le mur ne pouvait pas être plus serré qu'un pneu par mètre d'AXE. Sur
       l'extérieur d'un virage, et surtout là où la cloche du bac s'ouvre d'un bon mètre d'un nœud
       au suivant, ce mètre d'axe devient trois mètres et demi au niveau du mur — un pneu sur
       deux manquait exactement dans les montées. En évaluant le point du mur entre deux nœuds,
       le pas redevient continu et c'est l'écart voulu qui décide partout.

       Mesure : avant, le centile 99 des écarts valait 3,62 m pour un pneu de 1,50, et 44 écarts
       dépassaient trois mètres. */
    for (let s = 0; s < L; s += 0.1) {
      const i = track.idx(s);
      const i2 = (i + 1) % N2, u = (s - i * track.ds) / track.ds;
      const w = track.largeurBac(i, cote) * (1 - u) + track.largeurBac(i2, cote) * u;
      if (w < MINI) { px = null; continue; }    // le mur s'interrompt, on repart à neuf
      /* LE MUR EST CONTRE LA BARRIÈRE, pas au bord du gravier. C'est là qu'il sert : un mur de
         pneus n'est pas une bordure de bac, c'est l'amortisseur de la glissière, et on le pose
         plaqué contre elle. Posé sur le bord du gravier, il laissait derrière lui une bande
         d'herbe vide, puis la glissière plus loin — deux clôtures parallèles là où il n'y en a
         qu'une. Il prend donc le MÊME recul que la barrière, moins un demi-pneu pour venir
         s'appuyer dessus. */
      const rec = cote > 0 ? recul.L : recul.R;
      const rA = rec[i], rB = rec[i2];
      const hwA = cote > 0 ? track.hwL[i] : track.hwR[i];
      const hwB = cote > 0 ? track.hwL[i2] : track.hwR[i2];
      const lat = (hwA * (1 - u) + hwB * u + rA * (1 - u) + rB * u - PNEU_M * 0.55) * cote;
      const cx = track.xs[i] * (1 - u) + track.xs[i2] * u;
      const cy = track.ys[i] * (1 - u) + track.ys[i2] * u;
      let nxv = track.nx[i] * (1 - u) + track.nx[i2] * u;
      let nyv = track.ny[i] * (1 - u) + track.ny[i2] * u;
      const nl = Math.hypot(nxv, nyv) || 1; nxv /= nl; nyv /= nl;
      const x = cx + nxv * lat, y = cy + nyv * lat;
      if (px !== null && (x - px) * (x - px) + (y - py) * (y - py) < ECART * ECART) continue;
      /* À L'INTÉRIEUR D'UNE ÉPINGLE, le bord extérieur du bac traverse l'autre branche : le mur
         se retrouvait en travers du bitume. Même garde-fou que pour les glissières — on n'écarte
         que les tronçons qui vont AILLEURS, faute de quoi on confondrait l'arc qu'on longe avec
         la branche d'en face et on perdrait tout le mur extérieur. */
      let dehors = true;
      for (let j = 0; j < N2 && dehors; j += 2) {
        let e = Math.abs(j - i); if (e > N2 / 2) e = N2 - e;
        /* L'EXEMPTION LOCALE DOIT COUVRIR TOUT L'ARC QU'ON LONGE. À deux fois le diamètre d'un
           pneu, elle ne couvrait que trois mètres : dans une épingle serrée, la ligne médiane
           revient sous le mur bien avant ça, et le garde-fou rejetait les trois quarts des pneus
           du virage — d'où une chaîne en pointillé exactement là où elle doit être pleine. */
        if (e * track.ds < 30) continue;
        let dth = track.th[j] - track.th[i];
        while (dth > Math.PI) dth -= 2 * Math.PI;
        while (dth < -Math.PI) dth += 2 * Math.PI;
        if (Math.abs(dth) < 1.22) continue;
        /* Le mur s'arrête où s'arrête la barrière sur laquelle il s'appuie : même enclos, même
           garde-fou. Sinon il restait un bout de mur seul dans l'herbe, à l'intérieur de
           l'épingle, là où la barrière avait déjà renoncé. */
        const dx = x - track.xs[j], dy = y - track.ys[j];
        const clos = Math.max(track.hwL[j] + recul.L[j], track.hwR[j] + recul.R[j]);
        if (dx * dx + dy * dy < clos * clos) dehors = false;
      }
      if (dehors) {
        out.push({ x, y, id: 'pneu-' + (k++ % PNEUS.length), ech: 1, ton: 0, om: 0, rot: 0 });
        px = x; py = y;
      }
    }
  }
  void id;
  return out;
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
