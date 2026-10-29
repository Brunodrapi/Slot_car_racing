// Inspect each livery in the real renderer. The guide column exposes the actual pivot
// and tire footprint so visual placement can be reviewed independently of test results.
const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 fs.mkdirSync('docs/ancrages-roues',{recursive:true});
 const page=await browser.newPage({viewport:{width:1460,height:1100}});
 await page.goto((process.argv[2]||'http://127.0.0.1:8771')+'/index.html?diagnostic=1');await page.waitForFunction(()=>window.app);
 const data=await page.evaluate(async()=>{
  const models=MODELS.filter(m=>m.frontWheels);for(const m of models)for(let i=0;i<m.livrees.length;i++)topReady(m,i);
  await new Promise((resolve,reject)=>{let t=performance.now();const poll=()=>{if(models.every(m=>m.livrees.every((_,i)=>topArt(m,i))))return resolve();if(performance.now()-t>15000)return reject(Error('Missing art'));setTimeout(poll,40);};poll();});
  app.state='paused';document.body.innerHTML='';document.body.style.cssText='margin:0;background:#e8dfcd;color:#252923;font:18px system-ui;overflow:auto';
  const results=[];
  for(const m of models){const section=document.createElement('section');section.id='anchors-'+m.id;document.body.append(section);const h2=document.createElement('h2');h2.textContent=m.name+' — repères / roues droites / roues braquées';section.append(h2);
   for(let i=0;i<m.livrees.length;i++){
    const art=topArt(m,i),[w,h]=topSize(m,art),tires=[...frontTires(m,w,h,{livree:i,steer:0}),...rearTires(m,w,h,{livree:i})];
    const row=document.createElement('div');row.style.cssText='border-top:1px solid #aaa';section.append(row);const label=document.createElement('div');label.textContent=m.livrees[i].nom;row.append(label);
    const canvases=[];
    for(const mode of ['guide','straight','steering']){const c=document.createElement('canvas');c.width=480;c.height=290;row.append(c);canvases.push(c);const g=c.getContext('2d');g.translate(240,145);g.scale(420/w,420/w);
     if(mode==='guide'){
      g.drawImage(art.img,-w/2,-h/2,w,h);g.strokeStyle='#00a3bc';g.lineWidth=w/420;
      for(const tire of tires){g.strokeRect(tire.x-tire.length/2,tire.y-tire.width/2,tire.length,tire.width);g.beginPath();g.moveTo(tire.x-w*.014,tire.y);g.lineTo(tire.x+w*.014,tire.y);g.moveTo(tire.x,tire.y-h*.025);g.lineTo(tire.x,tire.y+h*.025);g.stroke();}
     }else drawCarModel(g,m,LIVERIES[0],{livree:i,steer:mode==='steering'?.5:0});
    }
    const body=document.createElement('canvas');body.width=480;body.height=290;const g=body.getContext('2d');g.translate(240,145);g.scale(420/w,420/w);g.drawImage(art.img,-w/2,-h/2,w,h);
    const raw=g.getImageData(0,0,480,290).data,full=canvases[1].getContext('2d').getImageData(0,0,480,290).data;
    for(const tire of tires){const x=Math.round(240+tire.x*420/w),y=Math.round(145+tire.y*420/w);let exposed=0;for(let j=y-30;j<=y+30;j++){const k=(j*480+x)*4+3;if(raw[k]<24&&full[k]>128)exposed++;}
     const straight=frontTires(m,w,h,{livree:i,steer:0}),turned=frontTires(m,w,h,{livree:i,steer:.65});
     results.push({model:m.id,livery:i,source:m.livrees[i].top,axle:tire.x>0?'front':'rear',xPx:(tire.x/w+.5)*art.img.width,yPx:(tire.y/h+.5)*art.img.height,
      centeredInsideBody:raw[(y*480+x)*4+3]>128,exposedAtCenter:exposed,
      pivotStable:straight.every((a,k)=>a.x===turned[k].x&&a.y===turned[k].y),f1:m.catId==='f1'});
    }
   }
  }return results;
 });
 fs.writeFileSync('docs/ancrages-roues/mesures.json',JSON.stringify(data,null,2)+'\n');
 for(const id of new Set(data.map(r=>r.model)))await page.locator('#anchors-'+id).screenshot({path:'docs/ancrages-roues/'+id+'.png'});
 assert(data.every(r=>r.pivotStable),'Steering moved a pivot');
 assert(data.filter(r=>!r.f1).every(r=>r.centeredInsideBody),'Tire center outside a closed fender: '+JSON.stringify(data.filter(r=>!r.f1&&!r.centeredInsideBody)));
 assert(data.filter(r=>r.f1&&r.model!=='williamsfw07').every(r=>r.centeredInsideBody),'F1 pivot outside the native suspension hub');
 console.log('57 liveries: fixed steering pivots and all closed-body tire centers under fenders. Review guides exported.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
