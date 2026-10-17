// Vérifie les fichiers réellement utilisés, et la géométrie des livrées générées.
// node tools/sprites-nouveaux-banc.js [rapport.json]
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {geometry}=require('./pack-nouvelles-voitures');
const ROOT=path.resolve(__dirname,'..');
const c=vm.createContext({console});
vm.runInContext(fs.readFileSync(path.join(ROOT,'js/cars.js'),'utf8')+'\nthis.models=MODELS;',c);
const additions=['lotus72','brabhambt46b','williamsfw07','ligierjs11','renaultrs10','250gto','typee','240z','962','xjr9','330p4','p68'];
(async()=>{
  const report=[],all=c.models.filter(m=>!m.custom);
  assert.equal(all.length,25);
  assert.equal(all.flatMap(m=>m.livrees).length,57);
  for(const m of all) for(const l of m.livrees) for(const kind of ['top','pick']) {
    assert(l[kind],`${m.id}/${l.id}: ${kind} absent`);
    const f=path.join(ROOT,l[kind]);assert(fs.existsSync(f),f);
    const g=await geometry(f);assert(g.area>1000,`${f}: image vide`);
    assert(g.area<g.width*g.height*.99,`${f}: fond non transparent`);
    if(!additions.includes(m.id))continue;
    assert.equal(g.width,420,`${f}: largeur`);
    const r={model:m.id,livery:l.id,view:kind,file:l[kind],width:g.width,height:g.height,bbox:g.bbox};
    if(l.id) {
      const b=await geometry(path.join(ROOT,m.livrees[0][kind]));
      assert.equal(g.width,b.width,`${f}: largeur différente`);assert.equal(g.height,b.height,`${f}: hauteur différente`);
      assert.deepEqual(g.bbox,b.bbox,`${f}: rectangle occupé différent`);
      let overlap=0,union=0,difference=0;
      for(let i=0;i<g.data.length;i+=4) {
        const a=g.data[i+3]>=32,bb=b.data[i+3]>=32;
        if(a&&bb) { overlap++;difference+=Math.abs(g.data[i]-b.data[i])+Math.abs(g.data[i+1]-b.data[i+1])+Math.abs(g.data[i+2]-b.data[i+2]); }
        if(a||bb)union++;
      }
      r.silhouetteIoU=overlap/union;r.meanRgbDifference=difference/Math.max(1,overlap*3);
      assert(r.silhouetteIoU>=(kind==='top'?.90:.87),`${f}: silhouette trop différente (${r.silhouetteIoU.toFixed(3)})`);
      assert(r.meanRgbDifference>20,`${f}: peinture trop proche de l'originale`);
    }
    report.push(r);
  }
  assert.equal(report.length,52);
  const broad=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/nouvelles-voitures/elargissement.json'),'utf8'));
  assert.equal(broad.length,24);
  assert.equal(new Set(broad.filter(r=>r.model!=='xjr9').map(r=>r.model)).size,9);
  for(const r of broad) {
    const actual=await geometry(path.join(ROOT,r.file));
    assert.equal(actual.width,r.after.width);assert.equal(actual.height,r.after.height);
    assert.equal(r.factor,1.25);
    if(r.view==='top') { assert.equal(actual.width,r.before.width);assert.equal(actual.height,Math.round(r.before.height*1.25)); }
  }
  if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
  console.log(`${all.length} modèles, 57 livrées, 114 images présentes ; 52 nouveaux sprites contrôlés.`);
  console.log('24 sprites élargis contrôlés : neuf F1 et trois livrées XJR-9, deux vues chacune.');
  const variants=report.filter(r=>r.silhouetteIoU);
  for(const kind of ['top','pick'])console.log(`${kind}: silhouette minimale ${Math.min(...variants.filter(r=>r.view===kind).map(r=>r.silhouetteIoU)).toFixed(3)}`);
})().catch(e=>{console.error(e);process.exitCode=1;});
