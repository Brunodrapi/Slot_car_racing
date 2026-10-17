#!/usr/bin/env python3
"""Les icônes du jeu, tirées de la face avant de la M1 Procar.

    python3 tools/icones.py

Entrée : `art-src/m1-procar-face.png`, l'illustration carrée sur fond noir.
Sorties : `favicon.ico`, `art/icone-{16,32,48,180,192,512}.png`, `art/icone-maskable-512.png`.

POURQUOI UN SCRIPT ET PAS SEPT FICHIERS POSÉS À LA MAIN. Les sorties doivent rester d'accord entre
elles et avec l'illustration ; dès qu'on la retouche, les refaire à la main en oublie une, et c'est
toujours la même — le `.ico`, que personne ne regarde.

DEUX CADRAGES, PARCE QU'UNE ICÔNE N'EST PAS LUE À LA MÊME TAILLE PARTOUT. L'illustration entière
— calandre, cocarde, bandeau « Bavarian Motor Works », phare — sert aux grandes icônes : l'écran
d'accueil d'un téléphone (180 et 192 px) et le manifeste (512). Réduite à seize pixels pour un
onglet, elle ne laisse qu'une tache blanche striée de noir. Les icônes d'onglet (16, 32, 48 et le
`.ico`) prennent donc un recadrage serré sur ce qui survit à la réduction : la diagonale bleue sur
le blanc, le phare orange et le « 42 ». Comparé sur une planche aux tailles réelles contre l'image
entière, la calandre seule et un cadrage plus serré encore sur le phare : c'est celui qui reste une
M1 Procar à seize pixels.

AUCUN DÉTOURAGE. L'ancien casque était détouré pour flotter sur l'onglet ; cette illustration est
coupée par les bords du cadre — la voiture sort à gauche et en bas —, son fond noir en fait partie.
Toutes les sorties sont donc pleines, ce qui règle au passage ce qu'il fallait traiter à part pour
iOS, qui compose mal la transparence.

L'ICÔNE « MASKABLE » d'Android ne garde que le disque central de 80 % : l'illustration y est posée
pleine page, et ce qui tombe hors du masque n'est que du bord de cadre.
"""
import os
from PIL import Image

RACINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SOURCE = os.path.join(RACINE, 'art-src', 'm1-procar-face.png')
# Le cadrage des icônes d'onglet, en proportion du côté de l'illustration : le « 42 », le phare
# et l'aile bleue (gauche, haut, droite, bas).
ONGLET = (0.335, 0.20, 1.0, 0.865)


def carre(img, boite):
    w, h = img.size
    x0, y0, x1, y1 = (round(boite[0] * w), round(boite[1] * h), round(boite[2] * w), round(boite[3] * h))
    cote = min(x1 - x0, y1 - y0)
    return img.crop((x0, y0, x0 + cote, y0 + cote))


def main():
    src = Image.open(SOURCE).convert('RGB')
    entiere = carre(src, (0, 0, 1, 1))
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
