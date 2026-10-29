# Essieux, pneus et ailes — 0.52.41

- [Dodici T](ferrari312t.png) : pneus avant plus étroits que les pneus arrière, d'après les proportions de la référence fournie. Les neuf F1 ont maintenant des largeurs avant spécifiques (dont les quatre petites roues de la Sixpence).
- [Windsor 07](williamsfw07.png) et [Ground 79](lotus79.png) : triangles de suspension reliant les moyeux au châssis. Ils passent sous la carrosserie et les pneus, et sont inclus dans l'ombre précalculée.
- [GT40](gt40.png) et [Langheck](935.png) : pneus légèrement visibles à l'avant et à l'arrière sur les six livrées. Les pneus arrière sont fixes ; les pneus avant braquent.
- [Stallone](countach.png) : ailes arrière continues, arrière carré, ouïes au-dessus des ailes, aileron peu profond posé sur la carrosserie. Les roues arrière sont avancées de 7 % de la longueur du sprite. Les trois livrées sont conservées, ainsi que les dimensions PNG. Pneus avant rentrés pour suivre la nouvelle carrosserie.

Les captures sont issues du moteur réel, roues droites à gauche et braquées à droite. Les paramètres physiques ne changent pas.

## Vérifications

- `tools/e2e-cartoon.js` : 57 livrées / 25 modèles ; braquage visible, ombres sans double opacité et pneus F1 au-dessus des essieux.
- `tools/e2e-gt40-silhouette.js` : contrôle mis à jour, la demande est maintenant un petit dépassement et non des pneus entièrement cachés.
- `tools/e2e-essieux-ailes.js` : 24 centres de pneus contrôlés sur les trois GT40 et les trois Langheck, entre 1 et 8 pixels de gomme visible à roues droites pour une voiture dessinée sur 420 pixels de long. Résultats dans `pneus-visibles.json`.

Pour les deux derniers scripts, démarrer un serveur local sur le port 8771 (ou fournir son URL en argument).
