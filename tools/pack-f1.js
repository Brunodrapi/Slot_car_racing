// Usage: node tools/pack-f1.js generated-atlas.png model-id
// Two connected illustrations: overhead above, menu perspective below.
const sharp = require('sharp');
const path = require('path');
async function pack(atlas, id) {
  const { data, info } = await sharp(atlas).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, seen = new Uint8Array(w*h), parts = [];
  for (let p = 0; p < w*h; p++) {
    if (seen[p] || data[p*4+3] < 24) continue;
    const pixels = [p]; seen[p] = 1;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let k = 0; k < pixels.length; k++) {
      const q = pixels[k], x = q%w, y = Math.floor(q/w);
      x0=Math.min(x0,x); x1=Math.max(x1,x); y0=Math.min(y0,y); y1=Math.max(y1,y);
      for (const n of [x>0?q-1:-1, x<w-1?q+1:-1, y>0?q-w:-1, y<h-1?q+w:-1]) {
        if(n>=0 && !seen[n] && data[n*4+3]>=24) { seen[n]=1; pixels.push(n); }
      }
    }
    if(pixels.length>1000) parts.push({pixels,x0,y0,x1,y1});
  }
  parts.sort((a,b)=>b.pixels.length-a.pixels.length);
  if(parts.length<2) throw Error('Two isolated cars required');
  const cars=parts.slice(0,2).sort((a,b)=>a.y0-b.y0);
  for(let i=0;i<2;i++) {
    const b=cars[i], width=b.x1-b.x0+1, height=b.y1-b.y0+1;
    const isolated=Buffer.alloc(width*height*4);
    for(const q of b.pixels) data.copy(isolated,((Math.floor(q/w)-b.y0)*width+q%w-b.x0)*4,q*4,q*4+4);
    const kind=i===0?'top':'pick', out=path.join('sprites',kind,id+'.png');
    await sharp(isolated,{raw:{width,height,channels:4}})
      .resize(420,i===0?205:340,{fit:i===0?'fill':'contain',background:'#00000000'}).png().toFile(out);
    console.log(out);
  }
}
if(require.main===module) pack(process.argv[2],process.argv[3]).catch(e=>{console.error(e);process.exitCode=1;});
module.exports=pack;
