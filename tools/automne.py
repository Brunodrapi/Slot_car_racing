#!/usr/bin/env python3
"""LA PLANCHE D'AUTOMNE, découpée et nommée.

`decoupe-sprites.py --damier` sait déjà séparer ce qui est posé sur un damier de transparence,
mais il rend cent dix-huit morceaux numérotés, et il rate le haut de la planche : les grandes
couronnes s'y chevauchent, donc elles sortent collées deux par deux. Ce fichier tranche les deux
questions que l'outil générique ne peut pas trancher — OÙ couper une couronne qui touche sa
voisine, et COMMENT s'appelle chaque morceau.

Les rectangles du haut sont relevés à la main sur la planche : c'est du travail d'une fois, et
c'est plus honnête qu'un sixième seuil réglé jusqu'à ce que ça tombe juste.

Le bas est pris tel que l'outil le rend, et on n'en garde qu'une sélection, sous son nom. Les
numéros renvoient à la planche de contrôle que l'outil écrit à côté.

L'OMBRE RESTE CUITE, contrairement à la planche d'été. Celle-ci la porte déjà en bas à gauche,
du bon côté par rapport au soleil qu'on a choisi, et la détacher coûterait une passe de plus pour
redessiner ce qui est déjà juste. Le prix est qu'un arbre ombre son voisin au lieu du sol ; à la
densité d'une forêt vue de dessus, ça ne se distingue pas.

LA PLANCHE SOURCE N'EST PAS DANS LE DÉPÔT : c'est un envoi, et elle pèse plus que les soixante
sprites qu'on en tire. Son chemin se passe en argument ; la valeur par défaut est celle de la
session où la découpe a été faite, gardée pour mémoire.

    python3 -I tools/automne.py [planche.webp]
"""
import os, sys, json
import numpy as np
from PIL import Image
from importlib import import_module

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
_d = import_module('decoupe-sprites')

PLANCHE = ('/tmp/claude-0/-home-user-Slot-car-racing/'
           '1db20dc9-ebd3-5efc-a770-ef402b418e20/images/14.webp')
if len(sys.argv) > 1:
    PLANCHE = sys.argv[1]
SORTIE = 'art/decor/automne'

# --- le haut de la planche, à la main : nom, rectangle, largeur en mètres, ancre -----------------
# L'ancre est la hauteur, dans la boîte, du point d'appui au sol. Une couronne vue de dessus
# s'appuie en son milieu ; un conifère dessiné en flamme s'appuie sur sa base.
# SIX COURONNES MANQUENT À L'APPEL, et c'est volontaire. Là où deux couronnes se touchent par le
# FEUILLAGE et non par la litière, aucune érosion ne les sépare : on en ressort soit avec un bloc
# du voisin collé au bord, soit avec un arbre tranché au couteau. Sept feuillus et cinq conifères
# suffisent largement à une forêt — la planche d'été en avait neuf et neuf — et un sprite propre
# en moins vaut mieux qu'un sprite sale en plus. Le dénudé n° 2 est tombé pour la raison inverse :
# ses branches sont si fines que l'érosion qui nettoie les autres le réduit à son tronc.
A_LA_MAIN = [
    ('arbre-1',  (10,   0,  185, 192), 11.0, 0.56),
    ('arbre-3',  (482,  2,  668, 196), 11.5, 0.56),
    ('arbre-4',  (682,  0,  868, 196), 11.5, 0.56),
    ('arbre-6',  (1038, 4, 1182, 192),  9.5, 0.56),
    ('arbre-7',  (8,  192,  188, 350), 10.5, 0.56),
    ('arbre-9',  (392, 196, 528, 348),  9.5, 0.56),
    ('arbre-nu-1', (842, 184, 968, 342), 8.5, 0.58),
    ('conifere-1', (1188, 0, 1246, 202), 4.0, 0.80),
    ('conifere-2', (1246, 0, 1304, 202), 4.0, 0.80),
    ('conifere-4', (1364, 0, 1412, 202), 3.4, 0.80),
    ('conifere-5', (1412, 0, 1472, 202), 4.2, 0.80),
    ('conifere-6', (1374, 204, 1436, 344), 3.4, 0.80),
]

# --- le bas, repris de la découpe automatique : numéro -> nom, largeur en mètres, ancre ----------
# Les numéros sont ceux de `controle.png` produit par
#   python3 -I tools/decoupe-sprites.py <planche> <dossier> --damier --zone=0,350,1500,1000
DU_BAS = [
    # arbustes ronds, les plus utiles : ils font le sous-bois
    (2,  'arbuste-1', 3.4, 0.66), (3,  'arbuste-2', 3.2, 0.66),
    (4,  'arbuste-3', 3.0, 0.66), (14, 'arbuste-4', 2.8, 0.66),
    (25, 'arbuste-5', 2.2, 0.66), (15, 'arbuste-6', 2.8, 0.66),
    (74, 'arbuste-7', 2.4, 0.66), (89, 'arbuste-8', 2.4, 0.66),
    # touffes basses et fleuries, pour les abords
    (5,  'touffe-1', 4.2, 0.70), (10, 'touffe-2', 4.4, 0.70),
    (16, 'touffe-3', 4.0, 0.70), (17, 'touffe-4', 4.0, 0.70),
    (23, 'touffe-5', 3.8, 0.70), (73, 'touffe-6', 2.0, 0.70),
    (75, 'touffe-7', 2.0, 0.70), (103, 'touffe-8', 2.2, 0.70),
    # herbes et plants, le couvre-sol
    (95,  'herbe-1', 2.0, 0.74), (96, 'herbe-2', 1.8, 0.74),
    (107, 'herbe-3', 1.8, 0.74), (108, 'herbe-4', 1.6, 0.74),
    (71,  'plant-1', 2.0, 0.74), (72, 'plant-2', 1.8, 0.74),
    (105, 'plant-3', 2.2, 0.74), (106, 'plant-4', 1.8, 0.74),
    (110, 'plant-5', 1.6, 0.74), (116, 'plant-6', 1.8, 0.74),
    # la litière : c'est elle qui fait l'automne au sol
    (61,  'feuilles-1', 3.6, 0.50), (101, 'feuilles-2', 3.8, 0.50),
    (85,  'feuilles-3', 3.0, 0.50), (93,  'feuilles-4', 2.6, 0.50),
    (102, 'feuilles-5', 2.2, 0.50), (57,  'feuilles-6', 2.4, 0.50),
    (59,  'feuilles-7', 2.0, 0.50), (114, 'feuilles-8', 1.8, 0.50),
    (44,  'feuille-1', 0.7, 0.50), (47, 'feuille-2', 0.7, 0.50),
    (50,  'feuille-3', 0.7, 0.50), (52, 'feuille-4', 0.9, 0.50),
    # rochers, souches, rondins : le bois mort
    (33, 'rocher-1', 3.2, 0.62), (34, 'rocher-2', 3.0, 0.62),
    (37, 'rocher-3', 2.6, 0.62), (38, 'rocher-4', 1.6, 0.62),
    (55, 'rocher-5', 2.4, 0.62),
    (56, 'souche-1', 2.2, 0.68), (77, 'souche-2', 1.8, 0.68),
    (36, 'rondin-1', 3.4, 0.62), (65, 'rondin-2', 2.8, 0.62),
    (98, 'rondin-3', 2.6, 0.62),
]


def damier(a):
    """Le masque du fond : clair et sans teinte. Voir `decoupe-sprites.py --damier`."""
    return (a.mean(axis=2) > 188) & (a.max(axis=2) - a.min(axis=2) < 32)


def detoure(bout, seul=False):
    """Rend le rectangle en RGBA, fond du damier retiré, puis recadré au contenu.

    `seul` ne garde que l'objet du MILIEU du rectangle, et c'est ce qui rend les rectangles du
    haut utilisables. Les couronnes s'y touchent par leur litière et par l'ombre, jamais par le
    feuillage : une érosion de cinq pixels casse ces ponts-là sans entamer une couronne, on
    étiquette ce qui reste, on garde l'amas qui couvre le centre, puis on le laisse regrandir
    dans la silhouette d'origine. Le voisin, lui, devient un autre amas et s'en va.

    Sans ça, il fallait des rectangles si serrés qu'ils tranchaient le feuillage au couteau — on
    gagnait un bord droit bien visible d'un côté et un éclat du voisin de l'autre."""
    a = np.asarray(bout, dtype=np.int16)
    fond = damier(a)
    if seul:
        # LE DAMIER PRIS DIRECTEMENT, sans passer par la liaison au bord. Le houppier d'un arbre
        # dénudé enferme du damier entre ses branches : relié à rien, il était rendu à l'objet, et
        # l'arbre arrivait avec un vitrail gris entre les branches. Dans une couronne il n'y a
        # rien de clair et de gris à protéger — l'ombre cuite est à cent et quelques de clarté,
        # bien en dessous du seuil — donc la liaison au bord n'y sert plus à rien.
        obj = _d.erode(_d.dilate(~fond, _d.FERME), _d.FERME)
        obj = _amas_du_centre(obj, r=7)
    else:
        obj = _d.erode(_d.dilate(~_d.relie_au_bord(fond), _d.FERME), _d.FERME)
    rgba = np.dstack([a.astype(np.uint8), (obj * 255).astype(np.uint8)])
    im = ombre_translucide(Image.fromarray(rgba, 'RGBA'))
    return im.crop(im.getbbox())


def ombre_translucide(im):
    """L'ombre cuite devient une vraie ombre : sombre et translucide.

    Sur la planche, les sprites sont posés sur un damier blanc, et leur ombre y est peinte en
    BLEU-GRIS CLAIR — à cent vingt-trois de clarté. Sur ce fond-là elle se lit comme une ombre ;
    posée sur une herbe à cent cinquante, elle se lit comme une flaque. Et comme elle est opaque,
    elle cache le sol au lieu de l'assombrir : deux arbres voisins faisaient deux taches pâles
    côte à côte, là où deux ombres devraient se recouvrir en s'assombrissant.

    On la reconnaît sans risque : c'est le seul endroit d'un feuillage d'automne où le bleu
    dépasse le rouge. On y met un brun très sombre, et une opacité qui suit la densité de
    l'ombre d'origine — plus elle était foncée, plus elle couvre. Les rochers gris s'en tirent :
    leur bleu ne dépasse jamais leur rouge de plus d'une poignée de niveaux.

    Mesuré : sur `arbre-1`, treize pour cent des pixels opaques sont de l'ombre."""
    a = np.asarray(im).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    al = a[..., 3]
    ombre = (b > r + 12) & (al > 40)
    if not ombre.any():
        return im
    lum = a[..., :3].mean(axis=2)
    # 0,22 pour l'ombre la plus pâle, 0,46 pour la plus dense : une ombre de feuillage ne noircit
    # pas le sol, elle le refroidit
    cache = np.clip((205 - lum) / 150.0, 0.0, 1.0) * 0.30 + 0.18
    out = a.copy()
    out[..., 0] = np.where(ombre, 38, r)
    out[..., 1] = np.where(ombre, 42, g)
    out[..., 2] = np.where(ombre, 30, b)
    out[..., 3] = np.where(ombre, (cache * 255).astype(np.int16), al)
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def _amas_du_centre(obj, r=5):
    """L'amas qui couvre le centre, regrandi jusqu'au bord de `obj`."""
    from collections import deque
    h, w = obj.shape
    noyau = _d.erode(obj, r)
    cy, cx = h // 2, w // 2
    # le germe : le pixel de noyau le plus proche du centre
    ys, xs = np.nonzero(noyau)
    if not len(ys):
        return obj
    k = np.argmin((ys - cy) ** 2 + (xs - cx) ** 2)
    pris = np.zeros_like(obj)
    q = deque([(int(ys[k]), int(xs[k]))]); pris[ys[k], xs[k]] = True
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and noyau[ny, nx] and not pris[ny, nx]:
                pris[ny, nx] = True; q.append((ny, nx))
    # on regrandit DANS la silhouette : autant de passes que l'érosion en a mangé, plus la marge
    for _ in range(r + _d.FERME + 2):
        pris = _d.dilate(pris, 1) & obj
    return pris


def main():
    planche = Image.open(PLANCHE).convert('RGB')
    os.makedirs(SORTIE, exist_ok=True)
    fiches = []

    for nom, zone, m, anc in A_LA_MAIN:
        # on élargit le rectangle : c'est `seul` qui coupe, plus le cadre
        x1, y1, x2, y2 = zone
        large = (max(0, x1 - 14), max(0, y1 - 10),
                 min(planche.width, x2 + 14), min(planche.height, y2 + 10))
        im = detoure(planche.crop(large), seul=True)
        f = f'{SORTIE}/{nom}.webp'
        im.save(f, 'WEBP', quality=92, method=6)
        fiches.append({'id': nom, 'fichier': f, 'm': m, 'anc': anc,
                       'px': [im.width, im.height]})

    # le bas : on relance la découpe automatique sur la zone basse et on pioche par numéro
    bas = planche.crop((0, 350, 1500, 1000))
    a = np.asarray(bas, dtype=np.int16)
    masque = _d.relie_au_bord(damier(a))
    obj = _d.erode(_d.dilate(~masque, _d.FERME), _d.FERME)
    boites = _d.composantes(obj, _d.MIN_COTE)
    boites.sort(key=lambda b: (b[1] // 40, b[0]))
    rgba = Image.fromarray(np.dstack([a.astype(np.uint8), (obj * 255).astype(np.uint8)]), 'RGBA')

    for num, nom, m, anc in DU_BAS:
        if num >= len(boites):
            raise SystemExit(f'{nom} : le numéro {num} dépasse les {len(boites)} morceaux trouvés')
        x1, y1, x2, y2, _n = boites[num]
        im = ombre_translucide(rgba.crop((x1, y1, x2, y2)))
        f = f'{SORTIE}/{nom}.webp'
        im.save(f, 'WEBP', quality=92, method=6)
        fiches.append({'id': nom, 'fichier': f, 'm': m, 'anc': anc,
                       'px': [im.width, im.height]})

    with open(f'{SORTIE}/automne.json', 'w', encoding='utf-8') as fp:
        json.dump({'vegetation': fiches}, fp, ensure_ascii=False, indent=1)

    poids = sum(os.path.getsize(f['fichier']) for f in fiches)
    print(f'{len(fiches)} sprites -> {SORTIE}   {poids // 1024} Ko')

    # la planche de contrôle, sur magenta, comme l'outil générique
    cols, cell = 7, 200
    rows = (len(fiches) + cols - 1) // cols
    from PIL import ImageDraw
    ctrl = Image.new('RGB', (cols * cell, rows * cell), (255, 0, 160))
    dr = ImageDraw.Draw(ctrl)
    for i, fi in enumerate(fiches):
        b = Image.open(fi['fichier'])
        k = min((cell - 26) / b.width, (cell - 26) / b.height, 1.0)
        b = b.resize((max(1, int(b.width * k)), max(1, int(b.height * k))))
        ctrl.paste(b, ((i % cols) * cell + (cell - b.width) // 2,
                       (i // cols) * cell + (cell - b.height) // 2), b)
        dr.text(((i % cols) * cell + 6, (i // cols) * cell + 4), fi['id'], fill=(255, 255, 255))
    ctrl.save('/tmp/controle-automne.png')
    return 0


if __name__ == '__main__':
    sys.exit(main())
