// La barrière de chargement EN SOLO.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-charge-solo.js
//
// Elle est née du multijoueur et elle y était restée enfermée : le test de `tools/e2e-charge.js`
// montre une table qui attend ses huit écrans, et pendant ce temps une course solo partait pendant
// que les vignettes se décodaient et que les mégaoctets de prises de moteur arrivaient. Bruno l'a
// dit comme ça : « il faut un chargement avant de lancer même en solo pour avoir les sons ».
//
// Quatre choses à vérifier, et les deux dernières comptent autant que les deux premières : une
// barrière qui ne s'ouvre jamais est un blocage, et une barrière muette est indiscernable d'un
// plantage.
//
//   1. LE DÉCOMPTE ATTEND tant qu'un élément manque, et il repart quand il arrive.
//   2. LE SON EST LÀ AU DÉPART : à l'instant où la course passe en « racing », les prises de moteur
//      sont chargées. C'est la demande, et c'est la seule mesure qui la vérifie vraiment.
//   3. LA BARRIÈRE A UNE SORTIE : un téléchargement qui n'aboutira jamais ne retient pas le joueur.
//   4. ELLE SE DIT À L'ÉCRAN : on lit les textes réellement peints sur la toile pendant l'attente.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wav': 'audio/wav',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };

(async () => {
  const serveur = http.createServer((req, res) => {
    /* Une adresse qui ne répond JAMAIS, pour tenir une image en route.

    C'est la seule façon honnête de fabriquer « pas encore arrivé » : remplacer l'image par un faux
    objet mentirait sur ce que lit la barrière (`complete`), et une image en échec passe justement à
    `complete` — c'est voulu, un fichier absent ne doit pas retenir une course. Ici la connexion
    reste ouverte, donc l'image reste en chemin, comme sur un réseau lent. */
    if (req.url.split('?')[0] === '/jamais.png') return;    // ni réponse, ni fermeture
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
  const ctx = await nav.newContext({ viewport: { width: 420, height: 760 } });
  let fautes = 0, erreurs = 0;
  const dit = (ok, txt) => { if (!ok) fautes++; console.log(`  ${ok ? 'ok  ' : 'FAUX'}  ${txt}`); };

  const p = await ctx.newPage();
  p.on('pageerror', (e) => { erreurs++; console.log('[page]', e.message); });
  await p.goto(base + '/index.html');
  await p.waitForFunction(() => typeof app !== 'undefined' && app.save);
  await p.evaluate(() => {
    app.save.name = 'Solo'; app.save.sound = true; app.save.laps = 2;
    storeSave(app.save); app.audio.enabled = true; app.mondial = null;
  });
  await p.keyboard.press('Enter');          // le geste qui autorise le son
  await p.waitForTimeout(300);

  /* --- 1. le décompte attend un élément qui manque --- */
  console.log('\nune vignette qui tarde');
  /* On retient `topReady` plutôt que de couper le réseau : c'est la réponse exacte que consulte la
  barrière, et la retenir reproduit à l'identique une image pas encore décodée — sans rien casser
  d'autre dans la page, ce qu'une panne de serveur ferait. */
  await p.evaluate(() => {
    window._vraiTopReady = window.topReady;
    window.topReady = () => false;
    app.startQuick('race', 'gt', TRACKS[0].id);
  });
  await p.waitForFunction(() => app.state === 'race', { timeout: 15000 });
  await p.waitForTimeout(400);
  const a = await p.evaluate(() => ({ attente: app.race.attente, cd: app.race.countdown, etat: app.race.state }));
  await p.waitForTimeout(900);
  const b = await p.evaluate(() => ({ attente: app.race.attente, cd: app.race.countdown, etat: app.race.state }));
  dit(a.attente === true, `la course s'annonce en attente (attente ${a.attente})`);
  dit(Math.abs(b.cd - a.cd) < 0.05, `les feux ne defilent pas (${a.cd.toFixed(2)} -> ${b.cd.toFixed(2)})`);
  dit(b.etat === 'countdown', `elle n'est pas partie sans l'element qui manque (${b.etat})`);

  /* --- 4. ce que le joueur LIT pendant ce temps --- */
  /* Une barrière silencieuse, c'est le défaut d'avant déplacé : des feux arrêtés sans un mot. On lit
  donc les textes réellement peints, pas l'intention de les peindre. */
  const textes = await p.evaluate(async () => {
    const proto = CanvasRenderingContext2D.prototype;
    const vrai = proto.fillText;
    const vus = [];
    proto.fillText = function (s, ...r) { vus.push(String(s)); return vrai.call(this, s, ...r); };
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    proto.fillText = vrai;
    return vus;
  });
  const mots = textes.filter((s) => /hargement|oading/.test(s));
  dit(mots.length > 0, `« chargement » est ecrit a l'ecran (${mots.slice(0, 2).join(' · ') || `rien parmi : ${textes.slice(0, 6).join(' · ')}`})`);

  /* --- 1 bis. le son seul retient aussi --- */
  /* Sans ce contrôle, le précédent ne prouve que la moitié : la vignette retenait la course, et les
  prises de moteur avaient tout le temps d'arriver pendant ce temps-là. On retient donc le son SEUL,
  vignettes en ordre, pour voir que c'est bien lui que la barrière attend — c'est la demande. */
  console.log('\nle son seul');
  const sonSeul = await p.evaluate(async () => {
    window.topReady = window._vraiTopReady;
    const vrai = app.audio.pretAJouer.bind(app.audio);
    app.audio.pretAJouer = () => false;
    const cd0 = app.race.countdown;
    await new Promise((r) => setTimeout(r, 900));
    const out = { attente: app.race.attente, bouge: Math.abs(app.race.countdown - cd0) > 0.05, etat: app.race.state };
    app.audio.pretAJouer = vrai;
    return out;
  });
  dit(sonSeul.attente === true, `le son qui manque retient a lui seul (attente ${sonSeul.attente})`);
  dit(!sonSeul.bouge && sonSeul.etat === 'countdown', `les feux attendent le son (${sonSeul.etat})`);

  /* --- 2. le son est là quand la course part --- */
  console.log('\nle depart n\'a pas lieu avant le son');
  const depart = await p.evaluate(async () => {
    window.topReady = window._vraiTopReady;       // tout est en ordre
    const vus = [];
    await new Promise((fini) => {
      const tick = () => {
        vus.push({ etat: app.race.state, son: app.audio.pretAJouer(), cd: app.race.countdown });
        if (app.race.state === 'countdown' && vus.length < 1200) requestAnimationFrame(tick); else fini();
      };
      requestAnimationFrame(tick);
    });
    const premier = vus.find((v) => v.etat !== 'countdown') || vus[vus.length - 1];
    return { images: vus.length, etat: premier.etat, son: premier.son, repart: vus[vus.length - 1].cd < vus[0].cd };
  });
  dit(depart.repart, `le decompte repart une fois l'element arrive (${depart.images} images)`);
  dit(depart.etat !== 'countdown', `la course part (${depart.etat})`);
  dit(depart.son === true, `au depart, les prises de moteur sont chargees (${depart.son})`);

  /* --- 3. la sortie de la barrière --- */
  console.log('\nun element qui n\'arrivera jamais');
  const sortie = await p.evaluate(async () => {
    window.topReady = () => false;
    app.startQuick('race', 'gt', TRACKS[0].id);
    await new Promise((r) => setTimeout(r, 700));
    const retenue = app.race.attente;
    app.chargeDes = performance.now() - 13000;        // comme si l'attente durait depuis treize secondes
    await new Promise((r) => setTimeout(r, 200));
    const libre = app.race.attente;
    window.topReady = window._vraiTopReady;
    // on laisse la course PARTIR avant de rendre la main : l'essai suivant en lance une autre, et
    // deux courses qui se chevauchent ne mesurent plus rien de clair
    for (let i = 0; i < 100 && app.race.state === 'countdown'; i++) await new Promise((r) => setTimeout(r, 50));
    return { retenue, libre };
  });
  dit(sortie.retenue === true, `elle retient d'abord (${sortie.retenue})`);
  dit(sortie.libre === false, `passe le delai, on part avec ce qu'on a (${sortie.libre})`);

  /* --- le DÉCOR, qui descend par le même réseau et que personne n'attendait --- */
  console.log('\nun sprite de decor qui traine');
  const decor = await p.evaluate(async (hote) => {
    const r = app.renderer;
    const cle = Object.keys(r.propArt)[0];
    const vrai = r.propArt[cle];
    const lent = new Image();
    lent.src = hote + '/jamais.png';            // la connexion reste ouverte : l'image reste en route
    r.propArt[cle] = { img: lent, wm: vrai.wm, anchor: vrai.anchor };
    app.startQuick('race', 'gt', TRACKS[0].id);
    await new Promise((res) => setTimeout(res, 900));
    const retenue = app.race.attente;
    const cd0 = app.race.countdown;
    r.propArt[cle] = vrai;                       // le décor arrive
    await new Promise((res) => setTimeout(res, 400));
    return { retenue, libre: app.race.attente, repart: app.race.countdown < cd0 || app.race.state !== 'countdown' };
  }, base);
  dit(decor.retenue === true, `un sprite de decor en route retient la course (attente ${decor.retenue})`);
  dit(decor.libre === false && decor.repart, `elle repart quand il arrive (attente ${decor.libre})`);

  /* --- les trois « rien à attendre », qui ne doivent pas se confondre avec « en cours » --- */
  console.log('\nrien a attendre');
  const rien = await p.evaluate(() => {
    const au = app.audio, etat = { enabled: au.enabled, rate: au.rate, catalogue: au.catalogue, pret: au.pret };
    const essai = (f) => { f(); const r = au.pretAJouer(); Object.assign(au, etat); return r; };
    return {
      coupe: essai(() => { au.enabled = false; au.pret = false; }),
      rate: essai(() => { au.enabled = true; au.pret = false; au.rate = true; }),
      sansCatalogue: essai(() => { au.enabled = true; au.pret = false; au.rate = false; au.catalogue = false; }),
      enCours: essai(() => { au.enabled = true; au.pret = false; au.rate = false; au.catalogue = { jeux: {} }; }),
    };
  });
  dit(rien.coupe === true, `son coupe : on n'attend pas (${rien.coupe})`);
  dit(rien.rate === true, `telechargement echoue : on n'attend pas (${rien.rate})`);
  dit(rien.sansCatalogue === true, `catalogue absent : on n'attend pas (${rien.sansCatalogue})`);
  dit(rien.enCours === false, `chargement en cours : on attend (${rien.enCours})`);

  console.log(`\nfautes ${fautes} | erreurs ${erreurs}`);
  await nav.close();
  serveur.close();
  process.exit(fautes || erreurs ? 1 : 0);
})();
