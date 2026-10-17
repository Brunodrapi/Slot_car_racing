// Élargissement demandé par Bruno, sans génération ni nouveau modèle.
// node tools/elargir-sprites.js [--factor=1.25]
// Les références conservées dans art-src rendent la transformation réversible et idempotente.
'use strict';
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const {MODELS}=require('../js/cars');
const {geometry}=require('./pack-nouvelles-voitures');
const ROOT=path.resolve(__dirname,'..');
const SOURCE=path.join(ROOT,'art-src/voitures/gabarits-trappus');
const angle={tyrrellp34:-25,ferrari312t:-30,mclarenm23:-26,lotus79:-24,lotus72:-18,brabhambt46b:-17,williamsfw07:-23,ligierjs11:-18,renaultrs10:-18,xjr9:-23};
async function widen(factor=1.25) {
  if(!(factor>=1&&factor<=1.6))throw Error('Facteur attendu entre 1 et 1,6');
  const report=[];
  for(const m of MODELS.filter(m=>m.catId==='f1'||m.id==='xjr9'))for(const lv of m.livrees)for(const kind of ['top','pick']) {
    const dest=path.join(ROOT,lv[kind]);
    const src=path.join(SOURCE,kind,path.basename(dest));
    fs.mkdirSync(path.dirname(src),{recursive:true});
    if(!fs.existsSync(src))fs.copyFileSync(dest,src);
    const before=await geometry(src);
    if(kind==='top') {
      // Nez à droite : l'axe transversal est la hauteur de l'image, pas sa longueur.
      await sharp(src).resize(before.width,Math.round(before.height*factor),{fit:'fill'}).png().toFile(dest);
    } else {
      // Élargissement perpendiculaire à l'axe de la voiture dans sa perspective de sélection.
      // M = I + (facteur - 1) n.nᵀ : axe longitudinal inchangé, axe transversal élargi.
      const a=angle[m.id]*Math.PI/180,nx=-Math.sin(a),ny=Math.cos(a),d=factor-1;
      const matrix=[[1+d*nx*nx,d*nx*ny],[d*nx*ny,1+d*ny*ny]];
      const transformed=await sharp(src).affine(matrix,{background:'#00000000',interpolator:sharp.interpolators.nohalo}).png().toBuffer();
      // Recadrage commun basé sur la voiture de base, appliqué à toutes ses peintures.
      // Il évite qu'un filet de contour différent modifie l'échelle entre deux livrées.
      const reference=path.join(SOURCE,kind,m.id+'.png');
      const base=await sharp(reference).affine(matrix,{background:'#00000000',interpolator:sharp.interpolators.nohalo}).png().toBuffer();
      const bb=(await geometry(base)).bbox;
      await sharp(transformed).extract(bb).resize(420).png().toFile(dest);
    }
    const after=await geometry(dest);
    report.push({model:m.id,livery:lv.id,view:kind,file:lv[kind],source:path.relative(ROOT,src),factor,
      ...(kind==='pick'?{axisDegrees:angle[m.id]}:{}),before:{width:before.width,height:before.height},after:{width:after.width,height:after.height}});
  }
  fs.writeFileSync(path.join(ROOT,'docs/nouvelles-voitures/elargissement.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`${report.length} sprites : neuf F1 et trois livrées XJR-9, facteur transversal ${factor}.`);
  return report;
}
if(require.main===module)widen(Number((process.argv.find(a=>a.startsWith('--factor='))||'--factor=1.25').split('=')[1])).catch(e=>{console.error(e);process.exitCode=1;});
module.exports=widen;
