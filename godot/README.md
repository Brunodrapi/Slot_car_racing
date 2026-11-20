# GRIP — le prototype Godot

Un circuit, une voiture : **Stand de frites** en **Breithüft Apex R**, dans Godot 4.7. Il sert à
juger si Godot donne la version payante voulue (Steam et téléphone) : une image régulière, sans à-coups, et
le même jeu qu'en ligne.

Ce qui est repris du jeu web, sans rien réinventer :

- **la physique** de `js/car.js`, portée ligne pour ligne en GDScript (`scripts/voiture.gd`) ;
- **le circuit** tel que `js/track.js` le calcule : tracé, largeurs, lignes, vibreurs, protections ;
- **le décor**, capté ordre de dessin par ordre de dessin dans le navigateur, puis peint par la carte graphique ;
- **la voiture** : son dessin, son ombre et ses pneus avant qui braquent ;
- **la caméra** de `js/render.js`, en vue « devant, nord en haut ». La touche C passe à la vue qui
  tourne avec la piste.

## L'essayer

| Où | Comment |
|---|---|
| Windows | `GRIP-prototype-windows.zip` : décompresser, lancer `GRIP-prototype.exe` |
| Navigateur (ordinateur ou téléphone) | la page `essais/godot/` de la recette |
| Godot 4.7 | Projet > Importer > `godot/project.godot`, puis F5 |

Les commandes :

- **Clavier** : Espace pour les gaz, flèches haut et bas pour la ligne (jaune, idéale, bleue), C pour
  la vue, R pour rejouer, F pour le plein écran.
- **Manette** : RT pour les gaz, dosables ; le stick gauche ou la croix pour la ligne.
- **Doigt** : le levier en bas à gauche pour la ligne (on peut le glisser), n'importe où ailleurs pour les gaz.

En haut à gauche, sous les temps, s'affiche la mesure de fluidité :

- les images par seconde ;
- la pire image de la dernière seconde ;
- le coût d'un pas de physique ;
- les appels de dessin et les triangles envoyés à la carte graphique.

## La physique est la même : la preuve

```
node tools/godot-exporte.js                                   # depuis la racine du dépôt
godot --headless --path godot --script res://tests/parite.gd
```

Le jeu web enregistre trois parcours de la voiture du joueur, chacun avec ses commandes pas à pas :

- **propre** : 190 s, levier changé toutes les sept secondes ;
- **brutal** : 90 s pied au plancher, avec sorties, rails, moteur calé et retour en piste ;
- **hasard** : 90 s de commandes tirées au sort.

Godot rejoue les mêmes commandes et compare :

| parcours | pas | pire écart sur un pas | course libre : pire écart de position | sorties | chocs |
|---|---|---|---|---|---|
| propre | 22 800 | 1,1·10⁻¹³ | 0,36 nanomètre | 0 / 0 | 0 / 0 |
| brutal | 10 800 | 1,0·10⁻¹³ | 0,9 picomètre | 7 / 7 | 7 / 7 |
| hasard | 10 800 | 0,8·10⁻¹³ | 1,7 picomètre | 5 / 5 | 3 / 3 |

Pourquoi l'écart n'est pas tout à fait nul : Godot et le navigateur n'arrondissent pas sinus,
arc-tangente et exponentielle de la même façon. Ils diffèrent à la dernière décimale dans 3 à 18 %
des cas, mesuré sur 200 000 tirages. `Math.hypot` est, lui, reproduit exactement : celui de V8 somme
avec compensation, et un simple `sqrt(x² + y²)` différait dans un tiers des cas. Même dans la
course la plus chahutée, l'écart reste sous le milliardième de millimètre, et aucune décision ne
change : ni sortie de piste, ni choc, ni tour compté.

Un pas de physique coûte environ 85 µs en GDScript pour une voiture. À 120 pas par seconde, cela
fait 1 % d'un cœur de processeur.

## Le décor : du jeu web à la carte graphique

```
NODE_PATH=$(npm root -g) node godot/outils/capture-decor.js spa [--verifie]
node godot/outils/maille-decor.js spa
```

Cela se fait en deux étapes.

1. **La capture** (`outils/capture-decor.js`, `outils/enregistreur.js`)
   - Le jeu s'ouvre dans Chromium. Les deux passes de dessin du monde fixe sont rejouées sur un faux
     canevas qui note chaque forme remplie, chaque trait et chaque image, en mètres.
   - Ce sont les mêmes passes que `js/static-backdrop.js` découpe déjà.
   - Le texte des panneaux devient une petite image. Les images vont dans un atlas unique de 4096 × 1024.
   - Avec `--verifie`, la même vue est peinte deux fois, par le jeu puis à partir des ordres notés. Elles ne
     diffèrent que sur 0,01 % des pixels.
2. **Le maillage** (`outils/maille-decor.js`)
   - Chaque ordre devient des triangles avec la sémantique du canevas : règles de remplissage, traits
     avec jonctions et bouts, tirets (les pneus sont des tirets nuls), découpes.
   - Le tout est rangé en carreaux de 64 m, sans recouvrement. Dans un carreau, les triangles gardent
     l'ordre du peintre.
   - Pour Spa, cela donne 388 000 triangles en 391 carreaux, soit 5,2 Mo compressés.
   - À l'écran, il y a 33 à 37 appels de dessin et 6 000 à 30 000 triangles par image.

Le résultat est le rendu du jeu web, mais peint par la carte graphique, net à tous les zooms, sans
rien redessiner image par image.

## Ce qui n'y est pas encore

- le son ;
- les adversaires et leur pilote automatique ;
- les menus ;
- les autres circuits et voitures ;
- l'usure, les dégâts et les stands ;
- la nuit ;
- la fumée et les traces de pneus ;
- le jeu en ligne.

Tout cela est du travail de portage, sans inconnue technique. Le décor d'un autre circuit se
capture avec la même commande.

## Les choix techniques

- **Moteur de rendu « Mobile »** (Vulkan, Metal, Direct3D 12) sur ordinateur et téléphone. C'est
  lui qui lisse les bords des formes en 2D (MSAA ×4).
  - La version web garde « Compatibility » (WebGL 2). Elle ne lisse pas encore les bords en 2D, et
    l'image y paraît plus crénelée.
  - Le web n'est là que pour essayer vite : la version payante sera une application.
- **Physique à 120 pas par seconde**, comme `race.dt`. L'image est interpolée entre deux pas, si
  bien que le mouvement reste régulier à 60, 120 ou 144 Hz.
- **Le cadre est carré** (720 × 720). En paysage, l'écran garde l'échelle du jeu ; en portrait, la
  largeur reste lisible.

## Les fichiers

| | |
|---|---|
| `scripts/piste.gd` | le circuit et ses lectures (track.js) |
| `scripts/voiture.gd` | la physique (car.js) |
| `scripts/decor.gd` | le chargement des carreaux du décor |
| `scripts/voiture_vue.gd` | le dessin de la voiture |
| `scripts/jeu.gd` | la boucle, la caméra, les commandes |
| `scripts/hud.gd` | le tableau de bord |
| `tests/parite.gd` | la preuve de la physique |
| `tests/photo.gd` | des photos sans écran (Xvfb) |
| `donnees/` | le circuit, la voiture et le décor exportés |
| `outils/` | la capture et le maillage du décor |
| `../tools/godot-exporte.js` | l'export du circuit, de la voiture et des parcours de référence |
