# GT3 — 0.53.0

Dix nouveaux modèles, trois livrées chacun, **60 PNG** : vue orthographique de course nez à droite
et vue trois-quarts de sélection nez à gauche. Le jeu compte maintenant 35 modèles et 88 livrées
(les 25 modèles précédents avaient déjà 58 livrées dans cette version du dépôt).

[Planche des 30 livrées, rendue avec le moteur du jeu](planche.png) ·
[Porsche, les trois livrées](porsche-livrees.png) · [Menu PC](menu-pc.png) · [Menu mobile](menu-mobile.png).

## Livrées retenues et intégrées

Les trente références ont été choisies dans le [catalogue de recette](https://brunodrapi.github.io/Slot_car_racing/choix-livrees/).
Le [manifeste validé](selection-validee.json) conserve les photos, les codes et les crédits.
Chaque modèle garde trois livrées, dans l’ordre transmis par le joueur.

| Modèle | Première livrée | Deuxième livrée | Troisième livrée |
|---|---|---|---|
| Porsche 911 GT3 R (991) | POR1 — Pink Pig — Porsche GT Team | POR2 — Manthey Grello | POR6 — AO / Project 1 — Rexy |
| Ferrari 488 GT3 | FER1 — AF Corse — rouge tricolore | FER4 — Squadra Corse Garage Italia / Hublot | FER5 — SMP Racing |
| Lamborghini Huracán GT3 | LAM1 — Grasser Racing | LAM2 — FFF Racing / Roger Dubuis | LAM6 — Attempto / blueconsult |
| Audi R8 LMS | AUD1 — Belgian Audi Club / WRT | AUD4 — BWT Mücke | AUD7 — Magnus Racing |
| Mercedes-AMG GT3 | AMG1 — Mann-Filter Mamba | AMG2 — Haribo Racing | AMG4 — P1 Motorsports — dragon |
| BMW M6 GT3 | BMW1 — ROWE Racing | BMW3 — Falken Motorsports | BMW7 — BMW Team Schnitzer |
| Bentley Continental GT3 | BEN1 — Bentley M-Sport | BEN5 — Bentley Team ABT | BEN6 — Absolute Racing / Singha |
| Nissan GT-R Nismo GT3 | NIS1 — Nismo / GT Academy | NIS2 — KCMG | NIS3 — B-MAX NDDP |
| McLaren 650S GT3 | MCL1 — Tekno Autosports | MCL2 — Garage 59 | MCL3 — K-PAX Racing |
| Aston Martin V12 Vantage GT3 | AST4 — TF Sport | AST6 — R-Motorsport | AST8 — Aston Martin Racing — vert foncé et jaune |

Pink Pig et Rexy transposent les motifs des 911 RSR photographiées sur la carrosserie de la
991 GT3 R validée. Le rose et les pointillés rouges, les yeux et les dents de Rexy, la montre
FFF, l’ours Haribo, le dragon P1 et les damiers verts Garage 59 restent les motifs prioritaires.
L’Aston AMR vert foncé et jaune est sans numéro de course inventé.

Les dix nouvelles planches sources se trouvent dans `art-src/voitures/gt3/selection-validee/`.
Chacune contient trois paires : vue orthographique à gauche, vue de menu à droite.
Les [consignes et références de génération](selection-validee/generation.json) fixent les
couleurs de la photo choisie, y compris les Bentley ABT jaune/noir et Singha gris/jaune,
l’Audi Magnus gris/vert et la McLaren K-PAX jaune/noir.

`tools/pack-gt3.js` isole les six éléments de chaque planche, les cadre aux dimensions
validées et mesure les ancrages de pneus. Il ne peint pas les livrées. Les vues de dessus
restent à 420 × 200 pixels ; la hauteur du menu est conservée modèle par modèle.

## Règles graphiques et correction des ailes

Application des [règles de génération existantes](../sprites-cartoon/README.md#règles-pour-les-prochaines-générations) :
contour extérieur épais, trois à cinq couleurs principales, un niveau d'ombre, détails simplifiés,
silhouettes iconiques légèrement exagérées. Les nouvelles variantes partent des deux sprites validés et des trois photos sélectionnées,
puis sont contrôlées par recouvrement des silhouettes.

La correction demandée concerne les **30 vues de dessus** : ailes et garde-boue avant/arrière
complets, surfaces peintes au-dessus des roues arrière, aucun gros bloc de pneu remplaçant une
aile. Les pneus arrière sont dessinés sous la carrosserie par le moteur existant, à angle fixe,
avec environ **deux à trois pixels visibles** pour une voiture de 420 pixels de long. Chaque
sprite possède ses propres ancrages avant et arrière. Les pneus avant braquent ; les vues de
menu conservent toutes leurs roues. Les dimensions de collision restent indépendantes des dessins.

Les planches de référence initiales sont conservées dans le dossier de travail
`art-src/voitures/gt3/`, et les dix nouvelles sources de peinture dans `selection-validee/`. Le [manifeste](sources.json) permet de rejouer l'isolation et le cadrage ;
aucune peinture n'est faite par le script de découpage. Le détourage retire les halos semi-transparents
des sources générées. Les angles sont obtenus par génération, sans miroir des lettrages.

## Intégration et mesures

GT3 est une catégorie indépendante, disponible dans les filtres, la sauvegarde et le salon
multijoueur. L'IA court dans la catégorie de la voiture choisie. Les noms réels demandés sont
conservés pour ces dix modèles ; les noms historiques du jeu sont inchangés.

Même largeur de route et même cadrage que le plateau existant. Les pointes 287–293 km/h sont des
**réglages de jeu**, pas des vitesses constructeur : `tools/fiches.json` les indique non vérifiées.
Les caractéristiques moteur distinguent V6, flat-six, V8, V10 et V12 ; les enregistrements existants
sont réutilisés, aucun nouvel enregistrement sonore propre aux GT3 n'est fourni.

Le [tour idéal sur 13 circuits](equilibre-ideal.json) donne un étalement moyen interne de **0,33 %**.
Les [30 simulations](simulation.json), dix voitures sur Monza/Spa/Zandvoort, deux tours chacune,
finissent toutes sans sortie. Ce sont des simulations déterministes, pas une validation des
performances réelles ou un équilibrage exhaustif entre joueurs.

Les listes serveur des records et la validation SQL des statistiques sont mises à jour dans les
sources. Leur mise en service distante demande leur déploiement habituel ; la recette publie les nouvelles livrées, tandis que les fonctions Supabase gardent leur
déploiement séparé.

## Vérification reproductible

```sh
node tools/pack-gt3.js
node tools/gt3-banc.js
node tools/serveur-listes.js
node --require /workspace/cloud-setup/system-chromium.cjs tools/e2e-gt3.js
node --require /workspace/cloud-setup/system-chromium.cjs tools/e2e-cartoon.js /tmp/gt3-cartoon
node --require /workspace/cloud-setup/system-chromium.cjs tools/e2e-categories.js /tmp
npm run build
```

[Mesures de géométrie](geometrie.json) · [Contrôle des ailes/pneus et des fichiers](verification-assets.json) ·
[Parcours navigateur PC/mobile](verification-navigateur.json).

Les 25 modèles précédents, leurs données résolues et leurs PNG sont conservés à l'identique.
Le vieux `sprites-nouveaux-banc.js` contient toutefois une attente déjà périmée sur la hauteur de
`250gto_francorchamps.png` (225 px contre 221 pour la base) ; cette différence préexistante ne
concerne pas les GT3. Les contrôles GT3 et le contrôle du rendu de toutes les livrées sont séparés.
