# L'appui à l'échelle des circuits, et des pneus par catégorie (0.52.60)

> « Moi j'ai l'impression que les F1 glissent autant que les GT. Certainement lié au fait qu'on est
> obligé de prendre les virages moins vite qu'en vrai parce que les voitures ont un facteur d'échelle
> plus grand non ? » — Bruno

## Le constat

Les voitures (4,2 à 4,5 m) et les routes (11 à 16 m de large) sont à taille réelle, mais les circuits
n'ont qu'environ la moitié de leur longueur : Monza 2,9 km pour 5,8, Spa 3,4 pour 7,0, Fuji Yama 3,3 pour
5,8, Silverstone 3,3 pour 5,9, Le Mans 4,2 pour 13,6. Médiane : 0,56. Les virages ont donc à peu près la
moitié de leur vrai rayon ; à adhérence égale, on y passe √0,56 ≈ 0,75 fois moins vite. L'appui variant
comme le carré de la vitesse, il n'apportait presque plus rien.

Et les pneus étaient réglés presque pareil d'une catégorie à l'autre : pic de dérive à 6,3° en F1 contre
6,9° en GT et en proto, même équilibre avant/arrière, même décrochage.

## Ce qui change

- `APPUI_ECHELLE = 1,8` (≈ 1 / 0,56, `js/cars.js`) : l'appui se calcule sur la vitesse qu'aurait la
  voiture dans le vrai virage (v² · R est le même). Les `df` des catégories et des voitures restent ceux
  d'un circuit à l'échelle 1. Le plafond de l'appui (1,8 fois l'adhérence mécanique, `gripAt`) ne bouge
  pas : il est atteint à une vitesse 0,75 fois plus basse, celle qui lui correspond dans nos virages.
- Pneus F1 : `slipPeak` 0,11 → 0,08 rad, `rearBias` 1,06 → 1,12, `cliff` 0,2 → 0,14.
- Pneus proto : `slipPeak` 0,12 → 0,105 rad, `rearBias` 1,06 → 1,09, `cliff` 0,18 → 0,15.
- GT : pneus inchangés. Trois voitures recalées pour garder l'équilibre interne (l'appui à l'échelle
  profite davantage à celles qui en ont) : Purosangue Furia 40 `grip` 0,937 → 0,928, Purosangue Gran
  Corsa 1,02 → 1,037, Moggy Longnose 1,051 → 1,066.
- La fiche (« adhérence », g à 180 km/h) décrit la vraie voiture sur un vrai circuit : elle se calcule
  sans l'échelle et ne change pas, sauf pour les trois GT recalées (de 0,01 à 0,02 g).

## Mesures

### En virage, au pilote automatique (`node tools/appui-banc.js`)

Six circuits (Monza, Spa, Fuji Yama, Silverstone, Windmolen, Le Rocher), le deuxième tour, lancé, à la
limite (marge 1,00). « En virage » : la piste demande plus de 0,4 g.

| voiture | vitesse moy. en virage | part de l'appui | dérive au 95e centile | somme des meilleurs tours |
|---|---|---|---|---|
| Bumblebee Ground 79 (F1, effet de sol) | 98 → 107 km/h | 25 → 39 % | 6,4° → **3,2°** | 536,0 → 495,4 s |
| Purosangue Dodici T (F1, ailerons) | 98 → 105 km/h | 16 → 26 % | 9,0° → **4,8°** | 533,5 → 501,4 s |
| Sixpence Hexa (F1, six roues) | — → 103 km/h | — → 25 % | — → 3,5° | — → 507,6 s |
| McHaggis Arrow 23 (F1) | — → 104 km/h | — → 29 % | — → 4,0° | — → 502,1 s |
| Breithüft Aero 62 (proto Groupe C) | 94 → 101 km/h | 17 → 28 % | 6,9° → **4,9°** | 547,5 → 520,1 s |
| Redneck Endurance 40 (proto années 60) | — → 99 km/h | — → 19 % | — → 6,7° | — → 524,7 s |
| Howitzer K1 (GT) | 87 → 90 km/h | 7 → 12 % | 8,7° → 8,6° | 582,5 → 570,2 s |
| Purosangue Furia 40 (GT) | 88 → 91 km/h | 10 → 18 % | 8,6° → 7,3° | 584,6 → 568,6 s |

Aucune sortie de piste, avant comme après.

Trois réglages de pneus essayés avec l'appui à l'échelle (F1 / proto) :

| | F1 `slipPeak`, `rearBias`, `cliff` | proto | dérive p95 F1 (effet de sol / ailerons) | proto (962 / GT40) |
|---|---|---|---|---|
| appui seul | 0,11 · 1,06 · 0,2 | 0,12 · 1,06 · 0,18 | 5,0° / 8,1° | 6,0° / — |
| A | 0,09 · 1,10 · 0,2 | 0,11 · 1,08 · 0,18 | 3,8° / 6,1° | 5,3° / 7,1° |
| **B (retenu)** | 0,08 · 1,12 · 0,14 | 0,105 · 1,09 · 0,15 | 3,2° / 4,8° | 4,9° / 6,7° |
| C | 0,075 · 1,10 · 0,12 | 0,10 · 1,08 · 0,14 | 3,5° / 5,1° | 4,9° / 6,8° |

### Le plateau, en tour idéal (`node tools/plateau-banc.js`)

| | avant | après |
|---|---|---|
| F1 par rapport aux GT | −6,07 % | −7,56 % |
| protos par rapport aux GT | −4,46 % | −5,43 % |
| étalement F1 | 3,18 % | 2,55 % |
| étalement GT | 2,93 % | 3,01 % |
| étalement protos | 2,68 % | 1,80 % |

### L'IA en course, niveau par niveau (`node tools/niveaux-banc.js <racine> <niveau>`)

Courses à dix voitures, quatre circuits, trois catégories, deux graines (24 courses par niveau).

| niveau | sorties par voiture et par course | tête-à-queue | temps moyen du vainqueur |
|---|---|---|---|
| facile | 0,29 → 0,18 | 0 → 0 | 301,1 → 291,3 s (−3,3 %) |
| moyen | 0,12 → 0,15 | 0,01 → 0 | 283,0 → 273,4 s (−3,4 %) |
| difficile | 0,26 → 0,13 | 0,09 → 0,03 | 270,7 → 261,9 s (−3,3 %) |
| extrême | 0,21 → 0,19 | 0,06 → 0,03 | 252,8 → 246,1 s (−2,7 %) |
| cauchemar | 0,16 → 0,19 | 0,02 → 0,01 | 239,0 → 232,9 s (−2,6 %) |

Les écarts entre niveaux restent ceux d'avant : l'échelle des trophées ne bouge pas.

## Ce qui n'est pas modélisé

- Le freinage ne profite pas de l'appui : il est constant (environ 2 g pour une F1) quelle que soit la
  vitesse.
- Derrière une autre voiture, l'aspiration existe (5 % de pointe et 8 % d'accélération en plus à moins de
  3,5 longueurs, dans l'axe), mais pas la perte d'appui dans l'air perturbé.
- L'appui n'a pas de coût en vitesse de pointe : celle-ci est fixée par voiture.
