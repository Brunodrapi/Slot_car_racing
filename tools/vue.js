/* UNE VUE CADRÉE SUR UN POINT DU MONDE, à l'échelle qu'on veut.

   `export-decor.js` photographie douze circuits et cinq vues chacun : une minute et demie pour
   voir si un réglage a bougé de deux mètres. Celui-ci prend les cadrages en argument et rend la
   main en dix secondes, ce qui change la façon de travailler — on règle à la mesure puis on
   vérifie à l'œil, au lieu de deviner entre deux exports.

   Il fige la boucle de jeu comme l'export, pour ne pas photographier une caméra qui a bougé.

       node tools/vue.js '[["nom", x, y, largeurEnMetres], ...]'

   Les images sortent dans le répertoire de travail de la session. Le circuit est en dur ici :
   c'est un outil de réglage, pas un produit. */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
(async () => {
  const srv = http.createServer((q, r) => {
    const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'index.html');
    fs.readFile(f, (e, d) => e ? (r.writeHead(404), r.end())
      : (r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }), r.end(d)));
  });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: 1100, height: 1100 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('  ERREUR ' + e.message));
  await page.goto(base);
  await page.waitForFunction(() => typeof app !== 'undefined' && app.save);
  await page.evaluate(() => { app.save.name = 'Vue'; app.mondial = null; storeSave(app.save); });
  await page.waitForTimeout(250); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
  await page.waitForFunction(() => typeof decorPret !== 'function' || decorPret(), null, { timeout: 30000 });
  await page.evaluate(() => {
    app.startQuick('timetrial', 'gt', 'zandvoort');
    app.gele = true;
    const vrai = Renderer.prototype.draw;
    Renderer.prototype._vraiDraw = vrai;
    Renderer.prototype.draw = function () {};
    Renderer.prototype._drawHUD = function () {};
  });
  await page.waitForFunction(() => app.race && app.renderer && app.renderer.paths);
  await page.waitForTimeout(400);
  for (const [nom, x, y, m] of JSON.parse(process.argv[2])) {
    await page.evaluate(([x, y, m]) => {
      const r = app.renderer;
      app.race.cars.length = 0;
      r.cam.zoom = r.w / m; r.cam.x = x; r.cam.y = y; r.rotate = false; r.camAngle = 0;
      r._vraiDraw.call(r, app.race, null);
    }, [x, y, m]);
    await page.locator('canvas').first().screenshot({ path: `/tmp/claude-0/-home-user-Slot-car-racing/1db20dc9-ebd3-5efc-a770-ef402b418e20/scratchpad/${nom}.png` });
    console.log(nom);
  }
  await nav.close(); srv.close();
})();
