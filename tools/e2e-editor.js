// Draws a track in the editor, saves it, then races on it in the game.
const { chromium } = require('playwright');
const out = process.argv[2] || '/tmp';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text()); });
  await page.goto('file:///home/user/Slot_car_racing/editor.html');
  await page.waitForTimeout(300);
  // draw a rounded rectangle racing line: click points on the canvas
  const cv = await page.$('#cv'); const box = await cv.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const pts = [];
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; pts.push([cx + Math.cos(a) * 300 * (1 + 0.25 * Math.cos(3 * a)), cy + Math.sin(a) * 220]); }
  for (const p of pts) { await page.mouse.click(p[0], p[1]); await page.waitForTimeout(30); }
  await page.click('#btn-derive');
  await page.waitForTimeout(400);
  await page.fill('#inp-name', 'Test Ovale');
  await page.fill('#inp-length', '2000');
  await page.dispatchEvent('#inp-length', 'change');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/20-editor.png` });
  await page.click('#btn-save');
  await page.waitForTimeout(500);
  console.log('status:', await page.textContent('#status'));
  console.log('info:', await page.textContent('#info'));
  await page.click('#btn-test');
  await page.waitForTimeout(1500);
  console.log('url:', page.url());
  await page.screenshot({ path: `${out}/21-setup-custom.png` });
  const sel = await page.$eval('.grid.tracks .card.sel b', el => el.textContent).catch(() => 'none');
  console.log('selected track:', sel);
  await page.click('[data-action="startQuick"]');
  await page.waitForTimeout(600);
  await page.keyboard.down('Space');
  await page.waitForTimeout(7000);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}/22-race-custom.png` });
  await page.keyboard.up('Space');
  const info = await page.evaluate(() => { const r = app.race, p = r.player; return { state: r.state, v: p.v, s: p.s, lat: p.lat, sel: p.sel, crashes: p.crashes, len: r.track.length, n: r.cars.length }; });
  console.log('race info', JSON.stringify(info));
  await browser.close();
})();
