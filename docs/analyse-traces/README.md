# Diagnostic du rendu : traces et virages de Zandvoort

Code examiné : hybrid a714341. Aucun changement au jeu ; uniquement des outils de diagnostic et leurs résultats.

## Conclusion

Deux phénomènes distincts : les traces accumulées alourdissent le rendu après plusieurs tours ; à Zandvoort, les protections constituent déjà un coût important sans aucune trace. Le symptôme localisé dans les virages justifie de prioriser les barrières et le rendu du décor en mouvement, plutôt que de supprimer les traces.

Ces essais identifient des coûts reproductibles ; ils ne reproduisent pas directement les saccades sur la machine du joueur. Les autres tâches du jeu (physique, audio, réseau), le navigateur et le matériel partagent le budget de chaque image.

## Zandvoort, sans traces

Seize positions échantillonnées sur tout le circuit, huit voitures, aucune trace ni fumée, caméra en avance fixe. Dix rendus mesurés par variante après échauffement, ordre des variantes alterné. On retire séparément les barrières, les décors, les textures ou le HUD ; on teste aussi les protections allégées existantes.

Balayage complémentaire en mouvement : 240 images à 30 m/s depuis 40 % du tour, 20 premières exclues, caméras en avance fixe et orientée piste. Temps en millisecondes :

| Caméra | Barrières | Médiane | p95 | Maximum |
|---|---|---:|---:|---:|
| avanceFixe | Oui | 10.9 | 12.1 | 13.1 |
| avanceFixe | Non | 5.3 | 6.1 | 10.7 |
| avance | Oui | 12.9 | 14.8 | 19 |
| avance | Non | 4.8 | 5.9 | 9 |

La suppression des barrières est uniquement un outil de mesure. Les retirer du jeu n'est pas la recommandation.

Le renderer redessine la scène vectorielle à chaque image. Les protections (js/render.js, méthode _drawBarriers) sont regroupées dans des chemins mis en cache, mais leurs ombres, rails, reflets, blocs et rangées de pneus doivent toujours être rastérisés. Réduire le nombre d'appels ne rend pas le coût de la géométrie constant. En caméra tournante, la transformation de ces formes change à chaque image.

Le cache des chemins de barrières est reconstruit quand les groupes visibles changent. Ce mécanisme existe déjà ; il ne s'agit donc pas de proposer de nouveau le même regroupement. Les balayages comptent ces reconstructions, sans mesurer séparément leur coût : elles ne peuvent pas être déclarées seules responsables.

Le champ de sélection des autres décors utilise un carré conservateur, avec 60 mètres de marge. Des éléments non visibles peuvent être soumis au dessin, notamment près des portions voisines de piste. Les barrières utilisent déjà une marge plus étroite de 5 mètres : ne pas leur attribuer la marge de 60 mètres.

## Traces de pneus : autre coût, cumulatif

Vraie physique à Monza, huit voitures, adversaires extrêmes, simulation à 60 Hz, course prolongée pour laisser rouler les IA. À 0, 60, 180 et 600 secondes, caméra sur la cellule la plus chargée en traces. Vingt paires de rendus après échauffement ; seule la méthode _drawRubber est désactivée pour la variante sans traces. Les autres éléments de la scène restent identiques au sein de chaque paire.

| Profil | Secondes simulées | Segments stockés | Avec traces, médiane ms | Sans traces, médiane ms |
|---|---:|---:|---:|---:|
| PC | 0 | 0 | 3.8 | 3.9 |
| PC | 60 | 9458 | 19.5 | 17.1 |
| PC | 180 | 25932 | 22.1 | 15 |
| PC | 600 | 87728 | 37.9 | 16.7 |
| Mobile émulé | 0 | 0 | 15.5 | 15.5 |
| Mobile émulé | 60 | 9458 | 91 | 77.5 |
| Mobile émulé | 180 | 25932 | 89.3 | 59.6 |
| Mobile émulé | 600 | 87728 | 176 | 78.6 |

Les segments sont ajoutés deux par deux à chaque image de glissement, puis conservés dans des Path2D par zone de 40 m et par intensité, sans plafond ni simplification. Dix minutes du test produisent 87 728 segments répartis dans seulement 50 cellules/intensités. Le compteur de cellules de tools/perf.js ne révèle pas cette accumulation. À haute fréquence d'affichage, une même trajectoire peut produire davantage de segments : le dépôt devrait dépendre de la distance parcourue plutôt que du nombre d'images.

## Limites indispensables

- Chromium headless cloud, PC 1280 × 720 DPR1. Les temps incluent une lecture de pixel pour terminer le travail Canvas différé ; ce n'est pas une mesure des FPS à l'écran. La lecture peut influencer le chemin de rendu du navigateur.
- Résolution adaptative désactivée, scènes contrôlées. En jeu, la résolution et le détail peuvent diminuer, tandis que la physique et les autres tâches ajoutent leur propre coût.
- Le test mobile des traces utilise Chromium tactile 390 × 844 DPR2 avec CPU bridé ×4. Ce n'est ni Safari ni le GPU d'un iPhone. Aucune estimation de FPS iPhone ne doit en être déduite.
- Pas de mesure sur iPhone physique, ni de profilage mémoire natif. Les causes précises des saccades du joueur restent à confirmer sur son appareil et sa vue.
- Les différences entre variantes ne sont pas nécessairement additives. Les maxima sont sensibles au bruit du système.

## Priorités proposées

1. Zandvoort : mettre en cache le dessin statique des protections sous forme de petites tuiles raster, avec marge aux bords et résolutions adaptées au zoom. Conserver les objets physiques de collision. Mesurer la mémoire et vérifier que l'aspect des pneus reste lisible.
2. Affiner le rejet des décors hors champ et mesurer les scènes où plusieurs portions parallèles entrent dans la sélection. Le détail allégé existant peut servir de repli, mais n'est pas une nouvelle optimisation.
3. Traces : dépôt par distance, puis cache raster incrémental par zone et par intensité. Garder des masques opaques composités avec une opacité fixe pour éviter que les superpositions deviennent noires. Borner la mémoire et libérer les caches au changement de circuit.
4. Valider les progrès par comparaison avant/après en déplacement : temps médians et p95/p99, changements de résolution, présence des barrières et collisions, bords des tuiles, caméra fixe et tournante. Puis test Safari iPhone réel à froid et après plusieurs minutes.

Le budget de 60 images/seconde est 16,7 ms pour l'ensemble des tâches. Il faut garder de la marge, pas seulement ramener un dessin isolé sous ce seuil.

## Reproduction

Avec Node, Playwright et Chromium installés :

    node tools/perf-rubber.js
    node tools/perf-zandvoort.js

Le chemin Chromium peut être fourni via CHROMIUM_PATH. Les outils bloquent les requêtes externes, désactivent les analytics et les scores pendant le test et n'altèrent pas les réglages du joueur.

Résultats : [traces](mesures.json), [Zandvoort](zandvoort.json).
