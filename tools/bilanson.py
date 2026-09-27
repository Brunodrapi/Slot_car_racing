#!/usr/bin/env python3
"""Le bilan de qualité de tous les sons du jeu, mesuré et non tenu à la main.

    python3 tools/bilanson.py [--out=sounds/BILAN.md] [--cache=<dossier>]

Écrit `sounds/BILAN.md`. Une table tenue à la main est fausse au premier fichier déposé ; celle-ci
se régénère, donc elle reste vraie. Elle répond à deux questions par fichier : **qu'est-ce que
c'est**, et **qu'est-ce qu'on peut en tirer**.

Ce qui est mesuré, et pourquoi c'est ça.

`montée` / `descente` — la plus large variation de hauteur d'un seul tenant, en demi-tons. C'est la
seule mesure qui décide de l'usage d'une prise, parce que le lecteur granulaire ne transpose jamais :
il se déplace dans la prise, donc **la plage de régimes couverte est exactement celle que la prise
parcourt**. Une prise qui monte de quatre demi-tons ne couvrira jamais plus qu'un facteur 1,26.

`périodicité` — la corrélation d'une période à la suivante. Elle est rapportée, pas utilisée pour
juger, et c'est une correction : on avait cru qu'elle séparait un vrai moteur d'un souffle filtré qui
pulse. Mesurée sur tout le dossier, elle fait l'inverse. Les vrais onboards tombent à 0,39–0,42 —
bruit de route, vent, cylindres déphasés, tout ce qui casse la répétition exacte — quand le fichier
de synthèse le plus propre atteint 0,80. Une prise de course a une périodicité médiocre parce que
c'est une prise de course.

`montée par seconde` — le garde-fou qui remplace la périodicité, et le seul qui ait un sens physique.
Il a deux bornes, et chacune écarte des fichiers que la seule largeur aurait acceptés.

*Trop vite*, au-delà de cinq demi-tons par seconde : ça ferait un facteur 1,4 de régime en une
seconde, ce que seul un moteur au point mort fait. Ce qu'on a mesuré est alors autre chose qu'une
montée en régime — un démarrage, un passage de rapport, un montage. C'est ce qui écarte `787B_start`
(20,7 demi-tons en 1,9 s) et `M1_Procar_off-7000` (13,9 en 1,0 s).

*Trop lentement*, en dessous de 0,8 : la mesure cumule des comparaisons de fenêtres voisines, donc un
biais minuscule par fenêtre devient plusieurs demi-tons sur quinze secondes. Une montée assez lente
pour que la dérive l'explique ne prouve rien. C'est ce qui écarte `gt40_plein_regime`, qui monte de
5,5 demi-tons sur 15,4 secondes — 0,4 par seconde. Toutes les rampes qui sonnent juste sont entre 1,3
et 3,9.

`alignement` — la confiance de la mesure de hauteur elle-même, fenêtre à fenêtre. En dessous de 0,6
le fichier est trop bruité ou trop peu périodique pour qu'on croie sa courbe de hauteur.

`crête` / `écrasé` — le niveau, et la part d'échantillons collés à la butée. Un fichier écrêté ne se
répare pas.

Ce qui n'est PAS mesuré, et pourquoi ça compte de le dire. **Le régime absolu**, d'abord : un moteur
n'a pas de fondamental unique et net — il porte ses demi-ordres, ses rangs d'allumage, ses résonances
— et toutes les mesures absolues essayées ici se trompent d'octave quelque part. Un contrôle écrit
pour cela donnait à deux rampes neuves la même dispersion qu'à une bonne et bien meilleure qu'à une
autre jugée bonne à l'oreille : il retombait sur des ordres voisins.

**Et la montée mesurée autrement qu'en cumulant les fenêtres voisines.** Deux autres méthodes ont été
essayées pour contrôler la première — comparer directement les deux bouts, puis sommer des
comparaisons directes sur 2, 4, 8 morceaux. Étalonnées sur les trois rampes que l'oreille valide,
elles se sont disqualifiées seules :

| rampe | déclaré (fenêtres voisines) | par bouts, en 1 / 2 / 4 / 8 morceaux |
|---|---|---|
| `six-inline` | 16,7 demi-tons | +1,0 / −0,2 / +8,6 / +8,8 |
| `v8-corvette` | 13,8 demi-tons | +3,0 / −1,8 / +4,8 / +7,2 |
| `v8-f40` | 8,7 demi-tons | +4,9 / +4,5 / +3,9 / +2,6 |

Aucune ne retrouve la valeur déclarée, et aucune ne s'accorde avec elle-même d'une échelle à la
suivante. Deux spectres distants d'un moteur se ressemblent trop peu pour qu'on lise leur écart. Le
cumul de comparaisons voisines reste donc la seule mesure de montée qu'on garde — c'est celle qui a
produit les rampes qui sonnent juste — et l'oreille reste l'arbitre.
"""
import json
import os
import subprocess
import sys
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import enginegrains as G                                    # noqa: E402

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def decode(src, cache):
    """Un wav 16 bits, en passant par le décodeur de Chromium pour ce que Python ne lit pas."""
    if src.lower().endswith('.wav'):
        try:
            w = wave.open(src)
            if w.getsampwidth() == 2:
                return src
        except Exception:
            pass
    os.makedirs(cache, exist_ok=True)
    out = os.path.join(cache, os.path.basename(src).rsplit('.', 1)[0] + '.wav')
    if not os.path.exists(out):
        env = dict(os.environ, NODE_PATH=os.environ.get('NODE_PATH', '/opt/node22/lib/node_modules'))
        r = subprocess.run(['node', os.path.join(RACINE, 'tools', 'decodeaudio.js'), src, out],
                           capture_output=True, text=True, env=env, cwd=RACINE)
        if r.returncode != 0 or not os.path.exists(out):
            return None
    return out


def periodicite(a, sr):
    """La corrélation d'une période à la suivante, à la meilleure période trouvée.

    Cherchée entre 100 et 800 Hz : c'est la bande où tombe la fréquence d'allumage de toutes les
    voitures du jeu, du GT40 au ralenti au douze-cylindres au rupteur.
    """
    x = a[:int(min(len(a) / sr, 4.0) * sr)]
    if len(x) < sr // 4:
        return 0.0
    x = x - x.mean()
    lo, hi = int(sr / 800), int(sr / 100)
    best = 0.0
    n = len(x) - hi - 1
    for lag in range(lo, hi):
        u, v = x[:n], x[lag:lag + n]
        d = np.linalg.norm(u) * np.linalg.norm(v)
        if d > 0:
            best = max(best, float(u @ v) / d)
    return best


def montee(lp, acc, fort, hop):
    """La plus large montée d'un seul tenant, en octaves, et sa durée.

    Un recul franc au milieu d'une montée est un passage de rapport, pas du bruit de mesure : on
    s'arrête là, sinon on additionnerait deux rapports et on annoncerait une plage qui n'existe pas.

    C'est mot pour mot la recherche de `tools/enginegrains.py`, et ce n'est pas un hasard : un bilan
    qui mesure autrement que l'outil qui fabrique les rampes promet de la matière qu'on ne saura pas
    extraire. Première version de ce fichier : elle cherchait la descente en balayant le signal à
    l'endroit et annonçait 9,9 demi-tons de chute là où l'outil n'en tire que 5,0. Une descente se
    mesure donc comme l'outil la trouve — en cherchant une montée dans le signal retourné.
    """
    n, meilleur = len(lp), (0.0, 0.0)
    for i in range(n - 4):
        j, sommet, recul = i, lp[i], 0.0
        while j + 1 < n and fort[j + 1]:
            sommet = max(sommet, lp[j + 1])
            recul = max(recul, sommet - lp[j + 1])
            if recul > 0.12 or acc[j + 1] < 0.45:
                break
            j += 1
        if lp[j] - lp[i] > meilleur[0]:
            meilleur = (lp[j] - lp[i], (j - i) * hop)
    return meilleur


def mesure(path, cache):
    w = decode(path, cache)
    if not w:
        return {'erreur': 'illisible'}
    a, sr = G.load(w)
    src = wave.open(w)
    o = {'secondes': len(a) / sr, 'hz': sr, 'voies': src.getnchannels(),
         'crete': float(np.abs(a).max()),
         'ecrase': float((np.abs(a) > 0.995).mean()),
         'periodicite': periodicite(a, sr)}
    hop = 0.08
    o['montee'], o['descente'], o['alignement'] = (0.0, 0.0), (0.0, 0.0), 0.0
    for sens, cle in ((1, 'montee'), (-1, 'descente')):
        deb, V, niv = G.spectres(a[::sens], sr, hop, 0.16)
        if len(V) < 6:
            return o
        q, acc = G.pas_a_pas(V)
        lp = np.concatenate([[0.0], np.cumsum(np.log2(q[1:]))])
        if sens == 1:
            o['alignement'] = float(np.median(acc[1:]))
        o[cle] = montee(lp, acc, niv > niv.max() * 0.06, hop)
    return o


# Le plancher de l'outil qui fabrique les rampes : en deçà, il n'y a plus de montée à parcourir.
PLANCHER = 0.35 * 12
# Les deux bornes de pente, en demi-tons par seconde (voir l'en-tête).
PENTE_MAX = 5.0
PENTE_MIN = 0.8


def verdict(o):
    """Ce qu'on peut tirer du fichier — et, sinon, ce qui lui manque."""
    if 'erreur' in o:
        return 'illisible', o['erreur'], 0.0
    m, d = o['montee'][0] * 12, o['descente'][0] * 12
    pm = m / max(o['montee'][1], 1e-6)
    pd = d / max(o['descente'][1], 1e-6)
    if o['ecrase'] > 0.001:
        return 'écrêté', f"{o['ecrase']*100:.1f} % des échantillons à la butée", 0.0
    if o['alignement'] < 0.6:
        return ('douteux', f"alignement {o['alignement']:.2f} : la courbe de hauteur n'est pas sûre",
                0.0)
    bon = PENTE_MIN <= pm <= PENTE_MAX
    if m >= PLANCHER and bon and m >= d:
        return ('montée', f'{m:.1f} demi-tons en {o["montee"][1]:.1f} s → facteur {2**(m/12):.2f} '
                f'de plage', pm)
    if d >= PLANCHER and PENTE_MIN <= pd <= PENTE_MAX:
        return 'descente', f'{d:.1f} demi-tons en {o["descente"][1]:.1f} s', pd
    # Ce qui reste n'est pas exploitable : on dit laquelle des trois conditions manque, parce que
    # « inutilisable » ne dit pas quoi découper la fois suivante.
    p = pm if m >= d else pd
    if max(m, d) < 1.5:
        return 'régime tenu', f'la hauteur ne bouge que de {max(m, d):.1f} demi-ton', p
    if max(m, d) < PLANCHER:
        return 'trop étroit', f'{max(m, d):.1f} demi-tons, il en faut {PLANCHER:.1f}', p
    if p > PENTE_MAX:
        return ('pas un régime', f'{p:.1f} demi-tons par seconde : trop vite pour une voiture sur '
                f'un rapport', p)
    return ('trop lent', f'{p:.1f} demi-ton par seconde : la dérive de la mesure suffit à '
            f'l\'expliquer', p)


def main():
    opts = dict(x[2:].split('=', 1) for x in sys.argv[1:] if x.startswith('--') and '=' in x)
    out = os.path.join(RACINE, opts.get('out', os.path.join('sounds', 'BILAN.md')))
    cache = opts.get('cache', os.path.join('/tmp', 'bilanson'))

    sons = []
    for d, _, fs in os.walk(os.path.join(RACINE, 'sounds')):
        for f in sorted(fs):
            if f.lower().endswith(('.mp3', '.wav', '.ogg', '.webm', '.m4a')):
                sons.append(os.path.join(d, f))
    sons.sort()

    rampes = {}
    for f in sorted(os.listdir(os.path.join(RACINE, 'sounds', 'engine'))):
        if f.endswith('.json'):
            rampes[f[:-5]] = json.load(open(os.path.join(RACINE, 'sounds', 'engine', f)))

    # quelle voiture joue quelle rampe
    cars = open(os.path.join(RACINE, 'js', 'cars.js'), encoding='utf-8').read()
    import re
    par_rampe = {}
    for mm in re.finditer(r"id: '([a-z0-9]+)'[\s\S]{0,900}?sounds/engine/([a-z0-9-]+)\.json", cars):
        par_rampe.setdefault(mm.group(2), []).append(mm.group(1))

    lignes = ['# Le bilan des sons', '',
              'Écrit par `python3 tools/bilanson.py`, jamais à la main : une table tenue à la main est',
              'fausse au premier fichier déposé. Ce que chaque colonne mesure et pourquoi, dans l\'en-tête',
              'de l\'outil.', '',
              '## Les rampes que le jeu joue', '',
              '| rampe | voiture(s) | durée | montée | plage couverte | poids |',
              '|---|---|---|---|---|---|']
    for nom, m in sorted(rampes.items(), key=lambda kv: -kv[1]['monteeDemiTons']):
        wav = os.path.join(RACINE, 'sounds', 'engine', nom + '.wav')
        ko = os.path.getsize(wav) // 1024 if os.path.exists(wav) else 0
        qui = ', '.join(par_rampe.get(nom, ['—']))
        lignes.append(f'| `{nom}` | {qui} | {m["secondes"]:.1f} s | {m["monteeDemiTons"]:.0f} demi-tons '
                      f'| {m["rpmBas"]:.0f} – {m["rpmHaut"]:.0f} tr/min | {ko} Ko |')
    lignes += ['',
               'La plage n\'est pas posée : elle est déduite de la montée mesurée. Hors d\'elle, la synthèse',
               'reprend la main en fondu sur un quart d\'octave — une rampe étroite coûte de la couverture,',
               'pas de la justesse.', '',
               'Ces rampes reparaissent plus bas, dans la liste des prises, et leur montée re-mesurée ne',
               'retombe pas exactement sur la valeur déclarée ici — 11,6 demi-tons contre 13,8 pour la',
               'Corvette. Ce n\'est pas une contradiction : la valeur déclarée a été mesurée sur la prise',
               'd\'origine, en 48 kHz, avant découpe, rééchantillonnage à 24 kHz et normalisation. L\'écart',
               'donne l\'ordre de grandeur de l\'incertitude de la mesure, qui est d\'un ou deux demi-tons.', '',
               '## Les prises, une par une', '',
               '| fichier | durée | format | crête | périodicité | alignement | montée | descente | dt/s | ce qu\'on en tire |',
               '|---|---|---|---|---|---|---|---|---|---|']
    for p in sons:
        rel = os.path.relpath(p, RACINE)
        o = mesure(p, cache)
        v, pourquoi, pente = verdict(o)
        if 'erreur' in o:
            lignes.append(f'| `{rel}` | — | — | — | — | — | — | — | — | **{v}** — {pourquoi} |')
            continue
        fmt = f'{o["hz"]//1000} kHz {"st" if o["voies"] > 1 else "mono"}'
        lignes.append(
            f'| `{rel}` | {o["secondes"]:.1f} s | {fmt} | {o["crete"]:.2f} | {o["periodicite"]:.2f} '
            f'| {o["alignement"]:.2f} | {o["montee"][0]*12:.1f} dt | {o["descente"][0]*12:.1f} dt '
            f'| {pente:.1f} | **{v}** — {pourquoi} |')
        print(f'{rel:46s} {v:12s} {pourquoi}')
    lignes.append('')
    open(out, 'w', encoding='utf-8').write('\n'.join(lignes) + '\n')
    print(f'\nécrit {os.path.relpath(out, RACINE)} — {len(sons)} prise(s), {len(rampes)} rampe(s)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
