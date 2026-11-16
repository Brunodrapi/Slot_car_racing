# Kitsune Zeta 240 et Purosangue Freccia — 0.56.1

Les trois livrées de chaque modèle ont des ailes arrière peintes et continues au-dessus des pneus.
Les épaules de la Freccia sont plus larges et arrondies, comme sur la référence de la 330 P4 fournie.
Les pneus arrière sont désormais dessinés sous la carrosserie ; seul un fin bord reste visible.
Les pneus avant restent mobiles et passent sous les ailes au braquage.

- [Comparaison des six livrées, avant / après / braquage](avant-apres.png)
- [Contrôles des six livrées et des trois Kitsune Raijin](verification.json)
- [Mesures et sources des dessins](geometrie.json)
- [Galerie des phares actualisée](../feux/index.html)

Les carrosseries sont retouchées avec le générateur d’images en reprenant les trois sprites
d’origine de chaque modèle. Les atlas et les originaux sont conservés dans
`art-src/voitures/ailes-kitsune-freccia/`. L’extraction des trois silhouettes utilise
`elements()` de `tools/pack-nouvelles-voitures.js` ; seul le cadrage/redimensionnement en 420 × 200
est automatisé, sans repeindre les pixels. Les images du paddock conservent leurs ailes complètes.

`tools/e2e-fenders.js` mesure le dépassement des pneus arrière au niveau de l’essieu dans le
rendu du jeu (1 à 3 pixels à l’échelle de 420 pixels), vérifie la présence de peinture au-dessus
des roues et contrôle le braquage dans les deux sens. Les trois Raijin ont déjà des ailes
complètes et un dépassement de 2 à 3 pixels : leurs images sont conservées.
`tools/e2e-car-lights.js` contrôle les sources lumineuses sur les 88 livrées du plateau.
Les dimensions des PNG, caractéristiques physiques et collisions restent identiques.
