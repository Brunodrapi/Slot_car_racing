// L'écran-titre, sur téléphone et sur bureau.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-splash.js
//
// Vérifie ce qu'un joueur voit en arrivant : l'affiche chargée et non un cadre vide, le numéro de
// build lisible dessus, le titre de l'onglet — puis qu'une touche et qu'un doigt la passent tous
// les deux, puisque l'affiche elle-même dit « n'importe quel bouton ».
const { chromium, devices } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  for (const [nom, opts] of [['telephone', { ...devices['iPhone 13'] }], ['bureau', { viewport: { width: 1100, height: 720 } }]]) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    let errs = 0; page.on('pageerror', e => { if (errs++ < 3) console.log('[pageerror]', e.message); });
    page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text()); });
    await page.goto('file:///home/user/Slot_car_racing/index.html');
  /* Un joueur nommé. Le menu ne s'ouvre plus sans nom, et un essai doit faire ce que fait un
  joueur. On attend que `app` existe : `goto` rend la main au chargement, pas à l'initialisation. */
  await page.waitForFunction(() => typeof app !== 'undefined' && app.save);
  await page.evaluate(() => {
    app.save.name = 'Testeur'; storeSave(app.save);
    /* Et pas de tableau mondial : ces essais mesurent des menus, pas un service distant. Le
    laisser branché ferait partir une requête réseau à chaque ouverture de l'écran des records —
    une source d'échecs qui n'a rien à voir avec ce qu'on vérifie, et qui rendrait la suite
    dépendante d'un serveur. `tools/e2e-mondial.js` s'en charge, avec un faux serveur à lui. */
    app.mondial = null;
  });
    await page.waitForTimeout(800);
    const st = await page.evaluate(() => ({
      etat: app.state,
      affiche: !!document.querySelector('.poster'),
      charge: (() => { const i = document.querySelector('.poster'); return i ? i.naturalWidth + 'x' + i.naturalHeight : 'aucune'; })(),
      version: (document.querySelector('.splash .version') || {}).textContent,
      onglet: document.title,
    }));
    console.log(nom, JSON.stringify(st));
    await page.screenshot({ path: `${process.argv[2] || '/tmp'}/splash-${nom}.png` });
    // n'importe quelle touche
    await page.keyboard.press('x');
    await page.waitForTimeout(300);
    console.log(nom, 'apres une touche :', await page.evaluate(() => ({ etat: app.state, bandeaux: document.querySelectorAll('.screen.poster .mi').length })));
    // on revient au titre et on essaie le doigt
    await page.evaluate(() => { app.state = 'splash'; app.ui.splash(); });
    await page.waitForTimeout(200);
    if (nom === 'telephone') await page.touchscreen.tap(200, 400); else await page.mouse.click(550, 360);
    await page.waitForTimeout(300);
    console.log(nom, 'apres un appui  :', await page.evaluate(() => ({ etat: app.state, menu: !!document.querySelector('[data-action="setup"]') })), 'erreurs', errs);
    await page.close();
  }
  await browser.close();
})();
