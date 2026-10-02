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

## La géométrie des circuits — CC BY-SA 3.0

Les suites de points de `js/traces.js` sont relevées sur des fonds de carte vectoriels publiés sur
Wikimedia Commons. **Ce fichier, et lui seul, porte cette licence.**

| circuit | carte d'origine | auteur | licence |
|---|---|---|---|
| Monza | [Monza track map](https://commons.wikimedia.org/wiki/File:Monza_track_map.svg) | Will Pittenger | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |

### Ce que cette licence exige

1. **Créditer l'auteur** et nommer la licence — ce tableau, plus l'en-tête de `js/traces.js`.
2. **Partager à l'identique** : les coordonnées de `js/traces.js` sont elles-mêmes sous CC BY-SA 3.0.
   Quiconque les reprend le fait aux mêmes conditions.
3. **Ne pas les verrouiller** par des moyens techniques.

### Ce qu'elle n'exige pas

Le partage à l'identique porte sur **l'adaptation de l'œuvre** — ces coordonnées — et non sur ce qui
les entoure. Une licence Creative Commons n'a pas de clause de liaison : contrairement à la GPL, elle
ne s'étend pas à du code qui se contente d'utiliser la donnée. CC BY-SA 3.0 nomme même le cas, celui
de la « Collection » : un ensemble réunissant l'œuvre avec d'autres éléments indépendants n'a pas à
être placé sous la même licence.

**Le reste du jeu n'est donc pas affecté.** C'est précisément pour que cette frontière soit lisible
que la géométrie vit dans un fichier à part : mêlée aux largeurs, aux thèmes et aux réglages de
`js/tracks.js`, personne n'aurait pu dire où elle s'arrête — et une obligation qu'on ne sait pas
délimiter finit par être soit ignorée, soit étendue à tort.

### Une nuance, pour qui s'y intéresse

La forme d'un circuit réel est un **fait**, et un fait ne s'approprie pas. Ce qu'une licence protège
dans une carte, c'est le dessin : les couleurs, les épaisseurs de trait, les étiquettes, la mise en
page. Ce que `tools/tracer.py` en extrait — cent quatre-vingts points rééchantillonnés, remis à une
échelle qui n'est pas celle du circuit, réorientés — tient davantage de la description d'un lieu
physique que de l'expression de son auteur.

L'argument est sérieux ; il n'est pas une garantie, et il varie selon les pays. Créditer coûte deux
lignes et clôt la question, même là où elle ne se serait pas posée. C'est le parti pris ici.

*Ceci est une lecture des licences, pas un avis juridique.*
