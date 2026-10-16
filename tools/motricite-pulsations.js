// Rejoue les mêmes états de virage avec des pulsations de 50, 100 et 150 ms.
// node tools/motricite-pulsations.js [docs/motricite/pulsations.json]
'use strict';
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const {contextFor}=require('./motricite-banc.js');
const base=contextFor('current');
const snapshots=vm.runInContext(`
(() => {
 const out=[];
 for(const model of modelsOf('gt')) for(const tid of ['monaco','spa','monza','zandvoort']) {
  let seed=42761;
  Math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
  const r=new Race({trackDef:TRACKS.find(t=>t.id===tid),classId:'gt',modelId:model.id,playerAI:true,mode:'timetrial',nCars:1});
  const p=r.player;let best=null;
  while(p.lap<1 && r.time<250) {
   const gas=aiThrottle(p,r.cars,r.dt,{marginBase:.95,marginSpread:0});
   r.update(r.dt,gas);
   if(r.state!=='racing'||p.state!=='ok'||p.v<15||!gas)continue;
   const rear=Math.abs(p.alphaR)/p.cls.slipPeak;
   if(!best||rear>best.rear){
    const state={};for(const k of Object.keys(p))if(p[k]===null||['number','boolean','string'].includes(typeof p[k]))state[k]=p[k];
    best={car:model.id,track:tid,time:r.time,rear,state};
   }
   if(rear>=.95)break;
  }
  if(!best)throw Error('Aucun virage mesurable '+model.id+' '+tid);
  out.push(best);
 }
 return out;
})()`,base,{timeout:120000});
const rows=[];
const run=new vm.Script(`
(() => {
 let seed=42761;Math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
 const r=new Race({trackDef:TRACKS.find(t=>t.id===SNAP.track),classId:'gt',modelId:SNAP.car,playerAI:true,mode:'timetrial',nCars:1});
 const p=r.player;Object.assign(p,SNAP.state);r.state='racing';r.time=SNAP.time;r.acc=0;
 let impulse=0,firstPush=0,gasTime=0,maxBeta=0,off=0;
 for(let i=0;i<144;i++) {
  const gas=PULSE===0||PULSE>0&&Math.floor(i/(PULSE/1000*120))%2===0;
  r.update(r.dt,gas);
  if(![p.x,p.v,p.vl,p.w,p._traction.drive].every(Number.isFinite))throw Error('État non fini');
  impulse+=p._traction.drive*r.dt;if(i<6)firstPush+=p._traction.drive*r.dt;
  if(gas)gasTime+=r.dt;
  maxBeta=Math.max(maxBeta,Math.abs(p.beta)*180/Math.PI);
  if(p.state==='grass')off+=r.dt;
 }
 return {factor:FACTOR,car:SNAP.car,track:SNAP.track,pulseMs:PULSE,initialRear:SNAP.rear,
  initialV:SNAP.state.v,initialBeta:Math.abs(SNAP.state.beta)*180/Math.PI,
  finalBeta:Math.abs(p.beta)*180/Math.PI,maxBeta,deltaV:p.v-SNAP.state.v,
  driveImpulse:impulse,first50msPush:firstPush,gasTime,offSeconds:off,newCrashes:p.crashes-SNAP.state.crashes};
})()`);
for(const factor of ['current','0.15','0.25','0.35','0.45','0.55']){
 const context=contextFor(factor);context.FACTOR=factor;
 for(const snap of snapshots)for(const ms of [0,50,100,150,-1]){
  context.SNAP=snap;context.PULSE=ms;rows.push(run.runInContext(context));
 }
 console.log(factor+': '+snapshots.length+' états × 5 commandes');
}
const out=path.resolve(process.argv[2]||'/tmp/motricite-pulsations.json');
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify({duration:1.2,note:'Entrées injectées à 120 Hz, sans navigateur ; 50 % de temps enfoncé pour les trois rythmes.',snapshots,rows},null,2)+'\n');
console.log(out);
