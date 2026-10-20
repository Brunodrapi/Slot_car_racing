// Pack generated atlases, without painting/recolouring the artwork.
// node tools/pack-cartoon.js model atlas.png
// Keep racing sprite dimensions exactly; selection views keep the new camera aspect.
'use strict';
const fs = require('node:fs'), path = require('node:path'), sharp = require('sharp');
const { MODELS } = require('../js/cars');
const { elements, geometry } = require('./pack-nouvelles-voitures');
async function pack(id, atlas) {
  const model = MODELS.find(m => m.id === id);
  if (!model) throw Error('Unknown model: ' + id);
  const n = model.livrees.length;
  const parts = await elements(atlas, n * 2);
  // Generators can exceed a nominal grid cell by a few pixels. Extract complete
  // connected silhouettes, then order each row by x, never crop at cell borders.
  const rows = [parts.slice(0, n), parts.slice(n)].map(row=>row.sort((a,b)=>a.left-b.left));
  const report = [];
  for (let row = 0; row < 2; row++) for (let col = 0; col < n; col++) {
    const kind = row ? 'pick' : 'top', dest = model.livrees[col][kind];
    const p = rows[row][col];
    const before = await geometry(dest);
    const height = row ? Math.round(before.width * p.height / p.width) : before.height;
    const ratio = p.width / p.height;
    if (!row && Math.abs(ratio / (before.width / before.height) - 1) > 0.3)
      throw Error(`${id}: unexpected overhead silhouette ratio ${ratio.toFixed(2)}`);
    await sharp(p.rgba, {raw:{width:p.width,height:p.height,channels:4}})
      .resize(before.width, height, {fit:'fill'}).png().toFile(dest);
    const after = await geometry(dest);
    report.push({file:dest, before:[before.width,before.height], after:[after.width,after.height],
      generatedAspect:ratio, source:path.basename(atlas)});
  }
  const dir = path.resolve(__dirname, '../docs/sprites-cartoon');
  fs.mkdirSync(dir, {recursive:true});
  fs.writeFileSync(path.join(dir,id+'.json'), JSON.stringify(report,null,2)+'\n');
  console.log(id + ': ' + report.length + ' sprites packed');
}
if (require.main === module) pack(...process.argv.slice(2)).catch(e=>{console.error(e);process.exitCode=1;});
module.exports = {pack};
