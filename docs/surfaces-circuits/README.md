# Audit des surfaces hors piste — hybrid 0.27.2

Les références locales de `art/reprise circuit/` ont été ouvertes et comparées aux définitions. L’audit distingue ce qui est lisible dans les images de ce qui reste une approximation. Il ne constitue pas une validation de l’état réel de tous les circuits en 2026 : plusieurs plans sont anciens, schématiques ou touristiques.

## Corrections appliquées

- **Monaco** : les vues `monaco.jpg` et `monaco_2.jpg`, complétées par la consigne utilisateur, excluent les bacs à gravier. Les anciennes zones automatiques sont désormais en bitume, sur exactement les mêmes enveloppes. Pas de gravier résiduel aux raccords.
- **Monza** : suppression du commentaire qui interprétait toute surface claire comme du sable. `monza.jpg` est une carte vectorielle sans légende des matériaux ; `monza_2.jpg` est un schéma ancien, insuffisant pour affirmer « tout gravier ». Des tabliers bitumés sont distingués des bacs extérieurs à Rettifilo, Roggia, Ascari et Parabolica. Les largeurs de 5 à 8 m sont des choix simplifiés du jeu, pas des mesures tirées de ces cartes. L’emplacement précis et l’étendue réelle de ces tabliers demandent une référence aérienne récente ; les autres liserés de Monza ne sont pas certifiés par cet audit.
- **Interlagos** : `interlagos.jpg` montre des bandes de surface peinte autour du ruban ; ce ne sont pas des bacs à gravier. Ajout de tabliers bitumés avant le bac dans les secteurs S de Senna, Descida do Lago et Junção, sans supprimer le gravier extérieur. Largeur simplifiée de 4 m, non mesurée. `interlagos_2.jpg` permet de situer les secteurs, sans certifier leur matière.
- **Red Bull Ring** : `red_bull_ring.jpg` possède une légende distinguant asphalte, gravier et astroturf. Le traitement garde les grandes zones de gravier et sépare des tabliers bitumés adjacents dans les secteurs configurés 1, 3, 4, 6–7, 9 et 10. Largeur simplifiée de 4 m. Attention : l’image est un projet d’extension à 11 virages, différent du tracé actuel du jeu ; elle fournit une lecture de matériaux, pas un relevé exact du tracé.

Un tablier et un bac peuvent coexister dans une même coupe : **route → bitume → gravier → herbe**. La lecture de surface pour les voitures donne priorité au bitume à l’intérieur de son emprise, puis au gravier au-delà. Le rendu peint les couches dans le même ordre.

## Vérification des autres références

| Circuit | Références examinées | Conclusion et limite |
| --- | --- | --- |
| Spa | `circuit_spa_zones.png`, `spa-tour_reprise.png`, `bord_piste_bitume.png` | Légende asphalte/gravier et annotations utilisateur exploitables. Les zones déjà annotées restent prioritaires ; aucun nouveau changement de matière. La photo de Raidillon confirme aussi le bitume peint jaune/rouge et vert. |
| Silverstone | `Silverstone.jpg`, `Silverstone_2.jpg` | Plans stylisés sans légende explicite des matériaux. Les zones mixtes existantes sont conservées ; elles ne peuvent pas être entièrement certifiées par ces images. |
| Suzuka | `suzuka.jpg` | Plan de pilotage, couleurs non légendées pour les surfaces. Identification précise bitume/gravier non résolue ; définition existante conservée. |
| Nürburgring GP | `nurburging_jp.jpg` | Vue aérienne : des aires grises et des bacs clairs distincts sont visibles. Mélange bitume/gravier maintenu ; dimensions et limites fines non relevées. |
| Le Mans | `lemans.jpg`, `lemans_2.jpg` | Plans touristiques/en perspective, sans légende de matériaux exploitable. Ne permettent pas de valider chaque bac ; définition existante conservée. |
| Bathurst | `Mount-Panorama_2.jpg`, `mount-panorama-sector-altitude.png` | Plan touristique et diagramme d’altitude : insuffisants pour classifier précisément les surfaces. Aucun remplacement arbitraire. |
| Paul Ricard | `Map Castellet.JPG` | Dégagements colorés et grandes aires de sécurité visibles. Conserver l’asphalte peint bleu/rouge ; pas de conversion générale des surfaces. Le plan seul ne certifie pas chaque petite zone claire. |
| Zandvoort | `Zandvoort.jpg`, `zandvoort_2.png` | Vue aérienne partielle et plan : mélange de rubans bitumés, zones sableuses et végétation visible. Conserver les matières existantes ; pas de validation exhaustive hors du cadrage aérien. |
| Laguna Seca | Aucune référence correspondante dans le dossier fourni | Non vérifiable avec les images disponibles ; définition existante conservée. |

## Contrôles et exports

`node tools/surfaces-banc.js` compare les données à la version 0.27.0 : tracé, largeur de chaussée, vibreurs, repères et stands restent identiques sur les 13 circuits. Les enveloppes/barrières restent identiques sauf à Zandvoort, où la correction des pistes parallèles réduit les dégagements et retire les segments sans espace sûr. Le banc `paralleles-banc.js` vérifie ces nouveaux dégagements et protections. Il vérifie l’absence totale de gravier à Monaco et les couches bitume/gravier des trois autres circuits corrigés. Les matières changent donc le roulement hors piste aux endroits concernés ; le modèle de motricité sur la piste est inchangé.

Les contrôles existants de dégagements, de décor et de collisions complètent cette vérification. [Exports courants](../exports-circuits/2026-10-16/README.md).
