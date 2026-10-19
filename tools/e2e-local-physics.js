'use strict';
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const double=/const DOUBLE = `([\s\S]*?)`;/m.exec(fs.readFileSync(path.join(__dirname,'e2e-duo.js'),'utf8'))[1];
(async()=>{
  const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({args:['--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});
  const errors=[],measurements=[];
  try{
    const ctx=await browser.newContext({viewport:{width:960,height:600}});
    const open=async name=>{const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://127.0.0.1:${server.address().port}/index.html`);await p.waitForFunction(()=>typeof app!=='undefined');await p.evaluate(double);await p.evaluate(name=>{app.save.name=name;app.mondial=null;app.state='lobby';app.save.lang='fr';app.ui.lang='fr';},name);return p;};
    const h=await open('Hôte'),a=await open('Devant'),b=await open('Suiveur'),pages=[h,a,b];
    const code=await h.evaluate(async()=>{await app.net.open('Hôte',true);app.net.setTable({mode:'ghost',trackId:'monza',laps:3});app.net.setMine({car:{modelId:'f40'},ready:true});return app.net.code;});
    for(const [p,name]of[[a,'Devant'],[b,'Suiveur']])await p.evaluate(async({code,name})=>{await app.net.open(name,false,code);app.net.setMine({car:{modelId:'f40'},ready:true});}, {code,name});
    await h.waitForFunction(()=>app.net.canStart()&&app.net.members().length===3);
    await b.waitForFunction(()=>app.net.link.ping(app.net.pid)!=null);
    await b.evaluate(()=>app.ui.lobbyScreen());assert.match(await b.locator('.net-ping').textContent(),/Ping hôte.*\d+ ms/);
    await h.waitForTimeout(6500);
    assert.equal(await h.evaluate(()=>app.net.members().length),3,'lobby heartbeat keeps waiting players visible');
    assert(await h.evaluate(()=>app.net.canStart()));
    await h.evaluate(()=>app.net.start());
    await Promise.all(pages.map(p=>p.waitForFunction(()=>app.race?.state==='racing',{},{timeout:90000})));
    const frontSeat=await a.evaluate(()=>app.net.seat);
    for(const p of pages)await p.evaluate(seat=>{
      window.brakeTrace=[];
      const drive=app.net.drive,receive=drive.receive.bind(drive);
      drive.receive=(p,pid)=>{
        const states=p.kind==='owned'?driveDecode(p.state):p.kind==='view'?driveDecode(p.data):null;
        const s=states?.find(s=>app.race.cars[s.id]?.human===seat&&!s.far&&(s.flags&4));
        if(s&&window.brakeTrace.length<5)window.brakeTrace.push({wall:performance.timeOrigin+performance.now(),at:s.at,now:app.net.link.now(),previous:drive.states.get(s.id)?.at,seq:p.seq,kind:p.kind});
        return receive(p,pid);
      };
    },frontSeat);
    for(const delay of [0,30,60,100]){
      await Promise.all(pages.map(p=>p.evaluate(delay=>window.NET_TEST_DELAY=delay,delay)));
      await b.waitForTimeout(2200);
      const ping=await b.evaluate(()=>app.net.link.ping(app.net.pid));
      assert(ping>=delay*2-5&&ping<delay*2+200,`measured RTT ${ping}, expected around ${delay*2}`);
      await Promise.all(pages.map((p,i)=>p.evaluate(i=>{
        const c=app.race.player;c.place(app.race.track.length-80-i*10,0);c.v=15;c.vl=0;c.w=0;c.engineStopped=false;c.state='ok';c.grassT=0;c.offT=0;
        window.brakeTrace=[];
        app.input={throttle:0,sel:0,brake:0,engineBrake:0};app.throttlePulses.reset(0);
      },i)));
      await b.waitForTimeout(600);
      await Promise.all(pages.map(p=>p.evaluate(()=>window.brakeTrace=[])));
      await b.evaluate(seat=>{
        const car=app.race.cars.find(c=>c.human===seat);window.brakeSeen=null;
        const check=()=>{if(car.braking){window.brakeSeen=performance.timeOrigin+performance.now();return;}requestAnimationFrame(check);};requestAnimationFrame(check);
      },frontSeat);
      const pressed=await a.evaluate(()=>{app.input.brake=1;return performance.timeOrigin+performance.now();});
      await b.waitForFunction(()=>window.brakeSeen!=null);
      const visible=await b.evaluate(()=>window.brakeSeen)-pressed;
      if(visible>=delay*2+160)console.log('brake diagnostics',JSON.stringify(await Promise.all(pages.map(p=>p.evaluate(()=>({trace:window.brakeTrace,clock:app.net.link.offset,car:{v:app.race.player.v,state:app.race.player.state,braking:app.race.player.braking}}))))));
      assert(visible>=delay*2-10&&visible<delay*2+160,`brake visible after ${visible}ms at hop delay ${delay}`);
      // Pulse wholly between two frames is still consumed by local physics.
      const pulse=await a.evaluate(async()=>{
        app.race.player.v=0;app.input={throttle:0,sel:0,brake:0,engineBrake:0};
        return new Promise(resolve=>requestAnimationFrame(()=>{
          const now=performance.now();app.throttlePulses.push(now+1,1);app.throttlePulses.push(now+13,0);
          requestAnimationFrame(()=>resolve(app.race.player.v));
        }));
      });
      assert(pulse>0,'sub-frame throttle pulse must accelerate the local car');
      measurements.push({oneWayMs:delay,pingMs:ping,brakeVisibleMs:Math.round(visible),pulseSpeed:pulse});
      console.log(JSON.stringify(measurements.at(-1)));
    }
    fs.mkdirSync(path.join(root,'docs/multijoueur'),{recursive:true});
    await b.screenshot({path:path.join(root,'docs/multijoueur/ping-course-test.png')});
    const beforePause=await h.evaluate(()=>{app.togglePause();return app.race.time;});
    await h.waitForTimeout(350);
    assert(await h.evaluate(before=>app.state==='paused'&&app.race.time>before+.2,beforePause),'online host menu does not suspend the race');
    await h.evaluate(()=>app.resume());
    await b.evaluate(()=>app.toLobby());await b.screenshot({path:path.join(root,'docs/multijoueur/ping-salon-test.png')});
    fs.writeFileSync(path.join(root,'docs/multijoueur/mesures-locales.json'),JSON.stringify({version:await b.evaluate(()=>APP_VERSION),date:new Date().toISOString().slice(0,10),transport:'BroadcastChannel double, delay on each directed hop; not a public WebRTC measurement',measurements,errors},null,2)+'\n');
    assert.equal(errors.length,0,errors.join('\n'));
    console.log('OK: three drivers, local sub-frame pulses, remote braking at four delays, measured RTT, lobby/HUD captures; no browser errors.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
