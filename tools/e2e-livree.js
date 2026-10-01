// Plusieurs livrées par voiture, et le clic qui les fait tourner.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-livree.js
//
// Bruno : « en cliquant plusieurs fois sur une voiture on change à chaque fois de livrée ». Une
// livrée n'est pas une couleur dans ce jeu : les neuf voitures portent une illustration, et
// l'illustration remplace le dessin vectoriel ET la teinte. Changer de livrée, c'est donc changer de
// FICHIER, et c'est ce que cet essai vérifie — pas que l'écran a changé d'aspect, mais que la page
// est allée chercher le bon dessin.
//
// LE SERVEUR SERT LES VARIANTES À PARTIR DU DESSIN D'ORIGINE. Les deux illustrations de CSL sont
// faites à la main et peuvent ne pas être encore dans le dépôt ; un essai qui tomberait avec elles
// ne dirait rien du code. Il note en revanche CHAQUE chemin demandé, ce qui est la seule preuve
// qu'on regarde la bonne image.
//
// Ce qui se vérifie :
//   1. Le premier appui CHOISIT la voiture, il ne change pas sa livrée. Sinon changer de voiture
//      changerait aussi sa peinture au passage.
//   2. Les appuis suivants font tourner, et reviennent au début.
//   3. La page demande le fichier de la livrée affichée.
//   4. Une voiture qui n'a qu'un dessin n'a pas de repère et ne bouge pas, sans rien casser.
//   5. Le choix survit à un rechargement, et il est rangé par voiture : revenir à une voiture rend
//      la livrée qu'on lui avait laissée.
//   6. La course part avec la livrée choisie, et va chercher son dessin.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.png': 'image/png', '.webp': 'image/webp' };

(async () => {
  const vus = [];
  const serveur = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    vus.push(url);
    let f = path.join(ROOT, url);
    // les variantes servies depuis le dessin d'origine : l'essai mesure le code, pas l'avancement
    // du travail de dessin
    if (!fs.existsSync(f)) f = f.replace(/csl-(castrol|calder)\.png$/, 'csl.png');
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => serveur.listen(0, r));
  const base = `http://127.0.0.1:${serveur.address().port}`;
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1100, height: 820 } });
  const p = await ctx.newPage();
  let fautes = 0, erreurs = 0;
  const dit = (ok, txt) => { if (!ok) fautes++; console.log(`  ${ok ? 'ok  ' : 'FAUX'}  ${txt}`); };
  p.on('pageerror', (e) => { erreurs++; console.log('[page]', e.message); });

  await p.goto(base + '/index.html');
  await p.waitForFunction(() => typeof app !== 'undefined' && app.save);
  await p.evaluate(() => { app.save.name = 'Livree'; app.save.sound = false; storeSave(app.save); app.mondial = null; });
  await p.keyboard.press('Enter');
  await p.waitForTimeout(250);
  await p.click('[data-action="setup"][data-mode="race"]');
  await p.waitForTimeout(300);

  const carte = (id) => `.card[data-action="pickModel"][data-id="${id}"]`;
  const lire = (id) => p.evaluate((sel) => {
    const c = document.querySelector(sel);
    if (!c) return null;
    const b = c.querySelector('.livree');
    const im = c.querySelector('img.carpick');
    return { sel: c.classList.contains('sel'), repere: b ? b.textContent.replace(/\s+/g, ' ').trim() : null,
             src: im ? im.getAttribute('src') : null, choisi: app.save.models.gt, idx: app.playerLivreeFor('csl') };
  }, carte(id));

  /* --- 1. le premier appui choisit --- */
  console.log('\nle premier appui choisit, il ne repeint pas');
  // on attend la carte au lieu de supposer que l'ecran est peint : `click` attend tout seul, pas
  // une lecture, et la toute premiere mesure partait sur un ecran encore vide
  await p.waitForSelector(carte('csl'));
  const avant = await lire('csl');
  await p.click(carte('csl'));
  await p.waitForTimeout(250);
  const un = await lire('csl');
  dit(un.sel && un.choisi === 'csl', `la CSL est choisie (${un.choisi})`);
  dit(un.idx === 0 && avant.idx === 0, `et sa livree n'a pas bouge (${avant.idx} → ${un.idx})`);
  dit(/1\/3/.test(un.repere || ''), `le repere annonce le choix possible (« ${un.repere} »)`);

  /* --- 2 et 3. les appuis suivants font tourner, et la page va chercher le dessin --- */
  console.log('\nles appuis suivants font tourner');
  const attendu = [
    { n: 2, mot: 'Castrol', fichier: 'sprites/pick/csl-castrol.png' },
    { n: 3, mot: 'Calder', fichier: 'sprites/pick/csl-calder.png' },
    { n: 1, mot: 'Motorsport', fichier: 'sprites/pick/csl.png' },
  ];
  for (const a of attendu) {
    await p.click(carte('csl'));
    await p.waitForTimeout(250);
    const l = await lire('csl');
    dit(l.repere === `${a.n}/3 ${a.mot}`, `repere « ${l.repere} »`);
    dit(l.src === a.fichier, `la vignette montree est ${l.src}`);
    dit(vus.includes('/' + a.fichier), `et la page est bien allee la chercher`);
  }

  await p.screenshot({ path: path.join(process.argv[2] || '/tmp', 'livree.png') });

  /* --- 4. une voiture qui n'a qu'un dessin --- */
  console.log('\nune voiture a dessin unique');
  await p.click(carte('f40'));
  await p.waitForTimeout(250);
  const f1 = await lire('f40');
  await p.click(carte('f40'));
  await p.waitForTimeout(250);
  const f2 = await lire('f40');
  dit(f1.repere === null && f2.repere === null, `aucun repere sur la F40 (rien a faire tourner)`);
  dit(f2.sel && f2.choisi === 'f40' && f2.src === 'sprites/pick/f40.png',
    `deux appuis la laissent choisie et inchangee (${f2.src})`);

  /* --- 5. le choix est range par voiture, et il survit --- */
  console.log('\nle choix se garde, voiture par voiture');
  await p.click(carte('csl'));                    // on revient a la CSL : premier appui = choix
  await p.waitForTimeout(250);
  const retour = await lire('csl');
  dit(retour.idx === 0 && /1\/3/.test(retour.repere), `revenir rend la livree laissee (« ${retour.repere} »)`);
  await p.click(carte('csl'));                    // → Castrol
  await p.waitForTimeout(250);
  await p.reload();
  await p.waitForFunction(() => typeof app !== 'undefined' && app.save);
  await p.waitForTimeout(250);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(250);
  await p.click('[data-action="setup"][data-mode="race"]');
  await p.waitForSelector(carte('csl'));
  const apres = await lire('csl');
  dit(apres.idx === 1 && /2\/3 Castrol/.test(apres.repere || ''),
    `apres rechargement : « ${apres.repere} »`);

  /* --- 6. et la course part avec --- */
  console.log('\nen course');
  vus.length = 0;
  await p.click('[data-action="startQuick"]');
  await p.waitForFunction(() => app.state === 'race' && app.race, { timeout: 15000 });
  await p.waitForTimeout(900);
  const course = await p.evaluate(() => ({
    livree: app.race.player.livree,
    modele: app.race.player.cls.id,
    dessin: typeof topSrc === 'function' ? topSrc(app.race.player.cls, app.race.player.livree) : null,
    // les voitures de l'IA ne portent pas toutes la meme peinture quand le modele en a plusieurs
    etalees: new Set(app.race.cars.filter((c) => c.cls.id === 'csl').map((c) => c.livree)).size,
    nCsl: app.race.cars.filter((c) => c.cls.id === 'csl').length,
  }));
  dit(course.livree === 1 && course.modele === 'csl', `le joueur court en livree ${course.livree}`);
  dit(course.dessin === 'sprites/top/csl-castrol.png', `et son dessin est ${course.dessin}`);
  dit(vus.includes('/sprites/top/csl-castrol.png'), `la course est allee chercher ce fichier`);
  /* --- 7. la grille de l'IA ne porte pas trois fois la meme peinture ---

  La course du dessus ne comptait qu'une CSL, donc son controle passait sans rien prouver. On
  interroge donc le tirage lui-meme : dix pilotes, et les livrees qu'ils porteraient sur un modele
  qui en a trois. Avec la graine, le tirage se rejoue a l'identique — une manche de championnat
  rejouee doit presenter la meme grille. */
  const spread = await p.evaluate(() => {
    const csl = modelById('csl');
    const tirage = (seed) => makeRoster(10, 0, seed, 'gt').map((a) => livreeDe(csl, a.livree).id);
    const a = tirage(42), b = tirage(42), c = tirage(7);
    return { a, distinctes: new Set(a).size, stable: a.join() === b.join(), autre: c.join() !== a.join() };
  });
  dit(spread.distinctes > 1, `dix pilotes se repartissent sur ${spread.distinctes} livrees (${spread.a.map((x) => x || 'origine').join(', ')})`);
  dit(spread.stable, `la meme graine rejoue la meme grille`);
  dit(spread.autre, `une autre graine en donne une autre`);
  dit(course.nCsl < 2 || course.etalees > 1,
    `et dans la course jouee : ${course.nCsl} CSL, ${course.etalees} livree(s)`);

  console.log(`\nfautes ${fautes} | erreurs ${erreurs}`);
  await nav.close();
  serveur.close();
  process.exit(fautes || erreurs ? 1 : 0);
})();
