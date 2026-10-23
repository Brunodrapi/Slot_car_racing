const {chromium}=require('playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const [ua,expected] of [
 ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0',true],
 ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36',true],
 ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/158.0',false],
 ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/155.0 Mobile/15E148 Safari/604.1',false]]){
  const p=await b.newPage({userAgent:ua}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8765/tools/chromium-cache.html');
  await p.waitForFunction(()=>!document.querySelector('#status').textContent.includes('Chargement'));
  assert.equal(await p.evaluate(()=>!!document.querySelector('iframe').contentWindow.app.renderer.chromiumCacheFix),expected);
  if(expected){
   await p.evaluate(()=>{const a=document.querySelector('iframe').contentWindow.app;a.mondial=null;a.analytics.begin=()=>{};a.analytics.observe=()=>{};a.save.sound=false;a.audio.setEnabled(false);a.startQuick('race','gt','spa');});
   await p.waitForFunction(()=>document.querySelector('iframe').contentWindow.app.renderer.testBackdrop,{},{timeout:180000});
   assert.equal(await p.evaluate(()=>document.querySelector('iframe').contentWindow.app.renderer.backdropStats.scale),8);
   await p.evaluate(()=>document.querySelector('iframe').contentWindow.app.startQuick('race','gt','zandvoort'));
   await p.waitForFunction(()=>document.querySelector('iframe').contentWindow.app.renderer.testBackdrop,{},{timeout:180000});
  }
  assert.deepEqual(errors,[]);await p.close();
 }
 console.log('Desktop Chrome/Edge enabled, Firefox/iPhone unchanged, cache ready and track switch: OK');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
