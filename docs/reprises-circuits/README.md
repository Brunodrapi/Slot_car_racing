# Reprises annotées

## 0.40 — les treize circuits

Source : les treize vues `docs/exports-circuits/2026-10-16/*-tour_reprise.png`. Code : **vert** = hors-piste bitumé, **rouge** = gravier, **blanc** = protection, **noir** = stands, **bleu** = tracé, **croix** = suppression. Planches côte à côte (annotation | résultat) dans [`0.40/`](0.40/).

**Méthode.** `tools/releve-reprises.js` refait exactement le cadrage de l'export et écrit, par circuit, la géométrie en pixels (tracé, normales, largeurs, protections, bâtiments). Les traits de couleur sont isolés par différence avec l'export d'origine, puis projetés sur la portion de piste qu'ils bordent : fraction du tour, côté, distance au bord. Les profils et les lignes de `js/tracks.js` en sortent directement ; les largeurs restent des unités du jeu, pas un relevé réel.

**Ce que le moteur sait faire en plus** (`js/track.js`) :

- `barrierPaths` — un trait blanc, ou le contour vert/rouge d'un dégagement, devient la protection elle-même : points en mètres du monde, projetés sur la branche qu'ils bordent, raccordés aux protections calculées aux deux bouts. Une protection calculée cachée derrière un trait ou qui le croise est retirée : le trait devient la séparation commune de deux branches voisines. Les dégagements s'arrêtent au trait. L'ouverture des stands reste ouverte.
- `pitFrom` / `pitTo` — l'entrée et la sortie de la voie des stands au trait noir ; `pitAt` garde la zone d'arrêt et les garages.
- `barrierCuts` — une croix posée sur une protection l'enlève.
- `asphaltPads` — une surface bitumée dessinée (contour en mètres du monde, fermé par le bord de piste), pour l'intérieur d'une épingle où un dégagement décalé se replierait. Rendu et physique la lisent de la même façon.
- `roadWidenings` accepte des valeurs négatives : la chaussée se resserre pour arrondir une corde pointue.
- Une protection calculée repliée par-dessus un virage serré, quand l'ouverture voisine l'empêchait de se refermer, est retirée.

**Par circuit.**

- **Monza** — Rettifilo bitumé des deux côtés jusqu'aux contours verts ; plus de gravier le long de Serraglio (croix) ; la voie des stands quitte la piste à la sortie de la Parabolica.
- **Spa** — Eau Rouge/Raidillon, Les Combes (Malmedy compris) et Bus Stop suivent les contours verts ; l'ancienne voie du Bus Stop à La Source est supprimée (croix rouges et noires) ; la voie part de la sortie de La Source le long de la descente, devant le paddock. Le trait la faisait passer derrière l'épingle, mais son rayon (8 m environ) replierait une voie parallèle.
- **Monaco** — sept dégagements bitumés (Casino, Sainte-Dévote/Beau Rivage, Massenet, chicane du port, Tabac, Antony Noghès, Rascasse) dont le trait est aussi la ligne du mur, et le mur intérieur de l'épingle avant le tunnel.
- **Silverstone** — gravier de Becketts et de Club au contour rouge ; croix : plus de bac intérieur à Club.
- **Suzuka** — intérieur de Degner et côté droit de Casio bitumés jusqu'au trait vert, qui porte la protection ; croix vertes : plus de bac à l'approche de l'épingle ; protection reprise avant Degner.
- **Interlagos** — un seul contour de gravier pour la Ferradura et Laranja ; protections reprises au S de Senna, à l'épingle et à Junção.
- **Laguna Seca** — protections reprises (virage 6, Andretti) ; la voie des stands ne contourne plus le dernier virage.
- **Nürburgring** — Mercedes-Arena bitumée jusqu'au contour vert, plus de bac dans l'épingle Mercedes ; gravier au contour rouge à la Veedol, avant le Bit-Kurve et dans le Schumacher-S bas (croix : plus de bac côté gauche) ; rail retiré à l'entrée de la Veedol.
- **Le Mans** — Dunlop, Esses, sortie du Tertre Rouge, Maison Blanche et chicane Ford bitumés aux contours verts ; Mulsanne, Indianapolis et Arnage en gravier aux contours rouges.
- **Mount Panorama** — croix sur les bacs de The Chase et d'après Forrest Elbow ; gravier au contour rouge à la sortie de la Cutting et le long du Skyline et des Esses ; protections reprises à la Cutting et à Murray's.
- **Red Bull Ring** — croix : plus de voie ni de garages le long de la ligne droite avant le dernier virage, la voie part de sa sortie ; gravier au contour rouge des virages 6-7 ; protections reprises aux virages 1 et 3.
- **Paul Ricard** — l'extérieur de la Sainte-Baume resserré au trait vert, le bac de sa corde bitumé jusqu'à la boucle verte ; l'épingle du Pont bitumée dehors et dedans (surface dessinée) ; la voie des stands part après l'épingle (trait noir) ; les deux cordes pointues sont arrondies (trait bleu, chaussée resserrée d'1,5 m à l'apex).
- **Zandvoort** — tablier de Bocht 12 au contour vert ; onze protections reprises, dont la séparation de Scheivlak entre les deux branches.

**Vérification.** `tools/reprises-circuits-banc.js` (matières, traits devenus protections, entrées des stands, surface dessinée, corde arrondie, aucune protection repliée ni dans la voie des stands, ×0,9 et ×1), `degagements-banc`, `barrieres-banc`, `decor-protections-banc` (aucune protection en croix, aucun décor sur une protection), `decor-banc`, `paralleles-banc`, `zandvoort-stands-banc`, `e2e-barrieres`. `tools/stands.js` : arrêt réussi et voie plus lente que la piste sur tous les circuits mesurés (Le Mans n'y termine pas ses quatre tours de mesure, avant comme après). `tools/surfaces-banc.js` compare le tracé à une référence antérieure à la reprise de Zandvoort : il échouait déjà avant 0.40, et les stands et cordes déplacés ici l'écartent davantage, volontairement.

Limites : la corde de l'épingle du Pont et celle de la Sainte-Baume sont arrondies vers l'intérieur (resserrement), un décalage ne pouvant pas les élargir sans se replier. La boucle verte autour du bosquet de la Sainte-Baume est rendue par la protection calculée au bord du bitume, qui en suit la forme.

## 0.29.1

Les annotations utilisateur priment sur les classifications antérieures. Les largeurs et raccords sont interprétés dans les unités du jeu ; ils ne constituent pas un relevé topographique réel. Les fichiers originaux sont conservés dans `art/reprise circuit/`, séparément des treize exports courants.

### Suzuka

[Annotation d’origine](<../../art/reprise circuit/suzuka_reprise.png>) : rouge = gravier, vert = dégagement bitumé.

- Contours de gravier repris dans les Esses, Dunlop, Degner, l’épingle, les approches de la Cuillère, le retour vers 130R et Casio.
- Tablier bitumé à l’extérieur de la Cuillère et à l’approche de Casio. Le gravier extérieur de Casio subsiste au-delà de la portion bitumée indiquée.
- Suppression des bacs automatiques hors de ces contours : les surfaces déclarées sont la source du dessin et de la physique.
- Suppression du long tunnel (environ 143 m à l’échelle du jeu), des portails et de son éclairage. Le pont existant assure le masquage du passage inférieur. Son emprise projetée est d’environ 17,5 m, déduite de sa largeur et de l’angle du croisement. Le resserrement des protections se limite aux abords de cet ouvrage ; les collisions des deux étages restent séparées.
- Les anciennes étiquettes « 130R » et « Casio » ne correspondaient pas aux bonnes fractions de tour ; elles ont été remplacées par les noms adaptés aux secteurs du dessin.

### Zandvoort

[Annotation d’origine](<../../art/reprise circuit/zandvoort_reprise.png>) : trait bleu = chaussée élargie, vert = bitume, rouge = gravier ; toute croix signifie supprimer le dégagement et poser un rail simple.

- Élargissement progressif du bord droit dans le secteur Hugenholtz/Hunserug, environ 16,4 à 21,2 % du tour. La ligne centrale reste identique ; les tableaux de largeur physique, bords de gameplay, vibreurs et rendu lisent le même profil. Le maximum ajouté est de 9 m nominaux, soit 8,1 m à la largeur de jeu ×0,9.
- Croix : retrait du dégagement de Gerlach, des deux côtés indiqués dans Scheivlak/Masters, du secteur autour de 62–68 % du tour et du dernier grand virage. Les rails sont rapprochés dans ces secteurs, sans rangées de pneus de bac.
- Profils rouges : Tarzan, Hugenholtz côté opposé à l’élargissement, Bocht 9, enveloppe regroupée de CM.com, Hans Ernst et Bocht 13.
- Le contour vert de Bocht 12 devient un tablier bitumé. Les croix vertes du dernier virage suppriment l’ancien tablier ; elles ne demandent pas de l’agrandir.
- Les trois garages opérationnels étaient au contact de Hunserug, et une emprise touchait même la branche voisine. Ils sont recentrés sur la ligne droite, avec une voie des stands de 220 m. Leur géométrie est partagée entre le rendu et le calcul des dégagements/protections. Une marge d’accès est conservée.

### Contraintes et vérification

Les profils sont réduits si une branche voisine ou un bâtiment ne laisse pas assez de place. La protection intérieure est limitée dans les virages très serrés, pour éviter qu’un contour décalé se replie sur la route. Les contrôles de branches tiennent compte de l’étage au pont de Suzuka.

- `tools/reprises-circuits-banc.js` : matériaux rouge/vert, suppressions aux croix, présence des rails, bord élargi et raccords physiques, absence de tunnel à Suzuka et portée du pont ; largeurs ×0,9 et ×1.
- `tools/zandvoort-stands-banc.js` : trois garages sans chevauchement piste, gravier ou volume complet des protections aux deux largeurs.
- `tools/degagements-banc.js`, `tools/decor-protections-banc.js` et contrôles du décor sur Suzuka/Zandvoort : raccords, surfaces et empreintes.
- Vérification fonctionnelle des stands de Zandvoort, départ à état et graine identiques sur le secteur : piste directe 6,93 s ; traversée des stands 11,79 s ; arrêt 17,00 s, une intervention et ressortie à 26 m/s, sans accident. Cette mesure locale évite le biais d’un comparatif à pneus usés sur plusieurs tours.

[Les treize exports courants](../exports-circuits/2026-10-16/README.md).
