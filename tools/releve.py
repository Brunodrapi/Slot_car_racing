#!/usr/bin/env python3
"""Un trace de circuit, releve dans OpenStreetMap, vers la liste de points de js/traces.js.

    python3 tools/releve.py --bbox=sud,ouest,nord,est --relation=Monaco --longueur=3337
    python3 tools/releve.py --bbox=sud,ouest,nord,est --relation=?       # les relations de la boite
    python3 tools/releve.py --bbox=45.611,9.275,45.632,9.300 --depart="Rettifilo di partenza" \
        --longueur=5793 [--points=600] [--decimales=3] [--sauf="Pit Lane,..."] [--aussi=<regex>]

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

LES CIRCUITS EN VILLE. Monaco, Le Mans et Mount Panorama passent par des routes publiques, qui ne
portent pas l etiquette de circuit. `--aussi` prend une expression a chercher dans le NOM des voies
et les ajoute aux candidates : a Mount Panorama, « ^(Pit Straight|Hell Corner|Mountain Straight|...)$ ».

On ne devine pas ces noms : quand la chaine s arrete, l outil affiche ce qui repart du point ou elle
s arrete, avec son etiquette et son nom, et il suffit de l ajouter. Trois allers-retours ont suffi
pour Mount Panorama. Une version de l outil le faisait seule, en prenant la premiere voie qui repart
du bon point : a Bathurst elle a pris Hinton Road, une rue adjacente, et s est perdue en ville. Une
liste de rues ecrite a la main dit en plus quelque chose de vrai sur le circuit — par quelles rues il
passe — la ou un automatisme qui se trompe ne dit rien du tout.

L ASSEMBLAGE. Un circuit n est pas une seule voie dans OpenStreetMap mais une vingtaine, chacune
nommee d apres le virage qu elle porte. On part de celle que `--depart` designe et on enchaine : la
voie suivante est celle dont le premier noeud est le dernier de la precedente. Les voies a sens
unique rendent l enchainement sans ambiguite. `--sauf` ecarte ce qui n appartient pas au tour — la
voie des stands, les raccourcis, l anneau de vitesse — par leur nom.
"""
import io
import math
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

API = 'https://api.openstreetmap.org/api/0.6/map'
SEPARE = b'\n<!-- morceau suivant -->\n'


def telecharge(bbox, cache=None, prof=0):
    """L API d OpenStreetMap plutot qu Overpass.

    Overpass est la facon habituelle d extraire une selection de donnees, et c est ce que cet outil
    faisait. Sur onze circuits d affilee, aucune des trois instances publiques n a repondu : delais
    depasses, 504, connexions coupees. L API de base, elle, rend 5 Mo en deux secondes — elle ne sait
    pas filtrer, mais elle ne tombe pas. On filtre donc ici, ce qui ne coute rien.

    Elle refuse en revanche de rendre plus de 50 000 noeuds d un coup, et un circuit en pleine ville
    — Interlagos, Monaco — dépasse. On coupe alors la boite en quatre et on recommence sur chaque
    morceau : l API rend, pour chaque noeud de la boite, TOUS les chemins qui le touchent et tous
    leurs noeuds, meme hors boite. Un chemin a cheval sur deux morceaux revient donc entier des deux
    cotes, et il suffit de ne le garder qu une fois.

    `bbox` est « sud,ouest,nord,est », comme on lit une carte ; l API attend l ordre inverse."""
    if cache and prof == 0 and os.path.exists(cache):
        return open(cache, 'rb').read().split(SEPARE)
    s, o, n, e = (float(v) for v in bbox.split(','))
    url = f'{API}?bbox={o},{s},{e},{n}'
    r = urllib.request.Request(url, headers={'User-Agent': 'EyesOnLine/0.2 (trace de circuit)'})
    try:
        with urllib.request.urlopen(r, timeout=180) as f:
            brut = [f.read()]
    except urllib.error.HTTPError as err:
        if err.code != 400 or prof >= 3:
            raise
        print(f'    boite trop peuplee, coupee en quatre (niveau {prof + 1})')
        my, mx = (s + n) / 2, (o + e) / 2
        brut = []
        for a, b, c, d in ((s, o, my, mx), (s, mx, my, e), (my, o, n, mx), (my, mx, n, e)):
            brut += telecharge(f'{a},{b},{c},{d}', None, prof + 1)
    if cache and prof == 0:
        # un morceau par requete, separes : recolles bout a bout ils ne formeraient plus un XML
        open(cache, 'wb').write(SEPARE.join(brut))
    return brut


def relations(morceaux):
    """Les relations « type=circuit » : la liste officielle des voies qui forment un tour.

    C est la bonne reponse, et elle a mis du temps a venir. On cherchait d abord les voies une a une,
    par leur etiquette puis par leur nom de rue — ce qui marche pour un autodrome et pas pour un
    circuit en ville, ou le tour emprunte une douzaine de rues qu il faut deviner. OpenStreetMap les
    a deja groupees : la relation « Circuit de Monaco » porte ses 43 voies, « Nurburgring Grand Prix
    Strecke » ses 20, et on ne choisit plus entre quatre traces imbriques, on nomme celui qu on veut."""
    out = {}
    for brut in morceaux:
        for _, el in ET.iterparse(io.BytesIO(brut), events=('end',)):
            if el.tag != 'relation':
                continue
            tags = {t.get('k'): t.get('v') for t in el.findall('tag')}
            if tags.get('type') == 'circuit':
                nom = tags.get('name', f"relation {el.get('id')}")
                membres = [int(m.get('ref')) for m in el.findall('member') if m.get('type') == 'way']
                out.setdefault(nom, set()).update(membres)
            el.clear()
    return out


def voies(morceaux):
    """Les chemins des fichiers OSM, chacun avec ses etiquettes et ses points, sans doublon."""
    noeuds, vus, out = {}, set(), []
    for brut in morceaux:
        for _, el in ET.iterparse(io.BytesIO(brut), events=('end',)):
            if el.tag == 'node':
                noeuds[el.get('id')] = {'lat': float(el.get('lat')), 'lon': float(el.get('lon'))}
    for brut in morceaux:
        for _, el in ET.iterparse(io.BytesIO(brut), events=('end',)):
            if el.tag != 'way':
                continue
            i = int(el.get('id'))
            if i in vus:
                el.clear(); continue
            tags = {t.get('k'): t.get('v') for t in el.findall('tag')}
            geo = [noeuds[nd.get('ref')] for nd in el.findall('nd') if nd.get('ref') in noeuds]
            if len(geo) >= 2:
                vus.add(i); out.append({'id': i, 'tags': tags, 'geometry': geo})
            el.clear()
    return out


def interroge(bbox, cache=None, aussi=None, relation=None):
    """Les voies qui peuvent appartenir au tour.

    Avec `--relation`, ce sont celles que la relation nomme, et elles seules. Sinon celles balisees
    circuit, plus celles dont le nom repond a `--aussi`."""
    morceaux = telecharge(bbox, cache)
    tout = voies(morceaux)
    rels = relations(morceaux)
    if relation:
        cibles = [n for n in rels if relation.lower() in n.lower()]
        if not cibles:
            print('  relations « type=circuit » dans cette boite :')
            for n in sorted(rels):
                print(f'    {len(rels[n]):3} voies  {n}')
            raise SystemExit('  aucune ne correspond a --relation')
        if len(cibles) > 1:
            raise SystemExit('  plusieurs relations correspondent : ' + ', '.join(cibles))
        print(f'  relation « {cibles[0]} », {len(rels[cibles[0]])} voies')
        ids = rels[cibles[0]]
        return tout, [w for w in tout if w['id'] in ids]
    rx = re.compile(aussi, re.I) if aussi else None
    gardees = [w for w in tout
               if w['tags'].get('highway') == 'raceway'
               or (rx and rx.search(w['tags'].get('name', '')))]
    return tout, gardees


def assemble(voies, depart, sauf, vise=None, essais=40000, jointure=0.5):
    """Cherche la boucle du tour, en essayant les embranchements plutot qu en les devinant.

    Une voie peut etre dessinee dans un sens ou dans l autre : OpenStreetMap n a aucune raison de les
    avoir toutes orientees dans le sens de la course. On accepte donc qu une voie COMMENCE ou FINISSE
    la ou la precedente s arrete, quitte a la retourner.

    Et un circuit n est presque jamais une seule boucle sur le terrain : le Nurburgring porte quatre
    tracés imbriques, Silverstone en porte trois, Spa a sa boucle moto. A chaque fourche, suivre la
    premiere voie venue menait au mauvais tour — et deviner les exclusions a la main demandait de
    savoir d avance lequel des noms allemands designe un raccourci. On explore donc toutes les
    fourches en profondeur, on garde les boucles FERMEES, et on rend celle dont la longueur tombe le
    plus pres de la longueur officielle. C est la longueur annoncee qui tranche, pas mon jugement sur
    un nom de virage."""
    gardees = [w for w in voies
               if not any(x and x.lower() in (w.get('tags') or {}).get('name', '').lower() for x in sauf)]

    # DEUX VOIES SE REJOIGNENT QUAND ELLES PARTAGENT UN NOEUD — sauf quand le releve a un trou. La
    # relation de Monaco en a un au Casino : trois voies s y arretent a dix et trente metres les unes
    # des autres sans noeud commun, et la boucle ne pouvait pas se fermer. On regroupe donc les
    # extremites qui tombent a moins de `jointure` metres, et ce groupe tient lieu de point commun.
    # La longueur officielle reste le garde-fou : rapprocher deux bouts qui n ont rien a voir se
    # verrait aussitot sur le total.
    R = 6371000.0
    bouts = []
    for w in gardees:
        bouts += [w['geometry'][0], w['geometry'][-1]]
    amas = []                                   # chaque amas : [lat, lon] de son premier point
    index = {}
    for p in bouts:
        exact = (p['lat'], p['lon'])
        if exact in index:
            continue
        for i, (la, lo) in enumerate(amas):
            dx = (p['lon'] - lo) * R * math.cos(math.radians(la)) * math.pi / 180
            dy = (p['lat'] - la) * R * math.pi / 180
            if math.hypot(dx, dy) <= jointure:
                index[exact] = i
                break
        else:
            amas.append((p['lat'], p['lon']))
            index[exact] = len(amas) - 1
    cle = lambda p: index.get((p['lat'], p['lon']), (p['lat'], p['lon']))
    debut, fin = {}, {}
    for w in gardees:
        debut.setdefault(cle(w['geometry'][0]), []).append(w)
        fin.setdefault(cle(w['geometry'][-1]), []).append(w)
    if not depart:
        # Avec une relation, n importe quelle voie DU TOUR fait l affaire : on prend la plus longue
        # parmi celles qu on garde — pas parmi toutes, sinon on demarre dans la voie des stands.
        tete = [max(gardees, key=lambda w: longueur(w['geometry']))]
    else:
        tete = [w for w in voies if (w.get('tags') or {}).get('name', '') == depart]
    if not tete:
        noms = sorted({(w.get('tags') or {}).get('name', '—') for w in voies})
        raise SystemExit('voie de depart introuvable. Les voies lisibles ici :\n  ' + '\n  '.join(noms))
    tete = tete[0]
    depart_cle = cle(tete['geometry'][0])

    boucles = []
    loin = {'suite': [tete], 'bout': tete['geometry'][-1]}   # la plus longue chaine vue, pour expliquer un echec
    vus_total = [0]

    def marche(pts, suite, vus):
        vus_total[0] += 1
        if vus_total[0] > essais:
            return
        if len(suite) > len(loin['suite']):
            loin['suite'], loin['bout'] = list(suite), pts[-1]
        if len(suite) > 1 and cle(pts[-1]) == depart_cle:
            boucles.append((list(pts[:-1]), list(suite)))
            return
        suivantes = [(w, w['geometry']) for w in debut.get(cle(pts[-1]), []) if w['id'] not in vus]
        suivantes += [(w, w['geometry'][::-1]) for w in fin.get(cle(pts[-1]), []) if w['id'] not in vus]
        for w, geo in suivantes:
            marche(pts + geo[1:], suite + [w], vus | {w['id']})

    sys.setrecursionlimit(10000)
    marche(list(tete['geometry']), [tete], {tete['id']})

    if not boucles:
        return None, loin['suite'], False, loin['bout']
    if vise:
        boucles.sort(key=lambda b: abs(longueur(b[0] + [b[0][0]]) - float(vise)))
    else:
        boucles.sort(key=lambda b: -longueur(b[0] + [b[0][0]]))
    pts, suite = boucles[0]
    return pts, suite, True, len(boucles)


def longueur(geo):
    R = 6371000.0
    lat0 = sum(p['lat'] for p in geo) / len(geo)
    c = math.cos(math.radians(lat0))
    xy = [(math.radians(p['lon']) * R * c, math.radians(p['lat']) * R) for p in geo]
    return sum(math.dist(xy[i], xy[i + 1]) for i in range(len(xy) - 1))


def metres(pts):
    """Lat/lon vers des metres plans. y vers le bas, comme sur un canvas."""
    R = 6371000.0
    lat0 = sum(p['lat'] for p in pts) / len(pts)
    c = math.cos(math.radians(lat0))
    return [(math.radians(p['lon']) * R * c, -math.radians(p['lat']) * R) for p in pts]


def main():
    o = {a.split('=')[0][2:]: (a.split('=', 1)[1] if '=' in a else '1')
         for a in sys.argv[1:] if a.startswith('--')}
    if 'bbox' not in o or ('depart' not in o and 'relation' not in o and not o.get('liste')):
        print(__doc__); return 1
    sys.path.insert(0, __file__.rsplit('/', 1)[0])
    import tracer                                     # pour le reechantillonnage et le sens

    print(f"\n  OpenStreetMap, boite {o['bbox']}")
    tout, candidates = interroge(o['bbox'], o.get('cache'), o.get('aussi'), o.get('relation'))
    print(f'  {len(tout)} chemins dans la boite, dont {len(candidates)} retenus')
    if o.get('liste'):
        vus = {}
        for w in candidates:
            vus.setdefault(w['tags'].get('name', '—'), []).append(longueur(w['geometry']))
        for nom in sorted(vus, key=lambda k: -sum(vus[k])):
            print(f'    {sum(vus[nom]):7.0f} m  x{len(vus[nom]):<3} {nom}')
        return 0

    sauf = [x.strip() for x in o.get('sauf', '').split(',') if x.strip()]
    pts, suite, ferme, extra = assemble(candidates, o.get('depart'), sauf, o.get('longueur'),
                                       int(o.get('essais', 40000)), float(o.get('jointure', 0.5)))

    if not ferme:
        bout = extra
        print(f'\n  aucune boucle fermee. La plus longue chaine fait {len(suite)} voies et '
              f"s arrete a {bout['lat']:.6f},{bout['lon']:.6f} :")
        for w in suite:
            print(f"    {w['id']:>11}  {(w.get('tags') or {}).get('name', '—')}")
        R = 6371000.0
        c = math.cos(math.radians(bout['lat']))
        d = lambda p: math.hypot((p['lon'] - bout['lon']) * R * c * math.pi / 180,
                                 (p['lat'] - bout['lat']) * R * math.pi / 180)
        # on regarde TOUS les chemins, pas seulement les candidats : quand la chaine s arrete, c est
        # le plus souvent que la suite n a pas ete retenue — et ne pas la nommer n apprend rien.
        print('  ce qui passe a moins de 40 m de ce point :')
        proches = []
        for w in tout:
            for cote, p in (('debut', w['geometry'][0]), ('fin', w['geometry'][-1])):
                if d(p) < 40:
                    proches.append((d(p), w['id'], w, cote))
        for dist, _, w, cote in sorted(proches, key=lambda x: (x[0], x[1]))[:8]:
            t = w.get('tags') or {}
            if w not in candidates:
                etat = 'non retenue (' + (t.get('highway') or 'sans highway') + ')'
            elif any(x and x.lower() in t.get('name', '').lower() for x in sauf):
                etat = 'ECARTEE'
            else:
                etat = 'libre'
            print(f"    {dist:5.1f} m  {cote:5}  {w['id']:>11}  {t.get('name', '—'):28}{etat}")
        return 1
    print(f'  {extra} boucle(s) fermee(s) trouvee(s) ; retenue : {len(suite)} voies, {len(pts)} points')
    for w in suite:
        print(f"    {w['id']:>11}  {(w.get('tags') or {}).get('name', '—')}")

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
