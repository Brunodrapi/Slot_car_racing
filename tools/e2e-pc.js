// Parcours PC et rotation mobile/tablette ; une manette est injectée dans la vraie Gamepad API (mise de côté, elle ne doit rien faire).
// node tools/e2e-pc.js [dossier-captures]
'use strict';
const {chromium,devices}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),OUT=process.argv[2]||'/tmp';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'};
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
  /* Le jeu à un bouton sur ordinateur (0.49) : Espace pour les gaz, ↑ / ↓ pour la ligne. La manette et la
  molette sont mises de côté (MANETTE, js/controls.js) : une manette branchée ne fait rien, la molette ne
  change plus la ligne, et une ancienne sauvegarde réglée sur la manette repart au clavier. */
  const {ctx,page}=await create({viewport:{width:1440,height:900}});
  assert.equal(await page.evaluate(()=>app.desktop),true);
  await page.evaluate(()=>{app.save.desktopControl='gamepad';storeSave(app.save);});
  await page.reload();await page.waitForFunction(()=>window.app?.controls);await page.evaluate(()=>{app.mondial=null;});
  assert.equal(await page.evaluate(()=>app.controls.mode),'keyboard','une sauvegarde « manette » repart au clavier');
  await page.keyboard.press('Enter');await shot(page,'pc-menu');
  await page.click('[data-action="setup"][data-mode="race"]');
  assert.equal(await page.locator('#sel-desktop-control').count(),0,'plus de choix de commande au paddock');
  const cols=await page.locator('.setup-block').evaluateAll(a=>a.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width};}));
  assert(cols[1].x>cols[0].x+cols[0].w,'préparation sur deux colonnes');
  await shot(page,'pc-depart');await start(page);
  // Espace, et rien d'autre
  await page.keyboard.down('Space');assert.equal(await page.evaluate(()=>!!app.input.throttle),true,'Espace accélère');
  await page.keyboard.up('Space');assert.equal(await page.evaluate(()=>!!app.input.throttle),false,'Espace relâché : frein');
  await page.keyboard.down('w');assert.equal(await page.evaluate(()=>!!app.input.throttle),false,'une autre touche n’accélère pas');await page.keyboard.up('w');
  await page.mouse.move(720,450);await page.mouse.down();assert.equal(await page.evaluate(()=>!!app.input.throttle),false,'le clic n’accélère pas');await page.mouse.up();
  // ↑ / ↓, et rien d'autre
  await page.keyboard.press('ArrowUp');assert.equal(await page.evaluate(()=>app.input.sel),1,'↑ : un cran vers le jaune');
  await page.keyboard.press('ArrowLeft');await page.keyboard.press('KeyA');assert.equal(await page.evaluate(()=>app.input.sel),1,'← et A ne changent plus la ligne');
  await page.mouse.wheel(0,200);await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>app.input.sel),1,'la molette ne change plus la ligne');
  await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>app.input.sel),-1,'↓ ↓ : jusqu’au bleu');
  await shot(page,'pc-course-espace');
  // une manette branchée, gâchette enfoncée : rien ne bouge
  await page.evaluate(()=>{window.mockPads=[{index:0,connected:true,mapping:'standard',axes:[1],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}];mockPads[0].buttons[7].value=1;mockPads[0].buttons[9].pressed=true;});
  await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>({m:app.controls.mode,g:!!app.input.throttle,s:app.input.sel,e:app.state})),{m:'keyboard',g:false,s:-1,e:'race'},'la manette mise de côté ne fait rien');
  await page.evaluate(()=>{window.mockPads=[];});
  // perte de focus, pause, reprise
  await page.keyboard.down('Space');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  assert.equal(await page.evaluate(()=>app.state),'paused');assert.equal(await page.evaluate(()=>app.input.throttle),0,'perte de focus : gaz coupés');
  await page.keyboard.up('Space');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  assert.match(await page.locator('.pc-controls').innerText(),/Espace/,'la pause rappelle les touches');
  await page.click('[data-action="resume"]');assert.equal(await page.evaluate(()=>app.input.throttle),0);
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>app.state),'paused','Échap : pause');
  await page.click('[data-action="resume"]');
  await page.evaluate(()=>app.toMenu());await page.click('[data-action="settings"]');
  assert.equal(await page.locator('#sel-desktop-control').count(),0,'plus de choix de commande dans les réglages');
  assert.match(await page.locator('.pc-controls').innerText(),/Maintiens Espace/);
  await shot(page,'pc-reglages');
  await ctx.close();console.log('PC : un bouton (Espace), ↑ / ↓ seules, souris/molette/manette sans effet, pause et ancienne sauvegarde OK.');

  for(const [name,device] of [['mobile',devices['iPhone 13']],['tablette',devices['iPad (gen 7)']]]) {
   const {ctx,page}=await create(device);assert.equal(await page.evaluate(()=>app.desktop),false,name+' reste tactile');
   await page.evaluate(()=>{app.leaveSplash();});assert.equal(await page.locator('#sel-desktop-control').count(),0);
   await page.click('[data-action="setup"][data-mode="race"]');
   assert(await page.locator('.setup-columns').evaluate(e=>{const [a,b]=[...e.children].map(c=>c.getBoundingClientRect());return a.height>50&&b.height>50&&b.top>=a.bottom&&Math.abs(a.left-b.left)<1;}),'préparation tactile en colonne');
   await shot(page,name+'-depart-portrait');
   assert.equal(await page.locator('[data-action="pickWear"]').count(),0,'l’usure, mise de côté, n’est plus proposée');await start(page);
   await page.evaluate(()=>app.renderer.draw(app.race,app.ui));
   const hud=await page.evaluate(()=>{const r=app.renderer,z=r.hudZones,b=r.pauseBtn;return {clear:z.pos.x+z.pos.w<z.temps.x&&z.temps.x+z.temps.w<b.x,pauseRight:b.x>r.w*.75,hit:r.pauseHitAt(b.x+b.s/2,b.y+b.s/2)};});
   assert(hud.clear&&hud.pauseRight&&hud.hit,'HUD labels separated and pause touch target at right');
   await shot(page,name+'-course-portrait');
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
