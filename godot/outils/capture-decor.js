/* Capture le décor fixe d'un circuit, tel que le jeu web le peint, dans un fichier d'ordres.

     NODE_PATH=$(npm root -g) node godot/outils/capture-decor.js [circuit]   # spa par défaut

Le jeu est ouvert dans Chromium (Playwright), une course est lancée puis figée, et les deux passes
de dessin du monde fixe — le sol et la route, puis le décor et les protections — sont rejouées sur
`EnregistreurCtx` (enregistreur.js) au lieu d'un canevas. Ce sont exactement les morceaux que
js/static-backdrop.js découpe déjà dans `Renderer.draw` pour son fond précalculé : on reprend les
mêmes repères, et si le jeu change au point de les perdre, la capture s'arrête plutôt que de
rendre un décor incomplet.

Sortie : /tmp/…/decor-<circuit>.json (les ordres), lu par godot/outils/maille-decor.js. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');
const CIRCUIT = process.argv[2] || 'spa';
const OUT = process.env.DECOR_TMP || path.join(os.tmpdir(), 'grip-decor');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = http.createServer((q, s) => {
    let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html';
    const f = path.join(ROOT, u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(s);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: 1280, height: 720 } });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.addInitScript({ path: path.join(__dirname, 'enregistreur.js') });
  await page.goto(`http://127.0.0.1:${srv.address().port}`);
  await page.waitForFunction(() => typeof app !== 'undefined' && app.save && typeof TRACKS !== 'undefined');
  await page.evaluate(() => { app.save.name = 'Export'; app.mondial = null; storeSave(app.save); });
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.evaluate((id) => {
    app.startQuick('timetrial', 'gt', id);
    app.gele = true;
    const vrai = Renderer.prototype.draw;
    Renderer.prototype._vraiDraw = vrai;
    Renderer.prototype.draw = function (race, ui) { if (!app.gele) vrai.call(this, race, ui); };
  }, CIRCUIT);
  await page.waitForFunction(() => app.race && app.renderer && app.renderer.paths);
  await page.waitForTimeout(800);

  const verifier = process.argv.includes('--verifie');
  const res = await page.evaluate((verifier) => {
    const r = app.renderer, race = app.race, T = race.track;
    // Les deux passes du monde fixe, découpées dans Renderer.draw comme le fait static-backdrop.js.
    const source = r._vraiDraw.toString();
    const debut = source.indexOf('    // background'), fin = source.indexOf('    if (this.showLines)', debut);
    const grille = "    if(this.circuitGraphics)this.circuitGraphics.drawGrid(g);\n    this._drawStartLine(g, T);\n    this._drawBoards(g, T, vis); // chiffres et flèches de gameplay conservés, sans panneau ajouté";
    const ds = source.indexOf('    this._drawTas(g, vis);'), de = source.indexOf('    for (const p of this.paths.passerelles)', ds);
    if (debut < 0 || fin < debut || ds < fin || de < ds || !source.includes(grille)) throw Error('Renderer.draw a changé : repères des passes fixes introuvables');
    const prelude = 'const T=race.track,cam=this.cam,W=this.w,H=this.h;const inView=b=>!(b.maxX<vis.minX||b.minX>vis.maxX||b.maxY<vis.minY||b.minY>vis.maxY);';
    const sol = new Function('g', 'vis', 'race', 'ui', prelude + source.slice(debut, fin).replace('drawYellowFlagZones(g,race,p=>p,T.halfWidth*2,.55);', '') + grille);
    const decor = new Function('g', 'vis', 'race', 'ui', prelude + source.slice(ds, de));
    /* Deux couches de plus, pour les circuits qui passent au-dessus d'eux-mêmes : le tablier d'un
    croisement, peint par-dessus les voitures qui passent dessous et sous celles qui roulent
    dessus ; puis les passerelles et les têtes de tunnel, par-dessus toutes les voitures. */
    const pd = source.indexOf('    if (T.drawRoad) for (const b of this.paths.bridges) {'), pf = source.indexOf('    for (const car of dessus)', pd);
    const hd = source.indexOf('    for (const p of this.paths.passerelles)', pf), hf = source.indexOf('    if(!race.opts.spectator||', hd);
    if (pd < de || pf < pd || hf < hd) throw Error('Renderer.draw a changé : repères des ponts introuvables');
    const prePont = prelude + 'const pont=this.paths.bridges.length?T.crossings:[];';
    const ponts = new Function('g', 'vis', 'race', 'ui', prePont + source.slice(pd, pf));
    const dessus = new Function('g', 'vis', 'race', 'ui', prePont + source.slice(hd, hf));
    // Le cadre : la route, ses dégagements et les protections, plus une marge pour le décor.
    const b = { ...T.bounds };
    const inclure = (x, y) => { b.minX = Math.min(b.minX, x); b.maxX = Math.max(b.maxX, x); b.minY = Math.min(b.minY, y); b.maxY = Math.max(b.maxY, y); };
    for (const w of T.barriers) { inclure(w.ax, w.ay); inclure(w.bx, w.by); }
    const MARGE = 120;
    const vis = { minX: b.minX - MARGE, minY: b.minY - MARGE, maxX: b.maxX + MARGE, maxY: b.maxY + MARGE };
    const cam = r.cam, w = r.w, h = r.h, sansVoitures = race.cars.slice();
    const ZOOM = 24, g = new EnregistreurCtx(1280, 720, ZOOM * r.dpr);
    const couches = {};
    try {
      race.cars.length = 0;
      // Le niveau de détail est celui d'une course (certaines textures ne se peignent qu'au-delà
      // d'un zoom), et les caches de dessin sont coupés pour que tout passe par le contexte.
      r.cam = { ...cam, x: (vis.minX + vis.maxX) / 2, y: (vis.minY + vis.maxY) / 2, zoom: ZOOM };
      // Certaines passes (les protections) trient d'après l'écran et non d'après `vis` : un écran
      // assez grand pour couvrir tout le circuit les laisse tout peindre.
      r.w = r.h = 2 * ZOOM * Math.hypot(vis.maxX - vis.minX, vis.maxY - vis.minY);
      r.testBarrierCache = r.testSceneCache = false; r._barrFusionCle = null;
      for (const [nom, fn] of [['sol', sol], ['decor', decor], ['ponts', ponts], ['dessus', dessus]]) {
        const n0 = g.prims.length;
        g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
        fn.call(r, g, vis, race, null);
        g.restore();
        couches[nom] = [n0, g.prims.length];
      }
    } finally { r.cam = cam; r.w = w; r.h = h; race.cars.push(...sansVoitures); }
    // Les images employées, en PNG (pour la vérification), et rangées dans un ATLAS : une seule
    // texture pour tout le décor, chaque image ramenée à DENSITE pixels par mètre au plus. Une
    // case blanche, en haut à gauche, sert aux formes de couleur unie.
    const images = [], DENSITE = 40, BORD = 2, LARGE = 4096;
    const densite = new Map();
    for (const p of g.prims) if (p.t === 'i') {
      const q = p.q, w = Math.hypot(q[2] - q[0], q[3] - q[1]), h = Math.hypot(q[6] - q[0], q[7] - q[1]);
      densite.set(p.img, Math.max(densite.get(p.img) || 0, p.src[2] / Math.max(w, 1e-6), p.src[3] / Math.max(h, 1e-6)));
    }
    for (const [img, id] of g.images) {
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const cv = document.createElement('canvas'); cv.width = iw; cv.height = ih;
      cv.getContext('2d').drawImage(img, 0, 0);
      const f = Math.min(1, DENSITE / (densite.get(id) || DENSITE));
      images[id] = { w: iw, h: ih, f, aw: Math.max(1, Math.round(iw * f)), ah: Math.max(1, Math.round(ih * f)),
        png: verifier ? cv.toDataURL('image/png').split(',')[1] : null, cv };
    }
    // Rangement en étagères, des plus hautes aux plus basses.
    const ordre = images.map((im, id) => id).sort((a, b) => images[b].ah - images[a].ah);
    let x = 8 + BORD, y = BORD, haut = 8;
    for (const id of ordre) {
      const im = images[id];
      if (x + im.aw + BORD > LARGE) { x = BORD; y += haut + 2 * BORD; haut = 0; }
      im.ax = x; im.ay = y; x += im.aw + 2 * BORD; haut = Math.max(haut, im.ah);
    }
    const atlasH = Math.pow(2, Math.ceil(Math.log2(y + haut + BORD)));
    const atlas = document.createElement('canvas'); atlas.width = LARGE; atlas.height = atlasH;
    const ga = atlas.getContext('2d');
    ga.fillStyle = '#fff'; ga.fillRect(0, 0, 6, 6);
    ga.imageSmoothingQuality = 'high';
    for (const im of images) { ga.drawImage(im.cv, im.ax, im.ay, im.aw, im.ah); delete im.cv; }
    const atlasPng = atlas.toDataURL('image/png').split(',')[1];
    const PAL_ = typeof PAL !== 'undefined' ? PAL : {};
    return { circuit: T.id, nom: T.name, vis, couches, prims: g.prims, clips: g.clips, images, inconnus: g.inconnus,
      atlas: { w: LARGE, h: atlasH, png: atlasPng, blanc: [3, 3] },
      fond: PAL_.grass || '#4e7a3a', bornes: T.bounds, detail: r.detail };
  }, verifier);
  fs.writeFileSync(path.join(OUT, `decor-${CIRCUIT}-atlas.png`), Buffer.from(res.atlas.png, 'base64'));
  console.log(`atlas ${res.atlas.w} × ${res.atlas.h}`);
  if (verifier) await verifie(page, res);
  delete res.atlas.png;
  for (const im of res.images) delete im.png;
  const fichier = path.join(OUT, `decor-${CIRCUIT}.json`);
  fs.writeFileSync(fichier, JSON.stringify(res));
  const parType = {};
  for (const p of res.prims) parType[p.t] = (parType[p.t] || 0) + 1;
  console.log(`${res.nom} : ${res.prims.length} ordres (${Object.entries(parType).map(([k, v]) => k + ' ' + v).join(', ')}), ${res.clips.length} découpes, ${res.images.length} images`);
  console.log('détail', res.detail, 'couches', JSON.stringify(res.couches), 'cadre', JSON.stringify(res.vis));
  console.log('non rendus :', JSON.stringify(res.inconnus));
  console.log('images :', res.images.map((i) => i.w + 'x' + i.h).join(' '));
  console.log('→', fichier, (fs.statSync(fichier).size / 1e6).toFixed(1), 'Mo');
  await nav.close(); srv.close();
  if (erreurs.length) { console.log('ERREURS', erreurs); process.exit(1); }
})();

/* La preuve que l'enregistrement est fidèle : la même vue peinte deux fois dans la page, par le jeu
puis à partir des ordres notés, et l'écart compté pixel par pixel. */
async function verifie(page, res) {
  const r = await page.evaluate(async (res) => {
    const r = app.renderer, race = app.race, T = race.track, W = 1280, H = 720;
    const p0 = race.player, Z = 22, cx = p0.x + 30, cy = p0.y;
    const vue = (g) => { g.setTransform(Z, 0, 0, Z, W / 2 - Z * cx, H / 2 - Z * cy); };
    const source = r._vraiDraw.toString();
    const debut = source.indexOf('    // background'), fin = source.indexOf('    if (this.showLines)', debut);
    const grille = "    if(this.circuitGraphics)this.circuitGraphics.drawGrid(g);\n    this._drawStartLine(g, T);\n    this._drawBoards(g, T, vis); // chiffres et flèches de gameplay conservés, sans panneau ajouté";
    const ds = source.indexOf('    this._drawTas(g, vis);'), de = source.indexOf('    for (const p of this.paths.passerelles)', ds);
    const prelude = 'const T=race.track,cam=this.cam,W=this.w,H=this.h;const inView=b=>!(b.maxX<vis.minX||b.minX>vis.maxX||b.maxY<vis.minY||b.minY>vis.maxY);';
    const sol = new Function('g', 'vis', 'race', 'ui', prelude + source.slice(debut, fin).replace('drawYellowFlagZones(g,race,p=>p,T.halfWidth*2,.55);', '') + grille);
    const decor = new Function('g', 'vis', 'race', 'ui', prelude + source.slice(ds, de));
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const a = mk(), ga = a.getContext('2d');
    const cam = r.cam, dpr = r.dpr, sans = race.cars.slice(); race.cars.length = 0;
    r.cam = { ...cam, x: cx, y: cy, zoom: 24 }; r.dpr = Z / 24; r.testBarrierCache = r.testSceneCache = false; r._barrFusionCle = null;
    const vis = res.vis;
    vue(ga); ga.lineCap = 'round'; ga.lineJoin = 'round';
    sol.call(r, ga, vis, race, null); decor.call(r, ga, vis, race, null);
    r.cam = cam; r.dpr = dpr; race.cars.push(...sans);
    // Les ordres notés, repeints.
    const b = mk(), gb = b.getContext('2d');
    const imgs = await Promise.all(res.images.map((im) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + im.png; })));
    const rgba = (c) => `rgba(${c[0]},${c[1]},${c[2]},${c[3]})`;
    const chemin = (subs, ferme) => { const p = new Path2D(); for (const s of subs) { const pts = s.pts || s; p.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]); if (ferme || s.closed) p.closePath(); } return p; };
    const clipe = (id) => { if (id == null) return; const c = res.clips[id]; clipe(c.parent); gb.clip(chemin(c.subs, true), c.regle); };
    for (const p of res.prims) {
      gb.save(); vue(gb); clipe(p.clip);
      if (p.t === 'f') { gb.fillStyle = rgba(p.c); gb.fill(chemin(p.subs, true), p.regle); }
      else if (p.t === 's') { gb.strokeStyle = rgba(p.c); gb.lineWidth = p.w; gb.lineCap = p.cap; gb.lineJoin = p.join; gb.miterLimit = p.miter; gb.setLineDash(p.dash); gb.lineDashOffset = p.dashOff; gb.stroke(chemin(p.subs, false)); }
      else { const q = p.q, [sx, sy, sw, sh] = p.src; gb.transform((q[2] - q[0]) / sw, (q[3] - q[1]) / sw, (q[6] - q[0]) / sh, (q[7] - q[1]) / sh, q[0], q[1]); gb.globalAlpha = p.a; gb.drawImage(imgs[p.img], sx, sy, sw, sh, 0, 0, sw, sh); }
      gb.restore();
    }
    const da = ga.getImageData(0, 0, W, H).data, db = gb.getImageData(0, 0, W, H).data;
    let n5 = 0, n30 = 0, somme = 0;
    for (let i = 0; i < da.length; i += 4) { const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])); somme += d; if (d > 5) n5++; if (d > 30) n30++; }
    return { a: a.toDataURL('image/png'), b: b.toDataURL('image/png'), n5, n30, moyen: somme / (W * H) };
  }, res);
  for (const k of ['a', 'b']) fs.writeFileSync(path.join(OUT, `verif-${res.circuit}-${k}.png`), Buffer.from(r[k].split(',')[1], 'base64'));
  console.log(`vérification : ${(r.n5 / 9216).toFixed(2)} % des pixels à plus de 5 niveaux, ${(r.n30 / 9216).toFixed(2)} % à plus de 30, écart moyen ${r.moyen.toFixed(2)}`);
}
