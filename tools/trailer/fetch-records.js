// Read-only snapshot of the same public world records used by the game.
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const circuit=process.argv[2]||'monza',dest=process.argv[3]||'monza-records.json';
const src=fs.readFileSync(path.join(__dirname,'../../js/mondial.js'),'utf8');
const value=name=>src.match(new RegExp(`const ${name} = '([^']+)'`))?.[1];
(async()=>{
 const url=new URL('/rest/v1/records',value('MONDIAL_URL'));
 url.search=new URLSearchParams({select:'voiture,temps,pilote',circuit:'eq.'+circuit,order:'temps.asc'});
 const key=value('MONDIAL_KEY');let records;
 try {const res=await fetch(url,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error('Public records HTTP '+res.status);records=await res.json();}
 catch(error){
   // curl also honors proxy/certificate settings in managed cloud environments.
   records=JSON.parse(execFileSync('curl',['--fail','--silent','--show-error','--max-time','20','-H','apikey: '+key,'-H','Authorization: Bearer '+key,url.href],{encoding:'utf8'}));
 }
 if(!Array.isArray(records))throw Error('Invalid records response');
 fs.writeFileSync(dest,JSON.stringify({circuit,capturedAt:new Date().toISOString(),records},null,2)+'\n');
 console.log(records.length+' public records saved; no writes sent.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
