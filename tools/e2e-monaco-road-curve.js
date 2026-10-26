const {chromium}=require('playwright'),assert=require('assert/strict'),zones=require('./fixtures/monaco-road-edges.json');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const p=await b.newPage({viewport:{width:1280,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto((process.argv[2]||'http://127.0.0.1:8770')+'/editor.html?decor=monaco');await p.waitForFunction(()=>typeof DEC!=='undefined'&&DEC.track);
 const result=await p.evaluate(zones=>{
   const def=DEC.def0,z=zones.at(-1),t=new Track({...def,roadWidenings:zones},.9),controls=t.roadEdgeControls.get(z),curve=Track.roadCurve(controls,z.points.map(p=>p[0]));
   let maxError=0,count=0;
   for(let i=0;i<t.n;i++){
     const f=i/t.n;if(f<z.points[0][0]||f>z.points.at(-1)[0])continue;
     const q=t.pos(i*t.ds,t.hwL[i]);let d=Infinity;
     for(let j=1;j<curve.length;j++){const a=curve[j-1],b=curve[j],dx=b.x-a.x,dy=b.y-a.y,u=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.y-a.y)*dy)/(dx*dx+dy*dy)));d=Math.min(d,Math.hypot(q.x-a.x-u*dx,q.y-a.y-u*dy));}
     maxError=Math.max(maxError,d);count++;
   }
   const mirrored=JSON.parse(JSON.stringify(zones));mirrored.at(-1).side=-1;
   const inner=new Track({...def,roadWidenings:mirrored},.9),base=new Track({...def,roadWidenings:mirrored.slice(0,-1)},.9);
   let unchanged=true;for(let i=0;i<inner.n;i++)if(inner.hwR[i]!==base.hwR[i])unchanged=false;
   DEC.decor.roadWidenings=zones;DEC.outil='piste';DEC.sel={outil:'piste',zone:zones.length-1};refaire();
   return {count,maxError,valid:!t.roadEdgeInvalid.has(z),miss:t.roadEdgeMisses,invalidInner:inner.roadEdgeInvalid.has(mirrored.at(-1)),unchanged,curve:curve.length,points:controls.length};
 },zones);
 assert(result.valid);assert.equal(result.miss,0);assert(result.count>50);assert(result.maxError<.01);assert(result.curve>result.points*4);assert(result.invalidInner&&result.unchanged);
 await p.waitForTimeout(300);await p.evaluate(()=>{const t=DEC.track,q=t.pos(t.length*.881,0);DEC.rendu.cam.x=q.x;DEC.rendu.cam.y=q.y;DEC.rendu.cam.zoom=9;peindre();});await p.waitForTimeout(150);
 await p.screenshot({path:'/tmp/monaco-curve-verified.png'});assert.deepEqual(errors,[]);console.log('Uploaded Monaco contour: smooth border, no crossings, rejected inner loop preserves road:',result);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
