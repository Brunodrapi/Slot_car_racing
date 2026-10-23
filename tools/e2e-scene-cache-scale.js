// Regression: screen-aligned tree sprites must keep their world size when baked into tiles.
const {chromium}=require('playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const p=await b.newPage();await p.goto((process.argv[2]||'http://127.0.0.1:8765')+'/tools/diagnostic-pc.html');await p.waitForFunction(()=>!document.querySelector('#start').disabled);await p.click('#start');
 const rows=await p.evaluate(()=>{
  const w=document.querySelector('iframe').contentWindow,a=w.app,r=a.renderer;a.state='paused';
  const sprite=w.document.createElement('canvas');sprite.width=sprite.height=64;sprite.getContext('2d').fillRect(0,0,64,64);
  r.topArt={test:{canvas:sprite,wm:6}};r.tas=[];r.barrierArt=[];r.rotate=false;r.testBarrierCache=false;
  const rows=[];
  for(const source of ['props','implantation'])for(const x of [16,31.5])for(const zoom of [10,20,40])for(const dpr of [.8,1,2]){
   const tree={id:'test',x,y:x,e:1,_r:3};r.topProps=source==='props'?[tree]:[];
   r.implantation=source==='implantation'?{cell:40,marge:5,cases:new Map([[Math.floor(x/40)+','+Math.floor(x/40),[tree]]])}:null;
   r.cam={x,y:x,zoom,init:true};r.dpr=dpr;r.w=r.h=512;r.resetSceneCache();
   const cam=r.cam;
   const render=cache=>{
    r.testSceneCache=cache;const canvas=w.document.createElement('canvas');canvas.width=canvas.height=1024;const g=canvas.getContext('2d');
    g.translate(512,512);g.scale(zoom*dpr,zoom*dpr);g.translate(-x,-x);
    const vis={minX:x-100,maxX:x+100,minY:x-100,maxY:x+100};
    for(const n of ['_drawTas','_drawImplantation','_drawTopProps','_drawBarriers'])r[n](g,vis);
    const data=g.getImageData(0,0,1024,1024).data;let minX=1024,maxX=-1,minY=1024,maxY=-1,count=0;
    for(let y=0;y<1024;y++)for(let x=0;x<1024;x++)if(data[(y*1024+x)*4+3]>128){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);count++;}
    return {width:maxX-minX+1,height:maxY-minY+1,count};
   };
   const vector=render(false),cached=render(true);if(r.cam!==cam||r.w!==512||r.h!==512)throw Error('Renderer state leaked');
   rows.push({source,x,zoom,dpr,vector,cached});
  }
  return rows;
 });
 for(const r of rows){assert(Math.abs(r.vector.width-r.cached.width)<=4,JSON.stringify(r));assert(Math.abs(r.vector.height-r.cached.height)<=4,JSON.stringify(r));assert(Math.abs(r.vector.count-r.cached.count)/r.vector.count<.06,JSON.stringify(r));}
 console.log(rows.length+' tree-size comparisons (props and implantation, zoom, DPR, tile seams), state restoration: OK');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
