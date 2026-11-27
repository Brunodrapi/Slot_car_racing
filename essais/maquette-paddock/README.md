# La maquette des écrans téléphone : paddock, championnat, multijoueur

Les écrans seulement, sans jeu derrière : on clique partout, aucune course ne part. C'est
l'option 1 de l'audit des écrans téléphone : un paddock sur un seul écran, et cinq panneaux.

- **Paddock** : la carte du circuit (« i » pour sa fiche), la carte de la voiture, les flèches de livrée,
  trois pastilles (tours en « − + », difficulté, jour/nuit), « Plus de réglages », « Chronos et fiche du
  circuit », Championnat et EN PISTE en bas.
- **Circuit** : les 14 circuits en grille, leur difficulté en mots (Facile, Moyen, Difficile, Extrême,
  aux couleurs des pistes de ski). Un toucher choisit et referme.
- **Garage** : la voiture en grand, ses livrées en vignettes, cinq barres sur une échelle commune aux
  35 voitures (un trait rouge marque la voiture qu'on avait en ouvrant), les catégories, la grille.
- **Plus de réglages** : dégâts (interrupteur), adversaires (« − Auto + »), freinage (liste), Régler.
- **Difficulté** : les cinq niveaux, une phrase sous chacun (à écrire pour de bon).
- **L'écran du circuit** : quatre chiffres, « Plus de détails », les chronos par catégorie.

- **Championnat** (la pastille en bas du paddock, en course rapide) : le barème de la catégorie, le
  calendrier (jusqu'à 10 courses : « + Ajouter un circuit », les tours de chacune en « − + », « ⋯ » pour
  avancer, reculer ou retirer), les séances d'essais et de qualifications (à la minute près), ta place sur la grille.
  « Lancer » : le paddock prend la course du calendrier (« Course 1/3 », tours figés) ; EN PISTE
  propose « Simuler l'arrivée », qui donne les points, puis le classement.
- **Multijoueur** (au menu) : créer une table, ou la rejoindre avec un code de quatre caractères
  (« Regarder » pour suivre sans piloter). La table est le paddock, avec au-dessus la barre des
  pilotes (« ✓ » quand ils sont prêts ; touchée, la liste, le code à partager et la connexion de
  chacun). L'hôte change le circuit en touchant sa carte, les tours (course et duel), le format, la
  catégorie des voitures et le moment par les pastilles, l'IA et les dégâts dans « Plus de réglages » ; les autres lisent les mêmes
  pastilles, et « Réglages de la course » leur montre le reste. Chacun garde sa voiture et son
  freinage. En bas : Championnat (hôte), Prêt et Départ. Les amis
  sont simulés : à une table créée, Léa et Marco arrivent puis se déclarent prêts ; à une table
  rejointe, l'hôte lance la course quand tu es prêt.

Les quatre modes s'ouvrent du petit menu. Une feuille
se ferme par « Fermer », d'un geste vers le bas, en touchant le fond, ou par le retour du navigateur.
Les choix restent dans le navigateur.

Les circuits, voitures, livrées, fiches et images sont ceux du jeu, tirés par `outils/exporte.cjs`
(à relancer quand le jeu change). Les chronos sont des exemples, calculés depuis la longueur du
circuit et la vitesse de la voiture ; les arrivées du championnat et les amis du multijoueur sont simulés. Les images du jeu sont lues à la racine du site (`../../`).

`outils/essai.cjs` passe chaque écran sur un iPhone 13 émulé, le photographie et le mesure comme
l'audit : le paddock tient sur un écran, 14 cibles toutes d'au moins 44 points, une cinquantaine de mots,
aucun texte sous 13 px.
