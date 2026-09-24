#!/usr/bin/env python3
"""Découpe dans une prise embarquée un jeu de boucles échelonnées en régime.

    python3 tools/enginecut.py <prise.wav> <préfixe> --haut=9000 [--n=6]
                               [--secondes=0.5] [--out=sounds/engine] [--min-tonalite=0.6]

`--haut` est le régime que représentera la boucle la plus aiguë du jeu ; les autres sont
étiquetées d'après leur hauteur mesurée **relativement** à elle. Mettre le rupteur de la voiture.

Pourquoi un jeu et non une boucle. Du ralenti au rupteur il y a trois octaves. Une boucle unique
transposée sur toute cette plage ne donne plus un moteur : mesuré, le rupteur d'une M1 demandait
vingt-trois demi-tons au-dessus d'une boucle prise à 2410 tr/min, et le son partait en sifflement.

**Pourquoi ne pas mesurer le régime de chaque boucle.** C'est la leçon d'une série d'essais ratés.
Un moteur n'a pas un fondamental unique et net : il porte ses demi-ordres, ses rangs d'allumage,
ses résonances d'échappement, et l'énergie ne se trouve pas forcément sur l'allumage. Autocorré-
lation, somme harmonique, écart entre rangs — les trois se trompent, et pas toutes au même endroit,
ce qui donne un jeu d'étiquettes incohérentes entre elles. Et une étiquette fausse **par rapport à
ses voisines** est le pire des défauts : la hauteur saute au moment où le fondu passe d'une boucle
à l'autre.

Ce qui se mesure, en revanche, sans la moindre ambiguïté, c'est le **rapport de hauteur entre deux
boucles** : dilater le temps translate le spectre sur un axe logarithmique, et le décalage qui
superpose le mieux deux spectres donne le rapport exact. On n'a jamais besoin de savoir quel rang
est l'allumage — seulement de combien une boucle est plus aiguë qu'une autre, ce qui est
exactement ce dont le fondu a besoin. L'échelle absolue, elle, est posée par `--haut`, c'est-à-dire
par le jeu et non par la prise.

Une fenêtre doit encore être **tonale** — assez périodique pour qu'on entende un moteur et non un
souffle — et **tenue** — le régime ne bougeant pas, faute de quoi elle n'est pas bouclable. La
boucle est coupée sur un nombre entier de périodes, et raccordée avec ce qui la précède, si bien
que son dernier échantillon devient le voisin immédiat de son premier.
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


def tonalite(x, sr, W, lo=60, hi=700):
    """La meilleure période du signal et la corrélation obtenue : à quel point il se répète.

    C'est la seule mesure de hauteur qu'on garde, et seulement pour couper au bon endroit — pas
    pour étiqueter. Une période « à l'octave » coupe aussi bien qu'une période juste.
    """
    a = x[:W] - x[:W].mean()
    na = np.linalg.norm(a) + 1e-12
    best, bp = -2.0, int(sr / hi)
    for p in range(int(sr / hi), int(sr / lo)):
        if p + W > len(x):
            break
        b = x[p:p + W] - x[p:p + W].mean()
        r = float(a @ b) / (na * (np.linalg.norm(b) + 1e-12))
        if r > best:
            best, bp = r, p
    return bp, best


def spectre_log(a, sr, f0=70, f1=4000, pts=1000):
    """Le spectre sur un axe logarithmique, normalisé. Dilater le temps l'y translate."""
    a = (a - a.mean()) * np.hanning(len(a))
    N = 1 << 16
    S = np.abs(np.fft.rfft(a, N))
    fr = np.fft.rfftfreq(N, 1 / sr)
    v = np.log(np.interp(np.geomspace(f0, f1, pts), fr, S) + 1e-9)
    v -= v.mean()
    return v / (np.linalg.norm(v) + 1e-12)


PAR_OCTAVE = 1000 / np.log2(4000 / 70)


def rapport(va, vb, max_octaves=1.6):
    """De combien `va` est plus aiguë que `vb`, et la qualité de la superposition."""
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


def coupe(x, p, n):
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
    haut = float(opts.get('haut', 9000))
    combien = int(opts.get('n', 6))
    duree = float(opts.get('secondes', 0.5))
    seuil = float(opts.get('min-tonalite', 0.6))
    seuil_al = float(opts.get('min-alignement', 0.65))
    out_dir = opts.get('out', os.path.join('sounds', 'engine'))
    os.makedirs(out_dir, exist_ok=True)

    a, sr = load(src)
    W = int(0.3 * sr)
    pas = int(0.3 * sr)
    print(f'{src} : {len(a)/sr:.1f} s, {sr} Hz')

    # --- 1. les fenêtres tonales ---
    brut = []
    for d in range(0, len(a) - 2 * W, pas):
        if np.sqrt((a[d:d + W] ** 2).mean()) < 0.03:
            continue
        p, r = tonalite(a[d:], sr, W)
        if r >= seuil:
            brut.append((d, p, r))
    print(f'  {len(brut)} fenêtres tonales (corrélation >= {seuil})')
    if len(brut) < combien:
        raise SystemExit(f'pas assez de fenêtres tonales : {len(brut)}')

    # --- 2. les boucles candidates ---
    n_de = lambda p: max(1, round(duree * sr / p))
    cands = []
    for d, p, r in brut:
        n = n_de(p)
        if d + (n + 2) * p > len(a):
            continue
        b = coupe(a[d:], p, n)
        saut = abs(b[0] - b[-1]) / (np.diff(b).std() + 1e-12)
        if saut <= 1.5:                  # un raccord qui claque s'entend à chaque tour de boucle
            cands.append({'d': d, 'p': p, 'ton': r, 'b': b, 'saut': saut})
    brut = None
    if len(cands) < 2:
        raise SystemExit('pas assez de boucles bouclables')
    # On les échantillonne **dans le temps**, et non par tonalité. C'est le temps qui balaie la
    # plage de régimes : garder les plus tonales revient à garder un seul régime, celui où le
    # moteur chante le mieux, et la chaîne ne peut alors aller nulle part.
    NC = int(opts.get('candidates', 220))
    if len(cands) > NC:
        cands = [cands[i] for i in np.linspace(0, len(cands) - 1, NC).astype(int)]
    for c in cands:
        c['v'] = spectre_log(c['b'], sr)
    print(f'  {len(cands)} boucles candidates retenues')

    # --- 3. la chaîne ---
    # La qualité de superposition **chute avec l'écart de hauteur** : le timbre d'un moteur change
    # avec le régime, deux sons éloignés ne se ressemblent plus, et un rapport mesuré entre eux ne
    # veut rien dire. Une référence unique ne peut donc pas couvrir trois octaves — c'est ce qui
    # donnait des jeux dont la hauteur sautait.
    # On avance donc de proche en proche : depuis la boucle la plus tonale, on cherche celle qui
    # est un peu plus aiguë ET qui se superpose bien, on l'ajoute, et on repart d'elle. Chaque pas
    # est mesuré avec confiance, et les rapports se multiplient le long de la chaîne. Puis la même
    # chose vers le grave.
    PAS_MIN, PAS_MAX = 1.04, 1.50        # un pas de 0,7 à 7 demi-tons
    seuil_pas = float(opts.get('min-pas', 0.55))
    def voisine(depuis, sens, pris):
        best, bq, bacc = None, 0, 0
        for c in cands:
            if c['d'] in pris:
                continue
            q, acc = rapport(c['v'], depuis['v'], max_octaves=0.7)
            qq = q if sens > 0 else 1 / q
            if not (PAS_MIN <= qq <= PAS_MAX) or acc < seuil_pas:
                continue
            note = acc * c['ton'] / (1 + c['saut'])
            if note > bq:
                best, bq, bacc = c, note, acc
                best_q = q
        return (best, best_q, bacc) if best else (None, 1.0, 0.0)

    depart = max(cands, key=lambda c: c['ton'])
    chaine = [{'c': depart, 'q': 1.0}]
    pris = {depart['d']}
    for sens in (+1, -1):
        cur, acc_q = depart, 1.0
        for _ in range(combien):
            nxt, q, acc = voisine(cur, sens, pris)
            if nxt is None:
                break
            acc_q *= q
            chaine.append({'c': nxt, 'q': acc_q})
            pris.add(nxt['d'])
            cur = nxt
    chaine.sort(key=lambda x: x['q'])
    # On garde la chaîne entière. L'éclaircir pour économiser des fichiers écarte les voisines, et
    # la mesure qui les relie perd alors la confiance qui faisait tout l'intérêt de la chaîne :
    # essayé, le dernier pas de la M1 se contredisait de cinq demi-tons. Le poids se gagne sur la
    # durée des boucles, pas sur leur nombre.
    gardees = [(x['c']['d'], x['c']['p'], x['c']['ton'], x['q'], 0.0, x['c']['b'], x['c']['saut'])
               for x in chaine]
    etendue = chaine[-1]['q'] / chaine[0]['q']
    print(f'  chaîne de {len(chaine)} boucles, étendue {12*np.log2(etendue):.0f} demi-tons')

    qmax = max(g[3] for g in gardees)
    print()
    print(f"{'étiquette':>10s} {'hauteur':>9s} {'instant':>9s} {'tonalité':>9s} {'alignement':>11s} "
          f"{'période':>8s} {'raccord':>8s}  fichier")
    fait = []
    for d, p, r, q, acc, b, saut in gardees:
        rpm = int(round(haut * q / qmax))
        nom = f'{prefixe}-{rpm}.wav'
        ecris(os.path.join(out_dir, nom), b, sr)
        fait.append((nom, rpm))
        print(f'{rpm:10d} {q:8.3f}x {d/sr:8.1f} s {r:9.3f} {acc:11.2f} {p:8d} {saut:8.2f}  {nom}')

    print()
    print('À coller dans js/cars.js :')
    print('        sample: { set: [')
    for nom, rpm in fait:
        print(f"          {{ src: '{out_dir}/{nom}', rpm: {rpm} }},")
    print('        ] },')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
