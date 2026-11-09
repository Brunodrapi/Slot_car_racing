/* LE JEU HORS LIGNE ET SA MISE À JOUR, vus depuis la page.

Ne sert que dans la version publiée (`npm run build`), qui fournit `sw.js` et `manifeste.json`. Dans le
dépôt, ni l'un ni l'autre n'existent : l'enregistrement échoue, `MAJ.etat` reste « dev », et rien ne
s'affiche.

Les états :
  absent        le jeu n'est pas téléchargé : il se joue en ligne. L'écran-titre PROPOSE de le
                télécharger, avec sa taille ; « Non merci » ne le repropose plus sur l'écran-titre, et
                les réglages gardent le bouton
  installation  téléchargement en cours (le premier, accepté, ou une mise à jour acceptée)
  hors-ligne    téléchargé, pas de réseau : on joue la version installée
  a-jour        téléchargé, le réseau répond et la version installée est la dernière
  disponible    téléchargé, une version plus récente est publiée — la télécharger ou continuer
  reporte       « continuer avec cette version » : on n'en parle plus pour cette partie
  erreur        le téléchargement n'a pas abouti : on garde ce qu'on avait

RIEN NE SE TÉLÉCHARGE SANS ACCORD, pas même la première fois (0.52.57) : « le téléchargement se fait
automatiquement, je veux qu'il soit proposé mais pas imposé ». Le jeu publié pèse une cinquantaine de
mégaoctets ; on le dit avant. Et la taille reste affichée avec la version une fois téléchargé, avec
un bouton pour le supprimer (dans les réglages). `sw.js` ne change pas d'une publication à l'autre —
tout ce qui change est dans `manifeste.json` —, si bien que le navigateur ne lance jamais de lui-même
une mise à jour en douce. */
'use strict';

const MAJ = {
  etat: 'dev',          // dev, verification, absent, installation, hors-ligne, a-jour, disponible, reporte, erreur
  telecharge: false,    // une version est dans le cache de l'appareil
  version: null,        // la version téléchargée, ou la version publiée quand rien n'est téléchargé
  poids: 0,             // octets du jeu entier : la version téléchargée, ou celle qu'on téléchargerait
  nouvelle: null,       // la version publiée, quand elle diffère de la téléchargée
  taille: 0,            // octets à télécharger pour la mise à jour
  progres: 0,           // 0..1 pendant un téléchargement
  fait: 0, total: 0,    // octets reçus et attendus pendant un téléchargement
  premiere: false,      // vrai pendant le premier téléchargement
  sansServiceWorker: false,  // pas de `sw.js` ici : la recette, servie telle quelle (voir `horsLigneLigne`)
  ecouteurs: [],
  surChangement(f) { this.ecouteurs.push(f); },
  _poser(champs) { Object.assign(this, champs); for (const f of this.ecouteurs) { try { f(this); } catch (_) { /* l'interface se débrouille */ } } },

  /* « Non merci » se retient sur l'appareil : l'écran-titre ne repose pas la question à chaque
  lancement. Les réglages, eux, gardent toujours le bouton. */
  CLE_REFUS: 'grip.horsLigne.refus',
  refuse() { try { return localStorage.getItem(this.CLE_REFUS) === '1'; } catch (_) { return false; } },
  _retiens(oui) { try { if (oui) localStorage.setItem(this.CLE_REFUS, '1'); else localStorage.removeItem(this.CLE_REFUS); } catch (_) { /* navigation privée */ } },

  /** Le manifeste de la version téléchargée (dans le cache), ou null. */
  async installe() {
    try { const r = await caches.match('grip-manifeste.json'); return r ? await r.json() : null; } catch (_) { return null; }
  },

  /** Le manifeste publié, depuis le réseau, ou null s'il n'y a pas de réseau. */
  async publie() {
    try {
      const r = await fetch('manifeste.json?t=' + Date.now(), { cache: 'no-store' });
      return r.ok ? await r.json() : null;
    } catch (_) { return null; }
  },

  /** Le poids d'une version entière, en octets. */
  poidsDe(m) { let n = 0; for (const [, [, t]] of Object.entries((m && m.fichiers) || {})) n += t; return n; },

  /** Ce qu'il faudrait télécharger pour passer de `a` à `b`, en octets. */
  aTelecharger(a, b) {
    let n = 0;
    for (const [u, [emp, taille]] of Object.entries(b.fichiers)) if (!a || !a.fichiers[u] || a.fichiers[u][0] !== emp) n += taille;
    return n;
  },

  async verifier() {
    const local = await this.installe();
    this._poser({ etat: 'verification', telecharge: !!local, version: local ? local.version : null, poids: local ? this.poidsDe(local) : 0 });
    const distant = await this.publie();
    if (!local) {
      // rien de téléchargé : on dit ce que pèserait le jeu, et la version qu'on joue en ligne
      this._poser({ etat: 'absent', version: distant ? distant.version : (typeof APP_VERSION !== 'undefined' ? APP_VERSION : null),
        poids: distant ? this.poidsDe(distant) : 0 });
      return;
    }
    if (!distant) { this._poser({ etat: 'hors-ligne' }); return; }
    if (distant.cache === local.cache) { this._poser({ etat: 'a-jour' }); return; }
    this._poser({ etat: 'disponible', nouvelle: distant.version, taille: this.aTelecharger(local, distant) });
  },

  _demander(type) {
    // `ready`, pas `controller` : après un rechargement forcé, la page n'est pas contrôlée, mais le
    // service worker est là et répond quand même (il écrit à toutes les fenêtres).
    return navigator.serviceWorker.ready.then((r) => r.active.postMessage({ type }));
  },

  /** Télécharger le jeu pour jouer hors ligne : la première fois, quand le joueur l'accepte. */
  telecharger() {
    this._retiens(false);
    this._poser({ etat: 'installation', progres: 0, fait: 0, total: this.poids, premiere: true });
    this._demander('telecharger').catch(() => this._poser({ etat: 'erreur', premiere: true }));
  },

  /** « Non merci » : l'écran-titre ne le propose plus ; les réglages gardent le bouton. */
  nonMerci() { this._retiens(true); this._poser({}); },

  /** Supprimer la version téléchargée : le jeu redevient une page en ligne, la sauvegarde ne bouge pas. */
  supprimer() {
    this._retiens(true);           // on vient de dire non : l'écran-titre ne repropose pas aussitôt
    this._demander('supprimer').catch(() => this.verifier());
  },

  /** Accepter la mise à jour. La page se recharge quand elle est prête, hors course. */
  lancer() {
    this._poser({ etat: 'installation', progres: 0, fait: 0, total: this.taille, premiere: false });
    this._demander('mettre-a-jour').catch(() => this._poser({ etat: 'erreur', premiere: false }));
  },

  /** Continuer avec la version téléchargée : on n'en parle plus pour cette partie. */
  plusTard() { this._poser({ etat: 'reporte' }); },

  // Recharger seulement sur l'écran-titre ou dans les menus, jamais en course ni dans un salon.
  _recharger() {
    const etat = window.app && app.state;
    if (!etat || etat === 'splash' || etat === 'menu') location.reload();
    else setTimeout(() => this._recharger(), 3000);
  },

  demarrer() {
    if (!('serviceWorker' in navigator)) { this.sansServiceWorker = true; return; }
    navigator.serviceWorker.addEventListener('message', (e) => {
      const m = e.data || {};
      if (m.type === 'progres') this._poser({ etat: 'installation', progres: m.progres, premiere: !!m.premiere,
        fait: m.fait || 0, total: m.total || this.total });
      // le premier téléchargement ne recharge rien : la page tourne déjà sur cette version
      else if (m.type === 'pret') { if (m.premiere) this.verifier(); else this._recharger(); }
      else if (m.type === 'echec') this._poser({ etat: 'erreur', premiere: !!m.premiere });
      else if (m.type === 'supprime') this.verifier();
    });
    navigator.serviceWorker.register('sw.js').then(() => this.verifier())
      .catch(() => this._poser({ sansServiceWorker: true }));   // pas de sw.js : le dépôt, pas la version publiée
  },
};

if (typeof window !== 'undefined') MAJ.demarrer();
