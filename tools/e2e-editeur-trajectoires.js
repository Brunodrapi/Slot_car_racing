// Les trajectoires se reprennent dans l'éditeur de circuits, sur la piste retouchée.
//
//   python3 -m http.server 8770 --bind 127.0.0.1 &   (à la racine du dépôt)
//   NODE_PATH=$(npm root -g) node tools/e2e-editeur-trajectoires.js [http://127.0.0.1:8770]
//
// Bruno ne pouvait pas « modifier les lignes sur le même tracé que l'éditeur pour tout modifier d'un
// coup » : elles avaient leur outil à part, `lignes.html`, qui ne voyait pas les retouches du décor.
// L'outil « Trajectoires » du mode Décor les reprend sur la piste retouchée. On vérifie, à Monaco :
// - qu'un virage redessiné dans « Largeur de piste » emporte les trajectoires calculées avec lui ;
// - qu'un point glissé déplace la trajectoire que le jeu jouera, et qu'« Annuler » le remet ;
// - qu'« Enregistrer » range décor et trajectoires, que le rechargement les retrouve, et que le jeu
//   joue ces trajectoires-là ;
// - que « Fabriquer tracks.js » emporte les deux dans le même fichier ;
// - que « Revenir au fichier » oublie les deux.
'use strict';
const { chromium } = require('playwright');
const vm = require('vm'), fs = require('fs'), path = require('path');
const BASE = process.argv[2] || 'http://127.0.0.1:8770';
let fautes = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAUX  ') + m); if (!c) fautes++; };

(async () => {
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    // un Monaco sans trajectoires dessinées : le fichier en porte depuis 0.52.33, et l'on veut voir les
    // trajectoires calculées suivre le virage redessiné (le script seulement : « Fabriquer tracks.js »
    // relit le fichier tel quel)
    await ctx.route('**/js/tracks.js*', async (r) => {
      if (r.request().resourceType() !== 'script') return r.continue();
      const res = await r.fetch();
      await r.fulfill({ response: res, body: (await res.text()) + '\n;delete TRACKS.find((t) => t.id === "monaco").lines;\n' });
    });
    const p = await ctx.newPage();
    const erreurs = [];
    p.on('pageerror', (e) => erreurs.push(e.message));
    p.on('dialog', (d) => d.accept());
    await p.goto(BASE + '/editor.html?decor=monaco');
    await p.waitForFunction(() => typeof DEC !== 'undefined' && DEC.track && DEC.id === 'monaco');
    await p.evaluate(async () => { await Store.del('lines', 'monaco'); await Store.del('decor', 'monaco'); });
    await p.reload();
    await p.waitForFunction(() => typeof DEC !== 'undefined' && DEC.track && DEC.id === 'monaco');

    // --- un virage redessiné emporte les trajectoires calculées ---
    await p.click('[data-onglet="piste"]');
    const virage = await p.evaluate(() => {
      // sur un Monaco sans retouche de bords : le fichier peut en porter sur cette épingle (0.52.32)
      const base = new Track({ ...DEC.def0, roadWidenings: [] }, ECHELLE_ROUTE);
      let apex = 0; for (let i = 0; i < base.n; i++) if (Math.abs(base.k[i]) > Math.abs(base.k[apex])) apex = i;
      const f = apex / base.n, d = 25 / base.length, inner = base.k[apex] > 0 ? -1 : 1, hwIn = inner > 0 ? base.hwL[apex] : base.hwR[apex];
      changer(() => (DEC.decor.roadWidenings = []).push(
        { side: inner, followContour: true, points: [[f - d, 0], [f - d / 2, -(hwIn + 1) / 0.9], [f, -(hwIn + 4) / 0.9], [f + d / 2, -(hwIn + 1) / 0.9], [f + d, 0]] },
        { side: -inner, followContour: true, points: [[f - d, 0], [f - d / 2, 3 / 0.9], [f, 6 / 0.9], [f + d / 2, 3 / 0.9], [f + d, 0]] }));
      return { apex, x: base.xs[apex], y: base.ys[apex] };
    });
    await p.waitForFunction(() => DEC.track.axeBase && DEC.track.n !== DEC.track.axeBase.n);
    await p.click('[data-onglet="lignes"]');
    const calc = await p.evaluate(() => {
      const T = DEC.track; let hors = 0;
      for (const nom of ['racing', 'inside', 'outside']) for (let i = 0; i < T.n; i++) { const a = T.tracees[nom][i]; if (a > T.hwL[i] + 0.01 || a < -T.hwR[i] - 0.01) hors++; }
      return { lignes: DEC.lignes, points: pointsLigne('racing').length, hors, panneau: document.querySelector('#d-fiche').textContent };
    });
    ok(calc.lignes === null && calc.points >= 100, `trajectoires calculées sur la piste redessinée, ${calc.points} points par ligne`);
    ok(calc.hors === 0, 'elles restent dans la chaussée redessinée');
    ok(/Corde/.test(calc.panneau) && /Intérieure/.test(calc.panneau) && /Extérieure/.test(calc.panneau), 'la fiche offre les trois lignes');

    // --- glisser un point de la corde ---
    const prise = await p.evaluate((v) => {
      const pts = pointsLigne('racing').map(enMonde);
      let i = 0, bd = Infinity; pts.forEach((q, j) => { const d = Math.hypot(q.x - v.x, q.y - v.y); if (d < bd) { bd = d; i = j; } });
      const q = pts[i], T = DEC.track;
      // trois mètres vers la gauche de la piste à cet endroit
      const pr = T.project(q.x, q.y, 0, Math.ceil(T.n / 2) + 1), j = T.idx(pr.s), cible = { x: q.x + T.nx[j] * 3, y: q.y + T.ny[j] * 3 };
      const r = DEC.rendu; r.cam.zoom = 8; r.cam.x = q.x; r.cam.y = q.y; peindre();
      return { i, a: versEcran(q.x, q.y), b: versEcran(cible.x, cible.y), cible, s: pr.s, avant: T._lerp(T.tracees.racing, pr.s) };
    }, virage);
    await p.waitForTimeout(150);
    await p.mouse.move(prise.a.x, prise.a.y); await p.mouse.down();
    await p.mouse.move(prise.b.x, prise.b.y, { steps: 8 }); await p.mouse.up();
    await p.waitForTimeout(300);
    const apres = await p.evaluate((pr) => {
      const T = DEC.track, q = enMonde(DEC.lignes.racing[pr.i]), at = T.project(pr.cible.x, pr.cible.y, pr.s, 40).s;
      return { pose: Math.hypot(q.x - pr.cible.x, q.y - pr.cible.y), lat: T._lerp(T.tracees.racing, at), modif: DEC.modif };
    }, prise);
    ok(apres.pose < 0.2, `le point suit la souris (${(apres.pose * 100).toFixed(0)} cm)`);
    ok(apres.lat - prise.avant > 1, `la corde jouée se déplace à cet endroit (${prise.avant.toFixed(1)} → ${apres.lat.toFixed(1)} m de l'axe)`);
    await p.click('#d-annuler'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => DEC.lignes === null), '« Annuler » rend les trajectoires calculées');
    await p.click('#d-annuler'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => JSON.stringify(DEC.decor.roadWidenings || []) === JSON.stringify(DEC.def0.roadWidenings || [])), 'puis le virage d\'origine : décor et trajectoires dans la même annulation');

    // --- refaire les deux retouches, enregistrer, recharger ---
    await p.evaluate((v) => {
      const base = new Track({ ...DEC.def0, roadWidenings: [] }, ECHELLE_ROUTE), apex = v.apex;
      const f = apex / base.n, d = 25 / base.length, inner = base.k[apex] > 0 ? -1 : 1, hwIn = inner > 0 ? base.hwL[apex] : base.hwR[apex];
      changer(() => (DEC.decor.roadWidenings = []).push(
        { side: inner, followContour: true, points: [[f - d, 0], [f - d / 2, -(hwIn + 1) / 0.9], [f, -(hwIn + 4) / 0.9], [f + d / 2, -(hwIn + 1) / 0.9], [f + d, 0]] },
        { side: -inner, followContour: true, points: [[f - d, 0], [f - d / 2, 3 / 0.9], [f, 6 / 0.9], [f + d / 2, 3 / 0.9], [f + d, 0]] }));
    }, virage);
    await p.waitForTimeout(200);
    await p.mouse.move(prise.a.x, prise.a.y); await p.mouse.down();
    await p.mouse.move(prise.b.x, prise.b.y, { steps: 8 }); await p.mouse.up();
    await p.waitForTimeout(300);
    const voulu = await p.evaluate(() => arrondiLigne(DEC.lignes));
    await p.click('#d-poser'); await p.waitForFunction(() => !DEC.modif);
    await p.reload();
    await p.waitForFunction(() => typeof DEC !== 'undefined' && DEC.track && DEC.id === 'monaco');
    const relu = await p.evaluate(() => ({ lignes: DEC.lignes, contours: (DEC.decor.roadWidenings || []).filter((z) => z.followContour).length, recentre: DEC.track.n !== DEC.track.axeBase.n }));
    ok(JSON.stringify(relu.lignes) === JSON.stringify(voulu), 'après rechargement, les trajectoires retouchées sont là');
    ok(relu.contours === 2 && relu.recentre, 'et le virage redessiné aussi');

    // --- le jeu joue ces trajectoires ---
    const g = await ctx.newPage();
    g.on('pageerror', (e) => erreurs.push(e.message));
    await g.goto(BASE + '/index.html');
    await g.waitForFunction(() => typeof app !== 'undefined' && app.save && app.custom && app.custom.lines);
    await g.waitForFunction(() => app.custom.lines.has('monaco'), null, { timeout: 10000 }).catch(() => {});
    const jeu = await g.evaluate(() => { const T = app.trackCache('monaco'); return { lignes: !!T.def.lines, recentre: !!T.axeBase && T.n !== T.axeBase.n, ignorees: !!T.lignesIgnorees }; });
    ok(jeu.lignes && jeu.recentre && !jeu.ignorees, 'le jeu joue le virage redessiné avec ces trajectoires');
    await g.close();

    // --- un seul fichier pour les deux ---
    const dl = p.waitForEvent('download');
    await p.click('#d-fichier');
    const d = await dl;
    let txt = ''; for await (const c of await d.createReadStream()) txt += c;
    const T2 = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/traces.js'), 'utf8') + '\n' + txt + ';TRACKS.find(t=>t.id==="monaco")');
    ok(T2.lines && JSON.stringify(T2.lines.racing) === JSON.stringify(voulu.racing), 'tracks.js fabriqué porte les trajectoires retouchées');
    ok((T2.roadWidenings || []).filter((z) => z.followContour).length === 2, 'et le virage redessiné, dans le même fichier');

    // --- revenir au fichier ---
    await p.click('#d-oublier');
    // l'oubli passe par la base, asynchrone : on attend qu'il soit allé au bout
    const oubli = await p.evaluate(async () => {
      for (let k = 0; k < 50; k++) {
        const r = { lignes: await Store.get('lines', 'monaco'), decor: await Store.get('decor', 'monaco'), courant: DEC.lignes };
        if (!r.lignes && !r.decor && r.courant === null) return r;
        await new Promise((res) => setTimeout(res, 100));
      }
      return { lignes: await Store.get('lines', 'monaco'), decor: await Store.get('decor', 'monaco'), courant: DEC.lignes };
    });
    ok(!oubli.lignes && !oubli.decor && oubli.courant === null, '« Revenir au fichier » oublie décor et trajectoires');
    ok(!erreurs.length, 'aucune erreur de page' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } finally {
    await b.close();
  }
  console.log(fautes ? `${fautes} faute(s)` : 'OK');
  process.exitCode = fautes ? 1 : 0;
})();
