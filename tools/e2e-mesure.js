// L'ÉDITEUR : le viseur, les pas fins, la règle, et la vérification de l'annonce.
//
//   node tools/e2e-mesure.js
//
// Les trois servent à la même chose — poser une indication au bon endroit — et aucune ne se vérifie
// en lisant le code : une règle qui donne le mauvais sens de parcours, un pas qui déplace de
// quelques stations au lieu de quelques mètres, un viseur qui se pose ailleurs qu'où le doigt
// touche, tout cela se lit juste et se mesure faux. On conduit donc la page.
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 900, height: 1000 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message)));
  await page.goto('file:///home/user/Slot_car_racing/lignes.html');
  await page.waitForFunction(() => typeof S !== 'undefined' && S.track, null, { timeout: 60000 });

  let fautes = 0;
  const dire = (ok, quoi, detail) => {
    if (!ok) fautes++;
    console.log('  ' + (ok ? 'ok  ' : 'FAUX') + ' ' + quoi + (detail ? '   ' + detail : ''));
  };

  // --- le viseur se pose là où on touche, et pas ailleurs ---
  await page.click('[data-mode="panneaux"]');
  const viseur = await page.evaluate(() => {
    const T = S.track, u = T.unitScale;
    /* On vise une station LIBRE. La première version touchait une fraction fixe du tour, qui à
    Monza tombait pile sur un panneau : l'appui le sélectionnait, le viseur ne bougeait pas, et le
    banc accusait le viseur d'un défaut qui n'était que le sien. */
    const pris = new Set(panneauxPoses().map((b) => Math.round(b.at * T.n)));
    let j = Math.round(T.n * 0.31);
    while ([...pris].some((k) => Math.abs(k - j) < T.n * 0.03)) j = (j + Math.round(T.n * 0.01)) % T.n;
    const e = [T.xs[j] / u * S.vue.k + S.vue.x, T.ys[j] / u * S.vue.k + S.vue.y];
    const r = cv.getBoundingClientRect();
    const ev = (t, dx) => cv.dispatchEvent(new PointerEvent(t, { pointerId: 1, bubbles: true,
      clientX: r.left + e[0] + (dx || 0), clientY: r.top + e[1] }));
    ev('pointerdown'); ev('pointerup');
    return { vise: S.viseur, voulu: j, n: T.n };
  });
  dire(Math.abs(viseur.vise - viseur.voulu) <= 2, 'le viseur se pose sur la station touchée',
    `visé ${viseur.vise}, voulu ${viseur.voulu}`);

  // --- un appui QUI GLISSE déplace la carte et ne pose rien ---
  const glisse = await page.evaluate(() => {
    const avant = S.viseur, vx = S.vue.x;
    const r = cv.getBoundingClientRect();
    const ev = (t, dx) => cv.dispatchEvent(new PointerEvent(t, { pointerId: 2, bubbles: true,
      clientX: r.left + 400 + dx, clientY: r.top + 400 }));
    ev('pointerdown', 0); ev('pointermove', 60); ev('pointerup', 60);
    return { bouge: S.viseur !== avant, carte: Math.abs(S.vue.x - vx) > 30 };
  });
  dire(!glisse.bouge, 'un appui qui glisse ne déplace pas le viseur');
  dire(glisse.carte, 'un appui qui glisse déplace bien la carte');

  // --- « Ajouter » pose le panneau AU VISEUR ---
  const ajout = await page.evaluate(() => {
    document.getElementById('ajoutP').click();
    const b = S.panneaux[S.selP];
    return { at: b.at, j: Math.round(b.at * S.track.n), vise: S.viseur };
  });
  dire(Math.abs(ajout.j - ajout.vise) <= 1, 'le panneau neuf se pose au viseur',
    `station ${ajout.j} contre ${ajout.vise}`);

  // --- les pas fins déplacent en MÈTRES, pas en stations ---
  const pas = await page.evaluate(() => {
    const T = S.track, av = S.panneaux[S.selP].at * T.length;
    document.querySelector('#pasP [data-pas="10"]').click();
    const ap = S.panneaux[S.selP].at * T.length;
    document.querySelector('#pasP [data-pas="-1"]').click();
    const ap2 = S.panneaux[S.selP].at * T.length;
    return { d1: ap - av, d2: ap2 - ap };
  });
  dire(Math.abs(pas.d1 - 10) < 1.5, 'le pas +10 m déplace de dix mètres', pas.d1.toFixed(2) + ' m');
  dire(Math.abs(pas.d2 + 1) < 1.5, 'le pas −1 m déplace d’un mètre', pas.d2.toFixed(2) + ' m');

  // --- la vérification compare l'annonce à la distance réelle au virage ---
  const verif = await page.evaluate(() => {
    const T = S.track, zones = T.zonesVirages(60);
    // on pose un panneau exactement 100 m avant l'entrée d'une zone : le réel doit valoir 100
    const e = (((zones[0].from % T.n) + T.n) % T.n);
    const j = ((e - Math.round(100 / T.ds)) % T.n + T.n) % T.n;
    S.panneaux[S.selP].at = j / T.n;
    S.panneaux[S.selP].dist = 100;
    majFicheP();
    return document.getElementById('verifP').textContent;
  });
  const m = /réel (\d+) m/.exec(verif);
  dire(!!m && Math.abs(+m[1] - 100) <= 2, 'l’annonce est comparée à la vraie distance', verif);

  // --- la règle : le long du tour, le retour, et la corde ---
  await page.click('[data-mode="mesure"]');
  const regle = await page.evaluate(() => {
    const T = S.track, u = T.unitScale;
    const a = Math.round(T.n * 0.10), b = Math.round(T.n * 0.30);
    const r = cv.getBoundingClientRect();
    const touche = (j, id) => {
      const e = [T.xs[j] / u * S.vue.k + S.vue.x, T.ys[j] / u * S.vue.k + S.vue.y];
      const ev = (t) => cv.dispatchEvent(new PointerEvent(t, { pointerId: id, bubbles: true,
        clientX: r.left + e[0], clientY: r.top + e[1] }));
      ev('pointerdown'); ev('pointerup');
    };
    touche(a, 10); touche(b, 11);
    const lire = (id) => parseFloat(document.getElementById(id).textContent);
    return { long: lire('mLong'), retour: lire('mRetour'), droit: lire('mDroit'),
      attendu: (b - a) * T.ds, tour: T.length,
      corde: Math.hypot(T.xs[b] - T.xs[a], T.ys[b] - T.ys[a]) };
  });
  dire(Math.abs(regle.long - regle.attendu) < 3, 'la distance le long du tour est juste',
    regle.long.toFixed(0) + ' m contre ' + regle.attendu.toFixed(0));
  dire(Math.abs(regle.long + regle.retour - regle.tour) < 3, 'aller et retour font le tour complet',
    (regle.long + regle.retour).toFixed(0) + ' m contre ' + regle.tour.toFixed(0));
  dire(Math.abs(regle.droit - regle.corde) < 3, 'la corde est bien à vol d’oiseau',
    regle.droit.toFixed(0) + ' m');
  dire(regle.droit < regle.long, 'la corde est plus courte que le trajet, forcément');

  // --- la règle reste visible dans les autres volets ---
  await page.click('[data-mode="panneaux"]');
  const reste = await page.evaluate(() => S.mesure.length);
  dire(reste === 2, 'la mesure survit au changement de volet');

  console.log('\nfautes ' + fautes + ' | erreurs ' + errs.length);
  if (errs.length) console.log(errs.join('\n'));
  await b.close();
  process.exit(fautes || errs.length ? 1 : 0);
})();
