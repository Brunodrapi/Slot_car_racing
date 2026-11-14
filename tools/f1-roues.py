#!/usr/bin/env python3
"""Les roues des F1, d'aplomb : quatre pneus symétriques autour de l'axe de la carrosserie (0.52.71-72).

    python3 tools/f1-roues.py            # réécrit sprites/top/<f1>.png et les gabarits des roues
                                         # entre les repères <f1-roues> de js/cars.js

« Sur au moins une F1 les roues arrière ne font pas la même taille et les roues avant ne sont pas
centrées ! Il faut que tu révises tous les modèles F1 », puis, après une première reprise qui ne
faisait que recentrer : « Sur la Windsor et Le Coq les roues avant ne sont toujours pas équilibrées.
Purosangue pareil. Sur plusieurs voitures les roues arrière ne dépassent pas non plus équitablement
du châssis » — Bruno.

CE QUI N'ALLAIT PAS, dans les neuf illustrations vues de dessus :
- la voiture est PENCHÉE dans l'image : l'avant descend de 1,2 à 1,8° (Dodici T 1,8°, Arrow 23 1,7°,
  Sixpence 1,6°, Fan 46 1,5°, Windsor 1,4°, Coq Bleu 1,25°, Wedge 72 0,9° ; la Ground 79 et la Turbo
  10 sont droites). Des roues alignées sur l'axe du jeu, qui est horizontal, tombent alors trop près
  de la carrosserie d'un côté à l'avant et de l'autre côté à l'arrière ;
- certaines sont en plus CINTRÉES : la carrosserie droite, mais les ailerons (et le nez de la Fan 46)
  de 3 à 7 px du même côté — Turbo 10, Fan 46, Arrow 23, Coq Bleu ;
- la carrosserie est de 2 à 10 px sous le milieu du cadre, alors que les roues arrière, peintes dans
  l'image, y sont restées centrées (souvent rognées par le bord) : l'une sort plus loin et paraît
  plus grosse ;
- les roues avant, posées par le jeu sur les moyeux dessinés, en héritaient.

CE QUE FAIT LE SCRIPT, pour chaque F1, en repartant toujours de l'illustration d'origine :
1. le dessin redressé : l'inclinaison est la pente (Theil-Sen) du milieu de la silhouette, colonne
   par colonne ; il est tourné d'autant, et ramené à la largeur d'origine (1 à 2 % plus petit) pour
   que les coins des ailerons ne sortent pas du cadre ;
2. les deux roues arrière ôtées — seulement leurs pixels de pneu (gris très sombre, sans couleur) :
   l'aileron, la suspension et leurs contours restent ;
3. le dessin décintré : l'aileron arrière, le nez et l'aileron avant ramenés sur le milieu de la
   carrosserie, l'aileron arrière d'un bloc, l'avant en pente douce ; la carrosserie ne bouge pas ;
4. l'axe de la carrosserie (la hauteur qui superpose le mieux la silhouette centrale à son reflet)
   mis au milieu du cadre — la voiture est centrée sur sa position, et son ombre avec elle ;
5. les gabarits des quatre roues, que le jeu dessine (js/carart.js, `drawTires`), écrits dans
   js/cars.js :
   - arrière : même taille des deux côtés (la moyenne des deux mesurées : la plupart sont rognées
     par le bord du cadre), et même écart à l'axe — le plus petit des deux bords intérieurs, pour que
     la roue rejoigne toujours la suspension dessinée ; elles passent SOUS la carrosserie, comme avant ;
   - avant : les moyeux d'avant, tournés et décintrés avec le dessin, à leur écart moyen, symétriques.

Les illustrations d'origine sont gardées dans `art-src/voitures/f1-roues/` : le script repart
toujours d'elles, si bien qu'on peut le relancer autant de fois qu'on veut.
"""
import json
import math
import os
import shutil
import sys

import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.stats import theilslopes

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(RACINE, 'art-src', 'voitures', 'f1-roues')

# Les roues avant telles qu'elles étaient posées (js/cars.js avant la 0.52.71), en fractions du
# cadre d'origine : x, haut, bas, longueur, largeur, au-dessus de la carrosserie, triangles dessinés.
AVANT = {
    'tyrrellp34':   (.722, .285, .817, .085, .14, True, False),
    'ferrari312t':  (.800, .200, .885, .14, .15, True, False),
    'mclarenm23':   (.779, .204, .868, .14, .17, True, False),
    'lotus79':      (.794, .196, .847, .14, .17, True, False),
    'lotus72':      (.782, .217, .809, .14, .16, True, False),
    'brabhambt46b': (.782, .251, .817, .14, .18, True, False),
    'williamsfw07': (.790, .230, .790, .14, .17, True, True),
    'ligierjs11':   (.792, .191, .885, .14, .17, True, False),
    'renaultrs10':  (.795, .213, .813, .14, .18, True, False),
}
# le second essieu avant de la Sixpence Hexa (six roues) : x, haut, bas
SIXPENCE_2E = (.813, .285, .817)   # x = .313 + .5 ; mêmes moyeux que le premier

PNEU_MAX = 75        # un pixel de pneu : gris très sombre…
PNEU_SAT = 30        # …et sans couleur
PNEU_REFLET = 100    # le reflet d'un pneu monte jusque-là
PENTE_MIN = 0.3      # en degrés : en dessous, le dessin n'est pas tourné
CINTRE_MIN = 1.5     # en px : en dessous, le dessin n'est pas décintré


def axe(alpha):
    """La hauteur (en px, au demi-pixel) qui superpose le mieux la silhouette centrale à son reflet."""
    h, w = alpha.shape
    zone = alpha[:, int(w * .35):int(w * .72)]
    meilleur = None
    for c2 in range(int(h * .8), int(h * 1.2) + 1):
        ys = np.arange(h)
        yy = c2 - ys
        ok = (yy >= 0) & (yy < h)
        a, b = zone[ys[ok]], zone[yy[ok]]
        iou = (a & b).sum() / max(1, (a | b).sum())
        if meilleur is None or iou > meilleur[1]:
            meilleur = (c2 / 2, iou)
    return meilleur


def roues_arriere(im):
    """Les deux roues arrière : leurs dimensions (hauteur, longueur, bord intérieur, x de début) et
    le masque de leurs pixels.

    Le cœur d'un pneu se trouve par une ouverture 25 × 25 sur le gris très sombre : il ne reste que
    les grandes plages, pas les traits de contour ni les bras de suspension. On en repart pour
    reprendre, de proche en proche, tout ce qui est encore du pneu — le contour noir, le reflet gris
    clair, le bord adouci — sans dépasser son rectangle de plus de 8 px, et sans toucher à ce qui
    borde une pièce de couleur (le contour d'un aileron posé sur le pneu reste à l'aileron). Les
    dimensions se lisent sur les rangées et colonnes couvertes aux deux tiers : un trait voisin qui
    longe le pneu ne l'agrandit pas."""
    h, w = im.shape[:2]
    a = im[..., 3]
    mx, mn = im[..., :3].max(-1), im[..., :3].min(-1)
    gris = (mx - mn < PNEU_SAT)
    sombre = (a > 128) & (mx < PNEU_MAX) & gris
    teinte = (a > 0) & (mx < PNEU_REFLET) & gris
    protege = ndimage.binary_dilation((a > 128) & ~teinte, iterations=2)
    coeur = ndimage.binary_opening(sombre, structure=np.ones((25, 25)))
    lab, _ = ndimage.label(coeur)
    comps = []
    for i, (ys, xs) in enumerate(ndimage.find_objects(lab), 1):
        cy = (ys.start + ys.stop) / 2
        if xs.stop < w * .45 and abs(cy - h / 2) > h * .15:
            comps.append((i, ys, xs, int((lab[ys, xs] == i).sum()), cy))
    haut = max((c for c in comps if c[4] < h / 2), key=lambda c: c[3])
    bas = max((c for c in comps if c[4] >= h / 2), key=lambda c: c[3])
    masque = np.zeros((h, w), bool)
    roues = []
    for i, ys, xs, _, _ in (haut, bas):
        # vers l'extérieur, de quoi reprendre le contour et le reflet que l'ouverture a laissés ; vers
        # l'intérieur et sur les côtés, à peine le contour : au-delà, ce sont les bras de suspension
        dehors_haut = ys.start < h / 2
        zone = np.zeros((h, w), bool)
        zone[max(0, ys.start - (8 if dehors_haut else 3)):ys.stop + (3 if dehors_haut else 8),
             max(0, xs.start - 3):xs.stop + 3] = True
        pneu = ndimage.binary_propagation(lab == i, mask=teinte & zone)
        masque |= pneu & ~protege
        lignes = np.where(pneu.sum(1) >= (xs.stop - xs.start) * 2 / 3)[0]
        colonnes = np.where(pneu.sum(0) >= (ys.stop - ys.start) * 2 / 3)[0]
        roues.append(dict(y0=int(lignes.min()), y1=int(lignes.max()) + 1, x0=int(colonnes.min()), x1=int(colonnes.max()) + 1,
                          touche_le_bord=bool(lignes.min() == 0 or lignes.max() == h - 1)))
    return roues[0], roues[1], masque


def pente(im):
    """L'inclinaison du dessin, en degrés (positive : l'avant descend dans l'image).

    Le milieu de la silhouette, colonne par colonne, roues arrière ôtées, et la pente de Theil-Sen
    sur ces milieux : une médiane de pentes, que l'aileron d'un côté ou un rétroviseur ne tirent pas."""
    tmp = im.copy()
    _, _, m = roues_arriere(tmp.astype(int))
    tmp[m] = 0
    a = tmp[..., 3] > 128
    xs, cs = [], []
    for x in range(2, a.shape[1] - 2, 2):
        ys = np.where(a[:, x])[0]
        if len(ys) > 10:
            xs.append(x)
            cs.append((ys.min() + ys.max()) / 2)
    return math.degrees(math.atan(theilslopes(cs, xs)[0]))


def tourne(im, deg):
    """Le dessin tourné de `deg` degrés dans le sens qui remonte l'avant, autour de son centre.

    Les ailerons touchent les deux bouts de l'image : tournés, leurs coins en sortiraient de 1 à 4 px.
    Plutôt que de les rogner, le dessin tourné est ramené à la largeur d'origine — 1 à 2 % plus petit,
    ce qui ne se voit pas, alors qu'un coin d'aileron coupé net se voit. Alpha prémultiplié (pas de
    liseré sombre au bord) et quadruple résolution le temps de tourner (les traits restent nets).
    Renvoie l'image et son échelle."""
    h, w = im.shape[:2]
    pil = Image.fromarray(im).convert('RGBa').resize((w * 4, h * 4), Image.LANCZOS)
    pil = pil.rotate(deg, resample=Image.BICUBIC, expand=True)
    echelle = w * 4 / pil.width
    pil = pil.resize((w, round(pil.height * echelle / 4)), Image.LANCZOS).convert('RGBA')
    return np.asarray(pil).copy(), echelle


def point_tourne(p, deg, echelle, avant, apres):
    """Où tombe le point `p` (x, y) d'une image de taille `avant` (h, w) après `tourne`, dans l'image
    de taille `apres`."""
    t = math.radians(deg)
    dx, dy = p[0] - avant[1] / 2, p[1] - avant[0] / 2
    return (apres[1] / 2 + echelle * (dx * math.cos(t) + dy * math.sin(t)),
            apres[0] / 2 + echelle * (-dx * math.sin(t) + dy * math.cos(t)))


def cintre(im):
    """Ce dont le milieu du dessin s'écarte de celui de la carrosserie, colonne par colonne (px).

    Redressé, le dessin peut rester cintré : la carrosserie droite, mais les ailerons — et sur la
    Fan 46 le nez — de 3 à 8 px du même côté. On lit le milieu de la silhouette (la médiane des
    colonnes d'une fenêtre, qu'un bras de suspension ou un rétroviseur ne déplace pas) sur l'aileron
    arrière, la carrosserie, le nez et l'aileron avant, et seulement là : entre les deux, les bras de
    suspension et les rétroviseurs ne sont pas symétriques, et les suivre ferait onduler les flancs.
    L'aileron arrière bouge d'un bloc jusqu'à sa face avant ; la carrosserie ne bouge pas ; le nez et
    l'aileron avant rejoignent leur place en pente douce."""
    a = im[..., 3] > 128
    h, w = a.shape
    milieux = np.full(w, np.nan)
    for x in range(w):
        ys = np.where(a[:, x])[0]
        if len(ys) > 4:
            milieux[x] = (ys.min() + ys.max()) / 2

    def lu(f0, f1):
        fen = milieux[int(f0 * w):int(f1 * w) + 1]
        fen = fen[~np.isnan(fen)]
        return float(np.median(fen)) if len(fen) else 0.0
    corps = lu(.3, .65)
    arr, nez, av = lu(.01, .07) - corps, lu(.875, .925) - corps, lu(.93, .99) - corps
    return np.interp(np.arange(w), [0, .10 * w, .17 * w, .76 * w, .9 * w, .96 * w, w], [arr, arr, 0, 0, nez, av, av])


def decintre(im, c):
    """Chaque colonne remontée (ou descendue) de `c[x]` px, au quart de pixel, en alpha prémultiplié."""
    h, w = im.shape[:2]
    k = 4
    big = np.asarray(Image.fromarray(im).convert('RGBa').resize((w * k, h * k), Image.LANCZOS)).copy()
    out = np.zeros_like(big)
    for X in range(w * k):
        d = int(round(-c[min(w - 1, X // k)] * k))
        if d > 0:
            out[d:, X] = big[:-d, X]
        elif d < 0:
            out[:d, X] = big[-d:, X]
        else:
            out[:, X] = big[:, X]
    return np.asarray(Image.fromarray(out, 'RGBa').resize((w, h), Image.LANCZOS).convert('RGBA')).copy()


def traite(nom):
    src = os.path.join(SOURCE, nom + '.png')
    dest = os.path.join(RACINE, 'sprites', 'top', nom + '.png')
    if not os.path.exists(src):
        os.makedirs(SOURCE, exist_ok=True)
        shutil.copyfile(dest, src)
    im0 = np.asarray(Image.open(src).convert('RGBA')).copy()
    h0, w = im0.shape[:2]

    # 1. le dessin redressé (sous 0,3°, on ne touche à rien : tourner adoucit les traits)
    incl = pente(im0)
    deg = incl if abs(incl) >= PENTE_MIN else 0.0
    im, echelle = tourne(im0, deg) if deg else (im0.copy(), 1.0)
    H1, W1 = im.shape[:2]

    # 2. les roues arrière ôtées
    haut, bas, masque = roues_arriere(im.astype(int))
    im[masque] = 0

    # 3. le dessin décintré : ailerons et nez ramenés sur la carrosserie (sous 1,5 px, rien)
    c = cintre(im)
    if np.abs(c).max() < CINTRE_MIN:
        c = np.zeros_like(c)
    else:
        im = decintre(im, c)
    for r in (haut, bas):
        dc = c[(r['x0'] + r['x1']) // 2]
        r['y0'], r['y1'] = r['y0'] - dc, r['y1'] - dc
    ax, iou = axe(im[..., 3] > 128)

    # 4. recadré l'axe au milieu de la hauteur : la hauteur d'origine si rien n'en sort, sinon juste
    #    ce qu'il faut de plus (la largeur reste celle d'origine : c'est elle qui donne l'échelle)
    ys = np.where((im[..., 3] > 8).any(1))[0]
    h = max(h0, 2 * math.ceil(max(ax - ys.min(), ys.max() + 1 - ax)))
    oy, ox = int(round(ax - h / 2)), int(round((W1 - w) / 2))
    cadre = np.zeros((h, w, 4), np.uint8)
    y_a, y_b, x_a, x_b = max(0, oy), min(H1, oy + h), max(0, ox), min(W1, ox + w)
    cadre[y_a - oy:y_b - oy, x_a - ox:x_b - ox] = im[y_a:y_b, x_a:x_b]
    hors_cadre = int((im[..., 3] > 8).sum() - (cadre[..., 3] > 8).sum())
    Image.fromarray(cadre).save(dest, optimize=True)
    axf = ax - oy                      # l'axe dans le cadre final : au milieu, au demi-pixel près

    # 5. les gabarits, en fractions du cadre final (spriteAxle : 0..1, le moteur retire 0,5)
    def frac_y(y):
        return round(y / h, 4)
    # arrière : la moyenne des deux (la plupart touchent le bord du cadre, qui les rogne : aucune des
    # deux n'est sûre), au plus petit des deux écarts intérieurs, pour que la roue rejoigne toujours
    # la suspension dessinée
    larg = round(((haut['y1'] - haut['y0']) + (bas['y1'] - bas['y0'])) / 2)
    long_ = round(((haut['x1'] - haut['x0']) + (bas['x1'] - bas['x0'])) / 2)
    x0 = min(haut['x0'], bas['x0']) - ox
    interieur = min(ax - haut['y1'], bas['y0'] - ax)
    d_ar = interieur + larg / 2
    arriere = dict(x=round((x0 + long_ / 2) / w, 4), haut=frac_y(axf - d_ar), bas=frac_y(axf + d_ar),
                   longueur=round(long_ / w, 4), largeur=round(larg / h, 4))

    # avant : les moyeux tels que les gabarits d'avant les posaient, tournés avec le dessin ; à leur
    # écart moyen, symétriques
    def essieu(fx, ft, fb):
        a = point_tourne((fx * w, ft * h0), deg, echelle, (h0, w), (H1, W1))
        b = point_tourne((fx * w, fb * h0), deg, echelle, (h0, w), (H1, W1))
        a, b = (a[0], a[1] - c[min(w - 1, int(a[0]))]), (b[0], b[1] - c[min(w - 1, int(b[0]))])
        d = (b[1] - a[1]) / 2
        return dict(x=round(((a[0] + b[0]) / 2 - ox) / w, 4), haut=frac_y(axf - d), bas=frac_y(axf + d),
                    decalage_px=round((a[1] + b[1]) / 2 - ax, 1))
    fx, ft, fb, fl, fw, dessus, susp = AVANT[nom]
    avant = dict(essieu(fx, ft, fb), longueur=fl, largeur=round(fw * h0 / h, 4), dessus=dessus, suspension=susp)
    avant2 = essieu(*SIXPENCE_2E) if nom == 'tyrrellp34' else None
    return dict(nom=nom, h=h, inclinaison=round(incl, 2), redresse=round(deg, 2), echelle=round(echelle, 4),
                cintre_px=[round(float(c[int(f * (w - 1))]), 1) for f in (.04, .9, .96)], axe=round(axf, 1), iou=round(iou, 3),
                hors_cadre=hors_cadre, arriere_mesure=dict(haut=haut, bas=bas, ecart_int=[ax - haut['y1'], bas['y0'] - ax]),
                arriere=arriere, avant=avant, avant2=avant2)


def bloc_js(res):
    """Les gabarits, tels qu'ils s'écrivent dans js/cars.js."""
    lignes = []
    for r in res:
        a, v = r['arriere'], r['avant']
        av = f"spriteAxle({v['x']},{v['haut']},{v['bas']},{v['longueur']},{v['largeur']},true{',true' if v['suspension'] else ''})"
        ar = f"spriteAxle({a['x']},{a['haut']},{a['bas']},{a['longueur']},{a['largeur']})"
        if r['avant2']:
            v2 = r['avant2']
            lignes += [f"const p34Front = {av};",
                       f"p34Front.axles.push({round(v2['x'] - .5, 4)});",
                       f"p34Front.centers.push({{x:{round(v2['x'] - .5, 4)},y:{round(v2['haut'] - .5, 4)}}},{{x:{round(v2['x'] - .5, 4)},y:{round(v2['bas'] - .5, 4)}}});",
                       f"registerWheelSprite('{r['nom']}', p34Front, {ar});"]
        else:
            lignes.append(f"registerWheelSprite('{r['nom']}', {av}, {ar});")
    return '\n'.join(lignes)


def main():
    res = [traite(n) for n in AVANT]
    json.dump(res, open(os.path.join(RACINE, 'docs', 'f1-roues', 'gabarits.json'), 'w'), indent=1, default=int)
    for r in res:
        v = r['avant']
        print(f"{r['nom']:13s} penché de {r['inclinaison']:+.2f}° (redressé de {r['redresse']:+.2f}°, ×{r['echelle']}), cintré {r['cintre_px']}, cadre {r['h']} px, "
              f"{r['hors_cadre']} px hors cadre ; moyeux avant {v['decalage_px']:+} px de l'axe ; "
              f"bords intérieurs arrière {r['arriere_mesure']['ecart_int'][0]:.1f} / {r['arriere_mesure']['ecart_int'][1]:.1f} px")
    # les gabarits, recopiés entre les deux repères de js/cars.js
    cars = os.path.join(RACINE, 'js', 'cars.js')
    texte = open(cars, encoding='utf-8').read()
    debut, fin = '// <f1-roues> (tools/f1-roues.py)\n', '\n// </f1-roues>'
    i, j = texte.index(debut) + len(debut), texte.index(fin)
    open(cars, 'w', encoding='utf-8').write(texte[:i] + bloc_js(res) + texte[j:])


if __name__ == '__main__':
    sys.exit(main())
