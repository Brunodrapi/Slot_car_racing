// L'éditeur de décor (editor.html, mode Décor), outil par outil, à la souris, dans Chromium.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-editeur-decor.js [--captures=dossier]
//
// Ce qui se vérifie : chaque outil produit la retouche attendue dans la reprise (`DEC.decor`), la
// piste reconstruite la dessine (le moteur du jeu la lit), l'annulation la défait, l'enregistrement
// la pose dans la base du navigateur et le jeu la joue, et le `tracks.js` fabriqué s'évalue et porte
// la même retouche — sans toucher aux autres circuits.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };
const CAPT = (process.argv.find((a) => a.startsWith('--captures=')) || '').split('=')[1] || null;
let fautes = 0;
const ok = (c, msg) => { console.log(`  ${c ? 'ok   ' : 'ÉCHEC'} ${msg}`); if (!c) fautes++; };

(async () => {
  const srv = http.createServer((q, s) => {
    let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html';
    const f = path.join(ROOT, u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(s);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(e.message));
  p.on('dialog', (d) => d.accept());
  if (CAPT) fs.mkdirSync(CAPT, { recursive: true });
  const capture = async (nom) => { if (CAPT) await p.screenshot({ path: path.join(CAPT, nom + '.png') }); };

  await p.goto(base + '/editor.html?decor=monza');
  await p.waitForFunction(() => DEC.track && DEC.rendu && DEC.id === 'monza', null, { timeout: 30000 });
  const pret = async () => { await p.waitForTimeout(80); await p.waitForFunction(() => !DEC.drag); await p.waitForTimeout(120); };
  // Le centre d'écran d'un point du monde, et une vue rapprochée sur une fraction du tour.
  const ecran = (x, y) => p.evaluate(([x, y]) => versEcran(x, y), [x, y]);
  const vise = async (f, lat = 0, zoom = 6) => {
    await p.evaluate(([f, lat, zoom]) => {
      const T = DEC.track, q = T.pos(f * T.length, lat), r = DEC.rendu;
      r.cam.zoom = zoom; r.cam.x = q.x - 150 / zoom; r.cam.y = q.y; peindre();
    }, [f, lat, zoom]);
    await p.waitForTimeout(120);
  };
  const glisse = async (a, b) => {
    await p.mouse.move(a.x, a.y); await p.mouse.down();
    for (let k = 1; k <= 6; k++) await p.mouse.move(a.x + (b.x - a.x) * k / 6, a.y + (b.y - a.y) * k / 6);
    await p.mouse.up(); await pret();
  };
  const outil = async (o, mode) => {
    await p.click(`#d-outils [data-outil="${o}"]`);
    if (mode) await p.click(`#d-fiche [data-mode="${mode}"]`);
  };
  console.log('Éditeur de décor — Monza');
  await capture('01-monza');

  /* --- Objets : choisir, déplacer, supprimer, ajouter, gommer --- */
  const arbre = await p.evaluate(() => {
    const e = tousObjets().find((e) => e.src === 'arbre');
    return { x: e.o.x, y: e.o.y };
  });
  await p.evaluate(([x, y]) => { const r = DEC.rendu; r.cam.zoom = 8; r.cam.x = x - 150 / 8; r.cam.y = y; peindre(); }, [arbre.x, arbre.y]);
  await p.waitForTimeout(150);
  let a = await ecran(arbre.x, arbre.y);
  await glisse(a, { x: a.x + 80, y: a.y + 40 });
  let d = await p.evaluate(() => DEC.decor.objets);
  ok(d && d.retires.length === 1 && d.ajouts.length === 1 && Math.abs(d.ajouts[0].x - (d.retires[0][0] + 10)) < 0.6,
    'glisser un arbre de bois : retiré à sa place, reposé dix mètres plus loin');
  ok(await p.evaluate(() => tousObjets().some((e) => e.o.ajout && e.src === 'arbre')), 'le moteur dessine l’arbre déplacé');
  await p.keyboard.press('Delete'); await pret();
  d = await p.evaluate(() => DEC.decor.objets);
  ok(!d || (d.ajouts.length === 0 && d.retires.length === 1), 'Suppr : l’arbre ajouté disparaît, la place d’origine reste vide');
  await outil('objets', 'ajouter');
  await p.selectOption('#d-ajout', 'campingcar');
  await p.mouse.click(a.x + 20, a.y - 60); await pret();
  ok(await p.evaluate(() => tousObjets().some((e) => e.src === 'vehicule' && e.o.kind === 'campingcar' && e.o.ajout)), 'Ajouter : un camping-car posé au clic');
  await p.selectOption('#d-ajout', 'mix-sapins');
  await glisse({ x: a.x - 60, y: a.y + 80 }, { x: a.x + 120, y: a.y + 80 });
  const sapins = await p.evaluate(() => DEC.decor.objets.ajouts.filter((x) => x.id === 'pine' || x.id === 'pine2').length);
  ok(sapins >= 3, `Ajouter en glissant : une rangée de ${sapins} sapins`);
  await outil('objets', 'gomme');
  const avantGomme = await p.evaluate(() => DEC.decor.objets.retires.length);
  await glisse({ x: a.x - 40, y: a.y - 120 }, { x: a.x - 40, y: a.y + 20 });
  const apresGomme = await p.evaluate(() => DEC.decor.objets.retires.length);
  ok(apresGomme > avantGomme, `Gomme : ${apresGomme - avantGomme} objet(s) effacé(s)`);
  await capture('02-objets');
  const nAnnule = await p.evaluate(() => DEC.annule.length);
  await p.keyboard.press('Control+z'); await pret();
  ok(await p.evaluate((n) => DEC.annule.length === n - 1 && DEC.decor.objets.retires.length < 999, nAnnule), 'Ctrl+Z défait le dernier geste');

  /* --- Hors-piste : une zone de gravier tracée au clic --- */
  await outil('horspiste');
  const nZones = await p.evaluate(() => (DEC.decor.runoffs || []).length);
  await vise(0.42, 0, 3);
  await p.click('#d-fiche [data-nouv="gravel"]');
  const pts = await p.evaluate(() => [0.415, 0.42, 0.425].map((f) => { const T = DEC.track, s = f * T.length; return versEcran(T.pos(s, T.hwLeftAt(s) + 9).x, T.pos(s, T.hwLeftAt(s) + 9).y); }));
  for (const q of pts) { await p.mouse.click(q.x, q.y); await p.waitForTimeout(60); }
  await p.keyboard.press('Enter'); await pret();
  const zone = await p.evaluate(() => DEC.decor.runoffs.at(-1));
  ok(await p.evaluate((n) => DEC.decor.runoffs.length === n + 1, nZones) && zone.surface === 'gravel' && zone.side === 1
    && zone.points.length >= 4 && Math.abs(zone.points[2][1] - 9) < 1.5, 'nouvelle zone de gravier : côté gauche, 9 m au bord');
  ok(await p.evaluate(() => { const T = DEC.track, s = 0.42 * T.length; return T.runoffSurfaceAt(s, T.hwLeftAt(s) + 5) === 'gravel'; }), 'la piste reconstruite porte ce gravier');
  // glisser un point de la zone choisie
  const pz = await p.evaluate(() => { const z = DEC.decor.runoffs.at(-1), [f, w] = z.points[2]; return versEcran(posZone(z, f, w).x, posZone(z, f, w).y); });
  await glisse(pz, { x: pz.x, y: pz.y - 30 });
  const w2 = await p.evaluate(() => DEC.decor.runoffs.at(-1).points[2][1]);
  ok(Math.abs(w2 - 9) > 1, `glisser un point de zone change la largeur (${w2} m)`);
  await capture('03-hors-piste');

  /* --- Barrières : tracer, couper --- */
  await outil('barrieres', 'tracer');
  const bp = await p.evaluate(() => [0.43, 0.435, 0.44].map((f) => { const T = DEC.track, s = f * T.length, q = T.pos(s, -(T.hwRightAt(s) + 6)); return versEcran(q.x, q.y); }));
  await vise(0.435, 0, 3);
  const bp2 = await p.evaluate(() => [0.43, 0.435, 0.44].map((f) => { const T = DEC.track, s = f * T.length, q = T.pos(s, -(T.hwRightAt(s) + 6)); return versEcran(q.x, q.y); }));
  void bp;
  for (const q of bp2) { await p.mouse.click(q.x, q.y); await p.waitForTimeout(60); }
  await p.keyboard.press('Enter'); await pret();
  const trait = await p.evaluate(() => (DEC.decor.barrierPaths || []).at(-1));
  ok(trait && trait.side === -1 && trait.pts.length === 3 && trait.from < trait.to, 'Tracer : un trait de barrière à droite, dans le sens du tour');
  ok(await p.evaluate(() => DEC.track.barriers.some((b) => b.drawn)), 'le moteur pose le trait comme barrière');
  await outil('barrieres', 'couper');
  const cut = await p.evaluate(() => { const b = DEC.track.barriers.find((b) => !b.drawn && b.side === 1 && b.s > 0.6 * DEC.track.length); return { x: (b.ax + b.bx) / 2, y: (b.ay + b.by) / 2 }; });
  await p.evaluate(([x, y]) => { const r = DEC.rendu; r.cam.zoom = 6; r.cam.x = x - 25; r.cam.y = y; peindre(); }, [cut.x, cut.y]);
  await p.waitForTimeout(120);
  const qc = await ecran(cut.x, cut.y);
  const nb = await p.evaluate(() => DEC.track.barriers.length);
  await p.mouse.click(qc.x, qc.y); await pret(); await p.waitForTimeout(150);
  ok(await p.evaluate((n) => (DEC.decor.barrierCuts || []).length === 1 && DEC.track.barriers.length < n, nb), 'Couper : un morceau de barrière retiré');
  await capture('04-barrieres');

  /* --- Zones d'implantation : agrandir un bois à la poignée --- */
  await outil('zones');
  const zi = await p.evaluate(() => DEC.decor.implantation.findIndex((z) => z.kind === 'bois'));
  await p.evaluate((zi) => { DEC.sel = { outil: 'zones', zone: zi }; majFiche(); const z = DEC.decor.implantation[zi], T = DEC.track, [s0, s1] = implSpan(T, z), q = T.pos(T.wrap((s0 + s1) / 2), 0), r = DEC.rendu; r.cam.zoom = 1.5; r.cam.x = q.x - 100; r.cam.y = q.y; peindre(); }, zi);
  await p.waitForTimeout(150);
  const prof0 = await p.evaluate((zi) => DEC.decor.implantation[zi].prof, zi);
  const hp = await p.evaluate((zi) => { const h = poignéesZone(DEC.decor.implantation[zi]).find((h) => h.role === 'prof'); return versEcran(h.p.x, h.p.y); }, zi);
  const dir = await p.evaluate((zi) => { const z = DEC.decor.implantation[zi], T = DEC.track, [s0, s1] = implSpan(T, z), m = T.wrap((s0 + s1) / 2), i = T.idx(m); return { x: T.nx[i] * z.side, y: T.ny[i] * z.side }; }, zi);
  await glisse(hp, { x: hp.x + dir.x * 30, y: hp.y + dir.y * 30 });
  const prof1 = await p.evaluate((zi) => DEC.decor.implantation[zi].prof, zi);
  ok(prof1 > prof0 + 5, `poignée P : la profondeur du bois passe de ${prof0} à ${prof1} m`);
  await capture('05-zones');

  /* --- Stands : avancer l'entrée --- */
  await outil('stands');
  await p.evaluate(() => { const T = DEC.track, q = T.pos(T.pit.entree, 0), r = DEC.rendu; r.cam.zoom = 2.5; r.cam.x = q.x - 60; r.cam.y = q.y; peindre(); });
  await p.waitForTimeout(150);
  const he = await p.evaluate(() => { const h = poignéesStands().find((h) => h.role === 'entree'); return versEcran(h.p.x, h.p.y); });
  const e0 = await p.evaluate(() => DEC.track.pit.entree);
  const tan = await p.evaluate(() => { const T = DEC.track, i = T.idx(T.pit.entree); return { x: Math.cos(T.th[i]), y: Math.sin(T.th[i]) }; });
  await glisse(he, { x: he.x + tan.x * 50, y: he.y + tan.y * 50 });
  const e1 = await p.evaluate(() => DEC.track.pit.entree);
  ok(Math.abs(e1 - e0) > 8 && (await p.evaluate(() => DEC.decor.pitFrom != null)), `poignée E : l’entrée des stands avance de ${Math.round(e1 - e0)} m`);
  await capture('06-stands');

  /* --- Enregistrer : la base, puis le jeu --- */
  const attendu = await p.evaluate(() => ecartAuFichier(DEC.def0, DEC.decor));
  await p.click('#d-poser'); await p.waitForTimeout(400);
  const rec = await p.evaluate(() => Store.get('decor', 'monza'));
  ok(rec && JSON.stringify(rec.decor) === JSON.stringify(attendu), `Enregistrer : la reprise est dans la base (${Object.keys(attendu).join(', ')})`);

  /* --- Fabriquer tracks.js --- */
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#d-fichier')]);
  const fichier = path.join(require('os').tmpdir(), 'tracks-decor-e2e.js');
  await dl.saveAs(fichier);
  const c = vm.createContext({ console, Math });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/traces.js'), 'utf8') + '\n' + fs.readFileSync(fichier, 'utf8') + '\n;this.T = TRACKS;', c);
  const c0 = vm.createContext({ console, Math });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/traces.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'js/tracks.js'), 'utf8') + '\n;this.T = TRACKS;', c0);
  const m = c.T.find((t) => t.id === 'monza');
  const r4 = (v) => JSON.stringify(v, (k, x) => (typeof x === 'number' ? Math.round(x * 1e4) / 1e4 : x));
  ok(c.T.length === c0.T.length, `le fichier fabriqué s’évalue et garde ses ${c.T.length} circuits`);
  ok(Object.entries(attendu).every(([k, v]) => r4(m[k] == null ? null : m[k]) === r4(v)), 'Monza y porte exactement la reprise');
  ok(c.T.filter((t) => t.id !== 'monza').every((t) => r4(t) === r4(c0.T.find((u) => u.id === t.id))), 'les autres circuits sont inchangés');

  /* --- Le jeu joue la reprise --- */
  const jeu = await ctx.newPage();
  jeu.on('pageerror', (e) => erreurs.push('jeu : ' + e.message));
  await jeu.goto(base + '/index.html');
  await jeu.waitForFunction(() => typeof app !== 'undefined' && app.custom && app.custom.decor && app.custom.decor.has('monza'), null, { timeout: 20000 });
  const vu = await jeu.evaluate(() => { const d = app.trackDefById('monza'); return { pitFrom: d.pitFrom, local: d.decorLocal, objets: !!d.objets }; });
  ok(vu.local && vu.pitFrom === attendu.pitFrom && vu.objets, 'le jeu joue la reprise de ce poste, et la marque locale (hors tableau mondial)');
  await jeu.close();

  /* --- Revenir au fichier --- */
  await p.click('#d-oublier'); await p.waitForTimeout(800);
  ok(!(await p.evaluate(() => Store.get('decor', 'monza'))) && (await p.evaluate(() => !DEC.decor.objets && !DEC.decor.barrierCuts)), 'Revenir au fichier : la reprise est oubliée');

  /* --- Un autre circuit s'ouvre, mobile compris --- */
  await p.selectOption('#d-circuit', 'monaco');
  await p.waitForFunction(() => DEC.id === 'monaco' && DEC.track && DEC.track.def.id === 'monaco');
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => tousObjets().length > 0 && DEC.decor.barrierPaths.length > 0), 'Monaco : objets et traits de barrière chargés');
  await capture('07-monaco');

  /* --- Un circuit perso : son décor voyage avec lui, et le tracé ne l'efface pas --- */
  const perso = await nav.newPage({ viewport: { width: 1440, height: 900 } });
  perso.on('pageerror', (e) => erreurs.push('perso : ' + e.message));
  perso.on('dialog', (d) => d.accept());
  await perso.goto(base + '/editor.html');
  await perso.waitForFunction(() => typeof ed !== 'undefined' && ed.doc);
  await perso.evaluate(() => {
    ed.doc.name = 'Ovale e2e'; ed.doc.lengthM = 1200;
    ed.doc.lines.racing = [[0, 0], [600, 0], [800, 200], [600, 400], [0, 400], [-200, 200]];
    fillForm();
  });
  await perso.click('#btn-save'); await perso.waitForTimeout(400);
  const idPerso = await perso.evaluate(() => ed.doc.id);
  await perso.click('#mode-decor');
  await perso.waitForFunction((id) => DEC.track && DEC.id === id && DEC.perso, idPerso, { timeout: 20000 });
  await perso.waitForTimeout(300);
  await perso.click('#d-fiche [data-mode="ajouter"]');
  await perso.selectOption('#d-ajout', 'tribune');
  const qt = await perso.evaluate(() => { const T = DEC.track, q = T.pos(0.25 * T.length, T.hwLeftAt(0.25 * T.length) + 30); return versEcran(q.x, q.y); });
  await perso.mouse.click(qt.x, qt.y); await perso.waitForTimeout(300);
  await perso.click('#d-poser'); await perso.waitForTimeout(400);
  ok(await perso.evaluate((id) => Store.get('tracks', id).then((d) => !!(d.objets && d.objets.ajouts.some((a) => a.type === 'tribune'))), idPerso),
    'circuit perso : la tribune ajoutée est enregistrée dans le circuit');
  await perso.click('#mode-trace'); await perso.waitForTimeout(200);
  await perso.click('#btn-save'); await perso.waitForTimeout(400);
  ok(await perso.evaluate((id) => Store.get('tracks', id).then((d) => !!(d.objets && d.objets.ajouts.length)), idPerso),
    'circuit perso : réenregistrer le tracé garde le décor');
  await perso.close();

  /* --- Au téléphone : le panneau en haut, la carte dessous --- */
  const tel = await nav.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  tel.on('pageerror', (e) => erreurs.push('téléphone : ' + e.message));
  await tel.goto(base + '/editor.html?decor=spa');
  await tel.waitForFunction(() => DEC.track && DEC.id === 'spa', null, { timeout: 30000 });
  await tel.waitForTimeout(500);
  const bas = await tel.evaluate(() => document.getElementById('panel').getBoundingClientRect().bottom);
  ok(bas > 200 && bas < 844 * 0.5, `téléphone : panneau en haut (${Math.round(bas)} px), carte visible dessous`);
  if (CAPT) await tel.screenshot({ path: path.join(CAPT, '08-mobile.png') });
  await tel.close();

  ok(!erreurs.length, 'aucune erreur de page' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  await nav.close(); srv.close();
  console.log(fautes ? `${fautes} échec(s)` : 'OK');
  process.exit(fautes ? 1 : 0);
})();
