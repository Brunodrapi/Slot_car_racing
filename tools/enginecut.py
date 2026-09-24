#!/usr/bin/env python3
"""Découpe dans une prise embarquée un jeu de boucles échelonnées en régime.

    python3 tools/enginecut.py <prise.wav> <préfixe> --cyl=6 --rpm=2800,3600,4500,5600,7000,8400
                               [--secondes=0.5] [--out=sounds/engine] [--facteur=1]

`--facteur` multiplie le régime déduit. Il sert quand l'estimateur s'accroche à un rang inférieur
plutôt qu'à l'allumage — un moteur porte aussi son demi-ordre, un rang par tour et un par cycle,
et sur certaines prises ils pèsent plus lourd que l'allumage lui-même. Le sonagramme tranche : on
lit l'écart entre deux rangs voisins et on le compare à `régime/60 × cyl/2`. Le facteur ne change
que les étiquettes, jamais le son — et comme le jeu transpose de `régime ÷ étiquette`, une
étiquette deux fois trop basse fait sonner toute la voiture une octave trop bas.

Pourquoi un jeu et non une boucle. Du ralenti au rupteur il y a **trois octaves**. Une boucle
unique transposée sur toute cette plage ne donne plus un moteur : à 2410 tr/min de base, le
rupteur d'une M1 demande un facteur 3,7, soit vingt-trois demi-tons au-dessus — le son part dans
les aigus et se vide. Il faut plusieurs boucles, chacune n'ayant plus qu'à couvrir quelques
demi-tons de part et d'autre, et le jeu fond de l'une à l'autre.

Comment une fenêtre est retenue. Trois mesures, et une fenêtre doit passer les trois :

1. **Le régime**, par somme harmonique — l'énergie des rangs d'une fondamentale candidate,
   rapportée au nombre de rangs pris, faute de quoi une candidate deux fois plus basse ramasse
   deux fois plus de rangs et gagne toujours.
2. **La stabilité** : la moitié gauche et la moitié droite de la fenêtre doivent donner le même
   régime à 2,5 % près. C'est ce qui écarte les montées en régime, qu'on ne peut pas boucler.
3. **La périodicité** : la corrélation du signal avec lui-même, décalé d'une période. C'est ce qui
   écarte le bruit de roulement et le vent, qui n'ont pas de période du tout.

La boucle est ensuite coupée sur un **nombre entier de périodes d'allumage**, sans quoi elle
claque une fois par tour, et raccordée avec ce qui la précède, si bien que son dernier échantillon
devient le voisin immédiat de son premier.
"""
import os
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


def f0_toutes(a, sr, deb, W, lo, hi):
    """La fondamentale d'allumage de chaque fenêtre, d'un coup.

    Par somme harmonique : l'énergie des rangs d'une candidate, **rapportée au nombre de rangs
    pris**, faute de quoi une candidate deux fois plus basse en ramasse deux fois plus et gagne
    toujours — c'est par là que les estimateurs de hauteur tombent à l'octave.

    Tout est vectorisé. Fenêtre par fenêtre et candidate par candidate en Python, dix minutes de
    prise demandent deux millions de sommes et l'outil n'aboutit jamais.
    """
    N = 1 << 14
    df = sr / N
    hw = np.hanning(W).astype(np.float32)
    cands = np.arange(lo, hi, 1.0)
    out = np.empty(len(deb), np.float32)
    for i in range(0, len(deb), 256):
        F = np.stack([a[d:d + W] for d in deb[i:i + 256]])
        Sp = np.abs(np.fft.rfft((F - F.mean(axis=1, keepdims=True)) * hw, N, axis=1)) ** 2
        notes = np.zeros((len(F), len(cands)), np.float32)
        for j, f in enumerate(cands):
            ks = np.array([k for k in range(1, 25) if 130 <= f * k < 4000])
            if len(ks) < 4:
                continue
            c = np.round(f * ks / df).astype(int)
            idx = np.clip(c[:, None] + np.arange(-2, 3)[None, :], 1, Sp.shape[1] - 1)
            notes[:, j] = Sp[:, idx].max(axis=2).mean(axis=1)
        out[i:i + 256] = cands[notes.argmax(axis=1)]
    return out


def periode(x, sr, f, W):
    """Affine la période autour de sr/f et rend la corrélation obtenue."""
    p0 = sr / f
    best, bp = -2.0, int(p0)
    a = x[:W] - x[:W].mean()
    na = np.linalg.norm(a) + 1e-12
    for p in range(max(8, int(p0 * 0.88)), int(p0 * 1.14) + 1):
        if p + W > len(x):
            break
        b = x[p:p + W] - x[p:p + W].mean()
        r = float(a @ b) / (na * (np.linalg.norm(b) + 1e-12))
        if r > best:
            best, bp = r, p
    return bp, best


def coupe(x, p, n):
    """n périodes, raccordées avec la période qui les précède."""
    L = n * p
    b = x[p:p + L].copy()
    f = np.linspace(0, np.pi / 2, p)
    b[-p:] = b[-p:] * np.cos(f) + x[:p] * np.sin(f)
    return b


def ecris(path, b, sr):
    c = np.abs(b).max()
    if c > 0:
        b = b / c * 0.89
    w = wave.open(path, 'wb')
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((b * 32767).astype(np.int16).tobytes())
    w.close()


def main():
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    opts = dict(x[2:].split('=', 1) for x in sys.argv[1:] if x.startswith('--') and '=' in x)
    if len(args) < 2:
        print(__doc__)
        return 1
    src, prefixe = args[0], args[1]
    cyl = int(opts.get('cyl', 6))
    cibles = [float(x) for x in opts.get('rpm', '2800,3600,4500,5600,7000,8400').split(',')]
    duree = float(opts.get('secondes', 0.5))
    facteur = float(opts.get('facteur', 1))
    out_dir = opts.get('out', os.path.join('sounds', 'engine'))
    os.makedirs(out_dir, exist_ok=True)

    a, sr = load(src)
    ordre = cyl / 2                       # allumages par tour de vilebrequin, quatre temps
    # La plage de recherche vient du régime demandé, avec de la marge : la borner physiquement est
    # ce qui empêche l'estimateur de tomber à l'octave, plus sûrement que n'importe quelle astuce.
    lo = min(cibles) * 0.75 / 60 * ordre / facteur
    hi = max(cibles) * 1.3 / 60 * ordre / facteur
    print(f'{src} : {len(a)/sr:.1f} s, {sr} Hz — allumage cherché entre {lo:.0f} et {hi:.0f} Hz')

    W = int(0.5 * sr)
    pas = int(0.25 * sr)
    deb = np.arange(0, len(a) - 2 * W, pas)
    niv = np.array([np.sqrt((a[d:d + W] ** 2).mean()) for d in deb])
    f = f0_toutes(a, sr, deb, W, lo, hi)

    # Stabilité : une fenêtre n'est bouclable que si le régime ne bouge pas. Plutôt que de couper
    # chaque fenêtre en deux et de mesurer deux fois, on compare une fenêtre à sa voisine — le pas
    # est deux fois plus court que la fenêtre, elles se recouvrent, et deux voisines qui disent la
    # même chose à 2,5 % près décrivent bien un régime tenu. C'est gratuit.
    stable = np.zeros(len(f), bool)
    stable[:-1] = np.abs(f[1:] / f[:-1] - 1) < 0.025
    stable[1:] &= np.abs(f[:-1] / f[1:] - 1) < 0.025
    stable &= niv > 0.02

    cand = []
    for i in np.flatnonzero(stable):
        d = int(deb[i])
        p, r = periode(a[d:], sr, f[i], W // 2)
        if r > 0.45:                       # en deçà, il n'y a pas de période : du roulement, du vent
            cand.append((d, sr / p * 60 / ordre * facteur, r))
    print(f'  {stable.sum()} fenêtres à régime tenu, {len(cand)} assez périodiques pour être bouclées')
    if not cand:
        raise SystemExit('aucune fenêtre bouclable')

    rpms = np.array([c[1] for c in cand])
    print(f'  régimes couverts : {rpms.min():.0f} à {rpms.max():.0f} tr/min')
    print()
    print(f"{'cible':>8s} {'retenu':>9s} {'écart':>7s} {'instant':>9s} {'période':>8s} {'corrél.':>8s} {'raccord':>8s}  fichier")
    fait = []
    for cible in cibles:
        # la meilleure fenêtre proche de la cible : on pondère l'écart de régime par la qualité
        note = [(abs(np.log(c[1] / cible)) - 0.25 * c[2], c) for c in cand if 0.85 < c[1] / cible < 1.18]
        if not note:
            print(f'{cible:8.0f} {"— rien de stable à ce régime":>50s}')
            continue
        note.sort(key=lambda x: x[0])
        d, rpm, r = note[0][1]
        p, _ = periode(a[d:], sr, rpm / facteur / 60 * ordre, W // 2)
        n = max(1, round(duree * sr / p))
        if d + (n + 1) * p > len(a):
            continue
        b = coupe(a[d:], p, n)
        saut = abs(b[0] - b[-1]) / (np.diff(b).std() + 1e-12)
        nom = f'{prefixe}-{int(round(rpm))}.wav'
        ecris(os.path.join(out_dir, nom), b, sr)
        fait.append((nom, int(round(rpm))))
        print(f'{cible:8.0f} {rpm:8.0f} {(rpm/cible-1)*100:+6.1f} % {d/sr:8.1f} s {p:8d} {r:8.3f} {saut:8.2f}  {nom}')

    print()
    print('À coller dans js/cars.js :')
    print('        sample: { set: [')
    for nom, rpm in fait:
        print(f"          {{ src: '{out_dir}/{nom}', rpm: {rpm} }},")
    print('        ] },')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
