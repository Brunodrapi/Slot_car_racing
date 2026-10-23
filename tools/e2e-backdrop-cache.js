const {chromium}=require('playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto((process.argv[2]||'http://127.0.0.1:8765')+'/tools/diagnostic-pc.html');await p.waitForFunction(()=>!document.querySelector('#start').disabled);await p.click('#start');
 await p.selectOption('#mode','backdrop');await p.waitForFunction(()=>!document.querySelector('#start').disabled,{},{timeout:180000});
 const result=await p.evaluate(()=>{const a=document.querySelector('iframe').contentWindow.app,r=a.renderer;a.state='paused';const originalCreated=r.backdropStats.tiles,infos=[];for(const f of [.1,.4,.7,.95]){a.race.player.place(a.race.track.length*f,0,30);r.cam.init=false;r.updateCamera(a.race,1/60);r.draw(a.race,a.ui);infos.push({...r.backdropStats});}return {enabled:r.testBackdrop,originalCreated,infos};});
 assert(result.enabled);assert(result.originalCreated>0);for(const s of result.infos){assert(s.ready);assert.equal(s.tiles,result.originalCreated);assert(s.bytes<=256*1024*1024);assert.equal(s.misses,0);}
 await p.screenshot({path:'/tmp/backdrop-spa.jpg'});await p.selectOption('#mode','normal');assert.equal(await p.evaluate(()=>document.querySelector('iframe').contentWindow.app.renderer.testBackdrop),false);
 assert.deepEqual(errors,[]);console.log('Precomputed static background, bounded memory, 4 track locations, no on-track misses, return to normal: OK',JSON.stringify(result.infos.at(-1)));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
