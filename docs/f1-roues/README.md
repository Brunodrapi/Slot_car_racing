# Les roues des F1, d'aplomb (0.52.71)

> « Sur au moins une F1 les roues arrière ne font pas la même taille et les roues avant ne sont pas
> centrées ! Il faut que tu révises tous les modèles F1 » — Bruno

## Ce qui n'allait pas

Les neuf F1 ont une illustration vue de dessus (`sprites/top/<id>.png`, avant vers la droite), avec
les roues arrière peintes dedans et les roues avant posées par le jeu sur les moyeux dessinés
(`registerWheelSprite`, js/cars.js). Quatre défauts s'y ajoutaient :

1. **la carrosserie sous le milieu du cadre**, de 2 à 10 px (sur 256), alors que les roues arrière y
   étaient restées centrées et souvent rognées par le bord : l'une sortait plus loin de la carrosserie
   que l'autre (jusqu'à 17 px sur l'Arrow 23) et paraissait plus grosse ;
2. **les roues avant de travers**, héritant de moyeux dessinés de travers : 7 px sur la Windsor 07, 5
   sur la Dodici T, 6 sur la Sixpence Hexa ;
3. **le dessin penché** : l'avant plus bas que l'arrière. Des roues alignées sur l'axe du jeu, qui est
   horizontal, tombent alors trop près de la carrosserie d'un côté à l'avant et de l'autre à l'arrière ;
4. **le dessin cintré** : la carrosserie droite, mais les ailerons — et le nez de la Fan 46 — décalés
   du même côté.

La 0.52.71 corrigeait les deux premiers ; « sur la Windsor et Le Coq les roues avant ne sont toujours
pas équilibrées, Purosangue pareil ; sur plusieurs voitures les roues arrière ne dépassent pas
équitablement du châssis » : c'étaient les deux derniers (0.52.72).

| voiture | inclinaison | | décalage arrière / nez / aileron avant | échelle |
|---|---|---|---|---|
| Sixpence Hexa | +1.63° | redressé | +0.0 / +0.0 / +0.0 px | ×0.9825 |
| Purosangue Dodici T | +1.82° | redressé | +0.0 / +0.0 / +0.0 px | ×0.9813 |
| McHaggis Arrow 23 | +1.68° | redressé | -2.5 / -2.9 / -3.0 px | ×0.9825 |
| Bumblebee Ground 79 | +0.24° | — | +0.0 / +0.0 / +0.0 px | ×1.0 |
| Bumblebee Wedge 72 | +0.93° | redressé | +0.0 / +0.0 / +0.0 px | ×0.9894 |
| Boomerang Fan 46 | +1.46° | redressé | -2.8 / -6.9 / -7.0 px | ×0.9848 |
| Windsor 07 | +1.38° | redressé | +0.0 / +0.0 / +0.0 px | ×0.9848 |
| Le Coq Bleu 11 | +1.25° | redressé | +0.0 / -2.5 / -2.7 px | ×0.9871 |
| Somua Turbo 10 | +0.17° | — | -5.5 / -3.4 / -4.0 px | ×1.0 |

L'inclinaison est la pente de Theil-Sen du milieu de la silhouette, colonne par colonne, roues arrière
ôtées ; sous 0,3°, le dessin n'est pas tourné (tourner adoucit les traits). Le décalage des ailerons et
du nez est lu après redressement, par rapport au milieu de la carrosserie ; sous 1,5 px, rien.

## Ce qui change

`python3 tools/f1-roues.py`, pour chaque F1, en repartant des images d'origine
(`art-src/voitures/f1-roues/`) :

1. **redressé** : tourné de son inclinaison, à quadruple résolution et en alpha prémultiplié, puis ramené
   à la largeur d'origine — 1 à 2 % plus petit — pour que les coins des ailerons ne sortent pas du cadre ;
2. **sans roues arrière** : seulement leurs pixels de pneu (gris très sombre et sans couleur, contour et
   reflet compris), jamais ce qui borde une pièce de couleur — le contour d'un aileron posé sur le pneu
   reste à l'aileron ;
3. **décintré** : l'aileron arrière ramené d'un bloc sur le milieu de la carrosserie, le nez et l'aileron
   avant en pente douce ; la carrosserie ne bouge pas (entre les deux, les bras de suspension et les
   rétroviseurs ne sont pas symétriques : les suivre ferait onduler les flancs) ;
4. **recentré** : l'axe de la carrosserie au milieu du cadre ; les dimensions des images ne changent pas ;
5. **quatre roues dessinées par le jeu** (`drawTires`, js/carart.js), symétriques autour de l'axe, écrites
   par le script entre les repères `<f1-roues>` de js/cars.js :
   - arrière : la même taille des deux côtés (la moyenne des deux mesurées), au plus petit des deux
     écarts intérieurs pour que la roue rejoigne toujours la suspension dessinée ; sous la carrosserie ;
   - avant : les moyeux d'avant, tournés et décintrés avec le dessin, à leur écart moyen ; au-dessus de
     la suspension.

Résultat, mesuré sur les images finales : l'aileron arrière, les pontons, le nez et l'aileron avant de
chaque F1 sont à 1,5 px au plus du milieu du cadre, qui est l'axe des roues.

Les roues arrière ont désormais le dessin des roues avant (celui de la 0.52.40, « Pneus vus à 90° »), au
lieu de celui de l'illustration.

En passant, l'ombre : elle était découpée hors des pneus par un seul « pair-impair » sur tous les pneus à
la fois, qui la rouvrait là où deux pneus se chevauchent — les deux roues avant d'un même côté de la
Sixpence Hexa, en braquant. Elle est maintenant découpée pneu par pneu (`drawCarShadow`).

## Avant / après

Rendu par le moteur du jeu (`drawCarModel`), roues droites ; la ligne bleue est le centre de la voiture.

![Boomerang Fan 46, Purosangue Dodici T, Le Coq Bleu 11](avant-apres-1.webp)
![Bumblebee Wedge 72, Bumblebee Ground 79, McHaggis Arrow 23](avant-apres-2.webp)
![Somua Turbo 10, Sixpence Hexa, Windsor 07](avant-apres-3.webp)

## Contrôles

- `tools/e2e-cartoon.js` : 58 livrées, braquage dans les deux sens, une seule couche d'ombre sous les
  pneus, roues F1 au-dessus de la suspension, nombre de roues directrices.
- `gabarits.json` : les mesures et les gabarits calculés, voiture par voiture.
