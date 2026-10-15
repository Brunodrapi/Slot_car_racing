// Planche fournie par Bruno : les rectangles sont lus directement dans le PNG original.
// Son damier est peint dans le RGB ; seul ce fond neutre devient transparent au chargement.
'use strict';
const GB_ATLAS_URL = 'sprites/258d3eed-5c3d-4689-88a3-8a875d471673.png';
const GB_ATLAS_RECTS = {
  tree: [[11,11,158,164],[183,12,163,168],[355,12,155,168],[521,12,135,154]],
  pine: [[1154,13,90,143],[1254,17,78,137],[1340,7,89,147],[1445,33,75,121],[1141,170,70,156]],
  bush: [[18,189,121,122],[152,184,117,127],[282,188,129,123],[422,188,122,123],[633,141,99,114],[742,148,105,108]],
  flower: [[18,328,127,95],[158,326,111,93],[285,326,101,93],[403,333,99,89]],
  grass: [[997,357,49,58],[1067,355,51,64],[1136,358,33,45],[709,438,43,58]],
  rock: [[21,516,100,98],[147,523,76,66],[242,529,46,43],[467,519,115,101]],
  stump: [[603,501,83,85],[703,513,78,76]],
  log: [[799,519,118,50],[630,592,75,38]],
  rail: [[703,869,99,45],[818,869,104,45],[938,869,86,45]],
  tyre: [[1102,941,32,42],[1136,941,31,42],[1297,951,31,40]],
  gravel: [[30,873,68,108]],
  asphalt: [[38,651,26,80]],
};
const GB_ATLAS = { ready:false, failed:false, sprites:{}, promise:null };

function chargeAtlasGB() {
  if (GB_ATLAS.promise) return GB_ATLAS.promise;
  GB_ATLAS.promise = new Promise(resolve => {
    const img=new Image();
    img.onerror=()=>{GB_ATLAS.failed=true;resolve(false);};
    img.onload=()=>{
      try {
        for(const [kind,rects] of Object.entries(GB_ATLAS_RECTS)) {
          GB_ATLAS.sprites[kind]=rects.map(([x,y,w,h])=>{
            const c=document.createElement('canvas');c.width=w;c.height=h;
            const g=c.getContext('2d');g.drawImage(img,x,y,w,h,0,0,w,h);
            const data=g.getImageData(0,0,w,h),p=data.data;
            for(let i=0;i<p.length;i+=4){
              const lo=Math.min(p[i],p[i+1],p[i+2]),hi=Math.max(p[i],p[i+1],p[i+2]);
              if(kind!=='gravel'&&kind!=='asphalt'&&lo>100&&hi-lo<35){p[i+3]=0;continue;}
              // Les verts de la planche sont déjà sombres. Les passer directement dans
              // le filtre du décor ferait disparaître deux tons. Encoder les quatre
              // valeurs avant ce filtre conserve le relief et les contours du dessin.
              const l=(p[i]+2*p[i+1]+p[i+2])/4;
              const tone=l<46?24:l<94?125:l<156?202:255;
              p[i]=p[i+1]=p[i+2]=tone;
            }
            g.putImageData(data,0,0);
            return c;
          });
        }
        GB_ATLAS.ready=true;resolve(true);
      }catch(e){GB_ATLAS.failed=true;resolve(false);}
    };
    img.src=GB_ATLAS_URL;
  });
  return GB_ATLAS.promise;
}

function appliqueAtlasGB(art) {
  if(!GB_ATLAS.ready)return art;
  const counts={};
  for(const [id,old] of Object.entries(art)) {
    const kind=/^(arbre|tree)/.test(id)?'tree':/^(sapin|pine)/.test(id)?'pine'
      : /fleuri|fleur|flower/.test(id)?'flower':/buisson|bush|arbuste/.test(id)?'bush'
      : /herbe|fougere|plant|grass|fern|branche/.test(id)?'grass':/rocher|caillou|rock/.test(id)?'rock'
      : /souche|stump/.test(id)?'stump':/rondin|logs/.test(id)?'log'
      : /rail|glissiere|barriere|muret/.test(id)?'rail':/^pneu-/.test(id)?'tyre':null;
    if(!kind)continue;
    const list=GB_ATLAS.sprites[kind],n=counts[kind]||0;counts[kind]=n+1;
    const canvas=list[n%list.length];
    art[id]={canvas,wm:old.wm,hm:old.wm*canvas.height/canvas.width,
      anc:kind==='pine'?.88:kind==='rail'?.5:.56,ancX:.5,cuite:true,gbAtlas:true};
  }
  return art;
}
