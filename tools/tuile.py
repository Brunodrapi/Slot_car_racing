#!/usr/bin/env python3
"""FAIRE UNE TUILE SANS COUTURE À PARTIR D'UN MORCEAU DE PLANCHE.

Un motif qui se répète a deux façons de trahir sa tuile : la COUTURE, quand les bords ne se
raccordent pas, et la SYMÉTRIE, quand on l'a rendue raccordable en la mirotant. La seconde est pire
que la première sur une surface un peu large — l'œil n'attrape pas un caillou, il attrape un axe.

On emploie donc le décalage et le fondu, qui est la méthode du retoucheur : on décale l'image d'une
demi-tuile dans les deux sens, ce qui amène les anciens bords au MILIEU, puis on recolle par-dessus
la bande médiane de l'image d'origine avec un fondu progressif. Les bords de la tuile décalée sont
l'ancien centre, donc ils se raccordent déjà ; et la couture ramenée au milieu est noyée dans le
fondu. Il ne reste aucune symétrie.

    python3 tools/tuile.py <planche> <x,y,côté> <sortie.webp> [--taille 256]
"""
import sys
import numpy as np
from PIL import Image


def sans_couture(a, flou=0.28):
    h, w = a.shape[:2]
    dy, dx = h // 2, w // 2
    out = np.roll(np.roll(a, dy, axis=0), dx, axis=1).astype(np.float32)
    orig = a.astype(np.float32)
    # un poids qui vaut 1 au milieu (là où est la couture) et s'éteint vers les bords
    def cloche(n, d):
        t = np.abs(np.arange(n) - n / 2.0) / (d * n / 2.0)
        return np.clip(1.0 - t, 0.0, 1.0)
    wy = cloche(h, flou)[:, None]
    wx = cloche(w, flou)[None, :]
    m = np.maximum(wy * np.ones_like(wx), np.ones_like(wy) * wx)[..., None]
    return (out * (1 - m) + orig * m).astype(np.uint8)


def main():
    if len(sys.argv) < 4:
        print(__doc__); return 2
    src, zone, dst = sys.argv[1], sys.argv[2], sys.argv[3]
    taille = 256
    for i, v in enumerate(sys.argv[4:]):
        if v == '--taille': taille = int(sys.argv[5 + i])
    x, y, cote = (int(v) for v in zone.split(','))
    im = Image.open(src).convert('RGB').crop((x, y, x + cote, y + cote))
    if im.size[0] != taille:
        im = im.resize((taille, taille), Image.LANCZOS)
    a = sans_couture(np.asarray(im))
    Image.fromarray(a, 'RGB').save(dst, quality=88, method=6)
    print(f'{dst}  {taille}x{taille}  {__import__("os").path.getsize(dst)//1024} Ko')
    return 0


if __name__ == '__main__':
    sys.exit(main())
