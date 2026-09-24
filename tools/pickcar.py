#!/usr/bin/env python3
"""Prepare une illustration de voiture en trois quarts pour le menu de selection.

    python3 tools/pickcar.py <image> <id du modele> [options]

      --tol=20      tolerance de blanc du fond
      --peel=2      epaisseur, en pixels, du lisere clair a eplucher sur le pourtour
      --fringe=30   sous cet ecart au blanc, un pixel du pourtour est du lisere
      --width=420   largeur de sortie, en pixels
      --out=sprites/pick

Proche de topcar.py, a une difference pres qui compte : **rien n'est tourne ni redresse**. Une vue
de dessus doit pointer vers la droite et son axe long se mesure ; une vue en trois quarts est
cadree par le dessinateur, et la redresser ne ferait que la coucher de travers.

Le fond est retire par remplissage depuis le bord, pas par seuil : ces voitures sont souvent
blanches sur blanc, et un seuil les mangerait. Le trait sombre du pourtour arrete le remplissage.

Ces illustrations portent en general une ombre douce au sol. Elle n'est pas du fond : le
remplissage s'y arrete, et il reste un halo gris autour des roues. D'ou `--peel`, qui retire les
pixels du pourtour restes presque blancs, sur une epaisseur bornee pour qu'un reflet clair de la
carrosserie ne serve jamais de porte d'entree vers l'interieur.
"""
import os
import sys

import numpy as np
from PIL import Image


def background(img, tol):
    """True la ou c est le fond : le blanc relie au bord de l image."""
    a = np.asarray(img)
    rgb = a[:, :, :3].astype(np.int16)
    near = (255 - rgb.min(axis=2)) <= tol
    out = np.zeros(near.shape, bool)
    out[0] |= near[0]; out[-1] |= near[-1]; out[:, 0] |= near[:, 0]; out[:, -1] |= near[:, -1]
    while True:
        g = out.copy()
        g[1:] |= out[:-1]; g[:-1] |= out[1:]
        g[:, 1:] |= out[:, :-1]; g[:, :-1] |= out[:, 1:]
        g &= near
        if g.sum() == out.sum():
            return out
        out = g


def peel(a, depth, fringe):
    alpha = a[:, :, 3]
    lum = 255 - a[:, :, :3].astype(np.int16).min(axis=2)
    for _ in range(depth):
        op = alpha > 8
        inner = op.copy()
        inner[1:] &= op[:-1]; inner[:-1] &= op[1:]
        inner[:, 1:] &= op[:, :-1]; inner[:, :-1] &= op[:, 1:]
        rim = op & ~inner & (lum <= fringe)
        if not rim.any():
            break
        alpha[rim] = 0
    return a


def crop(img):
    a = np.asarray(img)
    ys, xs = np.nonzero(a[:, :, 3] > 8)
    return img.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    opts = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
    if len(args) < 2:
        print(__doc__)
        return 1
    src, mid = args[0], args[1]
    tol = int(opts.get('tol', 20))
    peel_depth, fringe = int(opts.get('peel', 2)), int(opts.get('fringe', 30))
    width = int(opts.get('width', 420))
    out_dir = opts.get('out', os.path.join('sprites', 'pick'))

    img = Image.open(src).convert('RGBA')
    a = np.asarray(img).copy()
    bg = background(img, tol)
    a[bg] = 0
    print(f'{src} : {img.width}x{img.height}, fond {bg.mean():.0%}')
    if peel_depth:
        before = int((a[:, :, 3] > 8).sum())
        a = peel(a, peel_depth, fringe)
        print(f'  lisere epluche : {before - int((a[:, :, 3] > 8).sum())} pixels')
    img = crop(Image.fromarray(a, 'RGBA'))

    if img.width != width:
        h = max(1, round(img.height * width / img.width))
        img = img.resize((width, h), Image.LANCZOS)
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, mid + '.png')
    img.save(path)
    print(f'  ecrit {path} : {img.width}x{img.height}, rapport {img.width / img.height:.2f}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
