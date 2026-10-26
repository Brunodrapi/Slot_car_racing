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
   le tableau mondial et les statistiques gardent besoin du réseau. Les mises à jour se proposent sur
   l'écran-titre et ne se font que si on les accepte (`js/maj.js`).

Le cache porte un nom tiré du CONTENU des fichiers : une nouvelle publication se reconnaît d'elle-même,
même si l'on a oublié de changer la version.

C'EST LA PROD. La recette, elle, est le dépôt lui-même, servi tel quel (brunodrapi.github.io/
Slot_car_racing) : code source commenté, pas de service worker, une pastille RECETTE. Ce script écrit
« prod » dans `APP_CANAL` (js/version.js), ce qui retire la pastille et rend au jeu son nom. Les deux
vivent sur des domaines différents, donc chacune avec sa sauvegarde : jouer à l'une ne touche pas à
l'autre. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { minify } = require('terser');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const arg = (nom) => { const a = process.argv.find((x) => x.startsWith(`--${nom}=`)); return a ? a.slice(nom.length + 3) : null; };
const OUT = path.resolve(ROOT, arg('sortie') || 'dist');
const DOMAINE = arg('domaine');

/* Les pages qu'on publie : le jeu et la page des statistiques, publique (agrégats seulement).

PAS LES OUTILS. L'éditeur de circuits et de décor (editor.html), l'éditeur de lignes et de panneaux
(lignes.html), le banc moteur (moteur.html) et tools/ restent dans la recette : « dans PROD il ne
faut pas qu'il y ait l'outil de modif des circuits, des lignes, les tools ». Leurs scripts propres
(editeur-decor.js, fichier-tracks.js…) ne partent pas non plus, puisqu'on ne copie que ce
que les pages publiées chargent. */
const PAGES = ['index.html', 'analytics.html'];

// Les ressources chargées par leur nom calculé (une voiture, une livrée, un drapeau, un circuit) :
// des dossiers entiers, moins ce qui n'est que matière de travail.
const DOSSIERS = ['art/interface', 'sprites/top', 'sprites/pick', 'sprites/environnement', 'sounds/engine'];
const FICHIERS = ['favicon.ico', 'site.webmanifest', 'art/Pitstop.png',
  'art/affiche-titre-portrait.webp', 'art/affiche-titre-paysage.webp',
  'art/icone-16.png', 'art/icone-32.png', 'art/icone-48.png', 'art/icone-180.png', 'art/icone-192.png',
  'art/icone-512.png', 'art/icone-maskable-512.png'];
const EXCLURE = (rel) => /_reprise\.|\.md$|LICENSE$|(^|\/)\./.test(rel);

/* LE SERVICE WORKER — le même texte à chaque publication (voir le manifeste plus bas).

Première installation : il télécharge tout ce que le manifeste publié énumère. Ensuite il ne
télécharge plus rien de lui-même : la page lui demande une mise à jour (`mettre-a-jour`) quand on l'a
acceptée. Il bâtit alors le nouveau cache à côté de l'ancien, en recopiant les fichiers inchangés, et
ne lâche l'ancien qu'une fois le nouveau complet — un téléchargement coupé laisse le jeu tel qu'il
était. Un cache est complet quand il contient son manifeste, posé en dernier. */
const SERVICE_WORKER = `/* GRIP — le jeu hors ligne. Fabriqué par tools/build-dist.js : ne pas modifier à la main. */
const MANIFESTE = 'grip-manifeste.json';
let actif = null;
async function cacheActif() {
  if (actif) return actif;
  for (const k of await caches.keys()) {
    if (k.startsWith('grip-') && await (await caches.open(k)).match(MANIFESTE)) { actif = k; break; }
  }
  return actif;
}
async function annoncer(m) {
  for (const c of await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })) c.postMessage(m);
}
async function installer(premiere) {
  const distant = await (await fetch('manifeste.json?t=' + Date.now(), { cache: 'no-store' })).json();
  const nomAncien = await cacheActif();
  if (nomAncien === distant.cache) { await annoncer({ type: 'pret', premiere }); return; }
  let avant = {}, ancien = null;
  if (nomAncien) { ancien = await caches.open(nomAncien); const m = await ancien.match(MANIFESTE); if (m) avant = (await m.json()).fichiers; }
  await caches.delete(distant.cache);                       // un essai interrompu : on repart de zéro
  const neuf = await caches.open(distant.cache);
  const aCharger = [];
  for (const [u, [emp, t]] of Object.entries(distant.fichiers)) {   // l'inchangé se recopie
    const r = avant[u] && avant[u][0] === emp ? await ancien.match(u) : null;
    if (r) await neuf.put(u, r); else aCharger.push([u, [emp, t]]);
  }
  const total = aCharger.reduce((s, [, [, t]]) => s + t, 0) || 1;
  let fait = 0, dernier = 0;
  const file = aCharger.slice();
  const ouvrier = async () => {
    while (file.length) {
      const [u, [, t]] = file.shift();
      const r = await fetch(u, { cache: 'reload' });
      if (!r.ok) throw new Error(u + ' : ' + r.status);
      await neuf.put(u, r);
      fait += t;
      const p = fait / total;
      if (p - dernier > 0.02 || p >= 1) { dernier = p; annoncer({ type: 'progres', progres: Math.min(1, p), premiere }); }
    }
  };
  try {
    await Promise.all([1, 2, 3, 4, 5, 6].map(ouvrier));
  } catch (err) {
    await caches.delete(distant.cache);
    throw err;
  }
  await neuf.put(MANIFESTE, new Response(JSON.stringify(distant), { headers: { 'Content-Type': 'application/json' } }));
  for (const k of await caches.keys()) if (k.startsWith('grip-') && k !== distant.cache) await caches.delete(k);
  actif = distant.cache;
  await annoncer({ type: 'pret', premiere });
}
self.addEventListener('install', (e) => {
  // Un nouveau texte de service worker garde le cache en place ; seule la toute première fois télécharge.
  e.waitUntil(cacheActif().then((nom) => (nom ? null : installer(true))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(async (ks) => {
    for (const k of ks) if (k.startsWith('grip-') && !(await (await caches.open(k)).match(MANIFESTE))) await caches.delete(k);
  }).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'mettre-a-jour') e.waitUntil(installer(false).catch(() => annoncer({ type: 'echec' })));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;               // réseau, records, salons : jamais en cache
  if (/\\/(manifeste\\.json|sw\\.js)$/.test(url.pathname)) return;   // toujours la version publiée
  e.respondWith((async () => {
    const nom = await cacheActif();
    const c = nom ? await caches.open(nom) : null;
    const trouve = c && (await c.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await c.match('index.html') : null));
    if (trouve) return trouve;
    try { return await fetch(req); } catch (err) {
      if (req.mode === 'navigate' && c) { const i = await c.match('index.html'); if (i) return i; }
      throw err;
    }
  })());
});
`;

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
    // Les commentaires HTML partent comme ceux du code. (Le service worker s'enregistre depuis js/maj.js.)
    html = html.replace(/<!--[\s\S]*?-->/g, '');
    ecrire(page, html);
  }

  // --- le code : minifié fichier par fichier ---
  for (const rel of scripts) {
    let src = lire(rel).toString('utf8');
    if (rel === 'js/version.js') {
      const prod = src.replace(/const APP_CANAL = '[^']*'/, "const APP_CANAL = 'prod'");
      if (prod === src && !/APP_CANAL = 'prod'/.test(src)) throw new Error('APP_CANAL introuvable dans js/version.js');
      src = prod;
    }
    if (rel === 'js/static-backdrop.js') {
      // Resolve the static passes BEFORE minification removes renderer markers.
      // Emit normal functions so terser also minifies every generated pass.
      const vm = require('vm'), captured = [];
      const draw = vm.runInNewContext(lire('js/render.js').toString('utf8') + ';Renderer.prototype.draw');
      const sandbox = {window: {}, Function: function(...args) {
        const fn = new Function(...args); captured.push(fn); return fn;
      }};
      vm.runInNewContext(src, sandbox);
      sandbox.window.installBackdropCachePrototype({draw});
      if(captured.length !== 3) throw new Error('Unexpected backdrop pass count');
      const head = src.indexOf(' const original='), tail = src.indexOf(' const CELL=');
      if(head < 0 || tail < head) throw new Error('Backdrop build markers missing');
      src = src.slice(0,head) + ' const original=r.draw; const base=' + captured[0].toString()
        + ';const decor=' + captured[1].toString() + ';const compiled=' + captured[2]().toString()
        + ';\n' + src.slice(tail);
    }
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

  // --- le manifeste de la version, et le service worker ---
  /* `manifeste.json` dit ce qu'est cette version : son numéro, le nom de son cache (tiré du contenu),
  et pour chaque fichier son empreinte (douze chiffres de son sha-256) et sa taille. C'est lui qui
  change d'une publication à l'autre ; `sw.js`, lui, est toujours le même texte, si bien que le
  navigateur ne déclenche jamais de mise à jour de lui-même. La page compare les deux manifestes —
  l'installé, le publié — et propose la mise à jour ; elle ne se fait que si on l'accepte, et ne
  télécharge alors que les fichiers dont l'empreinte a changé. */
  const liste = [...copies].filter((r) => r !== '.nojekyll' && r !== 'CNAME').sort();
  const fichiers = {};
  const h = crypto.createHash('sha256');
  for (const r of liste) {
    const contenu = fs.readFileSync(path.join(OUT, r));
    fichiers[encodeURI(r)] = [crypto.createHash('sha256').update(contenu).digest('hex').slice(0, 12), contenu.length];
    h.update(r); h.update(contenu);
  }
  fichiers['./'] = fichiers['index.html'];
  const version = /APP_VERSION\s*=\s*'([^']+)'/.exec(lire('js/version.js').toString('utf8'))[1];
  const cache = `grip-${version}-${h.digest('hex').slice(0, 10)}`;
  fs.writeFileSync(path.join(OUT, 'manifeste.json'), JSON.stringify({ version, cache, fichiers }));
  fs.writeFileSync(path.join(OUT, 'sw.js'), SERVICE_WORKER);

  let total = 0;
  for (const r of liste) total += fs.statSync(path.join(OUT, r)).size;
  console.log(`dist : ${liste.length} fichiers, ${(total / 1e6).toFixed(1)} Mo, cache ${cache}`);
  console.log(`code : ${(avant / 1e3).toFixed(0)} ko → ${(apres / 1e3).toFixed(0)} ko minifiés`);
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
