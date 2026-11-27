// LE JEU HORS LIGNE, côté page (scripts/hors_ligne.gd le pilote). outils/publie-web.sh pose ce script
// dans index.html, avec window.GRIP_HORS_LIGNE : le nom du cache du service worker de Godot (une
// version, un cache), les fichiers du moteur et leurs tailles, les décors des circuits et les leurs.
// Le moteur va dans ce cache : le service worker l'y trouve, et la page démarre sans réseau. La marque
// « grip-hors-ligne » y dit que le joueur a accepté : sans elle, le service worker n'y range pas le moteur
// de lui-même (rien ne se télécharge sans accord, comme dans le jeu web), et il la reporte d'une
// version à la suivante. Les décors, eux, sont rangés par Godot dans ses sauvegardes (user://decors).
(function () {
  'use strict';
  var M = window.GRIP_HORS_LIGNE || null;
  var HL = window.gripHL = { verifie: false, sw: false, manque: [], octets: 0, fait: 0, fini: false, erreur: '' };
  var MARQUE = 'grip-hors-ligne';
  function possible() { return !!M && window.isSecureContext && 'serviceWorker' in navigator && typeof caches !== 'undefined'; }

  // ce qui manque du moteur dans le cache de cette version
  HL.verifier = function () {
    HL.verifie = false;
    if (!possible()) { HL.sw = false; HL.verifie = true; return; }
    HL.sw = true;
    caches.open(M.cache).then(function (c) {
      return Promise.all(Object.keys(M.moteur).map(function (f) { return c.match(f).then(function (r) { return r ? '' : f; }); }));
    }).then(function (l) { HL.manque = l.filter(Boolean); }, function () { HL.manque = Object.keys(M.moteur); })
      .then(function () {
        HL.octets = HL.manque.reduce(function (n, f) { return n + M.moteur[f]; }, 0);
        HL.verifie = true;
      });
  };

  // le moteur, fichier par fichier, en comptant les octets reçus (le service worker, s'il tient la page,
  // revérifie chaque fichier sur le réseau : jamais un moteur d'une version mêlé à celui d'une autre)
  HL.telecharger = function () {
    HL.fini = false; HL.erreur = ''; HL.fait = 0;
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* le navigateur décide */ }
    (async function () {
      var c = await caches.open(M.cache);
      await c.put(MARQUE, new Response('1'));
      for (var i = 0; i < HL.manque.length; i++) {
        var f = HL.manque[i];
        var r = await fetch(f, { cache: 'no-cache' });
        if (!r.ok || !r.body) throw new Error(f + ' : HTTP ' + r.status);
        var lecteur = r.body.getReader(), morceaux = [];
        for (;;) {
          var m = await lecteur.read();
          if (m.done) break;
          morceaux.push(m.value);
          HL.fait += m.value.length;
        }
        var type = r.headers.get('content-type') || 'application/octet-stream';
        await c.put(f, new Response(new Blob(morceaux, { type: type }), { headers: { 'content-type': type } }));
      }
    })().then(function () { HL.fini = true; }, function (e) { HL.erreur = String((e && e.message) || e); HL.fini = true; });
  };

  // supprimer : la marque et le moteur (la page d'erreur hors ligne de Godot reste)
  HL.supprimer = function () {
    HL.fini = false;
    if (!possible()) { HL.fini = true; return; }
    caches.open(M.cache).then(function (c) {
      return Promise.all([MARQUE].concat(M.lourds).map(function (f) { return c.delete(f); }));
    }).then(function () { HL.fini = true; }, function () { HL.fini = true; });
  };
})();
