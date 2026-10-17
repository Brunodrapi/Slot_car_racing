# Trois catégories — mesures

Les chiffres derrière la section « Trois catégories » du README principal.

| Fichier | Mesure | Reproduire |
| --- | --- | --- |
| [`autopilote.txt`](autopilote.txt), [`autopilote.json`](autopilote.json) | meilleur tour brut de l'autopilote, deux tours, marge 0,95, sept circuits | `node tools/plateau-banc.js --sim --out=docs/categories/autopilote.json` |
| [`ideal.txt`](ideal.txt) | tour idéal sur la trajectoire de course, treize circuits | `node tools/plateau-banc.js` |
| [`difficulte.txt`](difficulte.txt) | pneus de difficulté, le plateau entier sur une seule échelle | `node tools/difficulte.js` |

## Ce qu'on lit

- **Dans une catégorie** : l'écart de chaque voiture à la moyenne de sa catégorie. À l'autopilote,
  les F1 tiennent dans 1,1 %, les GT dans 1,0 %, les prototypes dans 0,2 %.
- **Entre catégories** : le temps moyen rapporté aux GT. F1 −8,6 %, prototypes −6,1 %.
- **Le tour idéal** s'étale davantage (2,3 à 3,1 % par catégorie) : c'est ce que la voiture vaut sur
  le papier, avant de payer sa glisse. L'écart entre les deux colonnes est le prix du caractère —
  une voiture qui glisse est rapide en théorie et rend du temps en roulant, ce que son réglage
  compense par l'adhérence.

## Comment le réglage a été obtenu

Chaque voiture reçoit son caractère à la main (pointe, accélération, freinage, appui, glisse). Le
rythme se règle ensuite sur la seule adhérence mécanique, en boucle contre l'autopilote : trois
passes suffisent pour que chaque voiture soit à ±0,35 % de la cible de sa catégorie.

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
