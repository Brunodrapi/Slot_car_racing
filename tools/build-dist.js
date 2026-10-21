#!/usr/bin/env node
/* LA VERSION PUBLIÉE : le jeu tel qu'on le donne à jouer, et rien de plus.

    npm run build                          # écrit dist/
    node tools/build-dist.js --sortie=x    # ailleurs
    node tools/build-dist.js --domaine=grip.game   # ajoute le fichier CNAME de GitHub Pages

Le dépôt se joue tel quel, sans compilation : c'est ce qui permet de travailler vite. La version
publiée en diffère sur trois points.

1. LE CODE EST MINIFIÉ. Chaque fichier passe par terser : commentaires retirés, blancs supprimés,
   variables locales renommées en une lettre. Les noms de premier niveau restent — les scripts se les
   partagent d'un fichier à l'autre, sans modules — mais tout ce qui explique le pourquoi disparaît.
   C'est une protection de lecture, pas un coffre : un navigateur exécute ce qu'il reçoit, donc ce qu'il
   reçoit se lit avec de la patience. La vraie protection, c'est le dépôt source en privé.
2. SEULS PARTENT LES FICHIERS DU JEU. Ni docs, ni outils, ni images de travail (`*-src`, reprises
   annotées, anciennes affiches) : la liste est celle des pages jouables et de ce qu'elles chargent.
3. LE JEU SE JOUE HORS LIGNE. Un service worker (`sw.js`) met tout le jeu en cache au premier
   lancement ; ajouté à l'écran d'accueil de l'iPhone, il démarre ensuite sans réseau. Le multijoueur,
   le tableau mondial et les statistiques gardent besoin du réseau, et le disent quand il manque.

Le cache porte un nom tiré du CONTENU des fichiers : une nouvelle publication l'invalide d'elle-même,
même si l'on a oublié de changer la version. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { minify } = require('terser');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const arg = (nom) => { const a = process.argv.find((x) => x.startsWith(`--${nom}=`)); return a ? a.slice(nom.length + 3) : null; };
const OUT = path.resolve(ROOT, arg('sortie') || 'dist');
const DOMAINE = arg('domaine');

// Les pages qu'on publie : le jeu, l'éditeur de circuits qu'il ouvre, la page des statistiques.
const PAGES = ['index.html', 'editor.html', 'analytics.html'];

// Les ressources chargées par leur nom calculé (une voiture, une livrée, un drapeau, un circuit) :
// des dossiers entiers, moins ce qui n'est que matière de travail.
const DOSSIERS = ['art/interface', 'sprites/top', 'sprites/pick', 'sprites/environnement', 'sounds/engine'];
const FICHIERS = ['favicon.ico', 'site.webmanifest', 'art/Pitstop.png',
  'art/affiche-titre-portrait.webp', 'art/affiche-titre-paysage.webp',
  'art/icone-16.png', 'art/icone-32.png', 'art/icone-48.png', 'art/icone-180.png', 'art/icone-192.png',
  'art/icone-512.png', 'art/icone-maskable-512.png'];
const EXCLURE = (rel) => /_reprise\.|\.md$|LICENSE$|(^|\/)\./.test(rel);

/* L'ENREGISTREMENT, injecté dans chaque page. Il fait aussi la MISE À JOUR : une nouvelle version
téléchargée en arrière-plan attend ; on ne la met en place que sur l'écran-titre ou dans les menus,
jamais en course ni dans un salon, puis la page se recharge pour la montrer. Une page ouverte sans
version précédente (le tout premier lancement) ne se recharge pas. */
const ENREGISTREMENT = `if ('serviceWorker' in navigator) addEventListener('load', () => {
  const avait = !!navigator.serviceWorker.controller;
  let fait = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (avait && !fait) { fait = true; location.reload(); } });
  const mettreEnPlace = (w) => {
    const etat = window.app && app.state;
    if (!etat || etat === 'splash' || etat === 'menu') w.postMessage('activer');
    else setTimeout(() => mettreEnPlace(w), 3000);
  };
  navigator.serviceWorker.register('sw.js').then((reg) => {
    if (reg.waiting && avait) mettreEnPlace(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w.addEventListener('statechange', () => { if (w.state === 'installed' && avait) mettreEnPlace(w); });
    });
  });
});`.replace(/\n\s*/g, ' ');

const copies = new Set();
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel));
function ecrire(rel, contenu) {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, contenu);
  copies.add(rel);
}
function copier(rel) {
  if (copies.has(rel) || EXCLURE(rel)) return;
  if (!fs.existsSync(path.join(ROOT, rel))) throw new Error('fichier absent : ' + rel);
  ecrire(rel, lire(rel));
}
function parcourir(rel) {
  for (const e of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
    const r = rel + '/' + e.name;
    if (e.isDirectory()) parcourir(r); else copier(r);
  }
}
const sansRequete = (u) => u.split('?')[0].split('#')[0];
const local = (u) => u && !/^([a-z]+:)?\/\//i.test(u) && !u.startsWith('data:') && !u.startsWith('#');

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  let avant = 0, apres = 0;

  // --- les pages, et ce qu'elles chargent ---
  const scripts = new Set(), feuilles = new Set();
  for (const page of PAGES) {
    let html = lire(page).toString('utf8');
    for (const m of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) if (local(m[1])) scripts.add(sansRequete(m[1]));
    for (const m of html.matchAll(/<link[^>]*\shref="([^"]+)"/g)) {
      if (!local(m[1])) continue;
      const rel = sansRequete(m[1]);
      if (rel.endsWith('.css')) feuilles.add(rel); else copier(rel);
    }
    // Les commentaires HTML partent comme ceux du code ; l'enregistrement du service worker arrive.
    html = html.replace(/<!--[\s\S]*?-->/g, '');
    html = html.replace('</body>', `  <script>${ENREGISTREMENT}</script>\n</body>`);
    ecrire(page, html);
  }

  // --- le code : minifié fichier par fichier ---
  for (const rel of scripts) {
    const src = lire(rel).toString('utf8');
    avant += src.length;
    // echarts arrive déjà minifié : le repasser ne gagne rien et coûte dix secondes.
    const sortie = rel.endsWith('.min.js') ? src : (await minify(src, {
      ecma: 2020, module: false, toplevel: false,
      compress: { passes: 2 }, mangle: true, format: { comments: false },
    })).code;
    if (sortie == null) throw new Error('minification impossible : ' + rel);
    apres += sortie.length;
    ecrire(rel, sortie);
  }

  // --- les feuilles de style, et les fichiers qu'elles appellent ---
  for (const rel of feuilles) {
    const css = lire(rel).toString('utf8');
    for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      if (!local(m[1])) continue;
      copier(path.posix.normalize(path.posix.join(path.posix.dirname(rel), sansRequete(m[1]))));
    }
    const { code } = await esbuild.transform(css, { loader: 'css', minify: true });
    avant += css.length; apres += code.length;
    ecrire(rel, code);
  }

  // --- les ressources ---
  for (const f of FICHIERS) copier(f);
  for (const d of DOSSIERS) parcourir(d);
  // Les sons que les fiches moteur désignent, où qu'ils soient rangés.
  for (const f of fs.readdirSync(path.join(ROOT, 'sounds/engine')).filter((n) => n.endsWith('.json'))) {
    const txt = lire('sounds/engine/' + f).toString('utf8');
    for (const m of txt.matchAll(/"(?:src|source)"\s*:\s*"([^"]+)"/g)) copier(m[1]);
  }
  // Les icônes du manifeste.
  const manifeste = JSON.parse(lire('site.webmanifest'));
  for (const i of manifeste.icons || []) copier(sansRequete(i.src));

  // --- GitHub Pages ---
  ecrire('.nojekyll', '');
  if (DOMAINE) ecrire('CNAME', DOMAINE + '\n');

  // --- le service worker, et la liste de ce qu'il garde ---
  /* Chaque fichier porte son EMPREINTE (les douze premiers chiffres de son sha-256). Une mise à jour
  ne télécharge que les fichiers dont l'empreinte a changé ; les autres sont recopiés de l'ancien
  cache. Sans ça, changer une ligne de code faisait retélécharger les 48 Mo du jeu. */
  const liste = [...copies].filter((r) => r !== '.nojekyll' && r !== 'CNAME').sort();
  const empreintes = {};
  const h = crypto.createHash('sha256');
  for (const r of liste) {
    const contenu = fs.readFileSync(path.join(OUT, r));
    empreintes[encodeURI(r)] = crypto.createHash('sha256').update(contenu).digest('hex').slice(0, 12);
    h.update(r); h.update(contenu);
  }
  empreintes['./'] = empreintes['index.html'];
  const version = /APP_VERSION\s*=\s*'([^']+)'/.exec(lire('js/version.js').toString('utf8'))[1];
  const cache = `grip-${version}-${h.digest('hex').slice(0, 10)}`;
  const sw = `/* GRIP — le jeu hors ligne. Fabriqué par tools/build-dist.js : ne pas modifier à la main. */
const CACHE = ${JSON.stringify(cache)};
const FICHIERS = ${JSON.stringify(empreintes)};
const MANIFESTE = 'grip-manifeste.json';
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const neuf = await caches.open(CACHE);
    // La version d'avant : son cache, et l'empreinte de chacun de ses fichiers.
    let ancien = null, avant = {};
    for (const k of await caches.keys()) {
      if (!k.startsWith('grip-') || k === CACHE) continue;
      const c = await caches.open(k), m = await c.match(MANIFESTE);
      if (m) { ancien = c; avant = await m.json(); }
    }
    // Fichier par fichier : un téléchargement raté ne fait pas échouer le reste.
    await Promise.allSettled(Object.entries(FICHIERS).map(async ([u, emp]) => {
      if (ancien && avant[u] === emp) { const r = await ancien.match(u); if (r) return neuf.put(u, r); }
      const r = await fetch(u, { cache: 'reload' });
      if (r.ok) await neuf.put(u, r);
    }));
    await neuf.put(MANIFESTE, new Response(JSON.stringify(FICHIERS), { headers: { 'Content-Type': 'application/json' } }));
  })());
});
// La nouvelle version attend que la page la demande (écran-titre ou menus), ou que le jeu soit fermé.
self.addEventListener('message', (e) => { if (e.data === 'activer') self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('grip-') && k !== CACHE)
    .map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;              // réseau, records, salons : jamais en cache
  if (req.mode === 'navigate') {
    e.respondWith(caches.match(req, { ignoreSearch: true })
      .then((r) => r || fetch(req).catch(() => caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req).then((res) => {
    if (res.ok) { const copie = res.clone(); caches.open(CACHE).then((c) => c.put(req, copie)); }
    return res;
  })));
});
`;
  fs.writeFileSync(path.join(OUT, 'sw.js'), sw);

  let total = 0;
  for (const r of liste) total += fs.statSync(path.join(OUT, r)).size;
  console.log(`dist : ${liste.length} fichiers, ${(total / 1e6).toFixed(1)} Mo, cache ${cache}`);
  console.log(`code : ${(avant / 1e3).toFixed(0)} ko → ${(apres / 1e3).toFixed(0)} ko minifiés`);
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
