# Conifères — 0.41.6

Deux couleurs seulement, comme les feuillus : une silhouette, et une couronne plus claire décalée vers la lumière (en haut à gauche, du côté opposé à l'ombre portée). Les versions précédentes — une étoile sombre à grandes épines, puis un cône à trois ou quatre étages ombrés — avaient trop de niveaux pour un décor en aplats.

![Avant et après, au Red Bull Ring](avant-apres.webp)

- **Deux formes mélangées** dans les pinèdes et le semis (`pine` et `pine2`, `js/props.js`) : une rosette à pointes fines (essai A) et une couronne ronde à petites dents (essai B), à parts à peu près égales.
- **Quatre teintes à peine différentes** (`TEINTES_SAPIN`) : quelques degrés vers le jaune ou le bleu, un peu plus clair ou plus sombre ; la couronne claire garde le même écart avec la silhouette. Une vignette est cuite par forme et par teinte.
- **Des tailles variées** : de 0,7 à 1,25 fois la taille de base dans les bois (en plus de la réduction en lisière), de 0,72 à 1,28 dans le semis.
- La teinte et la taille sont tirées de la position de l'arbre, sans toucher aux tirages du semis : l'emplacement des arbres ne change pas.

![Pinède du Paul Ricard](pinede-castellet.webp)

Vérification : `decor-banc`, `decor-protections-banc`, `vehicules-banc`, `e2e-barrieres`.
