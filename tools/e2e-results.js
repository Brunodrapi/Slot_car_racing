const { chromium } = require('playwright');
const out = process.argv[2] || '/tmp';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text()); });
  await page.goto('file:///home/user/Slot_car_racing/index.html');
  /* Un joueur nommé. Le menu ne s'ouvre plus sans nom, et un essai doit faire ce que fait un
  joueur. On attend que `app` existe : `goto` rend la main au chargement, pas à l'initialisation. */
  await page.waitForFunction(() => typeof app !== 'undefined' && app.save);
  await page.evaluate(() => {
    app.save.name = 'Testeur'; storeSave(app.save);
    /* Et pas de tableau mondial : ces essais mesurent des menus, pas un service distant. Le
    laisser branché ferait partir une requête réseau à chaque ouverture de l'écran des records —
    une source d'échecs qui n'a rien à voir avec ce qu'on vérifie, et qui rendrait la suite
    dépendante d'un serveur. `tools/e2e-mondial.js` s'en charge, avec un faux serveur à lui. */
    app.mondial = null;
  });
  // L'écran-titre s'interpose désormais entre le chargement et le menu : n'importe quelle touche
  // le passe, comme pour un joueur.
  await page.waitForTimeout(350);
  await page.keyboard.press('Enter');
  /* La carrière n'a plus de bouton dans le menu — elle en est sortie quand le jeu s'est réduit à la
  course rapide et au contre-la-montre — mais l'écran, lui, est resté. On y entre donc par son
  action plutôt que par un bouton qui n'existe plus : cet essai garde le chemin en état pour le
  jour où la carrière revient au menu. Le jour où elle y revient, ce `careerScreen()` redevient un
  `click('[data-action="career"]')`, et si elle est retirée pour de bon, c'est tout ce fichier qui
  part. Ce qu'on ne veut pas est un écran qui pourrit sans que rien ne le dise. */
  const carriere = () => page.evaluate(() => app.ui.careerScreen());
  await carriere();
  await page.click('[data-action="cup"][data-id="gt"]');
  const fast = async () => page.evaluate(() => {
    const r = app.race; let n = 0;
    while (r.state !== "finished" && n++ < 400000) { const thr = aiThrottle(r.player, r.cars, r.dt, { marginBase: 0.985, marginSpread: 0 }); r.update(r.dt, thr); }
    return { state: r.state, pos: r.positionOf(r.player), time: r.time, crashes: r.player.crashes, best: r.player.bestLap };
  });
  /* Autant de courses que la coupe en compte, et non trois.

  Le bouton des classements n'apparaît sur l'écran de résultats qu'une fois la coupe terminée. La
  GT Legends Cup est passée de trois manches à cinq, et l'essai, resté à trois, attendait un bouton
  qui ne pouvait pas venir. On lit donc la longueur de la coupe plutôt que de la retenir. */
  const manches = await page.evaluate(() => CUPS.find(c => c.id === 'gt').tracks.length);
  for (let i = 0; i < manches; i++) {
    await page.click('[data-action="startCup"]');
    await page.waitForTimeout(200);
    console.log('race', i + 1, JSON.stringify(await fast()));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/10-results-${i + 1}.png` });
  }
  await page.click('[data-action="cup"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/11-cup-done.png` });
  await carriere();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/12-career-after.png` });
  // time trial flow
  await page.click('[data-action="menu"]');
  await page.click('[data-action="setup"][data-mode="timetrial"]');
  await page.click('[data-action="startQuick"]');
  await page.waitForTimeout(200);
  await page.evaluate(() => { const r = app.race; let n = 0; while (r.player.lap < 2 && n++ < 400000) { const thr = aiThrottle(r.player, r.cars, r.dt, { marginBase: 0.985, marginSpread: 0 }); r.update(r.dt, thr); } });
  /* Un tour SALI par une sortie de piste, avant de clore le contre-la-montre.

  La colonne et la rature n'apparaissent que s'il y a quelque chose à montrer, donc une course propre
  ne les peint jamais — et un essai qui ne joue que des courses propres ne verrait pas l'écran se
  casser. On salit donc un tour, puis on relit ce qui est réellement dans le document. */
  await page.evaluate(() => {
    const p = app.race.player;
    p.lapOk = p.lapTimes.map((_, i) => i !== 0);     // le premier tour annulé
  });
  await page.keyboard.press('Escape');
  await page.click('[data-action="endTT"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/13-tt-results.png` });
  const nul = await page.evaluate(() => ({
    lignes: document.querySelectorAll('.tbl tbody tr').length,
    nulles: document.querySelectorAll('.tbl tr.nul').length,
    mot: (document.querySelector('.tbl tr.nul .mark') || {}).textContent || '',
  }));
  if (!(nul.nulles === 1 && /annul|void/.test(nul.mot))) {
    console.log(`TOUR ANNULE NON MONTRE : ${JSON.stringify(nul)}`); process.exitCode = 1;
  } else console.log(`tour annule : ${nul.nulles} sur ${nul.lignes} lignes, marque « ${nul.mot.trim()} »`);

  /* --- la pénalité au classement d'une course --- */
  await page.click('[data-action="menu"]');
  await page.click('[data-action="setup"][data-mode="race"]');
  await page.click('[data-action="startQuick"]');
  await page.waitForTimeout(200);
  await fast();
  await page.evaluate(() => {
    const r = app.race;
    r.player.fautes = 2; r.player.repris = 1.5;       // 2 s fixes + 1,5 s reprises
    r._finish();
    app.ui.resultsScreen(r, {});
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/14-penalite.png` });
  const pen = await page.evaluate(() => ({
    colonne: [...document.querySelectorAll('.tbl th')].some((th) => /nalit|enalty/i.test(th.textContent)),
    cellules: document.querySelectorAll('.tbl td.warn').length,
    explique: !!document.querySelector('.cols p.warn'),
    valeur: (document.querySelector('.tbl tr.me td.warn') || {}).textContent || '',
  }));
  if (!(pen.colonne && pen.cellules >= 1 && pen.explique && /3[.,]5/.test(pen.valeur))) {
    console.log(`PENALITE NON MONTREE : ${JSON.stringify(pen)}`); process.exitCode = 1;
  } else console.log(`penalite : colonne et ${pen.cellules} cellules, « ${pen.valeur.trim()} », expliquee sous le tableau`);
  // la clé vient du jeu : écrite en dur, elle est repartie sans l'essai au passage de la v1 à la v2
  const save = await page.evaluate(() => localStorage.getItem(SAVE_KEY));
  if (!save) { console.log('AUCUNE SAUVEGARDE'); process.exitCode = 1; } else console.log('save', save.slice(0, 300));
  await browser.close();
})();
