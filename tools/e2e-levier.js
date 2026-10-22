// Le levier de ligne n'a que des crans, et chacun fait son clac.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-levier.js [dossier des captures]
//
// Au format d'un iPhone, en course : on pose le doigt sur le cran du milieu et on le fait glisser
// pixel par pixel jusqu'en haut, puis jusqu'en bas. La ligne demandée ne doit jamais prendre que les
// valeurs des crans (-1, 0, 1), ne quitter un cran qu'après avoir passé le milieu vers le suivant,
// et chaque changement doit appeler le clac — ni plus, ni moins. Puis le clavier : une flèche, un cran,
// un clac. Les captures montrent le levier sur chacun des trois crans.
'use strict';
const { chromium, devices } = require('playwright');
const path = require('path');
const OUT = process.argv[2] || null;
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
    await p.evaluate(() => { app.save.name = 'Bruno'; app.mondial = null; app.leaveSplash(); app.startQuick('timetrial', 'gt', 'monza'); });
    await p.waitForFunction(() => app.race && app.race.state === 'racing', null, { timeout: 30000 });
    // le clac est compté avant la garde du son, qui ne joue rien sans contexte audio
    await p.evaluate(() => { window.clacs = []; const f = app.audio.clac.bind(app.audio); app.audio.clac = (sens) => { window.clacs.push(sens); f(sens); }; });
    const s = await p.evaluate(() => ({ ...app.renderer.slider }));
    const yCran = (v) => s.y + s.len / 2 - v * s.len / 2;

    // Du milieu vers le haut, puis tout en bas, un pixel à la fois.
    await p.mouse.move(s.x, yCran(0));
    await p.mouse.down();
    const vus = [], bascules = [];
    let avant = await p.evaluate(() => app.input.sel);
    const parcours = [];
    for (let y = yCran(0); y >= yCran(1) - 10; y--) parcours.push(y);
    for (let y = yCran(1) - 10; y <= yCran(-1) + 10; y++) parcours.push(y);
    for (const y of parcours) {
      await p.mouse.move(s.x, y);
      const sel = await p.evaluate(() => app.input.sel);
      vus.push(sel);
      if (sel !== avant) { bascules.push({ de: avant, a: sel, v: (s.y + s.len / 2 - y) / (s.len / 2) }); avant = sel; }
    }
    await p.mouse.up();
    ok(vus.every((v) => v === -1 || v === 0 || v === 1), `jamais entre deux crans : ${[...new Set(vus)].sort().join(', ')}`);
    ok(bascules.map((b) => `${b.de}→${b.a}`).join(' ') === '0→1 1→0 0→-1',
      `les crans se suivent : ${bascules.map((b) => `${b.de}→${b.a} à ${b.v.toFixed(2)}`).join(', ')}`);
    ok(bascules.every((b) => Math.abs(b.v - b.de) > 0.6), 'chaque cran se quitte au-delà du milieu (franchissement à plus de 0,6 cran)');
    const clacs = await p.evaluate(() => window.clacs.slice());
    ok(clacs.join(',') === '1,-1,-1', `un clac par cran, dans le bon sens : ${clacs.join(', ')}`);

    // Au clavier.
    await p.evaluate(() => { window.clacs = []; });
    await p.keyboard.press('ArrowUp');
    ok(await p.evaluate(() => app.input.sel === 0 && window.clacs.join(',') === '1'), 'flèche vers le haut : un cran, un clac');
    await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp');
    ok(await p.evaluate(() => app.input.sel === 1 && window.clacs.join(',') === '1,1'), 'en butée : pas de clac de plus');

    if (OUT) {
      for (const [v, nom] of [[1, 'jaune'], [0, 'ideale'], [-1, 'bleue']]) {
        await p.evaluate((v) => app.poseCran(v), v);
        await p.waitForTimeout(250);
        await p.screenshot({ path: path.join(OUT, `levier-${nom}.png`), clip: { x: Math.max(0, s.x - 30), y: s.y - 40, width: 150, height: s.len + 80 } });
      }
      await p.screenshot({ path: path.join(OUT, 'levier-course.png') });
    }
    ok(erreurs.length === 0, 'aucune erreur de page' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } finally {
    await browser.close();
  }
  console.log(fautes ? `${fautes} faute(s)` : 'OK');
  process.exitCode = fautes ? 1 : 0;
})();
