'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),OUT=process.argv[2]||'/tmp/spa-barrieres';
(async()=>{
 fs.mkdirSync(OUT,{recursive:true});
 const server=http.createServer((req,res)=>{
  const file=path.resolve(ROOT,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
  if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
  for(const [width,height,dpr] of [[390,844,3],[1280,800,1]]){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr,locale:'fr-FR'}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.waitForFunction(()=>window.app&&app.renderer);
   await page.evaluate(()=>{app.mondial=null;app.save.lang='fr';app.startQuick('race','gt','spa');});
   await page.waitForFunction(()=>app.race.state==='racing');
   for(const kind of ['rail','tyres']){
    const result=await page.evaluate(kind=>{
     app.state='paused';app.ui.hide();app.race.time=3;const r=app.race,T=r.track,p=r.player;
     const b=kind==='tyres'?T.barriers.find(b=>b.kind===kind&&b.side===1&&T.largeurBac(T.idx(b.s),b.side)>10)
       :T.barriers.find(b=>b.kind===kind&&b.s>600&&b.s<900&&Math.abs(T.curvAt(b.s))<.003);
     if(!b)throw Error('Barrière introuvable '+kind);
     p.place(b.s-12,0,0);p.gridLat=null;
     for(const other of r.cars)if(other!==p)other.place(b.s-60-other.number*10,0,0);
     for(let i=0;i<160;i++)app.renderer.updateCamera(r,1/60);
     app.renderer.draw(r,app.ui);
     const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const g=canvas.getContext('2d');
     g.translate(128,128);g.scale(5,5);g.translate(-(b.ax+b.bx)/2,-(b.ay+b.by)/2);
     app.renderer._drawBarriers(g,{minX:b.ax-22,maxX:b.ax+22,minY:b.ay-22,maxY:b.ay+22});
     const pixels=g.getImageData(0,0,256,256).data;let ink=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])ink++;
     return {ink,groups:app.renderer.barrierArt.length,gravel:!!app.renderer.barrierGravel};
    },kind);
    assert.ok(result.ink>500&&result.groups>50&&result.gravel);
    await page.screenshot({path:path.join(OUT,kind+'-'+width+'.png')});
   }
   await page.evaluate(()=>{app.audio.start();app.audio.resume();});
   await page.waitForFunction(()=>{app.audio.update(app.race.player,true);return app.audio.pret;});
   await page.waitForTimeout(250);
   assert.ok(await page.evaluate(()=>app.audio.engGain.gain.value>.8),'moteur inaudible avant le choc');
   const impact=await page.evaluate(()=>{
    const r=app.race,T=r.track,p=r.player,b=T.barriers.find(b=>b.kind==='rail'&&b.side===1&&b.s>600&&Math.abs(T.curvAt(b.s))<.003);
    p.usure=USURE;p.state='ok';p.damage=0;p.crashes=0;p.fautes=0;p.barrierHits=0;p.gridLat=null;
    const x=(b.ax+b.bx)/2+b.nx*(p.cls.length/2+b.half+1),y=(b.ay+b.by)/2+b.ny*(p.cls.length/2+b.half+1);
    const pr=T.project(x,y,b.s,20);p.place(pr.s,pr.lat,35);p.x=x;p.y=y;p.th=Math.atan2(-b.ny,-b.nx);
    for(let i=0;i<120&&!p.engineStopped;i++)p.update(1/120,true,r.time+i/120);
    for(let i=0;i<160;i++)app.renderer.updateCamera(r,1/60);
    app.renderer.draw(r,app.ui);
    return {stopped:p.engineStopped,v:p.v,damage:p.damage,crashes:p.crashes,fautes:p.fautes,hits:p.barrierHits,cut:p.engineCut};
   });
   assert.ok(impact.stopped&&impact.cut>0&&impact.damage>0);assert.equal(impact.v,0);assert.equal(impact.crashes,1);assert.equal(impact.fautes,1);assert.equal(impact.hits,1);
   await page.screenshot({path:path.join(OUT,'impact-'+width+'.png')});
   await page.evaluate(()=>app.audio.update(app.race.player,true));
   await page.waitForTimeout(250);
   assert.ok(await page.evaluate(()=>app.audio.engGain.gain.value<.01),'son moteur encore actif pendant la coupure');
   await page.evaluate(()=>{app.race.player.engineStopped=false;app.audio.update(app.race.player,true);});
   await page.waitForTimeout(250);
   assert.ok(await page.evaluate(()=>app.audio.engGain.gain.value>.8),'son moteur absent à la reprise');
   await page.evaluate(()=>app.startQuick('race','gt','monza'));
   assert.equal(await page.evaluate(()=>app.renderer.barrierArt.length),0);
   assert.deepEqual(errors,[]);console.log(width+'×'+height+': rendu procédural, bac, collision réelle et changement de circuit OK',impact);
   await page.close();
  }
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
