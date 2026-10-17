/* Le réglage de freinage : le parcours complet, du volet déroulant à la sauvegarde.

On vérifie ce qui peut casser en silence : que le levier n'apparaît QU'EN mode réglage, qu'il
change bien le frein de la voiture DU JOUEUR et de personne d'autre, qu'un appui dessus
n'accélère pas, que la sauvegarde retombe dans la bonne case circuit+voiture, et qu'une seconde
sauvegarde complète la configuration au lieu de l'écraser.

  NODE_PATH=$(npm root -g) node tools/e2e-reglage.js
*/
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.ico': 'image/vnd.microsoft.icon', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp', '.json': 'application/json' };
const srv = http.createServer((q, s) => {
  let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html';
  const f = path.join(R, u);
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end('non'); }
  s.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(s);
});
let fautes = 0;
const dire = (ok, quoi, detail) => { if (!ok) fautes++; console.log('  ' + (ok ? 'ok  ' : 'FAUX') + ' ' + quoi + (detail ? '   ' + detail : '')); };

(async () => {
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => { fautes++; console.log('  FAUX erreur de page   ' + e.message); });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(() => typeof app !== 'undefined' && app.save);
  await page.evaluate(() => { app.save.name = 'Bruno'; app.mondial = null; storeSave(app.save); });
  await page.waitForTimeout(350);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.click('[data-action="setup"][data-mode="race"]');
  await page.waitForSelector('[data-action="startQuick"]');

  const vu = await page.evaluate(() => ({
    ecran: app.ui && app.ui.ecran, volet: !!document.getElementById('sel-reglage'),
    regler: !!document.querySelector('[data-action="startTune"]'),
    depart: !!document.querySelector('[data-action="startQuick"]'),
    fin: (document.getElementById('ui') || {}).innerHTML ? document.getElementById('ui').innerHTML.slice(-320) : '(vide)',
  }));
  dire(vu.volet, 'l’écran de départ porte le volet des réglages');
  dire(vu.regler, 'et le bouton Régler');
  if (!vu.volet) console.log('       départ=' + vu.depart + '\n       fin du DOM : ' + vu.fin);

  // --- une course ORDINAIRE n'a pas de levier ---
  await page.click('[data-action="startQuick"]');
  await page.waitForTimeout(600);
  dire(await page.evaluate(() => app.renderer.reglageZone === null), 'course ordinaire : pas de levier');
  dire(await page.evaluate(() => app.race.frein === 1), 'course ordinaire : frein au défaut', 'x1');
  await page.evaluate(() => app.quitRace ? app.quitRace() : app.toMenu());
  await page.waitForTimeout(300);
  await page.click('[data-action="setup"][data-mode="race"]');
  await page.waitForSelector('[data-action="startTune"]');

  // --- le mode réglage ---
  await page.click('[data-action="startTune"]');
  await page.waitForTimeout(700);
  const z = await page.evaluate(() => app.renderer.reglageZone);
  dire(!!z, 'mode réglage : le levier est dessiné', z ? `x=${Math.round(z.x)} l=${Math.round(z.w)}` : '');

  // --- le levier bouge le frein du JOUEUR et de personne d'autre ---
  const av = await page.evaluate(() => ({
    frein: app.race.frein, j: app.race.player.cls.brake,
    autres: app.race.cars.filter((c) => !c.isPlayer).map((c) => c.cls.brake),
  }));
  await page.evaluate(() => {
    const z = app.renderer.reglageZone, d = app.canvas.getBoundingClientRect();
    const ev = (t, x) => app.canvas.dispatchEvent(new PointerEvent(t, { pointerId: 9, bubbles: true,
      pointerType: 'touch', clientX: d.left + x, clientY: d.top + z.y + z.h / 2 }));
    ev('pointerdown', z.x + z.w * 0.2); ev('pointermove', z.x + z.w * 0.2);
  });
  await page.waitForTimeout(200);
  const ap = await page.evaluate(() => ({
    frein: app.race.frein, j: app.race.player.cls.brake, gaz: app.race.player.throttle,
    autres: app.race.cars.filter((c) => !c.isPlayer).map((c) => c.cls.brake),
  }));
  dire(ap.frein < av.frein - 0.05, 'un appui sur le levier change le freinage',
    `×${av.frein.toFixed(2)} → ×${ap.frein.toFixed(2)}`);
  dire(Math.abs(ap.j / av.j - ap.frein / av.frein) < 1e-6, 'le frein de la voiture suit exactement le levier');
  dire(JSON.stringify(ap.autres) === JSON.stringify(av.autres), 'les rivales ne sont pas touchées');
  dire(!ap.gaz, 'un appui sur le levier n’accélère pas');

  // --- la sauvegarde depuis la pause ---
  await page.evaluate(() => app.togglePause());
  await page.waitForTimeout(300);
  dire(await page.$('#reg-nom') !== null, 'la pause propose d’enregistrer');
  await page.fill('#reg-nom', 'Course');
  await page.click('[data-action="regEnreg"]');
  await page.waitForTimeout(300);
  const enr = await page.evaluate(() => ({
    reg: JSON.parse(JSON.stringify(app.save.reglages)),
    cle: app.raceCtx.trackId + '|' + app.race.opts.modelId,
    frein: app.race.frein,
  }));
  const cfg = enr.reg.configs.find((c) => c.nom === 'Course');
  dire(!!cfg, 'la configuration est créée');
  dire(cfg && Math.abs(cfg.freins[enr.cle] - enr.frein) < 1e-9,
    'la valeur tombe dans la bonne case circuit+voiture', enr.cle + ' = ×' + enr.frein.toFixed(2));
  dire(enr.reg.actifs[enr.cle] === 'Course', 'et elle devient active pour ce couple');

  // --- une seconde sauvegarde COMPLÈTE, elle n'écrase pas ---
  const apres = await page.evaluate(() => {
    poseFrein(app.save, 'Course', 'monaco', '935', 0.75);
    storeSave(app.save);
    return JSON.parse(JSON.stringify(app.save.reglages.configs.find((c) => c.nom === 'Course').freins));
  });
  dire(Object.keys(apres).length === 2, 'un second circuit s’ajoute sans effacer le premier',
    Object.keys(apres).join(' + '));

  // --- et le réglage est repris au départ suivant ---
  await page.evaluate(() => app.toMenu());
  await page.waitForTimeout(300);
  await page.click('[data-action="setup"][data-mode="race"]');
  await page.waitForSelector('[data-action="startQuick"]');
  /* --- LA PORTÉE : un réglage ne vaut QUE pour son circuit et sa voiture ---

  C'est le point que Bruno a relevé : la configuration se choisit dans une liste, ce qui lui donne
  l'air globale, alors qu'elle ne s'applique que là où une valeur existe. On vérifie les deux côtés
  de la règle, et que l'écran le DIT. */
  
  const portee = await page.evaluate(() => {
    const s = app.save, st = app.ui.setup;
    const ici = freinDe(s, st.trackId, app.playerModelFor(st.classId).id);
    return { ici, regle: freinDe(s, 'monaco', '935'), ailleurs: freinDe(s, 'spa', 'f40'),
             texte: (document.querySelector('.reg-ici') || {}).textContent || '' };
  });
  dire(portee.regle === 0.75, 'le réglage de Monaco + 935 s’applique là-bas', '×' + portee.regle);
  dire(portee.ailleurs === 1, 'et nulle part ailleurs : Spa + F40 reste au défaut', '×' + portee.ailleurs);
  dire(/[0-9]/.test(portee.texte) || /défaut|origine|stock/i.test(portee.texte),
    'l’écran de départ dit ce qui s’applique ici', '« ' + portee.texte.trim() + ' »');

  await page.click('[data-action="startQuick"]');
  await page.waitForTimeout(700);
  const repris = await page.evaluate(() => app.race.frein);
  dire(Math.abs(repris - enr.frein) < 1e-9, 'la course suivante reprend le réglage enregistré',
    '×' + repris.toFixed(2));

  // Deux profils pour le même couple et un profil sur un autre couple : chaque liste et chaque
  // sélection doivent rester indépendantes, même si les profils ont le même nom.
  await page.evaluate(({ cle }) => {
    const [track, model] = cle.split('|');
    poseFrein(app.save, 'Attaque', track, model, 1.12);
    storeSave(app.save); app.toMenu(); app.ui.setupScreen('race');
  }, enr);
  const lire = () => page.evaluate(() => ({
    noms: [...document.querySelector('#sel-reglage').options].map(o => o.value),
    actif: document.querySelector('#sel-reglage').value,
    texte: document.querySelector('.reg-ici').textContent,
  }));
  let liste = await lire();
  dire(JSON.stringify(liste.noms) === JSON.stringify(['', 'Course', 'Attaque']), 'seuls les profils du couple sont proposés');
  dire(liste.actif === 'Attaque' && /1[.,]12/.test(liste.texte), 'le choix et la valeur effective concordent');
  await page.selectOption('#sel-reglage', '');
  dire(await page.evaluate(({ cle }) => freinDe(app.save, ...cle.split('|')) === 1, enr), 'le choix Par défaut est effectif');
  await page.evaluate(() => {
    const m = modelById('935'); app.save.models[m.catId] = m.id;
    app.ui.setup.classId = m.catId; app.ui.setup.trackId = 'monaco'; app.ui.setupScreen('race');
  });
  liste = await lire();
  dire(JSON.stringify(liste.noms) === JSON.stringify(['', 'Course']) && liste.actif === 'Course',
    'Monaco + 935 retrouve son profil, sans Attaque');
  await page.click('[data-action="pickTrack"][data-id="spa"]');
  liste = await lire();
  dire(liste.noms.length === 1 && liste.actif === '', 'changer de circuit masque les profils étrangers');
  await page.click('[data-action="startTune"]');
  await page.waitForTimeout(300);
  await page.evaluate(() => app.togglePause());
  dire(await page.inputValue('#reg-nom') === '', 'la pause ne propose aucun nom provenant d’un autre couple');
  await page.evaluate(({ cle }) => {
    app.toMenu(); const [track, model] = cle.split('|'), m = modelById(model);
    app.save.models[m.catId] = m.id; app.ui.setup.classId = m.catId;
    app.ui.setup.trackId = track; app.ui.setupScreen('race');
  }, enr);
  liste = await lire();
  dire(liste.actif === '', 'le choix Par défaut du premier couple est conservé');
  await page.selectOption('#sel-reglage', 'Attaque');
  await page.click('[data-action="startQuick"]');
  dire(await page.evaluate(() => app.race.frein === 1.12), 'la sélection modifiée pilote réellement le freinage');

  const persiste = await page.evaluate(({ cle }) => {
    const relu = loadSave();
    return freinDe(relu, ...cle.split('|')) === 1.12 && freinDe(relu, 'monaco', '935') === .75
      && freinDe(relu, 'spa', '935') === 1;
  }, enr);
  dire(persiste, 'les choix indépendants survivent à la relecture du stockage du téléphone');

  const migration = await page.evaluate(() => {
    const copie = JSON.parse(JSON.stringify(app.save));
    copie.reglages = { actif: 'Ancien', configs: [{ nom: 'Ancien', freins: {
      'monza|f40': .85, 'spa|f40': 1,
    } }, { nom: 'Autre', freins: { 'monaco|935': .7 } }] };
    const avant = JSON.stringify(copie.reglages.configs);
    storeSave(copie); const relu = loadSave(); storeSave(app.save);
    const stable = JSON.stringify(relu.reglages); migreReglages(relu);
    return {
      valeurs: avant === JSON.stringify(relu.reglages.configs),
      selection: freinDe(relu, 'monza', 'f40') === .85 && configActive(relu, 'spa', 'f40')?.nom === 'Ancien',
      etranger: configActive(relu, 'monaco', '935') === null && reglagesPour(relu, 'monaco', '935').length === 1,
      idempotent: stable === JSON.stringify(relu.reglages),
    };
  });
  for (const [nom, ok] of Object.entries(migration)) dire(ok, 'migration des anciens réglages : ' + nom);

  await b.close(); srv.close();
  console.log('\n' + fautes + ' faute(s)');
  process.exitCode = fautes ? 1 : 0;
})();
