# Spectateurs et bilan multijoueur

Sur la branche hybrid, utiliser **Multijoueur → code du salon → Regarder**, avant le départ ou pendant la course. Dans le salon, un invité peut passer de pilote à spectateur et inversement avant le départ. L'hôte reste pilote et assure la simulation ; il doit conserver le jeu ouvert. Les spectateurs ne prennent aucune des huit places de pilote et ne bloquent pas le chargement.

## Vues

- **Réalisateur** : alternance de plans de huit secondes : circuit complet, suivi puis duel. Les plans rapprochés ciblent les sorties et moteurs coupés puis la bataille la plus serrée.
- **Suivi pilote** : caméra de course sur le pilote sélectionné, sans prendre son contrôle.
- **Circuit complet** : carte avec repères colorés numérotés et classement utilisant les mêmes couleurs. Les couleurs des humains sont conservées ; les IA reçoivent des couleurs disponibles pour éviter les doublons. En paysage, le classement passe à gauche et le circuit est cadré dans la zone libre à droite. En portrait, il reste sous le panneau supérieur.
- **Caméras fixes** : ligne de départ et principaux virages identifiés par la courbure du tracé ; flèches pour changer de poste.
- **Duel** : cadre le pilote et son prédécesseur (le deuxième pour le leader), avec zoom adapté.

Clavier : flèches gauche/droite pour changer de pilote ou de poste. Manette standard : LB/RB ou croix gauche/droite, A pour changer de vue, X pour afficher/masquer les chronos. Les vues rapprochées affichent une minicarte avec les positions et un classement compact. Le bouton **Chronos** permet de basculer vers les temps détaillés ; en portrait, le circuit complet conserve par défaut le tableau de chronométrage. Les repères de la carte et de la minicarte peuvent être sélectionnés au clic ou au toucher. **Quitter** quitte le salon. Le spectateur ne met pas la simulation en pause.

## Chronométrage

Classement, écart au leader, écart à la voiture précédente, dernier tour, meilleur tour et tour en cours. Les tours annulés sont signalés par ×.

Les écarts en course sont des **estimations** basées sur la distance parcourue et le meilleur tour connu, marquées ≈. Avant le premier chrono, on affiche des mètres ; au-delà d'un tour de retard, des tours. Ce ne sont pas des temps mesurés par des boucles de chronométrage. À l'arrivée, les écarts utilisent les temps finaux et les pénalités du moteur de course.

L'hôte transmet les temps complets, leur validité et le bilan environ une fois par seconde, avec un envoi systématique à l'arrivée. Les nouveaux spectateurs récupèrent ainsi les tours précédant leur connexion. L'état final est répété tant que l'hôte reste sur les résultats. Les positions conservent le transport existant à environ 30 Hz ; les spectateurs n'envoient qu'une présence périodique, aucune commande de pilotage.

## Bilan partagé à l'arrivée

Accessible aux pilotes et spectateurs :

- classement final, écarts, meilleur tour et pénalités existantes ;
- places gagnées par rapport à la grille ;
- moyenne et écart-type des tours valides (au moins deux pour la régularité) ;
- tours valides / total, vitesse maximale observée, nombre de sorties ;
- graphique des positions toutes les cinq secondes, progressivement espacé si la course est longue ;
- tous les temps au tour, y compris les tours annulés.

Les mesures proviennent de la simulation de l'hôte. Le graphique échantillonné ne prétend pas recenser chaque dépassement. Ce bilan appartient à la session, sans archivage dans la base des statistiques publiques. Regarder ne compte pas comme une course jouée et ne modifie pas les records du spectateur.

## Validation

`node --require /workspace/cloud-setup/system-chromium.cjs tools/e2e-spectator.js`

Ajouter `--race` pour tester un plateau complété par des IA, sinon duel à deux pilotes. Tests via le transport BroadcastChannel de `e2e-duo.js` : arrivée avant/après départ, absence de siège et d'input spectateur, cinq caméras, mobile, historique reçu, bilan partagé, sauvegarde du spectateur inchangée et retour au salon sans redémarrage de la course terminée. Ce test n'éprouve pas la connexion WebRTC entre deux réseaux Internet réels.

Les captures `spectateur-circuit-test.png`, `spectateur-suivi-test.png`, `spectateur-mobile-test.png` et `bilan-course-test.png` utilisent des chronos injectés pour la validation : ce ne sont pas des résultats de joueurs réels. Tous les participants doivent recharger la version actuelle ; un ancien hôte ne connaît pas le rôle spectateur ni l'historique étendu.

Le test `node tools/multi-timing-test.js` vérifie séparément l’arrivée du premier hôte/invité/IA, la limite de 30 secondes, la fin anticipée quand tous les humains ont terminé et l’absence de temps d’arrivée inventés. `tools/e2e-duo.js --latence=50` permet de tester le transport avec 50 ms de délai artificiel par sens.

## Évolution du pilotage réseau

La simulation physique locale chez les invités fait l’objet d’une [étude séparée](../multijoueur/architecture-physique.md). Elle n’est pas activée par ces changements d’interface ou d’arrivée.
