/* LES À-COUPS CONTRE LES GAZ TENUS : est-ce que doser rapporte quelque chose ?

   C'est la question que pose le modèle de motricité, et aucun banc existant n'y répondait.
   `motricite-banc.js` compare des FACTEURS de partage, et `motricite-pulsations.js` compare ces
   mêmes facteurs sous trois rythmes — utile quand le facteur était une constante à choisir. Il
   n'en est plus une : la glisse de l'arrière s'accumule dans le temps, donc tenir et doser ne
   sont plus la même commande moyenne, et c'est CELA qu'il faut mesurer.

   Le protocole : on roule jusqu'au virage le plus chargé du tour, on en garde l'état exact, puis
   on rejoue 1,2 s depuis cet état avec quatre commandes — pied levé, gaz tenus, et des à-coups
   de 60 et 120 ms. Les trois commandes avec gaz ne sont pas comparables en temps enfoncé : c'est
   voulu. La question n'est pas « à temps d'appui égal », c'est « avec le pouce, qu'est-ce qui
   marche le mieux ». Le pilote n'a qu'un bouton tout ou rien.

   On relève la vitesse en sortie, la dérive maximale et le temps passé hors piste. Doser doit
   rendre plus de vitesse QUE les gaz tenus — pas seulement moins de dérive, sinon il suffirait de
   lever le pied.

     node tools/acoups.js [circuits]
*/
'use strict';
const vm = require('node:vm');
const { contextFor } = require('./motricite-banc.js');

const CIRCUITS = (process.argv[2] || 'monaco,spa,monza,zandvoort').split(',');
const context = contextFor('live');
context.CIRCUITS = CIRCUITS;

const etats = vm.runInContext(`(() => {
 const out=[];
 for(const model of modelsOf('gt')) for(const tid of CIRCUITS) {
  let seed=42761;
  Math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
  const r=new Race({trackDef:TRACKS.find(t=>t.id===tid),classId:'gt',modelId:model.id,playerAI:true,mode:'timetrial',nCars:1});
  /* On garde le virage le plus chargé DE CHAQUE BANDE, et non le plus chargé du tour.

  Ne garder que le maximum donnait trente-six états tous à pleine charge, donc une seule bande
  remplie et une comparaison qui ne disait rien des virages ordinaires — ceux où l'on passe en
  fait le plus clair d'un tour. */
  const p=r.player;const bandes=[null,null,null];
  while(p.lap<1 && r.time<250) {
   const gas=aiThrottle(p,r.cars,r.dt,{marginBase:.95,marginSpread:0});
   r.update(r.dt,gas);
   if(r.state!=='racing'||p.state!=='ok'||p.v<15||!gas)continue;
   const rear=Math.abs(p.alphaR)/p.cls.slipPeak;
   const b=rear<0.6?0:rear<0.85?1:2;
   if(!bandes[b]||rear>bandes[b].rear){
    const state={};for(const k of Object.keys(p))if(p[k]===null||['number','boolean','string'].includes(typeof p[k]))state[k]=p[k];
    bandes[b]={car:model.id,track:tid,time:r.time,rear,state};
   }
  }
  if(!bandes.some(Boolean))throw Error('Aucun virage mesurable '+model.id+' '+tid);
  for(const b of bandes)if(b)out.push(b);
 }
 return out;
})()`, context, { timeout: 180000 });

const rejoue = new vm.Script(`(() => {
 let seed=42761;Math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
 const r=new Race({trackDef:TRACKS.find(t=>t.id===SNAP.track),classId:'gt',modelId:SNAP.car,playerAI:true,mode:'timetrial',nCars:1});
 const p=r.player;Object.assign(p,SNAP.state);r.state='racing';r.time=SNAP.time;r.acc=0;
 if(FREIN!=null)r.poseFrein(FREIN);
 let maxBeta=0,off=0,gasTime=0,glisseMax=0,maxRot=0;
 for(let i=0;i<144;i++){
  const gas=RYTHME===0?false:RYTHME<0?true:Math.floor(i/(RYTHME/1000*120))%2===0;
  r.update(r.dt,gas);
  if(![p.x,p.v,p.vl,p.w,p.glisseArr].every(Number.isFinite))throw Error('État non fini');
  if(gas)gasTime+=r.dt;
  maxBeta=Math.max(maxBeta,Math.abs(p.beta)*180/Math.PI);
  glisseMax=Math.max(glisseMax,p.glisseArr);
  const kPiste=r.track.curvAt(p.s);
  maxRot=Math.max(maxRot,Math.abs(p.w)-Math.abs(p.v*kPiste));
  if(p.state==='grass')off+=r.dt;
 }
 /* LA ROTATION SE LIT SUR LE LACET, PAS SUR LA TRAJECTOIRE.

 Une première version mesurait de combien la voiture finissait plus près de la corde, et ne voyait
 rien : le correcteur de direction asservit la voiture sur sa ligne, donc il annule exactement ce
 qu'on cherche à mesurer. La voiture tourne bien plus, puis se redresse — et le point d'arrivée est
 le même. Ce que le pilote sent, c'est la vitesse de lacet EN PLUS de celle que la trajectoire
 réclame : w moins v fois k. C'est elle qu'on relève. */
 return {dv:p.v-SNAP.state.v,maxBeta,off,gasTime,glisseMax,
  rotation:maxRot*180/Math.PI,fautes:p.crashes-SNAP.state.crashes};
})()`);

const RYTHMES = [[0, 'pied levé'], [-1, 'gaz tenus'], [60, 'à-coups 60 ms'], [120, 'à-coups 120 ms']];
const moy = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

console.log(`${etats.length} états de virage, ${CIRCUITS.length} circuits, 1,2 s rejouées\n`);
console.log('commande        Δv m/s   dérive max   glisse max   gaz   sorties');
const bilan = {};
for (const [ms, nom] of RYTHMES) {
  const rows = etats.map((snap) => {
    context.SNAP = snap; context.RYTHME = ms; context.FREIN = null;
    return rejoue.runInContext(context);
  });
  bilan[nom] = rows;
  console.log(nom.padEnd(15)
    + moy(rows.map(r => r.dv)).toFixed(2).padStart(7)
    + moy(rows.map(r => r.maxBeta)).toFixed(1).padStart(12) + '°'
    + moy(rows.map(r => r.glisseMax)).toFixed(2).padStart(12)
    + (moy(rows.map(r => r.gasTime)) / 1.2 * 100).toFixed(0).padStart(5) + '%'
    + rows.filter(r => r.off > 0).length.toString().padStart(8));
}
/* LE VERDICT SE LIT PAR NIVEAU DE CHARGE, et non sur la moyenne de tous les virages.

   Une première version comparait la moyenne générale, et elle se contredisait d'une mesure à
   l'autre sans que la physique ait bougé : les états de départ sont pris sur le virage le plus
   chargé que l'IA rencontre, or l'IA conduit différemment selon le modèle, donc les états
   changeaient avec lui. Quand elle lève plus tôt, ses virages les plus chargés le sont moins, et
   dans un virage moyennement chargé tenir les gaz EST la bonne commande — il n'y a rien à doser.

   La question n'a donc de sens que par bande : dans un virage à pleine charge, doser doit payer ;
   dans un virage tranquille, il ne doit rien coûter. C'est ce qu'on imprime. */
const BANDES = [[0, 0.6, 'charge faible'], [0.6, 0.85, 'charge moyenne'], [0.85, 9, 'pleine charge']];
console.log('\npar niveau de charge de l\'arrière à l\'entrée :');
console.log('bande              n   tenu Δv   dosé Δv    gain   dérive tenue   dosée');
let verdict = null;
for (const [lo, hi, nom] of BANDES) {
  const idx = etats.map((e, i) => [e.rear, i]).filter(([r]) => r >= lo && r < hi).map(([, i]) => i);
  if (!idx.length) { console.log(nom.padEnd(16) + '   —'); continue; }
  const t = idx.map(i => bilan['gaz tenus'][i]);
  const d60 = idx.map(i => bilan['à-coups 60 ms'][i]), d120 = idx.map(i => bilan['à-coups 120 ms'][i]);
  const dose = moy(d60.map(r => r.dv)) >= moy(d120.map(r => r.dv)) ? d60 : d120;
  const gain = moy(dose.map(r => r.dv)) - moy(t.map(r => r.dv));
  console.log(nom.padEnd(16) + idx.length.toString().padStart(4)
    + moy(t.map(r => r.dv)).toFixed(2).padStart(10)
    + moy(dose.map(r => r.dv)).toFixed(2).padStart(10)
    + gain.toFixed(2).padStart(8)
    + moy(t.map(r => r.maxBeta)).toFixed(1).padStart(14) + '°'
    + moy(dose.map(r => r.maxBeta)).toFixed(1).padStart(7) + '°');
  if (hi > 1) verdict = gain;
}
/* CE QUI EST DEMANDÉ, ET CE QUI NE L'EST PAS.

   « Quand tu accélères à fond en virage, la voiture dérape ; il faut un mécanisme d'à-coups
   rapides pour réguler la vitesse. » Ce qui doit être vrai, c'est donc que les gaz tenus fassent
   DÉRAPER à pleine charge, et que doser contienne ce dérapage. Il n'est nulle part demandé que
   doser aille plus vite — réguler, c'est précisément échanger un peu de vitesse contre du
   contrôle, et un dosage qui serait gratuit ne serait pas un dosage, juste un meilleur réglage.
   On vérifie donc les deux faits, et on imprime le prix. */
const pleine = etats.map((e, i) => [e.rear, i]).filter(([r]) => r >= 0.85).map(([, i]) => i);
if (pleine.length) {
  const bt = moy(pleine.map(i => bilan['gaz tenus'][i].maxBeta));
  const bd = moy(pleine.map(i => bilan['à-coups 60 ms'][i].maxBeta));
  const prix = moy(pleine.map(i => bilan['à-coups 60 ms'][i].dv))
    - moy(pleine.map(i => bilan['gaz tenus'][i].dv));
  console.log('');
  /* Quinze degrés : c'est l'angle à partir duquel la voiture se voit de travers à l'écran, et
     c'est une moyenne de pics, donc les virages les plus durs sont bien au-delà. */
  console.log(bt > 15 ? `à pleine charge les gaz tenus font déraper : ${bt.toFixed(1)}° de dérive`
    : `LES GAZ TENUS NE FONT PAS DÉRAPER (${bt.toFixed(1)}°) — le modèle est à revoir`);
  console.log(bd < bt * 0.75 ? `doser contient le dérapage : ${bd.toFixed(1)}° au lieu de ${bt.toFixed(1)}°`
    : `DOSER NE CONTIENT RIEN (${bd.toFixed(1)}° contre ${bt.toFixed(1)}°) — le modèle est à revoir`);
  console.log(`prix du dosage : ${prix.toFixed(2)} m/s`);
}

// Le réglage de freinage doit changer la façon dont la voiture tourne, et pas seulement sa
// distance d'arrêt : on rejoue le même virage pied levé à trois niveaux de frein.
console.log('\nréglage de frein, pied levé :');
console.log('frein    Δv m/s   dérive max   rotation en plus (°/s)');
const rot = [];
for (const f of [0.6, 1.0, 1.5]) {
  const rows = etats.map((snap) => {
    context.SNAP = snap; context.RYTHME = 0; context.FREIN = f;
    return rejoue.runInContext(context);
  });
  rot.push(moy(rows.map(r => r.rotation)));
  console.log(('×' + f.toFixed(1)).padEnd(9)
    + moy(rows.map(r => r.dv)).toFixed(2).padStart(6)
    + moy(rows.map(r => r.maxBeta)).toFixed(1).padStart(12) + '°'
    + rot[rot.length - 1].toFixed(1).padStart(18));
}
console.log(rot[2] > rot[0]
  ? `\nmonter le frein fait tourner ${(rot[2] - rot[0]).toFixed(1)}°/s de plus : le réglage sert à enrouler`
  : '\nLE RÉGLAGE DE FREIN NE FAIT PAS TOURNER — le transfert de masse ne passe pas');
