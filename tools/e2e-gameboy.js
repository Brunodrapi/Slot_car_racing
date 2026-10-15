// Thème global : menus, palette de course, rotation, préférence et retour au style classique.
// node tools/e2e-gameboy.js [dossier de captures]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2] || '/tmp/slot-gameboy';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf' };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((req, res) => {
    const file = path.resolve(ROOT, '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch();
    for (const [width, height] of [[390, 844], [1280, 720], [1254, 1254]]) {
      const context = await browser.newContext({ locale: 'fr-FR', viewport: { width, height }, deviceScaleFactor: width < 700 ? 3 : 2 });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const base = `http://127.0.0.1:${server.address().port}`;
      await page.goto(base);
      await page.waitForFunction(() => window.app && app.save);
      await page.evaluate(() => document.fonts.load('12px "GB Pixel"'));
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'gameboy');
      await page.screenshot({ path: path.join(OUT, `title-${width}.png`) });
      await page.evaluate(() => { app.save.name = 'Testeur'; app.mondial = null; storeSave(app.save); });
      await page.waitForTimeout(350);
      await page.keyboard.press('Enter');
      await page.waitForSelector('.gb-menu');
      assert.equal(await page.locator('.gb-menu button').count(), 4);
      assert.ok(await page.evaluate(() => document.querySelector('.screen').scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(OUT, `menu-${width}.png`) });
      await page.click('[data-action="settings"]');
      await page.selectOption('#sel-theme', 'classic');
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'classic');
      await page.reload();
      await page.waitForFunction(() => window.app && app.save);
      assert.equal(await page.evaluate(() => app.save.visualTheme), 'classic');
      await page.evaluate(() => { app.mondial = null; app.ui.settings(); });
      await page.selectOption('#sel-theme', 'gameboy');
      await page.reload();
      await page.waitForFunction(() => window.app && app.save);
      assert.equal(await page.evaluate(() => app.save.visualTheme), 'gameboy');
      await page.evaluate(() => { app.mondial = null; app.startQuick('race', 'gt', 'monza'); });
      await page.waitForFunction(() => app.race && app.race.state === 'racing');
      await page.keyboard.down('Space');
      await page.waitForFunction(() => app.race.time > 5 && app.race.player.v > 5);
      const palette = await page.evaluate(() => {
        const renderer = app.renderer;
        const colours = new Set();
        for (const [canvas, ctx] of [[renderer.canvas, renderer.ctx], [renderer.carCanvas, renderer.carCtx], [renderer.hudCanvas, renderer.hudCtx]]) {
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          for (let i = 0; i < pixels.length; i += 4) {
            if (!pixels[i + 3]) continue;
            if (pixels[i + 3] !== 255) throw new Error('un pixel LCD partiellement transparent');
            colours.add('#' + [...pixels.slice(i, i + 3)].map(v => v.toString(16).padStart(2, '0')).join(''));
          }
        }
        return [...colours].sort();
      });
      assert.deepEqual(palette, ['#112718', '#30472c', '#819a56', '#c6d384'].sort());
      assert.equal(await page.evaluate(() => app.renderer._gb.canvas.width), 320);
      const carDetail = await page.evaluate(() => {
        const r = app.renderer, p = app.race.player, art = topArt(p.cls, p.livree);
        const sprite = r._artGB(art.img);
        return { pixels: p.cls.length * r.cam.zoom * r._gb.cars.width / r.w,
          cached: sprite === r._artGB(art.img), numbered: art.gbNumbers.has(p.number) };
      });
      assert.equal(await page.evaluate(() => app.renderer._gb.cars.width), width * (width < 700 ? 3 : 2));
      assert.ok(carDetail.pixels >= 24, `voiture trop petite : ${carDetail.pixels} pixels`);
      assert.ok(carDetail.cached && carDetail.numbered);

      await page.screenshot({ path: path.join(OUT, `race-${width}.png`) });
      await page.keyboard.up('Space');
      await page.keyboard.press('Escape');
      await page.waitForSelector('[data-action="resume"]');
      await page.click('[data-action="resume"]');
      await page.setViewportSize({ width: height, height: width });
      await page.waitForFunction(() => app.renderer.w === innerWidth && app.renderer._gb.canvas.height === Math.round(innerHeight * Math.min(1, 320 / innerWidth)));
      await page.evaluate(() => { app.save.visualTheme = 'classic'; app.applyVisualTheme(); app.startQuick('race', 'gt', 'spa'); });
      await page.waitForFunction(() => app.race && app.race.track.id === 'spa' && !app.renderer.gameboy);
      await page.evaluate(() => app.startQuick('race', 'gt', 'spa-gameboy'));
      await page.waitForFunction(() => app.renderer.gameboy);
      await page.waitForFunction(() => GB_ATLAS.ready && app.renderer.topArt['arbre-1'].gbAtlas && app.race.state === 'racing');
      const atlas=await page.evaluate(()=>{
        const r=app.renderer,tree=r.topArt['arbre-1'];
        const pixels=tree.canvas.getContext('2d').getImageData(0,0,tree.canvas.width,tree.canvas.height).data;
        let clear=0,opaque=0,checker=0;
        for(let i=0;i<pixels.length;i+=4){
          if(!pixels[i+3])clear++;else{opaque++;if(![24,125,202,255].includes(pixels[i]))checker++;}
        }
        return {clear,opaque,checker,used:r.topProps.filter(p=>r.topArt[p.id]?.gbAtlas).length,
          texture:!!r.asphaltPattern&&r.gravierMotif===r.gbGravelPattern};
      });
      assert.ok(atlas.clear>100&&atlas.opaque>1000&&atlas.used>500);
      assert.equal(atlas.checker,0);assert.ok(atlas.texture);
      await page.keyboard.down('Space');
      await page.waitForFunction(()=>app.race.player.v>15);
      await page.keyboard.up('Space');
      await page.screenshot({path:path.join(OUT,`spa-atlas-${width}.png`)});
      await page.evaluate(()=>app.startQuick('race','gt','monza'));
      assert.equal(await page.evaluate(()=>!!app.renderer.topArt['arbre-1'].gbAtlas),false);
      assert.deepEqual(errors, []);
      console.log(`${width}×${height}: menus, quatre tons, course, pause, rotation et préférence OK`);
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
