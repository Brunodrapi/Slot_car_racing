# GRIP — édition itch.io 0.55.2

Cette branche `itch-io` du dépôt REC contient le jeu minifié destiné à itch.io et son export ZIP.

**[Télécharger le ZIP HTML5 prêt à charger sur itch.io](https://github.com/Brunodrapi/Slot_car_racing/raw/refs/heads/itch-io/grip-itch.zip)**

Le ZIP contient `index.html` à sa racine. Charger ce ZIP dans itch.io et le marquer jouable
**dans le navigateur**. La taille et le plein écran restent configurés dans itch.io.

L’édition garde les temps locaux. La phrase « Pour avoir accès aux records mondiaux, jouer sur
la version en ligne » est du texte simple. Seul **grip-game.github.io** est un bouton : il ouvre
https://grip-game.github.io/ dans un nouvel onglet. La connexion Google au tableau mondial
n’est pas proposée depuis itch.io.

**0.55.2 :** les feux avant sont recalés sur le dessin de chaque voiture (le feu droit est le vrai
miroir du gauche et se pose sur le phare dessiné ; sept voitures ont des optiques refaites).

Cette édition comprend les feux adaptés aux 35 voitures et les pneus avant de la Purosangue Gran
Corsa élargis comme les pneus arrière. Le commentaire technique sur le retour de Google a été retiré.

Export reproductible depuis les sources : `npm run build:itch` (`tools/pack-itch.js`, distribution
`itch`). Le hash du ZIP figure dans [archive-itch.json](archive-itch.json).

Cette branche de distribution reste séparée de la branche de recette publiée et du site PROD https://grip-game.github.io/.
