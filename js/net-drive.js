'use strict';

// Protocol 3: owner physics + one signed byte of steering for animated tires.
// Monotonic timestamps use the host's clock, estimated by round-trip probes.
const DRIVE_PROTOCOL = 3;
const DRIVE_FULL_BYTES = 40, DRIVE_FAR_BYTES = 14;

function driveFlags(c) {
  return (c.state === 'grass' ? 1 : 0) | (c.engineStopped ? 2 : 0) | (c.braking ? 4 : 0)
    | (c.inPit ? 8 : 0) | (c.throttle ? 16 : 0) | (c.started ? 32 : 0);
}

function driveState(c, id, at, acceleration = 0) {
  return { id, at, x:c.x, y:c.y, th:c.th, v:c.v, vl:c.vl, w:c.w, s:c.s, lat:c.lat,
    sel:c.sel, lap:c.lap, flags:driveFlags(c), slip:c.patineFx || 0,
    acceleration:clamp(acceleration,-60,30), damage:c.damage, tyre:c.tyre, steer:c.delta || 0 };
}

// Every record carries its source timestamp. Relaying an old state must not make it new.
// Far records are only map/progress data; cars become detailed before entering the view.
function driveEncode(records, far = false) {
  const size = far ? DRIVE_FAR_BYTES : DRIVE_FULL_BYTES;
  const bytes = new Uint8Array(1 + size * records.length), view = new DataView(bytes.buffer);
  bytes[0] = far ? 1 : 0;
  records.forEach((s,i)=>{
    let p=1+i*size;
    view.setUint8(p++,s.id); view.setFloat64(p,s.at);p+=8;
    if(far) {
      view.setUint16(p,Math.round(s.s*8));p+=2;
      view.setUint8(p++,s.lap);
      view.setInt16(p,Math.round(clamp(s.v,-327,327)*100));
      return;
    }
    for(const key of ['x','y','s']){view.setFloat32(p,s[key]);p+=4;}
    for(const [key,scale] of [['th',1000],['v',100],['vl',100],['w',1000],['lat',100],['acceleration',100]]){
      view.setInt16(p,Math.round(clamp(s[key]*scale,-32767,32767)));p+=2;
    }
    view.setInt8(p++,Math.round(s.sel*100));view.setUint8(p++,s.lap);
    view.setUint8(p++,s.flags);view.setUint8(p++,Math.round(s.slip*255));
    view.setUint8(p++,Math.round(s.damage*255));view.setUint8(p++,Math.round(s.tyre*255));
    view.setInt8(p++,Math.round(clamp(s.steer || 0,-.65,.65)*180));
  });
  return bytes;
}

function driveDecode(bytes) {
  // PeerJS BinaryPack may deserialize typed arrays as raw ArrayBuffers.
  if(bytes instanceof ArrayBuffer)bytes=new Uint8Array(bytes);
  if(!(bytes instanceof Uint8Array)) return null;
  const far=bytes[0]===1,size=far?DRIVE_FAR_BYTES:DRIVE_FULL_BYTES;
  if(bytes[0]>1 || (bytes.length-1)%size || bytes.length>1+12*size)return null;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), out=[];
  for(let p=1;p<bytes.length;p+=size){
    let k=p; const s={id:view.getUint8(k++),at:view.getFloat64(k),far};k+=8;
    if(far){s.s=view.getUint16(k)/8;k+=2;s.lap=view.getUint8(k++);s.v=view.getInt16(k)/100;}
    else {
      for(const key of ['x','y','s']){s[key]=view.getFloat32(k);k+=4;}
      for(const [key,scale] of [['th',1000],['v',100],['vl',100],['w',1000],['lat',100],['acceleration',100]]){s[key]=view.getInt16(k)/scale;k+=2;}
      s.sel=view.getInt8(k++)/100;s.lap=view.getUint8(k++);s.flags=view.getUint8(k++);
      s.slip=view.getUint8(k++)/255;s.damage=view.getUint8(k++)/255;s.tyre=view.getUint8(k++)/255;
      s.steer=view.getInt8(k++)/180;
    }
    if(!Object.values(s).every(v=>typeof v!=='number'||Number.isFinite(v)))return null;
    out.push(s);
  }
  return out;
}

class NetLink {
  constructor(net) {
    this.net=net;this.offset=0;this.samples={};this.pings={};this.pending=new Map();this.serial=0;
    this.synchronized=net.isHost();
    net.room.onMessage((p,label)=>this.receive(p,label));
    this.timer=setInterval(()=>this.tick(),1000);
  }
  close(){clearInterval(this.timer);this.pending.clear();}
  now(){
    const adjusted=performance.now()+this.offset;
    this.clockNow=Math.max(adjusted,this.clockNow??adjusted);
    return this.clockNow;
  }
  send(packet,pid){
    const peer=this.net.peers.find(p=>p.presence?.pid===pid);
    if(peer&&!peer.isMe)this.net.room?.message(packet,peer.peer);
  }
  tick(){
    const n=this.net;if(!n.room)return;
    if(n.isHost())for(const m of n.members())if(!m.isMe){
      const id=++this.serial,t=performance.now();this.pending.set(id,{pid:m.pid,t});
      this.send({kind:'ping',id,t},m.pid);
    }
    for(const [id,p] of this.pending)if(performance.now()-p.t>5000)this.pending.delete(id);
    // Presence is for membership/late joining, not for fast movement.
    if(n.state!=='off')n.post();
    n.onPeers();
  }
  receive(p,label){
    const n=this.net,peer=n.peers.find(x=>x.peer===label),pid=peer?.presence?.pid;
    if(!pid||!p||typeof p!=='object')return;
    const host=n.roster?.[0]||n.members()[0]?.pid;
    if(p.kind==='ping'&&pid===host&&!n.isHost()){
      this.send({kind:'pong',id:p.id,at:performance.now()},pid);return;
    }
    if(p.kind==='pong'&&n.isHost()){
      const q=this.pending.get(p.id);if(!q||q.pid!==pid||!Number.isFinite(p.at))return;
      this.pending.delete(p.id);const now=performance.now(),rtt=now-q.t;
      const samples=this.samples[pid]||[];samples.push({rtt,offset:(q.t+now)/2-p.at});
      this.samples[pid]=samples.slice(-8);const best=this.samples[pid].reduce((a,b)=>a.rtt<b.rtt?a:b);
      this.pings[pid]={ms:Math.round(rtt),at:now};
      const peers=Object.fromEntries(Object.entries(this.pings).filter(([,v])=>now-v.at<4000).map(([k,v])=>[k,v.ms]));
      this.send({kind:'clock',offset:best.offset,rtt,peers},pid);
      return;
    }
    if(p.kind==='clock'&&pid===host&&!n.isHost()&&Number.isFinite(p.offset)&&Number.isFinite(p.rtt)){
      if(!this.synchronized)this.clockNow=undefined;
      this.offset=p.offset;this.pings={};
      this.synchronized=true;
      for(const [id,ms] of Object.entries(p.peers||{}))if(Number.isFinite(ms))this.pings[id]={ms,at:performance.now()};
      this.pings[n.pid]={ms:Math.round(p.rtt),at:performance.now()};return;
    }
    n.drive?.receive(p,pid);
  }
  ping(pid){const p=this.pings[pid];return p&&performance.now()-p.at<4000?p.ms:null;}
  // `t` traduit les deux libellés ; sans lui (les bancs), le français
  label(t=k=>({pingHost:'Ping hôte :',pingGuests:'Ping invités :'})[k]){
    if(!this.net.isHost()){const p=this.ping(this.net.pid);return `${t('pingHost')} ${p==null?'—':p+' ms'}`;}
    const p=Object.keys(this.pings).map(id=>this.ping(id)).filter(v=>v!=null);
    return `${t('pingGuests')} ${p.length?`${Math.min(...p)}–${Math.max(...p)} ms`:'—'}`;
  }
}

function driveMeta(c){
  return {lap:c.lap,started:c.started,lapStart:c.lapStart,bestLap:c.bestLap,
    laps:c.lapTimes.map((v,i)=>[v,c.lapOk[i]!==false]),fautes:c.fautes,repris:c.repris,
    finished:c.finished,finishTime:c.finishTime,lapSale:c.lapSale};
}

class NetDrive {
  constructor(net,race){
    this.net=net;this.race=race;this.link=net.link;this.id=net.settings().go;
    this.host=net.isHost();this.local=race.opts.spectator?-1:race.cars.indexOf(race.player);
    this.states=new Map();this.sent=new Map();this.contacts=new Map();this.contactSerial={};this.ack=0;
    this.pairAt=new Map();this.sequence=0;this.received=-1;this.controlSeq=0;this.controlReceived=-1;
    this.lastSend=-Infinity;this.lastControl=-Infinity;this.lastMeta=-Infinity;this.lastIntent='';
    this.epoch=null;this.lastReceive=performance.now();this.bytes=0;this.nearRecords=0;this.farRecords=0;
    const initialAt=this.link.synchronized?this.link.now():-1;
    race.netDrive=this;race.cars.forEach((c,i)=>{c.netRemote=!this.owns(c);this.states.set(i,driveState(c,i,initialAt));});
  }
  owns(c){return !this.race.opts.spectator&&(c.isPlayer || this.host&&c.human==null);}
  send(p,pid){this.link.send({race:this.id,...p},pid);}
  owner(i){const c=this.race.cars[i];return c.human==null?this.net.roster[0]:this.net.roster[c.human];}
  publish(c,i){
    const prev=this.states.get(i),at=this.link.now(),elapsed=(at-(prev?.at||at))/1000;
    const a=elapsed>.005?(c.v-prev.v)/elapsed:prev?.acceleration||0;
    const s=driveState(c,i,at,a);this.states.set(i,s);return s;
  }
  beforeFrame(dt){
    const r=this.race;
    if(!this.host&&!this.link.synchronized){r.attente=true;return;}
    if(this.host&&r.state==='countdown'&&!r.attente&&this.epoch==null){
      this.epoch=this.link.now()+r.countdown*1000;this.lastControl=-Infinity;
    }
    if(this.epoch!=null&&r.state!=='finished'){
      const time=(this.link.now()-this.epoch)/1000;
      if(time<0){r.countdown=-time;}
      else {
        if(r.state==='countdown'){r.state='racing';r.countdown=0;r.cars.forEach(c=>c.gridLat=null);r.events.push({type:'go'});}
        r.time=Math.max(0,time-Math.min(dt,.1));
      }
    }
    this.projectRemotes();
    if(!this.host&&this.link.ping(this.net.pid)==null)r.attente=true;
  }
  afterFrame(input){
    const r=this.race,now=this.link.now();
    if(this.host){
      if(r.state==='finished'){
        if(now-(this.finishSend||0)<1000)return;
        this.finishSend=now;
      }
      r.cars.forEach((c,i)=>{if(this.owns(c)){
        const prev=this.states.get(i),s=this.publish(c,i);
        if(prev&&(((prev.flags^s.flags)&22)||Math.abs(prev.sel-s.sel)>.05))this.broadcast(i);
      }});
      this.broadcast();this.control();return;
    }
    if(this.local<0){
      if(now-this.lastSend>200){this.lastSend=now;this.send({kind:'watch',focus:this.net.focus?.()??null},this.net.roster[0]);}return;
    }
    if(!this.link.synchronized)return;
    const c=r.player;
    const intent=[Math.round(throttleAmount(input.throttle)*10),Math.round((input.brake||0)*10),Math.round((input.sel||0)*10),c.braking,c.engineStopped].join(':');
    const urgent=intent!==this.lastIntent;
    if(now-this.lastSend<1000/30&&!urgent)return;
    this.lastSend=now;this.lastIntent=intent;
    const state=this.publish(c,this.local),meta=driveMeta(c),key=JSON.stringify(meta);
    const changed=key!==this.metaKey,withMeta=changed||now-this.lastMeta>500;
    if(withMeta){this.lastMeta=now;this.metaKey=key;}
    this.send({kind:'owned',seq:++this.sequence,state:driveEncode([state]),ack:this.ack,
      meta:withMeta?meta:null,urgent,radius:this.net.viewRadius?.()||110},this.net.roster[0]);
  }
  receive(p,pid){
    if(p.race!==this.id)return;
    const r=this.race;
    if(this.host&&p.kind==='owned'){
      if(r.state==='finished')return;
      const list=driveDecode(p.state);if(!list||list.length!==1)return;
      const s=list[0],c=r.cars[s.id];
      if(!c||s.far||this.owner(s.id)!==pid||pid===this.net.pid)return;
      const prev=this.states.get(s.id);
      if(!Number.isSafeInteger(p.seq)||p.seq<=(c.netSeq||0)||s.at<prev.at||s.at>this.link.now()+250||this.link.now()-s.at>2500)return;
      if(Math.abs(s.v)>200||Math.abs(s.vl)>100||s.s<0||s.s>r.track.length+1)return;
      c.netSeq=p.seq;
      this.radii??=new Map();this.radii.set(pid,clamp(Number.isFinite(p.radius)?p.radius:110,110,350));
      const pending=this.contacts.get(pid)||[];
      this.contacts.set(pid,pending.filter(e=>e.id>p.ack));
      this.states.set(s.id,s);this.applyState(c,s);
      if(p.meta)this.acceptMeta(c,p.meta,s);
      r.flags?.update();
      if(p.urgent)this.broadcast(s.id);
      return;
    }
    if(this.host&&p.kind==='watch'&&this.net.members().find(m=>m.pid===pid)?.q.spectator){
      if(Number.isInteger(p.focus)&&r.cars[p.focus])this.watchFocus??=new Map(),this.watchFocus.set(pid,p.focus);
      else this.watchFocus?.delete(pid);return;
    }
    if(this.host||pid!==this.net.roster[0])return;
    if(p.kind==='view'){
      const list=driveDecode(p.data);if(!list)return;
      for(const s of list){
        const c=r.cars[s.id],old=this.states.get(s.id);
        if(!c||this.owns(c)||s.at<(old?.at||0)||s.at===old?.at&&s.far&&!old.far)continue;
        this.states.set(s.id,s);
        // Brake lamps are immediate. Pose is evaluated at the display's current clock.
        if(!s.far){c.braking=!!(s.flags&4);c.patineFx=s.slip;}
      }
      this.lastReceive=performance.now();this.net.snapAt=this.lastReceive;this.net.lastSeq++;
    }
    if(p.kind==='control'&&p.seq>this.controlReceived){
      this.controlReceived=p.seq;this.epoch=p.epoch;
      if(p.state==='finishing'||p.state==='finished')r.state=p.state;
      r.finishDeadline=p.endAt;r.finishTimer=Math.max(0,(p.endAt||0)-r.time);
      if(p.flags)r.flags?.receive(p.flags);
      if(Array.isArray(p.meta))p.meta.forEach((m,i)=>{if(r.cars[i]&&(i!==this.local||p.state==='finished'))this.applyMeta(r.cars[i],m);});
      if(p.report){
        const own=this.local>=0?driveMeta(r.player):null;
        r.broadcast?.receive(p.report,r);
        if(own&&p.state!=='finished')this.applyMeta(r.player,own);
      }
      if(p.state==='finished'){r.time=p.time;r._classeRecu();}
      this.lastReceive=performance.now();this.net.snapAt=this.lastReceive;this.net.lastSeq++;
    }
    if(p.kind==='contacts'&&this.local>=0){
      for(const e of p.events||[]){
        if(e.id!==this.ack+1||e.car!==this.local)continue;
        this.ack=e.id;
        if(this.link.now()-e.at>1500||r.state==='finished'||r.player.blueFlag)continue;
        const c=r.player,before={x:c.x,y:c.y,th:c.th};
        for(const key of ['x','y','v','vl','w','damage'])c[key]+=e.delta[key]||0;
        c.damage=clamp(c.damage,0,1);c._barrierContact(before,r.dt);
        r.events.push({type:'crash',car:c});
      }
    }
  }
  applyMeta(c,m){
    if(!m)return;
    for(const k of ['lap','started','lapStart','bestLap','fautes','repris','finished','finishTime','lapSale'])if(k in m)c[k]=m[k];
    if(Array.isArray(m.laps)){c.lapTimes=m.laps.map(l=>l[0]);c.lapOk=m.laps.map(l=>l[1]);}
  }
  acceptMeta(c,m,s){
    // Cumulative records survive loss/reordering. Times use the shared clock, never arrival time.
    if(!Array.isArray(m.laps)||m.laps.length>999||m.laps.length<c.lapTimes.length||m.lap!==m.laps.length)return;
    if(m.laps.some(l=>!Array.isArray(l)||!Number.isFinite(l[0])||l[0]<=0))return;
    if(!Number.isFinite(m.lapStart)||m.lapStart>this.race.time+.3||m.lapStart<0)return;
    if(!Number.isInteger(m.fautes)||m.fautes<0||!Number.isFinite(m.repris)||m.repris<0)return;
    // No changing a previously accepted lap, no backwards lap counter.
    if(c.lapTimes.some((v,i)=>Math.abs(v-m.laps[i][0])>.001)||m.lap<c.lap)return;
    const wasFinished=c.finished,oldLap=c.lap;
    this.applyMeta(c,m);
    c.finished=m.lap>=this.race.laps;
    if(c.finished){
      c.finishTime=m.lapStart;
      if(this.race.finishDeadline&&c.finishTime>this.race.finishDeadline){c.finished=false;c.finishTime=null;}
    }
    if(oldLap!==c.lap)this.race.events.push({type:'lap',car:c});
    if(c.finished&&!wasFinished&&this.race.state==='racing'){
      this.race.state='finishing';this.race.finishDeadline=c.finishTime+NET_FINISH_GRACE;
      this.race.finishTimer=Math.max(0,this.race.finishDeadline-this.race.time);this.lastControl=-Infinity;
    }
  }
  applyState(c,s){
    if(s.far){c.s=s.s;c.v=s.v;c.lap=s.lap;const pos=this.race.track.pos(s.s,0);c.x=pos.x;c.y=pos.y;c.th=this.race.track.headingAt(s.s);return;}
    for(const k of ['x','y','th','v','vl','w','s','lat','sel','damage','tyre'])c[k]=s[k];
    if(!this.host)c.lap=Math.max(c.lap,s.lap);
    c.selS=s.sel;c.braking=!!(s.flags&4);c.throttle=!!(s.flags&16);c.engineStopped=!!(s.flags&2);
    c.delta=s.steer || 0;
    c.inPit=!!(s.flags&8);c.started=!!(s.flags&32);c.state=s.flags&1?'grass':'ok';c.patineFx=s.slip;
    c.beta=Math.atan2(s.vl,Math.max(.1,Math.abs(s.v)));
  }
  projectRemotes(){
    const now=this.link.now(),r=this.race;
    for(const [i,s] of this.states){
      const c=r.cars[i];if(this.owns(c))continue;
      this.applyState(c,s);
      if(r.state==='countdown'||r.state==='finished')continue;
      const dt=clamp((now-s.at)/1000,0,s.far?.22:.15);
      if(s.far){c.s=r.track.wrap(s.s+Math.max(0,s.v)*dt);const pos=r.track.pos(c.s,0);c.x=pos.x;c.y=pos.y;continue;}
      const dv=clamp(s.acceleration*dt,-Math.max(0,s.v),4),v=s.v+dv/2,th=s.th+s.w*dt/2;
      c.x+=(v*Math.cos(th)-s.vl*Math.sin(th))*dt;c.y+=(v*Math.sin(th)+s.vl*Math.cos(th))*dt;
      c.th=wrapAngle(s.th+s.w*dt);c.v=s.v+dv;
      const projection=r.track.project(c.x,c.y,r.track.wrap(s.s+v*dt),30);
      c.s=projection.s;c.lat=projection.lat;
    }
  }
  isNear(i,pid){
    const r=this.race,c=r.cars[i],seat=this.net.roster.indexOf(pid);
    const focus=seat>=0?r.cars.find(c=>c.human===seat):r.cars[this.watchFocus?.get(pid)];
    if(!focus)return seat<0; // overview spectators get detailed cars, including orientations
    const d=Math.abs(r.track.diff(focus.s,c.s)),world=Math.hypot(c.x-focus.x,c.y-focus.y);
    // Cover the camera, both directions, parallel sections and three seconds of closing speed.
    const range=Math.max(110,Math.abs(focus.v-c.v)*3+40);
    const key=pid+':'+i,was=this.near?.get(key);this.near??=new Map();
    const near=d<range+(was?30:0)||world<(this.radii?.get(pid)||110)+(was?30:0);
    this.near.set(key,near);return near;
  }
  broadcast(urgentId=null){
    const now=this.link.now();
    for(const m of this.net.members()){
      if(m.isMe)continue;
      const sent=this.sent.get(m.pid)||new Map(),full=[],far=[];
      for(const [i,s] of this.states){
        if(this.owner(i)===m.pid)continue;
        const near=this.isNear(i,m.pid),last=sent.get(i)||{at:-Infinity,near:false};
        if(urgentId!=null&&i!==urgentId)continue;
        if(urgentId!=null&&!near)continue;
        if(urgentId==null&&now-last.at<(near?1000/30:200)&&!(near&&!last.near))continue;
        (near?full:far).push(s);sent.set(i,{at:now,near});
      }
      for(const [list,compact] of [[full,false],[far,true]])if(list.length){
        const data=driveEncode(list,compact);this.bytes+=data.length;
        this.nearRecords+=compact?0:list.length;this.farRecords+=compact?list.length:0;
        this.send({kind:'view',data},m.pid);
      }
      this.sent.set(m.pid,sent);
    }
  }
  control(){
    const now=this.link.now(),r=this.race;
    const flagKey=r.flags?.key();
    if(flagKey!==this.lastFlagKey){this.lastControl=-Infinity;this.lastFlagKey=flagKey;}
    if(now-this.lastControl<(r.state==='finished'?1000:200) && r.state===this.lastState)return;
    const reportDue=now-(this.reportAt||0)>1000||r.state==='finished';
    if(reportDue)this.reportAt=now;
    const p={kind:'control',seq:++this.controlSeq,epoch:this.epoch,state:r.state,time:r.time,endAt:r.finishDeadline||null,
      flags:r.flags?.packet(),
      meta:reportDue?r.cars.map(driveMeta):null,report:reportDue?r.broadcast?.packet(r):null};
    this.lastControl=now;this.lastState=r.state;
    for(const m of this.net.members())if(!m.isMe){
      this.send(p,m.pid);const events=this.contacts.get(m.pid);if(events?.length)this.send({kind:'contacts',events},m.pid);
    }
  }
  canFinalize(){
    // Stop driving at the deadline, briefly collect crossings already in flight.
    const r=this.race;
    const delays=this.net.roster.slice(1).map(pid=>(this.link.ping(pid)||0)/2000);
    const window=Math.min(.6,Math.max(.15,...delays.map(d=>d+.05)));
    return r.time >= r.finishDeadline + window;
  }
  resolveContacts(dt){
    if(!this.host)return;
    const r=this.race,now=this.link.now();
    for(let i=0;i<r.cars.length;i++)for(let j=i+1;j<r.cars.length;j++){
      const a=r.cars[i],b=r.cars[j],key=i+':'+j;
      if(a.blueFlag||b.blueFlag)continue;
      if(now-(this.pairAt.get(key)||-Infinity)<80)continue;
      // Beyond the prediction horizon, a contact could precede what either driver sees.
      // Prefer letting that uncertain contact pass to applying an invisible shove.
      const route=[i,j].reduce((sum,k)=>sum+(this.owner(k)===this.net.pid?0:(this.link.ping(this.owner(k))??Infinity)/2),0);
      if(route>150)continue;
      if([i,j].some(k=>!this.owns(r.cars[k])&&(now-this.states.get(k).at>160||(this.contacts.get(this.owner(k))||[]).length)))continue;
      if(Math.abs(r.track.diff(a.s,b.s))>(a.cls.length+b.cls.length)/2-.05||Math.abs(a.lat-b.lat)>(a.cls.width+b.cls.width)/2-.05)continue;
      const keys=['x','y','v','vl','w','damage'],before=[a,b].map(c=>Object.fromEntries(keys.map(k=>[k,c[k]])));
      resolveCollisions([a,b],r.track);this.pairAt.set(key,now);
      [a,b].forEach((c,n)=>{
        const id=n?j:i,delta=Object.fromEntries(keys.map(k=>[k,c[k]-before[n][k]]));
        if(this.owns(c)){c._barrierContact({...before[n],th:c.th},dt);return;}
        Object.assign(c,before[n]);
        if(!Object.values(delta).some(v=>Math.abs(v)>1e-7))return;
        const pid=this.owner(id),event={id:(this.contactSerial[pid]||0)+1,car:id,at:now,delta};
        this.contactSerial[pid]=event.id;const events=this.contacts.get(pid)||[];events.push(event);this.contacts.set(pid,events);
        this.send({kind:'contacts',events},pid);
      });
    }
  }
}

if(typeof module!=='undefined')module.exports={driveEncode,driveDecode,DRIVE_FULL_BYTES,DRIVE_FAR_BYTES};
