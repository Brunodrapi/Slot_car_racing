// Vehicle model. The car is a free body: it has a heading (where it points) and a velocity
// (where it goes), and the two only coincide while the tyres have grip to spare.
//
//   track line  →  desired steering (pure pursuit)  →  yaw acceleration  →  yaw rate  →  heading
//
// The line is an intention. The autopilot only produces a steering angle; position and rotation
// always come out of the physics. Past the limit the car understeers first (it turns less than
// asked and runs wide), the tyres let go progressively, and grip comes back progressively too.
// Nothing is ever snapped back onto the line, on or off the road.
'use strict';

/* L'usure et les dommages, en option et en course seulement.

CE QUE FAIT L'USURE. Un pneu s'use en roulant, et beaucoup plus vite en glissant : c'est le
frottement qui l'arrache, pas les kilomètres. La glisse compte donc au carré — rouler proprement
coûte peu, tenir un travers coûte cher. C'est la seule chose qui rende un choix intéressant :
attaquer maintenant et s'arrêter plus tôt, ou ménager la gomme et tenir jusqu'au bout.

CE QU'ON MESURE, ET LA PREMIÈRE VERSION QUI NE MESURAIT RIEN. J'avais fait dépendre l'usure de la
seule glisse, au carré. Mesuré sur une course : `slide` vaut 0,007 à 0,021 de MOYENNE selon le
niveau, et sa médiane est zéro — une voiture bien conduite ne glisse presque jamais. Le terme était
cent à trois cents fois trop petit pour peser, et l'usure ne dépendait donc pas du tout du
pilotage, ce que l'outil a montré aussitôt : demi-usure au tour 4 ou 5, identique du niveau facile
au cauchemar.

Ce qui use un pneu est le TRAVAIL DE FROTTEMENT, pas le spectacle. `usage` — la demande d'adhérence
latérale rapportée à ce que les pneus peuvent donner — vaut 0,455 en facile et 0,568 en extrême :
voilà la grandeur qui sépare un pilote propre d'un pilote qui attaque, et elle est déjà calculée à
chaque pas. Elle entre au carré, parce que le frottement croît comme le carré de la charge. La
glisse reste, mais comme SURCOÛT : quand elle arrive, elle coûte très cher.

LE MINUTAGE, pris sur Circuit Superstars. Un train doit tenir une course courte quand on roule
proprement, et mourir en deux ou trois tours quand on martyrise la gomme — sans quoi il n'y a
qu'une stratégie, et autant ne pas offrir le choix. Sur des tours de quatre-vingts secondes :
mi-usure vers le huitième tour en roulant propre, vers le troisième en attaquant.

CE QUE FONT LES DOMMAGES. Ils ne touchent pas l'adhérence, mais la vitesse de pointe et la
reprise : une voiture cabossée traîne, elle ne devient pas dangereuse. C'est volontaire — un
dommage qui enlèverait du grip punirait deux fois, et rendrait une course irrattrapable après un
seul accrochage. */
const USURE = {
  charge: 0.0027,    // par seconde et par unité de demande d'adhérence au carré
  glisse: 0.038,     // par seconde et par unité de glisse — le surcoût du travers
  grip: 0.26,        // adhérence perdue sur un train mort
  /* Un frottement n'est pas un choc. Sans seuil, un peloton lent qui se tasse en épingle se
  détruisait tout seul : 49 % de tôle au niveau facile, contre 10 % en difficile — l'inverse de ce
  qu'on attend, et uniquement parce que les voitures lentes se touchent sans arrêt. On ne compte
  donc que ce qui dépasse quelques mètres par seconde d'écart. */
  chocSeuil: 3.5,          // m/s d'écart en dessous desquels un contact ne casse rien
  chocParVitesse: 0.018,   // dommage par m/s au-delà du seuil
  /* Une sortie de route n'est pas un accident. À 0,004 par m/s, quitter la piste à 60 m/s coûtait
  24 % de la voiture, et quatre excursions la détruisaient : mesuré, un pilote qui attaque finissait
  à 95 % de tôle, donc avec vingt pour cent de vitesse en moins, pour des fautes dont aucune n'était
  un choc. Un passage dans l'herbe fait perdre du temps ; c'est déjà la punition. */
  sortieParVitesse: 0.0012, // dommage par m/s à l'instant où on quitte la piste
  vmax: 0.18,        // vitesse de pointe perdue sur une voiture au maximum des dommages
};

/* L'arrêt au stand.

Ce qu'il coûte est le cœur du réglage. Trop court, il n'y a aucune raison de ne pas s'arrêter ;
trop long, il n'y en a aucune de s'arrêter. Le compte est : la voie parcourue à vitesse limitée au
lieu de la piste à pleine vitesse, plus le temps à l'arrêt. Sur nos circuits cela fait une dizaine
de secondes perdues — à comparer aux 3,5 % du tour que coûte un train usé, soit près de trois
secondes par tour. L'arrêt se rembourse donc en trois ou quatre tours, ce qui le rend payant dans
une course longue et perdant dans une course courte : c'est exactement le choix qu'on veut offrir.

La limitation de vitesse n'est pas décorative. Sans elle, la voie des stands serait un raccourci —
elle coupe légèrement par l'extérieur — et tout le monde s'y arrêterait à chaque tour. */
const STAND = {
  vitesse: 22,       // m/s dans la voie, environ 80 km/h
  service: 3.2,      // secondes à l'arrêt dans la case
  seuilArret: 3,     // m/s en dessous desquels on considère la voiture arrêtée dans la case
  demiBoite: 9,      // demi-longueur de la case d'arrêt, en mètres
};

/* Fastest speed for curvature magnitude k on a given model (accounts for downforce).

`boost` est la triche du niveau extrême : un supplément d'adhérence MÉCANIQUE, réservé aux voitures
de l'IA. L'appui (`df`) n'y touche pas, parce que ce n'est pas la même chose — l'appui est une force
qui dépend de la vitesse, l'adhérence est ce que le pneu peut rendre. Donner plus de pneu à un
pilote lui permet de tourner plus vite partout ; lui donner plus d'appui ne l'aiderait qu'en courbe
rapide, ce qui n'est pas ce qu'on cherche. */
function cornerSpeedFor(c, k, boost = 1) {
  if (k < 1e-5) return Infinity;
  const g = c.grip * boost;
  const capped = Math.sqrt(2.8 * g / k);
  if (k - c.df > 1e-6) return Math.min(Math.sqrt(g / (k - c.df)), capped);
  return capped;
}

// Reference speed profile along a line: corner limit, then a backward pass limited by braking
// and a forward pass limited by acceleration (classic racing-line speed profile).
function speedProfile(track, model, lineName, margin) {
  const N = track.n, ds = track.ds, lineK = track.lineK[lineName];
  const v = new Float32Array(N);
  const m = margin == null ? 1 : margin;
  for (let i = 0; i < N; i++) v[i] = Math.min(model.vmax, cornerSpeedFor(model, Math.abs(lineK[i])) * m);
  const brake = model.brake * 0.9;
  for (let pass = 0; pass < 2; pass++) for (let i = N - 1; i >= 0; i--) {
    const j = (i + 1) % N;
    const lim = Math.sqrt(v[j] * v[j] + 2 * brake * ds);
    if (lim < v[i]) v[i] = lim;
  }
  /* LA PASSE D'ACCÉLÉRATION RESPECTE LE CERCLE D'ADHÉRENCE.

  Elle appliquait toute la poussée du moteur, y compris au milieu d'un virage pris à la limite —
  c'est-à-dire qu'elle supposait un pneu capable de donner son adhérence latérale maximale ET de
  passer la puissance en même temps. C'était déjà optimiste ; depuis que l'arrière accumule sa
  glisse quand on lui demande les deux, c'est faux, et cela se voyait : le banc des sorties
  comparait un tour théorique de 77 secondes à un tour réel de 94, et concluait que la référence
  était fausse. Elle l'était.

  Ce qui reste pour avancer est ce que le cercle laisse une fois la part latérale prise. C'est la
  même règle que celle que la physique applique à la voiture, écrite ici en une ligne parce qu'on
  ne cherche qu'une référence, pas un modèle de pneu. */
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) {
    const j = (i - 1 + N) % N;
    const moteur = model.accel * driveFactor(model,v[j]) * Math.max(0.15, 1 - Math.pow(v[j] / model.vmax, 2.5));
    const lat = v[j] * v[j] * Math.abs(lineK[j]) / Math.max(1e-3, model.grip);
    const a = Math.max(0.05, moteur * Math.sqrt(Math.max(0, 1 - Math.min(1, lat) ** 2)));
    const lim = Math.sqrt(v[j] * v[j] + 2 * a * ds);
    if (lim < v[i]) v[i] = lim;
  }
  return v;
}

// tuning knobs (multipliers), exposed so the diagnostic tools can sweep them
/* Ce que rend un vibreur, comparé à l'asphalte.

Ni 1 ni 0,42. À 1 la bande serait deux mètres de route gratuits dans chaque virage : toutes les
vitesses de passage monteraient, et la mesure des planchers — le temps minimum qu'un serveur accepte
— ne décrirait plus le jeu. À 0,42 ce serait du gravier, c'est-à-dire ce qu'on vient de corriger.
0,88 laisse s'appuyer dessus et décourage de s'y installer : un appui court ne coûte presque rien,
deux roues dedans sur tout le virage coûte le virage. */
const KERB_ADHERENCE = 0.88;

/* LE REBOND SUR UNE PROTECTION — les nombres du trampoline. Voir `_barrierContact`.

   `rebond` et `douceur` ensemble font une courbe en cloche : la vitesse renvoyée vaut
   `v · rebond · e^(−v/douceur)`, donc elle monte avec la vitesse d'impact, passe par un maximum
   vers 9 m/s, puis redescend. C'est volontaire et c'est ce qui rend le rebond jouable : sous le
   maximum, plus on tape fort plus on est renvoyé loin — ce qui aide à se dégager ; au-delà, taper
   plus fort ne sert plus à rien, ce qui empêche le mur de devenir un tremplin à exploiter.

   `glisseRail` et `glissePneus` disent ce qu'il reste de la vitesse LE LONG du mur, celle qui ne
   tape pas : un rail d'acier laisse filer, un empilement de pneus accroche. C'est la différence
   qu'on sent entre frotter une glissière et s'enfoncer dans les pneus.

   `seuil` est la vitesse normale en dessous de laquelle le moteur ne se coupe plus : en dessous ce
   n'est pas un accident, c'est un frottement. */
const BARRIERE = { rebond: 1.05, douceur: 9, pneus: 0.62, glisseRail: 0.78, glissePneus: 0.52,
  lacet: 0.35, seuil: 5 };

// Temps caractéristique de décélération en roue libre, moteur coupé : la voiture roule encore,
// mais elle s'arrête en deux secondes environ, sans qu'on ait à la figer.
const ARRET_LIBRE = 0.55;

const PHYS = { aimant: 0, ldK: 0.45, ldMin: 6, ff: 0.3, slip: 1, cliff: 1, steerRate: 6, yawK: 2, wLim: 0.95, selRate: 0.7, liftOff: 0.16, motricite: 1.25, drivePriority: 0.15, relax: 0.2, circle: 0.25 };

/* LES AIDES DE L'IA, qui ne sont pas celles du joueur.

`PHYS.aimant` et `PHYS.ff` portent ce que LE JOUEUR a choisi dans les réglages. Les rivales n'ont
aucune raison d'en hériter : elles ne choisissent rien, et elles roulent mal — « elles roulent
doucement et sont assez mauvaises ». On leur donne donc une configuration fixe, celle que la mesure
a trouvée la meilleure : l'aimant au cran normal, qui leur supprime les tête-à-queue, et
l'anticipation au défaut, qui les empêche de couper la corde.

LE DÉPARTAGE SE FAIT SUR LA VOITURE, PAS SUR QUI LA CONDUIT. `isPlayer` est posé à la construction,
alors que `aiDriven` se recalcule à chaque image et vaut vrai pour la voiture du joueur dès que
l'autopilote la pilote — ce qui est le cas de tous les bancs. Se brancher dessus aurait donné les
aides de l'IA à la voiture mesurée, et rendu incomparables tous les relevés d'avant. Un adversaire
humain en réseau n'y a pas droit non plus : il choisit, lui. */
const AIDES_IA = { aimant: 1, ff: 0.3 };

/* LES BORNES DU RÉGLAGE DE FREIN, et pourquoi elles vivent ICI.

Elles décrivent ce que la physique accepte, donc leur place est avec la physique. Mais la raison
concrète est plus bête et plus solide : `js/race.js` s'en sert à la construction de la grille, et
les bancs chargent `car.js` sans charger `career.js`. Les poser dans `career.js` — où vit le reste
des configurations — faisait planter tous les bancs sur une référence absente.

0,5 et 1,6 encadrent ce qui a été mesuré : en dessous de 0,65 aucun tour n'est bouclé sur les trois
circuits d'essai, et au-dessus de 1,6 la vitesse de passage ne descend plus, elle a déjà touché le
fond. Laisser aller plus loin ne proposerait que des réglages dont on sait qu'ils ne servent à rien. */
const FREIN_MIN = 0.5, FREIN_MAX = 1.6;

/* LA MOTRICITÉ DANS LE TEMPS, ET NON SEULEMENT DANS L'INSTANT.

   Le partage d'adhérence arrière était SANS MÉMOIRE : à chaque image, la perte ne dépendait que
   de la demande du moment. Un appui d'un dixième de seconde et un appui tenu dix secondes se
   payaient donc au même tarif, à la seconde près — tenir les gaz à fond dans un virage coûtait
   exactement la moyenne de ce qu'il coûte, et le pilote n'avait rien à doser. Bruno l'a dit sans
   détour : « il n'y a pas besoin de réguler l'accélération en appuyant, la voiture s'auto-régule.
   En slot racing quand tu accélères à fond en virage, la voiture dérape. Il faut un mécanisme
   d'à-coups rapides pour réguler la vitesse. »

   L'arrière a maintenant un état : tant que la poussée demandée dépasse ce que l'essieu peut
   passer, la glisse MONTE ; dès qu'on lève, elle redescend, et plus vite qu'elle n'est montée.
   Elle retire jusqu'à `perte` de l'adhérence latérale arrière, et c'est ce qui fait déraper.

   DEUX CHOSES ONT ÉTÉ MESURÉES AVANT D'ARRIVER LÀ, et la première version les ignorait toutes
   les deux. Le banc `tools/acoups.js` a tranché en une ligne : « LE DOSAGE NE SERT À RIEN ».

   D'abord, le dépassement du cercle d'adhérence est un signal FAIBLE. Dans un virage réel pris
   aux gaz, `1 − share` plafonne vers 0,14 : la montée en glisse s'arrêtait donc à 14 % et ne
   déclenchait jamais rien. Il est maintenant rapporté à `seuil`, qui est précisément l'ordre de
   grandeur atteint en virage à pleine charge — au-delà, la glisse monte pour de bon.

   Ensuite, faire varier `priorite` ne suffisait pas. Même poussée à 0,45, elle ne retirait que
   six pour cent d'adhérence arrière, parce qu'elle multiplie `share`, qui vaut encore 0,86 à cet
   endroit. La glisse accumulée agit donc directement, par son propre terme, et `priorite`
   redevient la constante que les mesures de `docs/motricite/README.md` avaient fixée.

   Les deux constantes de temps font le reste. Une impulsion de 100 ms monte à 36 %, et il n'en
   reste que 13 % après 100 ms de pied levé ; des à-coups à parts égales se stabilisent vers 25 %,
   tandis que les gaz tenus saturent en une demi-seconde. Doser rapporte donc la moitié de la
   poussée pour le quart de la perte d'adhérence — un geste qui s'apprend, ce qu'un modèle sans
   mémoire ne pouvait pas offrir. */
const MOTRICITE = { tauMontee: 0.22, tauRetour: 0.10, seuil: 0.12, perte: 0.38 };

// Les deux seuils où l'IA lève et reprend les gaz : voir `aiThrottle`. Reprendre bien plus bas
// qu'on ne lève est ce qui fait un à-coup plutôt qu'un tremblement.
const AI_GLISSE = [0.28, 0.55];

// La part d'adhérence au-delà de laquelle l'IA n'ajoute plus de puissance : voir `aiThrottle`.
const AI_USAGE = 0.8;

/* LE TRANSFERT DE MASSE AU FREINAGE, qui est ce qui fait enrouler un virage.

   `PHYS.liftOff` valait 0,01 : lever le pied retirait un centième de l'adhérence arrière, soit
   rien du tout. Le réglage de freinage ne servait donc qu'à s'arrêter plus ou moins court, jamais
   à placer la voiture — alors que c'est précisément ce qu'on demande d'un réglage de frein.

   Freiner charge l'avant et allège l'arrière. L'avant gagne donc ce que l'arrière perd, à peu
   près, et la voiture pivote : c'est le frein à l'entrée qui referme la trajectoire. Le réglage
   du joueur multiplie ce transfert, et non plus seulement la décélération, si bien que monter le
   levier fait tourner plus court — au prix d'un arrière plus léger, qu'il faut ensuite rattraper. */
const TRANSFERT_AV = 0.62;

/* L'AIMANT : une tension vers la ligne, et un décrochage net.

L'idée est de Bruno, et elle répond à ce que la mesure dit du modèle actuel. Trois leviers ont été
essayés pour que les voitures tournent plus court, et les trois ne donnent rien : ouvrir la butée de
braquage de 29° à 52° gagne 0,4 m de rayon minimum, ouvrir le plafond de dérive avant de 1,3 à 3,5
fois le pic n'en gagne aucun, et rapetisser les voitures à l'échelle des circuits coûte des sorties
de piste. La raison tient en une ligne, `clamp(alphaF / peak, -1, 1)` : AU-DELÀ DU PIC, PLUS D'ANGLE
NE DONNE PLUS DE FORCE. Le pneu avant a déjà tout donné, le pilote peut demander ce qu'il veut.

Le seul paramètre qui achète de la capacité à tourner est donc l'adhérence — mais la monter
globalement déplacerait chaque point de freinage, puisque `speedProfile` lit `gripAt`, et avec eux
les douze listes d'annonces posées à la main. L'aimant est une hausse d'adhérence LOCALISÉE : une
force ajoutée dans `update`, jamais dans `gripAt`, donc le profil de vitesse et les annonces ne
bougent pas d'un mètre.

Et il soigne les deux symptômes d'un coup. Posé sur l'ESSIEU AVANT, il tire le nez vers la ligne et
crée un couple de lacet dans le même sens : c'est le sous-virage. Avec un seuil de décrochage, il
ajoute l'INSTANT qui manque — aujourd'hui la dérive monte à soixante-huit degrés sur trois secondes
et on ne sait jamais quand ça a lâché.

L'HYSTÉRÉSIS EST ASYMÉTRIQUE, et c'est le point à ne pas rater : facile à retrouver, net à perdre.
Si l'aimant raccroche au seuil même où il lâche, on obtient un oscillateur accroche-décroche, pire
que le flou qu'on voulait enlever. On lâche donc quand la demande dépasse le plafond, et on ne
reprend qu'une fois bien revenu dessous ET l'arrière redevenu sage. */
/* UN RESSORT SANS AMORTISSEUR EST UN OSCILLATEUR, et la première version l'a prouvé.

Tension proportionnelle au seul écart, posée sur l'essieu avant : la M1 Procar est passée de 5,7° de
dérive à 70,8°, la 787B de 5,0° à 71,1°. Les deux voitures les plus saines du plateau devenaient
pires que celles qu'on voulait soigner, et l'écart à la ligne ne baissait même pas — 1,05 m contre
1,26 m, donc en hausse. C'était inévitable : une rétroaction sur la POSITION, couplée au lacet
qu'elle crée elle-même, est un double intégrateur en phase arrière. Il oscille.

`c` est donc l'amortisseur : il s'oppose à la VITESSE d'éloignement, pas à l'éloignement. Et
`avant` partage la tension entre les deux essieux — tout à l'avant donne le plus de pouvoir
directionnel mais aussi le plus de couple de lacet, donc le plus d'oscillation. */
/* OÙ MORD L'AIMANT : AU CENTRE, ET LE NEZ EST LE PIRE ENDROIT — mesuré jusqu'au bout.

Bruno a montré le châssis d'un slot car BRM : le guide est à la pointe avant, bien devant l'essieu,
et il demandait l'aimant là. Le paramètre d'alors ne savait pas y aller — il interpolait entre les
deux essieux, donc « tout à l'avant » voulait dire « sur l'essieu avant » et rien de plus loin. Il a
été refait en distance pour que la question soit posable, puis balayée du centre au nez, avec le
critère qui voit vraiment les demi-tours (l'écart de cap, non borné) et un pilote qui freine tard.

935, pilote tardif, trois tours sur Zandvoort, Monaco et Suzuka :

  où mord l'aimant        demi-tours   sorties   écart du NEZ   tour
  éteint                       6          1         0,76 m     97,2 s
  0    (centre de gravité)     0          0         0,47 m     95,5 s
  0,7                          0          0         0,56 m     95,8 s
  1,35 (essieu avant)          9          4         0,71 m     98,4 s
  1,8                         12         12         0,95 m    101,8 s
  2,25 (le nez)               12         20         1,02 m    103,7 s

Monotone, et sur les trois voitures essayées : au nez c'est PIRE QUE SANS AIMANT, y compris sur
l'écart du nez lui-même, que le guide est pourtant censé tenir. La M1 Procar, qui ne part jamais,
y fait neuf demi-tours.

LA RAISON EST QU'UNE FORCE N'EST PAS UNE CONTRAINTE. Le guide d'un vrai slot car ne peut pas sortir
de la rainure : sa raideur est infinie, le couple qu'il encaisse n'a pas de plafond, et le nez est
tenu quoi qu'il arrive — c'est pour ça que l'arrière peut chasser sans que la voiture pivote. Une
force, elle, sature à son plafond, et le moment qu'elle crée au bout d'un long bras FAIT TOURNER la
voiture avant de la déplacer : la rotation emmène le nez, ce qui augmente l'écart, ce qui augmente la
force. C'est une boucle positive, et plus le bras est long plus elle est rapide.

Reproduire un vrai guide demanderait de le poser en CONTRAINTE et non en force : imposer la position
latérale du nez sur la ligne, laisser la queue libre, et déverrouiller au-delà d'un effort. Ce n'est
pas le même objet, et ce n'est pas ce qui est écrit ici. */
const AIMANT = {
  k: 1.4,          // raideur : accélération latérale par mètre d'écart à la ligne
  c: 1.0,          // amortissement : par mètre par seconde d'éloignement
  devant: 0,       // où mord l'aimant : mètres DEVANT le centre de gravité (voir plus bas)
  max: 0.3,        // plafond de la tension, en fraction de l'adhérence totale
  lache: 1.0,      // on décroche quand la demande dépasse le plafond
  reprend: 0.5,    // on ne raccroche qu'à la moitié du plafond
  derive: 1.3,     // ... et seulement si l'arrière est revenu sous ce multiple de son pic
};

/* LE GUIDE DE SLOT CAR EN CONTRAINTE : SIX TENTATIVES, AUCUNE QUI TIENNE. Essai abandonné, et le
chemin noté ici pour que la prochaine tentative ne le refasse pas.

On cherchait ce que l'aimant ne sait pas donner : de la glisse SANS tête-à-queue. L'aimant y arrive
en réduisant la glisse à vingt-deux degrés ; un guide la laisserait entière, puisque le nez ne peut
pas sortir de la rainure. Dans l'ordre, et ce que la mesure a dit de chacune :

  1. Contrainte en vitesse, impulsion répartie entre la vitesse latérale ET le lacet : elle perturbait
     la rotation que les pneus venaient de calculer. Bras de fer à soixante hertz, cent seize
     demi-tours en trois tours quand on la laissait tenir.
  2. Rappel divisé par trois et plafonné, soupçonnant un dosage : les sorties ont AUGMENTÉ.
  3. Pivot autour du guide (moment pris au guide, inertie k² + g²) et vitesse latérale POSÉE au lieu
     d'être négociée : zéro demi-tour, dérive intacte à soixante-treize degrés — le bon comportement.
     Sauf que le guide ne tenait que QUATRE À TREIZE POUR CENT DU TEMPS : le résultat n'était pas le
     sien.
  4. Position épinglée sur la ligne à chaque image : six à quinze pour cent. Pas le verrou non plus.
  5. Effort lissé sur un dixième de seconde, puisqu'on comparait une impulsion — une différence de
     vitesse divisée par dt — à un seuil d'adhérence : zéro à trois pour cent, donc pire, le lissage
     donnant de la mémoire à un effort déjà trop élevé.
  6. Raccrochage géométrique au lieu d'un raccrochage sur la force, l'ancienne condition se mordant la
     queue : loin de la ligne, la demande pour y revenir est énorme, donc l'effort reste haut, donc on
     ne raccroche jamais. Le temps en rainure est monté à QUATRE-VINGTS POUR CENT — mais la voiture se
     retrouvait à vingt-huit mètres de la ligne, cap à cent quatre-vingts degrés, cent cinquante
     sorties. Sans l'épinglage, encore six mètres d'écart et des tours à cent vingt secondes.

POURQUOI AUCUNE NE TIENT : la contrainte s'applique APRÈS l'intégration des forces des pneus, et
ceux-ci répondent à l'image suivante à un état qu'ils n'ont pas produit. Il faudrait les résoudre
dans le même système, ou traiter la voiture guidée comme un système à deux degrés de liberté —
l'abscisse le long du rail et le cap, la position latérale esclave — au lieu d'intégrer librement
puis de corriger. Ce n'est pas un réglage, c'est un autre intégrateur.

Et une leçon de banc : UN TAUX DE TRANSITION N'EST PAS UNE DURÉE. « Vingt sauts par minute » est
compatible avec « dehors quatre-vingt-quinze pour cent du temps », et c'est Bruno qui l'a vu en
roulant — « le guide est tout le temps sauté » — bien avant que le banc le mesure. */

const wrapAngle = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const smoothstep = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

class Car {
  constructor(track, model, opts) {
    this.track = track;
    this.cls = model;
    this.name = opts.name || 'Driver';
    this.livery = opts.livery;
    // l'indice de la livrée DESSINÉE, parmi celles que le modèle déclare (voir `js/cars.js`)
    this.livree = opts.livree || 0;
    this.isPlayer = !!opts.isPlayer;
    this.skill = opts.skill == null ? 0.5 : opts.skill;
    /* La triche du niveau extrême, et elle ne concerne QUE l'IA.

    Au niveau difficile, la marge de l'IA vaut déjà 0,99 et `aiThrottle` la plafonne à 0,98 : elle
    roule à deux pour cent du maximum physique de sa voiture. Il n'y a plus rien à prendre de ce
    côté — pousser la marge au-dessus du plafond ne fait pas rouler plus vite, cela fait sortir.
    Pour aller plus vite il faut donc déplacer le maximum lui-même, c'est-à-dire tricher. C'est
    assumé et c'est le nom du niveau qui le dit.

    Un multiplicateur d'adhérence est la forme honnête de cette triche : il vaut partout, il ne
    crée aucun comportement que la physique ne sait pas produire, et la voiture reste capable de
    sortir si elle en demande trop. Le joueur, lui, garde exactement sa voiture. */
    this.gripBoost = opts.gripBoost == null ? 1 : opts.gripBoost;
    /* `usure` est le réglage, ou `null` quand l'option est coupée. Le distinguer d'un booléen
    permet de couper la fonctionnalité SANS toucher au reste du code : `tyre` et `damage` existent
    toujours, ils ne bougent simplement jamais, et tout ce qui les lit trouve 1 et 0. */
    this.usure = opts.usure || null;
    this.tyre = 1;      // 1 = neuf, 0 = mort
    this.damage = 0;    // 0 = intact, 1 = épave
    this.pitsDone = 0;
    /* `pitAsk` est l'INTENTION, `sel` reste la ligne.

    La coche supplémentaire du levier aurait pu se coder comme une valeur de `sel` en dessous de
    -1, et c'est d'ailleurs ce que `targetLat` sait faire. Mais `sel` est borné à [-1, 1] par la
    course, par le réseau et par le choix de ligne de l'IA — trois endroits qui auraient tous dû
    apprendre qu'une quatrième valeur existe, et qui l'écrasaient silencieusement. Le levier reste
    un seul contrôle pour le joueur ; à l'intérieur, l'intention est un drapeau. */
    this.pitAsk = false;
    this.pitState = null;   // null | 'voie' | 'arret'
    this.pitServi = false;  // déjà servi durant ce passage dans la voie
    this.pitT = 0;          // temps restant de service
    this.inPit = false;     // dans le couloir, donc hors piste sans être hors piste
    this.number = opts.number || 1;

    // track bookkeeping (derived from the world position every step)
    this.s = opts.s || 0;
    this.lat = opts.lat || 0;
    // world state
    const P = track.pos(this.s, this.lat);
    this.x = P.x; this.y = P.y;
    this.th = track.headingAt(this.s);   // heading (forward)
    this.v = 0;                          // forward speed, body x
    this.vl = 0;                         // lateral speed, body y (+ = left)
    this.w = 0;                          // yaw rate
    this.delta = 0;                      // steering angle
    this.beta = 0;                       // slip angle between heading and velocity
    this.usage = 0;                      // lateral demand / available grip
    this.Ff = 0; this.Fr = 0;            // lateral force (per unit mass) of the front / rear axle
    this.alphaF = 0; this.alphaR = 0;
    this.slide = 0;                      // 0..1 for effects
    this.patine = 0;                     // 0..1 : la part de poussée que l'arrière ne passe pas
    this.glisseArr = 0;                  // 0..1 : la glisse accumulée par l'essieu arrière
    this.aiLeve = false;                 // l'IA a levé le pied le temps que l'arrière reprenne
    this.freinRatio = 1;                 // le réglage de freinage du joueur, 1 = d'origine
    this.patineFx = 0;                   // retour sonore/visuel, sans effet sur les forces
    this.ressenti = 0;                   // 0..1 : bleu, vert, jaune, violet, rouge (voir update)
    this.accroche = true;                // l'aimant tient-il la ligne ? (voir AIMANT)
    this.ecartAv = null;                 // l'écart de l'image d'avant, pour l'amortissement
    this.aimantF = 0;                    // la tension du moment, pour la télémétrie
    this.state = 'ok';                   // ok | grass
    this.grassT = 0;
    this.rejoined = 0;
    this.crashes = 0;
    this.engineCut = 0; this.engineStopped = false; this.barrierHits = 0;
    this.lastBarrierImpact = null;

    this.sel = 0;                        // line selection -1..1 (driver's intention)
    this.selS = 0;                       // the same, eased: a driver moves across the road, he does not teleport
    this.laneTarget = 0;
    this.gridLat = null;
    this.passSide = 0;
    this.passTimer = 0;
    this.blocker = null;
    this.voisin = null;
    this.draft = false;

    this.started = false;
    this.checkpoint = false;
    this.lap = 0;
    this.lapTimes = [];
    // Un tour sali par une sortie de piste garde son chrono — on l'affiche barré — mais il ne peut
    // pas devenir un meilleur tour. Sans la liste, l'écran des résultats ne pourrait pas dire
    // POURQUOI un tour plus rapide que le meilleur n'est pas le meilleur.
    this.lapOk = [];
    this.lapSale = false;
    this.fautes = 0;
    this.surKerb = false;
    /* Le temps repris aux sorties de piste, et la sortie en cours. Tenus par `Race`, qui est la
    seule à connaître le profil de vitesse de la ligne — donc ce que les mètres avalés hors piste
    auraient coûté dessus. Voir `Race._comptePenalite`. */
    this.repris = 0;
    /* `sortieT` et non `offT` : ce dernier existe déjà quelques lignes plus bas et mesure depuis
    combien de temps le PIED EST LEVÉ, ce qui commande le freinage. Les deux ont cohabité le temps
    d'un essai : `js/car.js` remettait le compteur à zéro à chaque coup de gaz et l'incrémentait une
    seconde fois à chaque pas pied levé, si bien que la pénalité d'une sortie se calculait sur un
    temps faux — doublé dans un cas, effacé dans l'autre. Un nom repris en silence ne se voit nulle
    part ; c'est `tools/sortie.js` qui l'a attrapé, en mesurant 2,97 s là où 1,48 s s'étaient
    écoulées. */
    this.sortieS0 = null;
    this.sortieT = 0;
    this.sortieI = 0;
    this.bestLap = null;
    /* Le meilleur tour SANS condition, à côté du meilleur tour propre.

    Les deux ne répondent pas à la même question et les confondre casse l'une ou l'autre. Un record
    doit être propre : c'est `bestLap`. Un PLANCHER — le temps en dessous duquel le serveur refuse un
    envoi — doit au contraire être le plus bas que la physique autorise, coupes comprises, sinon il
    refuserait des tours réels. `tools/plancher.js` mesure avec l'IA en cauchemar, qui sort au moins
    une fois par tour : sur `bestLap` seul elle ne rendait plus rien du tout. */
    this.bestLapBrut = null;
    this.lapStart = 0;
    this.finished = false;
    this.finishTime = null;
    this.throttle = false;
    this.offT = 0;
    this.braking = false;
    this.aiTimer = Math.random() * 0.15;
    this.aiNoise = 0;
    this.aiAllow = Infinity;
  }

  // put the car on the track at (s, lat), pointing along the road, at a given speed (default: at rest)
  place(s, lat, v) {
    const T = this.track, P = T.pos(s, lat);
    this.s = T.wrap(s); this.lat = lat; this.x = P.x; this.y = P.y; this.th = T.headingAt(s);
    this.v = v || 0; this.vl = 0; this.w = 0; this.delta = 0; this.beta = 0; this.usage = 0; this.slide = 0; this.ressenti = 0; this.Ff = 0; this.Fr = 0; this.selS = this.sel; this.accroche = true; this.aimantF = 0; this.ecartAv = null;
    this.patine = 0; this.patineFx = 0; this.glisseArr = 0;
    this.engineCut = 0; this.engineStopped = false;
  }

  /* Ce que les pneus rendent, entre neuf et mort. Séparé de `gripBoost` parce que les deux n'ont
  rien à voir : l'un est la triche des niveaux extrêmes, réservée à l'IA, l'autre est l'usure, qui
  vaut pour tout le monde. Les multiplier est juste ; les confondre aurait été une erreur à
  débusquer six semaines plus tard. */
  tyreGrip() { return this.usure ? 1 - this.usure.grip * (1 - this.tyre) : 1; }

  /* Les aides qui s'appliquent à CETTE voiture : les siennes au joueur, celles de l'IA aux rivales. */
  get aides() { return this.isPlayer || this.human != null ? PHYS : AIDES_IA; }

  gripAt(v) {
    const c = this.cls, g = c.grip * this.gripBoost * this.tyreGrip();
    return g + Math.min(c.df * v * v, g * 1.8);
  }
  cornerSpeed(k) { return cornerSpeedFor(this.cls, k, this.gripBoost * this.tyreGrip()); }

  // une voiture cabossée traîne : elle perd de la pointe et de la reprise, jamais de l'adhérence
  damageFactor() { return this.usure ? 1 - this.usure.vmax * this.damage : 1; }

  get progress() { return (this.lap - (this.started ? 0 : 1)) * this.track.length + this.track.wrap(this.s); }
  get pos() { return { x: this.x, y: this.y }; }
  get heading() { return this.th; }
  get steerAngle() { return this.delta; }
  get drift() { return this.beta; }
  get loadRatio() { return this.usage; }
  // Calculé depuis la position : fonctionne aussi avec les instantanés réseau.
  get runoffAsphalt() { return !!this.track.asphaltW && this.track.runoffSurfaceAt(this.s, this.lat) === 'asphalt'; }
  get speed() { return Math.hypot(this.v, this.vl); }

  _advance(ds, raceTime) {
    const T = this.track;
    const before = T.wrap(this.s);
    const after = before + ds;
    // half-way checkpoint: a lap only counts after really going round, not by rocking over the line
    if (before < T.length / 2 && after >= T.length / 2) this.checkpoint = true;
    if (after >= T.length) {
      if (!this.checkpoint && this.started) { this.s = T.wrap(after); return; }
      this.checkpoint = false;
      if (this.started) {
        const lt = raceTime - this.lapStart, propre = !this.lapSale;
        this.lapTimes.push(lt);
        this.lapOk.push(propre);
        if (propre && (this.bestLap == null || lt < this.bestLap)) this.bestLap = lt;
        if (this.bestLapBrut == null || lt < this.bestLapBrut) this.bestLapBrut = lt;
        this.lap++;
        this.lapSale = false;
      } else {
        this.started = true;
        // une sortie avant la ligne de départ ne salit pas le premier tour : il n'a pas commencé
        this.lapSale = false;
      }
      this.lapStart = raceTime;
    }
    this.s = T.wrap(after);
  }

  // ---------- autopilot: pure pursuit on the selected line ----------
  _desiredCurvature() {
    const T = this.track;
    const sp = Math.max(0, this.v);
    const Ld = clamp(PHYS.ldK * sp + 4, PHYS.ldMin, 45);
    const sAhead = this.s + Ld;
    const latT = this.gridLat != null ? this.gridLat : T.targetLat(sAhead, this.selS);
    const P = T.pos(sAhead, latT);
    const dx = P.x - this.x, dy = P.y - this.y;
    const dist = Math.hypot(dx, dy) || 1e-6;
    const alpha = wrapAngle(Math.atan2(dy, dx) - this.th);
    // target behind us (after a spin): full lock towards it, pure pursuit alone would give zero
    if (Math.abs(alpha) > Math.PI / 2) return Math.sign(alpha) * 0.25;
    const kPursuit = 2 * Math.sin(alpha) / dist;
    /* L'ANTICIPATION N'EST PAS UN SUPPLÉMENT, C'EST CE QUI MANQUAIT — et `ff` valait zéro.

    Le commentaire qu'il y avait ici disait « pure pursuit already contains the path curvature; ff
    only adds a lead on top of it ». C'est faux, et c'est ce qui a laissé le terme éteint. Un pure
    pursuit vise un point à Ld devant et va vers lui : sa courbure vaut 2·sin(α)/Ld, donc avec
    sin(α) = e/Ld elle vaut 2e/Ld². Pour commander la courbure d'un virage, il lui faut donc un écart
    PERMANENT e ≈ κ·Ld²/2 — il ne suit pas la ligne, il la coupe, et d'autant plus que le virage est
    serré. C'est un fait de géométrie du correcteur, pas un réglage à trouver, et la littérature le
    nomme : « the main issue is cutting corners since no curvature information is taken into account ».

    Bruno l'a vu en roulant, avant la mesure : « on dirait que le pilote a comme une latence pour
    prendre la ligne donc on est jamais sur la ligne idéale... il braque à fond alors que c'est déjà
    trop tard plutôt que d'y aller petit à petit ». Les deux moitiés de la phrase sont vraies, et la
    seconde découle de la première : l'écart s'accumule jusqu'à ce que α soit grand, et alors
    2·sin(α)/dist monte d'un coup.

    LA PREUVE EST DANS LE SIGNE, pas dans la moyenne. Un écart moyen peut être du bruit ; un écart
    toujours du même côté ne peut pas l'être. Biais vers l'intérieur du virage, trois tours sur
    Zandvoort, Monaco et Suzuka, en mètres :

                 ligne droite   virage large   virage serré   demi-tours   sorties
      ff 0,0  M1     +0,15          +0,54          +0,51           0          0
              935    +0,18          +0,71          +1,04           5          3
              911T   +0,16          +0,65          +1,14           3          4
      ff 0,5  M1     +0,06          +0,03          −0,28           0          0
              935    +0,09          +0,21          +0,04           4          0
              911T   +0,07          +0,16          +0,12           0          0

    Le 935 coupait d'un mètre quatre dans les virages serrés. À 0,5 le biais tombe sous vingt
    centimètres partout, les sorties de piste disparaissent sur les quatre voitures essayées, et les
    tours gagnent de trois dixièmes à une seconde et demie. Au-delà de 0,6 le pilote anticipe trop :
    le biais repasse de l'autre côté, et à 1,4 on retrouve huit demi-tours et onze sorties.

    Le compte des demi-tours reste bruité à cette taille d'échantillon (le 935 en fait 5, 1, 4 puis 2
    pour ff de 0 à 0,6) : la valeur est choisie sur le BIAIS et sur les sorties, qui eux sont
    monotones, et non sur lui.

    ET 0,5 OSCILLAIT, ce qu'aucun de ces chiffres ne disait. Bruno l'a senti en roulant : « avec le ff
    à 0.5 j'ai l'impression que la voiture oscille ». Un correcteur peut parfaitement se recentrer en
    moyenne tout en tremblant, et ni le biais ni les sorties ne le voient. La grandeur qui le voit est
    la SECOUSSE DU VOLANT, la valeur efficace de la vitesse de braquage :

                        M1    787B    935   911T     biais en virage serré (M1)
      ff 0            9°/s    9°/s  17°/s  17°/s            +0,62
      ff 0,3         22°/s   22°/s  27°/s  28°/s            +0,02
      ff 0,5         33°/s   32°/s  38°/s  37°/s            −0,29

    Presque quadruplé sur la M1. D'où 0,3 : il garde tout le bénéfice — le biais en virage serré y est
    à deux centimètres, le meilleur de toutes les valeurs essayées, et l'écart absolu y est le plus
    faible — pour la moitié de la secousse.

    LISSER DAVANTAGE LA COURBURE N'EST PAS LE REMÈDE, bien que ce fût la cause soupçonnée. `lineK` est
    une dérivée seconde d'une ligne échantillonnée, donc bruitée, et huit passes de lissage de plus
    font bien tomber la secousse de 33 à 14°/s. Mais elles ramènent le biais vers l'intérieur (+0,02 →
    +0,20 sur la M1, +0,29 → +0,42 sur le 935) et ajoutent deux à trois sorties de piste sur les
    voitures qui n'en faisaient aucune : la courbure étalée fait anticiper le mauvais virage. On garde
    donc le lissage d'origine et on baisse le gain.

    Vingt-deux degrés par seconde restent plus que les neuf du départ : anticiper, c'est bouger le
    volant plus tôt et davantage. C'est une réduction, pas une suppression. */
    const ff = this.aides.ff;
    const kFF = ff ? T.lineCurv(this.s + Ld * 0.4, this.selS) : 0;
    return clamp(kPursuit + ff * kFF, -0.25, 0.25);
  }

  _leaveTrack(withDamage = true) {
    if (this.state === 'grass') return;
    this.state = 'grass'; this.grassT = 0; this.crashes++; this.fautes++;
    this.lapSale = true;
    if (withDamage && this.usure)
      this.damage = clamp(this.damage + this.usure.sortieParVitesse * Math.abs(this.v), 0, 1);
  }

  /* LE CHOC CONTRE UNE PROTECTION, ET LE DROIT D'EN REPARTIR.

  La première version arrêtait tout : les trois vitesses à zéro, moteur coupé, et la voiture figée
  sur place jusqu'à la fin de la coupure. C'est juste pour un impact frontal — on tape, on s'arrête,
  on attend — mais c'était appliqué à TOUT contact, y compris au frottement en sortie de virage où
  l'aile effleure le rail. Bruno l'a dit comme on le ressent : « on colle à la barrière ».

  Et c'est exactement ce qui se passait. La vitesse le long du mur, celle qui n'a rien à voir avec
  le choc, était effacée elle aussi : une voiture qui glissait à soixante contre le rail s'y
  trouvait collée, à l'arrêt, pour une à deux secondes. Rien, dans le mouvement, n'indiquait
  comment s'en défaire — parce qu'il n'y avait rien à faire.

  On sépare donc les deux composantes de la vitesse, ce qui était déjà fait pour mesurer la
  sévérité mais ne servait qu'à ça :

    NORMALE     ce qui rentre dans le mur. C'est elle qui fait le choc, et elle repart en sens
                inverse, amortie — le trampoline. D'autant plus franchement que le choc est léger :
                un effleurement rebondit vivement, un impact à plein régime ne renvoie presque
                rien, sans quoi on repartirait d'un mur comme d'un ressort.
    TANGENTIELLE ce qui glisse le long du mur. Elle ne cause aucun choc et n'est plus effacée :
                on en garde la plus grande part contre un rail, moins contre les pneus, qui
                accrochent. C'est elle qui emmène la voiture hors de la zone.

  En dessous d'un seuil de vitesse normale le moteur ne se coupe plus du tout : un frottement n'est
  pas un accident. La faute et le tour sali restent — on est sorti de la piste, et cela se paie —
  mais on continue de rouler.

  Le seuil est à 5 m/s parce que c'est, sur le banc, ce qui sépare les deux familles : à angle
  rasant et aux vitesses de sortie de virage la composante normale reste en dessous, tandis qu'un
  tête-à-queue dans le mur ou une sortie tout droit la passe largement. */
  _barrierContact(from, dt, raceTime) {
    const hit=this.track.barrierHit(this,from);
    if(!hit)return false;
    const vx=this.v*Math.cos(this.th)+this.vl*Math.sin(this.th);
    const vy=this.v*Math.sin(this.th)-this.vl*Math.cos(this.th);
    // La composante normale distingue un frottement d'un impact frontal.
    const impact=Math.max(0,-vx*hit.nx-vy*hit.ny);
    const pneus=hit.barrier.kind==='tyres';
    this.x=from.x+(this.x-from.x)*hit.t+hit.nx*(hit.depth+.035);
    this.y=from.y+(this.y-from.y)*hit.t+hit.ny*(hit.depth+.035);
    this.th=wrapAngle(from.th+wrapAngle(this.th-from.th)*hit.t);
    // Le long du mur : la vitesse qui ne tape pas, et qu'on garde.
    const tx=-hit.ny,ty=hit.nx;
    const vt=vx*tx+vy*ty;
    const rendu=impact*BARRIERE.rebond*Math.exp(-impact/BARRIERE.douceur)*(pneus?BARRIERE.pneus:1);
    const glisse=vt*(pneus?BARRIERE.glissePneus:BARRIERE.glisseRail);
    const wx=hit.nx*rendu+tx*glisse, wy=hit.ny*rendu+ty*glisse;
    const cs=Math.cos(this.th),sn=Math.sin(this.th);
    this.v=wx*cs+wy*sn; this.vl=wx*sn-wy*cs;
    this.w*=BARRIERE.lacet;this.Ff=0;this.Fr=0;
    this.slide=0;this.patine=0;this.patineFx=0;this.throttle=false;this.braking=false;
    if(!this.engineStopped){
      const effective=impact*(pneus?.55:1);
      this.barrierHits++;
      this.lastBarrierImpact={speed:impact,effective,kind:hit.barrier.kind,cut:0};
      if(impact>BARRIERE.seuil){
        this.engineCut=clamp(.25+2*Math.pow(effective/20,2),.25,5);
        this.engineStopped=true;
        this.lastBarrierImpact.cut=this.engineCut;
      }
      this._leaveTrack(false); // une excursion et son impact ne comptent pas deux fautes
      if(this.usure)this.damage=clamp(this.damage+this.usure.chocParVitesse*Math.max(0,effective-this.usure.chocSeuil),0,1);
    }
    const pr=this.track.project(this.x,this.y,this.s,30);
    const ds=this.track.diff(this.s,pr.s);
    if(raceTime!=null&&ds>0&&ds<6)this._advance(ds,raceTime);else this.s=pr.s;
    this.lat=pr.lat;
    return true;
  }

  update(dt, throttle, raceTime) {
    const T = this.track, c = this.cls;
    const wasStopped = this.engineStopped;
    this.engineCut = Math.max(0, this.engineCut - dt);
    this.engineStopped = this.engineCut > 1e-6;
    // Avec un seul accélérateur et sans marche arrière, repartir nez contre le mur
    // créerait une boucle de chocs. On remet le cap dans le sens de la piste sur place.
    if (wasStopped && !this.engineStopped) {
      this.th = T.headingAt(this.s); this.delta=0; this.Ff=0; this.Fr=0;
    }
    /* Le bloc des stands passe AVANT `this.throttle`, et ce n'est pas cosmétique.

    Il remplace l'accélérateur quand on est dans la voie. Placé après, il levait bien le pied
    — mais `this.offT`, qui mesure depuis combien de temps le pied est levé et commande le
    freinage, avait déjà été calculé sur la valeur d'origine. La voiture coupait les gaz sans
    freiner, traversait la case d'arrêt en roue libre et ressortait sans s'arrêter, à chaque
    tour, sans que rien ne le signale. */
    /* --- la voie des stands ---

    On y est quand le levier demande les stands ET que l'abscisse est dans la voie. Les deux
    conditions ensemble : demander les stands au milieu du tour ne fait rien, et traverser la zone
    sans les demander ne fait rien non plus. */
    /* On est dans la voie quand on l'a demandée ET qu'on est dans sa portion de circuit.

    Une première version exigeait en plus d'être déjà sur la droite de la piste, ce qui ne pouvait
    jamais arriver : la voiture ne se décale que parce qu'elle vise la voie, et elle ne visait la
    voie que si elle était déjà décalée. Personne n'entrait jamais aux stands. */
    const zone = this.usure ? T.pitAt(this.s) : null;
    this.inPit = !!(zone && (this.pitAsk || this.pitState));
    if (this.inPit) {
      if (!this.pitState) this.pitState = 'voie';
      /* IL SUFFIT DE S'ARRÊTER DANS LA ZONE. Pas de case à viser au mètre près : la zone fait
      cinquante mètres, et s'y immobiliser suffit. Viser n'est pas un choix de course, c'est une
      corvée — et au pouce, sur un téléphone, c'est une corvée impossible.

      Le verrou `pitServi` évite qu'une voiture déjà servie et toujours à l'arrêt dans la zone se
      fasse resservir à l'image suivante, indéfiniment. */
      if (this.pitState === 'voie' && !this.pitServi && zone.dansZone && Math.abs(this.v) < STAND.seuilArret) {
        this.pitState = 'arret';
        this.pitT = STAND.service;
      }
    } else if (this.pitState === 'voie' && !zone) {
      /* Sorti de la voie : on retombe au neutre, et la demande s'éteint AVEC la sortie.

      Deux erreurs successives ici, opposées l'une à l'autre.

      D'abord la demande ne s'éteignait jamais. Un pilote qui ratait la zone — trop vite, ou servi
      puis ressorti — gardait son drapeau levé pour le reste de la course et replongeait dans la
      voie à chaque tour : une centaine de secondes perdues en quatre tours, sans qu'aucun arrêt
      n'apparaisse dans les compteurs.

      Puis, en corrigeant, je l'ai éteinte dès qu'on était HORS de la voie, ce qui n'est pas la
      même chose que d'en SORTIR. Une demande faite en plein tour mourait à l'image suivante, et
      seules les demandes faites par hasard à l'intérieur de la zone survivaient. Sur un circuit
      court la voie occupe assez du tour pour que ça passe ; sur les trois plus longs — Spa, le
      Nürburgring, Le Mans — la voiture n'entrait jamais aux stands. Mesuré, pas deviné.

      La demande vaut donc pour le passage qui vient : elle survit tant qu'on n'a pas traversé la
      voie, et s'éteint quand on en ressort. */
      this.pitState = null;
      this.pitAsk = false;
    }
    if (!zone) this.pitServi = false;   // le verrou ne vaut qu'à l'intérieur
    /* Dans la voie, l'IA se conduit ; LE JOUEUR SE CONDUIT LUI-MÊME.

    J'avais d'abord fait conduire la voie automatiquement pour tout le monde, en me disant que
    viser une case au frein serait une corvée. C'est vrai pour une case de dix-huit mètres ; ça ne
    l'est plus avec une zone de cinquante, où il suffit de s'arrêter. Et retirer le volant des
    mains du joueur au moment le plus tendu de la course, c'était supprimer la seule chose qui
    rende un arrêt vivant : le risque de le rater.

    L'IA, elle, n'a pas de mains. Elle freine pour la zone comme elle freinerait pour un virage :
    la distance restante décide de la vitesse qu'elle peut encore tenir. */
    if (this.inPit && this.aiDriven) {
      if (this.pitState === 'voie' && zone.boite < 0 && !this.pitServi) {
        const reste = Math.max(0, -zone.boite);
        const vCible = Math.min(STAND.vitesse, Math.sqrt(2 * c.brake * 0.8 * reste));
        throttle = this.v < vCible * 0.92;
      } else if (this.pitState === 'voie') {
        throttle = this.v < STAND.vitesse * 0.95;   // servi ou déjà passé : on repart
      } else {
        throttle = false;
      }
    }
    // la limitation de vitesse vaut pour tout le monde, elle : sans elle la voie serait un raccourci
    if (this.inPit && this.pitState !== 'arret' && this.v > STAND.vitesse) throttle = false;

    if (this.pitState === 'arret') {
      this.pitT -= dt;
      this.v = 0; this.vl = 0; this.w = 0;
      if (this.pitT <= 0) {
        this.tyre = 1; this.damage = 0; this.pitsDone++;
        this.pitState = 'voie';
        this.pitAsk = false;     // servi : on ressort, et on ne redemande pas au tour suivant
        this.pitServi = true;
      }
    }

    if (this.engineStopped) throttle = false;
    throttle = throttleAmount(throttle);
    this.throttle = throttle;
    /* L'usure. La glisse compte au carré : c'est le frottement qui arrache la gomme, pas la
    distance. Un pilote propre use lentement, un pilote en travers permanent trois fois plus vite.
    Rien ne s'use à l'arrêt ni hors piste — dans le gravier on ne fait pas chauffer un pneu. */
    if (this.usure && this.state === 'ok' && this.v > 1) {
      const u = this.usure, q = this.usage;
      this.tyre = Math.max(0, this.tyre - dt * (u.charge * q * q + u.glisse * this.slide));
    }
    this.offT = throttle ? 0 : this.offT + dt;
    this.braking = !throttle && this.offT > 0.05 && this.v > 2;

    /* --- la surface, en TROIS zones et non deux ---

    La route, le vibreur, puis l'herbe. Le vibreur manquait : la piste s'arrêtait à la ligne blanche,
    donc deux roues sur la peinture valaient gravier, dégâts et faute. Il appartient maintenant à la
    piste — c'est à ça qu'il sert — mais il ne rend pas tout : on y perd de l'adhérence, sinon ce
    serait deux mètres de route gratuits dans chaque virage.

    `T.kerbAt` vaut zéro dans les lignes droites, où aucun vibreur n'est peint. On garde la même
    tolérance de 30 % de la largeur de la voiture qu'avant, simplement mesurée depuis le bord
    extérieur de la bande au lieu de la ligne blanche. */
    const hwL = T.hwLeftAt(this.s), hwR = T.hwRightAt(this.s);
    const kb = T.kerbAt ? T.kerbAt(this.s) : 0;
    const marge = c.width * 0.3;
    // dans la voie des stands on est hors de la piste sans être hors piste : ni gravier, ni faute
    const horsRoute = !this.inPit && (this.lat > hwL + marge || this.lat < -(hwR + marge));
    const off = !this.inPit && (this.lat > hwL + kb + marge || this.lat < -(hwR + kb + marge));
    const loose = off && !this.runoffAsphalt;
    this.surKerb = horsRoute && !off;
    if (off) this._leaveTrack();
    if (!off && !this.engineStopped) this.state = 'ok';
    if (this.state === 'grass') this.grassT += dt;
    // stuck in the gravel: the marshals push the car back onto the edge of the road, facing the
    // right way and barely moving. Only after a long excursion, never during a slide.
    if (this.grassT > 8 && !this.engineStopped) {
      const edge = clamp(this.lat, -(T.hwRightAt(this.s) - c.width), T.hwLeftAt(this.s) - c.width);
      this.place(this.s, edge, Math.min(8, Math.abs(this.v)));
      this.state = 'ok'; this.grassT = 0; this.rejoined = (this.rejoined || 0) + 1;
      return;
    }
    /* MOTEUR COUPÉ : LA VOITURE ROULE ENCORE.

    Elle était figée — trois vitesses à zéro et retour immédiat — ce qui, ajouté au rebond, aurait
    annulé le rebond : la voiture aurait été renvoyée du mur puis clouée sur place à l'image
    suivante. Elle roule donc en roue libre, freinée fort mais pas arrêtée, jusqu'à ce que le
    moteur revienne ou qu'elle s'immobilise d'elle-même. C'est ce qui donne au choc son mouvement
    de sortie, et c'est aussi ce qui fait qu'on voit où l'on est reparti. */
    if (this.engineStopped) {
      const frein = Math.exp(-dt / ARRET_LIBRE);
      this.v *= frein; this.vl *= frein; this.w *= frein;
      if (Math.abs(this.v) < 0.05) this.v = 0;
      if (Math.abs(this.vl) < 0.05) this.vl = 0;
      if (Math.abs(this.w) < 0.02) this.w = 0;
      this.th = wrapAngle(this.th + this.w * dt);
      const cs0 = Math.cos(this.th), sn0 = Math.sin(this.th);
      const av = { x: this.x, y: this.y, th: this.th };
      this.x += (this.v * cs0 + this.vl * sn0) * dt;
      this.y += (this.v * sn0 - this.vl * cs0) * dt;
      // Un rebond peut renvoyer la voiture dans la protection d'en face : on le vérifie.
      if (T.barriers.length && this._barrierContact(av, dt, raceTime)) return;
      const prc = T.project(this.x, this.y, this.s, 30);
      if (Math.abs(T.diff(this.s, prc.s)) < 6) { this.s = prc.s; this.lat = prc.lat; }
      return;
    }
    // le vibreur ne rend pas tout : on peut s'y appuyer, pas s'y installer
    const surface = loose ? 0.42 : this.surKerb ? KERB_ADHERENCE : 1;

    // --- geometry and tyre data shared by the driver and the axle model ---
    const L = c.length * 0.6;
    const a = L / 2, b = L / 2;                       // CG to front / rear axle
    const kk = Math.pow(0.28 * c.length, 2) * (5 / c.laneK);   // yaw inertia (radius of gyration²)
    const brakeFrac = throttle ? 0 : clamp(this.offT / 0.1, 0, 1);
    const vv = Math.max(3, Math.abs(this.v));
    const peak = c.slipPeak * PHYS.slip;
    const gTot = this.gripAt(Math.abs(this.v)) * surface;

    // --- driver: the line gives a desired curvature, the driver turns it into a front slip angle ---
    // A wheel angle means nothing once the car slides; what a driver really controls is where the
    // front tyres point relative to the car's actual motion. Feed-forward for the curvature, a
    // yaw-rate correction on top; when the tail comes round the yaw rate exceeds the demand and
    // the same law gives opposite lock, like a driver catching a slide. Asking for more than the
    // tyre's peak slip is useless, so the demand is capped: past the limit the car just turns less.
    const kDes = this._desiredCurvature();
    // a car cannot rotate faster than its path can bend: past that the tail only steps out
    const wLim = PHYS.wLim * gTot / vv;
    const wDes = clamp(this.v * kDes, -wLim, wLim);
    const gAxle = gTot * 0.5 / Math.min(1, c.rearBias);               // grip of one axle
    const ayFront = this.v * this.v * kDes * 0.5;                     // lateral acceleration asked of the front
    const aFff = peak * ayFront / Math.max(1e-3, gAxle);              // slip angle that produces it
    const aFdes = clamp(aFff + PHYS.yawK * peak * (wDes - this.w), -peak * 1.3, peak * 1.3);
    const ufront = (this.vl - a * this.w) / vv;                       // lateral / rolling speed at the front axle
    const steerTarget = Math.atan(Math.tan(aFdes) - ufront * Math.sign(this.v || 1));
    const dMax = 0.5, rate = PHYS.steerRate;
    this.delta += clamp(clamp(steerTarget, -dMax, dMax) - this.delta, -rate * dt, rate * dt);
    // grip usage as the driver feels it: lateral acceleration the line demands vs what the tyres can give
    this.usage = this.v * this.v * Math.abs(kDes) / Math.max(1e-3, gTot);

    // --- two-axle model: each axle produces a lateral force from its slip angle ---
    // slip angles: lateral velocity of each axle across its wheels, over the rolling speed
    // (left-positive velocities; the steering angle delta is right-positive). A tyre always
    // fights the lateral velocity of its own contact patch, forwards or backwards.
    const alphaF = Math.atan((this.vl - a * this.w + this.v * Math.tan(this.delta)) / vv);
    const alphaR = Math.atan((this.vl + b * this.w) / vv);
    // grip available per axle: the sum at balance equals gripAt(v), the limiting axle decides
    const base = gAxle;
    const cliffF = 1 - c.cliff * PHYS.cliff * smoothstep(Math.abs(alphaF), peak * 1.5, peak * 5);
    const cliffR = 1 - c.cliff * PHYS.cliff * smoothstep(Math.abs(alphaR), peak * 1.5, peak * 5);
    /* Motricité : partager l'adhérence arrière entre poussée et tenue latérale.
       Le compromis 0,15 garde une poussée à la limite, sans le décrochage brutal observé
       à partir de 0,35. Mesures : docs/motricite/README.md. Le pilote dose par impulsions. */
    const dmg = this.damageFactor();
    const vmax = c.vmax * dmg * (this.draft ? 1.05 : 1);
    const accDem = throttle
      ? throttle * c.accel * driveFactor(c,Math.max(0,this.v)) * dmg * Math.max(0, 1 - Math.pow(Math.max(0, this.v) / vmax, 2.5)) * (this.draft ? 1.08 : 1)
      : 0;
    // Le transfert au freinage : ce que l'arrière perd, l'avant le gagne pour l'essentiel.
    const transfert = PHYS.liftOff * brakeFrac * clamp(this.freinRatio || 1, FREIN_MIN, FREIN_MAX);
    const gF = base * cliffF * (1 + transfert * TRANSFERT_AV);
    // Toujours repartir de la capacité de l'essieu, jamais d'une force déjà réduite
    // par ce même partage : cela réintroduirait une boucle de perte d'adhérence.
    const gArrBrut = base * c.rearBias * (1 - transfert);
    const latPris = Math.min(1, Math.abs(alphaR) / peak);
    const longDispo = gArrBrut * PHYS.motricite * Math.sqrt(Math.max(0, 1 - latPris * latPris));
    /* SUR SOL MEUBLE, LE PLAFOND NE S'APPLIQUE PAS. Le bitume de dégagement
    garde le modèle de pneus de la route, mais reste une sortie pour les pénalités.

    L'herbe est déjà punie deux fois : `surface` ramène l'adhérence à 42 %, et le bloc de traînée
    plus bas freine la voiture entière, y compris de travers. Y ajouter le plafond de motricité en
    faisait une troisième punition, et comme il se calcule SUR l'adhérence réduite, il divisait la
    poussée par deux au moment précis où on en a le plus besoin. Mesuré sur les neuf voitures :
    dix secondes pour revenir à 60 km/h depuis le bas-côté, contre quatre avant. « La voiture est
    tankée », et c'était juste.

    Le modèle reste actif sur l'asphalte, dégagements compris. Sur l'herbe et le gravier,
    le bas-côté conserve son comportement antérieur. */
    const qy = clamp(alphaR / peak, -1, 1);
    const qx = accDem / Math.max(1e-3, gArrBrut * cliffR * PHYS.motricite);
    const share = loose ? 1 : 1 / Math.max(1, Math.hypot(qx, qy));
    /* La glisse arrière s'accumule tant que la poussée demandée dépasse ce que l'essieu passe,
    et retombe dès qu'on lève. C'est ce qui sépare l'à-coup des gaz tenus. */
    const sature = loose || accDem <= 0 ? 0 : clamp((1 - share) / MOTRICITE.seuil, 0, 1);
    const tau = sature > this.glisseArr ? MOTRICITE.tauMontee : MOTRICITE.tauRetour;
    this.glisseArr += (sature - this.glisseArr) * (1 - Math.exp(-dt / tau));
    const priority = PHYS.drivePriority;
    const safeDrive = Math.min(accDem, longDispo * cliffR);
    const accReel = loose ? accDem : safeDrive * (1 - priority) + accDem * share * priority;
    this.patine = loose || accDem <= 0 ? 0 : clamp(1 - accReel / accDem, 0, 1);
    // Part de poussée non transmise : un indice d'effet, pas une vitesse de roue simulée.
    // Attaque courte pour rendre un appui de 50 ms audible ; extinction douce au relâchement.
    // Ce filtre ne retarde jamais l'accélérateur ni le retour d'adhérence de la physique.
    const spinFx = !loose && !this.inPit && accDem > 0
      ? clamp(1 - accReel / accDem, 0, 1) : 0;
    const spinTau = spinFx > this.patineFx ? 0.035 : 0.08;
    this.patineFx += (spinFx - this.patineFx) * (1 - Math.exp(-dt / spinTau));
    const gR = gArrBrut * cliffR * (loose ? 1 : 1 - priority + priority * share)
      * (loose ? 1 : 1 - MOTRICITE.perte * this.glisseArr);
    // tyre curve: linear up to the peak slip angle, then saturated (the cliff is applied above)
    const FfT = -gF * clamp(alphaF / peak, -1, 1);
    const FrT = -gR * clamp(alphaR / peak, -1, 1);
    // relaxation: a tyre needs some travel to build its force (keeps low speed stable too)
    const relax = Math.min(1, dt * vv / PHYS.relax);
    this.Ff += (FfT - this.Ff) * relax;
    this.Fr += (FrT - this.Fr) * relax;

    /* LA TENSION DE L'AIMANT, hors du circuit de frottement des pneus.

    Elle ne passe pas par la relaxation : un aimant n'a pas de carcasse à déformer. Et elle ne compte
    pas dans `u`, l'usage du pneu, pour la même raison — ce n'est pas le pneu qui tire.

    Elle s'éteint hors piste : l'aimant tient une LIGNE, et il n'y a pas de ligne dans le gravier.
    Elle s'éteint aussi à l'arrêt, sinon elle replacerait une voiture immobile toute seule. */
    let Fm = 0;
    const aimant = this.aides.aimant;
    if (aimant > 0 && !off && Math.abs(this.v) > 3 && !this.inPit) {
      const latCible = this.gridLat != null ? this.gridLat : T.targetLat(this.s, this.selS);
      const ecart = latCible - this.lat;
      const dEcart = this.ecartAv == null ? 0 : (ecart - this.ecartAv) / Math.max(1e-4, dt);
      const plafond = AIMANT.max * gTot * aimant;
      /* LE VERROU SE DÉCIDE SUR LA DISTANCE, LA FORCE S'APPLIQUE AVEC L'AMORTISSEMENT.

      Deuxième défaut de la première version : le verrou lisait la demande AMORTIE, dont le terme
      dérivé est une différence finie à soixante images par seconde, donc bruitée. Résultat, cent
      vingt à deux cent quarante décrochages par minute — quatre par seconde. L'oscillateur avait
      simplement déménagé du ressort vers le verrou, et l'INSTANT qu'on voulait créer n'existait
      plus : clignoter n'est pas un événement.

      Un aimant lâche quand on le tire trop LOIN, pas trop VITE. Le verrou ne regarde donc que le
      terme proportionnel ; l'amortissement, lui, reste dans la force appliquée, où il a sa place. */
      const tension = AIMANT.k * ecart;
      const demande = tension + AIMANT.c * dEcart;
      if (this.accroche) {
        if (Math.abs(tension) > plafond * AIMANT.lache) this.accroche = false;
        else Fm = clamp(demande, -plafond, plafond);
      } else if (Math.abs(tension) < plafond * AIMANT.reprend
                 && Math.abs(alphaR) < peak * AIMANT.derive) {
        this.accroche = true;
        Fm = clamp(demande, -plafond, plafond);
      }
      this.ecartAv = ecart;
    } else { this.accroche = true; this.ecartAv = null; }
    this.aimantF = Fm;
    /* OÙ MORD L'AIMANT, en mètres devant le centre de gravité.

    L'ancien réglage partageait la tension entre les deux essieux, donc il ne savait placer l'aimant
    QU'ENTRE EUX : 1,0 valait « sur l'essieu avant » et il n'y avait pas de plus loin. Or le guide
    d'un slot car est au NEZ, bien devant l'essieu avant — Bruno l'a montré sur un châssis BRM 911.
    La plage utile était donc hors d'atteinte du paramètre.

    On pose la distance directement. Une force Fm appliquée à `d` devant le centre y produit le moment
    −d·Fm, qu'on obtient avec FmAv + FmAr = Fm et FmAv − FmAr = d·Fm/a. Au-delà de l'essieu avant
    (d > a) la part arrière devient négative : c'est le couple équivalent, et c'est bien ce qu'il faut.

    Repères, pour une voiture de 4,5 m dont l'empattement vaut 2,7 m :
      0     le centre de gravité — l'aimant tire sans faire tourner
      1,35  l'essieu avant
      2,25  le nez, là où est le guide d'un vrai slot car */
    const aAim = L / 2;
    const FmAv = Fm * (1 + AIMANT.devant / aAim) / 2;
    const FmAr = Fm * (1 - AIMANT.devant / aAim) / 2;
    // how hard the tyres are working (friction circle for the longitudinal forces)
    const useF = Math.abs(this.Ff) / Math.max(1e-3, gF), useR = Math.abs(this.Fr) / Math.max(1e-3, gR);
    const u = Math.min(1, Math.max(useF, useR));

    // --- longitudinal ---
    let acc;
    const dir = Math.sign(this.v || 1);                 // everything that resists motion opposes it
    // Sur l'asphalte, le partage arrière suffit. L'ancien facteur reste pour le
    // freinage et les sols meubles, dont les réglages sont indépendants de ce changement.
    if (throttle) acc = accReel * (loose ? Math.max(0.3, 1 - PHYS.circle * u * u) : 1);
    else acc = -(1.5 + c.brake * brakeFrac) * (1 - PHYS.circle * u * u) * (this.v > 1 ? 1 : Math.max(0, this.v));
    // grass and gravel drag the whole car, not just its forward motion: it opposes the velocity
    // vector, so a car sliding in sideways is slowed down sideways too.
    let latDrag = 0;
    if (loose) {
      const sp = Math.hypot(this.v, this.vl) || 1e-6;
      const dragA = 5 + 0.15 * sp;
      acc -= dragA * this.v / sp;
      latDrag = -dragA * this.vl / sp;
    }
    // sliding tyres scrub speed (lateral force component along the velocity)
    acc -= (Math.abs(this.Ff * Math.sin(alphaF)) + Math.abs(this.Fr * Math.sin(alphaR))) * 0.8 * dir;
    const beforeBarrier = T.barriers.length ? {x:this.x,y:this.y,th:this.th} : null;
    // --- yaw from the axle moments; the velocity vector is rotated into the new body frame ---
    const wDot = (-a * (this.Ff + FmAv) + b * (this.Fr + FmAr)) / kk;
    this.w = clamp(this.w + wDot * dt, -4, 4);
    this.th = wrapAngle(this.th + this.w * dt);
    const v0 = this.v, vl0 = this.vl;
    // a car pushed backwards by its own spin never reaches racing speed in reverse
    this.v = clamp(v0 + (acc - vl0 * this.w) * dt, -0.25 * c.vmax, c.vmax * dmg * 1.05);
    // la limitation de la voie : sans elle, la voie serait un raccourci et tout le monde s'y arrêterait
    if (this.inPit && this.v > STAND.vitesse) this.v = STAND.vitesse;
    if (this.pitState === 'arret') this.v = 0;
    this.vl = vl0 + (v0 * this.w + this.Ff + Fm + this.Fr) * dt;

    if (latDrag) this.vl += clamp(latDrag * dt, -Math.abs(vl0), Math.abs(vl0));   // drag never reverses it
    this.beta = Math.atan2(this.vl, vv) * Math.sign(this.v || 1);
    this.alphaF = alphaF; this.alphaR = alphaR;
    this.slide = clamp((Math.max(Math.abs(alphaF), Math.abs(alphaR)) - peak * 0.8) / (peak * 2.5), 0, 1);

    /* LE RESSENTI : ce que la voiture FAIT, et non ce que le pilote demande.

    `usage` existait déjà, et il ne convient pas pour l'afficher : il vaut l'accélération latérale
    que la LIGNE VISÉE réclame, donc c'est une prévision. Elle monte avant que la voiture ne bouge
    et elle reste haute quand la voiture a déjà lâché. La demande de Bruno est explicite — « pas
    prévue, mais ressentie ».

    Trois grandeurs produites, et elles se relaient sur les quatre pentes de l'échelle :

      charge   la force latérale réellement sortie des pneus, rapportée à ce qu'ils peuvent donner
      glisse   l'angle de dérive des pneus rapporté au pic de la gomme : au-dessus de 1, ça glisse
      travers  le cap de la voiture contre celui de la piste : c'est ça, un tête-à-queue

    LES SEUILS SONT MESURÉS. Sur 741 000 images-voiture, GT et protos, quatre circuits, niveau
    difficile : charge médiane 0,33 et p95 0,98 ; glisse médiane 0,38, p95 1,30, p99 1,98, p99,9
    3,36 ; travers médian 3,8°, p95 17°, p99 26°, p99,9 38°, max 60°. Les quatre pentes sont calées
    là-dessus, de sorte que chaque couleur corresponde à un état que la voiture atteint vraiment.

    PREMIÈRE VERSION JETÉE, et la mesure l'a dit tout de suite : avec la charge étalée de 0 à 1 sur
    la seule première pente, le peloton passait 93 % du temps en bleu, 7 % en vert, et le rouge ne
    sortait jamais. Un indicateur qui ne quitte pas sa première couleur n'indique rien. La charge
    sature donc bien avant le vert, et le relais passe à la glisse. */
    const RESSENTI = [[0.00, 0.62], [0.80, 1.30], [1.30, 2.50], [0.44, 0.87]];
    const gDispo = Math.max(1e-3, gTot);
    const charge = Math.abs(this.Ff + this.Fr) / gDispo;
    const glisse = Math.max(Math.abs(alphaF), Math.abs(alphaR)) / Math.max(1e-4, peak);
    let travers = this.th - T.headingAt(this.s);
    while (travers > Math.PI) travers -= Math.PI * 2;
    while (travers < -Math.PI) travers += Math.PI * 2;
    const pente = (v, [a, b]) => clamp((v - a) / (b - a), 0, 1);
    this.ressenti = Math.min(1, 0.25 * (pente(charge, RESSENTI[0]) + pente(glisse, RESSENTI[1])
      + pente(glisse, RESSENTI[2]) + pente(Math.abs(travers), RESSENTI[3])));

    // --- integrate position (body frame → world, y-down, left = (sinθ, −cosθ)) ---
    const cs = Math.cos(this.th), sn = Math.sin(this.th);
    this.x += (this.v * cs + this.vl * sn) * dt;
    this.y += (this.v * sn - this.vl * cs) * dt;

    if (beforeBarrier && this._barrierContact(beforeBarrier,dt,raceTime)) return;

    // --- track bookkeeping ---
    const pr = T.project(this.x, this.y, this.s);
    const ds = T.diff(this.s, pr.s);
    if (Math.abs(ds) < 6) { if (ds > 0) this._advance(ds, raceTime); else this.s = pr.s; this.lat = pr.lat; }
    else this._advance(Math.max(0, this.v) * dt, raceTime);
  }

  // which line we want, plus AI overtaking decisions
  steer(cars, dt, ai) {
    const T = this.track, c = this.cls;
    if (this.gridLat != null) { this.laneTarget = this.gridLat; this.selS = this.sel; return; }
    /* Une voiture qui rentre aux stands ne double plus personne.

    C'est ce qui manquait pour que l'intention survive : le choix de ligne de l'IA réécrit `sel` à
    chaque pas, donc une IA qui avait décidé de s'arrêter reprenait la ligne de course à l'image
    suivante et passait devant les stands sans les voir. */
    if (this.pitAsk || this.pitState) {
      this.selS += clamp(-2 - this.selS, -PHYS.selRate * dt, PHYS.selRate * dt);
      this.laneTarget = T.targetLat(this.s, this.selS);
      return;
    }
    /* DEVANT ET À CÔTÉ NE SONT PAS LA MÊME CHOSE.

    L'ancienne détection écartait tout ce qui n'était pas strictement devant (`d <= 0`), et prenait
    tout le reste pour un gêneur. Deux voitures roue contre roue étaient donc traitées comme une
    file : celle dont le nez dépassait d'un centimètre voyait un gêneur, l'autre ne voyait rien, et
    aucune des deux ne savait qu'il y avait quelqu'un à côté d'elle. La mesure dit ce que ça coûte :
    des blocages par PAIRES de même durée, jusqu'à 22 s à Suzuka, 59 km/h à l'entrée et 26 km/h
    dedans, avec quatre fois la dérive normale.

    On sépare donc trois cas, sur la MÊME géométrie que le solveur de contact — deux voitures se
    chevauchent en abscisse en dessous de la demi-somme de leurs longueurs, soit une longueur de
    voiture quand elles sont de la même taille :

      d >= lenSum    DEVANT    c'est un gêneur : on le double, et on lève pour ne pas le percuter
      |d| < lenSum   À CÔTÉ    c'est un voisin : on ne lève pas, on lui laisse la place
      d <= -lenSum   DERRIÈRE  ce n'est pas notre affaire

    Le voisin se retient par le plus petit écart LATÉRAL et non par la distance : celui dont il faut
    se méfier est celui qui est le plus près de notre flanc, pas celui dont le nez est le plus
    proche du nôtre. */
    let blocker = null, bd = Infinity, voisin = null, vdl = Infinity;
    const range = c.length * 3 + Math.max(0, this.v) * 1.0;
    for (const o of cars) {
      if (o === this) continue;
      const d = T.diff(this.s, o.s);
      if (d > range) continue;
      const lenSum = (c.length + o.cls.length) / 2;
      const dl = o.lat - this.lat, demiLarg = (c.width + o.cls.width) / 2;
      if (Math.abs(d) < lenSum) {
        if (Math.abs(dl) < demiLarg + 0.6 && Math.abs(dl) < Math.abs(vdl)) { voisin = o; vdl = dl; }
        continue;
      }
      if (d < lenSum || d >= bd) continue;
      if (o.v > this.v + 2.5 && d > c.length * 1.5) continue;
      if (Math.abs(dl) < demiLarg * 1.5 + 0.4) { blocker = o; bd = d; }
    }
    this.blocker = blocker;
    this.voisin = voisin;
    this.draft = !!blocker && bd < c.length * 3.5 && Math.abs(blocker.lat - this.lat) < c.width * 0.9;
    if (ai) {
      this.passTimer -= dt;
      if (blocker) {
        if (this.passSide === 0 || this.passTimer <= 0) {
          /* LA PLACE SE JUGE À LA MÊME ABSCISSE DES DEUX CÔTÉS.

          L'ancienne version comparait un `targetLat` pris 15 m devant au `lat` ACTUEL des autres.
          Sur une ligne droite les deux se valent ; en virage la ligne se déplace latéralement entre
          les deux points, et la comparaison mesurait ce déplacement au lieu de l'écart entre les
          voitures. On prend donc la position que chacun aura à notre `s + 15` s'il tient sa ligne,
          ce qui est exactement comparable au candidat. */
          const sAv = this.s + 15;
          const cand = [-1, 1].map(sel => {
            const lat = T.targetLat(sAv, sel);
            let room = Math.abs(lat - T.targetLat(sAv, blocker.selS));
            for (const o of cars) {
              if (o === this || o === blocker) continue;
              const d = T.diff(this.s, o.s);
              if (d > -c.length * 2 && d < 40) room = Math.min(room, Math.abs(lat - T.targetLat(sAv, o.selS)));
            }
            return { sel, room };
          });
          cand.sort((a, b) => b.room - a.room);
          this.passSide = cand[0].room > c.width * 0.9 ? cand[0].sel : 0;
          this.passTimer = 2 + Math.random() * 1.5;
        }
        this.sel = this.passSide;
      } else if (this.passSide !== 0 && this.passTimer <= 0) { this.passSide = 0; this.sel = 0; }
      else if (!blocker && this.passSide === 0) this.sel = 0;
      /* ON NE SE RABAT PAS SUR QUELQU'UN QUI EST DÉJÀ LÀ.

      C'est une contrainte, pas une force : la ligne visée reste la ligne de course, mais elle ne
      peut plus franchir le flanc du voisin. Sans ça, les deux voitures visent le même point et le
      chevauchement que le solveur vient d'écarter se reforme à l'image suivante — c'est ce qui rend
      le blocage mutuel et le fait durer.

      `targetLat` n'est pas monotone en `sel` : l'intérieur et l'extérieur changent de bord à chaque
      changement de sens du circuit. Le côté se lit donc dans les positions, jamais dans `sel`. */
      if (voisin) {
        const versVoisin = Math.sign(vdl);
        const latVise = T.targetLat(this.s, this.sel);
        if (Math.sign(latVise - this.lat) === versVoisin && Math.abs(latVise - this.lat) > Math.abs(vdl) - (c.width + voisin.cls.width) / 2)
          this.sel = this.selS;   // on tient la position tant qu'il est là
      }
    }
    // ease the chosen line in: changing lane is a manoeuvre, not a jump of the target
    this.selS += clamp(this.sel - this.selS, -PHYS.selRate * dt, PHYS.selRate * dt);
    this.laneTarget = T.targetLat(this.s, this.selS);
  }
}

// AI: brake for the tightest corner reachable along its line, with a skill-dependent margin.
function aiThrottle(car, cars, dt, opts) {
  const c = car.cls, T = car.track;
  // sideways or going backwards: both feet in until the car is pointing somewhere useful again
  if (Math.abs(car.beta) > 0.6 || car.v < -0.5) return false;
  car.aiTimer -= dt;
  if (car.aiTimer <= 0) {
    car.aiTimer = 0.12;
    car.aiNoise = (Math.random() - 0.5) * 0.03;
    // Never ask for more than the tyres can give. `margin` multiplies the corner speed the grip
    // allows, so anything above 1 is a corner the car cannot take, and the driver who is handed it
    // does not go faster — he goes off, loses ten seconds, and hands the place back. The skill
    // spread, the noise and the rubber-banding all add up, so the sum is what has to be capped,
    // not each part: that is how a "hard" setting ended up slower in race pace than it looked.
    /* Le plafond, et pourquoi il se règle maintenant.

    0,98 était écrit en dur, et il a longtemps eu raison : au-dessus de 1 on demande une courbe que
    la voiture ne peut pas prendre, et le pilote qui l'accepte ne va pas plus vite, il sort.

    Mais c'est exactement ce qu'on veut du niveau extrême. Lui donner de l'adhérence en plus le
    rend plus rapide ET PLUS PROPRE — mesuré : 6,5 sorties par course en difficile, 1,5 à
    adhérence ×1,24. Un peloton qui ne fait plus de fautes ne laisse aucune ouverture, et la seule
    façon de doubler disparaît en même temps que la difficulté augmente. Laisser le plafond monter
    au-dessus de 1 rend les fautes au niveau où elles doivent servir : l'IA demande parfois plus
    que ses pneus ne donnent, et le paie. */
    const MAX = opts.maxMargin || 0.98;
    const margin = Math.min(MAX, (opts.marginBase + car.skill * opts.marginSpread) + car.aiNoise + (opts.rubber || 0));
    const brake = c.brake * 0.88;
    const v = Math.max(0, car.v);
    let allow = c.vmax * Math.min(1, (opts.paceBase == null ? 1 : opts.paceBase + car.skill * opts.paceSpread) + (opts.rubber || 0));
    const maxD = v * v / (2 * brake) + 40;
    for (let d = 0; d < maxD; d += 3) {
      const k = Math.abs(d < 6 ? T.curvAtLat(car.s + d, car.lat) : T.lineCurv(car.s + d, car.selS));
      if (k < 1e-4) continue;
      const vc = car.cornerSpeed(k) * margin;
      if (vc >= c.vmax) continue;
      const a = Math.sqrt(vc * vc + 2 * brake * d);
      if (a < allow) allow = a;
    }
    /* On lève pour la voiture DEVANT, pas pour celle qui est à côté.

    `d > 0` suffisait à faire lever une voiture dont le nez dépassait d'un centimètre : roue contre
    roue, celle qui était derrière d'un rien se bridait sur la vitesse de l'autre, reculait, et le
    duel se transformait en file. Lever n'y sert à rien — à cette distance il n'y a plus de choc
    frontal à éviter, seulement un flanc, et c'est au solveur de contact de s'en occuper. Le seuil
    est donc la même demi-longueur que partout ailleurs. */
    for (const o of cars) {
      if (o === car) continue;
      const d = T.diff(car.s, o.s);
      const lenSum = (c.length + o.cls.length) / 2;
      if (d >= lenSum && d < c.length * 1.2 + v * 0.15 && Math.abs(o.lat - car.lat) < (c.width + o.cls.width) * 0.5 + 0.3) {
        if (o.v + 0.5 < allow) allow = Math.min(allow, o.v + 0.5);
      }
    }
    car.aiAllow = allow;
  }
  /* LE DOSAGE PAR À-COUPS, CÔTÉ IA.

  Depuis que l'arrière accumule sa glisse, tenir les gaz à fond en sortie de virage fait déraper —
  c'est la demande, et c'est ce que le joueur doit apprendre à gérer au pouce. Mais l'IA, elle,
  tenait : elle vise une vitesse, et tant qu'elle est en dessous elle appuie. Elle passait donc le
  tour en travers, et le banc des sorties l'a dit tout de suite, le tour de l'IA cauchemar partant
  de 79 à 116 secondes.

  Un pilote ne fait pas ça : il sent l'arrière s'en aller et lève, le temps que la gomme reprenne.
  L'IA le fait maintenant aussi. Les deux seuils sont là pour éviter qu'elle ne vibre à la
  fréquence de la simulation : elle lève haut et ne reprend que bas, ce qui produit des appuis
  d'une à deux dixièmes — exactement le geste attendu du joueur. */
  if (car.glisseArr > AI_GLISSE[1]) car.aiLeve = true;
  else if (car.glisseArr < AI_GLISSE[0]) car.aiLeve = false;
  if (car.aiLeve) return false;
  /* ON N'AJOUTE PAS DE PUISSANCE À DES PNEUS DÉJÀ OCCUPÉS.

  Le verrou ci-dessus agit APRÈS coup : il attend que l'arrière soit parti pour lever. Cela suffit
  à éviter le tête-à-queue, pas à aller vite, et la mesure le disait — l'IA cauchemar tournait un
  quart plus lentement que sa propre référence. Elle arrivait au virage à la vitesse visée, mettait
  les gaz pour la tenir, saturait, glissait, perdait de la vitesse en glissant, et remettait les
  gaz parce qu'elle était en dessous de la cible. Un cercle vicieux, qu'aucun verrou de sortie ne
  pouvait rompre puisque c'est l'entrée qui était fautive.

  `usage` dit quelle part de l'adhérence la courbe visée réclame déjà. Au-dessus du seuil, il n'en
  reste pas pour pousser : on attend la sortie du virage. C'est la leçon même du slot racing — on
  n'accélère pas AU virage, on accélère QUAND il s'ouvre. */
  if (car.usage > AI_USAGE) return false;
  return car.v < car.aiAllow - 0.3;
}

// car-to-car contact, resolved in world space along the track tangent / normal
function resolveCollisions(cars, track) {
  const n = cars.length;
  for (let i = 0; i < n; i++) {
    const a = cars[i];
    for (let j = i + 1; j < n; j++) {
      const b = cars[j];
      /* Pas de contact dans la voie des stands, ni avec la piste depuis la voie.

      Deux raisons, et la seconde compte plus que la première. D'abord c'est juste : un vrai
      circuit met un mur entre les deux, et une voiture lancée sur la piste ne peut pas toucher une
      voiture arrêtée aux stands, même si leurs abscisses coïncident. Ensuite c'est nécessaire :
      les voitures de la voie sont immobiles ou au pas, en file, au même endroit — sans cette garde
      elles se poussent les unes les autres hors de la zone d'arrêt et aucune ne se fait servir. */
      if (a.inPit || b.inPit) continue;
      const d = track.diff(a.s, b.s);
      const lenSum = (a.cls.length + b.cls.length) / 2;
      if (Math.abs(d) >= lenSum) continue;
      const dl = b.lat - a.lat;
      const wSum = (a.cls.width + b.cls.width) / 2;
      if (Math.abs(dl) >= wSum) continue;
      const longOverlap = lenSum - Math.abs(d);
      const latOverlap = wSum - Math.abs(dl);
      const h = track.headingAt(a.s), tx = Math.cos(h), ty = Math.sin(h), nx = Math.sin(h), ny = -Math.cos(h);
      if (longOverlap < latOverlap * 2.2) {
        const rear = d > 0 ? a : b, front = d > 0 ? b : a;
        if (rear.v > front.v) {
          const dv = rear.v - front.v;
          // le choc abîme les deux, à proportion de ce qui dépasse le seuil de simple frottement
          const fort = Math.max(0, dv - (rear.usure ? rear.usure.chocSeuil : 0));
          if (rear.usure && fort > 0) rear.damage = Math.min(1, rear.damage + rear.usure.chocParVitesse * fort);
          if (front.usure && fort > 0) front.damage = Math.min(1, front.damage + front.usure.chocParVitesse * fort * 0.6);
          front.v += dv * 0.35;
          rear.v = front.v - dv * 0.1;
          const push = Math.min(longOverlap / 2, 0.1);
          rear.x -= tx * push; rear.y -= ty * push;
          front.x += tx * push; front.y += ty * push;
        }
      } else {
        const dir = dl >= 0 ? 1 : -1, sep = Math.min(latOverlap / 2, 0.1);
        a.x -= nx * dir * sep; a.y -= ny * dir * sep;
        b.x += nx * dir * sep; b.y += ny * dir * sep;
        // a nudge is a perturbation: a little lateral velocity and yaw, capped
        a.vl = clamp(a.vl - dir * 0.25, -3, 3); b.vl = clamp(b.vl + dir * 0.25, -3, 3);
        a.w = clamp(a.w - dir * 0.05, -3, 3); b.w = clamp(b.w + dir * 0.05, -3, 3);
        a.v *= 0.995; b.v *= 0.995;
      }
    }
  }
}

if (typeof module !== 'undefined') module.exports = { Car, aiThrottle, resolveCollisions, speedProfile, cornerSpeedFor, PHYS, FREIN_MIN, FREIN_MAX };
