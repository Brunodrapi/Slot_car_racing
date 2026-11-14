#!/usr/bin/env python3
"""Le fond PROVISOIRE de la carte du circuit de Watkins Glen, dessiné en vectoriel (0.52.77).

LE FOND EN PLACE N'EST PLUS CELUI-CI : depuis la 0.52.81, c'est l'illustration générée par Bruno
(`art-src/circuits/watkins.png`, réduite en `art/interface/circuits/watkins.webp`). Ce script ne
l'écrase pas : `--webp` écrit `art-src/circuits/watkins-vectoriel.webp`.

    python3 tools/fond-watkins.py            # écrit art-src/circuits/watkins.svg
    python3 tools/fond-watkins.py --webp     # et le rend (Chromium, tools/svg-en-png.js) en
                                             # art-src/circuits/watkins-vectoriel.webp, 960 × 640

Les douze premiers fonds (`art/interface/circuits/`) sont des illustrations générées, à plat, cernées
de sombre, en perspective depuis le bord de la piste. Celui-ci est dessiné dans le même esprit, mais
calculé : la route, ses vibreurs et ses rails suivent une même ligne de fuite, et chaque élément
rétrécit avec la distance (`pers`).

CE QUI DIT « WATKINS GLEN » : les rails bleus de l'Armco, de chaque côté, qui sont la signature du
circuit ; la passerelle qui enjambe la piste ; les camping-cars sur la colline — on y vient camper
autant que regarder ; les collines boisées des Finger Lakes, et le lac Seneca au fond de la vallée ;
la route qui remonte en S vers les Esses.
"""
import math
import os
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 960, 640
HORIZON = 292          # la ligne de fuite
TRAIT = '#1c2230'      # le cerne, comme sur les autres fonds


def pers(y):
    """L'échelle à cette hauteur : 0 à l'horizon, 1 au bas de l'image."""
    return max(0.0, (y - HORIZON) / (H - HORIZON))


def bezier(p, t):
    u = 1 - t
    return (u**3 * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t**3 * p[3][0],
            u**3 * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t**3 * p[3][1])


def chemin(points, ferme=True):
    d = 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in points)
    return d + (' Z' if ferme else '')


def poly(points, fill, stroke=TRAIT, sw=2.5, extra=''):
    return f'<path d="{chemin(points)}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" {extra}/>'


def nuage(cx, cy, r):
    bulles = [(-1.6, 0.25, 0.7), (-0.8, -0.2, 0.95), (0.2, -0.45, 1.15), (1.2, -0.1, 0.9), (1.9, 0.3, 0.6)]
    out = ''
    for dx, dy, k in bulles:
        out += f'<circle cx="{cx + dx * r:.1f}" cy="{cy + dy * r:.1f}" r="{k * r:.1f}"/>'
    base = f'<rect x="{cx - 2.2 * r:.1f}" y="{cy + 0.1 * r:.1f}" width="{4.6 * r:.1f}" height="{0.75 * r:.1f}" rx="{0.37 * r:.1f}"/>'
    return (f'<g fill="#fdf3dc" stroke="{TRAIT}" stroke-width="2.5">{out}{base}</g>'
            f'<g fill="#fdf3dc">{"".join(c.replace("/>", " stroke=\"none\"/>") for c in [out, base])}</g>')


def arbre(x, y, r, teinte, tronc=True):
    """Un feuillu vu de côté : un tronc, et une couronne en grappes, cernée d'un seul trait."""
    s = ''
    sw = max(1.2, r * 0.045)
    if tronc:
        s += f'<path d="M{x - r * 0.1:.1f},{y + r * 0.9:.1f} L{x - r * 0.07:.1f},{y - r * 0.5:.1f} L{x + r * 0.07:.1f},{y - r * 0.5:.1f} L{x + r * 0.12:.1f},{y + r * 0.9:.1f} Z" fill="#5b3b24" stroke="{TRAIT}" stroke-width="{sw:.1f}"/>'
        s += f'<path d="M{x:.1f},{y - r * 0.2:.1f} L{x - r * 0.35:.1f},{y - r * 0.6:.1f} M{x:.1f},{y - r * 0.05:.1f} L{x + r * 0.32:.1f},{y - r * 0.5:.1f}" stroke="#5b3b24" stroke-width="{r * 0.07:.1f}" stroke-linecap="round"/>'
    grappes = [(-0.62, -0.62, 0.42), (0.6, -0.66, 0.42), (-0.3, -1.05, 0.48), (0.3, -1.12, 0.46),
               (0, -0.7, 0.5), (-0.85, -0.95, 0.32), (0.85, -1.0, 0.32), (0, -1.45, 0.38)]
    for dx, dy, k in grappes:
        s += f'<circle cx="{x + dx * r:.1f}" cy="{y + dy * r:.1f}" r="{k * r:.1f}" fill="{teinte}" stroke="{TRAIT}" stroke-width="{sw * 2:.1f}"/>'
    for dx, dy, k in grappes:
        s += f'<circle cx="{x + dx * r:.1f}" cy="{y + dy * r:.1f}" r="{k * r - sw:.1f}" fill="{teinte}"/>'
    for dx, dy, k in grappes[:5]:
        s += f'<circle cx="{x + (dx - 0.1) * r:.1f}" cy="{y + (dy - 0.12) * r:.1f}" r="{k * r * 0.45:.1f}" fill="#ffffff" opacity=".12"/>'
    return s


def sapin(x, y, h, teinte):
    return poly([(x, y - h), (x + h * 0.28, y - h * 0.35), (x + h * 0.16, y - h * 0.35), (x + h * 0.36, y),
                 (x - h * 0.36, y), (x - h * 0.16, y - h * 0.35), (x - h * 0.28, y - h * 0.35)], teinte, sw=max(1, h * 0.05))


def camping_car(x, y, l, couleur):
    """Un camping-car de profil, posé sur la pente : caisse blanche, bande colorée, capucine."""
    h = l * 0.42
    s = f'<g transform="translate({x:.1f},{y:.1f})">'
    s += f'<path d="M0,0 L{l:.1f},0 L{l:.1f},{-h:.1f} L{l * 0.18:.1f},{-h:.1f} L{-l * 0.08:.1f},{-h * 0.62:.1f} L{-l * 0.08:.1f},{-h * 0.15:.1f} Z" fill="#f6f3ea" stroke="{TRAIT}" stroke-width="{max(1, l * 0.05):.1f}" stroke-linejoin="round"/>'
    s += f'<rect x="{l * 0.05:.1f}" y="{-h * 0.42:.1f}" width="{l * 0.92:.1f}" height="{h * 0.12:.1f}" fill="{couleur}"/>'
    s += f'<rect x="{l * 0.3:.1f}" y="{-h * 0.82:.1f}" width="{l * 0.22:.1f}" height="{h * 0.25:.1f}" fill="#7fb1d8" stroke="{TRAIT}" stroke-width="{max(.8, l * 0.03):.1f}"/>'
    s += f'<rect x="{l * 0.62:.1f}" y="{-h * 0.82:.1f}" width="{l * 0.22:.1f}" height="{h * 0.25:.1f}" fill="#7fb1d8" stroke="{TRAIT}" stroke-width="{max(.8, l * 0.03):.1f}"/>'
    for cx in (l * 0.2, l * 0.78):
        s += f'<circle cx="{cx:.1f}" cy="0" r="{l * 0.09:.1f}" fill="#262a33"/>'
    return s + '</g>'


def tente(x, y, l, couleur):
    return poly([(x, y), (x + l / 2, y - l * 0.55), (x + l, y)], couleur, sw=max(1, l * 0.08))


def dessine():
    out = []
    out.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">')
    out.append('<defs><linearGradient id="ciel" x1="0" y1="0" x2="0" y2="1">'
               '<stop offset="0" stop-color="#2a7fd4"/><stop offset="1" stop-color="#8cc6f0"/></linearGradient>'
               '<linearGradient id="lac" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f9bd0"/>'
               '<stop offset="1" stop-color="#7cbde4"/></linearGradient>'
               '<linearGradient id="route" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#565c69"/>'
               '<stop offset="1" stop-color="#3e434e"/></linearGradient></defs>')
    out.append(f'<rect width="{W}" height="{H}" fill="url(#ciel)"/>')
    # les nuages
    for cx, cy, r in ((150, 70, 34), (430, 48, 26), (700, 95, 40), (905, 40, 22), (300, 150, 18)):
        out.append(nuage(cx, cy, r))

    # LES COLLINES DU FOND, en trois plans ; le lac Seneca au creux de la vallée, à droite
    import random
    rnd = random.Random(7)
    out.append(poly([(0, 222), (110, 196), (220, 206), (320, 186), (430, 204), (540, 214), (640, 200),
                     (760, 210), (860, 196), (960, 206), (960, 300), (0, 300)], '#8db3ad', sw=2.5))
    for x in range(0, 960, 11):                         # la forêt lointaine, en crêtes bleutées
        y = 214 - 14 * math.sin(x / 120) + 5 * math.sin(x / 37)
        out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rnd.uniform(6, 8):.1f}" fill="#77a39b" stroke="{TRAIT}" stroke-width="1.2"/>')
    out.append(poly([(600, 300), (640, 262), (720, 254), (820, 258), (900, 252), (960, 255), (960, 300)], 'url(#lac)', sw=2))
    out.append('<path d="M650,268 L700,266 M740,262 L800,264 M690,276 L760,275 M820,270 L880,268" stroke="#d7eefa" stroke-width="2" opacity=".8"/>')
    out.append(poly([(0, 252), (120, 230), (230, 240), (330, 228), (430, 244), (520, 262), (600, 290), (600, 300), (0, 300)], '#5c9659', sw=2.5))
    for x in range(0, 600, 13):                         # la forêt de feuillus des collines proches
        y = 248 - 16 * math.sin(x / 95) + 5 * math.sin(x / 31)
        y = min(y, 286)
        out.append(f'<circle cx="{x + rnd.uniform(-3, 3):.1f}" cy="{y:.1f}" r="{rnd.uniform(9, 13):.1f}" fill="{rnd.choice(["#3f7c3d", "#4a8a44", "#376e35"])}" stroke="{TRAIT}" stroke-width="1.6"/>')
    out.append(poly([(840, 300), (870, 280), (930, 272), (960, 274), (960, 300)], '#5c9659', sw=2.5))
    for x in range(860, 965, 12):
        out.append(f'<circle cx="{x:.1f}" cy="{282 - (x - 860) * 0.08:.1f}" r="{rnd.uniform(8, 11):.1f}" fill="{rnd.choice(["#3f7c3d", "#4a8a44"])}" stroke="{TRAIT}" stroke-width="1.5"/>')

    # LE SOL : l'herbe, en deux tons
    out.append(poly([(0, 290), (600, 290), (640, 300), (960, 298), (960, H), (0, H)], '#78b257', sw=2.5))
    out.append(poly([(0, 304), (240, 296), (420, 306), (560, 302), (960, 302), (960, 340), (0, 360)], '#86bd61', stroke='none', sw=0))

    # LA COLLINE DES CAMPEURS, à gauche : des rangs de camping-cars et de tentes sur la pente
    out.append('<path d="M0,300 C80,280 200,276 300,292 C360,302 400,318 420,334 L0,372 Z" fill="#8cc364"/>')
    out.append('<path d="M0,300 C80,280 200,276 300,292 C360,302 400,318 420,334" fill="none" stroke="%s" stroke-width="2.5"/>' % TRAIT)
    couleurs = ['#2f6fb7', '#c8463b', '#3a8a55', '#d79a2b']
    k = 0
    for rang, (y0, pente, l, xmax) in enumerate(((300, 14, 24, 300), (318, 18, 30, 340), (340, 22, 36, 330))):
        x = 6 + rang * 12
        while x < xmax:
            yy = y0 + pente * (x / 340) ** 1.5
            if rnd.random() < 0.78:
                out.append(camping_car(x, yy, l, couleurs[k % 4]))
                x += l * rnd.uniform(1.25, 1.5)
            else:
                out.append(tente(x, yy, l * 0.6, rnd.choice(['#e8c24a', '#d9583f', '#4d8fd1'])))
                x += l * 0.9
            k += 1

    # LA ROUTE. La ligne médiane est une courbe de Bézier, du pied de l'image à la ligne de fuite ;
    # la demi-largeur suit la perspective. Elle part à droite, revient à gauche : les Esses.
    C = [(380, 700), (690, 560), (830, 390), (590, 300)]
    N = 140
    ts = [i / N for i in range(N + 1)]
    milieu = [bezier(C, t) for t in ts]
    demi = [440 * pers(y) + 5 for _, y in milieu]
    gauche = [(x - d, y) for (x, y), d in zip(milieu, demi)]
    droite = [(x + d, y) for (x, y), d in zip(milieu, demi)]

    # le bas-côté au-delà des vibreurs, un peu plus clair
    def bande(bord, signe, de, a, larg, couleur, sw=0, stroke='none'):
        pts_a = [bord[i] for i in range(de, a + 1)]
        pts_b = [(bord[i][0] + signe * (larg * pers(bord[i][1]) + 1), bord[i][1]) for i in range(a, de - 1, -1)]
        return poly(pts_a + pts_b, couleur, stroke=stroke, sw=sw)
    out.append(bande(gauche, -1, 0, N, 150, '#8dc466'))
    out.append(bande(droite, 1, 0, N, 150, '#8dc466'))

    # LES RAILS BLEUS DE L'ARMCO, de chaque côté, sur des poteaux gris
    def rail(bord, signe, ecart, de, a):
        pied = [(bord[i][0] + signe * ecart * pers(bord[i][1]), bord[i][1]) for i in range(de, a + 1)]
        s = ''
        for i in range(0, len(pied) - 1, 3):          # les poteaux
            x, y = pied[i]
            p = pers(y)
            s += f'<rect x="{x - 2.2 * p - .4:.1f}" y="{y - 46 * p:.1f}" width="{4.4 * p + .8:.1f}" height="{46 * p:.1f}" fill="#8a909a" stroke="{TRAIT}" stroke-width="{max(.6, 1.6 * p):.1f}"/>'
        for h0, h1, coul in ((0.5, 0.72, '#2c6fc2'), (0.76, 0.96, '#3a83d6')):
            haut = [(x, y - h1 * 46 * pers(y)) for x, y in pied]
            bas = [(x, y - h0 * 46 * pers(y)) for x, y in reversed(pied)]
            s += poly(haut + bas, coul, sw=1.8)
            s += f'<path d="{chemin([(x, y - (h1 - 0.04) * 46 * pers(y)) for x, y in pied], False)}" fill="none" stroke="#9cc8f2" stroke-width="1.6" opacity=".8"/>'
        return s
    out.append(rail(gauche, -1, 135, 8, N))
    # UNE TRIBUNE à droite, derrière la clôture : gradins, toit, et la foule en points de couleur
    tx, ty, tw, th = 770, 300, 150, 44
    out.append(f'<path d="M{tx},{ty} L{tx + tw},{ty - 22} L{tx + tw},{ty + th - 22} L{tx},{ty + th} Z" fill="#c9ccd2" stroke="{TRAIT}" stroke-width="2.5"/>')
    for r_ in range(3):
        y_a = ty + 12 + r_ * 11
        out.append(f'<path d="M{tx + 4},{y_a} L{tx + tw - 4},{y_a - 22}" stroke="#8d939c" stroke-width="2"/>')
        for c_ in range(24):
            u = 8 + c_ * (tw - 16) / 26
            out.append(f'<circle cx="{tx + u:.1f}" cy="{y_a - 4 - u * 22 / tw:.1f}" r="2.2" fill="{rnd.choice(["#d8333c", "#2f6fb7", "#f4c542", "#ffffff", "#3a8a55", "#e07b39"])}"/>')
    out.append(f'<path d="M{tx - 8},{ty - 8} L{tx + tw + 8},{ty - 34} L{tx + tw + 8},{ty - 24} L{tx - 8},{ty + 2} Z" fill="#2f6fb7" stroke="{TRAIT}" stroke-width="2.5"/>')
    for u in (12, tw / 2, tw - 12):
        out.append(f'<line x1="{tx + u:.1f}" y1="{ty - 2 - u * 26 / tw:.1f}" x2="{tx + u:.1f}" y2="{ty + th - u * 22 / tw:.1f}" stroke="{TRAIT}" stroke-width="2.5"/>')

    # la clôture du côté droit, derrière le rail
    piedf = [(droite[i][0] + 175 * pers(droite[i][1]), droite[i][1]) for i in range(0, N + 1)]
    for i in range(0, len(piedf) - 1, 4):
        x, y = piedf[i]
        p = pers(y)
        out.append(f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{x:.1f}" y2="{y - 120 * p:.1f}" stroke="#4a505a" stroke-width="{max(.8, 3 * p):.1f}"/>')
    haut = [(x, y - 120 * pers(y)) for x, y in piedf]
    out.append(f'<path d="{chemin(haut, False)}" fill="none" stroke="#4a505a" stroke-width="2"/>')
    out.append(poly(haut + [(x, y - 10 * pers(y)) for x, y in reversed(piedf)], '#9aa3ad', stroke='none', extra='opacity=".25"'))
    out.append(rail(droite, 1, 120, 0, N))

    # la chaussée, et ses lignes blanches de bord
    out.append(poly(gauche + list(reversed(droite)), 'url(#route)', sw=3))
    for bord, signe in ((gauche, 1), (droite, -1)):
        ligne = [(x + signe * (30 * pers(y) + .5), y) for x, y in bord]
        out.append(f'<path d="{chemin(ligne, False)}" fill="none" stroke="#f3f1ea" stroke-width="3" opacity=".9"/>')

    # LES VIBREURS, jaunes et rouges comme à Watkins Glen, à la corde de chaque courbe
    def vibreur(bord, signe, de, a, larg):
        s = ''
        for j, i in enumerate(range(de, a, 2)):
            x0, y0 = bord[i]
            x1, y1 = bord[i + 2]
            p0, p1 = pers(y0), pers(y1)
            pts = [(x0, y0), (x1, y1), (x1 + signe * larg * p1, y1), (x0 + signe * larg * p0, y0)]
            s += poly(pts, '#d8333c' if j % 2 else '#f2c230', sw=1.4)     # jaunes et rouges, comme les vrais
        return s
    out.append(vibreur(droite, -1, 0, 46, 70))
    out.append(vibreur(gauche, 1, 60, 118, 70))

    # le haut des Esses, qui remonte la colline vers la gauche et disparaît derrière la crête
    esses = [(590, 300), (560, 296), (520, 291), (480, 286), (440, 279), (405, 270)]
    out.append(f'<path d="{chemin(esses, False)}" fill="none" stroke="{TRAIT}" stroke-width="9" stroke-linecap="round"/>')
    out.append(f'<path d="{chemin(esses, False)}" fill="none" stroke="#5a606c" stroke-width="6" stroke-linecap="round"/>')
    out.append(f'<path d="{chemin(esses, False)}" fill="none" stroke="#f2c230" stroke-width="2" stroke-dasharray="4 4" transform="translate(0,3)"/>')

    # LA PASSERELLE, une poutre bleue en treillis qui enjambe la piste
    i = 92
    x, y = milieu[i]
    p = pers(y)
    xa, xb = gauche[i][0] - 175 * p, droite[i][0] + 205 * p
    haut_pont = y - 175 * p
    ep = 26 * p
    # les pylônes
    for xp in (xa + 6 * p, xb - 26 * p):
        out.append(f'<rect x="{xp:.1f}" y="{haut_pont:.1f}" width="{20 * p:.1f}" height="{y - haut_pont + 4 * p:.1f}" fill="#d9dde3" stroke="{TRAIT}" stroke-width="2"/>')
    out.append(f'<rect x="{xa:.1f}" y="{haut_pont:.1f}" width="{xb - xa:.1f}" height="{ep:.1f}" fill="#2f6fb7" stroke="{TRAIT}" stroke-width="2.5"/>')
    n = 10
    for k in range(n):
        u0 = xa + (xb - xa) * k / n
        u1 = xa + (xb - xa) * (k + 1) / n
        out.append(f'<path d="M{u0:.1f},{haut_pont + ep:.1f} L{(u0 + u1) / 2:.1f},{haut_pont:.1f} L{u1:.1f},{haut_pont + ep:.1f}" fill="none" stroke="#9cc8f2" stroke-width="1.6"/>')
    out.append(f'<rect x="{xa:.1f}" y="{haut_pont - 5 * p:.1f}" width="{xb - xa:.1f}" height="{5 * p:.1f}" fill="#f4f1e8" stroke="{TRAIT}" stroke-width="1.5"/>')

    # LE PREMIER PLAN : un grand érable à gauche, des buissons, et un bout de rail tout près
    out.append(arbre(70, 560, 150, '#3f7f3a'))
    out.append(arbre(250, 330, 34, '#4a8a44'))
    for xb_, yb_, rb in ((170, 610, 26), (205, 628, 20)):
        out.append(arbre(xb_, yb_, rb, '#4d9446', tronc=False))
    for x0, y0, h0 in ((835, 300, 26), (858, 306, 30), (910, 300, 28), (945, 310, 34)):
        out.append(sapin(x0, y0, h0, '#2f6a4f'))
    out.append('</svg>')
    return '\n'.join(out)


if __name__ == '__main__':
    os.makedirs(os.path.join(RACINE, 'art-src', 'circuits'), exist_ok=True)
    chemin_svg = os.path.join(RACINE, 'art-src', 'circuits', 'watkins.svg')
    open(chemin_svg, 'w', encoding='utf-8').write(dessine())
    print(chemin_svg)
    if '--webp' in sys.argv:
        import subprocess
        import tempfile
        from PIL import Image
        png = os.path.join(tempfile.mkdtemp(), 'watkins.png')
        racine_npm = subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip()
        subprocess.run(['node', os.path.join(RACINE, 'tools', 'svg-en-png.js'), chemin_svg, png], check=True,
                       env={**os.environ, 'NODE_PATH': racine_npm})
        webp = os.path.join(RACINE, 'art-src', 'circuits', 'watkins-vectoriel.webp')
        Image.open(png).convert('RGB').save(webp, quality=88, method=6)
        print(webp)
