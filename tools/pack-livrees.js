// Extract the four isolated cars from a generated transparent 2×2 atlas.
const sharp = require('sharp');
const path = require('path');
async function pack(atlas, model, variants) {
  const {data, info} = await sharp(atlas).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:w,height:h}=info, seen=new Uint8Array(w*h), parts=[];
  for(let p=0;p<w*h;p++) {
    if(seen[p] || data[p*4+3]<24)continue;
    const queue=[p]; seen[p]=1; let minX=w,minY=h,maxX=0,maxY=0;
    for(let k=0;k<queue.length;k++) {
      const q=queue[k],x=q%w,y=Math.floor(q/w);
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      for(const n of [x>0?q-1:-1,x<w-1?q+1:-1,y>0?q-w:-1,y<h-1?q+w:-1]) {
        if(n>=0&&!seen[n]&&data[n*4+3]>=24){seen[n]=1;queue.push(n);}
      }
    }
    if(queue.length>1000)parts.push({minX,minY,maxX,maxY,area:queue.length,pixels:queue});
  }
  const four=parts.sort((a,b)=>b.area-a.area).slice(0,4).sort((a,b)=>(a.minY+a.maxY)-(b.minY+b.maxY));
  if(four.length!==4)throw Error('Expected four cars');
  const ordered=[...four.slice(0,2).sort((a,b)=>a.minX-b.minX),...four.slice(2).sort((a,b)=>a.minX-b.minX)];
  for(let i=0;i<4;i++) {
    const kind=i<2?'top':'pick', suffix=variants[i%2], b=ordered[i];
    const left=Math.max(0,b.minX-2),top=Math.max(0,b.minY-2);
    const width=Math.min(w,b.maxX+3)-left,height=Math.min(h,b.maxY+3)-top;
    const original=await sharp(path.join('sprites',kind,model+'.png')).metadata();
    const out=path.join('sprites',kind,model+'_'+suffix+'.png');
    // Mask this connected car before cropping: bounding boxes can overlap a neighbour.
    const isolated=Buffer.alloc(width*height*4);
    for(const q of b.pixels) {
      const x=q%w-left,y=Math.floor(q/w)-top;
      data.copy(isolated,(y*width+x)*4,q*4,q*4+4);
    }
    await sharp(isolated,{raw:{width,height,channels:4}}).resize(original.width,original.height,{fit:'contain',background:'#00000000'}).png().toFile(out);
    console.log(out);
  }
}
if(require.main===module)pack(process.argv[2],process.argv[3],process.argv.slice(4)).catch(e=>{console.error(e);process.exitCode=1;});
module.exports=pack;
