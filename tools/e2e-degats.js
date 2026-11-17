// Les dégâts qui se voient (essai de la branche claude/degats-visuels, js/degats.js).
//
//   NODE_PATH=$(npm root -g) node tools/e2e-degats.js [dossier]
//
// 1. Quatre voitures, quatre chocs posés à la main (nez, flanc, arrière, coin) : chacune a sa tôle,
//    la bosse se fige, les débris tombent. Captures avant, pendant (la tôle tremble), après.
// 2. Un rail pris à 60 km/h en course : la voiture perd de la pointe (DEGATS), sa tôle est enfoncée,
//    mais pas plus de 30 cm — les voitures sont résistantes — et elle n'abandonne pas.
// 3. Le coût du dessin : dix voitures cabossées de partout ne doivent pas coûter beaucoup plus que
//    dix intactes — la caisse déformée est gardée en cache (Carrosserie.dessine).
// 4. De nuit : un phare dont le coin a reculé s'éteint, celui d'en face reste allumé.
// 5. À 120 km/h droit dans le rail : l'abandon. Le moteur ne repart plus, le nez rentre, la course se
//    termine sans le joueur ; il est classé dernier, « Abandon », sans points, et tous les autres ont
//    une arrivée (projetée) — personne n'est resté coincé derrière l'épave.
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..'), OUT = process.argv[2] || '/tmp/degats';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((req, res) => {
    const file = path.resolve(ROOT, '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: ((p) => fs.existsSync(p) ? p : undefined)(process.env.CHROMIUM_PATH || '/usr/bin/chromium') });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => window.app && app.renderer);
    await page.evaluate(() => { app.mondial = null; app.save.name = 'Testeur'; app.save.lang = 'fr'; app.startQuick('race', 'gt3', 'spa'); });
    await page.waitForFunction(() => app.race && app.race.state === 'racing', null, { timeout: 30000 });
    await page.waitForTimeout(800);
    const capture = async (nom, pas) => {
      await page.evaluate((pas) => {
        const r = app.race, R = app.renderer;
        for (let i = 0; i < pas; i++) R.addEffects(r, 1 / 60);
        for (let i = 0; i < 120; i++) R.updateCamera(r, 1 / 60);
        R.draw(r, app.ui);
      }, pas);
      await page.screenshot({ path: path.join(OUT, nom) });
    };

    // 1. la vitrine
    await page.evaluate(() => {
      app.state = 'paused'; app.ui.hide();
      const r = app.race, T = r.track, p = r.player;
      let s = T.length * 0.3;
      for (let k = 0; k < 200 && Math.abs(T.curvAt(s)) > .002; k++) s += 8;
      const autres = r.cars.filter((c) => c !== p).slice(0, 3);
      p.place(s, 0, 0); autres[0].place(s, -4.5, 0); autres[1].place(s - 7, 0, 0); autres[2].place(s - 7, -4.5, 0);
      r.cars.filter((c) => c !== p && !autres.includes(c)).forEach((c, i) => c.place(s - 200 - 10 * i, 0, 0));
      for (const c of r.cars) { c.v = 0; c.vl = 0; c.w = 0; }
      window.__vitrine = [p, ...autres];
    });
    await capture('0-intactes.png', 1);
    await page.evaluate(() => {
      const [a, b, c, d] = window.__vitrine;
      a.chocs.push({ nx: -1, ny: 0, v: 16, frotte: 0, sorte: 'voiture' });       // le nez
      b.chocs.push({ nx: 0, ny: 1, v: 13, frotte: 0, sorte: 'voiture' });        // un flanc
      c.chocs.push({ nx: 1, ny: 0, v: 12, frotte: 0, sorte: 'voiture' });        // l'arrière
      d.chocs.push({ nx: -0.7, ny: -0.7, v: 18, frotte: 0, sorte: 'rail' });     // un coin, contre un rail
    });
    await capture('1-choc.png', 4);
    await capture('2-tremble.png', 6);
    await capture('3-fige.png', 120);
    const vitrine = await page.evaluate(() => window.__vitrine.map((c) => {
      const t = app.renderer.carrosseries.get(c);
      let creux = 0;
      if (t) for (let k = 0; k < t.tx.length; k++) creux = Math.max(creux, Math.hypot(t.tx[k], t.ty[k]));
      return { tole: !!t, calme: t ? t.calme : null, creux, peau: !!(t && t.peau) };
    }));
    for (const v of vitrine) assert.ok(v.tole && v.calme && v.peau && v.creux > 0.05 && v.creux <= 0.3 + 1e-6, 'une voiture touchée sans bosse figée, ou trop enfoncée : ' + JSON.stringify(v));
    assert.ok(await page.evaluate(() => app.renderer.eclats.debris.length > 4), 'pas de débris après quatre chocs');

    // 2. le rail, en course
    const rail = await page.evaluate(() => {
      const r = app.race, T = r.track, p = r.player, R = app.renderer;
      const b = T.barriers.find((b) => b.kind === 'rail' && b.side === 1 && b.s > 600 && Math.abs(T.curvAt(b.s)) < .003);
      for (const o of r.cars) if (o !== p) o.place(b.s - 150 - o.number * 10, 0, 0);
      R.carrosseries = new WeakMap();
      p.state = 'ok'; p.damage = 0; p.gridLat = null; p.engineStopped = false;
      const x = (b.ax + b.bx) / 2 + b.nx * (p.cls.length / 2 + b.half + 2), y = (b.ay + b.by) / 2 + b.ny * (p.cls.length / 2 + b.half + 2);
      const pr = T.project(x, y, b.s, 20); p.place(pr.s, pr.lat, 20); p.x = x; p.y = y; p.th = Math.atan2(-b.ny, -b.nx) + 0.5;
      for (let i = 0; i < 120; i++) { p.update(1 / 120, true, r.time + i / 120); if (i % 2) R.addEffects(r, 1 / 60); }
      for (let i = 0; i < 90; i++) R.addEffects(r, 1 / 60);
      const t = R.carrosseries.get(p);
      let creux = 0;
      if (t) for (let k = 0; k < t.tx.length; k++) creux = Math.max(creux, Math.hypot(t.tx[k], t.ty[k]));
      return { degats: !!r.degats, damage: p.damage, facteur: p.damageFactor(), tole: !!t, creux, abandon: p.abandon };
    });
    assert.ok(rail.degats && rail.damage > 0.1 && rail.facteur < 0.99 && rail.tole && !rail.abandon && rail.creux <= 0.3 + 1e-6, 'le rail à 60 km/h : ' + JSON.stringify(rail));
    await capture('4-rail.png', 1);

    // 3. le coût du dessin
    const cout = await page.evaluate(() => {
      const r = app.race, R = app.renderer, p = r.player;
      r.cars.forEach((c, i) => { if (c !== p) c.place(p.s - 6 - 7 * Math.floor(i / 2), (i % 2 ? -1 : 1) * 2.5, 0); });
      for (let i = 0; i < 160; i++) R.updateCamera(r, 1 / 60);
      const mesure = () => { for (let i = 0; i < 5; i++) R.draw(r, app.ui); const t = performance.now(); for (let i = 0; i < 30; i++) R.draw(r, app.ui); return (performance.now() - t) / 30; };
      R.carrosseries = new WeakMap();
      const intactes = mesure();
      for (const c of r.cars) for (const [nx, ny] of [[-1, 0], [0, 1], [1, 0.3], [-0.6, -0.8]]) c.chocs.push({ nx, ny, v: 14, frotte: 0, sorte: 'voiture' });
      for (let i = 0; i < 120; i++) R.addEffects(r, 1 / 60);
      return { intactes, cabossees: mesure() };
    });
    console.log(`  dessin : ${cout.intactes.toFixed(2)} ms intactes, ${cout.cabossees.toFixed(2)} ms cabossées`);
    assert.ok(cout.cabossees < cout.intactes * 1.6 + 1, 'la tôle cabossée coûte trop cher au dessin : ' + JSON.stringify(cout));
    await capture('5-peloton.png', 1);

    // 4. de nuit, un phare cassé
    const nuit = await page.evaluate(() => {
      const r = app.race, R = app.renderer, p = r.player;
      r.timeOfDay = 'night';
      R.carrosseries = new WeakMap();
      for (const c of r.cars) if (c !== p) c.place(p.s - 300 - c.number * 10, 0, 0);
      p.place(p.s, 0, 0);
      const phares = () => { R.night.prepare(r, R.cam, 80); return R.night.fields.filter((f) => f.beam && Math.hypot(f.x - p.x, f.y - p.y) < 4).length; };
      const avant = phares();
      // un coin avant enfoncé : le phare de ce côté-là s'éteint
      const lay = carLightLayout(p.cls, p.livree), cote = Math.sign(lay.front[0].y);
      p.chocs.push({ nx: -0.75, ny: -0.66 * cote, v: 26, frotte: 0, sorte: 'voiture' });   // la tôle rentre vers l'autre côté
      for (let i = 0; i < 90; i++) R.addEffects(r, 1 / 60);
      return { avant, apres: phares() };
    });
    assert.ok(nuit.avant >= 2 && nuit.apres === nuit.avant - 1, 'un coin enfoncé devait éteindre un phare, et un seul : ' + JSON.stringify(nuit));
    await capture('6-nuit.png', 1);

    // 5. l'abandon
    const dnf = await page.evaluate(() => {
      const r = app.race, T = r.track, p = r.player, R = app.renderer;
      r.timeOfDay = 'day';
      R.carrosseries = new WeakMap();
      const b = T.barriers.find((b) => b.kind === 'rail' && b.side === 1 && b.s > 600 && Math.abs(T.curvAt(b.s)) < .003);
      for (const o of r.cars) if (o !== p) o.place(b.s - 150 - o.number * 10, 0, 30);
      p.state = 'ok'; p.damage = 0; p.gridLat = null;
      const x = (b.ax + b.bx) / 2 + b.nx * (p.cls.length / 2 + b.half + 2), y = (b.ay + b.by) / 2 + b.ny * (p.cls.length / 2 + b.half + 2);
      const pr = T.project(x, y, b.s, 20); p.place(pr.s, pr.lat, 34); p.x = x; p.y = y; p.th = Math.atan2(-b.ny, -b.nx) + 0.15;
      for (let i = 0; i < 120; i++) { p.update(1 / 120, true, r.time + i / 120); if (i % 2) R.addEffects(r, 1 / 60); }
      for (let i = 0; i < 60; i++) R.addEffects(r, 1 / 60);
      const t = R.carrosseries.get(p);
      let creux = 0;
      if (t) for (let k = 0; k < t.tx.length; k++) creux = Math.max(creux, Math.hypot(t.tx[k], t.ty[k]));
      const juste = { abandon: p.abandon, coupe: p.engineCut, creux, capot: R.eclats.debris.some((d) => d.l > 0.6) };
      for (let i = 0; i < 160; i++) R.updateCamera(r, 1 / 60);
      R.draw(r, app.ui);
      return juste;
    });
    await page.screenshot({ path: path.join(OUT, '7-abandon.png') });
    assert.ok(dnf.abandon && dnf.coupe === Infinity && dnf.creux > 0.4 && dnf.capot, 'à 120 km/h dans le rail, pas d\'abandon : ' + JSON.stringify(dnf));
    const fin = await page.evaluate(() => {
      const r = app.race;
      for (let i = 0; i < 2000 && r.state !== 'finished'; i++) r.update(1 / 60, { throttle: 0, sel: 0 });
      const res = r.results || [], moi = res.find((x) => x.car === r.player);
      return { etat: r.state, n: res.length, moi: moi && { pos: moi.pos, abandon: moi.abandon, points: moi.points },
        arrives: res.filter((x) => x.car !== r.player && x.time != null).length, roule: r.player.v };
    });
    assert.ok(fin.etat === 'finished' && fin.moi && fin.moi.abandon && fin.moi.points === 0 && fin.moi.pos === fin.n && fin.arrives === fin.n - 1,
      'l\'abandon ne termine pas la course comme il faut : ' + JSON.stringify(fin));

    assert.deepEqual(errors, []);
    console.log('  dégâts visibles : bosses figées et limitées, rail coûteux, dessin en cache, phare cassé, abandon à 120 km/h — OK');
  } finally {
    await browser.close(); server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
