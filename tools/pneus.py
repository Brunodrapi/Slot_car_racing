#!/usr/bin/env python3
"""Les pneus du mur, dessinés plutôt que découpés.

   La planche de sprites en contenait, mais vus de trois quarts et collés les uns aux autres :
   chaque découpe emportait un morceau noir de sa voisine, et à l'échelle du jeu la chaîne se
   lisait comme une suite de grumeaux. Vu de dessus, un pneu est un ANNEAU — c'est le seul objet
   du mobilier qui n'a aucune orientation, donc le seul qu'on peut se permettre de redessiner sans
   rien devoir à la planche : il n'y a pas de style à retrouver, juste un rond.

   La structure est relevée sur l'image de référence : une carcasse sombre presque noire, un
   anneau clair à mi-rayon — la jante qu'on voit par le trou — et un trou noir au milieu. Le
   diamètre extérieur y vaut une fois et demie la longueur d'un bloc de vibreur, et l'anneau clair
   en fait un peu plus de la moitié.

   Le soleil est en haut à droite, comme partout ailleurs dans ce décor : la carcasse s'éclaire de
   ce côté et l'ombre portée tombe en bas à gauche. Elle est CUITE dans le dessin, parce que la
   passe d'ombre du moteur ne sert que les objets hauts.
"""
import numpy as np
from PIL import Image

S = 72                      # le pneu fait 1,5 m à l'écran : 72 px laissent de la marge au zoom
LUM = np.array([0.707, -0.707])   # haut-droite


def couv(d, bord=0.8):
    """Couverture 0..1 d'une forme dont `d` est la distance signée en pixels (négatif = dedans)."""
    return np.clip(0.5 - d / bord, 0.0, 1.0)


def pose(dst, cov, rgb):
    a = cov[..., None]
    dst[..., :3] = dst[..., :3] * (1 - a) + np.asarray(rgb, float) * a
    dst[..., 3] = dst[..., 3] * (1 - cov) + cov


def melange(c0, c1, t):
    t = t[..., None]
    return np.asarray(c0, float) * (1 - t) + np.asarray(c1, float) * t


def pneu(seed):
    rnd = np.random.RandomState(seed)
    y, x = np.mgrid[0:S, 0:S].astype(float)
    cx = cy = (S - 1) / 2.0

    # chaque pneu est posé un peu de travers dans sa boîte : le mur n'est pas une règle
    ox, oy = rnd.uniform(-0.018, 0.018, 2) * S
    rx, ry = x - cx - ox, y - cy - oy

    # La carcasse occupe presque toute la boîte : posés à 1,25 m l'un de l'autre, les pneus
    # doivent se RECOUVRIR, et c'est la bande sombre continue qu'on lit de loin, pas le rond.
    r_ext = S * rnd.uniform(0.455, 0.482)
    r_anneau = S * 0.195 * rnd.uniform(0.95, 1.06)
    e_anneau = S * 0.055
    r_trou = r_anneau - e_anneau / 2

    d = np.hypot(rx, ry)
    img = np.zeros((S, S, 4))

    # l'ombre portée, en bas à gauche, cuite dans le dessin
    sx, sy = rx + S * 0.055, ry - S * 0.050
    cov = couv(np.hypot(sx, sy) - r_ext * 1.02, bord=S * 0.10) * 0.30
    pose(img, cov, (18, 26, 18))

    # la carcasse : un dégradé dans l'axe du soleil, plus un liseré sombre au bord
    t = np.clip(0.5 + (rx * LUM[0] + ry * LUM[1]) / (2 * r_ext), 0, 1)
    corps = melange((11, 22, 29), (49, 68, 78), t ** 0.85)
    bordure = np.clip((d - r_ext * 0.80) / (r_ext * 0.20), 0, 1)
    corps = melange(corps.transpose(2, 0, 1).transpose(1, 2, 0), (8, 15, 20), bordure * 0.55)
    pose(img, couv(d - r_ext), corps)

    # l'anneau clair : la jante qu'on aperçoit par le trou, éclairée du même côté
    bague = melange((104, 117, 124), (214, 221, 223), t ** 0.7)
    cov = couv(np.abs(d - r_anneau) - e_anneau / 2)
    pose(img, cov, bague)

    # le trou, presque noir, avec un reste de lumière rasante sur sa paroi haute
    dedans = couv(d - r_trou)
    trou = melange((7, 13, 17), (20, 30, 37), np.clip(t * 1.3 - 0.45, 0, 1))
    pose(img, dedans, trou)

    out = np.zeros((S, S, 4), np.uint8)
    out[..., :3] = np.clip(img[..., :3] + 0.5, 0, 255).astype(np.uint8)
    out[..., 3] = np.clip(img[..., 3] * 255 + 0.5, 0, 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


if __name__ == '__main__':
    for i in range(4):
        f = 'art/decor/pneu-%d.webp' % (i + 1)
        pneu(1700 + i * 37).save(f, 'WEBP', lossless=True, quality=100)
        print(f)
