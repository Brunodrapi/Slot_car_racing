// Recette experiment. Extract the existing static passes; never load in the production game.
window.installBackdropCachePrototype=function(r){
 const original=r.draw,source=original.toString();
 const begin=source.indexOf('    // background'),end=source.indexOf('    if (this.showLines)',begin);
 const grid="    if(this.circuitGraphics)this.circuitGraphics.drawGrid(g);\n    this._drawStartLine(g, T);\n    this._drawBoards(g, T, vis); // chiffres et flèches de gameplay conservés, sans panneau ajouté";
 const ds=source.indexOf('    this._drawTas(g, vis);'),de=source.indexOf('    for (const p of this.paths.passerelles)',ds);
 if(begin<0||end<begin||ds<end||de<ds||!source.includes(grid))throw Error('Renderer changed: static-pass markers missing');
 const prelude="const T=race.track,cam=this.cam,W=this.w,H=this.h;const inView=b=>!(b.maxX<vis.minX||b.minX>vis.maxX||b.maxY<vis.minY||b.minY>vis.maxY);";
 const base=new Function('g','vis','race','ui',prelude+source.slice(begin,end).replace('drawYellowFlagZones(g,race,p=>p,T.halfWidth*2,.55);','')+grid);
 const decor=new Function('g','vis','race','ui',source.slice(ds,de));
 let dynamic=source.slice(0,ds)+"    this._paintPrecomputed('decor',g,vis,race,ui);\n"+source.slice(de);
 dynamic=dynamic.replace(grid,'');
 dynamic=dynamic.slice(0,begin)+"    this._paintPrecomputed('base',g,vis,race,ui);\n    drawYellowFlagZones(g,race,p=>p,T.halfWidth*2,.55);\n"+dynamic.slice(end);
 const compiled=new Function('return (function '+dynamic+')')();
 const CELL=64,PAD=3,BUDGET=768*1024*1024;let tiles=new Map(),scale=8;
 r.backdropStats={ready:false,tiles:0,bytes:0,scale:0,buildMs:0,misses:0};
 r.resetBackdrop=()=>{for(const layers of tiles.values())for(const canvas of Object.values(layers))canvas.width=canvas.height=0;tiles.clear();Object.assign(r.backdropStats,{ready:false,tiles:0,bytes:0,scale:0,buildMs:0,misses:0});};
 function bake(x,y,race,ui){
  const cam=r.cam,w=r.w,h=r.h,bc=r.testBarrierCache,sc=r.testSceneCache;
  const left=x*CELL,top=y*CELL,vis={minX:left-PAD,maxX:left+CELL+PAD,minY:top-PAD,maxY:top+CELL+PAD};
  const layers={};
  try{
   r.cam={...cam,x:left+CELL/2,y:top+CELL/2,zoom:scale/r.dpr};r.w=r.h=(CELL+2*PAD)*scale/r.dpr;r.testBarrierCache=r.testSceneCache=false;r._barrFusionCle=null;
   for(const [name,fn] of [['base',base],['decor',decor]]){
    const c=document.createElement('canvas');c.width=c.height=(CELL+2*PAD)*scale;const g=c.getContext('2d');g.scale(scale,scale);g.translate(-left+PAD,-top+PAD);g.lineCap='round';g.lineJoin='round';fn.call(r,g,vis,race,ui);layers[name]=c;
   }
  }finally{r.cam=cam;r.w=w;r.h=h;r.testBarrierCache=bc;r.testSceneCache=sc;r._barrFusionCle=null;}
  return layers;
 }
 r.prepareBackdrop=async function(race,ui,progress,requestedScale=5){
  this.resetBackdrop();const start=performance.now(),keys=new Set(),T=race.track;
  // Prepare a corridor around the whole track, not one huge mostly empty rectangle.
  const radius=96;
  for(let s=0;s<T.length;s+=CELL/2){const p=T.pos(s,0);for(let y=Math.floor((p.y-radius)/CELL);y<=Math.floor((p.y+radius)/CELL);y++)for(let x=Math.floor((p.x-radius)/CELL);x<=Math.floor((p.x+radius)/CELL);x++)keys.add(x+','+y);}
  scale=Math.min(requestedScale,Math.floor(Math.sqrt(BUDGET/(keys.size*2*4))/(CELL+2*PAD)));
  if(scale<2)throw Error('Circuit trop grand pour le budget du fond précalculé');
  let i=0;for(const key of keys){const [x,y]=key.split(',').map(Number);tiles.set(key,bake(x,y,race,ui));i++;if(i%4===0){progress(i,keys.size);await new Promise(done=>setTimeout(done,0));}}
  Object.assign(this.backdropStats,{ready:true,tiles:tiles.size,scale,bytes:tiles.size*2*4*((CELL+2*PAD)*scale)**2,buildMs:performance.now()-start});progress(i,i);
 };
 r._paintPrecomputed=function(layer,g,vis,race,ui){
  const a=r.rotate?-r.camAngle-Math.PI/2:0,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));
  const rx=(c*r.w+s*r.h)/2/r.cam.zoom+1,ry=(s*r.w+c*r.h)/2/r.cam.zoom+1;
  for(let y=Math.floor((r.cam.y-ry)/CELL);y<=Math.floor((r.cam.y+ry)/CELL);y++)for(let x=Math.floor((r.cam.x-rx)/CELL);x<=Math.floor((r.cam.x+rx)/CELL);x++){
   const key=x+','+y,t=tiles.get(key);
   if(t){
    let left=x*CELL,top=y*CELL,right=left+CELL,bottom=top+CELL;
    // Shared edges land on the same physical pixel: no antialiased gaps, no alpha overlap.
    const m=g.getTransform();
    if(Math.abs(m.b)<1e-8&&Math.abs(m.c)<1e-8&&m.a&&m.d){
     left=(Math.round(m.a*left+m.e)-m.e)/m.a;right=(Math.round(m.a*right+m.e)-m.e)/m.a;
     top=(Math.round(m.d*top+m.f)-m.f)/m.d;bottom=(Math.round(m.d*bottom+m.f)-m.f)/m.d;
    }
    g.drawImage(t[layer],PAD*scale,PAD*scale,CELL*scale,CELL*scale,left,top,right-left,bottom-top);
   }
   else{this.backdropStats.misses++;g.save();g.beginPath();g.rect(x*CELL,y*CELL,CELL,CELL);g.clip();(layer==='base'?base:decor).call(this,g,vis,race,ui);g.restore();}
  }
 };
 r.draw=function(...args){return (this.testBackdrop&&this.backdropStats.ready?compiled:original).apply(this,args);};
};
