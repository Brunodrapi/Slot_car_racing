const {chromium}=require('playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const [ua,enabled] of [
 ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0',true],
 ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36',true],
 ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/158.0',false]]){
  const p=await b.newPage({userAgent:ua}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8765/');await p.waitForFunction(()=>window.app);
  if(enabled)await p.waitForFunction(()=>window.app.renderer.chromiumCacheFix);
  await p.evaluate(()=>{const a=window.app;a.mondial=null;a.analytics.begin=()=>{};a.analytics.observe=()=>{};a.save.sound=false;a.audio.setEnabled(false);a.startQuick('race','gt','spa');});
  assert.equal(await p.locator('#browser-performance-notice').count(),enabled?1:0);
  if(enabled){
   await p.waitForFunction(()=>window.app.renderer.testBackdrop,{},{timeout:180000});
   assert.equal(await p.evaluate(()=>app.renderer.backdropStats.scale),8);
   await p.locator('#browser-performance-notice button').click();
   await p.evaluate(()=>app.startQuick('race','gt','spa'));
   assert.equal(await p.locator('#browser-performance-notice').count(),0);
  }else assert.equal(await p.evaluate(()=>!!app.renderer.chromiumCacheFix),false);
  assert.deepEqual(errors,[]);await p.close();
 }
 console.log('Recette automatic cache at 8 px/m; Chrome/Edge notice once, dismissible; Firefox unchanged: OK');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
