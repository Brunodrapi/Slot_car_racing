// Le bouton pause en course, qui n'existait qu'au clavier.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-pause.js [dossier]
//
// Au clavier, Échap et P mettent en pause depuis toujours. Au doigt il n'y avait rien : une course
// commencée ne se quittait pas. Le bouton est DESSINÉ sur le canvas, donc il n'existe pour personne
// — ni pour le DOM, ni pour une capture d'écran qu'on regarde vite. Trois choses à vérifier, et
// aucune ne se voit à l'œil.
//
// 1. Il ne recouvre rien. Il se glisse entre les deux panneaux du haut, et cet espace vaut 62 px
//    sur un iPhone 13 mais 47 sur un SE : une taille posée en dur passerait sous le chrono.
// 2. Il met bien en pause au doigt.
// 3. Il n'accélère pas. C'est le vrai risque : en course, tout appui qui n'est pas le curseur de
//    ligne est de l'accélérateur. Un bouton mal branché mettrait en pause ET donnerait les gaz,
//    qu'on retrouverait collés à la reprise.
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
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

// les formats qui comptent : le plus étroit qu'on vise, le courant, le paysage, le bureau
const FORMATS = [
  ['iPhone SE', 375, 667, true],
  ['iPhone 13', 390, 844, true],
  ['téléphone paysage', 844, 390, true],
  ['bureau', 1280, 800, false],
];

(async () => {
  await new Promise((r) => serveur.listen(0, r));
  const base = `http://127.0.0.1:${serveur.address().port}`;
  const browser = await chromium.launch();
  let fautes = 0, errs = 0;

  for (const [nom, W, H, tactile] of FORMATS) {
    const ctx = await browser.newContext(tactile
      ? { ...devices['iPhone 13'], viewport: { width: W, height: H }, isMobile: true, hasTouch: true }
      : { viewport: { width: W, height: H } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { errs++; console.log('[pageerror]', e.message); });
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(400);
    await page.keyboard.press('Enter');
    await page.click('[data-action="setup"][data-mode="race"]');
    await page.click('[data-action="startQuick"]');
    await page.waitForTimeout(500);

    // --- 1. la géométrie : le bouton empiète-t-il sur un panneau ? ---
    const geo = await page.evaluate(() => {
      const r = app.renderer, b = r.pauseBtn, pad = 14;
      return { b, gauche: pad + r.hudBox.w, droite: r.w - pad - r.hudBox.tw, h: r.h, W: r.w };
    });
    const marge = Math.min(geo.b.x - geo.gauche, geo.droite - (geo.b.x + geo.b.s));
    const place = marge >= 0;
    const assezGros = geo.b.s >= 34;
    if (!place || !assezGros) fautes++;
    console.log(`  ${nom.padEnd(18)} bouton ${geo.b.s} px à x=${Math.round(geo.b.x)}`
      + `, panneaux à ${geo.gauche} et ${Math.round(geo.droite)} → ${marge.toFixed(0)} px de marge`
      + (place ? '' : '  ← LE BOUTON PASSE SOUS UN PANNEAU')
      + (assezGros ? '' : '  ← TROP PETIT POUR UN POUCE'));

    const cx = geo.b.x + geo.b.s / 2, cy = geo.b.y + geo.b.s / 2;
    const reprendre = async () => {
      const b = page.locator('[data-action="resume"]');
      if (await b.count()) { await b.click(); await page.waitForTimeout(200); }
    };

    /* --- 2. l'appui maintenu : met-il en pause SANS donner les gaz ? ---

    On garde le doigt appuyé pour lire l'accélérateur pendant l'appui, et non après. Une première
    version tapait puis mesurait : le relâchement avait déjà tout remis à zéro, si bien que la
    mesure donnait « accélérateur éteint » même avec le bouton débranché — elle ne pouvait pas voir
    ce qu'elle prétendait vérifier. C'est pendant l'appui que la différence existe. */
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.waitForTimeout(220);
    const pendant = await page.evaluate(() => ({
      etat: app.state, gaz: app.input.throttle, doigt: app.pointers.throttle,
      ecran: !!document.querySelector('[data-action="resume"]'),
    }));
    await page.mouse.up();
    await page.waitForTimeout(150);
    const bon = pendant.etat === 'paused' && pendant.ecran && !pendant.gaz && pendant.doigt == null;
    if (!bon) fautes++;
    console.log(`  ${''.padEnd(18)} appui maintenu → état « ${pendant.etat} », écran de pause ${pendant.ecran}`
      + `, accélérateur ${pendant.gaz}`
      + (bon ? '' : '  ← L\'APPUI N\'A PAS FAIT CE QU\'IL FALLAIT'));
    await page.screenshot({ path: `${out}/pause-${nom.replace(/ /g, '-')}.png` });

    // la reprise doit repartir sans gaz collés
    await reprendre();
    const repris = await page.evaluate(() => ({ etat: app.state, gaz: app.input.throttle }));
    if (repris.etat !== 'race' || repris.gaz) { fautes++; console.log(`  ${''.padEnd(18)} REPRISE FAUTIVE ${JSON.stringify(repris)}`); }
    else console.log(`  ${''.padEnd(18)} reprise : état « ${repris.etat} », accélérateur ${repris.gaz}`);

    /* --- 3. au doigt, sur les formats tactiles ---

    Le chemin tactile n'est pas le même : il pose `renderer.touch`, et un appui pris pour de
    l'accélérateur amènerait le cadran sous le doigt. On vérifie donc aussi que le cadran n'a pas
    bougé de sa place — c'est la trace que laisserait un bouton mal branché, et elle survit au
    relâchement. */
    if (tactile && repris.etat === 'race') {
      await page.touchscreen.tap(cx, cy);
      await page.waitForTimeout(250);
      const doigt = await page.evaluate(() => ({
        etat: app.state, ecran: !!document.querySelector('[data-action="resume"]'),
        cadranBouge: app.renderer.dialAnchored,
      }));
      const ok = doigt.etat === 'paused' && doigt.ecran && !doigt.cadranBouge;
      if (!ok) fautes++;
      console.log(`  ${''.padEnd(18)} tape du doigt → état « ${doigt.etat} », écran de pause ${doigt.ecran}`
        + `, cadran déplacé ${doigt.cadranBouge}`
        + (ok ? '' : '  ← LA TAPE N\'A PAS FAIT CE QU\'IL FALLAIT'));
      await reprendre();
    }
    await ctx.close();
  }

  console.log('\nfautes', fautes, '| erreurs', errs);
  await browser.close();
  serveur.close();
  process.exit(fautes || errs ? 1 : 0);
})();
