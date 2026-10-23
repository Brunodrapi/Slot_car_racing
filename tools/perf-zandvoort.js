// Diagnostic: isolate static Zandvoort renderer components, without tyre marks.
// Chromium headless timings are comparative, not hardware FPS or Safari measurements.
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium,devices}=require('playwright');
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

 const results=[];
 const ctx=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 const p=await ctx.newPage();
 await p.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
 await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
 await p.goto('http://127.0.0.1:'+server.address().port+'/index.html');
 await p.waitForFunction(()=>window.app?.ui);
 await p.addScriptTag({path:path.join(ROOT,'tools/trailer/capture.js')});
 await p.evaluate(async()=>{await trailerSetup({track:'zandvoort',model:'f40',action:'pack'},42);app.renderer.autoRes=false;});
 for(let i=0;i<16;i++){
  const row=await p.evaluate(fraction=>{
   const r=app.renderer,race=app.race,T=race.track;
   race.cars.forEach((c,i)=>c.place(T.wrap(fraction*T.length-i*7),0,30));
   r.rubber.clear();r.particles=[];r.wets=[];r.shake=0;
   r.setView('avanceFixe');r.updateCamera(race,1/60);
   const names=['_drawBarriers','_drawTopProps','_drawImplantation','_drawImplantationSol','_drawTas','_drawHUD'];
   const original=Object.fromEntries(names.map(n=>[n,r[n]]));
   const cg=r.circuitGraphics, cgNames=['drawRoad','drawGravel','drawRunoff','drawTerrain'];
   const cgOriginal=Object.fromEntries(cgNames.map(n=>[n,cg[n]]));
   const kinds=['full','noBarriers','lowDetail','noDecor','noTextures','noHud'];
   const vals=Object.fromEntries(kinds.map(n=>[n,[]]));
   for(let rep=0;rep<12;rep++)for(let j=0;j<kinds.length;j++){
    const kind=kinds[(j+rep)%kinds.length];
    for(const n of names)r[n]=original[n];
    for(const n of cgNames)cg[n]=cgOriginal[n];
    r.detail=kind==='lowDetail'?0:1;
    if(kind==='noBarriers')r._drawBarriers=()=>{};
    if(kind==='noDecor')for(const n of ['_drawTopProps','_drawImplantation','_drawImplantationSol','_drawTas'])r[n]=()=>{};
    if(kind==='noTextures')for(const n of cgNames)cg[n]=()=>{};
    if(kind==='noHud')r._drawHUD=()=>{};
    const t=performance.now();r.draw(race,app.ui);
    r.ctx.getImageData(0,0,1,1);r.hudCtx.getImageData(0,0,1,1);r.carCtx.getImageData(0,0,1,1);
    if(rep>=2)vals[kind].push(performance.now()-t);
   }
   for(const n of names)r[n]=original[n];for(const n of cgNames)cg[n]=cgOriginal[n];r.detail=1;
   const stats=Object.fromEntries(kinds.map(n=>{const v=vals[n].sort((a,b)=>a-b);return [n,{medianMs:+v[5].toFixed(2),p90Ms:+v[9].toFixed(2)}];}));
   return {fraction,zoom:r.cam.zoom,stats};
  },i/16);
  results.push(row);console.log(JSON.stringify(row));
 }

 const moving=[];
 for(const view of ['avanceFixe','avance'])for(const barriers of [true,false]){
  const row=await p.evaluate(({view,barriers})=>{
   const r=app.renderer,race=app.race,T=race.track,draw=r._drawBarriers;
   r.setView(view);r.rubber.clear();
   if(!barriers)r._drawBarriers=()=>{};
   const times=[];let rebuilds=0;
   for(let frame=0;frame<240;frame++){
    race.cars.forEach((c,i)=>c.place(T.wrap(.40*T.length+frame*.5-i*7),0,30));
    r.updateCamera(race,1/60);
    const old=r._barrFusionCle,t=performance.now();
    r.draw(race,app.ui);
    r.ctx.getImageData(0,0,1,1);r.hudCtx.getImageData(0,0,1,1);r.carCtx.getImageData(0,0,1,1);
    const elapsed=performance.now()-t;
    if(old!==r._barrFusionCle)rebuilds++;
    if(frame>=20)times.push(elapsed);
   }
   r._drawBarriers=draw;
   times.sort((a,b)=>a-b);
   return {view,barriers,medianMs:+times[110].toFixed(2),p95Ms:+times[209].toFixed(2),maxMs:+times.at(-1).toFixed(2),barrierCacheRebuilds:rebuilds};
  },{view,barriers});moving.push(row);console.log(JSON.stringify(row));
 }
 fs.writeFileSync(path.join(ROOT,'docs/analyse-traces/zandvoort.json'),JSON.stringify({browser:browser.version(),method:'16 stationary positions, default fixed forward camera, 1280x720 DPR1, no tyre marks or smoke. 10 measured renders per variant in rotating order after warmup, synchronous canvas readback on all 3 layers. Component removal diagnostic, not real-device FPS. Moving sweeps: 240 frames at 30m/s, first20 excluded, fixed and rotating forward cameras.',results,moving},null,2));
 await ctx.close();
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
