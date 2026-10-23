// Les trois entrées du bas de l'accueil : Comment jouer, Installez-moi, Faites un don.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-comment-jouer.js [dossier des captures]
//
// Sur iPhone, Android et ordinateur, en français et en anglais :
// - l'accueil montre « Comment jouer » et « Faites un don » partout, « Installez-moi » seulement sur un
//   téléphone où le jeu n'est pas déjà installé (ni lancé depuis l'écran d'accueil, ni installé à
//   l'instant) ;
// - « Faites un don » est un lien vers la page itch.io, ouvert dans un nouvel onglet ;
// - « Comment jouer » montre les trois gestes avec les animations de l'appareil et de la langue, qui se
//   chargent toutes ; sur téléphone « Suivant » passe d'un geste au suivant, les points suivent, et le
//   dernier bouton mène à la course rapide ;
// - « Installez-moi » explique d'abord le chemin de l'appareil qu'on tient, et l'invitation de Chrome
//   (`beforeinstallprompt`) devient un bouton qui l'ouvre, puis efface l'entrée du menu ;
// - les douze animations existent sur le disque.
'use strict';
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || null;
let fautes = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAUX  ') + m); if (!c) fautes++; };

const SAUVEGARDE = (lang) => JSON.stringify({ name: 'Bruno', lang, sound: false, tracesMigrated: true, catsMigrated: true, guideMigrated: true });

async function ouvre(browser, opts, lang, avant) {
  const ctx = await browser.newContext({ ...opts, locale: lang === 'en' ? 'en-US' : 'fr-FR' });
  await ctx.addInitScript((s) => localStorage.setItem('slotracer.save.v2', s), SAUVEGARDE(lang));
  if (avant) await ctx.addInitScript(avant);
  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(e.message));
  p.on('requestfailed', (r) => erreurs.push('introuvable : ' + r.url()));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForFunction(() => typeof app !== 'undefined' && app.save);
  await p.evaluate(() => { app.mondial = null; app.leaveSplash(); app.state = 'menu'; app.ui.menu(); });
  return { ctx, p, erreurs };
}

const entrees = (p) => p.evaluate(() => [...document.querySelectorAll('.home-extras .extra-card')].map((e) => ({
  action: e.dataset.action || null, texte: e.textContent.trim(), href: e.getAttribute('href'), cible: e.getAttribute('target'), rel: e.getAttribute('rel') })));

// toutes les animations affichées sont chargées, et ce sont celles de l'appareil et de la langue
const animations = (p) => p.evaluate(async () => {
  const imgs = [...document.querySelectorAll('.pas-anim img')];
  await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
  return imgs.map((i) => ({ src: i.getAttribute('src'), largeur: i.naturalWidth }));
});

(async () => {
  const browser = await chromium.launch();
  try {
    for (const scene of ['gaz', 'frein', 'levier']) for (const f of ['tactile', 'clavier']) for (const l of ['fr', 'en']) {
      const fichier = path.join(ROOT, `art/interface/comment-jouer/${f}-${scene}-${l}.webp`);
      if (!fs.existsSync(fichier)) ok(false, `animation absente : ${path.relative(ROOT, fichier)}`);
    }
    ok(true, 'les douze animations sont sur le disque');

    for (const [nom, opts, lang] of [['iPhone', devices['iPhone 13'], 'fr'], ['Android', devices['Pixel 7'], 'en'], ['ordinateur', { viewport: { width: 1366, height: 800 } }, 'fr']]) {
      console.log(`${nom} (${lang})`);
      const { ctx, p, erreurs } = await ouvre(browser, opts, lang);
      const telephone = nom !== 'ordinateur';
      const e = await entrees(p);
      const attendu = telephone ? ['howto', 'install', null] : ['howto', null];
      ok(JSON.stringify(e.map((x) => x.action)) === JSON.stringify(attendu), `${nom} : entrées ${e.map((x) => x.texte).join(' · ')}`);
      const don = e.find((x) => x.href);
      ok(don && /^https:\/\/[^/]*itch\.io/.test(don.href) && don.cible === '_blank' && /noopener/.test(don.rel),
        `${nom} : « ${don && don.texte} » ouvre ${don && don.href} dans un nouvel onglet`);
      if (OUT) await p.screenshot({ path: path.join(OUT, `${nom}-accueil.png`) });

      // Comment jouer
      await p.click('[data-action="howto"]');
      const anims = await animations(p);
      const format = telephone ? 'tactile' : 'clavier';
      ok(anims.length === 3 && anims.every((a, i) => a.largeur > 0 && a.src.includes(`/${format}-${['gaz', 'frein', 'levier'][i]}-${lang}.webp`)),
        `${nom} : trois animations ${format} en ${lang}, toutes chargées (${anims.map((a) => a.largeur).join(', ')} px)`);
      if (telephone) {
        const etat = () => p.evaluate(() => {
          const rail = document.querySelector('[data-howto]');
          return { i: Math.round(rail.scrollLeft / rail.clientWidth), point: [...document.querySelectorAll('.howto-points span')].findIndex((s) => s.classList.contains('actif')),
            bouton: document.querySelector('[data-action="howtoNext"]').textContent.trim() };
        });
        const vus = [await etat()];
        for (let k = 0; k < 2; k++) { await p.click('[data-action="howtoNext"]'); await p.waitForTimeout(700); vus.push(await etat()); }
        ok(vus.map((v) => v.i).join() === '0,1,2' && vus.map((v) => v.point).join() === '0,1,2',
          `${nom} : « Suivant » passe les trois gestes, les points suivent (${vus.map((v) => v.i).join(' → ')})`);
        ok(vus[0].bouton !== vus[2].bouton, `${nom} : le dernier bouton change (« ${vus[0].bouton} » → « ${vus[2].bouton} »)`);
        if (OUT) await p.screenshot({ path: path.join(OUT, `${nom}-comment-jouer-3.png`) });
      } else if (OUT) await p.screenshot({ path: path.join(OUT, `${nom}-comment-jouer.png`) });
      await p.click('[data-action="howtoNext"]');
      ok(await p.evaluate(() => !!document.querySelector('.setup-screen') && app.ui.setup.mode === 'race'), `${nom} : le dernier bouton mène à la course rapide`);

      // Installez-moi
      if (telephone) {
        await p.evaluate(() => app.ui.menu());
        await p.click('[data-action="install"]');
        const ordre = await p.evaluate(() => [...document.querySelectorAll('.install-os')].map((s) => `${s.tagName.toLowerCase()}:${(s.querySelector('h3, summary') || {}).textContent}`));
        const premier = nom === 'iPhone' ? /iPhone/i : /Android/i;
        ok(premier.test(ordre[0]) && ordre[0].startsWith('section') && ordre[1].startsWith('details'), `${nom} : son chemin d'abord, l'autre replié (${ordre.join(' · ')})`);
        ok(!(await p.$('[data-action="installNow"]')), `${nom} : pas de bouton d'installation sans invitation du navigateur`);
        // l'invitation de Chrome : gardée, puis offerte en bouton
        await p.evaluate(() => {
          const e = new Event('beforeinstallprompt', { cancelable: true });
          e.prompt = () => { window.__invite = true; };
          e.userChoice = Promise.resolve({ outcome: 'accepted' });
          window.dispatchEvent(e);
        });
        ok(!!(await p.$('[data-action="installNow"]')), `${nom} : l'invitation du navigateur devient un bouton`);
        if (OUT) await p.screenshot({ path: path.join(OUT, `${nom}-installez-moi.png`), fullPage: true });
        await p.click('[data-action="installNow"]');
        await p.waitForTimeout(200);
        const apres = await p.evaluate(() => ({ invite: !!window.__invite, fait: !!document.querySelector('.install-fait') }));
        ok(apres.invite && apres.fait, `${nom} : le bouton ouvre l'invitation, l'écran dit que c'est fait`);
        await p.evaluate(() => app.ui.menu());
        ok(!(await p.$('[data-action="install"]')), `${nom} : une fois installé, l'entrée disparaît du menu`);
      }
      ok(erreurs.length === 0, `${nom} : aucune erreur de page` + (erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''));
      await ctx.close();
    }

    // lancé depuis l'écran d'accueil : rien à installer
    const { ctx, p } = await ouvre(browser, devices['iPhone 13'], 'fr', () => Object.defineProperty(navigator, 'standalone', { get: () => true }));
    ok(!(await p.$('[data-action="install"]')), 'iPhone, jeu ouvert depuis l\'écran d\'accueil : pas d\'entrée « Installez-moi »');
    await ctx.close();
  } finally {
    await browser.close();
  }
  console.log(fautes ? `${fautes} faute(s)` : 'OK');
  process.exitCode = fautes ? 1 : 0;
})();
