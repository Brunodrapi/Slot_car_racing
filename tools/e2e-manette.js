// Navigation et pilotage via une manette standard injectée ; aucun clic pour les parcours.
'use strict';
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),OUT=process.argv[2]||'/tmp/manette';
(async()=>{
 fs.mkdirSync(OUT,{recursive:true});
 const server=http.createServer((req,res)=>{const p=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(ROOT+path.sep)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){res.writeHead(404);return res.end();}const ext=path.extname(p);res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[ext]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
 await new Promise(r=>server.listen(0,r));const browser=await chromium.launch(),errors=[];
 const url=`http://127.0.0.1:${server.address().port}/index.html`;
 async function create(name) {
  const ctx=await browser.newContext({viewport:{width:1440,height:900}});
  await ctx.addInitScript(name=>{
   if(!localStorage.getItem('slotracer.save.v2'))localStorage.setItem('slotracer.save.v2',JSON.stringify({name,lang:'fr',sound:false,desktopControl:'wheel'}));
   window.pad={index:0,id:'Xbox test',connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
   Object.defineProperty(navigator,'getGamepads',{value:()=>[window.pad],configurable:true});
  },name);
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>window.app?.controls.mode==='gamepad'&&app.controls.status==='ready');
  await page.evaluate(()=>{app.mondial=null;});return{ctx,page};
 }
 async function tick(page){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
 async function button(page,index,hold=0){
  await page.evaluate(i=>{pad.buttons[i].value=1;pad.buttons[i].pressed=true;},index);await tick(page);
  if(hold)await page.waitForTimeout(hold);
  await page.evaluate(i=>{pad.buttons[i].value=0;pad.buttons[i].pressed=false;},index);await tick(page);
 }
 async function repeat(page,index,n){for(let i=0;i<n;i++)await button(page,index);}
 const focus = page=>page.evaluate(()=>({id:document.activeElement.id,action:document.activeElement.dataset.action,car:document.activeElement.dataset.id,tag:document.activeElement.tagName}));
 const shot=(page,name)=>page.screenshot({path:path.join(OUT,name+'.png'),scale:'css'});
 try {
  const {ctx,page}=await create('PilotePad');
  assert.equal(await page.evaluate(()=>app.save.desktopControl),'gamepad','priorité à la manette branchée au démarrage');
  await button(page,0,500);assert(await page.locator('.home-screen [data-action="setup"]').count()>0,'A maintenu ne traverse pas deux écrans');
  await shot(page,'menu-manette');await button(page,0);
  await page.waitForSelector('.setup-screen');assert.equal((await focus(page)).action,'startQuick');
  await repeat(page,4,7);assert.equal((await focus(page)).action,'pickModel','LB saute les rubriques jusqu’aux voitures');
  await button(page,15);const model=(await focus(page)).car;await button(page,0);
  assert.equal(await page.evaluate(()=>app.playerModelFor(app.ui.setup.classId).id),model);
  assert.equal((await focus(page)).car,model,'focus conservé après choix');
  const paint=await page.evaluate(model=>app.playerLivreeFor(model),model);await button(page,0);
  assert.equal(await page.evaluate(model=>app.playerLivreeFor(model),model),(paint+1)%3,'A change la livrée');
  const before=await page.locator('[data-rail="models"]').evaluate(el=>el.scrollLeft);
  await repeat(page,15,12);
  assert(await page.locator('[data-rail="models"]').evaluate(el=>el.scrollLeft)>before,'les voitures cachées défilent avec le focus');
  assert(await page.evaluate(()=>app.ui.gamepad.inRail(document.activeElement)));
  await button(page,5);assert.equal((await focus(page)).action,'pickTrack');
  const oldTrack=(await focus(page)).car;await button(page,14);const track=(await focus(page)).car;await button(page,0);
  assert.notEqual(track,oldTrack);assert.equal(await page.evaluate(()=>app.ui.setup.trackId),track);
  await button(page,5);assert.equal((await focus(page)).id,'sel-desktop-control');
  await button(page,13);assert.equal((await focus(page)).id,'sel-pad-brake');
  await button(page,15);assert.equal(await page.evaluate(()=>app.save.gamepadBrake),'auto');
  assert(await page.locator('#sel-engine-brake').isDisabled());
  await button(page,14);await button(page,13);assert.equal((await focus(page)).id,'sel-engine-brake');
  await button(page,15);assert.equal(await page.evaluate(()=>app.save.engineBrake),.2);
  await button(page,0);await button(page,13);await button(page,0);
  assert.equal(await page.evaluate(()=>app.save.engineBrake),.3,'liste de réglage utilisable sans ouvrir le sélecteur natif');
  await button(page,0);await button(page,13);await button(page,1);
  assert.equal(await page.evaluate(()=>app.save.engineBrake),.3,'B annule le choix dans une liste');
  await shot(page,'preparation-manette');
  await repeat(page,5,3);assert.equal((await focus(page)).action,'pickWear');
  assert(await page.evaluate(()=>document.activeElement.getBoundingClientRect().bottom <= document.querySelector('.row.end').getBoundingClientRect().top),'la barre de départ ne cache pas le choix visé');
  await button(page,5);assert.equal((await focus(page)).id,'sel-reglage');
  await button(page,5);assert.equal((await focus(page)).action,'startQuick');await button(page,0);
  await page.waitForFunction(()=>app.state==='race'&&app.renderer.paths);
  await page.evaluate(()=>{app.race.state='racing';app.race.time=2;pad.buttons[7].value=.525;});
  await page.waitForFunction(()=>Math.abs(app.race.player.throttle-.5)<.001);
  await page.evaluate(()=>{pad.buttons[6].value=.525;});
  await page.waitForFunction(()=>Math.abs(app.race.player.brake-.5)<.001&&app.race.player.throttle===0);
  assert.equal(await page.evaluate(()=>app.race.player.engineStopped),false,'deux gâchettes ne codent pas une coupure moteur');
  await shot(page,'frein-lt');
  await page.evaluate(()=>{pad.buttons[7].value=0;pad.buttons[6].value=0;});await tick(page);
  assert.equal(await page.evaluate(()=>app.race.player.braking),false,'sans LT, frein moteur sans feu de frein');
  await button(page,9);assert.equal(await page.evaluate(()=>app.state),'paused');
  assert.equal((await focus(page)).action,'resume');await button(page,1);assert.equal(await page.evaluate(()=>app.state),'race');
  await button(page,9);await button(page,5);assert.equal((await focus(page)).id,'sel-desktop-control');
  await button(page,14);assert.equal(await page.evaluate(()=>app.controls.mode),'wheel');
  await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>app.controls.mode),'wheel','le choix manuel reste possible');
  await button(page,1);await button(page,9);assert.equal(await page.evaluate(()=>app.state),'paused','Menu reste disponible après un choix manuel');
  await repeat(page,13,2);assert.equal((await focus(page)).action,'quitRace');await button(page,0);
  assert.equal(await page.evaluate(()=>app.race),null);
  await page.evaluate(()=>{pad.connected=false;});await page.waitForFunction(()=>app.controls.padIndex===null);
  await page.evaluate(()=>{pad.connected=true;});await page.waitForFunction(()=>app.controls.mode==='gamepad');
  await page.evaluate(()=>{app.save.desktopControl='keyboard';storeSave(app.save);});
  await page.reload();await page.waitForFunction(()=>window.app?.controls.mode==='gamepad');
  assert.equal(await page.evaluate(()=>app.save.engineBrake),.3,'réglage moteur sauvegardé');
  await ctx.close();console.log('OK : détection/priorité manette, navigation/rails/livrées, listes, réglages, course RT/LT, pause/B, choix manuel et reconnexion.');

  const fresh=await create('');const p=fresh.page;
  await button(p,0);assert.equal((await focus(p)).id,'inp-nom');await button(p,0);
  await button(p,0);await button(p,15);await button(p,0);await button(p,15);await button(p,0);
  await button(p,2);await button(p,0);await shot(p,'clavier-manette');
  await repeat(p,5,2);await button(p,0);
  assert.equal(await p.locator('#inp-nom').inputValue(),'ABC');
  await button(p,13);assert.equal((await focus(p)).action,'nomOk');await button(p,0);
  assert.equal(await p.evaluate(()=>app.save.name),'ABC','premier lancement entièrement à la manette');
  await repeat(p,13,3);assert.equal((await focus(p)).action,'settings');await button(p,0);
  await button(p,5);assert.equal((await focus(p)).id,'inp-name');await button(p,0);await button(p,2);await button(p,1);
  assert.equal(await p.evaluate(()=>app.save.name),'ABC','annuler la saisie conserve le pseudo');
  await repeat(p,5,2);assert.equal((await focus(p)).id,'sel-lang');
  await button(p,0);await button(p,13);await button(p,0);assert.equal(await p.evaluate(()=>app.save.lang),'en');
  assert.equal((await focus(p)).id,'sel-lang','focus conservé après changement de langue');
  for(let i=0;i<25&&(await focus(p)).action!=='resetAll';i++)await button(p,5);
  assert.equal((await focus(p)).action,'resetAll');await button(p,0);await button(p,1);
  assert.equal(await p.evaluate(()=>app.save.name),'ABC','B annule aussi la confirmation');
  await button(p,1);assert(await p.locator('.home-screen').count()>0);
  await fresh.ctx.close();assert.deepEqual(errors,[]);
  console.log('OK : clavier virtuel, pseudo initial sans souris, annulation, réglages bilingues et retour B. Aucune erreur JS.');
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
