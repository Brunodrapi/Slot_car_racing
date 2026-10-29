/* The build the page is actually running.

Reason this file exists: the game is a handful of static files served from a branch, and both
GitHub Pages and the browser keep copies. "Is what I am looking at the change that was just
pushed?" is otherwise unanswerable from the screen — you refresh, nothing moves, and there is no
way to tell a deploy that has not happened from a cache that has not expired.

So the menu carries the number, and `tools/bump.js` raises it: it stamps the date here and
rewrites the `?v=` on every script and stylesheet in the pages, which is what actually forces a
browser to fetch the new files.
*/
'use strict';

const APP_VERSION = '0.52.23.1';
const APP_DATE = '2026-10-29';
/* Le canal. Le dépôt, tel quel, EST la recette : c'est lui que sert brunodrapi.github.io/Slot_car_racing,
code source commenté compris. La prod est la version fabriquée par `tools/build-dist.js`, qui écrit
« prod » ici. La recette se reconnaît à l'écran (une pastille RECETTE, « GRIP Recette » sur l'écran
d'accueil de l'iPhone), et ses tables de multijoueur ne croisent pas celles de la prod. */
const APP_CANAL = 'recette';
if (APP_CANAL === 'recette' && typeof document !== 'undefined') {
  const nom = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (nom) { nom.content = 'GRIP Recette'; document.title = 'GRIP Recette'; }
}
