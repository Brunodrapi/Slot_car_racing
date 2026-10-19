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
 for(const [f,side] of [[.105,-1],[.175,1],[.325,1],[.4,-1],[.775,-1]])surface(su,f,side,3,'gravel');
 // Reprise 0.40 : Casio côté droit et intérieur de Degner bitumés jusqu'au trait vert.
 for(const f of [.575,.825,.845,.855,.868])surface(su,f,-1,3,'asphalt');
 surface(su,.32,-1,6,'asphalt');surface(su,.575,-1,10,'grass');surface(su,.855,-1,17,'asphalt');
 const za=new Track(TRACKS.find(d=>d.id==='zandvoort'),scale);
 assert.ok(za.hwRightAt(.195*za.length)>13*scale,'trait bleu sans élargissement physique');
 assert.ok(Math.abs(za.hwLeftAt(.195*za.length)-6.5*scale)<.001,'mauvais bord élargi');
 assert.ok(Math.abs(za.hwRightAt(.24*za.length)-6.5*scale)<.001,'élargissement hors secteur');
 // .29 côté droit : la reprise 0.40 y trace la séparation (trait blanc), contrôlée plus bas.
 for(const [f,side] of [[.12,-1],[.325,1],[.645,-1],[.87,1]]){
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
/* Reprise 0.40 : les treize circuits annotés (docs/exports-circuits/2026-10-16/*_reprise.png).
   Matières vert/rouge, traits blancs devenus protections, voies des stands déplacées au trait noir,
   croix, surface dessinée et cordes arrondies au trait bleu. */
const T=(id,scale)=>new Track(TRACKS.find(d=>d.id===id),scale);
for(const scale of [.9,1]){
 const mo=T('monza',scale),sp=T('spa',scale),ca=T('castellet',scale),rb=T('redbullring',scale),la=T('laguna',scale);
 for(const side of [-1,1])surface(mo,.175,side,6,'asphalt');           // Rettifilo bitumé
 for(const side of [-1,1])assert.equal(mo.bacW[side>0?'L':'R'][Math.round(.6*mo.n)],0,'gravier à Serraglio');
 surface(sp,.39,1,6,'asphalt');surface(sp,.18,-1,18,'asphalt');          // Combes et Eau Rouge
 // Les stands au trait noir : entrée après la Parabolica, à la sortie de La Source, après l'épingle
 // du Pont, à la sortie du dernier virage du Red Bull Ring et de Laguna.
 for(const [t,from] of [[mo,.95],[sp,.074],[ca,.952],[rb,.978],[la,.932]]){
  assert.ok(Math.abs(t.diff(t.pit.entree,from*t.length))<1,t.id+' : entrée des stands');
  assert.ok(!t.pitAt(t.wrap(t.pit.entree-5)),t.id+' : voie avant son entrée');
 }
 assert.equal(sp.pitAt(.98*sp.length),null,'Spa : ancienne voie du Bus Stop');
 // Surface dessinée : l'intérieur de l'épingle du Pont est bitumé jusqu'au trait vert.
 assert.equal(ca.pads.length,1);
 {const s=.944*ca.length,hw=ca.hwRightAt(s);assert.equal(ca.runoffSurfaceAt(s,-(hw+8)),'asphalt');}
 // Trait bleu : corde arrondie, chaussée resserrée à l'apex et intacte en dehors.
 assert.ok(ca.hwRightAt(.2623*ca.length)<(7-1.2)*scale,'corde de la Sainte-Baume non arrondie');
 assert.ok(Math.abs(ca.hwRightAt(.24*ca.length)-7*scale)<.001,'resserrement hors secteur');
 for(const d of TRACKS){
  const t=new Track(d,scale);
  if(d.barrierPaths)assert.ok(t.barriers.some(b=>b.drawn),d.id+' : traits relevés absents');
  // Aucune protection repliée ni dans la chaussée d'une autre branche.
  for(const b of t.barriers)for(const u of [0,.5,1]){
   const pr=t.project(b.ax+(b.bx-b.ax)*u,b.ay+(b.by-b.ay)*u,b.s,100);
   if(Math.abs(t.diff(pr.s,b.s))<6||t.barrierLevelAt(pr.s)!==(b.level||0))continue;
   const hw=pr.lat>0?t.hwLeftAt(pr.s):t.hwRightAt(pr.s);
   assert.ok(Math.abs(pr.lat)-hw-b.half>1,d.id+' : protection repliée à '+(b.s/t.length).toFixed(3));
  }
  for(const b of t.barriers)if(b.side<0)assert.equal(t.pitAt(b.s),null,d.id+' : voie des stands fermée');
 }
 console.log('Reprise 0.40 ×'+scale+' : 13 circuits, matières, traits, stands et cordes OK');
}
`,c);
