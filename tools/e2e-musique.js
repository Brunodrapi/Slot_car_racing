// La musique des menus (js/audio.js, MUSIQUE) : elle joue dans les menus, très bas, se tait en course
// et quand le son est coupé, et revient au retour au menu.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-musique.js
'use strict';
const { chromium } = require('playwright');
const path = require('path');
let fautes = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAUX  ') + m); if (!c) fautes++; };

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] });
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' })).newPage();
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(e.message));
  try {
    await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
    await p.waitForFunction(() => typeof app !== 'undefined' && app.save);
    await p.evaluate(() => { app.save.name = 'Bruno'; app.save.sound = true; app.audio.enabled = true; app.mondial = null; });
    ok(await p.evaluate(() => !!app.audio.musiqueEl && app.audio.musiqueEl.preload === 'auto' && app.state === 'splash'), 'le fichier se précharge dès l\'affiche, avant tout geste');
    await p.mouse.click(640, 400);            // le geste qui ouvre le son (et quitte l'affiche)
    await p.evaluate(() => { if (app.state === 'splash') app.leaveSplash(); });
    ok(await p.evaluate(() => app.state === 'menu' && !app.audio.musiqueEl.paused), 'elle démarre dans le geste même qui quitte l\'affiche, au menu de sélection');
    await p.waitForTimeout(2500);
    const menu = await p.evaluate(() => { const a = app.audio; return { el: !!a.musiqueEl, joue: a.musiqueEl && !a.musiqueEl.paused, gain: a.musiqueGain && a.musiqueGain.gain.value, src: a.musiqueEl && a.musiqueEl.currentSrc, temps: a.musiqueEl && a.musiqueEl.currentTime }; });
    ok(menu.el && menu.joue && /too-cool\.mp3$/.test(menu.src), 'au menu, la musique joue : ' + JSON.stringify(menu));
    ok(menu.gain > 0.05 && menu.gain <= 0.12 + 1e-6, `très bas, après le fondu (gain ${menu.gain && menu.gain.toFixed(3)}, × 0,5 du volume général)`);
    ok(menu.temps > 0.5, `elle avance pour de vrai (${menu.temps && menu.temps.toFixed(2)} s)`);
    await p.evaluate(() => app.startQuick('timetrial', 'gt', 'monza'));
    await p.waitForFunction(() => app.race && app.state === 'race', null, { timeout: 30000 });
    await p.waitForTimeout(1500);
    ok(await p.evaluate(() => app.audio.musiqueEl.paused), 'en course, elle se tait');
    await p.evaluate(() => app.toMenu());
    await p.waitForTimeout(2000);
    ok(await p.evaluate(() => !app.audio.musiqueEl.paused), 'de retour au menu, elle revient');
    await p.evaluate(() => app.audio.setEnabled(false));
    await p.waitForTimeout(1500);
    ok(await p.evaluate(() => app.audio.musiqueEl.paused), 'le son coupé, elle se tait');
    ok(erreurs.length === 0, 'pas d\'erreur dans la page' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } catch (e) { console.error(e); fautes++; }
  await browser.close();
  console.log(fautes ? `MUSIQUE : ${fautes} faute(s)` : 'MUSIQUE OK');
  process.exit(fautes ? 1 : 0);
})();
