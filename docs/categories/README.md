# Trois catégories — mesures

Les chiffres derrière la section « Trois catégories » du README principal.
Ces mesures décrivent le réglage initial `b81ac17` (0.30.1). Les retouches Brabham / Renault de
la version 0.30.3 sont validées séparément dans [Caractères F1](../caracteres-f1/README.md).

| Fichier | Mesure | Reproduire |
| --- | --- | --- |
| [`autopilote.txt`](autopilote.txt), [`autopilote.json`](autopilote.json) | meilleur tour brut de l'autopilote, deux tours, marge 0,95, sept circuits | `node tools/plateau-banc.js --sim --out=docs/categories/autopilote.json` |
| [`ideal.txt`](ideal.txt) | tour idéal sur la trajectoire de course, treize circuits | `node tools/plateau-banc.js` |
| fin d'[`autopilote.txt`](autopilote.txt) | pneus de difficulté (dérive et prix du caractère), le plateau entier sur une seule échelle | le même `--sim` |
| [`tools/fiches.json`](../../tools/fiches.json) | vitesses de pointe réelles, avec source et fiabilité | `node tools/fiches.js` |

## Ce qu'on lit

- **Dans une catégorie** : l'écart de chaque voiture à la moyenne de sa catégorie. À l'autopilote,
  les F1 tiennent dans 0,6 %, les GT dans 0,2 %, les prototypes dans 0,6 %.
- **Entre catégories** : le temps moyen rapporté aux GT. F1 −8,5 %, prototypes −6,1 %.
- **Les vitesses de pointe sont des références historiques selon configuration**, avec sources et
  fiabilité dans `tools/fiches.json` (`node tools/fiches.js`). Les neuf F1 restent des estimations.
  Le banc ci-dessous couvre sept circuits et atteint 291 km/h avec la XJR-9 à Monza. Le contrôle
  [indépendant Astra](../avis-parametres-astra/README.md) atteint 328,6 km/h au Castellet : les
  290 km/h employés par la caméra ne constituent donc pas une limite physique du jeu.
- **Le tour idéal** s'étale davantage (2,7 à 3,2 % par catégorie) : c'est ce que la voiture vaut sur
  le papier, avant de payer sa glisse. L'écart entre les deux colonnes est le prix du caractère —
  une voiture qui glisse est rapide en théorie et rend du temps en roulant, ce que son réglage
  compense par l'adhérence.

## Comment le réglage a été obtenu

Chaque voiture a sa vitesse de pointe de référence, puis son caractère à la main (accélération, freinage, appui, glisse). Le
rythme se règle ensuite sur la seule adhérence mécanique, en boucle contre l'autopilote : trois
passes suffisent pour que chaque voiture soit à ±0,4 % de la cible de sa catégorie, le bruit de la mesure.

Deux mesures de sensibilité ont décidé du levier, toutes deux à +4 % sur une seule valeur :

| voiture | adhérence +4 % | accélération +4 % |
| --- | --- | --- |
| M1 Procar | −1,24 % au tour | −0,47 % |
| McLaren M23 | −1,32 % | −0,20 % |
| 962 | −1,34 % | −0,40 % |
| Ferrari 312T | −2,40 % | **+1,29 %** |
| Ford P68 | −2,50 % | **+2,10 %** |
| 911 Turbo | −2,94 % | **+2,81 %** |

Plus de puissance rend plus lentes les voitures qui glissent — la motricité sature et l'arrière
part —, donc un déficit de rythme ne se paie pas en puissance. L'adhérence agit partout, et deux
fois plus sur une voiture qui glisse : elle compense aussi ce qu'elle perd en travers.

## Limites

L'autopilote n'est pas un pilote. Il lève à chaque glisse de l'arrière là où un joueur peut tenir
un peu plus ; une voiture joueuse peut donc être un peu plus rapide au pouce qu'au banc, ou un peu
plus lente pour qui la brusque. Le banc dit que personne n'est hors du peloton ; le ressenti reste à
valider en jouant.
