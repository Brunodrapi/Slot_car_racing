#!/usr/bin/env python3
"""Ramene une illustration deja detouree a la taille que le jeu affiche.

    python3 tools/calibre.py <fichier.png...> [--largeur=420] [--sans-source]

`topcar.py` et `pickcar.py` font tout le travail depuis un rendu brut : retirer le fond, redresser,
rogner, reduire. Quand l illustration arrive DEJA detouree — alpha propre, cadrage voulu par le
dessinateur — il ne reste que la derniere etape, et refaire les autres ne pourrait que l abimer :
un remplissage de fond sur une image transparente n a rien a mordre, et redresser une vue en trois
quarts la couche de travers.

Ce qui reste a faire n est pas cosmetique. Les illustrations du jeu tiennent entre 158 et 343 ko
pour 420 px de large ; un rendu brut en fait 1700 a 2100 ko pour 1627 a 1699 px. Les cartes du menu
en affichent 420. Posees telles quelles, cinq images pesent neuf megaoctets que le telephone
telecharge pour les reduire a l affichage — et c est l ecran de selection, puis la grille de depart,
qui attendent.

L original est deplace a cote, dans `<dossier>-src`, parce qu une reduction ne se remonte pas.
"""
import os
import shutil
import sys

from PIL import Image


def calibre(chemin, largeur, garder_source):
    im = Image.open(chemin).convert('RGBA')
    avant = im.size
    poids_avant = os.path.getsize(chemin)

    # Rogner sur l alpha d abord : un rendu brut porte souvent une marge vide, et reduire avec la
    # marge donnerait une voiture plus petite que les autres a largeur egale.
    bb = im.getbbox()
    if bb:
        im = im.crop(bb)

    if im.size[0] <= largeur:
        print(f'  {chemin:34} {avant[0]}x{avant[1]} · deja a sa taille, rien a faire')
        return False

    if garder_source:
        dossier, nom = os.path.split(chemin)
        src = dossier + '-src'
        os.makedirs(src, exist_ok=True)
        cible = os.path.join(src, nom)
        if not os.path.exists(cible):
            shutil.copy2(chemin, cible)
        elif os.path.getsize(cible) != os.path.getsize(chemin):
            # On n ecrase jamais une source en place, et on ne se tait pas non plus : un rendu
            # remplace par un autre laisserait sinon, a cote de la nouvelle illustration, l ancienne
            # source — avec le bon nom, donc impossible a distinguer de la bonne.
            print(f'  ATTENTION {cible} existe deja et differe : la source precedente est gardee,'
                  f' celle-ci ne sera plus que dans git.')

    h = max(1, round(im.size[1] * largeur / im.size[0]))
    im = im.resize((largeur, h), Image.LANCZOS)
    im.save(chemin, optimize=True)
    poids = os.path.getsize(chemin)
    print(f'  {chemin:34} {avant[0]}x{avant[1]} {poids_avant // 1024:5} ko'
          f'  →  {largeur}x{h} {poids // 1024:4} ko'
          f'   ({poids_avant / max(1, poids):.1f} fois plus leger)')
    return True


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    opts = {a.split('=')[0][2:]: (a.split('=')[1] if '=' in a else '1') for a in sys.argv[1:] if a.startswith('--')}
    if not args:
        print(__doc__)
        return 1
    largeur = int(opts.get('largeur', 420))
    garder = 'sans-source' not in opts
    print(f'\n  largeur cible {largeur} px · original garde dans <dossier>-src : {"oui" if garder else "non"}\n')
    faits = sum(1 for f in args if calibre(f, largeur, garder))
    print(f'\n  {faits} image(s) ramenee(s) a {largeur} px sur {len(args)}\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())
