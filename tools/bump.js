// Raise the version the page shows, and break the browser's cache along with it.
//
//   node tools/bump.js [patch|minor|major]      (patch by default)
//
// Two things move together on purpose. The number in `js/version.js` is what the menu prints, so
// a screenshot says which build it came from. The `?v=` on every script and stylesheet is what
// makes a browser go and fetch those files again — without it the number changes in the source
// and nobody ever sees it, which is the exact failure this is meant to catch.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGES = ['index.html', 'editor.html'];
const kind = process.argv[2] || 'patch';

const vf = path.join(ROOT, 'js', 'version.js');
let src = fs.readFileSync(vf, 'utf8');
const cur = /const APP_VERSION = '([^']+)'/.exec(src);
if (!cur) { console.error('version introuvable dans js/version.js'); process.exit(1); }

const [maj, min, pat] = cur[1].split('.').map(Number);
const next = kind === 'major' ? `${maj + 1}.0.0` : kind === 'minor' ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;
const today = new Date().toISOString().slice(0, 10);

src = src.replace(/const APP_VERSION = '[^']+'/, `const APP_VERSION = '${next}'`)
  .replace(/const APP_DATE = '[^']+'/, `const APP_DATE = '${today}'`);
fs.writeFileSync(vf, src);

let touched = 0;
for (const page of PAGES) {
  const f = path.join(ROOT, page);
  if (!fs.existsSync(f)) continue;
  let html = fs.readFileSync(f, 'utf8');
  // src="js/x.js" or src="js/x.js?v=0.13.0" → src="js/x.js?v=<next>", same for the stylesheet
  const before = html;
  html = html.replace(/((?:src|href)=")([^"?]+\.(?:js|css))(?:\?v=[^"]*)?(")/g, (m, a, file, z) => `${a}${file}?v=${next}${z}`);
  if (html !== before) { fs.writeFileSync(f, html); touched++; }
}

console.log(`${cur[1]} → ${next}  (${today}), ${touched} page(s) réécrite(s)`);
