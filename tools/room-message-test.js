'use strict';
const assert=require('assert/strict');
const {RoomRTC}=require('../js/room-rtc');
function pair(){
  const make=()=>({open:false,handlers:{},dataChannel:{bufferedAmount:0},on(k,f){(this.handlers[k]??=[]).push(f);},emit(k,...args){for(const f of this.handlers[k]||[])f(...args);},close(){this.open=false;}});
  const a=make(),b=make();a.send=d=>b.emit('data',structuredClone(d));b.send=d=>a.emit('data',structuredClone(d));return [a,b];
}
const h=new RoomRTC(),a=new RoomRTC(),b=new RoomRTC();h.host=true;
h.label='0-host';a.label='1-a';b.label='1-b';h.mine={pid:'host'};a.mine={pid:'a'};b.mine={pid:'b'};
const [ha,ah]=pair(),[hb,bh]=pair();h.wire(ha);h.wire(hb);a.wire(ah);b.wire(bh);
for(const c of [ha,ah,hb,bh])c.open=true;
for(const c of [ha,ah,hb,bh])c.emit('open');
// Real wire() must allow a host to relay a lobby presence originating at another guest.
a.presence({ready:true});assert.equal(b.others.get('1-a').presence.pid,'a');
let hostPackets=0,aPackets=0,bPackets=0;
h.onMessage((p,from)=>{assert.equal(from,'1-a');hostPackets++;});
a.onMessage(()=>aPackets++);b.onMessage((p,from)=>{assert.equal(from,'0-host');bPackets++;});
h.relayer=false;
a.message({kind:'owned',seq:1},'0-host');assert.equal(hostPackets,1);
h.message({kind:'view',data:new Uint8Array([0])},'1-b');assert.equal(bPackets,1);assert.equal(aPackets,0);
assert.equal(b.others.get('0-host').presence.pid,'host','race packet cannot overwrite host lobby presence');
ha.emit('data',{from:'1-b',message:{kind:'owned'}});assert.equal(hostPackets,1,'connection-bound sender cannot impersonate another guest');
hb.dataChannel.bufferedAmount=20000;h.message({kind:'view'},'1-b');assert.equal(bPackets,1);
h.message({kind:'ping'},'1-b');assert.equal(bPackets,2,'small probe may pass moderate backlog');
hb.dataChannel.bufferedAmount=70000;h.message({kind:'control'},'1-b');assert.equal(bPackets,2);
hb.dataChannel.bufferedAmount=0;h.message({kind:'view'},'1-b');assert.equal(bPackets,3);
console.log('OK: actual RoomRTC wire, lobby relay, addressed movement, sender binding, congestion and recovery.');
