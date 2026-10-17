# Variante PC — 0.31.0

Le jeu choisit sa présentation suivant l'appareil. Sur PC, accueil en paysage, préparation avec
voitures à gauche et circuit/options à droite, réglages en deux colonnes. Sur mobile et tablette,
les menus conservent leur disposition portrait : même en tenant l'appareil en paysage, ils restent
en colonne, à la largeur du petit côté de l'écran. **La course seule utilise librement les deux
orientations**, sur toute la fenêtre. Aucun changement de circuit ou de modèle de voiture.

## Trois accélérateurs PC

Le sélecteur **Accélérateur PC** se trouve à l'accueil, avant le départ, dans les réglages et dans
la pause. Son choix est mémorisé localement ; le tactile mobile continue de fonctionner comme avant.

| Mode | Gaz et freinage | Choix de trajectoire |
| --- | --- | --- |
| Clavier / clic | Maintenir pour le plein gaz, relâcher pour freiner. Les pulsations entre deux images sont conservées. | Flèches, molette ou levier à l'écran. |
| Molette | Vers le haut pour augmenter, vers le bas pour réduire. La valeur reste au niveau choisi. Espace ramène à zéro et déclenche le freinage existant. | Flèches ou levier. |
| Xbox | Gâchette droite RT progressive ; relâcher complètement déclenche le freinage existant. | Stick gauche, croix, flèches ou levier. |

Avec la manette, un mouvement du stick fait passer d'un cran de trajectoire ; le recentrer permet
le mouvement suivant. La croix haut/droite va vers le jaune, bas/gauche vers le bleu, comme les
flèches. Ce sont des changements de ligne de slot racing, pas un volant. Le bouton Menu met en
pause/reprend ; Échap et P fonctionnent aussi. Un léger mouvement parasite de RT est ignoré
(zone morte de 5 %). Appuyer une fois sur un bouton peut être nécessaire pour que le navigateur
expose la manette. Mapping standard de la Gamepad API, sur HTTPS ou localhost.

Le HUD PC remplace la pastille tactile par la vitesse, le mode actif et une barre **Gaz 0–100 %**.
Les commandes analogiques modulent la poussée demandée et l'entrée du moteur sonore. Le plein gaz
et le lever de pied gardent exactement la physique précédente ; les réglages de freinage et de
motricité s'appliquent aussi au dosage partiel. Le réseau transmet les fractions de gaz à l'hôte.

Chaque départ, changement de mode ou pause remet les gaz à zéro. La perte de focus met en pause,
ainsi qu'une déconnexion de la manette en course. À la connexion et après reprise, RT doit être
relâchée avant d'accélérer. La pause indique l'état de connexion et permet de changer de commande.
Le stick a une hystérésis pour éviter plusieurs crans dus à un tremblement autour du seuil.

## Captures du jeu

Accueil PC :

![Accueil paysage et sélecteur de commande](pc-menu.png)

Préparation PC :

![Voitures à gauche, circuit et options à droite](pc-depart.png)

Course PC, dosage à la molette :

![Tableau de bord PC avec gaz partiels](pc-course-molette.png)

Course PC, gâchette à mi-course dans la manette simulée :

![Gaz progressifs à la gâchette Xbox](pc-course-manette.png)

Menu mobile portrait et course mobile paysage :

![Préparation mobile inchangée en colonne](mobile-depart-portrait.png)

![Course tactile après rotation de l'appareil](mobile-course-paysage.png)

## Vérifications

| Vérification | Résultat |
| --- | --- |
| `node tools/pc-controls-test.js` | 25 voitures : plein gaz et lever de pied identiques à `3c6e334`, poussée croissante sur cinq niveaux ; dosage dans Race et dans les messages réseau. Molette, RT, zone morte, stick, pause et déconnexion. |
| `node tools/pulsations-entree.js` | Appuis de 50, 100 et 150 ms conservés à 15, 30 et 60 images/s ; remise à zéro en pause. |
| `node tools/e2e-pc.js /tmp/pc-captures` | Parcours navigateur PC 1440×900, iPhone 13 et iPad : sélection, sauvegarde, trois commandes, dosage reçu par la voiture, perte de focus, pause/reprise/déconnexion, rotation tactile et retour portrait. Aucune erreur JS. |
| `node tools/caracteres-f1-test.js` | Courbes/profils des 23 voitures hors Brabham/Renault et freinage des 25 modèles inchangés ; caractères BT46B/RS10 conservés. |
| `node tools/e2e-f1.js /tmp --cars=renaultrs10` | Sélection, sauvegarde, sprite et simulations sur Monaco, Spa, Monza et Zandvoort. |
| `node tools/e2e-menu.js /tmp` | Menu-affiche mobile, zones des bandeaux, navigation et défilement conservés. |
| `node tools/e2e-categories.js /tmp` | Filtres, migrations, grilles et salon à deux écrans : aucune faute. |
| `node tools/e2e-duo.js 3 --joueurs=2` | Hôte/invité, commandes séparées et mouvement réseau : aucune erreur. Transport remplacé par BroadcastChannel pour ce test. |

Les tests navigateur utilisent Chromium. Les valeurs et boutons Xbox sont **simulés dans la
Gamepad API** ; aucune manette physique n'était raccordée à l'environnement cloud. Le branchement
USB/Bluetooth et la sensation de gâchette restent à vérifier sur le matériel du joueur.
