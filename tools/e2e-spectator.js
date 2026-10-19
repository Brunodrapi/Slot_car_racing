// Full application over the same BroadcastChannel transport double as e2e-duo.
// No public multiplayer service, database or real traffic is used.
const { chromium } = require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(__dirname,'e2e-duo.js'),'utf8');
const double=/const DOUBLE = `([\s\S]*?)`;/m.exec(source)[1];
(async()=>{
  const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});
  const errors=[];
  const mode=process.argv.includes('--race')?'race':'duel';
  const captures=path.join(root,'docs/spectateur');fs.mkdirSync(captures,{recursive:true});
  try {
    const context=await browser.newContext({viewport:{width:1000,height:700}});
    const open=async()=>{const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://127.0.0.1:${server.address().port}/index.html`);await p.waitForFunction(()=>typeof app!=='undefined');await p.evaluate(double);await p.evaluate(()=>{app.mondial=null;app.save.name='Test';app.save.lang='fr';app.ui.lang='fr';app.state='lobby';});return p;};
    const h=await open(),g=await open(),s=await open();
    const code=await h.evaluate(async mode=>{await app.net.open('Hôte',true);app.net.setTable({mode,trackId:'monza',laps:3});app.net.setMine({car:{modelId:'f40'},ready:true});return app.net.code;},mode);
    await g.evaluate(async code=>{await app.net.open('Invité',false,code);app.net.setMine({car:{modelId:'f40'},ready:true});},code);
    await s.evaluate(async code=>{await app.net.open('Spectateur',false,code,true);app.ui.lobbyScreen();},code);
    await h.waitForFunction(()=>app.net.members().length===3&&app.net.canStart());
    assert(await s.locator('[data-action="netRole"]').isVisible());
    await s.locator('[data-action="netRole"]').click();
    assert.equal(await s.evaluate(()=>app.net.mine.spectator),false);
    await s.locator('[data-action="netRole"]').click();
    await h.waitForFunction(()=>app.net.canStart());
    await h.evaluate(()=>app.net.start());
    await Promise.all([h,g,s].map(p=>p.waitForFunction(()=>app.state==='race'&&app.race,{},{timeout:90000})));
    await h.waitForFunction(()=>app.race.state==='racing',{},{timeout:90000});
    await s.waitForFunction(()=>app.net.lastSeq>0);
    assert.deepEqual(await s.evaluate(()=>({seat:app.net.seat,local:app.race.cars.filter(c=>c.isPlayer).length,grid:app.net.roster.length})),{seat:-1,local:0,grid:2});
    assert.equal(await h.evaluate(()=>app.net.attendus().total),2);
    await h.evaluate(()=>{app.net.drive.epoch=app.net.link.now()-100000;app.race.time=100;app.race.cars.forEach((c,i)=>{c.lapTimes=[40+i,42+i];c.lapOk=[true,false];c.bestLap=40+i;c.lap=2;c.started=true;c.lapStart=90;});app.net.drive.reportAt=0;});
    await s.waitForFunction(()=>app.race.cars[0].lapTimes.length===2);
    for(const mode of ['auto','follow','full','fixed','duel']){
      await s.locator('select[aria-label="Vue spectateur"]').selectOption(mode);
      await s.waitForTimeout(180);
      assert(await s.evaluate(()=>Number.isFinite(app.renderer.cam.x)&&Number.isFinite(app.renderer.cam.y)&&app.renderer.cam.zoom>0));
    }
    await s.locator('[data-step="1"]').click();
    assert(await s.locator('.spectator-minimap').isVisible(),'close-up views retain a minimap');
    assert.equal(await s.locator('.spectator-summary [data-car]').count(),await s.evaluate(()=>Math.min(6,app.race.cars.length)));
    const shots=await s.evaluate(()=>{
      const view=app.spectator,time=app.race.time;view.mode='auto';view.autoShot=-1;view.lastCut=time-9;
      const shots=[];for(let i=0;i<4;i++){app.race.time=time+i*8.1;view.update(0);shots.push(view.effectiveMode);}app.race.time=time;
      return shots;
    });
    assert.deepEqual(shots,['full','follow','duel','full']);
    assert.equal(await s.evaluate(()=>new Set(app.spectator.colors).size),await s.evaluate(()=>app.race.cars.length),'one stable colour per driver');
    await s.locator('select').selectOption('full');
    await s.waitForTimeout(300);
    assert(await s.evaluate(()=>{
      const r=app.renderer,b=app.race.track.bounds,p=app.spectator.root.getBoundingClientRect();
      return r.w/2+(b.minX-r.cam.x)*r.cam.zoom>p.right && r.w/2+(b.maxX-r.cam.x)*r.cam.zoom<r.w && r.h/2+(b.minY-r.cam.y)*r.cam.zoom>0 && r.h/2+(b.maxY-r.cam.y)*r.cam.zoom<r.h;
    }),'landscape overview fits beside the sidebar');
    await s.screenshot({path:path.join(captures,'spectateur-circuit-test.png')});
    await s.locator('select').selectOption('follow');await s.waitForTimeout(300);
    await s.screenshot({path:path.join(captures,'spectateur-suivi-test.png')});
    const late=await open();
    await late.evaluate(()=>app.ui.lobbyScreen());
    await late.locator('#inp-code').fill(code);
    await late.locator('[data-action="netWatch"]').click();
    await late.waitForFunction(()=>app.state==='race'&&app.race?.cars[0].lapTimes.length===2,{},{timeout:90000});
    assert.equal(await late.evaluate(()=>app.net.roster.length),2);
    assert.equal(await late.evaluate(()=>app.net.mine.i),undefined);
    const saved=await late.evaluate(()=>JSON.stringify(app.save));
    await late.setViewportSize({width:390,height:844});
    await late.waitForTimeout(300);
    await late.locator('select').selectOption('follow');await late.waitForTimeout(300);
    await late.screenshot({path:path.join(captures,'spectateur-mobile-test.png')});
    assert(await late.evaluate(()=>document.querySelector('.spectator-panel').getBoundingClientRect().right<=innerWidth));
    await g.evaluate(()=>{
      const race=app.race,c=race.player;
      c.started=true;c.lap=2;c.lapTimes=[40+race.cars.indexOf(c),42+race.cars.indexOf(c)];c.lapOk=[true,false];
      c.lapStart=90;c.checkpoint=true;c.s=race.track.length-.01;c._advance(.02,race.time);
      c.finished=true;c.finishTime=race.time;app.net.drive.metaKey=null;app.net.drive.lastSend=-Infinity;
    });
    await h.waitForFunction(()=>app.race.state==='finishing');
    await s.waitForFunction(()=>app.race.state==='finishing'&&app.race.finishDeadline>app.race.time);
    assert(await h.evaluate(()=>app.race.finishDeadline-app.race.time>27),'first guest finisher leaves a 30-second grace period');
    await s.waitForFunction(()=>document.querySelector('.spectator-status')?.textContent.includes('Fin dans'));
    await h.evaluate(()=>{app.race.cars.forEach((c,i)=>{c.finished=true;c.finishTime=101+i;c.lap=3;});});
    await Promise.all([h,g,s,late].map(p=>p.waitForFunction(()=>app.state==='results',{},{timeout:30000})));
    for(const p of [h,g,s,late])assert(await p.locator('.race-analysis').isVisible());
    const packets=await Promise.all([h,g,s,late].map(p=>p.evaluate(()=>app.race.broadcast.packet(app.race))));
    for(const packet of packets.slice(1))assert.deepEqual(packet.laps,packets[0].laps);
    assert.equal(await s.locator('.spectator-panel').count(),0);
    assert.equal(await late.evaluate(()=>JSON.stringify(app.save)),saved);
    assert.deepEqual(await late.evaluate(()=>app.race.broadcast.history),packets[0].history);
    await s.screenshot({path:path.join(captures,'bilan-course-test.png'),fullPage:true});
    await s.evaluate(()=>app.toLobby());
    await s.waitForTimeout(1200);
    assert.equal(await s.evaluate(()=>app.state),'lobby');
    await h.evaluate(()=>app.toLobby());
    await s.waitForTimeout(300);
    assert.equal(await s.evaluate(()=>app.net.mine.spectator),true);
    assert.equal(errors.length,0,errors.join('\n'));
    console.log('OK: spectator before/after start, five cameras, mobile, no driver slot/input, host lap history, shared race report, return to lobby; zero browser errors.');
  } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
