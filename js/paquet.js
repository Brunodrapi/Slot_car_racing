/* Eyes On Line — l'instantané de course, en octets.
 *
 * L'hôte envoie la position de toutes les voitures trente fois par seconde, à chacun de ses
 * invités. Jusqu'ici en JSON : 562 octets pour dix voitures, soit 2,73 Mbit/s de voie montante à
 * huit joueurs — au-dessus de ce qu'une 4G faible accepte en montée. Ce fichier en fait 214.
 *
 * LE CHOIX DE FOND : on ne touche pas à la forme de l'instantané. `Race.snapshot()` rend toujours
 * son tableau de nombres et `Race.applySnapshot()` le relit tel quel ; ce codec ne fait que
 * traduire ce tableau en octets et retour. Un encodage qui se serait glissé dans la simulation
 * aurait mêlé deux sujets — ce qu'on transmet et comment on le transmet — et toute erreur de
 * quantification serait devenue une erreur de physique, invisible et impossible à isoler. Ici elle
 * reste une erreur de transport, et un aller-retour suffit à la mesurer.
 *
 * CE QUI A ÉTÉ MESURÉ AVANT D'ÊTRE ÉCRIT :
 *
 *   Les plages réelles, sur 8640 instantanés et douze circuits, pour choisir chaque type au lieu
 *   de le supposer. Quatre champs dépassaient l'entier court en ×100 — x, y, s et le meilleur
 *   tour — et c'est ce qui dicte les échelles ci-dessous.
 *
 *   La tentation de ne PAS transmettre x et y, puisque `track.pos(s, lat)` sait les retrouver. Sur
 *   72 992 relevés d'une voiture sur la piste, l'écart moyen vaut 0,011 px — mais le pire monte à
 *   8,9 px. Une voiture posée neuf pixels à côté, c'est une voiture dans le décor. Hypothèse
 *   rejetée : x et y voyagent.
 *
 *   L'étendue du plus grand circuit, 1531 px au Mans. x et y sont donc rangés en entier court
 *   relativement au cadre du circuit, au seizième de pixel, avec une marge de 256 px de chaque
 *   côté pour les sorties de route — (1531 + 512) × 16 = 32 688, la moitié de ce qu'un entier
 *   court accepte.
 *
 * CE QUI NE PASSE PAS À CHAQUE IMAGE : le meilleur tour, l'heure de début de tour, le nombre de
 * sorties de piste, le temps qu'elles ont fait reprendre et l'heure d'arrivée. Aucun ne change entre
 * deux passages de la ligne blanche. Les envoyer trente fois par seconde, c'est treize octets par
 * voiture pour répéter la même chose. Ils partent dans un bloc séparé, une image sur quinze, et une
 * perte se répare au bloc suivant — le canal n'est de toute façon ni fiable ni ordonné. À huit
 * joueurs cela coûte sept octets par image en moyenne, pour que l'invité voie le même classement
 * que l'hôte au lieu d'un écran vide.
 */
'use strict';

const PQ_MAGIE = 0xE0;          // première image du paquet : reconnaître un instantané d'autre chose
const PQ_LENT = 15;             // une image sur quinze porte le bloc lent
const PQ_XY = 16;               // pas de quantification de x et y : un seizième de pixel
const PQ_MARGE_MIN = 256;       // jamais moins, même sur un circuit immense
const PQ_S = 8;                 // pas sur l'abscisse curviligne : un huitième de mètre
const PQ_CHAMPS = 17;           // ce que `Race.snapshot` met par voiture
/* Les champs qui voyagent dans le bloc lent, et sa taille en octets.

   Nommés une seule fois : l'encodage, le décodage, le report du bloc précédent et la taille du
   paquet doivent s'accorder, et c'est la quatrième liste qu'on oublie de mettre à jour quand on
   ajoute un champ — celle du report, qui ne se voit pas puisqu'elle ne sert qu'une image sur quinze. */
const PQ_LENTS = [12, 13, 14, 15, 16];
const PQ_LENT_O = 4 + 2 + 1 + 2 + 4;

/* Le cadre de référence, pris sur le circuit que les deux écrans connaissent déjà.

Rien de tout cela ne voyage : l'hôte et l'invité courent sur le même circuit, donc ils calculent le
même cadre. Transmettre l'origine à chaque image aurait coûté quatre octets pour une valeur qui ne
bouge jamais. */
function pqCadre(track) {
  const b = track.bounds;
  /* La marge prend TOUT ce que l'entier court laisse, au lieu d'une valeur posée à la main.

  Un entier court au seizième de pixel couvre 4095 px ; le plus grand circuit en occupe 1531. Le
  reste ne sert à rien d'autre qu'à absorber les sorties de route, donc on le lui donne : 1282 px
  de chaque côté au Mans, davantage ailleurs. La plus grande sortie mesurée sur douze courses
  complètes vaut 21,2 px — la marge la couvre soixante fois.

  Au-delà, l'encodage BORNE au lieu de boucler. C'est le comportement voulu : un entier qui boucle
  renvoie la voiture à l'autre bout de la carte, là où une borne la laisse collée au bord d'un
  monde qu'elle a de toute façon quitté. */
  const dispo = 65535 / PQ_XY;
  const span = Math.max(b.maxX - b.minX, b.maxY - b.minY);
  const marge = Math.max(PQ_MARGE_MIN, (dispo - span) / 2);
  return { x0: b.minX - marge, y0: b.minY - marge };
}

const pqBorne = (v, hi) => (v < 0 ? 0 : v > hi ? hi : v);

/** Le tableau de `Race.snapshot()` → des octets. `lent` force le bloc lent (utile à l'essai). */
function pqEncode(snap, track, lent) {
  const n = Math.floor((snap.length - 4) / PQ_CHAMPS);
  const c = pqCadre(track);
  const avecLent = lent === undefined ? (snap[0] % PQ_LENT) === 0 : !!lent;
  const taille = 10 + n * 20 + (avecLent ? n * PQ_LENT_O : 0);
  const buf = new ArrayBuffer(taille);
  const v = new DataView(buf);
  let p = 0;
  v.setUint8(p, PQ_MAGIE); p += 1;
  v.setUint8(p, (avecLent ? 1 : 0) | (n << 1)); p += 1;    // drapeau + nombre de voitures
  v.setUint16(p, snap[0] & 0xffff); p += 2;                // la séquence tourne, comme avant
  v.setUint32(p, Math.max(0, snap[1])); p += 4;            // le temps, en centièmes
  v.setUint8(p, snap[2]); p += 1;
  v.setUint8(p, pqBorne(Math.round(snap[3] / 10), 255)); p += 1;   // décompte, au dixième
  for (let i = 0; i < n; i++) {
    const o = 4 + i * PQ_CHAMPS;
    v.setUint16(p, pqBorne(Math.round((snap[o] / 100 - c.x0) * PQ_XY), 65535)); p += 2;
    v.setUint16(p, pqBorne(Math.round((snap[o + 1] / 100 - c.y0) * PQ_XY), 65535)); p += 2;
    v.setInt16(p, snap[o + 2]); p += 2;                    // cap, au millième de radian
    v.setInt16(p, snap[o + 3]); p += 2;                    // vitesse, au centième
    v.setInt16(p, snap[o + 4]); p += 2;
    v.setInt16(p, snap[o + 5]); p += 2;
    v.setUint16(p, pqBorne(Math.round(snap[o + 6] / 100 * PQ_S), 65535)); p += 2;
    v.setInt16(p, snap[o + 7]); p += 2;                    // écart latéral, au centième
    v.setInt8(p, pqBorne(snap[o + 9] + 128, 255) - 128); p += 1;
    v.setInt8(p, pqBorne(snap[o + 10] + 128, 255) - 128); p += 1;
    v.setUint8(p, snap[o + 11] & 0xff); p += 1;
    v.setUint8(p, pqBorne(snap[o + 8], 255)); p += 1;      // tour
  }
  if (avecLent) {
    for (let i = 0; i < n; i++) {
      const o = 4 + i * PQ_CHAMPS;
      v.setUint32(p, Math.max(0, snap[o + 12])); p += 4;   // meilleur tour, au millième
      v.setUint16(p, pqBorne(snap[o + 13], 65535)); p += 2;
      v.setUint8(p, pqBorne(snap[o + 14], 255)); p += 1;    // sorties de piste
      v.setUint16(p, pqBorne(snap[o + 15], 65535)); p += 2; // temps repris, au centième
      v.setUint32(p, Math.max(0, snap[o + 16])); p += 4;    // heure d'arrivée, au centième
    }
  }
  return new Uint8Array(buf);
}

/* Des octets → le tableau que `Race.applySnapshot` attend.

`garde` porte le dernier bloc lent reçu : quand l'image courante n'en a pas, on remet celui d'avant
plutôt que des zéros. Sans lui, le meilleur tour clignoterait quatorze images sur quinze. */
function pqDecode(octets, track, garde) {
  const u = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  if (u.length < 10) return null;
  const v = new DataView(u.buffer, u.byteOffset, u.byteLength);
  if (v.getUint8(0) !== PQ_MAGIE) return null;
  const t = v.getUint8(1);
  const avecLent = !!(t & 1), n = t >> 1;
  if (u.length < 10 + n * 20 + (avecLent ? n * PQ_LENT_O : 0)) return null;
  const c = pqCadre(track);
  const snap = new Array(4 + n * PQ_CHAMPS);
  let p = 2;
  snap[0] = v.getUint16(p); p += 2;
  snap[1] = v.getUint32(p); p += 4;
  snap[2] = v.getUint8(p); p += 1;
  snap[3] = v.getUint8(p) * 10; p += 1;
  for (let i = 0; i < n; i++) {
    const o = 4 + i * PQ_CHAMPS;
    snap[o] = Math.round((v.getUint16(p) / PQ_XY + c.x0) * 100); p += 2;
    snap[o + 1] = Math.round((v.getUint16(p) / PQ_XY + c.y0) * 100); p += 2;
    snap[o + 2] = v.getInt16(p); p += 2;
    snap[o + 3] = v.getInt16(p); p += 2;
    snap[o + 4] = v.getInt16(p); p += 2;
    snap[o + 5] = v.getInt16(p); p += 2;
    snap[o + 6] = Math.round(v.getUint16(p) / PQ_S * 100); p += 2;
    snap[o + 7] = v.getInt16(p); p += 2;
    snap[o + 9] = v.getInt8(p); p += 1;
    snap[o + 10] = v.getInt8(p); p += 1;
    snap[o + 11] = v.getUint8(p); p += 1;
    snap[o + 8] = v.getUint8(p); p += 1;
  }
  for (let i = 0; i < n; i++) {
    const o = 4 + i * PQ_CHAMPS;
    if (avecLent) {
      snap[o + 12] = v.getUint32(p); p += 4;
      snap[o + 13] = v.getUint16(p); p += 2;
      snap[o + 14] = v.getUint8(p); p += 1;
      snap[o + 15] = v.getUint16(p); p += 2;
      snap[o + 16] = v.getUint32(p); p += 4;
    } else {
      const g = garde && garde[i];
      for (let k = 0; k < PQ_LENTS.length; k++) snap[o + PQ_LENTS[k]] = g ? g[k] : 0;
    }
  }
  return { snap, lent: avecLent ? pqGarde(snap, n) : null };
}

function pqGarde(snap, n) {
  const g = new Array(n);
  for (let i = 0; i < n; i++) {
    const o = 4 + i * PQ_CHAMPS;
    g[i] = PQ_LENTS.map((k) => snap[o + k]);
  }
  return g;
}

if (typeof module !== 'undefined') module.exports = { pqEncode, pqDecode, pqGarde, PQ_LENT, PQ_CHAMPS };
