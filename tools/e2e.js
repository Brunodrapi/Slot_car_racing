// Drives the game in headless Chromium: menus, a race with throttle held, screenshots.
const { chromium } = require('playwright');
const out = process.argv[2] || '/tmp';
const W = +process.argv[3] || 1280, H = +process.argv[4] || 800;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text()); });
  page.on('pageerror', e => { errors.push(e.message); console.log('[pageerror]', e.message); });
  await page.goto('file:///home/user/Slot_car_racing/index.html');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/01-menu.png` });
  await page.click('[data-action="setup"][data-mode="race"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/02-setup.png`, fullPage: false });
  await page.click('[data-action="career"]').catch(() => {});
  await page.waitForTimeout(200);
  // back to setup via menu
  await page.click('[data-action="menu"]');
  await page.click('[data-action="career"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/03-career.png` });
  await page.click('[data-action="cup"][data-id="gt"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/04-cup.png` });
  await page.click('[data-action="startCup"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/05-countdown.png` });
  await page.keyboard.down('Space');
  await page.waitForTimeout(6500);
  await page.screenshot({ path: `${out}/06-race.png` });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${out}/07-race2.png` });
  await page.keyboard.up('Space');
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/08-pause.png` });
  const info = await page.evaluate(() => { const r = window.app.race; const p = r.player; return { state: r.state, time: r.time, v: p.v, s: p.s, lat: p.lat, lap: p.lap, crashes: p.crashes, pos: r.positionOf(p), n: r.cars.length, fps: null }; });
  console.log('race info', JSON.stringify(info));
  // measure frame time
  await page.click('[data-action="resume"]');
  const fps = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
  console.log('fps ~', fps);
  console.log('errors', errors.length);
  await browser.close();
})();
