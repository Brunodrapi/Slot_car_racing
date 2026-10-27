// Une retouche du poste plus ancienne que le fichier ne compte plus.
//
//   python3 -m http.server 8770 --bind 127.0.0.1 &   (à la racine du dépôt)
//   NODE_PATH=$(npm root -g) node tools/e2e-retouches-perimees.js [http://127.0.0.1:8770]
//
// Le téléphone de Bruno jouait à Monaco des trajectoires enregistrées sur ce téléphone avant qu'il
// ne retrace les siennes et nous envoie le fichier : une retouche locale passait toujours devant
// `js/tracks.js`. Depuis 0.52.36, un circuit repris d'un fichier porte sa date (`revision`) et une
// retouche enregistrée avant ne s'applique plus. On vérifie, à Monaco :
// - qu'une trajectoire locale datée d'avant la reprise est ignorée par le jeu, qui joue le fichier ;
// - que l'éditeur l'ignore aussi, le dit, et que « Revenir au fichier » l'efface ;
// - qu'une trajectoire enregistrée après la reprise s'applique toujours.
'use strict';
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8770';
let fautes = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAUX  ') + m); if (!c) fautes++; };

(async () => {
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    const erreurs = [];
    p.on('pageerror', (e) => erreurs.push(e.message));
    p.on('dialog', (d) => d.accept());
    await p.goto(BASE + '/index.html');
    await p.waitForFunction(() => typeof app !== 'undefined' && app.save && app.custom);
    // une trajectoire décalée de trois mètres, datée d'avant la reprise du fichier
    const pose = (at) => p.evaluate(async (at) => {
      const def = TRACKS.find((t) => t.id === 'monaco');
      const decale = {}; for (const k of Object.keys(def.lines)) decale[k] = def.lines[k].map(([x, y]) => [x + 1, y]);
      await Store.put('lines', { id: 'monaco', at, lines: decale });
    }, at);
    const joue = () => p.evaluate(async () => {
      await app.refreshCustom(); app.tracks.delete('monaco');
      const T = app.trackCache('monaco'), f = TRACKS.find((t) => t.id === 'monaco');
      return { fichier: JSON.stringify(T.def.lines) === JSON.stringify(f.lines), revision: f.revision };
    });
    await pose(Date.parse('2026-10-01T00:00:00Z'));
    const a = await joue();
    ok(!!a.revision && a.fichier, `une trajectoire locale d'avant la reprise (${a.revision}) est ignorée : le jeu joue le fichier`);

    // l'éditeur l'ignore aussi, le dit, et « Revenir au fichier » l'efface
    const e = await ctx.newPage();
    e.on('pageerror', (x) => erreurs.push(x.message));
    e.on('dialog', (d) => d.accept());
    await e.goto(BASE + '/editor.html?decor=monaco');
    await e.waitForFunction(() => typeof DEC !== 'undefined' && DEC.track && DEC.id === 'monaco');
    const ed = await e.evaluate(() => ({ origine: DEC.lignesOrigine, etat: document.getElementById('d-etat').textContent,
      fichier: JSON.stringify(DEC.lignes) === JSON.stringify(TRACKS.find((t) => t.id === 'monaco').lines), oublier: !document.getElementById('d-oublier').disabled }));
    ok(ed.fichier && /fichier/.test(ed.origine), `l'éditeur montre les trajectoires du fichier (« ${ed.origine} »)`);
    ok(/plus anciennes que le fichier/.test(ed.etat) && /trajectoires/.test(ed.etat), `et le dit : « ${ed.etat} »`);
    await e.click('#d-oublier');
    const efface = await e.evaluate(async () => { for (let k = 0; k < 50 && await Store.get('lines', 'monaco'); k++) await new Promise((r) => setTimeout(r, 100)); return !(await Store.get('lines', 'monaco')); });
    ok(ed.oublier && efface, '« Revenir au fichier » l\'efface');
    await e.close();

    // une trajectoire enregistrée après la reprise s'applique toujours
    await pose(Date.now());
    const c = await joue();
    ok(!c.fichier, 'une trajectoire enregistrée après la reprise s\'applique');
    await p.evaluate(async () => { await Store.del('lines', 'monaco'); });
    ok(!erreurs.length, 'aucune erreur de page' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } finally {
    await b.close();
  }
  console.log(fautes ? `${fautes} faute(s)` : 'OK');
  process.exitCode = fautes ? 1 : 0;
})();
