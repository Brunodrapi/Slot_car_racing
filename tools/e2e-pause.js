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
// 4. Il échappe à l'encoche. Le canvas couvre l'écran entier, barre d'état comprise : un bouton
//    posé à 14 px du bord physique tombe sous une barre haute de 47. Chromium ne simule pas les
//    encoches, donc l'essai pose lui-même la valeur que la plateforme refuse de donner — et rien
//    d'autre : toute la mise en page s'exécute ensuite pour de vrai.
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
    /* On mesure contre ce que le HUD occupe VRAIMENT, pas contre des panneaux d'autrefois.

    La première version comparait le bouton aux deux panneaux translucides du haut. Ils ont
    disparu — tout est posé sur le monde avec un contour — et l'essai accusait alors le bouton de
    passer sous des rectangles fantômes, sur les quatre formats à la fois, alors que rien ne le
    gênait. Le rendu publie `hudZones` : la position à gauche, les temps à droite. */
    const geo = await page.evaluate(() => {
      const r = app.renderer, b = r.pauseBtn, z = r.hudZones;
      return { b, pos: z.pos, temps: z.temps, lap: z.lap, h: r.h, W: r.w };
    });
    /* Les trois vides du haut, et non plus seulement l'absence de chevauchement.

    L'essai se contentait de vérifier que le bouton ne passait sous rien. Il passait le contrôle
    avec quarante pixels d'un côté et dix de l'autre, ce qui est exactement le défaut qu'on a
    corrigé : un alignement peut être parfaitement disjoint et parfaitement bancal. On mesure donc
    la répartition elle-même. Le vide du milieu est volontairement petit — la pause et les temps se
    lisent d'un seul tenant — ce sont les deux vides extérieurs qui doivent se valoir. */
    const g1 = geo.b.x - (geo.pos.x + geo.pos.w);
    const g2 = geo.temps.x - (geo.b.x + geo.b.s);
    const g3 = geo.lap.x - (geo.temps.x + geo.temps.w);
    const place = Math.min(g1, g2, g3) >= 0;
    const equilibre = Math.abs(g1 - g3) <= 1.5;
    const assezGros = geo.b.s >= 34;
    if (!place || !assezGros || !equilibre) fautes++;
    console.log(`  ${nom.padEnd(18)} bouton ${geo.b.s} px à x=${Math.round(geo.b.x)}`
      + ` | vides ${g1.toFixed(1)} / ${g2.toFixed(1)} / ${g3.toFixed(1)}`
      + (place ? '' : '  ← DEUX BLOCS SE CHEVAUCHENT')
      + (equilibre ? '' : `  ← HAUT BANCAL : ${Math.abs(g1 - g3).toFixed(1)} px d'écart entre les bords`)
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

  /* --- 4. l'encoche ---

  Les écrans en DOM respectent `env(safe-area-inset-*)` depuis toujours ; le HUD, lui, est dessiné,
  et un dessin ne connaît pas le CSS. Il posait ses quatorze pixels depuis le bord physique de
  l'écran, pas depuis le bord sûr. En portrait sur un iPhone le bouton pause, de 14 à 60, tombait
  donc aux trois quarts sous une barre d'état haute de 47 — invisible, et intouchable.

  Aucun de nos quatre formats ne pouvait le montrer : l'émulation de Chromium résout `env()` à
  zéro. On force donc la sonde qui les lit, et seulement elle, aux valeurs d'un iPhone 13 en
  portrait — 47 en haut, 34 en bas pour la barre d'accueil. Tout le reste du chemin est le vrai. */
  {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { errs++; console.log('[pageerror]', e.message); });
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(400);
    await page.keyboard.press('Enter');
    await page.click('[data-action="setup"][data-mode="race"]');
    await page.click('[data-action="startQuick"]');
    await page.waitForTimeout(500);
    const avant = await page.evaluate(() => ({ y: app.renderer.pauseBtn.y, dial: app.renderer.dialHome.cy }));
    const ENC = { t: 47, b: 34 };
    await page.addStyleTag({ content: `#sonde-encoches { padding: ${ENC.t}px 0px ${ENC.b}px 0px !important; }` });
    await page.evaluate(() => app.renderer.resize());
    await page.waitForTimeout(200);
    const apres = await page.evaluate(() => ({
      lues: app.renderer.encoches, b: app.renderer.pauseBtn,
      dial: app.renderer.dialHome.cy, rayon: app.renderer.dial.r, h: app.renderer.h,
      slider: app.renderer.slider,
    }));
    const lues = apres.lues.t === ENC.t && apres.lues.b === ENC.b;
    const degage = apres.b.y >= ENC.t;
    const basDegage = apres.dial + apres.rayon * 0.46 <= apres.h - ENC.b;
    if (!lues || !degage || !basDegage) fautes++;
    console.log(`  ${'encoche 47/34'.padEnd(18)} lues ${JSON.stringify(apres.lues)}`
      + (lues ? '' : '  ← LA SONDE NE LIT PAS LES ENCOCHES'));
    console.log(`  ${''.padEnd(18)} bouton passé de y=${avant.y} à y=${apres.b.y}`
      + (degage ? ' (au-dessous de la barre d\'état)' : '  ← TOUJOURS SOUS LA BARRE D\'ÉTAT'));
    console.log(`  ${''.padEnd(18)} bas du cadran à ${Math.round(apres.dial + apres.rayon * 0.46)}`
      + ` sur ${apres.h} px, barre d'accueil à ${apres.h - ENC.b}`
      + (basDegage ? '' : '  ← LE CADRAN PASSE SOUS LA BARRE D\'ACCUEIL'));

    // et il doit toujours mettre en pause, à sa nouvelle place
    await page.touchscreen.tap(apres.b.x + apres.b.s / 2, apres.b.y + apres.b.s / 2);
    await page.waitForTimeout(250);
    const et = await page.evaluate(() => app.state);
    if (et !== 'paused') { fautes++; console.log(`  ${''.padEnd(18)} tape à la nouvelle place → « ${et} »  ← NE MET PLUS EN PAUSE`); }
    else console.log(`  ${''.padEnd(18)} tape à la nouvelle place → « ${et} »`);
    await page.screenshot({ path: `${out}/pause-encoche.png` });
    await ctx.close();
  }

  console.log('\nfautes', fautes, '| erreurs', errs);
  await browser.close();
  serveur.close();
  process.exit(fautes || errs ? 1 : 0);
})();
