// Regression: Hunserug runoff must not cover the three operational pit garages.
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {contextFor}=require('./motricite-banc.js'),c=contextFor('live');c.assert=assert;
vm.runInContext(fs.readFileSync(__dirname+'/../js/props.js','utf8').replace(/if \(typeof module[^\n]*\n/g,''),c);
vm.runInContext(`
const d=TRACKS.find(d=>d.id==='zandvoort');
for(const scale of [.9,1]){
 const t=new Track(d,scale),garages=t.pitGarages();assert.equal(garages.length,3);
 for(const g of garages){
  const cs=Math.cos(g.a),sn=Math.sin(g.a);
  const poly=[[-g.w/2,-g.h/2],[g.w/2,-g.h/2],[g.w/2,g.h/2],[-g.w/2,g.h/2]].map(([x,y])=>[g.x+cs*x-sn*y,g.y+sn*x+cs*y]);
  assert.ok(t.pitAt(g.s)?.ecart===1,'garage hors de la partie droite de la voie');
  assert.ok(!sceneryBarrierOverlap(t,poly),'barrière dans un garage');
  for(let i=0;i<t.n;i+=2){
   const road=[[i,1],[i+2,1],[i+2,-1],[i,-1]].map(([s,side])=>{const p=t.pos(s,side*(side>0?t.hwLeftAt(s):t.hwRightAt(s)));return[p.x,p.y];});
   assert.ok(!sceneryRectsOverlap(poly,road),'garage sur une piste voisine');
   for(const side of [-1,1]){
    const key=side>0?'L':'R';
    if(t._lerp(t.bacW[key],i)<.001&&t._lerp(t.bacW[key],i+2)<.001)continue;
    const quad=[[i,0],[i+2,0],[i+2,1],[i,1]].map(([s,outer])=>{
     const hw=side>0?t.hwLeftAt(s):t.hwRightAt(s),bw=t._lerp(t.bacW[key],s),aw=Math.min(bw,t._lerp(t.asphaltW[key],s));
     const p=t.pos(s,side*(hw+(outer?bw:aw)));return[p.x,p.y];
    });
    if(Math.max(t._lerp(t.bacW[key],i)-t._lerp(t.asphaltW[key],i),t._lerp(t.bacW[key],i+2)-t._lerp(t.asphaltW[key],i+2))>.001)
      assert.ok(!sceneryRectsOverlap(poly,quad),'gravier sur un garage : '+i/t.n);
   }
  }
 }
 console.log('Zandvoort largeur ×'+scale+': 3 garages, aucun recouvrement piste/gravier/barrière');
}

(()=>{
const rows=[];
for(const kind of ['direct','traverse','stop']){
 let seed=42761;Math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
 const r=new Race({trackDef:TRACKS.find(t=>t.id==='zandvoort'),classId:'gt',modelId:'m1procar',playerAI:true,mode:'race',wear:true,nCars:2,laps:99,noContact:true}),p=r.player,t=r.track;r.cars=[p];r.state='racing';p.place(t.wrap(t.pit.entree-12),0,18);p.tyre=1;const start=p.progress;
 p.pitAsk=kind!=='direct';let entered=false,done=false;
 for(let i=0;i<120*120;i++){
  if(kind==='traverse'&&p.pitState==='voie')p.pitServi=true;
  r.update(r.dt,aiThrottle(p,r.cars,r.dt,{marginBase:.9,marginSpread:0}));
  if(p.inPit)entered=true;
  if(p.progress-start>t.pit.long+28&&!p.pitState){done=true;break;}
 }
 assert.ok(done,kind+' ne ressort pas');if(kind==='stop')assert.ok(p.pitsDone>=1);if(kind!=='direct')assert.ok(entered);
 rows.push({kind,time:r.time,pits:p.pitsDone,v:p.v,crashes:p.crashes});
}
console.log(JSON.stringify(rows));assert.ok(rows[1].time>rows[0].time,'voie plus rapide que la piste');assert.ok(rows[2].time>rows[1].time,'arrêt gratuit');

})();
`,c,{timeout:120000});
