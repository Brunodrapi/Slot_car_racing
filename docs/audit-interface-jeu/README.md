# Eyes On Line : identité et écrans de jeu

Analyse du 19 octobre 2026, sur hybrid **0.37.0** (`9f34ebf`). Cette étude remplace le cadrage
principalement utilitaire de la précédente [analyse des menus](../menus/README.md).
Elle formule des recommandations ; elle ne modifie ni l'interface ni le comportement du jeu.

## Conclusion

**La refonte a corrigé un problème de fabrication en affaiblissant une direction artistique.**
Il fallait rendre les bandeaux fiables, pas nécessairement remplacer l'affiche par des cartes.
Le menu actuel est plus explicite, mais son vocabulaire graphique — panneaux arrondis, fonds
sombres, accents pastel, typographie système — porte peu la personnalité d'Eyes On Line.

Pour l'accueil, la meilleure piste est une **affiche de course vivante**, dans l'esprit du visuel
original. Pour la course, il faut une interface plus discrète, mais appartenant au même univers.
Une identité commune ne signifie pas une densité graphique identique sur tous les écrans.

Les écrans de course ont des bases solides : anticipation de la caméra, conduite lisible vue du
dessus, repères spatiaux, son du patinage, commandes analogiques, choix de caméra et spectateur.
**Je ne les qualifierais pas encore d'aboutis au regard des bonnes pratiques actuelles** : il reste
à travailler la hiérarchie selon le mode, la lecture des adversaires proches, la personnalisation
du HUD, le contraste sur les fonds variables et l'encombrement du spectateur sur mobile.
Ce jugement est un audit de conception, pas un classement scientifique face aux jeux commerciaux.

## Méthode et niveau de preuve

La recherche donne la priorité à la conception de jeux vidéo : retours de concepteurs, recherche
sur les interfaces de jeux et sur le regard en simulation automobile, recommandations Xbox.
Les sources d'applications utilitaires ne fondent pas cette nouvelle direction.

J'ai examiné le code du rendu, des caméras, du son et du spectateur, les illustrations originales,
les captures existantes et de nouvelles captures de la version 0.37.0. Le parcours PC/tactile
`tools/e2e-pc.js` a été exécuté avec succès. Il valide le fonctionnement des commandes et de la
rotation, **pas** le plaisir, l'immersion ou l'efficacité perceptive.

Les captures nouvelles proviennent de scénarios techniques au début d'une course ; elles ne
prouvent pas la qualité du cadrage à pleine vitesse. Les captures spectateur/drapeaux existantes
sont des scénarios injectés de 0.36.0, dont le code de rendu concerné n'a pas changé en 0.37.0.
Aucun test utilisateurs, eye-tracking, essai au soleil sur téléphone physique ou mesure de
reconnaissance des signaux n'a été réalisé pour cet audit.

## Ce qu'apportent les sources de conception de jeux

### 1. L'interface peut être une signature artistique

Le compte rendu du panel des concepteurs de **Persona 5**, Masayoshi Sutoh et Kazuhisa Wada,
explique que l'interface a été volontairement promue au rang d'élément majeur de l'identité.
Ils construisent une couleur dominante, un logo, une typographie et une composition liés au
concept du jeu. Ils parlent aussi de guidage du regard et de hiérarchisation de la lumière,
pas seulement de style spectaculaire. [S1]

L'entretien de 2016 insiste également sur la réactivité : la richesse animée ne doit pas
retarder l'ouverture du menu. [S2]

**Application** : conserver nos diagonales, notre dessin de logo, les damiers, les roues et les
casques ; faire réagir ces éléments. Une animation accompagne la validation, elle ne doit pas
imposer une attente à chaque navigation. Copier le rouge/noir de Persona serait une mauvaise
interprétation : il faut reprendre la cohérence de la démarche, pas son habillage.

### 2. Minimalisme et personnalité sont compatibles

Dans l'entretien consacré à **art of rally**, Dune Casu décrit une évolution volontaire de la
palette, du terrain et de la végétation, notamment sous l'influence de *The Witness*. Le
minimalisme reste au service du pilotage, avec un monde stylisé reconnaissable. Il mentionne
également les essais et retours de joueurs pour rendre le comportement prévisible. [S3]

**Application** : nos voitures trapues, les aplats naturels, le relief suggéré et les couleurs des
circuits constituent déjà une direction. Le menu devrait prolonger cette personnalité. Le fait
qu'un jeu soit minimaliste n'impose ni un fond neutre ni une bibliothèque de cartes standard.

Ces deux exemples sont des retours de conception de jeux reconnus. Ils ne démontrent pas que
leur interface a causé leur succès commercial et ne constituent pas une recette universelle.

### 3. Il existe plusieurs façons légitimes d'intégrer l'information

Stonehouse présente les interfaces diégétiques, spatiales, « meta » et superposées, à partir
notamment des travaux de Fagerholt et Lorentzon. Il montre aussi que la lisibilité peut justifier
une information extérieure au monde. Son article cite explicitement des jeux automobiles. [S4]

Le résumé du mémoire **Beyond the HUD** invite à connaître le jeu et son espace de conception ;
il concerne principalement des FPS, donc ses conclusions ne se transposent pas automatiquement
à notre course vue du dessus. [S5]

La présentation éditoriale de **Gameworld Interfaces**, de Kristine Jørgensen, souligne que les
interfaces symboliques peuvent aussi contribuer à l'expérience. La notice a été consultée,
pas l'intégralité du livre. [S6]

**Application** : garder les chiffres, flèches et bords colorés dans le monde, et garder les temps
et le classement dans le HUD. Transformer tous les instruments en objets du décor serait
artificiel ici. L'objectif est la cohérence avec la course miniature, pas la disparition du HUD.

### 4. « Moins de HUD » n'est pas une conclusion scientifique générale

Joyce et ses collègues ont étudié 104 participants, dont **88 retenus dans l'analyse**, dans une
tâche de contre-la-montre en simulation automobile. Les joueurs plus performants consacraient
**relativement moins de fixations à la piste par rapport aux éléments du HUD** que les moins
performants. Cela ne signifie pas qu'ils regardaient majoritairement le HUD. [S7]

L'étude est observationnelle : elle ne prouve ni qu'ajouter des instruments améliore le temps,
ni qu'un placement donné serait optimal. Les participants jouent à une simulation, pas à notre
slot racing tactile. Elle contredit toutefois l'idée simpliste qu'un bon HUD devrait toujours
s'effacer au maximum.

**Application** : proposer un mode de lecture simple et un mode plus riche ; privilégier le delta
en chrono et les adversaires proches en course. Évaluer les deux auprès de joueurs de niveaux
différents, au lieu de demander à tous de lire les mêmes instruments.

### 5. Les recommandations d'accessibilité des jeux sont utiles à la direction artistique

Les **Xbox Accessibility Guidelines** traitent la taille du texte, le contraste sur les décors
variables, les canaux complémentaires aux couleurs et l'apprentissage des mécaniques. Elles
s'appuient sur des exemples de jeux et proposent des réglages pour des besoins différents. [S8–S11]

**Application** : une palette expressive et une typographie de caractère peuvent coexister avec
des chiffres clairs, un HUD agrandissable et des signaux redondants. Les dimensions Xbox doivent
être adaptées aux conditions PC/mobile ; elles ne doivent pas être reprises comme des valeurs
CSS universelles. Les recommandations ne constituent pas une certification de notre jeu.

## Accueil : trois directions possibles

| Direction | Expression | Intérêt pour Eyes On Line | Risque |
| --- | --- | --- | --- |
| **Affiche de course vivante — recommandée** | Grande illustration, logo dessiné, bandeaux obliques, papier/sérigraphie, roues et casques, animation courte du trait de piste | Retrouve immédiatement l'identité originale ; accessible avec nos éléments actuels | Trop de texture peut nuire aux petits libellés |
| **Paddock miniature** | Voiture choisie au premier plan, stand stylisé, panneaux de course intégrés au décor | Relie l'accueil aux voitures et à la course ; favorise l'attachement au garage | Plus d'assets et de mise en scène à produire ; risque de navigation cachée |
| **Coffret de slot racing** | Circuit de table, poignées de commande, fiches de voitures et graphisme d'emballage vintage | Rend la mécanique à un accélérateur et l'univers miniature immédiatement compréhensibles | Peut faire paraître le jeu plus enfantin que l'ambition automobile souhaitée |

### Proposition concrète pour l'affiche vivante

- **L'illustration constitue l'écran**, elle n'est plus une vignette à côté d'un menu.
- Le logo original devient l'ancrage principal ; éviter de le doubler par un grand titre en police système.
- Les trois entrées gardent leurs symboles distincts : roues, chronomètre, casques. Les noms restent visibles,
  éventuellement plus petits au repos, sans exiger de mémoriser les icônes.
- Bandeaux avec angles et épaisseurs communs. Les états replié/déployé dérivent d'**un même composant et
  d'un même masque**, au lieu d'aligner une image interactive sur un bouton imprimé dans le fond.
  Il faudra donc un fond sans boutons peints et des éléments séparés. Un déplacement CSS approximatif
  des anciens calques ne résoudrait pas durablement le problème.
- Animation du damier, mouvement bref de la roue, léger déplacement de l'illustration au changement de mode.
  Le texte critique et la cible ne bougent pas. Réduction des animations disponible.
- Petit son de validation évoquant la mécanique ou le chronomètre, soumis au réglage sonore ; pas de musique
  forcée ni de délai sonore avant l'action.
- **PC** : recomposer la scène en paysage, avec voiture/route et espace réservé aux bandeaux ; conserver le
  rapport d'aspect des sujets. Ni étirer l'affiche portrait, ni simplement la rogner derrière le menu.
- **Mobile** : conserver la force de la composition verticale originale et des cibles généreuses.

Pour les sélections, je conserverais l'organisation utile de 0.37 mais avec un habillage de **fiches
techniques de paddock** : grands dessins, numéros de course, étiquettes de livrées et plans de circuit.
Les quatre jauges sur chaque voiture méritent d'être allégées : réserver le détail à la voiture
sélectionnée, tout en conservant un moyen de comparer. C'est une proposition à tester, pas une
suppression décidée des informations de performance.

## Audit des écrans en course

| Sujet | Observation dans le jeu actuel | Recommandation | Priorité |
| --- | --- | --- | --- |
| **Route et anticipation** | Caméra anticipant la ligne, zoom dépendant de la vitesse, choix fixe/orienté. Les chiffres/flèches et bords bleu/jaune structurent la conduite. | Conserver ces repères. Mesurer la durée de piste réellement visible avant le prochain freinage, en tenant compte des instruments et du doigt. Ne pas zoomer pour grossir les voitures sans cette mesure. | Haute |
| **Voiture devant** | Feux de freinage présents dans le rendu, mais petits et liés au sprite. Plusieurs voitures peuvent avoir la même livrée. | Éprouver la reconnaissance du freinage à la taille réelle de jeu, surtout mobile. Si nécessaire, renforcer sobrement les feux et ajouter un repère d'identité optionnel ; ne pas couvrir les silhouettes. | Haute, particulièrement en multi |
| **Adhérence/patinage** | Son de pneus, régime et traces déjà alimentés par le glissement ; pastille tactile colorée selon le ressenti. | Conserver le retour sonore. Compléter la couleur par une variation de forme/texture ou un indicateur optionnel ; tester si le joueur détecte la limite avant la sortie. Retour haptique éventuel, selon support matériel. | Haute |
| **Temps et drapeaux** | Temps courants 13/15 px dans le dessin, libellés 10/11 px, drapeaux 10/12 px près du chrono. Peu d'options pour adapter la taille. | Prévoir une échelle de HUD et un mode de contraste renforcé. Garder le carré demandé ; l'accompagner brièvement d'un libellé d'événement et éventuellement d'un signal sonore distinct. | Haute |
| **Contraste** | Position/tour/vitesse blancs sans contour ni plaque systématique ; mini-carte translucide sur le monde. Le code documente le choix esthétique de retirer les contours. | Ne pas réintroduire partout des cadres lourds. Préférer une option de fond local discret/ombre ou contraste renforcé, testée sur sable, vibreurs, ville et végétation. | Haute |
| **Classement pilote** | Sur PC, le classement prend les six premiers ; un joueur P10 n'y retrouve ni lui-même ni forcément son adversaire immédiat. Sur mobile il n'a pas ce tableau. | En course, privilégier « devant / vous / derrière », avec position et écart ; classement complet à la demande. Éviter une multiplication des décimales en virage. | Haute |
| **Contre-la-montre** | Meilleur et tour courant présents ; emplacement de position conservé avec « — ». Pas de delta continu identifié dans le rendu. | Donner cet espace au delta signé par rapport au meilleur tour valable. Au franchissement, récapitulatif bref, puis retour à la lecture normale. | Moyenne |
| **Commandes PC** | Panneau de 310 × 142 px, ou 174 px avec frein LT, qui répète en permanence les instructions et l'état de la manette. | Instrument compact vitesse/gaz/frein ; rappels au début ou sur demande. Les états déconnexion/relâcher RT doivent rester immédiats et visibles. | Moyenne |
| **Commandes tactiles** | Pastille près du doigt, côté du levier configurable, adaptation paysage. Le chiffre de vitesse suit le doigt. | Vérifier les occultations sur appareil réel et les changements de prise en main. Proposer un ancrage fixe optionnel si les déplacements gênent ; ne pas supprimer le principe actuel sans essai. | Haute pour la validation |
| **Alertes** | « SORTIE DE PISTE ! », moteur coupé et arrivée utilisent une zone centrale de la scène. | Notifications courtes et hiérarchisées ; garder dégagée la voiture et la trajectoire de retour. Distinguer état persistant et message d'apparition. | Moyenne |
| **Apprentissage** | Instructions au départ et en pause, mais pas de parcours guidé identifié pour comprendre les impulsions de gaz/frein. Le texte d'aide parle encore de vitesse en haut, alors qu'elle est maintenant près du pouce. | Corriger la cohérence de l'aide lors de l'implémentation. Créer un petit essai rejouable : accélérer, relâcher, sentir la dérive, enchaîner les impulsions, régler le frein. [S11] | Haute |
| **Style du HUD** | Plusieurs langages coexistent : chiffres système, pastilles, jauges, panneau PC et interface de spectateur proche d'une application web. | Créer une famille d'instruments de course commune : plaques de numéro, chrono et signalétique. Garder des chiffres très clairs ; textures et effets surtout dans les menus. | Moyenne |

Le carré à damier commence volontairement au dernier tour du leader dans notre règle de jeu.
Il faut conserver cette convention demandée, mais la rendre explicite (« Dernier tour du leader »,
puis « Fin dans… »), afin d'éviter de laisser croire que la course est déjà terminée.
De même, une voiture sous bleu devenue traversable mérite un signal compréhensible : une simple
transparence peut être prise pour un problème réseau par un nouveau joueur.

## Spectateur et bilan

**La vue complète** a déjà de bons fondements : adaptation paysage, marqueurs numérotés et colorés,
choix du pilote, informations de tours et écarts. Dans un peloton serré, les marqueurs se recouvrent.
À essayer : souligner le pilote sélectionné, décaler les étiquettes sans déplacer les positions,
et limiter temporairement les numéros secondaires. Ne pas déplacer artificiellement les voitures.

**Le suivi sur téléphone** est le problème le plus visible : le panneau d'environ 240 px peut
occuper une large fraction des 390 px de largeur et près de la moitié supérieure de la capture.
La vue rapprochée ne réserve pas l'espace du panneau comme le fait la vue complète. Une barre
compacte pilote/position/écart et un tiroir Chronos à la demande seraient plus adaptés. La
mini-carte doit rester disponible sans imposer le classement complet en même temps.

**Le réalisateur** sélectionne déjà incidents et duels, mais change de famille de plan selon un
cycle de huit secondes. Un passage automatique à la vue complète peut donc interrompre une
bataille. Je recommande une réalisation fondée sur les événements, avec durée minimale d'un plan,
maintien du duel jusqu'à sa résolution, et vue complète pour situer départ, relance ou changement
de secteur. Les durées exactes doivent être testées, pas choisies comme une norme scientifique.

**Le bilan** peut accueillir beaucoup plus de données que le HUD de conduite. Position, meilleur
tour, régularité, pénalités et évolution du classement existent déjà. Présenter d'abord le résultat
et deux ou trois faits de course ; laisser le détail des tours et graphiques au second niveau.
Ici, les méthodes de visualisation de données sont utiles, mais l'habillage peut rester celui
d'un bulletin de course ou d'une feuille de chronométrage.

## Ordre recommandé et validation

1. Refaire une maquette d'accueil « affiche vivante » en portrait et paysage, en reprenant les éléments
   distinctifs de l'original. Fixer logo, palette, typographie, formes et réactions avant de coder.
2. Prototyper un HUD **course** axé sur les adversaires proches et un HUD **chrono** axé sur le delta.
   Conserver les commandes et les repères de gameplay. Ajouter les réglages taille/contraste.
3. Réduire l'encombrement du suivi spectateur sur mobile et rendre les changements du réalisateur cohérents
   avec l'action. Harmoniser ensuite les sélections et le bilan avec la nouvelle direction.
4. Comparer les variantes avec des novices et des joueurs habitués, sur plusieurs circuits et voitures.

Les mesures suivantes sont un protocole proposé, pas des résultats déjà obtenus :

| Question | Essai utile |
| --- | --- |
| Reconnaît-on notre jeu ? | Présenter les accueils sans logo pendant une courte durée ; relever les associations, la reconnaissance et l'envie de jouer, pas seulement une note « joli ». |
| Le mode est-il compréhensible ? | Faire lancer une course, un chrono puis rejoindre une table ; relever hésitations et erreurs de destination. |
| Voit-on freiner la voiture devant ? | Même scénario, même distance et même délai réseau pour les variantes ; mesurer détection et réaction séparément. Le ping ne mesure pas à lui seul la latence perçue. |
| Comprend-on la limite d'adhérence ? | Virages identiques avec/sans son et différentes options visuelles ; relever sorties et qualité des corrections par impulsions. |
| Le HUD aide-t-il ? | Demander une information en ligne droite et en virage ; mesurer réponses correctes et erreurs de conduite, avec groupes de niveaux distincts. |
| La caméra permet-elle d'anticiper ? | Mesurer la portion continue de piste visible avant la zone critique et la convertir en temps à la vitesse du véhicule ; répéter en portrait/paysage et avec occultation du pouce. |
| Le spectateur suit-il la bataille ? | Après chaque changement de plan, demander qui attaque qui ; compter les pertes de compréhension et les ouvertures du tableau. |

Ne pas fixer un pourcentage de « réussite UX » avant d'avoir une mesure de référence. Un petit
panel peut révéler des problèmes récurrents ; il ne suffit pas à prouver statistiquement une
supériorité. Tester aussi une vraie manette, un vrai téléphone et des conditions lumineuses
variables, au-delà de Chromium émulé.

## Captures examinées

- [Accueil original](../../art/menu-bg.webp) et [accueil 0.37 PC](../menus/pc-menu.png).
- [Course PC, manette](pc-course-manette.png), [tactile paysage](mobile-course-paysage.png),
  [tactile portrait](mobile-course-portrait.png) — nouvelles captures 0.37.
- [Spectateur suivi mobile](../spectateur/spectateur-mobile-test.png) et
  [circuit complet](../spectateur/spectateur-circuit-test.png) — scénarios 0.36.
- [Drapeaux](../drapeaux/README.md) — scénarios 0.36. Les captures nommées `390` y sont des fenêtres
  étroites ; certaines montrent les commandes PC. Elles ne constituent pas une validation tactile.

## Références consultées

- **[S1]** Persona Central, *Panel on the Concept and Development Behind Persona 5's UI* (2017).
  Compte rendu/traduction d'un panel de Masayoshi Sutoh et Kazuhisa Wada, relayant Famitsu.
  [Lire](https://personacentral.com/persona-5-panel-concept-development-ui/)
- **[S2]** Persona Central, *Persona 5 Developer Interview About UI Design, Sound Design and Music* (2016).
  Entretien Famitsu traduit via Play-Asia ; source médiée, pas transcription originale japonaise vérifiée ici.
  [Lire](https://personacentral.com/persona-5-interview-ui-design-sound-music/)
- **[S3]** Shubhankar Parijat, entretien avec Dune Casu, *art of rally Interview – Art Style, Development,
  and More*, GamingBolt, 2 novembre 2021.
  [Lire](https://gamingbolt.com/art-of-rally-interview-art-style-development-and-more)
- **[S4]** Anthony Stonehouse, *User interface design in video games*, Game Developer, 27 février 2014.
  Article de praticien, pas essai expérimental.
  [Lire](https://www.gamedeveloper.com/design/user-interface-design-in-video-games)
- **[S5]** Erik Fagerholt et Magnus Lorentzon, *Beyond the HUD — User Interfaces for Increased Player
  Immersion in FPS Games*, mémoire de master, Chalmers, 2009. Notice et résumé consultés ; le texte
  intégral du mémoire n'a pas été analysé dans cet audit.
  [Notice](https://odr.chalmers.se/items/d5fe6889-4cc6-49c2-ba56-0d759e2f37eb)
- **[S6]** Kristine Jørgensen, *Gameworld Interfaces*, MIT Press, 2013. Présentation éditoriale consultée.
  [Notice](https://mitpress.mit.edu/9780262026864/gameworld-interfaces/)
- **[S7]** John M. Joyce, Mark J. Campbell, Fazilat Hojaji et Adam J. Toth, *Less Is More: Higher-Skilled
  Sim Racers Allocate Significantly Less Attention to the Track Relative to the Display Features than
  Lower-Skilled Sim Racers*, **Vision**, 8(2), 27, 2024. Texte de l'article consulté.
  [Article et DOI](https://www.mdpi.com/2411-5150/8/2/27)
- **[S8]** Microsoft, Xbox Accessibility Guideline 101, *Text display*.
  [Lire](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/101)
- **[S9]** Microsoft, Xbox Accessibility Guideline 102, *Contrast*.
  [Lire](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/102)
- **[S10]** Microsoft, Xbox Accessibility Guideline 103, *Additional channels for visual and audio cues*.
  [Lire](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/103)
- **[S11]** Microsoft, Xbox Accessibility Guideline 109, *Objective clarity*.
  [Lire](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/109)

Les pages d'entretien Circuit Superstars recherchées n'ont pas fourni de contenu exploitable
(article absent du HTML ou vérification de navigateur) : elles ne fondent aucune conclusion ici.
