# La maquette des écrans téléphone : paddock, championnat, multijoueur

Les écrans seulement, sans jeu derrière : on clique partout, aucune course ne part. C'est
l'option 1 de l'audit des écrans téléphone : un paddock sur un seul écran, et cinq panneaux.

- **Paddock** : la carte du circuit (le chrono en haut à gauche pour sa fiche et ses chronos), la carte de
  la voiture, les flèches de livrée, trois pastilles (tours en « − + », difficulté, jour/nuit), et en bas
  « Réglages » et EN PISTE. La course rapide est une seule course. Le chrono et « Réglages » sont sur tous
  les écrans de course : course rapide, championnat, contre-la-montre, entraînement, table.
- **Circuit** : les 14 circuits en grille, leur difficulté en mots (Facile, Moyen, Difficile, Extrême,
  aux couleurs des pistes de ski). Un toucher choisit et referme.
- **Garage** : la voiture en grand, ses livrées en vignettes, cinq barres sur une échelle commune aux
  35 voitures (un trait rouge marque la voiture qu'on avait en ouvrant), les catégories, la grille.
- **Réglages** (le bouton en bas) : dégâts (interrupteur), adversaires (« − Auto + »), freinage (liste), Régler.
- **Difficulté** : les cinq niveaux, une phrase sous chacun (à écrire pour de bon).
- **L'écran du circuit** (le chrono de la carte) : quatre chiffres, « Plus de détails », les chronos par catégorie.

- **Championnat** (un mode du menu, qui dit « En cours · course 2/3 » quand il y en a un) :
  - *son écran de départ* : la voiture (sa catégorie fait le barème, affiché dessous), le calendrier
    (jusqu'à 10 courses : « + Ajouter un circuit », les tours de chacune en « − + », « ⋯ » pour avancer,
    reculer ou retirer), les séances d'essais et de qualifications (à la minute près), la grille
    (adversaires, ta place). Pas de classement ici : il n'y en a pas encore. « Lancer → ».
  - *son paddock* : celui de la course rapide, avec la course du calendrier (« Course 1/3 » sur la carte,
    qui ouvre le calendrier à lire ; tours figés), le garage limité à la catégorie, et en bas la pastille
    « Classement, tu es 2e » qui ouvre le tableau complet. « Abandonner le championnat » est dans
    « Réglages ».
  - *l'arrivée* (EN PISTE, puis « Simuler l'arrivée ») : les trois premiers de la course et ta place,
    puis le classement du championnat (les cinq premiers et toi) avec les places gagnées ▲ ou perdues ▼.
    « Course suivante → », ou après la dernière, « Voir le podium → ».
  - *le podium* : les trois premiers sur leurs marches, ta place, « Nouveau championnat » ou « Menu ».
    À égalité de points, le plus de victoires passe devant, puis le plus de deuxièmes places.
- **Multijoueur** (au menu) : créer une table, ou la rejoindre avec un code de quatre caractères
  (« Regarder » pour suivre sans piloter). La table est le paddock, avec au-dessus la barre des
  pilotes (« ✓ » quand ils sont prêts ; touchée, la liste, le code à partager et la connexion de
  chacun). Deux formats : la course, et le contre-la-montre. Une course sans voiture de l'IA est un
  duel (la pastille du format le dit). L'hôte change le circuit en touchant sa carte, les tours, le format, la
  catégorie des voitures et le moment par les pastilles, l'IA et les dégâts dans « Réglages » ; les autres lisent les mêmes
  pastilles, et « Réglages » leur montre le reste. Chacun garde sa voiture et son freinage. En bas :
  Réglages, Championnat (hôte), et à droite le geste de chacun : l'hôte (★) a Départ, qui s'ouvre quand
  les autres sont prêts (appuyer sur Départ, c'est être prêt) ; les autres ont Prêt.
- **Championnat de la table** (la pastille Championnat de l'hôte), dans les deux formats : le calendrier
  et les séances, comme le championnat seul. En course, chaque manche est une course (un duel sans IA) ;
  en contre-la-montre, chaque manche est une séance de qualifications de quelques minutes (« − + » à la
  minute), le meilleur tour de chacun fait le classement, sans point de pole. Lancé, le circuit, le
  format, la catégorie et l'IA sont figés ; la carte dit « Course 1/2 » ou « Manche 1/2 », la pastille
  « Classement » s'ouvre pour tous, et l'hôte peut l'arrêter dans « Réglages ». Arrivée et
  podium comme en solo. Les amis
  sont simulés : à une table créée, Léa et Marco arrivent puis se déclarent prêts ; à une table
  rejointe, l'hôte lance la course quand tu es prêt.

Les cinq entrées s'ouvrent du petit menu. Une feuille
se ferme par « Fermer », d'un geste vers le bas, en touchant le fond, ou par le retour du navigateur.
Les choix restent dans le navigateur.

Les circuits, voitures, livrées, fiches et images sont ceux du jeu, tirés par `outils/exporte.cjs`
(à relancer quand le jeu change). Les chronos sont des exemples, calculés depuis la longueur du
circuit et la vitesse de la voiture ; les arrivées du championnat et les amis du multijoueur sont simulés. Les images du jeu sont lues à la racine du site (`../../`).

`outils/essai.cjs` passe chaque écran sur un iPhone 13 émulé, le photographie et le mesure comme
l'audit : le paddock tient sur un écran, 12 cibles toutes d'au moins 44 points, une cinquantaine de mots,
aucun texte sous 13 px. Il court aussi un championnat de trois courses jusqu'au podium, puis l'abandonne ;
à la table, un championnat en duel jusqu'au podium, puis un en contre-la-montre que l'hôte arrête. Il
signale un bouton du bas qui sort de l'écran ou passe sur deux lignes. `LARGEUR=360` refait le parcours
sur l'écran le plus étroit courant.
