// Le palmarès : les trophées par circuit et par voiture, du chocolat au crâne (js/palmares.js).
//
//   python3 -m http.server 8770 --bind 127.0.0.1 &   (à la racine du dépôt)
//   NODE_PATH=$(npm root -g) node tools/e2e-palmares.js [http://127.0.0.1:8770]
//
// On vérifie :
// - les règles : premier en course rapide, au moins trois tours, le niveau donne le trophée, on garde
//   le meilleur ; rien en contre-la-montre, en multijoueur, en championnat, ni en réglage ;
// - une vraie fin de course gagnée : le trophée entre dans la sauvegarde et s'affiche en grand sur
//   l'écran des résultats ;
// - l'écran de course rapide montre le palmarès sous le circuit (une ligne par voiture), celui du
//   contre-la-montre garde ses records ; plus aucune note de pilotage (les pneus) nulle part ;
// - la synchronisation avec le compte, contre un serveur simulé : envoi du palmarès de l'appareil,
//   fusion de ce que le compte a de mieux, et palmarès local intact quand la base n'a pas encore la
//   fonction (404).
'use strict';
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8770';
let fautes = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAUX  ') + m); if (!c) fautes++; };

(async () => {
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    // le serveur du palmarès, simulé : il garde le meilleur niveau par couple, comme supabase/palmares.sql
    let serveur = { 'monza|f40': 4 }, recu = null, absent = false;
    await ctx.route('**/rest/v1/rpc/synchro_palmares', async (r) => {
      if (absent) return r.fulfill({ status: 404, body: '{}' });
      recu = JSON.parse(r.request().postData() || '{}');
      for (const l of recu.p_lignes || []) { const k = `${l.c}|${l.v}`; if (!(serveur[k] >= l.n)) serveur[k] = l.n; }
      const rows = Object.entries(serveur).map(([k, n]) => { const [circuit, voiture] = k.split('|'); return { circuit, voiture, niveau: n }; });
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    });
    const p = await ctx.newPage();
    const erreurs = [];
    p.on('pageerror', (e) => erreurs.push(e.message));
    await p.goto(BASE + '/index.html');
    await p.waitForFunction(() => typeof app !== 'undefined' && app.save && typeof attribueTrophee === 'function');
    await p.evaluate(() => { app.save.palmares = {}; app.save.name = 'Essai'; app.save.lang = 'fr'; app.mondial.sortir(); app.mondial.erreurConnexion = null; if (app.state === 'splash') app.leaveSplash(); });

    // --- les règles ---
    const regles = await p.evaluate(() => {
      const save = { palmares: {} };
      const course = (o) => {
        const player = { isPlayer: true, finished: o.fini !== false };
        return { mode: o.mode || 'race', reglage: !!o.reglage, laps: o.tours || 5, opts: { difficulty: o.niveau }, track: { id: 'spa' }, cls: { id: '962' }, player,
          results: [{ car: o.pos === 2 ? { isPlayer: false } : player, pos: 1 }, { car: o.pos === 2 ? player : { isPlayer: false }, pos: 2 }] };
      };
      const r = [];
      r.push(attribueTrophee(save, course({ niveau: 'hard' })));
      r.push(attribueTrophee(save, course({ niveau: 'medium' })));
      r.push(attribueTrophee(save, course({ niveau: 'cauchemar' })));
      r.push(attribueTrophee(save, course({ niveau: 'extreme', tours: 2 })));
      r.push(attribueTrophee(save, course({ niveau: 'extreme', pos: 2 })));
      r.push(attribueTrophee(save, course({ niveau: 'extreme', mode: 'timetrial' })));
      r.push(attribueTrophee(save, course({ niveau: 'extreme' }), { online: true }));
      r.push(attribueTrophee(save, course({ niveau: 'extreme' }), { cup: { id: 'x' } }));
      r.push(attribueTrophee(save, course({ niveau: 'extreme', reglage: true })));
      r.push(attribueTrophee({ palmares: {} }, course({ niveau: 'easy', tours: 3 })));
      return { r, palmares: save.palmares };
    });
    const [dur, moyen, cauch, court, second, tt, enLigne, coupe, reglage, choco] = regles.r;
    ok(dur && dur.nouveau && dur.rang === 2, 'premier en Difficile : l’argent');
    ok(moyen && !moyen.nouveau && moyen.ancien === 2, 'puis premier en Normal : l’argent reste, pas de nouveau trophée');
    ok(cauch && cauch.nouveau && cauch.rang === 4 && regles.palmares['spa|962'] === 4, 'premier en Cauchemar : le crâne remplace l’argent');
    ok(court && !court.nouveau && court.raison === 'tours', 'une victoire en deux tours ne rapporte rien, et le dit');
    ok(second === null && tt === null && enLigne === null && coupe === null && reglage === null, 'rien pour un deuxième, en contre-la-montre, en multijoueur, en championnat ni en réglage');
    ok(choco && choco.nouveau && choco.rang === 0, 'premier en Facile sur trois tours : le chocolat');

    // --- une vraie fin de course gagnée ---
    const fin = await p.evaluate(async () => {
      app.save.difficulty = 'extreme'; app.save.laps = 3; app.mondial = app.mondial || null;
      app.startQuick('race', 'gt', 'monza');
      await new Promise((res) => { const w = () => (app.race && app.race.state === 'racing' ? res() : setTimeout(w, 50)); w(); });
      const r = app.race, moi = r.player;
      moi.finished = true; moi.finishTime = 200; r.state = 'finished';
      r.results = [{ car: moi, pos: 1, points: 0, time: 200, brut: 200, penalite: 0, fautes: 0, bestLap: 66, gap: null }]
        .concat(r.cars.filter((c) => !c.isPlayer).map((c, i) => ({ car: c, pos: i + 2, points: 0, time: 210 + i, brut: 210 + i, penalite: 0, fautes: 0, bestLap: 70, gap: 10 + i })));
      app._onRaceFinished();
      await new Promise((res) => setTimeout(res, 300));
      const g = document.querySelector('.trophee-gagne');
      return { cle: `monza|${r.cls.id}`, n: app.save.palmares[`monza|${r.cls.id}`], banniere: g ? g.querySelector('b').textContent.trim() : null, svg: !!(g && g.querySelector('svg.trophee-or')),
        nuage: g && g.querySelector('.nuage-etat') ? g.querySelector('.nuage-etat').className : null,
        stocke: JSON.parse(localStorage.getItem(SAVE_KEY)).palmares[`monza|${r.cls.id}`] };
    });
    ok(fin.n === 3 && fin.stocke === 3, `une course gagnée en Extrême : l’or entre dans la sauvegarde (${fin.cle})`);
    ok(fin.svg && /Nouveau trophée : Or \(Extrême\)/.test(fin.banniere || ''), `et s’affiche en grand sur les résultats (« ${fin.banniere} »)`);
    ok(/nuage-local/.test(fin.nuage || ''), 'hors connexion, le trophée gagné porte le nuage gris');

    // --- l'écran de course rapide ---
    const ecran = await p.evaluate(async () => {
      app.state = 'menu'; app.ui.setup.trackId = 'monza'; app.ui.setupScreen('race');
      await new Promise((res) => setTimeout(res, 300));
      const bloc = document.querySelector('.setup-records');
      const lignes = [...bloc.querySelectorAll('.records.palmares .rline')];
      const premiere = lignes[0];
      const course = { titre: bloc.querySelector('h3').textContent, n: lignes.length, premiere: premiere ? premiere.textContent.replace(/\s+/g, ' ').trim() : '',
        or: !!(premiere && premiere.querySelector('svg.trophee-or')), records: !!bloc.querySelector('.records:not(.palmares)'),
        pneus: document.querySelectorAll('.tyres, .stat-pilotage').length,
        compte: !!bloc.querySelector('.palmares-tete .nuage-etat.nuage-local [data-action="google"]') && bloc.querySelector('.nuage-etat').textContent.includes('Sur cet appareil') };
      app.ui.setupScreen('timetrial');
      await new Promise((res) => setTimeout(res, 300));
      const b2 = document.querySelector('.setup-records');
      return { course, cm: { titre: b2.querySelector('h3').textContent, palmares: !!b2.querySelector('.palmares'), records: !!b2.querySelector('.records') } };
    });
    ok(ecran.course.titre === 'Ton palmarès' && ecran.course.n >= 9 && !ecran.course.records, `sous la course rapide : « Ton palmarès », ${ecran.course.n} voitures`);
    ok(ecran.course.or && /Or/.test(ecran.course.premiere) && /Extrême/.test(ecran.course.premiere), `la voiture titrée en tête, avec son or (« ${ecran.course.premiere} »)`);
    ok(ecran.course.compte, 'hors connexion : nuage gris « Sur cet appareil », et de quoi se connecter');
    ok(ecran.cm.titre !== 'Ton palmarès' && !ecran.cm.palmares && ecran.cm.records, 'le contre-la-montre garde ses records');
    ok(ecran.course.pneus === 0, 'plus aucune note de pilotage (pneus) à l’écran');

    // --- la synchronisation avec le compte ---
    const synchro = await p.evaluate(async () => {
      app.mondial.session = { token: 'jeton-essai', expire: Date.now() / 1000 + 3600, sub: 'x', nom: 'Essai' };
      const change = await PalmaresSync.synchronise(app.mondial, app.save);
      return { change, etat: PalmaresSync.etat, monzaF40: app.save.palmares['monza|f40'], stocke: JSON.parse(localStorage.getItem(SAVE_KEY)).palmares['monza|f40'] };
    });
    ok(recu && recu.p_canal === 'recette' && recu.p_lignes.some((l) => l.c === 'monza' && l.n === 3), `l’appareil envoie son palmarès (canal « ${recu && recu.p_canal} », ${recu ? recu.p_lignes.length : 0} ligne(s))`);
    ok(synchro.etat === 'ok' && synchro.change && synchro.monzaF40 === 4 && synchro.stocke === 4, 'et récupère ce que le compte a gagné ailleurs (le crâne à Monza en Furia 40)');
    const nuageOk = await p.evaluate(() => { app.ui.setupScreen('race'); const n = document.querySelector('.palmares-tete .nuage-etat'); return n ? n.className + ' ' + n.textContent.trim() : ''; });
    ok(/nuage-ok/.test(nuageOk) && /Enregistré sur ton compte/.test(nuageOk), `connecté et enregistré : nuage blanc (« ${nuageOk.replace(/.*nuage-ok\s*/, '')} »)`);
    // à l'arrivée, connecté : le nuage tourne pendant l'envoi, puis devient blanc, sans repeindre l'écran
    let relache; const attente = new Promise((r) => { relache = r; });
    await ctx.unroute('**/rest/v1/rpc/synchro_palmares');
    await ctx.route('**/rest/v1/rpc/synchro_palmares', async (r) => { await attente; await r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); });
    const pendant = await p.evaluate(async () => {
      app.save.difficulty = 'cauchemar'; app.save.laps = 3; app.startQuick('race', 'gt', 'spa');
      await new Promise((res) => { const w = () => (app.race && app.race.state === 'racing' ? res() : setTimeout(w, 50)); w(); });
      const r = app.race, moi = r.player; moi.finished = true; moi.finishTime = 300; r.state = 'finished';
      r.results = [{ car: moi, pos: 1, points: 0, time: 300, brut: 300, penalite: 0, fautes: 0, bestLap: 99, gap: null }];
      app._onRaceFinished(); await new Promise((res) => setTimeout(res, 200));
      window.__ecran = document.querySelector('.trophee-gagne');
      return document.querySelector('.trophee-gagne .nuage-etat').className;
    });
    relache();
    await p.waitForFunction(() => /nuage-ok/.test((document.querySelector('.trophee-gagne .nuage-etat') || {}).className || ''), null, { timeout: 5000 }).catch(() => {});
    const apres = await p.evaluate(() => ({ cls: document.querySelector('.trophee-gagne .nuage-etat').className, meme: window.__ecran === document.querySelector('.trophee-gagne') }));
    ok(/nuage-synchro/.test(pendant) && /nuage-ok/.test(apres.cls) && apres.meme, 'à l’arrivée, connecté : le nuage tourne pendant l’envoi puis devient blanc, sans repeindre l’écran');
    // la base sans la fonction : le serveur répond 404
    await ctx.unroute('**/rest/v1/rpc/synchro_palmares');
    await ctx.route('**/rest/v1/rpc/synchro_palmares', (r) => r.fulfill({ status: 404, body: '{}' }));
    absent = true;
    const indispo = await p.evaluate(async () => {
      const avant = JSON.stringify(app.save.palmares);
      await PalmaresSync.synchronise(app.mondial, app.save);
      app.ui.setupScreen('race'); await new Promise((res) => setTimeout(res, 200));
      return { etat: PalmaresSync.etat, intact: JSON.stringify(app.save.palmares) === avant, dit: !!document.querySelector('.palmares-tete .nuage-etat.nuage-local') };
    });
    ok(indispo.etat === 'indisponible' && indispo.intact && indispo.dit, 'base sans la fonction (404) : le palmarès local reste, nuage gris');
    await p.evaluate(() => { app.mondial.sortir(); app.save.palmares = {}; storeSave(app.save); });
    ok(!erreurs.length, 'aucune erreur de page' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } finally {
    await b.close();
  }
  console.log(fautes ? `${fautes} faute(s)` : 'OK');
  process.exitCode = fautes ? 1 : 0;
})();
