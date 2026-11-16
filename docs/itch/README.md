# Édition itch.io — 0.55.3

> **À venir avec la 0.56.0 (en recette, pas encore exportée).** Le tableau mondial arrive sur
> itch.io : la colonne « Monde » sans compte, et la connexion Google dans un nouvel onglet, par un
> pont servi par la prod (`itch.html`). Le renvoi vers la version en ligne décrit ci-dessous
> disparaît. La prod doit être publiée AVANT de charger le nouveau ZIP sur itch.io. Détails dans le
> README du jeu, « Le tableau mondial sur itch.io ».

L’export dédié conserve les records locaux. Une phrase simple indique : « Pour avoir accès aux
records mondiaux, jouer sur la version en ligne ». Seul **grip-game.github.io** est un bouton.
Le lien ouvre **https://grip-game.github.io/** dans un nouvel onglet. Le menu propose aussi ce bouton. La connexion Google n’est pas lancée depuis cette édition.

Les réglages de taille et de plein écran restent ceux d’itch.io : aucune modification du HUD,
des menus ou du comportement de lancement en plein écran n’est ajoutée pour cette intégration.

- [Branche itch-io du dépôt REC](https://github.com/Brunodrapi/Slot_car_racing/tree/itch-io)
- [ZIP HTML5 prêt à charger](https://github.com/Brunodrapi/Slot_car_racing/raw/refs/heads/itch-io/grip-itch.zip)

Le ZIP garde le même nom à chaque version (`grip-itch.zip`) : le lien ci-dessus mène toujours au
dernier export. 0.55.3 : ailes arrière corrigées sur les trois livrées de Kitsune Zeta 240 et de
Purosangue Freccia ; les feux suivent les nouveaux dessins.

Le ZIP est publié sur une branche séparée du dépôt REC. Le site PROD grip-game.github.io
est publié séparément par `tools/publier.sh`.

- [Aperçu du bouton dans les records](itch-records.png)
- [Contrôles de l’export](verification.json)

Génération : `npm run build:itch`. Le ZIP est produit dans `dist-itch/`, avec `index.html` à la racine,
les ressources du jeu et `APP_DISTRIBUTION = 'itch'`. L’export web normal conserve
`APP_DISTRIBUTION = 'web'` et son tableau mondial. Les outils d’édition et les documents ne sont
pas inclus dans le ZIP. La branche `itch-io` du dépôt REC reçoit les fichiers minifiés et le ZIP, séparément de
la branche de recette publiée et du site PROD grip-game.github.io.

`tools/e2e-itch-records.js` vérifie les deux distributions, le retour Google avec un paramètre `v`,
l’absence du commentaire technique, la conservation d’un temps local, l’absence de connexion
Google et le lien vers la version en ligne dans l’export. Le contrôle vérifie aussi qu’aucun bouton
Plein écran ni mise en page spéciale d’intégration n’a été ajouté dans le jeu.
