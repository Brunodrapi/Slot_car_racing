// Contrôles ciblés de la poussée, du dosage et de l'absence de changement des autres modèles.
'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {context}=require('./caracteres-f1-banc');
const STRAIGHT=`(()=>{
  const T={length:1e6,barriers:[],pos:(s,lat)=>({x:s,y:-lat}),wrap:s=>s,diff:(a,b)=>b-a,
    headingAt:()=>0,targetLat:()=>0,lineCurv:()=>0,hwLeftAt:()=>100,hwRightAt:()=>100,project:(x,y)=>({s:x,lat:-y})};
  function run(m,start,end){const c=new Car(T,m,{isPlayer:true,s:100,lat:0});c.place(100,0,start/3.6);let t=0;while(c.v<end/3.6&&t<30){c.update(1/120,true,t);t+=1/120;}return t;}
  const rows=MODELS.map(m=>({id:m.id,a100:run(m,0,100),a100_180:run(m,100,180),a180_240:run(m,180,240),
    push:[0,60,100,150,180,220,260].map(kmh=>({kmh,a:m.accel*(typeof driveFactor==='function'?driveFactor(m,kmh/3.6):1)*Math.max(0,1-(kmh/3.6/m.vmax)**2.5)})),
    grip:[0,60,120,180,240].map(kmh=>({kmh,g:m.grip+Math.min(m.df*(kmh/3.6)**2,m.grip*1.8)})),
    perf:perfOf(m),vmax:m.vmax,curve:m.driveCurve||null}));
  // Un relâchement reprend exactement le frein déjà existant : la courbe ne pousse jamais sans gaz.
  const lift=MODELS.map(m=>{const c=new Car(T,m,{isPlayer:true,s:100,lat:0});c.place(100,0,180/3.6);for(let i=0;i<60;i++)c.update(1/120,false,i/120);return{id:m.id,v:c.v};});
  const profiles=MODELS.filter(m=>!['brabhambt46b','renaultrs10'].includes(m.id)).map(m=>{const track=new Track(TRACKS.find(t=>t.id==='spa'),.9);const a=speedProfile(track,m,'racing',1);return{id:m.id,array:Array.from(a)};});
  return {rows,lift,profiles};
})()`;
const old=vm.runInContext(STRAIGHT,context('avant')),now=vm.runInContext(STRAIGHT,context('apres'));
const json=x=>JSON.parse(JSON.stringify(x)),by=(data,id)=>data.rows.find(r=>r.id===id);
assert.deepEqual(json(now.profiles),json(old.profiles),'profils des 23 autres voitures inchangés');
assert.deepEqual(json(now.lift),json(old.lift),'le lever de pied conserve le freinage des 25 voitures');
for(const r of now.rows.filter(r=>!['brabhambt46b','renaultrs10'].includes(r.id)))assert.deepEqual(json(r),json(by(old,r.id)),r.id+' : comportement moteur inchangé');
const br=by(now,'brabhambt46b'),r=by(now,'renaultrs10'),ro=by(old,'renaultrs10'),bo=by(old,'brabhambt46b'),f=by(now,'ferrari312t');
assert(br.grip[0].g>by(now,'lotus72').grip[0].g,'la Brabham se distingue en adhérence lente');
assert(br.grip[1].g>bo.grip[1].g&&br.grip[3].g<bo.grip[3].g,'davantage de capacité lente, moins de dépendance à la vitesse');
assert(r.a100>ro.a100&&r.a180_240<ro.a180_240,'Renault : départ plus doux, reprise rapide plus forte');
assert(r.push.find(x=>x.kmh===220).a>f.push.find(x=>x.kmh===220).a,'Renault plus vigoureuse que la Ferrari à 220 km/h');
assert.equal(r.vmax,ro.vmax,'pointe paramétrée inchangée');
assert(r.a100-ro.a100<.5,'le creux ne pénalise pas excessivement le départ');
for(const row of now.rows)for(const t of [row.a100,row.a100_180,row.a180_240])assert(Number.isFinite(t)&&t>0&&t<30);
const report={before:old.rows.filter(x=>['brabhambt46b','renaultrs10','ferrari312t','lotus72'].includes(x.id)),after:now.rows.filter(x=>['brabhambt46b','renaultrs10','ferrari312t','lotus72'].includes(x.id))};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log('OK : moteurs/profils des 23 autres voitures et freinage des 25 voitures inchangés.');
console.log(JSON.stringify({renault:{beforeA100:ro.a100,afterA100:r.a100,before180_240:ro.a180_240,after180_240:r.a180_240},brabham:{grip0:br.grip[0].g,grip180:br.grip[3].g}},null,2));
