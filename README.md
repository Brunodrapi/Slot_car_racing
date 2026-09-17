# Slot Racer

Jeu de course 2D « un bouton, trois trajectoires », à mi-chemin entre *Pico Rally* et
*Ultimate Racing 2D* : de vraies courses sur des circuits inspirés de vrais tracés, avec le pilotage
slot-racing (on gère l'accélérateur et le choix de la ligne, jamais le volant).

## Jouer

Aucune dépendance, aucun build : ouvrir `index.html` dans un navigateur récent
(double-clic suffit), ou servir le dossier :

```
npx serve .        # ou : python3 -m http.server 8000
```

Fonctionne sur ordinateur (clavier / souris) et sur mobile (tactile, à ajouter à l'écran d'accueil).

### Contrôles

| Action | Ordinateur | Mobile |
| --- | --- | --- |
| Accélérer | maintenir n'importe quelle touche (Espace, etc.) ou le clic | pouce droit sur l'écran |
| Freiner | relâcher | relâcher |
| Trajectoire | flèches (haut/bas ou gauche/droite), molette | pouce gauche sur le curseur vertical |
| Pause | `Échap` ou `P` | — |

La caméra s'oriente par défaut sur la piste (la route monte toujours vers le haut de l'écran), ce qui
permet de voir loin devant même sur un téléphone en portrait. Vue fixe disponible dans les réglages.

Aucune trajectoire n'est dessinée sur la route. Un **guide de freinage** optionnel (réglages) affiche
devant la voiture un ruban coloré par le profil de vitesse de référence du circuit (vert : plein gaz,
orange : virage moyen, rouge : virage lent) et une barre transversale à l'endroit où il faut lever à la
vitesse actuelle.

Trois trajectoires par circuit : **intérieure** (plus courte mais plus serrée, donc plus lente en
virage), **idéale** (extérieur-intérieur-extérieur) et **extérieure** (plus longue mais plus rapide).
La physique suit vraiment la courbe choisie : rayon et distance parcourue changent avec la ligne.
Dépasser = changer de ligne. Physique façon slot racing / Pico Rally : le guide avant reste dans la
rainure (la ligne), l'arrière est tiré derrière. Sous la limite d'adhérence rien ne bouge ; au-dessus,
l'arrière s'ouvre progressivement (contre-braquage visible, jauge d'adhérence dans le rouge, crissement),
un correcteur type PID le ramène en douceur dès que l'adhérence le permet, et la voiture décroche
seulement si l'angle de dérive devient trop grand ou si l'arrière sort de la route. Elle quitte alors la
rainure en gardant sa position et sa vitesse réelles : elle glisse librement sur sa propre trajectoire,
ralentit dans l'herbe ou le gravier, puis le pilote la ramène en roulant jusqu'à retrouver la piste.

## Contenu

- **12 circuits** inspirés de vrais tracés : Monza, Spa-Francorchamps, Monaco, Silverstone, Suzuka
  (avec son pont), Interlagos, Laguna Seca, Nürburgring GP, Le Mans, Mount Panorama, Red Bull Ring, Zandvoort.
- **4 catégories, 6 modèles chacune**, tous avec leurs stats et leur dessin :
  - *F1 classiques* (Type 49, 312 F1, MS80, BT24, Type 72, M23) : peu d'appui, très instables ;
  - *F1 modernes* (Bull, Rosso, Silver Arrow, Papaya, AMR, A5) : très rapides, très stables ;
  - *GT* (M1 Procar, F40, Countach, 911 Turbo, Testarossa, XJ220) ;
  - *Prototypes classiques* (GT40, 917 K, 962 C, XJR-9, 787B, C9).
- **Carrière** : 4 coupes (GT → Prototypes → F1 classiques → F1 modernes), points 25-18-15…,
  adversaires fixes par coupe. Podium = coupe suivante débloquée.
- **Course rapide** et **contre-la-montre** (records par circuit et catégorie), 3 niveaux de difficulté.
- IA qui freine selon son talent, choisit sa ligne pour dépasser, aspire dans le sillage, se touche.
- 12 livrées, français / anglais, son procédural, sauvegarde locale.

## Éditeur de circuits (`editor.html`)

1. Charger une image de fond (plan, vue satellite, capture d'un circuit Ultimate Racing 2D…).
2. Tracer la **ligne idéale** point par point (clic = ajouter, glisser = déplacer, clic droit = supprimer,
   Maj+clic = insérer, molette = zoom, bouton du milieu / Espace+glisser = déplacer la vue, Ctrl+Z = annuler).
3. Tracer les lignes **intérieure** et **extérieure**, ou les dériver automatiquement de l'idéale.
4. Placer le départ sur un point de l'idéale, vérifier le sens (flèches), donner la longueur du tour en mètres.
5. Sauvegarder (stockage local du navigateur), exporter/importer en JSON, ou « Tester dans le jeu ».

La route est calculée autour des trois lignes (largeur variable, asphalte, vibreurs, graviers). Si
l'image contient déjà la piste, décocher « dessiner la route ».

## Atelier voitures (menu → Atelier voitures)

Ajoute tes propres voitures 2D :
- une **image PNG unique** vue de dessus, avant vers la droite, fond transparent ;
- ou un **dossier de sprites Ultimate Racing 2D 2** tel qu'exporté par son éditeur de voitures :
  `car_base.png`, `car_color.png` (ou `main_color.png`) et `car_1.png`…`car_10.png`. Le calque
  « color » est teinté avec la couleur de ta livrée, comme dans UR2D.

Chaque voiture est rattachée à une catégorie (elle en prend la physique) et apparaît dans les menus.

### Ultimate Racing 2D et les circuits

Le format de fichier des circuits d'UR2D 2 n'est pas documenté publiquement (l'éditeur du jeu
travaille dans `AppData/Local/Ultimate_Racing_2D_2`). L'import se fait donc via l'image : capture ou
`ground.png` du circuit dans l'éditeur ci-dessus, puis tracé des trois lignes. Les voitures, elles,
s'importent directement.

## Structure

```
index.html / editor.html   pages du jeu et de l'éditeur
css/style.css              menus
js/util.js                 helpers
js/tracks.js               points de contrôle des circuits intégrés
js/track.js                spline, courbure, largeur variable, trois lignes (auto ou dessinées), croisements
js/cars.js                 catégories, modèles, livrées, noms des pilotes
js/carart.js               dessins vectoriels des modèles + rendu des sprites perso (calques UR2D)
js/car.js                  physique d'une voiture sur sa ligne, profil de vitesse, IA de freinage et de choix de ligne, collisions
js/race.js                 grille, départ, tours, classement, résultats
js/career.js               coupes, déblocages, sauvegarde
js/store.js                IndexedDB (circuits et voitures perso)
js/render.js               rendu canvas (image de fond ou herbe, route, lignes, voitures, HUD, curseur)
js/audio.js                moteur et effets (WebAudio)
js/ui.js                   écrans (menus, sélection, carrière, atelier, résultats), textes FR/EN
js/editor.js               éditeur de circuits
js/main.js                 boucle de jeu, entrées, enchaînement
tools/                     scripts de développement (simulation IA headless, tests Playwright)
```

## Outils de développement

```
node tools/sim.js [catégorie|all] [circuit|all] [easy|medium|hard] [marge]        # courses IA sans navigateur
NODE_PATH=$(npm root -g) node tools/e2e.js <dossier> [largeur] [hauteur]          # parcours du jeu + captures
NODE_PATH=$(npm root -g) node tools/e2e-editor.js <dossier>                        # éditeur → course
NODE_PATH=$(npm root -g) node tools/e2e-workshop.js <dossier>                      # import de sprites → course
```

## Ajouter un circuit intégré

Ajouter une entrée dans `js/tracks.js` : une liste de points `[x, y]` formant une boucle fermée
(y vers le bas, le premier point sur la ligne droite de départ), la longueur cible en mètres, la largeur
et le nombre de tours de référence. Les trois trajectoires sont générées automatiquement. Un circuit
dessiné dans l'éditeur peut aussi être exporté en JSON et copié dans ce fichier.
