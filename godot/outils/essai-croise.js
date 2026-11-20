// Godot et le jeu web à la même table, pour de vrai : WebRTC, BinaryPack, l'annuaire PeerJS.
//
// Deux pages dans un même Chromium — le jeu web, et la version web de Godot — et un annuaire PeerJS
// local, puisque l'annuaire public n'est pas joignable d'ici. Tout le reste est le vrai code des
// deux jeux : room-rtc.js et la bibliothèque PeerJS d'un côté, salle_rtc.gd et BinaryPack de l'autre.
//
//   npx peerjs --port 9000 --host 127.0.0.1          (dans un autre terminal)
//   NODE_PATH=$(npm root -g) node godot/outils/essai-croise.js <jeu web> <export web Godot> <peerjs.min.js> [sortie] [scénario]
//
// Scénarios : salon (par défaut) — le web ouvre la table, Godot la rejoint, puis l'inverse.
//             course — une course entière, Godot hôte puis web hôte.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const [WEB, GODOT, PEERJS] = process.argv.slice(2, 5).map((p) => p && path.resolve(p));
const SORTIE = path.resolve(process.argv[5] || '/tmp/grip-croise');
const SCENARIO = process.argv[6] || 'salon';
if (!WEB || !GODOT || !PEERJS) { console.error('usage : essai-croise.js <jeu web> <export Godot> <peerjs.min.js> [sortie] [scénario]'); process.exit(2); }
fs.mkdirSync(SORTIE, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.pck': 'application/octet-stream', '.webp': 'image/webp', '.ogg': 'audio/ogg' };
function sert(racine) {
  return new Promise((ok) => {
    const s = http.createServer((q, r) => {
      let u = decodeURIComponent(q.url.split('?')[0]);
      if (u === '/peerjs.min.js') { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return fs.createReadStream(PEERJS).pipe(r); }
      if (u === '/') u = '/index.html';
      const f = path.join(racine, u);
      if (!f.startsWith(racine) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(r);
    });
    s.listen(0, '127.0.0.1', () => ok(s));
  });
}

const attends = async (fn, quoi, ms = 30000) => {
  const fin = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > fin) throw new Error('délai dépassé : ' + quoi);
    await new Promise((r) => setTimeout(r, 200));
  }
};

// Le pilote automatique du jeu web : aiThrottle de car.js, à chaque image, sur la voiture du joueur.
const AUTO_WEB = () => {
  if (window.__auto) return; window.__auto = true;
  const boucle = () => {
    const r = app.race;
    if (r && r.player && app.state === 'race' && !r.opts.spectator) app.input.throttle = aiThrottle(r.player, r.cars, 1 / 60, DIFFICULTY.medium) ? 1 : 0;
    requestAnimationFrame(boucle);
  };
  requestAnimationFrame(boucle);
};

// Une course entière, Godot hôte puis le web hôte : mêmes tours, même classement des deux côtés.
async function course(web, god, note, etatG, ordre, format) {
  for (const hoteGodot of (process.env.HOTES === 'web' ? [false] : process.env.HOTES === 'godot' ? [true] : [true, false])) {
    const quoi = `${format}, ${hoteGodot ? 'Godot' : 'le web'} hôte`;
    await ordre({ op: 'nom', nom: 'Godot', langue: 'fr' });
    await ordre({ op: 'voiture', id: 'porsche991gt3r', livree: 0 });
    let code;
    const reglages = { trackId: 'redbullring', laps: 1, mode: format, timeOfDay: 'day', difficulty: 'medium' };
    if (hoteGodot) {
      await ordre({ op: 'open', host: true, name: 'Godot' });
      code = (await attends(async () => { const e = await etatG(); return e.state === 'lobby' && e.code && e; }, 'Godot ouvre')).code;
      await ordre({ op: 'table', patch: reglages });
      await web.evaluate((c) => app.net.open('Navigateur', false, c), code);
    } else {
      // Le jeu web garde `table.go` de la course précédente quand on quitte la table (leave) : la
      // table suivante partirait dès l'arrivée du second pilote. On repart d'une table neuve.
      await web.evaluate(() => { app.net.table.go = 0; });
      await web.evaluate(() => app.net.open('Navigateur', true));
      code = await web.evaluate(() => app.net.code);
      await web.evaluate((r) => app.net.setTable(r), reglages);
      await ordre({ op: 'open', host: false, code, name: 'Godot' });
      await attends(async () => (await etatG()).state === 'lobby', 'Godot rejoint').catch(async (e) => {
        const g = await etatG(); console.error('état de Godot :', JSON.stringify({ state: g.state, error: g.error, busy: g.busy, code: g.code, ecran: g.script }));
        throw e; });
    }
    await ordre({ op: 'mine', patch: { car: { modelId: 'porsche991gt3r', livree: 0 }, ready: true } });
    await web.evaluate(() => app.net.setMine({ car: { modelId: 'bmwm6gt3', livree: 0 }, ready: true }));
    if (hoteGodot) {
      await attends(async () => { const e = await etatG(); return e.members.length === 2 && e.members.every((m) => m.ready); }, 'tout le monde prêt (Godot)');
      await ordre({ op: 'start' });
    } else {
      await attends(() => web.evaluate(() => app.net.canStart()), 'tout le monde prêt (web)');
      await web.evaluate(() => app.net.start());
    }
    await ordre({ op: 'auto', on: true });
    await web.evaluate(AUTO_WEB);
    await attends(async () => (await etatG()).course && web.evaluate(() => app.state === 'race'), `départ (${quoi})`, 60000);
    note(`${quoi} : les deux écrans sont en course sur ${code}`);
    const t0 = Date.now();
    let vu = false;
    const fini = await attends(async () => {
      const g = await etatG(), w = await web.evaluate(() => ({ etat: app.race?.state, t: app.race?.time,
        voitures: app.race?.cars.map((c) => ({ nom: c.name, s: +c.s.toFixed(1), lap: c.lap, v: +c.v.toFixed(1) })),
        res: app.race?.results?.map((r) => ({ pos: r.pos, nom: r.car.name, temps: r.time })) }));
      if (!vu && w.t > 20 && g.course) {
        vu = true;
        await god.screenshot({ path: path.join(SORTIE, `godot-${format}-${hoteGodot ? 'hote' : 'invite'}.png`) });
        await web.screenshot({ path: path.join(SORTIE, `web-${format}-${hoteGodot ? 'invite' : 'hote'}.png`) });
        const gv = g.course.voitures, wv = w.voitures;
        note(`  à ${w.t.toFixed(1)} s (web) / ${g.course.time.toFixed(1)} s (Godot) : ` + wv.filter((c, i) => gv[i] && (gv[i].human >= 0)).map((c) => {
          const i = wv.indexOf(c); return `${c.nom} s=${c.s} sur le web, s=${gv[i].s} chez Godot`; }).join(' · '));
      }
      const gres = g.course && g.course.results;
      return gres && gres.length && w.res && w.res.length && { g, w };
    }, `arrivée (${quoi})`, 420000);
    const gr = fini.g.course.results.map((r) => `${r.pos}. ${r.nom} ${r.temps >= 0 ? r.temps.toFixed(3) : 'NC'}`).join(' · ');
    const wr = fini.w.res.map((r) => `${r.pos}. ${r.nom} ${r.temps != null ? r.temps.toFixed(3) : 'NC'}`).join(' · ');
    note(`  classement Godot : ${gr}`);
    note(`  classement web   : ${wr}`);
    const memeOrdre = fini.g.course.results.map((r) => r.nom).join() === fini.w.res.map((r) => r.nom).join();
    const ecart = Math.max(...fini.g.course.results.map((r, i) => {
      const w = fini.w.res[i]; return r.temps >= 0 && w && w.temps != null ? Math.abs(r.temps - w.temps) : 0; }));
    note(`  même ordre : ${memeOrdre} ; pire écart de temps : ${ecart.toFixed(4)} s ; ${((Date.now() - t0) / 1000).toFixed(0)} s réelles`);
    if (!memeOrdre) throw new Error('classements différents');
    await ordre({ op: 'auto', on: false });
    await ordre({ op: 'leave' }); await web.evaluate(() => app.toMenu ? app.toMenu() : app.net.leave());
    await ordre({ op: 'ecran', nom: 'accueil' });
    await new Promise((r) => setTimeout(r, 1500));
  }
}

(async () => {
  const sw = await sert(WEB), sg = await sert(GODOT);
  const rtc = { lib: `http://127.0.0.1:${sw.address().port}/peerjs.min.js`,
    peer: { host: '127.0.0.1', port: 9000, path: '/', secure: false, config: { iceServers: [] } } };
  const nav = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] });
  const journal = [];
  const bilan = { scenario: SCENARIO, etapes: [] };
  const note = (m) => { console.log(m); bilan.etapes.push(m); };
  try {
    const web = await (await nav.newContext({ viewport: { width: 1100, height: 700 } })).newPage();
    const god = await (await nav.newContext({ viewport: { width: 1100, height: 700 } })).newPage();
    for (const [p, n] of [[web, 'web'], [god, 'godot']]) {
      p.on('pageerror', (e) => journal.push(`${n} ERREUR ${e.message}`));
      p.on('console', (m) => { if (m.type() === 'error' || /SCRIPT ERROR|ERROR:/.test(m.text())) journal.push(`${n} ${m.text()}`); });
    }
    await web.addInitScript((c) => { window.SLOT_RACER_RTC = c; }, rtc);
    await god.addInitScript((c) => { window.SLOT_RACER_RTC = c; window.GRIP_ESSAI = []; }, rtc);
    await web.goto(`http://127.0.0.1:${sw.address().port}/index.html`);
    await web.waitForFunction(() => typeof app !== 'undefined' && app.save && app.net);
    await web.evaluate(() => { app.save.name = 'Navigateur'; app.save.lang = 'fr'; app.ui.lang = 'fr'; app.mondial = null; app.leaveSplash?.(); });
    await god.goto(`http://127.0.0.1:${sg.address().port}/index.html`);
    await attends(() => god.evaluate(() => !!window.gripEtat), 'Godot démarre', 90000);
    note('les deux pages sont prêtes');
    const etatG = () => god.evaluate(() => window.gripEtat);
    const ordre = (o) => god.evaluate((x) => window.GRIP_ESSAI.push(x), o);

    if (SCENARIO === 'course') { await course(web, god, note, etatG, ordre, 'duel'); await course(web, god, note, etatG, ordre, 'race'); bilan.ok = true; return; }
    // 1. Le web ouvre la table, Godot la rejoint.
    await web.evaluate(() => app.net.open('Navigateur', true));
    const code = await web.evaluate(() => app.net.code);
    note(`le web ouvre la table ${code}`);
    await ordre({ op: 'open', host: false, code, name: 'Godot' });
    const g1 = await attends(async () => { const e = await etatG(); return e.state === 'lobby' && e.members.length === 2 && e; }, 'Godot entre à la table');
    note(`Godot voit : ${g1.members.map((m) => m.name + (m.isMe ? ' (moi)' : '')).join(', ')} ; erreur « ${g1.error} »`);
    await attends(() => web.evaluate(() => app.net.members().length === 2), 'le web voit Godot');
    await ordre({ op: 'mine', patch: { car: { modelId: 'porsche991gt3r', livree: 1 }, ready: true } });
    const vuWeb = await attends(() => web.evaluate(() => { const m = app.net.members().find((x) => !x.isMe); return m && m.ready && m.car && m; }), 'le web voit Godot prêt');
    note(`le web voit : ${vuWeb.name}, prêt, ${vuWeb.car.modelId} livrée ${vuWeb.car.livree}, protocole ${vuWeb.q.protocol}`);
    await web.evaluate(() => app.net.setTable({ trackId: 'spa', timeOfDay: 'night', laps: 2 }));
    const g2 = await attends(async () => { const e = await etatG(); return e.settings.trackId === 'spa' && e; }, 'Godot lit les réglages de l’hôte');
    note(`Godot lit la table : ${g2.settings.trackId}, ${g2.settings.timeOfDay}, ${g2.settings.laps} tours ; ${g2.link}`);
    await attends(async () => /\d+ ms/.test((await etatG()).link), 'l’horloge de Godot se règle sur celle du web', 15000);
    note(`horloge : ${(await etatG()).link} · côté web : ${await web.evaluate(() => app.net.link.label())}`);
    await ordre({ op: 'leave' }); await web.evaluate(() => app.net.leave());
    await new Promise((r) => setTimeout(r, 800));

    // 2. Godot ouvre la table, le web la rejoint.
    await ordre({ op: 'open', host: true, name: 'Godot hôte' });
    const code2 = (await attends(async () => { const e = await etatG(); return e.state === 'lobby' && e.code && e; }, 'Godot ouvre une table')).code;
    note(`Godot ouvre la table ${code2}`);
    const ok = await web.evaluate((c) => app.net.open('Navigateur', false, c), code2);
    note(`le web rejoint : ${ok} « ${await web.evaluate(() => app.net.error)} »`);
    await attends(async () => (await etatG()).members.length === 2, 'Godot voit le web');
    await web.evaluate(() => app.net.setMine({ car: { modelId: 'f40', livree: 0 }, ready: true }));
    const g3 = await attends(async () => { const e = await etatG(); const m = e.members.find((x) => !x.isMe); return m && m.ready && e; }, 'Godot voit le web prêt');
    note(`Godot voit : ${g3.members.map((m) => `${m.name}${m.isMe ? ' (moi)' : ''} ${m.ready ? 'prêt' : ''} ${m.car ? m.car.modelId : ''}`).join(', ')}`);
    await ordre({ op: 'table', patch: { trackId: 'monaco', mode: 'duel' } });
    const t3 = await attends(() => web.evaluate(() => app.net.settings().trackId === 'monaco' && app.net.settings()), 'le web lit les réglages de Godot');
    note(`le web lit la table de Godot : ${t3.trackId}, ${t3.mode} ; ${await web.evaluate(() => app.net.link.label())}`);
    await attends(() => web.evaluate(() => /\d+ ms/.test(app.net.link.label())), 'l’horloge du web se règle sur celle de Godot', 15000);
    note(`horloge : ${await web.evaluate(() => app.net.link.label())} · côté Godot : ${(await etatG()).link}`);
    await god.screenshot({ path: path.join(SORTIE, 'godot.png') });
    bilan.ok = true;
  } catch (e) {
    bilan.ok = false; bilan.erreur = e.message; console.error('ÉCHEC', e.message);
  } finally {
    bilan.journal = journal.slice(0, 40);
    fs.writeFileSync(path.join(SORTIE, 'bilan.json'), JSON.stringify(bilan, null, 2));
    if (journal.length) console.log(journal.slice(0, 20).join('\n'));
    await nav.close(); sw.close(); sg.close();
    process.exitCode = bilan.ok ? 0 : 1;
  }
})();
