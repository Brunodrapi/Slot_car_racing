# Circuits hybrid — vues complètes du 16 octobre 2026

Version **0.29.1**. Ce dossier contient uniquement les **13 vues tour**, en PNG de 2560 × 1600 pixels, sans voitures ni interface. Les anciennes vues de détail et planches de ce dossier ont été supprimées à la demande de l’utilisateur.

[Télécharger les 13 vues tour en ZIP](../circuits-hybrid-2026-10-16.zip)

| Circuit | PNG complet |
| --- | --- |
| Monza | [monza-tour.png](monza-tour.png) |
| Spa-Francorchamps | [spa-tour.png](spa-tour.png) |
| Monaco | [monaco-tour.png](monaco-tour.png) |
| Silverstone | [silverstone-tour.png](silverstone-tour.png) |
| Suzuka | [suzuka-tour.png](suzuka-tour.png) |
| Interlagos | [interlagos-tour.png](interlagos-tour.png) |
| Laguna Seca | [laguna-tour.png](laguna-tour.png) |
| Nürburgring GP | [nurburgring-tour.png](nurburgring-tour.png) |
| Le Mans | [lemans-tour.png](lemans-tour.png) |
| Mount Panorama / Bathurst | [bathurst-tour.png](bathurst-tour.png) |
| Red Bull Ring | [redbullring-tour.png](redbullring-tour.png) |
| Paul Ricard | [castellet-tour.png](castellet-tour.png) |
| Zandvoort | [zandvoort-tour.png](zandvoort-tour.png) |

Dernière régénération : remplacement intégral des treize PNG, sans conserver les anciennes images dans ce dossier. Suzuka et Zandvoort suivent les reprises annotées : matériaux rouge/vert, piste élargie au trait bleu et rails simples aux croix à Zandvoort ; passage sous pont limité au tablier à Suzuka ; garages de Zandvoort dégagés. [Détail des corrections et références](../../reprises-circuits/README.md).

Corrections précédentes : suppression du décor dont l’empreinte touche une barrière ; fusion moyenne des séparations proches et correction des boucles ; regroupement des petits dégagements de Monaco et Bathurst ; alternance couleur/bitume dans les bandes peintes, y compris Paul Ricard ; protections resserrées aux tunnels/pont de Monaco et Suzuka, avec niveaux de collision séparés et rails du pont visibles sur le tablier.

Les chiffres, flèches et bords jaunes/bleus de gameplay sont conservés. Les lignes centrales sont conservées. La largeur de chaussée change localement à Zandvoort selon le trait bleu demandé ; enveloppes hors piste et protections suivent la même géométrie pour le dessin et les contacts. Aucun panneau de distance ajouté.

[Skill consolidé](../../skill_circuit/skill_circuit.txt) · [Audit des surfaces et limites des références](../../surfaces-circuits/README.md). Les palettes restent artistiques ; les références web n’ont pas pu être consultées.

Validation : tests de surfaces, dégagements, barrières, pistes parallèles et empreintes du décor ; rendu Chromium des circuits. Le contrôle des barrières teste les intersections au même niveau ; un pont peut légitimement croiser un passage inférieur.

Reproduction : `node tools/export-decor.js docs/exports-circuits/2026-10-16 --tour-only` (Playwright/Chromium requis ; dans cet environnement ajouter `--require /workspace/cloud-setup/system-chromium.cjs` à Node).
