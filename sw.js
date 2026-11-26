/* GRIP — téléchargement hors ligne à la demande, partagé par la recette et la distribution. */
const MANIFESTE = 'grip-manifeste.json';
const scope = self.registration.scope;
const prefix = 'slotless-pwa:' + scope + ':';
let actif;
async function appartient(nom) {
  // Les anciennes installations utilisent un préfixe commun, mais leur manifeste a une URL propre.
  return nom.startsWith(prefix) || (nom.startsWith('grip-') && !!await (await caches.open(nom)).match(MANIFESTE));
}
async function cacheActif() {
  if (actif !== undefined) return actif;
  for (const k of await caches.keys()) {
    if (await appartient(k) && await (await caches.open(k)).match(MANIFESTE)) { actif = k; break; }
  }
  return actif ??= null;
}
async function annoncer(m) {
  for (const c of await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })) {
    const page = new URL(c.url);
    if ([scope, new URL('index.html', scope).href].includes(page.origin + page.pathname)) c.postMessage(m);
  }
}
async function installer(premiere) {
  const distant = await (await fetch('manifeste.json?t=' + Date.now(), { cache: 'no-store' })).json();
  const nom = prefix + distant.cache;
  const nomAncien = await cacheActif();
  if (nomAncien === nom) { await annoncer({ type: 'pret', premiere }); return; }
  let avant = {}, ancien = null;
  if (nomAncien) { ancien = await caches.open(nomAncien); const m = await ancien.match(MANIFESTE); if (m) avant = (await m.json()).fichiers; }
  await caches.delete(nom);                       // un essai interrompu : on repart de zéro
  const neuf = await caches.open(nom);
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
      if (p - dernier > 0.02 || p >= 1) { dernier = p; annoncer({ type: 'progres', progres: Math.min(1, p), premiere, fait, total }); }
    }
  };
  try {
    await Promise.all([1, 2, 3, 4, 5, 6].map(ouvrier));
  } catch (err) {
    await caches.delete(nom);
    throw err;
  }
  await neuf.put(MANIFESTE, new Response(JSON.stringify(distant), { headers: { 'Content-Type': 'application/json' } }));
  for (const k of await caches.keys()) if (k !== nom && await appartient(k)) await caches.delete(k);
  actif = nom;
  await annoncer({ type: 'pret', premiere });
}
async function supprimer() {
  actif = null;
  for (const k of await caches.keys()) if (await appartient(k)) await caches.delete(k);
  await annoncer({ type: 'supprime' });
}
self.addEventListener('install', (e) => {
  // Rien ne se télécharge à l'installation : un cache déjà là reste en place, et sinon on attend qu'on le demande.
  e.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(async (ks) => {
    for (const k of ks) if (k.startsWith(prefix) && !(await (await caches.open(k)).match(MANIFESTE))) await caches.delete(k);
  }).then(() => self.clients.claim()));
});
let mutations = Promise.resolve();
self.addEventListener('message', (e) => {
  const type = e.data && e.data.type;
  const premiere = type === 'telecharger';
  if (!premiere && type !== 'mettre-a-jour' && type !== 'supprimer') return;
  mutations = mutations.then(() => type === 'supprimer' ? supprimer() : installer(premiere))
    .catch(() => annoncer({ type: 'echec', premiere }));
  e.waitUntil(mutations);
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!url.href.startsWith(scope)) return;
  const chemin = url.pathname.slice(new URL(scope).pathname.length);
  if (chemin.includes('/') && !/^(art|css|js|sounds|sprites|vendor)\//.test(chemin)) return;
  if (req.mode === 'navigate' && !['', 'index.html', 'analytics.html'].includes(chemin)) return;
  // toujours la version publiée — et itch.html, le pont d'itch.io : une page hors du cache retombait
  // sur index.html, et l'onglet de connexion aurait ouvert le jeu à la place du pont
  if (/\/(manifeste\.json|sw\.js|itch\.html)$/.test(url.pathname)) return;
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
