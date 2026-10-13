/* LE CALQUE D'UN CIRCUIT : la route et ses flèches, sur fond transparent.

   À quoi ça sert. Peindre le décor à la main, dans un éditeur d'images, par-dessus un gabarit qui
   donne la forme EXACTE du bitume. Tout le reste de ce que le moteur dessine — l'herbe, le bac à
   gravier, les vibreurs, les lignes de rive, les glissières, le semis — est justement ce que le
   décor peint vient remplacer, donc le calque n'en garde rien.

   L'ÉCHELLE EST LA SEULE CHOSE QU'ON NE PEUT PAS RETROUVER APRÈS COUP. Une image réimportée sans
   son échelle est inexploitable : on ne sait plus de combien de mètres elle parle. Le fichier
   JSON écrit à côté porte donc tout ce qu'il faut pour le retour — pixels par mètre, boîte du
   monde, taille de l'image, et les trois nombres à recopier dans la définition du circuit.

   Le pas par défaut est de huit pixels par mètre. Le jeu en demande vingt-neuf à pleine
   résolution sur un téléphone, mais à vingt-neuf Zandvoort ferait cent quatre-vingts mégapixels :
   personne ne peint là-dedans. Huit donne une image de quatorze mégapixels, qui s'ouvre, et ça
   reste au-dessus des sept pixels par mètre des planches qu'on a essayées.

       node tools/calque.js <circuit> [pixelsParMetre] [marge en m]

   Chromium plafonne une toile vers seize mille pixels de côté : l'outil le dit plutôt que de
   rendre une image tronquée en silence.
*/
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'export', 'calques');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.webm': 'video/webm' };
const MAX_COTE = 16000;

(async () => {
  const id = process.argv[2] || 'zandvoort';
  const ppm = Number(process.argv[3] || 8);
  const marge = Number(process.argv[4] || 60);

  const srv = http.createServer((q, r) => {
    const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'index.html');
    fs.readFile(f, (e, d) => e ? (r.writeHead(404), r.end())
      : (r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }), r.end(d)));
  });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://127.0.0.1:${srv.address().port}`;

  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('  ERREUR ' + e.message));
  await page.goto(base);
  await page.waitForFunction(() => typeof app !== 'undefined' && app.save && typeof TRACKS !== 'undefined');
  await page.evaluate(() => { app.save.name = 'Calque'; app.mondial = null; storeSave(app.save); });
  await page.waitForTimeout(250);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);

  const connu = await page.evaluate((x) => TRACKS.some((t) => t.id === x), id);
  if (!connu) {
    const noms = await page.evaluate(() => TRACKS.map((t) => t.id).join(', '));
    console.log(`circuit inconnu : ${id}\ncircuits : ${noms}`);
    await nav.close(); srv.close(); process.exit(2);
  }

  // la boîte du monde, pour dimensionner la toile
  const b = await page.evaluate((x) => {
    const t = new Track(TRACKS.find((d) => d.id === x));
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let i = 0; i < t.n; i++) {
      x0 = Math.min(x0, t.xs[i]); x1 = Math.max(x1, t.xs[i]);
      y0 = Math.min(y0, t.ys[i]); y1 = Math.max(y1, t.ys[i]);
    }
    return { x0, x1, y0, y1, hw: t.halfWidth, nom: TRACKS.find((d) => d.id === x).name };
  }, id);

  const m = marge + b.hw;
  const monde = { x0: b.x0 - m, x1: b.x1 + m, y0: b.y0 - m, y1: b.y1 + m };
  const W = Math.ceil((monde.x1 - monde.x0) * ppm), H = Math.ceil((monde.y1 - monde.y0) * ppm);
  console.log(`${b.nom} : ${Math.round(monde.x1 - monde.x0)} x ${Math.round(monde.y1 - monde.y0)} m`
    + `  ->  ${W} x ${H} px à ${ppm} px/m  (${(W * H / 1e6).toFixed(1)} Mpx)`);
  if (W > MAX_COTE || H > MAX_COTE) {
    console.log(`\nTrop grand : Chromium plafonne une toile vers ${MAX_COTE} px de côté.`
      + `\nBaisse l'échelle — ${(MAX_COTE / Math.max(W, H) * ppm).toFixed(1)} px/m tiendrait.`);
    await nav.close(); srv.close(); process.exit(3);
  }

  await page.setViewportSize({ width: W, height: H });
  await page.evaluate((x) => {
    app.startQuick('timetrial', 'gt', x);
    app.gele = true;
    const vrai = Renderer.prototype.draw;
    Renderer.prototype._vraiDraw = vrai;
    Renderer.prototype.draw = function () {};
    Renderer.prototype._drawHUD = function () {};
  }, id);
  await page.waitForFunction(() => app.race && app.renderer && app.renderer.paths);
  await page.waitForTimeout(400);

  await page.evaluate(([cx, cy, z]) => {
    const r = app.renderer;
    app.race.cars.length = 0;
    r.calque = true;                 // la route et les flèches, rien d'autre
    r.dpr = 1; r.resize && r.resize();
    r.cam.zoom = z; r.cam.x = cx; r.cam.y = cy;
    r.rotate = false; r.camAngle = 0;
    r._vraiDraw.call(r, app.race, null);
  }, [(monde.x0 + monde.x1) / 2, (monde.y0 + monde.y1) / 2, ppm]);

  fs.mkdirSync(OUT, { recursive: true });
  const png = path.join(OUT, `${id}-calque.png`);
  /* ON LIT LA TOILE, PAS L'ÉCRAN. La capture d'un élément compose sur le fond de la page, et le
     jeu en a un : l'image sortait en RGB, sans canal alpha, c'est-à-dire exactement l'inverse de
     ce qu'on demande. `toDataURL` rend les pixels de la toile tels quels, transparence comprise. */
  const b64 = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png').split(',')[1]);
  fs.writeFileSync(png, Buffer.from(b64, 'base64'));

  const fiche = {
    circuit: id, nom: b.nom, pixelsParMetre: ppm,
    image: { largeur: W, hauteur: H },
    monde: { x0: monde.x0, y0: monde.y0, x1: monde.x1, y1: monde.y1 },
    /* À recopier tel quel dans la définition du circuit pour réimporter l'image peinte : une
       plaque centrée sur la boîte, à l'échelle de l'export, sans rotation. */
    plaqueDeRetour: {
      src: `art/decor/plaques/${id}-peint.webp`,
      x: +((monde.x0 + monde.x1) / 2).toFixed(2),
      y: +((monde.y0 + monde.y1) / 2).toFixed(2),
      m: +(monde.x1 - monde.x0).toFixed(2),
      hw: +((monde.y1 - monde.y0) / (monde.x1 - monde.x0)).toFixed(4),
      rot: 0,
    },
    aide: 'Peindre SOUS le calque, garder la taille de l\'image au pixel près, exporter en PNG ou WebP.',
  };
  fs.writeFileSync(path.join(OUT, `${id}-calque.json`), JSON.stringify(fiche, null, 1));
  console.log(`\n${png}\n${path.join(OUT, `${id}-calque.json`)}`);
  await nav.close(); srv.close();
})();
