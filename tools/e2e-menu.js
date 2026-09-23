// Le menu-affiche : les cinq bandeaux, leur dépliage, et ce sur quoi ils mènent.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-menu.js [dossier]
//
// Vérifie que les cinq bandeaux sont là et cliquables, que chacun a bien chargé son dessin déplié
// (et non un cadre vide), qu'ils restent REPLIÉS tant qu'on n'y touche pas, qu'un appui en ouvre
// un seul, et que chacun mène où il doit.
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

  // au repos : rien ne doit s'être ouvert tout seul
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${out}/menu-ferme.png` });
  const auRepos = await page.evaluate(() => [...document.querySelectorAll('.screen.poster .mi')]
    .map((b) => b.classList.contains('open')));
  console.log('ouverts au repos (doivent être tous faux) :', JSON.stringify(auRepos));

  // un appui : celui-là s'ouvre, les autres non
  await page.click('.screen.poster .mi:nth-of-type(3)');
  await page.waitForTimeout(200);
  console.log('après appui sur le 3e :', JSON.stringify(await page.evaluate(() =>
    [...document.querySelectorAll('.screen.poster .mi')].map((b) => b.classList.contains('open')))));
  await page.screenshot({ path: `${out}/menu-ouvert.png` });
  await page.waitForTimeout(700);
  console.log('il mène à :', await page.evaluate(() => app.state + '/' + (app.net ? app.net.state : '-')));
  await page.evaluate(() => app.toMenu());
  await page.waitForTimeout(400);

  const etat = await page.evaluate(() => {
    const mis = [...document.querySelectorAll('.screen.poster .mi')];
    return {
      bandeaux: mis.length,
      images: mis.map((b) => {
        const i = b.querySelector('img');
        if (!i) return 'aucune';
        return i.naturalWidth ? `${i.naturalWidth}x${i.naturalHeight}` : 'NON CHARGÉE';
      }),
      replies: mis.map((b) => getComputedStyle(b.querySelector('img')).clipPath),
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
    await page.waitForTimeout(800);            // le dépliage, puis l'action
    console.log(nom, '->', await page.evaluate(f));
    await page.click('[data-action="menu"]').catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.click('.screen.poster .burger');
  await page.waitForTimeout(300);
  console.log('hamburger -> réglages :', await page.locator('#sel-pull').count() > 0);
  console.log('erreurs', errs);
  await browser.close();
  process.exit(errs ? 1 : 0);
})();
