# Multijoueur : physique locale, états et ping

Implémenté dans **hybrid 0.35.0**, le 19 octobre 2026. Ce document remplace la proposition
initiale de prédiction/relecture : le choix retenu avec l’utilisateur est la propriété locale
de chaque voiture et l’envoi de ses états. La priorité est de doser ses gaz et d’anticiper les
voitures devant pour les éviter.

## Répartition

- Chaque navigateur pilote sa voiture avec la physique existante à 120 Hz : pulsations, frein,
  adhérence, glisse, surfaces et barrières. L’état reçu ne remplace jamais sa propre physique.
- L’hôte pilote sa voiture, simule les IA et arbitre les contacts entre voitures. Il rassemble
  les chronos et pénalités des propriétaires, décide du classement et de la fin de course.
- Les adversaires sont des représentations extrapolées, sans seconde simulation de leurs pneus.
  Leur mouvement est estimé au temps courant pendant au plus 150 ms ; leur progression et leur
  écart latéral sont reprojetés près de la branche attendue, notamment aux ponts.
- Le départ a une échéance dans l’horloge de l’hôte. On attend la synchronisation des horloges
  et le chargement. Circuit, grille, voitures et version sont communs.
- Le menu pause ne suspend pas la course en ligne. Les commandes sont relâchées et la course
  continue. Le réglage de frein du couple voiture/circuit est utilisé chez son pilote.

Ce modèle fait confiance à la physique exécutée chez le pilote. L’hôte vérifie la cohérence et
l’ordre des événements ; il ne resimule pas indépendamment toute sa conduite. Le navigateur hôte
doit rester actif ; il n’y a pas de serveur dédié.

## Mouvement et priorité

Le module js/net-drive.js sépare le mouvement du contrôle de course et du salon. Les messages
de course sont adressés à chaque destinataire. Les présences du salon restent diffusées chaque
seconde pour le maintien des membres et les spectateurs arrivant en cours de course.

Un propriétaire envoie son état environ 30 fois/s. Un changement de freinage, de gaz ou de ligne
déclenche un envoi immédiat ; l’hôte le relaie immédiatement aux pilotes proches. Le freinage reste
dans les états suivants : perdre le premier paquet ne le supprime pas durablement.

| Voiture | Cadence indicative | Données de mouvement |
| --- | --- | --- |
| Proche, visible ou se rapprochant rapidement | 30 Hz + changements urgents | 39 octets : identifiant, heure source, position, cap, vitesses, rotation, accélération, ligne, tour, états et effets |
| Éloignée | 5 Hz | 14 octets : identifiant, heure source, progression, tour, vitesse ; point approximatif sur la minicarte |

La proximité tient compte du circuit **et** de la distance dans le monde, de la couverture de la
caméra, des voitures derrière, des retardataires et de trois secondes de vitesse de rapprochement.
Une marge de 30 m évite les bascules répétées. En vue générale ou caméra fixe, les spectateurs
reçoivent toutes les voitures détaillées ; en suivi/duel, la proximité suit le pilote sélectionné.

L’hôte garde les états détaillés nécessaires aux décisions. Seule leur redistribution est allégée.
Chaque état garde son heure d’origine après un relais. Les anciens états, mauvaises identités et
paquets d’une autre course sont écartés. Un canal encombré abandonne les mises à jour remplaçables ;
les messages de contrôle et événements sont répétés.

Le calcul reproductible du test de protocole donne **11 730 → 4 035 octets/s** de mouvement par
destinataire pour dix voitures, dont trois proches et sept éloignées : environ **66 % de réduction
par rapport à toutes les voitures détaillées dans ce nouveau protocole**. Ce n’est ni le trafic
Internet complet ni une comparaison avec l’ancien paquet de 20 octets. Métadonnées, événements,
changements urgents et couches PeerJS/WebRTC ajoutent du trafic.

## Contacts, tours et arrivée

L’hôte calcule les contacts avec les états rapprochés du temps courant. Une correction modifie
position, vitesses et éventuellement dégâts au présent chez le propriétaire. Elle porte un
identifiant et son acquittement revient avec l’état suivant. Un doublon ne produit pas un second
choc ; les corrections en attente sont répétées. Les contacts entre IA restent chez l’hôte.

Une poussée adverse peut arriver après le contact apparent : on ne fait ni retour en arrière ni
relecture complète. Pour limiter les chocs invisibles, on ignore les contacts dont les états
distants sont trop anciens (160 ms), le trajet estimé entre pilotes dépasse l’horizon de prédiction
(150 ms), ou une correction précédente attend son acquittement. Une correction vieille de plus
de 1,5 s est acquittée sans être appliquée tardivement. Les murs et barrières statiques restent
immédiats et locaux. Ces seuils devront être confrontés aux parties réelles.

Les passages de ligne utilisent l’horloge commune, **pas l’heure d’arrivée du paquet**. Le
propriétaire transmet un historique cumulatif ; l’hôte refuse les valeurs incohérentes,
régressions et modifications d’un tour accepté. Chronos, pénalités et résultats sont redistribués.
Recevoir un ancien bilan n’efface pas les nouveaux tours locaux. Le premier arrivé ouvre trente
secondes de délai, avec clôture anticipée quand tous les pilotes ont terminé. Les autres restent
DNF, sans arrivée ni tour inventés. À l’échéance, la conduite est figée ; une courte fenêtre
de collecte (150 à 600 ms selon le RTT) accepte les passages déjà en transit dont le chrono
est antérieur à la limite. Elle ne donne pas de temps de pilotage supplémentaire.

## Ping

Une sonde aller-retour est envoyée chaque seconde, indépendamment du mouvement. Le salon et le HUD
affichent le **RTT vers l’hôte** ; l’hôte voit le minimum/maximum des invités. « — » indique une
mesure absente ou vieille de plus de quatre secondes. L’estimation du décalage d’horloge utilise
le meilleur RTT des huit dernières sondes et suppose des trajets approximativement symétriques.
L’horloge ne recule pas pendant les ajustements ; un écran non encore synchronisé ne bloque pas
les premiers états reçus avec un horodatage local non comparable.

Entre deux invités, le freinage parcourt environ la moitié du RTT de chacun vers l’hôte, puis
lecture de commande et rendu. L’envoi urgent retire l’attente périodique, pas la propagation, les
pertes ou les pauses du navigateur. Le ping affiché ne garantit donc pas un délai entre voitures.

## Vérifications

- tools/room-message-test.js : vrai code RoomRTC.wire, relais du salon, messages adressés, identité
  liée à la connexion, congestion et reprise ; connexions simulées, pas des NAT réels.
- tools/net-owned-test.js [circuit] (Monza, Spa, Zandvoort et Suzuka) : trois courses avec le vrai moteur, horloge/liens simulés ;
  réaction locale, pulsations, freinage en deux trajets, propriété/ordre des états, paquets invalides, compatibilité binaire ArrayBuffer,
  détail selon rapprochement, contact partagé, doublons/acquittements, pertes/désordre, tours,
  échéance et résultat DNF commun.
- tools/multi-timing-test.js : premier arrivé humain/IA, trente secondes, clôture anticipée,
  absence de tours artificiels et limitation des files réseau.
- tools/e2e-local-physics.js : trois écrans, transport de test BroadcastChannel, délais de
  0/30/60/100 ms par trajet, ping mesuré, freinage visible et pulsations entre deux images.
  [Mesures de l’exécution](mesures-locales.json), captures [course](ping-course-test.png) et
  [salon](ping-salon-test.png).
- tools/e2e-duo.js 3 --latence=50 --joueurs=4 : quatre pilotes, grille et commandes séparées,
  mouvement local et absence d’erreur JavaScript.
- tools/e2e-spectator.js --race : arrivée avant/pendant la course, cinq caméras, portrait/paysage,
  chronos partagés, délai d’arrivée, bilan et retour au salon.

Les captures spectateur utilisent des chronos injectés. Les transports contrôlés ne prouvent pas
la traversée des NAT, le comportement d’une vraie 4G ni les performances universelles des téléphones.
Les mesures de freinage incluent le navigateur et peuvent dépasser le seul délai injecté.

## Références

- [Glenn Fiedler — choix du modèle et autorité distribuée](https://mas-bandwidth.com/choosing-the-right-network-model-for-your-multiplayer-game/).
- [Gabriel Gambetta — extrapolation, interpolation et exemple automobile](https://www.gabrielgambetta.com/entity-interpolation.html).
- [Glenn Fiedler — synchronisation des états physiques](https://gafferongames.com/post/state_synchronization/).
- [Gambetta — prédiction/réconciliation](https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html)
  et [Unity — prédiction](https://docs.unity.cn/Packages/com.unity.netcode@1.5/manual/intro-to-prediction.html) :
  alternative à considérer si les corrections de contact restent trop gênantes.
