// node --require /workspace/cloud-setup/system-chromium.cjs tools/e2e-night.js [output]
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),OUT=path.resolve(process.argv[2]||'/tmp/grip-night');
fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{
  const file=path.resolve(ROOT,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch(),errors=[],results=[];
 try{
  for(const mobile of [false,true]){
   const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile});
   const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error('Browser:',e.stack);});
   await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
   await page.waitForFunction(()=>typeof app!=='undefined'&&app.save);
   await page.evaluate(()=>{
    localStorage.removeItem(SAVE_KEY);if(loadSave().timeOfDay!=='day')throw Error('new save');
    localStorage.setItem(SAVE_KEY,JSON.stringify({name:'Ancien',timeOfDay:'bad'}));
    if(loadSave().timeOfDay!=='day'||loadSave().name!=='Ancien')throw Error('old save');
    app.save=defaultSave();app.save.name='Pilote';app.save.sound=false;app.save.lang='fr';app.ui.lang='fr';
    app.mondial=null;app.state='menu';app.save.cat='gt3';app.save.filtreCat='gt3';app.save.models.gt3='porsche991gt3r';
    app.ui.setup.classId='gt3';app.ui.setup.trackId='monza';app.ui.setupScreen('race');
   });
   assert.match(await page.locator('[data-action="pickTimeOfDay"]').innerText(),/jour/i);
   await page.click('[data-action="pickTimeOfDay"]');
   assert.equal(await page.locator('[data-action="pickTimeOfDay"]').getAttribute('aria-pressed'),'true');
   assert.match(await page.locator('.night-hint').innerText(),/visibilité réduite/i);
   await page.screenshot({path:path.join(OUT,mobile?'menu-mobile.png':'menu-pc.png')});
   await page.reload();await page.waitForFunction(()=>typeof app!=='undefined'&&app.save);
   assert.equal(await page.evaluate(()=>app.save.timeOfDay),'night');
   await page.evaluate(()=>{app.mondial=null;app.leaveSplash();app.ui.lang='fr';app.ui.setup.classId='gt3';app.ui.setup.trackId='monza';app.ui.setupScreen('race');});
   await page.click('[data-action="startQuick"]');
   await page.waitForFunction(()=>app.race?.timeOfDay==='night'&&app.renderer.night.active).catch(async e=>{console.error(await page.evaluate(()=>({state:app.state,time:app.race?.timeOfDay,night:app.renderer.night.active,save:app.save.timeOfDay,html:app.ui.root.innerText.slice(-300)})));throw e;});
   await page.waitForTimeout(700);
   await page.evaluate(()=>{app.state='paused';app.ui.hide();});
   const check=await page.evaluate(()=>{
    const r=app.renderer,race=app.race,n=r.night;
    const render=()=>r.draw(race,app.ui);
    const alphaAt=(x,y)=>{
     let dx=x-r.cam.x,dy=y-r.cam.y;
     if(r.rotate){const a=-r.camAngle-Math.PI/2,c=Math.cos(a),s=Math.sin(a);[dx,dy]=[dx*c-dy*s,dx*s+dy*c];}
     const px=Math.round((r.w/2+dx*r.cam.zoom)*r.dpr),py=Math.round((r.h/2+dy*r.cam.zoom)*r.dpr);
     if(px<0||py<0||px>=r.nightCanvas.width||py>=r.nightCanvas.height)return null;
     return r.nightCtx.getImageData(px,py,1,1).data[3];
    };
    r.shake=0;render();
    if(!n.fields.some(f=>f.beam))throw Error('GT3 headlights absent');
    // Isolate a car far from circuit lighting to measure a beam against darkness.
    const p=race.player,old={x:p.x,y:p.y,h:p.heading};
    p.x=10000;p.y=10000;p.th=0;r.cam.x=p.x;r.cam.y=p.y;r.cam.zoom=10;r.rotate=false;
    const cars=race.cars;race.cars=[p];render();
    const ahead=alphaAt(p.x+15,p.y),behind=alphaAt(p.x-15,p.y),side=alphaAt(p.x+15,p.y+15);
    if(!(ahead<150&&behind>245&&side>245))throw Error(`fog/beam ${ahead}/${behind}/${side}`);
    const noHalo=alphaAt(p.x,p.y+3);if(noHalo<245)throw Error('round car aura remains: '+noHalo);
    if(n.fields.some(f=>!f.beam&&!f.flood))throw Error('non-directional light field');
    const farSeen=n.canSee({x:p.x-20,y:p.y});if(farSeen)throw Error('unlit opponent revealed');
    p.th=Math.PI/2;render();
    const turned=alphaAt(p.x,p.y+15),oldAhead=alphaAt(p.x+15,p.y);
    if(!(turned<150&&oldAhead>245))throw Error('headlight does not follow yaw');
    const ghost=Object.assign(Object.create(p),{fantome:true,isPlayer:false});race.cars=[ghost];render();
    if(n.fields.some(f=>f.beam))throw Error('ghost casts light');
    // A floodlight illuminates in front of the fixture, without a radial pool.
    const lamps=n.lamps;n.lamps=[{x:p.x,y:p.y,heading:0,length:20,width:12,radius:24,power:.84,flood:true}];
    race.cars=[];render();
    const floodAhead=alphaAt(p.x+10,p.y),floodBehind=alphaAt(p.x-10,p.y),floodSide=alphaAt(p.x,p.y+10);
    if(!(floodAhead<150&&floodBehind>245&&floodSide>245))throw Error(`flood direction ${floodAhead}/${floodBehind}/${floodSide}`);
    n.lamps=lamps;race.cars=cars;p.x=old.x;p.y=old.y;p.th=old.h;
    // All categories preserve their physics; headlights are a visual property.
    const f1=new Race({trackDef:TRACKS[0],classId:'f1',timeOfDay:'night'});
    n.setTrack(f1.track);n.prepare(f1,r.cam,100);if(n.fields.some(f=>f.beam)||n.fields.some(f=>!f.flood))throw Error('F1 headlights');
    const lamp=n.lamps[0];
    if(lamp){f1.player.x=lamp.target.x;f1.player.y=lamp.target.y;n.prepare(f1,lamp.target,100);if(!n.canSee(lamp.target))throw Error('F1 cannot see lit gravel');}
    const categories=playableCategories().filter(c=>c.id!=='f1');
    for(const c of categories){const rr=new Race({trackDef:TRACKS[0],classId:c.id,timeOfDay:'night'});n.prepare(rr,rr.player.pos,100);if(!n.fields.some(f=>f.beam))throw Error(c.id+' headlights');}
    const tracks=TRACKS.map(t=>{
     const l=new NightLighting(),tr=new Track(t);l.setTrack(tr);
     if(l.lamps.some(p=>![p.x,p.y,p.heading,p.length,p.width].every(Number.isFinite)||!p.flood))throw Error('bad floodlights '+t.id);
     for(const p of l.lamps){const hw=p.side>0?tr.hwLeftAt(p.s):tr.hwRightAt(p.s),w=tr.largeurBac(tr.idx(p.s),p.side);if(tr.runoffSurfaceAt(p.s,p.side*(hw+w*.55))!=='gravel')throw Error('lamp outside gravel '+t.id);}
     if(l.lamps.length>=tr.length/45)throw Error('continuous circuit lighting '+t.id);
     return {id:t.id,lamps:l.lamps.length};
    });
    n.setTrack(race.track);
    // Restore realistic framing for captures; check all four camera transforms.
    for(const view of ['fixed','track','avance','avanceFixe']){r.setView(view);r.updateCamera(race,1);render();if(r.nightCanvas.width!==Math.round(r.w*r.dpr))throw Error('mask resolution');}
    r.setView('avanceFixe');r.updateCamera(race,1);render();
    const night=performance.now();for(let i=0;i<15;i++)render();const nightMs=(performance.now()-night)/15;
    race.timeOfDay='day';render();if(r.nightCanvas.style.display!=='none')throw Error('day mask persists');
    const day=performance.now();for(let i=0;i<15;i++)render();const dayMs=(performance.now()-day)/15;
    race.timeOfDay='night';render();
    return{ahead,behind,side,noHalo,turned,oldAhead,floodAhead,floodBehind,floodSide,trackLighting:tracks,tracks:tracks.length,categories:categories.map(c=>c.id),nightMs,dayMs};
   });
   await page.evaluate(()=>{
    document.querySelector('#browser-performance-notice button')?.click();
    const race=app.race;race.state='racing';race.countdown=0;race.cars.forEach(c=>c.gridLat=null);
    for(let i=0;i<480;i++)race.update(1/60,{throttle:.7,sel:0});
    for(let i=0;i<30;i++)app.renderer.updateCamera(race,.1);
    app.renderer.draw(race,app.ui);
    // Old hosts and invalid values default to day; a guest cannot alter the table.
    for(const value of ['night',undefined,'invalid']){
     const net=new Net();net.creator=true;net.state='lobby';net.table.go=1;net.table.timeOfDay=value;
     net.members=()=>[{pid:net.pid,name:'Host',car:{modelId:'f40'},q:{}},{pid:'guest',name:'Guest',car:{modelId:'f40'},q:{}}];
     net.post=()=>{};let received;net.onStart=cfg=>received=cfg.timeOfDay;net.pump();
     if(received!==(value==='night'?'night':'day'))throw Error('host lighting normalization');
     net.creator=false;const old=net.table.timeOfDay;net.setTable({timeOfDay:'bad'});if(net.table.timeOfDay!==old)throw Error('guest changed lighting');
    }
   });
   await page.screenshot({path:path.join(OUT,mobile?'nuit-mobile.png':'nuit-pc.png')});
   await page.evaluate(()=>{app.race.timeOfDay='day';app.renderer.draw(app.race,app.ui);});
   await page.screenshot({path:path.join(OUT,mobile?'jour-mobile.png':'jour-pc.png')});
   await page.evaluate(mobile=>{
    app.startQuick('timetrial','gt3','spa');app.state='paused';app.ui.hide();
    const r=app.renderer,race=app.race;
    const lamp=r.night.lamps.find(l=>l.s/race.track.length>.54&&l.s/race.track.length<.61)||r.night.lamps[0];
    if(!lamp)throw Error('Spa gravel floodlights missing');
    race.player.place(lamp.s-10,0,0);race.state='racing';race.countdown=0;
    r.setView('fixed');r.cam.x=(race.player.x+lamp.target.x)/2;r.cam.y=(race.player.y+lamp.target.y)/2;r.cam.zoom=mobile?7:11;
    r.draw(race,app.ui);
   },mobile);
   await page.screenshot({path:path.join(OUT,mobile?'spa-gravier-mobile.png':'spa-gravier-pc.png')});
   await page.evaluate(()=>{
    app.startQuick('timetrial','f1','monza');app.state='paused';app.ui.hide();
    app.race.state='racing';app.race.countdown=0;app.renderer.updateCamera(app.race,1);app.renderer.draw(app.race,app.ui);
    if(app.race.timeOfDay!=='night'||app.renderer.night.fields.some(f=>f.beam))throw Error('F1 race beams');
   });
   await page.screenshot({path:path.join(OUT,mobile?'f1-nuit-mobile.png':'f1-nuit-pc.png')});
   await page.evaluate(()=>{app.startQuick('training','gt3','monza');app.state='paused';app.ui.hide();app.renderer.updateCamera(app.race,1);app.renderer.draw(app.race,app.ui);if(app.race.timeOfDay!=='night'||!app.race.entrainement)throw Error('training night');});
   // Resize while night is active; menu navigation must clear the effect.
   await page.evaluate(()=>{app.race.timeOfDay='night';});
   await page.setViewportSize(mobile?{width:844,height:390}:{width:1100,height:720});
   await page.evaluate(()=>{app.renderer.draw(app.race,app.ui);if(app.renderer.nightCanvas.width!==Math.round(innerWidth*app.renderer.dpr))throw Error('resize');app.toMenu();if(app.renderer.nightCanvas.style.display!=='none')throw Error('menu overlay');});
   results.push({mobile,...check});await context.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(OUT,'verification.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
