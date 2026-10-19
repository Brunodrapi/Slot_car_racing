'use strict';

const FLAG_YELLOW_DELAY = 3, FLAG_PENALTY_DURATION = 5;
const FLAG_LABELS = {
  blue: ['Drapeau bleu · contacts entre voitures désactivés', 'Blue flag · car contacts disabled'],
  yellow: ['Drapeau jaune · voiture hors piste', 'Yellow flag · car off track'],
  penalty: ['Drapeau noir et blanc · pénalité / tour annulé', 'Black and white flag · penalty / invalid lap'],
  chequered: ['Drapeau à damier · dernier tour / arrivée', 'Chequered flag · final lap / finish'],
};
function raceFlagLabel(type,lang='fr'){return FLAG_LABELS[type]?.[lang==='en'?1:0]||'';}

class RaceFlags {
  constructor(race){
    this.race=race;this.offSince=new Map();this.observed=new Map();this.penalties=new Map();
    this.blueUntil=new Map();this.zones=[];this.chequered=false;
  }
  inspect(c){
    const i=this.race.cars.indexOf(c),previous=this.observed.get(i)||{fautes:0,repris:0,invalid:false};
    const penalty=(c.fautes||0)>previous.fautes||(c.repris||0)>previous.repris+.001;
    const invalid=this.race.mode==='timetrial'&&c.lapSale&&!previous.invalid;
    if((penalty||invalid)&&this.race.state!=='countdown'&&!c.finished)this.penalties.set(i,this.race.time+FLAG_PENALTY_DURATION);
    this.observed.set(i,{fautes:c.fautes||0,repris:c.repris||0,invalid:!!c.lapSale});
  }
  update(){
    const r=this.race,now=r.time;
    if(r.netDrive&&!r.netDrive.host){if(!r.opts.spectator)this.inspect(r.player);return;}
    const active=r.state==='racing'||r.state==='finishing';
    this.zones=[];
    r.cars.forEach((c,i)=>{
      this.inspect(c);
      if(active&&c.state==='grass'&&!c.inPit&&!c.finished){
        if(!this.offSince.has(i))this.offSince.set(i,now);
        if(now-this.offSince.get(i)>=FLAG_YELLOW_DELAY)this.zones.push({id:i,s:c.s,before:35,after:15});
      }else this.offSince.delete(i);
      let blue=false;
      if(active&&r.mode==='race'&&!c.inPit&&!c.finished){
        for(const other of r.cars){
          if(other===c||other.inPit||other.finished||!other.started)continue;
          // More than half a lap of actual progress distinguishes lapping from a position battle
          // on either side of the start line. A local crossing alone must not trigger blue.
          if(other.progress-c.progress<r.track.length*.5)continue;
          const gap=r.track.diff(other.s,c.s),length=(c.cls.length+other.cls.length)/2;
          const closing=Math.max(0,other.v-c.v),range=clamp(closing*2+length*2,12,100);
          if((gap>=0&&gap<range&&(closing>.5||gap<length*2))||Math.abs(gap)<length*1.5){blue=true;break;}
        }
        if(blue)this.blueUntil.set(i,now+1.2);
        blue=(this.blueUntil.get(i)||0)>now;
        // Do not make a ghost solid while another car is still inside it.
        if(!blue&&c.blueFlag&&r.cars.some(o=>o!==c&&!o.inPit
          &&Math.abs(r.track.diff(c.s,o.s))<(c.cls.length+o.cls.length)/2+.3
          &&Math.abs(c.lat-o.lat)<(c.cls.width+o.cls.width)/2+.2)){
          this.blueUntil.set(i,now+.25);blue=true;
        }
      }
      c.blueFlag=blue;
    });
    if(active&&r.mode==='race'&&r.cars.some(c=>c.started&&c.lap>=r.laps-1))this.chequered=true;
  }
  personal(c){
    if((this.penalties.get(this.race.cars.indexOf(c))||0)>this.race.time)return 'penalty';
    return c.blueFlag?'blue':null;
  }
  active(c){
    if(this.race.state==='countdown')return [];
    const main=this.personal(c)||(this.zones.length?'yellow':null);
    return [main,this.chequered?'chequered':null].filter(Boolean);
  }
  packet(){
    return {blue:this.race.cars.flatMap((c,i)=>c.blueFlag?[i]:[]),
      penalties:[...this.penalties].filter(([,until])=>until>this.race.time),zones:this.zones,chequered:this.chequered};
  }
  key(){const p=this.packet();return JSON.stringify([p.blue,p.penalties,p.zones.map(z=>z.id),p.chequered]);}
  receive(packet){
    if(!packet||!Array.isArray(packet.blue)||!Array.isArray(packet.zones)||!Array.isArray(packet.penalties))return;
    this.race.cars.forEach((c,i)=>c.blueFlag=packet.blue.includes(i));
    for(const [id,until]of packet.penalties)if(this.race.cars[id]&&Number.isFinite(until))this.penalties.set(id,Math.max(until,this.penalties.get(id)||0));
    this.zones=packet.zones.filter(z=>this.race.cars[z.id]&&Number.isFinite(z.s)).map(z=>({id:z.id,s:z.s,before:35,after:15}));
    this.chequered=!!packet.chequered;
  }
}

function drawRaceFlag(g,type,x,y,size){
  g.save();
  g.fillStyle=type==='blue'?'#3b82f6':type==='yellow'?'#e9be37':'#f5f3e8';g.fillRect(x,y,size,size);
  if(type==='penalty'){
    g.fillStyle='#171a1d';g.beginPath();g.moveTo(x,y);g.lineTo(x+size,y);g.lineTo(x,y+size);g.closePath();g.fill();
  }else if(type==='chequered'){
    g.fillStyle='#171a1d';const cell=size/4;
    for(let r=0;r<4;r++)for(let c=0;c<4;c++)if((r+c)%2===0)g.fillRect(x+c*cell,y+r*cell,cell,cell);
  }
  const border=Math.min(1,size/12);
  g.strokeStyle='rgba(255,255,255,.85)';g.lineWidth=border;g.strokeRect(x+border/2,y+border/2,size-border,size-border);g.restore();
}

// A single stroked path paints incidents without accumulating opacity where zones overlap.
function drawYellowFlagZones(g,race,point,width,opacity=.24){
  if(!race.flags?.zones.length)return;
  g.save();g.strokeStyle='rgba(233,190,55,'+opacity+')';g.lineWidth=width;g.lineCap='butt';g.lineJoin='round';g.beginPath();
  for(const zone of race.flags.zones){
    for(let d=-zone.before;d<=zone.after;d+=2){
      const s=race.track.wrap(zone.s+d),p=point(race.track.pos(s,0));
      if(d===-zone.before)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y);
    }
  }
  g.stroke();g.restore();
}

function drawMapRaceFlags(g,race,point,size=7,world=false){
  if(!race.flags)return;
  for(const c of race.cars){
    const flag=race.flags.personal(c);if(!flag)continue;
    const p=point(c.pos),clearance=world?Math.hypot(c.cls.length,c.cls.width)/2:0;
    drawRaceFlag(g,flag,p.x+size+clearance,p.y-size*1.8-clearance,size);
  }
  if(race.flags.chequered){const p=point(race.track.pos(0,0));drawRaceFlag(g,'chequered',p.x-size,p.y-size*2,size);}
}

function raceFlagHTML(type,lang='fr'){
  const label=raceFlagLabel(type,lang);
  return '<span class="race-flag race-flag-'+type+'" role="img" aria-label="'+label+'" title="'+label+'"></span>';
}
