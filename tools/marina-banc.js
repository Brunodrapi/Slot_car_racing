'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=['util','traces','tracks','track','props'].map(f=>fs.readFileSync(__dirname+'/../js/'+f+'.js','utf8').replace(/if \(typeof module[^\n]*\n/g,'').replace(/'use strict';/g,'')).join('\n');
vm.runInNewContext(src+`
const def=TRACKS.find(t=>t.id==='monaco'),T=new Track(def),water=placeWater(T,def.water);
for(let i=0;i<T.n;i++){
 assert.ok(!waterContains(water,T.xs[i],T.ys[i]),'mer sur la piste à '+i);
}
const port=T.pos(.65*T.length,65),casino=T.pos(.15*T.length,30);
assert.ok(waterContains(water,port.x,port.y),'le bassin du port est vide');
assert.ok(!waterContains(water,casino.x,casino.y),'la mer reste vers le Casino');
for(const f of [.48,.50,.53,.55]){const p=T.pos(f*T.length,35);assert.ok(waterContains(water,p.x,p.y),'mer absente devant le tunnel à '+f);}
const im=placeImplantation(T,T.id,def.implantation,water);
assert.ok(im.batis.length>20,'tous les bâtiments ont été supprimés');
for(const b of im.batis)assert.ok(!waterOverlaps(water,sceneryFootprint(b)),'bâtiment ou voiture dans le port');
for(const a of im.arbres)assert.ok(!waterContains(water,a.x,a.y,5),'arbre dans le port');
const boats=placeBoats(T,T.id,water);assert.ok(boats.length>30);
for(const b of boats)assert.ok(waterContains(water,b.x,b.y),'bateau sur terre');
const towers=im.batis.filter(b=>b.type==='hangar');assert.ok(towers.length>2&&towers.every(b=>b.height>=22&&b.architecture==='immeubles'));
const mans=new Track(TRACKS.find(t=>t.id==='lemans'));
const houses=placeImplantation(mans,mans.id,mans.def.implantation).batis.filter(b=>b.type==='hangar');
for(let i=0;i<houses.length;i++)for(let j=i+1;j<houses.length;j++)assert.ok(!sceneryRectsOverlap(sceneryFootprint(houses[i]),sceneryFootprint(houses[j])),'pavillons superposés');
assert.ok(houses.length>5&&houses.every(b=>b.height<=6&&b.w<=11&&b.l<17),'pavillons du Mans trop grands');
// Les empreintes traversant seulement une arête de l'eau sont aussi écartées.
const square={polygon:[[0,0],[10,0],[10,10],[0,10]],bbox:{minX:0,minY:0,maxX:10,maxY:10}};
assert.ok(waterOverlaps(square,[[-1,4],[11,4],[11,6],[-1,6]]));
assert.equal(waterOverlaps(square,[[-5,-5],[-1,-5],[-1,-1],[-5,-1]]),false);
let grass=0,runoffs=0;
for(const def of TRACKS){const t=new Track(def);for(let s=0;s<t.length;s+=5)for(const side of [-1,1]){
 const hw=side>0?t.hwLeftAt(s):t.hwRightAt(s),w=t.runoffWidthAt(s,side);
 const old=hw+Math.max(t.kerbAt(s)+2.2,w+1.5),now=t.limiteProtection(s,side);
 if(w===0){assert.ok(now-old>=6.7,'barrière restée collée sur '+t.id);grass++;}
 if(w>=6){assert.ok(Math.abs(now-old)<1e-5,'bac ou bitume déplacé');runoffs++;}
 assert.ok(now>=old-1e-6);
}}
console.log('Monaco : '+im.batis.length+' bâtiments/voitures et '+boats.length+' bateaux, eau au bon endroit ; '+grass+' positions herbe éloignées, '+runoffs+' positions en dégagement conservées.');
`,{assert,console,Math,Date});
