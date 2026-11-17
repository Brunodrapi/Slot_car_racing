# Édition itch.io — 0.56.2

**Le tableau mondial est sur itch.io.** La colonne « Monde » s’affiche sans compte. « Se connecter
avec Google » ouvre un nouvel onglet sur grip-game.github.io ; une fois connecté, les meilleurs tours
partent au tableau mondial, comme sur la version en ligne, et l’on reste connecté d’une visite à
l’autre (sauf sur Safari, qui efface ce stockage à la fermeture). Le palmarès reste sur l’appareil.
L’ancien renvoi vers la version en ligne (« Pour avoir accès aux records mondiaux… ») a disparu.

La connexion ne vit pas dans le jeu mais dans un pont servi par la prod
(`https://grip-game.github.io/itch.html`) : l’adresse où itch.io fait tourner les jeux est partagée
par tous ses jeux, et Google refuse de s’afficher dans un cadre. Le détail est dans le README du jeu,
« Le tableau mondial sur itch.io ». [Aperçu : avant, l’onglet, après](itch-mondial.png).

Sur la page itch.io du jeu : **Orientation = Portrait**, et **« SharedArrayBuffer support » décoché**
(coché, l’onglet de connexion perd son lien avec le jeu). La prod doit toujours être publiée AVANT de
charger un nouveau ZIP : c’est elle qui sert le pont.

Les réglages de taille et de plein écran restent ceux d’itch.io : aucune modification du HUD,
des menus ou du comportement de lancement en plein écran n’est ajoutée pour cette intégration.

- [Branche itch-io du dépôt REC](https://github.com/Brunodrapi/Slot_car_racing/tree/itch-io)
- [ZIP HTML5 prêt à charger](https://github.com/Brunodrapi/Slot_car_racing/raw/refs/heads/itch-io/grip-itch.zip)

Le ZIP garde le même nom à chaque version (`grip-itch.zip`) : le lien ci-dessus mène toujours au
dernier export. 0.56.2 : le tableau mondial ; il comprend les ailes arrière corrigées de la Kitsune
Zeta 240 et de la Purosangue Freccia (0.55.3), dont les feux suivent les nouveaux dessins.

Le ZIP est publié sur une branche séparée du dépôt REC. Le site PROD grip-game.github.io
est publié séparément par `tools/publier.sh`.

- [Aperçu de l’ancien bouton dans les records (0.55)](itch-records.png)
- [Contrôles de l’export](verification.json)

Génération : `npm run build:itch`. Le ZIP est produit dans `dist-itch/`, avec `index.html` à la racine,
les ressources du jeu et `APP_DISTRIBUTION = 'itch'`. L’export web normal conserve
`APP_DISTRIBUTION = 'web'` et son tableau mondial. Les outils d’édition et les documents ne sont
pas inclus dans le ZIP. La branche `itch-io` du dépôt REC reçoit les fichiers minifiés et le ZIP, séparément de
la branche de recette publiée et du site PROD grip-game.github.io.

`tools/e2e-itch-records.js` vérifie les deux distributions, le retour Google avec un paramètre `v`,
l’absence du commentaire technique, la conservation d’un temps local, la colonne « Monde » et la
connexion proposée dans l’export, et le pont embarqué. Le contrôle vérifie aussi qu’aucun bouton
Plein écran ni mise en page spéciale d’intégration n’a été ajouté dans le jeu.
`tools/e2e-itch-mondial.js` rejoue la connexion de bout en bout aux vraies adresses (itch.io,
itch.zone, la prod), avec de faux Google et Supabase.
