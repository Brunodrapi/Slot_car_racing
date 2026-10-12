/* LA PLANCHE DES OBJETS DU DÉCOR, comme une planche de sprites dessinée à la main.

   Retoucher un arbre en relançant l'export d'un circuit, c'est regarder un objet de soixante
   pixels perdu dans un champ : on ne voit pas ce qu'on change. La planche montre chaque objet en
   grand, dans la palette de chaque thème, ombre comprise — et la même grappe de lobes à l'échelle
   du jeu juste à côté, parce qu'un dessin qui ne tient qu'en grand ne sert à rien.

     NODE_PATH=$(npm root -g) node tools/planche-decor.js [sortie.png] [thème…]
*/
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'export', 'planche-objets.png');
const THEMES = process.argv.slice(3);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.ico': 'image/vnd.microsoft.icon', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp' };

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const srv = http.createServer((q, s) => {
    let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html';
    const f = path.join(ROOT, u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(s);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', (e) => console.log('ERREUR ' + e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/`);
  await page.waitForFunction(() => typeof THEME_DEFS !== 'undefined' && typeof buildTopArt !== 'undefined');

  const png = await page.evaluate((demandes) => {
    const noms = demandes.length ? demandes : ['park', 'forest', 'autumn', 'dunes'];
    const kinds = TOP_KINDS.filter((k) => k.weight > 0 || ['touffe', 'fleurs', 'palm', 'house'].includes(k.id));
    const CASE = 190, ENTETE = 46, MARGE = 16;
    const cv = document.createElement('canvas');
    cv.width = MARGE * 2 + kinds.length * CASE;
    cv.height = noms.length * (CASE + ENTETE) + MARGE * 2;
    const g = cv.getContext('2d');
    g.fillStyle = '#1b1d22'; g.fillRect(0, 0, cv.width, cv.height);
    noms.forEach((nom, r) => {
      const pal = Object.assign({}, THEME_BASE, THEME_DEFS[nom] || {});
      const art = buildTopArt(pal);
      const oy = MARGE + r * (CASE + ENTETE);
      // le sol du thème, pour juger l'objet SUR SA COULEUR DE FOND et pas sur du gris
      g.fillStyle = pal.grass;
      g.fillRect(MARGE, oy + ENTETE - 8, kinds.length * CASE, CASE);
      g.fillStyle = '#f0ece4'; g.font = 'bold 22px "Trebuchet MS", sans-serif';
      g.fillText(nom, MARGE + 4, oy + 24);
      kinds.forEach((k, c) => {
        const a = art[k.id];
        if (!a) return;
        const ox = MARGE + c * CASE;
        // en grand : chaque objet occupe sa case, à sa taille relative près
        const ref = Math.max(...kinds.map((x) => x.wm));
        const s = (CASE - 24) * (a.wm / (ref * 1.44));
        g.drawImage(a.canvas, ox + (CASE - s) / 2, oy + ENTETE - 8 + (CASE - s) / 2, s, s);
        g.fillStyle = 'rgba(240,236,228,0.75)'; g.font = '13px monospace';
        g.fillText(`${k.id} ${k.wm}m`, ox + 6, oy + ENTETE + CASE - 14);
      });
    });
    return cv.toDataURL('image/png').split(',')[1];
  }, THEMES);
  fs.writeFileSync(OUT, Buffer.from(png, 'base64'));
  console.log('planche -> ' + OUT);
  await nav.close(); srv.close();
})();
