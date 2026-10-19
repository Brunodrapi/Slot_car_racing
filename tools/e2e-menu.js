// Responsive menus: real navigation, geometry, selection persistence and screenshots.
'use strict';
const {chromium,devices}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'), out=process.argv[2]||'/tmp/menus';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r)); const browser=await chromium.launch({args:['--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});const errors=[];
 try {
 for(const [name,opts] of [['pc',{viewport:{width:1440,height:900}}],['pc-portable',{viewport:{width:1366,height:768}}],['mobile',{...devices['iPhone 13']}],['petit-mobile',{...devices['iPhone SE']}],['tablette',{...devices['iPad Mini']}],['pc-compact',{viewport:{width:850,height:600}}]]) {
  const ctx=await browser.newContext(opts),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`http://127.0.0.1:${server.address().port}/index.html`);await p.waitForFunction(()=>typeof app!=='undefined'&&app.save);
  await p.evaluate(()=>{app.save.name='Pilote';app.save.lang='fr';app.mondial=null;app.ui.splash();});
  await p.screenshot({scale:'css',path:path.join(out,`${name}-titre.png`)});
  await p.keyboard.press('Enter');await p.waitForSelector('.mode-card');
  const geometry=()=>[...document.querySelectorAll('.mode-card')].map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height];});
  await p.waitForFunction(()=>[...document.querySelectorAll('.mode-art img')].every(i=>i.complete&&i.naturalWidth>0));
  const home=await p.evaluate(()=>{
    const settings=document.querySelector('.home-settings').getBoundingClientRect(), pilot=document.querySelector('.pilot-button').getBoundingClientRect();
    return {visible:settings.top>=0&&settings.bottom<=innerHeight&&pilot.top>=0&&pilot.bottom<=innerHeight, name:document.querySelector('.pilot-button').textContent};
  });assert(home.visible,'settings and driver visible without scrolling');assert(home.name.includes('Pilote'));
  const before=await p.evaluate(geometry); assert.equal(before.length,3); assert(before.every(r=>r[0]===before[0][0]&&r[2]===before[0][2]));
  await p.locator('.mode-card').first().focus();await p.waitForTimeout(250);assert.deepEqual(await p.evaluate(geometry),before,'focus must not shift buttons');
  await p.screenshot({scale:'css',path:path.join(out,`${name}-menu.png`)});
  await p.locator('[data-mode="race"]').click();await p.waitForSelector('.setup-screen');
  for(const mode of ['race','timetrial']) {
   if(mode==='timetrial'){await p.locator('[data-action="menu"]').click();await p.locator('[data-mode="timetrial"]').click();}
   assert.equal(await p.evaluate(()=>app.ui.setup.mode),mode);
   const background=await p.locator('.paddock-track').evaluate(el=>getComputedStyle(el).backgroundImage);
   assert(background.includes('/art/interface/circuits/'),'selected circuit artwork present');
   const bgUrl=background.match(/url\(["']?(.*?)["']?\)/)[1];
   assert((await p.request.get(bgUrl)).ok(),'selected circuit artwork resolves');
   await p.waitForTimeout(300);
   if(mode==='timetrial'&&!await p.evaluate(()=>app.desktop))assert(!await p.locator('.setup-options').isVisible(),'no empty race options in mobile time trial');
   const overflow=await p.evaluate(()=>{const s=document.querySelector('.screen');return s.scrollWidth>s.clientWidth+1;});
   if(overflow){console.log(await p.evaluate(()=>[...document.querySelectorAll('.screen *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&!e.closest('.rail')).map(e=>({class:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right})).slice(0,20)));await p.screenshot({path:path.join(out,name+'-overflow.png')});}
   assert(!overflow,'screen horizontal overflow');
   assert(await p.locator('.setup-block').first().evaluate(e=>e.getBoundingClientRect().height>50),'visible selection panel');
   /* Les réglages sont des pastilles : une par réglage, qui passe à la valeur suivante. */
   assert.equal(await p.locator('[data-action="pickDiff"]').count(),mode==='race'?1:0);
   if(mode==='race'){
    const d0=await p.evaluate(()=>app.save.difficulty);await p.locator('[data-action="pickDiff"]').click();
    const d1=await p.evaluate(()=>app.save.difficulty);assert.notEqual(d1,d0,'la pastille de difficulté passe au niveau suivant');
    await p.evaluate(d=>{app.save.difficulty=d;app.ui.setupScreen('race');},d0);
   }
   /* Sur PC, le paddock tient dans l'écran : rien ne défile, ni la page ni l'écran. */
   if(await p.evaluate(()=>app.desktop&&innerWidth>850)){
    const reste=await p.evaluate(()=>{const s=document.querySelector('.screen');return s.scrollHeight-s.clientHeight;});
    assert(reste<=1,`${name} ${mode} : le paddock PC défile de ${reste} px`);
    const bar=await p.locator('.setup-launch .primary').evaluate(b=>{const r=b.getBoundingClientRect();return r.bottom<=innerHeight&&r.right<=innerWidth;});
    assert(bar,'« En piste ! » entièrement visible sans défiler');
   }
   assert(await p.locator('.topbar .titre-damier').count()===1&&await p.locator('.setup-launch .launch-damier').count()===1,'damiers du titre et de « En piste ! »');
   const next=p.locator('[data-action="pickModel"]:not(.sel)').first(),id=await next.getAttribute('data-id');await next.click();
   assert.equal(await p.locator(`[data-action="pickModel"][data-id="${id}"]`).getAttribute('aria-pressed'),'true');
   const selected=await p.locator('[data-action="pickModel"].sel b').first().textContent();assert((await p.locator('.preview-copy b').textContent()).includes(selected.trim()));
   const track=p.locator('[data-action="pickTrack"]:not(.sel):not(:disabled)').first(),tid=await track.getAttribute('data-id');await track.click();assert.equal(await p.evaluate(()=>app.ui.setup.trackId),tid);
   await p.evaluate(()=>document.querySelector('.screen').scrollTop=0);await p.waitForTimeout(200);
   await p.screenshot({scale:'css',path:path.join(out,`${name}-${mode}.png`)});
   if(mode==='race') {
    const scroll=await p.evaluate(async()=>{let e=document.querySelector('.screen');e.scrollTop=e.scrollHeight;const before=e.scrollTop;document.querySelector('[data-action="pickLaps"]:not(.sel)').click();await new Promise(r=>setTimeout(r,100));return [before,document.querySelector('.screen').scrollTop];});assert(Math.abs(scroll[0]-scroll[1])<30,'selection should preserve scroll');
    if(name==='pc'||name==='mobile')await p.screenshot({scale:'css',path:path.join(out,`${name}-reglages.png`)});
   }
  }
  // Match the approved reference with a three-livery GT and Spa; the choices are interactive.
  if(name==='pc'||name==='mobile') {
   await p.evaluate(()=>{app.save.models.gt='m1procar';app.ui.setup.classId='gt';app.save.cat='gt';app.save.filtreCat='gt';app.ui.setup.trackId='spa';app.ui.setupScreen('race');});
   await p.waitForSelector('.livery-choice');
   assert.equal(await p.locator('.livery-choice').count(),3);
   await p.locator('.livery-choice').nth(1).click();
   assert.equal(await p.evaluate(()=>app.playerLivreeFor('m1procar')),1);
   await p.locator('.livery-choice').first().click();
   assert.equal(await p.evaluate(()=>app.playerLivreeFor('m1procar')),0);
   await p.evaluate(async()=>{document.querySelector('.screen').scrollTop=0;await document.fonts.ready;await Promise.all([...document.images].map(im=>im.decode().catch(()=>{})));});
   assert(await p.evaluate(()=>document.fonts.check('900 italic 30px Racing')));
   assert(await p.locator('.circuit-flag').first().evaluate(im=>im.complete&&im.naturalWidth>0));
   const map=await p.locator('.preview-track').evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return {delta:Math.abs((a.left+a.right)/2-(b.left+b.right)/2),bg:getComputedStyle(el).backgroundColor};});
   assert(map.delta<2,'map centered on circuit illustration');assert.equal(map.bg,'rgba(0, 0, 0, 0)');
   await p.screenshot({scale:'css',path:path.join(out,name+'-reference.png')});
   if(name==='mobile'){await p.locator('.circuit-sheet').scrollIntoViewIfNeeded();await p.screenshot({scale:'css',path:path.join(out,'mobile-affiche.png')});}
  }
  await p.locator('[data-action="menu"]').click();await p.locator('[data-action="multi"]').click();await p.waitForSelector('.lobby-entry');
  assert.equal(await p.locator('[data-action="netWatch"]').count(),1);await p.screenshot({scale:'css',path:path.join(out,`${name}-multi.png`)});
  // English labels are DOM text, not baked into an illustration.
  await p.evaluate(()=>{app.save.lang='en';app.toMenu();});assert.equal(await p.locator('.mode-card').first().locator('b').textContent(),'Quick race');
  await p.locator('.home-settings').click();assert.equal(await p.locator('#sel-diff option').count(),5);
  console.log(name,'navigation, alignment, selections, scroll, FR/EN: OK');await ctx.close();
 }
 const ctx=await browser.newContext({viewport:{width:1440,height:900}});
 const double=/const DOUBLE = `([\s\S]*?)`;/m.exec(fs.readFileSync(path.join(__dirname,'e2e-duo.js'),'utf8'))[1];
 const pages=[];
 for(const name of ['Hote','Invite']) {
  const p=await ctx.newPage();pages.push(p);p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`http://127.0.0.1:${server.address().port}/index.html`);await p.waitForFunction(()=>typeof app!=='undefined'&&app.save);
  await p.evaluate(double);await p.evaluate(name=>{app.mondial=null;app.save.name=name;app.state='lobby';},name);
 }
 const [h,g]=pages;
 const code=await h.evaluate(async()=>{await app.net.open('Hote',true);app.ui.lobbyScreen();return app.net.code;});
 await g.evaluate(async code=>{await app.net.open('Invite',false,code);app.ui.lobbyScreen();},code);
 await h.waitForFunction(()=>app.net.members().length===2);await h.evaluate(()=>app.ui.lobbyScreen());
 await g.evaluate(()=>app.ui.lobbyScreen());
 assert(await g.locator('[data-action="netTrack"]').first().isDisabled(),'only the host chooses the circuit');
 await h.bringToFront();await h.locator('[data-action="netTrack"]:not(.sel)').first().click();
 const tid=await h.evaluate(()=>app.net.settings().trackId);await g.waitForFunction(tid=>app.net.settings().trackId===tid,tid);
 await h.screenshot({scale:'css',path:path.join(out,'pc-salon.png')});
 await g.bringToFront();await g.locator('[data-action="netReady"]').click();await h.bringToFront();await h.locator('[data-action="netReady"]').click();
 await h.waitForFunction(()=>app.net.canStart());await h.evaluate(()=>app.ui.lobbyScreen());
 assert(await h.locator('[data-action="netStart"]').isEnabled(),'ready drivers can start');
 await ctx.close();
 assert.deepEqual(errors,[]);console.log('Menu and connected lobby checks passed; no browser errors.');
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
