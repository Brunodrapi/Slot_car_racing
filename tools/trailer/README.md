# Atelier vidéo GRIP

Capture le **vrai jeu du dépôt**, puis monte le script de 72 secondes. Aucun asset de course généré, aucun envoi vers les serveurs de scores/analytics. L'outil sert un serveur local et bloque les requêtes externes du navigateur de tournage.

## Installation

Node.js 20+, FFmpeg avec libx264/drawtext et Chromium :

```sh
npm install --prefix tools/trailer
npx --prefix tools/trailer playwright install chromium
node tools/trailer/make.js --out=artifacts/trailer
```

Avec un Chromium déjà installé :

```sh
node tools/trailer/make.js --chromium=/usr/bin/chromium --out=artifacts/trailer
```

Avec une musique dont tu détiens les droits d'utilisation :

```sh
node tools/trailer/make.js --out=artifacts/trailer --resume --music=/chemin/musique.mp3 --credit=/chemin/credit.txt
```

La musique est réduite en volume et fondue au début/à la fin. Le rendu actuel ne capture pas le son des moteurs. Il génère une piste vidéo sans son et, si `--music` est renseigné, une version avec musique. Crédits/licences : `docs/trailer/MUSIQUES.md`.

## Modifier le montage

`script.json` décrit les textes, durées, circuits, voitures, départ de plan (`at`, fraction de tour), actions et vues spectateur. Les catégories/menu viennent du jeu courant. Le script garde les **12 circuits et 25 voitures demandés** dans les textes ; ce sont des textes éditables, pas des compteurs automatiques.

```sh
node tools/trailer/make.js --script=mon-script.json --out=artifacts/autre-video
node tools/trailer/make.js --only=03-crashes --out=artifacts/trailer
node tools/trailer/make.js --resume --out=artifacts/trailer
```

`--only` refait une section ; sans `--resume`, les prises de cette section sont refaites. Après modification du script, refaire les sections touchées avant le montage global avec `--resume`. Ne pas réutiliser un même dossier pour deux résolutions différentes.

## Livrables

- `grip-trailer-silent.mp4` : montage complet sans son.
- `grip-trailer.mp4` : montage avec musique si fournie.
- `rushes/` : toutes les prises sans titres, PNG des menus et carton final.
- `sections/` : les huit sections montées avec leurs textes.
- `script.json` : copie du script utilisé.
- `capture-report.json` : événements observés et éventuelles erreurs navigateur.
- `poster.jpg` : aperçu.

Vidéo H.264, 1280×720, 24 images/seconde par défaut. Mosaïque : douze vraies courses capturées séparément à 12 images/seconde, assemblées et dézoomées, puis exportées à la cadence finale. Montage possible dans DaVinci Resolve, Shotcut ou Kdenlive en important les MP4.

## Tournage et limites

Les IA pilotent les voitures avec la physique réelle. Pour les accidents, les positions/vitesses initiales sont mises en scène. Une demande d'action ne garantit pas à elle seule qu'une collision ou un dépassement se produise : vérifier les prises et le rapport avant diffusion. Le plan « line » force brièvement l'accélérateur puis rend le contrôle à l'IA.

Les plans spectateur montrent les vraies interfaces follow/full/duel, mais sur une **simulation locale**, pas une session publique multijoueur. Cela permet de tourner sans contacter de joueurs. Ils démontrent les caméras et le chronométrage, pas les performances réseau.

La durée du script fourni est 72 secondes. Le montage est un premier assemblage reproductible : ajuster les départs de plans et les coupes pour un montage publicitaire final. Aucun achat de musique, publication de vidéo ou lancement de campagne n'est effectué.

`--credit` inscrit le fichier texte de crédit sur le carton final lors de son rendu. Pour changer un crédit, refaire `--only=08-end --credit=...`, puis assembler avec `--resume --music=...`. Un crédit prêt à utiliser pour Rhinoceros est fourni dans `docs/trailer/credit-rhinoceros.txt`.

Contrôler une sortie complète :

```sh
node tools/trailer/check.js artifacts/trailer
```

Ce contrôle vérifie la durée de chaque section, les codecs/résolutions, l'absence d'erreurs de capture et le mouvement dans les douze cases de la mosaïque. Il ne remplace pas une relecture éditoriale des prises.


## Deuxième montage : contre-la-montre, 25 voitures et records mondiaux

Le script actuel montre chaque modèle une fois dans le menu, sur dix secondes. Les durées sont réparties en nombres entiers d'images pour que la dernière voiture reste visible. `mode:"timetrial"` crée un véritable contre-la-montre à une seule voiture. `action:"overtake"` prépare un bref plan de course à deux voitures.

Pour le plan des records, télécharger un instantané public (lecture seule), puis le fournir au tournage :

```sh
node tools/trailer/fetch-records.js monza monza-records.json
node tools/trailer/make.js --records=monza-records.json --music="/chemin/Brain Dance.mp3" --credit=docs/trailer/credit-brain-dance.txt --out=artifacts/trailer-v2
```

Le navigateur de capture continue de bloquer les services externes. Seul `fetch-records.js` lit la même API publique que le jeu ; il utilise la clé publiable du client et n'envoie aucune écriture. Un instantané non vide est exigé pour ce plan. Sur certains environnements cloud, `curl` sert de solution de repli si la requête Node ne passe pas.

`--records` attend un JSON `{circuit, capturedAt, records:[{voiture, temps, pilote}]}`. L'outil affiche les composants réels du tableau, avec une mise en page de tournage plus lisible. Les chronos et les noms sont conservés. Le fichier utilisé est inclus dans les prises pour documenter leur date.
