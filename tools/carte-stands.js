// La voie des stands sur la minicarte : est-elle DESSINÉE, et se VOIT-ELLE ?
//
//   NODE_PATH=$(npm root -g) node tools/carte-stands.js
//
// Les deux questions sont distinctes, et c'est la seconde qui a motivé l'essai. La voie court à
// sept mètres du bord de piste ; à l'échelle d'une carte de 110 px cela fait moins d'un pixel, et
// un tracé fidèle disparaîtrait entièrement sous le trait de la piste, large de cinq pixels. Un
// code qui « dessine la voie » sans qu'aucun pixel ne change est exactement le bogue qu'on craint
// ici, et il passerait toute relecture : la boucle tourne, les points sont calculés, rien ne se
// voit.
//
// On compare donc la carte peinte avec la voie à la même carte peinte sans elle, sur les douze
// circuits, et on compte les pixels qui changent. Zéro pixel = la voie est sous la piste.
//
// Troisième question, de mécanique celle-là : la carte est une IMAGE EN CACHE, peinte une fois au
// chargement du circuit. Activer l'usure au menu ajoute la voie au monde ; si rien ne repeint la
// carte, elle garde le tracé d'avant et décrit un autre réglage que celui qu'on joue.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.json': 'application/json', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const serveur = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    res.end(d);
  });
});

(async () => {
  await new Promise((r) => serveur.listen(0, r));
  const base = 'http://127.0.0.1:' + serveur.address().port;
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: 1280, height: 720 } });
  let erreurs = 0, fautes = 0;
  page.on('pageerror', (e) => { erreurs++; console.log('[pageerror]', e.message); });

  await page.goto(base + '/index.html');
  await page.waitForTimeout(400);

  // les pixels de la carte, avec la voie puis sans : ce qui change, c'est la voie
  const res = await page.evaluate(() => {
    const r = app.renderer;
    const lire = () => {
      const c = r.mm.canvas, g = c.getContext('2d');
      return g.getImageData(0, 0, c.width, c.height).data;
    };
    const out = [];
    for (const def of TRACKS) {
      const T = new Track(def);
      r.setTrack(T);
      r.showPit = false; r._makeMinimap();
      const sans = lire();
      r.showPit = true; r._makeMinimap();
      const avec = lire();
      let change = 0;
      for (let i = 3; i < avec.length; i += 4) if (Math.abs(avec[i] - sans[i]) > 8) change++;
      // l'écart, en pixels d'écran, entre l'axe de la piste et celui de la voie à hauteur de boîte
      const p = T.pit, z = T.pitAt(p.boite);
      const q0 = T.pos(p.boite, 0), q1 = T.pos(p.boite, z.lat);
      const m0 = r.mmPoint(q0.x, q0.y), m1 = r.mmPoint(q1.x, q1.y);
      const reel = Math.hypot(m1.x - m0.x, m1.y - m0.y);
      out.push({ nom: def.name, change, taille: r.mm.size, reel, peint: r.mmPit });
    }
    return out;
  });

  console.log('\n  circuit                pixels ajoutes   ecart reel a l\'echelle   verdict');
  for (const t of res) {
    const vu = t.change >= 40;
    if (!vu || !t.peint) fautes++;
    console.log(`  ${t.nom.padEnd(22)} ${String(t.change).padStart(8)}   ${t.reel.toFixed(2).padStart(14)} px`
      + `   ${vu ? 'visible' : 'INVISIBLE — la voie se perd sous la piste'}`);
  }

  // la carte se repeint-elle quand l'usure s'active ?
  await page.evaluate(() => { app.save.wear = false; });
  await page.keyboard.press('Enter');
  await page.click('[data-action="setup"][data-mode="race"]');
  await page.click('[data-action="startQuick"]');
  await page.waitForTimeout(400);
  const sans = await page.evaluate(() => app.renderer.mmPit);
  await page.evaluate(() => { app.race.usure = USURE; });
  await page.waitForTimeout(300);
  const avec = await page.evaluate(() => app.renderer.mmPit);
  const bascule = sans === false && avec === true;
  if (!bascule) fautes++;
  console.log(`\n  usure eteinte -> voie sur la carte : ${sans} | usure allumee -> ${avec}`
    + (bascule ? '  ok' : '  ← LA CARTE NE SE REPEINT PAS'));

  console.log(`\nfautes ${fautes} | erreurs ${erreurs}`);
  await nav.close();
  serveur.close();
  process.exit(fautes || erreurs ? 1 : 0);
})();
