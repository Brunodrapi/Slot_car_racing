# Jour / Nuit — 0.54.2

Choisir **Nuit** dans la préparation ou, pour tous les participants, dans le salon de l’hôte.
Les F1 n’ont pas de phares. Les GT, GT3 et prototypes éclairent devant leur carrosserie ; les
projecteurs proches des bacs à gravier éclairent devant eux, sans halo circulaire. La piste est
principalement éclairée par les phares ; aucun halo ne suit le joueur. Les feux
arrière sont deux cônes rouges très légers, sans rectangles lumineux. Au freinage, ils
s’allongent et éclairent davantage le sol, tout en restant moins intenses que les phares. Les
phares avant ont aussi deux faisceaux ; leur extrémité et celle des projecteurs s’estompent plus
progressivement. L’obscurité revient en
quittant la lumière,
sans découverte permanente du terrain. Les commandes, le classement et le tracé de la mini-carte
restent lisibles ; les positions des adversaires éloignés/non éclairés ne sont plus indiquées.

- [Deux cônes avant et feux arrière discrets](feux-roulants-pc.png)
- [Feux arrière au freinage](feux-freinage-pc.png)
- [Freinage sur mobile](feux-freinage-mobile.png)
- [GT3 sur PC](nuit-pc.png)
- [GT3 sur mobile](nuit-mobile.png)
- [Projecteurs sur les bacs à gravier de Spa](spa-gravier-pc.png)
- [Spa sur mobile](spa-gravier-mobile.png)
- [F1 sans phares](f1-nuit-pc.png)
- [Résultat des contrôles automatisés](verification.json)

Contrôles : choix et sauvegarde, reprise des anciennes sauvegardes, course/entraînement/chrono,
phares selon catégorie, orientation avec le cap, masque presque opaque hors éclairage, fantôme
sans lumière, deux faisceaux avant et arrière, freinage rouge plus intense, absence de rectangles
lumineux, décroissance progressive des phares et projecteurs, absence de halo joueur, projecteurs éclairant uniquement devant eux, emplacement
sur les zones de gravier et absence de rangée de lampadaires continue, 14 circuits, quatre caméras,
redimensionnement/DPR, retour Jour et sortie de course.
Le test à deux navigateurs (`tools/e2e-net.js … race --night`) vérifie le choix imposé par l’hôte,
le contrôle désactivé chez l’invité et le rendu nocturne des deux courses. Le protocole de salon
change de version pour empêcher un ancien client sans mode Nuit de rejoindre une course nouvelle.
La physique et les chronos ne changent pas ; `tools/net-owned-test.js` et `tools/flags-test.js` passent.
Les temps du rapport sont des mesures du navigateur de test, pas des garanties sur un téléphone.
