// Les images par seconde pendant une vraie course, servie en HTTP.
//
//   NODE_PATH=$(npm root -g) node tools/perf.js [voiture] [secondes] [--bride=4]
//
// `--bride` ralentit le processeur d'autant. Une machine de bureau tient le jeu sans effort et ne
// montre rien ; un téléphone est trois à six fois plus lent. Mesurer sans brider, c'est mesurer
// une machine que personne n'utilise pour jouer.
//
// Pourquoi en HTTP et pas en `file://` comme les autres essais : sous `file://` le `fetch` de la
// rampe échoue, le moteur retombe sur la synthèse, et tout ce que coûte la lecture granulaire
// devient invisible. Un test qui ne voit pas ce qu'on veut mesurer ne mesure rien.
//
// On ne regarde pas la moyenne mais **la queue de la distribution** : une saccade, c'est une image
// longue de temps en temps, pas une moyenne basse. Soixante images à 16 ms et une à 200 ms donnent
// encore 55 im/s de moyenne, et pourtant ça se voit.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wav': 'audio/wav',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };

(async () => {
  const carId = process.argv[2] || 'm1procar';
  const DUR = +(process.argv[3] || 20);
  const bride = +((process.argv.find((x) => x.startsWith('--bride=')) || '--bride=1').split('=')[1]);
  const serveur = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => serveur.listen(0, r));
  const base = `http://127.0.0.1:${serveur.address().port}`;

  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  let errs = 0;
  page.on('pageerror', (e) => { if (errs++ < 4) console.log('[pageerror]', e.message); });
  const cdp = await page.context().newCDPSession(page);
  if (bride > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: bride });
  await page.goto(`${base}/index.html`);
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);

  const res = await page.evaluate(async ({ id, dur }) => {
    app.save.laps = 3;
    app.save.modelId = id;                 // la voiture du joueur vient de la sauvegarde
    app.startQuick('race', 'gt', TRACKS[0].id);
    await new Promise((r) => setTimeout(r, 1500));
    app.audio.setEnabled(true);
    app.audio.resume();
    const dt = [];
    let last = performance.now();
    const marques = [];
    await new Promise((fini) => {
      const tick = () => {
        const n = performance.now();
        dt.push(n - last); last = n;
        if (dt.length % 60 === 0) marques.push({ s: Math.round(dt.length / 60), prise: !!app.audio.ramp,
          gomme: app.renderer && app.renderer.rubber ? app.renderer.rubber.size : 0,
          dpr: app.renderer ? app.renderer.dpr : 0,
          bouffees: app.renderer && app.renderer.puffs ? app.renderer.puffs.length : 0,
          voitures: app.race ? app.race.cars.length : 0 });
        if (dt.length < dur * 60) requestAnimationFrame(tick); else fini();
      };
      requestAnimationFrame(tick);
    });
    const tri = dt.slice(10).sort((a, b) => a - b);
    const q = (p) => tri[Math.min(tri.length - 1, Math.floor(tri.length * p))];
    return {
      images: tri.length,
      moyenne: +(1000 / (tri.reduce((a, b) => a + b, 0) / tri.length)).toFixed(1),
      median: +q(0.5).toFixed(1), p90: +q(0.9).toFixed(1), p99: +q(0.99).toFixed(1), pire: +q(1).toFixed(1),
      longues: tri.filter((x) => x > 25).length,
      tresLongues: tri.filter((x) => x > 50).length,
      prise: marques.length ? marques[marques.length - 1].prise : false,
      croissance: marques.filter((_, i) => i % 5 === 0).map((m) => `${m.s}s:dpr=${m.dpr}`).join(' '),
    };
  }, { id: carId, dur: DUR });

  console.log(`${carId} · ${DUR} s · processeur bridé x${bride} · rampe chargée : ${res.prise}`);
  console.log(`  ${res.images} images · moyenne ${res.moyenne} im/s`);
  console.log(`  durée d'image : médiane ${res.median} ms · p90 ${res.p90} · p99 ${res.p99} · pire ${res.pire}`);
  console.log(`  images > 25 ms : ${res.longues} (${(100 * res.longues / res.images).toFixed(1)} %)` +
    ` · > 50 ms : ${res.tresLongues}`);
  console.log(`  résolution : ${res.croissance}`);
  console.log(`  errors ${errs}`);
  await browser.close();
  serveur.close();
})();
