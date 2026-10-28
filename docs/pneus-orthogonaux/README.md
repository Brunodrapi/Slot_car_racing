# Pneus vus à 90° — 0.52.40

Correction des six F1 qui avaient encore des extrémités de pneus ovales : Arrow 23, Wedge 72, Fan 46, Windsor 07, Le Coq Bleu 11 et Turbo 10. Les trois autres F1 avaient été redressées en 0.52.39. Les trois Kitsune abandonnent les stries au profit de pneus slicks rectangulaires.

Toutes les roues dessinées par le moteur utilisent désormais le même principe : rectangle aux coins légèrement adoucis, noir sur les extrémités dans le sens de roulement, centre gris sombre, aucun reflet latéral donnant l'impression d'une jante. Vue orthographique ; les roues avant continuent naturellement de braquer en virage.

Sur les trois Stallone, les pneus arrière sont retirés du sprite et dessinés sous les ailes avec un placement spécifique, rapproché du centre de la voiture. Les dimensions PNG sont conservées, avec une marge transparente de 8 pixels en haut et en bas pour maintenir le cadrage de la carrosserie. Aucun changement de physique.

## Planches du rendu réel

- [Sixpence, Dodici T, Arrow 23 et Ground 79](roues-1.png)
- [Wedge 72, Fan 46, Windsor 07 et Le Coq Bleu 11](roues-2.png)
- [Turbo 10 et Stallone](roues-3.png)
- [GT](roues-4.png)
- [Longnose et Kitsune](roues-5.png)
- [Prototypes](roues-6.png)
- [Arrow 68](roues-7.png)

Chaque planche montre les roues droites, puis les roues avant braquées dans les deux sens. La dernière colonne représente l'illustration trois-quarts du menu, qui conserve volontairement sa perspective.

## Contrôles

Inspection de la planche des 57 sprites, puis test `tools/e2e-cartoon.js` sur les 57 livrées / 25 modèles : chargement, braquage, ombres sans double opacité, roues F1 au-dessus de la suspension. Résultats dans `verification.json`. Dimensions des 12 sprites remplacés dans `dimensions.json`.
