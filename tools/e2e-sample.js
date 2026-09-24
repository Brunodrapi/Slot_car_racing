// Le moteur à échantillon, mesuré plutôt qu'écouté.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-sample.js
//
// Trois choses à vérifier, dont aucune ne s'entend sur une capture d'écran.
//
// 1. La boucle arrive. Elle est chargée par `fetch`, donc muette sous `file://` : le test sert
//    le dossier en HTTP, comme le fait GitHub Pages.
// 2. La hauteur suit le régime. Rejouer une prise `r` fois plus vite doit décaler sa fréquence
//    d'allumage d'exactement `r`. On le rend hors ligne et on lit le spectre — c'est la seule
//    preuve que le moteur monte vraiment dans les tours au lieu de ronronner sur place.
// 3. La synthèse reprend la main. Une voiture sans prise doit sonner comme avant, pas se taire.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wav': 'audio/wav',
  '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };

const serveur = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise((r) => serveur.listen(0, r));
  const base = `http://127.0.0.1:${serveur.address().port}`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  let errs = 0;
  page.on('pageerror', (e) => { if (errs++ < 4) console.log('[pageerror]', e.message); });
  await page.goto(`${base}/index.html`);
  await page.waitForTimeout(500);

  // --- 1. la boucle arrive-t-elle, et que contient-elle ? ---
  const boucle = await page.evaluate(async (b) => {
    const ctx = new OfflineAudioContext(1, 1024, 44100);
    const buf = await ctx.decodeAudioData(await (await fetch(`${b}/sounds/engine/six-inline-m1.wav`)).arrayBuffer());
    return { secondes: +buf.duration.toFixed(3), hz: buf.sampleRate, voies: buf.numberOfChannels };
  }, base);
  console.log('boucle :', JSON.stringify(boucle));

  // --- 2. le régime déclaré correspond-il à la prise ? ---
  // C'est l'invariant qui compte, et le seul que le navigateur ne garantit pas. Que `playbackRate`
  // transpose est acquis ; que la boucle tourne bien au régime écrit dans `js/cars.js` ne l'est
  // pas du tout, et s'en remettre au nom du fichier transposerait tout le moteur.
  // On retrouve la période par corrélation directe — la même mesure que l'outil qui a fabriqué la
  // boucle, mais refaite ici de façon indépendante, dans le navigateur, sur le fichier servi.
  const mesure = await page.evaluate(async (b2) => {
    const ctx = new OfflineAudioContext(1, 1024, 44100);
    const buf = await ctx.decodeAudioData(await (await fetch(`${b2}/sounds/engine/six-inline-m1.wav`)).arrayBuffer());
    const d = buf.getChannelData(0), sr = buf.sampleRate;
    const W = Math.floor(sr * 0.2);
    let m = 0; for (let i = 0; i < W; i++) m += d[i]; m /= W;
    let na = 0; for (let i = 0; i < W; i++) na += (d[i] - m) ** 2; na = Math.sqrt(na);
    let best = -2, bp = 0;
    for (let p2 = Math.floor(sr / 400); p2 < Math.floor(sr / 40); p2++) {
      let sxy = 0, syy = 0, mb = 0;
      for (let i = 0; i < W; i++) mb += d[p2 + i]; mb /= W;
      for (let i = 0; i < W; i++) { const x = d[i] - m, y = d[p2 + i] - mb; sxy += x * y; syy += y * y; }
      const r = sxy / (na * Math.sqrt(syy) + 1e-12);
      if (r > best) { best = r; bp = p2; }
    }
    const m1 = modelById('m1procar');
    return { allumageHz: +(sr / bp).toFixed(1), correlation: +best.toFixed(3),
             cyl: m1.engine.cyl, rpmDeclare: m1.engine.sample.rpm };
  }, base);
  // Un quatre-temps allume cyl/2 fois par tour de vilebrequin.
  const rpmMesure = mesure.allumageHz * 60 / (mesure.cyl / 2);
  const ecart = (rpmMesure / mesure.rpmDeclare - 1) * 100;
  let faute = Math.abs(ecart) > 3 ? 1 : 0;
  console.log(`\nallumage mesuré   ${mesure.allumageHz} Hz  (corrélation ${mesure.correlation})`);
  console.log(`régime déduit     ${rpmMesure.toFixed(0)} tr/min`);
  console.log(`régime déclaré    ${mesure.rpmDeclare} tr/min`);
  console.log(`écart             ${ecart >= 0 ? '+' : ''}${ecart.toFixed(1)} %  ${faute ? '— HORS TOLÉRANCE, le moteur serait transposé' : 'dans la tolérance'}`);

  // --- 3. en jeu : quelle voie joue pour quelle voiture ? ---
  const enJeu = await page.evaluate(async () => {
    const a = new GameAudio(); a.start();
    const voie = async (id, v) => {
      const m = modelById(id);
      a.update({ cls: m, v, throttle: true, usage: 0, state: 'track', slide: 0 }, true);
      await new Promise((r) => setTimeout(r, 450));
      a.update({ cls: m, v, throttle: true, usage: 0, state: 'track', slide: 0 }, true);
      // `setTargetAtTime` est une rampe : lue aussitôt, `.value` n'a pas encore bougé. On laisse
      // passer quelques constantes de temps, sinon on mesure l'instant d'avant.
      await new Promise((r) => setTimeout(r, 300));
      return { voiture: m.name, prise: !!a.smpSrc, rpm: Math.round(a.rpm),
        vitesseLecture: a.smpSrc ? +a.smpSrc.playbackRate.value.toFixed(3) : null,
        gainPrise: +a.smpGain.gain.value.toFixed(3), gainSynthese: +a.exGain.gain.value.toFixed(3) };
    };
    return [await voie('m1procar', 30), await voie('m1procar', 60), await voie('917k', 60), await voie('m1procar', 45)];
  });
  console.log('\nen jeu :');
  for (const r of enJeu) console.log('  ' + JSON.stringify(r));

  console.log('\nerrors', errs);
  await browser.close();
  serveur.close();
  if (errs || faute) process.exitCode = 1;
})();
