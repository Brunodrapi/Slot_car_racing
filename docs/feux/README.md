# Feux selon la carrosserie — 0.55.1

Les 35 modèles ont des points d’attache propres, mesurés dans le repère de leur dessin : les
phares ronds des Breithüft et Moggy, les rectangles des anciennes Howitzer et Stallone, les
barrettes des GT3, les quatre optiques des Bramley, les courbes de la McHaggis Blade et les
projecteurs multiples des prototypes. Les proportions de chaque livrée sont prises en compte.
Les F1 restent sans phares avant et gardent leur feu stop central. Les projections stop de jour
reprennent les mêmes emplacements arrière que la nuit. La physique ne change pas.

- [Galerie des 35 voitures : optiques, nuit et freinage](index.html)
- [GT3](phares-gt3.png) · [GT anciennes](phares-gt.png) · [Prototypes](phares-proto.png) · [F1](phares-f1.png)
- [Planche des modèles et de leurs feux](profils-feux.png)
- [Résultats pour les 35 voitures et 88 livrées](verification.json)

La planche montre les optiques lumineuses sur les carrosseries de jour pour contrôler leurs
positions ; les petits points rouges repèrent les sources des cônes arrière. Les sources avant
sont vérifiées à l’intérieur des dessins sur toutes les livrées. Les cônes, le freinage renforcé,
les dégradés et l’absence de halo joueur sont vérifiés dans `tools/e2e-night.js`.

La Purosangue Gran Corsa reprend la largeur et le diamètre visuels des pneus arrière pour ses
pneus avant, avec des bords arrondis, sur les trois livrées. Les points d’essieu, la direction et
les caractéristiques de conduite ne changent pas. [Comparaison avant/après](gran-corsa-pneus.png).

Les quatre nouvelles planches sont reproduites par `tools/visual-car-lights.js` avec les vrais
sprites et le compositeur `NightLighting` du jeu. Elles montrent les faisceaux complets à exposition
identique avec et sans freinage, sur un fond de piste sans lampadaires. Le détail des optiques
avant est agrandi séparément pour rendre leurs formes lisibles.
