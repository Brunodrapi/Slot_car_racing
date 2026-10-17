// Les trois catégories, de bout en bout : le filtre du menu, la grille de l'IA, la reprise d'une
// ancienne sauvegarde, et la table en ligne réservée à une catégorie par l'hôte.
//
//   node tools/e2e-categories.js [dossier-captures]
//
// Le transport en ligne est le double sur BroadcastChannel de `tools/e2e-duo.js` : deux onglets de
// la même origine forment une table, et tout ce qui est au-dessus du transport est le vrai jeu.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || '/tmp';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wav': 'audio/wav',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };

const DOUBLE = `
(() => {
  class RoomBC {
    static available() { return true; }
    constructor() { this.mine = {}; this.others = new Map(); this.label = null; this.h = []; this.ch = null; }
    claim(code, asHost) {
      this.label = (asHost ? '0-' : '1-') + Math.random().toString(36).slice(2, 7);
      this.ch = new BroadcastChannel('eol-' + code);
      this.ch.onmessage = (e) => {
        const m = e.data;
        if (m.from === this.label) return;
        if (m.type === 'bonjour') this.envoi();
        this.others.set(m.from, { presence: m.p, updatedAt: Date.now() });
        this.fire();
      };
      this.ch.postMessage({ type: 'bonjour', from: this.label, p: this.mine });
      setTimeout(() => this.fire(), 0);
      return Promise.resolve();
    }
    envoi() { this.ch.postMessage({ type: 'p', from: this.label, p: this.mine }); }
    presence(patch) {
      for (const k in patch) { if (patch[k] === null) delete this.mine[k]; else this.mine[k] = patch[k]; }
      this.envoi(); this.fire(); return Promise.resolve();
    }
    peers() {
      const l = [{ peer: this.label, isMe: true, presence: this.mine, updatedAt: Date.now() }];
      for (const [k, v] of this.others) l.push({ peer: k, isMe: false, presence: v.presence, updatedAt: v.updatedAt });
      return l;
    }
    fire() { const p = this.peers(); for (const h of this.h) h({ peers: p, joined: p, left: [], updated: [] }); }
    onPeers(h) { this.h.push(h); setTimeout(() => h({ peers: this.peers(), joined: this.peers(), left: [], updated: [] }), 0); return () => {}; }
    close() { if (this.ch) this.ch.close(); this.others.clear(); }
  }
  window.RoomRTC = RoomBC;
})();
`;

(async () => {
  const serveur = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => serveur.listen(0, r));
  const base = `http://127.0.0.1:${serveur.address().port}`;
  const nav = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
  let fautes = 0, erreurs = 0;
  const dit = (ok, txt) => { if (!ok) fautes++; console.log(`  ${ok ? 'ok  ' : 'FAUX'}  ${txt}`); };
  const ouvre = async (ctx, nom, avant) => {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => { erreurs++; console.log(`[${nom}]`, e.message); });
    if (avant) await p.addInitScript(avant);
    await p.goto(base + '/index.html');
    await p.waitForFunction(() => typeof app !== 'undefined' && app.save);
    await p.evaluate((n) => { app.save.name = n; app.save.sound = false; storeSave(app.save); app.mondial = null; }, nom);
    await p.keyboard.press('Enter');
    await p.waitForTimeout(250);
    return p;
  };
  const cartes = (p, rail) => p.evaluate((r) => [...document.querySelectorAll(`[data-rail="${r}"] .card`)].map((c) => c.dataset.id), rail);

  try {
    // ------------------------------------------------------------------ le filtre, en solo
    console.log('le filtre du menu');
    const ctx = await nav.newContext({ viewport: { width: 1100, height: 900 } });
    const p = await ouvre(ctx, 'Solo');
    await p.click('[data-action="setup"][data-mode="race"]');
    await p.waitForSelector('[data-rail="models"] .card');
    const effectifs = await p.evaluate(() => Object.fromEntries(CATEGORIES.map((c) => [c.id, modelsOf(c.id).length])));
    dit(effectifs.f1 === 9 && effectifs.gt === 9 && effectifs.proto === 7, `neuf F1, neuf GT, sept prototypes (${JSON.stringify(effectifs)})`);
    const toutes = await cartes(p, 'models');
    dit(toutes.length === 25, `« Toutes » montre les vingt-cinq voitures (${toutes.length})`);
    for (const cat of ['f1', 'gt', 'proto']) {
      await p.click(`[data-action="pickCat"][data-id="${cat}"]`);
      await p.waitForTimeout(250);
      const ids = await cartes(p, 'models');
      const bonnes = await p.evaluate(([l, c]) => l.every((id) => modelById(id).catId === c), [ids, cat]);
      const choisie = await p.evaluate(() => app.playerModelFor(app.ui.setup.classId));
      dit(ids.length === effectifs[cat] && bonnes, `${cat} : ${ids.length} cartes, toutes de la catégorie`);
      dit(choisie.catId === cat && ids.includes(choisie.id), `${cat} : la voiture choisie est dans le rail (${choisie.id})`);
      if (cat === 'proto') await p.screenshot({ path: path.join(OUT, 'categories-proto.png') });
    }
    // Choisir une voiture d'une autre catégorie depuis « Toutes » fait passer dans sa catégorie.
    await p.click('[data-action="pickCat"][data-id="all"]');
    await p.waitForTimeout(250);
    await p.click('.card[data-action="pickModel"][data-id="xjr9"]');
    await p.waitForTimeout(250);
    const apres = await p.evaluate(() => ({ cls: app.ui.setup.classId, m: app.playerModelFor(app.ui.setup.classId).id, sel: document.querySelector('.card.sel[data-id="xjr9"]') !== null }));
    dit(apres.cls === 'proto' && apres.m === 'xjr9' && apres.sel, `depuis « Toutes », choisir la XJR-9 passe en Proto (${JSON.stringify(apres)})`);
    await p.screenshot({ path: path.join(OUT, 'categories-toutes.png') });
    await p.click('[data-action="startQuick"]');
    await p.waitForFunction(() => app.state === 'race' && app.race, { timeout: 15000 });
    const grille = await p.evaluate(() => ({ joueur: app.race.player.cls.id, cats: app.race.cars.map((c) => c.cls.catId) }));
    dit(grille.joueur === 'xjr9' && grille.cats.length > 1 && grille.cats.every((c) => c === 'proto'), `en course : ${grille.cats.length} voitures, toutes des prototypes`);
    // Et une GT ne voit que des GT.
    const gt = await p.evaluate(() => {
      const r = new Race({ trackDef: TRACKS.find((t) => t.id === 'monza'), classId: 'f1', modelId: '240z', difficulty: 'medium' });
      return r.cars.map((c) => c.cls.catId);
    });
    dit(gt.every((c) => c === 'gt'), 'une 240Z lancée avec une catégorie périmée court quand même contre des GT');
    await ctx.close();

    // ------------------------------------------------------------------ une ancienne sauvegarde
    console.log('\nune sauvegarde d\'avant les catégories');
    const ctx2 = await nav.newContext({ viewport: { width: 1100, height: 900 } });
    const vieille = `(() => { if (localStorage.getItem('test-pose')) return; localStorage.setItem('test-pose', '1');
      localStorage.setItem('slotracer.save.v2', JSON.stringify({ name: 'Ancien', models: { gt: 'tyrrellp34' }, tracesMigrated: true, lapsMigrated: true,
        bestLaps: { 'monza|gt': 80, 'monza|gt|tyrrellp34': 80, 'monza|gt|m1procar': 90, 'spa|gt': 120 },
        bestLapsNets: { 'monza|gt|tyrrellp34': 80, 'monza|gt|m1procar': 90 } })); })()`;
    const p2 = await ouvre(ctx2, 'Ancien', vieille);
    const s = await p2.evaluate(() => ({ models: app.save.models, cat: app.save.cat, b: app.save.bestLaps, n: app.save.bestLapsNets }));
    dit(s.models.f1 === 'tyrrellp34' && !s.models.gt && s.cat === 'f1', `la Tyrrell choisie suit les F1 (${JSON.stringify(s.models)}, cat ${s.cat})`);
    dit(s.b['monza|f1|tyrrellp34'] === 80 && s.b['monza|gt|tyrrellp34'] == null && s.b['monza|gt|m1procar'] === 90, 'son record passe sous f1, celui de la M1 reste sous gt');
    dit(s.b['monza|gt'] === 90 && s.b['monza|f1'] === 80, `les records de catégorie sont recalculés (gt ${s.b['monza|gt']}, f1 ${s.b['monza|f1']})`);
    dit(s.b['spa|gt'] === 120, 'un ancien record sans voiture connue reste où il était');
    dit(s.n['monza|f1|tyrrellp34'] === 80 && s.n['monza|gt|tyrrellp34'] == null, 'le registre des tours nets suit aussi');
    await p2.reload();
    await p2.waitForFunction(() => typeof app !== 'undefined' && app.save);
    const s2 = await p2.evaluate(() => app.save.bestLaps);
    dit(s2['monza|f1|tyrrellp34'] === 80 && s2['monza|gt'] === 90, 'la reprise ne se rejoue pas au chargement suivant');
    await ctx2.close();

    // ------------------------------------------------------------------ la table réservée
    console.log('\nla table en ligne réservée à une catégorie');
    const ctx3 = await nav.newContext({ viewport: { width: 900, height: 900 } });
    const hote = await ouvre(ctx3, 'Hôte'), invite = await ouvre(ctx3, 'Invité');
    for (const q of [hote, invite]) await q.evaluate(DOUBLE);
    const code = await hote.evaluate(async () => {
      app.save.models.gt = 'f40'; app.ui.setup.classId = 'gt';
      app.state = 'lobby';
      await app.ui._netOpen(true);
      app.ui._netReady(true);
      return app.net.code;
    });
    await invite.evaluate(async (c) => {
      app.save.models.f1 = 'lotus72'; app.ui.setup.classId = 'f1';
      app.state = 'lobby';
      document.getElementById('ui').insertAdjacentHTML('beforeend', `<input id="inp-code" value="${c}">`);
      await app.ui._netOpen(false);
      app.ui._netReady(true);
    }, code);
    await hote.waitForTimeout(800);
    const ouverte = await invite.evaluate(() => ({ cartes: document.querySelectorAll('[data-rail="netModels"] .card').length,
      voiture: app.net.mine.car && app.net.mine.car.modelId, verrou: [...document.querySelectorAll('[data-action="netCat"]')].every((b) => b.disabled) }));
    dit(ouverte.cartes === 25 && ouverte.voiture === 'lotus72', `table ouverte : l'invité voit les 25 voitures et garde sa Lotus 72 (${ouverte.voiture})`);
    dit(ouverte.verrou, 'l\'invité ne peut pas changer la catégorie de la table');
    // L'hôte réserve la table aux prototypes.
    await hote.click('[data-action="netCat"][data-id="proto"]');
    await hote.waitForTimeout(800);
    await invite.evaluate(() => app.ui.lobbyScreen());
    await invite.waitForTimeout(300);
    const reservee = await invite.evaluate(() => ({ ids: [...document.querySelectorAll('[data-rail="netModels"] .card')].map((c) => c.dataset.id),
      voiture: app.net.mine.car && app.net.mine.car.modelId, pret: app.net.mine.ready }));
    const tousProtos = await invite.evaluate((l) => l.every((id) => modelById(id).catId === 'proto'), reservee.ids);
    dit(reservee.ids.length === 7 && tousProtos, `l'invité ne voit plus que les ${reservee.ids.length} prototypes`);
    const sa = await invite.evaluate((id) => modelById(id) && modelById(id).catId, reservee.voiture);
    dit(sa === 'proto' && reservee.pret === false, `sa voiture est passée en Proto (${reservee.voiture}) et il repasse « pas prêt »`);
    const hoteVoit = await hote.evaluate(() => ({ voiture: app.net.mine.car.modelId, peut: app.net.canStart() }));
    dit(!hoteVoit.peut, 'le départ attend que l\'invité se redéclare prêt');
    await invite.screenshot({ path: path.join(OUT, 'categories-salon.png') });
    await invite.evaluate(() => app.ui._netReady(true));
    await hote.evaluate(() => { app.ui._netReady(true); app.ui.lobbyScreen(); });
    await hote.waitForTimeout(800);
    dit(await hote.evaluate(() => app.net.canStart()), 'tout le monde prêt en Proto : l\'hôte peut lâcher le drapeau');
    await hote.evaluate(() => app.net.start());
    await hote.waitForFunction(() => app.state === 'race' && app.race, { timeout: 15000 });
    await invite.waitForFunction(() => app.state === 'race' && app.race, { timeout: 15000 });
    const g1 = await hote.evaluate(() => app.race.cars.map((c) => c.cls.id + '/' + c.name));
    const g2 = await invite.evaluate(() => app.race.cars.map((c) => c.cls.id + '/' + c.name));
    const catsG = await hote.evaluate(() => app.race.cars.map((c) => c.cls.catId));
    dit(catsG.every((c) => c === 'proto'), `la grille de l'hôte : ${catsG.length} voitures, toutes des prototypes`);
    dit(JSON.stringify(g1) === JSON.stringify(g2), 'les deux écrans voient la même grille, IA comprise (modèles et noms)');
    if (JSON.stringify(g1) !== JSON.stringify(g2)) console.log('   hôte  ', g1.join(' '), '\n   invité', g2.join(' '));
    await ctx3.close();
  } finally {
    await nav.close();
    serveur.close();
  }
  console.log(`\nfautes ${fautes} | erreurs ${erreurs}`);
  process.exitCode = fautes || erreurs ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
