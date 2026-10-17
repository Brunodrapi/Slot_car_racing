# Sprites des douze nouvelles voitures

Illustrations générées pour le build hybrid : **52 PNG**, avec une vue de dessus en course et une
vue en trois quarts au menu pour chacune des 26 décorations. Les sept nouvelles GT/prototypes ont
trois livrées ; les cinq nouvelles F1 ont chacune leur livrée historique. Les autres modèles et
leurs livrées sont conservés. Le plateau complet propose désormais 57 décorations et 114 images.
À la demande de Bruno, les neuf F1 et les trois livrées de la XJR‑9 ont ensuite été élargies de
25 % dans le sens transversal, sans génération supplémentaire de leur dessin. Cela reprend
également les huit sprites des quatre F1 déjà présentes avant les ajouts de Claude.

- [Les 21 livrées GT et prototypes](gt-protos.png).
- [Les neuf F1](f1.png).
- [F1 : avant / après élargissement](f1-avant-apres.png).
- [XJR‑9 : avant / après sur les trois livrées](xjr9-avant-apres.png).
- [Contrôle des dimensions et silhouettes](geometrie.json).
- [Avis indépendant sur les paramètres, par GPT‑6 Astra](../avis-parametres-astra/README.md).

## Peintures et références

Les décorations sont des adaptations dessinées : les petits logos sont interprétés et la
carrosserie reste celle du modèle du jeu. Une inspiration ne prétend pas avoir couru telle quelle.
Les livrées ne modifient pas les performances ; les pointes historiques du jeu dépendent de la
version et de la configuration retenues dans `tools/fiches.json`.

| Modèle | Décoration de base | Variante 2 | Variante 3 |
| --- | --- | --- | --- |
| Ferrari 250 GTO | Rosso Corsa, rouge | Francorchamps, jaune | Rob Walker, inspiration bleue et blanche |
| Jaguar Type E | British Racing Green | Cunningham, blanc et bandes bleues | Écurie Écosse, inspiration bleue |
| Datsun 240Z | BRE n°46, blanc et rouge | Bob Sharp, inspiration bleue et blanche | Dunlop, hommage jaune et noir |
| Porsche 962 | Rothmans n°17, bleu et blanc | Shell/Dunlop n°7, jaune et rouge | Jägermeister, orange |
| Jaguar XJR‑9 | Silk Cut n°2, violet et blanc | Castrol IMSA, vert et blanc | JPS, hommage noir et or |
| Ferrari 330 P4 | Daytona n°23, rouge | Équipe Nationale Belge, jaune | David Piper, vert |
| Ford P68 | Alan Mann, rouge et or | Gulf, hommage bleu et orange | Dunlop, hommage jaune et noir |

Les cinq monoplaces : Lotus 72 JPS/Fittipaldi n°8, Brabham BT46B Parmalat/Lauda n°1,
Williams FW07 Saudia/Jones n°27, Ligier JS11 Gitanes/Laffite n°26, Renault RS10 Elf/Jabouille n°15.

Références consultées pour les formes et les décorations :

- [Lotus 72](https://en.wikipedia.org/wiki/Lotus_72), [BT46B](https://en.wikipedia.org/wiki/Brabham_BT46),
  [FW07](https://en.wikipedia.org/wiki/Williams_FW07), [JS11](https://en.wikipedia.org/wiki/Ligier_JS11),
  [RS10](https://en.wikipedia.org/wiki/Renault_RS10). La photo de Lotus montre une version rouge de
  1971 et celle de Williams une FW07C : elles servent de contexte de forme ; les peintures du jeu
  sont celles indiquées ci-dessus.
- [Ferrari 250 GTO](https://en.wikipedia.org/wiki/Ferrari_250_GTO),
  [250 GTO Francorchamps](https://supercarnostalgia.com/blog/one-to-buy-ex-ecurie-francorchamps-1962-ferrari-250-gto).
- [Jaguar Type E](https://en.wikipedia.org/wiki/Jaguar_E-Type),
  [Cunningham Lightweight](https://cars.bonhams.com/auction/27509/lot/60/1963-jaguar-e-type-lightweight-competition-chassis-no-s850664-engine-no-ra-1349-9s/).
  Écurie Écosse transpose son identité de course sur la carrosserie du jeu.
- [Datsun S30](https://en.wikipedia.org/wiki/Nissan_S30),
  [décoration BRE](https://www.brelegacy.com/mm5/merchant.mvc?Screen=PROD&Product_Code=090B02&Category_Code=decals_sub_240Z).
- [Porsche 962](https://en.wikipedia.org/wiki/Porsche_962),
  [962‑007 Shell/Dunlop](https://www.historicporsche.com/13/962-collection/porsche-962-007-works).
- [Jaguar XJR‑9 et ses programmes Silk Cut / Castrol](https://en.wikipedia.org/wiki/Jaguar_XJR-9).
  La variante noire et or est un hommage à l'identité JPS des Lotus ; elle n'est pas une XJR‑9
  d'usine historique.
- [330 P4 verte David Piper, Scalextric C4491](https://uk.scalextric.com/products/330-p4-green-david-piper-c4491).
- [Ford P68](https://en.wikipedia.org/wiki/Ford_P68),
  [P68 Gulf de slot, NSR](https://www.slotcar-union.com/en/cars/27558-nsr-p68-gulf-livery-blue-n07.html).
  Les variantes Gulf et Dunlop sont des hommages ; la P68 historique est la rouge et or Alan Mann.

## Conservation des proportions

La première génération établit la carrosserie et les deux vues. Les variantes utilisent ces deux
sprites **en noir et blanc, avec transparence**, comme références prioritaires de géométrie.
`tools/pack-nouvelles-voitures.js` isole chaque voiture avant le recadrage : un voisin ne peut pas
rester dans le rectangle d'une autre illustration. Les vues de course sont orientées nez à droite
par rotation, jamais par miroir qui inverserait les lettrages.

La longueur horizontale du PNG est de 420 pixels. Après élargissement, les vues de course mesurent
420 × 256 pour les F1 et 420 × 250 pour la XJR‑9 ; les autres GT/prototypes restent à 420 × 200.
La hauteur des vignettes suit leur perspective. Chaque variante reprend les
dimensions du fichier et le rectangle occupé de sa base. Le contrôle de silhouette compare ensuite
les pixels d'alpha ≥ 32 : mêmes dimensions seules ne suffisent pas. Les petites différences de
trait sont conservées et mesurées ; les carrosseries qui changent nettement doivent être régénérées.

L'élargissement des 24 sprites F1/XJR‑9 est réalisé par `tools/elargir-sprites.js`. Vue de dessus :
longueur conservée, hauteur ×1,25. Au menu : transformation affine perpendiculaire à l'axe de la
voiture, puis retour à une largeur de fichier de 420 pixels. Les trois XJR‑9 utilisent la même
matrice et le même cadre. Les sources avant transformation sont conservées dans
`art-src/voitures/gabarits-trappus/` ; rejouer la commande ne cumule pas l'étirement.
[Mesures avant/après](elargissement.json). Les paramètres physiques et les collisions sont conservés.

Sur les quatorze variantes ajoutées, le recouvrement des silhouettes est d'au moins **95,8 % en
course et 94,2 % en sélection**. Les dimensions et rectangles occupés sont identiques à ceux de
la base correspondante.

## Vérification

```sh
node tools/sprites-nouveaux-banc.js docs/nouvelles-voitures/geometrie.json
node tools/elargir-sprites.js
node tools/apercu-nouvelles-voitures.js
node tools/e2e-livree.js /tmp
node tools/e2e-f1.js /tmp
node tools/e2e-categories.js /tmp
```

Avec Chromium installé par le système, les trois commandes navigateur peuvent utiliser
`node --require /workspace/cloud-setup/system-chromium.cjs ...`. Les résultats du passage effectué
pour cette livraison figurent dans `validation.txt`.

Les anciens SVG restent des esquisses éditables ; la commande de dessin vectoriel ne remplace plus
les illustrations PNG existantes sans `--force-vector`.
