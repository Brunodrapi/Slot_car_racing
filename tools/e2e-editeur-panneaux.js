// Les panneaux et la règle, dans l'éditeur de circuits (onglet « Panneaux »).
//
//   python3 -m http.server 8770 --bind 127.0.0.1 &   (à la racine du dépôt)
//   NODE_PATH=$(npm root -g) node tools/e2e-editeur-panneaux.js [http://127.0.0.1:8770]
//
// Bruno voulait tout reprendre au même endroit : trajectoires, largeur de piste, panneaux et mesure,
// objets. Depuis 0.52.31 l'éditeur n'a plus de mode « Tracé » et s'ouvre en quatre onglets. On
// vérifie, à Monaco, par l'interface :
// - l'éditeur s'ouvre sur les trajectoires, avec ses quatre onglets, et l'onglet « Objets » garde ses
//   cinq outils ;
// - l'onglet « Panneaux » montre les 35 panneaux du fichier ; toucher l'un d'eux le choisit, changer
//   son sens et sa valeur se voit dans la piste construite, et le glisser le fait courir le long du
//   tour ;
// - un appui sans glisser pose le viseur, « Ajouter au viseur » y pose un panneau, « Annuler » l'ôte ;
// - la règle mesure le long du tour et à vol d'oiseau ;
// - « Enregistrer », le rechargement et le jeu retrouvent la liste ; « Fabriquer tracks.js » l'emporte,
//   et « Revenir au fichier » l'oublie.
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
    const p = await ctx.newPage();
    const erreurs = [];
    p.on('pageerror', (e) => erreurs.push(e.message));
    p.on('dialog', (d) => d.accept());
    await p.goto(BASE + '/editor.html?decor=monaco');
    await p.waitForFunction(() => typeof DEC !== 'undefined' && DEC.track && DEC.id === 'monaco');
    await p.evaluate(async () => { await Store.del('panneaux', 'monaco'); await Store.del('lines', 'monaco'); await Store.del('decor', 'monaco'); });
    await p.reload();
    await p.waitForFunction(() => typeof DEC !== 'undefined' && DEC.track && DEC.id === 'monaco');

    // --- les onglets ---
    const ui = await p.evaluate(() => ({
      onglets: [...document.querySelectorAll('#d-onglets button')].map((x) => x.textContent),
      actif: document.querySelector('#d-onglets .sel').textContent, objetsCaches: document.getElementById('d-outils').hidden,
      trace: !!document.getElementById('mode-trace') }));
    ok(ui.onglets.join(',') === 'Trajectoires,Largeur de piste,Panneaux,Objets' && ui.actif === 'Trajectoires', `quatre onglets, l'éditeur s'ouvre sur les trajectoires (${ui.onglets.join(' · ')})`);
    ok(!ui.trace, 'plus de mode « Tracé »');
    await p.click('#d-onglets [data-onglet="objets"]');
    const objets = await p.evaluate(() => ({ visibles: !document.getElementById('d-outils').hidden, outils: [...document.querySelectorAll('#d-outils button')].map((x) => x.textContent) }));
    ok(ui.objetsCaches && objets.visibles && objets.outils.join(',') === 'Objets,Hors-piste,Barrières,Zones,Stands', `l'onglet « Objets » montre ses outils : ${objets.outils.join(' · ')}`);

    // --- les panneaux du fichier ---
    await p.click('#d-onglets [data-onglet="panneaux"]');
    const depart = await p.evaluate(() => ({ n: listePanneaux().length, fiche: document.getElementById('d-fiche').textContent, modif: DEC.panModif }));
    ok(depart.n === 35 && /35 panneaux/.test(depart.fiche) && /fichier/.test(depart.fiche), `les 35 panneaux du fichier (« ${depart.fiche.match(/\d+ panneaux[^.]*\./)[0]} »)`);
    // toucher le premier panneau
    const vers = async (k) => p.evaluate((k) => {
      const q = panneauxPoses()[k], r = DEC.rendu; r.cam.zoom = 6; r.cam.x = q.cx; r.cam.y = q.cy; peindre();
      return versEcran(q.cx, q.cy);
    }, k);
    let e = await vers(0);
    await p.waitForTimeout(150);
    await p.mouse.click(e.x, e.y); await p.waitForTimeout(200);
    const choisi = await p.evaluate(() => ({ sel: DEC.selP, fiche: document.getElementById('d-fiche').textContent, b: { ...listePanneaux()[0] } }));
    ok(choisi.sel === 0 && /Sens du virage/.test(choisi.fiche) && /Valeur annoncée/.test(choisi.fiche), 'toucher un panneau le choisit et ouvre sa fiche');
    const autreSens = choisi.b.sign > 0 ? -1 : 1;
    await p.click(`#d-fiche [data-sensp="${autreSens}"]`); await p.waitForTimeout(250);
    await p.click('#d-fiche [data-distp="200"]'); await p.waitForTimeout(250);
    const regle = await p.evaluate(() => { const b0 = listePanneaux()[0], jeu = DEC.track.boards[0]; return { sign: b0.sign, dist: b0.dist, jeuSign: jeu.sign, jeuDist: jeu.dist }; });
    ok(regle.sign === autreSens && regle.dist === 200 && regle.jeuSign === autreSens && regle.jeuDist === 200, 'sens et valeur changent, et la piste construite les peint');
    // le glisser de vingt mètres le long du tour
    e = await vers(0);
    const cible = await p.evaluate(() => { const T = DEC.track, b0 = listePanneaux()[0], j = Math.round(b0.at * T.n + 20) % T.n; return { j, ...versEcran(T.xs[j], T.ys[j]) }; });
    const at0 = await p.evaluate(() => listePanneaux()[0].at);
    await p.mouse.move(e.x, e.y); await p.mouse.down(); await p.mouse.move(cible.x, cible.y, { steps: 8 }); await p.mouse.up();
    await p.waitForTimeout(300);
    const glisse = await p.evaluate((at0) => { const T = DEC.track; return ((listePanneaux()[0].at - at0) * T.n * T.ds); }, at0);
    ok(Math.abs(glisse - 20) < 2, `glissé, il court le long du tour (${glisse.toFixed(1)} m)`);

    // --- viseur, ajout, annulation ---
    const vis = await p.evaluate(() => { const T = DEC.track, j = Math.round(T.n * 0.5); const r = DEC.rendu; r.cam.x = T.xs[j]; r.cam.y = T.ys[j]; peindre(); return { j, ...versEcran(T.xs[j], T.ys[j]) }; });
    await p.waitForTimeout(150);
    await p.mouse.click(vis.x, vis.y); await p.waitForTimeout(200);
    ok(await p.evaluate((j) => Math.abs(DEC.viseur - j) <= 2, vis.j), 'un appui sans glisser pose le viseur');
    await p.click('#d-pan-ajout'); await p.waitForTimeout(250);
    ok(await p.evaluate(() => listePanneaux().length === 36 && DEC.selP === 35), '« Ajouter au viseur » pose un 36e panneau, choisi');
    await p.click('#d-annuler'); await p.waitForTimeout(250);
    ok(await p.evaluate(() => listePanneaux().length === 35), '« Annuler » l\'ôte');

    // --- la règle ---
    await p.click('#d-fiche [data-souspan="mesure"]');
    const ab = await p.evaluate(() => {
      const T = DEC.track, a = Math.round(T.n * 0.30), c = a + 60, r = DEC.rendu; r.cam.zoom = 4; r.cam.x = T.xs[a]; r.cam.y = T.ys[a]; peindre();
      return { a, c, pa: versEcran(T.xs[a], T.ys[a]), pc: versEcran(T.xs[c], T.ys[c]), droit: Math.hypot(T.xs[c] - T.xs[a], T.ys[c] - T.ys[a]) };
    });
    await p.waitForTimeout(150);
    await p.mouse.click(ab.pa.x, ab.pa.y); await p.waitForTimeout(150);
    await p.mouse.click(ab.pc.x, ab.pc.y); await p.waitForTimeout(200);
    const m = await p.evaluate(() => document.getElementById('d-fiche').textContent);
    const long = +(m.match(/([\d.]+) m le long du tour/) || [])[1], droit = +(m.match(/([\d.]+) m à vol d’oiseau/) || [])[1];
    ok(Math.abs(long - 60) < 3 && Math.abs(droit - ab.droit) < 3, `la règle : ${long} m le long du tour, ${droit} m à vol d'oiseau`);

    // --- enregistrer, recharger, jouer ---
    const voulu = await p.evaluate(() => panneauxPlats());
    await p.click('#d-poser'); await p.waitForFunction(() => !DEC.modif);
    await p.reload();
    await p.waitForFunction(() => typeof DEC !== 'undefined' && DEC.track && DEC.id === 'monaco');
    const relu = await p.evaluate(() => ({ liste: panneauxPlats(), origine: DEC.panOrigine }));
    ok(JSON.stringify(relu.liste) === JSON.stringify(voulu) && /poste/.test(relu.origine), 'après rechargement, la liste retouchée est là, « enregistrés sur ce poste »');
    const g = await ctx.newPage();
    g.on('pageerror', (x) => erreurs.push(x.message));
    await g.goto(BASE + '/index.html');
    await g.waitForFunction(() => typeof app !== 'undefined' && app.custom && app.custom.panneaux && app.custom.panneaux.has('monaco'), null, { timeout: 15000 });
    const jeu = await g.evaluate(() => { const T = app.trackCache('monaco'); return { n: T.boards.length, b0: [T.boards[0].sign, T.boards[0].dist] }; });
    ok(jeu.n === 35 && jeu.b0[0] === voulu[0][3] && jeu.b0[1] === 200, 'le jeu joue ces panneaux');
    await g.close();

    // --- un seul fichier, puis l'oubli ---
    const dl = p.waitForEvent('download');
    await p.click('#d-fichier');
    let txt = ''; for await (const c of await (await dl).createReadStream()) txt += c;
    const d = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/traces.js'), 'utf8') + '\n' + txt + ';TRACKS.find(t=>t.id==="monaco")');
    ok(JSON.stringify(d.panneaux) === JSON.stringify(voulu), 'tracks.js fabriqué porte la liste retouchée');
    await p.click('#d-oublier');
    const oubli = await p.evaluate(async () => {
      for (let k = 0; k < 50; k++) { if (!(await Store.get('panneaux', 'monaco')) && DEC.panOrigine === 'ceux du fichier.') break; await new Promise((r) => setTimeout(r, 100)); }
      return { base: await Store.get('panneaux', 'monaco'), n: listePanneaux().length, b0: panneauxPlats()[0] };
    });
    const fichier = await p.evaluate(() => TRACKS.find((t) => t.id === 'monaco').panneaux[0]);
    ok(!oubli.base && oubli.n === 35 && JSON.stringify(oubli.b0) === JSON.stringify(fichier), '« Revenir au fichier » rend la liste du fichier');
    ok(!erreurs.length, 'aucune erreur de page' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } finally {
    await b.close();
  }
  console.log(fautes ? `${fautes} faute(s)` : 'OK');
  process.exitCode = fautes ? 1 : 0;
})();
