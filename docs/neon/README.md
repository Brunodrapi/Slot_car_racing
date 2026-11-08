# GT Néon

Concept original de GT futuriste inspiré de la DeLorean, proposé en gris métal brossé et rose métallisé. Disponible dans la catégorie GT ; un second clic sur la voiture choisie change la livrée. Les deux peintures partagent les mêmes performances et le choix est conservé par la sauvegarde habituelle.

Les quatre PNG transparents sont dans `sprites/top/neon{,_rose}.png` (420 × 200, nez à droite) et `sprites/pick/neon{,_rose}.png` (vues trois quarts, nez à gauche). L'atlas actuel est conservé dans `art-src/voitures/neon/atlas-cartoon.png`, intégré avec `tools/pack-cartoon.js`. La première proposition réaliste reste archivée dans `atlas.png`.

La reprise applique la charte cartoon du jeu : contours noirs épais, aplats gris ou rose, fenêtres opaques et détails simplifiés, avec les sprites Stallone et Furia 40 comme références de style. Les pneus avant sont séparés de la carrosserie et braquent dans le moteur Canvas. Les deux livrées ont leurs propres ancrages ; les dimensions de course et la physique sont conservées. Le guide réutilisable est `.agents/skills/car-design/SKILL.md`.

Réglage de concept : environ 316 km/h, six cylindres turbo, comportement GT légèrement stable. Ces valeurs de jeu ne décrivent pas une automobile réelle. Les deux livrées utilisent le même moteur et la même physique.

Validation : `node --require /workspace/cloud-setup/system-chromium.cjs tools/e2e-livree.js /tmp`. Contrôle navigateur complémentaire : choix de la GT Néon rose, conservation après rechargement et démarrage d'une course avec `sprites/top/neon_rose.png`.

Reprise cartoon (0.52.53) : les 59 livrées des 26 modèles passent le contrôle Canvas des roues, du braquage gauche/droite et des ombres. Les deux Néon ont chacune deux pneus directeurs visibles ; sélection rose, sauvegarde après rechargement et départ en course passent sans erreur JavaScript. [Comparaison dans le moteur réel](controle-style.png), [mesures](verification-roues.json).
