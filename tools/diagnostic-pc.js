'use strict';
const frame=document.querySelector('#game'),by=id=>document.getElementById(id);
let win,app,renderer,mode='normal',samples=[],draws=[],last=0,elapsed=0,active=false,history=[];
let savedDpr,savedDetail;
function reset(){samples=[];draws=[];last=0;elapsed=0;active=true;}
function stats(){
 const sorted=samples.slice().sort((a,b)=>a-b),q=p=>sorted.length?+sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))].toFixed(2):null;
 return {mode,frames:samples.length,medianMs:q(.5),p95Ms:q(.95),p99Ms:q(.99),over25ms:samples.filter(n=>n>25).length,over50ms:samples.filter(n=>n>50).length,meanDrawSubmissionMs:draws.length?+(draws.reduce((a,b)=>a+b,0)/draws.length).toFixed(2):null,viewport:{width:win.innerWidth,height:win.innerHeight,dpr:win.devicePixelRatio,renderDpr:renderer.dpr},detail:renderer.detail,track:app.race?.track.def.id,view:renderer.view,cache:{...renderer.barrierCacheStats},userAgent:navigator.userAgent};
}
function save(){if(samples.length)history.push(stats());}
function choose(value){save();mode=value;renderer.testBarrierCache=mode==='cache';reset();frame.contentWindow.focus();}
async function setup(){
 win=frame.contentWindow;
 if(!win.app?.renderer){setTimeout(setup,100);return;}
 // Read lexical channel from inside the game. Production never receives this tool.
 if(win.eval('APP_CANAL')!=='recette'){by('status').textContent='Outil réservé à la recette.';return;}
 app=win.app;renderer=app.renderer;savedDpr=renderer.dpr;savedDetail=renderer.detail;
 const script=win.document.createElement('script');script.src='tools/barrier-cache-prototype.js';
 await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=reject;win.document.head.append(script);});
 win.installBarrierCachePrototype(renderer);
 const track=renderer.setTrack;
 renderer.setTrack=function(...args){this.resetBarrierCache();return track.apply(this,args);};
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
  const cg=this.circuitGraphics;
  if(cg&&!cg._pcTest){cg._pcTest=true;for(const name of ['drawRoad','drawGravel','drawRunoff','drawTerrain']){const f=cg[name];cg[name]=function(...args){if(['textures','all'].includes(mode))return;return f.apply(this,args);};}}
  const now=performance.now(),measuring=active&&app.state==='race'&&['racing','finishing'].includes(app.race?.state)&&!document.hidden;
  if(measuring){if(last){samples.push(now-last);elapsed+=now-last;}last=now;}else last=0;
  const result=draw.apply(this,args);
  if(measuring)draws.push(performance.now()-now);
  // No pixel readback: frame intervals measure the live browser loop, draw time is submission only.
  if(samples.length&&elapsed>=30000&&active){active=false;save();}
  return result;
 };
 renderer.autoRes=false;renderer.dpr=savedDpr;renderer.detail=savedDetail;
 by('status').textContent='Prêt · rendu réel dans ton navigateur';
 for(const id of ['start','mode','reset','export'])by(id).disabled=false;
 by('start').onclick=()=>{
  save();app.mondial=null;app.analytics.begin=()=>{};app.analytics.observe=()=>{};
  app.save.difficulty='extreme';app.save.laps=20;app.save.sound=false;app.audio.setEnabled(false);
  app.startQuick('race','gt','zandvoort');renderer.setView('avanceFixe');renderer.autoRes=false;renderer.dpr=savedDpr;renderer.detail=savedDetail;renderer.resize();reset();win.focus();
 };
 by('mode').onchange=e=>choose(e.target.value);
 by('reset').onclick=()=>{save();reset();win.focus();};
 by('export').onclick=()=>{
  const data={date:new Date().toISOString(),note:'Live rAF frame intervals, manual driving, no forced pixel readback. Draw times measure command submission only. No claim of GPU timing. Diagnostic overrides only in this iframe.',results:[...history,...(active&&samples.length?[stats()]:[])]};
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='grip-diagnostic-pc.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
 };
 setInterval(()=>{const s=stats();by('stats').textContent=`${win.innerWidth} × ${win.innerHeight} · DPR ${renderer.dpr}\n${s.frames} images · ${active?'mesure en cours':'mesure terminée'}\nMédiane ${s.medianMs??'—'} ms · p95 ${s.p95Ms??'—'} ms\nImages >25 ms : ${s.over25ms} · >50 ms : ${s.over50ms}`;},500);
}
frame.addEventListener('load',()=>setup().catch(e=>{by('status').textContent='Erreur : '+e.message;}));
