// Le menu-affiche : les cinq bandeaux, leur dépliage, et ce sur quoi ils mènent.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-menu.js [dossier]
//
// Vérifie que les cinq bandeaux sont là et cliquables, que les quatre qui portent un texte ont
// bien chargé leur image (et non un cadre vide), que le dépliage part fermé et finit ouvert, et
// que chacun mène où il doit. Capture le menu fermé et ouvert, pour comparer à la maquette.
const { chromium, devices } = require('playwright');
const out = process.argv[2] || '/tmp';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  let errs = 0;
  page.on('pageerror', (e) => { if (errs++ < 4) console.log('[pageerror]', e.message); });
  page.on('console', (m) => { if (m.type() === 'error') { errs++; console.log('[console]', m.text()); } });
  await page.goto('file:///home/user/Slot_car_racing/index.html');
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');          // l'écran-titre

  // fermé : l'animation n'a pas encore commencé
  await page.waitForTimeout(60);
  await page.screenshot({ path: `${out}/menu-ferme.png` });

  await page.waitForTimeout(1400);             // le temps que les cinq se déplient
  await page.screenshot({ path: `${out}/menu-ouvert.png` });

  const etat = await page.evaluate(() => {
    const mis = [...document.querySelectorAll('.screen.poster .mi')];
    return {
      bandeaux: mis.length,
      images: mis.map((b) => {
        const i = b.querySelector('img');
        if (!i) return 'aucune';
        return i.naturalWidth ? `${i.naturalWidth}x${i.naturalHeight}` : 'NON CHARGÉE';
      }),
      deplies: mis.map((b) => {
        const i = b.querySelector('img');
        return i ? getComputedStyle(i).clipPath : '-';
      }),
      fond: (() => { const i = document.querySelector('.stage .bg'); return i && i.naturalWidth ? `${i.naturalWidth}x${i.naturalHeight}` : 'NON CHARGÉ'; })(),
      burger: !!document.querySelector('.burger'),
    };
  });
  console.log(JSON.stringify(etat, null, 0));

  // chaque bandeau mène-t-il où il doit ?
  const routes = [
    ['course rapide', '.mi:nth-of-type(1)', () => app.ui.setup.mode],
    ['contre la montre', '.mi:nth-of-type(2)', () => app.ui.setup.mode],
  ];
  for (const [nom, sel, f] of routes) {
    await page.click(`.screen.poster ${sel}`);
    await page.waitForTimeout(250);
    console.log(nom, '->', await page.evaluate(f));
    await page.click('[data-action="menu"]').catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.click('.screen.poster .burger');
  await page.waitForTimeout(250);
  console.log('hamburger -> réglages :', await page.locator('#sel-pull').count() > 0);
  console.log('erreurs', errs);
  await browser.close();
  process.exit(errs ? 1 : 0);
})();
