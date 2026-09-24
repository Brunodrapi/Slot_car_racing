# Eyes On Line

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
> **contre-la-montre**, avec **un seul plateau** de neuf voitures, toutes dessinées d'après nature.
> Les trois autres catégories — F1 classiques, F1 modernes, prototypes — ont été retirées : leurs
> voitures n'avaient aucun dessin et n'étaient plus proposées depuis longtemps. Elles sont dans
> l'historique si le sujet revient. La carrière, elle, reste dans le code sans être proposée.

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
`js/cars.js`), qui remplace alors la silhouette vectorielle : ce sont des voitures précises dans
leurs couleurs, pas une forme à peindre. L'ombre suit leur contour au lieu
d'être un rectangle posé dessous — la silhouette est remplie de noir une fois et gardée.

`tools/topcar.py <image> <id du modèle> [--nose=left] [--tol=14] [--peel=0]` prépare une
illustration. Le fond est retiré par **remplissage depuis le bord** et non par seuil de couleur :
une M1 Procar est blanche sur fond blanc, et un seuil la mangerait entière — le trait sombre qui
entoure la carrosserie arrête le remplissage, le blanc intérieur est conservé.

`--tol` se règle **sur la voiture, pas sur le fond** : il doit rester sous l'écart qui sépare le
fond du bord le plus clair de la carrosserie. Quatorze pour une M1 blanche, quarante-cinq pour une
Countach noire. Trop serré sur celle-ci, il laisse un liséré blanc tout autour. L'image est ensuite redressée
(l'axe long de la voiture est mesuré et ramené à l'horizontale, ce qui a valu un tiers de degré à la
F40) puis tournée pour que l'avant pointe vers la droite, ce que le jeu attend.

Une **photographie** demande un réglage de plus. Une illustration à plat s'arrête sur un trait net,
mais une photo pose une ombre douce sous la voiture : elle s'enfonce dans le blanc, le remplissage
s'arrête là où elle devient trop grise, et il reste un liséré. `--peel=6` l'épluche, couche par
couche, en ne retirant que les pixels du pourtour encore presque blancs — sur une épaisseur bornée,
pour qu'un reflet clair de la carrosserie ne serve jamais de porte d'entrée vers l'intérieur. Le
liséré ne fait que trois millièmes de la surface, mais c'est lui qu'on voit : en réduisant l'image
à quatre cents pixels, il se fond en un halo gris tout autour de la voiture.

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

### Cadrage de la caméra

La caméra cadre une **distance fixe** plutôt qu'une surface fixe, pour qu'un téléphone en portrait
et une fenêtre de bureau montrent la même chose : en vue de dessus, un nombre de mètres en travers
du petit côté de l'écran.

Ce nombre suit la vitesse. **Vingt mètres à l'arrêt, cinquante à la vitesse maximale de la
voiture.** La caméra fait donc elle-même le travail que le joueur faisait à la main : assez près
sur la grille pour voir la voiture, assez loin en vitesse pour voir ce qui arrive. Elle lit la
vitesse comme une fraction du maximum de *cette* voiture-là, donc une GT lente et un prototype
rapide parcourent tous les deux toute la plage — c'est d'ailleurs pour cela que le facteur de zoom
par catégorie a disparu, il résolvait deux fois le même problème.

| Vitesse | Largeur visible |
| --- | --- |
| à l'arrêt | 20 m |
| 30 % | 29 m |
| 55 % | 37 m |
| 85 % | 45 m |
| maximum | 50 m |

L'avance de la caméra sur la voiture suit le cadrage plutôt qu'un nombre de mètres fixe : ce qui
compte est l'endroit où la voiture se trouve **à l'écran**, et cela ne veut rien dire sans savoir
ce que l'écran montre. Rien à l'arrêt — la voiture reste centrée sur la grille — jusqu'à la moitié
du cadre à pleine vitesse, ce qui la place au quart inférieur.

Rien de tout cela ne se règle en course : il n'y a aucun bouton de zoom à l'écran. Le seul réglage
est dans Réglages → **Recul de la caméra**, pour qui veut voir plus large (× 1,3 ou × 1,6 sur tout
ce qui précède). Il n'y a pas de cran pour se rapprocher : vingt mètres sur la grille est déjà
aussi près que le jeu doit aller.

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

### L'adhérence est-elle bien dosée ?

`cornerSpeedFor` n'est que de l'arithmétique sur `grip` : elle promet une vitesse de passage. Rien ne
garantit que le modèle à deux trains la tienne, une fois les angles de dérive et le lacet passés par
là. `tools/corner.js` vérifie la promesse virage par virage, sur les douze circuits, en lisant la
force latérale que les pneus produisent vraiment — leur somme **est** l'accélération latérale, c'est
la seule force en jeu.

Verdict, en GT à marge 1 (le pilote automatique au maximum), 75 virages :

| Mesure | Médiane | 1er décile | 9e décile |
| --- | --- | --- | --- |
| vitesse réelle / théorique | 100 % | 88 % | 112 % |
| adhérence employée | 101 % | 75 % | 102 % |
| rayon suivi / rayon du tracé | 93 % | 76 % | 131 % |

L'adhérence employée ne dépasse jamais **103 %**, et ce plafond n'est pas un hasard : la grip d'un
essieu vaut `gripAt(v) × 0,5`, celle de l'autre la même chose multipliée par `rearBias`, donc une
voiture légèrement sous-vireuse dispose d'un pour cent de rab au total. Les deux chiffres sont donc
d'accord : une voiture passe bien les virages à la vitesse que l'arithmétique lui annonce.

La marge de difficulté se lit aussi comme elle se lit : 0,85 donne 81 % de la vitesse théorique,
0,90 donne 89 %, 0,95 donne 94 %. Ce n'est pas un bouton flou, c'est la fraction annoncée.

En g, pour juger sur pièces : le plateau tient 1,43 g de latéral à l'arrêt et 2,15 g à 247 km/h,
et freine à 1,78 g. (Les trois catégories retirées allaient de 1,17 g pour les F1 classiques à
5,42 g pour les F1 modernes à 349 km/h — le modèle les portait sans broncher.)

## Style

### Chaque circuit chez lui

Les douze circuits ont chacun leur **thème** (`theme` dans `js/tracks.js`), qui remplace la palette
entière plutôt que de la teinter.

Ce qu'ils partagent, c'est la route : un **gris violacé** et non un anthracite neutre. C'est ce qui
tient la famille ensemble quoi que fasse le sol autour. Ce qu'ils ne partagent pas, c'est justement
ce sol, la couleur des vibreurs, et ce qui pousse au bord.

| thème | circuit | sol | vibreurs |
| --- | --- | --- | --- |
| `park` | Monza | vert d'eau pâle du parc royal | rouge et blanc |
| `forest` | Spa, Nürburgring | vert sombre et humide, sapins | rouge et blanc |
| `autumn` | Silverstone | chaume pâle, terre ocre, arbres roux | bleu et blanc |
| `riviera` | Monaco | pierre claire, roche, **la mer et son village** | rouge et blanc |
| `dunes` | Zandvoort | sable et oyats | **orange** et blanc |
| `california` | Laguna Seca | herbe dorée, chênes secs | bleu et blanc |
| `tropical` | Interlagos | vert saturé, palmiers | jaune et vert |
| `japan` | Suzuka | vert frais, sapins | rouge et blanc |
| `bush` | Mount Panorama | kaki sur terre rouge | rouge et blanc |
| `alpine` | Red Bull Ring | prairie très verte | rouge et blanc |
| `lemans` | Le Mans | bas-côtés secs de juin | bleu et blanc |

Un thème règle aussi trois choses au-delà des couleurs. `props` repondère ce qui est semé — pas de
sapin dans une dune, pas de palmier dans les Ardennes. Un type qui n'appartient à aucun endroit en
particulier porte un poids de base nul (les palmiers, les maisons des Cyclades, la chapelle) : pour
ceux-là le nombre du thème n'est pas un facteur mais le poids lui-même, puisque multiplier zéro les
tiendrait hors du seul endroit pour lequel ils ont été dessinés. `patches` dit combien de sol nu
perce sous l'herbe. Enfin `centre` est le marquage au milieu de la route, absent partout sauf à
Monaco : **un circuit n'a pas de ligne médiane**, seule une route en a une.

### La mer

Un circuit au bord de l'eau reçoit une **baie**, pas un étang : elle suit une portion du tour d'un
côté, et se referme en fuseau aux deux bouts, de sorte qu'elle se lise comme un littoral et non
comme une dalle bleue posée à côté de la route. Le rivage ondule, parce qu'une courbe parallèle à
distance constante ressemble à un canal.

Trois bandes plutôt qu'un bleu uni : l'eau libre, un haut-fond plus clair près du bord, et un trait
d'écume à la rencontre de la terre. Une seule couleur se lit comme un trou dans le sol.

Des **bateaux** y mouillent — voiliers, vedettes, barques de pêche — couchés à peu près dans l'axe
du rivage, et tirés vers le quai plutôt que répartis au hasard sur le plan d'eau, parce qu'un
mouillage se serre près du bord.

`water: { from, to, side, gap, out }` dans le thème décrit la baie : la portion du tour, le côté, la
distance à la route et la largeur au large.

Les champs qu'un thème ne nomme pas viennent de `THEME_BASE`, au début de `js/render.js`.

### Les flaques

**Spa** et **Silverstone** ont de l'eau sur la piste. Elle se pose là où une route se vide : le long
des bords, à l'intérieur de la ligne blanche, et dans les creux juste hors bitume. Jamais au milieu
de la route — une flaque sur la trajectoire idéale transformerait le circuit en loterie.

Une flaque est étirée dans l'axe de la route, parce qu'une flaque de bord de piste prend la forme de
l'arête contre laquelle elle s'amasse ; une mare ronde au milieu d'une ligne droite ressemble à un
trou. Trois aplats et aucun dégradé, comme tout le reste ici : le sombre de l'eau, une lèvre claire
là où la lumière prend le bord, et une nappe de ciel à l'intérieur.

Une voiture qui en accroche une lève une **gerbe** et **repart avec l'eau** : les pneus mouillés
impriment deux traces sombres sur le bitume sec pendant quelques dizaines de mètres, jusqu'à ce
qu'il n'en reste plus. La trace se pose **au mètre et non à l'image** — à deux cents à l'heure une
image fait trois mètres, au pas quelques centimètres, et les marquer pareil donnerait soit des
pointillés soit une liste de miettes invisibles.

`puddles: 0.5` sur la définition du circuit dit à quelle fréquence, `0` (par défaut) pour un circuit sec.

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

### La gomme

Les traces de pneus **restent toute la course**. Elles étaient auparavant une liste plate de
segments, chacun tracé pour son compte et les plus anciens jetés passé neuf cents — environ un
demi-tour d'une course à dix voitures, de sorte que le premier virage était de nouveau propre quand
on y revenait. La gomme ne disparaît pas, donc plus rien n'est jeté.

Garder des dizaines de milliers de petits traits abordable demande deux choses. Ils entrent dans
**un chemin par parcelle de terrain**, si bien qu'une parcelle coûte un tracé quelle que soit la
gomme qu'elle porte ; et chaque parcelle porte sa boîte englobante, de sorte que seule la poignée
sous la caméra est dessinée. L'écran montre une cinquantaine de mètres, un tour en fait trois mille
— à chaque image, c'est une poignée de parcelles sur la cinquantaine qu'une course à Monza finit
par en compter.

Trois intensités plutôt qu'une valeur par trace, parce qu'un chemin se trace à une seule opacité :
une éraflure, une vraie glisse, un blocage de roues. Les traces d'une même parcelle et d'une même
intensité se joignent en un seul chemin, ce qui veut dire aussi que repasser au même endroit ne
noircit pas : la gomme s'accumule sur un vrai circuit, mais une trace qui double à chaque tour
finit en trou noir.

Mesuré à Monza, dix voitures, **280 secondes de course d'affilée** (vingt-huit relevés) :
**60 images par seconde d'un bout à l'autre**, cinquante et une parcelles en mémoire à l'arrivée,
et pas une trace jetée.

### La fumée

Les pneus fument en glisse **et à la remise des gaz** : à pleine charge sous les 30 % de la vitesse
maximale, les roues arrière demandent plus qu'elles ne tiennent, et la fumée le dit — la plus épaisse
au départ arrêté, disparue dès que la voiture avance vraiment.

Un dessin animé dessine la fumée comme une poignée de **boules distinctes**, pas comme une nappe.
Elles doivent donc rester assez peu nombreuses pour se distinguer les unes des autres : au-delà, elles
fusionnent en un drap gris et la voiture disparaît dedans. D'où une bouffée ou deux par image, jamais
plus de 240 à l'écran, des tailles volontairement très dispersées — une file de boules égales se lit
comme une chenille — et un tracé **sous les voitures**, parce qu'une voiture avalée par sa propre
fumée est une voiture que le pilote a perdue de vue.

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
  planche découpée vue par vue. La *M1 Procar* et la *911 Turbo* (seize vues, cadre fixe) et la
  *F40 LM* (huit vues) sont les premières converties.
- **Empilement de sprites** sinon : la silhouette vue de dessus est dessinée à des hauteurs
  croissantes, ce qui sous une caméra inclinée la décale vers le haut de l'écran et lui donne des
  flancs. Aucun dessin nouveau n'est nécessaire, c'est juste au cap près, et le nombre de couches suit
  le zoom pour éviter l'escalier. Les niveaux d'ombre sont cuits une fois par modèle et par livrée
  dans des canvas hors écran : appliquer un filtre canvas à chaque tracé ferait tomber le jeu sous une
  image par seconde.

Les deux cohabitent, ce qui permet de convertir la grille voiture par voiture.

## Contenu

- **9 voitures GT** : *M1 Procar*, *F40*, *Countach LP500*, *911 Turbo*, *GT40 Mk II*,
  *917 K*, *Corvette*, *787B*, *3.0 CSL*.
  On choisit sa voiture, et rien d'autre : plus de livrée à régler. En ligne, la place à la table
  donne la couleur, si bien que deux pilotes ne se ressemblent jamais sans avoir eu à en discuter.
  Toutes les neuf sont représentées d'après la vraie voiture : une vue de dessus pour la piste et
  une illustration en trois quarts pour le menu de sélection. Plus aucune silhouette vectorielle
  sur la grille. Trois ont en plus une planche de rotations, qui ne sert
  qu'à la vue isométrique.
- **12 circuits** inspirés de vrais tracés : Monza, Spa-Francorchamps, Monaco, Silverstone, Suzuka
  (avec son pont), Interlagos, Laguna Seca, Nürburgring GP, Le Mans, Mount Panorama, Red Bull Ring, Zandvoort.
- **Un seul plateau**, celui des neuf voitures ci-dessus. Son identifiant reste `gt` — les records
  de tour sont rangés sous `circuit|catégorie` dans la sauvegarde, et le changer effacerait ceux
  des joueurs — mais son nom ne pouvait plus être « GT » avec une 917 et une 787B sur la grille.
- **Course rapide** et **contre-la-montre** (records par circuit et catégorie), 3 niveaux de difficulté.
- Une **carrière** existe dans le code, actuellement masquée. Elle n'a plus qu'une coupe : les
  trois autres couraient dans les catégories retirées.
- IA qui freine selon son talent, choisit sa ligne pour dépasser, aspire dans le sillage, se touche.
- Français / anglais, son procédural, sauvegarde locale.

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
  « color » est teinté avec la couleur du pilote, comme dans UR2D.

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

## L'écran-titre

Le jeu s'ouvre sur l'affiche, `art/title.webp` — 941 × 1672, soit du 9:16 à un cheveu près, donc
plein écran sur un téléphone et centrée dans son cadre sur un bureau. Elle est posée en `contain`
et non en `cover` : c'est une affiche imprimée, avec sa bordure, et la rogner reviendrait à couper
le cadre d'un tableau.

Rien n'est écrit par-dessus sauf le numéro de build, parce qu'un texte posé sur une illustration
aussi chargée serait illisible où qu'on le mette — et le numéro lui-même reçoit sa pastille
sombre, sur un téléphone où l'affiche touche les bords. L'affiche porte son propre nom et sa
propre invitation ; n'importe quelle touche, n'importe quel appui, n'importe où la passe, ce
qu'elle dit elle-même et la seule consigne qu'un écran-titre devrait avoir besoin de donner.

### L'invitation qui respire

« Appuie pour commencer » pulse, et cela a demandé deux essais. La voie évidente — effacer le
texte imprimé et poser une image neuve à sa place — oblige à **réinventer le fond dessous**, et ce
fond est un lé rouge qui traverse la mentonnière d'un casque. Trois tentatives, trois échecs
visibles : un rectangle lissé, des traînées verticales empruntées à une bande voisine, puis un
fantôme sombre des anciennes lettres. Aucune ne tenait à l'écran.

Le calque lumineux est donc **découpé dans l'affiche elle-même** : `art/press-start.png` est fait
des pixels du texte imprimé, pris par leur clarté, avec un bord tendu entre deux seuils pour
garder l'anticrénelage. Mêmes pixels, même place, donc il recouvre l'impression exactement et il
n'y a plus rien à effacer. Seule la couleur change — le jaune relevé sur la découpe fournie
(`art/press-start-source.png`) — et le grain du papier survit parce que chaque lettre est ombrée
par sa propre clarté d'origine plutôt que peinte en aplat.

La scène porte le rapport exact de l'affiche (`aspect-ratio: 941 / 1672`) et se borne à la
fenêtre, ce qui revient à un `contain` dont on connaît les bords : le calque se place alors en
pourcentages et reste juste à toutes les tailles. Une image en `contain` toute seule laisse des
marges dont la taille n'est écrite nulle part, et ce qu'on pose dessus dérive dès qu'on change de
format.

Elle **clignote** comme une enseigne d'arcade : allumée, éteinte, franchement, sans fondu — d'où
le `step-end`. Éteindre ne peut pas vouloir dire disparaître : le texte imprimé de l'affiche est
toujours là, sous le calque, et passer celui-ci à l'invisible ne ferait que rendre la main aux
lettres crème d'origine — un changement de couleur, pas un clignotement. Le temps éteint les
peint donc dans le brun sombre du fond, qu'elles recouvrent toujours et où elles se fondent,
comme les ampoules mortes d'une enseigne.

La lueur est un `drop-shadow` et non une ombre de boîte, donc elle épouse les lettres au lieu
d'éclairer un rectangle autour d'elles. Sous `prefers-reduced-motion`, elle se fige sur son temps
allumé : qui a demandé moins d'animation n'a pas demandé moins de lisibilité.

C'est aussi le geste qui autorise le son : un navigateur ne joue rien tant que personne n'a touché
la page.

Un lien qui nomme un circuit (`?track=…`) est quelqu'un qui sait déjà où il va : l'affiche
s'efface pour lui. Les scripts de test passent l'écran comme un joueur, par une touche, et
`tools/e2e-splash.js` le vérifie sur les deux formats.

## Le menu-affiche

Le menu est une affiche, `art/menu-bg.webp`, et les cinq bandeaux posés dessus sont les boutons.
Chacun y est **imprimé replié** — l'icône et une amorce à damier, sans mot. Le dessin déplié, celui
qui porte le texte, est posé par-dessus et se découvre de la gauche vers la droite.

Le pli n'est donc pas un tour joué à une seule image : le bandeau fermé est vraiment dessous, le
bandeau ouvert le recouvre vraiment, et c'est pour cela qu'il n'y a rien eu à effacer de
l'affiche.

**Un bandeau ne s'ouvre qu'à l'appui.** Au repos, le menu est exactement la maquette : cinq
bandeaux repliés, une icône chacun, pas un mot. Le dépliage est la réponse à l'appui, et le mot
qu'il découvre dit sur lequel on a appuyé ; l'écran ne change qu'ensuite, 430 ms plus tard. Sous
`prefers-reduced-motion` le bandeau s'ouvre sans transition et l'action part aussitôt — attendre
une animation qu'on a désactivée n'aurait aucun sens.

La cible du clic a la taille du bandeau **replié**, pas du déplié : c'est ce qu'on voit au repos,
et une cible de 88 % de large reviendrait à réagir à un appui dans le ciel de l'affiche. Le dessin
déplié, lui, est posé par-dessus et déborde vers la droite en s'ouvrant.

Les bandeaux sont posés par **un seul bord gauche et une seule largeur** (1 % et 88 % de
l'affiche), la hauteur de chacun suivant son propre dessin. Caler plutôt chaque déplié sur la
hauteur mesurée de son replié paraissait plus rigoureux et rendait moins bien : les icônes
débordent de leur barre de façons différentes, ces hauteurs se contredisent de dix pour cent d'un
bandeau à l'autre, et la pile sortait de travers — une des versions dépassait même la largeur de
l'affiche.

Le hamburger est dessiné dans l'affiche ; il ne reste qu'à poser la cible au-dessus, un peu plus
large que lui pour qu'un pouce la trouve. `tools/e2e-menu.js` vérifie les cinq bandeaux, le
chargement réel de chaque image, le dépliage, et l'endroit où mène chaque bouton.

## Nombre de tours

En course rapide, la longueur se choisit : **Auto / 1 / 2 / 3 / 5 / 10** tours, à côté de la
difficulté. « Auto » garde la proposition du circuit, que `lapsFor` calcule pour tenir autour de
trois ou quatre minutes selon la vitesse de la catégorie.

Les courses de championnat gardent leur longueur : elle fait partie du championnat, pas des
réglages.

## Choisir sa voiture

Le menu de sélection montre une **illustration en trois quarts** ; les neuf voitures en ont une.
La vue de dessus dit comment la voiture se pose sur la piste, ce qui est le sujet une fois en
course, mais on ne choisit pas une voiture par son toit : de face, on reconnaît la calandre,
l'aileron, la posture.

`python3 tools/pickcar.py <image> <id>` prépare ces illustrations. C'est un cousin de
`topcar.py`, à une différence près qui compte : **rien n'est tourné ni redressé**. Une vue de
dessus doit pointer vers la droite et son axe long se mesure ; une vue en trois quarts est cadrée
par le dessinateur, et la redresser ne ferait que la coucher de travers.

Ces illustrations portent en général une ombre douce au sol, qui n'est pas du fond : le
remplissage depuis le bord s'y arrête et il reste un halo gris autour des roues. `--peel` retire
les pixels du pourtour restés presque blancs, sur une épaisseur bornée pour qu'un reflet clair de
la carrosserie ne serve jamais de porte d'entrée vers l'intérieur.

Les voitures sans illustration gardent leur vue de dessus : les deux voies cohabitent le temps que
la série soit complète.

La boîte de la vignette est en 4/3 et le dessin y tient en `contain` : les illustrations ne sont
pas cadrées pareil d'une voiture à l'autre — la CSL arrive en 1,06 de rapport, la Corvette en 1,58
— et les forcer au même cadre les déformerait. Le prix est que la voiture n'occupe pas tout à fait
la même surface d'une carte à l'autre.

## Le son des voitures

Deux méthodes se partagent le métier : le **fondu enchaîné d'enregistrements** par régime, celle
des simulateurs, et la **synthèse**. La première demande une douzaine de boucles par voiture et par
perspective — un muscle car qui coupe à 5500 tr/min en réclame treize, et il en faut une série par
perspective (échappement, moteur, admission, habitacle). À neuf voitures cela ferait des
mégaoctets à télécharger sur un téléphone, et surtout des enregistrements génériques feraient
sonner un flat-12 comme un six en ligne, ce qui est exactement ce qu'on cherche à éviter.

La synthèse est ici la bonne réponse parce que **la différence entre ces voitures est
arithmétique**. Un quatre-temps allume `cyl / 2` fois par tour de vilebrequin, donc la fréquence
d'allumage vaut

```
f = tr/min ÷ 60 × cyl ÷ 2
```

À 6000 tr/min : 300 Hz pour un six en ligne, 400 pour un V8, 600 pour un V12. **Une octave sépare
le six du douze**, sans rien avoir à enregistrer.

Les **ordres moteur** sont les harmoniques de la rotation du vilebrequin. Plutôt que d'empiler
douze oscillateurs, on en prend donc **un seul**, muni d'une `PeriodicWave` dont les coefficients
*sont* les ordres, et on lui donne pour fréquence `tr/min ÷ 60` : l'allumage tombe alors sur
l'harmonique `cyl/2` et tout le spectre suit. Les ordres **inférieurs** à l'allumage ne devraient
pas exister sur un moteur équilibré, et c'est précisément leur présence qui fait le grondement d'un
V8 à vilebrequin croisé — le champ `rough` les dose, et c'est lui qui sépare la Corvette de la
Countach à cylindrée et régime comparables.

Le reste est du réalisme de comportement, et c'est lui qui fait le plus d'effet :

- **le régime suit les rapports, pas la vitesse.** Sans boîte, un moteur monte du ralenti au
  rupteur en une seule fois sur toute la plage : rien ne sonne plus faux, et c'est ce que faisait
  la version précédente. Cinq rapports, serrés en bas, longs en haut, avec 90 ms de coupure à
  l'embrayage — assez pour entendre le rapport passer.
- **la charge change le timbre.** Pied dedans, l'admission et son souffle sont là ; pied levé,
  l'admission disparaît et l'échappement s'assombrit.
- **le turbo** siffle d'autant plus fort que le régime monte, et retombe d'un coup au lever.
- **le vent** ne connaît que la vitesse, et tient la scène quand on lève le pied.

Chaque voiture porte son vrai moteur dans `js/cars.js` (`engine`) : six en ligne pour la M1 Procar
et la CSL, V8 à vilebrequin plat et biturbo pour la F40, flat-6 turbo pour la 911, V12 pour la
Countach, flat-12 pour la 917, gros V8 croisé pour la GT40 et la Corvette.

### Mesuré, pas écouté

`NODE_PATH=$(npm root -g) node tools/e2e-audio.js` rend le son **hors ligne** dans un
`OfflineAudioContext`, en prend le spectre par transformée directe, et vérifie deux choses qu'aucune
capture d'écran ne montre :

| voiture | cyl | tr/min | allumage attendu | pic mesuré |
| --- | --- | --- | --- | --- |
| M1 Procar | 6 | 3893 | 195 Hz | 194 Hz |
| F40 | 8 | 3361 | 224 Hz | 224 Hz |
| Countach | 12 | 3242 | 324 Hz | 324 Hz |
| GT40 Mk II | 8 | 2689 | 179 Hz | 180 Hz |
| 917 K | 12 | 3662 | 366 Hz | 366 Hz |
| Corvette | 8 | 2598 | 173 Hz | 174 Hz |

Les neuf tombent à moins de 0,5 % de leur fréquence d'allumage théorique, et le rapport
douze-cylindres sur six-cylindres ramené au même régime vaut **2,01** — l'octave, comme la physique
l'exige. L'outil compte aussi les chutes de régime le long de la plage de vitesse : quatre, soit
les quatre passages de rapport d'une boîte à cinq.

### Et les banques de sons ?

Sonniss et Pixabay répondent **403** depuis ce bac à sable, et l'API de Freesound demande une clé
que je n'ai pas ; Freesound et Mixkit restent atteignables en page publique. Mais le point qui
décide n'est pas l'accès : un enregistrement générique de « moteur de voiture » ne fait pas
entendre la différence entre un flat-12 et un six en ligne, alors que l'arithmétique ci-dessus le
fait gratuitement. Les banques gardent tout leur intérêt pour ce que la synthèse rend mal et qui ne
dépend pas de la voiture — impacts, gravier, ambiance de stands. C'est le prochain pas naturel, et
il demande une clé d'API ou des fichiers déposés dans le dépôt.

## L'équilibre entre les voitures

Une différence de caractère est un choix offert au joueur ; cinq secondes au tour n'en est pas un,
c'est un piège. `node tools/models.js [catégorie]` met chaque voiture seule en piste sur cinq
circuits et donne deux colonnes à lire ensemble : le **tour idéal**, ce que la voiture vaut sur le
papier une fois le profil de vitesse résolu, et le **tour réel**, ce qu'un pilote en tire. L'écart
entre les deux est le prix du caractère.

La Corvette est arrivée à **7,1 %** du rythme quand les six voitures d'alors tenaient dans quatre —
adhérence et appui coupés trop fort. Réglée, elle rentre dans le peloton, et surtout son tour
*idéal* est désormais meilleur que celui de la 911 Turbo : elle est rapide sur le papier et perd
son avance en pilotage, là où les autres ne cèdent que trois à quatre pour cent. C'est sa glisse
qu'elle paie, et c'est autre chose qu'être lente. Les neuf tiennent aujourd'hui dans **3,9 %**.

Le même outil sert à vérifier qu'un caractère annoncé existe vraiment. La 3.0 CSL est censée être
une voiture de virages : son écart à la 917 va de **0,4 % à Zandvoort** et 0,6 % à Monaco, sinueux,
à **2,3 % à Monza**, rapide. Ce n'est donc pas une affirmation de présentation, c'est dans les
chiffres.

Rien ne comparait les modèles entre eux jusque-là, ce qui explique qu'une voiture bancale ait pu
être livrée sans qu'on la voie.

## Les trois difficultés

Elles tenaient entre 0,78 et 0,90 de la vitesse de passage que l'adhérence autorise, ce qui mettait
à peine **sept pour cent** de rythme de course entre le réglage le plus facile et le plus dur. Un
joueur ne pouvait pas sentir la différence — et c'est la seule chose à quoi sert un réglage de
difficulté. Elles vont maintenant de 0,70 à 0,93, et de douze pour cent.

Mesuré avec `tools/diff.js` sur le **rythme de course** (temps total ÷ tours, fautes comprises) et
non sur le meilleur tour, en GT, sur les douze circuits :

| | avant | après | sorties de piste, après |
| --- | --- | --- | --- |
| Facile | 89,5 s | **93,4 s** | 0,1 |
| Moyen | 85,9 s | **86,8 s** | 2,3 |
| Difficile | 83,4 s | **82,1 s** | 10,3 |
| écart facile → difficile | 6,9 % | **12,1 %** | |

Le niveau difficile fait plus de fautes qu'avant, et c'est le marché : un peloton qui roule aussi
près de la limite dans le trafic pose une roue dans l'herbe. Il tourne tout de même cinq secondes
plus vite que le niveau moyen, donc les fautes sont payées plusieurs fois — et ce sont elles qui
donnent au joueur un moyen de passer.

L'élastique (qui freine une IA très détachée et aide un retardataire) n'a presque aucune part dans
tout cela : en le retirant, l'écart passait de 6,7 à 7,3 %. Six dixièmes de point. C'est une piste
qu'il valait mieux mesurer que suivre.

## Le plafond de marge de l'IA

`margin` multiplie la vitesse de passage que l'adhérence autorise, donc **tout ce qui dépasse 1 est
un virage que la voiture ne peut pas prendre**. Le pilote à qui on le donne ne va pas plus vite :
il sort, perd dix secondes et rend la place.

Or la marge est une somme — la base de la difficulté, l'écart de talent du pilote, un bruit, et le
terme d'élastique. En difficile, le meilleur pilote recevait 0,90 + 0,09 + 0,015 + 0,03 = **1,035**.
C'est la **somme** qui est désormais plafonnée, à 0,98, et non chaque terme : plafonner les parties
séparément laisse passer exactement le cas qui pose problème.

`node tools/diff.js [circuit|all] [catégorie]` traduit les coefficients de `DIFFICULTY` en la seule
chose qu'un joueur ressent : la vitesse à laquelle le peloton tourne. Il donne le **rythme de
course** (temps total ÷ tours) et non le meilleur tour, parce que le rythme porte les fautes, le
trafic et les passages dans le gravier — un peloton qui signe des tours rapides et se plante deux
fois par course n'est pas un peloton difficile. `-sans-elastique` retire le terme de rubber-banding
avant de lancer, ce qui permet de distinguer une difficulté mal choisie d'une difficulté défaite en
chemin. `-table='<json>'` essaie une table candidate sans l'écrire dans le jeu.

## Numéro de version

Le menu porte en bas le numéro du build et sa date — `v0.15.0 · 2026-09-23`. Ce n'est pas de la
décoration : le jeu est une poignée de fichiers statiques servis depuis une branche, et GitHub
Pages comme le navigateur en gardent des copies. Sans ce numéro, « est-ce que ce que je regarde
est bien ce qui vient d'être poussé ? » n'a pas de réponse depuis l'écran — on recharge, rien ne
bouge, et rien ne distingue un déploiement qui n'a pas eu lieu d'un cache qui n'a pas expiré.

```
node tools/bump.js [patch|minor|major]     # patch par défaut
```

Deux choses bougent ensemble, et c'est le but. Le numéro de `js/version.js` est ce que le menu
affiche, donc une capture d'écran dit de quel build elle vient. Le `?v=` ajouté à chaque script et
à la feuille de style est ce qui **force** le navigateur à aller rechercher les fichiers — sans
lui, le numéro change dans les sources et personne ne le voit jamais, ce qui est exactement la
panne que tout ceci sert à détecter.

À lancer avant de pousser une modification visible.

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
node tools/corner.js [circuit|all] [catégorie] [marge] [-v]                      # vitesse réelle contre vitesse théorique, virage par virage
node tools/diff.js [circuit|all] [catégorie] [-sans-elastique] [-table=…]         # ce que valent vraiment les trois difficultés
node tools/models.js [catégorie] [marge]                                          # chaque voiture : tour idéal, tour réel, prix du pilotage
NODE_PATH=$(npm root -g) node tools/e2e-audio.js                                  # spectre de chaque moteur et étagement de la boîte
NODE_PATH=$(npm root -g) node tools/e2e-splash.js [dossier]                       # l'écran-titre, sur téléphone et sur bureau
NODE_PATH=$(npm root -g) node tools/e2e-menu.js [dossier]                         # le menu-affiche : bandeaux, dépliage, destinations
node tools/bump.js [patch|minor|major]                                            # numéro de version + cassage du cache
node tools/netsim.js <circuit> [secondes] [perte %] [format]                      # deux écrans en réseau, sans navigateur
NODE_PATH=$(npm root -g) node tools/e2e-net.js <dossier> [format]                 # deux onglets, une table, une course
NODE_PATH=$(npm root -g) node tools/arrow.js <circuit>                            # sens des flèches des panneaux
python3 tools/sheet.py <dossier de rendus> <id du modèle> <longueur en m> [largeur]  # planche de rotations
python3 tools/env.py <planche.png> sprites/env [--erode=6] [--shadow=r,g,b] …     # découpe une planche de décor
python3 tools/topcar.py <image> <id du modèle> [--nose=left]                      # voiture vue de dessus
python3 tools/pickcar.py <image> <id du modèle> [--tol --peel]                    # voiture en trois quarts, pour le menu
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
