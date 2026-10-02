#!/usr/bin/env python3
"""Refabrique `js/traces.js` : un relevé OpenStreetMap par circuit, et la table qui les décrit.

    python3 tools/traces.py [--cache=<dossier>] [--points=600] [--decimales=3] [circuit...]

CE QUE CETTE TABLE DIT. Pour chaque circuit : où regarder, quelle relation lire, ce qu'il faut
écarter, et la longueur officielle. Rien n'y est un réglage de confort — chaque valeur a été obtenue
en regardant ce que l'outil affichait quand il échouait, et la longueur officielle est ce qui
tranche : un tour qui ne tombe pas dessus à 2 % près n'est pas le bon tour, et `tools/releve.py`
refuse de le dire autrement.

POURQUOI UNE RELATION. OpenStreetMap groupe les voies d'un circuit dans une relation « type=circuit ».
C'est la liste officielle du tour, et elle règle d'un coup les trois difficultés qu'on affrontait
autrement : les circuits en ville, dont le tour emprunte des rues publiques qu'il fallait nommer une
à une ; les circuits à plusieurs tracés imbriqués, où suivre la première voie venue menait au mauvais
(le Nürburgring en porte quatre) ; et les voies dessinées à l'envers. Laguna Seca n'a pas de relation,
et se laisse lire par la seule étiquette `highway=raceway`.

LES DEUX QUI MANQUENT. Monaco a un trou de relevé au Casino — trois voies s'y arrêtent à dix et
trente mètres les unes des autres sans nœud commun — d'où sa tolérance de jointure. Le Mans n'est pas
là : le Circuit de la Sarthe emprunte la D338 sur ses six kilomètres de Hunaudières, et cette route
n'est ni balisée circuit ni nommée ; seul le Circuit Bugatti, qui tient dans l'enceinte, a une
relation. C'est un choix de jeu, pas un problème d'outil.
"""
import os
import subprocess
import sys
import urllib.request

OUTIL = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'releve.py')
TRACEUR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tracer.py')
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# L'ANGLE est mesuré, pas choisi : `tools/orientation.py` superpose le tracé relevé à la carte que
# tout le monde connaît et rend la rotation qui les fait coïncider, avec le résidu qui dit si la
# superposition a vraiment eu lieu. Un relevé est orienté au nord ; une carte de circuit ne l'est
# presque jamais, et on reconnaît un circuit à sa silhouette posée comme on l'a toujours vue.
#
# Le Nürburgring vaut 0,9° : sa carte est à peu de chose près orientée au nord, et c'est le seul des
# douze dont l'angle mesuré ne change presque rien. Il a été mesuré comme les autres, après plusieurs
# heures de 429 de la part de Wikimedia.
#
# LE SENS DE COURSE est une donnée du circuit, vérifiable sur n'importe quelle carte : dix tournent
# dans le sens des aiguilles d'une montre, Interlagos et Mount Panorama à l'envers. Il était déduit
# du signe d'une aire dont la description était fausse, et les douze tournaient donc à l'envers du
# vrai. Une donnée qu'on peut déclarer ne se devine pas.
#
#  id            boîte sud,ouest,nord,est             relation                              écarté          long.  joint. sens          angle
TABLE = [
    ('monza',       '45.611,9.275,45.632,9.300',  'Autodromo Nazionale di Monza',        'Pit Lane',       5793, 0.5, 'horaire', 262.7),
    ('spa',         '50.418,5.950,50.452,5.995',  'Circuit de Spa Francorchamps',        'Pit Lane',       7004, 0.5, 'horaire', 270.2),
    ('monaco',      '43.730,7.410,43.752,7.442',  'Circuit de Monaco',                   'stands',         3337, 20, 'horaire', 14.1),
    ('silverstone', '52.055,-1.040,52.090,-0.985', 'Silverstone Grand Prix',             'pit lane',       5891, 0.5, 'horaire', 284.0),
    ('suzuka',      '34.832,136.515,34.864,136.555', '鈴鹿サーキット',                      'Pit Lane',       5807, 0.5, 'horaire', 119.0),
    ('interlagos',  '-23.715,-46.710,-23.690,-46.678', 'José Carlos Pace',               'Pit Lane',       4309, 0.5, 'antihoraire', 47.3),
    ('laguna',      '36.575,-121.770,36.600,-121.740', None,                             'Pit Lane',       3602, 0.5, 'horaire', 251.1),
    ('nurburgring', '50.322,6.925,50.355,6.965',  'Nürburgring Grand Prix Strecke',      'Boxengasse',     5148, 0.5, 'horaire', 0.9),
    ('bathurst',    '-33.465,149.540,-33.435,149.575', 'Mount Panorama Circuit',         '',               6213, 0.5, 'antihoraire', 238.5),
    ('redbullring', '47.210,14.750,47.232,14.782', 'Red Bull Ring',                      'Boxenstraße',    4318, 0.5, 'horaire', 0.6),
    ('zandvoort',   '52.378,4.525,52.402,4.560',  'Grand Prix Formule 1 van Nederland',  'Pitstraat',      4259, 0.5, 'horaire', 245.0),
]
DEPART_SANS_RELATION = {'laguna': 'The Corkscrew'}

# LES CARTES, FAUTE DE RELEVÉ. Le Circuit de la Sarthe emprunte la D338 sur les six kilomètres des
# Hunaudières, une route qui n'est ni balisée circuit ni nommée dans OpenStreetMap ; seul le Circuit
# Bugatti, qui tient dans l'enceinte, y a une relation. Le Mans vient donc d'un fond de carte
# vectoriel, avec ce que cela coûte : une carte est un schéma, et ses rayons valent ce qu'ils valent.
#
# `depart` est en coordonnées du SVG, et pointe la ligne de départ. On ne l'a pas devinée : la voie
# des stands est dessinée dans le fichier, parallèle à la piste et à quinze pixels d'elle, et c'est
# elle qui dit où sont les stands. La règle par défaut — le point le plus long de la plus longue
# ligne droite — aurait posé la grille au milieu des Hunaudières.
TABLE_SVG = [
    ('lemans',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Circuit_de_la_Sarthe_track_map.svg',
     '959.7,190.4', 13626, 'Track map for the Circuit de la Sarthe, de Will Pittenger, CC BY-SA 3.0', 0),
]

ENTETE = '''/* Eyes On Line — la GÉOMÉTRIE des circuits, et elle seule.
 *
 * CE FICHIER N'EST PAS SOUS LA MÊME LICENCE QUE LE RESTE DU JEU.
 *
 * Les suites de points qu'il contient sont relevées dans OpenStreetMap, sous licence ODbL. Le
 * partage à l'identique de cette licence porte sur la base dérivée — c'est-à-dire sur ces
 * coordonnées — et non sur ce qui les entoure : le moteur, la physique, l'interface et le reste du
 * jeu en sont une « œuvre produite », qui doit la citation et rien de plus.
 *
 * © les contributeurs d'OpenStreetMap. Qui a relevé quoi, et ce que la licence exige : `LICENCES.md`.
 *
 * C'est pour que cette frontière soit LISIBLE que la géométrie vit dans un fichier à elle. Mêlée
 * aux largeurs, aux thèmes et aux réglages de `js/tracks.js`, personne n'aurait pu dire où elle
 * s'arrête — et une obligation qu'on ne sait pas délimiter finit par être soit ignorée, soit
 * étendue à tort.
 *
 * NE PAS MODIFIER À LA MAIN. `tools/traces.py` refabrique ce fichier, et porte la table qui dit où
 * chaque circuit a été relevé. Un relevé se vérifie seul : la boucle doit se refermer, et sa
 * longueur tomber sur la longueur officielle du circuit. L'écart est noté sous chaque circuit.
 *
 * TROIS DÉCIMALES, ET NON UNE. `js/track.js` fait passer une spline PAR ces points : un point posé
 * un demi-mètre de travers fait tourner la route, et la courbure qu'en tire le moteur vaut environ
 * 2e/h² — e l'erreur sur le point, h l'écart entre deux points. À une décimale et six cents points,
 * ce bruit valait 20 pour mille là où la plus douce courbe d'un circuit en vaut 2 : les lignes
 * droites serpentaient et la ligne de freinage zigzaguait. Rapprocher les points sans gagner en
 * précision empire le résultat, et au carré.
 *
 * Les coordonnées sont sans unité : `js/track.js` met la boucle à l'échelle de la longueur déclarée
 * dans `js/tracks.js`. Un circuit du jeu reste plus court que le vrai ; c'est sa FORME qui est juste,
 * pas sa taille.
 */
'use strict';

const TRACES = {
'''


def releve(ligne, cache, points, dec):
    cid, bbox, rel, sauf, officielle, jointure, sens, rot = ligne
    cmd = [sys.executable, OUTIL, f'--bbox={bbox}', f'--longueur={officielle}',
           f'--points={points}', f'--decimales={dec}', f'--jointure={jointure}', f'--sens={sens}',
           f'--rotation={rot}', f'--cache={os.path.join(cache, "osm_" + cid + ".xml")}']
    if rel:
        cmd.append(f'--relation={rel}')
    else:
        cmd.append(f'--depart={DEPART_SANS_RELATION[cid]}')
    if sauf:
        cmd.append(f'--sauf={sauf}')
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout[-2000:], r.stderr[-2000:])
        raise SystemExit(f'  {cid} : le relevé a échoué')
    sortie = r.stdout.splitlines()
    pts = [l for l in sortie if l.startswith('      [')]
    mesure = next(l for l in sortie if 'longueur relevee' in l).strip()
    voies = next(l for l in sortie if 'boucle(s) fermee(s)' in l).strip()
    if any('ATTENTION' in l for l in sortie):
        raise SystemExit(f'  {cid} : {mesure} — écart trop grand, ce n’est pas le bon tour')
    return pts, mesure, voies


def carte(ligne, cache, points, dec):
    cid, url, depart, officielle, credit, rot = ligne
    fichier = os.path.join(cache, f'carte_{cid}.svg')
    if not os.path.exists(fichier):
        r = urllib.request.Request(url, headers={'User-Agent': 'EyesOnLine/0.2 (trace de circuit)'})
        with urllib.request.urlopen(r, timeout=120) as f:
            open(fichier, 'wb').write(f.read())
    cmd = [sys.executable, TRACEUR, fichier, f'--points={points}', f'--decimales={dec}',
           f'--depart={depart}', f'--rotation={rot}']
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout[-2000:], r.stderr[-2000:])
        raise SystemExit(f'  {cid} : le tracé a échoué')
    sortie = r.stdout.splitlines()
    pts = [l for l in sortie if l.startswith('      [')]
    if not pts:
        raise SystemExit(f'  {cid} : aucun point produit')
    return pts, credit


def main():
    o = {a.split('=')[0][2:]: (a.split('=', 1)[1] if '=' in a else '1')
         for a in sys.argv[1:] if a.startswith('--')}
    choisis = [a for a in sys.argv[1:] if not a.startswith('--')]
    cache = o.get('cache', '/tmp')
    points, dec = int(o.get('points', 600)), int(o.get('decimales', 3))
    corps = []
    for ligne in TABLE:
        if choisis and ligne[0] not in choisis:
            continue
        print(f'  {ligne[0]}… ({ligne[6]})', flush=True)
        pts, mesure, voies = releve(ligne, cache, points, dec)
        print(f'    {mesure}')
        corps.append(f'  /* {ligne[2] or "relevé par l’étiquette highway=raceway"}.\n'
                     f'     {mesure.replace("longueur relevee", "longueur relevée")}.\n'
                     f'     {points} points · sens {ligne[6]} · posé à {ligne[7]}° · départ sur la ligne droite des stands. */\n'
                     f'  {ligne[0]}: [\n' + '\n'.join(pts) + '\n  ],\n')
    for ligne in TABLE_SVG:
        if choisis and ligne[0] not in choisis:
            continue
        print(f'  {ligne[0]}… (carte vectorielle, faute de relevé)', flush=True)
        pts, credit = carte(ligne, cache, points, dec)
        print(f'    {len(pts) * max(1, 6 - dec)} points · {credit}')
        corps.append(f'  /* {credit}.\n'
                     f'     Un schéma, pas un relevé : la forme est juste, les rayons approximatifs.\n'
                     f'     {points} points · posé à {ligne[5]}° · départ sur la ligne des stands, lue dans la carte. */\n'
                     f'  {ligne[0]}: [\n' + '\n'.join(pts) + '\n  ],\n')
    if choisis:
        print('\n  (relevé partiel : js/traces.js n’est pas réécrit)')
        return 0
    with open(os.path.join(RACINE, 'js', 'traces.js'), 'w', encoding='utf-8') as f:
        f.write(ENTETE + '\n'.join(corps) + '};\n\n'
                "if (typeof module !== 'undefined') module.exports = { TRACES };\n")
    print(f'\n  js/traces.js réécrit : {len(corps)} circuits')
    return 0


if __name__ == '__main__':
    sys.exit(main())
