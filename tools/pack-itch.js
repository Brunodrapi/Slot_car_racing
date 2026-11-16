#!/usr/bin/env node
// Build the itch edition: local records and a link to the hosted world leaderboard.
'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.resolve(process.argv[2]||path.join(ROOT,'dist-itch'));
const version=/const APP_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT,'js/version.js'),'utf8'))[1];
const game=path.join(OUT,'game'),zip=path.join(OUT,`grip-itch-${version}.zip`);fs.mkdirSync(OUT,{recursive:true});
execFileSync(process.execPath,[path.join(ROOT,'tools/build-dist.js'),'--sortie='+game,'--canal=prod','--distribution=itch'],{cwd:ROOT,stdio:'inherit'});
execFileSync('python3',['-c',`
import sys,zipfile,pathlib
root=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2])
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(root.rglob('*')):
  if p.is_file():z.write(p,p.relative_to(root).as_posix())
with zipfile.ZipFile(out) as z:
 assert 'index.html' in z.namelist() and z.testzip() is None
 assert len(z.infolist())<=1000 and sum(i.file_size for i in z.infolist())<=500*1024*1024
 assert max(i.file_size for i in z.infolist())<=200*1024*1024
 assert max(len(i.filename) for i in z.infolist())<=240
 assert not any(p.startswith(('tools/','docs/','art-src/')) for p in z.namelist())
 print(str(out)+' — '+str(len(z.namelist()))+' fichiers — '+str(round(out.stat().st_size/1024/1024,1))+' Mio')
`,game,zip],{stdio:'inherit'});
