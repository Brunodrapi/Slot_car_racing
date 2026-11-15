#!/usr/bin/env node
// Met à jour le dernier devlog affiché sur l'écran-titre (DERNIER_DEVLOG, js/ui.js) d'après le flux d'itch.io.
//
//   curl -s https://drapiiii.itch.io/grip-racing-the-line/devlog.rss | node tools/dernier-devlog.js [--force]
//
// Le flux arrive par l'entrée standard plutôt que d'être lu ici : `curl` passe par le proxy du
// conteneur, le `fetch` de Node non. On prend le premier billet du flux (le plus récent), son numéro
// (« GRIP Devlog #3 — … »), son titre (ce qui suit le tiret) et son adresse.
//
// On ne recule pas : si le flux n'a pas encore le billet que l'écran-titre annonce (il est annoncé
// avant d'être posté, avec un lien vers la page des devlogs), rien ne change. Sauf `--force`, quand
// le billet a été posté sous un autre numéro que celui annoncé (la 0.52.85 annonçait un n° 3 ; Bruno
// l'a posté en n° 2, le « devlog #2 » du dépôt n'ayant jamais paru).
'use strict';
const fs = require('fs');
const path = require('path');

const UI = path.join(__dirname, '..', 'js', 'ui.js');
const xml = fs.readFileSync(0, 'utf8');
const decode = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, '&').trim();

const item = (xml.match(/<item>([\s\S]*?)<\/item>/) || [])[1];
if (!item) { console.error('  pas de billet dans le flux (est-ce bien le flux RSS des devlogs ?)'); process.exit(2); }
const titreComplet = decode((item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
const url = decode((item.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '');
const numero = Number((titreComplet.match(/#\s*(\d+)/) || [])[1]);
// le tiret long ou moyen, espacé ou non (« GRIP Devlog #2— Practice… ») ; le trait d'union, espacé seulement
const titre = titreComplet.split(/\s*[—–]\s*|\s+-\s+/).slice(1).join(' — ').trim();
if (!numero || !titre || !/^https:\/\//.test(url)) { console.error(`  billet illisible : « ${titreComplet} » ${url}`); process.exit(2); }

const source = fs.readFileSync(UI, 'utf8');
const ligne = /const DERNIER_DEVLOG = \{ numero: (\d+), titre: '((?:[^'\\]|\\.)*)', url: '([^']*)' \};/;
const avant = source.match(ligne);
if (!avant) { console.error('  DERNIER_DEVLOG introuvable dans js/ui.js'); process.exit(2); }
if (numero < Number(avant[1]) && !process.argv.includes('--force')) {
  console.log(`  le flux n'a pas encore le n° ${avant[1]} (son dernier billet : n° ${numero}) : rien ne change`
    + `\n  (s'il a été posté sous ce numéro-là, relancer avec --force)`);
  process.exit(0);
}
const q = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const nouvelle = `const DERNIER_DEVLOG = { numero: ${numero}, titre: '${q(titre)}', url: '${q(url)}' };`;
if (nouvelle === avant[0]) { console.log(`  déjà à jour : n° ${numero}, « ${titre} »`); process.exit(0); }
fs.writeFileSync(UI, source.replace(ligne, () => nouvelle));
console.log(`  n° ${avant[1]} « ${avant[2]} » → n° ${numero} « ${titre} »\n  ${url}`);
