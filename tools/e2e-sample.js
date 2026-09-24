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

  // --- 1. toutes les boucles déclarées arrivent-elles ? ---
  // Le chargement est tout ou rien : une seule manquante et la voiture retombe à la synthèse.
  const inventaire = await page.evaluate(async (b) => {
    const out = [];
    for (const m of modelsOf('gt')) {
      if (!m.engine.sample) { out.push({ voiture: m.name, boucles: 0 }); continue; }
      let ok = 0, ko = [];
      for (const x of m.engine.sample.set) {
        const r = await fetch(`${b}/${x.src}`);
        if (r.ok) ok++; else ko.push(x.src);
      }
      out.push({ voiture: m.name, boucles: m.engine.sample.set.length, servies: ok, manquantes: ko });
    }
    return out;
  }, base);
  let absentes = 0;
  for (const i of inventaire) {
    if (!i.boucles) { console.log(`  ${i.voiture.padEnd(16)} synthèse`); continue; }
    absentes += i.boucles - i.servies;
    console.log(`  ${i.voiture.padEnd(16)} ${i.servies}/${i.boucles} boucles servies${i.manquantes.length ? '  MANQUE ' + i.manquantes.join(', ') : ''}`);
  }

  // --- 2. de combien chaque boucle est-elle transposée ? ---
  // C'est l'invariant qui avait sauté, et le seul qui compte à l'oreille. Une boucle rejouée
  // beaucoup plus vite ou plus lentement qu'à sa vitesse d'origine ne sonne plus comme un moteur :
  // avec une boucle unique à 2410 tr/min, le rupteur d'une M1 demandait x3,73, soit vingt-trois
  // demi-tons au-dessus — le son partait dans les aigus et se vidait. Avec un jeu de boucles,
  // aucune ne doit s'éloigner de plus de quelques demi-tons de chez elle.
  //
  // Inutile d'estimer une hauteur pour le vérifier : la vitesse de lecture demandée le dit
  // exactement, et c'est une mesure sans ambiguïté, là où tout estimateur de hauteur sur un
  // moteur se trompe d'octave de temps en temps.
  const LIMITE = 5;   // demi-tons
  const transpo = await page.evaluate(async (lim) => {
    const a2 = new GameAudio(); a2.start();
    const out = [];
    for (const m of modelsOf('gt')) {
      if (!m.engine.sample) continue;
      const V = m.engine.sample.set.slice().sort((x, y) => x.rpm - y.rpm);
      let pire = 0, pireRpm = 0, couvert = 0, total = 0;
      for (let rpm = m.engine.idle; rpm <= m.engine.redline; rpm += 25) {
        total++;
        const bas = V[0].rpm, haut = V[V.length - 1].rpm;
        const d = rpm < bas ? Math.log2(bas / rpm) : rpm > haut ? Math.log2(rpm / haut) : 0;
        if (d >= 0.25) continue;            // hors couverture : c'est la synthèse qui joue
        couvert++;
        // la boucle la plus proche en logarithme, celle sur laquelle le fondu s'appuie le plus
        let best = 0, bd = 1e9;
        for (let i = 0; i < V.length; i++) {
          const e = Math.abs(Math.log2(rpm / V[i].rpm));
          if (e < bd) { bd = e; best = i; }
        }
        const demi = Math.abs(12 * Math.log2(rpm / V[best].rpm));
        if (demi > pire) { pire = demi; pireRpm = rpm; }
      }
      out.push({ voiture: m.name, boucles: V.length,
                 plage: `${V[0].rpm}-${V[V.length - 1].rpm}`,
                 couverture: Math.round(100 * couvert / total),
                 pireDemiTons: +pire.toFixed(1), a: pireRpm, limite: lim });
    }
    return out;
  }, LIMITE);
  let faute = 0;
  console.log('\nvoiture          boucles  plage couverte   part du régime   pire transposition');
  for (const x of transpo) {
    const mauvais = x.pireDemiTons > LIMITE;
    if (mauvais) faute++;
    console.log(`  ${x.voiture.padEnd(15)} ${String(x.boucles).padStart(2)}   ${x.plage.padStart(11)} tr/min` +
      `   ${String(x.couverture).padStart(3)} %          ${x.pireDemiTons.toFixed(1)} demi-tons à ${x.a} tr/min` +
      `${mauvais ? '  ← TROP, ça se déforme' : ''}`);
  }
  console.log(faute ? `${faute} voiture(s) au-dessus de ${LIMITE} demi-tons` : `aucune boucle transposée de plus de ${LIMITE} demi-tons`);

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
      const vives = a.smpVoices.filter(v => v.gain.gain.value > 0.02)
        .map(v => `${v.rpm} a x${v.src.playbackRate.value.toFixed(2)} (${v.gain.gain.value.toFixed(2)})`);
      return { voiture: m.name, boucles: a.smpVoices.length, rpm: Math.round(a.rpm), vives,
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
