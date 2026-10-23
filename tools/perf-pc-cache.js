// PC 2540x1440 experiment. --light tests existing reduced barrier detail.
// CHROMIUM_PATH may point to a local Edge executable; this is not a monitor refresh-rate test.
// Chromium headless timings are comparative, not hardware FPS or Safari measurements.
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{
  const f=path.resolve(ROOT,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!f.startsWith(ROOT+path.sep)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css'})[path.extname(f)]||'application/octet-stream');
  fs.createReadStream(f).pipe(res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});

 const system=await (await browser.newBrowserCDPSession()).send('SystemInfo.getInfo');
 const graphics={devices:system.gpu.devices,features:system.gpu.featureStatus};
 const ctx=await browser.newContext({viewport:{width:2540,height:1440},deviceScaleFactor:1});
 const p=await ctx.newPage();
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
 await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
 await p.goto('http://127.0.0.1:'+server.address().port+'/index.html');
 await p.waitForFunction(()=>window.app?.ui);
 await p.addScriptTag({path:path.join(ROOT,'tools/trailer/capture.js')});
 await p.evaluate(async()=>{await trailerSetup({track:'zandvoort',model:'f40',action:'pack'},42);app.renderer.autoRes=false;});

 await p.addScriptTag({path:path.join(ROOT,'tools/barrier-cache-prototype.js')});
 await p.evaluate(()=>installBarrierCachePrototype(app.renderer));
 const light=process.argv.includes('--light');
 const moving=[];
 for(const hz of [60,144])for(const cache of (light?[false]:[false,true]))for(const pass of ['cold','warm']){
 const row=await p.evaluate(({hz,cache,pass,light})=>{
  const r=app.renderer,race=app.race,T=race.track;r.testBarrierCache=cache;r.detail=light?0:1;
  if(pass==='cold')r.resetBarrierCache();
  r.setView('avanceFixe');r.rubber.clear();r.particles=[];
  const times=[],build=[];const frames=hz*3;
  for(let frame=0;frame<frames;frame++){
   race.cars.forEach((c,i)=>c.place(T.wrap(.40*T.length+frame*30/hz-i*7),0,30));
   r.updateCamera(race,1/hz);
   const t=performance.now(),old=r.barrierCacheStats.created;
   r.draw(race,app.ui);
   r.ctx.getImageData(0,0,1,1);r.hudCtx.getImageData(0,0,1,1);r.carCtx.getImageData(0,0,1,1);
   times.push(performance.now()-t);if(r.barrierCacheStats.created>old)build.push(times.at(-1));
  }
  times.sort((a,b)=>a-b);const q=p=>+times[Math.min(times.length-1,Math.floor(times.length*p))].toFixed(2);
  return {hz,cache,pass,medianMs:q(.5),p95Ms:q(.95),maxMs:q(1),overBudget:times.filter(t=>t>1000/hz).length,frames,buildFrames:build.length,cacheStats:{...r.barrierCacheStats}};
 },{hz,cache,pass,light});moving.push(row);console.log(JSON.stringify(row));
 }
 // Identical static scene for side-by-side visual inspection.
 for(const cache of (light?[]:[false,true])){
  await p.evaluate(cache=>{app.renderer.testBarrierCache=cache;app.renderer.draw(app.race,app.ui);},cache);
  await p.screenshot({path:path.join(ROOT,'docs/analyse-traces/pc-'+(cache?'cache':'vector')+'.jpg')});
 }
 fs.writeFileSync(path.join(ROOT,'docs/analyse-traces/'+(light?'pc-light':'pc-cache')+'.json'),JSON.stringify({browser:browser.version(),graphics,light,viewport:{width:2540,height:1440,dpr:1},method:'Chromium headless, 3 seconds of fixed-camera motion at 30m/s. Simulation sampling at 60/144Hz is not a physical display refresh measurement. Synchronous readback all canvases. Cold and warm raster prototype; no tyre marks.',moving},null,2));
 if(errors.length)throw Error(errors.join('\n'));
 await ctx.close();
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
