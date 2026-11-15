// Real menu selection, save/reload, class isolation and review sheets from Canvas.
// node --require /workspace/cloud-setup/system-chromium.cjs tools/e2e-gt3.js [output]
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),OUT=path.resolve(process.argv[2]||path.join(ROOT,'docs/gt3'));
fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const server=http.createServer((req,res)=>{
    const file=path.resolve(ROOT,'.'+decodeURIComponent(req.url.split('?')[0]));
    if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
      res.writeHead(404);return res.end();
    }
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch(),errors=[],missing=[],results=[];
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    for(const mobile of [false,true]){
      const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
      const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
      // The source/recette deliberately has no offline build manifest.
      page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400&&new URL(r.url()).pathname!=='/manifeste.json')missing.push(r.url());});
      await page.goto(base+'/index.html');
      await page.waitForFunction(()=>typeof app!=='undefined'&&app.save);
      await page.evaluate(mobile=>{
        app.save.name='Pilote';app.save.sound=false;app.save.lang=mobile?'en':'fr';
        app.mondial=null;app.state='menu';app.save.cat='gt3';app.save.filtreCat='gt3';app.save.models.gt3='porsche991gt3r';
        storeSave(app.save);app.ui.lang=app.save.lang;app.ui.setup.classId='gt3';app.ui.setup.trackId='monza';app.ui.setupScreen('race');
      },mobile);
      assert.equal(await page.locator('[data-rail="models"] .card').count(),10);
      const ids=await page.evaluate(()=>modelsOf('gt3').map(m=>m.id));
      for(const id of mobile?[ids[0],ids[9]]:ids){
        await page.click(`.card[data-action="pickModel"][data-id="${id}"]`);
        assert.equal(await page.locator('[data-action="pickLivery"]').count(),3);
        for(const i of [0,1,2]){
          await page.click(`[data-action="pickLivery"][data-id="${i}"]`);
          const state=await page.evaluate(()=>({car:app.playerModelFor('gt3').id,lv:app.playerLivreeFor(app.playerModelFor('gt3').id)}));
          assert.deepEqual(state,{car:id,lv:i});
        }
      }
      await page.click('.card[data-action="pickModel"][data-id="porsche991gt3r"]');
      await page.click('[data-action="pickLivery"][data-id="1"]');
      await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
      await page.evaluate(()=>{for(const el of document.querySelectorAll('*'))if(el.scrollTop)el.scrollTop=0;window.scrollTo(0,0);});
      await page.screenshot({path:path.join(OUT,mobile?'menu-mobile.png':'menu-pc.png')});
      await page.reload();await page.waitForFunction(()=>typeof app!=='undefined'&&app.save);
      const saved=await page.evaluate(()=>({car:app.playerModelFor('gt3').id,lv:app.playerLivreeFor('porsche991gt3r')}));
      assert.deepEqual(saved,{car:'porsche991gt3r',lv:1});
      const grids=await page.evaluate(()=>modelsOf('gt3').map(m=>{
        const r=new Race({trackDef:TRACKS.find(t=>t.id==='monza'),classId:'gt',modelId:m.id,difficulty:'medium',nCars:10});
        return {car:m.id,categories:r.cars.map(c=>c.cls.catId)};
      }));
      assert(grids.every(r=>r.categories.length===10&&r.categories.every(c=>c==='gt3')));
      results.push({mobile,selections:mobile?6:30,saveReload:true,gt3OnlyGrids:grids.length});
      if(!mobile){
        await page.evaluate(async()=>{
          const ms=modelsOf('gt3');for(const m of ms)for(let i=0;i<3;i++)topArt(m,i);
          const start=performance.now();while(ms.some(m=>m.livrees.some((_,i)=>!topArt(m,i)))){
            if(performance.now()-start>15000)throw Error('GT3 sprite loading timeout');
            await new Promise(r=>setTimeout(r,30));
          }
          document.body.innerHTML='';document.documentElement.style.cssText='height:auto;overflow:auto;background:#eadfc4';
          document.body.style.cssText='margin:0;height:auto;background:#eadfc4;color:#202421;font:18px sans-serif;overflow:auto';
          for(const m of ms){
            const section=document.createElement('section');section.id=m.id;
            section.style.cssText='height:380px;padding:12px 18px;box-sizing:border-box;border-bottom:2px solid #baa987';
            const title=document.createElement('b');title.textContent=m.name;title.style.cssText='display:block;height:30px;font-size:22px';section.append(title);
            const row=document.createElement('div');row.style.cssText='display:flex;gap:12px';section.append(row);
            for(let i=0;i<3;i++){
              const col=document.createElement('div');col.style.cssText='width:456px;text-align:center';
              const name=document.createElement('div');name.textContent=nomLivree(m.livrees[i],'fr');name.style.cssText='height:26px;font-size:16px';col.append(name);
              const c=document.createElement('canvas');c.width=450;c.height=215;
              const g=c.getContext('2d');g.translate(225,108);g.scale(420/m.length,420/m.length);drawCarModel(g,m,LIVERIES[0],{livree:i,steer:0});
              c.style.cssText='width:360px;height:172px;display:block;margin:auto';col.append(c);
              const im=new Image();im.src=m.livrees[i].pick;im.style.cssText='height:130px;width:280px;object-fit:contain';col.append(im);row.append(col);
            }
            document.body.append(section);
          }
          await Promise.all([...document.images].map(i=>i.decode()));
        });
        await page.setViewportSize({width:1440,height:3800});
        await page.screenshot({path:path.join(OUT,'planche.png'),fullPage:true});
        for(const id of ids)await page.locator('#'+id).screenshot({path:path.join(OUT,id+'-livrees.png')});
        fs.copyFileSync(path.join(OUT,'porsche991gt3r-livrees.png'),path.join(OUT,'porsche-livrees.png'));
      }
      await ctx.close();
    }
    assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
    fs.writeFileSync(path.join(OUT,'verification-navigateur.json'),JSON.stringify({results,errors,missing},null,2)+'\n');
    console.log('GT3 desktop/mobile: 36 livery selections, save/reload, 20 GT3-only grids, 60 loaded sprites; no browser errors.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
