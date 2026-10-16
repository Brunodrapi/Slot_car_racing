// Sons réellement rendus par Web Audio et traces dessinées par le navigateur.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{
  const file=path.resolve(ROOT,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
  if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css'})[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>window.app&&app.renderer);
  const audio=await page.evaluate(async()=>{
   app.state='inspection';app.audio.idle();
   const out=[];
   for(const [spin,state,pit,racing] of [[0,'ok',false,true],[.25,'ok',false,true],[.6,'ok',false,true],[1,'ok',false,true],[1,'ok',true,true],[1,'ok',false,false]]){
    const ctx=new OfflineAudioContext(1,22050,44100),a=new GameAudio();
    a._catalogue=()=>{};a.start(ctx);
    if(!a.started)throw Error('Audio hors ligne indisponible');
    a.update({cls:modelById('f40'),v:0,throttle:true,state,inPit:pit,slide:0,patineFx:spin},racing);
    const data=(await ctx.startRendering()).getChannelData(0);
    let sum=0,max=0;for(let i=4410;i<data.length;i++){sum+=data[i]*data[i];max=Math.max(max,Math.abs(data[i]));}
    out.push({spin,pit,racing,rms:Math.sqrt(sum/(data.length-4410)),max});
   }
   return out;
  });
  assert.equal(audio[0].rms,0);
  for(let i=1;i<4;i++){assert.ok(audio[i].rms>audio[i-1].rms*1.3,'son non progressif');assert.ok(audio[i].max<1);}
  assert.equal(audio[4].rms,0);assert.equal(audio[5].rms,0);
  console.log('Pneus, RMS rendu : '+audio.slice(0,4).map(x=>x.rms.toFixed(5)).join(' → '));
  const traces=await page.evaluate(()=>{
   const r=new Renderer(document.createElement('canvas'));
   const canvas=document.createElement('canvas');canvas.width=400;canvas.height=200;const g=canvas.getContext('2d');
   const out=[];
   for(const [spin,state,pit,phase,v] of [[0,'ok',false,'racing',20],[.25,'ok',false,'racing',20],[.6,'ok',false,'racing',20],[1,'ok',false,'racing',20],[1,'grass',false,'racing',20],[1,'ok',true,'racing',20],[1,'ok',false,'countdown',20],[1,'ok',false,'racing',0]]){
    r.rubber.clear();r.particles=[];
    const car={cls:modelById('f40'),pos:{x:20,y:10},heading:0,beta:0,slide:0,patineFx:spin,v,state,inPit:pit,throttle:true};
    for(let i=0;i<30;i++){car.pos.x+=v/60;r.addEffects({state:phase,cars:[car]},1/60);}
    g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,400,200);g.scale(10,10);
    r._drawRubber(g,{minX:0,maxX:40,minY:0,maxY:20});
    const pixels=g.getImageData(0,0,400,200).data;let ink=0;for(let i=3;i<pixels.length;i+=4)ink+=pixels[i];
    out.push({spin,state,pit,phase,v,ink,bands:[...new Set([...r.rubber.values()].map(p=>p.band))]});
   }
   return out;
  });
  assert.equal(traces[0].ink,0);
  for(let i=1;i<4;i++)assert.ok(traces[i].ink>traces[i-1].ink,'traces non progressives');
  for(const row of traces.slice(4))assert.equal(row.ink,0,'traces hors condition '+JSON.stringify(row));
  console.log('Traces : intensités croissantes ; aucune sur herbe, aux stands, avant le départ ou à l’arrêt');
  await page.evaluate(()=>{app.mondial=null;app.startQuick('race','gt','monza');});
  await page.waitForFunction(()=>app.race.state==='racing');
  // Une image de 70 ms contenant un appui entier : les événements passent par
  // les vrais gestionnaires DOM et App._frame, puis les sous-pas de Race.
  const pulses=await page.evaluate(()=>{
   const results=[];
   for(const kind of ['keyboard','touch']){
    const clock=performance.now.bind(performance),raf=window.requestAnimationFrame;
    const step=app.race._step,base=clock();let now=base,gas=0;
    try{
     performance.now=()=>now;window.requestAnimationFrame=()=>0;
     app.last=base;app.race.acc=0;app.input.throttle=false;app.throttlePulses.reset();
     app.race._step=function(dt,on){if(on)gas+=dt;return step.call(this,dt,on);};
     now=base+10;
     if(kind==='keyboard')window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true}));
     else app.canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerId:42,pointerType:'touch',clientX:300,clientY:500,bubbles:true}));
     now=base+60;
     if(kind==='keyboard')window.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space',bubbles:true}));
     else window.dispatchEvent(new PointerEvent('pointerup',{pointerId:42,pointerType:'touch',bubbles:true}));
     now=base+70;app._frame(now);
     results.push({kind,gas,held:app.input.throttle});
    }finally{
     delete performance.now;window.requestAnimationFrame=raf;app.race._step=step;app.last=clock();
    }
   }
   return results;
  });
  for(const pulse of pulses){assert.ok(Math.abs(pulse.gas-.05)<1/120+.0001,JSON.stringify(pulse));assert.equal(pulse.held,false);}
  console.log('Appuis clavier et tactiles de 50 ms entre deux images : reçus par la physique');
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
