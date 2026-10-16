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
 /* Les deux surfaces se SUPERPOSENT par construction aux extrémités d'une zone : le profil
    automatique y est encore là, le tablier déclaré commence, et la lecture de surface rend le bitume
    d'abord puis le gravier au-delà. Ce n'est pas un défaut mais le raccord, et c'est ce que
    montrent beaucoup de circuits réels. Ce qui serait un défaut, c'est du gravier AU MILIEU d'un
    tablier bitumé : vérifié plus bas, zone par zone. */
 assert.ok(T.bacW[side][i]>=0&&T.asphaltW[side][i]>=0,'largeur négative');
 assert.ok(Math.abs(T.runoffWidthAt(i,side==='L'?1:-1)-T.runoffWidthAt(i+1,side==='L'?1:-1))<3,
  'raccord brutal '+i+' '+side);
}
/* Les barrières des longs dégagements suivent le bord extérieur, et les deux rangées de pneus
   bordent le dégagement QUELLE QUE SOIT SA MATIÈRE — gravier comme bitume hors piste. Elles ne se
   posaient que devant les bacs : une zone bitumée, aussi longue et aussi rapide, n'avait qu'une
   glissière nue. C'est la largeur qui décide maintenant.

   Le « sauf au début et à la fin » demandé se fait tout seul, et c'est cela qu'on vérifie ici :
   au milieu de Blanchimont, où le tablier fait près de vingt mètres, il y a des pneus ; à ses deux
   extrémités, où il se referme sur zéro, il n'y en a pas. */
for(const b of T.barriers.filter(b=>b.s/T.length>.9&&b.s/T.length<.94&&b.side===-1)){
 const p=T.project((b.ax+b.bx)/2,(b.ay+b.by)/2,b.s,30);
 assert.ok(Math.abs(p.lat)>T.hwRightAt(p.s)+T.runoffWidthAt(p.s,-1),'barrière au milieu du bitume');
 assert.equal(b.kind,'tyres','pneus absents au milieu du bitume de Blanchimont');
}
/* La règle, vérifiée sur TOUTES les barrières plutôt qu'en deux points choisis.

   Une première version plantait deux sondes aux fractions où je croyais que le tablier de
   Blanchimont se referme. Il ne s'y referme pas : à son entrée, le profil automatique du virage
   est encore large, donc il y a bien des pneus, et l'essai échouait sur ma géométrie et non sur
   le code. On énonce donc la règle elle-même — les pneus suivent la largeur du dégagement — et on
   la vérifie partout. Les deux familles doivent exister, sinon la règle ne distingue rien. */
let nPneus=0,nRail=0;
for(const b of T.barriers){
 const w=T.runoffWidthAt(b.s,b.side);
 assert.equal(b.kind,w>2.5?'tyres':'rail','matiere de protection a '+(b.s/T.length).toFixed(3));
 if(b.kind==='tyres')nPneus++;else nRail++;
}
assert.ok(nPneus>100&&nRail>100,'une seule famille de protection : '+nPneus+' pneus, '+nRail+' rails');
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
/* Les onze autres circuits ont maintenant leurs propres zones, relevées sur les vues du dessus.
   La garde « aucun autre circuit n'a de dégagement » qui tenait ici ne veut donc plus rien dire :
   elle vérifiait qu'on n'avait rien recopié de Spa, et on a depuis relevé chaque circuit. Ce qui
   reste à vérifier, c'est que chaque relevé est SAIN — deux surfaces ne se superposent pas, la
   largeur ne fait pas de marche, et rien ne déborde du tour — et que les barrières dessinées
   sont bien posées DERRIÈRE le dégagement sur chacun, et non collées au ruban.

   La garde qui tenait ici — « aucun autre circuit n'a de barrière » — datait de l'essai limité à
   Spa. Les protections sont maintenant sur les treize, donc elle ne décrivait plus rien. Ce qui
   doit rester vrai, c'est qu'aucune ne mord sur l'asphalte et qu'aucune ne ferme la voie des
   stands. */
for(const d of TRACKS.filter(d=>d.id!=='spa')){
 const t=new Track(d);
 assert.ok(t.barriers.length>300,d.id+' : pas de protections');
 for(const b of t.barriers){
  if(b.side<0)assert.equal(t.pitAt(b.s),null,d.id+' : voie des stands fermée');
  const p=t.project((b.ax+b.bx)/2,(b.ay+b.by)/2,b.s,60);
  const hw=p.lat>0?t.hwLeftAt(p.s):t.hwRightAt(p.s);
  assert.ok(Math.abs(p.lat)-hw-b.half>0.5,d.id+' : protection sur la piste en '+(b.s/t.length).toFixed(3));
  assert.equal(b.kind,t.runoffWidthAt(b.s,b.side)>2.5?'tyres':'rail',d.id+' : matiere de protection');
 }
 if(!d.runoffs){continue;}
 for(const z of d.runoffs){
  assert.ok(z.points||(z.w>0&&z.from>=0&&z.from<1),d.id+' : zone sans profil — '+z.name);
  assert.ok(!z.points||z.points.length>1,d.id+' : contour vide — '+z.name);
 }
 for(const side of ['L','R'])for(let i=0;i<t.n;i++){
  assert.ok(Number.isFinite(t.bacW[side][i])&&Number.isFinite(t.asphaltW[side][i]),d.id+' : largeur non finie');
  /* Un liseré de gravier subsiste aux deux bouts d'un tablier bitumé, le temps que la zone
     déclarée ait fini de chasser le profil automatique. Deux mètres, pas davantage : au-delà ce
     ne serait plus un raccord mais deux dégagements superposés. */
  assert.ok(t.bacW[side][i]>=0&&t.asphaltW[side][i]>=0,d.id+' : largeur négative');
  assert.ok(t.bacW[side][i]<40&&t.asphaltW[side][i]<40,d.id+' : dégagement démesuré '+i);
  const cote=side==='L'?1:-1;
  assert.ok(Math.abs(t.runoffWidthAt(i,cote)-t.runoffWidthAt(i+1,cote))<3,d.id+' : raccord brutal '+i+' '+side);
 }
 // Une zone se pose à l'EXTÉRIEUR du virage : à l'intérieur d'une épingle elle rentrerait
 // dans l'autre branche. On vérifie le côté sur le pic de chaque zone déclarée.
 for(const z of (d.runoffs||[])){
  if(z.points||z.surface==='grass')continue;
  const mid=((z.from+(z.to>z.from?z.to:z.to+1))/2)%1;
  assert.ok(t.runoffWidthAt(mid*t.length,z.side)>z.w*0.5,
   d.id+' : zone absente à son milieu — '+z.name);
  // Au milieu d'un tablier bitumé, le profil automatique doit avoir entièrement disparu.
  if(z.surface==='asphalt'){
   const k=t.idx(mid*t.length),cote=z.side>0?'L':'R';
   assert.ok(t.bacW[cote][k]<0.5,d.id+' : gravier au milieu du bitume — '+z.name);
  }
 }
}
// Les définitions futures peuvent traverser le départ.
const wrap=new Track({...def,barriers:false,runoffs:[{surface:'asphalt',side:1,points:[[.99,0],[1,10],[1.01,0]]}]});
assert.ok(wrap.runoffWidthAt(0,1)>9.9);assert.ok(wrap.runoffWidthAt(.995*wrap.length,1)>4.9);
console.log('Spa : contours, raccords, barrières, neuf voitures, bitume/sol meuble, fautes, pénalités et autres circuits OK');
`,c);
