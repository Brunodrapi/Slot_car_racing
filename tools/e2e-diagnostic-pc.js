// Run against a local HTTP server: node tools/e2e-diagnostic-pc.js http://127.0.0.1:8765
const {chromium}=require('playwright'),assert=require('assert/strict');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto((process.argv[2]||'http://127.0.0.1:8765')+'/tools/diagnostic-pc.html');
 await p.waitForFunction(()=>!document.querySelector('#start').disabled);
 const track=process.argv[3]||'zandvoort';await p.selectOption('#track',track);await p.click('#start');
 for(const mode of ['normal','tyres','objects','textures','barriers','all','rubber','cache','cacheAll','normal']){
  await p.selectOption('#mode',mode);
  const out=await p.evaluate(()=>{
   const w=document.querySelector('iframe').contentWindow,a=w.app,r=a.renderer,g=r.ctx;
   a.state='paused';const old=g.stroke;let tires=0;
   g.stroke=function(...args){const d=this.getLineDash();if(d.length===2&&d[0]===0&&Math.abs(d[1]-.82)<.001)tires++;return old.apply(this,args);};
   try{r.draw(a.race,a.ui);}finally{g.stroke=old;}
   return {track:a.race.track.def.id,tires,barriers:r.barrierArt.length};
  });
  assert.equal(out.track,track);assert(out.barriers>0);
  if(['tyres','barriers','all','cache','cacheAll'].includes(mode))assert.equal(out.tires,0);
  if(mode==='normal')assert(out.tires>0);
  console.log(mode,JSON.stringify(out));
 }
 // Actual frame samples, followed by a download of valid JSON.
 await p.evaluate(()=>{const a=document.querySelector('iframe').contentWindow.app;a.state='race';a.race.state='racing';});
 await p.click('#reset');await p.waitForTimeout(1200);
 const download=p.waitForEvent('download');await p.click('#export');const d=await download;
 const stream=await d.createReadStream();let raw='';for await(const c of stream)raw+=c;
 const data=JSON.parse(raw);assert(data.results.some(r=>r.frames>0&&r.p95Ms>0&&r.track===track));assert.deepEqual(errors,[]);
 console.log('Rendering variants, tire isolation, physical barrier data, live samples and JSON export: OK');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
