// Serve the four releases locally, then run with BASE_URL, OUT_DIR and their directory names.
// Godot builds use names starting with "godot" or "candidat". Each argument is one fresh race.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const out = process.env.OUT_DIR || './benchmark';
const base = process.env.BASE_URL || 'http://127.0.0.1:8844/';
const duration = Number(process.env.MS || 18000);
fs.mkdirSync(out, {recursive:true});

async function run(browser, build, runIndex) {
  const godot = /^(godot|candidat)/.test(build);
  const context = await browser.newContext({
    viewport:{width:844,height:390}, deviceScaleFactor:2, isMobile:true, hasTouch:true,
    locale:'fr-FR', serviceWorkers:'block',
    userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
  });
  try {
    const page = await context.newPage();
    await context.route(/^https:\/\//, route => route.abort());
    if (godot) await page.addInitScript(() => { window.GRIP_ESSAI = []; });
    await page.goto(new URL(build+'/',base).href, {waitUntil:'domcontentloaded'});
    if (godot) {
      await page.waitForFunction(() => window.gripEtat?.script, null, {timeout:90000});
      await page.evaluate(() => GRIP_ESSAI.push({op:'nom',nom:'Banc',langue:'fr'}, {op:'auto',on:true}, {op:'ecran',nom:'course'}));
      await page.waitForFunction(() => window.gripEtat?.script === 'course_vue.gd', null, {timeout:90000});
    } else {
      await page.waitForFunction(() => window.app?.save);
      await page.evaluate(() => {
        Object.assign(app.save, {name:'Banc', cat:'gt3', models:{gt3:'porsche991gt3r'}, difficulty:'medium', laps:3, timeOfDay:'day', degats:true});
        const start = app._startRace.bind(app);
        app._startRace = (opts, ctx) => start({...opts, nCars:10, modelId:'porsche991gt3r'}, ctx);
        app.startQuick('race','gt3','spa');
        function drive() {
          if (app.race) app.input.throttle = Number(aiThrottle(app.race.player,app.race.cars,app.race.dt,{marginBase:.95,marginSpread:0}));
          requestAnimationFrame(drive);
        }
        drive();
      });
      await page.waitForFunction(() => app.race?.state === 'racing', null, {timeout:60000});
    }
    await page.waitForTimeout(godot ? 15000 : 10000);
    const state = () => page.evaluate(g => g ? gripEtat.script : [app.race.track.id,app.race.cars.length,app.race.player.s,app.race.state], godot);
    const before = await state();
    const canvas = await page.locator('canvas').first().evaluate(c => [c.width,c.height]);
    const frames = await page.evaluate(ms => new Promise(resolve => {
      const intervals = [];
      let first, prev;
      function frame(t) {
        if (prev !== undefined) intervals.push(t-prev);
        else first = t;
        prev = t;
        if (t-first >= ms) resolve(intervals);
        else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }), duration);
    const after = await state();
    fs.appendFileSync(path.join(out,'intervals.jsonl'),JSON.stringify({build,runIndex,canvas,before,after,frames})+'\n');
    await page.screenshot({path:path.join(out,build+'.png')});
    console.log(build, frames.length, canvas, before, after);
  } finally { await context.close(); }
}

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM || '/usr/bin/chromium',
    args:['--no-sandbox','--disable-gpu-rasterization','--disable-accelerated-2d-canvas','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
  try {
    for (const [index,build] of process.argv.slice(2).entries()) await run(browser,build,index);
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode=1; });
