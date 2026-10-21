#!/usr/bin/env python3
"""LE NOM SUR L'AFFICHE DU TITRE.

L'affiche peinte (`art/title.webp`) porte l'ancien nom du jeu, Eyes On Line, en grosses lettres sur
le haut du casque. Effacer ces lettres demanderait de repeindre le ciel, les arbres et la calotte du
casque dessous — le même piège que celui de « Appuie pour commencer » (README, « L'écran-titre »).
On ne réinvente donc rien : un bandeau de papier, déchiré, est collé sur le haut de l'affiche et
porte le logo, imprimé avec le grain du papier. Le papier prend la teinte des clairs de l'affiche,
ses bords brunissent comme les siens, et une ombre courte le détache du casque.

Le bas de l'affiche ne bouge pas : le calque « Appuie pour commencer », `art/press-start.png`, reste
posé exactement sur ses lettres.

    python3 tools/affiche-titre.py art/title.webp art/interface/logo-grip.webp art/title-grip.webp

À relancer si le logo change ; une affiche repeinte avec le bon nom rendrait ce script inutile.
"""
import sys, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
src, logo_path, out = sys.argv[1:4]
poster = Image.open(src).convert('RGB'); W, H = poster.size
logo = Image.open(logo_path).convert('RGBA')
P = np.array(poster).astype(float)
flat = P.reshape(-1, 3); lum = flat.mean(1); sat = flat.max(1) - flat.min(1)
papier = np.median(flat[(lum > 200) & (sat < 45)], 0)
hb = 560
rnd = random.Random(7)
y = hb; bord = []
for x in range(W + 12, -13, -10):
    y = max(hb - 30, min(hb + 30, y + rnd.uniform(-10, 10))); bord.append((x, y + rnd.uniform(-3, 3)))
m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon([(-5, -5), (W + 5, -5)] + bord, fill=255)
m = m.filter(ImageFilter.GaussianBlur(0.8))
# l'ombre portée du bandeau sur l'affiche
ombre = m.filter(ImageFilter.GaussianBlur(9)).point(lambda v: int(v * 0.5))
base = Image.composite(Image.new('RGB', (W, H), (10, 8, 6)), poster, ombre)
# le papier : teinte de l'affiche, grain, taches, bords brunis comme ceux de l'affiche
rng = np.random.default_rng(5)
grain = rng.normal(0, 7, (H, W, 1))
taches = Image.fromarray((rng.random((H // 16, W // 16)) * 255).astype('uint8')).resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(6))
taches = (np.array(taches).astype(float)[..., None] / 255 - 0.5) * 22
yy, xx = np.mgrid[0:H, 0:W]
dbord = np.minimum.reduce([xx, W - 1 - xx, yy]).astype(float)
brun = np.clip(1 - dbord / 38, 0, 1)[..., None] ** 1.6
coul = papier + grain + taches
coul = coul * (1 - 0.35 * brun) + np.array([120, 85, 40]) * 0.35 * brun
layer = Image.fromarray(np.clip(coul, 0, 255).astype('uint8'), 'RGB')
# le logo, imprimé : même grain que le papier par-dessus
lw = W - 70; l = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
lx, ly = (W - lw) // 2, (hb - l.height) // 2 - 4
layer.paste(l, (lx, ly), l)
L = np.array(layer).astype(float)
L = np.clip(L * (1 + grain / 255 * 1.2), 0, 255)
# usure : quelques éraflures claires, comme sur le reste de l'affiche
ecl = Image.new('L', (W, H), 0); d = ImageDraw.Draw(ecl)
for _ in range(70):
    x0, y0 = rnd.uniform(0, W), rnd.uniform(0, hb)
    d.line([(x0, y0), (x0 + rnd.uniform(-14, 14), y0 + rnd.uniform(-5, 5))], fill=rnd.randint(60, 150), width=rnd.choice([1, 1, 2]))
E = np.array(ecl).astype(float)[..., None] / 255
L = L * (1 - E * 0.6) + papier * E * 0.6
layer = Image.fromarray(np.clip(L, 0, 255).astype('uint8'), 'RGB')
base = Image.composite(layer, base, m)
# le liseré clair des fibres le long de la déchirure
rim = m.filter(ImageFilter.MaxFilter(5)); rim = Image.fromarray(np.clip(np.array(rim).astype(int) - np.array(m).astype(int), 0, 255).astype('uint8'))
base = Image.composite(Image.new('RGB', (W, H), (246, 238, 220)), base, rim.point(lambda v: int(v * 0.8)))
base.save(out, quality=90, method=6) if out.endswith('.webp') else base.save(out)
print(out, base.size)
