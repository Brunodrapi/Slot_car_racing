// Render review sheets with the game's own car sprites and NightLighting compositor.
'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),OUT=path.resolve(process.argv[2]||path.join(ROOT,'docs/feux'));
fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{
  const p=path.resolve(ROOT,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!p.startsWith(ROOT+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch(),errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1680,height:1100},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);await page.waitForFunction(()=>window.app?.save);
  await page.evaluate(async()=>{
   app.state='menu';for(const m of MODELS)topArt(m,0);
   const deadline=performance.now()+25000;
   while(MODELS.some(m=>!topArt(m,0))){if(performance.now()>deadline)throw Error('sprite load timeout');await new Promise(r=>setTimeout(r,40));}
   await document.fonts.ready;
  });
  const counts={};
  for(const cat of ['gt3','gt','proto','f1']){
   counts[cat]=await page.evaluate(cat=>{
    document.body.innerHTML='';document.documentElement.style.cssText='height:auto;overflow:visible;background:#ebe2cd';
    document.body.style.cssText='margin:0;padding:24px;box-sizing:border-box;height:auto;overflow:visible;background:#ebe2cd;color:#232922;font:16px sans-serif';
    const title=document.createElement('h1');title.textContent=`GRIP · ${cat==='gt'?'GT anciennes':cat.toUpperCase()} · Les feux par voiture`;title.style.cssText='font:italic 900 42px Racing,Impact,sans-serif;margin:0 0 10px;color:#252b24;background:none;-webkit-text-fill-color:#252b24';document.body.append(title);
    const desc=document.createElement('p');desc.textContent='À gauche : optiques avant agrandies sur la carrosserie. À droite : nuit, puis freinage. Avant de la voiture vers la droite.';desc.style.margin='0 0 16px';document.body.append(desc);
    const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(2,1fr);gap:16px';document.body.append(grid);
    const models=MODELS.filter(m=>m.catId===cat);
    for(const m of models){
     const card=document.createElement('canvas');card.width=808;card.height=340;card.style.cssText='width:100%;height:auto';grid.append(card);
     const g=card.getContext('2d');g.fillStyle='#faf1db';g.fillRect(0,0,808,340);g.strokeStyle='#c8bca0';g.strokeRect(.5,.5,807,339);
     g.fillStyle='#252b24';g.font='italic 900 28px Racing,Impact,sans-serif';g.fillText(m.name,16,33,776);
     g.font='14px sans-serif';g.fillStyle='#5d625b';g.fillText(m.catId==='f1'?'Sans phares avant · feu stop central':'Deux sources avant · deux projections rouges arrière',16,57);
     g.fillStyle='#c9c1af';g.fillRect(12,78,260,212);g.save();g.translate(142,184);g.scale(232/m.length,232/m.length);
     drawCarModel(g,m,LIVERIES[0],{livree:0,steer:0});
     for(const lens of carLightLayout(m,0).front){g.save();g.translate(lens.x,lens.y);drawLightLens(g,lens);g.restore();}g.restore();
     g.fillStyle='#4c534b';g.font='14px sans-serif';g.fillText('Détail des optiques avant',18,313);
     for(const [i,braking]of [false,true].entries()){
      const w=508,h=108,s=10,x=110,y=54;
      const scene=document.createElement('canvas');scene.width=w;scene.height=h;const q=scene.getContext('2d');
      q.fillStyle='#514e54';q.fillRect(0,0,w,h);q.fillStyle='#b4b2a8';q.fillRect(0,12,w,1.5);q.fillRect(0,h-14,w,1.5);
      q.save();q.translate(x,y);q.scale(s,s);drawCarModel(q,m,LIVERIES[0],{livree:0,steer:0});q.restore();
      const overlay=document.createElement('canvas');overlay.width=w;overlay.height=h;
      const n=new NightLighting(),car={cls:m,livree:0,pos:{x:0,y:0},heading:0,braking,state:'ok'};
      n.prepare({timeOfDay:'night',opts:{spectator:true},cars:[car]},{x:0,y:0},100);
      n.draw({nightCanvas:overlay,nightCtx:overlay.getContext('2d')},new DOMMatrix([s,0,0,s,x,y]));q.drawImage(overlay,0,0);
      const yy=92+i*133;g.fillStyle=braking?'#b52b25':'#515c67';g.font='bold 13px sans-serif';g.fillText(braking?'FREINAGE':'NUIT · SANS FREINER',288,yy-6);g.drawImage(scene,288,yy);
     }
    }
    const footer=document.createElement('p');footer.textContent='Rendu du jeu '+APP_VERSION+' · même échelle et même exposition pour les deux vues de nuit · première livrée de chaque modèle · aucun lampadaire dans ces aperçus';footer.style.cssText='font:14px sans-serif;margin:16px 0 0';document.body.append(footer);
    return models.length;
   },cat);
   await page.screenshot({path:path.join(OUT,`phares-${cat}.png`),fullPage:true});
  }
  if(errors.length)throw Error(errors.join('\n'));
  fs.writeFileSync(path.join(OUT,'visuels.json'),JSON.stringify({version:await page.evaluate(()=>APP_VERSION),models:Object.values(counts).reduce((a,b)=>a+b,0),categories:counts,errors},null,2)+'\n');
  console.log(JSON.stringify({counts,errors}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
