// Les données de la maquette, sorties du jeu lui-même : circuits (fiche, illustration, tracé de jour et
// de nuit), catégories, voitures, livrées et leurs images, niveaux de difficulté.
//
//   node essais/maquette-paddock/outils/exporte.cjs        (depuis la racine du dépôt, Playwright installé)
//
// Écrit essais/maquette-paddock/donnees.json et les tracés dans essais/maquette-paddock/traces/.
// Les chemins d'images sont relatifs à la racine du site : la maquette les lit par « ../../ ».
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const RACINE = path.resolve(__dirname, '../../..'), ICI = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ttf': 'font/ttf' };
(async () => {
  const srv = http.createServer((q, s) => {
    const f = path.join(RACINE, decodeURIComponent(q.url.split('?')[0]));
    if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.route(/^https:\/\//, (r) => r.abort());
  await p.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
  await p.waitForFunction(() => window.app && app.ui && app.save);
  const d = await p.evaluate(() => {
    app.save.lang = 'fr'; app.ui.lang = 'fr';
    const ui = app.ui, t = (k) => ui.t(k);
    const pays = new Intl.DisplayNames(['fr'], { type: 'region' });
    const circuits = TRACKS.map((tr) => {
      const c = app.trackCache(tr.id), virages = c.corners;
      const rayon = c.k.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      const droite = virages.reduce((m, v, i) => Math.max(m, (virages[i + 1]?.from ?? virages[0].from + c.n) - v.to), 0) * c.ds;
      return {
        id: tr.id, nom: tr.name, pays: tr.country ? pays.of(tr.country) : '', code: String(tr.country || '').toLowerCase(),
        longueur: Math.round(c.length), virages: virages.length,
        difficulte: tr.difficulty ?? Math.max(1, Math.min(4, Math.ceil(virages.length * 400 / c.length))),
        rayon: rayon ? Math.round(10 / rayon) / 10 : null, droite: droite > 0 ? Math.round(droite) : null,
        pointe: tr.pointe ? { kmh: tr.pointe.kmh, voiture: modelById(tr.pointe.voiture).name } : null,
        art: ui.circuitArt(tr).split('?')[0], trace: ui.thumb(tr, 360, false), traceNuit: ui.thumb(tr, 360, true),
      };
    });
    const categories = playableCategories().map((c) => ({ id: c.id, nom: ui.L(c.name) }));
    const voitures = MODELS.filter((m) => categories.some((c) => c.id === m.catId)).map((m) => {
      const n = Math.max(1, (m.livrees || []).length);
      const livrees = Array.from({ length: n }, (_, i) => {
        const lv = livreeDe(m, i);
        return { nom: lv && lv.nom ? nomLivree(lv, 'fr') : m.name, image: carArtUrl(lv && lv.pick ? lv.pick : m.pick).split('?')[0] };
      });
      return { id: m.id, nom: m.name, cat: m.catId, poids: m.weightKg || null,
        perf: { vmax: Math.round(m.perf.vmax), adherence: +m.perf.gripG.toFixed(2), acceleration: +m.perf.a100.toFixed(1), freinage: +m.perf.b100.toFixed(1) }, livrees };
    });
    const niveaux = NIVEAUX.map((n) => ({ id: n, nom: t(n) }));
    // le championnat : le barème de chaque catégorie, et sa phrase ; les noms des pilotes de l'IA
    const baremes = Object.fromEntries(categories.map((c) => [c.id, { points: BAREMES_CHAMPIONNAT[c.id] || POINTS, texte: t('bareme_' + Championnat.cleBareme(c.id)), pole: c.id !== 'f1' }]));
    const pilotes = AI_NAMES.slice();
    return { circuits, categories, voitures, niveaux, baremes, pilotes, version: typeof VERSION !== 'undefined' ? VERSION : '' };
  });
  fs.mkdirSync(path.join(ICI, 'traces'), { recursive: true });
  for (const c of d.circuits) {
    for (const [cle, suffixe] of [['trace', ''], ['traceNuit', '-nuit']]) {
      const m = /^data:image\/png;base64,(.*)$/.exec(c[cle] || '');
      if (m) { fs.writeFileSync(path.join(ICI, 'traces', c.id + suffixe + '.png'), Buffer.from(m[1], 'base64')); c[cle] = 'traces/' + c.id + suffixe + '.png'; }
      else c[cle] = '';
    }
  }
  fs.writeFileSync(path.join(ICI, 'donnees.json'), JSON.stringify(d, null, 1) + '\n');
  console.log(`${d.circuits.length} circuits, ${d.voitures.length} voitures, ${d.voitures.reduce((a, v) => a + v.livrees.length, 0)} livrées, ${d.niveaux.length} niveaux (jeu ${d.version})`);
  await b.close(); srv.close();
})();
