// Captures the frames around an off-track excursion to check it looks continuous.
const { chromium } = require('playwright');
const out = process.argv[2] || '/tmp';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto('file:///home/user/Slot_car_racing/index.html');
  // L'écran-titre s'interpose désormais entre le chargement et le menu : n'importe quelle touche
  // le passe, comme pour un joueur.
  await page.waitForTimeout(350);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await page.evaluate(() => { for (const c of CUPS) app.save.cups[c.id] = { race: c.tracks.length, points: {}, done: true, finalPos: 1 }; storeSave(app.save); });
  await page.click('[data-action="setup"][data-mode="timetrial"]');
  await page.click('[data-action="pickClass"][data-id="f1classic"]');
  await page.click('[data-action="pickTrack"][data-id="zandvoort"]');
  await page.click('[data-action="startQuick"]');
  await page.waitForTimeout(3900);
  await page.keyboard.down('Space');
  // wait until the car goes off, then shoot every 0.25 s
  for (let i = 0; i < 90; i++) {
    const st = await page.evaluate(() => app.race.player.state);
    if (st === 'grass') break;
    await page.waitForTimeout(120);
  }
  for (let i = 1; i <= 10; i++) {
    const info = await page.evaluate(() => { const p = app.race.player, q = p.pos; return `${p.state} v=${p.v.toFixed(1)} x=${q.x.toFixed(1)} y=${q.y.toFixed(1)}`; });
    console.log(i, info);
    await page.screenshot({ path: `${out}/off${String(i).padStart(2, '0')}.png` });
    await page.waitForTimeout(250);
  }
  await browser.close();
})();
