// Les effets suivent le patinage sans influencer la conduite ni faire changer de rapport.
'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const {contextFor}=require('./motricite-banc.js');
const {EAVehicle}=require('../js/engine-audio.js');
const c=contextFor('live');c.assert=assert;
vm.runInContext(fs.readFileSync(__dirname+'/../js/paquet.js','utf8'),c);
vm.runInContext(`
const make = () => new Race({trackDef:TRACKS.find(t=>t.id==='monza'),classId:'gt',modelId:'f40',nCars:1,mode:'timetrial'});
const left=make(),right=make();
for(const r of [left,right]){r.player.place(100,0,25);r.player.vl=5;}
right.player.patineFx=1;
for(let i=0;i<240;i++){
 const gas=Math.floor(i/12)%2===0;
 left.player.update(1/120,gas,i/120);right.player.update(1/120,gas,i/120);
 for(const key of ['x','y','v','vl','w','th','delta','Ff','Fr'])assert.equal(left.player[key],right.player[key],key+' dépend des effets');
}
const p=left.player;
p.place(100,0,25);
for(let i=0;i<6;i++){p.v=25;p.vl=10;p.w=0;p.update(1/120,true,i/120);}
assert.ok(p.patineFx>.6 && p.patineFx<1,'réponse à un appui de 50 ms');
const before=p.patineFx;
p.update(1/120,false,.05);
assert.ok(p.patineFx>0 && p.patineFx<before,'extinction progressive');
for(let i=0;i<48;i++)p.update(1/120,false,.06+i/120);
assert.ok(p.patineFx<.01,'effet persistant après le relâchement');
p.place(100,0,0);assert.equal(p.patineFx,0);
// Tous les niveaux et les bits de conduite survivent au codec existant.
for(let i=0;i<=7;i++){
 p.patineFx=i/7;p.throttle=true;p.braking=false;p.lapSale=true;
 const snap=left.snapshot(1),oct=pqEncode(snap,left.track,true),decoded=pqDecode(oct,left.track);
 assert.equal(oct.length,43,'le paquet à une voiture a grandi');
 right.applySnapshot(decoded.snap);
 assert.equal(right.player.patineFx,i/7);
 assert.ok(right.player.throttle&&!right.player.braking&&right.player.lapSale);
}
const old=left.snapshot(1);old[4+11]&=31;right.applySnapshot(old);assert.equal(right.player.patineFx,0);
console.log('Physique indépendante des effets, impulsions de 50 ms, extinction et réseau : OK');
`,c);
const cars=vm.runInContext("modelsOf('gt').map(m=>({id:m.id,vmax:m.vmax}))",c);
const catalogue=JSON.parse(fs.readFileSync(__dirname+'/../sounds/engine/voitures.json','utf8'));
for(const car of cars){
 const cfg=catalogue.voitures[car.id],set=catalogue.jeux[cfg.jeu];
 const conf={engine:{...set.engine,...cfg.engine,soft_limiter:cfg.engine.limiter*.99},drivetrain:{...set.drivetrain,...cfg.drivetrain},wheel_radius:cfg.wheel_radius,vmax:car.vmax};
 const dry=new EAVehicle(conf),spin=new EAVehicle(conf);
 let peak=0;
 for(let i=0;i<2400;i++){
  const t=i/120,v=Math.min(car.vmax,t*4),slip=Math.floor(i/12)%2 ? 0 : 1;
  dry.update(t*1000,1/120,v,1,0);spin.update(t*1000,1/120,v,1,slip);
  assert.equal(spin.drivetrain.gear,dry.drivetrain.gear,car.id+' passage parasite');
  assert.ok(Number.isFinite(spin.engine.rpm));
  // Le transitoire d'embrayage à l'arrêt existe dans le moteur de référence : les effets
  // sont désactivés à ce moment-là et doivent produire exactement la même réponse.
  if(v<=3)assert.equal(spin.engine.rpm,dry.engine.rpm);
  if(v>8)peak=Math.max(peak,spin.engine.rpm/conf.engine.limiter);
 }
 assert.ok(peak<1.04,car.id+' régime trop élevé : '+peak);
 // À vitesse stabilisée, le patinage relève bien le régime, sans changer de rapport.
 const v=car.vmax*.45;
 for(let i=0;i<360;i++){dry.update(21000+i/120*1000,1/120,v,1,0);spin.update(21000+i/120*1000,1/120,v,1,1);}
 assert.ok(spin.engine.rpm>dry.engine.rpm*1.02,car.id+' aucune réponse sonore');
 const rise=(spin.engine.rpm/dry.engine.rpm-1)*100;
 for(let i=0;i<120;i++){dry.update(25000+i/120*1000,1/120,v,0,0);spin.update(25000+i/120*1000,1/120,v,0,1);}
 assert.ok(Math.abs(spin.engine.rpm-dry.engine.rpm)<10,car.id+' régime maintenu pied levé');
 console.log(car.id+': hausse '+rise.toFixed(1)+' %, régime et rapports stables');
}
