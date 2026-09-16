const { chromium } = require('playwright');
(async () => {
  const [,, url, out, w, h, waitMs] = process.argv;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: +w || 1800, height: +h || 1000 } });
  page.on('console', m => console.log('[console]', m.type(), m.text()));
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(url);
  await page.waitForTimeout(+waitMs || 300);
  await page.screenshot({ path: out });
  await browser.close();
})();
