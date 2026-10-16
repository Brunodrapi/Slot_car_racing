// Comparatifs de dessins Canvas, dans le vrai décor et à empreinte constante.
// node tools/propositions-decor.js [dossier]
'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),OUT=process.argv[2]||path.join(ROOT,'export','propositions-decor');
(async()=>{
 fs.mkdirSync(OUT,{recursive:true});
 const server=http.createServer((req,res)=>{
  const p=path.resolve(ROOT,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
  if(!p.startsWith(ROOT+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.app&&app.renderer);
  await page.evaluate(()=>{
   app.mondial=null;app.state='paused';window.previewDraw=Renderer.prototype.draw;
   Renderer.prototype.draw=function(){};Renderer.prototype._drawHUD=function(){};
   window.previewCards={grass:[],buildings:[]};
  });
  for(const [kind,track,items] of [
   ['grass','spa',[['prairie','A · Herbe fine','Fond uni et petits brins discrets'],['tonte','B · Bandes de tonte','Alternance régulière de deux verts'],['aplats','C · Aplats naturels','Grandes formes végétales, faible contraste']]],
   ['buildings','monaco',[['plats','A · Toits plats','Volumes clairs, acrotères et un lanterneau'],['terrecuite','B · Terre cuite','Deux pans, une arête et peu de détails'],['terrasses','C · Terrasses','Retraits successifs et petites jardinières'],['graphique','D · Toits graphiques','Toits ardoise et trois bandes de lumière']]]
  ]){
   await page.evaluate(id=>{app.startQuick('timetrial','gt',id);app.state='paused';app.ui.hide();app.race.cars.length=0;},track);
   for(const [style,title,subtitle] of items){
    const png=await page.evaluate(({kind,style,title,subtitle})=>{
     const r=app.renderer,T=app.race.track;
     if(kind==='grass'){r.grassStyle=style;r.grass=r._makeGrass();r.grassPattern=r.ctx.createPattern(r.grass,'repeat');}
     else r.buildingStyle=style;
     const p=T.pos((kind==='grass'?.13:.115)*T.length,0);
     r.cam.x=p.x;r.cam.y=p.y;r.cam.zoom=kind==='grass'?6:5;r.rotate=false;r.camAngle=0;
     window.previewDraw.call(r,app.race,null);
     const c=document.createElement('canvas');c.width=1000;c.height=1000;const g=c.getContext('2d');
     g.fillStyle='#f3f0e8';g.fillRect(0,0,c.width,c.height);g.fillStyle='#292b31';g.font='bold 32px sans-serif';g.fillText(title,30,50);
     g.font='20px sans-serif';g.fillStyle='#64666a';g.fillText(subtitle,30,86);
     g.drawImage(app.canvas,0,116,1000,625);
     g.fillStyle='#46494a';g.font='18px sans-serif';g.fillText(kind==='grass'?'Détail du sol':'Trois formats · même dessin, même empreinte',30,781);
     if(kind==='grass'){
      g.save();g.translate(30,807);g.fillStyle=g.createPattern(r.grass,'repeat');g.fillRect(0,0,940,163);g.restore();
     }else{
      for(const [x,L,W,type] of [[175,25,16,'hangars'],[490,32,14,'stands'],[815,20,20,'hangars']]){
       g.save();g.translate(x,820);g.scale(6,6);r._drawRoofVariant(g,{l:L,w:W,side:-1,type,teinte:.3,portes:4},style);g.restore();
      }
     }
     window.previewCards[kind].push(c);return c.toDataURL('image/png').split(',')[1];
    },{kind,style,title,subtitle});
    fs.writeFileSync(path.join(OUT,kind+'-'+style+'.png'),Buffer.from(png,'base64'));
   }
   const atlas=await page.evaluate(kind=>{
    const cards=window.previewCards[kind],cols=kind==='grass'?3:2,rows=Math.ceil(cards.length/cols),pad=20;
    const c=document.createElement('canvas');c.width=cols*1000+(cols+1)*pad;c.height=rows*1000+(rows+1)*pad;
    const g=c.getContext('2d');g.fillStyle='#d8d8d1';g.fillRect(0,0,c.width,c.height);
    cards.forEach((card,i)=>g.drawImage(card,pad+(i%cols)*(1000+pad),pad+Math.floor(i/cols)*(1000+pad)));
    return c.toDataURL('image/png').split(',')[1];
   },kind);
   fs.writeFileSync(path.join(OUT,kind+'-comparatif.png'),Buffer.from(atlas,'base64'));console.log(kind+' : '+items.length+' variantes et comparatif');
  }
  if(errors.length)throw Error(errors.join('\n'));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
