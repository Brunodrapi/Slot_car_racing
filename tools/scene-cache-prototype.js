// Recette diagnostic only: bounded raster caches for static decoration layers.
window.installSceneCachePrototype=function(r){
 const tiles=new Map(),CELL=32,PAD=3,BUDGET=64*1024*1024;
 const stats=r.sceneCacheStats={bytes:0,created:0,hits:0,evicted:0};
 r.resetSceneCache=()=>{tiles.clear();Object.assign(stats,{bytes:0,created:0,hits:0,evicted:0});};
 function paint(layer,g,args,draw){
  const scale=Math.min(8,Math.max(2,2**Math.ceil(Math.log2(r.cam.zoom*r.dpr))));
  const angle=r.rotate?-r.camAngle-Math.PI/2:0,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
  const rx=(c*r.w+s*r.h)/2/r.cam.zoom+1,ry=(s*r.w+c*r.h)/2/r.cam.zoom+1;
  for(let y=Math.floor((r.cam.y-ry)/CELL);y<=Math.floor((r.cam.y+ry)/CELL);y++)for(let x=Math.floor((r.cam.x-rx)/CELL);x<=Math.floor((r.cam.x+rx)/CELL);x++){
   const left=x*CELL,top=y*CELL,key=[layer,x,y,scale,r.detail,r.cam.zoom>=3].join(':');let t=tiles.get(key);
   if(!t){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=(CELL+2*PAD)*scale;
    const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.translate(-left+PAD,-top+PAD);
    ctx.lineCap='round';ctx.lineJoin='round';
    const vis={minX:left-PAD,maxX:left+CELL+PAD,minY:top-PAD,maxY:top+CELL+PAD};
    draw(ctx,vis,args);
    t={canvas,bytes:canvas.width*canvas.height*4};
    while(tiles.size&&stats.bytes+t.bytes>BUDGET){const k=tiles.keys().next().value;stats.bytes-=tiles.get(k).bytes;tiles.delete(k);stats.evicted++;}
    tiles.set(key,t);stats.bytes+=t.bytes;stats.created++;
   }else{tiles.delete(key);tiles.set(key,t);stats.hits++;}
   g.drawImage(t.canvas,PAD*scale,PAD*scale,CELL*scale,CELL*scale,left,top,CELL,CELL);
  }
 }
 // These four layers are consecutive, below cars and bridges in the original renderer.
 const names=['_drawTas','_drawImplantation','_drawTopProps','_drawBarriers'];
 const originals=Object.fromEntries(names.map(n=>[n,r[n]]));
 r._drawTas=function(g,vis){
  if(!r.testSceneCache)return originals._drawTas.call(r,g,vis);
  paint('objects',g,[],(ctx,v)=>{
   for(const n of names.slice(0,3))originals[n].call(r,ctx,v);
   const cam=r.cam,w=r.w,h=r.h,cached=r.testBarrierCache;
   try{r.cam={...cam,x:(v.minX+v.maxX)/2,y:(v.minY+v.maxY)/2};r.w=(v.maxX-v.minX)*cam.zoom;r.h=(v.maxY-v.minY)*cam.zoom;r.testBarrierCache=false;r._barrFusionCle=null;originals._drawBarriers.call(r,ctx,v);}
   finally{r.cam=cam;r.w=w;r.h=h;r.testBarrierCache=cached;r._barrFusionCle=null;}
  });
 };
 for(const n of names.slice(1))r[n]=function(...args){
  // Preserve the second bridge-level barrier pass (Suzuka), outside this ground cache.
  if(!r.testSceneCache||(n==='_drawBarriers'&&args[2]!=null))return originals[n].apply(r,args);
 };
 const ground=r._drawImplantationSol;
 r._drawImplantationSol=function(g,vis){if(!r.testSceneCache)return ground.call(r,g,vis);paint('ground',g,[],(ctx,v)=>ground.call(r,ctx,v));};
 r.prepareSceneCache=function(){
  const cg=r.circuitGraphics;if(!cg||cg._sceneCacheInstalled)return;cg._sceneCacheInstalled=true;
  for(const n of ['drawTerrain','drawGravel','drawRunoff','drawRoad']){
   const fn=cg[n];cg[n]=function(g,vis,...args){
    if(!r.testSceneCache)return fn.call(this,g,vis,...args);
    paint(n,g,args,(ctx,v,a)=>fn.call(cg,ctx,v,...a));
   };
  }
 };
};
