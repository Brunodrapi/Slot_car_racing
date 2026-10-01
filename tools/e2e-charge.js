// La barrière de chargement, et le faux « liaison perdue » qu'elle remplace.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-charge.js
//
// Le défaut, tel que Bruno l'a décrit : au départ d'une course en ligne, l'invité affiche « liaison
// perdue avec l'hôte », puis tout se met à marcher une fois les éléments chargés. La liaison allait
// très bien. L'hôte construisait son circuit, décodait ses vignettes et téléchargeait ses prises de
// moteur — plusieurs secondes pendant lesquelles il n'a rien à envoyer — et le compteur de silence
// de l'invité, parti au coup d'envoi, franchissait ses deux secondes avant le premier instantané.
//
// Un message faux coûte plus cher qu'une attente : il envoie chercher un problème de réseau là où
// il n'y en a pas, et il décrédibilise le vrai message quand la liaison tombe pour de bon.
//
// Trois choses à vérifier, et la première est la seule qui reproduit le défaut :
//
//   1. UN HÔTE LENT ne doit pas déclencher « liaison perdue ». On retarde délibérément son premier
//      instantané bien au-delà des deux secondes, et on regarde ce que l'invité annonce.
//
//   2. LE DÉCOMPTE ATTEND. Tant qu'un écran n'a pas annoncé qu'il était prêt, les feux ne défilent
//      pas — sinon la course part sans lui et il la rejoint en retard.
//
//   3. LA BARRIÈRE A UNE SORTIE. Un écran qui ne répondra jamais ne doit pas retenir les autres
//      indéfiniment : passé le délai, on part sans lui.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wav': 'audio/wav',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };

const DOUBLE = `
(() => {
  class RoomBC {
    static available() { return true; }
    constructor() { this.mine = {}; this.others = new Map(); this.label = null; this.h = []; this.ch = null; this.relayer = true; }
    claim(code, asHost) {
      this.label = (asHost ? '0-' : '1-') + Math.random().toString(36).slice(2, 7);
      this.ch = new BroadcastChannel('eol-chg-' + code);
      this.ch.onmessage = (e) => {
        const m = e.data;
        if (m.from === this.label) return;
        if (m.type === 'bonjour') this.envoi();
        this.others.set(m.from, { presence: m.p, updatedAt: Date.now() });
        this.fire();
      };
      this.ch.postMessage({ type: 'bonjour', from: this.label, p: this.mine });
      setTimeout(() => this.fire(), 0);
      return Promise.resolve();
    }
    envoi() { this.ch.postMessage({ type: 'p', from: this.label, p: this.mine }); }
    presence(patch) {
      for (const k in patch) { if (patch[k] === null) delete this.mine[k]; else this.mine[k] = patch[k]; }
      this.envoi(); this.fire(); return Promise.resolve();
    }
    peers() {
      const l = [{ peer: this.label, isMe: true, presence: this.mine, updatedAt: Date.now() }];
      for (const [k, v] of this.others) l.push({ peer: k, isMe: false, presence: v.presence, updatedAt: v.updatedAt });
      return l;
    }
    fire() { const p = this.peers(); for (const h of this.h) h({ peers: p, joined: p, left: [], updated: [] }); }
    onPeers(h) { this.h.push(h); setTimeout(() => h({ peers: this.peers(), joined: this.peers(), left: [], updated: [] }), 0); return () => {}; }
    close() { if (this.ch) this.ch.close(); this.others.clear(); }
  }
  window.RoomRTC = RoomBC;
})();
`;

(async () => {
  const serveur = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => serveur.listen(0, r));
  const base = `http://127.0.0.1:${serveur.address().port}`;
  const nav = await chromium.launch({ args: ['--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
  const ctx = await nav.newContext({ viewport: { width: 420, height: 760 } });
  let fautes = 0, erreurs = 0;
  const dit = (ok, txt) => { if (!ok) fautes++; console.log(`  ${ok ? 'ok  ' : 'FAUX'}  ${txt}`); };

  const ouvre = async (nom) => {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => { erreurs++; console.log(`[${nom}]`, e.message); });
    await p.goto(base + '/index.html');
    await p.waitForFunction(() => typeof app !== 'undefined' && app.save);
    await p.evaluate((n) => { app.save.name = n; storeSave(app.save); app.mondial = null; }, nom);
    await p.waitForTimeout(300);
    await p.evaluate(DOUBLE);
    await p.keyboard.press('Enter');
    await p.waitForTimeout(200);
    return p;
  };
  const hote = await ouvre('Hote'), invite = await ouvre('Invite');

  const code = await hote.evaluate(async () => {
    await app.net.open('Hote', true, null);
    app.net.setMine({ car: { modelId: 'm1procar' } });
    app.ui._netReady(true);
    return app.net.code;
  });
  await invite.evaluate(async (c) => {
    await app.net.open('Invite', false, c);
    app.net.setMine({ car: { modelId: 'f40' } });
    app.ui._netReady(true);
  }, code);
  await hote.waitForFunction(() => app.net.members().length >= 2, { timeout: 20000 });

  /* --- 1. un hôte lent ne doit pas passer pour une liaison perdue --- */
  /* On empêche l'hôte d'envoyer pendant cinq secondes : c'est exactement ce que fait une machine
  qui construit son circuit et décode ses vignettes, et c'est deux fois et demie le seuil au-delà
  duquel l'invité criait à la perte. */
  console.log('\nun hote lent a demarrer');
  await hote.evaluate(() => {
    const vrai = app.net.hostTick.bind(app.net);
    const t0 = performance.now();
    app.net.hostTick = (race) => { if (performance.now() - t0 > 5000) return vrai(race); };
  });
  await hote.evaluate(() => app.net.start());
  await Promise.all([hote, invite].map((p) => p.waitForFunction(() => app.state === 'race', { timeout: 20000 })));

  await invite.waitForTimeout(3200);
  const pendant = await invite.evaluate(() => ({
    silence: app.net.silence(),
    recu: app.net.lastSeq,
    etat: app.race.state,
    perdu: !!(app.ui.flash && /perdue|Lost/.test(app.ui.flash.text || '')),
  }));
  dit(!pendant.perdu, `apres 3,2 s sans instantane : aucune « liaison perdue » (recu ${pendant.recu})`);
  dit(pendant.silence === 0, `le silence ne se compte pas avant le premier instantane (${pendant.silence})`);
  dit(pendant.etat === 'countdown', `la course attend encore au depart (${pendant.etat})`);

  /* --- 2. le décompte attend, puis repart --- */
  const fige = await invite.evaluate(() => app.race.countdown);
  await invite.waitForTimeout(900);
  const fige2 = await invite.evaluate(() => app.race.countdown);
  dit(Math.abs(fige2 - fige) < 0.05, `les feux ne defilent pas pendant l'attente (${fige.toFixed(2)} -> ${fige2.toFixed(2)})`);

  await invite.waitForTimeout(3500);
  const apres = await invite.evaluate(() => ({ recu: app.net.lastSeq, cd: app.race.countdown, etat: app.race.state }));
  dit(apres.recu >= 0, `l'instantane finit par arriver (sequence ${apres.recu})`);
  dit(apres.cd < fige || apres.etat !== 'countdown', `le decompte repart une fois tout le monde pret (${apres.cd.toFixed(2)})`);

  /* --- 3. la barriere a une sortie --- */
  console.log('\nun ecran qui ne repond jamais');
  /* On FABRIQUE un retardataire, sinon le contrôle part de zéro et ne prouve rien.

  Tout le monde étant prêt à ce stade, vérifier que le compte tombe à zéro après le délai
  reviendrait à constater qu'il y était déjà. On ajoute donc à la grille un pilote qui n'existe
  nulle part et n'annoncera jamais rien : la barrière doit le voir manquer, puis l'abandonner. */
  const sortie = await hote.evaluate(() => {
    app.net.roster = app.net.roster.concat(['fantome']);
    app.net.playingAt = performance.now();
    const avant = app.net.attendus();
    app.net.playingAt = performance.now() - 99999;    // comme si l'attente durait depuis toujours
    const apres = app.net.attendus();
    app.net.roster = app.net.roster.filter((p) => p !== 'fantome');
    return { avant: avant.reste, apres: apres.reste, trop: apres.trop };
  });
  dit(sortie.avant === 1, `un retardataire est bien compté comme manquant (${sortie.avant})`);
  dit(sortie.apres === 0 && sortie.trop, `passe le delai, on part sans lui (${sortie.avant} -> ${sortie.apres})`);

  /* --- 4. le drapeau, chez l'invité ---

  L'invité ne simule pas, donc `Race._finish` ne tourne jamais chez lui : son classement restait nul,
  et l'écran des résultats le lit sans le vérifier. Le défaut ne demandait qu'une course en ligne
  menée jusqu'au drapeau pour se voir, et aucun essai ne la menait. Il est devenu visible en ajoutant
  les pénalités de sortie de piste, qui doivent apparaître des deux côtés. */
  console.log('\nle drapeau, chez l\'invite');
  await hote.evaluate(() => {
    // une pénalité chez l'hôte, pour qu'il y ait quelque chose à transmettre
    app.race.player.fautes = 2;
    app.race.player.repris = 1.5;
    app.race._finish();
  });
  await invite.waitForTimeout(1200);
  const fin = await invite.evaluate(() => ({
    etat: app.state,
    classement: app.race.results ? app.race.results.length : 0,
    tableau: document.querySelectorAll('.tbl tbody tr').length,
    /* La pénalité de l'HÔTE, reconnue à sa valeur exacte et non au maximum du tableau.

    Les voitures de l'IA sortent aussi, donc le maximum pouvait venir de n'importe laquelle : l'essai
    passait en lisant 4,5 s là où il attendait 3,5. On cherche donc la valeur qu'on a posée —
    2 sorties à 1 s, plus 1,5 s reprises — que seule une pénalité fabriquée peut produire, les
    pénalités de l'IA étant des nombres entiers de secondes. */
    pen: app.race.results ? app.race.results.map((r) => +r.penalite.toFixed(2)) : [],
  }));
  dit(fin.etat === 'results', `l'invite arrive a l'ecran des resultats (${fin.etat})`);
  dit(fin.classement >= 2 && fin.tableau >= 2, `le classement est construit chez lui (${fin.classement} lignes, ${fin.tableau} au tableau)`);
  dit(fin.pen.some((x) => Math.abs(x - 3.5) < 0.02),
    `et la penalite de l'hote y figure exactement (3,5 s attendus, vu ${fin.pen.join(' / ')})`);

  console.log(`\nfautes ${fautes} | erreurs ${erreurs}`);
  await nav.close();
  serveur.close();
  process.exit(fautes || erreurs ? 1 : 0);
})();
