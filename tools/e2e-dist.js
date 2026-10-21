// La version publiée (dist/) se joue-t-elle, hors ligne aussi, et se met-elle à jour comme on le lui dit ?
//
//   npm run build && NODE_PATH=$(npm root -g) node tools/e2e-dist.js [captures]
//
// Au format d'un iPhone :
//   en ligne      aucun fichier ne manque (voitures, livrées, vignettes, sons), une course démarre, la
//                 première installation remplit le cache et l'écran-titre annonce « jeu à jour » ;
//   hors ligne    la page se recharge, l'écran-titre dit « hors ligne », une course contre l'IA démarre ;
//   mise à jour   une publication où un seul fichier change : l'écran-titre la propose avec sa taille ;
//                 « continuer avec cette version » ne télécharge rien ; « mettre à jour » ne télécharge
//                 que ce fichier, attend la fin de la course pour recharger, et la nouvelle version tourne.
'use strict';
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');

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
  let journal = null;                 // les fichiers demandés au serveur, pendant une mise à jour
  // Les fichiers du jeu, sans le manifeste (lu à chaque vérification) ni sw.js (que le navigateur relit
  // de lui-même à chaque chargement, pour voir s'il a changé).
  const telecharges = () => journal.filter((u) => u !== '/manifeste.json' && u !== '/sw.js');
  const serveur = http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split('?')[0]);
    if (journal) journal.push(u);
    if (u.endsWith('/')) u += 'index.html';
    const f = path.join(DIST, u);
    if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { manquants.add(u); res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${serveur.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'fr-FR' });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(e.message));
  const bandeau = () => p.evaluate(() => { const el = document.querySelector('.splash .maj'); return el && !el.hidden ? el.textContent.replace(/\s+/g, ' ').trim() : ''; });
  const etat = (e) => p.waitForFunction((e) => typeof MAJ !== 'undefined' && MAJ.etat === e, e, { timeout: 90000 });
  const fv = path.join(DIST, 'js/version.js'), fm = path.join(DIST, 'manifeste.json');
  const vAvant = fs.readFileSync(fv, 'utf8'), mAvant = fs.readFileSync(fm, 'utf8');
  try {
    console.log('En ligne');
    await p.goto(base);
    await p.waitForFunction(() => typeof app !== 'undefined' && app.save);
    ok(await p.evaluate(() => document.title.startsWith('GRIP')), 'la page publiée s’ouvre : ' + await p.title());
    ok((await (await fetch(base + 'js/car.js')).text()).split('\n').length < 5, 'le code est minifié (js/car.js tient sur quelques lignes)');
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
    const sons = await p.evaluate(async () => {
      const cat = await (await fetch('sounds/engine/voitures.json')).json();
      const urls = new Set();
      JSON.stringify(cat).replace(/"source":"([^"]+)"/g, (_, s) => urls.add(s));
      const res = await Promise.all([...urls].map(async (u) => [u, (await fetch(encodeURI(u))).status]));
      return { n: res.length, rates: res.filter(([, s]) => s !== 200).map(([u]) => u) };
    });
    ok(sons.rates.length === 0, `${sons.n} sons de moteur présents` + (sons.rates.length ? ' — manquent : ' + sons.rates.join(', ') : ''));
    // La première installation : l'écran-titre la montre, puis annonce le jeu à jour.
    await etat('a-jour');
    const cache = await p.evaluate(async () => {
      const m = JSON.parse(await (await fetch('manifeste.json?t=1', { cache: 'no-store' })).text());
      const c = await caches.open(m.cache);
      return { n: (await c.keys()).length, attendus: Object.keys(m.fichiers).length + 1, nom: m.cache };
    });
    ok(cache.n >= cache.attendus && cache.attendus > 100, `première installation : ${cache.n} fichiers en cache sur ${cache.attendus} (${cache.nom})`);
    const txtAJour = await bandeau();
    ok(/à jour/.test(txtAJour), `écran-titre : « ${txtAJour} »`);
    if (OUT) await p.screenshot({ path: path.join(OUT, 'maj-a-jour.png') });
    await p.evaluate(() => { app.save.name = 'Bruno'; app.mondial = null; storeSave(app.save); });
    await p.touchscreen.tap(195, 420);
    await p.waitForTimeout(500);
    await p.evaluate(() => app.startQuick('timetrial', 'gt', 'monaco'));
    await p.waitForFunction(() => app.race && app.race.state === 'racing', null, { timeout: 30000 });
    ok(true, 'une course démarre');
    ok(manquants.size === 0, 'aucun fichier demandé ne manque' + (manquants.size ? ' : ' + [...manquants].join(', ') : ''));

    console.log('Hors ligne');
    await ctx.setOffline(true);
    await p.evaluate(() => app.toMenu());
    await p.reload();
    await p.waitForFunction(() => typeof app !== 'undefined' && app.save, null, { timeout: 30000 });
    await etat('hors-ligne');
    const txtHL = await bandeau();
    ok(/Hors ligne/.test(txtHL), `écran-titre : « ${txtHL} »`);
    ok(await p.evaluate(() => document.querySelector('.splash .poster').naturalWidth > 0), 'l’affiche du titre est là');
    if (OUT) await p.screenshot({ path: path.join(OUT, 'maj-hors-ligne.png') });
    await p.touchscreen.tap(195, 420);
    await p.waitForTimeout(500);
    await p.evaluate(() => app.startQuick('race', 'f1', 'spa'));
    await p.waitForFunction(() => app.race && app.race.state === 'racing', null, { timeout: 30000 });
    await p.waitForTimeout(2000);
    ok(await p.evaluate(() => app.race.cars.length > 1 && app.race.cars.every((c) => topReady(c.cls, c.livree))), 'hors ligne : une course contre l’IA démarre, toutes les voitures dessinées');

    console.log('Mise à jour');
    // Une nouvelle publication où un seul fichier change : la date de js/version.js.
    await ctx.setOffline(false);
    const vApres = vAvant.replace(/APP_DATE="[^"]*"/, 'APP_DATE="2099-01-01"');
    fs.writeFileSync(fv, vApres);
    const man = JSON.parse(mAvant);
    man.fichiers['js/version.js'] = [crypto.createHash('sha256').update(vApres).digest('hex').slice(0, 12), Buffer.byteLength(vApres)];
    man.version = man.version + '-essai'; man.cache = man.cache + '-essai';
    fs.writeFileSync(fm, JSON.stringify(man));
    await p.evaluate(() => app.toMenu());
    await p.reload();
    await p.waitForFunction(() => typeof app !== 'undefined' && app.save);
    await etat('disponible');
    const txtDispo = await bandeau();
    ok(/Mise à jour disponible/.test(txtDispo) && /ko|Mo/.test(txtDispo), `écran-titre : « ${txtDispo} »`);
    if (OUT) await p.screenshot({ path: path.join(OUT, 'maj-disponible.png') });
    // « Continuer avec cette version » : rien ne se télécharge, l'affiche reste.
    journal = [];
    await p.click('[data-action="majGarder"]');
    await p.waitForTimeout(1500);
    ok(telecharges().length === 0 && await p.evaluate(() => app.state === 'splash' && MAJ.etat === 'reporte'),
      'continuer avec cette version : rien ne se télécharge, on reste sur l’écran-titre');
    // « Mettre à jour », puis une course : on ne recharge qu'au retour au menu.
    await p.reload();
    await p.waitForFunction(() => typeof app !== 'undefined' && app.save);
    await etat('disponible');
    journal = [];
    await p.click('[data-action="majLancer"]');
    ok(await p.evaluate(() => app.state === 'splash'), 'toucher « mettre à jour » ne passe pas l’écran-titre');
    await p.evaluate(() => { app.leaveSplash(); app.startQuick('timetrial', 'gt', 'monza'); });
    // waitForFunction n'attend pas une promesse : on interroge les caches d'ici.
    for (let t0 = Date.now(); Date.now() - t0 < 30000; await p.waitForTimeout(250)) {
      if (await p.evaluate(async () => { const ks = await caches.keys(); return ks.length === 1 && ks[0].endsWith('-essai'); })) break;
    }
    const demandes = telecharges();
    ok(demandes.length === 1 && demandes[0] === '/js/version.js', `seul le fichier modifié est téléchargé (${demandes.join(', ') || 'aucun'})`);
    await p.waitForTimeout(4000);
    ok(await p.evaluate(() => app.state === 'race' && APP_DATE !== '2099-01-01'), 'en course, la nouvelle version attend : pas de rechargement');
    await Promise.all([p.waitForNavigation({ timeout: 20000 }), p.evaluate(() => app.toMenu())]);
    await p.waitForFunction(() => typeof APP_DATE !== 'undefined' && typeof MAJ !== 'undefined', null, { timeout: 20000 });
    ok(await p.evaluate(() => APP_DATE === '2099-01-01'), 'au menu, la page se recharge sur la nouvelle version');
    await etat('a-jour');
    ok(/à jour/.test(await bandeau()), `écran-titre : « ${await bandeau()} »`);
    ok(erreurs.length === 0, 'aucune erreur de page' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } finally {
    journal = null;
    fs.writeFileSync(fv, vAvant); fs.writeFileSync(fm, mAvant);
    await browser.close(); serveur.close();
  }
  console.log(fautes ? `${fautes} faute(s)` : 'OK');
  process.exitCode = fautes ? 1 : 0;
})();
