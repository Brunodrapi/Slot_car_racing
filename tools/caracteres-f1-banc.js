// Validation ciblée : BT46B lente et stable, RS10 progressive puis plus vigoureuse.
// node tools/caracteres-f1-banc.js --out=/tmp/caracteres-f1.json [--final]
// La référence est le build 0.30.2 ; les essais chargent le code de travail sans l'éditer.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const {Worker,isMainThread,parentPort}=require('node:worker_threads');
const ROOT=path.resolve(__dirname,'..');
const CANDIDATES={
  modere:{brabhambt46b:{mul:{grip:1.065,df:.58}},renaultrs10:{mul:{slide:1.06},driveCurve:{low:.84,high:1.18,from:80/3.6,to:200/3.6}}},
  marque:{brabhambt46b:{mul:{grip:1.075,df:.55}},renaultrs10:{mul:{slide:1.06},driveCurve:{low:.82,high:1.22,from:70/3.6,to:200/3.6}}},
  progressif:{brabhambt46b:{mul:{grip:1.065,df:.58}},renaultrs10:{mul:{slide:1.06},driveCurve:{low:.94,high:1.20,from:80/3.6,to:200/3.6}}},
  vif:{brabhambt46b:{mul:{grip:1.065,df:.58}},renaultrs10:{mul:{slide:1.06},driveCurve:{low:.92,high:1.20,from:60/3.6,to:170/3.6}}},
  stable104:{renaultrs10:{mul:{slide:1.04}}},
  stable102:{renaultrs10:{mul:{slide:1.02}}},
};
function context(scenario) {
  const c=vm.createContext({Math:Object.create(Math),console});
  const src=['util','traces','tracks','track','cars','car','race'].map(f=>{
    const s=scenario==='avant'?cp.execFileSync('git',['show','9132dd0:js/'+f+'.js'],{cwd:ROOT,encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(path.join(ROOT,'js',f+'.js'),'utf8');
    return s.replace(/if \(typeof module[^\n]*\n/g,'').replace(/'use strict';/g,'');
  }).join('\n');
  vm.runInContext(src,c);
  if(CANDIDATES[scenario]) {
    c.TUNE=CANDIDATES[scenario];
    vm.runInContext(`for(const cat of CATEGORIES)for(const m of cat.models){const p=TUNE[m.id];if(p){if(p.mul)Object.assign(m.mul,p.mul);if(p.driveCurve)m.driveCurve=p.driveCurve;}}
    MODELS.length=0;for(const cat of CATEGORIES)for(const m of cat.models)MODELS.push(resolveModel(cat,m));`,c);
  }
  return c;
}
const RUN=new vm.Script(`(()=>{
  let seed=JOB.seed;Math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
  const opts={trackDef:TRACKS.find(t=>t.id===JOB.track),modelId:JOB.car,playerAI:true,nCars:1,mode:'timetrial'};
  const r=new Race(opts),p=r.player,hist=new Uint32Array(91);r.poseFrein(JOB.brake);
  let snap=null,maxKmh=0,off=0,n=0;
  while(p.lap<2&&r.time<500){
    const gas=aiThrottle(p,r.cars,r.dt,{marginBase:.95,marginSpread:0});r.update(r.dt,gas);
    if(r.state!=='racing')continue;
    if(![p.x,p.y,p.v,p.w,p.beta,p.glisseArr].every(Number.isFinite))throw Error('État non fini');
    maxKmh=Math.max(maxKmh,p.v*3.6);if(p.state==='grass')off+=r.dt;
    if(p.v>10){hist[Math.min(90,Math.floor(Math.abs(p.beta)*180/Math.PI))]++;n++;}
    if(!snap&&gas&&p.state==='ok'&&p.v>15&&Math.abs(p.alphaR)/p.cls.slipPeak>=.9){
      const state={};for(const k of Object.keys(p))if(p[k]===null||['number','boolean','string'].includes(typeof p[k]))state[k]=p[k];snap={state,time:r.time};
    }
  }
  let sum=0,beta95=0;for(let i=0;i<hist.length;i++){sum+=hist[i];if(sum>=n*.95){beta95=i;break;}}
  const replay=[];
  if(snap)for(const brake of [.75,1,1.3])for(const ms of [-1,0,60,120]){
    const q=new Race(opts),v=q.player;Object.assign(v,snap.state);q.state='racing';q.time=snap.time;q.acc=0;q.poseFrein(brake);
    let peak=0,away=0;
    for(let i=0;i<144;i++){
      const gas=ms<0||ms>0&&Math.floor(i/(ms*.12))%2===0;q.update(q.dt,gas);
      if(![v.x,v.y,v.v,v.beta].every(Number.isFinite))throw Error('Reprise non finie');
      peak=Math.max(peak,Math.abs(v.beta)*180/Math.PI);if(v.state==='grass')away+=q.dt;
    }
    replay.push({brake,ms,initialS:snap.state.s,initialSpeed:snap.state.v,peakBeta:peak,deltaV:v.v-snap.state.v,off:away,crashes:v.crashes-snap.state.crashes});
  }
  return {...JOB,laps:p.lap,best:p.bestLap,raw:p.bestLapBrut,crashes:p.crashes,barrierHits:p.barrierHits,off,beta95,maxKmh,replay};
})()`);
if(!isMainThread){
  const contexts={};parentPort.on('message',job=>{if(!job){parentPort.close();return;}const c=contexts[job.scenario]||(contexts[job.scenario]=context(job.scenario));c.JOB=job;parentPort.postMessage(RUN.runInContext(c,{timeout:180000}));});
}else if(require.main===module){
  const final=process.argv.includes('--final');
  const arg=(key,fallback)=>(process.argv.find(a=>a.startsWith('--'+key+'='))||'--'+key+'='+fallback).slice(key.length+3);
  const tracks=arg('tracks','monaco,spa,monza,zandvoort,castellet').split(',');
  const seeds=arg('seeds',final?'42761,27183':'42761').split(',').map(Number);
  const brakes=arg('brakes',final?'.75,1,1.3':'1').split(',').map(Number);
  const jobs=[],cars=arg('cars','brabhambt46b,renaultrs10,ferrari312t,lotus79').split(',');
  const scenarios=arg('scenarios',final?'apres':'avant,modere,marque').split(',');
  for(const scenario of scenarios)for(const car of scenario==='avant'?cars:cars.filter(id=>['brabhambt46b','renaultrs10'].includes(id)))for(const track of tracks)
    for(const seed of seeds)for(const brake of brakes)jobs.push({scenario,car,track,seed,brake});
  const rows=[];let next=0;
  const output=(process.argv.find(a=>a.startsWith('--out='))||'--out=/tmp/caracteres-f1.json').slice(6);
  Promise.all(Array.from({length:4},()=>new Promise((resolve,reject)=>{
    const w=new Worker(__filename);const send=()=>w.postMessage(next<jobs.length?jobs[next++]:null);
    w.on('message',r=>{rows.push(r);if(rows.length%10===0)console.log(rows.length+'/'+jobs.length);send();});
    w.on('error',reject);w.on('exit',code=>code?reject(Error('worker '+code)):resolve());send();
  }))).then(()=>{
    rows.sort((a,b)=>JSON.stringify([a.scenario,a.car,a.track,a.seed,a.brake]).localeCompare(JSON.stringify([b.scenario,b.car,b.track,b.seed,b.brake])));
    fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({reference:'9132dd0',dt:1/120,laps:2,candidates:final?null:CANDIDATES,rows},null,2)+'\n');
    console.log(output);for(const scenario of [...new Set(rows.map(r=>r.scenario))])for(const car of cars){const rr=rows.filter(r=>r.scenario===scenario&&r.car===car&&r.brake===1);if(rr.length)console.log(scenario,car,JSON.stringify(rr.map(r=>({track:r.track,best:r.best,raw:r.raw,crashes:r.crashes,beta95:r.beta95,maxKmh:r.maxKmh}))));}
  }).catch(e=>{console.error(e);process.exitCode=1;});
}
module.exports={context,CANDIDATES};
