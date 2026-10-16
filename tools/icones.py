#!/usr/bin/env python3
"""Les icônes du jeu, dérivées du casque dessiné par Bruno.

    python3 tools/icones.py

Entrée : `art-src/casque.png`, le dessin pleine résolution sur fond noir.
Sorties : `favicon.ico`, `art/casque-{16,32,48,180,192,512}.png`,
          `art/casque-maskable-512.png`.

POURQUOI UN SCRIPT ET PAS CINQ FICHIERS POSÉS À LA MAIN. Les cinq sorties doivent rester d'accord
entre elles et avec le dessin ; dès qu'on retouche le casque, les refaire à la main en oublie une,
et c'est toujours la même — le `.ico`, que personne ne regarde.

DÉTOURER LE FOND NOIR N'EST PAS « RENDRE LE NOIR TRANSPARENT ». Le casque EST noir par endroits :
les oreillettes, le verre des lunettes, tous les contours. Et une simple propagation depuis le bord
ne marche pas non plus : les contours noirs touchent l'extérieur — la sangle des lunettes va jusqu'au
bord de la silhouette — donc le fond s'infiltre par eux et vide le casque de l'intérieur. Essayé,
mesuré : il ne restait que 6,4 % de noir, et la vérification à l'œil sur fond bleu passait, parce
que le contour crème des oreillettes restait et faisait illusion. C'est la silhouette elle-même
qu'il faut regarder pour voir la bêtise.

On passe donc par une FERMETURE MORPHOLOGIQUE de la couleur : on épaissit de quatre pixels tout ce
qui n'est pas noir, ce qui ponte les contours et soude le casque en un seul bloc ; on bouche les
trous ; on redescend de quatre pixels. Quatre suffit — testé aussi à 8, 14 et 20, qui donnent la
même silhouette en plus arrondie au creux entre les oreillettes.

LE SOUS-ÉCHANTILLONNAGE EST PRÉMULTIPLIÉ. Réduire une image RGBA sans prémultiplier mélange la
couleur des pixels transparents, qui est ici du noir : le bord ressortirait cerné de sombre sur un
onglet clair, c'est-à-dire exactement ce qu'on cherche à enlever.

DEUX SORTIES GARDENT UN FOND PLEIN, et ce n'est pas une inattention. L'icône iOS, parce que iOS
compose mal la transparence et finit par poser du noir. L'icône « maskable » d'Android, parce que le
système y applique un masque qui ne garde que les 80 % centraux : elle doit remplir son carré, et le
casque y est reposé à 72 % pour que le masque ne lui coupe pas les oreillettes.
"""
import os
import numpy as np
from PIL import Image, ImageFilter

RACINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SOURCE = os.path.join(RACINE, 'art-src', 'casque.png')
FOND_PLEIN = (15, 17, 23)        # #0f1117, le fond du jeu et le `theme-color` des pages
NOIR = 10                        # au-dessus, le pixel porte de la couleur
RAYON = 4                        # la fermeture qui ponte les contours
AIR = 0.07                       # la marge autour du casque, en part de son côté


def _m2i(m):
    return Image.fromarray(np.where(m, 255, 0).astype(np.uint8), 'L')


def _i2m(i):
    return np.asarray(i) > 127


def dilate(m, r):
    return _i2m(_m2i(m).filter(ImageFilter.MaxFilter(2 * r + 1)))


def erode(m, r):
    return _i2m(_m2i(m).filter(ImageFilter.MinFilter(2 * r + 1)))


def boucher_les_trous(m):
    """m, plus tout ce qui, hors de m, ne communique pas avec le bord de l'image."""
    libre = ~m
    f = np.zeros_like(libre)
    f[0, :] |= libre[0, :]
    f[-1, :] |= libre[-1, :]
    f[:, 0] |= libre[:, 0]
    f[:, -1] |= libre[:, -1]
    while True:
        d = f.copy()
        d[1:, :] |= f[:-1, :]
        d[:-1, :] |= f[1:, :]
        d[:, 1:] |= f[:, :-1]
        d[:, :-1] |= f[:, 1:]
        d &= libre
        if d.sum() == f.sum():
            return ~f
        f = d


def silhouette(rgb):
    couleur = np.asarray(rgb).astype(np.int16).max(axis=2) > NOIR
    return erode(boucher_les_trous(dilate(couleur, RAYON)), RAYON)


def reduire(rgba, cote):
    """Réduction prémultipliée : la couleur des pixels transparents ne doit pas déteindre."""
    a = np.asarray(rgba).astype(np.float32)
    pm = a.copy()
    pm[:, :, :3] *= (a[:, :, 3:4] / 255.0)
    petit = np.asarray(Image.fromarray(pm.astype(np.uint8), 'RGBA')
                       .resize((cote, cote), Image.LANCZOS)).astype(np.float32)
    al = np.clip(petit[:, :, 3:4], 1e-6, 255.0)
    petit[:, :, :3] = np.clip(petit[:, :, :3] * 255.0 / al, 0, 255)
    petit[:, :, 3] = np.clip(petit[:, :, 3], 0, 255)
    return Image.fromarray(petit.astype(np.uint8), 'RGBA')


def sur_fond(img, couleur):
    f = Image.new('RGB', img.size, couleur)
    f.paste(img, (0, 0), img)
    return f


def main():
    src = Image.open(SOURCE).convert('RGB')
    sil = silhouette(src)
    ys, xs = np.where(sil)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    cote = int(max(x1 - x0, y1 - y0) * (1 + 2 * AIR))
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    print('silhouette %d×%d, carré de %d px' % (x1 - x0, y1 - y0, cote))

    plein = np.dstack([np.asarray(src), np.where(sil, 255, 0).astype(np.uint8)])
    grand = Image.new('RGBA', (cote, cote), (0, 0, 0, 0))
    grand.paste(Image.fromarray(plein, 'RGBA'), (cote // 2 - cx, cote // 2 - cy))

    # 512 et 192 pour le manifeste ; 48, 32 et 16 pour les onglets. Les navigateurs modernes
    # préfèrent un PNG à un `.ico`, et plusieurs se montrent capricieux avec un `.ico` qui annonce
    # trois tailles dans un seul `sizes` : on leur donne donc le choix explicite, taille par taille.
    for taille in (512, 192, 48, 32, 16):
        reduire(grand, taille).save(os.path.join(RACINE, 'art', 'casque-%d.png' % taille), optimize=True)
    # iOS compose mal la transparence : son icône garde un fond plein
    sur_fond(reduire(grand, 180), FOND_PLEIN).save(os.path.join(RACINE, 'art', 'casque-180.png'), optimize=True)
    # « maskable » : le casque à 72 % dans son carré, pour survivre au masque d'Android
    Z, dedans = 512, int(512 * 0.72)
    masque = Image.new('RGB', (Z, Z), FOND_PLEIN)
    petit = reduire(grand, dedans)
    masque.paste(petit, ((Z - dedans) // 2, (Z - dedans) // 2), petit)
    masque.save(os.path.join(RACINE, 'art', 'casque-maskable-512.png'), optimize=True)
    # le .ico porte les trois tailles que les navigateurs demandent, avec la transparence
    reduire(grand, 256).save(os.path.join(RACINE, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
    print('écrit : favicon.ico, art/casque-{16,32,48,180,192,512}.png, art/casque-maskable-512.png')


if __name__ == '__main__':
    main()
