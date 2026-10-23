// Offline experiment only. Not included in index.html or in the shipped renderer.
window.installBarrierCachePrototype = function(r) {
 const vector=r._drawBarriers, tiles=new Map();
 const CELL=16,PAD=2,BUDGET=64*1024*1024;
 const stats={bytes:0,created:0,hits:0,evicted:0};
 r.barrierCacheStats=stats;
 r.resetBarrierCache=()=>{tiles.clear();stats.bytes=0;stats.created=0;stats.hits=0;stats.evicted=0;};
 r._drawBarriers=function(g,vis,level=null){
  if(!this.testBarrierCache)return vector.call(this,g,vis,level);
  const scale=Math.min(16,Math.max(4,2**Math.ceil(Math.log2(this.cam.zoom*this.dpr))));
  const angle=this.rotate?-this.camAngle-Math.PI/2:0;
  const c=Math.abs(Math.cos(angle)),sn=Math.abs(Math.sin(angle));
  const rx=(c*this.w+sn*this.h)/2/this.cam.zoom+1;
  const ry=(sn*this.w+c*this.h)/2/this.cam.zoom+1;
  const x0=Math.floor((this.cam.x-rx)/CELL),x1=Math.floor((this.cam.x+rx)/CELL);
  const y0=Math.floor((this.cam.y-ry)/CELL),y1=Math.floor((this.cam.y+ry)/CELL);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const left=x*CELL,top=y*CELL;
   if(!this.barrierArt.some(a=>(level===null||a.level===level)&&a.bbox.maxX>=left-PAD&&a.bbox.minX<=left+CELL+PAD&&a.bbox.maxY>=top-PAD&&a.bbox.minY<=top+CELL+PAD))continue;
   const key=[x,y,scale,this.detail,level].join(':');let tile=tiles.get(key);
   if(!tile){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=(CELL+2*PAD)*scale;
    const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.translate(-left+PAD,-top+PAD);
    const cam=this.cam,w=this.w,h=this.h;
    try{this.cam={...cam,x:left+CELL/2,y:top+CELL/2,zoom:scale};this.w=this.h=CELL*scale;this._barrFusionCle=null;vector.call(this,ctx,vis,level);}
    finally{this.cam=cam;this.w=w;this.h=h;this._barrFusionCle=null;}
    tile={canvas,bytes:canvas.width*canvas.height*4};
    while(stats.bytes+tile.bytes>BUDGET&&tiles.size){const k=tiles.keys().next().value;stats.bytes-=tiles.get(k).bytes;tiles.delete(k);stats.evicted++;}
    tiles.set(key,tile);stats.bytes+=tile.bytes;stats.created++;
   }else{tiles.delete(key);tiles.set(key,tile);stats.hits++;}
   g.drawImage(tile.canvas,PAD*scale,PAD*scale,CELL*scale,CELL*scale,left,top,CELL,CELL);
  }
 };
};
