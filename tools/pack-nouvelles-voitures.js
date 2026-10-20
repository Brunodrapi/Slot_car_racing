// Découpe les illustrations générées : deux vues d'origine, ou quatre vues de deux variantes.
// node tools/pack-nouvelles-voitures.js base atlas.png modele [f1]
// node tools/pack-nouvelles-voitures.js variantes atlas.png modele suffixe1 suffixe2
// La peinture est générée hors de cet outil. Ici : isolation, cadrage et mesures de géométrie.
'use strict';
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');

async function elements(file, count) {
  const {data, info: {width: w, height: h}} = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const seen = new Uint8Array(w*h), parts = [];
  for (let p = 0; p < w*h; p++) {
    if (seen[p] || data[p*4+3] < 24) continue;
    const pixels = [p]; seen[p] = 1;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let k = 0; k < pixels.length; k++) {
      const q = pixels[k], x = q%w, y = Math.floor(q/w);
      x0 = Math.min(x0,x); x1 = Math.max(x1,x); y0 = Math.min(y0,y); y1 = Math.max(y1,y);
      for (const n of [x>0?q-1:-1, x<w-1?q+1:-1, y>0?q-w:-1, y<h-1?q+w:-1]) {
        if (n>=0 && !seen[n] && data[n*4+3]>=24) { seen[n]=1; pixels.push(n); }
      }
    }
    if (pixels.length>1000) parts.push({pixels,x0,y0,x1,y1});
  }
  parts.sort((a,b)=>b.pixels.length-a.pixels.length);
  if (parts.length < count) throw Error(`Attendu ${count} voitures isolées, trouvé ${parts.length}`);
  const cars = parts.slice(0,count).sort((a,b)=>(a.y0+a.y1)-(b.y0+b.y1));
  if (count===4) {
    cars.splice(0,4,...cars.slice(0,2).sort((a,b)=>a.x0-b.x0),...cars.slice(2).sort((a,b)=>a.x0-b.x0));
  }
  return cars.map(b=>{
    const width=b.x1-b.x0+1, height=b.y1-b.y0+1, rgba=Buffer.alloc(width*height*4);
    for (const q of b.pixels) data.copy(rgba,((Math.floor(q/w)-b.y0)*width+q%w-b.x0)*4,q*4,q*4+4);
    return {rgba,width,height,left:b.x0,top:b.y0};
  });
}

async function geometry(file) {
  const {data,info} = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let x0=info.width,y0=info.height,x1=0,y1=0,area=0;
  for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) if(data[(y*info.width+x)*4+3]>=32) {
    area++; x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
  }
  return {data,width:info.width,height:info.height,bbox:{left:x0,top:y0,width:x1-x0+1,height:y1-y0+1},area};
}

async function pack(mode, atlas, id, suffixes) {
  const base = mode==='base';
  const menus = mode==='menus';
  const single = mode==='menu';
  const noseLeft = suffixes.includes('--nose=left');
  suffixes = suffixes.filter(s=>!s.startsWith('--'));
  if (!base && ((!menus && !single && mode!=='variantes')||suffixes.length!==(single?1:2))) throw Error('base atlas modele [f1], variantes/menus atlas modele suffixe1 suffixe2, menu image modele suffixe');
  const parts = await elements(atlas,single?1:base||menus?2:4), report=[];
  for (let i=0;i<parts.length;i++) {
    const kind = menus||single?'pick':i<(base?1:2)?'top':'pick', p=parts[i];
    const name = id + (base?'':'_'+suffixes[i%2]);
    const file=path.join(ROOT,'sprites',kind,name+'.png');
    const raw={width:p.width,height:p.height,channels:4};
    let target, reference;
    if (base) target={width:420,height:kind==='top'?(suffixes[0]==='f1'?205:200):Math.round(420*p.height/p.width)};
    else {
      reference=await geometry(path.join(ROOT,'sprites',kind,id+'.png'));
      target={width:reference.width,height:reference.height};
    }
    await sharp(p.rgba,{raw}).rotate(kind==='top' && noseLeft?180:0)
      .resize(target.width,target.height,{fit:'fill'}).png().toFile(file);
    const result=await geometry(file), row={file:path.relative(ROOT,file),width:result.width,height:result.height,bbox:result.bbox};
    if(reference) {
      let intersection=0,union=0;
      for(let k=3;k<result.data.length;k+=4) {
        const a=result.data[k]>=32,b=reference.data[k]>=32;
        if(a&&b)intersection++;if(a||b)union++;
      }
      row.silhouetteIoU=intersection/union;
      row.aspectSource=p.width/p.height;
      row.aspectReference=target.width/target.height;
    }
    report.push(row);
  }
  const recordFile=path.join(ROOT,'docs/nouvelles-voitures/decoupage.json');
  const records=fs.existsSync(recordFile)?JSON.parse(fs.readFileSync(recordFile,'utf8')):{};
  for(const row of report)records[row.file]={atlas:path.basename(atlas),...row};
  fs.mkdirSync(path.dirname(recordFile),{recursive:true});
  fs.writeFileSync(recordFile,JSON.stringify(records,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  return report;
}
if(require.main===module) pack(...process.argv.slice(2,5),process.argv.slice(5)).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={pack,elements,geometry};
