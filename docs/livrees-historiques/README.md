# Livrées historiques — hybrid

Deux variantes supplémentaires pour chacun des cinq modèles qui n’avaient qu’une livrée. Les illustrations de course et de sélection sont générées à partir des références ci-dessous, puis découpées et adaptées aux dimensions des sprites existants. Cliquer de nouveau sur la voiture sélectionnée fait défiler les trois livrées.

Ce sont des adaptations illustrées sur les carrosseries du jeu : les versions historiques de carrosserie peuvent différer (Countach Safety Car, Porsche 935 K2/K3, Corvette Greenwood). Les petits marquages sont interprétés par la génération d’images. Les performances restent celles du modèle du jeu.

| Modèle | Variante | Référence |
| --- | --- | --- |
| Countach | Rain-X ART JLOC n°88, JGTC 1994 | [Spark](https://www.sparkmodelshop.com/de/rain-x-art-lamborghini-countach-no.88-gt1-jgtc-1994-s.-ikezawa-t.-wada/sj150-de) |
| Countach | Direction de course, Monaco 1983 | [Scalextric C4329](https://uk.scalextric.com/products/lamborghini-countach-1983-monaco-gp-safety-car-c4329) |
| GT40 MkII | Miles/Hulme n°1, Le Mans 1966 | [Résultats et photos](https://en.wikipedia.org/wiki/1966_24_Hours_of_Le_Mans) |
| GT40 MkII | McLaren/Amon n°2, Le Mans 1966 | [Résultats et photos](https://en.wikipedia.org/wiki/1966_24_Hours_of_Le_Mans) |
| Porsche 935 | Jägermeister-Kremer n°16 | [Photo du véhicule](https://commons.wikimedia.org/wiki/File:Porsche_935_Turbo_K3_Kremer_Racing_(6794053122).jpg) |
| Porsche 935 | Vaillant-Kremer n°51 | [Kremer K2](https://www.stuttcars.com/1977-kremer-k2/) |
| Corvette C3 | Spirit of Le Mans n°76 | [IMSA](https://www.imsa.com/news/2023/03/10/spirit-of-le-mans-corvette-honored-at-amelia-island-concours-delegance/) |
| Corvette C3 | BFGoodrich Stars and Stripes n°49 | [BFGoodrich](https://www.bfgoodrichracing.com/gallery/bfgoodrich-greenwood-corvette/) |
| Mazda 787B | Efini n°18, SWC Autopolis 1991 | [HPI 997](https://www.hpiracing.com/en/part/997) |
| Mazda 787B | Renown n°202, JSPC 1991 | [HPI 8039](https://www.hpiracing.com/en/part/8039) |

La Mazda n°56 du Mans 1991 a été écartée : c’était une 787, pas une 787B.

## Vérification

- `node --require /workspace/cloud-setup/system-chromium.cjs tools/e2e-livree.js /tmp` : aucune faute, aucune erreur JavaScript ; 54 images chargées, cycles complets des neuf modèles, sauvegarde et sprite de course vérifiés.
- 20 nouveaux PNG : transparence, dimensions identiques aux originaux, contenus distincts.
- [Planche des dix variantes](apercu.png).

## Méthode de conservation de la carrosserie

Pour les prochaines générations, convertir les sprites d’origine en noir et blanc en conservant leur transparence, puis les fournir comme référence de géométrie prioritaire. Les photos historiques servent à la peinture uniquement. Conserver caméra, silhouette, empattement, roues, vitrage et aileron de la voiture de base.

En sortie, contrôler séparément les dimensions du PNG et le rectangle réellement occupé par la voiture, puis comparer les silhouettes à celle du sprite d’origine. Avoir deux fichiers de même taille ne garantit pas des voitures de mêmes proportions. Le cadrage final doit reprendre le rectangle occupé par la référence, et une différence de carrosserie visible doit entraîner une correction.

Correction Countach (0.28.2) : les quatre sprites ont été régénérés sur les références d’origine en noir et blanc. Dimensions du fichier et rectangle occupé identiques aux originaux : 395 × 203 en course, 420 × 349 en sélection. Recouvrement des silhouettes (intersection / union des pixels d’alpha ≥ 32) : environ 98 % en course et 93 % en sélection ; il subsiste donc de petites différences de dessin. Les mesures détaillées sont dans `countach-geometrie.jsonl`. La variante Monaco conserve volontairement la carrosserie et l’aileron de base, sans rampe lumineuse, pour respecter la silhouette demandée.
