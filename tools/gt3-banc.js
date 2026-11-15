// Asset integrity, body/paint consistency and visible rear tires underneath fenders.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {modelsOf,CATEGORIES}=require('../js/cars'),{geometry}=require('./pack-nouvelles-voitures');
const ROOT=path.resolve(__dirname,'..');
(async()=>{
  const models=modelsOf('gt3'),report=[];
  assert.equal(models.length,10);
  for(const m of models){
    assert.equal(m.livrees.length,3);
    assert.equal(m.roadScale,CATEGORIES.find(c=>c.id==='gt').roadScale);
    for(let i=0;i<3;i++){
      const lv=m.livrees[i];
      for(const kind of ['top','pick']){
        const g=await geometry(path.join(ROOT,lv[kind]));
        assert.equal(g.width,420);
        assert(g.area>10000 && g.area<g.width*g.height*.99,lv[kind]+': transparent non-empty sprite');
      }
      const g=await geometry(path.join(ROOT,lv.top)),layout=m.wheelLayouts[i];
      assert.equal(g.height,200);assert(layout.front && layout.rear);
      const coverage=[];
      for(const center of layout.rear.centers){
        const cx=(center.x+.5)*g.width,cy=(center.y+.5)*g.height;
        const w=layout.rear.length*g.width,h=layout.rear.width*g.height;
        let body=0,area=0;
        for(let y=Math.floor(cy-h/2);y<cy+h/2;y++)for(let x=Math.floor(cx-w/2);x<cx+w/2;x++){
          area++;if(x>=0&&y>=0&&x<g.width&&y<g.height&&g.data[(y*g.width+x)*4+3]>=180)body++;
        }
        const ratio=body/area;coverage.push(ratio);
        assert(ratio>.78,lv.top+': rear tire insufficiently covered by fender '+ratio);
        assert(ratio<.99,lv.top+': rear tire completely hidden');
      }
      report.push({car:m.id,livery:lv.id,rearTireBodyCoverage:coverage});
    }
  }
  const geometryReport=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/gt3/geometrie.json')));
  for(const r of geometryReport.sprites.filter(r=>r.silhouetteIoU))
    assert(r.silhouetteIoU>=(r.view==='top'?.97:.90),r.file+': silhouette mismatch');
  // Pink Pig is now the first of the three references the user selected.
  const pig=models[0].livrees.find(l=>l.nom.startsWith('Pink Pig'));assert(pig);
  const g=await geometry(path.join(ROOT,pig.top));let pink=0,red=0;
  for(let k=0;k<g.data.length;k+=4)if(g.data[k+3]>=180){
    const [r,bg,b]=g.data.subarray(k,k+3);
    if(r>180&&bg>75&&b>75&&r>bg*1.15)pink++;
    if(r>80&&r>bg*1.8&&r>b*1.8)red++;
  }
  assert(pink>g.area*.25 && red>g.area*.015,'Pink Pig needs pink paint and red cut lines');
  fs.writeFileSync(path.join(ROOT,'docs/gt3/verification-assets.json'),JSON.stringify(report,null,2)+'\n');
  console.log('10 GT3, 30 liveries, 60 transparent sprites; silhouettes, Pink Pig and rear fender coverage OK.');
})().catch(e=>{console.error(e);process.exitCode=1;});
