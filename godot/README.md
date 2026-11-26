# GRIP — la version Godot

La migration du jeu web dans Godot 4.7, pour une version payante sur Steam et sur téléphone. Tout le
contenu du jeu y est, repris du code web et non réinventé :

- **la physique** de `js/car.js` et **la course** de `js/race.js`, portées ligne pour ligne en GDScript :
  - grille et départ ;
  - pilote de l'IA, aimant, dépassements, aspiration ;
  - contacts, drapeaux, pénalités ;
  - arrivée et classement ;
- **les 14 circuits** tels que `js/track.js` les calcule, et **leur décor**, capté ordre de dessin par
  ordre de dessin dans le navigateur, puis peint par la carte graphique ;
- **les 35 voitures et leurs 88 livrées** : nombres, dessin, ombre, pneus qui braquent, suspension des
  monoplaces, vignettes du menu ;
- **les modes** :
  - la course rapide, contre 1 à 11 adversaires, en cinq difficultés ;
  - le contre-la-montre ;
  - l'entraînement, avec le fantôme du pilote « difficile » et le guide de freinage ;
- **les écrans** :
  - l'accueil, le paddock (catégorie, voiture, livrée, caractéristiques, circuit, réglages) ;
  - la pause, les résultats, les réglages, « Comment jouer » ;
  - le tableau de bord de course de `js/render.js`, avec sa version téléphone : la pastille du pouce
    qui vient sous le doigt et porte la vitesse, le classement à gauche sous la carte, les tailles
    serrées du téléphone ;
- **le son** de `js/engine-audio.js` et `js/audio.js` :
  - le moteur simulé et sa boîte, qui accordent les boucles enregistrées ;
  - les crissements, le gravier, le vent ;
  - le choc, le clac du levier, les bips ;
- **les effets** : traces de gomme, fumée, poussière, secousse au choc ;
- **la caméra** du jeu web : vue « devant, nord en haut », ou vue qui tourne avec la piste (touche C ou
  réglages), avec le recul réglable ;
- **la nuit** de `js/render.js` : phares, feux arrière, projecteurs des bacs à gravier, faite avec les
  lumières 2D de Godot ; le jour, les feux stop au freinage. À Monaco, le tunnel laisse entrer le jour côté mer et reste éclairé la nuit.
  La transition se fait sur les 20 mètres qui suivent l’entrée et précèdent la sortie ;
- **les dégâts et les stands** de l'essai du jeu web (branche `claude/degats-visuels`) — voir plus
  bas ;
- **le français et l'anglais**, avec les mots du jeu web ;
- **le multijoueur**, aux mêmes tables que le jeu web : un joueur Godot et un joueur dans le
  navigateur courent ensemble. La version Steam passe, elle, par les salons de Steam.

Le meilleur tour propre est gardé sur l'appareil, par circuit et par voiture.

## Les dégâts et les stands

Repris de l'essai du jeu web (branche `claude/degats-visuels`, fusionnée dans cette branche pour
l'export) ; une option du paddock de la course rapide, **activée par défaut**, et en ligne le
choix de l'hôte (coupée sur une table du jeu web publié, qui ne la connaît pas).

- **La physique** (`voiture.gd`, `course.gd`, et le moteur C++) : la caisse en huit zones qui
  s'enfoncent selon leur dureté (pare-chocs durs, flancs mous) ; les dommages sont la zone la plus
  enfoncée, jusqu'à 35 % de pointe et de reprise en moins, jamais d'adhérence ; le coup de flanc
  au-delà de 6 m/s ; l'**abandon** à 100 km/h droit dans un mur (en solo), classé derrière tous,
  sans points, l'arrivée des autres projetée ; la **voie des stands** de chaque circuit (`pitAt`),
  la coche STAND sous le levier, l'arrêt dans la zone et une réparation de 1,5 s + 6,5 s selon les
  dommages ; l'IA s'arrête au-delà de 45 % s'il reste trois tours.
- **Le dessin** (`degats_vue.gd`, `voiture_vue.gd`) : la tôle en anneaux tendue sur le dessin de la
  voiture, qui tremble puis se fige ; plis, creux et éraflure peints sur une copie du dessin ; les
  roues et les feux suivent la tôle, un feu qui recule de plus de 7 cm est cassé ; étincelles,
  débris qui restent 45 s, fumée au-delà de 30 % ; l'épave qui fume six secondes puis s'efface ;
  l'écran **ABANDON** façon WASTED, la caméra posée sur l'épave qui ondule.
- **Le stand** (`mecanos.gd`, `son.gd`) : six équipes de couleur, une par box marqué de blanc, qui
  courent à la voiture sans passer devant, scotchent le nez et l'arrière, s'occupent des roues, se
  dégagent et rentrent ; le scotch qui s'accumule d'un arrêt à l'autre ; les clés qui tintent, les
  pièces qu'on claque et la visseuse à chocs ; la jauge de tôle et le temps de réparation.

**La preuve** : `tests/parite.gd` rejoue une course de trois tours à Spa avec dégâts et un arrêt au
stand, enregistrée par le jeu web (`node tools/godot-exporte.js spa`) — identique en GDScript et en
C++ (positions, dommages, tours, arrêt) jusqu'à la dérive d'arrondi du sinus, après l'arrêt.
`tests/degats_photo.tscn` et `tests/stand_photo.tscn` photographient les dégâts, l'abandon et un
arrêt au stand dans le vrai écran de course.

## Le tableau mondial

`scripts/mondial.gd` (l'autoload `Mondial`) reprend `js/mondial.js`, sur la même base Supabase :

- **la lecture** est publique : le paddock montre le record du monde de la voiture sur le circuit,
  et son pilote, dans toutes les versions (y compris la version web de Godot) ;
- **l'écriture** passe par la même fonction serveur `record` que le jeu web, qui vérifie tout ;
  seuls les tours nets partent (sans le guide de freinage, hors entraînement), et seule la version
  publiée (`grip/canal = "prod"`) écrit — la recette lit, comme le jeu web ;
- **la connexion Google** (paddock ou réglages) s'ouvre dans le navigateur de l'appareil et revient
  au jeu par une adresse locale (`http://localhost:<port>`, déjà autorisée dans Supabase) : c'est le
  flux PKCE, et la session se renouvelle seule. Les tours nets d'avant la connexion sont rattrapés,
  espacés de seize secondes comme sur le web. La version web de Godot ne se connecte pas : elle lit.

**La version Steam se connecte toute seule**, par le ticket Steam du joueur : la fonction
`supabase/functions/steam` le fait vérifier par Valve, donne au joueur un compte à lui (table
`comptes_steam`, `supabase/steam.sql`) et une session — après quoi tout passe par les mêmes chemins
qu'une connexion Google : la fonction `record`, inchangée, et le palmarès du compte. Un seul tableau
mondial et un seul palmarès pour le web, Godot et Steam ; rien ne change pour les joueurs Google.
Un joueur Steam qui préfère son compte Google (celui du jeu web) peut toujours se connecter avec.

À faire le jour où l'application Steam existe (rien n'est déployé avant) :
1. jouer `supabase/steam.sql` dans la base ;
2. poser les secrets `STEAM_CLE_WEB` (clé Web API d'éditeur) et `STEAM_APP_ID` dans Supabase
   (Edge Functions → Secrets) ;
3. `bash tools/deploie.sh steam --yes --no-verify-jwt` (le joueur n'a pas encore de jeton : c'est
   le ticket Steam qui le prouve), avec l'accord de Bruno ;
4. poser un tour depuis la version Steam et le voir au tableau.

`tests/mondial.tscn` vérifie le chemin de la version Steam contre le faux Supabase (un faux Steam
délivre le ticket) ; la vérification par Valve, elle, ne s'essaie qu'avec la vraie clé.

```
node godot/outils/faux-supabase.js 54321 /tmp/faux.json &        # un faux Supabase
GRIP_MONDIAL_URL=http://127.0.0.1:54321 GRIP_MONDIAL_PUBLIE=1 godot --headless --path godot tests/mondial.tscn
```

## L'essayer

| Où | Comment |
|---|---|
| Navigateur, sur ordinateur ou téléphone | la page `essais/godot/` de la recette |
| Windows | `essais/godot/GRIP-windows.zip` : décompresser, lancer `GRIP.exe` |
| Godot 4.7 | Projet > Importer > `godot/project.godot`, puis F5 |

La version web pèse 21 Mo, plus le moteur de Godot (40 Mo, mis en cache par le navigateur). La version
d'essai pour Windows n'embarque pas les décors non plus. Celui d'un circuit (3 à 6 Mo) se télécharge
la première fois qu'on y roule, puis reste sur l'appareil. Une version vendue les embarquera.

Les commandes :

- **Clavier** :
  - Espace pour les gaz, flèches haut et bas pour la ligne ;
  - C pour la vue, Échap ou P pour la pause, F pour le plein écran ;
  - dans les menus, les flèches, Entrée et Échap.
- **Manette** : RT pour les gaz, dosables ; le stick gauche ou la croix pour la ligne ; Start pour la
  pause ; A et B dans les menus.
- **Doigt** : le levier en bas à gauche (ou à droite, selon les réglages) pour la ligne, n'importe où
  ailleurs pour les gaz.

## La physique est la même : la preuve

```
node tools/godot-exporte.js                                   # depuis la racine du dépôt
godot --headless --path godot --script res://tests/parite.gd
```

Le jeu web enregistre trois parcours de la voiture du joueur seule, chacun avec ses commandes pas à pas :

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

Puis **une course entière** : dix voitures, l'IA en difficulté normale, deux tours, contacts et
drapeaux. Le hasard est tiré d'un même générateur (xorshift32) des deux côtés, et le joueur rejoue
les commandes enregistrées. Résultat sur 27 567 pas :

- les mêmes tours, les mêmes arrivées et le même classement ;
- les temps sont les mêmes à 3·10⁻¹⁴ s près ;
- le hasard est au même point à la fin ;
- l'écart de position ne dépasse jamais 1,3 mm : les arrondis du sinus finissent par jouer dans les
  contacts, sans jamais changer une décision.

## La physique en C++

La course existe en deux langages, qui donnent la même course :

- **en GDScript** (`scripts/voiture.gd`, `scripts/course.gd`) : la référence lisible, et le
  repli quand le moteur C++ manque ;
- **en C++** (`natif/src/`, une GDExtension) : la même transcription, dans le même ordre
  d'opérations, pour l'ordinateur, le téléphone, et le navigateur.

L'écran de course prend le moteur C++ quand il est là (`CourseNative`) et revient à GDScript
sinon. La grille, le classement, les résultats et le guide restent en GDScript. Seuls les pas de
1/120 s passent en C++, et l'état des voitures est relu après chaque pas pour les écrans.

Le test de parité vérifie les deux contre le jeu web :

| | GDScript | C++ |
|---|---|---|
| une voiture seule, par pas | 136 µs | 1,2 µs |
| course à dix voitures, par pas (relais vers les écrans compris) | 1 708 µs | 71 µs |
| écarts au jeu web | ceux du tableau plus haut | les mêmes, au dernier chiffre près |

À 120 pas par seconde, une course à dix voitures prend donc moins de 1 % d'un cœur en C++, contre
12 % en GDScript.

Le C++ est compilé avec `-ffp-contract=off`. Sans cela, le compilateur fusionnerait sur les
processeurs ARM des téléphones des multiplications-additions en une seule instruction, et les
arrondis ne seraient plus ceux de GDScript ni du jeu web.

```
bash natif/construit.sh [linux|windows|android|web|tout]
```

Ce script reconstruit les bibliothèques de `natif/bin/`, qui sont gardées dans le dépôt : on n'a
besoin d'aucun outil C++ pour jouer ni pour exporter le jeu. Elles existent pour Linux, Windows
(MinGW, sans autre dépendance que les DLL système), Android arm64 (NDK r27) et le navigateur.

**Dans le navigateur**, le C++ est un module WebAssembly (`libgrip.web.template_release.wasm32.nothreads.wasm`)
chargé par le modèle d'export « dlink » de Godot (`variant/extensions_support=true` dans l'export Web) :
le moteur du jeu sort alors en deux morceaux, `index.wasm` et `index.side.wasm`. Le module doit être
construit par la version d'Emscripten qui a construit Godot (4.0.20 pour la 4.7.2 ; la console l'écrit au
lancement). Mesuré dans Chromium en iPhone émulé, dix voitures à Spa : un pas de course coûte 0,21 à
0,26 ms en C++, 2,2 à 2,4 ms en GDScript — de quoi rendre au téléphone 4 ms de chaque image à 60 i/s.
Le championnat et les courses en ligne restent en GDScript, partout. Le sinus de la bibliothèque
d'Emscripten (musl) est celui qu'utilisait déjà le GDScript du navigateur.

La version web se publie par `bash outils/publie-web.sh` (export, puis copie dans `essais/godot`).
Le script corrige au passage le service worker que Godot écrit : il remplissait son cache à travers le
cache HTTP du navigateur (dix minutes chez GitHub Pages), et un téléphone pouvait garder la page neuve
avec le moteur d'avant — « GDExtension libraries are not supported by this engine version ». Il va
maintenant chercher ses fichiers sur le réseau et remplace l'ancien dès qu'il est installé ; la page,
si elle tombe malgré tout sur ce mélange, vide ses caches et se recharge une fois.

La version Android n'a pas encore tourné sur un téléphone. Sa bibliothèque mathématique (bionic)
n'arrondit pas le sinus exactement comme celle de Linux : on retrouvera donc des écarts du même
ordre qu'entre Godot et le navigateur, que le test de parité montre sans effet sur la course.

## Le décor : du jeu web à la carte graphique

```
node tools/godot-exporte.js                                         # circuits, catalogue, références
NODE_PATH=$(npm root -g) node godot/outils/capture-voitures.js       # dessins des voitures
NODE_PATH=$(npm root -g) node godot/outils/capture-decor.js spa [--verifie]
node godot/outils/maille-decor.js spa
node godot/outils/sons.js                                           # boucles du moteur en Ogg
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
   - Les couches à part : le tablier d'un croisement (Suzuka) passe par-dessus les voitures qui roulent
     dessous, les passerelles par-dessus toutes.
   - Pour un circuit, cela donne 240 000 à 475 000 triangles, en 144 à 663 carreaux, soit 3 à 6 Mo
     compressés.
   - À l'écran, il y a environ 35 appels de dessin et 6 000 à 30 000 triangles par image.

Le résultat est le rendu du jeu web, mais peint par la carte graphique, net à tous les zooms, sans
rien redessiner image par image.

## Le multijoueur

Il y a deux réseaux, selon la version :

- **La version Steam** ouvre sa table sur les deux réseaux à la fois (`scripts/reseau/salle_pont.gd`) :
  - un salon Steam marqué du code (`salle_steam.gd`) : amis, invitations, relais de Valve ;
  - et la table de l'annuaire PeerJS sous le même code : le jeu web et les autres versions de Godot
    s'y assoient ;
  - l'hôte relaie les présences d'un réseau à l'autre ; un invité Steam qui tape un code cherche un
    salon Steam, puis une table de l'annuaire. Joueurs Steam et hors Steam courent ensemble.
- **Toutes les autres versions** (navigateur, Windows hors Steam, téléphones) s'assoient aux tables
  du jeu web (`scripts/reseau/salle_rtc.gd`) :
  - même annuaire PeerJS et même WebRTC ;
  - même code à quatre lettres, mêmes formules : course, duel, contre-la-montre.

Au-dessus du réseau, c'est le code du jeu web, transcrit ligne pour ligne :

| | |
|---|---|
| `scripts/reseau/net.gd` | la table, le salon, la grille gelée par l'hôte (js/net.js) |
| `scripts/reseau/net_link.gd` | l'aller-retour et l'horloge de l'hôte (NetLink) |
| `scripts/reseau/net_drive.gd` | la course : chacun simule sa voiture, l'hôte l'IA, les contacts, l'arrivée (NetDrive) |
| `scripts/reseau/race_broadcast.gd` | le relevé de course envoyé avec le classement |
| `scripts/reseau/binarypack.gd` | BinaryPack, le format des messages de PeerJS |
| `scripts/reseau/course_en_ligne.gd` | la course d'une table : grille des humains, IA tirée à la graine du départ |
| `scripts/ui/salon.gd` | l'écran : ouvrir, rejoindre, regarder ; réglages de l'hôte, voiture, prêt, départ |

Les messages sont ceux du jeu web, octet pour octet :

- les présences et les paquets de course (protocole 4) ;
- les états de 40 octets (`driveEncode`) ;
- les drapeaux et le relevé.

La grille de l'IA est tirée au même générateur que `makeRoster`, avec la graine du coup d'envoi.

**Les essais**

| | ce qui est vérifié |
|---|---|
| `tests/binarypack.gd` | BinaryPack écrit et relit les mêmes octets que la bibliothèque de PeerJS (58 cas) |
| `tests/roster.gd` | la grille de l'IA est celle du jeu web pour la même graine |
| `tests/salle_annuaire.gd` | ouvrir une table dans un annuaire PeerJS, et le refus d'un code pris |
| `tests/salle_steam.gd` | deux Godot, un faux Steam, duel et course avec l'IA : même classement des deux côtés |
| `tests/salle_pont.gd` | l'hôte Steam (salon et table à code), un ami Steam et un joueur hors Steam : chacun voit les deux autres, même classement sur les trois écrans |
| `outils/essai-croise.js` | la version web de Godot et le jeu web dans Chromium : salon, puis duel et course avec l'IA, Godot hôte puis web hôte ; même classement au millième |
| `outils/essai-croise.js … natif:godot` | la même chose avec Godot hors navigateur, et l'extension WebRTC officielle |
| `tests/rtc_boucle.gd` | deux connexions WebRTC natives reliées à la main : le canal de données passe |

```
npx peerjs --port 9000 --host 127.0.0.1                     # un annuaire local
NODE_PATH=$(npm root -g) node godot/outils/essai-croise.js <recette> godot/exports/web <peerjs.min.js> /tmp/croise course
NODE_PATH=$(npm root -g) node godot/outils/essai-croise.js <recette> natif:godot <peerjs.min.js> /tmp/croise-natif course
```

**Ce qu'il faut ajouter**

- **Sur ordinateur et téléphone, WebRTC vient de l'extension officielle de Godot**
  (godotengine/webrtc-native 1.2.2), dans `addons/webrtc_native` : Windows, Linux et Android.
  - Godot hors navigateur a couru contre le jeu web, salon et courses, hôte et invité : même
    classement au millième.
  - `bash godot/outils/webrtc.sh` réinstalle l'extension complète (Mac, iPhone, ARM…).
- **La version Steam demande :**
  - l'extension GodotSteam 4.24 (codeberg.org/godotsteam), dans `addons/godotsteam` (Windows ; le
    Steam Deck lance la version Windows) — `bash godot/outils/godotsteam.sh` réinstalle tout ;
  - l'identifiant de l'application GRIP sur Steam (`grip/steam_app_id`, 480 en attendant, l'application d'essai de Valve) ;
  - le préréglage d'export « Steam (Windows) », qui pose l'étiquette `steam`.

  Elle n'a tourné que contre le faux Steam de `tests/salle_steam.gd`.
- **Le canal.** Les tables sont celles de la recette du jeu web (`grip/canal`). Une version vendue
  prendra « prod ».

## Ce qui n'y est pas encore

- l'identité Steam au tableau mondial est prête mais pas déployée (il faut l'application Steam et
  sa clé, voir « Le tableau mondial ») ;
- l'usure des pneus, éteinte dans le jeu web ;
- les exports Android et iPhone : le moteur C++ est compilé pour Android, il reste à faire
  l'application (SDK, signature) ; l'iPhone demande un Mac et Xcode ;
- Steamworks au-delà du multijoueur : les succès et les classements.

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
| `scripts/course.gd` | la course, l'IA, les contacts, les drapeaux, le guide (race.js, flags.js) |
| `scripts/hasard.gd` | le hasard reproductible des courses de référence |
| `scripts/catalogue.gd` | les voitures, livrées, pilotes, difficultés |
| `scripts/decor.gd` | les carreaux du décor, et leur téléchargement à la demande |
| `scripts/voiture_vue.gd` | le dessin d'une voiture |
| `scripts/course_vue.gd` | l'écran de course : boucle, caméra, commandes, guide |
| `scripts/hud.gd` | le tableau de bord |
| `scripts/son.gd`, `scripts/effets.gd` | le son, la gomme et la fumée |
| `scripts/app.gd`, `scripts/ui/` | les réglages gardés et les écrans |
| `scripts/reseau/` | le multijoueur (voir plus haut) |
| `tests/parite.gd` | la preuve de la physique et de la course |
| `tests/visite.tscn` | une visite photographiée des écrans (Xvfb) |
| `tests/banc_fluidite.tscn` | le banc de fluidité de la course : images/s, physique, dessins par image (voir son en-tête) |
| `tests/mecanos_photo.tscn` | les mécaniciens de près, planche ou trait par trait, de jour ou de nuit |
| `tests/recommence_ombres.tscn` | une course qui recommence ne laisse pas d'ombre sans voiture sur la piste |
| `donnees/`, `images/`, `sons/` | tout ce que les outils sortent du jeu web |
| `outils/` | les captures, le maillage, les sons |
| `../tools/godot-exporte.js` | l'export des circuits, du catalogue et des courses de référence |
