# Placement des roues — recette 0.52.44

Les roues séparées du dessin ont maintenant des ancrages propres à chaque sprite : 25 modèles, 57 livrées. Les carrosseries PNG restent identiques.

Chaque planche montre, de gauche à droite : **repères cyan des centres et de l’encombrement des pneus**, **roues droites**, **roues braquées**. Chaque ligne correspond à une livrée. L’avant des voitures est à droite.

## Mise à jour 0.52.45 — Stallone

La livrée blanche fournie par le joueur mesure 395 × 235 px. Les versions noire et jaune ont reçu le même étirement transversal (203 → 235 px, soit +15,8 %), sans changement de longueur ni de livrée. Le fichier blanc fourni est conservé tel quel. Les six paires de roues ont été recalées sur les contours ; leur largeur suit le nouveau gabarit. La planche Countach et les relevés ci-dessous montrent cette version.

## Corrections

- F1 : roues avant recentrées sur les moyeux dessinés ; les quatre roues avant de la Sixpence ont leurs propres points de placement. Les bras ajoutés à la Windsor rejoignent les nouveaux centres, sous les pneus.
- GT et prototypes : position longitudinale choisie sur les ailes de chaque dessin ; profondeur sous la carrosserie ajustée séparément de chaque côté, d’après son contour opaque. Le léger dépassement vise environ 1,5 pixel pour une voiture affichée sur 420 pixels de long.
- Roues arrière séparées : même recalage pour Stallone, GT40, Langheck, Longnose et Aero 62.
- Le braquage conserve le centre du pneu. Les ombres utilisent les ancrages de la livrée affichée.

Les roues arrière déjà intégrées aux PNG ne sont pas redessinées par ce correctif. Les dimensions physiques et les collisions ne changent pas.

## Planches

- [240z](240z.png)
- [250gto](250gto.png)
- [330p4](330p4.png)
- [787b](787b.png)
- [930](930.png)
- [935](935.png)
- [962](962.png)
- [brabhambt46b](brabhambt46b.png)
- [corvette](corvette.png)
- [countach](countach.png)
- [csl](csl.png)
- [f40](f40.png)
- [ferrari312t](ferrari312t.png)
- [gt40](gt40.png)
- [ligierjs11](ligierjs11.png)
- [lotus72](lotus72.png)
- [lotus79](lotus79.png)
- [m1procar](m1procar.png)
- [mclarenm23](mclarenm23.png)
- [p68](p68.png)
- [renaultrs10](renaultrs10.png)
- [typee](typee.png)
- [tyrrellp34](tyrrellp34.png)
- [williamsfw07](williamsfw07.png)
- [xjr9](xjr9.png)

## Vérification

`node tools/e2e-wheel-anchors.js http://127.0.0.1:8773` régénère les planches à partir du vrai rendu du jeu. Le serveur local doit être lancé préalablement.

Les contrôles vérifient la stabilité des pivots pendant le braquage, leur placement sous les carrosseries fermées et leur présence sur les éléments dessinés des F1 (sauf Windsor, dont les bras sont générés). Les tests du rendu cartoon et des pneus GT40 vérifient également les ombres et le dépassement des pneus.

Ces contrôles géométriques ne remplacent pas l’appréciation visuelle : les repères sont fournis pour permettre de vérifier les placements directement.

- [Mesures du rendu](mesures.json)
- [Relevés des contours des ailes](releves-ailes.json)
