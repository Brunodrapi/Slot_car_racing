# GRIP — édition itch.io 0.56.2

Cette branche `itch-io` du dépôt REC contient le jeu minifié destiné à itch.io et son export ZIP.

**[Télécharger le ZIP HTML5 prêt à charger sur itch.io](https://github.com/Brunodrapi/Slot_car_racing/raw/refs/heads/itch-io/grip-itch.zip)**

Le ZIP contient `index.html` à sa racine. Charger ce ZIP dans itch.io et le marquer jouable
**dans le navigateur**. La taille et le plein écran restent configurés dans itch.io ; l'orientation
est réglée sur **Portrait**, et « SharedArrayBuffer support » doit rester **décoché** (sinon l'onglet
de connexion Google perd son lien avec le jeu).

**0.56.2 : le tableau mondial arrive sur itch.io.** La colonne « Monde » s'affiche sans compte.
« Se connecter avec Google » ouvre un nouvel onglet sur grip-game.github.io ; une fois connecté, les
meilleurs tours partent au tableau mondial, comme sur la version en ligne. La connexion est gardée par
un pont servi par la prod (`https://grip-game.github.io/itch.html`), jamais par le jeu lui-même :
l'adresse d'itch.io est partagée par tous ses jeux. Le renvoi vers la version en ligne a disparu.
Le palmarès (trophées) reste sur l'appareil.

Cette édition comprend aussi les ailes arrière corrigées de la Kitsune Zeta 240 et de la Purosangue
Freccia (0.55.3, [comparatif avant / après](https://brunodrapi.github.io/Slot_car_racing/docs/ailes-kitsune-freccia/avant-apres.png)),
les feux recalés sur le dessin de chaque voiture (0.55.2) et les pneus avant de la Purosangue Gran
Corsa élargis comme les pneus arrière.

Export reproductible depuis les sources : `npm run build:itch` (`tools/pack-itch.js`, distribution
`itch`). Le hash du ZIP figure dans [archive-itch.json](archive-itch.json).

Cette branche de distribution reste séparée de la branche de recette publiée et du site PROD https://grip-game.github.io/.
