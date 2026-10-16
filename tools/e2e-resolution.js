// Les voitures Retina restent identiques quand le décor passe de ×2 à ×1.
// node tools/e2e-resolution.js [dossier de captures]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2] || '/tmp/slot-resolution';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.resolve(ROOT, '.' + (url === '/' ? '/index.html' : url));
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch();
    for (const [name, width, height, dpr] of [['iphone', 390, 844, 3], ['desktop', 1280, 720, 2]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, locale: 'fr-FR' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.waitForFunction(() => window.app && app.save);
      await page.evaluate(() => { app.save.name = 'Testeur'; app.mondial = null; app.startQuick('race', 'gt', 'monza'); });
      await page.waitForFunction(() => app.race && app.race.state === 'racing');
      await page.keyboard.down('Space');
      await page.waitForFunction(() => app.race.player.v > 15);
      await page.keyboard.up('Space');
      const result = await page.evaluate(() => {
        app.state = 'inspection'; app.ui.hide();
        const r = app.renderer;
        r.autoRes = false;
        const camera = JSON.stringify(r.cam);
        const render = dpr => {
          r.dpr = dpr; r.resize(); r.draw(app.race, app.ui);
          return r.carCtx.getImageData(0, 0, r.carCanvas.width, r.carCanvas.height).data;
        };
        const full = render(2), low = render(1);
        let different = 0, opaque = 0;
        for (let i = 0; i < full.length; i++) if (full[i] !== low[i]) different++;
        for (let i = 3; i < low.length; i += 4) if (low[i] > 128) opaque++;
        const cars = app.race.cars;
        app.race.cars = []; r.draw(app.race, app.ui);
        const empty = r.carCtx.getImageData(0, 0, r.carCanvas.width, r.carCanvas.height).data;
        let ghosts = 0;
        for (let i = 3; i < empty.length; i += 4) if (empty[i]) ghosts++;
        app.race.cars = cars; r.draw(app.race, app.ui);
        return { different, opaque, ghosts, cameraStable: camera === JSON.stringify(r.cam),
          carWidth: r.carCanvas.width, worldWidth: r.canvas.width };
      });
      assert.ok(result.opaque > 1000, 'aucune voiture suffisamment visible');
      assert.equal(result.different, 0, 'la qualité des voitures dépend encore de celle du décor');
      assert.ok(result.cameraStable, 'le cadrage a changé');
      assert.equal(result.ghosts, 0, 'les anciennes voitures laissent des traces');
      assert.equal(result.carWidth, width * dpr);
      assert.equal(result.worldWidth, width);
      await page.screenshot({ path: path.join(OUT, `${name}-decor-x1.png`) });
      await page.setViewportSize({ width: height, height: width });
      await page.waitForFunction(() => app.renderer.carCanvas.width === innerWidth * devicePixelRatio);
      assert.deepEqual(errors, []);
      console.log(`${name}: voitures identiques pixel par pixel en décor ×1 et ×2, rotation OK`);
      await context.close();
    }
    // Suzuka : une vraie voiture est masquée sous le croisement, visible sur le tablier.
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.app && app.save);
    await page.evaluate(() => { app.mondial = null; app.save.name = 'Testeur'; app.startQuick('race', 'gt', 'suzuka'); });
    await page.waitForFunction(() => app.race && app.race.state === 'racing');
    const bridge = await page.evaluate(() => {
      app.state = 'inspection'; app.ui.hide();
      const r = app.renderer, race = app.race, T = race.track, p = race.player;
      r.autoRes = false; r.dpr = 1; r.resize(); r.setView('fixed');
      race.cars = [p];
      const crossing = T.crossings[0];
      if (!crossing) throw new Error('croisement de Suzuka absent');
      const sample = station => {
        const k = station % T.n;
        p.s = k * T.ds; p.x = T.xs[k]; p.y = T.ys[k]; p.th = T.th[k];
        r.cam = { x: p.x, y: p.y, zoom: 8, init: true };
        r.draw(race, app.ui);
        const cx = Math.round(r.carCanvas.width / 2), cy = Math.round(r.carCanvas.height / 2);
        const pixels = r.carCtx.getImageData(cx - 3, cy - 3, 6, 6).data;
        return [...pixels].filter((_, i) => i % 4 === 3).reduce((sum, alpha) => sum + alpha, 0);
      };
      return { under: sample(crossing.under), over: sample(crossing.over) };
    });
    assert.equal(bridge.under, 0, 'la voiture apparaît à travers le pont');
    assert.ok(bridge.over > 1000, 'la voiture disparaît sur le pont');
    console.log('Suzuka : visibilité au-dessus et masquage au-dessous du pont OK');
    await page.close();
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
