// Le jeu en anglais : plus un mot de français, sur aucun écran.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-anglais.js [--liste]
//
// On règle la langue sur l'anglais et l'on passe par tous les écrans — titre, nom du pilote, accueil,
// réglages, préparation d'une course et d'un contre-la-montre (records compris), carrière, coupe,
// atelier, salon multijoueur, course (HUD dessiné sur le canevas, drapeaux), pause, résultats,
// spectateur, page des statistiques — au format d'un iPhone et d'un ordinateur. Tout le texte visible
// est relevé, celui du DOM comme celui que le canevas dessine (`fillText`, `strokeText`), et l'on y
// cherche du français : des lettres accentuées, des mots courants. Les noms propres du jeu (voitures,
// circuits, pilotes, équipes) sont identiques dans les deux langues et ne comptent pas.
//
// --liste imprime tout ce qui reste, écran par écran, au lieu de s'arrêter au compte.
'use strict';
const { chromium, devices } = require('playwright');
const path = require('path');
const LISTE = process.argv.includes('--liste');
const ROOT = path.join(__dirname, '..');
let fautes = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAUX  ') + m); if (!c) fautes++; };

// Ce qui trahit le français. Les mots sont pris entiers ; les accents, partout.
const MOTS = ['le', 'la', 'les', 'des', 'du', 'une', 'est', 'pas', 'pour', 'avec', 'sur', 'dans', 'tour', 'tours', 'voiture',
  'voitures', 'course', 'courses', 'réglages', 'pilote', 'pilotes', 'joueur', 'aucun', 'aucune', 'retour', 'chargement', 'attente',
  'meilleur', 'temps', 'départ', 'arrivée', 'vous', 'votre', 'vos', 'ici', 'et', 'ou', 'annulé', 'hôte', 'invité', 'salon',
  'ligne', 'stands', 'résultats', 'classement', 'écart', 'dernier', 'précédent', 'encore', 'déjà', 'trop', 'moins',
  'sans', 'choisir', 'jouer', 'quitter', 'continuer', 'reprendre', 'liaison', 'interrompue', 'gaz', 'frein', 'manette',
  'clavier', 'molette', 'bleu', 'bleue', 'jaune', 'rouge', 'vert', 'noir', 'blanc', 'hommage', 'idéale',
  'appuie', 'commencer', 'drapeau', 'sortie', 'sorties', 'vitesse', 'maxi', 'moyen', 'régularité', 'caméras', 'fixes',
  'réalisateur', 'chronos', 'coupe', 'saison', 'manche', 'manches', 'atelier', 'longueur', 'largeur', 'catégorie'];
const MOT = new RegExp(`(^|[^\\p{L}])(${MOTS.join('|')})([^\\p{L}]|$)`, 'iu');
const ACCENT = /[éèêàùçôîïâëœ]/i;
// Les noms propres, identiques en français et en anglais.
const PROPRES = [/Breithüft[\w ]*/gi, /Stand de frites/gi, /Le Rocher/gi, /Le Coq Bleu 11/gi, /Festival de Carnaval/gi, /Écurie Écosse/gi,
  /Équipe Nationale Belge/gi, /Le Mans 19\d\d/gi, /Spirit of Le Mans/gi, /Français/g, /Kremer/gi, /P\. Dubois/g, /I\. Kovács/g];
function francais(texte) {
  let t = String(texte || '');
  for (const r of PROPRES) t = t.replace(r, ' ');
  return ACCENT.test(t) || MOT.test(t);
}

async function releve(p) {
  return p.evaluate(() => {
    const dom = (document.body.innerText || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const attr = [...document.querySelectorAll('[title],[aria-label],[placeholder],option')].flatMap((e) =>
      [e.getAttribute('title'), e.getAttribute('aria-label'), e.getAttribute('placeholder'), e.tagName === 'OPTION' ? e.textContent : null]).filter(Boolean);
    const canevas = [...(window.__textes || [])];
    window.__textes = new Set();
    return [...new Set([...dom, ...attr, ...canevas])];
  });
}

(async () => {
  const browser = await chromium.launch();
  const reste = {};
  try {
    for (const [format, opts] of [['iPhone', { ...devices['iPhone 13'] }], ['ordinateur', { viewport: { width: 1366, height: 800 } }]]) {
      console.log(format);
      const ctx = await browser.newContext({ ...opts, locale: 'en-US' });
      await ctx.addInitScript(() => {
        window.__textes = new Set();
        for (const f of ['fillText', 'strokeText']) {
          const o = CanvasRenderingContext2D.prototype[f];
          CanvasRenderingContext2D.prototype[f] = function (t, ...a) { if (window.__textes && String(t).trim()) window.__textes.add(String(t).trim()); return o.call(this, t, ...a); };
        }
      });
      const p = await ctx.newPage();
      const erreurs = [];
      p.on('pageerror', (e) => erreurs.push(e.message));
      const ecran = async (nom, action, attente = 400) => {
        if (action) await p.evaluate(action);
        await p.waitForTimeout(attente);
        const fr = (await releve(p)).filter(francais);
        if (fr.length) reste[`${format} · ${nom}`] = fr;
        return fr;
      };
      await p.goto('file://' + path.join(ROOT, 'index.html'));
      await p.waitForFunction(() => typeof app !== 'undefined' && app.save);
      // Le choix de la langue, en tête des réglages : un toucher sur « English » bascule tout l'écran,
      // et le choix est gardé dans la sauvegarde.
      const bascule = await p.evaluate(() => {
        app.save.lang = 'fr'; app.save.name = 'Bruno'; app.mondial = null; app.leaveSplash(); app.ui.settings();
        const premier = document.querySelector('#ui button, #ui input, #ui select');
        document.querySelector('[data-action="lang"][data-id="en"]').click();
        const garde = JSON.parse(localStorage.getItem('slotracer.save.v2') || '{}').lang;
        return { enTete: premier && premier.dataset.action === 'lang', lang: app.save.lang, garde, titre: document.querySelector('#ui h2').textContent,
          html: document.documentElement.lang, presse: document.querySelector('[data-action="lang"][data-id="en"]').getAttribute('aria-pressed') };
      });
      ok(bascule.enTete && bascule.lang === 'en' && bascule.garde === 'en' && bascule.titre === 'Settings' && bascule.html === 'en' && bascule.presse === 'true',
        `${format} : le choix de la langue est en tête des réglages, « English » bascule l'écran (« ${bascule.titre} ») et se garde`);
      await p.evaluate(() => { app.save.lang = 'en'; app.save.name = ''; app.mondial = null; app.ui.splash(); });
      await ecran('titre');
      await ecran('nom du pilote', () => { app.leaveSplash(); app.ui.nomScreen(); });
      await ecran('accueil', () => { app.save.name = 'Bruno'; app.state = 'menu'; app.ui.menu(); });
      await ecran('réglages', () => app.ui.settings());
      await ecran('course : préparation', () => { app.save.cat = 'gt'; app.ui.setupScreen('race'); });
      await ecran('contre-la-montre : records', () => app.ui.setupScreen('timetrial'));
      await ecran('carrière', () => app.ui.careerScreen());
      await ecran('coupe', () => app.ui.cupScreen(CUPS[0].id));
      await ecran('atelier', () => app.ui.workshopScreen());
      await ecran('salon multijoueur', () => app.ui.lobbyScreen());
      // La course : le décompte, le HUD, un drapeau, puis la pause et les résultats.
      await p.evaluate(() => { app.save.tutorialSeen = false; app.startQuick('race', 'gt', 'spa'); });
      await p.waitForFunction(() => app.race && app.race.state === 'racing', null, { timeout: 30000 });
      await ecran('course : départ et HUD', null, 2500);
      await ecran('course : en piste', () => { app.setThrottle(true); }, 3000);
      await ecran('pause', () => app.togglePause());
      await ecran('reprise', () => app.togglePause(), 600);
      await ecran('résultats', () => { const r = app.race; r.player.fautes = 2; r._finish(); app.ui.resultsScreen(r, {}); });
      if (format === 'ordinateur') {
        await ecran('spectateur', async () => {
          app.toMenu();
          app.startQuick('race', 'gt', 'spa');
          await new Promise((r) => setTimeout(r, 1500));
          app.spectator = new SpectatorView(app);
        }, 1500);
        await ecran('statistiques', null, 0);
        await p.goto('file://' + path.join(ROOT, 'analytics.html'));
        await p.waitForTimeout(1200);
        await ecran('statistiques');
      }
      ok(erreurs.length === 0, `${format} : aucune erreur de page` + (erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''));
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  const n = Object.values(reste).reduce((s, x) => s + x.length, 0);
  if (LISTE || n) for (const [ecran, l] of Object.entries(reste)) console.log(`  — ${ecran}\n` + l.map((x) => '      ' + x.slice(0, 140)).join('\n'));
  ok(n === 0, `aucun texte français à l'écran en anglais (${n} relevé${n > 1 ? 's' : ''})`);
  console.log(fautes ? `${fautes} faute(s)` : 'OK');
  process.exitCode = fautes ? 1 : 0;
})();
