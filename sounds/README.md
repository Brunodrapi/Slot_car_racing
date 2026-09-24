# Les sons à trouver

Ce dossier est vide et attend des enregistrements. Il porte la liste de courses et la convention
de nommage, pour qu'un fichier déposé ici soit directement exploitable.

## Pourquoi des enregistrements

La synthèse en place donne la bonne **hauteur** — chaque voiture allume à `tr/min ÷ 60 × cyl ÷ 2`,
vérifié à moins de 0,5 % près par `tools/e2e-audio.js` — mais pas la bonne **matière**. Ce qui fait
qu'un moteur sonne comme un moteur est surtout ce que la mesure de hauteur ne voit pas : la
turbulence de la combustion, l'irrégularité d'un cycle au suivant, les résonances de la ligne
d'échappement. Un oscillateur, même juste, reste un timbre de synthé.

La synthèse reste utile : elle servira de **repli** pour toute voiture sans enregistrement, et elle
continuera de porter la boîte de vitesses, la charge et le vent, qui sont du comportement et non de
la matière.

## Ce qui vaut le plus : une montée en régime propre

**Un seul enregistrement de montée continue du ralenti au rupteur vaut mieux que sept boucles
médiocres.** Je sais la découper en boucles stables moi-même, et une montée est bien plus facile à
trouver qu'une série de régimes tenus. Cherche en priorité :

> `engine run up` · `engine rev` · `acceleration onboard` · `rev up and down`

Ce qui compte dans le choix :

- **prise de son proche** : embarqué, dans l'habitacle, ou échappement à un mètre. Un passage
  filmé du bord de piste (*pass-by*) porte le Doppler et la réverbération du lieu : inutilisable
  en boucle ;
- **rien d'autre dans la bande** : pas de voix, pas de musique, pas de vent de roulage, pas de
  bruit de route. Le moteur doit être seul ;
- **montée franche et continue**, sans passage de rapport si possible — au point mort, c'est
  l'idéal. Un passage de rapport au milieu coupe la boucle ;
- **mono suffit**, 44,1 kHz, et le plus propre possible. Le débruitage abîme plus qu'il ne répare.

## Les familles de moteurs

Neuf voitures, mais **six familles** : elles partagent leur architecture, donc leur son. Inutile de
chercher neuf fois.

| dossier | voitures | ce qu'il faut chercher |
| --- | --- | --- |
| `six-inline` | M1 Procar, 3.0 CSL | `BMW straight six`, `inline 6 engine`, `M30 engine`, `E9 CSL` — mécanique, sec, monte haut |
| `flat-six-turbo` | 911 Turbo | `Porsche 911 engine`, `air cooled flat six`, `930 turbo` — le battement décalé, le sifflement |
| `v8-flat-crank` | F40 | `Ferrari V8`, `flat plane V8`, `turbo V8 engine` — aigu, hurlant, pas un muscle car |
| `v8-cross-crank` | GT40 Mk II, Corvette | `american V8`, `muscle car engine`, `big block`, `V8 rumble` — le grondement irrégulier |
| `v12` | Countach LP500 | `V12 engine`, `Lamborghini V12`, `italian V12` |
| `flat-12` | Testarossa, 917 K | `flat 12 engine`, `boxer 12`, `Porsche 917` — à défaut, un V12 de course fait l'affaire |

## Comment nommer les fichiers

```
sounds/engine/<famille>/
    sweep.ogg        une montée continue du ralenti au rupteur — le plus utile, à lui seul
    idle.ogg         ralenti tenu, 3 s minimum, bouclable
    on-2000.ogg      pied dedans, régime tenu ; le nombre est le régime, en tr/min
    on-4000.ogg
    on-6000.ogg
    off-4000.ogg     pied levé au même régime : c'est ce qui fait la décélération
```

Le **minimum utile** par famille : `sweep.ogg` seul, ou bien `idle` + `on-2000` + `on-5000` +
`off-4000`. L'**idéal** : un régime tenu tous les 1000 tr/min, plus un `off` tous les 2000.

Le régime exact n'a pas besoin d'être connu au tr/min près : mets ton estimation dans le nom, je
l'affine en mesurant la fréquence d'allumage du fichier, qui donne le régime réel par
`tr/min = f × 60 × 2 ÷ cyl`.

## L'environnement

Ces sons-là ne dépendent pas de la voiture, donc un seul exemplaire de chacun suffit.

| fichier | à chercher | remarque |
| --- | --- | --- |
| `tyre/squeal.ogg` | `tire squeal`, `tyre screech`, `skid loop` | tenu et bouclable, pas un crissement unique |
| `tyre/gravel.ogg` | `gravel driving`, `dirt road car`, `skid gravel` | rare en CC0 ; à défaut `gravel footsteps` ralenti fait illusion |
| `tyre/lockup.ogg` | `tire skid`, `brake lock` | coup unique, pour le blocage de roues |
| `world/wind.ogg` | `wind rush`, `car interior wind`, `air rush` | boucle, sans sifflement marqué |
| `world/impact.ogg` | `car crash`, `metal impact`, `car hit barrier` | deux ou trois variantes valent mieux qu'une |
| `world/crowd.ogg` | `race crowd`, `stadium ambience`, `crowd loop` | discret, il ne doit pas occuper le devant |

## Les licences

- **CC0** : à privilégier partout, aucune obligation.
- **CC-BY** : acceptable, mais il faut créditer. Note alors l'auteur et l'URL dans
  `sounds/CREDITS.md` au moment du dépôt, sinon l'information se perd.
- **CC-BY-NC** : à écarter, le jeu ne doit pas se fermer une porte.
- Sonniss GameAudioGDC et Mixkit sont libres d'usage commercial sans attribution.

## Où chercher, en pratique

- **Sonniss GameAudioGDC** : le meilleur point de départ pour du moteur propre et bien enregistré.
  Non atteignable depuis mon bac à sable (403), donc c'est toi qui télécharges.
- **Freesound** : filtre sur CC0 dès la recherche. Mes essais renvoient de la matière pour tous les
  termes ci-dessus sauf `gravel skid`, quasi absent.
- **Pixabay** : bien pour pneus, vent et ambiance ; peu pour un moteur historique précis.
- **Mixkit** : usage en jeu explicitement autorisé, catalogue restreint mais net.

## Ce que j'en ferai

Découper les montées en boucles stables, mesurer le régime réel de chacune, puis les enchaîner en
fondu suivant le régime — deux boucles voisines mélangées, plus un second étage entre pied dedans
et pied levé. La hauteur sera corrigée par `playbackRate` entre deux boucles, ce qui évite le
grain d'un étirement trop large. Le tout reste piloté par la boîte de vitesses et la charge déjà
en place, et toute voiture sans enregistrement garde la synthèse.
