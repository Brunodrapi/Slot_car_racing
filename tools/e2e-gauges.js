// Les cadrans du menu de sélection, lus à l'écran.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-gauges.js [dossier]
//
// L'invariant : **deux voitures qui affichent le même chiffre affichent le même arc**. Il se casse
// tout seul dès qu'on arrondit le texte sans arrondir aussi la valeur qui pilote l'arc — la 787B
// s'arrête en 20,118 m et la CSL en 20,298 m, et au mètre près les deux montraient « 20 » avec
// deux arcs différents. Vérifie aussi qu'aucun cadran n'est plein, les bornes étant absolues.
const { chromium, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const out = process.argv[2] || '/tmp';

/* Servi en HTTP, et non depuis le disque.

Sous `file://` un `fetch` est refusé par principe, et le moteur charge son catalogue de prises par
`fetch`. L'essai ne mesurait rien de faux pour autant — les cadrans et les pneus étaient justes —
mais il comptait l'erreur de console et échouait pour une raison qui n'existe pas en ligne. C'est
la même leçon que pour la rampe du moteur, le canvas du menu et les prises elles-mêmes : un essai
qui ne s'exécute pas dans les conditions du jeu mesure autre chose que le jeu. */
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.png': 'image/png', '.webp': 'image/webp' };
const serveur = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise((r) => serveur.listen(0, r));
  const base = `http://127.0.0.1:${serveur.address().port}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  let errs = 0;
  page.on('pageerror', (e) => { if (errs++ < 4) console.log('[pageerror]', e.message); });
  page.on('console', (m) => { if (m.type() === 'error') { errs++; console.log('[console]', m.text()); } });
  await page.goto(`${base}/index.html`);
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await page.click('.screen.poster .mi:nth-of-type(1)');
  await page.waitForTimeout(2500);
  const lu = await page.evaluate(() => [...document.querySelectorAll('.grid.models .card')].map((c) => ({
    nom: c.querySelector('b').textContent.trim(),
    cadrans: [...c.querySelectorAll('.gauge')].map((g) => ({
      unite: g.querySelector('small').textContent,
      chiffre: g.querySelector('.num').firstChild.textContent,
      arc: Math.round(parseFloat(getComputedStyle(g.querySelector('.val')).strokeDasharray) / 84.8 * 1000) / 10,
    })),
  })));
  let fautes = 0;
  for (let i = 0; i < 4; i++) {
    const par = {};
    for (const v of lu) { const g = v.cadrans[i]; (par[g.chiffre] ||= []).push(`${v.nom} ${g.arc}%`); }
    for (const [ch, liste] of Object.entries(par)) {
      if (liste.length < 2) continue;
      const ok = new Set(liste.map((x) => x.split(' ').pop())).size === 1;
      if (!ok) fautes++;
      console.log(ok ? '  ok ' : 'FAUTE', lu[0].cadrans[i].unite.padEnd(9), ch.padStart(6), '→', liste.join(' | '));
    }
  }
  console.log(fautes === 0 ? 'AUCUNE incohérence chiffre/arc à l’écran' : fautes + ' INCOHÉRENCES');
  const plein = lu.flatMap((v) => v.cadrans.filter((g) => g.arc >= 100).map((g) => `${v.nom} ${g.unite}`));
  console.log(plein.length ? 'CADRAN PLEIN : ' + plein.join(', ') : 'aucun cadran plein (max ' +
    Math.max(...lu.flatMap((v) => v.cadrans.map((g) => g.arc))) + ' %)');
  /* Les pneus de difficulté : ce qui est dessiné doit être ce qui est mesuré.

  On relève ce que la page affiche — cinq pneus par carte, dont n pleins — et on le confronte au
  `diff` du modèle. Compter les pneus à l'écran plutôt que relire la donnée est tout l'intérêt :
  c'est le seul moyen de voir un décalage entre le classement et son affichage. */
  const pneus = await page.evaluate(() => [...document.querySelectorAll('.grid.models .card')].map((c) => {
    const nom = (c.querySelector('b') || {}).textContent || '';
    const m = (typeof MODELS !== 'undefined' ? MODELS : []).find((x) => nom.startsWith(x.name));
    return { nom: nom.trim(), attendu: m ? m.diff : null,
             total: c.querySelectorAll('.tyres .tyre').length,
             pleins: c.querySelectorAll('.tyres .tyre.on').length,
             lu: (c.querySelector('.tyres .sr') || {}).textContent || '' };
  }));
  console.log('\nles pneus de difficulté :');
  for (const p of pneus) {
    const ok = p.total === 5 && p.pleins === p.attendu;
    if (!ok) errs++;
    console.log(`  ${ok ? 'ok  ' : 'ÉCHEC'} ${p.nom.padEnd(18)} ${'●'.repeat(p.pleins)}${'○'.repeat(Math.max(0, p.total - p.pleins))}`
      + `  mesuré ${p.attendu}, affiché ${p.pleins} sur ${p.total}   «${p.lu.trim()}»`);
  }
  if (pneus.length && pneus.every((p) => p.pleins === pneus[0].pleins)) {
    errs++; console.log('  ÉCHEC : toutes les voitures portent le même nombre de pneus — le classement ne classe rien');
  }
  console.log('\ncartes', lu.length, '· errors', errs);
  if (fautes || plein.length || errs) process.exitCode = 1;
  await page.screenshot({ path: `${out}/pick.png`, fullPage: true });
  await browser.close();
  serveur.close();
})();
