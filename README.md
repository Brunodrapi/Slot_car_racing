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

## Changer un réglage ne renvoie plus la page en haut

Chaque choix de l'écran de départ — le nombre de tours, le circuit, la voiture, la difficulté —
reconstruit l'écran entier. Or remplacer le contenu d'un conteneur remet son défilement à zéro : on
choisissait ses tours en bas de page et on se retrouvait en haut, à devoir redescendre pour le
réglage suivant. Mesuré, la page sautait de **1677 pixels**.

Le défilement est conservé quand l'écran redessiné est **le même**, reconnu par une clé que chaque
écran se donne — `depart:race`, `salon`, `coupe:<id>`, `atelier`. Se fier à la seule classe CSS ne
suffirait pas : plusieurs écrans partagent `scroll`, et on arriverait sur le second à la hauteur où
l'on avait laissé le premier. Sans clé, on repart du haut, ce qui est le bon comportement quand on
change d'écran.

`tools/e2e-menu.js` fait ce que fait le joueur : il descend, il clique sur un réglage, il regarde où
il est. Il vérifie aussi l'autre moitié de la règle — revenir au menu puis rouvrir l'écran doit
repartir du haut — sans quoi le remède serait pire que le mal. Et il commence par s'assurer que
l'écran défile vraiment : sur une page trop courte pour défiler, l'essai passerait sans rien prouver.

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

### L'intérieure était à l'extérieur

Elle y était **99 % du temps**, mesuré. Le fichier portait d'ailleurs deux commentaires
contradictoires sur le sens d'une courbure positive, l'un disant à droite et l'autre à gauche : une
convention de signe qui n'est écrite qu'en prose finit toujours par se retourner.

La question se tranche par la géométrie. La dérivée seconde de l'axe pointe vers le centre de
courbure ; projetée sur la normale, elle dit de quel côté ce centre se trouve, donc où est
l'intérieur du virage. Ouverte sur quinze mètres, parce que sur un seul pas elle ne pèse que
quelques millimètres pour un virage de 250 m de rayon et que sa direction n'est alors que du bruit.

`tools/cotes.js` mesure le résultat, et surtout il porte un contrôle qui ne dépend d'aucune
convention : **la longueur**. Une ligne qui prend l'intérieur des virages est plus courte que la
ligne de course, une qui prend l'extérieur plus longue. C'est vrai quel que soit le sens des
normales, et ça ne se laisse pas tromper par le point de corde — là où la rapide touche déjà le bord
intérieur, l'intérieure n'a nulle part où aller, et une mesure point par point la déclarerait
fautive alors qu'elle n'a rien fait de mal.

| | avant | après |
|---|---|---|
| intérieure du bon côté, en virage | 1 % | **94 %** |
| intérieure du bon côté, **à l'approche** | — | **86 %** |
| longueurs cohérentes | 3 circuits sur 12 | **12 sur 12** |
| écart des lignes en ligne droite | 3,5 m | **7,8 m** |
| tour où les lignes se confondent | 13 % | 4 % |
| sorties de piste de l'IA, douze circuits | 119 | **104** |

### La mesure ne regardait pas où le joueur regarde

Premier verdict : 91 % en virage, affaire classée. Puis, sur Monza, la ligne intérieure passait
visiblement à l'extérieur d'un virage. Les deux ne se contredisaient pas — la mesure ne comptait que
les échantillons **en** virage, alors qu'une ligne intérieure n'est pas d'abord une ligne de virage :
c'est celle qui **arrive** du côté intérieur du virage qui vient, cent mètres avant le point de
corde. C'est là qu'elle ferme la porte, et c'est là qu'elle se voit.

Mesurée sur l'approche — les quatre-vingts mètres avant l'entrée — elle n'était du bon côté que
**71 %** du temps, et 55 % au Nürburgring. La règle partageait chaque ligne droite en deux, moitié au
sens du virage précédent : sur cette première moitié, l'intérieure longeait encore le côté du virage
d'avant, donc l'extérieur de celui qu'elle abordait. Le sens du virage précédent n'est désormais tenu
que le temps de se déplier, une trentaine de mètres, et toute la suite de la droite appartient au
virage qui vient.

### Un seuil relatif se trompe sur les tracés contrastés

Le défaut que Monza montrait encore. Décider s'il y a « assez de virage pour choisir un côté » avec
un seuil relatif au virage le plus serré du circuit marche sur un tracé homogène et pas ailleurs : à
Monza les chicanes font 22 m de rayon, si bien qu'une grande courbe de 234 m tombait sous 18 % du
maximum, était classée ligne droite, et héritait du sens de ses voisines — les deux lignes s'y
retrouvaient inversées sur cinq mètres d'écart, dans exactement le genre de virage rapide où le choix
de ligne décide d'un dépassement.

Le seuil est maintenant d'abord absolu, et dit la chose physique : en deçà de 400 m de rayon, il y a
un côté à choisir. Le seuil relatif reste comme plafond, pour qu'un tracé sans aucun virage serré
laisse quand même ses grandes courbes décider.

### Des voies séparées dans les lignes droites

Trois lignes qui se confondent dès que la route est droite ne laissent aucune place pour doubler.
Elles se confondaient sur 13 % du tour, parce que le sens venait de la courbure locale : nulle en
ligne droite, donc les trois lignes au même endroit.

Deux exigences tirent en sens contraire. Chaque virage doit imposer son vrai sens, sinon l'intérieure
repart à l'extérieur ; et les lignes doivent rester écartées là où la route est droite. Un lissage ne
peut pas les satisfaire toutes les deux : large, il écrase les virages courts ; étroit, il laisse les
lignes se rejoindre. Les deux premières tentatives ont échoué exactement là — la seconde donnait 98 %
à l'extérieure mais retombait à 57 % sur l'intérieure.

La sortie est de ne pas moyenner du tout. Chaque virage décide de son sens, franchement ; entre deux
virages, le sens est **tenu** plutôt qu'interpolé. Deux virages de même main laissent donc les lignes
écartées d'un bout à l'autre de la droite qui les sépare, et deux virages de mains opposées se
partagent la droite en deux, le croisement tombant au milieu. C'est l'idée reprise des tracés à voies
commutées : des voies qui restent séparées et se croisent à des **endroits choisis**, plutôt qu'un
fondu qui les colle l'une à l'autre sur des centaines de mètres.

### Vérifier le curseur en conduisant, pas en relisant

Le curseur de ligne a l'air juste dans le code : en bas il vaut −1, il est étiqueté « intérieur », et
`targetLat` renvoie alors la ligne intérieure. Mais ce fichier a déjà eu l'air juste alors qu'il ne
l'était pas. `tools/curseur.js` conduit donc : curseur à fond d'un côté, voiture seule, un tour
lancé, et on relève sa position réelle virage par virage. La chaîne éprouvée va du curseur aux roues
— `input.sel`, `race.update`, `car.sel`, `targetLat`, le pilote automatique, la position.

**Verdict : pousser le curseur vers l'intérieur place bien la voiture à l'intérieur, dans 95 % des
virages.** Le câblage est juste.

Deux pièges se sont présentés en chemin, et aucun n'aurait été visible en relisant le code.

Le premier essai conduisait avec le pilote automatique. Or, sans personne à dépasser, celui-ci remet
la sélection à zéro à chaque pas : le curseur du joueur n'arrivait jamais aux roues. La mesure
donnait le même écart moyen au centimètre près pour les deux positions du curseur — elle ne mesurait
rien, et elle annonçait pourtant un défaut.

Le second demandait « la voiture est-elle du côté intérieur du virage ». Cette question n'a pas de
réponse au point de corde : la ligne de course y touche déjà le bord intérieur, la ligne intérieure
aussi, les deux se confondent légitimement et le signe de leur écart ne veut rien dire. La mesure
plafonnait à 46 % en comptant du bruit. La bonne question est celle que le joueur pose, et elle est
relative : en poussant vers l'intérieur plutôt que vers l'extérieur, est-ce que je me retrouve plus
à l'intérieur ?

### Le curseur est asymétrique, et c'est de la géométrie

Ce qui se ressent comme un défaut reste vrai, et se mesure. L'écart à la ligne de course, en médiane :

| | en virage | à l'approche | en ligne droite |
|---|---|---|---|
| intérieure | 0,7 m | 3,8 m | 7,2 m |
| extérieure | 6,5 m | 3,5 m | 1,2 m |

Les deux lignes se séparent dans des **zones opposées**, et c'est juste : on ferme la porte *avant*
le virage, on passe autour *pendant*. Mais en virage, pousser vers l'extérieur déplace la voiture de
six mètres et pousser vers l'intérieur de moins d'un — d'où l'impression que le curseur n'a qu'un
côté.

La cause n'est pas un réglage : **la ligne de course prend déjà la corde**. Elle est la trajectoire
de courbure minimale, elle vient toucher le bord intérieur à chaque apex, et il n'existe donc aucune
place « plus à l'intérieur » dans un virage. Symétriquement, en ligne droite elle se place déjà du
côté extérieur du virage qui vient, et il n'y a rien de plus à l'extérieur.

Deux constructions ont été essayées pour corriger l'asymétrie, mesurées, et écartées. Viser
franchement les deux bords au lieu d'une fraction de la place restante : **217 sorties de piste** sur
les douze circuits contre 94, sans gagner un point sur le curseur. Faire de l'intérieure le chemin le
plus court du couloir — le fil tendu, qui est la vraie ligne défensive et serre tous les apex :
**228 sorties**, parce que la plus courte est aussi celle de plus petit rayon et que les voitures ne
la tiennent pas. La construction en place reste la meilleure des trois sur les deux tableaux.

### Les bords de piste disent de quel côté est la corde

Les deux lignes blanches de part et d'autre de la route ne disaient rien. Elles portent maintenant le
côté du virage : **froid vers l'intérieur, chaud vers l'extérieur**, avec les couleurs mêmes du
curseur de ligne, pour que le lien se fasse sans légende. Là où les deux lignes de conduite se
croisent, les teintes des bords s'échangent aussi — le croisement se voit donc sur la route, à
l'endroit où il se produit.

Chaque bord est découpé en tronçons plutôt que teinté d'un bloc : un raccord de rendu fait soixante
mètres et traverse parfois un changement de main, si bien qu'une couleur unique mentirait sur la
moitié de sa longueur. Le point de bascule appartient aux deux tronçons, faute de quoi un trou blanc
apparaîtrait entre eux.

Le sens qui les teinte est la donnée même qui construit les lignes, et non une seconde estimation qui
pourrait en diverger. `tools/cotes.js` le vérifie contre la géométrie du tracé : **juste dans 99 %
des virages**. Un bord teinté à l'envers dirait au joueur le contraire de ce qu'il voit, ce qui est
pire que de ne rien dire.

### Le limiteur rabattait l'intérieure

Le défaut qui restait après tout cela, et le plus instructif. Le limiteur de pente s'appliquait à la
**position** de chaque ligne : 0,07 m par mètre pour les deux secondaires, 0,30 pour la rapide. Or la
rapide se déporte donc quatre fois plus vite que les autres ne peuvent la suivre. Dans une entrée de
virage, l'intérieure ne pouvait pas l'accompagner et se faisait littéralement rabattre — les deux
lignes ne se trouvaient de part et d'autre de la rapide que **60 % du temps**.

Le limiteur porte maintenant sur l'**écart à la ligne de course**, pas sur la position. C'est ce qui
a un sens : une voiture sur la ligne intérieure roule sensiblement parallèle à la rapide et ne s'en
écarte que progressivement. Les deux lignes sont désormais de part et d'autre 85 % du temps, et c'est
ce seul changement qui a fait passer l'intérieure de 57 à 91 %.

Sa valeur est mesurée et non choisie, parce qu'elle arbitre deux choses opposées : trop basse, la
ligne intérieure n'a pas le temps de traverser la piste avant le virage ; trop haute, elle traverse
plus vite que les voitures ne savent suivre. Balayée sur les douze circuits, avec d'un côté la part
de l'approche réussie et de l'autre les sorties de piste en course :

| pente | approche juste | sorties de piste |
|---|---|---|
| 0,07 | 82 % | 98 |
| **0,10** | **84 %** | **97** |
| 0,12 | 85 % | 109 |
| 0,18 | 86 % | 147 |

Le coude est à 0,10 : au-delà on gagne un point d'approche et on paie douze sorties.

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

Le semis est **déterministe** : un circuit retrouve toujours le même décor, d'une partie à l'autre.
Chaque type indique la bande dans laquelle il aime se poser, mesurée depuis le bord de la piste. Ces
bandes sont serrées parce que la caméra ne montre qu'environ vingt-cinq mètres de chaque côté de la
voiture ; plus loin, un objet existe mais n'apparaît jamais. Un candidat est refusé s'il tombe trop
près d'un morceau quelconque du circuit — ce qui compte là où le tracé se replie — ou trop près d'un
objet déjà posé.

## Ce qui part avec l'isométrique

Elle avait été essayée comme vue par défaut, puis écartée en gardant son réglage — « la vue
isométrique reste dans les réglages, et le décor avec elle ». C'est fini : il n'y a plus que la vue
de dessus. Ce qui disparaît avec elle, et pourquoi il valait mieux que ça disparaisse :

- **Les deux façons de donner du volume à une voiture.** Une planche de rotations par modèle (un
  dossier de `v0.png`…`vN-1.png`, trois voitures converties sur neuf) et, à défaut, un empilement de
  la silhouette vue de dessus à des hauteurs croissantes. La première demandait plus de travail de
  dessin que le jeu peut en porter — c'est la raison qui l'avait déjà écartée du défaut.
- **Le second jeu de décor.** Vingt-cinq sprites en trois quarts découpés d'une planche, qui
  n'avaient de sens que sous une caméra inclinée. Ils partaient au réseau à CHAQUE course, y compris
  en vue de dessus, où personne ne les regardait : un mégaoctet téléchargé pour rien, sur l'écran qui
  fait déjà attendre le joueur. Le décor vu de dessus, lui, n'est pas téléchargé du tout — il est
  peint dans la palette du circuit.
- **Le tri en profondeur**, qui mêlait décor et voitures par leur position à l'écran, et
  l'écrasement vertical de la caméra. Vu du dessus, il n'y a ni devant ni derrière.

Ce qui a été mesuré avant d'être jeté : l'empilement coûtait **dix fois** le dessin à plat — 0,36 ms
par voiture contre 0,04 sur une machine bridée au quart, soit 3,6 ms par image à dix voitures. Le
tableau complet est plus bas, dans « Deux dessins sous une voiture ».

**Ce qui reste utile ailleurs** ne part pas : la silhouette d'ombre, le cerne du joueur, le semis
déterministe du décor. **Ce qui est supprimé pour de bon** : `sprites/env/` et les quatre dossiers de
planches, `tools/sheet.py`, `tools/env.py`, `tools/propdbg.js`, les champs `sheet*` de `js/cars.js`,
et l'option « Isométrique » des réglages — une sauvegarde qui la portait encore est ramenée à la vue
de dessus **à chaque lecture**, et pas une fois : c'est une valeur qui n'existe plus, pas une
préférence à migrer. La planche d'origine du décor (`sprites/environnement/`) est gardée : c'est du
dessin, pas du code mort. La branche `isometric` garde l'essai complet.

## Contenu

- **9 voitures GT** : *M1 Procar*, *F40*, *Countach LP500*, *911 Turbo*, *GT40 Mk II*,
  *935*, *Corvette*, *787B*, *3.0 CSL*.
  On choisit sa voiture, et rien d'autre : plus de livrée à régler. En ligne, la place à la table
  donne la couleur, si bien que deux pilotes ne se ressemblent jamais sans avoir eu à en discuter.
  Toutes les neuf sont représentées d'après la vraie voiture : une vue de dessus pour la piste et
  une illustration en trois quarts pour le menu de sélection. Plus aucune silhouette vectorielle
  sur la grille. Deux d'entre elles — la 3.0 CSL et la F40 — ont trois livrées chacune.
- **12 circuits** inspirés de vrais tracés : Monza, Spa-Francorchamps, Monaco, Silverstone, Suzuka
  (avec son pont), Interlagos, Laguna Seca, Nürburgring GP, Le Mans, Mount Panorama, Red Bull Ring, Zandvoort.
- **Un seul plateau**, celui des neuf voitures ci-dessus. Son identifiant reste `gt` — les records
  de tour sont rangés sous `circuit|catégorie` et `circuit|catégorie|voiture` dans la sauvegarde,
  et le changer effacerait ceux des joueurs — mais son nom ne pouvait plus être « GT » avec une
  935 et une 787B sur la grille.
- **Course rapide** et **contre-la-montre** (records par circuit et par voiture), 5 niveaux de difficulté, usure et dommages en option.
- Une **carrière** existe dans le code, actuellement masquée. Elle n'a plus qu'une coupe : les
  trois autres couraient dans les catégories retirées.
- IA qui freine selon son talent, choisit sa ligne pour dépasser, aspire dans le sillage, se touche.
- Français / anglais, son procédural, sauvegarde locale.

## Éditeur de lignes (`lignes.html`)

Le jeu résout lui-même sa corde : il cherche le chemin qui plie le moins en restant sur la piste, ce
qui produit l'entrée large, le point de corde et la sortie large sans que rien de tout cela soit
écrit nulle part. C'est bon la plupart du temps, et quand ça ne l'est pas — un enchaînement où le
solveur sacrifie le second virage, une chicane qu'il prend trop droit — aucun réglage ne rattrape une
trajectoire : il faut la dessiner.

Cette page, qui n'est pas dans le jeu, charge un **circuit intégré**, affiche ses trois lignes telles
que le jeu les calcule, les rend déplaçables point par point, et produit le bloc `lines` à coller
dans `js/tracks.js` à côté de `pts`. Dès qu'un circuit porte ce bloc, le solveur ne tourne plus pour
lui et c'est le dessin qui fait foi.

Glisser un point le déplace, la molette zoome, glisser le fond déplace la vue, le clic droit sur un
point le ramène sur la ligne calculée. Quatre boutons : revenir au calcul (une ligne ou les trois),
lisser, ramener dans la piste. Le nombre de points de contrôle se change sans perdre la forme —
la ligne courante est rééchantillonnée, pas recalculée.

**Ce qui est affiché est ce que le jeu jouera, parce que c'est le code du jeu qui le calcule.** La
ligne dessinée n'est pas la spline qui passe par les points de contrôle : c'est la ligne d'un objet
`Track` construit avec eux, exactement comme au chargement d'une partie. La nuance n'est pas
théorique, et le premier jet s'y est trompé. Après projection, le jeu **limite la vitesse à laquelle
une trajectoire peut traverser la piste** — un pilote ne se déporte pas de trois mètres en cinq — si
bien qu'un point tiré de deux mètres n'en donne que 0,89 une fois rejoué. Un éditeur qui afficherait
la spline brute montrerait une ligne que le jeu n'accepte pas : on réglerait à côté en croyant
régler. Ici la ligne résiste quand on lui demande l'impossible, et c'est une information.

**Deux boutons pour enregistrer, et ils ne servent pas à la même chose.** « Enregistrer pour le jeu » pose la
ligne dans la base du navigateur, à côté des circuits perso : le circuit est modifié dès la partie
suivante, sur ce poste, sans rien publier, et « Essayer » ouvre le jeu dessus dans la foulée.
« Enregistrer `js/tracks.js` » est l'autre : lui seul fait qu'une ligne vaut pour tout le monde et
survit à un autre navigateur. La distinction est écrite dans la page plutôt que laissée à deviner —
les deux se ressemblent à l'usage, et découvrir six mois plus tard qu'une trajectoire n'existait que
dans un navigateur coûte cher.

Une page servie par GitHub Pages ne peut pas écrire dans `js/tracks.js` : il n'y a pas de serveur au
bout, seulement des fichiers. Elle peut en revanche **fabriquer le fichier** — relire celui qui est
servi, y poser les lignes au bon endroit, et le rendre à télécharger. Il ne reste qu'à le remettre
dans `js/` et à publier, sans copier-coller et sans risque de coller au mauvais endroit. Toutes les
lignes enregistrées y passent d'un coup, sinon retoucher trois circuits demanderait trois
téléchargements dont chacun repartirait du fichier servi et effacerait les deux autres.

La découpe se fait au comptage d'accolades, en sautant ce qui est entre guillemets : une définition
de circuit est un objet littéral, et chercher la fin d'un objet à l'expression régulière marche
jusqu'au jour où ça ne marche plus. Repasser sur un circuit qui porte déjà un bloc le remplace au
lieu d'en ajouter un second.

La reprise locale se pose au seul endroit par lequel toute définition de circuit passe, `allTracks()`.
Un circuit intégré qui en porte une garde tout le reste — tracé, largeur, décor — et voit seulement
ses trois lignes remplacées ; le solveur ne tourne alors plus pour lui, puisqu'un circuit qui porte
ses lignes ne le réveille pas.

`tools/e2e-lignes.js` vérifie précisément cela : il déplace un point, exporte le bloc, reconstruit le
circuit comme le jeu le fait, et compare. L'écart est de **0,00 m**, et un aller-retour export/relecture
retombe à 0,003 m près — l'arrondi de l'export, et rien d'autre. Il vérifie aussi que les trois lignes
restent distinctes et dans la piste, et que les douze circuits se chargent.

Puis il fait la seule vérification qui compte pour l'enregistrement local : il pose une ligne
franchement décalée, ouvre **le jeu** dans le même navigateur, et relit la trajectoire qu'il conduit.
L'écart est de **0,002 m**, et « oublier » rend bien la main à la ligne calculée. Le premier jet de
cet essai annonçait un défaut qui n'existait pas : `browser.newPage()` ouvre un contexte neuf à
chaque appel, donc une autre base, et l'éditeur posait sa ligne là où le jeu ne la lirait jamais.

Et pour le fichier fabriqué, trois vérifications et pas une de moins, parce qu'un patch textuel qui
produit un fichier « presque » correct casse le jeu au chargement suivant : le fichier **s'évalue**,
il garde ses **douze circuits**, et le circuit repris porte bien la **ligne dessinée** — à 0,005 m —
et non celle que le solveur aurait proposée.

Deux détails qui viennent de la même exigence. Les coordonnées exportées sont dans les unités de
`pts`, pas en mètres : un circuit intégré est décrit dans une unité arbitraire puis redimensionné pour
tomber sur sa longueur annoncée. Et « lisser » agit sur l'écart à l'axe, jamais sur les points
eux-mêmes — moyenner des coordonnées rétrécit une boucle, comme un cercle dont on moyenne les points
voisins, ce qui décollerait la ligne de la piste à chaque passage.

Au passage, un défaut latent que cet outil a révélé : `_projectLines` recevait `def.scale`, qui vaut 1
pour un circuit intégré, alors que sa ligne centrale est redimensionnée après coup. Des lignes
explicites sur un circuit intégré auraient été projetées à côté de la piste.

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
sprites/top/               voitures dessinées vues à la verticale, une par livrée
sprites/pick/              illustrations en trois quarts pour le menu, une par livrée
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

Le menu est une affiche, `art/menu-bg.webp`, et les bandeaux posés dessus sont les boutons.
Chacun y est **imprimé replié** — l'icône et une amorce à damier, sans mot. Le dessin déplié, celui
qui porte le texte, est posé par-dessus et se découvre de la gauche vers la droite.

Le pli n'est donc pas un tour joué à une seule image : le bandeau fermé est vraiment dessous, le
bandeau ouvert le recouvre vraiment, et c'est pour cela qu'il n'y a rien eu à effacer de
l'affiche.

**Un bandeau ne s'ouvre qu'à l'appui.** Au repos, le menu est exactement la maquette : des
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
large que lui pour qu'un pouce la trouve. `tools/e2e-menu.js` vérifie les bandeaux, le chargement
réel de chaque image, le dépliage, et l'endroit où mène chaque bouton.

### Retirer une entrée, c'est refaire l'affiche

L'atelier voiture et l'atelier circuits ont quitté le menu. Retirer les deux lignes de `js/ui.js`
n'aurait pas suffi : les bandeaux repliés sont **peints dans le fond**, c'est tout l'intérêt du
dépliage, et deux bandeaux seraient restés sur l'affiche sans mener nulle part. C'est donc
l'affiche elle-même qui a été refaite sans eux. Les trois qui restent n'ont pas bougé d'un pixel —
20,04 / 30,38 / 40,79 %, les mêmes chiffres qu'avant.

Ce qui a été retiré est l'entrée, pas la fonction : `_act` garde ses cas, `editor.html` et
`lignes.html` répondent toujours à leur adresse, les voitures et les circuits déjà enregistrés se
choisissent toujours en course, et les dessins dépliés dorment dans `art/menu/`. Le lien « éditeur
→ » de l'écran de départ est parti avec, lui aussi : laisser l'atelier à une tape de distance
n'aurait rien désactivé du tout.

**Le défaut que cette page peut avoir, et que rien ne montrait.** Les boutons sont des rectangles
transparents posés à des hauteurs écrites à la main. Rien ne les lie aux bandeaux peints : refaire
l'affiche, ou changer un chiffre, décale les cibles sans rien casser ni rien afficher de faux. On
clique simplement à côté, et une capture d'écran n'en montre rien puisque les boutons sont
invisibles.

`tools/e2e-menu.js` lit donc le fond lui-même, sur **une seule colonne**, à 6 % du bord gauche.
C'est le seul endroit où un bandeau est une couleur franche et rien d'autre : plus à droite
viennent les traits de vitesse, l'icône, le damier. Une première version cherchait des bandes sur
tout le tiers gauche et se faisait couper par les icônes — elle voyait deux bandeaux sur trois et
en inventait un quatrième dans les arbres. Sur cette colonne, un bandeau est une suite de lignes
saturées et de couleur **constante**, et c'est la constance qui écarte le vibreur rouge et blanc du
bas de l'affiche : texturé, écart-type 72, là où un bandeau est plat, 23 au pire.

Le détecteur se vérifie lui-même de deux façons. Passé sur l'affiche d'avant, à cinq bandeaux, il
retrouve les cinq hauteurs qui étaient alors écrites dans `ui.js` — 20,2 / 30,4 / 40,9 / 51,3 /
61,8 %. Et remettre cette affiche-là fait échouer l'essai en nommant les deux bandeaux devenus
orphelins. Un contrôle qui ne sait pas échouer ne contrôle rien.

Ce qu'il compare est le **haut** du bandeau et le haut du bouton, et non leur recouvrement : les
bandeaux sont des parallélogrammes qui descendent vers la droite, donc sur cette colonne on ne voit
que leur début — or le haut est justement le nombre qu'on écrit à la main. Les trois tombent à
0,12 point près.

Cette vérification a demandé une autre correction, déjà apprise sur le moteur à échantillon : sous
`file://` toute image vient d'une autre origine, donc la lire dans un canvas est interdit. L'essai
sert maintenant le dossier en HTTP, comme le fait GitHub Pages.

## Quitter une course

Au clavier, Échap et P mettent en pause depuis toujours. Au doigt il n'y avait rien : une course
commencée ne se quittait plus. Le HUD est entièrement dessiné sur le canvas, donc le bouton l'est
aussi — il est posé par `_layoutHud` et testé au clic par `pauseHitAt`, exactement comme le curseur
de ligne.

Il se glisse entre les deux panneaux du haut, le seul endroit que rien n'occupe. Cet espace n'est
pas le même partout : 62 px sur un iPhone 13, 47 sur un SE, plus de 400 en paysage et sur un
écran d'ordinateur. Une taille posée en dur passerait donc sous le chrono sur les écrans étroits,
et sa taille suit la place — 46 px quand il y en a, 37 au plus serré. Les mesures des deux panneaux
ont remonté dans `_layoutHud` au passage : deux jeux de constantes qui doivent rester d'accord
finissent toujours par ne plus l'être.

Le temps au tour s'affiche maintenant sous le bouton et non plus à 12 % de la hauteur. En paysage
sur un téléphone, 12 % de 390 px tombait pile dessus.

**Le vrai risque n'est pas que le bouton manque, c'est qu'il accélère.** En course, tout appui qui
n'est pas le curseur de ligne est de l'accélérateur : un bouton mal branché mettrait en pause *et*
donnerait les gaz, qu'on retrouverait collés à la reprise. Le test se fait donc avant cette
branche, et sort sans rien inscrire dans `pointers`, si bien que le relâchement n'a rien à défaire.

### L'encoche, que rien ne voyait

Le bouton était bien là sur mobile, et pourtant il manquait. Le canvas est en
`position: fixed; inset: 0` avec `viewport-fit=cover` : il couvre l'écran **entier**, encoche et
barre d'accueil comprises. Les écrans en DOM respectent `env(safe-area-inset-*)` depuis toujours —
mais le HUD est dessiné, et un dessin ne connaît pas le CSS. Il posait donc ses quatorze pixels
depuis le bord *physique* de l'écran. En portrait sur un iPhone, le bouton pause allait de 14 à 60,
sous une barre d'état haute de 47 : aux trois quarts caché, et intouchable.

Le même écart valait pour le reste du HUD — le cadran d'accélérateur passait sous la barre
d'accueil, et en paysage les panneaux du haut passaient sous l'encoche. Tout le HUD se mesure
maintenant depuis le bord **sûr** : `_layoutHud` calcule un écart par côté, `14 + l'encoche`, et
tout le reste s'y réfère.

`env()` ne se lit pas depuis JavaScript : la valeur calculée d'une propriété personnalisée n'est
pas résolue, on récupérerait le texte `env(...)`. Le moteur de rendu passe donc par une sonde — un
élément qui porte ces quatre valeurs en marge intérieure, ce qui, lui, se résout en pixels — relue
à chaque mise en page, parce que tourner le téléphone déplace les encoches.

`tools/e2e-pause.js` vérifie les trois choses sur quatre formats — SE, iPhone 13, paysage, bureau :
que le bouton ne passe pas sous un panneau, qu'il met en pause, et qu'il laisse l'accélérateur
tranquille. **Aucun des quatre ne pouvait voir l'encoche** : l'émulation de Chromium résout `env()`
à zéro, et quatre formats qui passent ne disent rien d'un défaut qu'aucun d'eux ne reproduit. Un
cinquième cas force donc la sonde, et seulement elle, aux valeurs d'un iPhone 13 en portrait — 47
en haut, 34 en bas. Tout le reste du chemin est le vrai. Débrancher la lecture des encoches fait
réapparaître le symptôme mot pour mot : « bouton passé de y=14 à y=14 ».

Sa première version tapait puis mesurait, et **ne pouvait pas voir ce qu'elle prétendait
vérifier** : le relâchement avait déjà remis l'accélérateur à zéro, donc elle lisait « éteint »
même avec le bouton débranché. Elle garde maintenant l'appui pendant la mesure. Pour le tactile,
dont le chemin est différent, elle regarde en plus si le cadran d'accélérateur a sauté sous le
doigt — c'est la trace que laisserait un appui mal aiguillé, et elle, elle survit au relâchement.
Débrancher le bouton fait bien échouer l'essai, sur les quatre formats.

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

### Une série se parcourt, elle ne s'empile pas

Les neuf voitures et les douze circuits étaient posés en grille. Sur un téléphone, chaque grille
fait un écran de haut : on choisissait en faisant défiler la page, donc en perdant de vue tout ce
qu'on ne choisissait pas. C'est l'inverse de ce que sert un écran de sélection — comparer.

Les deux sont maintenant des **rails** qui défilent de gauche à droite, une seule ligne chacun. La
carte suivante dépasse du bord : c'est elle qui dit que ça se pousse, et aucune autre marque n'est
nécessaire. Les deux flèches ne s'affichent qu'à la souris (`@media (hover: hover) and (pointer:
fine)`) : au doigt on pousse le rail, et deux boutons posés par-dessus les cartes mangeraient la
place des cartes sur un écran étroit.

**Le calage, qui est tout le problème.** Choisir une voiture repeint l'écran entier. Sans rien de
plus, taper la neuvième carte ramène le rail à la première : on se retrouve devant la M1 après
avoir choisi la CSL, avec la marque de sélection hors champ. Le réglage aurait marché et l'écran
aurait dit le contraire. `show()` relit donc le `scrollLeft` de chaque rail avant de remplacer le
HTML et le repose après, exactement comme il le fait déjà pour le défilement de la page. À la
**première** ouverture, où il n'y a rien à reposer, le rail se centre sur la carte déjà choisie
plutôt que de partir du début.

`scroll-snap-type: x proximity` et non `mandatory` : « mandatory » recale le rail sur une carte à
chaque arrêt, y compris quand on ne voulait que jeter un œil à la suivante, et le rail semble
alors résister au doigt.

### Les circuits perso quittent l'écran de sélection

La zone « Circuits perso » est retirée, comme le lien vers l'éditeur l'avait été avant elle. Elle
n'était plus alimentée par rien : l'atelier n'est plus accessible depuis le menu, si bien que la
liste était soit vide, soit le musée des essais d'un ancien réglage. Les tracés enregistrés ne
sont pas effacés — ils restent dans la base du navigateur, et `editor.html` y mène encore par son
adresse.

Le piège n'était pas la liste, c'était le **garde-fou**. Il acceptait un circuit perso comme
sélection valide ; retirer la liste sans y toucher aurait laissé un circuit perso sélectionné chez
qui en avait un, plus aucune carte n'aurait porté la marque, et la course serait partie sur un
tracé absent de l'écran. On retombe donc sur le premier circuit ouvert.

**Sauf celui qu'un lien nomme.** Le bouton « Essayer » de l'éditeur ouvre `index.html?track=…` et
pose directement l'identifiant dans l'écran de sélection. Écarter tous les circuits perso cassait
donc l'aller-retour éditeur → jeu, qui est le seul moyen de voir un tracé qu'on vient de dessiner :
la course partait sur Monza sans qu'un mot le dise, et `tools/e2e-editor.js` l'imprimait sans
broncher parce qu'il se contentait d'afficher le circuit sélectionné au lieu de l'exiger. Ce
circuit-là garde donc sa carte, ajoutée en fin de rail — pas de titre, pas de catalogue, seulement
celui qu'on a demandé — et l'essai refuse désormais tout autre nom que celui qu'il vient
d'enregistrer.

### Sous un circuit : son nom, puis son drapeau et sa longueur

La carte portait « drapeau + nom » sur la première ligne et « N tours · longueur » sous elle. Le
nombre de tours est parti : c'était la **proposition** du circuit, alors que la course se court sur
le nombre choisi juste en dessous, si bien qu'une carte pouvait annoncer « 4 tours » pendant que le
réglage disait 5. Le drapeau est descendu d'une ligne, auprès de la longueur : le nom tient seul en
tête, et tout ce qui le qualifie vit sur la ligne d'en dessous.

La longueur passe par une seule fonction, `longueur(tr)`, parce qu'elle n'est pas rangée au même
endroit selon l'origine du circuit : un circuit intégré la porte en clair dans `length`, un circuit
de l'éditeur la range sous `editor.lengthM` — le chiffre tapé par l'auteur, dont toute son échelle
découle. Lire seulement `length` aurait laissé la carte d'un tracé dessiné sans rien sous son nom.

### La page glissait de côté, et ce n'était pas nouveau

`overflow-y: auto` seul ne veut pas dire ce qu'on croit : dès qu'un axe passe à `auto`, l'autre ne
peut plus rester `visible` et devient `auto` lui aussi. Les écrans défilants étaient donc
scrollables **horizontalement** depuis toujours — 869 px de glissement mesurés sur un iPhone 13,
395 px sur un bureau. Inoffensif tant que rien ne débordait ; avec les rails, une inflexion du
pouce emportait la page entière de côté et laissait une bande vide à l'écran.

L'axe horizontal est fermé explicitement : c'est au rail de défiler, pas à l'écran. Les boîtes de
rail reçoivent aussi `min-width: 0`, sans quoi leur plancher de largeur, dans une colonne flexible,
se calerait sur la somme des cartes.

**L'essai balaie pour de vrai**, ailleurs que sur un rail. Lire la propriété CSS ne suffisait pas :
avec `overflow-x: hidden`, `scrollLeft` reste modifiable par programme, et une mesure qui se
contente de l'écrire puis de le relire retrouve sa valeur — elle aurait conclu que rien n'était
corrigé. C'est le geste qui doit rester sans effet, donc c'est le geste qu'on fait.

### Les records, une ligne par voiture

L'écran du contre-la-montre n'affichait qu'un chiffre : le meilleur tour du circuit, toutes
voitures confondues. C'est le moins utile des deux — il dit qu'on a déjà tourné vite ici, sans
dire avec quoi, donc sans rien donner à battre. Il y a maintenant **une ligne par voiture**,
vignette à gauche, nom, temps à droite à chasse fixe. Rangées par temps, les vierges à la fin :
un classement, pas un catalogue. La vignette parce qu'une liste de noms se lit, là où une liste de
voitures se reconnaît.

La sauvegarde écrit désormais **deux clés** pour un même tour : `circuit|catégorie` et
`circuit|catégorie|voiture`. La première reste, et c'est elle qui décide du « Nouveau record ! » :
un meilleur tour toutes voitures confondues. Sans cela, le premier tour bouclé avec chaque nouvelle
voiture aurait déclenché la bannière, y compris à dix secondes du meilleur temps du joueur — une
félicitation qui félicite tout le monde ne dit plus rien.

Les anciennes sauvegardes gardent leurs clés à deux morceaux. Rien n'est perdu, et rien n'est
inventé non plus : on ne sait pas avec quelle voiture ces tours ont été signés, donc on ne les
attribue à aucune, et la liste par voiture se remplit à partir des prochaines sorties.

**Une collision de noms, trouvée en mesurant.** Les lignes se sont d'abord appelées `.rec` — déjà
pris par la pastille « Nouveau record ! » de l'écran de fin. Mes règles, écrites plus bas dans la
feuille, passaient par-dessus les siennes : un bout de phrase en ligne devenait une grille pleine
largeur, avec un fond de carte et une colonne de 76 px pour une vignette qu'elle n'a pas. Deux
écrans éloignés, une classe commune, et rien pour le signaler. Les lignes s'appellent `.rline`, et
`tools/e2e-rails.js` vérifie que la pastille reste `display: inline` sans fond.

`tools/e2e-rails.js` couvre les trois changements sur téléphone et sur bureau : le circuit fantôme
rapatrié, le débordement réel des rails (si les cartes reviennent à la ligne, `scrollWidth` vaut
`clientWidth` et il n'y a plus rien à faire défiler — l'écran a l'air correct et le geste ne sert
à rien), le calage conservé après un choix fait à l'autre bout du rail, l'ordre et les vignettes
de la table des records, et l'écriture de la clé par voiture en fin de course.

### Les quatre cadrans

Sous chaque voiture, quatre jauges circulaires : **accélération**, **vitesse de pointe**,
**freinage**, **adhérence**.

Aucun de ces chiffres n'est une note attribuée à la main. Chacun s'obtient en appliquant au modèle
la loi que le jeu applique vraiment en course, dans `perfOf` :

| cadran | ce qu'il montre | d'où il sort |
|---|---|---|
| accélération | secondes de 0 à 100 km/h | intégration de `a(v) = accel · (1 − (v/vmax)^2,5)`, la formule de `car.js` |
| vitesse | km/h | `vmax`, tel quel |
| freinage | mètres de 100 km/h à l'arrêt | `v²/2a` avec la décélération de `car.js`, `1,5 + brake` |
| adhérence | g en virage à 180 km/h | `grip + appui × 2500`, appui aérodynamique compris |

L'intérêt de passer par les lois plutôt que par un second jeu de valeurs : retoucher un `mul` se
lit aussitôt sur les cadrans, et il n'y a jamais deux vérités à tenir d'accord.

**Les bornes sont absolues et hors d'atteinte**, dans `PERF_RANGE` :

```
a100  [5, 2.5]      5 s une routière rapide, 2,5 s hors d'atteinte
vmax  [150, 350]    km/h
b100  [30, 12]      30 m une routière, 12 m hors d'atteinte
gripG [1, 2.6]      1 g ce que tient une bonne routière, 2,6 g hors d'atteinte
```

**Aucune borne basse n'est zéro.** Une voiture de ce plateau ne roule pas à 40 km/h et ne tient pas
0,2 g : ce bas d'arc n'aurait servi qu'à écraser les écarts. Elles valent toutes ce que tient une
bonne routière — 5 s, 150 km/h, 30 m, 1 g.

Le premier chiffre est l'arc vide, le second l'arc plein : pour un temps et une distance ils sont
décroissants, puisque plus court vaut mieux, ce qui évite d'avoir à écrire ailleurs dans quel sens
lire. Aucune voiture du plateau ne remplit un cadran — la meilleure monte à 79 % — et c'est
voulu : un arc plein dirait « le maximum possible », ce qu'aucune voiture n'a à afficher. Une
voiture ajoutée plus tard peut se placer au-dessus des neuf actuelles sans qu'on retouche
l'échelle.

Le point à surveiller quand on touche à ces bornes : **elles ne règlent pas seulement l'étalement,
elles règlent aussi le niveau de remplissage moyen de chaque cadran**, et donc l'impression que
donne une carte. Des bornes dépareillées font paraître une même voiture excellente sur un cadran
et médiocre sur un autre, alors que c'est le choix des bornes qui parle et non la voiture — avec
`[8, 2]` sur l'accélération et `[1, 3]` sur l'adhérence, le plateau occupait 72 à 77 % du premier
arc contre 34 à 46 % du second, et chaque carte racontait « rapide au départ, molle en virage ».
Les quatre bornes actuelles partent toutes du même niveau de routière, d'où quatre cadrans
comparables :

| cadran | bornes | arc du plateau | étalement |
|---|---|---|---|
| accélération | `[5, 2.5]` | 53 → 66 % | 12 points |
| vitesse | `[150, 350]` | 45 → 64 % | 19 points |
| freinage | `[30, 12]` | 43 → 55 % | 12 points |
| adhérence | `[1, 2.6]` | 42 → 57 % | 15 points |

**L'arc suit le chiffre affiché, pas la valeur brute.** L'invariant tient en une phrase : deux
voitures qui montrent le même nombre montrent le même arc. Il se casse tout seul dès qu'on
arrondit le texte sans arrondir aussi la valeur qui pilote l'arc, et c'est exactement ce qui est
arrivé — la 787B s'arrête en 20,118 m et la CSL en 20,298 m, toutes deux affichées « 20 » au mètre
près, avec deux arcs différents ; le même écart séparait la Countach et la GT40 à « 1,69 » g. Le
cadran part donc de la valeur arrondie à ce qu'il écrit. Le freinage garde en plus une décimale :
au mètre près, neuf voitures ne prennent que trois valeurs distinctes et l'essentiel des écarts
disparaît de l'écran.

`NODE_PATH=$(npm root -g) node tools/e2e-gauges.js` relit les neuf cartes dans le navigateur et
tient les deux propriétés : aucune paire chiffre/arc incohérente, aucun cadran plein.

Deux détails qui coûtent une heure si on ne les sait pas. L'arc est tracé au `stroke-dasharray`,
dont la longueur passe par une **variable CSS et non par l'attribut du SVG** : une déclaration CSS
l'emporte toujours sur un attribut de présentation, et écrire la valeur dans la balise ne donne
qu'un anneau vide. Et les pictogrammes sont des **tracés, pas des émojis** : un émoji change de
dessin d'un téléphone à l'autre et arrive parfois en couleur par-dessus celle du cadran.

Sur la couleur, un arbitrage assumé. Quatre teintes dont un rouge et un vert ne se distinguent pas
toujours en vision des couleurs déficiente : l'écart mesuré tombe à 7 sur 100 en deutéranopie.
Les rendre conformes demanderait de les assombrir, ce qui dégrade l'écart au lieu de l'améliorer —
le jeu de couleurs sombres tombe à 2,7. On garde donc les teintes vives, et **aucune information
ne repose sur la couleur seule** : chaque cadran porte son pictogramme et son unité écrite, et les
quatre ne se comparent jamais entre eux — ce sont quatre mesures séparées, pas une série. Le
chiffre, lui, est en blanc et non de la couleur de l'arc : en petit corps gras sur une carte
sombre, une couleur saturée passerait sous le seuil de contraste.

Les voitures sans illustration gardent leur vue de dessus : les deux voies cohabitent le temps que
la série soit complète.

La boîte de la vignette est en 4/3 et le dessin y tient en `contain` : les illustrations ne sont
pas cadrées pareil d'une voiture à l'autre — la CSL arrive en 1,06 de rapport, la Corvette en 1,58
— et les forcer au même cadre les déformerait. Le prix est que la voiture n'occupe pas tout à fait
la même surface d'une carte à l'autre.

### La 935 remplace la 917 K, identifiant compris

Elle prend un identifiant NEUF, `935`, et pas celui de la voiture qu'elle remplace. L'identifiant
est la clé sous laquelle sont rangés les records — locaux comme mondiaux — et les planchers du
serveur. Le garder aurait fait hériter la 935 des temps signés avec un prototype douze cylindres :
des records qu'elle n'a pas faits, sur une voiture qui n'existe plus. Les anciennes lignes `917k`
restent dans la sauvegarde sans plus s'afficher ; rien n'est effacé, rien n'est attribué à tort.

Trois conséquences, toutes traitées, et dont deux ne se voient pas à l'écran.

**Les planchers du serveur.** Il n'y en avait aucun pour `935`, et la fonction serveur refuse un
couple qu'elle ne connaît pas — volontairement, puisqu'accepter par défaut ouvrirait la porte à un
identifiant inventé. Sans régénération, **tout temps en 935 aurait été rejeté**. `planchers.sql`
porte en plus un `delete` pour les voitures disparues : un `insert ... on conflict` n'enlève rien,
et les douze planchers de la 917 K seraient restés en base pour toujours.

**Le classement de difficulté est RELATIF**, donc l'arrivée d'une voiture le déplace tout entier.
`tools/difficulte.js` place la 935 en tête (score 0,93, la plus dure du plateau), ce qui repousse la
Corvette et la 911 Turbo de cinq pneus à quatre. On applique la table mesurée en entier, pas la
seule ligne nouvelle : garder les anciennes valeurs à côté d'une mesure fraîche aurait mis l'écran
en désaccord avec elle.

**Le son.** La 917 K jouait le jeu de prises `bac_mono`. La 935 est un flat-6 turbo, donc la même
famille que la 930 d'à côté : elle passe sur `procar`, rupteur à 8000, avec l'étagement court
d'une silhouette de Groupe 5.

**Son illustration de menu** est passée par `tools/pickcar.py` comme les huit autres. La source
faisait 1536×1024 et 1,8 Mo ; les cartes du menu en affichent 420 de large. Posée telle quelle,
elle aurait coûté dix fois le poids des voitures voisines pour le même résultat à l'écran — sur
un téléphone en 4G, c'est l'écran de sélection qui attend. L'outil la ramène à 420×271 et 180 Ko,
dans la fourchette des autres (176 à 343 Ko), avec les mêmes 40 % de transparence.

### Plusieurs livrées par voiture, et le clic qui les fait tourner

Une livrée n'est pas une couleur ici. Les neuf voitures portent une illustration, et l'illustration
remplace le dessin vectoriel **et** la teinte : la palette `LIVERIES` ne se voit plus sur aucune
d'elles. Changer de livrée, c'est donc changer de fichier. La 3.0 CSL en a trois — Motorsport,
Castrol, Calder.

Deux voitures en ont trois : la 3.0 CSL (Motorsport, Castrol, Calder) et la F40 (Pilot, Rosso,
Crawford). Les livrées sont nommées d'après ce qui est écrit sur la voiture plutôt que d'après sa
couleur — « Pilot » et « Crawford » se lisent sur les flancs — parce que ces noms s'affichent tels
quels dans les deux langues du jeu et qu'un nom de couleur, lui, demanderait une traduction.

Un modèle déclare ses livrées dans `js/cars.js`, et **les chemins se déduisent de l'identifiant** :
`castrol` donne `sprites/top/csl_castrol.png` et `sprites/pick/csl_castrol.png`, un identifiant vide
garde les fichiers sans suffixe pour que la livrée d'origine n'ait pas à être renommée. Déduire
plutôt qu'écrire les six chemins à la main tient le fichier lisible, mais surtout ça empêche la
vignette du menu et la vue de dessus de désigner deux livrées différentes — un écart qui ne se
verrait qu'en comparant le menu et la piste.

Un modèle qui ne déclare rien reçoit **une** livrée bâtie sur ses propres fichiers. Tout le reste du
jeu lit donc la même liste, qu'un modèle en ait trois ou une : il n'y a nulle part un cas
particulier « ce modèle n'a pas de variantes », qui serait précisément celui qu'on oublie dans une
des cinq fonctions qui dessinent une voiture.

**Le premier appui choisit, les suivants font tourner.** Choisir une voiture ne doit pas repeindre
au passage celle qu'on vient de prendre ; une fois choisie, la carte devient le sélecteur de livrée.
Le repère `2/3 Castrol` n'apparaît que sur les modèles qui en ont plusieurs : une pastille « 1/1 »
sur huit cartes sur neuf promettrait un choix qui n'existe pas. Il est donc le mode d'emploi en même
temps que l'état — on ne devine pas qu'une carte déjà choisie se re-clique, mais on lit `2/3`.

Le choix est rangé **par voiture** (`save.livrees[modelId]`) : revenir à la CSL après un détour par
la 935 rend la Castrol. Il voyage aussi dans le salon en ligne, sinon chaque écran dessinerait la
voiture d'un autre dans la peinture qu'il a lui-même choisie. Et les pilotes de l'IA tirent la leur
au même générateur que leur nom et leur talent : sans ce tirage, trois CSL sur la grille portaient
la même peinture alors que le jeu en a trois — on aurait dessiné des variantes pour ne les voir
qu'une à la fois. Le tirage suit la graine, donc une manche de championnat rejouée présente la même
grille.

Une vignette manquante retombe sur celle d'origine, et le repli est posé **en attribut** et non
branché par script : un gestionnaire ajouté après coup arrive après le chargement, et si l'image a
déjà échoué l'événement est passé. Une illustration de dessus manquante retombe sur le dessin
vectoriel, sans retenir la barrière de chargement — un fichier absent ne viendra pas.

`tools/e2e-livree.js` ne vérifie pas que l'écran a changé d'aspect mais que **le bon fichier a été
servi** : il note chaque chemin demandé et chaque chemin réellement rendu. Il **demande au jeu** la
liste des voitures à plusieurs livrées au lieu de la porter en dur — un essai qui nomme la CSL ne
dirait rien de la F40 ajoutée le lendemain, et surtout il continuerait à passer. Il exige en retour
d'en trouver au moins une, et une à dessin unique : une liste vide traverserait toutes les boucles
sans rien contrôler. Chaque voiture fait un tour complet, qui doit revenir à la première — un cycle
qui s'arrête au dernier cran ne montre jamais qu'il reboucle. Les deux ne se valent
pas — un chemin mal formé est demandé comme un autre, et comme une vignette absente retombe
proprement sur la livrée d'origine, un essai qui regarderait la demande seule verrait tout au vert
devant un fichier introuvable. Vérifié en retirant un fichier : deux contrôles tombent. Et il
interroge le tirage de l'IA directement, parce que la course jouée ne comptait qu'une CSL : le
contrôle « elles ne portent pas toutes la même » y passait sans rien prouver.

### Cinq images brutes, neuf mégaoctets

Les six illustrations livrées — les deux CSL, la vue de dessus reprise de la CSL, la vignette de la
Corvette — arrivaient en rendu brut : 1627 à 1699 px de large, 1,6 à 2,1 Mo pièce, là où les cartes
du menu en affichent 420 et où les autres voitures tiennent entre 158 et 343 ko. Neuf mégaoctets que
le téléphone télécharge pour les réduire à l'affichage, sur l'écran de sélection puis sur la grille
de départ — c'est-à-dire exactement ce que la barrière de chargement fait attendre.

Elles étaient en revanche **déjà détourées**, alpha propre et cadrage voulu : refaire le travail de
`topcar.py` ou `pickcar.py` n'aurait pu que les abîmer — un remplissage de fond n'a rien à mordre
sur une image transparente, et redresser une vue en trois quarts la couche de travers. D'où
`tools/calibre.py`, qui ne fait que la dernière étape : rogner sur l'alpha, puis ramener à 420 px.
Un rendu brut porte souvent une marge vide, et réduire avec la marge donnerait une voiture plus
petite que les autres à largeur égale.

| | avant | après |
|---|---|---|
| six illustrations (CSL, Corvette) | 10,6 Mo | 839 ko |
| deux vignettes de F40 | 3,5 Mo | 289 ko |
| **en tout** | **14,1 Mo** | **1,1 Mo** |

L'original part dans `<dossier>-src`, parce qu'une réduction ne se remonte pas — et si une source du
même nom est déjà là, l'outil ne l'écrase pas et le DIT : un rendu remplacé par un autre laisserait
sinon l'ancienne source à côté de la nouvelle illustration, sous le bon nom, impossible à
distinguer de la bonne.

## Le son des voitures

Le moteur vient de [markeasting/engine-audio](https://github.com/markeasting/engine-audio), sous
licence MIT, porté en JavaScript dans `js/engine-audio.js`. La notice et le copyright de l'auteur
sont en tête du fichier, et la licence accompagne ses prises dans `sounds/engine-audio/LICENSE`.

Le principe. Le régime n'est plus déduit de la vitesse : c'est un **volant d'inertie** qu'on
intègre vingt fois par image. Un couple le pousse, un frein moteur le retient, un embrayage le
relie à une transmission, et les roues imposent leur vitesse à cette transmission. Le son sort de
là au lieu d'être plaqué dessus. Par-dessus, quatre boucles stationnaires — pied dedans en bas et
en haut, pied levé en bas et en haut — mélangées par deux fondus à puissance constante, l'un sur le
régime, l'autre sur l'accélérateur, chacune désaccordée de `(régime − son propre régime) × 0,2`
cent.

### Ce qui a été jeté, et pourquoi

Un oscillateur unique muni d'une `PeriodicWave` dont les coefficients étaient les ordres moteur,
filtré en échappement et en admission, plus un souffle, un clapot de ralenti modulé en anneau et un
sifflement de turbo ; puis, par-dessus, un lecteur granulaire qui se déplaçait dans une montée
enregistrée sans jamais la transposer.

Le raisonnement tenait, et il était vérifié : un quatre-temps allume cyl/2 fois par tour, donc une
octave sépare un six en ligne d'un V12 sans rien avoir à enregistrer, et les pics mesurés tombaient
à un demi pour cent de l'allumage attendu sur les neuf voitures. Le granulaire, lui, ne transposait
jamais — ce qui était le bon principe et reste vrai.

**Ce qui lui manquait n'était pas la justesse, c'était le répertoire.** Un régime déduit de la
vitesse par une règle de trois ne sait faire qu'une chose : monter et descendre. Pas de trou au
passage de rapport, pas de rebond contre le rupteur, pas de frein moteur qui retient, pas
d'embrayage qui patine au départ. Une montée enregistrée, si juste soit-elle, ne sait rien faire
d'autre que monter.

La contrepartie est assumée : **il y a de la transposition maintenant**, ce qu'on avait
explicitement écarté. Ce qui la rend tenable, c'est qu'elle est partielle — chaque prise ne
s'écarte que de trois ou quatre demi-tons du sien, là où une boucle unique étirée sur toute la
plage en demandait dix-neuf, et le reste du chemin est fait par le fondu vers la prise voisine.

### Trois écarts avec l'original

1. **`rpm` était faux d'un facteur π².** `(60 * omega) / 2 * Math.PI` se lit `((60·ω)/2)·π`, soit
   94,2·ω, là où des tours par minute valent 60·ω/(2π) = 9,55·ω. Chez l'auteur c'est sans
   conséquence : tout son réglage vit dans cette unité gonflée et reste cohérent avec lui-même.
   Chez nous les rupteurs sont réels et le HUD les affiche.
2. **Le passage de rapport ne passe plus par `setTimeout`**, qui ignore la pause du jeu et dépend
   de la charge de la machine. Il est daté sur l'horloge du jeu.
3. **L'accélérateur n'est plus écrasé à chaque sous-pas.** L'original le multiplie vingt fois par
   image, ce qui revient au bon résultat — mais seulement parce qu'il y a vingt sous-pas.

### Et trois ajouts, parce que son banc ne tire rien

Son démonstrateur est un banc d'essai : on y passe les rapports au clavier et rien ne relie le
moteur aux roues — l'inertie de charge y est même multipliée par zéro. Chez nous la vitesse de la
voiture est souveraine, elle sort de la physique du jeu, et le son doit la suivre.

- **Un embrayage.** Sans lui, à l'arrêt les roues tiennent le moteur à zéro et la voiture cale au
  départ d'une course.
- **Une raideur d'embrayage de 180 au lieu de 12.** À 12, sous couple constant, le moteur se
  stabilise `couple / (amortissement · inertie)` au-dessus des roues, soit près de 600 tr/min : un
  embrayage qui patine en permanence. Invisible sur un banc à vide, faux dès qu'un compte-tours
  affiche le régime.
- **Une hystérésis sur le choix du rapport**, sans quoi la boîte claque plusieurs fois par seconde
  autour de la vitesse de passage.

### Le pont se calcule, il ne se devine pas

Le rupteur ne peut rien contre une mauvaise démultiplication. Il coupe les gaz, mais en prise ce
sont les **roues** qui imposent le régime : si le dernier rapport donne 8210 tr/min à la vitesse
maximale d'une voiture qui coupe à 7000, elle y monte quand même et y reste.

C'est exactement ce qui est arrivé avec les rapports posés à la main — la 911 Turbo à 8210 pour un
rupteur à 7000, la GT40 à 6502 pour 6200, la Corvette à 6733 pour 6000. Trois voitures sur neuf, et
à l'oreille cela ne s'entend que comme « ça sonne trop haut », sans dire pourquoi.

Une vraie voiture est démultipliée pour que le dernier rapport atteigne le rupteur exactement à sa
vitesse maximale. `accordeBoite` calcule donc le pont au lieu de le deviner, ce qui est juste par
construction pour les neuf voitures et pour celles de l'atelier.

### Quelle voiture joue quel jeu de prises

`sounds/engine/voitures.json` fait l'aiguillage. Les trois jeux — procar, BAC Mono, 458 — sont
repris de `src/configurations.ts` sans y toucher : mêmes fichiers, mêmes régimes, mêmes volumes,
mêmes inerties et temps de passage.

| jeu | voitures |
|---|---|
| procar | M1 Procar, 911 Turbo, Countach LP500, GT40 Mk II, Corvette |
| BAC Mono | 787B |
| 458 | F40, 3.0 CSL |

Chaque voiture n'impose que trois choses par-dessus : son **rupteur**, son **ralenti** et sa
**boîte**. Le HUD affiche ce régime, et la boîte doit correspondre à la vitesse réelle de la
voiture. Une voiture absente du catalogue — celles de l'atelier — joue le jeu de la M1 avec son
propre rupteur : aucune voiture ne reste muette.

Un **niveau par jeu** a dû être ajouté. Les volumes de l'auteur décrivent l'équilibre entre ses
quatre boucles — 2,5 sur la voie haute du 458, 1,6 sur sa voie levée — et chez lui une sortie
maîtresse ramenait le tout. Chez nous ils arrivaient tels quels sur le compresseur et saturaient.
On ne touche pas à son équilibre, on ne descend que la sortie du jeu entier : 0,4 pour le 458.

### Boucler sans réencoder

`AudioBufferSourceNode` accepte `loopStart` et `loopEnd`, donc `tools/boucles.py` ne cherche que
deux instants et les range dans la configuration. Aucune prise n'est réencodée.

Cet outil s'est trompé deux fois sur la même question — un raccord de boucle s'entend-il ?

1. L'écart quadratique sur trente millisecondes rapporté au niveau de la prise. Il condamnait les
   six fichiers, de −1,7 à −13 dB. Il mesurait surtout le **bruit** — souffle, route, cylindres
   déphasés — qui ne coïncide jamais d'un tour à l'autre et ne s'entend pas pour autant.
2. La marche entre les deux échantillons du raccord, rapportée au RMS : 0,8 à 1,4, ce qui paraissait
   énorme. Mais le RMS est un niveau **moyen**, pas une vitesse ; il ne dit rien de ce qu'une forme
   d'onde a le droit de faire entre deux échantillons.

Rapportée à la plus grande pente que la prise contient **déjà**, la marche vaut 0,07 à 0,76. Le
raccord se perd dans ce que la prise fait de toute façon. Pas de machine à fondu pour un défaut
qu'on n'a pas su démontrer.

### Ce qui se mesure, et ce qui s'écoute

`tools/moteur-banc.js` mesure le volant sans une seule note : ralenti tenu, temps du ralenti au
rupteur, rupteur sans dépassement, régime à 0,1 % de ce que la boîte impose, une chute par passage,
frein moteur, aucun NaN sous secousses. Il a trouvé trois fautes, toutes de moi, toutes invisibles
à l'œil — dont un couplage aux roues qui avançait l'angle deux fois et faisait tourner la
transmission à 6,6 × 10³⁰¹ rad/s avant de tout passer en NaN.

`tools/e2e-moteur.js` mesure le moteur **dans le jeu** : que chaque voiture trouve un jeu de prises
et que chaque fichier cité existe, que les prises arrivent, que le régime monte au rupteur de la
voiture et non à celui du jeu, que le mélangeur bascule avec l'accélérateur, et que rien ne sature.
Il remplace `e2e-sample.js` et `e2e-audio.js`, qui mesuraient un moteur qui n'existe plus.

`moteur.html` est le banc d'écoute : un sélecteur de voiture, une vitesse, une pédale, et l'état du
mélangeur en direct — gain et désaccord par voie. Il ne sert à rien au joueur ; il sert à régler,
parce qu'aucun chiffre ne dit si un moteur sonne bien.

### Tenir soixante images par seconde sur un téléphone

Mesuré en bridant le processeur d'un facteur quatre, ce qui approche un téléphone de milieu de
gamme : le jeu tombait à **dix-sept images par seconde**. En désactivant le dessin, il remontait à
soixante — tout le coût est donc dans le rendu, et la physique, la caméra, les effets et le son
réunis ne pèsent pas deux millisecondes.

Deux choses en sont sorties.

**Le coût est exactement proportionnel au nombre de pixels** : 1,32 Mpx coûtent 57 ms, 0,33 Mpx en
coûtent 19. Le jeu est limité par le remplissage. La résolution s'adapte donc à ce que la machine
tient : on mesure la durée réelle des images, on descend d'un cran au-delà de 20 ms, on remonte en
dessous de 13. La marge entre les deux seuils évite l'accordéon, et une seconde de délai entre deux
changements évite de payer le redimensionnement plus souvent qu'il ne rapporte. Résultat : une
machine capable reste à pleine résolution et 60 im/s, et à quatre fois moins de processeur le jeu
descend à un pixel par point et tient **46 im/s** au lieu de 17.

**La piste était dessinée en entier à chaque image.** Un circuit fait plusieurs kilomètres, la
caméra en montre cinquante mètres, et le rasteriseur traitait tous les segments. Les tracés sont
désormais découpés en tronçons d'une soixantaine de mètres, chacun avec sa boîte englobante, et
seuls les tronçons en vue sont dessinés — de 11,4 ms à 5,7 ms. Deux détails qui comptent : les
tronçons se chevauchent d'un pas, sans quoi une ligne claire apparaît au raccord ; et le liséré
sombre de la piste est obtenu en traçant ses deux bords plutôt que le contour du ruban, faute de
quoi il apparaîtrait en travers de la route à chaque raccord.

`tools/perf.js` mesure tout cela, sur une course servie en HTTP et non en `file://` — sous
`file://` la rampe du moteur ne se charge pas, et un essai qui ne voit pas ce qu'on veut mesurer ne
mesure rien. Il ne regarde pas la moyenne mais la queue de la distribution : soixante images à
16 ms et une à 200 ms font encore 55 im/s de moyenne, et pourtant ça se voit.

**Les chiffres ci-dessus ne se comparent qu'entre eux.** Ils viennent d'une machine, un jour donné ;
la même mesure rejouée ailleurs donne 23 im/s à bridage égal, pour un code identique — vérifié en
rejouant le banc sur une version antérieure, qui rend le même chiffre. Un écart entre deux versions
ne veut donc rien dire s'il n'a pas été mesuré **dos à dos, dans la même session**.

### Le retrait de l'isométrique fait-il gagner des images par seconde ? Non

La question méritait d'être posée et il a fallu la mesurer plutôt que d'y répondre d'instinct. Trois
versions passées au banc dos à dos, processeur bridé quatre fois :

| | durée d'image médiane |
|---|---|
| avant le retrait (deux essais) | 36,1 et 36,3 ms |
| après le retrait (deux essais) | 36,0 et 37,8 ms |

**L'écart entre deux essais de la même version est plus grand que l'écart entre les versions.** C'est
attendu : le code retiré ne s'exécutait jamais en vue de dessus. On ne gagne pas ce qu'on ne dépensait
pas.

Ce qui change est ailleurs, et `tools/reseau.js` le mesure — les octets qu'une course télécharge, et
le temps que le joueur attend devant, à débit bridé comme sur un téléphone :

| | avant | après |
|---|---|---|
| téléchargé pour une course | 10 404 ko | **9 877 ko** |
| dont décor en trois quarts | 550 ko | — |
| barrière de chargement | 7,4 s | 6,5 s |
| du lancement au feu vert | 15,7 s | **15,7 s** |

Cinq pour cent de moins, et pourtant **le joueur attend exactement aussi longtemps**. La bande
passante libérée est reprise par ce qui bloquait déjà : les prises de moteur. La barrière raccourcit,
le total ne bouge pas.

**Où est vraiment le poids**, pour une course de dix voitures :

| | |
|---|---|
| prises de moteur d'UNE voiture | 5 870 ko (59 %) |
| affiche, fonds de carte, halle des stands | 2 476 ko |
| voitures vues de dessus | 1 013 ko |
| code et feuilles de style | 512 ko |

Les quatre prises du jeu `procar` sont des WAV bruts et pèsent à elles seules plus que tout le reste.
Et `art/Pitstop.png` fait 1 116 ko pour 1310 px de large, alors que la halle est dessinée entre 185 et
312 px sur un téléphone — mesuré, pas supposé.

### Six mégaoctets de moins, sans toucher à un son

Trois choses, dont aucune n'est un compromis sur la qualité.

**La halle des stands**, ramenée à 880 px — la taille maximale à laquelle elle est dessinée, mesurée
sur la caméra réelle : 185 à 312 px sur un téléphone, 389 à 858 px sur un écran de bureau au zoom le
plus serré. 1 116 → 463 ko. Le rapport de la halle (`PROF = LARGE * 287 / 880`) suit le fichier :
laissé à 429/1310, il aurait étiré le dessin de quelques pour cent sans que rien ne le signale.

**Les prises de moteur étaient en VIRGULE FLOTTANTE 32 bits.** Quatre octets par échantillon et par
canal, le format d'un atelier de montage — une dynamique de 1500 dB dont aucune n'est utilisée, les
pics mesurés tenant entre 0,17 et 0,87. En entier 16 bits c'est deux fois moins lourd pour 96 dB de
dynamique, et `tools/prises.py` mesure ce que la requantification coûte : **le bruit reste 75 à 89 dB
sous le signal**. 15,9 → 7,9 Mo sur l'ensemble des jeux de prises.

**Et pourquoi pas du MP3**, puisque la question s'est posée. Ces prises bouclent en permanence, bout
à bout, et un encodeur MP3 ajoute un délai au début et un remplissage à la fin : le raccord n'est
plus au bon échantillon, et un moteur à 6000 tours repasse par ce raccord plusieurs fois par seconde.
Le 16 bits ne touche à rien de tout cela — pas de codec, pas de délai, les boucles se raccordent au
même échantillon qu'avant. Si un jour il faut aller plus loin, c'est Opus qu'il faudra regarder, et
en mesurant la couture.

**Les cinq prises descendaient l'une après l'autre.** `EASampler.charge` attendait chaque fichier
avant de demander le suivant : cinq transferts en série pour le plus gros poste du jeu, le seul à ne
pas profiter du parallélisme que le navigateur offre gratuitement. À 1,5 Mbit/s, les derniers
n'arrivaient tout simplement jamais avant que la course ne parte sans eux — le banc ne voyait
descendre que 1 269 ko de son sur 2 958. Elles partent ensemble, et les voix ne sont branchées
qu'une fois tout arrivé : les brancher au fil de l'eau ferait entrer le moteur voix par voix, ce qui
s'entend bien plus qu'un démarrage un peu plus tard.

| à 4 Mbit/s, même banc | téléchargé | jusqu'au feu vert |
|---|---|---|
| avant le retrait de l'isométrique | 10 404 ko | 15,7 s |
| après le retrait | 9 877 ko | 15,7 s |
| **après la halle, le 16 bits et le parallèle** | **6 308 ko** | **13,9 s** |

**Le banc a menti une fois de plus, et toujours dans le sens qui arrange.** Son silence se mesurait
au nombre de requêtes parties : deux secondes sans nouvelle requête, et il comptait. Sur un lien lent
c'est faux — un fichier d'un mégaoctet met cinq secondes à descendre en 1,5 Mbit/s, pendant
lesquelles aucune requête nouvelle ne part. Il concluait au silence au milieu du téléchargement et
annonçait un jeu d'autant plus léger que le réseau est mauvais. Il suit maintenant les requêtes **en
cours**, pas seulement leur nombre.

### L'invité ne saute plus

Dans une course en ligne, l'hôte simule et publie l'état trente fois par seconde ; l'invité ne
simule rien, il rejoue. Entre deux instantanés il avance les voitures à leur vitesse, et cette
avance ne tombe jamais exactement juste — poser d'autorité la position reçue faisait sauter la
voiture trente fois par seconde.

Mesuré des deux côtés par `tools/e2e-duo.js`, en variation de variation de position d'une image à
l'autre : **0,173 m au 95ᵉ centile chez l'invité contre 0,003 m chez l'hôte**, cinquante-huit fois
pire. L'écart est maintenant gardé comme une dette d'affichage et remboursé en glissant, au lieu
d'être posé d'autorité. Au-delà de six mètres — un accrochage, un retour sur la piste — il n'y a
plus rien à lisser et la voiture est reposée d'un coup.

Ce qui crée cet écart n'est pas une erreur de trajectoire mais une **erreur d'horloge** : l'invité
avance les voitures du temps réellement écoulé chez lui, alors que l'instantané suivant rend compte
du temps écoulé chez l'hôte. Un instantané qui arrive dix millisecondes tard, à deux cent trente à
l'heure, ce sont soixante centimètres d'avance à reprendre — sans que personne ait mal conduit.

D'où la seule question qui compte : sur combien de temps l'étaler. La durée est mesurée, pas
choisie, deux écrans et dix voitures lancées à pleine vitesse : à 0,09 s l'invité accuse **0,18 m** de saut
d'une image à l'autre, à 0,18 s **0,07 m**, à 0,28 s **0,05 m** — pour un hôte à 0,003. Le prix est
le décalage d'affichage lui-même, qui passe de 0,57 à 0,71 m au 95ᵉ centile : deux millisecondes de
trajet de plus, et sans moyenne — l'avance tombe tantôt trop loin, tantôt trop court. L'essai relève
les deux, pour que le marché se voie au lieu de se deviner. On s'arrête à 0,28 s parce que le gain
suivant est mince et qu'une correction vraie mettrait d'autant plus longtemps à se résorber.

Et l'appui de l'invité part désormais tout de suite au lieu d'attendre le prochain envoi : jusqu'à
trente-trois millisecondes gagnées là où le joueur les sent le plus. Le reste du temps le rythme
ordinaire suffit, puisque répéter la même chose n'apprend rien à l'hôte.

`tools/e2e-duo.js` ouvre deux écrans et leur fait jouer une vraie course. Le transport réel passe
par un annuaire public WebRTC, qu'on ne peut ni exiger ni reproduire dans un essai : il lui
substitue un double sur `BroadcastChannel`, de même surface. Tout le jeu au-dessus du transport est
donc éprouvé — le salon, les étiquettes, le gel de la liste au départ, la simulation chez l'hôte et
la reprise chez l'invité.

### À qui profite un appui

Un symptôme rapporté — « quand un autre joueur appuie, toutes les voitures bougent sauf celle de
l'hôte » — décrit une commande mal aiguillée. `tools/e2e-duo.js` le vérifie directement : un seul
pilote appuie, et on relève ce que **chaque écran** voit bouger. Mesuré jusqu'à huit écrans, dans
les deux sens, seule la voiture de celui qui appuie avance — treize mètres contre zéro — et les huit
écrans s'accordent au décimètre près, chiffre pour chiffre.

Trois précautions, apprises en se trompant. La mesure attend la fin du **décompte** : pendant, la
course ne simule rien et tout le monde reste à zéro, ce qui ferait conclure à tort qu'aucune
commande ne passe. Elle attend l'**arrêt complet** entre deux essais : dans ce jeu relâcher veut
dire freiner, une voiture qui finit de ralentir parcourt encore quatre mètres, et on accuserait la
commande d'un autre pilote d'un simple reste d'élan. C'est exactement le faux positif qu'on a
d'abord obtenu.

Et elle ne relève les positions que **voitures arrêtées**, avant comme après. Les écrans sont
interrogés l'un après l'autre, et sous huit onglets chaque aller-retour coûte ses dizaines de
millisecondes : relever pendant que ça roule, c'est comparer des instants différents. À douze mètres
par seconde, le temps de faire le tour des huit écrans affichait jusqu'à **quatre mètres d'« écart
avec l'hôte »** là où les écrans étaient parfaitement d'accord. À l'arrêt, il n'y a plus d'instant à
choisir.

### La grille doit être la même sur tous les écrans

Un pilote dont le modèle est inconnu du poste recevait la voiture **du joueur local**. Le repli
dépendait donc de qui regardait : chaque écran voyait une grille différente, et celui qui regardait
voyait tous les autres rouler dans sa propre voiture. Le cas n'est pas théorique — une voiture
d'atelier que les autres n'ont pas, une présence encore incomplète au coup d'envoi — et il devient
d'autant plus probable qu'on est nombreux.

Le repli ne dépend plus que de la place sur la grille, donc il est le même partout.
`tools/e2e-duo.js` ouvre autant d'écrans qu'on veut, leur fait choisir des voitures différentes et
vérifie que **tous voient la même grille**, qu'aucune voiture ne se superpose, et que chacun a bien
sa livrée.

### L'hôte compose la grille, personne ne la recompose

Un second symptôme, à plus de deux : « les invités, lorsque l'un d'eux appuyait, voyaient toutes les
voitures avancer » — et l'hôte, lui, n'avait rien. Chaque écran composait sa propre liste de pilotes
au coup d'envoi, à partir de ce qu'il voyait à cet instant. Or un pair resté silencieux quelques
secondes est écarté : l'écran qui en rate un se retrouve avec une liste plus courte, donc un
décalage de toutes les places qui suivent.

Le décalage ne se voit pas tout de suite — la grille se construit, la course part. Mais l'instantané
de l'hôte est une suite de voitures dans **son** ordre, appliquée chez l'invité dans **le sien** :
chaque voiture reçoit l'état d'une autre, et un seul pilote qui appuie fait bouger tout l'écran. À
deux, l'ordre ne peut pas diverger, ce qui explique que rien ne se voyait à deux, et que l'hôte —
dont la liste est la référence — n'était jamais touché.

L'hôte compose donc la grille et la publie ; tout le monde l'adopte telle quelle. Publier les places
seules n'aurait pas suffi : un écran qui ne connaît pas encore un pilote garde bien sa place mais
lui donne un nom par défaut et une voiture de repli, et la grille diffère quand même. La grille
porte le **nom et le modèle** de chacun, et l'écran n'a plus rien à deviner. Elle ne part que de
l'hôte, reconnaissable à ce qu'il est le seul à publier les réglages — un invité qui la relaierait
pourrait en répandre une version périmée.

`tools/e2e-duo.js --perte` reproduit précisément le cas : au moment du coup d'envoi, un écran ne voit
pas l'un des pilotes. Avant, il partait avec une place de décalage ; maintenant les quatre écrans
affichent la même grille, nom et voiture compris, et un appui ne profite qu'à celui qui appuie.

Ce que la mesure à huit écrans apprend aussi : au-delà de quatre, c'est la machine qui lâche avant
la liaison. Le seuil de l'essai en tient compte, et de deux façons. Un plancher absolu d'un dixième
de mètre d'abord. Puis, relevé par ce que **l'irrégularité des images explique à elle seule** —
vitesse × écart de durée d'une image à l'autre : une image qui arrive en retard fait avancer la
voiture d'autant, sans qu'il y ait rien à reprocher à la liaison. À huit écrans sur la même machine,
l'invité mesure 1,16 m et ses seules images en expliquent 0,93 ; quand la machine respire, il
retombe à 0,05 m contre 0,01 de plancher.

Cette durée d'image se prend sur **l'horloge que rAF passe au jeu**, celle dont il se sert pour
avancer les voitures, et non sur `performance.now()` lu dans la fonction, qui y ajoute le retard
d'ordonnancement. La différence n'est pas académique : mesuré au mauvais endroit, le plancher
annonçait 0,30 m chez un hôte qui n'en faisait que 0,002.

Et une garde, apprise en se trompant une fois de plus : **une voiture immobile ne saute pas**. Les
essais d'appui laissent chaque voiture là où elle s'est arrêtée, et l'invité finissait le nez contre
la voiture immobile de la place précédente ; huit secondes de plein gaz contre un pare-chocs, et la
mesure annonçait un mouvement parfaitement lisse. L'essai vérifie donc que la voiture a bien roulé
avant de conclure quoi que ce soit — et il fait rouler tout le monde pendant la mesure, pour libérer
la piste.

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
une voiture de virages : son écart à la 917 K — depuis remplacée par la 935 — allait de **0,4 % à Zandvoort** et 0,6 % à Monaco, sinueux,
à **2,3 % à Monza**, rapide. Ce n'est donc pas une affirmation de présentation, c'est dans les
chiffres.

Rien ne comparait les modèles entre eux jusque-là, ce qui explique qu'une voiture bancale ait pu
être livrée sans qu'on la voie.

## Les cinq difficultés

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

### Extrême : l'IA triche, et il n'y avait pas d'autre moyen

Les trois premiers niveaux ne règlent qu'une chose : à quelle fraction de **sa** limite l'IA
conduit. Difficile est déjà à 0,99, et le plafond est à 0,98 — le levier est au bout de sa course.
Monter la marge plus haut ne donne pas un tour plus rapide, cela donne une sortie de piste, parce
qu'au-dessus de 1 on demande une courbe que la voiture ne peut pas prendre.

Le seul levier restant est la limite elle-même. `grip` multiplie l'adhérence **mécanique** des
voitures de l'IA, et d'elles seules — la voiture du joueur n'est jamais touchée. L'appui (`df`) n'y
touche pas non plus : l'appui ne servirait qu'en courbe rapide, l'adhérence sert partout.

**Deux idées fausses, corrigées par la mesure.**

La première : qu'il suffirait d'en donner. Balayé de ×1,08 à ×1,32, le résultat va à l'envers de
l'intuition — plus d'adhérence rend le peloton plus rapide **et plus propre**.

| adhérence | rythme vs difficile | sorties par course |
| --- | --- | --- |
| ×1,08 | −1,8 % | 3,8 |
| ×1,16 | −4,1 % | 3,3 |
| ×1,24 | −5,3 % | 1,5 |
| ×1,32 | −7,2 % | 0,9 |

Un peloton qui ne se trompe jamais ne laisse **aucune ouverture**. La seule façon de doubler
disparaîtrait à mesure que le niveau monte : plus dur ne doit pas vouloir dire imprenable.

La seconde : que relever le plafond de `aiThrottle` rendrait les fautes. De 0,98 à 1,16, les
sorties passent de 1,7 à 1,6 et le rythme ne bouge pas. Le plafond était **inerte**, simplement
parce que `0,93 + 0,06·talent + bruit` ne l'atteignait jamais. C'est `marginBase` qu'il fallait
déplacer.

**Ce que chaque réglage achète.** Avec `marginBase` à 1,00, remettre le plafond à 0,98 laisse le
rythme identique — 75,34 s contre 75,29 — et fait tomber les sorties de 7,0 à 3,4. Toute la vitesse
vient donc de l'adhérence ; le plafond relevé n'achète pas de la vitesse, il achète **de quoi
doubler**.

| | difficile | extrême |
| --- | --- | --- |
| rythme de course | 82,40 s | **75,29 s** (−8,6 %) |
| meilleur tour | 79,95 s | **73,39 s** |
| sorties par course | 5,8 | **7,0** |

### Extrême et cauchemar, et l'ordre qui s'était inversé

Deux niveaux plutôt qu'un : extrême avec une adhérence moyennement gonflée, cauchemar avec
davantage. La première grille mesurée avait un défaut que seule la mesure pouvait montrer —
**extrême faisait plus de sorties que cauchemar**, 11,4 contre 8,8. Le niveau intermédiaire était
le plus brouillon des deux, ce qui n'a aucun sens. Moins d'adhérence avec la même audace, c'est
simplement en demander trop plus souvent. La marge d'extrême est redescendue de 1,00 à 0,98, et
l'échelle est redevenue monotone dans les deux sens.

| niveau | rythme de course | sorties par course | adhérence |
| --- | --- | --- | --- |
| facile | 92,97 s | 0,2 | — |
| moyen | 86,84 s | 1,9 | — |
| difficile | 82,22 s | 5,8 | — |
| extrême | 77,25 s | 7,5 | ×1,14 |
| cauchemar | 73,08 s | 8,8 | ×1,30 |

Chaque palier vaut cinq à six pour cent, soit l'écart qui séparait déjà moyen de difficile.

## Usure et dommages

En option, et **en course seulement**. Un record de contre-la-montre signé sur des pneus à moitié
morts ne se compare à rien, et la table des records n'a pas de colonne pour dire dans quel état il
a été signé : mieux vaut que l'option n'existe pas là que d'avoir à l'expliquer.

### Ce qui use un pneu n'est pas ce qu'on croit

La première version faisait dépendre l'usure de la seule **glisse**, au carré, ce qui paraissait
évident. Mesuré sur une course : `slide` vaut 0,007 à 0,021 de **moyenne** selon le niveau, et sa
**médiane est zéro** — une voiture bien conduite ne glisse presque jamais. Le terme était cent à
trois cents fois trop petit pour peser, et l'usure ne dépendait donc pas du tout du pilotage.
L'outil l'a dit aussitôt : demi-usure au tour 4 ou 5, identique du niveau facile au cauchemar.

Ce qui use un pneu est le **travail de frottement**, pas le spectacle. `usage` — la demande
d'adhérence latérale rapportée à ce que les pneus peuvent donner — vaut 0,455 en facile et 0,568 en
extrême. C'est elle qui sépare un pilote propre d'un pilote qui attaque, elle est déjà calculée à
chaque pas, et elle entre au carré parce que le frottement croît comme le carré de la charge. La
glisse reste, mais comme **surcoût** : quand elle arrive, elle coûte très cher.

### Le minutage, et la mesure qui comparait la mauvaise chose

`tools/usure.js` comparait d'abord les niveaux de difficulté. C'était une erreur : un niveau change
aussi la durée du tour, et « facile » usait plus **par tour** que « difficile » simplement parce que
ses tours durent treize pour cent de plus. La mesure mélangeait le rythme d'usure et le temps passé
en piste.

Ce qui compte est le choix qu'un joueur a devant lui. On pilote donc la **même voiture sur le même
circuit** à deux marges — 0,78, bien en dessous de la limite, et 0,98, qui vit dessus :

| style | demande d'adhérence | tour de référence | demi-usure | gomme au 10ᵉ tour |
| --- | --- | --- | --- | --- |
| ménagé | 0,435 | 75,3 s | tour 9 | 43 % |
| attaqué | 0,689 | 67,8 s | tour 3 | 0 % |

Sept secondes et demie au tour contre trois fois moins de gomme : c'est l'arbitrage de Circuit
Superstars, et c'est ce qui rend un arrêt au stand intéressant plutôt qu'obligatoire. Un train usé
coûte **+3,5 %** au tour, sans quoi la jauge serait une décoration.

### Les dommages ne touchent pas l'adhérence

Ils enlèvent de la vitesse de pointe et de la reprise, jamais du grip. C'est volontaire : un dommage
qui enlèverait de l'adhérence punirait deux fois et rendrait une course irrattrapable après un seul
accrochage. Une voiture cabossée traîne, elle ne devient pas dangereuse.

Deux réglages ont dû être corrigés, tous deux sur des mesures absurdes.

**Un frottement n'est pas un choc.** Sans seuil, un peloton lent qui se tasse en épingle se
détruisait tout seul : 49 % de tôle au niveau facile contre 10 % en difficile — l'inverse de ce
qu'on attend, et uniquement parce que les voitures lentes se touchent sans arrêt. Seul ce qui
dépasse 3,5 m/s d'écart compte désormais, et la tôle en facile est tombée à 5 %.

**Une sortie de route n'est pas un accident.** À 0,004 de dommage par m/s, quitter la piste à
60 m/s coûtait 24 % de la voiture, et quatre excursions la détruisaient : un pilote qui attaque
finissait à 95 % de tôle, donc avec vingt pour cent de vitesse en moins, pour des fautes dont
aucune n'était un choc. Un passage dans l'herbe fait déjà perdre du temps ; c'est la punition.

### Les jauges

Deux barres dans le panneau du haut à gauche, qui grandit quand l'option est active plutôt que de
poser une bande ailleurs — une bande de plus serait entrée en conflit avec le classement sur un
écran d'ordinateur et avec la carte sur un téléphone, deux cas à régler au lieu d'un.

Elles ont fait apparaître deux chevauchements que personne n'aurait vus sans activer l'option : le
nom du pilote, calé sur le bas du panneau, descendait sur la jauge de tôle ; et le temps au tour,
que j'avais déjà déplacé une fois pour dégager le bouton pause, tombait dessus à son tour. Il prend
maintenant le plus bas de tout ce qui occupe le haut, et suivra tout seul le prochain élément
qu'on y ajoutera.

## Les sorties de piste : ce qui en est une, ce qu'elle annule, ce qu'elle coûte

### Le vibreur n'était pas de la piste

La piste s'arrêtait à la ligne blanche. Le vibreur était peint dans `js/render.js` avec ses propres
constantes, et la physique ne savait pas qu'il existait : poser deux roues sur la peinture valait
gravier — 0,42 d'adhérence — plus des dégâts et un passage au compteur de sorties. C'est faux au sens
le plus simple, puisqu'un vibreur est fait pour qu'on roule dessus, et ça devenait intenable le jour
où une sortie annule le tour.

La surface a donc trois zones au lieu de deux : la route, le vibreur, l'herbe. **Les mêmes constantes
servent au dessin et à la règle** (`KERB_IN`, `KERB_LARGE` dans `js/track.js`), parce que deux jeux de
nombres pour une même bande finissent toujours par se contredire, et que l'écart serait invisible — un
joueur verrait ses roues sur la peinture et son tour annulé sans savoir pourquoi.

Le vibreur ne rend pas tout : **0,88 d'adhérence**. À 1 ce seraient deux mètres de route gratuits dans
chaque virage, toutes les vitesses de passage monteraient et la mesure des planchers ne décrirait plus
le jeu ; à 0,42 ce serait du gravier, c'est-à-dire le défaut qu'on corrige. On peut s'appuyer dessus,
pas s'y installer.

**La bande s'affine en pente douce** sur neuf mètres à chaque extrémité du virage — environ deux
longueurs de voiture — suivant une courbe en S et non une droite, pour qu'il n'y ait d'angle nulle
part, pas même à la jonction avec la pleine largeur. Un vibreur ne s'arrête pas net : il s'amincit,
et c'est ce qui permet de le prendre jusqu'au bout, la roue le quittant progressivement au lieu de
tomber d'une marche.

**Et le dessin suit cet affinement, station par station.** C'était le vrai défaut : la peinture était
à largeur constante et coupée à l'équerre, tandis que la règle, elle, biseautait déjà. Aux extrémités,
la peinture promettait donc du vibreur là où rouler valait une sortie de piste — on ne pouvait pas le
suivre jusqu'à sa fin sans se voir compter une faute à l'endroit précis où la couleur s'arrêtait.
Les deux lisent maintenant le même tableau (`track.kerb`), et `tools/sortie.js` le vérifie là où ça
compte : à mi-affinement, rouler au bord extérieur de ce qui est peint ne doit jamais salir un tour.

### Un tour sali reste affiché, barré

Une sortie annule le tour en cours : il garde son chrono mais ne peut pas devenir le meilleur tour,
donc ni record local ni record mondial. Le retirer de la liste aurait été plus simple et beaucoup moins
clair — le joueur aurait vu ses tours sauter sans savoir lesquels, ni pourquoi son meilleur tour n'est
pas le plus rapide qu'il a vu passer au tableau de bord. Un chiffre barré répond aux deux questions.

Et la pastille du tour courant **change de mot à l'instant de la faute** : une sanction qu'on ne voit
pas tomber est une sanction qu'on ne peut pas éviter.

**Deux meilleurs tours cohabitent, et les confondre casse l'un ou l'autre.** `bestLap` est le meilleur
tour propre : c'est lui qui fait un record. `bestLapBrut` est le plus rapide quoi qu'il soit arrivé, et
c'est lui que `tools/plancher.js` doit lire — un plancher est le temps le plus bas que la physique
autorise, coupes comprises, sinon il refuserait des tours réels. L'IA en cauchemar sort au moins une
fois par tour : sur `bestLap` seul, elle ne rendait plus aucun temps et les 108 planchers retombaient
tous sur la borne physique, deux fois trop basse pour refuser quoi que ce soit.

### La pénalité n'est pas un nombre choisi, c'est le temps volé

Bruno voulait un malus en secondes au classement, « ça évite la triche en coupant les chicanes ».
`tools/coupe.js` dit pourquoi aucun nombre fixe ne marche. Il mesure, pour chaque paire de points de la
ligne de course, la corde contre le trajet réel — et il mesure aussi, au lieu de la supposer, la
vitesse à laquelle on traverse l'herbe : **19,4 m/s, soit 70 km/h**, contre 270 sur la piste.

| | gain maximum d'une coupe |
|---|---|
| chicane (60 m de piste) | 1,4 s |
| 150 m de piste | 3,0 s |
| traversée d'infield (400 m) | **8,9 s** à Silverstone |

Une pénalité fixe qui couvre le dernier cas condamne une course pour un appui malheureux ; une qui
ménage le premier laisse le dernier impuni.

**On mesure donc ce que la sortie a réellement rapporté, et on le reprend.** Pendant qu'une voiture est
hors piste, on compte les mètres de circuit qu'elle avale et le temps qu'elle y met ; le profil de
vitesse de la ligne de course dit ce que ces mètres coûtent sur la piste. La différence, quand elle est
positive, est du temps volé, et c'est exactement la pénalité. Une coupe ne rapporte donc rien, quelle
que soit sa taille, et un tête-à-queue qui a déjà coûté huit secondes n'est pas puni deux fois.

S'y ajoute **une seconde fixe par sortie**, pour qu'une sortie ne soit jamais tout à fait gratuite :
sans elle, une coupe parfaitement neutre serait un essai sans risque qu'on retente à chaque tour.

Mesuré sur une course de trois tours à dix voitures : **aucune sortie aux deux premières difficultés**,
douze à « difficile », vingt-cinq en « cauchemar » — et **zéro seconde reprise** dans tous les cas. Une
sortie d'IA perd du temps, elle n'en gagne pas. La pénalité ne mord que sur une coupe délibérée.

### Un nom repris en silence, et deux écrans qui ne disaient pas la même chose

Deux défauts trouvés en mesurant, dont aucun ne se serait vu en jouant.

`this.offT` existait déjà dans `js/car.js` : il mesure depuis combien de temps le pied est levé et
commande le freinage. J'ai appelé mon chronomètre de sortie du même nom. Les deux ont cohabité le temps
d'un essai : la voiture remettait le compteur à zéro à chaque coup de gaz et l'incrémentait une seconde
fois à chaque pas pied levé, si bien que la pénalité se calculait sur un temps faux — doublé dans un
cas, effacé dans l'autre. C'est `tools/sortie.js` qui l'a attrapé, en lisant 2,97 s là où 1,48 s
s'étaient écoulées.

Et l'invité ne construisait aucun classement. Il ne simule pas, donc `Race._finish` ne tourne jamais
chez lui : son `results` restait nul et l'écran des résultats le lit sans le vérifier. **Le défaut est
ancien et n'a rien à voir avec les pénalités** ; il suffisait d'une course en ligne menée jusqu'au
drapeau pour le voir, et aucun essai ne la menait. Il construit maintenant son classement à partir de
l'instantané reçu, sans rien rejouer : les sorties, le temps repris et l'heure d'arrivée voyagent dans
le bloc lent du codec, donc c'est le même calcul sur les mêmes nombres.

Ce bloc lent est désormais **forcé dès que la course n'est plus en train de rouler**. Il ne part qu'une
image sur quinze, ce qui est juste tant que ses champs ne changent qu'au passage de la ligne — mais
l'hôte envoie UNE image d'état « terminé » puis se tait. Quatorze chances sur quinze que celle-là ne
porte pas le bloc : mesuré, zéro seconde de pénalité chez l'invité là où l'hôte en comptait 3,5. Le
paquet passe de 214 à 219 octets, et la voie montante à huit joueurs de 0,54 à 0,58 Mbit/s.

### Ce que les bancs vérifient

`tools/sortie.js` : le vibreur n'est pas une sortie, au-delà si ; dans une ligne droite il n'y a pas de
vibreur peint, donc pas de tolérance ; un tour sali plus rapide ne devient pas le meilleur ; une coupe
de 150 m avalée deux fois trop vite rend exactement ce qu'elle a volé ; une sortie qui ne fait pas
avancer ne rend rien. Et deux contrôles qui existent parce que les cinq premiers ne suffisent pas : une
course entière d'IA, où les sorties sont de vraies sorties, et la **référence confrontée à une mesure
indépendante** — le tour théorique sur la ligne contre le meilleur tour réel de l'IA en cauchemar,
68 s contre 76. Sans ce dernier, un profil de vitesse deux fois trop lent aurait fait passer tous les
autres en distribuant des pénalités imméritées.

## Le plafond de marge de l'IA

`margin` multiplie la vitesse de passage que l'adhérence autorise, donc **tout ce qui dépasse 1 est
un virage que la voiture ne peut pas prendre**. Le pilote à qui on le donne ne va pas plus vite :
il sort, perd dix secondes et rend la place.

Or la marge est une somme — la base de la difficulté, l'écart de talent du pilote, un bruit, et le
terme d'élastique. En difficile, le meilleur pilote recevait 0,90 + 0,09 + 0,015 + 0,03 = **1,035**.
C'est la **somme** qui est désormais plafonnée, et non chaque terme : plafonner les parties
séparément laisse passer exactement le cas qui pose problème. Le plafond vaut 0,98 pour les trois
premiers niveaux, et se règle par la table — le niveau extrême est le seul à le relever, pour que
sa marge de 1,00 puisse passer.

`node tools/diff.js [circuit|all] [catégorie]` traduit les coefficients de `DIFFICULTY` en la seule
chose qu'un joueur ressent : la vitesse à laquelle le peloton tourne. Il donne le **rythme de
course** (temps total ÷ tours) et non le meilleur tour, parce que le rythme porte les fautes, le
trafic et les passages dans le gravier — un peloton qui signe des tours rapides et se plante deux
fois par course n'est pas un peloton difficile. `-sans-elastique` retire le terme de rubber-banding
avant de lancer, ce qui permet de distinguer une difficulté mal choisie d'une difficulté défaite en
chemin. `-table='<json>'` essaie une table candidate sans l'écrire dans le jeu.

## Le nom de pilote, et le tableau des records

### Un nom avant tout le reste

Plus de menu sans nom, lettres et chiffres uniquement. Le contrôle est posé sur `menu()` et non
sur l'écran-titre : sur le titre, il aurait laissé entrer par toutes les autres portes — un lien
`?track=`, un retour de course, un rechargement en pleine partie. Le menu est l'endroit par lequel
tout le monde repasse, donc le seul où la question se pose une fois et une seule.

Deux fonctions pour une règle, parce qu'il y a deux moments. `nomPropre` nettoie la frappe au fur
et à mesure : ce qui n'est ni lettre ni chiffre n'entre jamais dans le champ, donc il ne peut pas
contenir de valeur refusable et il n'y a aucun message d'erreur à écrire — le bouton éteint dit
tout. `nomValide` juge le résultat, ce qui reste nécessaire : un champ vide est propre et ne fait
pourtant pas un nom.

Pourquoi ce jeu de caractères : le nom part vers un tableau partagé. Accents, espaces de tête,
caractères invisibles et émojis y créent des noms qui se ressemblent à l'œil sans être égaux, et
des lignes qu'on ne sait plus attribuer. La contrainte est écrite des deux côtés, dans le jeu et
dans la base — deux fois, parce qu'une règle que seul le client applique n'est pas une règle.

**Le curseur.** Nettoyer un champ en réécrivant `value` renvoie le curseur en fin de chaîne :
corriger le milieu d'un nom déjà tapé devient impossible, chaque lettre l'expédie à la fin. On ne
décompte que ce qui a été retiré AVANT le curseur, sinon un caractère refusé plus loin dans le
champ décalerait ce qu'on écrit. Ça ne se voit sur aucune capture et sans ça le champ est
inutilisable ; `tools/e2e-nom.js` tape une lettre au milieu et vérifie où le curseur atterrit.

### Personne n'écrit depuis un navigateur

La clé publiable vit dans le code de la page : tout le monde l'a. Une table ouverte en écriture se
remplirait de tours en une milliseconde le jour où quelqu'un ouvrirait la console. Le RLS refuse
donc toute écriture sur `records`, même à un compte connecté, et une fonction serveur — seule à
porter la clé de service — est le seul chemin. C'est ce qui rend la validation incontournable
plutôt que polie.

Elle vérifie quatre choses, du moins cher au plus cher : **qui** (le jeton, présenté à Supabase
plutôt que décodé par nous), **la forme**, **le plancher**, **la cadence**. Le pseudo est pris DANS
LA BASE et jamais dans la requête : sinon n'importe qui signerait n'importe quel nom, et le tableau
attribuerait des records au hasard.

La lecture, elle, est ouverte à tous, comptes et anonymes : un tableau qu'il faut mériter de voir
ne sert à rien, c'est ce qu'on regarde avant de jouer.

### Le plancher, mesuré et non deviné

`tools/plancher.js` produit `supabase/planchers.sql`. Un plancher inventé est soit trop haut — et
il refuse les tours d'un très bon joueur, ce qui est pire que de laisser passer un tricheur — soit
trop bas, et il n'arrête rien. Aucun des deux ne se voit avant que quelqu'un s'en plaigne.

Deux bornes, on garde la plus haute. La **borne physique** (longueur / vitesse de pointe) est
incontestable et ne peut jamais refuser un tour réel, mais elle est large : sur un tracé sinueux
elle vaut la moitié d'un vrai tour. La **borne mesurée** est le meilleur tour de l'IA en
« cauchemar » — qui triche déjà de 30 % d'adhérence — moins 15 %. Sur les 108 couples, c'est
toujours la mesurée qui l'emporte : la borne physique ne sert que de filet.

**Le banc a d'abord regardé douze circuits sans qu'une voiture démarre.** `playerAI` ne fait
choisir à la machine que la LIGNE : la voiture du joueur prend toujours son accélérateur de
l'entrée. Les 108 planchers sont donc tombés sur la borne physique — et le banc les a écrits comme
si de rien n'était. Un fichier de planchers tous physiques a l'air d'un fichier de planchers, il
s'applique sans broncher, et il n'arrête aucun tricheur. Le banc calcule maintenant `aiThrottle`
lui-même, comme les autres bancs du dossier, et **refuse d'écrire** si un seul couple n'a pas bouclé.

### Une consigne sans porte

Les messages de refus disaient « reconnecte-toi » et ne donnaient rien à toucher. Le bouton
d'accueil ne s'affichait que pour qui n'est PAS connecté : un pseudo manquant côté serveur — où la
session est bien vivante — laissait le joueur devant une consigne et aucune porte. Les refus dont
le remède est une reconnexion portent maintenant le bouton ; les autres ne l'ont pas, parce qu'un
bouton qui ne répond pas au problème est pire que pas de bouton.

Le bouton SORT avant d'entrer. Une session périmée encore en mémoire aurait fait revenir le joueur
sur la même session morte, et le geste n'aurait servi qu'à l'y renvoyer.

Le compte se gère aussi depuis les réglages, dans les deux sens. Sans cette ligne, se déconnecter
était impossible et changer de compte demandait de vider le navigateur.

### Changer de nom, et ce que ça déplace

Trois choses portent un nom, et elles ne le portent pas de la même façon.

**Les records locaux ne le portent pas du tout.** Ils sont rangés sous `circuit|catégorie|voiture`,
jamais sous le pseudo : un renommage ne leur fait rien, et c'est voulu — ce sont les temps de cet
appareil, pas ceux d'une étiquette.

**Le compte mondial est le compte Google, pas le nom.** La table `pilotes` a pour clé `auth.uid()`,
donc renommer déplace l'étiquette sans toucher l'identité : les records restent attribués, et le
prochain temps envoyé inscrit le nouveau nom. Un index unique sur `lower(pseudo)` garde les noms
distincts — un nom déjà pris par un autre compte renvoie `pseudo_pris`, et ce refus arrive au
moment de l'envoi d'un temps, pas au moment du renommage.

**Un renommage suit le joueur sur ses anciens records.** Le nom est recopié dans `records` à la pose
du temps, ce qui permet d'afficher le tableau mondial d'une seule lecture, sans jointure — mais une
copie se périme. Le joueur voyait son ancien pseudo sur les records déjà en base et le nouveau sur
les suivants : le même pilote sous deux noms, ce qui est pire qu'un nom dépassé, parce que ça
ressemble à deux personnes. La fonction serveur remet donc les siennes à jour, les siennes seulement
(`auteur` est l'identité vérifiée), et seulement lorsqu'elles diffèrent — donc jamais dans le cas
courant. Une erreur là n'arrête pas l'envoi : le temps compte plus que l'étiquette.

**Le champ des réglages n'écrit plus à la frappe.** Il enregistrait à chaque lettre, et le
garde-fou vivait sur `change`, qui remet le champ à la valeur sauvegardée quand la saisie ne vaut
rien — sauf que cette valeur venait d'être écrasée. Effacer son nom lettre par lettre enregistrait
le dernier morceau encore valide : « Bruno42 » devenait « Br », sans que rien ne le signale.
Effacer jusqu'au bout enregistrait le vide, et le retour au menu redemandait son nom au joueur comme
s'il venait d'arriver. Le nom s'écrit maintenant quand on QUITTE le champ, et seulement s'il en est
un ; on ne perd rien, puisque partir d'un champ c'est le quitter.

Le test ne voyait pas ce défaut parce qu'il n'envoyait qu'un `change` : un joueur ne pose pas un
champ vide d'un coup, il efface lettre par lettre, et chaque lettre envoie un `input`.
`tools/e2e-nom.js` efface donc à la touche, et vérifie aussi qu'un vrai renommage passe toujours.

### Ce qui se casse, et ce qui ne doit pas casser

`tools/e2e-mondial.js` sert les réponses lui-même. Un essai branché sur le vrai Supabase mesurerait
Supabase : il tomberait à la première coupure, dépendrait de ce que contient la base ce jour-là, et
ne saurait pas fabriquer les cas qui comptent. Il vérifie que l'écran se peint **avant** la réponse
— attendre le réseau rendrait un menu hors-ligne inutilisable — que la colonne se remplit en face
de la bonne voiture, qu'une panne laisse les temps locaux et des tirets sans rien jeter, et qu'on ne
repart pas en boucle : `records()` est rappelé à chaque rendu et l'arrivée des temps déclenche un
rendu, donc sans garde-fou la réponse relance la requête, indéfiniment.

## Le multijoueur, mesuré

### Rien ne mesurait le réseau

`tools/e2e-duo.js` remplace WebRTC par un canal de diffusion local et éprouve tout ce qui vit
AU-DESSUS du transport — le salon, les places, le gel de la grille, la reprise chez l'invité. Il ne
voit ni latence, ni gigue, ni perte, ni débit. On améliorait donc à l'aveugle le seul endroit du
jeu dont personne ne connaissait les chiffres.

`tools/net-banc.js` les donne. Le transport reste un double — on ne peut pas exiger d'un essai
qu'il trouve un annuaire public et deux NAT à traverser — mais les DÉFAUTS sont réels et imposés :
chaque message part avec un retard tiré au sort autour d'une moyenne, et une fraction est jetée.
C'est ce que fait un réseau mobile, et c'est ce qu'il fallait pouvoir faire varier.

Quatre chiffres en sortent, et chacun répond à une question qu'on se posait sans y répondre : la
**montée de l'hôte** (tient-elle dans une voie montante 4G ?), le **retard du pouce** entre l'appui
et le mouvement de sa propre voiture, la **saccade** chez l'invité qui ne simule rien, et le plus
long **silence** qu'il subit.

**Le double doit facturer comme WebRTC.** Un canal de diffusion poste une fois pour tout le monde,
là où le vrai transport boucle sur ses connexions et envoie à chacune. La première version comptait
un envoi par message : elle annonçait 0,24 Mbit/s là où le réseau en voit sept fois plus. Un banc
qui se trompe d'un facteur sept sur la seule grandeur pour laquelle il existe est pire qu'une
absence de banc, parce qu'on le croit.

### Le relais entre invités ne sert à rien en course

L'hôte renvoie la présence de chacun à tous les autres, pour que le salon soit complet partout. Une
fois la course partie, ça ne sert plus : l'hôte est seul à simuler, donc aucun invité n'a que faire
de l'accélérateur d'un autre invité. Le relais coûte pourtant en N² quand les instantanés ne
coûtent qu'en N, si bien qu'il finit par dépasser ce qu'il accompagne.

Il s'éteint donc au coup d'envoi et se rallume au drapeau. `--relais=1` rejoue l'ancien
comportement : un gain qu'on ne peut pas remettre à zéro n'est pas un gain mesuré, c'est un gain
raconté. Mesuré à 60 ms d'aller, ±20 de gigue et 2 % de perte :

| joueurs | relais allumé | relais éteint | écart |
|---|---|---|---|
| 2 | 0,16 Mbit/s | 0,16 Mbit/s | — |
| 4 | 0,71 | 0,55 | −23 % |
| 6 | 1,53 | 0,99 | −35 % |
| 8 | **2,73** | **1,56** | **−43 %** |

### Trois pièges du banc lui-même

**Le dessin fausse tout.** Huit onglets qui peignent chacun un canevas à soixante images par
seconde dans le même conteneur, ce n'est plus un banc réseau mais un banc de processeur graphique :
la première série annonçait 378 ms de retard au pouce et 8,8 m de saccade à huit joueurs, ce qui
n'avait aucun rapport avec le réseau. Le pinceau s'arrête pendant la mesure ; la simulation, la
couche réseau et l'extrapolation tournent toujours.

**Chromium bride les onglets en arrière-plan** : `requestAnimationFrame` y tombe à presque zéro, et
avec deux écrans un seul peut être devant. Trois drapeaux de lancement l'éteignent, dans le banc
comme dans `e2e-duo.js`.

**Un premier argument qui n'est pas un nombre.** Les essais du dossier prennent un dossier de
sortie ; `e2e-duo.js` prenait un nombre de secondes. Lancé dans une boucle qui passe le même
argument à tous, il recevait `NaN`, donc une boucle d'échantillonnage dont la condition d'arrêt
était vraie dès la première image : zéro mesure, et un échec qui ressemblait à une régression du
jeu. Il tombe désormais sur sa durée par défaut, et une série vide est un ÉCHEC nommé plutôt
qu'une exception obscure six lignes plus bas.

**`tools/e2e-net.js` ne passait plus depuis le nom obligatoire** : il posait le nom APRÈS
l'écran-titre, donc trop tard — le jeu avait déjà affiché l'écran du nom à la place du menu, et
l'essai attendait un bandeau qui ne viendrait jamais. Il n'était dans aucune de mes séries, ce qui
est exactement pourquoi il faut les lancer toutes.

### L'instantané en octets, et ce qui ne bouge plus

581 octets de JSON par image, trente fois par seconde, vers chacun des sept invités. `js/paquet.js`
en fait 214 — **2,71 fois moins**, mesuré sur 11 784 instantanés de vraies courses.

**La forme de l'instantané n'a pas bougé.** `Race.snapshot()` rend toujours son tableau de nombres
et `Race.applySnapshot()` le relit tel quel ; le codec ne fait que traduire. Un encodage glissé dans
la simulation aurait mêlé deux sujets — ce qu'on transmet et comment — et toute erreur de
quantification serait devenue une erreur de physique, invisible et impossible à isoler. Ici elle
reste une erreur de transport, qu'un aller-retour suffit à mesurer.

**Trois mesures ont dicté le format, aucune n'a été supposée.** Les plages réelles sur 8640
instantanés et douze circuits, qui ont montré que quatre champs débordaient l'entier court en ×100.
L'étendue du plus grand circuit, 1531 px au Mans, qui fixe l'échelle de x et y. Et la plus grande
sortie de route, 21,2 px sur douze courses complètes, qui dit que la marge de 1282 px la couvre
soixante fois.

**Une économie tentante, mesurée puis rejetée.** `track.pos(s, lat)` sait retrouver x et y, ce qui
aurait économisé quatre octets par voiture. Sur 72 992 relevés d'une voiture sur la piste, l'écart
moyen vaut 0,011 px — mais le pire monte à 8,9 px. Une voiture posée neuf pixels à côté est une
voiture dans le décor.

**Ce qui ne change plus ne repart plus à chaque image.** La présence transportait trente fois par
seconde la grille complète et les réglages de la table, figés depuis le coup d'envoi — plus
d'octets que l'instantané lui-même. Ils repartent une fois par seconde : la réparation automatique
survit, vingt-neuf envois sur trente disparaissent.

Deux pièges, tous deux attrapés par les essais. `presence()` FUSIONNE ce qu'on lui donne puis envoie
l'ensemble : omettre un champ le laisse partir quand même. Il faut le mettre à `null` pour qu'il
disparaisse — une première version se contentait d'envoyer moins et ne changeait rien sur le fil.
Et les deux premières secondes de course partent complètes sans exception : c'est la fenêtre où
chaque invité attend la grille de l'hôte pour geler la sienne, et l'alléger dès la première image
faisait geler trois grilles différentes à quatre écrans.

### « Liaison perdue » alors que personne n'avait encore rien dit

Au départ d'une course en ligne, l'invité affichait « liaison perdue avec l'hôte », puis tout se
mettait à marcher. La liaison allait très bien. L'hôte construisait son circuit, décodait ses
vignettes de voiture et téléchargeait ses prises de moteur — plusieurs secondes pendant lesquelles
il n'a rien à envoyer — et le compteur de silence de l'invité, parti au coup d'envoi, franchissait
ses deux secondes avant le premier instantané.

Un message faux coûte plus cher qu'une attente : il envoie chercher un problème de réseau là où il
n'y en a pas, et il décrédibilise le vrai message le jour où la liaison tombe pour de bon.

**Deux corrections, et la seconde seule n'aurait pas suffi.** Le silence ne se compte plus avant le
PREMIER instantané : tant que rien n'est jamais arrivé, il n'y a pas de perte à mesurer. Et le
décompte ATTEND que chaque écran ait annoncé qu'il a fini de charger — sinon la course part sans
celui qui travaille encore, et il la rejoint en retard.

Ce qu'on attend : les vignettes de voiture, qui se décodent image par image et font apparaître une
voiture au milieu de la ligne droite quand elles arrivent tard ; et les prises de moteur, plusieurs
mégaoctets, mais seulement si le son est allumé — retenir la table pour un téléchargement dont on
ne fera rien punirait un réglage que le joueur a justement coupé.

**La barrière a une sortie**, parce qu'une barrière sans échappatoire est un blocage : passé douze
secondes, on part sans celui qui n'a pas répondu. Et l'attente se compte sur la GRILLE gelée au coup
d'envoi, pas sur les présences du moment : un écran momentanément silencieux disparaîtrait de la
liste et serait compté comme prêt, ce qui reviendrait à lever la barrière pour celui-là même
qu'elle protège.

Les feux arrêtés sans un mot sont indiscernables d'un jeu bloqué : l'écran annonce donc
« Chargement… 2 / 4 prêts » à leur place.

`tools/e2e-charge.js` reproduit le défaut plutôt que de vérifier le correctif : il retarde
délibérément le premier instantané de l'hôte de cinq secondes — deux fois et demie le seuil — et
regarde ce que l'invité annonce. Il fabrique aussi un retardataire qui n'existe nulle part, sans
quoi le contrôle de l'échappatoire partirait de zéro et ne prouverait rien.

### La même barrière en solo, et l'invité qui n'en savait rien

La barrière était née du multijoueur, donc posée derrière un test `online`. En solo la course
partait pendant que les vignettes se décodaient et que les mégaoctets de prises arrivaient : on
démarrait au silence, le son s'allumait au deuxième virage. Le défaut était le même, seul le témoin
manquait — personne ne crie « liaison perdue » à un joueur seul.

Elle tient donc le décompte dans les trois cas, avec la même échappatoire de douze secondes. Et
l'invité annonce désormais SON chargement : il ne tient pas le décompte, celui de l'hôte lui arrive
tout fait, et quand l'hôte retenait, l'invité voyait des feux arrêtés sans un mot — le silence
d'avant, déplacé d'un écran.

**« Pas encore » et « jamais » devaient cesser de se ressembler.** Deux attentes pouvaient ne jamais
finir : une illustration de voiture dont le fichier manque laissait `topReady` faux pour de bon, et
un téléchargement de prises qui échoue laissait `pret` faux pour de bon. Tant que ces réponses ne
servaient qu'à choisir un dessin de repli, personne ne l'avait vu ; dès qu'un décompte s'y adosse,
les deux coûtent douze secondes d'attente à chaque course, pour un fichier qui n'arrivera pas. Une
image qui échoue se marque donc comme telle, et `audio.pretAJouer()` répond « rien à attendre »
dans les trois cas qui s'y ressemblent : son coupé, moteur jamais démarré faute de geste,
téléchargement perdu.

`tools/e2e-charge-solo.js` retient d'abord une vignette, puis **le son seul** — sans ce second
contrôle le premier ne prouve qu'une moitié, les prises ayant tout le temps d'arriver pendant que la
vignette retient la course. Il lit ensuite les textes réellement peints sur la toile, parce qu'une
barrière muette est le défaut d'avant sous un autre nom, et il vérifie qu'à l'instant où la course
passe en « racing » les prises sont chargées — c'est la demande, et c'est la seule mesure qui la
vérifie.

### Deux dessins sous une voiture, et ce qu'ils coûtent vraiment

Sous la voiture, à l'écran, on en voit une seconde : plus sombre, décalée. C'est son ombre, et la
question est légitime — deux dessins au lieu d'un, est-ce que ça pèse ?

`tools/calques.js` chronomètre `_drawCar` lui-même et compte les `drawImage` en interceptant le
contexte — une moyenne d'images par seconde diluerait dix voitures dans tout le reste de la scène.
Sur la 935, processeur bridé quatre fois pour ressembler à un téléphone :

| | dessins / voiture | ms / voiture |
|---|---|---|
| avec l'ombre | 2 | 0,043 |
| sans l'ombre | 1 | 0,044 |
| *(l'empilement isométrique, depuis retiré)* | *20* | *0,359* |

**L'ombre ne coûte rien de mesurable** : l'écart est de −0,001 ms, sous le bruit de la mesure. Sa
silhouette est gravée une fois par modèle et gardée ; la redessiner, c'est un quadrilatère texturé
de plus. Et elle n'a rien à voir avec la latence de commande, qui se joue dans la chaîne
appui → physique → affichage, pas dans le nombre de quadrilatères.

La troisième ligne est celle qui a décidé du sort de la vue inclinée : dix fois le dessin à plat,
soit 3,6 ms par image à dix voitures sur une machine bridée. Elle est gardée ici comme mesure, pas
comme état des lieux — ce chemin n'existe plus.

**Le banc a d'abord menti, et de la pire façon.** Sa première passe portait seule le prix du
démarrage — la gomme qui s'étale, les silhouettes qu'on grave, les planches qui finissent
d'arriver — et sortait 65 ms d'image médiane contre 30 pour la suivante. Le coût par voiture, lui,
ne variait que de 0,01 ms : c'était l'ordre des passes qu'on mesurait. Une passe de chauffe est donc
jetée avant les quatre autres. Sans elle, le banc attribuait trente-cinq millisecondes à l'ombre
qu'on examinait.

### La voie montante de l'hôte, d'un bout à l'autre

| | 2 | 4 | 6 | 8 joueurs |
|---|---|---|---|---|
| au départ | 0,16 | 0,71 | 1,53 | **2,73 Mbit/s** |
| relais coupé en course | 0,16 | 0,55 | 0,99 | 1,56 |
| instantané en octets | 0,10 | 0,35 | 0,70 | 1,14 |
| champs figés à 1 Hz | 0,06 | 0,20 | 0,37 | **0,54 Mbit/s** |

Cinq fois moins à huit joueurs, et confortablement sous ce qu'une 4G faible accepte en montée.

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
NODE_PATH=$(npm root -g) node tools/e2e-lignes.js [dossier]                       # éditeur de lignes : ce qu'on voit est ce qui se joue
node tools/difficulte.js [catégorie]                                             # ce qu'une voiture coûte à piloter, en pneus
NODE_PATH=$(npm root -g) node tools/e2e-workshop.js <dossier>                      # import de sprites → course
node tools/step.js <circuit> <catégorie> [marge] [-v]                             # suivi de ligne d'une voiture seule
node tools/sweep.js '[{},{"yawK":4}]'                                             # balayage des réglages physiques
node tools/jump.js <circuit> <catégorie> <marge>                                  # continuité du déplacement
node tools/cotes.js [circuit|all]                                                 # les lignes sont-elles du bon côté, et écartées ?
node tools/curseur.js [circuit|all]                                              # le curseur envoie-t-il la voiture du côté annoncé ?
node tools/line.js [circuit|all] [catégorie] [-v]                                # ce que vaut une trajectoire
node tools/corner.js [circuit|all] [catégorie] [marge] [-v]                      # vitesse réelle contre vitesse théorique, virage par virage
node tools/diff.js [circuit|all] [catégorie] [-sans-elastique] [-table=…]         # ce que valent vraiment les trois difficultés
node tools/models.js [catégorie] [marge]                                          # chaque voiture : tour idéal, tour réel, prix du pilotage
NODE_PATH=$(npm root -g) node tools/e2e-moteur.js                                 # le moteur dans le jeu : prises, rupteur, mélangeur, saturation
NODE_PATH=$(npm root -g) node tools/e2e-splash.js [dossier]                       # l'écran-titre, sur téléphone et sur bureau
NODE_PATH=$(npm root -g) node tools/e2e-menu.js [dossier]                         # le menu-affiche : bandeaux, dépliage, destinations
NODE_PATH=$(npm root -g) node tools/e2e-pause.js [dossier]                        # le bouton pause en course, sur quatre formats d'écran
node tools/bump.js [patch|minor|major]                                            # numéro de version + cassage du cache
node tools/netsim.js <circuit> [secondes] [perte %] [format]                      # deux écrans en réseau, sans navigateur
NODE_PATH=$(npm root -g) node tools/e2e-net.js <dossier> [format]                 # deux onglets, une table, une course
NODE_PATH=$(npm root -g) node tools/e2e-duo.js [secondes] [--joueurs=8] [--perte]  # jusqu'à huit écrans : grille, aiguillage des appuis, régularité
NODE_PATH=$(npm root -g) node tools/arrow.js <circuit>                            # sens des flèches des panneaux
python3 tools/topcar.py <image> <id du modèle> [--nose=left]                      # voiture vue de dessus
python3 tools/pickcar.py <image> <id du modèle> [--tol --peel]                    # voiture en trois quarts, pour le menu
python3 tools/engineloop.py <prise.wav> <boucle.wav>                             # boucle moteur sans couture
node tools/enginedemo.js <id> <sortie.wav> [secondes] [--synthese]               # une accélération à écouter
node tools/moteur-banc.js                                                        # le volant d'inertie, sans une note de son
node tools/usure.js [circuit|all] [catégorie]                                     # ce que coûte un train de pneus, ménagé ou attaqué
python3 tools/boucles.py sounds/six-inline/*.wav                                  # où boucler dans une prise, sans réencoder
node tools/e2e-gauges.js                                                         # les cadrans : chiffre et arc d'accord, aucun plein
NODE_PATH=$(npm root -g) node tools/e2e-charge.js                                 # la barrière de chargement en ligne, et le faux « liaison perdue »
NODE_PATH=$(npm root -g) node tools/e2e-charge-solo.js                            # la même en solo : vignettes, son, sortie, message à l'écran
NODE_PATH=$(npm root -g) node tools/calques.js [voiture] [--bride=4]              # ce que coûte chaque couche dessinée sous une voiture
NODE_PATH=$(npm root -g) node tools/perf.js [voiture] [secondes] [--bride=4]      # images par seconde en course, et la queue de la distribution
NODE_PATH=$(npm root -g) node tools/reseau.js [--racine=.] [--debit=4] [--rtt=60] # ce qu'une course telecharge, et le temps jusqu'au feu vert
NODE_PATH=$(npm root -g) node tools/e2e-son-relance.js                            # le son survit-il a une deuxieme course ?
node tools/sortie.js                                                              # vibreur, tour annule, penalite : les trois etages de la regle
node tools/coupe.js [--fenetre=400]                                               # ce qu'une coupe peut rapporter, au plus
NODE_PATH=$(npm root -g) node tools/e2e-livree.js [dossier]                       # plusieurs livrees par voiture : le clic, la memoire, le fichier charge
python3 tools/calibre.py <fichier.png...> [--largeur=420]                         # une illustration deja detouree, ramenee a la taille affichee
python3 tools/prises.py <fichier.wav...> [--bits=16] [--essai]                    # les prises de moteur, du flottant 32 bits a l'entier 16
```

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
