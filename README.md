# Slot Racer

Jeu de course 2D « un seul bouton », à mi-chemin entre *Pico Rally* et *Ultimate Racing 2D* :
de vraies courses sur des circuits inspirés de vrais tracés, avec le pilotage slot-racing
(on ne tourne pas, on gère uniquement l'accélérateur).

## Jouer

Aucune dépendance, aucun build : ouvrir `index.html` dans un navigateur récent
(double-clic suffit), ou servir le dossier :

```
npx serve .        # ou : python3 -m http.server 8000
```

Fonctionne sur ordinateur (clavier / souris) et sur mobile (tactile, à ajouter à l'écran d'accueil).

### Contrôles

| Action | Commande |
| --- | --- |
| Accélérer | maintenir n'importe quelle touche, le clic ou le doigt sur l'écran |
| Freiner | relâcher |
| Pause | `Échap` ou `P` |

Le tracé et les dépassements sont automatiques. Trop vite dans un virage, la voiture glisse vers
l'extérieur (jauge d'adhérence en bas à gauche, crissement) puis part dans le bac à gravier si on insiste.

## Contenu

- **12 circuits** inspirés de vrais tracés : Monza, Spa-Francorchamps, Monaco, Silverstone, Suzuka
  (avec son pont), Interlagos, Laguna Seca, Nürburgring GP, Le Mans, Mount Panorama, Red Bull Ring, Zandvoort.
- **8 catégories de voitures** aux comportements distincts : Karting, Tourisme, Rallye, GT3, F1 classique,
  Prototype, Formule, Muscle (vitesse, freinage, adhérence, appui aérodynamique, brutalité de la glisse).
- **Carrière** : 8 coupes enchaînées, avec classement par points (25-18-15…), roster d'adversaires fixe
  par coupe. Podium = coupe suivante débloquée (catégorie et circuits deviennent disponibles en course rapide).
- **Course rapide** : n'importe quelle catégorie / circuit débloqué, 3 niveaux de difficulté.
- **Contre-la-montre** : seul en piste, records de tour sauvegardés par circuit et catégorie.
- Adversaires IA qui freinent en fonction de leur talent, se battent pour la trajectoire, se doublent et se touchent.
- 12 livrées, français / anglais, son procédural (moteur, crissement), sauvegarde locale (`localStorage`).

## Structure

```
index.html        page unique
css/style.css     menus
js/tracks.js      points de contrôle des circuits
js/track.js       spline, courbure, kerbs, détection des croisements
js/cars.js        catégories, livrées, noms des pilotes
js/car.js         physique d'une voiture, trajectoire / dépassement, IA de freinage, collisions
js/race.js        grille, départ, tours, classement, résultats
js/career.js      coupes, déblocages, sauvegarde
js/render.js      rendu canvas (piste, voitures, effets, HUD)
js/audio.js       moteur et effets (WebAudio)
js/ui.js          écrans (menus, sélection, carrière, résultats), textes FR/EN
js/main.js        boucle de jeu, entrées, enchaînement
tools/            scripts de développement (simulation IA headless, captures Playwright)
```

## Outils de développement

```
node tools/sim.js [classe|all] [circuit|all] [easy|medium|hard] [marge]   # courses IA sans navigateur
NODE_PATH=$(npm root -g) node tools/e2e.js <dossier_captures> [largeur] [hauteur]   # parcours du jeu + captures
```

## Ajouter un circuit

Ajouter une entrée dans `js/tracks.js` : une liste de points `[x, y]` formant une boucle fermée
(y vers le bas, le premier point sur la ligne droite de départ), la longueur cible en mètres, la largeur
et le nombre de tours de référence. Tout le reste (lissage, kerbs, graviers, mini-carte, vignette) est calculé.
