#!/usr/bin/env python3
"""Où boucler dans une prise stationnaire, sans toucher au fichier.

    python3 tools/boucles.py sounds/six-inline/*.wav

Le moteur porté de markeasting/engine-audio joue des boucles, pas des montées. Rien n'est réencodé,
et c'est le point : `AudioBufferSourceNode` accepte `loopStart` et `loopEnd`, donc il suffit de
trouver les deux instants et de les ranger dans la configuration. Les prises restent exactement ce
qu'elles sont.

Comment on choisit. Le début se pose après l'attaque, sur un passage par zéro montant. La fin est
celle dont les trente millisecondes qui la précèdent ressemblent le plus à celles qui précèdent le
début — une corrélation normalisée, donc insensible au niveau. C'est cette ressemblance qui garde
la hauteur stable d'un tour à l'autre.

ET LA MESURE DU RACCORD, QUI M'A EU DEUX FOIS.

Premier essai : l'écart quadratique sur trente millisecondes, rapporté au niveau de la prise. Il
condamnait les six fichiers, de -1,7 à -13 dB. Il mesurait surtout le BRUIT — souffle, route,
cylindres déphasés — qui ne coïncide jamais d'un tour à l'autre et ne s'entend pas pour autant.

Deuxième essai : la marche entre les deux échantillons du raccord, rapportée au RMS. Elle valait
0,8 à 1,4 sur `on-2500`, ce qui paraissait énorme. Mais le RMS est un niveau MOYEN, pas une vitesse :
il ne dit rien de ce qu'une forme d'onde a le droit de faire entre deux échantillons.

Ce qu'on mesure ici est la marche au raccord rapportée à la PLUS GRANDE PENTE que la prise contient
déjà. Au-dessus de 1, le raccord fait faire au signal quelque chose qu'il ne fait jamais tout seul :
c'est un clic. En dessous, il se perd dans ce que la prise fait de toute façon.
"""
import sys, json, wave
import numpy as np


def lire(path):
    w = wave.open(path)
    n, sr, ch = w.getnframes(), w.getframerate(), w.getnchannels()
    d = np.frombuffer(w.readframes(n), dtype='<i2').astype(np.float64) / 32768.0
    if ch > 1:
        d = d.reshape(-1, ch).mean(axis=1)
    return d, sr


def boucle(x, sr, lmin=0.5, lmax=2.2, attaque=0.4):
    W = int(sr * 0.030)
    s = int(sr * attaque)
    while s + 1 < len(x) and not (x[s] <= 0 < x[s + 1]):
        s += 1
    ref = x[s - W:s]
    nref = np.linalg.norm(ref) + 1e-12
    bc, be = -2.0, s + int(sr * lmin)
    for e in range(s + int(sr * lmin), min(len(x) - 1, s + int(sr * lmax))):
        seg = x[e - W:e]
        c = float(np.dot(seg, ref) / (np.linalg.norm(seg) * nref + 1e-12))
        if c > bc:
            bc, be = c, e
    marche = abs(x[be] - x[s])
    pente_max = float(np.max(np.abs(np.diff(x[s:be]))))
    return s, be, bc, marche / (pente_max + 1e-12)


def main(paths):
    out, pires = {}, 0.0
    for p in paths:
        x, sr = lire(p)
        s, e, c, rel = boucle(x, sr)
        pires = max(pires, rel)
        out[p.split('/')[-1]] = {'loopStart': round(s / sr, 4), 'loopEnd': round(e / sr, 4),
                                 'correlation': round(c, 3), 'raccord': round(rel, 2)}
        verdict = 'ok' if rel <= 1 else 'CLIC'
        print(f'{p.split("/")[-1]:42} boucle {s/sr:5.2f} → {e/sr:5.2f} s ({(e-s)/sr:4.2f} s)  '
              f'périodicité {c:.2f}  raccord {rel:4.2f} × la pente naturelle  {verdict}')
    print()
    print(json.dumps(out, indent=2))
    return 1 if pires > 1 else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
