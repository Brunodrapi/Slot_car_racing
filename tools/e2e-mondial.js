// Le tableau mondial, servi par un FAUX serveur.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-mondial.js [dossier]
//
// Faux, et c'est le point. Un essai branché sur le vrai Supabase mesurerait Supabase : il tomberait
// en panne le jour d'une coupure réseau, il dépendrait de ce que contient la base ce jour-là, et il
// ne saurait pas fabriquer les cas qui comptent — une réponse vide, une réponse lente, un refus. On
// sert donc les réponses nous-mêmes, ce qui permet de les choisir.
//
// Quatre choses, et trois d'entre elles sont des pannes :
//
//   1. L'écran se peint AVANT la réponse. Attendre le réseau pour afficher rendrait un menu
//      hors-ligne inutilisable et un menu lent partout ailleurs. On sert donc la réponse en retard,
//      et on vérifie que les temps locaux sont déjà là pendant ce temps.
//   2. La colonne du monde se remplit quand la réponse arrive, en face de la bonne voiture.
//   3. Le serveur tombe : les temps locaux restent, la colonne du monde reste en tirets, et rien
//      n'explose. Un tableau de scores ne doit pas pouvoir casser un jeu qui se joue seul.
//   4. On ne repart pas en boucle. `records()` est rappelé à chaque rendu, et l'arrivée des temps
//      déclenche un rendu : sans garde-fou, la réponse relance la requête, indéfiniment. On compte
//      donc les requêtes réellement parties.
const { chromium, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const out = process.argv[2] || '/tmp';

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.json': 'application/json', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const serveur = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    res.end(d);
  });
});

(async () => {
  await new Promise((r) => serveur.listen(0, r));
  const base = 'http://127.0.0.1:' + serveur.address().port;
  const nav = await chromium.launch();
  let fautes = 0, erreurs = 0;
  const dit = (ok, txt) => { if (!ok) fautes++; console.log(`  ${ok ? 'ok  ' : 'FAUX'}  ${txt}`); };

  // ce que le faux serveur répond, et combien de fois on le lui a demandé
  let appels = 0, mode = 'ok', retard = 0;
  const ctx = await nav.newContext(devices['iPhone 13']);
  await ctx.route('**/fyaifqvghkvrydcldiup.supabase.co/**', async (route) => {
    appels++;
    if (retard) await new Promise((r) => setTimeout(r, retard));
    if (mode === 'panne') return route.fulfill({ status: 503, body: '{"message":"nope"}' });
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { voiture: 'f40', temps: 61.25, pilote: 'Ayrton' },
        { voiture: 'm1procar', temps: 70.5, pilote: 'Nikki' },
      ]),
    });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { erreurs++; console.log('[pageerror]', e.message); });

  await page.goto(base + '/index.html');
  await page.waitForFunction(() => typeof app !== 'undefined' && app.save);
  await page.evaluate(() => {
    app.save.name = 'Testeur'; storeSave(app.save);
    const cat = playableCategories()[0], ms = modelsOf(cat.id);
    app.save.bestLaps[`monza|${cat.id}|${ms[0].id}`] = 74.0;   // un temps local, pour la colonne de gauche
    app.ui.setup.trackId = 'monza';
  });

  // --- 1 et 2. l'écran d'abord, les temps du monde ensuite ---
  retard = 900;
  console.log('\nla reponse arrive en retard');
  await page.evaluate(() => app.ui.setupScreen('timetrial'));
  await page.waitForTimeout(250);          // la réponse n'est pas encore là
  const tot = await page.evaluate(() => {
    const l = [...document.querySelectorAll('.rline')];
    return { n: l.length,
             perso: l.map(e => e.querySelectorAll('.rline-t')[0].textContent.trim()).filter(v => !/^-/.test(v)),
             monde: l.map(e => e.querySelectorAll('.rline-t')[1].textContent.trim()) };
  });
  dit(tot.n === 9, `l'ecran est deja peint : ${tot.n} lignes`);
  dit(tot.perso.length === 1 && tot.perso[0] === '1:14.000', `le temps local est deja la (${tot.perso.join()})`);
  dit(tot.monde.every(v => v === '…'), 'la colonne du monde attend, sans bloquer le reste');

  await page.waitForTimeout(1400);
  const rempli = await page.evaluate(() => {
    const cat = playableCategories()[0], ms = modelsOf(cat.id);
    const nom = (id) => ms.find(m => m.id === id).name;
    const par = {};
    for (const e of document.querySelectorAll('.rline')) {
      par[e.querySelector('b').textContent.trim()] = e.querySelectorAll('.rline-t')[1].textContent.trim();
    }
    return { par, f40: nom('f40'), m1: nom('m1procar'), autre: nom(ms.find(m => m.id !== 'f40' && m.id !== 'm1procar').id) };
  });
  dit(rempli.par[rempli.f40] === '1:01.250Ayrton', `le monde en face de la bonne voiture : ${rempli.f40} → ${rempli.par[rempli.f40]}`);
  dit(rempli.par[rempli.m1] === '1:10.500Nikki', `et la seconde : ${rempli.m1} → ${rempli.par[rempli.m1]}`);
  dit(rempli.par[rempli.autre] === '--:--.---', `une voiture sans record mondial reste en tirets (${rempli.autre})`);

  // --- 4. pas de boucle : la réponse ne relance pas la requête ---
  const avant = appels;
  await page.evaluate(() => app.ui.setupScreen('timetrial'));
  await page.waitForTimeout(800);
  dit(appels === avant, `rouvrir l'ecran ne redemande rien : ${appels - avant} requete(s) de plus (cache)`);
  await page.waitForTimeout(1200);
  dit(appels <= avant + 1, `aucune boucle : ${appels} requete(s) au total`);

  // --- 3. le serveur tombe ---
  console.log('\nle serveur tombe');
  mode = 'panne'; retard = 0;
  const panne = await page.evaluate(async () => {
    app.mondial.cache.clear();
    app.ui._mondiaux = null;
    app.ui.setup.trackId = 'spa';
    app.ui.setupScreen('timetrial');
    await new Promise((r) => setTimeout(r, 900));
    const l = [...document.querySelectorAll('.rline')];
    return { n: l.length, monde: l.map(e => e.querySelectorAll('.rline-t')[1].textContent.trim()),
             erreur: app.mondial.erreur };
  });
  dit(panne.n === 9, `les ${panne.n} lignes sont toujours la`);
  dit(panne.monde.every(v => v === '--:--.---'), 'la colonne du monde est vide, et c\'est tout');
  dit(!!panne.erreur, `la panne est notee sans etre jetee : ${panne.erreur}`);
  dit(erreurs === 0, `aucune exception pendant la panne (${erreurs})`);

  /* --- 5. un pseudo déjà pris doit se VOIR --- */
  /* Sans message, le joueur voit tout fonctionner — il roule, il bat ses temps — et aucun n'entre
  jamais au tableau, puisque le serveur refuse un temps dont l'auteur n'a pas de pseudo déclaré.
  C'est le genre de panne qu'on finit par attribuer au jeu tout entier. */
  console.log('\nun pseudo deja pris');
  const pris = await page.evaluate(async () => {
    app.mondial.pseudoErreur = 'pseudo_pris';
    app.mondial.session = { token: 'x', expire: Date.now() / 1000 + 3600, sub: 'u1', nom: 'x' };
    app.ui.setupScreen('timetrial');
    await new Promise((r) => setTimeout(r, 300));
    const n = document.querySelector('.warn.mondial-note');
    return { vu: !!n, txt: n ? n.textContent.trim() : '' };
  });
  dit(pris.vu, `le joueur est prevenu : « ${pris.txt.slice(0, 64)}… »`);
  dit(/Testeur/.test(pris.txt), 'le message nomme le pseudo refuse');

  await page.evaluate(() => { app.ui._mondiaux = null; app.mondial.cache.clear(); });
  await page.screenshot({ path: path.join(out, 'mondial.png'), fullPage: true });
  console.log(`\nfautes ${fautes} | erreurs ${erreurs}`);
  await nav.close();
  serveur.close();
  process.exit(fautes || erreurs ? 1 : 0);
})();
