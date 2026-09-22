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
| Accélérer | maintenir n'importe quelle touche (Espace, etc.) ou le clic | poser le pouce n'importe où hors du curseur |
| Freiner | relâcher | relâcher |
| Trajectoire | flèches (haut/bas ou gauche/droite), molette | pouce gauche sur le curseur vertical |
| Pause | `Échap` ou `P` | — |
| Télémétrie | `G` | réglages |

L'accélérateur reprend le contrôle de *SpotRacers*, en trois morceaux :

- une **pastille blanche** sur laquelle le pouce se pose : on maintient pour accélérer, on relâche pour
  freiner. Elle s'enfonce légèrement tant que le gaz est maintenu ;
- une **jauge en éventail** derrière elle, de l'arrêt à la vitesse maximale de la voiture, avec une
  aiguille à la vitesse courante ;
- un **bandeau blanc** au-dessus, avec la vitesse en chiffres.

C'est un contrôle flottant : il **suit le pouce**, pastille centrée sur le doigt, donc la jauge et les
chiffres se lisent au-dessus de la main. Glisser sans lever l'emmène avec soi. Il revient en bas au
centre pour une nouvelle course, une rotation d'écran, ou quand on joue au clavier.

**L'aiguille porte aussi l'adhérence** : pâle tant qu'il y a de la marge, puis jaune, orange et rouge
selon l'usage des pneus, en s'épaississant. Un seul repère dit donc à la fois où on en est en vitesse
et combien il reste de marge.

Le cadran ne peut jamais recouvrir le curseur de trajectoire : le pouce gauche garde sa colonne, le
pouce droit emmène le cadran où il veut. Sur téléphone la minicarte passe en haut à droite, le bas de
l'écran appartenant au pouce.

> **Version allégée.** Le jeu se limite pour l'instant à la **course rapide** et au
> **contre-la-montre**, avec une seule catégorie de voitures, la GT, et ses six modèles. La
> carrière et les autres catégories restent dans le code, elles ne sont simplement plus proposées :
> `SIMPLE` dans `js/cars.js` et le bouton du menu dans `js/ui.js` suffisent à les rouvrir.

Trois vues dans les réglages :

- **Dessus, fixe** (par défaut) : le nord reste en haut, la caméra ne fait que suivre ;
- **Dessus, orientée piste** : la route monte toujours vers le haut de l'écran, ce qui permet de voir
  loin devant même sur un téléphone en portrait ;
- **Isométrique** : le sol est incliné, la caméra ne tourne pas non plus. Seule cette vue affiche le
  décor, et seule elle utilise les planches de rotations des voitures.

Aucune trajectoire n'est dessinée sur la route. Un **guide de freinage** optionnel (réglages) affiche
devant la voiture un ruban coloré par le profil de vitesse de référence du circuit (vert : plein gaz,
orange : virage moyen, rouge : virage lent) et une barre transversale à l'endroit où il faut lever à la
vitesse actuelle.

Trois trajectoires par circuit : **intérieure** (plus courte mais plus serrée, donc plus lente en
virage), **idéale** (extérieur-intérieur-extérieur) et **extérieure** (plus longue mais plus rapide).
Dépasser = changer de ligne.

## À plusieurs

Une table, un code de quatre lettres. L'un ouvre la table et dicte son code, les autres le
saisissent ; jusqu'à six écrans. Chacun choisit sa voiture, se déclare prêt, et l'hôte lâche le
drapeau. Après l'arrivée on retombe sur la table, prêts à repartir.

| Format | Sur la piste | Contacts |
| --- | --- | --- |
| **Course** | tout le monde sur la grille, complétée par des IA | oui |
| **Duel** | les humains et personne d'autre | oui |
| **Contre-la-montre** | les humains, chacun son tour | non, les voitures se traversent |

**Un seul écran simule.** L'hôte — celui qui a ouvert la table — fait tourner la course et publie
l'état de chaque voiture trente fois par seconde. Les invités ne publient que deux nombres, gaz et
choix de ligne, et rejouent ce qu'ils reçoivent. Aucun invité ne prédit quoi que ce soit, donc aucun
ne peut être en désaccord avec l'hôte : ce qu'un invité voit est la course de l'hôte, avec une
fraction de seconde de retard. Entre deux images reçues, les voitures avancent le long de leur
propre vitesse — non pour deviner la suite, seulement pour que l'écran ne se fige pas.

Le canal n'est ni fiable ni ordonné : une image d'entrées peut arriver après une plus récente, et la
rejouer ferait repartir un gaz déjà relâché. On ne lit donc que ce qui avance, de chaque côté.

**Rien ne passe par un serveur de jeu.** Les données vont directement d'un appareil à l'autre en
WebRTC ; un annuaire public (le courtier PeerJS) ne sert qu'à présenter les deux navigateurs l'un à
l'autre au moment de rejoindre, et ne voit jamais une seule image de course. Rien n'est conservé :
fermer la page ferme la table. Deux limites en découlent — l'annuaire est un service gratuit, il peut
être lent ou indisponible, et faute de serveur de relais deux réseaux très fermés peuvent ne jamais
se joindre. Le jeu le dit alors au lieu d'attendre. Pour pointer son propre serveur de signalisation :

```html
<script>window.SLOT_RACER_RTC = { peer: { host: 'exemple.net', port: 443, path: '/', secure: true } };</script>
```

Le transport vient de *Botminton*, où la même surface sert aussi de secours à la capacité `room` de
claude.ai.

## Voitures dessinées

Un modèle peut fournir un **dessin de la vraie voiture vue à la verticale** (`top` dans
`js/cars.js`), qui remplace alors la silhouette vectorielle *et* la livrée choisie : ce sont des
voitures précises dans leurs couleurs, pas une forme à peindre. L'ombre suit leur contour au lieu
d'être un rectangle posé dessous — la silhouette est remplie de noir une fois et gardée.

`tools/topcar.py <image> <id du modèle> [--nose=left] [--width=420]` prépare une illustration. Le
fond est retiré par **remplissage depuis le bord** et non par seuil de couleur : une M1 Procar est
blanche sur fond blanc, et un seuil la mangerait entière — le trait sombre qui entoure la
carrosserie arrête le remplissage, le blanc intérieur est conservé. L'image est ensuite redressée
(l'axe long de la voiture est mesuré et ramené à l'horizontale, ce qui a valu un tiers de degré à la
F40) puis tournée pour que l'avant pointe vers la droite, ce que le jeu attend.

Le dessin est mis à l'échelle sur la **longueur** de la voiture, en gardant ses proportions : une
illustration inclut les rétroviseurs et l'aileron, elle sort donc un peu plus large que la boîte de
collision.

## Les trois trajectoires

La trajectoire idéale n'est pas devinée, elle est **résolue**. On écrit la ligne comme un décalage
latéral `a(i)` à chaque mètre du circuit — le point vaut alors `C(i) + n(i)·a(i)` — et on cherche les
décalages qui font que le chemin plie le moins possible :

> minimiser Σ |P(i-1) − 2·P(i) + P(i+1)|², la ligne devant rester sur la route

C'est la trajectoire de courbure minimale, et elle produit le **extérieur-corde-extérieur** toute
seule : le solveur découvre qu'entrer large permet de prendre le virage sur un plus grand rayon, et
que le virage suivant décide du côté de sortie. Rien sur les virages n'est écrit nulle part — la
forme de la route et sa largeur suffisent.

Elle est résolue par relaxation, sur une **échelle de portées**. Faite au mètre seulement, la
relaxation ne finit jamais : une passe ne transporte un changement que d'un échantillon, si bien
qu'au bout de six cents passes le bout d'une ligne droite ignore encore le virage vers lequel elle
mène — alors qu'une trajectoire idéale, c'est précisément le virage qui remonte la ligne droite.
On mesure donc d'abord le pli entre des points distants de soixante-quatre mètres, ce qui trouve la
forme d'ensemble, puis on resserre jusqu'au mètre.

Les deux autres lignes sont des décalages par rapport à la rapide, et non des lignes à part
entière : l'intérieure ferme la porte, l'extérieure passe autour.

**Ce qui la retenait au milieu de la piste**, avant, n'était pas seulement la formule qu'elle
remplace : un limiteur bornait le déplacement latéral à sept centimètres par mètre parcouru. À ce
rythme, traverser sept mètres de route demande cent mètres — la ligne n'atteignait jamais
l'extérieur avant un virage. La trajectoire résolue a droit à trente centimètres par mètre ; sa
courbure est déjà la plus faible que la route autorise, un plafond de pente ne peut que la
réaplatir vers le centre.

Au banc d'essai (`tools/step.js`, une voiture seule à 95 % de la limite), les douze circuits gagnent
entre une et quatre secondes au tour, sans une seule sortie de piste, et la demande d'adhérence
reste au niveau d'avant. En course l'IA est aussi plus propre : soixante sorties sur les douze
circuits contre près de deux cents.

Et les trois lignes veulent enfin dire quelque chose. Avant, le tour idéal de l'intérieure, de la
rapide et de l'extérieure tenait en une seconde d'écart à Monza — autant tirer au sort. Maintenant
la rapide est à 61 s, les deux autres à 73 et 74.

## Physique

La ligne est une **intention de trajectoire**, jamais une position imposée : le pilote automatique ne
fournit qu'un angle de braquage, tout le reste sort de la physique. La voiture est un corps libre, avec
une direction (là où elle pointe) et une vitesse (là où elle va) qui ne coïncident que tant que les
pneus ont de la marge.

```
ligne visée → braquage désiré → forces des deux trains → rotation (lacet) + glissement → position
```

- **Deux trains, deux angles de dérive.** Chaque essieu calcule la vitesse latérale de ses roues divisée
  par la vitesse de roulement : c'est son angle de dérive. La force latérale monte linéairement jusqu'à
  un angle de dérive optimal (`slipPeak`, propre à chaque catégorie) puis sature — au-delà, le pneu ne
  donne plus rien de plus et la voiture glisse. Un temps de relaxation empêche les forces d'apparaître
  d'un coup.
- **Sous-virage d'abord.** Trop vite en entrée de virage, l'avant sature : la voiture tourne moins que
  demandé et va au large, sans jamais partir brutalement. C'est le comportement par défaut sur un simple
  excès de vitesse.
- **Survirage sur grosse perte.** Si l'arrière sature avant l'avant (voiture instable, choc, gravier d'un
  seul côté), l'arrière s'ouvre, l'angle de dérive de la caisse monte, et le pilote applique
  naturellement du contre-braquage : le correcteur travaille sur la **vitesse de lacet**, donc dès que la
  voiture tourne plus vite que la ligne ne le demande, le braquage s'inverse tout seul.
- **Retour progressif.** L'adhérence revient quand les angles de dérive redescendent. Rien n'est jamais
  recollé à la ligne, ni sur la route ni dans le bac à gravier : la voiture y entre et en sort sur sa
  vraie trajectoire, avec sa vraie vitesse.
- Résultat visé : un **drift quatre roues** visible à la limite, sans le moindre coup de volant du joueur.
- **Hors piste**, l'herbe et le gravier freinent le vecteur vitesse entier : une voiture qui arrive en
  travers est ralentie en travers. Après 8 secondes d'ensablement, les commissaires la remettent au bord
  de la piste, dans le bon sens et au pas.

Les changements de trajectoire sont eux aussi progressifs : déplacer le curseur déplace l'intention, pas
la voiture.

### Télémétrie (touche `G`, ou réglages)

Quatre valeurs suffisent à lire le comportement de la voiture :

| Valeur | Ce qu'elle dit |
| --- | --- |
| `speed` | vitesse réelle (norme du vecteur vitesse, pas la vitesse longitudinale) |
| `slipAngle` | angle entre la direction de la caisse et sa trajectoire réelle |
| `lateralVel` | vitesse latérale en m/s (positive vers la gauche) |
| `gripUsage` | accélération latérale demandée / adhérence disponible |

`gripUsage` se lit ainsi : **0 – 0,7** stable · **0,7 – 1,0** chargé · **1,0 – 1,2** léger drift ·
**1,2 – 1,5** vraie glisse · **au-delà** perte d'adhérence. La jauge d'adhérence du HUD utilise les mêmes
seuils et les mêmes couleurs. Les deux angles de dérive (avant / arrière) et le braquage sont affichés en
dessous : avant > arrière = sous-virage, arrière > avant = survirage.

## Style

### Thèmes de circuit

Chaque circuit peut nommer un **thème** (`theme` dans `js/tracks.js`), qui remplace la palette
entière plutôt que de la teinter : le sol, le bitume, les lignes, la couleur des vibreurs et celle
du décor changent ensemble. Silverstone se court en **automne** — chaume pâle, terre ocre, arbres
roux et **vibreurs bleu et blanc** — là où les autres gardent le vert saturé et le rouge et blanc.
Ajouter un thème, c'est une entrée dans `THEMES`, au début de `js/render.js`.

Le décor vise un rendu **cartoon isométrique** : bitume sombre et plat, contour foncé marqué autour de
la route, ligne jaune discontinue au milieu, marquages blancs sur les bords, herbe saturée à taches
carrées alignées sur une grille de pixels.

Les **vibreurs** sont des quadrilatères pleins, alternés, encadrés d'un trait foncé des deux côtés,
posés juste à l'extérieur de la ligne blanche. Ils étaient auparavant tracés au trait pointillé, ce
qui prenait l'embout de ligne arrondi que ce style emploie partout ailleurs : les blocs sortaient en
gélules. Une forme pleine n'a pas d'embout, donc les arêtes restent franches à tous les zooms. Et le
fait de les décaler de la ligne blanche compte autant : à cheval dessus, les blocs blancs
disparaissaient dans la peinture et le vibreur se lisait comme une file de tirets bleus. Les voitures venant d'une
planche sont dessinées **sans lissage**, pour que le pixel art reste net.

### Panneaux de freinage

Sur l'approche de chaque virage, trois panneaux au bord de la piste annoncent la distance — **200,
100, 50 mètres** — et, au-dessus du chiffre, le **symbole des notes de rallye** : une tige droite
qui se coude près du sommet, d'autant plus que le virage est fermé, et qui pointe du côté où la
route tourne. Un coup d'œil donne les deux choses à la fois, à quelle distance et à quel point
c'est serré.

Les notes vont de **6** (à peine un décroché) à **1** (extrêmement fermé), avec un dégradé du vert
au rouge, plus trois virages nommés qui ont leur propre dessin et leurs initiales, comme sur une
charte de copilote :

| note | dessin | couleur |
| --- | --- | --- |
| 6 → 1 | tige qui se coude de 20° à 135° | vert → orange |
| **SQ** carré | angle droit net | orange |
| **HP** épingle | demi-tour arrondi | orange foncé |
| **AC** aigu | repli en V | rouge |

Le nom ne vient pas du rayon seul : c'est l'angle total dont la route tourne qui décide. Une
parabolique de 180° au rayon large reste une note 3, pas une épingle.

Tout est déduit de la géométrie, aucun circuit n'est annoté à la main. Les virages sont d'abord
regroupés en **zones de freinage** : une chicane ou une suite d'esses, c'est un seul freinage, pas
trois, et poser des panneaux devant chacun de ses virages ne ferait qu'encombrer l'approche. La
sévérité vient du rayon le plus serré de la zone, la direction de la flèche du **premier** virage —
dans une chicane, c'est le premier côté qui compte. Une courbe trop ouverte pour demander un
freinage n'a pas de panneau, un panneau qui tomberait dans un autre virage est abandonné, et deux
panneaux trop proches, ce sont deux panneaux illisibles : on garde celui du virage le plus proche.

Le panneau est peint à plat, tourné avec la piste, donc il se lit à l'endroit quand on arrive. Il se
tient à l'extérieur du virage, où il y a de la place et où il reste loin de la corde.

`node tools/arrow.js <circuit>` capture chaque flèche réellement dessinée et compare le sens dans
lequel elle se coude à celui dans lequel la route tourne vraiment. C'est ce contrôle qui a rattrapé
les deux erreurs de signe de la première version : les panneaux étaient à l'intérieur du virage et
les flèches à l'envers, ce qui ne se voit pas sur une vignette.

Le symbole est mesuré puis ajusté à la boîte qu'on lui donne, en **deux passes** : la pointe fait
une taille fixe sur le panneau et non une fraction du dessin, sans quoi elle disparaît sur les notes
ouvertes, dessinées bien plus petit qu'une épingle — il ne reste alors qu'une barre sans direction.

### Décor

Deux décors, pour deux façons de regarder le monde.

En **vue de dessus**, `js/props.js` dessine des objets **vus à la verticale** : un arbre y est une
couronne et son ombre, pas un tronc. Feuillus, sapins en rosette, buissons, rochers, piles de rondins
et bottes de paille, tous tracés dans la palette du circuit puis cuits une fois en image. Ils se
posent plus près de la piste que les panneaux publicitaires : vu du ciel il n'y a pas d'horizon à
remplir, et un arbre planté trop loin n'entre jamais dans le cadre. S'y ajoutent des **plaques de
terre nue** sous le bitume, comme un circuit en use autour de ses virages.

En **vue isométrique**, ce sont les sprites de trois quarts découpés dans la planche, qui n'auraient
aucun sens vus du dessus.

Autour de la piste, `js/props.js` sème des objets debout — chênes, sapins, buissons, maisons, granges,
barrières, puits, tonneaux, ruines. Ils viennent d'une planche de sprites isométriques découpée par
`tools/env.py`, et portent leur propre ombre portée, passée en noir translucide pour qu'elle
assombrisse l'herbe au lieu d'y poser une dalle de la couleur de la planche. Le semis est
**déterministe** : un circuit retrouve toujours le même décor, d'une
partie à l'autre. Chaque type indique la bande dans laquelle il aime se poser, mesurée depuis le bord
de la piste : barrières, tonneaux et caisses collent aux graviers, les maisons se tiennent en
retrait, les arbres remplissent entre les deux. Ces bandes sont serrées parce que la caméra ne montre
qu'environ vingt-cinq mètres de chaque côté de la voiture ; plus loin, un objet existe mais
n'apparaît jamais. Un candidat est refusé s'il tombe trop près d'un morceau quelconque du circuit —
ce qui compte là où le tracé se replie — ou trop près d'un objet déjà posé.

En vue isométrique, décor et voitures sont **triés ensemble** par leur position à l'écran, de sorte
qu'une voiture passe devant un arbre placé plus haut et derrière un arbre placé plus bas.

`sprites/env/README.md` donne la commande de découpe et la façon de brancher un nouvel objet.

## Vue isométrique (optionnelle)

Elle a été essayée comme vue par défaut, puis écartée : donner à chaque voiture ses vues sous tous
les angles demande une planche de rotations par modèle, et c'est plus de travail de sprites que le
jeu peut en porter. Le jeu s'ouvre donc de nouveau en **vue de dessus**, où une seule silhouette
vectorielle suffit par voiture, et toute la catégorie GT est jouable. La vue isométrique reste dans
les réglages, et le décor avec elle ; la branche `isometric` garde l'essai tel quel.

Une caméra orthographique inclinée regardant une piste plate, c'est exactement un écrasement vertical
de la vue de dessus. Aucun moteur 3D, aucune dépendance : la route, les vibreurs et les graviers se
projettent justes puisqu'ils sont plats, et à zoom latéral égal on voit environ **1,8 fois plus de
piste devant soi** qu'en vue de dessus. La caméra ne tourne pas, donc une voiture se présente sous
tous ses angles au fil d'un tour.

Les voitures y prennent du volume de deux façons :

- **Planche de rotations** si le modèle en fournit une (`sheet` dans `js/cars.js`, un dossier de
  `v0.png`…`vN-1.png` pris tous les 360/N degrés, `sheetRear` désignant la vue de dos). Le moteur
  prend la vue la plus proche du cap relatif à la caméra et applique le reste de l'angle en rotation
  d'écran. Une planche rendue en **cadre fixe** déclare en plus sa largeur en mètres (`sheetW`) et
  l'endroit où se pose la voiture dans l'image (`sheetAnchor`) : l'échelle est alors exacte et le
  point d'appui ne bouge jamais d'une vue à l'autre. Sans ces deux valeurs, le moteur retombe sur la
  largeur qu'occuperait une boîte aux dimensions de la voiture, tout ce qu'on peut déduire d'une
  planche découpée vue par vue. La *Testarossa* (seize vues, cadre fixe) et la *F40 LM* (huit vues)
  sont les premières converties.
- **Empilement de sprites** sinon : la silhouette vue de dessus est dessinée à des hauteurs
  croissantes, ce qui sous une caméra inclinée la décale vers le haut de l'écran et lui donne des
  flancs. Aucun dessin nouveau n'est nécessaire, c'est juste au cap près, et le nombre de couches suit
  le zoom pour éviter l'escalier. Les niveaux d'ombre sont cuits une fois par modèle et par livrée
  dans des canvas hors écran : appliquer un filtre canvas à chaque tracé ferait tomber le jeu sous une
  image par seconde.

Les deux cohabitent, ce qui permet de convertir la grille voiture par voiture.

## Contenu

- **6 voitures GT** : *M1 Procar*, *F40*, *Countach LP500*, *911 Turbo*, *Testarossa*, *XJ220*.
  La M1 Procar et la F40 LM sont dessinées d'après la vraie voiture vue du dessus (plus la 787B,
  rangée dans les prototypes classiques) ; les autres gardent leur silhouette vectorielle. Quatre
  ont en plus une planche de rotations, qui ne sert qu'à la vue isométrique.
- **12 circuits** inspirés de vrais tracés : Monza, Spa-Francorchamps, Monaco, Silverstone, Suzuka
  (avec son pont), Interlagos, Laguna Seca, Nürburgring GP, Le Mans, Mount Panorama, Red Bull Ring, Zandvoort.
- Dans le code, toujours **4 catégories de 6 modèles**, avec leurs stats et leur dessin vectoriel,
  même si une seule catégorie est proposée pour l'instant :
  - *F1 classiques* (Type 49, 312 F1, MS80, BT24, Type 72, M23) : peu d'appui, très instables ;
  - *F1 modernes* (Bull, Rosso, Silver Arrow, Papaya, AMR, A5) : très rapides, très stables ;
  - *GT* (M1 Procar, F40, Countach, 911 Turbo, Testarossa, XJ220) ;
  - *Prototypes classiques* (GT40, 917 K, 962 C, XJR-9, 787B, C9).
- **Course rapide** et **contre-la-montre** (records par circuit et catégorie), 3 niveaux de difficulté.
- Une **carrière** en 4 coupes existe dans le code, actuellement masquée.
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
js/track.js                spline, courbure, largeur variable, trois lignes (auto ou dessinées), croisements, panneaux de freinage
js/cars.js                 catégories, modèles, livrées, noms des pilotes
js/props.js                décor autour de la piste (types, semis déterministe)
js/carart.js               dessins vectoriels des modèles + rendu des sprites perso (calques UR2D)
sprites/                   planches de rotations pour la vue isométrique (v0…vN-1 par modèle)
sprites/env/               objets de décor découpés dans sprites/environnement/
sprites/top/               voitures dessinées vues à la verticale
tools/sheet.py             fabrique une planche à partir d'un dossier de rendus
tools/env.py               découpe une planche de décor en objets séparés
js/car.js                  physique (corps libre, deux trains), pilote automatique, profil de vitesse, IA de freinage et de choix de ligne, collisions
js/race.js                 grille, départ, tours, classement, résultats, instantanés pour le jeu en ligne
js/room-rtc.js             le transport : un tableau de présences au-dessus de WebRTC
js/net.js                  jeu en ligne : table, formats, boucle de l'hôte et des invités
js/career.js               coupes, déblocages, sauvegarde
js/store.js                IndexedDB (circuits et voitures perso)
js/render.js               rendu canvas (image de fond ou herbe, route, lignes, voitures, HUD, curseur)
js/audio.js                moteur et effets (WebAudio)
js/ui.js                   écrans (menus, sélection, carrière, atelier, résultats), textes FR/EN
js/editor.js               éditeur de circuits
js/main.js                 boucle de jeu, entrées, enchaînement
tools/                     scripts de développement (simulation IA headless, diagnostics physique, tests Playwright)
```

## Outils de développement

```
node tools/sim.js [catégorie|all] [circuit|all] [easy|medium|hard] [marge]        # courses IA sans navigateur
NODE_PATH=$(npm root -g) node tools/e2e.js <dossier> [largeur] [hauteur]          # parcours du jeu + captures
NODE_PATH=$(npm root -g) node tools/e2e-editor.js <dossier>                        # éditeur → course
NODE_PATH=$(npm root -g) node tools/e2e-workshop.js <dossier>                      # import de sprites → course
node tools/step.js <circuit> <catégorie> [marge] [-v]                             # suivi de ligne d'une voiture seule
node tools/sweep.js '[{},{"yawK":4}]'                                             # balayage des réglages physiques
node tools/jump.js <circuit> <catégorie> <marge>                                  # continuité du déplacement
node tools/line.js [circuit|all] [catégorie] [-v]                                # ce que vaut une trajectoire
node tools/netsim.js <circuit> [secondes] [perte %] [format]                      # deux écrans en réseau, sans navigateur
NODE_PATH=$(npm root -g) node tools/e2e-net.js <dossier> [format]                 # deux onglets, une table, une course
NODE_PATH=$(npm root -g) node tools/arrow.js <circuit>                            # sens des flèches des panneaux
python3 tools/sheet.py <dossier de rendus> <id du modèle> <longueur en m> [largeur]  # planche de rotations
python3 tools/env.py <planche.png> sprites/env [--erode=6] [--shadow=r,g,b] …     # découpe une planche de décor
python3 tools/topcar.py <image> <id du modèle> [--nose=left]                      # voiture vue de dessus
NODE_PATH=$(npm root -g) node tools/propdbg.js <image.png>                        # décor visible et coût par image
```

`tools/sheet.py` (Pillow requis, outil de développement seulement) transforme un dossier de rendus en
cadre fixe en planche utilisable : il retire le fond, garde la plus grande forme et rebouche ses trous,
découpe toutes les vues à la même boîte, mesure l'échelle sur la vue de profil et affiche la ligne à
coller dans `js/cars.js`. Les rendus doivent venir d'une caméra **orthographique immobile**, la voiture
tournant sur son axe, une image par pas régulier d'un tour complet, dans le sens horaire à l'écran.

`tools/env.py` (Pillow et NumPy requis) découpe une planche de décor : chaque tache de pixels
non-fond devient un PNG détouré, et l'ombre portée de chacun passe en noir translucide pour qu'elle
assombrisse l'herbe du jeu. Il vérifie en sortant qu'aucun objet gardé n'a perdu de matière en
chemin : le découpage amincit les formes pour séparer deux objets dont les ombres se touchent, et
tout ce qui est plus fin que l'amincissement disparaîtrait sans précaution. Voir
`sprites/env/README.md` pour les réglages employés.

`tools/line.js` mesure une trajectoire sans faire intervenir de pilote : sa longueur, son rayon
minimal, et le tour qu'elle donnerait à une voiture qui la suivrait exactement à la limite. C'est le
nombre qu'une trajectoire idéale existe pour abaisser, et la seule façon honnête de dire si une
modification du générateur a aidé — un temps de simulation mélange la qualité de la ligne et
l'aptitude du pilote automatique à la suivre. Avec `-v`, l'outil nomme aussi le point le plus serré
et montre les décalages autour : un vrai virage serré a des voisins qui s'accordent, un pli non.

`tools/netsim.js` et `tools/e2e-net.js` remplacent le transport WebRTC par une boucle locale —
l'annuaire public n'est pas joignable depuis une machine de test, et ce n'est pas lui qu'il faut
éprouver. Tout ce qui est au-dessus est le vrai code : le salon, la boucle de l'hôte, les
instantanés, la course. Le premier mesure l'écart entre l'écran de l'hôte et celui de l'invité en
faisant tomber une part des messages ; le second ouvre deux onglets qui se trouvent, se déclarent
prêts et courent ensemble.

`marge` multiplie la vitesse de passage en courbe visée : ≤ 1 la voiture reste sur sa ligne, 1,1–1,2 elle
glisse visiblement, au-delà elle part.

## Ajouter un circuit intégré

Ajouter une entrée dans `js/tracks.js` : une liste de points `[x, y]` formant une boucle fermée
(y vers le bas, le premier point sur la ligne droite de départ), la longueur cible en mètres, la largeur
et le nombre de tours de référence. Les trois trajectoires sont générées automatiquement. Un circuit
dessiné dans l'éditeur peut aussi être exporté en JSON et copié dans ce fichier.
