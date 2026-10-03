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
    Strecke » ses 20, et on ne choisit plus entre quatre traces imbriques, on nomme celui qu on veut.

    DEUX ETIQUETTES POUR LA MEME CHOSE. On ne prenait que « type=circuit », et le circuit de la
    Sarthe n y est pas : il est decrit en « type=route, route=raceway », parce qu il n est permanent
    qu en partie — les Hunaudieres sont une route departementale le reste de l annee. On a donc cru
    des heures qu OpenStreetMap ne connaissait pas Le Mans. On accepte les deux etiquettes, et la
    longueur officielle reste le juge : une relation prise a tort ne se refermerait pas dessus."""
    out = {}
    for brut in morceaux:
        for _, el in ET.iterparse(io.BytesIO(brut), events=('end',)):
            if el.tag != 'relation':
                continue
            tags = {t.get('k'): t.get('v') for t in el.findall('tag')}
            if tags.get('type') == 'circuit' or tags.get('route') == 'raceway':
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
            print('  relations de circuit dans cette boite :')
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


def metres(pts, lat0=None):
    """Lat/lon vers des metres plans. y vers le bas, comme sur un canvas.

    `lat0` se passe explicitement quand on projette DEUX choses qui doivent rester comparables — la
    piste et la voie des stands — sinon chacune prend sa propre latitude de reference et les deux ne
    se superposent plus."""
    R = 6371000.0
    if lat0 is None:
        lat0 = sum(p['lat'] for p in pts) / len(pts)
    c = math.cos(math.radians(lat0))
    return [(math.radians(p['lon']) * R * c, -math.radians(p['lat']) * R) for p in pts]


def depart_aux_stands(r, stands, large=40.0):
    """La ligne de depart, posee la ou la voie des stands longe la piste.

    `depart_auto` prend la plus longue ligne droite, faute de mieux. C est juste a Monza, ou la plus
    longue EST la ligne droite des stands, et faux a Spa, ou c est le Kemmel, et a Silverstone, ou
    c est la Hangar Straight : la grille se posait au milieu du circuit, loin des stands.

    La voie des stands, elle, ne longe qu un endroit. On mesure donc, station par station, la distance
    a la voie la plus proche, on garde la plus longue portion ou elle reste sous `large` metres, et on
    se place aux deux tiers de cette portion — pour laisser la grille derriere sans empieter sur le
    freinage du premier virage."""
    if not stands:
        return None
    n = len(r)
    cases = {}
    for p in stands:
        cases.setdefault((int(p[0] // large), int(p[1] // large)), []).append(p)
    def pres(p):
        i, j = int(p[0] // large), int(p[1] // large)
        for a in (i - 1, i, i + 1):
            for b in (j - 1, j, j + 1):
                for q in cases.get((a, b), ()):
                    if math.dist(p, q) < large:
                        return True
        return False
    longe = [pres(p) for p in r]
    if not any(longe):
        return None
    best, deb, cur, bdeb = 0, 0, 0, 0
    for k in range(2 * n):                       # deux tours, pour une portion a cheval sur la fin
        i = k % n
        if longe[i]:
            if cur == 0:
                deb = k
            cur += 1
            if cur > best:
                best, bdeb = cur, deb
        else:
            cur = 0
    return (bdeb + int(best * 2 / 3)) % n, best


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

    lat0 = sum(p['lat'] for p in pts) / len(pts)
    xy = metres(pts, lat0)
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
    # LE SENS DE COURSE est une donnee du circuit, pas une convention du jeu : Interlagos et Mount
    # Panorama tournent a l envers des dix autres. Il est declare par `--sens`, et verifiable sur
    # n importe quelle carte. Le test s appuyait avant sur le signe de `aire`, dont la description
    # etait fausse : les douze circuits tournaient a l envers du vrai.
    if tracer.sens_horaire(r) != (o.get('sens', 'horaire') == 'horaire'):
        r = r[::-1]
        print(f"  boucle retournee pour tourner dans le sens {o.get('sens', 'horaire')}")
    voie = []
    rx = re.compile(o.get('stands', 'pit|box|stand'), re.I)
    for w in tout:
        t = w.get('tags') or {}
        if t.get('highway') == 'raceway' and rx.search(t.get('name', '')):
            voie += metres(w['geometry'], lat0)
    pose = depart_aux_stands(r, voie)
    if pose:
        j, lg = pose
        print(f'  depart pose aux deux tiers de la ligne droite des stands '
              f'({lg} points le long de la voie, point {j})')
    else:
        j = tracer.depart_auto(r)
        print(f'  pas de voie des stands lisible : depart sur la plus longue ligne droite (point {j})')
    r = r[j:] + r[:j]

    # UN POINT DU DECOR, EXPRIME EN FRACTION DE TOUR. `--repere=lat,lon` rend la station la plus
    # proche d un lieu donne — une passerelle, une tribune. On le fait ICI, apres la mise en ordre et
    # avant la rotation : un indice ne depend ni de l angle ni de l echelle, seulement du point de
    # depart et du sens. La fraction se garde telle quelle dans `js/tracks.js`, ou elle survit au
    # reechantillonnage de `js/track.js`.
    # LES PASSERELLES QUI ENJAMBENT LA PISTE. Une passerelle pietonne est un chemin comme un autre
    # dans OpenStreetMap, avec `bridge=yes`. Reste a savoir lesquelles passent AU-DESSUS de la piste,
    # et non a cote : un circuit traverse une ville ou une foret pleines de passerelles qui ne le
    # concernent pas.
    #
    # ON NE MESURE PAS UNE DISTANCE, ON CHERCHE UN CROISEMENT. La premiere version gardait les ponts
    # dont un noeud tombait a moins de douze metres de l axe, puis verifiait que les deux bouts
    # etaient de part et d autre. Ca marchait a Monza, a Monaco et a Silverstone — et ca rendait zero
    # passerelle au Mans, qui en a sept. Un pont n est pourtant decrit que par ses deux CULEES : la
    # Passerelle Porsche porte 56 m de tablier, ses noeuds sont donc a vingt-huit metres de l axe,
    # loin au-dela du seuil. Le seuil ne mesurait pas ce que je croyais ; il ne retenait que les
    # ponts courts.
    #
    # Deux segments se croisent ou ne se croisent pas : c est exact, sans seuil a regler, et le point
    # de croisement donne la station directement. Un pont qui longe la piste a un metre ne croise
    # pas ; un pont de deux cents metres qui la franchit, si.
    if o.get('passerelles'):
        n = len(r)

        def croise(p, q, a, b):
            """Le point ou [p,q] croise [a,b], en fraction de [a,b] — ou None."""
            rx, ry = q[0] - p[0], q[1] - p[1]
            sx, sy = b[0] - a[0], b[1] - a[1]
            den = rx * sy - ry * sx
            if abs(den) < 1e-12:
                return None
            t = ((a[0] - p[0]) * sy - (a[1] - p[1]) * sx) / den
            u = ((a[0] - p[0]) * ry - (a[1] - p[1]) * rx) / den
            return u if 0 <= t <= 1 and 0 <= u <= 1 else None

        trouvees, extremites = [], {}
        for w in tout:
            t = w.get('tags') or {}
            if t.get('bridge') not in ('yes', 'viaduct'):
                continue
            if t.get('highway') not in ('footway', 'path', 'pedestrian', 'steps', 'cycleway'):
                continue
            g = metres(w['geometry'], lat0)
            extremites[w['id']] = [(p['lat'], p['lon']) for p in (w['geometry'][0], w['geometry'][-1])]
            portee = sum(math.dist(g[i], g[i + 1]) for i in range(len(g) - 1))
            for i in range(len(g) - 1):
                p, q = g[i], g[i + 1]
                lo = (min(p[0], q[0]), min(p[1], q[1]))
                hi = (max(p[0], q[0]), max(p[1], q[1]))
                for k in range(n):
                    a, b = r[k], r[(k + 1) % n]
                    if max(a[0], b[0]) < lo[0] or min(a[0], b[0]) > hi[0]:
                        continue
                    if max(a[1], b[1]) < lo[1] or min(a[1], b[1]) > hi[1]:
                        continue
                    u = croise(p, q, a, b)
                    if u is None:
                        continue
                    trouvees.append(((k + u) / n, w['id'], t.get('name') or '\u2014', portee))
                    break
                else:
                    continue
                break

        # UNE PASSERELLE, PLUSIEURS CHEMINS — mais deux passerelles restent deux. Le releve coupe
        # souvent un ouvrage en morceaux : la Passerelle Goodyear est un tablier et deux escaliers.
        # On regroupe donc les chemins QUI SE TOUCHENT, c est-a-dire qui partagent un noeud. On avait
        # d abord regroupe par distance — moins de vingt metres le long du tour — et ca fondait en
        # une les deux passerelles de la Wellington Straight, qui sont deux ouvrages distincts a dix
        # metres l un de l autre. Partager un noeud est un fait de la base ; vingt metres etait un
        # seuil de mon cru.
        bouts = {c[1]: set(extremites[c[1]]) for c in trouvees}
        parent = {i: i for i in bouts}

        def racine(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i

        for i in bouts:
            for k2 in bouts:
                if i < k2 and bouts[i] & bouts[k2]:
                    parent[racine(i)] = racine(k2)
        paquets = {}
        for c in trouvees:
            paquets.setdefault(racine(c[1]), []).append(c)
        groupes = sorted(paquets.values(), key=lambda g: g[0][0])

        print(f'\n  {len(groupes)} passerelle(s) enjambent la piste :')
        for grp in groupes:
            f = sum(c[0] for c in grp) / len(grp)
            nom = next((c[2] for c in grp if c[2] != '\u2014'), '\u2014')
            print(f'    {f:.4f} du tour  {nom[:26]:26} voie {grp[0][1]:>11}'
                  f'  chemin {max(c[3] for c in grp):5.1f} m  ({len(grp)} chemin(s))')
        if groupes:
            print('    passerelles: ['
                  + ', '.join(f'{sum(c[0] for c in g) / len(g):.4f}' for g in groupes) + '],')

    # LES TUNNELS. Rien a chercher ici : une voie du tour porte « tunnel=yes », ou elle ne la porte
    # pas. On rend donc les deux bouts de chaque voie souterraine, en fractions de tour, et on colle
    # celles qui se suivent — un tunnel long est souvent decoupe en plusieurs voies.
    #
    # « TUNNEL » ET « COUVERT » SONT RENDUS A PART, et c est volontaire. Couvert veut dire que quelque
    # chose passe au-dessus — a Monza, les vingt-cinq metres sous la passerelle du Serraglio, qu on
    # dessine deja comme une passerelle. Souterrain veut dire etre dedans. Les deux se dessinent
    # pareil, mais ils ne se decident pas pareil : un tunnel se prend sans discuter, un couvert se
    # regarde avant, parce qu il fait parfois double emploi avec ce qui le couvre.
    if o.get('tunnels'):
        n = len(r)
        pres = lambda q: min(range(n), key=lambda i: math.dist(r[i], q))
        spans = []
        for w in suite:
            t = w.get('tags') or {}
            if t.get('tunnel') in ('yes', 'building_passage'):
                genre = 'souterrain'
            elif t.get('covered') == 'yes':
                genre = 'couvert'
            else:
                continue
            g = metres(w['geometry'], lat0)
            a, b = pres(g[0]), pres(g[-1])
            # le tour est oriente : le tunnel va de a vers b dans le sens de la course, et passer
            # par zero est normal — c est une boucle.
            if (b - a) % n > n / 2:
                a, b = b, a
            spans.append([a / n, b / n, genre, w['id'], t.get('name') or '\u2014',
                          round(longueur(w['geometry']))])
        spans.sort()
        for genre in ('souterrain', 'couvert'):
            lot = [sp for sp in spans if sp[2] == genre]
            colles = []
            for sp in lot:
                if colles and (sp[0] - colles[-1][1]) % 1.0 * L < 25:
                    colles[-1][1] = sp[1]
                    colles[-1][5] += sp[5]
                else:
                    colles.append(list(sp))
            print(f'\n  {len(colles)} passage(s) « {genre} » sur le tour :')
            for a, b, _, i, nom, lg in colles:
                print(f'    {a:.4f} \u2192 {b:.4f} du tour  {nom[:26]:26} voie {i:>11}  {lg} m releves, '
                      f'{(b - a) % 1.0 * L:.0f} m sur le tour')
            if colles:
                print('    tunnels: [' + ', '.join(f'[{a:.4f}, {b:.4f}]' for a, b, *_ in colles) + '],')

    if 'repere' in o:
        rl, ro = (float(v) for v in o['repere'].split(','))
        cible = metres([{'lat': rl, 'lon': ro}], lat0)[0]
        k = min(range(len(r)), key=lambda i: (r[i][0]-cible[0])**2 + (r[i][1]-cible[1])**2)
        d = math.dist(r[k], cible)
        print(f'  repere {rl},{ro} : station {k}/{len(r)}, soit {k/len(r):.4f} du tour, a {d:.1f} m de l axe')

    # L ORIENTATION, mesuree et non choisie : un releve est au nord, une carte de circuit ne l est
    # presque jamais, et on reconnait un circuit a sa silhouette posee comme on l a toujours vue.
    # `tools/orientation.py` superpose le trace a la carte connue et rend l angle qui les fait
    # coincider. Une rotation ne change rien a la course : longueurs et rayons sont les memes.
    r = tracer.tourne(r, float(o.get('rotation', 0)))
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
