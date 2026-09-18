# Décor

Un PNG détouré par objet, découpé dans la planche isométrique `sprites/environnement/image.png`.
`sheet.json` garde, pour chacun, sa boîte d'origine dans la planche et le point où il touche le sol.

## Refaire la découpe

```
python3 tools/env.py sprites/environnement/image.png sprites/env \
  --ignore=0,0,180,50 --erode=6 --min=800 \
  --shadow=14,26,61 --shadowtol=24 --shadowa=95 --light=1.4
```

Les numéros de fichiers dépendent des réglages : refaire la découpe autrement les renumérote, et
les chemins de `js/props.js` sont alors à reprendre. D'où cette commande, fixée ici.

Ce que font les réglages, sur cette planche-là :

- `--ignore=0,0,180,50` jette le filigrane en haut à gauche ;
- `--erode=6` amincit les formes avant de les séparer : sans ça, deux objets voisins dont les
  ombres se touchent sortent collés. L'amincissement ne sert **qu'à décider où passe la coupure** :
  ensuite chaque pixel retiré revient à l'objet dont il est le plus proche, sans limite de
  distance. Une première version ne regrossissait que de six pixels, et tout ce qui était plus
  fin que douze — une rambarde, une branche, un poteau de perron — disparaissait. L'outil vérifie
  maintenant qu'aucune tache gardée n'a perdu de matière, et sort en erreur sinon ;
- `--min=800` laisse de côté les touffes d'herbe et les cailloux isolés ;
- `--shadow=14,26,61` est le bleu très sombre de la planche. L'ombre portée **et** les faces non
  éclairées partagent cette couleur : ce qui les sépare, c'est la place, et l'outil ferme la
  silhouette des pixels colorés pour trancher. Ce qui tombe dehors est l'ombre au sol et devient du
  noir translucide, qui assombrit l'herbe du jeu ; ce qui tombe dedans est un mur à l'ombre, et il
  garde sa couleur ;
- `--light=1.4` éclaircit : la planche est rendue de nuit, le jeu se joue en plein jour.

Deux objets restent collés (`p06`, les deux maisons du haut) : leurs ombres se recouvrent trop pour
que l'amincissement les sépare. Ils ne sont pas utilisés.

## Mettre un objet dans le jeu

Une entrée de `PROP_KINDS`, dans `js/props.js` :

| champ    | sens                                                                        |
|----------|------------------------------------------------------------------------------|
| `id`     | nom interne                                                                   |
| `src`    | chemin du PNG                                                                 |
| `wm`     | largeur de l'image au sol, en mètres, ombre comprise                          |
| `anchor` | où le pied de l'objet se trouve dans l'image (`[0,0]` en haut à gauche)       |
| `weight` | fréquence relative                                                            |
| `near`   | distance minimale au bord de piste, en mètres                                 |
| `far`    | distance maximale                                                             |

`anchor` part de ce que `sheet.json` a mesuré, puis se corrige à l'œil : l'outil vise le bas de la
silhouette, ce qui se trompe sur les objets penchés ou effilochés.

La caméra ne montre qu'environ vingt-cinq mètres de chaque côté de la voiture : au-delà, un objet
existe mais n'apparaît jamais. D'où les bandes serrées.
