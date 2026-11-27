# La maquette du paddock téléphone

Les écrans seulement, sans jeu derrière : on clique partout, aucune course ne part. C'est
l'option 1 de l'audit des écrans téléphone : un paddock sur un seul écran, et cinq panneaux.

- **Paddock** : la carte du circuit (« i » pour sa fiche), la carte de la voiture, les flèches de livrée,
  trois pastilles (tours en « − + », difficulté, jour/nuit), « Plus de réglages », « Chronos et fiche du
  circuit », Championnat et EN PISTE en bas.
- **Circuit** : les 14 circuits en grille. Un toucher choisit et referme.
- **Garage** : la voiture en grand, ses livrées en vignettes, cinq barres sur une échelle commune aux
  35 voitures (un trait rouge marque la voiture qu'on avait en ouvrant), les catégories, la grille.
- **Plus de réglages** : dégâts (interrupteur), adversaires (« − Auto + »), freinage (liste), Régler.
- **Difficulté** : les cinq niveaux, une phrase sous chacun (à écrire pour de bon).
- **L'écran du circuit** : quatre chiffres, « Plus de détails », les chronos par catégorie.

Les trois modes (course rapide, contre-la-montre, entraînement) s'ouvrent du petit menu. Une feuille
se ferme par « Fermer », d'un geste vers le bas, en touchant le fond, ou par le retour du navigateur.
Les choix restent dans le navigateur.

Les circuits, voitures, livrées, fiches et images sont ceux du jeu, tirés par `outils/exporte.cjs`
(à relancer quand le jeu change). Les chronos sont des exemples, calculés depuis la longueur du
circuit et la vitesse de la voiture. Les images du jeu sont lues à la racine du site (`../../`).

`outils/essai.cjs` passe chaque écran sur un iPhone 13 émulé, le photographie et le mesure comme
l'audit : le paddock tient sur un écran, 14 cibles toutes d'au moins 44 points, une cinquantaine de mots,
aucun texte sous 13 px.
