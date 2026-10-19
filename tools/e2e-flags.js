'use strict';
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/drapeaux');
const double=/const DOUBLE = `([\s\S]*?)`;/m.exec(fs.readFileSync(path.join(__dirname,'e2e-duo.js'),'utf8'))[1];
(async()=>{
  const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({args:['--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});
  const errors=[];fs.mkdirSync(out,{recursive:true});
  try{
    const ctx=await browser.newContext({viewport:{width:1000,height:700}});
    const open=async()=>{const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://127.0.0.1:${server.address().port}/index.html`);await p.waitForFunction(()=>typeof app!=='undefined');await p.evaluate(()=>{app.mondial=null;app.save.name='Test drapeaux';app.save.lang='fr';app.ui.lang='fr';});return p;};
    const solo=await open();
    for(const viewport of [{width:1000,height:700},{width:390,height:844}]){
      await solo.setViewportSize(viewport);
      for(const flag of ['blue','yellow','penalty','chequered']){
        await solo.evaluate(flag=>{
          app.startQuick(flag==='penalty'?'timetrial':'race','gt','monza');app.state='paused';app.ui.hide();
          const r=app.race,p=r.player;r.state='racing';r.time=20;p.gridLat=null;
          r.cars.forEach((c,i)=>{c.started=true;c.lap=0;c.place(200+i*50,0,0);c.state='ok';});p.place(100,0,0);
          if(flag==='blue'){const fast=r.cars[0];fast.place(92,0,20);fast.lap=1;r.flags.update();}
          if(flag==='yellow'){p.state='grass';r.flags.offSince.set(r.cars.indexOf(p),16);r.flags.update();}
          if(flag==='penalty'){p.lapSale=true;r.flags.inspect(p);}
          if(flag==='chequered'){p.lap=r.laps-1;r.flags.update();}
          for(let i=0;i<100;i++)app.renderer.updateCamera(r,1/60);
          app.renderer.draw(r,app.ui);
        },flag);
        const result=await solo.evaluate(()=>{
          const r=app.renderer,z=r.hudZones.flags,d=r.dpr;
          return {types:z.types,pixel:[...r.hudCtx.getImageData(Math.round((z.x+5)*d),Math.round((z.y+10)*d),1,1).data],zones:app.race.flags.zones.length,blue:app.race.player.blueFlag};
        });
        assert(result.types.includes(flag));assert(result.pixel[3]>0);
        if(flag==='blue')assert(result.pixel[2]>result.pixel[0]+60&&result.blue,'actual blue HUD square');
        if(flag==='yellow')assert(result.pixel[0]>180&&result.pixel[1]>120&&result.pixel[2]<100&&result.zones===1,'actual yellow HUD square and painted zone');
        await solo.screenshot({path:path.join(out,`${flag}-${viewport.width}.png`)});
      }
    }
    const h=await open(),g=await open(),s=await open();
    for(const p of[h,g,s]){await p.evaluate(double);await p.evaluate(()=>window.NET_TEST_DELAY=30);}
    const code=await h.evaluate(async()=>{await app.net.open('Leader',true);app.net.setTable({mode:'duel',trackId:'monza',laps:3});app.net.setMine({car:{modelId:'f40'},ready:true});return app.net.code;});
    await g.evaluate(async code=>{await app.net.open('Retardataire',false,code);app.net.setMine({car:{modelId:'f40'},ready:true});},code);
    await s.evaluate(async code=>app.net.open('Spectateur',false,code,true),code);
    await h.waitForFunction(()=>app.net.canStart());await h.evaluate(()=>app.net.start());
    await Promise.all([h,g,s].map(p=>p.waitForFunction(()=>app.race?.state==='racing',{},{timeout:90000})));
    await h.evaluate(()=>{const r=app.race,c=r.player;c.started=true;c.lap=1;c.lapTimes=[1];c.lapOk=[true];c.lapStart=1;c.place(92,0,12);app.input={throttle:0,sel:0,brake:0,engineBrake:0};});
    await g.evaluate(()=>{const c=app.race.player;c.started=true;c.place(100,0,4);app.input={throttle:0,sel:0,brake:0,engineBrake:0};});
    await g.waitForFunction(()=>app.race.player.blueFlag);
    await s.waitForFunction(()=>app.race.cars.some(c=>c.human===1&&c.blueFlag));
    await s.evaluate(()=>{app.spectator.index=app.race.cars.findIndex(c=>c.human===1);app.spectator.paintAt=-Infinity;});
    await s.waitForFunction(()=>document.querySelector('.spectator-race-clock .race-flag-blue'));
    await s.locator('select').selectOption('full');await s.waitForTimeout(200);await s.screenshot({path:path.join(out,'multi-bleu-top-view.png')});
    // Keep a real owner's incident stable while the host measures its three seconds off track.
    await g.evaluate(()=>{const c=app.race.player;c.v=0;c.vl=0;c.state='grass';c.update=()=>{c.state='grass';};});
    await h.evaluate(()=>{app.race.player.place(250,0,0);});
    await s.waitForFunction(()=>app.race.flags.zones.length>0,{},{timeout:10000});
    await s.waitForFunction(()=>document.querySelector('.spectator-race-clock .race-flag-yellow'));
    await s.screenshot({path:path.join(out,'multi-jaune-top-view.png')});
    await s.locator('select').selectOption('follow');await s.waitForTimeout(200);await s.screenshot({path:path.join(out,'multi-jaune-minicarte.png')});
    await g.evaluate(()=>app.race.player.fautes++);
    await s.waitForFunction(()=>document.querySelector('.spectator-race-clock .race-flag-penalty'));
    await h.evaluate(()=>{const c=app.race.player;c.lap=2;c.lapTimes=[1,1];c.lapOk=[true,true];});
    await s.waitForFunction(()=>document.querySelector('.spectator-race-clock .race-flag-chequered'));
    assert(await s.locator('.spectator-race-clock .race-flag-penalty').count());
    await s.screenshot({path:path.join(out,'multi-sanction-et-damier.png')});
    assert.equal(errors.length,0,errors.join('\n'));
    console.log('OK: solo/mobile HUD pixels, four flags, invalid TT lap, world/map highlights, network blue/yellow/penalty/finish, spectator full/mini views; zero browser errors.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
