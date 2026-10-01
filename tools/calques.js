// Ce que coûte le dessin d'UNE voiture, couche par couche.
//
//   NODE_PATH=$(npm root -g) node tools/calques.js [voiture] [--bride=4]
//
// Pourquoi cette mesure existe : à l'écran, sous la voiture dessinée, on en voit une seconde —
// plus sombre, décalée. C'est son ombre, et la question posée est légitime : deux dessins au lieu
// d'un, est-ce que ça coûte ? La réponse ne peut pas venir de la lecture du code, parce que le
// nombre de couches DÉPEND DE LA CAMÉRA : à plat une voiture est un `drawImage` plus son ombre,
// en vue inclinée celle qui n'a pas de planche de rotation est empilée huit à vingt-huit fois pour
// se donner du volume. On mesure donc les trois chemins séparément.
//
// On compte les `drawImage` en interceptant le contexte, et on chronomètre `_drawCar` lui-même :
// une moyenne d'images par seconde dilue huit voitures dans tout le reste de la scène et ne dirait
// pas laquelle des couches pèse.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wav': 'audio/wav',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };

(async () => {
  const carId = process.argv[2] || '935';
  const bride = +((process.argv.find((x) => x.startsWith('--bride=')) || '--bride=1').split('=')[1]);
  const serveur = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => serveur.listen(0, r));
  const base = `http://127.0.0.1:${serveur.address().port}`;

  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  let errs = 0;
  page.on('pageerror', (e) => { if (errs++ < 4) console.log('[pageerror]', e.message); });
  const cdp = await page.context().newCDPSession(page);
  if (bride > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: bride });
  await page.goto(`${base}/index.html`);
  await page.waitForTimeout(400);
  await page.evaluate(() => { app.save.name = 'Banc'; storeSave(app.save); });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);

  const res = await page.evaluate(async ({ id }) => {
    app.save.models.gt = id;
    app.save.sound = false;
    app.startQuick('race', 'gt', TRACKS[0].id);
    await new Promise((r) => setTimeout(r, 2500));

    // Le compteur de `drawImage`, posé sur le contexte lui-même : il voit les appels d'où qu'ils
    // viennent, y compris ceux des couches empilées, qui ne passent pas par le même chemin.
    const proto = CanvasRenderingContext2D.prototype;
    const vraiDraw = proto.drawImage;
    let appels = 0;
    proto.drawImage = function (...a) { appels++; return vraiDraw.apply(this, a); };

    const r = app.renderer;
    const vraiCar = r._drawCar.bind(r);
    let ms = 0, n = 0, dessins = 0;
    r._drawCar = (g, car) => {
      const a0 = appels, t0 = performance.now();
      vraiCar(g, car);
      ms += performance.now() - t0; n++; dessins += appels - a0;
    };

    const vraieOmbre = window.drawCarShadow;
    const mesure = async (vue, ombre) => {
      r.setView(vue);
      window.drawCarShadow = ombre ? vraieOmbre : () => true;   // `true` : pas de boîte de repli
      await new Promise((res) => setTimeout(res, 600));          // le temps que les planches arrivent
      ms = 0; n = 0; dessins = 0;
      const t = [];
      let last = performance.now();
      await new Promise((fini) => {
        const tick = () => {
          const now = performance.now(); t.push(now - last); last = now;
          if (t.length < 150) requestAnimationFrame(tick); else fini();
        };
        requestAnimationFrame(tick);
      });
      const tri = t.slice(10).sort((a, b) => a - b);
      return {
        vue, ombre, voitures: app.race.cars.length,
        parVoiture: +(ms / Math.max(1, n)).toFixed(3),
        dessinsParVoiture: +(dessins / Math.max(1, n)).toFixed(2),
        image: +tri[Math.floor(tri.length / 2)].toFixed(2),
        p90: +tri[Math.floor(tri.length * 0.9)].toFixed(2),
      };
    };

    /* Une passe JETÉE avant les quatre autres.

    Sans elle, le premier bloc mesuré portait seul le prix du démarrage — la gomme qui s'étale, les
    silhouettes d'ombre qu'on grave une fois, les planches qui finissent d'arriver — et l'image
    médiane sortait à 65 ms contre 30 pour le bloc suivant. Le coût par voiture, lui, ne variait que
    de 0,01 ms : c'était l'ordre des passes qu'on mesurait, pas l'ombre. Un banc qui met une
    seconde de démarrage sur le dos de la couche qu'on examine accuse n'importe quoi. */
    await mesure('track', true);

    const out = [];
    out.push(await mesure('track', true));
    out.push(await mesure('track', false));
    out.push(await mesure('iso', true));
    out.push(await mesure('iso', false));
    proto.drawImage = vraiDraw;
    return { out, modele: app.race.player.cls.id, planche: !!app.race.player.cls.sheet };
  }, { id: carId });

  console.log(`${carId} · planche de rotation : ${res.planche ? 'oui' : 'non'} · processeur bridé x${bride}`);
  for (const m of res.out) {
    console.log(`  ${m.vue === 'track' ? 'à plat  ' : 'inclinée'} · ombre ${m.ombre ? 'oui' : 'non '}` +
      ` · ${m.dessinsParVoiture} dessins/voiture · ${m.parVoiture} ms/voiture` +
      ` · image médiane ${m.image} ms (p90 ${m.p90}) · ${m.voitures} voitures`);
  }
  const [aOmbre, aSans, iOmbre, iSans] = res.out;
  console.log(`  coût de l'ombre à plat : ${(aOmbre.parVoiture - aSans.parVoiture).toFixed(3)} ms/voiture` +
    ` (${(aOmbre.dessinsParVoiture - aSans.dessinsParVoiture).toFixed(2)} dessin)`);
  console.log(`  à plat -> inclinée : ${(iOmbre.parVoiture - aOmbre.parVoiture).toFixed(3)} ms/voiture` +
    ` (${(iOmbre.dessinsParVoiture - aOmbre.dessinsParVoiture).toFixed(2)} dessins)`);
  console.log(`  errors ${errs}`);
  await browser.close();
  serveur.close();
})();
