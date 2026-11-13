# Le guide de l'entraînement : mesures

Le guide dit au doigt quoi faire — rouge plein : lâche ; tirets rouges : dose ; chevrons verts : remets
les gaz (`Race.guide` et `Race._limitesGuide`, js/race.js ; `Renderer._drawGuide`, js/render.js). Le
pourquoi est dans le README, « Le guide : ce que le doigt doit faire ». Ici, ce qui a été mesuré.

## Le pilote qui obéit au guide (`node tools/guide-banc.js`)

Un pilote qui ne sait que lire la consigne à l'endroit de sa voiture : il appuie hors zone, lève dans
le rouge, et dans le pointillé appuie quand il est sous la vitesse cible. Un retard de réaction, aucun
geste tenu moins de 80 ms. Il ne voit ni la courbure, ni l'adhérence, ni la glisse : si le guide ment,
il sort. Les treize circuits, deux tours lancés chacun, le fantôme (niveau difficile) roulant en même
temps.

Réglage de la 0.52.67 (`marge` 0,95 · `reaction` 0,2 s ; vitesse de passage = limite de courbure,
la règle de l'IA) :

| retard | voiture | sorties | tours | écart au fantôme |
|---|---|---|---|---|
| 0 ms | Bumblebee Ground 79 (F1) | 0 | 26 | +3,3 % |
| 0 ms | Breithüft Aero 62 (proto) | 0 | 26 | +3,4 % |
| 0 ms | Howitzer K1 (GT) | 0 | 26 | +3,9 % |
| 150 ms | Bumblebee Ground 79 | 0 | 26 | +5,3 % |
| 150 ms | Breithüft Aero 62 | 0 | 26 | +5,3 % |
| 150 ms | Howitzer K1 | 0 | 26 | +5,2 % |
| 300 ms | Bumblebee Ground 79 | 0 | 26 | +6,2 % |
| 300 ms | Breithüft Aero 62 | 0 | 26 | +6,4 % |
| 300 ms | Howitzer K1 | 0 | 26 | +5,7 % |

La 0.52.66, qui laissait le guide à fond dans les enchaînements où les voitures passent sans lever
(le Raidillon), donnait 1,7 à 4,4 % : plus rapide, mais le guide n'y disait plus ce que fait le
fantôme. Retirée à la demande de Bruno.

## Le guide dit-il ce que fait le fantôme ?

Le guide calculé pour la voiture du fantôme, comparé à ce que le fantôme fait (cinq circuits — Stand de
frites, Parco Reale, Le Rocher, Fuji Yama, Windmolen —, trois voitures, un tour lancé) :

- 622 des 680 freinages du fantôme sont annoncés par une zone rouge à moins de 80 m (47 sur 50 sur un
  tour de Stand de frites) ;
- la zone commence en moyenne 14 m avant que le fantôme lève : c'est l'avance de 200 ms laissée pour
  réagir ;
- quand le guide dit « lâche », le fantôme a le pied levé 71 % du temps ; le reste, il dose (il remet
  de brefs coups de gaz en fin de freinage) ;
- il lève sous « gaz » pendant 2,9 % du tour.

Copier exactement ses réglages (marge 0,96 au lieu de 0,95, frein 0,88 au lieu de 0,9) ne change rien à
ces chiffres.

## Ce qui a été essayé et écarté

| essai | résultat |
|---|---|
| `marge` 0,98 au lieu de 0,95 | 1 % plus vite, mais 6 sorties pour la GT à 300 ms de retard (six circuits) |
| `reaction` 0,15 s au lieu de 0,2 | 3 sorties pour le proto à 300 ms de retard, à l'épingle de Pastaga 83 ; 0,5 % plus vite sans retard |
| l'essai à vitesse constante comme juge de TOUS les virages | 106 km/h annoncés dans un virage de Windmolen qui se prend à 70 ; 13 à 18 sorties en trois tours pour la F1 |
| `garde` 2 m au lieu de 1,5 | le Raidillon n'est plus reconnu « à fond » pour les protos, qui y passent pourtant avec 2,1 m de marge |
| `traite` 1,10 au lieu de 1,05 | le Raidillon n'est plus reconnu « à fond » pour les F1 |
| sans la porte `bref` (tronçon traversé en moins d'une demi-seconde) | un pli de la ligne au milieu de la ligne droite de Stand de frites — 4 m de rayon 146 m — faisait lever de 260 à 192 km/h |

## Ce que la 0.52.66 avait essayé : les enchaînements à fond (retiré en 0.52.67)

Chaque tronçon où la courbure demandait de lever était essayé d'une traite par un point piloté comme la
voiture, 5 % plus vite qu'elle ne peut y arriver ; s'il restait à 1,5 m des bords et si les coudes
étaient brefs, le tronçon se prenait à fond. Zéro à cinq tronçons par circuit étaient reconnus ainsi
(tableau ci-dessous). Aucune sortie au banc, des tours 1,5 à 2 % plus rapides — mais le fantôme, qui
roule comme l'IA, freinait là où le guide disait « gaz ».

## Le Raidillon de Stand de frites, pied au plancher (la voiture réelle)

| voiture | vitesse | marge minimale au bord | écart maximal à la ligne |
|---|---|---|---|
| Howitzer K1 | 225-247 km/h | 0,7 m | 4,1 m |
| Purosangue Furia 40 | 240-270 km/h | 1,2 m | 3,5 m |
| Bumblebee Ground 79 | 226-251 km/h | 2,4 m | 1,9 m |
| Purosangue Dodici T | 236-262 km/h | 2,4 m | 2,1 m |
| Breithüft Aero 62 | 235-265 km/h | 2,1 m | 2,5 m |
| Moggy Nightfall | 236-270 km/h | 2,1 m | 2,5 m |

La courbure de la ligne y demande 100 à 130 km/h. L'IA y freine, et le guide avec elle.

## Les tronçons que la 0.52.66 reconnaissait « à fond », par circuit

Nombre de tronçons où la courbure demanderait de lever, et entre parenthèses ceux que l'essai laisse
passer pied au plancher (ligne idéale) :

| circuit | F1 (Bumblebee Ground 79) | proto (Breithüft Aero 62) | GT (Howitzer K1) |
|---|---|---|---|
| Parco Reale | 8 (1) | 8 (0) | 9 (1) |
| Stand de frites | 11 (2) | 10 (2) | 10 (2) |
| Le Rocher | 7 (2) | 7 (2) | 7 (1) |
| Royal Air Base | 12 (5) | 12 (4) | 13 (4) |
| Fuji Yama | 9 (1) | 9 (1) | 9 (1) |
| Festival de Carnaval | 8 (1) | 7 (1) | 7 (1) |
| Corkscrew Ranch | 9 (2) | 9 (2) | 10 (3) |
| Bratwurst Ring | 10 (1) | 9 (1) | 11 (3) |
| Autoroute 11 | 13 (4) | 9 (2) | 9 (1) |
| Kangaroo Mountain | 10 (2) | 10 (1) | 10 (2) |
| Apfelstrudel Ring | 8 (1) | 7 (0) | 7 (1) |
| Pastaga 83 | 6 (0) | 7 (0) | 6 (0) |
| Windmolen | 6 (0) | 9 (2) | 6 (0) |
