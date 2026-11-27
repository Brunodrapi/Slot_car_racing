// La maquette sur un iPhone 13 émulé : chaque écran et chaque panneau photographié, et les mesures de
// l'audit (cibles tactiles, petits textes, hauteur). Le paddock doit tenir sur un écran.
//   node essais/maquette-paddock/outils/essai.cjs <dossier des photos>
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium, devices } = require('playwright');
const RACINE = path.resolve(__dirname, '../../..');
const OUT = process.argv[2] || '/tmp/maquette';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ttf': 'font/ttf' };
const mesure = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight; };
  const cibles = [...document.querySelectorAll('button, a[href], summary')].filter(vis).filter((el) => !el.closest('.voile'));
  const petites = cibles.filter((el) => { const r = el.getBoundingClientRect(); return Math.min(r.width, r.height) < 43.5; }).map((el) => (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20) + ' ' + Math.round(el.getBoundingClientRect().width) + '×' + Math.round(el.getBoundingClientRect().height));
  const textes = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) { const t = n.textContent.trim(); if (!t || !n.parentElement || !vis(n.parentElement)) continue; textes.push({ t, px: parseFloat(getComputedStyle(n.parentElement).fontSize) }); }
  const app = document.querySelector('.app');
  const coupes = [...document.querySelectorAll('.titre, b, small, span')].filter(vis).filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow === 'hidden').map((el) => el.textContent.trim().slice(0, 24));
  return { cibles: cibles.length, petites, mots: textes.reduce((a, x) => a + x.t.split(/\s+/).length, 0), sous13: textes.filter((x) => x.px < 13).map((x) => x.t.slice(0, 18) + ' ' + x.px), defile: app ? Math.round(app.scrollHeight - innerHeight) : null, coupes };
};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = http.createServer((q, s) => {
    const f = path.join(RACINE, decodeURIComponent(q.url.split('?')[0]));
    if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR' });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(String(e)));
  p.on('requestfailed', (r) => erreurs.push('échec ' + r.url()));
  p.on('response', (r) => { if (r.status() >= 400) erreurs.push(r.status() + ' ' + r.url()); });
  await p.goto(`http://127.0.0.1:${srv.address().port}/essais/maquette-paddock/index.html`);
  await p.waitForSelector('.menu');
  const photo = async (nom) => { await p.waitForTimeout(450); await p.screenshot({ path: path.join(OUT, nom + '.png') }); const m = await p.evaluate(mesure); console.log(nom.padEnd(16), JSON.stringify(m)); };
  const touche = async (sel) => { await p.locator(sel).first().tap(); };
  await photo('0-menu');
  await touche('[data-act="mode"][data-id="race"]'); await photo('1-paddock');
  await touche('.carte-circuit'); await photo('2-circuits');
  await touche('[data-act="circuit"][data-id="monaco"]'); await photo('3-paddock-monaco');
  await touche('.carte-garage'); await photo('4-garage');
  await touche('[data-act="filtre"][data-id="gt"]'); await touche('[data-act="voiture"]'); await p.evaluate(() => document.querySelector('.feuille .corps').scrollTop = 0); await photo('5-garage-gt');
  await touche('.feuille [data-act="fermer"]'); await photo('6-paddock-gt');
  await touche('[data-act="feuille"][data-id="difficulte"]'); await photo('7-difficulte');
  await touche('[data-act="difficulte"][data-id="hard"]');
  await touche('[data-act="feuille"][data-id="reglages"]'); await photo('8-reglages');
  await touche('[data-act="feuille"][data-id="freinage"]'); await photo('9-freinage');
  await touche('[data-act="freinage"][data-id="Tardif"]'); await touche('.feuille [data-act="fermer"]');
  await touche('.info'); await photo('10-circuit');
  await p.evaluate(() => document.querySelector('.page-circuit .defile').scrollTop = 600); await photo('11-chronos');
  await touche('.page-circuit [data-act="fermer"]');
  await touche('[data-act="nuit"]'); await photo('12-nuit');
  await touche('[data-act="enpiste"]'); await photo('13-depart');
  await touche('[data-act="retour-depart"]'); await touche('[data-act="menu"]');
  await touche('[data-act="mode"][data-id="timetrial"]'); await photo('14-contre-la-montre');
  await touche('[data-act="menu"]'); await touche('[data-act="mode"][data-id="training"]'); await photo('15-entrainement');
  // un geste vers le bas ferme une feuille
  await touche('.carte-circuit'); await p.waitForTimeout(400);
  const h = await p.locator('.feuille header').boundingBox();
  await p.mouse.move(h.x + 40, h.y + 10); await p.mouse.down(); await p.mouse.move(h.x + 40, h.y + 220, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(500);
  console.log('geste vers le bas : feuille fermée =', await p.evaluate(() => !document.querySelector('.feuille.ouverte')));
  console.log(erreurs.length ? 'ERREURS ' + erreurs.slice(0, 8).join(' | ') : 'aucune erreur');
  await b.close(); srv.close();
})();
