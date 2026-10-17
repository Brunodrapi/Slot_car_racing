# Brabham BT46B, Renault RS10 et proportions — hybrid 0.30.3

La BT46B se distingue davantage par son accroche en virage lent. La RS10 garde une remise des gaz
douce en bas, puis une poussée plus soutenue à vitesse moyenne et élevée. Le réglage conserve le
pilotage par petites pulsations et le frein personnel du joueur.

La Lotus 79 et les trois livrées XJR‑9 reviennent à **+10 % de largeur par rapport au dessin
initial**, contre +25 % dans le premier essai. Leur largeur dessinée baisse ainsi d'environ 12 %
par rapport à la version 0.30.2. Les autres F1 gardent leurs proportions.
[Comparaison des dessins](../nouvelles-voitures/largeur-corrigee.png).

## BT46B : une accroche lente plus lisible

L'adhérence mécanique passe de 15,01 à **15,55 m/s²** (`mul.grip` 1,028 → 1,065), légèrement
au-dessus de la Lotus 72. L'appui dépendant de la vitesse baisse (`mul.df` 0,70 → 0,58).
À 60 km/h, la capacité latérale totale gagne environ 2,5 % ; à 180 km/h elle baisse d'environ 3,2 %.
Le but est une voiture stable qui enroule les virages lents, pas une hausse uniforme des vitesses
de passage. L'accélération, le frein, la pointe et l'équilibre arrière restent ceux de la BT46B.

Cela représente la signature du ventilateur dans le modèle simplifié du jeu ; ce n'est pas une
simulation de sa mécanique ou de sa dépendance au régime moteur.

## RS10 : plus douce en bas, plus forte ensuite

Une courbe de poussée propre à cette voiture remplace l'augmentation uniforme d'accélération :
facteur 0,94 sous 80 km/h, transition continue et sans cassure jusqu'à 1,20 à 200 km/h, puis ce
facteur reste constant. La loi habituelle de baisse de poussée à l'approche de la pointe reste
active. Les 315 km/h paramétrés ne changent pas.

La même courbe est lue par la physique, le profil de vitesse et la fiche du menu. Les autres
voitures reçoivent un facteur neutre. La courbe dépend de la vitesse, sans délai caché de turbo :
une courte pression rend immédiatement la poussée correspondante, et relâcher retrouve le frein
existant. Le jeu conserve son partage d'adhérence et sa mémoire de glisse arrière.
L'équilibre arrière est légèrement stabilisé (`mul.slide` 1,06 → 1,04) pour accompagner la poussée
plus forte sans augmenter autant la sensibilité au lever de pied en appui.

Contrôle droit avec la physique complète, direction nulle et pneus neufs :

| Mesure RS10 | 0.30.2 | 0.30.3 |
| --- | ---: | ---: |
| 0–100 km/h | 3,34 s | 3,55 s |
| 100–180 km/h | 3,07 s | 2,87 s |
| 180–240 km/h | 3,16 s | 2,64 s |

À 220 km/h, la poussée demandée devient supérieure à celle de la Ferrari 312T. En virage, elle
reste soumise aux pneus : maintenir cette poussée peut faire glisser l'arrière, et les petites
pulsations permettent de récupérer de la motricité.
[Mesures droites et capacités d'adhérence](mesures-droite.json).

## Choix et limites de validation

Deux réglages de Brabham et quatre courbes Renault ont été comparés sur Monaco, Spa, Monza,
Zandvoort et le Castellet. Les deux premières Renault perdaient trop de temps dans les relances
lentes : le creux est ramené à 6 %. Le réglage retenu équilibre caractère et rythme, sans chercher
à faire gagner les deux voitures sur tous les circuits.

Les simulations emploient le code du jeu, des pas de 1/120 s et des commandes gaz/relâchement.
La validation finale balaie les freins ×0,75 / ×1 / ×1,3 et deux graines. Les reprises brèves
comparent gaz tenus, pied levé et alternances de 60 / 120 ms depuis un même état de virage.
Les résultats de tours propres et bruts restent séparés : l'IA invalide déjà ses tours de Monaco
dans la référence 0.30.2. Le chronomètre brut de Monaco ne constitue donc pas une preuve de tour propre.

Les tests droits vérifient aussi que les moteurs et profils de vitesse des **23 autres voitures**
sont identiques à la référence, et que le freinage des **25 voitures** est conservé. Il ne s'agit
pas d'une validation sur un téléphone physique ni d'un classement universel des voitures.

```sh
node tools/caracteres-f1-test.js docs/caracteres-f1/mesures-droite.json
node tools/caracteres-f1-banc.js --final --out=/tmp/caracteres-validation.json
node tools/sprites-nouveaux-banc.js docs/nouvelles-voitures/geometrie.json
```

Le détail des essais et de la validation finale est conservé dans ce dossier. L'avis d'origine
de [GPT‑6 Astra](../avis-parametres-astra/README.md) reste daté de la version qu'il a étudiée.

### Résultats au frein normal

Meilleur tour propre sur deux tours, graine 42761 et même pilote automatique :

| Circuit | Brabham avant → après | Renault avant → après |
| --- | ---: | ---: |
| Monza | 73,08 → 72,89 s | 72,71 → 71,94 s |
| Spa | 97,73 → 97,63 s | 97,18 → 96,87 s |
| Zandvoort | 79,22 → 78,93 s | 79,98 → 79,39 s |
| Castellet | 81,68 → 81,47 s | 81,72 → 81,57 s |

La Renault gagne en reprise et en pointe observée ; la légère stabilisation aide aussi à conserver
de la vitesse dans les relances de Zandvoort. Elle reste derrière la Ferrari 312T de référence à
Monza (71,71 s). La Brabham gagne quelques dixièmes sans saut général de performance.
La marge de pilotage, la graine et le frein font varier les résultats : ce tableau décrit un
protocole précis, pas une promesse de temps au tour pour un joueur.

Sur les reprises de virage au même état, frein ×1 et graine 42761, les alternances de 60 ms
réduisent notamment le pic de dérive Renault de **24,9° à 4,0° à Spa** et de **26,0° à 11,3° à
Zandvoort**. Tous les 648 essais de reprise de la validation finale terminent sans incident.
Gaz tenus et alternances n'ont pas la même dose moyenne de gaz ou de frein : le résultat mesure
le geste réel du jeu, pas le seul effet d'une constante de pneu.

Données : [deux premiers essais](essais-initiaux.json), [deux courbes Renault suivantes](essais-progression.json),
[60 validations finales, 120 tours et 648 reprises](validation.json).

### Frein fort et incidents

Aux freins ×0,75 et ×1, les 32 essais hors Monaco bouclent deux tours sans incident. À ×1,3,
la Renault conserve une sensibilité au freinage en appui : deux incidents à Spa sur une des deux
graines et un au Castellet. La référence ×1,3 à Spa produisait respectivement un et deux incidents
sur les deux graines ; le réglage final en produit deux et zéro. Au Castellet, la référence n'en
produisait aucun. Ce petit échantillon ne prouve pas l'élimination de toute régression au frein fort.
Un frein très élevé doit rester un choix de pilotage, pas un réglage universellement plus facile.
[Contrôle de la référence](frein-fort-reference.json), [essais d'équilibre arrière](essais-equilibre-arriere.json).

À Monaco, 10 des 12 essais ne fournissent toujours aucun tour propre. Cette limite de l'autopilote
est conservée dans les résultats, séparément des quatre autres circuits.

Les 114 images ont été contrôlées ; seuls les huit sprites Lotus 79 / XJR‑9 changent d'apparence
par rapport à 0.30.2. Les URL de course et de sélection portent désormais la version du jeu, pour
éviter qu'un ancien PNG en cache masque la correction de largeur.
