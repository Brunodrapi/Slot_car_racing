// Actual start/finish crossings + OfflineAudioContext checks of the lap signal.
// node --require /workspace/cloud-setup/system-chromium.cjs tools/e2e-lap-beep.js [output]
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),OUT=path.resolve(process.argv[2]||'/tmp/grip-lap-beep');fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{
  const file=path.resolve(ROOT,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch(),errors=[];
 try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);await page.waitForFunction(()=>window.app?.save);
  const result=await page.evaluate(async()=>{
   app.state='paused';const modes=[];
   const handler=Object.create(App.prototype),cues=[];
   handler.audio={lapBeep:best=>cues.push(best),beep:()=>{},thud:()=>{}};handler.ui={t:()=>'',flash:null};handler.renderer={shake:0};
   for(const mode of ['race','timetrial','training']){
    const race=new Race({mode:mode==='training'?'timetrial':mode,entrainement:mode==='training',trackDef:TRACKS.find(t=>t.id==='monza'),classId:'gt3',laps:3,nCars:2});
    const p=race.player,npc=race.cars.find(c=>c!==p&&!c.fantome);race.cars=npc?[p,npc]:[p];race.state='racing';race.countdown=0;race.time=100;race.cars.forEach(c=>c.gridLat=null);npc?.place(500,0,0);cues.length=0;
    const cross=(checkpoint,dirty=false,duration=60)=>{
     p.place(race.track.length-.05,0,20);p.checkpoint=checkpoint;p.lapSale=dirty;p.lapStart=race.time-duration;
     race.update(.05,{throttle:.5,sel:0});handler._handleEvents(race);
    };
    p.started=false;cross(false);if(p.lap!==0||cues.length)throw Error(mode+': beep on initial start');
    cross(true);if(p.lap!==1||cues.length!==1||cues[0])throw Error(mode+': missing first lap beep');
    handler._handleEvents(race);if(cues.length!==1)throw Error('duplicate beep');
    cross(false);if(cues.length!==1)throw Error('line rocking beep');
    cross(true,true);if(p.lap!==2||cues.length!==2)throw Error('invalid completed lap lost its beep');
    cross(true,false,50);if(p.lap!==3||cues.length!==3||!cues[2])throw Error('final/best lap beep missing');
    if(npc){npc.lapTimes.push(65);npc.lap++;race.events.push({type:'lap',car:npc});handler._handleEvents(race);if(cues.length!==3)throw Error('AI lap beep');}
    modes.push({mode,completedLaps:p.lap,beeps:cues.length,bestLapTone:cues[2]});
   }
   const audio=[];let samples;
   for(const kind of ['normal','best','muted','notStarted']){
    const ctx=new OfflineAudioContext(1,Math.round(.4*44100),44100),a=new GameAudio();a.ctx=ctx;a.master=ctx.createGain();a.master.connect(ctx.destination);a.started=kind!=='notStarted';a.enabled=kind!=='muted';a.lapBeep(kind==='best');
    const b=await ctx.startRendering(),d=b.getChannelData(0);
    const rms=(start,end)=>{let sum=0;const lo=Math.round(start*44100),hi=Math.round(end*44100);for(let i=lo;i<hi;i++)sum+=d[i]*d[i];return Math.sqrt(sum/(hi-lo));};
    const held=rms(.02,.10),end=rms(.26,.38);let crossings=0;for(let i=883;i<4410;i++)if(d[i-1]<=0&&d[i]>0)crossings++;const frequency=crossings/.08;
    if(kind==='muted'||kind==='notStarted'){if(held!==0||end!==0)throw Error('disabled audio still beeps');}
    else if(held<.25||end>1e-6||Math.abs(frequency-(kind==='best'?1480:1200))>30)throw Error('bad audible lap tone');
    audio.push({kind,heldRms:held,tailRms:end,frequency});if(kind==='normal')samples=Array.from(d);
   }
   return{modes,audio,samples};
  });
  assert.deepEqual(errors,[]);const {samples,...report}=result;
  const wav=Buffer.alloc(44+samples.length*2);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(44100,24);wav.writeUInt32LE(88200,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);samples.forEach((v,i)=>wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));fs.writeFileSync(path.join(OUT,'bip-tour.wav'),wav);
  fs.writeFileSync(path.join(OUT,'verification.json'),JSON.stringify({...report,errors},null,2));console.log(JSON.stringify({...report,errors},null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
