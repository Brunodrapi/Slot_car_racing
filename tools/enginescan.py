#!/usr/bin/env python3
"""Piste le régime d'un enregistrement de moteur du début à la fin.

    python3 tools/enginescan.py <prise.wav> [--cyl=6] [--csv=fichier] [--png=fichier]

Une prise embarquée de dix minutes contient de tout : des lignes droites, des freinages, des
passages au stand, du vent. Avant d'y découper quoi que ce soit, il faut savoir **où se trouve
quel régime**, et c'est une mesure, pas une écoute.

Le régime est pris par autocorrélation et non au spectre. La question posée est « à partir de
quel décalage le signal se répète-t-il ? », à quoi l'autocorrélation répond directement, alors
qu'un pic de spectre se trompe d'octave dès que le fondamental est faible — ce qui est le cas de
tous les moteurs, dont l'énergie est dans les rangs supérieurs.

Le signal est d'abord ramené à 12 kHz : le fondamental d'allumage ne dépasse pas 500 Hz, et
travailler à 48 kHz coûterait seize fois plus cher pour la même réponse.
"""
import sys
import wave

import numpy as np


def load(path):
    w = wave.open(path)
    n, sr, ch, sw = w.getnframes(), w.getframerate(), w.getnchannels(), w.getsampwidth()
    if sw != 2:
        raise SystemExit('seul le 16 bits est géré')
    a = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    return a, sr


def decime(a, sr, cible=12000):
    k = max(1, int(round(sr / cible)))
    if k == 1:
        return a, sr
    n = (len(a) // k) * k
    return a[:n].reshape(-1, k).mean(axis=1), sr // k


def passehaut(a, sr, coupe):
    """Retire ce qui est sous `coupe` — une moyenne glissante est un passe-bas, la soustraire
    laisse le passe-haut. Sommaire, mais il ne s'agit que de dégager la voie avant la mesure."""
    L = max(3, int(sr / coupe))
    k = np.ones(L, np.float32) / L
    return a - np.convolve(a, k, 'same')


def piste(a, sr, pas=0.1, fen=0.6, lo_hz=115, hi_hz=520):
    """Rend, pour chaque instant, la fréquence d'allumage et la netteté de la périodicité.

    Par somme harmonique et non par autocorrélation. Deux raisons, l'une vérifiée sur ce
    fichier-ci. Une prise embarquée porte un grondement continu sous 120 Hz — la route, le vent,
    la caisse — qui ne bouge pas de toute la prise et qui pèse plus lourd que le moteur ; on le
    retire d'abord. Mais même dégagée, l'autocorrélation décroche d'une octave dès que le moteur
    monte : relevée à dix instants lus à la main sur le sonagramme, elle rendait 2424 au lieu de
    4790 et 2474 au lieu de 7400. La somme harmonique, elle, tombe juste aux dix.

    Chaque fondamentale candidate est notée par l'énergie de ses rangs **rapportée au nombre de
    rangs pris**. Sans cette division, une candidate deux fois plus basse ramasse deux fois plus
    de rangs et gagne toujours : c'est par là que les estimateurs de hauteur tombent à l'octave.
    """
    a = passehaut(a, sr, lo_hz)
    W = int(fen * sr)
    H = int(pas * sr)
    deb = np.arange(0, len(a) - W, H)
    N = 8192
    df = sr / N
    hw = np.hanning(W).astype(np.float32)
    # le spectre de toutes les fenêtres, par paquets pour tenir en mémoire
    Sp = np.empty((len(deb), N // 2 + 1), np.float32)
    niv = np.empty(len(deb), np.float32)
    for i in range(0, len(deb), 256):
        F = np.stack([a[d:d + W] for d in deb[i:i + 256]])
        niv[i:i + 256] = np.sqrt((F ** 2).mean(axis=1))
        Sp[i:i + 256] = np.abs(np.fft.rfft((F - F.mean(axis=1, keepdims=True)) * hw, N, axis=1)) ** 2
    # la note de chaque candidate
    cands = np.arange(lo_hz, hi_hz, 1.0)
    notes = np.zeros((len(deb), len(cands)), np.float32)
    for j, f in enumerate(cands):
        ks = np.array([k for k in range(1, 25) if 130 <= f * k < 3000])
        if len(ks) < 4:
            continue
        c = np.round(f * ks / df).astype(int)
        idx = np.clip(c[:, None] + np.arange(-2, 3)[None, :], 1, Sp.shape[1] - 1)
        notes[:, j] = Sp[:, idx].max(axis=2).mean(axis=1)
    # Choix sous contrainte de continuité. La somme harmonique se trompe encore d'octave par
    # moments — relevée sur dix instants lus à la main, huit tombaient à moins de 4 %, deux à
    # moitié ou aux deux tiers du vrai régime. Un moteur ne double pas de régime en un dixième de
    # seconde : on note donc chaque candidate par son énergie ET par sa proximité à l'instant
    # précédent, et le meilleur chemin se dégage tout seul. C'est un Viterbi au rabais — une seule
    # passe avant, sans retour en arrière — et il suffit ici.
    notes /= notes.max(axis=1, keepdims=True) + 1e-20
    lc = np.log(cands)
    j = np.empty(len(notes), int)
    j[0] = notes[0].argmax()
    for i in range(1, len(notes)):
        # tolérance large : un vrai coup de boîte fait bien chuter le régime d'un tiers
        pen = np.exp(-((lc - lc[j[i - 1]]) / 0.22) ** 2)
        j[i] = (notes[i] * (0.25 + 0.75 * pen)).argmax()
    hz = cands[j]
    # netteté : à quel point la meilleure candidate se détache des autres
    med = np.median(notes, axis=1) + 1e-20
    net = np.clip(1 - med / (notes[np.arange(len(j)), j] + 1e-20), 0, 1)
    return hz, net, niv


def main():
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    opts = dict(x[2:].split('=', 1) for x in sys.argv[1:] if x.startswith('--') and '=' in x)
    if not args:
        print(__doc__)
        return 1
    cyl = int(opts.get('cyl', 6))
    a, sr = load(args[0])
    a, sr = decime(a, sr)
    hz, net, niv = piste(a, sr)
    # un quatre-temps allume cyl/2 fois par tour de vilebrequin
    rpm = hz * 60 / (cyl / 2)
    t = np.arange(len(rpm)) * 0.1

    bon = (net > 0.35) & (niv > niv.max() * 0.04)
    print(f'{args[0]}')
    print(f'  durée            {len(a)/sr:.1f} s, {len(rpm)} relevés')
    print(f'  périodicité      nette sur {100*bon.mean():.0f} % du temps (netteté > 0,35)')
    if bon.any():
        q = np.percentile(rpm[bon], [5, 25, 50, 75, 95])
        print(f'  régime           5 % {q[0]:.0f} · 25 % {q[1]:.0f} · médiane {q[2]:.0f} · 75 % {q[3]:.0f} · 95 % {q[4]:.0f} tr/min')
    if opts.get('csv'):
        np.savetxt(opts['csv'], np.c_[t, rpm, net, niv], delimiter=',', header='t,rpm,nettete,niveau', comments='')
        print(f'  écrit            {opts["csv"]}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
