/* LE JEU HORS LIGNE ET SA MISE À JOUR, vus depuis la page.

Ne sert que dans la version publiée (`npm run build`), qui fournit `sw.js` et `manifeste.json`. Dans le
dépôt, ni l'un ni l'autre n'existent : l'enregistrement échoue, `MAJ.etat` reste « dev », et rien ne
s'affiche.

Au lancement, l'écran-titre dit où en est le jeu :
  hors-ligne    pas de réseau : on joue la version installée
  a-jour        le réseau répond et la version installée est la dernière
  disponible    une version plus récente est publiée — la télécharger ou continuer avec celle-ci
  installation  téléchargement en cours (la première installation, ou une mise à jour acceptée)
  erreur        la mise à jour n'a pas abouti : on garde la version installée

RIEN NE SE TÉLÉCHARGE SANS ACCORD, sauf la toute première installation, sans laquelle il n'y aurait pas
de jeu hors ligne. `sw.js` ne change jamais d'une publication à l'autre — tout ce qui change est dans
`manifeste.json` —, si bien que le navigateur ne lance jamais de lui-même une mise à jour en douce. */
'use strict';

const MAJ = {
  etat: 'dev',          // dev, verification, installation, hors-ligne, a-jour, disponible, erreur
  version: null,        // la version installée
  nouvelle: null,       // la version publiée, quand elle diffère
  taille: 0,            // octets à télécharger pour la mise à jour
  progres: 0,           // 0..1 pendant un téléchargement
  premiere: false,      // vrai pendant la toute première installation
  ecouteurs: [],
  surChangement(f) { this.ecouteurs.push(f); },
  _poser(champs) { Object.assign(this, champs); for (const f of this.ecouteurs) { try { f(this); } catch (_) { /* l'interface se débrouille */ } } },

  /** Le manifeste de la version installée (dans le cache), ou null. */
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

  /** Ce qu'il faudrait télécharger pour passer de `a` à `b`, en octets. */
  aTelecharger(a, b) {
    let n = 0;
    for (const [u, [emp, taille]] of Object.entries(b.fichiers)) if (!a || !a.fichiers[u] || a.fichiers[u][0] !== emp) n += taille;
    return n;
  },

  async verifier() {
    const local = await this.installe();
    if (!local) return;                                  // la première installation est en cours
    this._poser({ etat: 'verification', version: local.version });
    const distant = await this.publie();
    if (!distant) { this._poser({ etat: 'hors-ligne' }); return; }
    if (distant.cache === local.cache) { this._poser({ etat: 'a-jour' }); return; }
    this._poser({ etat: 'disponible', nouvelle: distant.version, taille: this.aTelecharger(local, distant) });
  },

  /** Accepter la mise à jour. La page se recharge quand elle est prête, hors course. */
  lancer() {
    this._poser({ etat: 'installation', progres: 0, premiere: false });
    // `ready`, pas `controller` : après un rechargement forcé, la page n'est pas contrôlée, mais le
    // service worker est là et répond quand même (il écrit à toutes les fenêtres).
    navigator.serviceWorker.ready.then((r) => r.active.postMessage({ type: 'mettre-a-jour' }))
      .catch(() => this._poser({ etat: 'erreur' }));
  },

  /** Continuer avec la version installée : on n'en parle plus pour cette partie. */
  plusTard() { this._poser({ etat: 'reporte' }); },

  // Recharger seulement sur l'écran-titre ou dans les menus, jamais en course ni dans un salon.
  _recharger() {
    const etat = window.app && app.state;
    if (!etat || etat === 'splash' || etat === 'menu') location.reload();
    else setTimeout(() => this._recharger(), 3000);
  },

  demarrer() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('message', (e) => {
      const m = e.data || {};
      if (m.type === 'progres') this._poser({ etat: 'installation', progres: m.progres, premiere: !!m.premiere });
      else if (m.type === 'pret') { if (m.premiere) this.verifier(); else this._recharger(); }
      else if (m.type === 'echec') this._poser({ etat: 'erreur' });
    });
    navigator.serviceWorker.register('sw.js').then(async () => {
      if (await this.installe()) this.verifier();
      else this._poser({ etat: 'installation', progres: 0, premiere: true });
    }).catch(() => { /* pas de sw.js : le dépôt, pas la version publiée */ });
  },
};

if (typeof window !== 'undefined') MAJ.demarrer();
