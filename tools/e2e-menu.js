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

  /* Changer un réglage ne doit pas renvoyer la page en haut.

  Chaque choix — le nombre de tours, le circuit, la voiture — reconstruit l'écran entier, et
  remplacer le contenu remet le défilement à zéro : on choisissait ses tours en bas de page et on se
  retrouvait en haut, à devoir redescendre pour le réglage suivant. L'essai fait donc ce que fait le
  joueur : il descend, il clique, il regarde où il est.

  Et il vérifie l'autre moitié de la règle, sans quoi le remède serait pire : revenir au menu puis
  rouvrir l'écran doit repartir du haut. Conserver le défilement d'un écran à l'autre donnerait une
  page ouverte au milieu, sans qu'on sache pourquoi. */
  await page.evaluate(() => app.ui.setupScreen('race'));
  await page.waitForTimeout(400);
  const scrollable = await page.evaluate(() => {
    const e = document.querySelector('.screen');
    return e ? e.scrollHeight - e.clientHeight : 0;
  });
  if (scrollable < 50) {
    errs++; console.log('  ÉCHEC : l’écran de départ ne défile pas, l’essai ne prouverait rien');
  } else {
    const apres = await page.evaluate(async () => {
      const e = document.querySelector('.screen');
      e.scrollTop = Math.round((e.scrollHeight - e.clientHeight) * 0.7);
      const avant = e.scrollTop;
      const b = document.querySelector('[data-action="pickLaps"]:not(.sel)')
        || document.querySelector('[data-action="pickDiff"]:not(.sel)');
      if (!b) return { avant, err: 'aucun réglage à changer' };
      b.click();
      await new Promise((r) => setTimeout(r, 200));
      const e2 = document.querySelector('.screen');
      return { avant, apres: e2.scrollTop, quoi: b.dataset.action };
    });
    if (apres.err) { errs++; console.log('  ÉCHEC :', apres.err); }
    else {
      const perdu = Math.abs(apres.apres - apres.avant);
      console.log(`changer un réglage (${apres.quoi}) : défilement ${apres.avant} → ${apres.apres} px`);
      if (perdu > 30) { errs++; console.log(`  ÉCHEC : la page a bougé de ${perdu} px, elle devait rester`); }
      else console.log('  ok : la page reste où elle était');
    }
    // revenir au menu puis rouvrir : là, on doit repartir du haut
    const rouvert = await page.evaluate(async () => {
      app.ui.menu();
      await new Promise((r) => setTimeout(r, 150));
      app.ui.setupScreen('race');
      await new Promise((r) => setTimeout(r, 150));
      return document.querySelector('.screen').scrollTop;
    });
    if (rouvert > 5) { errs++; console.log(`  ÉCHEC : rouvrir l’écran le laisse à ${rouvert} px du haut`); }
    else console.log('  ok : rouvrir l’écran repart du haut');
  }

  console.log('erreurs', errs);
  await browser.close();
  process.exit(errs ? 1 : 0);
})();
