// Planches de revue composées uniquement à partir des sprites réellement utilisés par le jeu.
'use strict';
const sharp=require('sharp'),fs=require('node:fs'),path=require('node:path');
const {MODELS}=require('../js/cars');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'docs/nouvelles-voitures');
const xml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
function label(text,w,h,size=19){return Buffer.from(`<svg width="${w}" height="${h}"><text x="${w/2}" y="${h*.66}" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="${size}" fill="#29332d">${xml(text)}</text></svg>`);}
async function imageIn(file,w,h){return sharp(file).resize(w,h,{fit:'contain',background:'#00000000'}).png().toBuffer();}
async function grid(models,file,variants) {
  const W=440,H=425,c=[];
  let n=0;
  for(const m of models)for(const l of variants?m.livrees:[m.livrees[0]]) {
    const x=n%3*W,y=Math.floor(n/3)*H;
    c.push({input:label(m.name+' · '+l.nom,W,42,16),left:x,top:y});
    c.push({input:await imageIn(path.join(ROOT,l.top),410,170),left:x+15,top:y+47});
    c.push({input:await imageIn(path.join(ROOT,l.pick),410,195),left:x+15,top:y+223});n++;
  }
  await sharp({create:{width:3*W,height:Math.ceil(n/3)*H,channels:3,background:'#dde2d4'}}).composite(c).png().toFile(path.join(OUT,file));
}
async function compare(models,file,withPick) {
  const W=520,H=withPick?660:340,c=[];
  const rows=models.flatMap(m=>m.livrees.map(l=>({m,l})));
  for(let i=0;i<rows.length;i++){
    const {m,l}=rows[i],y=45+i*H;
    c.push({input:label(m.name+' · '+l.nom,2*W,35,18),left:0,top:y});
    for(let side=0;side<2;side++)for(const kind of withPick?['top','pick']:['top']) {
      const file=side?path.join(ROOT,l[kind]):path.join(ROOT,'art-src/voitures/gabarits-trappus',kind,path.basename(l[kind]));
      // Même longueur dessinée à gauche/droite : le gain de largeur est visible sans changer d'échelle.
      const p=await sharp(file).resize(450).png().toBuffer(),meta=await sharp(p).metadata();
      const top=y+40+(kind==='pick'?290:0);
      const maxH=kind==='pick'?300:280;
      const input=meta.height>maxH?await imageIn(file,450,maxH):p;
      const size=await sharp(input).metadata();
      c.push({input,left:side*W+Math.round((W-size.width)/2),top:top+Math.round((maxH-size.height)/2)});
    }
  }
  c.unshift({input:label('AVANT',W,42,23),left:0,top:0},{input:label('APRÈS · largeur +25 %',W,42,23),left:W,top:0});
  await sharp({create:{width:2*W,height:45+rows.length*H,channels:3,background:'#dde2d4'}}).composite(c).png().toFile(path.join(OUT,file));
}
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  await grid(MODELS.filter(m=>['250gto','typee','240z','962','xjr9','330p4','p68'].includes(m.id)),'gt-protos.png',true);
  await grid(MODELS.filter(m=>m.catId==='f1'),'f1.png',false);
  await compare(MODELS.filter(m=>m.catId==='f1'),'f1-avant-apres.png',false);
  await compare(MODELS.filter(m=>m.id==='xjr9'),'xjr9-avant-apres.png',true);
  console.log('Quatre planches écrites dans docs/nouvelles-voitures.');
})().catch(e=>{console.error(e);process.exitCode=1;});
