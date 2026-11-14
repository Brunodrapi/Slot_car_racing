// L'entraînement (0.52.63) : un contre-la-montre avec le guide de freinage et un fantôme.
//
//   python3 -m http.server 8770 --bind 127.0.0.1 &   (à la racine du dépôt)
//   NODE_PATH=$(npm root -g) node tools/e2e-entrainement.js [http://127.0.0.1:8770] [dossier de captures]
//
// On vérifie :
// - le menu principal a l'entrée « Entraînement » ; elle ouvre son paddock, sans connexion Google ni état
//   du tableau mondial (aucun tour n'y part), ni note ni légende (0.52.70) : elles sont dans la pause, qui
//   dit ce qu'est le mode, sur un papier, et n'a plus le rappel des commandes ;
// - le guide (0.52.65) dit au doigt quoi faire — rouge : lâche, pointillé : dose, chevrons verts : gaz — et
//   le calcule sur la vitesse du joueur ; un pilote qui lui obéit boucle ses tours sans sortir ; la
//   pause en donne la légende, et le mot de la consigne s'affiche près de la commande ;
// - en piste : un contre-la-montre à deux voitures, le guide de freinage peint, et le fantôme — la même
//   voiture et la même livrée que le joueur, au niveau difficile (sans triche d'adhérence), parti du même emplacement, sur la
//   ligne idéale, peint en transparence ;
// - le fantôme n'existe pour personne : sa course est IDENTIQUE, au centimètre, que le joueur reste sur
//   la grille ou roule dans ses roues ; le joueur n'en reçoit ni aspiration ni gêne ; une sortie du
//   fantôme ne lève pas de drapeau jaune ;
// - l'écran affiche la place et l'écart au fantôme comme en course (« P 2/2 », « FANTÔME +1.2 s ») ;
// - le record : un tour d'entraînement entre au record personnel, PAS au tableau mondial, et le motif
//   est nommé ; le même tour en contre-la-montre y part bien ;
// - les résultats nomment le mode et donnent le meilleur tour du fantôme ;
// - un contre-la-montre lancé ensuite n'a ni fantôme ni guide.
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.argv[2] || 'http://127.0.0.1:8770';
const OUT = process.argv[3] || null;
const GUIDE_LEVE_ATTENDU = 2;         // GUIDE_LEVE (js/race.js)
const DIFFICULTE_ATTENDUE = 0.93;     // la marge de base du niveau difficile (DIFFICULTY.hard, js/race.js)
let fautes = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAUX  ') + m); if (!c) fautes++; };

(async () => {
  const b = await chromium.launch();
  try {
    const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    const erreurs = [];
    p.on('pageerror', (e) => erreurs.push(e.message));
    await p.goto(BASE + '/index.html');
    await p.waitForFunction(() => typeof app !== 'undefined' && app.save && app.ui && typeof tourNet === 'function');
    await p.evaluate(() => { app.save.lang = 'fr'; app.save.name = 'Essai'; app.save.tutorialSeen = true; if (app.state === 'splash') app.leaveSplash(); app.ui.menu(); });

    // --- le menu et le paddock ---
    const carte = await p.evaluate(() => { const c = document.querySelector('.mode-card.mode-training'); return c ? { texte: c.textContent.trim(), image: c.querySelector('img').complete && c.querySelector('img').naturalWidth > 0 || c.querySelector('img').src } : null; });
    ok(carte && /Entraînement/i.test(carte.texte), `le menu principal a l'entrée « ${carte && carte.texte} »`);
    await p.click('.mode-card.mode-training');
    await p.waitForSelector('.setup-screen');
    const paddock = await p.evaluate(() => ({ titre: document.querySelector('.topbar h2').textContent.trim(), cle: app.ui._cleEcran,
      records: !!document.querySelector('.setup-records .records'), monde: document.querySelectorAll('.records .rline .monde').length,
      note: !!document.querySelector('.entrainement-note'), legende: !!document.querySelector('.guide-legende'),
      mondial: !!app.mondial, google: !!document.querySelector('.setup-records [data-action="google"]'), etat: document.querySelectorAll('.setup-records .mondial-note').length }));
    ok(/Entraînement/i.test(paddock.titre) && paddock.cle === 'depart:training', `paddock « ${paddock.titre} »`);
    ok(paddock.records && paddock.monde > 0, 'il montre les records et la colonne du monde, comme le contre-la-montre');
    // 0.52.70 : « la connexion Google ne sert à rien » — aucun tour n'y part
    ok(paddock.mondial && !paddock.google && paddock.etat === 0, 'ni « Se connecter avec Google » ni l\'état du tableau mondial');
    // 0.52.70 : la note et la légende sont passées dans la pause
    ok(!paddock.note && !paddock.legende, 'ni la note ni la légende du guide au paddock');
    if (OUT) await p.screenshot({ path: path.join(OUT, 'entrainement-paddock.png') });

    // --- en piste ---
    await p.evaluate(() => { app.ui.setup.classId = 'gt'; app.save.cat = 'gt'; app.ui.setup.trackId = 'monza'; app.ui.setupScreen('training'); });
    await p.click('button[data-action=startQuick]');
    await p.waitForFunction(() => app.race && app.race.fantome, null, { timeout: 30000 });
    const depart = await p.evaluate(() => { const r = app.race, f = r.fantome, j = r.player;
      return { mode: r.mode, entr: r.entrainement, n: r.cars.length, memeModele: f.cls.id === j.cls.id, memeLivree: f.livree === j.livree && f.livery === j.livery,
        memePlace: Math.abs(f.s - j.s) < 0.01 && Math.abs(f.lat - j.lat) < 0.01 && Math.abs(f.x - j.x) < 0.01 && Math.abs(f.y - j.y) < 0.01,
        grip: f.gripBoost, niveau: FANTOME.niveau, marge: DIFFICULTY[FANTOME.niveau].marginBase, nom: f.name, guide: app.renderer.showLines, ecran: document.querySelector('#ui').classList.contains('hidden') }; });
    ok(depart.mode === 'timetrial' && depart.entr && depart.n === 2, `un contre-la-montre à deux voitures (${depart.mode}, ${depart.n})`);
    ok(depart.memeModele && depart.memeLivree, 'le fantôme a la voiture et la livrée du joueur');
    ok(depart.memePlace, 'il part du même emplacement');
    ok(depart.niveau === 'hard' && depart.grip === 1 && depart.marge === DIFFICULTE_ATTENDUE, `il roule au niveau difficile, sans triche d'adhérence (×${depart.grip}, marge ${depart.marge})`);
    ok(depart.nom === 'Fantôme', `il s'appelle « ${depart.nom} »`);
    ok(depart.guide === true, 'le guide de freinage est allumé');
    await p.waitForFunction(() => app.race.state === 'racing', null, { timeout: 30000 });

    // la pause de l'entraînement : ce qu'est le mode, et la légende du guide
    await p.evaluate(() => app.togglePause());
    const pause = await p.evaluate(() => { const b = document.querySelector('.pause-entrainement'), l = b && b.querySelector('.guide-legende');
      return { etat: app.state, note: b ? (b.querySelector('.entrainement-note') || {}).textContent || '' : '', legende: l ? l.textContent.replace(/\s+/g, ' ').trim() : '',
        signes: l ? l.querySelectorAll('.guide-signe svg').length : 0, aide: /Maintiens Espace|Poser le pouce/.test(document.querySelector('#ui').textContent),
        fond: b ? getComputedStyle(b).backgroundColor : '' }; });
    ok(pause.etat === 'paused' && /guide/.test(pause.note) && /fantôme/.test(pause.note) && /niveau difficile/.test(pause.note) && /pas pour le tableau mondial/.test(pause.note),
      `la pause dit ce qu'est le mode : « ${pause.note} »`);
    ok(pause.signes === 3 && /lâche le bouton/.test(pause.legende) && /dose/.test(pause.legende) && /remets les gaz/.test(pause.legende),
      `la pause a la légende du guide : « ${pause.legende} »`);
    ok(pause.fond === 'rgb(244, 236, 214)', `sur un papier, lisible sur le voile sombre (${pause.fond})`);
    ok(!pause.aide, 'plus de rappel des commandes dans la pause');
    if (OUT) await p.screenshot({ path: path.join(OUT, 'entrainement-pause.png') });
    await p.click('[data-action="resume"]');
    await p.waitForFunction(() => app.state === 'race');

    // le joueur roule : pilote automatique, pour rester à portée du fantôme
    await p.evaluate(() => { const r = app.race, orig = r.update.bind(r);
      r.update = (dt, input) => orig(dt, { throttle: aiThrottle(r.player, [], r.dt, { marginBase: 0.97, marginSpread: 0 }), sel: 0 }); });
    await p.waitForTimeout(5000);
    // ce que l'écran peint : le guide, la transparence du fantôme, et les textes du HUD
    const peint = await p.evaluate(() => new Promise((res) => {
      const R = app.renderer, textes = [], alphas = [];
      let guide = 0;
      const g0 = R._drawGuide.bind(R); R._drawGuide = (...a) => { guide++; return g0(...a); };
      const c0 = R._drawCar.bind(R);
      R._drawCar = (g, car) => { const m0 = drawCarModel; window.drawCarModel = (ctx, ...a) => { alphas.push([car.fantome ? 'fantome' : 'joueur', +ctx.globalAlpha.toFixed(2)]); return m0(ctx, ...a); };
        try { return c0(g, car); } finally { window.drawCarModel = m0; } };
      const f0 = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { textes.push(String(t)); return f0.call(this, t, ...a); };
      setTimeout(() => { CanvasRenderingContext2D.prototype.fillText = f0; R._drawGuide = g0; R._drawCar = c0;
        res({ guide, textes: [...new Set(textes)], alphaF: (alphas.find((a) => a[0] === 'fantome') || [])[1], alphaJ: (alphas.find((a) => a[0] === 'joueur') || [])[1] }); }, 500);
    }));
    ok(peint.guide > 5, `le guide se peint (${peint.guide} images en 0,5 s)`);
    const mot = peint.textes.find((t) => /^(GAZ|DOSE|LÂCHE)$/.test(t));
    ok(!!mot, `le mot de la consigne est affiché près de la commande (« ${mot} »)`);
    ok(peint.alphaF > 0.2 && peint.alphaF < 0.6 && peint.alphaJ === 1, `le fantôme est peint en transparence (opacité ${peint.alphaF}, le joueur ${peint.alphaJ})`);
    const place = peint.textes.find((t) => /^P [12]\/2$/.test(t)), ligne = peint.textes.find((t) => /FANTÔME/.test(t)), ecart = peint.textes.find((t) => /^[+−]\d+(\.\d)? s$/.test(t));
    ok(!!place && !!ligne && !!ecart, `l'écran affiche « ${place} », « ${ligne} », « ${ecart} »`);
    if (OUT) await p.screenshot({ path: path.join(OUT, 'entrainement-course.png') });
    const seuls = await p.evaluate(() => { const r = app.race, f = r.fantome, j = r.player;
      return { draft: j.draft, gene: !!j.blocker || !!j.voisin, fSel: f.sel, fGene: !!f.blocker || !!f.voisin, bleu: !!j.blueFlag || !!f.blueFlag, ecart: r.ecartFantome(), dist: f.progress - j.progress }; });
    ok(seuls.draft === false && !seuls.gene && !seuls.bleu, 'le joueur ne reçoit du fantôme ni aspiration, ni gêne, ni drapeau');
    ok(seuls.fSel === 0 && !seuls.fGene, 'le fantôme garde la ligne idéale et ne voit pas le joueur');
    ok(Number.isFinite(seuls.ecart) && (Math.sign(seuls.ecart) === Math.sign(seuls.dist) || Math.abs(seuls.ecart) < 0.02), `l'écart est mesuré en temps : ${seuls.ecart.toFixed(2)} s pour ${Math.round(seuls.dist)} m`);
    // et il est juste : le joueur parti 3 s après le fantôme en est à 3 s tant que tous deux accélèrent pareil
    const juste = await p.evaluate(() => {
      const r = new Race({ trackDef: TRACKS.find((t) => t.id === 'monza'), classId: 'gt', modelId: 'm1procar', mode: 'timetrial', entrainement: true });
      r.fantome.gripBoost = 1;                       // même voiture, même adhérence : seul le retard les sépare
      while (r.state !== 'racing') r.update(r.dt, { throttle: 0, sel: 0 });
      while (r.time < 8) r.update(r.dt, { throttle: r.time < 3 ? 0 : 1, sel: 0 });
      const devant = r.ecartFantome();
      // et dans l'autre sens : le fantôme reculé loin derrière, l'écart devient négatif
      r.fantome.lap -= 1;
      return { devant, derriere: r.ecartFantome() };
    });
    ok(Math.abs(juste.devant - 3) < 0.25 && juste.derriere < 0, `parti 3 s après le fantôme, le joueur lit ${juste.devant.toFixed(2)} s ; fantôme derrière : ${juste.derriere.toFixed(2)} s`);

    // --- le guide : ce que le doigt doit faire, calculé sur la vitesse du joueur ---
    const guide = await p.evaluate(() => {
      const piste = () => new Race({ trackDef: TRACKS.find((t) => t.id === 'monza'), classId: 'gt', modelId: 'm1procar', mode: 'timetrial', entrainement: true });
      const r = piste(), j = r.player;
      // la distance de la voiture au début de la première zone à lever
      const debut = (G) => { for (let i = 0; i < G.n; i++) if (G.etats[i] === GUIDE_LEVE) return G.s0 + i * G.pas - j.s; return Infinity; };
      while (r.state !== 'racing') r.update(r.dt, { throttle: 0, sel: 0 });
      const depart = r.guide();
      const departLibre = depart.maintenant === GUIDE_GAZ && depart.zone === GUIDE_GAZ;
      // plein gaz vers la première chicane, jusqu'à voir la zone rouge entre 60 et 150 m
      let vite = Infinity;
      while (r.time < 40) { r.update(r.dt, { throttle: 1, sel: 0 }); vite = debut(r.guide()); if (vite > 60 && vite < 150) break; }
      const v0 = j.v;
      j.v = v0 * 0.6; const lent = debut(r.guide());          // au même endroit, moins vite : on lève plus tard
      j.v = v0;
      // et sans lever : la zone arrive sous la voiture, la consigne devient « lâche »
      let sous = null;
      while (r.time < 60 && j.state === 'ok') { r.update(r.dt, { throttle: 1, sel: 0 }); const G = r.guide(); if (G.maintenant === GUIDE_LEVE) { sous = { d: debut(G), zone: G.zone }; break; } }
      // un pilote qui obéit au guide, avec 150 ms de retard, boucle un tour lancé sans sortir
      const o = piste(), q = o.player, file = [];
      while (q.lap < 2 && o.time < 400) {
        let voulu = 0;
        if (o.state === 'racing') { const G = o.guide(); voulu = G.maintenant === GUIDE_GAZ ? 1 : G.maintenant === GUIDE_DOSE ? (q.v < G.cibles[0] - 0.3 ? 1 : 0) : 0; }
        file.push(voulu);
        o.update(o.dt, { throttle: file.length > 18 ? file.shift() : 0, sel: 0 });
      }
      return { departLibre, vite, v0, lent, sous, tours: q.lap, sorties: q.crashes || 0, tour: q.lapTimes[1], fantome: o.fantome.lapTimes[1] };
    });
    ok(guide.departLibre, 'au départ, rien à lever : plein gaz');
    ok(guide.vite > 60 && guide.vite < 150 && guide.lent > guide.vite + 15,
      `la zone rouge suit la vitesse : elle commence à ${Math.round(guide.vite)} m à ${Math.round(guide.v0 * 3.6)} km/h, à ${guide.lent === Infinity ? 'rien' : Math.round(guide.lent) + ' m'} à ${Math.round(guide.v0 * 0.6 * 3.6)} km/h`);
    ok(guide.sous && guide.sous.d <= 3 && guide.sous.zone === GUIDE_LEVE_ATTENDU, 'sans lever, le rouge arrive sous la voiture et la consigne devient « lâche »');
    ok(guide.tours >= 2 && guide.sorties === 0, `un pilote qui obéit au guide (150 ms de retard) boucle ses tours sans sortir : ${guide.tour && guide.tour.toFixed(1)} s, le fantôme ${guide.fantome && guide.fantome.toFixed(1)} s`);

    /* Stand de frites (0.52.67). Deux remarques de Bruno, dans l'ordre :
       — « ça demande de freiner dans la ligne droite après la première chicane » : le pilote qui obéit
         au guide n'a rien à lever dans la ligne droite après le Raidillon (stations 680 à 1000), sauf
         au pli de la ligne au milieu, là où le fantôme lève aussi ;
       — « ça crée une incohérence entre ce que fait le fantôme et le guide » : le guide fait lever avant
         le Raidillon, comme le fantôme, et chaque freinage du fantôme est annoncé par une zone rouge du
         guide calculé pour sa voiture.
       Les stations sont celles du tracé actuel : à revoir si le circuit est redessiné. */
    const spa = await p.evaluate(() => {
      const piste = () => new Race({ trackDef: TRACKS.find((t) => t.id === 'spa'), classId: 'gt', modelId: 'm1procar', mode: 'timetrial', entrainement: true });
      const o = piste(), q = o.player, T = o.track, file = [];
      let vues = 0, leveRaidillon = false, sorti = false;
      const leveDroite = [];
      while (q.lap < 2 && o.time < 400) {
        let voulu = 0;
        if (o.state === 'racing') {
          const G = o.guide(); voulu = G.maintenant === GUIDE_GAZ ? 1 : G.maintenant === GUIDE_DOSE ? (q.v < G.cibles[0] - 0.3 ? 1 : 0) : 0;
          const s = T.wrap(q.s);
          if (q.lap === 1 && s > 440 && s < 640 && G.maintenant === GUIDE_LEVE) leveRaidillon = true;
          if (q.lap === 1 && s > 680 && s < 1000) { vues++; if (G.maintenant === GUIDE_LEVE) leveDroite.push(s); if (q.state !== 'ok') sorti = true; }
        }
        file.push(voulu);
        o.update(o.dt, { throttle: file.length > 18 ? file.shift() : 0, sel: 0 });
      }
      // le fantôme seul, et le guide calculé pour SA voiture : ses freinages sont-ils annoncés ?
      const r = piste(), f = r.fantome, freins = [], zones = [], piedLeve = [];
      let leve = 0, debut = null, zone = false;
      while (f.lap < 2 && r.time < 400) {
        r.update(r.dt, { throttle: 0, sel: 0 });
        if (r.state !== 'racing' || f.lap < 1) continue;
        const G = r.guide(f), s = T.wrap(f.s), gaz = !!f.throttle;
        if (!gaz && f.braking && s > 680 && s < 1000) piedLeve.push(s);
        leve = !gaz && f.braking ? leve + r.dt : 0;
        if (leve > 0.1 && debut == null) debut = s;
        if (gaz && debut != null) { freins.push(debut); debut = null; }
        const L = G.maintenant === GUIDE_LEVE;
        if (L && !zone) zones.push(s);
        zone = L || (zone && G.maintenant === GUIDE_DOSE);
      }
      const annonces = freins.filter((sf) => zones.some((sz) => Math.abs(T.diff(sf, sz)) < 80)).length;
      const raidillon = freins.some((sf) => sf > 440 && sf < 660) && zones.some((sz) => sz > 400 && sz < 660);
      // dans la ligne droite, le joueur ne lève que là où le fantôme lève (à 25 m près)
      const horsFantome = leveDroite.filter((sj) => !piedLeve.some((sf) => Math.abs(sf - sj) < 25)).length;
      const ou = leveDroite.length ? `${Math.round(Math.min(...leveDroite))}-${Math.round(Math.max(...leveDroite))}` : '—';
      const ouF = piedLeve.length ? `${Math.round(Math.min(...piedLeve))}-${Math.round(Math.max(...piedLeve))}` : '—';
      return { leve: leveDroite.length, horsFantome, ou, ouF, vues, leveRaidillon, sorti, sorties: q.crashes || 0, annonces, freins: freins.length, raidillon };
    });
    ok(spa.vues > 100 && spa.horsFantome === 0 && !spa.sorti,
      `Stand de frites, ligne droite après le Raidillon : on ne lève qu'au pli de la ligne, là où le fantôme lève (joueur ${spa.ou}, fantôme ${spa.ouF})`);
    ok(spa.leveRaidillon && spa.raidillon && spa.sorties === 0, 'le guide fait lever avant le Raidillon, là où le fantôme freine, sans une sortie sur le tour');
    ok(spa.annonces >= spa.freins * 0.9, `les freinages du fantôme sont annoncés par une zone rouge du guide : ${spa.annonces} sur ${spa.freins}`);

    // une sortie du fantôme ne lève pas de drapeau jaune
    const jaune = await p.evaluate(async () => { const r = app.race, f = r.fantome; f.state = 'grass'; r.flags.offSince.clear();
      const t0 = r.time; while (r.time < t0 + 4) { f.state = 'grass'; await new Promise((res) => setTimeout(res, 100)); }
      const z = r.flags.zones.length, a = r.flags.active(r.player); f.state = 'ok'; return { z, a }; });
    ok(jaune.z === 0 && !jaune.a.includes('yellow'), 'le fantôme hors piste ne lève pas de drapeau jaune');

    // --- sa course ne dépend pas du joueur : deux manches, à la même graine ---
    const identique = await p.evaluate(() => {
      const manche = (roule) => {
        let g = 4242; const hasard = Math.random; Math.random = () => { g ^= g << 13; g ^= g >>> 17; g ^= g << 5; return (g >>> 0) / 4294967296; };
        try {
          const r = new Race({ trackDef: TRACKS.find((t) => t.id === 'monza'), classId: 'gt', modelId: 'm1procar', mode: 'timetrial', entrainement: true });
          // le joueur part dans les roues du fantôme, plein gaz, puis lève : c'est là qu'ils se chevauchent
          while (r.time < 25) r.update(r.dt, { throttle: roule && r.time < 7 ? 1 : 0, sel: roule ? (r.time % 4 < 2 ? 1 : -1) : 0 });
          return { f: [r.fantome.x, r.fantome.y, r.fantome.v, r.fantome.progress], j: r.player.progress };
        } finally { Math.random = hasard; }
      };
      const a = manche(false), c = manche(true);
      return { pareil: a.f.every((v, i) => v === c.f[i]), fantome: Math.round(a.f[3]), joueurArret: Math.round(a.j), joueurRoule: Math.round(c.j) };
    });
    ok(identique.pareil && identique.joueurRoule > identique.joueurArret + 100,
      `la course du fantôme est identique, que le joueur reste sur la grille (${identique.joueurArret} m) ou roule dans ses roues (${identique.joueurRoule} m) : ${identique.fantome} m en 25 s`);

    // --- le record : personnel oui, mondial non ---
    const fin = () => p.evaluate(async () => {
      const r = app.race, moi = r.player, cle = `${r.track.id}|${r.cat.id}|${r.cls.id}`;
      let propose = 0;
      app.mondial.connecte = () => true; app.mondial.poseNom = () => {};
      app.mondial.propose = () => { propose++; return Promise.resolve(); };
      app.mondial.dernierRefus = null;
      delete app.save.bestLaps[cle]; delete app.save.bestLapsNets[cle];
      moi.bestLap = 61.234; moi.lapTimes = [61.234]; moi.lapOk = [true];
      if (r.fantome) { r.fantome.bestLap = 58.9; r.fantome.lapTimes = [58.9]; }
      app.endTimeTrial();
      await new Promise((res) => setTimeout(res, 300));
      return { perso: app.save.bestLaps[cle], net: app.save.bestLapsNets[cle], propose, refus: app.mondial.dernierRefus && app.mondial.dernierRefus.raison,
        net0: tourNet(app.save, r), titre: (document.querySelector('.resultats h2') || {}).textContent || '', fantome: (document.querySelector('.fantome-resultat') || {}).textContent || '',
        colonnes: [...document.querySelectorAll('.resultats .tbl th')].map((th) => th.textContent),
        retour: (document.querySelector('.resultats [data-action="setup"]') || { dataset: {} }).dataset.mode };
    });
    const entr = await fin();
    ok(entr.perso === 61.234, 'un tour d\'entraînement entre au record personnel');
    ok(entr.net == null && entr.propose === 0 && entr.net0 === false, 'il n\'entre pas au registre net et n\'est pas proposé au tableau mondial');
    ok(entr.refus === 'entrainement', `le motif est nommé (${entr.refus})`);
    ok(/Entraînement/i.test(entr.titre) && /fantôme/i.test(entr.fantome) && /0:58\.900/.test(entr.fantome) && /\+2\.334 s/.test(entr.fantome),
      `résultats : « ${entr.titre.trim()} », « ${entr.fantome.trim()} »`);
    ok(entr.colonnes.includes('Fantôme'), `le tableau des tours a la colonne du fantôme (${entr.colonnes.join(', ')})`);
    ok(entr.retour === 'training', `« Retour » ramène au paddock de l'entraînement (${entr.retour})`);
    if (OUT) await p.screenshot({ path: path.join(OUT, 'entrainement-resultats.png') });
    const auPaddock = await p.evaluate(() => { app.ui.setupScreen('training'); return document.querySelectorAll('.setup-records .mondial-note').length; });
    ok(auPaddock === 0, 'le paddock de l\'entraînement ne répète pas le refus');
    const message = await p.evaluate(() => { app.ui.setupScreen('timetrial'); return [...document.querySelectorAll('.mondial-note')].map((n) => n.textContent).join(' | '); });
    ok(/à l’entraînement/.test(message), `le contre-la-montre l'explique : « ${message.trim().slice(0, 110)}… »`);

    // --- un contre-la-montre ensuite : ni fantôme ni guide, et le tour part au monde ---
    await p.evaluate(async () => { app.startQuick('timetrial', 'gt', 'monza'); await new Promise((res) => { const w = () => (app.race && app.race.state === 'racing' ? res() : setTimeout(w, 50)); w(); }); });
    const tt = await p.evaluate(() => ({ n: app.race.cars.length, fantome: app.race.fantome, entr: app.race.entrainement, guide: app.renderer.showLines, ecart: app.race.ecartFantome() }));
    ok(tt.n === 1 && tt.fantome === null && tt.entr === false && tt.guide === false && tt.ecart === null, 'un contre-la-montre lancé ensuite n\'a ni fantôme ni guide');
    const net = await fin();
    ok(net.net === 61.234 && net.propose === 1 && !net.fantome && net.retour === 'timetrial', 'le même tour en contre-la-montre part au tableau mondial');

    ok(!erreurs.length, 'aucune erreur JS' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } finally { await b.close(); }
  console.log('\n' + fautes + ' faute(s)');
  process.exit(fautes ? 1 : 0);
})();
