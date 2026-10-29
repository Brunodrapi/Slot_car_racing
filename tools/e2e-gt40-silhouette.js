const {chromium}=require('playwright'),assert=require('assert/strict'),fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const p=await b.newPage({viewport:{width:1200,height:940}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto((process.argv[2]||'http://127.0.0.1:8771')+'/index.html?diagnostic=1');await p.waitForFunction(()=>window.app);
 const results=await p.evaluate(async()=>{
  const m=modelById('gt40');for(let i=0;i<3;i++)topReady(m,i);await new Promise((resolve,reject)=>{const start=performance.now(),poll=()=>{if([0,1,2].every(i=>topReady(m,i)))return resolve();if(performance.now()-start>10000)return reject(Error('Loading'));setTimeout(poll,50);};poll();});
  app.state='paused';document.body.innerHTML='';document.body.style.cssText='margin:0;background:#e8dfcd;color:#222;font:20px system-ui;overflow:auto';
  const title=document.createElement('h2');title.textContent='GT40 — ancienne silhouette / nouvelle silhouette';title.style.margin='20px';document.body.append(title);
  const results=[];
  for(let i=0;i<3;i++){
   const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:40px;margin:20px 40px';document.body.append(row);
   const img=new Image();img.src='docs/gt40-silhouette/avant/'+['gt40','gt40_lemans1','gt40_lemans2'][i]+'.png';await img.decode();img.style.cssText='width:420px;height:208px';row.append(img);
   const art=topArt(m,i),[w,h]=topSize(m,art);
   const frame=(steer,body=false)=>{const c=document.createElement('canvas');c.width=460;c.height=250;const g=c.getContext('2d');g.translate(230,125);g.scale(420/w,420/w);if(body)g.drawImage(art.img,-w/2,-h/2,w,h);else drawCarModel(g,m,LIVERIES[0],{livree:i,steer});return c;};
   row.append(frame(0));
   const body=frame(0,true).getContext('2d').getImageData(0,0,460,250).data;
   for(const steer of [0,-.65,.65]){const full=frame(steer).getContext('2d').getImageData(0,0,460,250).data;let outside=0;for(let k=3;k<body.length;k+=4)if(body[k]<24&&full[k]>=24)outside++;results.push({livery:i,steer,outside});}
  }
  return results;
 });assert(results.every(r=>r.outside>0 && r.outside<(r.steer===0?1200:3000)),JSON.stringify(results));await p.screenshot({path:'/tmp/gt40-current.png',fullPage:true});assert.deepEqual(errors,[]);console.log('All three GT40 liveries: small exposed tread, including steering:',results);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
