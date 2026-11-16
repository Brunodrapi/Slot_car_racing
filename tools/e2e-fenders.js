// Check fender coverage in the actual renderer, including steering and all Kitsune liveries.
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),OUT=path.resolve(process.argv[2]||path.join(ROOT,'docs/ailes-kitsune-freccia'));
fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{const f=path.resolve(ROOT,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(ROOT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch(),errors=[];
 try{
  const p=await browser.newPage({viewport:{width:1260,height:900}});p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://127.0.0.1:${server.address().port}/index.html`);await p.waitForFunction(()=>window.app?.save);
  const report=await p.evaluate(async()=>{
   app.state='menu';const rows=[],models=['240z','330p4','nissangtrgt3'].map(modelById);
   for(const m of models)for(let i=0;i<m.livrees.length;i++)topArt(m,i);
   const deadline=performance.now()+20000;while(models.some(m=>m.livrees.some((_,i)=>!topArt(m,i)))){if(performance.now()>deadline)throw Error('sprites not loaded');await new Promise(r=>setTimeout(r,40));}
   await document.fonts.ready;
   document.body.innerHTML='';document.body.style.cssText='margin:0;height:auto;overflow:visible;background:#e8dfc9;color:#252b24;font:16px sans-serif';document.documentElement.style.cssText='height:auto;overflow:visible';
   for(const m of models)for(let i=0;i<m.livrees.length;i++){
    const art=topArt(m,i),[w,h]=topSize(m,art),layout=wheelLayout(m,{livree:i}),t=layout.rear;
    const render=steer=>{const c=document.createElement('canvas');c.width=460;c.height=240;const g=c.getContext('2d');g.translate(230,120);g.scale(420/m.length,420/m.length);drawCarModel(g,m,LIVERIES[0],{livree:i,steer});return c;};
    const body=document.createElement('canvas');body.width=460;body.height=240;const bg=body.getContext('2d');bg.drawImage(art.img,20,20,420,200);
    const opaque=(c,x)=>{const d=c.getContext('2d').getImageData(x,0,1,c.height).data;const ys=[];for(let y=0;y<c.height;y++)if(d[y*4+3]>180)ys.push(y);return[Math.min(...ys),Math.max(...ys)];};
    const x=Math.round(20+(t.centers[0].x+.5)*420),b=opaque(body,x),current=render(0),r=opaque(current,x),lip=[b[0]-r[0],r[1]-b[1]];
    if(lip.some(v=>v<1||v>4))throw Error('rear tires must protrude 1–4 px at axle: '+m.id+'/'+i+' '+lip);
    const data=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data,straight=data(current);
    const differences=[];for(const steer of [-.5,.5]){const d=data(render(steer));let pixels=0;for(let k=0;k<d.length;k+=4)if(d[k]!==straight[k]||d[k+3]!==straight[k+3])pixels++;if(pixels<30)throw Error('steering hidden '+m.id+'/'+i);differences.push(pixels);}
    // The new outer rear shoulder must contain paint, where the old sprite exposed black tread.
    if(m.id!=='nissangtrgt3')for(const y of [b[0]+9,b[1]-9]){const d=bg.getImageData(x,y,1,1).data;if(d[3]<240||Math.max(...d.slice(0,3))<60)throw Error('rear fender has no paint '+m.id+'/'+i);}
    rows.push({model:m.id,livery:i,width:art.img.width,height:art.img.height,rearTreadPixels:lip,steeringPixels:differences});
    if(m.id==='nissangtrgt3')continue;
    const section=document.createElement('section');section.style.cssText='padding:12px 0;border-bottom:2px solid #b9ad91';
    const title=document.createElement('div');title.textContent=m.name+' · '+nomLivree(m.livrees[i],'fr');title.style.cssText='padding:0 18px;font:italic 900 26px Racing,Impact,sans-serif';section.append(title);
    const old=new Image();old.src='art-src/voitures/ailes-kitsune-freccia/avant/'+m.livrees[i].top.split('/').pop();await old.decode();
    const grid=document.createElement('div');grid.style.cssText='display:flex';section.append(grid);
    for(const mode of ['Avant','Après · roues droites','Après · roues braquées']){const c=document.createElement('canvas');c.width=420;c.height=250;const g=c.getContext('2d');g.fillStyle='#e8dfc9';g.fillRect(0,0,420,250);g.fillStyle='#252b24';g.font='17px sans-serif';g.fillText(mode,18,25);g.save();g.translate(210,140);g.scale(360/m.length,360/m.length);if(mode==='Avant'){drawFrontWheels(g,m,w,h,{livree:i,steer:0});g.drawImage(old,-w/2,-h/2,w,h);}else drawCarModel(g,m,LIVERIES[0],{livree:i,steer:mode.includes('braquées')?.5:0});g.restore();grid.append(c);}
    document.body.append(section);
   }
   return {version:APP_VERSION,rows};
  });
  await p.screenshot({path:path.join(OUT,'avant-apres.png'),fullPage:true});assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(OUT,'verification.json'),JSON.stringify({...report,errors},null,2)+'\n');console.log(JSON.stringify({...report,errors},null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
