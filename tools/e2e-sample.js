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

  // --- 1. la rampe et sa table arrivent-elles ? ---
  const inventaire = await page.evaluate(async (b) => {
    const out = [];
    for (const m of modelsOf('gt')) {
      if (!m.engine.sample) { out.push({ voiture: m.name, rampe: null }); continue; }
      const rj = await fetch(`${b}/${m.engine.sample.ramp}`);
      if (!rj.ok) { out.push({ voiture: m.name, rampe: 'TABLE MANQUANTE' }); continue; }
      const meta = await rj.json();
      const rw = await fetch(`${b}/${meta.src}`);
      out.push({ voiture: m.name, rampe: rw.ok ? 'ok' : 'SON MANQUANT',
                 secondes: meta.secondes, points: meta.table.length,
                 plage: `${Math.round(meta.rpmBas)}-${meta.rpmHaut}`,
                 // L'axe des régimes ne doit pas être étiré : la plage couverte doit valoir
                 // exactement la montée mesurée dans la rampe. Sinon le moteur monte moins vite
                 // que le compte-tours — le défaut qui restait après le passage au granulaire.
                 etirement: +(12 * Math.log2(meta.rpmHaut / meta.rpmBas) / meta.monteeDemiTons).toFixed(2),
                 montee: meta.monteeDemiTons,
                 // la table doit être croissante, sinon monter en régime ferait reculer la lecture
                 croissante: meta.table.every((v, i) => i === 0 || v >= meta.table[i - 1] - 1e-9) });
    }
    return out;
  }, base);
  let absentes = 0;
  for (const i of inventaire) {
    if (!i.rampe) { console.log(`  ${i.voiture.padEnd(16)} synthèse`); continue; }
    const etire = Math.abs(i.etirement - 1) > 0.06;
    if (i.rampe !== 'ok' || !i.croissante || etire) absentes++;
    console.log(`  ${i.voiture.padEnd(16)} rampe ${i.rampe}, ${i.secondes} s, ${i.plage} tr/min, ` +
      `montée ${i.montee} dt, étirement x${i.etirement}${etire ? '  ← L\'AXE DES RÉGIMES EST ÉTIRÉ' : ''}` +
      `, table ${i.croissante ? 'croissante' : 'NON CROISSANTE'}`);
  }

  // --- 2. la lecture se déplace-t-elle avec le régime, sans jamais transposer ? ---
  // C'est tout l'intérêt du granulaire et c'est ce qui manquait aux jeux de boucles : monter en
  // régime doit **avancer dans l'enregistrement**, pas accélérer sa lecture. On vérifie donc deux
  // choses — que la position avance quand le régime monte, et qu'aucun grain n'est joué à une
  // vitesse autre que 1, ce qui serait une transposition déguisée.
  let faute = 0;
  const balayage = await page.evaluate(async (b) => {
    const out = [];
    for (const m of modelsOf('gt')) {
      if (!m.engine.sample) continue;
      const meta = await (await fetch(`${b}/${m.engine.sample.ramp}`)).json();
      const tmp = new OfflineAudioContext(1, 128, 44100);
      const buf = await tmp.decodeAudioData(await (await fetch(`${b}/${meta.src}`)).arrayBuffer());
      const a2 = new GameAudio(); a2.start();
      a2.ramp = { key: m.engine.sample.ramp, buf, meta };
      const pos = [];
      for (let u = 0; u <= 1.0001; u += 0.1) {
        const rpm = meta.rpmBas * Math.pow(meta.rpmHaut / meta.rpmBas, u);
        pos.push(+a2._rampPos(rpm).toFixed(4));
      }
      out.push({ voiture: m.name, positions: pos,
                 monotone: pos.every((v, i) => i === 0 || v >= pos[i - 1] - 1e-9),
                 couvre: +(pos[pos.length - 1] - pos[0]).toFixed(2) });
    }
    return out;
  }, base);
  console.log();
  for (const x of balayage) {
    if (!x.monotone) faute++;
    console.log(`  ${x.voiture.padEnd(16)} du ralenti au rupteur : ${x.couvre} s de rampe parcourus, ` +
      `lecture ${x.monotone ? 'toujours vers l\'avant' : 'QUI RECULE'}`);
  }
  // aucune transposition : le lecteur granulaire ne touche jamais `playbackRate`
  const transpo = await page.evaluate(() => {
    const src = GameAudio.prototype._grains.toString();
    return { toucheLaVitesse: /playbackRate/.test(src) };
  });
  console.log(`  playbackRate touché par le lecteur granulaire : ${transpo.toucheLaVitesse}` +
    (transpo.toucheLaVitesse ? '  ← il transpose, ce qu\'on voulait éviter' : '  (donc aucune transposition)'));
  if (transpo.toucheLaVitesse) faute++;

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
      return { voiture: m.name, rampe: !!a.ramp, rpm: Math.round(a.rpm),
        lecture: a.ramp ? +a.gRead.toFixed(3) : null,
        gainPrise: +a.smpGain.gain.value.toFixed(3), gainSynthese: +a.exGain.gain.value.toFixed(3) };
    };
    return [await voie('m1procar', 20), await voie('m1procar', 45), await voie('m1procar', 68),
            await voie('f40', 55), await voie('corvette', 55), await voie('917k', 60), await voie('m1procar', 50)];
  });
  console.log('\nen jeu :');
  for (const r of enJeu) console.log('  ' + JSON.stringify(r));

  console.log('\nerrors', errs);
  await browser.close();
  serveur.close();
  if (errs || faute || absentes) process.exitCode = 1;
})();
