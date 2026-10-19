#!/usr/bin/env python3
"""LES TRAITS D'UNE REPRISE, en données de circuit.

Une reprise est une vue tour de `tools/export-decor.js` annotée à la main : vert = hors-piste
bitumé, rouge = gravier, blanc = protection, noir = stands, bleu = tracé, croix = suppression.
Ce script isole les traits par différence avec l'export d'origine, les range par couleur, et
projette chacun sur la portion de piste qu'il borde, grâce au relevé de `tools/releve-reprises.js`
(même cadrage que l'export). Il écrit, prêts à recopier dans `js/tracks.js` :

  ZONE  un dégagement `{ surface, side, points: [[fraction, largeur hors chaussée], ...] }`
        (vert → asphalt, rouge → gravel), largeur = bord extérieur du trait à chaque abscisse ;
  PATH  une ligne `{ side, from, to, pts: [[x, y], ...] }` en mètres du monde, pour
        `barrierPaths` (le trait devient la protection).

Les croix, l'arrondi d'une corde ou une surface dessinée restent des décisions : le script les
liste avec le reste (`//` : couleur, côté, secteur, cadre en pixels /1,6), on les traduit à la main.

  NODE_PATH=$(npm root -g) node tools/releve-reprises.js /tmp/releve <id>
  python3 tools/reprises-traits.py /tmp/releve export-dorigine.png reprise.png <id> [vert,rouge,blanc]
"""
import json, sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

CODE = {'vert': 1, 'rouge': 2, 'blanc': 3, 'noir': 4, 'bleu': 5}
SURF = {'vert': 'asphalt', 'rouge': 'gravel'}


class Geo:
    """Le relevé d'un circuit : tracé en pixels de l'export, normales, demi-largeurs."""
    def __init__(self, path):
        J = json.load(open(path)); self.J = J; T = J['track']; self.T = T
        self.n = T['n']; self.ds = T['ds']
        self.P = np.array(T['px']); self.N = np.stack([T['nx'], T['ny']], 1)
        self.hwL = np.array(T['hwL']); self.hwR = np.array(T['hwR'])
        self.ppm = J['cam']['ppm']

    def world(self, p):
        c = self.J['cam']
        return ((p[0] / c['k'] - c['w'] / 2) / c['zoom'] + c['x'], (p[1] / c['k'] - c['h'] / 2) / c['zoom'] + c['y'])


def classify(orig, rep):
    A = np.asarray(Image.open(rep).convert('RGB')).astype(int)
    B = np.asarray(Image.open(orig).convert('RGB')).astype(int)
    d = np.abs(A - B).sum(2) > 40
    r, g, b = A[..., 0], A[..., 1], A[..., 2]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
    sat = (mx - mn) / np.maximum(mx, 1)
    cls = np.zeros(A.shape[:2], np.uint8)
    green = d & (g > r + 50) & (g > b + 50)
    cls[green] = 1
    cls[d & (r > g + 70) & (r > b + 70)] = 2
    cls[d & (mn > 175) & (sat < 0.15)] = 3
    cls[d & (mx < 60)] = 4
    cls[d & (b > r + 50) & (b >= g - 20) & ~green] = 5
    return cls


def components(mask):
    """Traits connexes, après une dilatation de 3 px qui recolle un trait tremblé."""
    m = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0
    lab = np.zeros(m.shape, np.int32); cur = 0
    for y, x in zip(*np.nonzero(m)):
        if lab[y, x]: continue
        cur += 1; q = deque([(y, x)]); lab[y, x] = cur
        while q:
            cy, cx = q.popleft()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < m.shape[0] and 0 <= nx < m.shape[1] and m[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = cur; q.append((ny, nx))
    return lab * mask, cur


def ordered(xs, ys, cell=3):
    """Les pixels d'un trait, dans l'ordre : le plus long chemin entre ses deux bouts."""
    cells = {}
    for a, b, x, y in zip((xs // cell).astype(int), (ys // cell).astype(int), xs, ys):
        cells.setdefault((a, b), []).append((x, y))
    nodes = list(cells); idx = {n: i for i, n in enumerate(nodes)}
    pos = np.array([np.mean(cells[n], 0) for n in nodes])
    nb = [[idx[(a + da, b + db)] for da in (-1, 0, 1) for db in (-1, 0, 1)
           if (da or db) and (a + da, b + db) in idx] for (a, b) in nodes]

    def bfs(s):
        d = [-1] * len(nodes); par = [-1] * len(nodes); d[s] = 0; q = deque([s])
        while q:
            u = q.popleft()
            for v in nb[u]:
                if d[v] < 0: d[v] = d[u] + 1; par[v] = u; q.append(v)
        return max(range(len(nodes)), key=lambda i: d[i]), par
    A, _ = bfs(0); B, par = bfs(A)
    path = [B]
    while path[-1] != A: path.append(par[path[-1]])
    return pos[path]


def resample(P, step):
    out = [P[0]]; acc = 0
    for a, b in zip(P[:-1], P[1:]):
        acc += np.hypot(*(b - a))
        if acc >= step: out.append(b); acc = 0
    if np.hypot(*(out[-1] - P[-1])) > step * 0.3: out.append(P[-1])
    else: out[-1] = P[-1]
    return np.array(out)


def smooth(P, k=2):
    Q = P.copy()
    for i in range(1, len(P) - 1): Q[i] = P[max(0, i - k):min(len(P), i + k + 1)].mean(0)
    return Q


def strokes(g, cls, color, minpx=40):
    lab, n = components(cls == CODE[color]); out = []
    for k in range(1, n + 1):
        ys, xs = np.nonzero(lab == k)
        if len(xs) < minpx: continue
        P = smooth(resample(ordered(xs.astype(float), ys.astype(float)), 3 * g.ppm))
        # La branche qui porte le trait : celle où tombe la majorité de ses points.
        near = [int(((g.P - p) ** 2).sum(1).argmin()) for p in P]
        circ = lambda q, c: min(abs(q - c), g.n - abs(q - c))
        best = max(near, key=lambda c: sum(1 for q in near if circ(q, c) < 0.04 * g.n))
        rel = [((q - best + g.n // 2) % g.n) - g.n // 2 for q in near if circ(q, best) < 0.04 * g.n]
        ii = np.arange(best + min(rel) - 40, best + max(rel) + 41) % g.n
        Q = np.stack([xs, ys], 1).astype(float); J = np.empty(len(Q), int)
        for a in range(0, len(Q), 3000):
            J[a:a + 3000] = ii[((Q[a:a + 3000, None, :] - g.P[None, ii, :]) ** 2).sum(2).argmin(1)]
        lat = (((Q - g.P[J]) / g.ppm) * g.N[J]).sum(1)
        JP = ii[((P[:, None, :] - g.P[None, ii, :]) ** 2).sum(2).argmin(1)]
        f = JP / g.n
        if ((f[-1] - f[0]) % 1) > 0.5: f = f[::-1]; P = P[::-1]
        side = int(np.sign(np.median(lat)))
        out.append(dict(side=side, f=f, P=P, J=J, lat=lat,
                        bbox=[xs.min() / 1.6, ys.min() / 1.6, xs.max() / 1.6, ys.max() / 1.6]))
    return out


def zone_profile(g, s, step=0.003, pad=0.003):
    m = np.sign(s['lat']) == s['side']; J = s['J'][m]; lat = s['lat'][m]
    f = J / g.n; c = s['f'][0]
    f = np.where(f < c - 0.3, f + 1, f); f = np.where(f > c + 0.7, f - 1, f)
    off = np.abs(lat) - np.where(s['side'] > 0, g.hwL[J], g.hwR[J])
    pts = []
    for x in np.arange(f.min(), f.max() + 1e-9, step):
        sel = (f >= x) & (f < x + step)
        if sel.sum() >= 3: pts.append([x + step / 2, float(off[sel].max())])
    w = np.array([p[1] for p in pts]); w2 = w.copy()
    for i in range(1, len(w) - 1): w2[i] = np.median(w[i - 1:i + 2])
    return ([[round(f.min() - pad, 4), 0]] + [[round(p[0], 4), round(max(0, v), 1)] for p, v in zip(pts, w2)]
            + [[round(f.max() + pad, 4), 0]])


def frac(f):
    f = f % 1 if f >= 1 else f
    t = '%.4f' % f
    return t[1:] if t.startswith('0') else t


if __name__ == '__main__':
    releve, orig, rep, cid = sys.argv[1:5]
    colors = sys.argv[5].split(',') if len(sys.argv) > 5 else ['vert', 'rouge', 'blanc', 'noir', 'bleu']
    g = Geo('%s/%s.json' % (releve, cid)); cls = classify(orig, rep)
    for color in colors:
        for s in strokes(g, cls, color):
            print('// %s side %+d f %.4f-%.4f bbox %s' % (color, s['side'], s['f'][0], s['f'][-1],
                                                           [round(v) for v in s['bbox']]))
            if color in SURF:
                print("ZONE { name: '', surface: '%s', side: %d,\n        points: [%s] }," % (
                    SURF[color], s['side'], ','.join('[%s,%g]' % (frac(a), b) for a, b in zone_profile(g, s))))
            print('PATH {side:%d,from:%s,to:%s,pts:[%s]},' % (s['side'], frac(s['f'][0]), frac(s['f'][-1]),
                  ','.join('[%.1f,%.1f]' % g.world(p) for p in s['P'])))
