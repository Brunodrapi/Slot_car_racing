/* Les records mondiaux : lecture publique, écriture par le serveur seul.

Ce fichier ne contient volontairement aucune bibliothèque. Le jeu est une poignée de fichiers
statiques sans étape de construction, et `supabase-js` aurait apporté un paquet entier pour trois
requêtes HTTP qu'on écrit en vingt lignes. Le prix à payer est la connexion Google, faite à la main
plus bas ; il reste inférieur à celui d'une dépendance dans un projet qui n'en a aucune.

Trois choses vivent ici, et une seule sort d'ici vers le reste du jeu : `Mondial`.

  1. La LECTURE des records. Elle passe par l'API REST, avec la clé publiable, et elle est ouverte
     à tous — y compris à qui n'a pas de compte. Un tableau qu'il faut mériter de voir ne sert à
     rien : c'est ce qu'on regarde avant de jouer.

  2. L'ÉCRITURE d'un temps. Elle ne passe PAS par l'API REST. La table est fermée en écriture, et
     un temps ne s'inscrit que par une fonction serveur qui le vérifie d'abord. C'est le seul
     moyen : la clé publiable vit dans le code de la page, donc tout le monde l'a, et une table
     ouverte en écriture se remplirait de tours en une milliseconde.

  3. La CONNEXION Google, exigée pour écrire et pour elle seule. On joue, on s'améliore et on lit
     le tableau sans compte ; il ne faut un compte que pour y entrer. C'est aussi ce qui permet de
     retrouver ses temps après un changement d'appareil ou de nom.

Rien ici n'est indispensable au jeu. Toute panne — réseau coupé, service indisponible, session
expirée — se termine par un tableau mondial vide et une course qui continue. Un jeu hors-ligne qui
refuse de démarrer parce qu'un serveur de scores ne répond pas serait un jeu cassé par son
classement.
*/
'use strict';

const MONDIAL_URL = 'https://fyaifqvghkvrydcldiup.supabase.co';
/* Cette clé est PUBLIQUE par construction : elle est faite pour vivre dans le code d'une page web,
   elle part dans chaque requête et n'importe qui peut la lire. Ce qu'elle autorise est décidé par
   les règles de la base, pas par son secret. Sa jumelle `sb_secret_…` contourne toutes ces règles
   et ne doit jamais approcher ce fichier. */
const MONDIAL_KEY = 'sb_publishable_O5veQvYKXfUt6e7iKtrDUg_rqPC_CS9';

class Mondial {
  constructor() {
    this.session = null;        // { token, expire, nom, sub } une fois connecté
    this.cache = new Map();     // circuit → { t, lignes } : une lecture par circuit, pas par ligne
    this.erreur = null;
    this._litSession();
    this._litRetour();
  }

  /* La session, relue du navigateur puis du fragment d'URL.

  Supabase renvoie le jeton dans le `#fragment` de l'adresse de retour, qui n'est jamais transmis
  au serveur. On le range, et on NETTOIE L'ADRESSE tout de suite : laissé là, il reste dans
  l'historique, dans un favori, dans un lien partagé — un jeton d'accès dans une barre d'adresse
  est un jeton qui finit par circuler. */
  _litSession() {
    try {
      const s = JSON.parse(localStorage.getItem('eol.session') || 'null');
      if (s && s.expire > Date.now() / 1000 + 60) this.session = s;
    } catch (_) { /* un stockage illisible n'est pas une raison de ne pas démarrer */ }
  }

  _litRetour() {
    const h = location.hash || '';
    if (h.indexOf('access_token=') < 0) return;
    const p = new URLSearchParams(h.slice(1));
    const token = p.get('access_token');
    if (token) {
      const charge = decodeJwt(token) || {};
      this.session = {
        token,
        expire: +p.get('expires_at') || charge.exp || 0,
        sub: charge.sub || '',
        nom: (charge.user_metadata && charge.user_metadata.full_name) || charge.email || '',
      };
      try { localStorage.setItem('eol.session', JSON.stringify(this.session)); } catch (_) {}
    }
    history.replaceState(null, '', location.pathname + location.search);
  }

  connecte() { return !!(this.session && this.session.expire > Date.now() / 1000 + 60); }

  /* Partir se connecter chez Google, et revenir ici même.

  `redirect_to` doit être déclaré dans le tableau de bord Supabase, sinon la redirection est
  refusée au retour — c'est la protection qui empêche un site tiers de récupérer les jetons. */
  entrer() {
    const retour = location.origin + location.pathname;
    location.href = `${MONDIAL_URL}/auth/v1/authorize?provider=google`
      + `&redirect_to=${encodeURIComponent(retour)}`;
  }

  sortir() {
    this.session = null;
    try { localStorage.removeItem('eol.session'); } catch (_) {}
  }

  /* Les records d'un circuit, une ligne par voiture.

  Une seule requête par circuit et non une par voiture : neuf requêtes pour peindre un écran
  seraient neuf occasions d'échouer et neuf allers-retours à attendre. Le résultat est gardé
  quelques minutes, parce qu'un record du monde ne change pas entre deux ouvertures d'un menu. */
  async records(circuit) {
    const vu = this.cache.get(circuit);
    if (vu && Date.now() - vu.t < 180000) return vu.lignes;
    try {
      const r = await fetch(`${MONDIAL_URL}/rest/v1/records`
        + `?select=voiture,temps,pilote&circuit=eq.${encodeURIComponent(circuit)}&order=temps.asc`,
        { headers: { apikey: MONDIAL_KEY, Authorization: `Bearer ${MONDIAL_KEY}` } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const lignes = await r.json();
      this.cache.set(circuit, { t: Date.now(), lignes });
      this.erreur = null;
      return lignes;
    } catch (e) {
      // pas de tableau mondial, et c'est tout : la course, elle, n'a besoin de personne
      this.erreur = String(e.message || e);
      return vu ? vu.lignes : [];
    }
  }

  /* Déclarer son pseudo, une fois connecté.

  C'est la seule écriture qu'un navigateur a le droit de faire, et elle ne touche que sa propre
  ligne — le RLS s'en assure. Elle est nécessaire : le serveur refuse un temps dont l'auteur n'a
  pas de pseudo déclaré, parce qu'il prend le nom DANS LA BASE et jamais dans la requête. Sinon
  n'importe qui signerait n'importe quel nom, et le tableau attribuerait des records au hasard.

  Un pseudo déjà pris par un autre compte fait échouer l'écriture sur l'index unique. On le
  remonte tel quel : c'est au joueur d'en choisir un autre, pas à nous d'en inventer un. */
  async declarePseudo(pseudo) {
    if (!this.connecte()) return { ok: false, raison: 'anonyme' };
    try {
      const r = await fetch(`${MONDIAL_URL}/rest/v1/pilotes`, {
        method: 'POST',
        headers: {
          apikey: MONDIAL_KEY,
          Authorization: `Bearer ${this.session.token}`,
          'content-type': 'application/json',
          // « merge-duplicates » : une deuxième connexion met à jour la ligne au lieu d'échouer
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({ id: this.session.sub, pseudo }),
      });
      if (r.ok) { this.pseudoPose = pseudo; return { ok: true }; }
      const rep = await r.json().catch(() => ({}));
      // 23505 : l'index unique sur le pseudo. Le nom est à quelqu'un d'autre.
      return { ok: false, raison: rep.code === '23505' ? 'pseudo_pris' : (rep.message || 'HTTP ' + r.status) };
    } catch (e) {
      return { ok: false, raison: String(e.message || e) };
    }
  }

  /* Proposer un temps. Le serveur décide.

  On n'envoie rien sans session : sans jeton, la fonction refuserait de toute façon, et partir
  quand même ne ferait qu'ajouter un aller-retour à une réponse déjà connue. */
  async propose(circuit, voiture, temps) {
    if (!this.connecte()) return { ok: false, raison: 'anonyme' };
    try {
      const r = await fetch(`${MONDIAL_URL}/functions/v1/record`, {
        method: 'POST',
        headers: {
          apikey: MONDIAL_KEY,
          Authorization: `Bearer ${this.session.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ circuit, voiture, temps, pilote: null }),
      });
      const rep = await r.json().catch(() => ({}));
      if (r.ok) this.cache.delete(circuit);   // le tableau vient de changer : on le relira
      if (r.status === 401) this.sortir();    // session périmée : on redemandera la connexion
      return { ok: r.ok, raison: rep.raison || rep.message || ('HTTP ' + r.status) };
    } catch (e) {
      return { ok: false, raison: String(e.message || e) };
    }
  }
}

/* Lire la charge d'un jeton SANS en vérifier la signature.

C'est volontaire et sans danger ici : on ne s'en sert que pour afficher un nom et connaître une
date d'expiration. Rien de ce qu'on y lit n'ouvre une porte — c'est le serveur qui vérifie la
signature, et lui seul décide si un temps entre en base. Un jeton bricolé par le joueur ne lui
donnerait qu'un nom mensonger sur son propre écran. */
function decodeJwt(t) {
  try {
    const c = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(c.padEnd(Math.ceil(c.length / 4) * 4, '=')))));
  } catch (_) { return null; }
}

if (typeof module !== 'undefined') module.exports = { Mondial };
