# GT Néon

Concept original de GT futuriste inspiré de la DeLorean, proposé en gris métal brossé et rose métallisé. Disponible dans la catégorie GT ; un second clic sur la voiture choisie change la livrée. Les deux peintures partagent les mêmes performances et le choix est conservé par la sauvegarde habituelle.

Les quatre PNG transparents sont dans `sprites/top/neon{,_rose}.png` (420 × 200, nez à droite) et `sprites/pick/neon{,_rose}.png` (vues trois quarts, nez à gauche). L'atlas généré est conservé dans `art-src/voitures/neon/atlas.png` ; son isolation et son cadrage utilisent `elements` de `tools/pack-nouvelles-voitures.js` et Sharp.

Réglage de concept : environ 316 km/h, six cylindres turbo, comportement GT légèrement stable. Ces valeurs de jeu ne décrivent pas une automobile réelle. Les deux livrées utilisent le même moteur et la même physique.

Validation : `node --require /workspace/cloud-setup/system-chromium.cjs tools/e2e-livree.js /tmp`. Contrôle navigateur complémentaire : choix de la GT Néon rose, conservation après rechargement et démarrage d'une course avec `sprites/top/neon_rose.png`.
