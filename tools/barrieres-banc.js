// Impacts continus, amortissement, coupure, faute unique et synchronisation.
'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {contextFor}=require('./motricite-banc.js');
const c=contextFor('live');c.assert=assert;
vm.runInContext(fs.readFileSync(__dirname+'/../js/paquet.js','utf8'),c);
vm.runInContext(`
const T=new Track(TRACKS.find(t=>t.id==='spa'));
assert.ok(T.barriers.length>1000);
assert.equal(new Track(TRACKS.find(t=>t.id==='monza')).barriers.length,0);
for(const b of T.barriers)if(b.side<0)assert.equal(T.pitAt(b.s),null,'voie des stands fermée');
// Toute l'épaisseur des protections reste hors de l'asphalte, raccords compris.
for(const b of T.barriers)for(const u of [0,.5,1]){
 const pr=T.project(b.ax+(b.bx-b.ax)*u,b.ay+(b.by-b.ay)*u,b.s,100);
 const hw=pr.lat>0?T.hwLeftAt(pr.s):T.hwRightAt(pr.s);
 assert.ok(Math.abs(pr.lat)-hw-b.half>1,'barrière dans la piste');
}
// Un disque ne doit traverser ni le corps ni le bout du mur, même à grande vitesse.
const wall={ax:0,ay:-5,bx:0,by:5,tx:0,ty:1,len:10,half:.3,nx:1,ny:0};
assert.ok(Track.sweepBarrier(20,0,-40,0,wall,1));
assert.ok(Track.sweepBarrier(20,5.8,-40,0,wall,1));
assert.equal(Track.sweepBarrier(20,7,-40,0,wall,1),null);
assert.equal(Track.sweepBarrier(2,0,10,0,wall,1),null);
const segments={};
for(const kind of ['rail','tyres'])segments[kind]=T.barriers.find(b=>b.kind===kind&&b.side===1&&b.len>2.8&&b.len<6&&Math.abs(T.curvAt(b.s))<.03);
assert.ok(segments.rail&&segments.tyres);
function impact(model,kind,speed,angle,wear,alreadyOff=false){
 const b=segments[kind],p=new Car(T,model,{usure:wear?USURE:null,isPlayer:true});
 const heading=Math.atan2(-b.ny,-b.nx)+angle,cs=Math.cos(heading),sn=Math.sin(heading);
 const support=model.width/2+(model.length-model.width)/2*Math.abs(cs*b.nx+sn*b.ny);
 const x=(b.ax+b.bx)/2+b.nx*(b.half+support+1),y=(b.ay+b.by)/2+b.ny*(b.half+support+1);
 const pr=T.project(x,y,b.s,30);p.place(pr.s,pr.lat,speed);p.x=x;p.y=y;p.th=heading;p.s=b.s;
 if(alreadyOff)p._leaveTrack(false);
 const from={x,y,th:heading};p.x+=cs*12;p.y+=sn*12;
 assert.ok(p._barrierContact(from,12/speed),kind+' sans contact');
 assert.equal(p.v,0);assert.equal(p.vl,0);assert.equal(p.w,0);assert.ok(p.engineStopped);
 assert.equal(p.crashes,1);assert.equal(p.fautes,1);assert.ok(p.lapSale);assert.equal(p.barrierHits,1);
 assert.ok(p.engineCut>=.25&&p.engineCut<=5);
 if(!wear)assert.equal(p.damage,0);
 return p;
}
let n=0;
for(const m of modelsOf('gt'))for(const speed of [10,30,60])for(const angle of [0,.6,1.1]){
 const rail=impact(m,'rail',speed,angle,true),tyres=impact(m,'tyres',speed,angle,true);
 assert.ok(tyres.damage<=rail.damage);assert.ok(tyres.engineCut<=rail.engineCut);
 impact(m,'rail',speed,angle,false,true);n+=3;
}
console.log(n+' impacts : neuf voitures, trois vitesses, trois angles, pneus et dégâts optionnels OK');
const p=impact(modelById('f40'),'rail',30,0,true),cut=p.engineCut,x=p.x,y=p.y,damage=p.damage;
for(let i=0;i<Math.floor(cut*120)-1;i++){p.update(1/120,true,i/120);assert.equal(p.v,0);assert.equal(p.x,x);assert.equal(p.y,y);}
assert.equal(p.damage,damage);assert.equal(p.barrierHits,1);assert.equal(p.crashes,1);
for(let i=0;i<240;i++){p.steer([p],1/120,true);p.update(1/120,true,cut+i/120);}
assert.ok(!p.engineStopped&&p.v>2,'voiture bloquée après le choc');
assert.ok(p.barrierHits<4,'collision réarmée à chaque appui : '+p.barrierHits);
// Le secours après huit secondes ne doit pas interrompre une coupure en cours.
const late=impact(modelById('f40'),'rail',50,0,true,true);
late.grassT=7.99;const lx=late.x,ly=late.y;
for(let i=0;i<120;i++)late.update(1/120,true,i/120);
assert.ok(late.engineStopped);assert.equal(late.rejoined,0);assert.equal(late.x,lx);assert.equal(late.y,ly);
p.place(0,0,0);assert.equal(p.engineCut,0);assert.equal(p.engineStopped,false);
const host=new Race({trackDef:TRACKS.find(t=>t.id==='spa'),classId:'gt',modelId:'f40',nCars:1,wear:true});
const guest=new Race({trackDef:TRACKS.find(t=>t.id==='spa'),classId:'gt',modelId:'f40',nCars:1,wear:true});
host.player.engineStopped=true;host.player.throttle=false;host.player.lapSale=true;
const decoded=pqDecode(pqEncode(host.snapshot(1),T,true),T);
assert.ok(guest.applySnapshot(decoded.snap));assert.ok(guest.player.engineStopped);assert.equal(guest.player.throttle,false);
host.player.engineStopped=false;host.player.throttle=true;
guest.applySnapshot(pqDecode(pqEncode(host.snapshot(2),T,true),T).snap);
assert.equal(guest.player.engineStopped,false);assert.equal(guest.player.throttle,true);
// Un concurrent ne remet pas en mouvement le moteur coupé lors du contact de peloton.
const pack=new Race({trackDef:TRACKS.find(t=>t.id==='spa'),classId:'gt',modelId:'f40',nCars:2,mode:'race'});
pack.player.place(600,0,0);pack.player.engineCut=2;pack.player.engineStopped=true;
const other=pack.cars.find(c=>c!==pack.player);other.place(596.5,0,30);
pack._simulate(1/120,false);
assert.ok(pack.player.engineStopped);assert.equal(pack.player.v,0);assert.equal(pack.player.vl,0);
console.log('Arrêt, minuterie, reprise, remise à zéro, peloton et codec réseau OK');
`,c);
