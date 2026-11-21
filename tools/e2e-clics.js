// Les menus cliquent : chaque bouton, chaque choix d'une liste (js/audio.js, `clic`).
//
//   NODE_PATH=$(npm root -g) node tools/e2e-clics.js
//
// « Il faut, dans les deux versions, des clics dans les menus. » (Bruno) On passe de l'accueil aux
// réglages, on y change une liste, on revient, on ouvre la course rapide, on change de voiture : un clic
// à chaque fois, et un seul. Le clic est compté avant la garde du son ; on vérifie aussi qu'il joue
// pour de vrai (un oscillateur créé dans le contexte audio) et qu'il se tait quand le son est coupé.
'use strict';
const { chromium, devices } = require('playwright');
const path = require('path');
let fautes = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAUX  ') + m); if (!c) fautes++; };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'fr-FR' });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(e.message));
  try {
    await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
    await p.waitForFunction(() => typeof app !== 'undefined' && app.save);
    await p.evaluate(() => { app.save.name = 'Bruno'; app.save.sound = true; app.audio.enabled = true; app.mondial = null; app.leaveSplash(); app.ui.menu(); });
    await p.evaluate(() => {
      window.clics = 0; window.joues = 0;
      const f = app.audio.clic.bind(app.audio);
      app.audio.clic = () => { window.clics++; const avant = app.audio.started && app.audio.enabled; f(); if (avant) window.joues++; };
    });
    const clique = async (sel) => { await p.locator(sel).first().click(); await p.waitForTimeout(150); return p.evaluate(() => window.clics); };
    ok(await clique('[data-action="settings"]') === 1, 'accueil → réglages : un clic');
    await p.locator('#sel-cam').selectOption('fixed'); await p.waitForTimeout(100);
    ok(await p.evaluate(() => window.clics) === 2, 'un choix dans une liste des réglages : un clic');
    ok(await p.evaluate(() => window.joues) >= 1 && await p.evaluate(() => app.audio.started), 'le clic joue pour de vrai (le contexte audio est démarré)');
    await p.evaluate(() => app.ui.menu());
    await p.evaluate(() => { window.clics = 0; });
    ok(await clique('.mode-card[data-mode="race"]') === 1, 'accueil → course rapide : un clic');
    const n = await p.evaluate(() => window.clics);
    const car = p.locator('[data-action="pickModel"]');
    if (await car.count() > 1) { await car.nth(1).click(); await p.waitForTimeout(150); ok(await p.evaluate(() => window.clics) === n + 1, 'une autre voiture : un clic'); }
    else ok(false, 'pas de voiture à choisir sur le paddock');
    // le son coupé : le clic est demandé, rien ne joue
    await p.evaluate(() => { app.audio.setEnabled(false); window.joues = 0; window.clics = 0; app.ui.menu(); });
    await clique('[data-action="settings"]');
    ok(await p.evaluate(() => window.clics === 1 && window.joues === 0), 'le son coupé : pas de clic entendu');
    ok(erreurs.length === 0, 'pas d\'erreur dans la page' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } catch (e) { console.error(e); fautes++; }
  await browser.close();
  console.log(fautes ? `CLICS : ${fautes} faute(s)` : 'CLICS OK');
  process.exit(fautes ? 1 : 0);
})();
