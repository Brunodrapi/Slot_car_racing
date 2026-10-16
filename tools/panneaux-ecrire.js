/* ÉCRIRE UN BLOC `panneaux:` DANS js/tracks.js, et rester dans le circuit visé.

Un seul endroit pour ça, parce que la première version s'est trompée de circuit et l'a dit avec
aplomb. Elle cherchait `panneaux: [` après `id: 'monza'` : sept circuits sur douze n'en avaient pas,
et `indexOf` ne rend pas « rien », il rend le bloc du circuit SUIVANT, qui s'est donc fait écraser.
Le compteur annonçait « 1 bloc réécrit » à chaque fois, et il avait raison — il avait bien réécrit un
bloc, le mauvais. Un `indexOf` sans borne trouve toujours quelque chose, et c'est ce qui le rend
dangereux.

On borne donc la recherche à l'entrée du circuit, d'un `id:` au suivant, et quand il n'y a pas de
bloc on en INSÈRE un plutôt que d'aller en chercher un ailleurs.

Les crochets se comptent au lieu de se chercher : une expression régulière sur `panneaux: [ ... ]`
s'arrête au premier `]`, qui est celui de la première entrée. C'est le même piège que le scanneur
d'accolades de l'éditeur, et il se répare pareil. */
/* LES CIRCUITS POSÉS À LA MAIN, et pourquoi la liste est ici.

Bruno pose ses annonces dans `lignes.html`, virage par virage, et ce qu'il pose n'est pas une
approximation de ce que la règle calcule : c'est l'intention, y compris là où la géométrie ne peut
pas la deviner. Deux exemples qu'aucun calcul ne rend : la chicane de Monaco, dont les deux premières
flèches partent à droite et les deux dernières à gauche parce que c'est l'ordre dans lequel on tourne
le volant ; et la note `chicane` elle-même, que `Track.noteVirage` ne rend jamais.

Le générateur ne réécrit donc pas ces circuits. Il les CALCULE quand même et affiche l'écart — c'est
la seule calibration dont on dispose, et elle a déjà corrigé la règle trois fois. */
const POSES = ['monza', 'monaco', 'silverstone', 'suzuka', 'interlagos', 'laguna', 'nurburgring', 'lemans', 'bathurst', 'redbullring', 'zandvoort'];

/* LES CIRCUITS VÉRIFIÉS, qui ne sont pas la même chose que les circuits posés.

Spa n'a pas été posé à la main : la règle l'a calculé, et Bruno l'a parcouru et dit bon. Les deux
états se protègent pareil — le générateur n'y revient pas — mais ils ne disent pas la même chose. Une
liste posée est l'intention de l'auteur, et la règle s'y mesure. Une liste vérifiée est un résultat
de la règle que l'auteur a ACCEPTÉ, ce qui est la meilleure nouvelle qu'elle puisse recevoir : à Spa,
quinze freinages trouvés tout seuls et gardés tels quels.

C'est aussi pour ça qu'on la fige. Un seuil retouché plus tard pour un autre circuit déplacerait sans
un mot une liste déjà approuvée, et personne ne le verrait avant d'y rouler. */
const VERIFIES = ['spa'];

const FIGES = [...POSES, ...VERIFIES];

function ecrireBlocs(txt, blocs, journal) {
  let faits = 0, ajouts = 0;
  for (const id of Object.keys(blocs)) {
    const ancre = txt.indexOf(`id: '${id}'`);
    if (ancre < 0) { journal('circuit introuvable dans tracks.js : ' + id); continue; }
    const suivant = txt.indexOf("id: '", ancre + 5);
    const borne = suivant < 0 ? txt.length : suivant;
    const bloc = 'panneaux: [\n' + blocs[id] + '\n    ],';
    const deb = txt.indexOf('panneaux: [', ancre);
    if (deb >= 0 && deb < borne) {
      let i = txt.indexOf('[', deb), prof = 0, fin = -1;
      for (; i < txt.length; i++) {
        if (txt[i] === '[') prof++;
        else if (txt[i] === ']') { prof--; if (!prof) { fin = i; break; } }
      }
      if (fin < 0) { journal('bloc non refermé : ' + id); continue; }
      // la virgule qui suit, s'il y en a une, fait déjà partie du bloc qu'on réécrit
      const apres = txt[fin + 1] === ',' ? fin + 2 : fin + 1;
      txt = txt.slice(0, deb) + bloc + txt.slice(apres);
      faits++;
    } else {
      // pas de bloc : on l'insère juste après `pts:`, qui existe pour tous les circuits intégrés
      const pts = txt.indexOf('pts: ', ancre);
      if (pts < 0 || pts > borne) { journal('rien où insérer : ' + id); continue; }
      const eol = txt.indexOf('\n', pts) + 1;
      txt = txt.slice(0, eol) + '    ' + bloc + '\n' + txt.slice(eol);
      ajouts++;
    }
  }
  return { txt, faits, ajouts };
}

/* LE COMPTE DES BLOCS AVANT ET APRÈS, parce que c'est lui qui a attrapé le bug.

Écrire onze blocs et n'en avoir que cinq dans le fichier, cinq avant comme après : le compteur
d'écritures disait onze et ne mentait pas. Seul le total du fichier le voyait. */
function compterBlocs(txt) { return (txt.match(/panneaux: \[/g) || []).length; }

if (typeof module !== 'undefined') module.exports = { ecrireBlocs, compterBlocs, POSES, VERIFIES, FIGES };
