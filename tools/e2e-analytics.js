// Exécuter d'abord tools/analytics-test.js pour produire le rapport PostgreSQL de test.
// node tools/e2e-analytics.js [dossier-captures]
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert/strict');
const root = path.join(__dirname, '..'), fixture = JSON.parse(fs.readFileSync('/tmp/slot-analytics-fixture.json','utf8'));
const out = process.argv[2] || '/tmp/slot-analytics'; fs.mkdirSync(out,{recursive:true});
const mime = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.json':'application/json' };
const server = http.createServer((req,res)=>{
  const f = path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end();}
  res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r)); const base='http://127.0.0.1:'+server.address().port;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1100},locale:'fr-FR'}), errors=[];
    page.on('pageerror',e=>{errors.push(e.message);console.error('Page :',e.message);});
    let status=200, params, publicAuthorization;
    await page.route('**/rest/v1/rpc/analytics_report',route=>{
      params=route.request().postDataJSON();
      publicAuthorization=route.request().headers().authorization;
      return route.fulfill({status,json:status===200?fixture:{message:'test'}});
    });
    await page.goto(base+'/analytics.html'); await page.waitForSelector('#kpis strong');
    assert.equal(await page.locator('#dashboard').isVisible(),true,'le rapport est public sans connexion');
    assert.equal(await page.locator('#login,#logout,#gate,#recent-table').count(),0,'aucune connexion ni activité individuelle');
    assert.equal(await page.evaluate(()=>localStorage.getItem('eol.session')),null,'aucune session créée pour lire les statistiques');
    // Même si le joueur est connecté au jeu, la page publique ne lit ni n'affiche son compte.
    await page.evaluate(()=>{
      localStorage.setItem('eol.session',JSON.stringify({token:'test-only-secret',expire:Date.now()/1000+3600,sub:'owner',nom:'Nom personnel de test'}));
      const original=Storage.prototype.getItem;
      Storage.prototype.getItem=function(key){if(key==='eol.session')throw Error('La page publique ne doit pas lire la session');return original.call(this,key);};
    });
    await page.click('#refresh'); await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
    assert(!publicAuthorization.includes('test-only-secret'));
    await page.reload();
    await page.waitForTimeout(300); assert.deepEqual(errors,[]);
    assert(!(await page.locator('body').innerText()).includes('Nom personnel de test'));
    await page.waitForSelector('#kpis strong');
    assert.equal(await page.locator('#kpis .kpi').count(),8);
    assert.equal(await page.locator('#kpis .kpi').nth(0).locator('strong').innerText(),'2');
    assert.equal(await page.locator('#kpis .kpi').nth(3).locator('strong').innerText(),'4');
    assert.match(await page.locator('#tracks-table').innerText(),/Spa/);
    assert.match(await page.locator('#cars-table').innerText(),/F40/);
    assert.match(await page.locator('#liveries-table').innerText(),/935/);
    assert.equal(await page.locator('canvas').count(),6);
    assert.deepEqual(errors,[]);
    await page.selectOption('#period','custom');
    await page.fill('#from',new Date(Date.now()-2*86400000).toISOString().slice(0,10));
    await page.click('#refresh'); await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
    await page.waitForTimeout(350);
    await page.evaluate(()=>{document.querySelector('.badge').textContent='APERÇU · DONNÉES DE TEST';document.querySelector('#status').textContent='Jeu de données de test · ceci ne représente pas la fréquentation réelle.';});
    await page.screenshot({path:path.join(out,'analytics-bureau-test.png'),fullPage:true});
    await page.selectOption('#track','spa'); await page.selectOption('#car','f40'); await page.click('#refresh');
    await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
    assert.equal(params.p_track,'spa'); assert.equal(params.p_car,'f40');
    const download = page.waitForEvent('download'); await page.click('#csv');
    const file = await download; const content=fs.readFileSync(await file.path(),'utf8');
    assert.match(content,/Type.*Élément/); assert.match(content,/935\|1/);
    assert(!content.includes('Nom personnel de test'));
    status=500; await page.click('#refresh'); await page.waitForSelector('#error:visible');
    assert.match(await page.locator('#error').innerText(),/500/);
    assert.equal(await page.locator('#kpis strong').count(),8,'les données restent présentes après panne');
    status=403; await page.click('#refresh'); await page.waitForSelector('#error:visible');
    assert.match(await page.locator('#error').innerText(),/accès public/);
    assert.equal(await page.locator('#dashboard').isVisible(),true,'une ancienne migration privée ne masque pas la page');
    status=404; await page.click('#refresh'); await page.waitForSelector('#error:visible');
    assert.match(await page.locator('#error').innerText(),/pas encore installée/);
    status=200; await page.reload(); await page.waitForSelector('#kpis strong');
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>{document.querySelector('.badge').textContent='APERÇU · TEST';document.querySelector('#status').textContent='Données de test, pas la fréquentation réelle.';});
    await page.waitForTimeout(250);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'pas de débordement sur téléphone');
    await page.screenshot({path:path.join(out,'analytics-mobile-test.png'),fullPage:true});

    // Collecteur réellement chargé par le jeu : aucune requête attendue par la physique.
    await page.goto(base+'/'); await page.waitForFunction(()=>window.app?.analytics);
    assert.equal(await page.evaluate(()=>app.analytics.enabled),false,'les essais localhost ne polluent pas les mesures');
    const client = await page.evaluate(async()=>{
      const batches=[];
      const ga=new GameAnalytics({enabled:true,fetch:async(url,opts)=>{batches.push(JSON.parse(opts.body).p_events);return {ok:true};}});
      await new Promise(r=>setTimeout(r,0));
      const meta={track:'spa',car:'f40',category:'gt',livery:2,mode:'race',control:'touch'};
      const race={state:'countdown',player:{lap:0,lapTimes:[],lapOk:[],fautes:0,finished:false}};
      ga.begin(race,meta); ga.observe(race,1,true,'touch');
      const before=ga.queue.filter(e=>e.event==='race_start').length;
      race.state='racing';ga.observe(race,1,true,'touch');
      race.player.lap=1;race.player.lapTimes=[81];race.player.lapOk=[true];ga.observe(race,1,true,'touch');
      ga.observe(race,1,true,'touch'); race.player.fautes=2;ga.observe(race,1,true,'touch');
      ga.observe(race,50,false,'touch');race.player.finished=true;ga.observe(race,1,true,'touch');
      ga.finish('completed'); await new Promise(r=>setTimeout(r,0));
      const guest={state:'racing',player:{lap:0,lapTimes:[],lapOk:[],fautes:0,finished:false}};
      ga.begin(guest,{...meta,mode:'multiplayer'});ga.observe(guest,1,true,'gamepad');
      guest.player.lap=2;ga.observe(guest,1,true,'gamepad');ga.finish('abandoned');
      await new Promise(r=>setTimeout(r,0));await ga.flush();
      const rows=batches.flat(), visitor=ga.visitor, session=ga.session.id;
      clearInterval(ga.timer);
      const again=new GameAnalytics({enabled:true,fetch:async()=>({ok:true})});clearInterval(again.timer);
      const identity=again.visitor===visitor&&again.session.id===session;
      const sameVisit=again.queue.length===0;
      localStorage.setItem('eol.analytics.session',JSON.stringify({id:session,last:Date.now()-31*60000}));
      const later=new GameAnalytics({enabled:true,fetch:async()=>({ok:true})});clearInterval(later.timer);
      const newVisit=later.session.id!==session&&later.visitor===visitor;
      await new Promise(r=>setTimeout(r,0));
      const offline=new GameAnalytics({enabled:true,fetch:async()=>{throw Error('offline');}});clearInterval(offline.timer);
      offline._emit('visit');await offline.flush();
      const queued=offline.queue.map(e=>e.id); const stored=JSON.parse(localStorage.getItem('eol.analytics.queue'));
      offline.retryAfter=0;offline.fetch=async()=>({ok:true});await offline.flush();
      return {rows,before,identity,sameVisit,newVisit,retry:queued.length>0&&stored.some(e=>e.id===queued[0])&&!offline.queue.length};
    });
    assert.equal(client.before,0,'annuler le décompte ne compte pas un départ');
    assert.equal(client.rows.filter(e=>e.event==='visit').length,1);
    assert.equal(client.rows.filter(e=>e.event==='race_start').length,2);
    assert.equal(client.rows.filter(e=>e.event==='lap').length,3,'les images répétées ne dupliquent pas les tours, les invités sont comptés');
    assert.equal(client.rows.filter(e=>e.event==='race_end').length,2,'une arrivée produit une seule fin');
    assert.equal(client.rows.find(e=>e.event==='offtrack').value,2);
    assert.equal(client.rows.filter(e=>e.event==='play').reduce((s,e)=>s+e.seconds,0),6,'le temps en pause ne compte pas');
    assert.equal(client.rows.find(e=>e.mode==='multiplayer'&&e.event==='lap').clean,null);
    for(const key of ['identity','sameVisit','newVisit','retry'])assert(client[key],key);
    assert(!JSON.stringify(client.rows).includes('Bruno'),'aucun pseudo dans les événements');

    // Vérification des points d'intégration App : vrai départ, lecture de la course à l'image,
    // pause puis abandon. Aucun appel direct à begin/observe/finish dans ce parcours.
    await page.evaluate(()=>{
      window.integrationRows=[];
      app.analytics=new GameAnalytics({enabled:true,fetch:async(url,opts)=>{
        integrationRows.push(...JSON.parse(opts.body).p_events);return {ok:true};
      }});
      app.save.models.gt='f40';app.save.livrees.f40=2;
      app.startQuick('race','gt','spa');app.race.state='racing';
    });
    await page.waitForFunction(()=>app.analytics.current?.started);
    await page.evaluate(()=>{app.race.player.lap=1;app.race.player.lapTimes=[82];app.race.player.lapOk=[true];});
    await page.waitForFunction(()=>app.analytics.current?.lap===1);
    await page.evaluate(()=>{app.togglePause();app.toMenu();});
    await page.waitForFunction(()=>!app.analytics.queue.length);
    const integrated=await page.evaluate(()=>{clearInterval(app.analytics.timer);return integrationRows;});
    assert.equal(integrated.filter(e=>e.event==='race_start').length,1);
    assert.equal(integrated.find(e=>e.event==='lap').lap_s,82);
    assert.equal(integrated.find(e=>e.event==='race_end').outcome,'abandoned');
    assert.equal(integrated.find(e=>e.event==='race_start').track,'spa');
    assert.equal(integrated.find(e=>e.event==='race_start').car,'f40');
    assert.equal(integrated.find(e=>e.event==='race_start').livery,2);
    const storageRecovery=await page.evaluate(()=>{
      localStorage.setItem('eol.analytics.session','5');localStorage.setItem('eol.analytics.visitor','corrompu');
      const ga=new GameAnalytics({enabled:true,fetch:async()=>({ok:true})});clearInterval(ga.timer);
      return ga._validId(ga.session.id)&&ga._validId(ga.visitor);
    });
    assert(storageRecovery,'un stockage abîmé ne bloque pas le démarrage du jeu');
    await page.evaluate(()=>{app.save.lang='fr';app.ui.settings();});
    assert.match(await page.locator('.stats-link').innerText(),/Statistiques publiques/);
    await page.evaluate(()=>{app.save.lang='en';app.ui.settings();});
    assert.match(await page.locator('.stats-link').innerText(),/Public statistics/);
    await page.click('.stats-link'); await page.waitForSelector('#kpis strong');
    assert.match(page.url(),/analytics\.html$/,'le lien des réglages ouvre bien le rapport public');
    assert.deepEqual(errors,[]);
    console.log('OK : page publique sans compte, aucun détail individuel, six graphiques, filtres, CSV, panne/installation, responsive, vrai collecteur, tours local/invité, pauses et reprise réseau.');
  } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
