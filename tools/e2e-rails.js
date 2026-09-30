// Les rails de sélection et la table des records.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-rails.js [dossier]
//
// Trois changements, et chacun a un mode de panne qui ne se voit pas sur une capture.
//
// 1. Les circuits perso sont retirés de l'écran de sélection. Le piège n'est pas la liste, c'est
//    le circuit qui restait SÉLECTIONNÉ chez qui en avait un : plus aucune carte ne porte alors la
//    marque, et la course part sur un tracé absent de l'écran. On plante donc un circuit perso
//    dans le réglage avant d'ouvrir l'écran, et on vérifie que la sélection a bien été rapatriée.
//
// 2. Les deux grilles deviennent des rails. Un rail, c'est une boîte qui déborde : si les cartes
//    reviennent à la ligne au lieu de se suivre, `scrollWidth` vaut `clientWidth` et il n'y a plus
//    rien à faire défiler — l'écran a l'air correct et le geste ne sert à rien. On mesure donc le
//    débordement, et on vérifie qu'un choix fait à l'autre bout du rail n'y ramène pas au début :
//    l'écran est repeint à chaque choix, et c'est là que la position se perd.
//
// 3. Les records passent à une ligne par voiture. On écrit deux temps sur deux voitures, et on
//    lit ce que l'écran affiche : le bon temps en face de la bonne voiture, une vignette à gauche
//    de chaque ligne, et le classement par temps croissant avec les voitures vierges à la fin.
const { chromium, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const out = process.argv[2] || '/tmp';

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.json': 'application/json', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const serveur = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    res.end(d);
  });
});

(async () => {
  await new Promise((r) => serveur.listen(0, r));
  const base = 'http://127.0.0.1:' + serveur.address().port;
  const nav = await chromium.launch();
  let fautes = 0, erreurs = 0;
  const dit = (ok, txt) => { if (!ok) fautes++; console.log(`  ${ok ? 'ok  ' : 'FAUX'}  ${txt}`); };

  for (const [nom, opt] of [['iPhone 13', devices['iPhone 13']], ['bureau', { viewport: { width: 1280, height: 800 } }]]) {
    const ctx = await nav.newContext(opt);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { erreurs++; console.log('[pageerror]', e.message); });
    console.log(`\n${nom}`);

    await page.goto(base + '/index.html');
  /* Un joueur nommé. Le menu ne s'ouvre plus sans nom, et un essai doit faire ce que fait un
  joueur. On attend que `app` existe : `goto` rend la main au chargement, pas à l'initialisation. */
  await page.waitForFunction(() => typeof app !== 'undefined' && app.save);
  await page.evaluate(() => {
    app.save.name = 'Testeur'; storeSave(app.save);
    /* Et pas de tableau mondial : ces essais mesurent des menus, pas un service distant. Le
    laisser branché ferait partir une requête réseau à chaque ouverture de l'écran des records —
    une source d'échecs qui n'a rien à voir avec ce qu'on vérifie, et qui rendrait la suite
    dépendante d'un serveur. `tools/e2e-mondial.js` s'en charge, avec un faux serveur à lui. */
    app.mondial = null;
  });
    await page.waitForTimeout(400);

    // --- 1. un circuit perso planté dans le réglage ne doit pas survivre à l'ouverture ---
    await page.evaluate(() => { app.ui.setup.trackId = 'track-fantome'; });
    await page.keyboard.press('Enter');
    // le bandeau du menu se déplie avant d'agir : l'écran n'arrive qu'après l'animation
    await page.click('[data-action="setup"][data-mode="race"]');
    await page.waitForSelector('[data-rail="tracks"]', { timeout: 5000 });
    await page.waitForTimeout(200);
    const choisi = await page.evaluate(() => ({
      id: app.ui.setup.trackId,
      standard: TRACKS.some(t => t.id === app.ui.setup.trackId),
      marques: document.querySelectorAll('[data-rail="tracks"] .card.sel').length,
      zonePerso: /perso|custom/i.test([...document.querySelectorAll('h3')].map(h => h.textContent).join('|')),
    }));
    dit(choisi.standard, `circuit fantome rapatrie sur un circuit standard (${choisi.id})`);
    dit(choisi.marques === 1, `exactement une carte circuit porte la marque (${choisi.marques})`);
    dit(!choisi.zonePerso, 'aucun titre « circuits perso » a l\'ecran');

    /* --- 1 bis. sous un circuit : le drapeau et la longueur, rien d'autre --- */
    const sous = await page.evaluate(() => [...document.querySelectorAll('[data-rail="tracks"] .card')].map(c => ({
      titre: c.querySelector('b').textContent.trim(),
      sous: (c.querySelector('small') || {}).textContent || '',
    })));
    /* Le drapeau est descendu d'une ligne : il vit avec la longueur, sous le nom. Le titre ne
    porte donc plus que le nom, et c'est la deuxième ligne qui doit être « drapeau + mètres ». */
    const tours = sous.filter(c => /tours?|laps?/i.test(c.sous));
    const drapeauHaut = sous.filter(c => /\p{Regional_Indicator}|\p{Extended_Pictographic}/u.test(c.titre));
    const forme = sous.filter(c => /^(\p{Regional_Indicator}{2}|\p{Extended_Pictographic})\s+\d+ m$/u.test(c.sous.trim())
      || /verrou|lock/i.test(c.sous));
    dit(tours.length === 0, `aucune carte circuit ne mentionne les tours${tours.length ? ' — ' + tours[0].sous : ''}`);
    dit(drapeauHaut.length === 0, `le nom seul sur la première ligne${drapeauHaut.length ? ' — ' + drapeauHaut[0].titre : ''}`);
    dit(forme.length === sous.length,
      `deuxième ligne = drapeau + longueur, ou « verrouillé » (${forme.length} sur ${sous.length}) — ex. « ${sous[0].sous.trim()} »`);

    // --- 2. les rails débordent-ils vraiment, et gardent-ils leur place ? ---
    for (const r of ['models', 'tracks']) {
      const m = await page.evaluate((n) => {
        const el = document.querySelector(`[data-rail="${n}"]`);
        const cartes = el.querySelectorAll('.card');
        const hauteurs = new Set([...cartes].map(c => Math.round(c.getBoundingClientRect().top)));
        return { deborde: el.scrollWidth - el.clientWidth, n: cartes.length, lignes: hauteurs.size };
      }, r);
      dit(m.deborde > 50, `rail ${r} : ${m.n} cartes, ${m.deborde} px a faire defiler`);
      dit(m.lignes === 1, `rail ${r} : une seule ligne (${m.lignes})`);
    }

    // le choix de la DERNIÈRE carte ne doit pas ramener le rail au début
    const garde = await page.evaluate(async () => {
      const el = document.querySelector('[data-rail="models"]');
      el.scrollLeft = el.scrollWidth;
      const avant = el.scrollLeft;
      const cartes = el.querySelectorAll('.card');
      cartes[cartes.length - 1].click();
      await new Promise(r => setTimeout(r, 250));
      const ap = document.querySelector('[data-rail="models"]');
      const sel = ap.querySelector('.card.sel');
      return { avant, apres: ap.scrollLeft,
               visible: sel ? sel.offsetLeft >= ap.scrollLeft - 4 && sel.offsetLeft + sel.offsetWidth <= ap.scrollLeft + ap.clientWidth + 4 : false };
    });
    dit(Math.abs(garde.apres - garde.avant) < 4, `rail garde sa place apres un choix (${Math.round(garde.avant)} -> ${Math.round(garde.apres)} px)`);
    dit(garde.visible, 'la carte choisie reste dans le champ');

    /* --- 2 bis. la PAGE ne doit pas glisser de côté --- */
    /* `overflow-y: auto` seul ne veut pas dire ce qu'on croit : dès qu'un axe passe à `auto`,
    l'autre ne peut plus rester `visible` et devient `auto` lui aussi. L'écran était donc
    horizontalement scrollable depuis toujours — 869 px de glissement sur un iPhone 13 — sans que
    ça se voie tant que rien ne débordait. Avec les rails, une inflexion du pouce emportait la page
    entière de côté et laissait une bande vide à l'écran. On balaie donc pour de vrai, ailleurs que
    sur un rail : lire la propriété CSS ne suffit pas, c'est le geste qui doit rester sans effet. */
    const titre = await page.locator('h3').first().boundingBox();
    const cy = titre.y + titre.height / 2;
    await page.mouse.move(titre.x + titre.width - 20, cy);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(titre.x + titre.width - 20 - i * 25, cy);
    await page.mouse.up();
    await page.waitForTimeout(250);
    const page_ = await page.evaluate(() => {
      const sc = document.querySelector('.screen');
      return { glisse: sc.scrollLeft, ovx: getComputedStyle(sc).overflowX };
    });
    dit(page_.glisse === 0 && page_.ovx === 'hidden',
      `un balayage latéral hors rail ne déplace pas la page (${page_.glisse} px, overflow-x ${page_.ovx})`);

    // --- 3. les records, une ligne par voiture ---
    const rec = await page.evaluate(async () => {
      const cat = categoryById(app.ui.setup.classId), ms = modelsOf(cat.id);
      const tr = app.ui.setup.trackId;
      app.save.bestLaps[`${tr}|${cat.id}|${ms[2].id}`] = 61.5;
      app.save.bestLaps[`${tr}|${cat.id}|${ms[0].id}`] = 88.25;
      app.ui.setupScreen('timetrial');
      await new Promise(r => setTimeout(r, 250));
      const lignes = [...document.querySelectorAll('.rline')].map(e => ({
        nom: e.querySelector('b').textContent,
        temps: e.querySelector('.rline-t').textContent.trim(),
        vignette: !!e.querySelector('.rline-img canvas, .rline-img img'),
      }));
      return { lignes, attendu: ms.length, rapide: ms[2].name, lent: ms[0].name };
    });
    dit(rec.lignes.length === rec.attendu, `une ligne par voiture (${rec.lignes.length} sur ${rec.attendu})`);
    dit(rec.lignes.every(l => l.vignette), 'chaque ligne porte sa vignette a gauche');
    dit(rec.lignes[0].nom === rec.rapide && rec.lignes[0].temps === '1:01.500',
      `la plus rapide en tete : ${rec.lignes[0].nom} ${rec.lignes[0].temps}`);
    dit(rec.lignes[1].nom === rec.lent && rec.lignes[1].temps === '1:28.250',
      `puis la seconde : ${rec.lignes[1].nom} ${rec.lignes[1].temps}`);
    dit(rec.lignes.slice(2).every(l => l.temps === '--:--.---'),
      `les ${rec.lignes.length - 2} voitures sans temps a la fin`);

    await page.screenshot({ path: path.join(out, `rails-${nom.replace(/\W+/g, '')}.png`), fullPage: false });
    await ctx.close();
  }

  // --- le temps par voiture est-il ÉCRIT en fin de course ? ---
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { erreurs++; console.log('[pageerror]', e.message); });
  await page.goto(base + '/index.html');
  /* Un joueur nommé. Le menu ne s'ouvre plus sans nom, et un essai doit faire ce que fait un
  joueur. On attend que `app` existe : `goto` rend la main au chargement, pas à l'initialisation. */
  await page.waitForFunction(() => typeof app !== 'undefined' && app.save);
  await page.evaluate(() => {
    app.save.name = 'Testeur'; storeSave(app.save);
    /* Et pas de tableau mondial : ces essais mesurent des menus, pas un service distant. Le
    laisser branché ferait partir une requête réseau à chaque ouverture de l'écran des records —
    une source d'échecs qui n'a rien à voir avec ce qu'on vérifie, et qui rendrait la suite
    dépendante d'un serveur. `tools/e2e-mondial.js` s'en charge, avec un faux serveur à lui. */
    app.mondial = null;
  });
  await page.waitForTimeout(300);
  const ecrit = await page.evaluate(async () => {
    app.save.bestLaps = {};
    await new Promise(r => setTimeout(r, 50));
    app.startQuick('timetrial', app.ui.setup.classId, app.ui.setup.trackId);
    await new Promise(r => setTimeout(r, 200));
    for (let i = 0; i < 12000 && app.state === 'race'; i++) app.race.update(1 / 60, app.input);
    const r = app.race;
    r.player.bestLap = 72.5;
    app.endTimeTrial();
    await new Promise(r2 => setTimeout(r2, 200));
    return { cles: Object.keys(app.save.bestLaps), attendu: `${r.track.id}|${r.cat.id}|${r.cls.id}` };
  });
  /* La pastille « Nouveau record ! » de l'écran de fin porte la classe `.rec`.

  Les lignes de records ont commencé par s'appeler pareil, et mes règles, écrites plus bas dans la
  feuille, passaient par-dessus les siennes : un bout de phrase en ligne devenait une grille pleine
  largeur avec un fond de carte. Rien ne le signalait — deux écrans éloignés, une classe commune.
  On vérifie donc qu'elle reste un morceau de texte. */
  const pastille = await page.evaluate(async () => {
    app.ui.show('<div class="bigstat">x <span class="rec">Nouveau record !</span></div>', 'scroll');
    await new Promise(r => setTimeout(r, 100));
    const cs = getComputedStyle(document.querySelector('.bigstat .rec'));
    return { display: cs.display, fond: cs.backgroundColor };
  });
  console.log('\nfin de course');
  dit(pastille.display === 'inline' && pastille.fond === 'rgba(0, 0, 0, 0)',
    `la pastille « nouveau record » reste du texte en ligne (${pastille.display}, fond ${pastille.fond})`);
  dit(ecrit.cles.includes(ecrit.attendu), `la cle par voiture est ecrite (${ecrit.attendu})`);
  dit(ecrit.cles.some(k => k.split('|').length === 2), 'la cle du circuit reste ecrite aussi');
  await ctx.close();

  console.log(`\nfautes ${fautes} | erreurs ${erreurs}`);
  await nav.close();
  serveur.close();
  process.exit(fautes || erreurs ? 1 : 0);
})();
