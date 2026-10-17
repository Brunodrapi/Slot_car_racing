# Références avant élargissement

Ces 24 PNG sont les dessins précédant l'élargissement demandé par Bruno : neuf F1 et trois
livrées de la Jaguar XJR‑9, deux vues chacune. Les PNG utilisés dans le jeu sont dans `sprites/`.

`node tools/elargir-sprites.js --factor=1.25` reprend toujours ces sources, pour éviter les
étirements cumulatifs. L'axe transversal est la hauteur du sprite de course (nez à droite) ; les
vignettes utilisent une matrice orientée selon la perspective. Aucun modèle n'est régénéré.
Les corrections par modèle sont prioritaires : Lotus 79 et XJR‑9 à +10 %, autres F1 à +25 %.
