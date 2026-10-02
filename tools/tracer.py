#!/usr/bin/env python3
"""Un trace de circuit, d un chemin SVG vers la liste de points de js/tracks.js.

    python3 tools/tracer.py <carte.svg> [--points=600] [--decimales=3] [--index=0] [--depart=x,y] [--sens=horaire]

Un circuit du jeu est une suite de points formant une boucle fermee, que `js/track.js` lisse et
redimensionne a la longueur declaree. Les douze trace actuels ont ete poses a la main et ne
ressemblent que de loin aux vrais circuits. Un fond de carte vectoriel, lui, porte la ligne mediane
comme UN SEUL chemin : la lire est exact, la a ou deviner a partir d une image ne l est pas.

POURQUOI PAS L IMAGE. La premiere tentative passait par le PNG : masque de couleur, fermeture
morphologique, amincissement de Zhang-Suen, puis marche sur le squelette. Chacune de ces etapes a
ses reglages, et aucune ne dit quand elle s est trompee — l amincissement laisse des fourches la ou
deux portions du circuit se frolent, et la marche saute de l une a l autre sans rien signaler. Le
chemin vectoriel evite tout cela : il est deja ordonne, deja ferme, deja exact.

CE QUE L OUTIL NE DECIDE PAS. La licence du fichier d entree. Une carte de Wikimedia Commons est le
plus souvent sous CC BY-SA, c est-a-dire a partage a l identique : en copier les coordonnees engage
le projet. L outil affiche donc ce qu il trouve dans les metadonnees du SVG et laisse l humain
trancher. Un SVG dessine par vous-meme n a evidemment aucune de ces contraintes.

LE SENS DE PARCOURS compte : `js/track.js` attend des points qui tournent dans le sens des
aiguilles d une montre a l ecran (y vers le bas). L outil le mesure et retourne la boucle si besoin.

COMBIEN DE POINTS, ET COMBIEN DE DECIMALES. Les deux vont ensemble, et se tromper sur l un abime
l autre. `js/track.js` reconstruit la courbe par une spline qui PASSE PAR les points : un point pose
un demi-metre de travers fait tourner la route, et la courbure qu en tire le moteur vaut environ
2e/h^2 — e l erreur sur le point, h l ecart entre deux points. Rapprocher les points sans gagner en
precision empire donc le resultat, et au carre. Mesure sur un cercle de 2900 m, dont la courbure
exacte vaut 2,17 pour mille :

      points   ecart     1 decimale   2 decimales   3 decimales
         180   16,1 m         3,123         0,578         0,060
         360    8,1 m        13,726         1,578         0,131
         720    4,0 m        20,598         2,167         0,207

A une decimale, le bruit depasse le signal : la ligne droite serpente et la courbure sur laquelle le
jeu calcule le freinage n a plus de sens. D ou les valeurs par defaut : des points tous les cinq
metres, pour qu un virage de vingt metres de rayon en recoive une douzaine, et trois decimales, pour
que le bruit reste dix fois sous la courbure la plus douce qu un circuit contienne.

LE PREMIER POINT doit tomber sur la ligne de depart, parce que c est de la qu on compte les tours.
`--depart` prend les coordonnees du depart DANS LE SVG et fait tourner la liste pour commencer la.
"""
import math
import re
import sys


def commandes(d):
    """Analyse un `d` de SVG. m/M, l/L, h/H, v/V, c/C, s/S, z/Z."""
    toks = re.findall(r'[A-Za-z]|-?\d*\.?\d+(?:[eE]-?\d+)?', d)
    i, cur, depart, cmd = 0, (0.0, 0.0), None, None
    seg, prec = [], None            # `prec` : la poignee precedente, pour s/S
    while i < len(toks):
        t = toks[i]
        if re.match(r'[A-Za-z]', t):
            cmd = t
            i += 1
            if cmd in 'zZ':
                if depart and (abs(cur[0]-depart[0]) > 1e-9 or abs(cur[1]-depart[1]) > 1e-9):
                    seg.append(('l', cur, depart))
                cur, prec = depart or cur, None
            continue
        f = lambda k: float(toks[i + k])
        rel = cmd.islower()
        if cmd in 'mM':
            p = (f(0), f(1))
            cur = (cur[0] + p[0], cur[1] + p[1]) if rel else p
            depart, prec, i = cur, None, i + 2
            cmd = 'l' if rel else 'L'          # un deuxieme couple apres m est un trace
        elif cmd in 'lL':
            p = (f(0), f(1))
            p = (cur[0] + p[0], cur[1] + p[1]) if rel else p
            seg.append(('l', cur, p)); cur, prec, i = p, None, i + 2
        elif cmd in 'hH':
            x = cur[0] + f(0) if rel else f(0)
            p = (x, cur[1]); seg.append(('l', cur, p)); cur, prec, i = p, None, i + 1
        elif cmd in 'vV':
            y = cur[1] + f(0) if rel else f(0)
            p = (cur[0], y); seg.append(('l', cur, p)); cur, prec, i = p, None, i + 1
        elif cmd in 'cC':
            a, b, c = (f(0), f(1)), (f(2), f(3)), (f(4), f(5))
            if rel:
                a = (cur[0]+a[0], cur[1]+a[1]); b = (cur[0]+b[0], cur[1]+b[1]); c = (cur[0]+c[0], cur[1]+c[1])
            seg.append(('c', cur, a, b, c)); cur, prec, i = c, b, i + 6
        elif cmd in 'sS':
            b, c = (f(0), f(1)), (f(2), f(3))
            if rel:
                b = (cur[0]+b[0], cur[1]+b[1]); c = (cur[0]+c[0], cur[1]+c[1])
            a = (2*cur[0]-prec[0], 2*cur[1]-prec[1]) if prec else cur
            seg.append(('c', cur, a, b, c)); cur, prec, i = c, b, i + 4
        else:
            raise SystemExit(f'commande SVG non geree : {cmd}')
    return seg


def echantillonne(seg, pas=0.5):
    out = []
    for s in seg:
        if s[0] == 'l':
            p0, p1 = s[1], s[2]
            n = max(2, int(math.dist(p0, p1) / pas))
            out += [(p0[0] + (p1[0]-p0[0])*t/n, p0[1] + (p1[1]-p0[1])*t/n) for t in range(n)]
        else:
            p0, a, b, p1 = s[1], s[2], s[3], s[4]
            approx = math.dist(p0, a) + math.dist(a, b) + math.dist(b, p1)
            n = max(6, int(approx / pas))
            for k in range(n):
                t = k / n; u = 1 - t
                out.append((u*u*u*p0[0] + 3*u*u*t*a[0] + 3*u*t*t*b[0] + t*t*t*p1[0],
                            u*u*u*p0[1] + 3*u*u*t*a[1] + 3*u*t*t*b[1] + t*t*t*p1[1]))
    return out


def perimetre(p):
    return sum(math.dist(p[i], p[(i+1) % len(p)]) for i in range(len(p)))


def reechantillonne(p, n):
    """n points a pas constant : c est ce que `js/track.js` attend, et c est aussi ce qui donne a
    chaque virage le meme nombre de points par metre qu une ligne droite."""
    d, s = [0.0], 0.0
    for i in range(len(p)):
        s += math.dist(p[i], p[(i+1) % len(p)]); d.append(s)
    out, j = [], 0
    for k in range(n):
        cible = s * k / n
        while d[j+1] < cible: j += 1
        t = (cible - d[j]) / max(1e-9, d[j+1] - d[j])
        a, b = p[j], p[(j+1) % len(p)]
        out.append((a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t))
    return out


def aire(p):
    """NEGATIVE si la boucle tourne dans le sens horaire a l ecran (y vers le bas).

    Le signe etait documente a l envers, et personne ne l avait verifie : un carre parcouru
    droite-bas-gauche-haut, qui est le sens horaire quand y descend, rend -100 et non +100. Les douze
    circuits ont donc ete retournes un a un par le test qui s appuyait dessus, et tournaient tous a
    l envers du vrai. Une ligne d assertion vaut mieux qu une phrase : voir `sens_horaire`."""
    return sum((p[(i+1) % len(p)][0] - p[i][0]) * (p[(i+1) % len(p)][1] + p[i][1]) for i in range(len(p))) / 2


def tourne(p, deg):
    """Fait pivoter la boucle. C est une isometrie : la course ne voit aucune difference, seul
    l oeil en voit une. Voir `tools/orientation.py`, qui MESURE l angle au lieu de le choisir."""
    if not deg:
        return p
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    return [(q[0] * c - q[1] * s, q[0] * s + q[1] * c) for q in p]


def sens_horaire(p):
    """Vrai si la boucle tourne dans le sens des aiguilles d une montre, a l ecran."""
    return aire(p) < 0


assert sens_horaire([(0, 0), (10, 0), (10, 10), (0, 10)])          # droite, bas, gauche, haut
assert not sens_horaire([(0, 0), (0, 10), (10, 10), (10, 0)])


def depart_auto(p):
    """La ligne de depart tombe sur la plus longue ligne droite, aux deux tiers.

    `js/track.js` compte les tours au passage du premier point : le poser dans un virage donnerait
    une ligne de depart en courbe et une grille de depart en travers. Faute de savoir lire sur la
    carte ou se trouve la vraie ligne, on prend le seul endroit qui ne soit jamais faux — la plus
    longue portion droite — et on s y place aux deux tiers, pour laisser de la place a la grille
    derriere sans empieter sur le freinage du premier virage."""
    n = len(p)
    cap = []
    for i in range(n):
        a, b = p[i], p[(i + 1) % n]
        cap.append(math.atan2(b[1] - a[1], b[0] - a[0]))
    def ecart(i):
        d = cap[(i + 1) % n] - cap[i]
        while d > math.pi: d -= 2 * math.pi
        while d < -math.pi: d += 2 * math.pi
        return abs(d)
    droit = [ecart(i) < 0.02 for i in range(n)]
    best, cur, deb, bdeb = 0, 0, 0, 0
    for k in range(2 * n):                       # deux tours, pour attraper une droite a cheval sur la fin
        i = k % n
        if droit[i]:
            if cur == 0: deb = k
            cur += 1
            if cur > best: best, bdeb = cur, deb
        else:
            cur = 0
    return (bdeb + int(best * 2 / 3)) % n


def licence_du_svg(t):
    """Le nom de l auteur vit DANS le bloc <dc:creator>, dans un <dc:title> a lui.

    Une premiere version prenait le premier <rdf:li> venu et annoncait « Monza » comme auteur du
    fichier. Pour une donnee qui sert a crediter quelqu un, se tromper est pire que se taire."""
    lic = sorted(set(re.findall(r'creativecommons\.org/(?:licenses|publicdomain)/([a-z0-9\-./]+)', t)))
    bloc = re.search(r'<dc:creator>(.*?)</dc:creator>', t, re.S)
    auteur = re.search(r'<dc:title>\s*([^<]{1,90})', bloc.group(1)) if bloc else None
    reste = re.sub(r'<dc:creator>.*?</dc:creator>', '', t, flags=re.S)
    titre = re.search(r'<dc:title>\s*([^<]{1,90})', reste)
    return lic, (auteur.group(1).strip() if auteur else None), (titre.group(1).strip() if titre else None)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    o = {a.split('=')[0][2:]: (a.split('=')[1] if '=' in a else '1') for a in sys.argv[1:] if a.startswith('--')}
    if not args:
        print(__doc__); return 1
    t = open(args[0], encoding='utf-8', errors='replace').read()

    lic, auteur, titre = licence_du_svg(t)
    print(f'\n  {args[0]}')
    print(f'    titre    {titre or "—"}')
    print(f'    auteur   {auteur or "—"}')
    print(f'    licence  {", ".join(lic) if lic else "aucune licence lisible dans le fichier"}')
    if lic and any('by-sa' in x or 'by/' in x for x in lic):
        print('    ATTENTION : licence a attribution, voire a partage a l identique.')
        print('    Copier ces coordonnees engage le projet. A trancher avant de les integrer.')

    chemins = [(m.group(1), p) for p in re.findall(r'<path[^>]*>', t)
               for m in [re.search(r'\sd="([^"]*)"', p)] if m]
    chemins.sort(key=lambda c: -len(c[0]))
    idx = int(o.get('index', 0))
    if idx >= len(chemins):
        print(f'\n  seulement {len(chemins)} chemins dans ce fichier'); return 1
    print(f'\n  {len(chemins)} chemins · le plus long en fait {len(chemins[0][0])} caracteres')
    for k, (d, bal) in enumerate(chemins[:5]):
        st = re.search(r'stroke:(#[0-9a-fA-F]{3,6})', bal)
        w = re.search(r'stroke-width:([\d.]+)', bal)
        print(f'    [{k}] {len(d):5} car · trait {st.group(1) if st else "?":8} epaisseur {w.group(1) if w else "?"}')

    pts = echantillonne(commandes(chemins[idx][0]))
    n = int(o.get('points', 600))
    r = reechantillonne(pts, n)
    if sens_horaire(r) != (o.get('sens', 'horaire') == 'horaire'):
        r = r[::-1]
        print(f"\n  boucle retournee pour tourner dans le sens {o.get('sens', 'horaire')}")
    if o.get('depart') == 'auto':
        j = depart_auto(r)
        r = r[j:] + r[:j]
        print(f'  depart pose sur la plus longue ligne droite (point {j})')
    elif 'depart' in o:
        dx, dy = (float(v) for v in o['depart'].split(','))
        j = min(range(len(r)), key=lambda i: (r[i][0]-dx)**2 + (r[i][1]-dy)**2)
        r = r[j:] + r[:j]
        print(f'  premier point ramene sur le depart (point {j})')

    r = tourne(r, float(o.get('rotation', 0)))
    xs = [p[0] for p in r]; ys = [p[1] for p in r]
    cx, cy = (min(xs)+max(xs))/2, (min(ys)+max(ys))/2
    ech = 200 / max(max(xs)-min(xs), max(ys)-min(ys))        # une boite de 200 unites, comme les traces du jeu
    r = [((p[0]-cx)*ech, (p[1]-cy)*ech) for p in r]
    print(f'\n  {n} points · perimetre {perimetre(r):.1f} unites · boite '
          f'{max(q[0] for q in r)-min(q[0] for q in r):.0f} x {max(q[1] for q in r)-min(q[1] for q in r):.0f}\n')
    dec = int(o.get('decimales', 3))
    par_ligne = max(1, 6 - dec)
    lignes = []
    for k in range(0, n, par_ligne):
        lignes.append('      ' + ', '.join(f'[{p[0]:.{dec}f}, {p[1]:.{dec}f}]' for p in r[k:k+par_ligne]) + ',')
    print('    pts: [')
    print('\n'.join(lignes))
    print('    ],')
    return 0


if __name__ == '__main__':
    sys.exit(main())
