#!/usr/bin/env python3
"""Decoupe une planche de sprites de decor en images separees.

    python3 tools/env.py <planche.png> [dossier de sortie] [options]

      --tol=26            tolerance de couleur du fond
      --gap=0             deux morceaux distants de moins de N pixels vont ensemble
      --erode=0           amincit de N pixels avant le decoupage, pour couper les ombres qui se
                          touchent. Rien n'est perdu : chaque pixel retire revient a l'objet
                          dont il est le plus proche
      --min=400           taille minimale d'un sprite, en pixels
      --ignore=x0,y0,x1,y1   zone a jeter (un filigrane, par exemple), repetable
      --shadow=r,g,b      couleur de l'ombre portee de la planche : ces pixels deviennent du
                          noir translucide, pour qu'ils assombrissent l'herbe du jeu au lieu
                          d'y poser une tache de la couleur du decor
      --shadowtol=22      tolerance de cette couleur       --shadowa=105  son opacite (0-255)
      --shadowclose=20    rayon de fermeture qui distingue l'ombre au sol d'une face a l'ombre
      --light=1.0         eclaircit les sprites, pour une planche rendue de nuit

Le fond est la transparence si la planche en a une, sinon la couleur dominante du bord, et il
est retire par remplissage depuis le bord : une zone sombre a l'interieur d'une maison garde
donc sa couleur meme si elle ressemble au fond. Ce qui reste est decoupe en taches connexes,
une par objet, ombre portee comprise.

Sortie : <dossier>/p00.png, p01.png, ... dans l'ordre de lecture (par bandes horizontales, de
gauche a droite), plus sheet.json qui donne la boite d'origine de chacun.
"""
import json
import os
import sys

import numpy as np
from PIL import Image


def background(img, tol):
    """True la ou c'est du fond : transparence, ou la couleur du bord atteinte depuis le bord."""
    a = np.asarray(img)
    if (a[:, :, 3] < 16).mean() > 0.02:          # la planche est deja detouree
        return a[:, :, 3] < 16
    rgb = a[:, :, :3].astype(np.int16)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    cols, counts = np.unique(border.reshape(-1, 3), axis=0, return_counts=True)
    bg = cols[counts.argmax()]
    near = np.abs(rgb - bg).max(axis=2) <= tol
    # remplissage depuis le bord, par vagues : on garde du fond ce qui y est relie
    out = np.zeros(near.shape, bool)
    out[0] |= near[0]; out[-1] |= near[-1]; out[:, 0] |= near[:, 0]; out[:, -1] |= near[:, -1]
    while True:
        grown = out.copy()
        grown[1:] |= out[:-1]; grown[:-1] |= out[1:]
        grown[:, 1:] |= out[:, :-1]; grown[:, :-1] |= out[:, 1:]
        grown &= near
        if grown.sum() == out.sum():
            return out
        out = grown


def label(mask):
    """Composantes connexes (8-voisins), par runs et union-find : assez rapide sans scipy."""
    h, w = mask.shape
    parent = [0]

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x, y):
        rx, ry = find(x), find(y)
        if rx != ry:
            parent[max(rx, ry)] = min(rx, ry)

    runs_prev, ids_prev = [], []
    lab = np.zeros((h, w), np.int32)
    for y in range(h):
        row = mask[y]
        if not row.any():
            runs_prev, ids_prev = [], []
            continue
        d = np.diff(np.concatenate(([0], row.view(np.int8), [0])))
        starts, ends = np.flatnonzero(d == 1), np.flatnonzero(d == -1)
        runs, ids = [], []
        for x0, x1 in zip(starts, ends):
            parent.append(len(parent))
            cur = len(parent) - 1
            # 8-voisins : le run [x0, x1[ touche le run [p0, p1[ de la ligne du dessus des que
            # leurs colonnes se chevauchent a un pixel pres, en diagonale comprise
            for (p0, p1), pid in zip(runs_prev, ids_prev):
                if p0 < x1 and x0 <= p1:
                    union(cur, pid)
            lab[y, x0:x1] = cur
            runs.append((x0, x1))
            ids.append(cur)
        runs_prev, ids_prev = runs, ids
    if len(parent) == 1:
        return lab, {}
    root = np.array([find(i) for i in range(len(parent))], np.int32)
    lab = root[lab]
    return lab, {int(v) for v in np.unique(lab) if v}


def dilate(mask, r):
    out = mask.copy()
    for _ in range(r):
        m = out
        out = m.copy()
        out[1:] |= m[:-1]; out[:-1] |= m[1:]
        out[:, 1:] |= m[:, :-1]; out[:, :-1] |= m[:, 1:]
    return out


def erode(mask, r):
    return ~dilate(~mask, r) if r else mask


def close(mask, r):
    """Fermeture morphologique : bouche les creux plus petits que r."""
    return erode(dilate(mask, r), r) if r else mask


def grow_labels(lab, within):
    """Rend a chaque etiquette tous les pixels de `within` qui lui sont les plus proches.

    L'amincissement qui precede sert seulement a decider ou passe la coupure entre deux objets
    colles : il ne doit rien supprimer. On regrossit donc jusqu'a ce que plus aucun pixel ne
    reste sans etiquette, sans quoi tout ce qui est plus fin que deux fois l'amincissement --
    une rambarde, une branche, un poteau de perron -- disparaitrait de la planche.
    """
    out = lab.copy()
    while True:
        m = out
        out = m.copy()
        for dy in (-1, 0, 1):                       # huit voisins, comme le decoupage : en
            for dx in (-1, 0, 1):                     # quatre voisins, un pixel relie seulement
                if not dy and not dx:                 # en diagonale ne serait jamais repris
                    continue
                sy = slice(max(0, -dy), None if dy <= 0 else -dy)
                dy_ = slice(max(0, dy), None if dy >= 0 else dy)
                sx = slice(max(0, -dx), None if dx <= 0 else -dx)
                dx_ = slice(max(0, dx), None if dx >= 0 else dx)
                take = (out[dy_, dx_] == 0) & (m[sy, sx] > 0) & within[dy_, dx_]
                out[dy_, dx_] = np.where(take, m[sy, sx], out[dy_, dx_])
        if (out > 0).sum() == (m > 0).sum():
            return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = [a for a in sys.argv[1:] if a.startswith('--')]
    opts = dict(f[2:].split('=', 1) for f in flags if '=' in f)
    if not args:
        print(__doc__)
        return 1
    src = args[0]
    out_dir = args[1] if len(args) > 1 else os.path.join('sprites', 'env')
    tol, gap, min_px = int(opts.get('tol', 26)), int(opts.get('gap', 0)), int(opts.get('min', 400))
    er = int(opts.get('erode', 0))
    ignore = [tuple(int(v) for v in f[9:].split(',')) for f in flags if f.startswith('--ignore=')]
    shadow = [int(v) for v in opts['shadow'].split(',')] if 'shadow' in opts else None
    sh_tol, sh_a = int(opts.get('shadowtol', 22)), int(opts.get('shadowa', 105))
    sh_close = int(opts.get('shadowclose', 20))
    light = float(opts.get('light', 1.0))

    img = Image.open(src).convert('RGBA')
    bg = background(img, tol)
    fg = ~bg
    for x0, y0, x1, y1 in ignore:
        fg[y0:y1, x0:x1] = False
    # Les objets d'une planche se touchent souvent par leur ombre portee. On amincit donc la
    # forme avant de la decouper, puis on rend a chaque objet les pixels retires : deux ombres
    # qui se frolent se separent, sans que les objets maigrissent.
    core = erode(dilate(fg, gap) if gap else fg, er)
    lab, ids = label(core)
    if er:
        lab = np.where(fg, grow_labels(lab, fg), 0)
    print(f'{img.width}x{img.height}, fond {bg.mean():.0%}, {len(ids)} taches')

    boxes = []
    for i in sorted(ids):
        ys, xs = np.nonzero((lab == i) & fg)
        if len(ys) < min_px:
            continue
        boxes.append((int(ys.min()), int(xs.min()), int(ys.max()) + 1, int(xs.max()) + 1, len(ys)))
    if boxes:                                     # ordre de lecture, par bandes
        band = max(1, int(np.median([b[2] - b[0] for b in boxes])) // 2)
        boxes.sort(key=lambda b: (b[0] // band, b[1]))

    os.makedirs(out_dir, exist_ok=True)
    a = np.asarray(img).copy()
    a[bg] = 0                                     # le fond devient transparent
    if light != 1.0:
        a[:, :, :3] = np.clip(a[:, :, :3].astype(np.float32) * light, 0, 255).astype(np.uint8)
    body_px = ~bg
    if shadow is not None:
        rgb = np.asarray(img)[:, :, :3].astype(np.int16)
        navy = (np.abs(rgb - np.array(shadow)).max(axis=2) <= sh_tol) & ~bg
        # Sur ces planches, l'ombre portee et les faces non eclairees partagent le meme bleu tres
        # sombre : la couleur seule ne les separe pas. Ce qui les separe, c'est la place. On ferme
        # la silhouette des pixels colores de l'objet (toit, murs au soleil, feuillage, tronc) :
        # le bleu qui tombe dedans est une face a l'ombre, on n'y touche pas ; celui qui tombe
        # dehors est l'ombre au sol, et il devient du noir translucide, qui assombrit l'herbe.
        body = close(~bg & ~navy, sh_close)
        cast = navy & ~body
        a[cast] = [0, 0, 0, sh_a]
        body_px = ~bg & ~cast
        print(f'ombre au sol : {cast.sum()} pixels sur {navy.sum()} en bleu sombre')
    cut = Image.fromarray(a, 'RGBA')
    meta = []
    for k, (y0, x0, y1, x1, px) in enumerate(boxes):
        name = f'p{k:02d}.png'
        cut.crop((x0, y0, x1, y1)).save(os.path.join(out_dir, name))
        # Le point de contact au sol : le pied de l'objet lui-meme, ombre portee exclue — le bas
        # de sa silhouette, au milieu de ce qui la touche. C'est la que le jeu le pose.
        anchor = [0.5, 0.95]
        sub = body_px[y0:y1, x0:x1]
        counts = sub.sum(axis=1)
        solid = np.flatnonzero(counts >= max(3, counts.max() * 0.22))
        if len(solid):
            foot = int(solid[-1])                      # la derniere ligne vraiment pleine : les
            band = sub[max(0, foot - 3):foot + 1]      # brindilles isolees plus bas ne comptent pas
            bx = np.nonzero(band)[1]
            anchor = [round(float(bx.mean()) / (x1 - x0), 3), round((foot + 1) / (y1 - y0), 3)]
        meta.append({'file': name, 'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0, 'px': px, 'anchor': anchor})
        print(f'{name}  {x1 - x0:4d}x{y1 - y0:4d}  a ({x0},{y0})  {px} px  sol {anchor}')
    with open(os.path.join(out_dir, 'sheet.json'), 'w') as f:
        json.dump({'source': os.path.basename(src), 'sprites': meta}, f, indent=1)
    print(f'{len(meta)} sprites ecrits dans {out_dir}')

    # Verification. Une tache de la planche qui disparait entierement sous l'amincissement est
    # sans consequence : elle est plus fine que lui, donc bien plus petite que --min, et on ne la
    # voulait pas. Ce qui est grave, c'est une tache dont une partie seulement revient : la
    # matiere manquante est alors un morceau d'objet -- une rambarde, une branche, un poteau de
    # perron -- et le degat part en eclats trop petits pour se voir sur une vignette.
    raw, raw_ids = label(fg)
    orphan = fg & (lab == 0)
    hurt = 0
    for r in sorted(raw_ids):
        blob = raw == r
        miss = int((blob & orphan).sum())
        if miss and (blob & ~orphan).any():
            hurt += miss
    print(f'matiere : {int(fg.sum())} px, {int(orphan.sum())} px laisses de cote')
    if hurt:
        print(f"  ATTENTION : {hurt} px ont ete ronges sur des objets gardes")
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
