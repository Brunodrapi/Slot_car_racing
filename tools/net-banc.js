// Le banc du multijoueur : ce qu'il coûte, et ce qu'il fait sentir.
//
//   node tools/net-banc.js [--joueurs=2,4,6,8] [--secondes=14] [--retard=60] [--gigue=20] [--perte=0.02]
//
// Jusqu'ici, rien ne mesurait le réseau. `e2e-duo.js` remplace WebRTC par `BroadcastChannel` et
// éprouve tout ce qui vit AU-DESSUS du transport — le salon, les places, la grille, la reprise —
// mais il ne voit ni latence, ni gigue, ni perte, ni débit. On améliorait donc à l'aveugle le seul
// endroit du jeu dont personne ne connaissait les chiffres.
//
// Le transport reste un double : on ne peut pas exiger d'un essai qu'il trouve un annuaire public
// et deux NAT à traverser. Mais les DÉFAUTS, eux, sont réels et imposés : chaque message part avec
// un retard tiré au sort autour d'une moyenne, et une fraction est jetée. C'est exactement ce que
// fait un réseau mobile, et c'est ce qu'il fallait pouvoir faire varier.
//
// Quatre chiffres sortent d'ici, et chacun répond à une question qu'on se posait sans y répondre :
//
//   MONTÉE DE L'HÔTE — tient-elle dans une voie montante 4G ? C'est elle qui plafonne le nombre de
//   joueurs, et elle grandit en N² tant que l'hôte relaie les invités entre eux, en N seulement
//   quand il ne le fait plus.
//
//   RETARD DU POUCE — entre l'appui et le moment où la voiture de l'invité bouge. C'est ce qui se
//   sent, et aucune autre mesure ne le remplace.
//
//   SACCADE — l'écart entre deux positions successives chez l'invité, qui ne simule rien. Une
//   moyenne basse avec un maximum élevé décrit un jeu qui semble fluide et saute par moments.
//
//   SILENCE — la plus longue coupure vue par un invité. C'est elle qui décide si la perte se voit.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wav': 'audio/wav',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };
const arg = (n, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.split('=')[1] : d;
};
const JOUEURS = String(arg('joueurs', '2,4,6,8')).split(',').map(Number);
const SEC = +arg('secondes', 14);
const RETARD = +arg('retard', 60);     // aller simple, en ms
const GIGUE = +arg('gigue', 20);
const PERTE = +arg('perte', 0.02);
/* `--relais=1` rallume le relais pendant la course, pour mesurer ce qu'il coûtait.

Un gain qu'on ne peut pas remettre à zéro n'est pas un gain mesuré, c'est un gain raconté. Le
banc doit pouvoir rejouer l'ancien comportement, sinon le chiffre d'après ne se compare à rien. */
const RELAIS = arg('relais', '0') === '1';

/* Le double de transport, avec ses défauts et ses compteurs.

Il garde la surface de `RoomRTC` — `claim`, `presence`, `peers`, `onPeers`, `close`, `relayer` — et
reproduit sa sémantique exacte : la présence part entière à chaque envoi, l'hôte relaie aux autres
QUAND `relayer` est vrai, et un message peut arriver après un plus récent. Ce dernier point n'est
pas un détail : c'est lui qui justifie les numéros de séquence du jeu, et un double qui livrerait
tout dans l'ordre les ferait passer pour inutiles. */
const DOUBLE = (retard, gigue, perte) => `
(() => {
  const RETARD = ${retard}, GIGUE = ${gigue}, PERTE = ${perte};
  window.__net = { envoyes: 0, octets: 0, recus: 0, octetsRecus: 0, jetes: 0 };
  const taille = (x) => {
    if (x == null) return 0;
    if (x instanceof Uint8Array || x instanceof ArrayBuffer) return x.byteLength;
    if (typeof x !== 'object') return JSON.stringify(x).length;
    let n = 2;
    for (const k in x) n += k.length + 3 + taille(x[k]);
    return n;
  };
  class RoomBanc {
    static available() { return true; }
    constructor() { this.mine = {}; this.others = new Map(); this.label = null; this.h = []; this.ch = null; this.relayer = true; }
    claim(code, asHost) {
      this.label = (asHost ? '0-' : '1-') + Math.random().toString(36).slice(2, 7);
      this.hote = asHost;
      this.ch = new BroadcastChannel('eol-banc-' + code);
      this.ch.onmessage = (e) => {
        const m = e.data;
        if (m.from === this.label) return;
        if (m.type === 'bonjour') this.envoi();
        if (m.pour && m.pour !== this.label) return;       // un relais ciblé ne concerne que lui
        window.__net.recus++; window.__net.octetsRecus += m.o || 0;
        this.others.set(m.from, { presence: m.p, updatedAt: Date.now() });
        /* L'hôte relaie — ou pas. C'est le comportement même qu'on mesure, donc le double doit
        l'avoir, sans quoi le banc dirait que couper le relais ne change rien. */
        if (this.hote && this.relayer && m.type === 'p') {
          for (const [k] of this.others) if (k !== m.from) this.poste({ type: 'p', from: m.from, p: m.p, pour: k });
        }
        this.fire();
      };
      this.ch.postMessage({ type: 'bonjour', from: this.label, p: this.mine, o: 0 });
      setTimeout(() => this.fire(), 0);
      return Promise.resolve();
    }
    /* Le cout se compte comme WebRTC le facture : UNE FOIS PAR CONNEXION.

    Le canal de diffusion poste une fois pour tout le monde, la ou le vrai transport boucle sur ses
    connexions et envoie a chacune. Compter un envoi par message aurait divise la voie montante de
    l'hote par le nombre d'invites : le banc aurait annonce 0,24 Mbit/s la ou le reseau en voit sept
    fois plus, et aurait donc menti sur la seule chose pour laquelle il existe. Un message cible
    (le relais) coute un envoi ; une presence en coute autant qu'il y a de pairs.

    Sans accent grave dans ce bloc : il vit dans un gabarit de chaine, et le premier le refermerait.
    */
    poste(msg) {
      /* Un tableau d'octets se compte en octets, pas en longueur de son JSON.

      JSON.stringify d'un Uint8Array rend un objet à clés numériques — plusieurs fois le poids
      réel. Le banc aurait annoncé que le passage au binaire coûte plus cher qu'il ne rapporte,
      ce qui est le contraire de ce qu'il mesure. */
      const o = taille(msg);
      msg.o = o;
      const copies = msg.pour ? 1 : Math.max(1, this.others.size);
      window.__net.envoyes += copies; window.__net.octets += o * copies;
      if (Math.random() < PERTE) { window.__net.jetes++; return; }   // le paquet n'arrivera jamais
      // le retard varie d'un message à l'autre : c'est la gigue, et c'est elle qui désordonne
      setTimeout(() => { try { this.ch.postMessage(msg); } catch (_) {} },
        Math.max(0, RETARD + (Math.random() * 2 - 1) * GIGUE));
    }
    envoi() { this.poste({ type: 'p', from: this.label, p: this.mine }); }
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
  window.RoomRTC = RoomBanc;
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
  // mêmes drapeaux que l'essai à deux écrans, et pour la même raison : sans eux, seul l'onglet au
  // premier plan échantillonne, et le banc mesure le bridage de Chromium au lieu du réseau
  const nav = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required',
    /* Chromium bride les onglets qui ne sont pas au premier plan : `requestAnimationFrame` y tombe
    à presque zéro. Avec deux écrans dans le même navigateur, un seul peut être devant — l'autre
    cessait donc d'échantillonner, et l'essai échouait au hasard selon la charge de la machine.
    Ces trois drapeaux éteignent ce bridage, et rendent la mesure indépendante de qui a le focus. */
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'] });

  console.log(`\n  reseau impose : ${RETARD} ms aller (gigue ±${GIGUE}), ${(PERTE * 100).toFixed(1)} % de perte`);
  console.log(`  relais entre invites pendant la course : ${RELAIS ? 'ALLUME (ancien comportement)' : 'eteint'}`);
  console.log(`  ${SEC} s de course par mesure\n`);
  console.log('  joueurs   montee hote   descente invite   retard du pouce   saccade moy/max   silence max');
  console.log('  ' + '-'.repeat(94));

  const lignes = [];
  for (const nj of JOUEURS) {
    const ctx = await nav.newContext({ viewport: { width: 420, height: 760 } });
    const pages = [];
    for (let i = 0; i < nj; i++) {
      const pg = await ctx.newPage();
      await pg.goto(base + '/index.html');
      await pg.waitForFunction(() => typeof app !== 'undefined' && app.save);
      await pg.evaluate((n) => { app.save.name = 'J' + n; storeSave(app.save); app.mondial = null; }, i);
      /* Le double se pose APRÈS le chargement, et non avant.

      Les scripts de la page définissent `RoomRTC` à l'évaluation ; un double installé trop tôt se
      ferait écraser par le vrai, et le banc mesurerait un transport WebRTC qui ne trouvera jamais
      son annuaire. `Net` ne lit la classe qu'à l'ouverture de la table, donc il est encore temps. */
      await pg.waitForTimeout(300);
      await pg.evaluate(DOUBLE(RETARD, GIGUE, PERTE));
      pages.push(pg);
    }
    const [hote, ...invites] = pages;
    const VOITURES = ['m1procar', 'f40', 'corvette', 'countach', '935', '930', 'csl', '787b'];

    const code = await hote.evaluate(async (m) => {
      app.save.models = app.save.models || {}; app.save.models.gt = m;
      await app.net.open('Hote', true, null);
      app.net.setMine({ car: { modelId: m } });
      app.ui._netReady(true); app.ui.lobbyScreen();
      return app.net.code;
    }, VOITURES[0]);
    for (let i = 0; i < invites.length; i++) {
      await invites[i].evaluate(async ({ c, nom, m }) => {
        app.save.models = app.save.models || {}; app.save.models.gt = m;
        await app.net.open(nom, false, c);
        app.net.setMine({ car: { modelId: m } });
        app.ui._netReady(true); app.ui.lobbyScreen();
      }, { c: code, nom: 'Invite ' + (i + 1), m: VOITURES[(i + 1) % VOITURES.length] });
    }
    await hote.waitForFunction((n) => app.net.members().length >= n, nj, { timeout: 25000 });
    await hote.evaluate(() => app.net.start());
    if (RELAIS) {
      await Promise.all(pages.map((p) => p.waitForFunction(() => app.net.state === 'playing', { timeout: 25000 })
        .then(() => p.evaluate(() => { if (app.net.room) app.net.room.relayer = true; }))));
    }
    await Promise.all(pages.map((p) => p.waitForFunction(() => app.state === 'race', { timeout: 25000 })));

    /* On ÉTEINT LE DESSIN sur tous les écrans avant de mesurer.

    Huit onglets qui peignent chacun un canevas à soixante images par seconde dans le même
    conteneur, ce n'est plus un banc réseau : c'est un banc de processeur graphique. La première
    série l'a montrée sans détour — à huit joueurs, relais coupé, le retard du pouce passait de 230
    à 378 ms et la saccade de 2,5 à 8,8 m, ce qui n'a aucun rapport avec le réseau et tout avec une
    machine à bout. La simulation, la couche réseau et l'extrapolation tournent toujours dans la
    boucle d'image ; seul le pinceau s'arrête. */
    for (const p of pages) await p.evaluate(() => { app.renderer.draw = () => {}; });

    // les sondes : chez l'invité, la position de SA voiture image par image
    const sonde = invites[0];
    await sonde.evaluate(() => {
      window.__s = { pas: [], silence: 0, maxSil: 0, dernier: null, t0: performance.now() };
      const boucle = () => {
        const p = app.race && app.race.player;
        if (p) {
          if (window.__s.dernier != null) {
            window.__s.pas.push(Math.hypot(p.pos.x - window.__s.dernier.x, p.pos.y - window.__s.dernier.y));
          }
          window.__s.dernier = { x: p.pos.x, y: p.pos.y };
          const sil = app.net ? app.net.silence() : 0;
          if (sil > window.__s.maxSil) window.__s.maxSil = sil;
        }
        requestAnimationFrame(boucle);
      };
      requestAnimationFrame(boucle);
    });

    // tout le monde roule, pour que la grille vive vraiment
    for (const p of pages) await p.evaluate(() => { app.input.throttle = true; });
    await hote.waitForTimeout(SEC * 1000 * 0.6);

    /* LE RETARD DU POUCE : on relâche chez l'invité et on attend que SA voiture ralentisse.

    On ne mesure pas l'aller-retour d'un paquet, qui ne dit rien au joueur, mais le temps entre son
    geste et l'effet visible sur sa propre voiture. C'est la seule grandeur qu'il ressent, et c'est
    celle qu'une prédiction locale ferait tomber à zéro. */
    const pouce = await sonde.evaluate(() => new Promise((res) => {
      const v0 = app.race.player.v;
      const t0 = performance.now();
      app.input.throttle = false;
      const voir = () => {
        if (app.race.player.v < v0 - 0.6) return res(performance.now() - t0);
        if (performance.now() - t0 > 2000) return res(-1);
        requestAnimationFrame(voir);
      };
      requestAnimationFrame(voir);
    }));
    for (const p of pages) await p.evaluate(() => { app.input.throttle = true; });
    await hote.waitForTimeout(SEC * 1000 * 0.4);

    const compte = async (p) => p.evaluate(() => window.__net);
    const cH = await compte(hote), cI = await compte(sonde);
    const s = await sonde.evaluate(() => {
      const pas = window.__s.pas.filter((x) => x > 0);
      pas.sort((a, b) => a - b);
      return { moy: pas.reduce((a, b) => a + b, 0) / (pas.length || 1),
               max: pas[pas.length - 1] || 0, maxSil: window.__s.maxSil, n: pas.length };
    });
    // zéro échantillon est un échec du banc, pas un résultat : une voiture qui n'a pas bougé ne
    // saute pas, et une moyenne calculée sur rien passerait pour un résultat parfait
    if (!s.n) { console.log(`  ${String(nj).padStart(5)}   ÉCHEC : aucune position relevée, le banc n'a rien vu`); await ctx.close(); continue; }
    const dur = SEC;
    const l = { nj, monte: cH.octets / dur, desc: cI.octetsRecus / dur, pouce,
                moy: s.moy, max: s.max, sil: s.maxSil, jetes: cH.jetes };
    lignes.push(l);
    console.log(`  ${String(nj).padStart(5)}   ${(l.monte / 1024).toFixed(1).padStart(7)} ko/s`
      + `   ${(l.desc / 1024).toFixed(1).padStart(10)} ko/s`
      + `   ${(pouce < 0 ? '  jamais' : pouce.toFixed(0).padStart(6) + ' ms')}`
      + `   ${s.moy.toFixed(2).padStart(6)} / ${s.max.toFixed(2).padEnd(6)} m`
      + `   ${s.maxSil.toFixed(2).padStart(6)} s`);
    await ctx.close();
  }

  console.log('\n  en voie montante chez l\'hote :');
  for (const l of lignes) console.log(`    ${l.nj} joueurs : ${(l.monte * 8 / 1e6).toFixed(2)} Mbit/s`);
  const pire = lignes[lignes.length - 1];
  console.log(`\n  une voie montante 4G tient 1 a 5 Mbit/s : a ${pire.nj} joueurs il en faut ${(pire.monte * 8 / 1e6).toFixed(2)}.`);

  await nav.close();
  serveur.close();
})();
