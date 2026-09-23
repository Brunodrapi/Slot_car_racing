// Counts the scenery actually reaching the screen on Monza and shoots a frame, so a placement
// change can be judged on numbers rather than on a glance at a screenshot.
const { chromium } = require('playwright');
const out = process.argv[2] || '/tmp/prop.png';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto('file:///home/user/Slot_car_racing/index.html');
  // L'écran-titre s'interpose désormais entre le chargement et le menu : n'importe quelle touche
  // le passe, comme pour un joueur.
  await page.waitForTimeout(350);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await page.click('[data-action="setup"][data-mode="timetrial"]');
  await page.waitForTimeout(200);
  await page.click('[data-action="pickTrack"][data-id="monza"]').catch(() => {});
  await page.click('[data-action="startQuick"]');
  await page.waitForTimeout(3000);
  const r = await page.evaluate(() => {
    const R = app.renderer, cam = R.cam;
    let drawn = 0, err = null;
    const orig = R._drawProp.bind(R);
    R._drawProp = function (g, p) { drawn++; try { orig(g, p); } catch (e) { err = e.message; } };
    const t0 = performance.now();
    for (let i = 0; i < 30; i++) R.draw(app.race, app.ui);
    const ms = (performance.now() - t0) / 30;
    R._drawProp = orig;
    return { view: app.save.view, props: (R.props || []).length, drawnPerFrame: drawn / 30, err,
      msPerFrame: +ms.toFixed(2), zoom: +cam.zoom.toFixed(1) };
  });
  console.log(JSON.stringify(r));
  await page.screenshot({ path: out });
  await browser.close();
})();
