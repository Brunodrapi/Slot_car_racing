#!/usr/bin/env python3
"""Les icônes du jeu, tirées de la face avant de la M1 Procar.

    python3 tools/icones.py

Entrée : `art-src/icone-m1-flat.png`, l'icône dessinée par Bruno (octobre 2026) : la M1 en aplats,
sans logo ni inscription, sur une tuile sombre aux coins arrondis, elle-même sur fond noir.
Sorties : `favicon.ico`, `art/icone-{16,32,48,180,192,512}.png`, `art/icone-maskable-512.png`.

POURQUOI UN SCRIPT ET PAS SEPT FICHIERS POSÉS À LA MAIN. Les sorties doivent rester d'accord entre
elles et avec l'illustration ; dès qu'on la retouche, les refaire à la main en oublie une, et c'est
toujours la même — le `.ico`, que personne ne regarde.

DEUX CADRAGES, PARCE QU'UNE ICÔNE N'EST PAS LUE À LA MÊME TAILLE PARTOUT. Les grandes icônes —
l'écran d'accueil d'un téléphone (180 et 192 px) et le manifeste (512) — prennent la tuile entière,
sans la marge noire qui l'entoure : iOS et Android arrondissent eux-mêmes les coins, et une tuile
déjà arrondie au milieu d'un carré noir y ferait un cadre dans le cadre. Réduite à seize pixels
pour un onglet, la tuile ne laisse qu'une tache blanche ; les icônes d'onglet (16, 32, 48 et le
`.ico`) prennent donc un recadrage serré sur ce qui survit à la réduction : le « 42 », le phare
orange et l'aile bleue. Comparé sur une planche aux tailles réelles contre la tuile entière, un
cadrage plus serré, un plus large et la calandre : c'est celui qui reste une M1 à seize pixels.

AUCUN DÉTOURAGE. La voiture est coupée par les bords de la tuile et son fond sombre en fait partie :
toutes les sorties sont pleines, ce qui règle au passage ce qu'il fallait traiter à part pour iOS,
qui compose mal la transparence.

L'ICÔNE « MASKABLE » d'Android ne garde que le disque central de 80 % : la tuile y est posée pleine
page, le « 42 » et le phare tombent dedans, et ce qui tombe hors du masque n'est que du fond.
"""
import os
from PIL import Image

RACINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SOURCE = os.path.join(RACINE, 'art-src', 'icone-m1-flat.png')
# Les cadrages, en proportion du côté de l'image (gauche, haut, droite, bas). La tuile arrondie,
# mesurée sur l'image de 1254 px : de 43 à 1210 en x, de 42 à 1209 en y.
TUILE = (43 / 1254, 42 / 1254, 1210 / 1254, 1209 / 1254)
# Les icônes d'onglet : le « 42 », le phare et l'aile bleue.
ONGLET = (420 / 1254, 330 / 1254, 1170 / 1254, 1080 / 1254)


def carre(img, boite):
    w, h = img.size
    x0, y0, x1, y1 = (round(boite[0] * w), round(boite[1] * h), round(boite[2] * w), round(boite[3] * h))
    cote = min(x1 - x0, y1 - y0)
    return img.crop((x0, y0, x0 + cote, y0 + cote))


def main():
    src = Image.open(SOURCE).convert('RGB')
    entiere = carre(src, TUILE)
    onglet = carre(src, ONGLET)
    art = os.path.join(RACINE, 'art')
    for taille in (512, 192, 180):
        entiere.resize((taille, taille), Image.LANCZOS).save(os.path.join(art, 'icone-%d.png' % taille), optimize=True)
    entiere.resize((512, 512), Image.LANCZOS).save(os.path.join(art, 'icone-maskable-512.png'), optimize=True)
    # Les navigateurs modernes préfèrent un PNG à un `.ico`, et plusieurs se montrent capricieux avec
    # un `.ico` qui annonce trois tailles dans un seul `sizes` : on leur donne le choix, taille par
    # taille, et le `.ico` reste pour ceux qui ne demandent que lui.
    for taille in (48, 32, 16):
        onglet.resize((taille, taille), Image.LANCZOS).save(os.path.join(art, 'icone-%d.png' % taille), optimize=True)
    onglet.resize((256, 256), Image.LANCZOS).save(os.path.join(RACINE, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
    print('écrit : favicon.ico, art/icone-{16,32,48,180,192,512}.png, art/icone-maskable-512.png')


if __name__ == '__main__':
    main()
