// Les cadrans du menu de sélection, lus à l'écran.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-gauges.js [dossier]
//
// L'invariant : **deux voitures qui affichent le même chiffre affichent le même arc**. Il se casse
// tout seul dès qu'on arrondit le texte sans arrondir aussi la valeur qui pilote l'arc — la 787B
// s'arrête en 20,118 m et la CSL en 20,298 m, et au mètre près les deux montraient « 20 » avec
// deux arcs différents. Vérifie aussi qu'aucun cadran n'est plein, les bornes étant absolues.
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
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await page.click('.screen.poster .mi:nth-of-type(1)');
  await page.waitForTimeout(2500);
  const lu = await page.evaluate(() => [...document.querySelectorAll('.grid.models .card')].map((c) => ({
    nom: c.querySelector('b').textContent.trim(),
    cadrans: [...c.querySelectorAll('.gauge')].map((g) => ({
      unite: g.querySelector('small').textContent,
      chiffre: g.querySelector('.num').firstChild.textContent,
      arc: Math.round(parseFloat(getComputedStyle(g.querySelector('.val')).strokeDasharray) / 84.8 * 1000) / 10,
    })),
  })));
  let fautes = 0;
  for (let i = 0; i < 4; i++) {
    const par = {};
    for (const v of lu) { const g = v.cadrans[i]; (par[g.chiffre] ||= []).push(`${v.nom} ${g.arc}%`); }
    for (const [ch, liste] of Object.entries(par)) {
      if (liste.length < 2) continue;
      const ok = new Set(liste.map((x) => x.split(' ').pop())).size === 1;
      if (!ok) fautes++;
      console.log(ok ? '  ok ' : 'FAUTE', lu[0].cadrans[i].unite.padEnd(9), ch.padStart(6), '→', liste.join(' | '));
    }
  }
  console.log(fautes === 0 ? 'AUCUNE incohérence chiffre/arc à l’écran' : fautes + ' INCOHÉRENCES');
  const plein = lu.flatMap((v) => v.cadrans.filter((g) => g.arc >= 100).map((g) => `${v.nom} ${g.unite}`));
  console.log(plein.length ? 'CADRAN PLEIN : ' + plein.join(', ') : 'aucun cadran plein (max ' +
    Math.max(...lu.flatMap((v) => v.cadrans.map((g) => g.arc))) + ' %)');
  console.log('cartes', lu.length, '· errors', errs);
  if (fautes || plein.length || errs) process.exitCode = 1;
  await page.screenshot({ path: `${out}/pick.png`, fullPage: true });
  await browser.close();
})();
