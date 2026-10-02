// Ce qu'une course télécharge, et combien de temps elle fait attendre.
//
//   NODE_PATH=$(npm root -g) node tools/reseau.js [--racine=.] [--debit=4] [--rtt=60]
//
// Deux questions qu'on confond toujours, et qui n'ont pas la même réponse : « est-ce que ça rame ? »
// et « est-ce que ça met longtemps à démarrer ? ». Les images par seconde se mesurent avec
// `tools/perf.js` ; ici on mesure l'autre moitié — les octets qui descendent avant le feu vert, et
// le temps que la barrière de chargement retient le joueur.
//
// LE DÉBIT EST BRIDÉ, et c'est tout l'intérêt. Sur une machine de bureau servie en local, tout
// arrive en quelques millisecondes et un mégaoctet de trop ne se voit pas. C'est sur un téléphone en
// 4G faible que la différence se joue, et c'est le cas qu'il faut reproduire.
//
// `--racine` permet de mesurer UN AUTRE CHECKOUT que celui où l'on est — une version d'avant, dans
// un `git worktree` — et donc de comparer deux états du jeu avec exactement le même banc. Comparer
// deux mesures prises par deux bancs différents ne vaut rien.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const arg = (n, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.split('=')[1] : d;
};
const RACINE = path.resolve(arg('racine', path.join(__dirname, '..')));
const DEBIT = +arg('debit', 4);      // Mbit/s en descente
const RTT = +arg('rtt', 60);         // aller-retour, en millisecondes

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.png': 'image/png', '.webp': 'image/webp' };

// À quoi sert chaque fichier. L'ordre compte : le premier motif qui accroche gagne.
const FAMILLES = [
  [/^\/sprites\/env\//, 'décor en trois quarts'],
  [/^\/sprites\/(930|m1procar|f40lm)/, 'planches de rotation'],
  [/^\/sprites\/top\//, 'voitures, vue de dessus'],
  [/^\/sprites\/pick\//, 'voitures, vignettes du menu'],
  [/^\/sounds\//, 'son'],
  [/^\/art\//, 'affiche et décor fixe'],
  [/\.(js|css|html)$/, 'code et feuilles de style'],
];
const famille = (u) => (FAMILLES.find(([re]) => re.test(u)) || [null, 'autre'])[1];

(async () => {
  const octets = new Map();
  let nRequetes = 0;
  const tailleVue = () => nRequetes;
  const serveur = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const f = path.join(RACINE, url);
    if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    const n = fs.statSync(f).size;
    const k = famille(url);
    octets.set(k, (octets.get(k) || 0) + n);
    nRequetes++;
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => serveur.listen(0, r));
  const base = `http://127.0.0.1:${serveur.address().port}`;

  const nav = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await nav.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  let errs = 0;
  page.on('pageerror', (e) => { if (errs++ < 3) console.log('[pageerror]', e.message); });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: RTT,
    downloadThroughput: DEBIT * 1024 * 1024 / 8, uploadThroughput: DEBIT * 1024 * 1024 / 8,
  });

  await page.goto(`${base}/index.html`);
  await page.waitForFunction(() => typeof app !== 'undefined' && app.save);
  await page.evaluate(() => { app.save.name = 'Banc'; app.save.sound = true; storeSave(app.save); app.mondial = null; });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);

  /* UNE MANCHE DE CHAMPIONNAT, et pas une course rapide.

  La grille d'une course rapide est tirée au hasard : dix voitures piochées parmi neuf modèles, donc
  pas les mêmes dessins d'une mesure à l'autre. Les deux premières comparaisons ont ainsi donné un
  mégaoctet d'écart qui ne venait que du tirage. Une manche de championnat prend sa graine du
  championnat : même grille, même circuit, même tout, des deux côtés. */
  const t = await page.evaluate(async () => {
    const t0 = performance.now();
    app.startCupRace('gt');
    let attendu = 0;
    for (let i = 0; i < 2000 && (!app.race || app.race.state !== 'racing'); i++) {
      if (app.race && app.race.attente) attendu++;
      await new Promise((r) => setTimeout(r, 25));
    }
    return { total: performance.now() - t0, barriere: attendu * 25 };
  });

  /* On attend que le RÉSEAU SE TAISE avant de compter.

  Fermer le navigateur au feu vert comptait les octets arrivés jusque-là, pas ceux qu'il faut : une
  version qui démarre plus tôt en téléchargeait donc moins, ce qui la faisait paraître plus légère
  alors que c'est l'inverse qu'on voulait montrer. On attend deux secondes sans une seule requête. */
  let dernier = Date.now(), vu = tailleVue();
  while (Date.now() - dernier < 2000) {
    await page.waitForTimeout(200);
    const n = tailleVue();
    if (n !== vu) { vu = n; dernier = Date.now(); }
  }

  const tot = [...octets.values()].reduce((a, b) => a + b, 0);
  console.log(`\n  ${path.basename(RACINE)} · ${DEBIT} Mbit/s · ${RTT} ms d'aller-retour\n`);
  for (const [k, v] of [...octets].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(28)} ${String(Math.round(v / 1024)).padStart(6)} ko`);
  }
  console.log(`    ${'TOTAL'.padEnd(28)} ${String(Math.round(tot / 1024)).padStart(6)} ko`);
  console.log(`\n    du lancement au feu vert : ${(t.total / 1000).toFixed(1)} s`
    + `, dont ${(t.barriere / 1000).toFixed(1)} s de barrière de chargement`);
  console.log(`    errors ${errs}`);
  await nav.close();
  serveur.close();
})();
