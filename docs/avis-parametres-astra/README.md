# Avis indépendant sur les paramètres — GPT-6 Astra

Analyse du changement `7e14617` → `b81ac17`, comprenant la séparation F1 / GT / Proto (`5d34e8d`) et les pointes historiques (`b81ac17`). Les simulations chargent ces commits par Git : les illustrations et modifications de travail réalisées en parallèle ne changent pas les résultats. Aucun réglage ni code de jeu n'a été modifié pour cet avis.

**Mon avis : conserver cette base et les trois catégories.** Les choix de paramètres offrent des caractères distincts, et le mécanisme de dosage au bouton est bien présent. En revanche, les résultats démontrent surtout un bon équilibre avec un pilote automatique précis ; ils ne démontrent ni une égalité entre pilotes humains, ni une fidélité historique de l'ensemble du comportement. Je corrigerais d'abord la méthode d'évaluation et les intitulés, puis testerais deux ou trois signatures de voitures. Un nouvel équilibrage général serait prématuré.

## Ce que le code permet réellement

- Le gaz est binaire. La motricité tient compte de l'effort longitudinal et latéral, puis accumule une perte de capacité arrière avec `tauMontee = 0,22 s`, `tauRetour = 0,10 s`, `perte = 0,38`. Une petite pression et une pression prolongée n'ont donc pas le même effet.
- Lever le pied rend de la motricité mais déclenche aussi le frein : montée progressive pendant 100 ms. Ces deux effets peuvent se contrarier dans un virage.
- Le réglage de frein agit bien sur la rotation, pas seulement sur la décélération. À frein ×0,5 / ×1 / ×1,6, le transfert maximal retire respectivement 8 / 16 / 25,6 % de capacité arrière, et ajoute 4,96 / 9,92 / 15,87 % à l'avant. Ce sont des pourcentages du modèle simplifié, pas une mesure de transfert de charge d'une vraie voiture.
- Le multiplicateur `slide` change à la fois l'équilibre arrière et l'angle de glissement au pic. Par exemple, la 935 a `rearBias = 0,912`, la Corvette 0,930 et la BT46B 1,130 : leur stabilité est effectivement différente.
- L'appui distingue bien les générations : Lotus 79 `df = 0,00609`, Lotus 72 `0,00252` ; 787B `0,00425`, P68 `0,00187`. L'effet augmente avec le carré de la vitesse, avec un plafond.
- La physique est inchangée par les deux commits étudiés. Le changement de ressenti vient des paramètres, des vitesses accessibles et de la composition des catégories.

Les paramètres ne constituent pas un modèle historique complet : pas de masse propre à chaque voiture, pas d'empattement propre à chaque modèle, pas de courbe de couple ni de retard de turbo dans la poussée. `engine.turbo` décrit le son. Les modèles partagent notamment leurs dimensions par catégorie. Ce niveau de simplification convient à un jeu de slot ; il faut juger les signatures obtenues plutôt que lire chaque nombre comme une fiche technique réelle.

## Points à corriger dans la mesure, avant de retoucher les voitures

**1. La référence appelée « tour idéal » est biaisée contre les voitures à appui.** Dans `js/car.js`, la passe d'accélération de `speedProfile` calcule la charge latérale en divisant par `model.grip` seul. La voiture réelle utilise `grip + min(df × v², 1,8 × grip)`. À 180 km/h, la Lotus 79 dispose ainsi de 28,41 m/s² de capacité totale, dont seulement 13,18 sont employés comme dénominateur dans cette passe. Le cercle y consomme artificiellement trop d'adhérence.

Une expérience isolée remplaçant seulement ce dénominateur réduit le temps de référence de **1,05 % en moyenne pour les F1, 0,34 % pour les GT, 0,76 % pour les Proto**, sur les treize circuits. Cela ne rend pas encore la référence parfaite : partage par essieu, perte arrière, freinage et trajectoire réellement suivie restent différents. Les tours de l'autopilote peuvent être plus rapides que le « tour idéal » actuel ; le rapport ne mesure donc pas uniquement le « prix du caractère ».

À faire : utiliser une référence diagnostique cohérente avec l'appui et afficher séparément vitesse, dérive, incidents et effort de commande. Ne pas appliquer cette substitution à la fonction globale sans vérifier ses autres usages : les profils servent aussi aux aides et aux pénalités.

**2. Les pneus de difficulté ne sont pas une mesure universelle de difficulté humaine.** La moitié de leur score vient précisément du rapport au profil précédent. L'autre moitié est un 95e centile de dérive arrondi au degré, moyenné entre circuits ; la mesure conserve aussi les passages sales. Les scores sont normalisés sur le sous-ensemble de voitures sélectionné : une exécution avec `--cars=...` change l'échelle et ne doit pas servir à réécrire les notes générales. Une voiture rapide exige aussi un temps de réaction plus court, absent du score.

À faire : conserver les notes comme indications provisoires, calculer les statistiques propres et sales séparément, mesurer la sensibilité à une erreur de freinage / durée de pression, et préciser le périmètre de normalisation. « Trois pneus F1 = trois pneus GT » est une hypothèse, pas un résultat établi.

**3. Le banc de calibration ne couvre qu'une politique de commande.** Deux tours, une graine, frein ×1, sans aimant ni usure ni trafic. L'IA coupe au-delà d'un usage de 0,8 et utilise les seuils de glisse 0,28 / 0,55 ; ce sont des choix de pilotage qui favorisent certains caractères. Une marge supérieure à 0,98 reste plafonnée à 0,98 par `aiThrottle` tant que `maxMargin` n'est pas explicitement fourni. `plateau-banc.js --marge=1.05` ne constitue donc pas un vrai essai à 1,05.

À faire : valider sur circuits non utilisés pour le réglage, plusieurs graines et rythmes de commande ; distinguer meilleur tour brut, meilleur tour propre et fréquence d'incidents. Le banc `tools/acoups.js` parcourt seulement `modelsOf('gt')` : depuis la scission, il ne vérifie plus les F1 ni les Proto. Il doit couvrir les trois catégories avant de conclure sur tout le plateau.

**4. Le plafond annoncé de 290–291 km/h en piste est faux sur l’ensemble des circuits.** Le banc publié teste sept circuits et omet le Castellet. Sur celui-ci, les essais indépendants atteignent **328,6 km/h en XJR-9, 325,9 en F40, 319,7 en 787B**. La 240Z atteint **247,6 km/h**, très près de sa pointe paramétrée de 251,0. L’affirmation « aucune voiture n’approche sa pointe » est donc aussi trop générale. Le `VMAX_ECRAN` de 290 km/h peut rester une convention de caméra et de guide, mais sa justification comme maximum physique est invalide.

**5. Deux incohérences de paramètres/affichage existent déjà, sans empêcher de jouer.**

- `base.slide` puis `model.slide` sont calculés mais jamais lus par la physique. Seul `mul.slide`, via `rearBias` et `slipPeak`, agit. Passer la base F1 de 0,60 à 0,56 ne réduit donc pas sa glisse. Documenter ou retirer ce champ inactif évitera de faux réglages.
- Les performances du menu sont des approximations. `perfOf` ignore la rampe du frein et le plafond de motricité. Dans le contrôle droit sans braquage, la F40 fait 0–100 en **3,233 s**, contre **3,136 s** affichées ; son 100–0 demande **22,04 m**, contre **20,86 m**. Les 25 voitures ajoutent environ **1,18–1,19 m** de freinage à la formule instantanée. Il faut soit intégrer ces effets dans la fiche, soit indiquer « estimation ».

Ces défauts touchent surtout l'évaluation et la présentation. Je n'ai pas identifié dans les changements étudiés un blocage de conduite imposant une correction immédiate de la physique.

## Histoire, caractère et propositions ciblées

Les pointes sont de meilleurs repères que les anciens plafonds voisins de 250 km/h. Toutefois, les neuf F1 sont explicitement des **estimations** dans `tools/fiches.json`, la 787B y est « non revalidée », et la source GTO donne deux nombres contradictoires. L'outil vérifie l'accord entre deux tables internes ; il ne valide pas à nouveau les sources externes. Préférer **« pointes historiques indicatives, selon configuration »** à « toutes les vraies pointes ».

Certaines identités doivent aussi être précisées : 935/78 Moby Dick pour 366 km/h, mais variantes de 935 différentes dans les livrées ; 911 nommée Turbo/930 mais fiche de 934 de course ; Countach LP500 prototype 1971 avec des livrées d'autres versions et années. Le problème est le mélange de variantes, pas une obligation de supprimer ces livrées.

| Voiture / famille | Diagnostic | Variante à essayer, sans l'appliquer d'office |
| --- | --- | --- |
| BT46B | Elle est stable, mais le ventilateur n'a pas de signature d'adhérence lente exceptionnelle : `grip = 15,01`, contre 15,40 Lotus 72 et 15,15 Ferrari 312T. | Tester `mul.grip` 1,055–1,065 au lieu de 1,028 et `mul.df` 0,55–0,60 au lieu de 0,70. Davantage de capacité lente, moins de dépendance à la vitesse ; vérifier ensuite chrono et dosage, sans forcer l'égalité au dixième. |
| Renault RS10 | Avec `accel = 8,463`, sa poussée demandée reste sous celle de la Ferrari jusqu'à environ **281 km/h** ; la RS10 atteint environ 275 km/h à Monza dans le banc documenté. Son avantage théorique de pointe est donc peu visible face à cette Ferrari. | D'abord accepter cette asymétrie si l'on veut une première turbo difficile. Si l'on veut vraiment la signature « creuse puis forte », il faut une courbe de poussée propre au moteur ; augmenter uniformément `accel` ne crée pas cette signature. |
| M1 Procar | Son adhérence mécanique baisse de **7,1 %**, sa pointe monte de **25,5 %**, avec le même moteur nominal et le même équilibre arrière. Elle a perdu sa place d'entrée en matière (note 0 → 3). | Si une GT d'apprentissage est souhaitée, essayer seulement `mul.slide = 0,94–0,96` au lieu de 1, puis mesurer. Ne pas restaurer automatiquement tout l'ancien grip, ce qui change aussi les chronos. |
| F40 / 930 / Corvette | Les accélérations à vitesse élevée montent avec les nouveaux plafonds ; 930 et Corvette conservent un arrière plus mobile. La F40 n'a pas de retard de turbo physique. | Garder leurs différences actuelles ; présenter la F40 comme puissante et la 930/Corvette comme plus délicates à la remise des gaz. Le son du turbo ne suffit pas à revendiquer un comportement de turbo distinct. |
| GT des années 1960 / Proto anciens | Leur adhérence mécanique compense leur faible appui pour suivre les voitures plus récentes. C'est une égalisation de jeu : Type E 14,19 contre F40 12,65 ; P68 15,53 contre 787B 12,77. | Assumer ce choix. Si l'histoire doit davantage se sentir, laisser un peu plus d'écart ou créer des épreuves par époque ; ne pas promettre simultanément fidélité absolue et égalité au tour. |

Les variantes BT46B et M1 sont des hypothèses de réglage, pas des améliorations déjà validées. Je ne retoucherais pas 25 voitures pour obtenir 0,2 % d'écart moyen : une petite différence moyenne et des avantages selon le circuit rendent les choix intéressants. Priorité à des signatures lisibles et à la récupération après une erreur.

## Mesures supplémentaires réalisées

La campagne comprend **264 essais de deux tours  soit 528 tours complets  et 1 650 reprises courtes** (les deux versions réunies). Les entrées sont injectées à 120 Hz, sans navigateur : elles vérifient la physique, pas la sensation du bouton sur un téléphone.

### Équilibre sur des circuits hors calibration

Les six circuits ajoutés sont Monaco, Laguna Seca, Nürburgring, Bathurst, Red Bull Ring et Castellet. Le tableau donne l'étalement entre la voiture la plus rapide et la plus lente **après moyenne des écarts relatifs circuit par circuit**. Ce n'est pas le plus gros écart observé sur un circuit.

| Catégorie | Sept circuits du rapport Claude | Six circuits supplémentaires, brut | Cinq supplémentaires hors Monaco | Plus gros écart sur l'un de ces cinq circuits |
| --- | ---: | ---: | ---: | ---: |
| F1 | 0,56 % | 0,94 % | 0,82 % | 2,37 % |
| GT | 0,20 % | 1,18 % | 1,05 % | 2,31 % |
| Proto | 0,63 % | 0,73 % | 0,79 % | 1,89 % |

**L'équilibre général tient donc assez bien hors calibration.** Les GT sont moins parfaitement égales que ne le suggérait le seul échantillon réglé, mais un étalement d'environ 1 % reste serré. Hors Monaco, Ferrari 312T / Ligier JS11 sont les extrêmes F1, Corvette / 240Z les extrêmes GT, GT40 / 787B les extrêmes Proto. Cela ne justifie pas de régler chaque écart résiduel au dixième.

Monaco mérite une vérification distincte de la trajectoire et de l'IA : **les 25 voitures y terminent deux tours mais n'en produisent aucun propre, avec quatre incidents au compteur chacune**. Sur les huit autres circuits de cette campagne, les 200 essais de la version récente n'ont aucun incident et produisent tous un meilleur tour propre. Un classement fondé uniquement sur les chronos bruts de Monaco serait trompeur ; ce résultat ne démontre pas que le circuit soit injouable par un humain.

### Petites pulsations et réglage de frein

Pour chaque couple voiture/circuit parmi Monza, Suzuka et Zandvoort, le banc prend le premier état aux gaz, sur piste et au-dessus de 15 m/s, dont le glissement arrière atteint au moins 90 % de l'angle de pic. Il reprend **le même état** durant 1,2 s avec gaz tenus, alternances gaz/relâchement de 50 / 100 / 150 ms, ou pied levé, aux freins ×0,5 / ×1 / ×1,6. Il ne choisit pas après coup le virage donnant le meilleur résultat.

Dans la version récente, **71 états donnent 1 065 reprises**. Quatre couples n'atteignent pas le seuil d'échantillonnage : Tyrrell P34, BT46B, Ligier JS11 et XJR-9 à Monza. Leur absence ne prouve rien sur tous leurs autres virages. Les états initiaux diffèrent entre voitures et entre versions ; seules les commandes rejouées d'un même état constituent une comparaison strictement identique au départ.

Moyenne des pics de dérive, frein ×1 :

| Catégorie | Gaz tenus | Impulsions 50 ms | Impulsions 100 ms | Impulsions 150 ms |
| --- | ---: | ---: | ---: | ---: |
| F1, 24 états | 13,2° | 7,1° | 7,1° | 7,3° |
| GT, 27 états | 14,5° | 8,2° | 8,4° | 8,8° |
| Proto, 20 états | 16,1° | 9,3° | 9,6° | 10,2° |

À Zandvoort, les exemples sont particulièrement lisibles : Ferrari 312T **33,6° → 13,9°**, M1 **22,9° → 11,8°**, 935 **22,8° → 11,5°**, P68 **24,8° → 11,9°**, entre gaz tenus et impulsions de 50 ms, au frein ×1. Cela répond bien au geste recherché : les petites pressions limitent l'emballement de l'arrière. Elles ne doivent pas être obligatoires dans toute courbe ; une voiture stable doit aussi permettre de tenir les gaz quand la charge le permet.

Le dosage a un prix : par rapport aux gaz tenus, le 50 ms perd en moyenne **1,21 m/s supplémentaires en F1, 0,99 en GT, 0,21 en Proto** sur ces 1,2 s. Certains états gagnent toutefois à la fois en contrôle et en vitesse, comme Ferrari 312T ou P68 à Zandvoort. Aucun de ces essais courts de la version récente ne produit de sortie ou d'incident, y compris avec les autres niveaux de frein.

**Biais à connaître : 50 % de gaz ne signifie pas freinage identique.** À 120 Hz, les alternances 50 / 100 / 150 ms utilisent en moyenne environ **14,6 / 27,1 / 34,7 %** de la composante de frein réglable, à cause de sa rampe de 100 ms. Le 50 ms conserve donc davantage de vitesse pour deux raisons : la mémoire de motricité et un frein moins longtemps monté. Le résultat décrit la commande réelle du jeu ; il n'isole pas à lui seul la meilleure constante de temps des pneus.

Le frein fort ne garantit pas un meilleur virage. Sur la reprise pied levé de la 930 à Zandvoort, le pic de dérive passe de **12,8° à ×0,5**, à **15,0° à ×1**, puis **28,7° à ×1,6**. Pour la Ferrari 312T : **13,5° / 15,7° / 32,7°**. Le transfert agit nettement, mais le réglage extrême peut surtout faire pivoter l'arrière. Ce protocole court ne détermine pas un frein optimal sur un tour entier ; il justifie de garder le réglage individuel plutôt que d'augmenter globalement le transfert ou le frein.

### Comparaison avec 7e14617

Les mêmes treize voitures sont comparées sur Monza, Suzuka et Zandvoort. Le gain est la moyenne des gains relatifs par circuit ; positif signifie un tour plus rapide. Les points de départ des reprises ne sont pas identiques entre versions, car leur pilote automatique y arrive différemment.

| Voiture | Gain de chrono | Dérive p95 avant → après | Pointe observée avant → après |
| --- | ---: | ---: | ---: |
| M1 Procar | -1,73 % | 5,0° → 6,0° | 235,9 → 266,0 km/h |
| F40 | -1,46 % | 4,7° → 5,0° | 249,4 → 285,2 km/h |
| Countach | +1,53 % | 5,0° → 5,0° | 242,9 → 261,9 km/h |
| 911 Turbo | +4,08 % | 7,7° → 7,3° | 237,1 → 262,8 km/h |
| GT40 | +8,46 % | 7,0° → 6,3° | 248,0 → 284,0 km/h |
| 935 | +9,77 % | 8,0° → 7,0° | 246,2 → 287,8 km/h |
| Corvette | +4,07 % | 8,3° → 7,3° | 243,0 → 274,7 km/h |
| 787B | +2,23 % | 4,0° → 4,0° | 243,7 → 288,5 km/h |
| CSL | -0,37 % | 6,0° → 6,3° | 229,9 → 248,8 km/h |
| Tyrrell P34 | +3,08 % | 3,7° → 3,7° | 241,9 → 266,7 km/h |
| Ferrari 312T | +5,75 % | 5,7° → 6,0° | 257,2 → 278,6 km/h |
| McLaren M23 | +4,51 % | 4,7° → 4,3° | 251,5 → 272,7 km/h |
| Lotus 79 | +2,96 % | 3,7° → 3,3° | 249,1 → 267,9 km/h |

La M1 et la F40 deviennent un peu plus lentes sur cet échantillon malgré leurs pointes relevées : la baisse de grip et le partage de motricité comptent davantage que le plafond seul. Le saut de note de difficulté de la M1 (0 → 3) ne correspond pas à une dérive triplée : le p95 passe ici de 5° à 6°, et l’échelle de comparaison a changé. Les prototypes et les F1 bénéficient de leurs nouvelles bases de catégorie. Cette comparaison confirme une réorganisation du plateau, pas une simple correction des compteurs.

### Reproduire et interpréter

- [`audit.js`](audit.js) charge les deux versions par `git show`, emploie la graine 42761 et un pas de 1/120 s. Il mesure 25 voitures × 9 circuits pour `b81ac17`, puis les 13 voitures présentes dans `7e14617` sur Monza, Suzuka et Zandvoort, deux tours complets par essai. Frein ×1, marge IA 0,95, sans aimant, usure ni trafic pour les tours. Les reprises brèves balaient les trois freins.
- [`reference.js`](reference.js), avec [`context.js`](context.js), relève les paramètres avant/après et contrôle 0–100 / 100–0 sur le segment de départ de Monza, braquage neutralisé. Il compare aussi les 325 profils des 25 voitures sur les treize circuits, avec et sans l'appui dans le dénominateur de la passe d'accélération. Cette variante diagnostique ne modifie jamais les fichiers du jeu.
- [`resultats.json`](resultats.json) contient les courses et les reprises ; [`reference.json`](reference.json) contient les fiches et les profils. Les données individuelles, y compris les tours sales de Monaco, sont conservées.

```sh
node docs/avis-parametres-astra/audit.js /tmp/astra-resultats.json
node docs/avis-parametres-astra/reference.js /tmp/astra-reference.json
```

Node.js et l'historique Git contenant les deux commits suffisent. Les essais sont déterministes pour chaque scénario ; une seule graine ne donne pas un intervalle d'incertitude ni une preuve d'équilibre entre humains. Le banc physique ne vérifie pas la capture des pressions entre images, le tactile, le réseau, les pelotons ou l'usure. Les sources historiques n'ont pas été vérifiées à nouveau sur le Web.
