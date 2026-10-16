'use strict';
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const {contextFor}=require('./motricite-banc.js');const c=contextFor('live');c.assert=assert;c.CIRCUIT=process.argv[2]||null;
vm.runInContext(fs.readFileSync(__dirname+'/../js/props.js','utf8').replace(/if \(typeof module[^\n]*\n/g,''),c);
vm.runInContext(`
let crossings=0,objects=0,merges=0;
for(const d of TRACKS.filter(d=>!CIRCUIT||d.id===CIRCUIT)){
 const t=new Track(d),bs=t.barriers;let n=0;
 for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){
  const a=bs[i],b=bs[j];if(a.level!==b.level)continue;
  const ux=a.bx-a.ax,uy=a.by-a.ay,vx=b.bx-b.ax,vy=b.by-b.ay,den=ux*vy-uy*vx;
  if(Math.abs(den)<1e-8)continue;const dx=b.ax-a.ax,dy=b.ay-a.ay;
  const u=(dx*vy-dy*vx)/den,v=(dx*uy-dy*ux)/den;
  if(u>1e-4&&u<.9999&&v>1e-4&&v<.9999)n++;
 }
 assert.equal(n,0,d.id+' : barrières en croix au même niveau');crossings+=n;merges+=t.mergedBarriers;
 const im=placeImplantation(t,d.id,d.implantation);
 if(im){
  for(const b of im.batis){assert.ok(!sceneryBarrierOverlap(t,sceneryFootprint(b)),d.id+' : bâtiment sur une barrière');objects++;}
  for(const a of im.arbres){const k=TOP_KINDS.find(k=>k.id===a.id);assert.ok(!sceneryCircleNearBarrier(t,a,(k?.wm||9)*(a.e||1)*.55));objects++;}
 }
 for(const tu of t.tunnels){
  const s=(tu.from+tu.n/2)*t.ds;
  for(const side of [-1,1]){
   const hw=side>0?t.hwLeftAt(s):t.hwRightAt(s);
   assert.ok(Math.abs(t.limiteProtection(s,side)-(hw+t.kerbAt(s)+1.1))<.001,d.id+' : barrière éloignée dans le tunnel');
  }
 }
 console.log(d.id+': 0 croisement, '+t.mergedBarriers+' fusions');
}
if(!CIRCUIT)assert.ok(merges>0);
console.log('Décor/protections : '+objects+' empreintes contrôlées ; tunnels resserrés et niveaux séparés.');
`,c);
