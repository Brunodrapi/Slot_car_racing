# Drapeaux — hybrid 0.36.0

Disponibles en solo, en contre-la-montre et en multijoueur, y compris chez les spectateurs.
Il n’y a pas de drapeau vert : en situation normale aucun carré n’est affiché.

| Drapeau | Déclenchement | Fin / effet |
| --- | --- | --- |
| Bleu | Une voiture ayant presque un tour d’avance arrive derrière un retardataire, à proximité selon sa vitesse de rapprochement | Le retardataire devient translucide et ne participe plus aux contacts voiture–voiture. Les barrières, surfaces et coupures moteur restent actives. |
| Jaune | Une voiture reste hors piste pendant **3 secondes** ; la voie des stands est exclue | Reste actif tant que la voiture est dehors. Une section de piste de 35 m avant à 15 m après l’incident est peinte en jaune, également sur les cartes. |
| Noir et blanc | Une pénalité est ajoutée, ou le tour devient invalide en contre-la-montre | Signal personnel pendant **5 secondes** ; la sanction / l’invalidité conserve sa durée et ses effets habituels. |
| Damier | Le leader commence son dernier tour | Maintenu pendant le dernier tour, l’arrivée et le délai réglementaire de clôture de la course. |

Les carrés sont à côté du chrono courant. Une sanction personnelle est prioritaire sur le bleu,
puis le jaune ; le damier reste affiché à côté lorsqu’un autre drapeau est actif. Les zones jaunes
restent visibles sur les cartes même si le carré personnel montre une sanction ou un bleu.

Les mini-cartes et la vue circuit complet indiquent les secteurs jaunes, les drapeaux personnels
près des voitures et le damier à la ligne de départ. La vue de dessus montre aussi les carrés
près des voitures. Le tableau spectateur conserve un chrono de course et les carrés du pilote suivi.

Le bleu distingue les retardataires des voitures qui se disputent une position, même autour de
la ligne de départ. Il est conservé brièvement après le passage, et tant qu’une autre carrosserie
chevauche encore la voiture, pour ne pas la rendre solide au milieu d’un dépassement. L’IA ignore
ces voitures comme obstacles. Les contacts sont supprimés dans le solveur solo et dans l’arbitre
multijoueur ; un propriétaire sous bleu acquitte sans appliquer une ancienne correction de contact.

En multijoueur, l’hôte produit et diffuse les bleus, les incidents jaunes et le damier. Les
changements de drapeau sont transmis sans attendre le prochain contrôle périodique. Les sanctions
locales sont affichées immédiatement puis partagées. Cela ne retire pas le délai Internet.

## Vérifications

- `node tools/flags-test.js` : rattrapage, absence de faux bleu dans une bataille, fin du fantôme
  sans chevauchement solide, collisions normales, IA, véritable impact contre une barrière,
  jaune après trois secondes et disparition au retour, stands, sanction, tour TT invalide,
  damier persistant et données de partage.
- `node tools/net-owned-test.js` : conserve les vérifications de physique locale ; vérifie aussi
  la diffusion des bleus / sanctions, l’absence de contact arbitré sous bleu et l’acquittement
  d’une correction ignorée.
- `tools/e2e-flags.js` : carrés réellement peints dans le HUD en paysage et portrait, tous les
  drapeaux en solo, tour TT annulé, deux pilotes et un spectateur, jaune sur la vue complète et
  la mini-carte, sanction et damier simultanés, absence d’erreur JavaScript.

Les images utilisent des positions, temps et incidents de test injectés. Le test multijoueur
utilise le transport local contrôlé avec 30 ms par trajet ; ce n’est pas une mesure Internet.

## Captures

- [Jaune sur téléphone](yellow-390.png)
- [Bleu en vue circuit complet](multi-bleu-top-view.png)
- [Secteur jaune en vue complète](multi-jaune-top-view.png)
- [Secteur jaune sur la mini-carte](multi-jaune-minicarte.png)
- [Sanction et damier simultanés](multi-sanction-et-damier.png)
