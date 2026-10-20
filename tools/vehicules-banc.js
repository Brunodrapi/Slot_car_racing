// node tools/vehicules-banc.js : véhicules du décor (parkings et camping-cars) hors piste et hors protections.
'use strict';
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const {contextFor}=require('./motricite-banc.js');const c=contextFor('live');c.assert=assert;
vm.runInContext(fs.readFileSync(__dirname+'/../js/props.js','utf8').replace(/if \(typeof module[^\n]*\n/g,''),c);
vm.runInContext(`
let total=0,campeurs=0;const gabarits=new Set();
for(const d of TRACKS){
 const t=new Track(d),im=placeImplantation(t,d.id,d.implantation);if(!im)continue;
 const v=im.batis.filter(b=>b.type==='voiture'),bati=im.batis.filter(b=>b.type!=='voiture');
 const camp=v.filter(b=>b.camping);
 if((d.implantation||[]).some(z=>z.kind==='camping'))assert.ok(camp.length>0,d.id+' : aucun camping-car');
 for(const b of v){
  assert.ok(VEHICULES[b.kind]&&b.col<VEHICULES[b.kind].teintes.length,d.id+' : gabarit inconnu');
  gabarits.add(b.kind);
  const fp=sceneryFootprint(b);
  // Aucun coin sur la chaîne de protection d'une portion de piste, quelle qu'elle soit.
  for(const [x,y] of fp){const pr=implProjette(t,x,y);
   assert.ok(Math.abs(pr.lat)>=t.limiteProtection(pr.s,pr.lat>=0?1:-1),d.id+' : '+b.kind+' sur la piste');}
  assert.ok(!sceneryBarrierOverlap(t,fp),d.id+' : '+b.kind+' sur une protection');
 }
 for(let i=0;i<camp.length;i++){const a=sceneryFootprint(camp[i]);
  for(const o of bati)assert.ok(!sceneryRectsOverlap(a,sceneryFootprint(o)),d.id+' : camping-car sur un bâtiment');
  for(let j=i+1;j<camp.length;j++)assert.ok(!sceneryRectsOverlap(a,sceneryFootprint(camp[j])),d.id+' : camping-cars superposés');}
 total+=v.length;campeurs+=camp.length;
}
assert.ok(total>3000,'parkings presque vides');
assert.equal(gabarits.size,Object.keys(VEHICULES).length,'gabarit jamais posé : '+Object.keys(VEHICULES).filter(k=>!gabarits.has(k)));
console.log('Véhicules : '+total+' posés, '+campeurs+' camping-cars en bord de piste, '+gabarits.size+' gabarits ; aucun sur la piste, une protection ou un bâtiment.');
`,c);
