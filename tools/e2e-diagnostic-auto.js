const {chromium}=require('playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto((process.argv[2]||'http://127.0.0.1:8765')+'/tools/diagnostic-pc.html');
 await p.waitForFunction(()=>!document.querySelector('#auto').disabled);await p.click('#auto');
 const movement=await p.evaluate(()=>{const a=document.querySelector('iframe').contentWindow.app;const before=a.race.cars.map(c=>c.s);a.race.state='racing';for(let i=0;i<120;i++)a.spectator.update(1/60);return {ai:a.race.cars.every(c=>!c.isPlayer&&c.human===null),moved:a.race.cars.some((c,i)=>Math.abs(c.s-before[i])>1),spectator:!!a.spectator};});
 assert(movement.ai&&movement.moved&&movement.spectator);
 await p.evaluate(()=>{const a=document.querySelector('iframe').contentWindow.app,before=a.race.time;Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});a.spectator.update(1);if(a.race.time!==before)throw Error('Hidden tab advanced simulation');delete document.hidden;});
 const cross=()=>p.evaluate(()=>{const a=document.querySelector('iframe').contentWindow.app;a.race.cars[0].lap++;a.renderer.draw(a.race,a.ui);});
 await cross(); // warm-up ends, first measured stage starts
 const sequence=['normal','objects','textures','tyres','barriers','all','rubber','cache','cacheAll','normal'];
 let download;
 for(let i=0;i<sequence.length;i++){
  assert.equal(await p.locator('#mode').inputValue(),sequence[i]);await p.waitForTimeout(150);
  if(i===sequence.length-1)download=p.waitForEvent('download');
  await cross();
 }
 const d=await download;let raw='';for await(const part of await d.createReadStream())raw+=part;
 const data=JSON.parse(raw);assert.equal(data.automatic.status,'complete');assert.equal(data.results.length,10);assert.deepEqual(data.results.map(r=>r.mode),sequence);assert(data.results.every(r=>r.frames>0));
 assert.equal(await p.evaluate(()=>document.querySelector('iframe').contentWindow.app.state),'paused');assert.deepEqual(errors,[]);
 console.log('All AI move; warmup, 10 lap transitions, single automatic JSON export and stop: OK');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
