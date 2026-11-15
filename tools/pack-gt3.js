// Generated paint stays in the source atlases. This tool only isolates, frames,
// measures and registers wheel anchors, including the two-pixel rear tire fringe.
// node tools/pack-gt3.js [docs/gt3/sources.json]
'use strict';
const fs = require('node:fs'), path = require('node:path'), sharp = require('sharp');
const {elements, geometry} = require('./pack-nouvelles-voitures');
const ROOT = path.resolve(__dirname, '..');
const absolute = f => path.resolve(ROOT, f);

async function main(manifest = 'docs/gt3/sources.json') {
  const sources = JSON.parse(fs.readFileSync(absolute(manifest), 'utf8'));
  const {modelsOf} = require('../js/cars');
  const report = [], anchors = [], cache = new Map();
  async function parts(file, count, columns) {
    const key = file + ':' + count;
    if (!cache.has(key)) {
      // Exclude soft generated halos; keep the opaque illustrated silhouettes.
      const p = await elements(absolute(file), count, 180);
      const ordered = [];
      for (let i = 0; i < p.length; i += columns)
        ordered.push(...p.slice(i, i + columns).sort((a,b) => a.left - b.left));
      cache.set(key, ordered);
    }
    return cache.get(key);
  }
  for (const m of modelsOf('gt3')) {
    const s = sources[m.id];
    if (!s) throw Error('Missing source: ' + m.id);
    const selected = s.atlas ? await parts(s.atlas, 6, 2) : null;
    const menus = s.menus ? await parts(s.menus.file, s.menus.count, s.menus.columns) : null;
    const base = selected ? null : await parts(s.base, 2, 1);
    const variants = selected ? null : await parts(s.variants, 4, 2);
    const overhead = selected ? null : await parts(s.overhead.file, s.overhead.count, s.overhead.columns);
    // Keep the approved menu frame instead of deriving a new size from each repaint.
    const pickHeight = s.frame?.pick?.[1] || Math.round(420 * base[1].height / base[1].width);
    for (let i = 0; i < 3; i++) for (const kind of ['top', 'pick']) {
      const override = !selected && kind === 'top' && s.overhead.overrides && s.overhead.overrides[i];
      const p = kind === 'pick' && menus ? menus[i] : selected ? selected[i * 2 + (kind === 'pick' ? 1 : 0)] :
        override ? (await parts(override, 1, 1))[0] : kind === 'top' ? overhead[s.overhead.offset + i] : i ? variants[i + 1] : base[1];
      const file = m.livrees[i][kind];
      await sharp(p.rgba, {raw:{width:p.width,height:p.height,channels:4}})
        .resize(420, kind === 'top' ? 200 : pickHeight,
          {fit:kind === 'pick' && s.pickFit === 'contain' ? 'contain' : 'fill', background:{r:0,g:0,b:0,alpha:0}})
        .png().toFile(absolute(file));
      const g = await geometry(absolute(file));
      const row = {model:m.id,livery:m.livrees[i].id,view:kind,file,width:g.width,height:g.height,bbox:g.bbox};
      if (i) {
        const ref = await geometry(absolute(m.livrees[0][kind]));
        let intersection=0, union=0;
        for(let k=3;k<g.data.length;k+=4) {
          const a=g.data[k]>=32, b=ref.data[k]>=32;
          if(a&&b)intersection++;if(a||b)union++;
        }
        row.silhouetteIoU = intersection / union;
      }
      report.push(row);
      if (kind !== 'top') continue;
      // The opaque fender edge at each axle determines tire position, separately
      // for each drawing. Tires are underneath the intact painted body.
      const [frontX,rearX] = s.axles;
      function axle(x, length, width, protrusion) {
        const column = Math.round(x * (g.width-1));
        let top=g.height, bottom=0;
        for(let y=0;y<g.height;y++) if(g.data[(y*g.width+column)*4+3]>=180) {
          top=Math.min(top,y);bottom=Math.max(bottom,y);
        }
        if(bottom<=top)throw Error(file+': empty axle column');
        const half=width*g.height/2;
        return [x,(top+half-protrusion)/g.height,(bottom-half+protrusion)/g.height,length,width];
      }
      anchors.push({id:path.basename(file,'.png'),front:axle(frontX,.125,.12,2),rear:axle(rearX,.135,.13,2)});
    }
  }
  let cars=fs.readFileSync(absolute('js/cars.js'),'utf8');
  const block='// GT3_WHEELS_BEGIN\n'+anchors.map(a=>
    `registerWheelSprite('${a.id}', spriteAxle(${a.front.map(x=>+x.toFixed(5)).join(',')}), spriteAxle(${a.rear.map(x=>+x.toFixed(5)).join(',')}));`).join('\n')+'\n// GT3_WHEELS_END';
  if(cars.includes('// GT3_WHEELS_BEGIN'))cars=cars.replace(/\/\/ GT3_WHEELS_BEGIN[\s\S]*?\/\/ GT3_WHEELS_END/,block);
  else cars=cars.replace('function frontWheelLayout(m)',block+'\nfunction frontWheelLayout(m)');
  fs.writeFileSync(absolute('js/cars.js'),cars);
  fs.writeFileSync(absolute('docs/gt3/geometrie.json'),JSON.stringify({sprites:report,anchors},null,2)+'\n');
  console.log(`${report.length} GT3 sprites; ${anchors.length} measured front/rear wheel layouts.`);
  for(const kind of ['top','pick'])console.log(`${kind}: minimum silhouette overlap ${Math.min(...report.filter(r=>r.view===kind&&r.silhouetteIoU).map(r=>r.silhouetteIoU)).toFixed(3)}`);
}
if(require.main===module)main(process.argv[2]).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={main};
