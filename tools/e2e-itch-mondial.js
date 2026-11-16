// Le tableau mondial sur itch.io, de bout en bout : le jeu dans son cadre, le pont, l'onglet Google.
//
//   npm run build:itch && NODE_PATH=$(npm root -g) node tools/e2e-itch-mondial.js
//
// Rien ne sort sur le réseau : Playwright sert lui-même les VRAIES adresses — itch.io, le jeu sur
// html-classic.itch.zone (dist-itch/game), le pont sur grip-game.github.io (itch.html), et de faux
// Google et Supabase. Les origines sont donc celles de la réalité, et c'est ce qu'on vérifie :
//
//   1. sans compte, le jeu d'itch.io LIT le tableau mondial (la colonne « Monde ») ;
//   2. « Se connecter avec Google » ouvre un onglet, qui passe par Google et revient sur itch.html ;
//      la session va au pont, l'onglet se ferme, le jeu se dit connecté sans avoir rechargé ;
//   3. les temps d'avant le compte partent (rattrapage), avec le jeton, posés PAR LE PONT ;
//   4. un jeton arrivé à son heure est rafraîchi par le pont avant l'envoi ;
//   5. LE JEU NE VOIT JAMAIS LE JETON : ni dans les messages qu'il reçoit, ni dans son stockage —
//      et la page itch.io non plus ;
//   6. un autre jeu d'itch.io qui embarque le pont n'en tire aucun jeton, et ne peut pas lui en
//      glisser un ; un site qui n'est pas itch.io n'obtient aucune réponse ;
//   7. la session survit à un rechargement (elle est dans le stockage du pont), et « Se déconnecter »
//      la révoque ; un onglet fermé sans connexion rend la main.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..'), JEU = path.join(ROOT, 'dist-itch/game');
const SUPA = 'https://fyaifqvghkvrydcldiup.supabase.co';
const ITCH = 'https://html-classic.itch.zone/html/1/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
const SECRETS = ['JETON-ACCES', 'JETON-RAFR', 'JETON-GOOGLE'];

let fautes = 0;
const dit = (ok, txt) => { if (!ok) fautes++; console.log(`  ${ok ? 'ok  ' : 'FAUX'}  ${txt}`); };

(async () => {
  const version = (f) => /APP_VERSION\s*=\s*['"]([^'"]+)/.exec(fs.readFileSync(f, 'utf8'))?.[1];
  if (!fs.existsSync(path.join(JEU, 'index.html')) || version(path.join(JEU, 'js/version.js')) !== version(path.join(ROOT, 'js/version.js'))) {
    console.error('  dist-itch/game est absent ou d\'une autre version : lancer `npm run build:itch` d\'abord.');
    process.exit(2);
  }
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1100, height: 800 }, serviceWorkers: 'block', locale: 'fr-FR' });
  const erreurs = [];
  const serveur = { poses: [], rafraichis: [], sorties: 0, tours: 0, googleMuet: false };

  const page = (corps) => ({ status: 200, contentType: 'text/html', body: `<!doctype html><meta charset="utf-8">${corps}` });
  const cadre = (src) => page(`<title>itch.io</title><script>window.__messages=[];addEventListener('message',e=>__messages.push(JSON.stringify(e.data)))</script>
    <iframe id="game_drop" allow="autoplay; fullscreen *; gamepad" src="${src}" style="width:1000px;height:720px;border:0"></iframe>`);

  // --- itch.io, et un site qui n'est pas itch.io ---
  await ctx.route('https://itch.io/**', (r) => r.fulfill(cadre(r.request().url().includes('autre') ? 'https://html-classic.itch.zone/html/666/index.html' : ITCH + 'index.html')));
  await ctx.route('https://ailleurs.example/**', (r) => r.fulfill(page(`<script>window.__messages=[];addEventListener('message',e=>__messages.push(JSON.stringify(e.data)))</script>
    <iframe id="pont" src="https://grip-game.github.io/itch.html"></iframe>`)));
  // --- le jeu, et un AUTRE jeu d'itch.io, sur la même origine ---
  await ctx.route('https://html-classic.itch.zone/**', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname.startsWith('/html/666/')) return r.fulfill(page(`<script>window.__messages=[];addEventListener('message',e=>__messages.push(JSON.stringify(e.data)))</script>
      <iframe id="pont" src="https://grip-game.github.io/itch.html"></iframe>`));
    const f = path.join(JEU, decodeURIComponent(u.pathname.replace('/html/1/', '')));
    if (!f.startsWith(JEU) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  // --- la prod : le pont, et rien d'autre ---
  await ctx.route('https://grip-game.github.io/**', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/itch.html') return r.fulfill({ status: 200, contentType: 'text/html', body: fs.readFileSync(path.join(ROOT, 'itch.html')) });
    if (u.pathname === '/art/interface/logo-grip.webp') return r.fulfill({ status: 200, contentType: 'image/webp', body: fs.readFileSync(path.join(ROOT, 'art/interface/logo-grip.webp')) });
    return r.fulfill({ status: 404, body: '' });
  });
  // --- un faux Google : une page d'un autre site, qui revient après un instant (ou jamais) ---
  await ctx.route('https://accounts.google.com/**', (r) => r.fulfill(page(`<title>Google</title><p>faux Google</p>
    <script>${serveur.googleMuet ? '' : `setTimeout(()=>location.replace('${SUPA}/auth/v1/callback?code=c'),500)`}</script>`)));
  // --- un faux Supabase ---
  await ctx.route(SUPA + '/**', async (r) => {
    const q = r.request(), u = new URL(q.url());
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS, body: '' });
    const json = (status, corps) => r.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(corps) });
    if (u.pathname === '/auth/v1/authorize') {
      serveur.retour = u.searchParams.get('redirect_to');
      return r.fulfill(page(`<script>location.replace('https://accounts.google.com/o/oauth2/v2/auth?state=s')</script>`));
    }
    if (u.pathname === '/auth/v1/callback') {
      serveur.tours++;
      // un jeton presque à son heure (30 s) : le pont devra le rafraîchir avant le premier envoi
      const exp = Math.floor(Date.now() / 1000) + 30;
      return r.fulfill(page(`<script>location.replace(${JSON.stringify(serveur.retour)}+'#access_token=JETON-ACCES-${serveur.tours}&expires_at=${exp}&expires_in=30&provider_token=JETON-GOOGLE&refresh_token=JETON-RAFR-${serveur.tours}&token_type=bearer')</script>`));
    }
    if (u.pathname === '/auth/v1/token') {
      const c = q.postDataJSON() || {};
      serveur.rafraichis.push(c.refresh_token);
      return json(200, { access_token: 'JETON-ACCES-R' + serveur.rafraichis.length, refresh_token: 'JETON-RAFR-R' + serveur.rafraichis.length, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer' });
    }
    if (u.pathname === '/auth/v1/logout') { serveur.sorties++; return r.fulfill({ status: 204, headers: CORS, body: '' }); }
    if (u.pathname === '/functions/v1/record') {
      serveur.poses.push({ jeton: (q.headers().authorization || '').replace(/^Bearer /, ''), origine: q.headers().origin, corps: q.postDataJSON() });
      return json(200, { ok: true });
    }
    if (u.pathname === '/rest/v1/records') return json(200, [{ voiture: 'm1procar', temps: 101.234, pilote: 'Alice' }]);
    return json(200, []);   // les statistiques, et le reste
  });

  const ouvre = async (url) => {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => { erreurs.push(e.message); console.log('[pageerror]', e.message); });
    await p.goto(url);
    return p;
  };
  const leJeu = async (p) => {
    const f = p.frames().find((x) => x.url().startsWith(ITCH)) || await p.waitForEvent('framenavigated', (x) => x.url().startsWith(ITCH));
    await f.waitForFunction(() => typeof app !== 'undefined' && app.save && app.mondial);
    await f.evaluate(() => {
      window.__messages = []; addEventListener('message', (e) => __messages.push(JSON.stringify(e.data)));
      app.save.name = 'Pilote'; app.save.lang = 'fr'; app.ui.lang = 'fr'; app.save.sound = false; app.audio.setEnabled(false);
      app.mondial.poseNom('Pilote');
      if (app.state === 'splash') app.leaveSplash();
    });
    return f;
  };
  const paddock = (f) => f.evaluate(async () => {
    app.save.cat = 'gt'; app.save.filtreCat = 'gt'; app.ui.setup.classId = 'gt'; app.ui.setup.trackId = 'monza';
    app.ui.setupScreen('timetrial'); await new Promise((r) => setTimeout(r, 500));
  });
  const note = (f) => f.evaluate(() => (document.querySelector('.mondial-note') || {}).textContent || '');

  try {
    // ---------------------------------------------------------------- 1. lire, sans compte
    console.log('\nsans compte');
    const itch = await ouvre('https://itch.io/jeu');
    let jeu = await leJeu(itch);
    await jeu.waitForFunction(() => app.mondial._pont && app.mondial._attentes.size === 0, null, { timeout: 15000 });
    const depart = await jeu.evaluate(() => ({ itch: app.isItch, mode: app.mondial.itch, connecte: app.mondial.connecte(), pont: app.mondial._pont.src, origine: location.origin }));
    dit(depart.itch && depart.mode && depart.origine === 'https://html-classic.itch.zone', `le jeu tourne sur ${depart.origine}, en édition itch.io`);
    dit(depart.pont === 'https://grip-game.github.io/itch.html' && depart.connecte === false, 'il embarque le pont de la prod, et n\'est pas connecté');
    await paddock(jeu);
    const lu = await jeu.evaluate(() => ({ monde: [...document.querySelectorAll('.rline-t.monde')].map((e) => e.textContent.trim()).filter((t) => /\d/.test(t)),
      bouton: document.querySelectorAll('.setup-records [data-action="google"]').length, ancien: document.querySelectorAll('[data-world-online], .local-records').length }));
    dit(lu.monde.length === 1 && /1:41\.234/.test(lu.monde[0]) && /Alice/.test(lu.monde[0]), `la colonne « Monde » montre le record lu sans compte (${lu.monde[0]})`);
    dit(lu.bouton === 1 && lu.ancien === 0, '« Se connecter avec Google » est proposé ; plus de renvoi vers la version en ligne');

    // ---------------------------------------------------------------- 2. se connecter, dans un onglet
    console.log('\nla connexion, dans un nouvel onglet');
    await jeu.evaluate(() => { app.save.bestLapsNets = { 'monza|gt|m1procar': 95.5 }; });
    const [onglet] = await Promise.all([itch.waitForEvent('popup'), jeu.click('.setup-records [data-action="google"]')]);
    const pendant = await note(jeu);
    dit(/autre onglet/.test(pendant), `pendant ce temps, le jeu dit : « ${pendant.trim().slice(0, 60)} »`);
    await onglet.waitForURL(/accounts\.google\.com/, { timeout: 15000 });
    dit(serveur.retour === 'https://grip-game.github.io/itch.html', `Google est demandé avec un retour sur ${serveur.retour}`);
    await onglet.waitForEvent('close', { timeout: 20000 });
    await jeu.waitForFunction(() => app.mondial.connecte(), null, { timeout: 10000 });
    dit(true, 'l\'onglet est passé par Google, est revenu, et s\'est fermé seul ; le jeu se dit connecté sans avoir rechargé');

    // ---------------------------------------------------------------- 3 et 4. le rattrapage, par le pont
    console.log('\nles temps partent, par le pont');
    await jeu.waitForFunction(() => app.mondial.envoi && app.mondial.envoi.faits === 1, null, { timeout: 15000 });
    const pose = serveur.poses[0] || {};
    dit(serveur.poses.length === 1 && pose.corps.circuit === 'monza' && pose.corps.voiture === 'm1procar' && pose.corps.temps === 95.5 && pose.corps.pilote === 'Pilote',
      `le temps d'avant le compte est arrivé au serveur (${JSON.stringify(pose.corps)})`);
    dit(pose.origine === 'https://grip-game.github.io', `posé par le pont, depuis ${pose.origine}`);
    dit(serveur.rafraichis.length === 1 && serveur.rafraichis[0] === 'JETON-RAFR-1' && pose.jeton === 'JETON-ACCES-R1',
      `le jeton arrivé à son heure a été rafraîchi avant l'envoi (envoyé avec ${pose.jeton})`);
    await paddock(jeu);
    dit(/1 temps envoy/.test(await note(jeu)), `le paddock le dit : « ${(await note(jeu)).trim()} »`);

    // ---------------------------------------------------------------- 5. le jeton ne sort pas du pont
    console.log('\nle jeton reste dans le pont');
    const vu = await jeu.evaluate(() => ({ messages: __messages.join('\n'), stockage: JSON.stringify(localStorage) + JSON.stringify(sessionStorage) + document.cookie }));
    const haut = await itch.evaluate(() => ({ messages: __messages.join('\n'), stockage: JSON.stringify(localStorage) + JSON.stringify(sessionStorage) + document.cookie }));
    const fuite = (t) => SECRETS.find((s) => t.includes(s));
    dit(vu.messages.length > 0 && !fuite(vu.messages), `le jeu a reçu ${vu.messages.split('\n').length} messages du pont, aucun ne porte de jeton`);
    dit(!fuite(vu.stockage), 'rien dans le stockage du jeu (celui que partagent tous les jeux d\'itch.io)');
    dit(!fuite(haut.messages) && !fuite(haut.stockage), 'rien non plus chez la page itch.io');
    const chezLePont = await itch.frames().find((x) => x.url().startsWith('https://grip-game.github.io/')).evaluate(() => localStorage.getItem('grip.itch.session') || '');
    dit(/JETON-ACCES-R1/.test(chezLePont), 'la session est rangée chez le pont, sur l\'origine de la prod');

    // ---------------------------------------------------------------- 6. les voisins
    console.log('\nun autre jeu d\'itch.io, et un site qui n\'est pas itch.io');
    const autre = await ouvre('https://itch.io/autre');
    const voisin = autre.frames().find((x) => x.url().includes('/html/666/')) || await autre.waitForEvent('framenavigated', (x) => x.url().includes('/html/666/'));
    await voisin.waitForFunction(() => __messages.some((m) => m.includes('"pret"')), null, { timeout: 10000 });
    const tente = await voisin.evaluate(async () => {
      const pont = document.getElementById('pont').contentWindow, o = 'https://grip-game.github.io';
      pont.postMessage({ grip: 'pont', v: 1, id: 1, type: 'etat' }, o);
      // il se fait passer pour l'onglet de connexion, et essaie de glisser SA session
      pont.postMessage({ grip: 'retour', v: 1, session: { a: 'PIRATE', r: 'PIRATE', e: 9e9 } }, o);
      await new Promise((r) => setTimeout(r, 800));
      pont.postMessage({ grip: 'pont', v: 1, id: 2, type: 'etat' }, o);
      await new Promise((r) => setTimeout(r, 500));
      let lecture = 'refusée';
      try { lecture = String(pont.localStorage.getItem('grip.itch.session')); } catch (_) {}
      return { messages: __messages.join('\n'), lecture };
    });
    dit(!fuite(tente.messages) && !/PIRATE/.test(tente.messages) && !/retour-recu/.test(tente.messages) && tente.lecture === 'refusée',
      'il n\'obtient aucun jeton, ne peut pas lire le stockage du pont, et sa fausse session est ignorée');
    const apres = await itch.frames().find((x) => x.url().startsWith('https://grip-game.github.io/')).evaluate(() => localStorage.getItem('grip.itch.session') || '');
    dit(!/PIRATE/.test(apres) && /JETON-ACCES-R1/.test(apres), 'la vraie session est intacte');
    await autre.close();
    const ailleurs = await ouvre('https://ailleurs.example/');
    await ailleurs.waitForFunction(() => __messages.some((m) => m.includes('"pret"')), null, { timeout: 10000 });
    const sourd = await ailleurs.evaluate(async () => {
      document.getElementById('pont').contentWindow.postMessage({ grip: 'pont', v: 1, id: 1, type: 'etat' }, 'https://grip-game.github.io');
      await new Promise((r) => setTimeout(r, 900));
      return __messages.filter((m) => !m.includes('"pret"')).length;
    });
    dit(sourd === 0, 'hors d\'itch.io, le pont ne répond à rien');
    await ailleurs.close();

    // ---------------------------------------------------------------- 7. recharger, sortir, renoncer
    console.log('\nrecharger, se déconnecter, renoncer');
    await itch.reload();
    jeu = await leJeu(itch);
    await jeu.waitForFunction(() => app.mondial.connecte(), null, { timeout: 10000 });
    dit(serveur.tours === 1, 'après un rechargement, le jeu est encore connecté, sans repasser par Google');
    await jeu.evaluate(() => app.ui.settings());
    await jeu.click('[data-action="signOut"]');
    await jeu.waitForFunction(() => !app.mondial.connecte());
    await itch.waitForTimeout(600);
    const vide = await itch.frames().find((x) => x.url().startsWith('https://grip-game.github.io/')).evaluate(() => localStorage.getItem('grip.itch.session'));
    dit(vide === null && serveur.sorties === 1, '« Se déconnecter » vide le pont et révoque la session chez Supabase');
    serveur.googleMuet = true;      // le joueur ouvre l'onglet, puis le ferme sans se connecter
    await paddock(jeu);
    const [perdu] = await Promise.all([itch.waitForEvent('popup'), jeu.click('.setup-records [data-action="google"]')]);
    await perdu.waitForURL(/accounts\.google\.com/, { timeout: 15000 });
    await perdu.close();
    await jeu.waitForFunction(() => !app.mondial.enCours, null, { timeout: 8000 });
    dit(/Connecte-toi/.test(await note(jeu)) && !(await jeu.evaluate(() => app.mondial.connecte())), 'un onglet fermé sans connexion rend la main : le bouton est de nouveau là');

    dit(erreurs.length === 0, `aucune erreur de page (${erreurs.length})`);
  } finally {
    await nav.close();
  }
  console.log(`\nfautes ${fautes} | erreurs ${erreurs.length}`);
  process.exit(fautes || erreurs.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
