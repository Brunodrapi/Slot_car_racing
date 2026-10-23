// Les animations de l'écran « Comment jouer », filmées dans le vrai jeu.
//
//   NODE_PATH=$(npm root -g) node tools/comment-jouer.js [--seul=tactile-levier-fr] [--images=dossier]
//
// Trois gestes — appuyer (ça accélère), relâcher (ça freine), pousser le levier (ça change de ligne) —
// en deux versions : au doigt, au format d'un iPhone, et au clavier, au format d'un ordinateur. Chacune
// en français et en anglais, puisque le levier et le HUD portent du texte. Douze fichiers WebP animés
// dans art/interface/comment-jouer/, que l'écran charge selon l'appareil et la langue.
//
// POURQUOI DES WEBP ANIMÉS, ET PAS DES VIDÉOS. Une vidéo pèse six fois moins, mais un iPhone en mode
// économie d'énergie refuse de la lancer seule, et Safari la demande par morceaux (`Range`) — ce que le
// service worker, figé, ne sait pas servir hors ligne. Une image animée se joue partout, toujours. Le
// GIF, lui, pesait 2,5 fois plus lourd pour une image moins fidèle.
//
// LE TEMPS EST FIGÉ. La boucle du jeu est coupée (`requestAnimationFrame` neutralisé) et `performance.now`
// rend une horloge qu'on avance d'une image à la fois : chaque image de l'animation est une vraie image du
// jeu, calculée par `app._frame`, avec la physique, la caméra et le HUD d'une partie. Les gestes passent
// par les vrais écouteurs — des `PointerEvent` tactiles sur le canevas, des touches sur la fenêtre — donc
// la pastille vient sous le doigt et le levier saute de cran avec son hystérésis, comme en course.
//
// LE DOIGT ET LES TOUCHES sont dessinés par-dessus, sur un canevas transparent redessiné à chaque image
// depuis la même horloge : une animation CSS avancerait au temps réel, celui que prend la capture.
'use strict';
const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const ROOT = path.join(__dirname, '..');
const SORTIE = path.join(ROOT, 'art/interface/comment-jouer');
const arg = (nom) => { const a = process.argv.find((x) => x.startsWith(`--${nom}=`)); return a ? a.slice(nom.length + 3) : null; };
const SEUL = arg('seul');
const IMAGES = arg('images');
/* Capturé à 15 images par seconde — le pas des gestes, assez fin pour lever le pied au bon mètre — et
encodé à 12. Le défilement du décor coûte cher (la caméra suit la voiture, chaque image change en
entier) : à 15 images par seconde et 340 px de large, le seul freinage pesait 500 ko. À 12, le geste reste lisible et
les douze animations tiennent ensemble sous 3 Mo, que le jeu installé garde pour jouer hors ligne. */
const IPS = 15, IPS_FICHIER = 12, QUALITE = 45;

/* Les deux formats. Au doigt, on coupe le haut de l'écran (chrono, carte) : il ne montre aucun geste, et
l'animation gagne en hauteur ce qu'elle perd en contexte — la voiture, la vitesse, la pastille et le levier
restent. Au clavier, toute la largeur (le levier est à gauche, le tableau de bord à droite), moins le
bandeau du haut. */
const FORMATS = {
  tactile: { ctx: { ...devices['iPhone 13'], deviceScaleFactor: 2 }, coupe: { x: 0, y: 160, width: 390, height: 504 }, largeur: 320 },
  clavier: { ctx: { viewport: { width: 840, height: 525 }, deviceScaleFactor: 2 }, coupe: { x: 0, y: 110, width: 840, height: 415 }, largeur: 520 },
};

/* Les trois gestes. Chaque scène place la voiture, puis une suite de gestes, chacun daté en secondes,
en vitesse (« 70 km/h ») ou laissé à l'IA (« IA »).

Tout se joue sur la grande ligne droite de Parco Reale, qui file vers la DROITE de l'écran : la ligne
jaune y est en haut et la bleue en bas, comme sur le levier — pousser vers le haut fait monter la voiture.
La caméra du jeu garde son orientation (la vue par défaut), donc cette correspondance tient tout le plan.
Le décor y est un pré : une forêt qui défile coûtait trois fois plus lourd, pour rien à expliquer.
- gaz : départ arrêté, le doigt se pose, ça accélère ;
- frein : lancé vers la courbe du bout de la ligne droite, le doigt se lève là où l'IA lève le pied
  (vers 230 km/h, avant les panneaux : le geste « IA » le demande à `aiThrottle` à chaque image), et
  ne revient que la voiture descendue à 70 km/h — la vitesse de la courbe. Réappuyer plus tôt et pied au plancher, la voiture sort : mesuré, c'est ce qui arrive à tout
  réappui au-dessus de 80 km/h. Le réappui est donc déclenché par la vitesse, pas par l'horloge, pour
  rester juste si la physique change ;
- levier : pied au plancher, le pouce gauche monte au jaune, descend au bleu en passant par l'idéale,
  et revient au milieu. */
const SCENES = {
  gaz: { piste: 'monza', s: 2140, v: 0, duree: 4.2, gestes: [[0.7, 'gaz', true]] },
  frein: { piste: 'monza', s: 2420, v: 60, duree: 5.4, gaz: true, gestes: [['IA', 'gaz', false], ['70 km/h', 'gaz', true]] },
  levier: { piste: 'monza', s: 2150, v: 22, duree: 4.6, gaz: true, gestes: [[0.6, 'cran', 1], [1.9, 'cran', -1], [3.4, 'cran', 0]] },
};

async function filme(browser, format, scene, lang, dossier) {
  const F = FORMATS[format], S = SCENES[scene];
  const ctx = await browser.newContext({ ...F.ctx, locale: lang === 'en' ? 'en-US' : 'fr-FR' });
  await ctx.addInitScript((lang) => localStorage.setItem('slotracer.save.v2', JSON.stringify({
    name: 'Bruno', lang, sound: false, tracesMigrated: true, catsMigrated: true, guideMigrated: true })), lang);
  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForFunction(() => typeof app !== 'undefined' && app.save);
  await p.evaluate(async ({ S, format, lang }) => {
    app.mondial = null; app.analytics.begin = () => {}; app.analytics.observe = () => {};
    app.leaveSplash();
    app.startQuick('timetrial', 'gt', S.piste);
    const race = app.race;
    const limite = Date.now() + 20000;
    while (!race.cars.every((c) => topReady(c.cls, c.livree))) {
      if (Date.now() > limite) throw Error('vignettes de voiture introuvables');
      await new Promise((r) => setTimeout(r, 50));
    }
    await document.fonts.ready;
    // le temps réel s'arrête ici : la dernière image demandée tombe dans le vide
    window.requestAnimationFrame = () => 0;
    await new Promise((r) => setTimeout(r, 100));
    let t = performance.now();
    performance.now = () => t;
    race.state = 'racing'; race.countdown = 0; race.time = 5;
    const T = race.track, pl = race.player;
    pl.place(T.wrap(S.s), 0, S.v); pl.started = true; pl.lap = 1; pl.lapStart = 0; pl.state = 'ok';
    app.renderer.cam.init = false;

    const R = app.renderer, c = app.canvas;
    const yCran = (v) => R.slider.y + R.slider.len / 2 - v * R.slider.len / 2;
    const pointeur = (type, id, x, y) => (type === 'pointerup' ? window : c).dispatchEvent(
      new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: y, bubbles: true }));
    // sur le corps de la page : l'écouteur de la fenêtre lit `e.target.closest`, que la fenêtre n'a pas
    const touche = (type, key, code) => document.body.dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true }));

    // le calque des gestes, au-dessus de tout
    const calque = document.createElement('canvas');
    calque.width = innerWidth * devicePixelRatio; calque.height = innerHeight * devicePixelRatio;
    Object.assign(calque.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', zIndex: 99, pointerEvents: 'none' });
    document.body.appendChild(calque);
    const g = calque.getContext('2d');
    g.scale(devicePixelRatio, devicePixelRatio);

    /* L'état des gestes : le gaz (appuyé ou non, et depuis quand), le cran visé, et le pouce du levier
    qui glisse d'un cran à l'autre en un quart de seconde — c'est le glissé qui fait sauter la poignée,
    au passage du milieu, et non un saut décidé ici. */
    const etat = { gaz: false, depuisGaz: -9, cran: 0, levier: { de: 0, a: 0, depuis: -9, actif: !!S.gestes.some((x) => x[1] === 'cran') } };
    const GLISSE = 0.25;
    const lisse = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
    const levierV = (temps) => {
      const L = etat.levier;
      return L.de + (L.a - L.de) * lisse((temps - L.depuis) / GLISSE);
    };
    const gaz = (oui, temps) => {
      if (etat.gaz === oui) return;
      etat.gaz = oui; etat.depuisGaz = temps;
      if (format === 'tactile') pointeur(oui ? 'pointerdown' : 'pointerup', 1, R.pouce.cx, R.pouce.cy);
      else touche(oui ? 'keydown' : 'keyup', ' ', 'Space');
    };
    const cran = (v, temps) => {
      const L = etat.levier;
      L.de = levierV(temps); L.a = v; L.depuis = temps;
      if (format === 'clavier') {
        // une flèche par cran, espacées comme des appuis réels
        const pas = Math.sign(v - etat.cran);
        L.touches = [];
        for (let k = 0; k < Math.abs(v - etat.cran); k++) L.touches.push({ t: temps + k * 0.32, sens: pas, fait: false });
      }
      etat.cran = v;
    };
    // en tactile, le pouce gauche est posé sur le levier pendant tout le plan qui s'en sert
    if (format === 'tactile' && etat.levier.actif) pointeur('pointerdown', 2, R.slider.x, yCran(0));

    const libelle = (k) => ({ fr: { espace: 'ESPACE' }, en: { espace: 'SPACE' } })[lang][k];
    /* Un doigt dessiné, plat et cerné comme le reste du jeu. Un simple cercle se confondait avec la
    pastille, qui est elle-même un disque : on ne voyait pas qu'un doigt appuyait. Levé, le doigt flotte
    au-dessus du point, son ombre s'éloigne ; posé, il l'écrase et une onde part du bout. `appui` va de 0
    (levé) à 1 (posé) ; `penche` incline la main, à droite pour le gaz, à gauche pour le levier. */
    const doigt = (x, y, appui, depuisAppui, temps, penche) => {
      const leve = 1 - appui, cote = penche < 0 ? 1 : -1;
      const bx = x + cote * 8 * leve, by = y - 30 * leve;
      const capsule = () => { g.beginPath(); g.roundRect(-17, -17, 34, 170, 17); };
      g.save();
      const u = temps - depuisAppui;
      if (appui >= 1 && u < 0.5) {
        g.beginPath(); g.arc(x, y, 20 + 34 * (u / 0.5), 0, Math.PI * 2);
        g.strokeStyle = `rgba(255,255,255,${0.95 * (1 - u / 0.5)})`; g.lineWidth = 5; g.stroke();
      }
      g.save(); g.translate(bx + 6 + 12 * leve, by + 8 + 22 * leve); g.rotate(penche);
      g.filter = `blur(${2 + 4 * leve}px)`; g.fillStyle = `rgba(0,0,0,${0.32 - 0.12 * leve})`; capsule(); g.fill();
      g.restore();
      g.translate(bx, by); g.rotate(penche);
      capsule(); g.fillStyle = '#f2c7a5'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#171b19'; g.stroke();
      g.beginPath(); g.roundRect(-10, -12, 20, 21, 8); g.fillStyle = '#fbe6d6'; g.fill(); g.lineWidth = 2; g.stroke();
      g.lineWidth = 2.2; g.lineCap = 'round';
      for (const yy of [52, 100]) { g.beginPath(); g.moveTo(-8, yy); g.quadraticCurveTo(0, yy + 4, 8, yy); g.stroke(); }
      g.restore();
    };
    const capuchon = (x, y, w, h, texte, presse, accent) => {
      // une touche de clavier : enfoncée, elle descend et prend la couleur de ce qu'elle commande
      const d = presse ? 4 : 0;
      g.save();
      g.fillStyle = '#0b0d0c'; g.beginPath(); g.roundRect(x, y + 6, w, h, 9); g.fill();
      g.fillStyle = presse ? accent : '#fff3dc'; g.beginPath(); g.roundRect(x, y + d, w, h, 9); g.fill();
      g.lineWidth = 2.5; g.strokeStyle = '#171b19'; g.stroke();
      g.fillStyle = '#171b19'; g.font = `italic 900 ${h * 0.5}px Racing, Impact, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(texte, x + w / 2, y + d + h / 2 + 1);
      g.restore();
    };

    window.__image = (temps, dt) => {
      // un geste daté en secondes, en vitesse (« 70 km/h » : dès que la voiture y est descendue), ou
      // laissé à l'IA (« IA » : dès qu'elle lèverait le pied à la place du joueur)
      for (const geste of S.gestes) {
        const [quand, quoi, valeur] = geste;
        const kmh = typeof quand === 'string' && quand !== 'IA' ? parseFloat(quand) : null;
        const maintenant = quand === 'IA' ? !geste.fait && !aiThrottle(pl, race.cars, dt, race.difficulty)
          : kmh != null ? !geste.fait && pl.speed * 3.6 <= kmh : quand <= temps && quand > temps - dt;
        if (!maintenant) continue;
        geste.fait = true;
        if (quoi === 'gaz') gaz(valeur, temps); else cran(valeur, temps);
      }
      if (format === 'tactile' && etat.levier.actif) pointeur('pointermove', 2, R.slider.x, yCran(levierV(temps)));
      if (format === 'clavier' && etat.levier.touches) for (const k of etat.levier.touches) {
        if (!k.fait && k.t <= temps) { k.fait = true; k.bas = temps; touche('keydown', k.sens > 0 ? 'ArrowUp' : 'ArrowDown', k.sens > 0 ? 'ArrowUp' : 'ArrowDown'); }
        if (k.fait && !k.leve && temps - k.bas > 0.16) { k.leve = true; touche('keyup', k.sens > 0 ? 'ArrowUp' : 'ArrowDown', k.sens > 0 ? 'ArrowUp' : 'ArrowDown'); }
      }
      t += dt * 1000;
      app._frame(t);
      g.clearRect(0, 0, innerWidth, innerHeight);
      if (format === 'tactile') {
        // le gaz se pose en un dixième de seconde et se lève en un peu plus : on voit le geste, pas un saut
        const u = temps - etat.depuisGaz;
        const appui = etat.gaz ? lisse(u / 0.1) : 1 - lisse(u / 0.16);
        doigt(R.pouce.cx, R.pouce.cy, appui, etat.depuisGaz + 0.1, temps, -0.42);
        // le pouce du levier est dessiné un peu sous la poignée, qu'il cacherait sinon : c'est elle qu'on regarde
        if (etat.levier.actif) doigt(R.slider.x - 3, yCran(levierV(temps)) + 19, 1, -9, temps, 0.42);
      } else {
        // la barre d'espace au-dessus du cadran d'accélérateur, les flèches à droite du levier
        const z = R.hudZones.accelerateur;
        capuchon(z.x + z.w / 2 - 110, z.y - 62, 220, 46, libelle('espace'), etat.gaz, '#5be07a');
        if (!etat.levier.actif) return;
        const ks = etat.levier.touches || [], enfoncee = (sens) => ks.some((k) => k.sens === sens && k.fait && !k.leve);
        const lx = R.slider.x + 96, ly = R.slider.y + R.slider.len / 2;
        capuchon(lx, ly - 52, 46, 46, '↑', enfoncee(1), '#f2c52c');
        capuchon(lx, ly + 6, 46, 46, '↓', enfoncee(-1), '#7fd4ff');
      }
    };
    if (S.gaz) gaz(true, -9);
    // quelques images pour que la caméra se pose avant la première prise
    for (let i = 0; i < 8; i++) { t += 50; app._frame(t); }
  }, { S, format, lang });

  const n = Math.round(S.duree * IPS);
  const etats = [];
  for (let i = 0; i < n; i++) {
    const e = await p.evaluate(([i, dt]) => {
      __image(i * dt, dt);
      const pl = app.race.player;
      return { kmh: Math.round(pl.speed * 3.6), etat: pl.state, sel: app.input.sel, gaz: !!app.input.throttle };
    }, [i, 1 / IPS]);
    etats.push(e);
    await p.screenshot({ path: path.join(dossier, `${String(i).padStart(3, '0')}.png`), clip: F.coupe || undefined });
  }
  await ctx.close();
  return { etats, erreurs };
}

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const browser = await chromium.launch();
  const bilan = [];
  try {
    for (const format of Object.keys(FORMATS)) for (const scene of Object.keys(SCENES)) for (const lang of ['fr', 'en']) {
      const nom = `${format}-${scene}-${lang}`;
      if (SEUL && SEUL !== nom) continue;
      const dossier = IMAGES ? path.join(IMAGES, nom) : fs.mkdtempSync(path.join(os.tmpdir(), 'cj-'));
      fs.rmSync(dossier, { recursive: true, force: true }); fs.mkdirSync(dossier, { recursive: true });
      const { etats, erreurs } = await filme(browser, format, scene, lang, dossier);
      const fichier = path.join(SORTIE, `${nom}.webp`);
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(IPS), '-i', path.join(dossier, '%03d.png'),
        '-vf', `fps=${IPS_FICHIER},scale=${FORMATS[format].largeur}:-2:flags=lanczos`, '-c:v', 'libwebp_anim', '-lossless', '0', '-q:v', String(QUALITE),
        '-compression_level', '6', '-loop', '0', fichier]);
      if (!IMAGES) fs.rmSync(dossier, { recursive: true, force: true });
      const vitesses = etats.map((e) => e.kmh);
      const hors = etats.filter((e) => e.etat !== 'ok').length;
      bilan.push(nom);
      console.log(`${nom.padEnd(22)} ${(fs.statSync(fichier).size / 1024).toFixed(0).padStart(4)} ko  ${vitesses[0]}→${Math.max(...vitesses)}→${vitesses.at(-1)} km/h`
        + `  lignes ${[...new Set(etats.map((e) => e.sel))].join('/')}${hors ? `  HORS PISTE ${hors} images` : ''}${erreurs.length ? '  ERREURS ' + erreurs.join(' | ') : ''}`);
    }
  } finally {
    await browser.close();
  }
  if (!bilan.length) { console.error('aucune scène ne correspond à --seul'); process.exitCode = 1; }
})();
