#!/usr/bin/env python3
"""Extrait d'un enregistrement de moteur une boucle sans couture.

    python3 tools/engineloop.py <wav> <sortie.wav> [--secondes=0.6] [--debut=auto]

Un moteur tenu à régime constant est presque périodique : il se répète à la fréquence
d'allumage. Une boucle n'est donc muette à la couture que si elle contient un **nombre entier de
périodes d'allumage** — coupée n'importe où, elle claque une fois par tour de boucle, et l'oreille
entend ce clic bien avant d'entendre le moteur.

La période n'est pas prise au spectre mais par corrélation directe : on cherche le décalage qui
superpose le mieux le signal sur lui-même. C'est la mesure qui compte ici, puisque c'est
exactement la question posée — « à partir de quel décalage le signal se répète-t-il ? » — et non
une estimation de hauteur, qui se trompe d'octave dès que le fondamental est faible, ce qui est
le cas de tous les moteurs.

Reste une couture parfaite en théorie et audible en pratique, le bruit ne se répétant jamais :
une fondu-enchaîné à puissance constante sur une période la ponce.
"""
import sys
import wave

import numpy as np


def load(path):
    w = wave.open(path)
    n, sr, ch, sw = w.getnframes(), w.getframerate(), w.getnchannels(), w.getsampwidth()
    if sw != 2:
        raise SystemExit(f'{path}: seul le 16 bits est géré, celui-ci est en {sw*8} bits')
    a = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float64) / 32768
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    return a, sr


def periode(x, sr, lo_hz=40, hi_hz=400):
    """Le décalage, en échantillons, qui superpose le mieux le signal sur lui-même."""
    lo, hi = int(sr / hi_hz), int(sr / lo_hz)
    W = min(len(x) - hi - 1, int(sr * 0.25))
    a = x[:W]
    a = a - a.mean()
    na = np.linalg.norm(a) + 1e-12
    best, bp = -2.0, lo
    for p in range(lo, hi):
        b = x[p:p + W]
        b = b - b.mean()
        r = float(a @ b) / (na * (np.linalg.norm(b) + 1e-12))
        if r > best:
            best, bp = r, p
    return bp, best


def couture(a):
    """Le saut au raccord, rapporté aux sauts ordinaires du signal.

    Le comparer à la crête ne dit rien : un signal fort saute beaucoup d'un échantillon au
    suivant, partout, sans qu'on entende quoi que ce soit. Ce qui s'entend, c'est un saut
    *inhabituel*. On rapporte donc le saut du raccord à l'écart-type des sauts internes : 1 veut
    dire que le raccord ressemble à n'importe quel autre endroit, donc qu'il est inaudible."""
    d = np.diff(a)
    return abs(a[0] - a[-1]) / (d.std() + 1e-12)


def main():
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    opts = dict(x[2:].split('=', 1) for x in sys.argv[1:] if x.startswith('--') and '=' in x)
    if len(args) < 2:
        print(__doc__)
        return 1
    src, dst = args[0], args[1]
    vise = float(opts.get('secondes', 0.6))

    a, sr = load(src)
    # On part du tiers du fichier : l'attaque du début et la chute de la fin ne sont pas du régime tenu.
    d0 = int(len(a) * 0.33) if opts.get('debut', 'auto') == 'auto' else int(float(opts['debut']) * sr)
    x = a[d0:]

    p, r = periode(x, sr)
    n = max(1, round(vise * sr / p))
    L = n * p
    if L + p > len(x):
        raise SystemExit('fichier trop court pour cette durée de boucle')

    # Le corps de boucle commence une période APRÈS le début du morceau retenu, et sa queue se
    # fond dans cette période laissée devant. Le dernier échantillon de la boucle devient alors le
    # voisin immédiat du premier : le raccord tombe entre deux échantillons adjacents du signal
    # d'origine, il n'y a plus rien à recoller. Fondre avec ce qui SUIT, au contraire, recolle
    # deux instants distants de toute la boucle, et le saut reste.
    boucle = x[p:p + L].copy()
    f = np.linspace(0, np.pi / 2, p)
    boucle[-p:] = boucle[-p:] * np.cos(f) + x[:p] * np.sin(f)

    crete = np.abs(boucle).max()
    if crete > 0:
        boucle = boucle / crete * 0.89        # de la marge sous le zéro, le lecteur ajoutera le reste

    w = wave.open(dst, 'wb')
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(sr)
    w.writeframes((boucle * 32767).astype(np.int16).tobytes())
    w.close()

    print(f'{src}')
    print(f'  période      {p} échantillons = {sr/p:.1f} Hz  (corrélation {r:.3f})')
    print(f'  boucle       {n} périodes = {L/sr:.3f} s, {L*2/1024:.0f} Ko en mono 16 bits')
    print(f'  raccord      {couture(boucle):.2f} fois un saut ordinaire (1 = inaudible)')
    print(f'  écrit        {dst}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
