// Les fronts 50/100/150 ms traversent les mêmes sous-pas à 15, 30 et 60 images/s.
'use strict';
const assert=require('node:assert/strict');
const {ThrottlePulses}=require('../js/util.js');
for(const ms of [50,100,150]){
 const runs=[];
 for(const fps of [15,30,60]){
  const q=new ThrottlePulses(),events=[];
  // Décalage de 7 ms : les appuis ne sont pas artificiellement alignés sur les images.
  for(let t=7;t<1200;t+=2*ms){events.push({at:t,value:true},{at:t+ms,value:false});}
  let next=0,latest=false,from=0,acc=0,gasTime=0,slices=0;
  for(let frame=1;frame<=fps*1.2+1;frame++){
   const to=Math.min(1200,frame*1000/fps);
   while(next<events.length&&events[next].at<=to){const e=events[next++];q.push(e.at,e.value);latest=e.value;}
   for(const part of q.take(from,to,latest)){
    acc+=part.dt;
    while(acc>=1/120){if(part.throttle)gasTime+=1/120;acc-=1/120;slices++;}
   }
   from=to;if(to===1200)break;
  }
  assert.ok(Math.abs(gasTime-.6)<1/120+.0001,'appuis perdus : '+ms+' ms à '+fps+' fps');
  runs.push(gasTime);
 }
 assert.ok(Math.max(...runs)-Math.min(...runs)<1/120+.0001);
 console.log(ms+' ms : gaz reçus '+runs.map(x=>x.toFixed(4)+' s').join(', '));
}
const q=new ThrottlePulses();q.push(10,true);q.push(60,false);
assert.deepEqual(q.take(0,70,false),[{dt:.01,throttle:false},{dt:.05,throttle:true},{dt:.01,throttle:false}]);
q.push(100,true);q.reset();assert.deepEqual(q.take(90,130,false),[{dt:.04,throttle:false}]);
console.log('Impulsion entière entre deux images et remise à zéro en pause : OK');
