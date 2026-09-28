// Le menu-affiche : les bandeaux, leur dépliage, et ce sur quoi ils mènent.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-menu.js [dossier]
//
// Vérifie que les bandeaux sont là et cliquables, que chacun a bien chargé son dessin déplié
// (et non un cadre vide), qu'ils restent REPLIÉS tant qu'on n'y touche pas, qu'un appui en ouvre
// un seul, que chacun tombe sur le bandeau peint dans l'affiche, et qu'il mène où il doit.
const { chromium, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const out = process.argv[2] || '/tmp';

/* Servi en HTTP, et non depuis le disque.

Sous `file://` toute image vient d'une autre origine, donc la lire dans un canvas est interdit :
la mesure des bandeaux peints ne peut pas se faire. C'est la même leçon que pour le moteur à
échantillon, dont la rampe ne se charge pas non plus sous `file://` — un essai qui ne voit pas ce
qu'il veut mesurer ne mesure rien. Et c'est en HTTP que le jeu est réellement servi. */
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.json': 'application/json', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const serveur = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise((r) => serveur.listen(0, r));
  const base = `http://127.0.0.1:${serveur.address().port}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  let errs = 0;
  page.on('pageerror', (e) => { if (errs++ < 4) console.log('[pageerror]', e.message); });
  page.on('console', (m) => { if (m.type() === 'error') { errs++; console.log('[console]', m.text()); } });
  await page.goto(`${base}/index.html`);
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');          // l'écran-titre

  // au repos : rien ne doit s'être ouvert tout seul
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${out}/menu-ferme.png` });
  const auRepos = await page.evaluate(() => [...document.querySelectorAll('.screen.poster .mi')]
    .map((b) => b.classList.contains('open')));
  console.log('ouverts au repos (doivent être tous faux) :', JSON.stringify(auRepos));

  // un appui : celui-là s'ouvre, les autres non
  await page.click('.screen.poster .mi:nth-of-type(3)');
  await page.waitForTimeout(200);
  console.log('après appui sur le 3e :', JSON.stringify(await page.evaluate(() =>
    [...document.querySelectorAll('.screen.poster .mi')].map((b) => b.classList.contains('open')))));
  await page.screenshot({ path: `${out}/menu-ouvert.png` });
  await page.waitForTimeout(700);
  console.log('il mène à :', await page.evaluate(() => app.state + '/' + (app.net ? app.net.state : '-')));
  await page.evaluate(() => app.toMenu());
  await page.waitForTimeout(400);

  const etat = await page.evaluate(() => {
    const mis = [...document.querySelectorAll('.screen.poster .mi')];
    return {
      bandeaux: mis.length,
      images: mis.map((b) => {
        const i = b.querySelector('img');
        if (!i) return 'aucune';
        return i.naturalWidth ? `${i.naturalWidth}x${i.naturalHeight}` : 'NON CHARGÉE';
      }),
      replies: mis.map((b) => getComputedStyle(b.querySelector('img')).clipPath),
      fond: (() => { const i = document.querySelector('.stage .bg'); return i && i.naturalWidth ? `${i.naturalWidth}x${i.naturalHeight}` : 'NON CHARGÉ'; })(),
      burger: !!document.querySelector('.burger'),
    };
  });
  console.log(JSON.stringify(etat, null, 0));

  /* Chaque bouton tombe-t-il sur son bandeau ?

  C'est le seul défaut de ce menu qu'aucune autre vérification ne peut voir. Les bandeaux repliés
  sont PEINTS dans le fond, et les boutons sont des rectangles transparents posés par-dessus à des
  hauteurs écrites à la main dans `js/ui.js`. Rien ne lie les deux : refaire l'affiche, ou changer
  un chiffre, décale les cibles sans rien casser ni rien afficher de faux — on clique simplement à
  côté, et une capture d'écran n'en montre rien puisque les boutons sont invisibles.

  On lit donc le fond lui-même, sur UNE colonne, à 6 % du bord gauche. C'est le seul endroit où un
  bandeau est une couleur franche et rien d'autre : plus à droite viennent les traits de vitesse,
  l'icône, le damier, et une première version qui cherchait des bandes sur tout le tiers gauche se
  faisait couper par l'icône — elle voyait deux bandeaux sur trois et en inventait un quatrième
  dans les arbres. Sur cette colonne, un bandeau est une suite de lignes saturées et de couleur
  CONSTANTE ; c'est la constance qui écarte le vibreur rouge et blanc du bas de l'affiche, texturé
  (écart-type 72) là où un bandeau est plat (23 au pire).

  Ce détecteur se vérifie lui-même : passé sur l'affiche d'avant, à cinq bandeaux, il retrouve les
  cinq hauteurs écrites alors dans `ui.js` — 20,2 / 30,4 / 40,9 / 51,3 / 61,8 %.

  Ce qu'on compare est le HAUT du bandeau et le haut du bouton, et pas leur recouvrement : les
  bandeaux sont des parallélogrammes qui descendent vers la droite, donc sur cette colonne on ne
  voit que leur début. Or le haut est justement le nombre qu'on écrit à la main. */
  const cibles = await page.evaluate(() => {
    const img = document.querySelector('.stage .bg');
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const x = Math.round(c.width * 0.06);
    const d = c.getContext('2d').getImageData(x, 0, 1, c.height).data;
    const px = (y) => [d[y * 4], d[y * 4 + 1], d[y * 4 + 2]];
    const bandes = []; let deb = null;
    const clore = (fin) => {
      if (deb === null) return;
      if ((fin - deb) / c.height >= 0.04) {
        const n = fin - deb;
        const moy = [0, 1, 2].map((k) => { let t = 0; for (let y = deb; y < fin; y++) t += px(y)[k]; return t / n; });
        const ec = Math.max(...[0, 1, 2].map((k) => {
          let t = 0; for (let y = deb; y < fin; y++) { const v = px(y)[k] - moy[k]; t += v * v; }
          return Math.sqrt(t / n);
        }));
        if (ec < 35) bandes.push({ haut: deb / c.height, bas: fin / c.height, ec: +ec.toFixed(1),
                                   couleur: moy.map((v) => Math.round(v)) });
      }
      deb = null;
    };
    for (let y = 0; y < c.height; y++) {
      const [r, g, b] = px(y);
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx - mn > 90 && mx > 110) { if (deb === null) deb = y; } else clore(y);
    }
    clore(c.height);
    const st = document.querySelector('.stage').getBoundingClientRect();
    const boutons = [...document.querySelectorAll('.screen.poster .mi')].map((b) => {
      const r = b.getBoundingClientRect();
      return { haut: (r.top - st.top) / st.height, ou: b.getAttribute('aria-label') };
    });
    return { bandes, boutons };
  });
  let decales = 0;
  const pris = new Set();
  for (const b of cibles.boutons) {
    let best = -1, ecart = 9;
    cibles.bandes.forEach((z, i) => { const e = Math.abs(z.haut - b.haut); if (e < ecart) { ecart = e; best = i; } });
    const bon = ecart <= 0.01;
    if (bon) pris.add(best); else decales++;
    console.log(`  ${b.ou.padEnd(18)} bouton à ${(100 * b.haut).toFixed(2)} %, bandeau peint à `
      + `${best < 0 ? '—' : (100 * cibles.bandes[best].haut).toFixed(2) + ' %'}`
      + ` → ${(100 * ecart).toFixed(2)} point d'écart`
      + (bon ? '' : '  ← LE BOUTON N\'EST PAS SUR SON BANDEAU'));
  }
  // un bandeau peint que personne ne réclame est une entrée morte imprimée sur l'affiche
  cibles.bandes.forEach((z, i) => {
    if (pris.has(i)) return;
    decales++;
    console.log(`  bandeau peint à ${(100 * z.haut).toFixed(2)} % rgb(${z.couleur}) SANS BOUTON`
      + '  ← un bandeau sur l\'affiche qui ne mène nulle part');
  });
  if (decales) errs++;

  // chaque bandeau mène-t-il où il doit ?
  const routes = [
    ['course rapide', '.mi:nth-of-type(1)', () => app.ui.setup.mode],
    ['contre la montre', '.mi:nth-of-type(2)', () => app.ui.setup.mode],
  ];
  for (const [nom, sel, f] of routes) {
    await page.click(`.screen.poster ${sel}`);
    await page.waitForTimeout(800);            // le dépliage, puis l'action
    console.log(nom, '->', await page.evaluate(f));
    await page.click('[data-action="menu"]').catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.click('.screen.poster .burger');
  await page.waitForTimeout(300);
  console.log('hamburger -> réglages :', await page.locator('#sel-pull').count() > 0);

  /* Changer un réglage ne doit pas renvoyer la page en haut.

  Chaque choix — le nombre de tours, le circuit, la voiture — reconstruit l'écran entier, et
  remplacer le contenu remet le défilement à zéro : on choisissait ses tours en bas de page et on se
  retrouvait en haut, à devoir redescendre pour le réglage suivant. L'essai fait donc ce que fait le
  joueur : il descend, il clique, il regarde où il est.

  Et il vérifie l'autre moitié de la règle, sans quoi le remède serait pire : revenir au menu puis
  rouvrir l'écran doit repartir du haut. Conserver le défilement d'un écran à l'autre donnerait une
  page ouverte au milieu, sans qu'on sache pourquoi. */
  await page.evaluate(() => app.ui.setupScreen('race'));
  await page.waitForTimeout(400);
  const scrollable = await page.evaluate(() => {
    const e = document.querySelector('.screen');
    return e ? e.scrollHeight - e.clientHeight : 0;
  });
  if (scrollable < 50) {
    errs++; console.log('  ÉCHEC : l’écran de départ ne défile pas, l’essai ne prouverait rien');
  } else {
    const apres = await page.evaluate(async () => {
      const e = document.querySelector('.screen');
      e.scrollTop = Math.round((e.scrollHeight - e.clientHeight) * 0.7);
      const avant = e.scrollTop;
      const b = document.querySelector('[data-action="pickLaps"]:not(.sel)')
        || document.querySelector('[data-action="pickDiff"]:not(.sel)');
      if (!b) return { avant, err: 'aucun réglage à changer' };
      b.click();
      await new Promise((r) => setTimeout(r, 200));
      const e2 = document.querySelector('.screen');
      return { avant, apres: e2.scrollTop, quoi: b.dataset.action };
    });
    if (apres.err) { errs++; console.log('  ÉCHEC :', apres.err); }
    else {
      const perdu = Math.abs(apres.apres - apres.avant);
      console.log(`changer un réglage (${apres.quoi}) : défilement ${apres.avant} → ${apres.apres} px`);
      if (perdu > 30) { errs++; console.log(`  ÉCHEC : la page a bougé de ${perdu} px, elle devait rester`); }
      else console.log('  ok : la page reste où elle était');
    }
    // revenir au menu puis rouvrir : là, on doit repartir du haut
    const rouvert = await page.evaluate(async () => {
      app.ui.menu();
      await new Promise((r) => setTimeout(r, 150));
      app.ui.setupScreen('race');
      await new Promise((r) => setTimeout(r, 150));
      return document.querySelector('.screen').scrollTop;
    });
    if (rouvert > 5) { errs++; console.log(`  ÉCHEC : rouvrir l’écran le laisse à ${rouvert} px du haut`); }
    else console.log('  ok : rouvrir l’écran repart du haut');
  }

  console.log('erreurs', errs);
  await browser.close();
  serveur.close();
  process.exit(errs ? 1 : 0);
})();
