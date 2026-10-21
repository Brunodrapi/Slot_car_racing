// La version publiée (dist/) se joue-t-elle, et se joue-t-elle HORS LIGNE ?
//
//   npm run build && NODE_PATH=$(npm root -g) node tools/e2e-dist.js [captures]
//
// En ligne, au format d'un iPhone : aucun fichier demandé ne manque (toutes les voitures et leurs
// livrées, les vignettes, les drapeaux, les sons des moteurs), une course démarre, et le service
// worker finit de tout mettre en cache. Puis le réseau est coupé et la page rechargée : le jeu doit
// s'ouvrir et une course démarrer quand même, sans erreur de page.
'use strict';
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const OUT = process.argv[2] || null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ttf': 'font/ttf',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon' };
let fautes = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAUX  ') + m); if (!c) fautes++; };

(async () => {
  if (!fs.existsSync(path.join(DIST, 'sw.js'))) { console.error('dist/ absent : lancer `npm run build` d’abord'); process.exit(2); }
  const manquants = new Set();
  const serveur = http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split('?')[0]);
    if (u.endsWith('/')) u += 'index.html';
    const f = path.join(DIST, u);
    if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { manquants.add(u); res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${serveur.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(e.message));
  try {
    console.log('En ligne');
    await p.goto(base);
    await p.waitForFunction(() => typeof app !== 'undefined' && app.save);
    ok(await p.evaluate(() => document.title.startsWith('GRIP')), 'la page publiée s’ouvre : ' + await p.title());
    ok(await p.evaluate(() => !/\n\s*\/\*/.test(document.scripts[3].text || '')) && (await (await fetch(base + 'js/car.js')).text()).split('\n').length < 5,
      'le code est minifié (js/car.js tient sur quelques lignes)');
    // Toutes les voitures, toutes les livrées, et leurs vignettes.
    const dessins = await p.evaluate(async () => {
      for (const m of MODELS) for (let i = 0; i < m.livrees.length; i++) topReady(m, i);
      const t0 = performance.now();
      while (!MODELS.every((m) => m.livrees.every((_, i) => topReady(m, i))) && performance.now() - t0 < 30000) await new Promise((r) => setTimeout(r, 100));
      const vignettes = await Promise.all(MODELS.filter((m) => m.pick).map((m) => new Promise((r) => { const im = new Image(); im.onload = () => r(true); im.onerror = () => r(m.pick); im.src = m.pick; })));
      const dessinsRates = MODELS.flatMap((m) => m.livrees.map((_, i) => (m.top && !topArt(m, i) ? m.id + '/' + i : null))).filter(Boolean);
      return { modeles: MODELS.length, vignettesRatees: vignettes.filter((v) => v !== true), dessinsRates };
    });
    ok(dessins.vignettesRatees.length === 0 && dessins.dessinsRates.length === 0,
      `${dessins.modeles} voitures : dessins vus de dessus et vignettes chargés` + (dessins.dessinsRates.length ? ' — ratés : ' + dessins.dessinsRates.join(', ') : ''));
    // Les sons des moteurs : chaque fichier que les fiches désignent répond.
    const sons = await p.evaluate(async () => {
      const cat = await (await fetch('sounds/engine/voitures.json')).json();
      const urls = new Set();
      JSON.stringify(cat).replace(/"source":"([^"]+)"/g, (_, s) => urls.add(s));
      const res = await Promise.all([...urls].map(async (u) => [u, (await fetch(encodeURI(u))).status]));
      return { n: res.length, rates: res.filter(([, s]) => s !== 200).map(([u]) => u) };
    });
    ok(sons.rates.length === 0, `${sons.n} sons de moteur présents` + (sons.rates.length ? ' — manquent : ' + sons.rates.join(', ') : ''));
    // Une course, comme un joueur : écran-titre, nom, menu, course rapide.
    await p.evaluate(() => { app.save.name = 'Bruno'; app.mondial = null; storeSave(app.save); });
    await p.touchscreen.tap(195, 420);
    await p.waitForTimeout(500);
    for (const cat of ['gt', 'f1', 'proto']) {
      await p.evaluate((cat) => { app.ui.setup.classId = cat; app.ui.setup.trackId = 'monza'; app.ui.setupScreen('race'); }, cat);
      await p.waitForTimeout(400);
    }
    await p.evaluate(() => app.startQuick('timetrial', 'gt', 'monaco'));
    await p.waitForFunction(() => app.race && app.race.state === 'racing', null, { timeout: 30000 });
    ok(true, 'une course démarre');
    if (OUT) await p.screenshot({ path: path.join(OUT, 'dist-en-ligne.png') });
    ok(manquants.size === 0, 'aucun fichier demandé ne manque' + (manquants.size ? ' : ' + [...manquants].join(', ') : ''));
    // Le service worker a fini de tout garder.
    const cache = await p.evaluate(async () => {
      await navigator.serviceWorker.ready;
      const t0 = performance.now();
      let n = 0, attendus = 0;
      while (performance.now() - t0 < 60000) {
        const noms = await caches.keys();
        const nom = noms.find((k) => k.startsWith('grip-'));
        if (nom) {
          n = (await (await caches.open(nom)).keys()).length;
          attendus = (await (await fetch('sw.js')).text()).match(/const FICHIERS = (\[.*\]);/)[1].split('","').length;
          if (n >= attendus) return { nom, n, attendus };
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      return { n, attendus };
    });
    ok(cache.n >= cache.attendus && cache.attendus > 100, `service worker : ${cache.n} fichiers en cache sur ${cache.attendus} (${cache.nom})`);

    console.log('Hors ligne');
    await ctx.setOffline(true);
    await p.evaluate(() => app.quitRace && app.quitRace());
    await p.reload();
    await p.waitForFunction(() => typeof app !== 'undefined' && app.save, null, { timeout: 30000 });
    ok(true, 'la page se recharge sans réseau');
    await p.waitForTimeout(800);
    ok(await p.evaluate(() => !!document.querySelector('.splash .poster') && document.querySelector('.splash .poster').naturalWidth > 0), 'l’affiche du titre est là');
    if (OUT) await p.screenshot({ path: path.join(OUT, 'dist-hors-ligne-titre.png') });
    await p.touchscreen.tap(195, 420);
    await p.waitForTimeout(500);
    await p.evaluate(() => app.startQuick('race', 'f1', 'spa'));
    await p.waitForFunction(() => app.race && app.race.state === 'racing', null, { timeout: 30000 });
    await p.waitForTimeout(2500);
    ok(await p.evaluate(() => app.race.cars.length > 1 && app.race.cars.every((c) => topReady(c.cls, c.livree))), 'hors ligne : une course contre l’IA démarre, toutes les voitures dessinées');
    if (OUT) await p.screenshot({ path: path.join(OUT, 'dist-hors-ligne-course.png') });
    ok(erreurs.length === 0, 'aucune erreur de page' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } finally {
    await browser.close(); serveur.close();
  }
  console.log(fautes ? `${fautes} faute(s)` : 'OK');
  process.exitCode = fautes ? 1 : 0;
})();
