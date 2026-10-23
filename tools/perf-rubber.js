// Diagnostic only: real physics / tyre deposition, paired rendering with and without rubber.
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
 for(const profile of [{name:'PC 1280x720 DPR1',width:1280,height:720,dpr:1,rate:1},{name:'Mobile emulated 390x844 DPR2 CPUx4 (not iPhone hardware)',width:390,height:844,dpr:2,rate:4,mobile:true}]){
 const ctx=await browser.newContext({...profile.mobile?devices['iPhone 13']:{},viewport:{width:profile.width,height:profile.height},deviceScaleFactor:profile.dpr});
 const p=await ctx.newPage();
 await p.addInitScript(()=>{window.requestAnimationFrame=()=>0;localStorage.setItem('slotracer.save.v2',JSON.stringify({name:'TEST',sound:false}));});
 await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:'+server.address().port+'/index.html');
 await p.waitForFunction(()=>window.app?.ui);
 await p.addScriptTag({path:path.join(ROOT,'tools/trailer/capture.js')});
 await p.evaluate(async()=>{
  await trailerSetup({track:'monza',model:'f40',action:'pack'},42);
  app.race.laps=999;
  const r=app.renderer;r.autoRes=false;r.particles=[];r.rubber.clear();
  window.markCount=0;window.cellCounts=new Map();
  const lay=r._layRubber;
  r._layRubber=function(x,y,a,l,s){markCount++;const key=Math.floor(x/40)+','+Math.floor(y/40)+','+(s>.62?2:s>.34?1:0);cellCounts.set(key,(cellCounts.get(key)||0)+1);return lay.call(this,x,y,a,l,s);};
  window.simSeconds=0;
 });
 const cdp=await ctx.newCDPSession(p);
 for(const seconds of [0,60,180,600]){
 await p.evaluate(target=>{
  const r=app.renderer,race=app.race;
  for(;simSeconds<target;simSeconds+=1/60){
   race.state='racing';
   race.update(1/60,aiThrottle(race.player,race.cars,1/60,DIFFICULTY.medium));
   r.addEffects(race,1/60);race.events.length=0;
  }
  // Densest deposited cell, fixed framing: exposes the cost where repeated cornering occurs.
  const sorted=[...cellCounts].sort((a,b)=>b[1]-a[1]);
  const key=sorted[0]?.[0],patch=key?r.rubber.get(key):null;
  if(patch){r.cam.x=(patch.minX+patch.maxX)/2;r.cam.y=(patch.minY+patch.maxY)/2;}
  r.cam.zoom=Math.min(innerWidth,innerHeight)/65;r.camAngle=0;r.cam.init=true;
  r.particles=[];r.wets=[];r.shake=0;
 },seconds);
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile.rate});
 const row=await p.evaluate(()=>{
  const r=app.renderer,race=app.race,original=r._drawRubber;
  let visible=0,visibleCells=0,vis;
  r._drawRubber=function(g,v){vis=v;original.call(this,g,v);};
  r.draw(race,app.ui);r._drawRubber=original;
  for(const [key,patch] of r.rubber)if(!(patch.maxX<vis.minX||patch.minX>vis.maxX||patch.maxY<vis.minY||patch.minY>vis.maxY)){visible+=cellCounts.get(key)||0;visibleCells++;}
  const vals={on:[],off:[]};
  // Alternate ordering, warm up both modes, read back one pixel to flush deferred Canvas work.
  for(let i=0;i<24;i++)for(const enabled of (i%2?[true,false]:[false,true])){
   r._drawRubber=enabled?original:()=>{};
   const t=performance.now();r.draw(race,app.ui);
   r.ctx.getImageData(0,0,1,1);
   const elapsed=performance.now()-t;
   if(i>=4)vals[enabled?'on':'off'].push(elapsed);
  }
  r._drawRubber=original;
  const stat=a=>{a.sort((a,b)=>a-b);return {medianMs:+a[Math.floor(a.length*.5)].toFixed(2),p95Ms:+a[Math.floor(a.length*.95)].toFixed(2)};};
  return {seconds:Math.round(simSeconds),totalSegments:markCount,cells:r.rubber.size,visibleSegments:visible,visibleCells,on:stat(vals.on),off:stat(vals.off)};
 });
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
 results.push({profile:profile.name,...row});console.log(JSON.stringify(results.at(-1)));
 }
 if(errors.length)throw Error(errors.join('\n'));
 await ctx.close();
 }
 fs.writeFileSync(path.join(ROOT,'docs/analyse-traces/mesures.json'),JSON.stringify({date:new Date().toISOString(),browser:browser.version(),method:'Real Monza physics, 8 cars, extreme opponents; densest cell; 20 alternating paired complete renders, fixed DPR, no smoke, synchronous 1px readback. CPU throttling affects JS, not equivalent to iPhone GPU/Safari. Not FPS.',results},null,2));
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
