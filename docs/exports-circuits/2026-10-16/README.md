# Circuits hybrid — vues complètes du 16 octobre 2026

Version **0.40.0**. Ce dossier contient les **13 vues tour**, en PNG de 2560 × 1600 pixels, sans voitures ni interface, et à côté de chacune la reprise annotée qui a servi à la produire (`*-tour_reprise.png`). Les anciennes vues de détail et planches de ce dossier ont été supprimées à la demande de l’utilisateur.

[Télécharger les 13 vues tour en ZIP](../circuits-hybrid-2026-10-16.zip)

| Circuit | PNG complet | Reprise annotée |
| --- | --- | --- |
| Monza | [monza-tour.png](monza-tour.png) | [monza-tour_reprise.png](monza-tour_reprise.png) |
| Spa-Francorchamps | [spa-tour.png](spa-tour.png) | [spa-tour_reprise.png](spa-tour_reprise.png) |
| Monaco | [monaco-tour.png](monaco-tour.png) | [monaco-tour_reprise.png](monaco-tour_reprise.png) |
| Silverstone | [silverstone-tour.png](silverstone-tour.png) | [silverstone-tour_reprise.png](silverstone-tour_reprise.png) |
| Suzuka | [suzuka-tour.png](suzuka-tour.png) | [suzuka-tour_reprise.png](suzuka-tour_reprise.png) |
| Interlagos | [interlagos-tour.png](interlagos-tour.png) | [interlagos-tour_reprise.png](interlagos-tour_reprise.png) |
| Laguna Seca | [laguna-tour.png](laguna-tour.png) | [laguna-tour_reprise.png](laguna-tour_reprise.png) |
| Nürburgring GP | [nurburgring-tour.png](nurburgring-tour.png) | [nurburgring-tour_reprise.png](nurburgring-tour_reprise.png) |
| Le Mans | [lemans-tour.png](lemans-tour.png) | [lemans-tour_reprise.png](lemans-tour_reprise.png) |
| Mount Panorama / Bathurst | [bathurst-tour.png](bathurst-tour.png) | [bathurst-tour_reprise.png](bathurst-tour_reprise.png) |
| Red Bull Ring | [redbullring-tour.png](redbullring-tour.png) | [redbullring-tour_reprise.png](redbullring-tour_reprise.png) |
| Paul Ricard | [castellet-tour.png](castellet-tour.png) | [castellet-tour_reprise.png](castellet-tour_reprise.png) |
| Zandvoort | [zandvoort-tour.png](zandvoort-tour.png) | [zandvoort-tour_reprise.png](zandvoort-tour_reprise.png) |

Dernière régénération (0.40.0) : les treize circuits suivent leurs reprises annotées — matières vert/rouge, traits blancs devenus protections, voies des stands déplacées au trait noir, croix, cordes arrondies au trait bleu. [Détail et planches avant/après](../../reprises-circuits/README.md).

Régénération précédente (0.29.1) : remplacement intégral des treize PNG. Suzuka et Zandvoort suivent les reprises annotées : matériaux rouge/vert, piste élargie au trait bleu et rails simples aux croix à Zandvoort ; passage sous pont limité au tablier à Suzuka ; garages de Zandvoort dégagés. [Détail des corrections et références](../../reprises-circuits/README.md).

Corrections précédentes : suppression du décor dont l’empreinte touche une barrière ; fusion moyenne des séparations proches et correction des boucles ; regroupement des petits dégagements de Monaco et Bathurst ; alternance couleur/bitume dans les bandes peintes, y compris Paul Ricard ; protections resserrées aux tunnels/pont de Monaco et Suzuka, avec niveaux de collision séparés et rails du pont visibles sur le tablier.

Les chiffres, flèches et bords jaunes/bleus de gameplay sont conservés. Les lignes centrales sont conservées. La largeur de chaussée change localement à Zandvoort selon le trait bleu demandé ; enveloppes hors piste et protections suivent la même géométrie pour le dessin et les contacts. Aucun panneau de distance ajouté.

[Skill consolidé](../../skill_circuit/skill_circuit.txt) · [Audit des surfaces et limites des références](../../surfaces-circuits/README.md). Les palettes restent artistiques ; les références web n’ont pas pu être consultées.

Validation : tests de surfaces, dégagements, barrières, pistes parallèles et empreintes du décor ; rendu Chromium des circuits. Le contrôle des barrières teste les intersections au même niveau ; un pont peut légitimement croiser un passage inférieur.

Reproduction : `node tools/export-decor.js docs/exports-circuits/2026-10-16 --tour-only` (Playwright/Chromium requis ; dans cet environnement ajouter `--require /workspace/cloud-setup/system-chromium.cjs` à Node).
