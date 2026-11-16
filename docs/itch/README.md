# Édition itch.io — 0.55.0

L’export dédié conserve les records locaux et remplace l’accès au tableau mondial par un bouton :
**Pour avoir accès aux records mondiaux, jouer sur la version en ligne grip-game.github.io**.
Le lien ouvre **https://grip-game.github.io/** dans un nouvel onglet. Le menu propose aussi une
entrée « Records mondiaux ». La connexion Google n’est pas lancée depuis cette édition.

Les réglages de taille et de plein écran restent ceux d’itch.io : aucune modification du HUD,
des menus ou du comportement de lancement en plein écran n’est ajoutée pour cette intégration.

- [Branche itch-io du dépôt PROD](https://github.com/GRIP-game/grip-game.github.io/tree/itch-io)
- [ZIP HTML5 prêt à charger](https://github.com/GRIP-game/grip-game.github.io/raw/refs/heads/itch-io/grip-itch-0.55.0.zip)
- [Aperçu du bouton dans les records](itch-records.png)
- [Contrôles de l’export](verification.json)

Génération : `npm run build:itch`. Le ZIP est produit dans `dist-itch/`, avec `index.html` à la racine,
les ressources du jeu et `APP_DISTRIBUTION = 'itch'`. L’export web normal conserve
`APP_DISTRIBUTION = 'web'` et son tableau mondial. Les outils d’édition et les documents ne sont
pas inclus dans le ZIP. La branche `itch-io` reçoit les fichiers minifiés et le ZIP, en dehors de
la branche `main` publiée sur grip-game.github.io.

`tools/e2e-itch-records.js` vérifie les deux distributions, le retour Google avec un paramètre `v`,
l’absence du commentaire technique, la conservation d’un temps local, l’absence de connexion
Google et le lien vers la version en ligne dans l’export. Le contrôle vérifie aussi qu’aucun bouton
Plein écran ni mise en page spéciale d’intégration n’a été ajouté dans le jeu.
