// Un SVG rendu en PNG par Chromium, à sa taille (960 × 640 pour un fond de circuit).
//   NODE_PATH=$(npm root -g) node tools/svg-en-png.js <entrée.svg> <sortie.png>
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [,, SVG, OUT] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });
  await p.setContent(`<html><body style="margin:0">${fs.readFileSync(SVG, 'utf8')}</body></html>`);
  await p.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 960, height: 640 } }); await b.close();
})();
