#!/usr/bin/env python3
"""Prépare une **rampe** de moteur pour la lecture granulaire.

    python3 tools/enginegrains.py <prise.wav> <nom> --haut=9000
                                  [--secondes=6] [--hz=24000] [--out=sounds/engine]

`--haut` est le rupteur de la voiture, et c'est le seul repère à donner. **Le bas se déduit de la
montée réellement mesurée dans la rampe** : une rampe qui monte de neuf demi-tons ne peut couvrir
que neuf demi-tons de plage de régime, point. Le lui en faire couvrir vingt-cinq étire l'axe des
régimes de presque trois fois — le moteur monte alors bien moins vite que le compte-tours, et ça
s'entend tout de suite. C'est le défaut qui restait après le passage au granulaire.

Pourquoi pas des boucles. La littérature du son de moteur de jeu est unanime et le chiffre est
net : **une boucle commence à sonner étirée dès qu'on la transpose de plus de 500 tr/min**. À
6000 tr/min cela fait sept dixièmes de demi-ton. Un jeu de boucles espacées d'un demi-ton
couvrirait à peine mille tours, et couvrir trois octaves en demanderait des dizaines. C'est pour
cela que les moteurs de jeu sérieux — REV, AudioMotors, le moteur granulaire de Wwise — ne
transposent pas : ils **se déplacent dans un enregistrement de montée en régime** et y prennent
le son là où le moteur tournait vraiment à ce régime. Zéro transposition, donc zéro déformation.

Ce qu'il faut pour cela : une **rampe**, c'est-à-dire une montée continue, pied au plancher, sur
un seul rapport, du bas de la plage au rupteur. Cet outil la trouve tout seul dans une prise
embarquée et écrit, à côté du son, la table qui dit à quel instant le moteur passait par quel
régime.

Comment la hauteur est suivie. Pas en mesurant un régime — un moteur n'a pas de fondamental unique
et net, et toutes les mesures absolues essayées ici se sont trompées d'octave à un moment ou à un
autre. On mesure seulement **de combien la hauteur a bougé d'une fenêtre à la suivante**, ce qui
est un tout petit écart, donc une mesure sûre : une dilatation du temps translate le spectre sur
un axe logarithmique, et le décalage qui superpose le mieux deux spectres voisins donne le rapport
exact. Les rapports se cumulent, et on obtient une courbe de hauteur relative fiable sans jamais
avoir eu à nommer un régime. L'échelle absolue, elle, est **posée** par `--bas` et `--haut`, donc
par la voiture — et une erreur là-dessus ne déforme rien, elle décale seulement l'endroit de la
rampe qu'on entend.
"""
import json
import os
import sys
import wave

import numpy as np

F0, F1, PTS = 70.0, 4500.0, 900
PAR_OCTAVE = PTS / np.log2(F1 / F0)


def load(path):
    w = wave.open(path)
    n, sr, ch, sw = w.getnframes(), w.getframerate(), w.getnchannels(), w.getsampwidth()
    if sw != 2:
        raise SystemExit('seul le 16 bits est géré')
    a = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    return a, sr


def spectres(a, sr, hop, fen):
    """Le spectre log-fréquence de chaque fenêtre, normalisé."""
    W = int(fen * sr)
    H = int(hop * sr)
    deb = np.arange(0, len(a) - W, H)
    N = 1 << 14
    hw = np.hanning(W).astype(np.float32)
    fr = np.fft.rfftfreq(N, 1 / sr)
    axe = np.geomspace(F0, F1, PTS)
    out = np.empty((len(deb), PTS), np.float32)
    niv = np.empty(len(deb), np.float32)
    for i in range(0, len(deb), 256):
        F = np.stack([a[d:d + W] for d in deb[i:i + 256]])
        niv[i:i + 256] = np.sqrt((F ** 2).mean(axis=1))
        S = np.abs(np.fft.rfft((F - F.mean(axis=1, keepdims=True)) * hw, N, axis=1))
        for j in range(S.shape[0]):
            v = np.log(np.interp(axe, fr, S[j]) + 1e-9)
            v -= v.mean()
            out[i + j] = v / (np.linalg.norm(v) + 1e-12)
    return deb, out, niv


def pas_a_pas(V, max_demi=4.0):
    """Le rapport de hauteur entre chaque fenêtre et la précédente, et sa confiance.

    Volontairement borné à quelques demi-tons : entre deux fenêtres distantes d'un dixième de
    seconde, un moteur ne saute pas d'une octave, et permettre un grand décalage ne ferait
    qu'ouvrir la porte aux erreurs d'octave qu'on cherche justement à éviter.
    """
    smax = int(PAR_OCTAVE * max_demi / 12)
    n = len(V)
    q = np.ones(n, np.float64)
    acc = np.zeros(n, np.float64)
    for i in range(1, n):
        a, b = V[i], V[i - 1]
        best, bs = -2.0, 0
        for s in range(-smax, smax + 1):
            if s >= 0:
                x, y = a[s:], b[:PTS - s] if s else b
            else:
                x, y = a[:PTS + s], b[-s:]
            r = float(x @ y) / (np.linalg.norm(x) * np.linalg.norm(y) + 1e-12)
            if r > best:
                best, bs = r, s
        q[i] = 2 ** (bs / PAR_OCTAVE)
        acc[i] = best
    return q, acc


def main():
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    opts = dict(x[2:].split('=', 1) for x in sys.argv[1:] if x.startswith('--') and '=' in x)
    if len(args) < 2:
        print(__doc__)
        return 1
    src, nom = args[0], args[1]
    haut = float(opts.get('haut', 9000))
    vise = float(opts.get('secondes', 6))
    out_dir = opts.get('out', os.path.join('sounds', 'engine'))
    os.makedirs(out_dir, exist_ok=True)

    a, sr = load(src)
    hop, fen = 0.08, 0.16
    deb, V, niv = spectres(a, sr, hop, fen)
    q, acc = pas_a_pas(V)
    print(f'{src} : {len(a)/sr:.1f} s, {len(deb)} fenêtres, alignement médian {np.median(acc[1:]):.2f}')

    # la hauteur relative, cumulée
    lp = np.concatenate([[0.0], np.cumsum(np.log2(q[1:]))])
    fort = niv > niv.max() * 0.06

    # --- la meilleure rampe : la montée la plus longue et la plus régulière ---
    # On cherche un intervalle où la hauteur monte franchement et sans rebrousser chemin. La
    # tolérance au recul absorbe les petites hésitations du pilote sans laisser passer un
    # changement de rapport, qui fait chuter la hauteur d'un coup.
    n = len(lp)
    W = max(3, int(vise / hop))
    meilleur, score = None, -1e9
    for i in range(n - 8):
        j = i
        recul = 0.0
        sommet = lp[i]
        while j + 1 < n and fort[j + 1]:
            sommet = max(sommet, lp[j + 1])
            recul = max(recul, sommet - lp[j + 1])
            if recul > 0.12 or acc[j + 1] < 0.45:     # un huitième d'octave de recul : c'est un rapport
                break
            j += 1
        etendue = lp[j] - lp[i]
        duree = (j - i) * hop
        if duree < 1.2 or etendue < 0.6:
            continue
        s = etendue * min(1.0, duree / vise)          # large ET assez longue
        if s > score:
            score, meilleur = s, (i, j)
    if not meilleur:
        raise SystemExit('aucune montée en régime franche trouvée dans cette prise')
    i, j = meilleur
    t0, t1 = deb[i] / sr, (deb[j] + int(fen * sr)) / sr
    etendue = lp[j] - lp[i]
    # La plage couverte vaut exactement la montée mesurée, ancrée au rupteur. Une erreur ici ne
    # déforme pas le son — le granulaire ne transpose jamais — mais elle désaccorde le moteur du
    # compte-tours, ce qui s'entend autant.
    bas = haut / 2 ** etendue
    print(f'  rampe retenue : {t0:.1f} → {t1:.1f} s ({t1-t0:.1f} s), {etendue*12:.0f} demi-tons de montée')
    print(f'  plage couverte : {bas:.0f} → {haut:.0f} tr/min (déduite de la montée, pas posée)')

    # --- la table régime → instant dans la rampe ---
    # La hauteur doit être strictement croissante pour être inversible : on la force, les petits
    # reculs venant du bruit de mesure et non du moteur.
    seg = lp[i:j + 1] - lp[i]
    seg = np.maximum.accumulate(seg)
    seg = seg / seg[-1]                                # 0 en bas, 1 au rupteur
    tps = (deb[i:j + 1] - deb[i]) / sr
    NT = 128
    u = np.linspace(0, 1, NT)                          # u = position en hauteur, donc en régime
    table = np.interp(u, seg, tps)

    x = a[int(t0 * sr):int(t1 * sr)]
    # Ramené à 24 kHz : un moteur n'a plus rien à dire au-dessus de 12 kHz, et la rampe pèse
    # moitié moins. Moyenne glissante avant décimation, faute de quoi ce qui traîne au-dessus de
    # la nouvelle limite se replierait dans la bande utile.
    hz = int(opts.get('hz', 24000))
    sr_out = sr
    if hz and hz < sr:
        k = max(1, int(round(sr / hz)))
        x = np.convolve(x, np.ones(k, np.float32) / k, 'same')[::k]
        sr_out = sr // k
    x = x / (np.abs(x).max() + 1e-9) * 0.89
    p = os.path.join(out_dir, f'{nom}.wav')
    w = wave.open(p, 'wb')
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr_out)
    w.writeframes((x * 32767).astype(np.int16).tobytes())
    w.close()

    meta = {'src': p.replace(os.sep, '/'), 'rpmBas': round(bas, 1), 'rpmHaut': haut,
            'monteeDemiTons': round(float(etendue * 12), 2),
            'secondes': round(len(x) / sr_out, 4),
            'table': [round(float(v), 5) for v in table]}
    pj = os.path.join(out_dir, f'{nom}.json')
    json.dump(meta, open(pj, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'  écrit {p} ({len(x)*2//1024} Ko) et {pj}')
    print()
    print('À coller dans js/cars.js :')
    print(f"        sample: {{ ramp: '{pj}' }},")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
