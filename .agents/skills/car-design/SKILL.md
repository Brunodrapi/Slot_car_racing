---
name: car-design
description: Créer ou retoucher les voitures et livrées de GRIP en respectant le style cartoon, les vues de course et les roues du moteur Canvas.
---

# Design des voitures GRIP

Lire `docs/sprites-cartoon/README.md`, section « Règles pour les prochaines générations », puis `docs/sprites-vue-dessus/README.md` et `docs/essieux-ailes/README.md` avant toute génération.

## Références visuelles obligatoires

Inspecter au moins deux modèles existants dans `sprites/top/` ET `sprites/pick/` avec l'outil de visualisation. Fournir leurs PNG comme références de style à la génération. Pour une GT anguleuse, utiliser `countach` et `f40`. Une photo ou un concept réaliste guide uniquement la silhouette ; le style final vient des sprites du jeu.

## Charte

- Contour extérieur noir épais, traits internes lisibles, trois à cinq couleurs principales hors ombre et un niveau d'ombre.
- Aplats et volumes simplifiés ; fenêtres sombres opaques, sans sièges ni intérieur détaillé. Pas de texture métallique photoréaliste, reflets de studio, micro-texte ou mécanique illisible.
- Formes iconiques légèrement exagérées ; garder ailes, phares, ouïes et ailerons. Vérifier la lisibilité à la taille réellement affichée dans le garage et la course.
- Même carrosserie et mêmes proportions entre livrées ; peinture seule différente. Conserver les paramètres physiques lors d'une retouche graphique.

## Deux vues distinctes

- Course : vue strictement orthographique de dessus, nez à droite ; aucun flanc, aucune jante latérale. Conserver les dimensions du PNG existant. Pour une nouvelle GT, prendre 420 × 200 comme point de départ.
- Seuls les pneus avant sont absents du sprite de course, afin que le moteur les dessine et les braque ; garder les ailes entières. Les pneus arrière se lisent comme une bande de roulement vue du dessus.
- Menu : voiture complète avec pneus avant et arrière, vue trois quarts basse, nez à gauche. Garder le rapport de perspective, sans étirement arbitraire.
- Fond transparent sans sol, halo ou ombre portée ; le moteur calcule les ombres. Séparer largement les voitures dans l'atlas.

## Intégration et contrôle

1. Générer/retoucher avec l'outil d'image. Conserver les sources dans `art-src/voitures/<modele>/`. Ne pas repeindre les variantes par traitement automatique.
2. Utiliser `tools/pack-cartoon.js` pour isoler les silhouettes complètes ; ne pas découper une voiture aux frontières des cellules.
3. Inspecter les quatre PNG produits ; contrôler transparence, orientation, cadrage, proportions et absence de débris ou halo.
4. Déclarer les ancrages des pneus avant dans `js/cars.js` pour chaque livrée. Mesurer dans le cadre du PNG, vérifier un léger dépassement à roues droites et un braquage visible dans les deux sens. Ne pas modifier les collisions pour adapter une illustration.
5. Exécuter `node --require /workspace/cloud-setup/system-chromium.cjs tools/e2e-cartoon.js /tmp/cartoon-checks` dans l'environnement cloud actuel, et contrôler la planche Canvas du nouveau modèle à côté des modèles de référence. Exécuter aussi le parcours des livrées si les fichiers, noms ou choix changent.
6. Vérifier le garage et un départ en course dans le navigateur. Actualiser la version avec `tools/bump.js` pour les images remplacées. Publier selon l'autorisation de la conversation et indiquer la version et le résultat des contrôles.
