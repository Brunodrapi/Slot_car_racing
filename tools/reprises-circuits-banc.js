// Annotated red/green/blue surfaces and Suzuka's bridge-only underpass.
'use strict';
const vm=require('node:vm'),assert=require('node:assert/strict'),{contextFor}=require('./motricite-banc.js');const c=contextFor('live');c.assert=assert;
vm.runInContext(`
const surface=(t,f,side,off,wanted)=>{const s=f*t.length,hw=side>0?t.hwLeftAt(s):t.hwRightAt(s);assert.equal(t.runoffSurfaceAt(s,side*(hw+off)),wanted,t.id+' '+f);};
for(const scale of [.9,1]){
 const su=new Track(TRACKS.find(d=>d.id==='suzuka'),scale);
 assert.equal(su.tunnels.length,0,'Suzuka ne possède pas de tunnel');assert.equal(su.crossings.length,1);assert.equal(su.underpasses.length,1);
 const pass=su.underpasses[0];assert.ok(pass.half*2<25,'ouvrage trop long');
 assert.equal(su._structureBlend(pass.s),1);assert.equal(su._structureBlend(pass.s+pass.half+20),0);
 assert.equal(su.barrierLevelAt(pass.s),0);assert.equal(su.barrierLevelAt(su.crossings[0].over*su.ds),1);
 for(const [f,side] of [[.105,-1],[.175,1],[.325,1],[.4,-1],[.775,-1],[.868,-1]])surface(su,f,side,3,'gravel');
 for(const f of [.575,.825,.845])surface(su,f,-1,3,'asphalt');
 surface(su,.575,-1,10,'grass');surface(su,.855,-1,17,'gravel');
 const za=new Track(TRACKS.find(d=>d.id==='zandvoort'),scale);
 assert.ok(za.hwRightAt(.195*za.length)>13*scale,'trait bleu sans élargissement physique');
 assert.ok(Math.abs(za.hwLeftAt(.195*za.length)-6.5*scale)<.001,'mauvais bord élargi');
 assert.ok(Math.abs(za.hwRightAt(.24*za.length)-6.5*scale)<.001,'élargissement hors secteur');
 for(const [f,side] of [[.12,-1],[.29,-1],[.325,1],[.645,-1],[.87,1]]){
  surface(za,f,side,3,'grass');assert.equal(za.runoffWidthAt(f*za.length,side),0,'croix ignorée');
  const hw=side>0?za.hwLeftAt(f*za.length):za.hwRightAt(f*za.length);
  assert.ok(za.limiteProtection(f*za.length,side)<=hw+za.kerbAt(f*za.length)+1.501,'barrière trop éloignée dans un secteur barré');
 }
 for(const [f,side] of [[.12,-1],[.29,-1],[.325,1],[.645,-1],[.87,1]])assert.ok(za.barriers.some(b=>b.side===side&&b.kind==='rail'&&Math.abs(za.diff(b.s,f*za.length))<12),'barrière absente dans une zone barrée');
 for(const [f,side] of [[.075,1],[.155,1],[.37,1],[.58,-1],[.82,1]])surface(za,f,side,3,'gravel');
 surface(za,.715,1,3,'asphalt');
 for(const t of [su,za])for(const key of ['L','R'])for(let i=0;i<t.n;i++){
  assert.ok(Number.isFinite(t.bacW[key][i])&&Number.isFinite(t.asphaltW[key][i]));
  assert.ok(Math.abs(t.hwL[i]-t.hwL[(i+1)%t.n])<.6&&Math.abs(t.hwR[i]-t.hwR[(i+1)%t.n])<.6,'raccord de chaussée brutal');
 }
 console.log('Suzuka / Zandvoort ×'+scale+': annotations, largeur physique et passage sous pont OK');
}
`,c);
