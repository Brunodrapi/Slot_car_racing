#!/usr/bin/env python3
"""Un trace de circuit, releve dans OpenStreetMap, vers la liste de points de js/traces.js.

    python3 tools/releve.py --bbox=45.611,9.275,45.632,9.300 --depart="Rettifilo di partenza" \
        --longueur=5793 [--points=600] [--decimales=3] [--sauf="Pit Lane,..."] [--sens=horaire]

POURQUOI PAS UNE CARTE DE WIKIPEDIA. On a d abord relevé Monza sur le fond de carte vectoriel de
Wikimedia (voir `tools/tracer.py`, qui reste utilisable). Une carte de ce genre est un SCHEMA : elle
donne la silhouette du circuit, pas ses rayons. Celle de Monza dessine tout le Rettifilo — l entree,
les deux apex et la sortie — avec UNE SEULE courbe de Bezier, dont le point le plus serre revient a
un rayon de 12 m sur le vrai circuit. Le releve, lui, en donne 24. Sur une route de 15 m de large
ramenee a l echelle du jeu, le premier replie le bord interieur sur lui-meme ; le second non.

OpenStreetMap n est pas un dessin mais un releve : la ligne mediane est tracee sur l imagerie
aerienne, virage par virage. On le verifie sans rien croire sur parole — la boucle assemblee doit se
refermer d elle-meme, et sa longueur doit tomber sur la longueur officielle du circuit. A Monza :
5790 m releves contre 5793 m annonces, trois metres d ecart sur six kilometres.

CE QUE L OUTIL NE DECIDE PAS. La licence. Les donnees d OpenStreetMap sont sous ODbL : les reprendre
oblige a citer « © les contributeurs d OpenStreetMap » et a laisser la base derivee — ici le fichier
`js/traces.js`, et lui seul — sous la meme licence. Voir `LICENCES.md`.

L ASSEMBLAGE. Un circuit n est pas une seule voie dans OpenStreetMap mais une vingtaine, chacune
nommee d apres le virage qu elle porte. On part de celle que `--depart` designe et on enchaine : la
voie suivante est celle dont le premier noeud est le dernier de la precedente. Les voies a sens
unique rendent l enchainement sans ambiguite. `--sauf` ecarte ce qui n appartient pas au tour — la
voie des stands, les raccourcis, l anneau de vitesse — par leur nom.
"""
import json
import math
import re
import sys
import urllib.parse
import urllib.request

SERVEURS = ['https://overpass.private.coffee/api/interpreter',
            'https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter']


def interroge(bbox, cache=None):
    if cache:
        try:
            return json.load(open(cache, encoding='utf-8'))
        except OSError:
            pass
    q = f'[out:json][timeout:90];(way["highway"="raceway"]({bbox}););out geom;'
    dernier = None
    for s in SERVEURS:
        try:
            url = s + '?' + urllib.parse.urlencode({'data': q})
            r = urllib.request.Request(url, headers={'User-Agent': 'EyesOnLine/0.2 (trace de circuit)'})
            with urllib.request.urlopen(r, timeout=120) as f:
                d = json.loads(f.read().decode('utf-8'))
            if cache:
                json.dump(d, open(cache, 'w', encoding='utf-8'))
            return d
        except Exception as e:                       # noqa: BLE001 — on essaie le serveur suivant
            print(f'    {s} : {e}')
            dernier = e
    raise SystemExit(f'aucun serveur Overpass n a repondu ({dernier})')


def assemble(voies, depart, sauf):
    """Enchaine les voies bout a bout a partir de celle que `depart` nomme."""
    cle = lambda p: (round(p['lat'], 7), round(p['lon'], 7))
    debut = {}
    for w in voies:
        nom = (w.get('tags') or {}).get('name', '')
        if any(s and s.lower() in nom.lower() for s in sauf):
            continue
        debut.setdefault(cle(w['geometry'][0]), []).append(w)
    tete = [w for w in voies if (w.get('tags') or {}).get('name', '') == depart]
    if not tete:
        noms = sorted({(w.get('tags') or {}).get('name', '—') for w in voies})
        raise SystemExit('voie de depart introuvable. Les voies lisibles ici :\n  ' + '\n  '.join(noms))
    tete = tete[0]
    pts, vus, suite = list(tete['geometry']), {tete['id']}, [tete]
    while True:
        cand = [w for w in debut.get(cle(pts[-1]), []) if w['id'] not in vus]
        if not cand:
            break
        w = cand[0]
        vus.add(w['id']); suite.append(w)
        pts += w['geometry'][1:]
        if cle(pts[-1]) == cle(pts[0]):
            break
    ferme = cle(pts[-1]) == cle(pts[0])
    return pts[:-1] if ferme else pts, suite, ferme


def metres(pts):
    """Lat/lon vers des metres plans. y vers le bas, comme sur un canvas."""
    R = 6371000.0
    lat0 = sum(p['lat'] for p in pts) / len(pts)
    c = math.cos(math.radians(lat0))
    return [(math.radians(p['lon']) * R * c, -math.radians(p['lat']) * R) for p in pts]


def main():
    o = {a.split('=')[0][2:]: (a.split('=', 1)[1] if '=' in a else '1')
         for a in sys.argv[1:] if a.startswith('--')}
    if 'bbox' not in o or 'depart' not in o:
        print(__doc__); return 1
    sys.path.insert(0, __file__.rsplit('/', 1)[0])
    import tracer                                     # pour le reechantillonnage et le sens

    print(f"\n  OpenStreetMap, boite {o['bbox']}")
    d = interroge(o['bbox'], o.get('cache'))
    voies = [e for e in d['elements'] if e.get('type') == 'way' and e.get('geometry')]
    print(f'  {len(voies)} voies de course dans la boite')

    sauf = [s.strip() for s in o.get('sauf', '').split(',') if s.strip()]
    pts, suite, ferme = assemble(voies, o['depart'], sauf)
    print(f'  {len(suite)} voies enchainees, {len(pts)} points releves, '
          f'boucle {"fermee" if ferme else "OUVERTE — le tour ne se referme pas"}')
    for w in suite:
        print(f"    {w['id']:>11}  {(w.get('tags') or {}).get('name', '—')}")
    if not ferme:
        return 1

    xy = metres(pts)
    L = tracer.perimetre(xy)
    off = o.get('longueur')
    msg = ''
    if off:
        e = L - float(off)
        msg = f" · longueur officielle {off} m, ecart {e:+.0f} m ({abs(e)/float(off)*100:.2f} %)"
    print(f'  longueur relevee {L:.0f} m{msg}')
    if off and abs(L - float(off)) / float(off) > 0.02:
        print('  ATTENTION : plus de 2 % d ecart. Ce n est probablement pas le bon tour.')

    n = int(o.get('points', 600))
    r = tracer.reechantillonne(xy, n)
    if (tracer.aire(r) < 0) != (o.get('sens', 'horaire') != 'horaire'):
        r = r[::-1]
        print('  boucle retournee pour tourner dans le bon sens')
    j = tracer.depart_auto(r)
    r = r[j:] + r[:j]
    print(f'  depart pose sur la plus longue ligne droite (point {j})')

    xs = [p[0] for p in r]; ys = [p[1] for p in r]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    ech = 200 / max(max(xs) - min(xs), max(ys) - min(ys))
    r = [((p[0] - cx) * ech, (p[1] - cy) * ech) for p in r]
    dec = int(o.get('decimales', 3))
    par_ligne = max(1, 6 - dec)
    print(f'\n  {n} points · perimetre {tracer.perimetre(r):.1f} unites · boite '
          f'{max(q[0] for q in r)-min(q[0] for q in r):.0f} x {max(q[1] for q in r)-min(q[1] for q in r):.0f}\n')
    print('    pts: [')
    for k in range(0, n, par_ligne):
        print('      ' + ', '.join(f'[{p[0]:.{dec}f}, {p[1]:.{dec}f}]' for p in r[k:k + par_ligne]) + ',')
    print('    ],')
    return 0


if __name__ == '__main__':
    sys.exit(main())
