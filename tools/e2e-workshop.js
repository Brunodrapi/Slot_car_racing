// Imports a generated UR2D-style sprite folder into the workshop and races with it.
const { chromium } = require('playwright');
const out = process.argv[2] || '/tmp';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text()); });
  await page.goto('file:///home/user/Slot_car_racing/index.html');
  await page.waitForTimeout(400);
  // generate sprites in-page: base (dark outline + wheels), color (body mask), car_1 (stripe)
  const pngs = await page.evaluate(() => {
    const mk = (draw) => { const c = document.createElement('canvas'); c.width = 200; c.height = 90; const g = c.getContext('2d'); draw(g); return c.toDataURL('image/png').split(',')[1]; };
    const base = mk(g => { g.fillStyle = '#111'; g.fillRect(30, 4, 40, 18); g.fillRect(30, 68, 40, 18); g.fillRect(130, 4, 40, 18); g.fillRect(130, 68, 40, 18); g.fillStyle = '#333'; g.beginPath(); g.roundRect(10, 15, 180, 60, 20); g.fill(); });
    const color = mk(g => { g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(16, 20, 168, 50, 16); g.fill(); g.fillStyle = '#888'; g.fillRect(70, 26, 40, 38); });
    const car1 = mk(g => { g.fillStyle = '#ffd400'; g.fillRect(16, 42, 168, 6); g.fillStyle = '#1d2733'; g.fillRect(110, 24, 30, 42); });
    return { base, color, car1 };
  });
  await page.click('[data-action="workshop"]');
  await page.waitForTimeout(300);
  await page.fill('#ws-name', 'Proto Test');
  await page.selectOption('#ws-cat', 'gt');
  await page.setInputFiles('#ws-folder', [
    { name: 'car_base.png', mimeType: 'image/png', buffer: Buffer.from(pngs.base, 'base64') },
    { name: 'car_color.png', mimeType: 'image/png', buffer: Buffer.from(pngs.color, 'base64') },
    { name: 'car_1.png', mimeType: 'image/png', buffer: Buffer.from(pngs.car1, 'base64') },
  ]);
  await page.click('[data-action="wsAdd"]');
  await page.waitForTimeout(800);
  console.log('ws msg:', await page.textContent('#ws-msg'));
  await page.screenshot({ path: `${out}/30-workshop.png` });
  // unlock everything for the test and pick the custom model
  await page.click('[data-action="menu"]');
  await page.click('[data-action="setup"][data-mode="race"]');
  await page.waitForTimeout(300);
  const customBtn = await page.$('button[data-action="pickModel"]:has-text("Proto Test")');
  console.log('custom model card:', !!customBtn);
  if (customBtn) await customBtn.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/31-setup-models.png` });
  await page.click('[data-action="startQuick"]');
  await page.waitForTimeout(600);
  await page.keyboard.down('Space');
  await page.waitForTimeout(3000);
  await page.keyboard.up('Space');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/32-race-sprite.png` });
  const info = await page.evaluate(() => { const p = app.race.player; return { model: p.cls.name, sprite: !!p.cls.sprite, v: p.v }; });
  console.log('race info', JSON.stringify(info));
  await browser.close();
})();
