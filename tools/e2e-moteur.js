// Le moteur à volant d'inertie, tel qu'il tourne DANS le jeu.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-moteur.js
//
// Il remplace `e2e-sample.js` et `e2e-audio.js`, qui mesuraient un moteur qui n'existe plus : l'un
// vérifiait qu'une rampe enregistrée se lisait sans transposer, l'autre que le pic d'allumage
// tombait sur cyl/2. Les deux disaient vrai et ne servent plus à rien — on ne synthétise plus le
// timbre, il vient des prises.
//
// Ce qui se mesure maintenant, et qu'aucune oreille ne dirait mieux :
//
// 1. Chaque voiture du jeu trouve un jeu de prises. Une seule muette et on l'entendrait, mais
//    seulement sur celle-là, et seulement en y jouant.
// 2. Les prises arrivent vraiment. Servies en HTTP, comme GitHub Pages ; sous `file://` un `fetch`
//    est refusé, et un essai qui ne voit pas ce qu'il mesure ne mesure rien.
// 3. Le régime monte au rupteur de la voiture, pas à celui du jeu de prises. Une 458 prêtée à la
//    3.0 CSL coupe à 8900 ; la CSL doit couper à 7000.
// 4. Le mélangeur bascule avec l'accélérateur. Pied dedans, ce sont les voies `on_` ; pied levé,
//    les voies `off_`. C'est la moitié de ce que le nouveau moteur apporte.
// 5. Rien ne sature. Les volumes viennent de la configuration de l'auteur, qui avait sa propre
//    sortie ; chez nous ils passent par un compresseur et un gain maître.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.png': 'image/png', '.webp': 'image/webp' };
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
  let errs = 0, fautes = 0;
  page.on('pageerror', (e) => { errs++; console.log('[pageerror]', e.message); });
  page.on('console', (m) => { if (m.type() === 'error') { errs++; console.log('[console]', m.text()); } });
  await page.goto(`${base}/index.html`);
  await page.waitForTimeout(600);

  // --- 1. chaque voiture trouve un jeu, et chaque fichier cité existe ---
  const inv = await page.evaluate(async (b) => {
    const cat = await (await fetch(b + '/sounds/engine/voitures.json')).json();
    const out = [];
    for (const m of modelsOf('gt')) {
      const c = cat.voitures[m.id];
      const jeu = c ? c.jeu : 'procar (défaut)';
      const j = cat.jeux[(c && c.jeu) || 'procar'];
      const manquants = [];
      for (const k of Object.keys(j.sounds)) {
        const r = await fetch(encodeURI(b + '/' + j.sounds[k].source), { method: 'HEAD' });
        if (!r.ok) manquants.push(k);
      }
      out.push({ nom: m.name, id: m.id, jeu, rupteur: (c && c.engine.limiter) || m.engine.redline,
                 rupteurJeu: j.engine.limiter, manquants });
    }
    return out;
  }, base);
  for (const i of inv) {
    if (i.manquants.length) fautes++;
    console.log(`  ${i.nom.padEnd(16)} jeu « ${i.jeu.padEnd(16)} » rupteur ${String(i.rupteur).padStart(4)}`
      + ` (le jeu coupe à ${i.rupteurJeu})`
      + (i.manquants.length ? `  ← PRISES MANQUANTES : ${i.manquants.join(', ')}` : ''));
  }

  // --- 2 à 5 : en jeu, voiture par voiture ---
  console.log();
  for (const m of inv) {
    const r = await page.evaluate(async (id) => {
      const a = new GameAudio();
      a.start();
      a._catalogue();
      await a.catFetch;
      const mod = modelById(id);
      const faux = (v, thr) => ({ cls: mod, v, throttle: thr, usage: 0, state: 'ok', slide: 0 });
      a.update(faux(0, false), false);
      // les boucles arrivent par le réseau : on attend qu'elles soient là, sans quoi on mesure
      // le silence et on le prend pour un défaut
      for (let i = 0; i < 80 && !a.pret; i++) await new Promise((r2) => setTimeout(r2, 100));
      const tenir = async (v, thr, ms) => {
        const t0 = performance.now();
        while (performance.now() - t0 < ms) { a.update(faux(v, thr), true); await new Promise((r2) => setTimeout(r2, 16)); }
      };
      await tenir(mod.vmax * 0.98, true, 1800);
      const haut = { rpm: a.rpm, gear: a.gear, voies: a.sampler.etat() };
      await tenir(mod.vmax * 0.98, false, 900);
      const leve = { rpm: a.rpm, voies: a.sampler.etat() };
      return { pret: a.pret, haut, leve, limiter: a.conf.engine.limiter };
    }, m.id);

    const somme = (v) => Object.keys(v).reduce((s, k) => s + v[k], 0);
    const on = (v) => v.on_low.gain + v.on_high.gain, off = (v) => v.off_low.gain + v.off_high.gain;
    const auRupteur = r.haut.rpm > r.limiter * 0.80 && r.haut.rpm <= r.limiter * 1.03;
    const bascule = on(r.haut.voies) > off(r.haut.voies) && off(r.leve.voies) > on(r.leve.voies);
    const pics = Math.max(...Object.keys(r.haut.voies).map((k) => r.haut.voies[k].gain));
    const sature = pics > 2.0;
    if (!r.pret || !auRupteur || !bascule || sature) fautes++;
    console.log(`  ${m.nom.padEnd(16)} prises ${r.pret ? 'là' : 'ABSENTES'}`
      + ` | pied dedans ${Math.round(r.haut.rpm)} tr sur ${r.limiter}, rapport ${r.haut.gear}`
      + (auRupteur ? '' : '  ← N\'ATTEINT PAS SON RUPTEUR')
      + ` | on ${on(r.haut.voies).toFixed(2)} → off ${off(r.leve.voies).toFixed(2)}`
      + (bascule ? '' : '  ← LE MÉLANGEUR NE BASCULE PAS')
      + ` | pic ${pics.toFixed(2)}` + (sature ? '  ← SATURE' : ''));
  }

  console.log('\nfautes', fautes, '| erreurs', errs);
  await browser.close();
  serveur.close();
  process.exit(fautes || errs ? 1 : 0);
})();
