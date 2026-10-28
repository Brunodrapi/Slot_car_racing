# Sprites vus du dessus — 0.52.39

Les trois F1 Sixpence Hexa, Purosangue Dodici T et Bumblebee Ground 79 sont redressées pour réduire la perspective latérale. Les trois livrées de Stallone Furioso et les trois de Kitsune Zeta 240 montrent désormais la bande de roulement arrière, sans jante ni flanc de roue oblique.

Les pneus avant mobiles de Furia 40, Stallone, Gran Corsa, Nightfall et Langheck sont rentrés sous les ailes avec des dimensions propres aux carrosseries. Longnose et Aero 62 reçoivent deux pneus arrière fixes dessinés sous la carrosserie, avec un léger dépassement. Le nom « Aero 72 » de la demande a été interprété comme Aero 62, le prototype existant.

Les livrées, dimensions PNG, paramètres physiques et collisions sont conservés. Les illustrations trois-quarts du paddock restent inchangées : cette correction concerne les vues en course.

## Captures du moteur réel

- [F1 : roues droites et braquées](f1.png)
- [Furia 40 et Stallone](gt.png)
- [Longnose, Kitsune et Langheck](longnose-kitsune.png)
- [Aero 62 et Nightfall](prototypes.png)

Chaque planche présente le rendu en course avec roues droites, braquées à gauche et à droite ; la dernière colonne est l'illustration du paddock.

## Vérification

`tools/e2e-cartoon.js` : 57 livrées / 25 modèles, chargement des sprites, braquage, ombres sans double opacité et couverture des essieux F1 par les roues. Résultats dans [verification.json](verification.json). Les dimensions des neuf images régénérées sont consignées dans [dimensions.json](dimensions.json), les originaux dans `avant/`.
