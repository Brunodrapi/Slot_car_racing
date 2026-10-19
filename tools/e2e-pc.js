// Parcours PC et rotation mobile/tablette ; la manette est injectée dans la vraie Gamepad API.
// node tools/e2e-pc.js [dossier-captures]
'use strict';
const {chromium,devices}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),OUT=process.argv[2]||'/tmp';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.json':'application/json'};
(async()=>{
 fs.mkdirSync(OUT,{recursive:true});
 const server=http.createServer((req,res)=>{const p=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(ROOT+path.sep)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',types[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
 await new Promise(r=>server.listen(0,r));const browser=await chromium.launch();
 const url=`http://127.0.0.1:${server.address().port}/index.html`,errors=[];
 async function create(options={}) {
  const ctx=await browser.newContext(options);
  await ctx.addInitScript(()=>{
   if(!localStorage.getItem('slotracer.save.v2'))localStorage.setItem('slotracer.save.v2',JSON.stringify({name:'PilotePC',lang:'fr',sound:false}));
   window.mockPads=[];Object.defineProperty(navigator,'getGamepads',{value:()=>window.mockPads,configurable:true});
  });
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>window.app?.controls);
  await page.evaluate(()=>{app.mondial=null;});return {ctx,page};
 }
 async function start(page) {
  await page.click('[data-action="startQuick"]');
  await page.waitForFunction(()=>app.state==='race'&&app.renderer.paths);
  await page.evaluate(()=>{app.race.state='racing';app.race.time=2;});
 }
 async function shot(page,name){await page.screenshot({path:path.join(OUT,name+'.png'),scale:'css'});}
 try {
  const {ctx,page}=await create({viewport:{width:1440,height:900}});
  assert.equal(await page.evaluate(()=>app.desktop),true);
  await page.keyboard.press('Enter');await shot(page,'pc-menu');
  await page.click('[data-action="setup"][data-mode="race"]');
  await page.selectOption('#sel-desktop-control','wheel');
  const cols=await page.locator('.setup-block').evaluateAll(a=>a.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width};}));
  assert(cols[1].x>cols[0].x+cols[0].w,'préparation sur deux colonnes');
  await shot(page,'pc-depart');await start(page);
  await page.mouse.move(720,450);await page.mouse.wheel(0,-100);
  await page.waitForFunction(()=>Math.abs(app.race.player.throttle-.1)<.001);
  await page.mouse.wheel(0,-200);await page.waitForFunction(()=>Math.abs(app.input.throttle-.3)<.001);
  await page.keyboard.press('ArrowUp');assert.equal(await page.evaluate(()=>app.input.sel),1);
  assert(Math.abs(await page.evaluate(()=>app.input.throttle)-.3)<.001,'les flèches ne modifient pas les gaz');
  await page.mouse.click(720,450);assert(Math.abs(await page.evaluate(()=>app.input.throttle)-.3)<.001,'le clic ne force pas les gaz en mode molette');
  await shot(page,'pc-course-molette');
  await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>app.input.throttle),0);
  await page.mouse.wheel(0,-100);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  assert.equal(await page.evaluate(()=>app.state),'paused');assert.equal(await page.evaluate(()=>app.input.throttle),0,'perte de focus : gaz coupés');
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.click('[data-action="resume"]');assert.equal(await page.evaluate(()=>app.input.throttle),0);
  await page.keyboard.press('Escape');await page.selectOption('#sel-desktop-control','keyboard');await page.click('[data-action="resume"]');
  await page.keyboard.down('Space');await page.keyboard.down('w');await page.keyboard.up('Space');
  assert.equal(await page.evaluate(()=>!!app.input.throttle),true,'une seconde touche maintient les gaz');
  await page.keyboard.up('w');assert.equal(await page.evaluate(()=>!!app.input.throttle),false);
  await page.mouse.down();assert.equal(await page.evaluate(()=>!!app.input.throttle),true);await page.mouse.up();
  assert.equal(await page.evaluate(()=>!!app.input.throttle),false);
  await page.keyboard.press('Escape');await page.selectOption('#sel-desktop-control','gamepad');await page.click('[data-action="resume"]');
  assert.equal(await page.evaluate(()=>app.controls.status),'disconnected');
  await page.evaluate(()=>{window.mockPads=[{index:0,connected:true,mapping:'standard',axes:[0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}];mockPads[0].buttons[7].value=1;});
  await page.waitForFunction(()=>app.controls.status==='release');assert.equal(await page.evaluate(()=>app.input.throttle),0);
  await page.evaluate(()=>{mockPads[0].buttons[7].value=0;});await page.waitForFunction(()=>app.controls.status==='ready');
  await page.evaluate(()=>{mockPads[0].buttons[7].value=.525;});await page.waitForFunction(()=>Math.abs(app.race.player.throttle-.5)<.001);
  await shot(page,'pc-course-manette');
  await page.evaluate(()=>{mockPads[0].axes[0]=-1;});await page.waitForFunction(()=>app.input.sel===0);
  await page.evaluate(()=>{mockPads[0].buttons[9].pressed=true;});await page.waitForFunction(()=>app.state==='paused');
  await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>app.state),'paused','Menu tenu ne reprend pas tout seul');
  await page.evaluate(()=>{mockPads[0].buttons[9].pressed=false;});await page.waitForTimeout(70);
  await page.evaluate(()=>{mockPads[0].buttons[9].pressed=true;});await page.waitForFunction(()=>app.state==='race');
  await page.evaluate(()=>{mockPads[0].buttons[9].pressed=false;});
  assert.equal(await page.evaluate(()=>app.input.throttle),0,'pas de départ gâchette enfoncée après pause');
  await page.evaluate(()=>{mockPads[0].buttons[7].value=0;});await page.waitForFunction(()=>app.controls.armed);
  await page.evaluate(()=>{mockPads[0].buttons[7].value=1;});await page.waitForFunction(()=>app.input.throttle===1);
  await page.evaluate(()=>{mockPads[0].connected=false;});await page.waitForFunction(()=>app.state==='paused');
  assert.equal(await page.evaluate(()=>app.input.throttle),0);
  await page.reload();await page.waitForFunction(()=>window.app?.controls);
  assert.equal(await page.evaluate(()=>app.controls.mode),'gamepad','mode sauvegardé');
  await page.keyboard.press('Enter');await page.click('[data-action="settings"]');await shot(page,'pc-reglages');
  await ctx.close();console.log('PC : paysage, clavier/clic, molette, dosage RT, trajectoire, pause/reprise/déconnexion et sauvegarde OK.');

  for(const [name,device] of [['mobile',devices['iPhone 13']],['tablette',devices['iPad (gen 7)']]]) {
   const {ctx,page}=await create(device);assert.equal(await page.evaluate(()=>app.desktop),false,name+' reste tactile');
   await page.evaluate(()=>{app.leaveSplash();});assert.equal(await page.locator('#sel-desktop-control').count(),0);
   await page.click('[data-action="setup"][data-mode="race"]');
   assert(await page.locator('.setup-columns').evaluate(e=>{const [a,b]=[...e.children].map(c=>c.getBoundingClientRect());return a.height>50&&b.height>50&&b.top>=a.bottom&&Math.abs(a.left-b.left)<1;}),'préparation tactile en colonne');
   await shot(page,name+'-depart-portrait');
   await page.click('[data-action="pickWear"][data-id="1"]');await start(page);
   const portrait=device.viewport,landscape={width:portrait.height,height:portrait.width};
   await page.setViewportSize(landscape);await page.waitForFunction(()=>app.renderer.w>app.renderer.h);
   await page.evaluate(()=>{
    app.canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',pointerId:77,clientX:innerWidth*.74,clientY:innerHeight*.72,bubbles:true}));
   });
   assert.equal(await page.evaluate(()=>!!app.input.throttle),true,'accélérateur tactile en paysage');
   await shot(page,name+'-course-paysage');
   await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{pointerType:'touch',pointerId:77,bubbles:true})));
   assert.equal(await page.evaluate(()=>!!app.input.throttle),false);
   await page.evaluate(()=>{app.save.ctrlSide='right';app.renderer.draw(app.race,app.ui);});
   assert(await page.evaluate(()=>Math.abs(app.renderer.pouce.cx-app.renderer.slider.x)>app.renderer.pouce.r+30),'pastille opposée au levier droit');
   await page.evaluate(()=>app.togglePause());await shot(page,name+'-pause-paysage');
   assert.equal(await page.locator('#sel-desktop-control').count(),0);
   assert(await page.locator('.screen').evaluate(e=>e.clientWidth<=Math.min(innerWidth,innerHeight)+1&&e.scrollWidth<=e.clientWidth),'menu mobile en colonne sans débordement');
   await page.evaluate(()=>{app.toMenu();app.ui.setupScreen('race');});
   assert(await page.locator('.setup-columns').evaluate(e=>{const [a,b]=[...e.children].map(c=>c.getBoundingClientRect());return a.height>50&&b.height>50&&b.top>=a.bottom&&Math.abs(a.left-b.left)<1;}),'menus restent en colonne en paysage');
   await page.setViewportSize(portrait);await shot(page,name+'-retour-portrait');
   await ctx.close();console.log(name+' : portrait conservé dans les menus, course paysage tactile et retour portrait OK.');
  }
  assert.deepEqual(errors,[]);console.log('Aucune erreur JavaScript. Captures : '+OUT);
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
