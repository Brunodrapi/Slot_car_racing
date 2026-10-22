/* GRIP — le jeu hors ligne. Fabriqué par tools/build-dist.js : ne pas modifier à la main. */
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
  if (/\/(manifeste\.json|sw\.js)$/.test(url.pathname)) return;   // toujours la version publiée
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
