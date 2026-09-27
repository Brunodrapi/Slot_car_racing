# Le bilan des sons

Écrit par `python3 tools/bilanson.py`, jamais à la main : une table tenue à la main est
fausse au premier fichier déposé. Ce que chaque colonne mesure et pourquoi, dans l'en-tête
de l'outil.

## Les rampes que le jeu joue

| rampe | voiture(s) | durée | montée | plage couverte | poids |
|---|---|---|---|---|---|
| `v12-countach` | countach | 6.6 s | 25 demi-tons | 1821 – 7500 tr/min | 307 Ko |
| `six-inline` | m1procar | 8.0 s | 17 demi-tons | 3423 – 9000 tr/min | 375 Ko |
| `v8-corvette` | corvette | 7.6 s | 14 demi-tons | 2708 – 6000 tr/min | 356 Ko |
| `v8-f40` | f40 | 4.2 s | 9 demi-tons | 4702 – 7750 tr/min | 195 Ko |
| `r26b-787b` | 787b | 5.2 s | 6 demi-tons | 6216 – 9000 tr/min | 243 Ko |
| `v8-gt40` | gt40 | 2.3 s | 4 demi-tons | 4852 – 6200 tr/min | 108 Ko |

La plage n'est pas posée : elle est déduite de la montée mesurée. Hors d'elle, la synthèse
reprend la main en fondu sur un quart d'octave — une rampe étroite coûte de la couverture,
pas de la justesse.

Ces rampes reparaissent plus bas, dans la liste des prises, et leur montée re-mesurée ne
retombe pas exactement sur la valeur déclarée ici — 11,6 demi-tons contre 13,8 pour la
Corvette. Ce n'est pas une contradiction : la valeur déclarée a été mesurée sur la prise
d'origine, en 48 kHz, avant découpe, rééchantillonnage à 24 kHz et normalisation. L'écart
donne l'ordre de grandeur de l'incertitude de la mesure, qui est d'un ou deux demi-tons.

## Les prises, une par une

| fichier | durée | format | crête | périodicité | alignement | montée | descente | dt/s | ce qu'on en tire |
|---|---|---|---|---|---|---|---|---|---|
| `sounds/M787B/787B_start.mp3` | 13.0 s | 48 kHz mono | 0.99 | 0.13 | 0.81 | 20.7 dt | 10.4 dt | 10.8 | **pas un régime** — 10.8 demi-tons par seconde : trop vite pour une voiture sur un rapport |
| `sounds/M787B/78B_descente.mp3` | 9.2 s | 48 kHz mono | 0.65 | 0.20 | 0.77 | 7.0 dt | 5.0 dt | 3.7 | **descente** — 5.0 demi-tons en 1.4 s |
| `sounds/M787B/Countach_montee.mp3` | 30.2 s | 48 kHz mono | 0.47 | 0.39 | 0.74 | 24.5 dt | 10.1 dt | 3.8 | **montée** — 24.5 demi-tons en 6.4 s → facteur 4.12 de plage |
| `sounds/M787B/GT40_montee.mp3` | 10.8 s | 48 kHz mono | 0.79 | 0.42 | 0.75 | 4.4 dt | 2.6 dt | 2.3 | **montée** — 4.4 demi-tons en 1.9 s → facteur 1.29 de plage |
| `sounds/M787B/GT_40_descente.mp3` | 6.8 s | 48 kHz mono | 0.73 | 0.39 | 0.76 | 1.8 dt | 2.3 dt | 2.2 | **trop étroit** — 2.3 demi-tons, il en faut 4.2 |
| `sounds/M787B/M787B_montee.mp3` | 26.1 s | 48 kHz mono | 0.61 | 0.62 | 0.70 | 6.4 dt | 4.1 dt | 1.3 | **montée** — 6.4 demi-tons en 5.0 s → facteur 1.45 de plage |
| `sounds/M787B/gt40_plein_regime.mp3` | 15.6 s | 48 kHz mono | 0.78 | 0.58 | 0.74 | 5.5 dt | 0.0 dt | 0.4 | **trop lent** — 0.4 demi-ton par seconde : la dérive de la mesure suffit à l'expliquer |
| `sounds/engine/r26b-787b.wav` | 5.2 s | 24 kHz mono | 0.89 | 0.48 | 0.70 | 7.0 dt | 0.0 dt | 1.4 | **montée** — 7.0 demi-tons en 5.0 s → facteur 1.50 de plage |
| `sounds/engine/six-inline.wav` | 8.0 s | 24 kHz mono | 0.89 | 0.37 | 0.85 | 18.3 dt | 0.0 dt | 2.4 | **montée** — 18.3 demi-tons en 7.8 s → facteur 2.88 de plage |
| `sounds/engine/v12-countach.wav` | 6.6 s | 24 kHz mono | 0.89 | 0.23 | 0.86 | 24.3 dt | 0.0 dt | 3.9 | **montée** — 24.3 demi-tons en 6.3 s → facteur 4.08 de plage |
| `sounds/engine/v8-corvette.wav` | 7.6 s | 24 kHz mono | 0.89 | 0.60 | 0.81 | 11.6 dt | 0.7 dt | 2.6 | **montée** — 11.6 demi-tons en 4.5 s → facteur 1.96 de plage |
| `sounds/engine/v8-f40.wav` | 4.2 s | 24 kHz mono | 0.89 | 0.26 | 0.61 | 8.5 dt | 0.0 dt | 2.2 | **montée** — 8.5 demi-tons en 3.9 s → facteur 1.63 de plage |
| `sounds/engine/v8-gt40.wav` | 2.3 s | 24 kHz mono | 0.89 | 0.37 | 0.72 | 5.8 dt | 0.1 dt | 3.1 | **montée** — 5.8 demi-tons en 1.8 s → facteur 1.40 de plage |
| `sounds/six-inline/M1_Procar_idle_seed_30.wav` | 6.0 s | 44 kHz st | 0.79 | 0.62 | 0.85 | 5.5 dt | 1.8 dt | 1.3 | **montée** — 5.5 demi-tons en 4.3 s → facteur 1.38 de plage |
| `sounds/six-inline/M1_Procar_off-7000_seed_30.wav` | 10.0 s | 44 kHz st | 0.55 | 0.45 | 0.77 | 13.9 dt | 8.3 dt | 14.4 | **pas un régime** — 14.4 demi-tons par seconde : trop vite pour une voiture sur un rapport |
| `sounds/six-inline/M1_Procar_on-2500_seed_30.wav` | 6.0 s | 44 kHz st | 0.67 | 0.55 | 0.89 | 7.6 dt | 2.2 dt | 5.3 | **pas un régime** — 5.3 demi-tons par seconde : trop vite pour une voiture sur un rapport |
| `sounds/six-inline/M1_Procar_on-4500_seed_30.wav` | 6.0 s | 44 kHz st | 0.79 | 0.49 | 0.87 | 4.1 dt | 2.8 dt | 12.8 | **trop étroit** — 4.1 demi-tons, il en faut 4.2 |
| `sounds/six-inline/M1_Procar_sweep_seed_30.wav` | 10.0 s | 44 kHz st | 0.54 | 0.39 | 0.89 | 6.2 dt | 4.4 dt | 3.3 | **montée** — 6.2 demi-tons en 1.9 s → facteur 1.43 de plage |
| `sounds/six-inline/on-6000.wav` | 8.0 s | 48 kHz st | 1.00 | 0.80 | 0.69 | 4.2 dt | 1.2 dt | 0.6 | **trop lent** — 0.6 demi-ton par seconde : la dérive de la mesure suffit à l'expliquer |

