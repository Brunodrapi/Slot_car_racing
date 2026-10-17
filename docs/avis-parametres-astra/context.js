'use strict';
const fs=require('fs'),vm=require('vm'),cp=require('child_process');
const {Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const ROOT=require('node:path').resolve(__dirname,'../..');
function context(ref){const c=vm.createContext({Math:Object.create(Math),console});const src=['util','traces','tracks','track','cars','car','race'].map(f=>cp.execFileSync('git',['show',ref+':js/'+f+'.js'],{cwd:ROOT,encoding:'utf8',maxBuffer:8e6}).replace(/if \(typeof module[^\n]*\n/g,'').replace(/'use strict';/g,'')).join('\n').replace('// grass and gravel drag the whole car,','this._drive=throttle?acc:0; this._demand=accDem; // grass and gravel drag the whole car,');vm.runInContext(src+'\nthis.G={MODELS,TRACKS,CATEGORIES};',c);return c;}

module.exports={context};
