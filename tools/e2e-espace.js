// Le départ au clavier : la touche ESPACE au lieu des consignes écrites (js/render.js, _toucheEspace).
// Beige au repos, verte avec un V dans un rond quand on tient Espace.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-espace.js [dossier des captures]
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.argv[2] || null;
let fautes = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAUX  ') + m); if (!c) fautes++; };

(async () => {
  const browser = await chromium.launch();
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' })).newPage();
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(e.message));
  try {
    await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
    await p.waitForFunction(() => typeof app !== 'undefined' && app.save);
    await p.evaluate(() => { app.save.name = 'Bruno'; app.mondial = null; app.leaveSplash(); app.startQuick('timetrial', 'gt', 'monza'); });
    await p.waitForFunction(() => app.race && app.race.state === 'countdown' && app.race.countdown < 3.4, null, { timeout: 30000 });
    // on retient le compte à rebours pour photographier à loisir
    await p.evaluate(() => { app.race.countdown = 3; const u = app.race.update.bind(app.race); app.race.update = (dt, i) => { const c = app.race.countdown; u(dt, i); app.race.countdown = c; }; });
    ok(await p.evaluate(() => app.desktop && app.controls.mode === 'keyboard'), 'au clavier, sur ordinateur');
    // la touche est dessinée à la place des consignes : on écoute les textes écrits sur le canevas
    await p.evaluate(() => { window.textes = []; const g = app.renderer.hud || app.renderer.g; const f = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, ...r) { window.textes.push(String(t)); return f.call(this, t, ...r); }; });
    await p.waitForTimeout(300);
    const vus = await p.evaluate(() => [...new Set(window.textes)]);
    ok(vus.includes('ESPACE') && !vus.some((t) => /Maintiens|trajectoire/.test(t)), 'la touche ESPACE, plus de consignes écrites : ' + vus.filter((t) => /ESPACE|Maintiens|trajectoire/.test(t)).join(', '));
    if (OUT) await p.screenshot({ path: path.join(OUT, 'espace-repos.png'), clip: { x: 440, y: 100, width: 400, height: 180 } });
    // ce que la touche montre : on lit l'état passé au dessin (les captures montrent les couleurs)
    await p.evaluate(() => { window.etats = []; const f = app.renderer._toucheEspace.bind(app.renderer); app.renderer._toucheEspace = (g, x, y, appuie, nom) => { window.etats.push(appuie); f(g, x, y, appuie, nom); }; });
    await p.waitForTimeout(300);
    const repos = await p.evaluate(() => window.etats.slice(-3));
    await p.keyboard.down('Space');
    await p.waitForTimeout(300);
    const appui = await p.evaluate(() => window.etats.slice(-3));
    if (OUT) await p.screenshot({ path: path.join(OUT, 'espace-appui.png'), clip: { x: 440, y: 100, width: 400, height: 180 } });
    await p.keyboard.up('Space');
    await p.waitForTimeout(300);
    const relache = await p.evaluate(() => window.etats.slice(-3));
    ok(repos.length && repos.every((e) => !e), 'au repos, la touche est beige');
    ok(appui.length && appui.every((e) => e), 'Espace tenu, elle devient verte, avec le V');
    ok(relache.length && relache.every((e) => !e), 'Espace lâché, elle redevient beige');
    ok(erreurs.length === 0, 'pas d\'erreur dans la page' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } catch (e) { console.error(e); fautes++; }
  await browser.close();
  console.log(fautes ? `ESPACE : ${fautes} faute(s)` : 'ESPACE OK');
  process.exit(fautes ? 1 : 0);
})();
