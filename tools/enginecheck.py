#!/usr/bin/env python3
"""Vérifie qu'un jeu de boucles est cohérent avec lui-même.

    python3 tools/enginecheck.py <préfixe> [--out=sounds/engine]

L'invariant : **entre deux boucles voisines, le rapport des étiquettes doit valoir le rapport des
hauteurs**. Une étiquette fausse par rapport à sa voisine est le pire défaut possible — la hauteur
saute au moment précis où le fondu passe de l'une à l'autre, et ça s'entend comme un dérapage.

De proche en proche, et non toutes contre une même référence, pour deux raisons. Le jeu ne fond
jamais qu'entre voisines : une boucle de bas régime et une de haut régime ne sonnent jamais
ensemble, leur accord n'intéresse personne. Et surtout la mesure elle-même ne vaut que pour de
petits écarts — le timbre d'un moteur change avec le régime, deux sons éloignés ne se ressemblent
plus, et les superposer ne veut plus rien dire. Comparer tout à une référence unique, c'est
mesurer de travers puis accuser les fichiers.

Le rapport de hauteur est mesuré par superposition des spectres sur un axe logarithmique, où une
dilatation du temps devient une translation. C'est la seule mesure de hauteur sur un moteur qui ne
se trompe pas d'octave, parce qu'elle ne cherche aucun fondamental : elle compare deux sons.

Cet outil est volontairement séparé de celui qui découpe, et n'en partage pas le chemin de
décision : il relit les fichiers écrits, sans rien savoir de la façon dont ils ont été choisis.
"""
import glob
import os
import re
import sys
import wave

import numpy as np


def load(f):
    w = wave.open(f)
    n, sr, ch = w.getnframes(), w.getframerate(), w.getnchannels()
    a = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float64) / 32768
    return (a.reshape(-1, ch).mean(axis=1) if ch > 1 else a), sr


def spectre_log(a, sr, f0=70, f1=4000, pts=1000):
    a = (a - a.mean()) * np.hanning(len(a))
    N = 1 << 16
    S = np.abs(np.fft.rfft(a, N))
    fr = np.fft.rfftfreq(N, 1 / sr)
    v = np.log(np.interp(np.geomspace(f0, f1, pts), fr, S) + 1e-9)
    v -= v.mean()
    return v / (np.linalg.norm(v) + 1e-12)


PAR_OCTAVE = 1000 / np.log2(4000 / 70)


def rapport(va, vb, max_octaves=1.6):
    best, bs = -2.0, 0
    for s in range(-int(PAR_OCTAVE * max_octaves), int(PAR_OCTAVE * max_octaves)):
        if s >= 0:
            x, y = va[s:], vb[:len(vb) - s] if s else vb
        else:
            x, y = va[:len(va) + s], vb[-s:]
        if len(x) < 400:
            continue
        r = float(x @ y) / (np.linalg.norm(x) * np.linalg.norm(y) + 1e-12)
        if r > best:
            best, bs = r, s
    return 2 ** (bs / PAR_OCTAVE), best


def main():
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    opts = dict(x[2:].split('=', 1) for x in sys.argv[1:] if x.startswith('--') and '=' in x)
    if not args:
        print(__doc__)
        return 1
    d = opts.get('out', os.path.join('sounds', 'engine'))
    fs = sorted(glob.glob(os.path.join(d, f'{args[0]}-*.wav')),
                key=lambda f: int(re.search(r'-(\d+)\.wav', f).group(1)))
    if len(fs) < 2:
        print(f'{args[0]} : moins de deux boucles, rien à comparer')
        return 1
    vs = [spectre_log(*load(f)) for f in fs]
    labs = [int(re.search(r'-(\d+)\.wav', f).group(1)) for f in fs]
    print(f'{args[0]} — {len(fs)} boucles, de {labs[0]} à {labs[-1]} tr/min '
          f'({12*np.log2(labs[-1]/labs[0]):.0f} demi-tons)')
    print(f"  {'de':>8s} {'à':>8s} {'pas':>7s} {'hauteur mesurée':>16s} {'écart':>8s} {'alignement':>11s}")
    pire, faibles = 0.0, 0
    for i in range(len(fs) - 1):
        q, acc = rapport(vs[i + 1], vs[i])
        attendu = labs[i + 1] / labs[i]
        demi = abs(12 * np.log2(q / attendu))
        pire = max(pire, demi)
        if acc < 0.45:
            faibles += 1
        marque = '  ← saute' if demi > 1.5 else ''
        print(f'  {labs[i]:8d} {labs[i+1]:8d} {12*np.log2(attendu):6.1f} dt {q:13.3f}x '
              f'{demi:6.1f} dt {acc:11.2f}{marque}')
    print(f'\n  pire écart entre voisines : {pire:.1f} demi-tons' +
          ('  — le jeu est cohérent' if pire <= 1.5 else '  — INCOHÉRENT, la hauteur sautera'))
    if faibles:
        print(f'  {faibles} pas mesuré(s) avec un alignement faible : à prendre avec réserve')
    return 0 if pire <= 1.5 else 1


if __name__ == '__main__':
    raise SystemExit(main())
