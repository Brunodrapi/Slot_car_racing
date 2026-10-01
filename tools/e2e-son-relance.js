// Le son survit-il à une deuxième course ?
//
//   NODE_PATH=$(npm root -g) node tools/e2e-son-relance.js
//
// Bruno : « je perds le son si je quitte une partie et que j'en relance une ». Un son absent ne
// laisse aucune trace — pas d'exception, pas de message, rien dans la console — donc rien dans la
// suite existante ne pouvait le voir. On lit ici ce que le mélangeur envoie réellement : le gain de
// chacune des quatre voies, celui de la sortie moteur, celui du gain maître, et le régime.
//
// La mesure se fait TROIS FOIS : première course, deuxième course après un retour au menu, et
// troisième après un abandon en pleine course. Une seule comparaison ne dirait pas si le défaut
// vient du retour au menu ou de la relance.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.png': 'image/png', '.webp': 'image/webp' };

(async () => {
  const serveur = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => serveur.listen(0, r));
  const base = `http://127.0.0.1:${serveur.address().port}`;
  const nav = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'] });
  const page = await nav.newPage({ viewport: { width: 420, height: 760 } });
  let fautes = 0, erreurs = 0;
  const dit = (ok, txt) => { if (!ok) fautes++; console.log(`  ${ok ? 'ok  ' : 'FAUX'}  ${txt}`); };
  page.on('pageerror', (e) => { erreurs++; console.log('[page]', e.message, '\n', (e.stack || '').split('\n').slice(0, 4).join('\n')); });

  await page.goto(base + '/index.html');
  await page.waitForFunction(() => typeof app !== 'undefined' && app.save);
  await page.evaluate(() => {
    app.save.name = 'Son'; app.save.sound = true; app.save.laps = 3;
    storeSave(app.save); app.audio.enabled = true; app.mondial = null;
  });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);

  /* On mesure PIED DEDANS et à vitesse : à l'arrêt les quatre voies sont au ralenti et un moteur
  muet ressemble beaucoup à un moteur qui tourne doucement. */
  const mesure = await page.evaluate(async () => {
    const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
    const lis = () => {
      const a = app.audio;
      const v = a.sampler ? a.sampler.etat() : {};
      const somme = Object.keys(v).reduce((s, k) => s + v[k].gain, 0);
      return {
        rpm: Math.round(a.rpm || 0), gear: a.gear,
        moteur: a.engGain ? +a.engGain.gain.value.toFixed(3) : null,
        maitre: a.master ? +a.master.gain.value.toFixed(3) : null,
        voies: +somme.toFixed(3), nVoies: Object.keys(v).length,
        pret: a.pret, rate: !!a.rate, jeu: a.jeu, clsId: a.clsId,
        ctx: a.ctx ? a.ctx.state : 'aucun', vehicule: !!a.vehicule,
        vitesse: app.race ? Math.round(app.race.player.v) : null,
      };
    };
    const course = async (voiture) => {
      if (voiture) { app.save.models.gt = voiture; storeSave(app.save); }
      app.startQuick('race', 'gt', TRACKS[0].id);
      // on attend la fin du décompte, barrière de chargement comprise
      for (let i = 0; i < 400 && (!app.race || app.race.state !== 'racing'); i++) await dormir(50);
      app.input.throttle = true;
      await dormir(3000);
      const r = lis();
      app.input.throttle = false;
      return r;
    };
    const un = await course('m1procar');
    app.toMenu();
    await dormir(500);
    const deux = await course('m1procar');
    // un abandon en pleine course, par la pause : l'autre façon de quitter
    app.togglePause();
    await dormir(200);
    app.toMenu();
    await dormir(500);
    const trois = await course('m1procar');
    /* On CHANGE DE VOITURE entre deux courses, parce que c'est là que le jeu de prises se recharge :
    `vide()` arrête les quatre boucles, puis quatre fichiers se téléchargent et se décodent. C'est le
    seul moment où le son peut disparaître pour de bon, et ne pas le passer au banc revenait à ne
    jamais regarder l'endroit où ça casse. */
    app.toMenu();
    await dormir(500);
    const autre = await course('787b');            // bac_mono : un autre jeu de prises
    app.toMenu();
    await dormir(500);
    const retour = await course('m1procar');       // et on revient : le premier jeu doit se rouvrir
    /* Et la troisième façon de finir : par l'écran des résultats. Elle passe par un autre chemin
    (`_onRaceFinished`), donc elle doit être vue aussi. */
    /* On passe par `_finish`, pas par `state = 'finished'` à la main : c'est lui qui remplit le
    classement, et l'écran des résultats le lit sans le vérifier. Forcer l'état seul faisait tomber
    cet écran — un défaut du banc, pas du jeu, mais qui aurait caché le reste. */
    app.race._finish();
    for (let i = 0; i < 80 && app.state !== 'results'; i++) await dormir(50);
    app.toMenu();
    await dormir(500);
    const apresResultats = await course('m1procar');

    /* Les deux pannes que le bureau ne produit jamais, et qui ne se rattrapaient pas.

    Six chemins de sortie n'avaient rien perdu : ce n'est donc pas la relance qui casse, c'est qu'il
    n'y a aucune réparation. On fabrique donc les deux pannes et on regarde si la course suivante
    s'en relève. */
    app.toMenu();
    await dormir(300);
    await app.audio.ctx.suspend();               // ce que fait un navigateur quand l'onglet s'efface
    const suspendu = app.audio.ctx.state;
    const apresSuspension = await course('m1procar');

    app.toMenu();
    await dormir(300);
    // un téléchargement de prises perdu : le jeu de boucles restait marqué perdu pour la session
    app.audio.rate = true; app.audio.pret = false;
    const apresEchec = await course('m1procar');
    return { un, deux, trois, autre, retour, apresResultats, suspendu, apresSuspension, apresEchec };
  });

  const ligne = (nom, m) => console.log(`  ${nom.padEnd(10)} ${m.rpm} tr · rapport ${m.gear}`
    + ` · voies ${m.voies} (${m.nVoies}) · moteur ${m.moteur} · maitre ${m.maitre}`
    + ` · ${m.vitesse} m/s · pret ${m.pret} · jeu ${m.jeu} · ctx ${m.ctx}`);
  const cas = [['course 1', mesure.un], ['retour menu', mesure.deux], ['apres pause', mesure.trois],
    ['autre jeu', mesure.autre], ['jeu repris', mesure.retour], ['apres resultats', mesure.apresResultats],
    ['ctx suspendu', mesure.apresSuspension], ['prises perdues', mesure.apresEchec]];
  console.log('\nce que le melangeur envoie, pied dedans');
  for (const [nom, m] of cas) ligne(nom, m);

  console.log('\nle verdict');
  for (const [nom, m] of cas) {
    dit(m.nVoies >= 4, `${nom} : les quatre voies sont chargees (${m.nVoies})`);
    dit(m.voies > 0.05, `${nom} : le melangeur envoie quelque chose (${m.voies})`);
    dit(m.moteur > 0.5, `${nom} : la sortie moteur est ouverte (${m.moteur})`);
    dit(m.maitre > 0.1, `${nom} : le gain maitre est ouvert (${m.maitre})`);
    dit(m.rpm > 900, `${nom} : le moteur tourne (${m.rpm} tr)`);
    dit(m.ctx === 'running', `${nom} : le contexte audio tourne (${m.ctx})`);
  }

  console.log(`\n  (le contexte avait bien ete suspendu : ${mesure.suspendu})`);
  console.log(`\nfautes ${fautes} | erreurs ${erreurs}`);
  await nav.close();
  serveur.close();
  process.exit(fautes || erreurs ? 1 : 0);
})();
