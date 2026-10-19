> Mise à jour 0.38.0 : [interfaces illustrées intégrées et captures actuelles](../interface-paddock/README.md). Le contenu ci-dessous documente la version précédente.

# Menus hybrid — 0.37.0

> **Complément critique** : voir l’[audit centré sur la conception de jeux vidéo](../audit-interface-jeu/README.md).
> Il réévalue la perte d’identité de cette refonte et propose une direction artistique pour l’accueil et les écrans en course.

## Choix et références

Analyse de recommandations d'ergonomie consultées le 19 octobre 2026. Il s'agit d'une revue
ciblée de sources professionnelles et normatives, et non d'une étude utilisateurs ou d'une
preuve que cette direction graphique convient à tous les joueurs.

| Référence | Principe retenu | Application dans le jeu |
| --- | --- | --- |
| [Budiu, NN/g, Memory Recognition and Recall in User Interfaces (2024)](https://www.nngroup.com/articles/recognition-and-recall/) | Reconnaître un choix demande moins d'effort que rappeler sa signification de mémoire. | Nom permanent des trois modes, illustration et description ; la sélection voiture/circuit est récapitulée avant le départ. |
| [W3C, WCAG 2.2, Target Size (Minimum), SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | Cibles d'au moins 24 × 24 pixels CSS, ou espacement/exception définis par le critère. | Choix de confort plus généreux : contrôles de préparation d'au moins 44 px de haut, cartes et entrées principales encore plus grandes. Ce choix ne constitue pas une certification WCAG. |
| [Game Accessibility Guidelines, Large and well-spaced interactive elements](https://gameaccessibilityguidelines.com/ensure-interactive-elements-virtual-controls-are-large-and-well-spaced/) | La taille et l'espacement aident au toucher, mais aussi au pointeur et à la manette. | Séparation des modes, réglages groupés, focus visible, navigation dans les rails et marge de défilement au-dessus de la barre de départ. |

Les panneaux sombres, les accents crème/ambre et les illustrations automobiles reprennent
l'ambiance de l'affiche existante. Ce sont des choix de direction artistique, pas des conclusions
scientifiques déduites des sources. Le décor reste discret derrière les textes.

## Organisation

- **Accueil** : les trois modes gardent les mêmes dimensions au repos, au survol et au focus.
  Le fond du bouton se déploie à l'intérieur du même contour. Le texte est toujours lisible et
  le départ du mode est immédiat, sans l'ancienne attente de 430 ms.
- **Course et chrono** : aperçu voiture/circuit, sélection du modèle et de la livrée, circuit,
  réglages, freinage enregistré et bouton de départ. Coches et état accessible `aria-pressed`
  identifient les choix en complément de la couleur.
- **PC** : voiture et circuit côte à côte ; groupe de réglages en dessous ; titre paysage avec
  l'affiche conservée dans ses proportions et un bouton de démarrage explicite.
- **Tactile** : ordre vertical, rails horizontaux pour les catalogues ; menus toujours en
  colonne. La course reste disponible en paysage. L'affiche de titre mobile est conservée.
- **Multi** : accueil illustré pour créer, rejoindre ou regarder une table ; aperçu du couple
  voiture/circuit et cartes harmonisées dans le salon. Les restrictions de l'hôte sont conservées.
- **Commandes** : clavier, molette et manette se règlent dans la préparation ou dans Réglages.
  Les anciennes images de bandeaux restent dans les sources, mais ne définissent plus les cibles.

## Captures

| Écran | PC | Mobile |
| --- | --- | --- |
| Titre | [PC](pc-titre.png) | [Mobile](mobile-titre.png) |
| Accueil | [PC](pc-menu.png) | [Mobile](mobile-menu.png) |
| Course rapide | [PC](pc-race.png) | [Mobile](mobile-race.png) |
| Contre-la-montre | [PC](pc-timetrial.png) | [Mobile](mobile-timetrial.png) |
| Entrée multi | [PC](pc-multi.png) | [Mobile](mobile-multi.png) |
| Réglages de course | [PC](pc-reglages.png) | [Mobile](mobile-reglages.png) |

[Salon multijoueur connecté](pc-salon.png).

Le dossier contient aussi les captures petit mobile, tablette et PC compact. Les captures
montrent la partie visible de l'écran ; les réglages situés plus bas restent accessibles en défilant.

## Vérification

- `tools/e2e-menu.js` : cinq formats (1440 × 900, iPhone 13, iPhone SE, iPad Mini, 850 × 600),
  destinations des trois modes, dimensions avant/après focus, voiture/circuit, état de sélection,
  conservation du défilement, FR/EN, absence de débordement horizontal et d'erreur JavaScript.
  Salon à deux joueurs via transport local de test : choix de circuit réservé à l'hôte,
  propagation du choix et autorisation du départ quand les deux pilotes sont prêts.
- `tools/e2e-manette.js` : navigation réelle par boutons injectés dans Gamepad API, rubriques,
  livrées, saisie du pseudo, listes, départ, frein LT/accélérateur RT, pause et retour.
- `tools/e2e-pc.js` : départ, clavier/clic, molette, manette, rotation tactile et retour au menu.

Les formats mobiles sont émulés dans Chromium ; ces vérifications ne remplacent pas un essai
sur un iPhone physique sous Safari. Aucun changement de physique ou de protocole réseau.
