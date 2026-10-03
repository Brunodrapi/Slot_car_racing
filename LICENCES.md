# Ce que ce dépôt contient, et sous quelles conditions

Le jeu — son moteur, sa physique, son interface, son réseau, ses outils — est l'œuvre de ses auteurs
et n'est publié sous aucune licence libre à ce jour. Deux éléments viennent d'ailleurs et gardent
leur licence d'origine. Ce fichier dit lesquels, où ils se trouvent, et ce qu'ils exigent.

Il est tenu à jour en même temps que les fichiers qu'il décrit : une licence citée dans un commit et
nulle part ailleurs ne se retrouve pas.

---

## Le moteur sonore — MIT

**[markeasting/engine-audio](https://github.com/markeasting/engine-audio)**, porté en JavaScript
dans `js/engine-audio.js`. Les prises de moteur en viennent également.

- Licence : MIT. Texte complet et copyright de l'auteur : `sounds/engine-audio/LICENSE`, et notice
  en tête de `js/engine-audio.js`.
- Ce qu'elle exige : conserver la notice de copyright et le texte de la licence. C'est fait.
- Elle n'impose rien au reste du projet.

---

## La géométrie des circuits — ODbL 1.0

Les suites de points de `js/traces.js` viennent d'ailleurs. **Ce fichier, et lui seul, porte cette
licence** ; les douze circuits sont relevés dans OpenStreetMap.

Chacun vient d'une relation d'OpenStreetMap, qui est la liste officielle des voies formant le tour ;
Laguna Seca n'en a pas et se lit par la seule étiquette `highway=raceway`. L'écart à la longueur
officielle du circuit est ce qui atteste le relevé :

| circuit | relevé dans OpenStreetMap | longueur relevée / officielle |
|---|---|---|
| Monza | Autodromo Nazionale di Monza | 5 794 / 5 793 m |
| Spa-Francorchamps | Circuit de Spa Francorchamps | 6 995 / 7 004 m |
| Monaco | Circuit de Monaco | 3 338 / 3 337 m |
| Silverstone | Silverstone Grand Prix | 5 881 / 5 891 m |
| Suzuka | 鈴鹿サーキット | 5 807 / 5 807 m |
| Interlagos | Autódromo José Carlos Pace | 4 308 / 4 309 m |
| Laguna Seca | `highway=raceway` | 3 601 / 3 602 m |
| Nürburgring GP | Nürburgring Grand Prix Strecke | 5 116 / 5 148 m |
| Le Mans | Circuit des 24 Heures du Mans | 13 612 / 13 626 m |
| Mount Panorama | Mount Panorama Circuit | 6 197 / 6 213 m |
| Red Bull Ring | Red Bull Ring | 4 300 / 4 318 m |
| Zandvoort | Grand Prix Formule 1 van Nederland | 4 253 / 4 259 m |

© les contributeurs d'OpenStreetMap, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

### Ce que cette licence exige

1. **Créditer** « © les contributeurs d'OpenStreetMap » et nommer la licence — ce tableau, plus
   l'en-tête de `js/traces.js`.
2. **Partager à l'identique la base dérivée.** `js/traces.js` est cette base dérivée : quiconque le
   reprend le fait sous ODbL.
3. **Ne pas la verrouiller** par des moyens techniques.

### Ce qu'elle n'exige pas

L'ODbL distingue la **base dérivée** de l'**œuvre produite**. Le jeu qui affiche un circuit est une
œuvre produite : il doit la citation, et rien de plus. La clause de partage à l'identique porte sur
la base — ici le seul `js/traces.js`. Le moteur, la physique, l'interface et le réseau ne sont pas
une base de données de circuits et n'en relèvent pas.

**Le reste du jeu n'est donc pas affecté.** C'est précisément pour que cette frontière soit lisible
que la géométrie vit dans un fichier à part : mêlée aux largeurs, aux thèmes et aux réglages de
`js/tracks.js`, personne n'aurait pu dire où elle s'arrête — et une obligation qu'on ne sait pas
délimiter finit par être soit ignorée, soit étendue à tort.

### Pourquoi un relevé plutôt qu'une carte

Monza a d'abord été relevé sur un fond de carte vectoriel de Wikimedia Commons, sous CC BY-SA 3.0
(« Monza track map », de Will Pittenger). Une carte de ce genre est un **schéma** : elle donne la
silhouette du circuit, pas ses rayons. Celle-ci dessinait les quatre virages de la Variante del
Rettifilo — entrée, deux apex, sortie — avec **une seule courbe de Bézier**, dont le point le plus
serré revenait à 12 m de rayon sur le vrai circuit. Le relevé en donne 24. À l'échelle du jeu, le
premier repliait le bord intérieur de la route sur lui-même ; le second non.

OpenStreetMap n'est pas un dessin mais un relevé, tracé virage par virage sur l'imagerie aérienne, et
il se vérifie seul : la boucle assemblée doit se refermer, et sa longueur tomber sur la longueur
officielle. À Monza, 5790 m relevés contre 5793 m annoncés. `tools/releve.py` affiche les deux et
refuse de continuer si la boucle reste ouverte. `tools/tracer.py`, qui lit une carte vectorielle,
reste dans le dépôt : il servirait là où rien n'est relevé.

Le Mans a longtemps fait exception, par erreur de notre côté. On ne cherchait que les relations
« type=circuit », et le Circuit de la Sarthe n'en est pas une : n'étant permanent qu'en partie — les
Hunaudières sont la D338 le reste de l'année — il est décrit en « type=route, route=raceway ». Il
venait donc de la carte de Will Pittenger (CC BY-SA 3.0), qui posait sa ligne de départ à huit
kilomètres de sa place. La relation existait depuis toujours ; `js/traces.js` ne porte plus que de
l'ODbL.

### Une nuance, pour qui s'y intéresse

La forme d'un circuit réel est un **fait**, et un fait ne s'approprie pas. Ce que protège une base de
données, c'est l'investissement qui l'a constituée, et ce que protège une carte, c'est son dessin.
Ce que `tools/releve.py` en extrait — six cents points rééchantillonnés, remis à une échelle qui
n'est pas celle du circuit, réorientés — tient davantage de la description d'un lieu physique que de
l'expression de quiconque.

L'argument est sérieux ; il n'est pas une garantie, et il varie selon les pays. Créditer coûte deux
lignes et clôt la question, même là où elle ne se serait pas posée. C'est le parti pris ici.

*Ceci est une lecture des licences, pas un avis juridique.*
