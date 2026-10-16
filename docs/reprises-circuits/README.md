# Reprises annotées — 0.29.1

Les annotations utilisateur priment sur les classifications antérieures. Les largeurs et raccords sont interprétés dans les unités du jeu ; ils ne constituent pas un relevé topographique réel. Les fichiers originaux sont conservés dans `art/reprise circuit/`, séparément des treize exports courants.

## Suzuka

[Annotation d’origine](<../../art/reprise circuit/suzuka_reprise.png>) : rouge = gravier, vert = dégagement bitumé.

- Contours de gravier repris dans les Esses, Dunlop, Degner, l’épingle, les approches de la Cuillère, le retour vers 130R et Casio.
- Tablier bitumé à l’extérieur de la Cuillère et à l’approche de Casio. Le gravier extérieur de Casio subsiste au-delà de la portion bitumée indiquée.
- Suppression des bacs automatiques hors de ces contours : les surfaces déclarées sont la source du dessin et de la physique.
- Suppression du long tunnel (environ 143 m à l’échelle du jeu), des portails et de son éclairage. Le pont existant assure le masquage du passage inférieur. Son emprise projetée est d’environ 17,5 m, déduite de sa largeur et de l’angle du croisement. Le resserrement des protections se limite aux abords de cet ouvrage ; les collisions des deux étages restent séparées.
- Les anciennes étiquettes « 130R » et « Casio » ne correspondaient pas aux bonnes fractions de tour ; elles ont été remplacées par les noms adaptés aux secteurs du dessin.

## Zandvoort

[Annotation d’origine](<../../art/reprise circuit/zandvoort_reprise.png>) : trait bleu = chaussée élargie, vert = bitume, rouge = gravier ; toute croix signifie supprimer le dégagement et poser un rail simple.

- Élargissement progressif du bord droit dans le secteur Hugenholtz/Hunserug, environ 16,4 à 21,2 % du tour. La ligne centrale reste identique ; les tableaux de largeur physique, bords de gameplay, vibreurs et rendu lisent le même profil. Le maximum ajouté est de 9 m nominaux, soit 8,1 m à la largeur de jeu ×0,9.
- Croix : retrait du dégagement de Gerlach, des deux côtés indiqués dans Scheivlak/Masters, du secteur autour de 62–68 % du tour et du dernier grand virage. Les rails sont rapprochés dans ces secteurs, sans rangées de pneus de bac.
- Profils rouges : Tarzan, Hugenholtz côté opposé à l’élargissement, Bocht 9, enveloppe regroupée de CM.com, Hans Ernst et Bocht 13.
- Le contour vert de Bocht 12 devient un tablier bitumé. Les croix vertes du dernier virage suppriment l’ancien tablier ; elles ne demandent pas de l’agrandir.
- Les trois garages opérationnels étaient au contact de Hunserug, et une emprise touchait même la branche voisine. Ils sont recentrés sur la ligne droite, avec une voie des stands de 220 m. Leur géométrie est partagée entre le rendu et le calcul des dégagements/protections. Une marge d’accès est conservée.

## Contraintes et vérification

Les profils sont réduits si une branche voisine ou un bâtiment ne laisse pas assez de place. La protection intérieure est limitée dans les virages très serrés, pour éviter qu’un contour décalé se replie sur la route. Les contrôles de branches tiennent compte de l’étage au pont de Suzuka.

- `tools/reprises-circuits-banc.js` : matériaux rouge/vert, suppressions aux croix, présence des rails, bord élargi et raccords physiques, absence de tunnel à Suzuka et portée du pont ; largeurs ×0,9 et ×1.
- `tools/zandvoort-stands-banc.js` : trois garages sans chevauchement piste, gravier ou volume complet des protections aux deux largeurs.
- `tools/degagements-banc.js`, `tools/decor-protections-banc.js` et contrôles du décor sur Suzuka/Zandvoort : raccords, surfaces et empreintes.
- Vérification fonctionnelle des stands de Zandvoort, départ à état et graine identiques sur le secteur : piste directe 6,93 s ; traversée des stands 11,79 s ; arrêt 17,00 s, une intervention et ressortie à 26 m/s, sans accident. Cette mesure locale évite le biais d’un comparatif à pneus usés sur plusieurs tours.

[Les treize exports courants](../exports-circuits/2026-10-16/README.md).
