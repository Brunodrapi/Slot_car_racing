// Every model/livery: measured anchors, body alignment, world transforms and contact sheet.
// node --require /workspace/cloud-setup/system-chromium.cjs tools/e2e-car-lights.js [output]
'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),OUT=path.resolve(process.argv[2]||'/tmp/grip-car-lights');fs.mkdirSync(OUT,{recursive:true});
(async()=>{const server=http.createServer((req,res)=>{const f=path.resolve(ROOT,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(ROOT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch(),errors=[];try{
 const page=await browser.newPage({viewport:{width:1800,height:1890}});page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);await page.waitForFunction(()=>window.app?.save);
 const result=await page.evaluate(async()=>{
  app.state='menu';for(const m of MODELS)for(let i=0;i<m.livrees.length;i++)topArt(m,i);
  const start=performance.now();while(MODELS.some(m=>m.livrees.some((_,i)=>!topArt(m,i)))){if(performance.now()-start>25000)throw Error('sprite loading');await new Promise(r=>setTimeout(r,40));}
  const c=document.createElement('canvas'),g=c.getContext('2d'),rows=[],n=new NightLighting();n.lamps=[];
  for(const m of MODELS){if(!CAR_LIGHT_PROFILES[m.id])throw Error('missing profile '+m.id);for(let i=0;i<m.livrees.length;i++){
   const art=topArt(m,i),l=carLightLayout(m,i);c.width=art.img.width;c.height=art.img.height;g.drawImage(art.img,0,0);
   if(l.front.length!==(m.catId==='f1'?0:2)||l.rear.length!==(m.catId==='f1'?1:2))throw Error('light count '+m.id);
   for(const f of l.front){const x=Math.round((f.x/m.length+.5)*(c.width-1)),y=Math.round((f.y/(m.length*c.height/c.width)+.5)*(c.height-1));if(g.getImageData(x,y,1,1).data[3]<100)throw Error('source outside body '+m.id+' '+i);}
   const car={cls:m,livree:i,pos:{x:10,y:20},heading:Math.PI/3,braking:true,state:'ok'},race={timeOfDay:'night',opts:{spectator:true},cars:[car]};n.prepare(race,{x:10,y:20},100);
   const heads=n.fields.filter(f=>f.beam),tails=n.fields.filter(f=>f.tail);if(heads.length!==l.front.length||tails.length!==l.rear.length)throw Error('source count '+m.id);
   for(const [j,f]of heads.entries()){const q=l.front[j],x=10+Math.cos(car.heading)*q.x-Math.sin(car.heading)*q.y,y=20+Math.sin(car.heading)*q.x+Math.cos(car.heading)*q.y;if(Math.hypot(f.x-x,f.y-y)>1e-8)throw Error('heading transform '+m.id);}
   car.fantome=true;n.prepare(race,{x:10,y:20},100);if(n.fields.length)throw Error('ghost light '+m.id);
   rows.push({model:m.id,livree:i,front:l.front.length,rear:l.rear.length,shape:l.front[0]?.shape||'none'});
  }}
  document.body.innerHTML='';document.body.style.cssText='display:grid;grid-template-columns:repeat(5,360px);height:auto;background:#e8dfc9;overflow:visible';document.documentElement.style.cssText='height:auto;overflow:visible';
  for(const m of MODELS){const c=document.createElement('canvas');c.width=360;c.height=270;const q=c.getContext('2d');q.fillStyle='#e8dfc9';q.fillRect(0,0,360,270);q.fillStyle='#111';q.font='18px sans-serif';q.fillText(m.name,8,23);q.save();q.translate(180,140);q.scale(320/m.length,320/m.length);app.renderer._feuxStop(q,m,topArt(m,0),0);drawCarModel(q,m,LIVERIES[0],{livree:0});const l=carLightLayout(m,0);for(const f of l.front){q.save();q.translate(f.x,f.y);drawLightLens(q,f);q.restore();}q.fillStyle='#ff241c';for(const f of l.rear){q.beginPath();q.arc(f.x,f.y,.045,0,Math.PI*2);q.fill();}q.restore();q.fillStyle='#222';q.font='14px sans-serif';q.fillText(m.id+' · '+(l.front[0]?.shape||'sans phares'),8,258);document.body.append(c);}
  return{models:MODELS.length,liveries:rows.length,rows};
 });await page.screenshot({path:path.join(OUT,'profils-feux.png'),fullPage:true});
 await page.evaluate(()=>{
  document.body.innerHTML='';document.body.style.gridTemplateColumns='repeat(2,450px)';
  const m=modelById('250gto');
  for(let i=0;i<m.livrees.length;i++)for(const before of [true,false]){
   const c=document.createElement('canvas');c.width=450;c.height=260;const g=c.getContext('2d');g.fillStyle='#e8dfc9';g.fillRect(0,0,450,260);g.fillStyle='#222';g.font='19px sans-serif';g.fillText((before?'Avant':'Après')+' · '+nomLivree(m.livrees[i],'fr'),10,26);
   const axle=wheelLayout(m,{livree:i}).front,old=axle.width;if(before)axle.width=.1;
   g.save();g.translate(225,145);g.scale(400/m.length,400/m.length);drawCarModel(g,m,LIVERIES[0],{livree:i,steer:0});g.restore();axle.width=old;document.body.append(c);
  }
 });await page.setViewportSize({width:900,height:780});await page.screenshot({path:path.join(OUT,'gran-corsa-pneus.png'),fullPage:true});assert.deepEqual(errors,[]);fs.writeFileSync(path.join(OUT,'verification.json'),JSON.stringify({...result,errors},null,2));console.log(JSON.stringify({models:result.models,liveries:result.liveries,errors},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
