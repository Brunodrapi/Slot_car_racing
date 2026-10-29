// Real renderer review: all affected liveries, with and without steering.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:1000,height:1000}});
    await page.goto((process.argv[2]||'http://127.0.0.1:8771')+'/index.html?diagnostic=1');
    await page.waitForFunction(()=>window.app);
    const checks=await page.evaluate(async()=>{
      const models=['ferrari312t','williamsfw07','lotus79','countach','gt40','935'].map(modelById);
      for(const m of models)for(let i=0;i<m.livrees.length;i++)topReady(m,i);
      await new Promise((resolve,reject)=>{const start=performance.now();const poll=()=>{
        if(models.every(m=>m.livrees.every((_,i)=>topReady(m,i))))return resolve();
        if(performance.now()-start>15000)return reject(Error('Missing sprites'));setTimeout(poll,50);
      };poll();});
      app.state='paused';document.body.innerHTML='';
      document.body.style.cssText='margin:0;background:#eadfc4;color:#202421;font:20px sans-serif;overflow:auto';
      const checks=[];
      for(const m of models){
        const section=document.createElement('section');section.id='review-'+m.id;document.body.append(section);
        const title=document.createElement('h2');title.textContent=m.name;section.append(title);
        for(let i=0;i<m.livrees.length;i++){
          const [w,h]=topSize(m,topArt(m,i)), row=document.createElement('div');section.append(row);
          for(const steer of [0,.5]){
            const c=document.createElement('canvas');c.width=480;c.height=280;row.append(c);
            const g=c.getContext('2d');g.translate(240,140);g.scale(420/w,420/w);
            drawCarModel(g,m,LIVERIES[0],{livree:i,steer});
          }
          if(['gt40','935'].includes(m.id)){
            // Each wheel must expose some tread at neutral, but only a narrow strip
            // at its center. Sample actual body alpha and actual rendered alpha.
            const c=row.firstChild, full=c.getContext('2d').getImageData(0,0,480,280).data;
            const body=document.createElement('canvas');body.width=480;body.height=280;
            const g=body.getContext('2d');g.translate(240,140);g.scale(420/w,420/w);
            g.drawImage(topArt(m,i).img,-w/2,-h/2,w,h);
            const original=g.getImageData(0,0,480,280).data;
            for(const tire of [...frontTires(m,w,h,{steer:0}),...rearTires(m,w,h)]){
              const x=Math.round(240+tire.x*420/w),cy=Math.round(140+tire.y*420/w);
              let exposed=0;
              for(let y=cy-20;y<=cy+20;y++){
                const k=(y*480+x)*4+3;if(full[k]>128&&original[k]<24)exposed++;
              }
              checks.push({id:m.id,livery:i,axle:tire.x>0?'front':'rear',side:Math.sign(tire.y),exposed});
            }
          }
        }
      }
      return checks;
    });
    assert(checks.every(c=>c.exposed>=1&&c.exposed<=8),JSON.stringify(checks));
    for(const id of ['ferrari312t','williamsfw07','lotus79','countach','gt40','935'])
      await page.locator('#review-'+id).screenshot({path:`docs/essieux-ailes/${id}.png`});
    require('fs').writeFileSync('docs/essieux-ailes/pneus-visibles.json',JSON.stringify(checks,null,2)+'\n');
    console.log('24 wheel centers: visible tread between 1 and 8 pixels at 420px car length.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
