// Une vraie table à deux écrans, mesurée des deux côtés.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-duo.js [secondes] [--bride=1] [--joueurs=2]
//
// Le transport réel passe par un annuaire public WebRTC, qu'on ne peut ni exiger ni reproduire
// dans un essai. On lui substitue donc un double bâti sur `BroadcastChannel` : deux onglets de la
// même origine s'y parlent, avec la même surface — `claim`, `presence`, `peers`, `onPeers`,
// `close`. Ce qui est éprouvé ici est donc tout le jeu au-dessus du transport : le salon, les
// étiquettes, le gel de la liste au départ, la simulation chez l'hôte et la reprise chez l'invité.
//
// Deux choses se mesurent, et aucune ne se voit sur une capture : **qui est désigné comme « toi »
// sur chaque écran**, et **la régularité du mouvement chez l'invité**, qui ne simule rien et ne
// fait que rejouer ce qu'il reçoit.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wav': 'audio/wav',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };

const DOUBLE = `
(() => {
  // Un double de RoomRTC sur BroadcastChannel : même surface, même sémantique de présence.
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
  const DUR = +(process.argv[2] || 12);
  const NJ = +((process.argv.find((x) => x.startsWith('--joueurs=')) || '--joueurs=2').split('=')[1]);
  const bride = +((process.argv.find((x) => x.startsWith('--bride=')) || '--bride=1').split('=')[1]);
  const serveur = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => serveur.listen(0, r));
  const base = `http://127.0.0.1:${serveur.address().port}`;

  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  let errs = 0;
  const ouvre = async (nom) => {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => { errs++; console.log(`[${nom}]`, e.message); });
    if (bride > 1) { const c = await p.context().newCDPSession(p); await c.send('Emulation.setCPUThrottlingRate', { rate: bride }); }
    await p.goto(`${base}/index.html`);
    await p.waitForTimeout(400);
    // Après le chargement, et non avant : les scripts de la page définissent `RoomRTC` et
    // écraseraient un double posé trop tôt. `Net` ne le lit qu'à l'ouverture de la table.
    await p.evaluate(DOUBLE);
    await p.keyboard.press('Enter');
    await p.waitForTimeout(300);
    return p;
  };
  const hote = await ouvre('hôte');
  const invites = [];
  for (let i = 1; i < NJ; i++) invites.push(await ouvre('invité ' + i));
  const invite = invites[0];
  const tous = [hote, ...invites];

  // --- le salon ---
  // Chacun choisit une voiture différente : c'est la seule façon de voir si elles arrivent
  // distinctes de l'autre côté.
  const CHOIX = ['m1procar', 'f40', 'corvette', 'countach', '917k', '930', 'csl', '787b'];
  const code = await hote.evaluate(async (m) => {
    app.save.name = 'Hôte'; app.save.models = app.save.models || {}; app.save.models.gt = m;
    await app.net.open('Hôte', true, null);
    app.net.setMine({ car: { modelId: m } });
    app.ui._netReady(true); app.ui.lobbyScreen();
    return app.net.code;
  }, CHOIX[0]);
  for (let i = 0; i < invites.length; i++) {
    await invites[i].evaluate(async ({ c, nom, m }) => {
      app.save.name = nom; app.save.models = app.save.models || {}; app.save.models.gt = m;
      await app.net.open(nom, false, c);
      app.net.setMine({ car: { modelId: m } });
      app.ui._netReady(true); app.ui.lobbyScreen();
    }, { c: code, nom: 'Invité ' + (i + 1), m: CHOIX[(i + 1) % CHOIX.length] });
    await hote.waitForTimeout(250);
  }
  await hote.waitForTimeout(900);
  for (const p of tous) await p.evaluate(() => app.ui.lobbyScreen());
  await hote.waitForTimeout(200);

  const vu = async (p) => p.evaluate(() => app.net.members().map((m) => ({ nom: m.name, moi: !!m.isMe })));
  const diag = async (p) => p.evaluate(() => ({ etat: app.net.state, code: app.net.code, erreur: app.net.error,
    mine: app.net.mine, peers: app.net.peers.map((x) => ({ peer: x.peer, isMe: x.isMe, p: x.presence })) }));
  console.log('diagnostic hôte   :', JSON.stringify(await diag(hote)));
  console.log('diagnostic invité :', JSON.stringify(await diag(invite)));
  const cotéHote = await vu(hote), cotéInvite = await vu(invite);
  console.log('la table vue par l’hôte   :', JSON.stringify(cotéHote));
  console.log('la table vue par l’invité :', JSON.stringify(cotéInvite));
  let faute = 0;
  for (const [nom, l] of [['hôte', cotéHote], ['invité', cotéInvite]]) {
    const n = l.filter((x) => x.moi).length;
    if (n !== 1) { faute++; console.log(`  ÉCHEC côté ${nom} : ${n} pilote(s) marqué(s) « toi », il en faut exactement un`); }
    else console.log(`  ok côté ${nom} : « toi » désigne ${l.find((x) => x.moi).nom}`);
  }

  // Ce que les deux écrans affichent vraiment, texte compris : `members()` peut être juste et
  // l'affichage faux, et c'est l'affichage que le joueur lit.
  const cartes = async (p) => p.evaluate(() => [...document.querySelectorAll('.grid.players .card')]
    .map((c) => ({ texte: c.textContent.replace(/\s+/g, ' ').trim(), retenue: c.classList.contains('sel') })));
  console.log('\nce que l’hôte voit   :', JSON.stringify(await cartes(hote)));
  console.log('ce que l’invité voit :', JSON.stringify(await cartes(invite)));
  for (const [nom, l] of [['hôte', await cartes(hote)], ['invité', await cartes(invite)]]) {
    const n = l.filter((x) => /toi|you/.test(x.texte)).length;
    const r = l.filter((x) => x.retenue).length;
    if (n !== 1 || r !== 1) { faute++; console.log(`  ÉCHEC côté ${nom} : ${n} carte(s) disant « toi », ${r} en surbrillance`); }
    else console.log(`  ok côté ${nom} : une seule carte dit « toi » et une seule est en surbrillance`);
    const noms = l.map((x) => x.texte.replace(/(hôte|host|toi|you|·|✓|Prêt|Ready|En attente…|Waiting…)/g, '').trim());
    if (new Set(noms).size !== noms.length) { faute++; console.log(`  ÉCHEC côté ${nom} : deux pilotes portent le même nom — ${JSON.stringify(noms)}`); }
  }

  // --- la course ---
  await hote.evaluate(() => app.net.start());
  await hote.waitForTimeout(1200);
  const enCourse = async (p) => p.evaluate(() => ({
    etat: app.state, hote: app.net.isHost(),
    voitures: app.race ? app.race.cars.length : 0,
    joueurs: app.race ? app.race.cars.filter((c) => c.isPlayer).map((c) => c.name) : [],
    humains: app.race ? app.race.cars.filter((c) => c.human !== null && c.human !== undefined).map((c) => `${c.name}#${c.human}`) : [],
  }));
  const grille = async (p) => p.evaluate(() => (app.race ? app.race.cars
    .filter((c) => c.human !== null && c.human !== undefined)
    .map((c) => ({ place: c.human, nom: c.name, modele: c.cls.id, livree: c.livery && c.livery.body,
                   x: +c.x.toFixed(1), y: +c.y.toFixed(1) })) : []));
  // Un pilote dont le modèle est inconnu de tous : le repli doit donner la MÊME voiture sur
  // chaque écran, sinon chacun voit une grille différente.
  const g0 = await grille(hote);
  const gTous = [];
  for (const p of tous) gTous.push(await grille(p));
  for (let k = 1; k < gTous.length; k++) {
    const a = gTous[0].map((c) => `${c.place}:${c.modele}`).join(' ');
    const b = gTous[k].map((c) => `${c.place}:${c.modele}`).join(' ');
    if (a !== b) { faute++; console.log(`  ÉCHEC : l’écran ${k} voit une autre grille\n    hôte    ${a}\n    écran ${k} ${b}`); }
  }
  if (gTous.every((g, k) => k === 0 || g.map((c) => c.modele).join() === gTous[0].map((c) => c.modele).join()))
    console.log('  ok : tous les écrans voient la même grille');
  console.log('\nla grille humaine vue par l’hôte :');
  for (const c of g0) console.log(`   place ${c.place}  ${String(c.nom).padEnd(10)} ${c.modele.padEnd(10)} ${c.livree}  (${c.x}, ${c.y})`);
  const modeles = new Set(g0.map((c) => c.modele)), livrees = new Set(g0.map((c) => c.livree));
  const places = g0.map((c) => `${c.x},${c.y}`), posUniq = new Set(places);
  if (modeles.size !== g0.length) { faute++; console.log(`  ÉCHEC : ${g0.length} pilotes mais ${modeles.size} modèle(s) — ${[...modeles].join(', ')}`); }
  else console.log('  ok : chaque pilote a bien sa voiture');
  if (livrees.size !== g0.length) { faute++; console.log(`  ÉCHEC : ${g0.length} pilotes mais ${livrees.size} livrée(s)`); }
  else console.log('  ok : chaque pilote a bien sa livrée');
  if (posUniq.size !== g0.length) { faute++; console.log(`  ÉCHEC : des voitures se superposent — ${places.join(' | ')}`); }
  else console.log('  ok : aucune voiture superposée sur la grille');

  console.log('\nen course, hôte   :', JSON.stringify(await enCourse(hote)));
  console.log('en course, invité :', JSON.stringify(await enCourse(invite)));
  for (const [nom, e] of [['hôte', await enCourse(hote)], ['invité', await enCourse(invite)]]) {
    if (e.joueurs.length !== 1) { faute++; console.log(`  ÉCHEC côté ${nom} : ${e.joueurs.length} voiture(s) marquée(s) « joueur » — ${JSON.stringify(e.joueurs)}`); }
    else console.log(`  ok côté ${nom} : la voiture du joueur est ${e.joueurs[0]}`);
  }

  // La régularité du mouvement chez l'invité : il ne simule rien, il rejoue. Une accélération
  // mesurée image par image révèle les à-coups qu'une moyenne d'images par seconde cache.
  const bouge = async (p, sec) => p.evaluate(async (s2) => {
    app.input.throttle = true;
    const xs = [], dt = [], arr = [];
    let vuSeq = -1;
    let last = performance.now();
    await new Promise((f) => { const tick = () => {
      const n = performance.now(); dt.push(n - last); last = n;
      const c = app.race && app.race.player; if (c) xs.push([c.pos.x, c.pos.y]);
      if (!app.net.isHost() && app.net.lastSeq !== vuSeq) { vuSeq = app.net.lastSeq; arr.push(n); }
      if (dt.length < s2 * 60) requestAnimationFrame(tick); else f(); }; requestAnimationFrame(tick); });
    app.input.throttle = false;
    // saut : la variation de la variation de position, en mètres. Un mouvement régulier la garde
    // minuscule ; un recalage brutal la fait bondir.
    const sauts = [];
    for (let i = 2; i < xs.length; i++) {
      const ax = xs[i][0] - 2 * xs[i - 1][0] + xs[i - 2][0];
      const ay = xs[i][1] - 2 * xs[i - 1][1] + xs[i - 2][1];
      sauts.push(Math.hypot(ax, ay));
    }
    const tri = dt.slice(8).sort((a, b) => a - b), ts = sauts.slice().sort((a, b) => a - b);
    const ecarts = []; for (let i = 1; i < arr.length; i++) ecarts.push(arr[i] - arr[i - 1]);
    ecarts.sort((a, b) => a - b);
    return { im: +(1000 / (tri.reduce((a, b) => a + b, 0) / tri.length)).toFixed(1),
             snapHz: ecarts.length ? +(1000 / ecarts[ecarts.length >> 1]).toFixed(1) : null,
             snapPire: ecarts.length ? +ecarts[ecarts.length - 1].toFixed(0) : null,
             sautMedian: +ts[ts.length >> 1].toFixed(3),
             sautP95: +ts[Math.floor(ts.length * 0.95)].toFixed(3),
             sautMax: +ts[ts.length - 1].toFixed(3) };
  }, sec);
  const [mh, mi] = await Promise.all([bouge(hote, DUR), bouge(invite, DUR)]);
  console.log('\n                 im/s   saut médian   saut p95   saut max   instantanés');
  console.log(`  hôte      ${String(mh.im).padStart(8)} ${String(mh.sautMedian).padStart(13)} ${String(mh.sautP95).padStart(10)} ${String(mh.sautMax).padStart(10)}`);
  console.log(`  invité    ${String(mi.im).padStart(8)} ${String(mi.sautMedian).padStart(13)} ${String(mi.sautP95).padStart(10)} ${String(mi.sautMax).padStart(10)}` +
    `   ${mi.snapHz} Hz, pire écart ${mi.snapPire} ms`);
  /* Le seuil : un plancher absolu, relevé par ce que l'hôte fait lui-même.

  Le plancher d'abord, parce que ce qui compte est l'écart en mètres : le défaut corrigé valait
  0,173 m d'une image à l'autre, et sous un dixième de mètre le mouvement se lit comme continu. Un
  rapport à l'hôte seul ne dirait rien — à deux, l'hôte tient 0,003 m et l'invité 0,014, un facteur
  cinq qui n'a pourtant rien de gênant puisque les deux sont minuscules.

  Mais le plancher seul accuse à tort quand la machine sature. À huit écrans ouverts sur le même
  ordinateur, l'hôte monte à 0,59 m alors qu'il ne rejoue rien du tout : c'est le processeur qui
  lâche, pas la liaison. Dans ce cas l'invité n'a pas à faire mieux que l'hôte, et on ne conclut
  que s'il fait nettement pire. */
  const limite = Math.max(0.10, mh.sautP95 * 1.5);
  if (mi.sautP95 > limite) { faute++; console.log(`  ÉCHEC : l’invité saute de ${mi.sautP95} m au 95e centile, la limite est ${limite.toFixed(3)}`); }
  else console.log(`  ok : l’invité à ${mi.sautP95} m au 95e centile, sous la limite de ${limite.toFixed(3)}` +
    (mh.sautP95 > 0.05 ? '  (machine saturée : l’hôte lui-même est à ' + mh.sautP95 + ')' : ''));

  console.log('\nerrors', errs);
  await browser.close();
  serveur.close();
  if (errs || faute) process.exitCode = 1;
})();
