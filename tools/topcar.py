#!/usr/bin/env python3
"""Prepare une illustration de voiture vue de dessus pour le jeu.

    python3 tools/topcar.py <image> <id du modele> [options]

      --tol=14      tolerance de blanc du fond
      --peel=0      epaisseur, en pixels, du lisere clair a eplucher sur le pourtour
      --fringe=26   sous cet ecart au blanc, un pixel du pourtour est du lisere
      --width=420   largeur de sortie, en pixels
      --nose=left   ou se trouve l avant sur l image d entree (left, right, up, down)
      --out=sprites/top

Le fond est retire par remplissage depuis le bord et non par seuil de couleur : une M1 Procar est
blanche sur fond blanc, et un seuil la mangerait entiere. Le trait sombre qui entoure la carrosserie
arrete le remplissage, le blanc interieur est donc conserve.

L image est ensuite redressee — l axe long de la voiture est mesure et ramene a l horizontale — puis
tournee pour que l avant pointe vers la droite, ce que le jeu attend, et rognee au plus juste.
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
    """Epluche le lisere clair du pourtour, couche par couche.

    Une photo pose une ombre douce sous la voiture : elle s enfonce dans le blanc et le
    remplissage depuis le bord s arrete la ou elle devient trop grise, laissant un halo. On retire
    donc les pixels du pourtour qui sont encore presque blancs — mais sur une epaisseur bornee, pour
    qu un reflet clair de la carrosserie ne serve jamais de porte d entree vers l interieur.
    """
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


def long_axis(mask):
    """Angle de l axe long de la forme, en degres, par analyse en composantes principales."""
    ys, xs = np.nonzero(mask)
    x = xs - xs.mean()
    y = ys - ys.mean()
    cov = np.cov(np.stack([x, y]))
    vals, vecs = np.linalg.eigh(cov)
    vx, vy = vecs[:, int(np.argmax(vals))]
    return float(np.degrees(np.arctan2(vy, vx)))


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
    tol = int(opts.get('tol', 14))
    peel_depth, fringe = int(opts.get('peel', 0)), int(opts.get('fringe', 26))
    width = int(opts.get('width', 420))
    nose = opts.get('nose', 'left')
    out_dir = opts.get('out', os.path.join('sprites', 'top'))

    img = Image.open(src).convert('RGBA')
    a = np.asarray(img).copy()
    bg = background(img, tol)
    a[bg] = 0
    if peel_depth:
        before = int((a[:, :, 3] > 8).sum())
        a = peel(a, peel_depth, fringe)
        print(f'  lisere epluche : {before - int((a[:, :, 3] > 8).sum())} pixels')
    img = Image.fromarray(a, 'RGBA')
    print(f'{src} : {img.width}x{img.height}, fond {bg.mean():.0%}')

    img = crop(img)
    # Straighten: an illustration is rarely exactly square to its frame, and a car a degree or two
    # off looks like it is crabbing down the road.
    tilt = long_axis(np.asarray(img)[:, :, 3] > 8)
    if tilt > 90:
        tilt -= 180
    if tilt < -90:
        tilt += 180
    if abs(tilt) > 0.15:
        img = img.rotate(tilt, resample=Image.BICUBIC, expand=True)
        img = crop(img)
        print(f'  redresse de {tilt:.2f} deg')

    turn = {'left': 180, 'right': 0, 'up': 270, 'down': 90}[nose]
    if turn:
        img = img.rotate(-turn, resample=Image.BICUBIC, expand=True)
        img = crop(img)

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
