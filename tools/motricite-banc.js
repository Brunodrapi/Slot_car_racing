// Comparaison déterministe, sans modifier la physique du jeu.
// node tools/motricite-banc.js --out=docs/motricite/matrice.json
// --factors=current,0.15,0.25,0.35,0.45,0.55 --seeds=42761,20261014
// --margin=0.95 --laps=2 --workers=3 --traffic=1
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const ROOT = path.resolve(__dirname, '..');
const BASELINE = '6b2d2024c9dc8f6964a5a3666027317daf256146';
const sourceCache = new Map();
const FILES = ['util', 'traces', 'tracks', 'track', 'cars', 'car', 'race'];

function reference(f) {
  if (!sourceCache.has(f)) sourceCache.set(f, execFileSync('git', ['show', BASELINE + ':js/' + f + '.js'], {cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024}));
  return sourceCache.get(f);
}

function sourceFor(factor) {
  let src = FILES.map(f => (factor === 'live' ? fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8') : reference(f))
    .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '')).join('\n');
  function swap(a, b) {
    if (!src.includes(a)) throw Error('La physique a changé, adapter le banc : ' + a);
    src = src.replace(a, b);
  }
  if (factor !== 'current' && factor !== 'live') {
    // Conserver exactement le comportement hors piste, y compris l'ancien facteur.
    swap('if (throttle) acc = accReel * Math.max(0.3, 1 - PHYS.circle * u * u);',
      'if (throttle) acc = accReel * (off ? Math.max(0.3, 1 - PHYS.circle * u * u) : 1);');
    swap('const accReel = off ? accDem : Math.min(accDem, longDispo);', `
      const qy = clamp(alphaR / peak, -1, 1);
      const qx = accDem / Math.max(1e-3, gArrBrut * cliffR * PHYS.motricite);
      const share = off ? 1 : 1 / Math.max(1, Math.hypot(qx, qy));
      const priority = ${Number(factor)};
      const safeDrive = Math.min(accDem, longDispo * cliffR);
      const accReel = off ? accDem : safeDrive * (1-priority) + accDem * share * priority;`);
    swap('this.patine = off ? 0 : clamp((accDem - longDispo) / Math.max(1e-3, gArrBrut), 0, 1);',
      'this.patine = off || accDem <= 0 ? 0 : 1 - accReel / Math.max(1e-3, accDem);');
    swap('const gR = gArrBrut * cliffR * (1 - PHYS.patine * this.patine);',
      'const gR = gArrBrut * cliffR * (off ? 1 : 1-priority+priority*share);');
  }
  swap('// grass and gravel drag the whole car,', `
    this._traction = { demand: accDem, drive: throttle ? acc : 0, rear: Math.abs(alphaR)/peak, off };
    // grass and gravel drag the whole car,`);
  return src;
}

function contextFor(factor) {
  const math = Object.create(Math);
  const context = vm.createContext({ Math: math, console, Date });
  vm.runInContext(sourceFor(factor), context);
  return context;
}

// Exporté aussi pour les reprises à états initiaux identiques du banc de pulsations.
const RUN = new vm.Script(`
(() => {
  let seed = JOB.seed;
  Math.random = () => { seed ^= seed<<13; seed ^= seed>>>17; seed ^= seed<<5; return (seed>>>0)/4294967296; };
  const race = new Race({ trackDef: TRACKS.find(t=>t.id===JOB.track), classId:'gt', modelId:JOB.car,
    difficulty:'medium', playerAI:true, playerLivery:0, nCars:JOB.traffic,
    mode: JOB.traffic>1 ? 'race' : 'timetrial', laps:JOB.laps+1 });
  if(race.cars.length !== JOB.traffic) throw Error('Grille incorrecte');
  const p = race.player;
  let gasN=0, cornerN=0, zeroN=0, driveSum=0, offSeconds=0, maxBeta=0, lost=0;
  const betaHist = new Uint32Array(181);
  while(p.lap<JOB.laps && race.time<JOB.laps*250 && race.state!=='finished') {
    const gas=aiThrottle(p,race.cars,race.dt,{marginBase:JOB.margin,marginSpread:0});
    race.update(race.dt,gas);
    const d=p._traction;
    if(race.state!=='racing'||!d)continue;
    if(![p.v,p.vl,p.x,p.y,p.w,d.drive].every(Number.isFinite))throw Error('État non fini');
    const beta=Math.abs(p.beta)*180/Math.PI;
    maxBeta=Math.max(maxBeta,beta);
    betaHist[Math.min(180,Math.floor(beta))]++;
    if(d.off)offSeconds+=race.dt;
    if(beta>45)lost+=race.dt;
    if(gas&&!d.off&&d.demand>0.1) {
      gasN++;
      if(d.rear>0.5){cornerN++;driveSum+=d.drive/d.demand;if(d.drive/d.demand<0.01)zeroN++;}
    }
  }
  let total=betaHist.reduce((s,x)=>s+x,0), n=0, beta95=0;
  for(let i=0;i<betaHist.length;i++){n+=betaHist[i];if(n>=total*.95){beta95=i+1;break;}}
  return {...JOB, carCount:race.cars.length, completed:p.lap>=JOB.laps, lapsDone:p.lap,
    best:p.bestLap, bestRaw:p.bestLapBrut, lapTimes:p.lapTimes, cleanLaps:p.lapOk.filter(Boolean).length,
    crashes:p.crashes, aiCrashes:race.cars.filter(c=>c!==p).reduce((s,c)=>s+c.crashes,0),
    offSeconds,maxBeta,beta95,lostSeconds:lost,gasSeconds:gasN*race.dt,
    cornerGasSeconds:cornerN*race.dt,driveKept:cornerN?driveSum/cornerN:null,
    zeroDrivePct:cornerN?100*zeroN/cornerN:null};
})()
`);

async function main() {
  const arg = (name, fallback) => process.argv.find(x=>x.startsWith('--'+name+'='))?.split('=').slice(1).join('=') ?? fallback;
  const factors=arg('factors','current,0.15,0.25,0.35,0.45,0.55').split(',');
  if(factors.some(x=>x!=='current'&&x!=='live'&&(!Number.isFinite(+x)||+x<0||+x>1)))throw Error('Facteur invalide');
  const seeds=arg('seeds','42761,20261014').split(',').map(Number);
  const margin=+arg('margin','0.95'), laps=+arg('laps','2'), traffic=+arg('traffic','1');
  const tracks=arg('tracks','monaco,spa,monza,zandvoort').split(',');
  const c=contextFor('current');
  const cars=vm.runInContext("modelsOf('gt').map(m=>m.id)",c);
  const jobs=[];
  for(const factor of factors)for(const car of cars)for(const track of tracks)for(const seed of seeds)
    jobs.push({factor,car,track,seed,margin,laps,traffic});
  const rows=[], active=new Set(); let next=0;
  const count=Math.min(+arg('workers','3'),jobs.length);
  await Promise.all(Array.from({length:count},()=>new Promise((resolve,reject)=>{
    const worker=new Worker(__filename,{workerData:true}); active.add(worker);
    const send=()=>{ if(next<jobs.length)worker.postMessage(jobs[next++]);else worker.postMessage(null); };
    worker.on('message',row=>{rows.push(row);if(rows.length%24===0||rows.length===jobs.length)console.log(rows.length+'/'+jobs.length+' essais');send();});
    worker.on('error',e=>{for(const w of active)w.terminate();reject(e);});
    worker.on('exit',code=>{active.delete(worker);code===0?resolve():reject(Error('worker '+code));});send();
  })));
  rows.sort((a,b)=>JSON.stringify([a.factor,a.car,a.track,a.seed]).localeCompare(JSON.stringify([b.factor,b.car,b.track,b.seed])));
  const out=path.resolve(arg('out','/tmp/motricite-matrice.json'));
  fs.mkdirSync(path.dirname(out),{recursive:true});
  const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
  const result={revision,baseline:BASELINE,conditions:{factors,seeds,tracks,cars,margin,laps,traffic},rows};
  fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
  console.log(out);
  for(const factor of factors){const a=rows.filter(x=>x.factor===factor);console.log(factor,JSON.stringify({runs:a.length,unfinished:a.filter(x=>!x.completed).length,noClean:a.filter(x=>x.best===null).length,crashes:a.reduce((s,x)=>s+x.crashes,0),aiCrashes:a.reduce((s,x)=>s+x.aiCrashes,0)}));}
}

if (!isMainThread) {
  const contexts=new Map();
  parentPort.on('message',job=>{
    if(!job){parentPort.close();return;}
    if(!contexts.has(job.factor))contexts.set(job.factor,contextFor(job.factor));
    const c=contexts.get(job.factor);c.JOB=job;
    parentPort.postMessage(RUN.runInContext(c,{timeout:120000}));
  });
} else if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={contextFor,RUN};
