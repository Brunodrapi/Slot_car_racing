# Les sons à trouver

Ce dossier porte la liste de courses et la convention de nommage, pour qu'un fichier déposé ici
soit directement exploitable. Trois voitures roulent maintenant sur des prises découpées dans des
onboards — la M1 Procar, la F40 et la Corvette — et les six autres sur la synthèse.

**Ce qui vaut le plus : un onboard entier.** Pas une série de régimes tenus, pas des fichiers
générés. `tools/enginecut.py` y trouve tout seul les passages à régime tenu, les découpe en
boucles sans couture et les étiquette. Un onboard de dix minutes a donné six boucles pour la M1,
couvrant 4211 à 8421 tr/min.

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


## Ce qu'a donné la première génération

Six fichiers ont été déposés dans `six-inline/`. Mesurés avant d'être utilisés, ils disent deux
choses utiles pour la prochaine fournée.

**Les cinq fichiers `M1_Procar_*_seed_30` ne changent pas de hauteur avec le régime.** Leur bande
dominante tombe entre 105 et 125 Hz dans les cinq, quel que soit le régime écrit dans le nom :

| fichier | bande dominante | allumage attendu |
|---|---|---|
| `idle` | 125,3 Hz | 55 Hz (1100 tr/min) |
| `on-2500` | 125,0 Hz | **125 Hz** ✓ |
| `on-4500` | 125,5 Hz | 225 Hz |
| `off-7000` | 105,0 Hz | 350 Hz |

Seul `on-2500` tombe juste, et l'écart de timbre entre deux de ces fichiers ne dépasse pas 4,9 dB
par bande de tiers d'octave — 2,5 dB entre le ralenti et les 4500. Autrement dit, c'est cinq fois
à peu près le même son. Le paramètre de régime n'a pas agi.

**`on-6000.wav` est d'une autre nature.** Sa corrélation période à période vaut 0,895 contre 0,384
pour `on-2500` : c'est un signal franchement périodique, avec une vraie série harmonique qui monte
et descend et des passages de rapport visibles au sonagramme. Sa bande dominante est à 360 Hz, soit
7200 tr/min pour un six et non les 6000 du nom.

**Pour la prochaine génération**, ce qui se vérifie en une commande :

```
node tools/e2e-sample.js        # le régime déclaré correspond-il à la prise ?
```

Deux exigences, dans l'ordre d'importance :

1. **Que la hauteur suive le régime demandé.** C'est ce qui manque le plus : sans elle il n'y a
   qu'un seul son, et le jeu ne peut que le transposer — ce qu'il fait déjà tout seul à partir
   d'un fichier unique, sans avoir besoin des quatre autres.
2. **Que le signal soit périodique.** Viser la corrélation de `on-6000` (0,895) plutôt que celle
   des cinq autres (0,38 à 0,77). Un moteur est une suite d'explosions régulières ; un souffle
   filtré qui pulse n'en est pas un, même bien pulsé.

Et une remarque qui fait gagner du temps : **une seule montée en régime propre suffit**.
`tools/engineloop.py` en tire une boucle sans couture, et le jeu transpose. La série de régimes
tenus n'a d'intérêt que si chacun sonne vraiment à son régime.


## Ce qu'il faut enregistrer

L'état de l'art du son de moteur de jeu demande **trois prises par voiture**, et rien d'autre :

1. **La montée** — plein gaz, **un seul rapport**, du plus bas régime tenable jusqu'au rupteur,
   d'un seul tenant. Une dizaine de secondes. C'est la pièce maîtresse : le lecteur s'y déplace et
   ne transpose jamais, donc **la plage qu'elle couvre est exactement celle qu'elle parcourt**.
2. **La descente** — pied levé, du rupteur au ralenti, en roue libre. C'est ce qui donne le frein
   moteur et les décélérations ; aujourd'hui le pied levé rejoue la montée, simplement assombrie.
3. **Le ralenti** — quelques secondes de régime stable, moteur chaud, à l'arrêt.

Ce qui rend une prise inutilisable : un changement de rapport au milieu de la montée (la hauteur
chute d'un coup), un lever de pied, un coup de frein, une voiture qui passe, une voix.

| ce qu'on a | durée | montée | plage couverte |
|---|---|---|---|
| M1 Procar | 8,0 s | 17 demi-tons | 3423 – 9000 tr/min |
| Corvette Trans-Am | 7,6 s | 14 demi-tons | 2708 – 6000 tr/min |
| F40 LM | 4,2 s | 9 demi-tons | 4703 – 7750 tr/min |

Ces trois rampes ont été trouvées automatiquement dans les onboards, et c'est leur limite : un
onboard de course ne contient presque jamais une montée complète sur un seul rapport — le pilote
passe un rapport toutes les deux ou trois secondes. D'où la F40, qui ne couvre que neuf demi-tons
et repasse à la synthèse en dessous de 4700 tr/min.

**Une montée découpée à la main vaut donc mieux que n'importe quel réglage.** Cherche dans une
vidéo un départ arrêté, une sortie de stand ou une reprise en côte : ce sont les moments où le
pilote tient un rapport longtemps.

## Ce que les onboards ont donné automatiquement
