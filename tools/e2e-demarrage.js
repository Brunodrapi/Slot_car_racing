// « En piste » : le moteur démarre (js/audio.js, DEMARRAGE). Servi en http (le son se charge par fetch).
//
//   NODE_PATH=$(npm root -g) node tools/e2e-demarrage.js
'use strict';
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.png': 'image/png', '.ogg': 'audio/ogg', '.svg': 'image/svg+xml' };
let fautes = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAUX  ') + m); if (!c) fautes++; };

(async () => {
  const srv = http.createServer((q, r) => {
    const f = path.join(RACINE, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html'));
    if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch();
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' })).newPage();
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(e.message));
  try {
    await p.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
    await p.waitForFunction(() => typeof app !== 'undefined' && app.save);
    await p.evaluate(() => { app.save.name = 'Bruno'; app.save.sound = true; app.audio.enabled = true; app.mondial = null; });
    await p.mouse.click(640, 400);
    await p.evaluate(() => { if (app.state === 'splash') app.leaveSplash(); app.ui.setupScreen('timetrial'); });
    await p.waitForFunction(() => app.audio.demarrageBuf, null, { timeout: 10000 });
    const d = await p.evaluate(() => app.audio.demarrageBuf.duration);
    ok(d > 5 && d < 6, `le son est chargé avant « En piste » (${d.toFixed(2)} s)`);
    await p.locator('[data-action="startQuick"]').click();
    await p.waitForTimeout(300);
    ok(await p.evaluate(() => app.audio.demarrages === 1), '« En piste » : le moteur démarre, une fois');
    // le moteur de la course se tait le temps du démarrage, puis prend le relais
    const parts = await p.evaluate(() => { const a = app.audio, t0 = a.demarrageT0; return [a.partMoteur(t0 + 1), a.partMoteur(t0 + 3.5), a.partMoteur(t0 + 4.3), a.partMoteur(t0 + 5.2)]; });
    ok(parts[0] === 0 && parts[1] === 0 && parts[2] > 0 && parts[2] < 1 && parts[3] === 1, 'le moteur de la course laisse passer le démarrage, puis prend le relais : ' + parts.map((x) => x.toFixed(2)).join(' → '));
    await p.waitForFunction(() => app.race && app.state === 'race', null, { timeout: 30000 });
    ok(erreurs.length === 0, 'pas d\'erreur dans la page' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } catch (e) { console.error(e); fautes++; }
  await browser.close(); srv.close();
  console.log(fautes ? `DÉMARRAGE : ${fautes} faute(s)` : 'DÉMARRAGE OK');
  process.exit(fautes ? 1 : 0);
})();
