/* LE JEU TEL QU'ON LE JOUE : les voitures, le bandeau, la caméra de course.

   L'export de décor retire tout ça pour montrer le monde. C'est ce qu'il faut pour travailler les
   couleurs, et c'est insuffisant pour juger : une piste se regarde avec des voitures dessus, à la
   distance où la caméra la montre, et avec le bandeau qui en mange une partie. Un décor qui tient
   à vide peut très bien étouffer la course.

   On lance donc une vraie course, on roule quelques secondes, et on photographie — en portrait de
   téléphone comme on y joue, et en large pour voir le décor autour.

     NODE_PATH=$(npm root -g) node tools/jeu-shot.js [circuit] [dossier]
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const PISTE = process.argv[2] || 'spa';
const OUT = process.argv[3] || path.join(ROOT, 'export');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.ico': 'image/vnd.microsoft.icon', '.webmanifest': 'application/manifest+json',
  '.json': 'application/json' };

const vues = [
  { nom: 'jeu-telephone', w: 390, h: 844, dpr: 3, mobile: true },
  { nom: 'jeu-large', w: 1280, h: 720, dpr: 2, mobile: false },
  { nom: 'jeu-reference', w: 1254, h: 1254, dpr: 1, mobile: false },
];

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

  for (const v of vues) {
    const ctx = await nav.newContext({ locale: 'fr-FR', viewport: { width: v.w, height: v.h },
      deviceScaleFactor: v.dpr, isMobile: v.mobile, hasTouch: v.mobile });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('  ERREUR ' + e.message));
    await page.goto(base);
    await page.waitForFunction(() => typeof app !== 'undefined' && app.save);
    // on attend le décor dessiné : sans ça on photographie le repli peint
    await page.waitForFunction(() => typeof decorPret !== 'function' || decorPret(), null, { timeout: 20000 });
    await page.evaluate(() => { app.save.name = 'Bruno'; app.mondial = null; storeSave(app.save); });
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.evaluate((id) => app.startQuick('race', 'gt', id), PISTE);
    await page.waitForFunction(() => app.race && app.renderer && app.renderer.paths);
    /* On roule. Le feu vert passe, le peloton s'étire, et c'est au bout de quelques secondes qu'on
       voit ce qui nous intéresse : des voitures devant, du décor qui défile, la piste lisible. */
    await page.keyboard.down('Space');
    await page.waitForTimeout(9000);
    await page.screenshot({ path: path.join(OUT, v.nom + '.png') });
    await page.keyboard.up('Space');
    const etat = await page.evaluate(() => ({
      tour: app.race.player.lap, v: Math.round(app.race.player.v * 3.6),
      pos: app.race.cars.filter((c) => c.s + c.lap * app.race.track.length
        > app.race.player.s + app.race.player.lap * app.race.track.length).length + 1,
      n: app.race.cars.length,
    }));
    console.log(`  ${v.nom.padEnd(16)} ${v.w}x${v.h} ×${v.dpr}   ${etat.v} km/h · ${etat.pos}/${etat.n}`);
    await ctx.close();
  }
  await nav.close(); srv.close();
  console.log('fait — ' + OUT);
})();
