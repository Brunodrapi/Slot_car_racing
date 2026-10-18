'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const files=['util','traces','tracks','track','cars','car','race'];
const src=files.map(f=>fs.readFileSync(`${__dirname}/../js/${f}.js`,'utf8')).join('\n');
const ctx=vm.createContext({console,Math,Date,assert});
vm.runInContext(src+`
const opts={trackDef:TRACKS.find(t=>t.id==='monza'),modelId:'f40',classId:'gt',mode:'race',laps:3,aiFill:false,noContact:true,
 humans:[{name:'Host',modelId:'f40',local:true,livery:0},{name:'Guest',modelId:'f40',local:false,livery:1}]};
function fixture(winner, otherAt=Infinity, ai=false){
 const r=new Race({...opts,aiFill:ai,nCars:ai?3:2});r.state='racing';
 for(const c of r.cars){c.steer=()=>{};c.update=()=>{if(c.human===winner&&r.time>=.1||c.human!==null&&c.human!==winner&&r.time>=otherAt)c.lap=3;};}
 return r;
}
for(const winner of [0,1]){
 const r=fixture(winner);
 while(r.time<.2)r.update(1/60,0);
 assert.equal(r.state,'finishing');assert(Math.abs(r.finishDeadline-30.1)<.02);
 while(r.time<10)r.update(1/60,0);
 assert.equal(r.state,'finishing','give opponents actual time to finish');
 while(r.state!=='finished'&&r.time<31)r.update(1/60,0);
 assert.equal(r.state,'finished');assert(r.time<30.2,'no synthetic 180-second fast-forward');
 assert.equal(r.results.filter(x=>x.car.finished).length,1);
 assert.equal(r.results.find(x=>!x.car.finished).time,null,'no fabricated finishing time');
}
const r=fixture(1,2,true);while(r.state!=='finished'&&r.time<31)r.update(1/60,0);
assert(r.time<2.1,'finish once both humans finish, without waiting for AI');
assert.equal(r.results.filter(x=>x.car.finished).length,2);
const aiRace=fixture(-1,Infinity,true), ai=aiRace.cars.find(c=>c.human===null);ai.update=()=>{if(aiRace.time>=.1)ai.lap=3;};
while(aiRace.time<.2)aiRace.update(1/60,0);assert.equal(aiRace.state,'finishing','first AI also starts the deadline');
const done=r.cars.find(c=>c.finished), recorded=done.lap;done.checkpoint=true;done.started=true;done._advance(r.track.length+1,r.time+10);assert.equal(done.lap,recorded,'cooldown is not a timed racing lap');
console.log('OK: first finisher host/guest/AI; 30 seconds grace; early all-human finish; DNF without invented laps.');
`,ctx);

const {RoomRTC}=require('../js/room-rtc.js');
const transport=new RoomRTC();let sends=0;const conn={open:true,dataChannel:{bufferedAmount:40000},send(){sends++;}};
transport.send(conn,{s:[1]});assert.equal(sends,0,'skip obsolete snapshots while channel is congested');
transport.send(conn,{i:[0,0]});assert.equal(sends,1,'input packets still pass');
conn.dataChannel.bufferedAmount=0;transport.send(conn,{s:[2]});assert.equal(sends,2,'new snapshot retries on recovery');
console.log('OK: data-channel backlog skips snapshots, preserves inputs and resumes.');
