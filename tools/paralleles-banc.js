// Vérifie les protections et dégagements contre TOUTES les branches éloignées.
'use strict';
const vm=require('node:vm'),assert=require('node:assert/strict');
const {contextFor}=require('./motricite-banc.js');const c=contextFor('live');c.assert=assert;
vm.runInContext(`
const t=new Track(TRACKS.find(d=>d.id==='zandvoort'));
let checks=0;
function clear(x,y,s,pad){
 for(let j=0;j<t.n;j+=2){
  const arc=Math.min(Math.abs(j-s/t.ds),t.n-Math.abs(j-s/t.ds))*t.ds;
  if(arc<48)continue;
  const radius=Math.max(t.hwL[j],t.hwR[j])+t.kerb[j]+pad;
  assert.ok(Math.hypot(x-t.xs[j],y-t.ys[j])>=radius,
   'Empiètement branche '+(s/t.length).toFixed(4)+' vers '+(j/t.n).toFixed(4));checks++;
 }
}
for(const b of t.barriers)for(const u of [0,.25,.5,.75,1]){
 clear(b.ax+(b.bx-b.ax)*u,b.ay+(b.by-b.ay)*u,b.s,1.1);
}
for(let s=0;s<t.length;s+=2)for(const side of [-1,1]){
 const hw=side>0?t.hwLeftAt(s):t.hwRightAt(s),w=t.runoffWidthAt(s,side);
 if(w<.1)continue;
 for(const u of [.25,.5,.75,1]){const p=t.pos(s,side*(hw+w*u));clear(p.x,p.y,s,.25);}
}
console.log('Zandvoort : '+checks+' comparaisons, aucune protection ni zone de dégagement sur une branche parallèle.');
`,c);
