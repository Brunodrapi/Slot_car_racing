const { chromium } = require('playwright');
const out = process.argv[2] || '/tmp';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text()); });
  await page.goto('file:///home/user/Slot_car_racing/index.html');
  await page.click('[data-action="career"]');
  await page.click('[data-action="cup"][data-id="kart"]');
  const fast = async () => page.evaluate(() => {
    const r = app.race; let n = 0;
    while (r.state !== "finished" && n++ < 400000) { const thr = aiThrottle(r.player, r.cars, r.dt, { marginBase: 0.985, marginSpread: 0 }); r.update(r.dt, thr); }
    return { state: r.state, pos: r.positionOf(r.player), time: r.time, crashes: r.player.crashes, best: r.player.bestLap };
  });
  for (let i = 0; i < 3; i++) {
    await page.click('[data-action="startCup"]');
    await page.waitForTimeout(200);
    console.log('race', i + 1, JSON.stringify(await fast()));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/10-results-${i + 1}.png` });
  }
  await page.click('[data-action="cup"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/11-cup-done.png` });
  await page.click('[data-action="career"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/12-career-after.png` });
  // time trial flow
  await page.click('[data-action="menu"]');
  await page.click('[data-action="setup"][data-mode="timetrial"]');
  await page.click('[data-action="startQuick"]');
  await page.waitForTimeout(200);
  await page.evaluate(() => { const r = app.race; let n = 0; while (r.player.lap < 2 && n++ < 400000) { const thr = aiThrottle(r.player, r.cars, r.dt, { marginBase: 0.985, marginSpread: 0 }); r.update(r.dt, thr); } });
  await page.keyboard.press('Escape');
  await page.click('[data-action="endTT"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/13-tt-results.png` });
  const save = await page.evaluate(() => localStorage.getItem('slotracer.save.v1'));
  console.log('save', save.slice(0, 300));
  await browser.close();
})();
