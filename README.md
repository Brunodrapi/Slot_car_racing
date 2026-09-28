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

### Lecture granulaire, et pourquoi pas des boucles

Trois voitures roulent sur des enregistrements : la M1 Procar, la F40 et la Corvette. Les six
autres sur la synthèse.

**Elles ne sont jamais transposées.** C'est tout le sujet, et il a fallu trois tentatives ratées
pour y arriver. Un moteur de jeu sérieux — REV, AudioMotors, le moteur granulaire de Wwise — ne
change pas la vitesse de lecture d'un son : il **se déplace dans une montée en régime enregistrée**
et y prend des grains là où le moteur tournait vraiment à ce régime. Le chiffre qui condamne
l'autre approche est constant dans la littérature : **une boucle commence à sonner étirée dès
qu'on la transpose de plus de 500 tr/min**, soit sept dixièmes de demi-ton à 6000. Couvrir trois
octaves en transposant demande des dizaines de boucles et sonne mal bien avant — chez moi, « on
dirait des moustiques ».

Sept voitures sur neuf ont leur prise à elles, et les deux autres empruntent. La table à jour est
dans [`sounds/BILAN.md`](sounds/BILAN.md), que `python3 tools/bilanson.py` régénère en mesurant le
dossier — elle n'est pas tenue à la main, donc elle ne périme pas :

| voiture | rampe | montée | plage couverte |
|---|---|---|---|
| Countach LP500 | 6,0 s | 24 demi-tons | 1907 – 7500 tr/min |
| M1 Procar | 7,8 s | 17 demi-tons | 3423 – 9000 tr/min |
| Corvette | 7,4 s | 14 demi-tons | 2708 – 6000 tr/min |
| F40 | 4,0 s | 9 demi-tons | 4702 – 7750 tr/min |
| 911 Turbo | 3,0 s | 7 demi-tons | 4595 – 7000 tr/min |
| 787B | 4,6 s | 7 demi-tons | 6159 – 9000 tr/min |
| GT40 Mk II | 1,8 s | 5 demi-tons | 4611 – 6200 tr/min |
| 917 K | *celle de la M1* | 17 demi-tons | 3192 – 8400 tr/min |
| 3.0 CSL | *celle de la M1* | 17 demi-tons | 2662 – 7000 tr/min |

**La plage n'est pas posée, elle est déduite de la montée mesurée.** Une rampe qui monte de neuf
demi-tons ne peut couvrir que neuf demi-tons de plage de régime : lui en faire couvrir vingt-cinq
étire l'axe des régimes de presque trois fois, et le moteur monte alors bien moins vite que le
compte-tours. Le granulaire ne déforme plus le timbre, mais un axe étiré désaccorde le moteur du
cadran, ce qui s'entend autant. Seul le rupteur est donné ; le bas s'en déduit, et
`tools/e2e-sample.js` échoue si l'étirement s'écarte de 1 de plus de 6 %.

La contrepartie est claire et assumée : **plus la montée est large, plus la rampe couvre**. La
Countach, vingt-cinq demi-tons d'un seul rapport, tient toute sa plage à l'enregistrement et ne
laisse presque rien à la synthèse. La 787B, six demi-tons, n'en tient que le haut — et c'est
jouable, parce qu'un Groupe C ne descend pas là en course. C'est la raison pour laquelle une montée
complète, du bas de la plage au rupteur, vaut tous les réglages du monde.

Le plancher de l'outil est un demi-octave de montée, pas davantage : en deçà du bas de la rampe et
au-delà du haut, le lecteur fond vers la synthèse sur un quart d'octave, si bien qu'une rampe étroite
coûte de la couverture et non de la justesse.

**Une voiture sans prise à elle joue celle de la M1**, et non plus la synthèse. C'est la montée la
plus large du dossier après la Countach — dix-sept demi-tons d'un seul tenant — donc celle qui
survit le mieux au prêt. Un six en ligne sur une 917 K est faux d'origine, mais l'écart entre un six
et un douze est un écart de timbre, quand l'écart entre une prise et la synthèse était un écart de
nature ; le reproche « on entend encore les moustiques » portait sur le second.

Le prêt demande une précaution, qui est tout ce que le code ajoute. Une rampe porte sa plage en
tours/minute, mesurée sur la voiture qui l'a enregistrée : celle de la M1 monte à 9000. Jouée telle
quelle sur une CSL qui coupe à 7000, le haut de la rampe resterait hors d'atteinte — la voiture
lirait les trois quarts de l'enregistrement et **ne sonnerait jamais au rupteur**, le moteur
paraissant retenu en permanence. `_bornes()` ramène donc les deux bornes de la rampe au rupteur de
la voiture qui l'emprunte, par un simple facteur `rupteur / rpmHaut`. Le facteur vaut exactement 1
pour les sept voitures qui ont leur prise, si bien que le prêt ne change rien pour elles, et
`tools/e2e-sample.js` vérifie que le rupteur de chacune des neuf tombe bien sur la fin de sa table.

**Ce qu'une prise doit être.** Sur sept fichiers découpés à la main, trois ont donné une rampe. Ce que
disent les quatre autres est plus utile que leur rejet : `gt40_plein_regime` monte de 5,5 demi-tons
sur quinze secondes, soit un tiers de demi-ton par seconde, ce qu'on ne distingue pas de la dérive de
la mesure cumulée ; `787B_start` et `M1_Procar_off-7000` bougent de dix à quatorze demi-tons **par
seconde**, ce qu'aucune voiture sur un rapport ne fait — un démarrage et un montage, pas des régimes ;
`GT_40_descente` ne chute que de 2,3 demi-tons d'un seul tenant. Ce qu'il faut est une seule chose :
**un tirage d'un seul rapport, parti du bas de la plage, sans passage** — typiquement la sortie d'un
virage lent en deuxième ou troisième.

**Le pied levé attend sa matière.** `tools/enginegrains.py --descente` sait extraire une rampe de
décélération : il cherche la montée dans le signal retourné, puis ramène la table au temps du fichier
d'origine — le son n'est jamais écrit à l'envers, une attaque de combustion jouée à reculons ne
sonnant plus comme un moteur. Mais la seule descente déposée ne chute que de **5,0 demi-tons en
1,4 s**, soit 6725 – 9000 tr/min sur une voiture. Brancher une seconde voie dans le lecteur granulaire
pour cela ne se justifie pas : le pied levé n'y gagnerait que le quart haut de la plage d'une seule
voiture sur neuf. Il faut un lever de pied **du rupteur au ralenti, sur un rapport, sans coup de
frein**, quatre secondes au moins. La commande est prête, la matière manque.

**Ce qu'il faut comme matière.** Une rampe : une montée continue, pied au plancher, sur un seul
rapport. `tools/enginegrains.py` la trouve seul dans un onboard — il cherche la plus longue montée
de hauteur sans recul, un recul franc étant précisément un passage de rapport.

**Comment la hauteur est suivie, et pourquoi ça marche enfin.** Pas en mesurant un régime. Un
moteur n'a pas de fondamental unique et net : il porte ses demi-ordres, ses rangs d'allumage, ses
résonances d'échappement, et l'énergie n'est pas forcément sur l'allumage. Autocorrélation, somme
harmonique, écart entre rangs, toutes ont été essayées ici, toutes se trompent d'octave quelque
part, et pas au même endroit — d'où des jeux de boucles dont les étiquettes se contredisaient
entre elles de 0,29 à 2,05.

On mesure donc seulement **de combien la hauteur a bougé d'une fenêtre à la suivante**. Une
dilatation du temps translate le spectre sur un axe logarithmique, et le décalage qui superpose
le mieux deux spectres voisins donne le rapport exact. Entre deux fenêtres distantes de quatre-
vingts millisecondes l'écart est minuscule, donc la mesure est sûre : **l'alignement médian passe
de 0,5 à 0,85** rien qu'en ne comparant que des voisines. Les rapports se cumulent et donnent une
courbe de hauteur fiable sans avoir jamais eu à nommer un régime.

L'échelle absolue, elle, n'est pas mesurée : elle est **posée** par `--bas` et `--haut`, donc par
la voiture. Et c'est sans risque, parce qu'une erreur là-dessus ne déforme rien — elle décale
seulement l'endroit de la rampe qu'on entend.

**Le lecteur.** Grains de 90 ms, recouvrement de moitié, enveloppe triangulaire : la somme de deux
enveloppes voisines vaut exactement un, donc le niveau ne bouge pas et il n'y a pas de raccord à
entendre. La tête de lecture avance d'elle-même au rythme du son — ce qui redonne au moteur ses
irrégularités de cycle, qu'une boucle écrase — et se recale sur la position du régime dès qu'elle
s'en éloigne de plus de 200 ms. `playbackRate` n'est jamais touché, et `tools/e2e-sample.js` le
vérifie en lisant le code du lecteur.

**Quand une prise existe, c'est elle qu'on entend — sur toute la plage.** La règle d'avant rendait la
main à la synthèse dès que le régime sortait de la plage mesurée de la montée. Prudent sur le papier,
c'était le défaut principal : une montée découpée dans un onboard de course ne couvre souvent qu'un
tirage entre deux rapports — 4611 à 6200 tr/min pour le GT40 — si bien que **les quatre cinquièmes de
ce qu'on entendait n'étaient pas la prise, mais la synthèse**. Le reproche « on entend encore les
moustiques » portait donc juste, et sur la synthèse, que la prise ne faisait que couvrir par endroits.

Le choix est renversé, et c'est un choix, pas une découverte. Sous le bas de la montée on reste sur la
prise : la tête de lecture butant sur son début, la hauteur cesse de suivre le compte-tours. Un vrai
moteur qui ne suit pas tout à fait le cadran sonne mieux qu'un oscillateur qui le suit parfaitement.
Au-dessus du rupteur enregistré le fondu reste, parce qu'il n'y a rien à jouer plus haut. Seule
exception, l'arrêt : avant le départ le ralenti de synthèse garde la main, aucune de ces prises ne
contenant de ralenti et un moteur à 4600 tr/min voiture immobile s'entendant tout de suite.

### Trois prises par voiture, et le moteur choisit

Une montée ne dit qu'une chose : comment le moteur sonne en prenant des tours. Elle ne sait rien dire
de ce qu'il fait installé au rupteur, ni pied levé, où la combustion cesse et où seule la ligne
d'échappement chante. Le lecteur prend donc sa matière là où elle existe :

| rôle | ce que c'est | repéré par le régime ? |
|---|---|---|
| `ramp` | la montée | **oui** — c'est elle qui porte l'axe des tours |
| `haut` | à plein régime, quand les tours ne bougent plus | non |
| `bas` | pied levé | non |
| `start` | le démarreur, une fois, au décompte | non, joué d'un bout à l'autre |

La distinction n'est pas cosmétique, elle débloque deux prises sur trois. Une prise à plein régime ne
change presque pas de hauteur — c'est sa définition — donc la montée qu'on y mesure ne se distingue
pas de la dérive de la mesure ; une décélération de course erre de deux ou trois demi-tons sans chute
nette, le pilote levant, reprenant, freinant. Leur faire porter une table fabriquerait un axe faux.
Mais elles portent parfaitement un **timbre**, et c'est tout ce qu'on leur demande : la tête de
lecture y tourne librement, sans rien prétendre sur le régime.

Les trois gains se croisent en fondu sur 120 ms, un basculement sec s'entendant comme un raccord. Le
GT40 a ses trois matières, la 787B une montée, une descente et un démarreur. `tools/enginetexture.py`
fabrique une matière, `tools/enginegrains.py` une montée.

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

### Le clapot du ralenti

Aucun des trois onboards ne contient de ralenti : une prise de course n'en a pas, le pilote ne
laisse jamais le moteur tourner à vide. Cherché automatiquement dans les trois, les meilleurs
candidats font deux dixièmes de seconde. C'est donc la synthèse qui tient le ralenti, et elle n'y
était bonne que par accident.

Un moteur au ralenti ne fait pas entendre sa ligne d'échappement mais sa combustion : elle est
irrégulière, un cylindre ne donne pas tout à fait comme le suivant, la distribution claque. Un
moteur déclaré « lisse » — la M1 et la F40, `rough` à 0,15 — ne rendait donc qu'un bourdon mince
et propre, là où la Corvette à 0,70 sonnait juste sans qu'on ait rien fait pour.

D'où une couche de bruit filtré **multipliée par le signal du moteur lui-même**. Le produit se
module à la fréquence d'allumage : c'est le « pouf-pouf » d'un ralenti, et non un souffle. En
pratique le gain du multiplieur reste à zéro et c'est l'oscillateur, branché sur ce gain, qui le
fait varier — une modulation en anneau, à la fréquence audio, que le graphe audio du navigateur
sait faire sans code.

Mesuré : le battement tombe à 55,2 Hz sur la M1 pour 55,0 attendus à 1100 tr/min, et à 66,6 Hz sur
la F40 pour 66,7. Le centroïde passe à 171 et 182 Hz, tout près des 154 Hz de la Corvette qui
faisait déjà l'affaire. Le clapot se retire ensuite de lui-même : il est pondéré par le carré de
ce qui reste à monter en régime, et par l'absence de prise — au plein régime de la M1 le centroïde
est remonté à 597 Hz, celui de la F40 à 1601.

### La chaîne d'outils

```
node tools/decodeaudio.js <entrée> <sortie.wav>            # WebM, MP3… par le décodeur de Chromium
python3 tools/enginescan.py <prise.wav> --cyl=6            # où se trouve quel régime
python3 tools/enginegrains.py <prise.wav> <nom> --haut= [--descente]   # la rampe + sa table
python3 tools/bilanson.py                                  # le bilan mesuré de tous les sons
node tools/enginedemo.js <id> <sortie.wav>                 # une accélération à écouter
node tools/e2e-sample.js                                   # la rampe arrive, la lecture avance
```

Il n'y a pas de décodeur en ligne de commande dans cet environnement, mais Chromium en embarque un
pour tous les formats du Web. `decodeaudio.js` le lui fait faire, et rapatrie le résultat **par
tranches** : d'un bloc, au-delà d'un quart d'heure de son, la chaîne sérialisée dépasse ce que Node
accepte (`ERR_STRING_TOO_LONG`) et rien n'est écrit.

Les rampes sont écrites en **mono 24 kHz** : un moteur n'a plus rien à dire au-dessus de 12 kHz, et
les trois tiennent ainsi dans 950 Ko.

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
NODE_PATH=$(npm root -g) node tools/e2e-audio.js                                  # spectre de chaque moteur et étagement de la boîte
NODE_PATH=$(npm root -g) node tools/e2e-splash.js [dossier]                       # l'écran-titre, sur téléphone et sur bureau
NODE_PATH=$(npm root -g) node tools/e2e-menu.js [dossier]                         # le menu-affiche : bandeaux, dépliage, destinations
node tools/bump.js [patch|minor|major]                                            # numéro de version + cassage du cache
node tools/netsim.js <circuit> [secondes] [perte %] [format]                      # deux écrans en réseau, sans navigateur
NODE_PATH=$(npm root -g) node tools/e2e-net.js <dossier> [format]                 # deux onglets, une table, une course
NODE_PATH=$(npm root -g) node tools/e2e-duo.js [secondes] [--joueurs=8] [--perte]  # jusqu'à huit écrans : grille, aiguillage des appuis, régularité
NODE_PATH=$(npm root -g) node tools/arrow.js <circuit>                            # sens des flèches des panneaux
python3 tools/sheet.py <dossier de rendus> <id du modèle> <longueur en m> [largeur]  # planche de rotations
python3 tools/env.py <planche.png> sprites/env [--erode=6] [--shadow=r,g,b] …     # découpe une planche de décor
python3 tools/topcar.py <image> <id du modèle> [--nose=left]                      # voiture vue de dessus
python3 tools/pickcar.py <image> <id du modèle> [--tol --peel]                    # voiture en trois quarts, pour le menu
python3 tools/engineloop.py <prise.wav> <boucle.wav>                             # boucle moteur sans couture
node tools/enginedemo.js <id> <sortie.wav> [secondes] [--synthese]               # une accélération à écouter
node tools/e2e-sample.js                                                         # le régime déclaré correspond-il à la prise ?
node tools/e2e-gauges.js                                                         # les cadrans : chiffre et arc d'accord, aucun plein
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
