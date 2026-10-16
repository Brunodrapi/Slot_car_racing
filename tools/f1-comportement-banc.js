// Deterministic F1 driving study: full laps plus identical-state throttle replays.
// node tools/f1-comportement-banc.js --out=/tmp/f1-before.json --workers=3
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {Worker,isMainThread,parentPort}=require('node:worker_threads');
function contextFor() {
 const math=Object.create(Math),c=vm.createContext({Math:math,console,Date});
 const src=['util','traces','tracks','track','cars','car','race'].map(f=>fs.readFileSync(path.join(__dirname,'../js',f+'.js'),'utf8').replace(/if \(typeof module[^\n]*\n/g,'').replace(/'use strict';/g,'')).join('\n');
 vm.runInContext(src,c);return c;
}
const RUN=new vm.Script(`(()=>{
 let seed=42761;const reset=()=>{seed=42761;Math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};};reset();
 const opts={trackDef:TRACKS.find(t=>t.id===JOB.track),classId:'gt',modelId:JOB.car,difficulty:'medium',playerAI:true,nCars:1,mode:'timetrial'};
 const make=()=>{const r=new Race(opts);r.poseFrein(JOB.brake);return r;};
 const r=make(),p=r.player,bands=[null,null,null],hist=new Uint32Array(181);
 let maxV=0,off=0,n=0,slip=0,gasN=0,changes=0,prev=false;
 while(p.lap<2&&r.time<440){
  const gas=aiThrottle(p,r.cars,r.dt,{marginBase:JOB.margin,marginSpread:0});r.update(r.dt,gas);
  if(r.state!=='racing')continue;
  if(![p.v,p.vl,p.x,p.y,p.w,p.glisseArr].every(Number.isFinite))throw Error('Nonfinite '+JOB.car);
  n++;if(gas)gasN++;if(gas!==prev)changes++;prev=gas;
  maxV=Math.max(maxV,p.v);slip+=p.glisseArr;if(p.state==='grass')off+=r.dt;
  hist[Math.min(180,Math.floor(Math.abs(p.beta)*180/Math.PI))]++;
  if(p.state==='ok'&&p.v>15&&gas){
   const rear=Math.abs(p.alphaR)/p.cls.slipPeak,b=rear<.6?0:rear<.85?1:2;
   if(!bands[b]||rear>bands[b].rear){const state={};for(const k of Object.keys(p))if(p[k]===null||['number','boolean','string'].includes(typeof p[k]))state[k]=p[k];bands[b]={band:b,rear,state,time:r.time};}
  }
 }
 let total=hist.reduce((a,b)=>a+b,0),sum=0,beta95=0;for(let i=0;i<hist.length;i++){sum+=hist[i];if(sum>=total*.95){beta95=i;break;}}
 const replay=[];
 // Same state for lift, held throttle and 60/120 ms on/off pulses.
 if(JOB.margin===.95)for(const snap of bands.filter(Boolean))for(const ms of [0,-1,60,120]){
  reset();const rr=make(),c=rr.player;Object.assign(c,snap.state);rr.state='racing';rr.time=snap.time;rr.acc=0;
  let beta=0,glisse=0,offT=0;
  for(let i=0;i<144;i++){const gas=ms<0||ms>0&&Math.floor(i/(ms/1000*120))%2===0;rr.update(rr.dt,gas);if(![c.x,c.y,c.v,c.beta].every(Number.isFinite))throw Error('Nonfinite replay');beta=Math.max(beta,Math.abs(c.beta)*180/Math.PI);glisse+=c.glisseArr;if(c.state==='grass')offT+=rr.dt;}
  replay.push({band:snap.band,rear:snap.rear,ms,dv:c.v-snap.state.v,beta,glisse:glisse/144,off:offT});
 }
 return {...JOB,completed:p.lap>=2,laps:p.lap,best:p.bestLap,raw:p.bestLapBrut,clean:p.lapOk.filter(Boolean).length,crashes:p.crashes,barrierHits:p.barrierHits,offSeconds:off,beta95,maxKmh:maxV*3.6,glisse:n?slip/n:0,gasPct:n?100*gasN/n:0,changesPerMinute:changes/Math.max(r.time,1)*60,replay};
})()`);
if(!isMainThread){const c=contextFor('live');parentPort.on('message',job=>{if(!job){parentPort.close();return;}c.JOB=job;parentPort.postMessage(RUN.runInContext(c,{timeout:120000}));});}
else if(require.main===module){
 const arg=(name,d)=>process.argv.find(x=>x.startsWith('--'+name+'='))?.slice(name.length+3)||d;
 const cars=arg('cars','tyrrellp34,ferrari312t,mclarenm23,lotus79,m1procar,f40').split(','),tracks=arg('tracks','monaco,spa,monza,zandvoort').split(','),brakes=arg('brakes','.75,1,1.3').split(',').map(Number),margins=arg('margins','.95,1.05').split(',').map(Number);
 const jobs=[];for(const car of cars)for(const track of tracks)for(const brake of car==='m1procar'||car==='f40'?[1]:brakes)for(const margin of margins)jobs.push({car,track,brake,margin});
 let next=0;const rows=[];const active=new Set();
 Promise.all(Array.from({length:Math.min(+arg('workers','3'),jobs.length)},()=>new Promise((resolve,reject)=>{const w=new Worker(__filename);active.add(w);const send=()=>w.postMessage(next<jobs.length?jobs[next++]:null);w.on('message',row=>{rows.push(row);if(rows.length%16===0)console.log(rows.length+'/'+jobs.length);send();});w.on('error',e=>{for(const t of active)t.terminate();reject(e);});w.on('exit',code=>{active.delete(w);code===0?resolve():reject(Error('worker '+code));});send();}))).then(()=>{
  rows.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));const out=path.resolve(arg('out','/tmp/f1-comportement.json'));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({conditions:{seed:42761,tracks,cars,brakes,margins,laps:2,replaySeconds:1.2,dt:1/120},rows},null,2)+'\n');console.log(out);for(const car of cars){const r=rows.filter(r=>r.car===car&&r.brake===1&&r.margin===.95);console.log(car,JSON.stringify(r.map(x=>({track:x.track,best:x.best,crashes:x.crashes,beta95:x.beta95,off:x.offSeconds}))));}
 }).catch(e=>{console.error(e);process.exitCode=1;});
}
