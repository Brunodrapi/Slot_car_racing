/* LE RELEVÉ D'UNE REPRISE : relier un trait dessiné sur un export à la géométrie du circuit.

   Les reprises arrivent en images : les vues tour de `tools/export-decor.js`, annotées à la main
   (vert, rouge, blanc, noir, bleu, croix). Pour les appliquer il faut savoir à quelle fraction du
   tour, de quel côté et à quelle distance du bord tombe chaque trait. Ce script refait EXACTEMENT
   le cadrage de l'export (mêmes bornes, même zoom, même centre) et écrit, par circuit, un JSON :

     cam        zoom, centre et échelle (pixels de l'image par mètre)
     track      échantillons du tracé : position, normale, demi-largeurs, vibreur,
                gravier et bitume hors piste de chaque côté, limite de protection
     barriers   segments des protections
     impl       bâtiments, tribunes, parkings de l'implantation (empreintes)

   Il peut aussi régénérer l'image tour à côté du JSON, pour vérifier l'alignement.

     NODE_PATH=$(npm root -g) node tools/releve-reprises.js <dossier> [circuit] [--image]
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'export', 'releve');
const args = process.argv.slice(3);
const IMAGE = args.includes('--image');
const CIRCUIT = args.find((a) => !a.startsWith('--')) || null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.ico': 'image/vnd.microsoft.icon', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp',
  '.ttf': 'font/ttf' };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = http.createServer((q, s) => {
    let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html';
    const f = path.join(ROOT, u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(s);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.log('  ERREUR ' + e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}`);
  await page.waitForFunction(() => typeof app !== 'undefined' && app.save && typeof TRACKS !== 'undefined');
  await page.evaluate(() => { app.save.name = 'Export'; app.mondial = null; storeSave(app.save); });
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const ids = await page.evaluate((id) => TRACKS.filter((t) => !id || t.id === id).map((t) => t.id), CIRCUIT);

  for (const id of ids) {
    await page.evaluate((id) => {
      app.startQuick('timetrial', 'gt', id);
      app.gele = true;
      if (!Renderer.prototype._vraiDraw) {
        const vrai = Renderer.prototype.draw;
        Renderer.prototype._vraiDraw = vrai;
        Renderer.prototype.draw = function (race, ui) { if (!app.gele) vrai.call(this, race, ui); };
        Renderer.prototype._drawHUD = function () {};
      }
    }, id);
    await page.waitForFunction(() => app.race && app.renderer && app.renderer.paths);
    await page.waitForTimeout(500);
    const data = await page.evaluate(() => {
      const r = app.renderer, T = app.race.track, b = { ...T.bounds };
      // Même cadre que tools/export-decor.js.
      const inclure = (x, y, pad = 0) => {
        b.minX = Math.min(b.minX, x - pad); b.maxX = Math.max(b.maxX, x + pad);
        b.minY = Math.min(b.minY, y - pad); b.maxY = Math.max(b.maxY, y + pad);
      };
      for (let i = 0; i < T.n; i += 2) for (const side of [-1, 1]) {
        const s = i * T.ds, hw = side > 0 ? T.hwLeftAt(s) : T.hwRightAt(s);
        const p = T.pos(s, side * (hw + Math.max(T.kerbAt(s), T.runoffWidthAt(s, side))));
        inclure(p.x, p.y);
      }
      for (const wall of T.barriers) { inclure(wall.ax, wall.ay, wall.half); inclure(wall.bx, wall.by, wall.half); }
      const sansVoitures = app.race.cars.slice();
      app.race.cars.length = 0;
      const marge = 64;
      r.cam.zoom = Math.min(r.w / (b.maxX - b.minX + marge), r.h / (b.maxY - b.minY + marge));
      r.cam.x = (b.minX + b.maxX) / 2; r.cam.y = (b.minY + b.maxY) / 2;
      r.rotate = false; r.camAngle = 0;
      r._vraiDraw.call(r, app.race, null);
      app.race.cars.push(...sansVoitures);
      const k = 2;                                   // deviceScaleFactor de la capture
      const px = (x, y) => [+(k * (r.w / 2 + r.cam.zoom * (x - r.cam.x))).toFixed(2),
        +(k * (r.h / 2 + r.cam.zoom * (y - r.cam.y))).toFixed(2)];
      const arr = (a) => Array.from(a || [], (v) => +(+v).toFixed(3));
      const track = { n: T.n, ds: T.ds, length: T.length, px: [], nx: arr(T.nx), ny: arr(T.ny),
        x: arr(T.xs), y: arr(T.ys), hwL: arr(T.hwL), hwR: arr(T.hwR), kerb: arr(T.kerb),
        bacL: arr(T.bacW && T.bacW.L), bacR: arr(T.bacW && T.bacW.R),
        asphL: arr(T.asphaltW && T.asphaltW.L), asphR: arr(T.asphaltW && T.asphaltW.R),
        protL: [], protR: [], level: [] };
      for (let i = 0; i < T.n; i++) {
        const s = i * T.ds;
        track.px.push(px(T.xs[i], T.ys[i]));
        track.protL.push(+T.limiteProtection(s, 1).toFixed(2));
        track.protR.push(+T.limiteProtection(s, -1).toFixed(2));
        track.level.push(T.barrierLevelAt(s));
      }
      const barriers = T.barriers.map((w) => ({ a: px(w.ax, w.ay), b: px(w.bx, w.by), s: +w.s.toFixed(1),
        side: w.side, kind: w.kind, level: w.level || 0 }));
      const im = r.implantation;
      const impl = im ? im.batis.filter((o) => o.type !== 'voiture').map((o) => {
        const cs = Math.cos(o.a), sn = Math.sin(o.a);
        const c = [[-o.l / 2, -o.w / 2], [o.l / 2, -o.w / 2], [o.l / 2, o.w / 2], [-o.l / 2, o.w / 2]]
          .map(([u, v]) => px(o.x + cs * u - sn * v, o.y + sn * u + cs * v));
        return { type: o.type, side: o.side, c, x: o.x, y: o.y };
      }) : [];
      const voitures = im ? im.batis.filter((o) => o.type === 'voiture').map((o) => px(o.x, o.y)) : [];
      const garages = (T.pitGarages ? T.pitGarages() : []).map((g) => ({ ...g, p: px(g.x, g.y) }));
      return { id: T.def.id, cam: { zoom: r.cam.zoom, x: r.cam.x, y: r.cam.y, w: r.w, h: r.h, k,
        ppm: k * r.cam.zoom }, track, barriers, impl, voitures, garages,
        pit: T.pit ? { ...T.pit } : null };
    });
    fs.writeFileSync(path.join(OUT, `${id}.json`), JSON.stringify(data));
    if (IMAGE) await page.locator('canvas').first().screenshot({ path: path.join(OUT, `${id}-tour.png`) });
    console.log(`  ${id.padEnd(12)} ${data.track.n} échantillons, ${data.cam.ppm.toFixed(2)} px/m`);
    await page.evaluate(() => { app.gele = false; app.quitRace && app.quitRace(); });
    await page.waitForTimeout(150);
  }
  await nav.close(); srv.close();
})();
