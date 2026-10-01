// Le tableau mondial, servi par un FAUX serveur.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-mondial.js [dossier]
//
// Faux, et c'est le point. Un essai branché sur le vrai Supabase mesurerait Supabase : il tomberait
// en panne le jour d'une coupure réseau, il dépendrait de ce que contient la base ce jour-là, et il
// ne saurait pas fabriquer les cas qui comptent — une réponse vide, une réponse lente, un refus. On
// sert donc les réponses nous-mêmes, ce qui permet de les choisir.
//
// Quatre choses, et trois d'entre elles sont des pannes :
//
//   1. L'écran se peint AVANT la réponse. Attendre le réseau pour afficher rendrait un menu
//      hors-ligne inutilisable et un menu lent partout ailleurs. On sert donc la réponse en retard,
//      et on vérifie que les temps locaux sont déjà là pendant ce temps.
//   2. La colonne du monde se remplit quand la réponse arrive, en face de la bonne voiture.
//   3. Le serveur tombe : les temps locaux restent, la colonne du monde reste en tirets, et rien
//      n'explose. Un tableau de scores ne doit pas pouvoir casser un jeu qui se joue seul.
//   4. On ne repart pas en boucle. `records()` est rappelé à chaque rendu, et l'arrivée des temps
//      déclenche un rendu : sans garde-fou, la réponse relance la requête, indéfiniment. On compte
//      donc les requêtes réellement parties.
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

  // ce que le faux serveur répond, et combien de fois on le lui a demandé
  let appels = 0, mode = 'ok', retard = 0;
  const ctx = await nav.newContext(devices['iPhone 13']);
  await ctx.route('**/fyaifqvghkvrydcldiup.supabase.co/**', async (route) => {
    appels++;
    if (retard) await new Promise((r) => setTimeout(r, retard));
    if (mode === 'panne') return route.fulfill({ status: 503, body: '{"message":"nope"}' });
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { voiture: 'f40', temps: 61.25, pilote: 'Ayrton' },
        { voiture: 'm1procar', temps: 70.5, pilote: 'Nikki' },
      ]),
    });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { erreurs++; console.log('[pageerror]', e.message); });

  await page.goto(base + '/index.html');
  await page.waitForFunction(() => typeof app !== 'undefined' && app.save);
  await page.evaluate(() => {
    app.save.name = 'Testeur'; storeSave(app.save);
    const cat = playableCategories()[0], ms = modelsOf(cat.id);
    app.save.bestLaps[`monza|${cat.id}|${ms[0].id}`] = 74.0;   // un temps local, pour la colonne de gauche
    app.ui.setup.trackId = 'monza';
  });

  // --- 1 et 2. l'écran d'abord, les temps du monde ensuite ---
  retard = 900;
  console.log('\nla reponse arrive en retard');
  await page.evaluate(() => app.ui.setupScreen('timetrial'));
  await page.waitForTimeout(250);          // la réponse n'est pas encore là
  const tot = await page.evaluate(() => {
    const l = [...document.querySelectorAll('.rline')];
    return { n: l.length,
             perso: l.map(e => e.querySelectorAll('.rline-t')[0].textContent.trim()).filter(v => !/^-/.test(v)),
             monde: l.map(e => e.querySelectorAll('.rline-t')[1].textContent.trim()) };
  });
  dit(tot.n === 9, `l'ecran est deja peint : ${tot.n} lignes`);
  dit(tot.perso.length === 1 && tot.perso[0] === '1:14.000', `le temps local est deja la (${tot.perso.join()})`);
  dit(tot.monde.every(v => v === '…'), 'la colonne du monde attend, sans bloquer le reste');

  await page.waitForTimeout(1400);
  const rempli = await page.evaluate(() => {
    const cat = playableCategories()[0], ms = modelsOf(cat.id);
    const nom = (id) => ms.find(m => m.id === id).name;
    const par = {};
    for (const e of document.querySelectorAll('.rline')) {
      par[e.querySelector('b').textContent.trim()] = e.querySelectorAll('.rline-t')[1].textContent.trim();
    }
    return { par, f40: nom('f40'), m1: nom('m1procar'), autre: nom(ms.find(m => m.id !== 'f40' && m.id !== 'm1procar').id) };
  });
  dit(rempli.par[rempli.f40] === '1:01.250Ayrton', `le monde en face de la bonne voiture : ${rempli.f40} → ${rempli.par[rempli.f40]}`);
  dit(rempli.par[rempli.m1] === '1:10.500Nikki', `et la seconde : ${rempli.m1} → ${rempli.par[rempli.m1]}`);
  dit(rempli.par[rempli.autre] === '--:--.---', `une voiture sans record mondial reste en tirets (${rempli.autre})`);

  // --- 4. pas de boucle : la réponse ne relance pas la requête ---
  const avant = appels;
  await page.evaluate(() => app.ui.setupScreen('timetrial'));
  await page.waitForTimeout(800);
  dit(appels === avant, `rouvrir l'ecran ne redemande rien : ${appels - avant} requete(s) de plus (cache)`);
  await page.waitForTimeout(1200);
  dit(appels <= avant + 1, `aucune boucle : ${appels} requete(s) au total`);

  // --- 3. le serveur tombe ---
  console.log('\nle serveur tombe');
  mode = 'panne'; retard = 0;
  const panne = await page.evaluate(async () => {
    app.mondial.cache.clear();
    app.ui._mondiaux = null;
    app.ui.setup.trackId = 'spa';
    app.ui.setupScreen('timetrial');
    await new Promise((r) => setTimeout(r, 900));
    const l = [...document.querySelectorAll('.rline')];
    return { n: l.length, monde: l.map(e => e.querySelectorAll('.rline-t')[1].textContent.trim()),
             erreur: app.mondial.erreur };
  });
  dit(panne.n === 9, `les ${panne.n} lignes sont toujours la`);
  dit(panne.monde.every(v => v === '--:--.---'), 'la colonne du monde est vide, et c\'est tout');
  dit(!!panne.erreur, `la panne est notee sans etre jetee : ${panne.erreur}`);
  dit(erreurs === 0, `aucune exception pendant la panne (${erreurs})`);

  /* --- 5. un nom déjà pris arrive par le SERVEUR, et mène aux réglages --- */
  /* Le navigateur n'écrit plus dans la table des pilotes : c'est la fonction qui inscrit le nom,
  lié à l'identifiant vérifié. Un nom déjà pris par un autre compte revient donc comme un refus de
  temps ordinaire, et son remède n'est pas de se reconnecter mais d'en changer. */
  console.log('\nun nom deja pris');
  const pris = await page.evaluate(async () => {
    app.mondial.dernierRefus = { raison: 'pseudo_pris', circuit: 'spa', voiture: 'f40' };
    app.ui.setupScreen('timetrial');
    await new Promise((r) => setTimeout(r, 250));
    const n = [...document.querySelectorAll('.warn.mondial-note')].pop();
    return { txt: n ? n.textContent.trim() : '',
             reglages: !!(n && n.querySelector('[data-action="settings"]')),
             reco: !!(n && n.querySelector('[data-action="google"]')) };
  });
  dit(/already taken|déjà pris/i.test(pris.txt), `le joueur est prevenu : « ${pris.txt.slice(0, 50)}… »`);
  dit(pris.reglages && !pris.reco, 'il mene aux reglages, pas a une reconnexion inutile');

  /* --- 6. un refus du serveur doit se LIRE, et chaque raison a son message --- */
  /* Il partait dans le vide : le joueur bouclait un tour, rien n'arrivait au tableau, et aucune
  explication nulle part. Les raisons ont chacune une cause que le joueur peut traiter, et aucune
  ne se devine depuis l'écran. On vérifie aussi le repli : `t()` rend la CLÉ quand elle manque, ce
  qui ferait lire un nom de variable au joueur si le repli était écrit naïvement. */
  console.log('\nles refus du serveur');
  for (const [raison, bout] of [['inconnu', 'not known'], ['trop_rapide', 'impossible'],
                                ['usure', 'wear'], ['session', 'expired'], ['zarbi', 'zarbi']]) {
    const vu = await page.evaluate(async (r) => {
      app.mondial.dernierRefus = { raison: r, circuit: 'spa', voiture: 'f40' };
      app.ui.setupScreen('timetrial');
      await new Promise((res) => setTimeout(res, 220));
      const n = [...document.querySelectorAll('.warn.mondial-note')].pop();
      return n ? n.textContent.trim() : '';
    }, raison);
    const ok = vu.includes(bout) && !/^refus_/.test(vu);
    dit(ok, `${raison.padEnd(12)} → « ${vu.slice(0, 58)} »`);
  }

  /* --- 7. un message qui dit « reconnecte-toi » doit porter le bouton --- */
  /* Une consigne sans porte est une impasse. Le bouton d'accueil ne s'affichait que pour qui n'est
  PAS connecté : un pseudo manquant côté serveur, où la session est bien vivante, laissait le joueur
  devant « reconnecte-toi » et rien à toucher. */
  for (const [raison, attendu] of [['pseudo', true], ['session', true], ['inconnu', false], ['usure', false]]) {
    const r = await page.evaluate(async (ra) => {
      app.mondial.session = { token: 'x', expire: Date.now() / 1000 + 9999, sub: 'u', nom: 'B' };
      app.mondial.dernierRefus = { raison: ra, circuit: 'spa', voiture: 'f40' };
      app.ui.setupScreen('timetrial');
      await new Promise((res) => setTimeout(res, 220));
      const p = [...document.querySelectorAll('.warn.mondial-note')].pop();
      return !!(p && p.querySelector('[data-action="google"]'));
    }, raison);
    dit(r === attendu, `${raison.padEnd(12)} ${attendu ? 'porte' : 'ne porte pas'} le bouton de reconnexion (${r})`);
  }

  /* --- 8. le compte se gère depuis les réglages, dans les deux sens --- */
  const compte = await page.evaluate(async () => {
    app.ui.settings();
    await new Promise((r) => setTimeout(r, 200));
    const avec = (document.querySelector('.compte') || {}).textContent || '';
    const sortie = !!document.querySelector('[data-action="signOut"]');
    app.mondial.sortir(); app.ui.settings();
    await new Promise((r) => setTimeout(r, 200));
    const sans = (document.querySelector('.compte') || {}).textContent || '';
    return { avec, sortie, sans, entree: !!document.querySelector('.compte [data-action="google"]') };
  });
  dit(compte.sortie, `connecte : un bouton pour sortir (« ${compte.avec.trim()} »)`);
  dit(compte.entree, `deconnecte : un bouton pour entrer (« ${compte.sans.trim()} »)`);


  /* --- 9. l'etat du tableau se LIT, dans tous les cas, y compris quand tout va bien --- */
  /* Les trois défauts signalés de suite avaient la même forme : quelque chose échouait sans bruit,
  et l'écran montrait la même chose qu'en cas de succès — rien. Un état qui ne se dit pas est
  indiscernable d'une panne. On vérifie donc chaque cas, le silence compris. */
  console.log('\nl\'etat du tableau mondial');
  const cas = [
    ['deconnecte', () => { app.mondial.session = null; app.mondial.envoi = null; }, /sign in|connecte-toi/i],
    ['retour sans jeton', () => { app.mondial.erreurConnexion = 'pkce'; }, /without a token|sans jeton/i],
    ['refus de google', () => { app.mondial.erreurConnexion = 'access_denied'; }, /failed|échou/i],
    ['rien a envoyer', () => { app.mondial.erreurConnexion = null;
      app.mondial.session = { token: 'x', expire: Date.now() / 1000 + 9999, sub: 'u', nom: 'B' };
      app.mondial.envoi = { total: 0, faits: 0, rien: true }; }, /nothing to send|aucun temps/i],
    ['envoi en cours', () => { app.mondial.envoi = { total: 4, faits: 1, rien: false }; }, /1 of 4|1 sur 4/i],
    ['envoi fini', () => { app.mondial.envoi = { total: 3, faits: 3, rien: false }; }, /3 times sent|3 temps/i],
    ['connecte, rien de special', () => { app.mondial.envoi = null; }, /signed in as|connecté comme/i],
  ];
  for (const [nom, poser, attendu] of cas) {
    const txt = await page.evaluate(async (src) => {
      app.mondial.dernierRefus = null;
      // eslint-disable-next-line no-new-func
      new Function('app', src)(app);
      app.ui.setupScreen('timetrial');
      await new Promise((r) => setTimeout(r, 200));
      const p = document.querySelector('.mondial-note');
      return p ? p.textContent.trim() : '';
    }, poser.toString().replace(/^\s*\(\)\s*=>\s*/, ''));
    const ok = attendu.test(txt);
    dit(ok, `${nom.padEnd(24)} → « ${txt.slice(0, 54)} »`);
  }


  /* --- 11. un retour de connexion rate doit se voir SUR L'AFFICHE --- */
  /* Au retour de Google on atterrit sur l'affiche, et le message vivait sur l'écran des records,
  quatre écrans plus loin : le joueur revenait à l'accueil, ne voyait rien, et n'avait aucun moyen
  de recommencer. On vérifie aussi que l'affiche reste muette quand tout va bien. */
  console.log('\nun retour rate, sur l\'affiche');
  const affiche = await page.evaluate(async () => {
    const lire = async () => {
      app.ui.menu();
      await new Promise((r) => setTimeout(r, 200));
      const n = document.querySelector('.menu-auth');
      return { vu: !!n, bouton: !!(n && n.querySelector('[data-action="google"]')),
               reglages: !!(n && n.querySelector('[data-action="settings"]')) };
    };
    app.mondial.erreurConnexion = null;
    const sain = await lire();
    app.mondial.erreurConnexion = 'vide'; app.mondial.retourVide = 'code, state';
    const casse = await lire();
    app.mondial.erreurConnexion = null;
    return { sain, casse };
  });
  dit(!affiche.sain.vu, 'rien sur l\'affiche quand tout va bien');
  dit(affiche.casse.vu, 'un avis apparait quand la connexion a echoue');
  dit(affiche.casse.bouton && affiche.casse.reglages, 'avec de quoi recommencer, et de quoi aller aux reglages');

  /* --- 12. un retour VIDE est un echec, pas un chargement ordinaire --- */
  /* Sans la marque posée au départ, revenir les mains vides est indiscernable d'une ouverture
  normale de la page : ni jeton ni erreur dans l'adresse, et aucune raison de dire quoi que ce
  soit. C'est précisément le silence qu'on cherche à supprimer. */
  const vide = await page.evaluate(() => {
    const avant = new Mondial();
    const sansMarque = avant.erreurConnexion;
    sessionStorage.setItem('eol.parti', String(Date.now()));
    const apres = new Mondial();
    sessionStorage.removeItem('eol.parti');
    return { sansMarque, avec: apres.erreurConnexion, quoi: apres.retourVide };
  });
  dit(!vide.sansMarque, 'une ouverture ordinaire ne crie pas au loup');
  dit(vide.avec === 'vide', `un retour les mains vides est nomme (${vide.avec}, « ${vide.quoi} »)`);

  await page.evaluate(() => { app.mondial.dernierRefus = null; });

  await page.evaluate(() => { app.ui._mondiaux = null; app.mondial.cache.clear(); });
  await page.screenshot({ path: path.join(out, 'mondial.png'), fullPage: true });
  console.log(`\nfautes ${fautes} | erreurs ${erreurs}`);
  await nav.close();
  serveur.close();
  process.exit(fautes || erreurs ? 1 : 0);
})();
