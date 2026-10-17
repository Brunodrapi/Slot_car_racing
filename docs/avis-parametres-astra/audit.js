'use strict';
const fs=require('fs'),vm=require('vm'),cp=require('child_process');
const {Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const ROOT=require('node:path').resolve(__dirname,'../..');
function context(ref){const c=vm.createContext({Math:Object.create(Math),console});const src=['util','traces','tracks','track','cars','car','race'].map(f=>cp.execFileSync('git',['show',ref+':js/'+f+'.js'],{cwd:ROOT,encoding:'utf8',maxBuffer:8e6}).replace(/if \(typeof module[^\n]*\n/g,'').replace(/'use strict';/g,'')).join('\n').replace('// grass and gravel drag the whole car,','this._drive=throttle?acc:0; this._demand=accDem; // grass and gravel drag the whole car,');vm.runInContext(src+'\nthis.G={MODELS,TRACKS,CATEGORIES};',c);return c;}
const RUN=`(()=>{
let seed=JOB.seed;Math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
const opts={trackDef:TRACKS.find(t=>t.id===JOB.track),modelId:JOB.car,playerAI:true,nCars:1,mode:'timetrial'};
const r=new Race(opts),p=r.player;let snap=null,off=0,maxBeta=0,maxKmh=0,hist=Array(91).fill(0),gasS=0,glisseS=0;
while(p.lap<2&&r.time<500){let gas=aiThrottle(p,r.cars,r.dt,{marginBase:JOB.margin,marginSpread:0,maxMargin:JOB.maxMargin||.98});r.update(r.dt,gas);if(r.state!=='racing')continue;
const beta=Math.abs(p.beta)*180/Math.PI;maxBeta=Math.max(maxBeta,beta);maxKmh=Math.max(maxKmh,p.v*3.6);if(p.v>10)hist[Math.min(90,Math.floor(beta))]++;
if(p.state==='grass')off+=r.dt;if(gas)gasS+=r.dt;glisseS+=p.glisseArr*r.dt;
if(!snap&&p.state==='ok'&&p.v>15&&gas&&Math.abs(p.alphaR)/p.cls.slipPeak>=.9){const state={};for(const k of Object.keys(p))if(p[k]===null||['number','boolean','string'].includes(typeof p[k]))state[k]=p[k];snap={state,time:r.time};}
}
const pulses=[];
if(JOB.pulses&&snap) for(const brake of [.5,1,1.6]) for(const ms of [0,50,100,150,-1]){
const q=new Race(opts);Object.assign(q.player,snap.state);q.state='racing';q.time=snap.time;q.acc=0;q.poseFrein(brake);const v=q.player;let mb=0,mo=0,dr=0,sl=0,mw=0,gasTime=0,heading=0;
for(let i=0;i<144;i++){const gas=ms===0||ms>0&&Math.floor(i/(ms*.12))%2===0;q.update(q.dt,gas);if(gas)gasTime+=q.dt;mb=Math.max(mb,Math.abs(v.beta)*180/Math.PI);mw=Math.max(mw,Math.abs(v.w));if(v.state==='grass')mo+=q.dt;dr+=v._drive*q.dt;sl+=v.glisseArr*q.dt;heading+=v.w*q.dt;}
pulses.push({brake,ms,gasTime,initialV:snap.state.v,initialBeta:Math.abs(snap.state.beta)*180/Math.PI,initialS:snap.state.s,maxBeta:mb,finalBeta:Math.abs(v.beta)*180/Math.PI,deltaV:v.v-snap.state.v,driveImpulse:dr,avgGlisse:sl/1.2,off:mo,crashes:v.crashes-snap.state.crashes,heading,maxYaw:mw,distance:q.track.diff(snap.state.s,v.s)});
}
let total=hist.reduce((a,b)=>a+b,0),cum=0,beta95=0;for(let i=0;i<hist.length;i++){cum+=hist[i];if(cum>=.95*total){beta95=i;break;}}
return {...JOB,lap:p.lap,brut:p.bestLapBrut,clean:p.bestLap,crashes:p.crashes,off,maxBeta,beta95,maxKmh,gasS,avgGlisse:glisseS/r.time,pulses};})()`;
if(!isMainThread){const cs={};const run=new vm.Script(RUN);parentPort.on('message',j=>{if(!j){parentPort.close();return;}const c=cs[j.ref]||(cs[j.ref]=context(j.ref));c.JOB=j;parentPort.postMessage(run.runInContext(c,{timeout:300000}));});}
else {const now=context('b81ac17').G,old=context('7e14617').G,jobs=[];for(const ref of ['b81ac17','7e14617']){const mods=ref==='b81ac17'?now.MODELS:old.MODELS;const tracks=ref==='b81ac17'?['monaco','laguna','nurburgring','bathurst','redbullring','castellet','monza','suzuka','zandvoort']:['monza','suzuka','zandvoort'];for(const m of mods.filter(m=>!m.custom))for(const track of tracks)jobs.push({ref,car:m.id,track,seed:42761,margin:.95,pulses:['monza','suzuka','zandvoort'].includes(track)});}
let next=0;const rows=[];Promise.all(Array.from({length:4},()=>new Promise((ok,ko)=>{const w=new Worker(__filename);const send=()=>w.postMessage(next<jobs.length?jobs[next++]:null);w.on('message',r=>{rows.push(r);fs.writeFileSync(process.argv[2] || require('node:path').join(__dirname,'resultats.json'),JSON.stringify({jobs:jobs.length,rows:rows.slice().sort((a,b)=>(a.ref+'|'+a.car+'|'+a.track).localeCompare(b.ref+'|'+b.car+'|'+b.track))},null,1));if(rows.length%10===0)console.log(rows.length+'/'+jobs.length);send();});w.on('error',ko);w.on('exit',c=>c?ko(Error(c)):ok());send();}))).then(()=>console.log('Done '+rows.length));}
