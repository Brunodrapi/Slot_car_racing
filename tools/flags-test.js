'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const ctx=vm.createContext({console,Math,Date,assert});
const source=['util','traces','tracks','track','cars','car','flags','race'].map(f=>fs.readFileSync(__dirname+'/../js/'+f+'.js','utf8')).join('\n');
vm.runInContext(source+`
const opts={trackDef:TRACKS.find(t=>t.id==='monza'),classId:'gt',modelId:'f40',nCars:3,laps:3};
const r=new Race(opts),slow=r.player,fast=r.cars[0],other=r.cars[1];r.state='racing';r.time=10;
for(const [i,c]of r.cars.entries()){c.started=true;c.lap=0;c.place(100+i*80,0,8);c.gridLat=null;}
slow.place(100,0,8);fast.place(90,0,24);fast.lap=1;
r.flags.update();assert(slow.blueFlag);assert(r.flags.active(slow).includes('blue'));
fast.place(99.9,0,24);const before=r.cars.map(c=>[c.v,c.vl,c.w,c.x,c.y]);
resolveCollisions(r.cars,r.track);assert.deepEqual(r.cars.map(c=>[c.v,c.vl,c.w,c.x,c.y]),before,'blue skips dynamic contacts');
fast.steer(r.cars,1/120,true);assert.notEqual(fast.blocker,slow,'AI must not brake for a ghost');
fast.lap=0;r.time=13;r.flags.update();assert(slow.blueFlag,'remain intangible during overlap');
fast.place(160,0,24);r.time=14;r.flags.update();assert(!slow.blueFlag);
slow.place(100,0,8);fast.place(99.9,0,24);resolveCollisions([slow,fast],r.track);assert.notEqual(fast.v,24,'ordinary contacts remain enabled');
// Two cars battling across the line must not be mistaken for a lapping manoeuvre.
slow.place(r.track.length-1,0,8);slow.lap=0;fast.place(1,0,24);fast.lap=1;r.time=16;r.flags.update();assert(!slow.blueFlag);
fast.place(200,0,8);fast.lap=0;slow.place(100,0,8);slow.state='grass';r.time=20;r.flags.update();
r.time=22.99;r.flags.update();assert.equal(r.flags.zones.length,0);
r.time=23;r.flags.update();assert.equal(r.flags.zones.length,1);assert(r.flags.active(slow).includes('yellow'));
slow.state='ok';r.flags.update();assert.equal(r.flags.zones.length,0);assert.deepEqual(r.flags.active(slow),[]);
slow.state='grass';slow.inPit=true;r.time=30;r.flags.update();r.time=40;r.flags.update();assert.equal(r.flags.zones.length,0,'pit is not an incident');slow.inPit=false;slow.state='ok';
slow.fautes++;r.flags.inspect(slow);assert(r.flags.active(slow).includes('penalty'));
r.time=44.99;assert(r.flags.active(slow).includes('penalty'));r.time=45;assert(!r.flags.active(slow).includes('penalty'));
const tt=new Race({...opts,mode:'timetrial'});tt.state='racing';tt.time=5;tt.player.lapSale=true;tt.flags.inspect(tt.player);
assert.equal(tt.player.fautes,0);assert(tt.flags.active(tt.player).includes('penalty'),'invalid TT lap shows black/white without a race penalty');
fast.lap=2;r.time=50;r.flags.update();assert(r.flags.chequered);assert(r.flags.active(slow).includes('chequered'));
slow.fautes++;r.flags.inspect(slow);assert.deepEqual(r.flags.active(slow),['penalty','chequered'],'finish flag persists alongside a sanction');
fast.finished=true;r.state='finishing';r.time=70;r.flags.update();assert(r.flags.active(slow).includes('chequered'));
const copy=new Race(opts);copy.state='racing';copy.time=r.time;copy.flags.receive(r.flags.packet());assert(copy.flags.chequered);
// Blue only bypasses car-to-car collision: the actual swept barrier collision still stops it.
const T=new Track(TRACKS.find(t=>t.id==='spa'));
const b=T.barriers.find(b=>b.kind==='rail'&&b.side===1&&b.len>2.8&&b.len<6&&Math.abs(T.curvAt(b.s))<.03);
const p=new Car(T,modelById('f40'),{isPlayer:true,usure:USURE});p.blueFlag=true;
const h=Math.atan2(-b.ny,-b.nx),support=p.cls.width/2+(p.cls.length-p.cls.width)/2*Math.abs(Math.cos(h)*b.nx+Math.sin(h)*b.ny);
const x=(b.ax+b.bx)/2+b.nx*(b.half+support+1),y=(b.ay+b.by)/2+b.ny*(b.half+support+1);
p.place(b.s,0,30);p.x=x;p.y=y;p.th=h;const from={x,y,th:h};p.x+=Math.cos(h)*12;p.y+=Math.sin(h)*12;
assert(p._barrierContact(from,12/30));assert(p.engineStopped);assert.equal(p.barrierHits,1);assert(p.damage>0);assert(p.blueFlag);
console.log('OK: blue lapping, overlap retention, ordinary contacts, AI, real barrier impact, yellow delay/clear/pits, penalty/TT, persistent finish and shared flag packet.');
`,ctx);
