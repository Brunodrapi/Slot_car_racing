// The nine F1 models: menu selection, persistence (under the f1 class), race sprite and finite physics.
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
(async()=>{
 const server=http.createServer((req,res)=>{const p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(root+path.sep)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',types[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
 await new Promise(r=>server.listen(0,r));const browser=await chromium.launch();
 try {
  for(const id of ['tyrrellp34','ferrari312t','mclarenm23','lotus79','lotus72','brabhambt46b','williamsfw07','ligierjs11','renaultrs10']) {
   const context=await browser.newContext({viewport:{width:1100,height:820}}),page=await context.newPage(),errors=[],served=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.ok())served.push(new URL(r.url()).pathname);});
   await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
   await page.waitForFunction(()=>typeof app!=='undefined'&&app.save);
   await page.evaluate(()=>{app.save.name='F1';app.save.sound=false;app.mondial=null;storeSave(app.save);});
   await page.keyboard.press('Enter');await page.click('[data-action="setup"][data-mode="race"]');
   await page.click(`.card[data-action="pickModel"][data-id="${id}"]`);
   await page.waitForTimeout(200);
   assert.equal(await page.evaluate(()=>app.save.models.f1),id);
   await page.reload();await page.waitForFunction(()=>typeof app!=='undefined'&&app.save);
   assert.equal(await page.evaluate(()=>app.save.models.f1),id);
   await page.evaluate(()=>{app.mondial=null;});await page.keyboard.press('Enter');
   await page.click('[data-action="setup"][data-mode="race"]');await page.click('[data-action="startQuick"]');
   await page.waitForFunction(()=>app.race&&app.race.player);
   await page.waitForFunction(id=>{const im=new Image();im.src=`sprites/top/${id}.png`;return im.complete&&im.naturalWidth>0;},id);
   const result=await page.evaluate(()=>{const c=app.race.player;return {id:c.cls.id,top:livreeDe(c.cls,c.livree).top,rivaux:app.race.cars.filter(x=>x!==c).map(x=>x.cls.catId)};});
   assert.equal(result.id,id);
   assert(result.rivaux.length>0&&result.rivaux.every(k=>k==='f1'),'an F1 races against F1 only: '+result.rivaux.join(','));assert.equal(result.top,`sprites/top/${id}.png`);
   assert(served.includes(`/sprites/top/${id}.png`),'race sprite served');
   // The same production Race/Car code, exercised headlessly at fixed timestep on four circuits.
   const runs=await page.evaluate(id=>['monaco','spa','monza','zandvoort'].map(track=>{
    const r=new Race({trackDef:TRACKS.find(t=>t.id===track),classId:'gt',modelId:id,nCars:1,mode:'timetrial',playerAI:true});
    let maxV=0, finite=true;
    for(let t=0;t<1200;t++){r.update(1/120,aiThrottle(r.player,r.cars,1/120,{marginBase:0.7,marginSpread:0}));maxV=Math.max(maxV,r.player.v);finite=finite&&[r.player.s,r.player.v,r.player.lat,r.player.x,r.player.y].every(Number.isFinite);}
    const c=r.player;return {track,ok:finite && maxV > 5,maxV};
   }),id);
   assert(runs.every(r=>r.ok),JSON.stringify(runs));
   await page.screenshot({path:path.join(process.argv[2]||'/tmp',`${id}-course.png`)});
   assert.deepEqual(errors,[]);console.log(id,'selection/save/race/sprite + 4 circuit simulations OK');await context.close();
  }
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
