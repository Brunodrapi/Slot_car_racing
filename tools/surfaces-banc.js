// node tools/surfaces-banc.js : matières cohérentes et tracé de gameplay inchangé.
'use strict';
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),baseline='40c5d58';
function context(old){
 const c=vm.createContext({console,Math,Date,assert});
 const src=['util','traces','tracks','track'].map(f=>(old
  ?execFileSync('git',['show',baseline+':js/'+f+'.js'],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024})
  :fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'))
  .replace(/if \(typeof module[^\n]*\n/g,'')).join('\n');
 vm.runInContext(src,c);return c;
}
const before=context(true),after=context(false);
const snapshot=`TRACKS.map(d=>{const t=new Track(d,.9);return {id:d.id,
 x:[...t.xs],y:[...t.ys],k:[...t.k],l:[...t.hwL],r:[...t.hwR],kerb:[...t.kerb],
 envelope:null,
 barriers:null,pit:t.pit,boards:t.boards};})`;
assert.equal(JSON.stringify(vm.runInContext(snapshot,after)),JSON.stringify(vm.runInContext(snapshot,before)),
 'La correction a modifié le tracé de gameplay ou ses repères');
vm.runInContext(`
const monaco=new Track(TRACKS.find(d=>d.id==='monaco'));
for(const key of ['L','R'])for(let i=0;i<monaco.n;i++){
 assert.equal(monaco.bacW[key][i],0,'gravier à Monaco');
 const side=key==='L'?1:-1,hw=side>0?monaco.hwLeftAt(i):monaco.hwRightAt(i),w=monaco.asphaltW[key][i];
 if(w>.5)assert.equal(monaco.runoffSurfaceAt(i,side*(hw+w/2)),'asphalt');
}
for(const id of ['monza','interlagos','redbullring']){
 const d=TRACKS.find(d=>d.id===id),t=new Track(d);
 for(const z of d.runoffs.filter(z=>z.keepOuterGravel)){
  const s=(z.from+z.to)/2*t.length,key=z.side>0?'L':'R';
  const hw=z.side>0?t.hwLeftAt(s):t.hwRightAt(s),a=t._lerp(t.asphaltW[key],s),g=t._lerp(t.bacW[key],s);
  assert.ok(a>1&&g>a,id+' : couches absentes à '+z.name);
  assert.equal(t.runoffSurfaceAt(s,z.side*(hw+a/2)),'asphalt');
  assert.equal(t.runoffSurfaceAt(s,z.side*(hw+(a+g)/2)),'gravel');
  assert.equal(t.runoffSurfaceAt(s,z.side*(hw+g+1)),'grass');
 }
}
for(const d of TRACKS){const t=new Track(d);
 for(const key of ['L','R'])for(let i=0;i<t.n;i++){
  const a=t.asphaltW?.[key][i]||0,g=t.bacW?.[key][i]||0;
  assert.ok(Number.isFinite(a)&&Number.isFinite(g)&&a>=0&&g>=0,d.id+' : largeur invalide');
 }
}
`,after);
console.log('13 circuits : tracé, largeurs et repères identiques ; surfaces vérifiées séparément des protections corrigées ; Monaco sans gravier ; tabliers bitumés puis gravier vérifiés.');
