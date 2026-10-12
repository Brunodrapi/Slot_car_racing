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
  dire(enr.reg.actif === 'Course', 'et elle devient la configuration active');

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
  await page.click('[data-action="startQuick"]');
  await page.waitForTimeout(700);
  const repris = await page.evaluate(() => app.race.frein);
  dire(Math.abs(repris - enr.frein) < 1e-9, 'la course suivante reprend le réglage enregistré',
    '×' + repris.toFixed(2));

  await b.close(); srv.close();
  console.log('\n' + fautes + ' faute(s)');
  process.exitCode = fautes ? 1 : 0;
})();
