#!/usr/bin/env python3
"""L'angle qui pose un circuit dans l'orientation où on a l'habitude de le voir.

    python3 tools/orientation.py <carte.svg> <circuit> [--index=0]

UN RELEVÉ EST ORIENTÉ AU NORD, une carte de circuit ne l'est presque jamais. Monza se regarde avec sa
ligne droite des stands à la verticale, Silverstone a sa propre inclinaison, et un joueur qui connaît
un circuit le reconnaît à sa silhouette POSÉE COMME IL L'A TOUJOURS VUE. Relevé au nord, il hésite.

L'angle n'est donc pas un réglage de goût, c'est une mesure : on prend la carte que tout le monde
connaît, on y superpose le tracé relevé, et on cherche la rotation qui les fait coïncider. Le résidu
affiché dit si la superposition a vraiment eu lieu — deux formes différentes ne coïncident à aucun
angle, et un résidu élevé signale que le chemin lu dans le SVG n'est pas le circuit.

Ce que l'angle ne change pas : rien de la course. Une rotation est une isométrie, les longueurs et
les rayons sont les mêmes, et la physique ne voit aucune différence. Il ne change que ce qu'on voit.

L'ANGLE EST RELATIF À CE QUE PORTE `js/traces.js` AU MOMENT DE LA MESURE. Une fois le tracé
regénéré avec sa rotation, remesurer rend zéro — c'est le signe que c'est bon, pas un résultat à
reporter dans la table. Pour corriger un angle déjà posé, on ajoute ce que la mesure rend à ce que
la table porte déjà.
"""
import math
import re
import sys


def charge_svg(fichier, index=0):
    sys.path.insert(0, __file__.rsplit('/', 1)[0])
    import tracer
    t = open(fichier, encoding='utf-8', errors='replace').read()
    ch = [m.group(1) for p in re.findall(r'<path[^>]*>', t)
          for m in [re.search(r'\sd="([^"]*)"', p)] if m]
    ch.sort(key=lambda d: -len(d))
    if index >= len(ch):
        raise SystemExit(f'  seulement {len(ch)} chemins dans ce fichier')
    return tracer.reechantillonne(tracer.echantillonne(tracer.commandes(ch[index]), 1.0), 900)


def centre_et_echelle(p):
    """Centré sur zéro, et mis à une boîte de 200 — comme les tracés de `js/traces.js`."""
    xs = [q[0] for q in p]; ys = [q[1] for q in p]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    e = 200 / max(max(xs) - min(xs), max(ys) - min(ys))
    return [((q[0] - cx) * e, (q[1] - cy) * e) for q in p]


def ecart(a, b, pas=3.0):
    """Distance moyenne de chaque point de `a` au plus proche de `b`, par une grille."""
    cases = {}
    for q in b:
        cases.setdefault((int(q[0] // pas), int(q[1] // pas)), []).append(q)
    total = 0.0
    for p in a:
        i, j = int(p[0] // pas), int(p[1] // pas)
        best = 1e18
        r = 1
        while best == 1e18 and r < 12:
            for u in range(i - r, i + r + 1):
                for v in range(j - r, j + r + 1):
                    for q in cases.get((u, v), ()):
                        d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2
                        if d < best:
                            best = d
            r += 1
        total += math.sqrt(best) if best < 1e18 else 100.0
    return total / len(a)


def tourne(p, deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    return [(q[0] * c - q[1] * s, q[0] * s + q[1] * c) for q in p]


def main():
    o = {a.split('=')[0][2:]: (a.split('=', 1)[1] if '=' in a else '1')
         for a in sys.argv[1:] if a.startswith('--')}
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 2:
        print(__doc__); return 1
    carte, cid = args[0], args[1]

    sys.path.insert(0, __file__.rsplit('/', 1)[0])
    racine = __file__.rsplit('/', 2)[0]
    src = open(f'{racine}/js/traces.js', encoding='utf-8').read()
    bloc = re.search(r'\n  %s: \[\n(.*?)\n  \],' % re.escape(cid), src, re.S)
    if not bloc:
        raise SystemExit(f'  {cid} absent de js/traces.js')
    trace = [tuple(float(v) for v in m)
             for m in re.findall(r'\[(-?[\d.]+), (-?[\d.]+)\]', bloc.group(1))]

    ref = centre_et_echelle(charge_svg(carte, int(o.get('index', 0))))
    tr = centre_et_echelle(trace)

    # balayage large, puis fin autour du meilleur : 360 angles au degré, puis au dixième
    best = min(((ecart(tourne(tr, d), ref), d) for d in range(360)))
    fin = min(((ecart(tourne(tr, best[1] + d / 10), ref), best[1] + d / 10) for d in range(-10, 11)))
    taille = 200.0
    print(f'\n  {cid} · carte {carte.rsplit("/", 1)[-1]}')
    print(f'    rotation {fin[1]:.1f}°  ·  résidu {fin[0]:.1f} unités sur une boîte de {taille:.0f}'
          f'  ({fin[0] / taille * 100:.1f} %)')
    if fin[0] > 10:
        print('    ATTENTION : résidu élevé. Le chemin lu n\'est probablement pas le circuit —'
              ' essayer --index=1, 2, …')
    return 0


if __name__ == '__main__':
    sys.exit(main())
