// Une vraie table à deux écrans, mesurée des deux côtés.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-duo.js [secondes] [--bride=1] [--joueurs=2] [--perte]
//
// `--perte` reproduit le défaut qui rendait le multijoueur inutilisable à plus de deux : un écran
// qui, au moment du coup d'envoi, ne voit pas encore l'un des pilotes. Tant que chaque écran
// composait sa propre liste, il en résultait un décalage de toutes les places, donc un instantané
// appliqué aux mauvaises voitures — et un seul pilote qui appuie faisait bouger tout l'écran.
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
  const PERTE = process.argv.includes('--perte');
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
  /* Un joueur nommé. Le menu ne s'ouvre plus sans nom, et un essai doit faire ce que fait un
  joueur. On attend que `app` existe : `goto` rend la main au chargement, pas à l'initialisation. */
  await p.waitForFunction(() => typeof app !== 'undefined' && app.save);
  await p.evaluate(() => {
    app.save.name = 'Testeur'; storeSave(app.save);
    /* Et pas de tableau mondial : ces essais mesurent des menus, pas un service distant. Le
    laisser branché ferait partir une requête réseau à chaque ouverture de l'écran des records —
    une source d'échecs qui n'a rien à voir avec ce qu'on vérifie, et qui rendrait la suite
    dépendante d'un serveur. `tools/e2e-mondial.js` s'en charge, avec un faux serveur à lui. */
    app.mondial = null;
  });
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
  const CHOIX = ['m1procar', 'f40', 'corvette', 'countach', '935', '930', 'csl', '787b'];
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
  if (PERTE && invites.length >= 2) {
    // Le dernier invité perd de vue l'un des autres, le temps du départ.
    await invites[invites.length - 1].evaluate(() => {
      const vrai = app.net.members.bind(app.net);
      app.net.members = () => {
        const l = vrai();
        if (app.net.state !== 'lobby') return l;
        const i = l.findIndex((x) => !x.isMe && l.indexOf(x) > 0);
        return i >= 0 ? l.filter((_, k) => k !== i) : l;
      };
      window.__perte = vrai;
    });
    console.log('\n(un invité ne voit pas l’un des pilotes au moment du départ)');
  }
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
  if (PERTE) for (const p of invites) await p.evaluate(() => { if (window.__perte) app.net.members = window.__perte; });
  const g0 = await grille(hote);
  const gTous = [];
  for (const p of tous) gTous.push(await grille(p));
  for (let k = 1; k < gTous.length; k++) {
    const a = gTous[0].map((c) => `${c.place}:${c.nom}:${c.modele}`).join(' ');
    const b = gTous[k].map((c) => `${c.place}:${c.nom}:${c.modele}`).join(' ');
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

  /* À qui profite un appui ?

  Le symptôme rapporté — « quand un autre joueur appuie, toutes les voitures bougent sauf celle de
  l'hôte » — décrit une commande mal aiguillée. On la vérifie directement : un seul pilote appuie,
  et on relève ce que **chaque écran** voit bouger. Une commande qui déborde sur d'autres voitures,
  ou deux écrans qui ne racontent pas la même chose, se voient aussitôt.

  La mesure est en mètres parcourus et non en vitesse : une voiture peut avoir de la vitesse sans
  que le pilote y soit pour quoi que ce soit, mais la distance parcourue pendant la seconde et
  demie où un seul appuie ne ment pas. */
  const positions = async (p) => p.evaluate(() => app.race.cars.map((c) => ({
    nom: c.name, place: c.human == null ? null : c.human, x: c.x, y: c.y })));
  // Tout le monde à l'arrêt. Sans cela, une voiture qui finit de ralentir après l'essai précédent
  // parcourt encore quelques mètres, et on accuserait la commande d'un autre pilote d'un simple
  // reste d'élan — relâcher, dans ce jeu, veut dire freiner.
  const arret = async () => {
    await hote.evaluate(async () => {
      for (let i = 0; i < 100; i++) {
        const v = Math.max(...app.race.cars.filter((c) => c.human != null).map((c) => Math.abs(c.v)));
        if (v < 0.4) break;
        await new Promise((r) => setTimeout(r, 100));
      }
    });
    await hote.waitForTimeout(400);      // le temps que le dernier instantané arrive partout
  };
  const parcouru = async (qui, nom) => {
    /* Les positions ne sont relevées que voitures arrêtées, avant et après.

    Les écrans sont interrogés l'un après l'autre, et sous huit onglets chaque aller-retour coûte
    ses dizaines de millisecondes : relever pendant que ça roule, c'est comparer des instants
    différents. À douze mètres par seconde, un demi-tour de boucle sur huit écrans suffisait à
    afficher quatre mètres d'« écart avec l'hôte » là où les écrans étaient parfaitement d'accord.
    À l'arrêt, il n'y a plus d'instant à choisir. La distance compte alors le ralentissement en
    plus de l'accélération, ce qui ne change rien à la question posée : qui a avancé ? */
    await arret();
    const avant = [];
    for (const p of tous) avant.push(await positions(p));
    await qui.evaluate(() => { app.input.throttle = true; });
    await qui.waitForTimeout(1500);
    await qui.evaluate(() => { app.input.throttle = false; });
    await arret();
    const apres = [];
    for (const p of tous) apres.push(await positions(p));
    const d = apres.map((g, k) => g.map((c, i) => Math.hypot(c.x - avant[k][i].x, c.y - avant[k][i].y)));
    const humains = apres[0].map((c, i) => ({ i, nom: c.nom, place: c.place })).filter((c) => c.place !== null);
    console.log(`\n  seul ${nom} appuie — mètres parcourus par pilote humain :`);
    for (const h of humains) {
      console.log(`    place ${h.place}  ${h.nom.padEnd(11)} ` + d.map((g) => g[h.i].toFixed(1).padStart(7)).join(''));
    }
    const bouge = humains.filter((h) => d[0][h.i] > 1.0);   // départ arrêté : un mètre suffit à trancher
    if (bouge.length !== 1 || bouge[0].nom !== nom) {
      faute++; console.log(`    ÉCHEC : ${bouge.length} voiture(s) humaine(s) ont avancé — ${bouge.map((b) => b.nom).join(', ') || 'aucune'}`);
    } else console.log('    ok : seule sa voiture a avancé');
    // et tous les écrans doivent raconter la même chose
    for (let k = 1; k < d.length; k++) {
      const ecart = Math.max(...humains.map((h) => Math.abs(d[k][h.i] - d[0][h.i])));
      if (ecart > 1.5) { faute++; console.log(`    ÉCHEC : l’écran ${k} voit jusqu’à ${ecart.toFixed(1)} m d’écart avec l’hôte`); }
    }
  };
  // Le décompte d'abord : pendant, la course ne simule rien et tout le monde reste à zéro.
  await hote.evaluate(async () => { for (let i = 0; i < 200 && app.race.state !== 'racing'; i++) await new Promise((r) => setTimeout(r, 100)); });
  await hote.waitForTimeout(300);
  await parcouru(hote, 'Hôte');
  await parcouru(invite, 'Invité 1');

  // La régularité du mouvement chez l'invité : il ne simule rien, il rejoue. Une accélération
  // mesurée image par image révèle les à-coups qu'une moyenne d'images par seconde cache.
  const bouge = async (p, sec) => p.evaluate(async (s2) => {
    const xs = [], dt = [], vs = [], es = [], arr = [];
    let vuSeq = -1;
    let last = null;
    // La durée d'image est prise sur l'horloge de l'image, celle que rAF passe au jeu et dont il
    // se sert pour avancer les voitures. `performance.now()` lu dans la fonction y ajoute le
    // retard d'ordonnancement, qui ne bouge aucune voiture : mesurée là, l'irrégularité paraîtrait
    // dix fois pire qu'elle n'est.
    await new Promise((f) => { const tick = (ts) => {
      if (last !== null) dt.push(ts - last);
      last = ts;
      const c = app.race && app.race.player;
      if (c) { xs.push([c.pos.x, c.pos.y]); vs.push(Math.hypot(c.v, c.vl)); es.push(Math.hypot(c.ex || 0, c.ey || 0)); }
      if (!app.net.isHost() && app.net.lastSeq !== vuSeq) { vuSeq = app.net.lastSeq; arr.push(performance.now()); }
      if (dt.length < s2 * 60) requestAnimationFrame(tick); else f(); }; requestAnimationFrame(tick); });
    /* saut : la variation de la variation de position, en mètres. Un mouvement régulier la garde
    minuscule ; un recalage brutal la fait bondir.

    Mais une image qui arrive en retard fait bondir la même mesure sans qu'il y ait quoi que ce
    soit à reprocher au jeu : la voiture avance à sa vitesse, et si l'image dure quatre
    millisecondes de plus, elle avance d'autant. On relève donc en même temps ce que la seule
    irrégularité des images explique — vitesse × écart de durée — pour ne pas mettre sur le dos de
    la liaison ce qui revient au processeur. */
    const sauts = [], plancher = [];
    for (let i = 2; i < xs.length; i++) {
      const ax = xs[i][0] - 2 * xs[i - 1][0] + xs[i - 2][0];
      const ay = xs[i][1] - 2 * xs[i - 1][1] + xs[i - 2][1];
      sauts.push(Math.hypot(ax, ay));
      plancher.push(vs[i] * Math.abs(dt[i - 1] - dt[i - 2]) / 1000);
    }
    const tri = dt.slice(8).sort((a, b) => a - b), ts = sauts.slice().sort((a, b) => a - b);
    const tp = plancher.slice().sort((a, b) => a - b);
    // Le décalage d'affichage lui-même : ce que la voiture montrée s'écarte de la position reçue.
    // Lisser plus longtemps rend le mouvement plus doux mais laisse ce décalage s'écarter
    // davantage ; il n'a pas de moyenne — l'avance d'une image tombe tantôt trop loin, tantôt trop
    // court — mais on veut voir les deux côtés du marché plutôt que les deviner.
    const te = es.slice().sort((a, b) => a - b);
    const ecarts = []; for (let i = 1; i < arr.length; i++) ecarts.push(arr[i] - arr[i - 1]);
    ecarts.sort((a, b) => a - b);
    return { im: +(1000 / (tri.reduce((a, b) => a + b, 0) / tri.length)).toFixed(1),
             snapHz: ecarts.length ? +(1000 / ecarts[ecarts.length >> 1]).toFixed(1) : null,
             snapPire: ecarts.length ? +ecarts[ecarts.length - 1].toFixed(0) : null,
             vmax: +Math.max(...vs).toFixed(1),
             ecartP95: +te[Math.floor(te.length * 0.95)].toFixed(3),
             ecartMax: +te[te.length - 1].toFixed(3),
             imageP95: +tp[Math.floor(tp.length * 0.95)].toFixed(3),
             sautMedian: +ts[ts.length >> 1].toFixed(3),
             sautP95: +ts[Math.floor(ts.length * 0.95)].toFixed(3),
             sautMax: +ts[ts.length - 1].toFixed(3),
             dbg: { etat: app.race.state, silence: +app.net.silence().toFixed(2), thr: app.input.throttle,
                    lastI: app.net.lastI, n: app.net.outN, place: app.net.seat,
                    monThr: app.race.player.throttle, tour: app.race.player.lap } };
  }, sec);
  /* Tout le monde roule pendant la mesure, pas seulement les deux écrans qu'on relève.

  Les essais d'appui laissent chaque voiture là où elle s'est arrêtée, et l'invité finit le nez
  contre la voiture immobile de la place précédente. Huit secondes de plein gaz contre un
  pare-chocs, et la mesure dit « aucun à-coup » — pour la meilleure des mauvaises raisons : rien
  n'avançait. La garde sur la vitesse maximale l'a attrapé ; le remède est de libérer la piste. */
  await Promise.all(tous.map((p) => p.evaluate(() => { app.input.throttle = true; })));
  await hote.waitForTimeout(1500);
  const [mh, mi] = await Promise.all([bouge(hote, DUR), bouge(invite, DUR)]);
  await Promise.all(tous.map((p) => p.evaluate(() => { app.input.throttle = false; })));
  console.log('\n                 im/s   v max   saut médian   saut p95   saut max   dû aux images   décalage p95/max   instantanés');
  console.log(`  hôte      ${String(mh.im).padStart(8)} ${String(mh.vmax).padStart(7)} ${String(mh.sautMedian).padStart(13)} ${String(mh.sautP95).padStart(10)} ${String(mh.sautMax).padStart(10)} ${String(mh.imageP95).padStart(15)}`);
  console.log(`  invité    ${String(mi.im).padStart(8)} ${String(mi.vmax).padStart(7)} ${String(mi.sautMedian).padStart(13)} ${String(mi.sautP95).padStart(10)} ${String(mi.sautMax).padStart(10)} ${String(mi.imageP95).padStart(15)}` +
    `   ${(mi.ecartP95 + ' / ' + mi.ecartMax).padStart(17)}   ${mi.snapHz} Hz, pire écart ${mi.snapPire} ms`);
  /* Une voiture immobile ne saute pas : sans cette vérification, un invité dont la commande
  n'arrive pas chez l'hôte passerait l'essai haut la main. C'est arrivé. */
  for (const [nom, m] of [['hôte', mh], ['invité', mi]])
    if (m.vmax < 10) { faute++; console.log(`  ÉCHEC : la voiture de l’${nom} n’a pas roulé (${m.vmax} m/s) — la mesure ne vaut rien\n    ${JSON.stringify(m.dbg)}`); }
  /* Le seuil : un plancher absolu, relevé par ce que l'hôte fait lui-même.

  Le plancher d'abord, parce que ce qui compte est l'écart en mètres : le défaut corrigé valait
  0,173 m d'une image à l'autre, et sous un dixième de mètre le mouvement se lit comme continu. Un
  rapport à l'hôte seul ne dirait rien — à deux, l'hôte tient 0,003 m et l'invité 0,014, un facteur
  cinq qui n'a pourtant rien de gênant puisque les deux sont minuscules.

  Mais le plancher seul accuse à tort quand la machine sature. À huit écrans ouverts sur le même
  ordinateur, l'hôte monte à 0,59 m alors qu'il ne rejoue rien du tout : c'est le processeur qui
  lâche, pas la liaison. Dans ce cas l'invité n'a pas à faire mieux que l'hôte, et on ne conclut
  que s'il fait nettement pire. */
  const limite = Math.max(0.10, mh.sautP95 * 1.5, mi.imageP95 * 1.5);
  const pourquoi = mi.imageP95 * 1.5 > Math.max(0.10, mh.sautP95 * 1.5)
    ? `  (machine saturée : les images seules de l’invité en expliquent ${mi.imageP95})`
    : (mh.sautP95 > 0.05 ? '  (machine saturée : l’hôte lui-même est à ' + mh.sautP95 + ')' : '');
  if (mi.sautP95 > limite) { faute++; console.log(`  ÉCHEC : l’invité saute de ${mi.sautP95} m au 95e centile, la limite est ${limite.toFixed(3)}${pourquoi}`); }
  else console.log(`  ok : l’invité à ${mi.sautP95} m au 95e centile, sous la limite de ${limite.toFixed(3)}${pourquoi}`);

  console.log('\nerrors', errs);
  await browser.close();
  serveur.close();
  if (errs || faute) process.exitCode = 1;
})();
