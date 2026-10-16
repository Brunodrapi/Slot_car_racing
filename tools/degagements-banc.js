// Géométrie, matériau, limites sportives et reprise des instantanés : Spa hybride.
'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm');
const {contextFor}=require('./motricite-banc.js');
const c=contextFor('live');c.assert=assert;
vm.runInContext(`
const def=TRACKS.find(t=>t.id==='spa'),T=new Track(def,.9);
function checkSurface(f,side,material,width){
 const s=f*T.length,hw=side>0?T.hwLeftAt(s):T.hwRightAt(s);
 assert.equal(T.runoffSurfaceAt(s,side*(hw+width)),material,f+' '+side);
}
for(const side of [-1,1]){
 checkSurface(.18,side,'asphalt',8);
 checkSurface(.358,side,'asphalt',8);
 checkSurface(.974,side,'asphalt',5);
}
checkSurface(.92,-1,'asphalt',12);
checkSurface(.16,-1,'grass',4);
checkSurface(.066,1,'gravel',6);
checkSurface(.39,1,'gravel',6);
checkSurface(.57,-1,'gravel',6); // raccord entre les deux lobes de Pouhon
checkSurface(.735,1,'gravel',8); // raccord Campus / Paul Frère
checkSurface(.92,-1,'grass',30); // la zone bitumée a bien une fin
for(const side of ['L','R'])for(let i=0;i<T.n;i++){
 assert.ok(Number.isFinite(T.bacW[side][i])&&Number.isFinite(T.asphaltW[side][i]));
 assert.ok(!(T.bacW[side][i]>0&&T.asphaltW[side][i]>0),'deux surfaces au même endroit');
 assert.ok(Math.abs(T.runoffWidthAt(i,side==='L'?1:-1)-T.runoffWidthAt(i+1,side==='L'?1:-1))<3,
  'raccord brutal '+i+' '+side);
}
// Les barrières des longs dégagements suivent le bord extérieur, et restent
// métalliques sur le bitume ; les deux rangées de pneus restent liées au gravier.
for(const b of T.barriers.filter(b=>b.s/T.length>.9&&b.s/T.length<.94&&b.side===-1)){
 const p=T.project((b.ax+b.bx)/2,(b.ay+b.by)/2,b.s,30);
 assert.ok(Math.abs(p.lat)>T.hwRightAt(p.s)+T.runoffWidthAt(p.s,-1),'barrière au milieu du bitume');
 assert.equal(b.kind,'rail');
}
// À état initial identique, seule la matière change. Le bitume rend la poussée
// et le freinage de la route ; l'herbe/gravier conserve sa traînée existante.
const soft=new Track({...def,barriers:false,runoffs:def.runoffs.map(z=>({...z,surface:z.surface==='asphalt'?'gravel':z.surface}))},.9);
const paved=new Track({...def,barriers:false},.9);
for(const model of modelsOf('gt')){
 const make=(track)=>{
  const p=new Car(track,model,{isPlayer:true}),s=.92*track.length;
  p.place(s,-track.hwRightAt(s)-7,25);p.gridLat=null;p.lapSale=false;
  p._desiredCurvature=()=>0;
  return p;
 };
 const a=make(paved),b=make(soft),road=make(paved);road.place(road.s,0,25);
 for(let i=0;i<12;i++){a.update(1/120,true,i/120);b.update(1/120,true,i/120);road.update(1/120,true,i/120);}
 assert.equal(a.state,'grass');assert.equal(a.fautes,1);assert.ok(a.lapSale);
 assert.ok(a.runoffAsphalt);assert.ok(!b.runoffAsphalt);
 assert.ok(a.v>b.v+.5,model.id+' freiné comme du gravier sur le bitume');
 assert.ok(Math.abs(a.v-road.v)<.001,model.id+' poussée différente de la route');
 // Getter dérivé : pas de nouveau champ à synchroniser pour les clients.
 a.s=.16*T.length;a.lat=-T.hwRightAt(a.s)-5;assert.ok(!a.runoffAsphalt);
}
const race=new Race({trackDef:def,classId:'gt',modelId:'f40',nCars:1,mode:'timetrial'});
const p=race.player;p.place(.91*T.length,-T.hwRightAt(.91*T.length)-7,35);p.started=true;
p.update(1/120,true,0);race._comptePenalite(p,.01);
const initial=p.progress;p.s+=50;p.state='ok';race._comptePenalite(p,.01);
assert.ok(p.repris>0,'gain de temps hors piste non repris');assert.ok(p.lapSale);
assert.ok(Race.penalite(p)>=1);
for(const d of TRACKS.filter(d=>d.id!=='spa')){
 const t=new Track(d);assert.equal(t.asphaltW,undefined);assert.equal(t.barriers.length,0);
}
// Les définitions futures peuvent traverser le départ.
const wrap=new Track({...def,barriers:false,runoffs:[{surface:'asphalt',side:1,points:[[.99,0],[1,10],[1.01,0]]}]});
assert.ok(wrap.runoffWidthAt(0,1)>9.9);assert.ok(wrap.runoffWidthAt(.995*wrap.length,1)>4.9);
console.log('Spa : contours, raccords, barrières, neuf voitures, bitume/sol meuble, fautes, pénalités et autres circuits OK');
`,c);
