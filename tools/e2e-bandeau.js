// Le bandeau de titre des écrans du paddock tient dans la largeur, logo compris.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-bandeau.js
//
// Sur quatre iPhone (SE, 13 mini, 15 Pro, 15 Pro Max), en français et en anglais, pour les écrans qui
// portent le logo — course rapide, contre-la-montre, comment jouer, installez-moi — le logo GRIP doit
// être affiché et entier, et le titre ne jamais descendre sous 16 px. « CONTRE-LA-MONTRE » poussait le
// logo hors de l'écran sur l'iPhone de Bruno ; voir `_ajusteBandeau` dans js/ui.js.
'use strict';
const { chromium, devices } = require('playwright');
const path = require('path');
let fautes = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAUX  ') + m); if (!c) fautes++; };

(async () => {
  const browser = await chromium.launch();
  try {
    for (const nom of ['iPhone SE', 'iPhone 13 Mini', 'iPhone 15 Pro', 'iPhone 15 Pro Max']) for (const lang of ['fr', 'en']) {
      const ctx = await browser.newContext({ ...devices[nom], locale: lang });
      await ctx.addInitScript((lang) => localStorage.setItem('slotracer.save.v2', JSON.stringify({
        name: 'Bruno', lang, sound: false, tracesMigrated: true, catsMigrated: true, guideMigrated: true })), lang);
      const p = await ctx.newPage();
      const erreurs = [];
      p.on('pageerror', (e) => erreurs.push(e.message));
      await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
      await p.waitForFunction(() => typeof app !== 'undefined' && app.save);
      const r = await p.evaluate(async () => {
        app.mondial = null; app.leaveSplash(); app.state = 'menu';
        await document.fonts.ready;
        const out = [];
        for (const [n, f] of [['course', () => app.ui.setupScreen('race')], ['contre-la-montre', () => app.ui.setupScreen('timetrial')],
          ['comment jouer', () => app.ui.howtoScreen()], ['installez-moi', () => app.ui.installScreen()]]) {
          f();
          // comme dans le jeu : la police des titres arrive, et le bandeau se réajuste
          await document.fonts.ready; await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
          const barre = document.querySelector('.topbar'), logo = barre.querySelector('.paddock-logo'), titre = barre.querySelector('h2');
          const b = barre.getBoundingClientRect(), l = logo.getBoundingClientRect();
          out.push({ n, entier: !logo.hidden && l.width > 0 && l.left >= b.left && l.right <= b.right + 1, police: parseFloat(getComputedStyle(titre).fontSize),
            court: barre.classList.contains('compacte') });
        }
        return out;
      });
      const mauvais = r.filter((x) => !x.entier || x.police < 16);
      ok(!mauvais.length && !erreurs.length, `${nom} ${lang} : logo entier partout (titres ${r.map((x) => `${x.police}${x.court ? '←' : ''}`).join(' / ')} px)`
        + (mauvais.length ? ' — en défaut : ' + mauvais.map((x) => x.n).join(', ') : '') + (erreurs.length ? ' — erreurs : ' + erreurs.join(' | ') : ''));
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  console.log(fautes ? `${fautes} faute(s)` : 'OK');
  process.exitCode = fautes ? 1 : 0;
})();
