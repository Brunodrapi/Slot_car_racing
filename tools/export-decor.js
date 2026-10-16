/* L'EXPORT DU DÉCOR : chaque circuit tel que le jeu le peint aujourd'hui.

   Pour retravailler un décor il faut d'abord le VOIR, et le voir à la bonne échelle. Une vue du
   tour entier dit la forme et les couleurs d'ensemble ; elle ne dit rien du rendu, parce qu'un
   arbre y fait trois pixels. C'est à l'échelle de jeu que le style se juge — c'est là qu'on
   regarde pendant une course. L'export donne donc les deux, et pour chaque circuit :

     <circuit>-tour.png      le tour entier, décor compris
     <circuit>-<n>.png       quatre vues à l'échelle de jeu, réparties sur le tour

   Le HUD est retiré et les voitures aussi : on exporte le MONDE, pas une partie. La trajectoire
   non plus — ce sont des lignes de jeu, pas du décor.

     NODE_PATH=$(npm root -g) node tools/export-decor.js [dossier] [circuit]
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'export', 'decor');
const TOUR_ONLY = process.argv.includes('--tour-only');
const CIRCUIT = process.argv[3] && process.argv[3] !== '--tour-only' ? process.argv[3] : null;
const VIEW_W = +(process.env.EXPORT_WIDTH || 1280), VIEW_H = +(process.env.EXPORT_HEIGHT || 800);
const DPR = +(process.env.EXPORT_DPR || 2);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.ico': 'image/vnd.microsoft.icon', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp' };

// quatre endroits du tour, en fraction : assez écartés pour tomber sur des décors différents
const VUES = [0.08, 0.33, 0.58, 0.83];

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
  const base = `http://127.0.0.1:${srv.address().port}`;
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: VIEW_W, height: VIEW_H }, deviceScaleFactor: DPR });
  const errors=[];
  page.on('pageerror', (e) => { errors.push(e.message); console.log('  ERREUR ' + e.message); });
  await page.goto(base);
  await page.waitForFunction(() => typeof app !== 'undefined' && app.save && typeof TRACKS !== 'undefined');
  await page.evaluate(() => { app.save.name = 'Export'; app.mondial = null; storeSave(app.save); });
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);

  const circuits = await page.evaluate(id => TRACKS.filter(t => !id || t.id === id).map((t) => ({ id: t.id, nom: t.name, theme: t.theme || 'park' })), CIRCUIT);
  if (!circuits.length) { await nav.close(); srv.close(); throw Error('Circuit inconnu : ' + CIRCUIT); }
  console.log(`${circuits.length} circuits -> ${OUT}\n`);

  for (const c of circuits) {
    await page.evaluate((id) => {
      app.startQuick('timetrial', 'gt', id);
      /* On fige la boucle : sans ça le moteur redessine entre notre image et la capture, et on
         photographie une caméra qui a bougé. On garde la main sur `draw`, qu'on appelle nous-mêmes. */
      app.gele = true;
      const vrai = Renderer.prototype.draw;
      if (!Renderer.prototype._vraiDraw) {
        Renderer.prototype._vraiDraw = vrai;
        Renderer.prototype.draw = function (race, ui) { if (!app.gele) vrai.call(this, race, ui); };
        Renderer.prototype._drawHUD = function () {};
      }
    }, c.id);
    await page.waitForFunction(() => app.race && app.renderer && app.renderer.paths);
    await page.waitForTimeout(500);                 // le décor et les chemins sont construits

    const ok = [];
    // --- le tour entier
    const nomTour = `${c.id}-tour.png`;
    await page.evaluate(() => {
      const r = app.renderer, T = app.race.track, b = { ...T.bounds };
      // Le cadre englobe aussi les dégagements et les protections : ils peuvent
      // dépasser la chaussée de plusieurs dizaines de mètres aux extrémités.
      const inclure = (x, y, pad = 0) => {
        b.minX = Math.min(b.minX, x - pad); b.maxX = Math.max(b.maxX, x + pad);
        b.minY = Math.min(b.minY, y - pad); b.maxY = Math.max(b.maxY, y + pad);
      };
      for (let i = 0; i < T.n; i += 2) for (const side of [-1, 1]) {
        const s = i * T.ds, hw = side > 0 ? T.hwLeftAt(s) : T.hwRightAt(s);
        const p = T.pos(s, side * (hw + Math.max(T.kerbAt(s), T.runoffWidthAt(s, side))));
        inclure(p.x, p.y);
      }
      for (const wall of T.barriers) {
        inclure(wall.ax, wall.ay, wall.half); inclure(wall.bx, wall.by, wall.half);
      }
      const sansVoitures = app.race.cars.slice();
      app.race.cars.length = 0;
      const marge = 64;
      r.cam.zoom = Math.min(r.w / (b.maxX - b.minX + marge), r.h / (b.maxY - b.minY + marge));
      r.cam.x = (b.minX + b.maxX) / 2; r.cam.y = (b.minY + b.maxY) / 2;
      r.rotate = false; r.camAngle = 0;
      r._vraiDraw.call(r, app.race, null);
      app.race.cars.push(...sansVoitures);
    });
    await page.locator('canvas').first().screenshot({ path: path.join(OUT, nomTour) });
    ok.push(nomTour);

    // --- quatre vues à l'échelle de jeu
    for (let k = 0; k < (TOUR_ONLY ? 0 : VUES.length); k++) {
      const nom = `${c.id}-${k + 1}.png`;
      await page.evaluate((f) => {
        const r = app.renderer, T = app.race.track;
        const sansVoitures = app.race.cars.slice();
        app.race.cars.length = 0;
        const s = f * T.length, i = T.idx(s);
        r.cam.zoom = r._zoomPour(150);             // la fenêtre d'une course, en mètres
        r.cam.x = T.xs[i]; r.cam.y = T.ys[i];
        r.rotate = false; r.camAngle = 0;
        r._vraiDraw.call(r, app.race, null);
        app.race.cars.push(...sansVoitures);
      }, VUES[k]);
      await page.locator('canvas').first().screenshot({ path: path.join(OUT, nom) });
      ok.push(nom);
    }
    console.log(`  ${c.nom.padEnd(22)} ${('(' + c.theme + ')').padEnd(14)} ${ok.length} images`);
    await page.evaluate(() => { app.gele = false; app.ui.show && app.quitRace && app.quitRace(); });
    await page.waitForTimeout(150);
  }

  /* UNE PLANCHE PAR CIRCUIT. Soixante fichiers ne se regardent pas ; cinq vues côte à côte, si.
     Le tour entier en haut pour situer, les quatre vues de jeu dessous pour juger le rendu. */
  for (const c of (TOUR_ONLY ? [] : circuits)) {
    const png = await page.evaluate(async ({ nom, theme, images }) => {
      const charge = (u) => new Promise((ok, non) => {
        const i = new Image(); i.onload = () => ok(i); i.onerror = non; i.src = u;
      });
      const tour = await charge(images[0]);
      const vues = [];
      for (let k = 1; k <= 4; k++) vues.push(await charge(images[k]));
      const W = 2560, marge = 24, titre = 64;
      const hT = Math.round(tour.height * (W - marge * 2) / tour.width);
      const wv = Math.round((W - marge * 3) / 2), hv = Math.round(vues[0].height * wv / vues[0].width);
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = titre + hT + marge * 3 + hv * 2;
      const g = cv.getContext('2d');
      g.fillStyle = '#17171c'; g.fillRect(0, 0, cv.width, cv.height);
      g.fillStyle = '#f0ece4'; g.font = 'bold 34px "Trebuchet MS", sans-serif';
      g.fillText(`${nom}  —  thème « ${theme} »`, marge, 44);
      g.drawImage(tour, marge, titre, W - marge * 2, hT);
      vues.forEach((v, k) => {
        g.drawImage(v, marge + (k % 2) * (wv + marge), titre + hT + marge + Math.floor(k / 2) * (hv + marge), wv, hv);
      });
      return cv.toDataURL('image/png').split(',')[1];
    }, { nom: c.nom, theme: c.theme, images: ['tour', 1, 2, 3, 4].map(suffix =>
      'data:image/png;base64,' + fs.readFileSync(path.join(OUT, `${c.id}-${suffix}.png`)).toString('base64')) });
    fs.writeFileSync(path.join(OUT, `${c.id}-planche.png`), Buffer.from(png, 'base64'));
  }
  if(!TOUR_ONLY)console.log(`\n${circuits.length} planches`);

  await nav.close(); srv.close();
  if(errors.length)throw Error('Erreurs de rendu : '+errors.join('; '));
  console.log(`fait — ${OUT}`);
})();
