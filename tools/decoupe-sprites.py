#!/usr/bin/env python3
"""DÉCOUPER UNE PLANCHE DESSINÉE EN SPRITES, avec une transparence qui tient.

La planche arrive sur un fond d'une seule couleur, mais ce fond est TEXTURÉ : la couleur exacte
n'apparaît que sur quelques pourcents des pixels. Un simple « enlève tous les pixels de cette
couleur » laisserait un confetti de fond autour de chaque objet, et surtout il mangerait les verts
des arbres, qui sont de la même famille.

On procède donc en trois temps, et c'est l'ordre qui fait la justesse :

1. Un masque de TOLÉRANCE autour de la couleur de fond. Il marque le fond, mais aussi, à tort, des
   bouts de feuillage clair.
2. On ne garde du masque que ce qui est RELIÉ AU BORD de l'image. Un vert clair au milieu d'une
   couronne n'est relié à rien : il est rendu à l'objet. C'est le seul garde-fou qui distingue
   « cette couleur » de « le fond ».
3. Une fermeture morphologique rebouche les trous d'un pixel laissés par la texture, puis on érode
   d'autant : sans elle le contour part en dentelle.

ON VÉRIFIE CE QU'ON A DÉCOUPÉ. Le piège, déjà rencontré sur le casque du favicon, est qu'une
découpe ratée ressemble à une découpe réussie tant qu'on la regarde sur un fond clair. L'outil
écrit donc aussi une planche de contrôle où chaque sprite est posé sur du magenta : tout reste de
fond ou tout trou dans l'objet y saute aux yeux.

    python3 tools/decoupe-sprites.py <planche.png> <dossier de sortie> [--zone x0,y0,x1,y1]
"""
import sys, os, json
from collections import deque, Counter
import numpy as np
from PIL import Image

TOL = 46          # distance RGB au fond en deçà de laquelle un pixel est candidat au fond
FERME = 2         # rayon de la fermeture morphologique, en pixels
MIN_COTE = 18     # un sprite plus petit que ça est du bruit


def couleur_de_fond(a):
    """La couleur dominante sur un ruban de bord : le fond est ce qui touche le cadre partout."""
    bord = np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3),
                           a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)])
    c = Counter(map(tuple, bord[::7]))
    return np.array(c.most_common(1)[0][0], dtype=np.int16)


def dilate(m, r):
    """Dilatation carrée, par décalages — un maximum glissant écrit à la main."""
    out = m.copy()
    for _ in range(r):
        d = out.copy()
        d[1:, :] |= out[:-1, :]; d[:-1, :] |= out[1:, :]
        d[:, 1:] |= out[:, :-1]; d[:, :-1] |= out[:, 1:]
        out = d
    return out


def erode(m, r):
    return ~dilate(~m, r)


def relie_au_bord(cand):
    """Ce qui, dans `cand`, communique avec le bord de l'image. Parcours en largeur, pas récursif :
    une planche fait un million et demi de pixels et la pile de Python n'y survit pas."""
    h, w = cand.shape
    vu = np.zeros_like(cand)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if cand[y, x] and not vu[y, x]:
                vu[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if cand[y, x] and not vu[y, x]:
                vu[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not vu[ny, nx]:
                vu[ny, nx] = True; q.append((ny, nx))
    return vu


def composantes(obj, min_cote):
    """Les paquets de pixels d'objet, et leur rectangle. Même parcours en largeur."""
    h, w = obj.shape
    vu = np.zeros_like(obj)
    boites = []
    for y0 in range(h):
        for x0 in range(w):
            if not obj[y0, x0] or vu[y0, x0]:
                continue
            q = deque([(y0, x0)]); vu[y0, x0] = True
            x1 = x2 = x0; y1 = y2 = y0; n = 0
            while q:
                y, x = q.popleft(); n += 1
                if x < x1: x1 = x
                if x > x2: x2 = x
                if y < y1: y1 = y
                if y > y2: y2 = y
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and obj[ny, nx] and not vu[ny, nx]:
                        vu[ny, nx] = True; q.append((ny, nx))
            if (x2 - x1) >= min_cote and (y2 - y1) >= min_cote:
                boites.append((x1, y1, x2 + 1, y2 + 1, n))
    return boites


def main():
    if len(sys.argv) < 3:
        print(__doc__); return 2
    src, dst = sys.argv[1], sys.argv[2]
    zone = None
    for a in sys.argv[3:]:
        if a.startswith('--zone'):
            zone = tuple(int(v) for v in a.split('=')[1].split(','))
    im = Image.open(src).convert('RGB')
    if zone:
        im = im.crop(zone)
    a = np.asarray(im, dtype=np.int16)
    fond = couleur_de_fond(a)
    print(f'fond  #{fond[0]:02x}{fond[1]:02x}{fond[2]:02x}   planche {im.size[0]}x{im.size[1]}')

    dist = np.sqrt(((a - fond) ** 2).sum(axis=2))
    cand = dist < TOL
    masque = relie_au_bord(cand)              # le fond, et lui seul
    obj = ~masque
    obj = erode(dilate(obj, FERME), FERME)    # on rebouche, puis on rend ce qu'on a pris

    boites = composantes(obj, MIN_COTE)
    boites.sort(key=lambda b: (b[1] // 40, b[0]))
    os.makedirs(dst, exist_ok=True)
    rgba = np.dstack([a.astype(np.uint8), (obj * 255).astype(np.uint8)])
    plein = Image.fromarray(rgba, 'RGBA')

    fiches = []
    for i, (x1, y1, x2, y2, n) in enumerate(boites):
        bout = plein.crop((x1, y1, x2, y2))
        nom = f'{i:02d}.png'
        bout.save(os.path.join(dst, nom))
        fiches.append({'fichier': nom, 'x': x1, 'y': y1, 'w': x2 - x1, 'h': y2 - y1, 'pixels': int(n)})
        print(f'  {nom}  {x2-x1:4d}x{y2-y1:4d}  à ({x1},{y1})  {n} px')
    with open(os.path.join(dst, 'sprites.json'), 'w') as f:
        json.dump(fiches, f, indent=1)

    # --- la planche de contrôle, sur magenta : une découpe ratée ne se voit que là
    cols = 6
    rows = (len(boites) + cols - 1) // cols
    cell = 190
    ctrl = Image.new('RGB', (cols * cell, rows * cell), (255, 0, 160))
    from PIL import ImageDraw
    dr = ImageDraw.Draw(ctrl)
    for i, f in enumerate(fiches):
        b = Image.open(os.path.join(dst, f['fichier']))
        k = min((cell - 16) / b.width, (cell - 16) / b.height, 1.0)
        b = b.resize((max(1, int(b.width * k)), max(1, int(b.height * k))))
        ox = (i % cols) * cell + (cell - b.width) // 2
        oy = (i // cols) * cell + (cell - b.height) // 2
        ctrl.paste(b, (ox, oy), b)
        # LE NUMÉRO EST SUR LA VIGNETTE. Sans lui, nommer les sprites revient à les compter de
        # tête sur une planche de cinquante cases — et une erreur de nommage ne se voit nulle part.
        dr.text(((i % cols) * cell + 6, (i // cols) * cell + 4), str(i), fill=(255, 255, 255))
    ctrl.save(os.path.join(dst, 'controle.png'))
    print(f'\n{len(boites)} sprites -> {dst}   (controle.png sur magenta)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
