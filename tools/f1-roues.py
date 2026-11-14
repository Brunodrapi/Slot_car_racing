#!/usr/bin/env python3
"""Les roues des F1, d'aplomb : quatre pneus symétriques autour de l'axe de la carrosserie (0.52.71).

    python3 tools/f1-roues.py            # réécrit sprites/top/<f1>.png et affiche les gabarits à
                                         # recopier dans js/cars.js (registerWheelSprite)

« Sur au moins une F1 les roues arrière ne font pas la même taille et les roues avant ne sont pas
centrées ! Il faut que tu révises tous les modèles F1 » — Bruno.

CE QUI N'ALLAIT PAS. Dans les neuf illustrations vues de dessus, la carrosserie est dessinée de 2 à
10 px plus bas que le milieu de l'image (sur 256), alors que les deux roues arrière, peintes dans
l'image, sont restées à peu près centrées sur le cadre — et celle du haut est souvent rognée par le
bord. D'un côté la roue sort plus loin de la carrosserie que de l'autre (Dodici T : 75 px contre 66),
et l'une paraît plus grosse. Les roues avant, elles, sont posées par le jeu sur les moyeux dessinés —
asymétriques eux aussi : 7 px de travers sur la Windsor 07, 5 sur la Dodici T, 6 sur la Sixpence.

CE QUE FAIT LE SCRIPT, pour chaque F1 :
1. l'axe de la carrosserie : la hauteur qui superpose le mieux la silhouette à son reflet, sur la
   partie centrale (pontons, cockpit), là où il n'y a ni pneu ni aileron ;
2. les deux roues arrière sont ôtées de l'image — seulement leurs pixels de pneu (gris très sombre,
   sans couleur) : l'aileron, la suspension et leurs contours restent ;
3. l'image est recalée d'un nombre entier de pixels pour que l'axe tombe au milieu du cadre — la
   voiture est ainsi centrée sur sa position, et son ombre avec elle ;
4. les gabarits des quatre roues, que le jeu dessine (js/carart.js, `drawTires`) :
   - arrière : même taille des deux côtés (la moyenne des deux mesurées : la plupart sont rognées
     par le bord du cadre), et même écart à l'axe — le plus petit des deux bords intérieurs, pour que
     la roue rejoigne toujours la suspension dessinée ; elles passent SOUS la carrosserie, comme avant ;
   - avant : à la même hauteur qu'avant, à l'écart moyen des deux moyeux, symétriques.

Les illustrations d'origine sont gardées dans `art-src/voitures/f1-roues/` : le script repart
toujours d'elles, si bien qu'on peut le relancer autant de fois qu'on veut.
"""
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

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


def traite(nom):
    src = os.path.join(SOURCE, nom + '.png')
    dest = os.path.join(RACINE, 'sprites', 'top', nom + '.png')
    if not os.path.exists(src):
        os.makedirs(SOURCE, exist_ok=True)
        shutil.copyfile(dest, src)
    im = np.asarray(Image.open(src).convert('RGBA')).copy()
    h, w = im.shape[:2]
    h0 = h                             # la hauteur d'origine : celle des gabarits d'avant
    ax, iou = axe(im[..., 3] > 128)
    haut, bas, masque = roues_arriere(im.astype(int))

    # 1. les roues arrière ôtées
    im[masque] = 0

    # 2. l'axe au milieu du cadre, au pixel près : en décalant l'image si rien n'en sort, sinon en
    #    agrandissant le cadre du côté qui manque (la largeur ne change pas, donc l'échelle non plus)
    dy = int(round(h / 2 - ax))
    sort = int((im[:max(0, -dy), :, 3] > 8).sum() + (im[h - max(0, dy):, :, 3] > 8).sum()) if dy else 0
    if not sort:
        im = np.roll(im, dy, axis=0)
        if dy > 0:
            im[:dy] = 0
        elif dy < 0:
            im[h + dy:] = 0
        ax2 = ax + dy
    else:
        cadre = np.zeros((h + 2 * abs(dy), w, 4), np.uint8)
        haut_cadre = 2 * dy if dy > 0 else 0
        cadre[haut_cadre:haut_cadre + h] = im
        im, ax2 = cadre, ax + haut_cadre
    h = im.shape[0]                    # l'axe est désormais au milieu du cadre, au demi-pixel près
    Image.fromarray(im).save(dest, optimize=True)

    # 3. les gabarits, en fractions du nouveau cadre (spriteAxle : 0..1, le moteur retire 0,5)
    def frac_y(y):
        return round(y / h, 4)
    # arrière : la moyenne des deux (la plupart touchent le bord du cadre, qui les rogne : aucune des
    # deux n'est sûre), au plus petit des deux écarts intérieurs, pour que la roue rejoigne toujours
    # la suspension dessinée
    larg = round(((haut['y1'] - haut['y0']) + (bas['y1'] - bas['y0'])) / 2)
    long_ = round(((haut['x1'] - haut['x0']) + (bas['x1'] - bas['x0'])) / 2)
    x0 = min(haut['x0'], bas['x0'])
    interieur = min(ax - haut['y1'], bas['y0'] - ax)
    d_ar = interieur + larg / 2
    arriere = dict(x=round((x0 + long_ / 2) / w, 4), haut=frac_y(ax2 - d_ar), bas=frac_y(ax2 + d_ar),
                   longueur=round(long_ / w, 4), largeur=round(larg / h, 4))
    # avant : l'écart moyen des deux moyeux
    fx, ft, fb, fl, fw, dessus, susp = AVANT[nom]
    d_av = (fb - ft) * h0 / 2
    avant = dict(x=fx, haut=frac_y(ax2 - d_av), bas=frac_y(ax2 + d_av), longueur=fl, largeur=round(fw * h0 / h, 4),
                 dessus=dessus, suspension=susp, decalage_px=round((ft + fb) / 2 * h0 - ax, 1))
    return dict(nom=nom, h=h, axe=ax, iou=round(iou, 3), recale_px=dy, cadre_agrandi=bool(sort),
                arriere_mesure=dict(haut=haut, bas=bas, ecart_int=[ax - haut['y1'], bas['y0'] - ax]),
                arriere=arriere, avant=avant)


def main():
    res = [traite(n) for n in AVANT]
    json.dump(res, open(os.path.join(RACINE, 'docs', 'f1-roues', 'gabarits.json'), 'w'), indent=1, default=int)
    for r in res:
        a, v = r['arriere'], r['avant']
        print(f"// {r['nom']}: axe {r['axe']} (recalé de {r['recale_px']:+d} px{', cadre agrandi à ' + str(r['h']) if r['cadre_agrandi'] else ''}), "
              f"roues avant décalées de {v['decalage_px']:+} px, écarts arrière {r['arriere_mesure']['ecart_int']}")
        avant = f"spriteAxle({v['x']},{v['haut']},{v['bas']},{v['longueur']},{v['largeur']},true{',true' if v['suspension'] else ''})"
        arriere = f"spriteAxle({a['x']},{a['haut']},{a['bas']},{a['longueur']},{a['largeur']})"
        print(f"registerWheelSprite('{r['nom']}', {avant}, {arriere});")


if __name__ == '__main__':
    sys.exit(main())
