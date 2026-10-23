#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),{spawn,spawnSync}=require('child_process');
const {chromium,devices}=require('playwright');
if(process.argv.includes('--help')){console.log('node tools/trailer/make.js [--script=file.json] [--out=directory] [--chromium=path] [--only=01-hook] [--resume] [--music=file.mp3] [--credit=file.txt] [--records=snapshot.json]');process.exit(0);}
const ROOT=path.resolve(__dirname,'../..');
const arg=n=>{const x=process.argv.find(a=>a.startsWith('--'+n+'='));return x?.slice(n.length+3);};
const OUT=path.resolve(arg('out')||path.join(ROOT,'artifacts/trailer'));
const SCRIPT=path.resolve(arg('script')||path.join(__dirname,'script.json'));
const conf=JSON.parse(fs.readFileSync(SCRIPT)),W=conf.width,H=conf.height,FPS=conf.fps;
const recordsSnapshot=arg('records')?JSON.parse(fs.readFileSync(path.resolve(arg('records')))):null;
const only=arg('only'),music=arg('music'),credit=arg('credit'),resume=process.argv.includes('--resume');
const raw=path.join(OUT,'rushes'),cuts=path.join(OUT,'sections');
for(const d of [OUT,raw,cuts])fs.mkdirSync(d,{recursive:true});
fs.copyFileSync(SCRIPT,path.join(OUT,'script.json'));
const duration=conf.sections.reduce((a,s)=>a+s.duration,0);
for(const s of conf.sections)if(s.shots&&Math.abs(s.shots.reduce((a,x)=>a+x.duration,0)-s.duration)>.01)throw Error('Shot duration mismatch '+s.id);
const font=path.join(ROOT,'art/interface/fonts/BarlowCondensed-BlackItalic.ttf');
function run(args){return new Promise((resolve,reject)=>{const p=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',...args]);let err='';p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',c=>c?reject(Error(err)):resolve());});}
const enc=['-an','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-r',String(FPS),'-threads','2','-movflags','+faststart'];
function ffpath(p){return p.replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"'\\''");}
async function concat(files,dest){const list=dest+'.txt';fs.writeFileSync(list,files.map(f=>`file '${f.replace(/'/g,"'\\''")}'`).join('\n'));await run(['-f','concat','-safe','0','-i',list,...enc,dest]);}
const report={version:fs.readFileSync(path.join(ROOT,'js/version.js'),'utf8').match(/APP_VERSION = '([^']+)/)?.[1],shots:[],notes:['Offline staged capture using the real renderer and physics.','Spectator shots use real UI with local AI, not an Internet session.','No captured engine audio; optional licensed music supplied separately.']};
if(fs.existsSync(path.join(OUT,'capture-report.json'))){const previous=JSON.parse(fs.readFileSync(path.join(OUT,'capture-report.json')));report.shots=previous.shots||[];}
function complete(file,duration){
 try{const r=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',file],{encoding:'utf8'});return r.status===0&&Math.abs(Number(JSON.parse(r.stdout).format.duration)-duration)<.15;}catch{return false;}
}
let server,browser;
async function page(w=W,h=H,mobile=false){
 const ctx=await browser.newContext({...(mobile?devices['iPhone 13']:{}),viewport:{width:w,height:h},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{window.requestAnimationFrame=()=>0;localStorage.setItem('slotracer.save.v2',JSON.stringify({name:'GRIP',lang:'en',sound:false}));});
 const p=await ctx.newPage();await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
 p.on('pageerror',e=>{report.errors||=[];report.errors.push(e.message);});
 await p.goto(`http://127.0.0.1:${server.address().port}/index.html`);await p.waitForFunction(()=>window.app?.ui);
 await p.addScriptTag({path:path.join(__dirname,'capture.js')});return {p,ctx};
}
async function capture(shot,id,w=W,h=H,fps=FPS){
 const dest=path.join(raw,id+'.mp4');if(resume&&complete(dest,shot.duration))return dest;
 console.log('CAPTURE',id);
 const {p,ctx}=await page(shot.mobile?390:w,shot.mobile?780:h,!!shot.mobile);
 try{
 await p.evaluate(({shot,seed})=>trailerSetup(shot,seed),{shot:shot.records?{...shot,recordsSnapshot}:shot,seed:conf.seed});
 if(shot.menu||shot.end||shot.records){const png=path.join(raw,id+'.png');await p.screenshot({path:png});await run(['-loop','1','-i',png,'-t',String(shot.duration),'-vf',`scale=${W}:${H}`, ...enc,dest]);report.shots=report.shots.filter(r=>r.id!==id);report.shots.push({id,shot,static:true,recordsCount:shot.records?recordsSnapshot.records.length:undefined});}
 else{
 const proc=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0','-an',...(shot.mobile?['-vf',`scale=${w}:${h}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x172723`]:[]),'-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-threads','2',dest]);
 let errors='';proc.stderr.on('data',d=>errors+=d);const done=new Promise((res,rej)=>{proc.on('error',rej);proc.on('close',c=>c?rej(Error(errors)):res());});
 for(let i=0;i<Math.round(shot.duration*fps);i++){
  await p.evaluate(({dt,t})=>trailerTick(dt,t),{dt:1/fps,t:i/fps});
  const jpg=await p.screenshot({type:'jpeg',quality:88});
  if(!proc.stdin.write(jpg))await new Promise(r=>proc.stdin.once('drain',r));
 }
 proc.stdin.end();await done;
 const events=await p.evaluate(()=>trailerEvents);report.shots=report.shots.filter(r=>r.id!==id);report.shots.push({id,shot,events});console.log('DONE',id,JSON.stringify(events));
 }
 }finally{await ctx.close();}
 fs.writeFileSync(path.join(OUT,'capture-report.json'),JSON.stringify(report,null,2));return dest;
}
async function title(input,s,dest){
 const txt=path.join(OUT,s.id+'.txt');fs.writeFileSync(txt,s.text);
 const size=s.text.length>45?36:s.text.length>33?42:54;
 let vf=`scale=${W}:${H-108}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${W}:${H}:(ow-iw)/2:0:color=0x101815,drawtext=fontfile='${ffpath(font)}':expansion=none:textfile='${ffpath(txt)}':fontcolor=0xf5e7c7:fontsize=${size}:x=(w-tw)/2:y=h-78`;
 if(s.end&&credit)vf+=`,drawtext=fontfile='${ffpath(font)}':expansion=none:textfile='${ffpath(path.resolve(credit))}':fontsize=18:fontcolor=0xf5e7c7:x=30:y=24:line_spacing=5`;
 if(s.end){const play=path.join(OUT,'play.txt');fs.writeFileSync(play,'PLAY NOW');vf+=`,drawtext=fontfile='${ffpath(font)}':expansion=none:textfile='${ffpath(play)}':fontsize=60:fontcolor=0xf1c744:x=(w-tw)/2:y=h*0.72`;}
 await run(['-i',input,'-t',String(s.duration),'-vf',vf,...enc,dest]);
}
(async()=>{
 server=http.createServer((req,res)=>{let f=path.resolve(ROOT,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(ROOT+path.sep)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({executablePath:arg('chromium')||process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 for(const s of conf.sections){
 if(only&&s.id!==only)continue;
 const dest=path.join(cuts,s.id+'.mp4');if(resume&&complete(dest,s.duration)){console.log('REUSE',s.id);continue;}
 let base=path.join(raw,s.id+'-base.mp4');
 if(s.mosaic){
  const files=[];
  for(const [i,track] of s.mosaic.entries())files.push(await capture({track,model:i%3===0?'ferrari312t':i%3===1?'f40':'962',at:.12,duration:s.duration,tile:true},s.id+'-'+track,480,360,12));
  const args=files.flatMap(f=>['-i',f]),filter=[];
  files.forEach((f,i)=>{const txt=path.join(OUT,'tile-'+i+'.txt');fs.writeFileSync(txt,(report.shots.find(r=>r.id===s.id+'-'+s.mosaic[i])?.events.trackName||s.mosaic[i]).toUpperCase());filter.push(`[${i}:v]scale=${W/4}:${H/3},setsar=1,drawtext=fontfile='${ffpath(font)}':expansion=none:textfile='${ffpath(txt)}':fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6:x=8:y=8[v${i}]`);});
  filter.push(files.map((_,i)=>`[v${i}]`).join('')+`xstack=inputs=12:layout=${files.map((_,i)=>`${i%4*(W/4)}_${Math.floor(i/4)*(H/3)}`).join('|')},fps=${FPS},zoompan=z='max(1,4-on/${FPS})':x=0:y=0:d=1:s=${W}x${H}:fps=${FPS}[out]`);
  await run([...args,'-filter_complex_threads','1','-filter_complex',filter.join(';'),'-map','[out]','-t',String(s.duration),...enc,base]);
 }else if(s.end)base=await capture({end:true,duration:s.duration},s.id);
 else{const files=[];for(const [i,shot] of s.shots.entries())files.push(await capture(shot,s.id+'-'+i));await concat(files,base);}
 await title(base,s,dest);console.log('SECTION',s.id);
 }
 if(!only){
 const silent=path.join(OUT,'grip-trailer-silent.mp4');await concat(conf.sections.map(s=>path.join(cuts,s.id+'.mp4')),silent);
 if(music){await run(['-i',silent,'-stream_loop','-1','-i',path.resolve(music),'-map','0:v','-map','1:a','-c:v','copy','-af',`volume=0.65,afade=t=in:d=0.35,afade=t=out:st=${duration-3}:d=3`,'-c:a','aac','-b:a','192k','-t',String(duration),'-movflags','+faststart',path.join(OUT,'grip-trailer.mp4')]);}
 await run(['-ss','2','-i',silent,'-frames:v','1',path.join(OUT,'poster.jpg')]);
 }
 if(report.errors?.length)throw Error('Browser errors: '+JSON.stringify(report.errors));
 console.log('OUTPUT',OUT);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
