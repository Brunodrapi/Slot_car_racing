'use strict';
// Actual physics/protocol in three independent races, fake monotonic clock + lossy links.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const ctx=vm.createContext({console,Math,Date,assert,Uint8Array,DataView,ArrayBuffer,
  TEST_TRACK:process.argv[2]||'monza',performance:{now:()=>0},setInterval:()=>0,clearInterval:()=>{}});
const source=['util','traces','tracks','track','cars','car','flags','race','spectator','net-drive']
  .map(f=>fs.readFileSync(`${__dirname}/../js/${f}.js`,'utf8')).join('\n');
vm.runInContext(source+`
let clock=10000,delay=50,queue=[],packetN=0,loss=false;
performance.now=()=>clock;
const clockLink=new NetLink({isHost:()=>false,room:{onMessage(){}},state:'off'});
clockLink.offset=50;const previousTime=clockLink.now();clockLink.offset=-100;
assert(clockLink.now()>=previousTime,'clock correction must not make state timestamps go backwards');
clockLink.close();
const ids=['host','front','follower'];
const opts={trackDef:TRACKS.find(t=>t.id===TEST_TRACK),modelId:'f40',classId:'gt',mode:'race',laps:2,aiFill:false,noContact:true};
const nodes=ids.map((pid,seat)=>{
 const race=new Race({...opts,humans:ids.map((name,i)=>({name,modelId:'f40',local:i===seat,livery:i}))});
 race.broadcast=new RaceBroadcast(race);
 const net={pid,roster:ids,seat,mine:{},lastSeq:-1,settings:()=>({go:1}),isHost:()=>seat===0,
 members:()=>ids.map((pid,i)=>({pid,isMe:i===seat,q:{}}))};
 net.link={synchronized:true,now:()=>clock,ping:()=>delay*2,send(p,to){
   packetN++;if(loss&&['owned','view'].includes(p.kind)&&packetN%7===0)return;
   queue.push({p,to,from:pid,at:clock+delay+(loss?packetN%4*4:0)});
   if(loss&&packetN%11===0)queue.push({p,to,from:pid,at:clock+delay+30});
 }};
 const drive=new NetDrive(net,race);net.drive=drive;drive.epoch=clock;
 race.state='racing';race.countdown=0;race.cars.forEach(c=>c.gridLat=null);
 return {race,net,drive,input:{throttle:0,sel:0}};
});
function deliver(){const due=queue.filter(q=>q.at<=clock);queue=queue.filter(q=>q.at>clock);for(const q of due)nodes[ids.indexOf(q.to)].drive.receive(q.p,q.from);}
function step(n=1){for(let k=0;k<n;k++){
 clock+=1000/120;deliver();
 for(const node of nodes){node.drive.beforeFrame(1/120);node.race.update(1/120,node.input);if(node.drive.host)node.race.broadcast.sample(node.race);node.drive.afterFrame(node.input);}
}}
// A tap shorter than the 33 ms publication period must accelerate locally, even with RTT=200 ms.
delay=100;const g=nodes[1],c=g.race.player;
const v=c.v;g.input.throttle=1;step(1);assert(c.v>v,'local throttle reacts on first physics step');
g.input.throttle=0;step(1);assert(c.v>v,'short pulse has a physical effect');
const localPose=[c.x,c.y,c.v];
g.drive.receive({race:1,kind:'view',data:driveEncode([driveState({...c,x:c.x+50},g.drive.local,clock+1)])},'host');
assert.deepEqual([c.x,c.y,c.v],localPose,'host never overwrites local physics');
for(const node of nodes)for(const car of node.race.cars)if(car.netRemote)car.update=()=>{throw Error('remote physics must not run');};
step(40);assert(nodes[0].race.cars[1].x!==nodes[0].race.cars[1].track.pos(nodes[0].race.cars[1].s,0).x);
// A front driver's explicit brake is forwarded immediately over TWO one-way links.
delay=50;queue=[];for(const node of nodes){node.drive.epoch=clock;node.race.time=0;}
g.race.player.v=15;g.input={throttle:0,sel:0,brake:0,engineBrake:0};step(30);
g.race.player.v=15;g.input.brake=1;const brakingAt=clock;step();
let seen=null,maxDistanceError=0;for(let k=0;k<30;k++){
 step();const displayed=nodes[2].race.cars[1];
 maxDistanceError=Math.max(maxDistanceError,Math.hypot(displayed.x-c.x,displayed.y-c.y));
 if(displayed.braking){seen=clock-brakingAt;break;}
}
assert(seen!==null&&seen>=100&&seen<145,'braking reaches following guest in two hops without a periodic wait: '+seen);
assert(maxDistanceError<2,'front car position remains usable while braking: '+maxDistanceError);
console.log('Brake visibility, 50 ms per hop:',Math.round(seen),'ms');
// Old/future/cross-race movement and spoofed ownership do not change another driver.
const host=nodes[0],car=host.race.cars[1],base=host.drive.states.get(1),seq=car.netSeq;
for(const [s,from,race] of [[{...base,x:999,at:base.at-100},'front',1],[{...base,x:999,at:clock+10000},'front',1],[{...base,x:999,at:clock},'follower',1],[{...base,x:999,at:clock},'front',2]]){
 host.drive.receive({kind:'owned',race,seq:seq+10,state:driveEncode([s])},from);
 assert.notEqual(car.x,999);
}
// Detailed/compact codecs, malformed packets, and promotion before a fast approaching car.
const encoded=driveEncode([base]);assert.equal(encoded.length,1+DRIVE_FULL_BYTES);
const decoded=driveDecode(encoded)[0];assert(Math.abs(decoded.x-base.x)<.001);
for(const steer of [-.5,0,.5]){
 const state=driveDecode(driveEncode([{...base,steer}]))[0];
 assert(Math.abs(state.steer-steer)<1/180,'steering survives compact quantization');
 host.drive.applyState(car,state);
 assert.equal(car.steerAngle,state.steer,'remote tires use transmitted steering');
}
assert.equal(driveEncode([base],true).length,15,'distant states stay at 14 bytes plus header');
assert.deepEqual(driveDecode(encoded.buffer),driveDecode(encoded),'raw BinaryPack ArrayBuffer is accepted');
assert.equal(driveDecode(encoded.slice(0,-1)),null);
const distant={...base,s:host.race.track.wrap(host.race.player.s+300),v:10};
Object.assign(car,distant);car.x=host.race.player.x+300;car.y=host.race.player.y+300;
assert.equal(host.drive.isNear(1,'host'),false);
car.v=120;assert.equal(host.drive.isNear(1,'host'),true,'closing speed promotes detail');
const detailed10=driveEncode(Array(10).fill(base)).length*30;
const tiered=driveEncode(Array(3).fill(base)).length*30+driveEncode(Array(7).fill(base),true).length*5;
assert(tiered<detailed10*.4);console.log('Movement payload, 10 cars:',detailed10,'->',tiered,'B/s (3 near, 7 far; excludes control/transport)');
// Idempotent contacts survive duplicates, and acknowledge without replacing present pose.
const contact={id:1,car:g.drive.local,at:clock,delta:{v:-1,vl:.1,w:0,x:0,y:0,damage:.02}};
g.race.player.v=10;
for(let k=0;k<3;k++)g.drive.receive({race:1,kind:'contacts',events:[contact]},'host');
assert.equal(g.race.player.v,9);assert.equal(g.drive.ack,1);
g.race.player.blueFlag=true;
g.drive.receive({race:1,kind:'contacts',events:[{...contact,id:2}]},'host');
assert.equal(g.race.player.v,9,'blue owner acknowledges but ignores a dynamic impact');assert.equal(g.drive.ack,2);
g.race.player.blueFlag=false;
host.race.cars[1].blueFlag=true;host.race.flags.penalties.set(1,host.race.time+5);
host.drive.lastControl=-Infinity;host.drive.control();clock+=delay;deliver();
assert(g.race.player.blueFlag,'blue flag is synchronized through the real control packet');
assert(g.race.flags.active(g.race.player).includes('penalty'));
host.race.cars[1].blueFlag=false;host.drive.lastControl=-Infinity;host.drive.control();clock+=delay;deliver();
assert(!g.race.player.blueFlag);
// Real host contact arbitration changes both owners, then clears after acknowledgement.
const front=host.race.player,back=host.race.cars[1],s0=host.race.track.length-50;
front.place(s0,0);front.v=5;back.place(s0-front.cls.length*.7,0);back.v=20;
g.race.player.place(back.s,0);g.race.player.v=20;
host.drive.states.set(1,driveState(back,1,clock));host.drive.contactSerial.front=g.drive.ack;
back.blueFlag=true;host.drive.resolveContacts(1/120);assert(!host.drive.contacts.get('front')?.length,'host skips blue contacts');back.blueFlag=false;
host.drive.resolveContacts(1/120);
assert(front.v>5,'front car receives the shared impact');
const events=host.drive.contacts.get('front');assert(events?.length===1);
clock+=delay;deliver();assert(g.race.player.v<20,'rear owner receives the impact');
const afterHit=g.race.player.v;
g.drive.receive({race:1,kind:'contacts',events},'host');assert.equal(g.race.player.v,afterHit);
g.drive.lastSend=-Infinity;g.drive.afterFrame(g.input);clock+=delay;deliver();
assert.equal(host.drive.contacts.get('front').length,0,'acknowledged impact is removed');
// Lost/duplicated/reordered frames recover; reported RTT does not govern local response.
loss=true;delay=60;g.input={throttle:1,sel:0};step(180);
assert(car.netSeq>seq);assert(Number.isFinite(car.x));assert(g.race.player.v>0);
// Real checkpoint/lap bookkeeping at the owner, cumulative host acceptance and shared finish.
loss=false;queue=[];const r=g.race,own=r.player;
for(const node of nodes)node.drive.epoch=clock-20000;
r.time=20;own.lap=0;own.lapTimes=[];own.lapOk=[];own.started=false;
own.s=r.track.length-.01;own._advance(.02,1);
own.s=r.track.length/2-.01;own._advance(.02,8);own.s=r.track.length-.01;own._advance(.02,10);
own.s=r.track.length/2-.01;own._advance(.02,15);own.s=r.track.length-.01;own._advance(.02,20);
own.finished=true;own.finishTime=20;g.drive.metaKey=null;g.drive.lastSend=-Infinity;
g.drive.afterFrame(g.input);step(30);
assert.equal(host.race.cars[1].finished,true);assert.equal(host.race.cars[1].finishTime,20);
assert.deepEqual(host.race.cars[1].lapTimes,[9,10]);assert.equal(host.race.state,'finishing');
assert.equal(host.race.finishDeadline,50,'finish clock based on crossing, not packet arrival');
host.race.cars[0].finished=true;host.race.cars[0].finishTime=21;
nodes[2].race.player.finished=true;nodes[2].race.player.finishTime=22;
// In-flight crossings remain eligible briefly; timestamps after the deadline are DNF.
host.race.time=50.02;assert.equal(host.drive.canFinalize(),false);
const third=host.race.cars[2],thirdBefore=driveMeta(third);
const validFinish={...thirdBefore,lap:2,started:true,lapStart:49.99,laps:[[24,true],[24,true]],finished:true,finishTime:49.99};
host.drive.acceptMeta(third,validFinish,host.drive.states.get(2));assert(third.finished);
host.drive.applyMeta(third,thirdBefore);
host.drive.acceptMeta(third,{...validFinish,lapStart:50.01,finishTime:50.01},host.drive.states.get(2));
assert(!third.finished);assert.equal(third.finishTime,null);
host.drive.applyMeta(third,thirdBefore);
// Close by bounded deadline, leaving the unvalidated third driver DNF.
host.drive.epoch=clock-51000;step(40);
assert.equal(host.race.state,'finished');assert.equal(g.race.state,'finished');
assert.equal(g.race.results.find(x=>x.car.human===2).time,null);
assert.deepEqual(g.race.cars[1].lapTimes,[9,10]);
console.log('OK: local pulses, ownership, immediate brake relay, stale/invalid packets, codec/interest, contact deduplication, loss, laps and shared DNF results.');
`,ctx);
