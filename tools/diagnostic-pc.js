'use strict';
const frame=document.querySelector('#game'),by=id=>document.getElementById(id);
let win,app,renderer,mode='normal',samples=[],draws=[],last=0,elapsed=0,active=false,history=[];
let savedDpr,savedDetail,auto=null,cacheStart={};
const sequence=['normal','objects','textures','tyres','barriers','all','rubber','cache','cacheAll','normal'];
function downloadReport(){
 const data={diagnosticVersion:'forest-scale-3',date:new Date().toISOString(),automatic:auto?{status:auto.status,sequence,warmupLaps:1,followedCar:0}:null,note:'Live frame intervals; no GPU readback. Manual or automatic AI spectator laps. Hidden tab excluded and automatic simulation suspended. Different laps are not identical replay.',results:[...history,...(active&&samples.length&&(!auto||auto.index>=0)?[stats()]:[])]};
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='grip-diagnostic-pc.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function autoNext(){
 if(!auto||auto.status!=='running')return;
 const lap=app.race.cars[0].lap;
 if(app.race.time-auto.since>300){save();auto.status='incomplete';active=false;by('status').textContent='Essai interrompu : tour trop long. Rapport partiel exporté.';downloadReport();return;}
 if(lap<=auto.lap)return;
 save();auto.lap=lap;auto.since=app.race.time;auto.index++;
 if(auto.index>=sequence.length){auto.status='complete';active=false;app.state='paused';by('status').textContent='Terminé — rapport téléchargé. Le bouton Exporter reste disponible.';downloadReport();return;}
 mode=sequence[auto.index];by('mode').value=mode;renderer.testBarrierCache=mode==='cache';renderer.testSceneCache=mode==='cacheAll';if(mode==='cacheAll')renderer.resetBarrierCache();else if(mode==='cache')renderer.resetSceneCache();reset();
 by('status').textContent=`Tour mesuré ${auto.index+1}/${sequence.length} : ${by('mode').selectedOptions[0].text}`;
}
function reset(){samples=[];draws=[];last=0;elapsed=0;active=true;cacheStart={...renderer?.barrierCacheStats};}
function stats(){
 const sorted=samples.slice().sort((a,b)=>a-b),q=p=>sorted.length?+sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))].toFixed(2):null;
 return {mode,automatic:!!auto,stage:auto?.index,lapStart:auto?.lap,measuredMs:elapsed,cacheDelta:{created:(renderer.barrierCacheStats?.created||0)-(cacheStart.created||0),evicted:(renderer.barrierCacheStats?.evicted||0)-(cacheStart.evicted||0)},frames:samples.length,medianMs:q(.5),p95Ms:q(.95),p99Ms:q(.99),over25ms:samples.filter(n=>n>25).length,over50ms:samples.filter(n=>n>50).length,meanDrawSubmissionMs:draws.length?+(draws.reduce((a,b)=>a+b,0)/draws.length).toFixed(2):null,viewport:{width:win.innerWidth,height:win.innerHeight,dpr:win.devicePixelRatio,renderDpr:renderer.dpr},detail:renderer.detail,track:app.race?.track.def.id,view:renderer.view,sceneCache:{...renderer.sceneCacheStats},cache:{...renderer.barrierCacheStats},userAgent:navigator.userAgent};
}
function save(){if(active&&samples.length&&(!auto||auto.index>=0))history.push(stats());active=false;}
function choose(value){save();mode=value;renderer.testBarrierCache=mode==='cache';renderer.testSceneCache=mode==='cacheAll';if(mode==='cacheAll')renderer.resetBarrierCache();else if(mode==='cache')renderer.resetSceneCache();reset();frame.contentWindow.focus();}
async function setup(){
 win=frame.contentWindow;
 if(!win.app?.renderer){setTimeout(setup,100);return;}
 // Read lexical channel from inside the game. Production never receives this tool.
 if(win.eval('APP_CANAL')!=='recette'){by('status').textContent='Outil réservé à la recette.';return;}
 app=win.app;renderer=app.renderer;savedDpr=renderer.dpr;savedDetail=renderer.detail;
 const script=win.document.createElement('script');script.src='tools/barrier-cache-prototype.js';
 await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=reject;win.document.head.append(script);});
 win.installBarrierCachePrototype(renderer);
 const sceneScript=win.document.createElement('script');sceneScript.src='tools/scene-cache-prototype.js?v=forest-scale-3';
 await new Promise((resolve,reject)=>{sceneScript.onload=resolve;sceneScript.onerror=reject;win.document.head.append(sceneScript);});
 win.installSceneCachePrototype(renderer);
 const track=renderer.setTrack;
 renderer.setTrack=function(...args){this.resetBarrierCache();this.resetSceneCache();return track.apply(this,args);};
 const objectMethods=['_drawTopProps','_drawImplantation','_drawImplantationSol','_drawTas'];
 for(const name of [...objectMethods,'_drawBarriers','_drawRubber']){
  const original=renderer[name];renderer[name]=function(...args){
   if((objectMethods.includes(name)&&['objects','all'].includes(mode))||(name==='_drawBarriers'&&['barriers','all'].includes(mode))||(name==='_drawRubber'&&mode==='rubber'))return;
   if(name==='_drawBarriers'&&mode==='tyres'){
    const g=args[0],stroke=g.stroke;
    g.stroke=function(...a){const dash=this.getLineDash();if(dash.length===2&&dash[0]===0&&Math.abs(dash[1]-.82)<.001)return;return stroke.apply(this,a);};
    try{return original.apply(this,args);}finally{g.stroke=stroke;}
   }
   return original.apply(this,args);
  };
 }
 const draw=renderer.draw;
 renderer.draw=function(...args){
  if(auto&&auto.status!=='running')return;
  this.prepareSceneCache();
  const cg=this.circuitGraphics;
  if(cg&&!cg._pcTest){cg._pcTest=true;for(const name of ['drawRoad','drawGravel','drawRunoff','drawTerrain']){const f=cg[name];cg[name]=function(...args){if(['textures','all'].includes(mode))return;return f.apply(this,args);};}}
  const now=performance.now(),measuring=active&&app.state==='race'&&['racing','finishing'].includes(app.race?.state)&&!document.hidden;
  if(measuring){if(last){samples.push(now-last);elapsed+=now-last;}last=now;}else last=0;
  const result=draw.apply(this,args);
  if(measuring)draws.push(performance.now()-now);
  // No pixel readback: frame intervals measure the live browser loop, draw time is submission only.
  if(!auto&&samples.length&&elapsed>=30000&&active)save();
  if(auto)autoNext();
  return result;
 };
 renderer.autoRes=false;renderer.dpr=savedDpr;renderer.detail=savedDetail;
 by('status').textContent='Prêt · rendu réel dans ton navigateur';
 for(const id of ['auto','start','track','mode','reset','export'])by(id).disabled=false;
 by('start').onclick=()=>{
  save();auto=null;for(const id of ['mode','track','reset'])by(id).disabled=false;app.mondial=null;app.analytics.begin=()=>{};app.analytics.observe=()=>{};
  app.save.difficulty='extreme';app.save.laps=20;app.save.sound=false;app.audio.setEnabled(false);
  app.startQuick('race','gt',by('track').value);renderer.setView('avanceFixe');renderer.autoRes=false;renderer.dpr=savedDpr;renderer.detail=savedDetail;renderer.resize();reset();win.focus();
 };
 by('auto').onclick=()=>{
  save();history=[];app.mondial=null;app.analytics.begin=()=>{};app.analytics.observe=()=>{};app.audio.setEnabled(false);app.save.sound=false;
  const trackId=by('track').value;
  renderer.setView('avanceFixe');
  app._startRace({mode:'race',trackDef:app.trackDefById(trackId),classId:'gt',modelId:'f40',nCars:10,laps:999,difficulty:'extreme',wear:false,spectator:true},{mode:'race',spectator:true});
  for(const car of app.race.cars){car.isPlayer=false;car.human=null;car.gripBoost=app.race.difficulty.grip||1;}
  app.race.player=app.race.cars[0];
  const spectator=app.spectator,update=spectator.update.bind(spectator);
  spectator.mode='follow';spectator.index=0;spectator.rotation=false;spectator.root.querySelector('select').value='follow';
  spectator.root.style.pointerEvents='none';
  spectator.update=function(dt){
   if(document.hidden){last=0;return;}
   if(auto?.status==='running')app.race.update(dt,0);
   this.mode='follow';this.index=0;update(dt);
   renderer.rotate=false;renderer.updateCamera(app.race,dt);
  };
  mode='normal';by('mode').value=mode;renderer.testBarrierCache=false;renderer.testSceneCache=false;
  auto={status:'running',index:-1,lap:app.race.cars[0].lap,since:app.race.time};reset();
  renderer.autoRes=false;renderer.dpr=savedDpr;renderer.detail=savedDetail;renderer.resize();
  for(const id of ['mode','track','reset'])by(id).disabled=true;
  by('status').textContent='Tour de chauffe — suivi automatique, aucune commande nécessaire.';win.focus();
 };
 by('mode').onchange=e=>choose(e.target.value);
 by('reset').onclick=()=>{save();reset();win.focus();};
 by('export').onclick=downloadReport;
 function refreshPanel(){
  const s=stats(),race=app.race,car=race?.cars[0];
  let phase=active?'Mesure en cours':'Mesure terminée';
  if(auto?.status==='running'){
   const pct=car?Math.max(0,Math.min(100,Math.floor(race.track.wrap(car.s)/race.track.length*100))):0;
   const seconds=Math.floor((race?.time||0)-auto.since);
   if(document.hidden)phase='Suspendu : onglet masqué';
   else if(app.state==='paused')phase='En pause — reprendre la course';
   else if(race?.state==='countdown')phase=race.attente?'Chargement des voitures…':'Départ dans '+Math.ceil(race.countdown)+' s';
   else if(auto.index<0)phase=`Tour de chauffe · ${pct} % du circuit · ${seconds} s`;
   else phase=`Tour mesuré ${auto.index+1}/${sequence.length} · ${pct} % · ${seconds} s · ${by('mode').selectedOptions[0].text}`;
   by('status').textContent=phase;
  }
  const warm=auto?.status==='running'&&auto.index<0;
  by('stats').textContent=`${win.innerWidth} × ${win.innerHeight} · DPR ${renderer.dpr}
${phase}
${s.frames} images observées${warm?' (chauffe, exclues du rapport)':''}
Médiane ${s.medianMs??'—'} ms · p95 ${s.p95Ms??'—'} ms
Images >25 ms : ${s.over25ms} · >50 ms : ${s.over50ms}
${history.length}/${auto?sequence.length:'—'} mesures enregistrées`;
  document.querySelector('summary').textContent=auto?.status==='running'?`Diagnostic · ${auto.index<0?'chauffe':`${auto.index+1}/${sequence.length}`} · ${s.frames} images`:'Diagnostic PC · RECETTE';
 }
 setInterval(refreshPanel,500);

}
frame.addEventListener('load',()=>setup().catch(e=>{by('status').textContent='Erreur : '+e.message;}));
