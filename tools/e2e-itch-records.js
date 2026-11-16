// Same game served as web and as the built itch export: no technical OAuth warning, local records
// retained, and since 0.56.0 the world board on itch too — read in place, sign-in offered (it opens a
// tab on the prod bridge, see tools/e2e-itch-mondial.js), no more link to the hosted version.
'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),OUT=path.resolve(process.argv[2]||'/tmp/grip-itch-records');fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const serve=root=>http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
 const servers=[serve(ROOT),serve(path.join(ROOT,'dist-itch/game'))];for(const s of servers)await new Promise(r=>s.listen(0,'127.0.0.1',r));const browser=await chromium.launch(),errors=[],results=[];
 try{for(const itch of [false,true]){
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}});await ctx.addInitScript(()=>{try{sessionStorage.setItem('eol.parti',String(Date.now()));}catch(_){}});const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://127.0.0.1:${servers[Number(itch)].address().port}/index.html?v=0.55.1`);await p.waitForFunction(()=>window.app?.save);
  assert.equal(await p.evaluate(()=>app.isItch),itch);assert.equal(await p.evaluate(()=>!!app.mondial&&app.mondial.itch===app.isItch),true,'world board on both editions, bridged on itch');
  await p.evaluate(()=>{app.save.name='Pilote';app.save.lang='fr';app.ui.lang='fr';app.save.sound=false;app.audio.setEnabled(false);app.state='menu';app.analytics.begin=()=>{};app.analytics.observe=()=>{};app.ui.menu();});
  assert.equal(await p.locator('[data-action="fullscreen"]').count(),0,'itch fullscreen configuration is not a game code change');
  assert.equal(await p.locator('[data-world-online]').count(),0,'no link to the hosted version: the world board is here');
  await p.evaluate(()=>app.ui.settings());
  assert(await p.locator('[data-action="google"]').count(),'sign-in offered in settings');assert(!await p.evaluate(()=>app.ui.etatMondial().includes('Redirect URLs')));
  await p.evaluate(()=>{app.save.cat='gt3';app.save.filtreCat='gt3';app.save.bestLaps['monza|gt3|porsche991gt3r']=41.25;app.ui.setup.classId='gt3';app.ui.setup.trackId='monza';app.ui.setupScreen('timetrial');});
  const text=await p.locator('#ui').innerText();assert(!/Redirect URLs|sans jeton|adresse portait/.test(text));
  assert.match(text,/41.250/);assert.equal(await p.locator('.local-records').count(),0);assert(await p.locator('.rline-t.monde').count()>0,'world column on both editions');assert(await p.locator('.setup-records [data-action="google"]').count(),'sign-in offered under the records');
  if(itch)assert.equal(await p.evaluate(()=>!!document.querySelector('iframe[src="https://grip-game.github.io/itch.html"]')),true,'itch edition embeds the prod bridge');
  await p.screenshot({path:path.join(OUT,itch?'itch-records.png':'web-records.png')});results.push({distribution:itch?'itch':'web',technicalWarning:false,worldBoard:true,signInOffered:true,localRecordRetained:true});await ctx.close();
 }assert.deepEqual(errors,[]);fs.writeFileSync(path.join(OUT,'verification.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));}
 finally{await browser.close();for(const s of servers)await new Promise(r=>s.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
