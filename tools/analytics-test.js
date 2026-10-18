// Test de la VRAIE migration SQL sur PostgreSQL embarqué, pas une réécriture de ses agrégations.
// npm install --prefix /tmp/slot-analytics-test --cache /tmp/slot-npm-cache @electric-sql/pglite
// NODE_PATH=/tmp/slot-analytics-test/node_modules node tools/analytics-test.js
const { PGlite } = require('@electric-sql/pglite');
const { randomUUID } = require('crypto'), assert = require('assert/strict'), fs = require('fs'), path = require('path');

(async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/analytics.sql'), 'utf8');
  await db.exec(sql); await db.exec(sql);
  const today = new Date().toISOString().slice(0,10), ago = n => new Date(Date.now()-n*86400000).toISOString().slice(0,10);
  const ingest = async rows => (await db.query('select public.analytics_ingest($1::jsonb) n', [JSON.stringify(rows)])).rows[0].n;
  const report = async (track = null, car = null) => (await db.query('select public.analytics_report($1,$2,$3,$4) r', [ago(2),today,track,car])).rows[0].r;
  await db.exec('set role anon');
  assert.deepEqual((await report()).current, {});
  await db.exec('reset role');
  const v1 = randomUUID(), v2 = randomUUID(), s1 = randomUUID(), s2 = randomUUID(), s3 = randomUUID(), s4 = randomUUID();
  const r1 = randomUUID(), r2 = randomUUID(), r3 = randomUUID(), now = new Date().toISOString();
  const row = (event, data = {}) => ({ id: randomUUID(), at: now, visitor:v1,session:s1,event,
    device:'mobile',version:'0.33.0',...data });
  const a = { race:r1,track:'spa',car:'f40',category:'gt',mode:'race',control:'touch',livery:0 };
  const b = { race:r2,session:s2,track:'monza',car:'935',category:'proto',mode:'race',control:'gamepad',livery:1,device:'desktop' };
  const before = { at:ago(4)+'T12:00:00Z',session:s4,race:r3,track:'spa',car:'f40',category:'gt',mode:'race',control:'touch',livery:0 };
  const rows = [row('visit'),row('race_start',a),row('lap',{...a,lap:1,lap_s:80,clean:true}),
    row('lap',{...a,lap:2,lap_s:90,clean:false}),row('play',{...a,seconds:60}),row('offtrack',{...a,value:2}),
    row('race_end',{...a,outcome:'completed'}),row('visit',{session:s2,device:'desktop'}),row('race_start',b),
    row('lap',{...b,lap:1,lap_s:100,clean:true}),row('play',{...b,seconds:30}),row('race_end',{...b,outcome:'abandoned'}),
    row('visit',{visitor:v2,session:s3}),row('visit',before),row('race_start',before),row('lap',{...before,lap:1,lap_s:85,clean:true})];
  assert.equal(await ingest(rows),16); assert.equal(await ingest(rows),0);
  assert.equal(await ingest([row('visit'), row('lap',{...a,lap:1,lap_s:81})]),0,'déduplication métier au-delà des identifiants de transport');
  const result = await report();
  assert.deepEqual(result.current,{visitors:2,sessions:3,starts:2,laps:3,seconds:90,completed:1,abandoned:1,tt_ended:0,offtracks:2,clean_laps:2,known_laps:3});
  assert.equal(result.previous.laps,1); assert.deepEqual(result.audience,{new:1,returning:1});
  assert.equal(result.rankings.tracks.find(t=>t.key==='spa').laps,2);
  assert.equal(result.rankings.cars.find(t=>t.key==='f40').starts,1);
  assert.equal(result.rankings.liveries.find(t=>t.key==='935|1').starts,1);
  assert.equal(result.hours.reduce((sum,h)=>sum+h.starts,0),2);
  const filtered = await report('spa','f40'); assert.equal(filtered.current.laps,2); assert.equal(filtered.current.visitors,1);
  assert.equal(filtered.current.sessions,1); assert.equal(filtered.previous.laps,1);
  const unknownLap = row('lap',{...b,lap:2,lap_s:null,clean:null});
  assert.equal(await ingest([unknownLap]),1); const after = await report();
  assert.equal(after.current.laps,4); assert.equal(after.current.known_laps,3,'un tour invité inconnu ne dégrade pas le taux de propreté');
  const serialized = JSON.stringify(after);
  for(const secret of [v1,v2,s1,s2,s3,s4,r1,r2,r3]) assert(!serialized.includes(secret),'aucun identifiant individuel dans le rapport public');
  const forbidden = new Set(['recent','first_event','last_event','best_lap','lap_s','lap','id','visitor','session','race','pilote','email','ip','at']);
  const checkKeys = object => {
    if(!object || typeof object!=='object') return;
    for(const [key,value] of Object.entries(object)){assert(!forbidden.has(key),'champ individuel exposé : '+key);checkKeys(value);}
  };
  checkKeys(after);
  assert.match(after.first_day,/^\d{4}-\d{2}-\d{2}$/);
  assert.match(after.last_day,/^\d{4}-\d{2}-\d{2}$/);
  const invalid = [row('lap',{...a,lap:0}),row('lap',{...a,lap:4,lap_s:-1}),row('play',{...a,seconds:1e9}),
    row('visit',{at:'not-a-date'}),row('visit',{at:ago(8)}),row('visit',{visitor:'bad-uuid'}),
    row('race_start',{...a,mode:null}),row('race_start',{...a,device:'bad'}),row('lap',{...a,lap:5,lap_s:'NaN'}),
    row('race_end',{...a,outcome:null}),row('visit',{at:'infinity'})];
  assert.equal(await ingest(invalid),0,'événements malformés, hors bornes et périmés refusés');
  await assert.rejects(ingest(Array(26).fill(row('visit'))), /Invalid analytics batch/);
  await assert.rejects(db.query('select public.analytics_report($1,$2)',[ago(400),today]),/366 days/);
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from public.analytics_events'),/permission denied/);
  assert.equal((await report()).current.laps,4,'le rapport fonctionne pour un visiteur anonyme');
  await assert.rejects(db.query('insert into public.analytics_events(id) values ($1)',[randomUUID()]),/permission denied/);
  await assert.rejects(db.query('delete from public.analytics_events'),/permission denied/);
  await db.exec('reset role'); await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[randomUUID()]);
  assert.equal((await report()).current.laps,4,'un compte connecté voit les mêmes agrégats publics');
  await assert.rejects(db.query('select * from public.analytics_events'),/permission denied/);
  await db.exec('reset role');
  // Mise à jour d'une installation privée : la migration ouvre le rapport sans perdre ses tours.
  await db.exec(`create or replace function public.analytics_report(p_from date,p_to date,
    p_track text default null,p_car text default null) returns jsonb language plpgsql as $$
    begin raise exception 'old private report'; end $$;
    revoke all on function public.analytics_report(date,date,text,text) from anon;`);
  await db.exec(sql);
  await db.exec('set role anon');
  assert.equal((await report()).current.laps,4,'la migration remplace aussi l’ancienne restriction privée');
  await assert.rejects(db.query('select * from public.analytics_events'),/permission denied/);
  await db.exec('reset role');
  // Le quota ne laisse pas un navigateur remplir la base avec une boucle d'événements.
  const spam = randomUUID(); let accepted=0;
  for(let i=0;i<6;i++) accepted+=await ingest(Array.from({length:25},()=>row('visit',{visitor:spam,session:randomUUID()})));
  assert.equal(accepted,120);
  fs.writeFileSync('/tmp/slot-analytics-fixture.json',JSON.stringify(after,null,2));
  await db.close(); console.log('OK : migration rejouable, agrégats publics sans identité, accès anonyme/connecté, événements bruts protégés, filtres, périodes, déduplication, quota et données invalides.');
})().catch(e=>{console.error(e.message, e.where || '', e.position || '');process.exitCode=1;});
