"""La planche des stands : une page par circuit (le plan avec la voie des stands en rouge, toute la voie
dans le jeu, puis la zone d'arrêt et les garages de près), d'après les photos de tests/stands_photos.

    xvfb-run -a -s "-screen 0 1700x1000x24" godot --path godot --resolution 1600x900 tests/stands_photos.tscn -- <dossier>
    python3 godot/outils/stands-planche.py <dossier>          # écrit <dossier>/stands-circuits.pdf
"""
import json, math, sys, os
from PIL import Image, ImageDraw, ImageFont
D = sys.argv[1] if len(sys.argv) > 1 else 'tous'
infos = json.load(open(f'{D}/stands.json'))
# l'ordre des circuits du jeu (le catalogue), pas l'ordre alphabétique du fichier
ORDRE = ['monza', 'spa', 'monaco', 'silverstone', 'suzuka', 'interlagos', 'laguna', 'nurburgring', 'lemans', 'bathurst', 'redbullring', 'castellet', 'zandvoort', 'watkins']
infos = {k: infos[k] for k in ORDRE if k in infos}
POL = os.path.join(os.path.dirname(__file__), '..', 'polices', 'BarlowCondensed-BlackItalic.ttf')
F = lambda n: ImageFont.truetype(POL, n)
W, H = 1754, 1240
pages = []
for cid, I in infos.items():
    pg = Image.new('RGB', (W, H), '#f3e6cb')
    d = ImageDraw.Draw(pg)
    d.rectangle((0, 0, W, 96), fill='#151917')
    d.text((40, 14), I['nom'].upper(), font=F(58), fill='#fff1d5')
    d.text((W - 40, 30), cid, font=F(34), fill='#c8baa0', anchor='ra')
    if not I.get('stands'):
        d.text((40, 140), 'Pas de voie des stands sur ce circuit.', font=F(40), fill='#262b26')
        pages.append(pg); continue
    L = I['longueur']
    lignes = [f"Voie des stands : {round(I['long'])} m  ·  tour : {round(L)} m",
              f"Entrée à {round(I['entree'])} m  ·  arrêt à {round(I['boite'])} m ({I['boite'] / L * 100:.1f} % du tour)  ·  sortie à {round(I['sortie'])} m",
              f"Zone d'arrêt : ±{round(I['zone'])} m  ·  garages : {I['garages']}"]
    for i, t in enumerate(lignes): d.text((40, 116 + i * 36), t, font=F(28), fill='#262b26')
    # le plan : la piste, la voie des stands en rouge, le départ, l'arrêt
    tr = I['trace']; xs = [p[0] for p in tr]; ys = [p[1] for p in tr]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    box = (40, 250, 640, 1040)
    k = min((box[2] - box[0] - 40) / (x1 - x0), (box[3] - box[1] - 40) / (y1 - y0))
    ox = box[0] + (box[2] - box[0] - (x1 - x0) * k) / 2; oy = box[1] + (box[3] - box[1] - (y1 - y0) * k) / 2
    P = lambda p: (ox + (p[0] - x0) * k, oy + (p[1] - y0) * k)
    d.rectangle(box, fill='#fff0d2', outline='#20251f', width=3)
    d.line([P(p) for p in tr] + [P(tr[0])], fill='#6b6f73', width=8, joint='curve')
    d.line([P(p) for p in I['voie']], fill='#d22620', width=14, joint='curve')
    sx, sy = P(I['depart']); a = I['cap']
    # le départ : un trait en travers, et la flèche du sens de la course
    nx, ny = -math.sin(a), math.cos(a)
    d.line([(sx - nx * 14, sy - ny * 14), (sx + nx * 14, sy + ny * 14)], fill='#ffffff', width=5)
    ax, ay = sx + math.cos(a) * 34, sy + math.sin(a) * 34
    d.line([(sx, sy), (ax, ay)], fill='#151917', width=3)
    d.polygon([(ax + math.cos(a) * 10, ay + math.sin(a) * 10), (ax + nx * 7, ay + ny * 7), (ax - nx * 7, ay - ny * 7)], fill='#151917')
    bx, by = P(I['arret'])
    d.ellipse((bx - 9, by - 9, bx + 9, by + 9), fill='#ffd400', outline='#151917', width=2)
    # la légende
    ly = 1060
    d.line([(52, ly + 14), (100, ly + 14)], fill='#d22620', width=8); d.text((112, ly), 'voie des stands', font=F(26), fill='#262b26')
    d.ellipse((60, ly + 44, 80, ly + 64), fill='#ffd400', outline='#151917', width=2); d.text((112, ly + 38), "zone d'arrêt", font=F(26), fill='#262b26')
    d.line([(62, ly + 92), (62, ly + 112)], fill='#ffffff', width=5); d.line([(62, ly + 102), (96, ly + 102)], fill='#151917', width=3)
    d.text((112, ly + 84), 'départ et sens de la course', font=F(26), fill='#262b26')
    # les photos du jeu
    for j, (nom, titre) in enumerate([('voie', "Toute la voie (la course va de gauche à droite)"), ('garages', "La zone d'arrêt et les garages, de près")]):
        im = Image.open(f'{D}/{cid}-{nom}.png').convert('RGB').resize((1000, 562), Image.LANCZOS)
        y = 250 + j * 494
        d.text((690, y - 6), titre, font=F(24), fill='#262b26')
        pg.paste(im.crop((0, 56, 1000, 506)), (690, y + 26))
        d.rectangle((690, y + 26, 1690, y + 476), outline='#20251f', width=3)
    pages.append(pg)
pages[0].save(os.path.join(D, 'stands-circuits.pdf'), save_all=True, append_images=pages[1:], resolution=150)
print(len(pages), 'pages')
