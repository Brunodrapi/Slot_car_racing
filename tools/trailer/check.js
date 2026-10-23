// Validate the delivered encode and motion in all twelve mosaic cells.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{execFileSync}=require('child_process');
const out=path.resolve(process.argv[2]||'artifacts/trailer');
const script=JSON.parse(fs.readFileSync(path.join(out,'script.json'))),duration=script.sections.reduce((s,x)=>s+x.duration,0);
function probe(file){return JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8'}));}
for(const name of ['grip-trailer-silent.mp4','grip-trailer.mp4']){
 const file=path.join(out,name);if(!fs.existsSync(file)){if(name.includes('silent'))throw Error('Missing silent master');continue;}
 const p=probe(file),v=p.streams.find(s=>s.codec_type==='video');
 assert.equal(v.width,script.width);assert.equal(v.height,script.height);assert.equal(v.codec_name,'h264');
 assert(Math.abs(Number(p.format.duration)-duration)<.1);
 if(!name.includes('silent'))assert(p.streams.some(s=>s.codec_type==='audio'&&s.codec_name==='aac'));
 console.log(name,`${v.width}×${v.height}`,p.format.duration,'OK');
}
for(const s of script.sections)assert(Math.abs(Number(probe(path.join(out,'sections',s.id+'.mp4')).format.duration)-s.duration)<.1);
const mosaic=path.join(out,'sections/05-mosaic.mp4');
const frame=t=>execFileSync('ffmpeg',['-v','error','-ss',String(t),'-i',mosaic,'-frames:v','1','-f','rawvideo','-pix_fmt','gray','pipe:1'],{maxBuffer:script.width*script.height*2});
const a=frame(4),b=frame(8),w=script.width,h=script.height;
// The complete 16:9 image sits above the dedicated 108px caption margin.
const contentH=h-108,contentW=Math.floor(w*contentH/h/2)*2,left=(w-contentW)/2;
for(let tile=0;tile<12;tile++){
 let changed=0,n=0;
 for(let y=Math.ceil(Math.floor(tile/4)*contentH/3+30);y<Math.floor((Math.floor(tile/4)+1)*contentH/3-10);y++)for(let x=Math.ceil(left+tile%4*contentW/4+5);x<Math.floor(left+(tile%4+1)*contentW/4-5);x++){
  n++;if(Math.abs(a[y*w+x]-b[y*w+x])>12)changed++;
 }
 assert(changed>n*.02,'Frozen mosaic tile '+tile);console.log('Mosaic',tile+1,Math.round(changed/n*100)+'% changed');
}
const report=JSON.parse(fs.readFileSync(path.join(out,'capture-report.json')));assert(!report.errors?.length);
console.log('Timeline, codecs, 12 moving cells and browser error report: OK');
const menuShots=script.sections.flatMap(s=>s.shots||[]).filter(s=>s.menu);
if(menuShots.length===25){
 const rendered=report.shots.filter(s=>s.shot.menu);
 assert.equal(new Set(rendered.map(s=>s.shot.model)).size,25,'25 distinct car models captured');
 console.log('All 25 models captured: OK');
}
for(const section of script.sections)for(const [i,shot] of (section.shots||[]).entries()){
 const r=report.shots.find(r=>r.id===section.id+'-'+i);
 if(shot.mode==='timetrial'){assert.equal(r.events.mode,'timetrial');assert.equal(r.events.cars,1);if(shot.action==='clean')assert.equal(r.events.offroad,0);}
 if(shot.action==='overtake')assert(r.events.bestPosition<r.events.initialPosition,'Overtake actually occurred');
 if(shot.mobile){assert(r.events.mobile,'Touch device emulated');assert(r.events.viewport.height>r.events.viewport.width,'Portrait mobile capture');}
 if(shot.records)assert(r.recordsCount>0,'World records snapshot populated');
}
console.log('Time-trial footage, overtake and public records: OK');

for(const r of report.shots.filter(r=>r.events))assert.equal(r.events.difficulty,'extreme','Extreme AI: '+r.id);
console.log('Extreme AI in all racing captures: OK');
