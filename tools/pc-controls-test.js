// Dosage analogique, garde-fous manette et compatibilité physique des boutons existants.
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), cp = require('node:child_process');
const {throttleAmount, mobileDevice, ThrottlePulses} = require('../js/util');
for (const [input, output] of [[true,1],[false,0],[.25,.25],[-1,0],[2,1],[NaN,0],[Infinity,0],[undefined,0]]) assert.equal(throttleAmount(input),output);
const media = fine => q => ({matches:q.includes('hover') ? fine : !fine});
assert.equal(mobileDevice({userAgent:'Windows',maxTouchPoints:10},media(true)),false,'PC tactile');
assert.equal(mobileDevice({userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:5},media(true)),true,'iPad en mode bureau');
assert.equal(mobileDevice({userAgent:'Android'},media(false)),true);
const q = new ThrottlePulses();q.push(10,.25);q.push(40,.75);q.push(70,0);
assert.deepEqual(q.take(0,100,0),[{dt:.01,throttle:false},{dt:.03,throttle:.25},{dt:.03,throttle:.75},{dt:.03,throttle:0}]);
const controlsContext = vm.createContext({console});
vm.runInContext(fs.readFileSync('js/util.js','utf8')+'\n'+fs.readFileSync('js/controls.js','utf8'),controlsContext);
vm.runInContext(`
  var gas=0, lines=[], pauses=0;
  var ctrl=new DesktopControls({throttle:v=>gas=v,line:v=>lines.push(v),pause:()=>{pauses++;ctrl.reset();},activity:()=>{}});
  var pad={index:0,connected:true,mapping:'standard',axes:[0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
  var pads=()=>[pad];
`,controlsContext);
const run = code => vm.runInContext(code,controlsContext);
run(`ctrl.setMode('wheel');ctrl.wheel({deltaY:-100,deltaMode:0})`);assert.equal(run('gas'),.1);
run(`ctrl.wheel({deltaY:-3,deltaMode:1})`);assert.equal(run('gas'),.148);
run(`for(let i=0;i<10;i++)ctrl.wheel({deltaY:-200,deltaMode:0})`);assert.equal(run('gas'),1);
run(`ctrl.brake()`);assert.equal(run('gas'),0);
run(`ctrl.setMode('gamepad');pad.buttons[7].value=1;ctrl.poll(true,pads)`);assert.equal(run('gas'),0,'connexion gâchette enfoncée');
run(`pad.buttons[7].value=0;ctrl.poll(true,pads);pad.buttons[7].value=.525;ctrl.poll(true,pads)`);assert(Math.abs(run('gas')-.5)<1e-12);
run(`pad.axes[0]=1;ctrl.poll(true,pads);ctrl.poll(true,pads)`);assert.equal(run('lines.length'),1,'un cran par mouvement du stick');
run(`pad.axes[0]=.45;ctrl.poll(true,pads);pad.axes[0]=.6;ctrl.poll(true,pads)`);assert.equal(run('lines.length'),1,'hystérésis du stick');
run(`pad.axes[0]=0;ctrl.poll(true,pads);pad.axes[0]=-1;ctrl.poll(true,pads)`);assert.equal(run('lines[1]'),-1);
run(`pad.buttons[9].pressed=true;ctrl.poll(true,pads);ctrl.poll(false,pads);ctrl.poll(false,pads)`);assert.equal(run('pauses'),1,'Menu tenu ne rebascule pas en boucle');
assert.equal(run('gas'),0);
run(`pad.buttons[9].pressed=false;pad.buttons[7].value=0;ctrl.poll(false,pads);ctrl.reset();pad.buttons[7].value=1;ctrl.poll(true,pads)`);assert.equal(run('gas'),0,'relâchement requis après reprise');
run(`pad.buttons[7].value=.03;ctrl.poll(true,pads)`);assert.equal(run('gas'),0,'zone morte de RT');
run(`pad.buttons[7].value=1;ctrl.poll(true,pads);pad.connected=false;ctrl.poll(true,pads)`);assert.equal(run('gas'),0);assert.equal(run('pauses'),2,'déconnexion : pause');
run(`ctrl.poll(true,()=>{throw Error('API refusée')})`);assert.equal(run('ctrl.status'),'unsupported');

function context(ref) {
  const ctx=vm.createContext({console,performance,Math:Object.create(Math)});
  for(const name of ['util','traces','tracks','track','cars','car','race','net']) {
    const src=ref?cp.execFileSync('git',['show',ref+':js/'+name+'.js'],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync('js/'+name+'.js','utf8');
    vm.runInContext(src,ctx);
  }
  return ctx;
}
const scenario=`(()=>{
  const T={length:1e6,barriers:[],pos:(s,lat)=>({x:s,y:-lat}),wrap:s=>s,diff:(a,b)=>b-a,
    headingAt:()=>0,targetLat:()=>0,lineCurv:()=>0,hwLeftAt:()=>100,hwRightAt:()=>100,project:(x,y)=>({s:x,lat:-y})};
  return MODELS.map(m=>[true,false].map(gas=>{const c=new Car(T,m,{isPlayer:true,s:100,lat:0});c.place(100,0,20);
    for(let i=0;i<120;i++)c.update(1/120,gas,i/120);
    return [m.id,c.v,c.x,c.y,c.lat,c.beta,c.offT,c.w,c.damage,c.slide,c.glisseArr];}));
})()`;
const old=context('3c6e334'), current=context();
const json=x=>JSON.parse(JSON.stringify(x));
assert.deepEqual(json(vm.runInContext(scenario,current)),json(vm.runInContext(scenario,old)),'gaz/frein historiques identiques sur les 25 voitures');
const levels=vm.runInContext(scenario.replace('[true,false]','[0,.25,.5,.75,1]'),current);
for(const rows of levels) for(let i=1;i<rows.length;i++)assert(rows[i][1]>rows[i-1][1],rows[i][0]+' : poussée croissante');
const raceLevels=vm.runInContext(`(()=>{
  return [0,.25,.5,1].map(throttle=>{const r=new Race({trackDef:TRACKS.find(t=>t.id==='monza'),modelId:'f40',mode:'timetrial',nCars:1});
    r.state='racing';r.update(1/120,{throttle,sel:0});return r.player.throttle;});
})()`,current);
assert.deepEqual(json(raceLevels),[0,.25,.5,1],'Race ne transforme pas les fractions en plein gaz');
vm.runInContext(`(()=>{
  const n=Object.create(Net.prototype);n.room={};n.isHost=()=>true;n.roster=['host','guest'];n.seenN={};
  n.peers=[{isMe:false,presence:{pid:'guest',i:[.375,50],n:1}}];n.sentAtMs=Infinity;
  const r={netInput:{}};n.hostTick(r);globalThis.received=r.netInput[1];
})()`,current);
assert.equal(current.received.thr,.375,'dosage de l’invité transmis à la physique hôte');
vm.runInContext(`(()=>{
  const n=Object.create(Net.prototype);n.room={};n.isHost=()=>false;n.members=()=>[];
  n.sentAtMs=-Infinity;n.lastI=null;n.outN=0;n.post=packet=>globalThis.sent=packet;
  n.guestTick({}, {throttle:.375,sel:.5});
})()`,current);
assert.deepEqual(json(current.sent.i),[.375,50],'le message sortant conserve le dosage');
console.log('OK : clavier historique (25 voitures), 5 niveaux de gaz, Race et réseau analogiques, molette, RT, zone morte, pause, déconnexion et détection PC/tablette.');
