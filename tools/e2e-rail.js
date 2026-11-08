// Les flèches des rails (circuits, voitures) à la souris : un clic = un pas, même en cliquant vite,
// même quand l'écran se repeint pendant le défilement ; et la flèche du bout s'estompe.
//
//   python3 -m http.server 8770 --bind 127.0.0.1 &   (à la racine du dépôt)
//   NODE_PATH=$(npm root -g) node tools/e2e-rail.js [http://127.0.0.1:8770]
//
// Avant la correction (mesuré) : trois clics à 150 ms n'avançaient que de deux pas, à 60 ms d'à peine
// plus d'un ; en contre-la-montre, l'arrivée des temps du monde arrêtait le défilement en route.
'use strict';
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8770';
let fautes = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAUX  ') + m); if (!c) fautes++; };

(async () => {
  const b = await chromium.launch();
  try {
    const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    const erreurs = [];
    p.on('pageerror', (e) => erreurs.push(e.message));
    await p.goto(BASE + '/index.html');
    await p.waitForFunction(() => typeof app !== 'undefined' && app.save && app.ui);
    await p.evaluate(() => { app.save.lang = 'fr'; app.save.tutorialSeen = true; if (app.state === 'splash') app.leaveSplash(); app.state = 'menu'; });
    const etat = () => p.evaluate(() => {
      const r = document.querySelector('[data-rail="tracks"]'), box = r.closest('.railbox');
      return { sl: r.scrollLeft, max: r.scrollWidth - r.clientWidth, pas: Math.max(180, r.clientWidth * 0.8),
        g: box.querySelector('.railarrow.gauche').classList.contains('bout'),
        d: box.querySelector('.railarrow.droite').classList.contains('bout') };
    });
    const ouvre = (mode) => p.evaluate((m) => {
      app.ui.setup.trackId = 'monza'; app.ui.setupScreen(m);
      const r = document.querySelector('[data-rail="tracks"]'); r.scrollLeft = 0; r.dispatchEvent(new Event('scroll'));
    }, mode);
    const droite = '.railarrow[data-id="tracks"][data-dir="1"]';

    await ouvre('race');
    let e = await etat();
    ok(e.g && !e.d, 'au début : la flèche gauche est estompée, la droite non');

    // trois clics rapides = trois pas (au calage des cartes près)
    for (const pause of [150, 60]) {
      await ouvre('race');
      for (let i = 0; i < 3; i++) { await p.click(droite); await p.waitForTimeout(pause); }
      await p.waitForTimeout(1000);
      e = await etat();
      const attendu = Math.min(e.max, 3 * e.pas);
      ok(Math.abs(e.sl - attendu) < e.pas * 0.3, `3 clics à ${pause} ms : ${Math.round(e.sl)} px (3 pas ≈ ${Math.round(attendu)})`);
    }

    // un repeint en plein défilement ne l'arrête pas : il va à la place visée
    await ouvre('timetrial');
    await p.click(droite);
    await p.waitForTimeout(80);
    await p.evaluate(() => app.ui.setupScreen('timetrial'));
    await p.waitForTimeout(900);
    e = await etat();
    ok(Math.abs(e.sl - e.pas) < e.pas * 0.3, `repeint pendant le défilement : ${Math.round(e.sl)} px (un pas ≈ ${Math.round(e.pas)})`);

    // au bout : la flèche droite s'estompe et ne fait rien
    for (let i = 0; i < 8; i++) { await p.click(droite); await p.waitForTimeout(120); }
    await p.waitForTimeout(1000);
    e = await etat();
    ok(e.sl >= e.max - 1 && e.d && !e.g, `au bout : ${Math.round(e.sl)}/${Math.round(e.max)} px, flèche droite estompée`);

    ok(!erreurs.length, 'aucune erreur JS' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } finally { await b.close(); }
  console.log('\n' + fautes + ' faute(s)');
  process.exit(fautes ? 1 : 0);
})();
