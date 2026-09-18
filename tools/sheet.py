#!/usr/bin/env python3
"""Turn a folder of fixed-frame car renders into a rotation sheet the game can use.

    python3 tools/sheet.py <dossier source> <id du modele> <longueur en metres> [largeur de sortie]

The renders must come from an orthographic camera that never moves, with the car turning on its
own vertical axis, one frame per equal step of a full turn, ordered clockwise on screen. Anything
uniform behind the car (a plain backdrop, a decorative border) is removed; the car is whatever
non-backdrop blob is biggest, and holes inside it are filled back in so grey wheels survive.

Because the camera is fixed, every frame shares one crop box, so the car's ground point never
moves between views. The script measures the scale from the profile view and prints the line to
paste into js/cars.js, including which view is the rear one.

Needs Pillow: pip install Pillow
"""
import json
import os
import sys
from collections import deque

from PIL import Image

QUANT = 64          # palette size; these renders are flat-shaded so this is plenty


def greyish(p):
    r, g, b = p[0], p[1], p[2]
    mn, mx = min(r, g, b), max(r, g, b)
    return (mx - mn) <= 32 and 40 <= mn <= 210


def frame_inset(img):
    """How thick the decorative border is: scan inward until a line is mostly backdrop."""
    w, h = img.size
    px = img.load()
    worst = 0
    for axis in range(4):
        found = 0
        for d in range(min(w, h) // 3):
            if axis == 0:
                line = [px[x, d] for x in range(0, w, 3)]
            elif axis == 1:
                line = [px[x, h - 1 - d] for x in range(0, w, 3)]
            elif axis == 2:
                line = [px[d, y] for y in range(0, h, 3)]
            else:
                line = [px[w - 1 - d, y] for y in range(0, h, 3)]
            if sum(1 for p in line if greyish(p)) > len(line) * 0.85:
                found = d
                break
        worst = max(worst, found)
    return worst + 4        # a little margin; leftover corner pieces are dropped as small blobs


def isolate(img):
    """Keep the biggest non-backdrop blob and fill its holes."""
    w, h = img.size
    px = img.load()
    solid = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            if not greyish(px[x, y]):
                solid[y * w + x] = 1
    seen = bytearray(w * h)
    best, best_n = None, 0
    for s in range(w * h):
        if not solid[s] or seen[s]:
            continue
        q, comp = deque([s]), [s]
        seen[s] = 1
        while q:
            k = q.popleft()
            x, y = k % w, k // w
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h:
                    nk = ny * w + nx
                    if solid[nk] and not seen[nk]:
                        seen[nk] = 1
                        q.append(nk)
                        comp.append(nk)
        if len(comp) > best_n:
            best_n, best = len(comp), comp
    keep = bytearray(w * h)
    for k in best:
        keep[k] = 1
    outside = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            k = y * w + x
            if not keep[k] and not outside[k]:
                outside[k] = 1
                q.append(k)
    for y in range(h):
        for x in (0, w - 1):
            k = y * w + x
            if not keep[k] and not outside[k]:
                outside[k] = 1
                q.append(k)
    while q:
        k = q.popleft()
        x, y = k % w, k // w
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                nk = ny * w + nx
                if not keep[nk] and not outside[nk]:
                    outside[nk] = 1
                    q.append(nk)
    for k in range(w * h):
        if outside[k]:
            px[k % w, k // w] = (0, 0, 0, 0)
    return img


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        return 1
    src, model_id, length = sys.argv[1], sys.argv[2], float(sys.argv[3])
    out_w = int(sys.argv[4]) if len(sys.argv) > 4 else 192
    files = sorted(f for f in os.listdir(src) if f.lower().endswith('.png'))
    if not files:
        print('aucun PNG dans', src)
        return 1
    n = len(files)
    frames = []
    inset = frame_inset(Image.open(os.path.join(src, files[0])).convert('RGBA'))
    print(f'bordure decorative detectee: {inset} px')
    for f in files:
        im = Image.open(os.path.join(src, f)).convert('RGBA')
        w, h = im.size
        frames.append(isolate(im.crop((inset, inset, w - inset, h - inset))))
    boxes = [f.split()[3].getbbox() for f in frames]
    x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes)
    x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
    bw, bh = x1 - x0, y1 - y0

    widths = [b[2] - b[0] for b in boxes]
    head_on = sorted(range(n), key=lambda i: widths[i])[:2]     # the two narrowest: front and rear
    profile = max(range(n), key=lambda i: abs(((i - head_on[0]) % n) - n / 4) * -1)
    px_per_m = widths[profile] / length
    # the rotation axis: the two head-on views are symmetric about it
    axis_x = sum((boxes[i][0] + boxes[i][2]) / 2 for i in head_on) / 2
    ground_y = float(boxes[profile][3])
    sheet_w = bw / px_per_m
    anchor = [(axis_x - x0) / bw, (ground_y - y0) / bh]

    dst = os.path.join('sprites', model_id)
    os.makedirs(dst, exist_ok=True)
    total = 0
    for i, f in enumerate(frames):
        im = f.crop((x0, y0, x1, y1)).resize((out_w, round(out_w * bh / bw)), Image.LANCZOS)
        im.quantize(colors=QUANT, method=Image.FASTOCTREE).save(f'{dst}/v{i}.png', optimize=True)
        total += os.path.getsize(f'{dst}/v{i}.png')

    print(f'{n} vues ecrites dans {dst}, {total // 1024} Ko')
    print(f'echelle {px_per_m:.1f} px/m, profil = vue {profile}, vues de face/dos = {sorted(head_on)}')
    print()
    print('A verifier: laquelle des deux vues etroites est le DOS (feux arriere, plaque).')
    print('Puis coller dans js/cars.js, en mettant son index dans sheetRear :')
    print(f"  sheet: 'sprites/{model_id}', sheetN: {n}, sheetRear: <{' ou '.join(str(i) for i in sorted(head_on))}>, "
          f"sheetW: {sheet_w:.3f}, sheetAnchor: [{anchor[0]:.3f}, {anchor[1]:.3f}]")
    json.dump({'sheetN': n, 'sheetW': round(sheet_w, 3), 'sheetAnchor': [round(a, 3) for a in anchor],
               'headOn': sorted(head_on), 'profile': profile}, open(f'{dst}/sheet.json', 'w'), indent=1)
    return 0


if __name__ == '__main__':
    sys.exit(main())
