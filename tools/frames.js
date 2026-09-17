// Holds the throttle from the start and captures frames to look at the handling.
const { chromium } = require('playwright');
const out = process.argv[2] || '/tmp';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto('file:///home/user/Slot_car_racing/index.html');
  await page.waitForTimeout(400);
  await page.evaluate(() => { for (const c of CUPS) app.save.cups[c.id] = { race: c.tracks.length, points: {}, done: true, finalPos: 1 }; storeSave(app.save); });
  await page.click('[data-action="setup"][data-mode="timetrial"]');
  await page.click('[data-action="pickClass"][data-id="f1classic"]');
  await page.click('[data-action="pickTrack"][data-id="zandvoort"]');
  await page.click('[data-action="startQuick"]');
  await page.waitForTimeout(3800);
  await page.keyboard.down('Space');
  for (let i = 1; i <= 26; i++) {
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => { const p = app.race.player; return `v=${p.v.toFixed(1)} drift=${(p.drift*57.3).toFixed(0)}deg lat=${p.lat.toFixed(1)} state=${p.state} ratio=${p.loadRatio.toFixed(2)} offs=${p.crashes}`; });
    console.log(i, st);
    await page.screenshot({ path: `${out}/f${String(i).padStart(2, '0')}.png` });
  }
  await browser.close();
})();
