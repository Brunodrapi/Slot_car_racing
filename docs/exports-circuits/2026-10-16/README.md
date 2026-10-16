# Circuits hybrid — export du 16 octobre 2026

Version **0.27.1** : matériaux procéduraux et palettes par circuit suivant le [skill consolidé](../../skill_circuit/skill_circuit.txt) et son [analyse source](../../skill_circuit/analyse_circuit.md).

**78 PNG** : pour chacun des 13 circuits, une vue complète et quatre détails de 2560 × 1600 pixels, plus une planche de synthèse. Captures du jeu sans voitures ni interface ; les cadres complets incluent les dégagements et les protections.

[Télécharger les 13 circuits complets en ZIP](../circuits-hybrid-2026-10-16.zip)

| Circuit | Vue complète | Planche avec détails |
| --- | --- | --- |
| Monza | [monza-tour.png](monza-tour.png) | [monza-planche.png](monza-planche.png) |
| Spa-Francorchamps | [spa-tour.png](spa-tour.png) | [spa-planche.png](spa-planche.png) |
| Monaco | [monaco-tour.png](monaco-tour.png) | [monaco-planche.png](monaco-planche.png) |
| Silverstone | [silverstone-tour.png](silverstone-tour.png) | [silverstone-planche.png](silverstone-planche.png) |
| Suzuka | [suzuka-tour.png](suzuka-tour.png) | [suzuka-planche.png](suzuka-planche.png) |
| Interlagos | [interlagos-tour.png](interlagos-tour.png) | [interlagos-planche.png](interlagos-planche.png) |
| Laguna Seca | [laguna-tour.png](laguna-tour.png) | [laguna-planche.png](laguna-planche.png) |
| Nürburgring GP | [nurburgring-tour.png](nurburgring-tour.png) | [nurburgring-planche.png](nurburgring-planche.png) |
| Le Mans | [lemans-tour.png](lemans-tour.png) | [lemans-planche.png](lemans-planche.png) |
| Mount Panorama / Bathurst | [bathurst-tour.png](bathurst-tour.png) | [bathurst-planche.png](bathurst-planche.png) |
| Red Bull Ring | [redbullring-tour.png](redbullring-tour.png) | [redbullring-planche.png](redbullring-planche.png) |
| Paul Ricard | [castellet-tour.png](castellet-tour.png) | [castellet-planche.png](castellet-planche.png) |
| Zandvoort | [zandvoort-tour.png](zandvoort-tour.png) | [zandvoort-planche.png](zandvoort-planche.png) |

Les détails individuels sont nommés `<circuit>-1.png` à `<circuit>-4.png`. Pour annoter, conserver le nom du circuit dans le nom du fichier.

Le rendu conserve les chiffres et flèches de gameplay et les bordures jaunes/bleues dans leurs dimensions et leur affectation d’origine. Aucun panneau de distance ajouté. Vibreurs rouge/blanc par défaut (variante italienne de Monza conservée), bandes vertes d’approche sur le bitume disponible, dégagements aux palettes configurées, protections à modules colorés et pneus noirs, herbe en aplats irréguliers avec quelques zones sèches. Architecture et végétation restent propres aux circuits ; littoral de Monaco préservé. Aucun asset de décor importé par le nouveau rendu.

Les couleurs des dégagements sont des propositions artistiques configurables, pas des relevés certifiés : la recherche web a été bloquée (HTTP 403). Les zones sans dégagement asphalté ne reçoivent pas de bandes peintes ; on ne transforme pas leurs graviers en bitume. Paul Ricard conserve son motif bleu/rouge spécifique.

Corrections de matières : Monaco entièrement bitumé hors piste ; tabliers bitumés avant gravier distingués à Monza, Interlagos et au Red Bull Ring. Voir le [bilan des références, corrections et incertitudes](../../surfaces-circuits/README.md). Les images schématiques ne permettent pas de certifier toutes les surfaces des autres circuits.

Validation : tracé, largeur de chaussée, vibreurs, repères, stands et enveloppes de protections identiques sur les 13 circuits par comparaison avec 0.27.0. Les matières hors piste changent aux endroits corrigés, ainsi que leur roulement, sans modification du modèle de motricité. Tests `surfaces-banc`, `degagements-banc`, `decor-banc` et `barrieres-banc`. Captures Chromium desktop 1280 × 800 (DPR 2).

Reproduction : `node --require /workspace/cloud-setup/system-chromium.cjs tools/export-decor.js docs/exports-circuits/2026-10-16`. Le préchargement Chromium est propre à l’environnement cloud ; avec Playwright configuré, `node tools/export-decor.js <dossier>` suffit.
