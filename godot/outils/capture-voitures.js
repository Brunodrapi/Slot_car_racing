/* Les dessins des voitures, tels que le jeu web les prépare, pour la version Godot.

     NODE_PATH=$(npm root -g) node godot/outils/capture-voitures.js

Pour chaque voiture et chaque livrée : la vue de dessus (art.img), son ombre (art.shadow, calculée
par js/carart.js), la place et la taille des pneus, et les bras de suspension des monoplaces.
Écrit godot/images/voitures/<voiture>-<livrée>.png et -ombre.png, la vignette du menu
(godot/images/vignettes/), et godot/donnees/dessins.json. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');
const IMG = path.join(ROOT, 'godot', 'images', 'voitures'), VIG = path.join(ROOT, 'godot', 'images', 'vignettes');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

(async () => {
  for (const d of [IMG, VIG]) fs.mkdirSync(d, { recursive: true });
  const srv = http.createServer((q, s) => {
    let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html';
    const f = path.join(ROOT, u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(s);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: 800, height: 600 } });
  await page.goto(`http://127.0.0.1:${srv.address().port}`);
  await page.waitForFunction(() => typeof MODELS !== 'undefined' && typeof topArt === 'function');
  const liste = await page.evaluate(() => MODELS.map((m) => ({ id: m.id, n: Math.max(1, (m.livrees || []).length) })));
  const dessins = {};
  let images = 0;
  for (const { id, n } of liste) for (let li = 0; li < n; li++) {
    const d = await page.evaluate(async ({ id, li }) => {
      const m = modelById(id);
      for (let k = 0; k < 200 && !topArt(m, li)?.img?.naturalWidth; k++) { topArt(m, li); await new Promise((r) => setTimeout(r, 25)); }
      const art = topArt(m, li);
      if (!art || !art.img.naturalWidth) return null;
      const [w, h] = topSize(m, art);
      const png = (img) => { const c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
        c.getContext('2d').drawImage(img, 0, 0); return c.toDataURL('image/png').split(',')[1]; };
      const roues = (l) => l.map((p) => ({ x: p.x, y: p.y, longueur: p.length, largeur: p.width, r: p.r }));
      const lay = wheelLayout(m, { livree: li }).front || {};
      const susp = [];
      if (lay.suspension) for (const hub of tirePositions(lay, w, h, { steer: 0 })) for (const off of [-0.075, 0.035]) {
        const x = hub.x + off * w, t = h * 0.012;
        susp.push([x - t, 0, hub.x - t, hub.y, hub.x + t, hub.y, x + t, 0]);
      }
      const lv = livreeDe(m, li);
      return { w, h, arriere: roues(rearTires(m, w, h, { livree: li })), avant: roues(frontTires(m, w, h, { livree: li, steer: 0 })),
        dessus: !!lay.aboveBody, suspension: susp, pick: lv.pick || m.pick || null, img: png(art.img), ombre: png(art.shadow) };
    }, { id, li });
    if (!d) { console.log('  sans dessin :', id, li); continue; }
    fs.writeFileSync(path.join(IMG, `${id}-${li}.png`), Buffer.from(d.img, 'base64'));
    fs.writeFileSync(path.join(IMG, `${id}-${li}-ombre.png`), Buffer.from(d.ombre, 'base64'));
    let vignette = null;
    if (d.pick && fs.existsSync(path.join(ROOT, d.pick))) {
      vignette = `${id}-${li}${path.extname(d.pick)}`;
      fs.copyFileSync(path.join(ROOT, d.pick), path.join(VIG, vignette));
    }
    delete d.img; delete d.ombre; delete d.pick;
    dessins[`${id}/${li}`] = { ...d, vignette };
    images++;
  }
  fs.writeFileSync(path.join(ROOT, 'godot', 'donnees', 'dessins.json'), JSON.stringify({ ombre: [0.25, 0.35], ombreAlpha: 0.3, dessins }) + '\n');
  console.log(`${images} livrées dessinées → godot/images/voitures, ${fs.readdirSync(VIG).length} vignettes`);
  await nav.close(); srv.close();
})();
