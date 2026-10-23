// Executed only by the offline trailer tool, never loaded by the shipped game.
window.trailerSetup = async function(shot,seed) {
  let rng=seed>>>0;Math.random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296); app.mondial=null;app.audio.relance=()=>{};app.audio.update=()=>{};
  app.analytics.begin=()=>{};app.analytics.observe=()=>{};
  app.save.name='GRIP';app.save.lang='en';app.save.sound=false;app.ui.lang='en';
  if(shot.records){
    const snapshot=shot.recordsSnapshot;
    if(!snapshot||snapshot.circuit!==shot.records||!snapshot.records?.length)throw Error('A nonempty public records snapshot is required');
    const par={};for(const r of snapshot.records)if(!par[r.voiture]||r.temps<par[r.voiture].temps)par[r.voiture]=r;
    app.ui._mondiaux={circuit:shot.records,par};app.state='menu';
    const track=TRACKS.find(t=>t.id===shot.records);
    const categories=['gt','proto'];
    app.ui.show(`<div class="trailer-records"><h1>${escapeHtml(track.name)} · WORLD RECORDS</h1><div class="record-columns">${categories.map(id=>`<section><h2>${id==='gt'?'GT':'PROTOTYPES'}</h2>${app.ui.records(shot.records,categoryById(id),modelsOf(id)[0],LIVERIES[0])}</section>`).join('')}</div></div>`,'setup-screen');
    const style=document.createElement('style');style.textContent=`.trailer-records{width:100%;height:100vh;padding:14px 24px;color:#272b28;background:#eee3ca;box-sizing:border-box}.trailer-records h1{color:#202820!important;font:italic 900 40px Racing, sans-serif;margin:0 0 12px}.record-columns{display:grid;grid-template-columns:1fr 1fr;gap:30px}.record-columns h2{color:#202820!important;font:italic 900 25px Racing,sans-serif;margin:0 0 6px}.record-columns h3,.record-columns .mondial-note{display:none}.record-columns .rline{min-height:42px;padding:3px 5px}.record-columns .rline-img img{max-height:36px}.record-columns .rline-t{font-size:16px;color:#272b28!important}.record-columns .rline-t.monde{font-size:20px;color:#17251d!important;font-weight:900}.record-columns .rline small{font-size:11px}.setup-screen{max-width:none!important;width:100%!important;height:100%!important}`;
    document.head.append(style);
    await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));return;
  }
  if(shot.menu){
    app.state='menu';const m=modelById(shot.model);
    app.save.models[m.catId]=m.id;app.save.cat=m.catId;app.save.filtreCat=m.catId;
    app.ui.setup.classId=m.catId;app.ui.setup.trackId='spa';app.ui.setupScreen('race');
    await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));return;
  }
  if(shot.end){
    document.body.innerHTML='<div style="height:100vh;display:flex;align-items:center;justify-content:center;background:#172723"><img src="art/interface/logo-grip.webp" style="width:65%;max-height:65vh;object-fit:contain"></div>';
    await Promise.all([...document.images].map(i=>i.decode()));return;
  }
  const m=modelById(shot.model||'f40');
  app._startRace({mode:shot.mode||'race',trackDef:TRACKS.find(t=>t.id===shot.track),modelId:m.id,classId:m.catId,nCars:shot.action==='overtake'?2:8,laps:3,difficulty:'medium',playerLivery:0,playerName:'GRIP',spectator:!!shot.view},{mode:'race'});
  const race=app.race,T=race.track;
  for(const c of race.cars)topReady(c.cls,c.livree);
  const limit=Date.now()+20000;
  while(!race.cars.every(c=>topReady(c.cls,c.livree))){if(Date.now()>limit)throw Error('Sprites timeout');await new Promise(r=>setTimeout(r,40));}
  race.state='racing';race.time=35;race.countdown=0;
  const at=(shot.at==null?.12:shot.at)*T.length;
  race.cars.forEach((c,i)=>{
    c.place(T.wrap(at+(race.cars.length-1-i)*7),((i%3)-1)*T.halfWidth*.36,18);
    if(shot.mode==='timetrial')c.place(c.s,T.targetLat(c.s,0),22);
    c.started=true;c.lap=0;c.lapStart=0;c.state='ok';
  });
  if(shot.action==='finish')race.cars.forEach(c=>{c.lap=shot.mode==='timetrial'?0:race.laps-1;c.checkpoint=true;});
  const p=race.player;
  if(shot.action==='overtake'){
    p.place(at,T.targetLat(at,0),32);
    const other=race.cars.find(c=>c!==p);other.place(at+4,T.targetLat(at+4,1),14);
    other.sel=other.selS=1;other.gridLat=T.targetLat(at+4,1);
  }
  const initialPosition=race.standings().indexOf(p)+1;

  if(['wide','spin','barrier'].includes(shot.action)){
    if(shot.action==='spin'){p.state='grass';p.accroche=false;p.vl=14;p.w=2;p.th+=.65;}
    if(shot.action==='wide'){p.place(p.s,T.hwLeftAt(p.s)+1,32);p.state='grass';p.vl=8;p.accroche=false;}
    if(shot.action==='barrier'){
      // Start outside the lane with outward velocity: normal collision code decides the impact.
      p.place(p.s,T.hwLeftAt(p.s)+2,24);p.state='grass';p.accroche=false;p.vl=20;
    }
  }
  if(shot.tile)app.renderer.hudCanvas.style.visibility='hidden';
  app.renderer.rotate=false;app.renderer.cam.init=false;
  if(app.spectator){app.spectator.mode=shot.view;app.spectator.root.querySelector('select').value=shot.view;app.spectator.index=race.cars.indexOf(p);}
  window.trailerEvents={offroad:0,spin:0,crash:0,finish:0,frames:0,maxSlip:0,mode:race.mode,cars:race.cars.length,initialPosition,bestPosition:initialPosition,lap:0,trackName:T.def.name};
  window.trailerTick=(dt,t)=>{
    const steps=Math.max(1,Math.round(dt*120)),h=dt/steps;
    for(let k=0;k<steps;k++){
      let throttle=aiThrottle(p,race.cars,h,race.difficulty);
      if(shot.action==='line'&&shot.mode!=='timetrial'&&t>2&&t<4)throttle=1;
      if(['wide','barrier','spin'].includes(shot.action))throttle=t<.7?1:0;
      app.input.throttle=throttle;race.update(h,throttle);
      for(const ev of race.events)if(ev.type in trailerEvents)trailerEvents[ev.type]++;
      race.events.length=0;
    }
    if(p.state==='grass')trailerEvents.offroad++;
    if(Math.abs(p.beta)>1)trailerEvents.spin++;
    trailerEvents.bestPosition=Math.min(trailerEvents.bestPosition,race.standings().indexOf(p)+1);
    trailerEvents.frames++;trailerEvents.maxSlip=Math.max(trailerEvents.maxSlip,Math.abs(p.beta));
    if(app.spectator)app.spectator.update(dt);
    else {
      // North-up tracking, wide enough to anticipate the bend and see the pack.
      const heading=T.headingAt(p.s),lead=8;
      app.renderer.cam.x=p.x+Math.cos(heading)*lead;app.renderer.cam.y=p.y+Math.sin(heading)*lead;
      app.renderer.cam.zoom=Math.min(innerWidth,innerHeight)/(shot.tile?65:85);
      app.renderer.cam.init=true;app.renderer.camAngle=0;
    }
    app.renderer.addEffects(race,dt);app.renderer.draw(race,app.ui);
  };
  trailerTick(1/60,0);
};
