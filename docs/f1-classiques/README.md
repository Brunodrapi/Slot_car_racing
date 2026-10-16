# Quatre F1 classiques — hybrid

Quatre modèles sélectionnables dans le plateau existant, avec une illustration de course et une illustration de menu par modèle.

| Modèle | Livrée | Référence |
| --- | --- | --- |
| Tyrrell P34 | Elf, Jody Scheckter n°3, 1976 | [Photo historique](https://commons.wikimedia.org/wiki/File:ScheckterJody1976-07-31Tyrrell-FordP34.jpg) |
| Ferrari 312T | Niki Lauda n°12, 1975 | [Voiture de référence](https://commons.wikimedia.org/wiki/File:Ferrari_312T_1975.jpg) |
| McLaren M23 | James Hunt n°11, 1976 | [GP de Grande-Bretagne 1976](https://commons.wikimedia.org/wiki/File:James_Hunt_British_GP_1976.jpg) |
| Lotus 79 | John Player Special, Mario Andretti n°5, 1978 | [Voiture de référence](https://commons.wikimedia.org/wiki/File:Lotus_79_2009_Lime_Rock.jpg) |

La Tyrrell P34 à six roues a été confirmée par l’utilisateur. BT34 désigne un modèle Brabham différent.

## Dessin et gabarit

Illustrations générées à partir de photos historiques et du style des sprites existants : dessin cartoon détaillé, silhouette un peu trapue, empattement raccourci et pneus généreux. Vue de dessus nez à droite ; sélection en trois quarts nez en bas à gauche. La P34 conserve ses quatre petites roues avant et ses deux grandes roues arrière.

Les PNG de course mesurent tous 420 × 205 px ; ceux du menu 420 × 340 px. Les illustrations sont isolées par composante de transparence avec `tools/pack-f1.js`, sans fragments de la vue voisine. Les détails des sponsors sont interprétés par la génération.

## Conduite et son

Les réglages sont des choix de gameplay, pas une simulation historique mesurée. Les F1 restent compatibles avec le plateau existant. La Lotus dispose de davantage d’appui, la Ferrari d’un peu plus de vitesse et d’une glisse plus sensible, la Tyrrell privilégie l’adhérence, la McLaren le compromis.

Les moteurs utilisent la synthèse existante : douze cylindres pour la Ferrari, huit pour les trois Cosworth DFV, sans turbo. Aucun enregistrement d’un autre modèle ne leur est attribué. Les mécanismes de motricité, frein, collisions, dégâts et usure sont réutilisés.

## Validation

- `tools/e2e-f1.js` : sélection, sauvegarde après rechargement, sprite servi et course pour les quatre F1 ; 16 simulations de dix secondes à pas fixe sur Monaco, Spa, Monza et Zandvoort avec accélérateur piloté par l’IA. États finis et voitures effectivement en mouvement. Ces essais vérifient le fonctionnement, pas l’équilibre chronométrique sur une course entière.
- `tools/e2e-livree.js` : 62 images chargées, cycles des neuf voitures à variantes, voitures à une livrée, persistance et livrée de course ; aucune faute, aucune erreur JavaScript.
- Huit PNG vérifiés : transparence et dimensions communes (420 × 205 / 420 × 340).
- [Aperçu des quatre modèles](apercu.png).

## Réglages 0.29.1

[Analyse et mesures du comportement](comportement/README.md) : différenciation mécanique/appui, frein et impulsions, comparaison avant/après et limites du protocole.
