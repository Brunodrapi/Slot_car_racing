// Profil opt-in de dessin procédural, issu de docs/skill_circuit/skill_circuit.txt.
// Uniquement des chemins en mètres du monde : aucune image à charger, aucune physique à modifier.
'use strict';
const CIRCUIT_MATERIALS = Object.freeze({
  asphalt:'#424448',asphaltFresh:'#34373B',asphaltLight:'#55565A',runoff:'#606267',
  pitLane:'#4A4C50',pitBox:'rgba(214,213,206,.22)',pitBoxLine:'#F1F0E8',
  rubber:'#292A2C',edgeLine:'#F1F0E8',centre:null,
  grass:'#6D9652',grassLight:'#799E60',grassDark:'#557944',grassDry:'#A2A06A',
  gravel:'#C7B48C',gravelDark:'#A99874',outline:'#34373B',
  beton:'#A9A9A3',betonOmbre:'#81827E',toit:'#D6D5CE',verriere:'#758487',
  metal:'#A6AAAD',metalShadow:'#55585B',tyre:'#27292A',tyreLight:'#373A3C',
  barrierBlocks:['#A9A9A3','#D6D5CE','#A9A9A3'],
  canopy:['#416944','#527B50','#35563B'],pine:['#345A46','#416851'],sousBois:'#3C5C38',
});

class CircuitGraphics {
  constructor(track,palette,config) {
    this.track=track;this.palette=palette;this.config=config;
    this.terrain=[];this.chunks=[];this.grid=new Path2D();this.greenAprons=new Path2D();
    this.runoffBands=(config.runoffColors||[]).map(color=>({color,path:new Path2D()}));
    // Bandes longitudinales dans les seuls dégagements asphaltés existants.
    // Une marge grise sépare la chaussée et le décor coloré ; aucune surface physique créée.
    for(const side of [-1,1])for(let s=0;s<track.length;s++){
      for(let b=0;b<this.runoffBands.length;b++){
        const points=[];let valid=true;
        for(const u of [s,s+1]){
          const i=track.idx(u),hw=side>0?track.hwLeftAt(u):track.hwRightAt(u);
          const w=(track.asphaltW?track._lerp(track.asphaltW[side>0?'L':'R'],u):0);
          const start=Math.max(3.5,KERB_IN+track.kerb[i]+1.5),end=w-.6;
          if(end-start<2){valid=false;break;}
          const lo=start+(end-start)*b/this.runoffBands.length,hi=start+(end-start)*(b+1)/this.runoffBands.length;
          points.push([track.pos(u,side*(hw+lo)),track.pos(u,side*(hw+hi))]);
        }
        if(valid){const p=this.runoffBands[b].path,a=points[0],c=points[1];
          p.moveTo(a[0].x,a[0].y);p.lineTo(c[0].x,c[0].y);p.lineTo(c[1].x,c[1].y);p.lineTo(a[1].x,a[1].y);p.closePath();}
      }
    }
    // Bandes vertes d'approche : limitées aux zones bitumées, distinctes de l'herbe.
    for(const z of config.entryAprons||[]){
      for(let s=Math.ceil(z.from*track.length);s<z.to*track.length;s++){
        const points=[];let valid=true;
        for(const u of [s,s+1]){
          const i=track.idx(u),hw=z.side>0?track.hwLeftAt(u):track.hwRightAt(u);
          const w=(track.asphaltW?track._lerp(track.asphaltW[z.side>0?'L':'R'],u):0);
          const lo=KERB_IN+track.kerb[i]+.15,hi=Math.min(lo+2.4,w-.35);
          if(hi-lo<.35){valid=false;break;}
          points.push([track.pos(u,z.side*(hw+lo)),track.pos(u,z.side*(hw+hi))]);
        }
        if(valid){const p=this.greenAprons,a=points[0],b=points[1];
          p.moveTo(a[0].x,a[0].y);p.lineTo(b[0].x,b[0].y);p.lineTo(b[1].x,b[1].y);p.lineTo(a[1].x,a[1].y);p.closePath();}
      }
    }
    for(const z of config.greenAprons||[]){
      for(let s=Math.ceil(z.from*track.length);s<z.to*track.length;s++){
        const points=[];let valid=true;
        for(const u of [s,s+1]){
          const i=track.idx(u),kw=track.kerb[i],hw=z.side>0?track.hwLeftAt(u):track.hwRightAt(u);
          const available=(track.asphaltW?track._lerp(track.asphaltW[z.side>0?'L':'R'],u):0);
          const inner=KERB_IN+kw+.12,width=Math.min(1.4,available-inner-.35);
          if(kw<.2||width<.2){valid=false;break;}
          points.push([track.pos(u,z.side*(hw+inner)),track.pos(u,z.side*(hw+inner+width))]);
        }
        if(valid){const p=this.greenAprons,a=points[0],b=points[1];
          p.moveTo(a[0].x,a[0].y);p.lineTo(b[0].x,b[0].y);p.lineTo(b[1].x,b[1].y);p.lineTo(a[1].x,a[1].y);p.closePath();}
      }
    }
    const rnd=propRng(seedFromId('circuit-graphics:'+track.id));
    const b=track.bounds,cell=90;
    for(let x=Math.floor((b.minX-180)/cell);x<=Math.ceil((b.maxX+180)/cell);x++)
      for(let y=Math.floor((b.minY-180)/cell);y<=Math.ceil((b.maxY+180)/cell);y++){
        const cx=(x+rnd())*cell,cy=(y+rnd())*cell,r=30+rnd()*45,p=new Path2D();
        for(let k=0;k<8;k++){
          const a=k/8*Math.PI*2,d=r*(.7+rnd()*.45),px=cx+Math.cos(a)*d,py=cy+Math.sin(a)*d*.7;
          if(k)p.lineTo(px,py);else p.moveTo(px,py);
        }
        p.closePath();this.terrain.push({path:p,color:rnd()<.18?palette.grassDry:rnd()<.5?palette.grassDark:palette.grassLight,
          alpha:.16+rnd()*.12,bbox:{minX:cx-r,maxX:cx+r,minY:cy-r,maxY:cy+r}});
      }
    const dot=(p,x,y,r)=>{p.moveTo(x-r,y);p.lineTo(x+r*.7,y-r*.6);p.lineTo(x+r,y+r*.5);p.closePath();};
    const zones=config.wearZones||[];
    for(let a=0;a<track.n;a+=48){
      const end=Math.min(a+48,track.n),i=track.idx(a),j=track.idx(end);
      const c={grain:new Path2D(),gravel:new Path2D(),runoffGrain:new Path2D(),wear:[new Path2D(),new Path2D(),new Path2D()],
        bbox:{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity}};
      const include=(p,pad=3)=>{c.bbox.minX=Math.min(c.bbox.minX,p.x-pad);c.bbox.maxX=Math.max(c.bbox.maxX,p.x+pad);c.bbox.minY=Math.min(c.bbox.minY,p.y-pad);c.bbox.maxY=Math.max(c.bbox.maxY,p.y+pad);};
      for(let s=a;s<end;s+=1){
        const hw=Math.min(track.hwLeftAt(s),track.hwRightAt(s));
        for(let n=0;n<3;n++){
          const p=track.pos(s+rnd(),(rnd()*2-1)*(hw-.5));dot(c.grain,p.x,p.y,.045+rnd()*.07);
        }
        for(const side of [-1,1]){
          const w=(track.bacW?track._lerp(track.bacW[side>0?'L':'R'],s):0),hw=side>0?track.hwLeftAt(s):track.hwRightAt(s);
          include(track.pos(s,side*(hw+w)));
          const aw=(track.asphaltW?track._lerp(track.asphaltW[side>0?'L':'R'],s):0);
          include(track.pos(s,side*(hw+aw)));
          if(aw>.5){
            // Graine locale indépendante : ne décale pas le tirage des autres matériaux.
            const noise=propRng(seedFromId('runoff:'+track.id+':'+s+':'+side));
            for(let n=0;n<4;n++){
              const p=track.pos(s+noise(),side*(hw+.1+noise()*Math.max(0,aw-.2)));
              dot(c.runoffGrain,p.x,p.y,.04+noise()*.065);
            }
          }
          if(w>1)for(let n=0;n<3;n++){
            const p=track.pos(s+rnd(),side*(hw+.25+rnd()*(w-.5)));
            dot(c.gravel,p.x,p.y,.055+rnd()*.10);
          }
        }
        let strength=0;
        for(const z of zones){
          const d=track.diff(s,z.at*track.length),span=z.approach+z.exit;
          if(d>=-z.exit&&d<=z.approach)strength=Math.max(strength,Math.sin(Math.PI*(d+z.exit)/span)**2);
        }
        if(strength>.08){
          const p=c.wear[Math.min(2,Math.floor(strength*3))],width=.6+strength*.9;
          const edge=(u,side)=>track.pos(u,clamp(track.lineLat('racing',u)+side*width,-track.hwRightAt(u)+.35,track.hwLeftAt(u)-.35));
          for(const [u,side] of [[s,-1],[s+1,-1],[s+1,1],[s,1]]){
            const q=edge(u,side);if(u===s&&side===-1)p.moveTo(q.x,q.y);else p.lineTo(q.x,q.y);
          }
          p.closePath();
        }
      }
      this.chunks.push(c);
    }
    const grid=config.grid;
    if(grid)for(let row=0;row<grid.rows;row++)for(const side of [-1,1]){
      const s=track.wrap(-grid.offset-row*grid.pitch),lat=side*Math.min(track.hwLeftAt(s),track.hwRightAt(s))*.48;
      const p=track.pos(s,lat),th=track.headingAt(s),tx=Math.cos(th),ty=Math.sin(th),nx=Math.sin(th),ny=-Math.cos(th);
      this.grid.moveTo(p.x+nx,p.y+ny);this.grid.lineTo(p.x-nx,p.y-ny);this.grid.lineTo(p.x-nx-tx*3,p.y-ny-ty*3);
    }
  }
  visible(b,v){return b.maxX>=v.minX&&b.minX<=v.maxX&&b.maxY>=v.minY&&b.minY<=v.maxY;}
  drawTerrain(g,v){
    g.save();for(const t of this.terrain)if(this.visible(t.bbox,v)){g.globalAlpha=t.alpha;g.fillStyle=t.color;g.fill(t.path);}g.restore();
  }
  drawGravel(g,v,zoom){
    if(zoom<3)return;g.save();g.fillStyle=this.palette.gravelDark;g.globalAlpha=.55;
    for(const c of this.chunks)if(this.visible(c.bbox,v))g.fill(c.gravel);g.restore();
  }
  drawRunoff(g,v,zoom,clip){
    g.save();g.clip(clip);
    for(const band of this.runoffBands){g.fillStyle=band.color;g.fill(band.path);}
    g.fillStyle='#448C58';g.globalAlpha=.8;g.fill(this.greenAprons);
    if(zoom<3){g.restore();return;}
    g.fillStyle='#727478';g.globalAlpha=.24;
    for(const c of this.chunks)if(this.visible(c.bbox,v))g.fill(c.runoffGrain);
    g.restore();
  }
  drawRoad(g,v,zoom){
    g.save();
    for(const c of this.chunks)if(this.visible(c.bbox,v)){
      if(zoom>=3){g.fillStyle=this.palette.asphaltLight;g.globalAlpha=.22;g.fill(c.grain);}
      g.fillStyle=this.palette.rubber;
      for(let i=0;i<3;i++){g.globalAlpha=.055+i*.035;g.fill(c.wear[i]);}
    }
    g.restore();
  }
  drawGrid(g){g.save();g.strokeStyle=this.palette.edgeLine;g.lineWidth=.15;g.lineCap='butt';g.stroke(this.grid);g.restore();}
  drawPitGarages(g,garages){
    const pal=this.palette;
    for(const b of garages){
      g.save();g.translate(b.x,b.y);g.rotate(b.a);
      g.fillStyle=pal.betonOmbre;g.fillRect(-b.w/2,-b.h/2,b.w,b.h);
      g.fillStyle=pal.toit;g.fillRect(-b.w/2+.2,-b.h/2+.2,b.w-.4,b.h*.62);
      for(let i=0;i<4;i++){
        g.fillStyle=pal.asphaltFresh;g.fillRect(-b.w/2+i*b.w/4+.35,b.h*.18,b.w/4-.7,b.h*.27);
        g.fillStyle=pal.edgeLine;g.fillRect(-b.w/2+i*b.w/4+.35,b.h*.1,b.w/4-.7,.15);
      }
      g.restore();
    }
  }
}
