/* Libère le dossier de l'ancien essai pour que sa page puisse renvoyer vers la recette. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  await self.clients.claim();
  await self.registration.unregister();
})()));
