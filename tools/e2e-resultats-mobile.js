// L'écran de résultats tient sur un téléphone, en portrait comme en paysage.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-resultats-mobile.js
//
// Au sortir d'une course à Fuji Yama, la colonne du meilleur tour était coupée sur l'iPhone de Bruno :
// en paysage, l'écran gardait la largeur portrait des menus, et six colonnes ne tiennent pas dans un
// téléphone en portrait. On termine une course de dix voitures, avec des pénalités pour que la colonne
// existe, et l'on vérifie : le tableau n'est jamais coupé par l'écran ; il tient en entier sur un
// iPhone 15 Pro en portrait comme en paysage, et sur un SE en paysage ; sur un SE en portrait (320
// points), il peut défiler de côté, mais rien ne disparaît. Voir « LES RÉSULTATS TIENNENT SUR UN
// TÉLÉPHONE » dans css/style.css.
'use strict';
const { chromium, devices } = require('playwright');
const path = require('path');
let fautes = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAUX  ') + m); if (!c) fautes++; };

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [nom, opts, defileAdmis] of [['iPhone 15 Pro portrait', devices['iPhone 15 Pro'], false], ['iPhone 15 Pro paysage', devices['iPhone 15 Pro landscape'], false],
      ['iPhone SE paysage', devices['iPhone SE landscape'], false], ['iPhone SE portrait', devices['iPhone SE'], true]]) {
      const ctx = await browser.newContext({ ...opts, locale: 'fr-FR' });
      await ctx.addInitScript(() => localStorage.setItem('slotracer.save.v2', JSON.stringify({
        name: 'Bruno', lang: 'fr', sound: false, tracesMigrated: true, catsMigrated: true, guideMigrated: true })));
      const p = await ctx.newPage();
      const erreurs = [];
      p.on('pageerror', (e) => erreurs.push(e.message));
      await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
      await p.waitForFunction(() => typeof app !== 'undefined' && app.save);
      await p.evaluate(() => { app.mondial = null; app.leaveSplash(); app.startQuick('race', 'gt', 'suzuka'); });
      await p.waitForFunction(() => app.race && app.race.state === 'racing', null, { timeout: 30000 });
      await p.waitForTimeout(800);
      const r = await p.evaluate(async () => {
        const course = app.race;
        course.cars.forEach((c, i) => { c.penalite = i % 3 === 0 ? 1 : 0; c.fautes = c.penalite ? 1 : 0; });
        course._finish(); app.state = 'results'; app.ui.resultsScreen(course, {});
        await document.fonts.ready;
        const ecran = document.querySelector('#ui > .screen').getBoundingClientRect(), cadre = document.querySelector('.tbl-defile');
        const t = cadre.querySelector('table');
        const colonnes = [...t.querySelectorAll('th')].filter((th) => getComputedStyle(th).display !== 'none').length;
        return { coupe: cadre.getBoundingClientRect().right > ecran.right + 1, defile: t.scrollWidth > cadre.clientWidth + 1, colonnes,
          largeurs: `${Math.round(t.scrollWidth)}/${Math.round(cadre.clientWidth)} px` };
      });
      ok(!r.coupe && (defileAdmis || !r.defile) && !erreurs.length,
        `${nom} : tableau ${r.defile ? 'défilant' : 'entier'} (${r.largeurs}, ${r.colonnes} colonnes), jamais coupé`
        + (erreurs.length ? ' — erreurs : ' + erreurs.join(' | ') : ''));
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  console.log(fautes ? `${fautes} faute(s)` : 'OK');
  process.exitCode = fautes ? 1 : 0;
})();
