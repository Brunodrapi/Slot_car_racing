// Les panneaux repris à la main, éprouvés de bout en bout.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-panneaux.js
//
// La question qui décide de tout est la même que pour les lignes : **ce qu'on règle est-il ce que
// le jeu affiche ?** Un éditeur qui retourne une flèche à l'écran sans la retourner en course ne
// corrige rien. L'essai retourne donc un panneau, change sa note et sa distance, en supprime un,
// enregistre, puis ouvre le JEU et relit ses panneaux à lui.
//
// Et un cas qu'on oublie toujours : une liste VIDE. Elle doit vouloir dire « aucun panneau » et non
// « recalcule-les », sans quoi on ne peut pas tous les enlever.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
let fautes = 0;
const ok = (c, m) => { console.log(`  ${c ? 'ok' : 'ÉCHEC'} : ${m}`); if (!c) fautes++; };

(async () => {
  const serveur = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => serveur.listen(0, r));
  const base = `http://127.0.0.1:${serveur.address().port}`;
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e.message)));

  await page.goto(`${base}/lignes.html`);
  await page.waitForFunction(() => typeof S !== 'undefined' && S.track);
  await page.evaluate(() => { document.getElementById('circuit').value = 'monza'; charger('monza', false); });
  await page.click('[data-mode="panneaux"]');
  await page.waitForTimeout(200);

  // --------------------------------------------------- le calcul, puis la reprise
  const calcul = await page.evaluate(() => S.panneaux.map((p) => [p.at, p.dist, p.note, p.sign]));
  console.log(`\nMonza : ${calcul.length} panneaux déduits de la géométrie`);
  ok(calcul.length > 4, 'le calcul en donne une poignée');

  // on choisit le premier, on le retourne, on change sa note et sa distance
  const avant = calcul[0];
  await page.evaluate(() => { S.selP = 0; majFicheP(); dessiner(); });
  await page.click(`#sensP button[data-sens="${avant[3] > 0 ? -1 : 1}"]`);
  await page.click('#noteP button[data-note="hairpin"]');
  await page.click('#distP button[data-dist="50"]');
  const apres = await page.evaluate(() => S.panneaux[0]);
  ok(apres.sign === -avant[3], 'le sens est retourné');
  ok(apres.note === 'hairpin' && apres.dist === 50, 'la note et la distance suivent');
  ok(await page.evaluate(() => S.panModif), 'la liste est marquée comme reprise');

  // on en supprime un
  await page.evaluate(() => { S.selP = 1; majFicheP(); });
  await page.click('#supprP');
  const n1 = await page.evaluate(() => S.panneaux.length);
  ok(n1 === calcul.length - 1, 'la suppression enlève un panneau et un seul');

  // --------------------------------------------------- ce que le jeu en fait
  await page.click('#poser');
  await page.waitForTimeout(400);
  const jeu = await ctx.newPage();
  jeu.on('pageerror', (e) => erreurs.push(String(e.message)));
  await jeu.goto(`${base}/index.html`);
  await jeu.waitForFunction(() => typeof app !== 'undefined' && app.save);
  const vus = await jeu.evaluate(async () => {
    await app.refreshCustom();
    app.tracks.delete('monza');
    const T = app.trackCache('monza');
    return T.boards.map((b) => [b.at, b.dist, b.kind && b.kind !== 'normal' ? b.kind : b.grade, b.sign]);
  });
  console.log(`\nle jeu relit ${vus.length} panneaux`);
  ok(vus.length === n1, 'le jeu en voit autant que l’éditeur en a laissé');
  ok(vus[0][3] === apres.sign && vus[0][2] === 'hairpin' && vus[0][1] === 50,
    'le panneau retourné l’est aussi en course');

  // --------------------------------------------------- la liste vide
  await page.evaluate(async () => {
    S.panneaux = []; S.panModif = true; S.selP = null; majFicheP(); dessiner();
    await poser();
  });
  await page.waitForTimeout(300);
  const vide = await jeu.evaluate(async () => {
    await app.refreshCustom();
    app.tracks.delete('monza');
    return app.trackCache('monza').boards.length;
  });
  ok(vide === 0, 'une liste vide veut dire aucun panneau, et non « recalcule »');

  // --------------------------------------------------- le fichier produit
  await page.evaluate(() => { S.panneaux = [{ at: 0.25, dist: 100, note: 'square', sign: -1 }]; S.panModif = true; });
  const txt = await page.evaluate(async () => (await fabriquerFichier()).txt);
  ok(/panneaux:\s*\[/.test(txt), 'le fichier produit porte un bloc panneaux');
  const relu = await page.evaluate((t) => {
    const f = new Function(`${t.replace(/if \(typeof module[^\n]*\n/g, '')}; return TRACKS;`);
    const td = f().find((x) => x.id === 'monza');
    return td.panneaux;
  }, txt);
  ok(relu && relu.length === 1 && relu[0][2] === 'square' && relu[0][3] === -1,
    'le bloc se relit tel qu’il a été écrit');

  // --------------------------------------------------- on rend la main
  await page.click('#oublier');
  await page.waitForTimeout(300);
  const rendu = await jeu.evaluate(async () => {
    await app.refreshCustom();
    app.tracks.delete('monza');
    return app.trackCache('monza').boards.length;
  });
  ok(rendu === calcul.length, '« oublier » rend la main au calcul');

  // --------------------------------------------------- au doigt, sur un téléphone
  const tel = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const m = await tel.newPage();
  m.on('pageerror', (e) => erreurs.push(String(e.message)));
  await m.goto(`${base}/lignes.html`);
  await m.waitForFunction(() => typeof S !== 'undefined' && S.track);
  console.log('\nau doigt');
  ok(await m.evaluate(() => document.getElementById('panel').classList.contains('replie')),
    'le tiroir s’ouvre replié : un éditeur de tracé montre d’abord le tracé');
  ok(await m.evaluate(() => {
    const r = document.getElementById('cv').getBoundingClientRect();
    return r.width > 380 && r.height > 800;        // la toile prend tout l’écran, tiroir par-dessus
  }), 'la carte occupe l’écran entier');

  // le pincement : deux doigts qui s’écartent doivent zoomer, et garder le point du milieu
  const zoom = await m.evaluate(() => {
    const cv = document.getElementById('cv');
    const ev = (t, id, x, y) => cv.dispatchEvent(new PointerEvent(t, {
      pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
    const k0 = S.vue.k;
    const milieu = versPiste(195, 300);
    // Un vrai pincement arrive par petits pas, un évènement par doigt : on l'imite, sinon on
    // mesure un geste que personne ne fait.
    ev('pointerdown', 1, 155, 300); ev('pointerdown', 2, 235, 300);
    for (let i = 1; i <= 10; i++) {
      ev('pointermove', 1, 155 - i * 4, 300);
      ev('pointermove', 2, 235 + i * 4, 300);
    }
    const k1 = S.vue.k, apres = versPiste(195, 300);
    ev('pointerup', 1, 115, 300); ev('pointerup', 2, 275, 300);
    return { f: k1 / k0, derive: Math.hypot(apres[0] - milieu[0], apres[1] - milieu[1]) * S.vue.k };
  });
  ok(Math.abs(zoom.f - 2) < 0.05, `l’écartement doublé double le zoom (${zoom.f.toFixed(2)}×)`);
  ok(zoom.derive < 4, `le point sous le milieu des doigts y reste (${zoom.derive.toFixed(1)} px)`);

  // l’appui long remplace le clic droit
  const appui = await m.evaluate(async () => {
    const cv = document.getElementById('cv');
    S.pts.racing[3] = [S.pts.racing[3][0] + 2, S.pts.racing[3][1]];
    const e = versEcran(S.pts.racing[3]);
    const ev = (t, x, y) => cv.dispatchEvent(new PointerEvent(t, {
      pointerId: 9, pointerType: 'touch', clientX: e[0], clientY: e[1], bubbles: true }));
    const bouge = S.pts.racing[3].slice();
    ev('pointerdown');
    await new Promise((r) => setTimeout(r, 750));
    ev('pointerup');
    return Math.hypot(S.pts.racing[3][0] - bouge[0], S.pts.racing[3][1] - bouge[1]);
  });
  ok(appui > 0.5, 'l’appui long ramène le point au calcul, comme le clic droit');

  /* TOUCHER UN PANNEAU DOIT DONNER ACCÈS À SES RÉGLAGES. C'est le défaut qu'on a vu en vrai : le
     panneau se choisissait, on le voyait s'entourer de vert, et la fiche restait sous le tiroir
     replié. Un choix sans suite n'est pas un choix. */
  await m.click('[data-mode="panneaux"]');
  await m.waitForTimeout(200);
  const doigt = await m.evaluate(() => {
    const cv = document.getElementById('cv');
    const b = panneauxPoses()[0], e = versEcran([b.x / S.track.unitScale, b.y / S.track.unitScale]);
    for (const t of ['pointerdown', 'pointerup']) {
      cv.dispatchEvent(new PointerEvent(t, { pointerId: 5, pointerType: 'touch', clientX: e[0], clientY: e[1], bubbles: true }));
    }
    const f = document.getElementById('ficheP').getBoundingClientRect();
    const p = document.getElementById('panel');
    const q = panneauxPoses()[S.selP];
    const v = versEcran([q.x / S.track.unitScale, q.y / S.track.unitScale]);
    return { choisi: S.selP, replie: p.classList.contains('replie'),
             ficheVisible: !document.getElementById('ficheP').hidden && f.top < innerHeight && f.bottom > 0,
             panneauVisible: v[1] > 0 && v[1] < p.getBoundingClientRect().top };
  });
  ok(doigt.choisi === 0, 'le doigt choisit bien le panneau visé');
  ok(!doigt.replie, 'le tiroir s’ouvre tout seul : sinon les réglages restent dessous');
  ok(doigt.ficheVisible, 'la fiche est à l’écran, pas seulement dans le document');
  ok(doigt.panneauVisible, 'le panneau choisi reste visible au-dessus du tiroir');
  await tel.close();

  console.log('\nerrors ' + (fautes + erreurs.length));
  if (erreurs.length) console.log(erreurs.join('\n'));
  await nav.close();
  serveur.close();
  process.exit(fautes + erreurs.length ? 1 : 0);
})();
