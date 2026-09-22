// Two real screens, one table, one race — in a browser, without a network.
//
// The PeerJS directory is a public service we cannot reach from here, and it is not what needs
// testing anyway: what needs testing is the lobby, the grid both screens build, and the race the
// guest sees. So `RoomRTC` is replaced by a stand-in with the same surface that carries presences
// between two tabs over a BroadcastChannel. Everything above it — the menu, the table, the host
// loop, the snapshots — is the game's own code.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-net.js <dossier> [format]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };

// The stand-in, injected before any of the game's scripts run.
// The game's own js/room-rtc.js loads after this and would overwrite the stand-in, so the slot is
// defined with a setter that ignores writes — a plain non-writable property would throw, that file
// being in strict mode.
const STUB = `
const RoomRTCStub = class {
  constructor() { this.mine = {}; this.others = new Map(); this.handlers = []; this.open = false; }
  static available() { return true; }
  claim(code, asHost) {
    this.label = (asHost ? '0-' : '1-') + code + '-' + Math.random().toString(36).slice(2, 8);
    this.ch = new BroadcastChannel('slot-racer-test-' + code);
    this.ch.onmessage = (e) => {
      const d = e.data;
      if (!d || d.from === this.label) return;
      if (d.hello) this.ch.postMessage({ from: this.label, p: this.mine });
      this.others.set(d.from, { presence: d.p || {}, updatedAt: Date.now() });
      this.fire();
    };
    this.open = true;
    this.ch.postMessage({ from: this.label, p: this.mine, hello: true });
    return Promise.resolve(code);
  }
  presence(patch) {
    for (const k in patch) { if (patch[k] === null) delete this.mine[k]; else this.mine[k] = patch[k]; }
    if (this.ch) this.ch.postMessage({ from: this.label, p: this.mine });
    this.fire();
    return Promise.resolve();
  }
  peers() {
    const list = [{ peer: this.label, isMe: true, presence: this.mine, updatedAt: Date.now() }];
    for (const [k, v] of this.others) list.push({ peer: k, isMe: false, presence: v.presence, updatedAt: v.updatedAt });
    return list;
  }
  fire() { for (const h of this.handlers) h({ peers: this.peers() }); }
  onPeers(h) { this.handlers.push(h); setTimeout(() => h({ peers: this.peers() }), 0); return () => {}; }
  onConnection() { return () => {}; }
  connected() { return this.open; }
  close() { if (this.ch) this.ch.close(); this.ch = null; this.open = false; this.others.clear(); }
};
Object.defineProperty(window, 'RoomRTC', { get: () => RoomRTCStub, set: () => {}, configurable: true });
`;

function serve() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

(async () => {
  const out = process.argv[2] || '/tmp';
  const mode = process.argv[3] || 'race';
  fs.mkdirSync(out, { recursive: true });
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 900, height: 620 } });
  await ctx.addInitScript(STUB);
  let bad = 0;
  const open = async (tag, name) => {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => { bad++; console.log(`[${tag}] pageerror`, e.message); });
    p.on('console', (m) => { if (m.type() === 'error') { bad++; console.log(`[${tag}] console`, m.text()); } });
    await p.goto(url);
    await p.waitForTimeout(400);
    // two different names, so the table list says something
    await p.evaluate((n) => { app.save.name = n; storeSave(app.save); }, name);
    await p.waitForTimeout(100);
    return p;
  };
  const A = await open('hôte', 'Bruno'), B = await open('invité', 'Camille');

  // ---- the table
  await A.click('[data-action="multi"]');
  await A.click('[data-action="netCreate"]');
  await A.waitForSelector('.code', { timeout: 15000 });
  const code = (await A.textContent('.code')).trim();
  console.log('table', code);

  await B.click('[data-action="multi"]');
  await B.fill('#inp-code', code);
  await B.click('[data-action="netJoin"]');
  await B.waitForTimeout(800);

  if (mode !== 'race') { await A.click(`[data-action="netMode"][data-id="${mode}"]`); await A.waitForTimeout(300); }
  console.log('format', await A.evaluate(() => app.net.settings().mode));

  await A.click('[data-action="netReady"]');
  await B.click('[data-action="netReady"]');
  await A.waitForTimeout(600);
  const seats = await A.evaluate(() => app.net.members().map(m => m.name + (m.ready ? '✓' : '·')));
  console.log('pilotes', seats.join(' '));

  await A.screenshot({ path: `${out}/net-salon-hote.png` });
  await B.screenshot({ path: `${out}/net-salon-invite.png` });

  // ---- the flag
  await A.click('[data-action="netStart"]');
  await A.waitForTimeout(1200);
  const started = await Promise.all([A, B].map(p => p.evaluate(() => app.state + '/' + (app.race ? app.race.cars.length : 0))));
  console.log('au départ', started.join(' | '));

  // ---- a few seconds with both feet down
  for (const p of [A, B]) await p.keyboard.down('Space');
  await A.waitForTimeout(6000);
  for (const p of [A, B]) await p.keyboard.up('Space');
  await A.waitForTimeout(400);

  const snap = async (p) => p.evaluate(() => ({
    state: app.race.state,
    host: app.net.isHost(),
    seat: app.net.seat,
    cars: app.race.cars.map(c => [+c.x.toFixed(2), +c.y.toFixed(2), +c.v.toFixed(2), c.lap, c.human]),
  }));
  const a = await snap(A), b = await snap(B);
  let worst = 0;
  for (let i = 0; i < Math.min(a.cars.length, b.cars.length); i++) {
    worst = Math.max(worst, Math.hypot(a.cars[i][0] - b.cars[i][0], a.cars[i][1] - b.cars[i][1]));
  }
  const movingA = a.cars.filter(c => c[2] > 5).length, movingB = b.cars.filter(c => c[2] > 5).length;
  console.log(`hôte: ${a.cars.length} voitures, ${movingA} en mouvement, siège ${a.seat}`);
  console.log(`invité: ${b.cars.length} voitures, ${movingB} en mouvement, siège ${b.seat}`);
  console.log('écart maximal entre les deux écrans :', worst.toFixed(2), 'm');

  await A.screenshot({ path: `${out}/net-hote.png` });
  await B.screenshot({ path: `${out}/net-invite.png` });

  const ok = a.cars.length === b.cars.length && a.cars.length > 1 && worst < 4
    && movingA === a.cars.length && movingB === b.cars.length && a.host && !b.host;
  console.log('erreurs', bad);
  console.log(ok && !bad ? 'OK' : 'ÉCHEC');
  await browser.close();
  server.close();
  process.exit(ok && !bad ? 0 : 1);
})();
