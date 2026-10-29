// Real canvas rendering: every converted livery, steering in both directions,
// shadows, P34 wheel count, and review sheets. Uses the same renderer as racing.
'use strict';
const {chromium} = require('playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..'), out = process.argv[2] || '/tmp/cartoon-checks';
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const server = http.createServer((req,res)=>{
    const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end();}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch(), page=await browser.newPage({viewport:{width:1200,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
    await page.waitForFunction(()=>typeof app!=='undefined'&&app.save);
    for(const id of ['gt40','m1procar','tyrrellp34']){
      await page.evaluate(id=>{
        const m=modelById(id);
        app.save.name='Pilote';app.save.lang='fr';
        app.save.models[m.catId]=id;app.save.cat=m.catId;app.save.filtreCat=m.catId;
        app.ui.setup.classId=m.catId;app.ui.setup.trackId='spa';app.ui.setupScreen('race');
      },id);
      await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
      await page.screenshot({path:path.join(out,'paddock-'+id+'.png')});
    }
    const results=await page.evaluate(async()=>{
      const models=MODELS.filter(m=>m.frontWheels);
      for(const m of models)for(let i=0;i<m.livrees.length;i++)topReady(m,i);
      await new Promise((resolve,reject)=>{const t0=performance.now();const check=()=>{
        if(models.every(m=>m.livrees.every((_,i)=>topReady(m,i))))return resolve();
        if(performance.now()-t0>15000)return reject(Error('sprite loading timeout'));
        setTimeout(check,50);
      };check();});
      const rows=[];
      function frame(m,i,steer,shadow=false,wheelsOnly=false){
        const c=document.createElement('canvas');c.width=480;c.height=320;
        const g=c.getContext('2d');g.translate(240,160);g.scale(400/m.length,400/m.length);
        if(wheelsOnly){const [w,h]=topSize(m,topArt(m,i));drawFrontWheels(g,m,w,h,{steer,livree:i});}
        else if(shadow)drawCarShadow(g,m,i,{steer});else drawCarModel(g,m,LIVERIES[0],{livree:i,steer});
        return c;
      }
      for(const m of models)for(let i=0;i<m.livrees.length;i++){
        const art=topArt(m,i);if(!art)throw Error('Missing sprite '+m.id+'/'+i);
        const a=frame(m,i,0), b=frame(m,i,.5), c=frame(m,i,-.5);
        const data=k=>k.getContext('2d').getImageData(0,0,k.width,k.height).data;
        const diff=(a,b)=>{let n=0;for(let k=0;k<a.length;k+=4)if(a[k]!==b[k]||a[k+3]!==b[k+3])n++;return n;};
        const da=data(a), db=data(b), dc=data(c);
        // Opaque F1 tire interiors must hide the sprite's suspension at every angle.
        if(m.catId==='f1')for(const steer of [0,.5,-.5]){
          const full=data(frame(m,i,steer)), tires=data(frame(m,i,steer,false,true));
          let checked=0;
          for(let k=0;k<tires.length;k+=4)if(tires[k+3]===255){
            checked++;
            for(let ch=0;ch<3;ch++)if(Math.abs(full[k+ch]-tires[k+ch])>1)
              throw Error('Suspension drawn over tire: '+m.id+'/'+i+' steer '+steer);
          }
          if(checked<100)throw Error('Missing F1 tire coverage: '+m.id);
        }

        // One coat of shadow: at 30 % (alpha 77) the tires tucked under the body must not come out
        // darker — two coats made 130. A couple of units of antialiasing at the seam are fine.
        for(const steer of [0,.5,-.5]){
          const k=document.createElement('canvas');k.width=480;k.height=320;
          const g=k.getContext('2d');g.translate(240,160);g.scale(400/m.length,400/m.length);g.globalAlpha=.3;
          drawCarShadow(g,m,i,{steer});
          const d=data(k);let max=0;for(let p=3;p<d.length;p+=4)if(d[p]>max)max=d[p];
          if(max>85)throw Error('Shadow darker over the tires: '+m.id+'/'+i+' steer '+steer+' alpha '+max);
        }

        rows.push({id:m.id,livery:i,wheels:m.frontWheels.axles.length*2,
          left:diff(da,dc),right:diff(da,db),
          shadow:diff(data(frame(m,i,0,true)),data(frame(m,i,.5,true)))});
      }
      // The gallery is a real drawCarModel output, not a generated mockup.
      document.body.innerHTML='';document.body.style.cssText='margin:0;background:#eadfc4;color:#202421;font:18px sans-serif;overflow:auto';
      for(let j=0;j<models.length;j++){
        const m=models[j], section=document.createElement('section');section.id='model-'+m.id;
        section.style.cssText='height:240px;padding:12px;box-sizing:border-box;display:flex;align-items:center;border-bottom:2px solid #b7aa8d';
        const title=document.createElement('div');title.style.width='180px';title.textContent=m.name+' — roues droites / braquées';section.append(title);
        for(const steer of [0,.5,-.5]){
          const c=frame(m,0,steer);c.style.cssText='width:250px;height:167px';section.append(c);
        }
        const im=new Image();im.src=m.pick;im.style.cssText='width:220px;max-height:180px;object-fit:contain';section.append(im);
        document.body.append(section);
      }
      await Promise.all([...document.images].map(i=>i.decode()));
      return rows;
    });
    for(const r of results){
      assert(r.left>10&&r.right>10,`steering visible ${r.id}/${r.livery}`);
      assert(r.shadow>10,`shadow turns ${r.id}/${r.livery}`);
      assert.equal(r.wheels,r.id==='tyrrellp34'?4:2);
    }
    fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(results,null,2)+'\n');
    const ids=[...new Set(results.map(r=>r.id))];
    await page.setViewportSize({width:1200,height:Math.max(1000,ids.length*240)});
    for(let i=0;i<ids.length;i+=4){
      await page.screenshot({path:path.join(out,`roues-${1+i/4}.png`),
        clip:{x:0,y:i*240,width:1200,height:Math.min(4,ids.length-i)*240}});
    }
    assert.deepEqual(errors,[]);
    console.log(`${results.length} liveries: left/right steering, shadows and wheel counts OK; ${ids.length} models.`);
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
