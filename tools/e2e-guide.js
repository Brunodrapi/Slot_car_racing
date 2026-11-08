// Le guide de freinage, aide pour débuter (0.52.54) : réglable dans les réglages, et jamais au
// tableau mondial.
//
//   python3 -m http.server 8770 --bind 127.0.0.1 &   (à la racine du dépôt)
//   NODE_PATH=$(npm root -g) node tools/e2e-guide.js [http://127.0.0.1:8770] [capture.png]
//
// On vérifie :
// - la ligne « Guide de freinage (débutant) » est dans les réglages, éteinte par défaut ; l'allumer
//   dit tout de suite que le tableau mondial est exclu, et le choix survit au rechargement ;
// - l'écran du contre-la-montre prévient avant de courir ;
// - en course, le guide se peint (ruban et barre de freinage) ;
// - un meilleur tour couru guide allumé entre au record personnel, PAS au registre net, n'est pas
//   proposé au tableau mondial, et le motif est nommé ; même quand on éteint le guide avant la fin ;
// - guide éteint, le même tour part bien au tableau mondial (la règle n'exclut pas tout).
'use strict';
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8770';
const CAPTURE = process.argv[3] || null;
let fautes = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAUX  ') + m); if (!c) fautes++; };

(async () => {
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    const p = await ctx.newPage();
    const erreurs = [];
    p.on('pageerror', (e) => erreurs.push(e.message));
    const ouvre = async () => {
      await p.goto(BASE + '/index.html');
      await p.waitForFunction(() => typeof app !== 'undefined' && app.save && typeof tourNet === 'function');
      await p.evaluate(() => { app.save.lang = 'fr'; app.save.name = 'Essai'; if (app.state === 'splash') app.leaveSplash(); });
    };
    await ouvre();
    await p.evaluate(() => { app.save.showLines = false; storeSave(app.save); app.ui.settings(); });

    // --- les réglages ---
    const avant = await p.evaluate(() => {
      const sel = document.getElementById('sel-lines');
      return { existe: !!sel, valeur: sel && sel.value, libelle: sel ? sel.closest('label').textContent : '',
        avert: !!document.querySelector('.settings-screen .avert') };
    });
    ok(avant.existe, 'la ligne du guide est dans les réglages');
    ok(avant.libelle.includes('Guide de freinage (débutant)'), `libellé : « ${avant.libelle.replace(/Désactivé|Activé|Non|Oui/g, '').trim()} »`);
    ok(avant.valeur === '0' && !avant.avert, 'éteint par défaut, sans avertissement');
    await p.selectOption('#sel-lines', '1');
    const apres = await p.evaluate(() => ({ save: app.save.showLines, rendu: app.renderer.showLines,
      avert: (document.querySelector('.settings-screen .avert') || {}).textContent || '' }));
    ok(apres.save === true && apres.rendu === true, 'l\'allumer règle la sauvegarde et le rendu');
    ok(/tableau mondial/i.test(apres.avert) && /guide de freinage/.test(apres.avert), `l'exclusion se dit tout de suite : « ${apres.avert} »`);

    await ouvre();
    ok(await p.evaluate(() => app.save.showLines === true && app.renderer.showLines === true),
      'le guide reste allumé au rechargement (il n\'est plus remis à zéro)');
    ok(await p.evaluate(() => app.save.aimant === 0), 'les autres réglages de mise au point restent remis à zéro');

    // --- le contre-la-montre prévient avant de courir ---
    const note = await p.evaluate(() => { app.state = 'menu'; app.ui.setup.trackId = 'monza'; app.ui.setupScreen('timetrial');
      return [...document.querySelectorAll('.mondial-note')].map((n) => n.textContent).join(' | '); });
    ok(/Guide de freinage activé/.test(note), `le départ prévient : « ${note.trim().slice(0, 90)} »`);

    // --- en course, le guide se peint ---
    await p.evaluate(async () => {
      app.startQuick('timetrial', 'gt', 'monza');
      await new Promise((res) => { const w = () => (app.race && app.race.state === 'racing' ? res() : setTimeout(w, 50)); w(); });
    });
    await p.keyboard.down('Space');
    await p.waitForTimeout(2500);
    const peint = await p.evaluate(() => {
      let n = 0; const orig = app.renderer._drawGuide.bind(app.renderer);
      app.renderer._drawGuide = (...a) => { n++; return orig(...a); };
      return new Promise((res) => setTimeout(() => res({ n, guide: app.race.guide, v: app.race.player.v }), 400));
    });
    ok(peint.guide === true, 'la course retient que le guide était allumé au départ');
    ok(peint.n > 5, `le guide se peint en course (${peint.n} images en 0,4 s, ${Math.round(peint.v * 3.6)} km/h)`);
    if (CAPTURE) await p.screenshot({ path: CAPTURE });
    await p.keyboard.up('Space');

    // --- un tour guidé ne va pas au monde, même si on éteint le guide avant la fin ---
    const fin = (eteindre) => p.evaluate(async (eteindre) => {
      const r = app.race, moi = r.player, cle = `${r.track.id}|${r.cat.id}|${r.cls.id}`;
      let propose = 0;
      app.mondial.connecte = () => true; app.mondial.poseNom = () => {};
      app.mondial.propose = () => { propose++; return Promise.resolve(); };
      app.mondial.dernierRefus = null;
      delete app.save.bestLaps[cle]; delete app.save.bestLapsNets[cle];
      if (eteindre) app.save.showLines = false;
      moi.bestLap = 61.234; moi.finished = true; moi.finishTime = 61.234; r.state = 'finished';
      r.results = [{ car: moi, pos: 1, points: 0, time: 61.234, brut: 61.234, penalite: 0, fautes: 0, bestLap: 61.234, gap: null }];
      app._onRaceFinished();
      await new Promise((res) => setTimeout(res, 200));
      return { perso: app.save.bestLaps[cle], net: app.save.bestLapsNets[cle], propose,
        refus: app.mondial.dernierRefus && app.mondial.dernierRefus.raison };
    }, eteindre);
    const guide = await fin(false);
    ok(guide.perso === 61.234, 'le tour guidé entre au record personnel');
    ok(guide.net == null && guide.propose === 0, 'il n\'entre pas au registre net et n\'est pas proposé au monde');
    ok(guide.refus === 'aides', `le motif est nommé (${guide.refus})`);

    const relance = async (guideAuDepart) => p.evaluate(async (g) => {
      app.save.showLines = g; app.renderer.showLines = g;
      app.startQuick('timetrial', 'gt', 'monza');
      await new Promise((res) => { const w = () => (app.race && app.race.state === 'racing' ? res() : setTimeout(w, 50)); w(); });
    }, guideAuDepart);
    await relance(true);
    const eteint = await fin(true);
    ok(eteint.net == null && eteint.propose === 0, 'guide éteint avant la fin : le tour reste hors du monde');

    await relance(false);
    const net = await fin(false);
    ok(net.net === 61.234 && net.propose === 1, 'sans le guide, le même tour part au tableau mondial');

    ok(!erreurs.length, 'aucune erreur JS' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } finally { await b.close(); }
  console.log('\n' + fautes + ' faute(s)');
  process.exit(fautes ? 1 : 0);
})();
