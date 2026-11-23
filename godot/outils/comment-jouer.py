"""Les animations de « Comment jouer » du jeu web (art/interface/comment-jouer, des WebP animés à
12 images par seconde) pour Godot, qui ne lit pas les WebP animés : chaque image en WebP, toutes
à la suite dans un .bin, et leurs tailles et leurs durées dans un .json à côté. Le jeu ne décode que
l'image affichée, comme le navigateur : 65 images décodées d'avance prendraient 34 Mo par animation.

    python3 godot/outils/comment-jouer.py
"""
import glob, io, json, os, struct
from PIL import Image

RACINE = os.path.join(os.path.dirname(__file__), '..', '..')
SOURCE = os.path.join(RACINE, 'art', 'interface', 'comment-jouer')
CIBLE = os.path.join(RACINE, 'godot', 'donnees', 'comment-jouer')


def durees(chemin):
    b = open(chemin, 'rb').read()
    i, d = 12, []
    while i < len(b):
        tag, n = b[i:i + 4], struct.unpack('<I', b[i + 4:i + 8])[0]
        if tag == b'ANMF':
            p = b[i + 8:i + 24]
            d.append(p[12] | (p[13] << 8) | (p[14] << 16))
        i += 8 + n + (n & 1)
    return d


os.makedirs(CIBLE, exist_ok=True)
for chemin in sorted(glob.glob(os.path.join(SOURCE, '*.webp'))):
    nom = os.path.splitext(os.path.basename(chemin))[0]
    im = Image.open(chemin)
    tailles, blob = [], b''
    for i in range(im.n_frames):
        im.seek(i)
        f = io.BytesIO()
        im.convert('RGB').save(f, 'WEBP', quality=82, method=6)
        tailles.append(len(f.getvalue()))
        blob += f.getvalue()
    open(os.path.join(CIBLE, nom + '.bin'), 'wb').write(blob)
    json.dump({'largeur': im.size[0], 'hauteur': im.size[1], 'tailles': tailles, 'durees': durees(chemin)},
              open(os.path.join(CIBLE, nom + '.json'), 'w'))
    print(nom, im.n_frames, 'images', len(blob) // 1024, 'Ko')
