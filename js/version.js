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

const APP_VERSION = '0.20.3';
const APP_DATE = '2026-09-24';
