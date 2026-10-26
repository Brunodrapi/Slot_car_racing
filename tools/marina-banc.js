'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=['util','traces','tracks','track','props'].map(f=>fs.readFileSync(__dirname+'/../js/'+f+'.js','utf8').replace(/if \(typeof module[^\n]*\n/g,'').replace(/'use strict';/g,'')).join('\n');
vm.runInNewContext(src+`
const def=TRACKS.find(t=>t.id==='monaco'),T=new Track(def),water=placeWater(T,def.water);
// Le port relevé sur la photo : jamais d'eau sur la piste, ni en deçà de ses protections.
for(let i=0;i<T.n;i+=2)for(const side of [1,-1]){
 const s=i*T.ds,p=T.pos(s,side*T.limiteProtection(s,side));
 assert.ok(!waterContains(water,T.xs[i],T.ys[i])&&!waterContains(water,p.x,p.y),'mer sur la piste ou ses protections à '+i);
}
const port=T.pos(.65*T.length,65),casino=T.pos(.15*T.length,30);
assert.ok(waterContains(water,port.x,port.y),'le bassin du port est vide');
assert.ok(!waterContains(water,casino.x,casino.y),'la mer reste vers le Casino');
for(const f of [.46,.48,.50]){const p=T.pos(f*T.length,35);assert.ok(waterContains(water,p.x,p.y),'mer absente devant le tunnel à '+f);}
// La ville : des centaines d'immeubles relevés, aucun sur la piste, dans l'eau ou sur une barrière.
const im=placeImplantation(T,T.id,def.implantation,water),ville=im.batis.filter(b=>b.ville);
assert.ok(ville.length>600,'la ville relevée a disparu ('+ville.length+')');
for(const t of ['piscine','casino','palace','rond','auditorium'])assert.ok(ville.some(b=>b.repere&&b.type===t),'repère absent : '+t);
for(const b of ville){
 const fp=sceneryFootprint(b);
 assert.ok(!waterOverlaps(water,fp),'bâtiment dans le port');
 assert.ok(!sceneryBarrierOverlap(T,fp),'bâtiment sur une barrière');
 for(const [x,y] of fp){const pr=implProjette(T,x,y);assert.ok(Math.abs(pr.lat)>=T.limiteProtection(pr.s,pr.lat>=0?1:-1)-.01,'bâtiment en deçà des protections');}
}
for(const a of im.arbres)assert.ok(!waterContains(water,a.x,a.y,3),'arbre dans le port');
assert.ok(im.sols.some(z=>z.kind==='jardin'),'les jardins ont disparu');
// Les bateaux, amarrés en épi : coque entière dans l'eau, et pas deux coques l'une sur l'autre.
const boats=placeBoats(T,T.id,water);assert.ok(boats.length>200,'trop peu de bateaux ('+boats.length+')');
const coque=b=>{const w=b.l*(b.id==='superyacht'?.2:.3),c=Math.cos(b.th),s=Math.sin(b.th);
 return [[-b.l/2,-w/2],[b.l/2,-w/2],[b.l/2,w/2],[-b.l/2,w/2]].map(([u,v])=>[b.x+c*u-s*v,b.y+s*u+c*v]);};
for(const b of boats)assert.ok(coque(b).every(([x,y])=>waterContains(water,x,y)),'bateau sur terre');
for(let i=0;i<boats.length;i++)for(let j=i+1;j<boats.length;j++){
 const a=boats[i],c=boats[j];if(Math.hypot(a.x-c.x,a.y-c.y)>(a.l+c.l)/2)continue;
 assert.ok(!sceneryRectsOverlap(coque(a),coque(c)),'deux coques se chevauchent');
}
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
console.log('Monaco : '+ville.length+' bâtiments relevés et '+boats.length+' bateaux, eau au bon endroit ; '+grass+' positions herbe éloignées, '+runoffs+' positions en dégagement conservées.');
`,{assert,console,Math,Date});
